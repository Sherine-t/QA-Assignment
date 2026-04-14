import { test, expect } from '@playwright/test';

test('TC_NEG_01', async ({ page }) => {
  await page.goto('/registration');
  await page.fill('input[name="email"]', 'invalidemail');
  await page.fill('input[name="password"]', 'Test123');
  await page.fill('input[name="fullname"]', 'Sarah');
  await Promise.all([
    page.waitForNavigation(),
    page.click('text=Create Account')
  ]);
  expect(page.locator('text=Error message displayed')).not.toBe(null);
});