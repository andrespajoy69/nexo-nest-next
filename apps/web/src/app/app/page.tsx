'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { Boot } from '@/components/ui';

export default function IngresarPage() {
  const { usuario, cargando, login, registro } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'registro'>('login');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    document.title = 'Nexo · Ingresar';
  }, []);

  useEffect(() => {
    if (!cargando && usuario) router.replace('/dashboard');
  }, [cargando, usuario, router]);

  if (cargando || usuario) return <Boot />;

  const enviarLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    setEnviando(true);
    try {
      const u = await login(email, password);
      toast(`Bienvenido, ${u.nombre}`);
      router.replace('/dashboard');
    } catch (err: any) {
      toast(err?.message || 'No se pudo iniciar sesión', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const enviarRegistro = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (form.get('password') !== form.get('confirmar')) {
      toast('Las contraseñas no coinciden', 'error');
      return;
    }
    setEnviando(true);
    try {
      await registro({
        nombre: String(form.get('nombre') || '').trim(),
        apellido: String(form.get('apellido') || '').trim(),
        email: String(form.get('email') || '').trim(),
        password: String(form.get('password') || ''),
      });
      toast('Cuenta creada correctamente');
      router.replace('/dashboard');
    } catch (err: any) {
      toast(err?.message || 'No se pudo crear la cuenta', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="auth">
      <aside className="auth__side">
        <div className="marca">
          <span className="marca__icono">
            <span />
            <span />
            <span />
          </span>
          Nexo<b>.</b>
        </div>
        <div className="auth__contenido">
          <span className="auth__eyebrow">
            <span className="auth__punto" />
            Mesa de ayuda · Ciberseguridad
          </span>
          <h1>
            El <span>embudo inteligente</span> para tus incidentes de TI.
          </h1>
          <p>
            Un único canal para reportar solicitudes operativas y amenazas de seguridad, con triaje
            automático y priorización por semáforo en tiempo real.
          </p>
          <div className="auth__puntos">
            <div className="auth__punto-item">
              <i>✓</i>
              <span>Motor de triaje que eleva la urgencia ante palabras clave de riesgo.</span>
            </div>
            <div className="auth__punto-item">
              <i>✓</i>
              <span>Cola priorizada por semáforo y contador de SLA visible.</span>
            </div>
            <div className="auth__punto-item">
              <i>✓</i>
              <span>Escalado a L2/SOC en un clic, con historial y evidencias.</span>
            </div>
            <div className="auth__punto-item">
              <i>✓</i>
              <span>Archivos adjuntos aislados en cuarentena preventiva.</span>
            </div>
          </div>
        </div>
        <div className="auth__pie">
          <span>© 2026 Nexo</span>
          <span>MVP · Facultad de Ingeniería</span>
        </div>
      </aside>

      <section className="auth__panel">
        <div className="auth__form">
          <div className="marca">
            <span className="marca__icono">
              <span />
              <span />
              <span />
            </span>
            Nexo<b>.</b>
          </div>
          <h2>Bienvenido de nuevo</h2>
          <p>Ingresa con tu cuenta corporativa para gestionar tus solicitudes de soporte.</p>

          <div className="tabs">
            <button
              type="button"
              className={tab === 'login' ? 'activo' : ''}
              onClick={() => setTab('login')}
            >
              Ingresar
            </button>
            <button
              type="button"
              className={tab === 'registro' ? 'activo' : ''}
              onClick={() => setTab('registro')}
            >
              Crear cuenta
            </button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={enviarLogin} autoComplete="on">
              <div className="campo">
                <label className="campo__label" htmlFor="login-email">
                  Correo electrónico
                </label>
                <input className="input" id="login-email" name="email" type="email" required />
              </div>
              <div className="campo">
                <label className="campo__label" htmlFor="login-password">
                  Contraseña
                </label>
                <input
                  className="input"
                  id="login-password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button className="btn btn--primario btn--bloque" type="submit" disabled={enviando}>
                {enviando ? 'Ingresando…' : 'Ingresar a Nexo'}
              </button>
            </form>
          ) : (
            <form onSubmit={enviarRegistro} autoComplete="on">
              <div className="fila">
                <div className="campo">
                  <label className="campo__label" htmlFor="reg-nombre">
                    Nombre <span>*</span>
                  </label>
                  <input className="input" id="reg-nombre" name="nombre" required maxLength={100} />
                </div>
                <div className="campo">
                  <label className="campo__label" htmlFor="reg-apellido">
                    Apellido
                  </label>
                  <input className="input" id="reg-apellido" name="apellido" maxLength={100} />
                </div>
              </div>
              <div className="campo">
                <label className="campo__label" htmlFor="reg-email">
                  Correo electrónico <span>*</span>
                </label>
                <input className="input" id="reg-email" name="email" type="email" required />
              </div>
              <div className="campo">
                <label className="campo__label" htmlFor="reg-password">
                  Contraseña <span>*</span>
                </label>
                <input
                  className="input"
                  id="reg-password"
                  name="password"
                  type="password"
                  minLength={6}
                  required
                />
                <span className="campo__ayuda">Mínimo 6 caracteres.</span>
              </div>
              <div className="campo">
                <label className="campo__label" htmlFor="reg-confirmar">
                  Repetir contraseña <span>*</span>
                </label>
                <input
                  className="input"
                  id="reg-confirmar"
                  name="confirmar"
                  type="password"
                  minLength={6}
                  required
                />
              </div>
              <button className="btn btn--primario btn--bloque" type="submit" disabled={enviando}>
                {enviando ? 'Creando cuenta…' : 'Crear mi cuenta'}
              </button>
            </form>
          )}

          <a className="auth__volver" href="/">
            ← Volver a la presentación
          </a>
        </div>
      </section>
    </div>
  );
}
