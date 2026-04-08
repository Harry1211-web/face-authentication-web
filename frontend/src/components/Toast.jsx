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

  const getIcon = () => {
    switch(type) {
      case "success": return "✅";
      case "error": return "🚨";
      default: return "ℹ️";
    }
  };

  return (
    <div className={`toast toast-${type}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '18px' }}>{getIcon()}</span>
        <span key={message}>{message}</span>
      </div>
      
      <button type="button" className="toast-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}