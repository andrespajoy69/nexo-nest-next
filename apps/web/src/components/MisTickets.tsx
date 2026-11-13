'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API } from '@/lib/api';
import { useTitulo } from '@/lib/useTitulo';
import { Cargando, CategoriaBadge, Empty, ErrorPanel, EstadoBadge, Sla, UrgenciaBadge } from './ui';
import { Icon } from './Icon';

const FILTROS = ['todos', 'atencion', 'espera', 'finalizados'] as const;
type Filtro = (typeof FILTROS)[number];

const TITULOS: Record<Filtro, string> = {
  todos: 'Historial de solicitudes',
  atencion: 'Tickets en atención',
  espera: 'Tickets en espera',
  finalizados: 'Tickets finalizados',
};

const VACIOS: Record<Filtro, [string, string]> = {
  todos: [
    'Todavía no tienes tickets',
    'Registra tu primera solicitud de soporte o reporta un evento sospechoso.',
  ],
  atencion: ['Sin tickets en atención', 'No tienes solicitudes abiertas o en progreso en este momento.'],
  espera: ['Sin tickets en espera', 'No hay solicitudes pendientes de tu respuesta.'],
  finalizados: ['Sin tickets finalizados', 'Cuando se resuelva o cierre una solicitud aparecerá aquí.'],
};

const EN_ATENCION = ['Abierto', 'En Progreso'];
const FINALIZADOS = ['Resuelto', 'Cerrado'];

export function MisTickets({ filtro: filtroRaw }: { filtro?: string }) {
  const router = useRouter();
  const filtro: Filtro = FILTROS.includes(filtroRaw as Filtro) ? (filtroRaw as Filtro) : 'todos';
  const [tickets, setTickets] = useState<any[] | null>(null);
  const [error, setError] = useState<any>(null);
  useTitulo('Mis tickets');

  useEffect(() => {
    API.tickets
      .misTickets()
      .then((r: any) => setTickets(r))
      .catch(setError);
  }, []);

  if (error) {
    return (
      <div className="panel">
        <ErrorPanel error={error} />
      </div>
    );
  }
  if (!tickets) return <Cargando />;

  const coincide = (t: any) => {
    if (filtro === 'atencion') return EN_ATENCION.includes(t.estado);
    if (filtro === 'espera') return t.estado === 'En Espera';
    if (filtro === 'finalizados') return FINALIZADOS.includes(t.estado);
    return true;
  };
  const visibles = tickets.filter(coincide);
  const totalAtencion = tickets.filter((t) => EN_ATENCION.includes(t.estado)).length;
  const totalEspera = tickets.filter((t) => t.estado === 'En Espera').length;
  const totalFinal = tickets.filter((t) => FINALIZADOS.includes(t.estado)).length;

  return (
    <>
      <div className="pagina-head">
        <div className="pagina-head__texto">
          <span className="eyebrow">Portal de autoservicio</span>
          <h1>Mis tickets</h1>
          <p>Rastrea el estado de tus solicitudes y el tiempo restante de atención.</p>
        </div>
        <div className="pagina-head__acciones">
          <Link className="btn btn--primario" href="/nuevo">
            <Icon name="nuevo" /> Nuevo ticket
          </Link>
        </div>
      </div>

      <div className="filtros filtros--chips" role="tablist" aria-label="Filtrar mis tickets">
        <Link className={`chip-filtro ${filtro === 'todos' ? 'activo' : ''}`} href="/mis">
          Todos <b>{tickets.length}</b>
        </Link>
        <Link
          className={`chip-filtro ${filtro === 'atencion' ? 'activo' : ''}`}
          href="/mis/atencion"
        >
          En atención <b>{totalAtencion}</b>
        </Link>
        <Link className={`chip-filtro ${filtro === 'espera' ? 'activo' : ''}`} href="/mis/espera">
          En espera <b>{totalEspera}</b>
        </Link>
        <Link
          className={`chip-filtro ${filtro === 'finalizados' ? 'activo' : ''}`}
          href="/mis/finalizados"
        >
          Finalizados <b>{totalFinal}</b>
        </Link>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2>{TITULOS[filtro]}</h2>
          <span>{visibles.length} ticket(s)</span>
        </div>
        <div className="panel__body panel__body--flush">
          {visibles.length ? (
            <div className="tabla-wrap">
              <table className="tabla tabla--clic">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Asunto</th>
                    <th>Categoría</th>
                    <th>Urgencia</th>
                    <th>Estado</th>
                    <th>SLA restante</th>
                    <th>Analista</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((t) => (
                    <tr key={t.id_ticket} onClick={() => router.push(`/ticket/${t.id_ticket}`)}>
                      <td className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                        {t.codigo || ''}
                      </td>
                      <td className="celda-titulo">{t.asunto}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              titulo={VACIOS[filtro][0]}
              texto={VACIOS[filtro][1]}
              accion={
                filtro === 'todos' ? (
                  <Link className="btn btn--primario" href="/nuevo">
                    Crear mi primer ticket
                  </Link>
                ) : undefined
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
