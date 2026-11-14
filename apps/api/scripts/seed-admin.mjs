// Crea o restablece una cuenta administradora en PostgreSQL.
// Uso:
//   $env:ADMIN_EMAIL='admin@ejemplo.com'
//   $env:ADMIN_PASSWORD='UnaClaveLarga123'
//   npm run seed:admin --workspace @nexo/api
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const email = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const password = String(process.env.ADMIN_PASSWORD || '');
const nombre = String(process.env.ADMIN_NOMBRE || 'Administrador').trim();
const apellido = String(process.env.ADMIN_APELLIDO || 'Nexo').trim();

if (!email || !email.includes('@')) {
  console.error('Define ADMIN_EMAIL con un correo válido.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Define ADMIN_PASSWORD con al menos 8 caracteres.');
  process.exit(1);
}

const url = process.env.DATABASE_URL?.trim();
const ssl = ['1', 'true', 'require'].includes(String(process.env.DB_SSL || '').toLowerCase());
const pool = new pg.Pool(
  url
    ? { connectionString: url, ssl: ssl ? { rejectUnauthorized: false } : undefined }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || 'nexo',
        password: process.env.DB_PASSWORD || 'nexo',
        database: process.env.DB_NAME || 'nexo',
        ssl: ssl ? { rejectUnauthorized: false } : undefined,
      },
);

try {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, activo)
       VALUES ($1, $2, $3, $4, 'Administrador', TRUE)
     ON CONFLICT (email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash,
                     rol = 'Administrador',
                     activo = TRUE
     RETURNING id_usuario, email, rol`,
    [nombre, apellido, email, hash],
  );
  console.log(`Administrador listo: ${rows[0].email} (id ${rows[0].id_usuario}, rol ${rows[0].rol})`);
} catch (error) {
  if (error?.code === '42P01') {
    console.error('La tabla usuarios no existe. Aplica primero apps/api/sql/schema.postgres.sql.');
  } else {
    console.error('No se pudo crear el administrador:', error?.message || error);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
