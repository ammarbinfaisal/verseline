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

type verselineFontsKeyMap struct {
	Edit   key.Binding
	Add    key.Binding
	Delete key.Binding
	Quit   key.Binding
}

func newVerselineFontsKeyMap() verselineFontsKeyMap {
	return verselineFontsKeyMap{
		Edit:   key.NewBinding(key.WithKeys("enter", "e"), key.WithHelp("enter/e", "edit field")),
		Add:    key.NewBinding(key.WithKeys("n"), key.WithHelp("n", "new font")),
		Delete: key.NewBinding(key.WithKeys("d"), key.WithHelp("d", "delete font")),
		Quit:   key.NewBinding(key.WithKeys("q"), key.WithHelp("q", "quit")),
	}
}

type verselineFontsHelpKeyMap struct {
	fonts  verselineFontsKeyMap
	global verselineGlobalKeyMap
}

func (km verselineFontsHelpKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{km.fonts.Edit, km.fonts.Add, km.fonts.Delete, km.global.NextTab, km.global.Help}
}

func (km verselineFontsHelpKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{km.fonts.Edit, km.fonts.Add, km.fonts.Delete},
		{km.global.NextTab, km.global.PrevTab, km.global.Save, km.fonts.Quit, km.global.Help},
	}
}

var verselineFontFields = []string{"id", "family", "files"}

type verselineFontsView struct {
	table         table.Model
	editor        textinput.Model
	editing       bool
	fieldIdx      int
	pendingDelete bool
	keys          verselineFontsKeyMap
}

func newVerselineFontsView(ctx *verselineTUIContext) verselineFontsView {
	cols := []table.Column{
		{Title: "ID", Width: 16},
		{Title: "Family", Width: 20},
		{Title: "Files", Width: 40},
	}

	t := table.New(
		table.WithColumns(cols),
		table.WithRows(verselineFontRows(ctx.project)),
		table.WithFocused(false),
		table.WithHeight(max(ctx.height-6, 6)),
	)
	t.SetStyles(verselineTableStyles())

	editor := textinput.New()
	editor.Prompt = ""
	editor.CharLimit = 1024
	editor.Width = 60
	editor.Blur()

	return verselineFontsView{
		table:  t,
		editor: editor,
		keys:   newVerselineFontsKeyMap(),
	}
}

func verselineFontRows(project *VerselineProject) []table.Row {
	rows := make([]table.Row, len(project.Fonts))
	for i, f := range project.Fonts {
		rows[i] = table.Row{
			f.ID,
			f.Family,
			strings.Join(f.Files, ", "),
		}
	}
	return rows
}

func (v *verselineFontsView) syncRows(project *VerselineProject) {
	v.table.SetRows(verselineFontRows(project))
}

func (v *verselineFontsView) resize(ctx *verselineTUIContext) {
	v.table.SetHeight(max(ctx.height-6, 6))
	v.table.SetWidth(ctx.width)
}

func (v *verselineFontsView) focus(ctx *verselineTUIContext) {
	v.table.Focus()
	v.syncRows(ctx.project)
}

func (v *verselineFontsView) blur() {
	v.table.Blur()
}

func (v *verselineFontsView) isEditing() bool {
	return v.editing
}

func (v *verselineFontsView) helpKeyMap(global verselineGlobalKeyMap) help.KeyMap {
	return verselineFontsHelpKeyMap{fonts: v.keys, global: global}
}

func (v *verselineFontsView) update(msg tea.KeyMsg, ctx *verselineTUIContext, root *verselineTUIRoot) tea.Cmd {
	if v.editing {
		return v.updateEditing(msg, root)
	}
	return v.updateNormal(msg, root)
}

func (v *verselineFontsView) updateEditing(msg tea.KeyMsg, root *verselineTUIRoot) tea.Cmd {
	switch msg.String() {
	case "esc":
		v.editing = false
		v.editor.Blur()
		root.status = "edit cancelled"
		return nil
	case "enter":
		idx := v.table.Cursor()
		field := verselineFontFields[v.fieldIdx]
		if err := verselineOpsUpdateFont(root.project, idx, field, v.editor.Value()); err != nil {
			root.lastErr = err
			root.status = err.Error()
		} else {
			root.dirtyProject = true
			root.lastErr = nil
			root.status = fmt.Sprintf("updated font %s.%s", root.project.Fonts[idx].ID, field)
		}
		v.editing = false
		v.editor.Blur()
		v.syncRows(root.project)
		return nil
	case "ctrl+left":
		if v.fieldIdx > 0 {
			v.fieldIdx--
			idx := v.table.Cursor()
			v.editor.SetValue(v.fontFieldValue(root.project, idx, v.fieldIdx))
			v.editor.CursorEnd()
			root.status = fmt.Sprintf("editing font %s.%s [%d/%d]", root.project.Fonts[idx].ID, verselineFontFields[v.fieldIdx], v.fieldIdx+1, len(verselineFontFields))
		}
		return nil
	case "ctrl+right":
		if v.fieldIdx+1 < len(verselineFontFields) {
			v.fieldIdx++
			idx := v.table.Cursor()
			v.editor.SetValue(v.fontFieldValue(root.project, idx, v.fieldIdx))
			v.editor.CursorEnd()
			root.status = fmt.Sprintf("editing font %s.%s [%d/%d]", root.project.Fonts[idx].ID, verselineFontFields[v.fieldIdx], v.fieldIdx+1, len(verselineFontFields))
		}
		return nil
	}
	var cmd tea.Cmd
	v.editor, cmd = v.editor.Update(msg)
	return cmd
}

func (v *verselineFontsView) updateNormal(msg tea.KeyMsg, root *verselineTUIRoot) tea.Cmd {
	switch {
	case key.Matches(msg, v.keys.Edit):
		if len(root.project.Fonts) == 0 {
			return nil
		}
		idx := v.table.Cursor()
		if idx < 0 || idx >= len(root.project.Fonts) {
			return nil
		}
		v.fieldIdx = 0
		v.editing = true
		v.editor.SetValue(v.fontFieldValue(root.project, idx, v.fieldIdx))
		v.editor.CursorEnd()
		v.editor.Focus()
		root.status = fmt.Sprintf("editing font %s.%s", root.project.Fonts[idx].ID, verselineFontFields[v.fieldIdx])
		return textinput.Blink
	case key.Matches(msg, v.keys.Add):
		id := fmt.Sprintf("font-%d", len(root.project.Fonts)+1)
		if err := verselineOpsAddFont(root.project, VerselineFont{ID: id, Family: "sans-serif"}); err != nil {
			root.status = err.Error()
			return nil
		}
		root.dirtyProject = true
		root.status = "added font " + id
		v.syncRows(root.project)
		return nil
	case key.Matches(msg, v.keys.Delete):
		if len(root.project.Fonts) == 0 {
			return nil
		}
		idx := v.table.Cursor()
		if v.pendingDelete {
			if err := verselineOpsDeleteFont(root.project, idx); err != nil {
				root.status = err.Error()
			} else {
				root.dirtyProject = true
				root.status = "deleted font"
			}
			v.pendingDelete = false
			v.syncRows(root.project)
			return nil
		}
		v.pendingDelete = true
		root.status = fmt.Sprintf("press d again to delete font %q", root.project.Fonts[idx].ID)
		return nil
	case key.Matches(msg, v.keys.Quit):
		if root.dirtyTimeline || root.dirtyProject {
			root.quitAfterSave = true
			root.status = "saving before quit..."
			return root.saveCmd()
		}
		return tea.Quit
	default:
		v.pendingDelete = false
	}

	v.table, _ = v.table.Update(msg)
	return nil
}

func (v *verselineFontsView) fontFieldValue(project *VerselineProject, fontIdx int, fieldIdx int) string {
	if fontIdx < 0 || fontIdx >= len(project.Fonts) {
		return ""
	}
	f := project.Fonts[fontIdx]
	switch verselineFontFields[fieldIdx] {
	case "id":
		return f.ID
	case "family":
		return f.Family
	case "files":
		return strings.Join(f.Files, ", ")
	}
	return ""
}

func (v *verselineFontsView) view(ctx *verselineTUIContext) string {
	var sb strings.Builder

	if len(ctx.project.Fonts) == 0 {
		sb.WriteString("No fonts defined. Press n to add one.\n")
		return sb.String()
	}

	sb.WriteString(v.table.View())
	sb.WriteString("\n")

	if v.editing {
		idx := v.table.Cursor()
		field := verselineFontFields[v.fieldIdx]
		sb.WriteString(fmt.Sprintf("\nedit %s.%s [%d/%d]: %s\n",
			ctx.project.Fonts[idx].ID,
			field,
			v.fieldIdx+1,
			len(verselineFontFields),
			v.editor.View(),
		))
	}

	return sb.String()
}
