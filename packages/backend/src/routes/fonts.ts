import { Hono } from "hono";
import { searchFonts, downloadGoogleFont, getVariantsForFamily } from "../services/google-fonts.js";

type AuthEnv = {
  Variables: { userId: string };
};

const fontsRouter = new Hono<AuthEnv>();

// GET /fonts/google — search Google Fonts catalog
// Query params: q (search), category (serif|sans-serif|display|handwriting|monospace), limit (default 20)
fontsRouter.get("/google", async (c) => {
  const q = c.req.query("q");
  const category = c.req.query("category");
  const limitRaw = c.req.query("limit");
  const limit = limitRaw ? Math.max(1, Math.min(100, parseInt(limitRaw, 10) || 20)) : 20;

  try {
    const fonts = await searchFonts(q, category, limit);
    return c.json({ fonts });
  } catch (err) {
    console.error("[fonts] search error", err);
    return c.json({ error: "Failed to fetch Google Fonts catalog" }, 502);
  }
});

// POST /fonts/google/download — download a Google Font to R2
// Body: { family: string, variant?: string }
fontsRouter.post("/google/download", async (c) => {
  let body: { family?: string; variant?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { family, variant = "regular" } = body;
  if (!family || typeof family !== "string") {
    return c.json({ error: "family is required" }, 400);
  }

  try {
    const result = await downloadGoogleFont(family.trim(), variant);
    return c.json({ r2Key: result.r2Key, family: result.family, variant: result.variant });
  } catch (err) {
    console.error("[fonts] download error", err);
    const message = err instanceof Error ? err.message : "Font download failed";
    return c.json({ error: message }, 502);
  }
});

// GET /fonts/google/:family/variants — list variants for a font family
fontsRouter.get("/google/:family/variants", async (c) => {
  const family = decodeURIComponent(c.req.param("family"));

  try {
    const variants = await getVariantsForFamily(family);
    return c.json({ family, variants });
  } catch (err) {
    console.error("[fonts] variants error", err);
    const message = err instanceof Error ? err.message : "Failed to fetch variants";
    const status = message.includes("not found") ? 404 : 502;
    return c.json({ error: message }, status);
  }
});

export default fontsRouter;
