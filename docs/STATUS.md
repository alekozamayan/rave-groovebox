# Rave Groovebox: status and session handoff

Read this first (`/resume`). Update it at the end of every session.

## Current state (2026-11-20)

- **v0.1.0 tag exists, but its deploy failed:** the iPhone e2e test "play … playhead" caught late
  playhead updates after Stop. That's fixed in **0.1.1** (engine `runId` drops queued UI step callbacks
  after Stop). `main` exists (created from the first commit). The user releases from a phone via
  **Releases → Draft a new release → new tag on publish, target `main`**.
- GitHub setup done by the user: Pages source = GitHub Actions, and a `v*.*.*` tag rule on `github-pages`.
- Spun off from the kkey project (makam keyboard). Copied from it: the PWA setup, audio unlock,
  look-ahead clock pattern, multi-touch keyboard, CI/deploy workflows and the screenshot/icon scripts.
- Tests: 99 unit tests and 9 e2e specs. Chromium passes locally; webkit and iphone are left to CI.

## v0.1 feature set

- 8 lanes: kick, snare, clap, closed hat, open hat, ride, bass, lead. 16 or 32 steps.
- Per-step settings: accent, chance (100/75/50/25%), ratchet ×1–4, slide/tie (synth), note and cutoff lock (synth).
- Engines per synth lane: **Acid** (mono, 24 dB resonant filter, slide/accent), **FM** (4-op, 8 algorithms,
  ratio, index envelope), **Supersaw** (7 saws, or 4 per chord note). Chords on FM/Supersaw.
- Drums: synthesized 909/808 style. The closed hat chokes the open hat.
- 12 punch-in FX (`src/data/fx.ts`), hold to apply. Repeat, gate and tape stop snap to the next 16th.
- 10 rave loops plus an Empty preset. Switching loops while playing is queued to the next loop start.
- Live play: keyboard (2 octaves, glissando), drum pads, Rec (live recording quantized to the nearest
  16th, or step entry while stopped), QWERTY, Web MIDI (desktop only).

## Decisions

- **Tempo is quarter-note BPM.** Clock steps are 16ths. Swing is MPC-style percent (50–75).
- **Beat repeat / tape stop use one always-recording delay line ("looper").** Repeat closes its input
  and feeds back (loops the last slice). Tape stop bends the delay time along d(u)=u²/2T. Only one looper
  FX at a time; the last pressed wins.
- **Gate** is a square LFO on a gain, started on the grid (1/16 on, 1/16 off).
- **Slide = tie:** a slid synth step holds until the next on-step. On the acid engine it glides there
  without retriggering the envelopes.
- **Mix:** master gain = volume × 0.6 → glue compressor → limiter (−6 dB, hard knee) → ×0.85 output.
  **Level check (2026-11-20):** every loop, engine and FX peaked at 0.52–0.75 with no NaN, and every
  mix recovered after FX release.
- Settings are saved in localStorage `groovebox.settings.v1` and validated by `sanitize()`.

## Environment notes

- Cloud sandbox: it can push only `claude/*` branches. Tag pushes get HTTP 403, so the user pushes
  release tags locally. WebKit isn't downloadable there, so e2e runs with `--project=chromium`.
  `@playwright/test` is pinned to 1.63.0 to match the preinstalled Chromium.
- The user often works from a phone: the GitHub app can't create tags. Use the browser's Releases page
  (a release publishes its tag, and that triggers `deploy.yml`). A draft release creates no tag.
- Check that the default branch is `main` (it started as the first pushed `claude/*` branch).

## Roadmap

- **v0.2 Sampler:**
  - Sources: mic (getUserMedia), file import, resampling the master output, and built-in kits
    rendered by the app (OfflineAudioContext).
  - Slicing: onset detection, equal parts, or manual.
  - Per-slice pitch, reverse, loop and envelope.
  - A sampler lane in the sequencer; recordings stored in IndexedDB.
  - An AudioWorklet recorder, which also unlocks a "Reverse" punch-in FX.
- **v0.3:**
  - Pattern banks / scenes with quantized switching; song chaining.
  - Overdub looper.
  - WAV export of a jam.
  - Per-step locks for more parameters.
- Maybe: MIDI clock in/out, CC mapping for knobs, more drum kits (808 / breakbeat), a level meter.
