const LETTER_NAMES = {
  A: 'ay', B: 'bee', C: 'see', D: 'dee', E: 'ee', F: 'ef', G: 'jee', H: 'aitch',
  I: 'eye', J: 'jay', K: 'kay', L: 'el', M: 'em', N: 'en', O: 'oh', P: 'pee',
  Q: 'cue', R: 'ar', S: 'ess', T: 'tee', U: 'you', V: 'vee', W: 'double you',
  X: 'ex', Y: 'why', Z: 'zee', Ñ: 'enye'
};

export function speakText(text, language = 'en-US', { interrupt = true } = {}) {
  if (!('speechSynthesis' in window)) {
    throw new Error('Text-to-speech is not supported by this browser.');
  }
  const phrase = text.trim();
  if (!phrase) throw new Error('There is no recognized text to speak.');
  if (language !== 'en-US') {
    throw new Error('Only English speech is available.');
  }

  const letter = phrase.toLocaleUpperCase('en-US');
  const isAlphabetLetter = Array.from(letter).length === 1 && LETTER_NAMES[letter] !== undefined;
  const spokenText = isAlphabetLetter ? LETTER_NAMES[letter] : phrase;
  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter(candidate => typeof candidate.lang === 'string'
    && candidate.lang.toLowerCase().startsWith('en-'));
  const matchingVoice = englishVoices.find(candidate =>
    candidate.lang.toLowerCase() === language.toLowerCase()
  );
  const googleVoice = englishVoices.find(candidate => /google/i.test(candidate.name)
    && candidate.lang.toLowerCase() === language.toLowerCase())
    ?? englishVoices.find(candidate => /google/i.test(candidate.name));
  const voice = (isAlphabetLetter ? googleVoice : null)
    ?? matchingVoice
    ?? englishVoices[0];
  if (!voice) {
    throw new Error('No English speech voice is available. Install or enable an English voice on this device.');
  }
  if (interrupt) window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = voice.lang;
  utterance.voice = voice;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
  return voice.name;
}
