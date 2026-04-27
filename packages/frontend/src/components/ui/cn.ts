/**
 * Minimal classname joiner. Filters falsy. No clsx dep needed.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
