export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new Error('Camera access is unavailable. Use a supported browser on localhost or HTTPS.');
  }
  return (await navigator.mediaDevices.enumerateDevices())
    .filter(device => device.kind === 'videoinput');
}

export async function openCamera(deviceId) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access requires a supported browser and a localhost or HTTPS page.');
  }
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
