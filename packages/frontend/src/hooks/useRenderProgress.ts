"use client";

import { useRef, useState } from "react";
import { useMountEffect } from "./useMountEffect";

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
 * If jobId is null the hook does nothing — no connection is opened.
 *
 * Callers must use `key={jobId}` on the component that calls this hook so
 * that a jobId change forces a remount, which tears down the old WebSocket
 * and opens a new one. This avoids needing useEffect with a dependency array.
 */
export function useRenderProgress(jobId: string | null): RenderProgressState {
  const [state, setState] = useState<RenderProgressState>(INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);

  useMountEffect(() => {
    if (!jobId) return;

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
  });

  return state;
}
