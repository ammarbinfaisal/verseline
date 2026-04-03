package main

import (
	"fmt"
	"os"
	"os/exec"
	"path"
	"strings"
)

func decomposeMillis(millis Millis) (hh int64, mm int64, ss int64, ms int64, sign string) {
	sign = ""
	if millis < 0 {
		sign = "-"
		millis = -millis
	}
	hh = int64(millis / 1000 / 60 / 60)
	mm = int64(millis / 1000 / 60 % 60)
	ss = int64(millis / 1000 % 60)
	ms = int64(millis % 1000)
	return
}

// Timestamp format: HH:MM:SS.mmm
func millisToTs(millis Millis) string {
	hh, mm, ss, ms, sign := decomposeMillis(millis)
	return fmt.Sprintf("%s%02d:%02d:%02d.%03d", sign, hh, mm, ss, ms)
}

type Subcommand struct {
	Run         func(name string, args []string) bool
	Description string
}

var Subcommands = map[string]Subcommand{}

func ffmpegPathToBin() (ffmpegPath string) {
	ffmpegPath = "ffmpeg"
	ffmpegPrefix, ok := os.LookupEnv("FFMPEG_PREFIX")
	if ok {
		ffmpegPath = path.Join(ffmpegPrefix, "bin", "ffmpeg")
	}
	return
}

func logCmd(name string, args ...string) {
	chunks := []string{}
	chunks = append(chunks, name)
	for _, arg := range args {
		if strings.Contains(arg, " ") {
			chunks = append(chunks, "\""+arg+"\"")
		} else {
			chunks = append(chunks, arg)
		}
	}
	verselineLog("[CMD] %s", strings.Join(chunks, " "))
}

func millisToSecsForFFmpeg(millis Millis) string {
	return fmt.Sprintf("%d.%03d", millis/1000, millis%1000)
}

func ffmpegConcatFiles(listPath string, outputPath string) error {
	ffmpeg := ffmpegPathToBin()
	args := []string{"-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath}
	logCmd(ffmpeg, args...)
	cmd := exec.Command(ffmpeg, args...)
	out, err := cmd.CombinedOutput()
	if len(out) > 0 {
		verselineLog("[FFMPEG] %s", string(out))
	}
	return err
}

func main() {
	program := currentProgramName()
	if len(os.Args) < 2 {
		printVerselineUsage(program)
		fmt.Printf("ERROR: No subcommand is provided\n")
		os.Exit(1)
	}

	name := os.Args[1]
	if isVerselineHelpArg(name) {
		printVerselineUsage(program)
		return
	}
	if !runVerselineCommand(program, os.Args[1:]) {
		os.Exit(1)
	}
}
