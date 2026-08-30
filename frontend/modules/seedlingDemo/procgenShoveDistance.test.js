/**
 * seedlingDemo/procgenShoveDistance — **HOW FAR DOWN A CORRIDOR DOES THE
 * EXISTING `shove` PUSH A BLOCK?** — PROCGEN ELEMENTS arc 3, slice 4a, D3's
 * MEASURE-FIRST gate.
 *
 * ⛔ THE BLOCK POCKET's whole design turns on this number and nothing else in
 * the arc had ever asked it. Catalogue #2 (*block in the way, pocket beyond*)
 * puts a `pushableblock` ON a main-path cut cell and CARVES the block's rest
 * cell at the first non-ground cell along the push direction — so the block
 * travels `2` cells at the very least (the cell after the door must be ground,
 * or there is nothing to push into), and on a longer straight run it travels
 * further. If the solver could only manage ONE cell the element would have to
 * put its pocket at `D+d` and the design would change, so the number is
 * measured on a HAND-DRAWN corridor before anything is built around it.
 *
 * ── THE ROOM, DRAWN OUT ───────────────────────────────────────────────
 *
 *        x 0 1 2 3 4 5 6 7 8 9
 *    y=0   # # # # # # # # # #
 *    y=1   # S . . . . P # # #     S = start (1,1) · P = the rest POCKET (6,1)
 *    y=2   # # # # # . # # # #
 *    y=3   # # # # # . # # # #
 *    y=4   # # # # # . # # # #
 *    y=5   # # # # # . # # # #
 *    y=6   # # # # # . # # # #
 *    y=7   # # # # # . # # # #
 *    y=8   # # # # # . . . g #     g = goal (8,8)
 *    y=9   # # # # # # # # # #
 *
 * The corridor runs EAST along row 1, turns SOUTH at (5,1) and reaches the goal
 * along row 8. `(6,1)` is the CARVED rest pocket — the first non-ground cell
 * past the bend, exactly what the element's straight-run walk lands on. The
 * block starts at (4,1) / (3,1) / (2,1), so clearing the corridor costs a shove
 * of 2 / 3 / 4 cells respectively, and the three arms differ in NOTHING else.
 *
 * ⚠ THE ROOM IS NOT THE ELEMENT. Nothing here goes through `seedlingModel` —
 * it is `procgenOracle.solve` on a drawn record, which is the shape D1(a) and
 * the certification fixture both use, and it isolates the SOLVER's capability
 * from the placement rule that will exploit it.
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

const START = { tx: 1, ty: 1 };
const GOAL = { tx: 8, ty: 8 };
const POCKET = { tx: 6, ty: 1 };

const GROUND = [
    [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
    [5, 2], [5, 3], [5, 4], [5, 5], [5, 6], [5, 7], [5, 8],
    [6, 8], [7, 8], [8, 8],
    [POCKET.tx, POCKET.ty],
];

function corridorRoom(blockAt) {
    let record = emptyLevel({ level: SEEDLING_DEFAULTS.level, floor: 'wall' });
    record = withTerrain(record, GROUND.map(([tx, ty]) => ({ tx, ty, terrain: 'ground' })));
    return withEntities(record, [
        { type: SEEDLING_DEFAULTS.goalClass, ...GOAL, attrs: { tag: '0' } },
        { type: 'pushableblock', ...blockAt },
    ].map((e) => ({
        type: e.type, ...oelAtTile(e.tx, e.ty), ...(e.attrs ? { attrs: e.attrs } : {}),
    })));
}

function solveWithBlockAt(blockAt, name) {
    const record = corridorRoom(blockAt);
    const staging = bootStaging({
        boot: bootAtTile(record, START.tx, START.ty),
        items: PRE_SWORD_ITEMS,
        pins: ['dead_frames'],
    });
    return solve(record, staging, [collectGoal(GOAL.tx * 16, GOAL.ty * 16)],
        DEFAULT_BUDGET, { name });
}

/** The three arms, by the distance from the block's cell to the rest pocket. */
const ARMS = Object.freeze([
    { distance: 2, block: { tx: 4, ty: 1 } },
    { distance: 3, block: { tx: 3, ty: 1 } },
    { distance: 4, block: { tx: 2, ty: 1 } },
]);

describe('⛓⛓⛓ D3 MEASURE FIRST — the shove distance the existing solver manages', () => {
    for (const arm of ARMS) {
        it(`shoves a block ${arm.distance} cells down a corridor into the carved pocket`, () => {
            const out = solveWithBlockAt(arm.block, `shove-distance-${arm.distance}`);
            const shoves = (out.records ?? []).filter((r) => r.strategy === 'shove');
            expect(out.verdict, out.reasonText ?? '').toBe(VERDICT.SOLVED);
            expect(shoves.length).toBeGreaterThanOrEqual(1);
            /**
             * ⛓ THE BLOCK ENDS IN THE POCKET, which is the claim the element
             * needs — not merely "a shove happened". A `shove` that moved the
             * block one cell and left it in the corridor would still be a
             * record, and the corridor would still be blocked.
             *
             * ⚠ A `shove` RECORD CARRIES `from`/`to` AT ITS TOP LEVEL; it is
             * the `weigh` record that nests them under `.shove` (which is what
             * `liftedClaimFrom` reads). Two verbs, two record shapes, and the
             * first cut of this row read the weigh's — worth stating here
             * because the block pocket's certification reads THIS one.
             */
            const last = shoves[shoves.length - 1];
            expect({ from: last.from, to: last.to, dir: last.dir })
                .toEqual({ from: arm.block, to: { tx: POCKET.tx, ty: POCKET.ty }, dir: 'E' });
        });
    }
});
