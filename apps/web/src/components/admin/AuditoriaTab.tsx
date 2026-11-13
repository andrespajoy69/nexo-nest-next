'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Cargando, Empty, ErrorPanel } from '@/components/ui';
import { API } from '@/lib/api';
import { fmtFecha } from '@/lib/format';

export function AuditoriaTab() {
  const [filas, setFilas] = useState<any[] | null>(null);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    API.admin
      .auditoria()
      .then((r: any) => setFilas(r || []))
      .catch(setError);
  }, []);

  if (error) {
    return (
      <div className="panel">
        <ErrorPanel error={error} />
      </div>
    );
  }
  if (!filas) return <Cargando />;

  return (
    <div className="panel">
      <div className="panel__head">
        <h2>Trazabilidad de la mesa de ayuda</h2>
        <span>últimos 100 eventos</span>
      </div>
      <div className="panel__body panel__body--flush">
        {filas.length ? (
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ticket</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                  <th>Transición</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((h, i) => (
                  <tr key={h.id_historial ?? i}>
                    <td
                      className="texto-dim"
                      style={{ fontSize: 10, whiteSpace: 'nowrap' }}
                    >
                      {fmtFecha(h.fecha)}
                    </td>
                    <td className="mono" style={{ fontSize: 10 }}>
                      {h.id_ticket ? (
                        <Link href={`/ticket/${h.id_ticket}`} style={{ color: 'var(--mint)' }}>
                          {h.codigo || `#${h.id_ticket}`}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ fontSize: 11 }}>{h.usuario || 'Sistema'}</td>
                    <td>
                      <span className="badge badge--gris">{h.accion}</span>
                    </td>
                    <td
                      className="texto-muted"
                      style={{ fontSize: 11, maxWidth: 320 }}
                    >
                      {h.detalle || '—'}
                    </td>
                    <td className="texto-dim" style={{ fontSize: 10.5 }}>
                      {h.estado_anterior || h.estado_nuevo
                        ? `${h.estado_anterior || '—'} → ${h.estado_nuevo || '—'}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            titulo="Sin eventos registrados"
            texto="Las acciones sobre tickets aparecerán aquí."
          />
        )}
      </div>
    </div>
  );
}
