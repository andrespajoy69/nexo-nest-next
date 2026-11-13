'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { API, guardarSesion, limpiarSesion, tokenGuardado } from '@/lib/api';

export type Usuario = {
  id_usuario: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: 'Usuario' | 'Analista L1' | 'Administrador' | string;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
};

type AuthContexto = {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<Usuario>;
  registro: (datos: Record<string, any>) => Promise<Usuario>;
  salir: () => void;
  refrescar: () => Promise<Usuario | null>;
  actualizarUsuario: (datos: Partial<Usuario>) => void;
};

const AuthContext = createContext<AuthContexto>({
  usuario: null,
  cargando: true,
  login: async () => {
    throw new Error('AuthProvider no inicializado');
  },
  registro: async () => {
    throw new Error('AuthProvider no inicializado');
  },
  salir: () => undefined,
  refrescar: async () => null,
  actualizarUsuario: () => undefined,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    if (!tokenGuardado()) {
      setCargando(false);
      return;
    }
    API.auth
      .me()
      .then((r: any) => {
        if (vivo) setUsuario(r.usuario);
      })
      .catch(() => {
        limpiarSesion();
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r: any = await API.auth.login(email, password);
    guardarSesion(r.token, r.usuario);
    setUsuario(r.usuario);
    return r.usuario as Usuario;
  }, []);

  const registro = useCallback(async (datos: Record<string, any>) => {
    const r: any = await API.auth.registro(datos);
    guardarSesion(r.token, r.usuario);
    setUsuario(r.usuario);
    return r.usuario as Usuario;
  }, []);

  const salir = useCallback(() => {
    limpiarSesion();
    setUsuario(null);
  }, []);

  const refrescar = useCallback(async () => {
    try {
      const r: any = await API.auth.me();
      setUsuario(r.usuario);
      return r.usuario as Usuario;
    } catch {
      return null;
    }
  }, []);

  const actualizarUsuario = useCallback((datos: Partial<Usuario>) => {
    setUsuario((prev) => (prev ? { ...prev, ...datos } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, login, registro, salir, refrescar, actualizarUsuario }}
    >
      {children}
    </AuthContext.Provider>
  );
}
