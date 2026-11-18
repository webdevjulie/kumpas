import * as ort from 'onnxruntime-web/wasm';
import modelUrl from '../models/asl-landmark-mlp.onnx?url';
import labels from '../models/asl-landmark-classes.json';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { classifyAlphabetLogits, normalizeAslLandmarks } from './aslAlphabetMath.js';
let sessionPromise;

ort.env.wasm.wasmPaths = { wasm: wasmUrl };
ort.env.wasm.numThreads = 1;

export async function loadAslAlphabetModel() {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm']
    });
  }
  return sessionPromise;
}

export async function classifyAslAlphabet(landmarks) {
  const normalized = normalizeAslLandmarks(landmarks);
  if (!normalized) return null;

  const session = await loadAslAlphabetModel();
  const input = new ort.Tensor('float32', normalized, [1, 63]);
  const output = await session.run({ [session.inputNames[0]]: input });
  return classifyAlphabetLogits(output[session.outputNames[0]].data, labels);
}
