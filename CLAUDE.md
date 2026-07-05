# Palimpsest — Generative Plotter Art

## Project
A p5.js generative art maker: manuscript pages where 2–4 rotated hands of asemic script erase the writing beneath them by masked omission. Portrait 1630×2170, plotter-ready SVG export. Public repo: https://github.com/lukaszlysakowski/palimpsest — live maker: https://lukaszlysakowski.github.io/palimpsest/

## Lineage
Extends two sibling projects (same author, same GitHub account):
- [Field Script](https://github.com/lukaszlysakowski/field-script) (`~/genuary-2026/sketches/asemic_writing`) — source of the asemic glyph/hand generation this project ports and rotates per layer.
- [redaction-plotter](https://github.com/lukaszlysakowski/redaction-plotter) — source of the polygon geometry kit (`segmentOutsideMasks`, `bezierOutsideMasks`, `pointInPolygon`) used for erasure clipping.

Design history: `docs/superpowers/specs/2026-07-04-palimpsest-design.md` and `docs/superpowers/plans/2026-07-04-palimpsest.md` — read these before making structural changes; several plan-stage bugs (subdivision seeding, determinism ordering, wobble parity) were found and fixed during implementation and are documented in the per-task review trail.

## Architecture
- `index.html` / `index.js` — single maker, no build step, p5.js vendored (`p5.min.js`)
- `state.layers[]` — oldest first; each layer independently generated in a local frame, transformed to page space via `toPage`
- Erasure: `emitMasks` + `eraseUnder` — masked omission with a survival floor (`checkErasureInvariant()` is the correctness check, runnable from the browser console)
- `state.rubrication[]` — red marks, generated last, never erased

## Key Parameters
- `ui.layerCount`, `ui.rotationPool` — layer count (2–4) and rotation scheme
- `ui.wave`, `ui.density`, `ui.depth` — band/glyph generation, ported from Field Script
- `ui.maskPadding`, `ui.survivalFloor` — erasure tuning
- `ui.rubrication` — red-mark quantity; see `RUBRIC_COUNT` in index.js for exact ranges per level (tuned up from initial defaults — `rare` now guarantees at least one red feature per seed)
- `ui.wobble` — hand-drawn jitter, shared seeding between canvas render and SVG export (`segToPath`/`drawSegment` must stay in sync — this was a real bug once, see plan review trail)

## Palette
Paper `#F7E6D4`, ink `#1A1613` (warm near-black, weight decreases with layer age), rubrication red `#A93B2A`.

## Controls
- Click canvas / Refresh — new seed
- Randomize — reroll every parameter + new seed
- Sidebar cycle-buttons — Layers (count, rotation), Field (wave, density, depth), Erasure (padding, survival floor), Rubrication (amount), Style (wobble)
- SVG — pen-pass layered export (Border / Layer 1…N / Rubrication / Signature)
- PNG — full-resolution raster

## Accessibility
Sidebar CSS variable `--muted` and `.ctrl` min-height were tuned for WCAG AA contrast (≥4.5:1) and tap-target size (≥24px) — Lighthouse accessibility score 100/100. Don't regress these if editing sidebar CSS.

## Out of Scope for v1
No rating/learning system (strata-style), no canon/specimen gallery site — both are candidate v2 work, following the pattern established in Field Script.
