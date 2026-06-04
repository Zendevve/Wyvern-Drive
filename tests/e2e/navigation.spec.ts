import { test, expect } from '@playwright/test';

test.describe('App loads', () => {
  test('shows password modal on first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Unlock Wyvern Drive')).toBeVisible();
    await expect(page.getByPlaceholder('Encryption password')).toBeVisible();
  });

  test('has correct page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Wyvern Drive');
  });

  test('password input has correct type', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder('Encryption password');
    await expect(input).toHaveAttribute('type', 'password');
  });
});
