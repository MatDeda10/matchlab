"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";

interface Toast {
  id: number;
  message: string;
  tone: "ok" | "warn" | "info";
}

interface ToastContextValue {
  push: (message: string, tone?: Toast["tone"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none">
        {toasts.map((toast) => {
          const Icon = toast.tone === "ok" ? CheckCircle2 : toast.tone === "warn" ? TriangleAlert : Info;
          return (
            <div key={toast.id} className="toast pointer-events-auto">
              <Icon
                className={`size-4 shrink-0 ${toast.tone === "ok" ? "text-ok" : toast.tone === "warn" ? "text-warn" : "text-info"}`}
                aria-hidden
              />
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast richiede ToastProvider");
  return context;
}
