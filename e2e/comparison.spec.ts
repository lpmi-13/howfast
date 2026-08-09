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
  await expect(page.locator('.map-country:not(.map-country-faster)').first()).toHaveCSS(
    'fill',
    'rgb(48, 50, 56)',
  );
  await expect(page.locator('.map-country-faster').first()).toHaveCSS('fill', 'rgb(42, 166, 165)');
  await expect(page.locator('.map-country').first()).toHaveCSS('stroke', 'rgb(255, 230, 109)');
  await expect(page.locator('.map-country-faster').first()).toHaveCSS('stroke-width', '1.25px');
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
    const resultsHeaderBox = await page.locator('.results-header').boundingBox();
    const mapBox = await page.locator('.map-card').boundingBox();
    expect(mapOverflows).toBe(false);
    expect(changeTimeBox?.y).toBeLessThan(100);
    expect(resultsHeaderBox?.y).toBeLessThan(mapBox?.y ?? 0);
    expect((changeTimeBox?.y ?? 0) + (changeTimeBox?.height ?? 0)).toBeLessThanOrEqual(
      mapBox?.y ?? 0,
    );
  }

  const returnToTopButton = page.getByRole('button', { name: 'Return to the top of the results' });
  const scrollResultsToBottom = async () => {
    if (testInfo.project.name === 'desktop-chrome') {
      await page
        .locator('#country-panel')
        .evaluate((panel) => panel.scrollTo(0, panel.scrollHeight));
    } else {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }
  };
  const resultScrollOffset = () =>
    testInfo.project.name === 'desktop-chrome'
      ? page.locator('#country-panel').evaluate((panel) => panel.scrollTop)
      : page.evaluate(() => window.scrollY);
  await expect(returnToTopButton).not.toBeVisible();

  await scrollResultsToBottom();
  await expect(returnToTopButton).toBeInViewport();
  await returnToTopButton.click();
  await expect.poll(resultScrollOffset).toBe(0);
  await expect(returnToTopButton).not.toBeVisible();
  await expect(resultsTitle).toBeFocused();

  await scrollResultsToBottom();
  await page.getByRole('button', { name: 'Change time' }).click();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.locator('#country-panel').evaluate((panel) => panel.scrollTop)).toBe(0);
  await expect(page.getByRole('spinbutton', { name: 'Seconds' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('links dispersed map markers to focused country navigation', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('Event').selectOption('1500 metres');
  await page.getByLabel('Category').selectOption('men');

  const minutes = page.getByRole('spinbutton', { name: 'Minutes' });
  const seconds = page.getByRole('spinbutton', { name: 'Seconds' });
  for (let minute = 0; minute < 4; minute += 1) await minutes.press('ArrowDown');
  for (let second = 0; second < 4; second += 1) await seconds.press('ArrowDown');
  await page.getByRole('button', { name: 'compare', exact: true }).click();

  await expect(page.locator('.map-country-faster')).toHaveCount(4);
  await expect(page.locator('#world-map')).toHaveAttribute('viewBox', '0 0 1000 500');
  await expect(page.locator('.map-result-marker')).toHaveCount(4);
  if (testInfo.project.name === 'desktop-chrome') {
    const markerBox = await page.locator('.map-result-marker-badge').first().boundingBox();
    const panelBox = await page.locator('.country-panel').boundingBox();
    expect(markerBox?.width).toBeLessThan(40);
    expect(panelBox?.y).toBeGreaterThanOrEqual(0);
    expect((panelBox?.y ?? 0) + (panelBox?.height ?? 0)).toBeLessThanOrEqual(
      page.viewportSize()?.height ?? 0,
    );
  }
  expect(await page.locator('.map-result-marker-label').allTextContents()).toEqual([
    '1',
    '2',
    '3',
    '4',
  ]);
  expect(await page.locator('.country-result-number').allTextContents()).toEqual([
    '1',
    '2',
    '3',
    '4',
  ]);
  await expect(page.locator('#map-overview-status')).toHaveText('4 countries shown');

  await page.getByRole('button', { name: 'Show Laos on map' }).click();
  await expect(page.locator('#map-focus-status')).toHaveText('1 of 4: Laos');
  await expect(page.locator('#results')).toHaveClass(/exploring-countries/);
  await expect(page.locator('.results-header')).toBeHidden();
  await expect(page.locator('[data-country="Laos"]')).toHaveClass(/map-country-focused/);
  await expect(page.locator('#world-map')).toHaveClass(/map-view-focused/);
  const focusedWidth = Number(
    ((await page.locator('#world-map').getAttribute('viewBox')) ?? '').split(' ')[2],
  );
  expect(focusedWidth).toBeLessThan(500);

  const mapPositionBeforeListScroll = await page.locator('#map-panel').boundingBox();
  await page
    .locator('#country-panel')
    .evaluate((panel) => panel.scrollTo({ top: panel.scrollHeight, behavior: 'instant' }));
  const mapPositionAfterListScroll = await page.locator('#map-panel').boundingBox();
  expect(mapPositionAfterListScroll?.y).toBe(mapPositionBeforeListScroll?.y);
  await expect(page.locator('#map-next')).toBeInViewport();

  if (testInfo.project.name === 'mobile-chrome') {
    const previousBox = await page.locator('#map-previous').boundingBox();
    const statusBox = await page.locator('#map-focus-status').boundingBox();
    expect(previousBox?.width).toBeGreaterThanOrEqual(52);
    expect(
      Math.abs(
        (previousBox?.y ?? 0) +
          (previousBox?.height ?? 0) / 2 -
          ((statusBox?.y ?? 0) + (statusBox?.height ?? 0) / 2),
      ),
    ).toBeLessThanOrEqual(1);
  }

  await expect(page.locator('#map-previous')).toHaveAttribute(
    'aria-label',
    'Show American Samoa on map',
  );
  await page.locator('#map-previous').click();
  await expect(page.locator('#map-focus-status')).toHaveText('4 of 4: American Samoa');
  const focusedResult = page.locator('.country-result-focused');
  await expect(focusedResult).toBeInViewport();
  const focusedResultBox = await focusedResult.boundingBox();
  expect(focusedResultBox?.y).toBeGreaterThanOrEqual(0);
  expect((focusedResultBox?.y ?? 0) + (focusedResultBox?.height ?? 0)).toBeLessThanOrEqual(
    page.viewportSize()?.height ?? 0,
  );

  await page.locator('#map-next').click();
  await expect(page.locator('#map-focus-status')).toHaveText('1 of 4: Laos');

  await expect(page.locator('#map-next')).toHaveAttribute('aria-label', 'Show Bhutan on map');
  await page.locator('#map-next').click();
  await expect(page.locator('#map-focus-status')).toHaveText('2 of 4: Bhutan');
  await expect(page.getByRole('button', { name: 'Show Bhutan on map' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: 'View all' }).click();
  await expect(page.locator('#world-map')).toHaveAttribute('viewBox', '0 0 1000 500');
  await expect(page.locator('#world-map')).not.toHaveClass(/map-view-focused/);
  await expect(page.locator('#map-overview-status')).toHaveText('4 countries shown');
});

test('opens a single result in a focused regional map', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('Event').selectOption('1500 metres');
  await page.getByLabel('Category').selectOption('men');

  const minutes = page.getByRole('spinbutton', { name: 'Minutes' });
  const seconds = page.getByRole('spinbutton', { name: 'Seconds' });
  for (let minute = 0; minute < 4; minute += 1) await minutes.press('ArrowDown');
  for (let second = 0; second < 19; second += 1) await seconds.press('ArrowDown');
  await page.getByRole('button', { name: 'compare', exact: true }).click();

  await expect(page.getByRole('heading', { level: 1 })).toContainText('faster than 1 country');
  await expect(page.locator('#map-focus-status')).toHaveText('1 of 1: American Samoa');
  await expect(page.locator('#map-previous')).toBeDisabled();
  await expect(page.locator('#map-next')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Show American Samoa on map' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const focusedWidth = Number(
    ((await page.locator('#world-map').getAttribute('viewBox')) ?? '').split(' ')[2],
  );
  expect(focusedWidth).toBeLessThan(500);
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

test('allows one leftmost value beyond double the slowest category record', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Event').selectOption('100 metres');
  await page.getByLabel('Category').selectOption('women');

  const secondsWheel = page.getByRole('spinbutton', { name: 'Seconds' });
  await expect(secondsWheel).toHaveAttribute('aria-valuemax', '29');
  await secondsWheel.press('End');
  await expect(secondsWheel).toHaveAttribute('aria-valuenow', '29');

  await page.getByLabel('Event').selectOption('200 metres');

  const sprintMinutesWheel = page.getByRole('spinbutton', { name: 'Minutes' });
  await expect(sprintMinutesWheel).toHaveAttribute('aria-valuemax', '2');
  await expect(page.getByRole('spinbutton', { name: 'Seconds' })).toHaveAttribute(
    'aria-valuemax',
    '59',
  );
  await sprintMinutesWheel.press('End');
  await expect(page.getByRole('button', { name: 'compare', exact: true })).toBeEnabled();

  await page.getByLabel('Event').selectOption('800 metres');
  await page.getByLabel('Category').selectOption('men');

  const minutesWheel = page.getByRole('spinbutton', { name: 'Minutes' });
  await expect(minutesWheel).toHaveAttribute('aria-valuemax', '5');
  await minutesWheel.press('End');
  await expect(minutesWheel).toHaveAttribute('aria-valuenow', '5');

  await page.getByLabel('Event').selectOption('1500 metres');

  const longerMinutesWheel = page.getByRole('spinbutton', { name: 'Minutes' });
  await expect(longerMinutesWheel).toHaveAttribute('aria-valuemax', '9');
  await longerMinutesWheel.press('End');
  await expect(longerMinutesWheel).toHaveAttribute('aria-valuenow', '9');

  await page.getByLabel('Event').selectOption('10,000 metres');
  await page.getByLabel('Category').selectOption('women');

  await expect(page.getByRole('spinbutton', { name: 'Hours' })).toHaveAttribute(
    'aria-valuemax',
    '2',
  );
  await expect(page.getByRole('spinbutton', { name: 'Minutes' })).toHaveAttribute(
    'aria-valuemax',
    '59',
  );
  await expect(page.getByRole('spinbutton', { name: 'Seconds' })).toHaveAttribute(
    'aria-valuemax',
    '59',
  );
  await expect(page.getByRole('spinbutton', { name: 'Hundredths' })).toHaveAttribute(
    'aria-valuemax',
    '99',
  );
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
