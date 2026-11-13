import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Controller()
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get('health')
  async health() {
    const db = await this.db.ping();
    return {
      ok: true,
      servicio: 'Nexo API',
      stack: 'NestJS',
      base_de_datos: db ? 'conectada' : 'sin conexión',
      fecha: new Date().toISOString(),
    };
  }
}
