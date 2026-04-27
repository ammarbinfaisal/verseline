"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { useMountEffect } from "@/hooks/useMountEffect";
import { MobileGate } from "@/components/common/MobileGate";
import { Spinner, ToastViewport } from "@/components/ui";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, loadUser, logout } = useAuthStore();

  useMountEffect(() => {
    loadUser().then(() => {
      const { user } = useAuthStore.getState();
      if (!user) router.replace("/login");
    });
  });

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <Spinner size={20} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col">
      {/* Top nav */}
      <nav className="h-12 border-b border-[var(--border)] bg-[var(--surface-1)] flex items-center px-5 gap-5">
        <Link
          href="/projects"
          className="text-[var(--text-fs-2)] uppercase tracking-[0.18em] text-[var(--brand-primary)] font-mono font-semibold"
        >
          Verseline
        </Link>
        <div className="h-5 w-px bg-[var(--border)]" />
        <Link
          href="/projects"
          className="text-[var(--text-fs-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          Projects
        </Link>
        <Link
          href="/library"
          className="text-[var(--text-fs-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          Library
        </Link>
        <Link
          href="/docs"
          className="text-[var(--text-fs-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          Docs
        </Link>
        <div className="flex-1" />
        <Link
          href="/settings"
          className="text-[var(--text-fs-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          Settings
        </Link>
        {user && (
          <span className="text-[var(--text-fs-1)] text-[var(--text-faint)] hidden md:block font-mono">
            {user.email}
          </span>
        )}
        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="text-[var(--text-fs-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] rounded-sm px-1"
        >
          Log out
        </button>
      </nav>

      <main className="flex-1 min-h-0">
        <MobileGate>{children}</MobileGate>
      </main>

      <ToastViewport />
    </div>
  );
}
