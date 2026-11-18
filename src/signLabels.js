export const COMMON_FSL_SIGNS = Object.freeze([
  'Kumusta',
  'Salamat',
  'Oo',
  'Hindi',
  'Pakiusap',
  'Paumanhin',
  'Paalam',
  'Mahal kita',
  'Tulong',
  'Magandang umaga',
  'Magandang gabi'
]);

const DYNAMIC_SIGN_LABELS = new Set([...COMMON_FSL_SIGNS, 'J', 'Z']);

export function getDefaultSignType(label) {
  return DYNAMIC_SIGN_LABELS.has(label) ? 'dynamic' : 'static';
}
