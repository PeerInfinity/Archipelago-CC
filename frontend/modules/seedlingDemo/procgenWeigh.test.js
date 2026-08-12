/**
 * seedlingDemo/procgenWeigh.test — ⚖ BLOCK-ON-BUTTON, DRIVEN.
 *
 * PROCGEN PoC arc, slice 3b (⚖ kickoff §1.9): *"a strategy that shoves a
 * pushable onto a button and LEAVES it (the game's own permanent hold; L15 is
 * the canonical room)"*, with the ruling's own teeth — *"IN THIS ARC, if
 * possible"*.
 *
 * ── THE RECON THAT MADE IT POSSIBLE, IN TWO CITATIONS ─────────────────
 *
 *   THE GAME.  `Button.as:16` — `hitables = ["Player", "Enemy", "Solid"]`,
 *   collided at `:30` inside an `update()` that RE-RUNS EVERY TICK and assigns
 *   `activate` from whoever is standing there (`:39`). A republish, not a
 *   latch. `PushableBlock.as:27` — `type = "Solid"`. So a block parked on a
 *   button presses it for ever, and L15 (`Dungeon2/2.oel:107-111`) is the room
 *   built around exactly that: `pushableblock@(64,64)`, `button@(112,32)
 *   tset=0`, `lock@(128,48) tset=0`, stairs behind the lock.
 *
 *   THE MODEL.  `activators.pressedGroups:436` takes `movingSolids` and adds
 *   the group on any solid-rect overlap (`:443-445`); `levelRun.movingSolidsNow`
 *   (`:801`) fills it from the live pushable rects. MEASURED before a line was
 *   written: with a block pre-placed on a button and the player parked in the
 *   far corner for 300 ticks, `pressedGroups` answers `[0]` and
 *   `openActivatorIds` answers `['lock@64,80']` (first open at tick 100),
 *   while the same 300 ticks with `movingSolids: []` leave it shut.
 *
 * ⇒ game YES + model YES, so the ruling's "if possible" resolves YES and NO
 * MODEL BRIDGING WAS NEEDED — `activators.js` is not touched by this slice.
 *
 * ── WHAT EACH STRATUM HERE IS FOR ─────────────────────────────────────
 *
 *   1. THE SELECTION. `refineStrategy` turns `hold` into `weigh` exactly when
 *      the hold cannot outlive the walker, and leaves it alone otherwise. The
 *      NEGATIVE cases are the load-bearing half: a LATCHING presser keeps
 *      `hold` (L20's `buttonroom` shape) and a kill-lock still refines to
 *      `kill`. Those two are why the battery is byte-identical.
 *   2. THE FLIP. Slice 3 §10.3's corridor-lock exclusion, plus the pushable
 *      the template provides, must reach SOLVED with `{weigh, collect}`.
 *   3. THE DERIVATION'S REFUSALS. A block that cannot reach the presser is a
 *      NAMED refusal, never a silent fallthrough.
 *
 * ⛔ DRIVEN THROUGH `procgenOracle.solve`, NOT A HAND-BUILT RUN —
 * `procgenCollectPath.test`'s own law, one slice back: that is the seam the
 * finding was measured on and the one the generator uses.
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
import { STRATEGY_EXECUTORS, STRATEGY_REFINEMENTS } from './solverBot.js';

const START = SEEDLING_DEFAULTS.start;

/** A full wall across the interior at row `ty`, with `gapTx` left open. */
const wallAcross = (ty, gapTx) => {
    const out = [];
    for (let tx = 1; tx <= 8; tx += 1) if (tx !== gapTx) out.push({ tx, ty, terrain: 'wall' });
    return out;
};

function room({ goal, walls = [], entities = [] }) {
    let record = emptyLevel({ level: SEEDLING_DEFAULTS.level });
    if (walls.length) record = withTerrain(record, walls);
    return withEntities(record, [
        {
            type: SEEDLING_DEFAULTS.goalClass,
            ...oelAtTile(goal.tx, goal.ty),
            attrs: { tag: SEEDLING_DEFAULTS.goalTag },
        },
        ...entities.map((e) => ({
            type: e.type, ...oelAtTile(e.tx, e.ty), ...(e.attrs ? { attrs: e.attrs } : {}),
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
    for (const row of out.trace?.rows ?? out.rows ?? []) {
        if (row.strategy?.verb) verbs.add(row.strategy.verb);
    }
    for (const rec of out.records ?? []) if (rec.strategy) verbs.add(rec.strategy);
    return verbs;
};

const rowFor = (out, verb) => (out.trace?.rows ?? out.rows ?? [])
    .find((r) => r.strategy?.verb === verb);

/**
 * THE CANONICAL SHAPE, one screen wide: a lock in the only gap of a wall the
 * goal is behind, its button on the START side, and one block sharing the
 * button's row so a single east lean parks it there. L15's mechanism with
 * L15's roles, in a room this arc can generate.
 */
const CANONICAL = {
    goal: { tx: 7, ty: 8 },
    walls: wallAcross(5, 4),
    entities: [
        { type: 'lock', tx: 4, ty: 5, attrs: { tset: '0', tag: '0' } },
        { type: 'button', tx: 6, ty: 3, attrs: { tset: '0' } },
        { type: 'pushableblock', tx: 3, ty: 3 },
    ],
};

const without = (type) => ({
    ...CANONICAL, entities: CANONICAL.entities.filter((e) => e.type !== type),
});

describe('⚖ §1.9 — the block-on-button strategy is registered at all', () => {
    it('`weigh` has an executor', () => {
        expect(typeof STRATEGY_EXECUTORS.weigh).toBe('function');
    });
});

describe('⛓ THE FLIP — slice 3 §10.3\'s corridor-lock exclusion, with a block', () => {
    it('shoves the block onto the button, leaves it, and collects', () => {
        const out = solveRoom('C2-corridor-lock-weigh', CANONICAL);
        expect(out.verdict).toBe(VERDICT.SOLVED);
        /**
         * ⚠ THE STRATEGY LIST IS THE RECORDS', NOT THE TRACE'S. A trace row
         * also carries `walk` — the re-plan the opened lock makes possible,
         * which is evidence the verb worked rather than a third strategy. The
         * STRATEGIES this room needs are exactly two.
         */
        expect(out.records.map((r) => r.strategy)).toEqual(['weigh', 'collect']);
        expect(verbsOf(out)).toContain('weigh');
        expect(out.certification.certified).toBe(true);
        expect(out.certification.collected[0].strategy).toBe('collect');
    });

    it('the trace row names the obstacle, the destination and the `press` '
        + 'post-condition', () => {
        const out = solveRoom('C2-corridor-lock-weigh-row', CANONICAL);
        const row = rowFor(out, 'weigh');
        expect(row.obstacle).toEqual({ kind: 'solid', id: 'lock@64,80' });
        expect(row.strategy.postCondition).toBe('press');
        // The button is at tile (6,3) and the block starts at (3,3): one east
        // lean of three tiles. Asserted as the DESTINATION rather than as a
        // tick count, because the destination is the thing the mechanism cares
        // about and the ticks are `runShove`'s business.
        expect(row.strategy).toMatchObject({ verb: 'weigh', dir: 'E', k: 3 });
        expect(row.strategy.to).toEqual({ tx: 6, ty: 3 });
    });

    it('⛔ THE WHOLE POINT — the lock opens while the player is NOT on the button', () => {
        const out = solveRoom('C2-corridor-lock-weigh-dwell', CANONICAL);
        const rec = out.records.find((r) => r.strategy === 'weigh');
        // `runDwell`'s invariants are "no transition, NO KEYS, no new hits", so
        // a dwell that ended on the group's own observable is a lock that
        // opened with nobody standing on the presser. That sentence is the
        // slice: a `hold` cannot produce this record at all.
        expect(rec.dwell.kind).toBe('dwell');
        expect(rec.dwell.until).toMatch(/every shut responder in group t=0 \[lock@64,80\]/);
        expect(rec.dwell.ticks).toBeGreaterThan(0);
        expect(rec.dwell.ticks).toBeLessThanOrEqual(rec.dwell.bound);
        // And the block really is on the button, by the shove's own record.
        expect(rec.shove.to).toEqual({ tx: 6, ty: 3 });
        expect(rec.presser).toEqual({ x: 96, y: 48 });
    });

    it('the `hold` it replaced is recorded as considered, with its mechanism', () => {
        const out = solveRoom('C2-corridor-lock-weigh-rejected', CANONICAL);
        const row = rowFor(out, 'weigh');
        const held = row.rejected.find((r) => r.option === 'hold');
        expect(held.why).toMatch(/EVERY tick/);
        expect(held.why).toMatch(/already shut the lock/);
    });
});

describe('⛓ THE SELECTION — and the NEGATIVE cases are what keep the battery still', () => {
    /**
     * ⛔⛔ THE LATCHING PRESSER KEEPS `hold`, and this is the test the battery
     * prediction rests on. `localPublish` (`activators.js:329`) is non-null
     * only for a `buttonroom` whose `room` is negative — the `room == -1` arm
     * behind the author's own *"Can't be reset to false!!"* — so L20's
     * `buttonroom@192,16` really does keep its group published after the
     * player leaves. A gate that ignored the latch would have re-routed every
     * committed `hold` in the game through a verb they do not need.
     */
    it('a LATCHING presser (buttonroom, room=-1) still refines to `hold`', () => {
        const out = solveRoom('C2-latched-button-holds', {
            ...CANONICAL,
            entities: [
                { type: 'lock', tx: 4, ty: 5, attrs: { tset: '0', tag: '0' } },
                {
                    type: 'buttonroom',
                    tx: 6,
                    ty: 3,
                    attrs: { tset: '0', tag: '4', flip: '0', room: '-1' },
                },
                { type: 'pushableblock', tx: 3, ty: 3 },
            ],
        });
        // Whatever the room's verdict, the VERB must be `hold` and never
        // `weigh`: the block is right there and axis-aligned, so a gate that
        // was really "is there a block" rather than "can the hold persist"
        // would take it.
        const verbs = verbsOf(out);
        expect(verbs.has('weigh')).toBe(false);
        expect(verbs.has('hold')).toBe(true);
    });

    /**
     * The kill-lock arm runs FIRST and is unchanged: `tset == -1` is
     * `KILL_LOCK_TSET`, no presser exists for it anywhere in the game, and
     * `weigh` must not reach it. (Committed evidence: `r8-solve-5` and
     * `r8-solve-18` both carry `hold` only as a REJECTED option against a
     * kill-lock, and both are byte-unchanged by this slice.)
     */
    it('a KILL-LOCK (tset -1) still refines to `kill`, not to `weigh`', () => {
        const out = solveRoom('C2-killlock-not-weigh', {
            ...CANONICAL,
            entities: [
                { type: 'lock', tx: 4, ty: 5, attrs: { tset: '-1', tag: '0' } },
                { type: 'pushableblock', tx: 3, ty: 3 },
            ],
        });
        const verbs = verbsOf(out);
        expect(verbs.has('weigh')).toBe(false);
        // The room has no enemies, so `resolveKillStrategy` binds nothing and
        // the solve refuses — which is the PARENT behaviour, unchanged. What
        // this asserts is that the refusal is still about `kill`.
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.reasonText).toMatch(/kill/);
    });
});

/**
 * ⛓⛓⛓ THE TABLE IS DESCRIPTIVE, SO EVERY ROW IS DRIVEN.
 *
 * `STRATEGY_REFINEMENTS` does not execute — `refineStrategy` owns the
 * predicates, because the two are different shapes (a `tset` comparison and a
 * scan over the group's pressers) and storing them as functions in the table
 * would move code rather than make data. That makes the table a SECOND
 * SPELLING, and a second spelling drifts unless something makes it
 * impossible. [[feedback_unifying_copies_can_change_behaviour]]
 *
 * ⛔ SO THE CASES ARE BUILT **FROM** THE TABLE, not listed beside it: a row
 * added without a driven flip is a FAILING test rather than an uncounted one
 * (trap 199's structure — build assertions from the roster, never from a
 * count).
 */
describe('⛓ EVERY REFINEMENT ROW IS DRIVEN — the table cannot drift silently', () => {
    /**
     * One room per refinement, each shaped so the flip is the only thing that
     * can produce its verdict. Keyed by the row's own `from -> to`, so a new
     * row lands here as a missing key.
     */
    const DRIVEN = {
        'hold -> kill': () => solveRoom('refinement-hold-to-kill', {
            ...CANONICAL,
            entities: [
                { type: 'lock', tx: 4, ty: 5, attrs: { tset: '-1', tag: '0' } },
                { type: 'pushableblock', tx: 3, ty: 3 },
            ],
        }),
        'hold -> weigh': () => solveRoom('refinement-hold-to-weigh', CANONICAL),
    };
    const EXPECTED = {
        'hold -> kill': (out) => {
            expect(verbsOf(out).has('weigh')).toBe(false);
            expect(out.reasonText).toMatch(/kill/);
        },
        'hold -> weigh': (out) => {
            expect(out.verdict).toBe(VERDICT.SOLVED);
            expect(verbsOf(out)).toContain('weigh');
        },
    };

    it('the table has at least the two refinements this arc knows about', () => {
        expect(STRATEGY_REFINEMENTS.length).toBeGreaterThanOrEqual(2);
    });

    for (const r of STRATEGY_REFINEMENTS) {
        const key = `${r.from} -> ${r.to}`;
        it(`${key} — the flip really happens, and the row says why`, () => {
            // The row must carry a REASON, not just a pair of verb names: the
            // table's whole job is to make the second selection path readable.
            expect(typeof r.when).toBe('string');
            expect(r.when.length).toBeGreaterThan(20);
            expect(DRIVEN[key], `no driven case for refinement ${key}`).toBeDefined();
            EXPECTED[key](DRIVEN[key]());
        });
    }
});

/**
 * ⛔⛔⛔ THE FALLBACK — `weigh` PREEMPTS `hold`, IT DOES NOT REPLACE IT.
 *
 * L16 is the room that ruled this. It carries `lock@320,112 tset=1`,
 * `button@272,48` and `pushableblock@256,80` — the block is at tile (16,5) and
 * the button at (17,3), sharing NEITHER coordinate, so no single lean reaches
 * it (the room wants a CHAIN; kickoff §10.7's named unbuilt shape). The first
 * cut of this slice gated `hold` off whenever the group republishes, and L16's
 * refusal went from *"the combat ladder is EXHAUSTED"* — a walk that reached
 * the top of the ladder — to *"Strategy 'weigh' failed to apply"*, a committed
 * room made strictly less informative by a slice that had predicted it would
 * not move at all. Caught by `solverBot.test.js`, which the battery does not
 * cover.
 *
 * ⇒ every case below asserts the PARENT's answer, unchanged, plus the weigh's
 * own reason recorded in the trace. A verdict that flipped to `REFUSED` here
 * would mean the addition had stopped being additive.
 */
describe('⛓ THE FALLBACK — where no block can arrive, the PARENT\'s `hold` stands', () => {
    /** The `hold` row the fallback produced, with the reasons it carries. */
    const holdRow = (out) => (out.trace?.rows ?? out.rows ?? [])
        .find((r) => r.strategy?.verb === 'hold');

    it('no block at all: `hold` is taken, and the empty roster is NAMED', () => {
        const out = solveRoom('C2-no-block', without('pushableblock'));
        // Slice 3 §10.3's own measured exclusion, byte-for-byte the parent's.
        expect(out.verdict).toBe(VERDICT.BUDGET_EXHAUSTED);
        expect(out.budgetKind).toBe('per-target-ticks');
        expect(verbsOf(out).has('weigh')).toBe(false);
        /**
         * ⛔ AND THE ROSTER IS NAMED RATHER THAN LEFT EMPTY. Every other
         * branch of the derivation pushes a reason, so an empty rejection list
         * would make "no block could reach" and "the verb was never
         * considered" print the same thing.
         * [[feedback_bounded_sweep_must_name_what_it_bounded]]
         */
        const why = holdRow(out).rejected.find((r) => r.option === 'weigh').why;
        expect(why).toMatch(/no pushable block at all/);
    });

    /**
     * ⛔ A LEAN MOVES A BLOCK ALONG ONE AXIS. A block sharing NEITHER
     * coordinate with the presser cannot reach it in one shove — L16's own
     * geometry, in a room this arc can generate — and the derivation says
     * which two cells it compared rather than reporting "no block".
     */
    it('a block sharing neither coordinate: `hold` stands, geometry named', () => {
        const out = solveRoom('C2-block-off-axis', {
            ...CANONICAL,
            entities: [
                { type: 'lock', tx: 4, ty: 5, attrs: { tset: '0', tag: '0' } },
                { type: 'button', tx: 6, ty: 3, attrs: { tset: '0' } },
                { type: 'pushableblock', tx: 2, ty: 2 },
            ],
        });
        expect(out.verdict).toBe(VERDICT.BUDGET_EXHAUSTED);
        expect(verbsOf(out).has('weigh')).toBe(false);
        const why = holdRow(out).rejected
            .find((r) => r.option.startsWith('weigh with pushableblock')).why;
        expect(why).toMatch(/it stands on \(2,2\) and the presser is on \(6,3\)/);
        expect(why).toMatch(/ONE axis/);
    });

    /**
     * ⛔ EVERY INTERMEDIATE CELL IS ASKED, NOT JUST THE DESTINATION — a wall
     * between the block and the button stops the block dead, and a derivation
     * that only checked the endpoint would order a lean that quietly does
     * nothing. (R8 slice 4's off-the-map guard is this defect one axis over.)
     */
    it('a wall between the block and the button: `hold` stands, the cell named', () => {
        const out = solveRoom('C2-block-path-blocked', {
            ...CANONICAL,
            walls: [...wallAcross(5, 4), { tx: 5, ty: 3, terrain: 'wall' }],
        });
        expect(out.verdict).toBe(VERDICT.BUDGET_EXHAUSTED);
        expect(verbsOf(out).has('weigh')).toBe(false);
        const why = holdRow(out).rejected
            .find((r) => r.option.startsWith('weigh E k=3')).why;
        expect(why).toMatch(/\(5,3\) is Solid to the block/);
    });
});
