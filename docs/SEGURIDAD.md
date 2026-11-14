# Seguridad de Nexo

## Modelo de roles

| Rol | Alcance |
| --- | --- |
| `Usuario` | Crea tickets, ve solo los suyos, comenta, adjunta evidencias y confirma cierres |
| `Analista L1` | Ve la cola global, asigna, cambia estados, escala a L2/SOC y libera cuarentena |
| `Administrador` | Todo lo del analista + usuarios, roles, SLA, KEDB, métricas, auditoría y exportaciones |

`ES_STAFF = ['Analista L1', 'Administrador']` está definido en
`apps/api/src/common/constants.ts`.

## Defensas contra escalada de privilegios

### Registro público

`apps/api/src/auth/auth.service.ts` inserta el rol literal `'Usuario'` en el SQL. Aunque el cliente
envíe `{ "rol": "Administrador" }`, el valor se ignora por completo.

### Token JWT

- El JWT incluye `sub`, `rol` y `email`, pero **no se confía en el rol del token**.
- `apps/api/src/auth/jwt.strategy.ts` consulta `usuarios` en cada petición y usa el rol actual de
  PostgreSQL.
- Si un administrador degrada a un usuario o desactiva su cuenta, el token viejo deja de otorgar
  privilegios de inmediato.
- `JWT_SECRET` se valida al arrancar en producción: exige 32 caracteres o más y rechaza los
  valores de ejemplo. La API no arranca con un secreto inseguro.

### Guards

```text
JwtAuthGuard  -> valida el token y carga el usuario real
RolesGuard    -> compara user.rol contra @Roles(...)
```

`AdminController` tiene `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles('Administrador')` a nivel
de clase. Por tanto **todos** los endpoints `/api/admin/*` quedan cerrados a usuarios y analistas,
incluidos los que se añadan en el futuro dentro de ese controlador.

### Perfil y contraseña

`PATCH /api/auth/perfil` solo actualiza `nombre`, `apellido`, `telefono` y `fecha_nacimiento`.
No acepta `rol`, `activo`, `email` ni `password_hash`. El cambio de contraseña exige la contraseña
actual.

### Propiedad de tickets (IDOR)

`TicketsService.autorizado()` carga el ticket y, si el usuario no es staff, exige
`id_solicitante === user.id_usuario`. Se aplica en:

- detalle del ticket,
- comentarios,
- subida y descarga de evidencias,
- confirmación de cierre.

Los endpoints de gestión (`asignar`, `estado`, `escalar`, `cuarentena`) además tienen
`@Roles(...ES_STAFF)`. `confirmar` exige que el usuario sea el solicitante, incluso si es staff.

### Evidencias

- Se guardan con nombre UUID, nunca con el nombre original.
- Entran en cuarentena (`en_cuarentena = TRUE`) y no son accesibles por URL pública.
- La descarga pasa por el API y valida que la evidencia pertenezca al ticket.
- Solo un administrador puede descargar un archivo en cuarentena.
- La ruta se resuelve y se comprueba que esté dentro de `UPLOADS_DIR` o `LEGACY_UPLOADS_DIR`
  (defensa contra path traversal).
- Se sirven como `application/octet-stream` con `X-Content-Type-Options: nosniff`.

### Notificaciones

`GET /api/notificaciones` filtra por `id_usuario` de la sesión. Marcar como leída usa
`WHERE id_notificacion = ? AND id_usuario = ?`, por lo que un usuario no puede alterar las
notificaciones de otro.

### Administración de usuarios

- Crear y editar usuarios exige `Administrador`.
- Un administrador no puede quitarse su propio rol ni desactivar su propia cuenta.
- Los roles se validan contra `ROLES = ['Usuario', 'Analista L1', 'Administrador']`.
- Los correos se normalizan a minúsculas y son únicos.

## Otras medidas

| Medida | Implementación |
| --- | --- |
| Hash de contraseñas | bcrypt con costo 10 |
| Rate limit login | 20 intentos / 15 minutos por IP |
| Rate limit registro | 30 cuentas / hora por IP |
| Proxy real | `trust proxy` para Render/Railway/Vercel |
| Cabeceras | Helmet en el API |
| CORS | Lista blanca en `WEB_ORIGIN` |
| Body JSON | Límite por defecto de Express/Nest |
| Errores | Filtro global que no expone stack traces |
| Secretos | Variables de entorno; `.env` fuera de Git |
| SQL | Consultas parametrizadas y traducción `? -> $n` |

## Checklist antes de publicar

- [ ] `JWT_SECRET` aleatorio de 48 bytes y distinto al de desarrollo.
- [ ] Contraseñas de `admin@nexo.com`, `analista@nexo.com` y `usuario@nexo.com` cambiadas.
- [ ] `WEB_ORIGIN` restringido al dominio real del frontend (sin `*`).
- [ ] `DATABASE_URL` con SSL si el proveedor lo exige (`DB_SSL=true` o `sslmode=require`).
- [ ] HTTPS en frontend y API (los proveedores lo dan automáticamente).
- [ ] Volumen persistente para `uploads/evidencias` o almacenamiento de objetos.
- [ ] Copia de seguridad de la base antes de restaurar un dump.
- [ ] Verificar con un usuario normal que `/api/admin/*` responde `403`.

## Pruebas manuales de autorización

Con la API local en `http://localhost:3001/api`:

```powershell
$base = 'http://localhost:3001/api'

# 1. Login como usuario normal
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" `
  -ContentType 'application/json' `
  -Body (@{ email = 'usuario@ejemplo.com'; password = 'TU_CLAVE' } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.token)" }

# 2. La consola admin debe responder 403
try { Invoke-RestMethod "$base/admin/usuarios" -Headers $h } catch {
  "admin/usuarios -> $($_.Exception.Response.StatusCode.value__)"   # 403
}
try { Invoke-RestMethod "$base/admin/metricas" -Headers $h } catch {
  "admin/metricas -> $($_.Exception.Response.StatusCode.value__)"   # 403
}

# 3. El rol del usuario debe seguir siendo Usuario
(Invoke-RestMethod "$base/auth/me" -Headers $h).usuario.rol           # Usuario

# 4. Un ticket ajeno debe responder 403
try { Invoke-RestMethod "$base/tickets/2" -Headers $h } catch {
  "ticket ajeno -> $($_.Exception.Response.StatusCode.value__)"     # 403 (si el ticket no es suyo)
}
```

Prueba de que el registro ignora el rol:

```powershell
$email = "prueba-$([guid]::NewGuid().ToString('N').Substring(0,8))@nexo.com"
$r = Invoke-RestMethod -Method Post -Uri "$base/auth/registro" `
  -ContentType 'application/json' `
  -Body (@{ nombre='Prueba'; email=$email; password='TuClaveSegura'; rol='Administrador' } | ConvertTo-Json)
$r.usuario.rol   # Usuario
```

## Limitaciones conocidas

- No hay verificación de correo, recuperación de contraseña ni MFA.
- El token se guarda en `localStorage`; una vulnerabilidad XSS podría robarlo. El frontend no usa
  `dangerouslySetInnerHTML` con datos de usuario, pero conviene migrar a cookies `httpOnly` si el
  proyecto crece.
- El rate limit es en memoria: con varias instancias del API cada una lleva su propio contador.
- Las evidencias en disco requieren volumen persistente; sin él se pierden al reiniciar el
  contenedor.
- La cuarentena es un estado lógico: no analiza el contenido del archivo con antivirus.
