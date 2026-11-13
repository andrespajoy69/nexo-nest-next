import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { SEGURO } from '../common/constants';
import { UsuarioSesion } from '../common/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  private firmarToken(usuario: any) {
    return this.jwt.sign({
      sub: String(usuario.id_usuario),
      rol: usuario.rol,
      email: usuario.email,
    });
  }

  private fechaISO(valor: any): string | null {
    if (!valor) return null;
    if (valor instanceof Date) return valor.toISOString().slice(0, 10);
    return String(valor).slice(0, 10);
  }

  publico(u: any) {
    return {
      id_usuario: u.id_usuario,
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      rol: u.rol,
      telefono: u.telefono || null,
      fecha_nacimiento: this.fechaISO(u.fecha_nacimiento),
    };
  }

  async registro(body: any) {
    const { nombre, apellido = '', email, password, telefono = null, fecha_nacimiento = null } = body || {};

    if (!nombre?.trim()) throw new BadRequestException('El nombre es obligatorio');
    if (!SEGURO.email.test(String(email || ''))) {
      throw new BadRequestException('Correo electrónico inválido');
    }
    if (String(password || '').length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }
    if (fecha_nacimiento && !SEGURO.fecha.test(String(fecha_nacimiento))) {
      throw new BadRequestException('Fecha de nacimiento inválida');
    }

    const hash = await bcrypt.hash(String(password), 10);
    let filas: any[];

    try {
      [filas] = await this.db.query<any>(
        `INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, telefono, fecha_nacimiento)
         VALUES (?, ?, ?, ?, 'Usuario', ?, ?)
         RETURNING id_usuario`,
        [
          nombre.trim(),
          String(apellido || '').trim(),
          String(email).toLowerCase().trim(),
          hash,
          telefono,
          fecha_nacimiento || null,
        ],
      );
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('Ya existe una cuenta con ese correo');
      }
      throw error;
    }

    const usuario = {
      id_usuario: filas[0]?.id_usuario,
      nombre: nombre.trim(),
      apellido: String(apellido || '').trim(),
      email: String(email).toLowerCase().trim(),
      rol: 'Usuario',
      telefono,
      fecha_nacimiento,
    };

    await this.notificaciones.notificarUsuario(usuario.id_usuario, {
      tipo: 'bienvenida',
      titulo: 'Bienvenido a Nexo',
      mensaje:
        'Tu cuenta fue creada correctamente. Ya puedes registrar solicitudes de soporte y reportar incidentes de ciberseguridad.',
    });

    return { token: this.firmarToken(usuario), usuario };
  }

  async login(body: any) {
    const { email, password } = body || {};
    if (!SEGURO.email.test(String(email || '')) || !password) {
      throw new BadRequestException('Correo y contraseña son obligatorios');
    }

    const [rows] = await this.db.query<any[]>(
      'SELECT * FROM usuarios WHERE email = ? LIMIT 1',
      [String(email).toLowerCase().trim()],
    );

    if (!rows.length) throw new UnauthorizedException('Correo o contraseña incorrectos');

    const usuario = rows[0];
    if (!usuario.activo) {
      throw new ForbiddenException('Tu cuenta está inactiva. Contacta al administrador.');
    }

    const coincide = await bcrypt.compare(String(password), usuario.password_hash);
    if (!coincide) throw new UnauthorizedException('Correo o contraseña incorrectos');

    await this.db.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id_usuario = ?', [
      usuario.id_usuario,
    ]);

    return { token: this.firmarToken(usuario), usuario: this.publico(usuario) };
  }

  async me(user: UsuarioSesion) {
    const [noLeidas] = await this.db.query<any[]>(
      'SELECT COUNT(*) AS total FROM notificaciones WHERE id_usuario = ? AND leida = FALSE',
      [user.id_usuario],
    );
    return { usuario: this.publico(user), notificaciones_no_leidas: Number(noLeidas[0]?.total || 0) };
  }

  async actualizarPerfil(user: UsuarioSesion, body: any) {
    const { nombre, apellido, telefono, fecha_nacimiento } = body || {};
    if (!nombre?.trim()) throw new BadRequestException('El nombre es obligatorio');

    const sets = ['nombre = ?', 'apellido = ?', 'telefono = ?'];
    const params: any[] = [nombre.trim(), String(apellido || '').trim(), telefono || null];

    if (fecha_nacimiento !== undefined) {
      if (fecha_nacimiento && !SEGURO.fecha.test(String(fecha_nacimiento))) {
        throw new BadRequestException('Fecha de nacimiento inválida');
      }
      sets.push('fecha_nacimiento = ?');
      params.push(fecha_nacimiento || null);
    }

    params.push(user.id_usuario);
    await this.db.query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id_usuario = ?`, params);
    return { mensaje: 'Perfil actualizado' };
  }

  async cambiarPassword(user: UsuarioSesion, body: any) {
    const { actual, nueva } = body || {};
    if (!actual || !nueva) {
      throw new BadRequestException('Debes indicar la contraseña actual y la nueva');
    }
    if (String(nueva).length < 6) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres');
    }

    const [rows] = await this.db.query<any[]>('SELECT password_hash FROM usuarios WHERE id_usuario = ?', [
      user.id_usuario,
    ]);
    const coincide = await bcrypt.compare(String(actual), rows[0]?.password_hash || '');
    if (!coincide) throw new BadRequestException('La contraseña actual no es correcta');

    const hash = await bcrypt.hash(String(nueva), 10);
    await this.db.query('UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?', [
      hash,
      user.id_usuario,
    ]);
    return { mensaje: 'Contraseña actualizada' };
  }
}
