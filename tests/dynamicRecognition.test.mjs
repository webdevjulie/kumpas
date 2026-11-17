import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyDynamicLetter, extractTemporalFeatures, TEMPORAL_STEPS
} from '../src/dynamicRecognition.js';

const poseFrames = () => Array.from(
  { length: TEMPORAL_STEPS },
  () => Array(126).fill(0)
);

function handshape(extended) {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7, z: 0 }));
  points[0] = { x: 0.5, y: 0.85, z: 0 };
  const fingers = [
    { mcp: 5, pip: 6, dip: 7, tip: 8, x: 0.4 },
    { mcp: 9, pip: 10, dip: 11, tip: 12, x: 0.5 },
    { mcp: 13, pip: 14, dip: 15, tip: 16, x: 0.6 },
    { mcp: 17, pip: 18, dip: 19, tip: 20, x: 0.7 }
  ];

  fingers.forEach((finger, index) => {
    points[finger.mcp] = { x: finger.x, y: 0.62, z: 0 };
    const yValues = extended.includes(index)
      ? [0.48, 0.34, 0.2]
      : [0.66, 0.75, 0.79];
    [finger.pip, finger.dip, finger.tip].forEach((pointIndex, segment) => {
      points[pointIndex] = { x: finger.x, y: yValues[segment], z: 0 };
    });
  });

  points[1] = { x: 0.46, y: 0.74, z: 0 };
  points[2] = { x: 0.44, y: 0.68, z: 0 };
  points[3] = { x: 0.46, y: 0.7, z: 0 };
  points[4] = { x: 0.45, y: 0.69, z: 0 };
  return points;
}

function dynamicFeatures(hand, path) {
  const wrist = hand[0];
  const scale = Math.hypot(hand[9].x - wrist.x, hand[9].y - wrist.y);
  const frame = Array(126).fill(0);
  hand.forEach((point, index) => {
    frame[index * 3] = (point.x - wrist.x) / scale;
    frame[index * 3 + 1] = (point.y - wrist.y) / scale;
    frame[index * 3 + 2] = (point.z - wrist.z) / scale;
  });
  const poses = Array.from({ length: TEMPORAL_STEPS }, () => [...frame]);
  const motion = path.map(([x, y]) => [wrist.x + x * scale, wrist.y + y * scale, scale]);
  return extractTemporalFeatures(poses, motion);
}

test('encodes the normalized wrist path in temporal features', () => {
  const motion = Array.from({ length: TEMPORAL_STEPS }, (_, step) => [
    0.2 + step * 0.01,
    0.4,
    0.1
  ]);
  const features = extractTemporalFeatures(poseFrames(), motion);
  const finalFrameOffset = (TEMPORAL_STEPS - 1) * 126;

  assert.equal(features.length, TEMPORAL_STEPS * 126);
  assert.equal(features[0], 0);
  assert.ok(Math.abs(features[finalFrameOffset] - 1.1) < 1e-10);
  assert.equal(features[finalFrameOffset + 1], 0);
});

test('keeps stationary motion equivalent to pose-only temporal features', () => {
  const poses = poseFrames();
  const motion = Array.from({ length: TEMPORAL_STEPS }, () => [0.4, 0.6, 0.1]);

  assert.deepEqual(
    extractTemporalFeatures(poses, motion),
    extractTemporalFeatures(poses)
  );
});

test('rejects motion data that does not match the pose frames', () => {
  assert.throws(
    () => extractTemporalFeatures(poseFrames(), [[0.4, 0.6, 0.1]]),
    /inconsistent hand-motion data/i
  );
});

test('previews J from an I handshape and a hooked pinky path', () => {
  const path = [
    [0, 0], [0.02, -0.1], [0.05, -0.2], [0.1, -0.3],
    [0.1, -0.4], [0, -0.45], [-0.1, -0.4], [-0.2, -0.3],
    [-0.3, -0.2], [-0.3, -0.1], [-0.25, 0], [-0.2, 0.1]
  ];

  assert.equal(classifyDynamicLetter(dynamicFeatures(handshape([3]), path)).label, 'J');
});

test('previews Z from a D handshape and a three-stroke index path', () => {
  const path = [
    [0, 0], [0.15, 0], [0.3, 0], [0.45, 0],
    [0.35, 0.1], [0.2, 0.25], [0.05, 0.4], [-0.1, 0.55],
    [0, 0.55], [0.15, 0.55], [0.3, 0.55], [0.45, 0.55]
  ];

  assert.equal(classifyDynamicLetter(dynamicFeatures(handshape([0]), path)).label, 'Z');
});

test('does not preview an unsupported stationary motion', () => {
  assert.equal(classifyDynamicLetter(extractTemporalFeatures(poseFrames())), null);
});
