export function getCameraAccessError(secureContext, hasGetUserMedia) {
  if (!secureContext) {
    return 'Camera access requires HTTPS. On a phone, open https://webdevjulie.github.io/kumpas/ directly; an HTTP address using your computer IP will not work.';
  }
  if (!hasGetUserMedia) {
    return 'This browser does not support camera access. Open KUMPAS in an updated version of Chrome or Safari.';
  }
  return null;
}

function assertCameraAccess() {
  const error = getCameraAccessError(
    globalThis.isSecureContext,
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
  if (error) throw new Error(error);
}

export async function listCameras() {
  assertCameraAccess();
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new Error('This browser cannot list camera choices. Use the Default camera option or update your browser.');
  }
  return (await navigator.mediaDevices.enumerateDevices())
    .filter(device => device.kind === 'videoinput');
}

export async function openCamera(deviceId) {
  assertCameraAccess();
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  });
}

export function stopCamera(stream) {
  stream?.getTracks().forEach(track => track.stop());
}
