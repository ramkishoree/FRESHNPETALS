import { expect, test } from '@playwright/test';

/**
 * Ch.17 Part 4 (§72) Authentication Journey + Ch.8 §92/Ch.6 IA route
 * guards. Full authenticated journeys (login -> checkout -> payment)
 * need a live Supabase project with seeded users, which this sandbox
 * doesn't have — what's genuinely verifiable here, and what regressions
 * would actually be caught by, is that every gated route redirects a
 * guest to sign in rather than exposing the page or erroring.
 */

test.describe('Login and signup forms render', () => {
  test('login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('signup form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('button', { name: /create account|sign up/i })).toBeVisible();
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

  test('admin blogs redirects an unauthenticated visitor to login', async ({ page }) => {
    await page.goto('/admin/blogs');
    await expect(page).toHaveURL(/\/login/);
  });
});
