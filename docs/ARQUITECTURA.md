# Arquitectura de Nexo

Nexo es una mesa de ayuda de TI y ciberseguridad compuesta por tres piezas desplegables de forma
independiente:

```text
Navegador
   │ HTTPS
   ├──────────────► Frontend Next.js (apps/web)
   │                   │ fetch HTTPS + JWT Bearer
   │                   ▼
   │                Backend NestJS (apps/api) ──► PostgreSQL (base nexo)
   │                   │
   │                   └──► Disco de evidencias (uploads/evidencias)
   │
   └──────────────► Descarga autenticada de evidencias a través del API
```

## Componentes

| Componente | Tecnología | Carpeta | Puerto local |
| --- | --- | --- | --- |
| Frontend | Next.js 15 (App Router) + React 19 | `apps/web` | 3002 |
| Backend | NestJS 11 + TypeScript | `apps/api` | 3001 |
| Base de datos | PostgreSQL 17 (`pg`) | `apps/api/sql` | 5432 |
| Evidencias | Disco local (multer) | `apps/api/uploads/evidencias` | — |

El backend expone todo bajo el prefijo `/api`. El frontend consume ese prefijo mediante
`NEXT_PUBLIC_API_URL` o, en producción, mediante la configuración runtime `/config.js`
(variable `NEXO_API_URL`).

## Flujo de autenticación

1. `POST /api/auth/login` valida correo y contraseña con bcrypt y devuelve un JWT firmado.
2. El frontend guarda el token en `localStorage` (`nexo_token`) y lo envía como
   `Authorization: Bearer <token>`.
3. `JwtStrategy` verifica la firma y **vuelve a leer el usuario y su rol desde PostgreSQL** en
   cada petición. Si el rol cambió o la cuenta se desactivó, el token deja de servir para escalar.
4. `RolesGuard` compara el rol real contra los roles declarados con `@Roles(...)`.
5. `JwtAuthGuard` protege todos los controladores que requieren sesión.

Consecuencia: un usuario normal no puede convertirse en administrador manipulando el body de
registro, el token ni los parámetros de la URL. El único camino para cambiar el rol es
`PATCH /api/admin/usuarios/:id`, que exige rol `Administrador` y queda registrado en auditoría.

## Flujo de tickets

1. El usuario autenticado crea un ticket (`POST /api/tickets`). El servidor ignora cualquier
   `rol` enviado y usa el `id_usuario` de la sesión como solicitante.
2. `analizarTriaje()` eleva la urgencia según palabras clave de ciberseguridad.
3. Se calculan los vencimientos SLA con la configuración guardada en `configuracion`.
4. El staff (`Analista L1`, `Administrador`) ve la cola global, asigna, cambia de estado y escala
   a L2/SOC. El usuario solo ve sus propios tickets.
5. Cada acción escribe en `ticket_historial` y genera notificaciones.
6. El solicitante puede comentar, adjuntar evidencias y confirmar el cierre de un ticket resuelto.

## Modelo de datos principal

| Tabla | Contenido |
| --- | --- |
| `usuarios` | Cuentas, hash bcrypt, rol, estado activo y datos de perfil |
| `tickets` | Solicitud, categoría, urgencia, estado, SLA, asignación y escalamiento |
| `ticket_historial` | Trazabilidad de acciones y transiciones de estado |
| `comentarios` | Comentarios públicos y notas internas del staff |
| `evidencias` | Metadatos, hash SHA-256 y cuarentena de archivos |
| `notificaciones` | Avisos por usuario y estado de lectura |
| `kedb_articulos` | Base de conocimiento y contador de lecturas |
| `configuracion` | Parámetros de SLA en JSON |
| `legacy_*` | Tablas históricas conservadas de la migración |

El esquema completo está en `apps/api/sql/schema.postgres.sql`.

## Registro de decisiones

- **Monorepo npm workspaces** para compartir dependencias y facilitar un único despliegue.
- **PostgreSQL como base activa**; MySQL solo se usa en el script de migración.
- **JWT con recarga de rol desde la base** para revocar privilegios sin esperar la expiración.
- **Landing pública en `/`** y aplicación autenticada en `/app` (el resto de rutas son del App
  Router).
- **Evidencias en disco** con descarga autenticada; en cloud requieren volumen persistente o
  almacenamiento de objetos.
- **Configuración runtime del API en el frontend** para no recompilar la imagen al cambiar de
  dominio.
