# Nexo · NestJS + Next.js + PostgreSQL

Mesa de ayuda de TI y ciberseguridad con backend NestJS, frontend Next.js y PostgreSQL.

## Aplicación publicada

| Componente | URL / ubicación |
| --- | --- |
| Frontend Next.js | <https://nexo-web-lpyd.onrender.com> |
| Entrada / login | <https://nexo-web-lpyd.onrender.com/app> |
| API NestJS | <https://nexo-api-k5cu.onrender.com/api> |
| Salud del API | <https://nexo-api-k5cu.onrender.com/api/health> |
| Base de datos | Render PostgreSQL `nexo-db` (Oregon, base `nexo_xz9w`) |
| Repositorio | <https://github.com/andrespajoy69/nexo-nest-next> |

El despliegue usa el Blueprint `nexo` de Render (`render.yaml`), con servicios `nexo-web`,
`nexo-api` y `nexo-db`. Los detalles, identificadores y pasos de actualización están en
[`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md#despliegue-actual).

> **Plan gratuito:** los servicios web se suspenden por inactividad (la primera petición puede
> tardar ~50 segundos) y PostgreSQL gratuito expira el **13 de diciembre de 2026**. Las evidencias
> se guardan en disco efímero: se pierden al redeploy. Para producción real, cambia a un plan pago
> con disco persistente o almacenamiento de objetos.

## Documentación

| Documento | Contenido |
| --- | --- |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Componentes, flujos, modelo de datos y decisiones |
| [`docs/MAPA-CODIGO.md`](docs/MAPA-CODIGO.md) | Dónde está la base de datos, el backend y el frontend en el código |
| [`docs/API.md`](docs/API.md) | Endpoints, cuerpos JSON y códigos de error |
| [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) | Roles, defensas contra escalada, IDOR y checklist |
| [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) | Render, Railway, Vercel, Neon y restauración de datos |

## Requisitos

- Node.js 20 o superior (probado con Node 22/26).
- PostgreSQL 17 en `127.0.0.1:5432`.
- MySQL 8 opcional, solo si se van a volver a migrar datos desde la app original.
- Docker opcional, solo para probar las imágenes de producción.

## Puesta en marcha local

1. Instalar dependencias:

   ```powershell
   npm install
   ```

2. Crear el rol y la base en PostgreSQL:

   ```sql
   CREATE ROLE nexo LOGIN PASSWORD 'nexo';
   CREATE DATABASE nexo OWNER nexo;
   ```

3. Crear el esquema:

   ```powershell
   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U nexo -h 127.0.0.1 -d nexo -f apps/api/sql/schema.postgres.sql
   ```

4. Crear `apps/api/.env` a partir de `apps/api/.env.example` y revisar:

   ```env
   PORT=3001
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_USER=nexo
   DB_PASSWORD=nexo
   DB_NAME=nexo

   JWT_SECRET=cambia-este-secreto
   JWT_EXPIRA=8h
   WEB_ORIGIN=http://localhost:3002
   UPLOADS_DIR=uploads/evidencias
   ```

5. Cargar datos (elige una opción):

   - Restaurar un dump PostgreSQL:
     ```powershell
     & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U nexo -h 127.0.0.1 -d nexo -f backup/nexo-local.sql
     ```
   - Crear solo un administrador:
     ```powershell
     $env:ADMIN_EMAIL='admin@tu-dominio.com'
     $env:ADMIN_PASSWORD='UnaClaveLarga123'
     npm run seed:admin
     ```
   - Migrar desde MySQL (solo si vuelves a usar la app original):
     ```powershell
     npm run migrate:pg
     ```

## Desarrollo

```powershell
npm run dev:api
npm run dev:web
```

`dev:api` compila con `tsc` y ejecuta `node dist/main.js`; no usa `ts-node`, para conservar
`emitDecoratorMetadata` que necesita NestJS.

- API: `http://localhost:3001/api`
- Landing: `http://localhost:3002`
- Login/registro: `http://localhost:3002/app`
- Presentación original: `http://localhost:3002/presentacion.html`

## Despliegue en Internet

La vía más rápida es **Render** con el blueprint incluido:

1. Sube el repositorio a GitHub.
2. En Render: **New > Blueprint** y selecciona el repositorio.
3. Render crea `nexo-db`, `nexo-api` y `nexo-web` desde `render.yaml`.
4. Configura `NEXO_API_URL` en el frontend y `WEB_ORIGIN` en el API.
5. Restaura `backup/nexo-local.sql` en la base.

Los detalles, la alternativa Railway/Vercel/Neon y la verificación están en
[`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md).

## Seguridad

- El registro público siempre crea rol `Usuario`; ignora cualquier `rol` del body.
- El JWT se firma con `JWT_SECRET` y el rol se recarga desde PostgreSQL en cada petición.
- Todos los endpoints `/api/admin/*` exigen `Administrador` con `JwtAuthGuard + RolesGuard`.
- Los usuarios solo acceden a sus propios tickets; el staff tiene acceso global.
- Las evidencias están en cuarentena, se descargan mediante el API y se valida la ruta.
- En producción la API no arranca sin un `JWT_SECRET` de 32+ caracteres ni sin `WEB_ORIGIN`.
- Login y registro tienen rate limiting.

Checklist y pruebas de autorización: [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md).

## Estructura

```text
apps/
  api/
    Dockerfile
    sql/schema.postgres.sql
    scripts/migrate-to-postgres.mjs
    scripts/seed-admin.mjs
    src/
      auth/            login, registro, perfil y contraseña
      tickets/         flujos, SLA, evidencias y CSV
      kedb/            base de conocimiento
      notificaciones/  avisos por usuario
      admin/           métricas, usuarios, SLA, auditoría y exportaciones
      database/        pool de PostgreSQL y traducción de placeholders
  web/
    Dockerfile
    public/            landing, presentación original y favicon
    src/app/           rutas del App Router
    src/components/    Shell, AuthProvider, modales, toasts y consola admin
    src/lib/           cliente API, formato, catálogos y constantes
docs/                  arquitectura, API, seguridad, despliegue y mapa de código
render.yaml            blueprint de Render
```

## Funcionalidad conservada

- Login con JWT, registro y tres roles: `Usuario`, `Analista L1`, `Administrador`.
- Radicación de tickets con borrador local, plantillas, campos específicos y sugerencias KEDB.
- Triaje automático, cola priorizada, filtros, auto-refresco y semáforo SLA.
- Asignación, escalamiento L2/SOC, cambios de estado, resolución y confirmación de cierre.
- Comentarios públicos y notas internas, evidencias en cuarentena y descarga.
- Notificaciones, perfil y cambio de contraseña.
- Consola admin: métricas, seguimiento global, usuarios, SLA, KEDB y auditoría.
- Exportación CSV de tickets y usuarios.
- Landing pública en `/`, aplicación en `/app` y presentación original en `/presentacion.html`.

> Las cuentas de prueba se crean con `seed:admin` o se restauran desde el dump. Define
> contraseñas robustas antes de publicar la aplicación en Internet.
