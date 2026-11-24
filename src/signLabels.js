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
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
]);

const DYNAMIC_SIGN_LABELS = new Set([...COMMON_FSL_SIGNS, 'J', 'Z']);

export function getDefaultSignType(label) {
  return DYNAMIC_SIGN_LABELS.has(label) ? 'dynamic' : 'static';
}
