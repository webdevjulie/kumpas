import { HandLandmarker } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';

const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

export async function createHandLandmarker() {
  return HandLandmarker.createFromOptions({ wasmLoaderPath, wasmBinaryPath }, {
    baseOptions: { modelAssetPath: MODEL },
    runningMode: 'VIDEO',
    numHands: 2
  });
}

export function detectHands(landmarker, video, timestamp) {
  const result = landmarker.detectForVideo(video, timestamp);
  return result.landmarks?.slice(0, 2) ?? [];
}

export function drawLandmarks(context, hands, width, height) {
  context.clearRect(0, 0, width, height);
  if (!hands.length) return;

  context.strokeStyle = '#7d9bff';
  context.lineWidth = Math.max(2, width * 0.0047);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const hand of hands) {
    context.beginPath();
    for (const [start, end] of HAND_CONNECTIONS) {
      context.moveTo(hand[start].x * width, hand[start].y * height);
      context.lineTo(hand[end].x * width, hand[end].y * height);
    }
    context.stroke();
  }
}
