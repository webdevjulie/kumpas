import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyStaticLetter } from '../src/staticAlphabet.js';

function handshape({ extended = [] } = {}) {
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

test('previews the clear four-finger B handshape', () => {
  assert.equal(classifyStaticLetter(handshape({ extended: [0, 1, 2, 3] })).label, 'B');
});

test('previews an F handshape when the thumb and index fingertip meet', () => {
  const points = handshape({ extended: [1, 2, 3] });
  points[4] = { ...points[8] };

  assert.equal(classifyStaticLetter(points).label, 'F');
});

test('previews an A fist when the thumb extends beside the curled fingers', () => {
  const points = handshape();
  points[3] = { x: 0.46, y: 0.74, z: 0 };
  points[4] = { x: 0.3, y: 0.7, z: 0 };

  assert.equal(classifyStaticLetter(points).label, 'A');
});

test('previews a C handshape with gently curved fingers and an open thumb gap', () => {
  const points = handshape({ extended: [0, 1, 2, 3] });
  [
    { mcp: 5, pip: 6, dip: 7, tip: 8, x: 0.4 },
    { mcp: 9, pip: 10, dip: 11, tip: 12, x: 0.5 },
    { mcp: 13, pip: 14, dip: 15, tip: 16, x: 0.6 },
    { mcp: 17, pip: 18, dip: 19, tip: 20, x: 0.7 }
  ].forEach(({ pip, dip, tip, x }) => {
    points[pip] = { x, y: 0.61, z: 0 };
    points[dip] = { x, y: 0.62, z: 0 };
    points[tip] = { x, y: 0.62, z: 0 };
  });
  points[4] = { x: 0.3, y: 0.5, z: 0 };

  assert.equal(classifyStaticLetter(points).label, 'C');
});

test('does not guess for unsupported or invalid handshapes', () => {
  assert.equal(classifyStaticLetter(handshape()), null);
  assert.equal(classifyStaticLetter([]), null);
});
