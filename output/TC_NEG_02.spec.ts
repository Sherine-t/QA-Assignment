import { test, expect } from '@playwright/test';

test('TC_NEG_02', async ({ page }) => {
  await page.goto('/registration');
  await page.fill('input[name="password"]', 'Test123');
  await page.fill('input[name="fullname"]', 'Alex');
  await Promise.all([
    page.waitForNavigation(),
    page.click('text=Create Account')
  ]);
  expect(page.locator('text=Error message displayed')).not.toBe(null);
});