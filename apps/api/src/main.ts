import './config/env';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

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
    origin: origenes.length ? origenes : true,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);

  const logger = new Logger('Nexo');
  logger.log(`API NestJS escuchando en http://localhost:${port}/api`);
  logger.log(`Orígenes permitidos: ${origenes.join(', ') || '*'}`);
}

bootstrap();
