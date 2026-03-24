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
	verselineFieldStart          verselineEditField = "start"
	verselineFieldEnd            verselineEditField = "end"
	verselineFieldStatus         verselineEditField = "status"
	verselineFieldBlockText      verselineEditField = "block_text"
	verselineFieldBlockStyle     verselineEditField = "block_style"
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

type verselineProjectContext struct {
	project         *VerselineProject
	projectPath     string
	editingApproved bool
}

type verselineJobMsg struct {
	progress *verselineRenderProgress
	status   string
	err      error
	done     bool
}

type verselineTUIModel struct {
	path               string
	context            *verselineProjectContext
	segments           []VerselineSegment
	segmentIndex       int
	blockIndex         int
	renderProfileIndex int
	mode               verselineEditMode
	field              verselineEditField
	editor             textinput.Model
	dirty              bool
	status             string
	lastErr            error
	jobActive          bool
	jobUpdates         <-chan verselineJobMsg
	quitAfterSave      bool
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
			var context *verselineProjectContext
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
				projectCopy := project
				context = &verselineProjectContext{
					project:         &projectCopy,
					projectPath:     projectPath,
					editingApproved: !*draftPtr && strings.TrimSpace(project.Timeline.Approved) != "",
				}
			}

			if err := runVerselineTUI(target, context); err != nil {
				fmt.Printf("ERROR: Could not edit %s: %s\n", target, err)
				return false
			}

			fmt.Printf("Saved %s\n", target)
			return true
		},
	}
}

func runVerselineTUI(path string, context *verselineProjectContext) error {
	segments, err := loadVerselineTimeline(path)
	if err != nil {
		return err
	}

	model := newVerselineTUIModel(path, context, segments)
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

func newVerselineTUIModel(path string, context *verselineProjectContext, segments []VerselineSegment) verselineTUIModel {
	editor := textinput.New()
	editor.Prompt = ""
	editor.CharLimit = 8192
	editor.Width = 80
	editor.Blur()

	status := "up/down segment, left/right block, 1-6 edit, p preview, A approve, r render, q quit"
	if len(segments) == 0 {
		status = "no segments found"
	}

	return verselineTUIModel{
		path:     path,
		context:  context,
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
	case verselineJobMsg:
		if msg.progress != nil {
			switch msg.progress.Stage {
			case "done":
				m.status = fmt.Sprintf("%s complete (%s)", normalizeDraftField(msg.progress.JobLabel, "job"), filepath.Base(msg.progress.OutputPath))
			default:
				m.status = fmt.Sprintf("%s %.0f%%", normalizeDraftField(msg.progress.JobLabel, "job"), msg.progress.Percent)
			}
		}
		if strings.TrimSpace(msg.status) != "" {
			m.status = msg.status
		}
		if msg.done {
			m.jobActive = false
			m.jobUpdates = nil
			m.lastErr = msg.err
			if msg.err != nil {
				m.status = msg.err.Error()
			}
			return m, nil
		}
		if m.jobUpdates != nil {
			return m, waitVerselineJobCmd(m.jobUpdates)
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
	if m.jobActive {
		switch msg.String() {
		case "q", "ctrl+c":
			m.status = "wait for current job to finish"
		}
		return m, nil
	}
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
	case "p":
		return m.startPreview()
	case "v":
		return m.validateCurrent()
	case "a":
		return m.setCurrentSegmentStatus("approved"), nil
	case "x":
		return m.setCurrentSegmentStatus("needs_fix"), nil
	case "A":
		return m.approveCurrentDraft()
	case "[":
		if m.renderProfileIndex > 0 {
			m.renderProfileIndex--
		}
	case "]":
		if m.renderProfileIndex+1 < len(m.renderProfiles()) {
			m.renderProfileIndex++
		}
	case "r":
		return m.startRenderCurrentProfile()
	case "R":
		return m.startRenderAllProfiles()
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

func (m verselineTUIModel) hasProjectContext() bool {
	return m.context != nil && m.context.project != nil && strings.TrimSpace(m.context.projectPath) != ""
}

func (m verselineTUIModel) renderProfiles() []VerselineRenderProfile {
	if !m.hasProjectContext() || len(m.context.project.RenderProfiles) == 0 {
		return []VerselineRenderProfile{{ID: "default", Label: "default"}}
	}
	return m.context.project.RenderProfiles
}

func (m verselineTUIModel) currentRenderProfile() VerselineRenderProfile {
	profiles := m.renderProfiles()
	if m.renderProfileIndex < 0 || m.renderProfileIndex >= len(profiles) {
		return profiles[0]
	}
	return profiles[m.renderProfileIndex]
}

func (m verselineTUIModel) setCurrentSegmentStatus(status string) verselineTUIModel {
	if len(m.segments) == 0 {
		m.status = "no segment selected"
		return m
	}
	m.currentSegment().Status = status
	m.dirty = true
	m.status = "segment marked " + status
	return m
}

func (m verselineTUIModel) validateCurrent() (tea.Model, tea.Cmd) {
	if err := validateVerselineTimeline(m.segments); err != nil {
		m.lastErr = err
		m.status = err.Error()
		return m, nil
	}
	if m.hasProjectContext() {
		if err := validateVerselineTimelineAgainstProject(*m.context.project, m.segments); err != nil {
			m.lastErr = err
			m.status = err.Error()
			return m, nil
		}
	}
	m.lastErr = nil
	m.status = "timeline valid"
	return m, nil
}

func (m verselineTUIModel) approveCurrentDraft() (tea.Model, tea.Cmd) {
	if !m.hasProjectContext() {
		m.status = "approve requires project context"
		return m, nil
	}
	project := m.context.project
	if strings.TrimSpace(project.Timeline.Approved) == "" {
		m.status = "project has no approved timeline path"
		return m, nil
	}
	validatedModel, _ := m.validateCurrent()
	m = validatedModel.(verselineTUIModel)
	if m.lastErr != nil {
		return m, nil
	}
	for index, segment := range m.segments {
		if strings.EqualFold(strings.TrimSpace(segment.Status), "needs_fix") {
			m.status = fmt.Sprintf("segment %d is still needs_fix", index+1)
			return m, nil
		}
	}
	approvedPath := resolveReelPath(filepath.Dir(m.context.projectPath), project.Timeline.Approved)
	if err := saveVerselineTimeline(approvedPath, m.segments); err != nil {
		m.lastErr = err
		m.status = err.Error()
		return m, nil
	}
	m.lastErr = nil
	m.status = "approved timeline saved"
	return m, nil
}

func (m verselineTUIModel) startPreview() (tea.Model, tea.Cmd) {
	if !m.hasProjectContext() {
		m.status = "preview requires project context"
		return m, nil
	}
	segmentNumber := m.segmentIndex + 1
	return m.startAsyncJob(func(ch chan<- verselineJobMsg) {
		outputPath, err := verselinePreviewSegments(*m.context.project, m.context.projectPath, m.segments, segmentNumber, "", true, func(progress verselineRenderProgress) {
			ch <- verselineJobMsg{progress: &progress}
		})
		status := ""
		if err == nil {
			status = "preview opened: " + filepath.Base(outputPath)
		}
		ch <- verselineJobMsg{done: true, err: err, status: status}
	})
}

func (m verselineTUIModel) startRenderCurrentProfile() (tea.Model, tea.Cmd) {
	profile := m.currentRenderProfile()
	return m.startRenderProfiles([]string{profile.ID})
}

func (m verselineTUIModel) startRenderAllProfiles() (tea.Model, tea.Cmd) {
	profiles := m.renderProfiles()
	ids := make([]string, 0, len(profiles))
	for _, profile := range profiles {
		ids = append(ids, profile.ID)
	}
	return m.startRenderProfiles(ids)
}

func (m verselineTUIModel) startRenderProfiles(profileIDs []string) (tea.Model, tea.Cmd) {
	if !m.hasProjectContext() {
		m.status = "render requires project context"
		return m, nil
	}
	if !m.context.editingApproved {
		if m.dirty {
			m.status = "save and approve the draft before full renders"
			return m, nil
		}
	} else if m.dirty {
		if err := saveVerselineTimeline(m.path, m.segments); err != nil {
			m.lastErr = err
			m.status = err.Error()
			return m, nil
		}
		m.dirty = false
	}

	return m.startAsyncJob(func(ch chan<- verselineJobMsg) {
		outputs, err := verselineRenderProjectProfiles(m.context.projectPath, profileIDs, func(progress verselineRenderProgress) {
			ch <- verselineJobMsg{progress: &progress}
		})
		status := ""
		if err == nil && len(outputs) > 0 {
			status = "rendered " + filepath.Base(outputs[len(outputs)-1])
		}
		ch <- verselineJobMsg{done: true, err: err, status: status}
	})
}

func (m verselineTUIModel) startAsyncJob(run func(chan<- verselineJobMsg)) (tea.Model, tea.Cmd) {
	ch := make(chan verselineJobMsg, 32)
	go func() {
		defer close(ch)
		run(ch)
	}()
	m.jobActive = true
	m.jobUpdates = ch
	m.lastErr = nil
	return m, waitVerselineJobCmd(ch)
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

func (m verselineTUIModel) View() string {
	var sb strings.Builder
	sb.WriteString("Verseline Timeline Editor\n")
	sb.WriteString(fmt.Sprintf("file: %s\n", m.path))
	if m.hasProjectContext() {
		sb.WriteString(fmt.Sprintf("project: %s\n", m.context.projectPath))
		sb.WriteString(fmt.Sprintf("render profile: %s\n", normalizeDraftField(firstNonEmpty(m.currentRenderProfile().Label, m.currentRenderProfile().ID), "default")))
	}
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
	sb.WriteString("up/down:j/k segment  left/right:h/l block  [ ] profile  s:save  q:quit\n")
	sb.WriteString("p:preview  v:validate  a:mark-approved  x:mark-needs-fix  A:approve draft  r:render profile  R:render all\n")
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
