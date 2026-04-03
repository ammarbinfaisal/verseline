package main

import (
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
)

// Millis represents a duration or timestamp in milliseconds.
type Millis int64

func tsToMillis(ts string) (Millis, error) {
	var err error = nil
	var mm, hh, ss int64 = 0, 0, 0
	var ms Millis = 0
	index := 0
	switch comps := strings.Split(ts, ":"); len(comps) {
	case 3:
		hh, err = strconv.ParseInt(comps[index], 10, 64)
		if err != nil {
			return 0, err
		}
		index += 1
		fallthrough
	case 2:
		mm, err = strconv.ParseInt(comps[index], 10, 64)
		if err != nil {
			return 0, err
		}
		index += 1
		fallthrough
	case 1:
		ss, ms, err = parseSsAndMs(comps[index])
		if err != nil {
			return 0, err
		}

		return 60*60*1000*Millis(hh) + 60*1000*Millis(mm) + Millis(ss)*1000 + ms, nil
	default:
		return 0, fmt.Errorf("Unexpected amount of components in the timestamp (%d)", len(comps))
	}
}

func parseSsAndMs(s string) (ss int64, ms Millis, err error) {
	switch comps := strings.Split(s, "."); len(comps) {
	case 2:
		ss, err = strconv.ParseInt(comps[0], 10, 64)
		if err != nil {
			return
		}
		runes := []rune(comps[1])
		ms = 0
		for i := 0; i < 3; i += 1 {
			ms = ms * 10
			if i < len(runes) {
				ms += Millis(runes[i] - '0')
			}
		}
		return
	case 1:
		ss, err = strconv.ParseInt(comps[0], 10, 64)
		if err != nil {
			return
		}
		ms = 0
		return
	default:
		err = fmt.Errorf("Unexpected amount of components in the seconds (%d): %s", len(comps), s)
		return
	}
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

func reelFontsDirClause(fontsDir string) string {
	if fontsDir == "" {
		return ""
	}
	return fmt.Sprintf(":fontsdir=%s", reelEscapeFFmpegFilterPath(fontsDir))
}

func reelBool(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
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

func reelScaleValue(height int, base1080x1920 int) int {
	return max(base1080x1920*height/1920, 1)
}
