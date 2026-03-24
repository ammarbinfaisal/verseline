package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type verselineEditField string

const (
	verselineFieldStart     verselineEditField = "start"
	verselineFieldEnd       verselineEditField = "end"
	verselineFieldStatus    verselineEditField = "status"
	verselineFieldBlockText verselineEditField = "block_text"
	verselineFieldBlockStyle verselineEditField = "block_style"
	verselineFieldBlockPlacement verselineEditField = "block_placement"
)

type verselineEditMode int

const (
	verselineModeNormal verselineEditMode = iota
	verselineModeEditing
)

type verselineSavedMsg struct {
	err error
}

type verselineTUIModel struct {
	path         string
	segments     []VerselineSegment
	segmentIndex int
	blockIndex   int
	mode         verselineEditMode
	field        verselineEditField
	editor       textinput.Model
	dirty        bool
	status       string
	lastErr      error
	quitAfterSave bool
}

func init() {
	Subcommands["verseline-edit"] = Subcommand{
		Description: "Open a minimal TUI for editing a Verseline timeline",
		Run: func(name string, args []string) bool {
			subFlag := flag.NewFlagSet(name, flag.ContinueOnError)
			projectPtr := subFlag.String("project", "examples/verseline-project.json", "Path to the Verseline project JSON file")
			filePtr := subFlag.String("file", "", "Optional direct path to a timeline JSONL file")
			draftPtr := subFlag.Bool("draft", false, "Open the draft timeline instead of the approved timeline")

			err := subFlag.Parse(args)
			if err == flag.ErrHelp {
				return true
			}
			if err != nil {
				fmt.Printf("ERROR: Could not parse command line arguments: %s\n", err)
				return false
			}

			target := strings.TrimSpace(*filePtr)
			if target == "" {
				project, projectPath, err := loadVerselineProject(*projectPtr)
				if err != nil {
					fmt.Printf("ERROR: Could not load Verseline project %s: %s\n", *projectPtr, err)
					return false
				}
				timelinePath := project.Timeline.Approved
				if *draftPtr || strings.TrimSpace(timelinePath) == "" {
					timelinePath = project.Timeline.Draft
				}
				if strings.TrimSpace(timelinePath) == "" {
					fmt.Printf("ERROR: project does not define a usable timeline path\n")
					return false
				}
				target = resolveReelPath(filepath.Dir(projectPath), timelinePath)
			}

			if err := runVerselineTUI(target); err != nil {
				fmt.Printf("ERROR: Could not edit %s: %s\n", target, err)
				return false
			}

			fmt.Printf("Saved %s\n", target)
			return true
		},
	}
}

func runVerselineTUI(path string) error {
	segments, err := loadVerselineTimeline(path)
	if err != nil {
		return err
	}

	model := newVerselineTUIModel(path, segments)
	program := tea.NewProgram(model, tea.WithAltScreen())
	finalModel, err := program.Run()
	if err != nil {
		return err
	}

	model, ok := finalModel.(verselineTUIModel)
	if !ok {
		return errors.New("unexpected final model type")
	}
	if model.lastErr != nil {
		return model.lastErr
	}
	if model.dirty {
		return saveVerselineTimeline(path, model.segments)
	}
	return nil
}

func newVerselineTUIModel(path string, segments []VerselineSegment) verselineTUIModel {
	editor := textinput.New()
	editor.Prompt = ""
	editor.CharLimit = 8192
	editor.Width = 80
	editor.Blur()

	status := "up/down segment, left/right block, 1-6 edit, s save, q quit"
	if len(segments) == 0 {
		status = "no segments found"
	}

	return verselineTUIModel{
		path:     path,
		segments: segments,
		editor:   editor,
		status:   status,
	}
}

func (m verselineTUIModel) Init() tea.Cmd {
	return nil
}

func (m verselineTUIModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case verselineSavedMsg:
		if msg.err != nil {
			m.lastErr = msg.err
			m.status = "save failed"
			m.quitAfterSave = false
			return m, nil
		}
		m.dirty = false
		m.lastErr = nil
		m.status = "saved at " + time.Now().Format("15:04:05")
		if m.quitAfterSave {
			return m, tea.Quit
		}
		return m, nil
	case tea.KeyMsg:
		if m.mode == verselineModeEditing {
			return m.updateEditing(msg)
		}
		return m.updateNormal(msg)
	default:
		return m, nil
	}
}

func (m verselineTUIModel) updateNormal(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if len(m.segments) == 0 {
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		}
		return m, nil
	}

	switch msg.String() {
	case "up", "k":
		if m.segmentIndex > 0 {
			m.segmentIndex--
			m.blockIndex = 0
		}
	case "down", "j":
		if m.segmentIndex+1 < len(m.segments) {
			m.segmentIndex++
			m.blockIndex = 0
		}
	case "left", "h":
		if m.blockIndex > 0 {
			m.blockIndex--
		}
	case "right", "l":
		if m.blockIndex+1 < len(m.currentSegment().Blocks) {
			m.blockIndex++
		}
	case "1":
		return m.beginEdit(verselineFieldStart), textinput.Blink
	case "2":
		return m.beginEdit(verselineFieldEnd), textinput.Blink
	case "3":
		return m.beginEdit(verselineFieldStatus), textinput.Blink
	case "4":
		return m.beginEdit(verselineFieldBlockText), textinput.Blink
	case "5":
		return m.beginEdit(verselineFieldBlockStyle), textinput.Blink
	case "6":
		return m.beginEdit(verselineFieldBlockPlacement), textinput.Blink
	case "s", "ctrl+s":
		m.status = "saving..."
		return m, saveVerselineTimelineCmd(m.path, m.segments)
	case "q", "ctrl+c":
		if m.dirty {
			m.status = "saving before quit..."
			m.quitAfterSave = true
			return m, saveVerselineTimelineCmd(m.path, m.segments)
		}
		return m, tea.Quit
	}
	return m, nil
}

func (m verselineTUIModel) updateEditing(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		m.mode = verselineModeNormal
		m.editor.Blur()
		m.status = "edit cancelled"
		return m, nil
	case "enter":
		m.applyEditedValue(m.editor.Value())
		m.mode = verselineModeNormal
		m.editor.Blur()
		m.dirty = true
		m.status = "updated " + string(m.field)
		return m, nil
	}

	var cmd tea.Cmd
	m.editor, cmd = m.editor.Update(msg)
	return m, cmd
}

func (m verselineTUIModel) beginEdit(field verselineEditField) verselineTUIModel {
	m.mode = verselineModeEditing
	m.field = field
	m.editor.SetValue(m.currentValue(field))
	m.editor.CursorEnd()
	m.editor.Focus()
	m.status = "editing " + string(field)
	return m
}

func (m verselineTUIModel) currentSegment() *VerselineSegment {
	return &m.segments[m.segmentIndex]
}

func (m verselineTUIModel) currentBlock() *VerselineBlock {
	segment := m.currentSegment()
	if len(segment.Blocks) == 0 {
		return nil
	}
	if m.blockIndex >= len(segment.Blocks) {
		return &segment.Blocks[len(segment.Blocks)-1]
	}
	return &segment.Blocks[m.blockIndex]
}

func (m verselineTUIModel) currentValue(field verselineEditField) string {
	segment := m.currentSegment()
	block := m.currentBlock()

	switch field {
	case verselineFieldStart:
		return segment.Start
	case verselineFieldEnd:
		return segment.End
	case verselineFieldStatus:
		return normalizeDraftField(segment.Status, "draft")
	case verselineFieldBlockText:
		if block == nil {
			return ""
		}
		return block.Text
	case verselineFieldBlockStyle:
		if block == nil {
			return ""
		}
		return block.Style
	case verselineFieldBlockPlacement:
		if block == nil {
			return ""
		}
		return block.Placement
	default:
		return ""
	}
}

func (m *verselineTUIModel) applyEditedValue(value string) {
	segment := m.currentSegment()
	block := m.currentBlock()
	trimmed := strings.TrimSpace(value)

	switch m.field {
	case verselineFieldStart:
		segment.Start = trimmed
	case verselineFieldEnd:
		segment.End = trimmed
	case verselineFieldStatus:
		segment.Status = trimmed
	case verselineFieldBlockText:
		if block != nil {
			block.Text = value
		}
	case verselineFieldBlockStyle:
		if block != nil {
			block.Style = trimmed
		}
	case verselineFieldBlockPlacement:
		if block != nil {
			block.Placement = trimmed
		}
	}
}

func (m verselineTUIModel) View() string {
	var sb strings.Builder
	sb.WriteString("Verseline Timeline Editor\n")
	sb.WriteString(fmt.Sprintf("file: %s\n", m.path))
	sb.WriteString(strings.Repeat("=", 100))
	sb.WriteString("\n")

	if len(m.segments) == 0 {
		sb.WriteString("No segments loaded.\n\n")
		sb.WriteString(m.status)
		sb.WriteString("\n")
		return sb.String()
	}

	for i, segment := range m.segments {
		cursor := " "
		if i == m.segmentIndex {
			cursor = ">"
		}
		sb.WriteString(fmt.Sprintf(
			"%s %03d | %-12s -> %-12s | %-8s | blocks:%d | %s\n",
			cursor,
			i+1,
			normalizeDraftField(segment.Start, "-"),
			normalizeDraftField(segment.End, "-"),
			normalizeDraftField(segment.Status, "draft"),
			len(segment.Blocks),
			truncateDraftText(segment.Notes, 32),
		))
	}

	segment := m.currentSegment()
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf("segment %03d blocks\n", m.segmentIndex+1))
	for i, block := range segment.Blocks {
		cursor := " "
		if i == m.blockIndex {
			cursor = "*"
		}
		sb.WriteString(fmt.Sprintf(
			"%s %02d | %-18s | %-16s | %-14s | %s\n",
			cursor,
			i+1,
			normalizeDraftField(block.Kind, "literal"),
			normalizeDraftField(block.Style, "-"),
			normalizeDraftField(block.Placement, "-"),
			truncateDraftText(block.Text, 40),
		))
	}

	sb.WriteString("\n")
	sb.WriteString("1:start  2:end  3:status  4:block text  5:block style  6:block placement\n")
	sb.WriteString("up/down:j/k segment  left/right:h/l block  s:save  q:quit\n")
	sb.WriteString("current: ")
	sb.WriteString(m.status)
	sb.WriteString("\n")

	if m.mode == verselineModeEditing {
		sb.WriteString("\nedit ")
		sb.WriteString(string(m.field))
		sb.WriteString(": ")
		sb.WriteString(m.editor.View())
		sb.WriteString("\n")
	}

	if m.lastErr != nil {
		sb.WriteString("error: ")
		sb.WriteString(m.lastErr.Error())
		sb.WriteString("\n")
	}
	return sb.String()
}

func saveVerselineTimelineCmd(path string, segments []VerselineSegment) tea.Cmd {
	return func() tea.Msg {
		return verselineSavedMsg{err: saveVerselineTimeline(path, segments)}
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
