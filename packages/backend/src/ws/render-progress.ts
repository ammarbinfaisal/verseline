/**
 * WebSocket handler for real-time render progress.
 *
 * Route: GET /ws/render/:jobId
 *
 * Upgrades the connection and polls the renderJobs table every 500 ms,
 * pushing JSON messages to the client until the job reaches a terminal state.
 *
 * Message shape:
 *   { percent: number, status: string, outputUrl?: string, error?: string }
 */

import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { renderJobs } from "../db/schema.js";
import { getPresignedDownloadUrl } from "../services/storage.js";

type AuthEnv = {
  Variables: { userId: string };
};

const POLL_INTERVAL_MS = 500;
const TERMINAL_STATUSES = new Set(["done", "failed"]);

const renderProgressRouter = new Hono<AuthEnv>();

renderProgressRouter.get(
  "/:jobId",
  upgradeWebSocket((c) => {
    // c.req.param may return undefined if route doesn't match, guard with fallback
    const jobId = c.req.param("jobId") ?? "";

    let timer: ReturnType<typeof setInterval> | undefined;

    return {
      async onOpen(_event, ws) {
        if (!jobId) {
          ws.send(JSON.stringify({ percent: 0, status: "not_found", error: "Missing jobId" }));
          ws.close(1008, "Missing jobId");
          return;
        }

        const poll = async () => {
          try {
            const [job] = await db
              .select({
                id: renderJobs.id,
                projectId: renderJobs.projectId,
                status: renderJobs.status,
                progress: renderJobs.progress,
                outputKey: renderJobs.outputKey,
                error: renderJobs.error,
              })
              .from(renderJobs)
              .where(eq(renderJobs.id, jobId))
              .limit(1);

            if (!job) {
              ws.send(
                JSON.stringify({ percent: 0, status: "not_found", error: "Job not found" }),
              );
              ws.close(1008, "Job not found");
              return;
            }

            const percent = Math.round((job.progress ?? 0) * 100) / 100;
            const msg: {
              percent: number;
              status: string;
              outputUrl?: string;
              error?: string;
            } = { percent, status: job.status };

            if (job.error) {
              msg.error = job.error;
            }

            if (job.status === "done" && job.outputKey) {
              try {
                msg.outputUrl = await getPresignedDownloadUrl(job.outputKey, 3600);
              } catch {
                // non-fatal — client can poll REST endpoint for the URL
              }
            }

            ws.send(JSON.stringify(msg));

            if (TERMINAL_STATUSES.has(job.status)) {
              if (timer !== undefined) {
                clearInterval(timer);
                timer = undefined;
              }
              ws.close(1000, "Job complete");
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            ws.send(JSON.stringify({ percent: 0, status: "error", error: message }));
            if (timer !== undefined) {
              clearInterval(timer);
              timer = undefined;
            }
            ws.close(1011, "Internal error");
          }
        };

        // Run immediately, then on every interval
        await poll();
        timer = setInterval(poll, POLL_INTERVAL_MS);
      },

      onClose() {
        if (timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
        }
      },

      onError(_event, ws) {
        if (timer !== undefined) {
          clearInterval(timer);
          timer = undefined;
        }
        ws.close(1011, "WebSocket error");
      },
    };
  }),
);

export default renderProgressRouter;
