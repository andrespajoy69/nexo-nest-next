import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { UsuarioSesion } from '../common/current-user.decorator';
import { ROLES, SEGURO, SLA_DEFAULT, URGENCIAS } from '../common/constants';

const csvCampo = (valor: any) => {
  let texto = valor === null || valor === undefined ? '' : String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
};

const csvFecha = (valor: any) => {
  if (!valor) return '';
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const enviarCsv = (encabezados: string[], filas: any[][]) => {
  const lineas = [encabezados.map(csvCampo).join(';'), ...filas.map((fila) => fila.map(csvCampo).join(';'))];
  return `\uFEFF${lineas.join('\r\n')}`;
};

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async usuarios() {
    const [rows] = await this.db.query<any[]>(
      `SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.rol, u.activo, u.telefono, u.fecha_nacimiento,
              u.fecha_creacion, u.ultimo_acceso,
              (SELECT COUNT(*) FROM tickets t WHERE t.id_solicitante = u.id_usuario) AS tickets_creados,
              (SELECT COUNT(*) FROM tickets t WHERE t.id_analista_asignado = u.id_usuario) AS tickets_atendidos
         FROM usuarios u
        ORDER BY CASE u.rol WHEN 'Administrador' THEN 1 WHEN 'Analista L1' THEN 2 ELSE 3 END, u.nombre`,
    );
    return rows.map((u) => ({ ...u, activo: Boolean(u.activo) }));
  }

  async crearUsuario(body: any) {
    const {
      nombre,
      apellido = '',
      email,
      password,
      rol = 'Usuario',
      telefono = null,
      fecha_nacimiento = null,
    } = body || {};

    if (!nombre?.trim()) throw new BadRequestException('El nombre es obligatorio');
    if (!SEGURO.email.test(String(email || ''))) {
      throw new BadRequestException('Correo electrónico inválido');
    }
    if (String(password || '').length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }
    if (!ROLES.includes(rol)) throw new BadRequestException('Rol inválido');
    if (fecha_nacimiento && !SEGURO.fecha.test(String(fecha_nacimiento))) {
      throw new BadRequestException('Fecha de nacimiento inválida');
    }

    const hash = await bcrypt.hash(String(password), 10);
    try {
      const [r] = await this.db.query<any>(
        'INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, telefono, fecha_nacimiento) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id_usuario',
        [
          nombre.trim(),
          String(apellido).trim(),
          String(email).toLowerCase().trim(),
          hash,
          rol,
          telefono,
          fecha_nacimiento || null,
        ],
      );
      return { id_usuario: r[0].id_usuario, mensaje: 'Usuario creado' };
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('Ese correo ya está registrado');
      }
      throw error;
    }
  }

  async editarUsuario(user: UsuarioSesion, idRaw: any, body: any) {
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('ID inválido');

    const { nombre, apellido, email, rol, activo, telefono, fecha_nacimiento } = body || {};
    const sets: string[] = [];
    const params: any[] = [];

    if (nombre !== undefined) {
      if (!String(nombre).trim()) throw new BadRequestException('El nombre no puede estar vacío');
      sets.push('nombre = ?');
      params.push(String(nombre).trim());
    }
    if (apellido !== undefined) {
      sets.push('apellido = ?');
      params.push(String(apellido).trim());
    }
    if (email !== undefined) {
      if (!SEGURO.email.test(String(email))) throw new BadRequestException('Correo inválido');
      sets.push('email = ?');
      params.push(String(email).toLowerCase().trim());
    }
    if (rol !== undefined) {
      if (!ROLES.includes(rol)) throw new BadRequestException('Rol inválido');
      if (id === Number(user.id_usuario) && rol !== 'Administrador') {
        throw new BadRequestException('No puedes quitarte tu propio rol de administrador');
      }
      sets.push('rol = ?');
      params.push(rol);
    }
    if (activo !== undefined) {
      if (id === Number(user.id_usuario) && !activo) {
        throw new BadRequestException('No puedes desactivar tu propia cuenta');
      }
      sets.push('activo = ?');
      params.push(Boolean(activo));
    }
    if (telefono !== undefined) {
      sets.push('telefono = ?');
      params.push(telefono || null);
    }
    if (fecha_nacimiento !== undefined) {
      if (fecha_nacimiento && !SEGURO.fecha.test(String(fecha_nacimiento))) {
        throw new BadRequestException('Fecha de nacimiento inválida');
      }
      sets.push('fecha_nacimiento = ?');
      params.push(fecha_nacimiento || null);
    }

    if (!sets.length) throw new BadRequestException('No hay campos para actualizar');

    params.push(id);
    try {
      const [, r] = await this.db.query<any>(
        `UPDATE usuarios SET ${sets.join(', ')} WHERE id_usuario = ?`,
        params,
      );
      if (!r.affectedRows) throw new NotFoundException('Usuario no encontrado');
      return { mensaje: 'Usuario actualizado' };
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('Ese correo ya está registrado');
      }
      throw error;
    }
  }

  async resetPassword(idRaw: any, body: any) {
    const { password } = body || {};
    if (String(password || '').length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }
    const hash = await bcrypt.hash(String(password), 10);
    const [, r] = await this.db.query<any>('UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?', [
      hash,
      Number(idRaw),
    ]);
    if (!r.affectedRows) throw new NotFoundException('Usuario no encontrado');
    return { mensaje: 'Contraseña restablecida' };
  }

  async metricas() {
    const [[global]] = await this.db.query<any[]>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE estado NOT IN ('Resuelto','Cerrado'))::int AS activos,
         COUNT(*) FILTER (WHERE estado = 'Resuelto')::int AS resueltos,
         COUNT(*) FILTER (WHERE estado = 'Cerrado')::int AS cerrados,
         COUNT(*) FILTER (WHERE categoria = 'Ciberseguridad')::int AS ciberseguridad,
         COUNT(*) FILTER (WHERE sla_resolucion_incumplido = TRUE)::int AS sla_resolucion_incumplidos_cerrados,
         COUNT(*) FILTER (WHERE estado NOT IN ('Resuelto','Cerrado') AND NOT sla_pausado AND NOW() > sla_vencimiento_resolucion)::int AS sla_resolucion_vencidos_activos,
         COUNT(*) FILTER (WHERE sla_respuesta_incumplido = TRUE)::int AS sla_respuesta_incumplidos_cerrados,
         COUNT(*) FILTER (WHERE fecha_primera_respuesta IS NULL
                      AND estado NOT IN ('Resuelto','Cerrado')
                      AND NOT sla_pausado
                      AND NOW() > sla_vencimiento_respuesta)::int AS sla_respuesta_vencidos_activos,
         ROUND(AVG(CASE WHEN fecha_resolucion IS NOT NULL
                   THEN EXTRACT(EPOCH FROM (fecha_resolucion - fecha_creacion)) / 3600 END)::numeric, 1)::float AS promedio_resolucion_horas
       FROM tickets`,
    );

    const [porUrgencia] = await this.db.query<any[]>(
      `SELECT urgencia, COUNT(*)::int AS total FROM tickets
        WHERE estado NOT IN ('Resuelto','Cerrado') GROUP BY urgencia`,
    );
    const [porCategoria] = await this.db.query<any[]>(
      'SELECT categoria, COUNT(*)::int AS total FROM tickets GROUP BY categoria',
    );
    const [porEstado] = await this.db.query<any[]>(
      'SELECT estado, COUNT(*)::int AS total FROM tickets GROUP BY estado',
    );

    const [porDia] = await this.db.query<any[]>(
      `SELECT fecha_creacion::date AS dia, COUNT(*)::int AS total
         FROM tickets
        WHERE fecha_creacion >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY fecha_creacion::date
        ORDER BY dia`,
    );

    const [topAnalistas] = await this.db.query<any[]>(
      `SELECT u.id_usuario, CONCAT(u.nombre, ' ', u.apellido) AS analista,
              COUNT(*)::int AS asignados,
              COUNT(*) FILTER (WHERE t.estado IN ('Resuelto','Cerrado'))::int AS finalizados
         FROM tickets t
         JOIN usuarios u ON u.id_usuario = t.id_analista_asignado
        WHERE t.id_analista_asignado IS NOT NULL
        GROUP BY u.id_usuario
        ORDER BY finalizados DESC, asignados DESC
        LIMIT 5`,
    );

    const resueltos = Number(global.resueltos) + Number(global.cerrados);
    const incumplidosResolucion = Number(global.sla_resolucion_incumplidos_cerrados);
    const cumplimiento =
      resueltos > 0
        ? Number((((resueltos - incumplidosResolucion) / resueltos) * 100).toFixed(1))
        : 100;

    return {
      global: {
        ...global,
        sla_resolucion_incumplidos:
          incumplidosResolucion + Number(global.sla_resolucion_vencidos_activos),
        sla_respuesta_incumplidos:
          Number(global.sla_respuesta_incumplidos_cerrados) +
          Number(global.sla_respuesta_vencidos_activos),
        cumplimiento_sla: cumplimiento,
      },
      por_urgencia: porUrgencia,
      por_categoria: porCategoria,
      por_estado: porEstado,
      por_dia: porDia,
      top_analistas: topAnalistas,
    };
  }

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
      // valores por defecto
    }
    return SLA_DEFAULT;
  }

  async guardarSla(body: any) {
    const config: any = {};

    for (const u of URGENCIAS) {
      const respuesta = Number(body?.[u]?.respuesta);
      const resolucion = Number(body?.[u]?.resolucion);
      if (!Number.isFinite(respuesta) || respuesta <= 0 || !Number.isFinite(resolucion) || resolucion <= 0) {
        throw new BadRequestException(`Valores inválidos para la urgencia ${u}`);
      }
      if (respuesta > resolucion) {
        throw new BadRequestException(`En ${u}, la respuesta no puede superar la resolución`);
      }
      config[u] = { respuesta, resolucion };
    }

    await this.db.query(
      "INSERT INTO configuracion (clave, valor) VALUES ('sla_horas', ?) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor",
      [JSON.stringify(config)],
    );
    return { mensaje: 'Configuración de SLA actualizada', sla: config };
  }

  async csvTickets() {
    const [rows] = await this.db.query<any[]>(
      `SELECT t.codigo, t.asunto, t.descripcion, t.categoria, t.subcategoria, t.urgencia, t.estado,
              t.nivel_escalamiento, t.prioridad_auto, t.palabras_clave, t.motivo_escalamiento,
              t.fecha_creacion, t.fecha_primera_respuesta, t.fecha_resolucion,
              t.sla_vencimiento_respuesta, t.sla_vencimiento_resolucion,
              t.sla_respuesta_incumplido, t.sla_resolucion_incumplido,
              CONCAT(s.nombre, ' ', s.apellido) AS solicitante,
              s.email AS solicitante_email,
              CONCAT(a.nombre, ' ', a.apellido) AS analista
         FROM tickets t
         JOIN usuarios s ON s.id_usuario = t.id_solicitante
         LEFT JOIN usuarios a ON a.id_usuario = t.id_analista_asignado
        ORDER BY t.fecha_creacion DESC
        LIMIT 5000`,
    );

    return enviarCsv(
      [
        'Código',
        'Asunto',
        'Descripción',
        'Categoría',
        'Subcategoría',
        'Urgencia',
        'Estado',
        'Nivel',
        'Triaje automático',
        'Palabras clave',
        'Motivo de escalamiento',
        'Creado',
        'Primera respuesta',
        'Resolución',
        'Vence respuesta',
        'Vence resolución',
        'SLA respuesta incumplido',
        'SLA resolución incumplido',
        'Solicitante',
        'Correo solicitante',
        'Analista',
      ],
      rows.map((t) => [
        t.codigo,
        t.asunto,
        t.descripcion,
        t.categoria,
        t.subcategoria,
        t.urgencia,
        t.estado,
        t.nivel_escalamiento,
        t.prioridad_auto ? 'Sí' : 'No',
        t.palabras_clave,
        t.motivo_escalamiento,
        csvFecha(t.fecha_creacion),
        csvFecha(t.fecha_primera_respuesta),
        csvFecha(t.fecha_resolucion),
        csvFecha(t.sla_vencimiento_respuesta),
        csvFecha(t.sla_vencimiento_resolucion),
        t.sla_respuesta_incumplido ? 'Sí' : 'No',
        t.sla_resolucion_incumplido ? 'Sí' : 'No',
        t.solicitante,
        t.solicitante_email,
        t.analista || 'Sin asignar',
      ]),
    );
  }

  async csvUsuarios() {
    const [rows] = await this.db.query<any[]>(
      `SELECT u.nombre, u.apellido, u.email, u.rol, u.activo, u.telefono,
              u.fecha_creacion, u.ultimo_acceso,
              (SELECT COUNT(*) FROM tickets t WHERE t.id_solicitante = u.id_usuario) AS tickets_creados,
              (SELECT COUNT(*) FROM tickets t WHERE t.id_analista_asignado = u.id_usuario) AS tickets_atendidos
         FROM usuarios u
        ORDER BY CASE u.rol WHEN 'Administrador' THEN 1 WHEN 'Analista L1' THEN 2 ELSE 3 END, u.nombre`,
    );

    return enviarCsv(
      [
        'Nombre',
        'Apellido',
        'Correo',
        'Rol',
        'Activo',
        'Teléfono',
        'Tickets creados',
        'Tickets atendidos',
        'Fecha de alta',
        'Último acceso',
      ],
      rows.map((u) => [
        u.nombre,
        u.apellido,
        u.email,
        u.rol,
        u.activo ? 'Sí' : 'No',
        u.telefono,
        u.tickets_creados,
        u.tickets_atendidos,
        csvFecha(u.fecha_creacion),
        csvFecha(u.ultimo_acceso),
      ]),
    );
  }

  async auditoria() {
    const [rows] = await this.db.query<any[]>(
      `SELECT h.id_historial, h.id_ticket, t.codigo, h.accion, h.detalle,
              h.estado_anterior, h.estado_nuevo, h.fecha,
              CONCAT(u.nombre, ' ', u.apellido) AS usuario
         FROM ticket_historial h
         LEFT JOIN tickets t ON t.id_ticket = h.id_ticket
         LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
        ORDER BY h.fecha DESC, h.id_historial DESC
        LIMIT 100`,
    );
    return rows;
  }
}
