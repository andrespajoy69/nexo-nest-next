'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type TipoToast = 'ok' | 'error';
type Toast = { id: number; mensaje: string; tipo: TipoToast; saliendo?: boolean };

const ToastContext = createContext<{ toast: (mensaje: string, tipo?: TipoToast) => void }>({
  toast: () => undefined,
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const contador = useRef(0);

  const toast = useCallback((mensaje: string, tipo: TipoToast = 'ok') => {
    const id = ++contador.current;
    setToasts((prev) => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, saliendo: true } : t)));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 260);
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast--${t.tipo}`}
            style={
              t.saliendo
                ? { opacity: 0, transform: 'translateY(6px)', transition: '0.25s ease' }
                : undefined
            }
          >
            {t.mensaje}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
