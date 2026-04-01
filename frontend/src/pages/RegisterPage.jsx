import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";
import { detectSingleFaceDescriptor, loadFaceModels } from "../lib/face";
import { runLivenessCheck } from "../utils/liveness";
import Toast from "../components/Toast";
import {
  PASSWORD_HINT,
  validateStrongPassword,
} from "../utils/passwordPolicy";

export default function RegisterPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [message, setMessage] = useState("");
  const [toastType, setToastType] = useState("info");
  const [isChecking, setIsChecking] = useState(false);
  const [livenessVerified, setLivenessVerified] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const startCamera = async () => {
    setIsChecking(true);
    setLivenessVerified(false);
    setFaceDescriptor(null);
    try {
      await loadFaceModels();
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = streamRef.current;
      setMessage(
        "Bat dau liveness challenge: cuoi, xoay trai, xoay phai. Giu mat trong khung."
      );

      const result = await runLivenessCheck(
        videoRef.current,
        detectSingleFaceDescriptor,
        setMessage
      );
      if (!result.passed) {
        setToastType("error");
        setMessage(
          `Liveness chua dat. ${result.reason}. Vui long thu lai va giu mat trong khung.`
        );
        return;
      }

      setLivenessVerified(true);
      setToastType("success");
      setMessage("Da xac thuc nguoi that. Dang capture Face ID...");
      const detection = await detectSingleFaceDescriptor(videoRef.current);
      setFaceDescriptor(Array.from(detection.descriptor));
      setMessage("Da xac thuc nguoi that va capture Face ID. Ban co the dang ky.");
    } catch (error) {
      setToastType("error");
      setMessage(error.message || "Khong the bat camera/liveness");
    } finally {
      setIsChecking(false);
    }
  };

  // const captureFace = async () => {
  //     if (!livenessVerified) {
  //       setToastType("error");
  //       setMessage("Cần hoàn thành liveness trước khi capture face.");
  //       return;
  //     }
    
  //     try {
  //       const detection = await detectSingleFaceDescriptor(videoRef.current);
        
  //       if (!detection) {
  //         throw new Error("No face detected");
  //       }
    
  //       setFaceDescriptor(Array.from(detection.descriptor));
  //       setToastType("success");
  //       setMessage("Đã capture Face ID.");
        
  //     } catch (error) {
  //       console.error("Capture error:", error);
    
  //       setToastType("error");
        
  //       if (error.message.includes("No face detected") || error.message.includes("not found")) {
  //         setMessage("Vui lòng đưa khuôn mặt bạn vào vòng tròn và giữ yên.");
  //       } else {
  //         setMessage("Có lỗi xảy ra khi nhận diện, vui lòng thử lại.");
  //       }
  //     }
  //   };


  const startAutoCapture = async () => {
    if (isCapturing || !livenessVerified) return;
    
    setIsCapturing(true);
    let attempts = 0;
    const MAX_ATTEMPTS = 15; // Giới hạn 15 giây thử lại (15 lần x 1s)

  const stopCamera = () => {
    if (streamRef.current) {
      // Lấy tất cả các track (video, audio) từ stream
      streamRef.current.getTracks().forEach((track) => {
        track.stop(); // Dừng track lại
        track.enabled = false; // Vô hiệu hóa track
      });
      
      // Gỡ bỏ nguồn của thẻ video để màn hình đen đi
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      streamRef.current = null; // Reset biến stream
    }
  };

    const attemptCapture = async () => {
      // Nếu quá số lần cho phép hoặc người dùng đã hủy
      if (attempts >= MAX_ATTEMPTS) {
        setToastType("error");
        setMessage("Quá thời gian quét. Vui lòng kiểm tra ánh sáng và thử lại.");
        setIsCapturing(false);
        return;
      }

      try {
        attempts++;
        const detection = await detectSingleFaceDescriptor(videoRef.current);
        
        if (detection) {
          setFaceDescriptor(Array.from(detection.descriptor));
          setToastType("success");
          setMessage("Đã capture Face ID thành công!");
          setIsCapturing(false); // Dừng lại khi thành công
          stopCamera();
        } else {
          throw new Error("No face detected");
        }
      } catch (error) {
        // Giữ thông báo nhẹ nhàng trong quá trình thử lại
        setMessage(`Đang quét... (${attempts}/${MAX_ATTEMPTS})`);
        setTimeout(attemptCapture, 1000); // Đệ quy sau 1 giây
      }
    };

    attemptCapture();
  };

  

  const submit = async (e) => {
    e.preventDefault();
    const normalizedPhone = form.phone.trim();
    if (!validateStrongPassword(form.password)) {
      setToastType("error");
      setMessage(PASSWORD_HINT);
      return;
    }

    if (normalizedPhone && !/^\d{9,15}$/.test(normalizedPhone)) {
      setToastType("error");
      setMessage("SDT khong hop le (chi gom 9-15 chu so).");
      return;
    }

    if (!livenessVerified || !faceDescriptor) {
      setToastType("error");
      setMessage("Ban can hoan thanh liveness va capture face descriptor truoc.");
      return;
    }

    await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...form, phone: normalizedPhone, faceDescriptor }),
    });
    setToastType("success");
    setMessage("Dang ky thanh cong. Chuyen sang trang login...");
    setTimeout(() => navigate("/login"), 800);
  };

  return (
    <div className="page">
      <h1>Register</h1>
      <form onSubmit={submit} className="card">
        <input
          placeholder="Full name"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <small>{PASSWORD_HINT}</small>

        <div className="video-wrap">
          <video ref={videoRef} autoPlay muted width="320" height="240" />
          <div className="face-guide" />
        </div>
        <div className="row">
          <button type="button" onClick={startCamera}>
            {isChecking ? "Dang kiem tra..." : "Bat camera + Liveness"}
          </button>
          <button 
            type="button" 
            onClick={startAutoCapture} 
            disabled={!livenessVerified || isCapturing}
          >
            {isCapturing ? "Đang quét khuôn mặt..." : "Bắt đầu quét Face ID"}
          </button>
        </div>
        <button type="submit">Dang ky</button>
      </form>
      <Toast message={message} type={toastType} onClose={() => setMessage("")} />
      <p>
        Da co tai khoan? <Link to="/login">Dang nhap</Link>
      </p>
    </div>
  );
}
