import { expect, test, type Page } from '@playwright/test';
import pkg from '../../package.json' with { type: 'json' };

const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', (e) => list.push(e.message));
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

async function start(page: Page) {
  await page.goto('./');
  const overlay = page.getByTestId('start-overlay');
  await expect(overlay).toBeVisible();
  await overlay.click();
  await expect(overlay).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-audio', 'running', { timeout: 10_000 });
}

/** Phones show one panel at a time; large screens show all of them. */
async function openTab(page: Page, tab: 'seq' | 'sound' | 'keys' | 'fx') {
  const btn = page.getByTestId(`tab-${tab}`);
  if (await btn.isVisible()) await btn.click();
}

test('loads with PWA metadata and version', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/Groovebox/);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    /manifest\.webmanifest/,
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes',
  );
  await expect(page.getByTestId('version')).toHaveText(`v${pkg.version}`);
  await expect(page.getByTestId('start-overlay')).toContainText('Tap to start');

  const res = await page.request.get('manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.start_url).toBe('/rave-groovebox/');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  expect((await page.request.get('icons/apple-touch-icon.png')).ok()).toBe(true);
  expect((await page.request.get('sw.js')).ok()).toBe(true);
});

test('play runs the sequencer and moves the playhead', async ({ page }) => {
  await start(page);
  await page.getByTestId('play').click();
  await expect(page.locator('body')).toHaveAttribute('data-playing', 'true');
  await expect(page.getByTestId('play')).toHaveText('Stop');
  await expect(page.locator('.cell.play').first()).toBeVisible({ timeout: 5_000 });
  await page.getByTestId('play').click();
  await expect(page.locator('body')).toHaveAttribute('data-playing', 'false');
  await expect(page.locator('.cell.play')).toHaveCount(0);
});

test('steps toggle and the inspector edits notes', async ({ page }) => {
  await start(page);
  const kickRow = page.locator('.lane[data-track="kick"] .cell');
  const cell = kickRow.nth(1);
  await expect(cell).not.toHaveClass(/\bon\b/);
  await cell.click();
  await expect(cell).toHaveClass(/\bon\b/);
  await cell.click();
  await expect(cell).not.toHaveClass(/\bon\b/);

  const bass = page.locator('.lane[data-track="bass"] .cell').nth(0);
  await bass.click(); // A1 on → off
  await bass.click(); // back on, selected
  const note = page.getByTestId('note');
  const before = await note.textContent();
  await page.getByTestId('note-up').click();
  await expect(note).not.toHaveText(before!);
  await expect(bass).toHaveText((await note.textContent())!);
});

test('settings persist across reloads', async ({ page }) => {
  await start(page);
  await page.locator('.lane[data-track="ride"] .cell').nth(2).click();
  await page.getByTestId('mute-kick').click();
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByTestId('start-overlay').click();
  await expect(page.locator('.lane[data-track="ride"] .cell').nth(2)).toHaveClass(/\bon\b/);
  await expect(page.getByTestId('mute-kick')).toHaveAttribute('aria-pressed', 'true');
});

test('loop presets load, and queue while playing', async ({ page }) => {
  await start(page);
  await page.getByTestId('loop').selectOption('jungle');
  await expect(page.getByTestId('bpm')).toHaveValue('170');
  await expect(page.locator('.lane[data-track="ride"] .cell.on').first()).toBeVisible();
  await page.getByTestId('play').click();
  await page.getByTestId('loop').selectOption('trance-gate');
  await expect(page.getByTestId('queued')).toBeVisible();
  await expect(page.getByTestId('queued')).toBeHidden({ timeout: 10_000 });
  await expect(page.getByTestId('length')).toHaveText(/32/);
});

test('punch-in FX pads hold while pressed', async ({ page }) => {
  await start(page);
  await page.getByTestId('play').click();
  await openTab(page, 'fx');
  for (const id of ['lpf', 'rep8', 'tape', 'gate', 'riser', 'crush']) {
    const pad = page.getByTestId(`pad-${id}`);
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(pad).toHaveClass(/down/);
    await page.waitForTimeout(150);
    await page.mouse.up();
    await expect(pad).not.toHaveClass(/down/);
  }
});

test('sound panel switches engines', async ({ page }) => {
  await start(page);
  await openTab(page, 'sound');
  await page.getByTestId('engine-fm').click();
  await expect(page.getByTestId('param-algo')).toBeVisible();
  await page.getByTestId('engine-saw').click();
  await expect(page.getByTestId('param-algo')).toHaveCount(0);
  await expect(page.getByTestId('param-chord')).toBeVisible();
});

test('keyboard plays and supports glissando', async ({ page }) => {
  await start(page);
  await openTab(page, 'keys');
  const key = page.locator('.key[data-offset="0"]');
  const box = (await key.boundingBox())!;
  const y = box.y + box.height * 0.85;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await expect(key).toHaveClass(/down/);
  const next = page.locator('.key[data-offset="2"]');
  const nb = (await next.boundingBox())!;
  await page.mouse.move(nb.x + nb.width / 2, y, { steps: 4 });
  await expect(next).toHaveClass(/down/);
  await page.mouse.up();
  await expect(next).not.toHaveClass(/down/);
});

test('layout fits the viewport without horizontal scroll', async ({ page }) => {
  await start(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByTestId('play')).toBeInViewport();
});
