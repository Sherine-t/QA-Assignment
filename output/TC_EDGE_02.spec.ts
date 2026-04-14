import { test, expect } from '@playwright/test';

test('TC_EDGE_02', async ({ page }) => {
  await page.goto('/registration');
  await page.fill('input[name="email"]', 'test3@example.com');
  await page.fill('input[name="password"]', 'Test123');
  await page.fill('input[name="fullname"]', 'Michael');
  await Promise.all([
    page.check('input[name="terms"]'),
    page.waitForNavigation(),
    page.click('text=Create Account')
  ]);
  expect(page.locator('text=Error message displayed')).not.toBe(null);
});