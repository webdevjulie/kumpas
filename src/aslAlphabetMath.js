const MIN_CONFIDENCE = 0.55;
const MIN_MARGIN = 0.12;

export function normalizeAslLandmarks(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length !== 21
    || !landmarks.every(point => point
      && [point.x, point.y, point.z].every(Number.isFinite))) return null;

  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const scale = Math.hypot(
    middleMcp.x - wrist.x,
    middleMcp.y - wrist.y,
    middleMcp.z - wrist.z
  );
  if (!Number.isFinite(scale) || scale < 1e-6) return null;

  return Float32Array.from(landmarks.flatMap(point => [
    (point.x - wrist.x) / scale,
    (point.y - wrist.y) / scale,
    (point.z - wrist.z) / scale
  ]));
}

export function classifyAlphabetLogits(logits, classLabels) {
  if (!Array.isArray(classLabels) || classLabels.length < 2 || !logits
    || logits.length !== classLabels.length
    || Array.from(logits).some(score => !Number.isFinite(score))) {
    throw new Error('The alphabet model returned invalid class scores.');
  }

  const maximum = Math.max(...logits);
  const probabilities = Array.from(logits, score => Math.exp(score - maximum));
  const total = probabilities.reduce((sum, score) => sum + score, 0);
  const ranked = probabilities
    .map((probability, index) => ({ index, probability: probability / total }))
    .sort((a, b) => b.probability - a.probability);
  const winner = ranked[0];
  const label = classLabels[winner.index];
  if (typeof label !== 'string' || !/^[A-Z]$/.test(label)
    || winner.probability < MIN_CONFIDENCE
    || winner.probability - ranked[1].probability < MIN_MARGIN) return null;

  return { label, matchScore: winner.probability };
}
