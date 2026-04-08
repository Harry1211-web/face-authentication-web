import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";
import Toast from "../components/Toast";
import {
  PASSWORD_HINT,
  validateStrongPassword,
} from "../utils/passwordPolicy";

export default function MainPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [toastType, setToastType] = useState("info");

  useEffect(() => {
    apiRequest("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => {
        setProfile(data);
      })
      .catch((error) => {
        setToastType("error");
        setMessage(error.message);
      });
  }, [token]);

  const changePassword = async (e) => {
    e.preventDefault();
    if (!validateStrongPassword(newPassword)) {
      setToastType("error");
      setMessage(PASSWORD_HINT);
      return;
    }

    try {
      await apiRequest("/api/users/me/password", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setToastType("success");
      setMessage("Doi mat khau thanh cong.");
      setOldPassword("");
      setNewPassword("");
    } catch (error) {
      setToastType("error");
      setMessage(error.message || "Doi mat khau that bai");
    }
  };

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-container">
      <div className="page dashboard">
        <div className="auth-header">
          <h1>Hồ Sơ Của Bạn</h1>
          <p>Quản lý tài khoản và bảo mật</p>
        </div>

        <div className="row">
          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              Thông Tin Sinh Trắc
            </h3>
            {profile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="input-group">
                  <label>Họ và tên</label>
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: '#f8fafc' }}>
                    {profile.fullName}
                  </div>
                </div>
                <div className="input-group">
                  <label>Email</label>
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: '#f8fafc' }}>
                    {profile.email}
                  </div>
                </div>
                <div className="input-group">
                  <label>Số điện thoại</label>
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: '#f8fafc' }}>
                    {profile.phone || "Chưa cập nhật"}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#cbd5e1' }}>
                <span className="spinner"></span> Đang tải dữ liệu...
              </div>
            )}
          </div>

          <form onSubmit={changePassword} className="card">
            <h3 style={{ marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              Đổi Mật Khẩu
            </h3>
            
            <div className="input-group">
              <label>Mật khẩu cũ</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu hiện tại..."
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="input-group">
              <label>Mật khẩu mới</label>
              <input
                type="password"
                placeholder="Đổi mật khẩu mới..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <small style={{ marginTop: '-0.5rem' }}>{PASSWORD_HINT}</small>
            
            <button type="submit" style={{ marginTop: 'auto' }}>Cập Nhật Mã Khóa</button>
          </form>
        </div>

        <button 
          className="secondary" 
          onClick={onLogout} 
          style={{ width: '100%', maxWidth: '200px', margin: '2rem auto 0', display: 'block', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}
        >
          Đăng xuất hệ thống
        </button>
        <Toast message={message} type={toastType} onClose={() => setMessage("")} />
      </div>
    </div>
  );
}
