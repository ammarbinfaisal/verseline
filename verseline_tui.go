package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

type verselineSavedMsg struct {
	err error
}

type verselineJobMsg struct {
	progress *verselineRenderProgress
	status   string
	err      error
	done     bool
}

func init() {
	Subcommands["verseline-edit"] = Subcommand{
		Description: "Open the Verseline TUI for editing projects, timelines, and styles",
		Run: func(name string, args []string) bool {
			subFlag := flag.NewFlagSet(name, flag.ContinueOnError)
			projectPtr := subFlag.String("project", "examples/verseline-project.json", "Path to the Verseline project JSON file")
			draftPtr := subFlag.Bool("draft", false, "Open the draft timeline instead of the approved timeline")

			err := subFlag.Parse(args)
			if err == flag.ErrHelp {
				return true
			}
			if err != nil {
				fmt.Printf("ERROR: Could not parse command line arguments: %s\n", err)
				return false
			}

			project, projectPath, err := loadVerselineProject(*projectPtr)
			if err != nil {
				fmt.Printf("ERROR: Could not load Verseline project %s: %s\n", *projectPtr, err)
				return false
			}

			timelinePath := project.Timeline.Approved
			editingApproved := true
			if *draftPtr || strings.TrimSpace(timelinePath) == "" {
				timelinePath = project.Timeline.Draft
				editingApproved = false
			}

			var segments []VerselineSegment
			var resolvedTimelinePath string
			if strings.TrimSpace(timelinePath) != "" {
				resolvedTimelinePath = resolveReelPath(filepath.Dir(projectPath), timelinePath)
				segments, err = loadVerselineTimeline(resolvedTimelinePath)
				if err != nil {
					fmt.Printf("ERROR: Could not load timeline %s: %s\n", resolvedTimelinePath, err)
					return false
				}
			}

			if err := runVerselineTUI(&project, projectPath, segments, resolvedTimelinePath, editingApproved); err != nil {
				fmt.Printf("ERROR: %s\n", err)
				return false
			}
			return true
		},
	}
}

func runVerselineTUI(project *VerselineProject, projectPath string, segments []VerselineSegment, timelinePath string, editingApproved bool) error {
	model := newVerselineTUIRoot(project, projectPath, segments, timelinePath, editingApproved)
	program := tea.NewProgram(model, tea.WithAltScreen())
	_, err := program.Run()
	return err
}

func waitVerselineJobCmd(ch <-chan verselineJobMsg) tea.Cmd {
	return func() tea.Msg {
		msg, ok := <-ch
		if !ok {
			return verselineJobMsg{done: true}
		}
		return msg
	}
}

func saveVerselineTimeline(path string, segments []VerselineSegment) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	lines := make([]string, 0, len(segments))
	for _, segment := range segments {
		payload, err := json.Marshal(segment)
		if err != nil {
			return err
		}
		lines = append(lines, string(payload))
	}

	output := strings.Join(lines, "\n")
	if output != "" {
		output += "\n"
	}
	return os.WriteFile(path, []byte(output), 0644)
}
