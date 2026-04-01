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
  const { token, user, logout, setUser } = useAuth();
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
        setUser(data);
        console.log(data)
      })
      .catch((error) => {
        setToastType("error");
        setMessage(error.message);
      });
  }, [setUser, token]);

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
    <div className="page">
      <h1>Trang Chinh</h1>
      <div className="card">
        <p>
          <b>Ho ten:</b> {profile?.fullName || user?.fullName}
        </p>
        <p>
          <b>Email:</b> {profile?.email || user?.email}
        </p>
        <p>
          <b>SDT:</b> {profile?.phone || user?.phone || "-"}
        </p>
      </div>

      <form onSubmit={changePassword} className="card">
        <h3>Change Password</h3>
        <input
          type="password"
          placeholder="Old password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <small>{PASSWORD_HINT}</small>
        <button type="submit">Cap nhat</button>
      </form>

      <button onClick={onLogout}>Dang xuat</button>
      <Toast message={message} type={toastType} onClose={() => setMessage("")} />
    </div>
  );
}
