import { test, expect } from '@playwright/test';

test('TC_EDGE_01', async ({ page }) => {
  await page.goto('/registration');
  await page.fill('input[name="email"]', 'maxcharacterlimit@example.com');
  await page.fill('input[name="password"]', 'MaxCharacter1234567890');
  await page.fill('input[name="fullname"]', 'Lorem Ipsum');
  await Promise.all([
    page.waitForNavigation(),
    page.click('text=Create Account')
  ]);
  expect(page.url()).toBe('https://example.com/home');
});