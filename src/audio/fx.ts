import { REPEAT_STEPS, type FxId } from '../data/fx';
import { crushCurve, tapeStopCurve } from './fxmath';
import { noiseSource } from './noise';

const RAMP = 0.006;

/**
 * Master punch-in FX chain. Every stage is always in the graph and sits at a
 * neutral setting until engaged, so engaging is just parameter automation.
 *
 * in → kill (low shelf) → LP → HP → crush (dry/wet) → gate → looper (dry/wet) → out
 *                                                     looper out → delay send → out
 * The riser is a generated noise sweep mixed into the output.
 */
export class FxChain {
  readonly input: GainNode;
  readonly output: GainNode;
  private kill: BiquadFilterNode;
  private lp: BiquadFilterNode;
  private hp: BiquadFilterNode;
  private crushDry: GainNode;
  private crushWet: GainNode;
  private gate: GainNode;
  private gateLfo: OscillatorNode | null = null;
  private loopDry: GainNode;
  private loopIn: GainNode;
  private loopDelay: DelayNode;
  private loopFb: GainNode;
  private loopWet: GainNode;
  private loopOwner: FxId | null = null;
  private delaySend: GainNode;
  private echo: DelayNode;
  private riser: { src: AudioBufferSourceNode; gain: GainNode; osc: OscillatorNode } | null = null;
  readonly active = new Set<FxId>();

  constructor(
    private readonly ctx: AudioContext,
    /** Current 16th-note duration in seconds. */
    private readonly stepDur: () => number,
  ) {
    const c = ctx;
    this.input = c.createGain();
    this.output = c.createGain();

    this.kill = c.createBiquadFilter();
    this.kill.type = 'lowshelf';
    this.kill.frequency.value = 220;
    this.kill.gain.value = 0;

    this.lp = c.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 20000;
    this.lp.Q.value = 0.7;

    this.hp = c.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = 20;
    this.hp.Q.value = 0.7;

    const crush = c.createWaveShaper();
    crush.curve = crushCurve(4) as Float32Array<ArrayBuffer>;
    this.crushDry = c.createGain();
    this.crushWet = c.createGain();
    this.crushWet.gain.value = 0;
    const crushOut = c.createGain();

    this.gate = c.createGain();

    // Looper: a delay line that is always recording. Beat repeat closes the
    // input and feeds the delay back into itself; tape stop bends its delay time.
    this.loopDry = c.createGain();
    this.loopIn = c.createGain();
    this.loopDelay = c.createDelay(4);
    this.loopFb = c.createGain();
    this.loopFb.gain.value = 0;
    this.loopWet = c.createGain();
    this.loopWet.gain.value = 0;
    const loopOut = c.createGain();

    this.delaySend = c.createGain();
    this.delaySend.gain.value = 0;
    this.echo = c.createDelay(2);
    const echoFb = c.createGain();
    echoFb.gain.value = 0.55;
    const echoHp = c.createBiquadFilter();
    echoHp.type = 'highpass';
    echoHp.frequency.value = 350;

    this.input.connect(this.kill).connect(this.lp).connect(this.hp);
    this.hp.connect(this.crushDry).connect(crushOut);
    this.hp.connect(crush).connect(this.crushWet).connect(crushOut);
    crushOut.connect(this.gate);
    this.gate.connect(this.loopDry).connect(loopOut);
    this.gate.connect(this.loopIn).connect(this.loopDelay);
    this.loopDelay.connect(this.loopFb).connect(this.loopDelay);
    this.loopDelay.connect(this.loopWet).connect(loopOut);
    loopOut.connect(this.output);
    loopOut.connect(this.delaySend).connect(this.echo);
    this.echo.connect(echoHp).connect(echoFb).connect(this.echo);
    echoHp.connect(this.output);
  }

  engage(id: FxId, t: number): void {
    if (this.active.has(id)) return;
    this.active.add(id);
    const dur = this.stepDur();
    const beat = dur * 4;
    switch (id) {
      case 'lpf': {
        const f = this.lp.frequency;
        f.cancelScheduledValues(t);
        f.setValueAtTime(18000, t);
        f.exponentialRampToValueAtTime(250, t + beat * 4);
        this.lp.Q.setTargetAtTime(9, t, 0.05);
        break;
      }
      case 'hpf': {
        const f = this.hp.frequency;
        f.cancelScheduledValues(t);
        f.setValueAtTime(30, t);
        f.exponentialRampToValueAtTime(3000, t + beat * 4);
        this.hp.Q.setTargetAtTime(6, t, 0.05);
        break;
      }
      case 'kill':
        this.kill.gain.setTargetAtTime(-40, t, 0.01);
        break;
      case 'crush':
        this.crushDry.gain.setTargetAtTime(0, t, RAMP);
        this.crushWet.gain.setTargetAtTime(0.8, t, RAMP);
        break;
      case 'gate': {
        // Square LFO: one 16th on, one 16th off, phase-locked to the grid.
        const lfo = this.ctx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 1 / (dur * 2);
        const depth = this.ctx.createGain();
        depth.gain.value = 0.5;
        lfo.connect(depth).connect(this.gate.gain);
        this.gate.gain.setValueAtTime(0.5, t);
        lfo.start(t);
        this.gateLfo = lfo;
        break;
      }
      case 'delay':
        this.echo.delayTime.setValueAtTime(Math.min(1.9, dur * 3), t);
        this.delaySend.gain.setTargetAtTime(0.9, t, RAMP);
        break;
      case 'riser':
        this.startRiser(t, beat * 8);
        break;
      case 'tape':
        this.startLoop(id, t, () => {
          const len = Math.min(3, beat * 2);
          this.loopFb.gain.setValueAtTime(0, t);
          this.loopIn.gain.setValueAtTime(1, t);
          this.loopDelay.delayTime.setValueCurveAtTime(
            tapeStopCurve(len) as Float32Array<ArrayBuffer>,
            t,
            len,
          );
          this.loopWet.gain.setValueAtTime(1, t);
          this.loopWet.gain.setValueAtTime(1, t + len * 0.8);
          this.loopWet.gain.linearRampToValueAtTime(0, t + len);
        });
        break;
      default: {
        const steps = REPEAT_STEPS[id];
        if (steps === undefined) break;
        this.startLoop(id, t, () => {
          // The delay already holds the last `len` seconds: freeze and loop them.
          const len = steps * dur;
          this.loopDelay.delayTime.setValueAtTime(len, t);
          this.loopIn.gain.setValueAtTime(0, t);
          this.loopFb.gain.setValueAtTime(1, t);
          this.loopWet.gain.setValueAtTime(1, t);
        });
      }
    }
  }

  release(id: FxId, t: number): void {
    if (!this.active.delete(id)) return;
    switch (id) {
      case 'lpf':
        this.lp.frequency.cancelScheduledValues(t);
        this.lp.frequency.setTargetAtTime(20000, t, 0.03);
        this.lp.Q.setTargetAtTime(0.7, t, 0.03);
        break;
      case 'hpf':
        this.hp.frequency.cancelScheduledValues(t);
        this.hp.frequency.setTargetAtTime(20, t, 0.03);
        this.hp.Q.setTargetAtTime(0.7, t, 0.03);
        break;
      case 'kill':
        this.kill.gain.setTargetAtTime(0, t, 0.01);
        break;
      case 'crush':
        this.crushDry.gain.setTargetAtTime(1, t, RAMP);
        this.crushWet.gain.setTargetAtTime(0, t, RAMP);
        break;
      case 'gate':
        this.gateLfo?.stop(t);
        this.gateLfo = null;
        this.gate.gain.cancelScheduledValues(t);
        this.gate.gain.setValueAtTime(1, t);
        break;
      case 'delay':
        this.delaySend.gain.setTargetAtTime(0, t, RAMP);
        break;
      case 'riser':
        this.stopRiser(t);
        break;
      default:
        if (this.loopOwner === id) this.stopLoop(t);
    }
  }

  releaseAll(t: number): void {
    for (const id of [...this.active]) this.release(id, t);
  }

  private startLoop(id: FxId, t: number, setup: () => void): void {
    if (this.loopOwner) this.active.delete(this.loopOwner);
    this.loopOwner = id;
    for (const p of [
      this.loopDelay.delayTime,
      this.loopFb.gain,
      this.loopIn.gain,
      this.loopWet.gain,
    ])
      p.cancelScheduledValues(t);
    this.loopDry.gain.cancelScheduledValues(t);
    this.loopDry.gain.setValueAtTime(1, t);
    this.loopDry.gain.linearRampToValueAtTime(0, t + RAMP);
    setup();
  }

  private stopLoop(t: number): void {
    this.loopOwner = null;
    for (const p of [
      this.loopDelay.delayTime,
      this.loopFb.gain,
      this.loopWet.gain,
      this.loopIn.gain,
    ])
      p.cancelScheduledValues(t);
    this.loopWet.gain.setTargetAtTime(0, t, RAMP / 3);
    this.loopFb.gain.setValueAtTime(0, t + RAMP);
    this.loopIn.gain.setValueAtTime(1, t + RAMP);
    this.loopDry.gain.cancelScheduledValues(t);
    this.loopDry.gain.setValueAtTime(0, t);
    this.loopDry.gain.linearRampToValueAtTime(1, t + RAMP);
  }

  private startRiser(t: number, len: number): void {
    const c = this.ctx;
    const src = noiseSource(c, true);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 4;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(9000, t + len);
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + len);
    const oscGain = c.createGain();
    oscGain.gain.value = 0.12;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + len);
    src.connect(bp).connect(gain);
    osc.connect(oscGain).connect(gain);
    gain.connect(this.output);
    src.start(t);
    osc.start(t);
    this.riser = { src, gain, osc };
  }

  private stopRiser(t: number): void {
    const r = this.riser;
    if (!r) return;
    this.riser = null;
    r.gain.gain.cancelScheduledValues(t);
    r.gain.gain.setTargetAtTime(0, t, 0.05);
    r.src.stop(t + 0.4);
    r.osc.stop(t + 0.4);
  }
}
