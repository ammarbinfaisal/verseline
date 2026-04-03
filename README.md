# Verseline

Verseline is a timed-text video renderer for recitations, readings, poems, and other audio-led clips.

It takes a JSON project file describing canvas dimensions, fonts, text styles, placements, and a JSONL timeline of timed segments, then composites styled text overlays onto a background video or image using ffmpeg.

## Setup

Requires [Go](https://golang.org/) 1.25+ and [ffmpeg](https://www.ffmpeg.org/).

**Build from source:**

```console
$ git clone https://github.com/ammarbinfaisal/verseline.git
$ cd verseline
$ go build -o verseline .
$ ./verseline --help
```

**Install a prebuilt binary:**

Grab the latest release from the [Releases](https://github.com/ammarbinfaisal/verseline/releases) page. Binaries are published for linux (amd64/arm64), macOS (amd64/arm64), and windows (amd64).

```console
# Example: download and use on macOS arm64
$ curl -LO https://github.com/ammarbinfaisal/verseline/releases/latest/download/verseline-darwin-arm64
$ chmod +x verseline-darwin-arm64
$ mv verseline-darwin-arm64 /usr/local/bin/verseline
```

## Usage

Open the TUI editor:

```console
$ ./verseline tui -project path/to/project.json
```

Open the draft timeline instead of the approved one:

```console
$ ./verseline tui -project path/to/project.json -draft
```

Render approved output from the command line:

```console
$ ./verseline render -project path/to/project.json
```

Preview a specific segment:

```console
$ ./verseline preview -project path/to/project.json -segment 3
```

Run the MCP server (for AI-assisted editing via Claude Code or other MCP clients):

```console
$ ./verseline mcp serve
```

Validate a project and timeline:

```console
$ ./verseline validate -project path/to/project.json
```

## TUI

The TUI is a multi-tab editor for the entire project. Switch between tabs and edit everything from timeline segments to fonts, styles, placements, and project settings.

### Global keys

| Key | Action |
|---|---|
| `tab` | Next tab |
| `shift+tab` | Previous tab |
| `ctrl+s` | Save all changes (timeline + project) |
| `ctrl+c` | Quit (auto-saves if dirty) |
| `?` | Toggle full help |

### Timeline tab

Navigate and edit timeline segments, preview and render video.

**Navigation:**

| Key | Action |
|---|---|
| `up` / `k` | Previous segment |
| `down` / `j` | Next segment |
| `left` / `h` | Previous block within segment |
| `right` / `l` | Next block within segment |

**Editing fields:**

| Key | Action |
|---|---|
| `1` | Edit segment start timestamp |
| `2` | Edit segment end timestamp |
| `3` | Edit segment status |
| `4` | Edit block text |
| `5` | Edit block style reference |
| `6` | Edit block placement reference |
| `enter` | Commit the edit |
| `esc` | Cancel the edit |

**Segment actions:**

| Key | Action |
|---|---|
| `a` | Mark segment as approved |
| `x` | Mark segment as needs_fix |
| `d` | Delete segment (press twice to confirm) -- shifts timestamps of subsequent segments |
| `v` | Validate the entire timeline |

**Preview and render:**

| Key | Action |
|---|---|
| `p` | Preview the selected segment (renders a low-quality clip and opens it in the media player) |
| `[` / `]` | Cycle through render profiles |
| `r` | Render the selected profile |
| `R` | Render all profiles |
| `A` | Approve the draft timeline (copies draft to approved) |

**Render workflow:**

1. Edit and review segments in the timeline tab
2. Mark each segment as approved with `a`
3. Press `A` to promote the draft to the approved timeline
4. Select a render profile with `[` / `]`
5. Press `r` to render the selected profile, or `R` to render all

Rendering requires an approved timeline. If you are editing the draft and have unsaved changes, the TUI will ask you to save and approve first.

**Preview player:** if `preview.player` is set in the project, that player is used. Otherwise verseline looks for `vlc` in PATH, then falls back to the OS default (`open` on macOS, `xdg-open` on Linux).

### Styles tab

Edit text styles defined in the project.

| Key | Action |
|---|---|
| `enter` / `e` | Edit the selected style |
| `ctrl+left` / `ctrl+right` | Cycle through fields while editing (id, font, size, color, outline, shadow, text_bg, align, ...) |
| `n` | Add a new style |
| `d` | Delete style (press twice to confirm) |
| `enter` | Commit edit |
| `esc` | Cancel edit |

### Fonts tab

Edit font definitions.

| Key | Action |
|---|---|
| `enter` / `e` | Edit the selected font |
| `ctrl+left` / `ctrl+right` | Cycle through fields (id, family, files) |
| `n` | Add a new font |
| `d` | Delete font (press twice to confirm) |

### Placements tab

Edit text placement anchors and margins.

| Key | Action |
|---|---|
| `enter` / `e` | Edit the selected placement |
| `ctrl+left` / `ctrl+right` | Cycle through fields (id, anchor, margin_x, margin_y, max_width, max_height) |
| `n` | Add a new placement |
| `d` | Delete placement (press twice to confirm) |

### Project tab

Edit project-level settings as a key-value table: name, output, canvas dimensions, asset paths, preview settings, and timeline paths. Render profiles are shown as a read-only summary below the table.

| Key | Action |
|---|---|
| `enter` / `e` | Edit the selected field |

## Project format

A verseline project is a JSON file that describes:

- canvas dimensions and FPS
- audio and background assets (image or video)
- font definitions with TTF/OTF file references
- text styles with color, outline, shadow, text background, and alignment
- text placements with anchoring and margins
- source datasets (JSONL/JSON)
- static overlays with independent time ranges
- preview settings (player, resolution, encoding)
- render profiles (resolution, codec, CRF, color space)
- timeline paths (draft and approved JSONL files)

See [docs/verseline-format.md](docs/verseline-format.md) for the full specification.

## Logs

ffmpeg and subprocess output is written to a log file instead of the terminal:

- macOS: `~/Library/Logs/verseline/verseline.log`
- Linux: `~/.local/state/verseline/verseline.log` (or `$XDG_STATE_HOME/verseline/verseline.log`)
