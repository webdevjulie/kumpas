import { TEMPORAL_STEPS } from './dynamicRecognition.js';

const KEY = 'kumpas_knn_training_v1';
const K = 3;
const MIN_SAMPLES_PER_LABEL = 3;

export function getSamples() {
  const saved = localStorage.getItem(KEY);
  if (!saved) return [];
  const samples = JSON.parse(saved);
  if (!Array.isArray(samples)) throw new Error('Stored training data is not a valid sample list.');
  return samples;
}

export function addSample(kind, label, features, metadata = {}) {
  if (!['static', 'dynamic'].includes(kind)) throw new Error('Choose a valid sign category.');
  if (!label.trim()) throw new Error('Enter a validated FSL label before capturing a sample.');
  if (!Array.isArray(features) || !features.length || !features.every(Number.isFinite)) {
    throw new Error('Cannot save an empty or invalid feature sample.');
  }

  const samples = getSamples();
  samples.push({
    kind,
    label: label.trim(),
    features,
    split: 'train',
    condition: String(metadata.condition ?? '').trim(),
    createdAt: new Date().toISOString()
  });
  localStorage.setItem(KEY, JSON.stringify(samples));
  return samples.length;
}

export function splitSamples(trainingShare = 0.8) {
  if (!Number.isFinite(trainingShare) || trainingShare <= 0 || trainingShare >= 1) {
    throw new Error('Training share must be between 0 and 1.');
  }
  const samples = getSamples();
  if (!samples.length) throw new Error('Add sign samples before splitting the data.');
  const groups = new Map();
  samples.forEach((sample, index) => {
    const key = `${sample.kind}\u0000${sample.label}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  });

  for (const indices of groups.values()) {
    const shuffled = [...indices];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    const trainingCount = shuffled.length > MIN_SAMPLES_PER_LABEL
      ? Math.min(shuffled.length - 1, Math.max(MIN_SAMPLES_PER_LABEL, Math.round(shuffled.length * trainingShare)))
      : shuffled.length;
    shuffled.forEach((sampleIndex, position) => {
      samples[sampleIndex].split = position < trainingCount ? 'train' : 'test';
    });
  }
  localStorage.setItem(KEY, JSON.stringify(samples));
  return {
    training: samples.filter(sample => sample.split !== 'test').length,
    testing: samples.filter(sample => sample.split === 'test').length,
    total: samples.length
  };
}

export function importSamples(imported) {
  if (!Array.isArray(imported) || !imported.length || imported.length > 5000) {
    throw new Error('The imported file must contain between 1 and 5,000 samples.');
  }
  const samples = imported.map((sample, index) => {
    if (!sample || !['static', 'dynamic'].includes(sample.kind)
      || typeof sample.label !== 'string' || !sample.label.trim() || sample.label.length > 100
      || !Array.isArray(sample.features) || !sample.features.length || sample.features.length > 2048
      || !sample.features.every(Number.isFinite)
      || (sample.split != null && !['train', 'test'].includes(sample.split))) {
      throw new Error(`Imported sample ${index + 1} has invalid data.`);
    }
    return {
      kind: sample.kind,
      label: sample.label.trim(),
      features: sample.features,
      split: sample.split ?? 'train',
      condition: typeof sample.condition === 'string' ? sample.condition : '',
      createdAt: typeof sample.createdAt === 'string' ? sample.createdAt : new Date().toISOString()
    };
  });
  const saved = getSamples();
  const merged = [...saved, ...samples];
  localStorage.setItem(KEY, JSON.stringify(merged));
  return merged.length;
}

export function clearSamples() {
  localStorage.removeItem(KEY);
}

export function deleteLabelSamples(kind, label) {
  const samples = getSamples();
  const remaining = samples.filter(sample => sample.kind !== kind || sample.label !== label);
  localStorage.setItem(KEY, JSON.stringify(remaining));
  return samples.length - remaining.length;
}

export function hasTrainableSamples(kind) {
  const counts = new Map();
  for (const sample of getSamples()) {
    if (sample.kind === kind && sample.split !== 'test') {
      counts.set(sample.label, (counts.get(sample.label) ?? 0) + 1);
    }
  }
  return counts.size > 0
    && [...counts.values()].every(count => count >= MIN_SAMPLES_PER_LABEL);
}

function temporalDistance(first, second) {
  const frameSize = first.length / TEMPORAL_STEPS;
  if (!Number.isInteger(frameSize) || second.length !== first.length) return Infinity;

  const costs = Array(TEMPORAL_STEPS + 1).fill(null);
  costs[0] = { total: 0, length: 0 };
  for (let firstStep = 1; firstStep <= TEMPORAL_STEPS; firstStep += 1) {
    const current = Array(TEMPORAL_STEPS + 1).fill(null);
    for (let secondStep = 1; secondStep <= TEMPORAL_STEPS; secondStep += 1) {
      let frameCost = 0;
      const firstOffset = (firstStep - 1) * frameSize;
      const secondOffset = (secondStep - 1) * frameSize;
      for (let feature = 0; feature < frameSize; feature += 1) {
        const difference = first[firstOffset + feature] - second[secondOffset + feature];
        frameCost += difference * difference;
      }
      frameCost = Math.sqrt(frameCost / frameSize);

      const previous = [
        costs[secondStep],
        current[secondStep - 1],
        costs[secondStep - 1]
      ].filter(Boolean).sort((a, b) => a.total - b.total)[0];
      if (previous) {
        current[secondStep] = {
          total: previous.total + frameCost,
          length: previous.length + 1
        };
      }
    }
    costs.splice(0, costs.length, ...current);
  }

  const result = costs[TEMPORAL_STEPS];
  return result ? result.total / result.length : Infinity;
}

function classifyFromSamples(samples, features, kind) {
  const compatibleSamples = samples.filter(sample => sample.features.length === features.length);
  const counts = new Map();
  for (const sample of compatibleSamples) {
    counts.set(sample.label, (counts.get(sample.label) ?? 0) + 1);
  }
  if (!counts.size || [...counts.values()].some(count => count < MIN_SAMPLES_PER_LABEL)) return null;

  const nearest = compatibleSamples
    .map(sample => ({
      label: sample.label,
      distance: kind === 'dynamic'
        ? temporalDistance(sample.features, features)
        : Math.sqrt(sample.features.reduce((sum, value, index) => {
          const difference = value - features[index];
          return sum + difference * difference;
        }, 0))
    }))
    .filter(sample => Number.isFinite(sample.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, K);
  if (nearest.length < K) return null;

  const votes = new Map();
  for (const neighbor of nearest) {
    const vote = votes.get(neighbor.label) ?? { count: 0, distance: 0 };
    vote.count += 1;
    vote.distance += neighbor.distance;
    votes.set(neighbor.label, vote);
  }

  const [label, winner] = [...votes.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].distance - b[1].distance)[0];
  if (winner.count <= nearest.length / 2) return null;
  return {
    label,
    votes: winner.count,
    neighborCount: nearest.length,
    agreement: winner.count / nearest.length
  };
}

export function classify(kind, features) {
  const trainingSamples = getSamples().filter(sample =>
    sample.kind === kind && sample.split !== 'test'
  );
  return classifyFromSamples(trainingSamples, features, kind);
}

export function evaluateHeldOutSamples(kind = null) {
  const samples = getSamples();
  const trainingSamples = samples.filter(sample =>
    (!kind || sample.kind === kind) && sample.split !== 'test'
  );
  const testingSamples = samples.filter(sample =>
    (!kind || sample.kind === kind) && sample.split === 'test'
  );
  const predictions = testingSamples.map(sample => {
    const result = classifyFromSamples(
      trainingSamples.filter(trainingSample => trainingSample.kind === sample.kind),
      sample.features,
      sample.kind
    );
    return {
      expected: sample.label,
      predicted: result?.label ?? '',
      correct: result?.label === sample.label
    };
  });
  const correct = predictions.filter(result => result.correct).length;
  return {
    total: predictions.length,
    correct,
    rejected: predictions.filter(result => !result.predicted).length,
    accuracy: predictions.length ? correct / predictions.length * 100 : null,
    predictions
  };
}
