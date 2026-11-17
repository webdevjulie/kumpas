const KEY = 'kumpas_objectives_eval_v2';

export function getRecords() {
  const saved = localStorage.getItem(KEY);
  if (!saved) return [];
  const records = JSON.parse(saved);
  if (!Array.isArray(records)) throw new Error('Stored evaluation data is not a valid record list.');
  return records;
}

function optionalNumber(value, field) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${field} must be a non-negative number.`);
  return number;
}

export function saveRecord(data) {
  if (!['static', 'dynamic'].includes(data.kind)) throw new Error('Invalid sign category.');
  const expected = String(data.expected ?? '').trim();
  const predicted = String(data.predicted ?? '').trim();
  if (!expected || !predicted) throw new Error('Expected and predicted FSL labels are required.');

  const processingMs = optionalNumber(data.processingMs, 'Processing time');
  const classificationCount = optionalNumber(data.classificationCount, 'Classification decisions');
  const elapsedSeconds = optionalNumber(data.elapsedSeconds, 'Measurement elapsed time');
  if (processingMs === null || classificationCount === null || elapsedSeconds === null || elapsedSeconds <= 0) {
    throw new Error('Processing time, decision count, and elapsed time greater than zero are required.');
  }
  if (!Number.isInteger(classificationCount)) throw new Error('Classification decisions must be a whole number.');

  const landmarkAccuracy = optionalNumber(data.landmarkAccuracy, 'Landmark accuracy');
  if (landmarkAccuracy !== null && landmarkAccuracy > 100) {
    throw new Error('Landmark accuracy must be between 0 and 100 percent.');
  }

  const audioValue = data.audioCorrect;
  if (!['yes', 'no', 'na'].includes(audioValue)) throw new Error('Choose an audio evaluation result.');
  const record = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    kind: data.kind,
    expected,
    predicted,
    textCorrect: expected.toLocaleLowerCase() === predicted.toLocaleLowerCase(),
    audioCorrect: audioValue === 'na' ? null : audioValue === 'yes',
    processingMs,
    classificationCount,
    elapsedSeconds,
    classificationRate: classificationCount / elapsedSeconds,
    spatiotemporalMs: optionalNumber(data.spatiotemporalMs, 'Spatial-temporal processing time'),
    landmarkAccuracy,
    testCode: String(data.testCode ?? '').trim()
  };

  const rows = getRecords();
  rows.push(record);
  localStorage.setItem(KEY, JSON.stringify(rows));
  return record;
}

export function recordStaticAttempt(data) {
  return saveRecord({ ...data, kind: 'static' });
}

export function recordDynamicAttempt(data) {
  return saveRecord({ ...data, kind: 'dynamic' });
}

export function clearRecords() {
  localStorage.removeItem(KEY);
}
