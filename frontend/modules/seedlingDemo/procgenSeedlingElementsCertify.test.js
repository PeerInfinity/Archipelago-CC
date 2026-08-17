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
     * ⛓⛓⛓ ARM 1 — THE CHAIN. ⛔ WHEN S1 LANDS THIS ROW FLIPS: the expected
     * verdict becomes `SOLVED` and the records become
     * `['weigh', 'hold', 'collect']` — a `{strategy:'weigh'}` naming this
     * element's block and button, then a `{strategy:'hold'}` naming its
     * buttonroom, then the collect. That is the certification S1 owes.
     */
    it('ARM 1 — the whole chain REFUSES, at the FLAG\'s own stance', () => {
        const out = solveArm('slice3-chain', {});
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.reasonText).toMatch(/no REACHABLE stance inside buttonroom@/);
        expect(out.reasonText).toMatch(/A hold that cannot be stood on is not a strategy/);
        expect(out.obstacle).toEqual({ kind: 'proximity-hazard', id: 'buttonroom@48,48' });
        expect(out.records ?? []).toEqual([]);
    });

    /**
     * ⛓⛓ ARM 2 — THE ATTRIBUTION, HALF ONE. `lock`(A) removed and the BLOCK left
     * in the lane: the refusal is the SAME SENTENCE, so `lock`(A) is not the gate
     * that stops the chain.
     */
    it('ARM 2 — with lock A REMOVED it refuses IDENTICALLY ⇒ lock A is not the gate', () => {
        const out = solveArm('slice3-nolockA', { lockA: false });
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.reasonText).toMatch(/no REACHABLE stance inside buttonroom@/);
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
     * ⛓⛓⛓ ARM 4 — THE OPTIMISM, AND IT IS WORSE THAN A REFUSAL. With the block
     * gone but `lock`(A) in place, the stance IS derived (the hypothesis says
     * `lock`(A) is discharged) and the walk then GRINDS on the shut lock for the
     * whole per-target budget, because nothing raises the opener as a sub-order.
     */
    it('ARM 4 — block gone, lock A kept ⇒ BUDGET_EXHAUSTED grinding on the shut lock', () => {
        const out = solveArm('slice3-noblock', { block: null });
        expect(out.verdict).toBe(VERDICT.BUDGET_EXHAUSTED);
        expect(out.reasonText).toMatch(/hold stance \(lock@80,128\)/);
        expect(out.reasonText).toMatch(/grazing \d+ solid\(s\): lock at \(64,48\)/);
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
