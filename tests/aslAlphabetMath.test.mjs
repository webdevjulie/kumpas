import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: ['src/aslAlphabetMath.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
});
const { classifyAlphabetLogits, normalizeAslLandmarks } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);

function landmarks(scale = 1, offset = [0, 0, 0]) {
  const points = Array.from({ length: 21 }, (_, index) => ({
    x: offset[0] + index * 0.02 * scale,
    y: offset[1] + index * 0.03 * scale,
    z: offset[2] - index * 0.01 * scale
  }));
  points[0] = { x: offset[0], y: offset[1], z: offset[2] };
  points[9] = { x: offset[0], y: offset[1] + scale, z: offset[2] };
  return points;
}

test('normalizes landmarks relative to the wrist and palm scale', () => {
  const normalized = normalizeAslLandmarks(landmarks());
  const shiftedAndScaled = normalizeAslLandmarks(landmarks(3, [0.4, 0.2, -0.5]));

  assert.equal(normalized.length, 63);
  for (let index = 0; index < normalized.length; index += 1) {
    assert.ok(Math.abs(normalized[index] - shiftedAndScaled[index]) < 1e-6);
  }
  assert.deepEqual(normalizeAslLandmarks([]), null);
});

test('returns only confident letter classes, rejecting digits and ambiguous scores', () => {
  const labels = ['A', 'B', '0'];
  assert.equal(classifyAlphabetLogits([6, 0, -1], labels).label, 'A');
  assert.equal(classifyAlphabetLogits([1, 1, 0], labels), null);
  assert.equal(classifyAlphabetLogits([0, -1, 6], labels), null);
});

test('surfaces invalid model output instead of guessing', () => {
  assert.throws(
    () => classifyAlphabetLogits([1, Number.NaN], ['A', 'B']),
    /invalid class scores/
  );
});
