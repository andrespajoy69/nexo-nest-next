import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, UsuarioSesion } from '../common/current-user.decorator';
import { ES_STAFF } from '../common/constants';
import { UPLOADS_DIR } from '../config/uploads';

const almacenamiento = diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname || '')
      .slice(0, 12)
      .replace(/[^.\w]/g, '');
    cb(null, randomUUID() + ext);
  },
});

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  crear(@CurrentUser() user: UsuarioSesion, @Body() body: any) {
    return this.tickets.crear(user, body);
  }

  @Get('resumen')
  resumen(@CurrentUser() user: UsuarioSesion) {
    return this.tickets.resumen(user);
  }

  @Get('mis-tickets')
  misTickets(@CurrentUser() user: UsuarioSesion) {
    return this.tickets.misTickets(user);
  }

  @Get('analistas')
  @Roles(...ES_STAFF)
  analistas() {
    return this.tickets.analistas();
  }

  @Get()
  @Roles(...ES_STAFF)
  listar(@CurrentUser() user: UsuarioSesion, @Query() query: any) {
    return this.tickets.listar(user, query);
  }

  @Get(':id')
  detalle(@CurrentUser() user: UsuarioSesion, @Param('id') id: string) {
    return this.tickets.detalle(user, id);
  }

  @Patch(':id/asignar')
  @Roles(...ES_STAFF)
  asignar(@CurrentUser() user: UsuarioSesion, @Param('id') id: string, @Body() body: any) {
    return this.tickets.asignar(user, id, body);
  }

  @Patch(':id/estado')
  @Roles(...ES_STAFF)
  cambiarEstado(@CurrentUser() user: UsuarioSesion, @Param('id') id: string, @Body() body: any) {
    return this.tickets.cambiarEstado(user, id, body);
  }

  @Post(':id/escalar')
  @Roles(...ES_STAFF)
  escalar(@CurrentUser() user: UsuarioSesion, @Param('id') id: string, @Body() body: any) {
    return this.tickets.escalar(user, id, body);
  }

  @Post(':id/confirmar')
  confirmar(@CurrentUser() user: UsuarioSesion, @Param('id') id: string) {
    return this.tickets.confirmar(user, id);
  }

  @Post(':id/evidencias')
  @UseInterceptors(
    FilesInterceptor('archivos', 5, {
      storage: almacenamiento,
      limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    }),
  )
  subirEvidencias(
    @CurrentUser() user: UsuarioSesion,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.tickets.subirEvidencias(user, id, files);
  }

  @Get(':id/evidencias/:idEvidencia/descarga')
  async descargar(
    @CurrentUser() user: UsuarioSesion,
    @Param('id') id: string,
    @Param('idEvidencia') idEvidencia: string,
    @Res() res: Response,
  ) {
    const { absoluta, nombre } = await this.tickets.rutaDescarga(user, id, idEvidencia);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.download(absoluta, nombre, (err) => {
      if (err && !res.headersSent) res.status(500).end();
    });
  }

  @Patch('evidencias/:idEvidencia/cuarentena')
  @Roles(...ES_STAFF)
  cuarentena(
    @CurrentUser() user: UsuarioSesion,
    @Param('idEvidencia') idEvidencia: string,
    @Body() body: any,
  ) {
    return this.tickets.cuarentena(user, idEvidencia, body);
  }

  @Post(':id/comentarios')
  comentar(@CurrentUser() user: UsuarioSesion, @Param('id') id: string, @Body() body: any) {
    return this.tickets.comentar(user, id, body);
  }
}
