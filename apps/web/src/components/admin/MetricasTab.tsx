'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ToastProvider';
import { Cargando, ErrorPanel, EstadoBadge, UrgenciaBadge } from '@/components/ui';
import { API } from '@/lib/api';
import { claveLocal, serieDias } from '@/lib/format';

const URGENCIAS = ['Crítica', 'Alta', 'Media', 'Baja'];
const ESTADOS = ['Abierto', 'En Progreso', 'En Espera', 'Escalado', 'Resuelto', 'Cerrado'];

export function MetricasTab() {
  const { toast } = useToast();
  const [m, setM] = useState<any>(null);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    API.admin
      .metricas()
      .then(setM)
      .catch(setError);
  }, []);

  if (error) {
    return (
      <div className="panel">
        <ErrorPanel error={error} />
      </div>
    );
  }
  if (!m) return <Cargando />;

  const g = m.global || {};
  const serie = serieDias(m.por_dia, 14);
  const max = Math.max(1, ...serie.map((s: any) => s.total));
  const hoy = claveLocal(new Date());

  const urgencias = URGENCIAS.map((u) => {
    const fila = (m.por_urgencia || []).find((x: any) => x.urgencia === u);
    return { u, total: fila ? Number(fila.total) : 0 };
  });
  const totalUrg = Math.max(1, urgencias.reduce((a, b) => a + b.total, 0));

  const estados = ESTADOS.map((e) => {
    const fila = (m.por_estado || []).find((x: any) => x.estado === e);
    return { e, total: fila ? Number(fila.total) : 0 };
  });

  const tarjetas = [
    {
      clase: '',
      icono: 'panel',
      label: 'Tickets totales',
      valor: Number(g.total) || 0,
      pie: `${Number(g.activos) || 0} activos ahora`,
    },
    {
      clase: 'stat--rojo',
      icono: 'escudo',
      label: 'Incidentes ciber',
      valor: Number(g.ciberseguridad) || 0,
      pie: 'reportes de seguridad recibidos',
    },
    {
      clase: 'stat--ambar',
      icono: 'alerta',
      label: 'SLA resolución vencido',
      valor: Number(g.sla_resolucion_incumplidos) || 0,
      pie: 'tickets fuera de tiempo',
    },
    {
      clase: 'stat--azul',
      icono: 'grafico',
      label: 'Cumplimiento SLA',
      valor: `${Number(g.cumplimiento_sla) || 0}%`,
      pie: `${Number(g.promedio_resolucion_horas) || 0} h de resolución promedio`,
    },
  ];

  const exportar = async (tipo: 'tickets' | 'usuarios') => {
    try {
      if (tipo === 'tickets') await API.admin.exportarTickets();
      else await API.admin.exportarUsuarios();
      toast(`CSV de ${tipo} descargado`);
    } catch (err: any) {
      toast(err?.message || 'No se pudo exportar', 'error');
    }
  };

  return (
    <>
      <div className="grid-cards">
        {tarjetas.map((t) => (
          <div className={`stat ${t.clase}`} key={t.label}>
            <div className="stat__label">
              <span>{t.label}</span>
              <span className="stat__icono">
                <Icon name={t.icono} />
              </span>
            </div>
            <div className="stat__valor">{t.valor}</div>
            <div className="stat__pie">{t.pie}</div>
          </div>
        ))}
      </div>

      <div className="dos-columnas" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="panel__head">
            <h2>Evolución de tickets</h2>
            <span>últimos 14 días</span>
          </div>
          <div className="panel__body">
            <div className="grafico">
              {serie.map((s) => {
                const alto = Math.max(3, Math.round((s.total / max) * 120));
                const etiqueta = s.dia.toLocaleDateString('es-CO', {
                  day: '2-digit',
                  month: 'short',
                });
                return (
                  <div className="grafico__col" key={s.dia.toISOString()}>
                    <span className="grafico__valor">{s.total}</span>
                    <div
                      className={`grafico__barra ${
                        claveLocal(s.dia) === hoy ? 'grafico__barra--hoy' : ''
                      }`}
                      style={{ height: alto }}
                    />
                    <span className="grafico__dia">{etiqueta}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h2>Carga por urgencia</h2>
            <span>tickets activos</span>
          </div>
          <div className="panel__body">
            {urgencias.map((x) => (
              <div style={{ marginBottom: 13 }} key={x.u}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                    fontSize: 11.5,
                  }}
                >
                  <span>
                    <UrgenciaBadge urgencia={x.u} />
                  </span>
                  <strong>{x.total}</strong>
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 4,
                    background: 'rgba(255,255,255,.06)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.round((x.total / totalUrg) * 100)}%`,
                      background:
                        x.u === 'Crítica'
                          ? 'var(--red)'
                          : x.u === 'Alta'
                            ? '#ffa27e'
                            : x.u === 'Media'
                              ? 'var(--amber)'
                              : 'var(--mint)',
                    }}
                  />
                </div>
              </div>
            ))}
            <div
              style={{
                borderTop: '1px solid var(--line)',
                marginTop: 14,
                paddingTop: 12,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {(m.por_categoria || []).length ? (
                (m.por_categoria || []).map((x: any) => (
                  <span className="pill" key={x.categoria}>
                    {x.categoria} · <b>{Number(x.total) || 0}</b>
                  </span>
                ))
              ) : (
                <span className="texto-dim">Sin datos</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="dos-columnas" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="panel__head">
            <h2>Distribución por estado</h2>
            <span>todos los tickets</span>
          </div>
          <div className="panel__body panel__body--flush">
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Tickets</th>
                  </tr>
                </thead>
                <tbody>
                  {estados.map((x) => (
                    <tr key={x.e}>
                      <td>
                        <EstadoBadge estado={x.e} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>{x.total}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h2>Analistas destacados</h2>
            <span>por cierres</span>
          </div>
          <div className="panel__body panel__body--flush">
            {(m.top_analistas || []).length ? (
              <div className="tabla-wrap">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Analista</th>
                      <th style={{ textAlign: 'right' }}>Asignados</th>
                      <th style={{ textAlign: 'right' }}>Finalizados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(m.top_analistas || []).map((a: any) => (
                      <tr key={a.id_usuario}>
                        <td className="celda-titulo">{a.analista}</td>
                        <td style={{ textAlign: 'right' }}>{Number(a.asignados) || 0}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="badge badge--verde">
                            {Number(a.finalizados) || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty" style={{ padding: 28 }}>
                <strong>Sin analistas con tickets</strong>
                <p>Las asignaciones aparecerán aquí.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel__head">
          <h2>Salud del SLA</h2>
          <span>respuesta y resolución</span>
        </div>
        <div className="panel__body">
          <div className="datos-grid">
            <div className="dato">
              <dt>Respuesta incumplida</dt>
              <dd>{Number(g.sla_respuesta_incumplidos) || 0} ticket(s)</dd>
            </div>
            <div className="dato">
              <dt>Resolución incumplida</dt>
              <dd>{Number(g.sla_resolucion_incumplidos) || 0} ticket(s)</dd>
            </div>
            <div className="dato">
              <dt>Resueltos</dt>
              <dd>{Number(g.resueltos) || 0}</dd>
            </div>
            <div className="dato">
              <dt>Cerrados</dt>
              <dd>{Number(g.cerrados) || 0}</dd>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel__head">
          <h2>Reportes y exportación</h2>
          <span>archivos CSV compatibles con Excel</span>
        </div>
        <div className="panel__body">
          <p className="campo__ayuda" style={{ margin: '0 0 12px' }}>
            Descarga la información actual de la mesa de ayuda para analizarla, archivarla o
            compartirla.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--fantasma" onClick={() => exportar('tickets')}>
              <Icon name="descargar" /> Exportar tickets
            </button>
            <button type="button" className="btn btn--fantasma" onClick={() => exportar('usuarios')}>
              <Icon name="descargar" /> Exportar usuarios
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
