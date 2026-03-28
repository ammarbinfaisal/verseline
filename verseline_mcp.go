package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type verselineMCPTimelineInfo struct {
	Kind         string `json:"kind"`
	Path         string `json:"path"`
	Exists       bool   `json:"exists"`
	SegmentCount int    `json:"segment_count,omitempty"`
	Error        string `json:"error,omitempty"`
}

type verselineMCPProjectSummary struct {
	ProjectPath    string                     `json:"project_path"`
	Name           string                     `json:"name,omitempty"`
	Output         string                     `json:"output,omitempty"`
	CanvasWidth    int                        `json:"canvas_width"`
	CanvasHeight   int                        `json:"canvas_height"`
	CanvasFPS      int                        `json:"canvas_fps"`
	AudioPath      string                     `json:"audio_path,omitempty"`
	BackgroundType string                     `json:"background_type,omitempty"`
	BackgroundPath string                     `json:"background_path"`
	Styles         []string                   `json:"styles,omitempty"`
	Placements     []string                   `json:"placements,omitempty"`
	Sources        []string                   `json:"sources,omitempty"`
	RenderProfiles []string                   `json:"render_profiles,omitempty"`
	Timelines      []verselineMCPTimelineInfo `json:"timelines,omitempty"`
}

type verselineMCPInspectProjectInput struct {
	ProjectPath string `json:"project_path"`
}

type verselineMCPListSegmentsInput struct {
	ProjectPath string `json:"project_path"`
	Timeline    string `json:"timeline,omitempty"`
	StartAt     int    `json:"start_at,omitempty"`
	Limit       int    `json:"limit,omitempty"`
}

type verselineMCPSegmentSummary struct {
	Number      int      `json:"number"`
	ID          string   `json:"id,omitempty"`
	Start       string   `json:"start"`
	End         string   `json:"end"`
	Status      string   `json:"status,omitempty"`
	Notes       string   `json:"notes,omitempty"`
	BlockCount  int      `json:"block_count"`
	TextPreview string   `json:"text_preview,omitempty"`
	SourceRefs  []string `json:"source_refs,omitempty"`
}

type verselineMCPListSegmentsOutput struct {
	ProjectPath  string                       `json:"project_path"`
	Timeline     string                       `json:"timeline"`
	TimelinePath string                       `json:"timeline_path"`
	TotalCount   int                          `json:"total_count"`
	StartAt      int                          `json:"start_at"`
	Limit        int                          `json:"limit"`
	Segments     []verselineMCPSegmentSummary `json:"segments"`
}

type verselineMCPValidateInput struct {
	ProjectPath string `json:"project_path"`
	Timeline    string `json:"timeline,omitempty"`
}

type verselineMCPValidateOutput struct {
	ProjectPath  string `json:"project_path"`
	Timeline     string `json:"timeline"`
	TimelinePath string `json:"timeline_path"`
	SegmentCount int    `json:"segment_count"`
	Valid        bool   `json:"valid"`
}

type verselineMCPUpdateSegmentInput struct {
	ProjectPath    string  `json:"project_path"`
	Timeline       string  `json:"timeline,omitempty"`
	SegmentNumber  int     `json:"segment_number,omitempty"`
	SegmentID      string  `json:"segment_id,omitempty"`
	Start          *string `json:"start,omitempty"`
	End            *string `json:"end,omitempty"`
	Status         *string `json:"status,omitempty"`
	Notes          *string `json:"notes,omitempty"`
	BlockIndex     int     `json:"block_index,omitempty"`
	BlockText      *string `json:"block_text,omitempty"`
	BlockStyle     *string `json:"block_style,omitempty"`
	BlockPlacement *string `json:"block_placement,omitempty"`
	DryRun         bool    `json:"dry_run,omitempty"`
}

type verselineMCPUpdateSegmentOutput struct {
	ProjectPath  string                     `json:"project_path"`
	Timeline     string                     `json:"timeline"`
	TimelinePath string                     `json:"timeline_path"`
	Segment      verselineMCPSegmentSummary `json:"segment"`
	Saved        bool                       `json:"saved"`
}

type verselineMCPSplitSegmentInput struct {
	ProjectPath   string   `json:"project_path"`
	Timeline      string   `json:"timeline,omitempty"`
	SegmentNumber int      `json:"segment_number,omitempty"`
	SegmentID     string   `json:"segment_id,omitempty"`
	BlockIndex    int      `json:"block_index,omitempty"`
	Texts         []string `json:"texts"`
	DryRun        bool     `json:"dry_run,omitempty"`
}

type verselineMCPSplitSegmentOutput struct {
	ProjectPath      string                       `json:"project_path"`
	Timeline         string                       `json:"timeline"`
	TimelinePath     string                       `json:"timeline_path"`
	OriginalNumber   int                          `json:"original_number"`
	ReplacementCount int                          `json:"replacement_count"`
	Segments         []verselineMCPSegmentSummary `json:"segments"`
	Saved            bool                         `json:"saved"`
}

type verselineMCPApproveInput struct {
	ProjectPath string `json:"project_path"`
}

type verselineMCPApproveOutput struct {
	ProjectPath  string `json:"project_path"`
	DraftPath    string `json:"draft_path"`
	ApprovedPath string `json:"approved_path"`
	SegmentCount int    `json:"segment_count"`
	Saved        bool   `json:"saved"`
}

type verselineMCPPreviewInput struct {
	ProjectPath   string `json:"project_path"`
	Timeline      string `json:"timeline,omitempty"`
	SegmentNumber int    `json:"segment_number"`
	OpenPlayer    bool   `json:"open_player,omitempty"`
}

type verselineMCPPreviewOutput struct {
	ProjectPath     string `json:"project_path"`
	Timeline        string `json:"timeline"`
	SegmentNumber   int    `json:"segment_number"`
	OutputPath      string `json:"output_path"`
	SubtitleASSPath string `json:"subtitle_ass_path"`
}

type verselineMCPRenderInput struct {
	ProjectPath string   `json:"project_path"`
	Profiles    []string `json:"profiles,omitempty"`
}

type verselineMCPRenderOutput struct {
	ProjectPath string   `json:"project_path"`
	Outputs     []string `json:"outputs"`
}

func runVerselineMCPCommand(name string, args []string) bool {
	if len(args) == 0 {
		return runVerselineMCPServe()
	}

	switch strings.TrimSpace(args[0]) {
	case "serve":
		return runVerselineMCPServe()
	case "describe", "-describe", "--describe":
		printVerselineMCPDescription()
		return true
	case "help", "-h", "--help":
		printVerselineMCPUsage()
		return true
	default:
		printVerselineMCPUsage()
		fmt.Printf("ERROR: Unknown Verseline MCP command %s\n", strings.TrimSpace(args[0]))
		return false
	}
}

func printVerselineMCPUsage() {
	fmt.Printf("Usage: verseline mcp [serve|describe]\n")
	fmt.Printf("  serve     Run the stdio MCP server (default)\n")
	fmt.Printf("  describe  Print the available tools and install commands\n")
}

func printVerselineMCPDescription() {
	executable, err := os.Executable()
	if err != nil {
		executable = "verseline"
	}

	fmt.Printf("Verseline MCP runs as a local stdio server.\n")
	fmt.Printf("Available tools:\n")
	fmt.Printf("- verseline_inspect_project\n")
	fmt.Printf("- verseline_list_segments\n")
	fmt.Printf("- verseline_validate_project\n")
	fmt.Printf("- verseline_update_segment\n")
	fmt.Printf("- verseline_split_segment\n")
	fmt.Printf("- verseline_approve_timeline\n")
	fmt.Printf("- verseline_preview_segment\n")
	fmt.Printf("- verseline_render_project\n")
	fmt.Printf("Claude Code add command:\n")
	fmt.Printf("  claude mcp add verseline -- %s mcp\n", executable)
	fmt.Printf("Codex CLI add command:\n")
	fmt.Printf("  codex mcp add verseline -- %s mcp\n", executable)
}

func runVerselineMCPServe() bool {
	server := newVerselineMCPServer()
	if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: Verseline MCP server failed: %s\n", err)
		return false
	}
	return true
}

func newVerselineMCPServer() *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{
		Name:    "verseline",
		Version: "0.1.0",
	}, nil)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "verseline_inspect_project",
		Description: "Load a Verseline project and return a compact summary of assets, styles, timelines, and render profiles.",
	}, verselineMCPInspectProjectTool)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "verseline_list_segments",
		Description: "List draft or approved timeline segments with text previews and source references.",
	}, verselineMCPListSegmentsTool)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "verseline_validate_project",
		Description: "Validate a Verseline project together with one of its timelines.",
	}, verselineMCPValidateProjectTool)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "verseline_update_segment",
		Description: "Update segment timing, status, notes, or one block's text/style/placement in the selected timeline.",
	}, verselineMCPUpdateSegmentTool)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "verseline_split_segment",
		Description: "Replace one segment with several shorter segments by splitting one block's text across new time slices.",
	}, verselineMCPSplitSegmentTool)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "verseline_approve_timeline",
		Description: "Copy the draft timeline into the approved timeline after validation checks.",
	}, verselineMCPApproveTimelineTool)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "verseline_preview_segment",
		Description: "Render a preview clip for one segment from the draft or approved timeline.",
	}, verselineMCPPreviewSegmentTool)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "verseline_render_project",
		Description: "Render one or more approved project outputs using the configured render profiles.",
	}, verselineMCPRenderProjectTool)

	return server
}

func verselineMCPInspectProjectTool(_ context.Context, _ *mcp.CallToolRequest, in verselineMCPInspectProjectInput) (*mcp.CallToolResult, verselineMCPProjectSummary, error) {
	project, absProjectPath, err := loadVerselineProject(in.ProjectPath)
	if err != nil {
		return nil, verselineMCPProjectSummary{}, err
	}

	output := verselineMCPProjectSummary{
		ProjectPath:    absProjectPath,
		Name:           project.Name,
		Output:         project.Output,
		CanvasWidth:    project.Canvas.Width,
		CanvasHeight:   project.Canvas.Height,
		CanvasFPS:      project.Canvas.FPS,
		AudioPath:      resolveOptionalReelPath(filepath.Dir(absProjectPath), project.Assets.Audio),
		BackgroundType: project.Assets.Background.Type,
		BackgroundPath: resolveReelPath(filepath.Dir(absProjectPath), project.Assets.Background.Path),
		Styles:         verselineStyleIDs(project.Styles),
		Placements:     verselinePlacementIDs(project.Placements),
		Sources:        verselineSourceIDs(project.Sources),
		RenderProfiles: verselineRenderProfileIDs(project.RenderProfiles),
		Timelines: []verselineMCPTimelineInfo{
			verselineMCPDescribeTimeline(project, absProjectPath, "draft"),
			verselineMCPDescribeTimeline(project, absProjectPath, "approved"),
		},
	}

	summary := fmt.Sprintf(
		"Project %s: %dx%d @ %dfps, background=%s, styles=%d, placements=%d, sources=%d, profiles=%d",
		firstNonEmpty(project.Name, filepath.Base(absProjectPath)),
		project.Canvas.Width,
		project.Canvas.Height,
		project.Canvas.FPS,
		firstNonEmpty(project.Assets.Background.Type, "image"),
		len(project.Styles),
		len(project.Placements),
		len(project.Sources),
		len(project.RenderProfiles),
	)
	return verselineMCPTextResult(summary), output, nil
}

func verselineMCPListSegmentsTool(_ context.Context, _ *mcp.CallToolRequest, in verselineMCPListSegmentsInput) (*mcp.CallToolResult, verselineMCPListSegmentsOutput, error) {
	project, absProjectPath, segments, timelinePath, timelineKind, err := verselineMCPLoadProjectTimeline(in.ProjectPath, in.Timeline, false)
	if err != nil {
		return nil, verselineMCPListSegmentsOutput{}, err
	}
	_ = project

	startAt := max(in.StartAt, 1)
	limit := in.Limit
	if limit <= 0 {
		limit = 50
	}
	startIndex := startAt - 1
	if startIndex > len(segments) {
		startIndex = len(segments)
	}
	endIndex := min(len(segments), startIndex+limit)
	items := make([]verselineMCPSegmentSummary, 0, endIndex-startIndex)
	for index := startIndex; index < endIndex; index++ {
		items = append(items, verselineMCPSummarizeSegment(index, segments[index]))
	}

	output := verselineMCPListSegmentsOutput{
		ProjectPath:  absProjectPath,
		Timeline:     timelineKind,
		TimelinePath: timelinePath,
		TotalCount:   len(segments),
		StartAt:      startAt,
		Limit:        limit,
		Segments:     items,
	}
	summary := fmt.Sprintf("Listed %d of %d %s timeline segments from %s", len(items), len(segments), timelineKind, filepath.Base(absProjectPath))
	return verselineMCPTextResult(summary), output, nil
}

func verselineMCPValidateProjectTool(_ context.Context, _ *mcp.CallToolRequest, in verselineMCPValidateInput) (*mcp.CallToolResult, verselineMCPValidateOutput, error) {
	_, absProjectPath, segments, timelinePath, timelineKind, err := verselineMCPLoadProjectTimeline(in.ProjectPath, in.Timeline, true)
	if err != nil {
		return nil, verselineMCPValidateOutput{}, err
	}

	output := verselineMCPValidateOutput{
		ProjectPath:  absProjectPath,
		Timeline:     timelineKind,
		TimelinePath: timelinePath,
		SegmentCount: len(segments),
		Valid:        true,
	}
	summary := fmt.Sprintf("Validated %d %s timeline segments for %s", len(segments), timelineKind, filepath.Base(absProjectPath))
	return verselineMCPTextResult(summary), output, nil
}

func verselineMCPUpdateSegmentTool(_ context.Context, _ *mcp.CallToolRequest, in verselineMCPUpdateSegmentInput) (*mcp.CallToolResult, verselineMCPUpdateSegmentOutput, error) {
	project, absProjectPath, segments, timelinePath, timelineKind, err := verselineMCPLoadProjectTimeline(in.ProjectPath, in.Timeline, false)
	if err != nil {
		return nil, verselineMCPUpdateSegmentOutput{}, err
	}

	index, err := verselineMCPFindSegmentIndex(segments, in.SegmentNumber, in.SegmentID)
	if err != nil {
		return nil, verselineMCPUpdateSegmentOutput{}, err
	}

	segment := segments[index]
	if in.Start != nil {
		segment.Start = *in.Start
	}
	if in.End != nil {
		segment.End = *in.End
	}
	if in.Status != nil {
		segment.Status = *in.Status
	}
	if in.Notes != nil {
		segment.Notes = *in.Notes
	}

	if in.BlockText != nil || in.BlockStyle != nil || in.BlockPlacement != nil {
		blockIndex := max(in.BlockIndex, 1) - 1
		if blockIndex < 0 || blockIndex >= len(segment.Blocks) {
			return nil, verselineMCPUpdateSegmentOutput{}, fmt.Errorf("segment %d block %d is out of range", index+1, blockIndex+1)
		}
		if in.BlockText != nil {
			segment.Blocks[blockIndex].Text = *in.BlockText
		}
		if in.BlockStyle != nil {
			segment.Blocks[blockIndex].Style = *in.BlockStyle
		}
		if in.BlockPlacement != nil {
			segment.Blocks[blockIndex].Placement = *in.BlockPlacement
		}
	}

	segments[index] = segment
	if err := validateVerselineTimeline(segments); err != nil {
		return nil, verselineMCPUpdateSegmentOutput{}, err
	}
	if err := validateVerselineTimelineAgainstProject(project, segments); err != nil {
		return nil, verselineMCPUpdateSegmentOutput{}, err
	}
	if !in.DryRun {
		if err := saveVerselineTimeline(timelinePath, segments); err != nil {
			return nil, verselineMCPUpdateSegmentOutput{}, err
		}
	}

	output := verselineMCPUpdateSegmentOutput{
		ProjectPath:  absProjectPath,
		Timeline:     timelineKind,
		TimelinePath: timelinePath,
		Segment:      verselineMCPSummarizeSegment(index, segment),
		Saved:        !in.DryRun,
	}
	summary := fmt.Sprintf("Updated %s timeline segment %d in %s", timelineKind, index+1, filepath.Base(absProjectPath))
	return verselineMCPTextResult(summary), output, nil
}

func verselineMCPSplitSegmentTool(_ context.Context, _ *mcp.CallToolRequest, in verselineMCPSplitSegmentInput) (*mcp.CallToolResult, verselineMCPSplitSegmentOutput, error) {
	project, absProjectPath, segments, timelinePath, timelineKind, err := verselineMCPLoadProjectTimeline(in.ProjectPath, in.Timeline, false)
	if err != nil {
		return nil, verselineMCPSplitSegmentOutput{}, err
	}

	index, err := verselineMCPFindSegmentIndex(segments, in.SegmentNumber, in.SegmentID)
	if err != nil {
		return nil, verselineMCPSplitSegmentOutput{}, err
	}
	partTexts, err := verselineMCPSanitizeSplitTexts(in.Texts)
	if err != nil {
		return nil, verselineMCPSplitSegmentOutput{}, err
	}

	blockIndex := max(in.BlockIndex, 1) - 1
	if blockIndex < 0 || blockIndex >= len(segments[index].Blocks) {
		return nil, verselineMCPSplitSegmentOutput{}, fmt.Errorf("segment %d block %d is out of range", index+1, blockIndex+1)
	}

	replacements, err := verselineMCPSplitTimelineSegment(segments[index], index, blockIndex, partTexts)
	if err != nil {
		return nil, verselineMCPSplitSegmentOutput{}, err
	}

	updated := make([]VerselineSegment, 0, len(segments)-1+len(replacements))
	updated = append(updated, segments[:index]...)
	updated = append(updated, replacements...)
	updated = append(updated, segments[index+1:]...)

	if err := validateVerselineTimeline(updated); err != nil {
		return nil, verselineMCPSplitSegmentOutput{}, err
	}
	if err := validateVerselineTimelineAgainstProject(project, updated); err != nil {
		return nil, verselineMCPSplitSegmentOutput{}, err
	}
	if !in.DryRun {
		if err := saveVerselineTimeline(timelinePath, updated); err != nil {
			return nil, verselineMCPSplitSegmentOutput{}, err
		}
	}

	items := make([]verselineMCPSegmentSummary, 0, len(replacements))
	for replacementIndex, segment := range replacements {
		items = append(items, verselineMCPSummarizeSegment(index+replacementIndex, segment))
	}

	output := verselineMCPSplitSegmentOutput{
		ProjectPath:      absProjectPath,
		Timeline:         timelineKind,
		TimelinePath:     timelinePath,
		OriginalNumber:   index + 1,
		ReplacementCount: len(replacements),
		Segments:         items,
		Saved:            !in.DryRun,
	}
	summary := fmt.Sprintf("Split %s timeline segment %d into %d segments in %s", timelineKind, index+1, len(replacements), filepath.Base(absProjectPath))
	return verselineMCPTextResult(summary), output, nil
}

func verselineMCPApproveTimelineTool(_ context.Context, _ *mcp.CallToolRequest, in verselineMCPApproveInput) (*mcp.CallToolResult, verselineMCPApproveOutput, error) {
	draftPath, approvedPath, segmentCount, err := verselineApproveProject(in.ProjectPath)
	if err != nil {
		return nil, verselineMCPApproveOutput{}, err
	}
	absProjectPath, err := filepath.Abs(in.ProjectPath)
	if err != nil {
		return nil, verselineMCPApproveOutput{}, err
	}

	output := verselineMCPApproveOutput{
		ProjectPath:  absProjectPath,
		DraftPath:    draftPath,
		ApprovedPath: approvedPath,
		SegmentCount: segmentCount,
		Saved:        true,
	}
	summary := fmt.Sprintf("Approved %d draft timeline segments for %s", segmentCount, filepath.Base(absProjectPath))
	return verselineMCPTextResult(summary), output, nil
}

func verselineMCPPreviewSegmentTool(_ context.Context, _ *mcp.CallToolRequest, in verselineMCPPreviewInput) (*mcp.CallToolResult, verselineMCPPreviewOutput, error) {
	timelineKind := verselineMCPNormalizeTimelineKind(in.Timeline, false)
	outputPath, err := verselinePreviewProject(in.ProjectPath, in.SegmentNumber, timelineKind == "approved", "", in.OpenPlayer, nil)
	if err != nil {
		return nil, verselineMCPPreviewOutput{}, err
	}
	absProjectPath, err := filepath.Abs(in.ProjectPath)
	if err != nil {
		return nil, verselineMCPPreviewOutput{}, err
	}

	output := verselineMCPPreviewOutput{
		ProjectPath:     absProjectPath,
		Timeline:        timelineKind,
		SegmentNumber:   in.SegmentNumber,
		OutputPath:      outputPath,
		SubtitleASSPath: strings.TrimSuffix(outputPath, filepath.Ext(outputPath)) + ".ass",
	}
	summary := fmt.Sprintf("Rendered %s preview for segment %d at %s", timelineKind, in.SegmentNumber, outputPath)
	return verselineMCPTextResult(summary), output, nil
}

func verselineMCPRenderProjectTool(_ context.Context, _ *mcp.CallToolRequest, in verselineMCPRenderInput) (*mcp.CallToolResult, verselineMCPRenderOutput, error) {
	outputs, err := verselineRenderProjectProfiles(in.ProjectPath, in.Profiles, nil)
	if err != nil {
		return nil, verselineMCPRenderOutput{}, err
	}
	absProjectPath, err := filepath.Abs(in.ProjectPath)
	if err != nil {
		return nil, verselineMCPRenderOutput{}, err
	}

	output := verselineMCPRenderOutput{
		ProjectPath: absProjectPath,
		Outputs:     outputs,
	}
	summary := fmt.Sprintf("Rendered %d project outputs for %s", len(outputs), filepath.Base(absProjectPath))
	return verselineMCPTextResult(summary), output, nil
}

func verselineMCPTextResult(text string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: text},
		},
	}
}

func verselineMCPLoadProjectTimeline(projectPath string, timeline string, preferApproved bool) (VerselineProject, string, []VerselineSegment, string, string, error) {
	project, absProjectPath, err := loadVerselineProject(projectPath)
	if err != nil {
		return project, "", nil, "", "", err
	}

	timelineKind := verselineMCPNormalizeTimelineKind(timeline, preferApproved)
	segments, timelinePath, err := verselineLoadTimelineForProject(project, absProjectPath, timelineKind == "approved")
	if err != nil {
		return project, "", nil, "", "", err
	}

	return project, absProjectPath, segments, timelinePath, timelineKind, nil
}

func verselineMCPNormalizeTimelineKind(value string, preferApproved bool) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "approved":
		return "approved"
	case "draft":
		return "draft"
	default:
		if preferApproved {
			return "approved"
		}
		return "draft"
	}
}

func verselineMCPDescribeTimeline(project VerselineProject, absProjectPath string, timelineKind string) verselineMCPTimelineInfo {
	info := verselineMCPTimelineInfo{Kind: timelineKind}
	projectDir := filepath.Dir(absProjectPath)

	target := project.Timeline.Draft
	if timelineKind == "approved" {
		target = project.Timeline.Approved
	}
	if strings.TrimSpace(target) == "" {
		info.Error = "not configured"
		return info
	}

	info.Path = resolveReelPath(projectDir, target)
	if _, err := os.Stat(info.Path); err != nil {
		info.Error = err.Error()
		return info
	}

	segments, err := loadVerselineTimeline(info.Path)
	if err != nil {
		info.Exists = true
		info.Error = err.Error()
		return info
	}

	info.Exists = true
	info.SegmentCount = len(segments)
	return info
}

func verselineMCPSummarizeSegment(index int, segment VerselineSegment) verselineMCPSegmentSummary {
	return verselineMCPSegmentSummary{
		Number:      index + 1,
		ID:          segment.ID,
		Start:       segment.Start,
		End:         segment.End,
		Status:      segment.Status,
		Notes:       segment.Notes,
		BlockCount:  len(segment.Blocks),
		TextPreview: verselineMCPBlockPreview(segment.Blocks),
		SourceRefs:  verselineMCPCollectRefs(segment.Blocks),
	}
}

func verselineMCPBlockPreview(blocks []VerselineBlock) string {
	parts := make([]string, 0, len(blocks))
	for _, block := range blocks {
		text := strings.TrimSpace(block.Text)
		if text != "" {
			parts = append(parts, text)
			continue
		}
		if block.Source != nil {
			refPart := strings.Join(block.Source.Refs, ",")
			if refPart == "" {
				refPart = "?"
			}
			parts = append(parts, fmt.Sprintf("[%s:%s]", block.Source.Source, refPart))
		}
	}
	preview := strings.Join(parts, " | ")
	if utf8.RuneCountInString(preview) > 160 {
		runes := []rune(preview)
		return string(runes[:160]) + "..."
	}
	return preview
}

func verselineMCPCollectRefs(blocks []VerselineBlock) []string {
	seen := map[string]bool{}
	refs := []string{}
	for _, block := range blocks {
		if block.Source == nil {
			continue
		}
		for _, ref := range block.Source.Refs {
			ref = strings.TrimSpace(ref)
			if ref == "" || seen[ref] {
				continue
			}
			seen[ref] = true
			refs = append(refs, ref)
		}
	}
	sort.Strings(refs)
	return refs
}

func verselineMCPFindSegmentIndex(segments []VerselineSegment, segmentNumber int, segmentID string) (int, error) {
	if segmentNumber > 0 {
		index := segmentNumber - 1
		if index < 0 || index >= len(segments) {
			return 0, fmt.Errorf("segment %d is out of range", segmentNumber)
		}
		return index, nil
	}

	id := strings.TrimSpace(segmentID)
	if id == "" {
		return 0, fmt.Errorf("segment_number or segment_id is required")
	}
	for index, segment := range segments {
		if strings.TrimSpace(segment.ID) == id {
			return index, nil
		}
	}
	return 0, fmt.Errorf("no segment found with id %q", id)
}

func verselineMCPSanitizeSplitTexts(values []string) ([]string, error) {
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		result = append(result, value)
	}
	if len(result) < 2 {
		return nil, fmt.Errorf("at least two non-empty split texts are required")
	}
	return result, nil
}

func verselineMCPSplitTimelineSegment(segment VerselineSegment, segmentIndex int, blockIndex int, texts []string) ([]VerselineSegment, error) {
	start, err := tsToMillis(segment.Start)
	if err != nil {
		return nil, err
	}
	end, err := tsToMillis(segment.End)
	if err != nil {
		return nil, err
	}
	if end <= start {
		return nil, fmt.Errorf("segment %d has non-positive duration", segmentIndex+1)
	}

	weights := make([]int, len(texts))
	totalWeight := 0
	for index, text := range texts {
		weight := max(utf8.RuneCountInString(text), 1)
		weights[index] = weight
		totalWeight += weight
	}

	duration := end - start
	cursor := start
	replacements := make([]VerselineSegment, 0, len(texts))
	for index, text := range texts {
		partStart := cursor
		partEnd := end
		if index < len(texts)-1 {
			remainingParts := len(texts) - index - 1
			remainingMin := Millis(remainingParts)
			partDuration := Millis(int64(duration) * int64(weights[index]) / int64(totalWeight))
			partDuration = max(partDuration, 1)
			partDuration = min(partDuration, end-cursor-remainingMin)
			partEnd = cursor + partDuration
		}

		clone := segment
		clone.Blocks = append([]VerselineBlock(nil), segment.Blocks...)
		clone.Start = millisToTs(partStart)
		clone.End = millisToTs(partEnd)
		clone.Blocks[blockIndex] = clone.Blocks[blockIndex]
		clone.Blocks[blockIndex].Text = text
		clone.Blocks[blockIndex].Kind = "literal"
		clone.Blocks[blockIndex].Source = nil
		if strings.TrimSpace(clone.ID) != "" {
			clone.ID = fmt.Sprintf("%s-%02d", clone.ID, index+1)
		} else {
			clone.ID = fmt.Sprintf("seg-%03d-%02d", segmentIndex+1, index+1)
		}

		replacements = append(replacements, clone)
		cursor = partEnd
	}

	return replacements, nil
}
