export const COMMON_FSL_SIGNS = Object.freeze([
  'Kamusta',
  'Kumusta',
  'Mabuhay',
  'Magandang araw',
  'Salamat',
  'Maraming salamat',
  'Oo',
  'Hindi',
  'Pakiusap',
  'Paumanhin',
  'Paalam',
  'Mahal kita',
  'Tulong',
  'Magandang umaga',
  'Magandang tanghali',
  'Magandang hapon',
  'Magandang gabi'
]);

export const ALPHABET_LABELS = Object.freeze([
  ...Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)),
  'Ñ'
]);

const DYNAMIC_SIGN_LABELS = new Set([...COMMON_FSL_SIGNS, 'J', 'Z']);

export function getDefaultSignType(label) {
  return DYNAMIC_SIGN_LABELS.has(label) ? 'dynamic' : 'static';
}
