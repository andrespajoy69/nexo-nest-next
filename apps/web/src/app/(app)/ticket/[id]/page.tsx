'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/Icon';
import { useModal } from '@/components/ModalProvider';
import { useToast } from '@/components/ToastProvider';
import {
  Cargando,
  CategoriaBadge,
  ErrorPanel,
  EstadoBadge,
  Sla,
  UrgenciaBadge,
} from '@/components/ui';
import { API } from '@/lib/api';
import { hace, fmtBytes, fmtFecha } from '@/lib/format';
import {
  ACCION_ICONO,
  ACCION_TEXTO,
  ETIQUETAS_DATOS,
  PLANTILLAS_COMENTARIO,
  PLANTILLAS_RESOLUCION,
  TRANSICIONES,
} from '@/lib/constants';
import { useTitulo } from '@/lib/useTitulo';

export default function TicketPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { usuario } = useAuth();
  const { toast } = useToast();
  const { abrirModal, cerrarModal } = useModal();
  useTitulo('Detalle de ticket');

  const [t, setT] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [analistas, setAnalistas] = useState<any[]>([]);
  const [comentario, setComentario] = useState('');
  const [interno, setInterno] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const archivosRef = useRef<HTMLInputElement | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    try {
      const r: any = await API.tickets.detalle(id);
      setT(r);
      setError(null);
      if (usuario?.rol === 'Administrador' && !['Resuelto', 'Cerrado'].includes(r.estado)) {
        try {
          const a: any = await API.tickets.analistas();
          setAnalistas(a || []);
        } catch {
          setAnalistas([]);
        }
      }
    } catch (err) {
      setError(err);
    }
  }, [id, usuario?.rol]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) {
    return (
      <div className="panel">
        <ErrorPanel error={error} />
      </div>
    );
  }
  if (!t || !usuario) return <Cargando />;

  const staff = Boolean(t.puede_gestionar);
  const activo = !['Resuelto', 'Cerrado'].includes(t.estado);
  const finalizado = !activo;
  const esSolicitante = Number(usuario.id_usuario) === Number(t.id_solicitante);
  const datos = t.datos_especificos && typeof t.datos_especificos === 'object' ? t.datos_especificos : {};
  const datosEntradas = Object.entries(datos).filter(([, valor]) => valor);
  const transiciones = (TRANSICIONES[t.estado] || []).filter(
    (e) => e !== 'Escalado' && e !== 'Resuelto',
  );

  const guia =
    !staff && ['Abierto', 'En Progreso'].includes(t.estado)
      ? {
          clase: '',
          icono: 'chat',
          titulo: 'Tu caso está en revisión',
          texto: 'Puedes agregar información, responder preguntas o adjuntar evidencias en cualquier momento.',
          accion: 'Agregar información',
        }
      : !staff && t.estado === 'En Espera'
        ? {
            clase: 'guia-ticket--espera',
            icono: 'reloj',
            titulo: 'El equipo necesita tu respuesta',
            texto: 'Revisa la conversación y responde para que podamos continuar con la atención.',
            accion: 'Responder ahora',
          }
        : null;

  const irConversacion = () => {
    const panel = document.getElementById('conversacion');
    if (!panel) return;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panel.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true });
  };

  const cambiarEstado = async (nuevo: string) => {
    if (!nuevo) return;
    try {
      await API.tickets.estado(t.id_ticket, nuevo);
      toast(`Estado actualizado a ${nuevo}`);
      await cargar();
    } catch (err: any) {
      toast(err?.message || 'No se pudo cambiar el estado', 'error');
    }
  };

  const tomar = async () => {
    try {
      await API.tickets.asignar(t.id_ticket);
      toast('Ticket tomado. Ya está asignado a ti.');
      await cargar();
    } catch (err: any) {
      toast(err?.message || 'No se pudo tomar el ticket', 'error');
    }
  };

  const asignar = async (idAnalista: string) => {
    if (!idAnalista) return;
    try {
      await API.tickets.asignar(t.id_ticket, idAnalista);
      toast('Ticket reasignado');
      await cargar();
    } catch (err: any) {
      toast(err?.message || 'No se pudo reasignar', 'error');
    }
  };

  const abrirEscalar = () => {
    abrirModal({
      titulo: 'Escalar a L2/SOC',
      cuerpo: (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const motivo = String(new FormData(e.currentTarget).get('motivo') || '').trim();
            if (!motivo) return;
            try {
              await API.tickets.escalar(t.id_ticket, motivo);
              cerrarModal();
              toast('Ticket escalado a L2/SOC');
              await cargar();
            } catch (err: any) {
              toast(err?.message || 'No se pudo escalar', 'error');
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

  const abrirResolver = () => {
    abrirModal({
      titulo: 'Resolver ticket',
      cuerpo: (
        <form
          data-form="resolver"
          onSubmit={async (e) => {
            e.preventDefault();
            const resumen = String(new FormData(e.currentTarget).get('resumen') || '').trim();
            if (!resumen) {
              toast('Describe la resolución realizada', 'error');
              return;
            }
            try {
              await API.tickets.estado(t.id_ticket, 'Resuelto', resumen);
              cerrarModal();
              toast('Ticket resuelto. Se notificó al usuario con el resumen.');
              await cargar();
            } catch (err: any) {
              toast(err?.message || 'No se pudo resolver', 'error');
            }
          }}
        >
          <p className="campo__ayuda" style={{ marginBottom: 14 }}>
            {t.codigo ? (
              <>
                Ticket <strong>{t.codigo}</strong> ·{' '}
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
                  onClick={() => {
                    const ta = document.querySelector<HTMLTextAreaElement>(
                      'form[data-form="resolver"] textarea[name="resumen"]',
                    );
                    if (!ta) return;
                    ta.value = ta.value.trim() ? `${ta.value.trim()}\n\n${p.texto}` : p.texto;
                    ta.focus();
                  }}
                >
                  {p.titulo}
                </button>
              ))}
            </div>
            <span className="campo__ayuda">Haz clic para insertar una base y ajústala al caso.</span>
          </div>
          <div className="campo">
            <label className="campo__label">
              Resumen de la resolución <span>*</span>
            </label>
            <textarea
              className="textarea"
              name="resumen"
              required
              maxLength={4000}
              style={{ minHeight: 130 }}
              placeholder="Ej.: se restablecieron las credenciales, se bloqueó el remitente y se capacitó al usuario."
            />
          </div>
          <div className="modal__foot" style={{ padding: '16px 0 0' }}>
            <button type="button" className="btn btn--fantasma" onClick={cerrarModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primario">
              <Icon name="check" /> Marcar como resuelto
            </button>
          </div>
        </form>
      ),
    });
  };

  const confirmar = async () => {
    if (!window.confirm('¿Confirmas que el problema quedó resuelto? El ticket se cerrará.')) return;
    try {
      await API.tickets.confirmar(t.id_ticket);
      toast('Ticket cerrado. ¡Gracias por confirmar!');
      await cargar();
    } catch (err: any) {
      toast(err?.message || 'No se pudo confirmar', 'error');
    }
  };

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/ticket/${t.id_ticket}`);
      toast('Enlace del ticket copiado');
    } catch {
      toast('No se pudo copiar el enlace', 'error');
    }
  };

  const enviarComentario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comentario.trim()) return;
    setEnviando(true);
    try {
      await API.tickets.comentar(t.id_ticket, comentario.trim(), staff && interno);
      setComentario('');
      setInterno(false);
      toast(interno ? 'Nota interna registrada' : 'Comentario enviado');
      await cargar();
    } catch (err: any) {
      toast(err?.message || 'No se pudo enviar el comentario', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const subirEvidencias = async (e: React.FormEvent) => {
    e.preventDefault();
    const archivos = archivosRef.current?.files;
    if (!archivos?.length) {
      toast('Selecciona al menos un archivo', 'error');
      return;
    }
    try {
      await API.tickets.subirEvidencias(t.id_ticket, archivos);
      if (archivosRef.current) archivosRef.current.value = '';
      toast('Evidencias cargadas en cuarentena');
      await cargar();
    } catch (err: any) {
      toast(err?.message || 'No se pudieron subir las evidencias', 'error');
    }
  };

  const cambiarCuarentena = async (ev: any) => {
    try {
      await API.tickets.cuarentena(ev.id_evidencia, !ev.en_cuarentena);
      toast(ev.en_cuarentena ? 'Evidencia liberada' : 'Evidencia en cuarentena');
      await cargar();
    } catch (err: any) {
      toast(err?.message || 'No se pudo actualizar la evidencia', 'error');
    }
  };

  return (
    <>
      <div className="migas">
        <Link href={staff ? '/triaje' : '/mis'}>{staff ? 'Triaje y cola' : 'Mis tickets'}</Link>
        <span>/</span>
        <span>{t.codigo || `Ticket #${t.id_ticket}`}</span>
      </div>

      <div className="pagina-head">
        <div className="pagina-head__texto" style={{ gap: 9 }}>
          <div className="detalle__meta">
            <CategoriaBadge categoria={t.categoria} />
            <UrgenciaBadge urgencia={t.urgencia} />
            <EstadoBadge estado={t.estado} />
            {t.nivel_escalamiento === 'L2/SOC' && (
              <span className="badge badge--violeta">L2/SOC</span>
            )}
            {t.prioridad_auto && <span className="badge badge--violeta">Triaje automático</span>}
          </div>
          <h1 className="detalle__titulo">{t.asunto}</h1>
          <p>
            {t.codigo || ''} · registrado por {t.solicitante?.nombre || ''}{' '}
            {t.solicitante?.apellido || ''} · {fmtFecha(t.fecha_creacion)}
          </p>
        </div>
        <div className="pagina-head__acciones">
          {staff && transiciones.length ? (
            <select
              className="select"
              style={{ width: 'auto', minHeight: 38 }}
              defaultValue=""
              onChange={(e) => {
                const valor = e.target.value;
                e.target.value = '';
                cambiarEstado(valor);
              }}
            >
              <option value="">Cambiar estado…</option>
              {transiciones.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          ) : null}
          {staff && activo && !t.id_analista_asignado && (
            <button type="button" className="btn btn--fantasma" onClick={tomar}>
              <Icon name="usuario" /> Tomar ticket
            </button>
          )}
          {staff && activo && t.nivel_escalamiento !== 'L2/SOC' && (
            <button type="button" className="btn btn--peligro" onClick={abrirEscalar}>
              <Icon name="alerta" /> Escalar a L2/SOC
            </button>
          )}
          {staff && activo && (
            <button type="button" className="btn btn--primario" onClick={abrirResolver}>
              <Icon name="check" /> Resolver
            </button>
          )}
          {!staff && esSolicitante && t.estado === 'Resuelto' && (
            <button type="button" className="btn btn--primario" onClick={confirmar}>
              <Icon name="check" /> Confirmar cierre
            </button>
          )}
          <button
            type="button"
            className="btn btn--icono btn--fantasma"
            title="Copiar enlace del ticket"
            aria-label="Copiar enlace del ticket"
            onClick={copiarEnlace}
          >
            <Icon name="clip" />
          </button>
          <button
            type="button"
            className="btn btn--icono btn--fantasma"
            title="Imprimir ticket"
            aria-label="Imprimir ticket"
            onClick={() => window.print()}
          >
            <Icon name="lista" />
          </button>
        </div>
      </div>

      {guia && (
        <div className={`guia-ticket ${guia.clase}`}>
          <span className="guia-ticket__icono">
            <Icon name={guia.icono} />
          </span>
          <div className="guia-ticket__texto">
            <strong>{guia.titulo}</strong>
            <span>{guia.texto}</span>
          </div>
          <button type="button" className="btn btn--pequeno btn--primario" onClick={irConversacion}>
            {guia.accion}
          </button>
        </div>
      )}

      <div className="detalle">
        <div className="detalle__principal">
          <div className="panel">
            <div className="panel__head">
              <h2>Descripción</h2>
              <span>{hace(t.fecha_creacion)}</span>
            </div>
            <div className="panel__body">
              <p className="descripcion">{t.descripcion}</p>
              {datosEntradas.length ? (
                <div className="datos-grid" style={{ marginTop: 16 }}>
                  {datosEntradas.map(([clave, valor]) => (
                    <div className="dato" key={clave}>
                      <dt>{ETIQUETAS_DATOS[clave] || clave}</dt>
                      <dd>{String(valor)}</dd>
                    </div>
                  ))}
                </div>
              ) : null}
              {t.motivo_escalamiento ? (
                <div
                  className="dato"
                  style={{ marginTop: 12, borderColor: 'rgba(201,167,255,.25)' }}
                >
                  <dt>Motivo del escalamiento</dt>
                  <dd>{t.motivo_escalamiento}</dd>
                </div>
              ) : null}
              {t.resumen_resolucion ? (
                <div className="dato" style={{ marginTop: 12, borderColor: 'rgba(183,243,107,.28)' }}>
                  <dt>Resolución realizada</dt>
                  <dd>{t.resumen_resolucion}</dd>
                </div>
              ) : null}
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h2>Evidencias</h2>
              <span>{t.evidencias.length} archivo(s)</span>
            </div>
            <div className="panel__body">
              {t.evidencias.length ? (
                <div className="evidencias">
                  {t.evidencias.map((ev: any) => (
                    <div className="evidencia" key={ev.id_evidencia}>
                      <span className="evidencia__icono">
                        <Icon name="clip" />
                      </span>
                      <div className="evidencia__info">
                        <strong>{ev.nombre_archivo}</strong>
                        <span>
                          {fmtBytes(ev.tamano_bytes)} · {ev.cargado_por} · {fmtFecha(ev.fecha_carga)}
                        </span>
                        <span className="hash">sha256: {String(ev.hash_sha256).slice(0, 16)}…</span>
                      </div>
                      <div className="evidencia__acciones">
                        <button
                          type="button"
                          className="btn btn--pequeno btn--fantasma"
                          onClick={() =>
                            API.tickets
                              .descargarEvidencia(t.id_ticket, ev.id_evidencia, ev.nombre_archivo)
                              .catch((err: any) =>
                                toast(err?.message || 'No se pudo descargar', 'error'),
                              )
                          }
                        >
                          <Icon name="descargar" /> Descargar
                        </button>
                        {staff && (
                          <button
                            type="button"
                            className={`btn btn--pequeno ${
                              ev.en_cuarentena ? 'btn--azul' : 'btn--fantasma'
                            }`}
                            onClick={() => cambiarCuarentena(ev)}
                          >
                            {ev.en_cuarentena ? 'Liberar' : 'A cuarentena'}
                          </button>
                        )}
                        {ev.en_cuarentena ? (
                          <span className="badge badge--ambar">Cuarentena</span>
                        ) : (
                          <span className="badge badge--verde">Liberada</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="texto-dim" style={{ fontSize: 11.5 }}>
                  Sin archivos adjuntos.
                </p>
              )}
              {t.estado !== 'Cerrado' && (
                <form onSubmit={subirEvidencias} style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      className="input"
                      type="file"
                      multiple
                      required
                      ref={archivosRef}
                      style={{ flex: 1, minWidth: 200 }}
                    />
                    <button className="btn btn--fantasma" type="submit">
                      <Icon name="clip" /> Subir
                    </button>
                  </div>
                  <p className="campo__ayuda">
                    Todo archivo nuevo entra en cuarentena preventiva hasta que el personal lo
                    libere.
                  </p>
                </form>
              )}
            </div>
          </div>

          <div className="panel" id="conversacion">
            <div className="panel__head">
              <h2>Conversación</h2>
              <span>{t.comentarios.length} mensaje(s)</span>
            </div>
            <div className="panel__body">
              {t.comentarios.length ? (
                <div className="comentarios">
                  {t.comentarios.map((c: any) => (
                    <div
                      className={`comentario ${c.interno ? 'comentario--interno' : ''}`}
                      key={c.id_comentario}
                    >
                      <span className="comentario__avatar">
                        {String(c.usuario || '?').charAt(0).toUpperCase()}
                      </span>
                      <div className="comentario__cuerpo">
                        <div className="comentario__head">
                          <strong>{c.usuario}</strong>
                          <span
                            className={`badge ${
                              c.rol === 'Administrador'
                                ? 'badge--violeta'
                                : c.rol === 'Analista L1'
                                  ? 'badge--azul'
                                  : 'badge--gris'
                            }`}
                          >
                            {c.rol}
                          </span>
                          {c.interno && <span className="badge badge--ambar">Nota interna</span>}
                          <time>{fmtFecha(c.fecha)}</time>
                        </div>
                        <p className="comentario__texto">{c.contenido}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="texto-dim" style={{ fontSize: 11.5 }}>
                  Aún no hay comentarios.
                </p>
              )}
              {t.estado !== 'Cerrado' && (
                <form onSubmit={enviarComentario} style={{ marginTop: 14 }}>
                  {staff && (
                    <div className="plantillas__lista" style={{ marginBottom: 10 }}>
                      {PLANTILLAS_COMENTARIO.map((p) => (
                        <button
                          type="button"
                          className="plantilla-chip"
                          key={p.id}
                          onClick={() =>
                            setComentario((v) => (v.trim() ? `${v.trim()}\n\n${p.texto}` : p.texto))
                          }
                        >
                          {p.titulo}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="campo">
                    <textarea
                      className="textarea"
                      required
                      maxLength={4000}
                      placeholder={
                        staff
                          ? 'Escribe una respuesta al solicitante o una nota interna…'
                          : 'Agrega información adicional…'
                      }
                      style={{ minHeight: 90 }}
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    {staff ? (
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={interno}
                          onChange={(e) => setInterno(e.target.checked)}
                        />{' '}
                        Nota interna (solo staff)
                      </label>
                    ) : (
                      <span />
                    )}
                    <button className="btn btn--pequeno btn--primario" type="submit" disabled={enviando}>
                      Enviar comentario
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="detalle__lado">
          <div className="panel">
            <div className="panel__head">
              <h2>SLA de resolución</h2>
            </div>
            <div className="panel__body">
              <div className="caja-sla">
                <small>{finalizado ? 'Resultado del SLA' : 'Tiempo restante'}</small>
                {finalizado ? (
                  <>
                    <strong className="sla--final">
                      ✓ {t.estado === 'Cerrado' ? 'Cerrado' : 'Resuelto'}
                    </strong>
                    <span>
                      {t.fecha_resolucion
                        ? `Finalizado el ${fmtFecha(t.fecha_resolucion)}`
                        : 'Caso finalizado'}
                    </span>
                  </>
                ) : t.sla_pausado ? (
                  <>
                    <strong className="sla--pausa">⏸ Pausado</strong>
                    <span>Vence {fmtFecha(t.sla_vencimiento_resolucion)}</span>
                  </>
                ) : (
                  <>
                    <strong>
                      <Sla
                        fin={t.sla_vencimiento_resolucion}
                        pausado={t.sla_pausado}
                        estado={t.estado}
                      />
                    </strong>
                    <span>Vence {fmtFecha(t.sla_vencimiento_resolucion)}</span>
                  </>
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="ficha-dato">
                  <span>Estado</span>
                  <strong>
                    <EstadoBadge estado={t.estado} />
                  </strong>
                </div>
                <div className="ficha-dato">
                  <span>Urgencia</span>
                  <strong>
                    <UrgenciaBadge urgencia={t.urgencia} />
                  </strong>
                </div>
                <div className="ficha-dato">
                  <span>Categoría</span>
                  <strong>{t.categoria}</strong>
                </div>
                <div className="ficha-dato">
                  <span>Nivel</span>
                  <strong>{t.nivel_escalamiento}</strong>
                </div>
                <div className="ficha-dato">
                  <span>Primera respuesta</span>
                  <strong>
                    {t.fecha_primera_respuesta ? fmtFecha(t.fecha_primera_respuesta) : 'Pendiente'}
                  </strong>
                </div>
                <div className="ficha-dato">
                  <span>Resolución</span>
                  <strong>{t.fecha_resolucion ? fmtFecha(t.fecha_resolucion) : 'Pendiente'}</strong>
                </div>
                {staff && (
                  <>
                    <div className="ficha-dato">
                      <span>Respuesta SLA</span>
                      <strong>
                        {t.sla_respuesta_incumplido ? (
                          <span style={{ color: 'var(--red)' }}>Incumplido</span>
                        ) : (
                          'En regla'
                        )}
                      </strong>
                    </div>
                    <div className="ficha-dato">
                      <span>Resolución SLA</span>
                      <strong>
                        {t.sla_resolucion_incumplido ? (
                          <span style={{ color: 'var(--red)' }}>Incumplido</span>
                        ) : (
                          'En regla'
                        )}
                      </strong>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h2>Personas</h2>
            </div>
            <div className="panel__body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span className="avatar" style={{ width: 34, height: 34 }}>
                  {String(t.solicitante?.nombre || '?').charAt(0).toUpperCase()}
                </span>
                <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <strong style={{ fontSize: 12 }}>
                    {t.solicitante?.nombre || ''} {t.solicitante?.apellido || ''}
                  </strong>
                  <span className="texto-dim" style={{ fontSize: 10 }}>
                    Solicitante · {t.solicitante?.email || ''}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  className="avatar"
                  style={{ width: 34, height: 34, opacity: t.analista ? 1 : 0.4 }}
                >
                  {t.analista ? String(t.analista.nombre || '?').charAt(0).toUpperCase() : '—'}
                </span>
                <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <strong style={{ fontSize: 12 }}>
                    {t.analista ? `${t.analista.nombre} ${t.analista.apellido}` : 'Sin asignar'}
                  </strong>
                  <span className="texto-dim" style={{ fontSize: 10 }}>
                    Analista responsable
                  </span>
                </div>
              </div>
              {analistas.length ? (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                  <label className="campo__label" htmlFor={`reasignar-${t.id_ticket}`}>
                    Reasignar analista
                  </label>
                  <select
                    className="select"
                    id={`reasignar-${t.id_ticket}`}
                    value={t.id_analista_asignado || ''}
                    onChange={(e) => asignar(e.target.value)}
                  >
                    <option value="" disabled>
                      Selecciona un analista…
                    </option>
                    {analistas.map((a) => (
                      <option value={a.id_usuario} key={a.id_usuario}>
                        {a.nombre} {a.apellido} · {a.rol}
                      </option>
                    ))}
                  </select>
                  <span className="campo__ayuda">
                    Solo administradores. El nuevo responsable recibe una notificación.
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h2>Historial</h2>
              <span>{t.historial.length}</span>
            </div>
            <div className="panel__body">
              {t.historial.length ? (
                <div className="timeline">
                  {t.historial.map((h: any) => (
                    <div className="evento" key={h.id_historial}>
                      <span className="evento__punto">
                        <Icon name={ACCION_ICONO[h.accion] || 'flecha'} />
                      </span>
                      <div className="evento__cuerpo">
                        <strong>
                          {ACCION_TEXTO[h.accion] || h.accion}
                          {h.estado_anterior ? ` · ${h.estado_anterior} → ${h.estado_nuevo}` : ''}
                        </strong>
                        {h.detalle ? <p>{h.detalle}</p> : null}
                        <time>
                          {fmtFecha(h.fecha)}
                          {h.usuario ? ` · ${h.usuario}` : ''}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="texto-dim" style={{ fontSize: 11.5 }}>
                  Sin eventos.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
