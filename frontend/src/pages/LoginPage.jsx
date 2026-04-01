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

  const verifyPassword = async (e) => {
    e.preventDefault();
    try {
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
    try {
      await loadFaceModels();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
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
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      setToastType("success");
      setMessage("Da xac thuc nguoi that. Dang tien hanh dang nhap khuon mat...");

      const loginResult = await apiRequest("/auth/login/face", {
        method: "POST",
        body: JSON.stringify({
          userId: passwordResult.userId,
          faceDescriptor: Array.from(result.finalDetection.descriptor),
          activeLivenessScore: result.activeScore,
          passiveLivenessScore: result.passiveScore,
        }),
      });

      stream.getTracks().forEach((t) => t.stop());
      login(loginResult.token, loginResult.user);
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
    <div className="page">
      <h1>Login 2 Layer (Password -{">"} Face ID + Liveness)</h1>

      {step === "password" && (
        <form onSubmit={verifyPassword} className="card">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit">Xac thuc mat khau</button>
        </form>
      )}

      {step === "face" && (
        <div className="card">
          <div className="video-wrap">
            <video ref={videoRef} autoPlay muted width="320" height="240" />
            <div className="face-guide" />
          </div>
          <button onClick={startFaceLogin} disabled={isChecking}>
            {isChecking ? "Dang kiem tra..." : "Bat dau Face + Liveness"}
          </button>
        </div>
      )}

      <Toast message={message} type={toastType} onClose={() => setMessage("")} />
      <p>
        Chua co tai khoan? <Link to="/register">Dang ky</Link>
      </p>
    </div>
  );
}
