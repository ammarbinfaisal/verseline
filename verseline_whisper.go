package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type whisperResponse struct {
	Language string           `json:"language"`
	Duration float64          `json:"duration"`
	Text     string           `json:"text"`
	Segments []whisperSegment `json:"segments"`
}

type whisperSegment struct {
	ID               int     `json:"id"`
	Start            float64 `json:"start"`
	End              float64 `json:"end"`
	Text             string  `json:"text"`
	AvgLogprob       float64 `json:"avg_logprob"`
	CompressionRatio float64 `json:"compression_ratio"`
	NoSpeechProb     float64 `json:"no_speech_prob"`
}

type whisperRequestOptions struct {
	AudioPath string
	Language  string
	Model     string
	APIKey    string
}

func callWhisperAPI(opts whisperRequestOptions) (*whisperResponse, error) {
	audioFile, err := os.Open(opts.AudioPath)
	if err != nil {
		return nil, fmt.Errorf("open audio file: %w", err)
	}
	defer audioFile.Close()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", filepath.Base(opts.AudioPath))
	if err != nil {
		return nil, fmt.Errorf("create form file: %w", err)
	}
	if _, err := io.Copy(part, audioFile); err != nil {
		return nil, fmt.Errorf("copy audio data: %w", err)
	}

	model := firstNonEmpty(opts.Model, "whisper-1")
	writer.WriteField("model", model)
	writer.WriteField("response_format", "verbose_json")
	writer.WriteField("timestamp_granularities[]", "segment")
	if strings.TrimSpace(opts.Language) != "" {
		writer.WriteField("language", strings.TrimSpace(opts.Language))
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("close multipart writer: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/audio/transcriptions", body)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+opts.APIKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		return nil, fmt.Errorf("whisper API request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("whisper API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result whisperResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("decode whisper response: %w", err)
	}
	return &result, nil
}

func secondsToTs(seconds float64) string {
	millis := int64(math.Round(seconds * 1000))
	return millisToTs(Millis(millis))
}

func whisperConfidence(seg whisperSegment) float64 {
	// avg_logprob is typically between -1.0 (low) and 0.0 (perfect).
	// Map it to a 0.0–1.0 range with a simple exponential.
	if seg.AvgLogprob >= 0 {
		return 1.0
	}
	return math.Exp(seg.AvgLogprob)
}
