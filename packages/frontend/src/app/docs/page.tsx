import Link from "next/link";
import { Kbd } from "@/components/ui";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-3xl mx-auto px-8 py-16">
        <Link
          href="/"
          className="text-[var(--text-fs-2)] text-[var(--brand-primary)] hover:underline mb-8 inline-block"
        >
          ← Back to Verseline
        </Link>

        <header className="mb-12">
          <p className="text-[var(--text-fs-1)] uppercase tracking-[0.18em] text-[var(--text-muted)] font-mono mb-3">
            Documentation
          </p>
          <h1
            className="font-display text-[var(--text-fs-7)] leading-[1.1]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            How Verseline works
          </h1>
        </header>

        <Section title="What is Verseline?">
          <p>
            Verseline is a timed-text video editor for putting synchronised text on top
            of audio or video. You provide a background image or video, an audio track,
            and a list of segments — each one a time range with text, a style, and a
            placement. Verseline renders everything together into a final video.
          </p>
          <p>
            The product&rsquo;s focus is <strong>reuse</strong>: a style or placement
            you build once is reused across every segment, and can be saved to the
            shared library to reuse across every project.
          </p>
        </Section>

        <Section title="Getting started">
          <ol>
            <li>Create a new project from the Projects page.</li>
            <li>Upload a background (image or video) and audio in Settings.</li>
            <li>Add segments — each one defines a time range.</li>
            <li>For each segment, add text blocks with a style and placement.</li>
            <li>Use the canvas preview to see how text appears on screen.</li>
            <li>Click <em>Preview</em> to render a single segment, or <em>Render</em> for the full video.</li>
          </ol>
        </Section>

        <Section title="Segments &amp; blocks">
          <p>
            A <strong>segment</strong> represents a time range in your video
            (e.g. <span className="font-mono">00:05 — 00:12</span>). Each segment
            contains one or more <strong>blocks</strong> of text, each with its own
            content, style, placement, and optional language tag.
          </p>
        </Section>

        <Section title="Styles">
          <p>Styles control how text looks. You can configure:</p>
          <ul>
            <li><strong>Font &amp; size</strong> — pick from Google Fonts or upload your own.</li>
            <li><strong>Color</strong> — text color in hex.</li>
            <li><strong>Outline</strong> — border around text for readability.</li>
            <li><strong>Shadow</strong> — drop shadow behind text.</li>
            <li><strong>Text background</strong> — coloured box behind text with padding and rounded corners.</li>
            <li><strong>Alignment</strong> — left, centre, or right.</li>
          </ul>
        </Section>

        <Section title="Inline style tags">
          <p>
            Apply different styles to parts of your text using inline tags. Useful for
            highlighting specific words.
          </p>
          <pre className="font-mono text-[var(--text-fs-2)] bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-md)] p-4 my-3 overflow-x-auto">
{`Hello <accent>beautiful</accent> world`}
          </pre>
          <p>
            Type <Kbd>&lt;</Kbd> in the editor for autocomplete suggestions.
          </p>
        </Section>

        <Section title="Placements (free-form)">
          <p>
            Place text anywhere on the canvas. Drag a pin, snap to grids of 12 / 8 / 4,
            or pick one of nine quick anchors. A placement can be saved to the library
            and reused in any project.
          </p>
        </Section>

        <Section title="Keyboard shortcuts">
          <p>All shortcuts are configurable in Settings.</p>
          <div className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 mt-4 text-[var(--text-fs-2)]">
            {(
              [
                ["Space", "Play / pause"],
                ["Cmd / Ctrl + S", "Save project"],
                ["Cmd / Ctrl + D", "Duplicate segment"],
                ["Delete", "Delete segment"],
                ["← / →", "Seek 1 second"],
                ["Shift + ← / →", "Seek 5 seconds"],
                ["J / K", "Previous / next segment"],
                ["1 / 2 / 3 / 4", "Toggle right panel"],
              ] as const
            ).map(([key, desc]) => (
              <div key={key} className="contents">
                <Kbd>{key}</Kbd>
                <span className="text-[var(--text-muted)]">{desc}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Rendering">
          <p>Verseline renders server-side using FFmpeg.</p>
          <ul>
            <li><strong>Preview</strong> — renders a single segment as a quick MP4.</li>
            <li><strong>Full render</strong> — renders the whole project end-to-end.</li>
          </ul>
        </Section>

        <footer className="border-t border-[var(--border)] pt-6 mt-16">
          <p className="text-[var(--text-fs-2)] text-[var(--text-faint)]">
            Verseline · timed-text video editor
          </p>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2
        className="font-display text-[var(--text-fs-5)] mb-4"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      <div
        className="text-[var(--text-fs-3)] text-[var(--text-muted)] leading-[1.6] [&_strong]:text-[var(--text)] [&_em]:text-[var(--text)] [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p+ul]:mt-3 [&_p+ol]:mt-3 [&_li]:mt-1.5 [&_p+p]:mt-3"
      >
        {children}
      </div>
    </section>
  );
}
