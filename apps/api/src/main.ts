import './config/env';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';

const SECRETOS_INSEGUROS = [
  '',
  'cambia-este-secreto',
  'cambiar-en-produccion',
  'nexo-dev-secret',
];

function validarEntorno() {
  const logger = new Logger('Nexo');
  const produccion = process.env.NODE_ENV === 'production';
  const secreto = process.env.JWT_SECRET || '';

  if (produccion) {
    if (SECRETOS_INSEGUROS.includes(secreto) || secreto.length < 32) {
      throw new Error(
        'JWT_SECRET es obligatorio en producción y debe tener al menos 32 caracteres. ' +
          'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
      );
    }
    if (!process.env.WEB_ORIGIN?.trim()) {
      throw new Error(
        'WEB_ORIGIN es obligatorio en producción. Indica el dominio del frontend separado por comas o "*" solo para pruebas.',
      );
    }
    if (process.env.WEB_ORIGIN.trim() === '*') {
      logger.warn('WEB_ORIGIN="*" permite cualquier origen. Restríngelo al dominio real antes de entregar.');
    }
  } else if (SECRETOS_INSEGUROS.includes(secreto)) {
    logger.warn('JWT_SECRET no está configurado. Se usa el secreto de desarrollo; no lo uses en producción.');
  }
}

async function bootstrap() {
  validarEntorno();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });

  // Detrás de Render/Railway/Vercel el rate limit debe leer la IP real del proxy.
  app.set('trust proxy', 1);
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const origenes = String(process.env.WEB_ORIGIN || 'http://localhost:3002')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origenes.includes('*') ? true : origenes,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT || 3001);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Nexo');
  logger.log(`API NestJS escuchando en el puerto ${port} (prefijo /api)`);
  logger.log(`Orígenes permitidos: ${origenes.join(', ') || '*'}`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Nexo');
  logger.error(`No se pudo iniciar la API: ${error?.message || error}`);
  process.exit(1);
});
