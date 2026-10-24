/**
 * seedlingDemo/procgenCollectPath.test — ⚖ THE COLLECT-PATH RULING, DRIVEN.
 *
 * PROCGEN PoC arc, slice 3. ⚖ user, 2026-08-12, on slice 2 §9.1: the corridor
 * limitation *"sounds like a bug that we should fix with collection goals, not
 * something to work around by only using exit goals"*, and *"items should be
 * collectable from any angle"*.
 *
 * Slice 2 measured the composition failure: `solveSegment`'s collect branch
 * derived a stance BEFORE any walk, that derivation required a corridor with NO
 * strategy applied, and the obstacle ladder lives INSIDE `walkTo` on the far
 * side of it. So a corridor-blocking obstacle refused before its clearer was
 * ever selected, and every clearer template in the pre-sword palette was
 * unbuildable.
 *
 * ── WHAT EACH STRATUM HERE IS FOR ─────────────────────────────────────
 *
 *   1. ANY ANGLE. Four rooms in which the goal pickup has exactly ONE walkable
 *      neighbour — north, east, south, west — each ending in a CERTIFIED
 *      collect. ⚠ These four pass at `a1f08414c` too, and that is the finding
 *      they carry: the ring search was always omnidirectional and the north
 *      preference is the `(d, y, x)` TIE-BREAK, not a gate. They are here as
 *      the standing proof of ⚖ "any angle", so a later tie-break edit that
 *      quietly became directional arrives as a red test.
 *   2. THE LADDER ROUTING. The corridor cases slice 2 measured as REFUSED,
 *      now reaching their verbs.
 *   3. THE LEVEL RECTANGLE. A cell outside the room is not a stance.
 *
 * ⛔ DRIVEN THROUGH `procgenOracle.solve`, NOT THROUGH A HAND-BUILT RUN. That
 * is the seam the finding was measured on and the one the generator uses; a
 * second run construction here would be a second spelling of the thing under
 * test (§11.7's law, and slice 1 §8.4's ruling one layer down).
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
 * A 10x10 bordered room with `walls` painted, a `torchpickup` at `goal`, and
 * whatever `entities` the case is about. The defaults are `procgenSeedling`'s
 * own so a case here and a generated room are the same kind of room.
 */
function room({ goal, walls = [], entities = [] }) {
    let record = emptyLevel({ level: SEEDLING_DEFAULTS.level });
    if (walls.length) {
        record = withTerrain(record, walls.map((c) => ({ ...c, terrain: c.terrain ?? 'wall' })));
    }
    return withEntities(record, [
        {
            type: SEEDLING_DEFAULTS.goalClass,
            ...oelAtTile(goal.tx, goal.ty),
            attrs: { tag: SEEDLING_DEFAULTS.goalTag },
        },
        ...entities.map((e) => ({
            type: e.type,
            ...oelAtTile(e.tx, e.ty),
            ...(e.attrs ? { attrs: e.attrs } : {}),
        })),
    ]);
}

function solveRoom(name, spec) {
    const record = room(spec);
    const staging = bootStaging({
        boot: bootAtTile(record, START.tx, START.ty),
        items: PRE_SWORD_ITEMS,
        pins: ['dead_frames'],
    });
    return solve(record, staging, [collectGoal(spec.goal.tx * 16, spec.goal.ty * 16)],
        DEFAULT_BUDGET, { name });
}

/** Every verb the solve decided on, from its trace rows AND its records. */
const verbsOf = (out) => {
    const verbs = new Set();
    for (const row of out.rows ?? []) if (row.strategy?.verb) verbs.add(row.strategy.verb);
    for (const rec of out.records ?? []) if (rec.strategy) verbs.add(rec.strategy);
    return verbs;
};

/** A full wall across the interior at row `ty`, with `gapTx` left open. */
const wallAcross = (ty, gapTx) => {
    const out = [];
    for (let tx = 1; tx <= 8; tx += 1) if (tx !== gapTx) out.push({ tx, ty });
    return out;
};

describe('⚖ ANY ANGLE — a pickup with exactly one open side is collected from it', () => {
    /**
     * The goal sits at (4,4) and every ring-1 neighbour but one is Stone,
     * DIAGONALS INCLUDED. ⛔ The diagonals matter: without them two ring-1
     * cells would be walkable and the `(d, y, x)` tie-break — not the geometry
     * — would decide the approach, which is the very thing this test must not
     * let decide. With them, the ONLY ring-1 candidate is the named side, and
     * every ring-2/3 cell is strictly farther, so the stance is forced.
     */
    const GOAL = { tx: 4, ty: 4 };
    const sides = {
        N: { dx: 0, dy: -1 },
        E: { dx: 1, dy: 0 },
        S: { dx: 0, dy: 1 },
        W: { dx: -1, dy: 0 },
    };
    const boxedExcept = (open) => {
        const out = [];
        for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
                if (dx === 0 && dy === 0) continue;
                if (dx === sides[open].dx && dy === sides[open].dy) continue;
                out.push({ tx: GOAL.tx + dx, ty: GOAL.ty + dy });
            }
        }
        return out;
    };

    // Built FROM the side table, so a side added here without a case is a
    // missing test rather than an uncounted one (trap 199's structure).
    for (const side of Object.keys(sides)) {
        it(`collects a pickup reachable ONLY from the ${side}`, () => {
            const out = solveRoom(`any-angle-${side}`, {
                goal: GOAL, walls: boxedExcept(side),
            });
            expect(out.verdict).toBe(VERDICT.SOLVED);
            expect(out.certification.certified).toBe(true);
            expect(out.certification.collected).toHaveLength(1);
            expect(out.certification.collected[0].strategy).toBe('collect');
        });
    }

    it('the four sides are not one side four times — the walks differ in length', () => {
        const ticks = Object.keys(sides).map((side) => solveRoom(`any-angle-len-${side}`, {
            goal: GOAL, walls: boxedExcept(side),
        }).ticks);
        // The start is the room's NW corner, so N and W are near sides and E
        // and S are far ones; a run that took the same route four times would
        // report one number four times.
        expect(new Set(ticks).size).toBeGreaterThan(1);
    });
});

describe('⛓ THE LADDER ROUTING — a corridor-blocking obstacle reaches its verb', () => {
    /**
     * ⛔ SLICE 2 §9.1's OWN GEOMETRY, and its measured refusal is the control
     * this test is against: *"no REACHABLE stance within 3 lattice rings of
     * torchpickup@… — 34 walkable candidate(s), none with a corridor from
     * (24,24)"*, with `shove` never selected.
     */
    it('shoves the block out of the only gap and collects — the flip', () => {
        const out = solveRoom('corridor-shove', {
            goal: { tx: 7, ty: 8 },
            walls: wallAcross(5, 4),
            entities: [{ type: 'pushableblock', tx: 4, ty: 5 }],
        });
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(verbsOf(out)).toContain('shove');
        expect(out.certification.certified).toBe(true);
    });

    it('and does it with the goal on the other side of the room, too', () => {
        const out = solveRoom('corridor-shove-west', {
            goal: { tx: 1, ty: 8 },
            walls: wallAcross(5, 4),
            entities: [{ type: 'pushableblock', tx: 4, ty: 5 }],
        });
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(verbsOf(out)).toContain('shove');
    });

    /**
     * ⛔⛔ THE `hold` HALF IS A SELECTION TEST, NOT A SOLVE TEST, and the
     * difference is the whole honesty of it. Slice 2's finding was that the
     * verb was NEVER SELECTED; this slice's fix is that it is. The verb then
     * still fails, on the game's own mechanism — a `Lock` is open only WHILE
     * its group is published and `Button.update` republishes from whoever
     * stands on it, so a player who leaves the button has already shut the
     * lock. Asserting SOLVED here would be asserting a mechanism Seedling does
     * not have; asserting the SELECTION is asserting exactly what changed.
     */
    it('selects `hold` for a lock in the gap — the verb slice 2 never reached', () => {
        const out = solveRoom('corridor-hold', {
            goal: { tx: 4, ty: 8 },
            walls: wallAcross(5, 4),
            entities: [
                { type: 'lock', tx: 4, ty: 5, attrs: { tag: '0', tset: '0' } },
                { type: 'button', tx: 2, ty: 3, attrs: { tset: '0' } },
            ],
        });
        expect(verbsOf(out)).toContain('hold');
        expect(out.rows.some((r) => r.strategy?.verb === 'hold'
            && r.obstacle?.id === 'lock@64,80')).toBe(true);
        // It does not finish, and the verdict says which bound it spent.
        expect(out.verdict).not.toBe(VERDICT.SOLVED);
    });

    /**
     * ⛓⛓ THE WRONG-SIDE STANCE — ⚖ "any angle"'s other half.
     *
     * The goal sits ONE ROW under the wall, so a ring-3 candidate ABOVE the
     * wall is corridor-reachable and, by distance alone, answers first. It is
     * also a cell the pickup cannot be collected from: `runCollect` presses
     * toward the pickup's centre and the wall is in the way. Measured at
     * `238f0dbe9` (this slice's own first commit, D3 not yet in): REFUSED with
     * *"the sweep was blocked by tile:Stone at (120,88)"* — the solver walked
     * to a stance it could not collect from and said so three ticks later.
     *
     * ⛔ THE DISTINCTION THIS PINS: the fix is not "prefer near cells" — the
     * wrong-side cell was preferred BECAUSE it was near. It is "a stance you
     * cannot collect from is not a stance", so the below-wall cells win even
     * though reaching them costs a shove.
     */
    it('will not stand on the wrong side of a wall to collect — it shoves instead', () => {
        const out = solveRoom('wrong-side-stance', {
            goal: { tx: 7, ty: 7 },
            walls: wallAcross(5, 4),
            entities: [{ type: 'pushableblock', tx: 4, ty: 5 }],
        });
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(verbsOf(out)).toContain('shove');
        expect(out.certification.certified).toBe(true);
    });

    /**
     * ⛓ THE GENUINE NO-STANCE CASE STILL REFUSES, and the refusal changed its
     * WORD: it is now about walkable cells rather than reachable ones, because
     * "reachable" is the question the ladder answers and this function no
     * longer pretends to.
     */
    it('refuses by name when the pickup has NO walkable ring cell at all', () => {
        const walls = [];
        for (let dy = -3; dy <= 3; dy += 1) {
            for (let dx = -3; dx <= 3; dx += 1) {
                if (dx === 0 && dy === 0) continue;
                walls.push({ tx: 4 + dx, ty: 4 + dy });
            }
        }
        const out = solveRoom('no-stance-at-all', { goal: { tx: 4, ty: 4 }, walls });
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.reasonText).toContain('no WALKABLE stance within 3 lattice rings');
        expect(out.reasonText).toContain('0 walkable candidate(s)');
    });
});

describe('⛔ THE LEVEL RECTANGLE — a cell outside the room is not a stance', () => {
    /**
     * ⛓ MEASURED AT `a1f08414c`: with the goal at (7,8) the ring search
     * offered lattice cell (10,5) — one column past a room whose last column
     * is 9, where `plannerObstacleAt` finds no tile and therefore answers
     * "walkable" — `planWaypoints` planned a corridor to `(168,88)` through
     * the border wall, and the walk spent its whole per-target budget grinding
     * into `tile:Stone`. The same room with the goal at (1,8) derived
     * `(-8,88)`.
     *
     * ⛔⛔ THE CASE THAT BITES IS A GOAL THAT IS GENUINELY SEALED OFF, with no
     * clearer anywhere in the room — because the bound only decides anything
     * once every IN-BOUNDS candidate has failed to plan. Measured at
     * `a1f08414c`: `BUDGET_EXHAUSTED (per-target-ticks)`, the walk aiming at
     * `(168,88)` and grinding the border wall for 400 ticks twice over. That
     * verdict is a LIE about the room — the level is not expensive, it is
     * impossible — and the generator would have recorded it as a budget
     * finding rather than as an unsolvable candidate.
     *
     * ⚠ An "edge goal still solves" case was written first and DROPPED: it
     * passes at `a1f08414c` too, because a nearer in-bounds candidate plans
     * before the out-of-rectangle one is ever reached. A test that is green
     * both ways pins nothing (the empty-layer trap), and saying so here is
     * cheaper than someone re-deriving it.
     */
    it('a sealed-off goal REFUSES instead of burning the budget outside the room', () => {
        const out = solveRoom('sealed-goal', {
            goal: { tx: 7, ty: 8 },
            walls: wallAcross(5, null), // no gap at all
        });
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.budgetKind ?? null).toBeNull();
        expect(out.reasonText).toContain('no corridor for goal collect-placement');
        expect(out.reasonText).toContain('different connected components');
    });
});
