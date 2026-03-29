# Verseline

Verseline is a timed-text video renderer for recitations, readings, poems, and other audio-led clips.

## Usage

Build the binary:

```console
$ go build -o verseline .
```

Then add the local stdio server to Claude Code:

```console
$ claude mcp add verseline -- /absolute/path/to/verseline mcp
```

Or add it to Codex CLI:

```console
$ codex mcp add verseline -- /absolute/path/to/verseline mcp
```

Print the current MCP tool list and example add commands from the binary itself:

```console
$ ./verseline mcp describe
```

Open the review TUI:

```console
$ ./verseline tui -project path/to/project.json
```

Render approved output:

```console
$ ./verseline render -project path/to/project.json
```

The MCP server exposes tools for:

- project inspection and validation
- audio transcription (Whisper API) with batched JSONL output
- timeline segment listing, updates, and splitting
- draft approval
- segment previews and full renders
- text-on-background readability analysis (WCAG contrast ratios)

## Definition

The core idea is simple:

- one declarative project file
- one renderer
- one TUI for review and approval
- one MCP server for transcription, rendering primitives, and readability analysis

This repo began as a fork of [markut](https://github.com/tsoding/markut) — a stack-based video editing language. What remains is the idea of making videos using languages, but the direction has shifted to a data-first timed text system for audio-led clips.

## Product Definition

Verseline should handle:

- audio-led portrait clips
- image or video backgrounds
- one or more timed text layers with independent time ranges
- font blocks referencing TTF files, used in style definitions
- text styling: outlines, shadows, and text backgrounds with rounded corners
- manual review and approval before final render

The source of truth should be a declarative project, not imperative commands.

## Reduced Surface

The intended user-facing surface is:

- `verseline tui <project>` for review, editing, approval, and rerendering
- `verseline render <project>` for headless render execution
- `verseline mcp` for editor and LLM integrations

The repository still contains legacy subcommands from the original fork. Those are implementation history, not the target product shape.
`verseline mcp` now runs as a local stdio MCP server.

## What The Project Describes

A Verseline project should describe:

- canvas and output settings
- audio input
- image or video background input
- source datasets
- font blocks referencing TTF/OTF files
- text styles with color, outline, shadow, and text background options
- text placements with anchoring and margins
- timeline segments with timed text blocks
- overlays with independent time ranges (multiple text cards can overlap)
- approval state
- render profiles

The project format should be friendly to:

- hand editing
- TUI editing
- line-by-line diffs
- MCP-assisted updates

## Readability Helpers

Timed text readability is part of the product, not an afterthought.

The renderer supports:

- outline and shadow with configurable colors
- text background boxes with padding and corner radius (Instagram stories style)
- safe margins and placements
- font selection per style via TTF file references
- softer styling for auxiliary text such as bracketed phrases

The `verseline_check_readability` MCP tool samples the background at each text placement and computes WCAG contrast ratios, reporting which blocks have poor contrast and recommending outline, shadow, or text background additions.

## Intended Workflow

1. create or import a project
2. transcribe audio (writes batched JSONL files to a directory)
3. build the timeline from transcription data
4. review and edit segments in the TUI
5. check readability and adjust styles as needed
6. preview and rerender selected segments
7. approve the timeline
8. render the final output

## Docs

- [docs/verseline-format.md](docs/verseline-format.md)
- [docs/recitation-workflow.md](docs/recitation-workflow.md)

Install [Go](https://golang.org/) and [ffmpeg](https://www.ffmpeg.org/).
