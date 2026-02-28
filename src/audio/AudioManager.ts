// Note frequencies
const N: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, Fs3: 185.00, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50,
};

const BPM = 150;
const BEAT = 60 / BPM;
const EIGHTH = BEAT / 2;
const SIXTEENTH = BEAT / 4;

// 32-bar melody in E minor (256 eighth notes, 4 distinct 8-bar sections)
const MELODY: number[] = [
  // === Section A — "Descent" (syncopated hook, Em) ===
  // Bars 1-2: Em
  N.E5, 0, N.G5, N.A5, N.B5, 0, N.A5, N.G5,
  N.A5, 0, N.G5, N.E5, N.D5, 0, N.E5, 0,
  // Bars 3-4: C, D
  N.C5, 0, N.E5, N.G5, N.A5, 0, N.G5, N.E5,
  N.D5, 0, N.Fs5, N.A5, N.Fs5, 0, 0, 0,
  // Bars 5-6: Em (hook repeat, busier answer)
  N.E5, 0, N.G5, N.A5, N.B5, 0, N.A5, N.G5,
  N.A5, N.B5, N.A5, N.G5, N.E5, N.D5, N.E5, N.G5,
  // Bars 7-8: Am, B (turnaround)
  N.A4, 0, N.C5, N.E5, N.A5, 0, N.G5, N.E5,
  N.B4, N.D5, N.Fs5, N.B5, N.Fs5, N.D5, N.B4, 0,

  // === Section B — "The Rush" (scalar runs, relentless) ===
  // Bars 9-10: G, D
  N.G5, N.A5, N.B5, N.A5, N.G5, N.Fs5, N.G5, N.A5,
  N.Fs5, N.G5, N.A5, N.B5, N.A5, N.G5, N.Fs5, N.E5,
  // Bars 11-12: Em, C (big ascending scale)
  N.E5, N.Fs5, N.G5, N.A5, N.G5, N.Fs5, N.E5, N.D5,
  N.C5, N.D5, N.E5, N.Fs5, N.G5, N.A5, N.B5, N.C6,
  // Bars 13-14: G, D (cascading 3-note groups)
  N.B5, N.A5, N.G5, N.B5, N.A5, N.G5, N.Fs5, N.G5,
  N.A5, N.G5, N.Fs5, N.A5, N.G5, N.Fs5, N.E5, N.Fs5,
  // Bars 15-16: Am, B (descending echo, dramatic pause)
  N.E5, N.D5, N.C5, N.E5, N.D5, N.C5, N.B4, N.C5,
  N.D5, N.E5, N.Fs5, N.G5, N.A5, N.B5, 0, 0,

  // === Section C — "The Powder" (sparse breakdown, building) ===
  // Bars 17-18: C, G (isolated echoes)
  N.C5, 0, 0, N.E5, 0, 0, N.G5, 0,
  N.B4, 0, 0, N.D5, 0, 0, N.G5, 0,
  // Bars 19-20: Am, Em (filling in)
  N.A4, 0, 0, N.C5, 0, N.E5, 0, N.A5,
  N.G4, 0, N.B4, 0, N.E5, 0, N.G5, 0,
  // Bars 21-22: C, D (getting busier)
  N.C5, N.E5, 0, N.G5, N.A5, 0, N.G5, N.E5,
  N.D5, N.Fs5, 0, N.A5, N.B5, 0, N.A5, N.Fs5,
  // Bars 23-24: Em, Em (rebuild into climax)
  N.E5, N.G5, N.B5, 0, N.A5, N.G5, N.E5, 0,
  N.E5, N.Fs5, N.G5, N.A5, N.B5, N.A5, N.G5, N.E5,

  // === Section D — "Full Send" (climax, peak energy) ===
  // Bars 25-26: Em, G (hook + cascade hybrid)
  N.E5, 0, N.G5, N.A5, N.B5, N.A5, N.G5, N.A5,
  N.B5, N.A5, N.G5, N.B5, N.A5, N.G5, N.Fs5, N.G5,
  // Bars 27-28: C, D (reaching peak, breathing)
  N.C5, N.E5, N.G5, N.A5, N.G5, N.E5, N.C6, N.B5,
  N.A5, N.B5, N.A5, N.G5, N.Fs5, N.G5, N.A5, 0,
  // Bars 29-30: Am, C (highest energy)
  N.A5, 0, N.C6, N.B5, N.A5, N.G5, N.B5, N.C6,
  N.C6, N.B5, N.A5, N.G5, N.E5, N.G5, N.A5, N.B5,
  // Bars 31-32: D, Em (long descent, final hit)
  N.A5, N.B5, N.C6, N.B5, N.A5, N.G5, N.Fs5, N.E5,
  N.E5, N.G5, N.B5, 0, 0, 0, 0, 0,
];

// 32-bar bass line (128 quarter notes)
const BASS: number[] = [
  // === Section A ===
  N.E3, N.E3, N.E3, N.E3,   N.E3, N.E3, N.B3, N.B3,
  N.C3, N.C3, N.G3, N.G3,   N.D3, N.D3, N.A3, N.D3,
  N.E3, N.E3, N.E3, N.E3,   N.E3, N.E3, N.B3, N.B3,
  N.A3, N.A3, N.E3, N.E3,   N.B3, N.B3, N.Fs3, N.B3,
  // === Section B ===
  N.G3, N.G3, N.D3, N.D3,   N.D3, N.D3, N.A3, N.A3,
  N.E3, N.E3, N.B3, N.B3,   N.C3, N.C3, N.G3, N.G3,
  N.G3, N.G3, N.D3, N.D3,   N.D3, N.D3, N.A3, N.A3,
  N.A3, N.A3, N.E3, N.E3,   N.B3, N.B3, N.Fs3, N.B3,
  // === Section C ===
  N.C3, N.C3, N.C3, N.C3,   N.G3, N.G3, N.G3, N.G3,
  N.A3, N.A3, N.A3, N.A3,   N.E3, N.E3, N.E3, N.E3,
  N.C3, N.C3, N.C3, N.G3,   N.D3, N.D3, N.D3, N.A3,
  N.E3, N.E3, N.E3, N.B3,   N.E3, N.E3, N.E3, N.E3,
  // === Section D ===
  N.E3, N.E3, N.E3, N.B3,   N.G3, N.G3, N.G3, N.D3,
  N.C3, N.C3, N.C3, N.G3,   N.D3, N.D3, N.D3, N.A3,
  N.A3, N.A3, N.A3, N.E3,   N.C3, N.C3, N.C3, N.G3,
  N.D3, N.D3, N.D3, N.A3,   N.E3, N.E3, N.E3, N.E3,
];

// Drum patterns (16 sixteenths per bar): K=kick, S=snare, H=hihat, _=rest
const DRUM_BASIC  = "K_H_S_H_K_H_S_HH";
const DRUM_DRIVE  = "K_HKS_H_K_HKS_HH";
const DRUM_SPARSE = "K_____S_____K_S_";
const DRUM_FILL   = "KHKHS_HHKHKHS_KS";

// Per-bar drum pattern map (32 bars)
const DRUM_MAP: string[] = [
  // Section A — steady groove, fill at turnaround
  DRUM_BASIC, DRUM_BASIC, DRUM_BASIC, DRUM_BASIC,
  DRUM_BASIC, DRUM_BASIC, DRUM_DRIVE, DRUM_FILL,
  // Section B — driving throughout, fill into breakdown
  DRUM_DRIVE, DRUM_DRIVE, DRUM_DRIVE, DRUM_DRIVE,
  DRUM_DRIVE, DRUM_DRIVE, DRUM_DRIVE, DRUM_FILL,
  // Section C — sparse breakdown, builds back
  DRUM_SPARSE, DRUM_SPARSE, DRUM_SPARSE, DRUM_SPARSE,
  DRUM_BASIC, DRUM_BASIC, DRUM_BASIC, DRUM_FILL,
  // Section D — full energy, fill at end
  DRUM_DRIVE, DRUM_DRIVE, DRUM_DRIVE, DRUM_DRIVE,
  DRUM_DRIVE, DRUM_DRIVE, DRUM_FILL, DRUM_BASIC,
];

export class AudioManager {
  private ctx: AudioContext;
  private master: GainNode;
  private musicGain: GainNode;
  private sfxGain: GainNode;

  // Volume control
  private _musicVol = 0.5;
  private _sfxVol = 0.6;
  private _musicMuted = false;
  private _sfxMuted = false;

  // Continuous SFX
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private carvingSource: AudioBufferSourceNode | null = null;
  private carvingGain: GainNode | null = null;
  private carvingFilter: BiquadFilterNode | null = null;

  // Music loop
  private musicPlaying = false;
  private musicTimeoutId = 0;
  private nextLoopTime = 0;

  // Cached noise buffers
  private snareBuffer: AudioBuffer;
  private hihatBuffer: AudioBuffer;

  constructor() {
    this.ctx = new AudioContext();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.25;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.6;
    this.sfxGain.connect(this.master);

    this.snareBuffer = this.createNoiseBuffer(0.1);
    this.hihatBuffer = this.createNoiseBuffer(0.05);
  }

  // --- Music ---

  playTitleJingle(): void {
    const now = this.ctx.currentTime;
    const notes = [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5, N.C6];
    const noteLen = 0.12;

    notes.forEach((freq, i) => {
      this.playNote(freq, "square", 0.1, noteLen * 1.8, now + i * noteLen, this.musicGain);
    });

    // Sustained chord
    const chordTime = now + notes.length * noteLen;
    [N.C5, N.E5, N.G5].forEach((freq) => {
      this.playNote(freq, "triangle", 0.08, 1.0, chordTime, this.musicGain);
    });
  }

  startGameplayMusic(): void {
    this.musicGain.gain.setValueAtTime(this._musicMuted ? 0 : this._musicVol, this.ctx.currentTime);
    this.musicPlaying = true;
    this.nextLoopTime = 0;
    this.scheduleLoop();
  }

  fadeOutMusic(duration = 2): void {
    this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    setTimeout(() => {
      this.musicPlaying = false;
      if (this.musicTimeoutId) {
        clearTimeout(this.musicTimeoutId);
        this.musicTimeoutId = 0;
      }
    }, duration * 1000);
  }

  private scheduleLoop(): void {
    if (!this.musicPlaying) return;

    const start = this.nextLoopTime > this.ctx.currentTime
      ? this.nextLoopTime
      : this.ctx.currentTime + 0.05;
    const loopDuration = this.scheduleMusicBars(start);
    this.nextLoopTime = start + loopDuration;

    const timeUntilEnd = this.nextLoopTime - this.ctx.currentTime;
    this.musicTimeoutId = window.setTimeout(
      () => this.scheduleLoop(),
      Math.max(100, (timeUntilEnd - 1) * 1000)
    );
  }

  private scheduleMusicBars(start: number): number {
    // Melody (square wave, eighth notes)
    for (let i = 0; i < MELODY.length; i++) {
      if (MELODY[i] > 0) {
        this.playNote(MELODY[i], "square", 0.07, EIGHTH * 0.85, start + i * EIGHTH, this.musicGain);
      }
    }

    // Bass (triangle wave, quarter notes)
    for (let i = 0; i < BASS.length; i++) {
      this.playNote(BASS[i], "triangle", 0.1, BEAT * 0.9, start + i * BEAT, this.musicGain);
    }

    // Drums (per-bar patterns from DRUM_MAP)
    for (let bar = 0; bar < DRUM_MAP.length; bar++) {
      const barStart = start + bar * BEAT * 4;
      const pattern = DRUM_MAP[bar];
      for (let s = 0; s < pattern.length; s++) {
        const drumTime = barStart + s * SIXTEENTH;
        const ch = pattern[s];
        if (ch === "K") this.playKick(drumTime);
        else if (ch === "S") this.playSnare(drumTime);
        else if (ch === "H") this.playHiHat(drumTime);
      }
    }

    return MELODY.length * EIGHTH;
  }

  // --- Continuous SFX ---

  startWind(): void {
    const buffer = this.createNoiseBuffer(2);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.frequency.value = 400;
    this.windFilter.Q.value = 0.5;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;

    // LFO for natural variation
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.25;
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain);
    lfoGain.connect(this.windFilter.frequency);

    noise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.sfxGain);

    noise.start();
    lfo.start();
  }

  updateWind(speed: number): void {
    if (!this.windGain || !this.windFilter) return;
    const t = Math.min(speed / 25, 1);
    this.windGain.gain.setTargetAtTime(t * 0.12, this.ctx.currentTime, 0.1);
    this.windFilter.frequency.setTargetAtTime(300 + t * 1000, this.ctx.currentTime, 0.1);
  }

  startCarving(): void {
    // Real carving sound = broadband friction noise (2-8 kHz hiss), not tonal
    const noiseBuffer = this.createNoiseBuffer(2);
    this.carvingSource = this.ctx.createBufferSource();
    this.carvingSource.buffer = noiseBuffer;
    this.carvingSource.loop = true;

    // Bandpass filter — ski edge scraping snow produces broadband hiss
    this.carvingFilter = this.ctx.createBiquadFilter();
    this.carvingFilter.type = "bandpass";
    this.carvingFilter.frequency.value = 3000;
    this.carvingFilter.Q.value = 0.8;

    this.carvingGain = this.ctx.createGain();
    this.carvingGain.gain.value = 0;

    this.carvingSource.connect(this.carvingFilter);
    this.carvingFilter.connect(this.carvingGain);
    this.carvingGain.connect(this.sfxGain);

    this.carvingSource.start();
  }

  updateCarving(turnAmount: number, speed: number): void {
    if (!this.carvingGain || !this.carvingFilter) return;
    const t = Math.min(turnAmount / 0.4, 1);
    // Volume: louder with harder turns
    this.carvingGain.gain.setTargetAtTime(t * 0.08, this.ctx.currentTime, 0.05);
    // Brightness: higher cutoff at higher speed (more aggressive hiss)
    const speedT = Math.min(speed / 20, 1);
    const freq = 2000 + speedT * 4000; // 2-6 kHz
    this.carvingFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    // Narrower band at high speed = more focused scraping tone
    this.carvingFilter.Q.setTargetAtTime(0.5 + speedT * 1.5, this.ctx.currentTime, 0.1);
  }

  // --- One-shot SFX ---

  playJump(): void {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playLanding(): void {
    const now = this.ctx.currentTime;

    // Thud
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);

    // Snow crunch
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.snareBuffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);
  }

  playCollision(severity: "stumble" | "wipeout"): void {
    const now = this.ctx.currentTime;
    const isWipeout = severity === "wipeout";

    // Layer 1: Deep bass thud (20-300Hz low-passed noise burst)
    const bassBuffer = this.createNoiseBuffer(isWipeout ? 0.4 : 0.2);
    const bass = this.ctx.createBufferSource();
    bass.buffer = bassBuffer;
    const bassFilter = this.ctx.createBiquadFilter();
    bassFilter.type = "lowpass";
    bassFilter.frequency.value = isWipeout ? 200 : 300;
    bassFilter.Q.value = 1.5;
    const bassGain = this.ctx.createGain();
    bassGain.gain.setValueAtTime(isWipeout ? 0.35 : 0.2, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + (isWipeout ? 0.4 : 0.2));
    bass.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.sfxGain);
    bass.start(now);

    // Layer 2: Sub-bass sine impact
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(isWipeout ? 50 : 80, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + (isWipeout ? 0.35 : 0.15));
    subGain.gain.setValueAtTime(isWipeout ? 0.35 : 0.25, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + (isWipeout ? 0.35 : 0.2));
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + (isWipeout ? 0.4 : 0.25));

    // Layer 3: Crunch/scrape texture (2-5kHz bandpass noise)
    const crunchBuffer = this.createNoiseBuffer(isWipeout ? 0.3 : 0.15);
    const crunch = this.ctx.createBufferSource();
    crunch.buffer = crunchBuffer;
    const crunchFilter = this.ctx.createBiquadFilter();
    crunchFilter.type = "bandpass";
    crunchFilter.frequency.value = 3500;
    crunchFilter.Q.value = 1.0;
    const crunchGain = this.ctx.createGain();
    crunchGain.gain.setValueAtTime(isWipeout ? 0.18 : 0.12, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + (isWipeout ? 0.25 : 0.12));
    crunch.connect(crunchFilter);
    crunchFilter.connect(crunchGain);
    crunchGain.connect(this.sfxGain);
    crunch.start(now);

    if (isWipeout) {
      // Layer 4: Extended sliding scrape tail (wipeout only)
      const slideBuffer = this.createNoiseBuffer(0.8);
      const slide = this.ctx.createBufferSource();
      slide.buffer = slideBuffer;
      const slideFilter = this.ctx.createBiquadFilter();
      slideFilter.type = "bandpass";
      slideFilter.frequency.setValueAtTime(600, now + 0.15);
      slideFilter.frequency.exponentialRampToValueAtTime(200, now + 0.8);
      slideFilter.Q.value = 2;
      const slideGain = this.ctx.createGain();
      slideGain.gain.setValueAtTime(0.12, now + 0.15);
      slideGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      slide.connect(slideFilter);
      slideFilter.connect(slideGain);
      slideGain.connect(this.sfxGain);
      slide.start(now + 0.15);
      slide.stop(now + 0.85);
    }
  }

  playStartCountdown(onGo: () => void): void {
    const now = this.ctx.currentTime;

    // 3 low beeps at 1-second intervals
    for (let i = 0; i < 3; i++) {
      this.playNote(440, "square", 0.15, 0.15, now + i * 1.0, this.sfxGain);
    }

    // Long high GO beep
    this.playNote(880, "square", 0.18, 0.7, now + 3.0, this.sfxGain);

    setTimeout(onGo, 3000);
  }

  playCoinPickup(): void {
    const now = this.ctx.currentTime;
    // Bright ascending chime: E5 → B5 → E6
    const notes = [N.E5, N.B5, N.C6];
    notes.forEach((freq, i) => {
      const t = now + i * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i < 2 ? "square" : "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  playFinishFanfare(): void {
    const now = this.ctx.currentTime;
    const fanfare = [N.C5, N.E5, N.G5, N.C6];
    const beatLen = 0.15;

    fanfare.forEach((freq, i) => {
      this.playNote(freq, "square", 0.1, beatLen * 2, now + i * beatLen, this.sfxGain);
      this.playNote(freq * 0.5, "triangle", 0.08, beatLen * 2, now + i * beatLen, this.sfxGain);
    });

    // Sustained major chord
    const chordTime = now + fanfare.length * beatLen + 0.1;
    [N.C5, N.E5, N.G5, N.C6].forEach((freq) => {
      this.playNote(freq, "square", 0.06, 1.2, chordTime, this.sfxGain);
    });
  }

  // --- Volume control ---

  setMusicVolume(v: number): void {
    this._musicVol = v;
    if (!this._musicMuted) {
      this.musicGain.gain.value = v;
    }
  }

  setSfxVolume(v: number): void {
    this._sfxVol = v;
    if (!this._sfxMuted) {
      this.sfxGain.gain.value = v;
    }
  }

  getMusicVolume(): number { return this._musicVol; }
  getSfxVolume(): number { return this._sfxVol; }

  setMusicMuted(muted: boolean): void {
    this._musicMuted = muted;
    this.musicGain.gain.value = muted ? 0 : this._musicVol;
  }

  setSfxMuted(muted: boolean): void {
    this._sfxMuted = muted;
    this.sfxGain.gain.value = muted ? 0 : this._sfxVol;
  }

  isMusicMuted(): boolean { return this._musicMuted; }
  isSfxMuted(): boolean { return this._sfxMuted; }

  suspend(): void { this.ctx.suspend(); }
  resume(): void { this.ctx.resume(); }

  // --- Helpers ---

  private playNote(
    freq: number, type: OscillatorType, vol: number, dur: number,
    time: number, dest: AudioNode
  ): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(dest);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.01);
    gain.gain.setValueAtTime(vol, time + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  private playKick(time: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.1);
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  private playSnare(time: number): void {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.snareBuffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1000;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    noise.start(time);
    noise.stop(time + 0.1);
  }

  private playHiHat(time: number): void {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.hihatBuffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 5000;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    noise.start(time);
    noise.stop(time + 0.05);
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
