"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { useMountEffect } from "@/hooks/useMountEffect";
import { MobileGate } from "@/components/common/MobileGate";

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
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-600 dark:text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">
      {/* Top nav */}
      <nav className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm flex items-center px-6 gap-4">
        <Link href="/projects" className="text-sm font-semibold text-zinc-900 dark:text-white tracking-tight">
          Verseline
        </Link>
        <div className="flex-1" />
        {user && (
          <span className="text-xs text-zinc-600 dark:text-zinc-500 hidden sm:block">{user.email}</span>
        )}
        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          Log out
        </button>
      </nav>

      {/* Page content */}
      <main className="flex-1">
        <MobileGate>{children}</MobileGate>
      </main>
    </div>
  );
}
