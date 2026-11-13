import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UsuarioSesion {
  id_usuario: number;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  telefono?: string | null;
  fecha_nacimiento?: Date | string | null;
  fecha_creacion?: Date | string | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioSesion => ctx.switchToHttp().getRequest().user,
);
