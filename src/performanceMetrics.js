export function mean(values) {
  const valid = values.filter(value => Number.isFinite(Number(value))).map(Number);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

export function pct(numerator, denominator) {
  return denominator ? 100 * numerator / denominator : null;
}

function pooledRate(records) {
  const elapsed = records.reduce((sum, record) => sum + record.elapsedSeconds, 0);
  return elapsed
    ? records.reduce((sum, record) => sum + record.classificationCount, 0) / elapsed
    : null;
}

export function summarize(rows, filter) {
  const visible = filter === 'all' ? rows : rows.filter(record => record.kind === filter);
  const staticRows = visible.filter(record => record.kind === 'static');
  const dynamicRows = visible.filter(record => record.kind === 'dynamic');
  const staticAudio = staticRows.filter(record => record.audioCorrect !== null);
  const dynamicAudio = dynamicRows.filter(record => record.audioCorrect !== null);

  return {
    count: visible.length,
    translation: pct(staticRows.filter(record => record.textCorrect).length, staticRows.length),
    audioPct: pct(staticAudio.filter(record => record.audioCorrect).length, staticAudio.length),
    processing: mean(staticRows.map(record => record.processingMs)),
    rate: pooledRate(staticRows),
    landmark: mean(dynamicRows.map(record => record.landmarkAccuracy)),
    dynamicMotionAudio: pct(
      dynamicAudio.filter(record => record.textCorrect && record.audioCorrect).length,
      dynamicAudio.length
    ),
    spatial: mean(dynamicRows.map(record => record.spatiotemporalMs)),
    dynamicRate: pooledRate(dynamicRows)
  };
}
