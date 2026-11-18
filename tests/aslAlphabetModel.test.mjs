import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as ort from 'onnxruntime-web/wasm';

ort.env.wasm.numThreads = 1;

test('bundled alphabet ONNX model accepts 63 landmark values and returns 36 scores', async () => {
  const model = new Uint8Array(await readFile('models/asl-landmark-mlp.onnx'));
  const session = await ort.InferenceSession.create(model, {
    executionProviders: ['wasm']
  });
  try {
    const input = new ort.Tensor('float32', new Float32Array(63), [1, 63]);
    const result = await session.run({ [session.inputNames[0]]: input });
    const output = result[session.outputNames[0]];

    assert.deepEqual(output.dims, [1, 36]);
    assert.ok(Array.from(output.data).every(Number.isFinite));
  } finally {
    await session.release();
  }
});
