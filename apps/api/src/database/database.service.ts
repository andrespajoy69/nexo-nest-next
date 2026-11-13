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
    this.pool = new Pool({
      host: this.config.get<string>('DB_HOST', '127.0.0.1'),
      port: Number(this.config.get<string>('DB_PORT', '5432')),
      user: this.config.get<string>('DB_USER', 'nexo'),
      password: this.config.get<string>('DB_PASSWORD', 'nexo'),
      database: this.config.get<string>('DB_NAME', 'nexo'),
      max: 10,
    });
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
