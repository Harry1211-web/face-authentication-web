import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { detectSingleFaceDescriptor, loadFaceModels } from "../lib/face";
import { runLivenessCheck } from "../utils/liveness";
import Toast from "../components/Toast";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const videoRef = useRef(null);
  const [step, setStep] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordResult, setPasswordResult] = useState(null);
  const [message, setMessage] = useState("");
  const [toastType, setToastType] = useState("info");
  const [isChecking, setIsChecking] = useState(false);
  const autoStartedRef = useRef(false);
  const [isSending, setIsSending] = useState(false);
  const [livenessStatus, setLivenessStatus] = useState({ text: "", progress: 0 });
  const [isModelsLoading, setIsModelsLoading] = useState(false);

  const verifyPassword = async (e) => {
    e.preventDefault();
    try {
      setIsSending(true)
      const result = await apiRequest("/api/auth/login/password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setPasswordResult(result);
      autoStartedRef.current = false;
      setStep("face");
      setToastType("info");
      setMessage("Mat khau dung. Dang mo camera va bat dau liveness...");
    } catch (error) {
      setToastType("error");
      setMessage(error.message || "Xac thuc mat khau that bai");
    }
  };

  const startFaceLogin = async () => {
    setIsChecking(true);
    setLivenessStatus({ text: "", progress: 0 });
    try {
      setIsModelsLoading(true);
      await loadFaceModels();
      setIsModelsLoading(false);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
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
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      setToastType("success");
      setMessage("Da xac thuc nguoi that. Dang tien hanh dang nhap khuon mat...");

      const loginResult = await apiRequest("/api/auth/login/face", {
        method: "POST",
        body: JSON.stringify({
          userId: passwordResult.userId,
          faceDescriptor: Array.from(result.finalDetection.descriptor),
          activeLivenessScore: result.activeScore,
          passiveLivenessScore: result.passiveScore,
        }),
      });

      stream.getTracks().forEach((t) => t.stop());
      login(loginResult.token);
      setToastType("success");
      setMessage("Đăng nhập thành công.");
      navigate("/main");
    } catch (error) {
      setToastType("error");
      setMessage(error.message || "Face login failed");
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (step === "face" && passwordResult && !autoStartedRef.current) {
      autoStartedRef.current = true;
      startFaceLogin();
    }
  }, [step, passwordResult]);

  return (
    <div className="app-container">
      <div className="page">
        <div className="auth-header">
          <h1>Đăng Nhập 2 Lớp</h1>
          <p>Mật khẩu &rsaquo; Sinh trắc học Face ID</p>
        </div>

        {step === "password" && (
          <form onSubmit={verifyPassword} className="card">
            <div className="input-group">
              <label>Tài khoản Email</label>
              <input
                type="email"
                placeholder="Nhập email của bạn..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="input-group">
              <label>Mật khẩu</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <button type="submit" disabled={isSending} style={{ marginTop: '0.5rem' }}>
              {isSending ? <><span className="spinner"></span> Đang xác thực...</> : "Tiếp tục"}
            </button>
          </form>
        )}

        {step === "face" && (
          <div className="card">
            <div className="biometrics-section" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
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

            <button onClick={startFaceLogin} disabled={isChecking || isModelsLoading}>
              {isModelsLoading ? (
                <><span className="spinner"></span> Tải mô hình AI...</>
              ) : isChecking ? "Đang phân tích..." : "1. Xác thực Sinh trắc"}
            </button>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </p>
      </div>
      <Toast message={message} type={toastType} onClose={() => setMessage("")} />
    </div>
  );
}
