package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func TestVerselineMCPServerListsAndCallsTools(t *testing.T) {
	server := newVerselineMCPServer()
	client := mcp.NewClient(&mcp.Implementation{
		Name:    "verseline-mcp-test-client",
		Version: "0.1.0",
	}, nil)

	clientTransport, serverTransport := mcp.NewInMemoryTransports()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	serverDone := make(chan error, 1)
	go func() {
		serverDone <- server.Run(ctx, serverTransport)
	}()

	session, err := client.Connect(ctx, clientTransport, nil)
	if err != nil {
		t.Fatalf("connect client: %v", err)
	}
	defer session.Close()

	tools, err := session.ListTools(ctx, nil)
	if err != nil {
		t.Fatalf("list tools: %v", err)
	}

	names := map[string]bool{}
	for _, tool := range tools.Tools {
		names[tool.Name] = true
	}

	requiredTools := []string{
		"verseline_inspect_project",
		"verseline_list_segments",
		"verseline_validate_project",
		"verseline_update_segment",
		"verseline_split_segment",
		"verseline_approve_timeline",
		"verseline_preview_segment",
		"verseline_render_project",
	}
	for _, name := range requiredTools {
		if !names[name] {
			t.Fatalf("missing MCP tool %q", name)
		}
	}

	result, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "verseline_validate_project",
		Arguments: map[string]any{
			"project_path": "examples/verseline-project.json",
			"timeline":     "draft",
		},
	})
	if err != nil {
		t.Fatalf("call validate tool: %v", err)
	}
	if result.IsError {
		t.Fatalf("validate tool returned error result: %+v", result.Content)
	}

	tmpDir := t.TempDir()
	projectPath := filepath.Join(tmpDir, "project.json")
	project := map[string]any{}
	content, err := os.ReadFile("examples/verseline-project.json")
	if err != nil {
		t.Fatalf("read example project: %v", err)
	}
	if err := json.Unmarshal(content, &project); err != nil {
		t.Fatalf("decode example project: %v", err)
	}
	timeline, ok := project["timeline"].(map[string]any)
	if !ok {
		t.Fatalf("example project missing timeline map")
	}
	timeline["draft"] = "generated.timeline.draft.jsonl"
	timeline["approved"] = "generated.timeline.jsonl"
	updatedProject, err := json.Marshal(project)
	if err != nil {
		t.Fatalf("encode temp project: %v", err)
	}
	if err := os.WriteFile(projectPath, updatedProject, 0644); err != nil {
		t.Fatalf("write temp project: %v", err)
	}

	result, err = session.CallTool(ctx, &mcp.CallToolParams{
		Name: "verseline_generate_draft_from_transcript",
		Arguments: map[string]any{
			"project_path":        projectPath,
			"split_max_chars":     40,
			"primary_source_id":   "sahih",
			"primary_style":       "translation",
			"primary_placement":   "lower-center",
			"secondary_source_id": "arabic-kfqpc",
			"secondary_style":     "arabic-main",
			"secondary_placement": "upper-safe",
			"entries": []map[string]any{
				{
					"start": "00:00:00.000",
					"end":   "00:00:06.300",
					"text":  "This is the Book about which there is no doubt, a guidance for those conscious of Allah -",
					"refs":  []string{"2:2"},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("call generate draft tool: %v", err)
	}
	if result.IsError {
		t.Fatalf("generate draft tool returned error result: %+v", result.Content)
	}

	segments, err := loadVerselineTimeline(filepath.Join(tmpDir, "generated.timeline.draft.jsonl"))
	if err != nil {
		t.Fatalf("load generated draft timeline: %v", err)
	}
	if len(segments) < 2 {
		t.Fatalf("expected split draft output, got %d segments", len(segments))
	}

	cancel()
	if err := <-serverDone; err != nil && !errors.Is(err, context.Canceled) {
		t.Fatalf("server run: %v", err)
	}
}
