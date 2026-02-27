/** Hash-based pseudo-random for 2D noise lattice */
export function hash2D(ix: number, iy: number): number {
  const dot = ix * 12.9898 + iy * 78.233;
  const v = Math.sin(dot) * 43758.5453;
  return v - Math.floor(v);
}

/** 2D value noise with smooth interpolation */
export function noise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash2D(ix, iy);
  const n10 = hash2D(ix + 1, iy);
  const n01 = hash2D(ix, iy + 1);
  const n11 = hash2D(ix + 1, iy + 1);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

/** Fractal Brownian Motion — layers of noise at different scales */
export function fbm2D(x: number, y: number, octaves: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

/** Ridge noise — sharp peaks for mountain ridgelines */
export function ridgeFbm(x: number, y: number, octaves: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    const n = noise2D(x * frequency + i * 31.7, y * frequency + i * 17.3);
    const ridge = 1 - Math.abs(n * 2 - 1);
    value += ridge * ridge * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / maxValue;
}

/** Worley/cellular noise — distance to nearest feature point, creates isolated dips/holes */
export function worley2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let minDist = 2.0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const fpx = cx + hash2D(cx, cy);
      const fpy = cy + hash2D(cy * 17 + 3, cx * 13 + 7);
      const ddx = x - fpx;
      const ddy = y - fpy;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist < minDist) minDist = dist;
    }
  }
  return minDist;
}

/** Deterministic integer hash → 0..1 for tree placement etc. */
export function hash(seed: number): number {
  let h = seed * 2654435761;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = (h >>> 16) ^ h;
  return (h >>> 0) / 0xffffffff;
}
