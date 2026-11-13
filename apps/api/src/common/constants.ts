// Reglas de negocio compartidas: catálogos, SLA, transiciones y motor de triaje.
export const CATEGORIAS = ['TI General', 'Ciberseguridad'];
export const URGENCIAS = ['Baja', 'Media', 'Alta', 'Crítica'];
export const ESTADOS = ['Abierto', 'En Progreso', 'En Espera', 'Escalado', 'Resuelto', 'Cerrado'];
export const NIVELES = ['L1', 'L2/SOC'];
export const ROLES = ['Usuario', 'Analista L1', 'Administrador'];
export const ES_STAFF = ['Analista L1', 'Administrador'];

export const ORDEN_URGENCIA = { Baja: 1, Media: 2, Alta: 3, 'Crítica': 4 };

// Horas de SLA por urgencia: [respuesta, resolución]
export const SLA_DEFAULT = {
  'Crítica': { respuesta: 1, resolucion: 4 },
  Alta: { respuesta: 2, resolucion: 8 },
  Media: { respuesta: 4, resolucion: 24 },
  Baja: { respuesta: 8, resolucion: 72 },
};

// El estado "Escalado" solo se alcanza con POST /api/tickets/:id/escalar
export const TRANSICIONES = {
  Abierto: ['En Progreso', 'En Espera', 'Cerrado', 'Resuelto'],
  'En Progreso': ['En Espera', 'Resuelto'],
  'En Espera': ['En Progreso'],
  Escalado: ['En Progreso', 'Resuelto'],
  Resuelto: ['Cerrado', 'En Progreso'],
  Cerrado: [],
};

export const REGLAS_TRIAJE = [
  {
    etiqueta: 'Ransomware / extorsión',
    urgencia: 'Crítica',
    palabras: [
      'ransomware',
      'secuestro de datos',
      'cifrado de archivos',
      'archivos cifrados',
      'extorsion',
      'rescate',
      'bitcoin',
    ],
  },
  {
    etiqueta: 'Malware',
    urgencia: 'Crítica',
    palabras: [
      'virus',
      'malware',
      'troyano',
      'gusano',
      'rootkit',
      'spyware',
      'keylogger',
      'backdoor',
      'puerta trasera',
    ],
  },
  {
    etiqueta: 'Phishing / suplantación',
    urgencia: 'Alta',
    palabras: [
      'phishing',
      'suplantacion',
      'correo sospechoso',
      'mail sospechoso',
      'enlace sospechoso',
      'link sospechoso',
      'sitio falso',
      'pagina falsa',
      'credenciales',
      'contrasena expuesta',
    ],
  },
  {
    etiqueta: 'Acceso no autorizado',
    urgencia: 'Crítica',
    palabras: [
      'acceso no autorizado',
      'intrusion',
      'hackeo',
      'hackearon',
      'brecha',
      'filtracion',
      'robo de datos',
      'cuenta comprometida',
      'usuario desconocido',
    ],
  },
  {
    etiqueta: 'Ataque de red',
    urgencia: 'Alta',
    palabras: [
      'ddos',
      'denegacion de servicio',
      'escaneo de puertos',
      'trafico anomalo',
      'red comprometida',
      'dns',
    ],
  },
  {
    etiqueta: 'Dispositivo sospechoso',
    urgencia: 'Alta',
    palabras: [
      'usb desconocida',
      'dispositivo desconocido',
      'disco extraible',
      'software pirata',
      'programa desconocido',
    ],
  },
];

export const normalizar = (texto = '') =>
  String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const nivelUrgencia = (urgencia: string) =>
  ORDEN_URGENCIA[urgencia as keyof typeof ORDEN_URGENCIA] || 0;

export function analizarTriaje({
  asunto = '',
  descripcion = '',
  categoria = 'TI General',
  urgencia = 'Baja',
}: {
  asunto?: string;
  descripcion?: string;
  categoria?: string;
  urgencia?: string;
}) {
  const texto = normalizar(`${asunto} ${descripcion}`);
  const etiquetas: string[] = [];
  let sugerida = urgencia;
  let urgente = false;

  for (const regla of REGLAS_TRIAJE) {
    if (regla.palabras.some((p) => texto.includes(normalizar(p)))) {
      etiquetas.push(regla.etiqueta);
      if (nivelUrgencia(regla.urgencia) > nivelUrgencia(sugerida)) {
        sugerida = regla.urgencia;
        urgente = true;
      }
    }
  }

  if (categoria === 'Ciberseguridad' && nivelUrgencia(sugerida) < nivelUrgencia('Alta')) {
    sugerida = 'Alta';
  }

  return {
    urgencia: sugerida,
    palabras: [...new Set(etiquetas)],
    prioridadAuto: urgente || sugerida !== urgencia,
  };
}

export const SEGURO = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  fecha: /^\d{4}-\d{2}-\d{2}$/,
};
