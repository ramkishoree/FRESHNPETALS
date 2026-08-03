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

  // Below the `lg` breakpoint the primary nav is `hidden` and the same
  // three links live in the hamburger sheet instead, so asserting the
  // desktop nav unconditionally fails on the mobile project rather than
  // catching a regression. Both surfaces are checked, each where it
  // actually renders.
  test('primary navigation is exactly Products, Orders, My Account', async ({ page }) => {
    await page.goto('/');
    const expected = ['Products', 'Orders', 'My Account'];

    const desktopNav = page.getByRole('navigation', { name: 'Primary navigation' });
    if (await desktopNav.isVisible()) {
      await expect(desktopNav.getByRole('link')).toHaveText(expected);
      return;
    }

    await page.getByRole('button', { name: 'Open menu' }).click();
    const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(mobileNav.getByRole('link')).toHaveText(expected);
  });

  test('the old /shop URL permanently redirects to the catalogue root', async ({ page }) => {
    await page.goto('/shop');
    await expect(page).toHaveURL(/\/$/);
  });

  test('search page loads and accepts a query', async ({ page }) => {
    await page.goto('/search?q=rose');
    await expect(page).toHaveURL(/\/search/);
  });

  /**
   * The catalogue grid overflowed a 360px screen by ~90px because grid
   * items default to `min-width: auto`, so a long product name beside a
   * nowrap price set a min-content floor wider than half the screen.
   * `overflow-x: hidden` on html/body hid the symptom, which is why this
   * measures with that lifted — otherwise the assertion passes on a page
   * that still scrolls sideways for the user.
   */
  test.describe('no horizontal overflow', () => {
    for (const width of [360, 390, 768, 1024]) {
      test(`page fits a ${width}px viewport`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        const overflow = await page.evaluate(() => {
          const html = document.documentElement;
          const body = document.body;
          const prevHtml = html.style.overflowX;
          const prevBody = body.style.overflowX;
          html.style.overflowX = 'visible';
          body.style.overflowX = 'visible';
          void html.offsetWidth;
          const over = html.scrollWidth - html.clientWidth;
          html.style.overflowX = prevHtml;
          body.style.overflowX = prevBody;
          return over;
        });
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });

  test('sort options cover price, stock and rating', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Sort products' }).click();
    for (const label of [
      'Price: low to high',
      'Price: high to low',
      'Stock: high to low',
      'Rating: high to low',
    ]) {
      await expect(page.getByRole('option', { name: label })).toBeVisible();
    }
  });

  test.describe('legal pages', () => {
    for (const path of ['/privacy', '/terms', '/shipping', '/refunds']) {
      test(`${path} loads without error`, async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status()).toBeLessThan(400);
      });
    }
  });

  /**
   * The listing card has greyed out sold-out products for a long time,
   * but the product page itself never fetched inventory — so an
   * out-of-stock item could still be added to the cart and bought from
   * the page a shared link lands on. Wishlist stays enabled on purpose.
   */
  test('an out-of-stock product cannot be bought, only wishlisted', async ({ page }) => {
    await page.goto('/?sort=stock_desc');
    // Lowest stock sorts last, so the final card is the surest sold-out
    // one without hardcoding a slug that seed data may change.
    const lastCard = page.locator('.plate').last();
    await expect(lastCard).toBeVisible();
    const soldOut = await lastCard.getByText('Out of stock').count();
    test.skip(soldOut === 0, 'every product is in stock in this environment');

    await lastCard.locator('a').first().click();
    await expect(page).toHaveURL(/\/product\//);

    await expect(page.getByText('No stock — currently unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Buy now' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add to wishlist' })).toBeEnabled();
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
