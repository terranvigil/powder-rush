/**
 * Title/menu music — bright, inviting chiptune in C major.
 * Gentle music-box melody over soft arpeggiated chords.
 * Plays during splash screen and main menu. 8-bar loop at 96 BPM.
 */

const N: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
};

const BPM = 96;
const BEAT = 60 / BPM;
const EIGHTH = BEAT / 2;
const SIXTEENTH = BEAT / 4;

// 8-bar melody: music-box quality, gentle and bright — 64 eighth notes
const MELODY: number[] = [
  // Bars 1-2: C — crystalline opening
  N.E5, 0, N.G5, 0, N.E5, 0, N.C5, 0,
  N.D5, 0, N.E5, 0, N.C5, 0, 0, 0,
  // Bars 3-4: F → G — rising hope
  N.F5, 0, N.A5, 0, N.F5, 0, N.C5, 0,
  N.G5, 0, N.F5, 0, N.E5, 0, N.D5, 0,
  // Bars 5-6: Am → Em — gentle touch of melancholy
  N.E5, 0, N.C5, 0, N.A4, 0, N.E5, 0,
  N.B4, 0, N.D5, 0, N.E5, 0, 0, 0,
  // Bars 7-8: F → G → C — warm resolution
  N.F5, 0, N.E5, 0, N.D5, 0, N.C5, 0,
  N.E5, 0, N.D5, 0, N.C5, 0, 0, 0,
];

// Arpeggio: broken chords in sixteenth notes, 128 sixteenths over 8 bars
const ARP: number[] = [
  // Bars 1-2: C
  N.C4, N.E4, N.G4, N.C5, N.G4, N.E4, N.C4, N.E4, N.G4, N.C5, N.G4, N.E4, N.C4, N.E4, N.G4, N.E4,
  N.C4, N.E4, N.G4, N.C5, N.G4, N.E4, N.C4, N.E4, N.G4, N.C5, N.G4, N.E4, N.C4, 0, 0, 0,
  // Bars 3-4: F, G
  N.F3, N.A3, N.C4, N.F4, N.C4, N.A3, N.F3, N.A3, N.C4, N.F4, N.C4, N.A3, N.F3, N.A3, N.C4, N.A3,
  N.G3, N.B3, N.D4, N.G4, N.D4, N.B3, N.G3, N.B3, N.D4, N.G4, N.D4, N.B3, N.G3, 0, 0, 0,
  // Bars 5-6: Am, Em
  N.A3, N.C4, N.E4, N.A4, N.E4, N.C4, N.A3, N.C4, N.E4, N.A4, N.E4, N.C4, N.A3, N.C4, N.E4, N.C4,
  N.E3, N.G3, N.B3, N.E4, N.B3, N.G3, N.E3, N.G3, N.B3, N.E4, N.B3, N.G3, N.E3, 0, 0, 0,
  // Bars 7-8: F, G → C
  N.F3, N.A3, N.C4, N.F4, N.C4, N.A3, N.F3, N.A3, N.C4, N.F4, N.C4, N.A3, N.F3, N.A3, N.C4, N.A3,
  N.G3, N.B3, N.D4, N.G4, N.D4, N.B3, N.C4, N.E4, N.G4, N.C5, 0, 0, 0, 0, 0, 0,
];

// Bass: half notes, warm sine
const BASS: number[] = [
  N.C3, N.C3, N.C3, N.G3,    // C
  N.F3, N.F3, N.G3, N.G3,    // F, G
  N.A3, N.A3, N.E3, N.E3,    // Am, Em
  N.F3, N.F3, N.G3, N.C3,    // F, G, C
];

export class SplashMusic {
  private ctx: AudioContext;
  private master: GainNode;
  private playing = false;
  private timeoutId = 0;
  private nextLoopTime = 0;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
  }

  start(): void {
    if (this.playing) return;
    this.ctx.resume();
    this.playing = true;
    this.nextLoopTime = 0;

    // Fade in
    this.master.gain.setValueAtTime(0, this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 1.5);

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
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
    setTimeout(() => this.ctx.suspend(), 900);
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
    // Lead melody — triangle wave, music-box shimmer
    for (let i = 0; i < MELODY.length; i++) {
      if (MELODY[i] > 0) {
        this.playNote(MELODY[i], "triangle", 0.08, EIGHTH * 1.4, start + i * EIGHTH);
      }
    }

    // Arpeggios — triangle wave, very soft underpinning
    for (let i = 0; i < ARP.length; i++) {
      if (ARP[i] > 0) {
        this.playNote(ARP[i], "triangle", 0.025, SIXTEENTH * 1.6, start + i * SIXTEENTH);
      }
    }

    // Bass — sine wave, warm and round
    const halfNote = BEAT * 2;
    for (let i = 0; i < BASS.length; i++) {
      this.playNote(BASS[i], "sine", 0.08, halfNote * 0.85, start + i * halfNote);
    }

    // Pad — sustained sine chords, one per 2 bars
    const padChords: number[][] = [
      [N.C4, N.E4, N.G4],  // C
      [N.F3, N.A3, N.C4],  // F
      [N.A3, N.C4, N.E4],  // Am
      [N.G3, N.B3, N.D4],  // G
    ];
    const phraseLen = BEAT * 4 * 2; // 2 bars
    for (let p = 0; p < padChords.length; p++) {
      const pTime = start + p * phraseLen;
      for (const freq of padChords[p]) {
        this.playPad(freq, 0.018, phraseLen * 0.92, pTime);
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

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.015);
    gain.gain.setValueAtTime(vol, time + dur * 0.5);
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

    const attack = Math.min(0.6, dur * 0.12);
    const release = Math.min(1.0, dur * 0.25);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + attack);
    gain.gain.setValueAtTime(vol, time + dur - release);
    gain.gain.linearRampToValueAtTime(0, time + dur);

    osc.start(time);
    osc.stop(time + dur + 0.01);
  }
}
