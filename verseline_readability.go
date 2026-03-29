package main

import (
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type verselineReadabilityBlock struct {
	BlockIndex      int      `json:"block_index"`
	StyleID         string   `json:"style_id"`
	PlacementID     string   `json:"placement_id"`
	TextColor       string   `json:"text_color"`
	SampledBGColor  string   `json:"sampled_bg_color"`
	ContrastRatio   float64  `json:"contrast_ratio"`
	MeetsWCAG_AA    bool     `json:"meets_wcag_aa"`
	MeetsWCAG_AAA   bool     `json:"meets_wcag_aaa"`
	HasOutline      bool     `json:"has_outline"`
	HasShadow       bool     `json:"has_shadow"`
	HasTextBG       bool     `json:"has_text_bg"`
	Recommendations []string `json:"recommendations,omitempty"`
}

// analyzeVerselineReadability loads the project background and checks contrast
// for each block in the given segment at the specified timestamp.
func analyzeVerselineReadability(
	project VerselineProject,
	absProjectPath string,
	segment VerselineSegment,
	timestamp Millis,
) ([]verselineReadabilityBlock, error) {
	projectDir := filepath.Dir(absProjectPath)
	bgPath := resolveReelPath(projectDir, project.Assets.Background.Path)
	bgType := strings.ToLower(strings.TrimSpace(project.Assets.Background.Type))

	var bgImage image.Image
	var err error
	if bgType == "video" {
		bgImage, err = verselineExtractVideoFrame(bgPath, timestamp)
	} else {
		bgImage, err = verselineLoadBackgroundImage(bgPath)
	}
	if err != nil {
		return nil, fmt.Errorf("load background: %w", err)
	}

	styleByID := map[string]VerselineStyle{}
	for _, style := range project.Styles {
		styleByID[style.ID] = style
	}
	placementByID := map[string]VerselinePlacement{}
	for _, placement := range project.Placements {
		placementByID[placement.ID] = placement
	}

	resolved := make([]verselineResolvedBlock, 0, len(segment.Blocks))
	for _, block := range segment.Blocks {
		styleID := strings.TrimSpace(block.Style)
		if styleID == "" && len(project.Styles) > 0 {
			styleID = project.Styles[0].ID
		}
		placementID := strings.TrimSpace(block.Placement)
		if placementID == "" && len(project.Placements) > 0 {
			placementID = project.Placements[0].ID
		}
		resolved = append(resolved, verselineResolvedBlock{
			StyleID:   styleID,
			Style:     styleByID[styleID],
			Placement: placementByID[placementID],
			Text:      block.Text,
		})
	}

	return checkVerselineReadability(bgImage, project.Canvas.Width, project.Canvas.Height, resolved), nil
}

func checkVerselineReadability(
	bgImage image.Image,
	canvasWidth int,
	canvasHeight int,
	blocks []verselineResolvedBlock,
) []verselineReadabilityBlock {
	results := make([]verselineReadabilityBlock, 0, len(blocks))

	for i, block := range blocks {
		region := verselinePlacementRegion(block.Placement, canvasWidth, canvasHeight)
		sampledColor := verselineSampleBackgroundRegion(bgImage, canvasWidth, canvasHeight, region)

		textColor, err := verselineParseHexColor(firstNonEmpty(block.Style.Color, "#FFFFFF"), 255)
		if err != nil {
			textColor = color.NRGBA{255, 255, 255, 255}
		}

		ratio := verselineWCAGContrastRatio(textColor, sampledColor)

		// Large-text WCAG thresholds (subtitle/overlay text is typically ≥18pt).
		meetsAA := ratio >= 3.0
		meetsAAA := ratio >= 4.5

		hasOutline := block.Style.Outline > 0
		hasShadow := block.Style.Shadow > 0
		hasTextBG := strings.TrimSpace(block.Style.TextBG) != ""

		var recs []string
		if !meetsAA {
			if !hasOutline {
				recs = append(recs, "add outline (outline: 2-4, outline_color: contrasting color)")
			}
			if !hasShadow {
				recs = append(recs, "add shadow (shadow: 2-4, shadow_color: contrasting color)")
			}
			if !hasTextBG {
				recs = append(recs, "add text background (text_bg: semi-transparent color, text_bg_pad: 8-16, text_bg_radius: 8-16)")
			}
		} else if !meetsAAA {
			if !hasOutline && !hasTextBG {
				recs = append(recs, "consider adding outline or text_bg for improved readability")
			}
		}

		results = append(results, verselineReadabilityBlock{
			BlockIndex:      i + 1,
			StyleID:         block.StyleID,
			PlacementID:     block.Placement.ID,
			TextColor:       firstNonEmpty(block.Style.Color, "#FFFFFF"),
			SampledBGColor:  verselineColorToHex(sampledColor),
			ContrastRatio:   math.Round(ratio*100) / 100,
			MeetsWCAG_AA:    meetsAA,
			MeetsWCAG_AAA:   meetsAAA,
			HasOutline:      hasOutline,
			HasShadow:       hasShadow,
			HasTextBG:       hasTextBG,
			Recommendations: recs,
		})
	}

	return results
}

func verselinePlacementRegion(placement VerselinePlacement, canvasWidth, canvasHeight int) image.Rectangle {
	maxW := placement.MaxWidth
	if maxW <= 0 {
		maxW = max(canvasWidth-2*placement.MarginX, 200)
	}
	maxH := placement.MaxHeight
	if maxH <= 0 {
		maxH = canvasHeight / 3
	}

	anchor := strings.NewReplacer("-", "_", " ", "_").Replace(strings.ToLower(strings.TrimSpace(placement.Anchor)))

	var x, y int
	switch anchor {
	case "top_left":
		x = placement.MarginX
		y = placement.MarginY
	case "top_center":
		x = (canvasWidth - maxW) / 2
		y = placement.MarginY
	case "top_right":
		x = canvasWidth - maxW - placement.MarginX
		y = placement.MarginY
	case "middle_left":
		x = placement.MarginX
		y = (canvasHeight - maxH) / 2
	case "middle_center", "center":
		x = (canvasWidth - maxW) / 2
		y = (canvasHeight - maxH) / 2
	case "middle_right":
		x = canvasWidth - maxW - placement.MarginX
		y = (canvasHeight - maxH) / 2
	case "bottom_left":
		x = placement.MarginX
		y = canvasHeight - maxH - placement.MarginY
	case "bottom_right":
		x = canvasWidth - maxW - placement.MarginX
		y = canvasHeight - maxH - placement.MarginY
	default: // bottom_center
		x = (canvasWidth - maxW) / 2
		y = canvasHeight - maxH - placement.MarginY
	}

	return image.Rect(max(x, 0), max(y, 0), min(x+maxW, canvasWidth), min(y+maxH, canvasHeight))
}

func verselineSampleBackgroundRegion(img image.Image, canvasWidth, canvasHeight int, region image.Rectangle) color.NRGBA {
	bounds := img.Bounds()
	imgW := bounds.Dx()
	imgH := bounds.Dy()

	if imgW == 0 || imgH == 0 || canvasWidth == 0 || canvasHeight == 0 {
		return color.NRGBA{0, 0, 0, 255}
	}

	scaleX := float64(imgW) / float64(canvasWidth)
	scaleY := float64(imgH) / float64(canvasHeight)

	imgRegion := image.Rect(
		bounds.Min.X+int(float64(region.Min.X)*scaleX),
		bounds.Min.Y+int(float64(region.Min.Y)*scaleY),
		bounds.Min.X+int(float64(region.Max.X)*scaleX),
		bounds.Min.Y+int(float64(region.Max.Y)*scaleY),
	)
	imgRegion = imgRegion.Intersect(bounds)

	if imgRegion.Empty() {
		return color.NRGBA{0, 0, 0, 255}
	}

	var r, g, b float64
	count := 0
	// Sample at most ~1024 pixels for performance.
	stepX := max((imgRegion.Dx()+31)/32, 1)
	stepY := max((imgRegion.Dy()+31)/32, 1)

	for y := imgRegion.Min.Y; y < imgRegion.Max.Y; y += stepY {
		for x := imgRegion.Min.X; x < imgRegion.Max.X; x += stepX {
			cr, cg, cb, _ := img.At(x, y).RGBA()
			r += float64(cr) / 65535.0
			g += float64(cg) / 65535.0
			b += float64(cb) / 65535.0
			count++
		}
	}

	if count == 0 {
		return color.NRGBA{0, 0, 0, 255}
	}

	return color.NRGBA{
		R: uint8(r / float64(count) * 255),
		G: uint8(g / float64(count) * 255),
		B: uint8(b / float64(count) * 255),
		A: 255,
	}
}

func verselineLoadBackgroundImage(path string) (image.Image, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open background: %w", err)
	}
	defer f.Close()

	img, _, err := image.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("decode background: %w", err)
	}
	return img, nil
}

func verselineExtractVideoFrame(videoPath string, timestampMs Millis) (image.Image, error) {
	tmpFile, err := os.CreateTemp("", "verseline-frame-*.png")
	if err != nil {
		return nil, err
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	ts := millisToSecsForFFmpeg(timestampMs)
	ffmpeg := ffmpegPathToBin()
	cmd := exec.Command(ffmpeg, "-y", "-ss", ts, "-i", videoPath, "-frames:v", "1", "-f", "image2", tmpPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("extract frame at %s: %w: %s", ts, err, string(output))
	}

	return verselineLoadBackgroundImage(tmpPath)
}

func verselineWCAGContrastRatio(fg, bg color.NRGBA) float64 {
	l1 := verselineRelativeLuminance(fg)
	l2 := verselineRelativeLuminance(bg)
	if l1 < l2 {
		l1, l2 = l2, l1
	}
	return (l1 + 0.05) / (l2 + 0.05)
}

func verselineRelativeLuminance(c color.NRGBA) float64 {
	r := verselineSRGBToLinear(float64(c.R) / 255.0)
	g := verselineSRGBToLinear(float64(c.G) / 255.0)
	b := verselineSRGBToLinear(float64(c.B) / 255.0)
	return 0.2126*r + 0.7152*g + 0.0722*b
}

func verselineSRGBToLinear(v float64) float64 {
	if v <= 0.04045 {
		return v / 12.92
	}
	return math.Pow((v+0.055)/1.055, 2.4)
}

func verselineColorToHex(c color.NRGBA) string {
	return fmt.Sprintf("#%02X%02X%02X", c.R, c.G, c.B)
}
