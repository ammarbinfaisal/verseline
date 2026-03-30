package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type verselineResolvedBlock struct {
	Start      Millis
	End        Millis
	Text       string
	StyleID    string
	Style      VerselineStyle
	Placement  VerselinePlacement
	FontFile   string
	ImagePath  string
	StylesByID map[string]VerselineStyle
}

// verselineTextSpan is a contiguous run of text rendered with a single style.
// StyleID is empty for text using the block's default style.
type verselineTextSpan struct {
	Text    string
	StyleID string
}

// verselineParseTextSpans splits text containing <styleID>...</styleID> tags
// into spans. Untagged text gets an empty StyleID (meaning the block default).
// Tags do not nest; an open tag must be closed before another can open.
func verselineParseTextSpans(text string) []verselineTextSpan {
	var spans []verselineTextSpan
	for len(text) > 0 {
		openIdx := strings.Index(text, "<")
		if openIdx < 0 {
			spans = append(spans, verselineTextSpan{Text: text})
			break
		}
		closeAngle := strings.Index(text[openIdx:], ">")
		if closeAngle < 0 {
			spans = append(spans, verselineTextSpan{Text: text})
			break
		}
		tagName := text[openIdx+1 : openIdx+closeAngle]
		if tagName == "" || strings.HasPrefix(tagName, "/") || strings.ContainsAny(tagName, " \t\n") {
			// Not a valid style tag — treat the < as literal text
			spans = append(spans, verselineTextSpan{Text: text[:openIdx+closeAngle+1]})
			text = text[openIdx+closeAngle+1:]
			continue
		}
		closeTag := "</" + tagName + ">"
		closeIdx := strings.Index(text[openIdx:], closeTag)
		if closeIdx < 0 {
			// No closing tag — treat as literal
			spans = append(spans, verselineTextSpan{Text: text[:openIdx+closeAngle+1]})
			text = text[openIdx+closeAngle+1:]
			continue
		}
		// Emit any text before the tag
		if openIdx > 0 {
			spans = append(spans, verselineTextSpan{Text: text[:openIdx]})
		}
		innerStart := openIdx + closeAngle + 1
		innerEnd := openIdx + closeIdx
		spans = append(spans, verselineTextSpan{
			Text:    text[innerStart:innerEnd],
			StyleID: tagName,
		})
		text = text[innerEnd+len(closeTag):]
	}
	return spans
}

// verselineStripStyleTags returns the plain text with all <styleID>...</styleID>
// tags removed (content preserved, tags stripped).
func verselineStripStyleTags(text string) string {
	spans := verselineParseTextSpans(text)
	var sb strings.Builder
	for _, span := range spans {
		sb.WriteString(span.Text)
	}
	return sb.String()
}

// verselineRuneColors builds a color for each rune in the plain (tag-stripped)
// text. Runes inside a tagged span get the color from that style; other runes
// get the fallback color.
func verselineRuneColors(spans []verselineTextSpan, fallback string, stylesByID map[string]VerselineStyle) []string {
	var colors []string
	for _, span := range spans {
		c := fallback
		if span.StyleID != "" {
			if s, ok := stylesByID[span.StyleID]; ok && s.Color != "" {
				c = s.Color
			}
		}
		for range []rune(span.Text) {
			colors = append(colors, c)
		}
	}
	return colors
}

// verselineSpansToASS converts tagged text into ASS dialogue text with inline
// color overrides. Each <styleID>...</styleID> region gets a {\1c&HBBGGRR&}
// prefix using that style's color, and the primary color is restored after.
func verselineSpansToASS(text string, primaryHex string, stylesByID map[string]VerselineStyle) (string, error) {
	spans := verselineParseTextSpans(text)
	primary, err := reelHexToASSColor(primaryHex, false)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	for _, span := range spans {
		escaped := verselineEscapeASSText(span.Text)
		if span.StyleID == "" {
			sb.WriteString(escaped)
			continue
		}
		style, ok := stylesByID[span.StyleID]
		if !ok || strings.TrimSpace(style.Color) == "" {
			sb.WriteString(escaped)
			continue
		}
		assColor, err := reelHexToASSColor(style.Color, false)
		if err != nil {
			sb.WriteString(escaped)
			continue
		}
		sb.WriteString("{\\1c")
		sb.WriteString(assColor)
		sb.WriteString("}")
		sb.WriteString(escaped)
		sb.WriteString("{\\1c")
		sb.WriteString(primary)
		sb.WriteString("}")
	}
	return sb.String(), nil
}

// verselineEscapeASSText escapes special ASS characters in plain text.
func verselineEscapeASSText(text string) string {
	var sb strings.Builder
	for _, ch := range text {
		switch ch {
		case '\n':
			sb.WriteString(`\N`)
		case '{':
			sb.WriteString(`\{`)
		case '}':
			sb.WriteString(`\}`)
		case '\\':
			sb.WriteString(`\\`)
		default:
			sb.WriteRune(ch)
		}
	}
	return sb.String()
}

type verselineRenderPlan struct {
	ProjectPath    string
	ProjectDir     string
	OutputPath     string
	ASSPath        string
	Width          int
	Height         int
	FPS            int
	AudioPath      string
	Background     VerselineBackground
	FontsDir       string
	ClipEnd        Millis
	InputOffset    Millis
	Duration       Millis
	VideoCodec     string
	AudioCodec     string
	AudioBitrate   string
	CRF            int
	Preset         string
	PixFmt         string
	ColorPrimaries string
	ColorTRC       string
	ColorSpace     string
	ColorRange     string
	ExtraArgs      []string
	Label          string
	Blocks         []verselineResolvedBlock
}

func init() {
	Subcommands["render"] = Subcommand{
		Description: "Render a project: render <project.json> [-profile ids] [-o output.mp4]",
		Run: func(name string, args []string) bool {
			subFlag := flag.NewFlagSet(name, flag.ContinueOnError)
			profilesPtr := subFlag.String("profile", "", "Comma-separated render profile ids. Empty means all profiles")
			outputPtr := subFlag.String("o", "", "Output file path override")

			err := subFlag.Parse(args)
			if err == flag.ErrHelp {
				return true
			}
			if err != nil {
				fmt.Printf("ERROR: Could not parse command line arguments: %s\n", err)
				return false
			}

			projectPath := subFlag.Arg(0)
			if projectPath == "" {
				fmt.Println("Usage: render <project.json> [-profile ids] [-o output.mp4]")
				return false
			}

			outputs, err := verselineRenderProjectProfiles(projectPath, verselineSplitCSV(*profilesPtr), strings.TrimSpace(*outputPtr), nil)
			if err != nil {
				fmt.Printf("ERROR: Could not render project outputs: %s\n", err)
				return false
			}
			for _, output := range outputs {
				fmt.Printf("Generated %s\n", output)
				fmt.Printf("Generated %s\n", strings.TrimSuffix(output, filepath.Ext(output))+".ass")
			}
			return true
		},
	}
}

func buildVerselineRenderPlan(project VerselineProject, absProjectPath string, segments []VerselineSegment, request verselineRenderRequest) (verselineRenderPlan, error) {
	plan := verselineRenderPlan{}
	projectDir := filepath.Dir(absProjectPath)
	sourceMaps, err := loadVerselineSourceMaps(projectDir, project.Sources)
	if err != nil {
		return plan, err
	}

	styleByID := map[string]VerselineStyle{}
	fontFamilyByID := map[string]string{}
	fontFileByID := map[string]string{}
	for _, font := range project.Fonts {
		fontFamilyByID[font.ID] = font.Family
		if len(font.Files) > 0 {
			fontPath := resolveReelPath(projectDir, font.Files[0])
			if _, err := os.Stat(fontPath); err == nil {
				fontFileByID[font.ID] = fontPath
			}
		}
	}
	fontFileByStyleID := map[string]string{}
	for _, style := range project.Styles {
		originalFontID := style.Font
		if family := strings.TrimSpace(fontFamilyByID[style.Font]); family != "" {
			style.Font = family
		}
		styleByID[style.ID] = style
		fontFileByStyleID[style.ID] = fontFileByID[originalFontID]
	}
	placementByID := map[string]VerselinePlacement{}
	for _, placement := range project.Placements {
		placementByID[placement.ID] = placement
	}

	plan.ProjectPath = absProjectPath
	plan.ProjectDir = projectDir
	plan.Width = verselineFirstPositive(request.Width, project.Canvas.Width)
	plan.Height = verselineFirstPositive(request.Height, project.Canvas.Height)
	plan.FPS = verselineFirstPositive(request.FPS, project.Canvas.FPS)
	plan.AudioPath = resolveOptionalReelPath(projectDir, project.Assets.Audio)
	plan.Background = project.Assets.Background
	plan.Background.Path = resolveReelPath(projectDir, project.Assets.Background.Path)
	plan.FontsDir = verselineFontsDir(projectDir, project.Fonts)
	plan.ClipEnd = 0
	plan.InputOffset = request.InputOffset
	plan.Duration = request.Duration
	plan.VideoCodec = request.VideoCodec
	plan.AudioCodec = request.AudioCodec
	plan.AudioBitrate = request.AudioBitrate
	plan.CRF = request.CRF
	plan.Preset = request.Preset
	plan.PixFmt = request.PixFmt
	plan.ColorPrimaries = request.ColorPrimaries
	plan.ColorTRC = request.ColorTRC
	plan.ColorSpace = request.ColorSpace
	plan.ColorRange = request.ColorRange
	plan.ExtraArgs = append([]string(nil), request.ExtraArgs...)
	plan.Label = request.Label

	outputPath := strings.TrimSpace(request.OutputPath)
	if outputPath == "" {
		base := firstNonEmpty(project.Output, project.Name, strings.TrimSuffix(filepath.Base(absProjectPath), filepath.Ext(absProjectPath)), "verseline-output")
		outputPath = base + ".mp4"
	}
	plan.OutputPath = resolveReelPath(projectDir, outputPath)
	plan.ASSPath = strings.TrimSuffix(plan.OutputPath, filepath.Ext(plan.OutputPath)) + ".ass"

	for _, segment := range segments {
		start, _ := tsToMillis(segment.Start)
		end, _ := tsToMillis(segment.End)
		plan.ClipEnd = max(plan.ClipEnd, end)
		for _, block := range segment.Blocks {
			resolved, err := resolveVerselineBlock(block, start, end, styleByID, placementByID, fontFileByStyleID, sourceMaps, project)
			if err != nil {
				return plan, err
			}
			plan.Blocks = append(plan.Blocks, resolved)
		}
	}

	for _, overlay := range project.Overlays {
		start := Millis(0)
		end := plan.ClipEnd
		if strings.TrimSpace(overlay.Start) != "" {
			start, err = tsToMillis(overlay.Start)
			if err != nil {
				return plan, fmt.Errorf("overlay %q start: %w", overlay.ID, err)
			}
		}
		if strings.TrimSpace(overlay.End) != "" {
			end, err = tsToMillis(overlay.End)
			if err != nil {
				return plan, fmt.Errorf("overlay %q end: %w", overlay.ID, err)
			}
		}
		plan.ClipEnd = max(plan.ClipEnd, end)
		for _, block := range overlay.Blocks {
			resolved, err := resolveVerselineBlock(block, start, end, styleByID, placementByID, fontFileByStyleID, sourceMaps, project)
			if err != nil {
				return plan, err
			}
			plan.Blocks = append(plan.Blocks, resolved)
		}
	}

	if plan.Duration > 0 {
		windowStart := plan.InputOffset
		windowEnd := plan.InputOffset + plan.Duration
		filtered := make([]verselineResolvedBlock, 0, len(plan.Blocks))
		for _, block := range plan.Blocks {
			if block.End <= windowStart || block.Start >= windowEnd {
				continue
			}
			if block.Start < windowStart {
				block.Start = windowStart
			}
			if block.End > windowEnd {
				block.End = windowEnd
			}
			block.Start -= windowStart
			block.End -= windowStart
			filtered = append(filtered, block)
		}
		plan.Blocks = filtered
		plan.ClipEnd = plan.Duration
	} else if plan.ClipEnd > 0 {
		plan.Duration = plan.ClipEnd
	}

	return plan, nil
}

func validateVerselineTimelineAgainstProject(project VerselineProject, segments []VerselineSegment) error {
	styleByID := map[string]bool{}
	for _, style := range project.Styles {
		styleByID[style.ID] = true
	}
	placementByID := map[string]bool{}
	for _, placement := range project.Placements {
		placementByID[placement.ID] = true
	}
	sourceByID := map[string]bool{}
	for _, source := range project.Sources {
		sourceByID[source.ID] = true
	}

	validateBlocks := func(scope string, blocks []VerselineBlock) error {
		for blockIndex, block := range blocks {
			if block.Style != "" && !styleByID[block.Style] {
				return fmt.Errorf("%s block %d: unknown style %q", scope, blockIndex, block.Style)
			}
			if block.Placement != "" && !placementByID[block.Placement] {
				return fmt.Errorf("%s block %d: unknown placement %q", scope, blockIndex, block.Placement)
			}
			if block.Source != nil && !sourceByID[block.Source.Source] {
				return fmt.Errorf("%s block %d: unknown source %q", scope, blockIndex, block.Source.Source)
			}
		}
		return nil
	}

	for index, segment := range segments {
		if err := validateBlocks(fmt.Sprintf("segment %d", index), segment.Blocks); err != nil {
			return err
		}
	}
	for index, overlay := range project.Overlays {
		if err := validateBlocks(fmt.Sprintf("overlay %d", index), overlay.Blocks); err != nil {
			return err
		}
	}
	return nil
}

func resolveVerselineBlock(
	block VerselineBlock,
	start Millis,
	end Millis,
	styleByID map[string]VerselineStyle,
	placementByID map[string]VerselinePlacement,
	fontFileByStyleID map[string]string,
	sourceMaps map[string]map[string]string,
	project VerselineProject,
) (verselineResolvedBlock, error) {
	resolved := verselineResolvedBlock{
		Start: start,
		End:   end,
	}

	styleID := strings.TrimSpace(block.Style)
	if styleID == "" {
		if len(project.Styles) == 0 {
			return resolved, fmt.Errorf("block %q has no style and project defines no styles", block.ID)
		}
		styleID = project.Styles[0].ID
	}
	style, ok := styleByID[styleID]
	if !ok {
		return resolved, fmt.Errorf("unknown style %q", styleID)
	}

	placementID := strings.TrimSpace(block.Placement)
	if placementID == "" {
		if len(project.Placements) == 0 {
			return resolved, fmt.Errorf("block %q has no placement and project defines no placements", block.ID)
		}
		placementID = project.Placements[0].ID
	}
	placement, ok := placementByID[placementID]
	if !ok {
		return resolved, fmt.Errorf("unknown placement %q", placementID)
	}

	text, err := resolveVerselineBlockText(block, sourceMaps)
	if err != nil {
		return resolved, err
	}

	resolved.Text = text
	resolved.StyleID = styleID
	resolved.Style = style
	resolved.Placement = placement
	resolved.FontFile = fontFileByStyleID[styleID]
	resolved.StylesByID = styleByID
	return resolved, nil
}

func resolveVerselineBlockText(block VerselineBlock, sourceMaps map[string]map[string]string) (string, error) {
	if block.Source == nil {
		text := strings.TrimSpace(block.Text)
		if text == "" {
			return "", fmt.Errorf("block %q has neither text nor source", block.ID)
		}
		return block.Text, nil
	}

	sourceMap, ok := sourceMaps[block.Source.Source]
	if !ok {
		return "", fmt.Errorf("block %q references unknown source %q", block.ID, block.Source.Source)
	}
	if len(block.Source.Refs) == 0 {
		return "", fmt.Errorf("block %q source refs are required", block.ID)
	}

	sourceTexts := []string{}
	for _, ref := range block.Source.Refs {
		value, ok := sourceMap[ref]
		if !ok {
			return "", fmt.Errorf("block %q source %q is missing ref %q", block.ID, block.Source.Source, ref)
		}
		sourceTexts = append(sourceTexts, value)
	}
	joined := strings.Join(sourceTexts, " ")

	mode := strings.ToLower(strings.TrimSpace(block.Source.Mode))
	if mode == "" {
		switch strings.ToLower(strings.TrimSpace(block.Kind)) {
		case "source_full", "full":
			mode = "full"
		case "source_substring", "substring":
			mode = "substring"
		default:
			if strings.TrimSpace(block.Text) == "" {
				mode = "full"
			} else {
				mode = "substring"
			}
		}
	}

	switch mode {
	case "full", "lookup":
		if strings.TrimSpace(block.Text) != "" && strings.TrimSpace(block.Text) != joined {
			return "", fmt.Errorf("block %q text must match the full sourced text in full mode", block.ID)
		}
		return joined, nil
	case "substring":
		text := strings.TrimSpace(block.Text)
		if text == "" {
			return "", fmt.Errorf("block %q text is required in substring mode", block.ID)
		}
		if !strings.Contains(joined, text) {
			return "", fmt.Errorf("block %q text is not an exact substring of the sourced text", block.ID)
		}
		return block.Text, nil
	default:
		return "", fmt.Errorf("block %q uses unsupported source mode %q", block.ID, mode)
	}
}

func loadVerselineSourceMaps(projectDir string, sources []VerselineSource) (map[string]map[string]string, error) {
	result := map[string]map[string]string{}
	for _, source := range sources {
		entries, err := loadVerselineSourceEntries(resolveReelPath(projectDir, source.Path), source)
		if err != nil {
			return nil, fmt.Errorf("source %q: %w", source.ID, err)
		}
		result[source.ID] = entries
	}
	return result, nil
}

func writeVerselineASS(plan verselineRenderPlan) error {
	if err := os.MkdirAll(filepath.Dir(plan.ASSPath), 0755); err != nil {
		return err
	}

	fontFamilies := map[string]string{}
	styleByID := map[string]VerselineStyle{}
	for _, block := range plan.Blocks {
		styleByID[block.StyleID] = block.Style
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

	for styleID, style := range styleByID {
		fontFamily := fontFamilies[style.Font]
		if fontFamily == "" {
			fontFamily = style.Font
			fontFamilies[style.Font] = fontFamily
		}
		primary, err := reelHexToASSColor(firstNonEmpty(style.Color, "#FFFFFF"), true)
		if err != nil {
			return err
		}
		outlineColor, err := reelHexToASSColor(firstNonEmpty(style.OutlineColor, "#000000"), true)
		if err != nil {
			return err
		}
		backColor, err := reelHexToASSColor("#000000", true)
		if err != nil {
			return err
		}
		sb.WriteString(fmt.Sprintf(
			"Style: %s,%s,%d,%s,%s,%s,%s,0,0,0,0,100,100,0,0,1,%d,%d,2,0,0,0,1\n",
			styleID,
			fontFamily,
			max(style.Size, 24),
			primary,
			primary,
			outlineColor,
			backColor,
			max(style.Outline, 1),
			max(style.Shadow, 0),
		))
	}

	sb.WriteString("\n[Events]\n")
	sb.WriteString("Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n")

	for _, block := range plan.Blocks {
		primaryColor := firstNonEmpty(block.Style.Color, "#FFFFFF")
		assText, err := verselineSpansToASS(block.Text, primaryColor, block.StylesByID)
		if err != nil {
			return err
		}
		text := verselinePlacementTag(plan.Width, plan.Height, block.Placement) + assText
		sb.WriteString(fmt.Sprintf(
			"Dialogue: 0,%s,%s,%s,,0,0,0,,%s\n",
			reelMillisToASSTs(block.Start),
			reelMillisToASSTs(block.End),
			block.StyleID,
			text,
		))
	}

	return os.WriteFile(plan.ASSPath, []byte(sb.String()), 0644)
}

func buildVerselineOverlayFilter(plan verselineRenderPlan, firstOverlayInput int) (string, string) {
	parts := []string{fmt.Sprintf("[0:v]%s[base0]", buildVerselineBaseFilter(plan))}
	current := "base0"
	for index, block := range plan.Blocks {
		overlayInput := firstOverlayInput + index
		next := fmt.Sprintf("base%d", index+1)
		parts = append(parts, fmt.Sprintf(
			"[%s][%d:v]overlay=%s:enable='between(t,%s,%s)'[%s]",
			current,
			overlayInput,
			verselineOverlayPosition(block.Placement),
			millisToSecsForFFmpeg(block.Start),
			millisToSecsForFFmpeg(block.End),
			next,
		))
		current = next
	}
	parts = append(parts, fmt.Sprintf("[%s]format=yuv420p[vout]", current))
	return strings.Join(parts, ";"), "[vout]"
}

func buildVerselineBaseFilter(plan verselineRenderPlan) string {
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
	return scale
}

func verselineOverlayPosition(placement VerselinePlacement) string {
	anchor := strings.NewReplacer("-", "_", " ", "_").Replace(strings.ToLower(strings.TrimSpace(placement.Anchor)))
	marginX := placement.MarginX
	marginY := placement.MarginY
	switch anchor {
	case "bottom_left":
		return fmt.Sprintf("x=%d:y=main_h-overlay_h-%d", marginX, marginY)
	case "bottom_right":
		return fmt.Sprintf("x=main_w-overlay_w-%d:y=main_h-overlay_h-%d", marginX, marginY)
	case "middle_left":
		return fmt.Sprintf("x=%d:y=(main_h-overlay_h)/2", marginX)
	case "middle_center", "center":
		return "x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2"
	case "middle_right":
		return fmt.Sprintf("x=main_w-overlay_w-%d:y=(main_h-overlay_h)/2", marginX)
	case "top_left":
		return fmt.Sprintf("x=%d:y=%d", marginX, marginY)
	case "top_center":
		return fmt.Sprintf("x=(main_w-overlay_w)/2:y=%d", marginY)
	case "top_right":
		return fmt.Sprintf("x=main_w-overlay_w-%d:y=%d", marginX, marginY)
	case "bottom_center", "":
		fallthrough
	default:
		return fmt.Sprintf("x=(main_w-overlay_w)/2:y=main_h-overlay_h-%d", marginY)
	}
}

func verselinePlacementTag(width, height int, placement VerselinePlacement) string {
	anchor := strings.NewReplacer("-", "_", " ", "_").Replace(strings.ToLower(strings.TrimSpace(placement.Anchor)))
	marginX := placement.MarginX
	marginY := placement.MarginY

	an := 2
	x := width / 2
	y := height - marginY

	switch anchor {
	case "bottom_left":
		an = 1
		x = max(marginX, 0)
		y = height - marginY
	case "bottom_center", "":
		an = 2
		x = width / 2
		y = height - marginY
	case "bottom_right":
		an = 3
		x = width - marginX
		y = height - marginY
	case "middle_left":
		an = 4
		x = max(marginX, 0)
		y = height / 2
	case "middle_center", "center":
		an = 5
		x = width / 2
		y = height / 2
	case "middle_right":
		an = 6
		x = width - marginX
		y = height / 2
	case "top_left":
		an = 7
		x = max(marginX, 0)
		y = marginY
	case "top_center":
		an = 8
		x = width / 2
		y = marginY
	case "top_right":
		an = 9
		x = width - marginX
		y = marginY
	}

	return fmt.Sprintf("{\\an%d\\pos(%d,%d)}", an, x, y)
}

func verselineFontsDir(projectDir string, fonts []VerselineFont) string {
	if len(fonts) == 0 {
		return ""
	}
	return projectDir
}

func renderVerselineBlockImages(plan *verselineRenderPlan) error {
	cacheDir := strings.TrimSuffix(plan.OutputPath, filepath.Ext(plan.OutputPath)) + ".layers"
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return err
	}

	for index := range plan.Blocks {
		outputPath := filepath.Join(cacheDir, fmt.Sprintf("block-%03d.png", index+1))
		_ = os.Remove(strings.TrimSuffix(outputPath, ".png") + ".txt")
		if err := renderVerselineBlockImage(plan.Blocks[index], plan.Width, outputPath); err != nil {
			return err
		}
		plan.Blocks[index].ImagePath = outputPath
	}
	return nil
}

func loadVerselineSourceEntries(path string, source VerselineSource) (map[string]string, error) {
	result := map[string]string{}
	format := strings.ToLower(strings.TrimSpace(source.Type))
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
		if err := collectVerselineSourceEntries(root, source, result); err != nil {
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
			if err := collectVerselineSourceEntries(entry, source, result); err != nil {
				return nil, fmt.Errorf("%s:%d: %w", path, lineNumber, err)
			}
		}
		if err := scanner.Err(); err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported source type %q", source.Type)
	}

	return result, nil
}

func collectVerselineSourceEntries(value interface{}, source VerselineSource, result map[string]string) error {
	switch node := value.(type) {
	case []interface{}:
		for _, item := range node {
			if err := collectVerselineSourceEntries(item, source, result); err != nil {
				return err
			}
		}
	case map[string]interface{}:
		for _, field := range []string{"items", "rows", "data", "entries", "verses"} {
			if nested, ok := node[field]; ok {
				switch nested.(type) {
				case []interface{}, map[string]interface{}:
					return collectVerselineSourceEntries(nested, source, result)
				}
			}
		}

		key, ok := extractVerselineSourceKey(node, source)
		if ok {
			text, ok := extractVerselineSourceText(node, source)
			if !ok {
				return fmt.Errorf("source entry is missing text")
			}
			result[key] = text
			return nil
		}

		keyedMap := false
		for key, nested := range node {
			switch key {
			case source.KeyField, source.TextField, "key", "id", "ref", "reference", "verse", "verse_key", "text", "translation", "content", "body", "value":
				continue
			}
			text, ok := extractVerselineSourceText(nested, source)
			if !ok {
				continue
			}
			result[key] = text
			keyedMap = true
		}
		if keyedMap {
			return nil
		}

		for _, nested := range node {
			switch nested.(type) {
			case []interface{}, map[string]interface{}:
				if err := collectVerselineSourceEntries(nested, source, result); err != nil {
					return err
				}
			}
		}
	case string:
		return nil
	}
	return nil
}

func extractVerselineSourceKey(node map[string]interface{}, source VerselineSource) (string, bool) {
	fields := []string{source.KeyField, "key", "id", "ref", "reference", "verse", "verse_key"}
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
		case string:
			value = strings.TrimSpace(value)
			return value, value != ""
		case float64:
			return strconv.Itoa(int(value)), true
		}
	}
	surah, surahOK := extractReelIntField(node, "surah", "sura", "surah_id", "chapter")
	ayah, ayahOK := extractReelIntField(node, "ayah", "aya", "ayah_number", "verse_number")
	if surahOK && ayahOK {
		return fmt.Sprintf("%d:%d", surah, ayah), true
	}
	return "", false
}

func extractVerselineSourceText(value interface{}, source VerselineSource) (string, bool) {
	switch node := value.(type) {
	case string:
		text := strings.TrimSpace(node)
		return text, text != ""
	case map[string]interface{}:
		fields := []string{source.TextField, "text", "translation", "content", "body", "value"}
		for _, field := range fields {
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
