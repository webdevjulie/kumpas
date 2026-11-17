import { getRecords, saveRecord, clearRecords } from './evaluation.js';
import { summarize } from './performanceMetrics.js';

let filter = 'all';
const el = id => document.getElementById(id);
const fmt = (value, suffix = '') => value == null ? '—' : `${value.toFixed(2)}${suffix}`;

function render() {
  const rows = getRecords();
  const summary = summarize(rows, filter);
  el('translationAccuracy').textContent = fmt(summary.translation, '%');
  el('audioAccuracy').textContent = fmt(summary.audioPct, '%');
  el('processingTime').textContent = fmt(summary.processing, ' ms');
  el('classificationRate').textContent = fmt(summary.rate, ' decisions/second');
  el('landmarkAccuracy').textContent = fmt(summary.landmark, '%');
  el('dynamicMotionAccuracy').textContent = fmt(summary.dynamicMotionAudio, '%');
  el('spatiotemporalTime').textContent = fmt(summary.spatial, ' ms');
  el('dynamicRate').textContent = fmt(summary.dynamicRate, ' decisions/second');
  el('attemptCount').textContent = summary.count;

  const shown = filter === 'all' ? rows : rows.filter(record => record.kind === filter);
  const body = el('records');
  body.replaceChildren();
  if (!shown.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 9;
    cell.textContent = 'No tests recorded yet.';
    row.append(cell);
    body.append(row);
    return;
  }

  [...shown].reverse().forEach(record => {
    const row = document.createElement('tr');
    const values = [
      new Date(record.timestamp).toLocaleString(),
      record.kind === 'static' ? 'Static' : 'Dynamic',
      record.expected,
      record.predicted,
      record.textCorrect ? 'Yes' : 'No',
      record.audioCorrect === null ? 'Not assessed' : record.audioCorrect ? 'Yes' : 'No',
      record.processingMs.toFixed(2),
      record.classificationRate.toFixed(2),
      record.landmarkAccuracy == null ? '—' : `${record.landmarkAccuracy.toFixed(2)}%`
    ];
    values.forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
}

document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.kind;
  document.querySelectorAll('[data-kind]').forEach(item =>
    item.classList.toggle('active', item === button)
  );
  render();
}));

el('entry').addEventListener('submit', event => {
  event.preventDefault();
  try {
    saveRecord(Object.fromEntries(new FormData(event.currentTarget)));
    event.currentTarget.reset();
    render();
  } catch (error) {
    alert(`Could not save the test: ${error.message}`);
  }
});

el('export').addEventListener('click', () => {
  const rows = getRecords().filter(record => filter === 'all' || record.kind === filter);
  const columns = [
    'timestamp', 'kind', 'testCode', 'expected', 'predicted', 'textCorrect',
    'audioCorrect', 'processingMs', 'classificationCount', 'elapsedSeconds',
    'classificationRate', 'spatiotemporalMs', 'landmarkAccuracy'
  ];
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [
    columns.join(','),
    ...rows.map(record => columns.map(column => quote(record[column])).join(','))
  ].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `kumpas-${filter}-evaluation.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

el('clear').addEventListener('click', () => {
  if (confirm('Delete all tests saved in this browser?')) {
    clearRecords();
    render();
  }
});

render();
