# Palimpsest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A p5.js maker that generates 2–4 rotated layers of asemic script on a portrait manuscript page, erases older layers by masked omission (exact vector clipping), adds red rubrication accents, and exports pen-pass-layered SVG.

**Architecture:** Vector layer-stack compositor (Approach A from the spec). Each layer generates independently in a square local frame using code ported from Field Script, is transformed to page space (rotation about page centre), emits word-cluster mask polygons, and older layers' segments are clipped against newer layers' masks using geometry ported from redaction-plotter. Rendering and SVG export consume the same page-space segment lists.

**Tech Stack:** p5.js (vendored `p5.min.js`), single `index.html` + `index.js`, no build step, `npx serve` dev server.

## Global Constraints

- Project root: `/Users/lukasz/genuary-2026/sketches/palimpsest` (local git only — do NOT create a GitHub remote or push; that is explicitly deferred by the user)
- Canvas: portrait **1630×2170** (`PW=1630`, `PH=2170`)
- Margins: 8% left/right, 10% top/bottom of page
- Paper `#F7E6D4`, script ink `#1A1613`, rubrication red `#A93B2A`
- Erasure = masked omission ONLY (no bars, no scribble strike-through, no tonal fading)
- Layer differentiation = rotation (90° most likely, ±5–15° diagonals, rare ~45°)
- Layer count 2–4, variable per seed
- V1 scope: maker UI + layered SVG/PNG export. NO rating system, NO canon/specimen site
- No test framework (matches field-script/redaction-plotter idiom). Every task verifies via the dev server at http://localhost:3458 using browser-console assertions (exact snippets given per task) plus visual checks. The dev server config already exists in the *self-redaction* project's launch config (name `palimpsest`, port 3458); Task 1 adds the project's own `.claude/launch.json` too.
- Source repos for ported code (read-only — never modify them):
  - Field Script: `/Users/lukasz/genuary-2026/sketches/asemic_writing/index.js`
  - redaction-plotter: `/Users/lukasz/claude/redaction-plotter/index.html`
- Commit after every task with a `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.

## Segment object shape (used by every task)

Ported from Field Script and extended with `layer`:

```js
// straight stroke
{ isBezier: false, x1, y1, x2, y2, depth, density, w, layer }
// bezier stroke
{ isBezier: true, x1, y1, cx1, cy1, cx2, cy2, x2, y2, depth, density, w, layer }
```

`w` = stroke weight multiplier (0.35–1.7), `layer` = index into `state.layers`.

---

### Task 1: Scaffold — page, paper, border, signature

**Files:**
- Create: `.gitignore`, `LICENSE`, `.claude/launch.json`, `index.html`, `index.js`
- Copy: `/Users/lukasz/genuary-2026/sketches/asemic_writing/p5.min.js` → `p5.min.js`

**Interfaces:**
- Produces: globals `PW=1630`, `PH=2170`, `MARGIN = {x: 0.08*PW, top: 0.10*PH, bot: 0.10*PH}`, `state = { masterSeed, layers: [], rubrication: [] }`, `ui` params object, functions `regenerate()`, `renderAll()`, `drawBorderAndSignature()`; colors `PAPER='#F7E6D4'`, `INK='#1A1613'`, `RED='#A93B2A'`.

- [ ] **Step 1: Create `.gitignore`**

```
renders/
experiments/
.claude/
.DS_Store
node_modules/
```

- [ ] **Step 2: Copy LICENSE and p5**

```bash
cp /Users/lukasz/genuary-2026/sketches/asemic_writing/LICENSE /Users/lukasz/genuary-2026/sketches/palimpsest/LICENSE
cp /Users/lukasz/genuary-2026/sketches/asemic_writing/p5.min.js /Users/lukasz/genuary-2026/sketches/palimpsest/p5.min.js
```

- [ ] **Step 3: Create `.claude/launch.json`**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "palimpsest",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["serve", ".", "--listen", "3458"],
      "port": 3458
    }
  ]
}
```

- [ ] **Step 4: Create `index.html`**

Adapt the sidebar/stage layout from Field Script's `index.html` (lines 1–270 hold the CSS): dark sidebar left (width 236px), stage right with the canvas. Copy the CSS custom properties, `.sidebar-*`, `.section`, `.ctrl`, `.act`, `.act-row`, `a.act` rules verbatim from `/Users/lukasz/genuary-2026/sketches/asemic_writing/index.html`, then use this markup (controls are placeholders until Task 7 — only the actions row is wired in Task 1):

```html
<body>
<div class="app">
    <aside class="sidebar">
        <div class="sidebar-head">
            <div class="sidebar-title">Palimpsest</div>
            <div class="sidebar-sub">overwritten · erased · rubricated</div>
        </div>
        <div class="sidebar-body" id="controls"><!-- sections added in Task 7 --></div>
        <div class="sidebar-footer">
            <div class="act-row">
                <button class="act primary" id="randomizeBtn">randomize</button>
                <button class="act" id="refreshBtn">refresh</button>
            </div>
            <div class="act-row">
                <button class="act" id="svgBtn">svg</button>
                <button class="act" id="pngBtn">png</button>
            </div>
        </div>
    </aside>
    <main class="stage"><div id="canvas-container"></div></main>
</div>
<script src="p5.min.js"></script>
<script src="index.js"></script>
</body>
```

The stage CSS must letterbox a portrait canvas: `#canvas-container canvas { max-height: 92vh; max-width: 100%; width: auto !important; height: auto !important; }`.

- [ ] **Step 5: Create `index.js` skeleton**

```js
// Palimpsest — overwritten, erased, rubricated script layers.
// Generation core ported from Field Script (asemic_writing/index.js);
// geometry kit ported from redaction-plotter (index.html).

const PW = 1630, PH = 2170;
const MARGIN = { x: 0.08 * PW, top: 0.10 * PH, bot: 0.10 * PH };
const PAPER = '#F7E6D4', INK = '#1A1613', RED = '#A93B2A';

let state = { masterSeed: 0, layers: [], rubrication: [] };
let ui = {
    layerCount: 'random',   // '2' | '3' | '4' | 'random'
    rotationPool: 'classic',// 'classic' | 'diagonal' | 'mixed'
    wave: 2,                // 0..3 band frequency level
    density: 1,             // 0 light, 1 medium, 2 dense
    depth: 6,               // max subdivision depth
    maskPadding: 'normal',  // 'tight' | 'normal' | 'generous'
    survivalFloor: true,
    rubrication: 'rare',    // 'none' | 'rare' | 'present' | 'rich'
    wobble: true
};

function setup() {
    let c = createCanvas(PW, PH);
    c.parent('canvas-container');
    pixelDensity(1);
    document.getElementById('randomizeBtn').onclick = () => regenerate(true);
    document.getElementById('refreshBtn').onclick   = () => regenerate(false);
    regenerate(true);
    noLoop();
}

function regenerate(newSeed) {
    if (newSeed) state.masterSeed = Math.floor(Math.random() * 1e9);
    randomSeed(state.masterSeed);
    noiseSeed(state.masterSeed);
    state.layers = [];
    state.rubrication = [];
    // Tasks 3-6 fill in generation here.
    renderAll();
}

function renderAll() {
    background(PAPER);
    drawBorderAndSignature();
    // Tasks 3-6 add layer + rubrication rendering here.
}

function drawBorderAndSignature() {
    stroke(INK); strokeWeight(1); noFill();
    rect(MARGIN.x, MARGIN.top, PW - MARGIN.x * 2, PH - MARGIN.top - MARGIN.bot);
    noStroke(); fill(INK);
    textFont('Courier New'); textSize(Math.round(PW * 0.013));
    let n = new Date();
    let stamp = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')} ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
    text(`Palimpsest · seed ${state.masterSeed}  ${stamp}`, MARGIN.x, PH - MARGIN.bot + Math.round(PW * 0.024));
}

function mousePressed(e) {
    if (e && e.target && e.target.tagName !== 'CANVAS') return;
    regenerate(true);
}
```

- [ ] **Step 6: Verify in browser**

Server already running at http://localhost:3458 (start via launch config `palimpsest` if not). Reload and check: portrait paper page, ink border rect, `Palimpsest · seed N <timestamp>` signature under the border, click on canvas changes the seed. Console shows no errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/lukasz/genuary-2026/sketches/palimpsest && git add -A && git commit -m "Scaffold portrait maker: page, border, signature, sidebar shell"
```

---

### Task 2: Geometry kit + mask subtraction

**Files:**
- Modify: `index.js` (append a `// ─── geometry kit ───` section)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `lineIntersection(x1,y1,x2,y2,x3,y3,x4,y4)` → `{x,y,t}` or `null` (t = param along first line) — ported
  - `pointInPolygon(x, y, vertices)` → boolean, `vertices = [{x,y},...]` — ported
  - `segmentOutsideMasks(x1,y1,x2,y2, polys)` → `[[ax,ay,bx,by], ...]` kept sub-segments (NEW)
  - `bezierOutsideMasks(seg, polys)` → array of segment objects (NEW)

- [ ] **Step 1: Port geometry functions**

Copy **verbatim** from `/Users/lukasz/claude/redaction-plotter/index.html`:
- `lineIntersection` (lines 1175–1190) — but modify the return to include `t` (the parameter along the first segment): where the original computes intersection point from parameters `t`/`u`, return `{ x, y, t }`.
- `pointInPolygon` (lines 1191–1204) — verbatim, no changes.

- [ ] **Step 2: Write `segmentOutsideMasks`**

Parametric subtraction — collect every intersection t of the segment with every mask edge, slice into intervals, keep intervals whose midpoint is outside ALL masks:

```js
function segmentOutsideMasks(x1, y1, x2, y2, polys) {
    let ts = [0, 1];
    for (let poly of polys) {
        for (let i = 0; i < poly.length; i++) {
            let a = poly[i], b = poly[(i + 1) % poly.length];
            let hit = lineIntersection(x1, y1, x2, y2, a.x, a.y, b.x, b.y);
            if (hit) ts.push(hit.t);
        }
    }
    ts.sort((p, q) => p - q);
    let kept = [];
    for (let i = 0; i < ts.length - 1; i++) {
        let t0 = ts[i], t1 = ts[i + 1];
        if (t1 - t0 < 1e-6) continue;
        let mx = x1 + (x2 - x1) * (t0 + t1) / 2;
        let my = y1 + (y2 - y1) * (t0 + t1) / 2;
        if (!polys.some(p => pointInPolygon(mx, my, p))) {
            kept.push([x1 + (x2-x1)*t0, y1 + (y2-y1)*t0, x1 + (x2-x1)*t1, y1 + (y2-y1)*t1]);
        }
    }
    return kept;
}
```

- [ ] **Step 3: Write `bezierOutsideMasks`**

Beziers that touch a mask are flattened to an 8-piece polyline and each piece is trimmed exactly; untouched beziers pass through unchanged (spec §2 — smooth where possible, exact where clipped):

```js
function bezierPoint4(a, c1, c2, b, t) {
    let it = 1 - t;
    return it*it*it*a + 3*it*it*t*c1 + 3*it*t*t*c2 + t*t*t*b;
}

function bezierOutsideMasks(seg, polys) {
    const N = 8;
    let pts = [];
    for (let i = 0; i <= N; i++) {
        let t = i / N;
        pts.push({ x: bezierPoint4(seg.x1, seg.cx1, seg.cx2, seg.x2, t),
                   y: bezierPoint4(seg.y1, seg.cy1, seg.cy2, seg.y2, t) });
    }
    let touched = pts.some(p => polys.some(poly => pointInPolygon(p.x, p.y, poly)));
    if (!touched) {
        // cheap edge case: curve interior may cross a thin mask even if samples miss;
        // also test each chord for intersections
        touched = pts.slice(0, -1).some((p, i) => polys.some(poly => {
            for (let e = 0; e < poly.length; e++) {
                let a = poly[e], b = poly[(e + 1) % poly.length];
                if (lineIntersection(p.x, p.y, pts[i+1].x, pts[i+1].y, a.x, a.y, b.x, b.y)) return true;
            }
            return false;
        }));
    }
    if (!touched) return [seg];

    let out = [];
    for (let i = 0; i < N; i++) {
        for (let k of segmentOutsideMasks(pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y, polys)) {
            out.push({ isBezier: false, x1: k[0], y1: k[1], x2: k[2], y2: k[3],
                       depth: seg.depth, density: seg.density, w: seg.w, layer: seg.layer });
        }
    }
    return out;
}
```

- [ ] **Step 4: Verify with console assertions**

Reload http://localhost:3458, run in the browser console:

```js
(() => {
    const sq = [{x:10,y:0},{x:20,y:0},{x:20,y:10},{x:10,y:10}]; // unit-ish square mask
    const a = segmentOutsideMasks(0, 5, 30, 5, [sq]);   // crosses mask
    const b = segmentOutsideMasks(0, 20, 30, 20, [sq]); // misses mask
    const c = segmentOutsideMasks(12, 5, 18, 5, [sq]);  // fully inside
    console.assert(a.length === 2 && Math.abs(a[0][2] - 10) < 0.01 && Math.abs(a[1][0] - 20) < 0.01, 'trim FAIL', a);
    console.assert(b.length === 1 && b[0][0] === 0 && b[0][2] === 30, 'miss FAIL', b);
    console.assert(c.length === 0, 'inside FAIL', c);
    return 'geometry OK';
})();
```

Expected output: `geometry OK` and no assertion messages.

- [ ] **Step 5: Commit**

```bash
cd /Users/lukasz/genuary-2026/sketches/palimpsest && git add index.js && git commit -m "Add geometry kit: intersection, point-in-polygon, mask subtraction"
```

---

### Task 3: Single-layer script generation (layer 0)

**Files:**
- Modify: `index.js` (append `// ─── layer generation ───` section; extend `regenerate`/`renderAll`)

**Interfaces:**
- Consumes: segment shape, `state`, `ui`.
- Produces:
  - `makeLayer(idx, seed, rotation, coverage)` → layer object `{ idx, seed, rotation, coverage, frame, cells, segments, maskPolys }` — segments in **page space**, `maskPolys` empty until Task 5
  - `generateLayerContent(L)` — fills `L.cells` and `L.segments`
  - `toPage(L, x, y)` → `{x, y}` local→page transform
  - `drawSegment(seg, inkScale)` — renders one segment with wobble
  - `wobble(x, y, seed)` — ported, gated by `ui.wobble`

- [ ] **Step 1: Port the generation core from Field Script**

Copy from `/Users/lukasz/genuary-2026/sketches/asemic_writing/index.js`, with these mechanical renames (the originals read globals; here everything hangs off a layer object `L` or `ui`):

| Original (line) | Here | Changes |
|---|---|---|
| `getDensityAt` (269–288) | `getDensityAt(L, x, y)` | Keep ONLY the `waveAngleLevel === 2` branch (`t = y / cs`) — rotation now comes from the layer transform. `cs` → `L.frame.size`, `waveFreq` → `L.waveFreq`, `phaseOffset` → `L.phase`. Drop `invertDensity`. |
| `getWordWeight` (292–297) | `getWordWeight(L, x, y)` | `wordNoiseOffset` → `L.wordNoiseOffset` |
| `subdivideCell` (301–325) | `subdivideCell(L, x, y, size, depth)` | `cells.push` → `L.cells.push`; `cs` → `L.frame.size`; `maxDepth` → `ui.depth`; `growthCenter` → frame centre `{x: L.frame.size/2, y: L.frame.size/2}`; after push, set `cell.wordWeight = getWordWeight(L, mid.x, mid.y)` |
| `wobble` (329–335) | `wobble(x, y, seed)` | `wobbleMode` → `ui.wobble` |
| `generateGlyphs` (339–495) | `generateGlyphs(L, cell)` | `cs` → `L.frame.size`; `growthCenter` → frame centre; `densityOptions[densityLevel].maxLines` → `[6, 10, 16][ui.density]`; `useBezier` → `L.useBezier`; drop the `crosshatchEnabled` block (478–492) entirely; every pushed segment gets `layer: L.idx` |

Do NOT port `generateHighways`, threads, or spiral/growth-order logic — out of scope per spec.

- [ ] **Step 2: Write the layer frame + transform**

```js
const FRAME = Math.ceil(Math.sqrt(PW * PW + PH * PH)); // 2714 — covers any rotation

function toPage(L, x, y) {
    // local frame is a FRAME×FRAME square centred on the page centre
    let dx = x - FRAME / 2, dy = y - FRAME / 2;
    let c = Math.cos(L.rotation), s = Math.sin(L.rotation);
    return { x: PW / 2 + dx * c - dy * s, y: PH / 2 + dx * s + dy * c };
}

function makeLayer(idx, seed, rotation, coverage) {
    let L = {
        idx, seed, rotation, coverage,
        frame: { size: FRAME },
        waveFreq: [0, 2, 4, 7][ui.wave] + Math.floor(random(0, 2)),
        phase: random(TWO_PI),
        wordNoiseOffset: random(1000),
        useBezier: random() < 0.6,
        cells: [], segments: [], maskPolys: []
    };
    // coverage sub-region (page space): a random rect occupying `coverage` of the writable area
    let wx = MARGIN.x, wy = MARGIN.top, ww = PW - 2 * MARGIN.x, wh = PH - MARGIN.top - MARGIN.bot;
    let rw = ww * Math.sqrt(coverage), rh = wh * Math.sqrt(coverage);
    L.region = { x: wx + random(0, ww - rw), y: wy + random(0, wh - rh), w: rw, h: rh };
    return L;
}

function inRegion(L, p) {
    return p.x >= L.region.x && p.x <= L.region.x + L.region.w
        && p.y >= L.region.y && p.y <= L.region.y + L.region.h;
}

function generateLayerContent(L) {
    randomSeed(L.seed); noiseSeed(L.seed);
    L.cells = [];
    subdivideCell(L, 0, 0, FRAME, 0);
    for (let cell of L.cells) {
        if (cell.density * cell.wordWeight < 0.18) continue; // gaps between words
        for (let seg of generateGlyphs(L, cell)) {
            // transform to page space
            let p1 = toPage(L, seg.x1, seg.y1), p2 = toPage(L, seg.x2, seg.y2);
            let mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            if (!inRegion(L, mid)) continue;
            seg.x1 = p1.x; seg.y1 = p1.y; seg.x2 = p2.x; seg.y2 = p2.y;
            if (seg.isBezier) {
                let c1 = toPage(L, seg.cx1, seg.cy1), c2 = toPage(L, seg.cx2, seg.cy2);
                seg.cx1 = c1.x; seg.cy1 = c1.y; seg.cx2 = c2.x; seg.cy2 = c2.y;
            }
            L.segments.push(seg);
        }
    }
}
```

- [ ] **Step 3: Render layer 0**

In `regenerate`, after seeding: `let L0 = makeLayer(0, state.masterSeed, 0, 1.0); generateLayerContent(L0); state.layers = [L0];`
(Layer 0 always full coverage, zero rotation — override `L.region` to the full writable rect when `idx === 0`.)

```js
function drawSegment(seg, inkScale) {
    stroke(INK); strokeWeight(seg.w * inkScale); noFill();
    let i = seg.x1 * 0.01;
    let p1 = wobble(seg.x1, seg.y1, i), p2 = wobble(seg.x2, seg.y2, i + 50);
    if (seg.isBezier) {
        let c1 = wobble(seg.cx1, seg.cy1, i + 15), c2 = wobble(seg.cx2, seg.cy2, i + 30);
        bezier(p1.x, p1.y, c1.x, c1.y, c2.x, c2.y, p2.x, p2.y);
    } else {
        line(p1.x, p1.y, p2.x, p2.y);
    }
}

// in renderAll(), between paper and border:
for (let L of state.layers) {
    let inkScale = 1.0 - 0.22 * (state.layers.length - 1 - L.idx); // older = lighter weight
    for (let seg of L.segments) drawSegment(seg, Math.max(0.45, inkScale));
}
```

- [ ] **Step 4: Verify visually**

Reload http://localhost:3458. Expect: horizontal bands of asemic marks filling the bordered area, band rhythm visible (dense registers / quiet gaps), word clustering within bands. Console clean. Try several clicks — layouts vary with seed.

- [ ] **Step 5: Commit**

```bash
cd /Users/lukasz/genuary-2026/sketches/palimpsest && git add index.js && git commit -m "Port Field Script generation core; layer 0 renders horizontal script bands"
```

---

### Task 4: Layer stack — count, rotation pool, coverage decay

**Files:**
- Modify: `index.js` (`// ─── layer planning ───` section; extend `regenerate`)

**Interfaces:**
- Consumes: `makeLayer`, `generateLayerContent`.
- Produces: `planLayers()` → fully generated `state.layers` (oldest first), each with `rotation` and decayed `coverage`. No masking yet — layers overprint.

- [ ] **Step 1: Write `planLayers`**

```js
function pickLayerCount() {
    if (ui.layerCount !== 'random') return parseInt(ui.layerCount, 10);
    let r = random();                     // weighted: 2 common, 4 rare
    return r < 0.45 ? 2 : r < 0.85 ? 3 : 4;
}

function pickRotation(idx) {
    if (idx === 0) return 0;
    let pool;
    if      (ui.rotationPool === 'classic')  pool = [HALF_PI];
    else if (ui.rotationPool === 'diagonal') pool = [radians(random(5, 15)) * (random() < 0.5 ? -1 : 1)];
    else { // mixed — weighted: 90° likely, diagonal next, 45° rare
        let r = random();
        pool = r < 0.55 ? [HALF_PI]
             : r < 0.90 ? [radians(random(5, 15)) * (random() < 0.5 ? -1 : 1)]
             : [radians(45) * (random() < 0.5 ? -1 : 1)];
    }
    return pool[0];
}

function planLayers() {
    let n = pickLayerCount();
    state.layers = [];
    for (let i = 0; i < n; i++) {
        let coverage = i === 0 ? 1.0 : random(0.6, 0.9) * Math.pow(0.85, i - 1); // decay
        let L = makeLayer(i, state.masterSeed + i * 7919, pickRotation(i), coverage);
        if (i === 0) L.region = { x: MARGIN.x, y: MARGIN.top, w: PW - 2 * MARGIN.x, h: PH - MARGIN.top - MARGIN.bot };
        generateLayerContent(L);
        state.layers.push(L);
    }
}
```

In `regenerate`, replace the single-layer code with `planLayers();`.
Note `pickLayerCount`/`pickRotation`/coverage draws happen under the **master** seed (before per-layer `randomSeed(L.seed)` calls inside `generateLayerContent`) — call order: draw all plan-level randoms first, THEN generate each layer's content. Restructure `planLayers` accordingly: first loop computes `{seed, rotation, coverage, region}` for all layers, second loop calls `generateLayerContent`.

- [ ] **Step 2: Verify visually**

Reload. Expect: 2–4 overlapping scripts, later ones rotated (mostly 90°), each confined to a sub-region, later layers smaller. It will look muddy where they overlap — erasure comes next. Check the layer count varies across ~6 regenerations and that with `ui.rotationPool = 'classic'` (set via console `ui.rotationPool='classic'; regenerate(false)`) every non-zero layer is exactly 90°.

- [ ] **Step 3: Commit**

```bash
cd /Users/lukasz/genuary-2026/sketches/palimpsest && git add index.js && git commit -m "Layer stack: weighted count, rotation pool, coverage decay"
```

---

### Task 5: Mask emission + erasure + anti-mush budget

**Files:**
- Modify: `index.js` (`// ─── erasure ───` section; extend `planLayers`)

**Interfaces:**
- Consumes: `segmentOutsideMasks`, `bezierOutsideMasks`, `pointInPolygon`, layer objects.
- Produces:
  - `emitMasks(L)` — fills `L.maskPolys` (page-space quads `[{x,y}×4]`), sets `L.activeMasks` (subset actually applied)
  - `eraseUnder(layers)` — clips older layers' segments; applies survival floor
  - `checkErasureInvariant()` → true/false — console-runnable spec invariant

- [ ] **Step 1: Write `emitMasks`**

Word-cluster cells (dense AND word-centre) contribute padded cell quads, transformed to page space:

```js
const MASK_PAD = { tight: 0.02, normal: 0.06, generous: 0.11 };

function emitMasks(L) {
    L.maskPolys = [];
    let pad;
    for (let cell of L.cells) {
        if (cell.density * cell.wordWeight < 0.30) continue;   // mask only real word clusters
        pad = cell.size * MASK_PAD[ui.maskPadding];
        let x0 = cell.x - pad, y0 = cell.y - pad, x1 = cell.x + cell.size + pad, y1 = cell.y + cell.size + pad;
        let quad = [toPage(L, x0, y0), toPage(L, x1, y0), toPage(L, x1, y1), toPage(L, x0, y1)];
        let mid = { x: (quad[0].x + quad[2].x) / 2, y: (quad[0].y + quad[2].y) / 2 };
        if (inRegion(L, mid)) L.maskPolys.push(quad);
    }
    L.activeMasks = L.maskPolys;
}
```

- [ ] **Step 2: Write `eraseUnder` with survival floor**

```js
function inkLength(segs) {
    return segs.reduce((t, s) => t + Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0);
}

function clipLayerAgainst(L, masks) {
    let out = [];
    for (let seg of L.segments) {
        if (seg.isBezier) {
            out.push(...bezierOutsideMasks(seg, masks));
        } else {
            for (let k of segmentOutsideMasks(seg.x1, seg.y1, seg.x2, seg.y2, masks)) {
                out.push({ ...seg, x1: k[0], y1: k[1], x2: k[2], y2: k[3] });
            }
        }
    }
    return out;
}

function eraseUnder(layers) {
    for (let i = 0; i < layers.length - 1; i++) {
        let L = layers[i];
        L.originalSegments = L.segments;
        let masks = [];
        for (let j = i + 1; j < layers.length; j++) masks.push(...layers[j].activeMasks);
        let before = inkLength(L.segments);
        L.segments = clipLayerAgainst(L, masks);
        // survival floor: old text must remain present
        if (ui.survivalFloor && before > 0 && inkLength(L.segments) / before < 0.25) {
            for (let j = i + 1; j < layers.length; j++) {
                layers[j].activeMasks = layers[j].activeMasks.filter((_, k) => k % 2 === 0);
            }
            let thinned = [];
            for (let j = i + 1; j < layers.length; j++) thinned.push(...layers[j].activeMasks);
            L.segments = clipLayerAgainst({ ...L, segments: L.originalSegments }, thinned);
        }
    }
}
```

In `planLayers`, after all content is generated: `for (let L of state.layers) emitMasks(L); eraseUnder(state.layers);`
(Newest layer is never clipped.)

- [ ] **Step 3: Write the spec invariant check**

```js
function checkErasureInvariant() {
    for (let i = 0; i < state.layers.length - 1; i++) {
        let masks = [];
        for (let j = i + 1; j < state.layers.length; j++) masks.push(...state.layers[j].activeMasks);
        for (let seg of state.layers[i].segments) {
            let mx = (seg.x1 + seg.x2) / 2, my = (seg.y1 + seg.y2) / 2;
            if (masks.some(p => pointInPolygon(mx, my, p))) return { ok: false, layer: i, seg };
        }
    }
    return { ok: true };
}
```

- [ ] **Step 4: Verify**

Reload, then in console: `checkErasureInvariant()` → expect `{ok: true}` across 5 regenerations (`regenerate(true); checkErasureInvariant()` ×5).
Visually: older text shows ghost gaps exactly where newer text sits; oldest layer still clearly present (survival floor working — test a 4-layer seed by `ui.layerCount='4'; regenerate(true)`).

- [ ] **Step 5: Commit**

```bash
cd /Users/lukasz/genuary-2026/sketches/palimpsest && git add index.js && git commit -m "Masked-omission erasure with survival floor and coverage budget"
```

---

### Task 6: Rubrication

**Files:**
- Modify: `index.js` (`// ─── rubrication ───` section)

**Interfaces:**
- Consumes: layer objects, `generateGlyphs`, `toPage`, segment shape.
- Produces: `generateRubrication()` — fills `state.rubrication` with segments flagged `{ ...seg, red: true }`. Red marks are never erased and render/plot last.

- [ ] **Step 1: Write `generateRubrication`**

```js
const RUBRIC_COUNT = { none: [0, 0], rare: [0, 2], present: [1, 3], rich: [2, 5] };

function generateRubrication() {
    state.rubrication = [];
    let [lo, hi] = RUBRIC_COUNT[ui.rubrication];
    let n = Math.floor(random(lo, hi + 1));
    let newest = state.layers[state.layers.length - 1];

    for (let f = 0; f < n; f++) {
        let kind = random();
        if (kind < 0.4 && newest.cells.length) {
            // Initial: oversized glyph at a band start on the newest layer, overdraw-heavy
            let cell = { ...random(newest.cells) };
            cell.size *= 2.2;
            for (let seg of generateGlyphs(newest, cell)) {
                for (let off = -1; off <= 1; off++) {         // 3 parallel passes
                    let o = off * 1.4;
                    let p1 = toPage(newest, seg.x1 + o, seg.y1), p2 = toPage(newest, seg.x2 + o, seg.y2);
                    state.rubrication.push({ isBezier: false, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
                                             depth: seg.depth, density: 1, w: seg.w * 1.3, red: true });
                }
            }
        } else if (kind < 0.75) {
            // Marginal annotation: short glyph run in a side margin, slightly rotated
            let mL = makeLayer(99, state.masterSeed + 31 + f, radians(random(-8, 8)), 0.05);
            let side = random() < 0.5;
            mL.region = { x: side ? 6 : PW - MARGIN.x + 6, y: random(MARGIN.top, PH * 0.7),
                          w: MARGIN.x - 12, h: PH * 0.15 };
            generateLayerContent(mL);
            for (let seg of mL.segments.slice(0, 40)) state.rubrication.push({ ...seg, red: true });
        } else {
            // Rubricated run: one word-cluster of the newest layer re-inked red
            let masks = newest.maskPolys;
            if (!masks.length) continue;
            let poly = random(masks);
            let runSegs = newest.segments.filter(s =>
                pointInPolygon((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, poly));
            for (let seg of runSegs) state.rubrication.push({ ...seg, red: true });
            newest.segments = newest.segments.filter(s => !runSegs.includes(s));
        }
    }
}
```

Call `generateRubrication()` at the end of `planLayers` (after `eraseUnder`). In `renderAll`, render rubrication last with `stroke(RED)` — add a `red` branch to `drawSegment`.

- [ ] **Step 2: Verify visually**

`ui.rubrication='rich'; regenerate(true)` — expect red features: heavy initial and/or margin annotation and/or one red word-run, plotted over everything. `ui.rubrication='none'; regenerate(true)` — zero red. Reset to `'rare'`; across ~6 seeds most pieces show 0–2 red features.

- [ ] **Step 3: Commit**

```bash
cd /Users/lukasz/genuary-2026/sketches/palimpsest && git add index.js && git commit -m "Rubrication pass: initials, marginal annotations, rubricated runs"
```

---

### Task 7: Maker UI wiring

**Files:**
- Modify: `index.html` (fill `#controls` with sections), `index.js` (`// ─── controls ───` section)

**Interfaces:**
- Consumes: `ui` object, `regenerate`.
- Produces: working sidebar controls, each mutating one `ui` field then calling `regenerate(false)` (same seed, new params — content params require full regeneration since generation reads them).

- [ ] **Step 1: Add control markup**

Inside `#controls`, using the ported `.section` / `.ctrl` classes (cycle-button idiom from Field Script — each `.ctrl` is a `<button>` whose value span cycles through options on click):

```html
<div class="section">
    <div class="section-label">Layers</div>
    <button class="ctrl" id="layerCountBtn"><span class="ctrl-name">count</span><span class="ctrl-val" id="layerCountVal">random</span></button>
    <button class="ctrl" id="rotationPoolBtn"><span class="ctrl-name">rotation</span><span class="ctrl-val" id="rotationPoolVal">classic</span></button>
</div>
<div class="rule"></div>
<div class="section">
    <div class="section-label">Field</div>
    <button class="ctrl" id="waveBtn"><span class="ctrl-name">wave</span><span class="ctrl-val" id="waveVal">Medium</span></button>
    <button class="ctrl" id="densityBtn"><span class="ctrl-name">density</span><span class="ctrl-val" id="densityVal">Medium</span></button>
    <button class="ctrl" id="depthBtn"><span class="ctrl-name">depth</span><span class="ctrl-val" id="depthVal">6</span></button>
</div>
<div class="rule"></div>
<div class="section">
    <div class="section-label">Erasure</div>
    <button class="ctrl" id="maskPaddingBtn"><span class="ctrl-name">padding</span><span class="ctrl-val" id="maskPaddingVal">normal</span></button>
    <button class="ctrl" id="survivalFloorBtn"><span class="ctrl-name">survival floor</span><span class="ctrl-val" id="survivalFloorVal">on</span></button>
</div>
<div class="rule"></div>
<div class="section">
    <div class="section-label">Rubrication</div>
    <button class="ctrl" id="rubricationBtn"><span class="ctrl-name">amount</span><span class="ctrl-val" id="rubricationVal">rare</span></button>
</div>
<div class="rule"></div>
<div class="section">
    <div class="section-label">Style</div>
    <button class="ctrl" id="wobbleBtn"><span class="ctrl-name">wobble</span><span class="ctrl-val" id="wobbleVal">on</span></button>
</div>
```

- [ ] **Step 2: Wire the cycle buttons**

```js
function cycleCtrl(btnId, valId, options, labels, uiKey) {
    document.getElementById(btnId).onclick = () => {
        let i = (options.indexOf(ui[uiKey]) + 1) % options.length;
        ui[uiKey] = options[i];
        document.getElementById(valId).textContent = labels ? labels[i] : String(options[i]);
        regenerate(false);
    };
}

function setupControls() {
    cycleCtrl('layerCountBtn',   'layerCountVal',   ['random','2','3','4'], null, 'layerCount');
    cycleCtrl('rotationPoolBtn', 'rotationPoolVal', ['classic','diagonal','mixed'], null, 'rotationPool');
    cycleCtrl('waveBtn',         'waveVal',         [0,1,2,3], ['None','Sparse','Medium','Busy'], 'wave');
    cycleCtrl('densityBtn',      'densityVal',      [0,1,2], ['Light','Medium','Dense'], 'density');
    cycleCtrl('depthBtn',        'depthVal',        [5,6,7], null, 'depth');
    cycleCtrl('maskPaddingBtn',  'maskPaddingVal',  ['tight','normal','generous'], null, 'maskPadding');
    cycleCtrl('survivalFloorBtn','survivalFloorVal',[true,false], ['on','off'], 'survivalFloor');
    cycleCtrl('rubricationBtn',  'rubricationVal',  ['none','rare','present','rich'], null, 'rubrication');
    cycleCtrl('wobbleBtn',       'wobbleVal',       [true,false], ['on','off'], 'wobble');
}
```

Call `setupControls()` in `setup()`. Note `regenerate(false)` re-seeds `randomSeed(state.masterSeed)` at the top, so the same seed with new params is deterministic.

- [ ] **Step 3: Verify interactions**

In the preview: click each control once and confirm (a) the value label cycles, (b) the composition re-renders, (c) same seed + same params always gives the identical image (click `refresh` twice with no param change — pixel-identical). Click canvas → new seed. Console clean throughout.

- [ ] **Step 4: Commit**

```bash
cd /Users/lukasz/genuary-2026/sketches/palimpsest && git add index.html index.js && git commit -m "Wire maker sidebar: layers, field, erasure, rubrication, style controls"
```

---

### Task 8: Layered SVG + PNG export

**Files:**
- Modify: `index.js` (`// ─── export ───` section; wire `svgBtn`/`pngBtn`)

**Interfaces:**
- Consumes: `state.layers`, `state.rubrication`, `wobble`.
- Produces: `buildSVG()` → string (testable without download), `exportSVG()`, `exportPNG()`.

- [ ] **Step 1: Write `buildSVG` with dynamic pen-pass layers**

Adapt the Inkscape-layer scaffolding from Field Script `exportSVG` (asemic_writing/index.js lines 819–910). Layer order (bottom to top): `Border`, `Layer 1 (oldest)` … `Layer N`, `Rubrication`, `Signature`.

```js
function segToPath(seg, i) {
    let p1 = wobble(seg.x1, seg.y1, i * 0.1), p2 = wobble(seg.x2, seg.y2, i * 0.1 + 50);
    if (seg.isBezier) {
        let c1 = wobble(seg.cx1, seg.cy1, i * 0.1 + 15), c2 = wobble(seg.cx2, seg.cy2, i * 0.1 + 30);
        return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)} ${c2.x.toFixed(2)} ${c2.y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
}

function svgLayer(label, color, weight, paths, extra = '') {
    let g = `  <g inkscape:groupmode="layer" inkscape:label="${label}" fill="none" stroke="${color}" stroke-width="${weight}" stroke-linecap="round"${extra}>\n`;
    for (let p of paths) g += `    <path d="${p}"/>\n`;
    return g + `  </g>\n`;
}

function buildSVG() {
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}">\n  <rect width="100%" height="100%" fill="${PAPER}"/>\n`;
    svg += svgLayer('Border', INK, 1,
        [`M ${MARGIN.x} ${MARGIN.top} H ${PW - MARGIN.x} V ${PH - MARGIN.bot} H ${MARGIN.x} Z`]);
    let nL = state.layers.length;
    for (let L of state.layers) {
        let inkScale = Math.max(0.45, 1.0 - 0.22 * (nL - 1 - L.idx));
        svg += svgLayer(`Layer ${L.idx + 1}${L.idx === 0 ? ' (oldest)' : ''}`, INK, (0.5 * inkScale).toFixed(2),
            L.segments.map(segToPath));
    }
    svg += svgLayer('Rubrication', RED, 0.65, state.rubrication.map(segToPath));
    let n = new Date();
    let stamp = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')} ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
    svg += `  <g inkscape:groupmode="layer" inkscape:label="Signature"><text x="${MARGIN.x}" y="${PH - MARGIN.bot + Math.round(PW * 0.024)}" font-family="Courier New, Courier, monospace" font-size="${Math.round(PW * 0.013)}" fill="${INK}">Palimpsest · seed ${state.masterSeed}  ${stamp}</text></g>\n`;
    return svg + `</svg>`;
}

function exportSVG() {
    let blob = new Blob([buildSVG()], { type: 'image/svg+xml' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url; a.download = `palimpsest_${state.masterSeed}.svg`; a.click();
    URL.revokeObjectURL(url);
}

function exportPNG() { saveCanvas(`palimpsest_${state.masterSeed}`, 'png'); }
```

Wire in `setup()`: `document.getElementById('svgBtn').onclick = exportSVG; document.getElementById('pngBtn').onclick = exportPNG;`

- [ ] **Step 2: Verify by console assertion**

```js
(() => {
    let s = buildSVG();
    let groups = (s.match(/inkscape:groupmode="layer"/g) || []).length;
    let expected = state.layers.length + 3; // Border + layers + Rubrication + Signature
    console.assert(groups === expected, `layer count FAIL: ${groups} vs ${expected}`);
    console.assert(s.includes('inkscape:label="Layer 1 (oldest)"'), 'oldest label FAIL');
    console.assert(s.includes(`stroke="${'#A93B2A'}"`), 'red pass FAIL');
    return `svg OK: ${groups} pen-pass layers`;
})();
```

Expected: `svg OK: N pen-pass layers` with N = layers + 3. Also click `svg` and `png` buttons — files download; open the SVG in a browser tab — it matches the canvas.

- [ ] **Step 3: Commit**

```bash
cd /Users/lukasz/genuary-2026/sketches/palimpsest && git add index.js && git commit -m "Layered SVG export (Border/Layers/Rubrication/Signature) and PNG export"
```

---

### Task 9: README + multi-seed verification pass

**Files:**
- Create: `README.md`

**Interfaces:** none — documentation and final QA.

- [ ] **Step 1: Write `README.md`**

Follow the field-script README structure (concept → system → controls → export → running locally). Must cover: the palimpsest concept and masked-omission erasure; the layer/rotation system with coverage decay and survival floor; rubrication; the controls table (exact controls from Task 7); SVG pen-pass layers (`Border`, `Layer 1 (oldest)`…`Layer N`, `Rubrication`, `Signature`); lineage paragraph connecting Field Script (Klee → Nake → Nees) to the palimpsest/erasure tradition (Rauschenberg's *Erased de Kooning Drawing*); `npx serve .` to run. State that the project is local-only for now (no Pages link yet).

- [ ] **Step 2: Multi-seed verification**

Across 8+ regenerations spanning params (2/3/4 layers, each rotation pool, rubrication none→rich): no console errors, `checkErasureInvariant().ok === true` every time, oldest layer always visibly present, no all-mush or all-empty outputs. Take preview screenshots of 3 representative seeds for the final report.

- [ ] **Step 3: Commit**

```bash
cd /Users/lukasz/genuary-2026/sketches/palimpsest && git add README.md && git commit -m "README: concept, system, controls, plotter export docs"
```
