// Migración de datos: MySQL (Nexo actual) -> PostgreSQL (Nexo NestJS)
// Uso: node scripts/migrate-to-postgres.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const mysqlConfig = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'mesa_ayuda_ciberseguridad',
};

const pgConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'nexo',
  password: process.env.DB_PASSWORD || 'nexo',
  database: process.env.DB_NAME || 'nexo',
};

const booleanas = new Set([
  'activo',
  'sla_pausado',
  'sla_respuesta_incumplido',
  'sla_resolucion_incumplido',
  'prioridad_auto',
  'en_cuarentena',
  'interno',
  'leida',
]);

const tablas = [
  'usuarios',
  'tickets',
  'evidencias',
  'ticket_historial',
  'comentarios',
  'notificaciones',
  'kedb_articulos',
  'configuracion',
  'legacy_users',
  'legacy_tickets',
  'legacy_adjuntos',
];

const secuencias = {
  usuarios: ['id_usuario', 'usuarios_id_usuario_seq'],
  tickets: ['id_ticket', 'tickets_id_ticket_seq'],
  evidencias: ['id_evidencia', 'evidencias_id_evidencia_seq'],
  ticket_historial: ['id_historial', 'ticket_historial_id_historial_seq'],
  comentarios: ['id_comentario', 'comentarios_id_comentario_seq'],
  notificaciones: ['id_notificacion', 'notificaciones_id_notificacion_seq'],
  kedb_articulos: ['id_articulo', 'kedb_articulos_id_articulo_seq'],
  legacy_users: ['id', 'legacy_users_id_seq'],
  legacy_tickets: ['id', 'legacy_tickets_id_seq'],
  legacy_adjuntos: ['id', 'legacy_adjuntos_id_seq'],
};

const mysqlConn = await mysql.createConnection(mysqlConfig);
const pgClient = new pg.Client(pgConfig);
await pgClient.connect();

const esquema = readFileSync(join(__dirname, '..', 'sql', 'schema.postgres.sql'), 'utf8');
await pgClient.query(esquema);

for (const tabla of tablas) {
  const [filas] = await mysqlConn.query(`SELECT * FROM \`${tabla}\``);
  if (!filas.length) {
    console.log(`${tabla}: 0 filas`);
    continue;
  }

  const columnas = Object.keys(filas[0]);
  const columnasSql = columnas.map((c) => `"${c}"`).join(', ');
  const marcadores = columnas.map((_, i) => `$${i + 1}`).join(', ');
  const insertSql = `INSERT INTO "${tabla}" (${columnasSql}) VALUES (${marcadores})`;

  for (const fila of filas) {
    const valores = columnas.map((columna) => {
      let valor = fila[columna];
      if (valor === undefined) return null;
      if (booleanas.has(columna)) return Boolean(Number(valor));
      if (columna === 'datos_especificos' && valor !== null) {
        if (typeof valor === 'string') {
          try {
            return JSON.stringify(JSON.parse(valor));
          } catch {
            return JSON.stringify(valor);
          }
        }
        return JSON.stringify(valor);
      }
      return valor;
    });
    await pgClient.query(insertSql, valores);
  }

  console.log(`${tabla}: ${filas.length} filas migradas`);
}

for (const [tabla, [columna, secuencia]] of Object.entries(secuencias)) {
  await pgClient.query(
    `SELECT setval($1, COALESCE((SELECT MAX("${columna}") FROM "${tabla}"), 0) + 1, false)`,
    [secuencia],
  );
}

console.log('Secuencias ajustadas. Verificando conteos...');
for (const tabla of tablas) {
  const { rows } = await pgClient.query(`SELECT COUNT(*)::int AS total FROM "${tabla}"`);
  console.log(`${tabla}: ${rows[0].total}`);
}

await mysqlConn.end();
await pgClient.end();
console.log('Migración completada.');
