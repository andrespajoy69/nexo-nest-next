'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useModal } from '@/components/ModalProvider';
import { useToast } from '@/components/ToastProvider';
import { Icon } from '@/components/Icon';
import { API } from '@/lib/api';
import { CATEGORIAS, PLANTILLAS_NUEVO, URGENCIAS } from '@/lib/constants';
import { useTitulo } from '@/lib/useTitulo';

type Borrador = {
  categoria: string;
  asunto: string;
  descripcion: string;
  urgencia: string;
  datos: Record<string, string>;
  fecha: number;
};

export default function NuevoTicketPage() {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const { abrirModal, cerrarModal } = useModal();
  const router = useRouter();
  useTitulo('Nuevo ticket');

  const [categoria, setCategoria] = useState('TI General');
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [urgencia, setUrgencia] = useState('Media');
  const [datos, setDatos] = useState<Record<string, string>>({});
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const [estadoBorrador, setEstadoBorrador] = useState('los campos con * son obligatorios');
  const [enviando, setEnviando] = useState(false);
  const archivosRef = useRef<HTMLInputElement | null>(null);
  const montado = useRef(false);

  const claveBorrador = `nexo_borrador_nuevo_${usuario?.id_usuario || 'anon'}`;
  const campoDato = (clave: string) => ({
    value: datos[clave] || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDatos((prev) => ({ ...prev, [clave]: e.target.value })),
  });

  useEffect(() => {
    if (!usuario) return;
    try {
      const raw = localStorage.getItem(claveBorrador);
      if (!raw) return;
      const borrador: Borrador = JSON.parse(raw);
      if (!borrador.fecha || Date.now() - borrador.fecha > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(claveBorrador);
        return;
      }
      setCategoria(CATEGORIAS.includes(borrador.categoria) ? borrador.categoria : 'TI General');
      setAsunto(borrador.asunto || '');
      setDescripcion(borrador.descripcion || '');
      if (URGENCIAS.includes(borrador.urgencia)) setUrgencia(borrador.urgencia);
      setDatos(borrador.datos || {});
      setBorradorRestaurado(true);
      setEstadoBorrador('Borrador restaurado');
    } catch {
      /* almacenamiento no disponible */
    }
    montado.current = true;
  }, [usuario, claveBorrador]);

  useEffect(() => {
    if (!usuario || !montado.current) return;
    const timer = setTimeout(() => {
      const tieneContenido = Boolean(asunto.trim() || descripcion.trim() || Object.keys(datos).length);
      try {
        if (tieneContenido) {
          localStorage.setItem(
            claveBorrador,
            JSON.stringify({ categoria, asunto, descripcion, urgencia, datos, fecha: Date.now() }),
          );
          setEstadoBorrador('Borrador guardado automáticamente');
        } else {
          localStorage.removeItem(claveBorrador);
          setEstadoBorrador('Sin borrador guardado');
        }
      } catch {
        setEstadoBorrador('No se pudo guardar el borrador');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [usuario, claveBorrador, categoria, asunto, descripcion, urgencia, datos]);

  useEffect(() => {
    const q = `${asunto} ${descripcion}`.trim();
    if (q.length < 4) {
      setSugerencias([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r: any = await API.kedb.sugerencias(q, categoria);
        setSugerencias(r || []);
      } catch {
        /* sin ruido */
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [asunto, descripcion, categoria]);

  const aplicarPlantilla = (id: string) => {
    const p = PLANTILLAS_NUEVO.find((x) => x.id === id);
    if (!p) return;
    setCategoria(p.categoria);
    setAsunto(p.asunto);
    setDescripcion(p.descripcion);
    setUrgencia(p.urgencia);
    toast(`Plantilla aplicada: ${p.titulo}`);
  };

  const descartarBorrador = () => {
    try {
      localStorage.removeItem(claveBorrador);
    } catch {
      /* almacenamiento no disponible */
    }
    setCategoria('TI General');
    setAsunto('');
    setDescripcion('');
    setUrgencia('Media');
    setDatos({});
    setBorradorRestaurado(false);
    setEstadoBorrador('Sin borrador guardado');
    if (archivosRef.current) archivosRef.current.value = '';
    toast('Borrador descartado');
  };

  const verArticulo = async (id: number) => {
    try {
      const a: any = await API.kedb.obtener(id);
      abrirModal({
        titulo: a.titulo,
        ancha: true,
        cuerpo: (
          <>
            <div className="detalle__meta" style={{ marginBottom: 14 }}>
              <span
                className={`badge ${
                  a.categoria === 'Ciberseguridad'
                    ? 'badge--rojo'
                    : a.categoria === 'TI General'
                      ? 'badge--azul'
                      : 'badge--gris'
                }`}
              >
                {a.categoria}
              </span>
              <span className="pill">{Number(a.vistas) || 0} lecturas</span>
            </div>
            <p className="descripcion">{a.contenido}</p>
            {a.palabras_clave ? (
              <p className="campo__ayuda" style={{ marginTop: 16 }}>
                Palabras clave: {a.palabras_clave}
              </p>
            ) : null}
            <div className="modal__foot" style={{ padding: '16px 0 0' }}>
              <button type="button" className="btn btn--fantasma" onClick={cerrarModal}>
                Cerrar
              </button>
            </div>
          </>
        ),
      });
    } catch (err: any) {
      toast(err?.message || 'No se pudo abrir el artículo', 'error');
    }
  };

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!asunto.trim() || !descripcion.trim()) {
      toast('Completa el asunto y la descripción', 'error');
      return;
    }
    setEnviando(true);
    try {
      const datosLimpios = Object.fromEntries(
        Object.entries(datos).filter(([, valor]) => String(valor).trim()),
      );
      const r: any = await API.tickets.crear({
        asunto: asunto.trim(),
        descripcion: descripcion.trim(),
        categoria,
        urgencia,
        datos_especificos: Object.keys(datosLimpios).length ? datosLimpios : null,
      });
      try {
        localStorage.removeItem(claveBorrador);
      } catch {
        /* almacenamiento no disponible */
      }
      const archivos = archivosRef.current?.files;
      if (archivos?.length) {
        try {
          await API.tickets.subirEvidencias(r.id_ticket, archivos);
        } catch (err: any) {
          toast(`Ticket creado, pero no se subieron las evidencias: ${err.message}`, 'error');
          router.push(`/ticket/${r.id_ticket}`);
          return;
        }
      }
      const ajuste = r.prioridad_auto ? ' El triaje automático elevó la urgencia.' : '';
      toast(`Ticket ${r.codigo} creado con urgencia ${r.urgencia}.${ajuste}`);
      router.push(`/ticket/${r.id_ticket}`);
    } catch (err: any) {
      toast(err?.message || 'No se pudo crear el ticket', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="pagina-head">
        <div className="pagina-head__texto">
          <span className="eyebrow">Radicación de solicitudes</span>
          <h1>Nuevo ticket</h1>
          <p>
            Cuéntanos qué necesitas. El motor de triaje ajustará la urgencia si detecta riesgos de
            seguridad.
          </p>
        </div>
      </div>

      <form className="form-dos" onSubmit={enviar} noValidate>
        <div className="panel">
          <div className="panel__head">
            <h2>Detalle de la solicitud</h2>
            <span aria-live="polite">{estadoBorrador}</span>
          </div>
          <div className="panel__body">
            {borradorRestaurado && (
              <div className="borrador-aviso">
                <span>
                  <Icon name="check" /> Restauramos tu borrador anterior.
                </span>
                <button
                  type="button"
                  className="btn btn--pequeno btn--fantasma"
                  onClick={descartarBorrador}
                >
                  Descartar borrador
                </button>
              </div>
            )}

            <div className="plantillas">
              <span className="plantillas__label">
                Atajos para empezar · elige el caso más parecido y ajusta los datos
              </span>
              <div className="plantillas__lista">
                {PLANTILLAS_NUEVO.map((p) => (
                  <button
                    type="button"
                    className="plantilla-chip"
                    key={p.id}
                    onClick={() => aplicarPlantilla(p.id)}
                  >
                    {p.titulo}
                  </button>
                ))}
              </div>
            </div>

            <div className="categorias">
              <button
                type="button"
                className={`categoria-opcion ${categoria === 'TI General' ? 'activa' : ''}`}
                onClick={() => setCategoria('TI General')}
              >
                <span className="categoria-opcion__radio" />
                <strong>TI General</strong>
                <span>Soporte operativo: equipos, red, software, accesos.</span>
              </button>
              <button
                type="button"
                className={`categoria-opcion categoria-opcion--ciber ${
                  categoria === 'Ciberseguridad' ? 'activa' : ''
                }`}
                onClick={() => setCategoria('Ciberseguridad')}
              >
                <span className="categoria-opcion__radio" />
                <strong>Ciberseguridad</strong>
                <span>Reporta phishing, malware, accesos no autorizados o eventos sospechosos.</span>
              </button>
            </div>

            <div className="campo">
              <label className="campo__label" htmlFor="nt-asunto">
                Asunto <span>*</span>
              </label>
              <input
                className="input"
                id="nt-asunto"
                name="asunto"
                maxLength={200}
                required
                placeholder="Resumen breve del problema"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
              />
              <span className="campo__ayuda campo__ayuda--fila">
                <span>Un título claro ayuda a priorizar mejor.</span>
                <span>
                  <b>{asunto.length}</b>/200
                </span>
              </span>
            </div>

            <div className="campo">
              <label className="campo__label" htmlFor="nt-descripcion">
                Descripción detallada <span>*</span>
              </label>
              <textarea
                className="textarea"
                id="nt-descripcion"
                name="descripcion"
                required
                maxLength={4000}
                placeholder="¿Qué ocurrió? ¿Cuándo empezó? ¿Qué sistemas o personas están involucrados?"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
              <span className="campo__ayuda campo__ayuda--fila">
                <span>Incluye qué ocurrió, desde cuándo y qué equipo o persona está afectado.</span>
                <span>
                  <b>{descripcion.length}</b>/4000
                </span>
              </span>
            </div>

            {categoria === 'Ciberseguridad' ? (
              <>
                <div className="fila">
                  <div className="campo">
                    <label className="campo__label">Vector del incidente</label>
                    <select className="select" {...campoDato('vector')}>
                      <option value="">Selecciona…</option>
                      <option>Phishing / correo sospechoso</option>
                      <option>Malware / ransomware</option>
                      <option>Acceso no autorizado</option>
                      <option>Suplantación de identidad</option>
                      <option>Enlace o sitio web fraudulento</option>
                      <option>Dispositivo desconocido</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div className="campo">
                    <label className="campo__label">Remitente o sitio involucrado</label>
                    <input
                      className="input"
                      maxLength={200}
                      placeholder="correo@dominio.com / sitio web"
                      {...campoDato('remitente')}
                    />
                  </div>
                </div>
                <div className="fila">
                  <div className="campo">
                    <label className="campo__label">Enlace sospechoso</label>
                    <input
                      className="input"
                      maxLength={500}
                      placeholder="https://…"
                      {...campoDato('enlace')}
                    />
                  </div>
                  <div className="campo">
                    <label className="campo__label">Fecha del evento</label>
                    <input className="input" type="datetime-local" {...campoDato('fecha')} />
                  </div>
                </div>
              </>
            ) : (
              <div className="fila">
                <div className="campo">
                  <label className="campo__label">Tipo de equipo o servicio</label>
                  <select className="select" {...campoDato('tipo')}>
                    <option value="">Selecciona…</option>
                    <option>Computador / portátil</option>
                    <option>Impresora o periférico</option>
                    <option>Red / conectividad</option>
                    <option>Software / aplicación</option>
                    <option>Correo institucional</option>
                    <option>Acceso y contraseñas</option>
                    <option>Otro</option>
                  </select>
                </div>
                <div className="campo">
                  <label className="campo__label">Ubicación o activo</label>
                  <input
                    className="input"
                    maxLength={200}
                    placeholder="Piso 2 · Impresora HP · Sala 3"
                    {...campoDato('ubicacion')}
                  />
                </div>
              </div>
            )}

            <div className="fila">
              <div className="campo">
                <label className="campo__label" htmlFor="nt-urgencia">
                  Urgencia percibida
                </label>
                <select
                  className="select"
                  id="nt-urgencia"
                  value={urgencia}
                  onChange={(e) => setUrgencia(e.target.value)}
                >
                  <option value="Baja">Baja · puedo esperar</option>
                  <option value="Media">Media · afecta mi trabajo</option>
                  <option value="Alta">Alta · bloquea mi operación</option>
                  <option value="Crítica">Crítica · riesgo de seguridad</option>
                </select>
                <span className="campo__ayuda">
                  La categoría Ciberseguridad sube automáticamente a Alta como mínimo.
                </span>
              </div>
              <div className="campo">
                <label className="campo__label" htmlFor="archivos-nuevo">
                  Evidencias (opcional)
                </label>
                <input
                  className="input"
                  id="archivos-nuevo"
                  name="archivos"
                  type="file"
                  multiple
                  ref={archivosRef}
                />
                <span className="campo__ayuda">
                  Hasta 5 archivos · 10 MB cada uno. Se guardan en cuarentena.
                </span>
              </div>
            </div>
          </div>

          <div className="modal__foot" style={{ borderTop: '1px solid var(--line)' }}>
            <Link className="btn btn--fantasma" href="/dashboard">
              Cancelar
            </Link>
            <button className="btn btn--primario" type="submit" disabled={enviando}>
              {enviando ? 'Registrando…' : 'Registrar ticket'}
            </button>
          </div>
        </div>

        <aside className="panel">
          <div className="panel__head">
            <h2>Base de conocimiento</h2>
            <span>sugerencias</span>
          </div>
          <div className="panel__body">
            <p className="campo__ayuda" style={{ marginBottom: 10 }}>
              Mientras escribes buscamos artículos de autoayuda relacionados. Tal vez puedas
              resolverlo sin crear el ticket.
            </p>
            {asunto.length + descripcion.length < 4 ? (
              <p className="texto-dim" style={{ fontSize: 11 }}>
                Escribe al menos 4 caracteres…
              </p>
            ) : sugerencias.length ? (
              <div className="sugerencias">
                {sugerencias.map((a) => (
                  <button
                    type="button"
                    className="sugerencia"
                    key={a.id_articulo}
                    onClick={() => verArticulo(a.id_articulo)}
                  >
                    <strong>{a.titulo}</strong>
                    <span>{a.extracto}…</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="texto-dim" style={{ fontSize: 11 }}>
                Sin artículos relacionados todavía.
              </p>
            )}
          </div>
        </aside>
      </form>
    </>
  );
}
