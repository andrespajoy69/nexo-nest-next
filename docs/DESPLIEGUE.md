# Guía de despliegue

Objetivo: publicar PostgreSQL, el API NestJS y el frontend Next.js en Internet con HTTPS, sin
depender de la PC local.

## Resumen de arquitectura en la nube

```text
Usuario ──HTTPS──► https://nexo-web...   (Next.js)
                         │
                         │ NEXO_API_URL
                         ▼
                    https://nexo-api...   (NestJS, prefijo /api)
                         │
                         ▼
                    PostgreSQL administrado
```

Hay dos caminos equivalentes:

| Opción | Backend + base | Frontend | Cuentas |
| --- | --- | --- | --- |
| A (recomendada) | Render (Docker + PostgreSQL) | Render o Vercel | Render (+ Vercel si se separa) |
| B | Railway (Docker + PostgreSQL) | Railway o Vercel | Railway (+ Vercel) |
| C | Render API + Neon PostgreSQL | Vercel | Render + Neon + Vercel |

El repositorio ya incluye `render.yaml` y los Dockerfiles, así que la opción A es la más rápida.

## Variables de entorno

### API

| Variable | Obligatoria | Ejemplo | Notas |
| --- | --- | --- | --- |
| `NODE_ENV` | Sí | `production` | Activa las validaciones estrictas |
| `PORT` | No | `3001` | Render/Railway lo inyectan |
| `DATABASE_URL` | Sí en cloud | `postgresql://...` | Tiene prioridad sobre `DB_*` |
| `DB_SSL` | Según proveedor | `true` | Neon/Supabase suelen exigirlo |
| `JWT_SECRET` | Sí | 48 bytes aleatorios | Mínimo 32 caracteres en producción |
| `JWT_EXPIRA` | No | `8h` | Duración del token |
| `WEB_ORIGIN` | Sí | `https://nexo.vercel.app` | Dominios del frontend separados por coma |
| `UPLOADS_DIR` | No | `uploads/evidencias` | Ruta del volumen de evidencias |
| `DB_POOL_MAX` | No | `10` | Conexiones simultáneas |

Generar el secreto:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Frontend

| Variable | Obligatoria | Ejemplo | Notas |
| --- | --- | --- | --- |
| `NEXO_API_URL` | Sí | `https://nexo-api.onrender.com/api` | Se sirve en `/config.js` en runtime |
| `NEXT_PUBLIC_API_URL` | Alternativa | `https://.../api` | Se incrusta en el build |
| `PORT` | No | `3000` | Next.js lo usa al arrancar |

No pongas la barra final en la URL del API.

## Opción A: Render (todo en uno)

1. Crea una cuenta en <https://render.com> con GitHub y autoriza el repositorio
   `andrespajoy69/nexo-nest-next`.
2. En Render: **New > Blueprint** y selecciona el repositorio. Render leerá `render.yaml` y
   propondrá:
   - `nexo-db`: PostgreSQL.
   - `nexo-api`: API NestJS con Docker.
   - `nexo-web`: frontend Next.js con Docker.
3. Introduce las variables que Render marcará como pendientes:
   - En `nexo-api`, `WEB_ORIGIN`: al principio puedes poner `*` para el primer arranque; después
     cámbialo por el dominio real del frontend.
   - En `nexo-web`, `NEXO_API_URL`: la URL pública del API + `/api`, por ejemplo
     `https://nexo-api.onrender.com/api`.
4. Pulsa **Apply**. Espera a que los tres recursos estén disponibles.
5. Copia las URLs reales:
   - API: `https://nexo-api.onrender.com`
   - Web: `https://nexo-web.onrender.com`
6. Vuelve a `nexo-api > Environment` y ajusta:
   ```env
   WEB_ORIGIN=https://nexo-web.onrender.com
   ```
   Si usas un dominio propio, añade también ese dominio separado por coma.
7. Redeploy del API para aplicar CORS.

> En el plan gratuito los servicios web se suspenden por inactividad y la primera petición puede
> tardar hasta un minuto. Si Render ya no ofrece PostgreSQL gratuito en tu cuenta, crea la base en
> Neon (opción C) y usa su `DATABASE_URL` en `nexo-api`.

### Restaurar los datos locales en Render

El dump local está en `backup/nexo-local.sql` (no se sube a Git porque contiene datos reales).

1. En Render, abre `nexo-db > Connect` y copia la **External Database URL**.
2. Ejecuta:

```powershell
$env:PGURL = 'postgresql://usuario:password@host:5432/nexo?sslmode=require'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" $env:PGURL -f backup/nexo-local.sql
```

3. Verifica los conteos:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" $env:PGURL -c "SELECT (SELECT COUNT(*) FROM usuarios) AS usuarios, (SELECT COUNT(*) FROM tickets) AS tickets, (SELECT COUNT(*) FROM kedb_articulos) AS kedb;"
```

4. Si la base está vacía y no tienes dump, crea el esquema y un administrador:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" $env:PGURL -f apps/api/sql/schema.postgres.sql
$env:ADMIN_EMAIL = 'admin@tudominio.com'
$env:ADMIN_PASSWORD = 'UnaClaveLarga123'
npm run seed:admin --workspace @nexo/api
```

> `schema.postgres.sql` elimina y recrea las tablas. No lo ejecutes sobre una base con datos.

## Opción A2: Render API + Vercel Web

1. Despliega solo el API y la base con el blueprint (puedes comentar el servicio `nexo-web`).
2. En Vercel: **Add New > Project > Import Git Repository**.
3. Configura:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: Next.js
   - **Install Command**: `cd ../.. && npm ci`
   - **Build Command**: `cd ../.. && npm run build --workspace @nexo/web`
   - **Output Directory**: `.next`
4. Variable de entorno:
   ```env
   NEXO_API_URL=https://nexo-api.onrender.com/api
   ```
5. Deploy. Copia el dominio `https://tu-proyecto.vercel.app`.
6. En Render, actualiza `WEB_ORIGIN=https://tu-proyecto.vercel.app` y redeploy del API.

Con CLI (opcional):

```powershell
npm install -g vercel
cd apps/web
vercel
vercel --prod
```

## Opción B: Railway

Railway puede alojar API, base y frontend en un solo proyecto.

1. Crea una cuenta en <https://railway.com> y un proyecto vacío.
2. **New > Database > PostgreSQL**.
3. **New > GitHub Repo > nexo-nest-next** para el API:
   - Settings > Build > Dockerfile: `apps/api/Dockerfile`
   - Config-as-code: `apps/api/railway.toml`
   - Variables:
     ```env
     NODE_ENV=production
     JWT_SECRET=<secreto-de-48-bytes>
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     DB_SSL=false
     WEB_ORIGIN=https://<dominio-del-frontend>
     UPLOADS_DIR=uploads/evidencias
     ```
   - Settings > Networking > **Generate Domain**.
4. Añade un volumen persistente montado en `/app/apps/api/uploads/evidencias` si quieres conservar
   evidencias.
5. Repite **New > GitHub Repo** para el frontend:
   - Dockerfile: `apps/web/Dockerfile`
   - Config-as-code: `apps/web/railway.toml`
   - Variable `NEXO_API_URL=https://<dominio-del-api>/api`
   - Generate Domain.
6. Actualiza `WEB_ORIGIN` con el dominio real del frontend y redeploy.

> Railway puede pedir método de pago o consumir crédito de prueba. Render suele ser más sencillo
> para un plan gratuito.

## Opción C: Neon para PostgreSQL

Si Render no te da base gratuita:

1. Crea un proyecto en <https://neon.tech> (puedes entrar con GitHub).
2. Copia la cadena **Pooled connection** con `sslmode=require`.
3. En el API configura:
   ```env
   DATABASE_URL=postgresql://...?sslmode=require
   DB_SSL=true
   ```
4. Restaura el dump con `psql "$env:PGURL" -f backup/nexo-local.sql`.

## Verificación posterior al despliegue

```powershell
# Salud del API
Invoke-RestMethod https://TU-API/api/health

# La landing debe cargar
Invoke-WebRequest https://TU-WEB -UseBasicParsing | Select-Object StatusCode

# Login real
$base = 'https://TU-API/api'
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body (@{ email='usuario@nexo.com'; password='123456' } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.token)" }

# Debe devolver 403
try { Invoke-RestMethod "$base/admin/usuarios" -Headers $h } catch {
  $_.Exception.Response.StatusCode.value__
}
```

Prueba también desde el navegador de un teléfono conectado a otra red:

1. Abre la URL del frontend.
2. Inicia sesión con los tres roles.
3. Crea un ticket como usuario, gestionalo como analista y revisa métricas como administrador.
4. Sube una evidencia y descárgala como administrador.
5. Exporta un CSV desde la consola admin.

## Evidencias y persistencia

El API guarda los archivos en `UPLOADS_DIR` (por defecto `apps/api/uploads/evidencias`). En un
contenedor sin volumen, los archivos se pierden al redeploy o reinicio.

Opciones:

- Render: disco persistente en un plan pago, montado en `/app/apps/api/uploads/evidencias`.
- Railway: volumen montado en la misma ruta.
- Almacenamiento externo (S3, Cloudflare R2, Supabase Storage): requiere adaptar
  `TicketsService.subirEvidencias` y `rutaDescarga`.

La base de datos sí conserva los metadatos de la evidencia; si el archivo desaparece, la descarga
responde «El archivo ya no está disponible».

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| El frontend muestra «No se pudo conectar con el servidor» | `NEXO_API_URL` incorrecta o API dormido | Revisa `/config.js`, despierta el API y verifica `/api/health` |
| Error CORS en la consola | `WEB_ORIGIN` no incluye el dominio real | Añade el dominio exacto y redeploy del API |
| El API no arranca | Falta `JWT_SECRET` o `WEB_ORIGIN` | Configura ambas variables |
| `password authentication failed` | `DATABASE_URL` incorrecta | Copia de nuevo la cadena y revisa la contraseña |
| `self signed certificate` | SSL mal configurado | Usa `DB_SSL=true` o `sslmode=require` |
| 502 en Render | Health check fallando | Revisa logs del servicio y `/api/health` |
| Imágenes/evidencias desaparecen | Sin volumen persistente | Monta un disco o usa almacenamiento externo |
| Cold start lento | Plan gratuito de Render | Primera petición tarda; considera plan pago |

## Actualizaciones

```powershell
git add -A
git commit -m "Despliegue y documentación"
git push origin main
```

Render y Vercel pueden redesplegar automáticamente al detectar el push (`autoDeploy: true` en
`render.yaml`). Si no, usa **Manual Deploy** en el panel.
