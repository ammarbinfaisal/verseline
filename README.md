# Verseline (formerly Markut)

You describe how you want to edit your video in a `MARKUT` file using a simple [Stack-Based Language](https://en.wikipedia.org/wiki/Stack-oriented_programming) and Markut translates it to a sequence of ffmpeg command and assembles the final video. I'm using this tools to edit my VODs that I upload at [Tsoding Daily](https://youtube.com/@TsodingDaily) YouTube channel.

This repo is being repurposed into `Verseline`, a personal timed text-video renderer with a strong focus on portrait recitation clips, poems, and multi-block subtitle layouts.

The newer Verseline workflow in this repo now includes:

- `verseline-validate` for project and timeline validation
- `verseline-edit` for a timeline TUI with validation, preview, approval, and render triggers
- `verseline-preview` for low-quality per-segment review renders
- `verseline-approve` for promoting the draft timeline
- `verseline-render` for approved profile-based full renders

The older recitation-focused commands are still present, but the generalized Verseline path is now the primary direction.

Relevant docs:

- [docs/recitation-workflow.md](docs/recitation-workflow.md)
- [docs/verseline-format.md](docs/verseline-format.md)

Concrete examples live under [examples/](examples/).

## Review Flow

The intended flow is:

1. edit the draft timeline in `verseline-edit`
2. preview the selected segment with `p`
3. mark segment statuses inside the TUI
4. promote the draft to the approved timeline with `A`
5. run one or more approved render profiles with `r` or `R`

Current TUI action keys:

- `p` preview current segment
- `v` validate current in-memory timeline
- `a` mark current segment `approved`
- `x` mark current segment `needs_fix`
- `A` write the current draft into the approved timeline
- `[` and `]` switch render profile
- `r` render the selected profile
- `R` render all profiles

## Quick Start

Install [Go](https://golang.org/) and [ffmpeg](https://www.ffmpeg.org/).

```console
$ go build
```

To get the list of markut subcommands do

```console
$ ./markut help
```

To get the list of functions of the stack language do

```console
$ ./markut funcs
```

<!-- TODO: document available stacks of Markut language -->
<!-- TODO: document available types and values of Markut language -->
<!-- TODO: document available commands of Markut language -->
