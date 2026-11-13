'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/Icon';
import { useModal } from '@/components/ModalProvider';
import { useToast } from '@/components/ToastProvider';
import { Cargando, CategoriaBadge, Empty, ErrorPanel, EstadoBadge, Sla, UrgenciaBadge } from '@/components/ui';
import { API } from '@/lib/api';
import { colorDe } from '@/lib/format';
import { useTitulo } from '@/lib/useTitulo';

type Filtros = {
  q: string;
  estado: string;
  categoria: string;
  urgencia: string;
  nivel: string;
  sin_asignar: boolean;
  mios: boolean;
  vencidos: boolean;
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
};

function TriajeContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { abrirModal, cerrarModal } = useModal();
  const { usuario, cargando } = useAuth();
  useTitulo('Triaje y cola');

  const esStaff = ['Analista L1', 'Administrador'].includes(usuario?.rol || '');

  useEffect(() => {
    if (!cargando && usuario && !esStaff) router.replace('/dashboard');
  }, [cargando, usuario, esStaff, router]);

  const iniciales = useMemo<Filtros>(
    () => ({
      ...FILTROS_VACIOS,
      categoria: searchParams.get('categoria') || '',
      urgencia: searchParams.get('urgencia') || '',
      nivel: searchParams.get('nivel') || '',
      vencidos: searchParams.get('vencidos') === '1',
    }),
    [searchParams],
  );

  const [filtros, setFiltros] = useState<Filtros>(iniciales);
  const [tickets, setTickets] = useState<any[] | null>(null);
  const [error, setError] = useState<any>(null);
  const [actualizado, setActualizado] = useState('');
  const [autoRefresco, setAutoRefresco] = useState(true);
  const [cargandoLista, setCargandoLista] = useState(false);
  const filtrosRef = useRef(filtros);
  filtrosRef.current = filtros;

  useEffect(() => {
    setFiltros(iniciales);
  }, [iniciales]);

  useEffect(() => {
    setAutoRefresco(localStorage.getItem('nexo_auto_refresco') !== '0');
  }, []);

  const cargar = useCallback(async () => {
    setCargandoLista(true);
    try {
      const f = filtrosRef.current;
      const r: any = await API.tickets.listar({
        q: f.q,
        estado: f.estado,
        categoria: f.categoria,
        urgencia: f.urgencia,
        nivel: f.nivel,
        sin_asignar: f.sin_asignar ? '1' : '',
        mios: f.mios ? '1' : '',
        vencidos: f.vencidos ? '1' : '',
      });
      setTickets(r || []);
      setError(null);
      setActualizado(
        new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      );
    } catch (err) {
      setError(err);
    } finally {
      setCargandoLista(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!autoRefresco) return;
    const id = setInterval(() => {
      if (!document.hidden) cargar();
    }, 30000);
    return () => clearInterval(id);
  }, [autoRefresco, cargar]);

  useEffect(() => {
    localStorage.setItem('nexo_auto_refresco', autoRefresco ? '1' : '0');
  }, [autoRefresco]);

  const actualizar = (parcial: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...parcial }));

  const aplicar = (e: React.FormEvent) => {
    e.preventDefault();
    cargar();
  };

  const limpiar = () => {
    setFiltros(FILTROS_VACIOS);
    filtrosRef.current = FILTROS_VACIOS;
    setTimeout(cargar, 0);
  };

  const tomar = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await API.tickets.asignar(id);
      toast('Ticket tomado. Ya está asignado a ti.');
      await cargar();
    } catch (err: any) {
      toast(err?.message || 'No se pudo tomar el ticket', 'error');
    }
  };

  const escalar = async (e: React.MouseEvent, t: any) => {
    e.stopPropagation();
    abrirModal({
      titulo: 'Escalar a L2/SOC',
      cuerpo: (
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            const motivo = String(new FormData(ev.currentTarget).get('motivo') || '').trim();
            if (!motivo) return;
            try {
              await API.tickets.escalar(t.id_ticket, motivo);
              cerrarModal();
              toast('Ticket escalado a L2/SOC');
              await cargar();
            } catch (err: any) {
              toast(err?.message || 'No se pudo escalar el ticket', 'error');
            }
          }}
        >
          <p className="campo__ayuda" style={{ marginBottom: 14 }}>
            El ticket pasa a nivel L2/SOC y conserva su SLA. Describe el motivo para el equipo
            especializado.
          </p>
          <div className="campo">
            <label className="campo__label">
              Motivo del escalamiento <span>*</span>
            </label>
            <textarea
              className="textarea"
              name="motivo"
              required
              maxLength={1000}
              placeholder="Ej.: posible ransomware con archivos cifrados en el servidor de archivos…"
            />
          </div>
          <div className="modal__foot" style={{ padding: '16px 0 0' }}>
            <button type="button" className="btn btn--fantasma" onClick={cerrarModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--peligro">
              <Icon name="alerta" /> Escalar ahora
            </button>
          </div>
        </form>
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

  const conteo = { rojo: 0, amarillo: 0, verde: 0 } as Record<string, number>;
  (tickets || []).forEach((t) => {
    const c = colorDe(t);
    conteo[c] = (conteo[c] || 0) + 1;
  });

  return (
    <>
      <div className="pagina-head">
        <div className="pagina-head__texto">
          <span className="eyebrow">Cola priorizada · Analista L1</span>
          <h1>Triaje y cola de atención</h1>
          <p>
            Los casos críticos y de ciberseguridad aparecen primero. El contador de SLA se actualiza
            en tiempo real.
          </p>
        </div>
        <div className="pagina-head__acciones">
          <button
            type="button"
            className={`btn btn--pequeno ${autoRefresco ? 'btn--azul' : 'btn--fantasma'}`}
            aria-pressed={autoRefresco}
            title="Actualiza la cola cada 30 segundos"
            onClick={() => setAutoRefresco((v) => !v)}
          >
            <Icon name="reloj" /> Auto {autoRefresco ? 'activo' : 'inactivo'}
          </button>
          <button type="button" className="btn btn--fantasma" onClick={cargar}>
            <Icon name="flecha" /> Refrescar
          </button>
          {usuario?.rol !== 'Administrador' && (
            <Link className="btn btn--primario" href="/nuevo">
              <Icon name="nuevo" /> Nuevo ticket
            </Link>
          )}
        </div>
      </div>

      <form className="filtros" onSubmit={aplicar}>
        <input
          className="input filtros__busqueda"
          name="q"
          placeholder="Buscar por asunto, código o descripción…"
          value={filtros.q}
          onChange={(e) => actualizar({ q: e.target.value })}
        />
        <select
          className="select"
          name="estado"
          value={filtros.estado}
          onChange={(e) => actualizar({ estado: e.target.value })}
        >
          <option value="">Activos (todos)</option>
          {['Abierto', 'En Progreso', 'En Espera', 'Escalado', 'Resuelto', 'Cerrado'].map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <select
          className="select"
          name="categoria"
          value={filtros.categoria}
          onChange={(e) => actualizar({ categoria: e.target.value })}
        >
          <option value="">Toda categoría</option>
          <option>TI General</option>
          <option>Ciberseguridad</option>
        </select>
        <select
          className="select"
          name="urgencia"
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
          name="nivel"
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
          Mis tickets
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={filtros.vencidos}
            onChange={(e) => actualizar({ vencidos: e.target.checked })}
          />{' '}
          SLA vencido
        </label>
        <div className="filtros__grupo">
          <button type="button" className="btn btn--pequeno btn--fantasma" onClick={limpiar}>
            Limpiar
          </button>
          <button type="submit" className="btn btn--pequeno btn--primario">
            Aplicar
          </button>
        </div>
      </form>

      <div className="resumen-semaforo">
        <span className="resumen-semaforo__item">
          <span className="punto punto--rojo" /> Críticos / vencidos <b>{conteo.rojo || 0}</b>
        </span>
        <span className="resumen-semaforo__item">
          <span className="punto punto--amarillo" /> Media <b>{conteo.amarillo || 0}</b>
        </span>
        <span className="resumen-semaforo__item">
          <span className="punto punto--verde" /> Baja <b>{conteo.verde || 0}</b>
        </span>
        <span className="resumen-semaforo__item" style={{ marginLeft: 'auto' }}>
          Mostrando <b>{tickets?.length || 0}</b> ticket(s)
        </span>
        <span className="resumen-semaforo__item" title="Última actualización de la cola">
          Actualizado {actualizado || '—'}
        </span>
      </div>

      <div className="triaje">
        {!tickets ? (
          <Cargando />
        ) : tickets.length ? (
          tickets.map((t) => {
            const color = colorDe(t);
            const activo = !['Resuelto', 'Cerrado'].includes(t.estado);
            return (
              <div
                className={`ticket-card ${color === 'rojo' ? 'ticket-card--critico' : ''}`}
                key={t.id_ticket}
                onClick={() => router.push(`/ticket/${t.id_ticket}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') router.push(`/ticket/${t.id_ticket}`);
                }}
              >
                <div className={`ticket-card__barra semaforo--${color}`} />
                <div className="ticket-card__cuerpo">
                  <div className="ticket-card__fila">
                    <span className="ticket-card__codigo">{t.codigo || ''}</span>
                    <UrgenciaBadge urgencia={t.urgencia} />
                    <CategoriaBadge categoria={t.categoria} />
                    {t.prioridad_auto && <span className="badge badge--violeta">Triaje automático</span>}
                    {t.sla_vencido && <span className="badge badge--rojo">SLA vencido</span>}
                    {t.nivel_escalamiento === 'L2/SOC' && (
                      <span className="badge badge--violeta">L2/SOC</span>
                    )}
                  </div>
                  <div className="ticket-card__fila">
                    <strong className="ticket-card__titulo">{t.asunto}</strong>
                  </div>
                  <div className="ticket-card__meta">
                    <span>
                      <Icon name="usuario" /> {t.solicitante}
                    </span>
                    <span>
                      <Icon name="clip" /> {t.subcategoria || t.categoria}
                    </span>
                    <span>
                      <EstadoBadge estado={t.estado} />
                    </span>
                    <span>{t.analista || 'Sin asignar'}</span>
                  </div>
                </div>
                <div className="ticket-card__lado">
                  <Sla fin={t.sla_vencimiento_resolucion} pausado={t.sla_pausado} estado={t.estado} />
                  <div className="ticket-card__acciones">
                    {activo && !t.id_analista_asignado && (
                      <button
                        type="button"
                        className="btn btn--pequeno btn--primario"
                        onClick={(e) => tomar(e, t.id_ticket)}
                      >
                        Tomar
                      </button>
                    )}
                    {activo && t.nivel_escalamiento !== 'L2/SOC' && (
                      <button
                        type="button"
                        className="btn btn--pequeno btn--peligro"
                        onClick={(e) => escalar(e, t)}
                      >
                        Escalar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <Empty
            titulo="Sin tickets con esos filtros"
            texto="Ajusta los filtros o espera nuevas solicitudes."
          />
        )}
      </div>
      {cargandoLista && tickets ? (
        <span className="texto-dim" style={{ fontSize: 10 }}>
          Actualizando…
        </span>
      ) : null}
    </>
  );
}

export default function TriajePage() {
  return (
    <Suspense fallback={<Cargando />}>
      <TriajeContenido />
    </Suspense>
  );
}
