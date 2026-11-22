const LETTER_NAMES = {
  A: 'ay', B: 'bee', C: 'see', D: 'dee', E: 'ee', F: 'ef', G: 'jee', H: 'aitch',
  I: 'eye', J: 'jay', K: 'kay', L: 'el', M: 'em', N: 'en', O: 'oh', P: 'pee',
  Q: 'cue', R: 'ar', S: 'ess', T: 'tee', U: 'you', V: 'vee', W: 'double you',
  X: 'ex', Y: 'why', Z: 'zee', Ñ: 'enye'
};

const FILIPINO_LETTER_NAMES = {
  A: 'ey', B: 'bi', C: 'si', D: 'di', E: 'i', F: 'ef', G: 'ji', H: 'eyts',
  I: 'ay', J: 'jey', K: 'key', L: 'el', M: 'em', N: 'en', Ñ: 'enye',
  O: 'o', P: 'pi', Q: 'kyu', R: 'ar', S: 'es', T: 'ti', U: 'yu',
  V: 'vi', W: 'dobol yu', X: 'eks', Y: 'way', Z: 'zi'
};

export function speakText(text, language = 'en-US', { interrupt = true } = {}) {
  if (!('speechSynthesis' in window)) {
    throw new Error('Text-to-speech is not supported by this browser.');
  }
  const phrase = text.trim();
  if (!phrase) throw new Error('There is no recognized text to speak.');

  const isFilipino = language.toLowerCase().startsWith('fil')
    || language.toLowerCase().startsWith('tl');
  const letter = phrase.toLocaleUpperCase(isFilipino ? 'fil-PH' : 'en-US');
  const names = isFilipino ? FILIPINO_LETTER_NAMES : LETTER_NAMES;
  const isAlphabetLetter = Array.from(letter).length === 1 && names[letter] !== undefined;
  const spokenText = isAlphabetLetter ? names[letter] : phrase;
  const voices = window.speechSynthesis.getVoices();
  const availableVoices = voices.filter(candidate => typeof candidate.lang === 'string');

  let voice;
  if (isFilipino) {
    const filipinoVoices = availableVoices.filter(candidate => {
      const locale = candidate.lang.toLowerCase();
      const name = candidate.name.toLowerCase();
      return locale.startsWith('fil') || locale.startsWith('tl')
        || /filipino|tagalog|philippines|pinoy/i.test(name);
    });
    voice = filipinoVoices.find(candidate => /filipino|tagalog|philippines|pinoy/i.test(candidate.name))
      ?? filipinoVoices[0]
      ?? availableVoices.find(candidate => candidate.lang.toLowerCase().startsWith('en-ph'))
      ?? availableVoices.find(candidate => candidate.lang.toLowerCase() === 'en-us');
  } else {
    const englishVoices = availableVoices.filter(candidate =>
      candidate.lang.toLowerCase().startsWith('en-')
    );
    const matchingVoice = englishVoices.find(candidate =>
      candidate.lang.toLowerCase() === language.toLowerCase()
    );
    const googleVoice = englishVoices.find(candidate => /google/i.test(candidate.name)
      && candidate.lang.toLowerCase() === language.toLowerCase())
      ?? englishVoices.find(candidate => /google/i.test(candidate.name));
    voice = (isAlphabetLetter ? googleVoice : null)
      ?? matchingVoice
      ?? englishVoices[0];
  }
  if (!voice) {
    throw new Error(isFilipino
      ? 'No Filipino or English voice is available. Install or enable a Filipino/English voice on this device.'
      : 'No English speech voice is available. Install or enable an English voice on this device.');
  }
  if (interrupt) window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = voice.lang;
  utterance.voice = voice;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
  return voice.name;
}
