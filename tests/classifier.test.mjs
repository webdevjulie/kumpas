import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  addSample, classify, evaluateHeldOutSamples, hasTrainableSamples, importSamples,
  splitSamples
} from '../src/classifier.js';

let storedSamples;

beforeEach(() => {
  storedSamples = null;
  globalThis.localStorage = {
    getItem: () => storedSamples,
    setItem: (_key, value) => { storedSamples = value; },
    removeItem: () => { storedSamples = null; }
  };
});

function addSamples(label, values) {
  values.forEach(value => addSample('static', label, [value]));
}

test('requires at least three examples for every label', () => {
  addSamples('A', [0.1, 0.2]);
  addSamples('B', [1, 1.1, 1.2]);

  assert.equal(hasTrainableSamples('static'), false);
  assert.equal(classify('static', [0]), null);
});

test('returns a KNN label only with a strict majority', () => {
  addSamples('A', [0.1, 0.9, 1.8]);
  addSamples('B', [0.2, 0.3, 1.9]);

  assert.deepEqual(classify('static', [0]), {
    label: 'B',
    votes: 2,
    neighborCount: 3,
    agreement: 2 / 3
  });
});

test('rejects a three-way nearest-neighbor tie', () => {
  addSamples('A', [0.1, 1, 1.1]);
  addSamples('B', [0.2, 1.2, 1.3]);
  addSamples('C', [0.3, 1.4, 1.5]);

  assert.equal(classify('static', [0]), null);
});

test('keeps test samples out of training and evaluates held-out examples', () => {
  addSamples('A', [0.1, 0.11, 0.12, 0.13]);
  addSamples('B', [10, 10.1, 10.2, 10.3]);

  const split = splitSamples(0.75);
  const evaluation = evaluateHeldOutSamples('static');

  assert.equal(split.training, 6);
  assert.equal(split.testing, 2);
  assert.equal(hasTrainableSamples('static'), true);
  assert.equal(evaluation.accuracy, 100);
  assert.equal(evaluation.correct, 2);
});

test('preserves labels that are too small to split into train and test', () => {
  addSamples('A', [0.1, 0.2, 0.3]);

  const split = splitSamples(0.8);

  assert.equal(split.training, 3);
  assert.equal(split.testing, 0);
  assert.equal(hasTrainableSamples('static'), true);
});

test('imports validated samples and rejects malformed sample data', () => {
  const total = importSamples([{
    kind: 'dynamic',
    label: 'J',
    features: [0.1, 0.2],
    split: 'train',
    condition: 'Bright light'
  }]);

  assert.equal(total, 1);
  assert.equal(classify('dynamic', [0.1, 0.2]), null);
  assert.throws(() => importSamples([{ kind: 'static', label: '', features: [] }]), /invalid data/i);
});

test('never uses held-out test samples as KNN neighbors', () => {
  importSamples([
    ...[0, 0.1, 0.2].map(value => ({ kind: 'static', label: 'A', features: [value], split: 'train' })),
    ...[10, 10.1, 10.2].map(value => ({ kind: 'static', label: 'B', features: [value], split: 'train' })),
    ...[9.9, 10, 10.2].map(value => ({ kind: 'static', label: 'A', features: [value], split: 'test' }))
  ]);

  assert.equal(classify('static', [10]).label, 'B');
});
