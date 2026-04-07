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
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center p-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-sm text-center shadow-2xl">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-3">
            Verseline is designed for desktop
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            For the best experience, please use a laptop or desktop computer with a widescreen display.
          </p>
          <div className="flex flex-col gap-3">
            <a
              href="/docs"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
            >
              View Documentation
            </a>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
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
