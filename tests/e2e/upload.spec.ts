import { test, expect } from '@playwright/test';

test.describe('File upload flow', () => {
  test('drop zone is visible after unlock', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      localStorage.setItem('wyvern-unlocked', 'true');
    });
    await page.reload();

    await expect(page.getByText(/drop|upload/i).first()).toBeVisible();
  });
});
