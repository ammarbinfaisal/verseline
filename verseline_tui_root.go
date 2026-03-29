package main

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type verselineTab int

const (
	verselineTabTimeline verselineTab = iota
	verselineTabStyles
	verselineTabFonts
	verselineTabPlacements
	verselineTabProject
)

var verselineTabLabels = []string{"Timeline", "Styles", "Fonts", "Placements", "Project"}

type verselineGlobalKeyMap struct {
	NextTab key.Binding
	PrevTab key.Binding
	Save    key.Binding
	Quit    key.Binding
	Help    key.Binding
}

func newVerselineGlobalKeyMap() verselineGlobalKeyMap {
	return verselineGlobalKeyMap{
		NextTab: key.NewBinding(key.WithKeys("tab"), key.WithHelp("tab", "next tab")),
		PrevTab: key.NewBinding(key.WithKeys("shift+tab"), key.WithHelp("shift+tab", "prev tab")),
		Save:    key.NewBinding(key.WithKeys("ctrl+s"), key.WithHelp("ctrl+s", "save")),
		Quit:    key.NewBinding(key.WithKeys("ctrl+c"), key.WithHelp("ctrl+c", "quit")),
		Help:    key.NewBinding(key.WithKeys("?"), key.WithHelp("?", "help")),
	}
}

type verselineTUIContext struct {
	project      *VerselineProject
	projectPath  string
	segments     []VerselineSegment
	timelinePath string
	width        int
	height       int
}

var (
	verselineTabInactiveStyle = lipgloss.NewStyle().Padding(0, 2).Foreground(lipgloss.Color("252"))
	verselineTabActiveStyle   = lipgloss.NewStyle().Padding(0, 2).Bold(true).Foreground(lipgloss.Color("212")).Underline(true)
	verselineStatusStyle      = lipgloss.NewStyle().Foreground(lipgloss.Color("241"))
	verselineErrorStatusStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Bold(true)
	verselineDirtyStyle       = lipgloss.NewStyle().Foreground(lipgloss.Color("214"))
)

type verselineTUIRoot struct {
	project         *VerselineProject
	projectPath     string
	segments        []VerselineSegment
	timelinePath    string
	editingApproved bool

	dirtyTimeline bool
	dirtyProject  bool

	width  int
	height int

	activeTab verselineTab

	timelineView   verselineTimelineView
	stylesView     verselineStylesView
	fontsView      verselineFontsView
	placementsView verselinePlacementsView
	projectView    verselineProjectView

	help help.Model
	keys verselineGlobalKeyMap

	jobActive  bool
	jobUpdates <-chan verselineJobMsg

	status        string
	lastErr       error
	quitAfterSave bool
}

func newVerselineTUIRoot(project *VerselineProject, projectPath string, segments []VerselineSegment, timelinePath string, editingApproved bool) verselineTUIRoot {
	h := help.New()
	h.ShowAll = false

	ctx := &verselineTUIContext{
		project:      project,
		projectPath:  projectPath,
		segments:     segments,
		timelinePath: timelinePath,
		width:        80,
		height:       24,
	}

	return verselineTUIRoot{
		project:         project,
		projectPath:     projectPath,
		segments:        segments,
		timelinePath:    timelinePath,
		editingApproved: editingApproved,
		activeTab:       verselineTabTimeline,
		timelineView:    newVerselineTimelineView(ctx),
		stylesView:      newVerselineStylesView(ctx),
		fontsView:       newVerselineFontsView(ctx),
		placementsView:  newVerselinePlacementsView(ctx),
		projectView:     newVerselineProjectView(ctx),
		help:            h,
		keys:            newVerselineGlobalKeyMap(),
		status:          "tab/shift+tab switch  ctrl+s save  ctrl+c quit  ? help",
	}
}

func (m verselineTUIRoot) Init() tea.Cmd {
	return nil
}

func (m verselineTUIRoot) context() *verselineTUIContext {
	return &verselineTUIContext{
		project:      m.project,
		projectPath:  m.projectPath,
		segments:     m.segments,
		timelinePath: m.timelinePath,
		width:        m.contentWidth(),
		height:       m.contentHeight(),
	}
}

func (m verselineTUIRoot) contentWidth() int {
	return max(m.width-2, 40)
}

func (m verselineTUIRoot) contentHeight() int {
	used := 3 // tab bar + status + help
	return max(m.height-used, 6)
}

func (m verselineTUIRoot) isEditing() bool {
	switch m.activeTab {
	case verselineTabTimeline:
		return m.timelineView.isEditing()
	case verselineTabStyles:
		return m.stylesView.isEditing()
	case verselineTabFonts:
		return m.fontsView.isEditing()
	case verselineTabPlacements:
		return m.placementsView.isEditing()
	case verselineTabProject:
		return m.projectView.isEditing()
	}
	return false
}

func (m verselineTUIRoot) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.help.Width = msg.Width
		ctx := m.context()
		m.timelineView.resize(ctx)
		m.stylesView.resize(ctx)
		m.fontsView.resize(ctx)
		m.placementsView.resize(ctx)
		m.projectView.resize(ctx)
		return m, nil

	case verselineSavedMsg:
		if msg.err != nil {
			m.lastErr = msg.err
			m.status = "save failed: " + msg.err.Error()
			m.quitAfterSave = false
			return m, nil
		}
		m.dirtyTimeline = false
		m.dirtyProject = false
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
		if m.isEditing() {
			return m.updateActiveTab(msg)
		}

		if m.jobActive {
			return m, nil
		}

		switch {
		case key.Matches(msg, m.keys.Help):
			m.help.ShowAll = !m.help.ShowAll
			return m, nil
		case key.Matches(msg, m.keys.NextTab):
			m.blurActiveTab()
			m.activeTab = (m.activeTab + 1) % verselineTab(len(verselineTabLabels))
			m.focusActiveTab()
			return m, nil
		case key.Matches(msg, m.keys.PrevTab):
			m.blurActiveTab()
			m.activeTab = (m.activeTab - 1 + verselineTab(len(verselineTabLabels))) % verselineTab(len(verselineTabLabels))
			m.focusActiveTab()
			return m, nil
		case key.Matches(msg, m.keys.Save):
			return m, m.saveCmd()
		case key.Matches(msg, m.keys.Quit):
			if m.dirtyTimeline || m.dirtyProject {
				m.quitAfterSave = true
				m.status = "saving before quit..."
				return m, m.saveCmd()
			}
			return m, tea.Quit
		}

		return m.updateActiveTab(msg)
	}
	return m, nil
}

func (m *verselineTUIRoot) blurActiveTab() {
	switch m.activeTab {
	case verselineTabTimeline:
		m.timelineView.blur()
	case verselineTabStyles:
		m.stylesView.blur()
	case verselineTabFonts:
		m.fontsView.blur()
	case verselineTabPlacements:
		m.placementsView.blur()
	case verselineTabProject:
		m.projectView.blur()
	}
}

func (m *verselineTUIRoot) focusActiveTab() {
	ctx := m.context()
	switch m.activeTab {
	case verselineTabTimeline:
		m.timelineView.focus(ctx)
	case verselineTabStyles:
		m.stylesView.focus(ctx)
	case verselineTabFonts:
		m.fontsView.focus(ctx)
	case verselineTabPlacements:
		m.placementsView.focus(ctx)
	case verselineTabProject:
		m.projectView.focus(ctx)
	}
}

func (m verselineTUIRoot) updateActiveTab(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	ctx := m.context()
	var cmd tea.Cmd

	switch m.activeTab {
	case verselineTabTimeline:
		cmd = m.timelineView.update(msg, ctx, &m)
	case verselineTabStyles:
		cmd = m.stylesView.update(msg, ctx, &m)
	case verselineTabFonts:
		cmd = m.fontsView.update(msg, ctx, &m)
	case verselineTabPlacements:
		cmd = m.placementsView.update(msg, ctx, &m)
	case verselineTabProject:
		cmd = m.projectView.update(msg, ctx, &m)
	}

	return m, cmd
}

func (m verselineTUIRoot) saveCmd() tea.Cmd {
	segments := m.segments
	timelinePath := m.timelinePath
	dirtyTimeline := m.dirtyTimeline
	project := *m.project
	projectPath := m.projectPath
	dirtyProject := m.dirtyProject

	return func() tea.Msg {
		var errs []error
		if dirtyTimeline {
			if err := saveVerselineTimeline(timelinePath, segments); err != nil {
				errs = append(errs, err)
			}
		}
		if dirtyProject {
			if err := saveVerselineProject(projectPath, project); err != nil {
				errs = append(errs, err)
			}
		}
		return verselineSavedMsg{err: errors.Join(errs...)}
	}
}

func (m verselineTUIRoot) renderProfiles() []VerselineRenderProfile {
	if len(m.project.RenderProfiles) == 0 {
		return []VerselineRenderProfile{{ID: "default", Label: "default"}}
	}
	return m.project.RenderProfiles
}

func (m verselineTUIRoot) View() string {
	tabBar := m.renderTabBar()
	content := m.renderActiveTab()
	statusBar := m.renderStatusBar()
	helpBar := m.renderHelpBar()

	return lipgloss.JoinVertical(lipgloss.Left,
		tabBar,
		content,
		statusBar,
		helpBar,
	)
}

func (m verselineTUIRoot) renderTabBar() string {
	tabs := make([]string, len(verselineTabLabels))
	for i, label := range verselineTabLabels {
		if verselineTab(i) == m.activeTab {
			tabs[i] = verselineTabActiveStyle.Render(label)
		} else {
			tabs[i] = verselineTabInactiveStyle.Render(label)
		}
	}
	return lipgloss.JoinHorizontal(lipgloss.Top, tabs...)
}

func (m verselineTUIRoot) renderActiveTab() string {
	ctx := m.context()
	var content string

	switch m.activeTab {
	case verselineTabTimeline:
		content = m.timelineView.view(ctx)
	case verselineTabStyles:
		content = m.stylesView.view(ctx)
	case verselineTabFonts:
		content = m.fontsView.view(ctx)
	case verselineTabPlacements:
		content = m.placementsView.view(ctx)
	case verselineTabProject:
		content = m.projectView.view(ctx)
	}

	return content
}

func (m verselineTUIRoot) renderStatusBar() string {
	dirty := ""
	if m.dirtyTimeline || m.dirtyProject {
		parts := []string{}
		if m.dirtyTimeline {
			parts = append(parts, "timeline")
		}
		if m.dirtyProject {
			parts = append(parts, "project")
		}
		dirty = verselineDirtyStyle.Render(" [modified: " + strings.Join(parts, ", ") + "]")
	}

	status := m.status
	if m.lastErr != nil {
		status = verselineErrorStatusStyle.Render(m.lastErr.Error())
	}

	return verselineStatusStyle.Render(status) + dirty
}

func (m verselineTUIRoot) renderHelpBar() string {
	return m.help.View(m.activeHelpKeyMap())
}

func (m verselineTUIRoot) activeHelpKeyMap() help.KeyMap {
	switch m.activeTab {
	case verselineTabTimeline:
		return m.timelineView.helpKeyMap(m.keys)
	case verselineTabStyles:
		return m.stylesView.helpKeyMap(m.keys)
	case verselineTabFonts:
		return m.fontsView.helpKeyMap(m.keys)
	case verselineTabPlacements:
		return m.placementsView.helpKeyMap(m.keys)
	case verselineTabProject:
		return m.projectView.helpKeyMap(m.keys)
	}
	return verselineDefaultHelpKeyMap{m.keys}
}

type verselineDefaultHelpKeyMap struct {
	keys verselineGlobalKeyMap
}

func (km verselineDefaultHelpKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{km.keys.NextTab, km.keys.Save, km.keys.Quit, km.keys.Help}
}

func (km verselineDefaultHelpKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{km.keys.NextTab, km.keys.PrevTab},
		{km.keys.Save, km.keys.Quit, km.keys.Help},
	}
}
