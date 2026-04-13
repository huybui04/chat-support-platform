/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { ToastMessage } from "../components/common/toast-message";

type ToastTone = "success" | "error";

type ToastState = {
  tone: ToastTone;
  message: string;
};

type ToastContextValue = {
  showToast: (tone: ToastTone, message: string) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((tone: ToastTone, message: string) => {
    setToast({ tone, message });
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      showSuccess: (message) => showToast("success", message),
      showError: (message) => showToast("error", message),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div className="toast-stack">
          <ToastMessage
            tone={toast.tone}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
