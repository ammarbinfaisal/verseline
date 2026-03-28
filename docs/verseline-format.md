# Verseline Format

Verseline should be a declarative timed-text video format built around three things:

- a project file
- a timeline
- tooling around that data through a TUI and an MCP server

It should not depend on a stack-based authoring model.

## Product Scope

Verseline is for:

- recitations
- readings
- poems
- translated clips
- source-language preservation
- one or more timed text layers over an image or video background

The format should optimize for:

- manual editing
- TUI editing
- LLM-assisted drafting
- explicit provenance
- low ambiguity
- readability on mobile screens

## File Model

Use two primary files:

1. `project.json`
2. `timeline.jsonl`

Why:

- `project.json` changes slowly
- `timeline.jsonl` changes often
- timeline entries can be rewritten one segment at a time
- diff review stays manageable
- MCP tools can update only the affected segments

## `project.json`

This file contains stable clip-level configuration.

Recommended top-level fields:

- `name`
- `output`
- `canvas`
- `assets`
- `sources`
- `styles`
- `placements`
- `timeline`
- `render_profiles`
- `defaults`

Example:

```json
{
  "name": "al-baqarah-2-5",
  "output": {
    "directory": "out",
    "basename": "al-baqarah-2-5"
  },
  "canvas": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "pixel_format": "yuv420p"
  },
  "assets": {
    "audio": {
      "path": "audio/clip.mp3"
    },
    "background": {
      "type": "video",
      "path": "assets/bg.mp4",
      "loop": true,
      "fit": "cover"
    }
  },
  "sources": [
    {
      "id": "arabic-kfqpc",
      "kind": "canonical_text",
      "language": "ar",
      "format": "jsonl",
      "path": "data/arabic-kfqpc.jsonl"
    },
    {
      "id": "sahih",
      "kind": "translation",
      "language": "en",
      "format": "jsonl",
      "path": "data/sahih.jsonl"
    },
    {
      "id": "asr-draft",
      "kind": "transcript",
      "language": "ar",
      "format": "json",
      "path": "data/asr-draft.json"
    }
  ],
  "styles": [
    {
      "id": "arabic-main",
      "font_family": "KFGQPC Uthmanic Script HAFS",
      "font_size": 72,
      "color": "#FFFFFF",
      "outline_color": "#000000",
      "outline_width": 4,
      "shadow_blur": 2,
      "shadow_offset_y": 2
    },
    {
      "id": "translation-main",
      "font_family": "Aptos",
      "font_size": 60,
      "color": "#FFFFFF",
      "outline_color": "#000000",
      "outline_width": 3,
      "background_fill": "#00000099",
      "background_padding_x": 24,
      "background_padding_y": 16,
      "background_radius": 18
    },
    {
      "id": "meta",
      "font_family": "Aptos",
      "font_size": 28,
      "color": "#F2F2F2",
      "outline_color": "#000000",
      "outline_width": 2
    }
  ],
  "placements": [
    {
      "id": "upper-safe",
      "anchor": "top_center",
      "margin_x": 108,
      "margin_y": 180,
      "max_width": 864
    },
    {
      "id": "lower-center",
      "anchor": "bottom_center",
      "margin_x": 108,
      "margin_y": 360,
      "max_width": 864
    }
  ],
  "timeline": {
    "draft": "clips/example.timeline.draft.jsonl",
    "approved": "clips/example.timeline.jsonl"
  },
  "render_profiles": [
    {
      "id": "preview",
      "width": 540,
      "height": 960,
      "fps": 24,
      "crf": 32,
      "preset": "veryfast"
    },
    {
      "id": "final",
      "width": 1080,
      "height": 1920,
      "fps": 30,
      "crf": 20,
      "preset": "medium"
    }
  ],
  "defaults": {
    "segment_status": "draft",
    "split_target_chars": 42,
    "split_max_lines": 2
  }
}
```

## `timeline.jsonl`

Each line is one segment.

Each segment should be a timed display unit tied to audio, with optional mapping metadata and one or more display layers.

Recommended fields:

- `id`
- `start`
- `end`
- `status`
- `notes`
- `mapping`
- `layers`

Example:

```json
{"id":"seg-001","start":"00:00:03.200","end":"00:00:06.300","status":"approved","mapping":{"refs":["2:2"],"method":"llm-assisted","confidence":0.88},"layers":[{"id":"ar","role":"source","language":"ar","preserve":true,"source":{"source_id":"arabic-kfqpc","mode":"full","refs":["2:2"]},"style":"arabic-main","placement":"upper-safe"},{"id":"en","role":"translation","language":"en","preserve":true,"text":"This is the Book about which there is no doubt,","source":{"source_id":"sahih","mode":"substring","refs":["2:2"]},"style":"translation-main","placement":"lower-center"}]}
{"id":"seg-002","start":"00:00:06.300","end":"00:00:09.900","status":"draft","notes":"split from long source span","mapping":{"refs":["2:2"],"method":"mcp-split","confidence":0.72},"layers":[{"id":"en","role":"translation","language":"en","preserve":false,"text":"A guidance for those mindful of Allah.","source":{"source_id":"sahih","mode":"derived","refs":["2:2"]},"style":"translation-main","placement":"lower-center"}]}
```

## Segment Rules

Each segment must:

- have `start` and `end`
- contain at least one display layer
- be valid independently of neighboring segments

Each layer should declare:

- `role`
- `language`
- whether the wording is preserved or derived
- either inline `text` or a source lookup
- `style`
- `placement`

This separation matters because audio, source text, translation text, and final display text are not always the same thing.

## Provenance Rules

The format should make source provenance explicit.

Recommended layer rules:

- `preserve: true` means wording must stay exact
- `preserve: false` means the wording may be shortened, split, or otherwise derived
- `source.refs` should point back to canonical source material when available
- `mapping.method` should say whether the segment came from manual editing, transcription, or LLM/MCP assistance

This is especially important when:

- Arabic or another source language must stay exact
- translation wording comes from a trusted external source
- long spoken passages are split into subtitle-sized segments

## Readability Helpers

The format should directly support readability controls instead of treating them as renderer-only hacks.

Useful style fields include:

- `outline_color`
- `outline_width`
- `shadow_blur`
- `background_fill`
- `background_padding_x`
- `background_padding_y`
- `background_radius`
- `line_height`
- `letter_spacing`
- `max_lines`

Useful project defaults include:

- target character count per subtitle
- target max lines per subtitle
- safe area margins
- alternate style for dense text

## TUI Responsibilities

The TUI should be the main human review tool.

It should support:

- project and timeline loading
- segment list navigation
- previewing one segment or a short range
- editing text, timing, style, and placements
- approving or rejecting segments
- applying MCP suggestions
- rerendering selected segments or the whole clip

The TUI should not require users to think in terms of many separate executables.

## MCP Responsibilities

The MCP server should provide automation around the declarative data model.

Useful operations:

- import audio and transcript data
- transcribe audio into draft transcript spans
- map transcript spans to source references
- preserve source-language text where required
- split long readings into subtitle-sized segments
- rewrite or condense non-preserved display text
- update draft timeline entries
- trigger preview and final renders

The MCP server is the right place for LLM-assisted operations. The project and timeline remain the source of truth.

Today, the practical MCP baseline should be a local stdio server addable from both Claude Code and Codex CLI. That means `verseline mcp` should run without extra wrappers and expose concrete tools for:

- inspecting a project
- validating a timeline
- listing segment summaries
- updating draft segments
- splitting long segments into shorter subtitle units
- approving the draft timeline
- previewing one segment
- rendering approved outputs

## Surface Area Reduction

The intended user-facing surface should be reduced to:

- `verseline tui <project>`
- `verseline render <project>`
- `verseline mcp`

Any current `validate`, `preview`, `approve`, or other specialized commands should become internal actions behind the TUI, MCP, or renderer library unless they remain useful as low-level implementation details.
