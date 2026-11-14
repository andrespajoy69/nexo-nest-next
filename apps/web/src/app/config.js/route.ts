// Configuración pública de la API en tiempo de ejecución.
// Permite desplegar la misma imagen del frontend en cualquier dominio sin recompilar.
export const dynamic = 'force-dynamic';

export function GET() {
  const url = (
    process.env.NEXO_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001/api'
  ).replace(/\/$/, '');

  return new Response(`window.__NEXO_API_URL__=${JSON.stringify(url)};\n`, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
