import assert from 'node:assert/strict';
import test from 'node:test';
import { describeHandFeatures, extractHandFeatures } from '../src/featureExtraction.js';

function hand() {
  return Array.from({ length: 21 }, (_, index) => ({
    x: 0.3 + (index % 4) * 0.05,
    y: 0.7 - Math.floor(index / 4) * 0.04,
    z: index * 0.001
  }));
}

test('describes live landmark ratios, flexion, centroid, scale, and padded vector length', () => {
  const landmarks = hand();
  const summary = describeHandFeatures([landmarks]);

  assert.equal(summary.featureVectorLength, extractHandFeatures([landmarks]).length);
  assert.equal(summary.featureVectorLength, 126);
  assert.equal(summary.ratios.length, 5);
  assert.equal(summary.flexion.length, 5);
  assert.equal(summary.centroid.length, 3);
  assert.ok(Number.isFinite(summary.scale));
});
