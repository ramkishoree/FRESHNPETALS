import { expect, test } from '@playwright/test';

/**
 * Ch.17 Part 4 (§72) Authentication Journey + Ch.8 §92/Ch.6 IA route
 * guards. Full authenticated journeys (login -> checkout -> payment)
 * need a live Supabase project with seeded users, which this sandbox
 * doesn't have — what's genuinely verifiable here, and what regressions
 * would actually be caught by, is that every gated route redirects a
 * guest to sign in rather than exposing the page or erroring.
 */

/**
 * The auth form is magic-link-first by the owner's explicit call (see
 * auth-form.tsx): email + a link is the default for both signing in and
 * creating an account, and the password field only exists after opting
 * into it. These specs previously asserted a password-first form that
 * hasn't shipped for some time, so they failed against the real page
 * rather than catching anything.
 */
test.describe('Login and signup forms render', () => {
  test('login form defaults to the email link, and reveals a password field on request', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with email/i })).toBeVisible();

    // Password stays available for anyone who set one up before the
    // magic-link default landed.
    await expect(page.getByLabel('Password')).toBeHidden();
    await page.getByRole('button', { name: /use a password instead/i }).click();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
  });

  test('signup form collects a name and creates an account', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByLabel('Full name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with email/i })).toBeVisible();

    await page.getByRole('button', { name: /use a password instead/i }).click();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });
});

test.describe('Guest redirect gates', () => {
  test('checkout redirects an unauthenticated visitor to login', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/login/);
  });

  test('account redirects an unauthenticated visitor to login', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin redirects an unauthenticated visitor to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin products redirects an unauthenticated visitor to login', async ({ page }) => {
    await page.goto('/admin/products');
    await expect(page).toHaveURL(/\/login/);
  });
});
