# Rave Groovebox

A browser groovebox for rave improvisation, installable as a PWA on iPhone, Android and desktop.

- **Synths:** 303-style acid bass (with slide and accent), a 4-operator FM engine (8 algorithms),
  and a supersaw/hoover with chord stabs.
- **Drums:** synthesized 909/808-style kick, snare, clap, closed and open hats, and ride.
- **Sequencer:** 8 lanes × 16 or 32 steps. Each step has its own accent, chance, ratchet, slide and
  cutoff lock. Global swing and tap tempo.
- **Rave loops:** 10 original, synthesized starting points (acid, techno, house, jungle, D&B, trance,
  hardcore, electro). Switching loops while playing waits for the next loop start.
- **Punch-in FX** (hold to apply): LP/HP sweep, kill bass, bitcrush, beat repeat 1/4–1/32,
  trance gate, delay throw, tape stop, riser.
- **Play live:** multi-touch keyboard and drum pads, live or step recording, QWERTY keys, and Web MIDI
  on desktop.

Live: https://alekozamayan.github.io/rave-groovebox/

## Desktop keys

| Keys                          | Action                      |
| ----------------------------- | --------------------------- |
| Space                         | Play / stop                 |
| `a w s e d f t g y h u j k …` | Notes (selected synth lane) |
| `[` `]`                       | Octave down / up            |
| `z x c v b n`                 | Drum pads                   |
| `1 2 3 4 5 6 7 8 9 0 - =`     | Punch-in FX (hold)          |

## Develop

```sh
npm ci
npm run dev        # http://localhost:5173/rave-groovebox/
npm run check      # typecheck + lint + unit tests
npm run test:e2e   # Playwright (builds first)
```
