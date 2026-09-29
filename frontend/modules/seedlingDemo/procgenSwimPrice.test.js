/**
 * seedlingDemo — **THE SWIMMER'S PRICE: a swum water node costs
 * `WATER_STEP_COST`** (seedling swim T2, D1).
 *
 * `botDriverV2.planTilePath` was a unit-cost A*, so with the conch a water
 * tile cost what a ground tile costs — and the swim is slower. S1's D5 grade
 * census found 9 of 87 water shortcuts cheaper WITHOUT the conch
 * (NOT-ESTABLISHED). D1 prices the swum node at 2.25 (the held-key corridor's
 * measured 30.875 / 13.625 t per cell, rounded to a quarter so a g-score is an
 * exact binary sum); every other node still costs 1.
 *
 * ⛓ THE RE-GRADE, measured at T2's D1 (scratch `shortens-all.mjs`, S1's grid):
 *
 *   cell                 before (S1)                  after D1
 *   loopy 10x10 s1       NOT-ESTABLISHED 175 / 160    SHORTENS 133 / 160
 *   loopy 10x10 s3       NOT-ESTABLISHED 144 / 110    INERT    110 / 110
 *   loopy 14x14 s2       NOT-ESTABLISHED 267 / 232    INERT    232 / 232
 *
 * ⛔ MUTANT (a) — `WATER_STEP_COST` set to 1 — puts the planner back on the
 * swim in the choice room and the three rows back on their S1 grades.
 */

import { describe, expect, it } from 'vitest';

import { generateSeedlingLevel, seedlingSkeletonSpec } from './procgenSeedling.js';
import { POST_SWIM_PALETTE, POST_SWORD_PALETTE } from './procgenPalette.js';
import { gradeOf, requirementsFor } from './procgenRequirements.js';
import { DEFAULT_BUDGET, bootStaging } from './procgenOracle.js';
import { atlasOf, TERRAIN } from './procgenLevel.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { createRunForStaging, solveStaging } from './tapeRunner.js';
import { DEFAULT_LATTICE, WATER_STEP_COST, nodeCentre, planTilePath } from './botDriverV2.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

/**
 * A 9x6 empty room, interior all ground, with water at (3,2) and (4,2): from
 * (1,2) to (6,2) the straight way is 5 steps through 2 water cells
 * (3 + 2 x 2.25 = 7.5) and the dry way round row 1 is 7 steps (7).
 */
const WET = new Set(['3,2', '4,2']);

function choiceRoom({ canSwim }) {
    const out = generateSeedlingLevel({
        seed: 1, palette: POST_SWORD_PALETTE,
        bounds: { obstacleTarget: 1, triesPerStep: 1, saturationK: 1 },
        defaults: { width: 9, height: 6 },
        skeleton: parseSkeleton('empty', { substrate: 'seedling' }),
        elements: parseElementSpec('none'),
    });
    const rec = structuredClone(out.record);
    for (const layer of rec.layers) {
        if (!Array.isArray(layer.tiles)) continue;
        layer.tiles = layer.tiles.map((t) => {
            if (t[0] < 1 || t[0] > 7 || t[1] < 1 || t[1] > 4) return t;
            const col = WET.has(`${t[0]},${t[1]}`) ? TERRAIN.water.column : TERRAIN.ground.column;
            return [t[0], t[1], col * 16, 0, ...t.slice(4)];
        });
    }
    rec.entities = [];
    const items = { hasSword: true, ...(canSwim ? { canSwim: true } : {}) };
    const run = createRunForStaging(solveStaging(bootStaging({
        boot: out.model.boot(), items, pins: ['dead_frames', 'sound'],
    })), levelSourceFromAtlas(atlasOf(rec)), { scratchPersistence: true });
    return run;
}

const plan = (run) => planTilePath(run.world, nodeCentre(1, 2, DEFAULT_LATTICE),
    nodeCentre(6, 2, DEFAULT_LATTICE), null,
    { lattice: DEFAULT_LATTICE, inventory: run.inventory, noHazards: run.noHazards });

describe('⛓⛓⛓ the planner prices a swum water node (swim T2, D1)', () => {
    it('the price is the measured ratio, rounded to an exact quarter', () => {
        expect(WATER_STEP_COST).toBe(2.25);
        expect(WATER_STEP_COST * 4).toBe(9);
    });

    it('with the conch, two water cells cost more than a two-step detour: the route goes round', () => {
        const run = choiceRoom({ canSwim: true });
        const path = plan(run);
        expect(path.some((c) => WET.has(`${c.tx},${c.ty}`))).toBe(false);
        expect(path.length - 1).toBe(7);
    }, 60000);

    it('without the conch the water is a wall and the route is the same detour', () => {
        const run = choiceRoom({ canSwim: false });
        const path = plan(run);
        expect(path.some((c) => WET.has(`${c.tx},${c.ty}`))).toBe(false);
        expect(path.length - 1).toBe(7);
    }, 60000);

    it('a coerced water tile is plain floor and costs 1: the straight way', () => {
        const run = choiceRoom({ canSwim: true });
        const path = planTilePath(run.world, nodeCentre(1, 2, DEFAULT_LATTICE),
            nodeCentre(6, 2, DEFAULT_LATTICE), null,
            { lattice: DEFAULT_LATTICE, inventory: run.inventory, noHazards: ['water'] });
        expect(path.length - 1).toBe(5);
    }, 60000);
});

const BOUNDS = Object.freeze({ obstacleTarget: 3, triesPerStep: 4, saturationK: 3,
    anchorTriesPerCandidate: 1 });

function grade(kind, size, seed) {
    const out = generateSeedlingLevel({
        seed, palette: POST_SWIM_PALETTE, bounds: BOUNDS,
        defaults: { width: size, height: size },
        skeleton: seedlingSkeletonSpec(kind),
        elements: parseElementSpec('watershortcut'),
    });
    expect(out.certification.certified).toBe(true);
    const rep = requirementsFor({
        record: out.record, model: out.model, palette: POST_SWIM_PALETTE,
        summary: out.summary, seed, biome: 'post-swim',
    }, { verdict: 'SOLVED', ticks: out.summary.finalTicks }, { budget: DEFAULT_BUDGET });
    const row = rep.rows.find((r) => r.flag === 'canSwim');
    return { grade: gradeOf(row), with: row.withTicks, without: row.withoutTicks };
}

describe('⛓⛓⛓ the water shortcut re-graded under the price (swim T2, D1)', () => {
    it('loopy 10x10 s1: NOT-ESTABLISHED 175/160 → SHORTENS 133/160', () => {
        expect(grade('loopy', 10, 1)).toEqual({ grade: 'SHORTENS', with: 133, without: 160 });
    }, 120000);

    it('loopy 10x10 s3: NOT-ESTABLISHED 144/110 → INERT 110/110', () => {
        expect(grade('loopy', 10, 3)).toEqual({ grade: 'INERT', with: 110, without: 110 });
    }, 120000);

    it('loopy 14x14 s2: NOT-ESTABLISHED 267/232 → INERT 232/232', () => {
        expect(grade('loopy', 14, 2)).toEqual({ grade: 'INERT', with: 232, without: 232 });
    }, 120000);
});
