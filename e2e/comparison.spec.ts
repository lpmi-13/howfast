import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('loads presentation from a render-blocking stylesheet', async ({ page }) => {
  await page.goto('/');

  const stylesheet = page.locator('head > link[rel="stylesheet"][href="/src/styles.css"]');
  await expect(stylesheet).toHaveCount(1);
  await expect(page.locator('.hero')).toHaveCSS('background-color', 'rgb(40, 44, 52)');
});

test('exposes complete social preview metadata', async ({ page }) => {
  await page.goto('/');

  const productionUrl = 'https://howfastami.netlify.app/';
  const previewUrl = `${productionUrl}social-preview.png`;
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', productionUrl);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', previewUrl);
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute(
    'content',
    'image/png',
  );
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', /.+/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', previewUrl);
  await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute('content', /.+/);

  const dimensions = await page.evaluate(
    () =>
      new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('Social preview image failed to load.'));
        image.src = '/social-preview.png';
      }),
  );
  expect(dimensions).toEqual({ width: 1200, height: 630 });
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
  const compareButton = page.getByRole('button', { name: 'compare', exact: true });
  const timeEntryBox = await page.locator('#time-entry').boundingBox();
  const compareButtonBox = await compareButton.boundingBox();
  expect(compareButtonBox?.y).toBeGreaterThanOrEqual(
    (timeEntryBox?.y ?? 0) + (timeEntryBox?.height ?? 0),
  );
  await compareButton.click();

  await expect(page.locator('#results')).toBeVisible();
  await expect(page.getByLabel('Event')).not.toBeVisible();
  const resultsTitle = page.getByRole('heading', { level: 1 });
  await expect(resultsTitle).toContainText(/faster than|does not beat/);
  await expect(resultsTitle).toBeFocused();
  await expect(page.locator('#results-detail')).toContainText('12.00');
  const changeTimeButton = page.getByRole('button', { name: 'Change time' });
  await expect(changeTimeButton).toBeInViewport();
  expect(
    await page.evaluate(() => {
      const button = document.querySelector('#edit-time');
      const list = document.querySelector('#country-list');
      return Boolean(
        button &&
          list &&
          (button.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      );
    }),
  ).toBe(true);

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
  await expect(resultsTitle).toBeFocused();

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

  await expect(page.locator('.skip-link')).toHaveAttribute('href', '#main-content');
  await expect(page.locator('#main-content')).toHaveAttribute('tabindex', '-1');

  const eventSelect = page.getByLabel('Event');
  await eventSelect.focus();
  await expect(eventSelect).toHaveCSS('outline-style', 'solid');
  await eventSelect.selectOption('100 metres');
  await page.getByLabel('Category').selectOption('women');
  const secondsWheel = page.getByRole('spinbutton', { name: 'Seconds' });
  await secondsWheel.focus();
  await expect(secondsWheel.locator('..')).toHaveCSS('outline-style', 'solid');

  for (let second = 0; second < 12; second += 1) await secondsWheel.press('ArrowDown');
  await page.getByRole('button', { name: 'compare', exact: true }).click();
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished)),
  );
  const resultsAudit = await new AxeBuilder({ page }).analyze();
  expect(resultsAudit.violations).toEqual([]);
});

test('honours reduced-motion preferences', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const animationDuration = await page
    .locator('.hero-copy')
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration) * 1000);
  expect(animationDuration).toBeLessThanOrEqual(1);

  await page.getByLabel('Event').selectOption('100 metres');
  await page.getByLabel('Category').selectOption('women');
  const pickerAnimationDuration = await page
    .locator('#time-entry')
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration) * 1000);
  expect(pickerAnimationDuration).toBeLessThanOrEqual(1);
});
