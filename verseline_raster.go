package main

import (
	"encoding/hex"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"unicode"

	textdraw "github.com/go-text/render"
	"github.com/go-text/typesetting/di"
	textfont "github.com/go-text/typesetting/font"
	"github.com/go-text/typesetting/language"
	"github.com/go-text/typesetting/shaping"
	"golang.org/x/image/math/fixed"
)

type verselineRasterLine struct {
	Runs           []shaping.Output
	Width          int
	Ascent         int
	Descent        int
	Height         int
	RuneOffset     int // offset of this line's paragraph in the full plain text (for runeColors indexing)
}

type verselineFontMap struct {
	face *textfont.Face
}

func (fm verselineFontMap) ResolveFace(rune) *textfont.Face {
	return fm.face
}

var (
	verselineFontPathCache sync.Map
	verselineFaceCache     sync.Map
)

func renderVerselineBlockImage(block verselineResolvedBlock, canvasWidth int, outputPath string) error {
	maxWidth := block.Placement.MaxWidth
	if maxWidth <= 0 {
		maxWidth = max(canvasWidth-2*block.Placement.MarginX, 200)
	}

	if err := renderVerselineBlockImageGoText(block, maxWidth, outputPath); err == nil {
		return nil
	}

	return renderVerselineBlockImageMagick(block, maxWidth, outputPath)
}

func renderVerselineBlockImageGoText(block verselineResolvedBlock, maxWidth int, outputPath string) error {
	fontPath, face, err := verselineResolveRasterFace(block)
	if err != nil {
		return err
	}

	// Parse inline style tags and build per-rune color map.
	spans := verselineParseTextSpans(block.Text)
	plainText := verselineStripStyleTags(block.Text)
	primaryHex := firstNonEmpty(block.Style.Color, "#FFFFFF")
	runeColors := verselineRuneColors(spans, primaryHex, block.StylesByID)

	if !verselineFaceSupportsText(face, plainText) {
		return fmt.Errorf("font %q does not cover block text", fontPath)
	}

	lines, err := verselineWrapTextLines(plainText, face, max(block.Style.Size, 1), maxWidth)
	if err != nil {
		return err
	}
	if len(lines) == 0 {
		return fmt.Errorf("no raster lines produced")
	}

	effectPad := max(4, block.Style.Outline+block.Style.Shadow+2)
	bgPad := 0
	hasTextBG := strings.TrimSpace(block.Style.TextBG) != ""
	if hasTextBG {
		bgPad = max(block.Style.TextBGPad, 4)
	}
	pad := effectPad + bgPad
	imageWidth := pad * 2
	imageHeight := pad * 2
	for _, line := range lines {
		imageWidth = max(imageWidth, line.Width+pad*2)
		imageHeight += max(line.Height, 1)
	}

	img := image.NewNRGBA(image.Rect(0, 0, imageWidth, imageHeight))

	if hasTextBG {
		bgColor, bgErr := verselineParseHexColor(block.Style.TextBG, 200)
		if bgErr == nil {
			bgRect := image.Rect(effectPad, effectPad, imageWidth-effectPad, imageHeight-effectPad)
			bgRadius := min(block.Style.TextBGRadius, min(bgRect.Dx()/2, bgRect.Dy()/2))
			verselineDrawRoundedRect(img, bgRect, bgRadius, bgColor)
		}
	}

	fillColor, err := verselineParseHexColor(primaryHex, 255)
	if err != nil {
		return err
	}
	outlineColor, err := verselineParseHexColor(firstNonEmpty(block.Style.OutlineColor, "#000000"), 255)
	if err != nil {
		return err
	}
	shadowColor := color.NRGBA{R: outlineColor.R, G: outlineColor.G, B: outlineColor.B, A: 170}
	if strings.TrimSpace(block.Style.ShadowColor) != "" {
		if sc, scErr := verselineParseHexColor(block.Style.ShadowColor, 170); scErr == nil {
			shadowColor = sc
		}
	}

	renderer := &textdraw.Renderer{
		FontSize: float32(max(block.Style.Size, 1)),
		PixScale: 1,
		Color:    fillColor,
	}

	y := pad
	for _, line := range lines {
		baselineY := y + line.Ascent
		contentWidth := imageWidth - pad*2
		var x int
		switch strings.ToLower(strings.TrimSpace(block.Style.Align)) {
		case "left":
			x = pad
		case "right":
			x = pad + max(contentWidth-line.Width, 0)
		default: // center
			x = pad + max(contentWidth-line.Width, 0)/2
		}

		// Shadow pass — single color.
		if block.Style.Shadow > 0 {
			renderer.Color = shadowColor
			verselineDrawLine(renderer, line, img, x+block.Style.Shadow, baselineY+block.Style.Shadow)
		}
		// Outline pass — single color.
		if block.Style.Outline > 0 {
			renderer.Color = outlineColor
			for dy := -block.Style.Outline; dy <= block.Style.Outline; dy++ {
				for dx := -block.Style.Outline; dx <= block.Style.Outline; dx++ {
					if dx == 0 && dy == 0 {
						continue
					}
					if dx*dx+dy*dy > block.Style.Outline*block.Style.Outline {
						continue
					}
					verselineDrawLine(renderer, line, img, x+dx, baselineY+dy)
				}
			}
		}

		// Fill pass — per-run colors from inline style tags.
		verselineDrawLineColored(renderer, line, img, x, baselineY, fillColor, runeColors)
		y += max(line.Height, 1)
	}

	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}
	file, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer file.Close()

	return png.Encode(file, img)
}

func renderVerselineBlockImageMagick(block verselineResolvedBlock, maxWidth int, outputPath string) error {
	plainText := verselineStripStyleTags(block.Text)
	textPath := strings.TrimSuffix(outputPath, ".png") + ".txt"
	if err := os.WriteFile(textPath, []byte(plainText), 0644); err != nil {
		return err
	}

	args := []string{
		"-background", "none",
		"-fill", firstNonEmpty(block.Style.Color, "#FFFFFF"),
		"-gravity", verselineAlignToGravity(block.Style.Align),
		"-pointsize", strconv.Itoa(max(block.Style.Size, 24)),
	}
	if block.FontFile != "" {
		args = append(args, "-font", block.FontFile)
	} else if strings.TrimSpace(block.Style.Font) != "" {
		args = append(args, "-font", block.Style.Font)
	}
	if strings.TrimSpace(block.Style.OutlineColor) != "" && block.Style.Outline > 0 {
		args = append(args, "-stroke", block.Style.OutlineColor, "-strokewidth", strconv.Itoa(block.Style.Outline))
	}
	args = append(args, "-size", fmt.Sprintf("%dx", maxWidth), "caption:@"+textPath, "PNG32:"+outputPath)

	cmd := exec.Command("magick", args...)
	out, err := cmd.CombinedOutput()
	if err != nil && len(out) > 0 {
		verselineLog("[MAGICK STDERR] %s", string(out))
	}
	return err
}

func verselineResolveRasterFace(block verselineResolvedBlock) (string, *textfont.Face, error) {
	fontPath := strings.TrimSpace(block.FontFile)
	if fontPath == "" {
		var err error
		fontPath, err = verselineResolveSystemFontPath(block.Style.Font)
		if err != nil {
			return "", nil, err
		}
	}

	face, err := verselineLoadFace(fontPath)
	if err != nil {
		return fontPath, nil, err
	}
	return fontPath, face, nil
}

func verselineResolveSystemFontPath(family string) (string, error) {
	family = strings.TrimSpace(family)
	if family == "" {
		return "", fmt.Errorf("style has no font family")
	}
	if cached, ok := verselineFontPathCache.Load(family); ok {
		return cached.(string), nil
	}

	cmd := exec.Command("fc-match", "-f", "%{file}\n", family)
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("fc-match %q: %w", family, err)
	}
	path := strings.TrimSpace(string(output))
	if path == "" {
		return "", fmt.Errorf("no system font file found for %q", family)
	}
	verselineFontPathCache.Store(family, path)
	return path, nil
}

func verselineLoadFace(fontPath string) (*textfont.Face, error) {
	if cached, ok := verselineFaceCache.Load(fontPath); ok {
		return cached.(*textfont.Face), nil
	}

	file, err := os.Open(fontPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	faces, err := textfont.ParseTTC(file)
	if err != nil {
		return nil, err
	}
	if len(faces) == 0 {
		return nil, fmt.Errorf("font file %q contains no faces", fontPath)
	}
	verselineFaceCache.Store(fontPath, faces[0])
	return faces[0], nil
}

func verselineFaceSupportsText(face *textfont.Face, text string) bool {
	for _, r := range text {
		if r == '\n' || unicode.IsSpace(r) {
			continue
		}
		if _, ok := face.NominalGlyph(r); !ok {
			return false
		}
	}
	return true
}

func verselineWrapTextLines(text string, face *textfont.Face, size int, maxWidth int) ([]verselineRasterLine, error) {
	paragraphs := strings.Split(text, "\n")
	if len(paragraphs) == 0 {
		paragraphs = []string{text}
	}

	lines := make([]verselineRasterLine, 0, len(paragraphs))
	runeOffset := 0
	for i, paragraph := range paragraphs {
		paragraphLines, err := verselineWrapParagraph(paragraph, face, size, maxWidth)
		if err != nil {
			return nil, err
		}
		for j := range paragraphLines {
			paragraphLines[j].RuneOffset = runeOffset
		}
		lines = append(lines, paragraphLines...)
		runeOffset += len([]rune(paragraph))
		if i < len(paragraphs)-1 {
			runeOffset++ // account for the '\n'
		}
	}
	return lines, nil
}

func verselineWrapParagraph(text string, face *textfont.Face, size int, maxWidth int) ([]verselineRasterLine, error) {
	if text == "" {
		height := max(size, 1)
		return []verselineRasterLine{{Width: 0, Ascent: height, Descent: 0, Height: height}}, nil
	}

	runes := []rune(text)
	direction, script, lang := verselineTextDirection(runes)
	input := shaping.Input{
		Text:      runes,
		RunStart:  0,
		RunEnd:    len(runes),
		Face:      face,
		Size:      fixed.I(size),
		Direction: direction,
		Script:    script,
		Language:  lang,
	}

	var seg shaping.Segmenter
	runs := seg.Split(input, verselineFontMap{face: face})
	shapedRuns := make([]shaping.Output, len(runs))
	for i, run := range runs {
		var shaper shaping.HarfbuzzShaper
		shapedRuns[i] = shaper.Shape(run)
	}

	var wrapper shaping.LineWrapper
	wrapped, _ := wrapper.WrapParagraph(shaping.WrapConfig{Direction: direction}, maxWidth, runes, shaping.NewSliceIterator(shapedRuns))
	if len(wrapped) == 0 {
		return []verselineRasterLine{{Width: 0, Ascent: size, Descent: 0, Height: size}}, nil
	}

	lines := make([]verselineRasterLine, 0, len(wrapped))
	for _, wrappedLine := range wrapped {
		runs := append([]shaping.Output(nil), wrappedLine...)
		sort.Slice(runs, func(i, j int) bool {
			return runs[i].VisualIndex < runs[j].VisualIndex
		})

		line := verselineRasterLine{}
		for _, run := range runs {
			line.Width += run.Advance.Ceil()
			line.Ascent = max(line.Ascent, run.LineBounds.Ascent.Ceil())
			line.Descent = max(line.Descent, -run.LineBounds.Descent.Floor())
		}
		if line.Ascent == 0 && line.Descent == 0 {
			line.Ascent = size
		}
		line.Height = line.Ascent + line.Descent
		line.Runs = runs
		lines = append(lines, line)
	}

	return lines, nil
}

func verselineTextDirection(runes []rune) (di.Direction, language.Script, language.Language) {
	for _, r := range runes {
		if unicode.IsSpace(r) {
			continue
		}
		if verselineIsArabicRune(r) {
			return di.DirectionRTL, language.Arabic, language.NewLanguage("AR")
		}
		break
	}
	return di.DirectionLTR, language.Latin, language.NewLanguage("EN")
}

func verselineIsArabicRune(r rune) bool {
	return unicode.In(r, unicode.Arabic)
}

// verselineDrawLine draws a full line of shaped runs in the renderer's current
// color. Used for shadow and outline passes.
func verselineDrawLine(renderer *textdraw.Renderer, line verselineRasterLine, img *image.NRGBA, x, baselineY int) {
	cursor := x
	for _, run := range line.Runs {
		cursor = renderer.DrawShapedRunAt(run, img, cursor, baselineY)
	}
}

// verselineDrawLineColored draws a line with per-glyph color switching based
// on the runeColors slice (one hex color string per rune in the full plain
// text). Each glyph's color is looked up via its ClusterIndex. The fallback
// is used when runeColors is nil, too short, or a color fails to parse.
func verselineDrawLineColored(renderer *textdraw.Renderer, line verselineRasterLine, img *image.NRGBA, x, baselineY int, fallback color.NRGBA, runeColors []string) {
	if len(runeColors) == 0 {
		renderer.Color = fallback
		verselineDrawLine(renderer, line, img, x, baselineY)
		return
	}

	cursor := x
	for _, run := range line.Runs {
		// Split the run into sub-runs of consecutive glyphs sharing the same
		// color so each sub-run can be drawn with DrawShapedRunAt.
		type colorRun struct {
			start, end int // glyph indices [start, end)
			color      color.NRGBA
		}
		var groups []colorRun
		for i, g := range run.Glyphs {
			idx := line.RuneOffset + g.ClusterIndex
			c := fallback
			if idx >= 0 && idx < len(runeColors) {
				if parsed, err := verselineParseHexColor(runeColors[idx], 255); err == nil {
					c = parsed
				}
			}
			if len(groups) > 0 && groups[len(groups)-1].color == c {
				groups[len(groups)-1].end = i + 1
			} else {
				groups = append(groups, colorRun{start: i, end: i + 1, color: c})
			}
		}

		for _, gr := range groups {
			sub := run
			sub.Glyphs = run.Glyphs[gr.start:gr.end]
			sub.Advance = 0
			for _, g := range sub.Glyphs {
				sub.Advance += g.Advance
			}
			renderer.Color = gr.color
			cursor = renderer.DrawShapedRunAt(sub, img, cursor, baselineY)
		}
	}
}

func verselineParseHexColor(value string, alpha uint8) (color.NRGBA, error) {
	trimmed := strings.TrimSpace(strings.TrimPrefix(value, "#"))
	switch len(trimmed) {
	case 6:
		raw, err := hex.DecodeString(trimmed)
		if err != nil {
			return color.NRGBA{}, err
		}
		return color.NRGBA{R: raw[0], G: raw[1], B: raw[2], A: alpha}, nil
	case 8:
		raw, err := hex.DecodeString(trimmed)
		if err != nil {
			return color.NRGBA{}, err
		}
		return color.NRGBA{R: raw[0], G: raw[1], B: raw[2], A: raw[3]}, nil
	default:
		return color.NRGBA{}, fmt.Errorf("unsupported hex color %q", value)
	}
}

// verselineDrawRoundedRect fills a rounded rectangle on img. The radius is
// clamped so it never exceeds half the rectangle's smaller dimension.
func verselineDrawRoundedRect(img *image.NRGBA, rect image.Rectangle, radius int, fill color.NRGBA) {
	w := rect.Dx()
	h := rect.Dy()
	if w <= 0 || h <= 0 {
		return
	}
	if radius <= 0 {
		for py := rect.Min.Y; py < rect.Max.Y; py++ {
			for px := rect.Min.X; px < rect.Max.X; px++ {
				img.SetNRGBA(px, py, fill)
			}
		}
		return
	}

	r := float64(min(radius, min(w/2, h/2)))
	hw := float64(w) / 2
	hh := float64(h) / 2

	for py := rect.Min.Y; py < rect.Max.Y; py++ {
		for px := rect.Min.X; px < rect.Max.X; px++ {
			lx := float64(px-rect.Min.X) + 0.5
			ly := float64(py-rect.Min.Y) + 0.5
			dx := math.Max(math.Abs(lx-hw)-(hw-r), 0)
			dy := math.Max(math.Abs(ly-hh)-(hh-r), 0)
			if dx*dx+dy*dy <= r*r {
				img.SetNRGBA(px, py, fill)
			}
		}
	}
}

func verselineAlignToGravity(align string) string {
	switch strings.ToLower(strings.TrimSpace(align)) {
	case "left":
		return "west"
	case "right":
		return "east"
	default:
		return "center"
	}
}
