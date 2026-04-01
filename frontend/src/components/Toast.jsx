import { useEffect } from "react";

export default function Toast({
  message,
  type = "info",
  onClose,
  durationMs = 3500,
}) {
  if (!message) return null;

  useEffect(() => {
    if (!durationMs) return undefined;
    const t = setTimeout(() => onClose?.(), durationMs);
    return () => clearTimeout(t);
  }, [durationMs, message, onClose]);

  return (
    <div className={`toast toast-${type}`}>
      <span>{message}</span>
      <button type="button" className="toast-close" onClick={onClose}>
        x
      </button>
    </div>
  );
}
