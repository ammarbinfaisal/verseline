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

type verselinePlacementsKeyMap struct {
	Edit   key.Binding
	Add    key.Binding
	Delete key.Binding
	Quit   key.Binding
}

func newVerselinePlacementsKeyMap() verselinePlacementsKeyMap {
	return verselinePlacementsKeyMap{
		Edit:   key.NewBinding(key.WithKeys("enter", "e"), key.WithHelp("enter/e", "edit field")),
		Add:    key.NewBinding(key.WithKeys("n"), key.WithHelp("n", "new placement")),
		Delete: key.NewBinding(key.WithKeys("d"), key.WithHelp("d", "delete placement")),
		Quit:   key.NewBinding(key.WithKeys("q"), key.WithHelp("q", "quit")),
	}
}

type verselinePlacementsHelpKeyMap struct {
	placements verselinePlacementsKeyMap
	global     verselineGlobalKeyMap
}

func (km verselinePlacementsHelpKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{km.placements.Edit, km.placements.Add, km.placements.Delete, km.global.NextTab, km.global.Help}
}

func (km verselinePlacementsHelpKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{km.placements.Edit, km.placements.Add, km.placements.Delete},
		{km.global.NextTab, km.global.PrevTab, km.global.Save, km.placements.Quit, km.global.Help},
	}
}

var verselinePlacementFields = []string{"id", "anchor", "margin_x", "margin_y", "max_width", "max_height"}

type verselinePlacementsView struct {
	table         table.Model
	editor        textinput.Model
	editing       bool
	fieldIdx      int
	pendingDelete bool
	keys          verselinePlacementsKeyMap
}

func newVerselinePlacementsView(ctx *verselineTUIContext) verselinePlacementsView {
	cols := []table.Column{
		{Title: "ID", Width: 16},
		{Title: "Anchor", Width: 16},
		{Title: "MarginX", Width: 8},
		{Title: "MarginY", Width: 8},
		{Title: "MaxW", Width: 8},
		{Title: "MaxH", Width: 8},
	}

	t := table.New(
		table.WithColumns(cols),
		table.WithRows(verselinePlacementRows(ctx.project)),
		table.WithFocused(false),
		table.WithHeight(max(ctx.height-6, 6)),
	)
	t.SetStyles(verselineTableStyles())

	editor := textinput.New()
	editor.Prompt = ""
	editor.CharLimit = 256
	editor.Width = 60
	editor.Blur()

	return verselinePlacementsView{
		table:  t,
		editor: editor,
		keys:   newVerselinePlacementsKeyMap(),
	}
}

func verselinePlacementRows(project *VerselineProject) []table.Row {
	rows := make([]table.Row, len(project.Placements))
	for i, p := range project.Placements {
		rows[i] = table.Row{
			p.ID,
			normalizeDraftField(p.Anchor, "-"),
			fmt.Sprintf("%d", p.MarginX),
			fmt.Sprintf("%d", p.MarginY),
			fmt.Sprintf("%d", p.MaxWidth),
			fmt.Sprintf("%d", p.MaxHeight),
		}
	}
	return rows
}

func (v *verselinePlacementsView) syncRows(project *VerselineProject) {
	v.table.SetRows(verselinePlacementRows(project))
}

func (v *verselinePlacementsView) resize(ctx *verselineTUIContext) {
	v.table.SetHeight(max(ctx.height-6, 6))
	v.table.SetWidth(ctx.width)
}

func (v *verselinePlacementsView) focus(ctx *verselineTUIContext) {
	v.table.Focus()
	v.syncRows(ctx.project)
}

func (v *verselinePlacementsView) blur() {
	v.table.Blur()
}

func (v *verselinePlacementsView) isEditing() bool {
	return v.editing
}

func (v *verselinePlacementsView) helpKeyMap(global verselineGlobalKeyMap) help.KeyMap {
	return verselinePlacementsHelpKeyMap{placements: v.keys, global: global}
}

func (v *verselinePlacementsView) update(msg tea.KeyMsg, ctx *verselineTUIContext, root *verselineTUIRoot) tea.Cmd {
	if v.editing {
		return v.updateEditing(msg, root)
	}
	return v.updateNormal(msg, root)
}

func (v *verselinePlacementsView) updateEditing(msg tea.KeyMsg, root *verselineTUIRoot) tea.Cmd {
	switch msg.String() {
	case "esc":
		v.editing = false
		v.editor.Blur()
		root.status = "edit cancelled"
		return nil
	case "enter":
		idx := v.table.Cursor()
		field := verselinePlacementFields[v.fieldIdx]
		if err := verselineOpsUpdatePlacement(root.project, idx, field, v.editor.Value()); err != nil {
			root.lastErr = err
			root.status = err.Error()
		} else {
			root.dirtyProject = true
			root.lastErr = nil
			root.status = fmt.Sprintf("updated placement %s.%s", root.project.Placements[idx].ID, field)
		}
		v.editing = false
		v.editor.Blur()
		v.syncRows(root.project)
		return nil
	case "ctrl+left":
		if v.fieldIdx > 0 {
			v.fieldIdx--
			idx := v.table.Cursor()
			v.editor.SetValue(v.placementFieldValue(root.project, idx, v.fieldIdx))
			v.editor.CursorEnd()
			root.status = fmt.Sprintf("editing placement %s.%s [%d/%d]", root.project.Placements[idx].ID, verselinePlacementFields[v.fieldIdx], v.fieldIdx+1, len(verselinePlacementFields))
		}
		return nil
	case "ctrl+right":
		if v.fieldIdx+1 < len(verselinePlacementFields) {
			v.fieldIdx++
			idx := v.table.Cursor()
			v.editor.SetValue(v.placementFieldValue(root.project, idx, v.fieldIdx))
			v.editor.CursorEnd()
			root.status = fmt.Sprintf("editing placement %s.%s [%d/%d]", root.project.Placements[idx].ID, verselinePlacementFields[v.fieldIdx], v.fieldIdx+1, len(verselinePlacementFields))
		}
		return nil
	}
	var cmd tea.Cmd
	v.editor, cmd = v.editor.Update(msg)
	return cmd
}

func (v *verselinePlacementsView) updateNormal(msg tea.KeyMsg, root *verselineTUIRoot) tea.Cmd {
	switch {
	case key.Matches(msg, v.keys.Edit):
		if len(root.project.Placements) == 0 {
			return nil
		}
		idx := v.table.Cursor()
		if idx < 0 || idx >= len(root.project.Placements) {
			return nil
		}
		v.fieldIdx = 0
		v.editing = true
		v.editor.SetValue(v.placementFieldValue(root.project, idx, v.fieldIdx))
		v.editor.CursorEnd()
		v.editor.Focus()
		root.status = fmt.Sprintf("editing placement %s.%s", root.project.Placements[idx].ID, verselinePlacementFields[v.fieldIdx])
		return textinput.Blink
	case key.Matches(msg, v.keys.Add):
		id := fmt.Sprintf("placement-%d", len(root.project.Placements)+1)
		if err := verselineOpsAddPlacement(root.project, VerselinePlacement{ID: id, Anchor: "center"}); err != nil {
			root.status = err.Error()
			return nil
		}
		root.dirtyProject = true
		root.status = "added placement " + id
		v.syncRows(root.project)
		return nil
	case key.Matches(msg, v.keys.Delete):
		if len(root.project.Placements) == 0 {
			return nil
		}
		idx := v.table.Cursor()
		if v.pendingDelete {
			if err := verselineOpsDeletePlacement(root.project, idx); err != nil {
				root.status = err.Error()
			} else {
				root.dirtyProject = true
				root.status = "deleted placement"
			}
			v.pendingDelete = false
			v.syncRows(root.project)
			return nil
		}
		v.pendingDelete = true
		root.status = fmt.Sprintf("press d again to delete placement %q", root.project.Placements[idx].ID)
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

func (v *verselinePlacementsView) placementFieldValue(project *VerselineProject, placementIdx int, fieldIdx int) string {
	if placementIdx < 0 || placementIdx >= len(project.Placements) {
		return ""
	}
	p := project.Placements[placementIdx]
	switch verselinePlacementFields[fieldIdx] {
	case "id":
		return p.ID
	case "anchor":
		return p.Anchor
	case "margin_x":
		return fmt.Sprintf("%d", p.MarginX)
	case "margin_y":
		return fmt.Sprintf("%d", p.MarginY)
	case "max_width":
		return fmt.Sprintf("%d", p.MaxWidth)
	case "max_height":
		return fmt.Sprintf("%d", p.MaxHeight)
	}
	return ""
}

func (v *verselinePlacementsView) view(ctx *verselineTUIContext) string {
	var sb strings.Builder

	if len(ctx.project.Placements) == 0 {
		sb.WriteString("No placements defined. Press n to add one.\n")
		return sb.String()
	}

	sb.WriteString(v.table.View())
	sb.WriteString("\n")

	if v.editing {
		idx := v.table.Cursor()
		field := verselinePlacementFields[v.fieldIdx]
		sb.WriteString(fmt.Sprintf("\nedit %s.%s [%d/%d]: %s\n",
			ctx.project.Placements[idx].ID,
			field,
			v.fieldIdx+1,
			len(verselinePlacementFields),
			v.editor.View(),
		))
	}

	return sb.String()
}
