# Palimpsest — Design Spec

**Date:** 2026-07-04
**Status:** Approved (design sections §1–§3 approved in session)

## Concept

Overwritten, erased script layers as plotter art. Successive generations of asemic
writing occupy one manuscript page; each newer layer *erases* the older text beneath
it by **masked omission** — older marks are clipped out of the regions the new text
claims, so erasure reads as absence. The piece unites the Field Script asemic system
and the redaction systems as subject matter (erasure as lineage), extending the
art-historical framing of Field Script (Klee → Nake → Nees) toward the palimpsest
tradition.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Repo | Standalone project seeded with copied Field Script / redaction-plotter code — not a GitHub fork. **Local git only for now; GitHub repo + Pages deferred.** |
| Erasure model | Masked omission only (no redaction bars, no scribble strike-through, no tonal fading) |
| Layer differentiation | Rotation between layers |
| Layer count | Variable 2–4 per composition |
| Format | Portrait manuscript, 1630×2170 (3:4; keeps Field Script's 2170 long edge) |
| Ink & paper | Near-black warm ink on warm paper (#F7E6D4 family) + red rubrication accents (#A93B2A) |
| V1 scope | Maker UI + layered SVG export. No rating/learning system, no canon/specimen site in v1 |
| Approach | A — vector layer-stack compositor (exact polygon clipping; erasure survives into SVG) |

## §1 Project structure & architecture

**Location:** `/Users/lukasz/genuary-2026/sketches/palimpsest`, own git repo
(local-only until the user asks to publish; then `github.com/lukaszlysakowski/palimpsest`,
Pages from main root, homepage field set immediately).

**Files** (no-build idiom, matching field-script):

- `index.html` — maker UI: sidebar + portrait stage, styles, markup (adapted from Field Script's sidebar layout)
- `index.js` — all generation and export logic
- `p5.min.js` — vendored
- `README.md`, `LICENSE`, `.gitignore` (ignores `renders/`, `experiments/`, `.claude/` from day one to keep render output out of git history)

**Seeded code (copied and trimmed, with origin noted in comments):**

1. From field-script `index.js`: `subdivideCell` (recursive cell subdivision), `generateGlyphs` (glyph vocabulary), `wobble`, and the SVG export scaffolding with Inkscape layer groups.
2. From redaction-plotter `index.html`: geometry kit — `clipLineToPolygon`, `pointInPolygon`, `lineIntersection`, `getBounds`.

**Canvas:** 1630×2170. Manuscript margins ≈ 8% left/right, ≈ 10% top/bottom.

**Data model:** a composition is `layers[]`, oldest first.

```
layer = {
  seed,            // per-layer seed derived from master seed
  rotation,        // radians, applied about page centre
  coverage,        // fraction of page the layer occupies + region rect
  bandParams,      // wave frequency / density / depth for this layer
  glyphParams,     // scale, stroke style
  segments[],      // marks in layer-local coords; transformed to page space once
  maskPolys[]      // word-cluster footprint quads, page-space, padded
}
```

Plus top-level `rubrication[]` (red marks), `border`, `signature`. Every group maps
1:1 to an SVG pen-pass layer.

## §2 Generation & erasure algorithm

**Per-layer generation.** Each layer runs an adapted Field Script pass in its own frame:

- **Layer 0 (oldest):** horizontal bands, full-page extent, standard density wave.
- **Later layers:** rotation drawn from a weighted pool — 90° most likely, slight diagonals (±5–15°) next, rarely ~45°. Own seed, band frequency, glyph scale. **Partial coverage:** layer 1 occupies a randomized 60–90% sub-region; coverage shrinks for layers 2–3 (a later hand rarely rewrites the whole page).

**Mask emission.** Each layer records the bounding quads of its word clusters,
inflated by padding (scribe's breathing room). Rotated layers emit masks already
transformed to page space.

**Erasure.** Process oldest→newest: clip every segment of layer *i* against the
union of mask polygons of all layers newer than *i*, via `clipLineToPolygon`.
Fully-covered segments vanish; boundary-crossing segments trim at the exact
intersection. Rotated-layer segments are transformed to page space *before* clipping.

**Anti-mush budget** (safeguard for 3–4 layer stacks):

1. **Survival floor** — if a layer retains < ~25% of its pre-clip ink, release every other mask above it and re-clip once. Old text must stay present.
2. **Coverage decay** — newer layers get smaller coverage and tighter mask padding, so deep stacks read as accumulating annotations, not four full pages fighting.

**Variety.** Wave / density / depth apply per-layer, all derived from one master
seed, ranging from sparse two-hand fragments to dense four-generation stacks.

## §3 Rubrication, maker UI, export

**Rubrication (red pass).** After erasure, pick features weighted so most pieces get
1–2, rare pieces none or several:

- **Initial** — one oversized glyph at a band start on the newest layer, overdraw-heavy
- **Marginal annotation** — short glyph run in a side margin, slightly rotated
- **Rubricated run** — one word-cluster in a band swapped to red

Red marks are never erased (conceptually the newest ink) and plot last. #A93B2A.

**Palette.** Paper #F7E6D4 family; script ink near-black with warm cast (≈ #1A1613);
older layers use slightly lighter *stroke weight* (not lighter color) as a depth cue —
weight carries into the SVG.

**Maker UI** (Field Script sidebar idiom, portrait stage):

| Section | Controls |
|---|---|
| Layers | count (2 / 3 / 4 / random), rotation pool (Classic 90° / Diagonal / Mixed) |
| Field | wave, density, depth (applied per-layer from master seed) |
| Erasure | mask padding (Tight / Normal / Generous), survival floor on/off |
| Rubrication | None / Rare / Present / Rich |
| Style | wobble on/off |
| Actions | randomize, refresh (new seed, same params), SVG, PNG |

Click canvas = new seed with current params. Seed + timestamp signature at page foot.

**Export.**

- **SVG:** Inkscape layers, one pen pass each: `Border`, `Layer 1 (oldest)` … `Layer N`, `Rubrication`, `Signature`. Erasure is baked into geometry, so any subset of passes plots correctly.
- **PNG:** full-resolution raster.

## Verification

- Dev server entry in `.claude/launch.json`; preview screenshots across multiple seeds at each build milestone.
- SVG sanity check: reimport exported file, confirm expected layer-group count.
- Erasure invariant (console-runnable): no surviving segment of layer *i* intersects an active mask of any newer layer.

## Out of scope for v1

- Rating/learning system (strata-style) — candidate for v2
- Canon / specimen / curated-collection site — after enough seeds exist
- Plot-ready mm-sized and overdraw SVG variants (field-script has these; port later if needed)
- GitHub repo, Pages deployment — deferred by user; local git only until asked
