#!/usr/bin/env node
// Ch.18 §17 Database Migration Procedure (Review → Verify backup → Execute
// → Validate schema → Verify indexes → Verify application startup). This
// script is "Execute migration": it applies infrastructure/database/
// migrations/*.sql in order against DATABASE_URL, tracking what has already
// run in a ledger table so it's safe to re-run (only pending files apply).
//
// Usage: DATABASE_URL=postgres://... node scripts/migrate.mjs [--dry-run]

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../infrastructure/database/migrations');
const dryRun = process.argv.includes('--dry-run');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required (Ch.18 §18 Environment Variable Validation).');
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();
  await client.query(`
    create table if not exists public._schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows: appliedRows } = await client.query(
    'select filename from public._schema_migrations',
  );
  const applied = new Set(appliedRows.map((r) => r.filename));

  const allFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const pending = allFiles.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log(`Up to date — ${allFiles.length} migrations already applied, 0 pending.`);
    await client.end();
    return;
  }

  console.log(`${pending.length} pending migration(s) of ${allFiles.length} total:`);
  for (const file of pending) console.log(`  - ${file}`);

  if (dryRun) {
    console.log('\n--dry-run: no changes made.');
    await client.end();
    return;
  }

  for (const file of pending) {
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Applying ${file}...`);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query(
        'insert into public._schema_migrations (filename) values ($1)',
        [file],
      );
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      console.error(`Migration failed at ${file}:`, cause instanceof Error ? cause.message : cause);
      console.error('Ch.18 §17: migration failures trigger rollback. No further files applied.');
      await client.end();
      process.exit(1);
    }
  }

  console.log(`\nDone — applied ${pending.length} migration(s).`);
  await client.end();
}

main().catch(async (cause) => {
  console.error(cause);
  await client.end().catch(() => {});
  process.exit(1);
});
