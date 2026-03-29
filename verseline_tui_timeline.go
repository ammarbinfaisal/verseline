package main

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type verselineTimelineEditField int

const (
	verselineTimelineFieldStart verselineTimelineEditField = iota
	verselineTimelineFieldEnd
	verselineTimelineFieldStatus
	verselineTimelineFieldBlockText
	verselineTimelineFieldBlockStyle
	verselineTimelineFieldBlockPlacement
)

var verselineTimelineFieldNames = []string{"start", "end", "status", "block text", "block style", "block placement"}

type verselineTimelineKeyMap struct {
	EditStart     key.Binding
	EditEnd       key.Binding
	EditStatus    key.Binding
	EditBlockText key.Binding
	EditBlockSty  key.Binding
	EditBlockPlc  key.Binding
	Approve       key.Binding
	NeedsFix      key.Binding
	ApproveDraft  key.Binding
	Preview       key.Binding
	Validate      key.Binding
	Render        key.Binding
	RenderAll     key.Binding
	PrevProfile   key.Binding
	NextProfile   key.Binding
	BlockUp       key.Binding
	BlockDown     key.Binding
	Quit          key.Binding
}

func newVerselineTimelineKeyMap() verselineTimelineKeyMap {
	return verselineTimelineKeyMap{
		EditStart:     key.NewBinding(key.WithKeys("1"), key.WithHelp("1", "edit start")),
		EditEnd:       key.NewBinding(key.WithKeys("2"), key.WithHelp("2", "edit end")),
		EditStatus:    key.NewBinding(key.WithKeys("3"), key.WithHelp("3", "edit status")),
		EditBlockText: key.NewBinding(key.WithKeys("4"), key.WithHelp("4", "edit block text")),
		EditBlockSty:  key.NewBinding(key.WithKeys("5"), key.WithHelp("5", "edit block style")),
		EditBlockPlc:  key.NewBinding(key.WithKeys("6"), key.WithHelp("6", "edit block placement")),
		Approve:       key.NewBinding(key.WithKeys("a"), key.WithHelp("a", "approve segment")),
		NeedsFix:      key.NewBinding(key.WithKeys("x"), key.WithHelp("x", "needs fix")),
		ApproveDraft:  key.NewBinding(key.WithKeys("A"), key.WithHelp("A", "approve draft")),
		Preview:       key.NewBinding(key.WithKeys("p"), key.WithHelp("p", "preview")),
		Validate:      key.NewBinding(key.WithKeys("v"), key.WithHelp("v", "validate")),
		Render:        key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "render")),
		RenderAll:     key.NewBinding(key.WithKeys("R"), key.WithHelp("R", "render all")),
		PrevProfile:   key.NewBinding(key.WithKeys("["), key.WithHelp("[", "prev profile")),
		NextProfile:   key.NewBinding(key.WithKeys("]"), key.WithHelp("]", "next profile")),
		BlockUp:       key.NewBinding(key.WithKeys("left", "h"), key.WithHelp("h/left", "prev block")),
		BlockDown:     key.NewBinding(key.WithKeys("right", "l"), key.WithHelp("l/right", "next block")),
		Quit:          key.NewBinding(key.WithKeys("q"), key.WithHelp("q", "quit")),
	}
}

type verselineTimelineHelpKeyMap struct {
	timeline verselineTimelineKeyMap
	global   verselineGlobalKeyMap
}

func (km verselineTimelineHelpKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{km.timeline.EditStart, km.timeline.Approve, km.timeline.Preview, km.timeline.Validate, km.global.NextTab, km.global.Help}
}

func (km verselineTimelineHelpKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{km.timeline.EditStart, km.timeline.EditEnd, km.timeline.EditStatus, km.timeline.EditBlockText, km.timeline.EditBlockSty, km.timeline.EditBlockPlc},
		{km.timeline.Approve, km.timeline.NeedsFix, km.timeline.ApproveDraft},
		{km.timeline.Preview, km.timeline.Validate, km.timeline.Render, km.timeline.RenderAll, km.timeline.PrevProfile, km.timeline.NextProfile},
		{km.timeline.BlockUp, km.timeline.BlockDown, km.global.NextTab, km.global.PrevTab, km.global.Save, km.timeline.Quit, km.global.Help},
	}
}

type verselineTimelineView struct {
	segmentTable       table.Model
	blockIndex         int
	renderProfileIndex int
	editing            bool
	editField          verselineTimelineEditField
	editor             textinput.Model
	keys               verselineTimelineKeyMap
}

func newVerselineTimelineView(ctx *verselineTUIContext) verselineTimelineView {
	segCols := []table.Column{
		{Title: "#", Width: 4},
		{Title: "Start", Width: 12},
		{Title: "End", Width: 12},
		{Title: "Status", Width: 10},
		{Title: "Blocks", Width: 6},
		{Title: "Notes", Width: 30},
	}

	segTable := table.New(
		table.WithColumns(segCols),
		table.WithRows(verselineTimelineSegmentRows(ctx.segments)),
		table.WithFocused(true),
		table.WithHeight(min(len(ctx.segments)+1, max(ctx.height-8, 6))),
	)
	segTable.SetStyles(verselineTableStyles())

	editor := textinput.New()
	editor.Prompt = ""
	editor.CharLimit = 8192
	editor.Width = 80
	editor.Blur()

	return verselineTimelineView{
		segmentTable: segTable,
		editor:       editor,
		keys:         newVerselineTimelineKeyMap(),
	}
}

func verselineTableStyles() table.Styles {
	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("240")).
		BorderBottom(true).
		Bold(true)
	s.Selected = s.Selected.
		Foreground(lipgloss.Color("229")).
		Background(lipgloss.Color("57")).
		Bold(false)
	return s
}

func verselineTimelineSegmentRows(segments []VerselineSegment) []table.Row {
	rows := make([]table.Row, len(segments))
	for i, seg := range segments {
		rows[i] = table.Row{
			fmt.Sprintf("%03d", i+1),
			normalizeDraftField(seg.Start, "-"),
			normalizeDraftField(seg.End, "-"),
			normalizeDraftField(seg.Status, "draft"),
			fmt.Sprintf("%d", len(seg.Blocks)),
			truncateDraftText(seg.Notes, 28),
		}
	}
	return rows
}

func (v *verselineTimelineView) syncRows(segments []VerselineSegment) {
	v.segmentTable.SetRows(verselineTimelineSegmentRows(segments))
}

func (v *verselineTimelineView) resize(ctx *verselineTUIContext) {
	h := max(ctx.height-8, 6)
	v.segmentTable.SetHeight(h)
	v.segmentTable.SetWidth(ctx.width)
}

func (v *verselineTimelineView) focus(ctx *verselineTUIContext) {
	v.segmentTable.Focus()
	v.syncRows(ctx.segments)
}

func (v *verselineTimelineView) blur() {
	v.segmentTable.Blur()
}

func (v *verselineTimelineView) isEditing() bool {
	return v.editing
}

func (v *verselineTimelineView) helpKeyMap(global verselineGlobalKeyMap) help.KeyMap {
	return verselineTimelineHelpKeyMap{timeline: v.keys, global: global}
}

func (v *verselineTimelineView) segmentIndex() int {
	return v.segmentTable.Cursor()
}

func (v *verselineTimelineView) currentSegment(segments []VerselineSegment) *VerselineSegment {
	idx := v.segmentIndex()
	if idx < 0 || idx >= len(segments) {
		return nil
	}
	return &segments[idx]
}

func (v *verselineTimelineView) currentBlock(segments []VerselineSegment) *VerselineBlock {
	seg := v.currentSegment(segments)
	if seg == nil || len(seg.Blocks) == 0 {
		return nil
	}
	idx := v.blockIndex
	if idx >= len(seg.Blocks) {
		idx = len(seg.Blocks) - 1
	}
	return &seg.Blocks[idx]
}

func (v *verselineTimelineView) currentValue(segments []VerselineSegment, field verselineTimelineEditField) string {
	seg := v.currentSegment(segments)
	if seg == nil {
		return ""
	}
	block := v.currentBlock(segments)
	switch field {
	case verselineTimelineFieldStart:
		return seg.Start
	case verselineTimelineFieldEnd:
		return seg.End
	case verselineTimelineFieldStatus:
		return normalizeDraftField(seg.Status, "draft")
	case verselineTimelineFieldBlockText:
		if block != nil {
			return block.Text
		}
	case verselineTimelineFieldBlockStyle:
		if block != nil {
			return block.Style
		}
	case verselineTimelineFieldBlockPlacement:
		if block != nil {
			return block.Placement
		}
	}
	return ""
}

func (v *verselineTimelineView) beginEdit(field verselineTimelineEditField, segments []VerselineSegment) tea.Cmd {
	if len(segments) == 0 {
		return nil
	}
	v.editing = true
	v.editField = field
	v.editor.SetValue(v.currentValue(segments, field))
	v.editor.CursorEnd()
	v.editor.Focus()
	return textinput.Blink
}

func (v *verselineTimelineView) applyEdit(root *verselineTUIRoot) {
	value := v.editor.Value()
	idx := v.segmentIndex()
	seg := v.currentSegment(root.segments)
	if seg == nil {
		return
	}
	trimmed := strings.TrimSpace(value)

	switch v.editField {
	case verselineTimelineFieldStart:
		seg.Start = trimmed
	case verselineTimelineFieldEnd:
		seg.End = trimmed
	case verselineTimelineFieldStatus:
		seg.Status = trimmed
	case verselineTimelineFieldBlockText:
		block := v.currentBlock(root.segments)
		if block != nil {
			block.Text = value
		}
	case verselineTimelineFieldBlockStyle:
		block := v.currentBlock(root.segments)
		if block != nil {
			block.Style = trimmed
		}
	case verselineTimelineFieldBlockPlacement:
		block := v.currentBlock(root.segments)
		if block != nil {
			block.Placement = trimmed
		}
	}

	root.dirtyTimeline = true
	root.status = fmt.Sprintf("updated segment %d %s", idx+1, verselineTimelineFieldNames[v.editField])
}

func (v *verselineTimelineView) update(msg tea.KeyMsg, ctx *verselineTUIContext, root *verselineTUIRoot) tea.Cmd {
	if v.editing {
		return v.updateEditing(msg, root)
	}
	return v.updateNormal(msg, ctx, root)
}

func (v *verselineTimelineView) updateEditing(msg tea.KeyMsg, root *verselineTUIRoot) tea.Cmd {
	switch msg.String() {
	case "esc":
		v.editing = false
		v.editor.Blur()
		root.status = "edit cancelled"
		return nil
	case "enter":
		v.applyEdit(root)
		v.editing = false
		v.editor.Blur()
		v.syncRows(root.segments)
		return nil
	}

	var cmd tea.Cmd
	v.editor, cmd = v.editor.Update(msg)
	return cmd
}

func (v *verselineTimelineView) updateNormal(msg tea.KeyMsg, ctx *verselineTUIContext, root *verselineTUIRoot) tea.Cmd {
	if len(ctx.segments) == 0 {
		if key.Matches(msg, v.keys.Quit) {
			if root.dirtyTimeline || root.dirtyProject {
				root.quitAfterSave = true
				root.status = "saving before quit..."
				return root.saveCmd()
			}
			return tea.Quit
		}
		return nil
	}

	switch {
	case key.Matches(msg, v.keys.EditStart):
		return v.beginEdit(verselineTimelineFieldStart, ctx.segments)
	case key.Matches(msg, v.keys.EditEnd):
		return v.beginEdit(verselineTimelineFieldEnd, ctx.segments)
	case key.Matches(msg, v.keys.EditStatus):
		return v.beginEdit(verselineTimelineFieldStatus, ctx.segments)
	case key.Matches(msg, v.keys.EditBlockText):
		return v.beginEdit(verselineTimelineFieldBlockText, ctx.segments)
	case key.Matches(msg, v.keys.EditBlockSty):
		return v.beginEdit(verselineTimelineFieldBlockStyle, ctx.segments)
	case key.Matches(msg, v.keys.EditBlockPlc):
		return v.beginEdit(verselineTimelineFieldBlockPlacement, ctx.segments)
	case key.Matches(msg, v.keys.BlockUp):
		if v.blockIndex > 0 {
			v.blockIndex--
		}
		return nil
	case key.Matches(msg, v.keys.BlockDown):
		seg := v.currentSegment(ctx.segments)
		if seg != nil && v.blockIndex+1 < len(seg.Blocks) {
			v.blockIndex++
		}
		return nil
	case key.Matches(msg, v.keys.Approve):
		root.segments = verselineOpsSetSegmentStatus(root.segments, v.segmentIndex(), "approved")
		root.dirtyTimeline = true
		root.status = fmt.Sprintf("segment %d marked approved", v.segmentIndex()+1)
		v.syncRows(root.segments)
		return nil
	case key.Matches(msg, v.keys.NeedsFix):
		root.segments = verselineOpsSetSegmentStatus(root.segments, v.segmentIndex(), "needs_fix")
		root.dirtyTimeline = true
		root.status = fmt.Sprintf("segment %d marked needs_fix", v.segmentIndex()+1)
		v.syncRows(root.segments)
		return nil
	case key.Matches(msg, v.keys.Validate):
		if err := validateVerselineTimeline(root.segments); err != nil {
			root.lastErr = err
			root.status = err.Error()
			return nil
		}
		if err := validateVerselineTimelineAgainstProject(*root.project, root.segments); err != nil {
			root.lastErr = err
			root.status = err.Error()
			return nil
		}
		root.lastErr = nil
		root.status = "timeline valid"
		return nil
	case key.Matches(msg, v.keys.ApproveDraft):
		return v.approveDraft(root)
	case key.Matches(msg, v.keys.Preview):
		return v.startPreview(root)
	case key.Matches(msg, v.keys.PrevProfile):
		if v.renderProfileIndex > 0 {
			v.renderProfileIndex--
			root.status = "profile: " + v.currentProfileLabel(root)
		}
		return nil
	case key.Matches(msg, v.keys.NextProfile):
		if v.renderProfileIndex+1 < len(root.renderProfiles()) {
			v.renderProfileIndex++
			root.status = "profile: " + v.currentProfileLabel(root)
		}
		return nil
	case key.Matches(msg, v.keys.Render):
		return v.startRender(root, false)
	case key.Matches(msg, v.keys.RenderAll):
		return v.startRender(root, true)
	case key.Matches(msg, v.keys.Quit):
		if root.dirtyTimeline || root.dirtyProject {
			root.quitAfterSave = true
			root.status = "saving before quit..."
			return root.saveCmd()
		}
		return tea.Quit
	}

	// pass to table for up/down navigation
	oldCursor := v.segmentTable.Cursor()
	v.segmentTable, _ = v.segmentTable.Update(msg)
	if v.segmentTable.Cursor() != oldCursor {
		v.blockIndex = 0
	}
	return nil
}

func (v *verselineTimelineView) currentProfileLabel(root *verselineTUIRoot) string {
	profiles := root.renderProfiles()
	if v.renderProfileIndex < 0 || v.renderProfileIndex >= len(profiles) {
		return "default"
	}
	return firstNonEmpty(profiles[v.renderProfileIndex].Label, profiles[v.renderProfileIndex].ID, "default")
}

func (v *verselineTimelineView) approveDraft(root *verselineTUIRoot) tea.Cmd {
	if strings.TrimSpace(root.project.Timeline.Approved) == "" {
		root.status = "project has no approved timeline path"
		return nil
	}
	if err := validateVerselineTimeline(root.segments); err != nil {
		root.lastErr = err
		root.status = err.Error()
		return nil
	}
	if err := validateVerselineTimelineAgainstProject(*root.project, root.segments); err != nil {
		root.lastErr = err
		root.status = err.Error()
		return nil
	}
	for i, seg := range root.segments {
		if strings.EqualFold(strings.TrimSpace(seg.Status), "needs_fix") {
			root.status = fmt.Sprintf("segment %d is still needs_fix", i+1)
			return nil
		}
	}
	approvedPath := resolveReelPath(filepath.Dir(root.projectPath), root.project.Timeline.Approved)
	if err := saveVerselineTimeline(approvedPath, root.segments); err != nil {
		root.lastErr = err
		root.status = err.Error()
		return nil
	}
	root.lastErr = nil
	root.status = "approved timeline saved"
	return nil
}

func (v *verselineTimelineView) startPreview(root *verselineTUIRoot) tea.Cmd {
	segNum := v.segmentIndex() + 1
	return v.startAsyncJob(root, func(ch chan<- verselineJobMsg) {
		outputPath, err := verselinePreviewSegments(*root.project, root.projectPath, root.segments, segNum, "", true, func(progress verselineRenderProgress) {
			ch <- verselineJobMsg{progress: &progress}
		})
		status := ""
		if err == nil {
			status = "preview opened: " + filepath.Base(outputPath)
		}
		ch <- verselineJobMsg{done: true, err: err, status: status}
	})
}

func (v *verselineTimelineView) startRender(root *verselineTUIRoot, all bool) tea.Cmd {
	if !root.editingApproved {
		if root.dirtyTimeline {
			root.status = "save and approve the draft before full renders"
			return nil
		}
	} else if root.dirtyTimeline {
		if err := saveVerselineTimeline(root.timelinePath, root.segments); err != nil {
			root.lastErr = err
			root.status = err.Error()
			return nil
		}
		root.dirtyTimeline = false
	}

	var profileIDs []string
	if all {
		for _, p := range root.renderProfiles() {
			profileIDs = append(profileIDs, p.ID)
		}
	} else {
		profiles := root.renderProfiles()
		if v.renderProfileIndex >= 0 && v.renderProfileIndex < len(profiles) {
			profileIDs = []string{profiles[v.renderProfileIndex].ID}
		}
	}

	return v.startAsyncJob(root, func(ch chan<- verselineJobMsg) {
		outputs, err := verselineRenderProjectProfiles(root.projectPath, profileIDs, func(progress verselineRenderProgress) {
			ch <- verselineJobMsg{progress: &progress}
		})
		status := ""
		if err == nil && len(outputs) > 0 {
			status = "rendered " + filepath.Base(outputs[len(outputs)-1])
		}
		ch <- verselineJobMsg{done: true, err: err, status: status}
	})
}

func (v *verselineTimelineView) startAsyncJob(root *verselineTUIRoot, run func(chan<- verselineJobMsg)) tea.Cmd {
	ch := make(chan verselineJobMsg, 32)
	go func() {
		defer close(ch)
		run(ch)
	}()
	root.jobActive = true
	root.jobUpdates = ch
	root.lastErr = nil
	return waitVerselineJobCmd(ch)
}

func (v *verselineTimelineView) view(ctx *verselineTUIContext) string {
	var sb strings.Builder

	if len(ctx.segments) == 0 {
		sb.WriteString("No segments loaded.\n")
		return sb.String()
	}

	// segment table
	sb.WriteString(v.segmentTable.View())
	sb.WriteString("\n")

	// block detail for selected segment
	seg := v.currentSegment(ctx.segments)
	if seg != nil && len(seg.Blocks) > 0 {
		sb.WriteString(fmt.Sprintf("segment %03d blocks", v.segmentIndex()+1))
		sb.WriteString("\n")
		for i, block := range seg.Blocks {
			cursor := " "
			if i == v.blockIndex {
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
	}

	if v.editing {
		sb.WriteString(fmt.Sprintf("\nedit %s: %s\n", verselineTimelineFieldNames[v.editField], v.editor.View()))
	}

	return sb.String()
}
