export type Millis = number;

/**
 * Parse "SS.mmm" into seconds and milliseconds.
 */
function parseSsAndMs(s: string): { ss: number; ms: Millis } {
  const parts = s.split(".");
  if (parts.length === 2) {
    const ss = parseInt(parts[0], 10);
    if (isNaN(ss)) throw new Error(`invalid seconds: ${parts[0]}`);
    const frac = parts[1];
    let ms: Millis = 0;
    for (let i = 0; i < 3; i++) {
      ms *= 10;
      if (i < frac.length) {
        const d = frac.charCodeAt(i) - 48; // '0' = 48
        if (d < 0 || d > 9) throw new Error(`invalid fractional digit: ${frac[i]}`);
        ms += d;
      }
    }
    return { ss, ms };
  }
  if (parts.length === 1) {
    const ss = parseInt(parts[0], 10);
    if (isNaN(ss)) throw new Error(`invalid seconds: ${parts[0]}`);
    return { ss, ms: 0 };
  }
  throw new Error(`unexpected format in seconds component: ${s}`);
}

/**
 * Parse a timestamp string (HH:MM:SS.mmm, MM:SS.mmm, or SS.mmm) to milliseconds.
 */
export function tsToMillis(ts: string): Millis {
  const comps = ts.split(":");
  let hh = 0;
  let mm = 0;
  let idx = 0;

  switch (comps.length) {
    case 3:
      hh = parseInt(comps[idx], 10);
      if (isNaN(hh)) throw new Error(`invalid hours: ${comps[idx]}`);
      idx++;
    // fallthrough
    case 2:
      mm = parseInt(comps[idx], 10);
      if (isNaN(mm)) throw new Error(`invalid minutes: ${comps[idx]}`);
      idx++;
    // fallthrough
    case 1: {
      const { ss, ms } = parseSsAndMs(comps[idx]);
      return hh * 3600000 + mm * 60000 + ss * 1000 + ms;
    }
    default:
      throw new Error(`unexpected number of components in timestamp (${comps.length})`);
  }
}

/**
 * Convert milliseconds to HH:MM:SS.mmm timestamp string.
 */
export function millisToTs(millis: Millis): string {
  const sign = millis < 0 ? "-" : "";
  let m = Math.abs(millis);
  const hh = Math.floor(m / 3600000);
  m %= 3600000;
  const mm = Math.floor(m / 60000);
  m %= 60000;
  const ss = Math.floor(m / 1000);
  const ms = m % 1000;
  return `${sign}${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

/**
 * Convert milliseconds to seconds as a float (for FFmpeg).
 */
export function millisToSecs(millis: Millis): number {
  return millis / 1000;
}
