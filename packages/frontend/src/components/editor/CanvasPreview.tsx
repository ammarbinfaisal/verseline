"use client";

import type { Block, Style, Placement, Canvas } from "@verseline/shared";

interface CanvasPreviewProps {
  blocks: Block[];
  styles: Style[];
  placements: Placement[];
  canvas: Canvas;
  backgroundUrl?: string;
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

export default function CanvasPreview({ blocks, styles, placements, canvas, backgroundUrl }: CanvasPreviewProps) {
  const aspectRatio = canvas.width / canvas.height;

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700"
      style={{ aspectRatio, background: backgroundUrl ? `url(${backgroundUrl}) center/cover no-repeat` : "#18181b" }}
    >
      {blocks.map((block, i) => {
        if (!block.text) return null;

        const style = styles.find((s) => s.id === block.style);
        const placement = placements.find((p) => p.id === block.placement);
        const anchor = placement?.anchor ?? "bottom_center";
        const anchorStyle = ANCHOR_STYLES[anchor] ?? ANCHOR_STYLES["bottom_center"];

        // Approximate font size as percentage of canvas height
        const fontSizePx = style?.size ? `${(style.size / canvas.height) * 100}%` : "3%";
        const color = style?.color ?? "#ffffff";
        const fontFamily = style?.font ?? "sans-serif";

        // Render inline style tags as plain text for preview
        const displayText = block.text.replace(/<[^>]+>/g, "");

        return (
          <div
            key={block.id ?? i}
            className="absolute pointer-events-none"
            style={{
              ...anchorStyle,
              fontSize: fontSizePx,
              color,
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
            {displayText}
          </div>
        );
      })}

      {blocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs select-none">
          No blocks
        </div>
      )}
    </div>
  );
}
