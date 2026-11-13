'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/Icon';
import { Cargando, Empty, ErrorPanel, TicketMini } from '@/components/ui';
import { API } from '@/lib/api';
import { claveLocal, serieDias } from '@/lib/format';
import { useTitulo } from '@/lib/useTitulo';

export default function DashboardPage() {
  const { usuario } = useAuth();
  const [resumen, setResumen] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [saludo, setSaludo] = useState('Buenos días');
  useTitulo('Tablero');

  useEffect(() => {
    const h = new Date().getHours();
    setSaludo(h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches');
  }, []);

  useEffect(() => {
    API.tickets
      .resumen()
      .then(setResumen)
      .catch(setError);
  }, []);

  if (error) {
    return (
      <div className="panel">
        <ErrorPanel error={error} />
      </div>
    );
  }
  if (!resumen || !usuario) return <Cargando />;

  const c = resumen.conteo || {};
  const staff = resumen.alcance === 'global';
  const activos =
    Number(c.abiertos) + Number(c.en_progreso) + Number(c.en_espera) + Number(c.escalados);
  const serie = serieDias(resumen.por_dia, 7);
  const max = Math.max(1, ...serie.map((s) => s.total));
  const hoy = claveLocal(new Date());

  const tarjetas = staff
    ? [
        {
          clase: '',
          icono: 'panel',
          label: 'Tickets activos',
          valor: activos,
          pie: `de ${c.total} registrados`,
          href: '/triaje',
        },
        {
          clase: 'stat--rojo',
          icono: 'escudo',
          label: 'Ciber activos',
          valor: Number(c.ciberseguridad_activos),
          pie: 'requieren atención especializada',
          href: '/triaje?categoria=Ciberseguridad',
        },
        {
          clase: 'stat--ambar',
          icono: 'alerta',
          label: 'SLA vencidos',
          valor: Number(c.sla_vencidos),
          pie: 'fuera del tiempo comprometido',
          href: '/triaje?vencidos=1',
        },
        {
          clase: 'stat--azul',
          icono: 'flecha',
          label: 'Escalados L2/SOC',
          valor: Number(c.en_l2),
          pie: 'en manos del equipo especializado',
          href: '/triaje?nivel=L2%2FSOC',
        },
      ]
    : [
        {
          clase: '',
          icono: 'lista',
          label: 'Mis tickets',
          valor: Number(c.total),
          pie: 'solicitudes registradas',
          href: '/mis',
        },
        {
          clase: 'stat--azul',
          icono: 'reloj',
          label: 'En atención',
          valor: Number(c.abiertos) + Number(c.en_progreso),
          pie: 'abiertos o en progreso',
          href: '/mis/atencion',
        },
        {
          clase: 'stat--ambar',
          icono: 'alerta',
          label: 'En espera',
          valor: Number(c.en_espera),
          pie: 'pendientes de tu respuesta',
          href: '/mis/espera',
        },
        {
          clase: 'stat--verde',
          icono: 'check',
          label: 'Finalizados',
          valor: Number(c.resueltos) + Number(c.cerrados),
          pie: 'resueltos y cerrados',
          href: '/mis/finalizados',
        },
      ];

  const urgencias = ['Crítica', 'Alta', 'Media', 'Baja'].map((u) => {
    const fila = (resumen.por_urgencia || []).find((x: any) => x.urgencia === u);
    return { u, total: fila ? Number(fila.total) : 0 };
  });
  const totalUrg = Math.max(1, urgencias.reduce((a, b) => a + b.total, 0));
  const categorias = (resumen.por_categoria || []).map((x: any) => ({
    cat: x.categoria,
    total: Number(x.total),
  }));

  const colorUrg = (u: string) =>
    u === 'Crítica' ? 'var(--red)' : u === 'Alta' ? '#ffa27e' : u === 'Media' ? 'var(--amber)' : 'var(--mint)';

  return (
    <>
      <div className="pagina-head">
        <div className="pagina-head__texto">
          <span className="eyebrow">
            {staff ? 'Consola de operaciones' : 'Portal de autoservicio'}
          </span>
          <h1>
            {saludo}, {usuario.nombre}
          </h1>
          <p>
            {staff
              ? 'Estado general de la mesa de ayuda y prioridades del día.'
              : 'Este es el estado de tus solicitudes de soporte.'}
          </p>
        </div>
        <div className="pagina-head__acciones">
          {staff && (
            <Link className="btn btn--fantasma" href="/triaje">
              <Icon name="escudo" /> Ir al triaje
            </Link>
          )}
          {usuario.rol === 'Administrador' && (
            <Link className="btn btn--fantasma" href="/admin/seguimiento">
              <Icon name="lista" /> Seguimiento global
            </Link>
          )}
          {usuario.rol !== 'Administrador' && (
            <Link className="btn btn--primario" href="/nuevo">
              <Icon name="nuevo" /> Nuevo ticket
            </Link>
          )}
        </div>
      </div>

      {staff && Number(c.sla_vencidos) > 0 && (
        <Link className="aviso-alerta" href="/triaje?vencidos=1">
          <span className="aviso-alerta__icono">
            <Icon name="alerta" />
          </span>
          <span className="aviso-alerta__texto">
            <strong>{Number(c.sla_vencidos)} ticket(s) fuera del SLA</strong>
            <small>
              Superaron el tiempo comprometido. Revísalos antes que el resto de la cola.
            </small>
          </span>
          <span className="aviso-alerta__accion">Ver cola priorizada →</span>
        </Link>
      )}

      <div className="grid-cards">
        {tarjetas.map((t) => (
          <Link className={`stat stat--link ${t.clase}`} href={t.href} key={t.label}>
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
          </Link>
        ))}
      </div>

      <div className="dos-columnas" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="panel__head">
            <h2>Actividad de los últimos 7 días</h2>
            <span>tickets creados</span>
          </div>
          <div className="panel__body">
            <div className="grafico">
              {serie.map((s) => {
                const alto = Math.max(3, Math.round((s.total / max) * 110));
                const etiqueta = s.dia
                  .toLocaleDateString('es-CO', { weekday: 'short' })
                  .replace('.', '');
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
            {urgencias.map((x) => {
              const contenido = (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                      fontSize: 11.5,
                    }}
                  >
                    <span>
                      <span className={`urg ${x.u === 'Crítica' ? 'urg--critica' : x.u === 'Alta' ? 'urg--alta' : x.u === 'Media' ? 'urg--media' : 'urg--baja'}`}>
                        {x.u}
                      </span>
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
                        background: colorUrg(x.u),
                      }}
                    />
                  </div>
                </>
              );
              return staff ? (
                <Link
                  className="fila-urgencia"
                  href={`/triaje?urgencia=${encodeURIComponent(x.u)}`}
                  title={`Ver tickets con urgencia ${x.u}`}
                  key={x.u}
                  style={{ display: 'block', marginBottom: 13 }}
                >
                  {contenido}
                </Link>
              ) : (
                <div className="fila-urgencia" key={x.u} style={{ marginBottom: 13 }}>
                  {contenido}
                </div>
              );
            })}
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
              {categorias.length ? (
                categorias.map((x: any) =>
                  staff ? (
                    <Link
                      className="pill pill--accion"
                      href={`/triaje?categoria=${encodeURIComponent(x.cat)}`}
                      title={`Ver tickets de ${x.cat}`}
                      key={x.cat}
                    >
                      {x.cat} · <b>{x.total}</b>
                    </Link>
                  ) : (
                    <span className="pill" key={x.cat}>
                      {x.cat} · <b>{x.total}</b>
                    </span>
                  ),
                )
              ) : (
                <span className="texto-dim">Sin tickets activos por ahora</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel__head">
          <h2>{staff ? 'Últimos tickets recibidos' : 'Mis últimas solicitudes'}</h2>
          <Link
            href={staff ? '/triaje' : '/mis'}
            style={{ color: 'var(--mint)', fontSize: 10.5, fontWeight: 700 }}
          >
            Ver todos →
          </Link>
        </div>
        <div className="panel__body panel__body--flush">
          {resumen.ultimos?.length ? (
            resumen.ultimos.map((t: any) => <TicketMini key={t.id_ticket} t={t} />)
          ) : (
            <Empty
              titulo="Aún no hay tickets"
              texto="Cuando se registre una solicitud aparecerá aquí."
            />
          )}
        </div>
      </div>
    </>
  );
}
