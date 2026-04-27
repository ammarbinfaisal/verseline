import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] grid lg:grid-cols-[1fr_1.2fr]">
      {/* Left: brand + tagline */}
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-[var(--surface-2)] border-r border-[var(--border)]">
        <Link href="/" className="text-[var(--text-fs-2)] uppercase tracking-[0.18em] text-[var(--brand-primary)] font-mono font-semibold">
          Verseline
        </Link>
        <div>
          <p
            className="font-display text-[var(--text-fs-6)] text-[var(--text)] leading-[1.15] max-w-md"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Set the type once. Reuse across every segment, every project.
          </p>
          <p className="text-[var(--text-fs-2)] text-[var(--text-muted)] mt-4">
            Verseline · timed-text video editor for desktops
          </p>
        </div>
        <p className="text-[var(--text-fs-1)] text-[var(--text-faint)]">
          © Verseline
        </p>
      </aside>

      {/* Right: form column */}
      <main className="flex flex-col items-start justify-center px-8 lg:px-16 py-16 max-w-2xl">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
