import * as faceapi from "face-api.js";

let loadingPromise = null;

export async function loadFaceModels() {
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const modelUrl = "/models";
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
      faceapi.nets.faceExpressionNet.loadFromUri(modelUrl),
    ]);
  })();

  return loadingPromise;
}

export async function detectSingleFaceDescriptor(videoEl) {
  const detection = await faceapi
    .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor()
    .withFaceExpressions();

  return detection;
}
