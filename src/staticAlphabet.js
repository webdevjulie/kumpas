const FINGERS = [
  { tip: 8, mcp: 5 },
  { tip: 12, mcp: 9 },
  { tip: 16, mcp: 13 },
  { tip: 20, mcp: 17 }
];

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function isExtended(ratio) {
  return ratio > 1.08;
}

function isFolded(ratio) {
  return ratio < 0.96;
}

export function classifyStaticLetter(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length !== 21
    || !landmarks.every(point => point
      && [point.x, point.y, point.z].every(Number.isFinite))) return null;

  const wrist = landmarks[0];
  const palmScale = distance(wrist, landmarks[9]);
  if (!Number.isFinite(palmScale) || palmScale < 1e-6) return null;

  const ratios = FINGERS.map(({ tip, mcp }) =>
    distance(landmarks[tip], wrist) / distance(landmarks[mcp], wrist)
  );
  if (!ratios.every(Number.isFinite)) return null;

  const [indexUp, middleUp, ringUp, pinkyUp] = ratios.map(isExtended);
  const [indexDown, middleDown, ringDown, pinkyDown] = ratios.map(isFolded);
  const thumbExtended =
    distance(landmarks[4], wrist) > distance(landmarks[3], wrist) * 1.12;
  const thumbIndexGap = distance(landmarks[4], landmarks[8]) / palmScale;
  const fingerGap = distance(landmarks[8], landmarks[12]) / palmScale;
  const allDown = indexDown && middleDown && ringDown && pinkyDown;
  const allUp = indexUp && middleUp && ringUp && pinkyUp;

  let label = null;
  if (allUp) {
    label = 'B';
  } else if (indexUp && middleUp && ringUp && pinkyDown) {
    label = 'W';
  } else if (indexUp && middleUp && ringDown && pinkyDown) {
    if (fingerGap < 0.48) label = 'U';
    else if (fingerGap > 0.62) label = 'V';
  } else if (indexDown && middleUp && ringUp && pinkyUp && thumbIndexGap < 0.55) {
    label = 'F';
  } else if (indexUp && middleDown && ringDown && pinkyDown) {
    label = thumbExtended ? 'L' : 'D';
  } else if (indexDown && middleDown && ringDown && pinkyUp) {
    label = thumbExtended ? 'Y' : 'I';
  } else if (allDown) {
    const fingertipGap = FINGERS.reduce((sum, { tip }) =>
      sum + distance(landmarks[4], landmarks[tip]) / palmScale, 0
    ) / FINGERS.length;
    if (thumbExtended && thumbIndexGap >= 0.36) label = 'A';
    else if (thumbIndexGap < 0.36 && fingertipGap < 0.62) label = 'O';
  } else if (ratios.every(ratio => ratio >= 0.94 && ratio <= 1.12)
    && thumbIndexGap >= 0.4 && thumbIndexGap <= 1.05) {
    label = 'C';
  }

  if (!label) return null;

  const minimumMargin = Math.min(...ratios.map((ratio, index) =>
    ([indexUp, middleUp, ringUp, pinkyUp][index] ? ratio - 1.08 : 0.96 - ratio)
  ));
  const matchScore = Math.min(0.95, 0.84 + Math.max(0, minimumMargin) * 0.1);
  return { label, matchScore };
}
