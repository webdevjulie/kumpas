import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMON_FSL_SIGNS, getDefaultSignType } from '../src/signLabels.js';

test('provides the common FSL labels and defaults them to dynamic recognition', () => {
  assert.deepEqual(COMMON_FSL_SIGNS, [
    'Kumusta',
    'Salamat',
    'Oo',
    'Hindi',
    'Pakiusap',
    'Paumanhin',
    'Paalam',
    'Mahal kita',
    'Tulong',
    'Magandang umaga',
    'Magandang gabi'
  ]);
  assert.ok(COMMON_FSL_SIGNS.every(label => getDefaultSignType(label) === 'dynamic'));
});

test('keeps alphabet letters static except motion letters J and Z', () => {
  assert.equal(getDefaultSignType('A'), 'static');
  assert.equal(getDefaultSignType('Ñ'), 'static');
  assert.equal(getDefaultSignType('J'), 'dynamic');
  assert.equal(getDefaultSignType('Z'), 'dynamic');
  assert.equal(getDefaultSignType('Custom FSL sign'), 'static');
});
