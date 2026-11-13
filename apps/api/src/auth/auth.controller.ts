import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { SpanishThrottlerGuard } from '../common/spanish-throttler.guard';
import { CurrentUser, UsuarioSesion } from '../common/current-user.decorator';

@Controller('auth')
@UseGuards(SpanishThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('registro')
  @Throttle({ default: { limit: 30, ttl: 60 * 60 * 1000 } })
  registro(@Body() body: any) {
    return this.auth.registro(body);
  }

  @Post('login')
  @Throttle({ default: { limit: 20, ttl: 15 * 60 * 1000 } })
  login(@Body() body: any) {
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: UsuarioSesion) {
    return this.auth.me(user);
  }

  @Patch('perfil')
  @UseGuards(JwtAuthGuard)
  actualizarPerfil(@CurrentUser() user: UsuarioSesion, @Body() body: any) {
    return this.auth.actualizarPerfil(user, body);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  cambiarPassword(@CurrentUser() user: UsuarioSesion, @Body() body: any) {
    return this.auth.cambiarPassword(user, body);
  }
}
