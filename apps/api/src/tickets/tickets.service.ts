import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { createReadStream, existsSync, unlink } from 'fs';
import { resolve } from 'path';
import { DatabaseService } from '../database/database.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { UsuarioSesion } from '../common/current-user.decorator';
import {
  CATEGORIAS,
  ES_STAFF,
  ESTADOS,
  NIVELES,
  SLA_DEFAULT,
  TRANSICIONES,
  URGENCIAS,
  analizarTriaje,
} from '../common/constants';
import { LEGACY_UPLOADS_DIR, UPLOADS_DIR } from '../config/uploads';

const esStaff = (user: UsuarioSesion) => ES_STAFF.includes(user.rol);

@Injectable()
export class TicketsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async obtenerSla() {
    try {
      const [rows] = await this.db.query<any[]>(
        "SELECT valor FROM configuracion WHERE clave = 'sla_horas'",
      );
      if (rows.length) {
        const guardado = JSON.parse(rows[0].valor);
        const combinado: any = {};
        for (const u of URGENCIAS) {
          combinado[u] = {
            respuesta: Number(guardado?.[u]?.respuesta) || SLA_DEFAULT[u].respuesta,
            resolucion: Number(guardado?.[u]?.resolucion) || SLA_DEFAULT[u].resolucion,
          };
        }
        return combinado;
      }
    } catch {
      // Si la tabla aún no existe se usan los valores por defecto.
    }
    return SLA_DEFAULT;
  }

  private async historial(
    id_ticket: number,
    id_usuario: number | null,
    accion: string,
    detalle: string | null = null,
    estadoAnterior: string | null = null,
    estadoNuevo: string | null = null,
  ) {
    await this.db.query(
      `INSERT INTO ticket_historial (id_ticket, id_usuario, accion, detalle, estado_anterior, estado_nuevo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_ticket, id_usuario, accion, detalle, estadoAnterior, estadoNuevo],
    );
  }

  async autorizado(user: UsuarioSesion, idRaw: any) {
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('ID de ticket inválido');
    }

    const [rows] = await this.db.query<any[]>('SELECT * FROM tickets WHERE id_ticket = ?', [id]);
    if (!rows.length) throw new NotFoundException('Ticket no encontrado');

    const ticket = rows[0];
    if (!esStaff(user) && Number(ticket.id_solicitante) !== Number(user.id_usuario)) {
      throw new ForbiddenException('No tienes acceso a este ticket');
    }
    return ticket;
  }

  async crear(user: UsuarioSesion, body: any) {
    const {
      asunto,
      descripcion,
      categoria,
      urgencia,
      subcategoria = null,
      datos_especificos = null,
    } = body || {};

    if (!asunto?.trim() || String(asunto).length > 200) {
      throw new BadRequestException('El asunto es obligatorio (máx. 200 caracteres)');
    }
    if (!descripcion?.trim()) {
      throw new BadRequestException('La descripción es obligatoria');
    }
    if (!CATEGORIAS.includes(categoria)) {
      throw new BadRequestException(`Categoría inválida. Usa: ${CATEGORIAS.join(', ')}`);
    }
    if (!URGENCIAS.includes(urgencia)) {
      throw new BadRequestException(`Urgencia inválida. Usa: ${URGENCIAS.join(', ')}`);
    }
    if (
      datos_especificos !== null &&
      (typeof datos_especificos !== 'object' || Array.isArray(datos_especificos))
    ) {
      throw new BadRequestException('Los datos específicos deben ser un objeto');
    }

    const triaje = analizarTriaje({ asunto, descripcion, categoria, urgencia });
    const urgenciaFinal = triaje.urgencia;
    const sla: any = await this.obtenerSla();
    const { respuesta: hResp, resolucion: hRes } = sla[urgenciaFinal];

    const [filasCreadas] = await this.db.query<any>(
      `INSERT INTO tickets
         (asunto, descripcion, categoria, subcategoria, urgencia, id_solicitante,
          sla_horas_respuesta, sla_horas_resolucion,
          sla_vencimiento_respuesta, sla_vencimiento_resolucion,
          datos_especificos, prioridad_auto, palabras_clave)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?,
          NOW() + (? * INTERVAL '1 hour'), NOW() + (? * INTERVAL '1 hour'), ?::jsonb, ?, ?)
       RETURNING id_ticket`,
      [
        asunto.trim(),
        descripcion.trim(),
        categoria,
        subcategoria,
        urgenciaFinal,
        user.id_usuario,
        hResp,
        hRes,
        hResp,
        hRes,
        datos_especificos ? JSON.stringify(datos_especificos) : null,
        triaje.prioridadAuto,
        triaje.palabras.join(', ').slice(0, 255) || null,
      ],
    );

    const id_ticket = filasCreadas[0].id_ticket;
    const codigo = `NEXO-${String(id_ticket).padStart(4, '0')}`;
    await this.db.query('UPDATE tickets SET codigo = ? WHERE id_ticket = ?', [codigo, id_ticket]);

    await this.historial(
      id_ticket,
      user.id_usuario,
      'creado',
      'Ticket registrado por el solicitante',
      null,
      'Abierto',
    );

    await this.notificaciones.notificarUsuario(user.id_usuario, {
      id_ticket,
      tipo: 'ticket',
      titulo: `Ticket ${codigo} creado`,
      mensaje: `Registramos tu solicitud "${asunto.trim()}". Urgencia asignada: ${urgenciaFinal}.`,
    });

    await this.notificaciones.notificarStaff({
      id_ticket,
      tipo: 'ticket',
      titulo: `Nuevo ticket ${codigo}`,
      mensaje: `${user.nombre} ${user.apellido} reportó "${asunto.trim()}" · ${categoria} · Urgencia ${urgenciaFinal}.`,
      excluir: user.id_usuario,
    });

    return {
      id_ticket,
      codigo,
      mensaje: 'Ticket creado',
      urgencia: urgenciaFinal,
      prioridad_auto: Boolean(triaje.prioridadAuto),
      triaje: { palabras_clave: triaje.palabras },
    };
  }

  async resumen(user: UsuarioSesion) {
    const staff = esStaff(user);
    const filtro = staff ? '' : 'WHERE id_solicitante = ?';
    const params = staff ? [] : [user.id_usuario];

    const [[conteo]] = await this.db.query<any[]>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE estado = 'Abierto')::int AS abiertos,
         COUNT(*) FILTER (WHERE estado = 'En Progreso')::int AS en_progreso,
         COUNT(*) FILTER (WHERE estado = 'En Espera')::int AS en_espera,
         COUNT(*) FILTER (WHERE estado = 'Escalado')::int AS escalados,
         COUNT(*) FILTER (WHERE estado = 'Resuelto')::int AS resueltos,
         COUNT(*) FILTER (WHERE estado = 'Cerrado')::int AS cerrados,
         COUNT(*) FILTER (WHERE estado NOT IN ('Resuelto','Cerrado') AND NOT sla_pausado AND NOW() > sla_vencimiento_resolucion)::int AS sla_vencidos,
         COUNT(*) FILTER (WHERE categoria = 'Ciberseguridad' AND estado NOT IN ('Resuelto','Cerrado'))::int AS ciberseguridad_activos,
         COUNT(*) FILTER (WHERE nivel_escalamiento = 'L2/SOC' AND estado NOT IN ('Resuelto','Cerrado'))::int AS en_l2
       FROM tickets ${filtro}`,
      params,
    );

    const [porUrgencia] = await this.db.query<any[]>(
      `SELECT urgencia, COUNT(*)::int AS total FROM tickets
        WHERE ${staff ? '' : 'id_solicitante = ? AND '}estado NOT IN ('Resuelto','Cerrado')
        GROUP BY urgencia`,
      params,
    );

    const [porCategoria] = await this.db.query<any[]>(
      `SELECT categoria, COUNT(*)::int AS total FROM tickets
        WHERE ${staff ? '' : 'id_solicitante = ? AND '}estado NOT IN ('Resuelto','Cerrado')
        GROUP BY categoria`,
      params,
    );

    const [porDia] = await this.db.query<any[]>(
      `SELECT fecha_creacion::date AS dia, COUNT(*)::int AS total
         FROM tickets
        ${staff ? 'WHERE' : 'WHERE id_solicitante = ? AND'} fecha_creacion >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY fecha_creacion::date
        ORDER BY dia`,
      params,
    );

    const [ultimos] = await this.db.query<any[]>(
      `SELECT t.id_ticket, t.codigo, t.asunto, t.categoria, t.urgencia, t.estado,
              t.nivel_escalamiento, t.sla_vencimiento_resolucion, t.sla_pausado,
              t.fecha_creacion,
              CONCAT(u.nombre, ' ', u.apellido) AS solicitante
         FROM tickets t
         JOIN usuarios u ON u.id_usuario = t.id_solicitante
        ${filtro}
        ORDER BY t.fecha_creacion DESC
        LIMIT 6`,
      params,
    );

    return {
      alcance: staff ? 'global' : 'personal',
      conteo,
      por_urgencia: porUrgencia,
      por_categoria: porCategoria,
      por_dia: porDia,
      ultimos,
    };
  }

  async misTickets(user: UsuarioSesion) {
    const [rows] = await this.db.query<any[]>(
      `SELECT t.id_ticket, t.codigo, t.asunto, t.categoria, t.subcategoria, t.urgencia, t.estado,
              t.nivel_escalamiento, t.fecha_creacion, t.sla_vencimiento_resolucion, t.sla_pausado,
              CONCAT(a.nombre, ' ', a.apellido) AS analista
         FROM tickets t
         LEFT JOIN usuarios a ON a.id_usuario = t.id_analista_asignado
        WHERE t.id_solicitante = ?
        ORDER BY t.fecha_creacion DESC`,
      [user.id_usuario],
    );
    return rows.map((r) => ({ ...r, sla_pausado: Boolean(r.sla_pausado) }));
  }

  async analistas() {
    const [rows] = await this.db.query<any[]>(
      `SELECT id_usuario, nombre, apellido, email, rol
         FROM usuarios
        WHERE activo = TRUE AND rol IN ('Analista L1','Administrador')
        ORDER BY rol, nombre`,
    );
    return rows;
  }

  async listar(user: UsuarioSesion, query: any) {
    const { estado, categoria, urgencia, nivel, sin_asignar, mios, q, incluir_cerrados, vencidos } =
      query || {};
    const where: string[] = [];
    const params: any[] = [];

    if (estado) {
      if (!ESTADOS.includes(String(estado))) throw new BadRequestException('Estado inválido');
      where.push('t.estado = ?');
      params.push(String(estado));
    } else if (String(incluir_cerrados) !== '1') {
      where.push("t.estado NOT IN ('Resuelto', 'Cerrado')");
    }
    if (categoria) {
      if (!CATEGORIAS.includes(String(categoria))) throw new BadRequestException('Categoría inválida');
      where.push('t.categoria = ?');
      params.push(String(categoria));
    }
    if (urgencia) {
      if (!URGENCIAS.includes(String(urgencia))) throw new BadRequestException('Urgencia inválida');
      where.push('t.urgencia = ?');
      params.push(String(urgencia));
    }
    if (nivel) {
      if (!NIVELES.includes(String(nivel))) throw new BadRequestException('Nivel inválido');
      where.push('t.nivel_escalamiento = ?');
      params.push(String(nivel));
    }
    if (String(sin_asignar) === '1') where.push('t.id_analista_asignado IS NULL');
    if (String(vencidos) === '1') {
      where.push(
        "(t.estado NOT IN ('Resuelto', 'Cerrado') AND NOT t.sla_pausado AND NOW() > t.sla_vencimiento_resolucion)",
      );
    }
    if (String(mios) === '1') {
      where.push('t.id_analista_asignado = ?');
      params.push(user.id_usuario);
    }
    if (q?.trim()) {
      where.push('(t.asunto ILIKE ? OR t.descripcion ILIKE ? OR t.codigo ILIKE ?)');
      const like = `%${String(q).trim()}%`;
      params.push(like, like, like);
    }

    const [rows] = await this.db.query<any[]>(
      `SELECT t.id_ticket, t.codigo, t.asunto, t.categoria, t.subcategoria, t.urgencia, t.estado,
              t.nivel_escalamiento, t.prioridad_auto, t.sla_pausado,
              CASE t.urgencia
                WHEN 'Crítica' THEN 'rojo'
                WHEN 'Alta' THEN 'rojo'
                WHEN 'Media' THEN 'amarillo'
                ELSE 'verde' END AS semaforo,
              CONCAT(u.nombre, ' ', u.apellido) AS solicitante,
              CONCAT(a.nombre, ' ', a.apellido) AS analista,
              t.id_analista_asignado,
              t.sla_vencimiento_respuesta, t.sla_vencimiento_resolucion,
              (t.estado NOT IN ('Resuelto', 'Cerrado') AND NOT t.sla_pausado
                AND NOW() > t.sla_vencimiento_resolucion) AS sla_vencido,
              CASE
                WHEN t.estado IN ('Resuelto', 'Cerrado') THEN NULL
                WHEN t.sla_pausado AND t.fecha_pausa IS NOT NULL
                  THEN TRUNC(EXTRACT(EPOCH FROM (t.sla_vencimiento_resolucion - t.fecha_pausa)) / 60)::int
                ELSE TRUNC(EXTRACT(EPOCH FROM (t.sla_vencimiento_resolucion - NOW())) / 60)::int
              END AS minutos_restantes_sla,
              t.fecha_creacion
         FROM tickets t
         JOIN usuarios u ON u.id_usuario = t.id_solicitante
         LEFT JOIN usuarios a ON a.id_usuario = t.id_analista_asignado
        WHERE ${where.length ? where.join(' AND ') : '1=1'}
        ORDER BY CASE t.urgencia
                   WHEN 'Crítica' THEN 1
                   WHEN 'Alta' THEN 2
                   WHEN 'Media' THEN 3
                   ELSE 4 END,
                 t.sla_vencimiento_resolucion ASC`,
      params,
    );

    return rows.map((r) => ({
      ...r,
      sla_vencido: Boolean(r.sla_vencido),
      sla_pausado: Boolean(r.sla_pausado),
      prioridad_auto: Boolean(r.prioridad_auto),
    }));
  }

  async detalle(user: UsuarioSesion, idRaw: any) {
    const t = await this.autorizado(user, idRaw);
    const staff = esStaff(user);

    const [evidencias] = await this.db.query<any[]>(
      `SELECT e.id_evidencia, e.nombre_archivo, e.tipo_mime, e.tamano_bytes, e.hash_sha256,
              e.en_cuarentena, e.fecha_carga,
              CONCAT(u.nombre, ' ', u.apellido) AS cargado_por
         FROM evidencias e
         JOIN usuarios u ON u.id_usuario = e.id_usuario_carga
        WHERE e.id_ticket = ? ORDER BY e.fecha_carga DESC`,
      [t.id_ticket],
    );

    const [historial] = await this.db.query<any[]>(
      `SELECT h.id_historial, h.accion, h.detalle, h.estado_anterior, h.estado_nuevo, h.fecha,
              CONCAT(u.nombre, ' ', u.apellido) AS usuario
         FROM ticket_historial h
         LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
        WHERE h.id_ticket = ? ORDER BY h.fecha ASC, h.id_historial ASC`,
      [t.id_ticket],
    );

    const [comentarios] = await this.db.query<any[]>(
      `SELECT c.id_comentario, c.contenido, c.interno, c.fecha, c.id_usuario,
              CONCAT(u.nombre, ' ', u.apellido) AS usuario, u.rol
         FROM comentarios c
         JOIN usuarios u ON u.id_usuario = c.id_usuario
        WHERE c.id_ticket = ? ${staff ? '' : 'AND c.interno = FALSE'}
        ORDER BY c.fecha ASC, c.id_comentario ASC`,
      [t.id_ticket],
    );

    const [solicitante] = await this.db.query<any[]>(
      'SELECT id_usuario, nombre, apellido, email, telefono FROM usuarios WHERE id_usuario = ?',
      [t.id_solicitante],
    );

    let analista: any[] = [];
    let analistaRows: any[] = [];
    if (t.id_analista_asignado) {
      [analistaRows] = await this.db.query<any[]>(
        'SELECT id_usuario, nombre, apellido, email FROM usuarios WHERE id_usuario = ?',
        [t.id_analista_asignado],
      );
      analista = analistaRows;
    }

    return {
      ...t,
      sla_pausado: Boolean(t.sla_pausado),
      prioridad_auto: Boolean(t.prioridad_auto),
      sla_respuesta_incumplido: Boolean(t.sla_respuesta_incumplido),
      sla_resolucion_incumplido: Boolean(t.sla_resolucion_incumplido),
      solicitante: solicitante[0] || null,
      analista: analista[0] || null,
      evidencias: evidencias.map((e) => ({ ...e, en_cuarentena: Boolean(e.en_cuarentena) })),
      historial,
      comentarios: comentarios.map((c) => ({ ...c, interno: Boolean(c.interno) })),
      puede_gestionar: staff,
    };
  }

  async asignar(user: UsuarioSesion, idRaw: any, body: any) {
    const t = await this.autorizado(user, idRaw);
    if (['Resuelto', 'Cerrado'].includes(t.estado)) {
      throw new ConflictException('No se puede asignar un ticket resuelto o cerrado');
    }

    let idAnalista = user.id_usuario;
    if (user.rol === 'Administrador' && body?.id_analista) {
      const [a] = await this.db.query<any[]>(
        "SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND rol IN ('Analista L1','Administrador') AND activo = TRUE",
        [Number(body.id_analista)],
      );
      if (!a.length) throw new BadRequestException('Analista inválido');
      idAnalista = a[0].id_usuario;
    }

    await this.db.query('UPDATE tickets SET id_analista_asignado = ? WHERE id_ticket = ?', [
      idAnalista,
      t.id_ticket,
    ]);

    const [nuevoAnalista] = await this.db.query<any[]>(
      "SELECT CONCAT(nombre, ' ', apellido) AS nombre FROM usuarios WHERE id_usuario = ?",
      [idAnalista],
    );
    await this.historial(
      t.id_ticket,
      user.id_usuario,
      'asignado',
      `Asignado a ${nuevoAnalista[0]?.nombre || 'analista #' + idAnalista}`,
    );

    if (t.id_analista_asignado && Number(t.id_analista_asignado) !== Number(idAnalista)) {
      await this.notificaciones.notificarUsuario(t.id_analista_asignado, {
        id_ticket: t.id_ticket,
        tipo: 'asignacion',
        titulo: `Ticket ${t.codigo} reasignado`,
        mensaje: `El ticket "${t.asunto}" fue reasignado a otro analista.`,
      });
    }
    if (Number(idAnalista) !== Number(user.id_usuario)) {
      await this.notificaciones.notificarUsuario(idAnalista, {
        id_ticket: t.id_ticket,
        tipo: 'asignacion',
        titulo: `Ticket ${t.codigo} asignado`,
        mensaje: `Se te asignó el ticket "${t.asunto}".`,
      });
    }
    await this.notificaciones.notificarUsuario(t.id_solicitante, {
      id_ticket: t.id_ticket,
      tipo: 'asignacion',
      titulo: `Ticket ${t.codigo} en atención`,
      mensaje: `Tu solicitud "${t.asunto}" fue asignada a un analista.`,
    });

    return { mensaje: 'Ticket asignado', id_analista_asignado: idAnalista };
  }

  async cambiarEstado(user: UsuarioSesion, idRaw: any, body: any) {
    const t = await this.autorizado(user, idRaw);
    const nuevo = body?.estado;
    const resumen = body?.resumen ?? body?.solucion ?? null;

    if (!ESTADOS.includes(nuevo)) throw new BadRequestException('Estado inválido');
    if (nuevo === 'Escalado') {
      throw new BadRequestException('Para escalar usa POST /api/tickets/:id/escalar');
    }
    if (!(TRANSICIONES[t.estado] || []).includes(nuevo)) {
      throw new ConflictException(`Transición no permitida: ${t.estado} → ${nuevo}`);
    }

    const ahora = new Date();
    const resumenFinal =
      resumen && String(resumen).trim()
        ? String(resumen).trim().slice(0, 4000)
        : t.resumen_resolucion || null;

    const sets = ['estado = ?'];
    const params: any[] = [nuevo];

    if (nuevo === 'En Espera') {
      sets.push('sla_pausado = TRUE', 'fecha_pausa = ?');
      params.push(ahora);
    } else if (t.estado === 'En Espera') {
      const pausaSeg = t.fecha_pausa
        ? Math.max(0, Math.round((Date.now() - new Date(t.fecha_pausa).getTime()) / 1000))
        : 0;
      sets.push(
        'sla_pausado = FALSE',
        'fecha_pausa = NULL',
        "sla_vencimiento_respuesta = sla_vencimiento_respuesta + (? * INTERVAL '1 second')",
        "sla_vencimiento_resolucion = sla_vencimiento_resolucion + (? * INTERVAL '1 second')",
      );
      params.push(pausaSeg, pausaSeg);
    }

    if (!t.fecha_primera_respuesta && t.estado === 'Abierto') {
      sets.push('fecha_primera_respuesta = ?', 'sla_respuesta_incumplido = ?');
      params.push(ahora, ahora > new Date(t.sla_vencimiento_respuesta));
    }

    if (nuevo === 'Resuelto' || nuevo === 'Cerrado') {
      sets.push('fecha_resolucion = COALESCE(fecha_resolucion, ?)');
      params.push(ahora);
      if (nuevo === 'Resuelto') {
        sets.push('sla_resolucion_incumplido = ?');
        params.push(ahora > new Date(t.sla_vencimiento_resolucion));
        if (resumenFinal) {
          sets.push('resumen_resolucion = ?');
          params.push(resumenFinal);
        }
      }
    }

    if (t.estado === 'Resuelto' && nuevo === 'En Progreso') {
      sets.push('fecha_resolucion = NULL', 'sla_resolucion_incumplido = FALSE');
    }

    let autoAsignado = false;
    if (!t.id_analista_asignado && esStaff(user)) {
      sets.push('id_analista_asignado = ?');
      params.push(user.id_usuario);
      autoAsignado = true;
    }

    params.push(t.id_ticket);
    await this.db.query(`UPDATE tickets SET ${sets.join(', ')} WHERE id_ticket = ?`, params);

    if (autoAsignado) {
      const [responsable] = await this.db.query<any[]>(
        "SELECT CONCAT(nombre, ' ', apellido) AS nombre FROM usuarios WHERE id_usuario = ?",
        [user.id_usuario],
      );
      await this.historial(
        t.id_ticket,
        user.id_usuario,
        'asignado',
        `Asignado a ${responsable[0]?.nombre || `usuario #${user.id_usuario}`}`,
      );
    }

    await this.historial(
      t.id_ticket,
      user.id_usuario,
      'estado',
      `Estado actualizado a ${nuevo}`,
      t.estado,
      nuevo,
    );

    const mensajeEstado =
      nuevo === 'Resuelto' && resumenFinal
        ? `El estado de tu solicitud "${t.asunto}" cambió de ${t.estado} a ${nuevo}. Resolución: ${resumenFinal}`
        : `El estado de tu solicitud "${t.asunto}" cambió de ${t.estado} a ${nuevo}.`;

    await this.notificaciones.notificarUsuario(t.id_solicitante, {
      id_ticket: t.id_ticket,
      tipo: 'estado',
      titulo: `Ticket ${t.codigo}: ${nuevo}`,
      mensaje: mensajeEstado,
    });

    if (t.id_analista_asignado && Number(t.id_analista_asignado) !== Number(user.id_usuario)) {
      await this.notificaciones.notificarUsuario(t.id_analista_asignado, {
        id_ticket: t.id_ticket,
        tipo: 'estado',
        titulo: `Ticket ${t.codigo}: ${nuevo}`,
        mensaje: `El ticket "${t.asunto}" cambió de ${t.estado} a ${nuevo}.`,
      });
    }

    return { mensaje: 'Estado actualizado', estado: nuevo };
  }

  async escalar(user: UsuarioSesion, idRaw: any, body: any) {
    const t = await this.autorizado(user, idRaw);
    const motivo = body?.motivo?.trim();
    if (!motivo) throw new BadRequestException('El motivo del escalamiento es obligatorio');
    if (t.nivel_escalamiento === 'L2/SOC') {
      throw new ConflictException('El ticket ya fue escalado a L2/SOC');
    }
    if (['Resuelto', 'Cerrado'].includes(t.estado)) {
      throw new ConflictException('No se puede escalar un ticket resuelto o cerrado');
    }

    const ahora = new Date();
    const sets = [
      "estado = 'Escalado'",
      "nivel_escalamiento = 'L2/SOC'",
      'motivo_escalamiento = ?',
      'fecha_escalamiento = ?',
      'id_escalado_por = ?',
      'sla_pausado = FALSE',
      'fecha_pausa = NULL',
    ];
    const params: any[] = [motivo, ahora, user.id_usuario];

    if (!t.fecha_primera_respuesta) {
      sets.push('fecha_primera_respuesta = ?', 'sla_respuesta_incumplido = ?');
      params.push(ahora, ahora > new Date(t.sla_vencimiento_respuesta));
    }
    params.push(t.id_ticket);

    await this.db.query(`UPDATE tickets SET ${sets.join(', ')} WHERE id_ticket = ?`, params);

    await this.historial(
      t.id_ticket,
      user.id_usuario,
      'escalado',
      `Escalado a L2/SOC. Motivo: ${motivo}`,
      t.estado,
      'Escalado',
    );

    await this.notificaciones.notificarUsuario(t.id_solicitante, {
      id_ticket: t.id_ticket,
      tipo: 'escalado',
      titulo: `Ticket ${t.codigo} escalado a L2/SOC`,
      mensaje: `Tu caso "${t.asunto}" fue derivado al equipo especializado de ciberseguridad.`,
    });
    await this.notificaciones.notificarStaff({
      id_ticket: t.id_ticket,
      tipo: 'escalado',
      titulo: `Escalado L2/SOC: ${t.codigo}`,
      mensaje: `El ticket "${t.asunto}" fue escalado. Motivo: ${motivo}`,
      excluir: user.id_usuario,
    });

    return { mensaje: 'Ticket escalado a L2/SOC', estado: 'Escalado', nivel_escalamiento: 'L2/SOC' };
  }

  async confirmar(user: UsuarioSesion, idRaw: any) {
    const t = await this.autorizado(user, idRaw);
    if (Number(t.id_solicitante) !== Number(user.id_usuario)) {
      throw new ForbiddenException('Solo el solicitante puede confirmar el cierre');
    }
    if (t.estado !== 'Resuelto') {
      throw new ConflictException('Solo puedes confirmar tickets en estado Resuelto');
    }

    await this.db.query(
      "UPDATE tickets SET estado = 'Cerrado', fecha_resolucion = COALESCE(fecha_resolucion, NOW()) WHERE id_ticket = ?",
      [t.id_ticket],
    );
    await this.historial(
      t.id_ticket,
      user.id_usuario,
      'cerrado',
      'El solicitante confirmó el cierre',
      'Resuelto',
      'Cerrado',
    );

    await this.notificaciones.notificarStaff({
      id_ticket: t.id_ticket,
      tipo: 'cerrado',
      titulo: `Ticket ${t.codigo} cerrado por el usuario`,
      mensaje: `El solicitante confirmó la resolución de "${t.asunto}".`,
      excluir: user.id_usuario,
    });

    return { mensaje: 'Ticket cerrado', estado: 'Cerrado' };
  }

  private async hashArchivo(ruta: string): Promise<string> {
    return new Promise((resolveHash, reject) => {
      const hash = createHash('sha256');
      createReadStream(ruta)
        .on('data', (chunk) => hash.update(chunk))
        .on('end', () => resolveHash(hash.digest('hex')))
        .on('error', reject);
    });
  }

  async subirEvidencias(user: UsuarioSesion, idRaw: any, files: Express.Multer.File[]) {
    const archivos = files || [];
    const limpiar = () => archivos.forEach((f) => unlink(f.path, () => undefined));

    let t: any;
    try {
      t = await this.autorizado(user, idRaw);
    } catch (error) {
      limpiar();
      throw error;
    }

    if (!archivos.length) throw new BadRequestException('No se recibió ningún archivo');

    const guardadas: any[] = [];
    try {
      for (const f of archivos) {
        const hash = await this.hashArchivo(f.path);
        const nombre = String(f.originalname || 'archivo').split(/[\\/]/).pop()!.slice(0, 255);
        const [r] = await this.db.query<any>(
          `INSERT INTO evidencias
             (id_ticket, id_usuario_carga, nombre_archivo, ruta_almacenamiento,
              tipo_mime, tamano_bytes, hash_sha256, en_cuarentena)
           VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
           RETURNING id_evidencia`,
          [t.id_ticket, user.id_usuario, nombre, f.path, f.mimetype, f.size, hash],
        );
        guardadas.push({
          id_evidencia: r[0].id_evidencia,
          nombre_archivo: nombre,
          hash_sha256: hash,
          en_cuarentena: true,
        });
      }
    } catch (error) {
      limpiar();
      throw error;
    }

    await this.historial(
      t.id_ticket,
      user.id_usuario,
      'evidencia',
      `Se cargaron ${guardadas.length} archivo(s) en cuarentena`,
    );

    await this.notificaciones.notificarStaff({
      id_ticket: t.id_ticket,
      tipo: 'evidencia',
      titulo: `Nuevas evidencias en ${t.codigo}`,
      mensaje: `${user.nombre} adjuntó ${guardadas.length} archivo(s) al ticket "${t.asunto}".`,
      excluir: user.id_usuario,
    });

    return { mensaje: 'Evidencias cargadas en cuarentena', evidencias: guardadas };
  }

  async rutaDescarga(user: UsuarioSesion, idRaw: any, idEvidenciaRaw: any) {
    const t = await this.autorizado(user, idRaw);
    const [rows] = await this.db.query<any[]>(
      'SELECT * FROM evidencias WHERE id_evidencia = ? AND id_ticket = ?',
      [Number(idEvidenciaRaw), t.id_ticket],
    );
    if (!rows.length) throw new NotFoundException('Evidencia no encontrada');

    const ev = rows[0];
    if (ev.en_cuarentena && user.rol !== 'Administrador') {
      throw new ForbiddenException(
        'La evidencia está en cuarentena. Un administrador debe liberarla antes de descargarla.',
      );
    }

    const absoluta = resolve(ev.ruta_almacenamiento);
    const permitidas = [UPLOADS_DIR, LEGACY_UPLOADS_DIR].filter(Boolean) as string[];
    const dentro = permitidas.some((base) => absoluta.startsWith(resolve(base)));

    if (!dentro || !existsSync(absoluta)) {
      throw new NotFoundException('El archivo ya no está disponible');
    }

    return { absoluta, nombre: ev.nombre_archivo };
  }

  async cuarentena(user: UsuarioSesion, idEvidenciaRaw: any, body: any) {
    if (typeof body?.en_cuarentena !== 'boolean') {
      throw new BadRequestException('"en_cuarentena" debe ser true o false');
    }

    const [rows] = await this.db.query<any[]>(
      'SELECT id_ticket, nombre_archivo FROM evidencias WHERE id_evidencia = ?',
      [Number(idEvidenciaRaw)],
    );
    if (!rows.length) throw new NotFoundException('Evidencia no encontrada');

    await this.db.query('UPDATE evidencias SET en_cuarentena = ? WHERE id_evidencia = ?', [
      body.en_cuarentena,
      Number(idEvidenciaRaw),
    ]);

    await this.historial(
      rows[0].id_ticket,
      user.id_usuario,
      'cuarentena',
      `${body.en_cuarentena ? 'Re-puesta en' : 'Liberada de'} cuarentena: ${rows[0].nombre_archivo}`,
    );

    return { mensaje: 'Evidencia actualizada', en_cuarentena: body.en_cuarentena };
  }

  async comentar(user: UsuarioSesion, idRaw: any, body: any) {
    const t = await this.autorizado(user, idRaw);
    const contenido = String(body?.contenido || '').trim();
    if (!contenido) throw new BadRequestException('El comentario no puede estar vacío');
    if (contenido.length > 4000) {
      throw new BadRequestException('El comentario es demasiado largo (máx. 4000)');
    }

    const interno = esStaff(user) && body?.interno === true;

    const [r] = await this.db.query<any>(
      'INSERT INTO comentarios (id_ticket, id_usuario, contenido, interno) VALUES (?, ?, ?, ?) RETURNING id_comentario',
      [t.id_ticket, user.id_usuario, contenido, interno],
    );

    await this.historial(
      t.id_ticket,
      user.id_usuario,
      'comentario',
      interno ? 'Nota interna agregada' : 'Comentario agregado',
    );

    if (!interno) {
      if (esStaff(user)) {
        await this.notificaciones.notificarUsuario(t.id_solicitante, {
          id_ticket: t.id_ticket,
          tipo: 'comentario',
          titulo: `Nueva respuesta en ${t.codigo}`,
          mensaje: `${user.nombre} respondió en tu ticket "${t.asunto}".`,
        });
      } else if (t.id_analista_asignado) {
        await this.notificaciones.notificarUsuario(t.id_analista_asignado, {
          id_ticket: t.id_ticket,
          tipo: 'comentario',
          titulo: `Nuevo comentario en ${t.codigo}`,
          mensaje: `${user.nombre} comentó en "${t.asunto}".`,
        });
      } else {
        await this.notificaciones.notificarStaff({
          id_ticket: t.id_ticket,
          tipo: 'comentario',
          titulo: `Nuevo comentario en ${t.codigo}`,
          mensaje: `${user.nombre} comentó en "${t.asunto}".`,
          excluir: user.id_usuario,
        });
      }
    }

    return {
      mensaje: 'Comentario agregado',
      comentario: {
        id_comentario: r[0].id_comentario,
        contenido,
        interno,
        fecha: new Date(),
        usuario: `${user.nombre} ${user.apellido}`.trim(),
        rol: user.rol,
      },
    };
  }
}
