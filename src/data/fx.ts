/** Punch-in FX: active only while held. Order = pad order (4×3 grid). */
export const FX_DEFS = [
  { id: 'lpf', label: 'LP Sweep', key: '1' },
  { id: 'hpf', label: 'HP Sweep', key: '2' },
  { id: 'kill', label: 'Kill Bass', key: '3' },
  { id: 'crush', label: 'Crush', key: '4' },
  { id: 'rep4', label: 'Repeat 1/4', key: '5' },
  { id: 'rep8', label: 'Repeat 1/8', key: '6' },
  { id: 'rep16', label: 'Repeat 1/16', key: '7' },
  { id: 'rep32', label: 'Repeat 1/32', key: '8' },
  { id: 'gate', label: 'Gate', key: '9' },
  { id: 'delay', label: 'Delay Throw', key: '0' },
  { id: 'tape', label: 'Tape Stop', key: '-' },
  { id: 'riser', label: 'Riser', key: '=' },
] as const;
export type FxId = (typeof FX_DEFS)[number]['id'];

/** Beat-repeat slice length in 16th steps. */
export const REPEAT_STEPS: Partial<Record<FxId, number>> = {
  rep4: 4,
  rep8: 2,
  rep16: 1,
  rep32: 0.5,
};

/** FX whose start snaps to the next 16th while the sequencer runs. */
export const QUANTIZED: ReadonlySet<FxId> = new Set([
  'rep4',
  'rep8',
  'rep16',
  'rep32',
  'gate',
  'tape',
]);
