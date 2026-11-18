import { classifyStaticLetter } from './staticAlphabet.js';

export const TEMPORAL_STEPS = 12;
export const DYNAMIC_WINDOW_FRAMES = 24;

export function extractTemporalFeatures(sequence, motionSequence = []) {
  if (!Array.isArray(sequence) || sequence.length < 3 || !Array.isArray(sequence[0])) {
    throw new Error('Capture at least three tracked frames for a dynamic sample.');
  }
  const dimension = sequence[0].length;
  if (!sequence.every(frame => Array.isArray(frame)
    && frame.length === dimension && frame.every(Number.isFinite))) {
    throw new Error('Dynamic sample contains inconsistent landmark features.');
  }
  if (!Array.isArray(motionSequence) || (motionSequence.length
    && (motionSequence.length !== sequence.length
      || !motionSequence.every(point => Array.isArray(point)
        && point.length === 3 && point.every(Number.isFinite))))) {
    throw new Error('Dynamic sample contains inconsistent hand-motion data.');
  }

  const origin = motionSequence[0];
  const motionScale = motionSequence.length
    ? motionSequence.reduce((sum, point) => sum + point[2], 0) / motionSequence.length
    : 1;
  if (!Number.isFinite(motionScale) || motionScale < 1e-6) {
    throw new Error('Dynamic sample has an invalid hand-motion scale.');
  }

  const sampled = [];
  for (let step = 0; step < TEMPORAL_STEPS; step += 1) {
    const position = step * (sequence.length - 1) / (TEMPORAL_STEPS - 1);
    const left = Math.floor(position);
    const right = Math.min(Math.ceil(position), sequence.length - 1);
    const fraction = position - left;
    const frame = sequence[left].map((value, index) =>
      value + (sequence[right][index] - value) * fraction
    );
    if (motionSequence.length) {
      const x = motionSequence[left][0]
        + (motionSequence[right][0] - motionSequence[left][0]) * fraction;
      const y = motionSequence[left][1]
        + (motionSequence[right][1] - motionSequence[left][1]) * fraction;
      frame[0] += (x - origin[0]) / motionScale;
      frame[1] += (y - origin[1]) / motionScale;
    }
    sampled.push(...frame);
  }
  return sampled;
}

export function classifyDynamicLetter(features) {
  if (!Array.isArray(features) || features.length !== TEMPORAL_STEPS * 126
    || !features.every(Number.isFinite)) return null;

  const startingShapes = Array.from({ length: 4 }, (_, step) => {
    const offset = step * 126;
    const wristX = features[offset];
    const wristY = features[offset + 1];
    const hand = Array.from({ length: 21 }, (_, index) => ({
      x: features[offset + index * 3] - wristX,
      y: features[offset + index * 3 + 1] - wristY,
      z: features[offset + index * 3 + 2]
    }));
    return classifyStaticLetter(hand)?.label;
  });
  const trajectory = (tip, startStep) => Array.from({ length: TEMPORAL_STEPS }, (_, step) => {
    const position = startStep + step * (TEMPORAL_STEPS - 1 - startStep)
      / (TEMPORAL_STEPS - 1);
    const left = Math.floor(position);
    const right = Math.min(Math.ceil(position), TEMPORAL_STEPS - 1);
    const fraction = position - left;
    const leftOffset = left * 126;
    const rightOffset = right * 126;
    const coordinate = (point, axis) => {
      const featureIndex = axis === 'x' ? 0 : 1;
      const pointIndex = point * 3 + featureIndex;
      return features[leftOffset + pointIndex]
        + (features[rightOffset + pointIndex] - features[leftOffset + pointIndex]) * fraction;
    };
    return {
      x: coordinate(0, 'x') + coordinate(tip, 'x'),
      y: coordinate(0, 'y') + coordinate(tip, 'y')
    };
  });
  const range = points => ({
    x: Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x)),
    y: Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y))
  });

  const iStart = startingShapes.indexOf('I');
  if (iStart !== -1) {
    const pinky = trajectory(20, iStart);
    const movement = pinky.slice(1).reduce((sum, point, index) =>
      sum + Math.hypot(point.x - pinky[index].x, point.y - pinky[index].y), 0
    );
    const pinkyRange = range(pinky);
    if (movement > 0.65 && pinkyRange.x > 0.28 && pinkyRange.y > 0.35) {
      return { label: 'J', matchScore: 0.75 };
    }
  }

  const dStart = startingShapes.indexOf('D');
  if (dStart !== -1) {
    const index = trajectory(8, dStart);
    const firstStroke = index[3].x - index[0].x;
    const middleStroke = index[7].x - index[4].x;
    const finalStroke = index[11].x - index[8].x;
    const diagonal = index[7].y - index[4].y;
    if (Math.abs(firstStroke) > 0.25 && Math.abs(middleStroke) > 0.25
      && Math.abs(finalStroke) > 0.25 && Math.abs(diagonal) > 0.2
      && Math.sign(firstStroke) === Math.sign(finalStroke)
      && Math.sign(firstStroke) !== Math.sign(middleStroke)) {
      return { label: 'Z', matchScore: 0.75 };
    }
  }

  return null;
}
