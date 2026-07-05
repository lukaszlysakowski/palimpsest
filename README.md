# Palimpsest

**Overwritten · erased · rubricated** — generative manuscript pages where successive hands of asemic script erase the writing beneath them.

**[Live demo →](https://lukaszlysakowski.github.io/palimpsest/)**

---

## Origin

A palimpsest is a manuscript page scraped clean and written over, the older text surviving as ghost traces beneath the new. This project stages that process as vector geometry: 2–4 generations of asemic writing occupy one portrait page, and each newer hand *erases* the text below it by *masked omission* — older marks are clipped out of the regions the new writing claims, so erasure reads as absence rather than as a mark.

Palimpsest is the first piece to unite two earlier systems as subject matter rather than technique: the asemic script grammar of [Field Script](https://github.com/lukaszlysakowski/field-script) (itself a homage to Nake's *Hommage à Paul Klee*) supplies the writing, and the redaction systems' polygon-clipping geometry supplies the erasure. What redaction hides with a black bar, the palimpsest hides by scraping away.

---

## The System

**Layers.** Each composition stacks 2–4 script layers, oldest first. Every layer is an independent Field-Script-derived hand — recursive cell subdivision into word-cluster bands, filled from a vocabulary of eight bezier glyph types or Schotter-style line strokes (chosen per layer). Layer 0 writes horizontally across the full page. Each later hand writes at an angle — 90° across the old text in the classic manner of reused parchment, slight ±5–15° diagonals, or a rare 45° — and claims a shrinking sub-region of the page (a later scribe rarely rewrites the whole leaf).

**Erasure.** As each layer generates, it emits padded mask polygons around its word clusters. Older layers' strokes are then clipped against the union of all newer layers' masks with exact vector geometry: straight strokes are trimmed at the precise intersection, and curves that touch a mask are flattened into eight trimmed pieces. The newest hand is never clipped. Erasure boundaries survive into the SVG untouched — what plots is what you see.

**Survival floor.** Old text must remain *present*, not obliterated. If a layer would retain less than a quarter of its ink, every other mask above it is released and the layer re-clips once — deep 4-layer stacks read as accumulating annotations rather than mush.

**Rubrication.** After erasure, a rubricator pass may add red features in the medieval manner: an oversized initial drawn with three parallel overdraw passes, a marginal annotation in a slightly rotated small hand, or one word-run of the newest layer re-inked in red. Red is conceptually the newest ink — never erased, always plotted last.

---

## Controls

| Section | Control | Effect |
|---|---|---|
| Layers | count | 2 / 3 / 4 hands, or random (weighted: two common, four rare) |
| Layers | rotation | Classic (90°) / Diagonal (±5–15°) / Mixed (adds rare ±45°) |
| Field | wave | Band frequency — None / Sparse / Medium / Busy |
| Field | density | Mark count per cell — Light / Medium / Dense |
| Field | depth | Subdivision depth (5 / 6 / 7) — finer grain at higher depth |
| Erasure | padding | Mask breathing-room around new text — tight / normal / generous |
| Erasure | survival floor | Protect old text from obliteration — on / off |
| Rubrication | amount | none / rare / present / rich |
| Style | wobble | Hand-drawn noise perturbation on all marks |
| — | Randomize | Reroll all parameters + new seed |
| — | Refresh | New seed, keep current parameters |
| — | SVG / PNG | Export (see below) |

Click anywhere on the canvas for a new seed with current parameters. Every output is deterministic in (seed, parameters); the seed is stamped in the signature line at the page foot.

---

## Page & Palette

Portrait manuscript, 1630×2170, with generous margins. Warm paper (`#F7E6D4`), near-black warm ink (`#1A1613`), rubrication red (`#A93B2A`). Older layers are drawn with slightly lighter stroke weight — history recedes by weight, not by color, so a single black pen plus a red pen can plot the full piece.

---

## SVG / Plotter Output

SVG export produces one Inkscape layer per pen pass, bottom to top:

1. **Border** — registration frame
2. **Layer 1 (oldest)** … **Layer N** — one pass per hand, stroke weight decreasing with age (0.5 × a per-layer scale, floor 0.45)
3. **Rubrication** — red pass (`#A93B2A`, 0.65)
4. **Signature** — seed + timestamp caption

Erasure is baked into the geometry, so any subset of passes plots correctly — plot only the oldest hand to see the intact under-text, or all passes for the full palimpsest. Files are named `palimpsest_<seed>.svg` / `.png`; PNG exports at full canvas resolution.

---

## Lineage

| Work | Connection |
|---|---|
| *Codex Ephraemi Rescriptus* / Archimedes Palimpsest | The historical object: text over scraped text, recovered as ghost layers |
| Paul Klee, *Highways and Byways* (1929) | Landscape as notation — via Field Script |
| Frieder Nake, *Hommage à Paul Klee* (1965) | Recursive subdivision as mark-making — via Field Script |
| Georg Nees, *Schotter* (1968) | Order→disorder gradient in the stroke vocabulary |
| Robert Rauschenberg, *Erased de Kooning Drawing* (1953) | Erasure as authorship — the newest hand's claim on the page |
| [Field Script](https://github.com/lukaszlysakowski/field-script) (2026) | The script grammar; Palimpsest is what happens when its pages are reused |

---

## Running Locally

No build step. Serve the directory with any static file server:

```bash
npx serve .
```

p5.js is vendored (`p5.min.js`) — no network dependency for the generator itself.
