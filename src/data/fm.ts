/**
 * 4-operator FM algorithms (operators 0..3). `mods` are [modulator, target]
 * pairs; carriers go to the output. Modulators always have a higher index than
 * their target, so every algorithm is feed-forward (no cycles).
 */
export interface FmAlgo {
  name: string;
  carriers: number[];
  mods: [number, number][];
  /** Base frequency ratio for each operator (modulators are scaled by the ratio param). */
  ratios: [number, number, number, number];
}

export const FM_ALGOS: FmAlgo[] = [
  {
    name: 'Stack 4→3→2→1',
    carriers: [0],
    mods: [
      [3, 2],
      [2, 1],
      [1, 0],
    ],
    ratios: [1, 1, 1, 1],
  },
  {
    name: 'Y 3+4→2→1',
    carriers: [0],
    mods: [
      [3, 1],
      [2, 1],
      [1, 0],
    ],
    ratios: [1, 1, 2, 1],
  },
  {
    name: 'Branch',
    carriers: [0],
    mods: [
      [3, 2],
      [2, 0],
      [1, 0],
    ],
    ratios: [1, 1, 0.5, 2],
  },
  {
    name: 'Two stacks',
    carriers: [0, 2],
    mods: [
      [3, 2],
      [1, 0],
    ],
    ratios: [1, 1, 2, 2],
  },
  {
    name: 'One→three',
    carriers: [0, 1, 2],
    mods: [
      [3, 0],
      [3, 1],
      [3, 2],
    ],
    ratios: [1, 2, 3, 1],
  },
  {
    name: 'Stack + carrier',
    carriers: [0, 1],
    mods: [
      [3, 2],
      [2, 1],
    ],
    ratios: [0.5, 1, 1, 1],
  },
  { name: 'Pair + 2 sines', carriers: [0, 2, 3], mods: [[1, 0]], ratios: [1, 1, 2, 4] },
  { name: 'Organ (additive)', carriers: [0, 1, 2, 3], mods: [], ratios: [0.5, 1, 2, 4] },
];
