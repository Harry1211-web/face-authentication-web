import { useEffect } from "react";

export default function Toast({
  message,
  type = "info",
  onClose,
  durationMs = 3500,
}) {
  useEffect(() => {
    if (!message || !durationMs) return undefined;
    const t = setTimeout(() => onClose?.(), durationMs);
    return () => clearTimeout(t);
  }, [durationMs, message, onClose]);

  if (!message) return null;

  return (
    <div className={`toast toast-${type}`}>
      <span key={message}>{message}</span>
      
      <button type="button" className="toast-close" onClick={onClose}>
        ×
      </button>
    </div>
  );
}