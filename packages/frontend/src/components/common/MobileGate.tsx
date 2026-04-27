"use client";

import { useState, useCallback } from "react";

export function MobileGate({ children }: { children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem("verseline_mobile_dismissed") === "true";
  });

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem("verseline_mobile_dismissed", "true");
    setDismissed(true);
  }, []);

  if (!isMobile || dismissed) return <>{children}</>;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: "color-mix(in srgb, var(--canvas-frame) 75%, transparent)" }}
      >
        <div
          className="rounded-[var(--radius-lg)] p-8 max-w-sm shadow-[var(--shadow-lg)] border border-[var(--border)]"
          style={{ background: "var(--surface-1)" }}
        >
          <h2
            className="font-display text-[var(--text-fs-5)] text-[var(--text)] mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Verseline is built for desktop
          </h2>
          <p className="text-[var(--text-fs-3)] text-[var(--text-muted)] mb-6 leading-relaxed">
            The editor needs the screen real estate. Pop this open on a laptop or
            larger when you're ready to work.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="/docs"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-md font-medium text-[var(--text-fs-2)] transition-colors"
              style={{ background: "var(--accent-warm)", color: "var(--text-on-warm)" }}
            >
              Read the docs
            </a>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-[var(--text-fs-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Continue anyway
            </button>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
