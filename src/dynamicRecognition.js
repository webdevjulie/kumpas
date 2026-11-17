const TEMPORAL_STEPS = 12;

export function extractTemporalFeatures(sequence) {
  if (!Array.isArray(sequence) || sequence.length < 3) {
    throw new Error('Capture at least three tracked frames for a dynamic sample.');
  }
  const dimension = sequence[0].length;
  if (!sequence.every(frame => frame.length === dimension && frame.every(Number.isFinite))) {
    throw new Error('Dynamic sample contains inconsistent landmark features.');
  }

  const sampled = [];
  for (let step = 0; step < TEMPORAL_STEPS; step += 1) {
    const position = step * (sequence.length - 1) / (TEMPORAL_STEPS - 1);
    const left = Math.floor(position);
    const right = Math.min(Math.ceil(position), sequence.length - 1);
    const fraction = position - left;
    sampled.push(...sequence[left].map((value, index) =>
      value + (sequence[right][index] - value) * fraction
    ));
  }
  return sampled;
}
