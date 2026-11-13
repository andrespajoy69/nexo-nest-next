import { mkdirSync } from 'fs';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { API_ROOT } from './env';

export const UPLOADS_DIR = resolve(API_ROOT, process.env.UPLOADS_DIR || 'uploads/evidencias');
export const LEGACY_UPLOADS_DIR = process.env.LEGACY_UPLOADS_DIR
  ? resolve(process.env.LEGACY_UPLOADS_DIR)
  : null;

mkdirSync(UPLOADS_DIR, { recursive: true });

export const existeDirectorio = (ruta: string | null): ruta is string =>
  Boolean(ruta && existsSync(ruta));
