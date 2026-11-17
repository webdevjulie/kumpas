import {
  addSample, classify, clearSamples, deleteLabelSamples, evaluateHeldOutSamples,
  getSamples, hasTrainableSamples, importSamples, splitSamples
} from './classifier.js';
import { openCamera, stopCamera, listCameras } from './camera.js';
import { describeHandFeatures, extractHandFeatures } from './featureExtraction.js';
import { createHandLandmarker, detectHands, drawLandmarks } from './handTracking.js';
import { extractTemporalFeatures } from './dynamicRecognition.js';
import { classifyStaticLetter } from './staticAlphabet.js';
import { recordDynamicAttempt, recordStaticAttempt } from './evaluation.js';
import { deleteSavedPhrase, loadSavedPhrases, savePhrase } from './phrasebook.js';
import { speakText } from './speechOutput.js';
import { renderTextOutput } from './textOutput.js';

const byId = id => document.getElementById(id);
const video = byId('video');
const cameraFrame = byId('cameraFrame');
const canvas = byId('landmarkCanvas');
const context = canvas.getContext('2d');
const recordingCanvas = document.createElement('canvas');
const recordingContext = recordingCanvas.getContext('2d');
const status = byId('status');
const prediction = byId('prediction');
const cameraSelect = byId('cameraDevice');
const modeSelect = byId('kind');
const labelInput = byId('label');
const expectedInput = byId('expected');
const recordVideoButton = byId('recordVideo');

let stream = null;
let landmarker = null;
let animationFrame = 0;
let latestFeatures = null;
let latestDynamicFeatures = null;
let sequence = [];
let lastFrameAt = 0;
let lastClassificationAt = 0;
let lastFpsTimestamp = 0;
let lastStatsAt = 0;
const frameIntervals = [];
let currentPrediction = '';
let pendingPrediction = '';
let pendingPredictionCount = 0;
let pendingPredictionSince = 0;
let lastSpokenPrediction = '';
let testSession = null;
let reportedError = false;
let mediaRecorder = null;
let recordingStream = null;
let recordedChunks = [];
let captureInterval = 0;
let captureTarget = 0;
let captureCount = 0;
let translatedText = '';
let activeWorkflowStep = 'data';

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function showError(error) {
  setStatus(error instanceof Error ? error.message : String(error), true);
}

function updateSamples() {
  const samples = getSamples();
  byId('sampleCount').textContent = samples.length;
  const groups = new Map();
  samples.forEach(sample => {
    const key = `${sample.kind}\u0000${sample.label}\u0000${sample.condition ?? ''}`;
    const group = groups.get(key) ?? { total: 0, training: 0, testing: 0 };
    group.total += 1;
    if (sample.split === 'test') group.testing += 1;
    else group.training += 1;
    groups.set(key, group);
  });
  const body = byId('sampleRows');
  body.replaceChildren();
  for (const [key, counts] of groups) {
    const [kind, label, condition] = key.split('\u0000');
    const row = document.createElement('tr');
    for (const value of [
      kind === 'static' ? 'Static' : 'Dynamic',
      label,
      condition || '—',
      counts.total,
      counts.training,
      counts.testing
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    const action = document.createElement('td');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button';
    remove.dataset.kind = kind;
    remove.dataset.label = label;
    remove.textContent = 'Delete';
    action.append(remove);
    row.append(action);
    body.append(row);
  }

  if (!groups.size) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.textContent = 'No samples saved.';
    row.append(cell);
    body.append(row);
  }

  const savedLabels = [...new Set(samples.map(sample => sample.label))]
    .filter(label => !/^[A-Z]$/.test(label))
    .sort((a, b) => a.localeCompare(b));
  const selectedLabel = labelInput.value;
  const letterOptions = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));
  labelInput.replaceChildren(new Option('Select a sign', ''));
  for (const label of [...letterOptions, ...savedLabels]) {
    labelInput.add(new Option(label, label));
  }
  if ([...letterOptions, ...savedLabels].includes(selectedLabel)) labelInput.value = selectedLabel;

  const training = samples.filter(sample => sample.split !== 'test').length;
  const testing = samples.filter(sample => sample.split === 'test').length;
  byId('sampleSummary').textContent =
    `${samples.length} samples across ${groups.size} sign/condition groups. Training ${training}, testing ${testing}.`;
  updateTrainingStatus();
}

function updateTrainingStatus(message) {
  if (message) {
    byId('trainingStatus').textContent = message;
    return;
  }
  const staticReady = hasTrainableSamples('static');
  const dynamicReady = hasTrainableSamples('dynamic');
  byId('trainingStatus').textContent = staticReady || dynamicReady
    ? `KNN ready for ${[staticReady && 'static', dynamicReady && 'dynamic'].filter(Boolean).join(' and ')} signs (k = 3).`
    : 'Add at least 3 training samples for every label in a sign type, then select Train model.';
}

function renderFeatureSummary(hands) {
  const summary = hands.length ? describeHandFeatures(hands) : null;
  byId('featureScale').textContent = summary ? summary.scale.toFixed(3) : '—';
  byId('featureCentroid').textContent = summary
    ? summary.centroid.map(value => value.toFixed(3)).join(', ')
    : '—';
  byId('featureLength').textContent = summary ? summary.featureVectorLength : '126';
  for (let index = 0; index < 5; index += 1) {
    const ratio = summary?.ratios[index];
    const angle = summary?.flexion[index];
    byId(`ratio${index}`).value = ratio ?? 0;
    byId(`ratioValue${index}`).textContent = Number.isFinite(ratio) ? ratio.toFixed(2) : '—';
    byId(`angle${index}`).value = angle ?? 0;
    byId(`angleValue${index}`).textContent = Number.isFinite(angle) ? `${Math.round(angle)}°` : '—';
  }
}

async function refreshCameras(selectedId) {
  const cameras = await listCameras();
  const previous = selectedId ?? cameraSelect.value;
  cameraSelect.replaceChildren();
  cameras.forEach((camera, index) => {
    const option = document.createElement('option');
    option.value = camera.deviceId;
    option.textContent = camera.label || `Camera ${index + 1}`;
    cameraSelect.append(option);
  });
  if (previous && cameras.some(camera => camera.deviceId === previous)) {
    cameraSelect.value = previous;
  }
}

function stopRecognition() {
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
}

async function stopCameraConnection() {
  stopRecognition();
  if (captureInterval) {
    window.clearInterval(captureInterval);
    captureInterval = 0;
  }
  byId('captureBurst').disabled = true;
  if (mediaRecorder?.state === 'recording') {
    const recorder = mediaRecorder;
    const stopped = new Promise(resolve => recorder.addEventListener('stop', resolve, { once: true }));
    recorder.stop();
    await stopped;
  }
  if (testSession) {
    testSession = null;
    modeSelect.disabled = false;
    byId('startTest').disabled = true;
    byId('finishTest').disabled = true;
    byId('testStatus').textContent = 'Test cancelled because the camera was disconnected.';
  }
  stopCamera(stream);
  stream = null;
  video.srcObject = null;
  cameraFrame.style.aspectRatio = '';
  landmarker?.close();
  landmarker = null;
  pendingPrediction = '';
  pendingPredictionCount = 0;
  pendingPredictionSince = 0;
  lastSpokenPrediction = '';
  latestFeatures = null;
  latestDynamicFeatures = null;
  lastFpsTimestamp = 0;
  frameIntervals.length = 0;
  byId('handIndicator').textContent = 'No hand';
  byId('handIndicator').classList.remove('active');
  byId('frameRate').textContent = '-- fps';
  byId('processingTime').textContent = '-- ms';
  byId('matchValue').textContent = '--';
  byId('matchBar').style.width = '0%';
  prediction.textContent = 'Start the camera and show a trained sign.';
  context.clearRect(0, 0, canvas.width, canvas.height);
  byId('cameraPlaceholder').hidden = false;
  byId('connectCamera').disabled = false;
  byId('disconnectCamera').disabled = true;
  byId('captureSample').disabled = true;
  renderFeatureSummary([]);
  byId('captureStatus').textContent = 'Connect the camera before capturing samples.';
  recordVideoButton.disabled = true;
  recordVideoButton.textContent = 'Record sign video';
  byId('startTest').disabled = true;
  setStatus('Camera is not connected.');
}

async function connectCamera() {
  try {
    await stopCameraConnection();
    setStatus('Requesting camera permission…');
    stream = await openCamera(cameraSelect.value);
    video.srcObject = stream;
    await video.play();
    byId('cameraPlaceholder').hidden = true;
    await refreshCameras(stream.getVideoTracks()[0].getSettings().deviceId);

    setStatus('Preparing hand tracking. This may take a moment…');
    landmarker = await createHandLandmarker();
    byId('connectCamera').disabled = true;
    byId('disconnectCamera').disabled = false;
    byId('captureSample').disabled = false;
    byId('captureBurst').disabled = false;
    recordVideoButton.disabled = false;
    byId('captureStatus').textContent = 'Camera is connected. Choose a label and capture approved samples.';
    updateTestAvailability();
    reportedError = false;
    lastFrameAt = 0;
    lastClassificationAt = 0;
    sequence = [];
    setStatus('Ready! Show one or two hands to the camera.');
    animationFrame = requestAnimationFrame(trackFrame);
  } catch (error) {
    await stopCameraConnection();
    if (error?.name === 'NotAllowedError') {
      showError(new Error('Camera permission was denied. Allow camera access in your browser and try again.'));
    } else if (error?.name === 'NotFoundError') {
      showError(new Error('No camera found. Start Iriun or connect a webcam, then try again.'));
    } else {
      showError(error);
    }
  }
}

function updateTestAvailability() {
  byId('startTest').disabled = !stream
    || !hasTrainableSamples(modeSelect.value)
    || Boolean(testSession);
}

function currentSampleFeatures(kind) {
  if (kind === 'static') return latestFeatures;
  return sequence.length >= 3
    ? extractTemporalFeatures(sequence)
    : latestDynamicFeatures;
}

function saveCurrentSample() {
  if (!stream) throw new Error('Connect a camera before capturing samples.');
  if (!labelInput.value) throw new Error('Choose an approved sign label first.');
  const kind = modeSelect.value;
  const features = currentSampleFeatures(kind);
  if (!features) {
    throw new Error(kind === 'static'
      ? 'No hand detected. Hold your hand in front of the camera.'
      : 'Show the moving sign for a moment before saving a sample.');
  }
  const total = addSample(kind, labelInput.value, features, {
    condition: byId('sampleCondition').value
  });
  updateSamples();
  updateTestAvailability();
  return total;
}

function stopBurstCapture(message) {
  if (captureInterval) window.clearInterval(captureInterval);
  captureInterval = 0;
  byId('captureBurst').disabled = !stream;
  byId('captureStatus').textContent = message;
}

function startBurstCapture() {
  if (!stream) throw new Error('Connect a camera before capturing samples.');
  if (!labelInput.value) throw new Error('Choose an approved sign label first.');
  if (captureInterval) return;

  captureCount = 0;
  captureTarget = performance.now() + 3000;
  byId('captureBurst').disabled = true;
  byId('captureStatus').textContent = 'Capturing up to 25 samples. Keep the sign visible and vary it slightly.';
  const capture = () => {
    if (!stream) {
      stopBurstCapture('Capture stopped because the camera was disconnected.');
      return;
    }
    if (performance.now() >= captureTarget || captureCount >= 25) {
      stopBurstCapture(`Captured ${captureCount} of 25 samples in 3 seconds.`);
      updateSamples();
      updateTestAvailability();
      return;
    }
    if (!currentSampleFeatures(modeSelect.value)) return;
    try {
      saveCurrentSample();
      captureCount += 1;
      byId('captureStatus').textContent = `Capturing samples: ${captureCount}/25`;
      if (captureCount >= 25) {
        stopBurstCapture('Captured 25 samples.');
      }
    } catch (error) {
      stopBurstCapture(error.message);
    }
  };
  capture();
  captureInterval = window.setInterval(capture, 120);
}

function addToTranslation(label) {
  if (!label) {
    byId('translationStatus').textContent = 'No stable sign is available to add yet.';
    return;
  }
  const separator = translatedText && label.length > 1 ? ' ' : '';
  translatedText += `${separator}${label}`;
  byId('translationOutput').value = translatedText;
  updateTranslationTools();
  byId('translationStatus').textContent = 'Sign added to the text output.';
}

function updateTranslationTools() {
  const hasText = Boolean(byId('translationOutput').value.trim());
  byId('copyTranslation').disabled = !hasText;
  byId('downloadTranslation').disabled = !hasText;
  byId('savePhrase').disabled = !hasText;
}

function renderPhrasebook(message) {
  const list = byId('phrasebookList');
  const phrases = loadSavedPhrases();
  list.replaceChildren();
  byId('phrasebookStatus').textContent = message
    ?? (phrases.length ? `${phrases.length} saved phrase${phrases.length === 1 ? '' : 's'}.` : 'No saved phrases yet.');

  phrases.forEach((phrase, index) => {
    const item = document.createElement('div');
    item.className = 'phrasebook-item';
    item.setAttribute('role', 'listitem');
    const text = document.createElement('span');
    text.className = 'phrasebook-text';
    text.textContent = phrase;
    const use = document.createElement('button');
    use.type = 'button';
    use.className = 'text-button';
    use.dataset.phraseAction = 'use';
    use.dataset.phraseIndex = index;
    use.textContent = 'Use';
    use.setAttribute('aria-label', `Use saved phrase: ${phrase}`);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button';
    remove.dataset.phraseAction = 'delete';
    remove.dataset.phraseIndex = index;
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove saved phrase: ${phrase}`);
    item.append(text, use, remove);
    list.append(item);
  });
}

function downloadTranslation() {
  const text = byId('translationOutput').value.trim();
  if (!text) throw new Error('There is no translation text to download.');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const download = document.createElement('a');
  download.href = url;
  download.download = `kumpas-translation-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.append(download);
  download.click();
  download.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function runHeldOutTest() {
  const result = evaluateHeldOutSamples();
  const summary = byId('modelTestResults');
  const rows = byId('modelTestRows');
  rows.replaceChildren();
  if (!result.total) {
    summary.textContent = 'No held-out samples. Add at least 4 samples per sign, then select Split sets.';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.textContent = 'No test results.';
    row.append(cell);
    rows.append(row);
    return;
  }
  const accuracy = result.accuracy.toFixed(1);
  summary.textContent =
    `Held-out sample accuracy: ${accuracy}% (${result.correct}/${result.total} correct); ${result.rejected} rejected.`;
  result.predictions.forEach(predictionResult => {
    const row = document.createElement('tr');
    for (const value of [
      predictionResult.expected,
      predictionResult.predicted || 'No classification',
      predictionResult.correct ? 'Correct' : 'Incorrect'
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    row.lastElementChild.className = predictionResult.correct
      ? 'model-test-row-correct'
      : 'model-test-row-incorrect';
    rows.append(row);
  });
}

function classifyCurrent(features, kind, elapsedMs, landmarks) {
  const classificationStarted = performance.now();
  const trainable = hasTrainableSamples(kind);
  const previewOnly = byId('classifierType').value === 'preview';
  let result = previewOnly ? null : classify(kind, features);
  if (kind === 'static' && (previewOnly || (!result && !trainable))) {
    const letter = classifyStaticLetter(landmarks);
    if (letter) result = { ...letter, source: 'letter preview' };
  }
  const measuredMs = elapsedMs + performance.now() - classificationStarted;
  if (testSession) {
    testSession.decisions += 1;
    testSession.processingTotalMs += measuredMs;
    testSession.spatialTotalMs += kind === 'dynamic' ? measuredMs : 0;
    testSession.kind = kind;
  }
  if (!result) {
    prediction.textContent = previewOnly && kind === 'dynamic'
      ? 'The geometric preview supports static letters only. Select Trained KNN for moving signs.'
      : trainable
        ? 'No clear KNN majority. Hold the sign steadily or add more varied samples.'
        : kind === 'static'
          ? 'No supported static letter detected. Add approved samples for this sign.'
          : 'No trained dynamic signs yet. Record a clip or add approved samples.';
    currentPrediction = '';
    pendingPrediction = '';
    pendingPredictionCount = 0;
    pendingPredictionSince = 0;
    byId('speak').disabled = true;
    byId('matchValue').textContent = '--';
    byId('matchBar').style.width = '0%';
    return;
  }

  if (result.label === pendingPrediction) {
    pendingPredictionCount += 1;
  } else {
    pendingPrediction = result.label;
    pendingPredictionCount = 1;
    pendingPredictionSince = performance.now();
    prediction.textContent = 'Recognizing sign…';
    currentPrediction = '';
    byId('speak').disabled = true;
  }

  if (pendingPredictionCount < 2
    || performance.now() - pendingPredictionSince < Number(byId('holdTime').value)) return;

  currentPrediction = result.label;
  if (testSession) testSession.finalPrediction = result.label;
  renderTextOutput(prediction, result.label);
  if (result.source === 'letter preview') {
    const matchPercent = Math.round(result.matchScore * 100);
    byId('matchValue').textContent = `${matchPercent}% rule match`;
    byId('matchBar').style.width = `${matchPercent}%`;
  } else {
    const agreementPercent = Math.round(result.agreement * 100);
    byId('matchValue').textContent = `${result.votes}/${result.neighborCount} neighbors`;
    byId('matchBar').style.width = `${agreementPercent}%`;
  }
  byId('speak').disabled = false;

  if (result.label !== lastSpokenPrediction) {
    lastSpokenPrediction = result.label;
    if (byId('addToText').checked) addToTranslation(result.label);
    if (byId('speakEachSign').checked) {
      try {
        speakText(result.label, byId('voiceLanguage').value);
      } catch (error) {
        showError(error);
      }
    }
  }
}

function trackFrame(timestamp) {
  if (!landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    animationFrame = requestAnimationFrame(trackFrame);
    return;
  }

  const started = performance.now();
  if (lastFpsTimestamp) {
    frameIntervals.push(timestamp - lastFpsTimestamp);
    if (frameIntervals.length > 30) frameIntervals.shift();
  }
  lastFpsTimestamp = timestamp;
  try {
    const hands = detectHands(landmarker, video, timestamp);
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width && height) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const aspectRatio = `${width} / ${height}`;
      if (cameraFrame.style.aspectRatio !== aspectRatio) {
        cameraFrame.style.aspectRatio = aspectRatio;
      }
    }
    drawLandmarks(context, hands, canvas.width, canvas.height);
    if (recordingStream) drawRecordingFrame();

    if (!hands.length) {
      byId('handIndicator').textContent = 'No hand';
      byId('handIndicator').classList.remove('active');
      latestFeatures = null;
      latestDynamicFeatures = null;
      sequence = [];
      renderFeatureSummary([]);
      if (timestamp - lastFrameAt > 1200) {
        pendingPrediction = '';
        pendingPredictionCount = 0;
        pendingPredictionSince = 0;
        lastSpokenPrediction = '';
        if (timestamp - lastFrameAt > 1500) {
          setStatus('No hand detected. Keep your hand fully visible in front of the camera.');
          prediction.textContent = 'No hand in view.';
          currentPrediction = '';
          byId('speak').disabled = true;
          byId('matchValue').textContent = '--';
          byId('matchBar').style.width = '0%';
        }
      }
    } else {
      byId('handIndicator').textContent = 'Hand detected';
      byId('handIndicator').classList.add('active');
      renderFeatureSummary(hands);
      const features = extractHandFeatures(hands);
      latestFeatures = features;
      if (timestamp - lastFrameAt >= 80) {
        sequence.push(features);
        lastFrameAt = timestamp;
      }

      const mode = modeSelect.value;
      const interval = mode === 'static' ? 350 : 1500;
      if (timestamp - lastClassificationAt >= interval) {
        lastClassificationAt = timestamp;
        if (mode === 'static') {
          classifyCurrent(features, mode, performance.now() - started, hands[0]);
        } else if (sequence.length >= 3) {
          const dynamicStarted = performance.now();
          latestDynamicFeatures = extractTemporalFeatures(sequence);
          classifyCurrent(latestDynamicFeatures, mode, performance.now() - dynamicStarted);
          sequence = [features];
        }
      }
      setStatus('Hand detected. Show a sign to recognize it.');
    }
  } catch (error) {
    if (!reportedError) {
      reportedError = true;
      showError(error);
    }
    stopRecognition();
    return;
  }
  if (timestamp - lastStatsAt >= 500) {
    const averageFrameInterval = frameIntervals.length
      ? frameIntervals.reduce((sum, interval) => sum + interval, 0) / frameIntervals.length
      : 0;
    byId('frameRate').textContent = averageFrameInterval
      ? `${Math.round(1000 / averageFrameInterval)} fps`
      : '-- fps';
    byId('processingTime').textContent = `${Math.round(performance.now() - started)} ms`;
    lastStatsAt = timestamp;
  }
  animationFrame = requestAnimationFrame(trackFrame);
}

function drawRecordingFrame() {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!recordingContext || !width || !height) return;

  if (recordingCanvas.width !== width || recordingCanvas.height !== height) {
    recordingCanvas.width = width;
    recordingCanvas.height = height;
  }

  recordingContext.save();
  if (byId('mirrorCamera').getAttribute('aria-pressed') === 'true') {
    recordingContext.translate(width, 0);
    recordingContext.scale(-1, 1);
  }
  recordingContext.drawImage(video, 0, 0, width, height);
  recordingContext.drawImage(canvas, 0, 0, width, height);
  recordingContext.restore();
}

function startVideoRecording() {
  if (!stream) {
    throw new Error('Connect a camera before recording a sign video.');
  }
  if (!window.MediaRecorder) {
    throw new Error('Video recording is not supported by this browser.');
  }
  if (typeof recordingCanvas.captureStream !== 'function' || !recordingContext) {
    throw new Error('Canvas video recording is not supported by this browser.');
  }

  const supportedTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  const supportedType = typeof MediaRecorder.isTypeSupported === 'function'
    ? supportedTypes.find(type => MediaRecorder.isTypeSupported(type))
    : null;
  recordingStream = recordingCanvas.captureStream(30);
  drawRecordingFrame();
  let recorder;
  try {
    recorder = supportedType
      ? new MediaRecorder(recordingStream, { mimeType: supportedType })
      : new MediaRecorder(recordingStream);
  } catch (error) {
    recordingStream.getTracks().forEach(track => track.stop());
    recordingStream = null;
    throw error;
  }
  mediaRecorder = recorder;
  recordedChunks = [];
  recorder.addEventListener('dataavailable', event => {
    if (event.data.size) recordedChunks.push(event.data);
  });
  recorder.addEventListener('stop', () => {
    const type = recorder.mimeType || 'video/webm';
    const blob = new Blob(recordedChunks, { type });
    recordVideoButton.textContent = 'Record sign video';
    if (mediaRecorder === recorder) mediaRecorder = null;
    recordingStream?.getTracks().forEach(track => track.stop());
    recordingStream = null;
    recordedChunks = [];
    if (!blob.size) {
      byId('recordingStatus').textContent = 'No video data was captured.';
      return;
    }

    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = url;
    const extension = type.includes('mp4') ? 'mp4' : 'webm';
    download.download = `kumpas-sign-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
    document.body.append(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    byId('recordingStatus').textContent = 'Recording saved as a video download.';
  });
  recorder.addEventListener('error', event => {
    recordVideoButton.textContent = 'Record sign video';
    byId('recordingStatus').textContent = 'Video recording failed.';
    if (mediaRecorder === recorder) mediaRecorder = null;
    recordingStream?.getTracks().forEach(track => track.stop());
    recordingStream = null;
    showError(event.error ?? new Error('The sign video could not be recorded.'));
  });
  recorder.start(250);
  recordVideoButton.textContent = 'Stop and save recording';
  byId('recordingStatus').textContent = 'Recording the camera and hand lines. Recognition continues while recording.';
}

recordVideoButton.addEventListener('click', () => {
  try {
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
    else startVideoRecording();
  } catch (error) {
    showError(error);
  }
});

byId('mirrorCamera').addEventListener('click', event => {
  const mirrored = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  cameraFrame.classList.toggle('camera-unmirrored', !mirrored);
  event.currentTarget.setAttribute('aria-pressed', String(mirrored));
  event.currentTarget.textContent = `Mirror: ${mirrored ? 'on' : 'off'}`;
});

byId('fullscreenCamera').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement === cameraFrame) {
      await document.exitFullscreen();
    } else if (cameraFrame.requestFullscreen) {
      await cameraFrame.requestFullscreen();
    } else {
      throw new Error('Full-screen preview is not supported by this browser.');
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
});

document.addEventListener('fullscreenchange', () => {
  byId('fullscreenCamera').textContent =
    document.fullscreenElement === cameraFrame ? 'Exit full screen' : 'Full screen';
});

byId('connectCamera').addEventListener('click', connectCamera);
byId('disconnectCamera').addEventListener('click', () => {
  stopCameraConnection().catch(showError);
});
cameraSelect.addEventListener('focus', () => {
  refreshCameras().catch(showError);
});
modeSelect.addEventListener('change', () => {
  sequence = [];
  latestDynamicFeatures = null;
  pendingPrediction = '';
  pendingPredictionCount = 0;
  pendingPredictionSince = 0;
  lastSpokenPrediction = '';
  lastClassificationAt = 0;
  currentPrediction = '';
  byId('speak').disabled = true;
  prediction.textContent = 'Show a sign to the camera.';
  byId('matchValue').textContent = '--';
  byId('matchBar').style.width = '0%';
  updateTestAvailability();
});

byId('captureSample').addEventListener('click', () => {
  try {
    const total = saveCurrentSample();
    byId('captureStatus').textContent = `Sample saved on this device. Total samples: ${total}.`;
  } catch (error) {
    byId('captureStatus').textContent = error.message;
  }
});

byId('captureBurst').addEventListener('click', () => {
  try {
    startBurstCapture();
  } catch (error) {
    byId('captureStatus').textContent = error.message;
  }
});

labelInput.addEventListener('change', () => {
  modeSelect.value = ['J', 'Z'].includes(labelInput.value) ? 'dynamic' : 'static';
  modeSelect.dispatchEvent(new Event('change'));
});

byId('addCustomSign').addEventListener('click', () => {
  const label = byId('customSign').value.trim();
  if (!label) {
    byId('captureStatus').textContent = 'Enter an approved custom sign label first.';
    return;
  }
  const existing = [...labelInput.options].find(option => option.value === label);
  if (!existing) labelInput.add(new Option(label, label));
  labelInput.value = label;
  byId('customSign').value = '';
  modeSelect.value = 'static';
  modeSelect.dispatchEvent(new Event('change'));
});

byId('sampleRows').addEventListener('click', event => {
  const button = event.target.closest('button[data-kind][data-label]');
  if (!button) return;
  if (confirm(`Delete all ${button.dataset.kind} samples for "${button.dataset.label}"?`)) {
    deleteLabelSamples(button.dataset.kind, button.dataset.label);
    updateSamples();
    updateTestAvailability();
  }
});

byId('trainingShare').addEventListener('input', event => {
  byId('trainingShareValue').textContent = `${event.target.value}%`;
});

byId('splitSets').addEventListener('click', () => {
  try {
    const result = splitSamples(Number(byId('trainingShare').value) / 100);
    updateSamples();
    updateTestAvailability();
    byId('sampleSummary').textContent =
      `Split ${result.total} samples: ${result.training} training and ${result.testing} testing. Labels need at least 4 samples to receive a test sample.`;
  } catch (error) {
    byId('sampleSummary').textContent = error.message;
  }
});

byId('exportSamples').addEventListener('click', () => {
  try {
    const samples = getSamples();
    if (!samples.length) throw new Error('There are no samples to export.');
    const blob = new Blob([JSON.stringify({ version: 1, samples }, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = url;
    download.download = 'kumpas-training-samples.json';
    document.body.append(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    byId('sampleSummary').textContent = error.message;
  }
});

byId('importSamples').addEventListener('click', () => byId('importSamplesFile').click());
byId('importSamplesFile').addEventListener('change', async event => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('The sample file must be smaller than 20 MB.');
    const parsed = JSON.parse(await file.text());
    const imported = Array.isArray(parsed) ? parsed : parsed.samples;
    const total = importSamples(imported);
    updateSamples();
    updateTestAvailability();
    byId('sampleSummary').textContent = `Imported and saved samples. Total on this device: ${total}.`;
  } catch (error) {
    byId('sampleSummary').textContent = `Import failed: ${error.message}`;
  } finally {
    event.target.value = '';
  }
});

byId('clearSamples').addEventListener('click', () => {
  if (confirm('Delete all samples saved in this browser?')) {
    clearSamples();
    updateSamples();
    updateTestAvailability();
    prediction.textContent = 'Saved samples have been deleted.';
    currentPrediction = '';
    pendingPrediction = '';
    pendingPredictionCount = 0;
    pendingPredictionSince = 0;
    lastSpokenPrediction = '';
    byId('speak').disabled = true;
    byId('matchValue').textContent = '--';
    byId('matchBar').style.width = '0%';
  }
});

byId('trainModel').addEventListener('click', () => {
  if (byId('classifierType').value === 'preview') {
    updateTrainingStatus('The geometric preview has no trained model and is not validated FSL accuracy.');
    return;
  }
  if (!hasTrainableSamples(modeSelect.value)) {
    updateTrainingStatus(`Add at least 3 training samples for every ${modeSelect.value} label before training KNN.`);
    return;
  }
  updateTrainingStatus(`KNN model ready for ${modeSelect.value} signs (k = 3).`);
  updateTestAvailability();
});

byId('classifierType').addEventListener('change', () => {
  updateTrainingStatus(byId('classifierType').value === 'preview'
    ? 'Limited geometric estimates only; this is not a trained or validated FSL model.'
    : null);
});

byId('holdTime').addEventListener('input', event => {
  byId('holdTimeValue').textContent = `${event.target.value} ms`;
});

byId('speak').addEventListener('click', () => {
  try {
    speakText(currentPrediction, byId('voiceLanguage').value);
  } catch (error) {
    showError(error);
  }
});

byId('translationOutput').addEventListener('input', event => {
  translatedText = event.target.value;
  updateTranslationTools();
});
byId('appendCurrentSign').addEventListener('click', () => addToTranslation(currentPrediction));
byId('appendSpace').addEventListener('click', () => {
  translatedText += ' ';
  byId('translationOutput').value = translatedText;
  updateTranslationTools();
});
byId('deleteLastCharacter').addEventListener('click', () => {
  translatedText = Array.from(translatedText).slice(0, -1).join('');
  byId('translationOutput').value = translatedText;
  updateTranslationTools();
});
byId('speakTranslation').addEventListener('click', () => {
  try {
    speakText(byId('translationOutput').value, byId('voiceLanguage').value);
  } catch (error) {
    showError(error);
  }
});
byId('clearTranslation').addEventListener('click', () => {
  translatedText = '';
  byId('translationOutput').value = '';
  updateTranslationTools();
  byId('translationStatus').textContent = 'Text output cleared.';
});
byId('copyTranslation').addEventListener('click', async () => {
  try {
    const text = byId('translationOutput').value.trim();
    if (!text) throw new Error('There is no translation text to copy.');
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.');
    await navigator.clipboard.writeText(text);
    byId('translationStatus').textContent = 'Translation copied to the clipboard.';
  } catch (error) {
    byId('translationStatus').textContent = error.message;
  }
});
byId('downloadTranslation').addEventListener('click', () => {
  try {
    downloadTranslation();
    byId('translationStatus').textContent = 'Translation downloaded as a text file.';
  } catch (error) {
    byId('translationStatus').textContent = error.message;
  }
});
byId('savePhrase').addEventListener('click', () => {
  try {
    const phrases = savePhrase(byId('translationOutput').value);
    renderPhrasebook(`${phrases.length} saved phrase${phrases.length === 1 ? '' : 's'}. Phrase saved on this device.`);
  } catch (error) {
    byId('phrasebookStatus').textContent = error.message;
  }
});
byId('phrasebookList').addEventListener('click', event => {
  const button = event.target.closest('button[data-phrase-action]');
  if (!button) return;
  const index = Number(button.dataset.phraseIndex);
  try {
    if (button.dataset.phraseAction === 'use') {
      const phrase = loadSavedPhrases()[index];
      if (phrase === undefined) throw new Error('That saved phrase is no longer available. Refresh the phrasebook and try again.');
      translatedText = phrase;
      byId('translationOutput').value = phrase;
      updateTranslationTools();
      byId('translationStatus').textContent = 'Saved phrase loaded into the text output.';
    } else {
      const phrases = deleteSavedPhrase(index);
      renderPhrasebook(`${phrases.length} saved phrase${phrases.length === 1 ? '' : 's'}. Phrase removed.`);
    }
  } catch (error) {
    byId('phrasebookStatus').textContent = error.message;
  }
});

byId('runModelTest').addEventListener('click', runHeldOutTest);

document.querySelector('.workflow-tabs').addEventListener('click', event => {
  const button = event.target.closest('button[data-step]');
  if (!button) return;
  activeWorkflowStep = button.dataset.step;
  document.querySelectorAll('.workflow-tabs button').forEach(tab => {
    const selected = tab === button;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('.workflow-stage').forEach(stage => {
    stage.hidden = stage.id !== `step-${activeWorkflowStep}`;
  });
});

byId('openTextTools').addEventListener('click', () => {
  byId('tab-classification').click();
  const workflow = document.querySelector('.workflow-panel');
  workflow.scrollTop = 0;
  workflow.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

window.addEventListener('keydown', event => {
  const target = event.target;
  if (event.code === 'Space' && activeWorkflowStep === 'data'
    && !target.closest('input, select, textarea, button')) {
    event.preventDefault();
    byId('captureSample').click();
  }
});

byId('startTest').addEventListener('click', () => {
  if (!hasTrainableSamples(modeSelect.value)) {
    byId('testStatus').textContent = 'Research tests require at least 3 KNN samples for every label in the selected sign type.';
    return;
  }
  if (!expectedInput.value.trim()) {
    byId('testStatus').textContent = 'Enter the expected label before starting the test.';
    return;
  }
  byId('classifierType').value = 'knn';
  testSession = {
    startedAt: performance.now(),
    kind: modeSelect.value,
    expected: expectedInput.value.trim(),
    decisions: 0,
    processingTotalMs: 0,
    spatialTotalMs: 0,
    finalPrediction: ''
  };
  sequence = [];
  lastClassificationAt = testSession.startedAt;
  byId('testStatus').textContent = 'Timed test in progress…';
  modeSelect.disabled = true;
  byId('startTest').disabled = true;
  byId('finishTest').disabled = false;
});

byId('finishTest').addEventListener('click', () => {
  if (!testSession) return;
  try {
    const elapsedSeconds = (performance.now() - testSession.startedAt) / 1000;
    if (!testSession.finalPrediction || !testSession.decisions) {
      throw new Error('No sign recognized yet. Show a sign with a saved sample, then try again.');
    }
    const data = {
      expected: testSession.expected,
      predicted: testSession.finalPrediction,
      audioCorrect: byId('audioAssessment').value,
      processingMs: testSession.processingTotalMs / testSession.decisions,
      classificationCount: testSession.decisions,
      elapsedSeconds,
      spatiotemporalMs: testSession.kind === 'dynamic'
        ? testSession.spatialTotalMs / testSession.decisions
        : '',
      landmarkAccuracy: testSession.kind === 'dynamic' ? byId('landmarkAssessment').value : '',
      testCode: ''
    };
    if (testSession.kind === 'dynamic') recordDynamicAttempt(data);
    else recordStaticAttempt(data);
    byId('testStatus').textContent = 'Test saved. View the results on the evaluation dashboard.';
    testSession = null;
    modeSelect.disabled = false;
    byId('finishTest').disabled = true;
    updateTestAvailability();
  } catch (error) {
    byId('testStatus').textContent = error.message;
  }
});

try {
  updateSamples();
} catch (error) {
  showError(error);
}
updateTranslationTools();
try {
  renderPhrasebook();
} catch (error) {
  byId('phrasebookStatus').textContent = error.message;
}
refreshCameras().catch(showError);

window.addEventListener('beforeunload', () => {
  stopCamera(stream);
  landmarker?.close();
});
