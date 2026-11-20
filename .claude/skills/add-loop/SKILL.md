---
name: add-loop
description: Add or tune a rave loop preset (drum/synth lines, tempo, swing, sound overrides) in Rave Groovebox. Use when the user asks for a new loop or genre, or says a loop sounds wrong.
---

Loops live in `src/data/loops.ts` (`LOOPS`), written in the notation documented in `src/data/pattern.ts`:

- Drums: one char per 16th: `.` rest, `x` hit, `X` accent, `?` 50% chance, `2`–`4` ratchet.
- Synths: one token per 16th: `-` rest, `C2`, `C2!` accent, `C2~` slide/tie to the next note.

Steps:

1. Write original patterns only (no transcriptions of copyrighted tracks). Lines are 16 steps
   (repeated) or the full pattern `length` (16/32).
2. Keep bass in MIDI 21–60 and lead in 40–96. Never put a closed hat on an open-hat step (it chokes).
3. Pick `bpm`, `swing` (50 straight … 75) and `sound` overrides (engine, cutoff, chord…).
4. Add the genre to `GENRES` if new. `tests/unit/loops.test.ts` checks every preset automatically.
5. Listen with the level check from `/verify` (peaks < 1.0), then run `/verify`.
