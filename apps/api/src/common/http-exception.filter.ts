import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Mantiene el contrato original del frontend: todos los errores salen como
 * `{ "error": "mensaje" }`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const value = (body as any).message ?? (body as any).error;
        message = Array.isArray(value) ? value.join(', ') : String(value ?? exception.message);
      } else {
        message = exception.message;
      }
    } else if (exception?.code === 'LIMIT_FILE_SIZE') {
      status = HttpStatus.BAD_REQUEST;
      message = 'Cada archivo debe pesar como máximo 10 MB';
    } else if (exception?.code === 'LIMIT_FILE_COUNT') {
      status = HttpStatus.BAD_REQUEST;
      message = 'Puedes adjuntar como máximo 5 archivos';
    } else if (exception?.code === 'LIMIT_UNEXPECTED_FILE') {
      status = HttpStatus.BAD_REQUEST;
      message = 'Campo de archivo no permitido. Usa "archivos".';
    } else if (exception?.name === 'MulterError') {
      status = HttpStatus.BAD_REQUEST;
      message = 'No se pudieron procesar los archivos adjuntos';
    } else if (exception?.code === '23505') {
      status = HttpStatus.CONFLICT;
      message = 'Ese correo ya está registrado';
    } else if (exception) {
      this.logger.error(exception?.stack || exception?.message || String(exception));
    }

    if (!response.headersSent) {
      response.status(status).json({ error: message });
    }
  }
}
