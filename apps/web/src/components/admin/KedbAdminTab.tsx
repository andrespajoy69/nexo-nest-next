'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useModal } from '@/components/ModalProvider';
import { useToast } from '@/components/ToastProvider';
import { Cargando, Empty, ErrorPanel } from '@/components/ui';
import { API } from '@/lib/api';
import { fmtFechaCorta } from '@/lib/format';

function badgeCategoria(categoria: string) {
  const clase =
    categoria === 'Ciberseguridad'
      ? 'badge--rojo'
      : categoria === 'TI General'
        ? 'badge--azul'
        : 'badge--gris';
  return `badge ${clase}`;
}

function FormArticulo({ articulo, onListo }: { articulo: any | null; onListo: () => void }) {
  const { toast } = useToast();
  const { cerrarModal } = useModal();
  const nuevo = !articulo;
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.currentTarget).entries());
    setEnviando(true);
    try {
      if (nuevo) {
        await API.kedb.crear(datos);
        toast('Artículo creado');
      } else {
        await API.kedb.editar(articulo.id_articulo, datos);
        toast('Artículo actualizado');
      }
      cerrarModal();
      onListo();
    } catch (err: any) {
      toast(err?.message || 'No se pudo guardar el artículo', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar}>
      <div className="campo">
        <label className="campo__label">
          Título <span>*</span>
        </label>
        <input
          className="input"
          name="titulo"
          defaultValue={nuevo ? '' : articulo.titulo}
          required
          maxLength={200}
        />
      </div>
      <div className="fila">
        <div className="campo">
          <label className="campo__label">Categoría</label>
          <select className="select" name="categoria" defaultValue={nuevo ? 'Ambas' : articulo.categoria}>
            {['Ambas', 'TI General', 'Ciberseguridad'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label className="campo__label">Palabras clave</label>
          <input
            className="input"
            name="palabras_clave"
            defaultValue={nuevo ? '' : articulo.palabras_clave || ''}
            maxLength={255}
            placeholder="phishing, correo, credenciales"
          />
        </div>
      </div>
      <div className="campo">
        <label className="campo__label">
          Contenido <span>*</span>
        </label>
        <textarea
          className="textarea"
          name="contenido"
          defaultValue={nuevo ? '' : articulo.contenido}
          required
          style={{ minHeight: 220 }}
        />
        <span className="campo__ayuda">
          Se muestra a los usuarios como guía de autoayuda y en las sugerencias al crear tickets.
        </span>
      </div>
      <div className="modal__foot" style={{ padding: '16px 0 0' }}>
        <button type="button" className="btn btn--fantasma" onClick={cerrarModal}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primario" disabled={enviando}>
          {enviando ? 'Guardando…' : nuevo ? 'Crear artículo' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

export function KedbAdminTab() {
  const { toast } = useToast();
  const { abrirModal, cerrarModal } = useModal();
  const [articulos, setArticulos] = useState<any[] | null>(null);
  const [error, setError] = useState<any>(null);

  const cargar = useCallback(async () => {
    try {
      const r: any = await API.kedb.listar('', '');
      setArticulos(r || []);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nuevo = () => {
    abrirModal({
      titulo: 'Nuevo artículo',
      ancha: true,
      cuerpo: <FormArticulo articulo={null} onListo={cargar} />,
    });
  };

  const editar = (a: any) => {
    abrirModal({
      titulo: 'Editar artículo',
      ancha: true,
      cuerpo: <FormArticulo articulo={a} onListo={cargar} />,
    });
  };

  const ver = async (a: any) => {
    try {
      const detalle: any = await API.kedb.obtener(a.id_articulo);
      abrirModal({
        titulo: detalle.titulo,
        ancha: true,
        cuerpo: (
          <>
            <div className="detalle__meta" style={{ marginBottom: 14 }}>
              <span className={badgeCategoria(detalle.categoria)}>{detalle.categoria}</span>
              <span className="pill">{Number(detalle.vistas) || 0} lecturas</span>
            </div>
            <p className="descripcion">{detalle.contenido}</p>
            {detalle.palabras_clave ? (
              <p className="campo__ayuda" style={{ marginTop: 16 }}>
                Palabras clave: {detalle.palabras_clave}
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

  const borrar = async (a: any) => {
    if (!window.confirm(`¿Desactivar el artículo "${a.titulo}"?`)) return;
    try {
      await API.kedb.eliminar(a.id_articulo);
      toast('Artículo desactivado');
      await cargar();
    } catch (err: any) {
      toast(err?.message || 'No se pudo desactivar', 'error');
    }
  };

  if (error && !articulos) {
    return (
      <div className="panel">
        <ErrorPanel error={error} />
      </div>
    );
  }
  if (!articulos) return <Cargando />;

  return (
    <div className="panel">
      <div className="panel__head">
        <h2>Artículos de autoayuda</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>{articulos.length} artículo(s) activos</span>
          <button type="button" className="btn btn--pequeno btn--primario" onClick={nuevo}>
            <Icon name="mas" /> Nuevo artículo
          </button>
        </div>
      </div>
      <div className="panel__body panel__body--flush">
        {articulos.length ? (
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Categoría</th>
                  <th>Palabras clave</th>
                  <th>Lecturas</th>
                  <th>Creado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {articulos.map((a) => (
                  <tr key={a.id_articulo}>
                    <td className="celda-titulo">{a.titulo}</td>
                    <td>
                      <span className={badgeCategoria(a.categoria)}>{a.categoria}</span>
                    </td>
                    <td
                      className="texto-dim"
                      style={{ fontSize: 10, maxWidth: 200, overflow: 'hidden' }}
                    >
                      {a.palabras_clave || '—'}
                    </td>
                    <td>{Number(a.vistas) || 0}</td>
                    <td className="texto-dim" style={{ fontSize: 10 }}>
                      {fmtFechaCorta(a.fecha_creacion)}
                    </td>
                    <td>
                      <div className="celda-acciones">
                        <button
                          type="button"
                          className="btn btn--pequeno btn--fantasma"
                          onClick={() => ver(a)}
                        >
                          Ver
                        </button>
                        <button
                          type="button"
                          className="btn btn--pequeno btn--azul"
                          onClick={() => editar(a)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn--pequeno btn--peligro"
                          onClick={() => borrar(a)}
                        >
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            titulo="Sin artículos"
            texto="Crea el primer artículo de la base de conocimiento."
            accion={
              <button type="button" className="btn btn--primario" onClick={nuevo}>
                Crear artículo
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}
