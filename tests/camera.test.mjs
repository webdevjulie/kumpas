import assert from 'node:assert/strict';
import test from 'node:test';
import { getCameraAccessError } from '../src/camera.js';

test('explains that mobile cameras require the HTTPS site, not a PC LAN address', () => {
  assert.match(getCameraAccessError(false, true), /HTTPS/i);
  assert.match(getCameraAccessError(false, true), /computer IP/i);
});

test('reports unsupported camera APIs and accepts supported secure contexts', () => {
  assert.match(getCameraAccessError(true, false), /does not support camera access/i);
  assert.equal(getCameraAccessError(true, true), null);
});
