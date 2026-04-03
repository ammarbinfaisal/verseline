package main

import (
	"fmt"
	"strconv"
	"strings"
	"unicode/utf8"
)

type verselineSegmentUpdates struct {
	Start          *string
	End            *string
	Status         *string
	Notes          *string
	BlockIndex     int
	BlockText      *string
	BlockStyle     *string
	BlockPlacement *string
}

func verselineOpsFindSegmentIndex(segments []VerselineSegment, segmentNumber int, segmentID string) (int, error) {
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

func verselineOpsUpdateSegment(project VerselineProject, segments []VerselineSegment, index int, updates verselineSegmentUpdates) ([]VerselineSegment, error) {
	if index < 0 || index >= len(segments) {
		return segments, fmt.Errorf("segment index %d out of range", index)
	}

	segment := segments[index]
	if updates.Start != nil {
		segment.Start = *updates.Start
	}
	if updates.End != nil {
		segment.End = *updates.End
	}
	if updates.Status != nil {
		segment.Status = *updates.Status
	}
	if updates.Notes != nil {
		segment.Notes = *updates.Notes
	}

	if updates.BlockText != nil || updates.BlockStyle != nil || updates.BlockPlacement != nil {
		blockIndex := updates.BlockIndex
		if blockIndex < 0 || blockIndex >= len(segment.Blocks) {
			return segments, fmt.Errorf("segment %d block %d is out of range", index+1, blockIndex+1)
		}
		if updates.BlockText != nil {
			segment.Blocks[blockIndex].Text = *updates.BlockText
		}
		if updates.BlockStyle != nil {
			segment.Blocks[blockIndex].Style = *updates.BlockStyle
		}
		if updates.BlockPlacement != nil {
			segment.Blocks[blockIndex].Placement = *updates.BlockPlacement
		}
	}

	segments[index] = segment
	if err := validateVerselineTimeline(segments); err != nil {
		return segments, err
	}
	if err := validateVerselineTimelineAgainstProject(project, segments); err != nil {
		return segments, err
	}
	return segments, nil
}

func verselineOpsDeleteSegment(segments []VerselineSegment, index int) ([]VerselineSegment, error) {
	if index < 0 || index >= len(segments) {
		return segments, fmt.Errorf("segment index %d out of range", index)
	}

	deleted := segments[index]
	deletedStart, err := tsToMillis(deleted.Start)
	if err != nil {
		return segments, err
	}
	deletedEnd, err := tsToMillis(deleted.End)
	if err != nil {
		return segments, err
	}
	gap := deletedEnd - deletedStart

	updated := make([]VerselineSegment, 0, len(segments)-1)
	updated = append(updated, segments[:index]...)
	updated = append(updated, segments[index+1:]...)

	for i := index; i < len(updated); i++ {
		segStart, err := tsToMillis(updated[i].Start)
		if err != nil {
			continue
		}
		segEnd, err := tsToMillis(updated[i].End)
		if err != nil {
			continue
		}
		updated[i].Start = millisToTs(segStart - gap)
		updated[i].End = millisToTs(segEnd - gap)
	}

	return updated, nil
}

func verselineOpsSetSegmentStatus(segments []VerselineSegment, index int, status string) []VerselineSegment {
	if index >= 0 && index < len(segments) {
		segments[index].Status = status
	}
	return segments
}

func verselineOpsSplitSegment(segment VerselineSegment, segmentIndex int, blockIndex int, texts []string) ([]VerselineSegment, error) {
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

func verselineOpsSanitizeSplitTexts(values []string) ([]string, error) {
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

func verselineOpsApplySplit(project VerselineProject, segments []VerselineSegment, index int, blockIndex int, texts []string) ([]VerselineSegment, error) {
	if index < 0 || index >= len(segments) {
		return segments, fmt.Errorf("segment index %d out of range", index)
	}
	if blockIndex < 0 || blockIndex >= len(segments[index].Blocks) {
		return segments, fmt.Errorf("segment %d block %d is out of range", index+1, blockIndex+1)
	}

	partTexts, err := verselineOpsSanitizeSplitTexts(texts)
	if err != nil {
		return segments, err
	}

	replacements, err := verselineOpsSplitSegment(segments[index], index, blockIndex, partTexts)
	if err != nil {
		return segments, err
	}

	updated := make([]VerselineSegment, 0, len(segments)-1+len(replacements))
	updated = append(updated, segments[:index]...)
	updated = append(updated, replacements...)
	updated = append(updated, segments[index+1:]...)

	if err := validateVerselineTimeline(updated); err != nil {
		return segments, err
	}
	if err := validateVerselineTimelineAgainstProject(project, updated); err != nil {
		return segments, err
	}
	return updated, nil
}

// --- Style operations ---

func verselineOpsAddStyle(project *VerselineProject, style VerselineStyle) error {
	if strings.TrimSpace(style.ID) == "" {
		return fmt.Errorf("style id is required")
	}
	for _, existing := range project.Styles {
		if existing.ID == style.ID {
			return fmt.Errorf("duplicate style id %q", style.ID)
		}
	}
	project.Styles = append(project.Styles, style)
	return nil
}

func verselineOpsDeleteStyle(project *VerselineProject, index int) error {
	if index < 0 || index >= len(project.Styles) {
		return fmt.Errorf("style index %d out of range", index)
	}
	project.Styles = append(project.Styles[:index], project.Styles[index+1:]...)
	return nil
}

func verselineOpsUpdateStyle(project *VerselineProject, index int, field string, value string) error {
	if index < 0 || index >= len(project.Styles) {
		return fmt.Errorf("style index %d out of range", index)
	}
	s := &project.Styles[index]
	switch field {
	case "id":
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("style id must not be empty")
		}
		for i, existing := range project.Styles {
			if i != index && existing.ID == value {
				return fmt.Errorf("duplicate style id %q", value)
			}
		}
		s.ID = value
	case "font":
		s.Font = value
	case "size":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid size: %w", err)
		}
		s.Size = n
	case "color":
		s.Color = value
	case "outline_color":
		s.OutlineColor = value
	case "outline":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid outline: %w", err)
		}
		s.Outline = n
	case "shadow_color":
		s.ShadowColor = value
	case "shadow":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid shadow: %w", err)
		}
		s.Shadow = n
	case "text_bg":
		s.TextBG = value
	case "text_bg_pad":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid text_bg_pad: %w", err)
		}
		s.TextBGPad = n
	case "text_bg_radius":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid text_bg_radius: %w", err)
		}
		s.TextBGRadius = n
	case "align":
		s.Align = value
	case "line_height":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid line_height: %w", err)
		}
		s.LineHeight = n
	default:
		return fmt.Errorf("unknown style field %q", field)
	}
	return nil
}

// --- Font operations ---

func verselineOpsAddFont(project *VerselineProject, font VerselineFont) error {
	if strings.TrimSpace(font.ID) == "" {
		return fmt.Errorf("font id is required")
	}
	for _, existing := range project.Fonts {
		if existing.ID == font.ID {
			return fmt.Errorf("duplicate font id %q", font.ID)
		}
	}
	project.Fonts = append(project.Fonts, font)
	return nil
}

func verselineOpsDeleteFont(project *VerselineProject, index int) error {
	if index < 0 || index >= len(project.Fonts) {
		return fmt.Errorf("font index %d out of range", index)
	}
	project.Fonts = append(project.Fonts[:index], project.Fonts[index+1:]...)
	return nil
}

func verselineOpsUpdateFont(project *VerselineProject, index int, field string, value string) error {
	if index < 0 || index >= len(project.Fonts) {
		return fmt.Errorf("font index %d out of range", index)
	}
	f := &project.Fonts[index]
	switch field {
	case "id":
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("font id must not be empty")
		}
		for i, existing := range project.Fonts {
			if i != index && existing.ID == value {
				return fmt.Errorf("duplicate font id %q", value)
			}
		}
		f.ID = value
	case "family":
		f.Family = value
	case "files":
		f.Files = verselineSplitCSV(value)
	default:
		return fmt.Errorf("unknown font field %q", field)
	}
	return nil
}

// --- Placement operations ---

func verselineOpsAddPlacement(project *VerselineProject, placement VerselinePlacement) error {
	if strings.TrimSpace(placement.ID) == "" {
		return fmt.Errorf("placement id is required")
	}
	for _, existing := range project.Placements {
		if existing.ID == placement.ID {
			return fmt.Errorf("duplicate placement id %q", placement.ID)
		}
	}
	project.Placements = append(project.Placements, placement)
	return nil
}

func verselineOpsDeletePlacement(project *VerselineProject, index int) error {
	if index < 0 || index >= len(project.Placements) {
		return fmt.Errorf("placement index %d out of range", index)
	}
	project.Placements = append(project.Placements[:index], project.Placements[index+1:]...)
	return nil
}

func verselineOpsUpdatePlacement(project *VerselineProject, index int, field string, value string) error {
	if index < 0 || index >= len(project.Placements) {
		return fmt.Errorf("placement index %d out of range", index)
	}
	p := &project.Placements[index]
	switch field {
	case "id":
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("placement id must not be empty")
		}
		for i, existing := range project.Placements {
			if i != index && existing.ID == value {
				return fmt.Errorf("duplicate placement id %q", value)
			}
		}
		p.ID = value
	case "anchor":
		p.Anchor = value
	case "margin_x":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid margin_x: %w", err)
		}
		p.MarginX = n
	case "margin_y":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid margin_y: %w", err)
		}
		p.MarginY = n
	case "max_width":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid max_width: %w", err)
		}
		p.MaxWidth = n
	case "max_height":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid max_height: %w", err)
		}
		p.MaxHeight = n
	default:
		return fmt.Errorf("unknown placement field %q", field)
	}
	return nil
}

// --- Project field operations ---

func verselineOpsUpdateProjectField(project *VerselineProject, field string, value string) error {
	switch field {
	case "name":
		project.Name = value
	case "output":
		project.Output = value
	case "canvas.width":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid canvas.width: %w", err)
		}
		project.Canvas.Width = n
	case "canvas.height":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid canvas.height: %w", err)
		}
		project.Canvas.Height = n
	case "canvas.fps":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid canvas.fps: %w", err)
		}
		project.Canvas.FPS = n
	case "assets.audio":
		project.Assets.Audio = value
	case "assets.background.path":
		project.Assets.Background.Path = value
	case "assets.background.type":
		project.Assets.Background.Type = value
	case "assets.background.fit":
		project.Assets.Background.Fit = value
	case "preview.player":
		project.Preview.Player = value
	case "preview.directory":
		project.Preview.Directory = value
	case "preview.padding_ms":
		n, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("invalid preview.padding_ms: %w", err)
		}
		project.Preview.PaddingMS = n
	case "timeline":
		project.Timeline = value
	default:
		return fmt.Errorf("unknown project field %q", field)
	}
	return nil
}
