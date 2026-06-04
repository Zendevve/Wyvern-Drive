import { test, expect } from '@playwright/test';

test.describe('Share link page', () => {
  test('shows error for invalid share link', async ({ page }) => {
    await page.goto('/share/invalid');
    await expect(page.getByText('Error')).toBeVisible();
  });
});
