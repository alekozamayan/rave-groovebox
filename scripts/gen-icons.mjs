// Renders public/icons/icon.svg into the PNG sizes the PWA manifest and iOS need.
// Usage: node scripts/gen-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0, bg: 'transparent' },
  { file: 'icon-512.png', size: 512, pad: 0, bg: 'transparent' },
  { file: 'apple-touch-icon.png', size: 180, pad: 0, bg: '#0d0d12' },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.1, bg: '#0d0d12' },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, pad, bg } of targets) {
  const inner = Math.round(size * (1 - pad * 2));
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: bg === 'transparent' });
  console.log('wrote', file);
}
await browser.close();
