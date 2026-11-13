// Compatibilidad con enlaces antiguos: la aplicación vive en /app y usa rutas hash.
if (location.hash.startsWith('#/')) {
  location.replace('/app' + location.hash);
}
