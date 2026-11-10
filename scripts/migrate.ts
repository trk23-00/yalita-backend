import 'dotenv/config';
import { Client } from 'pg';
import { readFile } from 'node:fs/promises';

// SQL versionado para conservar las restricciones CHECK y el índice funcional del SQL original.
const client = new Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema') ?? 'public';
  await client.query("SELECT set_config('search_path', $1, false)", [`"${schema.replaceAll('"', '""')}"`]);
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(709131)");
  await client.query('CREATE TABLE IF NOT EXISTS api_migrations (nombre text PRIMARY KEY, fecha timestamptz NOT NULL DEFAULT now())');
  for (const name of ['001_base.sql', '002_api.sql']) {
    const applied = await client.query('SELECT 1 FROM api_migrations WHERE nombre = $1', [name]);
    if (applied.rowCount) continue;
    const existing = await client.query("SELECT to_regclass('usuarios') AS tabla");
    if (name !== '001_base.sql' || !existing.rows[0].tabla) {
      await client.query(await readFile(new URL(`../database/${name}`, import.meta.url), 'utf8'));
    }
    await client.query('INSERT INTO api_migrations(nombre) VALUES ($1)', [name]);
  }
  await client.query('COMMIT');
  console.log('Base de datos preparada.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(error instanceof Error ? error.message : 'Error de migración');
  process.exitCode = 1;
} finally { await client.end(); }
