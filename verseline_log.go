package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

var (
	verselineLogFile *os.File
	verselineLogOnce sync.Once
)

func verselineLogDir() string {
	switch runtime.GOOS {
	case "darwin":
		home, _ := os.UserHomeDir()
		return filepath.Join(home, "Library", "Logs", "verseline")
	default:
		if dir := os.Getenv("XDG_STATE_HOME"); dir != "" {
			return filepath.Join(dir, "verseline")
		}
		home, _ := os.UserHomeDir()
		return filepath.Join(home, ".local", "state", "verseline")
	}
}

func verselineOpenLog() *os.File {
	verselineLogOnce.Do(func() {
		dir := verselineLogDir()
		if err := os.MkdirAll(dir, 0755); err != nil {
			return
		}
		path := filepath.Join(dir, "verseline.log")
		f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			return
		}
		verselineLogFile = f
	})
	return verselineLogFile
}

func verselineLog(format string, args ...any) {
	f := verselineOpenLog()
	if f == nil {
		return
	}
	ts := time.Now().Format("2006-01-02 15:04:05")
	line := fmt.Sprintf(format, args...)
	fmt.Fprintf(f, "%s %s\n", ts, strings.TrimRight(line, "\n"))
}

func verselineCloseLog() {
	if verselineLogFile != nil {
		verselineLogFile.Close()
		verselineLogFile = nil
	}
}
