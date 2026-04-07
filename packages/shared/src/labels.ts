import type { Style, Placement, Font } from "./types";

export function generateStyleLabel(style: Style, fonts?: Font[]): string {
  const font = fonts?.find((f) => f.id === style.font);
  const family = font ? font.family : style.font;
  const parts = [`${family} ${style.size}px`];
  if (style.color) {
    parts.push(style.color);
  }
  return parts.join(" ");
}

export function generatePlacementLabel(placement: Placement): string {
  const anchor = placement.anchor.replace(/_/g, " ");
  const hasMarginX = placement.margin_x !== undefined && placement.margin_x !== 0;
  const hasMarginY = placement.margin_y !== undefined && placement.margin_y !== 0;
  if (hasMarginX || hasMarginY) {
    const mx = hasMarginX ? `+${placement.margin_x}` : "+0";
    const my = hasMarginY ? `+${placement.margin_y}` : "+0";
    return `${anchor} ${mx}/${my}px`;
  }
  return anchor;
}
