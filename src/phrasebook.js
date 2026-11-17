export const MAX_SAVED_PHRASES = 8;
const STORAGE_KEY = 'kumpas_phrasebook_v1';

export function loadSavedPhrases(storage = window.localStorage) {
  const saved = storage.getItem(STORAGE_KEY);
  if (saved === null) return [];

  let phrases;
  try {
    phrases = JSON.parse(saved);
  } catch {
    throw new Error('Saved phrasebook data is unreadable. Clear browser storage to reset it.');
  }
  if (!Array.isArray(phrases) || phrases.some(phrase => typeof phrase !== 'string' || !phrase.trim())) {
    throw new Error('Saved phrasebook data is invalid. Clear browser storage to reset it.');
  }
  return phrases.slice(0, MAX_SAVED_PHRASES);
}

export function savePhrase(text, storage = window.localStorage) {
  const phrase = text.trim();
  if (!phrase) throw new Error('Enter or recognize a phrase before saving it.');

  const phrases = loadSavedPhrases(storage)
    .filter(saved => saved !== phrase);
  phrases.unshift(phrase);
  const saved = phrases.slice(0, MAX_SAVED_PHRASES);
  storage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

export function deleteSavedPhrase(index, storage = window.localStorage) {
  const phrases = loadSavedPhrases(storage);
  if (!Number.isInteger(index) || index < 0 || index >= phrases.length) {
    throw new Error('That saved phrase is no longer available. Refresh the phrasebook and try again.');
  }
  phrases.splice(index, 1);
  storage.setItem(STORAGE_KEY, JSON.stringify(phrases));
  return phrases;
}
