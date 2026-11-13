'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import { ESTADO_CLASE, URG_CLASE, textoRestante } from '@/lib/format';

export function EstadoBadge({ estado }: { estado: string }) {
  return <span className={`estado ${ESTADO_CLASE[estado] || 'estado--abierto'}`}>{estado}</span>;
}

export function UrgenciaBadge({ urgencia }: { urgencia: string }) {
  return <span className={`urg ${URG_CLASE[urgencia] || 'urg--baja'}`}>{urgencia}</span>;
}

export function CategoriaBadge({ categoria }: { categoria: string }) {
  return categoria === 'Ciberseguridad' ? (
    <span className="badge badge--rojo">Ciberseguridad</span>
  ) : (
    <span className="badge badge--azul">TI General</span>
  );
}

export function RolBadge({ rol }: { rol: string }) {
  const clase =
    rol === 'Administrador' ? 'badge--violeta' : rol === 'Analista L1' ? 'badge--azul' : 'badge--gris';
  return <span className={`badge ${clase}`}>{rol}</span>;
}

function calcularSla(fin: string, pausado: boolean, estado: string) {
  if (estado === 'Resuelto' || estado === 'Cerrado') {
    return { texto: `✓ ${estado}`, clase: 'sla sla--final' };
  }
  if (pausado) return { texto: '⏸ En espera', clase: 'sla sla--pausa' };
  if (!fin) return { texto: '—', clase: 'sla' };
  const restante = new Date(fin).getTime() - Date.now();
  const clase = `sla${restante < 0 ? ' sla--vencido' : restante < 3600 * 1000 ? ' sla--pronto' : ''}`;
  return { texto: textoRestante(restante), clase };
}

export function Sla({
  fin,
  pausado,
  estado,
}: {
  fin?: string | null;
  pausado?: boolean;
  estado: string;
}) {
  const [valor, setValor] = useState(() => calcularSla(fin || '', Boolean(pausado), estado));

  useEffect(() => {
    const actualizar = () => setValor(calcularSla(fin || '', Boolean(pausado), estado));
    actualizar();
    if (!fin || pausado || estado === 'Resuelto' || estado === 'Cerrado') return;
    const id = setInterval(actualizar, 1000);
    return () => clearInterval(id);
  }, [fin, pausado, estado]);

  return <span className={valor.clase}>{valor.texto}</span>;
}

export function Cargando() {
  return (
    <div className="panel">
      <div className="cargando">
        <div className="cargando__linea" />
        <div className="cargando__linea" />
        <div className="cargando__linea" />
      </div>
    </div>
  );
}

export function Empty({
  titulo,
  texto = '',
  accion,
}: {
  titulo: string;
  texto?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__icono">
        <Icon name="escudo" />
      </div>
      <strong>{titulo}</strong>
      {texto ? <p>{texto}</p> : null}
      {accion}
    </div>
  );
}

export function ErrorPanel({ error }: { error: any }) {
  return (
    <Empty
      titulo="Ocurrió un problema"
      texto={error?.message || 'No se pudo cargar la información. Intenta de nuevo.'}
    />
  );
}

export function Boot() {
  return (
    <div className="boot">
      <div className="boot__marca">
        <span />
        <span />
        <span />
      </div>
      <p>Cargando Nexo…</p>
    </div>
  );
}

export function TicketMini({
  t,
  href,
}: {
  t: any;
  href?: string;
}) {
  const color = t.sla_vencido ? 'rojo' : t.semaforo || 'verde';
  return (
    <Link
      className="ticket-mini"
      href={href || `/ticket/${t.id_ticket}`}
      style={{ color: 'inherit' }}
    >
      <span className={`ticket-mini__semaforo semaforo--${color}`} />
      <div className="ticket-mini__info">
        <strong>{t.asunto}</strong>
        <div className="ticket-mini__meta">
          <span>{t.codigo || ''}</span>
          <span>{t.categoria}</span>
          <span>{t.solicitante || ''}</span>
        </div>
      </div>
      <div className="ticket-mini__lado">
        <UrgenciaBadge urgencia={t.urgencia} />
        <EstadoBadge estado={t.estado} />
        <Sla fin={t.sla_vencimiento_resolucion} pausado={t.sla_pausado} estado={t.estado} />
      </div>
    </Link>
  );
}
