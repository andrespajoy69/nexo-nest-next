import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly db: DatabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'nexo-dev-secret'),
    });
  }

  async validate(payload: any) {
    const [rows] = await this.db.query<any[]>(
      `SELECT id_usuario, nombre, apellido, email, rol, telefono, fecha_nacimiento, fecha_creacion
         FROM usuarios WHERE id_usuario = ? AND activo = TRUE`,
      [Number(payload?.sub)],
    );

    if (!rows.length) {
      throw new UnauthorizedException('Usuario inválido o inactivo');
    }

    return rows[0];
  }
}
