import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, UsuarioSesion } from '../common/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Administrador')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('usuarios')
  usuarios() {
    return this.admin.usuarios();
  }

  @Post('usuarios')
  crearUsuario(@Body() body: any) {
    return this.admin.crearUsuario(body);
  }

  @Patch('usuarios/:id')
  editarUsuario(
    @CurrentUser() user: UsuarioSesion,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.admin.editarUsuario(user, id, body);
  }

  @Patch('usuarios/:id/password')
  resetPassword(@Param('id') id: string, @Body() body: any) {
    return this.admin.resetPassword(id, body);
  }

  @Get('metricas')
  metricas() {
    return this.admin.metricas();
  }

  @Get('sla')
  obtenerSla() {
    return this.admin.obtenerSla();
  }

  @Put('sla')
  guardarSla(@Body() body: any) {
    return this.admin.guardarSla(body);
  }

  @Get('exportar/tickets.csv')
  async exportarTickets(@Res() res: Response) {
    const csv = await this.admin.csvTickets();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="nexo-tickets.csv"');
    res.send(csv);
  }

  @Get('exportar/usuarios.csv')
  async exportarUsuarios(@Res() res: Response) {
    const csv = await this.admin.csvUsuarios();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="nexo-usuarios.csv"');
    res.send(csv);
  }

  @Get('auditoria')
  auditoria() {
    return this.admin.auditoria();
  }
}
