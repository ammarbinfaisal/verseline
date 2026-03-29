package main

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type verselineProjectKeyMap struct {
	Edit key.Binding
	Quit key.Binding
}

func newVerselineProjectKeyMap() verselineProjectKeyMap {
	return verselineProjectKeyMap{
		Edit: key.NewBinding(key.WithKeys("enter", "e"), key.WithHelp("enter/e", "edit field")),
		Quit: key.NewBinding(key.WithKeys("q"), key.WithHelp("q", "quit")),
	}
}

type verselineProjectHelpKeyMap struct {
	project verselineProjectKeyMap
	global  verselineGlobalKeyMap
}

func (km verselineProjectHelpKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{km.project.Edit, km.global.NextTab, km.global.Save, km.global.Help}
}

func (km verselineProjectHelpKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{km.project.Edit},
		{km.global.NextTab, km.global.PrevTab, km.global.Save, km.project.Quit, km.global.Help},
	}
}

var verselineProjectFields = []struct {
	key   string
	label string
}{
	{"name", "Name"},
	{"output", "Output"},
	{"canvas.width", "Canvas Width"},
	{"canvas.height", "Canvas Height"},
	{"canvas.fps", "Canvas FPS"},
	{"assets.audio", "Audio"},
	{"assets.background.path", "Background Path"},
	{"assets.background.type", "Background Type"},
	{"assets.background.fit", "Background Fit"},
	{"preview.player", "Preview Player"},
	{"preview.directory", "Preview Directory"},
	{"preview.padding_ms", "Preview Padding (ms)"},
	{"timeline.draft", "Timeline Draft"},
	{"timeline.approved", "Timeline Approved"},
}

type verselineProjectView struct {
	table   table.Model
	editor  textinput.Model
	editing bool
	keys    verselineProjectKeyMap
}

func newVerselineProjectView(ctx *verselineTUIContext) verselineProjectView {
	cols := []table.Column{
		{Title: "Property", Width: 22},
		{Title: "Value", Width: 50},
	}

	t := table.New(
		table.WithColumns(cols),
		table.WithRows(verselineProjectRows(ctx.project)),
		table.WithFocused(false),
		table.WithHeight(max(ctx.height-6, 6)),
	)
	t.SetStyles(verselineTableStyles())

	editor := textinput.New()
	editor.Prompt = ""
	editor.CharLimit = 1024
	editor.Width = 60
	editor.Blur()

	return verselineProjectView{
		table:  t,
		editor: editor,
		keys:   newVerselineProjectKeyMap(),
	}
}

func verselineProjectRows(project *VerselineProject) []table.Row {
	rows := make([]table.Row, len(verselineProjectFields))
	for i, f := range verselineProjectFields {
		rows[i] = table.Row{f.label, verselineProjectFieldValue(project, f.key)}
	}
	return rows
}

func verselineProjectFieldValue(project *VerselineProject, field string) string {
	switch field {
	case "name":
		return project.Name
	case "output":
		return project.Output
	case "canvas.width":
		return fmt.Sprintf("%d", project.Canvas.Width)
	case "canvas.height":
		return fmt.Sprintf("%d", project.Canvas.Height)
	case "canvas.fps":
		return fmt.Sprintf("%d", project.Canvas.FPS)
	case "assets.audio":
		return project.Assets.Audio
	case "assets.background.path":
		return project.Assets.Background.Path
	case "assets.background.type":
		return normalizeDraftField(project.Assets.Background.Type, "image")
	case "assets.background.fit":
		return normalizeDraftField(project.Assets.Background.Fit, "cover")
	case "preview.player":
		return project.Preview.Player
	case "preview.directory":
		return project.Preview.Directory
	case "preview.padding_ms":
		return fmt.Sprintf("%d", project.Preview.PaddingMS)
	case "timeline.draft":
		return project.Timeline.Draft
	case "timeline.approved":
		return project.Timeline.Approved
	}
	return ""
}

func (v *verselineProjectView) syncRows(project *VerselineProject) {
	v.table.SetRows(verselineProjectRows(project))
}

func (v *verselineProjectView) resize(ctx *verselineTUIContext) {
	v.table.SetHeight(max(ctx.height-6, 6))
	v.table.SetWidth(ctx.width)
}

func (v *verselineProjectView) focus(ctx *verselineTUIContext) {
	v.table.Focus()
	v.syncRows(ctx.project)
}

func (v *verselineProjectView) blur() {
	v.table.Blur()
}

func (v *verselineProjectView) isEditing() bool {
	return v.editing
}

func (v *verselineProjectView) helpKeyMap(global verselineGlobalKeyMap) help.KeyMap {
	return verselineProjectHelpKeyMap{project: v.keys, global: global}
}

func (v *verselineProjectView) update(msg tea.KeyMsg, ctx *verselineTUIContext, root *verselineTUIRoot) tea.Cmd {
	if v.editing {
		return v.updateEditing(msg, root)
	}
	return v.updateNormal(msg, root)
}

func (v *verselineProjectView) updateEditing(msg tea.KeyMsg, root *verselineTUIRoot) tea.Cmd {
	switch msg.String() {
	case "esc":
		v.editing = false
		v.editor.Blur()
		root.status = "edit cancelled"
		return nil
	case "enter":
		idx := v.table.Cursor()
		if idx < 0 || idx >= len(verselineProjectFields) {
			v.editing = false
			v.editor.Blur()
			return nil
		}
		field := verselineProjectFields[idx]
		if err := verselineOpsUpdateProjectField(root.project, field.key, v.editor.Value()); err != nil {
			root.lastErr = err
			root.status = err.Error()
		} else {
			root.dirtyProject = true
			root.lastErr = nil
			root.status = "updated " + field.label
		}
		v.editing = false
		v.editor.Blur()
		v.syncRows(root.project)
		return nil
	}
	var cmd tea.Cmd
	v.editor, cmd = v.editor.Update(msg)
	return cmd
}

func (v *verselineProjectView) updateNormal(msg tea.KeyMsg, root *verselineTUIRoot) tea.Cmd {
	switch {
	case key.Matches(msg, v.keys.Edit):
		idx := v.table.Cursor()
		if idx < 0 || idx >= len(verselineProjectFields) {
			return nil
		}
		field := verselineProjectFields[idx]
		v.editing = true
		v.editor.SetValue(verselineProjectFieldValue(root.project, field.key))
		v.editor.CursorEnd()
		v.editor.Focus()
		root.status = "editing " + field.label
		return textinput.Blink
	case key.Matches(msg, v.keys.Quit):
		if root.dirtyTimeline || root.dirtyProject {
			root.quitAfterSave = true
			root.status = "saving before quit..."
			return root.saveCmd()
		}
		return tea.Quit
	}

	v.table, _ = v.table.Update(msg)
	return nil
}

func (v *verselineProjectView) view(ctx *verselineTUIContext) string {
	var sb strings.Builder

	sb.WriteString(v.table.View())
	sb.WriteString("\n")

	// render profiles summary
	if len(ctx.project.RenderProfiles) > 0 {
		sb.WriteString("\nRender Profiles:\n")
		for _, p := range ctx.project.RenderProfiles {
			sb.WriteString(fmt.Sprintf("  %s — %s (%dx%d %dfps)\n",
				p.ID,
				normalizeDraftField(p.Label, p.ID),
				p.Width, p.Height, p.FPS,
			))
		}
	}

	if v.editing {
		idx := v.table.Cursor()
		field := verselineProjectFields[idx]
		sb.WriteString(fmt.Sprintf("\nedit %s: %s\n", field.label, v.editor.View()))
	}

	return sb.String()
}
