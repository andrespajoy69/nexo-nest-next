import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

// Raíz de apps/api, tanto en `src` (ts) como en `dist` (js compilado).
export const API_ROOT = resolve(__dirname, '..', '..');

const candidatos = [
  join(process.cwd(), '.env'),
  join(API_ROOT, '.env'),
  join(__dirname, '..', '..', '.env'),
];

for (const ruta of candidatos) {
  if (existsSync(ruta)) {
    config({ path: ruta });
    break;
  }
}
