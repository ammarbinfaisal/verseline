# Verseline

Verseline is a timed-text video renderer for recitations, readings, poems, and other audio-led clips.

The core idea is simple:

- one declarative project file
- one renderer
- one TUI for review and approval
- one MCP server for transcription, mapping, text splitting, and edit automation

This repo was forked from [markut](https://github.com/tsoding/markut), but the intended direction here is no longer a stack-based video language. The target workflow is a data-first timed text system with LLM-assisted tooling around it.

## Product Definition

Verseline should handle:

- audio-led portrait clips
- image or video backgrounds
- one or more timed text layers
- preserved source text, such as Arabic or any other canonical language
- translation text from a trusted dataset
- LLM-assisted mapping between audio, source text, and display text
- manual review and approval before final render

The source of truth should be a declarative project, not imperative commands.

## Reduced Surface

The intended user-facing surface is:

- `verseline tui <project>` for review, editing, approval, and rerendering
- `verseline render <project>` for headless render execution
- `verseline mcp` for editor and LLM integrations

The current repository still contains legacy `markut` code and several older subcommands. Those are implementation history, not the target product shape.
`verseline mcp` now runs as a local stdio MCP server.

## What The Project Describes

A Verseline project should describe:

- canvas and output settings
- audio input
- image or video background input
- source datasets such as transcript, canonical text, and translations
- text styles and placements
- timeline segments
- approval state
- render profiles

The project format should be friendly to:

- hand editing
- TUI editing
- line-by-line diffs
- LLM or MCP-assisted updates

## Readability Helpers

Timed text readability is part of the product, not an afterthought.

The renderer should support:

- outline and shadow
- optional background box behind text
- per-layer padding and corner radius for text backgrounds
- safe margins and placements
- font selection per layer
- softer styling for auxiliary text such as bracketed phrases
- alternate styles for long segments or dense lines

This matters because many clips will be consumed on phones, often against busy backgrounds.

## Long Recitations And Readings

Some readings will be too long or too dense to map cleanly to one subtitle segment at a time.

Verseline should support two paths:

- manual segment editing in the TUI
- MCP-assisted splitting and remapping for long passages

The MCP server should be able to:

- transcribe or import transcript data
- map transcript spans to source references
- preserve source-language text exactly when required
- split long segments into readable subtitle-sized chunks
- propose revised segment wording or line breaks
- write those proposals back into the draft timeline

The LLM can help with segmentation and mapping, but approved timeline text remains under user control.

## MCP Integration

Build the binary first:

```console
$ go build -o verseline
```

Then add the local stdio server to Claude Code:

```console
$ claude mcp add verseline -- /absolute/path/to/verseline mcp
```

Or add it to Codex CLI:

```console
$ codex mcp add verseline -- /absolute/path/to/verseline mcp
```

The current MCP server exposes tools for:

- project inspection
- timeline validation
- segment listing
- segment updates
- segment splitting
- draft approval
- segment previews
- full renders

To print the current MCP tool list and example add commands from the binary itself:

```console
$ ./verseline mcp describe
```

## Intended Workflow

1. create or import a project
2. generate a draft timeline from transcript and source datasets
3. review and edit segments in the TUI
4. preview and rerender selected segments as needed
5. approve the timeline
6. render the final output

## Docs

- [docs/verseline-format.md](docs/verseline-format.md)
- [docs/recitation-workflow.md](docs/recitation-workflow.md)

## Build

Install [Go](https://golang.org/) and [ffmpeg](https://www.ffmpeg.org/), then build the current binary:

```console
$ go build -o verseline
```
