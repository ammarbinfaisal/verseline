"use client";

import { useEffect, useRef, useState } from "react";

export interface RenderProgressState {
  percent: number;
  status: string;
  outputUrl?: string;
  error?: string;
  isConnected: boolean;
}

const INITIAL_STATE: RenderProgressState = {
  percent: 0,
  status: "idle",
  outputUrl: undefined,
  error: undefined,
  isConnected: false,
};

/**
 * Connects to the backend WebSocket at /ws/render/:jobId and streams
 * progress updates until the job reaches a terminal state.
 *
 * Pass `null` for jobId to stay disconnected (e.g. before a job is started).
 */
export function useRenderProgress(jobId: string | null): RenderProgressState {
  const [state, setState] = useState<RenderProgressState>(INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Clean up any previous connection
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    if (!jobId) {
      setState(INITIAL_STATE);
      return;
    }

    // Build the WebSocket URL from the HTTP API base URL
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const wsBase = apiBase.replace(/^http/, "ws");
    const url = `${wsBase}/ws/render/${jobId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, isConnected: true }));
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          percent?: number;
          status?: string;
          outputUrl?: string;
          error?: string;
        };
        setState({
          percent: typeof msg.percent === "number" ? msg.percent : 0,
          status: typeof msg.status === "string" ? msg.status : "unknown",
          outputUrl: msg.outputUrl,
          error: msg.error,
          isConnected: true,
        });
      } catch {
        // Ignore unparseable messages
      }
    };

    ws.onerror = () => {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        status: "error",
        error: "WebSocket connection error",
      }));
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, isConnected: false }));
      wsRef.current = null;
    };

    return () => {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
      wsRef.current = null;
    };
  }, [jobId]);

  return state;
}
