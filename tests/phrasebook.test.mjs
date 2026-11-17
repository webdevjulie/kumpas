import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteSavedPhrase, loadSavedPhrases, MAX_SAVED_PHRASES, savePhrase } from '../src/phrasebook.js';

function createStorage() {
  const data = new Map();
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value)
  };
}

test('saves phrases newest first, removes duplicates, and caps the phrasebook', () => {
  const storage = createStorage();
  savePhrase('Hello', storage);
  savePhrase('Thank you', storage);
  savePhrase('Hello', storage);
  for (let index = 0; index < MAX_SAVED_PHRASES + 2; index += 1) {
    savePhrase(`Phrase ${index}`, storage);
  }

  const saved = loadSavedPhrases(storage);
  assert.equal(saved.length, MAX_SAVED_PHRASES);
  assert.equal(saved[0], `Phrase ${MAX_SAVED_PHRASES + 1}`);
  assert.equal(saved.includes('Hello'), false);
});

test('removes only the selected saved phrase and rejects invalid indexes', () => {
  const storage = createStorage();
  savePhrase('Hello', storage);
  savePhrase('Thank you', storage);

  assert.deepEqual(deleteSavedPhrase(0, storage), ['Hello']);
  assert.throws(() => deleteSavedPhrase(3, storage), /no longer available/);
});

test('reports empty phrases and malformed saved data instead of hiding failures', () => {
  const storage = createStorage();
  assert.throws(() => savePhrase('   ', storage), /before saving/);
  storage.setItem('kumpas_phrasebook_v1', '{');
  assert.throws(() => loadSavedPhrases(storage), /unreadable/);
  storage.setItem('kumpas_phrasebook_v1', JSON.stringify(['  ']));
  assert.throws(() => loadSavedPhrases(storage), /invalid/);
});
