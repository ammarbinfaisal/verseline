package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

type verselineDraftEntry struct {
	ID         string
	Start      string
	End        string
	Text       string
	Refs       []string
	Status     string
	Notes      string
	Confidence float64
}

type verselineDraftGenerationOptions struct {
	PrimarySourceID    string
	PrimaryStyle       string
	PrimaryPlacement   string
	SecondarySourceID  string
	SecondaryStyle     string
	SecondaryPlacement string
	DefaultStatus      string
	SplitMaxChars      int
}

func loadVerselineDraftEntries(projectPath string, transcriptPath string) ([]verselineDraftEntry, string, error) {
	projectDir := filepath.Dir(projectPath)
	resolvedPath := resolveReelPath(projectDir, transcriptPath)
	content, err := os.ReadFile(resolvedPath)
	if err != nil {
		return nil, "", err
	}

	trimmed := strings.TrimSpace(string(content))
	if trimmed == "" {
		return nil, "", fmt.Errorf("transcript file is empty")
	}

	if strings.HasPrefix(trimmed, "[") || strings.HasPrefix(trimmed, "{") {
		var root interface{}
		if err := json.Unmarshal(content, &root); err != nil {
			return nil, "", err
		}
		entries := []verselineDraftEntry{}
		if err := collectVerselineDraftEntries(root, &entries); err != nil {
			return nil, "", err
		}
		if len(entries) == 0 {
			return nil, "", fmt.Errorf("no transcript entries found")
		}
		return entries, resolvedPath, nil
	}

	file, err := os.Open(resolvedPath)
	if err != nil {
		return nil, "", err
	}
	defer file.Close()

	entries := []verselineDraftEntry{}
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber += 1
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var node interface{}
		if err := json.Unmarshal([]byte(line), &node); err != nil {
			return nil, "", fmt.Errorf("%s:%d: %w", resolvedPath, lineNumber, err)
		}
		if err := collectVerselineDraftEntries(node, &entries); err != nil {
			return nil, "", fmt.Errorf("%s:%d: %w", resolvedPath, lineNumber, err)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, "", err
	}
	if len(entries) == 0 {
		return nil, "", fmt.Errorf("no transcript entries found")
	}
	return entries, resolvedPath, nil
}

func collectVerselineDraftEntries(value interface{}, entries *[]verselineDraftEntry) error {
	switch node := value.(type) {
	case []interface{}:
		for _, item := range node {
			if err := collectVerselineDraftEntries(item, entries); err != nil {
				return err
			}
		}
	case map[string]interface{}:
		for _, field := range []string{"segments", "entries", "items", "results", "chunks", "data"} {
			nested, ok := node[field]
			if !ok {
				continue
			}
			switch nested.(type) {
			case []interface{}, map[string]interface{}:
				return collectVerselineDraftEntries(nested, entries)
			}
		}

		entry, ok, err := parseVerselineDraftEntryMap(node)
		if err != nil {
			return err
		}
		if ok {
			*entries = append(*entries, entry)
		}
	}
	return nil
}

func parseVerselineDraftEntryMap(node map[string]interface{}) (verselineDraftEntry, bool, error) {
	start, startOK, err := extractVerselineDraftTimestamp(node, "start", "start_time", "start_ts", "start_ms")
	if err != nil {
		return verselineDraftEntry{}, false, err
	}
	end, endOK, err := extractVerselineDraftTimestamp(node, "end", "end_time", "end_ts", "end_ms")
	if err != nil {
		return verselineDraftEntry{}, false, err
	}
	if !startOK && !endOK {
		return verselineDraftEntry{}, false, nil
	}
	if !startOK || !endOK {
		return verselineDraftEntry{}, false, fmt.Errorf("entry must include both start and end")
	}

	entry := verselineDraftEntry{
		ID:         extractVerselineDraftString(node, "id", "segment_id"),
		Start:      start,
		End:        end,
		Text:       extractVerselineDraftString(node, "text", "translation", "content", "body"),
		Refs:       extractVerselineDraftRefs(node, "refs", "references"),
		Status:     extractVerselineDraftString(node, "status"),
		Notes:      extractVerselineDraftString(node, "notes"),
		Confidence: extractVerselineDraftFloat(node, "confidence"),
	}
	if len(entry.Refs) == 0 {
		if ref := extractVerselineDraftString(node, "ref", "reference", "verse", "verse_key"); strings.TrimSpace(ref) != "" {
			entry.Refs = []string{ref}
		}
	}
	return entry, true, nil
}

func normalizeVerselineDraftEntries(entries []verselineDraftEntry) ([]verselineDraftEntry, error) {
	result := make([]verselineDraftEntry, 0, len(entries))
	for index, entry := range entries {
		entry.Start = strings.TrimSpace(entry.Start)
		entry.End = strings.TrimSpace(entry.End)
		entry.Text = strings.TrimSpace(entry.Text)
		entry.Status = strings.TrimSpace(entry.Status)
		entry.Notes = strings.TrimSpace(entry.Notes)
		if entry.Start == "" || entry.End == "" {
			return nil, fmt.Errorf("entry %d: start and end are required", index)
		}
		if _, err := tsToMillis(entry.Start); err != nil {
			return nil, fmt.Errorf("entry %d: invalid start: %w", index, err)
		}
		if _, err := tsToMillis(entry.End); err != nil {
			return nil, fmt.Errorf("entry %d: invalid end: %w", index, err)
		}
		for refIndex, ref := range entry.Refs {
			entry.Refs[refIndex] = strings.TrimSpace(ref)
		}
		result = append(result, entry)
	}
	return result, nil
}

func generateVerselineDraftTimeline(entries []verselineDraftEntry, options verselineDraftGenerationOptions) ([]VerselineSegment, error) {
	normalized, err := normalizeVerselineDraftEntries(entries)
	if err != nil {
		return nil, err
	}

	expanded := make([]verselineDraftEntry, 0, len(normalized))
	for _, entry := range normalized {
		splitEntries, err := splitVerselineDraftEntry(entry, options.SplitMaxChars)
		if err != nil {
			return nil, err
		}
		expanded = append(expanded, splitEntries...)
	}

	segments := make([]VerselineSegment, 0, len(expanded))
	for index, entry := range expanded {
		segment, err := verselineDraftEntryToSegment(entry, index, options)
		if err != nil {
			return nil, err
		}
		segments = append(segments, segment)
	}

	return segments, validateVerselineTimeline(segments)
}

func verselineDraftEntryToSegment(entry verselineDraftEntry, index int, options verselineDraftGenerationOptions) (VerselineSegment, error) {
	segment := VerselineSegment{
		ID:         firstNonEmpty(entry.ID, fmt.Sprintf("seg-%03d", index+1)),
		Start:      entry.Start,
		End:        entry.End,
		Status:     firstNonEmpty(entry.Status, options.DefaultStatus, "draft"),
		Confidence: entry.Confidence,
		Notes:      entry.Notes,
	}

	blocks := []VerselineBlock{}
	if strings.TrimSpace(options.SecondarySourceID) != "" {
		if len(entry.Refs) == 0 {
			return segment, fmt.Errorf("entry %d: secondary_source_id requires refs", index+1)
		}
		blocks = append(blocks, VerselineBlock{
			ID:        fmt.Sprintf("secondary-%03d", index+1),
			Kind:      "source_full",
			Style:     options.SecondaryStyle,
			Placement: options.SecondaryPlacement,
			Source: &VerselineBlockSource{
				Source: options.SecondarySourceID,
				Mode:   "full",
				Refs:   append([]string(nil), entry.Refs...),
			},
		})
	}

	switch {
	case strings.TrimSpace(options.PrimarySourceID) != "" && len(entry.Refs) > 0 && strings.TrimSpace(entry.Text) != "":
		blocks = append(blocks, VerselineBlock{
			ID:        fmt.Sprintf("primary-%03d", index+1),
			Kind:      "source_substring",
			Text:      entry.Text,
			Style:     options.PrimaryStyle,
			Placement: options.PrimaryPlacement,
			Source: &VerselineBlockSource{
				Source: options.PrimarySourceID,
				Mode:   "substring",
				Refs:   append([]string(nil), entry.Refs...),
			},
		})
	case strings.TrimSpace(options.PrimarySourceID) != "" && len(entry.Refs) > 0:
		blocks = append(blocks, VerselineBlock{
			ID:        fmt.Sprintf("primary-%03d", index+1),
			Kind:      "source_full",
			Style:     options.PrimaryStyle,
			Placement: options.PrimaryPlacement,
			Source: &VerselineBlockSource{
				Source: options.PrimarySourceID,
				Mode:   "full",
				Refs:   append([]string(nil), entry.Refs...),
			},
		})
	case strings.TrimSpace(entry.Text) != "":
		blocks = append(blocks, VerselineBlock{
			ID:        fmt.Sprintf("primary-%03d", index+1),
			Kind:      "literal",
			Text:      entry.Text,
			Style:     options.PrimaryStyle,
			Placement: options.PrimaryPlacement,
		})
	default:
		return segment, fmt.Errorf("entry %d: primary block needs either text or refs with primary_source_id", index+1)
	}

	segment.Blocks = blocks
	return segment, nil
}

func resolveVerselineTimelinePath(project VerselineProject, absProjectPath string, timeline string) (string, string, error) {
	timelineKind := verselineMCPNormalizeTimelineKind(timeline, false)
	target := project.Timeline.Draft
	if timelineKind == "approved" {
		target = project.Timeline.Approved
	}
	if strings.TrimSpace(target) == "" {
		return "", "", fmt.Errorf("project does not define a %s timeline path", timelineKind)
	}
	return resolveReelPath(filepath.Dir(absProjectPath), target), timelineKind, nil
}

func splitVerselineDraftEntry(entry verselineDraftEntry, maxChars int) ([]verselineDraftEntry, error) {
	if maxChars <= 0 || utf8.RuneCountInString(strings.TrimSpace(entry.Text)) <= maxChars {
		return []verselineDraftEntry{entry}, nil
	}

	parts := splitVerselineDraftText(entry.Text, maxChars)
	if len(parts) < 2 {
		return []verselineDraftEntry{entry}, nil
	}

	start, err := tsToMillis(entry.Start)
	if err != nil {
		return nil, err
	}
	end, err := tsToMillis(entry.End)
	if err != nil {
		return nil, err
	}
	if end <= start {
		return nil, fmt.Errorf("cannot split entry with non-positive duration")
	}

	weights := make([]int, len(parts))
	totalWeight := 0
	for index, part := range parts {
		weight := max(utf8.RuneCountInString(strings.TrimSpace(part)), 1)
		weights[index] = weight
		totalWeight += weight
	}

	duration := end - start
	cursor := start
	result := make([]verselineDraftEntry, 0, len(parts))
	baseID := strings.TrimSpace(entry.ID)
	for index, part := range parts {
		partStart := cursor
		partEnd := end
		if index < len(parts)-1 {
			remainingParts := len(parts) - index - 1
			remainingMin := Millis(remainingParts)
			partDuration := Millis(int64(duration) * int64(weights[index]) / int64(totalWeight))
			partDuration = max(partDuration, 1)
			partDuration = min(partDuration, end-cursor-remainingMin)
			partEnd = cursor + partDuration
		}

		partEntry := entry
		partEntry.Start = millisToTs(partStart)
		partEntry.End = millisToTs(partEnd)
		partEntry.Text = strings.TrimSpace(part)
		if baseID != "" {
			partEntry.ID = fmt.Sprintf("%s-%02d", baseID, index+1)
		}
		result = append(result, partEntry)
		cursor = partEnd
	}

	return result, nil
}

func splitVerselineDraftText(text string, maxChars int) []string {
	text = strings.TrimSpace(text)
	if text == "" || maxChars <= 0 || utf8.RuneCountInString(text) <= maxChars {
		return []string{text}
	}

	parts := []string{}
	remaining := text
	for utf8.RuneCountInString(remaining) > maxChars {
		cut := verselineDraftCutIndex(remaining, maxChars)
		if cut <= 0 || cut >= len(remaining) {
			break
		}
		part := strings.TrimSpace(remaining[:cut])
		if part == "" {
			break
		}
		parts = append(parts, part)
		remaining = strings.TrimLeftFunc(remaining[cut:], unicode.IsSpace)
	}
	remaining = strings.TrimSpace(remaining)
	if remaining != "" {
		parts = append(parts, remaining)
	}
	if len(parts) == 0 {
		return []string{text}
	}
	return parts
}

func verselineDraftCutIndex(text string, maxChars int) int {
	runeCount := 0
	lastWhitespace := -1
	for index, r := range text {
		if runeCount >= maxChars {
			if lastWhitespace > 0 {
				return lastWhitespace
			}
			return index
		}
		if unicode.IsSpace(r) {
			lastWhitespace = index
		}
		runeCount += 1
	}
	return len(text)
}

func extractVerselineDraftString(node map[string]interface{}, fields ...string) string {
	for _, field := range fields {
		raw, ok := node[field]
		if !ok {
			continue
		}
		text, ok := raw.(string)
		if !ok {
			continue
		}
		text = strings.TrimSpace(text)
		if text != "" {
			return text
		}
	}
	return ""
}

func extractVerselineDraftFloat(node map[string]interface{}, fields ...string) float64 {
	for _, field := range fields {
		raw, ok := node[field]
		if !ok {
			continue
		}
		switch value := raw.(type) {
		case float64:
			return value
		case string:
			parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
			if err == nil {
				return parsed
			}
		}
	}
	return 0
}

func extractVerselineDraftRefs(node map[string]interface{}, fields ...string) []string {
	for _, field := range fields {
		raw, ok := node[field]
		if !ok {
			continue
		}
		switch value := raw.(type) {
		case []interface{}:
			refs := make([]string, 0, len(value))
			for _, item := range value {
				text, ok := item.(string)
				if !ok {
					continue
				}
				text = strings.TrimSpace(text)
				if text != "" {
					refs = append(refs, text)
				}
			}
			if len(refs) > 0 {
				return refs
			}
		case string:
			refs := verselineSplitCSV(value)
			if len(refs) > 0 {
				return refs
			}
		}
	}
	return nil
}

func extractVerselineDraftTimestamp(node map[string]interface{}, fields ...string) (string, bool, error) {
	for _, field := range fields {
		raw, ok := node[field]
		if !ok {
			continue
		}
		switch value := raw.(type) {
		case string:
			value = strings.TrimSpace(value)
			if value == "" {
				continue
			}
			if strings.Contains(value, ":") {
				return value, true, nil
			}
			if millis, err := strconv.ParseInt(value, 10, 64); err == nil {
				return millisToTs(Millis(millis)), true, nil
			}
		case float64:
			return millisToTs(Millis(value)), true, nil
		}
	}
	return "", false, nil
}
