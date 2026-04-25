import path from "path";
import fs from "fs";
import * as canvas from "canvas";
import * as tf from "@tensorflow/tfjs";
import * as faceapi from "@vladmandic/face-api/dist/face-api.node-wasm.js";

// Monkey patch for Node.js
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_URL = path.join(process.cwd(), "models");

let modelsLoaded = false;

export async function initAiModels() {
  if (modelsLoaded) return;
  try {
    console.log("Initializing TFJS backend...");
    await tf.ready();
    console.log("Loading AI models from", MODEL_URL);
    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_URL);
    // faceExpressionNet is no longer strictly needed on backend if liveness is on frontend, but keeping it is fine.
    modelsLoaded = true;
    console.log("AI models loaded successfully.");
  } catch (error) {
    console.error("Failed to load AI models:", error);
  }
}

// Hàm nạp ảnh từ base64
async function loadImageFromBase64(base64) {
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    // Xử lý base64 data URI
    const dataPrefix = "data:image/jpeg;base64,";
    const dataPrefixPng = "data:image/png;base64,";
    if (base64.startsWith(dataPrefix) || base64.startsWith(dataPrefixPng)) {
      img.src = base64;
    } else {
      img.src = "data:image/jpeg;base64," + base64;
    }
  });
}

// Phân tích toàn diện 1 khung hình
export async function analyzeFrame(base64Image) {
  if (!modelsLoaded) throw new Error("AI models are not loaded yet.");
  
  const img = await loadImageFromBase64(base64Image);
  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    return { faceDetected: false };
  }

  return {
    faceDetected: true,
    descriptor: Array.from(detection.descriptor),
    landmarks: detection.landmarks
  };
}

export async function verifyLivenessVariance(proofs) {
  if (!proofs || proofs.length < 2) return { passed: false, failReason: "Không đủ số lượng ảnh liveness" };

  const analyses = [];
  for (const proof of proofs) {
    const analysis = await analyzeFrame(proof.image);
    if (!analysis.faceDetected) {
      return { passed: false, failReason: `Không nhận diện được mặt ở bước: ${proof.challenge}` };
    }
    analyses.push(analysis);
  }

  // Check identity match across all frames
  const baseDescriptor = analyses[0].descriptor;
  for (let i = 1; i < analyses.length; i++) {
    const dist = euclideanDistance(baseDescriptor, analyses[i].descriptor);
    if (dist > 0.5) {
      return { passed: false, failReason: "Khuôn mặt không khớp giữa các bước liveness" };
    }
  }

  // Calculate landmark variance
  // If static photo, landmarks will be almost exactly the same
  const baseLandmarks = analyses[0].landmarks.positions;
  let maxDisplacement = 0;

  for (let i = 1; i < analyses.length; i++) {
    const currentLandmarks = analyses[i].landmarks.positions;
    let totalDist = 0;
    for (let j = 0; j < baseLandmarks.length; j++) {
      const dx = baseLandmarks[j].x - currentLandmarks[j].x;
      const dy = baseLandmarks[j].y - currentLandmarks[j].y;
      totalDist += Math.sqrt(dx * dx + dy * dy);
    }
    const avgDist = totalDist / baseLandmarks.length;
    if (avgDist > maxDisplacement) maxDisplacement = avgDist;
  }

  // If average landmark movement is less than 1.5 pixels across all frames, it's likely a static photo
  if (maxDisplacement < 1.5) {
    return { passed: false, failReason: "Phát hiện ảnh tĩnh giả mạo (Không có chuyển động)" };
  }

  return { passed: true, descriptor: baseDescriptor, failReason: "" };
}

export function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}
