import * as faceapi from "face-api.js";

let loaded = false;

export async function loadFaceModels() {
  if (loaded) return;
  const modelUrl = "/models";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
    faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
    faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
    faceapi.nets.faceExpressionNet.loadFromUri(modelUrl),
  ]);
  loaded = true;
}

export async function detectSingleFaceDescriptor(videoEl) {
  const detection = await faceapi
    .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor()
    .withFaceExpressions();

  if (!detection) {
    throw new Error("No face detected");
  }
  return detection;
}
