'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { Icon } from './Icon';
import { Boot } from './ui';
import { API } from '@/lib/api';
import { hace, iniciales } from '@/lib/format';

const TITULOS: Record<string, string> = {
  dashboard: 'Tablero',
  nuevo: 'Nuevo ticket',
  mis: 'Mis tickets',
  triaje: 'Triaje y cola',
  ticket: 'Detalle de ticket',
  kedb: 'Base de conocimiento',
  admin: 'Administración',
  perfil: 'Mi perfil',
};

export function Shell({ children }: { children: React.ReactNode }) {
  const { usuario, cargando, salir } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [panel, setPanel] = useState(false);
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const derechaRef = useRef<HTMLDivElement | null>(null);

  const esStaff = ['Analista L1', 'Administrador'].includes(usuario?.rol || '');
  const esAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (!cargando && !usuario) router.replace('/app');
  }, [cargando, usuario, router]);

  useEffect(() => {
    setMenuAbierto(false);
    setPanel(false);
  }, [pathname]);

  useEffect(() => {
    const base = pathname.split('/')[1] || 'dashboard';
    document.title = `Nexo · ${TITULOS[base] || 'Mesa de ayuda'}`;
  }, [pathname]);

  const cargarNotificaciones = useCallback(async () => {
    if (!usuario) return;
    try {
      const r: any = await API.notificaciones.listar();
      setNotificaciones(r.notificaciones || []);
      setNoLeidas(Number(r.no_leidas) || 0);
    } catch {
      /* la sesión no debe interrumpirse por una notificación */
    }
  }, [usuario]);

  useEffect(() => {
    cargarNotificaciones();
    const id = setInterval(cargarNotificaciones, 30000);
    return () => clearInterval(id);
  }, [cargarNotificaciones, pathname]);

  useEffect(() => {
    if (!panel) return;
    const fuera = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('#panel-notif') || e.target.closest('[data-notificaciones]')) return;
      setPanel(false);
    };
    document.addEventListener('click', fuera);
    return () => document.removeEventListener('click', fuera);
  }, [panel]);

  const abrirNotificacion = async (n: any) => {
    try {
      if (!n.leida) await API.notificaciones.leer(n.id_notificacion);
    } catch {
      /* pudo marcarse antes */
    }
    setPanel(false);
    await cargarNotificaciones();
    if (n.id_ticket) router.push(`/ticket/${n.id_ticket}`);
  };

  const leerTodas = async () => {
    try {
      await API.notificaciones.leerTodas();
      await cargarNotificaciones();
    } catch {
      /* silencio */
    }
  };

  const cerrarSesion = () => {
    salir();
    router.replace('/app');
  };

  if (cargando || !usuario) return <Boot />;

  const activo = (base: string) => pathname === base || pathname.startsWith(`${base}/`);

  return (
    <div className="app">
      <aside className={`sidebar ${menuAbierto ? 'abierto' : ''}`}>
        <div className="sidebar__marca">
          <Link className="marca" href="/dashboard">
            <span className="marca__icono">
              <span />
              <span />
              <span />
            </span>
            Nexo<b>.</b>
          </Link>
        </div>

        <div className="sidebar__seccion">
          <div className="sidebar__titulo">Operación</div>
          <nav className="sidebar__nav">
            <Link className={`nav-item ${activo('/dashboard') ? 'activo' : ''}`} href="/dashboard">
              <Icon name="panel" /> Tablero
            </Link>
            {!esAdmin && (
              <>
                <Link className={`nav-item ${activo('/nuevo') ? 'activo' : ''}`} href="/nuevo">
                  <Icon name="nuevo" /> Nuevo ticket
                </Link>
                <Link className={`nav-item ${activo('/mis') ? 'activo' : ''}`} href="/mis">
                  <Icon name="lista" /> Mis tickets
                </Link>
              </>
            )}
            {esStaff && (
              <Link className={`nav-item ${activo('/triaje') ? 'activo' : ''}`} href="/triaje">
                <Icon name="escudo" /> Triaje y cola
              </Link>
            )}
          </nav>
        </div>

        <div className="sidebar__seccion">
          <div className="sidebar__titulo">Recursos</div>
          <nav className="sidebar__nav">
            <Link className={`nav-item ${activo('/kedb') ? 'activo' : ''}`} href="/kedb">
              <Icon name="libro" /> Base de conocimiento
            </Link>
          </nav>
        </div>

        {esAdmin && (
          <div className="sidebar__seccion">
            <div className="sidebar__titulo">Administración</div>
            <nav className="sidebar__nav">
              <Link className={`nav-item ${activo('/admin') ? 'activo' : ''}`} href="/admin/seguimiento">
                <Icon name="ajustes" /> Consola de administración
              </Link>
            </nav>
          </div>
        )}

        <div className="sidebar__pie">
          <a className="nav-item" href="/presentacion.html">
            <Icon name="panel" /> Presentación
          </a>
          <Link className={`nav-item ${activo('/perfil') ? 'activo' : ''}`} href="/perfil">
            <Icon name="usuario" /> Mi perfil
          </Link>
          <button type="button" className="nav-item" onClick={cerrarSesion}>
            <Icon name="salir" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn topbar__menu"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label="Abrir menú"
          >
            <Icon name="menu" />
          </button>
          <div className="topbar__contexto">
            <strong>
              {usuario.nombre} {usuario.apellido}
            </strong>
            <span>{usuario.rol} · Sesión segura</span>
          </div>
          <div className="topbar__derecha" ref={derechaRef}>
            <button
              type="button"
              className="icon-btn"
              data-notificaciones
              onClick={() => setPanel((v) => !v)}
              aria-label="Notificaciones"
            >
              <Icon name="campana" />
              <span className="badge-punto" id="badge-notif" hidden={noLeidas === 0}>
                {noLeidas > 99 ? '99+' : noLeidas}
              </span>
            </button>
            <div id="panel-notif">
              {panel && (
                <div className="notif-panel">
                  <div className="notif-panel__head">
                    <strong>Notificaciones</strong>
                    <button type="button" onClick={leerTodas}>
                      Marcar todas
                    </button>
                  </div>
                  <div className="notif-lista">
                    {notificaciones.length ? (
                      notificaciones.map((n) => (
                        <div
                          key={n.id_notificacion}
                          className={`notif ${n.leida ? '' : 'notif--nueva'}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => abrirNotificacion(n)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') abrirNotificacion(n);
                          }}
                        >
                          <span className="notif__marca" />
                          <div className="notif__cuerpo">
                            <strong>{n.titulo}</strong>
                            <p>{n.mensaje}</p>
                            <time>{hace(n.fecha)}</time>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty" style={{ padding: '30px 16px' }}>
                        <strong>Sin notificaciones</strong>
                        <p>Aquí verás los avisos de tus tickets.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button type="button" className="user-chip" onClick={() => router.push('/perfil')}>
              <span className="avatar">{iniciales(usuario.nombre, usuario.apellido)}</span>
              <span className="user-chip__texto">
                <strong>{usuario.nombre}</strong>
                <span>{usuario.rol}</span>
              </span>
            </button>
          </div>
        </header>
        <main className="vista">{children}</main>
      </div>
    </div>
  );
}
