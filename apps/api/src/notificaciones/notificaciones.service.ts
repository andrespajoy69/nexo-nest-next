import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface NotificacionInput {
  id_ticket?: number | null;
  tipo?: string;
  titulo: string;
  mensaje: string;
}

@Injectable()
export class NotificacionesService {
  constructor(private readonly db: DatabaseService) {}

  async notificarUsuario(id_usuario: number, data: NotificacionInput): Promise<void> {
    try {
      const [rows] = await this.db.query<any[]>(
        'SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND activo = TRUE',
        [id_usuario],
      );
      if (!rows.length) return;

      await this.db.query(
        'INSERT INTO notificaciones (id_usuario, id_ticket, tipo, titulo, mensaje) VALUES (?, ?, ?, ?, ?)',
        [id_usuario, data.id_ticket ?? null, data.tipo || 'info', data.titulo, data.mensaje],
      );
    } catch (error) {
      // Las notificaciones nunca deben tumbar la operación principal.
      console.error('Error creando notificación:', (error as Error).message);
    }
  }

  async notificarStaff(data: NotificacionInput & { excluir?: number | null }): Promise<void> {
    try {
      const [staff] = await this.db.query<any[]>(
        "SELECT id_usuario FROM usuarios WHERE activo = TRUE AND rol IN ('Analista L1','Administrador')",
      );
      for (const row of staff) {
        if (data.excluir && Number(row.id_usuario) === Number(data.excluir)) continue;
        await this.notificarUsuario(Number(row.id_usuario), data);
      }
    } catch (error) {
      console.error('Error notificando al staff:', (error as Error).message);
    }
  }
}
