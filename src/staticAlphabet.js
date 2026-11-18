const FINGERS = [
  { tip: 8, mcp: 5, pip: 6 },
  { tip: 12, mcp: 9, pip: 10 },
  { tip: 16, mcp: 13, pip: 14 },
  { tip: 20, mcp: 17, pip: 18 }
];

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const vector = (a, b) => ({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

function normalize(value) {
  const length = Math.hypot(value.x, value.y, value.z);
  return length > 1e-8
    ? { x: value.x / length, y: value.y / length, z: value.z / length }
    : { x: 0, y: 0, z: 0 };
}

function pointToSegmentDistance(point, start, end) {
  const segment = vector(start, end);
  const lengthSquared = dot(segment, segment);
  if (lengthSquared < 1e-8) return distance(point, start);
  const offset = vector(start, point);
  const position = Math.max(0, Math.min(1, dot(offset, segment) / lengthSquared));
  const closest = {
    x: start.x + segment.x * position,
    y: start.y + segment.y * position,
    z: start.z + segment.z * position
  };
  return distance(point, closest);
}

function bendDegrees(a, joint, c) {
  const first = normalize(vector(joint, a));
  const second = normalize(vector(joint, c));
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(first, second))));
  return 180 - angle * 180 / Math.PI;
}

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
  const palmAxis = normalize(vector(wrist, landmarks[9]));
  const acrossAxis = normalize(vector(landmarks[17], landmarks[5]));
  const fingerDirections = FINGERS.map(({ mcp, tip }) =>
    vector(landmarks[mcp], landmarks[tip])
  );
  const fingerLinearity = FINGERS.map(({ mcp, pip, tip }) =>
    distance(landmarks[mcp], landmarks[tip])
      / (distance(landmarks[mcp], landmarks[pip]) + distance(landmarks[pip], landmarks[tip]))
  );
  const axisProjection = fingerDirections.map(direction => dot(direction, palmAxis) / palmScale);
  const acrossProjection = fingerDirections.map(direction => dot(direction, acrossAxis) / palmScale);
  const isHorizontal = index => Math.abs(axisProjection[index]) < Math.abs(acrossProjection[index]) * 0.7
    && Math.abs(acrossProjection[index]) > 0.35;
  const thumbBetweenIndexAndMiddle =
    pointToSegmentDistance(landmarks[4], landmarks[6], landmarks[10]) / palmScale < 0.42;
  const baseOrder = dot(vector(landmarks[5], landmarks[9]), acrossAxis);
  const tipOrder = dot(vector(landmarks[8], landmarks[12]), acrossAxis);
  const fingersCrossed = baseOrder * tipOrder < 0;
  const thumbToPips = FINGERS.map(({ pip }) =>
    distance(landmarks[4], landmarks[pip]) / palmScale
  );
  const closestThumbFinger = thumbToPips.indexOf(Math.min(...thumbToPips));
  const indexBend = bendDegrees(landmarks[5], landmarks[6], landmarks[7]);

  let label = null;
  if (allUp) {
    label = 'B';
  } else if (indexUp && middleUp && ringUp && pinkyDown) {
    label = 'W';
  } else if (indexUp && middleUp && ringDown && pinkyDown) {
    if (fingersCrossed) label = 'R';
    else if (isHorizontal(0) && isHorizontal(1)) label = 'H';
    else if (thumbBetweenIndexAndMiddle) label = 'K';
    else if (fingerGap < 0.48) label = 'U';
    else if (fingerGap > 0.62) label = 'V';
  } else if (indexDown && middleUp && ringUp && pinkyUp && thumbIndexGap < 0.55) {
    label = 'F';
  } else if (indexBend > 40 && middleDown && ringDown && pinkyDown
    && thumbIndexGap >= 0.36) {
    label = 'X';
  } else if (indexUp && middleDown && ringDown && pinkyDown && thumbExtended && isHorizontal(0)) {
    label = 'G';
  } else if (indexUp && middleDown && ringDown && pinkyDown) {
    label = thumbExtended ? 'L' : 'D';
  } else if (indexDown && middleDown && ringDown && pinkyUp) {
    label = thumbExtended ? 'Y' : 'I';
  } else if (indexDown && middleDown && ringDown && pinkyDown
    && axisProjection[0] < -0.2 && axisProjection[1] < -0.2
    && thumbBetweenIndexAndMiddle && fingerLinearity[0] > 0.9
    && fingerLinearity[1] > 0.9) {
    label = 'P';
  } else if (indexDown && middleDown && ringDown && pinkyDown
    && axisProjection[0] < -0.2 && thumbExtended
    && fingerLinearity[0] > 0.82
    && dot(vector(wrist, landmarks[4]), palmAxis) / palmScale < 0.25) {
    label = 'Q';
  } else if (allDown) {
    const fingertipDistances = FINGERS.map(({ tip }) =>
      distance(landmarks[4], landmarks[tip]) / palmScale
    );
    const fingertipGap = fingertipDistances.reduce((sum, value) => sum + value, 0)
      / FINGERS.length;
    if (thumbExtended && thumbIndexGap >= 0.36 && closestThumbFinger === 0) {
      label = 'A';
    } else if (thumbIndexGap < 0.36 && fingertipGap < 0.55
      && Math.min(...thumbToPips) >= 0.48
      && Math.max(...fingertipDistances) < 0.62) {
      label = 'O';
    } else if (Math.min(...thumbToPips) < 0.48) {
      label = ['T', 'N', 'M', 'M'][closestThumbFinger];
    } else if (thumbExtended && thumbIndexGap >= 0.36) {
      label = 'A';
    } else if (!thumbExtended && thumbIndexGap < 0.72) {
      const fingerDepth = FINGERS.reduce((sum, { tip }) => sum + landmarks[tip].z, 0)
        / FINGERS.length;
      label = landmarks[4].z < fingerDepth - 0.025 ? 'S' : 'E';
    }
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
