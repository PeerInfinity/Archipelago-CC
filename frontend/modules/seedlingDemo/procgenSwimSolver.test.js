/**
 * seedlingDemo — **THE SOLVER SWIMS: the conch prices water on the SOLVER's
 * plan bag** (seedling swim S1, D1).
 *
 * `botDriverV2.plannerObstacleAt` has priced a `lethal-terrain` tile by the
 * ITEM since R4 (skipped when `inventory.canSwim`), and the DRIVER's `planNow`
 * passes `inventory: run.inventory`. The SOLVER's `solverPlanOpts` passed no
 * `inventory` and no `noHazards`, so the live solver saw every water tile as a
 * wall with or without the conch. D1 hands it the driver's exact bag.
 *
 * ⛓ THE WITNESS ROOM, measured at swim S1's W0 (base `34f32cf324`): a generated
 * 8x6 `empty` post-sword room with tiles (2, 1..4) repainted to water — a
 * 1-wide column between the boot (1,1) and the goal (3,4).
 *
 *   arm                               before D1          after D1
 *   A no conch, `sound` pinned         REFUSED no-corridor  REFUSED (same)
 *   B `canSwim`, `sound` pinned        REFUSED (same)       SOLVED 71 t
 *   C `canSwim`, NO `sound` pin        REFUSED (same)       THROWS PhysicsV2Error
 *
 * ⛔ MUTANT (a) — the two keys dropped from `solverPlanOpts` — reddens arm B
 * (and arm C, which then refuses instead of throwing).
 */

import { describe, expect, it } from 'vitest';

import { generateSeedlingLevel } from './procgenSeedling.js';
import { POST_SWORD_PALETTE } from './procgenPalette.js';
import { DEFAULT_BUDGET, bootStaging } from './procgenOracle.js';
import { atlasOf, TERRAIN } from './procgenLevel.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { createRunForStaging, solveStaging } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

const WET = new Set(['2,1', '2,2', '2,3', '2,4']);

function witness() {
    const out = generateSeedlingLevel({
        seed: 1, palette: POST_SWORD_PALETTE,
        bounds: { obstacleTarget: 1, triesPerStep: 1, saturationK: 1 },
        defaults: { width: 8, height: 6 },
        skeleton: parseSkeleton('empty', { substrate: 'seedling' }),
        elements: parseElementSpec('none'),
    });
    const rec = structuredClone(out.record);
    for (const layer of rec.layers) {
        if (!Array.isArray(layer.tiles)) continue;
        layer.tiles = layer.tiles.map((t) => (WET.has(`${t[0]},${t[1]}`)
            ? [t[0], t[1], TERRAIN.water.column * 16, 0, ...t.slice(4)] : t));
    }
    return { out, rec };
}

function arm({ canSwim, pins }) {
    const { out, rec } = witness();
    const boot = out.model.boot();
    const items = { hasSword: true, ...(canSwim ? { canSwim: true } : {}) };
    try {
        const run = createRunForStaging(solveStaging(bootStaging({ boot, items, pins })),
            levelSourceFromAtlas(atlasOf(rec)), { scratchPersistence: true });
        const r = solveSegment({ run, goals: out.model.goals, name: 'swim-w0', boot,
            maxTicksPerTarget: DEFAULT_BUDGET.maxTicksPerTarget });
        return { verdict: 'SOLVED', ticks: r.perTick.length, drown: run.state.drown };
    } catch (e) {
        return { verdict: 'THREW', name: e.name, message: e.message };
    }
}

describe('⛓⛓⛓ the solver prices water by the conch (swim S1, D1)', () => {
    it('arm A — no conch: REFUSED, no corridor, separated by water', () => {
        const r = arm({ canSwim: false, pins: ['dead_frames', 'sound'] });
        expect(r.name).toBe('SolverRefusal');
        expect(r.message).toMatch(/no corridor/);
        expect(r.message).toMatch(/separated by water/);
    }, 60000);

    it('arm B — the conch and `sound` pinned: SOLVED through the water column, no drown tick', () => {
        const r = arm({ canSwim: true, pins: ['dead_frames', 'sound'] });
        expect(r.verdict).toBe('SOLVED');
        expect(r.ticks).toBe(71);
        expect(r.drown.timer).toBe(0);
    }, 60000);

    it('arm C — the conch and NO `sound` pin: the wet tick THROWS by name', () => {
        const r = arm({ canSwim: true, pins: ['dead_frames'] });
        expect(r.name).toBe('PhysicsV2Error');
        expect(r.message).toMatch(/entered Water .* does not pin "sound"/);
    }, 60000);
});
