/**
 * seedlingDemo/procgenNestedOpeners.test — **THE UNIT ROWS FOR SLICE S1**, one
 * per mechanism, on rooms small enough that the mechanism is the ONLY route.
 *
 * PROCGEN ELEMENTS arc 3, slice S1 ("nested openers"). The six-arm fixture
 * (`procgenSeedlingElementsCertify.test.js`) is the CERTIFICATION gate — it says
 * whether the reverse-pull gadget can be beaten end to end. This file is the
 * other half: it drives each of the three gaps' mechanisms in isolation, so a
 * red arm there can be attributed to a mechanism rather than bisected out of a
 * whole gadget.
 *
 * ⛔ EVERY ROOM HERE MAKES ITS MECHANISM THE ONLY ROUTE (trap 302): the corridor
 * to the goal is a single lane, so a row that passes for a second reason would
 * have to be a route this file drew by accident. Where a row's point is that
 * something does NOT happen, its own CONTROL sits beside it.
 */

import { describe, expect, it } from 'vitest';

import {
    bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain,
} from './procgenLevel.js';
import {
    DEFAULT_BUDGET, VERDICT, bootStaging, collectGoal, solve,
} from './procgenOracle.js';
import { PRE_SWORD_ITEMS } from './procgenPalette.js';
import { SEEDLING_DEFAULTS } from './procgenSeedling.js';

const START = SEEDLING_DEFAULTS.start;

/**
 * Build a room from a list of GROUND cells plus entities, boot at the Seedling
 * default start, and solve for one collect.
 */
function solveRoom(name, { ground, entities, goal }) {
    let record = emptyLevel({ level: SEEDLING_DEFAULTS.level, floor: 'wall' });
    record = withTerrain(record, ground.map(([tx, ty]) => ({ tx, ty, terrain: 'ground' })));
    record = withEntities(record, [
        { type: SEEDLING_DEFAULTS.goalClass, ...goal, attrs: { tag: '0' } },
        ...entities,
    ].map((e) => ({
        type: e.type, ...oelAtTile(e.tx, e.ty), ...(e.attrs ? { attrs: e.attrs } : {}),
    })));
    const staging = bootStaging({
        boot: bootAtTile(record, START.tx, START.ty),
        items: PRE_SWORD_ITEMS,
        pins: ['dead_frames'],
    });
    return solve(record, staging, [collectGoal(goal.tx * 16, goal.ty * 16)],
        DEFAULT_BUDGET, { name });
}

const verbs = (out) => (out.records ?? []).map((r) => r.strategy);

/**
 * ⛓ THE DWELL ROOM — one lane east, a `lock` across it, a `button` in a two-cell
 * SPUR off the lane, and the goal beyond the lock.
 *
 *     x 0 1 2 3 4 5 6
 * y=1   # S . . L . g      S = start · L = lock (4,1) · g = goal (6,1)
 * y=2   # # . # # # #      the spur: (2,2) is where a lean would start from
 * y=3   # # b # # # #      b = button (2,3)
 *
 * ⛔ THE SPUR IS TWO CELLS DEEP ON PURPOSE, so the shove CONTROL below is a real
 * lean the player can reach — stand on (2,1), lean SOUTH, the block travels
 * (2,2) -> (2,3). The two rooms then differ in exactly ONE entity's cell (trap
 * 345: ablate one entity at a time), and everything else about them is equal.
 *
 * ⛔ AND THE BUTTON IS OFF THE LANE, so a `hold` on it is not refused by the
 * corridor — only by the BLOCK standing in its cell, which is the defect ARM 5
 * measured. A room whose button sat in the lane would confound "the hold has
 * nowhere to stand" with "the lane is blocked".
 */
const SPUR_GROUND = [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [2, 2], [2, 3]];
const DWELL_ROOM = {
    ground: SPUR_GROUND,
    goal: { tx: 6, ty: 1 },
    entities: [
        { type: 'lock', tx: 4, ty: 1, attrs: { tset: '1', tag: '1' } },
        { type: 'button', tx: 2, ty: 3, attrs: { tset: '1' } },
        { type: 'pushableblock', tx: 2, ty: 3 },
    ],
};

describe('⛓⛓ S1 GAP 3 — the DWELL arm: a gadget that arrived already solved', () => {
    it('a block ALREADY on the button resolves to a DWELL-ONLY weigh and SOLVES', () => {
        const out = solveRoom('s1-dwell', DWELL_ROOM);
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(verbs(out)).toEqual(['weigh', 'collect']);
        const weigh = out.records.find((r) => r.strategy === 'weigh');
        expect(weigh.dwellOnly).toBe(true);
        // ⛔ NO SHOVE. `runShove` refuses a lean that moves nothing by name, and a
        // verb whose check cannot fail is not a verb.
        expect(weigh.shove).toBeUndefined();
        expect(weigh.parked).toMatchObject({
            block: 'pushableblock@32,48', tile: { tx: 2, ty: 3 }, sinceTick: 0,
        });
        // and the dwell really waited out the FADE — the observable is the lock,
        // not a tick count (`runDwell` refuses an idle span).
        expect(weigh.dwell.ticks).toBeGreaterThan(0);
    });

    /**
     * ⛔⛔ THE CONTROL THAT SAYS THE ARM DID NOT SWALLOW A REAL LEAN. The SAME
     * room with the block one tile off the button still SHOVES it there — so the
     * dwell arm is reached only where there is no distance to close, and a
     * derivation that had started answering "dwell" for every weigh would fail
     * here rather than pass everywhere.
     */
    it('CONTROL — the SAME room with the block ONE CELL OFF the button still SHOVES '
        + 'it on', () => {
        const out = solveRoom('s1-dwell-control', {
            ...DWELL_ROOM,
            entities: [
                { type: 'lock', tx: 4, ty: 1, attrs: { tset: '1', tag: '1' } },
                { type: 'button', tx: 2, ty: 3, attrs: { tset: '1' } },
                { type: 'pushableblock', tx: 2, ty: 2 },
            ],
        });
        expect(out.verdict).toBe(VERDICT.SOLVED);
        const weigh = out.records.find((r) => r.strategy === 'weigh');
        expect(weigh.dwellOnly).toBeUndefined();
        expect(weigh.shove).toMatchObject({ to: { tx: 2, ty: 3 } });
    });
});
