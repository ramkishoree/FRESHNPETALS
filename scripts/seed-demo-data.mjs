#!/usr/bin/env node
// Fresh & Petals demo/sample content — NOT a schema migration (this is
// business content specific to this install, not something every future
// Prana Commerce OS shop should get), so it lives outside
// infrastructure/database/migrations and isn't run by scripts/migrate.mjs.
// Idempotent: every insert is keyed on a unique slug/sku with ON CONFLICT
// DO NOTHING, safe to re-run.
//
// Usage: DATABASE_URL=postgres://... node scripts/seed-demo-data.mjs

import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const OUTLET_ID = '00000000-0000-0000-0000-000000000100';

const CATEGORIES = [
  { id: '00000000-0000-0000-0000-000000000201', slug: 'bouquets', name: 'Bouquets', sort: 1 },
  { id: '00000000-0000-0000-0000-000000000202', slug: 'anniversary', name: 'Anniversary', sort: 2 },
  { id: '00000000-0000-0000-0000-000000000203', slug: 'birthday', name: 'Birthday', sort: 3 },
  { id: '00000000-0000-0000-0000-000000000204', slug: 'sympathy', name: 'Sympathy', sort: 4 },
];

const PRODUCTS = [
  {
    id: '00000000-0000-0000-0000-000000000301',
    sku: 'FP-ROSE-RED-12',
    slug: 'dozen-red-roses',
    name: 'Dozen Red Roses',
    short: 'A classic dozen fresh red roses, hand-tied.',
    long: 'Twelve premium long-stem red roses, hand-selected and arranged with seasonal greens. A timeless choice for anniversaries and romantic gestures.',
    categoryId: '00000000-0000-0000-0000-000000000201',
    price: 999,
    stock: 25,
  },
  {
    id: '00000000-0000-0000-0000-000000000302',
    sku: 'FP-MIX-SPRING-01',
    slug: 'spring-mixed-bouquet',
    name: 'Spring Mixed Bouquet',
    short: 'A cheerful mix of seasonal blooms.',
    long: 'Tulips, daisies, and carnations in a bright seasonal mix — arranged fresh the morning of delivery.',
    categoryId: '00000000-0000-0000-0000-000000000201',
    price: 799,
    stock: 30,
  },
  {
    id: '00000000-0000-0000-0000-000000000303',
    sku: 'FP-ANNIV-DELUXE-01',
    slug: 'anniversary-deluxe-arrangement',
    name: 'Anniversary Deluxe Arrangement',
    short: 'Premium roses and lilies in a keepsake vase.',
    long: 'A deluxe arrangement of red roses and white lilies in a reusable glass vase, finished with a handwritten card.',
    categoryId: '00000000-0000-0000-0000-000000000202',
    price: 1499,
    stock: 15,
  },
  {
    id: '00000000-0000-0000-0000-000000000304',
    sku: 'FP-ANNIV-CLASSIC-01',
    slug: 'classic-anniversary-bouquet',
    name: 'Classic Anniversary Bouquet',
    short: 'Timeless red and white roses.',
    long: 'A balanced arrangement of red and white roses, symbolizing lasting love — a classic anniversary gift.',
    categoryId: '00000000-0000-0000-0000-000000000202',
    price: 1199,
    stock: 20,
  },
  {
    id: '00000000-0000-0000-0000-000000000305',
    sku: 'FP-BDAY-BRIGHT-01',
    slug: 'birthday-bright-bunch',
    name: 'Birthday Bright Bunch',
    short: 'Vibrant gerberas and sunflowers.',
    long: 'A vibrant, playful mix of gerberas and sunflowers to brighten any birthday celebration.',
    categoryId: '00000000-0000-0000-0000-000000000203',
    price: 699,
    stock: 35,
  },
  {
    id: '00000000-0000-0000-0000-000000000306',
    sku: 'FP-BDAY-BALLOON-01',
    slug: 'birthday-bouquet-with-balloon',
    name: 'Birthday Bouquet with Balloon',
    short: 'Mixed blooms with a birthday balloon.',
    long: 'A festive mixed bouquet paired with a "Happy Birthday" balloon — delivered together, ready to celebrate.',
    categoryId: '00000000-0000-0000-0000-000000000203',
    price: 899,
    stock: 20,
  },
  {
    id: '00000000-0000-0000-0000-000000000307',
    sku: 'FP-SYMP-WHITE-01',
    slug: 'white-lily-sympathy-arrangement',
    name: 'White Lily Sympathy Arrangement',
    short: 'Serene white lilies for condolence.',
    long: 'A calm, respectful arrangement of white lilies and chrysanthemums, suited for sympathy and condolence.',
    categoryId: '00000000-0000-0000-0000-000000000204',
    price: 1099,
    stock: 12,
  },
  {
    id: '00000000-0000-0000-0000-000000000308',
    sku: 'FP-SYMP-WREATH-01',
    slug: 'condolence-wreath',
    name: 'Condolence Wreath',
    short: 'A traditional standing wreath.',
    long: 'A traditional standing wreath of white and cream flowers, suitable for funerals and memorial services.',
    categoryId: '00000000-0000-0000-0000-000000000204',
    price: 2499,
    stock: 8,
  },
];

const BLOGS = [
  {
    id: '00000000-0000-0000-0000-000000000401',
    slug: 'how-to-make-your-bouquet-last-longer',
    title: 'How to Make Your Bouquet Last Longer',
    excerpt: 'Simple care tips to keep your fresh flowers vibrant for days longer.',
    blocks: [
      { type: 'heading', content: { text: 'Fresh Cuts Matter', level: 2 } },
      {
        type: 'paragraph',
        content: {
          text: 'Trim about an inch off each stem at a 45-degree angle before placing your bouquet in water — this helps the flowers absorb water more efficiently.',
        },
      },
      { type: 'heading', content: { text: 'Change the Water Often', level: 2 } },
      {
        type: 'paragraph',
        content: {
          text: 'Replace the water every two days and keep your arrangement away from direct sunlight and heating vents to extend its life by up to a week.',
        },
      },
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000402',
    slug: 'choosing-flowers-for-every-occasion',
    title: 'Choosing the Right Flowers for Every Occasion',
    excerpt: 'A quick guide to picking the perfect bouquet for anniversaries, birthdays, and more.',
    blocks: [
      { type: 'heading', content: { text: 'Anniversaries', level: 2 } },
      {
        type: 'paragraph',
        content: {
          text: 'Red roses remain the classic choice for romance, while a mix of red and white roses symbolizes unity and lasting love.',
        },
      },
      { type: 'heading', content: { text: 'Birthdays', level: 2 } },
      {
        type: 'paragraph',
        content: {
          text: 'Bright, playful blooms like gerberas and sunflowers suit the celebratory mood of a birthday far better than more formal arrangements.',
        },
      },
    ],
  },
];

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  await client.query('begin');
  try {
    await client.query(
      `insert into public.outlets (id, name, slug, address, city, state, country, latitude, longitude, phone, is_active)
       values ($1, 'Fresh & Petals - Lucknow Hub', 'lucknow-hub', 'Hazratganj', 'Lucknow', 'Uttar Pradesh', 'IN', 26.8467, 80.9462, '+911234567890', true)
       on conflict (slug) do nothing`,
      [OUTLET_ID],
    );

    for (const category of CATEGORIES) {
      await client.query(
        `insert into public.categories (id, slug, name, sort_order, is_active)
         values ($1, $2, $3, $4, true)
         on conflict (slug) do nothing`,
        [category.id, category.slug, category.name, category.sort],
      );
    }

    for (const product of PRODUCTS) {
      await client.query(
        `insert into public.products (id, sku, slug, name, short_description, description, category_id, status, visibility)
         values ($1, $2, $3, $4, $5, $6, $7, 'published', true)
         on conflict (slug) do nothing`,
        [
          product.id,
          product.sku,
          product.slug,
          product.name,
          product.short,
          product.long,
          product.categoryId,
        ],
      );

      await client.query(
        `insert into public.product_prices (product_id, base_price, currency)
         values ($1, $2, 'INR')
         on conflict (product_id) do nothing`,
        [product.id, product.price],
      );

      await client.query(
        `insert into public.inventory (product_id, outlet_id, physical_quantity, reserved_quantity)
         values ($1, $2, $3, 0)
         on conflict (outlet_id, product_id) do nothing`,
        [product.id, OUTLET_ID, product.stock],
      );
    }

    for (const blog of BLOGS) {
      const { rows } = await client.query(
        `insert into public.blogs (id, title, slug, excerpt, status, reading_time_minutes, published_at)
         values ($1, $2, $3, $4, 'published', 3, now())
         on conflict (slug) do nothing
         returning id`,
        [blog.id, blog.title, blog.slug, blog.excerpt],
      );
      if (rows.length === 0) continue; // already seeded, blocks already exist too

      let position = 0;
      for (const block of blog.blocks) {
        await client.query(
          `insert into public.blog_blocks (blog_id, block_type, position, content)
           values ($1, $2, $3, $4)`,
          [blog.id, block.type, position, JSON.stringify(block.content)],
        );
        position += 1;
      }
    }

    await client.query('commit');
    console.log(
      `Seeded: 1 outlet, ${CATEGORIES.length} categories, ${PRODUCTS.length} products (with prices + inventory), ${BLOGS.length} blog posts.`,
    );
  } catch (cause) {
    await client.query('rollback');
    console.error('Seed failed, rolled back:', cause instanceof Error ? cause.message : cause);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
