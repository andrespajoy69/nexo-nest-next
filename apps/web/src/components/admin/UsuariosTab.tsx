'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useModal } from '@/components/ModalProvider';
import { useToast } from '@/components/ToastProvider';
import { Cargando, ErrorPanel, RolBadge } from '@/components/ui';
import { API } from '@/lib/api';
import { fmtFecha } from '@/lib/format';

function FormUsuario({ usuario, onListo }: { usuario: any | null; onListo: () => void }) {
  const { toast } = useToast();
  const { cerrarModal } = useModal();
  const nuevo = !usuario;
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    const payload: any = {
      nombre: String(datos.get('nombre') || '').trim(),
      apellido: String(datos.get('apellido') || '').trim(),
      email: String(datos.get('email') || '').trim(),
      rol: String(datos.get('rol') || 'Usuario'),
      telefono: String(datos.get('telefono') || '').trim() || null,
    };
    setEnviando(true);
    try {
      if (nuevo) {
        payload.password = String(datos.get('password') || '');
        await API.admin.crearUsuario(payload);
        toast('Usuario creado');
      } else {
        payload.activo = Boolean(form.querySelector<HTMLInputElement>('input[name="activo"]')?.checked);
        await API.admin.editarUsuario(usuario.id_usuario, payload);
        toast('Usuario actualizado');
      }
      cerrarModal();
      onListo();
    } catch (err: any) {
      toast(err?.message || 'No se pudo guardar el usuario', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar}>
      <div className="fila">
        <div className="campo">
          <label className="campo__label">
            Nombre <span>*</span>
          </label>
          <input
            className="input"
            name="nombre"
            defaultValue={nuevo ? '' : usuario.nombre}
            required
            maxLength={100}
          />
        </div>
        <div className="campo">
          <label className="campo__label">Apellido</label>
          <input
            className="input"
            name="apellido"
            defaultValue={nuevo ? '' : usuario.apellido}
            maxLength={100}
          />
        </div>
      </div>
      <div className="campo">
        <label className="campo__label">
          Correo electrónico <span>*</span>
        </label>
        <input
          className="input"
          type="email"
          name="email"
          defaultValue={nuevo ? '' : usuario.email}
          required
        />
      </div>
      <div className="fila">
        <div className="campo">
          <label className="campo__label">
            Rol <span>*</span>
          </label>
          <select className="select" name="rol" defaultValue={nuevo ? 'Usuario' : usuario.rol}>
            {['Usuario', 'Analista L1', 'Administrador'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label className="campo__label">Teléfono</label>
          <input
            className="input"
            name="telefono"
            defaultValue={nuevo ? '' : usuario.telefono || ''}
            maxLength={30}
          />
        </div>
      </div>
      {nuevo ? (
        <div className="campo">
          <label className="campo__label">
            Contraseña inicial <span>*</span>
          </label>
          <input
            className="input"
            type="password"
            name="password"
            minLength={6}
            required
            autoComplete="new-password"
          />
          <span className="campo__ayuda">
            Mínimo 6 caracteres. El usuario podrá cambiarla desde su perfil.
          </span>
        </div>
      ) : (
        <label className="check" style={{ marginBottom: 4 }}>
          <input type="checkbox" name="activo" defaultChecked={Boolean(usuario.activo)} /> Cuenta
          activa
        </label>
      )}
      <div className="modal__foot" style={{ padding: '16px 0 0' }}>
        <button type="button" className="btn btn--fantasma" onClick={cerrarModal}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primario" disabled={enviando}>
          {enviando ? 'Guardando…' : nuevo ? 'Crear usuario' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

function FormPassword({ usuario, onListo }: { usuario: any; onListo: () => void }) {
  const { toast } = useToast();
  const { cerrarModal } = useModal();
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get('password') || '');
    setEnviando(true);
    try {
      await API.admin.resetPassword(usuario.id_usuario, password);
      cerrarModal();
      toast('Contraseña restablecida');
      onListo();
    } catch (err: any) {
      toast(err?.message || 'No se pudo restablecer la contraseña', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar}>
      <div className="campo">
        <label className="campo__label">
          Nueva contraseña <span>*</span>
        </label>
        <input
          className="input"
          type="password"
          name="password"
          minLength={6}
          required
          autoComplete="new-password"
        />
        <span className="campo__ayuda">Se aplicará de inmediato. Mínimo 6 caracteres.</span>
      </div>
      <div className="modal__foot" style={{ padding: '16px 0 0' }}>
        <button type="button" className="btn btn--fantasma" onClick={cerrarModal}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--azul" disabled={enviando}>
          <Icon name="llave" /> {enviando ? 'Restableciendo…' : 'Restablecer'}
        </button>
      </div>
    </form>
  );
}

export function UsuariosTab() {
  const { toast } = useToast();
  const { abrirModal } = useModal();
  const [usuarios, setUsuarios] = useState<any[] | null>(null);
  const [error, setError] = useState<any>(null);

  const cargar = useCallback(async () => {
    try {
      const r: any = await API.admin.usuarios();
      setUsuarios(r || []);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirUsuario = (u: any | null) => {
    abrirModal({
      titulo: u ? `Editar a ${u.nombre} ${u.apellido}`.trim() : 'Nuevo usuario',
      cuerpo: <FormUsuario usuario={u} onListo={cargar} />,
    });
  };

  const abrirPassword = (u: any) => {
    abrirModal({
      titulo: `Restablecer contraseña · ${u.nombre} ${u.apellido}`,
      cuerpo: <FormPassword usuario={u} onListo={cargar} />,
    });
  };

  const alternarActivo = async (u: any) => {
    try {
      await API.admin.editarUsuario(u.id_usuario, { activo: !u.activo });
      toast(u.activo ? 'Usuario desactivado' : 'Usuario activado');
      await cargar();
    } catch (err: any) {
      toast(err?.message || 'No se pudo actualizar el estado', 'error');
    }
  };

  if (error && !usuarios) {
    return (
      <div className="panel">
        <ErrorPanel error={error} />
      </div>
    );
  }
  if (!usuarios) return <Cargando />;

  return (
    <div className="panel">
      <div className="panel__head">
        <h2>Cuentas de la plataforma</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>{usuarios.length} usuario(s)</span>
          <button
            type="button"
            className="btn btn--pequeno btn--fantasma"
            onClick={() =>
              API.admin
                .exportarUsuarios()
                .then(() => toast('CSV de usuarios descargado'))
                .catch((err: any) => toast(err?.message || 'No se pudo exportar', 'error'))
            }
          >
            <Icon name="descargar" /> Exportar CSV
          </button>
          <button
            type="button"
            className="btn btn--pequeno btn--primario"
            onClick={() => abrirUsuario(null)}
          >
            <Icon name="mas" /> Nuevo usuario
          </button>
        </div>
      </div>
      <div className="panel__body panel__body--flush">
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Tickets</th>
                <th>Último acceso</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id_usuario}>
                  <td>
                    <div className="celda-titulo">
                      {u.nombre} {u.apellido}
                    </div>
                    <div className="texto-dim" style={{ fontSize: 10 }}>
                      {u.telefono || 'Sin teléfono'}
                    </div>
                  </td>
                  <td className="texto-muted" style={{ fontSize: 11 }}>
                    {u.email}
                  </td>
                  <td>
                    <RolBadge rol={u.rol} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`btn btn--pequeno ${u.activo ? 'btn--fantasma' : 'btn--peligro'}`}
                      onClick={() => alternarActivo(u)}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td style={{ fontSize: 10.5 }} className="texto-muted">
                    {Number(u.tickets_creados) || 0} creados
                    <br />
                    {Number(u.tickets_atendidos) || 0} atendidos
                  </td>
                  <td className="texto-dim" style={{ fontSize: 10 }}>
                    {u.ultimo_acceso ? fmtFecha(u.ultimo_acceso) : 'Nunca'}
                  </td>
                  <td>
                    <div className="celda-acciones">
                      <button
                        type="button"
                        className="btn btn--pequeno btn--fantasma"
                        onClick={() => abrirUsuario(u)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn--pequeno btn--azul"
                        onClick={() => abrirPassword(u)}
                      >
                        <Icon name="llave" /> Clave
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
