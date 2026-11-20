import {
  DRUM_IDS,
  emptyPattern,
  fit,
  parseDrum,
  parseSynth,
  SYNTH_IDS,
  type DrumId,
  type Pattern,
  type PatternLength,
  type SynthTrackId,
} from './pattern';
import { defaultSound, type DrumParams, type Sound, type SynthParams } from './sounds';

export const GENRES = [
  'Acid',
  'Techno',
  'House',
  'Breaks',
  'Trance',
  'Hardcore',
  'Electro',
  'Drum & Bass',
  'Init',
] as const;
export type Genre = (typeof GENRES)[number];

/** A ready-made loop for jamming. Drum/synth lines use the notation in pattern.ts. */
export interface LoopPreset {
  id: string;
  name: string;
  genre: Genre;
  /** Quarter-note BPM. */
  bpm: number;
  /** MPC-style swing percent: 50 = straight, 66 = triplet feel, max 75. */
  swing: number;
  length: PatternLength;
  drums: Partial<Record<DrumId, string>>;
  synths: Partial<Record<SynthTrackId, string>>;
  sound?: {
    drums?: Partial<Record<DrumId, Partial<DrumParams>>>;
    synths?: Partial<Record<SynthTrackId, Partial<SynthParams>>>;
  };
}

const FOUR = 'x...x...x...x...';
const BACKBEAT = '....x.......x...';
const OFF_OH = '..x...x...x...x.';
const HATS_AROUND_OH = 'xx.xxx.xxx.xxx.x';

export const LOOPS: LoopPreset[] = [
  {
    id: 'acid-techno',
    name: 'Acid Techno',
    genre: 'Acid',
    bpm: 132,
    swing: 50,
    length: 16,
    drums: { kick: 'X...x...X...x...', clap: BACKBEAT, chh: HATS_AROUND_OH, ohh: OFF_OH },
    synths: {
      bass: 'A1 A1 A2! A1 - A1~ C2 A1 D#2! A1 A1 G2~ A1 A1 C2! -',
    },
    sound: { synths: { bass: { engine: 'acid', cutoff: 0.3, reso: 0.82, envMod: 0.7 } } },
  },
  {
    id: 'hard-acid',
    name: 'Hard Acid',
    genre: 'Acid',
    bpm: 145,
    swing: 50,
    length: 16,
    drums: { kick: 'X...X...X...X..x', clap: BACKBEAT, chh: HATS_AROUND_OH, ohh: OFF_OH },
    synths: {
      bass: 'C2! C2 C3~ C2 D#2 C2! - F2~ C2 C2 G2! C2 - C2~ A#1 C2',
    },
    sound: {
      drums: { kick: { decay: 0.6, tune: 0.45 } },
      synths: { bass: { engine: 'acid', cutoff: 0.4, reso: 0.9, envMod: 0.85, tone: 0.8 } },
    },
  },
  {
    id: 'detroit',
    name: 'Detroit Techno',
    genre: 'Techno',
    bpm: 128,
    swing: 52,
    length: 16,
    drums: {
      kick: FOUR,
      clap: BACKBEAT,
      chh: 'xx.xx?.xxx.xx?.x',
      ohh: OFF_OH,
      ride: 'x.x.x.x.x.x.x.x.',
    },
    synths: {
      bass: 'F1 - - F1 - - F2 - F1 - - F1 - G#1 - -',
      lead: '- - - - - - C4! - - - - - - - D#4 -',
    },
    sound: {
      drums: { ride: { level: 0.45 } },
      synths: {
        bass: { engine: 'fm', algo: 0, ratio: 1, tone: 0.35, decay: 0.3, cutoff: 0.5, reso: 0.2 },
        lead: { engine: 'saw', chord: 3, decay: 0.3, cutoff: 0.55, space: 0.45 },
      },
    },
  },
  {
    id: 'minimal',
    name: 'Minimal Tool',
    genre: 'Techno',
    bpm: 126,
    swing: 54,
    length: 16,
    drums: { kick: FOUR, clap: '....?.......x...', chh: '.x.x.x?x.x.x.x?x' },
    synths: {
      bass: 'G1 - - G1! - - - - G1 - A#1 - - - G1 -',
      lead: '- - - - - - - - - - - - - - D5 -',
    },
    sound: {
      synths: {
        bass: { engine: 'acid', cutoff: 0.25, reso: 0.4, envMod: 0.35, decay: 0.2 },
        lead: { engine: 'fm', algo: 6, ratio: 4, tone: 0.5, decay: 0.6, chord: 0, space: 0.6 },
      },
    },
  },
  {
    id: 'chicago-house',
    name: 'Chicago House',
    genre: 'House',
    bpm: 124,
    swing: 58,
    length: 16,
    drums: { kick: FOUR, clap: BACKBEAT, chh: 'x?.xx?.xx?.xx?.x', ohh: OFF_OH },
    synths: {
      bass: 'C2 - - C2 - C2 - - C2 - - C3 - C2 - -',
      lead: '- - - G3 - - G3 - - - - G3 - - - -',
    },
    sound: {
      synths: {
        bass: { engine: 'fm', algo: 2, ratio: 1, tone: 0.3, decay: 0.35, cutoff: 0.45 },
        lead: { engine: 'fm', algo: 7, chord: 3, decay: 0.35, cutoff: 0.7, space: 0.4 },
      },
    },
  },
  {
    id: 'jungle',
    name: 'Jungle Break',
    genre: 'Breaks',
    bpm: 170,
    swing: 50,
    length: 16,
    drums: {
      kick: 'x.x.......xx....',
      snare: '....X..?.x..X..?',
      ride: 'x.x.x.x.x.x.x.x.',
    },
    synths: {
      bass: 'F1~ - - - - - - - D#1~ - - - - - - -',
    },
    sound: {
      drums: { snare: { tune: 0.6, decay: 0.4 }, ride: { level: 0.5 } },
      synths: { bass: { engine: 'saw', chord: 0, tone: 0.25, cutoff: 0.2, envMod: 0.1, decay: 1 } },
    },
  },
  {
    id: 'dnb',
    name: 'Two-Step D&B',
    genre: 'Drum & Bass',
    bpm: 174,
    swing: 50,
    length: 16,
    drums: {
      kick: 'x.........x.....',
      snare: '....X.......X...',
      chh: 'x.x.x.x.x.x.x?x.',
      ride: '..x...x...x...x.',
    },
    synths: {
      bass: 'E1~ - - - - - - - - - G1~ - - - - -',
    },
    sound: {
      drums: { ride: { level: 0.4 } },
      synths: {
        bass: {
          engine: 'saw',
          chord: 0,
          tone: 0.35,
          cutoff: 0.25,
          reso: 0.4,
          envMod: 0.2,
          decay: 1,
        },
      },
    },
  },
  {
    id: 'trance-gate',
    name: 'Trance Gate',
    genre: 'Trance',
    bpm: 138,
    swing: 50,
    length: 32,
    drums: { kick: FOUR, clap: BACKBEAT, chh: 'x?.xx?.xx?.xx?.x', ohh: OFF_OH },
    synths: {
      bass: '- A1 A1 A1 - A1 A1 A1 - F1 F1 F1 - F1 F1 F1 - C2 C2 C2 - C2 C2 C2 - G1 G1 G1 - G1 G1 G1',
      lead: 'A3~ - - - - - - - F3~ - - - - - - - C4~ - - - - - - - G3~ - - - - - - -',
    },
    sound: {
      synths: {
        bass: { engine: 'acid', cutoff: 0.3, reso: 0.3, envMod: 0.3, decay: 0.25 },
        lead: {
          engine: 'saw',
          chord: 4,
          tone: 0.7,
          cutoff: 0.6,
          envMod: 0.1,
          decay: 1,
          space: 0.5,
        },
      },
    },
  },
  {
    id: 'hardcore',
    name: 'Hoover Hardcore',
    genre: 'Hardcore',
    bpm: 150,
    swing: 50,
    length: 16,
    drums: {
      kick: 'x.........x.....',
      snare: '....X.......X...',
      chh: 'x.x.x.x.x.x.x...',
      ohh: '..............x.',
    },
    synths: {
      bass: 'C1 - C1 - - - C1 - C1 - - C1 - - C2 -',
      lead: 'C3!~ - - B2~ - - C3 - - - G2~ - A#2 - C3~ -',
    },
    sound: {
      synths: {
        bass: { engine: 'fm', algo: 0, ratio: 1, tone: 0.5, decay: 0.3, cutoff: 0.4 },
        lead: {
          engine: 'saw',
          chord: 4,
          tone: 0.9,
          cutoff: 0.5,
          reso: 0.35,
          envMod: 0.5,
          space: 0.3,
        },
      },
    },
  },
  {
    id: 'electro',
    name: 'Electro Funk',
    genre: 'Electro',
    bpm: 122,
    swing: 50,
    length: 16,
    drums: { kick: 'x.....x...x.....', clap: BACKBEAT, chh: 'x.xxx.xxx.xxx.xx' },
    synths: {
      bass: 'C2 - C2 C3 - C2 - D#2 - C2 - - G1 - A#1 -',
    },
    sound: {
      drums: { kick: { tune: 0.35, decay: 0.85 } },
      synths: { bass: { engine: 'fm', algo: 1, ratio: 1, tone: 0.55, decay: 0.3, cutoff: 0.6 } },
    },
  },
  {
    id: 'init',
    name: 'Empty',
    genre: 'Init',
    bpm: 125,
    swing: 50,
    length: 16,
    drums: {},
    synths: {},
  },
];

export function getLoop(id: string): LoopPreset {
  return LOOPS.find((l) => l.id === id) ?? LOOPS[0]!;
}

export interface BuiltLoop {
  pattern: Pattern;
  sound: Sound;
}

/** Expand a preset into an editable pattern and sound settings. */
export function buildLoop(preset: LoopPreset): BuiltLoop {
  const pattern = emptyPattern(preset.length);
  for (const id of DRUM_IDS) {
    const line = preset.drums[id];
    if (line) pattern.tracks[id] = fit(parseDrum(line));
  }
  for (const id of SYNTH_IDS) {
    const line = preset.synths[id];
    if (line) pattern.tracks[id] = fit(parseSynth(line));
  }
  const sound = defaultSound();
  for (const id of DRUM_IDS) Object.assign(sound.drums[id], preset.sound?.drums?.[id]);
  for (const id of SYNTH_IDS) Object.assign(sound.synths[id], preset.sound?.synths?.[id]);
  return { pattern, sound };
}
