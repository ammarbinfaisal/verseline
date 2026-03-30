package main

import (
	"context"
	"errors"
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
		"verseline_transcribe",
		"verseline_update_segment",
		"verseline_split_segment",
		"verseline_update_project",
		"verseline_preview_segment",
		"verseline_check_readability",
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

	cancel()
	if err := <-serverDone; err != nil && !errors.Is(err, context.Canceled) {
		t.Fatalf("server run: %v", err)
	}
}
