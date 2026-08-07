import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('loads presentation from a render-blocking stylesheet', async ({ page }) => {
  await page.goto('/');

  const stylesheet = page.locator('head > link[rel="stylesheet"][href="/src/styles.css"]');
  await expect(stylesheet).toHaveCount(1);
  await expect(page.locator('.hero')).toHaveCSS('background-color', 'rgb(40, 44, 52)');
});

test('compares a sprint time using only bundled data', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByLabel('Event')).toBeVisible();

  await page.getByLabel('Event').selectOption('100 metres');
  await expect(page.getByRole('spinbutton', { name: 'Seconds' })).not.toBeVisible();
  await page.getByLabel('Category').selectOption('women');
  const secondsWheel = page.getByRole('spinbutton', { name: 'Seconds' });
  await expect(secondsWheel).toBeVisible();
  for (let second = 0; second < 12; second += 1) await secondsWheel.press('ArrowDown');
  await expect(secondsWheel).toHaveAttribute('aria-valuenow', '12');
  await page.getByRole('button', { name: 'compare', exact: true }).click();

  await expect(page.locator('#results')).toBeVisible();
  await expect(page.getByLabel('Event')).not.toBeVisible();
  await expect(page.locator('#results-title')).toContainText(/faster than|does not beat/);
  await expect(page.locator('#results-detail')).toContainText('12.00');
  const changeTimeButton = page.getByRole('button', { name: 'Change time' });
  await expect(changeTimeButton).toBeInViewport();

  if (testInfo.project.name === 'mobile-chrome') {
    const mapOverflows = await page
      .locator('.map-card')
      .evaluate((map) => map.scrollWidth > map.clientWidth + 1);
    const changeTimeBox = await changeTimeButton.boundingBox();
    const mapBox = await page.locator('.map-card').boundingBox();
    expect(mapOverflows).toBe(false);
    expect(changeTimeBox?.y).toBeLessThan(100);
    expect((changeTimeBox?.y ?? 0) + (changeTimeBox?.height ?? 0)).toBeLessThanOrEqual(
      mapBox?.y ?? 0,
    );
  }

  const returnToTopButton = page.getByRole('button', { name: 'Return to the top of the results' });
  await expect(returnToTopButton).not.toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(returnToTopButton).toBeInViewport();
  await returnToTopButton.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(returnToTopButton).not.toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('button', { name: 'Change time' }).click();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('spinbutton', { name: 'Seconds' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('rebuilds the picker when the browser restores native selections', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    const eventSelect = document.querySelector<HTMLSelectElement>('#event-select');
    const genderSelect = document.querySelector<HTMLSelectElement>('#gender-select');
    if (!eventSelect || !genderSelect) throw new Error('Comparison selects are missing.');

    eventSelect.value = '1500 metres';
    genderSelect.value = 'men';
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
  });

  await expect(page.getByRole('spinbutton', { name: 'Minutes' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Seconds' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Hundredths' })).toBeVisible();
});

test('allows one leftmost value beyond the slowest category record', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Event').selectOption('100 metres');
  await page.getByLabel('Category').selectOption('women');

  const secondsWheel = page.getByRole('spinbutton', { name: 'Seconds' });
  await expect(secondsWheel).toHaveAttribute('aria-valuemax', '15');
  await secondsWheel.press('End');
  await expect(secondsWheel).toHaveAttribute('aria-valuenow', '15');

  await page.getByLabel('Event').selectOption('800 metres');
  await page.getByLabel('Category').selectOption('men');

  const minutesWheel = page.getByRole('spinbutton', { name: 'Minutes' });
  await expect(minutesWheel).toHaveAttribute('aria-valuemax', '3');
  await minutesWheel.press('End');
  await expect(minutesWheel).toHaveAttribute('aria-valuenow', '3');
});

test('has no serious accessibility violations or horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished)),
  );

  const results = await new AxeBuilder({ page }).analyze();
  const seriousViolations = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  );

  expect(seriousViolations).toEqual([]);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
