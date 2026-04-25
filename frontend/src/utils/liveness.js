import { detectSingleFaceDescriptor } from "../lib/face";

export const ALL_CHALLENGES = [
  { id: "smile", label: "Vui lòng cười rõ ràng" },
  { id: "turn-left", label: "Xoay mặt sang trái" },
  { id: "turn-right", label: "Xoay mặt sang phải" },
  { id: "look-up", label: "Ngước mặt lên trên" },
  { id: "look-down", label: "Cúi mặt xuống dưới" }
];

function captureFrameBase64(videoEl) {
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth || 640;
  canvas.height = videoEl.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

function getEyeAspectRatio(eyePoints) {
  const a = Math.hypot(eyePoints[1].x - eyePoints[5].x, eyePoints[1].y - eyePoints[5].y);
  const b = Math.hypot(eyePoints[2].x - eyePoints[4].x, eyePoints[2].y - eyePoints[4].y);
  const c = Math.hypot(eyePoints[0].x - eyePoints[3].x, eyePoints[0].y - eyePoints[3].y);
  return (a + b) / (2 * c);
}

export async function runLivenessCheck(videoEl, onStatus) {
  let shuffled = [...ALL_CHALLENGES].sort(() => 0.5 - Math.random());
  const selectedChallenges = shuffled.slice(0, 3);
  
  const proofs = [];

  // 1. Capture neutral frame first
  onStatus?.("Vui lòng giữ khuôn mặt ở giữa khung hình...");
  let neutralCaptured = false;
  let neutralAttempts = 0;
  while (!neutralCaptured && neutralAttempts < 100) {
    neutralAttempts++;
    await new Promise(resolve => setTimeout(resolve, 100));
    const detection = await detectSingleFaceDescriptor(videoEl);
    if (detection && detection.detection.score > 0.8) {
      proofs.push({ challenge: "neutral", image: captureFrameBase64(videoEl) });
      neutralCaptured = true;
    }
  }

  if (!neutralCaptured) {
    return { passed: false, reason: "Không tìm thấy khuôn mặt rõ nét ban đầu" };
  }

  // 2. Run random challenges
  for (let i = 0; i < selectedChallenges.length; i++) {
    const challenge = selectedChallenges[i];
    onStatus?.(`BƯỚC ${i + 1}/${selectedChallenges.length}: ${challenge.label}`);

    let passed = false;
    let attempts = 0;
    while (!passed && attempts < 150) { // Timeout sau ~15 giây
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const detection = await detectSingleFaceDescriptor(videoEl);
      if (!detection) continue;

      const expressions = detection.expressions;
      const landmarks = detection.landmarks;

      if (challenge.id === "smile") {
        if (expressions.happy > 0.5) passed = true;
      } 
      else if (challenge.id === "turn-left" || challenge.id === "turn-right") {
        const nose = landmarks.getNose()[3];
        const jaw = landmarks.getJawOutline();
        const distToLeft = Math.hypot(nose.x - jaw[0].x, nose.y - jaw[0].y);
        const distToRight = Math.hypot(nose.x - jaw[16].x, nose.y - jaw[16].y);
        
        if (challenge.id === "turn-left" && (distToRight / distToLeft) < 0.6) passed = true;
        if (challenge.id === "turn-right" && (distToLeft / distToRight) < 0.6) passed = true;
      }
      else if (challenge.id === "look-up" || challenge.id === "look-down") {
        const noseTip = landmarks.getNose()[3];
        const leftEyeCenter = landmarks.getLeftEye().reduce((acc, curr) => ({ x: acc.x + curr.x / 6, y: acc.y + curr.y / 6 }), { x: 0, y: 0 });
        const mouthTop = landmarks.getMouth()[3];
        const eyeToNose = noseTip.y - leftEyeCenter.y;
        const noseToMouth = mouthTop.y - noseTip.y;
        
        if (challenge.id === "look-up" && (noseToMouth / (eyeToNose || 1)) > 1.2) passed = true;
        if (challenge.id === "look-down" && (eyeToNose / (noseToMouth || 1)) > 1.5) passed = true;
      }
    }
    
    if (!passed) {
      return { passed: false, reason: `Thời gian chờ quá lâu ở bước: ${challenge.label}` };
    }
    
    // Capture the frame when challenge is passed
    proofs.push({ challenge: challenge.id, image: captureFrameBase64(videoEl) });

    onStatus?.(`Hoàn thành: ${challenge.label}`);
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  onStatus?.("Xác thực Liveness thành công. Đang xử lý đăng nhập...");
  
  return {
    passed: true,
    proofs
  };
}
