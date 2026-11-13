'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Icon } from './Icon';

type ModalOpciones = { titulo: string; cuerpo: React.ReactNode; ancha?: boolean };

const ModalContext = createContext<{
  abrirModal: (opciones: ModalOpciones) => void;
  cerrarModal: () => void;
}>({
  abrirModal: () => undefined,
  cerrarModal: () => undefined,
});

export const useModal = () => useContext(ModalContext);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalOpciones | null>(null);

  const abrirModal = useCallback((opciones: ModalOpciones) => setModal(opciones), []);
  const cerrarModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    if (!modal) return;
    const anterior = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarModal();
    };
    document.addEventListener('keydown', alPresionar);

    const primero = document.querySelector<HTMLElement>(
      '#modal-root input:not([type="hidden"]), #modal-root textarea, #modal-root select',
    );
    (primero || document.querySelector<HTMLElement>('#modal-root .modal__cerrar'))?.focus();

    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = '';
      if (anterior && document.contains(anterior)) anterior.focus();
    };
  }, [modal, cerrarModal]);

  return (
    <ModalContext.Provider value={{ abrirModal, cerrarModal }}>
      {children}
      <div id="modal-root">
        {modal && (
          <div
            className="modal"
            data-modal-fondo
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) cerrarModal();
            }}
          >
            <div
              className={`modal__caja ${modal.ancha ? 'modal__caja--ancha' : ''}`}
              role="dialog"
              aria-modal="true"
            >
              <div className="modal__head">
                <h2>{modal.titulo}</h2>
                <button
                  type="button"
                  className="modal__cerrar"
                  onClick={cerrarModal}
                  aria-label="Cerrar"
                >
                  <Icon name="x" />
                </button>
              </div>
              <div className="modal__body">{modal.cuerpo}</div>
            </div>
          </div>
        )}
      </div>
    </ModalContext.Provider>
  );
}
