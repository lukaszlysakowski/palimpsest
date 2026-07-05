// Palimpsest — overwritten, erased, rubricated script layers.
// Generation core ported from Field Script (asemic_writing/index.js);
// geometry kit ported from redaction-plotter (index.html).

const PW = 1630, PH = 2170;
const MARGIN = { x: 0.08 * PW, top: 0.10 * PH, bot: 0.10 * PH };
const PAPER = '#F7E6D4', INK = '#1A1613', RED = '#A93B2A';

let state = { masterSeed: 0, layers: [], rubrication: [] };
const SKIP_CHANCE = [0.40, 0.20, 0.05]; // Light / Medium / Dense — from Field Script densityOptions
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
    document.getElementById('randomizeBtn').onclick = randomizeAll;
    document.getElementById('refreshBtn').onclick   = () => regenerate(true);
    document.getElementById('svgBtn').onclick = exportSVG;
    document.getElementById('pngBtn').onclick = exportPNG;
    setupControls();
    regenerate(true);
    noLoop();
}

// ─── controls ───

function cycleCtrl(btnId, valId, options, labels, uiKey) {
    document.getElementById(btnId).onclick = () => {
        let i = (options.indexOf(ui[uiKey]) + 1) % options.length;
        ui[uiKey] = options[i];
        document.getElementById(valId).textContent = labels ? labels[i] : String(options[i]);
        regenerate(false);
    };
}

const CONTROL_DEFS = [
    ['layerCountBtn',   'layerCountVal',   ['random','2','3','4'], null, 'layerCount'],
    ['rotationPoolBtn', 'rotationPoolVal', ['classic','diagonal','mixed'], null, 'rotationPool'],
    ['waveBtn',         'waveVal',         [0,1,2,3], ['None','Sparse','Medium','Busy'], 'wave'],
    ['densityBtn',      'densityVal',      [0,1,2], ['Light','Medium','Dense'], 'density'],
    ['depthBtn',        'depthVal',        [5,6,7], null, 'depth'],
    ['maskPaddingBtn',  'maskPaddingVal',  ['tight','normal','generous'], null, 'maskPadding'],
    ['survivalFloorBtn','survivalFloorVal',[true,false], ['on','off'], 'survivalFloor'],
    ['rubricationBtn',  'rubricationVal',  ['none','rare','present','rich'], null, 'rubrication'],
    ['wobbleBtn',       'wobbleVal',       [true,false], ['on','off'], 'wobble']
];

function setupControls() {
    for (let d of CONTROL_DEFS) cycleCtrl(...d);
}

function randomizeAll() {
    for (let [, valId, options, labels, uiKey] of CONTROL_DEFS) {
        let i = Math.floor(Math.random() * options.length);
        ui[uiKey] = options[i];
        document.getElementById(valId).textContent = labels ? labels[i] : String(options[i]);
    }
    regenerate(true);
}

// ─── layer planning ───

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
    let layers = [];

    // First loop: draw all plan-level randoms (count, rotations, coverages, makeLayer details)
    // These all happen under the master seed stream, establishing the plan deterministically.
    for (let i = 0; i < n; i++) {
        let coverage = i === 0 ? 1.0 : random(0.6, 0.9) * Math.pow(0.85, i - 1);
        let rotation = pickRotation(i);
        let L = makeLayer(i, state.masterSeed + i * 7919, rotation, coverage);
        if (i === 0) {
            L.region = { x: MARGIN.x, y: MARGIN.top, w: PW - 2 * MARGIN.x, h: PH - MARGIN.top - MARGIN.bot };
        }
        layers.push(L);
    }

    // Second loop: only generate content (per-layer reseeding happens inside generateLayerContent)
    state.layers = [];
    for (let L of layers) {
        generateLayerContent(L);
        state.layers.push(L);
    }

    // Third pass: mask emission + erasure. Deterministic given the layers above —
    // must not call random().
    for (let L of state.layers) emitMasks(L);
    eraseUnder(state.layers);

    // Fourth pass: rubrication — rare red marks plotted on top, never erased
    generateRubrication();
}

function regenerate(newSeed) {
    if (newSeed) state.masterSeed = Math.floor(Math.random() * 1e9);
    randomSeed(state.masterSeed);
    noiseSeed(state.masterSeed);
    state.layers = [];
    state.rubrication = [];
    planLayers();
    // Tasks 5-6 fill in additional layer generation here.
    renderAll();
}

// ─── rubrication ───

const RUBRIC_COUNT = { none: [0, 0], rare: [1, 3], present: [2, 4], rich: [3, 6] };

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
            for (let seg of mL.segments.slice(0, 60)) state.rubrication.push({ ...seg, red: true });
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

function renderAll() {
    background(PAPER);
    for (let L of state.layers) {
        let inkScale = 1.0 - 0.22 * (state.layers.length - 1 - L.idx); // older = lighter weight
        for (let seg of L.segments) drawSegment(seg, Math.max(0.45, inkScale));
    }
    // Render rubrication last, with red stroke
    for (let seg of state.rubrication) drawSegment(seg, 1.0);
    drawBorderAndSignature();
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

// ─── geometry kit ───

function lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
  let denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) return null;

  let t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  let u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
      t: t
    };
  }
  return null;
}

function pointInPolygon(x, y, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    let xi = vertices[i].x, yi = vertices[i].y;
    let xj = vertices[j].x, yj = vertices[j].y;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

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

// ─── layer generation ───
// Ported from Field Script (asemic_writing/index.js). Original globals now hang
// off a layer object `L` (per-layer seed/frame/wave/word-noise state) or `ui`
// (global maker controls). See task-3-brief.md rename table for the mapping.

const FRAME = Math.ceil(Math.sqrt(PW * PW + PH * PH)); // 2714 — covers any rotation

// Wave frequency ranges per level (None/Sparse/Medium/Busy), from Field Script
// waveOptions (asemic_writing/index.js lines 39-44).
const WAVE_FREQ_RANGES = [
    { freqMin: 0,   freqMax: 0   },
    { freqMin: 0.8, freqMax: 1.5 },
    { freqMin: 1.5, freqMax: 3   },
    { freqMin: 3,   freqMax: 5   }
];

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
        waveFreq: 0,
        phase: random(TWO_PI),
        wordNoiseOffset: random(1000),
        useBezier: random() < 0.6,
        cells: [], segments: [], maskPolys: []
    };
    // waveFreq is scaled by FRAME/PH (~1.25) to compensate for the sine running
    // over the larger generation frame, so on-page band count matches the
    // original Field Script's on-canvas count.
    let { freqMin, freqMax } = WAVE_FREQ_RANGES[ui.wave];
    L.waveFreq = random(freqMin, freqMax) * (FRAME / PH);
    // coverage sub-region (page space): a random rect occupying `coverage` of the writable area
    let wx = MARGIN.x, wy = MARGIN.top, ww = PW - 2 * MARGIN.x, wh = PH - MARGIN.top - MARGIN.bot;
    let rw = ww * Math.sqrt(coverage), rh = wh * Math.sqrt(coverage);
    L.region = { x: wx + random(0, ww - rw), y: wy + random(0, wh - rh), w: rw, h: rh };
    if (idx === 0) {
        // layer 0: always full coverage, zero rotation
        L.region = { x: wx, y: wy, w: ww, h: wh };
    }
    return L;
}

function inRegion(L, p) {
    return p.x >= L.region.x && p.x <= L.region.x + L.region.w
        && p.y >= L.region.y && p.y <= L.region.y + L.region.h;
}

// ─── density field ────────────────────────────────────────────────────────────

function getDensityAt(L, x, y) {
    let cs = L.frame.size;
    let t = y / cs;
    let d = L.waveFreq === 0 ? 1 : (sin(t * TWO_PI * L.waveFreq + L.phase) + 1) / 2;
    return d;
}

// Word spacing — slow X-axis noise creates "word" clusters within each band.
// Returns 0 (gap) → 1 (dense word). Seeded via L.wordNoiseOffset.
function getWordWeight(L, x, y) {
    // Two overlapping noise scales: coarse = word length, fine = glyph-level variation
    let coarse = noise(x * 0.008 + L.wordNoiseOffset, y * 0.003 + L.wordNoiseOffset + 50);
    let fine   = noise(x * 0.025 + L.wordNoiseOffset + 100, y * 0.006 + L.wordNoiseOffset + 150);
    return coarse * 0.7 + fine * 0.3;
}

// ─── recursive subdivision ────────────────────────────────────────────────────

function subdivideCell(L, x, y, size, depth) {
    let cs      = L.frame.size;
    let maxDepth = ui.depth;
    let mid     = { x: x + size / 2, y: y + size / 2 };
    let density = getDensityAt(L, mid.x, mid.y);

    let shouldSplit = depth < maxDepth
        && size > cs / 64
        && random() < density * 0.85;

    if (shouldSplit) {
        let h  = size / 2;
        let w  = size * 0.08 * noise(x * 0.01, y * 0.01, depth * 0.5);
        let sx = constrain(h + w * (random() > 0.5 ? 1 : -1), h * 0.65, h * 1.35);
        let sy = constrain(h + w * (random() > 0.5 ? 1 : -1), h * 0.65, h * 1.35);

        subdivideCell(L, x,      y,      sx,        depth+1);
        subdivideCell(L, x + sx, y,      size - sx, depth+1);
        subdivideCell(L, x,      y + sy, sx,        depth+1);
        subdivideCell(L, x + sx, y + sy, size - sx, depth+1);
    } else {
        let frameCentre = { x: L.frame.size / 2, y: L.frame.size / 2 };
        let cell = {
            x, y, size, depth, density,
            distFromCenter: dist(mid.x, mid.y, frameCentre.x, frameCentre.y)
        };
        L.cells.push(cell);
        cell.wordWeight = getWordWeight(L, mid.x, mid.y);
    }
}

// ─── wobble ───────────────────────────────────────────────────────────────────

function wobble(x, y, seed) {
    if (!ui.wobble) return { x, y };
    return {
        x: x + (noise(x * 0.01, y * 0.01, seed) - 0.5) * 8,
        y: y + (noise(x * 0.01 + 100, y * 0.01 + 100, seed) - 0.5) * 8
    };
}

// ─── glyph vocabulary ─────────────────────────────────────────────────────────

function generateGlyphs(L, cell) {
    let cs = L.frame.size;
    let s  = cell.size;
    let xo = cell.x;
    let yo = cell.y;
    let m  = s * 0.12;
    let cx = xo + s / 2;
    let cy = yo + s / 2;
    let growthCenter = { x: L.frame.size / 2, y: L.frame.size / 2 };

    let angle = atan2(growthCenter.y - cy, growthCenter.x - cx);
    let tb    = constrain(s * 0.1 * sin(angle + noise(cx*0.005, cy*0.005) * 0.4 - 0.2), -s*0.2, s*0.2);

    let sizeRatio  = s / (cs / 16);
    let maxLines   = [6, 10, 16][ui.density];
    let maxStrokes = max(1, floor(maxLines / max(1, sizeRatio)));
    // Word weight modulates stroke count: "word-centre" cells get more strokes
    let n = max(1, floor(random(1, maxStrokes + 1) * cell.density * cell.wordWeight));

    let out = [];

    if (L.useBezier) {
        let baseType = floor(noise(cx * 0.006, cy * 0.006) * 8);

        for (let a = 0; a < n; a++) {
            let gt = (baseType + a) % 8;
            let w  = random(0.35, 1.7);
            let x1, y1, cx1, cy1, cx2, cy2, x2, y2;

            if (gt === 0) {
                x1  = xo + random(m*1.2, s-m*1.2);
                y1  = yo + m;
                x2  = constrain(x1 + random(-s*0.15, s*0.15) + tb*0.5, xo+m, xo+s-m);
                y2  = yo + s - m;
                cx1 = constrain(x1 + tb*0.3 + random(-s*0.15, s*0.15), xo+m*0.5, xo+s-m*0.5);
                cy1 = yo + s*0.30;
                cx2 = constrain(x2 - tb*0.3 + random(-s*0.15, s*0.15), xo+m*0.5, xo+s-m*0.5);
                cy2 = yo + s*0.70;
            } else if (gt === 1) {
                x1  = xo + random(m, s-m);
                y1  = yo + m;
                x2  = xo + s * (x1 < cx ? 0.78 : 0.22);
                y2  = yo + s - m*0.6;
                cx1 = constrain(x1 + tb*0.2, xo+m, xo+s-m);
                cy1 = yo + s*0.35;
                cx2 = constrain(x2 + (x1 < cx ? s*0.18 : -s*0.18), xo+m, xo+s-m);
                cy2 = yo + s*0.65;
            } else if (gt === 2) {
                x1  = xo + random(m, s*0.45);
                y1  = yo + s*0.55 + random(0, s*0.18);
                x2  = xo + random(s*0.55, s-m);
                y2  = y1 + random(-s*0.08, s*0.08);
                cx1 = constrain(x1 + (x2-x1)*0.25 + tb*0.2, xo+m, xo+s-m);
                cy1 = yo + m*0.8;
                cx2 = constrain(x2 - (x2-x1)*0.25 - tb*0.2, xo+m, xo+s-m);
                cy2 = yo + m*0.8;
            } else if (gt === 3) {
                x1  = xo + random(m, s-m);
                y1  = yo + m;
                x2  = xo + random(m, s-m);
                y2  = yo + s - m;
                cx1 = constrain(xo + s*0.82 + tb*0.25, xo+m, xo+s-m);
                cy1 = yo + s*0.22;
                cx2 = constrain(xo + s*0.18 - tb*0.25, xo+m, xo+s-m);
                cy2 = yo + s*0.78;
            } else if (gt === 4) {
                let rr = cos(angle) > 0;
                x1  = xo + (rr ? m*1.5 : s-m*1.5);
                y1  = yo + s*0.22;
                x2  = x1;
                y2  = yo + s*0.78;
                let ax = rr ? xo+s*0.88 : xo+s*0.12;
                cx1 = ax;  cy1 = yo + m*0.9;
                cx2 = ax;  cy2 = yo + s - m*0.9;
            } else if (gt === 5) {
                let rr = cos(angle) <= 0;
                x1  = xo + (rr ? m*1.5 : s-m*1.5);
                y1  = yo + s*0.22;
                x2  = x1;
                y2  = yo + s*0.78;
                let ax = rr ? xo+s*0.88 : xo+s*0.12;
                cx1 = ax;  cy1 = yo + m*0.9;
                cx2 = ax;  cy2 = yo + s - m*0.9;
            } else if (gt === 6) {
                x1  = xo + s*0.5;
                y1  = yo + m;
                x2  = x1 + random(-s*0.06, s*0.06);
                y2  = yo + m + random(s*0.02, s*0.1);
                cx1 = constrain(xo + s*0.88 + tb*0.15, xo+m, xo+s-m);
                cy1 = yo + s*0.22;
                cx2 = constrain(xo + s*0.12 - tb*0.15, xo+m, xo+s-m);
                cy2 = yo + s*0.72;
            } else {
                x1  = xo + m;
                y1  = yo + m;
                x2  = xo + s - m;
                y2  = yo + s - m;
                cx1 = constrain(xo + s*0.65 + tb*0.25, xo+m, xo+s-m);
                cy1 = yo + s*0.10;
                cx2 = constrain(xo + s*0.10 - tb*0.25, xo+m, xo+s-m);
                cy2 = yo + s*0.78;
            }

            out.push({ isBezier: true, x1, y1, cx1, cy1, cx2, cy2, x2, y2, depth: cell.depth, density: cell.density, w, layer: L.idx });
        }

    } else {
        // Schotter-style: disorder increases as wordWeight decreases.
        // Word-centre cells → vertical parallel marks. Word-edge cells → scattered, rotated.
        let disorder  = 1.0 - cell.wordWeight;
        let maxAngle  = HALF_PI * 0.65;  // up to ~58° at full disorder
        // Organic lean from growth centre, scaled down in disordered zones
        let leanBase  = s * 0.12 * sin(angle + noise(cx*0.005, cy*0.005) * 0.4 - 0.2) * cell.wordWeight;

        for (let a = 0; a < n; a++) {
            let randAngle = random(-maxAngle, maxAngle) * disorder;

            // Line length: ordered = tall, disordered = variable/shorter
            let heightFrac = 0.5 + cell.wordWeight * 0.45 + random(-0.12, 0.12) * disorder;
            let lineLen    = s * constrain(heightFrac, 0.2, 0.95);

            // Midpoint: neatly spaced when ordered, scattered when disordered
            let spread = m * 1.2 + (s - m * 2.4) * (disorder * random() + (1 - disorder) * (a / max(1, n - 1)));
            let midX   = xo + spread + leanBase * noise(a * 0.3, cx * 0.01);
            let midY   = yo + s * 0.5 + random(-s * 0.06, s * 0.06) * disorder;

            // Rotate about midpoint
            let x1 = midX + sin(randAngle) * lineLen * 0.5;
            let y1 = midY - cos(randAngle) * lineLen * 0.5;
            let x2 = midX - sin(randAngle) * lineLen * 0.5;
            let y2 = midY + cos(randAngle) * lineLen * 0.5;

            let w = random(0.35, 1.5);

            if (a % 2 === 0) {
                out.push({ isBezier: false, x1, y1, x2, y2, depth: cell.depth, density: cell.density, w, layer: L.idx });
            } else {
                out.push({ isBezier: false, x1: x2, y1: y2, x2: x1, y2: y1, depth: cell.depth, density: cell.density, w, layer: L.idx });
            }
        }
    }

    return out;
}

// ─── layer content assembly ────────────────────────────────────────────────────

function generateLayerContentOnce(L) {
    randomSeed(L.seed); noiseSeed(L.seed);
    L.cells = [];
    L.segments = [];
    let baseSize = FRAME / 4;
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            subdivideCell(L, col * baseSize, row * baseSize, baseSize, 0);
        }
    }
    for (let cell of L.cells) {
        // Original Field Script gates (asemic_writing/index.js lines 683-699):
        // per-density skip chance, then a band-density gate, then a word-gap gate.
        if (random() < SKIP_CHANCE[ui.density]) continue;

        let sizeRatio = cell.size / (FRAME / 16);
        let bandThreshold = 0.35 * Math.max(1, sizeRatio * 0.55);
        if (cell.density < bandThreshold) continue;

        if (cell.wordWeight < 0.12) continue;

        for (let seg of generateGlyphs(L, cell)) {
            // transform to page space
            let p1 = toPage(L, seg.x1, seg.y1), p2 = toPage(L, seg.x2, seg.y2);
            // Keep segment only if both endpoints are inside the region
            if (!inRegion(L, p1) || !inRegion(L, p2)) continue;
            seg.x1 = p1.x; seg.y1 = p1.y; seg.x2 = p2.x; seg.y2 = p2.y;
            if (seg.isBezier) {
                let c1 = toPage(L, seg.cx1, seg.cy1), c2 = toPage(L, seg.cx2, seg.cy2);
                // For bezier, also require both control points inside the region
                if (!inRegion(L, c1) || !inRegion(L, c2)) continue;
                seg.cx1 = c1.x; seg.cy1 = c1.y; seg.cx2 = c2.x; seg.cy2 = c2.y;
            }
            L.segments.push(seg);
        }
    }
}

function generateLayerContent(L) {
    const minSegs = Math.max(60, Math.round(150 * L.coverage));
    let best = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        generateLayerContentOnce(L);
        if (best === null || L.segments.length > best.segments.length) {
            best = { cells: L.cells, segments: L.segments };
        }
        if (L.segments.length >= minSegs) break;
        L.seed += 104729;          // derived retry seed
        L.phase = (L.phase + 1.7) % (Math.PI * 2); // shift bands off the alias
    }
    L.cells = best.cells;
    L.segments = best.segments;
}

// ─── erasure ──────────────────────────────────────────────────────────────

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

function segmentViolates(seg, masks) {
    if (seg.isBezier) {
        for (let i = 0; i <= 8; i++) {
            let t = i / 8;
            let x = bezierPoint4(seg.x1, seg.cx1, seg.cx2, seg.x2, t);
            let y = bezierPoint4(seg.y1, seg.cy1, seg.cy2, seg.y2, t);
            if (masks.some(p => pointInPolygon(x, y, p))) return true;
        }
        return false;
    }
    let mx = (seg.x1 + seg.x2) / 2, my = (seg.y1 + seg.y2) / 2;
    return masks.some(p => pointInPolygon(mx, my, p));
}

function checkErasureInvariant() {
    for (let i = 0; i < state.layers.length - 1; i++) {
        let masks = [];
        for (let j = i + 1; j < state.layers.length; j++) masks.push(...state.layers[j].activeMasks);
        for (let seg of state.layers[i].segments) {
            if (segmentViolates(seg, masks)) return { ok: false, layer: i, seg };
        }
    }
    return { ok: true };
}

// ─── export ───────────────────────────────────────────────────────────────

function segToPath(seg) {
    let i = seg.x1 * 0.01;
    let p1 = wobble(seg.x1, seg.y1, i), p2 = wobble(seg.x2, seg.y2, i + 50);
    if (seg.isBezier) {
        let c1 = wobble(seg.cx1, seg.cy1, i + 15), c2 = wobble(seg.cx2, seg.cy2, i + 30);
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

// ─── rendering ──────────────────────────────────────────────────────────────

function drawSegment(seg, inkScale) {
    if (seg.red) stroke(RED); else stroke(INK);
    strokeWeight(seg.w * inkScale); noFill();
    let i = seg.x1 * 0.01;
    let p1 = wobble(seg.x1, seg.y1, i), p2 = wobble(seg.x2, seg.y2, i + 50);
    if (seg.isBezier) {
        let c1 = wobble(seg.cx1, seg.cy1, i + 15), c2 = wobble(seg.cx2, seg.cy2, i + 30);
        bezier(p1.x, p1.y, c1.x, c1.y, c2.x, c2.y, p2.x, p2.y);
    } else {
        line(p1.x, p1.y, p2.x, p2.y);
    }
}
