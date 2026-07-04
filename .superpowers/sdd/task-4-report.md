# Task 4 Completion Report

## Status
**COMPLETE**

## Commit
`8d2545a` — Layer stack: weighted count, rotation pool, coverage decay

## Implementation Summary

Implemented `planLayers()` with two-loop structure per brief requirements:

1. **Loop 1 (planning):** All plan-level randoms drawn under master seed:
   - `pickLayerCount()`: 45% → 2 layers, 40% → 3 layers, 15% → 4 layers
   - `pickRotation(idx)`: Layer 0 always 0°; upper layers from pool (classic=90°, diagonal=±5-15°, mixed=weighted combo)
   - Coverage: Layer 0 = 1.0, upper = random(0.6, 0.9) × 0.85^(i-1)

2. **Loop 2 (generation):** Each layer's content generated via `generateLayerContent()` with plan params

Updated `regenerate()` to call `planLayers()` instead of single-layer block.

Verified `renderAll()` correctly handles multiple layers with inkScale formula: `1.0 - 0.22 * (layerCount - 1 - layerIdx)` weights older layers lighter.

## Verification Results (task-4-verify.js)

**Test 1: Random layer count distribution** (12 master seeds)
- 2 layers: 4 trials
- 3 layers: 6 trials  
- 4 layers: 2 trials
✓ Distribution matches expected weighting (45%, 40%, 15%)

**Test 2: Fixed layer count**
- `ui.layerCount='2'` produces exactly 2 layers ✓

**Test 3: Rotation pool — classic mode**
- Layer 0 rotation: 0.000000 ✓
- Layer 1 rotation: 1.570796 (π/2) ✓
- Layer 2 rotation: 1.570796 (π/2) ✓

**Test 4: Coverage decay** (4 layers)
- Layer 0: 1.0000 ✓
- Layer 1: 0.6256 (≤ 0.9) ✓
- Layer 2: 0.7507 (≤ 0.9) ✓
- Layer 3: 0.4826 (≤ 0.9) ✓

**Test 5: Rotation coverage**
- All 3 upper-layer rotations non-zero ✓

**Test 6: Segment generation**
- Layer 0: 654 segments
- Layer 1: 696 segments
- Layer 2: 215 segments
- Layer 3: 583 segments
- Total: 2148 segments, 0 empty layers ✓

**Test 7: Determinism** (seed 777, 2 runs)
- Run 1: [715, 449] segments
- Run 2: [715, 449] segments
✓ Identical across regenerates when same masterSeed used

## Key Design Decisions

1. **Two-loop structure**: All random draws for layer planning happen first (under master seed), ensuring deterministic structure before per-layer content generation.

2. **Coverage decay formula**: `random(0.6, 0.9) * 0.85^(i-1)` produces semi-random but trending coverage. Not strictly monotonic because the random(0.6, 0.9) draw can produce a layer with higher coverage than previous before decay compounds further.

3. **Layer seeding**: `state.masterSeed + i * 7919` ensures unique, reproducible per-layer seeds (7919 is a large prime).

4. **Region for layer 0 only**: Layer 0 gets explicit full-page region assignment in the planning loop; upper layers get sub-regions from makeLayer's random placement logic.

## No Visual Verification

As noted in brief, cannot open browser. Verify visually by:
1. Load palimpsest in browser
2. Check ~6 regenerations show varying layer counts (mix of 2-4)
3. Set `ui.rotationPool='classic'` via console, confirm all non-zero layers rotate exactly 90°
4. Confirm later layers are smaller/sub-regions of page (coverage decay)

## Concerns
None. All automated checks pass; determinism contract maintained.

## Fix: strict region containment

**Bug:** In `generateLayerContentOnce(L)`, segments were kept if their midpoint fell inside `L.region`, but endpoints could poke outside the page boundary, creating visible marks beyond the manuscript frame.

**Fix applied:**
- Line 495: Replaced midpoint test `if (!inRegion(L, mid)) continue;` with strict endpoint check: `if (!inRegion(L, p1) || !inRegion(L, p2)) continue;`
- Lines 497-500: For bezier segments, added control-point containment test after transformation: `if (seg.isBezier) { ... if (!inRegion(L, c1) || !inRegion(L, c2)) continue; }`
- Removed unused `mid` computation (line 494 in original)

**Verification:**
1. Syntax check: `node --check index.js` — PASS
2. Test harness (task-4-verify.js): All 7 tests pass — segment counts remain consistent (0 empty layers)
3. Containment sweep (8 seeds, layerCount=4): 0 violations found — every segment's endpoints and bezier control points confirmed inside their layer's region

**Result:** Segments now strictly contained; no marks visible outside the page frame.

## Fix: makeLayer moved to plan loop (determinism contract)

**Problem:** The determinism contract requires ALL plan-level randoms to be drawn under the master seed before any content generation. Previously, `planLayers()` did:
- Loop 1: Drew coverage, rotation, seed into a `plans` array
- Loop 2: Called `makeLayer()` (which draws waveFreq, phase, wordNoiseOffset, useBezier, region randoms), then `generateLayerContent()`

This violated the contract: `makeLayer` draws were happening in Loop 2, AFTER planLayers() returned from Loop 1. Worse, `generateLayerContentOnce()` calls `randomSeed(L.seed)` without restoring, so layer i+1's `makeLayer` randoms depended on layer i's retry count.

**Fix applied:**
- Restructured `planLayers()` into strict two-phase:
  1. **Loop 1 (planning):** All master-seed randoms drawn here, including `pickLayerCount()`, `pickRotation()`, `coverage`, AND `makeLayer()`. Full layer objects with {waveFreq, phase, wordNoiseOffset, useBezier, region} are collected. Layer 0's region override applied before push.
  2. **Loop 2 (content):** Only `generateLayerContent(L)` called for each pre-built layer. Per-layer reseeding happens inside this function; plan-level attributes remain stable.
- Renamed `plans` array to `layers` (temporary collection), then reassign `state.layers` in Loop 2 to maintain correct order (oldest first).

**Key invariant:** Plan attributes {waveFreq, phase, wordNoiseOffset, useBezier, region} are now pure functions of masterSeed alone, independent of generateLayerContent retry counts.

**Verification:**

1. **Syntax check:**
   ```
   node --check index.js → OK
   ```

2. **Existing tests pass:**
   ```
   node .superpowers/sdd/task-4-verify.js → PASS (all 7 tests)
   ```
   - Layer count distribution: 4/6/2 across 12 seeds ✓
   - Fixed layer count: exactly 2 layers ✓
   - Rotation pool effects: classic mode → 0, 90°, 90° ✓
   - Coverage decay: bounded by 0.9 for upper layers ✓
   - Non-zero rotations: confirmed ✓
   - Segments: 2078 total, 0 empty layers ✓
   - Determinism: identical segment counts across runs (818, 262) ✓

3. **Plan-level RNG isolation (new test):**
   Ran three master seeds {42, 777, 1337} with layerCount=4:
   - Each seed run twice in succession
   - Captured layer plan attributes: {waveFreq, phase, wordNoiseOffset, useBezier, region}
   - Compared all 4 layers per seed across runs
   - Result: **PASS** — all plan attributes identical to floating-point precision (< 1e-9 epsilon)
   
   This proves plan-level randoms are deterministic and isolated from content generation retry counts.

**Result:** Determinism contract now upheld. `planLayers()` draws all master-stream randoms before any per-layer reseeding, guaranteeing reproducible layer plans from a fixed masterSeed.
