function getEyeAspectRatio(eyePoints) {
  const a = distance(eyePoints[1], eyePoints[5]);
  const b = distance(eyePoints[2], eyePoints[4]);
  const c = distance(eyePoints[0], eyePoints[3]);
  return (a + b) / (2 * c);
}

function distance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function estimateBrightness(videoEl) {
  const w = 64;
  const h = 48;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0.5;

  ctx.drawImage(videoEl, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    // relative luminance (approx)
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  const avg = sum / (w * h);
  return avg / 255;
}

export function estimatePassiveLiveness(detection, prevState) {
  const landmarks = detection.landmarks;
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const ear = (getEyeAspectRatio(leftEye) + getEyeAspectRatio(rightEye)) / 2;

  let blinkDetected = false;
  if (prevState.lastEar && prevState.lastEar > 0.26 && ear < 0.2) {
    blinkDetected = true;
  }
  prevState.lastEar = ear;

  const jaw = landmarks.getJawOutline();
  const faceWidth = distance(jaw[0], jaw[16]);
  const nose = landmarks.getNose();
  const faceHeight = distance(nose[0], nose[6]);
  const textureProxy = Math.min(faceHeight / faceWidth, 1);

  const microExpression = Math.max(
    detection.expressions.happy || 0,
    detection.expressions.surprised || 0,
    detection.expressions.neutral || 0
  );

  const score =
    (blinkDetected ? 0.3 : 0.2) + textureProxy * 0.3 + microExpression * 0.3;
  return Math.min(score, 1);
}

export function evaluateActiveSteps(detections) {
  if (!detections.length) return { score: 0, passed: [] };

  const passed = [];

  const happyPassed = detections.some((d) => (d.expressions.happy || 0) > 0.75);
  if (happyPassed) passed.push("smile");

  const yawValues = detections.map((d) => {
    const nose = d.landmarks.getNose();
    const jaw = d.landmarks.getJawOutline();
    const faceCenter = (jaw[0].x + jaw[16].x) / 2;
    return nose[3].x - faceCenter;
  });

  if (yawValues.some((v) => v > 10)) passed.push("turn-right");
  if (yawValues.some((v) => v < -10)) passed.push("turn-left");

  const score = passed.length / 3;
  return { score, passed };
}

export async function runLivenessCheck(videoEl, detectFn, onStatus) {
  const detections = [];
  const passiveState = {};
  const passiveScores = [];
  const FRAME_DELAY_MS = 420;
  const STEP_MAX_FRAMES = 22;

  const ACTIVE_THRESHOLD = 1.0;
  const PASSIVE_THRESHOLD = 0.45;
  const MIN_BRIGHTNESS = 0.22;

  const activeSteps = [
    {
      id: "smile",
      label: "Buoc 1/3: Vui long cuoi ro rang",
      check: (detection) => (detection.expressions.happy || 0) > 0.75,
    },
    {
      id: "turn-left",
      label: "Buoc 2/3: Xoay mat sang trai (giu mat trong khung)",
      check: (detection) => {
      const nose = detection.landmarks.getNose()[3]; // Đầu mũi
      const jaw = detection.landmarks.getJawOutline();
      const leftEdge = jaw[0];  // Mép hàm trái
      const rightEdge = jaw[16]; // Mép hàm phải

      const distToLeft = distance(nose, leftEdge);
      const distToRight = distance(nose, rightEdge);

      // Khi xoay Trái, mũi sẽ gần mép Trái hơn (tỉ lệ < 0.8)
      // Bất kể có lật gương hay không, khoảng cách vật lý này vẫn đúng
      return distToLeft / distToRight < 0.6;      },
    },
    {
      id: "turn-right",
      label: "Buoc 3/3: Xoay mat sang phai (giu mat trong khung)",
      check: (detection) => {
      const nose = detection.landmarks.getNose()[3];
      const jaw = detection.landmarks.getJawOutline();
      const leftEdge = jaw[0];
      const rightEdge = jaw[16];

      const distToLeft = distance(nose, leftEdge);
      const distToRight = distance(nose, rightEdge);

      // Khi xoay Phải, mũi sẽ gần mép Phải hơn
      return distToRight / distToLeft < 0.6;
      },
    },
  ];

  const activeState = {
    currentStepIndex: 0,
    passed: [],
  };

  // Wait a bit for camera to warm up
  await new Promise((resolve) => setTimeout(resolve, 350));

  let frameInStep = 0;
  const totalStepCount = activeSteps.length;

  while (activeState.currentStepIndex < totalStepCount) {
    await new Promise((resolve) => setTimeout(resolve, FRAME_DELAY_MS));
    const currentStep = activeSteps[activeState.currentStepIndex];

    frameInStep += 1;
    const stepProgress = clamp01(frameInStep / STEP_MAX_FRAMES);
    const overallProgress =
      ((activeState.passed.length + stepProgress) / totalStepCount) * 100;

    const brightness = estimateBrightness(videoEl);
    if (brightness < MIN_BRIGHTNESS) {
      onStatus?.(
        `Anh sang thap (≈${Math.round(
          brightness * 100
        )}%). Hay ra noi sang hon. (${Math.round(overallProgress)}%)`
      );
      continue;
    }

    onStatus?.(`${currentStep.label} (${Math.round(overallProgress)}%)`);

    let detection;
    try {
      detection = await detectFn(videoEl);
    } catch (error) {
      onStatus?.(
        `Khong thay ro khuon mat. Hay dua mat vao giua khung. (${Math.round(
          overallProgress
        )}%)`
      );
      continue;
    }
    detections.push(detection);
    passiveScores.push(estimatePassiveLiveness(detection, passiveState));

    if (currentStep.check(detection, activeState)) {
      activeState.passed.push(currentStep.id);
      activeState.currentStepIndex += 1;
      frameInStep = 0;

      if (activeState.currentStepIndex >= activeSteps.length) {
        onStatus?.("Active liveness hop le. Dang tong hop ket qua...");
        break;
      }

      const nextStep = activeSteps[activeState.currentStepIndex];
      onStatus?.(`Hop le. Tiep tuc: ${nextStep.label}`);
      continue;
    }

    if (frameInStep >= STEP_MAX_FRAMES) {
      frameInStep = 0;
      onStatus?.(`Chua hop le. Thu lai: ${currentStep.label}`);
    }
  }

  const active = {
    score: activeState.passed.length / activeSteps.length,
    passed: activeState.passed,
  };
  const passiveAvg = passiveScores.length
    ? passiveScores.reduce((sum, value) => sum + value, 0) / passiveScores.length
    : 0;
  const passed = active.score >= ACTIVE_THRESHOLD && passiveAvg >= PASSIVE_THRESHOLD;
  const reason = !passed
    ? `Khong dat: active=${active.score.toFixed(2)}/${ACTIVE_THRESHOLD.toFixed(
        2
      )}, passive=${passiveAvg.toFixed(2)}/${PASSIVE_THRESHOLD.toFixed(2)}`
    : "";

  return {
    passed,
    activeScore: active.score,
    passiveScore: passiveAvg,
    finalDetection: detections[detections.length - 1],
    activePassedSteps: active.passed,
    thresholds: {
      active: ACTIVE_THRESHOLD,
      passive: PASSIVE_THRESHOLD,
    },
    reason,
  };
}
