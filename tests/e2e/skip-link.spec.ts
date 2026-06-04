import { test, expect } from '@playwright/test';

test.describe('Keyboard accessibility', () => {
  test('Skip to content link is focusable after unlock', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Unlock the app first
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for the modal to disappear and the main screen to render
    await expect(page.getByText('Unlock Wyvern Drive')).not.toBeVisible();
    await expect(page.getByText('Wyvern Drive')).toBeVisible();

    // Focus the page body, press Tab
    await page.focus('body');
    await page.keyboard.press('Tab');

    // The focused element should be the Skip to content link
    const focusedText = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedText?.trim()).toBe('Skip to content');

    // It should become visible on focus (not-sr-only class applied)
    const skipLink = page.getByRole('link', { name: 'Skip to content' });
    await expect(skipLink).toBeFocused();
    
    // Pressing Enter should move focus to the main content element (#main-content)
    await page.keyboard.press('Enter');
    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBe('main-content');
  });
});
