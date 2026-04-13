import { useEffect } from "react";

type ToastMessageProps = {
  message: string;
  tone: "success" | "error";
  onClose: () => void;
};

export function ToastMessage({ message, tone, onClose }: ToastMessageProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onClose, 2400);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message, onClose]);

  return (
    <div className={`toast-message ${tone}`} role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="toast-close" onClick={onClose}>
        x
      </button>
    </div>
  );
}
