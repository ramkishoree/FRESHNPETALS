#!/usr/bin/env node
// Fresh & Petals demo/sample content — NOT a schema migration (this is
// business content specific to this install, not something every future
// Prana Commerce OS shop should get), so it lives outside
// infrastructure/database/migrations and isn't run by scripts/migrate.mjs.
// Idempotent: every insert is keyed on a unique slug/sku with ON CONFLICT
// DO UPDATE (so a rerun refreshes content, e.g. after swapping images) or
// DO NOTHING where there's nothing sensible to update, safe to re-run.
//
// Product/blog images are real photos, pre-converted to WebP and uploaded
// to the `media` Supabase Storage bucket (see scripts/README for the
// one-off upload step) — this script only wires the resulting URLs in.
//
// Usage: DATABASE_URL=postgres://... node scripts/seed-demo-data.mjs

import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const IMG = (name) =>
  `https://swenryjqcdogbhvvwqvq.supabase.co/storage/v1/object/public/media/demo-seed/${name}.webp`;

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
    image: IMG('dozen-red-roses'),
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
    image: IMG('spring-mixed-bouquet'),
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
    image: IMG('anniversary-deluxe-arrangement'),
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
    image: IMG('classic-anniversary-bouquet'),
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
    image: IMG('birthday-bright-bunch'),
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
    image: IMG('birthday-bouquet-with-balloon'),
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
    image: IMG('white-lily-sympathy-arrangement'),
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
    image: IMG('condolence-wreath'),
  },
];

const BLOGS = [
  {
    id: '00000000-0000-0000-0000-000000000401',
    slug: 'how-to-make-your-bouquet-last-longer',
    title: 'How to Make Your Bouquet Last Longer',
    excerpt: 'Simple care tips to keep your fresh flowers vibrant for days longer.',
    image: IMG('blog-bouquet-care'),
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
    image: IMG('blog-choosing-flowers'),
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

// Guest customers (no linked auth user) purely to attach demo reviews to —
// customers.user_id is nullable, exactly the "guest checkout" shape real
// orders already produce.
const DEMO_CUSTOMERS = [
  { id: '00000000-0000-0000-0000-000000000501', first: 'Priya', last: 'Sharma', email: 'demo.priya@example.com' },
  { id: '00000000-0000-0000-0000-000000000502', first: 'Rohan', last: 'Verma', email: 'demo.rohan@example.com' },
  { id: '00000000-0000-0000-0000-000000000503', first: 'Ananya', last: 'Iyer', email: 'demo.ananya@example.com' },
];

const REVIEWS = [
  { productId: '00000000-0000-0000-0000-000000000301', customerIdx: 0, rating: 5, title: 'Beautiful and fresh', comment: 'The roses were fresh and lasted almost two weeks. Delivery was right on time for our anniversary.' },
  { productId: '00000000-0000-0000-0000-000000000301', customerIdx: 1, rating: 4, title: 'Great gift', comment: 'Looked exactly like the photos. Would order again.' },
  { productId: '00000000-0000-0000-0000-000000000302', customerIdx: 2, rating: 5, title: 'Loved the colors', comment: 'Such a cheerful bunch of tulips, brightened up the whole room.' },
  { productId: '00000000-0000-0000-0000-000000000303', customerIdx: 0, rating: 5, title: 'Worth every rupee', comment: 'The vase arrangement was stunning, my wife loved it.' },
  { productId: '00000000-0000-0000-0000-000000000305', customerIdx: 1, rating: 4, title: 'Kids loved it', comment: 'Bright and colorful, perfect for a birthday.' },
  { productId: '00000000-0000-0000-0000-000000000307', customerIdx: 2, rating: 5, title: 'Tasteful and dignified', comment: 'Exactly the respectful arrangement we needed. Thank you.' },
];

const STATIC_PAGES = [
  {
    slug: 'about',
    title: 'About Fresh & Petals',
    blocks: [
      { type: 'paragraph', text: 'Fresh & Petals started in Lucknow with a simple idea: flowers should be fresh, honestly priced, and delivered on time, every time.' },
      { type: 'paragraph', text: 'We work directly with local growers each morning so every bouquet that leaves our outlet is cut within hours of delivery — not days.' },
      { type: 'paragraph', text: 'Today we serve anniversaries, birthdays, and quiet condolence deliveries alike, with the same care for every order regardless of size.' },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact Us',
    blocks: [
      { type: 'paragraph', text: 'Have a question about an order, a bulk/corporate enquiry, or same-day delivery? Reach us any of these ways:' },
      { type: 'paragraph', text: 'Phone: +91 12345 67890\nEmail: hello@freshnpetals.in\nHours: 9:00 AM – 8:00 PM, all days' },
      { type: 'paragraph', text: 'Outlet: Fresh & Petals - Lucknow Hub, Hazratganj, Lucknow, Uttar Pradesh' },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    blocks: [
      { type: 'paragraph', text: 'This is placeholder demo content — replace with your actual privacy policy before launch.' },
      { type: 'paragraph', text: 'We collect only the information needed to process and deliver your order: name, delivery address, phone number, and payment confirmation from our payment processor. We never sell customer data to third parties.' },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    blocks: [
      { type: 'paragraph', text: 'This is placeholder demo content — replace with your actual terms before launch.' },
      { type: 'paragraph', text: 'Orders are confirmed once payment is captured. Delivery windows are estimates based on outlet capacity and distance; same-day orders placed after 6 PM may be scheduled for next-day delivery.' },
    ],
  },
  {
    slug: 'delivery-policy',
    title: 'Delivery Policy',
    blocks: [
      { type: 'paragraph', text: 'Delivery fee is calculated by distance from your nearest Fresh & Petals outlet: ₹50 for the first 5 km, plus ₹5 per additional km.' },
      { type: 'paragraph', text: 'Same-day delivery is available for orders placed before 6 PM, subject to outlet stock and delivery slot availability. Choose your preferred slot at checkout.' },
    ],
  },
];

// Homepage hero — a different content shape than STATIC_PAGES' blocks
// array (StaticPageContent never renders this row; the homepage reads it
// directly). Editable via Admin → Pages → "home" → Body content.
const HOME_PAGE_HERO = {
  slug: 'home',
  title: 'Homepage Hero',
  content: {
    eyebrow: "Lucknow's neighbourhood florist",
    title: 'Fresh flowers, delivered',
    titleHighlight: 'same-day.',
    subtitle:
      "Hand-picked bouquets for every occasion — Lucknow's freshest flower delivery, arranged fresh the morning it ships.",
    ctaLabel: 'Shop now',
  },
};

const FAQS = [
  { question: 'How fresh are the flowers?', answer: 'Every bouquet is arranged the morning of delivery using stock sourced from local growers — nothing sits in cold storage for days.' },
  { question: 'Can I schedule delivery for a specific date and time?', answer: 'Yes — pick a delivery slot at checkout. Same-day slots are available for orders placed before 6 PM, subject to availability.' },
  { question: 'What if I need to change my delivery address after ordering?', answer: 'Contact us as soon as possible via the Contact page. We can usually update the address if the order hasn’t been dispatched yet.' },
  { question: 'Do you deliver outside Lucknow?', answer: 'We currently deliver within range of our Lucknow outlet. Check the delivery fee calculator at checkout — it will tell you if your address is in range.' },
  { question: 'What is your refund policy?', answer: 'If your bouquet arrives damaged or significantly different from what was ordered, contact us within 24 hours with a photo and we’ll arrange a replacement or refund.' },
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
         on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order`,
        [category.id, category.slug, category.name, category.sort],
      );
    }

    for (const product of PRODUCTS) {
      await client.query(
        `insert into public.products (id, sku, slug, name, short_description, description, category_id, featured_image, status, visibility)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'published', true)
         on conflict (slug) do update set
           short_description = excluded.short_description,
           description = excluded.description,
           featured_image = excluded.featured_image`,
        [
          product.id,
          product.sku,
          product.slug,
          product.name,
          product.short,
          product.long,
          product.categoryId,
          product.image,
        ],
      );

      await client.query(
        `insert into public.product_prices (product_id, base_price, currency)
         values ($1, $2, 'INR')
         on conflict (product_id) do update set base_price = excluded.base_price`,
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
        `insert into public.blogs (id, title, slug, excerpt, featured_image, status, reading_time_minutes, published_at)
         values ($1, $2, $3, $4, $5, 'published', 3, now())
         on conflict (slug) do update set excerpt = excluded.excerpt, featured_image = excluded.featured_image
         returning id, (xmax = 0) as inserted`,
        [blog.id, blog.title, blog.slug, blog.excerpt, blog.image],
      );
      if (!rows[0]?.inserted) continue; // already had blocks seeded, don't duplicate

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

    for (const customer of DEMO_CUSTOMERS) {
      await client.query(
        `insert into public.customers (id, first_name, last_name, email, preferred_language)
         values ($1, $2, $3, $4, 'en')
         on conflict (id) do nothing`,
        [customer.id, customer.first, customer.last, customer.email],
      );
    }

    for (const review of REVIEWS) {
      const customer = DEMO_CUSTOMERS[review.customerIdx];
      const { rows: existing } = await client.query(
        `select id from public.reviews where product_id = $1 and customer_id = $2`,
        [review.productId, customer.id],
      );
      if (existing.length > 0) continue;
      await client.query(
        `insert into public.reviews (product_id, customer_id, rating, title, comment, verified_purchase, status)
         values ($1, $2, $3, $4, $5, true, 'approved')`,
        [review.productId, customer.id, review.rating, review.title, review.comment],
      );
    }

    for (const page of STATIC_PAGES) {
      const content = JSON.stringify({ blocks: page.blocks });
      await client.query(
        `insert into public.static_pages (title, slug, status, content)
         values ($1, $2, 'published', $3::jsonb)
         on conflict (slug) do update set content = excluded.content, status = 'published'`,
        [page.title, page.slug, content],
      );
    }

    // Only seeds if missing (unlike STATIC_PAGES above) — once an admin
    // has customized the homepage hero via the Pages tab, rerunning this
    // script must not silently overwrite their edits.
    await client.query(
      `insert into public.static_pages (title, slug, status, content)
       values ($1, $2, 'published', $3::jsonb)
       on conflict (slug) do nothing`,
      [HOME_PAGE_HERO.title, HOME_PAGE_HERO.slug, JSON.stringify(HOME_PAGE_HERO.content)],
    );

    for (let i = 0; i < FAQS.length; i++) {
      const faq = FAQS[i];
      const { rows: existing } = await client.query(
        `select id from public.faqs where question = $1 and entity_type is null`,
        [faq.question],
      );
      if (existing.length > 0) continue;
      await client.query(
        `insert into public.faqs (question, answer, sort_order, published)
         values ($1, $2, $3, true)`,
        [faq.question, faq.answer, i],
      );
    }

    await client.query('commit');
    console.log(
      `Seeded: 1 outlet, ${CATEGORIES.length} categories, ${PRODUCTS.length} products (with real WebP images + prices + inventory), ${BLOGS.length} blog posts, ${DEMO_CUSTOMERS.length} demo customers, ${REVIEWS.length} reviews, ${STATIC_PAGES.length} static pages, ${FAQS.length} FAQs.`,
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
