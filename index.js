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
