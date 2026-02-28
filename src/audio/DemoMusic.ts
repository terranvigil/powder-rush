/**
 * Attract-mode music — dreamy atmospheric chiptune in A minor.
 * Slower tempo (108 BPM), arpeggiated pads, cascading melody,
 * minimal percussion. Evokes drifting through powder at dusk.
 */

const N: Record<string, number> = {
  A2: 110.00, B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00,
  A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
  A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
  A5: 880.00, B5: 987.77, C6: 1046.50,
};

const BPM = 108;
const BEAT = 60 / BPM;
const EIGHTH = BEAT / 2;
const SIXTEENTH = BEAT / 4;

// 16-bar melody: floating, cascading — triangle wave at eighth-note resolution
// 128 eighth notes total
const MELODY: number[] = [
  // Bars 1-2: Am — gentle descent
  N.E5, 0, N.C5, 0, N.A4, 0, N.E5, 0,
  N.D5, 0, N.C5, 0, N.A4, 0, 0, 0,
  // Bars 3-4: F — open, hopeful
  N.F5, 0, N.C5, 0, N.A4, 0, N.F5, 0,
  N.E5, 0, N.D5, 0, N.C5, 0, 0, 0,
  // Bars 5-6: G — reaching up
  N.G5, 0, N.E5, 0, N.D5, 0, N.G5, 0,
  N.E5, 0, N.D5, 0, N.B4, 0, 0, 0,
  // Bars 7-8: Am, E — return and tension
  N.A5, 0, N.E5, 0, N.C5, 0, N.A4, 0,
  N.B4, 0, N.G4, 0, N.E4, 0, 0, 0,

  // Bars 9-10: C — opening out, wider intervals
  N.C5, 0, 0, N.G5, 0, 0, N.E5, 0,
  0, N.C5, 0, 0, N.G4, 0, 0, 0,
  // Bars 11-12: F — echoing
  N.F5, 0, 0, N.A5, 0, 0, N.F5, 0,
  0, N.C5, 0, 0, N.A4, 0, 0, 0,
  // Bars 13-14: Dm — melancholy cascade
  N.D5, N.E5, N.F5, 0, N.E5, N.D5, N.C5, 0,
  N.D5, 0, N.F5, 0, N.A5, 0, N.G5, 0,
  // Bars 15-16: Am, E — resolve
  N.A5, 0, N.E5, 0, N.C5, 0, N.E5, 0,
  N.A4, 0, 0, 0, 0, 0, 0, 0,
];

// Arpeggio layer: gentle broken chords, triangle wave, sixteenth notes
// 256 sixteenths over 16 bars. Quieter underpinning.
const ARP: number[] = [
  // Bars 1-2: Am
  N.A3, N.C4, N.E4, N.A4, N.E4, N.C4, N.A3, N.C4, N.E4, N.A4, N.E4, N.C4, N.A3, N.C4, N.E4, N.C4,
  N.A3, N.C4, N.E4, N.A4, N.E4, N.C4, N.A3, N.C4, N.E4, N.A4, N.E4, N.C4, N.A3, 0, 0, 0,
  // Bars 3-4: F
  N.F3, N.A3, N.C4, N.F4, N.C4, N.A3, N.F3, N.A3, N.C4, N.F4, N.C4, N.A3, N.F3, N.A3, N.C4, N.A3,
  N.F3, N.A3, N.C4, N.F4, N.C4, N.A3, N.F3, N.A3, N.C4, N.F4, N.C4, N.A3, N.F3, 0, 0, 0,
  // Bars 5-6: G
  N.G3, N.B3, N.D4, N.G4, N.D4, N.B3, N.G3, N.B3, N.D4, N.G4, N.D4, N.B3, N.G3, N.B3, N.D4, N.B3,
  N.G3, N.B3, N.D4, N.G4, N.D4, N.B3, N.G3, N.B3, N.D4, N.G4, N.D4, N.B3, N.G3, 0, 0, 0,
  // Bars 7-8: Am, E
  N.A3, N.C4, N.E4, N.A4, N.E4, N.C4, N.A3, N.C4, N.E4, N.A4, N.E4, N.C4, N.A3, N.C4, N.E4, N.C4,
  N.E3, N.G3, N.B3, N.E4, N.B3, N.G3, N.E3, N.G3, N.B3, N.E4, N.B3, N.G3, N.E3, 0, 0, 0,

  // Bars 9-10: C
  N.C4, N.E4, N.G4, N.C5, N.G4, N.E4, N.C4, N.E4, N.G4, N.C5, N.G4, N.E4, N.C4, N.E4, N.G4, N.E4,
  N.C4, N.E4, N.G4, N.C5, N.G4, N.E4, N.C4, N.E4, N.G4, N.C5, N.G4, N.E4, N.C4, 0, 0, 0,
  // Bars 11-12: F
  N.F3, N.A3, N.C4, N.F4, N.C4, N.A3, N.F3, N.A3, N.C4, N.F4, N.C4, N.A3, N.F3, N.A3, N.C4, N.A3,
  N.F3, N.A3, N.C4, N.F4, N.C4, N.A3, N.F3, N.A3, N.C4, N.F4, N.C4, N.A3, N.F3, 0, 0, 0,
  // Bars 13-14: Dm
  N.D3, N.F3, N.A3, N.D4, N.A3, N.F3, N.D3, N.F3, N.A3, N.D4, N.A3, N.F3, N.D3, N.F3, N.A3, N.F3,
  N.D3, N.F3, N.A3, N.D4, N.A3, N.F3, N.D3, N.F3, N.A3, N.D4, N.A3, N.F3, N.D3, 0, 0, 0,
  // Bars 15-16: Am, E → Am
  N.A3, N.C4, N.E4, N.A4, N.E4, N.C4, N.A3, N.C4, N.E4, N.A4, N.E4, N.C4, N.A3, N.C4, N.E4, N.C4,
  N.E3, N.G3, N.B3, N.E4, N.B3, N.G3, N.A3, N.C4, N.E4, N.A4, 0, 0, 0, 0, 0, 0,
];

// Bass: whole/half notes, deep triangle wave
// 32 half-notes over 16 bars
const BASS: number[] = [
  N.A2, N.A2,  N.A2, N.E3,    // Am
  N.F3, N.F3,  N.F3, N.C3,    // F
  N.G3, N.G3,  N.G3, N.D3,    // G
  N.A2, N.A2,  N.E3, N.E3,    // Am, E

  N.C3, N.C3,  N.G3, N.G3,    // C
  N.F3, N.F3,  N.F3, N.C3,    // F
  N.D3, N.D3,  N.D3, N.A2,    // Dm
  N.A2, N.A2,  N.E3, N.A2,    // Am, E, Am
];

// Minimal drums: soft pulse, no snare. 16 sixteenths per bar.
// K = soft kick, . = rest, h = very quiet hihat
const DRUM_CHILL = "K...h...K...h...";
const DRUM_OPEN  = "K.......K.......";
const DRUM_BUILD = "K...h...K.h.h...";
const DRUM_REST  = "................";

const DRUM_MAP: string[] = [
  DRUM_OPEN, DRUM_CHILL, DRUM_OPEN, DRUM_CHILL,
  DRUM_OPEN, DRUM_CHILL, DRUM_CHILL, DRUM_BUILD,
  DRUM_REST, DRUM_REST, DRUM_OPEN, DRUM_CHILL,
  DRUM_CHILL, DRUM_BUILD, DRUM_CHILL, DRUM_OPEN,
];

export class DemoMusic {
  private ctx: AudioContext;
  private master: GainNode;
  private playing = false;
  private timeoutId = 0;
  private nextLoopTime = 0;
  private snareBuffer: AudioBuffer;
  private hihatBuffer: AudioBuffer;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.18; // Quiet background music
    this.master.connect(this.ctx.destination);
    this.snareBuffer = this.createNoiseBuffer(0.1);
    this.hihatBuffer = this.createNoiseBuffer(0.04);
  }

  start(): void {
    if (this.playing) return;
    // Resume context (needed if suspended by autoplay policy)
    this.ctx.resume();
    this.playing = true;
    this.nextLoopTime = 0;

    // Fade in
    this.master.gain.setValueAtTime(0, this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 2);

    this.scheduleLoop();
  }

  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = 0;
    }
    // Fade out
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    setTimeout(() => this.ctx.suspend(), 600);
  }

  dispose(): void {
    this.stop();
    this.ctx.close();
  }

  private scheduleLoop(): void {
    if (!this.playing) return;

    const start = this.nextLoopTime > this.ctx.currentTime
      ? this.nextLoopTime
      : this.ctx.currentTime + 0.05;
    const loopDuration = this.scheduleBars(start);
    this.nextLoopTime = start + loopDuration;

    const timeUntilEnd = this.nextLoopTime - this.ctx.currentTime;
    this.timeoutId = window.setTimeout(
      () => this.scheduleLoop(),
      Math.max(100, (timeUntilEnd - 2) * 1000),
    );
  }

  private scheduleBars(start: number): number {
    // Lead melody — triangle wave, soft
    for (let i = 0; i < MELODY.length; i++) {
      if (MELODY[i] > 0) {
        this.playNote(MELODY[i], "triangle", 0.09, EIGHTH * 1.2, start + i * EIGHTH);
      }
    }

    // Arpeggios — triangle wave, very soft
    for (let i = 0; i < ARP.length; i++) {
      if (ARP[i] > 0) {
        this.playNote(ARP[i], "triangle", 0.03, SIXTEENTH * 1.5, start + i * SIXTEENTH);
      }
    }

    // Bass — triangle wave, warm and deep
    const halfNote = BEAT * 2;
    for (let i = 0; i < BASS.length; i++) {
      this.playNote(BASS[i], "triangle", 0.10, halfNote * 0.9, start + i * halfNote);
    }

    // Pad — sustained sine wave chords, very soft, one per 4-bar phrase
    const padChords: number[][] = [
      [N.A3, N.C4, N.E4],  // Am
      [N.F3, N.A3, N.C4],  // F
      [N.G3, N.B3, N.D4],  // G
      [N.A3, N.C4, N.E4],  // Am
    ];
    const phraseLen = BEAT * 4 * 4; // 4 bars
    for (let p = 0; p < padChords.length; p++) {
      const pTime = start + p * phraseLen;
      for (const freq of padChords[p]) {
        this.playPad(freq, 0.025, phraseLen * 0.95, pTime);
      }
    }

    // Drums
    for (let bar = 0; bar < DRUM_MAP.length; bar++) {
      const barStart = start + bar * BEAT * 4;
      const pattern = DRUM_MAP[bar];
      for (let s = 0; s < pattern.length; s++) {
        const t = barStart + s * SIXTEENTH;
        const ch = pattern[s];
        if (ch === "K") this.playSoftKick(t);
        else if (ch === "h") this.playSoftHat(t);
      }
    }

    return MELODY.length * EIGHTH;
  }

  private playNote(freq: number, type: OscillatorType, vol: number, dur: number, time: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.master);

    // Soft attack and release
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.02);
    gain.gain.setValueAtTime(vol, time + dur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  private playPad(freq: number, vol: number, dur: number, time: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.master);

    // Very slow attack and release for pad
    const attack = Math.min(0.8, dur * 0.15);
    const release = Math.min(1.5, dur * 0.3);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + attack);
    gain.gain.setValueAtTime(vol, time + dur - release);
    gain.gain.linearRampToValueAtTime(0, time + dur);

    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  private playSoftKick(time: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.12);
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private playSoftHat(time: number): void {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.hihatBuffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.02, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    noise.start(time);
    noise.stop(time + 0.04);
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    const size = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
