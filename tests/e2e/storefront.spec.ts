import { expect, test } from '@playwright/test';

/**
 * Ch.17 Part 4 (§71-74) Customer Journey / Homepage / Product Browsing
 * tests. Storefront pages degrade to an honest empty state rather than
 * crashing when Supabase is unreachable (Phase 9), so these specs are
 * real against this sandbox's dev server, not just against a live
 * staging environment with seeded data.
 */

test.describe('Storefront', () => {
  test('landing page is the product catalogue itself', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Fresh & Petals' }).first()).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    // The revamp put the catalogue on `/` with no hero above it — the
    // product count heading is the first thing on the page.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/product/i);
    expect(errors).toEqual([]);
  });

  test('primary navigation is exactly Products, Orders, My Account', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    await expect(nav.getByRole('link')).toHaveText(['Products', 'Orders', 'My Account']);
  });

  test('the old /shop URL permanently redirects to the catalogue root', async ({ page }) => {
    await page.goto('/shop');
    await expect(page).toHaveURL(/\/$/);
  });

  test('search page loads and accepts a query', async ({ page }) => {
    await page.goto('/search?q=rose');
    await expect(page).toHaveURL(/\/search/);
  });

  test.describe('legal pages', () => {
    for (const path of ['/privacy', '/terms']) {
      test(`${path} loads without error`, async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status()).toBeLessThan(400);
      });
    }
  });

  test.describe('removed pages redirect home', () => {
    for (const path of ['/blog', '/about', '/faq', '/contact', '/delivery-policy', '/locations']) {
      test(`${path} no longer exists`, async ({ page }) => {
        await page.goto(path);
        await expect(page).toHaveURL(/\/$/);
      });
    }
  });

  test('cart page shows the empty-cart state for a first-time visitor', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByText(/empty/i).first()).toBeVisible();
  });

  test('an unknown route renders the on-brand 404 page', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
  });
});
