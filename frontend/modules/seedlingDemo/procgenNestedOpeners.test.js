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
import { NESTED_OPENER_DEPTH } from './solverBot.js';
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


/**
 * ⛓ THE POCKET ROOM — the smallest geometry in which a stance is unreachable
 * because a BLOCK stands in front of it AND the block has somewhere to go.
 *
 *     x 0 1 2 3 4 5 6
 * y=1   # S . . L . g     S = start · L = lock (4,1) t=2 · g = goal (6,1)
 * y=2   # . . # # # #     (1,2) and the spur's mouth (2,2)
 * y=3   # . B . # # #     B = the block (2,3) · (3,3) is the POCKET it is shoved into
 * y=4   # # F # # # #     F = the buttonroom (2,4) t=2 — `lock`(4,1)'s only opener
 *
 * ⛔ (2,4)'s ONLY neighbour is (2,3), so the flag's stance is unreachable while
 * the block stands there — a STANCE problem, not a lane one, which is what makes
 * the prerequisite a stance derivation's to raise.
 * ⛔ AND THE POCKET IS LOAD-BEARING: without (3,3) the only shove that clears
 * (2,3) puts the block ON (2,4), so nothing plans and the room refuses. The first
 * cut of this fixture had no pocket and measured exactly that.
 */
const POCKET = [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
    [1, 2], [2, 2], [1, 3], [2, 3], [3, 3], [2, 4]];
const LOCK_B = { type: 'lock', tx: 4, ty: 1, attrs: { tset: '2', tag: '1' } };
const FLAG_AT = (tx, ty, tset, tag) => ({ type: 'buttonroom', tx, ty,
    attrs: { tset, tag, flip: '0', room: '-1' } });

describe('⛓⛓⛓ S1 GAP 1 — a stance derivation may return a PREREQUISITE', () => {
    /**
     * ⛓ THE GEOMETRY ARM. No activator in the hypothesis wants this block, so it
     * is scenery: shove it into the pocket, then RE-DERIVE the stance against the
     * world that changed rather than against a promise about it.
     */
    it('a stance blocked by a BLOCK ⇒ the BLOCK is the prerequisite, cleared by '
        + '`shove`', () => {
        const out = solveRoom('s1-prereq-block', {
            ground: POCKET,
            goal: { tx: 6, ty: 1 },
            entities: [LOCK_B, FLAG_AT(2, 4, '2', '2'), { type: 'pushableblock', tx: 2, ty: 3 }],
        });
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(verbs(out)).toEqual(['shove', 'hold', 'collect']);
        expect(out.records[0]).toMatchObject({
            id: 'pushableblock@32,48', from: { tx: 2, ty: 3 },
        });
    });

    /**
     * ⛓⛓⛓ THE MECHANISM ARM, AND THE ORDERING IT EXISTS FOR — ⚖ ruling 22's own
     * shape, minimised until nothing but the chain is left.
     *
     *     x 0 1 2 3 4 5 6
     * y=1   # S . . L . g     L = `lock`(4,1) t=2 · g = goal (6,1)
     * y=2   # # . # # # #     (2,2) — the push lane's mouth
     * y=3   # # B # # # #     B = the block (2,3)
     * y=4   # . . # # # #     (1,4) is the BYPASS, (2,4) the lane
     * y=5   # D b # # # #     D = `lock`(1,5) t=1 · b = `button`(2,5) t=1
     * y=6   # F # # # #       F = the buttonroom (1,6) t=2
     *
     * The block stands between the walker and BOTH the button and (through the
     * bypass) the flag — which is the reverse-pull gadget's geometry by
     * construction. ⛔ A GEOMETRY-FIRST POLICY WOULD SHOVE IT ASIDE, buy the
     * corridor, and leave `lock`(1,5) shut with the room's only block spent. The
     * record is the discriminator: `weigh` naming the block AND the button, never
     * `shove`.
     */
    it('a stance blocked by a LOCK whose opener exists ⇒ the LOCK is the '
        + 'prerequisite, cleared by `weigh` — the MECHANISM before the GEOMETRY', () => {
        const out = solveRoom('s1-prereq-lock', {
            ground: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
                [2, 2], [2, 3], [2, 4], [2, 5], [1, 4], [1, 5], [1, 6]],
            goal: { tx: 6, ty: 1 },
            entities: [
                LOCK_B, FLAG_AT(1, 6, '2', '2'),
                { type: 'lock', tx: 1, ty: 5, attrs: { tset: '1', tag: '3' } },
                { type: 'button', tx: 2, ty: 5, attrs: { tset: '1' } },
                { type: 'pushableblock', tx: 2, ty: 3 },
            ],
        });
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(verbs(out)).toEqual(['weigh', 'hold', 'collect']);
        const weigh = out.records[0];
        expect(weigh.shove).toMatchObject({
            id: 'pushableblock@32,48', from: { tx: 2, ty: 3 }, to: { tx: 2, ty: 5 },
        });
        expect(weigh.presser).toEqual({ x: 32, y: 80 });
        // ⛔ and the dwell's observable is `lock`(1,5) — the door the weigh buys.
        expect(weigh.dwell.until).toMatch(/group t=1 \[lock@16,80\] is open/);
    });

    /**
     * ⛔⛔ A LOCK WITH **NO OPENER** IS A WALL, AND THE SENTENCE NAMES IT. The
     * SAME room minus the button: `lock`(1,5) answers to a tSet group nothing
     * publishes, so no order can discharge it, and the block — the only other
     * candidate — cannot be shoved anywhere that plans the corridor either.
     * ⛓ Both are listed, one at a time, because "nothing was tried" and "these
     * were tried and refused" are the two answers this slice exists to separate.
     */
    it('a stance blocked by a lock with NO opener ⇒ REFUSED, and the sentence names '
        + 'every prerequisite it tried', () => {
        const out = solveRoom('s1-prereq-no-opener', {
            ground: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
                [2, 2], [2, 3], [2, 4], [2, 5], [1, 4], [1, 5], [1, 6]],
            goal: { tx: 6, ty: 1 },
            entities: [
                LOCK_B, FLAG_AT(1, 6, '2', '2'),
                { type: 'lock', tx: 1, ty: 5, attrs: { tset: '1', tag: '3' } },
                { type: 'pushableblock', tx: 2, ty: 3 },
            ],
        });
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.reasonText).toMatch(/no REACHABLE stance inside buttonroom@16,96/);
        expect(out.reasonText).toMatch(/THE PREREQUISITES WERE TRIED AND REFUSED/);
        expect(out.reasonText)
            .toMatch(/lock@16,80 \(no presser publishes its tSet group at all/);
        expect(out.reasonText)
            .toMatch(/pushableblock@32,48 \(no shove of it plans the corridor\)/);
    });

    /**
     * ⛔ THE CONTROL FOR THE WHOLE ARM: a room with NOTHING to raise says so in
     * different words. Without it, "no prerequisite exists" and "the prerequisite
     * failed" would be one indistinguishable refusal — the bounded-sweep defect,
     * read for a sweep over the room's own roster.
     */
    it('CONTROL — a stance blocked by a wall names NO prerequisite, in its own '
        + 'words', () => {
        const out = solveRoom('s1-prereq-none', {
            ground: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [2, 3], [2, 4]],
            goal: { tx: 6, ty: 1 },
            entities: [LOCK_B, FLAG_AT(2, 4, '2', '2')],
        });
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.reasonText).toMatch(/NO PREREQUISITE EXISTS TO RAISE/);
        expect(out.reasonText).toMatch(/no walk-family pushable/);
    });
});

describe('⛓⛓ S1 — THE OPENER CHAIN IS BOUNDED, NAMED, AND REFUSES BY NAME', () => {
    it('`NESTED_OPENER_DEPTH` is 2 — the two-deep chain, as a number a reader can '
        + 'find', () => {
        expect(NESTED_OPENER_DEPTH).toBe(2);
    });

    /**
     * ⛓⛓⛓ TWO POCKET ROOMS ON ONE LANE, so ONE GOAL needs TWO opener chains:
     *
     *     x 0 1 2 3 4 5 6 7 8
     * y=1   # S . L . . M . g     L = lock(3,1) t=2 · M = lock(6,1) t=3 · g = (8,1)
     * y=2   # . . # . . # # #
     * y=3   # . B . . C . # #     B = block(2,3) · C = block(5,3)
     * y=4   # # F # # G # # #     F = buttonroom(2,4) t=2 · G = buttonroom(5,4) t=3
     *
     * ⛔ THE BOUND IS COUNTED **PER GOAL**, and that is the decision rather than
     * an accident of the counter: the question it answers is *how many openers may
     * one goal chain*, and a room that needs a second chain is a room this policy
     * is not driving this slice (arc 4's territory). So the first chain is DRIVEN
     * — the trace carries its `shove` and its `hold` — and the second one's first
     * prerequisite is refused as link 3, naming the chain already spent.
     *
     * ⚠ WHICH BLOCK the second chain's derivation names is `deriveShove`'s own
     * pre-existing hypothesis talking (it hypothesises the OTHER pushables
     * discharged, ⚖ §11.8a guard (i)), and this row does not assert it — the
     * claim here is the BOUND, and the bound is what the sentence must carry.
     */
    it('a goal that needs a SECOND opener chain REFUSES at link 3, naming the bound '
        + 'and the chain already spent', () => {
        const out = solveRoom('s1-chain-bound', {
            ground: [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1],
                [1, 2], [2, 2], [1, 3], [2, 3], [3, 3], [2, 4],
                [4, 2], [5, 2], [4, 3], [5, 3], [6, 3], [5, 4]],
            goal: { tx: 8, ty: 1 },
            entities: [
                { type: 'lock', tx: 3, ty: 1, attrs: { tset: '2', tag: '1' } },
                FLAG_AT(2, 4, '2', '2'),
                { type: 'pushableblock', tx: 2, ty: 3 },
                { type: 'lock', tx: 6, ty: 1, attrs: { tset: '3', tag: '3' } },
                FLAG_AT(5, 4, '3', '4'),
                { type: 'pushableblock', tx: 5, ty: 3 },
            ],
        });
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.reasonText).toMatch(/link 3 of an opener chain bounded at /);
        expect(out.reasonText).toMatch(/NESTED_OPENER_DEPTH = 2/);
        expect(out.reasonText)
            .toMatch(/The chain so far is \[lock@48,16 <- pushableblock@32,48\]/);
        // ⛓ AND THE FIRST CHAIN REALLY RAN — a bound that refused before doing any
        // work would print the same sentence and mean something else entirely.
        const verbsSeen = (out.rows ?? []).map((r) => r.strategy?.verb);
        expect(verbsSeen).toContain('shove');
        expect(verbsSeen).toContain('hold');
    });
});
