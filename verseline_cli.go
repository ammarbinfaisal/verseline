package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type verselineNestedCommand struct {
	Description string
	Run         func(name string, args []string) bool
}

var verselineNestedCommands = map[string]verselineNestedCommand{
	"mcp": {
		Description: "Run the assistant-facing MCP server entrypoint",
		Run:         runVerselineMCPCommand,
	},
	"preview": {
		Description: "Render a low-quality preview for one segment",
		Run: func(name string, args []string) bool {
			return runVerselineLegacyAlias("verseline-preview", name, args)
		},
	},
	"render": {
		Description: "Render project outputs",
		Run: func(name string, args []string) bool {
			return runVerselineLegacyAlias("render", name, args)
		},
	},
	"tui": {
		Description: "Open the timeline review and approval TUI",
		Run: func(name string, args []string) bool {
			return runVerselineLegacyAlias("verseline-edit", name, args)
		},
	},
	"validate": {
		Description: "Validate a project and timeline",
		Run: func(name string, args []string) bool {
			return runVerselineLegacyAlias("verseline-validate", name, args)
		},
	},
}

func init() {
	Subcommands["verseline"] = Subcommand{
		Description: "Reduced Verseline surface: tui, render, mcp",
		Run:         runVerselineCommand,
	}
}

func currentProgramName() string {
	name := strings.TrimSpace(filepath.Base(os.Args[0]))
	if name == "" {
		return "verseline"
	}
	return name
}

func isVerselineExecutableName(name string) bool {
	base := strings.TrimSuffix(strings.ToLower(filepath.Base(name)), filepath.Ext(name))
	return base == "verseline"
}

func isVerselineHelpArg(arg string) bool {
	switch strings.TrimSpace(arg) {
	case "help", "-h", "--help":
		return true
	default:
		return false
	}
}

func isVerselineNestedCommand(name string) bool {
	_, ok := verselineNestedCommands[strings.TrimSpace(name)]
	return ok
}

func printVerselineUsage(program string) {
	names := make([]string, 0, len(verselineNestedCommands))
	for name := range verselineNestedCommands {
		names = append(names, name)
	}
	sort.Strings(names)

	fmt.Printf("Usage: %s <COMMAND> [OPTIONS]\n", program)
	fmt.Printf("Core commands:\n")
	for _, name := range []string{"tui", "render", "mcp"} {
		command := verselineNestedCommands[name]
		fmt.Printf("    %s - %s\n", name, command.Description)
	}
	fmt.Printf("Helper commands:\n")
	for _, name := range names {
		if name == "tui" || name == "render" || name == "mcp" {
			continue
		}
		command := verselineNestedCommands[name]
		fmt.Printf("    %s - %s\n", name, command.Description)
	}
	fmt.Printf("Examples:\n")
	fmt.Printf("    %s tui -project examples/verseline-project.json\n", program)
	fmt.Printf("    %s render -project examples/verseline-project.json\n", program)
}

func runVerselineCommand(name string, args []string) bool {
	program := "verseline"
	if isVerselineExecutableName(currentProgramName()) {
		program = currentProgramName()
	}

	if len(args) == 0 {
		printVerselineUsage(program)
		fmt.Printf("ERROR: No Verseline command is provided\n")
		return false
	}
	if isVerselineHelpArg(args[0]) {
		printVerselineUsage(program)
		return true
	}

	commandName := strings.TrimSpace(args[0])
	command, ok := verselineNestedCommands[commandName]
	if !ok {
		printVerselineUsage(program)
		fmt.Printf("ERROR: Unknown Verseline command %s\n", commandName)
		return false
	}

	return command.Run(commandName, args[1:])
}

func runVerselineLegacyAlias(legacyName string, name string, args []string) bool {
	subcommand, ok := Subcommands[legacyName]
	if !ok {
		fmt.Printf("ERROR: missing legacy command backing %s\n", name)
		return false
	}
	return subcommand.Run(name, withImplicitProjectFlag(args))
}

func withImplicitProjectFlag(args []string) []string {
	if len(args) == 0 {
		return args
	}

	first := strings.TrimSpace(args[0])
	if first == "" || strings.HasPrefix(first, "-") {
		return args
	}

	return append([]string{"-project", first}, args[1:]...)
}
