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
