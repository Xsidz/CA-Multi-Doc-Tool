"use client";

import * as React from "react";

type ToastVariant = "default" | "destructive";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
}

type ToastAction =
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "REMOVE_TOAST"; id: string };

const toastReducer = (state: ToastState, action: ToastAction): ToastState => {
  switch (action.type) {
    case "ADD_TOAST":
      return { toasts: [action.toast, ...state.toasts].slice(0, 5) };
    case "REMOVE_TOAST":
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
};

const ToastContext = React.createContext<{
  toasts: Toast[];
  toast: (opts: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(toastReducer, { toasts: [] });

  function toast(opts: Omit<Toast, "id">) {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: "ADD_TOAST", toast: { id, ...opts } });
    setTimeout(
      () => dispatch({ type: "REMOVE_TOAST", id }),
      opts.duration ?? 5000
    );
  }

  function dismiss(id: string) {
    dispatch({ type: "REMOVE_TOAST", id });
  }

  return (
    <ToastContext.Provider value={{ toasts: state.toasts, toast, dismiss }}>
      {children}
      <ToastList />
    </ToastContext.Provider>
  );
}

function ToastList() {
  const ctx = React.useContext(ToastContext);
  if (!ctx || ctx.toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-xl border p-4 shadow-lg flex items-start justify-between gap-3 ${
            t.variant === "destructive"
              ? "bg-destructive text-destructive-foreground border-destructive/50"
              : "bg-white text-foreground border-border"
          }`}
        >
          <div>
            {t.title && <p className="text-sm font-semibold">{t.title}</p>}
            {t.description && <p className="text-sm opacity-90 mt-0.5">{t.description}</p>}
          </div>
          <button
            onClick={() => ctx.dismiss(t.id)}
            className="opacity-70 hover:opacity-100 flex-shrink-0 mt-0.5"
          >
            <span className="text-sm">✕</span>
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return { toast: ctx.toast, dismiss: ctx.dismiss, toasts: ctx.toasts };
}
