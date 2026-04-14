import { test, expect } from '@playwright/test';

test('TC_POS_01', async ({ page }) => {
  await page.goto('/registration');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'Test123');
  await page.fill('input[name="fullname"]', 'John Doe');
  await Promise.all([
    page.waitForNavigation(),
    page.click('text=Create Account')
  ]);
  expect(page.url()).toBe('https://example.com/home');
});