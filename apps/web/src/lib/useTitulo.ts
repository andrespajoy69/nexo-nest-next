'use client';

import { useEffect } from 'react';

export function useTitulo(titulo: string) {
  useEffect(() => {
    document.title = `Nexo · ${titulo}`;
  }, [titulo]);
}
