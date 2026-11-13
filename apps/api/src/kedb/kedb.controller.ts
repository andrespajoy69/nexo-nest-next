import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { KedbService } from './kedb.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@Controller('kedb')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KedbController {
  constructor(private readonly kedb: KedbService) {}

  @Get('sugerencias')
  sugerencias(@Query('q') q: string, @Query('categoria') categoria: string) {
    return this.kedb.sugerencias(q, categoria);
  }

  @Get()
  listar(@Query('q') q: string, @Query('categoria') categoria: string) {
    return this.kedb.listar(q, categoria);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.kedb.obtener(id);
  }

  @Post()
  @Roles('Administrador')
  crear(@Body() body: any) {
    return this.kedb.crear(body);
  }

  @Put(':id')
  @Roles('Administrador')
  editar(@Param('id') id: string, @Body() body: any) {
    return this.kedb.editar(id, body);
  }

  @Delete(':id')
  @Roles('Administrador')
  eliminar(@Param('id') id: string) {
    return this.kedb.eliminar(id);
  }
}
