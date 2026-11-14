import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export interface ResultadoQuery {
  affectedRows: number;
  insertId: number | null;
}

/** Convierte marcadores `?` de MySQL a `$1..$n` de PostgreSQL. */
function parametrosPostgres(sql: string): string {
  let indice = 0;
  return sql.replace(/\?/g, () => `$${++indice}`);
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: Pool;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('DATABASE_URL')?.trim();
    const ssl = ['1', 'true', 'require', 'required'].includes(
      String(this.config.get<string>('DB_SSL', '')).toLowerCase(),
    );
    const max = Number(this.config.get<string>('DB_POOL_MAX', '10')) || 10;
    const comunes = {
      max,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      application_name: 'nexo-api',
    };

    // En producción se usa DATABASE_URL (Railway, Render, Neon, Supabase...).
    // En local se mantienen las variables DB_* para no romper el flujo existente.
    this.pool = url
      ? new Pool({
          ...comunes,
          connectionString: url,
          ssl: ssl ? { rejectUnauthorized: false } : undefined,
        })
      : new Pool({
          ...comunes,
          host: this.config.get<string>('DB_HOST', '127.0.0.1'),
          port: Number(this.config.get<string>('DB_PORT', '5432')),
          user: this.config.get<string>('DB_USER', 'nexo'),
          password: this.config.get<string>('DB_PASSWORD', 'nexo'),
          database: this.config.get<string>('DB_NAME', 'nexo'),
          ssl: ssl ? { rejectUnauthorized: false } : undefined,
        });

    this.pool.on('error', (error) => {
      this.logger.error(`Error inesperado del pool PostgreSQL: ${error.message}`);
    });

    this.logger.log(
      url ? 'PostgreSQL configurado mediante DATABASE_URL' : 'PostgreSQL configurado mediante DB_HOST/DB_PORT',
    );
  }

  async query<T = any[]>(sql: string, params: any[] = []): Promise<[T, ResultadoQuery]> {
    const resultado = await this.pool.query(parametrosPostgres(sql), params);
    return [
      resultado.rows as T,
      { affectedRows: resultado.rowCount ?? 0, insertId: null },
    ];
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error(`No se pudo conectar a PostgreSQL: ${(error as Error).message}`);
      return false;
    }
  }

  async onModuleDestroy() {
    await this.pool.end().catch(() => undefined);
  }
}
