---
name: verify
description: Run Rave Groovebox's full local quality gate (typecheck, lint, unit tests, build, Playwright e2e, layout screenshots, level check). Use before pushing, before opening or updating a PR, or when asked to "test everything".
---

Needs Node 22+ and `npm ci`.

1. `npm run check`: typecheck + ESLint + Vitest. All must pass.
2. `npm run build`: `dist/manifest.webmanifest`, `dist/sw.js`, `dist/icons/*.png` must exist.
3. E2E: `npm run test:e2e`. In the cloud sandbox WebKit can't be downloaded: run
   `npx playwright test --project=chromium` and say webkit/iphone run in CI.
4. UI changes: start `npx vite preview --port 4173`, run `node scripts/screenshots.mjs <scratch-dir>`,
   and look at the iphone shot. Nothing clipped, no horizontal scroll, all panels usable.
5. Audio changes (engines, drums, FX, mix): measure peaks with an analyser on the output for every loop
   and FX (see STATUS "Level check"). Peaks must stay below 1.0 and no FX may leave the mix silent after release.
6. `npx prettier --check .`; format only files you changed.
7. Report each step: passed, failed (with output) or skipped (with reason). Never call a skipped step green.
