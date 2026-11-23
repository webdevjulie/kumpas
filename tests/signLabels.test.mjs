import assert from 'node:assert/strict';
import test from 'node:test';
import { ALPHABET_LABELS, COMMON_FSL_SIGNS, getDefaultSignType } from '../src/signLabels.js';

test('provides the common FSL labels and defaults them to dynamic recognition', () => {
  assert.deepEqual(COMMON_FSL_SIGNS, [
    'Kamusta',
    'Kumusta',
    'Mabuhay',
    'Magandang araw',
    'Salamat',
    'Maraming salamat',
    'Oo',
    'Hindi',
    'Pakiusap',
    'Paumanhin',
    'Paalam',
    'Mahal kita',
    'Tulong',
    'Magandang umaga',
    'Magandang tanghali',
    'Magandang hapon',
    'Magandang gabi'
  ]);
  assert.ok(COMMON_FSL_SIGNS.every(label => getDefaultSignType(label) === 'dynamic'));
});

test('includes Ñ in the selectable Filipino alphabet labels', () => {
  assert.equal(ALPHABET_LABELS.length, 27);
  assert.equal(ALPHABET_LABELS.at(-1), 'Ñ');
  assert.equal(getDefaultSignType('Ñ'), 'static');
});

test('keeps alphabet letters static except motion letters J and Z', () => {
  assert.equal(getDefaultSignType('A'), 'static');
  assert.equal(getDefaultSignType('J'), 'dynamic');
  assert.equal(getDefaultSignType('Z'), 'dynamic');
  assert.equal(getDefaultSignType('Custom FSL sign'), 'static');
});
