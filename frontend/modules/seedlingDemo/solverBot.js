/**
 * seedlingDemo/solverBot — the LIVE SOLVER POLICY. R8 slice 2, kickoff
 * `NewDocs/plans/seedling-bot-r8-opus-kickoff.md` §3.1 / §4 slice 2 (⚖ §6.2
 * ruled the name and the placement: a peer of the planner, beside
 * `botDriverV2`).
 *
 * The sense→plan→act loop: given a live run and a GOAL LIST, each decision it
 * (1) SENSES the run's own getters plus the union danger map, (2) PLANS — a
 * waypoint corridor from the A\* stack, planned against the run's OWN
 * full-bag geometry, (3) IDENTIFIES the blocking obstacle when no corridor
 * exists (the planner's own {kind, blocker} names it), (4) SELECTS a strategy
 * — the VERB LIBRARY is the catalog, invoked reactively rather than from a
 * leg spec — and (5) ACTS via `run.advance(held)` (through the shared `drive`
 * primitive and the verbs' own internal loops), recording the tick's keys and
 * a DECISION TRACE row.
 *
 * ── WHAT THIS IS *NOT* (slice 2's scope, stated) ──────────────────────
 *
 *   · NO COMBAT POLICY. The danger map is SENSED at every decision point and
 *     its reason list reaches the trace and every refusal — but the response
 *     to danger this slice is a NAMED REFUSAL, not a dodge. Dodge /
 *     opportunistic attack / walk-past are slice 3's policies, and they ADD
 *     strategy rows to `STRATEGY_EXECUTORS` rather than restructuring this
 *     loop.
 *   · NO SEARCH OVER RUN FUTURES. There is no `run.clone()` (kickoff §2.1's
 *     named gap), and slice 2 needs none: the policy is greedy-with-replan,
 *     and the only search it runs (`mover.findEarliestArrival`, when a
 *     corridor is contested) searches the PHYSICS stratum from a state
 *     triple, not the run. Re-run-from-boot is the accepted v1 fallback and
 *     nothing here reaches for it yet.
 *
 * ── THE FULL BAG (⛔ §8.3.1, the first thing this module had to read) ──
 *
 * The legacy planner forwards 8 of the 14 live-geometry families and is
 * PRESERVED that way (re-routing committed legs is a re-record; no licence
 * exists). The solver plans with all fourteen: `run.liveGeometryOpts()` — the
 * run's OWN `liveSolidOpts`, normalised and branded — handed to
 * `plannerObstacleAt` as `liveBag`, its second entry shape. One policy
 * implementation, two entries; a hand-written fourteen-family roster here
 * would have been trap 86's sixth occurrence.
 *
 * ── WHERE IT REFUSES, AND HOW (never a silent stall) ──────────────────
 *
 * Every dead end is a `SolverRefusal` that NAMES the obstacle (the
 * census/semantic vocabulary via the planner's own blocker record), the goal
 * it was serving, the strategies considered with the reason each was
 * rejected, and — when danger is involved — the danger map's reason list.
 * The trace rows recorded so far ride on the error (`refusal.rows`), so a
 * refused segment is still reviewable.
 *
 * ── RE-PLAN CADENCE (a slice-2 design decision, recorded in §10) ──────
 *
 * The policy re-plans on EVENTS, not on a tick clock: (a) no current plan —
 * goal start, or a verb just edited the world; (b) a waypoint drive failed
 * (a blocked sweep or a stall) — ONE re-plan from the live position, as a
 * TRACE ROW, then a refusal if the retry fails too (a silent re-plan hides a
 * model divergence; a TRACED one is a decision); (c) the sensed contact set
 * is position-scoped, so every plan re-senses it. A per-tick A\* would buy
 * nothing: the world edits at verb cadence, not tick cadence, and the
 * per-tick reactive layer is `drive`'s own transition/volume/hit checks plus
 * the danger probe at every DECISION point.
 */

import {
    DEFAULT_TOLERANCE, DEFAULT_MAX_TICKS_PER_TARGET, chooseHeld, hasArrived,
} from './botDriverV1.js';
import {
    BotDriverV2Error, DEFAULT_LATTICE, contactsAt, drive, findExit,
    nodeCentre, nodeAt, plannerObstacleAt, planWaypoints, runChest, runCollect, runHold,
    runShove, runDwell, SHOVE_STEP,
} from './botDriverV2.js';
import { resolvePresser } from './botDriverV2.js';
import {
    KEY_RESPONDERS, RESPONDERS, TOUCH_RESPONDERS, keyLineTouches, localPublish,
    opensOnKeyTick, opensOnTick,
} from './activators.js';
import {
    SHIELD_BOSS, shieldBossBandRect, shieldBossBodyRect, shieldBossDeathSchedule,
} from './shieldBossFight.js';
import { SPINNER, hammerHitsPlayer } from './spinner.js';
import { KILL_ARM_POLICY } from './enemyDamage.js';
import {
    DOWN, LEFT, RIGHT, SLASH_HIT_TICKS, SLASH_REACH, UP, distanceRectPoint, slashRect,
} from './presses.js';
/**
 * ⛓⛓⛓ R9 SLICE 4 — THE ROCK'S OWN TRANSCRIPTION, ASKED RATHER THAN COPIED.
 * `rockBreaksUnder` is `hit(_t)`'s test (`rockType <= hasGhostSword ? 1 : 0`),
 * `WAIT_AFTER_PRESS_TICKS` is the LEG's promise and `assertWaitCovers` is the
 * check that a leg keeps it. ⛔ None of the three numbers is retyped here
 * (trap 89): the module that transcribed `BreakableRock.as` owns them, and the
 * one that owns `HIT_TO_GONE_TICKS`' ±1 is the one that must say how long a
 * wait has to be.
 */
import {
    WAIT_AFTER_PRESS_TICKS, assertWaitCovers, rockBreaksUnder,
} from './breakableRocks.js';
import {
    bodyKillRegions, dangerAt, dangerDuringTransit, dangerVolumes, forbiddenByDanger,
} from './dangerMap.js';
import { planDash } from './mover.js';
import { ARROW, arrowLaneForPlacement, arrowLaneRect } from './arrowTrap.js';
import { bridgedChaserTags, chaserBoxAt, killWindowTicks } from './chasers.js';
import { createTraceBuilder } from './decisionTrace.js';
import { DESTROYING_TILE_TYPES } from './pushables.js';
import { rect, TILE_SIZE } from './levelWorld.js';
import { ENEMY_CLASSES, KILL_LOCK_TAGS, KILL_LOCK_TSET } from './combat.js';
// ⛓ R8 slice 8: the PRESSER's own cadence floor — the dash rule plus the
// receiver's i-frames, in one constant `killSchedule` has refused a smaller
// value than since R5. The press arm never consulted it; the game found out.
import {
    DASH_CHAIN, DASH_DISPLACEMENT, KILL_PRESS_CADENCE, ORDINARY_SWING_PERIOD,
    SLASH_ANIM_TICKS, slashSet, slashTimerTick,
} from './combatVerbs.js';
import {
    STRIKE_PRESS, armIsModelled, createStrikePolicy,
} from './strikePolicy.js';
import { MOBILE_DEATH_FADE } from './enemyDamage.js';
import { PhysicsV2Error, playerBoxAt } from './playerPhysicsV2.js';
import { HITBOX, WALK_SPEED } from './playerPhysicsV1.js';
import { chestStanceBand } from './chest.js';

/**
 * ⛓⛓⛓ THE TRANSIT PROBE'S OWN NON-VACUITY, AS A FUNCTION.
 *
 * ⛔ A PROBE THAT SAMPLES EVERY CELL AT THE PLAN TICK IS THE ONE TRAP 161 IS
 * ABOUT, and it is indistinguishable from an eta-aware one by its RESULT on a
 * calm room. So the instrument states its own clock: every sample carries the
 * ABSOLUTE tick it was asked at, the ticks advance one per simulated tick, and
 * a corridor longer than one tick must contain at least one sample ABOVE the
 * tick the plan was made on. Degrade the ETA source to a constant and this is
 * what goes red — which is the first row of `R8_ETA_PROBE.gates.mutations`.
 *
 * @param {Array<{x:number,y:number,tick:number}>} samples in walk order
 * @param {number} startTick the run's own clock when the corridor was planned
 */
export function assertTransitSamplesCarryEtas(samples, startTick,
    what = 'the transit probe') {
    if (!Array.isArray(samples) || samples.length === 0) {
        throw new Error(`${what}: a corridor validated with NO samples is a corridor `
            + 'nobody looked at. Hand over the walk the controller would drive.');
    }
    if (!Number.isFinite(startTick)) {
        throw new Error(`${what}: the plan tick must be finite; got ${startTick}.`);
    }
    let prev = startTick;
    for (let i = 0; i < samples.length; i += 1) {
        const s = samples[i];
        if (!Number.isInteger(s?.tick)) {
            throw new Error(`${what}: sample ${i} carries no absolute tick — an ETA that is `
                + 'not written down is an ETA nobody can check (trap 161).');
        }
        if (s.tick <= prev) {
            throw new Error(`${what}: sample ${i} is at tick ${s.tick}, which does not `
                + `advance on ${prev}. The samples ARE the ticks the controller would `
                + 'spend; one that repeats or goes backwards is a clock that stopped.');
        }
        prev = s.tick;
    }
    if (samples.length > 1 && samples[samples.length - 1].tick <= startTick + 1) {
        throw new Error(`${what}: ${samples.length} samples all landed inside one tick of `
            + `the plan tick ${startTick}. That is the STATIC probe wearing this one's `
            + 'name — the collapse trap 161 names.');
    }
    return {
        samples: samples.length,
        startTick,
        endTick: samples[samples.length - 1].tick,
        span: samples[samples.length - 1].tick - startTick,
    };
}

/**
 * ⛓⛓⛓ ARC 3 SLICE 2c — `code`, AND IT DISCHARGES A NAMED RESIDUE.
 *
 * `procgenOracle.isHammerSafetyRefusal` decides which of these becomes a
 * candidate REVERT instead of a run abort, and until this slice it decided by
 * grepping the English (`/hammer disc/`). Its own docblock named the fix and
 * the condition for making it: *"the structured fix is a field on the throw
 * (`err.hammerSafety`) … the day `solverBot` is open for another reason, stamp
 * the four sites and this predicate becomes a field read."* This slice rewords
 * those very sentences, so the day arrived: a classifier keyed on prose would
 * have turned every hammer-safety refusal into a `GenerationAborted` the
 * moment the words moved.
 *
 * ⚠ `null` ON EVERY OTHER THROW, and that is what keeps the catch NARROW — an
 * unkeyed `bosslock`'s `SolverBotError` still propagates, because it carries
 * no code rather than because it happens to say nothing about a hammer.
 */
export class SolverBotError extends Error {
    constructor(message, { code = null, boundTicks = null } = {}) {
        super(message);
        this.name = 'SolverBotError';
        this.code = code;
        /**
         * ⛓ SLICE 2d — THE BOUND THE THROW EXHAUSTED, as a NUMBER.
         *
         * `null` on every throw but `STRIKE_BOUND_EXHAUSTED`'s. It exists so
         * `procgenOracle` can print `budgetKind` from the field instead of
         * parsing it back out of the English it just wrote — the same
         * argument as `code` itself, one field on.
         */
        this.boundTicks = boundTicks;
    }
}

/** ⛓ SLICE 2c's `code`: `procgenOracle`'s three hammer-safety sites. */
export const HAMMER_SAFETY = 'HAMMER_SAFETY';

/**
 * ⛓⛓⛓ ARC 3 SLICE 2d — THE SECOND `code`, AND IT IS A **BUDGET**, NOT A
 * SAFETY CLAIM.
 *
 * `execKillByPress` drives a strike schedule for at most `SPINNER.hitsMax *
 * (strikeHorizon + HOLD_SLACK)` ticks and `fail()`s when the body is still in
 * the world at the end of it. Probe 2b (kickoff §9b.5) measured what that
 * costs when it fires: **one solve ran 21 m 47 s and then aborted its whole
 * generation run**, because the throw is a `SolverBotError` carrying no code,
 * so `procgenOracle` propagated it and `levelGenerator` turned it into
 * `GenerationAborted` — 88.3% of a 24-run bound in a single item.
 *
 * ⛔ THE CLAIM THIS CODE MAKES IS NARROW AND IT IS THE REASON THE WIDENING IS
 * ALLOWED: exhausting a tick budget is not evidence of a defect in the
 * generator, it is the candidate failing to be solved INSIDE A BOUND THIS
 * PROCESS SET — exactly what `VERDICT.BUDGET_EXHAUSTED` already means for the
 * 400-tick per-target budget. So the candidate REVERTS and the run lives.
 * ⛔⛔ It is a NAMED widening and never a catch-all (traps 171/173): every
 * other `SolverBotError` still carries `code: null` and still aborts.
 */
export const STRIKE_BOUND_EXHAUSTED = 'STRIKE_BOUND_EXHAUSTED';

/**
 * ⛔ THE NAMED REFUSAL. "No path and no strategy" never stalls silently —
 * it throws this, carrying the goal, the obstacle (census vocabulary), every
 * strategy considered with why it was rejected, and the trace rows recorded
 * so far. A reader gets the whole decision, not a stack trace.
 */
export class SolverRefusal extends Error {
    constructor(message, {
        goal = null, obstacle = null, considered = [], rows = [], perTick = [],
        pending = null, dangerQueries = [],
    } = {}) {
        super(message);
        this.name = 'SolverRefusal';
        this.goal = goal;
        this.obstacle = obstacle;
        this.considered = considered;
        this.rows = rows;
        /**
         * ⛓⛓⛓ R8 SLICE 4 — THE TICKS THE REFUSED PASS DID SPEND.
         *
         * The two-pass authoring loop's first pass ENDS in a refusal by
         * design (the goal is behind a gate nothing has declared yet), and
         * what it produces is not the refusal — it is the PREFIX. So the keys
         * ride on the error the same way the trace rows already do: a refused
         * segment is not only reviewable, it is REPLAYABLE, which is what
         * lets the GAME answer a question the model refuses to.
         */
        this.perTick = perTick;
        /**
         * ⛓ AND WHICH DECLARATION WOULD UNBLOCK IT, when the refusal knows.
         * `{level, tag, source, why}` — a first-class outcome rather than a
         * string a caller has to parse, because the loop's next step is
         * decided by `source` (`model` reads the run's own ledger, `game`
         * truncates the prefix and asks the running game).
         */
        this.pending = pending;
        /**
         * ⛓⛓⛓ EDITOR ARC SLICE 10 — THE DANGER RECORD, ON THE ONE OUTCOME
         * THAT CAN CARRY A NON-EMPTY ONE.
         *
         * Slice 9 added `solveSegment`'s `dangerQueries` and then MEASURED
         * something nobody had asked (§17.5): across 30 solves of 9 committed
         * staging blocks, 62+ recorded queries, **ZERO** came back with a
         * non-empty reason list. That is a theorem rather than an accident —
         * `refuseDanger` THROWS when the union answers danger, so a segment
         * that REACHES ITS GOAL cannot have had a dangerous gate. ⇒ the
         * interesting half of that channel exists ONLY on a refusal, and this
         * is where a reader can get at it.
         *
         * ⚠ THE SAME BOUND `rows` AND `perTick` ALREADY CARRY, stated rather
         * than discovered: this is filled by `solveSegment`'s own `refuse()`
         * closure, so a `SolverRefusal` thrown by a MODULE-LEVEL helper
         * (`deriveFightStance`, `deriveKillByCeiling`'s family, `execKill`'s
         * `PendingDeclaration`) arrives with an EMPTY list — not because
         * nothing was asked, but because those functions cannot see the
         * recorder. An empty list is therefore "no record", never "no
         * danger"; the readouts say so by name.
         */
        this.dangerQueries = dangerQueries;
    }
}

const fail = (m, opts) => { throw new SolverBotError(m, opts); };

/**
 * ── THE STRATEGY CATALOG — the seam slice 3 extends ───────────────────
 *
 * Two tables, one key set each way:
 *
 *   `OBSTACLE_STRATEGIES` — obstacle vocabulary → strategy name. The
 *   obstacle's `kind` is `plannerObstacleAt`'s own; where the kind is a
 *   grab-bag (`solid`), the blocker's census TAG selects. A kind/tag with no
 *   row is a refusal that says so.
 *
 *   `STRATEGY_EXECUTORS` — strategy name → executor. ⚠ A strategy may be
 *   SELECTED and not REGISTERED: the selector names what the obstacle needs
 *   (`pushableblock` → `shove`) and the refusal then says "selected `shove`;
 *   not registered this slice" — which is slice 3's work order, computed
 *   rather than guessed. Registering an executor is one row here; that is
 *   the "adds policies rather than restructuring" contract.
 */
export const OBSTACLE_STRATEGIES = Object.freeze({
    'solid:pushableblock': 'shove',
    'solid:pushableblockfire': 'shove',
    'solid:lock': 'hold',
    'solid:shieldlock': 'touch',
    /**
     * ⛓ R8 slice 7 — L20's own class name. `ShieldLock` is ONE AS3 class with
     * TWO census tags (`shieldlock` and `shieldlocknorm`, which differ only in
     * `shieldType`), and `activators.TOUCH_RESPONDERS` has carried both rows
     * since R3. A table that knew one of them would refuse the room the verb
     * was written for.
     */
    'solid:shieldlocknorm': 'touch',
    /** ⚖ §15.7a ruling 1's `key -> keylock` opener, at the obstacle's own tag. */
    'solid:bosslock': 'keylock',
    /**
     * ⛔⛔⛔ R8 SLICE 7 — THE TRAP-62 CONTROL, REPLACED RATHER THAN DELETED.
     *
     * `touch` was §10.4 note 4's live control from slice 2 to slice 6 — the
     * claim that a strategy may be SELECTED by this table and ABSENT from the
     * registry, with a refusal that says so by name. Registering it discharges
     * the refusal, and a control deleted in the change that widens the claim
     * is not a control (trap 62), so the row moves to a REAL obstacle with a
     * REAL verb and no solver executor: L40's `wandlock` is a `Lock` with a
     * sprite (R6's carried finding) whose opener is the WAND, and
     * `botDriverV2.runFire` is the verb nobody has bound to a work order.
     *
     * ⚠ NOT A SYNTHETIC ROW. Fourteen `wandlock`s stand on the R1 route and
     * L40's link-5 wall is the one R7 measured as unrouted — so this is a
     * control that can really fire, which is the whole difference between a
     * control and a comment.
     */
    'solid:wandlock': 'wand',
    /**
     * ⛓ R8 slice 7 — the ShieldBoss's 48x48 body IS the door (§13.10's route:
     * the room's only way north runs through the three columns he stands in),
     * so the frontier names him as an ordinary `solid` and the strategy is the
     * fight. Trap 150 is why the fight and the crossing cannot be cut apart.
     */
    'solid:shieldboss': 'fight',
    /**
     * ⛓⛓⛓ ⚖ EDITOR ARC SLICE 10 (§12d item 11, the USER's ruling — which
     * SUPERSEDES §12c's deferral of this row to R9) — **A CHEST IN THE
     * CORRIDOR IS A CLEARABLE OBSTACLE, NEVER FIXED GEOMETRY.**
     *
     * The chest already had a strategy row and a registered executor — but
     * only as a `proximity-hazard`, which is the shape it wears when a GOAL
     * names its placement (`resolveCollectStrategy`). Standing in a corridor
     * it wears the other one: `Chest` is a `Solid` until `open()` flips it, so
     * `plannerObstacleAt` reports it as `solid:chest`, and with no row here
     * the frontier said *"No strategy row exists for this obstacle"* and
     * priced a one-tile corridor as a wall. Measured on the route's step 11
     * (L11, whose only corridor is a one-tile shaft with `chest@32,48` across
     * it — survey §15.4a).
     *
     * ⛔ AND THE SEMANTICS ARE THE PERSISTENCE-VISIBLE ONES, not a
     * convenience: discharging this obstacle means COLLECTING the chest —
     * `Chest.open()` spawns the SealPiece, the walk collects it, and the run
     * earns the clear exactly as a goal-directed collect does. That is why
     * the row points at the SAME verb rather than at a new "remove" one: one
     * mechanism, one executor, one ledger entry.
     */
    'solid:chest': 'chest',
    /**
     * ⛓⛓⛓ ⚖ R9 SLICE 4 — **THE DERIVED `break` VERB**, and the ROW is the half
     * of it the route was waiting for.
     *
     * The engine has modelled the swing since R5 slice 5 (`levelRun.js`'s
     * `BreakableRock` arm: `rockBreaksUnder`, `hitRock`, the out-of-band
     * persistence write) and `presses.PRESS_ARM_POLICY.BreakableRock` has said
     * `modelled` ever since. What did not exist was a SOLVER row: a rock press
     * was named by OEL COORDINATE in `botDriverV2`'s hand-written spear arm, so
     * to the live solver a rock was stone — with the sword and without it.
     *
     * ⛔ MEASURED, TWICE, BEFORE THIS ROW EXISTED. Route-survey step 12 (L3 out
     * of L11) is *"Obstacle: solid:breakablerock (breakablerock@96,112). No
     * strategy row exists for this obstacle"* — and `breakablerock@96,112` CUTS
     * L3, so the room has no way round it. And arc 5 slice 5's probe 1 put a
     * rock on the short arc of a cycle and got 244 ticks in BOTH arms of the
     * requirements differential: *"to this solver the rock is a WALL"*.
     *
     * ⛓ **TWO TAGS, ONE VERB** — `shieldlock`/`shieldlocknorm`'s own lesson
     * (R8 slice 7) one family over. `Game.as:2158` builds the
     * `breakablerockghost` family with `rockType = 1` and everything else with
     * the default 0, so the two census tags are ONE AS3 class differing in the
     * field that decides which weapon breaks it. A table that knew only the
     * plain tag would answer *"No strategy row exists"* for a ghost rock —
     * which is a sentence about the CATALOGUE when the fact is about the
     * INVENTORY. With both rows the ghost rock refuses BY NAME instead, and
     * names the ghost sword as its next work order.
     */
    'solid:breakablerock': 'break',
    'solid:breakablerockghost': 'break',
    'solid:magicallock': 'kill',
    // A button guarding the frontier is L4's own shape: the room's answer
    // starts with HOLDING it (the hand-authored leg's `hold` mechanic).
    'proximity-hazard:button': 'hold',
    'proximity-hazard:chest': 'chest',
    'pickup': 'collect',
});

/**
 * ⛓⛓⛓ PROCGEN PoC SLICE 3b — **THE SECOND SELECTION PATH, AS DATA.**
 *
 * `OBSTACLE_STRATEGIES` above is not the only way a verb gets chosen:
 * `refineStrategy` turns one table answer into another by asking the LEVEL a
 * question the table cannot ask. That path has existed since R8 slice 3b (the
 * kill-lock arm) and was never written down anywhere a reader — or a test —
 * could find it.
 *
 * ⛔ AND THE COST OF NOT WRITING IT DOWN WAS ALREADY BEING PAID. The catalog
 * invariant in `solverBot.test.js` asserts that every registered executor
 * answers a selector row, computing "selected" from `OBSTACLE_STRATEGIES`
 * alone — so `kill` satisfied it only because `solid:magicallock` happens to
 * name `kill` directly. The invariant has never modelled refinement at all;
 * it passed for a reason unrelated to the claim it makes. `weigh` is the
 * first refined verb with no table row of its own, which is what surfaced it.
 *
 * ⚠ THIS TABLE IS DESCRIPTIVE, NOT EXECUTABLE — `refineStrategy` does not
 * consult it, because the two predicates are different shapes (a `tset`
 * comparison and a scan over the group's pressers) and storing them as
 * functions here would move code rather than make data. That makes it a
 * SECOND SPELLING, and the guard against drift is that every row is DRIVEN:
 * `procgenWeigh.test.js` builds its refinement cases FROM this table, so a row
 * added without a case that exercises the flip is a failing test rather than
 * an uncounted one (trap 199's structure).
 */
export const STRATEGY_REFINEMENTS = Object.freeze([
    Object.freeze({
        from: 'hold',
        to: 'kill',
        when: 'the lock is a KILL-LOCK (`tset == -1`): no button exists for it anywhere '
            + 'in the game, and `checkEnemies()` opens it when `Game.totalEnemies()` '
            + 'reaches zero',
    }),
    Object.freeze({
        from: 'hold',
        to: 'weigh',
        when: 'every presser in the lock\'s group REPUBLISHES (`localPublish` is null for '
            + 'all of them), so the hold cannot outlive the walker — and the game\'s own '
            + 'answer is a `"Solid"` parked on the button (`Button.as:16`)',
    }),
]);

/**
 * Executors registered so far. ⛓ R8 slice 3 added `hold`, which is the first
 * row that had to DERIVE its own parameters rather than bind a placement: a
 * leg spec carried `{presser, ticks}` and a live policy has to work out both.
 */
export const STRATEGY_EXECUTORS = Object.freeze({
    collect: execCollect,
    chest: execChest,
    hold: execHold,
    /**
     * ⛓ R8 slice 3b: the first executor whose DESTINATION is derived rather
     * than its stance — ⚖ §11.8a ruling 1. `hold` derived a duration from a
     * mechanism; this derives a CELL from a post-condition, which is the
     * shape `kill` and the puzzle policy then follow.
     */
    shove: execShove,
    /**
     * ⛓⛓⛓ PROCGEN PoC SLICE 3b (⚖ kickoff §1.9) — the first executor that is
     * a COMPOSITION of two registered verbs rather than a new one. Its
     * destination is derived from a MECHANISM (the presser's cell) where
     * `shove`'s is derived from a post-condition (`clear-path`'s minimum `k`),
     * which is the whole of the difference between the two rows.
     */
    weigh: execWeigh,
    /**
     * ⛓⛓⛓ R8 slice 4: the first executor whose completion is a WORLD FACT
     * NEITHER IT NOR THE MODEL CAN PRODUCE. A `hold` waits for a responder
     * this model steps; a `shove` edits the world itself. A `kill` by the
     * room's own ceiling waits for a body to die — and for a KILL-LOCK the
     * model computes the consequence but not the opening, while for a STATIC
     * `"Enemy"` body §11.4 refuses to compute the death at all. Both are
     * finished by a DECLARED clear, which is why this executor is the one
     * that raises a PENDING declaration instead of inventing a tick.
     */
    kill: execKill,
    /**
     * ⛓⛓⛓ R8 SLICE 7 — THE THREE THE RUNG'S LAST ROOMS NAME.
     *
     * `fight` is the first executor whose completion is a SCHEDULE the
     * receiver sets: `hitPlayer` counts 120 CONSECUTIVE band ticks and then
     * opens the one animation `ShieldBoss.hit` forwards through, so the press
     * ticks are `shieldBossWindowFor`'s arithmetic and nothing else.
     * `keylock` and `touch` are LATCHES — both mechanisms run to completion
     * once triggered, which is why neither is a `hold`.
     */
    fight: execFight,
    keylock: execKeylock,
    touch: execTouch,
    /**
     * ⛓⛓⛓ ⚖ R9 SLICE 4 — the first executor whose whole effect is a WALL GOING
     * AWAY, and the first one that needs NO derivation of a moment: a rock is
     * STATIC, so a strike stance is a reachable cell plus a facing and there is
     * no forecast to consult and no `previewWalk` per opportunity to pay for.
     * `kill`'s press arm derives WHEN; this derives only WHERE, and then waits
     * out an animation whose length the transcription already owns.
     */
    break: execBreak,
});

/**
 * ⛔ THE BOUND ON STRATEGY APPLICATIONS PER GOAL, and it is named rather than
 * generous. Every application must EDIT the world (that is what a verb is),
 * so a goal that has cleared four distinct obstacles and still has no
 * corridor is not making progress — it is looping. Four is the most any act2
 * room needs (L8's two shoves and two holds), stated so a room that needs
 * five reports the bound rather than spinning.
 */
const MAX_STRATEGIES_PER_GOAL = 4;

/**
 * ⛓⛓⛓ **PROCGEN ELEMENTS arc 3, SLICE S1 — HOW MANY OPENERS ONE ORDER MAY
 * NEST, AND IT IS A NUMBER RATHER THAN A LOOP.**
 *
 * ⚖ Ruling 22's gadget is a TWO-DEEP chain: the goal is behind `lock`(B), whose
 * opener is a `buttonroom` behind `lock`(A), whose opener is a `button` a BLOCK
 * has to be weighed onto. Reaching the buttonroom's stance therefore needs one
 * order raised for ANOTHER order's stance — which is one level of nesting and
 * exactly one.
 *
 * ⛔ THE CHAIN IS COUNTED FROM THE FRONTIER, NOT FROM THE PREREQUISITE. The
 * order the frontier raises is link **1**; a prerequisite raised so that link 1's
 * stance can be reached is link **2**; a prerequisite of THAT is link 3 and
 * REFUSES BY NAME. So this number is the length of the deepest chain the policy
 * will drive, and setting it to 1 turns the capability off entirely — which is
 * what the mutant does.
 *
 * ⛔ AND THREE-DEEP IS NOT "unsupported", IT IS **REFUSED WITH A SENTENCE**
 * naming the prerequisite it would not resolve. A bound that ran out silently
 * would look exactly like a room with no answer. Deeper chains are arc 4's
 * (bent pushes) and they arrive with their own ruling, not by raising this
 * number.
 */
export const NESTED_OPENER_DEPTH = 2;

/**
 * ⛓⛓⛓ R8 SLICE 3b — THE TABLE NAMES A STRATEGY BY TAG; LIVE STATE REFINES IT.
 *
 * ⛔ A `lock` AND A KILL-LOCK ARE THE SAME TAG AND OPPOSITE PROBLEMS, and L5
 * is where a table keyed on the tag alone gets it wrong. An ordinary `lock`
 * answers to an `Activators` group and its strategy is `hold` — stand on the
 * button. A **kill-lock** is `tset == -1` (`combat.KILL_LOCK_TSET`): no
 * button exists anywhere in the game for it, `checkEnemies()` opens it when
 * `Game.totalEnemies()` reaches zero, and a policy that went looking for a
 * presser would find none and report the obstacle unresolvable — which is
 * exactly what L5 did before this refinement.
 *
 * ⇒ the refinement is a QUESTION ASKED OF THE LEVEL, not a second table:
 * `combat.killLocksIn` is the transcription that already knows which locks
 * are which, and it is asked rather than copied (trap 89).
 */
function refineStrategy(run, strategy, obstacle) {
    if (strategy !== 'hold') return strategy;
    /**
     * ⚠ ASKED OF THE BUILT WORLD'S OWN ACTIVATOR ROSTER, which carries the
     * group verbatim (`lock@48,112 t=-1` in L5), rather than of the raw level
     * record: the run has the built world and `combat.killLocksIn` wants the
     * record. Same fact, one reader, and `KILL_LOCK_TSET` is imported so the
     * sentinel is the transcription's and not a `-1` typed here.
     */
    const row = (run.world.activators ?? []).find((a) => a.id === obstacle.id);
    if (!row || !KILL_LOCK_TAGS.includes(row.tag ?? obstacle.tag)) return strategy;
    if (row.t === KILL_LOCK_TSET) return 'kill';
    /**
     * ⛓⛓⛓ PROCGEN PoC SLICE 3b (⚖ kickoff §1.9) — THE SECOND REFINEMENT, AND
     * IT ASKS WHETHER THE HOLD CAN **OUTLIVE THE WALKER**.
     *
     * The kill-lock arm above asks "does this lock have a presser at all"; this
     * one asks the question after it: "can the thing that presses it keep
     * pressing once the player has left?" — because for a lock ON THE FRONTIER
     * the player's whole errand is to be on the far side, and a `hold` puts
     * them on the near one.
     *
     * ⛔ `Button.update` IS A REPUBLISH, NOT A LATCH. `Button.as:27-39`
     * re-collides `hitables` every tick and assigns `activate` from whoever is
     * standing there, so stepping off shuts the group in the same tick. Slice 3
     * measured the consequence and excluded the whole family for it: the walk
     * spends its entire per-target budget *"grazing 396 solid(s): lock at
     * (64,80)"* — a lock it had just opened and then closed by leaving.
     *
     * ⛓ AND THE GAME'S OWN ANSWER IS THE THIRD MEMBER OF THAT COLLIDE LIST.
     * `hitables` is `["Player", "Enemy", "Solid"]` and `PushableBlock.as:27` is
     * `type = "Solid"` — so a block parked on the button presses it for ever.
     * L15 is the room built around exactly that (`Dungeon2/2.oel:107-111`:
     * `pushableblock@(64,64)`, `button@(112,32) tset=0`,
     * `lock@(128,48) tset=0`, with the stairs behind the lock).
     *
     * ⛔ THE GATE IS `localPublish`, NOT A NEW PREDICATE. `deriveHold` already
     * computes it for its own reasons (:1532, the `latched` field), and it is
     * the one honest reading of "this hold survives the walker": a
     * `ButtonRoom`'s `room == -1` arm assigns `activate` directly behind the
     * author's own *"Can't be reset to false!!"*, so L20's `buttonroom@192,16`
     * really does keep its group published after the player leaves and its
     * `hold` is right. A plain `Button` does not, and its `hold` is a walk
     * against a closing door.
     *
     * ⚠ A LOCK WITH NO PRESSER AT ALL KEEPS `hold`, which then resolves to
     * `null` and is reported as considered-and-rejected by the caller. "This
     * lock has no opener" and "this lock's opener cannot be left" are different
     * facts and only the second one is this arm's.
     */
    const group = (run.world.pressers ?? []).filter((p) => p.t === row.t);
    if (group.length === 0) return strategy;
    return group.every((p) => localPublish(p) === null) ? 'weigh' : strategy;
}

/**
 * ⛓⛓⛓ RESOLVE a frontier obstacle into everything its executor needs —
 * the live counterpart of a leg spec's declared arguments.
 *
 * Returns `null` when the obstacle's census row is not one this executor can
 * bind, which the caller reports as a considered-and-rejected option rather
 * than as a crash: "the table names a strategy for this kind" and "this
 * particular body can be acted on" are different claims.
 */
function resolveObstacleStrategy(run, strategy, obstacle, contacts, aim, allowTeleporter,
    blocked = []) {
    if (strategy === 'shove') return resolveShoveStrategy(run, obstacle, contacts, aim,
        allowTeleporter, blocked);
    if (strategy === 'chest') return resolveChestStrategy(run, obstacle, contacts);
    if (strategy === 'kill') return resolveKillStrategy(run, obstacle, contacts);
    if (strategy === 'fight') return resolveFightStrategy(run, obstacle, contacts, blocked);
    if (strategy === 'keylock') return resolveKeylockStrategy(run, obstacle, contacts, blocked);
    if (strategy === 'touch') return resolveTouchStrategy(run, obstacle, contacts, blocked);
    if (strategy === 'break') return resolveBreakStrategy(run, obstacle, contacts, blocked);
    if (strategy === 'weigh') return resolveWeighStrategy(run, obstacle, contacts, blocked);
    if (strategy !== 'hold') return null;
    return resolveHoldStrategy(run, obstacle, contacts, blocked);
}

/**
 * The `hold` arm, lifted out of `resolveObstacleStrategy` UNCHANGED so that
 * `weigh` can fall back to it (see `resolveWeighStrategy`). A pure move: the
 * body is the same statements in the same order, and the battery is what says
 * so.
 */
function resolveHoldStrategy(run, obstacle, contacts, blocked = [], alsoRejected = []) {
    const opener = openerPresserFor(run, obstacle);
    if (!opener) return null;
    const presser = opener.presser;
    const resolvedPresser = resolvePresser(run.world, { x: presser.x, y: presser.y },
        `solverBot hold (${obstacle.id})`);
    /**
     * ⛓ THE ONE CALLER THAT ASKS FOR A PREREQUISITE (arc 3 slice S1, gap 1) —
     * because it is the one whose result reaches `walkTo`, the ONE place that
     * consumes one. See `deriveHoldStance`'s own arm for why the other two
     * callers must not be given it.
     */
    const { stance, exempt, prerequisite } = deriveHoldStance(run, resolvedPresser, contacts,
        blocked, { prerequisites: true });
    return {
        strategy: 'hold',
        target: { x: presser.x, y: presser.y },
        stance,
        exempt,
        ...(prerequisite ? { prerequisite } : {}),
        hold: deriveHold(run, resolvedPresser, opener),
        rejected: [{
            option: 'route-around',
            why: `${obstacle.id} is on the frontier of the reachable component, so there `
                + 'is no route around it — A* refuses to plan THROUGH an avoid volume or '
                + 'a solid, and a hold is what adds its presser to the exemptions '
                + '(trap 147)',
        }, ...opener.rejected, ...alsoRejected],
    };
}

/**
 * ⛓⛓⛓ ⚖ EDITOR ARC SLICE 10 — RESOLVE a `chest` work order raised by the
 * FRONTIER rather than by a goal.
 *
 * `resolveCollectStrategy` answers the goal-side question ("this PLACEMENT is
 * a chest, so the verb is `chest`") and this answers the obstacle-side one
 * ("this SOLID on the frontier is a chest, so the verb is `chest`"). Both end
 * at the same `{strategy, target}` shape and the same executor, because they
 * are one mechanism asked about from two directions — the `shove` pair one
 * table row up has exactly this shape.
 *
 * ⛔ THE STANCE COMES FROM `deriveStance`, NOT FROM A SECOND DERIVATION.
 * `chestStanceBand` is the mechanism's own two-pixel answer and the goal path
 * already reaches it through `deriveStance`; a stance computed here would be a
 * second spelling of a band `runChest` then checks against (§11.7's law, and
 * `arrowLaneRect`'s lesson one slice back).
 *
 * ⚠ Returns `null` when the frontier's id is not a chest in `world.chests` —
 * "the table names a strategy for this kind" and "this particular body can be
 * acted on" are different claims, and the caller reports the second as
 * considered-and-rejected.
 */
function resolveChestStrategy(run, obstacle, contacts) {
    const chest = (run.world.chests ?? []).find((c) => c.id === obstacle.id);
    if (!chest) return null;
    /**
     * ⛔ AN ALREADY-OPEN CHEST IS NOT AN OBSTACLE THIS VERB CAN DISCHARGE —
     * and `runChest`'s own positive control fails BY NAME on it ("opening it
     * proves nothing"). The frontier should not have named it (an open chest
     * is not Solid), so reaching here means the census and the live state
     * disagree, and refusing to bind is what surfaces that rather than
     * spending a leg on it.
     */
    if (run.openChests?.has?.(chest.id)) return null;
    return {
        strategy: 'chest',
        target: chest,
        stance: deriveStance(run, { strategy: 'chest', target: chest }, contacts),
        rejected: [{
            option: 'route-around',
            why: `${chest.id} is on the frontier of the reachable component, so there is `
                + 'no route around it — and a chest is not a wall: `Chest` is a `Solid` '
                + 'only until `open()` flips its type, so the corridor is bought by '
                + 'COLLECTING it (⚖ §12d item 11), which is a persistence-visible act '
                + 'the run earns a clear for.',
        }],
    };
}

/**
 * ⛓⛓⛓ ⚖ §15.7a RULING 1 — A LOCK ON THE FRONTIER RESOLVES THROUGH THE
 * **MECHANISM GRAPH**, NEVER BY ITS OWN ID.
 *
 * The measured gap (§15.7): `resolveObstacleStrategy`'s hold arm looked the
 * presser up by the OBSTACLE's own id, which is right for L4 — where the
 * frontier really does name `button@16,64`, a presser — and answers NOTHING
 * for a `solid:lock`, because a lock is not a presser and never will be. L20's
 * `lock@32,80` is the room's own instance: it is `t = 0` and the thing that
 * opens it is `buttonroom@192,16`, four tiles away and behind another gate.
 *
 * ⇒ the obstacle names the WALL and the mechanism data names the WORK. Two
 * arms, in this order:
 *
 *   (a) THE OBSTACLE **IS** THE PRESSER — L4's shape, kept first because it is
 *       the common one and because a graph walk that also happened to find it
 *       would report the same answer with a longer story.
 *   (b) THE OBSTACLE IS AN **ACTIVATOR**, and its opener set is every presser
 *       sharing its tSet group. Each opener is a SUB-ORDER; the policy
 *       sequences them by dependency exactly as it sequences any other
 *       frontier order, because the walk to a presser behind another gate
 *       re-enters `walkTo` and identifies that gate in turn.
 *
 * ⛔ THE GROUP IS ASKED OF THE WORLD'S OWN ROSTER, never of a `t` typed here:
 * `world.activators` and `world.pressers` are the transcription's, and
 * `combat.killLocksIn`'s sentinel already owns the one group that has no
 * presser at all (`refineStrategy`, one function up).
 *
 * ⚠ TWO OPENERS IS A REAL SHAPE and it is ordered rather than refused — the
 * nearest one first, ties by id, because an emitted tape is an artifact. A
 * group with NO presser is `null`, which the caller reports as
 * considered-and-rejected: "the table names a strategy for this kind" and
 * "this particular lock has an opener" are different claims.
 */
function openerPresserFor(run, obstacle) {
    const pressers = run.world.pressers ?? [];
    const own = pressers.find((p) => `${p.tag}@${p.x},${p.y}` === obstacle.id);
    if (own) {
        return {
            presser: own,
            via: 'the obstacle IS the presser',
            group: own.t,
            rejected: [],
        };
    }
    const row = (run.world.activators ?? []).find((a) => a.id === obstacle.id);
    if (!row) return null;
    const group = pressers.filter((p) => p.t === row.t);
    if (group.length === 0) return null;
    const sorted = [...group].sort(
        (a, b) => Math.hypot(a.x - row.x, a.y - row.y) - Math.hypot(b.x - row.x, b.y - row.y)
            || (`${a.tag}@${a.x},${a.y}` < `${b.tag}@${b.x},${b.y}` ? -1 : 1),
    );
    const presser = sorted[0];
    return {
        presser,
        via: `⚖ §15.7a ruling 1: ${obstacle.id} is an ACTIVATOR in tSet group `
            + `t=${row.t}, and the group's opener is `
            + `${presser.tag}@${presser.x},${presser.y}`,
        group: row.t,
        rejected: [{
            option: `a presser whose id is ${obstacle.id}`,
            why: 'there is none, and there never could be — a lock is not a presser. '
                + '⚖ §15.7a ruling 1: the obstacle names the WALL and the mechanism data '
                + `names the WORK, so this resolves through tSet group t=${row.t} to `
                + `[${sorted.map((p) => `${p.tag}@${p.x},${p.y}`).join(', ')}]`,
        }, ...(sorted.length > 1 ? [{
            option: `the other opener(s) in t=${row.t}`,
            why: `${sorted.slice(1).map((p) => `${p.tag}@${p.x},${p.y}`).join(', ')} `
                + 'also publish this group; the nearest one is taken and the rest are '
                + 'sub-orders this order does not need',
        }] : [])],
    };
}

/**
 * ⛓⛓⛓ R8 SLICE 3b — RESOLVE a `shove` work order, ⚖ §11.8a ruling 1(a).
 *
 * The post-condition here is always **`clear-path`**: this resolver is
 * reached from the COMPONENT FRONTIER, which is by construction the answer to
 * "what stands between the reachable component and the aim". `press` and
 * `dispose` are named by a PUZZLE STEP rather than by a blocked corridor, and
 * they arrive through the policy that owns that step — never by a default
 * here, because "everything else is clear-path" is exactly the reading that
 * would sink a block as a side effect.
 */
function resolveShoveStrategy(run, obstacle, contacts, aim, allowTeleporter, blocked = []) {
    if (run.pushables === null) return null;
    const row = (run.world.pushables ?? []).find((p) => p.id === obstacle.id);
    if (!row) return null;
    if (row.family !== 'walk') {
        /**
         * ⛔ A `pushableblockfire` MOVES ON A PRESS, NOT ON A LEAN — that is
         * `spear`'s verb, and `resolveWalkPushable` refuses it by name. The
         * table maps both families to `shove` because both are the same
         * OBSTACLE; the two verbs are what differ, and a resolver that quietly
         * leaned on a fire block would emit its ticks and move nothing.
         */
        return null;
    }
    const derived = deriveShove(run, row, aim, allowTeleporter, contacts, blocked);
    if (!derived || !derived.plan) return null;
    const { plan, rejected, alternatives, discharged } = derived;
    const step = SHOVE_STEP[plan.dir];
    const stance = nodeCentre(
        Math.floor(run.pushables.get(row.id).rect.x / TILE_SIZE) - step.dx,
        Math.floor(run.pushables.get(row.id).rect.y / TILE_SIZE) - step.dy,
        DEFAULT_LATTICE);
    /**
     * ⛓ THE TRACE RECORDS `k`, AND THE TWO NEIGHBOURS IT REJECTED — ⚖ §11.8a
     * ruling 1(a)'s own words. `k-1` is in `rejected` because the scan
     * measured it (no corridor); `k+1` is computed HERE rather than scanned,
     * because the scan stops at the first success and "I did not look" and "I
     * looked and it was unneeded" print the same thing otherwise.
     */
    const next = { tx: plan.to.tx + step.dx, ty: plan.to.ty + step.dy };
    const nextSinks = plan.destroys ? null : blockSinksOn(run.world, next);
    const rejections = [
        ...rejected.filter((r) => r.option.startsWith(`shove ${plan.dir} k=${plan.k - 1}`)),
        {
            option: `shove ${plan.dir} k=${plan.k + 1} -> (${next.tx},${next.ty})`,
            why: plan.destroys
                ? 'there is no k+1: the block is DESTROYED at k, so the scan ends there'
                : `UNNEEDED — k=${plan.k} already plans the corridor, and ${nextSinks
                    ? `(${next.tx},${next.ty}) is destructive terrain, which ⚖ §11.8a `
                        + 'reserves for a `dispose` post-condition or an explicit last '
                        + 'resort'
                    : 'a longer push buys nothing the post-condition asked for'}`,
        },
        ...alternatives.map((a) => ({
            option: `shove ${a.dir} k=${a.k}`,
            why: `also plans, and is ${a.destroys ? 'DESTRUCTIVE'
                : `${a.k - plan.k} tile(s) longer`} — the order is non-destructive first, `
                + 'then minimum k',
        })),
        ...rejected.filter((r) => !r.option.includes('k=')),
    ];
    if (plan.destroys) {
        /**
         * ⛔ THE IRREVERSIBILITY IS FLAGGED, and it rides in the DECISION
         * rather than in a comment: a destroyed block cannot press, cannot be
         * pushed again and cannot wall a chaser. A `clear-path` order that
         * lands here has exhausted every non-destructive cell, and the trace
         * has to say so out loud.
         */
        rejections.unshift({
            option: 'a non-destructive resting cell',
            why: `NONE yielded a corridor, so this is ⚖ §11.8a ruling 1's explicit LAST `
                + `RESORT. ${row.id} is GONE for the visit: it can no longer press a `
                + 'button, be pushed again, or wall a chaser (`Bob.as:39` pushes "Enemy", '
                + 'so a parked block is a WALL to one).',
        });
    }
    if (discharged.length) {
        /**
         * ⛔ THE HYPOTHESIS IS NAMED IN THE DECISION — guard (i). A
         * destination that rests on "the rest of the plan works" has to say
         * which orders it is leaning on, or a later refusal has nothing to
         * invalidate.
         */
        rejections.unshift({
            option: `the corridor WITHOUT hypothesising [${discharged.join(', ')}]`,
            why: '⚖ ruled reading (b): "a valid path exists" quantifies over the world '
                + 'where the other PENDING frontier orders are discharged — a plan is '
                + `exactly that hypothesis. Bounded to obstacles with a SELECTED strategy `
                + '(guard i); an obstacle with none is a WALL for this quantifier. If any '
                + 'of these refuses later, this destination is RE-DERIVED with it demoted '
                + 'to a wall and the block\'s REAL position as the input (guard ii).',
        });
    }
    return {
        strategy: 'shove',
        postCondition: 'clear-path',
        discharged,
        target: { x: row.x, y: row.y },
        shove: {
            block: { x: row.x, y: row.y },
            dir: plan.dir,
            to: { ...plan.to },
            ...(plan.destroys ? { destroys: true } : {}),
        },
        k: plan.k,
        stance,
        rejected: rejections,
    };
}

/**
 * ⛓⛓⛓ PROCGEN PoC SLICE 3b — RESOLVE a `weigh` work order: ⚖ §11.8a's
 * **`press`** POST-CONDITION, which `resolveShoveStrategy`'s docblock named
 * two slices ago and left for whoever brought a puzzle step that wanted it.
 *
 * The difference from `shove` is ONE SENTENCE and everything else is shared:
 * a `shove` scans for the minimum `k` at which a CORRIDOR appears, and a
 * `weigh` has its destination handed to it by the mechanism — the presser's
 * own cell. So there is no scan for "how far", only the question of whether
 * some block can get there.
 *
 * ⛔ AND THE POST-CONDITION IS NOT `clear-path`, which is why it may not
 * borrow `deriveShove`. A `clear-path` derivation accepts the FIRST cell that
 * yields a corridor and would happily park the block one tile short of the
 * button, having satisfied its own question; the corridor here does not open
 * because the block moved out of the way, it opens because the block is
 * STANDING ON SOMETHING. Two post-conditions, two derivations, ONE `runShove`
 * — which is the split §11.7's law actually asks for.
 *
 * ⚠ THE ORDER IS NOT ARBITRARY: the resolution is only reached once
 * `refineStrategy` has ruled the `hold` impossible, so "the block is the only
 * way" is established before a block is looked for, not assumed by having
 * looked.
 */
function resolveWeighStrategy(run, obstacle, contacts, blocked = []) {
    if (run.pushables === null) return null;
    const opener = openerPresserFor(run, obstacle);
    if (!opener) return null;
    const presser = opener.presser;
    /**
     * ⚠ THE PRESSER'S TILE, NOT ITS RECT. A `Button`'s hitbox is 8x6 offset
     * inside its 16x16 cell (`Button.as:22`, `setHitbox(8, 6, 4, 3)`), and a
     * block is a full 16x16 on the cell — so "the block covers the button" and
     * "the block is on the button's tile" are the same claim, and the tile is
     * the one of the two `runShove` can be given.
     */
    const onto = {
        tx: Math.floor(presser.x / TILE_SIZE), ty: Math.floor(presser.y / TILE_SIZE),
    };
    const derived = deriveWeigh(run, onto, contacts, blocked);
    /**
     * ⛓⛓⛓ **THE DWELL ARM — PROCGEN ELEMENTS arc 3, slice S1, gap 3.**
     *
     * A gadget can arrive ALREADY SOLVED: the block is on the button before the
     * first tick, so the group publishes on tick 1 and the lock's fade runs from
     * there. `deriveWeigh` finds no lean to order — there is no distance — and
     * before S1 that fell through to the parent's `hold`, whose stance is the
     * button's own cell, WHICH THE BLOCK OCCUPIES. So the one room whose puzzle
     * was already done refused at a stance nobody needed to stand in
     * (slice 3 D1(a) ARM 5, arc-3 §10.3 gap 3).
     *
     * ⇒ resolve to the weigh MINUS its shove: `runDwell` alone, waiting out the
     * SAME fade `deriveHold` computes, with **no stance at all** — the presser is
     * held by the block and the player need not stand anywhere. The consumer
     * already treats `stance` as optional (`if (plan.resolved.stance)`), so
     * "nowhere to stand" is expressible without a second walk shape.
     *
     * ⛔ `runDwell`'s SHUT-BEFORE REFUSAL IS LEFT ARMED, exactly as `execWeigh`'s
     * docblock argues for the shove arm: it fails by name if the group is ALREADY
     * open when the dwell starts. Here that is a sharper control than there — it
     * is precisely the claim "the block's press has not yet been redeemed" — and
     * a branch that swallowed it would report a vacuous success on a lock that
     * was never shut. [[feedback_graceful_fallback_vacuous_replay]]
     *
     * ⚠ AND IT DOES NOT PREEMPT A REAL LEAN. The arm is reached only when
     * `deriveWeigh` found NO plan, so a room where some other block can still be
     * shoved onto the presser takes the shove; only a room where the sole answer
     * is the block already sitting there dwells.
     */
    if (!derived.plan && derived.parked) {
        const resolvedPresser = resolvePresser(run.world, { x: presser.x, y: presser.y },
            `solverBot weigh/dwell (${obstacle.id})`);
        const hold = deriveHold(run, resolvedPresser, opener);
        return {
            strategy: 'weigh',
            postCondition: 'press',
            dwellOnly: true,
            target: { x: presser.x, y: presser.y },
            /**
             * ⛓ THE RECORD STILL NAMES THE BLOCK AND THE BUTTON, because the
             * lifted claim is read from the record and "which block is on which
             * button" is the whole of what it asks. `sinceTick` is 0 and it is
             * not a guess: the block is where the LEVEL RECORD put it and no
             * tick of this run has moved it.
             */
            parked: {
                block: derived.parked.blockId,
                tile: { ...onto },
                from: { ...derived.parked.from },
                sinceTick: 0,
            },
            dwell: {
                ticks: hold.ticks,
                until: hold.until,
                why: `${derived.parked.blockId} was parked on `
                    + `${presser.tag}@${presser.x},${presser.y} before the first tick and is `
                    + 'not going to walk off it — `Button.update` re-collides '
                    + '`["Player","Enemy","Solid"]` EVERY tick (`Button.as:27-39`) and a '
                    + '`PushableBlock` is a `"Solid"` (`PushableBlock.as:27`). There is no '
                    + 'lean to order, so this is the weigh MINUS its shove: the player '
                    + 'waits out the fade wherever the walk left them.',
            },
            rejected: [{
                option: 'shove the block onto the presser',
                why: `${derived.parked.blockId} is ALREADY on (${onto.tx},${onto.ty}) — `
                    + '`runShove` refuses a lean that moves nothing by name, and a verb '
                    + 'whose check cannot fail is not a verb',
            }, {
                option: 'hold',
                why: `the parent's fallback would put the stance on `
                    + `${presser.tag}@${presser.x},${presser.y}'s own cell, which the BLOCK `
                    + 'occupies — the pre-solved gadget is exactly the room where the hold '
                    + 'has nowhere to stand (arc-3 §10.3 gap 3)',
            }, ...derived.rejected, ...opener.rejected],
        };
    }
    if (!derived.plan) {
        /**
         * ⛔⛔⛔ `weigh` PREEMPTS `hold`; IT DOES NOT REPLACE IT — and L16 is
         * the room that had to say so.
         *
         * The first cut gated `hold` off entirely whenever the group's
         * pressers all republish, on the reasoning that such a hold cannot
         * outlive the walker. That reasoning is right about the MECHANISM and
         * wrong as a SELECTION rule, because it silently narrows what the
         * policy can bind: `weigh` needs a block that shares an axis with the
         * presser and `hold` needs nothing at all, so a room with a
         * non-latching lock and no usable block went from "walk to the
         * button, climb the ladder, refuse at the top with the combat rung's
         * own reasons" to "refuse immediately, strategy failed to apply".
         *
         * ⛓ MEASURED, not reasoned: L16 carries `lock@320,112 tset=1`,
         * `button@272,48` and `pushableblock@256,80` — the block is at tile
         * (16,5) and the button at (17,3), so it shares NEITHER coordinate
         * and no single lean reaches it (the room wants a CHAIN, which
         * nobody has ruled on — kickoff §10.7's named unbuilt shape). The
         * replacing gate turned that room's refusal from *"the combat ladder
         * is EXHAUSTED"* into *"Strategy 'weigh' failed to apply"*, which is
         * a committed room made strictly less informative by a slice that
         * predicted it would not move at all.
         *
         * ⇒ the fallback is what makes the addition ADDITIVE: where a block
         * can reach the presser the new verb takes the room, and everywhere
         * else the parent's answer stands, byte for byte. The weigh's own
         * refusals ride along in the hold's `rejected` list, so the trace
         * still says which blocks were considered and why none of them
         * served. [[feedback_conservative_ingredient_hides_bound_defects]]
         */
        return resolveHoldStrategy(run, obstacle, contacts, blocked, derived.rejected);
    }
    const { plan, rejected } = derived;
    const row = (run.world.pushables ?? []).find((p) => p.id === plan.blockId);
    const step = SHOVE_STEP[plan.dir];
    const stance = nodeCentre(plan.from.tx - step.dx, plan.from.ty - step.dy, DEFAULT_LATTICE);
    /**
     * ⛓ THE WAIT IS `deriveHold`'s, UNCHANGED. What the next plan needs is the
     * lock NOT SOLID, and that is the same fade for the same group whoever —
     * or whatever — is standing on the button. Deriving a second duration here
     * would be a second answer to a question the mechanism has already
     * answered (`deriveHold`'s own docblock makes exactly this argument about
     * the latch).
     */
    const resolvedPresser = resolvePresser(run.world, { x: presser.x, y: presser.y },
        `solverBot weigh (${obstacle.id})`);
    const hold = deriveHold(run, resolvedPresser, opener);
    return {
        strategy: 'weigh',
        postCondition: 'press',
        target: { x: presser.x, y: presser.y },
        shove: {
            block: { x: row.x, y: row.y },
            dir: plan.dir,
            to: { ...onto },
        },
        k: plan.k,
        stance,
        dwell: {
            ticks: hold.ticks,
            until: hold.until,
            why: `${plan.blockId} is parked on ${presser.tag}@${presser.x},${presser.y} and `
                + 'is not going to walk off it — `Button.update` re-collides '
                + '`["Player","Enemy","Solid"]` EVERY tick (`Button.as:27-39`) and a '
                + '`PushableBlock` is a `"Solid"` (`PushableBlock.as:27`), so the group '
                + 'stays published while the player waits out the fade beside it. L15 is '
                + 'the room the game built around this.',
        },
        rejected: [{
            option: 'hold',
            why: `${obstacle.id} answers to group t=${presser.t}, whose pressers are all `
                + 'plain republishing ones — `Button.update` assigns `activate` from '
                + 'whoever is standing there on EVERY tick, so the player who leaves to '
                + 'walk through has already shut the lock. Slice 3 measured the '
                + 'consequence: the walk spends its whole per-target budget grazing the '
                + 'lock it just opened.',
        }, {
            option: 'route-around',
            why: `${obstacle.id} is on the frontier of the reachable component, so there `
                + 'is no route around it',
        }, ...rejected, ...opener.rejected],
    };
}

/**
 * ⛓⛓⛓ PROCGEN PoC SLICE 3b — WHICH BLOCK CAN REACH THE BUTTON, and by
 * which lean.
 *
 * A shove moves a block along ONE axis away from the player (`runShove`
 * asserts it), so a block can reach `onto` at all only if it already SHARES
 * one of the two coordinates with it. That makes the search a filter rather
 * than a scan: at most one direction per block, and `k` is arithmetic.
 *
 * ⛔ EVERY INTERMEDIATE CELL IS ASKED, NOT JUST THE DESTINATION. `deriveShove`
 * gets this for free because it walks `k` upward and breaks; here `k` is
 * handed over, so the cells between are asked explicitly — a block that stops
 * dead against a solid on the way, or sinks into water on the way, never
 * arrives, and a derivation that only checked the endpoint would order a lean
 * that quietly does nothing (R8 slice 4's off-the-map guard is the same
 * defect one axis over: a destination the block physically cannot reach).
 *
 * ⚠ AND THE DESTINATION ITSELF MUST NOT SINK. A block destroyed on the
 * button presses nothing, and `blockSinksOn` is the same instrument
 * `deriveShove` asks — asked here of a cell it was handed rather than of one
 * it chose.
 */
function deriveWeigh(run, onto, contacts, blocked = []) {
    const bag = run.liveGeometryOpts();
    const planOpts = solverPlanOpts(run, contacts);
    const found = [];
    const rejected = [];
    /** ⛓ arc 3 slice S1 gap 3 — the block that is ALREADY on `onto`, if any. */
    let parked = null;
    const dirs = Object.keys(SHOVE_STEP);
    for (const row of (run.world.pushables ?? [])) {
        if (blocked.includes(row.id)) continue;
        if (row.family !== 'walk') {
            /**
             * ⛔ A `pushableblockfire` MOVES ON A PRESS, NOT ON A LEAN —
             * `resolveShoveStrategy`'s own refusal, repeated here because the
             * two resolvers reach the same block roster from different
             * questions and a silent skip would read as "no block in the room".
             */
            rejected.push({
                option: `weigh with ${row.id}`,
                why: `it is a \`${row.family}\` pushable — it moves on a PRESS, not on a `
                    + 'lean, and `runShove` is the lean',
            });
            continue;
        }
        const live = run.pushables?.get(row.id);
        if (!live || live.removed) continue;
        const from = {
            tx: Math.floor(live.rect.x / TILE_SIZE), ty: Math.floor(live.rect.y / TILE_SIZE),
        };
        if (from.tx === onto.tx && from.ty === onto.ty) {
            /**
             * ⛓⛓⛓ **ALREADY HOME — arc 3 slice S1 (gap 3), AND IT IS AN
             * OUTCOME, NOT A DEFECT REPORT.**
             *
             * This branch used to be a pure rejection on the reading that
             * `refineStrategy` only sends a lock here when its group is
             * UNPUBLISHED, so a block already on the presser meant the two
             * halves disagreed. They do not: `openActivators` is what
             * `refineStrategy` reads, and a lock whose block has been parked
             * since the room was BUILT is still shut at tick 0 — the fade
             * (`opensOnTick`, 101 ticks) has not run because no tick has. So
             * "the group is unpublished AND a block is on the button" is the
             * ordinary state of a pre-solved gadget on its first tick, and the
             * honest verb for it is the weigh MINUS its shove.
             *
             * ⛔ IT IS REPORTED SEPARATELY FROM `plan`, because "no block can
             * reach the presser" and "a block is already on it" are opposite
             * facts that both make `plan` null, and the caller's answers to
             * them are opposite too (`resolveWeighStrategy`: the parent's
             * `hold` fallback vs a dwell-only resolution).
             *
             * ⚠ THE REJECTION STAYS as well, so the trace still says why this
             * block was not SHOVED — `runShove` refuses a zero-distance lean by
             * name ("a shove that moves nothing is a check that cannot fail")
             * and a reader of the weigh's own reasons should still find that.
             */
            parked = parked ?? { blockId: row.id, from };
            rejected.push({
                option: `weigh with ${row.id}`,
                why: `it is ALREADY on (${onto.tx},${onto.ty}), so there is no lean to `
                    + 'order — `runShove` refuses a shove that moves nothing by name. The '
                    + 'press it is already making is what a DWELL waits out (arc 3 slice '
                    + 'S1 gap 3), and this derivation reports it as `parked` rather than '
                    + 'as a failure to reach',
            });
            continue;
        }
        const dir = dirs.find((d) => {
            const s = SHOVE_STEP[d];
            if (s.dx !== 0) return from.ty === onto.ty && Math.sign(onto.tx - from.tx) === s.dx;
            return from.tx === onto.tx && Math.sign(onto.ty - from.ty) === s.dy;
        });
        if (!dir) {
            rejected.push({
                option: `weigh with ${row.id}`,
                why: `it stands on (${from.tx},${from.ty}) and the presser is on `
                    + `(${onto.tx},${onto.ty}) — a lean moves a block along ONE axis, so a `
                    + 'block sharing neither coordinate cannot reach it in one shove',
            });
            continue;
        }
        const step = SHOVE_STEP[dir];
        const k = step.dx !== 0 ? Math.abs(onto.tx - from.tx) : Math.abs(onto.ty - from.ty);
        const stance = nodeCentre(from.tx - step.dx, from.ty - step.dy, DEFAULT_LATTICE);
        if (!corridorPlans(run.world, run.state, stance, null, planOpts)) {
            rejected.push({
                option: `weigh ${dir} with ${row.id}`,
                why: `the near-side stance (${stance.x},${stance.y}) does not plan a `
                    + 'corridor from the live position — a lean needs the player box on '
                    + 'the block\'s +-1 px probe with velocity INTO it, so a direction '
                    + 'whose stance is in another component is not a direction',
            });
            continue;
        }
        let blockedAt = null;
        for (let i = 1; i <= k; i += 1) {
            const cell = { tx: from.tx + step.dx * i, ty: from.ty + step.dy * i };
            if (blockSinksOn(run.world, cell)) {
                blockedAt = `(${cell.tx},${cell.ty}) is destructive terrain — the block is `
                    + `GONE there, so it never reaches (${onto.tx},${onto.ty})`;
                break;
            }
            if (blockBlockedAt(run, bag, row.id, cell)) {
                blockedAt = `(${cell.tx},${cell.ty}) is Solid to the block, which stops `
                    + 'dead against one';
                break;
            }
        }
        if (blockedAt) {
            rejected.push({ option: `weigh ${dir} k=${k} with ${row.id}`, why: blockedAt });
            continue;
        }
        found.push({ blockId: row.id, dir, dirIndex: dirs.indexOf(dir), k, from });
    }
    if (found.length === 0) {
        /**
         * ⛔ A ROOM WITH NO PUSHABLE AT ALL MUST SAY SO. Every branch above
         * pushes a reason, so an EMPTY list can only mean the roster itself
         * was empty — and "no block could reach the presser" and "the verb
         * was never considered" would then print the same thing, which is the
         * bounded-sweep defect exactly. The bound this sweep ran over is the
         * room's pushable roster, so the roster is what it names.
         * [[feedback_bounded_sweep_must_name_what_it_bounded]]
         */
        if (rejected.length === 0) {
            rejected.push({
                option: 'weigh',
                why: `level ${run.level} holds no pushable block at all, so there is `
                    + `nothing to park on (${onto.tx},${onto.ty}) — the verb was `
                    + 'considered and has no material to work with',
            });
        }
        return { plan: null, parked, rejected };
    }
    /**
     * ⛔ SMALLEST `k`, THEN THE TABLE'S OWN DIRECTION ORDER, THEN THE BLOCK'S
     * ID. The first key is the shortest lean; the last two exist because an
     * emitted tape is an artifact and a tie broken by roster order is a tie
     * broken by nothing (`deriveShove`'s own sort, one key shorter — there is
     * no destructive arm here because a destroyed block cannot press).
     */
    found.sort((a, b) => a.k - b.k || a.dirIndex - b.dirIndex
        || (a.blockId < b.blockId ? -1 : 1));
    const [plan, ...alternatives] = found;
    return {
        plan,
        parked,
        rejected: [
            ...alternatives.map((a) => ({
                option: `weigh ${a.dir} k=${a.k} with ${a.blockId}`,
                why: `also reaches the presser, and is ${a.k - plan.k} tile(s) longer or `
                    + 'later in the direction order',
            })),
            ...rejected,
        ],
    };
}

/**
 * ⛓⛓⛓ R8 SLICE 7 — A PLACEMENT INSIDE A SOLID IS AN **OBSTACLE**, NOT A
 * STANCE PROBLEM, and L19 is where the difference bites.
 *
 * `bosskey@96,64` sits at tile (6,4), which is INSIDE `shieldboss@80,32`'s
 * 48x48 body — the wall, the key and the exit are one object (R6 §13.6). The
 * ring search in `deriveStance` finds a perfectly good cell two rings away and
 * a corridor to it, so the goal looks resolved; then `runCollect` walks at the
 * pickup and the sweep dies on the body, three ticks from the key.
 *
 * ⇒ the reachability of the PLACEMENT is a separate claim from the
 * reachability of a stance near it, and it is asked here. ⚠ Asked with the
 * avoid volumes OFF, because the pickup's own volume is one of them and the
 * question is what ELSE is in that cell.
 */
function placementBlocker(run, resolved, contacts) {
    const t = resolved.target;
    const centre = t.rect
        ? { x: (t.rect.x + t.rect.right) / 2, y: (t.rect.y + t.rect.bottom) / 2 }
        : { x: t.x, y: t.y };
    const hit = plannerObstacleAt(run.world, centre.x, centre.y, null,
        solverPlanOpts(run, contacts, {
            avoidVolumes: false, nodeMargin: 0, triggerMargin: 0,
        }));
    if (!hit) return null;
    if (hit.kind === 'terrain' || hit.kind === 'pit' || hit.kind === 'lethal-terrain'
        || hit.kind === 'teleporter') return null;
    const b = hit.blocker ?? {};
    const tag = b.tag ?? b.cls?.as3 ?? b.name ?? null;
    if (typeof tag === 'string' && tag.startsWith('tile:')) return null;
    /**
     * ⛔⛔ THE TARGET IS NOT ITS OWN BLOCKER, and G1 caught me: a CHEST is a
     * Solid with a probe line, so a `collect-placement` naming one resolves to
     * a placement that is inside a solid — itself. The first cut reported
     * `chest@32,48` as the obstacle standing in the way of `chest@32,48` and
     * refused L11, a room this solver has crossed since slice 2.
     *
     * ⇒ the question is what ELSE is in that cell. Asked by identity against
     * the resolved target rather than by tag, because two chests in one room
     * would be two different obstacles.
     */
    const id = b.id ?? `${tag ?? '?'}@${b.x ?? '?'},${b.y ?? '?'}`;
    const own = t.id ?? `${t.tag ?? '?'}@${t.x},${t.y}`;
    if (id === own || (b.x === t.x && b.y === t.y)) return null;
    return { kind: hit.kind, tag, id };
}

/** The solver's planning options: the FULL bag, volumes on, live keys. */
function solverPlanOpts(run, contacts, extra = {}) {
    return {
        liveBag: run.liveGeometryOpts(),
        avoidVolumes: true,
        keys: run.keys,
        contacts,
        lattice: DEFAULT_LATTICE,
        ...extra,
    };
}

/**
 * ⛓⛓⛓ R8 SLICE 4 — THE LANES A PLAN UNPUBLISHES BY ITS OWN FIRST STEP.
 *
 * `arrowDanger` prices an ARMED trap's lane at horizon 0 and it is right to
 * (§9.9 decision 2). But a plan made FROM A BUTTON has a first act — stepping
 * off it — and `Button.update` republishes its group EVERY TICK, so the group
 * goes false on that same tick and the lanes the probe is refusing will not
 * be firing while the player is anywhere near them.
 *
 * ⛔ SO THE EXCLUSION IS DERIVED FROM WHERE THE PLAYER IS STANDING, never
 * carried in a set somebody has to remember to clear. It is empty the instant
 * the player is not on a presser, which is exactly when the lanes are real
 * again — a durable "I killed things here once" exemption would have hidden a
 * live ceiling for the rest of the segment.
 *
 * ⛓ AND ONLY THE LANE HALF IS EXCLUDED. `arrowDanger`'s OTHER half — the
 * arrows ALREADY IN FLIGHT — keeps its own ids and stays priced, because
 * leaving the button stops the next volley and not the last one. That split
 * is trap 160's law honoured rather than repeated: the STATE layer answers
 * the state question, and the thing in the air is not a state question.
 */
function lanesUnpublishedByLeaving(run) {
    /**
     * ⛔⛔⛔ AND THE COLUMN MUST BE EMPTY FIRST — WHICH THE GAME HAD TO SAY,
     * BECAUSE THE FIRST CUT OF THIS FUNCTION WAS WRONG AND ONLY A RECORDING
     * COULD SHOW IT.
     *
     * The first reading excluded a lane whenever the player stood on the
     * presser, on the reasoning above. It is right about the NEXT volley and
     * silent about the last one: `r8-solve-5`'s first recording walked east
     * out of `button@48,48` straight through `arrowtrap@64,48`'s column with
     * 22 arrows still falling, and the GAME knocked the player back at
     * t≈206 (`hits` 1 against the model's 0, first divergence at 207, 41 dead
     * frames out of band). ⛔ THE TAPE WAS NOT COMMITTED — it is banked in
     * `NewDocs/plans/r8-slice4-l5-refuted/` as the free oracle it is.
     *
     * Slice 4's answer was to gate the exclusion on the column being EMPTY.
     * That is right, and it WALLS the room: the player cannot leave the button
     * while the column is full, and the column cannot empty while they stand
     * on it (§13.2's deadlock, exactly).
     *
     * ⛓⛓⛓ R8 SLICE 5 REMOVES THAT GATE, because the question it was paying
     * for is now asked somewhere it can be answered. The empty-column
     * condition was the STATE layer standing in for a KINEMATIC one — "will an
     * arrow be at this cell when I am" — and ⚖ §13.10a's transit probe asks
     * that per cell at that cell's own ETA, against a forecast that steps the
     * traps AND the arrows along the previewed walk. So this function goes
     * back to answering only its own question: *is this group published right
     * now, and does the walk's first act unpublish it*. The arrows already in
     * the air, and every volley the walk itself causes, are priced by the
     * probe rather than by a proxy.
     * [[feedback_two_cost_models_must_agree]]: the fix is not to make one
     * layer conservative enough to cover the other — it is to build the layer
     * that was missing.
     */
    const box = playerBoxAt(run.state.x, run.state.y);
    const groups = new Set((run.world.pressers ?? [])
        .filter((p) => rectsOverlapLocal(box, p.rect)).map((p) => p.t));
    if (groups.size === 0) return null;
    const ids = (run.world.arrowTraps ?? []).filter((t) => groups.has(t.t)).map((t) => t.id);
    return ids.length > 0 ? new Set(ids) : null;
}

/**
 * SENSE the contacts the player is standing in RIGHT NOW — the reactive
 * replacement for a leg spec's hand-authored `contacts` list. A leg declared
 * them because an arrival is not a position the planner chose; the solver
 * simply looks: the player is standing there whatever anyone thinks about
 * it, so whatever volumes overlap the live position are this plan's
 * exemptions. Re-sensed at every plan, from the live position, so a stale
 * exemption cannot survive a re-plan.
 */
function senseContacts(run) {
    return new Set(contactsAt(run.world, run.state.x, run.state.y,
        { avoidVolumes: true, keys: run.keys }));
}

/**
 * ⛓⛓⛓ R8 SLICE 5 — THE WALK THE CONTROLLER WOULD DRIVE, PREVIEWED.
 *
 * ⚖ §13.10a: a corridor is validated PER CELL AT THAT CELL'S ETA, and the ETAs
 * come from the controller's own arithmetic. So this is not a sampler with a
 * speed model bolted on — it is `drive`'s own loop with `run.advance` swapped
 * for the run's own PURE stepper: the same `chooseHeld`, the same tolerance,
 * the same `hasArrived`, the same `stepV2` options. Two movement models would
 * be two schedules, and a probe checked against a schedule nobody drives is a
 * probe of nothing (trap 118, on the time axis).
 *
 * ⛔ WHAT IT DOES NOT SIMULATE, NAMED RATHER THAN LEFT TO BE DISCOVERED: the
 * world's own steppers. The previewed player walks through a world frozen at
 * this tick's geometry — blocks do not glide, locks do not open, and a hit
 * does not happen (the whole point is to find out whether one WOULD). That is
 * why the ETAs are a HEURISTIC and why ⚖ §13.10a point 3 keeps the per-tick
 * next-cell check live: the probe prunes, the tick adjudicates.
 *
 * ⛔ AND IT TRUNCATES RATHER THAN GUESSES. A preview that cannot reach a
 * waypoint inside `DEFAULT_MAX_TICKS_PER_TARGET` — a wall the frozen geometry
 * has and the real walk will not, a controller limit cycle — stops there and
 * says so. The samples it did take are still checked; what it must not do is
 * invent the rest of the schedule, because an ETA nobody could reach is an ETA
 * that clears any cell you like.
 *
 * @returns {{samples: Array<{x,y,tick}>, startTick: number, truncated: ?object}}
 */
/**
 * ⛓⛓⛓ R9 SLICE 12c′, ⚖ RULING 41 — **THE ROSTER-WIDE DASH PERMISSION, ONE
 * FLAG STATE AND NO PER-ROOM LITERAL** (user, 2026-08-23: *"I want to make the
 * change roster wide, not limited to level 14."*).
 *
 * ⛔ IT IS THE PERMISSION, NOT THE CHOICE. What it permits is a press
 * `planSwordDash` SCHEDULED; the opportunistic dash is refused under either
 * state (`strikePolicy`'s header says why, and §27.7 is the measurement:
 * the flag alone took `r9-solve-14` from 145 t to 400 t). So flipping this
 * changes what the LADDER MAY ASK FOR, and the planner still decides press by
 * press.
 *
 * ⛓ A `dashPlan` handed to `strikePolicyFor` directly IS its own permission,
 * which is what lets the offline proof run at a `false` head: the plan and the
 * flag are the same grant said two ways, and `walkTo` only ever builds a plan
 * when this is true — so at `false` no committed corridor can reach one.
 */
export const ALLOW_DASH_ROSTER_WIDE = false;

/**
 * ⛓⛓⛓ R9 SLICE 12b — **THE ONE PLACE A STRIKE POLICY IS CONSTRUCTED.**
 *
 * ⚖ Ruling 30(c): what the probe certifies must be what the walk does. That is
 * a claim about two objects being the SAME object in every respect that
 * matters — so neither `previewWalk` nor `drive` builds one, and both are
 * handed one built here. A second construction site is a second set of
 * defaults, and defaults that differ by one flag are exactly how a certified
 * corridor stops being the walked one.
 *
 * ⛔ RETURNS `null` WHEN THE ROOM CANNOT PRODUCE A STRIKE, so the caller's
 * fast path is unchanged and a room with no sword or no bodies pays nothing:
 * `run.strikeBodies` is empty under `noclip`/`noDamage` by construction (the
 * gate `stepChasersNow` opens with — trap 563), and without a sword `set
 * slashing`'s outer gate refuses every press anyway.
 */
export function strikePolicyFor(run, { dashPlan = null } = {}) {
    const hasSword = run.inventory?.hasSword || run.inventory?.hasGhostSword || false;
    if (!hasSword) return null;
    /**
     * ⛔ A PLANNED DASH IS A MOVE, AND A MOVE DOES NOT NEED A BODY. The
     * body-count fast path below is right for a STRIKE policy — with nothing
     * in reach `decide` only ever hands back the walk's own keys — but a
     * `dashPlan` presses for DISPLACEMENT, so a room with no bodies is exactly
     * where its whole schedule would be spent. Returning `null` there would
     * make `planSwordDash`'s plan silently unwalkable (⚖ ruling 30(c): the
     * preview would carry it and the drive would not).
     */
    if (!dashPlan && (run.strikeBodies ?? []).length === 0) return null;
    return createStrikePolicy({
        facingToward, facingKeys: FACING_KEYS, hasSword, dashPlan,
        allowDash: dashPlan ? true : ALLOW_DASH_ROSTER_WIDE,
    });
}

/**
 * ⛓ EXPORTED FOR ONE REASON, and it is the same reason `facingToward` and
 * `FACING_KEYS` are: the claim that repairs this slice is an EQUALITY between
 * this function and `botDriverV2.drive`, and an equality asserted against a
 * re-implementation of one side is an assertion about the re-implementation.
 * `solverBot.test.js` calls both, from one starting state, and compares the
 * held-set sequences.
 */
export function previewWalk(run, wps, tolerance = 0, { strike = null, standFor = 0 } = {}) {
    const startTick = run.ticksCompleted;
    const step = run.previewStepper();
    /**
     * ⛓⛓⛓ THE ARROWS ADVANCE ON THE SAME CLOCK AS THE WALK, AND THE WALK IS
     * WHAT DECIDES WHETHER THE TRAPS FIRE.
     *
     * A forecast of the arrows already in the air is not enough, and
     * `r8-solve-5` is the receipt: the arrow that hit did not exist when the
     * plan was made — it was fired by a trap the walk was still standing on.
     * So the two are stepped together, and each sample carries the arrow rects
     * as of ITS OWN tick. `run.arrowForecast()` is the run's own subsystem, not
     * a second copy of it.
     */
    const forecast = run.arrowForecast?.() ?? null;
    /**
     * ⛓⛓⛓ R9 SLICE 12 — **AND THE CHASERS ADVANCE ON THAT SAME CLOCK**, which
     * is the arrows' own sentence one ingredient over and for the same reason.
     *
     * A forecast of the bodies where they STAND is not enough, and the route
     * survey's L14 walk is the receipt: the corridor was probed against
     * `bob@96,48` at (96,48) and the body was at (113.7, 56.1) — seventeen
     * pixels east, having chased the player the whole way — when it landed the
     * hit at tick 44. An arrow is autonomous and a chaser is PLAYER-COUPLED, so
     * the coupling is exactly what a forecast over a CANDIDATE PATH can supply
     * and a live reading cannot: the bodies are stepped against the previewed
     * player, per tick, so each sample carries the bodies as of ITS OWN tick.
     * `run.chaserForecast()` is the run's own subsystem, not a second copy of
     * it — same `chaserStep`, same order, same solids.
     */
    const chasers = run.chaserForecast?.() ?? null;
    /**
     * ⛔⛔⛔ R9 SLICE 12b — **THE STRIKE POLICY SEES THE PREVIOUS TICK'S
     * BODIES, ON BOTH SIDES, AND THAT IS THE ONLY READING A DRIVER CAN HAVE.**
     *
     * The measurement that forced this: the first cut handed `decide` the
     * bodies `chasers.step(st)` had just produced, and the preview/drive
     * equality diverged at tick 10 with 8 strikes against 6.
     *
     * `stepChasersNow` runs ABOVE `stepV2` in the run's own tick, so by the
     * time the GAME's `useItem` reads the world the bodies HAVE moved this
     * tick — which makes the post-step reading the more accurate one about
     * where the rect will land. ⛔ AND IT IS UNAVAILABLE. A driver commits its
     * keys for tick k BEFORE tick k runs; `drive` can only ask
     * `run.strikeBodies`, which is what tick k-1 left. A probe that certified
     * a corridor using information the walk cannot have would certify
     * corridors the walk cannot keep — pricing a walk nobody takes, one tick
     * wide.
     *
     * ⇒ the preview LAGS its own forecast by one step for the policy's
     * question only. The DANGER sampling below is untouched and still pairs
     * the post-step bodies with the pre-move player, which is the game's own
     * pairing and a different question.
     */
    let bodiesForPolicy = strike ? (run.strikeBodies ?? []) : null;
    /**
     * ⛓⛓⛓ R9 SLICE 12c — **THE PREVIEW THREADS THE PLAYER'S OWN SLASH STATE**,
     * which is the second of the two things 12b′ measured the preview/drive gap
     * to be (finding 2: the preview never called `slashSet`).
     *
     * ⛔ WHY IT IS NOT OPTIONAL ANY MORE. `set slashing`'s dash branch adds a
     * +2 impulse the DRIVE spends through `stepV2` and the preview did not
     * carry — 9 px per dash (§23.11), on a corridor the danger map priced
     * without them. 12b′'s answer was to REFUSE the press (`allowDash: false`);
     * ⚖ ruling 35's answer, and this slice's, is to MODEL it, so that the
     * corridor the probe certifies is the corridor the drive walks even when
     * the walk dashes.
     *
     * ⛓ THE ORDER IS `advance`'s OWN, and it has to be: `slashTimerTick` at the
     * TOP of the tick (`levelRun.js:13020`, `Player.slash()`'s first two lines,
     * above `super.update()`), the press inside `input()` (`:13129`), the
     * impulse spent by this tick's sweep (`:13177`), and `slashEnd()` BELOW it
     * (`:13362`, from `sprites()`). Any other order re-arms the dash on the
     * wrong tick.
     *
     * ⚠ THE GATE'S TWO WINDOWS ARE AGED, NOT FROZEN. `run.slashInfo` carries
     * their end ticks for exactly this; nothing in a preview can open one
     * (see its docblock). `spearing` is a first-tick fact only — a spear
     * `pendingThrust` live at the preview's start is consumed by that tick's
     * `applyThrust` and nothing here creates another.
     */
    const slashLive = strike ? run.slashInfo : null;
    let slashState = slashLive ? slashLive.state : null;
    let slashEndsAt = slashLive ? slashLive.endsAt : null;
    let spearPending = slashLive ? slashLive.gate.spearing : false;
    const gateAt = (t) => ({
        hasSword: slashLive.gate.hasSword,
        hasGhostSword: slashLive.gate.hasGhostSword,
        wanding: t <= slashLive.openUntil.wanding,
        firing: t <= slashLive.openUntil.firing,
        deathRaying: false,
        spearing: spearPending,
    });
    /**
     * ⛓⛓ ONE TICK OF THE COMBAT STATE, WRITTEN ONCE. The TRANSIT loop and the
     * standing TAIL both consult the policy, and 12b′ already paid for the two
     * being separate code (`runDwell` dropped an options key its sibling
     * carried). A dash model split across two copies is where the next one
     * rots, so both call these.
     *
     * `at` is `ticksCompleted` — the count BEFORE the tick runs, which is the
     * convention `drive` passes and the policy's `owed` window is measured in.
     */
    const combatBefore = (state, at, walkHeld) => {
        if (!strike) return { held: walkHeld, dashImpulse: null };
        const gate = gateAt(at);
        let held = walkHeld;
        let decision = null;
        // ⛔ THE POLICY IS ASKED WITH THE STATE THE PREVIOUS TICK LEFT, above
        // this tick's `slashTimerTick` — which is where `drive` asks it from,
        // and `slashPressForecast` does the ageing itself.
        /**
         * ⛔⛔ R9 SLICE 12c′ — **THE POLICY IS ASKED ON EVERY TICK IT IS ARMED
         * FOR, NOT ONLY ON THE TICKS THAT HAVE BODIES.**
         *
         * The first cut consulted it only while `bodiesForPolicy` was truthy,
         * and `chasers.step` returns `null` in a room with no chaser forecast
         * at all — so after the FIRST tick the policy was never asked again.
         * Harmless while every press needed a body in reach; MEASURED as soon
         * as one did not: a planned dash chain scheduled four presses in a
         * body-free room and the walk took exactly ONE, the opening swing,
         * with zero yields and zero refusals to explain it.
         *
         * ⛓ IT IS BYTE-INERT FOR THE STRIKE ARM: `decide` with an empty body
         * list scans nothing, chooses nothing and hands back the walk's own
         * keys, which is what the skipped call did.
         */
        if (strike && !state.fall) {
            decision = strike.decide(state, bodiesForPolicy ?? [], at, walkHeld, {
                slash: { state: slashState, endsAt: slashEndsAt, gate },
            });
            held = decision.held;
        }
        // ── the tick's own top: `Player.slash()`'s first two lines ───
        slashState = slashTimerTick(slashState);
        let dashImpulse = null;
        if (decision && decision.decision === STRIKE_PRESS) {
            const r = slashSet(slashState, {
                pressed: true,
                ...gate,
                direction: state.direction ?? 0,
                vx: state.vx ?? 0,
                vy: state.vy ?? 0,
            });
            slashState = r.state;
            if (r.outcome === 'slash' || r.outcome === 'dash') {
                slashEndsAt = at + SLASH_ANIM_TICKS[slashState.anim];
            }
            if (r.outcome === 'dash') dashImpulse = r.impulse;
            // ⚠ ONE TICK LATE, exactly as the run is: `Player.update`
            // calls `slash()` ABOVE `super.update()`, so the press on
            // this tick fires its rect on the next one. The forecast is
            // told at the press and the body is struck here because the
            // preview has no second pass — which makes the previewed
            // hit land one tick EARLY against the drive's. Named
            // rather than hidden: it moves a knocked body 1 tick of
            // its own travel (~0.22 px), and the equality row below
            // measures whether that is visible in the held-set
            // sequence, which is the thing the corridor is made of.
            /**
             * ⛓ R9 slice 12c′ — EVERY BODY THE RECT COVERS, not only the
             * named one. A STRIKE press names its single aimed target (which
             * is what every committed corridor was priced with, and §23.8 is
             * why none can tell the two apart); a PLANNED press swings along
             * the player's own travel and hands back the whole covered set.
             */
            for (const id of (decision.targets ?? [decision.target])) {
                if (id !== null && id !== undefined && chasers) chasers.hit(id, state);
            }
        }
        // A spear thrust live at the preview's start is consumed by the first
        // tick's `applyThrust`; nothing here creates another.
        spearPending = false;
        return { held, dashImpulse };
    };
    /** `slashEnd()`, and it is BELOW the step for `sprites()`' own reason. */
    const combatAfter = (at) => {
        if (!strike) return;
        if (slashEndsAt !== null && at >= slashEndsAt) {
            slashState = slashSet(slashState, { pressed: false, ...gateAt(at) }).state;
            slashEndsAt = null;
        }
    };
    let st = { ...run.state };
    let tick = startTick;
    const samples = [];
    let truncated = null;
    let wpIndex = -1;
    for (const wp of wps) {
        wpIndex += 1;
        let spent = 0;
        while (!hasArrived(st, wp, tolerance)) {
            if (spent >= DEFAULT_MAX_TICKS_PER_TARGET) {
                truncated = {
                    kind: 'stalled',
                    at: { x: wp.x, y: wp.y },
                    why: `the preview spent ${spent} tick(s) without arriving — the walk `
                        + 'is checked as far as it was previewed and no further',
                };
                break;
            }
            // ⛔ THE TRAP READS THE PLAYER BEFORE THE PLAYER MOVES, exactly as
            // the live tick does — `stepArrowTrapsNow` runs above `stepV2`.
            tick += 1;
            spent += 1;
            const arrows = forecast ? forecast.step(st) : null;
            /**
             * ⛔⛔ THE SAMPLE IS THE PRE-MOVE BOX, PAIRED WITH THE ARROWS THAT
             * HAVE ALREADY MOVED — which is the game's own pairing and not a
             * convention. An `Arrow` is run-time-added and therefore PREPENDED,
             * so it updates before the Player: its hit test runs at its
             * post-move position against the player box the previous tick left.
             * Sampling the post-move player against the same arrows would test
             * a pair that never meets.
             *
             * ⚠ SO THE FINAL ARRIVAL CELL IS NOT SAMPLED HERE. Standing there
             * is a WAIT question (trap 154) and `dangerNow`/the stance checks
             * own it; this is the TRANSIT half.
             */
            // ⛔ THE BODIES ARE STEPPED BEFORE THE SAMPLE IS TAKEN, and the
            // pairing is the game's: `stepChasersNow` runs ABOVE `stepV2`
            // and reads `state` — the PRE-move player — so a body's contact
            // this tick is tested at its POST-move position against the box
            // the previous tick left. Sampling the post-move player against
            // the same bodies would test a pair that never meets, which is
            // the arrows' note verbatim and true here for the same reason.
            const chaserBodies = chasers ? chasers.step(st) : null;
            // ⛓ R9 slice 12c′ — the sample carries WHICH LEG it belongs to, so a
            // caller can measure a corridor's own length rather than the whole
            // walk's. ⚖ Ruling 30(c) holds over a corridor's LENGTH (§27.8,
            // trap 587), and a bound nobody can evaluate per leg is a bound
            // nobody can respect.
            const sample = { x: st.x, y: st.y, tick, arrows, chasers: chaserBodies, wp: wpIndex };
            samples.push(sample);
            // ⛔ `drive`'s own line, including the transport arm: a player in
            // flight presses nothing, and a preview that steered through a
            // fall would schedule ticks the game ignores.
            let held = st.fall ? new Set() : chooseHeld(st, wp, tolerance);
            /**
             * ⛓⛓⛓ R9 SLICE 12b — **THE OPPORTUNISTIC STRIKE, ON THE PROBE
             * SIDE OF THE ONE POLICY** (⚖ ruling 30(c)).
             *
             * This is the same object `drive` consults, asked the same
             * question with the same shape of body, so the corridor is
             * CERTIFIED WITH the strikes the walk will actually make — the aim
             * ticks it spends, the presses it lands, and the knockback each
             * one deals. A probe that priced a corridor without them would be
             * pricing a walk nobody takes, which is the defect the chaser
             * forecast itself was built to end, one mechanism further in.
             *
             * ⛔ THE PRESS IS APPLIED TO THE FORECAST'S BODY. `chasers.hit`
             * runs `enemyHit` on the previewed body: a non-killing hit throws
             * it back by `SWORD_FORCE` and arms its 30-tick i-frame, the third
             * kills it, and it leaves the danger set after its death staging.
             * So the samples AFTER a strike carry the room the strike made.
             */
            // ⛓ `tick - 1` because `tick` was incremented at the top of
            // this iteration while `drive` passes `run.ticksCompleted`,
            // the count BEFORE the tick runs. One counter, two
            // conventions — and the policy's `owed` window is measured in
            // ticks, so the two must agree or one walk gets two answers.
            const combat = combatBefore(st, tick - 1, held);
            held = combat.held;
            // ⛓ R9 slice 12b: the sample carries the KEYS this tick spends, so
            // the preview/drive equality row has both sides of its claim.
            sample.held = held;
            // The policy's next reading — see `bodiesForPolicy` above.
            if (strike) bodiesForPolicy = chaserBodies ?? [];
            st = step(st, held, { dashImpulse: combat.dashImpulse });
            combatAfter(tick - 1);
            if (st.transition) {
                // A crossing ends the preview: the next level is a different
                // world, and this map is scoped to `run.level`.
                /**
                  * ⛓ R9 slice 12c′ — `kind` NAMES WHICH TRUNCATION THIS IS.
                  * A CROSSING is the walk arriving; a STALL is a wall. They
                  * are the same field and opposite outcomes, and
                  * `planSwordDash` has to compare two walks' lengths — which
                  * it may do across crossings and must never do across a
                  * stall.
                  */
                truncated = {
                    kind: 'crossed',
                    at: { x: st.x, y: st.y },
                    why: `the preview crossed to level ${st.transition.to_level}; the `
                        + 'danger map is scoped to one room',
                };
                break;
            }
        }
        if (truncated) break;
    }
    /**
     * ⛓⛓⛓ R9 SLICE 12b′ — **THE STANDING TAIL, ON THE SAME FORECAST AND THE
     * SAME POLICY.**
     *
     * The kill rung's chaser arm walks to a stance and then WAITS there while
     * the body comes. Those are not two questions: the corridor TO the stance
     * spends ticks the bodies also spend, so a stance evaluated from the
     * room's tick-0 positions is a stance for a room nobody will be standing
     * in. ⛔ So the dwell is previewed as the walk's own TAIL — one
     * `chaserForecast`, one `arrowForecast`, one strike policy and one clock
     * — rather than by a second preview seeded from the live state.
     *
     * ⛔ THE WALK'S OWN KEYS ARE EMPTY HERE, WHICH IS `runDwell`'s CONTRACT
     * ("no WALK keys"), and the policy may still spend a direction key to
     * aim. That drift is REAL and it is stepped, not assumed away: `step` is
     * the run's own stepper, so the previewed stance wanders exactly as far
     * as the driven one will.
     *
     * ⚠ A TRUNCATED WALK GETS NO TAIL. The player is not where the caller
     * thinks, so standing "there" would be standing somewhere else.
     */
    if (!truncated && standFor > 0) {
        for (let i = 0; i < standFor; i += 1) {
            tick += 1;
            const arrows = forecast ? forecast.step(st) : null;
            const chaserBodies = chasers ? chasers.step(st) : null;
            const sample = { x: st.x, y: st.y, tick, arrows, chasers: chaserBodies,
                phase: 'dwell', wp: wpIndex };
            samples.push(sample);
            let held = st.fall ? new Set() : NO_HELD_PREVIEW;
            const combat = combatBefore(st, tick - 1, held);
            held = combat.held;
            sample.held = held;
            if (strike) bodiesForPolicy = chaserBodies ?? [];
            st = step(st, held, { dashImpulse: combat.dashImpulse });
            combatAfter(tick - 1);
            if (st.transition) {
                truncated = {
                    kind: 'crossed',
                    at: { x: st.x, y: st.y },
                    why: `the dwell crossed to level ${st.transition.to_level}; a dwell `
                        + 'that leaves the room undoes itself (trap 150)',
                };
                break;
            }
        }
    }
    return { samples, startTick, truncated, stood: standFor };
}

/**
 * ⛓⛓⛓ R9 SLICE 12c′ — **THE PREVIEW/DRIVE AGREEMENT BOUND** (§27.8, trap 587).
 *
 * ⚖ Ruling 30(c)'s equality — the preview and the drive spend the same keys —
 * is TRUE and it is BOUNDED. `previewWalk` has no second pass, so `chasers.hit`
 * runs at the press tick where the drive's `applyThrust` runs at press+1; 12b
 * priced that skew at ~0.22 px of one body's travel and asserted the equality
 * over a 42-tick corridor, where 0.22 px never reaches a held-set. On a LONG
 * stand it does: on L14's own boot the sequences part at tick **207** with the
 * roster default and at **144** with a dashing policy — a dash does not create
 * the divergence, it brings it 63 ticks earlier, because a moved player is
 * chased differently.
 *
 * ⛔ THE NUMBER IS A MEASUREMENT AND IT IS NOT ALLOWED TO DECAY QUIETLY
 * (trap 574): `solverBot.test.js`'s parting row asserts this constant is at or
 * below the index that fixture measures, so a model change that moves the skew
 * reds the row rather than silently loosening the bound this refuses against.
 *
 * ⛓⛓⛓ **R9 SLICE 12c″ BROUGHT IT DOWN — 144 → 79 — AND THE ROW IS WHAT
 * CAUGHT IT.** The harmless-window arm (⚖ ruling 44) turned a 30-tick-wide
 * refusal into a THRESHOLD on `hitsTimer`, and the two sides read that value
 * ONE TICK APART (the preview applies `chasers.hit` at the press tick where
 * `drive` applies it at press+1 — 12b's named skew). A blanket "any
 * `hitsTimer > 0` refuses" gives the same answer for a reading of 18 or 19; a
 * threshold does not, so one press per i-frame lands on the boundary and the
 * two sides take different presses. The dashing arm's parting fell 179 → 79;
 * the REFUSED arm's is 207 in every build, unmoved, which is what says the
 * cause is the arm and not the fixture.
 *
 * ⛓ **AND IT COSTS NOTHING, MEASURED**: under the scratch flip the longest
 * leg anywhere on the committed roster is 70 (`r9-solve-0`'s first), so 79
 * refuses no corridor that 144 accepted.
 *
 * ⚠⚠ **AND IT IS BOUNDING THE WRONG QUANTITY, WHICH THIS SLICE MEASURED AND
 * DID NOT FIX.** It bounds the longest LEG; the divergence accumulates over
 * the WHOLE WALK. `r9-solve-14`'s planned corridor has legs [48,32,36,5] —
 * every one inside 79 — and the DRIVE is hit at tick 75 of it. So this
 * constant is a necessary bound and not a sufficient one, and the sufficient
 * one is the two sides agreeing about `hitsTimer` in the first place.
 *
 * ⇒ `planSwordDash` certifies CORRIDOR BY CORRIDOR and refuses to schedule a
 * leg longer than this. A whole room previewed in one call would be certified
 * against a preview the drive stops matching.
 */
export const PREVIEW_AGREEMENT_BOUND = 79;

/**
 * ⛓⛓⛓ R9 SLICE 12c′ — **THE PRESS SCHEDULE OF A SUSTAINED DASH CHAIN**,
 * derived from the two constants that decide it rather than typed.
 *
 * `DASH_CHAIN` is `combatVerbs`' own derivation of what one `slashTimer`
 * window admits, run under the rules a CONTROLLER actually has (a rising-edge
 * key, `slashEnd` firing below the press): an opening ordinary swing, then
 * dashes at its own offsets. The window is `ORDINARY_SWING_PERIOD` long and a
 * dash does NOT refresh it, so the pattern repeats: swing, dashes, swing.
 */
export const DASH_CHAIN_PATTERN = Object.freeze([0, ...DASH_CHAIN.at]);

/**
 * ⛓⛓⛓ R9 SLICE 12c′, ⚖ RULING 35 — **`planSwordDash`: A PRESS TAKEN AS A
 * MOVE.**
 *
 * *"Safety is a higher priority than speed, but I would still like the solver
 * to dash to save time whenever there isn't a reason not to… I expect dashing
 * towards the exit to work better for level 14 than walking and sword
 * slashing."* (user, 2026-08-23).
 *
 * ── ⛔⛔ WHY THIS EXISTS AND THE FLAG DOES NOT DO IT ───────────────────
 *
 * §27.7 flipped `allowDash` alone and measured the result on the only campaign
 * room that can reach the branch: `r9-solve-14` went **145 t → 400 t**. The
 * dash model was right and the CHOOSER was wrong — a press taken because a body
 * is in reach buys a displacement along whatever travel the walk happened to
 * have, and the AVOID corridor must then be certified WITH it. Trap 589: an
 * arithmetic that prices a MOVE prices it under a policy that CHOOSES it for
 * that reason.
 *
 * ⇒ this chooses presses for the DISPLACEMENT they buy along the route. A
 * planned press needs no body, spends no aim tick and no direction key —
 * `set slashing`'s dash arm knocks the player back along their own VELOCITY,
 * so the walk simply adds `primary` to the keys it was already holding.
 *
 * ── ⛔ WHY IT IS NOT `mover.planDash` AND NOT IN `mover.js` ────────────
 *
 * `mover.planDash` is §3.3's TICK-OPTIMAL TRAVERSAL over `KEY_SETS` on
 * `stepV1`, and has nothing to do with the sword. A plan certified on `stepV1`
 * cannot be walked by a `stepV2` drive that spends a `dashImpulse`: the impulse
 * arrives as `useItemImpulse` ABOVE the tick's sweeps, so a V1 schedule and a
 * V2 drive differ by the whole 9 px of every dash plus every collision the
 * geometry decides — trap 118's exact shape, a schedule nobody drives. This is
 * built on `levelRun.previewStepper()`, which carries the impulse as of 12c.
 *
 * ── WHAT IT CERTIFIES — THE CORRIDOR THE DASH CREATES ─────────────────
 *
 * NOT the marginal 9 px: that stays `certifyDash`'s claim and is asked per
 * press, by the policy, on both sides. What THIS prices is the whole previewed
 * corridor WITH the schedule in it — arrows and chasers stepped per tick,
 * every strike's knockback applied — through the caller's OWN danger predicate
 * (`certify`), which is `walkTo`'s `probeCorridor`. One predicate, not a
 * second: a probe better informed than the walk certifies corridors the walk
 * cannot keep (trap 567).
 *
 * ⛔ AND IT IS BOUNDED, PER LEG. ⚖ Ruling 30(c) holds over a corridor's LENGTH
 * (§27.8, trap 587), so a candidate whose longest leg exceeds
 * `PREVIEW_AGREEMENT_BOUND` is REFUSED BY NAME rather than certified against a
 * preview the drive stops matching.
 *
 * ⛔ **AND A PLAN IS RETURNED ONLY IF IT IS FASTER.** ⚖ Ruling 35 puts safety
 * over speed and speed only where certification is free; a schedule that
 * certifies and does not shorten the walk is a refusal, not a plan.
 *
 * @param {object} run
 * @param {object[]} wps  the corridor the ladder just certified
 * @param {object} opts
 * @param {number} opts.tolerance  the tolerance `drive` will use
 * @param {?function} opts.certify `(samples) => hit|null` — the caller's own
 *   danger predicate over a previewed walk. Omitted, only the walk's own
 *   truncation and the leg bound are checked, which is what the offline proof
 *   uses.
 * @returns {{plan: ?object, ticks: ?number, saved: ?number, baseline: number,
 *   legs: ?number[], candidates: object[], why: ?string}}
 */
export function planSwordDash(run, wps, { tolerance = 0, certify = null } = {}) {
    const startTick = run.ticksCompleted;
    const candidates = [];
    const refuse = (why) => ({ plan: null, ticks: null, saved: null, baseline: null,
        legs: null, windows: null, scanned: candidates.length, candidates, why });
    /**
     * ⛔ NO SWORD, NO DASH — REFUSED FIRST AND BY NAME. `set slashing`'s outer
     * gate needs `hasSword || hasGhostSword`, so a press in a pre-sword room
     * is `gated` and buys nothing. §27.7 measured that this is TWELVE of the
     * campaign's twenty-three committed segments; asking each of them to
     * preview a whole corridor per candidate tick would be a scan whose answer
     * is known from one field.
     */
    if (!(run.inventory?.hasSword || run.inventory?.hasGhostSword)) {
        return refuse('this room holds no sword, so `set slashing`\'s outer gate refuses '
            + 'every press and no schedule can buy a single pixel');
    }
    const legsOf = (walk) => {
        const legs = [];
        for (const sample of walk.samples) legs[sample.wp] = (legs[sample.wp] ?? 0) + 1;
        return [...legs].map((n) => n ?? 0);
    };
    const previewFor = (dashPlan) => {
        const strike = strikePolicyFor(run, { dashPlan });
        return { walk: previewWalk(run, wps, tolerance, { strike }), strike };
    };
    const scheduleFor = (starts) => {
        const ticks = new Set();
        for (const at of starts) for (const d of DASH_CHAIN_PATTERN) ticks.add(at + d);
        return {
            ticks,
            starts: starts.slice(),
            why: `⚖ ruling 35: ${starts.length} dash window(s) at `
                + `${starts.map((t) => t - startTick).join(', ')} — each an ordinary swing `
                + `to open the ${ORDINARY_SWING_PERIOD}-tick window, then `
                + `${DASH_CHAIN.at.length} dash(es) at +${DASH_CHAIN.at.join('/+')}, each `
                + `carrying the player ${DASH_DISPLACEMENT.total} px further along their own `
                + 'travel',
        };
    };
    /**
     * ⛓ THE CONTROL IS THE SAME CALL. The baseline is the UNDASHED walk
     * previewed by this very function, so "faster" compares two runs of one
     * instrument rather than a number somebody carried in.
     */
    const base = previewFor(null).walk;
    const baseline = base.samples.length;
    /**
     * ⛔⛔ A CROSSING IS NOT A TRUNCATION IN THE SENSE THAT MATTERS. Every
     * `reach-exit` corridor ends by crossing and `previewWalk` stops there,
     * so reading any `truncated` as "no length to compare" refuses the whole
     * class this primitive exists for. MEASURED: the first cut did exactly
     * that on L14 and reported a baseline of 145 with an EMPTY candidate list,
     * which reads precisely like a planner that found nothing.
     */
    const crossed = base.truncated?.kind === 'crossed';
    if (base.truncated && !crossed) {
        return { ...refuse(`the UNDASHED corridor STALLS (${base.truncated.why}), so there `
            + 'is no length for a schedule to beat'), baseline };
    }
    /**
     * ⛓⛓⛓ **"DASH WHEREVER THERE IS NO REASON NOT TO", AS AN ALGORITHM**
     * (⚖ ruling 35, the user's own words). One left-to-right pass: at each
     * tick the walk is still running, ask whether opening a dash window HERE
     * certifies and shortens the corridor. It does — take it, and skip past
     * the window it opened, because two windows cannot overlap
     * (`slashTimer` is not refreshed by a dash). It does not — say why, step
     * one tick, ask again.
     *
     * ⛔ EARLIEST-FIRST RATHER THAN BEST-FIRST, and that is a choice with a
     * reason: a dash taken EARLY shortens the horizon every later forecast
     * has to price (⚖ ruling 35(b)), and each acceptance is re-measured
     * against the walk the previous ones produced — so the schedule is
     * greedy but never speculative.
     *
     * ⛔ THE SWEEP IS BOUNDED BY THE WALK'S OWN LENGTH and says so: `scanned`
     * is how many ticks were asked about, and every rejected one carries its
     * reason kind.
     */
    const windows = [];
    let current = baseline;
    let bestWalk = base;
    let at = startTick;
    while (at < startTick + current) {
        const plan = scheduleFor([...windows, at]);
        const { walk, strike } = previewFor(plan);
        const row = { at: at - startTick, ticks: walk.samples.length, certified: false };
        /**
         * ⛔⛔ **A PRESS TAKEN TO MOVE MAY NOT ALSO BE A STRIKE**, and this is
         * the rule the first driven run of this primitive bought.
         *
         * The greedy pass certified a schedule on L14 and the DRIVE then
         * refused to step at tick 73 — *"whether `bob@176,112` is on screen
         * depends on where inside `Game.shake`'s jiggle the camera landed"*.
         * The preview could not have seen it: `previewWalk` walks a world
         * frozen at the plan tick, so a shake the walk itself CAUSES is
         * invisible to it. What causes one is a hit.
         *
         * ⇒ a scheduled press exists for the DISPLACEMENT it buys; a hit is a
         * side effect that changes the room the corridor was certified for —
         * knockback, an i-frame, a death, a camera shake — and ⚖ ruling 35 puts
         * safety first. The STRIKE arm still strikes; the PLANNED arm must not.
         * ⛓ It is asked of the previewed policy's own rows, so it is the same
         * question on both sides of ⚖ ruling 30(c).
         */
        const struck = strike.plannedPresses.filter((r) => (r.targets ?? []).length > 0);
        /**
         * ⛓⛓ **WHAT THE SCHEDULE ACTUALLY BOUGHT**, carried on every candidate
         * row so a refusal can be read as a MECHANISM rather than a verdict.
         * A window that scheduled twenty presses and had nineteen YIELDED by
         * `certifyDash` is not the same finding as one whose dashes all landed
         * and still saved nothing — and "not faster" prints the same for both.
         */
        row.pressed = strike.plannedPresses.length;
        row.dashed = strike.plannedPresses.filter((r) => r.dash).length;
        row.yielded = strike.plannedSkipped.length;
        row.yieldedFirst = strike.plannedSkipped[0]?.plannedSkipped?.why ?? null;
        const legs = legsOf(walk);
        const longest = Math.max(0, ...legs);
        if (walk.truncated && walk.truncated.kind !== 'crossed') {
            row.kind = 'stalled';
            row.why = `the dashed corridor STALLS — ${walk.truncated.why}`;
        } else if (Boolean(walk.truncated?.kind === 'crossed') !== crossed) {
            row.kind = 'crossing';
            row.why = crossed
                ? 'the undashed corridor CROSSED and this one does not — the dash carries '
                    + 'the player past the trigger, so its length is about a different journey'
                : 'the dashed corridor crosses where the undashed one did not';
        } else if (longest > PREVIEW_AGREEMENT_BOUND) {
            row.kind = 'leg-bound';
            row.why = `its longest leg is ${longest} tick(s), past the preview/drive `
                + `agreement bound of ${PREVIEW_AGREEMENT_BOUND} (§27.8) — past that the `
                + 'walk would be certified against a preview the drive stops matching';
        } else if (struck.length) {
            row.kind = 'would-hit';
            row.why = `a scheduled press at tick ${struck[0].tick} would cover `
                + `${struck[0].targets.join(', ')}. A press taken to MOVE may not also be a `
                + 'strike: a hit changes the room the corridor was certified for — knockback, '
                + 'an i-frame, a death, a camera shake the frozen preview cannot see — and '
                + '⚖ ruling 35 puts safety over speed';
        } else if (walk.samples.length >= current) {
            row.kind = 'not-faster';
            row.why = `${walk.samples.length} tick(s) against ${current} — a window that `
                + 'does not shorten the walk buys nothing, and ⚖ ruling 35 asks for speed '
                + `only where it costs no certification. It scheduled ${row.pressed} press(es), `
                + `${row.dashed} of them dashes, and ${row.yielded} were YIELDED`
                + `${row.yieldedFirst ? ` — first: ${row.yieldedFirst}` : ''}`;
        } else {
            const hit = certify ? certify(walk.samples) : null;
            if (hit) {
                row.kind = 'danger';
                row.why = `the dashed corridor probes DANGEROUS at `
                    + `(${hit.x.toFixed(1)},${hit.y.toFixed(1)}) at tick ${hit.tick}`;
            } else {
                row.certified = true;
                row.legs = legs;
            }
        }
        candidates.push(row);
        if (row.certified) {
            windows.push(at);
            current = row.ticks;
            bestWalk = walk;
            at += ORDINARY_SWING_PERIOD;
        } else {
            at += 1;
        }
    }
    if (!windows.length) {
        return { ...refuse(`no dash window certified faster than the undashed ${baseline} `
            + `tick(s) — ${candidates.length} start tick(s) scanned, each with its own `
            + 'reason'), baseline };
    }
    const plan = scheduleFor(windows);
    return {
        plan,
        ticks: current,
        saved: baseline - current,
        baseline,
        legs: legsOf(bestWalk),
        windows: windows.map((t) => t - startTick),
        scanned: candidates.length,
        candidates,
        why: null,
    };
}

/**
 * ⛓ R9 slice 12c′ — one trace row per REASON KIND a dash window was rejected
 * for, with its count and the first example. See the call site for why the
 * whole scan is not transcribed.
 */
function dashRejectionSummary(dash) {
    const byKind = new Map();
    for (const c of dash.candidates ?? []) {
        if (c.certified) continue;
        if (!byKind.has(c.kind)) byKind.set(c.kind, { n: 0, first: c });
        byKind.get(c.kind).n += 1;
    }
    const rows = [...byKind.entries()].sort((a, b) => b[1].n - a[1].n)
        .map(([kind, v]) => ({
            option: `sword-dash window: ${kind}`,
            why: `${v.n} of ${dash.scanned} scanned start tick(s) — first at walk-offset `
                + `${v.first.at}: ${v.first.why}`,
        }));
    if (dash.why) rows.push({ option: 'sword-dash', why: dash.why });
    return rows;
}

/** The walk's own keys during a standing tail — empty, and named as such. */
const NO_HELD_PREVIEW = new Set();

/**
 * The danger probe at a DECISION point: the union map's reason list for a
 * box at a position, at the run's own clock. Slice 2's response to a
 * non-empty list is a refusal that carries it (no dodge policy yet — slice
 * 3's charge); the probe is wired now so the seam exists and the trace can
 * carry what was seen.
 */
function dangerNow(run, x, y, except = null) {
    return withoutSources(dangerAt(run, run.ticksCompleted, playerBoxAt(x, y)), except);
}

/**
 * ⛓⛓⛓ R8 SLICE 4 — A NAMED DANGER EXCLUSION, AND WHY ONE IS A MECHANISM FACT
 * RATHER THAN A FUDGE.
 *
 * `dangerMap`'s arrow ingredient prices an ARMED trap's lane at HORIZON ZERO
 * — §9.9 decision 2, and it is right: the volley that has not fired yet is
 * the one a policy needs warning about. But the `bait` phase's FIRST ACT is
 * to step off the button, and `Button.update` republishes its flag every tick
 * — so the group this order arms goes false on the tick the walk begins, and
 * the lanes the probe is refusing are lanes that will not be firing while the
 * player is anywhere near them.
 *
 * ⛔ SO THE EXCLUSION IS SCOPED TO THE LANES THIS ORDER'S OWN PRESSER ARMS,
 * and to the phases in which the presser is provably released. Everything
 * else the union knows stays priced — including `arrowDanger`'s OTHER half,
 * the arrows ALREADY IN FLIGHT, which is what makes this a claim about the
 * ceiling's STATE rather than a hole in the map (trap 160's law, honoured
 * rather than repeated: the STATE layer answers the state question).
 *
 * ⛔ AND THE ORACLE IS STILL THE RUN. `runDwell` asserts NO NEW HITS and the
 * segment asserts zero hits overall, so an exclusion that was wrong shows up
 * as a hit rather than as a silence.
 */
function withoutSources(d, except) {
    if (!except || except.size === 0) return d;
    const sources = d.sources.filter((s) => !except.has(s.id));
    return { ...d, sources, danger: sources.length > 0 };
}

/** One goal, shape-checked. The two kinds slice 2 owns. */
export function assertGoal(goal, i) {
    const at = `solverBot: goals[${i}]`;
    if (!goal || typeof goal !== 'object') fail(`${at} must be an object`);
    if (goal.kind === 'reach-exit') {
        if (!Number.isFinite(goal.exit?.x) || !Number.isFinite(goal.exit?.y)) {
            fail(`${at}: reach-exit needs exit {x, y} — the teleporter's OEL `
                + 'coordinates. The MACRO layer names WHAT to cross; the solver owns '
                + 'HOW.');
        }
        return goal;
    }
    if (goal.kind === 'collect-placement') {
        if (!Number.isFinite(goal.placement?.x) || !Number.isFinite(goal.placement?.y)) {
            fail(`${at}: collect-placement needs placement {x, y} — the pickup's or `
                + 'chest\'s OEL coordinates. Which VERB collects it is the solver\'s '
                + 'strategy selection, not the goal\'s.');
        }
        return goal;
    }
    fail(`${at}: unknown goal kind ${JSON.stringify(goal.kind)}. Slice 2 owns `
        + '\'reach-exit\' and \'collect-placement\'; a new kind is a policy addition, '
        + 'not a free string here — the trace\'s vocabulary is open, the solver\'s '
        + 'is not.');
    return null;
}

/**
 * ⛓ RESOLVE a collect-placement against LIVE state — the strategy selection
 * this slice really exercises. One placement, two possible worlds: a chest
 * (a Solid with a probe line and a spawned SealPiece) wants the `chest`
 * verb; a pickup (an avoid volume with a ceremony) wants `collect`. The
 * SAME goal shape selects differently in different rooms, which is what a
 * selector is for.
 */
function resolveCollectStrategy(run, placement) {
    const world = run.world;
    const chest = (world.chests ?? []).find((c) => c.x === placement.x && c.y === placement.y);
    if (chest) {
        return {
            strategy: 'chest',
            target: chest,
            rejected: [{
                option: 'collect',
                why: `placement (${placement.x},${placement.y}) resolves to ${chest.id} in `
                    + '`world.chests` — a chest is a Solid with a probe line, not a pickup '
                    + 'volume, and `Chest.open()` is what spawns the thing to collect',
            }],
        };
    }
    const pickup = (world.pickups ?? []).find((p) => p.x === placement.x && p.y === placement.y);
    if (pickup) {
        return {
            strategy: 'collect',
            target: pickup,
            rejected: [{
                option: 'chest',
                why: `placement (${placement.x},${placement.y}) resolves to `
                    + `${pickup.tag}@${pickup.x},${pickup.y} in \`world.pickups\` — a live `
                    + 'pickup with its own ceremony, no probe line to stand on',
            }],
        };
    }
    return null;
}

/**
 * ── ⚖ §11.8a RULING 1 — THE SHOVE DESTINATION IS THE POST-CONDITION ───
 *
 * The three kinds a work order can want, and this list is the RUNNING one:
 * `r8Acceptance.assertShovePostConditionKind` asserts it against the ruled
 * partition, so the ruling and the code are one roster rather than two
 * (trap 89). A fourth kind is a design change, not a default.
 *
 *   `clear-path`  the corridor has to exist afterwards. `k` is DERIVED —
 *                 the MINIMUM tiles such that a valid path plans with the
 *                 block hypothesised at cell `k`.
 *   `press`       the destination is a BUTTON's cell, named by a puzzle step.
 *   `dispose`     the destination is destructive terrain the post-condition
 *                 NAMES — `runShove`'s `destroys: true` exists for this.
 */
export const SHOVE_POST_CONDITIONS = Object.freeze(['clear-path', 'press', 'dispose']);

/**
 * ⛔ HOW FAR A BLOCK COULD EVER NEED TO GO, and the bound is named rather
 * than generous. A room is at most 20 tiles across at this rung's scale and a
 * block glides `TICKS_PER_TILE` per tile, so a `k` past this is a derivation
 * that has lost its corridor rather than a long push — and a scan that ran to
 * the map edge would spend a full A\* per tile saying so.
 */
const MAX_SHOVE_TILES = 20;

/** The block's own 16x16 rect at a tile — `pushables.pushableRect`'s shape. */
const blockRectAt = (cell) => rect(cell.tx * TILE_SIZE, cell.ty * TILE_SIZE,
    TILE_SIZE, TILE_SIZE);

/**
 * Does the block SINK on this cell? `PushableBlock.input()`'s check, at the
 * cell centre, against `pushables.DESTROYING_TILE_TYPES` — the transcription's
 * own table, never a copy typed here.
 *
 * ⚠ Asked of the tile the block would come to REST on, which is the only
 * place the game asks it: `input()`'s sink arm is gated on
 * `gridPos(x, y).equals(x, y)` and a mid-glide position is never a multiple
 * of 16, so a block CROSSING a pit does not sink.
 */
function blockSinksOn(world, cell) {
    const t = world.nearestWalkableTile(cell.tx * TILE_SIZE + TILE_SIZE / 2,
        cell.ty * TILE_SIZE + TILE_SIZE / 2)?.t;
    return t !== undefined && Boolean(DESTROYING_TILE_TYPES[t]);
}

/**
 * Would the block STOP DEAD here? `pushableCtx().collides`' own question,
 * asked of a hypothetical cell — a block is Solid to everything the level is
 * Solid to, minus ITSELF (which is why the self entry is removed rather than
 * the query narrowed).
 */
function blockBlockedAt(run, bag, id, cell) {
    const without = new Map(bag.pushables ?? []);
    if (without.has(id)) without.set(id, { ...without.get(id), removed: true });
    return Boolean(run.world.collidesSolid(blockRectAt(cell), { ...bag, pushables: without }));
}

/**
 * The live-geometry bag with ONE block hypothesised somewhere else — the
 * whole of "queryable offline against the full-bag path".
 *
 * ⛔ THE SPREAD KEEPS THE BRAND. `normalizeLiveOpts` marks a bag with a
 * module-private Symbol and `{ ...branded }` copies own enumerable symbol
 * keys, so this is still a bag the consumer entries accept — which is the
 * property `levelWorld`'s own `{ ...base, pushables: withoutSelf }` relies on
 * and the reason a hand-assembled fourteen-family literal here would be
 * refused at the door (trap 86).
 */
function bagWithBlockAt(bag, id, cell, destroys, discharged = []) {
    const map = new Map(bag.pushables ?? []);
    const cur = map.get(id) ?? {};
    map.set(id, destroys
        ? { ...cur, removed: true }
        : { ...cur, rect: blockRectAt(cell), removed: false });
    for (const other of discharged) {
        if (!map.has(other)) continue;
        map.set(other, { ...map.get(other), removed: true });
    }
    return { ...bag, pushables: map };
}

/** Does a corridor plan from `from` to `aim`? The reachability probe, boxed. */
function corridorPlans(world, from, aim, allowTeleporter, opts) {
    try {
        planWaypoints(world, from, aim, allowTeleporter, opts);
        return true;
    } catch (e) {
        if (!(e instanceof BotDriverV2Error)) throw e;
        return false;
    }
}

/**
 * ⛓⛓⛓ R8 SLICE 3b — `push-until-path`, ⚖ §11.8a RULING 1(a).
 *
 * Slice 3 stopped here (§11.8) because `runShove` requires `dir` AND `to`
 * DECLARED and only `dir` is derivable from geometry: `input()` retargets ONE
 * TILE PER CONTACT, so a continuous lean keeps moving the block for as long as
 * contact persists and the resting cell is decided by WHEN THE WALKER STOPS
 * LEANING. "How far" was a genuine choice with two working answers.
 *
 * The ruling makes it arithmetic. **`k` = the MINIMUM tiles such that a valid
 * path exists with the block hypothesised at cell `k`** — queried offline
 * against the FULL-BAG path (`run.liveGeometryOpts()`, all fourteen families),
 * never against the level record (trap 153: a planner that re-boots from the
 * record puts every pushable back at its `.oel` cell).
 *
 * ⛔ DESTRUCTION IS NEVER A SIDE EFFECT. A destructive cell ends the scan for
 * its direction — the block is GONE there, so there is no k+1 — and it is
 * only ever taken as an explicit LAST RESORT, after every non-destructive
 * cell has failed to yield a path. The trace then flags the irreversibility:
 * a destroyed block cannot press, cannot be pushed again, and cannot wall a
 * chaser (`Bob.as:39` pushes "Enemy", which makes a parked block a WALL to
 * one and potentially the dodge policy's friend), while a parked one keeps
 * all three.
 *
 * ⛓ THE PATH IS TESTED FROM WHERE THE SHOVE LEAVES THE PLAYER, not from the
 * stance it starts at. A continuous lean walks the player along behind the
 * block, so the post-shove position is the block's resting cell minus one
 * step — and testing from the START would certify a corridor from a cell the
 * player is no longer standing in. The post-shove RE-PLAN is still the
 * validation that binds; this is what makes the hypothesis worth taking.
 */
function deriveShove(run, row, aim, allowTeleporter, contacts, blocked = []) {
    const live = run.pushables?.get(row.id);
    if (!live || live.removed) return null;
    /**
     * ⛓⛓⛓ ⚖ RULED IN REPLY (orchestrator, mid-slice 3b) — READING (b), WITH
     * ITS TWO GUARDS. "A valid path exists" quantifies over the world where
     * the OTHER PENDING FRONTIER OBSTACLES ARE HYPOTHETICALLY DISCHARGED,
     * because a plan is exactly that hypothesis.
     *
     * ⛔ MEASURED FIRST, THEN RULED. L8's corridor needs TWO blocks moved —
     * `pushableblock@112,48` is the east pocket's only door and
     * `pushableblock@96,112` stands IN column 6, which the probe confirms is
     * the room's only way south — so no hypothesis that moves ONLY the first
     * yields a path at any k in any direction, and the derivation correctly
     * returned nothing. In L4, where there is no other movable obstacle, this
     * degenerates to the ruling verbatim and k is still 2.
     *
     * ⛔ GUARD (i): THE HYPOTHESIS SET IS BOUNDED TO OBSTACLES THE POLICY
     * BELIEVES IT CAN DISCHARGE — an entity with a SELECTED strategy row. An
     * obstacle with no strategy is a WALL for this quantifier, not an
     * optimistic gap; and the set is NAMED in the trace row, so the
     * hypothesis a destination rests on is auditable rather than implied.
     *
     * ⛔ GUARD (ii) lives at the call site (`hypothesisLedger`): a downstream
     * order that REFUSES invalidates every shove that leaned on it, and the
     * re-derivation runs with that obstacle demoted to a wall (`blocked`) and
     * with the parked block's REAL position as its input.
     */
    const discharged = [];
    for (const other of (run.world.pushables ?? [])) {
        if (other.id === row.id) continue;
        if (blocked.includes(other.id)) continue;
        const otherLive = run.pushables?.get(other.id);
        if (!otherLive || otherLive.removed) continue;
        if (!OBSTACLE_STRATEGIES[`solid:${other.tag}`]) continue;
        discharged.push(other.id);
    }
    const from = {
        tx: Math.floor(live.rect.x / TILE_SIZE), ty: Math.floor(live.rect.y / TILE_SIZE),
    };
    const bag = run.liveGeometryOpts();
    const planOpts = solverPlanOpts(run, contacts);
    const found = [];
    const rejected = [];
    const dirs = Object.keys(SHOVE_STEP);
    dirs.forEach((dir, dirIndex) => {
        const step = SHOVE_STEP[dir];
        const stanceCell = { tx: from.tx - step.dx, ty: from.ty - step.dy };
        const stance = nodeCentre(stanceCell.tx, stanceCell.ty, DEFAULT_LATTICE);
        /**
         * ⛓ THE DIRECTION IS DERIVED BY REACHABILITY, which is the honest
         * reading of "the player is on one side of a cut vertex and the aim on
         * the other": a lean is a HELD KEY, so the only directions available
         * are the ones whose NEAR-SIDE cell the player can actually stand in.
         * `planWaypoints` is the probe, the same instrument the walk then
         * follows (§10.4 note 3's law, one verb over).
         */
        if (!corridorPlans(run.world, run.state, stance, null, planOpts)) {
            rejected.push({
                option: `shove ${dir}`,
                why: `the near-side stance (${stance.x},${stance.y}) for a ${dir} lean does `
                    + 'not plan a corridor from the live position — a lean needs the player '
                    + 'box on the block\'s +-1 px probe with velocity INTO it, so a '
                    + 'direction whose stance is in another component is not a direction',
            });
            return;
        }
        for (let k = 1; k <= MAX_SHOVE_TILES; k += 1) {
            const cell = { tx: from.tx + step.dx * k, ty: from.ty + step.dy * k };
            /**
             * ⛔⛔⛔ R8 SLICE 4 — THE OFF-THE-MAP GUARD WAS COMPARING TILES
             * AGAINST PIXELS, AND HAD BEEN VACUOUS SINCE THE DAY IT WAS
             * WRITTEN.
             *
             * `world.width`/`world.height` are TILES (12 x 13 in L8);
             * `world.world.width`/`world.world.height` are the same room in
             * PIXELS (192 x 208). The guard read the second and compared it
             * to a tile index, so no `k` inside a 12-tile room could ever
             * trip it — and L8 is the first room where that mattered:
             * push-until-path scanned column 6 south, found every in-room
             * cell still blocking, reached the cell BELOW THE FLOOR, found
             * that a block outside the level blocks nothing, and returned
             * `k = 6` — a destination the block physically cannot reach. The
             * shove then leaned for 240 ticks and reported the block had
             * never left its cell.
             *
             * ⛓ The fix makes the LAST RESORT reachable, which is the whole
             * point: with the map bounded, no NON-destructive cell in any
             * direction yields a corridor, so ⚖ ruling 1(a)'s explicit last
             * resort applies and the block goes into the water — which is
             * what the hand answer does, arrived at by exhausting the
             * alternatives rather than by preferring the pit.
             * [[feedback_units_must_survive_the_round_trip]]
             */
            if (cell.tx < 0 || cell.ty < 0
                || cell.tx >= run.world.width || cell.ty >= run.world.height) {
                rejected.push({
                    option: `shove ${dir} k=${k}`,
                    why: `(${cell.tx},${cell.ty}) is OFF THE MAP — level ${run.level} is `
                        + `${run.world.width}x${run.world.height} TILES. A block cannot rest `
                        + 'outside the room, and a hypothesis that puts it there is asking '
                        + 'whether a corridor exists once the block stops existing.',
                });
                break;
            }
            const destroys = blockSinksOn(run.world, cell);
            if (!destroys && blockBlockedAt(run, bag, row.id, cell)) {
                rejected.push({
                    option: `shove ${dir} k=${k}`,
                    why: `(${cell.tx},${cell.ty}) is Solid to the block, which stops dead `
                        + 'against one — so no k at or beyond this is reachable',
                });
                break;
            }
            const after = nodeCentre(cell.tx - step.dx, cell.ty - step.dy, DEFAULT_LATTICE);
            const ok = corridorPlans(run.world, after, aim, allowTeleporter, {
                ...planOpts,
                liveBag: bagWithBlockAt(bag, row.id, cell, destroys, discharged),
            });
            if (ok) {
                found.push({ dir, dirIndex, k, to: { tx: cell.tx, ty: cell.ty }, destroys });
                break;
            }
            rejected.push({
                option: `shove ${dir} k=${k}`,
                why: `no corridor to (${aim.x},${aim.y}) with the block hypothesised at `
                    + `(${cell.tx},${cell.ty})${destroys ? ' (destroyed there)' : ''}`,
            });
            if (destroys) break;
        }
    });
    if (found.length === 0) return { plan: null, rejected, discharged };
    /**
     * ⛔ NON-DESTRUCTIVE FIRST, THEN SMALLEST `k`, THEN THE TABLE'S OWN
     * DIRECTION ORDER. The first key is the ruling; the second is the ruling's
     * own "MINIMUM tiles"; the third exists because an emitted tape is an
     * artifact and a tie broken by iteration order is a tie broken by nothing.
     */
    found.sort((a, b) => (a.destroys ? 1 : 0) - (b.destroys ? 1 : 0)
        || a.k - b.k || a.dirIndex - b.dirIndex);
    return { plan: found[0], rejected, alternatives: found.slice(1), discharged };
}

/**
 * ⛓ THE STANCE, DERIVED — the design decision the leg spec used to hide.
 *
 * A hand-authored leg CARRIED its stance (`{x: 56, y: 72, collect: …}`); the
 * solver derives it from the same census the verbs check it against:
 *
 *   · a CHEST's stance is `chestStanceBand`'s own answer — the two-pixel
 *     band below the probe line, at the chest's centre column. The band is
 *     the mechanism's own derivation, so the stance cannot drift from the
 *     check.
 *   · a PICKUP's stance is the nearest walkable lattice cell OUTSIDE its
 *     avoid volume, found by ring search (the pickup's own cell is refused
 *     by the planner — kickoff: "a leg that aimed AT the sword would be
 *     refused by name"); `runCollect`'s approach loop drives the last
 *     pixels from there, exactly as it did from a hand-authored stance.
 */
function deriveStance(run, resolved, contacts) {
    if (resolved.strategy === 'chest') {
        const band = chestStanceBand(resolved.target.x, resolved.target.y, HITBOX);
        /**
         * The chest's centre column, at the TOP row of the band. ⚠ The aim
         * row interacts with the controller's braking: the approach comes
         * from open floor BELOW, so an undershoot stops up to `tolerance`
         * DEEPER (larger y) than the aim — aiming at the band's deepest row
         * left the box 0.1 px below the probe line on the first smoke run.
         * Aiming at the top row, every stop inside the tolerance still
         * touches the line (a stop above it would have to penetrate the
         * chest, which the sweep refuses), and `runChest`'s own line test
         * remains the check that binds.
         */
        return { x: resolved.target.x + TILE_SIZE / 2, y: band[0] };
    }
    const p = resolved.target;
    const centre = { x: (p.rect.x + p.rect.right) / 2, y: (p.rect.y + p.rect.bottom) / 2 };
    const cell = nodeAt(centre.x, centre.y, DEFAULT_LATTICE);
    const opts = solverPlanOpts(run, contacts, { nodeMargin: 0, triggerMargin: 0 });
    /**
     * ⛓ WALKABLE IS NOT REACHABLE, and the first smoke run measured the
     * difference: the sword's nearest walkable cell BY DISTANCE is (56,40),
     * one ring north — in a component the player cannot enter (the room's
     * north pocket). So candidates are gathered by ring, ordered by
     * (distance, then y, then x — the emitted tape is an artifact and the
     * tie-break must be deterministic), and the FIRST ONE A CORRIDOR
     * REACHES wins: the reachability probe is `planWaypoints` itself, the
     * same instrument the walk then follows, so the stance the solver picks
     * and the stance it can stand on cannot be two different claims.
     */
    /**
     * ⛓⛓ PROCGEN PoC SLICE 3 — **A CELL OUTSIDE THE ROOM IS NOT A STANCE**,
     * and it took a generated room to say so out loud.
     *
     * `plannerObstacleAt` answers "what solid is at this point"; OUTSIDE the
     * level rectangle there is no tile, so it answers `null` — "walkable". The
     * ring search then offered cells beyond the border ring as candidates, and
     * `planWaypoints` (which does not bound its goal either) planned a corridor
     * straight through the border wall to one. Measured on a 10x10 generated
     * room with the goal at tile (7,8): the derived stance was `(168,88)` —
     * lattice cell (10,5), one column PAST a room whose last column is 9 — and
     * the walk spent its whole per-target budget grinding into `tile:Stone` at
     * (152,72). ⚠ The same room, goal at (1,8), derived `(-8,88)`.
     *
     * ⛔ PRE-EXISTING, MEASURED: both refusals are BYTE-IDENTICAL at `a1f08414c`
     * with this slice's other change reverted — this is not fallout from the
     * ladder routing below, it is a hole the atlas's own rooms never showed
     * because their goals sit far from the border. A generated room puts the
     * goal wherever the seed says.
     *
     * The bound is the world's own rectangle, in the ring search's own lattice
     * units, spelled the way `identifyAndSelect`'s flood spells it.
     */
    const nx = run.world.width * TILE_SIZE / DEFAULT_LATTICE;
    const ny = run.world.height * TILE_SIZE / DEFAULT_LATTICE;
    const candidates = [];
    for (let r = 1; r <= 3; r += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
            for (let dx = -r; dx <= r; dx += 1) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const tx = cell.tx + dx;
                const ty = cell.ty + dy;
                if (tx < 0 || ty < 0 || tx >= nx || ty >= ny) continue;
                const c = nodeCentre(tx, ty, DEFAULT_LATTICE);
                if (plannerObstacleAt(run.world, c.x, c.y, null, opts)) continue;
                candidates.push({ d: Math.hypot(c.x - centre.x, c.y - centre.y), ...c });
            }
        }
    }
    candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    /**
     * ⛓⛓⛓ PROCGEN PoC SLICE 3 — **A STANCE YOU CANNOT COLLECT FROM IS NOT A
     * STANCE**, which is the other half of ⚖ "items must be collectable from
     * any angle".
     *
     * The probe above asks ONE question — can the player reach this cell — and
     * the collect then needs a second one the derivation never asked: can the
     * PICKUP be reached from that cell. `runCollect` does not follow waypoints;
     * it presses toward the pickup's centre from wherever the stance is. So a
     * candidate on the WRONG SIDE of a wall satisfies the first question and
     * fails the walk three ticks later. Measured (goal at tile (7,7), a wall
     * across ty=5): the ring-3 cell at ty=4 is reachable, is chosen, and the
     * drive dies — *"the sweep was blocked by tile:Stone at (120,88)"* — while
     * the cells that CAN collect, one ring away on the pickup's own side, are
     * never considered because a nearer-by-distance answer already returned.
     *
     * ⛔ IT IS A CANDIDATE FILTER, NOT AN APPROACH SIMULATION. The second
     * question is asked with `planWaypoints` — the same instrument as the
     * first, and `planTilePath` reads only `{x, y}` off its `from`, so there is
     * no synthesised run state and no second geometry here. ⚠ Asked with
     * `avoidVolumes: false` for `placementBlocker`'s reason one function up:
     * the pickup's own volume is an avoid volume, and the question is whether
     * anything ELSE stands between.
     *
     * ⚠⚠ IT IS WEAKER THAN THE DRIVE IT MODELS, and that is deliberate. A tile
     * path may turn a corner the straight drive would not; this filter answers
     * "same walkable component", not "clear line". Modelling the line would be
     * new geometry beside a controller that already owns it — and the failure
     * it would additionally catch is the one `runCollect` reports BY NAME.
     */
    const approachOpts = solverPlanOpts(run, contacts, {
        avoidVolumes: false, nodeMargin: 0, triggerMargin: 0,
    });
    const plans = (from, to, opts) => {
        try {
            planWaypoints(run.world, from, to, null, opts);
            return true;
        } catch (e) {
            if (!(e instanceof BotDriverV2Error)) throw e;
            return false;
        }
    };
    const canCollectFrom = (c) => plans({ x: c.x, y: c.y }, centre, approachOpts);
    /**
     * ⛓ THREE PASSES, AND THE THIRD IS THE COMMITTED CORE'S OWN ANSWER — so
     * this filter can never make a room worse than it was at `238f0dbe9`. If
     * NOTHING can collect the pickup as the world currently stands, the filter
     * has no opinion left to offer and the ladder gets the nearest cell, which
     * is exactly what the slice's first half already did.
     */
    for (const c of candidates) {
        if (plans(run.state, { x: c.x, y: c.y }, solverPlanOpts(run, contacts))
            && canCollectFrom(c)) {
            return { x: c.x, y: c.y, corridor: true };
        }
    }
    const collectable = candidates.filter(canCollectFrom);
    /**
     * ⛓⛓⛓ PROCGEN PoC SLICE 3 — ⚖ THE COLLECT-PATH RULING (user, 2026-08-12):
     * *"the corridor limitation sounds like a bug that we should fix with
     * collection goals"*, and *"items should be collectable from any angle"*.
     *
     * THE BUG, precisely: "no candidate plans a corridor" was read here as "no
     * stance exists", and refused. But `walkTo` — the ONE place a corridor
     * failure is answered — responds to exactly this failure by identifying the
     * obstacle at the component frontier and applying a strategy (`walkTo`'s
     * `identifyAndSelect` arm). A REACH-EXIT goal gets that ladder because
     * `walkTo` is the first thing the exit branch calls; a COLLECT goal never
     * did, because this derivation ran first and threw. So a corridor-blocking
     * obstacle refused before its clearer was ever selected — measured across
     * the whole pre-sword clearer palette (PoC slice 2 §9.1).
     *
     * ⇒ THE FIX IS TO STOP ANSWERING A QUESTION THIS FUNCTION CANNOT ANSWER.
     * Reachability-after-clearing is `walkTo`'s question, and re-asking it here
     * would be a SECOND ladder (§11.7's one-of-everything law: the ladder is
     * `walkTo`'s, and the derivation's job is to name a stance). So the
     * corridorless case returns the best candidate the ring search found,
     * FLAGGED, and the walk to it enters the same ladder every crossing uses.
     *
     * ⚠ The order is the SAME `(d, y, x)` order — the nearest walkable cell to
     * the pickup. Which is what the caller wants: the ladder clears the
     * frontier obstacle and re-plans to this aim, and the frontier the ladder
     * floods to is a property of the LIVE POSITION, not of which candidate is
     * aimed at, so the choice among corridorless candidates cannot change
     * WHICH obstacle gets identified — only where the walk ends up afterwards.
     *
     * ⚠⚠ NAMED BOUND — one shot, and the degenerate case is a worse MESSAGE,
     * never a wrong answer. If the candidates are corridorless because they sit
     * in a pocket no verb opens (the north-pocket case this docblock's ring
     * search was built around), the ladder refuses instead of this function —
     * a refusal that names the frontier obstacles and every rung that declined,
     * possibly after spending up to `MAX_STRATEGIES_PER_GOAL` applications on
     * obstacles that were never the pocket's wall. Trying candidates one by one
     * to avoid that is not available: `walkTo` DRIVES, so a candidate cannot be
     * tried and taken back.
     *
     * ⛔ The genuine no-stance case still refuses HERE, unchanged in kind: zero
     * walkable candidates is a claim the ring search alone can settle.
     */
    if (candidates.length > 0) {
        const c = (collectable.length > 0 ? collectable : candidates)[0];
        return {
            x: c.x,
            y: c.y,
            corridor: false,
            why: `no corridor from (${run.state.x},${run.state.y}) to a stance that can `
                + `collect ${p.tag}@${p.x},${p.y} — ${candidates.length} walkable `
                + `candidate(s) in range, ${collectable.length} of them with an approach `
                + 'to the pickup; the nearest of those is the aim and the walk\'s own '
                + 'obstacle ladder is what must open it',
        };
    }
    throw new SolverRefusal(
        `solverBot: no WALKABLE stance within 3 lattice rings of `
        + `${p.tag}@${p.x},${p.y} in level ${run.level} — `
        + `0 walkable candidate(s) from (${run.state.x},${run.state.y}). The pickup's `
        + 'own cell is an avoid volume by design, and every ring cell around it is '
        + 'blocked, so there is no cell to aim a walk at — not even one the '
        + 'obstacle ladder could open a corridor to.',
        { obstacle: { kind: 'pickup', id: `${p.tag}@${p.x},${p.y}` } });
}

/**
 * ⛓⛓⛓ R8 SLICE 3 — HOW LONG TO HOLD, DERIVED FROM THE MECHANISM THE HOLD IS
 * FOR. The leg spec's `ticks: 200` was a margin somebody measured; a live
 * policy has to answer the question the margin was hiding.
 *
 * Three answers, in the order the group's responders decide:
 *
 *   1. **A responder that OPENS** (`Lock` 101 ticks, `Cover` 11) — the count
 *      is `activators.opensOnTick` over that class's own fade, which is the
 *      mechanism's arithmetic and not a number typed here. The BOUND is that
 *      plus slack; the CONDITION is the responder actually being open.
 *   2. **A trap group with a body to kill** — the condition is OBSERVED
 *      (`run.chasers` empty in this room), which is a question this model
 *      could not answer before the Arrow × Enemy family and can now. The
 *      bound is the mechanism's floor: three landed arrows are at least
 *      `2 x hitsTimerMax` apart, plus the death staging, plus one leash
 *      approach — per body.
 *   3. **A trap group with nothing to kill** — hold long enough for the arm
 *      to be a measurement rather than a claim: one volley period plus one,
 *      because `runHold`'s own effect check wants volleys on the ledger.
 *
 * ⛔ THE BOUND IS A CLAIM. `runHold` fails BY NAME when a condition never
 * becomes true inside it, so a wrong derivation here is a measurement rather
 * than a hold that quietly does nothing.
 */
function deriveHold(run, presser, opener = null) {
    const group = run.world.activators.filter((a) => a.t === presser.t);
    const traps = (run.world.arrowTraps ?? []).filter((a) => a.t === presser.t);
    if (group.length > 0) {
        const shut = group.filter((a) => !run.openActivators.has(a.id));
        const cost = Math.max(...shut.map(
            (a) => opensOnTick(RESPONDERS[a.tag]?.fade ?? RESPONDERS.lock.fade),
        ));
        /**
         * ⛓ R8 slice 7 — A LOCAL-PUBLISH BUTTON **LATCHES**, and the hold is
         * still the whole fade rather than one tick. `localPublish`
         * (`ButtonRoom.as:79-91`, the `room == -1` arm) assigns `activate`
         * directly and the setter's body is behind `if (a)` with the author's
         * own *"Can't be reset to false!!"*, so walking off changes nothing —
         * L20's `buttonroom@192,16` is exactly this shape.
         *
         * ⛔ THE HOLD IS NOT SHORTENED ON THAT BASIS, and the reason is the
         * CONDITION rather than the latch: what the next plan needs is the
         * lock NOT SOLID, and that is `opensOnTick`'s 101 ticks of fade
         * whoever is standing where. Leaving early would make the walk's own
         * corridor a race against a fade nobody is watching — and the walk
         * would then re-plan against a lock that is still a wall. The latch is
         * recorded because it is what makes leaving SAFE, not because it makes
         * the wait shorter.
         */
        const latch = localPublish(presser);
        return {
            ticks: cost + HOLD_SLACK,
            latched: latch !== null,
            why: opener?.via ?? null,
            until: {
                why: `every shut responder in group t=${presser.t} `
                    + `[${shut.map((a) => a.id).join(', ')}] is open`
                    + (latch ? ' — and the group is LATCHED by `localPublish`, so the '
                        + 'fade completes whoever is standing where' : ''),
                test: (r) => shut.every((a) => r.openActivators.has(a.id)),
            },
        };
    }
    if (traps.length > 0) {
        const bodies = run.chasers.length;
        if (bodies > 0) {
            return {
                ticks: bodies * ARROW_KILL_FLOOR + HOLD_SLACK,
                until: {
                    why: `every bridged chaser in level ${run.level} has been removed by `
                        + 'the room\'s own ceiling — the observable the Arrow x Enemy '
                        + 'family added (R8 slice 3)',
                    test: (r) => r.chasers.length === 0,
                },
            };
        }
        return { ticks: TRAP_ARM_TICKS, until: null };
    }
    return { ticks: TRAP_ARM_TICKS, until: null };
}

/**
 * `ArrowTrap.shootTimerMax` is 10 and the period is ELEVEN (trap 144: a
 * countdown's LENGTH is not its PERIOD), so a hold shorter than this can
 * report an armed trap with no volley behind it — which `runHold` already
 * refuses by name. One period plus the fire tick.
 */
const TRAP_ARM_TICKS = 12;

/**
 * The floor for ONE arrow kill, from the mechanism rather than from a
 * measurement: `hitsMax` 3 at 1 damage per arrow through `hitsTimerMax` 30
 * i-frames is 60 ticks between the first landing and the third
 * (`ARROW_ENEMY_HIT.minTicksToKillDefaultEnemy`), then the death staging —
 * the "die" animation and `Mobile.death`'s fade — before the body leaves the
 * world. The leash approach is the term nobody can derive, so it rides in
 * `HOLD_SLACK` and the bound stays a claim `runHold` can refute.
 */
const ARROW_KILL_FLOOR = 60 + 25 + 11;

/** One second of slack at 30 fps — named, so a reader can see it is one. */
const HOLD_SLACK = 30;

/**
 * ⛓ THE HOLD STANCE — inside the presser's rect, and REACHABLE.
 *
 * `runHold` refuses a hold point that is merely NEAR the button
 * ("the target before a hold has to land the player box inside the button"),
 * and A* refuses to route ONTO a `proximity-hazard` cell unless the volume is
 * exempted — which is the whole of trap 147: a hold is what ADDS its presser
 * to the contact exemptions, so the stance and the exemption are one
 * decision. The candidates are lattice cells whose player box overlaps the
 * presser rect, ordered deterministically, and the reachability probe is
 * `planWaypoints` itself — the same instrument the walk then follows, so the
 * stance picked and the stance reachable cannot be two claims.
 */
function deriveHoldStance(run, presser, contacts, blocked = [], { prerequisites = false } = {}) {
    const exempt = new Set([...contacts, `proximity-hazard:${presser.tag}@${presser.x},${presser.y}`]);
    const pitch = DEFAULT_LATTICE;
    const centre = {
        x: (presser.rect.x + presser.rect.right) / 2,
        y: (presser.rect.y + presser.rect.bottom) / 2,
    };
    const cell = nodeAt(centre.x, centre.y, pitch);
    const candidates = [];
    for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
            const c = nodeCentre(cell.tx + dx, cell.ty + dy, pitch);
            if (!rectsOverlapLocal(playerBoxAt(c.x, c.y), presser.rect)) continue;
            candidates.push({ d: Math.hypot(c.x - centre.x, c.y - centre.y), ...c });
        }
    }
    candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    /** ⛓ guard (iii)'s rejects, kept so the refusal below can NAME them. */
    const walls = [];
    const hypothesis = stanceHypothesis(run, blocked, contacts, walls);
    for (const c of candidates) {
        const reached = stanceReaches(run, { x: c.x, y: c.y }, exempt, hypothesis);
        if (reached) {
            return {
                stance: { x: c.x, y: c.y },
                // ⛓ The hypothesis' own exemptions ride out with the stance:
                // the walk that gets there goes THROUGH the discharged lock's
                // cell, so the plan that follows needs the same set the probe
                // used or it re-derives a corridor the probe never tested.
                exempt: reached.exempt ?? exempt,
                discharged: reached.discharged,
            };
        }
    }
    /**
     * ⛓⛓⛓ **THE PREREQUISITE — PROCGEN ELEMENTS arc 3, SLICE S1, GAP 1.**
     *
     * Every candidate has failed in the world as it is AND under the hypothesis,
     * so before S1 this threw. The question it never asked is the one ⚖ ruling
     * 22's gadget needs: *is this stance reachable once ONE obstacle has been
     * REALLY discharged by an order somebody executes first?* — which is not the
     * hypothesis. A hypothesis says "assume the rest of the plan works"; a
     * PREREQUISITE says "this is the work, do it now, then ask me again".
     *
     * ⛔ IT IS OPT-IN, and the opt-in is the "ONE place" law honoured at BOTH
     * ends. Two other callers of this derivation (`deriveKillByCeiling` and the
     * ceiling-bait presser search) destructure `{stance, exempt}` and would
     * silently DROP a prerequisite, driving a walk on the strength of work
     * nobody had done — the exact optimism gap 2 is about. Only
     * `resolveHoldStrategy`, whose result reaches the one consumer in `walkTo`,
     * asks for it.
     *
     * ⛔ AND IT COSTS NOTHING WHERE IT DOES NOT FIRE: the arm runs only after
     * every candidate has already refused, so no walk that plans today pays a
     * probe for it. (Arc-2 §9d's cost work is why that sentence is here.)
     */
    const pre = prerequisites
        ? stancePrerequisite(run, candidates, exempt, hypothesis, contacts, blocked) : null;
    if (pre) {
        return {
            stance: pre.stance,
            exempt,
            discharged: [],
            prerequisite: pre.prerequisite,
        };
    }
    throw new SolverRefusal(
        `solverBot: no REACHABLE stance inside ${presser.tag}@${presser.x},${presser.y} `
        + `in level ${run.level} — ${candidates.length} cell(s) land the player box in `
        + 'the button and none of them plans a corridor from '
        + `(${run.state.x},${run.state.y}). A hold that cannot be stood on is not a `
        + 'strategy for this obstacle.'
        + (prerequisites ? prerequisiteRefusalClause(run, hypothesis, walls, blocked) : ''),
        { obstacle: { kind: 'proximity-hazard', id: `${presser.tag}@${presser.x},${presser.y}` } });
}

/**
 * ⛓⛓⛓ **IS THIS STANCE REACHABLE ONCE ONE OBSTACLE IS REALLY DISCHARGED?** —
 * arc 3 slice S1 gap 1, and the answer is a SUB-ORDER, not a longer hypothesis.
 *
 * TWO ARMS, IN THIS ORDER, and the order is the design decision:
 *
 *  (a) **THE MECHANISM.** An activator already in the hypothesis whose own verb
 *      is a `weigh` — a lock whose group only publishes while a Solid sits on its
 *      button. Its resolution MOVES A BLOCK to a cell the mechanism names, so the
 *      probe is the corridor with that activator discharged AND its block parked
 *      on the presser (`bagWithBlockAt`, the same instrument `deriveShove`'s own
 *      hypothesis uses). ⇒ the prerequisite is the ACTIVATOR.
 *  (b) **THE GEOMETRY.** A walk-family `pushableblock` that simply stands in the
 *      lane. `deriveShove` is the probe, unchanged and un-copied: it already
 *      scans for the minimum `k` at which a corridor to this aim appears. ⇒ the
 *      prerequisite is the BLOCK.
 *
 * ⛔ **MECHANISM BEFORE GEOMETRY, AND NOT AS A PREFERENCE.** In ⚖ ruling 22's
 * gadget the block in the lane IS the opener's own material: arm (b) would shove
 * it "out of the way", spend the one block the room has, and leave the lock it
 * was going to open still shut — a corridor bought by destroying the mechanism
 * that was the puzzle. Asking the mechanism first means a block is only ever
 * treated as scenery once nothing needs it.
 *
 * ⚠ THE CANDIDATE LIST IS THE CALLER'S OWN, IN ITS OWN ORDER, so the stance a
 * prerequisite buys is the same stance the plain probe would have taken. Trying
 * a different cell here would make "the stance is reachable" and "the stance we
 * picked" two claims again (§11.7's law).
 */
function stancePrerequisite(run, candidates, exempt, hypothesis, contacts, blocked) {
    const bagH = bagWithDischarged(run, run.liveGeometryOpts(), hypothesis);
    const weighable = hypothesis.filter((h) => h.kind === 'activator' && h.strategy === 'weigh');
    for (const h of weighable) {
        const opener = openerPresserFor(run, { id: h.id, tag: h.tag });
        if (!opener) continue;
        const onto = {
            tx: Math.floor(opener.presser.x / TILE_SIZE),
            ty: Math.floor(opener.presser.y / TILE_SIZE),
        };
        const derived = deriveWeigh(run, onto, contacts, blocked);
        if (!derived.plan) continue;
        const bag = bagWithBlockAt(bagH, derived.plan.blockId, onto, false);
        for (const c of candidates) {
            if (!corridorPlans(run.world, run.state, { x: c.x, y: c.y }, null,
                solverPlanOpts(run, exempt, { liveBag: bag }))) continue;
            return {
                stance: { x: c.x, y: c.y },
                prerequisite: {
                    id: h.id,
                    kind: 'solid',
                    tag: h.tag,
                    via: 'mechanism',
                    why: `the stance is reachable once ${h.id} is REALLY open, and its own `
                        + `verb is \`weigh\`: ${derived.plan.blockId} is shoved `
                        + `${derived.plan.dir} k=${derived.plan.k} onto `
                        + `${opener.presser.tag}@${opener.presser.x},${opener.presser.y} `
                        + `(${onto.tx},${onto.ty}) and the group stays published while the `
                        + 'walker leaves. ⛔ Asked BEFORE the geometry arm, because that '
                        + 'block is the opener\'s own material — shoving it aside would buy '
                        + 'a corridor by spending the mechanism.',
                },
            };
        }
    }
    for (const row of (run.world.pushables ?? [])) {
        if (row.family !== 'walk' || blocked.includes(row.id)) continue;
        const live = run.pushables?.get(row.id);
        if (!live || live.removed) continue;
        for (const c of candidates) {
            const derived = deriveShove(run, row, { x: c.x, y: c.y }, null, exempt, blocked);
            if (!derived?.plan) continue;
            return {
                stance: { x: c.x, y: c.y },
                prerequisite: {
                    id: row.id,
                    kind: 'solid',
                    tag: row.tag,
                    via: 'geometry',
                    why: `the stance is reachable once ${row.id} is out of the lane: a `
                        + `\`shove\` ${derived.plan.dir} k=${derived.plan.k} to `
                        + `(${derived.plan.to.tx},${derived.plan.to.ty}) plans the corridor, `
                        + 'and a parked block stays parked. No activator in the hypothesis '
                        + 'wanted this block, so it is scenery rather than material.',
                },
            };
        }
    }
    return null;
}

/**
 * ⛓ THE CLAUSE A PREREQUISITE-AWARE REFUSAL OWES — *"and here is what could not
 * be resolved"*. ⛔ Without it the sentence is the pre-S1 one and a reader
 * cannot tell "there was nothing to try" from "the one thing to try failed",
 * which are the two answers this whole slice exists to separate.
 */
function prerequisiteRefusalClause(run, hypothesis, walls, blocked) {
    const parts = [];
    /**
     * ⛓ GUARD (iii)'S OWN REJECTS FIRST, because they are the sharpest answer
     * this sentence can carry: an obstacle that was NOT EVEN HYPOTHESISED, and
     * the mechanical reason nothing could redeem it durably. Without them the
     * refusal would name the blocks and never the lock (measured on ARM 4).
     */
    for (const w of walls) parts.push(`${w.id} — ${w.why}`);
    for (const h of hypothesis) {
        if (h.kind !== 'activator') continue;
        if (!openerPresserFor(run, { id: h.id, tag: h.tag })) {
            parts.push(`${h.id} (no presser publishes its tSet group at all, so nothing `
                + 'in this room can open it)');
        } else if (h.strategy === 'weigh') {
            parts.push(`${h.id} (its \`weigh\` has no block that reaches)`);
        }
    }
    const blocks = (run.world.pushables ?? []).filter((row) => {
        if (row.family !== 'walk' || blocked.includes(row.id)) return false;
        const live = run.pushables?.get(row.id);
        return Boolean(live) && !live.removed;
    });
    for (const row of blocks) parts.push(`${row.id} (no shove of it plans the corridor)`);
    if (parts.length === 0) {
        return ` ⛔ AND NO PREREQUISITE EXISTS TO RAISE: level ${run.level} holds no `
            + 'walk-family pushable and no hypothesised activator whose own verb moves one, '
            + 'so there is nothing an order could discharge to open this stance (arc 3 '
            + 'slice S1, gap 1 — the bound this sweep ran over is the room\'s own roster).';
    }
    return ' ⛔ AND THE PREREQUISITES WERE TRIED AND REFUSED, one at a time: '
        + `${parts.join('; ')}.`;
}

/** `rectsOverlap`, local so this module keeps its own import list honest. */
function rectsOverlapLocal(a, b) {
    return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}

/**
 * ⛓⛓⛓ ⚖ §15.7a RULING 2 — §12.2's HYPOTHESIS QUANTIFIER, APPLIED TO
 * **STANCES** EXACTLY AS TO SHOVE DESTINATIONS, WITH THE SAME TWO GUARDS.
 *
 * The measured case is L20: the opener of `lock@32,80` is
 * `buttonroom@192,16`, and the buttonroom stands BEHIND `shieldlocknorm@176,16`
 * — so `planWaypoints`, the reachability probe every stance derivation uses
 * (§11.7's law), refuses every cell of it while the shieldlock is solid. A
 * derivation that stopped there would report the room unresolvable with two
 * registered executors sitting in the registry.
 *
 * ⇒ "a stance is reachable" quantifies over the world where the OTHER PENDING
 * STRATEGY-SELECTED OBSTACLES ARE HYPOTHETICALLY DISCHARGED — which is what a
 * plan is. The two guards are §12.2's, unchanged:
 *
 *  (i)  THE SET IS BOUNDED to obstacles with a SELECTED **and registered**
 *       strategy, and the trace row NAMES it. An obstacle with no strategy is
 *       a WALL for this quantifier, not an optimistic gap.
 *  (ii) A REFUSED DOWNSTREAM ORDER INVALIDATES THE HYPOTHESIS: `blocked` is
 *       the loop's own `refusedOrders`, and an id in it is a wall here too.
 *
 * ⛔ AND THE HYPOTHESIS IS APPLIED TO THE **BAG**, not to a second planner.
 * `run.liveGeometryOpts()` is the branded fourteen-family bag; discharging an
 * activator is adding its id to `openActivators` and discharging a ShieldBoss
 * is marking its roster entry `removed` — the same two fields the real
 * mechanisms write. The spread keeps the brand (own enumerable SYMBOL keys are
 * copied), which is the property `deriveShove`'s hypothetical bag already
 * relies on, so no fourteen-family literal is typed here (trap 86).
 */
/** The empty contact set guard (iii)'s probe falls back to — never mutated. */
const NO_CONTACTS = Object.freeze(new Set());

function stanceHypothesis(run, blocked = [], contacts = NO_CONTACTS, walls = []) {
    const wall = new Set(blocked);
    const out = [];
    for (const a of (run.world.activators ?? [])) {
        if (wall.has(a.id) || run.openActivators.has(a.id)) continue;
        const strategy = refineStrategy(run,
            OBSTACLE_STRATEGIES[`solid:${a.tag}`] ?? null, { id: a.id, tag: a.tag });
        if (!strategy || !STRATEGY_EXECUTORS[strategy]) continue;
        /**
         * ⛓⛓⛓ **GUARD (iii) — NO OPTIMISM WITHOUT A DISCHARGE THAT OUTLIVES THE
         * WALKER.** PROCGEN ELEMENTS arc 3, slice S1, gap 2.
         *
         * ⛔ WHAT THE ARC-3 KICKOFF SAID, AND WHAT THE TRACE SAYS. §10.3 read
         * ARM 4's budget burn as *"no caller raises `lock`(A) as an order"*. A
         * caller does: the trace is four rows and the second is
         * `t0 obs=lock@64,48 verb=hold`. The order is raised by the nested stance
         * walk's own frontier, exactly as L20's is — and it is a **`hold` on a
         * plain republishing `Button`**, reached through `resolveWeighStrategy`'s
         * deliberate L16 fallback when no block can weigh the presser. So the
         * player stands on the button, the lock opens, the player WALKS OFF to go
         * through it, `Button.update` re-collides on the same tick and shuts it,
         * and the walk grazes it for the whole 400-tick budget.
         *
         * ⇒ THE GAP IS NOT A MISSING ORDER; IT IS **A HYPOTHESIS REDEEMED BY AN
         * ORDER THAT DOES NOT OUTLIVE THE WALKER.** A hypothesis is only sound
         * where something is OBLIGED to redeem it durably: the whole point of
         * discharging an obstacle for a stance elsewhere is that it STAYS
         * discharged while the walker goes there.
         *
         * ⛔ SO THE UNSOUND ONE IS A WALL, guard (i)'s own language extended —
         * and the honest answer is then the refusal it replaced, which costs 0
         * driven ticks instead of 400. The alternative (execute `discharged` as
         * orders before driving the walk) was REJECTED for a measured reason, not
         * a stylistic one: it would move the redemption of EVERY existing
         * hypothesis off the ordinary frontier, and both L20 (`r8-solve-20`) and
         * D1(a)'s ARM 5 redeem theirs there — a committed tape moving.
         *
         * ⚠ ONLY `weigh` IS ASKED, and that is the whole cost. `refineStrategy`
         * has ALREADY decided durability for every other verb: a `hold` survives
         * here precisely because its group has a LATCHING presser (`localPublish`
         * non-null — otherwise the refinement would have said `weigh`), and
         * `touch`/`kill`/`chest`/`keylock`/`fight` all leave the world changed.
         * `weigh` is the one answer that can turn back into a non-latching `hold`
         * underneath the caller, so it is the one that has to be checked by
         * DERIVING it.
         *
         * ⛔ AND IT IS ASKED OF `deriveWeigh`, NOT OF `resolveWeighStrategy`,
         * because the latter falls back to `resolveHoldStrategy`, which derives a
         * stance, which calls THIS FUNCTION. One question, no recursion.
         */
        if (strategy === 'weigh') {
            const opener = openerPresserFor(run, { id: a.id, tag: a.tag });
            const onto = opener ? {
                tx: Math.floor(opener.presser.x / TILE_SIZE),
                ty: Math.floor(opener.presser.y / TILE_SIZE),
            } : null;
            const derived = onto ? deriveWeigh(run, onto, contacts, blocked) : null;
            if (!derived || (!derived.plan && !derived.parked)) {
                walls.push({
                    id: a.id,
                    tag: a.tag,
                    why: opener
                        ? `its group t=${opener.group} publishes only while a Solid sits on `
                            + `${opener.presser.tag}@${opener.presser.x},${opener.presser.y}, `
                            + 'and NO block in this room can reach it — so the only order '
                            + 'that could open it is a `hold` the walker shuts again by '
                            + 'leaving. ⚖ Guard (iii): a hypothesis nothing can redeem '
                            + 'DURABLY is a wall, not an optimistic gap'
                        : 'no presser publishes its tSet group at all',
                });
                continue;
            }
        }
        /**
         * ⛓ arc 3 slice S1 — THE TAG RIDES ALONG. A hypothesis entry used to be
         * read for its id alone; a PREREQUISITE has to be turned back into an
         * OBSTACLE (`{kind, tag, id}`) so the same table that selected its verb
         * here can select it again there, and an entry without the tag resolves
         * to `OBSTACLE_STRATEGIES['solid']`, which is nothing at all.
         */
        out.push({ id: a.id, kind: 'activator', tag: a.tag, strategy });
    }
    for (const b of (run.world.shieldBosses ?? [])) {
        if (wall.has(b.id)) continue;
        const strategy = OBSTACLE_STRATEGIES['solid:shieldboss'];
        if (!strategy || !STRATEGY_EXECUTORS[strategy]) continue;
        out.push({ id: b.id, kind: 'shieldBoss', strategy });
    }
    return out;
}

/**
 * The branded bag with a hypothesis set discharged — see `stanceHypothesis`.
 * ⚠ Returns the bag UNCHANGED when the set is empty, so a room with nothing to
 * hypothesise pays nothing and probes exactly the world it is in.
 */
function bagWithDischarged(run, bag, hypothesis) {
    if (!hypothesis.length) return bag;
    const opens = new Set(bag.openActivators ?? []);
    let bosses = bag.shieldBosses;
    for (const h of hypothesis) {
        if (h.kind === 'activator') opens.add(h.id);
        else if (h.kind === 'shieldBoss' && bosses && bosses.has(h.id)) {
            if (bosses === bag.shieldBosses) bosses = new Map(bosses);
            bosses.set(h.id, { ...bosses.get(h.id), removed: true, rect: null });
        }
    }
    return { ...bag, openActivators: opens, shieldBosses: bosses };
}

/**
 * Does a corridor reach this stance — first in the world as it IS, and only
 * then under the hypothesis? The order is the point: a stance reachable today
 * carries NO hypothesis and therefore no ledger entry to invalidate, and a
 * derivation that leaned on optimism it did not need would make guard (ii)
 * fire for nothing.
 */
function stanceReaches(run, aim, contacts, hypothesis) {
    try {
        planWaypoints(run.world, run.state, aim, null, solverPlanOpts(run, contacts));
        return { discharged: [] };
    } catch (e) {
        if (!(e instanceof BotDriverV2Error)) throw e;
    }
    if (!hypothesis.length) return null;
    /**
     * ⛔⛔ DISCHARGING A LOCK OPENS THE **SOLID** AND LEAVES THE **VOLUME**,
     * and L20 measured it: with `shieldlocknorm@176,16` hypothesised open,
     * `plannerObstacleAt` stops calling (11,1) a `solid` and starts calling it
     * a `proximity-hazard` — which A* refuses to plan THROUGH just as firmly
     * (trap 147's shape, from the other side). The corridor to the buttonroom
     * runs over the lock's own cell, so a hypothesis that forgot the volume
     * would report the room unsolvable with both executors registered.
     *
     * ⇒ a discharged activator is exempted as well as opened. That is the
     * honest reading of the mechanism too: `ShieldLock.update`'s arm is
     * `if (p && !activate && …)`, so once it has latched, standing in it does
     * nothing at all.
     */
    const exempt = new Set([...contacts,
        ...hypothesis.filter((h) => h.kind === 'activator')
            .map((h) => `proximity-hazard:${h.id}`)]);
    try {
        planWaypoints(run.world, run.state, aim, null, solverPlanOpts(run, exempt, {
            liveBag: bagWithDischarged(run, run.liveGeometryOpts(), hypothesis),
        }));
        return { discharged: hypothesis.map((h) => h.id), exempt };
    } catch (e) {
        if (!(e instanceof BotDriverV2Error)) throw e;
    }
    return null;
}

/**
 * The trace rejection every hypothesised derivation owes — ⚖ guard (i)'s
 * "NAMES the set", in the shape `resolveShoveStrategy` already uses.
 */
const hypothesisRejection = (discharged) => (discharged?.length ? [{
    option: `the stance WITHOUT hypothesising [${discharged.join(', ')}]`,
    why: '⚖ §15.7a ruling 2: a stance reachable only once another pending '
        + 'strategy-selected obstacle is discharged is a legal derivation target — '
        + '§12.2\'s quantifier, applied to stances. Bounded to obstacles with a '
        + 'SELECTED and REGISTERED strategy (guard i); if any of these refuses later it '
        + 'becomes a wall and this stance is re-derived (guard ii).',
}] : []);

/**
 * Executor: the `hold` verb, with everything a leg spec used to declare
 * derived from live state — the presser from the frontier's own blocker id,
 * the stance from the presser's rect, the duration from the mechanism.
 */
function execHold(run, perTick, resolved, ctx) {
    return runHold(run, perTick, {
        presser: { x: resolved.target.x, y: resolved.target.y },
        ticks: resolved.hold.ticks,
        until: resolved.hold.until,
    }, ctx.what, ctx.before);
}

/**
 * Executor: the `shove` verb, with `dir` and `to` DERIVED (⚖ §11.8a ruling
 * 1) where a leg spec declared them. ONE continuous lean and a SINGLE settle:
 * `runShove` releases on the tick whose own `cTile` puts the landing on `to`
 * (trap 146's closed form, the verb's own) and asserts the block did not
 * travel past it — so there is no settle-wait to price against the danger map
 * (trap 154) beyond the one the verb already takes.
 */
function execShove(run, perTick, resolved, ctx) {
    return runShove(run, perTick, resolved.shove, ctx.what);
}

/**
 * ⛓⛓⛓ PROCGEN PoC SLICE 3b — Executor: the `weigh` verb, which is TWO
 * EXISTING VERBS AND NO NEW MECHANICS.
 *
 * `runShove` parks the block on the presser and `runDwell` waits out the fade
 * beside it. Nothing here counts ticks, presses a key, or asks the world a
 * question the two verbs do not already ask — the whole of what slice 3b adds
 * to the driver layer is the ORDER, and the order is the mechanism's:
 * `Button.update` publishes on the tick the block lands, and `Lock`'s fade
 * runs from there.
 *
 * ⛔ `runDwell` RATHER THAN `runHold`, and the difference is the whole slice.
 * `runHold`'s per-tick invariant is *"still inside the presser"* — a player
 * standing on the button — which is exactly the thing this strategy exists to
 * stop needing. The dwell's invariants (no transition, NO KEYS, no new hits)
 * are the right ones for a walker who is now a bystander to their own hold.
 *
 * ⚠ AND ITS SHUT-BEFORE REFUSAL IS LEFT ARMED ON PURPOSE. `runDwell` fails by
 * name if its condition is already true when it starts. That cannot happen at
 * the fades this game has — `opensOnTick` is 101 ticks against a release
 * coast of about five — so if it ever fires it is a real finding about the
 * shove's tail, and a branch here that swallowed it would be the graceful
 * fallback that reports a vacuous success. [[feedback_graceful_fallback_vacuous_replay]]
 */
function execWeigh(run, perTick, resolved, ctx) {
    /**
     * ⛓⛓ THE DWELL ARM (arc 3 slice S1, gap 3) — the same executor minus the
     * half there is no work for. ⛔ It is a BRANCH here rather than a second
     * executor row because the two arms end at the same postCondition, the same
     * `runDwell` and the same record shape: a `weigh` is "a Solid is on the
     * presser and the player waited out the fade", and whether the Solid had to
     * be pushed there is a fact about the ROOM, not about the verb.
     */
    if (resolved.dwellOnly) {
        const only = runDwell(run, perTick, resolved.dwell, `${ctx.what} (fade, block already home)`);
        return {
            kind: 'weigh',
            postCondition: 'press',
            dwellOnly: true,
            presser: { ...resolved.target },
            parked: { ...resolved.parked },
            dwell: only,
            ticks: only.ticks ?? 0,
        };
    }
    const shove = runShove(run, perTick, resolved.shove, `${ctx.what} (park the block)`);
    const dwell = runDwell(run, perTick, resolved.dwell, `${ctx.what} (fade)`);
    return {
        kind: 'weigh',
        postCondition: 'press',
        presser: { ...resolved.target },
        shove,
        dwell,
        ticks: (shove.ticks ?? 0) + (dwell.ticks ?? 0),
    };
}

/**
 * ⛓⛓⛓ R8 SLICE 4 — A PENDING DECLARATION IS AN OUTCOME, NOT A FAILURE.
 *
 * `createLevelRun` takes `persistence` **AT CONSTRUCTION**, so a run whose
 * own walk opens a gate cannot be handed the opening tick: only a solve
 * produces it. The executor that meets such a gate therefore does the whole
 * of its mechanical work — arms the ceiling, waits out the mechanism's own
 * bound — and then RAISES the declaration it needs, carrying the ticks it
 * spent. The harness (`twoPassSolve`) reads the tick from whichever oracle is
 * allowed for that mechanism and re-solves.
 *
 * ⛔ WHICH ORACLE IS A PROPERTY OF THE MECHANISM, NOT A PREFERENCE:
 *
 *   `model` — the run COMPUTES the consequence (`chaserKillLockOpens`, §11.5)
 *             and the responder's fade is `activators.opensOnTick`. A
 *             KILL-LOCK opened by chaser deaths is this case.
 *   `game`  — §11.4 REFUSES the consequence, so the model may not invent it.
 *             A static `"Enemy"` body's arrow death is this case: its clear
 *             is the declared v9 row precisely so ONE writer owns the slot.
 */
export class PendingDeclaration extends SolverRefusal {
    constructor(message, opts) {
        super(message, opts);
        this.name = 'PendingDeclaration';
    }
}

/**
 * ⛓ THE COUNTED BODIES A KILL-LOCK IS WAITING ON — asked of the census, not
 * of `run.chasers`.
 *
 * `Game.totalEnemies()` counts every counted body in the room, and this
 * model's live roster (`run.chasers`) holds only the classes the BRIDGE
 * steps. A room mixing a stepped body with an unstepped counted one would
 * have two different answers to "how many are left", and the lock answers to
 * the census's.
 */
function countedBodiesLeft(run) {
    const census = (run.world.combat?.enemies ?? []).filter((e) => e.counted !== false);
    /**
     * ⛔ TWO KINDS OF BODY AND TWO DIFFERENT LIVENESS QUESTIONS, and the
     * verdict is what tells them apart (§12.4's law, one consumer over).
     *
     *   a BRIDGED body in a STEPPED room — the census row never moves and
     *   never disappears, so its liveness is `run.chasers`;
     *   anything else — the model does not track it, so it is alive for
     *   exactly as long as the WORLD carries it. A declared clear rebuilds
     *   the room without the entity, which is precisely how a game-sourced
     *   declaration becomes observable to the policy.
     *
     * Reading `run.chasers` for BOTH would report every static body dead the
     * moment the roster is empty — and an empty roster has two causes with
     * opposite consequences (§12.4).
     */
    const stepped = (run.chaserRoomVerdict?.(run.level)?.stepped) === true;
    const live = new Set((run.chasers ?? []).map((c) => c.id));
    const bridged = new Set(bridgedChaserTags());
    return census.filter((e) => {
        const id = `${e.tag}@${e.x},${e.y}`;
        if (stepped && bridged.has(e.tag)) return live.has(id);
        return true;
    });
}

/** A census row's own persistence tag — `attrs.tag`, the `.oel` attribute. */
const persistTagOf = (e) => {
    const raw = e?.attrs?.tag ?? e?.persistTag;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
};

/**
 * ⛓⛓⛓ THE KILL WORK ORDER, RESOLVED — ⚖ §11.8a ruling 2's law applied to the
 * one strategy slice 3b left computed and unregistered (§12.8).
 *
 * Two shapes reach here and they are NOT the same problem:
 *
 *   · a KILL-LOCK on the frontier (`tset == -1`, L5's `lock@48,112`) — the
 *     post-condition is `Game.totalEnemies()` reaching zero, so the order is
 *     over EVERY counted body in the room and its phases are
 *     `ARROW_KILL_PLAN.phases` (press, clear, bait, dwell, back, hold);
 *   · a single BODY the ladder wants removed (L8's `sandtrap@96,80`) — the
 *     post-condition is that one body, and the phases collapse to press+hold.
 *
 * ⛔ THE WEAPON IS DERIVED BY MECHANISM IN BOTH: a presser whose group arms a
 * trap, with `ARROW_KILL_PLAN.presserSafety` asserted at the stance
 * (`lanesOver(playerBox)` EMPTY — a leg holding a button under a lane is
 * standing in its own volley).
 */
/**
 * ⛓ EXPORTED FOR ONE ROW (SEEDLING BOT R9, slice 1 — arc-3 A3): the two-arm
 * refusal this function produces is what A3 fixed, and pinning it through
 * `solveSegment` would need a whole recorded room to assert one sentence.
 * ⛔ It is not part of the solver's call surface — `resolveObstacleStrategy` is
 * the only caller and stays the only caller.
 */
export function resolveKillStrategy(run, obstacle, contacts) {
    const world = run.world;
    const row = (world.activators ?? []).find((a) => a.id === obstacle.id);
    if (!row || row.t !== KILL_LOCK_TSET) return null;
    const bodies = countedBodiesLeft(run);
    if (bodies.length === 0) return null;
    /**
     * ⛓⛓⛓ R8 SLICE 7 — THE **PRESS** ARM, AND IT IS ASKED FIRST BECAUSE IT
     * NEEDS NOTHING FROM THE ROOM.
     *
     * Slice 3b's kill was the ROOM'S OWN WEAPON — a presser whose group arms
     * a trap whose lane covers the body — and L18 has no trap at all. What it
     * has is a SWORD and two bodies whose `KILL_ARM_POLICY` row slice 6
     * flipped to `modelled`. So the order asked here is "can the player kill
     * these themselves", and only if not does it go looking for a ceiling.
     */
    const press = derivePressKill(run, bodies, contacts);
    /** ⛓ R9 slice 1 — `first === null` IS the refusal now, and `press.rejected`
     *  carries the press arm's own whys either way (see `derivePressKill`). */
    if (press.first) {
        return {
            strategy: 'kill',
            arm: 'press',
            postCondition: 'kill-lock',
            target: { x: row.x ?? obstacle.x, y: row.y ?? obstacle.y },
            lock: row,
            /**
             * ⛔ NO STANCE. Every executor before this one walks to a cell and
             * acts there; this one's position is a FUNCTION OF TIME, so a
             * `stance` the caller walked to first would be a cell the schedule
             * immediately re-derives away from. The verb owns its own
             * movement, and the FIRST strike is what says the order resolves
             * at all.
             */
            stance: null,
            first: press.first,
            plans: press.plans,
            bodies: press.plans.map((p) => p.id),
            rejected: [{
                option: 'kill by the room\'s own ceiling',
                why: `level ${run.level} has ${(world.arrowTraps ?? []).length} arrow `
                    + 'trap(s), so there is no ceiling to arm — the weapon is the '
                    + 'player\'s own press, which `KILL_ARM_POLICY` calls `modelled` for '
                    + `[${press.plans.map((p) => p.as3).join(', ')}]`,
            }, {
                option: 'hold',
                why: `${obstacle.id} carries \`tset == ${KILL_LOCK_TSET}\`, so NO button `
                    + 'in the game answers it — `checkEnemies()` opens it when '
                    + '`Game.totalEnemies()` reaches zero (§12.8).',
            }, ...press.rejected],
        };
    }
    const weapon = deriveCeilingWeapon(run, contacts);
    if (!weapon.presser) {
        return {
            strategy: 'kill',
            weapon: null,
            /**
             * ⛓⛓⛓ **BOTH ARMS' WHYS, THE PRESS ARM'S FIRST** (R9 slice 1 —
             * arc-3 A3). ⛔ Until this slice this row was
             * `[{option:'kill-by-ceiling', why: weapon.why}]` alone, and
             * `weapon.why` on a room with no arrow trap reads *"level N has NO
             * arrow trap, so it has no ceiling to arm"* — which is TRUE and is
             * an answer about the arm this room was never going to use. The
             * press arm is asked FIRST (see the order above), so its refusal is
             * the one a reader needs first; the ceiling's follows as the second
             * option that was also unavailable.
             */
            rejected: [...press.rejected, { option: 'kill-by-ceiling', why: weapon.why }],
        };
    }
    return {
        strategy: 'kill',
        postCondition: 'kill-lock',
        target: { x: row.x ?? obstacle.x, y: row.y ?? obstacle.y },
        lock: row,
        stance: weapon.stance,
        exempt: weapon.exempt,
        presser: weapon.presser,
        bodies: bodies.map((b) => `${b.tag}@${b.x},${b.y}`),
        rejected: [{
            option: 'hold',
            why: `${obstacle.id} carries \`tset == ${KILL_LOCK_TSET}\` `
                + '(`combat.KILL_LOCK_TSET`), so NO button in the game answers it — '
                + '`checkEnemies()` opens it when `Game.totalEnemies()` reaches zero. A '
                + 'policy that went looking for a presser for THIS lock would find none '
                + 'and report the obstacle unresolvable (§12.8).',
        },
        /**
         * ⛓ R9 slice 1 (arc-3 A3) — THE PRESS ARM'S **MEASURED** WHYS, not a
         * generic sentence about it. The press arm ran first and refused; it
         * knows exactly why, and it is now able to say so. The generic line
         * stands only when the arm produced nothing to report.
         */
        ...(press.rejected.length > 0 ? press.rejected : [{
            option: 'a PRESS arm against the bodies',
            why: 'the room\'s own ceiling is the weapon this rung uses; a press arm is a '
                + '`KILL_ARM_POLICY` question and a refusal retired without a driven '
                + 'witness is trap 101.',
        }])],
    };
}

/**
 * ⛓⛓⛓ R8 SLICE 7 — THE ANNULUS, DERIVED. ⚖ §11.8a's law on the one stance
 * this arc has had to prove SAFE rather than merely reachable.
 *
 * A `Spinner` is two circles about one point and the player has to be between
 * them:
 *
 *   · the HAMMER, `SPINNER.hammerLength` = 13 px. `Spinner.update` swings
 *     `collideLine("Player", x, y, x + 13·cos a, y + 13·sin a)` every tick at
 *     `a = (Game.time % 45) / 45 · 2π`, and **this model does not carry
 *     `Game.time`** — it counts DEAD FRAMES, a per-load variable. So the
 *     honest quantity is the UNION over all 45 phases, a 13 px disc, and
 *     `levelRun.assertPlayerClearOfHammers` refuses a box inside it BY NAME on
 *     an honest tape (§15.3.3's accurate wall).
 *   · the SWORD, `presses.SLASH_REACH` = 16 px from the player POINT to the
 *     body RECT, plus `slashRect`'s own overlap, which is the gate before it.
 *
 * ── ⛔⛔⛔ AND THE STATIC READING OF IT IS REFUTED BY L18's GEOMETRY ────
 *
 * §15.6.2 and the slice's own charge both describe a CELL to stand in. The
 * arithmetic is right and the cell does not exist. `assertNoStaticAnnulus`
 * below is the census, driven: of L18's 60 walkable cells, **one** is outside
 * every hammer disc for the whole horizon and it never gets a press at all;
 * **no** cell gets even two separated opportunities before a disc reaches it;
 * the second-safest cell in the room has a minimum clearance of −2.38 px. The
 * two orbits sweep the room long before three landings 30 ticks apart can
 * happen. ⚠ `r8-l18-spinner-press`'s two stances are the bodies' OWN entity
 * points, which is a `noDamage` artifact and not a stance.
 *
 * ⇒ ⚖ RULED (orchestrator/Fable, 2026-08-11, in reply to this session's
 * measurement): the press arm gets a **STRIKE SCHEDULE**, not a fifth rung —
 * a rung is a STRATEGY and this is the arm's PARAMETER DERIVATION, with
 * `ARROW_KILL_PLAN`'s six phases as the precedent one weapon over. Every
 * quantity is mechanism data:
 *
 *   LOITER  the argmax of MINIMUM clearance over the horizon — the room's own
 *           safest cell, which in L18 is (10,7) at 12.15 px.
 *   STRIKE  the earliest (cell, tick) whose WHOLE dispatch train is safe, that
 *           the controller can reach in time, and whose corridor is
 *           transit-safe at each cell's own ETA (`dangerDuringTransit`, the
 *           slice-5 instrument).
 *   CADENCE the RECEIVER's — `hitsTimerMax`, asked of the body's own live
 *           field rather than counted here (traps 85/93).
 *   END     OBSERVED: the body gone from `run.spinnerBodies` (§11.7).
 */
function derivePressKill(run, bodies, contacts) {
    /**
     * ⛓⛓⛓ **IT ALWAYS RETURNS ITS WHYS** (SEEDLING BOT R9, slice 1 — arc-3 A3).
     * Until this slice every refusing arm was `return null`, so the three
     * sentences this function had already written were DISCARDED and the caller
     * fell through to the ceiling arm's *"level N has NO arrow trap"* — a
     * refusal that names the arm nobody asked about. ⛔ `first === null` is now
     * the refusal, and `rejected` rides out of every arm: a refusal that names
     * its next work order is the cheapest planning instrument there is, and one
     * that names the WRONG arm sends the reader to the wrong room.
     *
     * @returns {{first:object|null, plans:Array, rejected:Array}} `first` is
     *   null on every refusal; `rejected` is never empty on one.
     */
    const no = (rejected) => ({ first: null, plans: [], rejected });
    const live = run.spinnerBodies ?? [];
    if (live.length === 0) {
        return no([{
            option: 'press a body',
            why: `level ${run.level} tracks NO live spinner bodies in this run, so there is `
                + 'no position to schedule a strike against — the press arm needs the body\'s '
                + 'position at the press, not its census cell (trap 157).',
        }]);
    }
    const liveById = new Map(live.map((b) => [b.id, b]));
    const rejected = [];
    for (const e of bodies) {
        const id = `${e.tag}@${e.x},${e.y}`;
        const as3 = ENEMY_CLASSES[e.tag]?.as3 ?? null;
        if (!liveById.has(id)) {
            rejected.push({
                option: `press ${id}`,
                why: 'this run does not track its live position — a press arm needs the '
                    + 'body\'s POSITION at the press, and the census placement is a cell '
                    + 'it left on tick one (trap 157).',
            });
            return no(rejected);
        }
        // ⚠ `KILL_ARM_POLICY`'s VALUE IS A ROW, NOT A STRING — `{policy, why}`.
        // Compared as a string this read `undefined !== 'modelled'` for every
        // class in the game and the arm could never have been reached.
        if (KILL_ARM_POLICY[as3]?.policy !== 'modelled') {
            rejected.push({
                option: `press ${id}`,
                why: `\`KILL_ARM_POLICY.${as3}\` is `
                    + `"${KILL_ARM_POLICY[as3]?.policy ?? 'absent'}", not "modelled" — a `
                    + 'refusal retired without a driven witness is trap 101.',
            });
            return no(rejected);
        }
    }
    /**
     * ⛔ THE ORDER IS RESOLVED ONLY IF A FIRST STRIKE EXISTS. A `kill` whose
     * schedule is empty is not a strategy for this obstacle, and saying so
     * here — before a tick is spent — is what turns "the room is unsolvable"
     * into a named refusal with the census behind it.
     */
    const first = deriveStrike(run, `${bodies[0].tag}@${bodies[0].x},${bodies[0].y}`,
        contacts, 0);
    if (!first || !first.cell) {
        rejected.push({
            option: 'a strike schedule',
            why: `no (cell, tick) in level ${run.level} over the next `
                + `${strikeHorizon(run)} ticks puts the whole five-dispatch train inside `
                + `${SLASH_REACH} px of a body while the player box stays clear of every `
                + `body's 7x7 rect and of ${hammerTestAt(run)} AND is reachable in time `
                + `along a transit-safe corridor. ${first?.considered ?? 0} `
                + 'opportunit(ies) were considered.',
        });
        if (first?.rejected?.length) rejected.push(...first.rejected.slice(0, 3));
        return no(rejected);
    }
    return {
        first,
        plans: bodies.map((e) => ({
            id: `${e.tag}@${e.x},${e.y}`,
            as3: ENEMY_CLASSES[e.tag]?.as3 ?? null,
        })),
        rejected,
    };
}

/**
 * ⛔ THE HORIZON IS THE ROOM'S, NOT A MEASUREMENT. A spinner is a billiard at
 * `moveSpeed` 1 px/tick with a friction FLOOR at the same speed, so a
 * traversal of the room in both axes bounds how long it can stay away from a
 * fixed cell. Named rather than tuned, and a derivation the horizon cannot
 * serve is a REFUSAL rather than a longer scan.
 */
function strikeHorizon(run) {
    return Math.ceil(2 * (run.world.width + run.world.height) * TILE_SIZE
        / SPINNER.moveSpeed);
}

/** Every walkable lattice cell of the current level, with its player box. */
function walkableCells(run, contacts) {
    const opts = solverPlanOpts(run, contacts, { nodeMargin: 0, triggerMargin: 0 });
    const pitch = DEFAULT_LATTICE;
    const out = [];
    for (let ty = 0; ty < run.world.height * TILE_SIZE / pitch; ty += 1) {
        for (let tx = 0; tx < run.world.width * TILE_SIZE / pitch; tx += 1) {
            const c = nodeCentre(tx, ty, pitch);
            if (plannerObstacleAt(run.world, c.x, c.y, null, opts)) continue;
            out.push({ ...c, box: playerBoxAt(c.x, c.y) });
        }
    }
    return out;
}

/**
 * ⛓⛓⛓ R8 SLICE 8 — THE ONE PREDICATE THE WHOLE SCHEDULE ASKS, AND IT ASKS
 * THE **EXACT** MECHANISM NOW.
 *
 * ⚖ THE USER'S CORRECTION (kickoff §16.8) reaches the policy layer through
 * this function and nowhere else: `deriveStrike`, `deriveRefuge`,
 * `trainIsSafeHere`, `stepToward` and `safeStep` all decide "is this box safe
 * from the hammers at forecast index i" HERE, so upgrading the question in one
 * place upgrades every one of them and cannot leave two of them disagreeing.
 *
 * With a clock (`run.gameTimeAt`) the test is the game's own two arms — the
 * 7x7 body's `collide("Player", x, y)` and the 13 px `collideLine` at THIS
 * index's own phase. Without one it is the union over all 45 phases, the disc
 * the slice-7 machinery was built under, which is still what is TRUE when the
 * phase is unknowable.
 *
 * ⛔ THE INDEX CONVENTION IS THE FORECAST'S: `forecast[i]` is the state at the
 * top of tick `ticksCompleted + 1 + i`, so the clock there is
 * `gameTimeAt(i + 1)` and NOT `gameTimeAt(i)`. Off by one here would price
 * every stance against the previous tick's hammer, which is a wrong answer
 * that looks right 44 times in 45.
 */
/**
 * ⛓⛓⛓ ARC 3 SLICE 2c — WHICH HAMMER TEST ACTUALLY DECIDED, in the refusal's
 * own words. ⚖ The user's own catch (2026-08-16), settled by probe 2b.
 *
 * ⛔ THE SENTENCES USED TO NAME A TEST THAT NO LONGER RUNS. Three refusals
 * below said *"the 13 px hammer disc"* — the UNION over all 45 phases, which
 * is `clearOfHammersAt`'s `at === null` FALLBACK and nothing else. Every
 * procgen boot declares `time = GENERATED_BOOT_TIME` (`procgenOracle
 * .bootStaging`), so on that path `gameTimeAt` never returns `null` and what
 * refused was the 7x7 BODY plus `hammerHitsPlayer`'s exact `collideLine` at
 * one phase. Measured, not reasoned: over probe 2b's 91 stored refusal texts
 * the disc's own markers (`UNION over all`, `not countable`) appear **0**
 * times and `hammer disc` appears **28**, all of them these sentences'
 * English. A reader taking them at face value concluded the solver was
 * conservative-by-disc; it is not.
 *
 * ⛔ SO IT IS ASKED, NOT ASSUMED. A tape that declares no `save.time` really
 * does get the union, and a sentence hard-coded to "the line" would be the
 * same defect pointing the other way — [[feedback_report_channel_borrows_gate_vocabulary]].
 * One `gameTimeAt(0)`, on the refusal path only, and the fallback branch is
 * the ONLY text that says "union over all 45 phases".
 */
function hammerTestAt(run) {
    const at = typeof run?.gameTimeAt === 'function' ? run.gameTimeAt(0) : null;
    return at === null
        ? `the ${SPINNER.hammerLength} px hammer's union over all 45 phases (this tape `
            + 'declares no `Game.time`, so no one phase is knowable)'
        : `the ${SPINNER.hammerLength} px hammer line at that tick's own phase`;
}

function clearOfHammersAt(run, box, forecast, i) {
    const step = forecast[i];
    if (!step) return false;
    const at = typeof run?.gameTimeAt === 'function' ? run.gameTimeAt(i + 1) : null;
    for (const r of step) {
        const cx = r.x + SPINNER.originX;
        const cy = r.y + SPINNER.originY;
        if (at === null) {
            if (box.x < cx + SPINNER.hammerLength && box.right > cx - SPINNER.hammerLength
                && box.y < cy + SPINNER.hammerLength && box.bottom > cy - SPINNER.hammerLength) {
                return false;
            }
            continue;
        }
        // `Enemy.hitPlayer` — the body, force 3 — then the hammer's line.
        if (box.right > r.x && box.x < r.right && box.bottom > r.y && box.y < r.bottom) {
            return false;
        }
        if (hammerHitsPlayer({ x: cx, y: cy }, at, box)) return false;
    }
    return true;
}

/**
 * ⛓ THE MARGIN A REFUGE PREFERS, WHICH IS NOT THE SAFETY TEST.
 *
 * Safety is the exact mechanism above; "which of the safe cells is the best
 * place to wait" is a ROBUSTNESS preference, and margin in pixels is the
 * honest way to express it — a raycast has no px clearance to report. So the
 * refuge FILTERS on the line and SCORES on the disc, and the two are kept
 * apart by name rather than by one standing in for the other.
 */
function discClearanceAt(box, forecast, i) {
    const step = forecast[i];
    if (!step) return -Infinity;
    let min = Infinity;
    for (const r of step) {
        const cx = r.x + SPINNER.originX;
        const cy = r.y + SPINNER.originY;
        const gap = Math.max(
            (cx - SPINNER.hammerLength) - box.right,
            box.x - (cx + SPINNER.hammerLength),
            (cy - SPINNER.hammerLength) - box.bottom,
            box.y - (cy + SPINNER.hammerLength),
        );
        if (gap < min) min = gap;
    }
    return min;
}

/**
 * ⛓⛓⛓ THE REFUGE — the safest cell to be in over ONE NAMED INTERVAL, and the
 * interval is the whole point.
 *
 * ⛔ THERE IS NO CELL SAFE FOR THE WHOLE FIGHT, and L18 measured it before a
 * line of this policy was written: of 60 walkable cells, ONE is outside every
 * disc for the full horizon — `(10,7)`, 12.15 px — and it sits BEHIND the very
 * kill-lock the fight exists to open, so it is not reachable while the fight
 * is on. Every reachable cell is entered by a disc within 238–537 ticks. A
 * "loiter cell" is therefore not a thing this room has.
 *
 * ⇒ what a WAIT needs is safety over ITS OWN dwell window (trap 154's
 * question, asked with the window the mechanism names rather than with
 * "for ever"): from now until the tick the player must leave for the next
 * strike. That interval is derived — it is the strike schedule's own — and a
 * refuge that cannot cover it is a REFUSAL rather than a shorter window.
 */
function deriveRefuge(run, contacts, untilIndex) {
    const forecast = run.spinnerForecast(Math.max(1, untilIndex));
    const clear = [];
    for (const c of walkableCells(run, contacts)) {
        // ⛓ R8 SLICE 8: SAFE is the exact mechanism (`clearOfHammersAt`), and
        // the px `min` is only the PREFERENCE among the safe ones. Before the
        // clock the two were one number, which is how a robustness heuristic
        // came to be the wall a room was declared unsolvable by.
        let min = Infinity;
        let safe = true;
        for (let i = 0; i < untilIndex; i += 1) {
            if (!forecast[i]) break;
            if (!clearOfHammersAt(run, c.box, forecast, i)) { safe = false; break; }
            const gap = discClearanceAt(c.box, forecast, i);
            if (gap < min) min = gap;
        }
        if (!safe) continue;
        clear.push({ x: c.x, y: c.y, clearance: min,
            d: Math.hypot(c.x - run.state.x, c.y - run.state.y) });
    }
    if (clear.length === 0) return null;
    /**
     * ⛔ REACHABILITY HERE IS **NOT** A TILE PATH, and that is trap 161 read
     * for the other half of the problem. `planWaypoints` answers "is there a
     * corridor over the walkable tiles", which is a question about GEOMETRY —
     * and what makes a refuge reachable is whether the controller can get
     * there before a disc arrives, which is a question about TIME. The
     * instrument that answers it is the controller's own preview, so the
     * candidates are ordered by how soon the walk ARRIVES (ties by clearance),
     * and the per-tick step is what adjudicates the way there.
     *
     * ⚠ BOUNDED, AND THE BOUND IS NAMED: only the `REFUGE_CANDIDATES` nearest
     * clear cells are previewed. A preview is a walk; previewing every clear
     * cell in the room would spend more ticks deciding than moving.
     */
    clear.sort((a, b) => a.d - b.d || b.clearance - a.clearance);
    let best = null;
    for (const c of clear.slice(0, REFUGE_CANDIDATES)) {
        const walk = previewWalk(run, [{ x: c.x, y: c.y }], DEFAULT_TOLERANCE);
        if (walk.truncated) continue;
        const eta = walk.samples.length;
        if (!best || eta < best.eta
            || (eta === best.eta && c.clearance > best.clearance)) {
            best = { x: c.x, y: c.y, clearance: c.clearance, eta };
        }
    }
    return best;
}

/** How many clear cells a refuge derivation previews. Named, not generous. */
const REFUGE_CANDIDATES = 12;

/**
 * ⛓⛓⛓ ONE STRIKE, DERIVED FROM WHERE THE PLAYER IS **NOW**.
 *
 * Returns `{cell, pressAt, aimAt, eta, rejected}` for the earliest feasible
 * strike on `bodyId`, or `null`. Feasible is four conditions, all mechanism:
 *
 *  1. THE BODY IS IN REACH at the LANDING tick — `distanceRectPoint <=
 *     SLASH_REACH` and `slashRect` overlapping, asked at the forecast's own
 *     position for that tick, because a spinner is AUTONOMOUS given the walk
 *     (⚖ §14.2 — `runRange` is 0, so its chase arm is dead code);
 *  2. THE CELL IS SAFE FOR THE WHOLE TRAIN — the aim tick, the press tick and
 *     all `SLASH_HIT_TICKS` dispatches, because `slashDelayMax` is ZERO and
 *     the test runs on every one of them;
 *  3. THE CONTROLLER CAN GET THERE — `previewWalk` is `drive`'s own loop on
 *     `run.previewStepper()`, so the ETA is the movement model that will
 *     actually drive and not a cruder one (trap 118's direction, applied to
 *     time);
 *  4. THE CORRIDOR IS TRANSIT-SAFE AT EACH CELL'S OWN ETA —
 *     `dangerDuringTransit`, the slice-5 instrument, which is the whole
 *     difference between "is this corridor safe" and "will something be here
 *     when I am" (trap 161).
 *
 * ⚠ THE SCAN IS BOUNDED AND SAYS SO. Only the first `STRIKE_CANDIDATES`
 * opportunities in tick order are previewed, because a preview is a walk and
 * a scan that previewed every one of the room's few hundred would spend more
 * time deciding than pressing. The bound is named in the refusal.
 *
 * ⛔⛔⛔ R8 SLICE 8 — AND THE BOUND BECAME THE WALL THE MOMENT THE INGREDIENT
 * GOT ACCURATE, which is trap 171 one layer up.
 *
 * Under the 13 px DISC almost no (cell, tick) was safe, so forty
 * opportunities in tick order spanned hundreds of ticks and the reachable
 * ones were among them. Under the exact hammer LINE most of the room is safe
 * most of the time — so the first forty all landed at `i = 2..5`, every one of
 * them a cell the controller needs forty-plus ticks to reach, and the whole
 * scan rejected itself with *"a strike the walk cannot reach is a window, not
 * a plan"*. The conservative ingredient had been HIDING a defect in the bound
 * ([[feedback_bounded_sweep_must_name_what_it_bounded]] — the truncation was
 * named, and what it truncated was not).
 *
 * ⇒ the candidates are pre-filtered by an ADMISSIBLE lower bound on the ETA
 * before the truncation runs. `applyInput` clamps EACH AXIS at `WALK_SPEED`,
 * so no walk can cover `max(|dx|, |dy|)` pixels in fewer than
 * `ceil(that / WALK_SPEED)` ticks — a bound the movement model cannot beat,
 * so a candidate it drops was never reachable and the truncation now spends
 * its forty previews on candidates that can be plans.
 */
const STRIKE_CANDIDATES = 40;

/**
 * ⛓ The fewest ticks the controller could possibly need to get from `from` to
 * `to` — `max(|dx|, |dy|) / WALK_SPEED`, because both axes accelerate
 * independently and each is clamped at `moveSpeed` (`applyInput`).
 *
 * ⚠ ADMISSIBLE, NOT ACCURATE. It ignores the acceleration ramp, the geometry
 * and the tolerance, all of which can only make the real walk LONGER — which
 * is the direction a pre-filter has to err in. `previewWalk` is still what
 * decides; this only stops the scan spending its budget on the impossible.
 */
function minTicksBetween(from, to) {
    return Math.ceil(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) / WALK_SPEED);
}

function deriveStrike(run, bodyId, contacts, notBefore = 0) {
    const index = (run.spinnerBodies ?? []).findIndex((b) => b.id === bodyId);
    if (index < 0) return null;
    const horizon = strikeHorizon(run);
    const forecast = run.spinnerForecast(horizon);
    const cells = walkableCells(run, contacts);
    // ⛓ The admissible ETA floor, once per cell — see `minTicksBetween`.
    const floor = new Map(cells.map((c) => [c, minTicksBetween(run.state, c)]));
    const opportunities = [];
    let unreachable = 0;
    for (let i = Math.max(1, notBefore); i < horizon - SLASH_HIT_TICKS - 1; i += 1) {
        const mine = forecast[i + 1]?.[index];
        if (!mine) continue;
        for (const c of cells) {
            // ⛔ BEFORE the truncation, never after: a candidate the movement
            // model provably cannot reach must not consume one of the forty.
            if (i - 1 < floor.get(c)) { unreachable += 1; continue; }
            if (distanceRectPoint(c.x, c.y, mine) > SLASH_REACH) continue;
            if (!rectsOverlapLocal(slashRectToward(c, mine), mine)) continue;
            /**
             * ⚠ THE TRAIN IS CHECKED ONE WIDER AT EACH END, and the reason is
             * the pairing rather than caution: the assert reads the PRE-MOVE
             * box against the POST-STEP bodies, so the tick the player arrives
             * on and the tick after the last dispatch are both compared
             * against a body this window would otherwise not have asked about.
             */
            let safe = true;
            for (let k = -2; k <= SLASH_HIT_TICKS + 1 && safe; k += 1) {
                if (!clearOfHammersAt(run, c.box, forecast, i + k)) safe = false;
            }
            if (!safe) continue;
            opportunities.push({ i, cell: c });
        }
        if (opportunities.length >= STRIKE_CANDIDATES) break;
    }
    const rejected = [];
    for (const o of opportunities) {
        // `previewWalk` returns the samples `drive` would spend getting there.
        const walk = previewWalk(run, [{ x: o.cell.x, y: o.cell.y }], DEFAULT_TOLERANCE);
        if (walk.truncated) {
            rejected.push({ option: `strike (${o.cell.x},${o.cell.y}) at +${o.i}`,
                why: 'the preview TRUNCATED — the corridor the controller would take is '
                    + 'blocked by the frozen geometry' });
            continue;
        }
        const eta = walk.samples.length;
        if (eta > o.i - 1) {
            rejected.push({ option: `strike (${o.cell.x},${o.cell.y}) at +${o.i}`,
                why: `the controller needs ${eta} tick(s) to arrive and the aim tick is `
                    + `+${o.i - 1} — a strike the walk cannot reach is a window, not a plan` });
            continue;
        }
        let unsafe = null;
        for (const sm of walk.samples) {
            const d = dangerDuringTransit(run, sm.tick, playerBoxAt(sm.x, sm.y),
                sm.arrows, sm.chasers);
            if (d.danger) { unsafe = { sm, d }; break; }
        }
        if (unsafe) {
            rejected.push({ option: `strike (${o.cell.x},${o.cell.y}) at +${o.i}`,
                why: `the corridor is not transit-safe: `
                    + `(${unsafe.sm.x.toFixed(1)},${unsafe.sm.y.toFixed(1)}) at its own ETA `
                    + `names ${unsafe.d.sources.map((x) => `${x.kind}:${x.id}`).join(', ')}` });
            continue;
        }
        return {
            cell: { x: o.cell.x, y: o.cell.y },
            pressAt: run.ticksCompleted + o.i,
            aimAt: run.ticksCompleted + o.i - 1,
            eta,
            rejected,
            considered: opportunities.length,
        };
    }
    return {
        cell: null,
        rejected,
        considered: opportunities.length,
        // ⛓ A BOUNDED SWEEP MUST NAME WHAT IT BOUNDED. The refusal now says
        // how many (cell, tick) pairs the ETA floor dropped as well as how
        // many were previewed — the two numbers a reader needs to tell "the
        // room has no strike" from "the scan ran out of budget".
        unreachable,
        truncated: opportunities.length >= STRIKE_CANDIDATES,
        horizon,
    };
}

/**
 * ⛔ IS STANDING HERE SAFE FOR THE WHOLE DISPATCH TRAIN?
 *
 * The schedule derives strikes that satisfy this; the LIVE arm above takes an
 * opportunity the schedule did not plan — an early arrival, a body that
 * wandered into reach — and an opportunity is not a plan. `slashDelayMax` is
 * ZERO, so a press commits the player to `SLASH_HIT_TICKS` ticks of standing
 * still: the same window the schedule checks, asked of where the player
 * actually is. ⚠ One wider at each end, for the pairing reason `deriveStrike`
 * records.
 */
function trainIsSafeHere(run) {
    const span = SLASH_HIT_TICKS + 3;
    const forecast = run.spinnerForecast(span);
    const box = playerBoxAt(run.state.x, run.state.y);
    for (let i = 0; i < span; i += 1) {
        if (!clearOfHammersAt(run, box, forecast, i)) return false;
    }
    return true;
}

/**
 * ⛓ ONE STEP TOWARD `aim` THAT DOES NOT LAND IN A DISC — the per-tick half of
 * the strike schedule, and the cheapest possible dodge.
 *
 * The five key sets the controller can produce are scored by (SAFE, then
 * distance to the aim after the step), with the intended one preferred on a
 * tie so a clear walk is byte-identical to a plain `chooseHeld`. ⚠ When
 * nothing is safe the intended set is returned unchanged and `safeStep` — the
 * guard one layer down — is what refuses by name: a mover that silently did
 * something else would be the walk deciding to hide a corner it walked into.
 */
function stepToward(run, aim, intended) {
    if (!aim || (run.spinnerBodies ?? []).length === 0) return intended;
    const forecast = run.spinnerForecast(STEP_LOOKAHEAD + 2);
    if (!forecast.length) return intended;
    const step = run.previewStepper();
    const options = [intended, ...Object.values(FACING_KEYS).map((k) => new Set([k])),
        new Set()];
    /**
     * ⛓⛓⛓ HOW DEEP THE STEP LOOKS, AND WHY ONE TICK IS NOT ENOUGH.
     *
     * The first cut scored each key set by "does it land in a disc next tick"
     * and L18 measured the consequence twice: the greedy walk took the safe
     * step every time and still arrived at (18.02,104.09) — the room's
     * bottom-left corner — with every one of the five options landing in a
     * disc. A step is not safe because it survives; it is safe because
     * something survives AFTER it. ⇒ the score is SURVIVAL DEPTH first (how
     * many consecutive ticks a safe continuation exists, capped at the
     * lookahead) and progress toward the aim second — which is the smallest
     * search that can tell a corner from a corridor.
     */
    const survives = (st, depth) => {
        if (depth >= STEP_LOOKAHEAD) return depth;
        let best = depth;
        for (const keys of options) {
            const next = step({ ...st }, keys);
            if (!clearOfHammersAt(run, playerBoxAt(next.x, next.y), forecast, depth + 1)) continue;
            const d = survives(next, depth + 1);
            if (d > best) best = d;
            if (best >= STEP_LOOKAHEAD) return best;
        }
        return best;
    };
    let best = null;
    for (const keys of options) {
        const next = step({ ...run.state }, keys);
        if (!clearOfHammersAt(run, playerBoxAt(next.x, next.y), forecast, 1)) continue;
        const depth = survives(next, 1);
        const d = Math.hypot(next.x - aim.x, next.y - aim.y);
        if (!best || depth > best.depth || (depth === best.depth && d < best.d)) {
            best = { keys, depth, d };
        }
    }
    return best ? best.keys : intended;
}

/**
 * ⛔ THE LOOKAHEAD, NAMED RATHER THAN GENEROUS. A `Spinner` moves one pixel a
 * tick and the player's own top speed is a little over two, so four ticks is
 * the span over which a step can still change which side of a body the player
 * ends up on — deeper buys a better dodge at 5x the previews per tick, and
 * shallower is what walked into the corner.
 */
const STEP_LOOKAHEAD = 4;


/**
 * ⛔ ONE TICK OF LOOKAHEAD AGAINST THE DISCS, WITH THE RUN'S OWN INSTRUMENTS.
 *
 * `run.previewStepper()` is `stepV2` bound to this run's own options (the
 * single `stepOptsFor` builder — a preview cannot assemble a second world),
 * and `run.spinnerForecast(1)` is the bodies at the tick the step lands on.
 * So "would this key set put me in a hammer" is asked of exactly the two
 * models that will answer it for real one tick later.
 *
 * Returns `held` when it is safe, else the first ALTERNATIVE that is. ⚠ A
 * press is never swapped out — the alternatives are movement, and a press tick
 * whose landing cell is unsafe is a strike the schedule should not have
 * planned; refusing it silently would hide that.
 */
function safeStep(run, held, alternatives, what, bodyId) {
    if ((run.spinnerBodies ?? []).length === 0) return held;
    /**
     * ⛔⛔⛔ INDEX **1**, NOT 0, AND THE OFF-BY-ONE IS THE WHOLE CHECK.
     * `advance` steps the spinners and THEN asserts, against the position the
     * PREVIOUS tick left: at `ticksCompleted = n` the assert about to run
     * compares `P(n)` with `S(n+1)` — already decided, whatever key is held.
     * The first assert this step can still change is the NEXT one, `P(n+1)`
     * against `S(n+2)`, and `spinnerForecast(2)[1]` is exactly that. Checking
     * index 0 is checking a verdict that has already been reached, which is
     * why the first cut of this guard changed nothing and the game's own
     * refusal still fired at tick 130.
     */
    const ahead = run.spinnerForecast(2)[1] ?? null;
    if (!ahead) return held;
    const step = run.previewStepper();
    const lands = (keys) => {
        const next = step({ ...run.state }, keys);
        // ⚠ `[ahead]` is a ONE-ELEMENT forecast whose index 0 is the run's
        // own index 1, so the clock is asked for `gameTimeAt(2)` by hand
        // rather than by the shared convention — see the comment above.
        return clearOfHammersAt(
            { gameTimeAt: (i) => run.gameTimeAt(i + 1) },
            playerBoxAt(next.x, next.y), [ahead], 0);
    };
    if (lands(held)) return held;
    if (held.has('primary')) {
        return fail(`${what}: the derived PRESS tick against ${bodyId} would land the `
            + `player box on a body's 7x7 rect or on ${hammerTestAt(run)}, on the next `
            + 'tick. A press whose own landing cell is unsafe is a strike the schedule '
            + 'should not have planned — swapping it for a dodge would hide that.',
        { code: HAMMER_SAFETY });
    }
    for (const alt of alternatives) {
        if (lands(alt)) return alt;
    }
    return fail(`${what}: every key set — the plan's own and `
        + `${alternatives.length} alternative(s) — lands the player box on a body's 7x7 `
        + `rect or on ${hammerTestAt(run)}, on the next tick, at `
        + `(${run.state.x.toFixed(2)},${run.state.y.toFixed(2)}) in level ${run.level}. `
        + 'There is no step out.', { code: HAMMER_SAFETY });
}

/**
 * ⛓⛓⛓ **R9 SLICE 11 — ONE NUMBERING, BOTH CONSUMERS** (⚖ ruling 29,
 * trap 498, the user's *"fixing `facingToward` is a high priority"*).
 *
 * ⛔ **THE DEFECT THIS PAIR CARRIED FOR THREE RUNGS, AND WHY IT STAYED GREEN.**
 * `FACING_KEYS` was `{0:right, 1:down, 2:left, 3:up}` and `facingToward` returned
 * `dy >= 0 ? 1 : 3` — the vertical pair SWAPPED against the game, which numbers
 * `Player.direction` **RIGHT 0 · UP 1 · LEFT 2 · DOWN 3** (`presses.js`, and
 * `playerPhysicsV2.nextDirection` is `sprites()`'s own chain and agrees). The pair
 * was **self-consistent as a KEY map** — `FACING_KEYS[facingToward(...)]` really did
 * hold the key that walks toward the target — and **wrong as a DIRECTION**:
 * `slashRectToward` and `execKillByPress`'s live reach test feed the SAME integer to
 * `presses.slashRect`, so for a target directly above or below the rect was computed
 * on the OPPOSITE side and no vertical strike cell could ever be accepted.
 *
 * ⛓ **ONE INTEGER, TWO VOCABULARIES** — that is the whole shape of it, and it is
 * why nothing was red: the defect only ever REFUSED opportunities, never pressed the
 * wrong way. ⇒ the numbering is `presses.js`'s, DERIVED rather than retyped (the
 * constants are imported, and there is no literal `1`/`3` below), and
 * `breakVerb.test.js` asserts the one integer against BOTH vocabularies at once —
 * the rect it produces AND the key it produces — which is the row that would have
 * caught this on day one.
 *
 * ⛔ **AND THERE IS ONLY ONE SPELLING OF IT NOW.** Slice 4 had no licence to move
 * tapes, so it built a correctly-numbered TWIN beside this pair
 * (`SLASH_DIRECTION_KEYS` / `slashFacingToward` / `slashRectAt`) and pointed the
 * `break` verb at it. Two spellings of one numbering is exactly the shape trap 357
 * names, and it is the thing this slice exists to end: the twin is DELETED and the
 * verb uses this pair.
 *
 * ⚠ **`Object.values(FACING_KEYS)` IS AN OPTION LIST, NOT ONLY A LOOKUP.**
 * `stepToward` and `safeStep` enumerate it and take the FIRST option on a tie, and
 * integer-like keys enumerate in ascending numeric order — so re-keying this map
 * re-ordered those two tie-breaks (`right,down,left,up` → `right,up,left,down`).
 * That is a real behavioural consequence of the repair, measured rather than
 * discovered later, and it is confined to rooms with live spinner bodies because
 * both functions return early without them.
 */
export const FACING_KEYS = Object.freeze({
    [RIGHT]: 'right', [UP]: 'up', [LEFT]: 'left', [DOWN]: 'down',
});

/**
 * Which of the four `Player.direction` values points from `cell` at `target`.
 *
 * ⛓ **EXPORTED, WITH `FACING_KEYS`, FOR ONE REASON**: the claim that repairs
 * trap 498 is *"the SAME integer is right in BOTH vocabularies"*, and no public
 * consumer exposes the integer — `slashRectToward` returns only the rect and the
 * kill arm returns only the key. A row driven through the consumers could assert
 * one vocabulary or the other and never that they agree, which is precisely the
 * hole the defect lived in. ⚠ `breakVerb.test.js` used to RESTATE this
 * arithmetic locally because it was module-private; a copy of the thing under
 * test is not a test of it.
 */
export function facingToward(cell, target) {
    const cx = (target.x + target.right) / 2;
    const cy = (target.y + target.bottom) / 2;
    const dx = cx - cell.x;
    const dy = cy - cell.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? RIGHT : LEFT;
    return dy >= 0 ? DOWN : UP;
}

/** `presses.slashRect` at the facing that points from `cell` at `target`. */
function slashRectToward(cell, target) {
    return slashRect(cell.x, cell.y, facingToward(cell, target));
}

/**
 * The presser whose group arms at least one trap in this room, nearest first,
 * with a REACHABLE stance that `ARROW_KILL_PLAN.presserSafety` clears.
 *
 * ⛔ SAFETY IS ASKED AT THE STANCE AND AS A WAIT (trap 154). The hold stands
 * the player still for hundreds of ticks under a firing ceiling; a cell that
 * is merely safe to walk through is not an answer to that question.
 */
function deriveCeilingWeapon(run, contacts) {
    const world = run.world;
    const traps = world.arrowTraps ?? [];
    if (traps.length === 0) {
        return { presser: null, why: `level ${run.level} has NO arrow trap, so it has no `
            + 'ceiling to arm. A kill by the room\'s own weapon needs the room to have one.' };
    }
    const options = (world.pressers ?? [])
        .map((presser) => ({ presser, arms: traps.filter((t) => t.t === presser.t) }))
        .filter((o) => o.arms.length > 0);
    if (options.length === 0) {
        return { presser: null, why: `no presser in level ${run.level} arms any of its `
            + `${traps.length} trap(s) — the room's presser groups are `
            + `[${(world.pressers ?? []).map((p) => `${p.tag}(t=${p.t})`).join(', ') || 'none'}] `
            + `and its trap groups are [${[...new Set(traps.map((t) => t.t))].join(', ')}]. `
            + 'A button that arms nothing is not a weapon.' };
    }
    options.sort((a, b) => Math.hypot(a.presser.x - run.state.x, a.presser.y - run.state.y)
        - Math.hypot(b.presser.x - run.state.x, b.presser.y - run.state.y));
    const { presser, arms } = options[0];
    const resolved = resolvePresser(world, { x: presser.x, y: presser.y },
        `solverBot kill-by-ceiling (${presser.tag}@${presser.x},${presser.y})`);
    const { stance, exempt } = deriveHoldStance(run, resolved, contacts);
    const lanes = arms.map((t) => laneRectOf(run, t));
    const over = lanes.filter((l) => rectsOverlapLocal(l, playerBoxAt(stance.x, stance.y)));
    if (over.length > 0) {
        return { presser: null, why: `the only reachable stance inside `
            + `${presser.tag}@${presser.x},${presser.y} sits UNDER `
            + `${over.length} of the lane(s) that button arms — `
            + '`ARROW_KILL_PLAN.presserSafety` refuses it by name: a leg holding a button '
            + 'under a lane is standing in its own volley, and this rung waits there.' };
    }
    return {
        presser: resolved, stance, exempt, arms, lanes,
        why: `${presser.tag}@${presser.x},${presser.y} (group t=${presser.t}) arms `
            + `[${arms.map((t) => t.id).join(', ')}] and its stance clears `
            + '`presserSafety`',
    };
}

/**
 * ⛓ A LANE THIS PRESSER'S GROUP WOULD ARM — armed-or-not.
 *
 * ⛔ AND THAT IS DELIBERATELY NOT `dangerMap.bodyKillRegions`. The bait phase
 * happens with the player OFF the button, so every one of this room's lanes
 * is DISARMED while the bait is being derived — and a derivation that asked
 * the live armed set would find nothing to aim at in exactly the room the
 * plan was written for. The question a bait's post-condition asks is "where
 * will the ceiling be firing when I go BACK", and the group is what answers
 * it. (Trap 160's law read forwards: the STATE layer must not answer a
 * question about the GEOMETRY either.)
 */
function ceilingKillRegions(run, weapon) {
    return weapon.arms.map((t) => ({
        kind: 'ceiling-lane',
        id: t.id,
        rect: laneRectOf(run, t),
        why: `\`${t.id}\` is in group t=${t.t}, which `
            + `${weapon.presser.tag}@${weapon.presser.x},${weapon.presser.y} arms`,
    }));
}

/**
 * The bait stance for the ceiling phase — `deriveBaitStance`'s four
 * conditions, with the kill regions supplied by the GROUP rather than by the
 * live armed set (see `ceilingKillRegions`).
 */
function deriveCeilingBait(run, body, contacts, regions) {
    const rows = ENEMY_CLASSES[body.tag];
    const leash = typeof rows?.aggro?.range === 'number' ? rows.aggro.range : 0;
    if (leash === 0 || (rows?.speed ?? 0) === 0) {
        return { stance: null, why: `${body.id} has leash ${leash} and speed `
            + `${rows?.speed ?? 0} — it never writes \`v\`, so there is no straight line `
            + 'to bend and nothing to lure. That body has to be killed where it stands.' };
    }
    const pitch = DEFAULT_LATTICE;
    const here = nodeAt(run.state.x, run.state.y, pitch);
    const planOpts = solverPlanOpts(run, contacts);
    const except = new Set(regions.map((r) => r.id));
    const candidates = [];
    let inLeash = 0;
    /**
     * ⛔ THE LATTICE IS UNBOUNDED AND THE LEVEL IS NOT. The first cut swept
     * ±8 cells around the live position and handed back `(120,56)` in a room
     * 112 px wide — a stance OUTSIDE the level, which `corridorPlans` was
     * happy to certify and the AVOID rung then refused with "outside the
     * level" three frames later. A candidate the world does not contain is
     * not a rejected candidate, it is a bug wearing one.
     */
    const w = run.world;
    const nx = (w.width * TILE_SIZE) / pitch;
    const ny = (w.height * TILE_SIZE) / pitch;
    for (let dy = -8; dy <= 8; dy += 1) {
        for (let dx = -8; dx <= 8; dx += 1) {
            const tx = here.tx + dx;
            const ty = here.ty + dy;
            if (tx < 0 || ty < 0 || tx >= nx || ty >= ny) continue;
            const c = nodeCentre(tx, ty, pitch);
            if (Math.hypot(c.x - body.x, c.y - body.y) > leash) continue;
            inLeash += 1;
            const crossed = regions.find(
                (r) => segmentCrosses({ x: body.x, y: body.y }, c, r.rect));
            if (!crossed) continue;
            /**
             * ⛔⛔ AND `presserSafety` IS **NOT** ASKED HERE, WHICH IS THE
             * OPPOSITE OF WHAT THE FIRST CUT DID — because the phase this
             * stance belongs to is the one in which the ceiling is OFF.
             *
             * `ARROW_KILL_PLAN.presserSafety`'s own words are *"assert
             * `lanesOver(playerBox, lanes)` is EMPTY **at the hold point**"*,
             * and a bait stance is not a hold point: the player got there by
             * stepping OFF the button, which unpublishes the group on the
             * same tick. Filtering the group's own lanes out of the candidate
             * set here would have refused the hand answer's own stance
             * `(72,96)` — which sits inside `arrowtrap@80,16`'s lane and took
             * ZERO hits in the game, because nothing was firing. The lanes
             * this order arms are excluded from the WAIT question and every
             * other danger the union knows is still asked.
             */
            if (dangerNow(run, c.x, c.y, except).danger) continue;
            candidates.push({ ...c, crossed, d: Math.hypot(c.x - run.state.x, c.y - run.state.y) });
        }
    }
    candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    for (const c of candidates) {
        if (!corridorPlans(run.world, run.state, { x: c.x, y: c.y }, null, planOpts)) continue;
        const travel = Math.hypot(c.x - body.x, c.y - body.y) / (rows.speed || 0.5);
        return {
            stance: { x: c.x, y: c.y },
            crossed: c.crossed,
            ticks: Math.ceil(travel) + MOBILE_DEATH_FADE.ticks + BAIT_SLACK,
            leash,
            why: `the straight line from ${body.id} at (${body.x.toFixed(1)},`
                + `${body.y.toFixed(1)}) to (${c.x},${c.y}) crosses ${c.crossed.id}'s lane, `
                + `the stance is inside the leash (${leash}) and outside every lane this `
                + 'order arms',
        };
    }
    return { stance: null, why: `no stance inside the level and within ${body.id}'s leash `
        + `(${leash}) pulls its straight line through one of this ceiling's `
        + `${regions.length} lane(s) from a cell the union map calls calm: ${inLeash} `
        + `cell(s) in leash, ${candidates.length} of them crossing, none reachable. `
        + '⛔ A stance safe to PASS is not safe to WAIT in (trap 154), and this rung asks '
        + 'the waiting question of everything except the lanes this order itself '
        + 'unpublishes by walking away from the button.' };
}

/**
 * ⛔ THE PENDING SENTINEL — a declaration whose TICK is not known yet.
 *
 * Pass 1 must be able to RUN, and `assertChaserRemovalIsDeclared` throws by
 * name when a removal opens a lock the tape declares no clear for (§11.5) —
 * which is exactly the state pass 1 is in on purpose. So pass 1 declares the
 * clear with this `at`, which says "this clear exists and its tick is what I
 * am about to measure". It is unreachable by construction (no run is
 * `Number.MAX_SAFE_INTEGER` ticks long), so `applyTimedClears` never fires
 * it, and `twoPassSolve` asserts that no EMITTED tape ever carries it.
 */
export const PENDING_AT = Number.MAX_SAFE_INTEGER;

/**
 * ⛓⛓⛓ R8 SLICE 4 — THE COLUMN HAS TO DRAIN, AND THE NUMBER IS THE COLUMN'S
 * OWN ARITHMETIC.
 *
 * The hold that killed the body leaves the player standing ON the button with
 * a volley still falling. `lanesUnpublishedByLeaving` correctly stops pricing
 * the LANE — the group goes false the tick the walk starts — but the arrows
 * ALREADY IN THE AIR are real, and a corridor probe evaluated at one instant
 * cannot price a body moving 5 px per tick: it reports the cell the arrow is
 * in RIGHT NOW, which is neither where it will be nor where it has been.
 *
 * ⇒ so the policy does what the mechanism says: step off the button (which
 * stops the next volley) to a cell outside every lane this ceiling owns, and
 * WAIT until the column is empty. ⛔ The bound is not a margin — it is the
 * distance from the highest spawn row to the floor over `ARROW.speed`, which
 * is exactly how long the last arrow can still be in the room. Same shape as
 * "the hold outlasts the kill by the responder's fade", one mechanism over.
 *
 * ⚠ AND A ZERO IS RECORDED RATHER THAN SKIPPED. A room whose last volley had
 * already landed needs no drain, and "there was nothing to wait for" and
 * "nobody looked" print the same thing otherwise.
 */
function drainCeiling(run, perTick, weapon, ctx) {
    const inFlight = () => (run.arrowsInFlight ?? []).length;
    if (inFlight() === 0) {
        return { phase: 'drain', ticks: 0,
            why: 'the column was already empty when the hold ended — no volley was still '
                + 'in the air, recorded as a ZERO rather than skipped' };
    }
    const lanes = weapon.arms.map((t) => laneRectOf(run, t));
    const pitch = DEFAULT_LATTICE;
    const here = nodeAt(run.state.x, run.state.y, pitch);
    const w = run.world;
    const nx = (w.width * TILE_SIZE) / pitch;
    const ny = (w.height * TILE_SIZE) / pitch;
    const planOpts = solverPlanOpts(run, new Set([...senseContacts(run)]));
    const candidates = [];
    for (let dy = -4; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
            const tx = here.tx + dx;
            const ty = here.ty + dy;
            if (tx < 0 || ty < 0 || tx >= nx || ty >= ny) continue;
            const c = nodeCentre(tx, ty, pitch);
            const box = playerBoxAt(c.x, c.y);
            // ⛔ OFF THE PRESSER, or the group is still published and the
            // ceiling keeps refilling the column this wait is draining.
            if (rectsOverlapLocal(box, weapon.presser.rect)) continue;
            if (lanes.some((l) => rectsOverlapLocal(l, box))) continue;
            candidates.push({ ...c, d: Math.hypot(c.x - run.state.x, c.y - run.state.y) });
        }
    }
    candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    const spot = candidates.find(
        (c) => corridorPlans(run.world, run.state, { x: c.x, y: c.y }, null, planOpts));
    if (!spot) {
        throw new SolverRefusal(`${ctx.what}: the ceiling's column is still falling `
            + `(${inFlight()} arrow(s) in flight) and NO reachable cell within four tiles `
            + `of the button is both off ${weapon.presser.tag}@${weapon.presser.x},`
            + `${weapon.presser.y} and outside all ${lanes.length} of its lanes. A wait `
            + 'that stays on the button refills the column it is waiting to drain.',
        { perTick: [...perTick] });
    }
    ctx.walkTo(ctx.goal, spot, {
        what: `${ctx.what} -> drain (step off ${weapon.presser.tag})`,
        contactsOverride: new Set(),
    });
    const fromY = Math.min(...weapon.arms.map((t) => arrowLaneForPlacement(t).fromY));
    const bound = Math.ceil((run.world.world.height - fromY) / ARROW.speed) + HOLD_SLACK;
    if (inFlight() === 0) {
        return { phase: 'drain', ticks: 0, at: spot,
            why: 'the walk off the button outlasted the last arrow — the column was empty '
                + 'on arrival, recorded as a ZERO' };
    }
    const rec = runDwell(run, perTick, {
        ticks: bound,
        why: `the ceiling's own column has to empty before a corridor through it can be `
            + `walked — ${inFlight()} arrow(s) are still falling`,
        until: {
            why: `level ${run.level} has no arrow in flight`,
            test: (r) => (r.arrowsInFlight ?? []).length === 0,
        },
    }, `${ctx.what} -> drain`);
    return { phase: 'drain', ticks: rec.ticks, bound, at: spot };
}

/** The census row a live body's id names — the placement both rosters key on. */
function censusRowFor(run, id) {
    const row = (run.world.combat?.enemies ?? []).find((e) => `${e.tag}@${e.x},${e.y}` === id);
    if (!row) fail(`solverBot: no census row for ${id} in level ${run.level}`);
    return row;
}

/**
 * ⛓⛓⛓ THE `kill` EXECUTOR — `ARROW_KILL_PLAN`'s six phases, every parameter
 * derived, and the last one raised as a PENDING DECLARATION.
 *
 *     press   the stance inside the presser (the loop's own `walkTo`)
 *     clear   hold — every body already under a lane dies where it stands
 *     bait    a stance whose straight line pulls a survivor THROUGH a lane
 *     dwell   the survivor's own travel time at its own `moveSpeed`
 *     back    the stance -> the presser
 *     hold    the kill; then the responder's fade, which the tape declares
 *
 * ⛔ THE PHASES ARE NOT A SCRIPT — they are a LOOP over the bodies the count
 * is still waiting on, and the room decides how many turns it takes. L5 needs
 * one bait (two bodies die in the `clear` phase, the third parks in the one
 * column no trap covers); a room whose bodies all start under a lane would
 * never enter the bait arm at all, and the record says which happened.
 */
function execKill(run, perTick, resolved, ctx) {
    if (resolved.arm === 'press') return execKillByPress(run, perTick, resolved, ctx);
    if (!resolved.presser) {
        throw new SolverRefusal(`${ctx.what}: the kill work order has no weapon — `
            + `${resolved.rejected?.[0]?.why ?? 'no reason recorded'}`,
        { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null },
            considered: resolved.rejected ?? [], perTick: [...perTick] });
    }
    const weapon = {
        presser: resolved.presser, arms: resolved.presser.arms ?? resolved.arms,
        stance: resolved.stance, exempt: resolved.exempt,
    };
    const arms = (run.world.arrowTraps ?? []).filter((t) => t.t === resolved.presser.t);
    weapon.arms = arms;
    const regions = ceilingKillRegions(run, weapon);
    /**
     * ⛓ The lanes this order's own presser arms, by id — the exclusion the
     * bait/dwell/back phases run under (see `withoutSources`). Scoped to THIS
     * group; a trap in another group is somebody else's ceiling and stays
     * priced.
     */
    const laneIds = new Set(regions.map((r) => r.id));
    /**
     * The responder's own fade, in the responder's own arithmetic — zero when
     * this order is not about a lock (a single body the ladder wanted gone
     * has no fade to outlast).
     */
    const fadeTicks = resolved.lock
        ? opensOnTick(RESPONDERS[resolved.lock.tag]?.fade ?? RESPONDERS.lock.fade)
        : 0;
    const phases = [];
    /**
     * ⛔⛔ THE SHUT-BEFORE SNAPSHOT IS TAKEN BEFORE THE APPROACH — §11.7's law,
     * and this executor is where it earns its keep twice.
     *
     * A hold's stance is INSIDE the presser, so the walk to it already arms
     * the ceiling: a snapshot taken at hold start describes a room already
     * firing, and `runHold`'s positive control ("silent before, shooting
     * after") then reports nothing to change and fails BY NAME. The FIRST
     * hold's snapshot is the loop's own `ctx.before`, taken before the
     * strategy's walk; every LATER hold gets one taken before its own `back`
     * walk, because the bait released the button and the ceiling really did
     * go quiet in between. Two snapshots, one law.
     */
    const snapshot = () => ({
        open: run.openActivators,
        armed: run.armedPulsers ?? new Set(),
        trapsArmed: run.armedArrowTraps ?? new Set(),
    });
    /**
     * ⛓⛓⛓ AND THE HOLD OUTLASTS THE KILL BY THE RESPONDER'S OWN FADE — the
     * one line of `ARROW_KILL_PLAN` that is about the LOCK rather than the
     * bodies, and the one the two-pass loop cannot do without.
     *
     * *"A hold that stopped at the kill would report a lock that was about to
     * open."* `checkEnemies()` arms the lock when the count reaches zero and
     * `Lock.activationStep` drains `opensOnTick(fade)` alpha steps before
     * `turnOff()` writes the durable flag. So the phase's stopping condition
     * is TWO claims: the bodies are gone (OBSERVED) and the fade has elapsed
     * since they went (ARITHMETIC, `activators.opensOnTick`, not a margin).
     *
     * ⛔ AND IT IS ONE `runHold` RATHER THAN TWO. A second call at the same
     * stance would snapshot a ceiling already armed and fail its own positive
     * control by name — §11.7's shut-before law biting the caller that split
     * a hold in half. One hold, one condition, two claims inside it.
     */
    let zeroAt = null;
    const holdFor = (label, bodies, before) => {
        const want = new Set(bodies.map((b) => `${b.tag}@${b.x},${b.y}`));
        const rec = runHold(run, perTick, {
            presser: { x: resolved.presser.x, y: resolved.presser.y },
            ticks: want.size * ARROW_KILL_FLOOR + fadeTicks + HOLD_SLACK,
            until: {
                why: `every body this phase is waiting on [${[...want].join(', ')}] has left `
                    + `level ${run.level}${fadeTicks
                        ? `, and — if that took the count to zero — ${fadeTicks} more tick(s) `
                        + `have elapsed for ${resolved.lock?.id ?? 'the lock'}'s own fade`
                        : ''}`,
                test: (r) => {
                    const left = countedBodiesLeft(r);
                    if (!left.every((b) => !want.has(`${b.tag}@${b.x},${b.y}`))) return false;
                    if (fadeTicks === 0 || left.length > 0) return true;
                    if (zeroAt === null) zeroAt = r.ticksCompleted;
                    return r.ticksCompleted >= zeroAt + fadeTicks;
                },
            },
        }, `${ctx.what} -> ${label}`, before);
        phases.push({ phase: label, ticks: rec.ticks ?? rec.held ?? null, bodies: [...want] });
        return rec;
    };

    // ── press is the loop's own walk to the stance; `clear` starts here ──
    const underLane = countedBodiesLeft(run).filter((b) => regions.some(
        (r) => rectsOverlapLocal(r.rect, { x: b.x, y: b.y, right: b.x + 16, bottom: b.y + 16 })));
    if (underLane.length > 0) holdFor('clear', underLane, ctx.before);
    else {
        phases.push({ phase: 'clear', ticks: 0, bodies: [],
            why: 'no counted body starts under one of this ceiling\'s lanes, so the '
                + '`clear` phase has nothing to wait for — recorded as a ZERO rather '
                + 'than skipped, because "nobody was in a lane" and "nobody looked" '
                + 'print the same thing otherwise' });
    }

    /**
     * ⛓ THE BAIT LOOP, BOUNDED BY THE BODIES THEMSELVES. Each turn removes at
     * least one body or refuses by name; a turn that removed nothing would be
     * the policy spinning, so the bound is the count it started with.
     */
    const started = countedBodiesLeft(run).length;
    for (let turn = 0; turn < started; turn += 1) {
        const left = countedBodiesLeft(run);
        if (left.length === 0) break;
        const live = (run.chasers ?? []).filter(
            (c) => left.some((b) => `${b.tag}@${b.x},${b.y}` === c.id));
        const body = live[0] ?? null;
        if (!body) {
            /**
             * ⛔ THE BODY THE COUNT IS WAITING ON IS NOT ONE THIS RUN STEPS —
             * so the model cannot watch it die, and §11.4 refuses to compute
             * the death of a static `"Enemy"` body. That is a GAME-SOURCED
             * declaration, raised rather than invented.
             */
            const stuck = left[0];
            throw new PendingDeclaration(`${ctx.what}: the count is still waiting on `
                + `[${left.map((b) => `${b.tag}@${b.x},${b.y}`).join(', ')}] and none of `
                + 'them is a body this run STEPS — so the model cannot watch it die, and '
                + '§11.4 refuses to compute a static `"Enemy"` body\'s arrow death '
                + '(its clear is the tape\'s DECLARED v9 row, and a second writer of one '
                + 'persistence slot is two cost models). The tick is the GAME\'s.',
            { goal: ctx.goal, obstacle: { kind: 'static-enemy', id: `${stuck.tag}@${stuck.x},${stuck.y}` },
                perTick: [...perTick],
                pending: {
                    level: run.level, tag: persistTagOf(stuck), source: 'game',
                    body: `${stuck.tag}@${stuck.x},${stuck.y}`,
                    why: '§11.4 refuses to compute a static `"Enemy"` body\'s death',
                } });
        }
        const bait = deriveCeilingBait(run, body, new Set([...(resolved.exempt ?? [])]), regions);
        if (!bait.stance) {
            throw new SolverRefusal(`${ctx.what}: ${body.id} survives the ceiling and no `
                + `bait stance pulls it into a lane — ${bait.why}`,
            { goal: ctx.goal, obstacle: { kind: 'enemy', id: body.id },
                considered: [{ option: 'bait', why: bait.why }], perTick: [...perTick] });
        }
        ctx.walkTo(ctx.goal, bait.stance, {
            what: `${ctx.what} -> bait (${body.id}) stance`,
            contactsOverride: new Set(),
            dangerExcept: laneIds,
        });
        phases.push({ phase: 'bait', stance: bait.stance, target: body.id, why: bait.why });
        const dwell = runDwell(run, perTick, {
            ticks: bait.ticks,
            why: `${body.id}: ${bait.why}`,
            until: {
                why: `${body.id} stands inside ${bait.crossed.id}'s lane — the cell the `
                    + 'ceiling will be firing into once the button is held again',
                test: (r) => (r.chasers ?? []).some((c) => c.id === body.id
                    && rectsOverlapLocal(bait.crossed.rect, bodyRectOf(c))),
            },
        }, `${ctx.what} -> dwell (${body.id})`);
        phases.push({ phase: 'dwell', ticks: dwell.ticks, target: body.id });
        const beforeBack = snapshot();
        ctx.walkTo(ctx.goal, resolved.stance, {
            what: `${ctx.what} -> back (${resolved.presser.tag})`,
            contactsOverride: resolved.exempt,
            dangerExcept: laneIds,
        });
        phases.push({ phase: 'back', stance: resolved.stance });
        /**
         * ⛓ THE `hold` PHASE WAITS FOR THIS BODY BY ITS CENSUS IDENTITY, not
         * by the live object — the id IS the placement (§19.3), and it is the
         * only name the count and the live roster share.
         */
        holdFor('hold', [censusRowFor(run, body.id)], beforeBack);
    }

    const left = countedBodiesLeft(run);
    if (left.length > 0) {
        throw new SolverRefusal(`${ctx.what}: the ceiling removed every body it could and `
            + `[${left.map((b) => `${b.tag}@${b.x},${b.y}`).join(', ')}] remain, so `
            + '`Game.totalEnemies()` never reaches zero and the kill-lock never arms.',
        { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null },
            perTick: [...perTick] });
    }

    /**
     * ⛓⛓⛓ THE COUNT IS ZERO AND THE LOCK IS STILL SHUT — WHICH IS CORRECT,
     * AND IS THE WHOLE REASON THE LOOP EXISTS.
     *
     * `checkEnemies()` arms the lock and `Lock.activationStep` drains 100
     * alpha steps before `turnOff()` writes the durable flag. This model does
     * not step a kill-lock's fade — §11.5's ruling, so that ONE writer owns
     * the persistence slot — so the run's own ledger has the REMOVAL tick and
     * `activators.opensOnTick` has the fade, and the sum is the declaration.
     */
    const opens = (run.chaserKillLockOpens ?? []).filter((o) => !o.nil && o.level === run.level);
    const mine = opens.filter((o) => o.opens.some((x) => x.at === resolved.lock.id));
    const last = mine[mine.length - 1] ?? opens[opens.length - 1] ?? null;
    if (!last) {
        throw new SolverRefusal(`${ctx.what}: every counted body is gone and the run's own `
            + 'kill-lock ledger (`chaserKillLockOpens`) recorded NOTHING — so nothing '
            + 'computed the consequence and there is no tick to declare. A ledger with no '
            + 'entry and a ledger nobody consulted print the same thing (trap 119).',
        { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null },
            perTick: [...perTick] });
    }
    /**
     * ⛓ AND IF THE LOCK IS ALREADY GONE, THE DECLARATION WAS HONEST. Pass 2
     * runs with the clear declared, so by the end of the fade hold the world
     * has been rebuilt without the lock — the executor returns and the loop
     * re-plans through a corridor that now exists.
     */
    const stillThere = (run.world.activators ?? []).some((a) => a.id === resolved.lock.id);
    if (!stillThere) {
        phases.push(drainCeiling(run, perTick, weapon, ctx));
        return {
            kind: 'kill', lock: resolved.lock.id, phases,
            removedAt: last.t, fade: fadeTicks, openedAt: run.ticksCompleted,
        };
    }
    throw new PendingDeclaration(`${ctx.what}: \`Game.totalEnemies()\` reached zero at tick `
        + `${last.t} (${last.id}, ${last.cause}) and ${resolved.lock.id} is ARMING — its own `
        + `${fadeTicks}-step fade has run and \`turnOff()\` writes the durable clear at the `
        + 'end of it. This model does not step a kill-lock\'s fade (§11.5: one writer per '
        + 'persistence slot), so the tick is the run\'s own ledger plus the responder\'s '
        + `own arithmetic: ${last.t} + ${fadeTicks} = ${last.t + fadeTicks}.`,
    { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock.id },
        perTick: [...perTick],
        pending: {
            level: run.level, tag: resolved.lock.persistTag ?? null,
            source: 'model', at: last.t + fadeTicks, removedAt: last.t, fade: fadeTicks,
            lock: resolved.lock.id, phases,
            why: `\`chaserKillLockOpens\` computed the removal at ${last.t} and `
                + `\`activators.opensOnTick(${RESPONDERS[resolved.lock.tag]?.fade
                    ?? RESPONDERS.lock.fade})\` is ${fadeTicks}`,
        } });
}

/**
 * ⛓⛓⛓ R8 SLICE 7 — THE `kill` VERB'S **PRESS** ARM: THE PLAYER IS THE WEAPON,
 * AND THE STANCE MOVES.
 *
 * The ceiling arm above waits for a room to do the killing. This one does it,
 * and two things make it different from every executor before it.
 *
 * ⛔⛔⛔ ONE — THE STANCE IS A CYCLE, NOT A CELL. L18's census (see
 * `assertNoStaticAnnulus`) says no cell in the room is both safe for the whole
 * fight and ever in reach. So the verb LOITERS in the room's safest cell, goes
 * to a derived (cell, tick) STRIKE when the forecast offers one it can reach,
 * and comes back. ⚖ Ruled as the press arm's parameter derivation rather than
 * as a fifth rung: a rung is a STRATEGY and this is where its numbers come
 * from.
 *
 * ⛔⛔⛔ TWO — A PRESS CONSUMES THE FACING THE TICK **STARTED** WITH.
 * `Player.slash` latches `slashDirection = direction` and `sprites()` — the
 * only writer of `direction` — runs BELOW `slash()` in `Player.update`, so the
 * rect a press swings is aimed by the PREVIOUS tick's velocity (`levelRun`'s
 * own `pressFacing`). The cycle therefore AIMS and then PRESSES on two
 * consecutive ticks; a stance that stood still would swing whatever way its
 * approach happened to leave it facing, which is a facing nobody derived.
 *
 * ⛔ AND THE CADENCE IS THE RECEIVER'S. `hitSpinner` sets `hitsTimer = 30` on
 * a landing, so tests 2..5 of the same press are refused and ONE PRESS IS ONE
 * HIT (traps 85/93). The loop presses only when the body's own `hitsTimer` is
 * down — the run's own field, never a counter kept here.
 */
function execKillByPress(run, perTick, resolved, ctx) {
    const NO_KEYS = new Set();
    const PRESS = new Set(['primary']);
    const from = perTick.length;
    const landings = [];
    const cycles = [];
    const contacts = new Set();
    let refuge = null;
    for (const plan of resolved.plans) {
        /**
         * ⛔ THE BOUND IS THE DERIVATION'S OWN HORIZON PER LANDING. Three
         * landings, each needing at most one full traversal of the room to
         * bring the body back past a strike cell, plus the walk there and
         * home. A body still standing when it runs out means the forecast and
         * the run disagree — which is a measurement, and `spinnerForecast` is
         * exact by construction (⚖ §14.2).
         */
        const bound = SPINNER.hitsMax * (strikeHorizon(run) + HOLD_SLACK);
        let strike = null;
        let aimed = false;
        let spent = 0;
        /**
         * ⛔⛔⛔ R8 SLICE 8 — THE CADENCE FLOOR, AND THE GAME IS WHAT FOUND IT
         * MISSING.
         *
         * The gate below is the RECEIVER's `hitsTimer`, and that is the right
         * question one tick too early: a press's hit tests run over
         * `T+1 … T+SLASH_HIT_TICKS`, so on the tick after a press the body's
         * timer is still 0 and the loop aims again. Driven, `r8-solve-18`
         * pressed at 33 and again at 35 — and `slashTimer` is 20, so the
         * game's own sword text ("double tap to dash") makes the second one a
         * **DASH THAT MOVES THE PLAYER**. The recording caught it at tick 36,
         * 2 px apart in x, with every other one of the 477 observations exact.
         *
         * ⇒ the schedule used to honour `combatVerbs.KILL_PRESS_CADENCE`,
         * `killSchedule`'s floor since R5, which this arm had never consulted.
         *
         * ⚠⚠ R9 SLICE 12b — **AND THE SECOND HALF OF THAT PARAGRAPH IS NOW
         * FALSE.** It read: *"It is the PRESSER's constraint, not the
         * receiver's … reading only the receiver's is how the dash rule went
         * unasked."* The dash rule is asked now — it is transcribed
         * (`combatVerbs.slashSet`), driven against the game
         * (`r9-l0-sword-dash`, three impulses digit for digit) and USED. What
         * `r8-solve-18` recorded at tick 36 was not a defect to be forbidden;
         * it was the game telling the truth about a mechanism the model did
         * not have. The floor is retired (⚖ ruling 31(b)) and what is left is
         * below.
         */
        /**
         * ⛓⛓⛓ R9 SLICE 12b — THIS IS THE TARGET'S CLOCK NOW, NOT THE PLAYER'S
         * (⚖ ruling 31(b)), and the docblock above is what made the change
         * safe to describe.
         *
         * The floor `KILL_PRESS_CADENCE` used to carry was a `max()` over two
         * rules: the RECEIVER's 30-tick i-frame plus one, and the PRESSER's
         * 20-tick dash window. The presser's half is retired — the dash is
         * transcribed and driven against the game — so what remains is the
         * receiver's, and the receiver's is PER BODY.
         *
         * ⛔⛔ BUT THE GATE BELOW STILL NEEDS THIS COUNTER, AND THE DOCBLOCK
         * ABOVE SAYS EXACTLY WHY: `body.hitsTimer === 0` is *"the right
         * question one tick too early"*. A press's hit tests run over
         * `T+1 … T+SLASH_HIT_TICKS`, so on the tick AFTER a press the target's
         * timer is still 0 and a rule reading only the timer would aim again
         * into a hit that has not landed yet. So the memory is what a press of
         * MINE is still owed, and it is measured in `SLASH_HIT_TICKS` rather
         * than in a cadence — leaving it at the old 31 would forbid a legal
         * second press on a DIFFERENT body, which the retirement is supposed
         * to allow.
         */
        let lastPressAt = -KILL_PRESS_CADENCE;
        for (; spent <= bound; spent += 1) {
            const body = (run.spinnerBodies ?? []).find((b) => b.id === plan.id);
            if (!body) break;
            let held = NO_KEYS;
            if (aimed) {
                held = PRESS;
                lastPressAt = run.ticksCompleted;
                aimed = false;
                strike = null;
            } else if (run.ticksCompleted - lastPressAt > SLASH_HIT_TICKS
                && body.hitsTimer === 0
                && distanceRectPoint(run.state.x, run.state.y, body.rect) <= SLASH_REACH
                && rectsOverlapLocal(slashRect(run.state.x, run.state.y,
                    facingToward(run.state, body.rect)), body.rect)
                && trainIsSafeHere(run)) {
                /**
                 * ⛓ IN REACH AND READY — aim this tick, press the next. The
                 * reach is asked of the LIVE body rather than of the schedule,
                 * because the schedule is a plan and the run is the fact: an
                 * early or late arrival that still finds the body in reach
                 * should press, and one that does not should not.
                 */
                held = new Set([FACING_KEYS[facingToward(run.state, body.rect)]]);
                aimed = true;
            } else {
                if (!strike || run.ticksCompleted > strike.pressAt) {
                    const next = deriveStrike(run, plan.id, contacts,
                        body.hitsTimer > 0 ? body.hitsTimer : 0);
                    if (next && next.cell) {
                        strike = next;
                        refuge = null;
                        cycles.push({
                            body: plan.id,
                            cell: next.cell,
                            pressAt: next.pressAt,
                            eta: next.eta,
                            considered: next.considered,
                            rejected: next.rejected.slice(0, 3),
                        });
                    } else {
                        /**
                         * ⛔ NO STRIKE YET — take a REFUGE over the interval
                         * the mechanism names: the body's own remaining
                         * i-frame, or one hammer period when it has none. A
                         * wait is priced over ITS OWN window (trap 154), and
                         * this is the window.
                         */
                        strike = null;
                        const window = Math.max(body.hitsTimer, SPINNER.hammerPeriod);
                        refuge = deriveRefuge(run, contacts, window);
                        if (!refuge) {
                            fail(`${ctx.what}: no reachable cell in level ${run.level} is `
                                + 'clear of every live body\'s 7x7 rect and of '
                                + `${hammerTestAt(run)} for the next ${window} tick(s), `
                                + `and no strike on ${plan.id} is derivable. The room has `
                                + 'nowhere to be.', { code: HAMMER_SAFETY });
                        }
                    }
                }
                const aim = strike ? strike.cell : refuge;
                if (aim && !hasArrived(run.state, aim, DEFAULT_TOLERANCE)) {
                    held = chooseHeld(run.state, aim, DEFAULT_TOLERANCE);
                }
                /**
                 * ⛓⛓⛓ THE APPROACH IS DISC-AWARE PER TICK, and the first cut
                 * measured why it has to be. A plain `chooseHeld` walks the
                 * straight line to the aim; the discs move across that line;
                 * and a guard that only checked the LAST step found the player
                 * already cornered — "every key set lands in a disc", which is
                 * a true report about a position the walk should never have
                 * been in. ⇒ the step is chosen from the five the controller
                 * can make, SAFE ONES FIRST and then by progress toward the
                 * aim, which is the same shape the AVOID rung has at corridor
                 * scale (⚖ §11.8a) asked at tick scale, where a moving hazard
                 * is the only thing that can answer it.
                 */
                held = stepToward(run, aim, held);
            }
            /**
             * ⛓⛓⛓ THE PER-TICK NEXT-CELL CHECK — ⚖ §14.2 ruling 3, and it is
             * what makes the schedule a PLAN rather than a promise.
             *
             * "Planning optimism is bounded by the live loop": the strike was
             * derived from a forecast taken at one tick, and by the time the
             * walk is halfway there the controller's own overshoot has moved
             * the player off the previewed line. So every step is checked
             * against the disc it would land in NEXT TICK, with the run's own
             * stepper and the run's own forecast — the probe PRUNES, the tick
             * ADJUDICATES. ⛔ The first cut had no such check and the game's
             * own refusal caught it at tick 130, which is the accurate wall
             * doing its job and not a reason to widen anything.
             */
            held = safeStep(run, held, [NO_KEYS, ...Object.values(FACING_KEYS)
                .map((k) => new Set([k]))], ctx.what, plan.id);
            const before = (run.spinnerPressHits ?? []).length;
            perTick.push(held);
            const { transition } = run.advance(held);
            if (transition) {
                fail(`${ctx.what}: the run crossed to level ${transition.to_level} while `
                    + `pressing ${plan.id}. A kill does not survive the door (trap 150).`);
            }
            for (const h of (run.spinnerPressHits ?? []).slice(before)) {
                if (h.landed) landings.push({ t: h.t, id: h.id, hits: h.hits });
            }
        }
        if ((run.spinnerBodies ?? []).some((b) => b.id === plan.id)) {
            /**
             * ⛓⛓⛓ ARC 3 SLICE 2d — STAMPED, AND THE STAMP IS WHAT MAKES THIS
             * A REVERT INSTEAD OF A DEAD RUN.
             *
             * ⛔ THE MESSAGE IS UNCHANGED. Probe 2b found this exact sentence
             * in the most expensive item of the arc (§9b.5) and read the cause
             * off it; re-wording it here would cost that reading nothing and
             * buy nothing. What changes is that the throw now SAYS what class
             * it is, in a field: `STRIKE_BOUND_EXHAUSTED` plus the bound it
             * exhausted, so `procgenOracle` classifies it as a budget verdict
             * rather than propagating it as a generator defect.
             *
             * ⚠ THIS IS THE ONLY CODED THROW IN THE FILE THAT IS NOT ABOUT
             * HAMMER SAFETY, and the two are kept apart on purpose: the hammer
             * sites claim the LEVEL has nowhere to stand, this one claims only
             * that a bound ran out. They reach different verdicts.
             */
            fail(`${ctx.what}: ran the strike schedule against ${plan.id} for the whole `
                + `${bound}-tick bound (${cycles.length} strike(s) planned, `
                + `${landings.length} landing(s)) and the body is still in the world.`,
            { code: STRIKE_BOUND_EXHAUSTED, boundTicks: bound });
        }
    }
    /**
     * ⛓ AND THE LOCK'S OWN FADE OUTLASTS THE LAST KILL. `checkEnemies()` opens
     * a `tset == -1` lock when the count reaches zero, and a `Lock` then takes
     * `activators.opensOnTick` ticks to stop being solid — the same arithmetic
     * `deriveHold` uses, asked here because this order has no button to stand
     * on while it runs. ⚠ The wait happens at the LOITER cell: a fade is a
     * WAIT, and trap 154's question is asked of it exactly as of a dwell.
     */
    const fade = resolved.lock
        ? opensOnTick(RESPONDERS[resolved.lock.tag]?.fade ?? RESPONDERS.lock.fade)
        : 0;
    if (!resolved.lock) {
        return { verb: 'kill', arm: 'press', from, ticks: perTick.length - from,
            landings, cycles, bodies: resolved.bodies };
    }
    /**
     * ⛔⛔⛔ R8 SLICE 8 — THE TAIL WAS `run.openActivators.has(lock)`, AND THAT
     * PREDICATE CAN NEVER BE TRUE.
     *
     * `stepActivators`' activation line is `active = a.t >= 0 && (pressed ||
     * latched)`, so a `tset == -1` lock is unreachable by construction — as it
     * must be, because no button in the game answers one. What opens it is
     * `checkEnemies()`, whose model-side channel is the TAPE's declared v9
     * `at` row (one writer per persistence slot, §11.5), and `applyTimedClears`
     * then rebuilds the room without the lock.
     *
     * ⇒ this is `execKillByCeiling`'s own tail, verbatim in shape: wait out the
     * fade, and then either the lock is GONE (pass 2 — the declaration was
     * honest and the corridor exists) or raise a `PendingDeclaration` carrying
     * the tick the model computed. The press arm was the only kill arm without
     * it, so a spinner room could kill everything and then sit out a 101-tick
     * fade waiting for a writer that does not exist.
     */
    for (let i = 0; i <= fade + HOLD_SLACK; i += 1) {
        if (!(run.world.activators ?? []).some((a) => a.id === resolved.lock.id)) {
            return { verb: 'kill', arm: 'press', from, ticks: perTick.length - from,
                landings, cycles, bodies: resolved.bodies };
        }
        /**
         * ⚠ THE FADE IS A WAIT TOO, and with the bodies gone the discs are
         * gone with them — `run.spinnerBodies` is empty, so every cell is a
         * refuge and standing still is the honest answer (and one span).
         */
        perTick.push(NO_KEYS);
        run.advance(NO_KEYS);
    }
    /**
     * ⛓ THE TICK IS THE RUN'S OWN LEDGER PLUS THE RESPONDER'S ARITHMETIC —
     * `spinnerKillLockOpens` is the REMOVAL-time scan (`totalEnemies()` counts
     * entities, so the count moves at `FP.world.remove`, eleven fade steps
     * after the killing blow) and `opensOnTick` is the `Lock`'s own hundred
     * alpha steps. Neither is measured here; both are read.
     */
    const opens = (run.spinnerKillLockOpens ?? [])
        .filter((o) => !o.nil && o.level === run.level);
    const mine = opens.filter((o) => o.opens.some((x) => x.at === resolved.lock.id));
    const last = mine[mine.length - 1] ?? opens[opens.length - 1] ?? null;
    if (!last) {
        return fail(`${ctx.what}: every counted body is dead and the run's own kill-lock `
            + 'ledger (`spinnerKillLockOpens`) recorded NOTHING — so nothing computed the '
            + 'consequence and there is no tick to declare. A ledger with no entry and a '
            + 'ledger nobody consulted print the same thing (trap 119).');
    }
    throw new PendingDeclaration(`${ctx.what}: \`Game.totalEnemies()\` reached zero at tick `
        + `${last.t} (${last.id}) and ${resolved.lock.id} is ARMING — its own ${fade}-step `
        + 'fade has run and `turnOff()` writes the durable clear at the end of it. This '
        + 'model does not step a kill-lock\'s fade (§11.5: one writer per persistence '
        + `slot), so the tick is ${last.t} + ${fade} = ${last.t + fade}.`,
    { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock.id },
        perTick: [...perTick],
        pending: {
            level: run.level, tag: resolved.lock.persistTag ?? null,
            source: 'model', at: last.t + fade, removedAt: last.t, fade,
            lock: resolved.lock.id,
            why: `\`spinnerKillLockOpens\` computed the removal at ${last.t} and `
                + `\`activators.opensOnTick(${RESPONDERS[resolved.lock.tag]?.fade
                    ?? RESPONDERS.lock.fade})\` is ${fade}`,
        } });
}

/** Executor: the `collect` verb, bound to live state. */
function execCollect(run, perTick, resolved, ctx) {
    return runCollect(run, perTick, { pickup: { x: resolved.target.x, y: resolved.target.y } },
        ctx.maxTicksPerTarget, ctx.what);
}

/** Executor: the `chest` verb, with the shut-before snapshot it demands. */
function execChest(run, perTick, resolved, ctx) {
    return runChest(run, perTick, { chest: { x: resolved.target.x, y: resolved.target.y } },
        ctx.maxTicksPerTarget, ctx.what, ctx.before);
}

// ── R8 SLICE 7 — THE THREE MECHANISMS D2's LAST ROOMS ARE MADE OF ─────

/**
 * ⛓⛓⛓ THE FIGHT'S STANCE, DERIVED — and it is ONE HELD KEY doing four jobs.
 *
 * `ShieldBoss.hitPlayer` counts a player inside its own 48x16 BAND —
 * `shieldBossBandRect`, the strip directly BELOW the 48x48 body — for
 * `SHIELD_BOSS.swingTimeMax` CONSECUTIVE updates while the animation is
 * `"sit"`, and that count is the ONLY thing that opens `movedShield`, the one
 * animation `ShieldBoss.hit` forwards through. So the stance is not a place to
 * stand near: it is inside the damage volume, on purpose.
 *
 * ⛔ AND A LATTICE CELL IN THE BAND IS NOT ENOUGH. The band and the SLASH have
 * different reaches: from the cell below the body the box already overlaps the
 * band, but `slashRect(x, y, UP)` is a 32x16 rect whose top edge is 16 px above
 * the player, and `Player.slash`'s second gate is
 * `distanceRectPoint(x, y, bodyRect) <= SLASH_REACH`. Standing at the cell
 * centre the slash rect ENDS exactly on the body's bottom edge and overlaps
 * nothing — a press that would look right and hit nothing.
 *
 * ⇒ the stance is the cell, and the verb then HOLDS `up`: the walk into the
 * body PINS the player against it (`Mobile.moveX/moveY` stop at a solid), which
 * puts the box deep in the band AND inside the slash's reach AND holds
 * `direction` UP so every latched `slashDirection` aims at the body. R6 slice
 * 5's own window is one held key for the same four reasons; this derives the
 * cell it started from rather than booting on top of it.
 */
function deriveFightStance(run, boss, contacts, blocked = []) {
    const band = shieldBossBandRect({ x: boss.ex, y: boss.ey });
    const body = shieldBossBodyRect({ x: boss.ex, y: boss.ey });
    const pitch = DEFAULT_LATTICE;
    const opts = solverPlanOpts(run, contacts, { nodeMargin: 0, triggerMargin: 0 });
    const centre = { x: (band.x + band.right) / 2, y: (band.y + band.bottom) / 2 };
    const cell = nodeAt(centre.x, centre.y, pitch);
    const candidates = [];
    for (let dy = 0; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
            const c = nodeCentre(cell.tx + dx, cell.ty + dy, pitch);
            // Under the band's own x span, so the hold walks STRAIGHT up into
            // the body rather than along its side.
            if (c.x < band.x || c.x >= band.right) continue;
            if (plannerObstacleAt(run.world, c.x, c.y, null, opts)) continue;
            candidates.push({ d: Math.abs(c.x - centre.x) + (c.y - centre.y), ...c });
        }
    }
    candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    const hypothesis = stanceHypothesis(run, blocked, contacts);
    for (const c of candidates) {
        const reached = stanceReaches(run, { x: c.x, y: c.y }, contacts, hypothesis);
        if (reached) {
            return {
                stance: { x: c.x, y: c.y },
                discharged: reached.discharged,
                band,
                body,
            };
        }
    }
    throw new SolverRefusal(
        `solverBot: no REACHABLE stance under ${boss.id}'s band in level ${run.level} — `
        + `${candidates.length} walkable cell(s) beneath [${band.x},${band.right}) and `
        + `none with a corridor from (${run.state.x},${run.state.y}). The band is the `
        + 'only place the stand-under count runs, so a fight with no stance is not a '
        + 'strategy for this obstacle.',
        { obstacle: { kind: 'solid', id: boss.id } });
}

/**
 * ⛓ RESOLVE the `fight` work order. The boss's own body IS the obstacle and
 * the post-condition is its REMOVAL — not its death, which is 34 ticks
 * earlier: `startDeath` writes `{19,0}` and does NOT set `destroy`, `endAnim`
 * does, and `Mobile.death`'s eleventh fade call asks for the removal that
 * `updateLists()` drains one tick later (R6 §13.5's four instants).
 */
function resolveFightStrategy(run, obstacle, contacts, blocked = []) {
    const boss = (run.world.shieldBosses ?? []).find((b) => b.id === obstacle.id);
    if (!boss) return null;
    // ⚠ THE ROW, NOT A STRING — `{policy, why}`. See `derivePressKill`.
    if (KILL_ARM_POLICY[boss.cls?.as3 ?? 'ShieldBoss']?.policy !== 'modelled') return null;
    const { stance, discharged, band } = deriveFightStance(run, boss, contacts, blocked);
    return {
        strategy: 'fight',
        postCondition: 'removal',
        target: { x: boss.x, y: boss.y },
        boss: obstacle.id,
        stance,
        discharged,
        band,
        rejected: [{
            option: 'route around the body',
            why: `${obstacle.id} is a 48x48 \`Mobile.solids\` member standing in the `
                + 'three columns that are this room\'s only way north — the wall, the key '
                + 'and the exit are one object (R6 §13.6). There is no route around it.',
        }, {
            option: 'wait out the stab and walk past',
            why: '`hitPlayer`\'s band is BOTH the trigger volume of the stand-under and '
                + 'the damage volume of the stab, so the only way to be in it safely is '
                + 'to land a hit inside `movedShield` — `ShieldBoss.hit`\'s landing arm '
                + 'calls `sit()`, which aborts the chain BEFORE frames 5..8 damage '
                + 'anything. Standing there without pressing is the one hit this route '
                + 'cannot afford.',
        }, ...hypothesisRejection(discharged)],
    };
}

/**
 * ⛓⛓⛓ THE PRESS SCHEDULE, DERIVED FROM THE RECEIVER'S OWN ARITHMETIC — the
 * ⚖ §11.8a law's hardest case on this arc, because every number here is one a
 * hand-tuned constant could have stood in for.
 *
 * `shieldBossWindowFor(S)` answers where the sword may land, given the tick
 * `startStab(false)` ran: `moveShield` advances on `S … S+move-1` and swaps at
 * the END of that last one, so `movedShield` is already up when the PLAYER
 * updates on `S+move-1`, and it ends when `movedShield`'s own callback fires —
 * again BEFORE the player. The window is inclusive `[windowFrom, windowTo]`.
 *
 * ⛔ AND A PRESS IS NOT A HIT — IT IS FIVE (traps 85/93). `Player.slash`'s
 * `slashDelayMax` is ZERO, so the test runs on every tick `slashing` is up:
 * `T+1 … T+SLASH_HIT_TICKS`. So the press tick T must satisfy
 *
 *     T + 1 >= windowFrom     (the first dispatch is inside the window)
 *     T + SLASH_HIT_TICKS <= windowTo   (and so is the last)
 *
 * and the EARLIEST such T is taken — `windowFrom - 1`. Earliest rather than
 * centred because the window is a fixed 16 ticks and every tick spent inside
 * it is a tick the band counter is not running toward the next one; and
 * because a schedule that aimed at the middle would be a preference, while
 * "the first tick whose whole dispatch train fits" is arithmetic.
 *
 * ⚠ THE FIRST PRESS OF THE ROOM SPENDS ITS FIRST DISPATCH ON THE ARMING
 * SWALLOW and lands on its SECOND — `activated` is an instance field with no
 * persistence behind it, so the first `hit()` after every room entry returns
 * above everything (R6 §13.2). That costs the schedule NOTHING, which is why
 * three presses buy three hits: the swallowed dispatch is absorbed by the
 * first LANDING press, whose `hitsTimer = 30` then refuses the four behind it.
 */
export function shieldBossPressTick(window) {
    const earliest = window.windowFrom - 1;
    const latest = window.windowTo - SLASH_HIT_TICKS;
    if (latest < earliest) {
        fail(`shieldBossPressTick: the window [${window.windowFrom},${window.windowTo}] is `
            + `shorter than one press's ${SLASH_HIT_TICKS} dispatches — no press tick puts `
            + 'the whole train inside it, and a press that straddles the edge is a '
            + 'retaliation waiting to happen.');
    }
    return earliest;
}

/**
 * Executor: the `fight` verb — one held key, a derived press per window, and a
 * completion that is OBSERVED rather than scheduled (§11.7's law).
 *
 * ⛔ THE COMPLETION IS THE **REMOVAL**, and the run's own ledger is what says
 * so: `run.shieldBossKills` carries a `removeRequested` row on the tick
 * `FP.world.remove` was CALLED, and the body is still in the type list for the
 * rest of that tick — so the wall ends one tick later. Waiting for the tag or
 * for `destroy` would walk into a solid for 34 or 11 ticks (R6 §13.5, set by
 * the game's own first recording).
 */
function execFight(run, perTick, resolved, ctx) {
    const id = resolved.boss;
    const UP = new Set(['up']);
    const UP_PRESS = new Set(['up', 'primary']);
    const from = perTick.length;
    /**
     * ⛔ THE BOUND IS THE MECHANISM'S, NOT A GENEROUS NUMBER. Three landed
     * hits need three stand-under cycles of `swingTimeMax`, each preceded by
     * the walk into the band and followed by the window; then the death's
     * four instants. `HOLD_SLACK` per cycle is the approach term nobody can
     * derive, and the bound stays a claim this verb can refute.
     */
    const cycles = SHIELD_BOSS.hitsMax;
    const bound = cycles * (SHIELD_BOSS.swingTimeMax
        + SHIELD_BOSS.hitsMax * SLASH_HIT_TICKS + HOLD_SLACK)
        + shieldBossDeathSchedule(0).removedTick + HOLD_SLACK;
    let pressAt = null;
    let seenStabs = 0;
    let presses = 0;
    const windows = [];
    const removedAt = () => (run.shieldBossKills ?? []).find(
        (k) => k.id === id && k.what === 'removeRequested');
    for (let spent = 0; spent <= bound; spent += 1) {
        const gone = removedAt();
        // ⛔ ONE TICK AFTER THE REQUEST — `updateLists()` drains `_remove`
        // AFTER `World.update`, and the Player updates LAST, so the body is a
        // wall for the whole of the request tick.
        if (gone && perTick.length > gone.t + 1) {
            return {
                verb: 'fight', target: id, from, ticks: perTick.length - from,
                presses, windows, removedAt: gone.t,
            };
        }
        /**
         * ⛓ THE SCHEDULE IS READ OFF THE RUN, not counted here. Every
         * `startStab(false)` pushes a row carrying its own derived window, so
         * the policy asks the model the same question the model asked the
         * transcription — one arithmetic, not two.
         */
        const stabs = (run.shieldBossStabs ?? []).filter(
            (r) => r.id === id && !r.retaliation);
        if (stabs.length > seenStabs) {
            seenStabs = stabs.length;
            const w = stabs[stabs.length - 1];
            pressAt = shieldBossPressTick(w);
            windows.push({ startStab: w.t ?? w.startStab, from: w.windowFrom,
                to: w.windowTo, pressAt });
        }
        const press = pressAt !== null && perTick.length === pressAt;
        if (press) { pressAt = null; presses += 1; }
        const held = press ? UP_PRESS : UP;
        perTick.push(held);
        const { transition } = run.advance(held);
        if (transition) {
            fail(`${ctx.what}: the run crossed from level ${transition.from_level} to `
                + `${transition.to_level} during the fight with ${id}. A fight does not `
                + 'survive the door (trap 150) — the body, its key and its persistence '
                + 'row are all per-visit.');
        }
    }
    return fail(`${ctx.what}: held the band under ${id} for the whole ${bound}-tick bound `
        + `with ${presses} press(es) across ${windows.length} window(s) and the body is `
        + 'still in the world. The bound is `swingTimeMax` per cycle plus the death '
        + 'schedule; a fight that runs it out has a stance the band counter is not '
        + 'seeing, or a press the window is not carrying.');
}

/**
 * ⛓ RESOLVE the `keylock` work order — ⚖ §15.7a ruling 1's `key -> keylock`.
 *
 * ⛔ THE GATE IS A SAVE-FILE BOOLEAN, NOT AN ITEM. `BossLock.update` reads
 * `Player.hasKey(keyType)`, which `BossKey.removed()` writes and which is not
 * one of the fourteen `botStatus.items` fields — so the resolver asks the
 * RUN's own key set, and a lock whose key the run does not hold resolves to
 * nothing rather than to a stance that would stand there for ever.
 */
function resolveKeylockStrategy(run, obstacle, contacts, blocked = []) {
    const row = (run.world.activators ?? []).find((a) => a.id === obstacle.id);
    if (!row || !KEY_RESPONDERS[row.tag]) return null;
    if (!run.keys?.has(row.keyType)) {
        return {
            strategy: 'keylock',
            held: false,
            rejected: [{
                option: `stand on ${obstacle.id}`,
                why: `\`BossLock.update\` gates on \`Player.hasKey(${row.keyType})\` and `
                    + `this run holds [${[...(run.keys ?? [])].join(', ') || 'no keys'}]. `
                    + 'A stance on an unkeyed bosslock is a wait with no mechanism behind '
                    + 'it — the key is a SUB-ORDER, not a parameter.',
            }],
        };
    }
    const { stance, discharged } = deriveKeylockStance(run, row, contacts, blocked);
    const responder = KEY_RESPONDERS[row.tag];
    return {
        strategy: 'keylock',
        postCondition: 'open',
        target: { x: row.x, y: row.y },
        lock: obstacle.id,
        keyType: row.keyType,
        stance,
        discharged,
        /**
         * ⛔ THE FADE IS NOT A `Lock`'S, and `opensOnKeyTick` is why this is
         * computed rather than written: `keyTimer` ticks run FIRST and the
         * first of them shares the frame that latched `activate`, then
         * `alpha -= 0.05` on a BARE Number that really does go negative. 80,
         * against a Lock's 101.
         */
        hold: {
            ticks: opensOnKeyTick(responder.keyTimer, responder.fade) + HOLD_SLACK,
            until: {
                why: `${obstacle.id} is no longer solid — \`BossLock\`'s `
                    + `${responder.keyTimer}-tick \`keyTimer\` and then its own fade`,
                test: (r) => r.openActivators.has(obstacle.id),
            },
        },
        rejected: [{
            option: 'hold',
            why: `${obstacle.id} answers to no group at all — \`BossLock\`'s ctor forces `
                + '`tSet` to -1, so no `Button.activateAll` ever republishes it and the '
                + 're-close arm is unreachable. What opens it is the player standing on '
                + 'its one-pixel key line holding the key, which is a THIRD activation '
                + 'shape and not a button.',
        }, ...hypothesisRejection(discharged)],
    };
}

/**
 * The keylock's stance: a cell whose player box CONTAINS one of the integer
 * probes of the lock's own `keyLine`.
 *
 * ⛔ AN INTEGER POINT TEST, NOT A RECT OVERLAP — `activators.keyLineTouches`
 * is the transcription and it is asked here rather than re-derived, because
 * `World.collideLine`'s raycast is `while (x < toX)` at precision 1 and a rect
 * overlap would also answer yes for a box that straddles the last probe
 * without containing it. Half a pixel of over-permission in the one mechanic
 * whose false positive is a persistence write.
 *
 * ⚠ AND THE CELL CENTRES DO NOT REACH IT. The line sits one pixel below a
 * SOLID lock, so the stance is the cell below it walked NORTH into the wall —
 * which is what `runHold`'s own approach does from the cell centre. The
 * candidates are therefore cells from which the walk into the lock lands the
 * box on the line, tested at the PINNED position rather than at the centre.
 */
function deriveKeylockStance(run, row, contacts, blocked = []) {
    const pitch = DEFAULT_LATTICE;
    const opts = solverPlanOpts(run, contacts, { nodeMargin: 0, triggerMargin: 0 });
    const cell = nodeAt((row.rect.x + row.rect.right) / 2,
        (row.rect.y + row.rect.bottom) / 2, pitch);
    const candidates = [];
    for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const c = nodeCentre(cell.tx + dx, cell.ty + dy, pitch);
            if (plannerObstacleAt(run.world, c.x, c.y, null, opts)) continue;
            // The PINNED box — the walk stops with the box flush against the
            // lock's own rect on whichever side the cell is.
            const pinned = pinnedAgainst({ x: c.x, y: c.y }, row.rect);
            if (!keyLineTouches(playerBoxAt(pinned.x, pinned.y), row.keyLine)) continue;
            candidates.push({ d: Math.hypot(c.x - row.x, c.y - row.y), ...c });
        }
    }
    candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    const hypothesis = stanceHypothesis(run, blocked, contacts);
    for (const c of candidates) {
        const reached = stanceReaches(run, { x: c.x, y: c.y }, contacts, hypothesis);
        if (reached) return { stance: { x: c.x, y: c.y }, discharged: reached.discharged };
    }
    throw new SolverRefusal(
        `solverBot: no REACHABLE stance on ${row.id}'s key line in level ${run.level} — `
        + `${candidates.length} cell(s) put the player box on the line when walked into `
        + `the lock, none with a corridor from (${run.state.x},${run.state.y}).`,
        { obstacle: { kind: 'solid', id: row.id } });
}

/**
 * Where a walk from `cell` into `solid` comes to rest: the box flush against
 * the solid's own edge on the side the cell is on. `Mobile.moveX`/`moveY` step
 * one pixel at a time and stop on the first blocked step, so the resting
 * position is the solid's edge minus the box's own half-extent.
 *
 * ⚠ ONE AXIS, chosen by which one the cell is offset on — a diagonal approach
 * ends against whichever edge it reaches first and is not a stance a
 * derivation may claim.
 */
function pinnedAgainst(cell, solid) {
    const dx = cell.x < solid.x ? -1 : (cell.x >= solid.right ? 1 : 0);
    const dy = cell.y < solid.y ? -1 : (cell.y >= solid.bottom ? 1 : 0);
    if (dx !== 0 && dy !== 0) return cell;
    if (dx < 0) return { x: solid.x - (HITBOX.width - HITBOX.originX), y: cell.y };
    if (dx > 0) return { x: solid.right + HITBOX.originX, y: cell.y };
    if (dy < 0) return { x: cell.x, y: solid.y - (HITBOX.height - HITBOX.originY) };
    if (dy > 0) return { x: cell.x, y: solid.bottom + HITBOX.originY };
    return cell;
}

/**
 * Executor: the `keylock` verb. The approach walks INTO the lock — the key
 * line is one pixel below a solid — and then the wait is `runHold`'s, with the
 * presser argument being the lock itself: one implementation, and its per-tick
 * invariants (no transition, no movement, still inside) are exactly the ones a
 * key wait wants.
 *
 * ⛔ AND IT IS A LATCH: `activate` is set once and `BossLock`'s ctor forces
 * `tSet` to -1, so nothing republishes it false. The wait is for the FADE, not
 * for continued contact — which is why the condition is the lock being open
 * and not the player still standing there.
 */
function execKeylock(run, perTick, resolved, ctx) {
    if (resolved.held === false) {
        return fail(`${ctx.what}: ${resolved.lock} needs a key this run does not hold. `
            + 'The key is a SUB-ORDER — a `collect-placement` goal the macro layer owes '
            + '— and inventing a stance for an unkeyed lock would be a wait with no '
            + 'mechanism behind it.');
    }
    const NO_KEYS = new Set();
    const into = leanKeys(run.state, resolved.target);
    const from = perTick.length;
    let touched = false;
    for (let spent = 0; spent < resolved.hold.ticks; spent += 1) {
        if (resolved.hold.until.test(run)) {
            return { verb: 'keylock', target: resolved.lock, from,
                ticks: perTick.length - from, touchedAt: touched };
        }
        // Lean into the lock until the key line latches, then stand still: the
        // latch survives, and a held key would keep the walk pressing a wall
        // for eighty ticks of span.
        const held = touched ? NO_KEYS : into;
        perTick.push(held);
        const { transition } = run.advance(held);
        if (transition) {
            fail(`${ctx.what}: the run crossed to level ${transition.to_level} while `
                + `opening ${resolved.lock}.`);
        }
        if (!touched && keyLineTouches(playerBoxAt(run.state.x, run.state.y),
            (run.world.activators ?? []).find((a) => a.id === resolved.lock).keyLine)) {
            touched = true;
        }
    }
    return fail(`${ctx.what}: ${resolved.lock} did not open inside its own derived bound `
        + `of ${resolved.hold.ticks} ticks (\`opensOnKeyTick\` + slack), and the key line `
        + `was ${touched ? '' : 'NEVER '}touched. ${resolved.hold.until.why}.`);
}

/** The held key set that leans from `state` toward `aim` on ONE axis. */
function leanKeys(state, aim) {
    const dx = aim.x - state.x;
    const dy = aim.y - state.y;
    if (Math.abs(dx) >= Math.abs(dy)) return new Set([dx >= 0 ? 'right' : 'left']);
    return new Set([dy >= 0 ? 'down' : 'up']);
}

/**
 * ⛓⛓⛓ RESOLVE the `touch` work order — THE CONTROL THAT BECOMES A VERB.
 *
 * `touch` has been the live control for §10.4 note 4 since slice 2 (trap 62: a
 * strategy the table NAMES and the registry LACKS), and §15.2 measured why it
 * kept missing its room — the three gates are behind the shield, so the
 * segment that TAKES the shield never meets the lock. Its room is the WESTWARD
 * crossing, and this is it.
 *
 * ⛔ THE GATE IS AN INVENTORY FLAG AND THE MECHANISM IS A LATCH.
 * `ShieldLock.update` is `p = collide("Player", x - 1, y)` and then
 * `if (p && !activate && hasShield)` — so the resolver asks the RUN's
 * inventory, and a lock whose shield the run does not hold resolves to a
 * REFUSAL naming the item rather than to a stance.
 */
function resolveTouchStrategy(run, obstacle, contacts, blocked = []) {
    const row = (run.world.activators ?? []).find((a) => a.id === obstacle.id);
    if (!row || !TOUCH_RESPONDERS[row.tag]) return null;
    const need = row.shield ?? 'hasShield';
    if (!run.inventory?.[need]) {
        return {
            strategy: 'touch',
            held: false,
            need,
            rejected: [{
                option: `touch ${obstacle.id}`,
                why: `\`ShieldLock.update\`'s arm is \`if (p && !activate && `
                    + `Player.${need})\` and this run does not hold it. The item is a `
                    + 'SUB-ORDER the macro layer owes, not a parameter of this verb.',
            }],
        };
    }
    const { stance, discharged } = deriveTouchStance(run, row, contacts, blocked);
    return {
        strategy: 'touch',
        postCondition: 'open',
        target: { x: row.x, y: row.y },
        lock: obstacle.id,
        need,
        stance,
        discharged,
        /**
         * ⛔ THE VERB EARNS ITS OWN VOLUME, and it survives the verb (trap
         * 147's law, one class over). A touched `ShieldLock` is no longer
         * solid but is still a `proximity-hazard` in the census, and the
         * corridor the touch OPENS runs over its own cell — so every later
         * plan of this segment carries the exemption the touch bought.
         */
        exempt: new Set([...contacts, `proximity-hazard:${obstacle.id}`]),
        /**
         * ⛔ THE WINDOW IS AN ORDINARY LOCK FADE AND THE PLAYER CANNOT ACT FOR
         * ANY OF IT. `opensOnTick(0.01)` is 101, and `ShieldLock` writes
         * `p.receiveInput = false` for the whole of it — so the "hold" here is
         * not a hold at all, it is a window the tape must spend with nothing
         * pressed.
         */
        window: opensOnTick(RESPONDERS[row.tag]?.fade ?? RESPONDERS.lock.fade),
        rejected: [{
            option: 'hold',
            why: `${obstacle.id} forces \`tSet = -2\` (R2's FORCED_TSET finding), so no `
                + 'button in the game republishes it and there is no group to press. '
                + '`activate` LATCHES on the touch and the fade runs to completion '
                + 'whatever the player does.',
        }, ...hypothesisRejection(discharged)],
    };
}

/**
 * The touch stance: a cell from which the walk into the lock lands the player
 * box inside its own `touchRect` — the lock's rect shifted ONE PIXEL toward
 * the side the player comes from, which is `collide("Player", x - 1, y)`.
 *
 * ⛔ AND IT IS A ONE-PIXEL BAND. The lock is SOLID, so the box stops flush
 * against its west edge; the check rect starts one pixel further west. The
 * only stance that satisfies both is the pinned one, which is why this tests
 * `pinnedAgainst` rather than the cell centre — a derivation that probed the
 * centre would find no cell at all and report the room unsolvable.
 */
function deriveTouchStance(run, row, contacts, blocked = []) {
    const pitch = DEFAULT_LATTICE;
    const opts = solverPlanOpts(run, contacts, { nodeMargin: 0, triggerMargin: 0 });
    const cell = nodeAt((row.rect.x + row.rect.right) / 2,
        (row.rect.y + row.rect.bottom) / 2, pitch);
    const candidates = [];
    for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const c = nodeCentre(cell.tx + dx, cell.ty + dy, pitch);
            if (plannerObstacleAt(run.world, c.x, c.y, null, opts)) continue;
            const pinned = pinnedAgainst({ x: c.x, y: c.y }, row.rect);
            if (!rectsOverlapLocal(playerBoxAt(pinned.x, pinned.y), row.touchRect)) continue;
            candidates.push({ d: Math.hypot(c.x - row.x, c.y - row.y), ...c });
        }
    }
    candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    const hypothesis = stanceHypothesis(run, blocked, contacts);
    for (const c of candidates) {
        const reached = stanceReaches(run, { x: c.x, y: c.y }, contacts, hypothesis);
        if (reached) return { stance: { x: c.x, y: c.y }, discharged: reached.discharged };
    }
    throw new SolverRefusal(
        `solverBot: no REACHABLE stance against ${row.id}'s touch rect in level `
        + `${run.level} — ${candidates.length} cell(s) land the pinned box inside `
        + `[${row.touchRect.x},${row.touchRect.right}) and none plans a corridor from `
        + `(${run.state.x},${run.state.y}).`,
        { obstacle: { kind: 'solid', id: row.id } });
}

/**
 * Executor: the `touch` verb.
 *
 * ⛔⛔⛔ THE ONE THING THIS VERB HAS TO GET RIGHT IS A TERMINAL STATE.
 * `ShieldLock.turnOff()` restores `receiveInput` ONLY `if (p)`, and `p` is the
 * collide it re-runs on the tick the fade ends — so a player carried out of
 * the check rect by the velocity they walked in with NEVER GETS INPUT BACK.
 * `levelRun` throws by name on exactly that, and the cure is the verb's: the
 * lean is released the tick the snap fires, so the only thing that could move
 * the player is friction on a velocity the wall has already stopped.
 *
 * ⇒ nothing is pressed for the whole window. That is also what keeps the tape
 * cheap: 101 ticks of a released key is ONE span (trap 16 / §15.4).
 */
function execTouch(run, perTick, resolved, ctx) {
    if (resolved.held === false) {
        return fail(`${ctx.what}: ${resolved.lock} needs \`Player.${resolved.need}\`, `
            + 'which this run does not hold.');
    }
    const NO_KEYS = new Set();
    const into = leanKeys(run.state, resolved.target);
    const from = perTick.length;
    const bound = resolved.window + HOLD_SLACK;
    let snappedAt = null;
    for (let spent = 0; spent <= bound; spent += 1) {
        if (run.openActivators.has(resolved.lock)) {
            return { verb: 'touch', target: resolved.lock, from,
                ticks: perTick.length - from, snappedAt };
        }
        // ⛔ RELEASE ON THE SNAP. `run.inputRefused` is the run's own gate and
        // it is the honest signal — the game has already taken the player's
        // input, so a key held past it is a span that buys nothing and a
        // velocity that could carry them out of the rect.
        const refused = run.inputRefused;
        if (refused && snappedAt === null) snappedAt = perTick.length;
        const held = refused ? NO_KEYS : into;
        perTick.push(held);
        const { transition } = run.advance(held);
        if (transition) {
            fail(`${ctx.what}: the run crossed to level ${transition.to_level} while `
                + `touching ${resolved.lock}.`);
        }
    }
    return fail(`${ctx.what}: ${resolved.lock} did not open inside its own derived bound `
        + `of ${bound} ticks (\`opensOnTick\` ${resolved.window} + slack), and the snap `
        + `${snappedAt === null ? 'NEVER FIRED — the pinned box never reached the touch '
            + 'rect' : `fired at tick ${snappedAt}`}.`);
}

/**
 * ⛓⛓⛓ RESOLVE the `break` work order — ⚖ R9 SLICE 4, AND THE TWO GUARDS ARE
 * THE VERB'S WHOLE ITEM STORY.
 *
 * ⛔ **THE FIRST GUARD EXISTS BECAUSE THE GAME IS SILENT.**
 * `procgenRequirements.js:195-200` says it in the differential's own words:
 * *"without the sword `weaponForPress` returns null and the press is a SILENT
 * NO-OP"*. A verb that swung anyway would drive its whole bound pressing a key
 * that does nothing and then report a rock that "did not break" — a true
 * sentence about a room, when the fact is about the INVENTORY. So the weapon is
 * asked BEFORE a stance is derived, and the refusal names the item.
 *
 * ⛔ **THE SECOND GUARD IS THE ROCK'S OWN TEST, ASKED OF THE TRANSCRIPTION.**
 * `rockBreaksUnder(rockType, inventory)` is `hit(_t)`'s `rockType <= _t` with
 * `_t = hasGhostSword ? 1 : 0` — so a `breakablerockghost` (rockType 1) under a
 * plain sword is a swing that lands and does NOTHING, which `levelRun` records
 * as `{broke: false, why: 'rockType 1 > 0 — this weapon cannot break it'}`.
 * ⛓ That is a WORK ORDER and it is named as one: the ghost sword is an item the
 * campaign does not hold yet, and a refusal that says so is the cheapest
 * planning instrument this rung has (R8 lesson 2).
 *
 * ⚠ **A GHOSTSWORD IN THE PRIMARY SLOT IS REFUSED TOO, AND NOT AS AN
 * OVERSIGHT**: `levelRun.applyThrust` THROWS on one — *"a ghostsword press
 * routes the slash rect through `genericHit`'s Spear arm and doubles the rect's
 * height from the sprite WIDTH. Neither is modelled (R5)"* — so a verb that
 * selected it would turn an item the run really holds into an engine throw.
 * Refused by name, with the model gap as the work order.
 */
function resolveBreakStrategy(run, obstacle, contacts, blocked = []) {
    const rock = (run.world.solids ?? []).find((s) => s.rockId === obstacle.id);
    /**
     * ⛔ NOT A REFUSAL — the caller reports a `null` as "the census row the
     * frontier named is not one this executor can bind", which is the honest
     * answer for a solid that wears the tag and carries no `rockId` (the world
     * was built without one). "This table names a verb for this kind" and "this
     * particular body can be acted on" are different claims.
     */
    if (!rock) return null;
    const weapon = run.primaryWeapon;
    if (weapon !== 'sword') {
        return {
            strategy: 'break',
            held: false,
            rock: obstacle.id,
            rejected: [{
                option: `break ${obstacle.id}`,
                why: weapon === null
                    ? 'the run\'s `primary` slot holds NOTHING — `weaponForPress` returns '
                        + 'null and `Player.useItem`\'s switch matches no arm, so the press '
                        + 'would be a SILENT no-op. ⛔ The sword is a SUB-ORDER the macro '
                        + 'layer owes (a `collect-placement` goal), not a parameter of this '
                        + 'verb: swinging at the rock without it would spend the whole bound '
                        + 'and report the ROOM for a fact about the INVENTORY.'
                    : `the run's \`primary\` slot fires \`${weapon}\`, and only the plain `
                        + 'SWORD breaks a rock in this model. `Player.as:1071-1074` routes '
                        + `\`hit()\` from a slash, and a \`${weapon}\` press is a different `
                        + `rect through a different \`genericHit\` arm — for \`ghostsword\` `
                        + '`levelRun.applyThrust` THROWS by name (the Spear arm doubles the '
                        + 'rect height from the sprite WIDTH, unmodelled since R5). ⇒ the '
                        + 'work order is to EQUIP the sword, or to model the ghostsword '
                        + 'slash rect.',
            }],
        };
    }
    if (!rockBreaksUnder(rock.rockType, run.inventory)) {
        return {
            strategy: 'break',
            held: false,
            rock: obstacle.id,
            rejected: [{
                option: `break ${obstacle.id}`,
                why: `\`BreakableRock.hit(_t)\` is \`if (rockType <= _t)\` and \`Player.as:`
                    + `1071-1074\` passes \`hasGhostSword ? 1 : 0\`; this rock is rockType `
                    + `${rock.rockType ?? 0} and the run holds `
                    + `${run.inventory?.hasGhostSword ? 'the ghost sword' : 'NO ghost sword'}`
                    + '. ⛔ The swing would LAND and do nothing — `levelRun` records it as '
                    + '`{broke: false}` rather than as a miss. ⇒ THE NEXT WORK ORDER IS THE '
                    + 'GHOST SWORD: a `breakablerockghost` is one AS3 class away from the '
                    + 'plain rock and exactly one item away from being breakable, and no '
                    + 'stance, budget or re-aim can substitute for it.',
            }],
        };
    }
    const { stance, discharged } = deriveBreakStance(run, rock, contacts, blocked);
    /**
     * ⛔ THE WAIT IS THE LEG'S PROMISE, NOT THE ANIMATION. `HIT_TO_GONE_TICKS`
     * is an UPPER BOUND BY ONE — `World.update` may run the rock's graphic
     * before or after the player's `hit()` in the same pass — so
     * `breakableRocks` publishes a separate, larger number for what a LEG must
     * wait, and `assertWaitCovers` is the check that this verb keeps it. Asked
     * here, at the resolution, so a bound that stopped covering the animation
     * fails where the number is chosen rather than 20 ticks later in a walk.
     */
    assertWaitCovers(WAIT_AFTER_PRESS_TICKS, `solverBot break (${obstacle.id})`);
    return {
        strategy: 'break',
        postCondition: 'gone',
        target: { x: rock.rect.x, y: rock.rect.y, ...rock.rect },
        rock: obstacle.id,
        stance,
        discharged,
        wait: WAIT_AFTER_PRESS_TICKS,
        rejected: [{
            option: 'hold / shove / kill',
            why: `${obstacle.id} answers to no group, no push and no death: `
                + '`BreakableRock` is a `Solid` with no `tSet`, `Player.solids` does not '
                + 'push it and it is no `Enemy`. The ONE thing that removes it is a sword '
                + 'swing whose rect overlaps it, and `endAnim` — the Spritemap\'s own '
                + 'completion callback — is what calls `FP.world.remove`.',
        }, ...hypothesisRejection(discharged)],
    };
}

/**
 * The break stance: a REACHABLE cell from which the swing's own rect overlaps
 * the rock.
 *
 * ⛔ **BOTH HALVES OF THE GAME'S OWN TEST, AND NEITHER IS A PROXY.**
 * `auditPress` asks `slashRect(x, y, direction)` against the live solid, and
 * `deriveStrike` asks `distanceRectPoint <= SLASH_REACH` first because the
 * reach is the cheap half. A stance derived from adjacency alone would put the
 * player diagonally off a corner, where the box is one tile away and the 16x32
 * rect misses entirely.
 *
 * ⛔ **AND THE CANDIDATE IS TESTED AT THE CELL CENTRE, WHERE THE WALK STOPS.**
 * A `keylock`'s stance is PINNED because its key line is one pixel inside a
 * solid; a slash reaches 16 px, so the cell centre is inside the rect's own
 * span and the executor re-asks the question at the LIVE position anyway
 * (an early or late arrival that still finds the rock in reach should press).
 *
 * ⚠ **THE SWEEP IS BOUNDED AND SAYS SO** (the bounded-sweep law): ±2 lattice
 * cells around the rock, which at `DEFAULT_LATTICE` covers every cell a 16 px
 * reach can be satisfied from and is the same window `deriveTouchStance` and
 * `deriveKeylockStance` walk.
 */
function deriveBreakStance(run, rock, contacts, blocked = []) {
    /**
     * ⛓⛓⛓ **THE CHEAPEST STANCE IS THE ONE THE WALK IS ALREADY STANDING IN,
     * AND ROUTE STEP 12 IS WHY IT IS ASKED FIRST.**
     *
     * L3's `breakablerock@96,112` is the door out of the ARRIVAL POCKET: the
     * boot cell (104,136) is a one-cell island — Stone on three sides, WATER on
     * the fourth — and the rock is its only non-lethal neighbour. Every cell
     * from which a lattice sweep can swing at that rock is on the FAR side of
     * it, so a derivation that only searched the ring reported *"no REACHABLE
     * stance"* for a room whose stance is the tile the player booted on.
     *
     * ⛔ AND IT RETURNS `stance: null` RATHER THAN THE LIVE POSITION, because
     * the caller's contract is *"walk to the stance, then run the verb"* — a
     * `walkTo` to where the walk already is is a corridor request for a
     * zero-length corridor, and the frontier's own planner is entitled to
     * refuse one. `null` is the one spelling that says "no approach is owed",
     * and the executor re-asks the reach question at the LIVE position anyway.
     *
     * ⚠ THE BOOT CELL IS INSIDE A TELEPORTER VOLUME and that is not widened
     * into a rule: the sweep below still refuses a teleporter cell it is not
     * already standing in. Being carried to another level is not a stance, and
     * the one case where it is safe is the case where the run is demonstrably
     * already in it and has not transitioned.
     */
    if (distanceRectPoint(run.state.x, run.state.y, rock.rect) <= SLASH_REACH
        && rectsOverlapLocal(slashRectToward(run.state, rock.rect), rock.rect)) {
        return { stance: null, discharged: [] };
    }
    const pitch = DEFAULT_LATTICE;
    const opts = solverPlanOpts(run, contacts, { nodeMargin: 0, triggerMargin: 0 });
    const cell = nodeAt((rock.rect.x + rock.rect.right) / 2,
        (rock.rect.y + rock.rect.bottom) / 2, pitch);
    const candidates = [];
    let outOfReach = 0;
    let noRect = 0;
    for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const c = nodeCentre(cell.tx + dx, cell.ty + dy, pitch);
            if (plannerObstacleAt(run.world, c.x, c.y, null, opts)) continue;
            if (distanceRectPoint(c.x, c.y, rock.rect) > SLASH_REACH) { outOfReach += 1; continue; }
            if (!rectsOverlapLocal(slashRectToward(c, rock.rect), rock.rect)) {
                noRect += 1;
                continue;
            }
            candidates.push({ d: Math.hypot(c.x - rock.rect.x, c.y - rock.rect.y), ...c });
        }
    }
    candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    const hypothesis = stanceHypothesis(run, blocked, contacts);
    for (const c of candidates) {
        const reached = stanceReaches(run, { x: c.x, y: c.y }, contacts, hypothesis);
        if (reached) return { stance: { x: c.x, y: c.y }, discharged: reached.discharged };
    }
    throw new SolverRefusal(
        `solverBot: no REACHABLE stance for a swing at ${rock.rockId} in level `
        + `${run.level} — ${candidates.length} cell(s) put the slash rect on the rock and `
        + `none plans a corridor from (${run.state.x},${run.state.y}); ${outOfReach} more `
        + `were beyond SLASH_REACH (${SLASH_REACH} px) and ${noRect} were in reach with the `
        + 'rect pointing elsewhere. ⇒ the rock is on the frontier and the room offers '
        + 'nowhere to stand and swing: the next work order is a way to REACH one of those '
        + 'cells, not a bigger budget.',
        { obstacle: { kind: 'solid', id: rock.rockId } });
}

/**
 * Executor: the `break` verb — AIM, PRESS, WAIT OUT THE ANIMATION.
 *
 * ⛔⛔ **THE PRESS CONSUMES THE PREVIOUS TICK'S FACING**, which is why this is
 * an alternation and not a single tick. `levelRun`'s own comment: *"`sprites()`
 * — the only writer of `direction` — runs at the END of the update, so a press
 * consumes the facing this tick STARTED with"*. `execKillByPress` solved this
 * for a moving body by aiming one tick and pressing the next; a rock does not
 * move, so the same alternation costs one tick and needs no forecast.
 *
 * ⛔ **AND THE WAIT IS FOR THE WORLD, NOT FOR A COUNT.** `hit()` starts a
 * 4-frame animation and removes nothing: the rock is SOLID for all of it, and
 * `endAnim` is the Spritemap callback that calls `FP.world.remove`. So the
 * condition is the run's OWN `brokenRocks` set — the same one
 * `liveGeometryOpts` hands the planner — and the verb ALSO holds the leg's
 * declared `WAIT_AFTER_PRESS_TICKS`, because `HIT_TO_GONE_TICKS` is an upper
 * bound by one and a leg that walks on the exact tick is a leg that can
 * disagree with the game for a reason no route cares about.
 *
 * ⛓ **NOTHING IS HELD FOR THE WAIT** — 20 ticks of a released key is ONE span
 * (trap 16), and a held key would keep the walk pressing a wall.
 */
function execBreak(run, perTick, resolved, ctx) {
    /**
     * ⛔⛔ **A `SolverRefusal`, NOT A `SolverBotError`, AND THE DIFFERENCE IS A
     * GRADE.** `execKeylock` and `execTouch` `fail()` on their own `held:false`
     * arms, which raises a `SolverBotError` — and `procgenOracle.solve`
     * RE-THROWS one rather than classifying it, so on a generated level an
     * item-gated verb that failed that way would come back `THREW:*` and
     * `differentialGrade` would call it **WEAK** ("the ENGINE spoke, which is
     * not a claim about the level"). It is precisely a claim about the level:
     * the without-arm cannot pass this rock BECAUSE it lacks the item, which is
     * the definition of **STRONG**. ⇒ every refusal this verb raises is a
     * refusal, and the two older executors' arms are named as residue rather
     * than changed under this slice's licence.
     */
    const refuse = (why) => {
        throw new SolverRefusal(why, { obstacle: { kind: 'solid', id: resolved.rock } });
    };
    if (resolved.held === false) {
        return refuse(`${ctx.what}: ${resolved.rock} cannot be broken by this run — `
            + `${resolved.rejected[0].why}`);
    }
    const NO_KEYS = new Set();
    const PRESS = new Set(['primary']);
    const from = perTick.length;
    const gone = () => (run.brokenRocks ?? NO_KEYS).has(resolved.rock);
    /**
     * ⛔ THE BOUND IS THE MECHANISM'S OWN, PLUS THE ONE RE-AIM THIS VERB MAY
     * SPEND: an aim tick, a press tick, the leg's wait, and one repeat in case
     * the first swing was refused by the game's own `hitsTimer`-free arm (it is
     * not, but a bound derived from ONE press would report "the rock survived"
     * for an off-by-one instead of naming it).
     */
    const bound = 2 * (2 + resolved.wait) + HOLD_SLACK;
    let pressedAt = null;
    let aimed = false;
    for (let spent = 0; spent <= bound; spent += 1) {
        if (gone() && pressedAt !== null
            && run.ticksCompleted >= pressedAt + resolved.wait) {
            return { verb: 'break', target: resolved.rock, from,
                ticks: perTick.length - from, pressedAt, stance: resolved.stance };
        }
        let held = NO_KEYS;
        if (pressedAt === null) {
            const want = facingToward(run.state, resolved.target);
            const inReach = distanceRectPoint(run.state.x, run.state.y, resolved.target)
                <= SLASH_REACH
                && rectsOverlapLocal(slashRect(run.state.x, run.state.y, want),
                    resolved.target);
            if (!inReach) {
                refuse(`${ctx.what}: the walk arrived at (${run.state.x},${run.state.y}) and `
                    + `${resolved.rock} is not in reach of a swing from there `
                    + `(SLASH_REACH ${SLASH_REACH} px). The stance this verb derived was `
                    + `${resolved.stance
                        ? `(${resolved.stance.x},${resolved.stance.y})`
                        : 'THE LIVE POSITION (no approach was owed — the walk was already '
                            + 'in reach when the verb was resolved)'} — a walk that ends `
                    + 'somewhere else is a corridor finding, not a rock one.');
            }
            if (aimed || run.direction === want) {
                held = PRESS;
                pressedAt = run.ticksCompleted;
            } else {
                // ⛓ ONE TICK OF THE FACING KEY. It leans the box a pixel INTO
                // the rock, which is where a swing wants it anyway — the wall
                // stops the step and `sprites()` writes the direction the press
                // on the next tick will consume.
                held = new Set([FACING_KEYS[want]]);
                aimed = true;
            }
        }
        perTick.push(held);
        const { transition } = run.advance(held);
        if (transition) {
            refuse(`${ctx.what}: the run crossed to level ${transition.to_level} while `
                + `breaking ${resolved.rock}. A break is PER VISIT — \`check()\` only `
                + 'removes a rock with `tag >= 0`, so a `tag = -1` rock is rebuilt whole by '
                + 'the next `new Game` and the swing would have to be paid for again.');
        }
    }
    return refuse(`${ctx.what}: ${resolved.rock} was still in the world `
        + `${bound} ticks after the stance was reached (pressed at `
        + `${pressedAt === null ? 'NEVER — the aim never resolved' : pressedAt}). The `
        + 'animation is four frames and `endAnim` removes the entity; a rock that outlives '
        + 'that is a disagreement between this model and the game, not a budget.');
}

/**
 * ⛓⛓⛓ ⚖ §11.8a RULING 2's LADDER — THE COMBAT POLICY'S DECISION ORDER.
 *
 *   AVOID -> TIME -> BAIT -> KILL, cheapest first, and every escalation is a
 *   trace row carrying the refused cheaper rung's reason.
 *
 * The list is EXPORTED so `r8Acceptance.assertEscalationIsOrdered` checks a
 * run's escalations against the RUNNING order rather than against a copy
 * typed beside the ruling (trap 89). A rung's own implementation is one
 * function below; the order is here and nowhere else.
 */
export const ESCALATION_LADDER = Object.freeze(['avoid', 'time', 'bait', 'kill']);

/**
 * The mover's search is SHORT — `mover.MOVER_RANGE`: tick-exact to ~8 px, an
 * upper bound to ~48 px at dwell 4. So the TIME rung is the CONTESTED
 * LAST-MILE tool kickoff §3.1 says it is, and a rung that pretended to cross
 * a room with it would spend its whole expansion budget saying no. The
 * escalation names the bound; it never widens it.
 */
const TIME_RUNG = Object.freeze({ dwell: 4, reach: 48, maxExpansions: 40000 });

/** Does a segment from `a` to `b` cross this rect? Sampled at 2 px. */
function segmentCrosses(a, b, r) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
    for (let i = 0; i <= steps; i += 1) {
        const x = a.x + ((b.x - a.x) * i) / steps;
        const y = a.y + ((b.y - a.y) * i) / steps;
        if (x >= r.x && x < r.right && y >= r.y && y < r.bottom) return true;
    }
    return false;
}

/**
 * ⛓⛓⛓ THE BAIT STANCE, DERIVED — ⚖ §11.8a ruling 2.
 *
 * `ARROW_KILL_PLAN.baitRule` is *"choose the stance so the STRAIGHT LINE from
 * body to player crosses a lane"*, and it is a straight line rather than a
 * path for a source reason: **a chaser has no wall test** — `Bob.update`'s
 * `collideLine` guard is COMMENTED OUT (`Bob.as:59`) — so a body steers at
 * the player and presses against whatever is between them for ever.
 *
 * Four conditions, all of them mechanism data, none of them taste:
 *
 *   1. **the leash** — `ENEMY_CLASSES[tag].aggro.range`. A body outside it is
 *      not pushed at all, so a stance out of leash baits nothing. ⛓ This is
 *      the condition `L6_BOB_DROWN`'s own `stay` control measures: the L6
 *      arrival is 86 px from `bob@112,48` against a `runRange` of 80, and the
 *      body never wakes.
 *   2. **the line crosses a kill region** — `dangerMap.bodyKillRegions`: an
 *      ARMED arrow lane (L5's), lethal terrain (L6's water — `Enemy.update`'s
 *      switch), or a pit (slice 3's descent). What "a lane" means is what the
 *      room transcribes.
 *   3. **`presserSafety`, generalised** — `ARROW_KILL_PLAN`'s own words are
 *      *"assert `lanesOver(playerBox, lanes)` is EMPTY at the hold point"*,
 *      and the union map is the general form of that question. ⛔ It is asked
 *      as a WAIT rather than as a pass (trap 154): the stance is where the
 *      player stands still for the whole dwell.
 *   4. **reachable** — `planWaypoints` itself, the same instrument the walk
 *      then follows (§10.4 note 3's law, a third verb over).
 *
 * Ordered by distance from the live position, then y, then x — an emitted
 * tape is an artifact and a tie broken by iteration order is a tie broken by
 * nothing.
 */
function deriveBaitStance(run, body, contacts) {
    const regions = bodyKillRegions(run);
    if (regions.length === 0) {
        return { stance: null, why: `level ${run.level} has NO region that kills a body — `
            + 'no armed trap lane, no lethal terrain, no pit. A bait needs somewhere for '
            + 'the line to cross.' };
    }
    const row = ENEMY_CLASSES[body.tag];
    const leash = typeof row?.aggro?.range === 'number' ? row.aggro.range : 0;
    const pitch = DEFAULT_LATTICE;
    const here = nodeAt(run.state.x, run.state.y, pitch);
    const planOpts = solverPlanOpts(run, contacts);
    const candidates = [];
    const near = [];
    for (let dy = -8; dy <= 8; dy += 1) {
        for (let dx = -8; dx <= 8; dx += 1) {
            const c = nodeCentre(here.tx + dx, here.ty + dy, pitch);
            const d = Math.hypot(c.x - body.x, c.y - body.y);
            if (d > leash) continue;
            near.push(c);
            const crossed = regions.find((r) => segmentCrosses({ x: body.x, y: body.y }, c, r.rect));
            if (!crossed) continue;
            if (dangerAt(run, run.ticksCompleted, playerBoxAt(c.x, c.y)).danger) continue;
            candidates.push({
                ...c, crossed,
                d: Math.hypot(c.x - run.state.x, c.y - run.state.y),
            });
        }
    }
    candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    for (const c of candidates) {
        if (!corridorPlans(run.world, run.state, { x: c.x, y: c.y }, null, planOpts)) continue;
        /**
         * ⛓ THE BOUND IS THE BODY'S OWN TRAVEL TIME, not a margin. The body
         * walks the straight line at its own `moveSpeed`, so the distance to
         * the far edge of the region it crosses over that speed is the floor;
         * the death staging (`MOBILE_DEATH_FADE` — a LOOP of ten
         * subtractions, and `destroy`/`removed` stay two fenceposts, trap 87)
         * is what has to elapse after it before the body leaves the world.
         */
        const travel = Math.hypot(c.x - body.x, c.y - body.y) / (row.speed || 0.5);
        return {
            stance: { x: c.x, y: c.y },
            crossed: c.crossed,
            ticks: Math.ceil(travel) + MOBILE_DEATH_FADE.ticks + BAIT_SLACK,
            leash,
            why: `the straight line from ${body.id} at (${body.x.toFixed(1)},`
                + `${body.y.toFixed(1)}) to (${c.x},${c.y}) crosses ${c.crossed.kind} `
                + `${c.crossed.id} — ${c.crossed.why}; the stance is inside the leash `
                + `(${leash}) and the danger map names nothing at it`,
        };
    }
    return {
        stance: null,
        why: `no stance within ${body.id}'s leash (${leash}) both pulls its straight line `
            + `through a kill region and is itself danger-free: ${near.length} cell(s) in `
            + `leash, ${candidates.length} of them crossing a region, none of those `
            + 'reachable. ⛔ A stance safe to PASS is not safe to WAIT in (trap 154), and '
            + 'this rung asks the waiting question.',
    };
}

/** One second of slack at 30 fps, named so a reader can see it is one. */
const BAIT_SLACK = 30;

/**
 * ⛔ THE KILL RUNG'S BOUND, and it is a BOUND rather than a length — §11.7's
 * law: the stopping CONDITION is observed and `ticks` is the claim the verb
 * can refute. One arrow kill's floor is `ARROW_KILL_FLOOR` (three landed
 * arrows through 30-tick i-frames, then the die animation, then the fade);
 * this is that with room for the body to walk into the lane first, which is
 * the term nobody can derive without a route.
 */
const KILL_BY_CEILING_BOUND = ARROW_KILL_FLOOR * 3 + HOLD_SLACK;

/**
 * ⛓⛓⛓ THE KILL RUNG — AND IT IS THE ROOM'S OWN WEAPON, NOT A PRESS.
 *
 * ⛔ `KILL_ARM_POLICY.Bob` STAYS `refused` (trap 101, and slice 3's §11.10.5
 * says exactly what a press arm still owes). What this rung does instead is
 * what L4's answer already was and nobody had named: **arm the ceiling and
 * wait**. `hold`'s executor already holds a presser until an OBSERVED
 * condition — §11.7's precedent — so the kill rung is that verb with the
 * condition and the presser DERIVED from the body it is trying to remove.
 *
 * The presser is chosen by MECHANISM: its activator group must arm a trap
 * whose lane covers the target body. A presser that arms nothing over the
 * body is a button, not a weapon.
 */
/**
 * ⛓⛓⛓ R9 SLICE 12b — **THE KILL RUNG'S CHASER ARM. HUNT IS NOT A FIFTH RUNG**
 * (⚖ ruling 30(d), the user: *"I'm not aware of any difference in strategy
 * between HUNT and KILL"*).
 *
 * `deriveKillByCeiling` is the room's own weapon — a presser whose group arms
 * a trap whose lane covers the body. **L14 has 0 pressers and 0 traps**, so
 * that arm has nothing to offer and the rung used to end there, saying *"A
 * PRESS arm is a `KILL_ARM_POLICY` question and this rung does not open one
 * (trap 101)"*. Slice 12 opened it: `KILL_ARM_POLICY.Bob` is `modelled` and
 * the game has adjudicated a press against a live bob.
 *
 * ⛔ THE STANCE IS THE WHOLE VERB, AND A CHASER IS WHY IT WORKS. This body
 * comes to the player — that is what makes it dangerous and it is also what
 * makes it killable without chasing it. So the arm is: stand where the walk
 * cannot be reached from behind, let the body close, and let the OPPORTUNISTIC
 * STRIKE do the pressing. There is no second press schedule here and there
 * must not be: one policy decides every press this ladder makes (⚖ ruling
 * 30(b)/(c)), and a rung that grew its own would be the two-consumers failure
 * the whole slice is built to avoid.
 *
 * ⚠ **AND IT IS ONLY REACHED WHEN THE WALK-WITH-STRIKES COULD NOT BE
 * CERTIFIED.** ⚖ Ruling 30(d): the opportunistic strike is the primary and
 * this is the fallback. By the time the ladder is here, AVOID has already
 * probed the corridor WITH strikes and found a hit anyway.
 *
 * ⛓ NOT FIRST-VIABLE (kickoff §22.9's warning about `deriveStrike`): the
 * candidate stances are SCORED and the best is taken, with the runners-up
 * carried so the trace can answer "why there".
 */
export function deriveKillByChaser(run, body, contacts,
    { aim = null, allowTeleporter = null, tolerance = 0 } = {}) {
    if (!(run.strikeBodies ?? []).some((b) => b.id === body.id)) {
        return { stance: null, why: `${body.id} is not a body this run steps — the chaser `
            + 'arm needs a live position, and a static census body has none' };
    }
    const target = run.strikeBodies.find((b) => b.id === body.id);
    if (!armIsModelled(target)) {
        return { stance: null, why: `KILL_ARM_POLICY.${target.enemyClass} is not `
            + '`modelled`, so a press against it is not something this model may claim' };
    }
    /**
     * ⛔⛔⛔ **THE BODY MUST BE ABLE TO COME, AND THE FIRST CUT OF THIS ARM DID
     * NOT ASK.** Measured on L14, which is what the check is made of.
     *
     * A stand-and-strike works because a CHASER walks at the player: that is
     * what makes it dangerous and it is also what makes it killable without
     * chasing it (`r9-l6-bob-press`'s hand stance — "stand still and let it
     * come back" — and the game adjudicated it). ⛔ But a chaser only chases
     * INSIDE ITS LEASH. `CHASERS.bob`'s is 80 px, and the body the ladder
     * hands this arm is the one whose danger blocks the CORRIDOR — which on
     * L14 is `bob@32,32`, **126 px from where the walk stands**. It will never
     * arrive. The wait is unbounded, and the first cut spent it standing still
     * while the room's other five bobs closed in and one of them landed a hit
     * at tick 106.
     *
     * ⇒ the arm REFUSES BY NAME when the target cannot reach the stance,
     * rather than waiting for something that is not coming. ⛓ And the same
     * measurement says the mechanism is sound where it applies: standing at
     * L14's own boot the policy struck `bob@128,64` twice over 140 ticks and
     * took ZERO hits.
     *
     * ⚠ A stance DERIVED to put the target inside its leash and the others
     * outside theirs is the real fix and it is not built here — it needs a
     * stance audit over the whole forecast, which is work with a measurement
     * behind it now but no driven witness yet. Named as the bound.
     */
    /**
     * ⛓ THE LEASH IS `ENEMY_CLASSES[tag].aggro.range`, WHICH IS WHERE THE
     * DANGER MAP READS IT TOO — its refusals say "inside leash 80" from this
     * same field. `CHASERS` transcribes the STEP; `combat.js` prices the
     * aggro, and quoting the pricing table is what keeps the two agreeing.
     */
    const leash = ENEMY_CLASSES[target.tag]?.aggro?.range ?? null;
    if (leash === null) {
        return { stance: null, why: `no aggro range is priced for ${target.tag} in `
            + '`ENEMY_CLASSES`, so this arm cannot say whether the body would ever '
            + 'reach a stance' };
    }
    /**
     * ⛓⛓⛓ **THE STANCE, DERIVED — SCORED, ITERATIVE, AND IT REFUSES BY NAME.**
     *
     * Slice 12b's first cut returned `{stance: run.state}` — "wherever the
     * walk stands" — and L14 measured what that is worth: the ladder hands
     * this arm the body whose danger blocks the corridor, which there is
     * `bob@32,32` at 127.1 px against an 80 px leash. It never comes; the
     * dwell stood waiting for it and was hit at tick 106 by one of the four
     * bobs that do chase. The arm then REFUSED by name, which was honest and
     * still solved nothing.
     *
     * ⛔ FOUR CONDITIONS, AND EVERY ONE OF THEM IS THE FORECAST'S ANSWER
     * RATHER THAN A DISC:
     *
     *  1. **the TARGET inside its own leash from the stance**, so it comes at
     *     all — measured centre to centre, which is `Bob.update`'s own
     *     `FP.distance(x, y, player.x, player.y)` and `chaserDanger`'s.
     *  2. **every OTHER body outside reach FOR THE DURATION** — and that is
     *     asked by STEPPING them against the previewed player over the whole
     *     wait, not by growing a box. `dangerDuringTransit` with the sample's
     *     own forecast bodies is `probeCorridor`'s instrument, re-used rather
     *     than re-implemented: one danger model, two questions.
     *  3. **a corridor TO the stance that is itself safe** — the approach is
     *     part of the stance. It is previewed as the walk's own head and the
     *     dwell as its TAIL, on ONE forecast, so the bodies the wait begins
     *     with are the bodies the walk left, not the ones the room booted.
     *  4. **a corridor onward** from the stance to the aim, so a stance that
     *     wins the fight and traps the walk is not offered.
     *
     * ⛓ THE BOUND IS DERIVED TWICE OVER (⚖ ruling 17). The SCAN's ceiling is
     * the body's own travel time to the stance at its own `moveSpeed` — which
     * is `deriveBaitStance`'s term, and it is exactly what `HOLD_SLACK` was
     * standing in for — plus three landed hits through the receiver's i-frames
     * (`killWindowTicks(tag) * 3`) plus that slack. The DWELL's bound is then
     * the tick this preview says the body dies, plus the slack: a measured
     * number, not a formula that has to be generous. ⚠ §23.10's
     * `killWindowTicks*3 + HOLD_SLACK` alone is 108 ticks on a bob, and no
     * stance on L14 kills its first body inside 108.
     *
     * ⛓ NOT FIRST-VIABLE (kickoff §22.9's warning about `deriveStrike`): every
     * survivor is scored and the runners-up ride in the trace, so the answer
     * to "why there" is in the record rather than in the iteration order.
     */
    const gap = distanceRectPoint(run.state.x, run.state.y, target.rect);
    const row = ENEMY_CLASSES[target.tag];
    const speed = row?.speed ?? 0;
    if (!(speed > 0)) {
        return { stance: null, why: `${body.id} has \`speed ${speed}\` — it does not `
            + 'chase, so no stance can bring it to the player and a stand-and-strike '
            + 'would wait for something that never moves' };
    }
    const targetCentre = {
        x: (target.rect.x + target.rect.right) / 2,
        y: (target.rect.y + target.rect.bottom) / 2,
    };
    const pitch = DEFAULT_LATTICE;
    const here = nodeAt(run.state.x, run.state.y, pitch);
    const planOpts = solverPlanOpts(run, contacts);
    const strikeFor = () => strikePolicyFor(run);

    /**
     * ⛔ CONDITION 4 IS ASKED ONLY WHERE IT CAN DISCRIMINATE. An `aim` may be
     * a goal ENTITY rather than a walkable cell — `planWaypoints` refuses a
     * teleporter tile by name, and `walkTo` answers that by RE-IDENTIFYING
     * the goal rather than by routing to it. A scan that asked "is there a
     * corridor onward to this aim" against such an aim would answer no for
     * every cell in the room and refuse with a count of zero, which reads as
     * "the room has no stance" and means "I asked an unanswerable question".
     * So the aim is probed FROM THE CURRENT POSITION first: if the walk
     * cannot plan to it from where it already stands, the test carries no
     * information about a stance and is not run.
     */
    const aimIsPlannable = aim !== null
        && corridorPlans(run.world, run.state, aim, allowTeleporter, planOpts);
    // ── condition 1, and the cheap half of 3 and 4 ────────────────────
    const inLeash = [];
    const candidates = [];
    for (let dy = -STANCE_SCAN_CELLS; dy <= STANCE_SCAN_CELLS; dy += 1) {
        for (let dx = -STANCE_SCAN_CELLS; dx <= STANCE_SCAN_CELLS; dx += 1) {
            const c = nodeCentre(here.tx + dx, here.ty + dy, pitch);
            const d = Math.hypot(c.x - targetCentre.x, c.y - targetCentre.y);
            if (d > leash) continue;
            inLeash.push(c);
            if (!corridorPlans(run.world, run.state, c, allowTeleporter, planOpts)) continue;
            if (aimIsPlannable
                && !corridorPlans(run.world, c, aim, allowTeleporter, planOpts)) continue;
            candidates.push({ ...c, d,
                approach: Math.hypot(c.x - run.state.x, c.y - run.state.y) });
        }
    }
    // Nearest-first only as a SCAN order — the pick below is by score, and
    // ties are broken by y then x so an emitted tape is not an artifact of
    // iteration order.
    candidates.sort((a, b) => a.approach - b.approach || a.y - b.y || a.x - b.x);

    /**
     * ⛓ THE CEILING — see the note above. The travel term uses the body's own
     * `moveSpeed` over the straight line, which is a FLOOR on its arrival and
     * therefore the right side to be wrong on for a ceiling that must not cut
     * the fight short.
     */
    const ceilingFor = (c) => Math.ceil(Math.hypot(c.x - targetCentre.x, c.y - targetCentre.y)
        / speed) + killWindowTicks(target.tag) * 3 + HOLD_SLACK;

    const scored = [];
    const rejected = [];
    for (const c of candidates) {
        const wps = (c.x === run.state.x && c.y === run.state.y)
            ? [] : planWaypointsOrNull(run.world, run.state, c, allowTeleporter, planOpts);
        if (wps === null) continue;
        /**
         * ⛔⛔ A CANDIDATE THAT CANNOT BE PRICED IS REJECTED, NOT RAISED — and
         * the difference is a crash.
         *
         * `probeCorridor` previews ONE corridor, the one the planner chose;
         * this scan previews up to `(2n+1)^2` of them, so it walks into cells
         * the planner would never route through. L6 measured it: a candidate
         * corridor enters Water on a tape without the `"sound"` pin and
         * `playerPhysicsV2.step` throws BY NAME, which is right — the model
         * cannot price that walk — and a scan that let it escape would fail
         * the whole solve because one cell of the room is unpriceable.
         *
         * ⚠ ONLY THE TWO REFUSAL CLASSES ARE CAUGHT. A `PhysicsV2Error` and a
         * `BotDriverV2Error` are this model saying "I will not answer for that
         * corridor"; anything else is a defect and is re-raised, because a
         * scan that swallowed every throw would offer a stance it never
         * priced.
         */
        let walk;
        try {
            walk = previewWalk(run, wps, tolerance,
                { strike: strikeFor(), standFor: ceilingFor(c) });
        } catch (e) {
            if (!(e instanceof PhysicsV2Error) && !(e instanceof BotDriverV2Error)) throw e;
            rejected.push({ ...c, why: `the model REFUSES to price this candidate's own `
                + `corridor — ${e.message.split('\n')[0].slice(0, 160)}` });
            continue;
        }
        if (walk.truncated) {
            rejected.push({ ...c, why: `the preview did not settle — ${walk.truncated.why}` });
            continue;
        }
        let danger = null;
        let deathTick = null;
        for (const sm of walk.samples) {
            if (deathTick === null && sm.chasers
                && !sm.chasers.some((b) => b.id === target.id)) deathTick = sm.tick;
            if (danger !== null) continue;
            const dg = dangerDuringTransit(run, sm.tick, playerBoxAt(sm.x, sm.y),
                sm.arrows, sm.chasers);
            if (dg.danger) danger = { tick: sm.tick, phase: sm.phase ?? 'transit', ...dg };
        }
        if (danger) {
            rejected.push({ ...c, why: `${danger.phase === 'dwell' ? 'the WAIT' : 'the APPROACH'} `
                + `is dangerous at tick ${danger.tick - walk.startTick} — `
                + `${danger.sources.map((x) => `${x.kind}:${x.id}`).join(', ')}` });
            continue;
        }
        if (deathTick === null) {
            rejected.push({ ...c, why: `${target.id} is still standing after the whole `
                + `${ceilingFor(c)}-tick ceiling — it does not reach this stance inside its `
                + 'own travel time plus three kill windows' });
            continue;
        }
        const arrival = walk.startTick + walk.samples.filter((sm) => sm.phase !== 'dwell').length;
        scored.push({
            x: c.x, y: c.y,
            approach: arrival - walk.startTick,
            deathAt: deathTick - walk.startTick,
            // Every body this wait removes, not only the one that was asked
            // for — the record a reader needs to see why the NEXT climb finds
            // a different room.
            clears: clearsOf(walk, run),
            ticks: (deathTick - arrival) + HOLD_SLACK,
        });
    }
    if (scored.length === 0) {
        return {
            stance: null,
            why: `no stance derives for ${body.id} on level ${run.level}: `
                + `${inLeash.length} cell(s) inside its ${leash} px leash, `
                + `${candidates.length} of those reachable`
                + `${aimIsPlannable ? ' and with a corridor onward' : ''}, `
                + `and ${rejected.length} of THOSE refused by the forecast `
                + `[${rejected.slice(0, 3).map((r) => `(${r.x},${r.y}): ${r.why}`).join('; ')}`
                + `${rejected.length > 3 ? '; …' : ''}]. ⛔ A stance safe to PASS is not safe `
                + 'to WAIT in (trap 154), and this rung asks the waiting question over the '
                + 'whole duration rather than at the instant.',
        };
    }
    /**
     * ⛓ THE SCORE, SAID: soonest kill first (the wait is the expensive part
     * and a shorter one is a smaller claim), then the shortest approach, then
     * the most bodies cleared, then y and x so the order is TOTAL.
     */
    scored.sort((a, b) => a.deathAt - b.deathAt || a.approach - b.approach
        || b.clears.length - a.clears.length || a.y - b.y || a.x - b.x);
    const best = scored[0];
    return {
        stance: { x: best.x, y: best.y },
        target,
        ticks: best.ticks,
        clears: best.clears,
        // ⛓ The runners-up, so the trace can answer "why THERE" and not only
        // "where" — `deriveStrike`'s lesson, kickoff §22.9.
        runnersUp: scored.slice(1, 4).map((r) => ({ x: r.x, y: r.y, deathAt: r.deathAt })),
        why: `${body.id} is a \`modelled\` press target (KILL_ARM_POLICY.`
            + `${target.enemyClass}) ${gap.toFixed(1)} px from the walk; the stance `
            + `(${best.x},${best.y}) puts it ${Math.hypot(best.x - targetCentre.x,
                best.y - targetCentre.y).toFixed(1)} px away, inside its ${leash} px leash, `
            + `so it CHASES. The forecast walks there in ${best.approach} tick(s) and stands: `
            + `${target.id} dies at tick ${best.deathAt}`
            + `${best.clears.length > 1 ? ` (and ${best.clears.length - 1} other bod(y|ies) `
                + `with it: ${best.clears.filter((id) => id !== target.id).join(', ')})` : ''}`
            + `, and NO body reaches the player at any tick of either half — the union map's `
            + `own answer at every sample, with the bodies stepped against this candidate. `
            + `${scored.length} stance(s) qualified out of ${candidates.length} reachable of `
            + `${inLeash.length} in leash; this one is the soonest kill. The presses are the `
            + 'one opportunistic strike policy every walk uses, not a second schedule.',
    };
}

/**
 * ⛓⛓⛓ R9 SLICE 12b′ — **THE CHASER ARM'S OWN ORDER OVER THE CHOOSER'S SET.**
 *
 * `chooseBodyToRemove` orders by distance from the AIM. That is the right
 * question for BAIT — lure the body that is IN the way — and the wrong one
 * for an iterative stand-and-strike, because the body nearest the destination
 * is the one furthest from the fight. On L14 the two orders differ by the
 * whole room: by aim-distance the head is `bob@32,32` at the exit, 127 px
 * away behind four bobs that are already chasing; by intercept it is
 * `bob@128,64`, the body the corridor probe met first.
 *
 * ⛓ THE ORDER IS THE PROBE'S OWN ANSWER, NOT A SECOND FORECAST. `hit.sources`
 * is the danger this climb exists about, in the order the corridor met it, so
 * the arm reads those first and the chooser's own order behind them. Exported
 * because the row that says the two orders differ must call the rule rather
 * than re-spell it (trap 566).
 *
 * @param {object[]} removable `chooseBodyToRemove`'s ordered set
 * @param {object} hit  the corridor probe's first danger, with its `sources`
 */
export function interceptOrder(removable, hit) {
    const intercepts = (hit?.sources ?? []).map((sx) => sx.id);
    const rank = (b) => {
        const i = intercepts.indexOf(b.id);
        return i < 0 ? intercepts.length : i;
    };
    // ⚠ A STABLE sort, so bodies the probe never named keep the chooser's own
    // order behind the ones it did — the two rules compose rather than one
    // replacing the other.
    return [...removable].sort((a, b) => rank(a) - rank(b));
}

/**
 * ⛓ How many cells out the stance scan looks — `deriveBaitStance`'s own 8,
 * which at `DEFAULT_LATTICE` is 128 px and therefore covers a whole Seedling
 * room from any cell in it. Named rather than repeated at two scan sites.
 */
const STANCE_SCAN_CELLS = 8;

/** `planWaypoints`, returning `null` where `corridorPlans` returns false. */
function planWaypointsOrNull(world, from, aim, allowTeleporter, opts) {
    try {
        return planWaypoints(world, from, aim, allowTeleporter, opts);
    } catch (e) {
        if (!(e instanceof BotDriverV2Error)) throw e;
        return null;
    }
}

/**
 * The bodies a previewed walk-and-wait REMOVES, in the order they go.
 *
 * ⛓ Read off the forecast's own roster rather than counted: a body that
 * leaves the sample's chaser list has finished its death staging, which is
 * the same observable `runDwell`'s `until` tests on the live run.
 */
function clearsOf(walk, run) {
    const gone = [];
    let live = new Set((run.strikeBodies ?? []).map((b) => b.id));
    for (const sm of walk.samples) {
        if (!sm.chasers) continue;
        const now = new Set(sm.chasers.map((b) => b.id));
        for (const id of live) if (!now.has(id)) gone.push(id);
        live = now;
    }
    return gone;
}

function deriveKillByCeiling(run, body, contacts) {
    const world = run.world;
    const traps = world.arrowTraps ?? [];
    const options = [];
    for (const presser of (world.pressers ?? [])) {
        const covering = traps.filter((t) => t.t === presser.t).filter((t) => {
            const lane = laneRectOf(run, t);
            return rectsOverlapLocal(lane, bodyRectOf(body));
        });
        if (covering.length === 0) continue;
        options.push({ presser, covering });
    }
    if (options.length === 0) {
        return { presser: null, why: `no presser in level ${run.level} arms a trap whose `
            + `lane covers ${body.id} — the room has `
            + `${(world.pressers ?? []).length} presser(s) and ${traps.length} trap(s), and `
            + 'a button that arms nothing over the body is not a weapon. A PRESS arm is a '
            + '`KILL_ARM_POLICY` question and this rung does not open one (trap 101).' };
    }
    options.sort((a, b) => Math.hypot(a.presser.x - run.state.x, a.presser.y - run.state.y)
        - Math.hypot(b.presser.x - run.state.x, b.presser.y - run.state.y));
    const { presser, covering } = options[0];
    const resolvedPresser = resolvePresser(world, { x: presser.x, y: presser.y },
        `solverBot kill-by-ceiling (${body.id})`);
    const { stance, exempt } = deriveHoldStance(run, resolvedPresser, contacts);
    return {
        presser, stance, exempt,
        covering: covering.map((t) => t.id),
        why: `${presser.tag}@${presser.x},${presser.y} (group t=${presser.t}) arms `
            + `[${covering.map((t) => t.id).join(', ')}], whose lane(s) cover ${body.id}`,
    };
}

/**
 * An armed-or-not trap's lane, as a rect, at THIS run's level height.
 *
 * ⚠ NAMED `laneRectOf` AND NOT `arrowLaneRect`: the geometry now lives in
 * `arrowTrap.arrowLaneRect(lane, levelHeight)` and this is only the height
 * lookup this module happens to repeat four times. Two identical names, one
 * imported and one declared, is an ESM duplicate declaration — so the name
 * going to the owner is not a style call.
 */
function laneRectOf(run, trap) {
    const world = run.world;
    return arrowLaneRect(arrowLaneForPlacement(trap), world.world.height);
}

/** A live body's own box — `chasers.chaserBoxAt`, at the position the run has. */
const bodyRectOf = (body) => chaserBoxAt(body.tag, body.x, body.y);

/**
 * ── THE LOOP ──────────────────────────────────────────────────────────
 *
 * @param {object} o
 * @param {object} o.run    a live `createLevelRun` — collision on, damage on
 * @param {Array}  o.goals  ordered goal list (see `assertGoal`)
 * @param {string} o.name   the tape name the trace will explain
 * @param {object} [o.boot] `{level, x, y}` for the trace envelope
 * @param {number} [o.tolerance]
 * @param {number} [o.maxTicksPerTarget]
 * @returns {{perTick: Array<Set>, trace: object, transitions: Array,
 *            waypointsPlanned: number, replans: number, records: Array}}
 */
export function solveSegment({
    run, goals, name, boot,
    tolerance = DEFAULT_TOLERANCE,
    maxTicksPerTarget = DEFAULT_MAX_TICKS_PER_TARGET,
}) {
    if (!run || typeof run.advance !== 'function') fail('solveSegment needs a live run');
    if (!Array.isArray(goals) || goals.length === 0) {
        fail('solveSegment: goals must be a non-empty ordered list — the macro layer '
            + 'names WHAT; an empty list is a segment with no claim.');
    }
    goals.forEach(assertGoal);
    if (typeof name !== 'string' || !name) fail('solveSegment needs the tape name');
    if (!boot || !Number.isInteger(boot.level)
        || !Number.isFinite(boot.x) || !Number.isFinite(boot.y)) {
        fail('solveSegment needs `boot` {level, x, y} — the tape\'s own boot, which is '
            + 'what the trace\'s silent-death query (trap 142) is computed against.');
    }
    /**
     * ⛔ HONEST RUNS ONLY. Under `noclip`/`noDamage` the bridge getters are
     * EMPTY BY CONSTRUCTION (§9.12) and `liveGeometryOpts` refuses — a
     * solver sensing a flag-relaxed world would plan against geometry the
     * replay ignores. The refusal fires at the first plan, by name.
     *
     * ⛔⛔⛔ AND THE CENSUS MUST BE THE REPLAY'S OWN. `buildLevelWorld`'s
     * default `roles` is `PRE_R5_ROLES` — a COMBAT-BLIND world, deliberately
     * (every R0–R4 fixture is `noDamage`) — while `tapeRunner` gives an
     * honest tape the full `ROLES`. This slice's own first battery was
     * solved against the default: identical in every room without enemies,
     * and BLIND in the one room with them — the solver crossed L6 with both
     * bobs invisible (empty chaser roster, empty hazard census, every
     * danger probe vacuously calm) and recorded green because the game's
     * own bobs woke, chased, and happened never to connect. A run whose
     * current world carries no combat census is refused HERE, by name,
     * before a tick is spent — the world the solver senses and the world
     * the replay runs must be ONE world.
     */
    if (run.world?.combat?.enemies === undefined) {
        fail('solveSegment: this run\'s world has NO COMBAT CENSUS — it was built '
            + 'without the `combat` role (the builder\'s default is PRE_R5_ROLES, a '
            + 'combat-blind world). The solver senses enemies and hazards through the '
            + 'census, and the replay (`tapeRunner`) gives an honest tape the full '
            + '`ROLES` — a solve against the default is blind in exactly the rooms '
            + 'that matter and identical everywhere else. Pass `roles: ROLES` to '
            + '`createLevelRun`.');
    }
    if (run.ticksCompleted !== 0) {
        fail('solveSegment: the run must be fresh (ticksCompleted 0) — the solver owns '
            + 'the whole segment from its declared boot, so the tape and the trace '
            + 'describe the same run from tick 0.');
    }

    const perTick = [];
    /** Trace rows, buffered; keys are filled from `perTick` at finish. */
    const rows = [];
    const seeRow = (row) => { rows.push(row); return row; };
    /**
     * ⛓⛓⛓ EDITOR ARC SLICE 9 — THE DANGER QUERIES THIS WALK ACTUALLY MADE.
     *
     * ⛔ A RECORDING, NOT A HOOK THAT CAN CHANGE ANYTHING. Nothing reads this
     * list, nothing branches on it, and no `dangerAt` call exists because of
     * it — every row is written at a site that had ALREADY asked the union,
     * from the answer it had already been given. That is the whole of its
     * byte-inertness argument: a recording callback that could alter a
     * decision would be a policy wearing an instrument's name.
     *
     * ⛔⛔ AND IT IS WHY THE EDITOR PAGE MAY DRAW A DANGER LAYER AT ALL. The
     * page's own law is that *a viewer is a window, not a third opinion*
     * (`watchViewer`'s docblock), and slice 6 refused `dangerVolumes` as an
     * eleventh peer of the layers that show what happened (kickoff §14.4c).
     * ⚖ Item 9 supersedes that refusal for exactly one shape: a layer drawing
     * what the SOLVER RECORDED. A page that re-asked `dangerAt` itself would
     * be the third opinion again — same function, different run state, and a
     * plausible picture of a warning the bot never got. So the ONLY danger
     * data that leaves this module is the reason lists it was handed.
     *
     * ⚠ TWO CLOCKS, AND THE ROW CARRIES BOTH. `tick` is `perTick.length` —
     * the TAPE's clock, the one the editor's scrub cursor indexes and the one
     * `trace.rows[].tick` already uses. `runTick` is `run.ticksCompleted`, the
     * clock `dangerAt` was asked at. They are NOT the same number: a run
     * spends DEAD FRAMES (`run.deadFrameSpans`) that the tape does not tick
     * through, so recording one and calling it the other would put a warning
     * at a cursor position the walk never had.
     *
     * ⚠ NAMED BOUND — the DECISION POINTS, not every query. `deriveBaitStance`
     * asks the union over a 17x17 lattice of HYPOTHETICAL stances (two sites,
     * both inside a module-level helper); those are a SEARCH, not positions
     * this walk held, and recording them would bury the handful of answers the
     * walk actually acted on under several hundred it discarded. The two sites
     * here are the ones the loop itself owns: what the bot SENSED where it
     * stood, and what the gate REFUSED it.
     */
    const dangerQueries = [];
    const recordDanger = (where, x, y, d) => {
        dangerQueries.push({
            where,
            tick: perTick.length,
            runTick: run.ticksCompleted,
            level: run.level,
            x,
            y,
            danger: d.danger,
            mode: d.mode,
            horizon: d.horizon,
            // ⛔ The union's own reason strings, verbatim — a paraphrase here
            // would be a second spelling of the warning, and the warning is
            // the entire content of the channel.
            sources: d.sources.map((s) => ({ kind: s.kind, id: s.id ?? null, why: s.why })),
        });
    };
    const saw = () => {
        const s = run.state;
        const d = dangerNow(run, s.x, s.y);
        recordDanger('sense', s.x, s.y, d);
        return {
            level: run.level, x: s.x, y: s.y, vx: s.vx, vy: s.vy,
            danger: d.sources.map((src) => `${src.kind}:${src.id ?? '?'}`),
        };
    };
    let replans = 0;
    let waypointsPlanned = 0;
    /**
     * ⛓⛓⛓ WHICH CLIMB — and it is a counter rather than a flag because the
     * ladder is cheapest-first WITHIN one climb and a NEW obstacle starts a
     * new climb at the BOTTOM. L6 measured why the distinction is worth a
     * field: the bait removes the body, the walk re-plans, and the fresh
     * corridor's own danger opens a second climb that AVOID then clears. A
     * policy that remembered "I escalated to bait last time" and resumed
     * there would be skipping the cheap rung for the rest of the segment,
     * which is the opposite of what the ladder is for — and across a whole
     * segment the rungs would read as going DOWN, which is what
     * `assertEscalationIsOrdered` is entitled to refuse.
     */
    let climbNo = 0;
    /**
     * ⛓⛓⛓ GUARD (ii) OF ⚖ THE RULED READING (b) — the ledger a re-derivation
     * needs, and the set that demotes an order to a wall.
     *
     * `hypothesisLedger` records, per applied shove, which PENDING orders its
     * destination leaned on. `refusedOrders` is what a later refusal adds to:
     * an order that has refused once is a WALL for every subsequent
     * hypothesis, which is what makes the re-derivation different from a
     * retry. ⛔ Without this the policy would re-derive the same destination
     * from the same optimism for ever — a quiet retry wearing a guard's name.
     */
    const hypothesisLedger = [];
    const refusedOrders = new Set();
    /**
     * ⛓ R8 slice 3 — the contact exemptions a STRATEGY earned, carried for
     * the rest of the segment. `senseContacts` answers "what am I standing
     * in"; this answers "what did I earn the right to stand in", and the two
     * are different claims about the same volume.
     */
    const exemptions = new Set();
    /** The strategies applied for the CURRENT goal, for the bound below. */
    let applied = [];
    /**
     * ⛓ arc 3 slice S1 — the OPENER CHAIN raised for the current goal, one entry
     * per prerequisite redeemed. Its length is what `NESTED_OPENER_DEPTH` bounds,
     * and it lives beside `applied` because it is the same kind of fact: a count
     * of work done for ONE goal, reset when the goal changes.
     */
    let openerChain = [];
    const grazes = [];
    const records = [];

    /**
     * Refuse, with everything a reader needs. The rows recorded so far ride
     * on the error — a refused segment is still reviewable.
     */
    const refuse = (message, extra = {}) => {
        throw new SolverRefusal(message, {
            rows: [...rows], perTick: [...perTick],
            // ⛓ EDITOR ARC SLICE 10 — the same snapshot-by-copy the rows and
            // the keys already get, for the same reason: the list keeps
            // growing if a caller catches this and solves again.
            dangerQueries: [...dangerQueries],
            ...extra,
        });
    };

    /**
     * The danger gate at a decision point: slice 2 SENSES and REFUSES.
     * Dodge is slice 3's policy; a policy that walked on past a named
     * danger would be worse than one that stops and says why.
     */
    const refuseDanger = (x, y, goal, what, except = null) => {
        const d = dangerNow(run, x, y, except);
        // ⛓ Recorded whichever way it answers: a gate that CLEARED is as much
        // of the walk's record as one that refused, and a layer that only
        // showed refusals would draw a bot that was never told it was safe.
        recordDanger('gate', x, y, d);
        if (d.danger) {
            refuse(`${what}: the danger map forbids (${x},${y}) — `
                + d.sources.map((s) => `${s.kind}:${s.id ?? '?'} (${s.why})`).join('; ')
                + '. Slice 2 has NO DODGE POLICY (kickoff §4: combat is slice 3); '
                + 'sensing and refusing loudly is the whole of this slice\'s danger '
                + 'response.', {
                goal,
                obstacle: { kind: 'danger', id: d.sources[0]?.id ?? null },
                considered: [{ option: 'dodge', why: 'not a registered policy this slice' }],
            });
        }
    };

    /**
     * ⛓⛓⛓ IDENTIFY the obstacle behind a failed plan — at the COMPONENT
     * FRONTIER, not at either endpoint.
     *
     * The first cut probed the AIM cell and named the exit's own teleporter
     * volume as "the obstacle" in L4 — a diagnosis about the destination,
     * not about what separates the player from it. The honest question is
     * "which ENTITY stands on the boundary of the component I can reach":
     * flood the walkable cells from the live position (the same
     * `isWalkableTile` predicate the failed A\* used, via
     * `plannerObstacleAt` on cell centres), probe every blocked neighbour,
     * and keep the obstacles that are ENTITIES rather than tile terrain — a
     * wall is a wall, but a pushable, a lock or a chest on the frontier is
     * a thing a strategy can act on (L4's own vocabulary: the block IS the
     * door). Nearest-to-aim wins; the rest ride in the message.
     */
    const identifyAndSelect = (goal, aim, contacts, planError, allowTeleporter) => {
        const opts = solverPlanOpts(run, contacts, { nodeMargin: 0, triggerMargin: 0 });
        const pitch = DEFAULT_LATTICE;
        const w = run.world;
        const nx = w.width * TILE_SIZE / pitch;
        const ny = w.height * TILE_SIZE / pitch;
        const start = nodeAt(run.state.x, run.state.y, pitch);
        const seen = new Set([`${start.tx},${start.ty}`]);
        const frontier = new Map();
        const queue = [start];
        while (queue.length) {
            const cur = queue.pop();
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const tx = cur.tx + dx;
                const ty = cur.ty + dy;
                if (tx < 0 || ty < 0 || tx >= nx || ty >= ny) continue;
                const k = `${tx},${ty}`;
                if (seen.has(k)) continue;
                const c = nodeCentre(tx, ty, pitch);
                const hit = plannerObstacleAt(w, c.x, c.y, null, opts);
                if (hit === null) {
                    seen.add(k);
                    queue.push({ tx, ty });
                    continue;
                }
                // Terrain, pits and wall TILES are WALLS — real, but not
                // actionable: no strategy moves stone. A teleporter on the
                // frontier is a door to somewhere else, not a blocker. What
                // is left is an ENTITY a strategy can be about — L4's own
                // vocabulary: the button (hold) in front of the block
                // (shove) IS the room's answer.
                if (hit.kind === 'terrain' || hit.kind === 'pit'
                    || hit.kind === 'lethal-terrain' || hit.kind === 'teleporter') continue;
                const b = hit.blocker;
                const tag = b.tag ?? b.cls?.as3 ?? b.name ?? null;
                if (typeof tag === 'string' && tag.startsWith('tile:')) continue;
                const id = b.id ?? `${tag ?? '?'}@${b.x ?? '?'},${b.y ?? '?'}`;
                if (!frontier.has(id)) {
                    frontier.set(id, {
                        kind: hit.kind,
                        tag,
                        id,
                        d: Math.hypot(c.x - aim.x, c.y - aim.y),
                    });
                }
            }
        }
        /**
         * ⛓⛓⛓ R8 SLICE 7 — **ACTIONABLE FIRST**, THEN NEAREST TO AIM, and L19
         * is what found the difference.
         *
         * Slice 2's order was nearest-to-aim alone, which is right whenever
         * every entity on the frontier is a thing a strategy can be about.
         * L19's is not: `sign@64,128` is a Solid at tile (4,8) with no verb in
         * the game at all, and it sits CLOSER to the stairs than
         * `bosslock@48,32` — the room's actual door. So the frontier named the
         * sign, reported "no strategy row exists for this obstacle", and hid
         * the one obstacle the policy had just registered an executor for.
         *
         * ⇒ an obstacle with no SELECTED and REGISTERED strategy is a WALL for
         * this choice — ⚖ §12.2 guard (i)'s own language, applied to the
         * frontier instead of to a hypothesis set — and the walls sort after
         * the doors. ⚠ They stay IN the message, because "these are also in
         * the way and nothing can move them" is the diagnosis a reader wants
         * when every door has been tried.
         */
        const strategyFor = (o) => refineStrategy(run,
            OBSTACLE_STRATEGIES[o.tag ? `${o.kind}:${o.tag}` : o.kind]
                ?? OBSTACLE_STRATEGIES[o.kind] ?? null, o);
        const actionable = [...frontier.values()].sort((a, b) => {
            const av = STRATEGY_EXECUTORS[strategyFor(a)] ? 0 : 1;
            const bv = STRATEGY_EXECUTORS[strategyFor(b)] ? 0 : 1;
            return av - bv || a.d - b.d;
        });
        const obstacle = actionable[0] ?? { kind: 'no-corridor', tag: null, id: null };
        const key = obstacle.tag ? `${obstacle.kind}:${obstacle.tag}` : obstacle.kind;
        const strategy = refineStrategy(run,
            OBSTACLE_STRATEGIES[key] ?? OBSTACLE_STRATEGIES[obstacle.kind] ?? null, obstacle);
        const considered = [];
        /**
         * ⛓⛓⛓ R8 SLICE 3 — A REGISTERED STRATEGY IS APPLIED HERE, AND THIS IS
         * THE WHOLE OF "adds policies rather than restructuring".
         *
         * Slice 2 ended every identification in a refusal because the table
         * was empty below `collect`/`chest`; the seam it left is this one
         * branch. A strategy the table knows AND the registry has is RESOLVED
         * against live state and handed back to `walkTo`, which applies it and
         * re-plans — a world edit is a re-plan event by the cadence rule
         * (§10.4 note 6), and the trace carries a row for it.
         */
        if (strategy && STRATEGY_EXECUTORS[strategy]) {
            const resolved = resolveObstacleStrategy(run, strategy, obstacle, contacts,
                aim, allowTeleporter, [...refusedOrders]);
            /**
             * ⛓ THE RESOLVER'S OWN VERB IS THE ANSWER, not the table's — and
             * for all eight verbs that existed before slice 3b this is the
             * SAME STRING, because every resolver already stamps
             * `resolved.strategy` with its own name. What it buys is the one
             * case where a refinement can be WRONG about what it can build:
             * `weigh` falls back to `hold` when no block can reach the
             * presser (see `resolveWeighStrategy`), and the executor lookup,
             * the trace row's verb and `applied`'s bound must all follow the
             * resolution rather than the guess that preceded it.
             */
            if (resolved) {
                return { obstacle, strategy: resolved.strategy ?? strategy, resolved, key };
            }
            /**
             * ⛓⛓⛓ GUARD (ii), FIRED. This order REFUSED — and an earlier
             * shove may have hypothesised it discharged. ⚖ The ruling: that
             * invalidates the hypothesis, and the re-derivation runs with
             * this obstacle demoted to a WALL and the parked block's REAL
             * position as its input (which the live loop gives for free —
             * `run.pushables` is where the block actually is, trap 153).
             *
             * ⛔ AND IF THE RE-DERIVATION WANTS THE BLOCK SOMEWHERE IT CAN NO
             * LONGER GO, THAT IS A NAMED REFUSAL, NOT A QUIET RETRY — which
             * is why the failed order joins `refusedOrders` FIRST: the second
             * derivation cannot lean on the same optimism, so it either finds
             * a genuinely different answer or says so.
             */
            if (obstacle.id && !refusedOrders.has(obstacle.id)) {
                refusedOrders.add(obstacle.id);
                const leaning = hypothesisLedger.filter(
                    (h) => h.discharged.includes(obstacle.id));
                for (const h of leaning) {
                    const redone = resolveObstacleStrategy(run, 'shove',
                        { kind: 'solid', tag: h.tag, id: h.id }, contacts, aim,
                        allowTeleporter, [...refusedOrders]);
                    if (redone) {
                        redone.rejected = [{
                            option: `the destination this shove already took (k=${h.k})`,
                            why: `⚖ guard (ii): it was derived hypothesising `
                                + `[${h.discharged.join(', ')}] discharged, and `
                                + `${obstacle.id} has since REFUSED. Re-derived with that `
                                + 'order demoted to a wall, from the block\'s REAL '
                                + 'position.',
                        }, ...(redone.rejected ?? [])];
                        return {
                            obstacle: { kind: 'solid', tag: h.tag, id: h.id },
                            strategy: 'shove',
                            resolved: redone,
                            key: `solid:${h.tag}`,
                        };
                    }
                    considered.push({
                        option: `re-derive ${h.id} (guard ii)`,
                        why: `its destination leaned on ${obstacle.id} being discharged, `
                            + 'and with that order demoted to a wall NO (dir, k) yields a '
                            + 'corridor from the block\'s real position. The hypothesis is '
                            + 'refuted and there is no second answer.',
                    });
                }
            }
            considered.push({
                option: strategy,
                why: `selected for ${key} and REGISTERED, but the obstacle could not be `
                    + 'resolved against live state — the census row the frontier named '
                    + 'is not one this executor can bind',
            });
        }
        if (strategy && !STRATEGY_EXECUTORS[strategy]) {
            considered.push({
                option: strategy,
                why: `selected for ${key} and NOT REGISTERED this slice — a later slice's `
                    + 'executor row, computed rather than guessed',
            });
        }
        refuse(`solverBot(${name}): no corridor for goal ${goal.kind} toward `
            + `(${aim.x},${aim.y}) in level ${run.level}. Obstacle: ${key}`
            + `${obstacle.id ? ` (${obstacle.id})` : ''}`
            + `${actionable.length > 1
                ? `; also on the frontier: ${actionable.slice(1).map((o) => o.id).join(', ')}`
                : ''}. `
            + `${strategy
                ? `Strategy '${strategy}' ${STRATEGY_EXECUTORS[strategy]
                    ? 'failed to apply' : 'is SELECTED but not registered this slice'}.`
                : 'No strategy row exists for this obstacle.'} `
            + `Planner said: ${planError.message.slice(0, 300)}`,
        { goal, obstacle, considered });
    };

    /**
     * ⛓⛓⛓ **TURN A DERIVATION'S PREREQUISITE INTO AN ORDER** — arc 3 slice S1,
     * gap 1. The plan this returns REPLACES the round's plan and is applied by
     * the ordinary statements; the loop then re-plans and re-identifies, so the
     * original obstacle is re-derived against the changed world.
     *
     * ⛔ THREE WAYS TO REFUSE, AND EVERY ONE NAMES THE PREREQUISITE:
     *  · the chain is DEEPER than `NESTED_OPENER_DEPTH`;
     *  · the prerequisite has no SELECTED and REGISTERED strategy (guard (i)'s
     *    own language: an obstacle with no verb is a wall, here too);
     *  · the strategy is registered and could not bind against live state.
     * A bound that ran out silently, or a resolver that returned `null` into a
     * generic "no corridor", would both print a sentence about the room when the
     * fact is about one obstacle in it.
     */
    const prerequisiteOrder = (goal, aim, identified, contacts, allowTeleporter, what) => {
        const p = identified.resolved.prerequisite;
        const link = openerChain.length + 2;
        const chainText = `${identified.obstacle.id} <- ${p.id}`;
        if (link > NESTED_OPENER_DEPTH) {
            refuse(`${what}: ${identified.obstacle.id}'s stance is reachable only once `
                + `${p.id} is discharged (${p.via}: ${p.why}), and redeeming it would be `
                + `link ${link} of an opener chain bounded at NESTED_OPENER_DEPTH = `
                + `${NESTED_OPENER_DEPTH}. The chain so far is `
                + `[${openerChain.map((c) => c.chain).join(' | ')}]. ⛔ A deeper chain is `
                + 'not unsupported, it is REFUSED: this policy drives two-deep openers and '
                + 'says so, and raising the number is a ruling rather than a tuning.',
            { goal, obstacle: { kind: p.kind, tag: p.tag, id: p.id } });
        }
        const sub = { kind: p.kind, tag: p.tag, id: p.id };
        const key = p.tag ? `${p.kind}:${p.tag}` : p.kind;
        const strategy = refineStrategy(run,
            OBSTACLE_STRATEGIES[key] ?? OBSTACLE_STRATEGIES[p.kind] ?? null, sub);
        if (!strategy || !STRATEGY_EXECUTORS[strategy]) {
            refuse(`${what}: ${identified.obstacle.id}'s stance needs ${p.id} discharged `
                + `first (${p.via}: ${p.why}), and ${p.id} has `
                + `${strategy ? `strategy '${strategy}', which is NOT REGISTERED this slice`
                    : 'NO strategy row at all'} — so the prerequisite is a WALL and the `
                + 'stance is unreachable. ⚖ Guard (i): an obstacle with no verb is a wall '
                + 'for this quantifier, not an optimistic gap.',
            { goal, obstacle: { kind: p.kind, tag: p.tag, id: p.id } });
        }
        /**
         * ⛔⛔ THE SUB-ORDER'S AIM IS THE **STANCE IT UNLOCKS**, NOT THE GOAL.
         * `resolveShoveStrategy`'s post-condition is `clear-path`, and the path
         * this order is for is the one to `${identified.obstacle.id}`'s stance —
         * a shove scanned against the GOAL's aim asks whether moving the block
         * opens a corridor all the way through, which is a question no
         * prerequisite was ever the answer to (measured: ARM 2 returned `null`
         * from the resolver for exactly this reason). ⚠ Inert for the mechanism
         * arm, whose destination the presser names.
         */
        const subAim = identified.resolved.stance ?? aim;
        /**
         * ⛔ AND WITH THE **DERIVATION'S OWN EXEMPTIONS**, for trap 147's reason
         * read one order down: the stance this order is for lies INSIDE the
         * presser's volume, and A* refuses to route onto an avoid volume unless
         * it is exempted — so a `shove` scanned without them finds no `k` at all
         * and the resolver returns `null` (measured: ARM 2, before this line).
         * The stance, the exemption and the order that reaches it are ONE
         * decision, which is the same law `walkTo` already applies when it walks
         * to a stance with `contactsOverride`.
         */
        const subContacts = identified.resolved.exempt ?? contacts;
        const resolved = resolveObstacleStrategy(run, strategy, sub, subContacts, subAim,
            allowTeleporter, [...refusedOrders]);
        if (!resolved) {
            refuse(`${what}: ${identified.obstacle.id}'s stance needs ${p.id} discharged `
                + `first (${p.via}: ${p.why}), strategy '${strategy}' is SELECTED and `
                + 'REGISTERED for it, and it could NOT be resolved against live state — the '
                + 'census row the derivation named is not one this executor can bind.',
            { goal, obstacle: { kind: p.kind, tag: p.tag, id: p.id } });
        }
        openerChain.push({ chain: chainText, id: p.id, via: p.via, link });
        resolved.rejected = [{
            option: `walking to ${identified.obstacle.id}'s stance first`,
            why: `⛓ arc 3 slice S1 (gap 1): that stance does not plan a corridor until `
                + `${p.id} is discharged — ${p.why} — so this order is link ${link} of the `
                + `opener chain ${chainText}, raised by the DERIVATION rather than by the `
                + 'flood, and executed BEFORE the stance it unlocks. The original obstacle '
                + 'is then re-identified and re-derived against the world this changed, '
                + 'never against a promise about it.',
        }, ...(resolved.rejected ?? [])];
        return { obstacle: sub, strategy: resolved.strategy ?? strategy, resolved, key };
    };

    /**
     * ⛓ THE CORRIDOR PROBE, SAMPLED ALONG THE SEGMENTS — slice 2's own
     * measurement, factored out so the ladder's AVOID rung checks its
     * re-plan with the SAME instrument that refused the first one.
     *
     * ⛔ SAMPLED, NOT PROBED AT THE WAYPOINTS. The first cut probed waypoint
     * POINTS only and L6 measured the hole: a string-pulled two-waypoint
     * corridor put both probe points OUTSIDE the sandtrap volumes while the
     * segment between them crossed two of them. Eight-pixel samples are finer
     * than any volume on the hazard roster (the smallest is a 16 px box).
     */
    /**
     * ⛓ R9 slice 12c′ — THE SAMPLE-CHECKING HALF, FACTORED OUT so
     * `planSwordDash` can price a DASHED corridor through the SAME predicate
     * this rung refuses on. A second danger reading would be a probe better
     * informed (or worse) than the walk, which is trap 567 from either side.
     */
    const probeSamples = (samples, except = null) => {
        for (const s of samples) {
            const d = withoutSources(
                dangerDuringTransit(run, s.tick, playerBoxAt(s.x, s.y), s.arrows, s.chasers),
                except);
            if (d.danger) return { x: s.x, y: s.y, tick: s.tick, ...d };
        }
        return null;
    };

    const probeCorridor = (wps, except = null) => {
        // ⛔ THE SAME TOLERANCE `drive` WILL USE. A preview that arrived on a
        // different criterion would spend different ticks, and the ETAs are
        // the whole product.
        /**
         * ⛓⛓⛓ R9 SLICE 12b — THE CORRIDOR IS PROBED **WITH THE STRIKES THE
         * WALK WILL MAKE** (⚖ ruling 30(c)).
         *
         * A fresh policy per probe, because a probe is a what-if from the
         * live position and must not inherit a previous candidate's strike
         * state; and the SAME construction the drive uses, because the
         * corridor this returns is the one `walkTo` is about to walk. The two
         * are deterministic and start from the same player, so they produce
         * the same held-set sequence — which `solverBot.test.js` asserts
         * directly rather than leaving to inspection.
         */
        const walk = previewWalk(run, wps, tolerance, { strike: strikePolicyFor(run) });
        const hit = probeSamples(walk.samples, except);
        if (hit) return { ...hit, eta: hit.tick - walk.startTick };
        /**
         * ⛔ THE NON-VACUITY CHECK RUNS ON THE CLEAN PATH, not only on the
         * refusal — a probe that found nothing because it sampled nothing
         * returns exactly what a safe corridor returns.
         *
         * ⚠ TWO CASES ARE EXEMPT AND BOTH ARE NAMED. A TRUNCATED preview
         * carries its own reason (a wall the frozen geometry has, a crossing);
         * an EMPTY one is a corridor the controller is already standing at the
         * end of — `hasArrived` is true before the first tick, which happens
         * whenever a verb re-probes from the stance it just took. Neither is
         * the collapse: the collapse produces samples that all sit on the plan
         * tick, and any call with samples still checks.
         */
        if (!walk.truncated && walk.samples.length > 0) {
            assertTransitSamplesCarryEtas(walk.samples, walk.startTick,
                `solverBot(${name}): the corridor probe`);
        }
        return null;
    };

    /**
     * The body whose removal admits a corridor — see the ladder's rung-3
     * note. Ordered by distance from the aim so that, where two would do, the
     * one nearest the destination (the one most likely to be IN the way
     * rather than merely near it) is taken first; ties by id, because an
     * emitted tape is an artifact.
     */
    const chooseBodyToRemove = (goal, aim, contacts, allowTeleporter) => {
        /**
         * ⛓⛓⛓ R8 SLICE 4 WIDENS THE HYPOTHESIS SET TO THE STATIC HALF, and
         * the widening is the whole of L8's wall.
         *
         * Slice 3b quantified over `run.chasers` — the bodies this run
         * STEPS — and L8's `sandtrap@96,80` is not one: a `speed 0` census
         * row in a room the bridge refuses. So the rung asked "which live
         * body's removal admits a corridor", got "none", and reported the
         * room unsolvable. But "the model cannot watch it die" and "nothing
         * can remove it" are DIFFERENT CLAIMS — the room's own ceiling
         * removes it and the GAME writes the flag. The set is therefore every
         * body the danger map is pricing, live or static, and what differs is
         * WHICH ORACLE finishes the job.
         */
        const live = [...(run.chasers ?? [])].map((c) => ({ ...c, stepped: true }));
        const stepped = (run.chaserRoomVerdict?.(run.level)?.stepped) === true;
        const bridged = new Set(bridgedChaserTags());
        const statics = stepped ? [] : (run.world.combat?.enemies ?? [])
            .filter((e) => !bridged.has(e.tag) || !stepped)
            .map((e) => ({ id: `${e.tag}@${e.x},${e.y}`, tag: e.tag, x: e.cx ?? e.x,
                y: e.cy ?? e.y, row: e, stepped: false }));
        const all = [...live, ...statics];
        all.sort((a, b) => Math.hypot(a.x - aim.x, a.y - aim.y)
            - Math.hypot(b.x - aim.x, b.y - aim.y) || (a.id < b.id ? -1 : 1));
        /**
         * ⛓⛓⛓ R9 SLICE 12b′ — **THE WHOLE SET, ORDERED, AND STILL ONE
         * CHOOSER.**
         *
         * ⛔ The hypothesis and the filter are one question and stay in one
         * place; what differs between the rungs is the ORDER they read the
         * answer in, and that is a rung's business rather than the chooser's.
         * BAIT and the ceiling arm take `[0]` — this list's head is the same
         * body the single-return version handed them, so they do not move.
         * The CHASER arm re-orders by INTERCEPT (see its call site), because
         * an ITERATIVE arm that starts with the body nearest the DESTINATION
         * starts with the one furthest from the fight: on L14 that is
         * `bob@32,32`, 127 px away behind four bobs that are already coming.
         */
        const admits = [];
        for (const c of all) {
            const without = dangerVolumes(run, 0).filter((v) => v.id !== c.id);
            try {
                planWaypoints(run.world, run.state, aim, allowTeleporter,
                    solverPlanOpts(run, contacts, { extraVolumes: without }));
                admits.push(c);
            } catch (e) {
                if (!(e instanceof BotDriverV2Error)) throw e;
            }
        }
        return admits;
    };

    const reasonsOf = (d) => d.sources
        .map((x) => `${x.kind}:${x.id ?? '?'} (${x.why})`).join('; ');

    /**
     * ⛓⛓⛓ ⚖ §11.8a RULING 2's LADDER, DRIVEN.
     *
     * Returns `{wps}` when a rung produced a corridor the caller should walk,
     * or `{}` when a rung CHANGED THE WORLD and the caller must re-plan (the
     * re-plan cadence rule: a world edit is a re-plan event, §10.4 note 6).
     * Refuses — with the whole climb in the message and in the trace — when
     * the top rung has nothing left.
     *
     * ⛔ EVERY RUNG IS A TRACE ROW AND EVERY ESCALATION NAMES THE CHEAPER
     * RUNG IT REFUSED. That is not bookkeeping: a policy that reached `kill`
     * without ever asking `avoid` is four policies wearing one name, and
     * `r8Acceptance.assertEscalationIsOrdered` is what says so.
     */
    const climbLadder = ({ goal, aim, contacts, allowTeleporter, what, hit,
        dangerExcept = null }) => {
        const escalations = [];
        climbNo += 1;
        const climb = climbNo;
        /**
         * ⛔⛔⛔ A RUNG'S ROW CARRIES THE **WHOLE** REFUSAL CHAIN, not just the
         * rung below it — and that is a fix rather than a flourish.
         *
         * ⚖ §11.8a's requirement is that every escalation be a trace row
         * carrying the refused cheaper rung's reason. The rungs of one climb
         * are decided BEFORE A TICK IS SPENT, so they all land on the same
         * tick index — and a trace is strictly increasing by contract
         * (§8.4 assumption 1), so the producer merges them. The first cut
         * relied on the merge's union to reassemble the chain, which made the
         * ruling's own requirement depend on whether two decisions happened
         * to collide on a tick: a climb where TIME spent ticks and then
         * failed would leave rows that never merged, each naming only one
         * rung, and the chain would be silently shorter. Carrying the chain
         * makes every row self-describing either way.
         */
        const priorRefusals = [];
        const rowFor = (rung, refused, extra = {}) => {
            escalations.push(refused ? { rung, refused } : { rung });
            if (refused) priorRefusals.push(refused);
            seeRow({
                tick: perTick.length,
                saw: saw(),
                goal: { kind: goal.kind, aim: { x: aim.x, y: aim.y } },
                obstacle: { kind: 'danger', id: hit.sources[0]?.id ?? null },
                strategy: { verb: rung === 'avoid' ? 'walk' : rung, rung, climb, ...extra },
                rejected: priorRefusals.map((r) => ({ option: r.rung, why: r.why })),
                keys: [],
            });
        };

        // ── rung 1: AVOID — a static re-plan with the threatened cells out ──
        const vols = dangerVolumes(run, 0)
            .filter((v) => !(dangerExcept && dangerExcept.has(v.id)));
        let refused = null;
        let avoid = null;
        try {
            avoid = planWaypoints(run.world, run.state, aim, allowTeleporter,
                solverPlanOpts(run, contacts, { extraVolumes: vols }));
        } catch (e) {
            if (!(e instanceof BotDriverV2Error)) throw e;
            refused = { rung: 'avoid', why: `no admissible corridor with the danger map's `
                + `${vols.length} volume(s) forbidden — ${e.message.slice(0, 200)}` };
        }
        if (avoid) {
            const still = probeCorridor(avoid, dangerExcept);
            if (!still) {
                rowFor('avoid', null, { waypoints: avoid.length });
                return { wps: avoid, escalations };
            }
            refused = { rung: 'avoid', why: 'the danger-forbidden corridor STILL probes '
                + `dangerous at (${still.x.toFixed(1)},${still.y.toFixed(1)}) — `
                + `${reasonsOf(still)}. ⚠ The AVOID rung routes around RECTS and the probe `
                + 'asks the whole union, which includes the point tests a rect cannot '
                + 'carry (a disc hazard); that gap is why the ladder has a second rung.' };
        }
        rowFor('avoid', null, { refusedWith: refused.why.slice(0, 120) });

        // ── rung 2: TIME — the mover, against the danger TIMELINE ──────────
        const timeline = `dangerMap over L${run.level} at model tick `
            + `${run.ticksCompleted}`;
        const reachable = Math.hypot(aim.x - run.state.x, aim.y - run.state.y)
            <= TIME_RUNG.reach;
        let timeWhy = null;
        if (!reachable) {
            /**
             * ⛔ THE BOUND IS NAMED, NOT WIDENED. `mover.MOVER_RANGE` measures
             * this search reaching ~8 px tick-exact and ~48 px as an upper
             * bound at dwell 4; a rung that asked it to cross a room would
             * spend its whole expansion budget saying no, slowly. So the
             * refusal is arithmetic rather than a search.
             */
            timeWhy = `the aim is ${Math.hypot(aim.x - run.state.x, aim.y - run.state.y)
                .toFixed(0)} px away and \`mover.MOVER_RANGE\` measures this search `
                + `reaching ${TIME_RUNG.reach} px as an UPPER BOUND at dwell `
                + `${TIME_RUNG.dwell}. TIME is the contested LAST-MILE tool (kickoff `
                + '§3.1); it is not a room-crossing one, and the bound is named rather '
                + 'than widened.';
        } else {
            const dash = planDash({
                start: {
                    x: run.state.x, y: run.state.y, vx: run.state.vx, vy: run.state.vy,
                    tick: run.ticksCompleted,
                },
                endRegion: (st) => Math.hypot(st.x - aim.x, st.y - aim.y) <= tolerance,
                forbiddenAt: forbiddenByDanger(run, playerBoxAt),
                timelineName: timeline,
                heuristicTarget: aim,
                dwell: TIME_RUNG.dwell,
                limits: { maxExpansions: TIME_RUNG.maxExpansions },
            });
            if (dash.ok) {
                rowFor('time', refused, {
                    ticks: dash.ticks,
                    certifiedAgainst: dash.certifiedAgainst.claim.slice(0, 160),
                });
                /**
                 * ⛓ THE CERTIFICATE'S SPANS BECOME THE MOVEMENT — ⚖ §11.8a
                 * ruling 2's own words. The keys are driven tick by tick
                 * through the RUN, never replayed through the mover's own
                 * stepper: the certificate is a proposal and `run.advance` is
                 * what the game will be handed.
                 */
                for (const keys of dash.keysPerTick) {
                    const held = new Set(keys);
                    perTick.push(held);
                    const { transition } = run.advance(held);
                    if (transition) break;
                }
                return { escalations };
            }
            timeWhy = `the search returned a NEGATIVE, and it names its own bound: `
                + `${dash.reason} (${dash.bound}).`;
        }
        rowFor('time', refused);
        refused = { rung: 'time', why: timeWhy };

        /**
         * ⛓⛓⛓ WHICH BODY, AND IT IS DERIVED THE WAY `k` IS — by hypothesis.
         *
         * ⛔ THE FIRST DANGER ON THE CORRIDOR IS THE WRONG TARGET, and L6
         * measured it: the corridor's first hit is `sandtrap@64,16`, a body
         * with `speed 0` that nothing can bait and whose arrow death this
         * rung refuses to compute — while the body that actually has to go is
         * `bob@112,48`, which stands in the row-3 detour the weave needs and
         * is not on the original corridor at all. A ladder that baited "the
         * thing it bumped into" would have picked the one body in the room it
         * can do nothing about.
         *
         * ⇒ the target is **the body whose removal ADMITS a corridor**:
         * hypothesise each live body absent from the danger volumes and ask
         * the AVOID rung's own question again. Same shape as ⚖ §11.8a ruling
         * 1(a)'s push-until-path, and same guard as the orchestrator's ruling
         * on it — the hypothesis set is bounded to bodies this policy
         * actually has a strategy for (a LIVE stepped body; a static census
         * row is a wall for this quantifier).
         */
        const removable = chooseBodyToRemove(goal, aim, contacts, allowTeleporter);
        // ⛓ BAIT and the ceiling arm read the head of the ordered set, which
        // is the body the single-return chooser used to hand them.
        const body = removable[0] ?? null;
        let baitWhy = null;
        if (body && body.stepped === false) {
            baitWhy = `${body.id} is a STATIC census body (\`speed 0\`, and this room's `
                + 'chaser roster is refused) — it never writes `v`, so there is no straight '
                + 'line to bend and nothing to lure. That is a KILL question, and the kill '
                + 'is the room\'s own ceiling.';
        } else if (!body) {
            baitWhy = 'NO LIVE BODY\'s removal admits a corridor — the danger on this '
                + `corridor is [${hit.sources.map((sx) => `${sx.kind}:${sx.id}`)
                    .join(', ')}] and this room's live roster is `
                + `[${(run.chasers ?? []).map((c) => c.id).join(', ') || 'empty'}]. A bait `
                + 'moves a body along its own straight line; a static census body, a '
                + 'hazard volume and an arrow lane do not have one, and a body whose '
                + 'removal changes no corridor is not what is in the way.';
        } else if ((ENEMY_CLASSES[body.tag]?.speed ?? 0) === 0) {
            baitWhy = `${body.id} has \`speed 0\` — it never writes \`v\`, so there is no `
                + 'straight line to bend and nothing to lure. That is a KILL question.';
        } else {
            const bait = deriveBaitStance(run, body, contacts);
            if (bait.stance) {
                rowFor('bait', refused, { stance: bait.stance, target: body.id });
                walkTo(goal, bait.stance, {
                    what: `${what} -> bait (${body.id}) stance`,
                });
                const record = runDwell(run, perTick, {
                    ticks: bait.ticks,
                    why: `${body.id}: ${bait.why}`,
                    until: {
                        why: `${body.id} has left the world — the room's own kill region `
                            + 'removed it',
                        test: (r) => !(r.chasers ?? []).some((c) => c.id === body.id),
                    },
                }, `${what} -> bait (${body.id})`);
                records.push({ goal: goal.kind, strategy: 'bait', target: body.id, ...record });
                return { escalations };
            }
            baitWhy = bait.why;
        }
        rowFor('bait', refused);
        refused = { rung: 'bait', why: baitWhy };

        // ── rung 4: KILL — the room's own weapon, held until the count moves ─
        let killWhy = null;
        const target = body ?? null;
        if (target && target.stepped === false) {
            /**
             * ⛓⛓⛓ THE STATIC ARM — the room's ceiling kills it and the GAME
             * writes the flag. ⛔ §11.4 IS NOT WEAKENED: this model still
             * computes nothing about the death. What changed is that the
             * refusal now RAISES the declaration it needs instead of stopping
             * the room, so the single writer of that persistence slot is
             * still the tape — and the tick in it is the game's own.
             */
            const weapon = deriveCeilingWeapon(run, contacts);
            if (!weapon.presser) {
                killWhy = weapon.why;
            } else {
                rowFor('kill', refused, { presser: weapon.presser.tag, target: target.id });
                /**
                 * ⛔⛔ THE SHUT-BEFORE SNAPSHOT IS TAKEN BEFORE THE APPROACH —
                 * §11.7's law, and this rung is the third place it bites. The
                 * stance is INSIDE the presser, so the walk to it arms the
                 * ceiling; a snapshot taken at hold start describes a room
                 * already firing and `runHold`'s positive control then reports
                 * nothing to change and fails BY NAME.
                 */
                const before = {
                    open: run.openActivators,
                    armed: run.armedPulsers ?? new Set(),
                    trapsArmed: run.armedArrowTraps ?? new Set(),
                };
                walkTo(goal, weapon.stance, {
                    what: `${what} -> kill (${target.id}) stance`,
                    contactsOverride: weapon.exempt,
                });
                const tag = persistTagOf(target.row);
                const hits = ENEMY_CLASSES[target.tag]?.kill?.hits ?? 3;
                const bound = hits * ARROW_KILL_FLOOR + HOLD_SLACK;
                const gone = (r) => !(r.world.combat?.enemies ?? [])
                    .some((e) => `${e.tag}@${e.x},${e.y}` === target.id);
                const spentBefore = perTick.length;
                try {
                    const rec = runHold(run, perTick, {
                        presser: { x: weapon.presser.x, y: weapon.presser.y },
                        ticks: bound,
                        until: {
                            why: `${target.id} has left level ${run.level} — which for a `
                                + 'static "Enemy" body means its DECLARED clear fired and '
                                + 'the room was rebuilt without it',
                            test: gone,
                        },
                    }, `${what} -> kill (${target.id})`, before);
                    for (const c of weapon.exempt) exemptions.add(c);
                    const drained = drainCeiling(run, perTick, weapon,
                        { what: `${what} -> kill (${target.id})`, walkTo, goal });
                    records.push({ goal: goal.kind, strategy: 'kill', target: target.id,
                        ...rec, drained });
                    return { escalations };
                } catch (e) {
                    /**
                     * ⛔ ONLY A BOUND THAT RAN OUT BECOMES A DECLARATION.
                     * `runHold` fails by name for half a dozen reasons — a
                     * stance off the button, a hold that changes nothing, a
                     * transition — and converting ANY of them into "ask the
                     * game" would launder a defect into a measurement. The
                     * test is arithmetic: the hold spent its whole bound and
                     * the body is still standing.
                     */
                    const spent = perTick.length - spentBefore;
                    if (!(e instanceof BotDriverV2Error) || gone(run) || spent < bound) throw e;
                    /**
                     * ⛔ THE BOUND RAN OUT AND THE BODY IS STILL THERE — WHICH
                     * FOR THIS CLASS IS THE MEASUREMENT, NOT A FAILED CLAIM.
                     * The model REFUSES to compute this death (§11.4), so a
                     * hold that watched for it and saw nothing is exactly the
                     * state the two-pass loop's game-sourced arm exists for:
                     * the ticks are spent, the ceiling has been firing, and
                     * the prefix is what the running game is handed.
                     */
                    throw new PendingDeclaration(`${what}: held `
                        + `${weapon.presser.tag}@${weapon.presser.x},${weapon.presser.y} `
                        + `for the whole ${bound}-tick bound with `
                        + `[${weapon.arms.map((t) => t.id).join(', ')}] firing, and `
                        + `${target.id} is STILL STANDING in this model — which is correct: `
                        + '§11.4 refuses to compute a static "Enemy" body\'s arrow death, '
                        + 'because its clear is the tape\'s DECLARED v9 `at` row and a '
                        + 'second writer of one persistence slot is two cost models. The '
                        + 'tick is the GAME\'s.',
                    { goal, obstacle: { kind: 'static-enemy', id: target.id },
                        rows: [...rows], perTick: [...perTick],
                        pending: {
                            level: run.level, tag, source: 'game', body: target.id,
                            presser: `${weapon.presser.tag}@${weapon.presser.x},${weapon.presser.y}`,
                            bound,
                            why: `${hits} hit(s) at \`ARROW_KILL_FLOOR\` ${ARROW_KILL_FLOOR} `
                                + `+ ${HOLD_SLACK} slack; §11.4 refuses the death staging`,
                        } });
                }
            }
        } else if (!target) {
            killWhy = 'the danger on this corridor is not a body this run can watch die — '
                + 'a kill needs a target whose removal the model OBSERVES, and '
                + '⛔ a static "Enemy" body\'s own arrow death is REFUSED by name (§11.4): '
                + 'its clear is the tape\'s DECLARED v9 `at` row, and a second writer of '
                + 'one persistence slot is two cost models.';
        } else {
            const kill = deriveKillByCeiling(run, target, contacts);
            if (kill.presser) {
                rowFor('kill', refused, { presser: kill.presser.tag, target: target.id });
                walkTo(goal, kill.stance, {
                    what: `${what} -> kill (${target.id}) stance`,
                    contactsOverride: kill.exempt,
                });
                const record = STRATEGY_EXECUTORS.hold(run, perTick, {
                    target: { x: kill.presser.x, y: kill.presser.y },
                    hold: {
                        ticks: KILL_BY_CEILING_BOUND,
                        until: {
                            why: `${target.id} has left the world — ${kill.why}`,
                            test: (r) => !(r.chasers ?? []).some((c) => c.id === target.id),
                        },
                    },
                }, {
                    maxTicksPerTarget,
                    what: `${what} -> kill (${target.id})`,
                    before: {
                        open: run.openActivators,
                        armed: run.armedPulsers ?? new Set(),
                        trapsArmed: run.armedArrowTraps ?? new Set(),
                    },
                });
                for (const c of kill.exempt) exemptions.add(c);
                records.push({ goal: goal.kind, strategy: 'kill', target: target.id, ...record });
                return { escalations };
            }
            /**
             * ⛓⛓⛓ R9 SLICE 12b — **THE CHASER ARM, WHERE THE CEILING HAS
             * NOTHING TO ARM** (⚖ ruling 30(d)). L14 has 0 pressers and 0
             * traps; what it has is a sword and a `modelled` press arm.
             */
            /**
             * ⛓⛓⛓ R9 SLICE 12b′ — **THE CHASER ARM READS THE SET IN INTERCEPT
             * ORDER**, and the order is the corridor probe's own answer.
             *
             * `chooseBodyToRemove` orders by distance from the AIM, which is
             * the right question for BAIT (lure the body that is IN the way)
             * and the wrong one for an iterative stand-and-strike: the body
             * nearest the destination is the one furthest from the fight. The
             * probe already named which body reaches the walk first — it is
             * `hit.sources`, the danger this climb is here about — so the arm
             * reads those FIRST, in the order the corridor met them, and the
             * chooser's own order behind them. Derived, not typed (⚖ ruling
             * 17), and it needs no second forecast.
             */
            const hunted = interceptOrder(removable, hit)[0] ?? target;
            const hunt = deriveKillByChaser(run, hunted, contacts,
                { aim, allowTeleporter, tolerance });
            if (hunt.stance) {
                rowFor('kill', refused, { arm: 'chaser', target: hunted.id,
                    stance: hunt.stance, runnersUp: hunt.runnersUp });
                const strike = strikePolicyFor(run);
                if (!strike) {
                    killWhy = `${hunt.why} — but this run holds no sword, so `
                        + '`set slashing`\'s outer gate refuses every press.';
                } else {
                    /**
                     * ⛓⛓⛓ **THE STANCE IS WALKED TO, AND THE WALK IS THE
                     * LADDER'S OWN.** `walkTo` re-enters this whole climb for
                     * the corridor to the stance, so the approach the
                     * derivation previewed is certified by the same
                     * instruments that certify any other leg — and the strike
                     * policy is on it, because `walkTo` is a walk.
                     *
                     * ⚠ Skipped when the stance IS where the walk stands: a
                     * `walkTo` to the current cell arrives before its first
                     * tick, which is the empty-preview case `probeCorridor`
                     * names, and spending a re-plan on it would put an
                     * ARRIVED row in the trace for a walk nobody took.
                     */
                    if (hunt.stance.x !== run.state.x || hunt.stance.y !== run.state.y) {
                        walkTo(goal, hunt.stance, {
                            what: `${what} -> kill (${hunted.id}) stance`,
                        });
                    }
                    /**
                     * ⛔ THE BOUND IS THE FORECAST'S OWN MEASUREMENT, plus the
                     * slack — and that is the repair. Slice 12b's
                     * `killWindowTicks(tag) * 3 + HOLD_SLACK` is three landed
                     * hits at the receiver's i-frame plus a slack term, and it
                     * omits the one quantity that dominates a stand-and-strike:
                     * how long the body takes to WALK to the stance. On a bob
                     * that formula is 108 ticks and no stance on L14 kills its
                     * first body inside 108. The derivation previewed this
                     * exact wait and saw the death; `hunt.ticks` is that tick
                     * plus `HOLD_SLACK`, so the bound is a claim this run can
                     * refute rather than a number chosen to be safe.
                     */
                    const bound = hunt.ticks;
                    /**
                     * ⛔ `runDwell`, NOT `runHold`. `hold`'s per-tick invariant
                     * is *"still inside the presser"* — this stance is not on
                     * a button and there is no presser to be inside. A dwell
                     * is a bounded wait on an OBSERVED condition, which is
                     * exactly the shape here, and it carries the strike
                     * policy so the wait is armed.
                     */
                    const record = runDwell(run, perTick, {
                        ticks: bound,
                        strike,
                        why: hunt.why,
                        until: {
                            why: `${hunted.id} has left the world — ${hunt.why}`,
                            test: (r) => !(r.strikeBodies ?? [])
                                .some((c) => c.id === hunted.id),
                        },
                    }, `${what} -> kill (${hunted.id}) by press`);
                    // ⛓ `record.strikes` is the dwell's own — `runDwell` reads
                    // it off the policy it was armed with, so there is one
                    // owner of the number rather than two spellings of it.
                    records.push({
                        goal: goal.kind, strategy: 'kill', arm: 'chaser',
                        target: hunted.id, stance: hunt.stance,
                        clears: hunt.clears, ...record,
                    });
                    /**
                     * ⛓⛓ **THE ARM IS ITERATIVE AND THIS IS WHERE IT
                     * ITERATES.** Returning `{escalations}` is the ladder's
                     * "a rung CHANGED THE WORLD, re-plan" answer (§10.4 note
                     * 6): the caller re-asks AVOID from the new position
                     * against the room this kill left. If the corridor now
                     * certifies WITH strikes, that is the normal exit; if it
                     * does not, the next climb derives the next stance for the
                     * next body. One stance per body, because the measurement
                     * says a wait ends when its own body goes.
                     */
                    return { escalations };
                }
            } else {
                killWhy = `${kill.why}\n         chaser arm: ${hunt.why}`;
            }
            if (!killWhy) killWhy = kill.why;
        }
        rowFor('kill', refused);
        refuse(`${what}: the combat ladder is EXHAUSTED. The corridor passes through `
            + `danger at (${hit.x.toFixed(1)},${hit.y.toFixed(1)}) — ${reasonsOf(hit)} — `
            + `and every rung of ⚖ §11.8a's order refused:\n`
            /**
             * ⛓ EACH RUNG PRINTS ITS OWN REASON. An escalation CARRIES the
             * cheaper rung's refusal — that is the ruled shape — so the
             * summary has to unwrap it, or every line reads as the rung above
             * failing for the rung below's reason. Found by reading the first
             * exhausted climb this ladder produced.
             */
            + escalations.slice(1).map((e) => `  ${e.refused.rung}: ${e.refused.why}`)
                .join('\n')
            + `\n  ${escalations[escalations.length - 1].rung}: ${killWhy}`, {
            goal,
            obstacle: { kind: 'danger', id: hit.sources[0]?.id ?? null },
            considered: escalations.map((e) => ({
                option: e.rung, why: e.refused?.why ?? 'attempted',
            })).concat([{ option: 'kill', why: killWhy }]),
        });
        return {};
    };

    /**
     * Walk to `aim` through a planned corridor, re-planning ONCE per failure
     * with a trace row — never silently (the botDriverV2 doctrine, kept: a
     * silent re-plan hides a model divergence; a TRACED one is a decision a
     * reader can audit).
     */
    const walkTo = (goal, aim, {
        allowTeleporter = null, crossTo = null, what, contactsOverride = null,
        dangerExcept = null,
    }) => {
        for (let attempt = 0; ; attempt += 1) {
            const contacts = contactsOverride
                ? new Set([...senseContacts(run), ...contactsOverride])
                : new Set([...senseContacts(run), ...exemptions]);
            /**
             * ⛓ The derived exclusion is recomputed PER ATTEMPT, from the
             * live position — a re-plan after a verb has moved the player off
             * a button asks the un-excluded question, which is the one that
             * is true there.
             */
            const leaving = lanesUnpublishedByLeaving(run);
            const except = (dangerExcept || leaving)
                ? new Set([...(dangerExcept ?? []), ...(leaving ?? [])])
                : null;
            refuseDanger(run.state.x, run.state.y, goal, what, except);
            let wps;
            try {
                wps = planWaypoints(run.world, run.state, aim, allowTeleporter,
                    solverPlanOpts(run, contacts));
            } catch (e) {
                if (!(e instanceof BotDriverV2Error)) throw e;
                const identified = identifyAndSelect(goal, aim, contacts, e, allowTeleporter);
                /**
                 * ⛓⛓⛓ **THE PREREQUISITE IS CONSUMED HERE AND NOWHERE ELSE** —
                 * PROCGEN ELEMENTS arc 3, slice S1, gap 1.
                 *
                 * A resolution may come back saying *"my stance is reachable once
                 * `<id>` has been discharged"*. This is the ONE place a stance
                 * becomes a walk, so it is the one place that may answer: the
                 * order for `<id>` REPLACES this round's plan, is applied by the
                 * statements below exactly as any frontier order is, and the loop
                 * then `continue`s — so the original obstacle is RE-IDENTIFIED and
                 * RE-DERIVED against the world the prerequisite changed, rather
                 * than against a promise about it.
                 *
                 * ⛔ THAT RE-ENTRY IS THE WHOLE REASON THERE IS NO SECOND
                 * FRONTIER. The bounded `applied` count, the hypothesis ledger,
                 * the trace row, the shut-before snapshot and the exemption carry
                 * are all the ones already here; a prerequisite is an ordinary
                 * order that happened to be named by a derivation instead of by a
                 * flood.
                 */
                const plan = identified.resolved.prerequisite
                    ? prerequisiteOrder(goal, aim, identified, contacts, allowTeleporter, what)
                    : identified;
                /**
                 * ⛔ THE APPLICATION IS BOUNDED, AND THE BOUND IS NAMED. A
                 * policy that re-identified for ever would look exactly like
                 * one that was making progress. Each application must change
                 * the world (a verb edits it) — so the count is the number of
                 * DISTINCT obstacles a single goal may be allowed to clear,
                 * and running it out is a refusal that says which ones it
                 * cleared.
                 */
                if (applied.length >= MAX_STRATEGIES_PER_GOAL) {
                    refuse(`${what}: applied ${applied.length} strategies for one goal `
                        + `[${applied.join(', ')}] and the corridor still does not plan. `
                        + 'A policy that keeps clearing obstacles without a corridor '
                        + 'appearing is not making progress.', { goal, obstacle: plan.obstacle });
                }
                applied.push(`${plan.strategy}(${plan.obstacle.id})`);
                if (plan.strategy === 'shove' && plan.resolved.discharged?.length) {
                    hypothesisLedger.push({
                        id: plan.obstacle.id, tag: plan.obstacle.tag,
                        k: plan.resolved.k, discharged: plan.resolved.discharged,
                    });
                }
                const before = perTick.length;
                seeRow({
                    tick: before,
                    saw: saw(),
                    goal: { kind: goal.kind, aim: { x: aim.x, y: aim.y } },
                    obstacle: { kind: plan.obstacle.kind, id: plan.obstacle.id },
                    strategy: {
                        verb: plan.strategy,
                        ...(plan.resolved.k !== undefined ? { k: plan.resolved.k } : {}),
                        ...(plan.resolved.postCondition
                            ? { postCondition: plan.resolved.postCondition } : {}),
                        ...(plan.resolved.shove
                            ? { to: plan.resolved.shove.to, dir: plan.resolved.shove.dir,
                                destroys: Boolean(plan.resolved.shove.destroys) } : {}),
                    },
                    rejected: plan.resolved.rejected ?? [],
                    keys: [],
                });
                /**
                 * ⛔⛔ THE SHUT-BEFORE SNAPSHOT, TAKEN BEFORE THE APPROACH —
                 * `runChest`'s own law, and the first smoke run of this
                 * executor measured why it applies to a hold too. The stance
                 * for a hold is INSIDE the presser's volume, so the walk to
                 * it presses the button: by the time the verb begins, the
                 * traps it exists to arm are already armed and its positive
                 * control ("shut before, open after") reports nothing to
                 * change. "Shut when the strategy was chosen" is the state a
                 * correct walk is never in at the stance.
                 */
                const beforeStrategy = {
                    open: run.openActivators,
                    armed: run.armedPulsers ?? new Set(),
                    trapsArmed: run.armedArrowTraps ?? new Set(),
                    /**
                     * ⛓ ⚖ SLICE 10 — AND THE CHEST'S OWN SET, for the same
                     * reason the other three are here. `runChest`'s positive
                     * control is *"shut when the verb was chosen"*, and the
                     * chest stance is ON the probe line — so the walk to it
                     * is exactly what opens the chest, and a snapshot taken
                     * at verb start would report an already-open chest and
                     * fail by name. The goal path has taken this snapshot
                     * since R8 slice 2 (`const before = … { chests: … }`);
                     * the frontier path is the second caller and needed the
                     * same field. ⚠ Inert for every other verb: nothing but
                     * `runChest` reads `before.chests`.
                     */
                    chests: run.openChests,
                };
                // The stance first — planned with whatever exemptions the
                // strategy's own resolution earned (trap 147: a hold is what
                // ADDS its presser to the exemptions, so the stance and the
                // exemption are one decision).
                if (plan.resolved.stance) {
                    walkTo(goal, plan.resolved.stance, {
                        what: `${what} -> ${plan.strategy} stance `
                            + `(${plan.obstacle.id})`,
                        contactsOverride: plan.resolved.exempt,
                    });
                }
                const record = STRATEGY_EXECUTORS[plan.strategy](run, perTick, plan.resolved, {
                    maxTicksPerTarget,
                    what: `${what} -> ${plan.strategy}`,
                    before: beforeStrategy,
                    /**
                     * ⛓ R8 slice 4 — AN EXECUTOR MAY NEED TO WALK. `kill`'s
                     * bait/back phases move the player between waits, and
                     * they must move through the SAME planner, danger probe
                     * and ladder every other walk uses. Handing the loop's
                     * own `walkTo` down is what keeps that one implementation
                     * (§11.7's law, read for a verb that sequences).
                     */
                    walkTo, goal,
                });
                records.push({ goal: goal.kind, strategy: plan.strategy, ...record });
                // ⛓ THE EXEMPTION SURVIVES THE VERB. A `hold` leaves the
                // player standing in the presser's volume, so every later
                // plan of this segment carries it — which is what
                // `senseContacts` would answer anyway at that position, and
                // is stated rather than left to a coincidence of standing
                // still.
                for (const c of plan.resolved.exempt ?? []) exemptions.add(c);
                continue;
            }
            waypointsPlanned += wps.length;
            /**
             * ⛓ THE CORRIDOR IS PROBED AGAINST THE DANGER MAP — SEGMENT BY
             * SEGMENT, SAMPLED, before a tick is spent on it. The A\* stack
             * plans over walkable TILES and is deliberately ignorant of
             * threat (§18.6's measured lesson: a freehand L6 plan walks row
             * 1 straight into a sandtrap) — the danger map is the layer
             * that knows, and slice 2's response to a hit here is a refusal
             * that carries the reason list.
             *
             * ⛔ SAMPLED ALONG THE SEGMENTS, NOT AT THE WAYPOINTS. The first
             * cut probed waypoint POINTS only, and the L6 attempt measured
             * the hole: a string-pulled two-waypoint corridor put both
             * probe points OUTSIDE the sandtrap volumes while the segment
             * between them crossed two of them — the walk then discovered
             * the danger as a 400-tick stall instead of a named refusal.
             * Eight-pixel samples are finer than any volume on the hazard
             * roster (the smallest is a 16 px box). Slice 3's dodge policy
             * replaces the refusal with a re-plan against
             * `forbiddenByDanger`; the probe itself is the seam it plugs
             * into.
             */
            const hit = probeCorridor(wps, except);
            if (hit) {
                /**
                 * ⛓⛓⛓ ⚖ §11.8a RULING 2 — THE LADDER REPLACES SLICE 2's
                 * REFUSAL. Slice 2 sensed the danger and refused, naming
                 * `dodge` as the unregistered option; this is the option,
                 * registered — AVOID -> TIME -> BAIT -> KILL, cheapest
                 * first, every escalation a trace row carrying the refused
                 * cheaper rung's reason.
                 */
                const climbed = climbLadder({
                    goal, aim, contacts, allowTeleporter, what, hit,
                    dangerExcept: except,
                });
                if (climbed.wps) { wps = climbed.wps; } else { continue; }
            }
            /**
             * ⛓⛓⛓ R9 SLICE 12c′, ⚖ RULING 35 — **THE PLANNER IS ASKED ONCE
             * PER CORRIDOR, ABOVE THE ONE POLICY THE WHOLE WALK SHARES.**
             *
             * ⛔ AT `ALLOW_DASH_ROSTER_WIDE === false` IT IS NOT ASKED AT ALL,
             * so no committed corridor can reach a plan and the flip is one
             * line. When it is asked, its candidates are certified through
             * `probeSamples` — this rung's OWN danger predicate, not a second
             * reading of it (trap 567) — and the plan is handed to
             * `strikePolicyFor`, the single construction site, so the preview
             * and the drive walk the same schedule (⚖ ruling 30(c)).
             *
             * ⛔⛔ AND IT IS REPORTED ON THE **WALK ROW**, not on a row of its
             * own. `seeRow` merges rows that land on the same tick, and every
             * rung of one climb is decided before a tick is spent — so a
             * separate `sword-dash` row at `perTick.length` OVERWRITES the
             * walk row's `verb` and `path`. Measured: the first cut did
             * exactly that and every campaign trace lost its waypoint list.
             */
            const dash = ALLOW_DASH_ROSTER_WIDE
                ? planSwordDash(run, wps, { tolerance,
                    certify: (samples) => probeSamples(samples, except) })
                : null;
            seeRow({
                tick: perTick.length,
                saw: saw(),
                goal: { kind: goal.kind, aim: { x: aim.x, y: aim.y } },
                strategy: {
                    verb: 'walk',
                    waypoints: wps.length,
                    ...(dash ? { swordDash: { planned: Boolean(dash.plan),
                        ticks: dash.ticks, baseline: dash.baseline, saved: dash.saved,
                        windows: dash.windows ?? null, legs: dash.legs ?? null,
                        scanned: dash.scanned, why: dash.why } } : {}),
                },
                path: wps.map((w) => ({ x: w.x, y: w.y })),
                rejected: [
                    ...(attempt === 0 ? [] : [{
                        option: 'keep-plan',
                        why: 'the previous corridor was refuted by the world '
                            + '(a blocked sweep or a stall); re-planned from the live position',
                    }]),
                    /**
                     * ⛓ THE SCAN IS SUMMARISED, NOT TRANSCRIBED. It asks about
                     * every tick the walk is still running, so a trace that
                     * carried one row per rejected start would put a hundred
                     * rows in every tape's sidecar. One row per reason KIND,
                     * with its count and the first example, is what a reader
                     * needs — and `scanned` says how many were asked, so a
                     * bounded sweep names what it bounded.
                     */
                    ...(dash ? dashRejectionSummary(dash) : []),
                ],
                keys: [],
            });
            /**
             * ⛓⛓⛓ R9 SLICE 12b — ONE POLICY FOR THE WHOLE WALK, not one per
             * waypoint, because `probeCorridor` previewed the whole waypoint
             * list in one call. A per-waypoint policy would forget which
             * bodies it had already struck at every corner and would press
             * again into a live i-frame the moment a corridor bent.
             */
            /**
             * ⛓ A REFUSED PLAN COSTS THE WALK NOTHING: the policy is built
             * without one and the corridor is walked exactly as it was before
             * this existed.
             */
            const strike = strikePolicyFor(run, { dashPlan: dash?.plan ?? null });
            try {
                for (let wi = 0; wi < wps.length; wi += 1) {
                    const last = wi === wps.length - 1;
                    const until = (last && crossTo) ? 'transition' : 'arrival';
                    const t = drive(run, wps[wi], perTick, {
                        until,
                        tolerance,
                        maxTicks: maxTicksPerTarget,
                        avoidVolumes: true,
                        contacts,
                        crossTo,
                        grazes,
                        strike,
                        what: `${what} waypoint ${wi} (${wps[wi].x},${wps[wi].y})`,
                    });
                    if (t && crossTo) return t;
                }
                if (crossTo) {
                    refuse(`${what}: reached the exit aim without a transition — the `
                        + 'trigger did not fire from the certified corridor.', { goal });
                }
                return null;
            } catch (e) {
                if (!(e instanceof BotDriverV2Error)) throw e;
                if (attempt >= 1) {
                    refuse(`${what}: the re-planned corridor failed too — ${e.message}`, {
                        goal,
                        considered: [
                            { option: 'walk', why: 'two corridors refuted from live positions' },
                            { option: 'dodge', why: 'not a registered policy this slice' },
                        ],
                    });
                }
                replans += 1;
            }
        }
    };

    // ── the goals, in order ───────────────────────────────────────────
    for (const goal of goals) {
        // The bound is PER GOAL: clearing L4's button for the crossing says
        // nothing about how many obstacles the next room's goal may need.
        applied = [];
        openerChain = [];
        if (goal.kind === 'reach-exit') {
            const { index, teleporter } = findExit(run.world, goal.exit);
            const centre = {
                x: teleporter.rect.x + TILE_SIZE / 2,
                y: teleporter.rect.y + TILE_SIZE / 2,
            };
            const crossTo = { level: teleporter.to, arrival: { ...teleporter.arrival } };
            const t = walkTo(goal, centre, {
                allowTeleporter: index,
                crossTo,
                what: `solverBot(${name}) reach-exit (${goal.exit.x},${goal.exit.y})`
                    + `->L${teleporter.to}`,
            });
            records.push({ goal: 'reach-exit', to: teleporter.to, t: t.t });
            continue;
        }
        // collect-placement
        const resolved = resolveCollectStrategy(run, goal.placement);
        if (!resolved) {
            refuse(`solverBot(${name}): collect-placement (${goal.placement.x},`
                + `${goal.placement.y}) resolves to NOTHING in level ${run.level} — `
                + 'no chest and no pickup stands there. A goal about an absent thing '
                + 'is a macro-layer error, said here rather than walked at.', {
                goal,
                obstacle: { kind: 'absent-placement', id: null },
            });
        }
        let contacts = senseContacts(run);
        const what = `solverBot(${name}) ${resolved.strategy} `
            + `(${goal.placement.x},${goal.placement.y})`;
        /**
         * ⛔ CLEAR WHAT THE PLACEMENT IS INSIDE, BEFORE DERIVING A STANCE
         * NEAR IT. See `placementBlocker`: L19's boss key is inside the boss,
         * and a stance derivation cannot see that at all — it asks about
         * cells around the placement, and every one of them is fine.
         */
        for (let guard = 0; ; guard += 1) {
            const blocker = placementBlocker(run, resolved, contacts);
            if (!blocker) break;
            if (guard >= MAX_STRATEGIES_PER_GOAL) {
                refuse(`${what}: cleared ${guard} obstacle(s) and the placement is STILL `
                    + `inside ${blocker.id}.`, { goal, obstacle: blocker });
            }
            const key = blocker.tag ? `${blocker.kind}:${blocker.tag}` : blocker.kind;
            const strategy = refineStrategy(run,
                OBSTACLE_STRATEGIES[key] ?? OBSTACLE_STRATEGIES[blocker.kind] ?? null,
                blocker);
            const resolvedBlocker = strategy && STRATEGY_EXECUTORS[strategy]
                ? resolveObstacleStrategy(run, strategy, blocker, contacts,
                    { x: goal.placement.x, y: goal.placement.y }, null, [...refusedOrders])
                : null;
            if (!resolvedBlocker) {
                refuse(`${what}: the placement is INSIDE ${key} (${blocker.id}) — a `
                    + 'pickup in a solid is an obstacle, not a stance problem. '
                    + `${strategy ? `Strategy '${strategy}' ${STRATEGY_EXECUTORS[strategy]
                        ? 'failed to apply' : 'is SELECTED but not registered'}.`
                        : 'No strategy row exists for this obstacle.'}`,
                { goal, obstacle: blocker });
            }
            applied.push(`${strategy}(${blocker.id})`);
            seeRow({
                tick: perTick.length,
                saw: saw(),
                goal: { kind: goal.kind, placement: { ...goal.placement } },
                obstacle: { kind: blocker.kind, id: blocker.id },
                strategy: { verb: strategy },
                rejected: resolvedBlocker.rejected ?? [],
                keys: [],
            });
            if (resolvedBlocker.stance) {
                walkTo(goal, resolvedBlocker.stance, {
                    what: `${what} -> ${strategy} stance (${blocker.id})`,
                    contactsOverride: resolvedBlocker.exempt,
                });
            }
            const rec = STRATEGY_EXECUTORS[strategy](run, perTick, resolvedBlocker, {
                maxTicksPerTarget, what: `${what} -> ${strategy}`, before: null,
                walkTo, goal,
            });
            records.push({ goal: goal.kind, strategy, ...rec });
            for (const c of resolvedBlocker.exempt ?? []) exemptions.add(c);
            contacts = senseContacts(run);
        }
        const stance = deriveStance(run, resolved, contacts);
        /**
         * ⛔ THE SHUT-BEFORE SNAPSHOT, taken BEFORE the approach — `runChest`
         * demands it because the trigger is a line the approach itself may
         * cross, so "shut when the verb began" is a state a correct walk is
         * never in at the stance.
         */
        const before = resolved.strategy === 'chest' ? { chests: run.openChests } : null;
        /**
         * ⛓ PROCGEN PoC SLICE 3 — THE SAME WALK, EITHER WAY. `deriveStance`
         * now hands back a stance it could not plan a corridor to (flagged
         * `corridor: false`), and this walk is where that is answered: the
         * ladder inside `walkTo` identifies the frontier obstacle and clears
         * it, exactly as a REACH-EXIT crossing's walk always has. The ONLY
         * difference here is the `what` string, so a refusal downstream says
         * which kind of stance it was walking to rather than leaving a reader
         * to infer it from the absence of a corridor.
         */
        walkTo(goal, stance, {
            what: stance.corridor === false
                ? `${what} stance (ladder-routed: ${stance.why})`
                : `${what} stance`,
        });
        refuseDanger(run.state.x, run.state.y, goal, what);
        const verbTick = perTick.length;
        const exec = STRATEGY_EXECUTORS[resolved.strategy];
        if (!exec) {
            refuse(`${what}: strategy '${resolved.strategy}' is selected and NOT `
                + 'registered this slice.', {
                goal, considered: resolved.rejected,
            });
        }
        const record = exec(run, perTick, resolved, {
            maxTicksPerTarget, what, before, walkTo, goal,
        });
        records.push({ goal: 'collect-placement', strategy: resolved.strategy, ...record });
        if (perTick.length === verbTick) {
            fail(`${what}: the verb emitted zero ticks — a decision with no tick has no `
                + 'key set for its trace row, and a zero-tick verb here means the stance '
                + 'already satisfied it, which the resolver should have seen.');
        }
        seeRow({
            tick: verbTick,
            saw: saw(),
            goal: { kind: goal.kind, placement: { ...goal.placement } },
            strategy: { verb: resolved.strategy },
            obstacle: null,
            rejected: resolved.rejected,
            keys: [],
        });
    }

    // ── the trace, filled and validated ───────────────────────────────
    /**
     * ⛓ KEYS ARE FILLED FROM THE EMITTED TICKS, then rows sharing a tick
     * are MERGED (a stance already reached makes a walk row and a verb row
     * land on one tick — one decision instant, one row; the merged row
     * keeps the later strategy and carries the earlier one in `note`).
     * `assertTraceMatchesTape` downstream then compares these keys against
     * `heldKeysAt` on the real tape — the row that makes the trace a
     * measurement.
     */
    rows.sort((a, b) => a.tick - b.tick);
    const merged = [];
    /**
     * ⛓⛓⛓ R8 SLICE 3b — WHICH ROW SURVIVES A MERGE, AND WHY THE FIRST RULE
     * WAS WRONG THE MOMENT A STRATEGY GOT A DERIVED PARAMETER.
     *
     * Slice 2's rule was "later decision wins", measured on its own case: a
     * stance already reached makes a walk row and a VERB row land on one
     * tick, and the verb is the later. This slice's shove lands the other
     * order — the STRATEGY SELECTION (with its derived `k` and its rejected
     * `k-1`/`k+1`) is recorded first, then the walk TO the stance the
     * selection derived, both before a tick is spent — so "later wins"
     * discarded the only row that said anything, and the trace showed three
     * identical `walk` rows for a segment that shoved a block.
     *
     * ⇒ the rule is now the one that covers BOTH cases: **`walk` is the
     * fallback decision and a substantive one outranks it on the same
     * tick**; between two substantive rows, later still wins. A walk to a
     * stance is a CONSEQUENCE of the selection that derived the stance, not
     * a later independent decision.
     *
     * ⛔ AND THE REJECTIONS ARE UNIONED RATHER THAN DROPPED. "What it
     * rejected and why" is the whole Cloudberry footnote-3 lesson; a merge
     * that kept one row's rejections and silently ate the other's would make
     * the trace's most load-bearing field depend on tick collisions.
     */
    const substantive = (r) => r.strategy.verb !== 'walk' || Boolean(r.obstacle);
    for (const row of rows) {
        const prev = merged[merged.length - 1];
        if (prev && prev.tick === row.tick) {
            const keep = (substantive(prev) && !substantive(row)) ? prev : row;
            const drop = keep === prev ? row : prev;
            const seen = new Set(keep.rejected.map((r) => `${r.option}|${r.why}`));
            keep.rejected = [...keep.rejected,
                ...drop.rejected.filter((r) => !seen.has(`${r.option}|${r.why}`))];
            keep.note = `${keep.note ? `${keep.note}; ` : ''}merged: `
                + `${drop.strategy.verb} decided on the same tick`;
            merged[merged.length - 1] = keep;
            continue;
        }
        merged.push(row);
    }
    const builder = createTraceBuilder({
        tape: name,
        boot: { level: boot.level, x: boot.x, y: boot.y },
    });
    for (const row of merged) {
        if (row.tick >= perTick.length) continue; // a decision after the last tick
        builder.record({ ...row, keys: [...perTick[row.tick]].sort() });
    }
    const trace = builder.finish(perTick.length);

    return {
        perTick,
        trace,
        transitions: run.transitions,
        waypointsPlanned,
        replans,
        grazes,
        records,
        /**
         * ⛓ EDITOR ARC SLICE 9 — beside `trace`, deliberately, and not inside
         * it. A trace row is a DECISION and its `saw.danger` is a summary
         * (`kind:id`, no reason, no box); this is the query itself, with the
         * union's own `why` on every source. Folding it into the rows would
         * have changed the committed trace sidecars — which is the one thing
         * an instrument added to a solver may not do.
         */
        dangerQueries,
    };
}
