package main

import (
	"bufio"
	"bytes"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
)

type verselineRenderProgress struct {
	JobID      string
	JobLabel   string
	JobIndex   int
	JobCount   int
	OutputPath string
	Percent    float64
	Stage      string
}

type verselineRenderRequest struct {
	Width          int
	Height         int
	FPS            int
	OutputPath     string
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
	InputOffset    Millis
	Duration       Millis
	Label          string
}

func init() {
	Subcommands["verseline-preview"] = Subcommand{
		Description: "Render a low-quality preview for one segment and open it in the configured player",
		Run: func(name string, args []string) bool {
			subFlag := flag.NewFlagSet(name, flag.ContinueOnError)
			projectPtr := subFlag.String("project", "examples/verseline-project.json", "Path to the Verseline project JSON file")
			segmentPtr := subFlag.Int("segment", 1, "1-based segment number to preview")
			playerPtr := subFlag.String("player", "", "Optional player executable override")
			noOpenPtr := subFlag.Bool("no-open", false, "Render the preview clip without opening a player")

			err := subFlag.Parse(args)
			if err == flag.ErrHelp {
				return true
			}
			if err != nil {
				fmt.Printf("ERROR: Could not parse command line arguments: %s\n", err)
				return false
			}

			outputPath, err := verselinePreviewProject(*projectPtr, *segmentPtr, *playerPtr, !*noOpenPtr, nil)
			if err != nil {
				fmt.Printf("ERROR: Could not render preview: %s\n", err)
				return false
			}
			fmt.Printf("Generated %s\n", outputPath)
			return true
		},
	}
}

func verselineLoadTimelineForProject(project VerselineProject, projectPath string) ([]VerselineSegment, string, error) {
	projectDir := filepath.Dir(projectPath)
	timelinePath := strings.TrimSpace(project.Timeline)
	if timelinePath == "" {
		return nil, "", fmt.Errorf("project does not define a timeline")
	}
	resolved := resolveReelPath(projectDir, timelinePath)
	segments, err := loadVerselineTimeline(resolved)
	if err != nil {
		return nil, "", err
	}
	return segments, resolved, nil
}

func verselinePreviewProject(projectPath string, segmentNumber int, playerOverride string, openPlayer bool, onProgress func(verselineRenderProgress)) (string, error) {
	project, absProjectPath, err := loadVerselineProject(projectPath)
	if err != nil {
		return "", err
	}
	segments, _, err := verselineLoadTimelineForProject(project, absProjectPath)
	if err != nil {
		return "", err
	}
	return verselinePreviewSegments(project, absProjectPath, segments, segmentNumber, playerOverride, openPlayer, onProgress)
}

func verselinePreviewSegments(project VerselineProject, absProjectPath string, segments []VerselineSegment, segmentNumber int, playerOverride string, openPlayer bool, onProgress func(verselineRenderProgress)) (string, error) {
	if segmentNumber < 1 || segmentNumber > len(segments) {
		return "", fmt.Errorf("segment %d is out of range", segmentNumber)
	}
	segment := segments[segmentNumber-1]

	request, err := verselinePreviewRequest(project, absProjectPath, segment, segmentNumber)
	if err != nil {
		return "", err
	}
	plan, err := buildVerselineRenderPlan(project, absProjectPath, segments, request)
	if err != nil {
		return "", err
	}
	if err := writeVerselineASS(plan); err != nil {
		return "", err
	}
	if err := renderVerselineWithProgress(plan, func(progress verselineRenderProgress) {
		if onProgress != nil {
			progress.JobIndex = 1
			progress.JobCount = 1
			onProgress(progress)
			return
		}
		if progress.Stage == "rendering" {
			fmt.Printf("\r[%s] %.0f%%", progress.JobLabel, progress.Percent)
		}
		if progress.Stage == "done" {
			fmt.Printf("\r[%s] 100%%\n", progress.JobLabel)
		}
	}); err != nil {
		return "", err
	}

	if openPlayer {
		player := firstNonEmpty(playerOverride, project.Preview.Player)
		if err := verselineOpenMedia(plan.OutputPath, player, project.Preview.PlayerArgs); err != nil {
			return plan.OutputPath, err
		}
	}
	return plan.OutputPath, nil
}

func verselineRenderProjectProfiles(projectPath string, profileIDs []string, outputOverride string, onProgress func(verselineRenderProgress)) ([]string, error) {
	project, absProjectPath, err := loadVerselineProject(projectPath)
	if err != nil {
		return nil, err
	}
	segments, _, err := verselineLoadTimelineForProject(project, absProjectPath)
	if err != nil {
		return nil, err
	}

	profiles, err := verselineSelectRenderProfiles(project, profileIDs)
	if err != nil {
		return nil, err
	}

	outputs := make([]string, 0, len(profiles))
	for i, profile := range profiles {
		request, err := verselineRenderRequestFromProfile(project, absProjectPath, profile)
		if err != nil {
			return nil, err
		}
		if outputOverride != "" {
			request.OutputPath = resolveReelPath(filepath.Dir(absProjectPath), outputOverride)
		}
		plan, err := buildVerselineRenderPlan(project, absProjectPath, segments, request)
		if err != nil {
			return nil, err
		}
		if err := writeVerselineASS(plan); err != nil {
			return nil, err
		}
		err = renderVerselineWithProgress(plan, func(progress verselineRenderProgress) {
			progress.JobID = profile.ID
			progress.JobLabel = firstNonEmpty(profile.Label, profile.ID, filepath.Base(plan.OutputPath))
			progress.JobIndex = i + 1
			progress.JobCount = len(profiles)
			if onProgress != nil {
				onProgress(progress)
				return
			}
			if progress.Stage == "rendering" {
				fmt.Printf("\r[%d/%d %s] %.0f%%", progress.JobIndex, progress.JobCount, progress.JobLabel, progress.Percent)
			}
			if progress.Stage == "done" {
				fmt.Printf("\r[%d/%d %s] 100%%\n", progress.JobIndex, progress.JobCount, progress.JobLabel)
			}
		})
		if err != nil {
			return nil, err
		}
		outputs = append(outputs, plan.OutputPath)
	}
	return outputs, nil
}

func verselinePreviewRequest(project VerselineProject, projectPath string, segment VerselineSegment, segmentNumber int) (verselineRenderRequest, error) {
	start, err := tsToMillis(segment.Start)
	if err != nil {
		return verselineRenderRequest{}, err
	}
	end, err := tsToMillis(segment.End)
	if err != nil {
		return verselineRenderRequest{}, err
	}
	padding := max(project.Preview.PaddingMS, 250)
	windowStart := max(start-Millis(padding), 0)
	windowEnd := end + Millis(padding)

	baseName := strings.TrimSuffix(filepath.Base(firstNonEmpty(project.Output, project.Name, "verseline")), filepath.Ext(firstNonEmpty(project.Output, project.Name, "verseline")))
	dir := strings.TrimSpace(project.Preview.Directory)
	if dir == "" {
		dir = baseName + ".preview"
	}
	outputPath := resolveReelPath(filepath.Dir(projectPath), filepath.Join(dir, fmt.Sprintf("segment-%03d.preview.mp4", segmentNumber)))

	return verselineRenderRequest{
		Width:        max(project.Preview.Width, max(project.Canvas.Width/2, 540)),
		Height:       max(project.Preview.Height, max(project.Canvas.Height/2, 960)),
		FPS:          max(project.Preview.FPS, min(project.Canvas.FPS, 24)),
		OutputPath:   outputPath,
		VideoCodec:   firstNonEmpty(project.Preview.VideoCodec, "libx264"),
		AudioCodec:   firstNonEmpty(project.Preview.AudioCodec, "aac"),
		AudioBitrate: firstNonEmpty(project.Preview.AudioBitrate, "96k"),
		CRF:          max(project.Preview.CRF, 32),
		Preset:       firstNonEmpty(project.Preview.Preset, "veryfast"),
		PixFmt:       firstNonEmpty(project.Preview.PixFmt, "yuv420p"),
		ExtraArgs:    append([]string(nil), project.Preview.ExtraArgs...),
		InputOffset:  windowStart,
		Duration:     windowEnd - windowStart,
		Label:        fmt.Sprintf("preview segment %03d", segmentNumber),
	}, nil
}

func verselineSelectRenderProfiles(project VerselineProject, profileIDs []string) ([]VerselineRenderProfile, error) {
	if len(profileIDs) == 0 {
		if len(project.RenderProfiles) == 0 {
			return []VerselineRenderProfile{{ID: "default"}}, nil
		}
		return append([]VerselineRenderProfile(nil), project.RenderProfiles...), nil
	}

	byID := map[string]VerselineRenderProfile{}
	for _, profile := range project.RenderProfiles {
		byID[profile.ID] = profile
	}

	selected := make([]VerselineRenderProfile, 0, len(profileIDs))
	for _, id := range profileIDs {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if id == "default" && len(project.RenderProfiles) == 0 {
			selected = append(selected, VerselineRenderProfile{ID: "default"})
			continue
		}
		profile, ok := byID[id]
		if !ok {
			return nil, fmt.Errorf("unknown render profile %q", id)
		}
		selected = append(selected, profile)
	}
	if len(selected) == 0 {
		return nil, errors.New("no render profiles selected")
	}
	return selected, nil
}

func verselineRenderRequestFromProfile(project VerselineProject, projectPath string, profile VerselineRenderProfile) (verselineRenderRequest, error) {
	outputPath := strings.TrimSpace(profile.Output)
	if outputPath == "" {
		baseOutput := firstNonEmpty(project.Output, project.Name, "verseline.mp4")
		ext := filepath.Ext(baseOutput)
		base := strings.TrimSuffix(baseOutput, ext)
		if ext == "" {
			ext = ".mp4"
		}
		suffix := firstNonEmpty(profile.OutputSuffix, profile.ID)
		if strings.TrimSpace(suffix) != "" {
			outputPath = base + "." + suffix + ext
		} else {
			outputPath = base + ext
		}
	}
	outputPath = resolveReelPath(filepath.Dir(projectPath), outputPath)

	return verselineRenderRequest{
		Width:          max(profile.Width, project.Canvas.Width),
		Height:         max(profile.Height, project.Canvas.Height),
		FPS:            max(profile.FPS, project.Canvas.FPS),
		OutputPath:     outputPath,
		VideoCodec:     firstNonEmpty(profile.VideoCodec, "libx264"),
		AudioCodec:     firstNonEmpty(profile.AudioCodec, "aac"),
		AudioBitrate:   firstNonEmpty(profile.AudioBitrate, "192k"),
		CRF:            max(profile.CRF, 23),
		Preset:         profile.Preset,
		PixFmt:         firstNonEmpty(profile.PixFmt, "yuv420p"),
		ColorPrimaries: profile.ColorPrimaries,
		ColorTRC:       profile.ColorTRC,
		ColorSpace:     profile.ColorSpace,
		ColorRange:     profile.ColorRange,
		ExtraArgs:      append([]string(nil), profile.ExtraArgs...),
		Label:          firstNonEmpty(profile.Label, profile.ID, filepath.Base(outputPath)),
	}, nil
}

func verselineOpenMedia(path string, player string, playerArgs []string) error {
	player = strings.TrimSpace(player)

	if player == "" || player == "default" {
		if verselineHasExec("vlc") {
			player = "vlc"
		} else {
			return verselineDefaultOpenCmd(path).Start()
		}
	}

	args := append([]string(nil), playerArgs...)
	args = append(args, path)

	var cmd *exec.Cmd
	switch {
	case verselineHasExec(player):
		cmd = exec.Command(player, args...)
	case runtime.GOOS == "darwin":
		cmd = exec.Command("open", "-a", player, path)
	default:
		cmd = exec.Command(player, args...)
	}
	return cmd.Start()
}

func verselineDefaultOpenCmd(path string) *exec.Cmd {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", path)
	case "windows":
		return exec.Command("cmd", "/c", "start", "", path)
	default:
		return exec.Command("xdg-open", path)
	}
}

func verselineHasExec(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func verselineSplitCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		result = append(result, part)
	}
	return result
}

func verselineFirstPositive(values ...int) int {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

func renderVerselineWithProgress(plan verselineRenderPlan, onProgress func(verselineRenderProgress)) error {
	if err := os.MkdirAll(filepath.Dir(plan.OutputPath), 0755); err != nil {
		return err
	}
	if err := renderVerselineBlockImages(&plan); err != nil {
		return err
	}

	partitions := verselinePartitionBlocks(plan.Blocks, plan.ClipEnd)
	if len(partitions) <= 1 {
		// Single partition or no blocks — render in one pass.
		args, total, err := buildVerselineFFmpegArgs(plan)
		if err != nil {
			return err
		}
		return runVerselineFFmpeg(args, total, plan, onProgress)
	}

	return renderVerselineParallel(plan, partitions, onProgress)
}

// verselineTimePartition is a contiguous time range with a subset of blocks.
type verselineTimePartition struct {
	Start  Millis
	End    Millis
	Blocks []verselineResolvedBlock // times are absolute
}

// verselinePartitionBlocks splits blocks into disjoint time ranges separated by
// gaps where no block is active. Blocks within each partition keep their
// absolute timestamps. Partitions are sorted by start time.
func verselinePartitionBlocks(blocks []verselineResolvedBlock, clipEnd Millis) []verselineTimePartition {
	if len(blocks) == 0 {
		return nil
	}

	sorted := make([]verselineResolvedBlock, len(blocks))
	copy(sorted, blocks)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Start < sorted[j].Start
	})

	var partitions []verselineTimePartition
	current := verselineTimePartition{
		Start: sorted[0].Start,
		End:   sorted[0].End,
	}
	current.Blocks = append(current.Blocks, sorted[0])

	for _, block := range sorted[1:] {
		if block.Start >= current.End {
			// Gap found — close current partition, start new one.
			partitions = append(partitions, current)
			current = verselineTimePartition{
				Start: block.Start,
				End:   block.End,
			}
			current.Blocks = append(current.Blocks, block)
		} else {
			// Overlaps — extend current partition.
			if block.End > current.End {
				current.End = block.End
			}
			current.Blocks = append(current.Blocks, block)
		}
	}
	partitions = append(partitions, current)

	// Extend the first partition back to time 0 so background/audio start from the beginning.
	if len(partitions) > 0 && partitions[0].Start > 0 {
		partitions[0].Start = 0
	}

	// Extend the last partition to clipEnd so the final video has full length.
	if len(partitions) > 0 && clipEnd > partitions[len(partitions)-1].End {
		partitions[len(partitions)-1].End = clipEnd
	}

	return partitions
}

// renderVerselineParallel renders each disjoint partition as an independent
// ffmpeg job, then concatenates them into the final output.
func renderVerselineParallel(plan verselineRenderPlan, partitions []verselineTimePartition, onProgress func(verselineRenderProgress)) error {
	partsDir := strings.TrimSuffix(plan.OutputPath, filepath.Ext(plan.OutputPath)) + ".parts"
	if err := os.MkdirAll(partsDir, 0755); err != nil {
		return err
	}

	partOutputs := make([]string, len(partitions))
	partErrors := make([]error, len(partitions))

	workers := min(runtime.NumCPU(), len(partitions))
	var wg sync.WaitGroup
	jobs := make(chan int, len(partitions))

	var progressMu sync.Mutex
	partPercents := make([]float64, len(partitions))
	totalDuration := plan.ClipEnd
	if plan.Duration > 0 {
		totalDuration = plan.Duration
	}

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for pi := range jobs {
				partition := partitions[pi]
				partPath := filepath.Join(partsDir, fmt.Sprintf("part-%03d.mp4", pi+1))
				partOutputs[pi] = partPath

				subPlan := verselinePartitionSubPlan(plan, partition, partPath, pi)
				if err := writeVerselineASS(subPlan); err != nil {
					partErrors[pi] = err
					continue
				}
				args, partTotal, err := buildVerselineFFmpegArgs(subPlan)
				if err != nil {
					partErrors[pi] = err
					continue
				}
				partErrors[pi] = runVerselineFFmpeg(args, partTotal, subPlan, func(p verselineRenderProgress) {
					if onProgress == nil {
						return
					}
					progressMu.Lock()
					partPercents[pi] = p.Percent
					var weightedTotal float64
					for i, pct := range partPercents {
						dur := float64(partitions[i].End - partitions[i].Start)
						weightedTotal += pct * dur / float64(totalDuration)
					}
					progressMu.Unlock()
					onProgress(verselineRenderProgress{
						JobID:      plan.Label,
						JobLabel:   plan.Label,
						OutputPath: plan.OutputPath,
						Percent:    min(weightedTotal, 99),
						Stage:      "rendering",
					})
				})
			}
		}()
	}

	for i := range partitions {
		jobs <- i
	}
	close(jobs)
	wg.Wait()

	for _, err := range partErrors {
		if err != nil {
			return err
		}
	}

	// Write the concat list and merge.
	concatListPath := filepath.Join(partsDir, "concat.txt")
	if err := verselineWriteConcatList(concatListPath, partOutputs); err != nil {
		return err
	}
	if err := ffmpegConcatFiles(concatListPath, plan.OutputPath); err != nil {
		return err
	}

	// Write the full ASS for the combined output.
	if err := writeVerselineASS(plan); err != nil {
		return err
	}

	if onProgress != nil {
		onProgress(verselineRenderProgress{
			JobID:      plan.Label,
			JobLabel:   plan.Label,
			OutputPath: plan.OutputPath,
			Percent:    100,
			Stage:      "done",
		})
	}
	return nil
}

// verselinePartitionSubPlan creates a render plan for a single time partition.
// Block timestamps are shifted to be relative to the partition start.
func verselinePartitionSubPlan(plan verselineRenderPlan, partition verselineTimePartition, outputPath string, index int) verselineRenderPlan {
	sub := plan
	sub.OutputPath = outputPath
	sub.ASSPath = strings.TrimSuffix(outputPath, filepath.Ext(outputPath)) + ".ass"
	sub.InputOffset = plan.InputOffset + partition.Start
	sub.Duration = partition.End - partition.Start
	sub.ClipEnd = sub.Duration
	sub.Label = fmt.Sprintf("%s part %d", plan.Label, index+1)

	// Shift block timestamps relative to partition start.
	sub.Blocks = make([]verselineResolvedBlock, len(partition.Blocks))
	for i, block := range partition.Blocks {
		block.Start -= partition.Start
		block.End -= partition.Start
		sub.Blocks[i] = block
	}
	return sub
}

func verselineWriteConcatList(path string, files []string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	for _, file := range files {
		absFile, err := filepath.Abs(file)
		if err != nil {
			return err
		}
		fmt.Fprintf(f, "file '%s'\n", absFile)
	}
	return nil
}

func buildVerselineFFmpegArgs(plan verselineRenderPlan) ([]string, Millis, error) {
	args := []string{"-y", "-progress", "pipe:1", "-nostats"}
	backgroundType := strings.ToLower(plan.Background.Type)
	backgroundLoop := reelBool(plan.Background.Loop, backgroundType != "video")

	switch backgroundType {
	case "image":
		args = append(args, "-loop", "1", "-framerate", strconv.Itoa(plan.FPS), "-i", plan.Background.Path)
	case "video":
		if plan.InputOffset > 0 {
			args = append(args, "-ss", millisToSecsForFFmpeg(plan.InputOffset))
		}
		if backgroundLoop {
			args = append(args, "-stream_loop", "-1")
		}
		if plan.Duration > 0 {
			args = append(args, "-t", millisToSecsForFFmpeg(plan.Duration))
		}
		args = append(args, "-i", plan.Background.Path)
	default:
		return nil, 0, fmt.Errorf("unsupported background.type %q", plan.Background.Type)
	}

	if plan.AudioPath != "" {
		if plan.InputOffset > 0 {
			args = append(args, "-ss", millisToSecsForFFmpeg(plan.InputOffset))
		}
		if plan.Duration > 0 {
			args = append(args, "-t", millisToSecsForFFmpeg(plan.Duration))
		}
		args = append(args, "-i", plan.AudioPath)
	}

	firstOverlayInput := 1
	if plan.AudioPath != "" {
		firstOverlayInput = 2
	}
	for _, block := range plan.Blocks {
		args = append(args, "-loop", "1", "-i", block.ImagePath)
	}

	filterComplex, finalLabel := buildVerselineOverlayFilter(plan, firstOverlayInput)
	args = append(args, "-filter_complex", filterComplex)
	args = append(args, "-r", strconv.Itoa(plan.FPS))
	args = append(args, "-map", finalLabel)
	if plan.AudioPath != "" {
		args = append(args, "-map", "1:a:0", "-c:a", firstNonEmpty(plan.AudioCodec, "aac"), "-b:a", firstNonEmpty(plan.AudioBitrate, "192k"), "-shortest")
	} else if plan.Duration > 0 {
		args = append(args, "-t", millisToSecsForFFmpeg(plan.Duration))
	} else if plan.ClipEnd > 0 {
		args = append(args, "-t", millisToSecsForFFmpeg(plan.ClipEnd))
	}
	args = append(args, "-c:v", firstNonEmpty(plan.VideoCodec, "libx264"))
	if plan.CRF > 0 {
		args = append(args, "-crf", strconv.Itoa(plan.CRF))
	}
	if strings.TrimSpace(plan.Preset) != "" {
		args = append(args, "-preset", plan.Preset)
	}
	args = append(args, "-pix_fmt", firstNonEmpty(plan.PixFmt, "yuv420p"))
	if strings.TrimSpace(plan.ColorPrimaries) != "" {
		args = append(args, "-color_primaries", plan.ColorPrimaries)
	}
	if strings.TrimSpace(plan.ColorTRC) != "" {
		args = append(args, "-color_trc", plan.ColorTRC)
	}
	if strings.TrimSpace(plan.ColorSpace) != "" {
		args = append(args, "-colorspace", plan.ColorSpace)
	}
	if strings.TrimSpace(plan.ColorRange) != "" {
		args = append(args, "-color_range", plan.ColorRange)
	}
	args = append(args, "-movflags", "+faststart")
	args = append(args, plan.ExtraArgs...)
	args = append(args, plan.OutputPath)

	total := plan.ClipEnd
	if plan.Duration > 0 {
		total = plan.Duration
	}
	return args, total, nil
}

func runVerselineFFmpeg(args []string, total Millis, plan verselineRenderPlan, onProgress func(verselineRenderProgress)) error {
	ffmpeg := ffmpegPathToBin()
	logCmd(ffmpeg, args...)
	cmd := exec.Command(ffmpeg, args...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	errBuf := bytes.Buffer{}
	errDone := make(chan struct{})
	go func() {
		defer close(errDone)
		_, _ = io.Copy(&errBuf, stderr)
	}()

	progressDone := make(chan error, 1)
	go func() {
		progressDone <- scanVerselineProgress(stdout, total, plan, onProgress)
	}()

	waitErr := cmd.Wait()
	progressErr := <-progressDone
	<-errDone
	stderrOutput := strings.TrimSpace(errBuf.String())
	if stderrOutput != "" {
		verselineLog("[FFMPEG STDERR] %s", stderrOutput)
	}
	if progressErr != nil {
		return progressErr
	}
	if waitErr != nil {
		if stderrOutput == "" {
			return waitErr
		}
		return fmt.Errorf("%w: %s", waitErr, stderrOutput)
	}
	if onProgress != nil {
		onProgress(verselineRenderProgress{
			JobLabel:   plan.Label,
			OutputPath: plan.OutputPath,
			Percent:    100,
			Stage:      "done",
		})
	}
	return nil
}

func scanVerselineProgress(src io.Reader, total Millis, plan verselineRenderPlan, onProgress func(verselineRenderProgress)) error {
	scanner := bufio.NewScanner(src)
	progress := verselineRenderProgress{
		JobLabel:   plan.Label,
		OutputPath: plan.OutputPath,
		Stage:      "rendering",
	}
	var outTime Millis
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		switch key {
		case "out_time_ms":
			micros, err := strconv.ParseInt(value, 10, 64)
			if err == nil {
				outTime = Millis(micros / 1000)
				if total > 0 {
					progress.Percent = min(100, float64(outTime)*100/float64(total))
				}
				if onProgress != nil {
					onProgress(progress)
				}
			}
		case "progress":
			if value == "end" && onProgress != nil {
				progress.Percent = 100
				progress.Stage = "done"
				onProgress(progress)
			}
		}
	}
	return scanner.Err()
}
