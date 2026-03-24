package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type recitationDraftKind int

const (
	recitationDraftArray recitationDraftKind = iota
	recitationDraftObject
)

type recitationDraftDocument struct {
	kind     recitationDraftKind
	object   map[string]json.RawMessage
	segments []recitationDraftSegment
}

type recitationDraftSegment struct {
	Start  string
	End    string
	Text   string
	Size   string
	Status string
	extras map[string]json.RawMessage
}

type recitationEditField string

const (
	editFieldStart  recitationEditField = "start"
	editFieldEnd    recitationEditField = "end"
	editFieldText   recitationEditField = "text"
	editFieldSize   recitationEditField = "size"
	editFieldStatus recitationEditField = "status"
)

type recitationEditMode int

const (
	recitationModeNormal recitationEditMode = iota
	recitationModeEditing
)

type recitationSavedMsg struct {
	err error
}

type recitationTUIModel struct {
	path          string
	doc           *recitationDraftDocument
	selected      int
	mode          recitationEditMode
	editingField  recitationEditField
	editor        textinput.Model
	dirty         bool
	status        string
	lastErr       error
	quitAfterSave bool
}

func runRecitationTUI(path string) error {
	doc, err := loadRecitationDraft(path)
	if err != nil {
		return err
	}

	model := newRecitationTUIModel(path, doc)
	program := tea.NewProgram(model, tea.WithAltScreen())
	finalModel, err := program.Run()
	if err != nil {
		return err
	}

	model, ok := finalModel.(recitationTUIModel)
	if !ok {
		return errors.New("unexpected final model type")
	}

	if model.lastErr != nil {
		return model.lastErr
	}

	if model.dirty {
		if err := writeRecitationDraft(path, model.doc); err != nil {
			return err
		}
	}

	return nil
}

func newRecitationTUIModel(path string, doc *recitationDraftDocument) recitationTUIModel {
	editor := textinput.New()
	editor.Prompt = ""
	editor.CharLimit = 4096
	editor.Width = 72
	editor.Blur()

	status := "up/down to move, 1-5 to edit, s to save, q to quit"
	if len(doc.segments) == 0 {
		status = "no segments found"
	}

	return recitationTUIModel{
		path:   path,
		doc:    doc,
		editor: editor,
		status: status,
	}
}

func (m recitationTUIModel) Init() tea.Cmd {
	return nil
}

func (m recitationTUIModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		return m, nil
	case recitationSavedMsg:
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
		if m.mode == recitationModeEditing {
			return m.updateEditing(msg)
		}
		return m.updateNormal(msg)
	default:
		return m, nil
	}
}

func (m recitationTUIModel) updateNormal(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if len(m.doc.segments) == 0 {
		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit
		}
		return m, nil
	}

	switch msg.String() {
	case "up", "k":
		if m.selected > 0 {
			m.selected--
		}
	case "down", "j":
		if m.selected+1 < len(m.doc.segments) {
			m.selected++
		}
	case "home":
		m.selected = 0
	case "end":
		m.selected = len(m.doc.segments) - 1
	case "1":
		return m.beginEdit(editFieldStart), textinput.Blink
	case "2":
		return m.beginEdit(editFieldEnd), textinput.Blink
	case "3":
		return m.beginEdit(editFieldText), textinput.Blink
	case "4":
		return m.beginEdit(editFieldSize), textinput.Blink
	case "5":
		return m.beginEdit(editFieldStatus), textinput.Blink
	case "s", "ctrl+s":
		m.status = "saving..."
		return m, saveRecitationDraftCmd(m.path, m.doc)
	case "q", "ctrl+c":
		if m.dirty {
			m.status = "saving before quit..."
			m.quitAfterSave = true
			return m, saveRecitationDraftCmd(m.path, m.doc)
		}
		return m, tea.Quit
	}

	return m, nil
}

func (m recitationTUIModel) updateEditing(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "esc":
		m.mode = recitationModeNormal
		m.editor.Blur()
		m.status = "edit cancelled"
		return m, nil
	case "enter":
		m.applyEditedValue(m.editor.Value())
		m.mode = recitationModeNormal
		m.editor.Blur()
		m.dirty = true
		m.status = "updated " + string(m.editingField)
		return m, nil
	}

	var cmd tea.Cmd
	m.editor, cmd = m.editor.Update(msg)
	return m, cmd
}

func (m recitationTUIModel) beginEdit(field recitationEditField) recitationTUIModel {
	m.mode = recitationModeEditing
	m.editingField = field
	m.editor.SetValue(m.currentValue(field))
	m.editor.CursorEnd()
	m.editor.Focus()
	m.status = "editing " + string(field)
	return m
}

func (m recitationTUIModel) currentValue(field recitationEditField) string {
	segment := m.doc.segments[m.selected]
	switch field {
	case editFieldStart:
		return segment.Start
	case editFieldEnd:
		return segment.End
	case editFieldText:
		return segment.Text
	case editFieldSize:
		if segment.Size == "" {
			return "default"
		}
		return segment.Size
	case editFieldStatus:
		if segment.Status == "" {
			return "draft"
		}
		return segment.Status
	default:
		return ""
	}
}

func (m *recitationTUIModel) applyEditedValue(value string) {
	if m.selected < 0 || m.selected >= len(m.doc.segments) {
		return
	}

	segment := &m.doc.segments[m.selected]
	switch m.editingField {
	case editFieldStart:
		segment.Start = strings.TrimSpace(value)
	case editFieldEnd:
		segment.End = strings.TrimSpace(value)
	case editFieldText:
		segment.Text = value
	case editFieldSize:
		segment.Size = strings.TrimSpace(value)
	case editFieldStatus:
		segment.Status = strings.TrimSpace(value)
	}
}

func (m recitationTUIModel) View() string {
	var sb strings.Builder
	sb.WriteString("Recitation Draft Editor\n")
	sb.WriteString(fmt.Sprintf("file: %s\n", m.path))
	sb.WriteString(strings.Repeat("=", 92))
	sb.WriteString("\n")

	if len(m.doc.segments) == 0 {
		sb.WriteString("No segments loaded.\n")
		sb.WriteString("\n")
		sb.WriteString(m.status)
		sb.WriteString("\n")
		return sb.String()
	}

	for i, segment := range m.doc.segments {
		cursor := " "
		if i == m.selected {
			cursor = ">"
		}
		sb.WriteString(fmt.Sprintf(
			"%s %03d | %-12s -> %-12s | %-8s | %-8s | %s\n",
			cursor,
			i+1,
			normalizeDraftField(segment.Start, "-"),
			normalizeDraftField(segment.End, "-"),
			normalizeDraftField(segment.Size, "default"),
			normalizeDraftField(segment.Status, "draft"),
			truncateDraftText(segment.Text, 40),
		))
	}

	sb.WriteString("\n")
	sb.WriteString("1:start  2:end  3:text  4:size  5:status  up/down:j/k  s:save  q:quit\n")
	sb.WriteString("current: ")
	sb.WriteString(m.status)
	sb.WriteString("\n")

	if m.mode == recitationModeEditing {
		sb.WriteString("\nedit ")
		sb.WriteString(string(m.editingField))
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

func saveRecitationDraftCmd(path string, doc *recitationDraftDocument) tea.Cmd {
	return func() tea.Msg {
		err := writeRecitationDraft(path, doc)
		return recitationSavedMsg{err: err}
	}
}

func loadRecitationDraft(path string) (*recitationDraftDocument, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	trimmed := bytes.TrimSpace(content)
	if len(trimmed) == 0 {
		return nil, errors.New("draft file is empty")
	}

	switch trimmed[0] {
	case '[':
		return loadRecitationDraftArray(trimmed)
	case '{':
		return loadRecitationDraftObject(trimmed)
	default:
		return nil, errors.New("draft file must be JSON array or JSON object")
	}
}

func loadRecitationDraftArray(data []byte) (*recitationDraftDocument, error) {
	var rawSegments []map[string]json.RawMessage
	if err := json.Unmarshal(data, &rawSegments); err != nil {
		return nil, err
	}

	doc := &recitationDraftDocument{kind: recitationDraftArray}
	for _, rawSegment := range rawSegments {
		segment, err := decodeRecitationDraftSegment(rawSegment)
		if err != nil {
			return nil, err
		}
		doc.segments = append(doc.segments, segment)
	}

	return doc, nil
}

func loadRecitationDraftObject(data []byte) (*recitationDraftDocument, error) {
	var rawObject map[string]json.RawMessage
	if err := json.Unmarshal(data, &rawObject); err != nil {
		return nil, err
	}

	rawSegments, ok := rawObject["segments"]
	if !ok {
		return nil, errors.New("draft object must contain a segments field")
	}

	var rawSegmentItems []map[string]json.RawMessage
	if err := json.Unmarshal(rawSegments, &rawSegmentItems); err != nil {
		return nil, err
	}

	doc := &recitationDraftDocument{
		kind:   recitationDraftObject,
		object: rawObject,
	}

	for _, rawSegment := range rawSegmentItems {
		segment, err := decodeRecitationDraftSegment(rawSegment)
		if err != nil {
			return nil, err
		}
		doc.segments = append(doc.segments, segment)
	}

	return doc, nil
}

func decodeRecitationDraftSegment(raw map[string]json.RawMessage) (recitationDraftSegment, error) {
	segment := recitationDraftSegment{
		extras: map[string]json.RawMessage{},
	}

	if err := decodeJSONString(raw, "start", &segment.Start); err != nil {
		return segment, err
	}
	if err := decodeJSONString(raw, "end", &segment.End); err != nil {
		return segment, err
	}
	_ = decodeJSONString(raw, "text", &segment.Text)
	_ = decodeJSONString(raw, "size", &segment.Size)
	_ = decodeJSONString(raw, "status", &segment.Status)

	for key, value := range raw {
		switch key {
		case "start", "end", "text", "size", "status":
			continue
		default:
			segment.extras[key] = value
		}
	}

	return segment, nil
}

func decodeJSONString(raw map[string]json.RawMessage, key string, target *string) error {
	value, ok := raw[key]
	if !ok {
		return nil
	}
	if err := json.Unmarshal(value, target); err != nil {
		return fmt.Errorf("%s: %w", key, err)
	}
	return nil
}

func writeRecitationDraft(path string, doc *recitationDraftDocument) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	var data []byte
	var err error

	switch doc.kind {
	case recitationDraftArray:
		data, err = marshalRecitationDraftArray(doc.segments)
	case recitationDraftObject:
		data, err = marshalRecitationDraftObject(doc)
	default:
		err = errors.New("unknown draft document kind")
	}

	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

func marshalRecitationDraftArray(segments []recitationDraftSegment) ([]byte, error) {
	rawSegments := make([]map[string]any, 0, len(segments))
	for _, segment := range segments {
		rawSegments = append(rawSegments, segmentToMap(segment))
	}
	return json.MarshalIndent(rawSegments, "", "  ")
}

func marshalRecitationDraftObject(doc *recitationDraftDocument) ([]byte, error) {
	rawObject := map[string]json.RawMessage{}
	for key, value := range doc.object {
		rawObject[key] = value
	}

	rawSegments, err := marshalRecitationDraftArray(doc.segments)
	if err != nil {
		return nil, err
	}
	rawObject["segments"] = json.RawMessage(rawSegments)

	return json.MarshalIndent(rawObject, "", "  ")
}

func segmentToMap(segment recitationDraftSegment) map[string]any {
	result := map[string]any{}
	for key, value := range segment.extras {
		result[key] = value
	}
	result["start"] = segment.Start
	result["end"] = segment.End
	result["text"] = segment.Text
	result["size"] = segment.Size
	result["status"] = segment.Status
	return result
}

func normalizeDraftField(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func truncateDraftText(text string, max int) string {
	text = strings.ReplaceAll(text, "\n", " ")
	runes := []rune(text)
	if len(runes) <= max {
		return text
	}
	if max <= 1 {
		return string(runes[:max])
	}
	return string(runes[:max-1]) + "…"
}
