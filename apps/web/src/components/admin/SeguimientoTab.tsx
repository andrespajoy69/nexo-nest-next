'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useModal } from '@/components/ModalProvider';
import { useToast } from '@/components/ToastProvider';
import {
  Cargando,
  CategoriaBadge,
  Empty,
  ErrorPanel,
  EstadoBadge,
  Sla,
  UrgenciaBadge,
} from '@/components/ui';
import { API } from '@/lib/api';
import { PLANTILLAS_RESOLUCION } from '@/lib/constants';
import { fmtFechaCorta } from '@/lib/format';

type Filtros = {
  q: string;
  estado: string;
  categoria: string;
  urgencia: string;
  nivel: string;
  sin_asignar: boolean;
  mios: boolean;
  vencidos: boolean;
  incluir_cerrados: boolean;
};

const FILTROS_VACIOS: Filtros = {
  q: '',
  estado: '',
  categoria: '',
  urgencia: '',
  nivel: '',
  sin_asignar: false,
  mios: false,
  vencidos: false,
  incluir_cerrados: false,
};

const POR_PAGINA = 20;

function FormResolver({
  idTicket,
  codigo,
  onListo,
}: {
  idTicket: number;
  codigo: string;
  onListo: () => void;
}) {
  const { toast } = useToast();
  const { cerrarModal } = useModal();
  const [resumen, setResumen] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumen.trim()) {
      toast('Describe la resolución realizada', 'error');
      return;
    }
    setEnviando(true);
    try {
      await API.tickets.estado(idTicket, 'Resuelto', resumen.trim());
      cerrarModal();
      toast('Ticket resuelto. Se notificó al usuario con el resumen.');
      onListo();
    } catch (err: any) {
      toast(err?.message || 'No se pudo resolver', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar}>
      <p className="campo__ayuda" style={{ marginBottom: 14 }}>
        {codigo ? (
          <>
            Ticket <strong>{codigo}</strong> ·{' '}
          </>
        ) : null}
        Describe qué se realizó para resolver el caso. Este mensaje le llegará al solicitante.
      </p>
      <div className="campo">
        <label className="campo__label">Plantillas rápidas</label>
        <div className="plantillas__lista">
          {PLANTILLAS_RESOLUCION.map((p) => (
            <button
              type="button"
              className="plantilla-chip"
              key={p.id}
              onClick={() => setResumen((v) => (v.trim() ? `${v.trim()}\n\n${p.texto}` : p.texto))}
            >
              {p.titulo}
            </button>
          ))}
        </div>
        <span className="campo__ayuda">Haz clic para insertar una base y ajústala al caso.</span>
      </div>
      <div className="campo">
        <label className="campo__label">Resumen de la resolución</label>
        <textarea
          className="textarea"
          required
          maxLength={4000}
          style={{ minHeight: 130 }}
          value={resumen}
          onChange={(e) => setResumen(e.target.value)}
          placeholder="Ej.: se restablecieron las credenciales, se bloqueó el remitente y se capacitó al usuario."
        />
      </div>
      <div className="modal__foot" style={{ padding: '16px 0 0' }}>
        <button type="button" className="btn btn--fantasma" onClick={cerrarModal}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primario" disabled={enviando}>
          <Icon name="check" /> {enviando ? 'Resolviendo…' : 'Marcar como resuelto'}
        </button>
      </div>
    </form>
  );
}

export function SeguimientoTab() {
  const router = useRouter();
  const { toast } = useToast();
  const { abrirModal } = useModal();
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState<Filtros>(FILTROS_VACIOS);
  const [tickets, setTickets] = useState<any[] | null>(null);
  const [error, setError] = useState<any>(null);
  const [pagina, setPagina] = useState(1);
  // Fuerza una nueva consulta aunque los filtros no hayan cambiado.
  const [recarga, setRecarga] = useState(0);
  const [aplicando, setAplicando] = useState(false);

  const cargar = useCallback(
    async (f: Filtros) => {
      setAplicando(true);
      try {
        const r: any = await API.tickets.listar({
          q: f.q,
          estado: f.estado,
          categoria: f.categoria,
          urgencia: f.urgencia,
          nivel: f.nivel,
          sin_asignar: f.sin_asignar ? '1' : '',
          mios: f.mios ? '1' : '',
          vencidos: f.vencidos ? '1' : '',
          incluir_cerrados: f.incluir_cerrados ? '1' : '',
        });
        setTickets(r || []);
        setError(null);
      } catch (err: any) {
        setError(err);
        toast(err?.message || 'No se pudieron cargar los tickets', 'error');
      } finally {
        setAplicando(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    cargar(aplicados);
  }, [aplicados, recarga, cargar]);

  useEffect(() => {
    setPagina(1);
  }, [aplicados]);

  const actualizar = (parcial: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...parcial }));
  const aplicar = (e: React.FormEvent) => {
    e.preventDefault();
    // Copia nueva + recarga: el botón siempre responde, aun sin cambiar filtros.
    setAplicados({ ...filtros });
    setRecarga((n) => n + 1);
  };
  const limpiar = () => {
    setFiltros({ ...FILTROS_VACIOS });
    setAplicados({ ...FILTROS_VACIOS });
    setRecarga((n) => n + 1);
  };

  const atajo = (parcial: Partial<Filtros>) => {
    const siguiente = { ...FILTROS_VACIOS, ...parcial };
    setFiltros(siguiente);
    setAplicados({ ...siguiente });
    setRecarga((n) => n + 1);
  };

  const tomar = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await API.tickets.asignar(id);
      toast('Ticket tomado. Ya está asignado a ti.');
      await cargar(aplicados);
    } catch (err: any) {
      toast(err?.message || 'No se pudo tomar el ticket', 'error');
    }
  };

  const resolver = (e: React.MouseEvent, t: any) => {
    e.stopPropagation();
    abrirModal({
      titulo: 'Resolver ticket',
      cuerpo: (
        <FormResolver
          idTicket={t.id_ticket}
          codigo={t.codigo || ''}
          onListo={() => cargar(aplicados)}
        />
      ),
    });
  };

  if (error && !tickets) {
    return (
      <div className="panel">
        <ErrorPanel error={error} />
      </div>
    );
  }

  const lista = tickets || [];
  const total = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaActual = Math.min(Math.max(1, pagina), totalPaginas);
  const visibles = lista.slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA,
  );

  const activos = lista.filter((t) => !['Resuelto', 'Cerrado'].includes(t.estado)).length;
  const sinAsignar = lista.filter((t) => !t.id_analista_asignado).length;
  const vencidos = lista.filter((t) => t.sla_vencido).length;
  const escalados = lista.filter((t) => t.nivel_escalamiento === 'L2/SOC').length;

  const tarjetas = [
    {
      clase: '',
      icono: 'panel',
      label: 'Tickets en vista',
      valor: activos,
      pie: 'activos con los filtros actuales',
      onClick: () => atajo({}),
    },
    {
      clase: 'stat--ambar',
      icono: 'alerta',
      label: 'Sin asignar',
      valor: sinAsignar,
      pie: 'requieren un responsable',
      onClick: () => atajo({ sin_asignar: true }),
    },
    {
      clase: 'stat--rojo',
      icono: 'reloj',
      label: 'SLA vencidos',
      valor: vencidos,
      pie: 'fuera del tiempo comprometido',
      onClick: () => atajo({ vencidos: true }),
    },
    {
      clase: 'stat--azul',
      icono: 'flecha',
      label: 'Escalados L2/SOC',
      valor: escalados,
      pie: 'en manos del equipo especializado',
      onClick: () => atajo({ nivel: 'L2/SOC' }),
    },
  ];

  return (
    <>
      <div className="grid-cards">
        {tarjetas.map((t) => (
          <button
            type="button"
            className={`stat stat--link ${t.clase}`}
            key={t.label}
            onClick={t.onClick}
            aria-label={`${t.label}: ${t.valor}`}
          >
            <div className="stat__label">
              <span>{t.label}</span>
              <span className="stat__icono">
                <Icon name={t.icono} />
              </span>
            </div>
            <div className="stat__valor">{t.valor}</div>
            <div className="stat__pie">
              <span>{t.pie}</span>
              <span className="stat__ir">
                <Icon name="flecha" />
              </span>
            </div>
          </button>
        ))}
      </div>

      <form className="filtros" style={{ marginTop: 16 }} onSubmit={aplicar}>
        <input
          className="input filtros__busqueda"
          placeholder="Buscar por código, asunto o descripción…"
          value={filtros.q}
          onChange={(e) => actualizar({ q: e.target.value })}
        />
        <select
          className="select"
          value={filtros.estado}
          onChange={(e) => actualizar({ estado: e.target.value })}
        >
          <option value="">Activos (sin finalizados)</option>
          {['Abierto', 'En Progreso', 'En Espera', 'Escalado', 'Resuelto', 'Cerrado'].map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <select
          className="select"
          value={filtros.categoria}
          onChange={(e) => actualizar({ categoria: e.target.value })}
        >
          <option value="">Toda categoría</option>
          <option>TI General</option>
          <option>Ciberseguridad</option>
        </select>
        <select
          className="select"
          value={filtros.urgencia}
          onChange={(e) => actualizar({ urgencia: e.target.value })}
        >
          <option value="">Toda urgencia</option>
          {['Crítica', 'Alta', 'Media', 'Baja'].map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <select
          className="select"
          value={filtros.nivel}
          onChange={(e) => actualizar({ nivel: e.target.value })}
        >
          <option value="">Todo nivel</option>
          <option>L1</option>
          <option>L2/SOC</option>
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={filtros.sin_asignar}
            onChange={(e) => actualizar({ sin_asignar: e.target.checked })}
          />{' '}
          Sin asignar
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={filtros.mios}
            onChange={(e) => actualizar({ mios: e.target.checked })}
          />{' '}
          Asignados a mí
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={filtros.vencidos}
            onChange={(e) => actualizar({ vencidos: e.target.checked })}
          />{' '}
          SLA vencido
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={filtros.incluir_cerrados}
            onChange={(e) => actualizar({ incluir_cerrados: e.target.checked })}
          />{' '}
          Incluir finalizados
        </label>
        <div className="filtros__grupo">
          <button type="button" className="btn btn--pequeno btn--fantasma" onClick={limpiar}>
            Limpiar
          </button>
          <button
            type="submit"
            className="btn btn--pequeno btn--primario"
            disabled={aplicando}
            aria-busy={aplicando}
          >
            {aplicando ? 'Aplicando…' : 'Aplicar'}
          </button>
        </div>
      </form>

      <div className="panel">
        <div className="panel__head">
          <h2>Bandeja global de tickets</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>{total} ticket(s)</span>
            <button
              type="button"
              className="btn btn--pequeno btn--fantasma"
              onClick={() =>
                API.admin
                  .exportarTickets()
                  .then(() => toast('CSV de tickets descargado'))
                  .catch((err: any) =>
                    toast(err?.message || 'No se pudo exportar', 'error'),
                  )
              }
            >
              <Icon name="descargar" /> Exportar CSV
            </button>
          </div>
        </div>
        <div className="panel__body panel__body--flush">
          {!tickets ? (
            <Cargando />
          ) : visibles.length ? (
            <div className="tabla-wrap">
              <table className="tabla tabla--clic">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Asunto / solicitante</th>
                    <th>Categoría</th>
                    <th>Urgencia</th>
                    <th>Estado</th>
                    <th>SLA</th>
                    <th>Responsable</th>
                    <th>Creado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((t) => (
                    <tr key={t.id_ticket} onClick={() => router.push(`/ticket/${t.id_ticket}`)}>
                      <td className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                        {t.codigo || ''}
                      </td>
                      <td>
                        <div className="celda-titulo">{t.asunto}</div>
                        <div className="texto-dim" style={{ fontSize: 10 }}>
                          {t.solicitante || ''}
                        </div>
                      </td>
                      <td>
                        <CategoriaBadge categoria={t.categoria} />
                      </td>
                      <td>
                        <UrgenciaBadge urgencia={t.urgencia} />
                      </td>
                      <td>
                        <EstadoBadge estado={t.estado} />
                      </td>
                      <td>
                        <Sla
                          fin={t.sla_vencimiento_resolucion}
                          pausado={t.sla_pausado}
                          estado={t.estado}
                        />
                      </td>
                      <td>{t.analista || 'Sin asignar'}</td>
                      <td className="texto-dim" style={{ fontSize: 10 }}>
                        {fmtFechaCorta(t.fecha_creacion)}
                      </td>
                      <td className="acciones-fila">
                        {!['Resuelto', 'Cerrado'].includes(t.estado) ? (
                          <>
                            {!t.id_analista_asignado ? (
                              <button
                                type="button"
                                className="btn btn--pequeno btn--fantasma"
                                onClick={(e) => tomar(e, t.id_ticket)}
                              >
                                Tomar
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn--pequeno btn--primario"
                              onClick={(e) => resolver(e, t)}
                            >
                              Resolver
                            </button>
                          </>
                        ) : (
                          <span className="texto-dim">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              titulo="Sin tickets con esos filtros"
              texto="Ajusta los filtros o limpia la búsqueda para ver más resultados."
            />
          )}
        </div>
      </div>

      {totalPaginas > 1 && (
        <div className="paginador">
          <button
            type="button"
            className="btn btn--pequeno btn--fantasma"
            disabled={paginaActual <= 1}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
          >
            ← Anterior
          </button>
          <span>
            Página {paginaActual} de {totalPaginas} · {total} tickets
          </span>
          <button
            type="button"
            className="btn btn--pequeno btn--fantasma"
            disabled={paginaActual >= totalPaginas}
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          >
            Siguiente →
          </button>
        </div>
      )}
    </>
  );
}
