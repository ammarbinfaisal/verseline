export interface TextSpan {
  text: string;
  styleId: string; // empty = default style
}

/**
 * Splits text containing <styleID>…</styleID> tags into spans.
 * Tags do not nest; an open tag must be closed before another opens.
 */
export function parseTextSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const openIdx = remaining.indexOf("<");
    if (openIdx < 0) {
      spans.push({ text: remaining, styleId: "" });
      break;
    }

    const closeAngle = remaining.indexOf(">", openIdx);
    if (closeAngle < 0) {
      spans.push({ text: remaining, styleId: "" });
      break;
    }

    const tagName = remaining.slice(openIdx + 1, closeAngle);
    if (
      tagName === "" ||
      tagName.startsWith("/") ||
      /[\s\t\n]/.test(tagName)
    ) {
      spans.push({ text: remaining.slice(0, closeAngle + 1), styleId: "" });
      remaining = remaining.slice(closeAngle + 1);
      continue;
    }

    const closeTag = `</${tagName}>`;
    const closeTagIdx = remaining.indexOf(closeTag, openIdx);
    if (closeTagIdx < 0) {
      spans.push({ text: remaining.slice(0, closeAngle + 1), styleId: "" });
      remaining = remaining.slice(closeAngle + 1);
      continue;
    }

    if (openIdx > 0) {
      spans.push({ text: remaining.slice(0, openIdx), styleId: "" });
    }

    const innerStart = closeAngle + 1;
    const innerEnd = closeTagIdx;
    spans.push({ text: remaining.slice(innerStart, innerEnd), styleId: tagName });
    remaining = remaining.slice(innerEnd + closeTag.length);
  }

  return spans;
}

/**
 * Strip <styleID>…</styleID> tags from text, preserving their content.
 */
export function stripStyleTags(text: string): string {
  return parseTextSpans(text)
    .map((s) => s.text)
    .join("");
}
