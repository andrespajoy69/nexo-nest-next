'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ToastProvider';
import { Cargando } from '@/components/ui';
import { API, guardarSesion, tokenGuardado } from '@/lib/api';
import { iniciales } from '@/lib/format';
import { useTitulo } from '@/lib/useTitulo';

function rolTexto(rol: string) {
  if (rol === 'Administrador') {
    return 'Administrador · acceso total a la consola, usuarios, SLA y auditoría.';
  }
  if (rol === 'Analista L1') {
    return 'Analista L1 · triaje, atención de la cola y escalado a L2/SOC.';
  }
  return 'Usuario · creación y seguimiento de solicitudes propias.';
}

export default function PerfilPage() {
  const { usuario, actualizarUsuario } = useAuth();
  const { toast } = useToast();
  useTitulo('Mi perfil');

  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  if (!usuario) return <Cargando />;

  const guardarPerfil = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nombre = String(form.get('nombre') || '').trim();
    const apellido = String(form.get('apellido') || '').trim();
    const telefono = String(form.get('telefono') || '').trim();
    if (!nombre) {
      toast('El nombre es obligatorio', 'error');
      return;
    }
    setGuardandoPerfil(true);
    try {
      await API.auth.perfil({ nombre, apellido, telefono });
      const actualizado = { ...usuario, nombre, apellido, telefono: telefono || null };
      actualizarUsuario(actualizado);
      guardarSesion(tokenGuardado(), actualizado);
      toast('Perfil actualizado');
    } catch (err: any) {
      toast(err?.message || 'No se pudo actualizar el perfil', 'error');
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const cambiarPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    const actual = String(datos.get('actual') || '');
    const nueva = String(datos.get('nueva') || '');
    if (nueva.length < 6) {
      toast('La nueva contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }
    setGuardandoPassword(true);
    try {
      await API.auth.password(actual, nueva);
      form.reset();
      toast('Contraseña actualizada');
    } catch (err: any) {
      toast(err?.message || 'No se pudo cambiar la contraseña', 'error');
    } finally {
      setGuardandoPassword(false);
    }
  };

  return (
    <>
      <div className="pagina-head">
        <div className="pagina-head__texto">
          <span className="eyebrow">Cuenta</span>
          <h1>Mi perfil</h1>
          <p>Actualiza tus datos de contacto y la contraseña de acceso.</p>
        </div>
      </div>

      <div className="dos-columnas">
        <div className="panel">
          <div className="panel__head">
            <h2>Datos personales</h2>
            <span>{usuario.rol}</span>
          </div>
          <div className="panel__body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 20 }}>
              <span className="avatar" style={{ width: 46, height: 46, fontSize: 15 }}>
                {iniciales(usuario.nombre, usuario.apellido)}
              </span>
              <div style={{ display: 'grid', gap: 3 }}>
                <strong style={{ fontSize: 14 }}>
                  {usuario.nombre} {usuario.apellido}
                </strong>
                <span className="texto-dim" style={{ fontSize: 11 }}>
                  {usuario.email}
                </span>
              </div>
            </div>
            <form onSubmit={guardarPerfil}>
              <div className="fila">
                <div className="campo">
                  <label className="campo__label" htmlFor="perfil-nombre">
                    Nombre
                  </label>
                  <input
                    className="input"
                    id="perfil-nombre"
                    name="nombre"
                    defaultValue={usuario.nombre}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="campo">
                  <label className="campo__label" htmlFor="perfil-apellido">
                    Apellido
                  </label>
                  <input
                    className="input"
                    id="perfil-apellido"
                    name="apellido"
                    defaultValue={usuario.apellido}
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="fila">
                <div className="campo">
                  <label className="campo__label">Correo electrónico</label>
                  <input className="input" value={usuario.email} disabled />
                  <span className="campo__ayuda">
                    El correo solo puede cambiarlo un administrador.
                  </span>
                </div>
                <div className="campo">
                  <label className="campo__label" htmlFor="perfil-telefono">
                    Teléfono
                  </label>
                  <input
                    className="input"
                    id="perfil-telefono"
                    name="telefono"
                    defaultValue={usuario.telefono || ''}
                    maxLength={30}
                  />
                </div>
              </div>
              <button className="btn btn--primario" type="submit" disabled={guardandoPerfil}>
                {guardandoPerfil ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h2>Seguridad</h2>
            <span>contraseña</span>
          </div>
          <div className="panel__body">
            <form onSubmit={cambiarPassword}>
              <div className="campo">
                <label className="campo__label" htmlFor="password-actual">
                  Contraseña actual
                </label>
                <input
                  className="input"
                  id="password-actual"
                  type="password"
                  name="actual"
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="campo">
                <label className="campo__label" htmlFor="password-nueva">
                  Nueva contraseña
                </label>
                <input
                  className="input"
                  id="password-nueva"
                  type="password"
                  name="nueva"
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
                <span className="campo__ayuda">
                  Mínimo 6 caracteres. Usa una combinación difícil de adivinar.
                </span>
              </div>
              <button className="btn btn--fantasma" type="submit" disabled={guardandoPassword}>
                <Icon name="llave" /> {guardandoPassword ? 'Cambiando…' : 'Cambiar contraseña'}
              </button>
            </form>

            <div className="dato" style={{ marginTop: 22 }}>
              <dt>Rol en la plataforma</dt>
              <dd>{rolTexto(usuario.rol)}</dd>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
