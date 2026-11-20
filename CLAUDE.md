# Rave Groovebox — browser groovebox for rave improvisation (PWA)

A pocket-synth-style groovebox in the browser, in the spirit of the OP-1, Pocket Operators,
Elektron boxes and the M-VAVE FM1: synth engines, a synthesized drum kit, a step sequencer,
ready-made **rave loops** to jam over, **punch-in FX** for transitions, and (from v0.2) a **sampler**.
Pure Western rave: 12-TET only (acid, techno, house, breaks/jungle, trance, hardcore, electro, D&B).

Live site: https://alekozamayan.github.io/rave-groovebox/ (GitHub Pages, deployed by Actions)

## Start here (for Claude sessions)

- **`docs/STATUS.md`** is the session handoff log: current release, decisions, environment notes,
  roadmap. Read it first (`/resume`) and update it before you finish.
- Skills: `/resume`, `/verify`, `/release`, `/add-loop`. Run `/verify` before every push.

## Hard requirements

- **Equally good on phone, tablet and desktop.** Phone = one panel at a time (tabs), 8-step pages in
  portrait; large screens (≥1100×680) show sequencer, sound, keys and FX together.
- **Installable PWA on iPhone Safari**: manifest, apple-touch-icon, `apple-mobile-web-app-capable`,
  service worker (offline), safe-area insets, no pinch/double-tap zoom on play surfaces.
- **Releases are tested and deployed automatically** (see Release flow).
- **No copyrighted samples or loops.** Every sound is synthesized with Web Audio. Built-in sample kits
  must be rendered by the app itself; any external sample must be CC0/CC-BY with its license in
  `public/samples/LICENSES.md`. Loops are original patterns written as data.

## Stack

- Vite + TypeScript (strict), plain DOM (`src/ui/dom.ts` `h()` helper). No UI framework.
- Web Audio API directly. AudioWorklet is allowed where native nodes can't do the job (reverse,
  sample-rate reduction, sampler recording) — keep a native fallback where practical.
- Vitest (logic), Playwright (chromium + webkit + iPhone profile). ESLint + Prettier.
- `vite.config.ts` sets `base: '/rave-groovebox/'`. PWA via `vite-plugin-pwa`.
- Scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:e2e`, `check`.

## Audio rules

- Create/resume the `AudioContext` only inside a user gesture ("Tap to start" overlay);
  `navigator.audioSession.type = 'playback'` when available; `latencyHint: 'interactive'`.
- All timing goes through the look-ahead `Clock` (`src/audio/clock.ts`) on `audioContext.currentTime`.
  Never schedule sound with raw `setTimeout` (UI updates may use it).
- Punch-in FX that change rhythm (repeat, gate, tape stop) start on the next 16th while playing.
- Keep the master under 0 dBFS: master gain → glue compressor → limiter → output trim.
  If you add loud sounds, re-check peaks (see STATUS "Level check").
- Web MIDI is a desktop bonus (absent on iOS); feature-detect it.

## Architecture

| Area                                                                                                           | Files                                                   |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Notes, chords, pattern model + notation, loop library, FX table, FM algorithms, sound params, key map, strings | `src/data/*.ts`                                         |
| Clock (look-ahead + swing), step → events (probability, ratchet, slide), engine wiring                         | `src/audio/clock.ts`, `events.ts`, `engine.ts`          |
| Synth engines (acid mono, FM 4-op, supersaw) / drum kit / FX chain / FX math                                   | `src/audio/synths.ts`, `drums.ts`, `fx.ts`, `fxmath.ts` |
| App wiring, keyboard, pads                                                                                     | `src/app.ts`, `src/ui/*.ts`                             |
| Persistence (`groovebox.settings.v1`, validated by `sanitize`)                                                 | `src/state.ts`                                          |

Music data stays in `src/data/` as typed, tested tables, separate from audio code.

## Release flow (CI/CD)

- `.github/workflows/ci.yml`: on push/PR — npm ci, typecheck, lint, unit, build, Playwright e2e.
- `.github/workflows/deploy.yml`: on tags `v*.*.*` (and manual) — full tests, then build and deploy to
  GitHub Pages. Pages source must be "GitHub Actions".
- Release: `npm version patch|minor|major && git push --follow-tags` (only via `/release`).

## Conventions

- Branch + PR to `main`; CI green before merge.
- UI strings live in `src/data/i18n.ts` (English now; other languages = same keys).
- Show the app version (from package.json) in a corner.
