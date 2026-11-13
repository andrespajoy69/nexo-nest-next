-- =====================================================================
-- Nexo · Esquema PostgreSQL 17
-- =====================================================================

DROP TABLE IF EXISTS legacy_adjuntos CASCADE;
DROP TABLE IF EXISTS legacy_tickets CASCADE;
DROP TABLE IF EXISTS legacy_users CASCADE;
DROP TABLE IF EXISTS configuracion CASCADE;
DROP TABLE IF EXISTS kedb_articulos CASCADE;
DROP TABLE IF EXISTS notificaciones CASCADE;
DROP TABLE IF EXISTS comentarios CASCADE;
DROP TABLE IF EXISTS ticket_historial CASCADE;
DROP TABLE IF EXISTS evidencias CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

CREATE TABLE usuarios (
  id_usuario      SERIAL PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  apellido        VARCHAR(100) NOT NULL DEFAULT '',
  email           VARCHAR(150) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  rol             VARCHAR(30) NOT NULL DEFAULT 'Usuario'
                    CHECK (rol IN ('Usuario', 'Analista L1', 'Administrador')),
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  telefono        VARCHAR(30),
  fecha_nacimiento DATE,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_acceso   TIMESTAMPTZ
);
CREATE INDEX idx_usuarios_rol ON usuarios (rol, activo);

CREATE TABLE tickets (
  id_ticket                    SERIAL PRIMARY KEY,
  codigo                       VARCHAR(20) UNIQUE,
  asunto                       VARCHAR(200) NOT NULL,
  descripcion                  TEXT NOT NULL,
  categoria                    VARCHAR(30) NOT NULL DEFAULT 'TI General'
                                 CHECK (categoria IN ('TI General', 'Ciberseguridad')),
  subcategoria                 VARCHAR(100),
  urgencia                     VARCHAR(20) NOT NULL DEFAULT 'Baja'
                                 CHECK (urgencia IN ('Baja', 'Media', 'Alta', 'Crítica')),
  estado                       VARCHAR(30) NOT NULL DEFAULT 'Abierto'
                                 CHECK (estado IN ('Abierto', 'En Progreso', 'En Espera', 'Escalado', 'Resuelto', 'Cerrado')),
  id_solicitante               INTEGER NOT NULL REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  id_analista_asignado         INTEGER REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
  nivel_escalamiento           VARCHAR(20) NOT NULL DEFAULT 'L1'
                                 CHECK (nivel_escalamiento IN ('L1', 'L2/SOC')),
  motivo_escalamiento          TEXT,
  resumen_resolucion           TEXT,
  fecha_escalamiento           TIMESTAMPTZ,
  id_escalado_por              INTEGER REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
  sla_horas_respuesta          INTEGER NOT NULL DEFAULT 8,
  sla_horas_resolucion         INTEGER NOT NULL DEFAULT 72,
  sla_vencimiento_respuesta    TIMESTAMPTZ NOT NULL,
  sla_vencimiento_resolucion   TIMESTAMPTZ NOT NULL,
  sla_pausado                  BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_pausa                  TIMESTAMPTZ,
  sla_respuesta_incumplido     BOOLEAN NOT NULL DEFAULT FALSE,
  sla_resolucion_incumplido    BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_primera_respuesta      TIMESTAMPTZ,
  fecha_resolucion             TIMESTAMPTZ,
  datos_especificos            JSONB,
  prioridad_auto               BOOLEAN NOT NULL DEFAULT FALSE,
  palabras_clave               VARCHAR(255),
  fecha_creacion               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tickets_estado ON tickets (estado);
CREATE INDEX idx_tickets_categoria ON tickets (categoria);
CREATE INDEX idx_tickets_urgencia ON tickets (urgencia);
CREATE INDEX idx_tickets_solicitante ON tickets (id_solicitante);
CREATE INDEX idx_tickets_analista ON tickets (id_analista_asignado);
CREATE INDEX idx_tickets_sla ON tickets (sla_vencimiento_resolucion);
CREATE INDEX idx_tickets_creacion ON tickets (fecha_creacion);

CREATE OR REPLACE FUNCTION nexo_touch_fecha_actualizacion() RETURNS trigger AS $$
BEGIN
  NEW.fecha_actualizacion = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_actualizacion
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION nexo_touch_fecha_actualizacion();

CREATE TABLE evidencias (
  id_evidencia          SERIAL PRIMARY KEY,
  id_ticket             INTEGER NOT NULL REFERENCES tickets (id_ticket) ON DELETE CASCADE,
  id_usuario_carga      INTEGER NOT NULL REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  nombre_archivo        VARCHAR(255) NOT NULL,
  ruta_almacenamiento   VARCHAR(500) NOT NULL,
  tipo_mime             VARCHAR(150),
  tamano_bytes          BIGINT NOT NULL DEFAULT 0,
  hash_sha256           CHAR(64) NOT NULL,
  en_cuarentena         BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_carga           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_evidencias_ticket ON evidencias (id_ticket);

CREATE TABLE ticket_historial (
  id_historial     SERIAL PRIMARY KEY,
  id_ticket        INTEGER NOT NULL REFERENCES tickets (id_ticket) ON DELETE CASCADE,
  id_usuario       INTEGER REFERENCES usuarios (id_usuario) ON DELETE SET NULL,
  accion           VARCHAR(50) NOT NULL,
  detalle          TEXT,
  estado_anterior  VARCHAR(30),
  estado_nuevo     VARCHAR(30),
  fecha            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_historial_ticket ON ticket_historial (id_ticket, fecha);

CREATE TABLE comentarios (
  id_comentario  SERIAL PRIMARY KEY,
  id_ticket      INTEGER NOT NULL REFERENCES tickets (id_ticket) ON DELETE CASCADE,
  id_usuario     INTEGER NOT NULL REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  contenido      TEXT NOT NULL,
  interno        BOOLEAN NOT NULL DEFAULT FALSE,
  fecha          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_comentarios_ticket ON comentarios (id_ticket, fecha);

CREATE TABLE notificaciones (
  id_notificacion  SERIAL PRIMARY KEY,
  id_usuario       INTEGER NOT NULL REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  id_ticket        INTEGER REFERENCES tickets (id_ticket) ON DELETE CASCADE,
  tipo             VARCHAR(30) NOT NULL DEFAULT 'info',
  titulo           VARCHAR(150) NOT NULL,
  mensaje          TEXT NOT NULL,
  leida            BOOLEAN NOT NULL DEFAULT FALSE,
  fecha            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_usuario ON notificaciones (id_usuario, leida, fecha);

CREATE TABLE kedb_articulos (
  id_articulo     SERIAL PRIMARY KEY,
  titulo          VARCHAR(200) NOT NULL,
  contenido       TEXT NOT NULL,
  categoria       VARCHAR(30) NOT NULL DEFAULT 'Ambas'
                    CHECK (categoria IN ('TI General', 'Ciberseguridad', 'Ambas')),
  palabras_clave  VARCHAR(255),
  imagen_url      VARCHAR(500),
  enlace          VARCHAR(500),
  creditos        VARCHAR(255),
  vistas          INTEGER NOT NULL DEFAULT 0,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kedb_categoria ON kedb_articulos (categoria, activo);

CREATE TABLE configuracion (
  clave  VARCHAR(60) PRIMARY KEY,
  valor  TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- Tablas heredadas del sistema anterior (se preservan sin uso activo)
-- ---------------------------------------------------------------------
CREATE TABLE legacy_users (
  id             SERIAL PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  email          VARCHAR(100) NOT NULL UNIQUE,
  password       VARCHAR(255) NOT NULL,
  rol            VARCHAR(20) DEFAULT 'usuario',
  "fechaRegistro" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE legacy_tickets (
  id             SERIAL PRIMARY KEY,
  titulo         VARCHAR(150) NOT NULL,
  descripcion    TEXT NOT NULL,
  categoria      VARCHAR(30) NOT NULL DEFAULT 'TI General',
  prioridad      VARCHAR(20) NOT NULL DEFAULT 'Baja',
  estado         VARCHAR(30) NOT NULL DEFAULT 'Abierto',
  usuario_id     INTEGER NOT NULL REFERENCES legacy_users (id),
  analista_id    INTEGER REFERENCES legacy_users (id),
  sla_limite     TIMESTAMPTZ,
  "fechaCreacion" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE legacy_adjuntos (
  id             SERIAL PRIMARY KEY,
  ticket_id      INTEGER NOT NULL REFERENCES legacy_tickets (id),
  nombre_archivo VARCHAR(255) NOT NULL,
  ruta_cuarentena VARCHAR(255) NOT NULL,
  fecha_subida   TIMESTAMPTZ DEFAULT NOW()
);
