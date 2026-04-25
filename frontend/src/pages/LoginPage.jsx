import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { loadFaceModels } from "../lib/face";
import { runLivenessCheck } from "../utils/liveness";
import Toast from "../components/Toast";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [message, setMessage] = useState("");
  const [toastType, setToastType] = useState("info");
  
  const [isChecking, setIsChecking] = useState(false);
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

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setToastType("error");
      setMessage("Vui lòng nhập đầy đủ Email và Mật khẩu trước.");
      return;
    }

    try {
      const statusRes = await apiRequest("/api/auth/check-status", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      if (statusRes.locked) {
        setToastType("error");
        setMessage(`Tài khoản đã bị khóa. Vui lòng thử lại sau ${statusRes.waitMinutes} phút.`);
        return;
      }
    } catch (err) {
      setToastType("error");
      setMessage(err.message || "Không thể kiểm tra trạng thái tài khoản");
      return;
    }

    setIsChecking(true);
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

      setToastType("info");
      setMessage("Đã thu thập dữ liệu Liveness thành công. Đang xử lý đăng nhập...");
      setIsSending(true);

      const loginResult = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          sessionToken,
          proofs: result.proofs
        }),
      });

      stopCamera();
      login(loginResult.token);
      setToastType("success");
      setMessage("Đăng nhập thành công.");
      navigate("/main");
    } catch (error) {
      stopCamera();
      setToastType("error");
      setMessage(error.message || "Đăng nhập thất bại");
    } finally {
      setIsChecking(false);
      setIsSending(false);
    }
  };

  return (
    <div className="app-container">
      <div className="page">
        <div className="auth-header">
          <h1>Đăng Nhập 2 Lớp</h1>
          <p>Mật khẩu &amp; Sinh trắc học Face ID</p>
        </div>

        <form onSubmit={handleLogin} className="card">
          <div className="input-group">
            <label>Tài khoản Email</label>
            <input
              type="email"
              placeholder="Nhập email của bạn..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isChecking || isSending}
            />
          </div>
          
          <div className="input-group">
            <label>Mật khẩu</label>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isChecking || isSending}
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

          {(isChecking || isSending) && (
            <div className="biometrics-section" style={{ borderTop: 'none', paddingTop: 0, marginTop: '1rem' }}>
              <div className="video-wrap">
                <video ref={videoRef} autoPlay muted playsInline />
                
                {isChecking && (
                  <div className={`face-guide active`} />
                )}

                {isChecking && livenessStatus.text?.includes("Dang tong hop ket qua") && (
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
          )}
          
          <div className="row" style={{ marginTop: '1rem' }}>
            <button type="submit" disabled={isChecking || isSending || isModelsLoading} style={{ flex: 1 }}>
              {isModelsLoading ? (
                <><span className="spinner"></span> Đang tải mô hình...</>
              ) : isSending ? (
                <><span className="spinner"></span> Đang xác thực...</>
              ) : isChecking ? (
                "Đang quét khuôn mặt..."
              ) : (
                "Bật Camera để Đăng nhập"
              )}
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
        </form>

        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </p>
      </div>
      <Toast message={message} type={toastType} onClose={() => setMessage("")} />
    </div>
  );
}
