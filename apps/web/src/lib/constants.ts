export const CATEGORIAS = ['TI General', 'Ciberseguridad'];
export const URGENCIAS = ['Baja', 'Media', 'Alta', 'Crítica'];
export const ESTADOS = ['Abierto', 'En Progreso', 'En Espera', 'Escalado', 'Resuelto', 'Cerrado'];
export const NIVELES = ['L1', 'L2/SOC'];
export const ROLES = ['Usuario', 'Analista L1', 'Administrador'];

export const SLA_DEFAULT = {
  'Crítica': { respuesta: 1, resolucion: 4 },
  Alta: { respuesta: 2, resolucion: 8 },
  Media: { respuesta: 4, resolucion: 24 },
  Baja: { respuesta: 8, resolucion: 72 },
};

export const TRANSICIONES: Record<string, string[]> = {
  Abierto: ['En Progreso', 'En Espera', 'Cerrado', 'Resuelto'],
  'En Progreso': ['En Espera', 'Resuelto'],
  'En Espera': ['En Progreso'],
  Escalado: ['En Progreso', 'Resuelto'],
  Resuelto: ['Cerrado', 'En Progreso'],
  Cerrado: [],
};

export const PLANTILLAS_NUEVO = [
  {
    id: 'acceso',
    titulo: 'No puedo iniciar sesión',
    categoria: 'TI General',
    urgencia: 'Media',
    asunto: 'No puedo iniciar sesión en mi cuenta corporativa',
    descripcion:
      'Desde esta mañana no puedo ingresar a mi cuenta corporativa. El sistema muestra un mensaje de credenciales inválidas y necesito recuperar el acceso para continuar con mis actividades.',
  },
  {
    id: 'impresora',
    titulo: 'Impresora sin respuesta',
    categoria: 'TI General',
    urgencia: 'Baja',
    asunto: 'La impresora de mi área no imprime',
    descripcion:
      'Envío documentos a la cola de impresión, pero la impresora no responde y no muestra un error claro. Ya verifiqué que esté encendida y conectada.',
  },
  {
    id: 'correo',
    titulo: 'Correo sospechoso',
    categoria: 'Ciberseguridad',
    urgencia: 'Alta',
    asunto: 'Recibí un correo sospechoso que solicita mis credenciales',
    descripcion:
      'Recibí un correo de un remitente desconocido que me pide verificar mis credenciales mediante un enlace. No hice clic, pero el mensaje parece fraudulento y quiero reportarlo.',
  },
  {
    id: 'red',
    titulo: 'Red o VPN inestable',
    categoria: 'TI General',
    urgencia: 'Media',
    asunto: 'La conexión a la red o VPN está inestable',
    descripcion:
      'La conexión a la red o a la VPN se interrumpe constantemente y está muy lenta, lo que me impide trabajar con normalidad. El problema inició hoy.',
  },
  {
    id: 'pantalla',
    titulo: 'Pantalla azul o reinicios',
    categoria: 'TI General',
    urgencia: 'Alta',
    asunto: 'Mi equipo presenta pantalla azul y reinicios inesperados',
    descripcion:
      'Mi equipo muestra una pantalla azul y se reinicia de forma inesperada. Ya intenté reiniciarlo y el problema continúa, por lo que no puedo continuar con mis tareas.',
  },
  {
    id: 'ransomware',
    titulo: 'Archivos cifrados',
    categoria: 'Ciberseguridad',
    urgencia: 'Crítica',
    asunto: 'Varios archivos de mi equipo aparecieron cifrados',
    descripcion:
      'Detecté que varios archivos de mi equipo cambiaron de extensión y no se pueden abrir. También apareció un mensaje solicitando un pago. Desconecté el equipo de la red para evitar que se propague.',
  },
];

export const PLANTILLAS_RESOLUCION = [
  {
    id: 'acceso',
    titulo: 'Acceso restablecido',
    texto:
      'Se restableció el acceso del usuario, se verificó el inicio de sesión y se recomendó cambiar la contraseña y activar la verificación en dos pasos.',
  },
  {
    id: 'correo',
    titulo: 'Correo malicioso bloqueado',
    texto:
      'Se analizó el correo reportado, se bloquearon el remitente y los enlaces maliciosos, y se eliminó el mensaje de la bandeja del usuario. Se recomendó no abrir adjuntos de remitentes desconocidos.',
  },
  {
    id: 'servicio',
    titulo: 'Servicio restablecido',
    texto:
      'Se reinició el servicio afectado y se validó su funcionamiento con el usuario. El caso queda resuelto.',
  },
  {
    id: 'equipo',
    titulo: 'Equipo revisado',
    texto:
      'Se revisó el equipo, se actualizaron los controladores y se realizó una prueba de funcionamiento satisfactoria con el usuario.',
  },
  {
    id: 'impresora',
    titulo: 'Impresora configurada',
    texto:
      'Se revisó la conexión de la impresora, se reinstaló el controlador y se realizó una impresión de prueba satisfactoria.',
  },
  {
    id: 'software',
    titulo: 'Software instalado',
    texto:
      'Se instaló y configuró el software solicitado. Se verificó con el usuario que la aplicación funciona correctamente.',
  },
  {
    id: 'malware',
    titulo: 'Equipo desinfectado',
    texto:
      'Se ejecutó un escaneo completo, se eliminaron las amenazas detectadas y se verificó que el equipo opera con normalidad. Se recomendó mantener el antivirus actualizado.',
  },
  {
    id: 'capacitacion',
    titulo: 'Orientación al usuario',
    texto:
      'Se brindó orientación al usuario sobre el uso correcto de la herramienta y se validó que puede continuar con sus actividades.',
  },
];

export const PLANTILLAS_COMENTARIO = [
  {
    id: 'info',
    titulo: 'Solicitar información',
    texto:
      'Para continuar con la revisión necesitamos que nos confirmes: ¿desde cuándo ocurre?, ¿qué equipo o servicio está afectado? y ¿qué mensaje de error aparece en pantalla?',
  },
  {
    id: 'avance',
    titulo: 'Informar avance',
    texto:
      'Estamos revisando tu caso. Te informaremos en cuanto tengamos una actualización o necesitemos más información.',
  },
  {
    id: 'prueba',
    titulo: 'Solicitar prueba',
    texto: 'Ya aplicamos una corrección. Por favor realiza una prueba y confírmanos si el problema persiste.',
  },
  {
    id: 'cierre',
    titulo: 'Recordar confirmación',
    texto:
      'Tu ticket fue marcado como resuelto. Si el problema continúa, respóndenos por este medio para reabrirlo.',
  },
];

export const ETIQUETAS_DATOS: Record<string, string> = {
  vector: 'Vector del incidente',
  remitente: 'Remitente / sitio',
  enlace: 'Enlace sospechoso',
  fecha: 'Fecha del evento',
  tipo: 'Tipo de equipo',
  ubicacion: 'Ubicación / activo',
};

export const ACCION_TEXTO: Record<string, string> = {
  creado: 'Ticket creado',
  asignado: 'Ticket asignado',
  estado: 'Cambio de estado',
  escalado: 'Escalado a L2/SOC',
  evidencia: 'Evidencias cargadas',
  cuarentena: 'Cuarentena de evidencias',
  comentario: 'Comentario agregado',
  cerrado: 'Cierre confirmado',
  migrado: 'Ticket migrado',
};

export const ACCION_ICONO: Record<string, string> = {
  creado: 'nuevo',
  asignado: 'usuario',
  estado: 'flecha',
  escalado: 'alerta',
  evidencia: 'clip',
  cuarentena: 'candado',
  comentario: 'chat',
  cerrado: 'check',
  migrado: 'flecha',
};

export const ADMIN_TABS = [
  { id: 'metricas', texto: 'Métricas' },
  { id: 'seguimiento', texto: 'Seguimiento' },
  { id: 'usuarios', texto: 'Usuarios' },
  { id: 'sla', texto: 'SLA' },
  { id: 'kedb', texto: 'Base de conocimiento' },
  { id: 'auditoria', texto: 'Auditoría' },
];

export const ICONOS: Record<string, string> = {
  panel:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  nuevo:
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 12v6M9 15h6"/>',
  lista:
    '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  escudo: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  libro:
    '<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z"/><path d="M8 3v18"/><path d="M12 7h4M12 11h4"/>',
  usuarios:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.2 2.7-5 6-5s6 1.8 6 5"/><circle cx="17.5" cy="9" r="2.4"/><path d="M16 15.2c2.8.2 5 1.8 5 4.8"/>',
  ajustes:
    '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  salir:
    '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M15 17l5-5-5-5"/><path d="M20 12H9"/>',
  campana:
    '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  clip:
    '<path d="M20 11.5l-7.6 7.6a5 5 0 0 1-7-7L13 4.5a3.4 3.4 0 0 1 4.8 4.8L10.4 17a1.8 1.8 0 0 1-2.5-2.5l6.8-6.8"/>',
  descargar: '<path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M4 19h16"/>',
  candado: '<rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  alerta: '<path d="M12 3L2.5 20h19z"/><path d="M12 9v5M12 17h.01"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chat: '<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/>',
  grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  llave:
    '<circle cx="8" cy="8" r="4.5"/><path d="M11.2 11.2L20 20M17 17l2-2M14 14l2-2"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  sobre: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
};
