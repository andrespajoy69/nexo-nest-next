declare global {
  interface Window {
    __NEXO_API_URL__?: string;
  }
}

const API_POR_DEFECTO = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
).replace(/\/$/, '');

/** URL efectiva de la API: configuración runtime (/config.js) o valor de build. */
export function apiUrl(): string {
  if (typeof window !== 'undefined' && window.__NEXO_API_URL__) {
    return window.__NEXO_API_URL__.replace(/\/$/, '');
  }
  return API_POR_DEFECTO;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const tokenGuardado = () =>
  typeof window === 'undefined' ? '' : localStorage.getItem('nexo_token') || '';

export const usuarioGuardado = () => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('nexo_usuario') || 'null');
  } catch {
    return null;
  }
};

export function guardarSesion(token: string, usuario: any) {
  localStorage.setItem('nexo_token', token);
  localStorage.setItem('nexo_usuario', JSON.stringify(usuario));
}

export function limpiarSesion() {
  localStorage.removeItem('nexo_token');
  localStorage.removeItem('nexo_usuario');
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || data?.message || `Error ${res.status}`;
  } catch {
    return `Error ${res.status}`;
  }
}

export async function apiFetch<T = any>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...((opciones.headers as any) || {}) };
  const token = tokenGuardado();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: any = opciones.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${apiUrl()}${ruta}`, { ...opciones, headers, body });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Verifica que la API esté activa.', 0);
  }

  if (!res.ok) {
    const mensaje = await parseError(res);
    if (res.status === 401 && typeof window !== 'undefined') {
      const enLogin = window.location.pathname === '/';
      if (!enLogin) {
        limpiarSesion();
        window.location.href = '/app';
      }
    }
    throw new ApiError(mensaje, res.status);
  }

  if (res.status === 204) return null as T;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return (await res.json()) as T;
  return (await res.blob()) as unknown as T;
}

export async function descargar(ruta: string, nombre: string) {
  const blob = await apiFetch<Blob>(ruta);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const API = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch('/auth/login', { method: 'POST', body: { email, password } as any }),
    registro: (datos: any) => apiFetch('/auth/registro', { method: 'POST', body: datos }),
    me: () => apiFetch('/auth/me'),
    perfil: (datos: any) => apiFetch('/auth/perfil', { method: 'PATCH', body: datos }),
    password: (actual: string, nueva: string) =>
      apiFetch('/auth/password', { method: 'PATCH', body: { actual, nueva } as any }),
  },
  tickets: {
    crear: (datos: any) => apiFetch('/tickets', { method: 'POST', body: datos }),
    resumen: () => apiFetch('/tickets/resumen'),
    misTickets: () => apiFetch('/tickets/mis-tickets'),
    analistas: () => apiFetch('/tickets/analistas'),
    listar: (filtros: Record<string, any> = {}) => {
      const qs = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      });
      return apiFetch(`/tickets?${qs.toString()}`);
    },
    detalle: (id: string | number) => apiFetch(`/tickets/${id}`),
    asignar: (id: string | number, id_analista?: string | number) =>
      apiFetch(`/tickets/${id}/asignar`, {
        method: 'PATCH',
        body: (id_analista ? { id_analista } : {}) as any,
      }),
    estado: (id: string | number, estado: string, resumen?: string) =>
      apiFetch(`/tickets/${id}/estado`, {
        method: 'PATCH',
        body: { estado, resumen } as any,
      }),
    escalar: (id: string | number, motivo: string) =>
      apiFetch(`/tickets/${id}/escalar`, { method: 'POST', body: { motivo } as any }),
    confirmar: (id: string | number) =>
      apiFetch(`/tickets/${id}/confirmar`, { method: 'POST' }),
    comentar: (id: string | number, contenido: string, interno: boolean) =>
      apiFetch(`/tickets/${id}/comentarios`, {
        method: 'POST',
        body: { contenido, interno } as any,
      }),
    subirEvidencias: (id: string | number, archivos: FileList | File[]) => {
      const fd = new FormData();
      Array.from(archivos).forEach((a) => fd.append('archivos', a));
      return apiFetch(`/tickets/${id}/evidencias`, { method: 'POST', body: fd });
    },
    cuarentena: (idEvidencia: number, en_cuarentena: boolean) =>
      apiFetch(`/tickets/evidencias/${idEvidencia}/cuarentena`, {
        method: 'PATCH',
        body: { en_cuarentena } as any,
      }),
    descargarEvidencia: (idTicket: number, idEvidencia: number, nombre: string) =>
      descargar(`/tickets/${idTicket}/evidencias/${idEvidencia}/descarga`, nombre),
  },
  kedb: {
    listar: (q = '', categoria = '') => {
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      if (categoria) qs.set('categoria', categoria);
      return apiFetch(`/kedb?${qs.toString()}`);
    },
    sugerencias: (q: string, categoria = '') => {
      const qs = new URLSearchParams({ q });
      if (categoria) qs.set('categoria', categoria);
      return apiFetch(`/kedb/sugerencias?${qs.toString()}`);
    },
    obtener: (id: string | number) => apiFetch(`/kedb/${id}`),
    crear: (datos: any) => apiFetch('/kedb', { method: 'POST', body: datos }),
    editar: (id: string | number, datos: any) =>
      apiFetch(`/kedb/${id}`, { method: 'PUT', body: datos }),
    eliminar: (id: string | number) => apiFetch(`/kedb/${id}`, { method: 'DELETE' }),
  },
  notificaciones: {
    listar: () => apiFetch('/notificaciones'),
    leer: (id: number) => apiFetch(`/notificaciones/${id}/leida`, { method: 'PATCH' }),
    leerTodas: () => apiFetch('/notificaciones/leer-todas', { method: 'POST' }),
  },
  admin: {
    usuarios: () => apiFetch('/admin/usuarios'),
    crearUsuario: (datos: any) => apiFetch('/admin/usuarios', { method: 'POST', body: datos }),
    editarUsuario: (id: string | number, datos: any) =>
      apiFetch(`/admin/usuarios/${id}`, { method: 'PATCH', body: datos }),
    resetPassword: (id: string | number, password: string) =>
      apiFetch(`/admin/usuarios/${id}/password`, { method: 'PATCH', body: { password } as any }),
    metricas: () => apiFetch('/admin/metricas'),
    sla: () => apiFetch('/admin/sla'),
    guardarSla: (config: any) => apiFetch('/admin/sla', { method: 'PUT', body: config }),
    auditoria: () => apiFetch('/admin/auditoria'),
    exportarTickets: () => descargar('/admin/exportar/tickets.csv', 'nexo-tickets.csv'),
    exportarUsuarios: () => descargar('/admin/exportar/usuarios.csv', 'nexo-usuarios.csv'),
  },
};
