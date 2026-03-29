package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type VerselineProject struct {
	Name           string                   `json:"name,omitempty"`
	Output         string                   `json:"output,omitempty"`
	Canvas         VerselineCanvas          `json:"canvas"`
	Assets         VerselineAssets          `json:"assets"`
	Fonts          []VerselineFont          `json:"fonts,omitempty"`
	Styles         []VerselineStyle         `json:"styles,omitempty"`
	Placements     []VerselinePlacement     `json:"placements,omitempty"`
	Sources        []VerselineSource        `json:"sources,omitempty"`
	Overlays       []VerselineOverlay       `json:"overlays,omitempty"`
	Preview        VerselinePreviewSettings `json:"preview,omitempty"`
	RenderProfiles []VerselineRenderProfile `json:"render_profiles,omitempty"`
	Timeline       VerselineTimelinePaths   `json:"timeline"`
}

type VerselineCanvas struct {
	Width  int `json:"width"`
	Height int `json:"height"`
	FPS    int `json:"fps"`
}

type VerselineAssets struct {
	Audio      string              `json:"audio,omitempty"`
	Background VerselineBackground `json:"background"`
}

type VerselineBackground struct {
	Type string `json:"type,omitempty"`
	Path string `json:"path"`
	Loop *bool  `json:"loop,omitempty"`
	Fit  string `json:"fit,omitempty"`
}

type VerselineFont struct {
	ID     string   `json:"id"`
	Family string   `json:"family"`
	Files  []string `json:"files,omitempty"`
}

type VerselineStyle struct {
	ID             string `json:"id"`
	Font           string `json:"font"`
	Size           int    `json:"size"`
	Color          string `json:"color,omitempty"`
	AuxiliaryColor string `json:"auxiliary_color,omitempty"`
	OutlineColor   string `json:"outline_color,omitempty"`
	Outline        int    `json:"outline,omitempty"`
	ShadowColor    string `json:"shadow_color,omitempty"`
	Shadow         int    `json:"shadow,omitempty"`
	TextBG         string `json:"text_bg,omitempty"`
	TextBGPad      int    `json:"text_bg_pad,omitempty"`
	TextBGRadius   int    `json:"text_bg_radius,omitempty"`
	Align          string `json:"align,omitempty"`
	LineHeight     int    `json:"line_height,omitempty"`
}

type VerselinePlacement struct {
	ID        string `json:"id"`
	Anchor    string `json:"anchor"`
	MarginX   int    `json:"margin_x,omitempty"`
	MarginY   int    `json:"margin_y,omitempty"`
	MaxWidth  int    `json:"max_width,omitempty"`
	MaxHeight int    `json:"max_height,omitempty"`
}

type VerselineSource struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Path      string `json:"path"`
	Language  string `json:"language,omitempty"`
	TextField string `json:"text_field,omitempty"`
	KeyField  string `json:"key_field,omitempty"`
}

type VerselineTimelinePaths struct {
	Draft    string `json:"draft,omitempty"`
	Approved string `json:"approved,omitempty"`
}

type VerselinePreviewSettings struct {
	Player       string   `json:"player,omitempty"`
	PlayerArgs   []string `json:"player_args,omitempty"`
	Directory    string   `json:"directory,omitempty"`
	PaddingMS    int      `json:"padding_ms,omitempty"`
	Width        int      `json:"width,omitempty"`
	Height       int      `json:"height,omitempty"`
	FPS          int      `json:"fps,omitempty"`
	VideoCodec   string   `json:"video_codec,omitempty"`
	AudioCodec   string   `json:"audio_codec,omitempty"`
	AudioBitrate string   `json:"audio_bitrate,omitempty"`
	CRF          int      `json:"crf,omitempty"`
	Preset       string   `json:"preset,omitempty"`
	PixFmt       string   `json:"pix_fmt,omitempty"`
	ExtraArgs    []string `json:"extra_args,omitempty"`
}

type VerselineRenderProfile struct {
	ID             string   `json:"id"`
	Label          string   `json:"label,omitempty"`
	Width          int      `json:"width,omitempty"`
	Height         int      `json:"height,omitempty"`
	FPS            int      `json:"fps,omitempty"`
	Output         string   `json:"output,omitempty"`
	OutputSuffix   string   `json:"output_suffix,omitempty"`
	VideoCodec     string   `json:"video_codec,omitempty"`
	AudioCodec     string   `json:"audio_codec,omitempty"`
	AudioBitrate   string   `json:"audio_bitrate,omitempty"`
	CRF            int      `json:"crf,omitempty"`
	Preset         string   `json:"preset,omitempty"`
	PixFmt         string   `json:"pix_fmt,omitempty"`
	ColorPrimaries string   `json:"color_primaries,omitempty"`
	ColorTRC       string   `json:"color_trc,omitempty"`
	ColorSpace     string   `json:"colorspace,omitempty"`
	ColorRange     string   `json:"color_range,omitempty"`
	ExtraArgs      []string `json:"extra_args,omitempty"`
}

type VerselineSegment struct {
	ID         string           `json:"id,omitempty"`
	Start      string           `json:"start"`
	End        string           `json:"end"`
	Status     string           `json:"status,omitempty"`
	Confidence float64          `json:"confidence,omitempty"`
	Notes      string           `json:"notes,omitempty"`
	Blocks     []VerselineBlock `json:"blocks"`
}

type VerselineOverlay struct {
	ID     string           `json:"id,omitempty"`
	Start  string           `json:"start,omitempty"`
	End    string           `json:"end,omitempty"`
	Blocks []VerselineBlock `json:"blocks"`
}

type VerselineBlock struct {
	ID        string                `json:"id,omitempty"`
	Kind      string                `json:"kind,omitempty"`
	Text      string                `json:"text,omitempty"`
	Style     string                `json:"style,omitempty"`
	Placement string                `json:"placement,omitempty"`
	Language  string                `json:"language,omitempty"`
	Source    *VerselineBlockSource `json:"source,omitempty"`
}

type VerselineBlockSource struct {
	Source string   `json:"source"`
	Mode   string   `json:"mode,omitempty"`
	Refs   []string `json:"refs,omitempty"`
}

func init() {
	Subcommands["verseline-validate"] = Subcommand{
		Description: "Validate a Verseline project and its JSONL timeline",
		Run: func(name string, args []string) bool {
			subFlag := flag.NewFlagSet(name, flag.ContinueOnError)
			projectPtr := subFlag.String("project", "examples/verseline-project.json", "Path to the Verseline project JSON file")
			draftPtr := subFlag.Bool("draft", false, "Validate the draft timeline instead of the approved timeline")

			err := subFlag.Parse(args)
			if err == flag.ErrHelp {
				return true
			}
			if err != nil {
				fmt.Printf("ERROR: Could not parse command line arguments: %s\n", err)
				return false
			}

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

			resolvedTimelinePath := resolveReelPath(filepath.Dir(projectPath), timelinePath)
			segments, err := loadVerselineTimeline(resolvedTimelinePath)
			if err != nil {
				fmt.Printf("ERROR: Could not load Verseline timeline %s: %s\n", resolvedTimelinePath, err)
				return false
			}
			if err := validateVerselineTimelineAgainstProject(project, segments); err != nil {
				fmt.Printf("ERROR: Timeline failed project validation: %s\n", err)
				return false
			}

			fmt.Printf("Validated %s\n", projectPath)
			fmt.Printf("Timeline: %s\n", resolvedTimelinePath)
			fmt.Printf("Segments: %d\n", len(segments))
			return true
		},
	}
}

func loadVerselineProject(path string) (VerselineProject, string, error) {
	project := VerselineProject{}
	absPath, err := filepath.Abs(path)
	if err != nil {
		return project, "", err
	}

	content, err := os.ReadFile(absPath)
	if err != nil {
		return project, "", err
	}

	if err := json.Unmarshal(content, &project); err != nil {
		return project, "", verselineProjectUnmarshalError(err)
	}

	if err := validateVerselineProject(project); err != nil {
		return project, "", err
	}

	return project, absPath, nil
}

var verselineFieldHints = map[string]string{
	"canvas":          `expected object: "canvas": {"width": 1080, "height": 1920, "fps": 30}`,
	"assets":          `expected object: "assets": {"audio": "file.m4a", "background": {"path": "bg.jpg"}}`,
	"assets.background": `expected object: "background": {"path": "bg.jpg", "type": "image"}`,
	"fonts":           `expected array of objects: "fonts": [{"id": "main", "family": "Arial"}]`,
	"styles":          `expected array of objects: "styles": [{"id": "primary", "font": "main", "size": 48}]`,
	"placements":      `expected array of objects: "placements": [{"id": "center", "anchor": "center"}]`,
	"sources":         `expected array of objects: "sources": [{"id": "en", "type": "json", "path": "data.json"}]`,
	"overlays":        `expected array of objects: "overlays": [{"blocks": [{"text": "...", "style": "..."}]}]`,
	"render_profiles": `expected array of objects: "render_profiles": [{"id": "default"}]`,
	"timeline":        `expected object: "timeline": {"draft": "timeline-draft.jsonl"}`,
	"preview":         `expected object: "preview": {"directory": "previews/", "padding_ms": 500}`,
}

func verselineProjectUnmarshalError(err error) error {
	var typeErr *json.UnmarshalTypeError
	if errors.As(err, &typeErr) {
		field := typeErr.Field
		if field == "" {
			field = "(root)"
		}
		msg := fmt.Sprintf("field %q: got JSON %s, expected %s", field, typeErr.Value, typeErr.Type)
		if hint, ok := verselineFieldHints[field]; ok {
			msg += " — " + hint
		}
		return fmt.Errorf("invalid project JSON: %s", msg)
	}
	return fmt.Errorf("invalid project JSON: %w", err)
}

func validateVerselineProject(project VerselineProject) error {
	if project.Canvas.Width <= 0 || project.Canvas.Height <= 0 {
		return fmt.Errorf("canvas width and height must be positive (got width=%d, height=%d)", project.Canvas.Width, project.Canvas.Height)
	}
	if project.Canvas.FPS <= 0 {
		return fmt.Errorf("canvas fps must be positive (got fps=%d)", project.Canvas.FPS)
	}
	if strings.TrimSpace(project.Assets.Background.Path) == "" {
		return fmt.Errorf("assets.background.path is required")
	}
	if strings.TrimSpace(project.Timeline.Draft) == "" && strings.TrimSpace(project.Timeline.Approved) == "" {
		return fmt.Errorf("at least one of timeline.draft or timeline.approved is required")
	}
	if err := validateVerselineIDs("font", verselineFontIDs(project.Fonts)); err != nil {
		return err
	}
	if err := validateVerselineIDs("style", verselineStyleIDs(project.Styles)); err != nil {
		return err
	}
	if err := validateVerselineIDs("placement", verselinePlacementIDs(project.Placements)); err != nil {
		return err
	}
	if err := validateVerselineIDs("source", verselineSourceIDs(project.Sources)); err != nil {
		return err
	}
	if err := validateVerselineIDs("render profile", verselineRenderProfileIDs(project.RenderProfiles)); err != nil {
		return err
	}
	for index, overlay := range project.Overlays {
		if err := validateVerselineBlocks(overlay.Blocks, fmt.Sprintf("overlay %d", index)); err != nil {
			return err
		}
	}
	for _, profile := range project.RenderProfiles {
		if profile.Width < 0 || profile.Height < 0 || profile.FPS < 0 {
			return fmt.Errorf("render profile %q dimensions and fps must not be negative", profile.ID)
		}
	}
	return nil
}

func loadVerselineTimeline(path string) ([]VerselineSegment, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	trimmed := strings.TrimSpace(string(content))
	if trimmed == "" {
		return nil, fmt.Errorf("timeline file is empty")
	}

	if strings.HasPrefix(trimmed, "[") {
		var segments []VerselineSegment
		if err := json.Unmarshal(content, &segments); err != nil {
			return nil, err
		}
		return segments, validateVerselineTimeline(segments)
	}

	segments := []VerselineSegment{}
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber += 1
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var segment VerselineSegment
		if err := json.Unmarshal([]byte(line), &segment); err != nil {
			return nil, fmt.Errorf("%s:%d: %w", path, lineNumber, err)
		}
		segments = append(segments, segment)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return segments, validateVerselineTimeline(segments)
}

func validateVerselineTimeline(segments []VerselineSegment) error {
	for index, segment := range segments {
		if strings.TrimSpace(segment.Start) == "" || strings.TrimSpace(segment.End) == "" {
			return fmt.Errorf("segment %d: start and end are required", index)
		}
		if _, err := tsToMillis(segment.Start); err != nil {
			return fmt.Errorf("segment %d: invalid start: %w", index, err)
		}
		if _, err := tsToMillis(segment.End); err != nil {
			return fmt.Errorf("segment %d: invalid end: %w", index, err)
		}
		if len(segment.Blocks) == 0 {
			return fmt.Errorf("segment %d: at least one block is required", index)
		}
		if err := validateVerselineBlocks(segment.Blocks, fmt.Sprintf("segment %d", index)); err != nil {
			return err
		}
	}
	return nil
}

func validateVerselineBlocks(blocks []VerselineBlock, scope string) error {
	if len(blocks) == 0 {
		return fmt.Errorf("%s: at least one block is required", scope)
	}
	for blockIndex, block := range blocks {
		if strings.TrimSpace(block.Text) == "" && block.Source == nil {
			return fmt.Errorf("%s block %d: either text or source is required", scope, blockIndex)
		}
		if block.Source != nil && strings.TrimSpace(block.Source.Source) == "" {
			return fmt.Errorf("%s block %d: source.source is required", scope, blockIndex)
		}
	}
	return nil
}

func validateVerselineIDs(kind string, ids []string) error {
	seen := map[string]bool{}
	for _, id := range ids {
		if strings.TrimSpace(id) == "" {
			return fmt.Errorf("%s ids must not be empty — each %s entry must have an \"id\" field", kind, kind)
		}
		if seen[id] {
			return fmt.Errorf("duplicate %s id %q — each %s must have a unique \"id\"", kind, id, kind)
		}
		seen[id] = true
	}
	return nil
}

func verselineFontIDs(items []VerselineFont) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		result = append(result, item.ID)
	}
	return result
}

func verselineStyleIDs(items []VerselineStyle) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		result = append(result, item.ID)
	}
	return result
}

func verselinePlacementIDs(items []VerselinePlacement) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		result = append(result, item.ID)
	}
	return result
}

func verselineSourceIDs(items []VerselineSource) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		result = append(result, item.ID)
	}
	return result
}

func verselineRenderProfileIDs(items []VerselineRenderProfile) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		result = append(result, item.ID)
	}
	return result
}
