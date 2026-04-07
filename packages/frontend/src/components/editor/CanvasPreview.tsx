"use client";

import { useMemo } from "react";
import type { Block, Style, Placement, Canvas } from "@verseline/shared";
import { parseTextSpans, tsToMillis } from "@verseline/shared";

interface CanvasPreviewProps {
  blocks: Block[];
  styles: Style[];
  placements: Placement[];
  canvas: Canvas;
  backgroundUrl?: string;
  backgroundType?: "image" | "video";
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  currentTimeMs?: number;
  allSegments?: Array<{ start: string; end: string; blocks: Block[] }>;
}

const ANCHOR_STYLES: Record<string, { top?: string; bottom?: string; left?: string; right?: string; transform?: string; textAlign?: "left" | "center" | "right" }> = {
  top_left:      { top: "5%", left: "5%" },
  top_center:    { top: "5%", left: "50%", transform: "translateX(-50%)", textAlign: "center" },
  top_right:     { top: "5%", right: "5%", textAlign: "right" },
  center_left:   { top: "50%", left: "5%", transform: "translateY(-50%)" },
  center:        { top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" },
  center_right:  { top: "50%", right: "5%", transform: "translateY(-50%)", textAlign: "right" },
  bottom_left:   { bottom: "5%", left: "5%" },
  bottom_center: { bottom: "5%", left: "50%", transform: "translateX(-50%)", textAlign: "center" },
  bottom_right:  { bottom: "5%", right: "5%", textAlign: "right" },
};

export default function CanvasPreview({
  blocks,
  styles,
  placements,
  canvas,
  backgroundUrl,
  backgroundType = "image",
  videoRef,
  currentTimeMs,
  allSegments,
}: CanvasPreviewProps) {
  const colorMap = useMemo(
    () => Object.fromEntries(styles.map((s) => [s.id, s.color ?? ""])),
    [styles],
  );

  const visibleBlocks = useMemo(() => {
    if (currentTimeMs !== undefined && allSegments !== undefined) {
      const active = allSegments.filter(
        (seg) =>
          tsToMillis(seg.start) <= currentTimeMs &&
          currentTimeMs < tsToMillis(seg.end),
      );
      return active.flatMap((seg) => seg.blocks);
    }
    return blocks;
  }, [blocks, currentTimeMs, allSegments]);

  return (
    <div
      className="relative max-h-full max-w-full mx-auto overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700"
      style={{
        aspectRatio: canvas.width / canvas.height,
        background: backgroundUrl && backgroundType !== "video" ? undefined : "#18181b",
      }}
    >
      {backgroundType === "video" && backgroundUrl ? (
        <video
          ref={videoRef}
          src={backgroundUrl}
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : backgroundType === "image" && backgroundUrl ? (
        <img
          src={backgroundUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : null}

      {visibleBlocks.map((block, i) => {
        if (!block.text) return null;

        const style = styles.find((s) => s.id === block.style);
        const placement = placements.find((p) => p.id === block.placement);
        const anchor = placement?.anchor ?? "bottom_center";
        const anchorStyle = ANCHOR_STYLES[anchor] ?? ANCHOR_STYLES["bottom_center"];

        const fontSizePx = style?.size ? `${(style.size / canvas.height) * 100}%` : "3%";
        const baseColor = style?.color ?? "#ffffff";
        const fontFamily = style?.font ?? "sans-serif";

        const spans = parseTextSpans(block.text);

        return (
          <div
            key={block.id ?? i}
            className="absolute pointer-events-none"
            style={{
              ...anchorStyle,
              fontSize: fontSizePx,
              color: baseColor,
              fontFamily,
              lineHeight: style?.line_height ? style.line_height / 100 : 1.2,
              maxWidth: "90%",
              wordBreak: "break-word",
              textShadow: style?.shadow_color
                ? `0 ${style.shadow ?? 2}px 0 ${style.shadow_color}`
                : undefined,
              WebkitTextStroke: style?.outline
                ? `${style.outline}px ${style.outline_color ?? "#000"}`
                : undefined,
              textAlign: anchorStyle.textAlign ?? "left",
              background: style?.text_bg ?? undefined,
              padding: style?.text_bg_pad ? `${style.text_bg_pad}px` : undefined,
              borderRadius: style?.text_bg_radius ? `${style.text_bg_radius}px` : undefined,
            }}
          >
            {spans.map((span, j) => (
              <span
                key={j}
                style={span.styleId ? { color: colorMap[span.styleId] || baseColor } : undefined}
              >
                {span.text}
              </span>
            ))}
          </div>
        );
      })}

      {visibleBlocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs select-none">
          No blocks
        </div>
      )}
    </div>
  );
}
