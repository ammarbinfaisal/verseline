"use client";

import { create } from "zustand";
import { useMountEffect } from "@/hooks/useMountEffect";
import { useRef } from "react";
import { cn } from "./cn";

type ToastKind = "info" | "success" | "error" | "warn";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  durationMs: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (kind: ToastKind, message: string, durationMs?: number) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, message, durationMs = 4000) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, durationMs }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  info: (msg: string) => useToastStore.getState().push("info", msg),
  success: (msg: string) => useToastStore.getState().push("success", msg),
  error: (msg: string) => useToastStore.getState().push("error", msg, 6000),
  warn: (msg: string) => useToastStore.getState().push("warn", msg),
};

const kindStyle: Record<ToastKind, { bg: string; fg: string; icon: string }> = {
  info:    { bg: "var(--surface-1)",  fg: "var(--text)",    icon: "·" },
  success: { bg: "var(--success-bg)", fg: "var(--success)", icon: "✓" },
  error:   { bg: "var(--error-bg)",   fg: "var(--error)",   icon: "⚠" },
  warn:    { bg: "var(--warn-bg)",    fg: "var(--warn)",    icon: "●" },
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after duration. The mount effect is the single legal effect.
  useMountEffect(() => {
    timerRef.current = setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  });

  const s = kindStyle[toast.kind];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]",
        "border border-[var(--border)] shadow-[var(--shadow-md)]",
        "text-[var(--text-fs-2)] min-w-[240px] max-w-[400px]",
      )}
      style={{
        background: s.bg,
        color: s.fg,
        animation: "vl-toast-in 200ms var(--ease-out-soft)",
      }}
    >
      <span aria-hidden="true">{s.icon}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss"
        className="text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
      >
        ×
      </button>
    </div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
      <style>{`
        @keyframes vl-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
