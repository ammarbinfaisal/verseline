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

type verselineStylesKeyMap struct {
	Edit   key.Binding
	Add    key.Binding
	Delete key.Binding
	Quit   key.Binding
}

func newVerselineStylesKeyMap() verselineStylesKeyMap {
	return verselineStylesKeyMap{
		Edit:   key.NewBinding(key.WithKeys("enter", "e"), key.WithHelp("enter/e", "edit field")),
		Add:    key.NewBinding(key.WithKeys("n"), key.WithHelp("n", "new style")),
		Delete: key.NewBinding(key.WithKeys("d"), key.WithHelp("d", "delete style")),
		Quit:   key.NewBinding(key.WithKeys("q"), key.WithHelp("q", "quit")),
	}
}

type verselineStylesHelpKeyMap struct {
	styles verselineStylesKeyMap
	global verselineGlobalKeyMap
}

func (km verselineStylesHelpKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{km.styles.Edit, km.styles.Add, km.styles.Delete, km.global.NextTab, km.global.Help}
}

func (km verselineStylesHelpKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{km.styles.Edit, km.styles.Add, km.styles.Delete},
		{km.global.NextTab, km.global.PrevTab, km.global.Save, km.styles.Quit, km.global.Help},
	}
}

var verselineStyleFields = []string{"id", "font", "size", "color", "auxiliary_color", "outline_color", "outline", "shadow_color", "shadow", "text_bg", "text_bg_pad", "text_bg_radius", "align", "line_height"}

type verselineStylesView struct {
	table          table.Model
	editor         textinput.Model
	editing        bool
	fieldIdx       int
	pendingDelete  bool
	keys           verselineStylesKeyMap
}

func newVerselineStylesView(ctx *verselineTUIContext) verselineStylesView {
	cols := []table.Column{
		{Title: "ID", Width: 14},
		{Title: "Font", Width: 12},
		{Title: "Size", Width: 5},
		{Title: "Color", Width: 8},
		{Title: "Outline", Width: 7},
		{Title: "OutClr", Width: 8},
		{Title: "Shadow", Width: 6},
		{Title: "TextBG", Width: 10},
		{Title: "Align", Width: 7},
	}

	t := table.New(
		table.WithColumns(cols),
		table.WithRows(verselineStyleRows(ctx.project)),
		table.WithFocused(false),
		table.WithHeight(max(ctx.height-6, 6)),
	)
	t.SetStyles(verselineTableStyles())

	editor := textinput.New()
	editor.Prompt = ""
	editor.CharLimit = 256
	editor.Width = 60
	editor.Blur()

	return verselineStylesView{
		table:  t,
		editor: editor,
		keys:   newVerselineStylesKeyMap(),
	}
}

func verselineStyleRows(project *VerselineProject) []table.Row {
	rows := make([]table.Row, len(project.Styles))
	for i, s := range project.Styles {
		rows[i] = table.Row{
			s.ID,
			s.Font,
			fmt.Sprintf("%d", s.Size),
			normalizeDraftField(s.Color, "-"),
			fmt.Sprintf("%d", s.Outline),
			normalizeDraftField(s.OutlineColor, "-"),
			fmt.Sprintf("%d", s.Shadow),
			normalizeDraftField(s.TextBG, "-"),
			normalizeDraftField(s.Align, "-"),
		}
	}
	return rows
}

func (v *verselineStylesView) syncRows(project *VerselineProject) {
	v.table.SetRows(verselineStyleRows(project))
}

func (v *verselineStylesView) resize(ctx *verselineTUIContext) {
	v.table.SetHeight(max(ctx.height-6, 6))
	v.table.SetWidth(ctx.width)
}

func (v *verselineStylesView) focus(ctx *verselineTUIContext) {
	v.table.Focus()
	v.syncRows(ctx.project)
}

func (v *verselineStylesView) blur() {
	v.table.Blur()
}

func (v *verselineStylesView) isEditing() bool {
	return v.editing
}

func (v *verselineStylesView) helpKeyMap(global verselineGlobalKeyMap) help.KeyMap {
	return verselineStylesHelpKeyMap{styles: v.keys, global: global}
}

func (v *verselineStylesView) update(msg tea.KeyMsg, ctx *verselineTUIContext, root *verselineTUIRoot) tea.Cmd {
	if v.editing {
		return v.updateEditing(msg, root)
	}
	return v.updateNormal(msg, root)
}

func (v *verselineStylesView) updateEditing(msg tea.KeyMsg, root *verselineTUIRoot) tea.Cmd {
	switch msg.String() {
	case "esc":
		v.editing = false
		v.editor.Blur()
		root.status = "edit cancelled"
		return nil
	case "enter":
		idx := v.table.Cursor()
		field := verselineStyleFields[v.fieldIdx]
		if err := verselineOpsUpdateStyle(root.project, idx, field, v.editor.Value()); err != nil {
			root.lastErr = err
			root.status = err.Error()
		} else {
			root.dirtyProject = true
			root.lastErr = nil
			root.status = fmt.Sprintf("updated style %s.%s", root.project.Styles[idx].ID, field)
		}
		v.editing = false
		v.editor.Blur()
		v.syncRows(root.project)
		return nil
	case "ctrl+left":
		if v.fieldIdx > 0 {
			v.fieldIdx--
			idx := v.table.Cursor()
			v.editor.SetValue(v.styleFieldValue(root.project, idx, v.fieldIdx))
			v.editor.CursorEnd()
			root.status = fmt.Sprintf("editing style %s.%s [%d/%d]", root.project.Styles[idx].ID, verselineStyleFields[v.fieldIdx], v.fieldIdx+1, len(verselineStyleFields))
		}
		return nil
	case "ctrl+right":
		if v.fieldIdx+1 < len(verselineStyleFields) {
			v.fieldIdx++
			idx := v.table.Cursor()
			v.editor.SetValue(v.styleFieldValue(root.project, idx, v.fieldIdx))
			v.editor.CursorEnd()
			root.status = fmt.Sprintf("editing style %s.%s [%d/%d]", root.project.Styles[idx].ID, verselineStyleFields[v.fieldIdx], v.fieldIdx+1, len(verselineStyleFields))
		}
		return nil
	}
	var cmd tea.Cmd
	v.editor, cmd = v.editor.Update(msg)
	return cmd
}

func (v *verselineStylesView) updateNormal(msg tea.KeyMsg, root *verselineTUIRoot) tea.Cmd {
	switch {
	case key.Matches(msg, v.keys.Edit):
		if len(root.project.Styles) == 0 {
			return nil
		}
		idx := v.table.Cursor()
		if idx < 0 || idx >= len(root.project.Styles) {
			return nil
		}
		v.fieldIdx = 0
		v.editing = true
		v.editor.SetValue(v.styleFieldValue(root.project, idx, v.fieldIdx))
		v.editor.CursorEnd()
		v.editor.Focus()
		root.status = fmt.Sprintf("editing style %s.%s (left/right to change field)", root.project.Styles[idx].ID, verselineStyleFields[v.fieldIdx])
		return textinput.Blink
	case key.Matches(msg, v.keys.Add):
		id := fmt.Sprintf("style-%d", len(root.project.Styles)+1)
		if err := verselineOpsAddStyle(root.project, VerselineStyle{ID: id, Size: 48}); err != nil {
			root.status = err.Error()
			return nil
		}
		root.dirtyProject = true
		root.status = "added style " + id
		v.syncRows(root.project)
		return nil
	case key.Matches(msg, v.keys.Delete):
		if len(root.project.Styles) == 0 {
			return nil
		}
		idx := v.table.Cursor()
		if v.pendingDelete {
			if err := verselineOpsDeleteStyle(root.project, idx); err != nil {
				root.status = err.Error()
			} else {
				root.dirtyProject = true
				root.status = "deleted style"
			}
			v.pendingDelete = false
			v.syncRows(root.project)
			return nil
		}
		v.pendingDelete = true
		root.status = fmt.Sprintf("press d again to delete style %q", root.project.Styles[idx].ID)
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

func (v *verselineStylesView) styleFieldValue(project *VerselineProject, styleIdx int, fieldIdx int) string {
	if styleIdx < 0 || styleIdx >= len(project.Styles) {
		return ""
	}
	s := project.Styles[styleIdx]
	switch verselineStyleFields[fieldIdx] {
	case "id":
		return s.ID
	case "font":
		return s.Font
	case "size":
		return fmt.Sprintf("%d", s.Size)
	case "color":
		return s.Color
	case "auxiliary_color":
		return s.AuxiliaryColor
	case "outline_color":
		return s.OutlineColor
	case "outline":
		return fmt.Sprintf("%d", s.Outline)
	case "shadow_color":
		return s.ShadowColor
	case "shadow":
		return fmt.Sprintf("%d", s.Shadow)
	case "text_bg":
		return s.TextBG
	case "text_bg_pad":
		return fmt.Sprintf("%d", s.TextBGPad)
	case "text_bg_radius":
		return fmt.Sprintf("%d", s.TextBGRadius)
	case "align":
		return s.Align
	case "line_height":
		return fmt.Sprintf("%d", s.LineHeight)
	}
	return ""
}

func (v *verselineStylesView) view(ctx *verselineTUIContext) string {
	var sb strings.Builder

	if len(ctx.project.Styles) == 0 {
		sb.WriteString("No styles defined. Press n to add one.\n")
		return sb.String()
	}

	sb.WriteString(v.table.View())
	sb.WriteString("\n")

	if v.editing {
		idx := v.table.Cursor()
		field := verselineStyleFields[v.fieldIdx]
		sb.WriteString(fmt.Sprintf("\nedit %s.%s [%d/%d]: %s\n",
			ctx.project.Styles[idx].ID,
			field,
			v.fieldIdx+1,
			len(verselineStyleFields),
			v.editor.View(),
		))
	}

	return sb.String()
}
