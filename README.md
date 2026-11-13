# Nexo · NestJS + Next.js + PostgreSQL

Migración de la mesa de ayuda Nexo desde Express + MySQL + frontend estático hacia un monorepo con:

- **API** en NestJS (`apps/api`), TypeScript y PostgreSQL mediante `pg`.
- **Web** en Next.js 15 con App Router (`apps/web`).
- **PostgreSQL 17** como base de datos activa.
- **MySQL** solo como origen para migrar los datos existentes.

La aplicación original (`C:\Users\andre\OneDrive\Escritorio\nexo`) no se modifica.

## Requisitos

- Node.js 20 o superior (probado con Node 26).
- PostgreSQL 17 en `127.0.0.1:5432`.
- MySQL 8 opcional, solo si se van a volver a migrar datos desde la app original.

## Puesta en marcha

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

4. Revisar `apps/api/.env`:

   ```env
   PORT=3001
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_USER=nexo
   DB_PASSWORD=nexo
   DB_NAME=nexo

   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=
   MYSQL_DATABASE=mesa_ayuda_ciberseguridad

   JWT_SECRET=cambiar-en-produccion
   JWT_EXPIRA=8h
   WEB_ORIGIN=http://localhost:3002
   UPLOADS_DIR=uploads/evidencias
   LEGACY_UPLOADS_DIR=C:\Users\andre\OneDrive\Escritorio\nexo\uploads\evidencias
   ```


## Desarrollo

```powershell
npm run dev:api
npm run dev:web
```

`dev:api` compila con `tsc` y ejecuta `node dist/main.js`; no usa `ts-node`, para conservar
`emitDecoratorMetadata` que necesita NestJS.

## Estructura

```text
apps/
  api/
    sql/schema.postgres.sql
    scripts/migrate-to-postgres.mjs
    src/
      auth/            login, registro, perfil y contraseña
      tickets/         flujos, SLA, evidencias y CSV
      kedb/            base de conocimiento
      notificaciones/  avisos por usuario
      admin/           métricas, usuarios, SLA, auditoría y exportaciones
      database/        pool de PostgreSQL y traducción de placeholders
  web/
    public/            landing, presentación original y favicon
    src/app/           rutas del App Router
    src/components/    Shell, AuthProvider, modales, toasts y consola admin
    src/lib/           cliente API, formato, catálogos y constantes
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


