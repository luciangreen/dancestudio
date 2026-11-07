// Motion from a camera, as energy per cell of a grid, and "dwell" choosing:
// keep moving in one cell (or keep the cursor on a tile) for a moment to choose it.
// Pure functions on plain arrays, so they can be tested without a camera.

// Grey levels (0–255) from RGBA pixels.
export function luma(rgba) {
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  return out;
}

// Fraction of pixels that changed by more than `threshold`, for each cell of a cols × rows grid.
// Cells are numbered row by row as the person sees them: with `mirror`, the picture is
// flipped left-right, like a mirror, so moving your right hand lights the right side.
export function motionGrid(prev, cur, w, h, { cols = 3, rows = 3, threshold = 26, mirror = true } = {}) {
  const counts = new Float64Array(cols * rows);
  const sizes = new Float64Array(cols * rows);
  for (let y = 0; y < h; y++) {
    const r = Math.min(rows - 1, Math.floor((y * rows) / h));
    for (let x = 0; x < w; x++) {
      let c = Math.min(cols - 1, Math.floor((x * cols) / w));
      if (mirror) c = cols - 1 - c;
      const cell = r * cols + c;
      sizes[cell]++;
      const i = y * w + x;
      if (Math.abs(cur[i] - prev[i]) > threshold) counts[cell]++;
    }
  }
  return Array.from(counts, (n, i) => (sizes[i] ? n / sizes[i] : 0));
}

// The 8 cells around the edge of a 3 × 3 grid, clockwise from the top left.
// The middle is left out: that's where you stand, so it always moves.
export const EDGE = [0, 1, 2, 5, 8, 7, 6, 3];

// Which cell you're pointing at with movement, or -1.
// It must pass `min`, and beat the next busiest cell by `lead` times, so swaying
// your whole body (everything moves a bit) doesn't choose anything.
export function activeCell(energy, { cells = EDGE, min = 0.12, lead = 1.5, maxBusy = 0.7 } = {}) {
  // a sudden change everywhere (lights, camera adjusting) is not a gesture
  const busy = energy.filter((e) => e > min).length / energy.length;
  if (busy > maxBusy) return -1;
  let best = -1;
  let second = 0;
  for (const c of cells) {
    const e = energy[c] ?? 0;
    if (best < 0 || e > energy[best]) {
      second = best < 0 ? 0 : energy[best];
      best = c;
    } else if (e > second) second = e;
  }
  if (best < 0 || energy[best] < min) return -1;
  if (second > 0 && energy[best] < second * lead) return -1;
  return best;
}

// Dwell: the same target held for `hold` ms chooses it. Short gaps (`grace` ms) are
// forgiven, because motion flickers. After a choice, nothing is chosen for `cooldown` ms.
export class Dwell {
  constructor({ hold = 1200, grace = 350, cooldown = 900 } = {}) {
    Object.assign(this, { hold, grace, cooldown });
    this.reset();
    this.blockedUntil = 0;
  }
  reset() {
    this.target = null;
    this.since = 0;
    this.lastSeen = 0;
  }
  // target: anything comparable with === (a cell number or tile id), or null for none.
  // Returns { target, progress 0–1, chosen: target | null }.
  update(target, now) {
    if (now < this.blockedUntil) {
      this.reset();
      return { target: null, progress: 0, chosen: null };
    }
    if (target === null || target === undefined || target === -1) {
      if (this.target !== null && now - this.lastSeen > this.grace) this.reset();
      return { target: this.target, progress: this.target === null ? 0 : this.progressAt(now), chosen: null };
    }
    if (target !== this.target) {
      this.target = target;
      this.since = now;
    }
    this.lastSeen = now;
    const progress = this.progressAt(now);
    if (progress >= 1) {
      const chosen = this.target;
      this.reset();
      this.blockedUntil = now + this.cooldown;
      return { target: chosen, progress: 1, chosen };
    }
    return { target: this.target, progress, chosen: null };
  }
  progressAt(now) {
    return Math.min(1, (now - this.since) / this.hold);
  }
}
