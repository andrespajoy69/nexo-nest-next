# Mapa del código: base de datos, backend y frontend

## 0. Dónde está todo en producción

| Componente | Servicio en Render | URL / identificador | Código fuente |
| --- | --- | --- | --- |
| Frontend Next.js | `nexo-web` (`srv-dbrqfmjrjlhs73c7tidg`) | <https://nexo-web-lpyd.onrender.com> | `apps/web` |
| Backend NestJS | `nexo-api` (`srv-dbrqfvjrjlhs73c7ufdg`) | <https://nexo-api-k5cu.onrender.com/api> | `apps/api` |
| Base de datos | `nexo-db` (`dpg-dbrqfmrrjlhs73c7tin0-a`) | `dpg-dbrqfmrrjlhs73c7tin0-a.oregon-postgres.render.com`, base `nexo_xz9w`, usuario `nexo` | `apps/api/sql` |
| Evidencias | Disco del contenedor `nexo-api` | `/app/apps/api/uploads/evidencias` (efímero en plan gratuito) | `apps/api/src/config/uploads.ts` |
| Blueprint | `nexo` (`exs-dbrqf3tg1s2s73d98iug`) | `render.yaml` en la raíz del repositorio | `render.yaml` |

El navegador habla con `nexo-web`, que recibe la URL del API desde `/config.js` (variable
`NEXO_API_URL`). El API usa la `DATABASE_URL` interna que Render inyecta desde `nexo-db`. La base
no está expuesta al navegador: solo el API la consulta.

## 1. Base de datos

| Qué | Dónde |
| --- | --- |
| Conexión y pool PostgreSQL | `apps/api/src/database/database.service.ts` |
| Esquema completo (tablas, índices, checks) | `apps/api/sql/schema.postgres.sql` |
| Migración MySQL → PostgreSQL | `apps/api/scripts/migrate-to-postgres.mjs` |
| Configuración de entorno | `apps/api/src/config/env.ts` |
| Variables de ejemplo | `apps/api/.env.example` |
| Scripts npm | `apps/api/package.json` (`migrate:pg`) |

La conexión se toma de `DATABASE_URL` si existe (Railway, Render, Neon, Supabase) y, si no, de
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y `DB_NAME`. El pool está en
`DatabaseService.pool` y traduce los marcadores `?` del código a `$1..$n` de PostgreSQL.

La base local de desarrollo se llama `nexo`, con usuario `nexo` en `127.0.0.1:5432`.

## 2. Backend (NestJS)

Punto de entrada: `apps/api/src/main.ts`.

```text
apps/api/src/
  main.ts                 bootstrap, Helmet, CORS, validación de entorno y puerto
  app.module.ts           módulos, ConfigModule y Throttler
  health.controller.ts    GET /api/health
  auth/                   login, registro, JWT, perfil y contraseña
  tickets/                tickets, SLA, evidencias, comentarios y CSV
  kedb/                   artículos de la base de conocimiento
  notificaciones/         avisos por usuario
  admin/                  usuarios, métricas, SLA, auditoría y exportaciones
  database/               pool de PostgreSQL
  common/                 guards, decoradores, constantes y filtro de errores
  config/                 carga de .env y rutas de uploads
```

Archivos clave:

- `apps/api/src/auth/auth.service.ts`: registro con rol forzado `Usuario`, login y perfil.
- `apps/api/src/auth/jwt.strategy.ts`: validación del JWT y recarga del rol real desde PostgreSQL.
- `apps/api/src/common/roles.guard.ts`: autorización por rol.
- `apps/api/src/common/jwt-auth.guard.ts`: exige token válido.
- `apps/api/src/admin/admin.controller.ts`: todos los endpoints `/api/admin/*` con
  `@Roles('Administrador')`.
- `apps/api/src/tickets/tickets.controller.ts`: endpoints de tickets y evidencias.
- `apps/api/src/tickets/tickets.service.ts`: reglas de negocio, propiedad de tickets, SLA,
  triaje, historial y notificaciones.
- `apps/api/src/common/constants.ts`: catálogos, transiciones, SLA y motor de triaje.

## 3. Frontend (Next.js)

Punto de entrada: `apps/web/src/app/layout.tsx`.

```text
apps/web/
  public/
    landing/              landing pública servida en /
    presentacion.html     presentación original
    favicon.svg
  src/app/
    layout.tsx            providers globales, fuentes y /config.js
    page.tsx              redirección de la raíz a la landing (rewrite)
    app/page.tsx          login y registro (/app)
    dashboard/            tablero por rol
    nuevo/                creación de ticket
    mis/                  mis tickets y filtros (/mis/[filtro])
    triaje/               cola del staff
    ticket/[id]/          detalle del ticket
    kedb/                 base de conocimiento
    perfil/               perfil del usuario
    admin/[tab]/          consola de administración (6 pestañas)
    config.js/route.ts    URL runtime de la API
  src/components/         Shell, AuthProvider, tablas, modales, toasts, iconos
  src/lib/api.ts          cliente HTTP, token y endpoints
  next.config.ts          rewrite de / a la landing
```

Configuración del API en el navegador:

- Desarrollo: `NEXT_PUBLIC_API_URL=http://localhost:3001/api`.
- Producción: `NEXO_API_URL=https://tu-api.ejemplo.com/api` en el servicio web. El valor se sirve
  en `/config.js` y no requiere recompilar Next.js.
- `src/lib/api.ts` elimina la barra final y añade el token JWT a cada petición.

## 4. Infraestructura y despliegue

| Archivo | Uso |
| --- | --- |
| `apps/api/Dockerfile` | Imagen de producción del API |
| `apps/web/Dockerfile` | Imagen de producción del frontend |
| `.dockerignore` | Exclusiones de build |
| `render.yaml` | Blueprint de Render (API + PostgreSQL + Web) |
| `apps/api/railway.toml` | Configuración del servicio API en Railway |
| `apps/web/railway.toml` | Configuración del servicio Web en Railway |
| `docs/DESPLIEGUE.md` | Guía paso a paso |
| `docs/SEGURIDAD.md` | Modelo de roles y checklist de seguridad |

## 5. Rutas del frontend

| Ruta | Acceso | Pantalla |
| --- | --- | --- |
| `/` | Público | Landing de Nexo |
| `/app` | Público | Login y registro |
| `/dashboard` | Autenticado | Tablero según rol |
| `/nuevo` | Autenticado | Nuevo ticket |
| `/mis`, `/mis/[filtro]` | Autenticado | Mis tickets |
| `/triaje` | Staff | Cola priorizada |
| `/ticket/[id]` | Dueño o staff | Detalle del ticket |
| `/kedb` | Autenticado | Base de conocimiento |
| `/perfil` | Autenticado | Perfil y contraseña |
| `/admin/[tab]` | Administrador | Métricas, seguimiento, usuarios, SLA, KEDB y auditoría |
| `/presentacion.html` | Público | Presentación original |

## 6. Endpoints del backend

Todos los endpoints llevan el prefijo `/api`.

| Método | Ruta | Rol mínimo |
| --- | --- | --- |
| GET | `/health` | Público |
| POST | `/auth/registro` | Público (siempre crea `Usuario`) |
| POST | `/auth/login` | Público |
| GET | `/auth/me` | Autenticado |
| PATCH | `/auth/perfil` | Autenticado |
| PATCH | `/auth/password` | Autenticado |
| POST | `/tickets` | Autenticado |
| GET | `/tickets/resumen` | Autenticado (filtra por dueño si no es staff) |
| GET | `/tickets/mis-tickets` | Autenticado |
| GET | `/tickets/analistas` | Staff |
| GET | `/tickets` | Staff |
| GET | `/tickets/:id` | Dueño o staff |
| PATCH | `/tickets/:id/asignar` | Staff |
| PATCH | `/tickets/:id/estado` | Staff |
| POST | `/tickets/:id/escalar` | Staff |
| POST | `/tickets/:id/confirmar` | Dueño |
| POST | `/tickets/:id/evidencias` | Dueño o staff |
| GET | `/tickets/:id/evidencias/:idEvidencia/descarga` | Dueño o staff (cuarentena solo admin) |
| PATCH | `/tickets/evidencias/:idEvidencia/cuarentena` | Staff |
| POST | `/tickets/:id/comentarios` | Dueño o staff |
| GET | `/kedb`, `/kedb/:id` | Autenticado |
| POST/PUT/DELETE | `/kedb`, `/kedb/:id` | Administrador |
| GET | `/notificaciones` | Autenticado |
| PATCH | `/notificaciones/:id/leida` | Dueño |
| POST | `/notificaciones/leer-todas` | Autenticado |
| GET/POST/PATCH | `/admin/usuarios*` | Administrador |
| GET | `/admin/metricas` | Administrador |
| GET/PUT | `/admin/sla` | Administrador |
| GET | `/admin/exportar/tickets.csv` | Administrador |
| GET | `/admin/exportar/usuarios.csv` | Administrador |
| GET | `/admin/auditoria` | Administrador |

La referencia detallada con cuerpos de ejemplo está en `docs/API.md`.
