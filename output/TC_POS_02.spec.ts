import { test, expect } from '@playwright/test';

test('TC_POS_02', async ({ page }) => {
  await page.goto('/registration');
  await page.fill('input[name="email"]', 'test2@example.com');
  await page.fill('input[name="password"]', 'Test123');
  await page.fill('input[name="fullname"]', 'Jane Smith');
  await page.fill('input[name="phone"]', '123-456-7890');
  await page.fill('input[name="address"]', '123 Main St');
  await Promise.all([
    page.waitForNavigation(),
    page.click('text=Create Account')
  ]);
  expect(page.url()).toBe('https://example.com/home');
});