import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, _context: ExecutionContext) {
    if (err) throw err;
    if (info) {
      const mensaje = String(info?.message || '');
      if (!info || mensaje === 'No auth token') {
        throw new UnauthorizedException('No autenticado');
      }
      throw new UnauthorizedException('Sesión inválida o expirada');
    }
    if (!user) throw new UnauthorizedException('No autenticado');
    return user;
  }
}
