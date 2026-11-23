import assert from 'node:assert/strict';
import test from 'node:test';
import { getCameraAccessError, openCamera } from '../src/camera.js';

test('explains that mobile cameras require the HTTPS site, not a PC LAN address', () => {
  assert.match(getCameraAccessError(false, true), /HTTPS/i);
  assert.match(getCameraAccessError(false, true), /computer IP/i);
});

test('reports unsupported camera APIs and accepts supported secure contexts', () => {
  assert.match(getCameraAccessError(true, false), /does not support camera access/i);
  assert.equal(getCameraAccessError(true, true), null);
});

test('prefers the front camera by default while honoring an explicit camera choice', async () => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const secureContextDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext');
  const requests = [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async constraints => {
          requests.push(constraints);
          return {};
        }
      }
    }
  });
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true });

  try {
    await openCamera();
    await openCamera('selected-camera');
  } finally {
    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    } else {
      delete globalThis.navigator;
    }
    if (secureContextDescriptor) {
      Object.defineProperty(globalThis, 'isSecureContext', secureContextDescriptor);
    } else {
      delete globalThis.isSecureContext;
    }
  }

  assert.deepEqual(requests[0].video.facingMode, { ideal: 'user' });
  assert.equal(requests[0].video.deviceId, undefined);
  assert.deepEqual(requests[1].video.deviceId, { exact: 'selected-camera' });
  assert.equal(requests[1].video.facingMode, undefined);
});
