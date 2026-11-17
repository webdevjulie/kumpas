export function extractHandFeatures(hands) {
  if (!Array.isArray(hands) || hands.length < 1 || hands.length > 2
    || !hands.every(hand => hand.length === 21
      && hand.every(point => [point.x, point.y, point.z].every(Number.isFinite)))) {
    throw new Error('One or two complete 21-point hand landmark sets are required.');
  }

  const orderedHands = [...hands].sort((a, b) => a[0].x - b[0].x);
  const center = orderedHands.reduce((sum, hand) => [
    sum[0] + hand[0].x,
    sum[1] + hand[0].y,
    sum[2] + hand[0].z
  ], [0, 0, 0]).map(value => value / orderedHands.length);
  const palmScale = orderedHands.reduce((sum, hand) =>
    sum + Math.hypot(hand[9].x - hand[0].x, hand[9].y - hand[0].y), 0
  ) / orderedHands.length;
  if (!Number.isFinite(palmScale) || palmScale < 1e-6) {
    throw new Error('Hand landmarks are too close together to normalize.');
  }

  const features = orderedHands.flatMap(hand => hand.flatMap(point => [
    (point.x - center[0]) / palmScale,
    (point.y - center[1]) / palmScale,
    (point.z - center[2]) / palmScale
  ]));
  if (orderedHands.length === 1) features.push(...Array(63).fill(0));
  return features;
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function flexionAngle(a, joint, c) {
  const first = [a.x - joint.x, a.y - joint.y, a.z - joint.z];
  const second = [c.x - joint.x, c.y - joint.y, c.z - joint.z];
  const firstLength = Math.hypot(...first);
  const secondLength = Math.hypot(...second);
  if (firstLength < 1e-8 || secondLength < 1e-8) return 0;
  const cosine = first.reduce((sum, value, index) => sum + value * second[index], 0)
    / (firstLength * secondLength);
  return 180 - Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

export function describeHandFeatures(hands) {
  const featureVectorLength = extractHandFeatures(hands).length;
  const scale = hands.reduce((sum, hand) => sum + distance(hand[0], hand[9]), 0) / hands.length;
  const centroid = hands.flat().reduce((sum, point) => [
    sum[0] + point.x,
    sum[1] + point.y,
    sum[2] + point.z
  ], [0, 0, 0]).map(value => value / (hands.length * 21));

  const fingerDefinitions = [
    { name: 'Thumb', tip: 4, base: 2, points: [2, 3, 4] },
    { name: 'Index', tip: 8, base: 5, points: [5, 6, 7] },
    { name: 'Middle', tip: 12, base: 9, points: [9, 10, 11] },
    { name: 'Ring', tip: 16, base: 13, points: [13, 14, 15] },
    { name: 'Pinky', tip: 20, base: 17, points: [17, 18, 19] }
  ];
  const ratios = fingerDefinitions.map(({ tip, base }) =>
    hands.reduce((sum, hand) => sum + distance(hand[tip], hand[0]) / distance(hand[base], hand[0]), 0)
      / hands.length
  );
  const flexion = fingerDefinitions.map(({ points }) =>
    hands.reduce((sum, hand) =>
      sum + flexionAngle(hand[points[0]], hand[points[1]], hand[points[2]]), 0
    ) / hands.length
  );

  return { scale, centroid, featureVectorLength, ratios, flexion };
}
