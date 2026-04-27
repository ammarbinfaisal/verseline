import Link from "next/link";
import { Button } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Asymmetric hero — copy left, demo right (placeholder for now) */}
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-16 max-w-6xl mx-auto px-8 py-24">
        <section className="flex flex-col justify-center">
          <p
            className="text-[var(--text-fs-2)] uppercase tracking-[0.18em] text-[var(--brand-primary)] font-mono mb-4"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            Verseline
          </p>
          <h1
            className="font-display text-[var(--text-fs-8)] leading-[1.05] mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Timed text, on top of anything.
          </h1>
          <p className="text-[var(--text-fs-4)] text-[var(--text-muted)] max-w-xl mb-8 leading-relaxed">
            A desktop editor for translation, transliteration, and verbatim
            captioning over audio or video. Reusable styles, free-form placement,
            shared library across every project.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/signup">
              <Button variant="primary" size="lg">
                Sign up
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="lg">
                Log in
              </Button>
            </Link>
            <Link
              href="/docs"
              className="text-[var(--text-fs-3)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors ml-2"
            >
              Documentation →
            </Link>
          </div>
        </section>

        {/* Right column: a stylised editor preview block. Static SVG-ish abstract. */}
        <aside aria-hidden="true" className="hidden lg:flex items-center">
          <div
            className="w-full aspect-[3/4] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] shadow-[var(--shadow-lg)] overflow-hidden flex flex-col"
          >
            <div className="h-8 border-b border-[var(--border)] bg-[var(--surface-2)] flex items-center px-3 gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--text-faint)] opacity-40" />
              <span className="w-2 h-2 rounded-full bg-[var(--text-faint)] opacity-40" />
              <span className="w-2 h-2 rounded-full bg-[var(--text-faint)] opacity-40" />
            </div>
            <div className="flex-1 grid grid-cols-[1fr_1.6fr_1fr]">
              <div className="border-r border-[var(--border)] p-3 flex flex-col gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-5 rounded-sm"
                    style={{ background: i === 1 ? "var(--accent-cool)" : "var(--surface-2)" }}
                  />
                ))}
              </div>
              <div className="bg-[var(--canvas-frame)] flex items-center justify-center text-center p-6">
                <div>
                  <div
                    className="font-display text-white"
                    style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem" }}
                  >
                    “Type, set once. Reused everywhere.”
                  </div>
                </div>
              </div>
              <div className="border-l border-[var(--border)] p-3 flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-2 w-1/2 rounded-sm bg-[var(--surface-2)]" />
                    <div className="h-5 rounded-sm bg-[var(--surface-2)]" />
                  </div>
                ))}
              </div>
            </div>
            <div className="h-12 border-t border-[var(--border)] bg-[var(--timeline-bg)] relative">
              <div
                className="absolute inset-y-2 left-[8%] w-[18%] rounded-sm"
                style={{ background: "var(--segment-default)" }}
              />
              <div
                className="absolute inset-y-2 left-[30%] w-[24%] rounded-sm"
                style={{ background: "var(--segment-selected)" }}
              />
              <div
                className="absolute inset-y-2 left-[58%] w-[14%] rounded-sm"
                style={{ background: "var(--segment-default)" }}
              />
              <div
                className="absolute top-0 bottom-0 w-px"
                style={{ left: "42%", background: "var(--playhead)" }}
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
