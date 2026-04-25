import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";
import { loadFaceModels } from "../lib/face";
import { runLivenessCheck } from "../utils/liveness";
import Toast from "../components/Toast";
import PasswordStrength from "../components/PasswordStrength";
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
  const [showPassword, setShowPassword] = useState(false);
  
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [message, setMessage] = useState("");
  const [toastType, setToastType] = useState("info");
  
  const [isChecking, setIsChecking] = useState(false);
  const [livenessVerified, setLivenessVerified] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [livenessStatus, setLivenessStatus] = useState({ text: "", progress: 0 });
  const [isModelsLoading, setIsModelsLoading] = useState(false);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setIsChecking(true);
    setLivenessVerified(false);
    setFaceDescriptor(null);
    setToastType("info");
    setLivenessStatus({ text: "", progress: 0 });
    
    try {
      setIsModelsLoading(true);
      await loadFaceModels();
      setIsModelsLoading(false);
      
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = streamRef.current;
      setLivenessStatus({ text: "Đang khởi tạo phiên bảo mật...", progress: 0 });

      // Fetch challenge token
      const challengeRes = await apiRequest("/api/auth/challenge");
      const sessionToken = challengeRes.sessionToken;

      setLivenessStatus({ text: "Chuẩn bị kiểm tra Liveness...", progress: 0 });

      const handleStatus = (status) => {
        if (typeof status === 'string') {
          const match = status.match(/\((\d+)%\)/);
          const progress = match ? parseInt(match[1]) : 0;
          setLivenessStatus({ text: status.replace(/\(\d+%\)/, '').trim(), progress });
        } else {
          setLivenessStatus(status);
        }
      };

      const result = await runLivenessCheck(
        videoRef.current,
        handleStatus
      );
      
      if (!result.passed) {
        setToastType("error");
        setMessage(`Liveness chưa đạt. ${result.reason}. Vui lòng thử lại.`);
        stopCamera();
        setIsChecking(false);
        return;
      }

      setLivenessVerified(true);
      setFaceDescriptor({ proofs: result.proofs, sessionToken });
      setToastType("success");
      setMessage("Đã xác thực Liveness người thật. Bạn có thể bấm Đăng ký.");
      stopCamera();
    } catch (error) {
      setToastType("error");
      setMessage(error.message || "Khong the bat camera/liveness");
      stopCamera();
    } finally {
      setIsChecking(false);
    }
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

    setIsSending(true);
    try {
      await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ 
          ...form, 
          phone: normalizedPhone, 
          sessionToken: faceDescriptor.sessionToken,
          proofs: faceDescriptor.proofs
        }),
      });
      setToastType("success");
      setMessage("Dang ky thanh cong. Chuyen sang trang login...");
      setTimeout(() => navigate("/login"), 800);
    } catch (error) {
      setToastType("error");
      setMessage(error.message || "Lỗi kết nối tới máy chủ.");
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
            <div className="input-group" style={{ flex: 1 }}>
              <label>Số điện thoại</label>
              <input
                placeholder="Nhập SĐT..."
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            
            <div className="input-group" style={{ flex: 1 }}>
              <label>Mật khẩu</label>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập mật khẩu..."
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '5px',
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    padding: '5px'
                  }}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>
          </div>
          <PasswordStrength password={form.password} />

          <div className="biometrics-section" style={{ marginTop: '1rem' }}>
            <div className="video-wrap">
              <video ref={videoRef} autoPlay muted playsInline/>
              
              {isChecking && (
                <div className={`face-guide active`} />
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
            
            {livenessVerified && (
              <div style={{ marginTop: '0.5rem', color: '#2e7d32', fontWeight: 'bold', textAlign: 'center' }}>
                ✓ Đã lấy dữ liệu khuôn mặt
              </div>
            )}
          </div>

          <div className="row" style={{ marginTop: '1rem' }}>
            <button 
              type="button" 
              className="secondary" 
              onClick={startCamera} 
              disabled={isChecking || isModelsLoading}
              style={{ flex: 1 }}
            >
              {isModelsLoading ? (
                <><span className="spinner"></span> Tải mô hình AI...</>
              ) : isChecking ? "Đang phân tích..." : (livenessVerified ? "Quét lại khuôn mặt" : "Bật Camera Quét Khuôn Mặt")}
            </button>
            
            {isChecking && (
              <button 
                type="button" 
                className="secondary" 
                onClick={() => {
                  stopCamera();
                  setIsChecking(false);
                  setLivenessStatus({ text: "", progress: 0 });
                }} 
                style={{ marginLeft: '10px' }}
              >
                Tắt Camera
              </button>
            )}
          </div>
          
          <button type="submit" disabled={isSending || !livenessVerified} style={{ marginTop: '1rem' }}>
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
