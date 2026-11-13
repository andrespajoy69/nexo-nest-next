'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/Icon';
import { useModal } from '@/components/ModalProvider';
import { useToast } from '@/components/ToastProvider';
import { Cargando, Empty, ErrorPanel } from '@/components/ui';
import { API } from '@/lib/api';
import { useTitulo } from '@/lib/useTitulo';

const POR_PAGINA = 30;

function categoriaBadge(categoria: string) {
  const clase =
    categoria === 'Ciberseguridad'
      ? 'badge--rojo'
      : categoria === 'TI General'
        ? 'badge--azul'
        : 'badge--gris';
  return `badge ${clase}`;
}

export default function KedbPage() {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const { abrirModal, cerrarModal } = useModal();
  useTitulo('Base de conocimiento');

  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('');
  const [busqueda, setBusqueda] = useState({ q: '', categoria: '' });
  const [articulos, setArticulos] = useState<any[] | null>(null);
  const [error, setError] = useState<any>(null);
  const [pagina, setPagina] = useState(1);
  const esAdmin = usuario?.rol === 'Administrador';

  const cargar = useCallback(async () => {
    try {
      const r: any = await API.kedb.listar(busqueda.q, busqueda.categoria);
      setArticulos(r || []);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [busqueda]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda]);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    setBusqueda({ q: q.trim(), categoria });
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
              <span className={categoriaBadge(a.categoria)}>{a.categoria}</span>
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

  const abrirArticulo = (a: any | null) => {
    abrirModal({
      titulo: a ? 'Editar artículo' : 'Nuevo artículo',
      ancha: true,
      cuerpo: (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const datos = Object.fromEntries(new FormData(e.currentTarget).entries());
            try {
              if (a) {
                await API.kedb.editar(a.id_articulo, datos);
                toast('Artículo actualizado');
              } else {
                await API.kedb.crear(datos);
                toast('Artículo creado');
              }
              cerrarModal();
              await cargar();
            } catch (err: any) {
              toast(err?.message || 'No se pudo guardar el artículo', 'error');
            }
          }}
        >
          <div className="campo">
            <label className="campo__label">
              Título <span>*</span>
            </label>
            <input className="input" name="titulo" defaultValue={a?.titulo || ''} required maxLength={200} />
          </div>
          <div className="fila">
            <div className="campo">
              <label className="campo__label">Categoría</label>
              <select className="select" name="categoria" defaultValue={a?.categoria || 'Ambas'}>
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
                defaultValue={a?.palabras_clave || ''}
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
              defaultValue={a?.contenido || ''}
              required
              style={{ minHeight: 220 }}
            />
            <span className="campo__ayuda">
              Se muestra a los usuarios como guía de autoayuda y en las sugerencias al crear
              tickets.
            </span>
          </div>
          <div className="modal__foot" style={{ padding: '16px 0 0' }}>
            <button type="button" className="btn btn--fantasma" onClick={cerrarModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primario">
              {a ? 'Guardar cambios' : 'Crear artículo'}
            </button>
          </div>
        </form>
      ),
    });
  };

  const borrar = async (e: React.MouseEvent, a: any) => {
    e.stopPropagation();
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

  const total = articulos?.length || 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = (articulos || []).slice(
    (paginaActual - 1) * POR_PAGINA,
    paginaActual * POR_PAGINA,
  );

  return (
    <>
      <div className="pagina-head">
        <div className="pagina-head__texto">
          <span className="eyebrow">Autoayuda · KEDB</span>
          <h1>Base de conocimiento</h1>
          <p>
            Guías rápidas para resolver problemas frecuentes y actuar ante incidentes de seguridad.
          </p>
        </div>
        {esAdmin && (
          <div className="pagina-head__acciones">
            <button type="button" className="btn btn--primario" onClick={() => abrirArticulo(null)}>
              <Icon name="mas" /> Nuevo artículo
            </button>
          </div>
        )}
      </div>

      <form className="filtros" onSubmit={buscar}>
        <input
          className="input filtros__busqueda"
          placeholder="Buscar en la base de conocimiento…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          <option>TI General</option>
          <option>Ciberseguridad</option>
        </select>
        <button type="submit" className="btn btn--pequeno btn--primario">
          Buscar
        </button>
      </form>

      {!articulos ? (
        <Cargando />
      ) : total ? (
        <>
          <div className="kedb-grid">
            {visibles.map((a) => (
              <div
                className="articulo"
                key={a.id_articulo}
                onClick={() => verArticulo(a.id_articulo)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') verArticulo(a.id_articulo);
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    alignItems: 'flex-start',
                  }}
                >
                  <span className={categoriaBadge(a.categoria)}>{a.categoria}</span>
                  {esAdmin && (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button
                        type="button"
                        className="btn btn--pequeno btn--fantasma"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirArticulo(a);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn--pequeno btn--peligro"
                        onClick={(e) => borrar(e, a)}
                      >
                        Borrar
                      </button>
                    </div>
                  )}
                </div>
                <h3>{a.titulo}</h3>
                <p>{String(a.contenido).slice(0, 150)}…</p>
                <div className="articulo__pie">
                  <span>{Number(a.vistas) || 0} lectura(s)</span>
                  <span style={{ color: 'var(--mint)', fontWeight: 700 }}>Leer →</span>
                </div>
              </div>
            ))}
          </div>
          <div className="paginador">
            <button
              type="button"
              className="btn btn--pequeno btn--fantasma"
              disabled={paginaActual <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              ← Anterior
            </button>
            <span>
              Página {paginaActual} de {totalPaginas} · {total} artículos
            </span>
            <button
              type="button"
              className="btn btn--pequeno btn--fantasma"
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            >
              Siguiente →
            </button>
          </div>
        </>
      ) : (
        <Empty titulo="Sin artículos" texto="No encontramos artículos con esos criterios." />
      )}
    </>
  );
}
