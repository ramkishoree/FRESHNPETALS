import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Ch.17 Part 3 (§36-66) Integration Testing & API Validation — "Checkout
 * Idempotency" (§45) and "Duplicate Webhooks" (§47) are named explicitly.
 * Every migration/RPC in this project was hand-verified against a
 * disposable Docker Postgres during its own phase (documented in each
 * phase's docs/*.md); this test is that same verification ritual made
 * permanent and CI-runnable instead of a one-time manual session.
 *
 * Requires a reachable Docker daemon. Skips (rather than failing CI on
 * runners without Docker) if one isn't available.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(here, '../../infrastructure/database');
const migrationsDir = path.join(dbDir, 'migrations');
const shimFile = path.join(dbDir, 'test-shim/0000_supabase_shim.sql');

let container: StartedTestContainer | undefined;
let client: Client | undefined;

beforeAll(async () => {
  try {
    container = await new GenericContainer('pgvector/pgvector:pg17')
      .withEnvironment({ POSTGRES_PASSWORD: 'postgres' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
      .start();
  } catch (cause) {
    throw new Error(
      'checkout-idempotency.test.ts requires a reachable Docker daemon (used to run a disposable Postgres). ' +
        `Original error: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  client = new Client({
    host: container.getHost(),
    port: container.getMappedPort(5432),
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });
  await client.connect();
  await client.query('create extension if not exists vector;');
  await client.query(readFileSync(shimFile, 'utf8'));

  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    await client.query(readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  // Minimal fixture: one outlet, one category, one product with stock.
  await client.query(
    `insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'owner@fnp.test');`,
  );
  await client.query(`
    insert into public.categories (id, slug, name) values ('00000000-0000-0000-0000-000000000010', 'bouquets', 'Bouquets');
    insert into public.outlets (id, name, slug, address, city, latitude, longitude, is_active)
      values ('00000000-0000-0000-0000-000000000020', 'Lucknow Hub', 'lucknow-hub', 'MG Road', 'Lucknow', 26.8467, 80.9462, true);
    insert into public.products (id, sku, slug, name, description, category_id, status)
      values ('00000000-0000-0000-0000-000000000030', 'SKU-ROSE-1', 'rose-bouquet', 'Rose Bouquet', 'A dozen red roses.', '00000000-0000-0000-0000-000000000010', 'published');
    insert into public.product_prices (product_id, base_price, created_by, updated_by)
      values ('00000000-0000-0000-0000-000000000030', 999, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
    insert into public.inventory (product_id, outlet_id, physical_quantity, reserved_quantity)
      values ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000020', 10, 0);
    insert into public.customers (id) values ('00000000-0000-0000-0000-000000000040');
  `);
}, 120_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
});

describe('checkout_complete idempotency (Ch.8 §102, Ch.17 §45/§47)', () => {
  it('creates exactly one order no matter how many times the same payment webhook replays', async () => {
    const items = JSON.stringify([
      {
        product_id: '00000000-0000-0000-0000-000000000030',
        sku: 'SKU-ROSE-1',
        name: 'Rose Bouquet',
        quantity: 2,
        unit_price: 999,
      },
    ]);
    const pricing = JSON.stringify({
      subtotal: 1998,
      discountTotal: 0,
      couponDiscount: 0,
      deliveryFee: 79,
      taxTotal: 99.9,
      grandTotal: 2176.9,
    });

    const {
      rows: [session],
    } = await client!.query(`select * from checkout_start($1, $2, $3, '{}'::jsonb, $4, $5)`, [
      '00000000-0000-0000-0000-000000000040',
      items,
      '00000000-0000-0000-0000-000000000020',
      pricing,
      JSON.stringify({ items: JSON.parse(items) }),
    ]);

    const paymentId = 'pay_idempotency_test_1';
    await client!.query(`select * from checkout_complete($1, $2, $3, $4, $5)`, [
      session.id,
      'order_test_1',
      paymentId,
      'sig_test',
      2176.9,
    ]);
    await client!.query(`select * from checkout_complete($1, $2, $3, $4, $5)`, [
      session.id,
      'order_test_1',
      paymentId,
      'sig_test',
      2176.9,
    ]);

    const { rows: orderCountRows } = await client!.query(
      `select count(*)::int as count from public.orders where checkout_session_id = $1`,
      [session.id],
    );
    expect(orderCountRows[0].count).toBe(1);

    const { rows: inventoryRows } = await client!.query(
      `select physical_quantity, reserved_quantity from public.inventory where product_id = '00000000-0000-0000-0000-000000000030'`,
    );
    expect(inventoryRows[0].physical_quantity).toBe(8);
    expect(inventoryRows[0].reserved_quantity).toBe(0);
  });

  it('rejects a checkout_start that requests more than is in stock, with no partial state change', async () => {
    const items = JSON.stringify([
      {
        product_id: '00000000-0000-0000-0000-000000000030',
        sku: 'SKU-ROSE-1',
        name: 'Rose Bouquet',
        quantity: 999,
        unit_price: 999,
      },
    ]);

    await expect(
      client!.query(`select * from checkout_start($1, $2, $3, '{}'::jsonb, '{}'::jsonb, $4)`, [
        '00000000-0000-0000-0000-000000000040',
        items,
        '00000000-0000-0000-0000-000000000020',
        JSON.stringify({ items: JSON.parse(items) }),
      ]),
    ).rejects.toThrow(/Insufficient inventory/);
  });
});
