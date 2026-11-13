import { Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, UsuarioSesion } from '../common/current-user.decorator';
import { DatabaseService } from '../database/database.service';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async listar(@CurrentUser() user: UsuarioSesion) {
    const [rows] = await this.db.query<any[]>(
      `SELECT n.id_notificacion, n.id_ticket, n.tipo, n.titulo, n.mensaje, n.leida, n.fecha,
              t.codigo AS ticket_codigo
         FROM notificaciones n
         LEFT JOIN tickets t ON t.id_ticket = n.id_ticket
        WHERE n.id_usuario = ?
        ORDER BY n.fecha DESC
        LIMIT 40`,
      [user.id_usuario],
    );

    const [noLeidas] = await this.db.query<any[]>(
      'SELECT COUNT(*) AS total FROM notificaciones WHERE id_usuario = ? AND leida = FALSE',
      [user.id_usuario],
    );

    return {
      notificaciones: rows.map((n) => ({ ...n, leida: Boolean(n.leida) })),
      no_leidas: Number(noLeidas[0]?.total || 0),
    };
  }

  @Patch(':id/leida')
  async marcarLeida(@CurrentUser() user: UsuarioSesion, @Param('id', ParseIntPipe) id: number) {
    const [rows] = await this.db.query<any>(
      'UPDATE notificaciones SET leida = TRUE WHERE id_notificacion = ? AND id_usuario = ? RETURNING id_notificacion',
      [id, user.id_usuario],
    );
    if (!rows.length) {
      throw new NotFoundException('Notificación no encontrada');
    }
    return { mensaje: 'Notificación leída' };
  }

  @Post('leer-todas')
  async leerTodas(@CurrentUser() user: UsuarioSesion) {
    await this.db.query('UPDATE notificaciones SET leida = TRUE WHERE id_usuario = ? AND leida = FALSE', [
      user.id_usuario,
    ]);
    return { mensaje: 'Notificaciones marcadas como leídas' };
  }
}
