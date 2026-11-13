export const iniciales = (nombre = '', apellido = '') =>
  `${(nombre || '').charAt(0)}${(apellido || '').charAt(0)}`.toUpperCase() || '?';

export const fmtFecha = (v: any) =>
  v ? new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const fmtFechaCorta = (v: any) =>
  v ? new Date(v).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—';

export const fmtBytes = (b: any) => {
  const n = Number(b) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export const hace = (v: any) => {
  const ms = Date.now() - new Date(v).getTime();
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
};

export const fmtDuracion = (ms: number) => {
  const total = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
};

export const textoRestante = (ms: number) =>
  ms < 0 ? `Vencido +${fmtDuracion(ms)}` : fmtDuracion(ms);

export const claveLocal = (v: any) => {
  const d = new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function serieDias(porDia: any[], n: number) {
  const mapa = new Map<string, number>();
  for (const d of porDia || []) mapa.set(claveLocal(d.dia), Number(d.total) || 0);
  const out: { dia: Date; total: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const f = new Date();
    f.setHours(0, 0, 0, 0);
    f.setDate(f.getDate() - i);
    out.push({ dia: f, total: mapa.get(claveLocal(f)) || 0 });
  }
  return out;
}

export const ESTADO_CLASE: Record<string, string> = {
  Abierto: 'estado--abierto',
  'En Progreso': 'estado--en-progreso',
  'En Espera': 'estado--en-espera',
  Escalado: 'estado--escalado',
  Resuelto: 'estado--resuelto',
  Cerrado: 'estado--cerrado',
};

export const URG_CLASE: Record<string, string> = {
  Baja: 'urg--baja',
  Media: 'urg--media',
  Alta: 'urg--alta',
  'Crítica': 'urg--critica',
};

export const colorDe = (t: any) => (t.sla_vencido ? 'rojo' : t.semaforo || 'verde');

export const esStaff = (user: any) =>
  ['Analista L1', 'Administrador'].includes(user?.rol);
export const esAdmin = (user: any) => user?.rol === 'Administrador';
