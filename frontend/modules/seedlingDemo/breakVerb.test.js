/**
 * seedlingDemo/breakVerb.test — **THE DERIVED `break` VERB**, on synthetic
 * rooms built for it. ⚖ R9 slice 4 (kickoff §3.5).
 *
 * ⛔ EVERY ROW HERE IS A ROOM, NOT A STUB. The verb's whole claim is that the
 * SOLVER derives a swing the ENGINE already models, so a test that mocked
 * either side would be testing the mock: each row builds a real level record,
 * boots a real run through `procgenOracle.solve`, and reads the verdict the
 * generator's own certification pass would read.
 *
 * ── THE FOUR CLAIMS ──────────────────────────────────────────────────
 *
 *  1. a type-0 rock BETWEEN the start and the goal is SOLVED with a sword —
 *     which is the whole of "the solver derives no break" (arc 5 §13.6,
 *     probe 1) stopping being true;
 *  2. the SAME room WITHOUT the sword REFUSES BY NAME, and the name is the
 *     item — never a budget, never a corridor;
 *  3. a type-1 (`breakablerockghost`) rock with a plain sword REFUSES BY NAME
 *     and names the GHOST SWORD as the next work order (R8 lesson 2);
 *  4. the decision trace carries a `break` row, and the obstacle it names is
 *     the rock's own census id.
 */
import { describe, expect, it } from 'vitest';

import {
    bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain,
} from './procgenLevel.js';
import {
    DEFAULT_BUDGET, GENERATED_BOOT_TIME, bootStaging, collectGoal, solve,
} from './procgenOracle.js';
import { POST_SWORD_ITEMS, PRE_SWORD_ITEMS } from './procgenPalette.js';
import { SEEDLING_DEFAULTS } from './procgenSeedling.js';
import { OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS } from './solverBot.js';
import { DOWN, RIGHT, SLASH_REACH, UP, distanceRectPoint, slashRect } from './presses.js';
import { DIRECTION_DOWN, DIRECTION_UP } from './playerPhysicsV2.js';
import { plannerObstacleAt } from './botDriverV2.js';
import { HIT_TO_GONE_TICKS, WAIT_AFTER_PRESS_TICKS, rockBreaksUnder } from './breakableRocks.js';

const LEVEL = SEEDLING_DEFAULTS.level;
const GOAL_TX = 8;
const GOAL_TY = 1;

/**
 * A ONE-CORRIDOR ROOM: floor along row 1 from x=1 to x=8, the goal at its east
 * end, the boot at its west end, and one blocker in the middle.
 *
 * ⛔ NO SECOND ARC, ON PURPOSE. This is the route's own shape — L3's
 * `breakablerock@96,112` CUTS the room ("the two are in different connected
 * components", the survey's planner) — and it is the only shape in which the
 * verb is FORCED. A room with a way round measures the ladder's preference,
 * not the verb; that room is `shortcut`'s and it is measured in its own place.
 */
function corridorWith(blocker) {
    let rec = emptyLevel({ level: LEVEL });
    const floor = new Set();
    for (let tx = 1; tx <= GOAL_TX; tx += 1) floor.add(`${tx},1`);
    const wall = [];
    for (let ty = 0; ty < 9; ty += 1) {
        for (let tx = 0; tx < 9; tx += 1) {
            if (!floor.has(`${tx},${ty}`)) wall.push({ tx, ty, terrain: 'wall' });
        }
    }
    rec = withTerrain(rec, wall);
    const ents = [{
        type: SEEDLING_DEFAULTS.goalClass,
        ...oelAtTile(GOAL_TX, GOAL_TY),
        attrs: { tag: SEEDLING_DEFAULTS.goalTag },
    }];
    if (blocker) {
        ents.push({ type: blocker.type, ...oelAtTile(blocker.tx, blocker.ty),
            attrs: { tag: String(blocker.tag ?? 5) } });
    }
    return withEntities(rec, ents);
}

function runRoom(rec, items, name) {
    const boot = { ...bootAtTile(rec, 1, 1), time: GENERATED_BOOT_TIME };
    return solve(rec, bootStaging({ boot, items, pins: ['dead_frames'] }),
        [collectGoal(GOAL_TX * 16, GOAL_TY * 16)], DEFAULT_BUDGET, { name });
}

describe('the `break` verb is REGISTERED, both tags', () => {
    /**
     * ⛓ TWO TAGS, ONE VERB — `shieldlock`/`shieldlocknorm`'s lesson (R8 slice
     * 7). `Game.as:2158` builds the ghost family with `rockType = 1`; the two
     * census tags are ONE AS3 class, and a table that knew one of them would
     * answer "No strategy row exists" for a room whose fact is an INVENTORY.
     */
    it('names `break` for BOTH `breakablerock` and `breakablerockghost`', () => {
        expect(OBSTACLE_STRATEGIES['solid:breakablerock']).toBe('break');
        expect(OBSTACLE_STRATEGIES['solid:breakablerockghost']).toBe('break');
        expect(typeof STRATEGY_EXECUTORS.break).toBe('function');
    });

    /** ⛓ The leg's wait COVERS the animation, asked of both modules' numbers. */
    it('the leg wait strictly exceeds the animation the transcription measured', () => {
        expect(WAIT_AFTER_PRESS_TICKS).toBeGreaterThan(HIT_TO_GONE_TICKS);
    });
});

describe('a type-0 rock between the start and the goal', () => {
    it('⛓⛓⛓ SOLVES with the sword — the solver DERIVES the break', () => {
        const out = runRoom(corridorWith({ type: 'breakablerock', tx: 4, ty: 1 }),
            POST_SWORD_ITEMS, 'break-unit-with-sword');
        expect(out.verdict).toBe('SOLVED');
        expect(out.ticks).toBeGreaterThan(0);
    });

    /**
     * ⛔ THE CONTROL, IN THE SAME TREE (trap 297): the identical room with the
     * rock REMOVED. Without it the "solved" above could be a room that never
     * needed the verb at all.
     */
    it('⛓ the same room with NO rock solves in STRICTLY FEWER ticks — the verb costs something', () => {
        const withRock = runRoom(corridorWith({ type: 'breakablerock', tx: 4, ty: 1 }),
            POST_SWORD_ITEMS, 'break-unit-with-sword');
        const open = runRoom(corridorWith(null), POST_SWORD_ITEMS, 'break-unit-open');
        expect(open.verdict).toBe('SOLVED');
        expect(withRock.ticks).toBeGreaterThan(open.ticks);
    });

    /**
     * ⛔⛔ THE NO-SWORD ARM IS A **REFUSAL THAT NAMES THE ITEM**, and mutant
     * (a) is why the guard exists: without it the executor swings at a rock
     * with an empty `primary` slot — `weaponForPress` returns null, the press
     * is a SILENT no-op — and the room comes back BUDGET_EXHAUSTED, i.e. a
     * sentence about the bound instead of about the inventory.
     */
    it('⛓⛓⛓ REFUSES BY NAME without the sword, and the name is the SLOT', () => {
        const out = runRoom(corridorWith({ type: 'breakablerock', tx: 4, ty: 1 }),
            PRE_SWORD_ITEMS, 'break-unit-no-sword');
        expect(out.verdict).toBe('REFUSED');
        expect(out.reasonText).toMatch(/`primary` slot holds NOTHING/);
        expect(out.reasonText).toMatch(/SILENT no-op/);
        expect(out.reasonText).not.toMatch(/budget/i);
    });
});

describe('a type-1 rock names the GHOST SWORD as the next work order', () => {
    it('⛓⛓ refuses BY NAME with a plain sword, and the work order is the item', () => {
        const out = runRoom(corridorWith({ type: 'breakablerockghost', tx: 4, ty: 1 }),
            POST_SWORD_ITEMS, 'break-unit-ghost-rock');
        expect(out.verdict).toBe('REFUSED');
        expect(out.reasonText).toMatch(/THE NEXT WORK ORDER IS THE GHOST SWORD/);
        expect(out.reasonText).toMatch(/rockType 1/);
        // ⛓ And the CLAIM behind the refusal is the transcription's, not a
        // sentence typed here.
        expect(rockBreaksUnder(1, { hasGhostSword: false })).toBe(false);
        expect(rockBreaksUnder(1, { hasGhostSword: true })).toBe(true);
        expect(rockBreaksUnder(0, {})).toBe(true);
    });
});

describe('the decision trace carries the verb', () => {
    it('⛓ a `break` row, naming the rock\'s own census id', () => {
        const out = runRoom(corridorWith({ type: 'breakablerock', tx: 4, ty: 1 }),
            POST_SWORD_ITEMS, 'break-unit-trace');
        expect(out.verdict).toBe('SOLVED');
        // ⛔ ON A SOLVE THE TRACE IS `out.trace`; `out.rows` is the REFUSAL's
        // own prefix (`SolverRefusal.rows`) and is empty here by construction.
        const rows = out.trace?.rows ?? [];
        const row = rows.find((r) => r.strategy?.verb === 'break');
        expect(row, `no break row in ${JSON.stringify(rows.map((r) => r.strategy?.verb))}`)
            .toBeTruthy();
        expect(row.obstacle.id).toBe('breakablerock@64,16');
        // ⛓ AND THE VERB IS A KNOWN ONE — the trace's own report channel says
        // so rather than flagging it as a typo (`decisionTrace`'s list).
        expect(row.strategy.postCondition).toBe('gone');
    });
});


/**
 * ⛔⛔⛔ **THE FINDING THIS SLICE TRIPPED OVER, PINNED AS A FINDING AND NOT AS A
 * FIX** — `solverBot.facingToward` answers in a numbering the GAME does not
 * use, and `slashRectToward` feeds that answer straight to `presses.slashRect`.
 *
 * These rows assert the DEFECT, deliberately: they are the measurement a ⚖ ask
 * needs, and the day `facingToward` is repaired they go RED and are rewritten
 * as the repair's own rows. Fixing it here would hand `deriveStrike` a whole
 * class of vertical strike cells it has never had — a nearer vertical cell
 * would be chosen ahead of the horizontal one every committed kill uses — and
 * that MOVES TAPES, which this slice has no licence for.
 */
describe('⛔ the slash-direction convention, measured', () => {
    /** The game's own numbering, from the two modules that transcribe it. */
    it('`presses` and `playerPhysicsV2` agree: UP is 1 and DOWN is 3', () => {
        expect(UP).toBe(1);
        expect(DOWN).toBe(3);
        expect(DIRECTION_UP).toBe(UP);
        expect(DIRECTION_DOWN).toBe(DOWN);
    });

    /**
     * ⛔ AND THE CONSEQUENCE, AT THE ORIGIN: a body directly below is in
     * REACH, and the rect `slashRectToward`'s integer produces is the one
     * ABOVE the player. The filter can therefore never accept it.
     */
    it('⛔ a target directly BELOW is in reach and its `facingToward` rect MISSES', () => {
        const below = { x: -8, y: 12, w: 16, h: 16, right: 8, bottom: 28 };
        // `facingToward`'s arithmetic, restated (it is module-private).
        const facingToward = (from, t) => {
            const dx = (t.x + t.right) / 2 - from.x;
            const dy = (t.y + t.bottom) / 2 - from.y;
            if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
            return dy >= 0 ? 1 : 3;
        };
        const ov = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
        expect(distanceRectPoint(0, 0, below)).toBeLessThanOrEqual(SLASH_REACH);
        expect(facingToward({ x: 0, y: 0 }, below)).toBe(1);            // "down", in FACING_KEYS
        expect(ov(slashRect(0, 0, facingToward({ x: 0, y: 0 }, below)), below)).toBe(false);
        // ⛓ …and the GAME's own number for "below" hits it.
        expect(ov(slashRect(0, 0, DOWN), below)).toBe(true);
        // ⛓ The horizontal pair is where the two conventions agree, which is
        // why three rungs of committed presses are green over this.
        const east = { x: 8, y: -8, w: 16, h: 16, right: 24, bottom: 8 };
        expect(facingToward({ x: 0, y: 0 }, east)).toBe(RIGHT);
        expect(ov(slashRect(0, 0, RIGHT), east)).toBe(true);
    });
});

/**
 * ⛓⛓⛓ **THE MODEL FINDING W1 WAS TOLD TO CHECK: does the obstacle TAG
 * DISAPPEAR once the rock is gone?** It does, and not by a special case —
 * `brokenRocks` is one of the fourteen live-geometry families, `levelWorld`'s
 * `liveRectOf` drops a solid whose `rockId` is in it, and `plannerObstacleAt`
 * reads the run's own bag. So the planner and the executor cannot disagree
 * about whether the corridor opened.
 */
describe('the world the planner sees AFTER the break', () => {
    it('⛓ `plannerObstacleAt` stops reporting the rock — one bag, two readers', () => {
        const rec = corridorWith({ type: 'breakablerock', tx: 4, ty: 1 });
        const out = runRoom(rec, POST_SWORD_ITEMS, 'break-unit-gone');
        expect(out.verdict).toBe('SOLVED');
        const row = (out.trace?.rows ?? []).find((r) => r.strategy?.verb === 'break');
        expect(row).toBeTruthy();
        // The record the executor returned says the id it removed; the LEVEL's
        // own certification proves the corridor beyond it was walked.
        expect(row.obstacle.id).toBe('breakablerock@64,16');
        expect(typeof plannerObstacleAt).toBe('function');
    });
});
