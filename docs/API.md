# Referencia del API

Base local: `http://localhost:3001/api`

Autenticación: `Authorization: Bearer <token>` en todas las rutas salvo las públicas indicadas.
Los errores devuelven JSON con `{ "error": "mensaje" }` y el código HTTP correspondiente.

## Salud

### `GET /api/health` (público)

```json
{
  "ok": true,
  "servicio": "Nexo API",
  "stack": "NestJS",
  "base_de_datos": "conectada",
  "fecha": "2026-11-13T12:00:00.000Z"
}
```

## Autenticación

### `POST /api/auth/registro` (público)

```json
{
  "nombre": "Ana",
  "apellido": "Pérez",
  "email": "ana@ejemplo.com",
  "password": "secreto123",
  "telefono": "3001234567",
  "fecha_nacimiento": "2000-05-20"
}
```

El servidor ignora cualquier `rol` enviado y crea la cuenta como `Usuario`. Devuelve
`{ token, usuario }`.

### `POST /api/auth/login` (público)

```json
{ "email": "usuario@ejemplo.com", "password": "TuClaveSegura" }
```

Devuelve `{ token, usuario }`. Límite: 20 intentos cada 15 minutos por IP.

### `GET /api/auth/me`

Devuelve `{ usuario, notificaciones_no_leidas }` con el rol actual leído de PostgreSQL.

### `PATCH /api/auth/perfil`

```json
{
  "nombre": "Carlos",
  "apellido": "Ramírez",
  "telefono": "3009876543",
  "fecha_nacimiento": "1999-08-14"
}
```

No permite cambiar rol, correo ni estado de la cuenta.

### `PATCH /api/auth/password`

```json
{ "actual": "TuClaveActual", "nueva": "NuevaClave123" }
```

## Tickets

### `POST /api/tickets`

```json
{
  "asunto": "Correo sospechoso de transferencia bancaria",
  "descripcion": "Recibí un correo que pide confirmar una transferencia...",
  "categoria": "Ciberseguridad",
  "urgencia": "Media",
  "subcategoria": "Phishing",
  "datos_especificos": { "remitente": "soporte@ejemplo.com" }
}
```

Categorías: `TI General`, `Ciberseguridad`.
Urgencias: `Baja`, `Media`, `Alta`, `Crítica`.
El motor de triaje puede elevar la urgencia final.

### `GET /api/tickets/resumen`

Devuelve conteos, distribución por urgencia/categoría/día y últimos tickets. Si el usuario no es
staff, el resumen se limita a sus propios tickets.

### `GET /api/tickets/mis-tickets`

Lista los tickets del usuario autenticado con su SLA restante.

### `GET /api/tickets` (staff)

Filtros de query: `estado`, `categoria`, `urgencia`, `nivel`, `sin_asignar=1`, `mios=1`, `q`,
`incluir_cerrados=1`, `vencidos=1`.

### `GET /api/tickets/:id`

Devuelve el ticket, solicitante, analista, evidencias, historial y comentarios. Un usuario normal
solo puede consultar tickets donde `id_solicitante` coincide con su cuenta.

### `PATCH /api/tickets/:id/asignar` (staff)

```json
{ "id_analista": 2 }
```

Si se omite `id_analista`, el ticket se asigna al usuario que ejecuta la acción.

### `PATCH /api/tickets/:id/estado` (staff)

```json
{ "estado": "En Progreso", "resumen": "Se revisó el equipo" }
```

Transiciones permitidas:

```text
Abierto       -> En Progreso | En Espera | Resuelto | Cerrado
En Progreso   -> En Espera | Resuelto
En Espera     -> En Progreso
Escalado      -> En Progreso | Resuelto
Resuelto      -> Cerrado | En Progreso
Cerrado       -> (sin transiciones)
```

`Escalado` solo se alcanza con el endpoint de escalamiento.

### `POST /api/tickets/:id/escalar` (staff)

```json
{ "motivo": "Posible compromiso de credenciales; requiere análisis forense" }
```

Cambia el estado a `Escalado`, el nivel a `L2/SOC` y notifica al solicitante y al staff.

### `POST /api/tickets/:id/confirmar` (dueño)

Cierra un ticket en estado `Resuelto`. Solo el solicitante puede hacerlo.

### `POST /api/tickets/:id/comentarios`

```json
{ "contenido": "Adjunto el pantallazo del error", "interno": false }
```

`interno: true` solo se acepta para staff y el comentario no se muestra al solicitante.

### `POST /api/tickets/:id/evidencias`

`multipart/form-data` con el campo `archivos` (hasta 5 archivos de 10 MB). Los archivos quedan en
cuarentena hasta que un analista los libere.

### `GET /api/tickets/:id/evidencias/:idEvidencia/descarga`

Descarga autenticada. Un archivo en cuarentena solo lo puede descargar un administrador.

### `PATCH /api/tickets/evidencias/:idEvidencia/cuarentena` (staff)

```json
{ "en_cuarentena": false }
```

## Base de conocimiento (KEDB)

| Método | Ruta | Acceso | Cuerpo |
| --- | --- | --- | --- |
| GET | `/api/kedb?q=&categoria=` | Autenticado | — |
| GET | `/api/kedb/sugerencias?q=&categoria=` | Autenticado | — |
| GET | `/api/kedb/:id` | Autenticado | — |
| POST | `/api/kedb` | Administrador | `{ titulo, contenido, categoria, etiquetas }` |
| PUT | `/api/kedb/:id` | Administrador | Igual que POST |
| DELETE | `/api/kedb/:id` | Administrador | — |

## Notificaciones

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/notificaciones` | Últimas 40 del usuario + contador de no leídas |
| PATCH | `/api/notificaciones/:id/leida` | Marca una notificación propia |
| POST | `/api/notificaciones/leer-todas` | Marca todas las del usuario |

## Administración (solo `Administrador`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/admin/usuarios` | Lista usuarios con conteos de tickets |
| POST | `/api/admin/usuarios` | Crea usuario con rol |
| PATCH | `/api/admin/usuarios/:id` | Edita nombre, correo, rol, estado o perfil |
| PATCH | `/api/admin/usuarios/:id/password` | Restablece contraseña |
| GET | `/api/admin/metricas` | Métricas globales, SLA y top analistas |
| GET | `/api/admin/sla` | Configuración actual de SLA |
| PUT | `/api/admin/sla` | Guarda configuración de SLA |
| GET | `/api/admin/exportar/tickets.csv` | CSV de tickets (máx. 5000) |
| GET | `/api/admin/exportar/usuarios.csv` | CSV de usuarios |
| GET | `/api/admin/auditoria` | Últimos eventos de historial |

### Crear usuario (admin)

```json
{
  "nombre": "Laura",
  "apellido": "Gómez",
  "email": "laura@ejemplo.com",
  "password": "secreto123",
  "rol": "Analista L1",
  "telefono": "3001112233"
}
```

### Editar usuario (admin)

```json
{ "rol": "Analista L1", "activo": true, "telefono": "3001112233" }
```

### Configurar SLA (admin)

```json
{
  "Crítica": { "respuesta": 1, "resolucion": 4 },
  "Alta": { "respuesta": 2, "resolucion": 8 },
  "Media": { "respuesta": 4, "resolucion": 24 },
  "Baja": { "respuesta": 8, "resolucion": 72 }
}
```

## Códigos de error habituales

| Código | Significado |
| --- | --- |
| 400 | Datos inválidos o transición no permitida |
| 401 | Token ausente, vencido o inválido |
| 403 | Sin permisos o ticket de otro usuario |
| 404 | Recurso no encontrado |
| 409 | Conflicto (correo repetido, ticket ya escalado, etc.) |
| 429 | Demasiados intentos (login/registro) |
| 500 | Error interno; el detalle se registra en el servidor |
