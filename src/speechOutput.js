export function speakText(text, language = 'fil-PH') {
  if (!('speechSynthesis' in window)) {
    throw new Error('Text-to-speech is not supported by this browser.');
  }
  const phrase = text.trim();
  if (!phrase) throw new Error('There is no recognized text to speak.');
  if (!['fil-PH', 'en-US'].includes(language)) {
    throw new Error('Choose a supported speech language.');
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = language;
  window.speechSynthesis.speak(utterance);
}
