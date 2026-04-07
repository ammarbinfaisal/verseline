import { createMiddleware } from "hono/factory";
// @ts-expect-error no type declarations
import geoip from "geoip-country";

const ALLOWED_COUNTRIES = new Set(
  (process.env.ALLOWED_COUNTRIES ?? "IN").split(",").map((c) => c.trim().toUpperCase()),
);

// Set to "false" to disable geo-blocking entirely
const GEO_BLOCK_ENABLED = process.env.GEO_BLOCK_ENABLED !== "false";

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string | null {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return c.req.header("x-real-ip") ?? null;
}

export const geoMiddleware = createMiddleware(async (c, next) => {
  if (!GEO_BLOCK_ENABLED) return next();

  const ip = getClientIp(c);
  if (!ip) return next(); // can't determine IP, allow (localhost, etc.)

  // Allow private/local IPs
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.")
  ) {
    return next();
  }

  const geo = geoip.lookup(ip);
  if (!geo) return next(); // unknown IP, allow

  if (!ALLOWED_COUNTRIES.has(geo.country)) {
    return c.json({ error: "This service is not available in your region." }, 403);
  }

  return next();
});
