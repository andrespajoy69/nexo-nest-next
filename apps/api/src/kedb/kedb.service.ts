import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CATEGORIAS } from '../common/constants';

@Injectable()
export class KedbService {
  constructor(private readonly db: DatabaseService) {}

  async sugerencias(qRaw: any, categoria: any) {
    const q = String(qRaw || '').trim();
    if (q.length < 3) return [];

    const where = ['activo = TRUE'];
    const params: any[] = [];

    if (CATEGORIAS.includes(categoria)) {
      where.push("(categoria = ? OR categoria = 'Ambas')");
      params.push(categoria);
    }

    const palabras = q
      .split(/\s+/)
      .filter((p) => p.length >= 3)
      .slice(0, 4);

    if (palabras.length) {
      where.push(
        `(${palabras
          .map(() => '(titulo ILIKE ? OR contenido ILIKE ? OR palabras_clave ILIKE ?)')
          .join(' OR ')})`,
      );
      for (const p of palabras) {
        const like = `%${p}%`;
        params.push(like, like, like);
      }
    }

    const [rows] = await this.db.query<any[]>(
      `SELECT id_articulo, titulo, LEFT(contenido, 220) AS extracto, categoria, palabras_clave
         FROM kedb_articulos
        WHERE ${where.join(' AND ')}
        ORDER BY vistas DESC
        LIMIT 5`,
      params,
    );
    return rows;
  }

  async listar(qRaw: any, categoria: any) {
    const q = String(qRaw || '').trim();
    const where = ['activo = TRUE'];
    const params: any[] = [];

    if (q) {
      where.push('(titulo ILIKE ? OR contenido ILIKE ? OR palabras_clave ILIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (CATEGORIAS.includes(categoria)) {
      where.push("(categoria = ? OR categoria = 'Ambas')");
      params.push(categoria);
    }

    const [rows] = await this.db.query<any[]>(
      `SELECT id_articulo, titulo, contenido, categoria, palabras_clave, imagen_url, enlace, creditos, vistas, fecha_creacion
         FROM kedb_articulos
        WHERE ${where.join(' AND ')}
        ORDER BY vistas DESC, fecha_creacion DESC`,
      params,
    );
    return rows;
  }

  async obtener(idRaw: any) {
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('ID inválido');

    const [rows] = await this.db.query<any[]>(
      'SELECT * FROM kedb_articulos WHERE id_articulo = ? AND activo = TRUE',
      [id],
    );
    if (!rows.length) throw new NotFoundException('Artículo no encontrado');

    await this.db.query('UPDATE kedb_articulos SET vistas = vistas + 1 WHERE id_articulo = ?', [id]);
    return { ...rows[0], vistas: Number(rows[0].vistas) + 1 };
  }

  async crear(body: any) {
    const {
      titulo,
      contenido,
      categoria = 'Ambas',
      palabras_clave = null,
      imagen_url = null,
      enlace = null,
      creditos = null,
    } = body || {};

    if (!titulo?.trim() || !contenido?.trim()) {
      throw new BadRequestException('Título y contenido son obligatorios');
    }
    if (!['TI General', 'Ciberseguridad', 'Ambas'].includes(categoria)) {
      throw new BadRequestException('Categoría inválida');
    }

    const [r] = await this.db.query<any>(
      'INSERT INTO kedb_articulos (titulo, contenido, categoria, palabras_clave, imagen_url, enlace, creditos) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id_articulo',
      [titulo.trim(), contenido.trim(), categoria, palabras_clave, imagen_url, enlace, creditos],
    );
    return { id_articulo: r[0].id_articulo, mensaje: 'Artículo creado' };
  }

  async editar(idRaw: any, body: any) {
    const id = Number(idRaw);
    const {
      titulo,
      contenido,
      categoria = 'Ambas',
      palabras_clave = null,
      imagen_url = null,
      enlace = null,
      creditos = null,
    } = body || {};

    if (!titulo?.trim() || !contenido?.trim()) {
      throw new BadRequestException('Título y contenido son obligatorios');
    }
    if (!['TI General', 'Ciberseguridad', 'Ambas'].includes(categoria)) {
      throw new BadRequestException('Categoría inválida');
    }

    const [, r] = await this.db.query<any>(
      'UPDATE kedb_articulos SET titulo = ?, contenido = ?, categoria = ?, palabras_clave = ?, imagen_url = ?, enlace = ?, creditos = ? WHERE id_articulo = ?',
      [titulo.trim(), contenido.trim(), categoria, palabras_clave, imagen_url, enlace, creditos, id],
    );
    if (!r.affectedRows) throw new NotFoundException('Artículo no encontrado');
    return { mensaje: 'Artículo actualizado' };
  }

  async eliminar(idRaw: any) {
    const [, r] = await this.db.query<any>(
      'UPDATE kedb_articulos SET activo = FALSE WHERE id_articulo = ?',
      [Number(idRaw)],
    );
    if (!r.affectedRows) throw new NotFoundException('Artículo no encontrado');
    return { mensaje: 'Artículo desactivado' };
  }
}
