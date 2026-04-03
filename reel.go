package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

type ReelConfig struct {
	Output            string                `json:"output"`
	Width             int                   `json:"width"`
	Height            int                   `json:"height"`
	FPS               int                   `json:"fps"`
	Duration          string                `json:"duration,omitempty"`
	Audio             string                `json:"audio,omitempty"`
	Font              string                `json:"font,omitempty"`
	FontsDir          string                `json:"fonts_dir,omitempty"`
	SegmentsFile      string                `json:"segments_file,omitempty"`
	SegmentsDraftFile string                `json:"segments_draft_file,omitempty"`
	Background        ReelBackground        `json:"background"`
	TranslationSource *ReelTranslationStore `json:"translation_source,omitempty"`
	Meta              ReelMeta              `json:"meta,omitempty"`
	Layout            ReelLayout            `json:"layout,omitempty"`
	Placement         RecitationPlacement   `json:"placement,omitempty"`
	Style             ReelStyle             `json:"style,omitempty"`
	Segments          []ReelSegment         `json:"segments"`
}

type ReelBackground struct {
	Type string `json:"type,omitempty"`
	Path string `json:"path"`
	Loop *bool  `json:"loop,omitempty"`
	Fit  string `json:"fit,omitempty"`
}

type ReelTranslationStore struct {
	Path       string `json:"path"`
	Format     string `json:"format,omitempty"`
	SurahField string `json:"surah_field,omitempty"`
	AyahField  string `json:"ayah_field,omitempty"`
	TextField  string `json:"text_field,omitempty"`
	RefField   string `json:"ref_field,omitempty"`
}

type ReelMeta struct {
	Lines       []string `json:"lines,omitempty"`
	Surah       string   `json:"surah,omitempty"`
	VerseRange  string   `json:"verse_range,omitempty"`
	Translation string   `json:"translation,omitempty"`
}

type ReelLayout struct {
	SafeMarginX            int `json:"safe_margin_x,omitempty"`
	TranslationMarginBottom int `json:"translation_margin_bottom,omitempty"`
	MetaMarginBottom        int `json:"meta_margin_bottom,omitempty"`
}

type ReelStyle struct {
	FontFamily          string `json:"font_family,omitempty"`
	TranslationFontSize int    `json:"translation_font_size,omitempty"`
	LargeFontSize       int    `json:"large_font_size,omitempty"`
	MetaFontSize        int    `json:"meta_font_size,omitempty"`
	PrimaryColor        string `json:"primary_color,omitempty"`
	AuxiliaryColor      string `json:"auxiliary_color,omitempty"`
	MetaColor           string `json:"meta_color,omitempty"`
	OutlineColor        string `json:"outline_color,omitempty"`
	BackColor           string `json:"back_color,omitempty"`
	Outline             int    `json:"outline,omitempty"`
	Shadow              int    `json:"shadow,omitempty"`
}

type ReelSegment struct {
	Start         string   `json:"start"`
	End           string   `json:"end"`
	Text          string   `json:"text,omitempty"`
	Verse         string   `json:"verse,omitempty"`
	Refs          []string `json:"refs,omitempty"`
	Surah         int      `json:"surah,omitempty"`
	Ayah          int      `json:"ayah,omitempty"`
	Style         string   `json:"style,omitempty"`
	FontSize      int      `json:"font_size,omitempty"`
	FontSizeDelta int      `json:"font_size_delta,omitempty"`
}

type reelRenderPlan struct {
	ConfigPath     string
	ConfigDir      string
	OutputPath     string
	ASSPath        string
	Width          int
	Height         int
	FPS            int
	Duration       string
	AudioPath      string
	FontFamily     string
	FontsDir       string
	Background     ReelBackground
	MetaText       string
	Segments       []reelResolvedSegment
	Style          ReelStyle
	Layout         ReelLayout
	TranslationMap map[string]string
}

type reelResolvedSegment struct {
	Start         Millis
	End           Millis
	Text          string
	Style         string
	FontSize      int
	FontSizeDelta int
}

func init() {
	Subcommands["reel"] = Subcommand{
		Description: "Render a portrait recitation reel from a JSON config",
		Run: func(name string, args []string) bool {
			subFlag := flag.NewFlagSet(name, flag.ContinueOnError)
			configPtr := subFlag.String("config", "reel.json", "Path to the reel JSON config")

			err := subFlag.Parse(args)
			if err == flag.ErrHelp {
				return true
			}
			if err != nil {
				fmt.Printf("ERROR: Could not parse command line arguments: %s\n", err)
				return false
			}

			plan, err := loadReelPlan(*configPtr)
			if err != nil {
				fmt.Printf("ERROR: Could not load reel config %s: %s\n", *configPtr, err)
				return false
			}

			if err := writeReelASS(plan); err != nil {
				fmt.Printf("ERROR: Could not generate ASS subtitles %s: %s\n", plan.ASSPath, err)
				return false
			}

			if err := renderReel(plan); err != nil {
				fmt.Printf("ERROR: Could not render reel %s: %s\n", plan.OutputPath, err)
				return false
			}

			fmt.Printf("Generated %s\n", plan.OutputPath)
			fmt.Printf("Generated %s\n", plan.ASSPath)
			return true
		},
	}
}

func loadReelPlan(configPath string) (reelRenderPlan, error) {
	plan := reelRenderPlan{}
	absConfigPath, err := filepath.Abs(configPath)
	if err != nil {
		return plan, err
	}

	content, err := os.ReadFile(absConfigPath)
	if err != nil {
		return plan, err
	}

	var config ReelConfig
	if err := json.Unmarshal(content, &config); err != nil {
		return plan, err
	}

	configDir := filepath.Dir(absConfigPath)
	plan.ConfigPath = absConfigPath
	plan.ConfigDir = configDir
	plan.Width = max(config.Width, 1080)
	plan.Height = max(config.Height, 1920)
	plan.FPS = max(config.FPS, 30)
	plan.Duration = config.Duration
	plan.Background = config.Background
	plan.Style = config.Style
	plan.Layout = config.Layout
	plan.FontFamily = firstNonEmpty(config.Font, config.Style.FontFamily, "Aptos")
	plan.FontsDir = resolveOptionalReelPath(configDir, config.FontsDir)

	if plan.Background.Path == "" {
		return plan, errors.New("background.path is required")
	}
	plan.Background.Path = resolveReelPath(configDir, plan.Background.Path)
	if plan.Background.Type == "" {
		switch strings.ToLower(filepath.Ext(plan.Background.Path)) {
		case ".jpg", ".jpeg", ".png", ".webp":
			plan.Background.Type = "image"
		default:
			plan.Background.Type = "video"
		}
	}

	plan.AudioPath = resolveOptionalReelPath(configDir, config.Audio)
	outputPath := config.Output
	if outputPath == "" {
		outputPath = "reel.mp4"
	}
	plan.OutputPath = resolveReelPath(configDir, outputPath)
	plan.ASSPath = strings.TrimSuffix(plan.OutputPath, filepath.Ext(plan.OutputPath)) + ".ass"

	plan.Style.TranslationFontSize = max(plan.Style.TranslationFontSize, reelScaleValue(plan.Height, 64))
	plan.Style.LargeFontSize = max(plan.Style.LargeFontSize, reelScaleValue(plan.Height, 84))
	plan.Style.MetaFontSize = max(plan.Style.MetaFontSize, reelScaleValue(plan.Height, 28))
	plan.Style.PrimaryColor = firstNonEmpty(plan.Style.PrimaryColor, "#FFFFFF")
	plan.Style.AuxiliaryColor = firstNonEmpty(plan.Style.AuxiliaryColor, "#B7B7B7")
	plan.Style.MetaColor = firstNonEmpty(plan.Style.MetaColor, "#F2F2F2")
	plan.Style.OutlineColor = firstNonEmpty(plan.Style.OutlineColor, "#000000")
	plan.Style.BackColor = firstNonEmpty(plan.Style.BackColor, "#000000")
	plan.Style.Outline = max(plan.Style.Outline, reelScaleValue(plan.Height, 3))
	plan.Style.Shadow = max(plan.Style.Shadow, reelScaleValue(plan.Height, 1))

	plan.Layout.SafeMarginX = max(plan.Layout.SafeMarginX, plan.Width/10)
	plan.Layout.TranslationMarginBottom = max(plan.Layout.TranslationMarginBottom, plan.Height*19/100)
	plan.Layout.MetaMarginBottom = max(plan.Layout.MetaMarginBottom, plan.Height*28/100)

	if config.TranslationSource != nil {
		plan.TranslationMap, err = loadReelTranslationMap(configDir, *config.TranslationSource)
		if err != nil {
			return plan, err
		}
	}

	configSegments, err := loadRecitationSegmentsForRender(absConfigPath, config)
	if err != nil {
		return plan, err
	}
	if err := validateRecitationSegments(configSegments, plan.TranslationMap); err != nil {
		return plan, err
	}

	plan.MetaText = buildReelMetaText(config.Meta)
	plan.Segments, err = resolveReelSegments(configSegments, plan.TranslationMap)
	if err != nil {
		return plan, err
	}

	if len(plan.Segments) == 0 {
		return plan, errors.New("at least one segment is required")
	}

	if plan.AudioPath == "" && plan.Duration == "" {
		lastSegment := plan.Segments[len(plan.Segments)-1]
		plan.Duration = millisToSecsForFFmpeg(lastSegment.End)
	}

	return plan, nil
}

func resolveReelSegments(segments []ReelSegment, verseMap map[string]string) ([]reelResolvedSegment, error) {
	result := []reelResolvedSegment{}
	for index, segment := range segments {
		start, err := tsToMillis(segment.Start)
		if err != nil {
			return nil, fmt.Errorf("segments[%d].start: %w", index, err)
		}
		end, err := tsToMillis(segment.End)
		if err != nil {
			return nil, fmt.Errorf("segments[%d].end: %w", index, err)
		}
		if end <= start {
			return nil, fmt.Errorf("segments[%d]: end must be later than start", index)
		}

		text := strings.TrimSpace(segment.Text)
		if text == "" {
			verseRef := segment.Verse
			if verseRef == "" && segment.Surah > 0 && segment.Ayah > 0 {
				verseRef = fmt.Sprintf("%d:%d", segment.Surah, segment.Ayah)
			}
			if verseRef == "" {
				return nil, fmt.Errorf("segments[%d]: either text or verse/surah+ayah is required", index)
			}
			if len(verseMap) == 0 {
				return nil, fmt.Errorf("segments[%d]: verse lookup requested for %s but no translation_source is configured", index, verseRef)
			}
			text, err = resolveReelVerseText(verseMap, verseRef)
			if err != nil {
				return nil, fmt.Errorf("segments[%d]: %w", index, err)
			}
		}

		style := firstNonEmpty(segment.Style, "default")
		switch style {
		case "default", "large":
		default:
			return nil, fmt.Errorf("segments[%d]: unsupported style %q", index, style)
		}

		result = append(result, reelResolvedSegment{
			Start:         start,
			End:           end,
			Text:          text,
			Style:         style,
			FontSize:      segment.FontSize,
			FontSizeDelta: segment.FontSizeDelta,
		})
	}
	return result, nil
}

func resolveReelVerseText(verseMap map[string]string, verseRef string) (string, error) {
	surah, ayah, ok := parseVerseRef(verseRef)
	if !ok {
		return "", fmt.Errorf("invalid verse reference %q", verseRef)
	}
	text, ok := verseMap[fmt.Sprintf("%d:%d", surah, ayah)]
	if !ok || strings.TrimSpace(text) == "" {
		return "", fmt.Errorf("translation for verse %d:%d is not found in translation_source", surah, ayah)
	}
	return text, nil
}

func buildReelMetaText(meta ReelMeta) string {
	if len(meta.Lines) > 0 {
		lines := []string{}
		for _, line := range meta.Lines {
			line = strings.TrimSpace(line)
			if line != "" {
				lines = append(lines, line)
			}
		}
		return strings.Join(lines, "\n")
	}

	lines := []string{}
	if meta.Surah != "" || meta.VerseRange != "" {
		line := "surah"
		if meta.Surah != "" {
			line += " " + meta.Surah
		}
		if meta.VerseRange != "" {
			line += " " + meta.VerseRange
		}
		lines = append(lines, strings.TrimSpace(line))
	}
	if meta.Translation != "" {
		lines = append(lines, "translation: "+meta.Translation)
	}
	return strings.Join(lines, "\n")
}

func loadReelTranslationMap(configDir string, source ReelTranslationStore) (map[string]string, error) {
	result := map[string]string{}
	if source.Path == "" {
		return result, errors.New("translation_source.path is required")
	}

	path := resolveReelPath(configDir, source.Path)
	format := strings.ToLower(source.Format)
	if format == "" {
		switch strings.ToLower(filepath.Ext(path)) {
		case ".jsonl":
			format = "jsonl"
		default:
			format = "json"
		}
	}

	switch format {
	case "json":
		content, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		var root interface{}
		if err := json.Unmarshal(content, &root); err != nil {
			return nil, err
		}
		if err := collectReelTranslationEntries(root, source, result); err != nil {
			return nil, err
		}
	case "jsonl":
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
			var entry interface{}
			if err := json.Unmarshal([]byte(line), &entry); err != nil {
				return nil, fmt.Errorf("%s:%d: %w", path, lineNumber, err)
			}
			if err := collectReelTranslationEntries(entry, source, result); err != nil {
				return nil, fmt.Errorf("%s:%d: %w", path, lineNumber, err)
			}
		}
		if err := scanner.Err(); err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported translation_source.format %q", format)
	}

	return result, nil
}

func collectReelTranslationEntries(value interface{}, source ReelTranslationStore, result map[string]string) error {
	switch node := value.(type) {
	case []interface{}:
		for _, item := range node {
			if err := collectReelTranslationEntries(item, source, result); err != nil {
				return err
			}
		}
	case map[string]interface{}:
		for _, field := range []string{"verses", "items", "rows", "data"} {
			if nested, ok := node[field]; ok {
				switch nested.(type) {
				case []interface{}, map[string]interface{}:
					return collectReelTranslationEntries(nested, source, result)
				}
			}
		}

		keyedMap := false
		for key, nested := range node {
			surah, ayah, ok := parseVerseRef(key)
			if !ok {
				continue
			}
			text, ok := extractReelTranslationText(nested, source)
			if !ok {
				continue
			}
			result[fmt.Sprintf("%d:%d", surah, ayah)] = text
			keyedMap = true
		}
		if keyedMap {
			return nil
		}

		surah, ayah, ok := extractReelTranslationRef(node, source)
		if ok {
			text, ok := extractReelTranslationText(node, source)
			if !ok {
				return errors.New("translation entry is missing text")
			}
			result[fmt.Sprintf("%d:%d", surah, ayah)] = text
			return nil
		}

		for _, nested := range node {
			switch nested.(type) {
			case []interface{}, map[string]interface{}:
				if err := collectReelTranslationEntries(nested, source, result); err != nil {
					return err
				}
			}
		}
	case string:
		return nil
	}

	return nil
}

func extractReelTranslationRef(node map[string]interface{}, source ReelTranslationStore) (int, int, bool) {
	refFields := []string{source.RefField, "ref", "reference", "verse", "verse_key", "key"}
	for _, field := range refFields {
		field = strings.TrimSpace(field)
		if field == "" {
			continue
		}
		value, ok := node[field]
		if !ok {
			continue
		}
		if refText, ok := value.(string); ok {
			return parseVerseRef(refText)
		}
	}

	surah, surahOK := extractReelIntField(node, source.SurahField, "surah", "sura", "surah_id", "chapter")
	ayah, ayahOK := extractReelIntField(node, source.AyahField, "ayah", "aya", "ayah_number", "verse_number")
	return surah, ayah, surahOK && ayahOK
}

func extractReelTranslationText(value interface{}, source ReelTranslationStore) (string, bool) {
	switch node := value.(type) {
	case string:
		text := strings.TrimSpace(node)
		return text, text != ""
	case map[string]interface{}:
		for _, field := range []string{source.TextField, "text", "translation", "content", "body"} {
			field = strings.TrimSpace(field)
			if field == "" {
				continue
			}
			raw, ok := node[field]
			if !ok {
				continue
			}
			text, ok := raw.(string)
			if !ok {
				continue
			}
			text = strings.TrimSpace(text)
			return text, text != ""
		}
	}
	return "", false
}

func extractReelIntField(node map[string]interface{}, fields ...string) (int, bool) {
	for _, field := range fields {
		field = strings.TrimSpace(field)
		if field == "" {
			continue
		}
		raw, ok := node[field]
		if !ok {
			continue
		}
		switch value := raw.(type) {
		case float64:
			return int(value), true
		case string:
			n, err := strconv.Atoi(strings.TrimSpace(value))
			if err == nil {
				return n, true
			}
		}
	}
	return 0, false
}

func writeReelASS(plan reelRenderPlan) error {
	if err := os.MkdirAll(filepath.Dir(plan.ASSPath), 0755); err != nil {
		return err
	}

	primary, err := reelHexToASSColor(plan.Style.PrimaryColor, true)
	if err != nil {
		return err
	}
	auxiliary, err := reelHexToASSColor(plan.Style.AuxiliaryColor, false)
	if err != nil {
		return err
	}
	metaColor, err := reelHexToASSColor(plan.Style.MetaColor, true)
	if err != nil {
		return err
	}
	outlineColor, err := reelHexToASSColor(plan.Style.OutlineColor, true)
	if err != nil {
		return err
	}
	backColor, err := reelHexToASSColor(plan.Style.BackColor, true)
	if err != nil {
		return err
	}

	sb := strings.Builder{}
	sb.WriteString("[Script Info]\n")
	sb.WriteString("ScriptType: v4.00+\n")
	sb.WriteString(fmt.Sprintf("PlayResX: %d\n", plan.Width))
	sb.WriteString(fmt.Sprintf("PlayResY: %d\n", plan.Height))
	sb.WriteString("WrapStyle: 2\n")
	sb.WriteString("ScaledBorderAndShadow: yes\n")
	sb.WriteString("\n[V4+ Styles]\n")
	sb.WriteString("Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n")
	sb.WriteString(fmt.Sprintf(
		"Style: Translation,%s,%d,%s,%s,%s,%s,0,0,0,0,100,100,0,0,1,%d,%d,2,%d,%d,%d,1\n",
		plan.FontFamily,
		plan.Style.TranslationFontSize,
		primary,
		primary,
		outlineColor,
		backColor,
		plan.Style.Outline,
		plan.Style.Shadow,
		plan.Layout.SafeMarginX,
		plan.Layout.SafeMarginX,
		plan.Layout.TranslationMarginBottom,
	))
	sb.WriteString(fmt.Sprintf(
		"Style: TranslationLarge,%s,%d,%s,%s,%s,%s,0,0,0,0,100,100,0,0,1,%d,%d,2,%d,%d,%d,1\n",
		plan.FontFamily,
		plan.Style.LargeFontSize,
		primary,
		primary,
		outlineColor,
		backColor,
		plan.Style.Outline,
		plan.Style.Shadow,
		plan.Layout.SafeMarginX,
		plan.Layout.SafeMarginX,
		plan.Layout.TranslationMarginBottom,
	))
	sb.WriteString(fmt.Sprintf(
		"Style: Meta,%s,%d,%s,%s,%s,%s,0,0,0,0,100,100,0,0,1,%d,%d,2,%d,%d,%d,1\n",
		plan.FontFamily,
		plan.Style.MetaFontSize,
		metaColor,
		metaColor,
		outlineColor,
		backColor,
		max(plan.Style.Outline-1, 1),
		plan.Style.Shadow,
		plan.Layout.SafeMarginX,
		plan.Layout.SafeMarginX,
		plan.Layout.MetaMarginBottom,
	))
	sb.WriteString("\n[Events]\n")
	sb.WriteString("Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n")

	if strings.TrimSpace(plan.MetaText) != "" {
		sb.WriteString(fmt.Sprintf(
			"Dialogue: 0,0:00:00.00,9:59:59.99,Meta,,0,0,0,,%s\n",
			reelEscapeASSText(plan.MetaText, "", ""),
		))
	}

	for _, segment := range plan.Segments {
		styleName := "Translation"
		if segment.Style == "large" {
			styleName = "TranslationLarge"
		}
		text := reelEscapeASSText(segment.Text, primary, auxiliary)
		fontSize := segment.FontSize
		if fontSize <= 0 && segment.FontSizeDelta != 0 {
			fontSize = plan.Style.TranslationFontSize
			if segment.Style == "large" {
				fontSize = plan.Style.LargeFontSize
			}
			fontSize += segment.FontSizeDelta
		}
		if fontSize > 0 {
			text = fmt.Sprintf("{\\fs%d}%s", fontSize, text)
		}
		sb.WriteString(fmt.Sprintf(
			"Dialogue: 0,%s,%s,%s,,0,0,0,,%s\n",
			reelMillisToASSTs(segment.Start),
			reelMillisToASSTs(segment.End),
			styleName,
			text,
		))
	}

	return os.WriteFile(plan.ASSPath, []byte(sb.String()), 0644)
}

func renderReel(plan reelRenderPlan) error {
	if err := os.MkdirAll(filepath.Dir(plan.OutputPath), 0755); err != nil {
		return err
	}

	args := []string{"-y"}
	backgroundType := strings.ToLower(plan.Background.Type)
	backgroundLoop := reelBool(plan.Background.Loop, backgroundType != "video")

	switch backgroundType {
	case "image":
		args = append(args, "-loop", "1", "-framerate", strconv.Itoa(plan.FPS), "-i", plan.Background.Path)
	case "video":
		if backgroundLoop {
			args = append(args, "-stream_loop", "-1")
		}
		args = append(args, "-i", plan.Background.Path)
	default:
		return fmt.Errorf("unsupported background.type %q", plan.Background.Type)
	}

	if plan.AudioPath != "" {
		args = append(args, "-i", plan.AudioPath)
	}

	filter := buildReelVideoFilter(plan)
	args = append(args, "-vf", filter)
	args = append(args, "-r", strconv.Itoa(plan.FPS))
	args = append(args, "-map", "0:v:0")
	if plan.AudioPath != "" {
		args = append(args, "-map", "1:a:0", "-c:a", "aac", "-b:a", "192k", "-shortest")
	}
	if plan.Duration != "" {
		args = append(args, "-t", plan.Duration)
	}
	args = append(args, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", plan.OutputPath)

	ffmpeg := ffmpegPathToBin()
	logCmd(ffmpeg, args...)
	cmd := exec.Command(ffmpeg, args...)
	out, err := cmd.CombinedOutput()
	if len(out) > 0 {
		verselineLog("[FFMPEG] %s", string(out))
	}
	return err
}

func buildReelVideoFilter(plan reelRenderPlan) string {
	scale := fmt.Sprintf(
		"scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,setsar=1",
		plan.Width,
		plan.Height,
		plan.Width,
		plan.Height,
	)
	if strings.EqualFold(plan.Background.Fit, "contain") {
		scale = fmt.Sprintf(
			"scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2:black,setsar=1",
			plan.Width,
			plan.Height,
			plan.Width,
			plan.Height,
		)
	}
	return strings.Join([]string{
		scale,
		"format=yuv420p",
		fmt.Sprintf("subtitles=filename=%s%s", reelEscapeFFmpegFilterPath(plan.ASSPath), reelFontsDirClause(plan.FontsDir)),
	}, ",")
}

func reelFontsDirClause(fontsDir string) string {
	if fontsDir == "" {
		return ""
	}
	return fmt.Sprintf(":fontsdir=%s", reelEscapeFFmpegFilterPath(fontsDir))
}

func reelEscapeFFmpegFilterPath(path string) string {
	replacer := strings.NewReplacer(
		"\\", "\\\\",
		"'", "\\'",
		":", "\\:",
		",", "\\,",
		"[", "\\[",
		"]", "\\]",
	)
	return replacer.Replace(path)
}

func reelEscapeASSText(text, primaryColor, auxiliaryColor string) string {
	var sb strings.Builder
	bracketDepth := 0
	for _, char := range text {
		switch char {
		case '\n':
			sb.WriteString(`\N`)
			continue
		case '{':
			sb.WriteString(`\{`)
			continue
		case '}':
			sb.WriteString(`\}`)
			continue
		case '\\':
			sb.WriteString(`\\`)
			continue
		}

		if (char == '(' || char == '[') && primaryColor != "" && auxiliaryColor != "" {
			if bracketDepth == 0 {
				sb.WriteString("{\\1c")
				sb.WriteString(auxiliaryColor)
				sb.WriteString("}")
			}
			bracketDepth += 1
		}

		sb.WriteRune(char)

		if (char == ')' || char == ']') && primaryColor != "" && auxiliaryColor != "" && bracketDepth > 0 {
			bracketDepth -= 1
			if bracketDepth == 0 {
				sb.WriteString("{\\1c")
				sb.WriteString(primaryColor)
				sb.WriteString("}")
			}
		}
	}
	if bracketDepth > 0 && primaryColor != "" {
		sb.WriteString("{\\1c")
		sb.WriteString(primaryColor)
		sb.WriteString("}")
	}
	return sb.String()
}

func reelHexToASSColor(color string, includeAlpha bool) (string, error) {
	color = strings.TrimSpace(strings.TrimPrefix(color, "#"))
	switch len(color) {
	case 6:
		if includeAlpha {
			return fmt.Sprintf("&H00%s%s%s", color[4:6], color[2:4], color[0:2]), nil
		}
		return fmt.Sprintf("&H%s%s%s&", color[4:6], color[2:4], color[0:2]), nil
	case 8:
		if includeAlpha {
			return fmt.Sprintf("&H%s%s%s%s", color[0:2], color[6:8], color[4:6], color[2:4]), nil
		}
		return fmt.Sprintf("&H%s%s%s&", color[6:8], color[4:6], color[2:4]), nil
	default:
		return "", fmt.Errorf("invalid color %q", color)
	}
}

func reelMillisToASSTs(millis Millis) string {
	totalCentis := int64(millis / 10)
	cc := totalCentis % 100
	totalSeconds := totalCentis / 100
	ss := totalSeconds % 60
	totalMinutes := totalSeconds / 60
	mm := totalMinutes % 60
	hh := totalMinutes / 60
	return fmt.Sprintf("%d:%02d:%02d.%02d", hh, mm, ss, cc)
}

func parseVerseRef(ref string) (int, int, bool) {
	parts := strings.Split(strings.TrimSpace(ref), ":")
	if len(parts) != 2 {
		return 0, 0, false
	}
	surah, err := strconv.Atoi(strings.TrimSpace(parts[0]))
	if err != nil {
		return 0, 0, false
	}
	ayah, err := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err != nil {
		return 0, 0, false
	}
	return surah, ayah, true
}

func resolveReelPath(configDir string, target string) string {
	if target == "" {
		return ""
	}
	if filepath.IsAbs(target) {
		return target
	}
	return filepath.Join(configDir, target)
}

func resolveOptionalReelPath(configDir string, target string) string {
	if strings.TrimSpace(target) == "" {
		return ""
	}
	return resolveReelPath(configDir, target)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func reelScaleValue(height int, base1080x1920 int) int {
	return max(base1080x1920*height/1920, 1)
}

func reelBool(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}
