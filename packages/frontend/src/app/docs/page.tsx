export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <a href="/" className="text-sm text-indigo-500 hover:text-indigo-400 mb-6 inline-block">&larr; Back to Verseline</a>

        <h1 className="text-3xl font-bold mb-8">Verseline Documentation</h1>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">What is Verseline?</h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Verseline is a timed-text video editor for creating videos with synchronized text overlays.
            You provide a background image or video, an audio track, and define text segments that
            appear at specific times. Verseline renders everything together into a final video.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Getting Started</h2>
          <ol className="list-decimal list-inside text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-2">
            <li>Create a new project from the Projects page</li>
            <li>Upload a background image or video in Settings</li>
            <li>Upload an audio file in Settings</li>
            <li>Add segments in the timeline — each segment defines a time range</li>
            <li>Add text blocks to each segment with styles and placements</li>
            <li>Use the canvas preview to see how text appears on screen</li>
            <li>Click Preview to render a single segment, or Render to create the full video</li>
          </ol>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Segments &amp; Blocks</h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
            A <strong>segment</strong> represents a time range in your video (e.g., 00:05 to 00:12).
            Each segment contains one or more <strong>blocks</strong> of text.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Each block has: text content, a style (font, size, color, effects),
            a placement (where on screen it appears), and an optional language tag.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Styles</h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
            Styles control how text looks. You can configure:
          </p>
          <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1">
            <li><strong>Font &amp; Size</strong> — Choose from Google Fonts or upload custom fonts</li>
            <li><strong>Color</strong> — Text color in hex (e.g., #ffffff for white)</li>
            <li><strong>Outline</strong> — Border around text for readability</li>
            <li><strong>Shadow</strong> — Drop shadow behind text</li>
            <li><strong>Text Background</strong> — Colored box behind text with padding and rounded corners</li>
            <li><strong>Alignment</strong> — Left, center, or right text alignment</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Inline Style Tags</h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
            You can apply different colors to parts of your text using inline style tags.
            This is useful for highlighting specific words or phrases.
          </p>
          <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-4 mb-3 font-mono text-sm">
            Hello &lt;accent&gt;beautiful&lt;/accent&gt; world
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
            In this example, the word &quot;beautiful&quot; will use the color defined in the style
            named &quot;accent&quot;. The rest of the text uses the block&apos;s base style color.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            <strong>Tip:</strong> In the editor, type <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded">&lt;</code>
            to get autocomplete suggestions for available style names.
            You can also select text and click a style name in the wrap toolbar to apply a tag.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Placements</h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
            Placements control where text appears on screen. Each placement has:
          </p>
          <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1">
            <li><strong>Anchor</strong> — One of 9 positions: top/center/bottom combined with left/center/right</li>
            <li><strong>Margins</strong> — X and Y offset from the anchor position (in pixels)</li>
            <li><strong>Max Width/Height</strong> — Optional constraints on the text area size</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Keyboard Shortcuts</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["Space", "Play / Pause"],
              ["Ctrl + S", "Save project"],
              ["Ctrl + D", "Duplicate segment"],
              ["Delete", "Delete selected segment"],
              ["Arrow Left / Right", "Seek 1 second"],
              ["Shift + Arrow", "Seek 5 seconds"],
            ].map(([key, desc]) => (
              <div key={key} className="contents">
                <kbd className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-xs font-mono">{key}</kbd>
                <span className="text-zinc-600 dark:text-zinc-400 flex items-center">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Rendering</h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
            Verseline renders your video server-side using FFmpeg.
          </p>
          <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 leading-relaxed space-y-1">
            <li><strong>Preview</strong> — Renders a single segment as a quick MP4 preview</li>
            <li><strong>Full Render</strong> — Renders the entire project with all segments</li>
          </ul>
        </section>

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 mt-12">
          <p className="text-sm text-zinc-500 dark:text-zinc-600">
            Verseline — Timed-text video editor
          </p>
        </div>
      </div>
    </div>
  );
}
