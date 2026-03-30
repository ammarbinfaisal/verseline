package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type RecitationPlacement struct {
	Mode                  string   `json:"mode,omitempty"`
	Seed                  int64    `json:"seed,omitempty"`
	TranslationCandidates []string `json:"translation_candidates,omitempty"`
	MetaCandidates        []string `json:"meta_candidates,omitempty"`
}

type RecitationSegmentSource struct {
	Type string `json:"type,omitempty"`
	From string `json:"from,omitempty"`
}

type RecitationSegment struct {
	Start         string                   `json:"start"`
	End           string                   `json:"end"`
	Text          string                   `json:"text,omitempty"`
	Verse         string                   `json:"verse,omitempty"`
	Refs          []string                 `json:"refs,omitempty"`
	Size          string                   `json:"size,omitempty"`
	Status        string                   `json:"status,omitempty"`
	Confidence    float64                  `json:"confidence,omitempty"`
	Notes         string                   `json:"notes,omitempty"`
	Placement     string                   `json:"placement,omitempty"`
	FontSizeDelta int                      `json:"font_size_delta,omitempty"`
	Source        *RecitationSegmentSource `json:"source,omitempty"`
}

type RecitationDraft struct {
	SourceAudio string              `json:"source_audio,omitempty"`
	GeneratedAt string              `json:"generated_at,omitempty"`
	Segments    []RecitationSegment `json:"segments"`
}

func init() {
	Subcommands["validate"] = Subcommand{
		Description: "Validate a recitation clip config and its segment timeline",
		Run: func(name string, args []string) bool {
			subFlag := flag.NewFlagSet(name, flag.ContinueOnError)
			clipPtr := subFlag.String("clip", "reel.json", "Path to the recitation clip JSON config")

			err := subFlag.Parse(args)
			if err == flag.ErrHelp {
				return true
			}
			if err != nil {
				fmt.Printf("ERROR: Could not parse command line arguments: %s\n", err)
				return false
			}

			plan, err := loadReelPlan(*clipPtr)
			if err != nil {
				fmt.Printf("ERROR: Could not load clip config %s: %s\n", *clipPtr, err)
				return false
			}

			fmt.Printf("Validated %s\n", plan.ConfigPath)
			fmt.Printf("Segments: %d\n", len(plan.Segments))
			return true
		},
	}

	Subcommands["approve"] = Subcommand{
		Description: "Promote a reviewed draft timeline into the approved segment file",
		Run: func(name string, args []string) bool {
			subFlag := flag.NewFlagSet(name, flag.ContinueOnError)
			clipPtr := subFlag.String("clip", "reel.json", "Path to the recitation clip JSON config")

			err := subFlag.Parse(args)
			if err == flag.ErrHelp {
				return true
			}
			if err != nil {
				fmt.Printf("ERROR: Could not parse command line arguments: %s\n", err)
				return false
			}

			clipPath, clip, err := loadRecitationClip(*clipPtr)
			if err != nil {
				fmt.Printf("ERROR: Could not load clip config %s: %s\n", *clipPtr, err)
				return false
			}

			if strings.TrimSpace(clip.SegmentsDraftFile) == "" {
				fmt.Printf("ERROR: %s does not define segments_draft_file\n", clipPath)
				return false
			}
			if strings.TrimSpace(clip.SegmentsFile) == "" {
				fmt.Printf("ERROR: %s does not define segments_file\n", clipPath)
				return false
			}

			draftPath := resolveReelPath(filepath.Dir(clipPath), clip.SegmentsDraftFile)
			approvedPath := resolveReelPath(filepath.Dir(clipPath), clip.SegmentsFile)
			draft, err := loadRecitationDraftFile(draftPath)
			if err != nil {
				fmt.Printf("ERROR: Could not load draft segments %s: %s\n", draftPath, err)
				return false
			}

			for index, segment := range draft.Segments {
				if strings.EqualFold(segment.Status, "needs_fix") {
					fmt.Printf("ERROR: segment %d is still marked needs_fix\n", index)
					return false
				}
			}

			if err := saveRecitationSegmentsFile(approvedPath, draft.Segments); err != nil {
				fmt.Printf("ERROR: Could not save approved segments %s: %s\n", approvedPath, err)
				return false
			}

			fmt.Printf("Generated %s\n", approvedPath)
			return true
		},
	}

	Subcommands["edit"] = Subcommand{
		Description: "Open a minimal TUI for editing draft or approved recitation segments",
		Run: func(name string, args []string) bool {
			subFlag := flag.NewFlagSet(name, flag.ContinueOnError)
			clipPtr := subFlag.String("clip", "reel.json", "Path to the recitation clip JSON config")
			filePtr := subFlag.String("file", "", "Optional direct path to a segments JSON file")
			approvedPtr := subFlag.Bool("approved", false, "Open segments_file instead of segments_draft_file")

			err := subFlag.Parse(args)
			if err == flag.ErrHelp {
				return true
			}
			if err != nil {
				fmt.Printf("ERROR: Could not parse command line arguments: %s\n", err)
				return false
			}

			target := strings.TrimSpace(*filePtr)
			if target == "" {
				clipPath, clip, err := loadRecitationClip(*clipPtr)
				if err != nil {
					fmt.Printf("ERROR: Could not load clip config %s: %s\n", *clipPtr, err)
					return false
				}

				switch {
				case *approvedPtr && strings.TrimSpace(clip.SegmentsFile) != "":
					target = resolveReelPath(filepath.Dir(clipPath), clip.SegmentsFile)
				case strings.TrimSpace(clip.SegmentsDraftFile) != "":
					target = resolveReelPath(filepath.Dir(clipPath), clip.SegmentsDraftFile)
				case strings.TrimSpace(clip.SegmentsFile) != "":
					target = resolveReelPath(filepath.Dir(clipPath), clip.SegmentsFile)
				default:
					fmt.Printf("ERROR: %s does not define segments_draft_file or segments_file\n", clipPath)
					return false
				}
			}

			if err := runRecitationTUI(target); err != nil {
				fmt.Printf("ERROR: Could not edit %s: %s\n", target, err)
				return false
			}

			fmt.Printf("Saved %s\n", target)
			return true
		},
	}

	Subcommands["reel-render"] = Subcommand{
		Description: "Render a recitation reel from the approved segment timeline",
		Run: func(name string, args []string) bool {
			subFlag := flag.NewFlagSet(name, flag.ContinueOnError)
			clipPtr := subFlag.String("clip", "reel.json", "Path to the recitation clip JSON config")

			err := subFlag.Parse(args)
			if err == flag.ErrHelp {
				return true
			}
			if err != nil {
				fmt.Printf("ERROR: Could not parse command line arguments: %s\n", err)
				return false
			}

			plan, err := loadReelPlan(*clipPtr)
			if err != nil {
				fmt.Printf("ERROR: Could not load clip config %s: %s\n", *clipPtr, err)
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
			return true
		},
	}
}

func loadRecitationClip(configPath string) (string, ReelConfig, error) {
	var clip ReelConfig
	absConfigPath, err := filepath.Abs(configPath)
	if err != nil {
		return "", clip, err
	}

	content, err := os.ReadFile(absConfigPath)
	if err != nil {
		return "", clip, err
	}

	if err := json.Unmarshal(content, &clip); err != nil {
		return "", clip, err
	}

	return absConfigPath, clip, nil
}

func loadRecitationSegmentsForRender(configPath string, config ReelConfig) ([]ReelSegment, error) {
	if len(config.Segments) > 0 {
		return config.Segments, nil
	}

	baseDir := filepath.Dir(configPath)
	segmentPath := firstNonEmpty(config.SegmentsFile, config.SegmentsDraftFile)
	if segmentPath == "" {
		return nil, errors.New("either inline segments, segments_file, or segments_draft_file is required")
	}

	resolved := resolveReelPath(baseDir, segmentPath)
	return loadRecitationSegmentsFile(resolved)
}

func loadRecitationDraftFile(path string) (RecitationDraft, error) {
	draft := RecitationDraft{}
	content, err := os.ReadFile(path)
	if err != nil {
		return draft, err
	}

	if err := json.Unmarshal(content, &draft); err == nil && len(draft.Segments) > 0 {
		return draft, nil
	}

	var segments []RecitationSegment
	if err := json.Unmarshal(content, &segments); err != nil {
		return draft, err
	}
	draft.Segments = segments
	return draft, nil
}

func loadRecitationSegmentsFile(path string) ([]ReelSegment, error) {
	draft, err := loadRecitationDraftFile(path)
	if err != nil {
		return nil, err
	}

	result := make([]ReelSegment, 0, len(draft.Segments))
	for index, segment := range draft.Segments {
		reelSegment, err := recitationSegmentToReelSegment(segment)
		if err != nil {
			return nil, fmt.Errorf("%s segment %d: %w", path, index, err)
		}
		result = append(result, reelSegment)
	}

	return result, nil
}

func saveRecitationSegmentsFile(path string, segments []RecitationSegment) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	payload, err := json.MarshalIndent(segments, "", "  ")
	if err != nil {
		return err
	}
	payload = append(payload, '\n')
	return os.WriteFile(path, payload, 0644)
}

func recitationSegmentToReelSegment(segment RecitationSegment) (ReelSegment, error) {
	if strings.TrimSpace(segment.Start) == "" || strings.TrimSpace(segment.End) == "" {
		return ReelSegment{}, errors.New("start and end are required")
	}

	size := firstNonEmpty(segment.Size, "default")
	style := "default"
	switch size {
	case "default":
	case "large":
		style = "large"
	default:
		return ReelSegment{}, fmt.Errorf("unsupported size %q", size)
	}

	reelSegment := ReelSegment{
		Start:         segment.Start,
		End:           segment.End,
		Text:          segment.Text,
		Verse:         segment.Verse,
		Refs:          append([]string(nil), segment.Refs...),
		Style:         style,
		FontSizeDelta: segment.FontSizeDelta,
	}

	if len(segment.Refs) > 0 && reelSegment.Verse == "" {
		// Carry the first ref for lookup convenience while retaining the full ref set.
		reelSegment.Verse = segment.Refs[0]
	}

	return reelSegment, nil
}

func validateRecitationSegments(segments []ReelSegment, translationMap map[string]string) error {
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

		if segment.Text == "" || len(translationMap) == 0 {
			continue
		}

		refs := append([]string(nil), segment.Refs...)
		if segment.Verse != "" && len(refs) == 0 {
			refs = append(refs, segment.Verse)
		}
		if len(refs) == 0 {
			return fmt.Errorf("segment %d: manual text requires refs or verse for translation validation", index)
		}

		sourceParts := []string{}
		for _, ref := range refs {
			text, err := resolveReelVerseText(translationMap, ref)
			if err != nil {
				return fmt.Errorf("segment %d: %w", index, err)
			}
			sourceParts = append(sourceParts, text)
		}

		joined := strings.Join(sourceParts, " ")
		text := strings.TrimSpace(segment.Text)
		if !strings.Contains(joined, text) {
			return fmt.Errorf("segment %d: text is not an exact substring of the referenced translation text", index)
		}
	}

	return nil
}
