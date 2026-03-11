import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function runMigrations() {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const migrationsDir = join(__dir, 'migrations');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const { rows: applied } = await pool.query('SELECT name FROM migrations');
  const appliedNames = new Set(applied.map(r => r.name));

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedNames.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
    console.log(`Migration applied: ${file}`);
  }
}

export async function query(text, params) {
  return pool.query(text, params);
}
