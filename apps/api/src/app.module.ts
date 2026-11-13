import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { TicketsModule } from './tickets/tickets.module';
import { KedbModule } from './kedb/kedb.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';
import { API_ROOT } from './config/env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(process.cwd(), '.env'), join(API_ROOT, '.env')],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1000 }]),
    DatabaseModule,
    AuthModule,
    TicketsModule,
    KedbModule,
    NotificacionesModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
