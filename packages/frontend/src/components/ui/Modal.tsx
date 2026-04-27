"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { cn } from "./cn";
import { IconButton } from "./IconButton";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "sm" 360px · "md" 480px · "lg" 640px */
  size?: "sm" | "md" | "lg";
  /** Hide the close button in the header */
  hideClose?: boolean;
}

const widthMap = {
  sm: "w-[360px]",
  md: "w-[480px]",
  lg: "w-[640px]",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  hideClose = false,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // One-shot setup on mount: capture previously focused, listen for ESC, restore on unmount.
  useMountEffect(() => {
    if (!open) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus?.();
    };
  });

  // Initial focus via callback ref — focuses the dialog itself; the caller can
  // place a tabIndex={0} or autoFocus on something inside.
  const dialogRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const focusable = node.querySelector<HTMLElement>(
      "[autofocus], button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    (focusable ?? node).focus();
  }, []);

  const handleOverlay = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "bg-[color-mix(in_srgb,var(--canvas-frame)_60%,transparent)]",
      )}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vl-modal-title"
        tabIndex={-1}
        className={cn(
          widthMap[size],
          "max-w-full max-h-[85vh] flex flex-col outline-none",
          "bg-[var(--surface-1)] border border-[var(--border)]",
          "rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]",
        )}
        style={{
          animation: "vl-modal-in 200ms var(--ease-out-soft)",
        }}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
          <h2
            id="vl-modal-title"
            className="text-[var(--text-fs-4)] font-semibold text-[var(--text)]"
          >
            {title}
          </h2>
          {!hideClose && (
            <IconButton size="sm" variant="ghost" label="Close" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 3l8 8M11 3l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
          )}
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
      <style>{`
        @keyframes vl-modal-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
