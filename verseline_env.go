package main

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

// loadVerselineEnvFile reads a .env file next to the running executable and
// sets any KEY=VALUE pairs that are not already present in the environment.
// It silently does nothing if the file is missing or unreadable.
func loadVerselineEnvFile() {
	executable, err := os.Executable()
	if err != nil {
		return
	}
	envPath := filepath.Join(filepath.Dir(executable), ".env")
	loadEnvFileInto(envPath)
}

func loadEnvFileInto(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if key == "" {
			continue
		}
		// Strip surrounding quotes from value.
		if len(value) >= 2 {
			if (value[0] == '"' && value[len(value)-1] == '"') ||
				(value[0] == '\'' && value[len(value)-1] == '\'') {
				value = value[1 : len(value)-1]
			}
		}
		// Only set if not already defined so real env vars take precedence.
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, value)
		}
	}
}
