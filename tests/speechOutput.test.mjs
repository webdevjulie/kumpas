import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: ['src/speechOutput.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
});
const { speakText } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);

class MockUtterance {
  constructor(text) {
    this.text = text;
  }
}

function installSpeechEnvironment(voices) {
  const spoken = [];
  let cancelled = 0;
  globalThis.window = {
    speechSynthesis: {
      getVoices: () => voices,
      cancel: () => { cancelled += 1; },
      speak: utterance => spoken.push(utterance)
    }
  };
  globalThis.SpeechSynthesisUtterance = MockUtterance;
  return { spoken, get cancelled() { return cancelled; } };
}

test('uses a matching English voice and slows speech for clarity', () => {
  const voice = { name: 'English voice', lang: 'en-US' };
  const speech = installSpeechEnvironment([voice, { name: 'English voice', lang: 'en-US' }]);

  assert.equal(speakText('Hello', 'en-US'), 'English voice');
  assert.equal(speech.cancelled, 1);
  assert.equal(speech.spoken.length, 1);
  assert.equal(speech.spoken[0].lang, 'en-US');
  assert.equal(speech.spoken[0].voice, voice);
  assert.equal(speech.spoken[0].rate, 0.9);
});

test('queues an individual sign without cutting off the current utterance', () => {
  const speech = installSpeechEnvironment([{ name: 'English voice', lang: 'en-US' }]);

  speakText('A', 'en-US', { interrupt: false });
  assert.equal(speech.cancelled, 0);
  assert.equal(speech.spoken.length, 1);
});

test('speaks a single alphabet letter by its English name', () => {
  const speech = installSpeechEnvironment([{ name: 'English voice', lang: 'en-US' }]);

  speakText('A', 'en-US');
  speakText('b', 'en-US');
  speakText('HELLO', 'en-US');

  assert.deepEqual(speech.spoken.map(utterance => utterance.text), ['ay', 'bee', 'HELLO']);
});

test('prefers a Google English voice for letters but keeps the matching voice for words', () => {
  const deviceVoice = { name: 'Device English', lang: 'en-US' };
  const googleVoice = { name: 'Google US English', lang: 'en-US' };
  const speech = installSpeechEnvironment([deviceVoice, googleVoice]);

  assert.equal(speakText('A', 'en-US'), 'Google US English');
  assert.equal(speakText('Hello', 'en-US'), 'Device English');
  assert.equal(speech.spoken[0].voice, googleVoice);
  assert.equal(speech.spoken[1].voice, deviceVoice);
});

test('reports when the requested language voice is unavailable', () => {
  installSpeechEnvironment([{ name: 'English voice', lang: 'en-US' }]);
  assert.doesNotThrow(() => speakText('Hello', 'fil-PH'));
  installSpeechEnvironment([]);
  assert.throws(() => speakText('Hello', 'en-US'), /No English speech voice is available/);
});

test('prefers a Filipino voice and speaks Ñ as enye', () => {
  const english = { name: 'Microsoft David English', lang: 'en-US' };
  const filipino = { name: 'Microsoft Filipino (Tagalog)', lang: 'fil-PH' };
  const speech = installSpeechEnvironment([english, filipino]);

  assert.equal(speakText('Ñ', 'fil-PH'), 'Microsoft Filipino (Tagalog)');
  assert.equal(speech.spoken[0].text, 'enye');
  assert.equal(speech.spoken[0].voice, filipino);
});
