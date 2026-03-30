package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
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

type verselineMCPTranscribeInput struct {
	AudioPath     string `json:"audio_path"`
	OutputDir     string `json:"output_dir"`
	LinesPerBatch int    `json:"lines_per_batch,omitempty"`
	Language      string `json:"language,omitempty"`
	Model         string `json:"model,omitempty"`
}

type verselineMCPTranscribeBatchFile struct {
	Path      string `json:"path"`
	LineCount int    `json:"line_count"`
}

type verselineMCPTranscribeOutput struct {
	AudioPath  string                            `json:"audio_path"`
	Language   string                            `json:"language,omitempty"`
	Duration   float64                           `json:"duration,omitempty"`
	BatchFiles []verselineMCPTranscribeBatchFile `json:"batch_files"`
	TotalLines int                               `json:"total_lines"`
}

type verselineMCPReadabilityInput struct {
	ProjectPath   string `json:"project_path"`
	Timeline      string `json:"timeline,omitempty"`
	SegmentNumber int    `json:"segment_number,omitempty"`
	SegmentID     string `json:"segment_id,omitempty"`
	Timestamp     string `json:"timestamp,omitempty"`
}

type verselineMCPReadabilityOutput struct {
	ProjectPath string                      `json:"project_path"`
	Timestamp   string                      `json:"timestamp,omitempty"`
	Blocks      []verselineReadabilityBlock `json:"blocks"`
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
	fmt.Printf("- verseline_transcribe\n")
	fmt.Printf("- verseline_update_segment\n")
	fmt.Printf("- verseline_split_segment\n")
	fmt.Printf("- verseline_approve_timeline\n")
	fmt.Printf("- verseline_preview_segment\n")
	fmt.Printf("- verseline_render_project\n")
	fmt.Printf("- verseline_check_readability\n")
	fmt.Printf("Claude Code add command:\n")
	fmt.Printf("  claude mcp add verseline -- %s mcp\n", executable)
	fmt.Printf("Codex CLI add command:\n")
	fmt.Printf("  codex mcp add verseline -- %s mcp\n", executable)
}

func runVerselineMCPServe() bool {
	loadVerselineEnvFile()
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
		Version: "0.2.0",
	}, nil)

	mcp.AddTool(server, &mcp.Tool{
		Name: "verseline_inspect_project",
		Description: `Load a Verseline project JSON file and return its canvas dimensions, asset paths, registered styles, placements, sources, render profiles, and timeline file paths with segment counts.

The project.json schema:
{
  "name": "string (optional)",
  "output": "string — output file path (optional)",
  "canvas": { "width": int, "height": int, "fps": int },
  "assets": {
    "audio": "string — path to audio file (optional)",
    "background": { "path": "string (required)", "type": "\"image\" or \"video\" (optional, default image)", "loop": bool (optional), "fit": "\"cover\" or \"contain\" (optional, default cover)" }
  },
  "fonts": [{ "id": "string", "family": "string", "files": ["path to .ttf/.otf file"] }],
  "styles": [{
    "id": "string", "font": "string — references a font id", "size": int,
    "color": "#RRGGBB (optional)", "auxiliary_color": "#RRGGBB (optional)",
    "outline_color": "#RRGGBB (optional)", "outline": int pixels (optional),
    "shadow_color": "#RRGGBB or #RRGGBBAA (optional)", "shadow": int pixels (optional),
    "text_bg": "#RRGGBB or #RRGGBBAA (optional) — background color for a rounded box behind the text",
    "text_bg_pad": int pixels (optional) — padding inside the text background box",
    "text_bg_radius": int pixels (optional) — corner radius of the text background box",
    "line_height": int (optional)
  }],
  "placements": [{ "id": "string", "anchor": "top-left|top-center|top-right|middle-left|center|middle-right|bottom-left|bottom-center|bottom-right", "margin_x": int (optional), "margin_y": int (optional), "max_width": int (optional), "max_height": int (optional) }],
  "sources": [{ "id": "string", "type": "json|jsonl", "path": "string", "language": "string (optional)", "text_field": "string (optional)", "key_field": "string (optional)" }],
  "overlays": [{ "id": "string (optional)", "start": "HH:MM:SS.mmm (optional — default 0)", "end": "HH:MM:SS.mmm (optional — default end of video)", "blocks": [block...] }],
  "preview": { "player": "string (optional)", "directory": "string (optional)", "padding_ms": int (optional), "width": int (optional)", "height": int (optional)", "fps": int (optional) },
  "render_profiles": [{ "id": "string", "label": "string (optional)", "width": int (optional, inherits canvas)", "height": int (optional, inherits canvas)", "fps": int (optional, inherits canvas)", "output": "string (optional)", "output_suffix": "string (optional)", "video_codec": "string (optional)", "audio_codec": "string (optional)", "crf": int (optional)", "preset": "string (optional)" }],
  "timeline": { "draft": "string — path to draft JSONL (optional)", "approved": "string — path to approved JSONL (optional)" }
}

A timeline JSONL file has one segment per line:
{"id":"string","start":"HH:MM:SS.mmm","end":"HH:MM:SS.mmm","status":"draft|approved|needs_fix","blocks":[{"text":"string","style":"style-id","placement":"placement-id"},...]}

Multiple text cards can overlap in time: segment/overlay t1 from 0s-10s, t2 from 5s-40s, t3 from 0s to end — all render simultaneously when their time ranges overlap.

Required: canvas (width>0, height>0, fps>0), assets.background.path, at least one of timeline.draft or timeline.approved.
All arrays use objects with "id" fields, NOT objects keyed by id. Timestamps use HH:MM:SS.mmm format.`,
	}, verselineMCPInspectProjectTool)

	mcp.AddTool(server, &mcp.Tool{
		Name: "verseline_list_segments",
		Description: `Return paginated segments from a project's draft or approved timeline. Each segment includes its 1-based number, start/end timestamps, status, block count, a text preview (first 160 characters), and source references. Defaults: timeline="draft", start_at=1, limit=50.`,
	}, verselineMCPListSegmentsTool)

	mcp.AddTool(server, &mcp.Tool{
		Name: "verseline_validate_project",
		Description: `Validate a project JSON file and one of its timelines. Checks: canvas dimensions are positive, background path exists, all IDs are unique and non-empty, every timestamp parses as HH:MM:SS.mmm, every block has text or a source, and all style/placement/source references in the timeline exist in the project. Returns valid=true or an error describing the first failing check.`,
	}, verselineMCPValidateProjectTool)

	mcp.AddTool(server, &mcp.Tool{
		Name: "verseline_transcribe",
		Description: `Transcribe an audio file using the OpenAI Whisper API and write results as JSONL batch files to output_dir. Each batch file contains up to lines_per_batch entries (1–100, default 50). Each JSONL line is {"start":"HH:MM:SS.mmm","end":"HH:MM:SS.mmm","text":"...","confidence":0.0-1.0}. Returns the list of written file paths and line counts — does not return transcription content in the tool result. Requires OPENAI_API_KEY in the environment or .env next to the binary.`,
	}, verselineMCPTranscribeTool)

	mcp.AddTool(server, &mcp.Tool{
		Name: "verseline_update_segment",
		Description: `Update properties of a single segment in the draft or approved timeline. Can set start, end, status, notes, or a single block's text/style/placement. Identify the segment by 1-based segment_number or segment_id. Validates the full timeline after the edit. Set dry_run=true to preview the change without saving.`,
	}, verselineMCPUpdateSegmentTool)

	mcp.AddTool(server, &mcp.Tool{
		Name: "verseline_split_segment",
		Description: `Replace one timeline segment with multiple shorter segments by splitting a block's text. Provide the new text fragments in the texts array (minimum 2). Time is distributed proportionally to text length (longer fragments get more time). Identify the segment by segment_number or segment_id, and the block by block_index (1-based, default 1). Validates the result before saving. Set dry_run=true to preview.`,
	}, verselineMCPSplitSegmentTool)

	mcp.AddTool(server, &mcp.Tool{
		Name: "verseline_preview_segment",
		Description: `Render a low-quality preview video clip for one segment. Uses the project's preview settings (reduced resolution, fast encoding). The clip includes padding around the segment's time range. Set open_player=true to launch the configured media player after rendering.`,
	}, verselineMCPPreviewSegmentTool)

	mcp.AddTool(server, &mcp.Tool{
		Name: "verseline_render_project",
		Description: `Render final video outputs from the approved timeline using one or more render profiles. Each profile can override resolution, codec, CRF, and output path. Text blocks are rendered as PNG images and composited onto the background using ffmpeg overlays. Omit profiles to render all configured profiles.`,
	}, verselineMCPRenderProjectTool)

	mcp.AddTool(server, &mcp.Tool{
		Name: "verseline_check_readability",
		Description: `Analyze text-on-background contrast for a specific segment. Samples the background image (or extracts a video frame at the segment's midpoint) at each block's placement region and computes WCAG 2.0 contrast ratios. Returns per-block: contrast_ratio, meets_wcag_aa (>=3:1 for large text), meets_wcag_aaa (>=4.5:1), and whether outline/shadow/text_bg are already set. When contrast is poor, returns recommendations to add outline, shadow, or text_bg. Use timestamp (HH:MM:SS.mmm) to override the default midpoint sampling time.`,
	}, verselineMCPReadabilityTool)

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

func verselineMCPTranscribeTool(_ context.Context, _ *mcp.CallToolRequest, in verselineMCPTranscribeInput) (*mcp.CallToolResult, verselineMCPTranscribeOutput, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, verselineMCPTranscribeOutput{}, fmt.Errorf("OPENAI_API_KEY is not set (place it in .env next to the verseline binary or export it)")
	}

	audioPath := strings.TrimSpace(in.AudioPath)
	if audioPath == "" {
		return nil, verselineMCPTranscribeOutput{}, fmt.Errorf("audio_path is required")
	}
	if !filepath.IsAbs(audioPath) {
		cwd, _ := os.Getwd()
		audioPath = filepath.Join(cwd, audioPath)
	}
	if _, err := os.Stat(audioPath); err != nil {
		return nil, verselineMCPTranscribeOutput{}, fmt.Errorf("audio file not found: %s", audioPath)
	}

	outputDir := strings.TrimSpace(in.OutputDir)
	if outputDir == "" {
		return nil, verselineMCPTranscribeOutput{}, fmt.Errorf("output_dir is required")
	}
	if !filepath.IsAbs(outputDir) {
		cwd, _ := os.Getwd()
		outputDir = filepath.Join(cwd, outputDir)
	}
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, verselineMCPTranscribeOutput{}, fmt.Errorf("create output directory: %w", err)
	}

	linesPerBatch := in.LinesPerBatch
	if linesPerBatch <= 0 {
		linesPerBatch = 50
	}
	if linesPerBatch > 100 {
		linesPerBatch = 100
	}

	result, err := callWhisperAPI(whisperRequestOptions{
		AudioPath: audioPath,
		Language:  in.Language,
		Model:     in.Model,
		APIKey:    apiKey,
	})
	if err != nil {
		return nil, verselineMCPTranscribeOutput{}, err
	}

	type transcriptLine struct {
		Start      string  `json:"start"`
		End        string  `json:"end"`
		Text       string  `json:"text"`
		Confidence float64 `json:"confidence"`
	}

	lines := make([]transcriptLine, 0, len(result.Segments))
	for _, seg := range result.Segments {
		text := strings.TrimSpace(seg.Text)
		if text == "" {
			continue
		}
		lines = append(lines, transcriptLine{
			Start:      secondsToTs(seg.Start),
			End:        secondsToTs(seg.End),
			Text:       text,
			Confidence: whisperConfidence(seg),
		})
	}

	batchFiles := make([]verselineMCPTranscribeBatchFile, 0)
	for i := 0; i < len(lines); i += linesPerBatch {
		end := min(i+linesPerBatch, len(lines))
		batch := lines[i:end]

		batchNum := len(batchFiles) + 1
		fileName := fmt.Sprintf("batch-%03d.jsonl", batchNum)
		filePath := filepath.Join(outputDir, fileName)

		var sb strings.Builder
		for _, line := range batch {
			raw, jsonErr := json.Marshal(line)
			if jsonErr != nil {
				return nil, verselineMCPTranscribeOutput{}, fmt.Errorf("encode line: %w", jsonErr)
			}
			sb.Write(raw)
			sb.WriteByte('\n')
		}

		if writeErr := os.WriteFile(filePath, []byte(sb.String()), 0644); writeErr != nil {
			return nil, verselineMCPTranscribeOutput{}, fmt.Errorf("write batch %d: %w", batchNum, writeErr)
		}

		batchFiles = append(batchFiles, verselineMCPTranscribeBatchFile{
			Path:      filePath,
			LineCount: len(batch),
		})
	}

	output := verselineMCPTranscribeOutput{
		AudioPath:  audioPath,
		Language:   result.Language,
		Duration:   result.Duration,
		BatchFiles: batchFiles,
		TotalLines: len(lines),
	}
	summary := fmt.Sprintf("Transcribed %s: %d lines in %d batch files, %.1fs, language=%s", filepath.Base(audioPath), len(lines), len(batchFiles), result.Duration, result.Language)
	return verselineMCPTextResult(summary), output, nil
}
func verselineMCPUpdateSegmentTool(_ context.Context, _ *mcp.CallToolRequest, in verselineMCPUpdateSegmentInput) (*mcp.CallToolResult, verselineMCPUpdateSegmentOutput, error) {
	project, absProjectPath, segments, timelinePath, timelineKind, err := verselineMCPLoadProjectTimeline(in.ProjectPath, in.Timeline, false)
	if err != nil {
		return nil, verselineMCPUpdateSegmentOutput{}, err
	}

	index, err := verselineOpsFindSegmentIndex(segments, in.SegmentNumber, in.SegmentID)
	if err != nil {
		return nil, verselineMCPUpdateSegmentOutput{}, err
	}

	segments, err = verselineOpsUpdateSegment(project, segments, index, verselineSegmentUpdates{
		Start:          in.Start,
		End:            in.End,
		Status:         in.Status,
		Notes:          in.Notes,
		BlockIndex:     max(in.BlockIndex, 1) - 1,
		BlockText:      in.BlockText,
		BlockStyle:     in.BlockStyle,
		BlockPlacement: in.BlockPlacement,
	})
	if err != nil {
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
		Segment:      verselineMCPSummarizeSegment(index, segments[index]),
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

	index, err := verselineOpsFindSegmentIndex(segments, in.SegmentNumber, in.SegmentID)
	if err != nil {
		return nil, verselineMCPSplitSegmentOutput{}, err
	}

	blockIndex := max(in.BlockIndex, 1) - 1
	updated, err := verselineOpsApplySplit(project, segments, index, blockIndex, in.Texts)
	if err != nil {
		return nil, verselineMCPSplitSegmentOutput{}, err
	}
	if !in.DryRun {
		if err := saveVerselineTimeline(timelinePath, updated); err != nil {
			return nil, verselineMCPSplitSegmentOutput{}, err
		}
	}

	replacementCount := len(updated) - len(segments) + 1
	items := make([]verselineMCPSegmentSummary, 0, replacementCount)
	for i := 0; i < replacementCount; i++ {
		items = append(items, verselineMCPSummarizeSegment(index+i, updated[index+i]))
	}

	output := verselineMCPSplitSegmentOutput{
		ProjectPath:      absProjectPath,
		Timeline:         timelineKind,
		TimelinePath:     timelinePath,
		OriginalNumber:   index + 1,
		ReplacementCount: replacementCount,
		Segments:         items,
		Saved:            !in.DryRun,
	}
	summary := fmt.Sprintf("Split %s timeline segment %d into %d segments in %s", timelineKind, index+1, replacementCount, filepath.Base(absProjectPath))
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

func verselineMCPReadabilityTool(_ context.Context, _ *mcp.CallToolRequest, in verselineMCPReadabilityInput) (*mcp.CallToolResult, verselineMCPReadabilityOutput, error) {
	project, absProjectPath, segments, _, _, err := verselineMCPLoadProjectTimeline(in.ProjectPath, in.Timeline, false)
	if err != nil {
		return nil, verselineMCPReadabilityOutput{}, err
	}

	index, err := verselineOpsFindSegmentIndex(segments, in.SegmentNumber, in.SegmentID)
	if err != nil {
		return nil, verselineMCPReadabilityOutput{}, err
	}

	segment := segments[index]
	startMs, _ := tsToMillis(segment.Start)
	endMs, _ := tsToMillis(segment.End)
	timestamp := startMs + (endMs-startMs)/2
	if strings.TrimSpace(in.Timestamp) != "" {
		ts, tsErr := tsToMillis(in.Timestamp)
		if tsErr != nil {
			return nil, verselineMCPReadabilityOutput{}, fmt.Errorf("invalid timestamp: %w", tsErr)
		}
		timestamp = ts
	}

	blocks, err := analyzeVerselineReadability(project, absProjectPath, segment, timestamp)
	if err != nil {
		return nil, verselineMCPReadabilityOutput{}, err
	}

	output := verselineMCPReadabilityOutput{
		ProjectPath: absProjectPath,
		Timestamp:   millisToTs(timestamp),
		Blocks:      blocks,
	}

	poor := 0
	for _, b := range blocks {
		if !b.MeetsWCAG_AA {
			poor++
		}
	}
	summary := fmt.Sprintf("Checked readability for segment %d: %d blocks", index+1, len(blocks))
	if poor > 0 {
		summary += fmt.Sprintf(", %d with poor contrast", poor)
	}

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
	runes := []rune(preview)
	if len(runes) > 160 {
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


