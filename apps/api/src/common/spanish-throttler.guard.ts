import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class SpanishThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const ruta = String(request?.route?.path || request?.path || '');
    const mensaje = ruta.includes('login')
      ? 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.'
      : ruta.includes('registro')
        ? 'Demasiadas cuentas creadas desde esta conexión. Intenta más tarde.'
        : 'Demasiadas solicitudes. Intenta de nuevo más tarde.';
    throw new HttpException(mensaje, HttpStatus.TOO_MANY_REQUESTS);
  }
}
