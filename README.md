# Verseline (formerly Markut)

You describe how you want to edit your video in a `MARKUT` file using a simple [Stack-Based Language](https://en.wikipedia.org/wiki/Stack-oriented_programming) and Markut translates it to a sequence of ffmpeg command and assembles the final video. I'm using this tools to edit my VODs that I upload at [Tsoding Daily](https://youtube.com/@TsodingDaily) YouTube channel.

This repo is being repurposed into `Verseline`, a personal timed text-video renderer with a strong focus on portrait recitation clips, poems, and multi-block subtitle layouts.

The newer Verseline workflow in this repo now includes:

- `verseline-validate` for project and timeline validation
- `verseline-edit` for a minimal timeline TUI
- `verseline-approve` for promoting the draft timeline
- `verseline-render` for rendering the approved timeline

The older recitation-focused commands are still present, but the generalized Verseline path is now the primary direction.

Relevant docs:

- [docs/recitation-workflow.md](docs/recitation-workflow.md)
- [docs/verseline-format.md](docs/verseline-format.md)

Concrete examples live under [examples/](examples/).

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
