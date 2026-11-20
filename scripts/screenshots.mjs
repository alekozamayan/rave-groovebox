// Visual check of the built app: iPhone landscape, desktop light and desktop dark.
// Usage: npx vite preview --port 4173 &  then  node scripts/screenshots.mjs <out-dir> [baseUrl]
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'screenshots';
const base = process.argv[3] ?? 'http://localhost:4173/rave-groovebox/';
mkdirSync(out, { recursive: true });

// The iPhone profile is emulated on Chromium so this works where WebKit isn't installed.
const iphone = { ...devices['iPhone 15 landscape'] };
delete iphone.defaultBrowserType;
const shots = [
  ['iphone', iphone],
  ['desktop', { viewport: { width: 1280, height: 720 } }],
  ['desktop-dark', { viewport: { width: 1280, height: 720 }, colorScheme: 'dark' }],
];

const browser = await chromium.launch();
for (const [name, opts] of shots) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${name}] page error: ${e.message}`));
  await page.goto(base);
  await page.getByTestId('start-overlay').click();
  await page.waitForTimeout(300);
  const audio = await page.evaluate(() => document.body.dataset.audio);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`${name}: audio=${audio} -> ${out}/${name}.png`);
  await ctx.close();
}
await browser.close();
