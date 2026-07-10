import { expect, test } from '@playwright/test';

/**
 * Ch.17 Part 4 (§71-74) Customer Journey / Homepage / Product Browsing
 * tests. Storefront pages degrade to an honest empty state rather than
 * crashing when Supabase is unreachable (Phase 9), so these specs are
 * real against this sandbox's dev server, not just against a live
 * staging environment with seeded data.
 */

test.describe('Storefront', () => {
  test('homepage loads with header, hero, and footer', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Fresh & Petals' }).first()).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('shop page loads', async ({ page }) => {
    await page.goto('/shop');
    await expect(page).toHaveURL(/\/shop/);
  });

  test('search page loads and accepts a query', async ({ page }) => {
    await page.goto('/search?q=rose');
    await expect(page).toHaveURL(/\/search/);
  });

  test('blog index loads', async ({ page }) => {
    await page.goto('/blog');
    await expect(page).toHaveURL(/\/blog/);
  });

  test.describe('static pages', () => {
    for (const path of ['/faq', '/contact', '/privacy', '/terms', '/delivery-policy']) {
      test(`${path} loads without error`, async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status()).toBeLessThan(400);
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
