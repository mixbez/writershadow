import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
let pool = null;

function getPool() {
  if (!pool && process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function runMigrations() {
  const p = getPool();
  if (!p) {
    console.log('No DATABASE_URL configured, skipping migrations');
    return;
  }
  try {
    const __dir = dirname(fileURLToPath(import.meta.url));
    const sql = readFileSync(join(__dir, 'migrations/001_initial.sql'), 'utf8');
    await p.query(sql);
    console.log('Migrations applied');
  } catch (error) {
    console.warn('Migration failed:', error.message);
  }
}

export async function query(text, params) {
  const p = getPool();
  if (!p) {
    throw new Error('Database not configured');
  }
  return p.query(text, params);
}
