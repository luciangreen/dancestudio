import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeCell, Dwell, EDGE, luma, motionGrid } from '../lib/motion.js';

// a w × h grey frame, with a bright block at (x0..x1, y0..y1)
function frame(w, h, block) {
  const f = new Uint8Array(w * h).fill(40);
  if (block) for (let y = block[1]; y < block[3]; y++) for (let x = block[0]; x < block[2]; x++) f[y * w + x] = 220;
  return f;
}

test('grey levels from RGBA', () => {
  assert.deepEqual([...luma(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255]))], [255, 0, 76]);
});

test('movement in the camera’s left third lights the right cells when mirrored', () => {
  const w = 30;
  const h = 30;
  const a = frame(w, h);
  const b = frame(w, h, [0, 0, 10, 10]); // top left of the camera picture
  const mirrored = motionGrid(a, b, w, h);
  assert.equal(mirrored[2], 1); // top right as you see it
  assert.equal(mirrored[0], 0);
  const plain = motionGrid(a, b, w, h, { mirror: false });
  assert.equal(plain[0], 1);
  assert.equal(EDGE.length, 8);
  assert.ok(!EDGE.includes(4));
});

test('the active cell must stand out; whole-body or lighting changes choose nothing', () => {
  const e = [0, 0, 0.4, 0, 0.9, 0.05, 0, 0, 0];
  assert.equal(activeCell(e), 2); // the middle (4) is ignored
  assert.equal(activeCell([0.2, 0, 0.25, 0, 0, 0, 0, 0, 0]), -1); // two cells close together
  assert.equal(activeCell([0, 0, 0.05, 0, 0, 0, 0, 0, 0]), -1); // too small
  assert.equal(activeCell(Array(9).fill(0.5)), -1); // everything changed
});

test('dwell chooses after holding, forgives flicker, then cools down', () => {
  const d = new Dwell({ hold: 1000, grace: 300, cooldown: 500 });
  assert.equal(d.update(2, 0).progress, 0);
  assert.equal(d.update(-1, 200).target, 2); // a short gap keeps it
  assert.ok(Math.abs(d.update(2, 500).progress - 0.5) < 1e-9);
  assert.equal(d.update(5, 600).progress, 0); // moved to another cell: starts again
  assert.equal(d.update(5, 1500).chosen, null);
  assert.equal(d.update(5, 1600).chosen, 5);
  assert.equal(d.update(5, 1800).target, null); // cooling down
  d.update(5, 2200);
  assert.equal(d.update(-1, 2450).target, 5); // within grace
  assert.equal(d.update(-1, 2200 + 301).target, null); // gap too long: forgotten
});
