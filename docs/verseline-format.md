# Verseline Format

Verseline should be a timed text-video renderer, not a Quran-only tool.

Quran is still a first-class use case, but the format should also handle:

- poems
- Arabic text blocks
- English translation blocks
- mixed translators
- multiple fonts
- 2 blocks, 3 blocks, or more
- LLM or MCP-generated draft timelines

The format should optimize for:

- manual editing
- TUI editing
- line-by-line diffability
- LLM friendliness
- low ambiguity

## File Split

Use two files:

1. `project.json`
2. `timeline.jsonl`

Why this split:

- `project.json` changes slowly
- `timeline.jsonl` changes often
- LLMs and TUIs can rewrite one segment line at a time
- approval workflows are simpler

## `project.json`

This should contain stable clip-level configuration:

- output path
- canvas
- audio/background assets
- fonts
- styles
- placements
- data sources
- project-level overlays
- preview settings
- render profiles
- timeline paths

Example:

```json
{
  "name": "al-baqarah-2-5",
  "output": "out/al-baqarah-2-5.mp4",
  "canvas": {
    "width": 1080,
    "height": 1920,
    "fps": 30
  },
  "assets": {
    "audio": "audio/clip.mp3",
    "background": {
      "type": "video",
      "path": "assets/bg.mp4",
      "loop": true,
      "fit": "cover"
    }
  },
  "fonts": [
    {
      "id": "latin-main",
      "family": "Helvetica"
    },
    {
      "id": "kfqpc",
      "family": "KFGQPC Uthmanic Script HAFS",
      "files": ["fonts/UthmanicHafs1.woff2"]
    }
  ],
  "styles": [
    {
      "id": "translation",
      "font": "latin-main",
      "size": 64,
      "color": "#FFFFFF",
      "auxiliary_color": "#B7B7B7",
      "outline_color": "#000000",
      "outline": 3,
      "shadow": 1
    },
    {
      "id": "translation-large",
      "font": "latin-main",
      "size": 84,
      "color": "#FFFFFF",
      "auxiliary_color": "#B7B7B7",
      "outline_color": "#000000",
      "outline": 3,
      "shadow": 1
    },
    {
      "id": "arabic-main",
      "font": "kfqpc",
      "size": 72,
      "color": "#FFFFFF",
      "outline_color": "#000000",
      "outline": 3,
      "shadow": 1
    },
    {
      "id": "meta",
      "font": "latin-main",
      "size": 28,
      "color": "#F2F2F2",
      "outline_color": "#000000",
      "outline": 2,
      "shadow": 1
    }
  ],
  "placements": [
    {
      "id": "lower-center",
      "anchor": "bottom_center",
      "margin_x": 108,
      "margin_y": 360
    },
    {
      "id": "meta-above",
      "anchor": "bottom_center",
      "margin_x": 108,
      "margin_y": 540
    },
    {
      "id": "upper-safe",
      "anchor": "top_center",
      "margin_x": 108,
      "margin_y": 180
    }
  ],
  "sources": [
    {
      "id": "sahih",
      "type": "jsonl",
      "path": "data/sahih.jsonl",
      "language": "en"
    },
    {
      "id": "pickthall",
      "type": "jsonl",
      "path": "data/pickthall.jsonl",
      "language": "en"
    },
    {
      "id": "arabic-kfqpc",
      "type": "jsonl",
      "path": "data/arabic-kfqpc.jsonl",
      "language": "ar"
    }
  ],
  "overlays": [
    {
      "id": "meta",
      "blocks": [
        {
          "id": "meta",
          "kind": "literal",
          "text": "surah al-baqarah 2-5\ntranslation: sahih international",
          "style": "meta",
          "placement": "meta-above"
        }
      ]
    }
  ],
  "preview": {
    "player": "vlc",
    "directory": "previews",
    "padding_ms": 400,
    "width": 540,
    "height": 960,
    "fps": 24,
    "crf": 32,
    "preset": "veryfast"
  },
  "render_profiles": [
    {
      "id": "sdr-fhd",
      "label": "SDR FHD",
      "width": 1080,
      "height": 1920,
      "fps": 30,
      "output_suffix": "sdr-fhd",
      "video_codec": "libx264",
      "audio_codec": "aac",
      "audio_bitrate": "192k",
      "crf": 21,
      "preset": "medium",
      "pix_fmt": "yuv420p"
    },
    {
      "id": "hdr-4k",
      "label": "HDR 4K",
      "width": 2160,
      "height": 3840,
      "fps": 30,
      "output_suffix": "hdr-4k",
      "video_codec": "libx265",
      "audio_codec": "aac",
      "audio_bitrate": "256k",
      "crf": 18,
      "preset": "slow",
      "pix_fmt": "yuv420p10le",
      "color_primaries": "bt2020",
      "color_trc": "smpte2084",
      "colorspace": "bt2020nc"
    }
  ],
  "timeline": {
    "draft": "clips/example.timeline.draft.jsonl",
    "approved": "clips/example.timeline.jsonl"
  }
}
```

## `timeline.jsonl`

Each line is one segment.

Each segment has:

- `start`
- `end`
- `status`
- `confidence`
- `notes`
- `blocks`

Each block can be:

- literal text
- text from a source
- Arabic
- English
- meta
- anything else

Example:

```json
{"id":"seg-001","start":"00:00:00.000","end":"00:00:03.200","status":"approved","blocks":[{"id":"en-1","kind":"source_substring","text":"This is the Book about which there is no doubt,","style":"translation","placement":"lower-center","source":{"source":"sahih","mode":"substring","refs":["2:2"]}}]}
{"id":"seg-002","start":"00:00:03.200","end":"00:00:06.300","status":"approved","blocks":[{"id":"ar-1","kind":"source_full","style":"arabic-main","placement":"upper-safe","source":{"source":"arabic-kfqpc","mode":"full","refs":["2:2"]}},{"id":"en-2","kind":"source_substring","text":"a guidance for those conscious of Allah -","style":"translation-large","placement":"lower-center","source":{"source":"sahih","mode":"substring","refs":["2:2"]}}]}
```

## Why Blocks Instead Of Fixed Fields

This is the key design change.

Do not hardcode:

- one translation block
- one meta block
- one Arabic block

Instead, every segment has a `blocks` array.

That lets you handle:

- 2 blocks
- 3 blocks
- translator changes mid-project
- poem original plus translation
- Arabic only
- English only
- Arabic plus transliteration plus translation

The renderer only needs to know how to render blocks.

Project-level overlays are where stable items like meta text should live.

That keeps the timeline focused on the content that changes segment by segment.

## Rendering Model

Verseline should treat block rendering as a separate layer stage.

The current implementation does this by:

1. resolving block text from literal text or sources
2. rasterizing each block into a transparent PNG layer
3. compositing those layers over the background with ffmpeg overlay

This is more portable than relying on ffmpeg subtitle filters, because some local ffmpeg builds do not include libass or drawtext.

The raster stage should prefer a real text shaping stack, not shelling out for every block by default.

The current implementation uses `go-text` for shaped text rasterization when it can resolve a real font file.
That gives better wrapping and cleaner glyph rendering for Latin and Unicode Arabic text.

If the project only provides a family name, Verseline resolves it to a system font file.
If the font format is not yet supported by the Go raster path, or the chosen face does not cover the block text, it falls back to ImageMagick for that block.

That keeps the render path practical for:

- normal `.ttf`, `.otf`, `.ttc` system fonts
- Unicode Arabic text
- mixed family-name and explicit-file projects
- transitional cases like WOFF-based Quran fonts that may still need a fallback path

It also keeps the architecture open for later improvements:

- better Arabic shaping
- bracket-aware styling
- font-file-specific rendering
- cached block layers

## Review And Approval

Preview and final render are different operations.

Preview should:

- render from the current draft or working segment selection
- use low-quality settings
- target one segment plus a little padding around it
- open in the configured player, defaulting to VLC

Final renders should:

- render only from the approved timeline
- target one or more named `render_profiles`
- support different SDR/HDR and FHD/2K/4K outputs by profile
- show progress per render job

The TUI should expose the same workflow surface as the CLI:

- validate
- preview current segment
- mark statuses
- approve draft to approved timeline
- render current profile
- render all profiles

## Why JSONL For Timeline

JSONL is better than one large JSON array for the timeline because:

- each segment is independent
- LLMs can rewrite individual lines safely
- approval tools can replace one line at a time
- merges are easier
- MCP tools can stream and patch segments incrementally

## Exact-Text Policy

For sourced blocks, the text policy should be explicit:

- `mode: "full"` means exact full entry from the source
- `mode: "substring"` means exact substring from the source
- `kind: "literal"` means hand-authored text

This matters for Quran because one segment may stop at a phrase that is only part of a verse translation.

## Fonts

Fonts should be first-class config items.

That includes:

- normal Latin fonts
- Arabic unicode fonts
- KFGQPC/KFQPC-style font files
- font files whose glyph mapping depends on a specific text stream

Verseline should not assume one global font.

It should assume blocks can use different fonts and scripts.

## MCP / LLM Ergonomics

The format should be easy for an agent to reason about.

That means:

- explicit IDs
- explicit source references
- explicit block arrays
- explicit placements
- explicit status fields
- no implicit inheritance hidden in too many layers

The goal is not maximum abstraction.

The goal is that an LLM can read the project and timeline, make a localized change, and write valid output back.
