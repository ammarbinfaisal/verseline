# Verseline — Design Spec

> Living document. Every UX/UI decision below lists the **options considered**, the **decision**, and **why**. The "Alternative to revisit" line at the bottom of each entry is what to reconsider in a v2.

---

## 0. Product summary (so design decisions stay grounded)

**Verseline is a desktop video editor for putting timed text on top of an audio or video, where the *same* configuration (style, placement, font, source asset) gets reused across many segments and across many projects.**

Primary workflows:

1. **Translation/transliteration overlay** — a recitation, lecture, or song. Audio is fixed; text changes per segment; style/placement is mostly static.
2. **Verbatim captioning** — speech is the audio; captions appear timed; placement static; style stable.
3. **Background swap/add/retain** — sometimes the source already has video, sometimes you supply background image/video; sometimes you keep the original.

Core friction the design must remove:
- **Reuse**: a style/placement/font defined once must apply to N segments and survive across projects (shared library).
- **Configurability**: pixel-perfect placement, not 9 anchor points; configurable shortcuts; configurable themes.
- **State legibility**: at any moment the user must see what's selected, what's playing, what's dirty, what the app expects next.

Non-goals:
- Mobile editing (desktop-first; mobile shows a hand-off screen).
- General-purpose video editing (we don't compete with CapCut).
- Effects/transitions (text fade is the only animation that matters).

---

## 1. Aesthetic direction (locked)

**Three words: _Editorial broadcast console_.**

- **Editorial** — typography matters. We're a tool for putting *words* on video. The host UI itself respects type.
- **Broadcast** — this is a console, not a webpage. Dense, information-rich, keyboard-driven, status-first. Think Avid/DaVinci/Resolve, not Notion.
- **Console** — calm, low-saturation surfaces; one or two strong accents; everything labelled; nothing decorative.

What this rules out (the AI tells we explicitly reject):
- Cyan-on-dark "AI dashboard" palette
- Purple→blue gradients
- Glassmorphism / translucent cards on overlays
- Card-everything layouts
- Centered hero on every page
- Bouncy easing
- "Clean and modern" as the entire identity

What this rules in:
- Asymmetric hero on the marketing/auth pages
- A real serif used sparingly for the wordmark and `h1`s — signals "we know type"
- A monospaced family for timecodes, IDs, file paths — broadcast convention
- Hue-shifted neutrals (warm darks, cool grays) — never `#000`/`#fff`
- One strong brand accent + one analytical secondary
- Dense status bars top and bottom of the editor (the broadcast console pattern)

**Alternative to revisit:** "warm industrial" (more orange, more grain, more analog warmth). We picked editorial-broadcast because the product is text-on-video — typography credibility outweighs warmth.

---

## 2. Color system

### 2.1 Palette decision

**Decision: split-complementary anchored on a desaturated teal-blue (`#3B6E7E`), with a warm amber accent (`#D88A3A`) for the primary CTA, and a cooler indigo-violet (`#6F6BC9`) reserved for "selected/active" highlights.**

Why split-complementary: gives us a calm dominant (teal-blue), one warm accent for action, one cool accent for state — three intentional roles instead of "indigo for everything."

Why teal-blue as base: web convention has trained users that blue = link/safe; analytical contexts (timecodes, durations, metadata) deserve a cool color (Ch 9 — red overloads prefrontal cortex; cool reads as "informational").

Why amber for CTA: warm advances → eye lands on it first (Ch 9). And it contrasts maximally with the dominant teal — the rule for accent colors.

Why violet for selected-state: distinguishes "selected" from "primary action" so we never confuse "this is what's currently active" with "this is what you should click next."

**Options considered**:
| Option | Why rejected |
|---|---|
| Pure indigo monochromatic (current) | No wheel relationship; can't tell action from selection from link |
| Cyan-on-dark | Top AI tell |
| Earthy/warm industrial (oranges + browns) | Wrong mood — verbatim captioning and Quranic recitation translation are *serious* contexts |
| Pure neutral grayscale + one accent | Loses the cool/warm depth from Ch 9 |

**Alternative to revisit:** triadic (teal, amber, magenta) if we ever add a third major UI region (e.g., collaborator presence) that needs its own color.

### 2.2 Tokens (CSS custom properties)

Defined once in `globals.css`, themed via `[data-theme]` on `<html>`. Tailwind utility classes consume these via arbitrary values like `bg-[var(--surface-1)]`.

```
Brand
  --brand-primary       teal-blue, the dominant
  --brand-primary-hi    1 step lighter for hover
  --brand-primary-lo    1 step darker for active
  --accent-warm         amber, for primary CTA
  --accent-warm-hi
  --accent-warm-lo
  --accent-cool         violet, for selected state
  --accent-cool-hi

Surfaces (3 layers, hue-shifted)
  --bg                  page background
  --surface-1           panels, cards
  --surface-2           inputs, raised elements
  --surface-3           modals, popovers

Text
  --text                primary copy (warm dark)
  --text-muted          secondary (cool gray)
  --text-faint          metadata, captions
  --text-on-accent      text on amber/teal CTAs

Borders & rules
  --border              default 1px line
  --border-strong       panel boundaries
  --divider             subtle row separator (only when alignment isn't enough)

Functional
  --error               red, hue-shifted toward warm
  --success             green, desaturated
  --warn                amber (same as accent-warm; user must read text not just color)
  --link                same as --brand-primary

Focus
  --focus-ring          violet (accent-cool) at 60% alpha
  --focus-ring-offset   matches --bg

Shadows (hue-shifted, never pure black)
  --shadow-sm           1px subtle
  --shadow-md           popovers
  --shadow-lg           modals
```

### 2.3 Themes

**Three themes** via `[data-theme="..."]`. Per user decision: `warm`, `light`, `dark`. System theme resolves to one of these based on `prefers-color-scheme` + a user toggle for "prefer warm in light mode."

1. **light** — neutral cool-paper background (`#F7F8FA`), warm dark text. The default for daytime working.
2. **warm** — sepia paper (`#F3EDE2`), warm-brown text. *This is also a light theme* — same luminance band as `light`, just rotated toward warm hues. Long editing sessions; reduces blue-light fatigue without going dark.
3. **dark** — deep cool background (`#0E1116`), warm-cream text. Night editing.

**System resolution:**
```
prefers-color-scheme: light → user.preferWarm ? "warm" : "light"
prefers-color-scheme: dark  → "dark"
```
The "prefer warm in light mode" toggle lives in Settings; when off (default), system maps to light. There's no `warm-dark` — the user explicitly scoped the warm variant to light mode.

**Why three, not four:**
- The user asked for warm + light + dark + system→warm-or-light. That's three themes; system is a *resolver*, not a fourth theme.
- One warm variant (light only) keeps the mental model simple. A warm-dark adds variants without a clear use case the user described.
- Each theme shifts *both* neutrals and brand hues — warm theme isn't "light + sepia tint", the brand teal also rotates toward green-teal, the amber CTA stays amber, the violet selection rotates toward red-violet. This keeps the split-complementary relationship intact across themes (Ch 9).

**Color theory for the three themes (decision-tree §9.1 of checklists, applied):**

| Step | Light | Warm | Dark |
|---|---|---|---|
| Mood | Calm / professional / focused | Ambient / paper / long-session | Mysterious / cinematic / focused |
| BG density | Content-heavy → off-white | Content-heavy → sepia paper | Content-heavy + low-light → deep navy-charcoal (not pure black) |
| Base hue | Cool teal-blue (200°) | Warm teal-green (175°) | Cool teal-blue (200°), brighter chroma |
| Scheme | Split-complementary (teal + amber + violet) | Split-complementary (teal-green + amber + red-violet) | Split-complementary, higher chroma, lower lightness |
| CTA | Amber — max contrast vs cool teal background | Amber — same hue, slightly desaturated to sit in the warm scheme | Amber — bright, ~80% lightness, pops off charcoal |
| Selected | Violet 8% fill + outline | Red-violet 8% fill + outline | Violet 12% fill (more chroma needed in dark) |
| Shadows | Cool-shifted (toward violet) | Warm-shifted (toward umber) | Inner-glow + dark cool-violet drop |
| Text primary | Warm dark `#1B1A1F` (avoids pure black, Ch 9) | Warm-brown dark `#2A1F12` | Warm cream `#EFE9DD` (avoids pure white) |
| Text muted | Cool gray `#6E727A` | Sepia mid `#7B6B53` | Cool gray-violet `#8E8997` |

Across all three: red = error (slightly desaturated to avoid prefrontal-cortex overload), green = success, blue stays in the link role (uses the same teal as `--brand-primary` so we don't have two competing blues).

**Accessibility / colorblindness:**
- Body text vs background: ≥7:1 (AAA) in all three themes.
- CTA text on amber: ≥4.5:1 (AA) — amber buttons use warm dark text, not white.
- Status pills (Saved / Unsaved / Saving / Error) **never** rely on color alone — always paired with an icon (✓ / ● / spinner / ⚠) and a text label. Verified against deuteranopia + protanopia simulations: dirty (amber+●) vs clean (gray+✓) is distinguishable by shape alone.
- Timeline-segment selection: violet fill *plus* a 2px outline *plus* a corresponding row highlight in the left list — three redundant cues.

**Options considered:**
- Tailwind v4 `@theme` blocks scoped under `[data-theme]`: chosen.
- Single CSS variable file with manual swap: rejected — themes need to swap brand hues too, not just neutrals.
- Use OKLCH directly: deferred — but the hex values were *derived* via OKLCH so perceptual lightness stays consistent (an OKLCH L=0.95 looks equally bright across the three themes).
- Add a fourth `warm-dark`: deferred — user explicitly scoped warm to light mode.

**Alternative to revisit:** `auto-warm-after-sunset` — switch to warm in the evening based on local time. Nice-to-have, not v1.

---

## 3. Typography

### 3.1 Font families

| Role | Family | Why |
|---|---|---|
| Display (wordmark, hero h1, section h1 on marketing/docs) | **Fraunces** (variable serif) | A modern serif with optical sizes — signals "we care about type." Used very sparingly. |
| Body / UI sans | **Geist Sans** (Vercel's open variable sans) | Realist sans, broad x-height, screen-optimized, free. Has a stated rationale beyond "looks clean." |
| Mono (timecodes, IDs, paths, kbd) | **Geist Mono** | Pairs by structure with Geist Sans (same designer, same skeleton) — Appendix shortcut: same designer = guaranteed pairing. |

**Options considered**:
- Inter for body: rejected — top AI tell, no rationale beyond "everyone uses it."
- IBM Plex Sans + IBM Plex Serif: legitimate alternative, equally good rationale (corporate-utility tradition). Marginally less display-y in headings.
- Söhne: not freely licensed.
- System font stack only: rejected — the host UI of a *type tool* shouldn't ship without a chosen font.

**Alternative to revisit:** swap Geist Sans for **IBM Plex Sans** if we want a more utilitarian, less "Vercel-coded" feel. Same structural class.

### 3.2 Type scale (3:4 ratio)

Eight steps, each ~1.333× the prior. Defined as CSS vars:

```
--fs-1: 11px    (caption, kbd, tick labels — minimum legible UI text)
--fs-2: 13px    (metadata, secondary)
--fs-3: 15px    (body, default)
--fs-4: 18px    (lead, section labels)
--fs-5: 22px    (h3)
--fs-6: 28px    (h2)
--fs-7: 38px    (h1, page heading)
--fs-8: 52px    (hero / display only)
```

No `text-[8px]` or `text-[10px]` anywhere. Timeline ruler labels go to 11px and density is reduced if too dense.

**Why 11px floor:** Ch 3 — below ~10px text rendering breaks. 11px at the user's typical 14–16px default is still ~70% — readable, not painful.

**Options considered**:
- 2:3 ratio (more aggressive jumps): too much whitespace between steps for a dense console.
- Major-third (1.25): too gentle; hierarchy disappears.
- Modular pure powers of 2 (8, 12, 16, 24, ...): chosen ratio is more flexible for headings.

**Alternative to revisit:** golden ratio (1.618) for the marketing pages only — still 3:4 inside the editor.

### 3.3 Line height & alignment

- Body: `line-height: 1.5` (between Ch 3's 1.2-1.4 recommendation and the docs page's current 1.625; 1.5 keeps even gray texture without spreading)
- UI: `line-height: 1.3`
- Headings: `line-height: 1.1`
- All text: `text-align: left` (ragged right). The home hero stops being centered.
- Paragraphs separated by spacing OR indent, never both. Pick spacing for web.

### 3.4 Smart quotes / proper dashes

Lint pass on JSX text literals: replace `"`/`'` with `“ ” ‘ ’` and `--` with `–` (en dash). New copy should be authored with the real characters.

---

## 4. Spacing & layout

### 4.1 Spacing scale (3:4)

```
--sp-1: 4px
--sp-2: 6px
--sp-3: 8px
--sp-4: 12px
--sp-5: 16px
--sp-6: 24px
--sp-7: 32px
--sp-8: 48px
--sp-9: 64px
```

Rule: padding and gap values pull from this scale. Tailwind `p-4`, `gap-3` etc. happen to map close — we'll standardize in the primitives.

### 4.2 Radius

Three tiers — kills the radius zoo (`rounded`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full` all coexisting).

```
--r-sm: 4px    (chips, kbd, color swatches, tag pills)
--r-md: 8px    (inputs, buttons, list items, segment cards)
--r-lg: 14px   (modals, top-level surfaces only)
--r-full       (only the play/pause button and avatar circles)
```

### 4.3 Shadows

```
--shadow-sm:  0 1px 2px  rgba(28, 24, 36, 0.10)   /* hue-shifted toward violet */
--shadow-md:  0 4px 12px rgba(28, 24, 36, 0.16)
--shadow-lg:  0 16px 48px rgba(28, 24, 36, 0.28)
```

Dark theme uses a shadow with *negative* lightness (subtle dark glow) plus an inner top highlight to mimic light hitting a raised surface.

### 4.4 Margins (Tschichold-style)

Auth/marketing pages: vertical margin = 1.5× horizontal. Docs page: outer left/right = 1× content width × 0.08; top/bottom = 1× content width × 0.12.

---

## 5. Motion

### 5.1 Tokens

```
--ease-out: cubic-bezier(0.2, 0, 0, 1)
--ease-in:  cubic-bezier(0.4, 0, 1, 1)
--dur-quick: 120ms   (state changes — hover, focus)
--dur-base:  200ms   (panel switches, segment selection)
--dur-slow:  320ms   (modal open/close)
```

**No bouncy/elastic easing. No `cubic-bezier(0.68, -0.55, 0.265, 1.55)` anywhere — the AI tell.**

### 5.2 Where motion is used

| Where | What | Why |
|---|---|---|
| Tab pill underline | slide between tabs | Shows the "current" element is the same thing in a new place |
| Selected-segment fill (timeline) | fade between violet states | Confirms selection; doesn't redraw |
| Modal open | scale 0.97 → 1.0 + fade | Origin from the trigger feels intentional |
| Toast | slide up from bottom-right | Status messages |
| Loading skeleton | gentle pulse (1.6s, 60% → 100% opacity) | Indicates not-yet-loaded shape |

**Where motion is NOT used:** hover states (just color change, no transform); list item enter/exit on creation (the segment list shouldn't dance every time you type); the canvas preview (zero animation — it's the deliverable).

`prefers-reduced-motion: reduce` collapses all to instant.

---

## 6. Information architecture & screens

### 6.1 Top-level surfaces

```
/                 marketing/landing (asymmetric hero)
/login, /signup   auth (split layout, not centered card)
/forgot-password, /reset-password
/projects         project list (dominant CTA + recent grid)
/projects/[id]    editor shell (the main thing)
/library          shared library (assets / styles / placements / fonts)
/settings         themes + shortcuts + account
/docs             documentation
```

### 6.2 Editor screen layout

```
+---------------------------------------------------------------+
| TOOLBAR  [Verseline · ProjectName]   [tabs]   [save]  [user]  |
+----+-------------------------------------------+--------------+
| L  |                                           |              |
| E  |           CANVAS PREVIEW                  |  RIGHT       |
| F  |                                           |  PANEL       |
| T  |                                           |  (Editor /   |
|    |                                           |   Styles /   |
| S  +-------------------------------------------+   Place /    |
| E  |    PLAYBACK CONTROLS                      |   Fonts /    |
| G  +-------------------------------------------+   Settings)  |
| S  |    TIMELINE (segments + ticks)            |              |
+----+-------------------------------------------+--------------+
| STATUS BAR  [canvas · fps · seg count]   [dirty? · saved-at]  |
+---------------------------------------------------------------+
```

Single dirty-save indicator: in the **status bar only**. Toolbar shows project name and tab pills; never the save state. (Fixes finding C5 from the audit.)

### 6.3 Always-visible state cues

- **Active segment**: 2px violet outline + 8% violet fill in the timeline + corresponding row in left list highlighted in the same violet.
- **Currently playing**: the play button is filled-amber instead of teal-outline.
- **Dirty**: status bar pill turns from neutral "Saved" to amber "● Unsaved — Ctrl+S".
- **Network in-flight**: cursor stays normal; an amber dot appears on the affected control + a low-key spinner. No global blocking spinner.
- **Selection on canvas placement**: handles + dashed outline + live coordinates label (e.g., `x: 38.2% · y: 71.5%`).
- **Focus**: visible 2px violet ring with 2px offset from the surface, on every interactive element. `:focus-visible` only — mouse clicks don't show the ring.

---

## 7. Free-form placement grid

### 7.1 Decision

**The placement editor is a 2D pin on a canvas-proportioned surface, not a 9-anchor picker.**

Coordinates stored as normalized (0.0–1.0) `x`, `y` — independent of the actual canvas resolution, so a placement saved on a 1920×1080 still looks right on 1280×720.

Anchor (top-left / center / bottom-right of the *text box itself* relative to the pin point) remains adjustable but defaults to "center". This is the fewest concepts that covers all cases.

Snap targets while dragging:
- Off (default)
- 1/12 grid (matches 12-col baseline)
- 1/8 grid (eighths — common for thirds + halves)
- 1/4 grid (quarters)

The 9 conventional anchors are still one click away as a "Quick anchors" row of buttons that *write into* the same x/y/anchor fields — they don't replace the free-form editor, they're shortcuts.

Margins (the old "X/Y offset from anchor in pixels") become an *advanced* override below a fold, expressed in pixels at canvas resolution. 90% of users will never touch it.

### 7.2 Reuse

A Placement has a name, an emoji-or-icon "tag" for visual recognition in lists, and is referenced by `id`. Updating the placement updates every block referencing it — that's the whole point of reuse.

A placement can be **saved to the shared library** (button on the editor) — then it's available from a "Library" picker in any future project.

### 7.3 Options considered

- Keep 9 anchors only: rejected per user request.
- Free-form *and* 9 anchors as separate concepts: too many ways to do the same thing.
- Pixel coordinates only (not normalized): breaks under canvas resize.

**Alternative to revisit:** add path-based animation later (placement keyframes over time). Out of scope v1.

---

## 8. Reuse / Shared library

### 8.1 Tiers

There are three tiers of "reusable thing":

1. **Project-local** — defined inside one project. Most styles/placements start here.
2. **User library** — saved to user's library, available to pick into any of *their* projects. Backed by existing `/library` API for assets; we extend for styles/placements/fonts (which already live on the project — we add a `library_styles`, `library_placements` flat list that the user can copy into a project).
3. **Built-in presets** — ships with the app, picks well-tested combinations (e.g., "verbatim-caption-bottom-third", "translation-overlay-top", "lyric-center"). Read-only. Users can fork to library.

### 8.2 UX in the editor

- A **"Save to library"** ghost button in the right-panel header of Style/Placement/Font editors.
- A **"Insert from library"** secondary button in the Style/Placement/Font tab headers, opens a popover listing the user's library + presets.
- The library page (`/library`) is the same data, just full-screen — for managing/deleting/renaming.

### 8.3 Why three tiers, not two

A v1 with no presets means new users see an empty library and have to design from scratch on day one. Built-in presets remove the cold-start.

**Alternative to revisit:** team library (sharing across users). Requires a billing model — out of scope.

---

## 9. State legibility — what the UI must always tell the user

Per the user's requirement: "buttons get focused or bordered or outlined or ui elements are obvious; the internal state and what the app expects is always reflected on the ui."

A checklist that every component must pass:

- [ ] Has a **default** state with clear affordance (button looks pressable, input looks editable).
- [ ] Has a **hover** state (color shift, never just opacity).
- [ ] Has a **focus-visible** state — 2px violet ring, 2px offset.
- [ ] Has an **active/pressed** state — momentary darken.
- [ ] Has a **disabled** state — 50% opacity + `cursor: not-allowed` + aria-disabled. Disabled buttons say *why* via tooltip.
- [ ] Has a **loading** state — replaces label with spinner of the same width to prevent layout shift.
- [ ] Has an **error** state — for inputs: red border + red helper text below, role="alert".
- [ ] Has a **selected** state if it's selectable — violet 8% fill + 2px violet outline.

The app expects the user to do something? **The control they should touch next has the strongest visual weight on screen** (size + color + maybe motion). Ex: empty Projects page — "Create your first project" is the largest CTA on the page, in amber, centered in a 60% viewport, with a `Cmd+N` hint underneath.

---

## 10. Configurable shortcuts

### 10.1 Decision

Shortcuts are stored in `localStorage` under `verseline.shortcuts.v1` as a flat map of `action → key combo`. A default mapping ships in code:

```
playPause              Space
save                   Cmd/Ctrl+S
duplicateSegment       Cmd/Ctrl+D
deleteSegment          Delete
seekForward1s          ArrowRight
seekBack1s             ArrowLeft
seekForward5s          Shift+ArrowRight
seekBack5s             Shift+ArrowLeft
nextSegment            J
prevSegment            K
splitSegment           S
toggleStylesPanel      1
togglePlacementsPanel  2
toggleFontsPanel       3
toggleSettingsPanel    4
focusSearch            /
escape                 Esc
```

Settings page has a **"Shortcuts"** section: each row is `Action · current binding · [Rebind] · [Reset]`. Click Rebind, capture the next keystroke, validate (no conflicts; some keys reserved), persist.

### 10.2 Why localStorage and not a server-side per-user prefs table

v1: localStorage. Ships fast, works offline. No backend changes.

v2 (alternative to revisit): server-side prefs synced across devices. Would require a `user_prefs` table with `user_id`, `key`, `value` (json) and a `/me/prefs` endpoint. Worth doing if/when teams ship.

### 10.3 Conflicts and reserved keys

Reserved (cannot be rebound): `Cmd+R` (browser reload), `Cmd+W` (close tab), `Cmd+T` (new tab), `Tab` (focus traversal), `F5`. Validation rejects these.

Conflicts within Verseline (e.g., user binds two actions to the same key): later binding wins, earlier one becomes "Unbound" with a yellow warning. User must rebind explicitly.

---

## 11. Component primitives

Lives under `packages/frontend/src/components/ui/`. Each primitive owns its states (default/hover/focus/active/disabled/loading/error/selected). Pages compose primitives, never raw `<button className=...>`.

| Primitive | Purpose |
|---|---|
| `<Button variant="primary|secondary|ghost|danger" size="sm|md|lg">` | Replaces every inline button |
| `<IconButton>` | Square button for toolbar icons; has tooltip slot |
| `<Input>` | Text/email/password/number with built-in error slot |
| `<Field label icon error help>` | Wraps Input with label + helper + error |
| `<Select>` | Native `<select>` styled to match Input |
| `<Textarea>` | |
| `<Kbd>k</Kbd>` | Keyboard chip; pulls binding from shortcut store |
| `<Toolbar>`, `<Toolbar.Group>`, `<Toolbar.Spacer>` | Top toolbar layout primitive |
| `<Panel>` | Surface-1 region with optional header/footer |
| `<Modal>` | Replaces native `confirm()`; focus trap; ESC closes |
| `<Toast>` | Bottom-right; auto-dismiss; queueable |
| `<Skeleton>` | Pulsing placeholder rectangles |
| `<Spinner size>` | Inline loading indicator |
| `<Tabs>`, `<Tab>` | Sliding underline indicator |
| `<EmptyState icon title body cta>` | Replaces every "No X yet" gray-text moment |
| `<StatusPill>` | Saved / Unsaved / Saving / Error states |

**Why primitives instead of a UI library (shadcn, Radix)**: we already have the shape; introducing a library would re-skin our work and add bundle weight. We do borrow Radix's *primitive boundary* idea — accessibility and keyboard handling baked in.

**Alternative to revisit:** adopt Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`, etc.) for the keyboard/focus correctness, while keeping our own styled wrappers. Strong v2 candidate.

---

## 12. Accessibility minimum

- Color contrast: AA for body text, AAA for primary CTAs.
- Every interactive element keyboard-reachable.
- Focus-visible ring on every interactive element.
- Modal focus trap + restore on close.
- Live regions (`role="status"`) for save state + render progress.
- One `<h1>` per page.
- Form errors announced via `aria-describedby`.
- `prefers-reduced-motion: reduce` collapses motion to instant.
- `prefers-color-scheme` respected when theme = system.

---

## 13. What changes in code, concretely (file plan)

```
packages/frontend/src/
├─ app/
│  ├─ globals.css              ← rewrite: tokens, scales, themes
│  ├─ layout.tsx               ← load fonts, set <html data-theme>
│  ├─ page.tsx                 ← asymmetric hero, kill centered card
│  ├─ docs/page.tsx            ← apply primitives
│  ├─ (auth)/layout.tsx        ← split layout, kill card-in-center
│  ├─ (auth)/login/page.tsx
│  ├─ (auth)/signup/page.tsx
│  ├─ (auth)/forgot-password/page.tsx
│  ├─ (auth)/reset-password/page.tsx
│  ├─ (dashboard)/layout.tsx   ← top nav + status bar slot
│  ├─ (dashboard)/projects/page.tsx
│  ├─ (dashboard)/projects/[id]/page.tsx
│  ├─ (dashboard)/library/page.tsx
│  ├─ (dashboard)/settings/page.tsx   ← NEW
├─ components/
│  ├─ ui/                      ← NEW: primitives
│  │  ├─ Button.tsx
│  │  ├─ IconButton.tsx
│  │  ├─ Input.tsx
│  │  ├─ Field.tsx
│  │  ├─ Select.tsx
│  │  ├─ Textarea.tsx
│  │  ├─ Kbd.tsx
│  │  ├─ Toolbar.tsx
│  │  ├─ Panel.tsx
│  │  ├─ Modal.tsx
│  │  ├─ Toast.tsx
│  │  ├─ Skeleton.tsx
│  │  ├─ Spinner.tsx
│  │  ├─ Tabs.tsx
│  │  ├─ EmptyState.tsx
│  │  └─ StatusPill.tsx
│  ├─ placements/
│  │  ├─ FreeformPlacementEditor.tsx  ← NEW: 2D pin
│  │  ├─ PlacementEditor.tsx          ← becomes thin wrapper
│  │  └─ AnchorPicker.tsx             ← becomes "quick anchors" row
│  ├─ editor/EditorShell.tsx   ← single status bar; primitives; remove duplicate save UI
│  └─ ... (rest get refactored to use primitives)
├─ lib/
│  ├─ shortcuts.ts             ← NEW: shortcut store + matcher
│  ├─ theme.ts                 ← NEW: theme reader/writer
│  └─ smart-quotes.ts          ← NEW: tiny util for typographically-correct strings in code
└─ stores/
   └─ settings-store.ts        ← NEW: theme + shortcuts persisted state
```

---

## 14. Order of execution (this loop)

1. **design.md** ← this file
2. **Tokens & themes** in `globals.css`
3. **Fonts** via `next/font`
4. **Primitives** under `components/ui/`
5. **Refactor flow**: editor + dashboard + auth pages to use primitives + tokens
6. **Free-form placement grid** + library save/insert UX
7. **Settings page**: themes + configurable shortcuts
8. **Brand pass**: marketing/auth visual personality, kill remaining AI tells
9. **Playwright tests** asserting UI behaviour AND the API/DB round-trip

Each phase sleeps for 30 minutes (per user request) once a chunk lands.

---

## 15. Open questions for the user (deferred, not blocking)

- Built-in presets — what should ship in v1? (Captioning bottom-third, lyrics center, translation top-third are obvious starting set.)
- Library quotas — is there a per-user storage cap on uploaded fonts/images?
- Render queue UI — out of audit scope; the existing WebSocket route hints at it. Likely deserves its own pass.
- Multi-language support for the host UI — not v1, but layout must avoid hard-coding English string widths.

---

## V2 — Plan for the next loop

> KICKOFF_AT: 2026-04-27T06:12Z (UTC).
> The user asked to defer this work by 6 hours and then run it straight through. Wake-up agent should NOT start before `KICKOFF_AT + 6h = 2026-04-27T12:12Z`. Runtime clamps single sleeps to 1hr; reschedule until the deadline passes, then execute every phase below in order without further pauses. Stick to instructions.md throughout (parallel-dev where coordination cost < time saved; smart-reuse only with a visible next consumer; useEffect ban — only `useMountEffect`).

### V2 scope (one sentence each)

1. **Backfill the legacy surfaces** the v1 pass deferred — `LibraryAssetCard`, `LibraryUploader`, `PexelsSearch`, `ProjectSettings`, `BlockEditor`, `FontList`, `FontBrowser`, `FontsTab`, `TimelinePanel`, `AnchorPicker`, `AssetUploader`, `TimestampInput` — all migrate from zinc/indigo + ad-hoc class soup to tokens + UI primitives.
2. **Server-backed preset library** — promote the localStorage v1 to a real `presets` table (rows for style / placement / font), with API endpoints, frontend store, and migration of any existing localStorage entries on first login.
3. **Identity + polish** — built-in presets ship in seed migration; design.md "alternative to revisit" items resolved; final brand pass on remaining marketing surfaces.
4. **Test coverage** for the new endpoints and the migrated UI surfaces.

### V2 phases (executed in order)

#### Phase V2.1 — Backend: presets table + endpoints
**Goal:** add a `presets` table and CRUD endpoints so frontend can read/write styles/placements/fonts at the user-library tier.

- Drizzle schema: new table `presets` with columns
  ```
  id uuid PK
  userId uuid FK → users.id (cascade delete)
  kind text  -- "style" | "placement" | "font"
  payload jsonb  -- the Style|Placement|Font object (validated via shared Zod)
  builtIn boolean default false  -- seeded global presets
  createdAt, updatedAt
  unique (userId, kind, (payload->>'id'))   -- prevents id collision per kind per user
  ```
- Drizzle migration generator (`db:generate`) + migration apply.
- New backend routes under `/presets`:
  ```
  GET    /presets                 list (filter by ?kind=style|placement|font)
  POST   /presets                 create or upsert (body: {kind, payload})
  PUT    /presets/:id             update payload
  DELETE /presets/:id             remove
  GET    /presets/builtin         shipped presets (no auth)
  ```
- Zod-validate `payload` against the matching shared schema (StyleSchema / PlacementSchema / FontSchema).
- Acceptance: `tsc --noEmit` clean on backend; manual curl confirms CRUD + auth + ownership scoping; cannot read another user's presets.

#### Phase V2.2 — Frontend: preset store + API client
- Extend `lib/api.ts` with `api.presets.{list, get, upsert, delete, listBuiltIn}`.
- Replace `lib/preset-library.ts` with a thin compat shim that ALSO consumes the new server store, so call sites don't need to change. Keep the localStorage fallback for offline; add a one-shot migration on first authenticated load that POSTs every localStorage entry as a server preset, then clears it.
- `library-store.ts` swap: `saveStylePreset / savePlacementPreset / saveFontPreset` go through `api.presets.upsert`. List getters become async (rename `listStylePresets` → `loadStylePresets` returning `Promise<Style[]>`, with cached results in store state).
- `PresetPicker` component: change `list` prop to receive cached store array, fall back to triggering `loadStylePresets()` if empty.
- Acceptance: round-trip e2e test (saveToLibrary → reload page → preset still in picker → pick into a fresh project).

#### Phase V2.3 — Built-in presets: seed migration
- Drizzle migration that inserts global `builtIn=true` rows owned by a sentinel user (or a NULL userId allowed via a check constraint — pick whichever is simpler given the existing schema).
- Seeded set:
  - Placements: `caption-bottom-third` (x .5 / y .85), `lyric-center` (x .5 / y .5), `translation-top-third` (x .5 / y .15), `lower-third-left` (x .15 / y .85), `chyron-bottom-left` (x .1 / y .9).
  - Styles: `caption-default` (sans 36px white + 4px black outline), `caption-emphasis` (sans 48px amber), `translation-cool` (sans 32px cool gray), `lyric-display` (display 60px white + shadow).
  - Fonts: just `geist-sans` and `fraunces` references — actual font files are loaded via next/font, this is metadata for picker labels.
- The picker shows `builtIn` rows in a separate "Presets" section above the user's saved set. They can be picked but not deleted; "Remove" button hidden when `builtIn`.
- Acceptance: a fresh user signs up → opens placements panel → built-in presets appear in the library picker.

#### Phase V2.4 — Migrate deferred legacy surfaces (parallel batch)
Per instructions.md `block:parallel-dev`: these are independent files; the contract is "use the UI primitives + CSS tokens already shipped in v1." No new contracts to lock; coordination cost is near-zero. Worth splitting into 2–3 worktrees if the time saved exceeds the merge cost. For a single-pass loop with no merge cost, do them sequentially in this order (smallest blast radius first):

1. `components/common/TimestampInput.tsx` — Field + Input
2. `components/placements/AnchorPicker.tsx` — already partially right; tokenise + add focus-visible
3. `components/fonts/FontList.tsx`, `FontsTab.tsx`, `FontBrowser.tsx` — tokens, EmptyState, primitives
4. `components/editor/BlockEditor.tsx` — Field/Select/Input
5. `components/editor/TimelinePanel.tsx` — drop legacy zinc, replace with tokens
6. `components/library/LibraryAssetCard.tsx`, `LibraryUploader.tsx` — Button, Skeleton, EmptyState
7. `components/library/PexelsSearch.tsx` — Tabs, Input, EmptyState (the largest of the lot)
8. `components/project/AssetUploader.tsx` — Field, Input, Button
9. `components/project/ProjectSettings.tsx` — full Field/Input/Select pass

**Acceptance:** grep `bg-zinc-\|text-zinc-\|border-zinc-\|indigo-\|rounded-2xl\|rounded-xl` across `src/components` returns ≤ a handful of intentional cases (e.g., the home-page editor preview SVG which deliberately uses `--canvas-frame`).

#### Phase V2.5 — Resolve §-by-§ "alternative to revisit" callouts
For each "Alternative to revisit" line in design.md §1–§14, decide whether to upgrade or close:

- §1 (warm industrial vs editorial broadcast) → close, keep current.
- §2.1 (triadic palette for collaborator presence) → close, no collab feature in scope.
- §3.1 (IBM Plex Sans alternative) → close, keep Geist.
- §3.2 (golden ratio for marketing) → close, 3:4 wins for consistency.
- §6 (placement keyframe animation) → defer, file an issue note.
- §7 (team library) → defer, file an issue note.
- §10.2 (server-side prefs sync) → **execute** as part of V2.6 below.
- §11 (Radix UI primitives) → defer, file an issue note. Our primitives have shipped and are working.

Output: a small "V2.5 — Decisions" appendix in design.md that records what closed vs deferred so V3 has clean ground.

#### Phase V2.6 — Server-side prefs (theme + shortcuts)
- New `user_prefs` table: `userId PK, theme text, preferWarmInLight boolean, shortcuts jsonb, updatedAt`.
- Endpoints `GET /me/prefs` and `PUT /me/prefs`.
- `settings-store.ts`: on `loadUser` complete, fetch prefs and merge into local state (server wins). On any setter, write through to server (debounced 400ms) AND localStorage (instant local fallback).
- Migration: first authenticated load reads any localStorage values, pushes them as the initial server payload, server returns 201, store updates.
- Acceptance: change theme on machine A, reload on machine B (via test using two browser contexts), theme matches.

#### Phase V2.7 — Test coverage extension
- New `e2e/presets-server.spec.ts`:
  - signup → save style preset → POST `/presets` returns 200 → reload → preset still in picker via `GET /presets`
  - cross-user isolation: user A creates preset, user B's `GET /presets` does not include it
  - built-in presets visible to all users; `DELETE /presets/:id` for builtIn returns 403
- New `e2e/prefs-sync.spec.ts`:
  - change theme in one context; in second context `GET /me/prefs` reflects it within 1s (debounce window)
  - rebind shortcut, reload, binding persists from server
- Update `editor-deep.spec.ts` for any text/role drift introduced by V2.4.

#### Phase V2.8 — Final pass
- `tsc --noEmit` clean across frontend AND backend.
- `next build` clean.
- `bun run db:generate` produces no pending diffs.
- Append a "V2 — What shipped" section to design.md with the actual diff between v1 and v2 (not the plan).

### V2 fixed contracts (lock these before parallelising)

So a parallel sub-track can proceed without re-reading every store:

```
// New shared types — packages/shared/src/preset.ts (added in V2.1)
export const PresetKindSchema = z.enum(["style", "placement", "font"]);
export type PresetKind = z.infer<typeof PresetKindSchema>;

export const PresetRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),  // null = built-in
  kind: PresetKindSchema,
  payload: z.union([StyleSchema, PlacementSchema, FontSchema]),
  builtIn: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PresetRecord = z.infer<typeof PresetRecordSchema>;

// Frontend api surface (added to lib/api.ts in V2.2)
api.presets = {
  list: (kind?: PresetKind) => Promise<PresetRecord[]>,
  upsert: (kind: PresetKind, payload: Style|Placement|Font) => Promise<PresetRecord>,
  delete: (id: string) => Promise<void>,
  listBuiltIn: () => Promise<PresetRecord[]>,
};

// Frontend store change (library-store.ts)
saveStylePreset(s)     -> Promise<void>   // unchanged signature, body now hits api.presets
listStylePresets()     -> Style[]         // returns cached; trigger loadStylePresets() to refresh
loadStylePresets()     -> Promise<Style[]>  // NEW
// Same for placement and font.
```

### V2 risks / known unknowns
- Drizzle migration on a project with existing data: needs to be additive (new table only), no destructive changes. Verify with a fresh `bun run db:generate` that it produces only `CREATE TABLE` statements.
- The seed migration for built-in presets must be idempotent — re-running it should not create duplicates. Use `INSERT … ON CONFLICT DO NOTHING` keyed on `(builtIn, kind, payload->>'id')`.
- The localStorage → server migration in V2.2 must run exactly once per user per browser. Use a `verseline.preset-library.migrated.v1` flag.
- `PUT /me/prefs` debouncing: client-side only; server can accept high-frequency writes since it's a single row per user.

---

## V2.5 — Decisions on v1 "alternative to revisit" callouts

Each callout from v1 is closed (kept current) or deferred (filed as a future-V issue note) below. No callouts get upgraded in v2 except §10.2, which becomes V2.6.

| Callout | Section | Decision | Reason |
|---|---|---|---|
| Warm-industrial vs editorial-broadcast aesthetic | §1 | **Close — keep editorial-broadcast** | The product is *type on video*. An aesthetic that puts typography at the centre is non-negotiable. |
| Triadic palette for collaborator presence | §2.1 | **Close — keep split-complementary** | No collaboration feature in scope; introducing a third major hue without a use case dilutes the wheel relationship. |
| IBM Plex Sans alternative to Geist | §3.1 | **Close — keep Geist** | Geist + Geist Mono share a designer skeleton (the "n test" passes by construction). Plex would be equally valid; switching costs nothing useful. |
| Golden-ratio scale for marketing pages | §3.2 | **Close — keep 3:4 everywhere** | Two scales would be one ratio too many. The marketing pages use the same scale as the editor; the hero is `--fs-8` and that's enough contrast. |
| Placement keyframe animation | §6 | **Defer — V3 candidate** | Real demand from the verbatim-captioning workflow is unclear. File when a user asks. |
| Team library | §7 | **Defer — V3 candidate** | Requires a billing model and per-team scope. Personal library + built-ins covers v1+v2. |
| Server-synced prefs (theme + shortcuts) | §10.2 | **Promote → V2.6** | The user explicitly asked for cross-device sync. Built in this loop. |
| Adopt Radix UI primitives | §11 | **Defer — V3 candidate** | Our primitives ship and work. A swap is justified only when we hit a Radix-specific accessibility win (focus management for combobox / popover patterns we don't have yet). |
| Auto-warm-after-sunset theme | §2.3 | **Defer — V3 candidate** | A nice toy, no requested user value. The "prefer warm in light mode" toggle in V2.6 covers the daytime case. |

---

## V2 — What shipped

The actual diff between v1 and v2. Maps directly to the §V2.1–§V2.8 plan above.

### Backend

- **`presets` table** — `userId` nullable for built-ins, `kind` enum-checked (style/placement/font), jsonb `payload`, `builtIn` boolean, indexes on `(user, kind)` and `(builtIn, kind)`, unique index on `(user, kind, payload->>'id')` to dedupe ids per scope.
- **`user_prefs` table** — one row per user keyed by `userId` PK, FK cascade-deleted with `users`. Holds `theme`, `preferWarmInLight`, `shortcuts` jsonb override map, `updatedAt`.
- **`/presets` route** — `GET /` (user + built-ins merged), `GET /builtin` (no auth), `POST /` (upsert keyed on payload-id), `PUT /:id`, `DELETE /:id`. Strict ownership scoping; built-in mutations return 403.
- **`/me/prefs` route** — `GET` creates a default row on first call; `PUT` accepts a partial body with Zod-validated theme enum and shortcut map.
- **`scripts/seed-presets.ts`** — idempotent seed for the v1 catalogue (5 placements, 4 styles, 2 font references). `bun run db:seed-presets`.

### Shared

- **`PresetKindSchema`, `PresetRecordSchema`, `validatePresetPayload`** — kind-dispatched parse against the matching project-level schema.

### Frontend — store + API

- **`api.presets.{list, listBuiltIn, upsert, delete}`** — all routes wired.
- **`api.me.{getPrefs, putPrefs}`** — theme + shortcut sync.
- **`library-store`** rewrite — caches `PresetRecord[]` in state, sync getters return filtered cache, async `loadPresets()` hydrates from `/presets`. One-shot localStorage→server migration runs on first load and sets `verseline.preset-library.migrated.v1`.
- **`settings-store`** rewrite — every setter still writes through to localStorage (offline-fast) and now debounces (400ms) a `PUT /me/prefs`. `hydrateFromServer()` runs once after auth load: on first contact (no `verseline.settings.hydrated.v1` flag) it pushes local up so users keep their pre-sync prefs; on subsequent loads server wins. Failures don't surface — they fall back to whatever local already has.

### Frontend — UI surfaces

- **`PresetPicker`** — now consumes `PresetRecord[]` directly from the store. Sections built-in vs user-owned. Hides Remove on built-in rows. Triggers `loadPresets` on first open.
- **Legacy surface migration (V2.4)** — every component touched: `TimestampInput`, `FontList/FontsTab/FontBrowser`, `BlockEditor`, `LibraryAssetCard/LibraryUploader/PexelsSearch`, `AssetUploader`, `StyleEditor`, `StyleTagAutocomplete`, `CanvasPreview`, `/library` page, the inline editor `SettingsPanel`. Acceptance grep returns zero hits for `bg-zinc-`, `text-zinc-`, `border-zinc-`, `indigo-`, `rounded-2xl` across `src/`.
- **Dashboard layout** — calls `hydrateFromServer()` after `loadUser()` settles.
- **Dead code removal** — `TimelinePanel.tsx`, `AnchorPicker.tsx`, `ProjectSettings.tsx` (all parallel implementations never imported anywhere).

### Frontend — tests

- **`e2e/presets-server.spec.ts`** — round-trip, cross-user isolation, built-in protection.
- **`e2e/prefs-sync.spec.ts`** — theme + shortcut sync across browser contexts (waits 400ms debounce + verifies server payload + hydrates fresh context).
- **Total**: 60 Playwright tests across 7 spec files (was 55 across 5 in v1).

### Verification

- `tsc --noEmit` clean on both `packages/frontend` and `packages/backend`.
- `next build` ships all 12 routes (vs 11 in v1; `/settings` was added in v1's loop).
- `bunx drizzle-kit generate` shows the two new tables (`presets`, `user_prefs`) and only those — no destructive diffs to existing tables. The local `drizzle/` output is gitignored per team convention; teammates run `bun run db:generate && bun run db:migrate` themselves to apply, then `bun run db:seed-presets` to populate built-ins.

### Bundle impact

| Route | Before V2 | After V2 |
|---|---|---|
| `/library` | 5.19 kB | 6.02 kB |
| `/projects/[id]` | 19.7 kB | 20.6 kB |
| `/settings` | 3.64 kB | 3.79 kB |
| First-load JS shared | 102 kB | 102 kB |

(All other routes unchanged.)

### What remains for V3 (per §V2.5)

- Placement keyframe animation, team library, server prefs polish (e.g., conflict resolution UI), Radix swap if a complex popover/combobox lands, auto-warm-after-sunset.
