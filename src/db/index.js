import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function runMigrations() {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(join(__dir, 'migrations/001_initial.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migrations applied');
}

export async function query(text, params) {
  return pool.query(text, params);
}
