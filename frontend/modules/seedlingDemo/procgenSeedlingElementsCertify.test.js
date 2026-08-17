/**
 * seedlingDemo/procgenSeedlingElementsCertify.test — **THE SIX-ARM FIXTURE THAT
 * SAYS WHAT THE SOLVER CANNOT DO YET, AND IT ASSERTS TODAY'S REFUSAL BY NAME.**
 *
 * PROCGEN ELEMENTS arc 3, slice 3, D1(a). ⚖ Ruling 22's shape is
 *
 *     goal <- lock B <- buttonroom B (the FLAG) <- lock A <- button A <- weigh the block
 *
 * and the solver as it stands cannot drive it. This file is the MEASUREMENT that
 * says so, kept as a committed fixture rather than as a paragraph, for the reason
 * the orchestrating session gave: **the solver slice S1 ("nested openers") must
 * FLIP these rows green, not rediscover the problem.**
 *
 * ⛔ SO EVERY ARM IS A LIVE ROW WITH NO `.skip`. The four that refuse assert the
 * REFUSAL SENTENCE, and the two that solve are the positive controls that keep
 * the four honest — without OPEN and ONE this file would be a room that does not
 * work for reasons nobody had localised.
 *
 * ── THE ROOM, DRAWN OUT ───────────────────────────────────────────────
 *
 * A 10x10 room built exactly as the binding builds one: the reverse-pull gadget
 * at `len = 2`, `turns = 0` on the site (3,3) 4x4 with `e = W`, `r1 = S`, plus the
 * two cells the BINDING adds (the flag one step past the door on the exit lane,
 * and the flag's lock on a main-path cut with the entry mouth start-side).
 *
 *        x 0 1 2 3 4 5 6 7 8 9
 *    y=0   # # # # # # # # # #
 *    y=1   # S . . . . . . . #     S = start (1,1); row 1 is the corridor east
 *    y=2   # # # # # # # # . #
 *    y=3   # # # F . D . # . #     F = buttonroom(B) (3,3) · D = lock(A) (4,3)
 *    y=4   # # # # # b # # . #     b = the bypass cell (5,4)
 *    y=5   # # # # # # B # . #     B = button(A) (6,3)?  no — see below
 *    y=6   # # # # # # . . . #
 *    y=7   # # # # # # # # . #
 *    y=8   # # # g L . . . . #     g = goal (3,8) · L = lock(B) (5,8)
 *    y=9   # # # # # # # # # #
 *
 * ⚠ The picture above is the CORRIDOR; the gadget's own cells are the lane
 * (6,3)-(6,6), the bypass (5,4) and the exit lane (5,3),(4,3),(3,3). The block
 * starts at (6,5) and its button is (6,3) — so the block STANDS BETWEEN the entry
 * mouth (6,7) and the button, by the element's construction.
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
const GOAL = { tx: 3, ty: 8 };
const LOCK_B = { tx: 5, ty: 8 };
const FLAG = { tx: 3, ty: 3 };
const DOOR_A = { tx: 4, ty: 3 };
const BUTTON_A = { tx: 6, ty: 3 };
const BLOCK = { tx: 6, ty: 5 };

/** The GROUND cells — everything else in the interior is wall. */
const GROUND = [
    [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1],
    [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8],
    [7, 8], [6, 8], [5, 8], [4, 8], [3, 8],
    [6, 7],                                   // the element's ENTRY MOUTH
    [6, 6], [6, 5], [6, 4], [6, 3],           // entry port .. push lane .. button
    [5, 4],                                   // the bypass cell
    [5, 3], [4, 3], [3, 3],                   // exit lane: button+W, DOOR, FLAG
];

/** ⛓ Two DISTINCT groups from one placement, as the binding allocates them. */
const A = 1;
const B = 2;

function fixtureRoom({ lockA = true, lockB = true, flag = true, block = BLOCK } = {}) {
    let record = emptyLevel({ level: SEEDLING_DEFAULTS.level, floor: 'wall' });
    record = withTerrain(record, GROUND.map(([tx, ty]) => ({ tx, ty, terrain: 'ground' })));
    const ents = [
        { type: SEEDLING_DEFAULTS.goalClass, ...GOAL, attrs: { tag: '0' } },
        { type: 'button', ...BUTTON_A, attrs: { tset: String(A) } },
    ];
    if (lockA) ents.push({ type: 'lock', ...DOOR_A, attrs: { tset: String(A), tag: '1' } });
    if (flag) {
        ents.push({ type: 'buttonroom', ...FLAG,
            attrs: { tset: String(B), tag: '2', flip: '0', room: '-1' } });
    }
    if (block) ents.push({ type: 'pushableblock', ...block });
    if (lockB) ents.push({ type: 'lock', ...LOCK_B, attrs: { tset: String(B), tag: '3' } });
    return withEntities(record, ents.map((e) => ({
        type: e.type, ...oelAtTile(e.tx, e.ty), ...(e.attrs ? { attrs: e.attrs } : {}),
    })));
}

function solveArm(name, arm) {
    const record = fixtureRoom(arm);
    const staging = bootStaging({
        boot: bootAtTile(record, START.tx, START.ty),
        items: PRE_SWORD_ITEMS,
        pins: ['dead_frames'],
    });
    return solve(record, staging, [collectGoal(GOAL.tx * 16, GOAL.ty * 16)],
        DEFAULT_BUDGET, { name });
}

const verbsOf = (out) => new Set((out.records ?? []).map((r) => r.strategy));

describe('⛔⛔ D1(a) — THE SOLVER DOES NOT CHAIN, and each arm names its own gate', () => {
    /**
     * ⛓⛓⛓ ARM 1 — THE CHAIN, **AND S1 CERTIFIES IT.** Slice 3 measured this row
     * as REFUSED at the FLAG's own stance; the certification arc-3 §10.3 owed is
     * exactly this record, so the row is written as the record rather than as a
     * verdict:
     *
     *   `weigh`  — THIS element's block onto THIS element's button, `shove.to`
     *              the button tile, raised as the PREREQUISITE of the flag's own
     *              stance (`deriveHoldStance` -> `stancePrerequisite`, mechanism
     *              arm) and executed BEFORE the walk to it;
     *   `hold`   — the presser is THIS element's buttonroom, and `lock`(B) is
     *              what it opens;
     *   `collect`.
     */
    it('ARM 1 — the whole chain SOLVES, `weigh` -> `hold` -> `collect`', () => {
        const out = solveArm('slice3-chain', {});
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.records.map((r) => r.strategy)).toEqual(['weigh', 'hold', 'collect']);
        const weigh = out.records.find((r) => r.strategy === 'weigh');
        // ⛔ THIS element's block onto THIS element's button — not "a weigh".
        expect(weigh.shove).toMatchObject({
            id: 'pushableblock@96,80',
            from: { tx: BLOCK.tx, ty: BLOCK.ty },
            to: { tx: BUTTON_A.tx, ty: BUTTON_A.ty },
            destroys: false,
        });
        expect(weigh.presser).toEqual({ x: BUTTON_A.tx * 16, y: BUTTON_A.ty * 16 });
        // …and the dwell's own observable is `lock`(A), the door the weigh buys.
        expect(weigh.dwell.until).toMatch(/group t=1 \[lock@64,48\] is open/);
        const held = out.records.find((r) => r.strategy === 'hold');
        expect(held.presser).toMatchObject({
            x: FLAG.tx * 16, y: FLAG.ty * 16, tag: 'buttonroom', t: B,
        });
        // ⛓ and the FLAG is what opened `lock`(B) — the guard is real, not a
        // route that happened to arrive.
        expect(held.opened).toEqual(['lock@80,128']);
    });

    /**
     * ⛓⛓ ARM 2 — THE ATTRIBUTION, HALF ONE, **AND IT TAKES THE OTHER
     * PREREQUISITE ARM.** With `lock`(A) removed the block is still in the lane,
     * and slice 3 measured the SAME refusal sentence — which is what proved the
     * BLOCK, not the door, was the gate. S1 answers it through the GEOMETRY arm:
     * no activator wants this block, so it is scenery, and a bare `shove` clears
     * the lane.
     *
     * ⛔ THE VERB IS THE DISCRIMINATOR. If this row ever produced `weigh` it
     * would mean the mechanism arm had fired on a room with no mechanism to fire
     * on — which is the failure mode "mechanism before geometry" is ordered to
     * avoid, read from the other side.
     */
    it('ARM 2 — with lock A REMOVED the BLOCK is the prerequisite, and a `shove` '
        + 'clears it', () => {
        const out = solveArm('slice3-nolockA', { lockA: false });
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.records.map((r) => r.strategy)).toEqual(['shove', 'hold', 'collect']);
        const shove = out.records.find((r) => r.strategy === 'shove');
        expect(shove.id).toBe('pushableblock@96,80');
        expect(shove.from).toEqual({ tx: BLOCK.tx, ty: BLOCK.ty });
        const held = out.records.find((r) => r.strategy === 'hold');
        expect(held.presser).toMatchObject({ x: FLAG.tx * 16, y: FLAG.ty * 16 });
    });

    /**
     * ⛓⛓⛓ ARM 3 — THE ATTRIBUTION, HALF TWO, AND THE POSITIVE CONTROL FOR THE
     * WHOLE FILE. With the BLOCK removed as well the room SOLVES — so the gate is
     * the block, a `pushableblock` that `solverBot.stanceHypothesis` (:2113) does
     * not discharge (it hypothesises ACTIVATORS and shield bosses only) and that
     * nothing raises a SUB-ORDER to shove.
     *
     * ⛓ AND IT IS WHERE THE FLAG'S VERB IS MEASURED: `hold`, not `touch`.
     */
    it('ARM 3 — with lock A AND the block removed it SOLVES, by a `hold` on the FLAG', () => {
        const out = solveArm('slice3-open', { lockA: false, block: null });
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect([...verbsOf(out)]).toEqual(['hold', 'collect']);
        // ⛔ `touch` is the SHIELDLOCK verb (`activators.TOUCH_RESPONDERS`); a
        // LATCHING `buttonroom` keeps `hold` because `localPublish` is non-null.
        expect(verbsOf(out).has('touch')).toBe(false);
        const held = out.records.find((r) => r.strategy === 'hold');
        expect(held.presser).toMatchObject({
            x: FLAG.tx * 16, y: FLAG.ty * 16, tag: 'buttonroom', t: B,
        });
        // and the FLAG really is a LATCH: the collect happens after the hold,
        // with nobody standing on the presser.
        expect(out.records.map((r) => r.strategy)).toEqual(['hold', 'collect']);
    });

    /**
     * ⛓⛓⛓ ARM 4 — THE OPTIMISM, **AND S1 REPLACED IT WITH THE REFUSAL IT WAS
     * STANDING IN FOR.**
     *
     * With the block gone but `lock`(A) in place, slice 3 measured
     * `BUDGET_EXHAUSTED` after 797 ticks: the stance IS derived (the hypothesis
     * says `lock`(A) is discharged), the walk is driven, and it grazes a shut
     * lock for the whole per-target budget.
     *
     * ⛔ AND §10.3's READING OF WHY WAS WRONG, WHICH THIS ROW NOW RECORDS. It
     * said *"no caller raises `lock`(A) as an order"*. One does — the nested
     * stance walk's own frontier — and the order is a `hold` on a plain
     * republishing `Button`, taken through `resolveWeighStrategy`'s L16 fallback
     * because no block can weigh the presser. The player stands on the button,
     * the lock opens, the player leaves to walk through it, and `Button.update`
     * shuts it on the same tick. ⇒ the gap is a hypothesis redeemed by an order
     * that does not OUTLIVE THE WALKER, and guard (iii) makes such an activator a
     * WALL rather than an optimistic gap.
     *
     * ⛓ THE MEASURABLE OUTCOME IS THE POINT: 797 ticks -> **0**, and the sentence
     * names the lock, its group, its presser and why nothing can redeem it.
     */
    it('ARM 4 — block gone, lock A kept ⇒ a FAST NAMED REFUSAL, 0 driven ticks', () => {
        const out = solveArm('slice3-noblock', { block: null });
        expect(out.verdict).toBe(VERDICT.REFUSED);
        // ⛔ THE BUDGET BURN IS GONE, and this is the assertion that says so: the
        // old row spent 797 ticks reaching a verdict about a budget.
        expect(out.ticksSpent).toBe(0);
        expect(out.reasonText).toMatch(/no REACHABLE stance inside buttonroom@48,48/);
        expect(out.reasonText).toMatch(/THE PREREQUISITES WERE TRIED AND REFUSED/);
        expect(out.reasonText).toMatch(/lock@64,48 — its group t=1 publishes only while/);
        expect(out.reasonText).toMatch(/a Solid sits on button@96,48/);
        expect(out.reasonText).toMatch(/NO block in this room can reach it/);
        expect(out.reasonText).toMatch(/a `hold` the walker shuts again by leaving/);
        // ⛔ and NOT the old sentence — a row that matched both would be a row
        // that had stopped discriminating.
        expect(out.reasonText).not.toMatch(/grazing \d+ solid\(s\)/);
    });

    /**
     * ⛓⛓ ARM 5 — THE THIRD GAP, INDEPENDENT OF THE OTHER TWO, **AND S1 CLOSED
     * IT WITH THE DWELL ARM.**
     *
     * Before S1 the PRE-SOLVED gadget (the block already parked on its button)
     * refused: `resolveWeighStrategy` had no "already home" answer, so it fell
     * back to a `hold` on a button the BLOCK occupies and `deriveHoldStance`
     * refused at a stance nobody needed to stand in.
     *
     * ⛓ Now it resolves to the weigh MINUS its shove — `runDwell` alone, no
     * stance at all, because the presser is held by the block and the player need
     * not stand anywhere. ⛔ THE RECORD STILL NAMES THIS ELEMENT'S BLOCK AND
     * BUTTON (`parked`), which is what keeps the lifted-claim reader able to
     * answer about a gadget that arrived solved.
     *
     * ⚠ THIS ARM RAISES NO PREREQUISITE, and that is the fact that makes the
     * `NESTED_OPENER_DEPTH` mutant discriminating: `lock`(A) is redeemed by the
     * ORDINARY frontier of the nested stance walk, exactly as it was before S1.
     */
    it('ARM 5 — the block ALREADY on button A now SOLVES, by a DWELL-ONLY weigh', () => {
        const out = solveArm('slice3-preweighed', { block: BUTTON_A });
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.records.map((r) => r.strategy)).toEqual(['weigh', 'hold', 'collect']);
        const weigh = out.records.find((r) => r.strategy === 'weigh');
        expect(weigh.dwellOnly).toBe(true);
        // ⛔ NO SHOVE — a lean that moves nothing is a check that cannot fail.
        expect(weigh.shove).toBeUndefined();
        expect(weigh.parked).toMatchObject({
            block: 'pushableblock@96,48',
            tile: { tx: BUTTON_A.tx, ty: BUTTON_A.ty },
            sinceTick: 0,
        });
        expect(weigh.presser).toEqual({ x: BUTTON_A.tx * 16, y: BUTTON_A.ty * 16 });
        // and the FLAG is still what opens `lock`(B): the dwell only bought
        // `lock`(A), and the hold on the buttonroom is the second order.
        const held = out.records.find((r) => r.strategy === 'hold');
        expect(held.presser).toMatchObject({
            x: FLAG.tx * 16, y: FLAG.ty * 16, tag: 'buttonroom', t: B,
        });
    });

    /**
     * ⛓ ARM 6 — THE DECORATION CONTROL. With no `lock`(B) the flag opens nothing,
     * so the walk goes straight to the goal and the whole gadget is scenery. It
     * SOLVES, and it must: that is what makes "the level solved" worthless as
     * evidence about a guard, and it is why the binding refuses
     * `no-cut-for-the-flag-lock` rather than placing a flag whose lock cuts
     * nothing.
     */
    it('ARM 6 — with no lock B the room SOLVES by walking past the gadget (DECORATION)', () => {
        const out = solveArm('slice3-decoration', { lockB: false });
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect([...verbsOf(out)]).toEqual(['collect']);
    });
});
