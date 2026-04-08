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
  const [isSending, setIsSending] = useState(false);
  const [livenessStatus, setLivenessStatus] = useState({ text: "", progress: 0 });
  const [isModelsLoading, setIsModelsLoading] = useState(false);


  const startCamera = async () => {
    setIsChecking(true);
    setLivenessVerified(false);
    setFaceDescriptor(null);
    setToastType("info")
    setLivenessStatus({ text: "", progress: 0 });
    
    try {
      setIsModelsLoading(true);
      await loadFaceModels();
      setIsModelsLoading(false);
      
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = streamRef.current;
      setLivenessStatus({ text: "Bat dau liveness challenge: cuoi, xoay trai, xoay phai. Giu mat trong khung.", progress: 0 });

      const handleStatus = (status) => {
        if (typeof status === 'string') {
          // Parse string to find percentage if object is not passed
          const match = status.match(/\((\d+)%\)/);
          const progress = match ? parseInt(match[1]) : 0;
          setLivenessStatus({ text: status.replace(/\(\d+%\)/, '').trim(), progress });
        } else {
          setLivenessStatus(status);
        }
      };

      const result = await runLivenessCheck(
        videoRef.current,
        detectSingleFaceDescriptor,
        handleStatus
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

    try {
      await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ ...form, phone: normalizedPhone, faceDescriptor }),
      });
      setToastType("success");
      setMessage("Dang ky thanh cong. Chuyen sang trang login...");
      setTimeout(() => navigate("/login"), 800);
    } catch (error) {
      setToastType("error");
      setMessage(error.message || "Lỗi kết nối tới máy chủ.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="app-container">
      <div className="page">
        <div className="auth-header">
          <h1>Tạo Tài Khoản</h1>
          <p>Scan khuôn mặt để bật chế độ bảo mật sinh trắc học</p>
        </div>
        
        <form onSubmit={submit} className="card">
          <div className="input-group">
            <label>Họ và tên</label>
            <input
              placeholder="Nhập họ và tên..."
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>
          
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="Nhập địa chỉ email..."
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          
          <div className="row">
            <div className="input-group">
              <label>Số điện thoại</label>
              <input
                placeholder="Nhập SĐT..."
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            
            <div className="input-group">
              <label>Mật khẩu</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu..."
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
          </div>
          <small>{PASSWORD_HINT}</small>

          <div className="biometrics-section">
            <div className="video-wrap">
              <video ref={videoRef} autoPlay muted playsInline/>
              
              {(isChecking || isCapturing) && (
                <div className={`face-guide ${livenessVerified ? 'active' : ''}`} />
              )}

              {isCapturing && (
                <div className={`scanner-overlay active`} />
              )}
            </div>
            
            {(isChecking && livenessStatus.text) && (
              <div style={{ width: '100%' }}>
                <div className="status-text">{livenessStatus.text}</div>
                <div className="progress-container">
                  <div 
                    className="progress-bar" 
                    style={{ width: `${livenessStatus.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="row">
            <button type="button" className="secondary" onClick={startCamera} disabled={isChecking || isModelsLoading || isCapturing}>
              {isModelsLoading ? (
                <><span className="spinner"></span> Tải mô hình AI...</>
              ) : isChecking ? "Đang phân tích..." : "1. Xác thực Sinh trắc"}
            </button>
            <button 
              type="button" 
              className="secondary"
              onClick={startAutoCapture} 
              disabled={!livenessVerified || isCapturing}
            >
              {isCapturing ? "Đang lấy chuỗi nhị phân..." : "2. Lưu trữ Face ID"}
            </button>
          </div>
          
          <button type="submit" disabled={isSending}>
            {isSending ? <><span className="spinner"></span> Đang kết nối...</> : "Đăng ký Hệ thống"}
          </button>
        </form>
        
        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
        </p>
      </div>
      <Toast message={message} type={toastType} onClose={() => setMessage("")} />
    </div>
  );
}
