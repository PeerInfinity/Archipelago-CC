/**
 * seedlingDemo/solverBot — the LIVE SOLVER POLICY. R8 slice 2,
 * the R8 kickoff §3.1 / §4 slice 2 (⚖ §6.2
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
    BotDriverV2Error, DEFAULT_LATTICE, coastThroughTransport, contactsAt, drive, findExit,
    holdOneAxis, isWalkableTile, nodeCentre, nodeAt, plannerObstacleAt, planWaypoints, runChest, runCollect,
    runHold,
    runShove, runDwell, SHOVE_STEP,
    CEREMONY_CADENCE_START, ceremonyCadenceStep, runFire,
} from './botDriverV2.js';
import { resolvePresser } from './botDriverV2.js';
import {
    KEY_RESPONDERS, RESPONDERS, TOUCH_RESPONDERS, keyLineTouches, localPublish,
    fallRocksArmedBy, groupResponders,
    opensOnKeyTick, opensOnTick, touchApproachKey,
    SHIELD_BOSS, shieldBossBandRect, shieldBossBodyRect, shieldBossDeathSchedule,
    SPINNER, hammerHitsPlayer,
    KILL_ARM_POLICY,
    DOWN, EMPTY_SWORD_WINDOW, LEFT, RIGHT, SLASH_HIT_TICKS, SLASH_REACH, UP,
    distanceRectPoint, slashReachFor, slashRect,
    swordWindowReplace, swordWindowSchedule, swordWindowStep,
    /**
     * ⛓⛓⛓ R9 SLICE 4 — THE ROCK'S OWN TRANSCRIPTION, ASKED RATHER THAN COPIED.
     * `rockBreaksUnder` is `hit(_t)`'s test (`rockType <= hasGhostSword ? 1 : 0`),
     * `WAIT_AFTER_PRESS_TICKS` is the LEG's promise and `assertWaitCovers` is the
     * check that a leg keeps it. ⛔ None of the three numbers is retyped here
     * (trap 89): the module that transcribed `BreakableRock.as` owns them, and the
     * one that owns `HIT_TO_GONE_TICKS`' ±1 is the one that must say how long a
     * wait has to be.
     */
    WAIT_AFTER_PRESS_TICKS, assertWaitCovers, rockBreaksUnder,
    ARROW, arrowLaneForPlacement, arrowLaneRect, arrowTrapFires,
    bridgedChaserTags, chaserBoxAt, killWindowTicks,
    DESTROYING_TILE_TYPES,
    rect, rectsOverlap, TILE_SIZE,
    ENEMY_CLASSES, KILL_LOCK_TAGS, KILL_LOCK_TSET, contactPricing,
    // ⛓ R8 slice 8: the PRESSER's own cadence floor — the dash rule plus the
    // receiver's i-frames, in one constant `killSchedule` has refused a smaller
    // value than since R5. The press arm never consulted it; the game found out.
    DASH_CHAIN, DASH_DISPLACEMENT, KILL_PRESS_CADENCE, ORDINARY_SWING_PERIOD,
    SLASH_ANIM_TICKS, slashScaleFor, slashSet, slashTimerTick,
    MOBILE_DEATH_FADE, STATIC_ARROW_DEATH,
    fallDestination, PhysicsV2Error, playerBoxAt,
    HITBOX, WALK_SPEED,
    applyFriction, applyInput, DEFAULT_FRICTION, sweepAxis,
    chestStanceBand,
    fireRect, INVENTORY_ITEM_IDS, auditFire,
    pullModelled, pullsDrainingInto,
    PULSER, pulsePushes, pulserCycle, newPushable,
    KILLLOCK_BODIES,
} from './solverView.js';
import {
    bodyKillRegions, dangerAt, dangerDuringTransit, dangerVolumes, forbiddenByDanger,
    AXE_UPDATE_OFFSET, axeVisitClock, phaseHazardCanReach, phaseHazardHit,
} from './dangerMap.js';
import { axeCanReach, axeHitsPlayer } from './hazards.js';
import { planDash } from './mover.js';
import { createTraceBuilder } from './decisionTrace.js';
import { arrivalInsideSolid, arrivalsInto, solidsAt, STUCK_TICKS } from './arrivalSolid.js';
import {
    STRIKE_PRESS, armIsModelled, createStrikePolicy,
} from './strikePolicy.js';
import { HOLD_FIRST_KEY_SETS, coarseKey, spaceTimeReach } from './spaceTimeReach.js';

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
        pending = null, dangerQueries = [], bound = null,
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
        /**
         * ⛓⛓ SEEDLING FIDELITY ROBUST, D1 — **A SEARCH THAT WAS CUT SAYS SO IN
         * A FIELD.** `{name, site, limit, …counts}` when this refusal is a BOUND
         * ending a search (the block-route search's `MAX_ROUTE_EXPANSIONS` /
         * `MAX_ROUTE_ORDERS`, or the caller's `deadline` reaching it there),
         * else `null`. "I could not decide" and "there is none" are different
         * claims, and a caller (`seedlingCanCross.classifyError`) used to tell
         * them apart by matching this message's words. The words are unchanged;
         * the field is what a caller reads.
         */
        this.bound = bound;
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
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY BURN — **A BURNABLE TREE IN THE CORRIDOR IS A
     * CLEARABLE OBSTACLE**, and the rules arc's route survey is why the row
     * exists: six of its refusals (steps 30, 62, 72, 93, 101, 102 — L44, L24,
     * L37) read *"Obstacle: solid:burnabletree … No strategy row exists for this
     * obstacle"*, the largest named-obstacle family past sphere 2.2.
     *
     * The model has burned trees since R5 slice 12 (`levelRun.applyFire`'s
     * `BurnableTree` arm, `burnedTrees`, the persistence write at `goneAt`) and
     * `botDriverV2.runFire`'s `burns` arm drives it; the only solver caller was
     * the Bob Boss encounter's burn leg. `burn` is that leg as an obstacle verb
     * (`resolveBurnStrategy` / `execBurn`), gated on the Fire the game requires.
     */
    'solid:burnabletree': 'burn',
    /**
     * ⛓⛓ SEEDLING FIDELITY FRONTIER3 — `GrassLock extends Lock` with a bare
     * `super(...)` (`GrassLock.as:13-16`): the same fade responder, group and
     * kill arm as `lock`, and `activators.RESPONDERS` has carried its row since
     * R2. L28's `grasslock@176,208 {t 0}` and its `button@112,240` are the
     * only placement; a table that knew `lock` and not this refused the room
     * with *"No strategy row exists"*.
     */
    'solid:grasslock': 'hold',
    /**
     * ⛓⛓ SEEDLING FIDELITY FRONTIER3 — **SELECTED, NOT REGISTERED, BY
     * MEASUREMENT.** A crusher is passed by BAITING it (`crusher.CRUSHER_VERBS`
     * — present in a lane, let it commit, sidestep, let it park), and the verb
     * exists as R5's hand-searched choreographies (`r5Totem`), never as a
     * solver executor. L42 is the room that asks: `r5Totem.L42_PART4` is a
     * six-bait PURSUIT (each park re-arms a lane across the escape) of which
     * only crusher A's three-charge chain was ever driven. So the row names the
     * verb and the refusal is the computed work order, not *"no row"*.
     */
    'solid:crusher': 'bait',
    /**
     * ⛓⛓ SEEDLING FIDELITY FRONTIER3 — `Cover` is an `Activators` responder
     * (`levelWorld.ACTIVATOR_RESPONDERS`): Solid until its group is held, then
     * clear ten ticks into the fade, and Solid again the tick the group drops.
     * Its opener is its group's presser, which is `hold`'s question (and
     * `weigh`'s, when the presser republishes).
     */
    'solid:cover': 'hold',
    // A button guarding the frontier is L4's own shape: the room's answer
    // starts with HOLDING it (the hand-authored leg's `hold` mechanic).
    'proximity-hazard:button': 'hold',
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — **A `ButtonRoom` ON THE FRONTIER IS
     * PRESSED, NOT AVOIDED.** Its census volume is the 8x6 press rect
     * (`ButtonRoom.as:32`), and the census priced it a hazard because a press
     * writes state (`:67-98`). But the write is the PUZZLE: `room == -1` latches
     * every `Activators` sharing `t` (*"Can't be reset to false!!"*), and the
     * game punishes nothing — no damage, no freeze, no move. L38's corridor runs
     * over `buttonroom@144,128`, whose press opens `cover@208,224`, the first link
     * of the room's chain. So the verb is `hold`, whose "the obstacle IS the
     * presser" arm (`openerPresserFor`) already derives the stance, the exemption
     * and the latched wait; the run models the press (`activators.pressedGroups`,
     * the cross-room write, F6's `bootPress`).
     */
    'proximity-hazard:buttonroom': 'hold',
    'proximity-hazard:chest': 'chest',
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY WATCHER — **A SPEAKING WATCHER'S CIRCLE IS PASSED BY
     * TALKING.** With its tag set the dialogue opens on proximity, freezes the
     * walk, and ends only when it has been paged; `doneTalking()` clears the tag
     * and the watcher never speaks again (`resolveTalkStrategy` / `execTalk`). A
     * SILENT watcher (no text, or its tag cleared when the room was built) is no
     * volume at all (`levelWorld`'s `speaksFrom`), so it never reaches this row.
     */
    'proximity-hazard:watcher': 'talk',
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — **AN ICE TURRET'S RANGE IS CROSSED, NOT
     * WALLED.** The volume is `attackRange` (a 129 px disc), and what the game
     * charges inside it is a volley — `freeze(15)` and one damage per blast —
     * which stops no walk and which the run steps (`resolveBraveStrategy`).
     */
    'proximity-hazard:iceturret': 'brave',
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
        to: 'skirt',
        when: 'the presser is a `button` whose group has NO opener — every responder '
            + '`groupResponders` names is a `FALL_RESPONDERS` rock and there is at least one — '
            + 'so a press only drops a Solid into the corridor (L29, L74): avoid, do not press',
    }),
    Object.freeze({
        from: 'hold',
        to: 'pulse',
        when: 'the responder\'s every opener is a momentary `button` and a room `Pulser` '
            + 'whose group a latching `ButtonRoom` publishes will push a `pushableblockfire` '
            + 'onto one of them (`pulseWeighFor`) — L38\'s chain: press the pulser\'s '
            + 'ButtonRoom, and the pulse parks the block on the button',
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
     * (⛓ F4: except a static class whose arrow death the run computes,
     * `STATIC_ARROW_DEATH` — its removal is the run's own, like a chaser's.)
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
    /**
     * ⛓⛓ SEEDLING SWIM U1, D2 — the first executor whose whole job is to NOT
     * trigger the obstacle it was selected for. See `resolveSkirtStrategy`.
     */
    skirt: execSkirt,
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY BURN — `break`'s shape with the fire weapon: a
     * stance from which `Player.fire()`'s 32x32 rect and 16 px radius reach the
     * tree, an equip of the Fire's slot, `runFire`'s `burns` arm (still solid at
     * T+10, gone by T+53), and the sword's slot selected again. See
     * `resolveBurnStrategy`.
     */
    burn: execBurn,
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY WATCHER — the first executor whose whole effect is
     * a DIALOGUE: approach until the circle opens it, page it on the ceremony
     * cadence, and the cleared tag silences the watcher. See
     * `resolveTalkStrategy`.
     */
    talk: execTalk,
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — the first executor whose presser is a
     * MACHINE's: press the `Pulser`'s latching ButtonRoom (`hold`'s own stance and
     * runner), then wait while the pulse parks a fire block on the momentary
     * button the responder answers to. See `resolvePulseStrategy`.
     */
    pulse: execPulse,
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — the first verb whose cost is PAID
     * rather than avoided: an ice turret's range exempted, and the run's own
     * volleys, freezes and hits on the walk through it. See
     * `resolveBraveStrategy`.
     */
    brave: execBrave,
});

/**
 * ⛓⛓ SEEDLING SWIM U5 — THE BOBBOSS ENCOUNTER EXECUTOR.
 *
 * Derived from the model, not hand-authored: `levelRun` simulates the fight
 * (`bobBossFight.js`), and every decision here reads the run or a forecast the
 * run hands out (`run.bobBossForecast()`, the same stepper and the same slash
 * test the run uses). The legs:
 *
 *   (a) ARM — hold `up` until the run's rock reads `armed` (the line is
 *       y < 120). The arm tick and its 174 dead frames happen inside
 *       `advance`; nothing here counts them.
 *   (b) PER FORM —
 *       · a DIALOGUE is paged with `ceremonyCadenceStep`. A press while the
 *         dialogue holds the run is a PAGE, never a swing, and a page is never
 *         counted as a landing.
 *       · a STRIKE is searched against the forecast: hold one of nine key sets
 *         for n ticks, press, then hold one of nine for the safety tail. A plan
 *         is admitted only if the player is touched by NO sword line and NO
 *         body contact through the tail, and the forecast lands a hit. The
 *         press must be an ordinary `slash` (never a dash), which is the run's
 *         own `slashSet` answer. After the press the landing is VERIFIED on the
 *         boss's own `hits` (`run.entities('bobBoss')`): read, never counted.
 *       · with no admissible strike, a short REPOSITION is chosen the same way
 *         (the key set whose forecast stays untouched longest).
 *       · a TRANSITION (`inputRefused`) is waited out, holding nothing.
 *   (c) DROP — walk onto the Fire and page its ceremony. Done when the
 *       inventory holds `hasFire` AND the run's `bobBossEvents` ledger holds
 *       both writes: the rock's `rock-armed` {32,1} and `fire-removed`.
 *   (d) BURN — equip the Fire's slot, stand where `fireRect` reaches the
 *       burnable tree, and run `botDriverV2.runFire`'s `burns` arm (its own
 *       53-tick wait and its solid-then-gone check). `then: 'reach-pit'` is the
 *       goal loop's, after this returns.
 */
const ENCOUNTER_KEYSETS = Object.freeze([
    [], ['up'], ['down'], ['left'], ['right'],
    ['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right'],
].map((k) => Object.freeze(k)));
/** The longest approach a strike plan may hold before its press. */
const ENCOUNTER_APPROACH_MAX = 72;
/** How long after its press a strike plan must leave the player untouched. */
const ENCOUNTER_SAFE_TAIL = 48;
/** A reposition's committed length, and the horizon its safety is priced over. */
const ENCOUNTER_REPOSITION_TICKS = 6;
const ENCOUNTER_REPOSITION_HORIZON = 48;
/** The whole encounter's tick bound, arm to burn. */
const ENCOUNTER_MAX_TICKS = 8000;

/** The live boss's landed-hit count across forms: the `bobBossEvents` ledger's landings. */
const bobLandings = (run) => run.ledger('bobBossEvents')
    .filter((r) => r.what === 'boss-hit' && r.landed).length;
const bobArena = (run) => run.entities('bobBoss');

/**
 * Forecast one plan from the run's current state, tick by tick, in
 * `advance`'s own order: the boss steps against the player's point, the
 * sword window's due tests fire against the boss, the press (if this is its
 * tick) is resolved by `slashSet`, then the player steps.
 *
 * @returns {{touchedAt: ?number, landedAt: ?number, killed: boolean,
 *   pressOutcome: ?string, end: object}}
 */
function forecastEncounterPlan(run, fc, stepper, { approach, n, retreat, tail, press }) {
    const b = fc.clone(fc.body);
    let p = { ...run.state };
    const info = run.progress('slashInfo');
    let slash = { ...info.state };
    // `slashEndsAt`, relative to this tick: `slashing` drops at the END of the
    // tick whose count reaches it (`sprites()` -> `slashEnd`).
    let endsAt = info.endsAt === null ? null : info.endsAt - run.ticksCompleted;
    const tests = new Map();
    let landedAt = null;
    let killed = false;
    let pressOutcome = null;
    const total = press ? n + 1 + tail : n + tail;
    for (let k = 0; k < total; k += 1) {
        const r = fc.step(b, p);
        if (r.playerHits.length > 0) return { touchedAt: k, landedAt, killed, pressOutcome, end: p };
        if (b.removed) return { touchedAt: null, landedAt, killed, pressOutcome, end: p };
        // `Player.update`: `shieldBump()`, then `slash()`'s timer and test.
        fc.shieldBump(b, p, slash.slashing);
        slash = slashTimerTick(slash);
        const due = tests.get(k);
        if (due !== undefined && landedAt === null) {
            const v = fc.slash(b, p, due);
            if (v.landed) { landedAt = k; killed = v.killed; }
        }
        const keys = k < n ? approach : (press && k === n ? [...approach, 'primary'] : retreat);
        if (press && k === n) {
            const out = slashSet(slash, { pressed: true, hasSword: true, direction: p.direction });
            pressOutcome = out.outcome;
            if (out.outcome !== 'slash') return { touchedAt: null, landedAt: null, killed, pressOutcome, end: p };
            slash = out.state;
            endsAt = k + SLASH_ANIM_TICKS[slash.anim];
            for (let i = 1; i <= SLASH_HIT_TICKS; i += 1) tests.set(k + i, out.slashDirection);
        }
        p = stepper(p, new Set(keys));
        if (endsAt !== null && k + 1 >= endsAt) {
            endsAt = null;
            slash = slashSet(slash, { pressed: false, hasSword: true }).state;
        }
    }
    return { touchedAt: null, landedAt, killed, pressOutcome, end: p };
}

/** The earliest-landing admissible strike plan, or null. */
function searchEncounterStrike(run) {
    const fc = run.bobBossForecast();
    if (!fc) return null;
    const stepper = run.previewStepper();
    let best = null;
    let tried = 0;
    for (const approach of ENCOUNTER_KEYSETS) {
        for (let n = 0; n <= ENCOUNTER_APPROACH_MAX; n += 1) {
            // A prefix that is touched before its press tick touches every
            // plan built on it: stop extending this approach.
            const pre = forecastEncounterPlan(run, fc, stepper,
                { approach, n, retreat: [], tail: 0, press: false });
            if (pre.touchedAt !== null) break;
            if (best && n >= best.landedAt) break;
            for (const retreat of ENCOUNTER_KEYSETS) {
                tried += 1;
                const f = forecastEncounterPlan(run, fc, stepper,
                    { approach, n, retreat, tail: ENCOUNTER_SAFE_TAIL, press: true });
                if (f.touchedAt !== null || f.landedAt === null) continue;
                if (!best || f.landedAt < best.landedAt) {
                    best = { approach, n, retreat, landedAt: f.landedAt, killed: f.killed };
                }
            }
        }
    }
    return best ? { ...best, tried } : { tried, none: true };
}

/** The key set whose forecast stays untouched longest, held for a short reposition. */
function searchEncounterReposition(run) {
    const fc = run.bobBossForecast();
    const stepper = run.previewStepper();
    const scored = ENCOUNTER_KEYSETS.map((keys) => {
        if (!fc) return { keys, safeFor: Infinity };
        const f = forecastEncounterPlan(run, fc, stepper, {
            approach: keys, n: ENCOUNTER_REPOSITION_TICKS, retreat: [],
            tail: ENCOUNTER_REPOSITION_HORIZON - ENCOUNTER_REPOSITION_TICKS, press: false,
        });
        return { keys, safeFor: f.touchedAt ?? Infinity };
    });
    scored.sort((x, y) => y.safeFor - x.safeFor);
    return scored[0];
}

function execBobBossEncounter(run, perTick, goal, { what, walkTo, seeRow, saw, refuse, equip }) {
    const records = [];
    const start = perTick.length;
    const tick = (keys) => {
        if (perTick.length - start > ENCOUNTER_MAX_TICKS) {
            refuse(`${what}: the encounter has run ${ENCOUNTER_MAX_TICKS} ticks without the `
                + 'drop.', { goal, obstacle: { kind: 'encounter', id: `encounter@${goal.at.x},${goal.at.y}` } });
        }
        const held = new Set(keys);
        perTick.push(held);
        const r = run.advance(held);
        if (r.transition) {
            refuse(`${what}: the run left level ${r.transition.from_level} mid-encounter.`, { goal });
        }
        return r;
    };
    const row = (verb, extra = {}) => seeRow({
        tick: perTick.length, saw: saw(), goal: { kind: 'encounter', at: { ...goal.at } },
        strategy: { verb }, rejected: [], keys: [], ...extra,
    });
    const hitsTaken = () => run.ledger('playerHits').length;
    const hits0 = hitsTaken();

    // ── (a) the arm ───────────────────────────────────────────────────
    const arena0 = bobArena(run);
    if (!arena0.has('rock')) {
        refuse(`${what}: level ${run.level} holds no BobBoss arena (no \`thirdboss\` rock).`, { goal });
    }
    if (!arena0.get('rock').armed) {
        row('touch');
        const armFrom = perTick.length;
        while (!bobArena(run).get('rock').armed) {
            if (perTick.length - armFrom > 240) {
                refuse(`${what}: held \`up\` for 240 ticks and the rock never armed (y=${run.state.y}).`, { goal });
            }
            tick(['up']);
        }
        records.push({ goal: 'encounter', leg: 'arm', t: perTick.length });
    }

    // ── (b) the forms ─────────────────────────────────────────────────
    let pages = 0;
    let landings = 0;
    let cadence = CEREMONY_CADENCE_START;
    let inDialogue = false;
    while (!bobArena(run).has('fire') && !bobArena(run).has('fireCollected')) {
        const arena = bobArena(run);
        const dlg = arena.get('dialogue');
        if (dlg?.open) {
            if (!inDialogue) { row('wait'); inDialogue = true; cadence = CEREMONY_CADENCE_START; }
            const step = ceremonyCadenceStep(cadence);
            cadence = step.next;
            const before = run.ledger('bobBossEvents').length;
            tick([...step.held]);
            pages += run.ledger('bobBossEvents').slice(before)
                .filter((r) => r.what === 'dialogue-release' && r.paged).length;
            continue;
        }
        if (inDialogue && cadence.pressing) {
            // The release that closed the page went out; never carry a press down
            // into a live frame (it would swing).
            refuse(`${what}: a dialogue closed with a press still down.`, { goal });
        }
        inDialogue = false;
        const boss = arena.get('boss');
        if (run.progress('inputRefused') || !boss || boss.destroy || dlg) {
            tick([]);
            continue;
        }
        const plan = searchEncounterStrike(run);
        if (plan.none) {
            const rp = searchEncounterReposition(run);
            if (rp.safeFor <= ENCOUNTER_REPOSITION_TICKS) {
                refuse(`${what}: form ${boss.form} at (${boss.x.toFixed(2)},${boss.y.toFixed(2)}) — no `
                    + `strike lands untouched (${plan.tried} plans forecast) and every key set is `
                    + `touched within ${rp.safeFor} tick(s).`, {
                    goal, obstacle: { kind: 'encounter', id: boss.id } });
            }
            row('wait', { rejected: [{ option: 'kill', why: `no admissible strike among ${plan.tried}` }] });
            for (let i = 0; i < ENCOUNTER_REPOSITION_TICKS; i += 1) tick(rp.keys);
            continue;
        }
        row('kill', { obstacle: { kind: 'bobboss', id: boss.id } });
        const before = bobLandings(run);
        const formBefore = boss.form;
        for (let k = 0; k <= plan.landedAt; k += 1) {
            const keys = k < plan.n ? plan.approach
                : (k === plan.n ? [...plan.approach, 'primary'] : plan.retreat);
            tick(keys);
        }
        const after = bobLandings(run);
        if (after !== before + 1) {
            refuse(`${what}: the forecast landed form ${formBefore}'s hit at +${plan.landedAt} and `
                + `the run's boss reports ${after - before} landing(s) — the forecast and the run `
                + 'disagree.', { goal });
        }
        landings += 1;
        records.push({ goal: 'encounter', leg: 'strike', form: formBefore, landings, pages,
            killed: plan.killed, t: perTick.length });
        if (hitsTaken() !== hits0) {
            refuse(`${what}: the player was hit during an admitted strike plan — the forecast `
                + 'and the run disagree.', { goal });
        }
    }

    // ── (c) the drop ──────────────────────────────────────────────────
    const fire = bobArena(run).get('fire');
    if (fire) {
        row('collect');
        const aim = { x: fire.x, y: fire.y };
        const from = perTick.length;
        while (!run.progress('inCeremony') && !run.progress('inventory')?.hasFire) {
            if (perTick.length - from > 400) refuse(`${what}: never touched the Fire at (${aim.x},${aim.y}).`, { goal });
            tick([...chooseHeld(run.state, aim, 0)]);
        }
        let c = CEREMONY_CADENCE_START;
        while (!run.progress('inventory')?.hasFire) {
            if (perTick.length - from > 1200) refuse(`${what}: the Fire's ceremony never ended.`, { goal });
            const step = ceremonyCadenceStep(c);
            c = step.next;
            tick([...step.held]);
        }
        if (c.pressing) refuse(`${what}: the Fire's ceremony ended with a press still down.`, { goal });
    }
    const writes = run.ledger('bobBossEvents').filter((r) => r.flag).map((r) => r.what);
    if (!run.progress('inventory')?.hasFire || !writes.includes('rock-armed')
        || !writes.includes('fire-removed')) {
        refuse(`${what}: the drop is not complete — hasFire ${run.progress('inventory')?.hasFire}, `
            + `writes [${writes.join(', ')}].`, { goal });
    }
    records.push({ goal: 'encounter', leg: 'drop', landings, pages, t: perTick.length });

    // ── (d) the burn ──────────────────────────────────────────────────
    if (goal.then === 'reach-pit') {
        const trees = run.world.burnableTrees ?? [];
        const burned = run.entities('burnedTrees');
        const standing = trees.filter((t) => !burned.has(t.id)
            && (run.world.pitTiles ?? []).some((pt) => rectsOverlapInclusive(t.rect, pt.rect)));
        if (standing.length > 0) {
            const slots = run.progress('inventorySlots');
            const slot = slots.indexOf(INVENTORY_ITEM_IDS.fire);
            if (slot < 0) refuse(`${what}: the inventory has no Fire slot (slots [${slots}]).`, { goal });
            if (run.progress('primaryWeapon') !== 'fire') {
                // ⛔ ONE TICK AFTER THE FLAG. `Fire.removed()` sets `hasFire` at
                // the end of the collect frame, but the slot array is rebuilt
                // by `inventory.update()` (`addItemsFromSave`) in the NEXT
                // frame's `Game.update` tail, after `Bot.update` has applied
                // that frame's equips. Measured: an equip on the flag's own
                // tick finds one slot in the game and the tape disarms there.
                tick([]);
                equip(slot);
            }
            for (const tree of standing) {
                const stance = burnStanceFor(run, tree);
                if (!stance) refuse(`${what}: no walkable stance puts ${tree.id} inside \`fireRect\`.`, { goal });
                walkTo(goal, stance, { what: `${what} -> burn stance (${tree.id})` });
                for (let i = 0; (run.state.vx !== 0 || run.state.vy !== 0); i += 1) {
                    if (i > 60) refuse(`${what}: the burn stance never came to rest.`, { goal });
                    tick([]);
                }
                row('fire', { obstacle: { kind: 'burnabletree', id: tree.id } });
                // Every tree in `standing` covers a pit tile (the filter above),
                // so its burn opens a pit, declared to `runFire` as `overPit`.
                const rec = runFire(run, perTick, { burns: [{ x: tree.x, y: tree.y }], overPit: true },
                    `${what} -> fire (${tree.id})`);
                records.push({ goal: 'encounter', leg: 'burn', id: tree.id, t: perTick.length,
                    pressTick: rec.pressTick ?? null });
            }
        }
    }
    return { records, landings, pages };
}

/** `Entity.collideRect`'s inclusive overlap, for a burn's fire rect and a tree. */
function rectsOverlapInclusive(a, b) {
    return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY BURN — THE BURN STANCE'S CANDIDATES, HOISTED out of
 * the encounter's `burnStanceFor` so the `burn` obstacle verb and the Bob Boss
 * burn leg are ONE derivation: every walkable tile centre whose `fireRect`
 * overlaps `tree`, nearest to the player first.
 *
 * ⛔ THE ORDER IS THE OLD LOOP'S EXACTLY. `burnStanceFor` kept the first
 * STRICTLY nearer cell in its (ty, tx) scan; a stable sort by distance over the
 * same scan puts that cell first, ties in scan order, so the encounter's stance
 * (and `r9-solve-32`'s trace) cannot move.
 *
 * `tiles` bounds the scan. The encounter keeps its own 12x12 room
 * (`BOB_ARENA_TILES`); an obstacle verb passes the window around the tree
 * (`burnWindowTiles`), because L37 is wider and taller than twelve tiles and
 * its tree stands at y 192 — the old scan's last row.
 */
const BOB_ARENA_TILES = Object.freeze({ tx0: 0, tx1: 11, ty0: 0, ty1: 11 });

function burnStanceCandidates(run, tree, tiles = BOB_ARENA_TILES) {
    const out = [];
    for (let ty = tiles.ty0; ty <= tiles.ty1; ty += 1) {
        for (let tx = tiles.tx0; tx <= tiles.tx1; tx += 1) {
            const cx = tx * TILE_SIZE + TILE_SIZE / 2;
            const cy = ty * TILE_SIZE + TILE_SIZE / 2;
            const fr = fireRect(cx, cy);
            if (!rectsOverlapInclusive({ x: fr.x, y: fr.y, w: fr.w, h: fr.h }, tree.rect)) continue;
            if (plannerObstacleAt(run.world, cx, cy, null, solverPlanOpts(run, new Set(), {})) !== null) continue;
            out.push({ x: cx, y: cy, d: Math.hypot(cx - run.state.x, cy - run.state.y) });
        }
    }
    return out.sort((a, b) => a.d - b.d);
}

/** The nearest walkable tile centre whose `fireRect` reaches `tree`. */
function burnStanceFor(run, tree) {
    const [best] = burnStanceCandidates(run, tree);
    return best ? { x: best.x, y: best.y } : null;
}

/**
 * The tile window from which a 32x32 `fireRect` centred on a tile centre can
 * overlap `tree.rect`: the tree's own tiles plus the two the rect's 16 px
 * half-width reaches on every side, clamped at 0.
 */
function burnWindowTiles(tree) {
    const span = (lo, hi) => [Math.max(0, Math.floor(lo / TILE_SIZE) - 2),
        Math.floor((hi - 1) / TILE_SIZE) + 2];
    const [tx0, tx1] = span(tree.rect.x, tree.rect.right);
    const [ty0, ty1] = span(tree.rect.y, tree.rect.bottom);
    return { tx0, tx1, ty0, ty1 };
}

/**
 * What a fire press from `at` sets alight, asked of the TRANSCRIPTION
 * (`presses.auditFire` — the rect, the 16 px radius cut with its transcribed
 * `originY`, and `FIRE_ARM_POLICY`) rather than of the rect alone.
 * `burnStanceFor`'s overlap test admits a corner cell the radius cut refuses,
 * and the encounter learns that from `runFire`'s effect check; an obstacle
 * verb asks first.
 *
 * @returns `{ trees: [id…], others: [id…] }` — the BurnableTrees the press
 *   reaches, and every OTHER responder whose fire arm would act (a
 *   `PushableBlockFire`, a rope, a turret) or refuse. A stance with `others`
 *   is not a burn stance: `runFire`'s `burns` arm certifies no push, and a
 *   refused arm throws in `applyFire`.
 */
function fireReachFrom(run, at) {
    const audit = auditFire(run.world, at, { pushables: run.entities('pushables') });
    const trees = [];
    const others = [];
    for (const r of audit.modelled) {
        if (r.as3 === 'BurnableTree') trees.push(r.treeId ?? r.id);
        else others.push(r.id);
    }
    for (const r of audit.refused) others.push(r.id);
    return { trees, others };
}

/**
 * ⛓⛓ SEEDLING FIDELITY BURN — **THE LEAN.** A tile centre beside a tree is
 * often OUT of the fire's reach, and the reason is a transcribed quirk, not
 * the rect: `Player.as:1028` measures the 16 px radius against the tree's box
 * built with the PLAYER's `originY` (`fireRadiusDistance`), so a 32x32
 * `centerOO` tree reads 14 px LOWER than it stands. From above, the cell
 * centre is 19 px from that box (L24's `burnabletree@32,128`, measured); the
 * player has to stand against the tree's top edge.
 *
 * So a candidate whose centre misses is offered once more: hold the one key
 * toward the tree (only where the cell is beside it on one axis) until the
 * box stops against the solid, release until at rest, and ask the audit again
 * from THERE. Previewed with the run's own stepper (`run.previewStepper`), and
 * re-asked live by the executor before it presses.
 */
const BURN_LEAN_MAX = 40;
const BURN_SETTLE_MAX = 60;

function burnLeanKey(c, tree) {
    const inX = c.x >= tree.rect.x && c.x <= tree.rect.right;
    const inY = c.y >= tree.rect.y && c.y <= tree.rect.bottom;
    if (inX && c.y < tree.rect.y) return 'down';
    if (inX && c.y > tree.rect.bottom) return 'up';
    if (inY && c.x < tree.rect.x) return 'right';
    if (inY && c.x > tree.rect.right) return 'left';
    return null;
}

/** Hold `key` until the box stops, then nothing until at rest — on a preview. */
function previewLean(run, from, key) {
    const step = run.previewStepper();
    let p = { ...run.state, x: from.x, y: from.y, vx: 0, vy: 0 };
    const held = new Set([key]);
    const NONE = new Set();
    for (let i = 0; i < BURN_LEAN_MAX; i += 1) {
        const q = step(p, held);
        const stopped = q.x === p.x && q.y === p.y;
        p = q;
        if (stopped) break;
    }
    for (let i = 0; i < BURN_SETTLE_MAX && (p.vx !== 0 || p.vy !== 0); i += 1) p = step(p, NONE);
    return (p.vx === 0 && p.vy === 0) ? { x: p.x, y: p.y } : null;
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY BURN — RESOLVE the `burn` work order: a
 * `burnabletree` on the frontier of a corridor.
 *
 * ⛔ **THE GATE IS THE GAME'S, AND IT IS ASKED BEFORE A STANCE.** Only fire
 * burns a tree: `BurnableTree.hit(t)` is `if (t == "Fire" && !burn)`, and
 * `t = "Fire"` comes from `Player.fire()` alone (`genericHit(e, "Fire", …)`,
 * `Player.as:1032`), which runs while `firing` — set by `useItem` cases 1
 * (Fire) and 5 (the Fire Wand fusion). A sword, spear or wand swing reaches the
 * tree and does nothing. So:
 *   · no Fire and no Fire Wand → refused by name: the tree NEEDS FIRE;
 *   · the Fire Wand → refused by name: `levelRun.weaponForPress` refuses
 *     `useItem` case 5 (one press, two windows), so the model cannot fire it.
 *
 * ⛔ **THE STANCE IS ASKED OF THE AUDIT** (`fireReachFrom`): the tree is in
 * what the press would set alight and nothing else responds. Reachability is
 * `stanceReaches`, the derivation every stance verb uses (with the same lazy
 * hypothesis), so a tree whose only stance is behind another obstacle is
 * resolved through that obstacle like any other stance.
 */
function resolveBurnStrategy(run, obstacle, contacts, blocked = []) {
    const tree = (run.world.burnableTrees ?? []).find((t) => t.id === obstacle.id);
    if (!tree) return null;
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY SLOTS (D4a) — A TREE ALREADY ALIGHT IS WAITED OUT.
     *
     * `hit()` sets `burn` and `burnEnd -> die()` removes the tree
     * `HIT_TO_GONE_TICKS` later, so between the two the tree is still a SOLID
     * on the frontier and `hit()` is behind `!burn` (a second press does
     * nothing). A walk cut there — a continuation frozen mid-burn, measured at
     * K=80 of BURN's L24 plan (hit t64, gone t105) — used to resolve to nothing
     * and refuse "Strategy 'burn' failed to apply". The verb's own last phase is
     * the answer: wait until the model's `burnedTrees` holds it (its `goneAt`),
     * then walk on. No Fire is needed to wait, so this is asked first.
     */
    if (!(run.entities('burnedTrees') ?? new Set()).has(tree.id)) {
        const alight = run.ledger('treeBurns').find((b) => b.id === tree.id);
        if (alight) {
            return {
                strategy: 'burn',
                postCondition: 'gone',
                tree: tree.id,
                wait: true,
                goneAt: alight.goneAt,
                burns: [],
                burnsIds: [],
                stance: null,
                lean: null,
                discharged: [],
                rejected: [{
                    option: `press Fire at ${tree.id}`,
                    why: `it is ALIGHT already (hit at t${alight.t}, \`die()\` at t${alight.goneAt}): \`hit()\` `
                        + 'is behind `!burn`, so a press does nothing. The tree is gone at `goneAt`; '
                        + 'the verb waits for it.',
                }],
            };
        }
    }
    const inv = run.progress('inventory') ?? {};
    const refusal = (why) => ({
        strategy: 'burn', held: false, tree: obstacle.id,
        rejected: [{ option: `burn ${obstacle.id}`, why }],
    });
    if (inv.hasFireWand) {
        return refusal('the run holds the FIRE WAND fusion, whose slot is `useItem` case 5 '
            + '(`wanding` AND `firing` on one press). `levelRun.weaponForPress` refuses that case '
            + 'by name — two windows on one press are not modelled — so the burn this tree needs '
            + 'cannot be pressed by this model. ⇒ the work order is the case-5 press, not a stance.');
    }
    if (!inv.hasFire) {
        return refusal('this run does not hold FIRE. `BurnableTree.hit(t)` is '
            + '`if (t == "Fire" && !burn)`, and only `Player.fire()` passes `"Fire"` '
            + '(`useItem` case 1, the Fire\'s slot) — a sword, spear or wand swing reaches the '
            + 'tree and does nothing. ⇒ the tree NEEDS FIRE: an item the route has not '
            + 'collected yet, which no stance or budget can substitute for.');
    }
    if ((run.entities('burnedTrees') ?? new Set()).has(tree.id)) {
        // Gone already: nothing to resolve. (Alight but standing is waited
        // out above.)
        return null;
    }
    // What the burn uncovers — declared to `runFire`, whose gone-check would
    // otherwise read an exit volume under the tree as "something else shares
    // the cell".
    const overPit = (run.world.pitTiles ?? []).some((pt) => rectsOverlapInclusive(tree.rect, pt.rect));
    const overExit = (run.world.teleporters ?? []).some((tp) => rectsOverlapInclusive(tree.rect, tp.rect));
    const candidates = burnStanceCandidates(run, tree, burnWindowTiles(tree));
    const hypothesis = lazyStanceHypothesis(run, blocked, contacts);
    let unreached = 0;
    let missed = 0;
    let crowded = 0;
    for (const c of candidates) {
        let reach = fireReachFrom(run, c);
        let lean = null;
        if (!reach.trees.includes(tree.id)) {
            const key = burnLeanKey(c, tree);
            const leaned = key ? previewLean(run, c, key) : null;
            const again = leaned ? fireReachFrom(run, leaned) : null;
            if (!again || !again.trees.includes(tree.id)) { missed += 1; continue; }
            reach = again;
            lean = { key, at: leaned };
        }
        if (reach.others.length > 0) { crowded += 1; continue; }
        const reached = stanceReaches(run, { x: c.x, y: c.y }, contacts, hypothesis);
        if (!reached) { unreached += 1; continue; }
        // ⛓ The live position may already be the stance (`deriveSwingStance`'s
        // rule): no approach is owed, and `walkTo` is not asked for a
        // zero-length corridor.
        const here = !lean && run.state.x === c.x && run.state.y === c.y;
        return {
            strategy: 'burn',
            postCondition: 'gone',
            tree: tree.id,
            burns: reach.trees.map((id) => {
                const t = run.world.burnableTrees.find((b) => b.id === id);
                return { x: t.x, y: t.y };
            }),
            burnsIds: reach.trees,
            overPit,
            overExit,
            stance: here ? null : { x: c.x, y: c.y },
            at: lean ? { ...lean.at } : { x: c.x, y: c.y },
            lean: lean ? lean.key : null,
            discharged: reached.discharged,
            rejected: [{
                option: 'break / hold / shove / kill',
                why: `${obstacle.id} is a \`BurnableTree\`: a \`Solid\` with no \`tSet\`, no push `
                    + 'and no death. `hit(t)` acts only on `t == "Fire"`, and `burnEnd -> die()` '
                    + '(41 ticks after the press) is what removes it.',
            }, ...hypothesisRejection(reached.discharged)],
        };
    }
    throw new SolverRefusal(`solverBot: no REACHABLE stance for a fire press at ${tree.id} `
        + `in level ${run.level} — ${candidates.length} walkable cell(s) put \`fireRect\` on the `
        + `tree; ${missed} were cut by the 16 px radius (from the cell centre and from a lean `
        + `against the tree), ${crowded} also reached another fire `
        + `responder, and ${unreached} plan no corridor from (${run.state.x},${run.state.y}). `
        + '⇒ the tree is on the frontier and the room offers nowhere to stand and burn it.',
    { obstacle: { kind: 'solid', id: tree.id } });
}

/**
 * Executor: the `burn` verb — SETTLE, SELECT THE FIRE, PRESS, WAIT FOR THE
 * WORLD, SELECT THE OLD SLOT AGAIN.
 *
 * ⛔ **THE SLOT IS RESTORED, AND THAT IS NOT TIDINESS.** Every later walk's
 * strike policy (`strikePolicyFor`) reads the INVENTORY's sword, not the
 * selected slot, and presses `primary` — with the Fire still selected that
 * press is a fire press: a different window, a different rect and a press
 * `levelRun` refuses inside an open window. So the slot the walk arrived with
 * is selected again once the tree is gone. An equip is a `Bot.as` write to
 * `Main.primary` (a tape's `equips` field), never a key, and costs no tick.
 *
 * The press, the still-solid reading at T+10, the gone reading and the stray
 * check are `runFire`'s `burns` arm, unchanged — the Bob Boss leg's verb.
 */
function execBurn(run, perTick, resolved, ctx) {
    const refuse = (why) => {
        throw new SolverRefusal(why, { obstacle: { kind: 'solid', id: resolved.tree } });
    };
    if (resolved.held === false) {
        return refuse(`${ctx.what}: ${resolved.tree} cannot be burned by this run — `
            + `${resolved.rejected[0].why}`);
    }
    if (!ctx.equip) {
        throw new Error(`${ctx.what}: the burn verb needs the segment's \`equip\` (a slot `
            + 'selection the tape carries); this caller handed none.');
    }
    const from = perTick.length;
    const NO_KEYS = new Set();
    if (resolved.wait) {
        // ⛓ SLOTS (D4a): the tree is alight (`resolveBurnStrategy`); idle until it is gone.
        const bound = Math.max(0, (resolved.goneAt ?? run.ticksCompleted) - run.ticksCompleted) + 2;
        for (let i = 0; !(run.entities('burnedTrees') ?? new Set()).has(resolved.tree); i += 1) {
            if (i > bound) {
                refuse(`${ctx.what}: ${resolved.tree} is alight and still standing ${i} tick(s) later, past its `
                    + `\`goneAt\` t${resolved.goneAt}.`);
            }
            perTick.push(NO_KEYS);
            const { transition } = run.advance(NO_KEYS);
            if (transition) {
                refuse(`${ctx.what}: the run crossed to level ${transition.to_level} while waiting out the burn `
                    + `of ${resolved.tree}.`);
            }
        }
        return { verb: 'burn', target: resolved.tree, burned: [], waited: perTick.length - from, from,
            ticks: perTick.length - from, pressTick: null, stance: null, lean: null, restoredSlot: null };
    }
    const settle = (what) => {
        for (let i = 0; run.state.vx !== 0 || run.state.vy !== 0; i += 1) {
            if (i > BURN_SETTLE_MAX) refuse(`${ctx.what}: ${what} never came to rest.`);
            perTick.push(NO_KEYS);
            const { transition } = run.advance(NO_KEYS);
            if (transition) refuse(`${ctx.what}: the run crossed to level ${transition.to_level} `
                + `while settling after ${what}.`);
        }
    };
    settle('the walk to the burn stance');
    if (resolved.lean) {
        // The lean the resolver previewed: hold toward the tree until the box
        // stops against it, then nothing until at rest.
        const held = new Set([resolved.lean]);
        for (let i = 0; i < BURN_LEAN_MAX; i += 1) {
            const before = { x: run.state.x, y: run.state.y };
            perTick.push(held);
            const { transition } = run.advance(held);
            if (transition) refuse(`${ctx.what}: the lean toward ${resolved.tree} crossed to `
                + `level ${transition.to_level}.`);
            if (run.state.x === before.x && run.state.y === before.y) break;
        }
        settle('the lean');
    }
    const reach = fireReachFrom(run, run.state);
    if (!reach.trees.includes(resolved.tree) || reach.others.length > 0) {
        refuse(`${ctx.what}: the walk came to rest at (${run.state.x},${run.state.y}) and a fire `
            + `press from there reaches [${reach.trees.join(', ')}] and `
            + `[${reach.others.join(', ')}] — not ${resolved.tree} alone. The stance this verb `
            + `derived was (${resolved.at.x},${resolved.at.y}); a walk that ends somewhere else `
            + 'is a corridor finding, not a tree one.');
    }
    const prior = run.progress('primary');
    if (run.progress('primaryWeapon') !== 'fire') {
        // ⛓ SLOTS: the run's own array (arrival order), never a re-derivation.
        const slot = run.progress('inventorySlots').indexOf(INVENTORY_ITEM_IDS.fire);
        if (slot < 0) refuse(`${ctx.what}: the inventory has no Fire slot.`);
        ctx.equip(slot);
    }
    const burns = reach.trees.map((id) => {
        const t = run.world.burnableTrees.find((b) => b.id === id);
        return { x: t.x, y: t.y };
    });
    const rec = runFire(run, perTick, { burns, overPit: resolved.overPit, overExit: resolved.overExit },
        `${ctx.what} (${resolved.tree})`);
    if (run.progress('primary') !== prior) ctx.equip(prior);
    return { verb: 'burn', target: resolved.tree, burned: reach.trees, from,
        ticks: perTick.length - from, pressTick: rec?.pressTick ?? null,
        stance: resolved.stance, lean: resolved.lean ?? null, restoredSlot: prior };
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY WATCHER — the `talk` verb's bounds. A stance is a tile
 * centre at least `TALK_STANCE_MARGIN` px OUTSIDE the talk circle (so the walk
 * to it cannot overshoot into it and open the dialogue mid-drive) and no more
 * than `TALK_STANCE_REACH` px from the watcher's centre. The approach from it is
 * bounded by `TALK_APPROACH_MAX` ticks, and the paging by `TALK_PAGE_MAX`.
 */
const TALK_STANCE_MARGIN = 4;
const TALK_STANCE_REACH = 48;
const TALK_APPROACH_MAX = 60;
const TALK_PAGE_MAX = 6000;
const TALK_SETTLE_MAX = 60;

/**
 * ⛓⛓⛓ SEEDLING FIDELITY WATCHER — RESOLVE the `talk` work order: a SPEAKING
 * watcher whose talk circle is on the frontier of a corridor.
 *
 * ⛔ **THE GAME'S RULE** (`NPCs/NPC.as:185-248`, `NPCs/Watcher.as:62-137`): a
 * watcher's `keyNeeded` is `!Game.checkPersistence(tag)` (`Watcher.as:46`), so
 * with its tag still set the dialogue opens on PROXIMITY alone
 * (`FP.distance(x, y, p.x, p.y) <= 24`, no key), raises `Game.freezeObjects`
 * from the next frame, and holds the player until every page has been paged
 * with a release of X (`Input.released(p.keys[6])`). `doneTalking()` then
 * writes the tag false, and `Watcher.update` runs `talk()` only while the tag
 * holds, so the watcher never speaks again (the census lists it SILENT once the
 * clear is built). There is no way PAST the circle except through the
 * dialogue: the walk is frozen inside it.
 *
 * ⛔ **THE GATE IS THE SEED, NOT AN ITEM.** No item opens or skips the dialogue;
 * the only thing that can go wrong is the live `Seed` the watcher holds out on
 * pages 9..19 (`Watcher.as:68-74`, `new Seed(x - 18, y - 8, false)`): a frozen
 * box that touches it collects it, which is a soft-lock (`levelRun` throws). So
 * the stance is chosen on the side the predicted opening box keeps clear of it,
 * and `execTalk` re-asks at the real opening position before a page is paged.
 *
 * ⚠ **THE TAG IS A REAL WRITE.** L114's `{114,0}` is what `FinalDoor` reads as
 * `talkedToWatcher` (`Scenery/FinalDoor.as:50`); the verb earns it exactly as
 * the game does, and the refusal-free path is the only one the game offers.
 */
function resolveTalkStrategy(run, obstacle, contacts, blocked = []) {
    const w = (run.watchers ?? []).find((x) => x.id === obstacle.id);
    if (!w) return null;
    const exempt = new Set([...contacts, `proximity-hazard:${obstacle.id}`]);
    const silent = (run.world.silentHazards ?? []).find((h) => h.id === obstacle.id);
    if (silent) {
        // ⛔ A SILENT watcher (no text, or its tag cleared): the game never
        // talks, freezes or writes a tag for it, so the verb walks through at
        // zero cost. ⛓ WATCHERFLIP released WATCHER's held square, so the
        // census builds no volume for a silent placement and no frontier names
        // one: this arm is a guard, unreachable from `buildLevelWorld` today.
        return {
            strategy: 'talk', watcher: w.id, already: 'silent', stance: null, exempt: [...exempt],
            rejected: [{ option: `talk ${w.id}`, why: `${w.id} is SILENT — ${silent.why} — so its `
                + 'body is walked through: no dialogue opens' }],
        };
    }
    if (w.cleared) {
        // Talked to already THIS visit: the circle is silent, nothing to drive.
        return {
            strategy: 'talk', watcher: w.id, already: 'cleared', stance: null, exempt: [...exempt],
            rejected: [{ option: `talk ${w.id}`, why: `its tag {${run.level},${w.persistTag}} `
                + 'is already cleared this visit, so `Watcher.update` runs no `talk()`: the '
                + 'circle is walked through' }],
        };
    }
    const seed = w.seedBox;
    // The box the dialogue would freeze, approaching the centre from (cx, cy):
    // the first point of that line inside the circle.
    const openingBox = (cx, cy) => {
        const d = Math.hypot(cx - w.x, cy - w.y);
        const k = d > 0 ? (d - w.talkRange) / d : 0;
        return playerBoxAt(cx + (w.x - cx) * k, cy + (w.y - cy) * k);
    };
    const seedSafe = (box) => !seed || !rectsOverlap(
        { x: box.x - TALK_STANCE_MARGIN, y: box.y - TALK_STANCE_MARGIN,
            right: box.right + TALK_STANCE_MARGIN, bottom: box.bottom + TALK_STANCE_MARGIN }, seed);
    const here = Math.hypot(run.state.x - w.x, run.state.y - w.y);
    if (here > w.talkRange && here <= TALK_STANCE_REACH
        && seedSafe(openingBox(run.state.x, run.state.y))) {
        return {
            strategy: 'talk', watcher: w.id, stance: null, at: { x: run.state.x, y: run.state.y },
            exempt: [...exempt],
            rejected: [{ option: 'walk around the circle', why: `${w.id} speaks (its tag is `
                + 'set), and its circle cuts the corridor: the only way past is the dialogue' }],
        };
    }
    const tx0 = Math.max(0, Math.floor((w.x - TALK_STANCE_REACH) / TILE_SIZE));
    const ty0 = Math.max(0, Math.floor((w.y - TALK_STANCE_REACH) / TILE_SIZE));
    const tx1 = Math.floor((w.x + TALK_STANCE_REACH) / TILE_SIZE);
    const ty1 = Math.floor((w.y + TALK_STANCE_REACH) / TILE_SIZE);
    const candidates = [];
    for (let ty = ty0; ty <= ty1; ty += 1) {
        for (let tx = tx0; tx <= tx1; tx += 1) {
            const cx = tx * TILE_SIZE + TILE_SIZE / 2;
            const cy = ty * TILE_SIZE + TILE_SIZE / 2;
            const d = Math.hypot(cx - w.x, cy - w.y);
            if (d < w.talkRange + TALK_STANCE_MARGIN || d > TALK_STANCE_REACH) continue;
            if (plannerObstacleAt(run.world, cx, cy, null, solverPlanOpts(run, new Set(), {})) !== null) {
                continue;
            }
            candidates.push({ x: cx, y: cy, d: Math.hypot(cx - run.state.x, cy - run.state.y) });
        }
    }
    candidates.sort((a, b) => a.d - b.d);
    const hypothesis = lazyStanceHypothesis(run, blocked, contacts);
    let seeded = 0;
    let unreached = 0;
    for (const c of candidates) {
        if (!seedSafe(openingBox(c.x, c.y))) { seeded += 1; continue; }
        const reached = stanceReaches(run, { x: c.x, y: c.y }, contacts, hypothesis);
        if (!reached) { unreached += 1; continue; }
        return {
            strategy: 'talk', watcher: w.id, stance: { x: c.x, y: c.y }, at: { x: c.x, y: c.y },
            exempt: [...exempt], discharged: reached.discharged,
            rejected: [{ option: 'walk around the circle', why: `${w.id} speaks (its tag is `
                + 'set), and its circle cuts the corridor: the only way past is the dialogue' },
            ...hypothesisRejection(reached.discharged)],
        };
    }
    throw new SolverRefusal(`solverBot: no stance to open ${w.id}'s dialogue from in level `
        + `${run.level} — ${candidates.length} walkable cell(s) lie ${w.talkRange + TALK_STANCE_MARGIN}`
        + `..${TALK_STANCE_REACH} px from it; ${seeded} would freeze the box against the live Seed `
        + `the watcher holds out on pages ${WATCHER_SEED_PAGES} (a soft-lock), and ${unreached} plan `
        + `no corridor from (${run.state.x},${run.state.y}).`,
    { obstacle: { kind: 'proximity-hazard', id: w.id } });
}

/** `Watcher.as:22-23`: the pages on which the live Seed is held out. */
const WATCHER_SEED_PAGES = '9..19';

/**
 * Executor: the `talk` verb — APPROACH until the dialogue opens, PAGE it with a
 * release of X on the ceremony cadence until the tag clears, SETTLE.
 *
 * ⛔ **EVERY PAGE IS A RELEASE, AND NO PRESS IS CARRIED OUT OF THE FREEZE.** The
 * dialogue holds the run frozen (`Mobile` updates skip, so the player does not
 * swing), the closing release `return`s out of `talk()` with the freeze already
 * lowered, and a press still down on the first live frame would be a swing —
 * so the cadence must end released (`ceremonyCadenceStep`, the Bob Boss
 * dialogues' cadence).
 */
function execTalk(run, perTick, resolved, ctx) {
    const from = perTick.length;
    const refuse = (why) => {
        throw new SolverRefusal(`${ctx.what}: ${why}`,
            { obstacle: { kind: 'proximity-hazard', id: resolved.watcher } });
    };
    const watcher = () => (run.watchers ?? []).find((x) => x.id === resolved.watcher);
    const tick = (held, what) => {
        perTick.push(held);
        const { transition } = run.advance(held);
        if (transition) refuse(`the run crossed to level ${transition.to_level} ${what}.`);
    };
    if (resolved.already === 'silent') {
        return { verb: 'talk', target: resolved.watcher, from, ticks: 0, pages: 0, already: 'silent' };
    }
    if (resolved.already === 'cleared' || watcher()?.cleared) {
        return { verb: 'talk', target: resolved.watcher, from, ticks: 0, pages: 0, already: 'cleared' };
    }
    // ── the approach: toward the centre until the dialogue OPENS ──────────
    const w0 = watcher();
    let opened = false;
    for (let i = 0; i < TALK_APPROACH_MAX && !opened; i += 1) {
        tick(new Set(chooseHeld(run.state, { x: w0.x, y: w0.y }, 0)), `approaching ${resolved.watcher}`);
        opened = watcher().talking;
    }
    if (!opened) {
        refuse(`walked toward ${resolved.watcher} for ${TALK_APPROACH_MAX} tick(s) from `
            + `(${resolved.at.x},${resolved.at.y}) and its dialogue never opened (closest `
            + `${watcher().distance.toFixed(2)} px; the circle is ${w0.talkRange}).`);
    }
    const w1 = watcher();
    const box = playerBoxAt(run.state.x, run.state.y);
    if (w1.seedBox && rectsOverlap(box, w1.seedBox)) {
        refuse(`the dialogue opened with the box at (${run.state.x},${run.state.y}) on the live Seed `
            + `the watcher holds out on pages ${WATCHER_SEED_PAGES} — collecting it is a soft-lock.`);
    }
    const openedAt = perTick.length;
    // ── the pages ───────────────────────────────────────────────────────
    let c = CEREMONY_CADENCE_START;
    while (!watcher().cleared) {
        if (perTick.length - openedAt > TALK_PAGE_MAX) {
            refuse(`${resolved.watcher}'s dialogue was still open after ${TALK_PAGE_MAX} tick(s) `
                + `(page ${watcher().page} of ${watcher().pages}).`);
        }
        const step = ceremonyCadenceStep(c);
        c = step.next;
        tick(new Set(step.held), `paging ${resolved.watcher}`);
    }
    if (c.pressing) refuse(`${resolved.watcher}'s dialogue closed with a press still down.`);
    const pages = watcher().pages ?? null;
    // ── the drift: the freeze kept the velocity, so let it decay ──────────
    const NO_KEYS = new Set();
    for (let i = 0; run.state.vx !== 0 || run.state.vy !== 0; i += 1) {
        if (i > TALK_SETTLE_MAX) refuse(`the walk never came to rest after ${resolved.watcher}'s dialogue.`);
        tick(NO_KEYS, `settling after ${resolved.watcher}'s dialogue`);
    }
    const talk = run.watcherTalks.filter((r) => r.id === resolved.watcher).at(-1);
    return { verb: 'talk', target: resolved.watcher, from, ticks: perTick.length - from,
        openedAt, closedAt: talk?.t ?? null, pages: talk?.pages ?? pages, cause: talk?.cause ?? null,
        flag: talk?.flag ?? null, stance: resolved.stance };
}

/**
 * ⛓⛓ SEEDLING SWIM U5 — THE `encounter` EXECUTORS, keyed by the item the
 * encounter DROPS (the location is the drop, not a placement).
 *
 * D1 shipped this table empty, because the model then simulated none of
 * L32's script. The user licensed the simulation, `bobBossFight.js` now steps
 * it, and `r5-bobboss-*` match their oracle recordings exactly, so the Fire's
 * row is registered: `execBobBossEncounter`. A drop with no row still
 * refuses by name, before a tick.
 */
export const ENCOUNTER_EXECUTORS = Object.freeze({ Fire: execBobBossEncounter });

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
 * ⛓ SEEDLING FIDELITY CLEARTAG — how long `clear-tag` waits, after its verb
 * returned, for the flag to land in the run's `earnedClears`. A POLICY bound:
 * the verbs finish on the world (a rock gone, a lock open) and a `Lock`'s
 * `turnOff()` writes its flag when its fade closes, so the wait covers a fade
 * and says so by name (`reason: 'not-written'`) when it does not.
 */
const CLEAR_TAG_WRITE_TICKS = 120;

/**
 * ⛓ SEEDLING FIDELITY CLEARTAG — has the GAME written `flag` yet (its
 * `setPersistence(tag, false)`)? `row` is the flag's `earnedClears` row and `id`
 * the obstacle the goal names. The game's `persistence_cleared` holds the flag
 * after `T + 1` ticks, T the family's write tick (p4f, held cuts):
 *   · a broken rock writes at `endAnim`, the update that removes it — so the
 *     run's `brokenRocks` holding it (NOT the row's `t`, the hit);
 *   · a burned tree writes at `removed()` (`goneAt`) — so `burnedTrees`
 *     holding it (NOT the row's `t`, the press);
 *   · every other family stamps its row AT the write (a lock snap's `to` is
 *     `turnOff`'s tick, a key open's `t` the fade's end) — so the run past it.
 */
function clearTagLanded(run, row, id) {
    if (!row) return false;
    const by = String(row.by ?? '');
    if (by.startsWith('breakablerock')) return (run.entities('brokenRocks') ?? new Set()).has(id);
    if (by.startsWith('burnabletree')) return (run.entities('burnedTrees') ?? new Set()).has(id);
    return Number.isInteger(row.t) && run.ticksCompleted > row.t;
}

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
     * ⛓⛓ SEEDLING SWIM U1, D2 — THE TRAP PRESSER. Asked FIRST and only of a
     * `button` on the frontier: a group with no opener and a rock in it is a
     * press that can only drop a Solid (`fallTrapPresser`). Every other button
     * — L4's and L5's open arrow traps and doors — keeps `hold`.
     */
    if (obstacle?.kind === 'proximity-hazard' && obstacle.tag === 'button'
        && fallTrapPresser(run, obstacle)) return 'skirt';
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — THE PULSE PRESSER. Asked of a RESPONDER
     * whose openers are all momentary `button`s that a room `Pulser` will park a
     * fire block on (`pulseWeighFor`); every other responder keeps its row.
     */
    if (pulseWeighFor(run, obstacle)) return 'pulse';
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
    if (strategy === 'burn') return resolveBurnStrategy(run, obstacle, contacts, blocked);
    if (strategy === 'talk') return resolveTalkStrategy(run, obstacle, contacts, blocked);
    if (strategy === 'weigh') return resolveWeighStrategy(run, obstacle, contacts, blocked);
    if (strategy === 'skirt') return resolveSkirtStrategy(run, obstacle, contacts);
    if (strategy === 'pulse') return resolvePulseStrategy(run, obstacle, contacts, blocked);
    if (strategy === 'brave') return resolveBraveStrategy(run, obstacle, contacts);
    if (strategy !== 'hold') return null;
    return resolveHoldStrategy(run, obstacle, contacts, blocked);
}

/**
 * ⛓⛓ SEEDLING SWIM U1, D2 — **A BUTTON WHOSE PRESS IS A TRAP.**
 *
 * `{presser, rocks}` when `obstacle` is a `button` in `world.pressers` whose
 * group's responders (`groupResponders`, all four lanes) are ALL fall-responder
 * rocks and there is at least one; `null` otherwise. Pressing such a button
 * opens nothing and arms nothing — it drops `FallRock`s (Solid after) into the
 * room (T3's D1 arm). In L29 the rock lands in the one-tile shaft between the
 * button and the Boss Key, so a `hold` there would not just fail, it would
 * seal the errand. The census that makes this the narrowest predicate:
 * `FALL_RESPONDER_ROOMS` is L29 and L74, and no other button's group is
 * rocks-only.
 */
export function fallTrapPresser(run, obstacle) {
    const presser = (run.world.pressers ?? []).find((p) => p.tag === 'button'
        && `${p.tag}@${p.x},${p.y}` === obstacle.id);
    if (!presser) return null;
    const responders = groupResponders(run.world, presser.t);
    if (responders.length === 0 || responders.some((r) => r.lane !== 'fallrock')) return null;
    return { presser, rocks: responders.map((r) => r.id) };
}

/**
 * ⛓⛓ SEEDLING SWIM U1, D2 — RESOLVE a `skirt`: walk PAST a stand-on presser
 * without pressing it, in a sub-tile LANE the planner's whole tiles cannot see.
 *
 * The planner works in whole tiles and the button tile's centre box overlaps
 * the 8x6 press rect, so the tile is blocked; but the press is a BOX test
 * (`fallRocksArmedBy`, the run's own), and a box whose x-extent stops at the
 * rect's edge never presses whatever its y. So:
 *
 *   - the LANE x is the rect's edge plus the hitbox's own offsets — west
 *     `rect.x - (w - originX)`, east `rect.right + originX` (L29: 114 / 126 in
 *     a 112..128 shaft, zero slack either side);
 *   - a lane is taken only where the WALL beside it is continuous from the
 *     stance row through the button row — `plannerObstacleAt` one pixel
 *     outward answers a Solid at every y of the pass — because the executor
 *     holds the lane by LEANING into that wall (a bang-bang walk cannot keep a
 *     0-px tolerance any other way);
 *   - only a VERTICAL shaft is resolved (stone left and right of the button
 *     tile); anything else resolves to `null` and is reported as considered.
 *
 * The stance is the lane x in the tile BEYOND the button on the player's side
 * (the planner reaches it without the button tile), and the pass ends in the
 * tile beyond on the far side, where the planner takes over again. No
 * exemption is added: the button tile stays blocked to every later plan.
 */
function resolveSkirtStrategy(run, obstacle, contacts) {
    const trap = fallTrapPresser(run, obstacle);
    if (!trap) return null;
    const r = trap.presser.rect;
    const w = run.world;
    const opts = solverPlanOpts(run, contacts);
    const geometryAt = (x, y) => {
        const hit = plannerObstacleAt(w, x, y, null, opts);
        return hit && hit.kind !== 'proximity-hazard' ? hit : null;
    };
    const tx = Math.floor(trap.presser.x / TILE_SIZE);
    const ty = Math.floor(trap.presser.y / TILE_SIZE);
    const centreOf = (cx, cy) => ({ x: cx * TILE_SIZE + TILE_SIZE / 2, y: cy * TILE_SIZE + TILE_SIZE / 2 });
    const shaft = geometryAt(centreOf(tx - 1, ty).x, centreOf(tx - 1, ty).y)
        && geometryAt(centreOf(tx + 1, ty).x, centreOf(tx + 1, ty).y);
    if (!shaft) return null;
    const below = run.state.y > r.bottom;
    const stanceY = centreOf(tx, below ? ty + 1 : ty - 1).y;
    const exitY = centreOf(tx, below ? ty - 1 : ty + 1).y;
    // The box clears the press rect's ROWS here — the lean may stop.
    const clearY = below ? r.y - (HITBOX.height - HITBOX.originY) : r.bottom + HITBOX.originY;
    const lanes = [
        { side: 'east', x: r.right + HITBOX.originX, lean: 'right', out: 1 },
        { side: 'west', x: r.x - (HITBOX.width - HITBOX.originX), lean: 'left', out: -1 },
    ];
    const rejected = [];
    for (const lane of lanes) {
        const ys = [];
        for (let y = Math.min(stanceY, clearY); y <= Math.max(stanceY, clearY); y += 1) ys.push(y);
        const blockedAt = ys.find((y) => geometryAt(lane.x, y));
        const openWallAt = ys.find((y) => !geometryAt(lane.x + lane.out, y));
        if (blockedAt === undefined && openWallAt === undefined) {
            return {
                strategy: 'skirt',
                target: { x: trap.presser.x, y: trap.presser.y },
                presser: trap.presser,
                rocks: trap.rocks,
                lane: { side: lane.side, x: lane.x, lean: lane.lean, stanceY, clearY, exitY },
                stance: { x: lane.x, y: stanceY },
                /**
                 * ⛓⛓ SEEDLING SWIM U2, D1 — THE APPROACH KEEPS x ON THE 0.05
                 * GRID. The lane admits one x, `execSkirt`'s alignment is
                 * x-only, and an x-only sequence cannot change x's fraction
                 * modulo 0.05; only a diagonal velocity's friction can, and a
                 * walk that never makes one keeps an arrival's integral x on
                 * the grid (`holdOneAxis`). So the stance walk is asked to be
                 * axis-aligned (`walkTo`'s `axisAligned`).
                 */
                approach: 'axis-aligned',
                rejected: [{
                    option: 'hold',
                    why: `${obstacle.id}'s group t=${trap.presser.t} answers only `
                        + `[${trap.rocks.join(', ')}] — a press opens nothing and DROPS a Solid `
                        + 'into the room (`FALL_RESPONDERS`), so pressing is a trap: avoid, do '
                        + 'not press',
                }, ...rejected],
            };
        }
        rejected.push({
            option: `skirt ${lane.side} lane x=${lane.x}`,
            why: blockedAt !== undefined
                ? `the lane box is blocked at y=${blockedAt}`
                : `no wall to lean on at y=${openWallAt}, so a bang-bang walk cannot hold a `
                    + '0-px lane there',
        });
    }
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — **THE WALL IS FOR THE ALIGN, NOT THE
     * PASS.** Since swim U2 `execSkirt` does not lean: it ALIGNS x exactly at the
     * stance (`skirtAlignment` sweeps against the wall on the lean side) and then
     * walks with the vertical key alone, vx 0, so x cannot move. The wall is
     * therefore needed where the align runs — the stance — and the pass needs only
     * a lane box that is never blocked. Asked ONLY when the rule above found no
     * lane, so every skirt it already resolves keeps its stance and its bytes.
     *
     * Measured on L29's RETURN (survey step 57): from the north the stance tile is
     * row 7, `fallrock@112,112`'s own unfallen cell, with no wall either side, so
     * both lanes were rejected *"no wall to lean on at y=120"* and the room could
     * be entered but not left. Row 6 is flanked by `dungeonspire@96,80` /
     * `@128,80`, so the align runs there and the pass crosses row 7 untouched.
     *
     * The stance moves at most `SKIRT_STANCE_REACH` tiles further from the
     * button, and its wall is asked over the ±`SKIRT_STANCE_BAND` px the walk to
     * it can land in.
     */
    for (let k = 2; k <= SKIRT_STANCE_REACH; k += 1) {
        const farY = centreOf(tx, below ? ty + k : ty - k).y;
        for (const lane of lanes) {
            const ys = [];
            for (let y = Math.min(farY, clearY); y <= Math.max(farY, clearY); y += 1) ys.push(y);
            const blockedAt = ys.find((y) => geometryAt(lane.x, y));
            let walled = blockedAt === undefined;
            for (let y = farY - SKIRT_STANCE_BAND; walled && y <= farY + SKIRT_STANCE_BAND; y += 1) {
                if (!geometryAt(lane.x + lane.out, y)) walled = false;
            }
            if (!walled) continue;
            return {
                strategy: 'skirt',
                target: { x: trap.presser.x, y: trap.presser.y },
                presser: trap.presser,
                rocks: trap.rocks,
                lane: { side: lane.side, x: lane.x, lean: lane.lean, stanceY: farY, clearY, exitY },
                stance: { x: lane.x, y: farY },
                approach: 'axis-aligned',
                rejected: [{
                    option: 'hold',
                    why: `${obstacle.id}'s group t=${trap.presser.t} answers only `
                        + `[${trap.rocks.join(', ')}] — a press opens nothing and DROPS a Solid `
                        + 'into the room (`FALL_RESPONDERS`), so pressing is a trap: avoid, do '
                        + 'not press',
                }, ...rejected, {
                    option: `the stance ${k - 1} tile(s) nearer`,
                    why: `no wall beside the ${lane.side} lane there; the align runs ${k} tiles out, `
                        + 'where the wall is, and the pass is the vertical key alone (vx 0)',
                }],
            };
        }
    }
    return null;
}

/**
 * ⛓ SEEDLING FIDELITY PROXIMITY — how many tiles from the button the skirt's
 * fallback stance may move (a POLICY bound: one tile beyond the original), and
 * the px band either side of its centre row the align wall must cover (the walk
 * to a stance lands within the solver's arrival tolerance, which is under it).
 */
const SKIRT_STANCE_REACH = 3;
const SKIRT_STANCE_BAND = 3;

/**
 * ⛓⛓ SEEDLING SWIM U1, D2 — THE `skirt` EXECUTOR. From the stance (the lane x,
 * one tile short of the button): ALIGN the x EXACTLY on the lane, then walk
 * through the button's rows holding only the vertical key, then on into the
 * far tile's centre row.
 *
 * ⛔ WHY ALIGN AND NOT LEAN. The lane admits ONE x (L29: 126.000 — box
 * 124..128 against a 116..124 press rect and a wall at 128), and the model's
 * blocked sweep keeps the fractional remainder (`sweepAxis` stops at `p`, not
 * at the wall): measured, a walk that arrived at x≈125.4 and leaned right
 * settled at 125.97137961649308 with vx 1.15 for 70 ticks, its box 0.03 px
 * into the press rect. So the x is steered onto the lane by a bounded search
 * over `{none, left, right}` on the x axis alone, using the transcription's own
 * three steps (`applyInput`, `applyFriction`, `sweepAxis` with the wall at the
 * lane's lean side), and every searched tick is then RUN and compared exactly.
 * With vx = 0 the vertical walk leaves x untouched (friction shortens the
 * velocity VECTOR, whose x is 0).
 *
 * ⛔ VERIFIED PER TICK, `runHold`'s positive-control shape turned round: after
 * every tick the run's own press test (`fallRocksArmedBy` on the live box) must
 * name no rock, and after the pass the rocks must still stand
 * (`liveGeometryOpts().fallenRocks`) and the open/latched sets must be what
 * they were. A pass that pressed fails BY NAME — it is a defect in this verb,
 * never a measurement.
 */
function execSkirt(run, perTick, resolved, ctx) {
    const { lane, presser, rocks } = resolved;
    const id = `${presser.tag}@${presser.x},${presser.y}`;
    const what = `${ctx.what} (${id}, ${lane.side} lane x=${lane.x})`;
    const openBefore = [...(run.entities('openActivators') ?? [])].sort().join(',');
    const latchedBefore = [...(run.entities('latchedGroups') ?? [])].sort().join(',');
    const from = run.ticksCompleted;
    const up = lane.exitY < lane.stanceY;
    const tick = (held, phase) => {
        perTick.push(held);
        const { transition } = run.advance(held);
        if (transition) {
            fail(`${what}: the pass crossed to level ${transition.to_level} during its ${phase} `
                + 'phase — a skirt never leaves the room.');
        }
        const pressed = fallRocksArmedBy(run.world, playerBoxAt(run.state.x, run.state.y));
        if (pressed.length > 0) {
            fail(`${what}: the pass PRESSED ${id} at tick ${run.ticksCompleted} (${phase} phase, `
                + `box at (${run.state.x},${run.state.y})) and armed `
                + `[${pressed.map((x) => x.id).join(', ')}] — the lane was not held.`);
        }
    };
    const bound = (px) => Math.ceil(Math.abs(px) / WALK_SPEED) * 2 + HOLD_SLACK;
    // 1. ALIGN: steer x onto the lane EXACTLY (see the docblock).
    const plan = skirtAlignment(run.state.x, run.state.vx, lane);
    if (!plan) {
        fail(`${what}: no x-input sequence of at most ${SKIRT_ALIGN_DEPTH} ticks takes the `
            + `stance state (x=${run.state.x}, vx=${run.state.vx}) EXACTLY onto x=${lane.x} `
            + 'at rest — the lane admits that one x and the model keeps sub-pixel remainders.');
    }
    for (const key of plan) {
        tick(new Set(key ? [key] : []), 'align');
    }
    if (run.state.x !== lane.x || run.state.vx !== 0) {
        fail(`${what}: the align sequence [${plan.map((k) => k ?? '-').join(' ')}] was searched `
            + `to end on x=${lane.x} at rest and the RUN ended at x=${run.state.x}, `
            + `vx=${run.state.vx} — the x-axis model and the run disagree.`);
    }
    // 2. PASS: the vertical key alone; vx is 0, so x stays on the lane.
    const vKey = up ? 'up' : 'down';
    const past = () => (up ? run.state.y <= lane.clearY : run.state.y >= lane.clearY);
    for (let n = 0; !past(); n += 1) {
        if (n >= bound(lane.stanceY - lane.clearY)) {
            fail(`${what}: the lane walk did not clear the button's rows within `
                + `${bound(lane.stanceY - lane.clearY)} ticks (at y=${run.state.y}).`);
        }
        tick(new Set([vKey]), 'pass');
    }
    // 3. ON: into the far tile's centre row, where whole-tile planning resumes.
    const beyond = () => (up ? run.state.y <= lane.exitY : run.state.y >= lane.exitY);
    for (let n = 0; !beyond(); n += 1) {
        if (n >= bound(lane.clearY - lane.exitY)) {
            fail(`${what}: the walk on did not reach y=${lane.exitY} within `
                + `${bound(lane.clearY - lane.exitY)} ticks (at y=${run.state.y}).`);
        }
        tick(new Set([vKey]), 'on');
    }
    const fallen = run.liveGeometryOpts().fallenRocks;
    const dropped = rocks.filter((rid) => fallen?.has?.(rid));
    const openAfter = [...(run.entities('openActivators') ?? [])].sort().join(',');
    const latchedAfter = [...(run.entities('latchedGroups') ?? [])].sort().join(',');
    if (dropped.length > 0 || openAfter !== openBefore || latchedAfter !== latchedBefore) {
        fail(`${what}: after the pass [${dropped.join(', ')}] fell and the open/latched sets `
            + `moved (${openBefore}|${latchedBefore} -> ${openAfter}|${latchedAfter}) — the `
            + 'skirt published its group.');
    }
    SKIRTED.set(run, { level: run.level, cameFromBelow: up, rowY: (presser.rect.y + presser.rect.bottom) / 2 });
    return { verb: 'skirt', target: id, lane: lane.side, x: lane.x, from,
        ticks: run.ticksCompleted - from, rocksStanding: [...rocks] };
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — RESOLVE a `brave`: **AN ICE TURRET'S RANGE IS
 * CROSSED, AND THE RUN PAYS WHAT THE GAME CHARGES.**
 *
 * The census volume is `IceTurret.attackRange` (128, `d` an `int`, so a 129 px
 * disc from the entity point), and the census priced it as a wall. The game
 * charges something else (`IceTurret.as:54-96`, `IceTurretBlast.as`): inside the
 * range the turret turns a tenth of the angle per tick toward the player and,
 * every `shootTimerMax` 25 ticks plus its "startshot"/"finishshot" animation,
 * fires three 6 px/tick blasts along its OWN angle. A blast that reaches the
 * player calls `freeze(15)` (fifteen ticks with no input block) and
 * `hit(null, 0, …)` (one damage, no knockback, behind `hitsTimer`). Nothing in it
 * stops a walk, and the run steps all of it (`stepIceTurretsNow`, the volleys,
 * `iceTurretBlast`, the freeze, `applyPlayerHit` and the reboot on a death).
 *
 * ⇒ the verb is a ZERO-TICK EXEMPTION of the disc for this goal: the walk the
 * loop then plans goes through the range, and every volley it draws is the
 * run's own tick. A crossing that dies is the run's death, refused downstream in
 * the walk's own words; one that survives is what the game does.
 *
 * ⛔ A turret the live run reports dead or removed is no range at all (a corpse
 * does not shoot); the same exemption, with the reason.
 */
function resolveBraveStrategy(run, obstacle, contacts) {
    const t = (run.world.iceTurrets ?? []).find((q) => q.id === obstacle.id);
    if (!t) return null;
    const live = run.entities('turrets')?.get?.(obstacle.id) ?? null;
    const dead = live ? Boolean(live.dead || live.removed) : false;
    return {
        strategy: 'brave',
        target: { x: t.x, y: t.y },
        turret: obstacle.id,
        stance: null,
        dead,
        exempt: new Set([...contacts, `proximity-hazard:${obstacle.id}`]),
        rejected: [{
            option: 'route-around',
            why: `${obstacle.id}'s 129 px range is on the frontier of the reachable component, `
                + 'so there is no route around it',
        }, {
            option: 'wall',
            why: dead ? `${obstacle.id} is a CORPSE in the live run — a dead turret does not shoot`
                : 'the range stops nothing: a volley is `freeze(15)` and one damage per blast '
                    + '(`IceTurretBlast.as:53-55`), which the run steps tick for tick',
        }],
    };
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — THE `brave` EXECUTOR: zero ticks. The
 * resolution's exemption is the whole verb (the walk that follows is the
 * loop's), so the record names what was exempted and the player's damage state
 * at the moment the range was entered.
 */
function execBrave(run, perTick, resolved) {
    return { verb: 'brave', target: resolved.turret, dead: resolved.dead, ticks: 0,
        hitsTaken: (run.ledger('playerHits') ?? []).length };
}

/**
 * ⛓ SEEDLING FIDELITY PROXIMITY — the last skirt each run made: its level, the
 * side the player CAME FROM, and the button row's y. `skirtGridKept` reads it.
 */
const SKIRTED = new WeakMap();

/**
 * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — **KEEP THE x GRID WHILE A CROSSING BACK IS
 * STILL OWED.** True when this run skirted in the level it is in AND one of
 * `remaining` (the segment's goals from the current one on) aims back on the
 * side the skirt came from — so the lane will be crossed again, and its one
 * admissible x is reachable only from the 0.05 grid (see `walkTo`). A segment
 * that never turns back (L29's key then its northern doors) walks as it always
 * did.
 */
function skirtGridKept(run, remaining) {
    const sk = SKIRTED.get(run);
    if (!sk || sk.level !== run.level) return false;
    return remaining.some((g) => {
        const aim = g.kind === 'reach-exit' ? g.exit
            : g.kind === 'collect-placement' ? g.placement : null;
        return aim && (sk.cameFromBelow ? aim.y > sk.rowY : aim.y < sk.rowY);
    });
}

/**
 * ⛓⛓ SEEDLING SWIM U1, D2 — the align search's depth, a POLICY bound (how long
 * the solver will look), not a physics value. Measured on L29's east lane:
 * from x=125.5 at rest the answer is 8 ticks, from 124.3 it is 10, and some
 * starts have none within 14; 16 bounds a tile's worth of cheap search.
 */
const SKIRT_ALIGN_DEPTH = 16;

/**
 * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — the shut `Cover` sharing a chest's cell,
 * or `null`. `Cover.update`'s own comment names the shape: *"Anything that can
 * go underneath a cover can go here"* (`Cover.as:57`), and the one thing it
 * names is `Chest`. A cover the live run reports open is no prerequisite.
 */
export function coverOverChest(run, chest) {
    const open = run.entities('openActivators') ?? new Set();
    return (run.world.activators ?? []).find((a) => a.tag === 'cover'
        && a.x === chest.x && a.y === chest.y && !open.has(a.id)) ?? null;
}

/** `FP.distanceRectPoint` — the pulser's reach filter (`Pulser.as:90-93`). */
function pulseRectDistance(px, py, rx, ry, rw, rh) {
    const dx = px < rx ? rx - px : (px > rx + rw ? px - (rx + rw) : 0);
    const dy = py < ry ? ry - py : (py > ry + rh ? py - (ry + rh) : 0);
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — **A RESPONDER WHOSE BUTTON A MACHINE
 * PRESSES.**
 *
 * `{responder, pulser, block, button, publisher, to}` when `obstacle` is a SHUT
 * responder whose every opener (`world.pressers` sharing its `t`) is a momentary
 * `button` (`localPublish` null), and some room `Pulser` both (a) is published
 * by a LATCHING presser (`localPublish(p).value === true`, the `room == -1`
 * ButtonRoom's *"Can't be reset to false!!"*) and (b) has a live
 * `pushableblockfire` inside its 22 px reach whose pulse push
 * (`pulser.pulsePushes`, the run's own transcription of `PushableBlockFire.hit`)
 * lands it on one of those buttons. `null` otherwise.
 *
 * ⛔ WHY THIS IS THE ROOM'S ANSWER AND NOT A HOLD. `Button.update` republishes
 * every tick (`Button.as:27-39`), so a player standing on the button opens the
 * responder only while standing there — and in L38 the responder is the
 * `cover@144,112` over the chest, whose probe line is 48 px east and 63 px north
 * of `button@80,192`. A `Solid` on the button is the only presser that outlives
 * the walker (`hitables` ∋ `"Solid"`), and the block's only mover in reach is
 * the pulser (`PushableBlockFire.moveTypes` = Fire, Pulse).
 */
export function pulseWeighFor(run, obstacle) {
    const row = (run.world.activators ?? []).find((a) => a.id === obstacle?.id);
    if (!row || !(row.t >= 0)) return null;
    if ((run.entities('openActivators') ?? new Set()).has(row.id)) return null;
    const buttons = (run.world.pressers ?? []).filter((p) => p.t === row.t);
    if (buttons.length === 0 || buttons.some((p) => p.tag !== 'button' || localPublish(p) !== null)) {
        return null;
    }
    const live = run.entities('pushables');
    if (!live) return null;
    const tileOf = (x, y) => `${Math.floor(x / TILE_SIZE)},${Math.floor(y / TILE_SIZE)}`;
    for (const pulser of run.world.pulsers ?? []) {
        const publishers = (run.world.pressers ?? [])
            .filter((p) => p.t === pulser.t && localPublish(p)?.value === true)
            .sort((a, b) => (`${a.tag}@${a.x},${a.y}` < `${b.tag}@${b.x},${b.y}` ? -1 : 1));
        if (publishers.length === 0) continue;
        const at = { x: pulser.x + TILE_SIZE / 2, y: pulser.y + TILE_SIZE / 2 };
        for (const p of run.world.pushables ?? []) {
            if (p.family !== 'fire') continue;
            const state = live.get(p.id);
            if (!state || state.removed) continue;
            // The run hands out the block's RECT (`run.pushables`), not its
            // mover state; a block at rest where the rect is is the
            // transcription's own constructor at that position.
            const block = newPushable({ ...p, x: state.rect.x, y: state.rect.y });
            if (pulseRectDistance(at.x, at.y, block.x, block.y, TILE_SIZE, TILE_SIZE)
                > PULSER.radiusHit) continue;
            const push = pulsePushes(at, block);
            if (!push.moved) continue;
            const to = push.block.target;
            const button = buttons.find((b) => tileOf(b.x, b.y) === tileOf(to.x, to.y));
            if (!button) continue;
            const publisher = publishers[0];
            return {
                responder: row,
                pulser: pulser.id,
                pulserGroup: pulser.t,
                block: p.id,
                button: `${button.tag}@${button.x},${button.y}`,
                publisher: { tag: publisher.tag, x: publisher.x, y: publisher.y,
                    id: `${publisher.tag}@${publisher.x},${publisher.y}` },
                to: { x: to.x, y: to.y },
            };
        }
    }
    return null;
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — RESOLVE a `pulse`: the publisher's `hold`
 * (its stance, exemption and prerequisite, unchanged) plus a WAIT whose stop is
 * the responder open in the live run.
 *
 * The wait's bound is a claim the run can refute, not a tuning: two whole pulser
 * cycles (`pulserCycle().totalTicks`, the first may already be under way when
 * the press lands), the responder's own fade (`opensOnTick`) and `HOLD_SLACK`
 * for the block's 16 px slide. A group the live run already reports latched
 * needs no press: the resolution is the wait alone, where the player stands.
 */
function resolvePulseStrategy(run, obstacle, contacts, blocked = []) {
    const pw = pulseWeighFor(run, obstacle);
    if (!pw) return null;
    const responder = pw.responder;
    const wait = {
        ticks: 2 * pulserCycle().totalTicks
            + opensOnTick(RESPONDERS[responder.tag]?.fade ?? RESPONDERS.lock.fade) + HOLD_SLACK,
        until: {
            why: `${responder.id} is open — ${pw.block} parked on ${pw.button} by ${pw.pulser}`,
            test: (r) => (r.entities('openActivators') ?? new Set()).has(responder.id),
        },
    };
    const rejected = [{
        option: `hold ${pw.button}`,
        why: `${pw.button} is a momentary \`Button\` (\`Button.as:27-39\` republishes every tick), `
            + `so ${responder.id} would shut the tick the walker left it; ${pw.pulser}'s pulse `
            + `parks ${pw.block} on it instead, which presses it for ever`,
    }];
    const latched = (run.entities('latchedGroups') ?? new Set()).has(pw.pulserGroup);
    if (latched) {
        return { strategy: 'pulse', target: null, stance: null, pulse: pw, wait, press: false,
            rejected: [{ option: `press ${pw.publisher.id}`,
                why: `group t=${pw.pulserGroup} is already LATCHED in the live run` }, ...rejected] };
    }
    /**
     * ⛓ THE PUBLISHER UNDER ITS OWN COVER (L38's `buttonroom@208,224` under
     * `cover@208,224`): the stage before the press is that cover's LATCHING
     * opener (`buttonroom@144,128`, `room == -1`), held as an ordinary `hold`
     * whose stop is the cover open. The loop then re-raises this order and the
     * publisher is reachable. A cover whose opener does not latch is not this
     * arm's; the publisher's own stance derivation then refuses by name.
     */
    const open = run.entities('openActivators') ?? new Set();
    const lid = (run.world.activators ?? []).find((a) => a.tag === 'cover'
        && a.x === pw.publisher.x && a.y === pw.publisher.y && !open.has(a.id));
    const lidOpener = lid && !(run.entities('latchedGroups') ?? new Set()).has(lid.t)
        ? (run.world.pressers ?? []).filter((p) => p.t === lid.t && localPublish(p)?.value === true)
            .sort((a, b) => (`${a.tag}@${a.x},${a.y}` < `${b.tag}@${b.x},${b.y}` ? -1 : 1))[0]
        : null;
    if (lidOpener) {
        const uncover = resolveHoldStrategy(run,
            { kind: 'proximity-hazard', tag: lidOpener.tag,
                id: `${lidOpener.tag}@${lidOpener.x},${lidOpener.y}` },
            contacts, blocked);
        if (!uncover || uncover.stance === null) return null;
        return { ...uncover, strategy: 'pulse', pulse: pw, uncover: lid.id,
            rejected: [{
                option: `press ${pw.publisher.id}`,
                why: `${lid.id} is SHUT over it (a \`Cover\` is \`type = "Solid"\`, `
                    + `\`Cover.as:32\`); its latching opener `
                    + `${lidOpener.tag}@${lidOpener.x},${lidOpener.y} is pressed first`,
            }, ...rejected, ...(uncover.rejected ?? [])] };
    }
    const hold = resolveHoldStrategy(run,
        { kind: 'proximity-hazard', tag: pw.publisher.tag, id: pw.publisher.id },
        contacts, blocked);
    if (!hold || hold.stance === null) return null;
    return { ...hold, strategy: 'pulse', pulse: pw, wait, press: true,
        rejected: [...rejected, ...(hold.rejected ?? [])] };
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — THE `pulse` EXECUTOR: the publisher's press
 * (`execHold`, the verb's own runner) when the group is not yet latched, then
 * stand still until the responder is open, inside `resolved.wait.ticks`, or
 * refuse BY NAME — a wait that runs out is a measurement that the pulse did not
 * park the block where `pulseWeighFor` predicted.
 */
function execPulse(run, perTick, resolved, ctx) {
    const pw = resolved.pulse;
    const what = `${ctx.what} (${pw.publisher.id} -> ${pw.pulser} -> ${pw.block} -> ${pw.button})`;
    const from = run.ticksCompleted;
    if (resolved.uncover && (run.entities('openActivators') ?? new Set()).has(resolved.uncover)) {
        // The stance IS the latch's press rect, so the walk onto it pressed it
        // and the cover's ten-tick fade can finish on the way in: nothing is
        // left to hold, and `runHold` would refuse a hold that changes nothing.
        return { verb: 'pulse', stage: 'uncover', target: pw.responder.id, uncovered: resolved.uncover,
            press: null, openedOnApproach: true, from, ticks: 0 };
    }
    if (resolved.uncover) {
        const uncovered = execHold(run, perTick, resolved, { ...ctx, what: `${what} uncover` });
        if (!(run.entities('openActivators') ?? new Set()).has(resolved.uncover)) {
            throw new SolverRefusal(`${what}: pressed ${resolved.target.x},${resolved.target.y} to `
                + `open ${resolved.uncover} and it is still shut.`,
            { obstacle: { kind: 'solid', id: resolved.uncover } });
        }
        return { verb: 'pulse', stage: 'uncover', target: pw.responder.id, uncovered: resolved.uncover,
            press: uncovered, from, ticks: run.ticksCompleted - from };
    }
    // The same shape one stage on: the walk onto the publisher's press rect
    // latched the pulser's group, so there is no press left to hold.
    const pressedOnApproach = resolved.press
        && (run.entities('latchedGroups') ?? new Set()).has(pw.pulserGroup);
    const press = resolved.press && !pressedOnApproach
        ? execHold(run, perTick, resolved, { ...ctx, what }) : null;
    const NO_KEYS = new Set();
    let waited = 0;
    while (!resolved.wait.until.test(run) && waited < resolved.wait.ticks) {
        perTick.push(NO_KEYS);
        waited += 1;
        const { transition } = run.advance(NO_KEYS);
        if (transition) {
            throw new SolverRefusal(`${what}: the wait crossed from level ${transition.from_level} `
                + `to ${transition.to_level} on its tick ${waited}. A wait stands still.`,
            { obstacle: { kind: 'solid', id: pw.responder.id } });
        }
    }
    if (!resolved.wait.until.test(run)) {
        const pushes = (run.ledger('pulserPushes') ?? []).filter((x) => x.block === pw.block);
        throw new SolverRefusal(`${what}: waited the whole bound of ${resolved.wait.ticks} tick(s) `
            + `and ${pw.responder.id} never opened — ${resolved.wait.until.why} was predicted; the `
            + `run's pulse pushes of ${pw.block}: ${JSON.stringify(pushes)}.`,
        { obstacle: { kind: 'solid', id: pw.responder.id } });
    }
    return { verb: 'pulse', target: pw.responder.id, publisher: pw.publisher.id, pulser: pw.pulser,
        block: pw.block, button: pw.button, press, ...(pressedOnApproach ? { pressedOnApproach } : {}),
        waited, from,
        ticks: run.ticksCompleted - from };
}

/**
 * The shortest `{null, 'left', 'right'}` sequence (breadth-first, `null` first)
 * that takes `(x, vx)` to exactly `lane.x` with the friction-zeroed vx 0, on
 * the x axis alone, with the wall on the lane's lean side. `null` if none
 * within `SKIRT_ALIGN_DEPTH`.
 */
function skirtAlignment(x0, vx0, lane) {
    const wallAt = lane.lean === 'right' ? (p) => p > lane.x : (p) => p < lane.x;
    // ⛓ SEEDLING SWIM U2, D1 — FRICTION FIRST, THEN INPUT: the step's own order
    // (`playerPhysicsV1.js` `v = applyFriction(v, f)` above `applyInput`). U1
    // composed them the other way round and the run's compare caught it the
    // first time a sequence was found (measured on step 27: the searched
    // sequence ended at vx 0 and the run at vx 0.1000000000000001).
    const stepX = (x, vx, key) => {
        const v = applyInput(applyFriction({ x: vx, y: 0 }, DEFAULT_FRICTION),
            new Set(key ? [key] : []), WALK_SPEED);
        return { x: sweepAxis(x, v.x, (p) => (wallAt(p) ? 'wall' : null)).pos, vx: v.x };
    };
    if (x0 === lane.x && vx0 === 0) return [];
    let frontier = [{ x: x0, vx: vx0, seq: [] }];
    const seen = new Set([`${x0}|${vx0}`]);
    for (let d = 0; d < SKIRT_ALIGN_DEPTH; d += 1) {
        const next = [];
        for (const s of frontier) {
            for (const key of [null, 'left', 'right']) {
                const n = stepX(s.x, s.vx, key);
                const seq = [...s.seq, key];
                if (n.x === lane.x && n.vx === 0) return seq;
                const k = `${n.x}|${n.vx}`;
                if (seen.has(k)) continue;
                seen.add(k);
                next.push({ ...n, seq });
            }
        }
        frontier = next;
    }
    return null;
}

/**
 * The `hold` arm, lifted out of `resolveObstacleStrategy` UNCHANGED so that
 * `weigh` can fall back to it (see `resolveWeighStrategy`). A pure move: the
 * body is the same statements in the same order, and the battery is what says
 * so.
 */
function resolveHoldStrategy(run, obstacle, contacts, blocked = [], alsoRejected = []) {
    const latchedWait = latchedFadeWait(run, obstacle, alsoRejected);
    if (latchedWait) return latchedWait;
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
 * ⛓⛓⛓ SEEDLING FIDELITY F6 (I03) — A RESPONDER WHOSE GROUP IS ALREADY LATCHED
 * NEEDS NO PRESSER: THE HOLD IS A WAIT WHERE THE PLAYER STANDS.
 *
 * A `room = -1` ButtonRoom's publish latches its group (`localPublish`, the
 * setter's *"Can't be reset to false!!"*), and since F6 a ButtonRoom whose own
 * tag is cleared latches it at BUILD (`activators.createActivatorState`). The
 * fade then runs to `turnOff()` whoever stands where. L20 re-entered from L13
 * is the case: the player arrives in the pocket behind `lock@32,80`, and the
 * group's presser, `buttonroom@192,16`, is on the far side of that same lock —
 * so `hold`'s walk to the presser asked for a corridor through the lock, which
 * raised `hold` again, four times, with no tick spent.
 *
 * `null` unless `obstacle` is a fade responder (`RESPONDERS`, not a touch or key
 * one) whose group the LIVE run reports latched (`latchedGroups`). The wait's
 * bound is the fade's own count (`opensOnTick`) plus `HOLD_SLACK`, and its stop
 * is the responder open in the live run (`execHold`'s latched arm).
 */
function latchedFadeWait(run, obstacle, alsoRejected = []) {
    const row = (run.world.activators ?? []).find((a) => a.id === obstacle.id);
    if (!row || !(row.t >= 0) || !RESPONDERS[row.tag]
        || TOUCH_RESPONDERS[row.tag] || KEY_RESPONDERS[row.tag]) return null;
    if (!(run.entities('latchedGroups') ?? new Set()).has(row.t)) return null;
    if (run.entities('openActivators').has(row.id)) return null;
    return {
        strategy: 'hold',
        target: null,
        stance: null,
        latched: true,
        hold: {
            ticks: opensOnTick(RESPONDERS[row.tag].fade) + HOLD_SLACK,
            latched: true,
            why: null,
            until: {
                why: `${row.id} is open — its group t=${row.t} is LATCHED in the live run, `
                    + 'so the fade completes whoever is standing where',
                test: (r) => r.entities('openActivators').has(row.id),
            },
        },
        rejected: [{
            option: 'presser',
            why: `group t=${row.t} is already LATCHED in the live run, so no presser is `
                + `needed — walking to one would ask for a corridor through ${row.id} itself`,
        }, ...alsoRejected],
    };
}

/**
 * The latched arm of `execHold` — stand still until the latched responder is
 * open, inside the fade's own bound, or refuse by name.
 */
function runLatchedWait(run, perTick, resolved, what) {
    const { ticks, until } = resolved.hold;
    const start = { x: run.state.x, y: run.state.y };
    const NO_KEYS = new Set();
    let heldFor = 0;
    while (!until.test(run) && heldFor < ticks) {
        perTick.push(NO_KEYS);
        heldFor += 1;
        const { transition } = run.advance(NO_KEYS);
        if (transition) {
            throw new SolverRefusal(`${what}: the latched wait crossed from level `
                + `${transition.from_level} to ${transition.to_level} on its tick ${heldFor}. `
                + 'A wait stands still.', { obstacle: { kind: 'solid', id: resolved.hold.until.why } });
        }
    }
    if (!until.test(run)) {
        throw new SolverRefusal(`${what}: waited the whole bound of ${ticks} tick(s) and the `
            + `condition never became true — ${until.why}. The bound is the fade's own count, so `
            + 'running it out is a measurement that the latch is not what the run reports.',
        { obstacle: { kind: 'solid', id: 'latched-wait' } });
    }
    return { presser: null, latched: true, ticks, heldFor, stoppedOn: until.why, at: start,
        opened: [], armed: [], traps: [], volleys: 0, wrote: [] };
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
    if (run.entities('openChests')?.has?.(chest.id)) return null;
    const covered = coverOverChest(run, chest);
    if (covered) {
        /**
         * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — A CHEST UNDER A SHUT COVER IS THE
         * COVER'S WORK ORDER FIRST. `Chest.update` opens only `if
         * (!collide("Solid", x, y))` and a shut `Cover` (`type = "Solid"`,
         * `Cover.as:32`) shares the chest's cell, so standing on the probe line
         * opens nothing (measured: L38 steps 103/145, *"NEVER OPENED in 400
         * ticks"*). And a hold on the cover's own button cannot be the answer:
         * `Cover.update` resets the moment its group drops with the chest under
         * it (`:51-66`), so the opener must OUTLIVE the walker. The cover is
         * resolved through the ordinary selection; the loop re-raises the chest
         * once it is open.
         */
        const sub = { kind: 'solid', tag: covered.tag, id: covered.id };
        const verb = refineStrategy(run, 'hold', sub);
        const resolved = verb === 'pulse' ? resolvePulseStrategy(run, sub, contacts, []) : null;
        if (!resolved) return null;
        return {
            ...resolved,
            rejected: [{
                option: `chest ${chest.id}`,
                why: `${covered.id} is SHUT over it — \`Chest.update\`'s gate is `
                    + '`!collide("Solid", x, y)`, so the cover is the prerequisite, not the stance',
            }, ...(resolved.rejected ?? [])],
        };
    }
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
    if (run.entities('pushables') === null) return null;
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
    /**
     * ⛓⛓⛓ R9 SLICE L15 — A BLOCK ALREADY RESTING ON A MOMENTARY PRESSER IS
     * THE KEY ALREADY TURNED. After L15's route parks the block on (7,2) the
     * lock is still Solid for its 101-tick fade, and the frontier names the
     * nearest actionable obstacle — the BLOCK, one cell nearer than the lock
     * — so a resolver that leaned on it again would either shove the key off
     * the door or refuse the room it just solved. The honest resolution is
     * the weigh's own dwell arm (`resolveWeighStrategy`, "block already
     * home") for the group the block is pressing: same verb the room is
     * about, same mechanism (`Button.hitables` ∋ "Solid"), no new arm.
     * ⚠ Only a MOMENTARY presser (`localPublish` null) and only while some
     * activator of its group is still shut — a latched group is `hold`'s
     * and an open one is not an obstacle.
     */
    const liveBlock = run.entities('pushables').get(row.id);
    const pressed = liveBlock && !liveBlock.removed ? (run.world.pressers ?? []).find(
        (p) => localPublish(p) === null && rectsOverlapLocal(liveBlock.rect, p.rect)) : null;
    if (pressed) {
        const shut = (run.world.activators ?? []).find(
            (a) => a.t === pressed.t && !run.entities('openActivators').has(a.id));
        if (shut) {
            const dwell = resolveWeighStrategy(run, { kind: 'solid', tag: shut.tag, id: shut.id },
                contacts, blocked);
            if (dwell && dwell.dwellOnly) return dwell;
        }
    }
    const derived = deriveShove(run, row, aim, allowTeleporter, contacts, blocked);
    if (!derived || !derived.plan) return null;
    const { plan, rejected, alternatives, discharged } = derived;
    const step = SHOVE_STEP[plan.dir];
    /**
     * ⛓ R9 SLICE L15 — the stance the frontier walks to is the ROUTE's first
     * step's, which is the lean's near-side cell exactly as before when the
     * route starts with a lean, and the swing cell when it starts with a
     * break. `execRoute` walks the rest.
     */
    const stance = derived.route
        ? derived.route[0].stance
        : nodeCentre(
            Math.floor(run.entities('pushables').get(row.id).rect.x / TILE_SIZE) - step.dx,
            Math.floor(run.entities('pushables').get(row.id).rect.y / TILE_SIZE) - step.dy,
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
    const rejections = derived.route ? [{
        /**
         * ⛓ R9 SLICE L15 — a route's first lean does NOT plan the corridor
         * by itself, so the one-step vocabulary ("k+1 is UNNEEDED") would be
         * a false sentence here. The scan's own rejections stand — they are
         * the reason a route was needed — and the route is spelled out.
         */
        option: 'a ONE-order route',
        why: `NONE — no (dir, k) yields the corridor by itself. This is a `
            + `${derived.route.length}-order route: ${describeRoute(derived.route)} `
            + '(kickoff §54.4 — one search over the block, the broken rocks and the '
            + 'player; the executor asserts each step\'s post-condition against the '
            + 'live run).',
    }, ...rejected] : [
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
        ...(derived.route ? { route: derived.route } : {}),
        rejected: rejections,
    };
}

/**
 * The block-route search's own rejections for a `shove` the resolver refused
 * — the frontier's `considered` row quotes them. Re-runs the search (tens of
 * expansions on any committed room) rather than threading a side channel
 * through a resolver that answers `null` by contract.
 */
function shoveRefusalDetail(run, obstacle, contacts, aim, allowTeleporter, blocked) {
    const row = (run.world.pushables ?? []).find((p) => p.id === obstacle.id);
    if (!row || row.family !== 'walk' || run.entities('pushables') === null) return null;
    const derived = deriveShove(run, row, aim, allowTeleporter, contacts, blocked);
    if (!derived || derived.plan) return null;
    const rows = derived.rejected ?? [];
    if (!rows.length) return null;
    return rows.map((r) => `[${r.option} — ${r.why}]`).join(' ');
}

/** One line per step — the trace's spelling of a multi-order route. */
const describeRoute = (route) => route.map((st, i) => (st.verb === 'shove'
    ? `${i + 1}. shove ${st.dir} k=${st.k} -> (${st.to.tx},${st.to.ty})${st.destroys
        ? ' (DESTROYED there)' : ''}`
    : `${i + 1}. break ${st.rock} (wait ${st.wait})`)).join(' · ');

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
    if (run.entities('pushables') === null) return null;
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
        const parkedRow = (run.world.pushables ?? []).find((p) => p.id === derived.parked.blockId);
        const parkedByRecord = Boolean(parkedRow)
            && Math.floor(parkedRow.x / TILE_SIZE) === derived.parked.from.tx
            && Math.floor(parkedRow.y / TILE_SIZE) === derived.parked.from.ty;
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
                /**
                 * ⛓ R9 SLICE L15 — `0` ONLY WHEN THE LEVEL RECORD PUT IT THERE.
                 * A block a route of THIS run parked on the presser (L15's) is
                 * reported `null`: the run does not carry the tick a block came
                 * to rest, and a `0` would say "never moved" about a block the
                 * trace shows being shoved three times.
                 */
                sinceTick: parkedByRecord ? 0 : null,
            },
            dwell: {
                ticks: hold.ticks,
                until: hold.until,
                why: `${derived.parked.blockId} ${parkedByRecord ? 'was parked on' : 'was '
                    + 'SHOVED this visit onto'} `
                    + `${presser.tag}@${presser.x},${presser.y}${parkedByRecord
                        ? ' before the first tick' : ' by this run\'s own route'} and is `
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
    const stance = plan.route
        ? plan.route[0].stance
        : nodeCentre(plan.from.tx - step.dx, plan.from.ty - step.dy, DEFAULT_LATTICE);
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
            to: plan.route ? { ...plan.route[0].to } : { ...onto },
        },
        k: plan.k,
        stance,
        ...(plan.route ? { route: plan.route } : {}),
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
        const live = run.entities('pushables')?.get(row.id);
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
        /**
         * ⛓⛓⛓ R9 SLICE L15 — WHERE ONE LEAN CANNOT, THE ROUTE SEARCH IS ASKED
         * (§54.4, ⚖ 65 (a)). The one-lean arithmetic below is kept as the
         * RECORD's vocabulary — every committed `weigh` is a one-lean room and
         * its rows are the bytes they were — and each of its three refusals
         * (off-axis, stance, blocked cell) now hands the block to
         * `deriveBlockRoute` with the `press` goal before giving up. The
         * refusal row STAYS (it is a true sentence about one shove); the plan
         * carries the route. L16 is the room this was measured on: E1, a rock,
         * then N2 — three orders, none of them a single lean.
         */
        const orRoute = (reason) => {
            rejected.push(reason);
            const r = deriveBlockRoute(run, row, { kind: 'press', onto }, contacts, blocked);
            if (!r.steps) {
                if (r.refused?.bound) {
                    throw new SolverRefusal(`solverBot: the block-route search for ${row.id} `
                        + `onto (${onto.tx},${onto.ty}) in level ${run.level} hit `
                        + `\`${r.refused.bound}\` — ${r.refused.why}`,
                    { obstacle: { kind: 'solid', id: row.id },
                        bound: blockRouteBound(r, row, 'press') });
                }
                return;
            }
            if (r.steps.length === 1) {
                fail(`solverBot deriveWeigh(${row.id}): the search found a ONE-lean route `
                    + `${r.steps[0].dir} k=${r.steps[0].k} where the one-lean arithmetic `
                    + `refused (${reason.why.slice(0, 80)}…) — the two have parted`);
            }
            const lean = r.steps.find((st) => st.verb === 'shove');
            if (!lean) return; // a press route always leans — the block must ARRIVE
            found.push({ blockId: row.id, dir: lean.dir, dirIndex: lean.dirIndex,
                k: lean.k, from, route: r.steps });
        };
        if (!dir) {
            orRoute({
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
            orRoute({
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
            orRoute({ option: `weigh ${dir} k=${k} with ${row.id}`, why: blockedAt });
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
    // ⛓ R9 slice L15: a one-lean answer outranks any route; among routes,
    // the search's own cost already chose, so fewer orders first.
    found.sort((a, b) => (a.route?.length ?? 1) - (b.route?.length ?? 1)
        || a.k - b.k || a.dirIndex - b.dirIndex
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

/**
 * The solver's planning options: the FULL bag, volumes on, live keys.
 * ⛓ Swim S1, D1: `inventory` and `noHazards` are the DRIVER's `planNow` bag —
 * without them `plannerObstacleAt` priced every water tile as a wall whether or
 * not the boot granted the conch (`procgenSwimSolver.test.js`).
 */
/**
 * ⛓⛓⛓ SEEDLING FIDELITY STEP-OFF, D3 — **WHERE TO STAND OFF A LATCHED DOOR.**
 * The centres of the tiles ringing the door's rect, nearest the player first,
 * that are STANDABLE (`isWalkableTile` with no teleporter allowed, so the cell
 * is never another door) and that the planner routes TO — a route that ENDS on
 * the cell (the planner snaps an unstandable aim to a nearby node, which in a
 * pocket is the door itself). Null when none can: the door is `closed`.
 * The same ring the JS arc's walker steps to (`jsRuntimeWalker.stepOffPoint`),
 * asked with the solver's own plan bag.
 */
export function stepOffCellFor(run, index, planOpts) {
    const world = run.world;
    const r = world.teleporters[index].rect;
    const tx0 = Math.floor(r.x / TILE_SIZE) - 1;
    const ty0 = Math.floor(r.y / TILE_SIZE) - 1;
    const tx1 = Math.floor((r.right - 1) / TILE_SIZE) + 1;
    const ty1 = Math.floor((r.bottom - 1) / TILE_SIZE) + 1;
    const from = run.state;
    const cells = [];
    for (let ty = ty0; ty <= ty1; ty += 1) {
        for (let tx = tx0; tx <= tx1; tx += 1) {
            const x = tx * TILE_SIZE + TILE_SIZE / 2;
            const y = ty * TILE_SIZE + TILE_SIZE / 2;
            // ⚠ OFF the door, by the latch's own test: the run's sensed contacts
            // exempt the volume it stands in, so the planner alone would offer
            // the door's own tile back.
            if (rectsOverlap(playerBoxAt(x, y), r)) continue;
            if (!isWalkableTile(world, tx, ty, null, { ...planOpts, lattice: TILE_SIZE, nodeMargin: 0 })) continue;
            cells.push({ x, y, d: (x - from.x) ** 2 + (y - from.y) ** 2 });
        }
    }
    cells.sort((a, b) => a.d - b.d);
    for (const { x, y } of cells) {
        try {
            // The door stays allowed: the route STARTS on it.
            const end = planWaypoints(world, from, { x, y }, index, planOpts).at(-1);
            if (end && end.x === x && end.y === y) return { x, y };
        } catch (e) {
            if (!(e instanceof BotDriverV2Error)) throw e;
        }
    }
    return null;
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY STEPOFF2, D1 — **THE MINIMAL STEP-OFF: a sub-pixel
 * hold along one axis, not a walk to a tile centre.** The game's rule
 * (STEP-OFF D1, measured on two teleporters and one stairs door): the latch
 * clears on ONE door update the player box does not overlap the 16x16 rect
 * (positive-area, so edge-touching is off), and 0.05 px off suffices. So the
 * cheapest step-off holds ONE direction from the arrival until the post-move
 * box first clears the rect — the door's next update (the walk back's first
 * tick) releases the latch.
 *
 * Each direction is previewed with the run's own stepper (`previewStepper`)
 * and `chooseHeld` toward an aim 16 px past the clearing line on that axis —
 * the same choice the drive makes — for at most `STEP_OFF_MAX_TICKS`. A
 * direction is REJECTED by name when the box never clears (a wall or the map
 * edge stops it), when the stepper starts a fall, crosses a door, dies, or
 * puts the player in water without the conch or lava without the dark suit
 * (`hazard` names which). Cardinals first; the diagonals only when no
 * cardinal clears. The danger probe is the solve's own (the caller's).
 *
 * Returns every candidate, cheapest first: `{dir, aim, ticks, at}` (`ticks`
 * holds, `at` the first off position) or `{dir, aim, rejected: why}`.
 */
export const STEP_OFF_MAX_TICKS = 60;
const STEP_OFF_DIRS = Object.freeze([
    ['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0],
]);
const STEP_OFF_DIAGONALS = Object.freeze([
    ['up-left', -1, -1], ['up-right', 1, -1], ['down-left', -1, 1], ['down-right', 1, 1],
]);
export function stepOffMinimalFor(run, index, tolerance = DEFAULT_TOLERANCE) {
    const r = run.world.teleporters[index].rect;
    const s0 = run.state;
    // The clearing line on each axis: the centre at which the box's far edge
    // touches the rect's near edge (`playerBoxAt`'s own geometry).
    const clearX = (dx) => (dx < 0 ? r.x - (HITBOX.width - HITBOX.originX) : r.right + HITBOX.originX);
    const clearY = (dy) => (dy < 0 ? r.y - (HITBOX.height - HITBOX.originY) : r.bottom + HITBOX.originY);
    const off = (st) => !rectsOverlap(playerBoxAt(st.x, st.y), r);
    const inventory = run.progress('inventory');
    const tryDir = ([dir, dx, dy]) => {
        const aim = {
            x: dx === 0 ? s0.x : clearX(dx) + dx * TILE_SIZE,
            y: dy === 0 ? s0.y : clearY(dy) + dy * TILE_SIZE,
        };
        const step = run.previewStepper();
        let st = { ...s0 };
        for (let k = 0; k <= STEP_OFF_MAX_TICKS; k += 1) {
            if (off(st)) return { dir, aim, ticks: k, at: { x: st.x, y: st.y } };
            try {
                st = step(st, chooseHeld(st, aim, tolerance));
            } catch (e) {
                if (!(e instanceof PhysicsV2Error)) throw e;
                return { dir, aim, rejected: `dies: ${e.message.slice(0, 80)}` };
            }
            if (st.transition) return { dir, aim, rejected: `crosses to level ${st.transition.to_level}` };
            if (st.fall) return { dir, aim, rejected: `falls at (${st.x},${st.y})` };
            // ⚠ Hazard floor without its item (`checkDrowning`: water without
            // the conch, lava without the dark suit) — the step-off is not
            // spent drowning, even when eleven ticks would not yet kill.
            if (st.hazard?.inLava && !inventory?.hasDarkSuit) {
                return { dir, aim, hazard: 'lava', rejected: `enters lava at (${st.x},${st.y})` };
            }
            if (st.hazard?.inWater && !inventory?.canSwim) {
                return { dir, aim, hazard: 'water', rejected: `enters water at (${st.x},${st.y})` };
            }
        }
        return { dir, aim, rejected: `the box is still on the rect after ${STEP_OFF_MAX_TICKS} ticks `
            + `(stopped at (${st.x},${st.y}): a wall or the map edge)` };
    };
    const byCost = (a, b) => (a.rejected ? 1 : 0) - (b.rejected ? 1 : 0) || (a.ticks ?? 0) - (b.ticks ?? 0);
    const cardinal = STEP_OFF_DIRS.map(tryDir).sort(byCost);
    if (cardinal.some((c) => !c.rejected)) return cardinal;
    return [...STEP_OFF_DIAGONALS.map(tryDir).sort(byCost), ...cardinal];
}

function solverPlanOpts(run, contacts, extra = {}) {
    return {
        liveBag: run.liveGeometryOpts(),
        avoidVolumes: true,
        keys: run.progress('keys'),
        contacts,
        lattice: DEFAULT_LATTICE,
        inventory: run.progress('inventory'),
        noHazards: run.noHazards,
        ...extra,
    };
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY FRONTIER3 — **THE PLANNER ROUTES THROUGH WHAT THE
 * PIXEL MASK LETS THROUGH**, at the two places the 16 px lattice said it did
 * not.
 *
 * The geometry was never the problem: `plannerBlockerAt` has tested a
 * pixelmask PER PIXEL since R2, exactly as `collidesSolid` does. What
 * over-claimed was WHERE the planner asked:
 *
 *  · a reach-exit walked at its trigger's CENTRE. L62's `teleporter@112,64`
 *    sits in `building6`'s doorway, a 13 px niche whose clear player
 *    positions are y 74–81: the centre (120,72) is wall, so the goal
 *    refused before the A\* ran (`exitAimFor`). Measured over every door of
 *    the delivered set: the ONLY trigger whose centre is inside a mask (the
 *    other nine blocked centres are solids with verbs or gates).
 *  · the A\* lattice is the tile grid, so a corridor two tiles wide with a
 *    half-tile-offset solid in its middle has NO clear node centre although
 *    the player fits either side of it. L62's pit maze is that corridor:
 *    `planttorch@120,152` leaves 8 px each side and both lattice centres
 *    (x 120, x 136) hit it. The 8 px lattice (R2's own pitch, centres at
 *    x ≡ 4 mod 8) puts nodes at x 116 and x 140 (`FINE_LATTICE`).
 *
 * ⛔ BOTH ARE ASKED ONLY WHERE THE OLD ANSWER WAS A REFUSAL, so every plan
 * that solved before is the plan it was: the aim moves only off a centre a
 * MASK blocks (which `planTilePath` refused by name), and the fine lattice is
 * tried only when the frontier found no verb to apply (the refusal path of
 * `identifyAndSelect`) — and only under its grant (`FINE_LATTICE_ROSTER_WIDE`,
 * on since the wave-6 harvest; `fineLattice: false` turns it off per call).
 */
export const FINE_LATTICE = TILE_SIZE / 2;

/**
 * ⛓ THE FINE-LATTICE RETRY IS ON (⚖ licensed by the user, 2026-10-05, at the
 * wave-6 harvest). It moved one row of the identity block:
 * `census-seedling-enemies`' generated `lavatrap@corridor` chamber row went
 * REFUSED → SOLVED (153 t), so the `ENEMY census default` digest moved
 * (re-banked at the harvest). No committed tape, expectation or producer
 * `--check` moved. `solveSegment`'s optional `fineLattice` is still the
 * per-call grant (`false` turns the retry off for one call), the way
 * `economies` is; this constant is the roster-wide default.
 */
export const FINE_LATTICE_ROSTER_WIDE = true;

/**
 * The point a reach-exit walks at: the trigger's centre, or — when the player
 * box at the centre hits a PIXELMASK — the nearest integer position whose box
 * overlaps the trigger and is clear for the planner (ties: lower y, then lower
 * x). A centre blocked by anything else is returned unchanged: a solid there
 * is an obstacle with a verb (a lock, a tree, the seal door), and the
 * frontier must still name it.
 */
export function exitAimFor(world, index, opts = {}) {
    const tp = world.teleporters[index];
    const centre = { x: tp.rect.x + TILE_SIZE / 2, y: tp.rect.y + TILE_SIZE / 2 };
    const at = plannerObstacleAt(world, centre.x, centre.y, index, opts);
    if (!at || at.kind !== 'pixelmask') return centre;
    let best = null;
    for (let y = tp.rect.y - TILE_SIZE / 2; y <= tp.rect.bottom + TILE_SIZE / 2; y += 1) {
        for (let x = tp.rect.x - TILE_SIZE / 2; x <= tp.rect.right + TILE_SIZE / 2; x += 1) {
            if (!rectsOverlap(playerBoxAt(x, y), tp.rect)) continue;
            if (plannerObstacleAt(world, x, y, index, opts) !== null) continue;
            const d = Math.hypot(x - centre.x, y - centre.y);
            if (best === null || d < best.d
                || (d === best.d && (y < best.y || (y === best.y && x < best.x)))) {
                best = { x, y, d };
            }
        }
    }
    return best ? { x: best.x, y: best.y } : centre;
}

/**
 * ⛓⛓ SEEDLING FIDELITY FRONTIER3 — **A WALL WITH NO VERB, WHOSE OPENER IS
 * NOT IN THIS ROOM, IS A GATE AND IS NAMED AS ONE.** Asked only for an
 * obstacle with no strategy row, so it changes the refusal's words and never
 * a solve. `null` for everything else (it stays *"No strategy row exists"*).
 *
 *  · `finaldoor` — ITEM gate. `FinalDoor.update` opens only for a player
 *    within `seeDistance` when `SealController.hasAllSealParts()` (the LAST
 *    of the 16 Seal slots is filled) AND the Watcher's L114 tag-0 flag is
 *    cleared; the model steps it (`levelRun.stepFinalDoorsNow`,
 *    `r6-final-door`). The route's `Seal@16` rule is the same gate.
 *  · `rocklock` — `RockLock` is an `Activators` lock outside the model's
 *    activator roster (`activators.js`'s note: its `set activate` only stores
 *    the flag). With a `FinalBoss` in the room and no presser, its only
 *    opener is the boss's `dead` arm (`Button.activateAll(null, 0, true)` and
 *    `setPersistence(tag + 1)`, `FinalBoss.as`): an ENCOUNTER gate (L112).
 *    Without one (L26's kill-lock, `tset -1`) the opener is
 *    `totalEnemies() == 0` (`RockLock.as:52`), which `kill`'s kill-lock arm
 *    cannot reach because it reads the activator roster.
 */
export function obstacleGateFor(run, obstacle) {
    if (obstacle?.kind !== 'solid') return null;
    if (obstacle.tag === 'finaldoor') {
        return {
            gate: 'ITEM',
            why: 'the seal door opens only on approach for a player holding all 16 Seal parts '
                + '(`SealController.hasAllSealParts()`: the last slot filled) who has talked to the '
                + 'Watcher (L114 tag 0 cleared) — `FinalDoor.update`; the route\'s `Seal@16` rule. '
                + 'The work order is the item, not the room.',
        };
    }
    if (obstacle.tag === 'rocklock') {
        const bosses = run.world.finalBosses ?? [];
        if (bosses.length > 0 && (run.world.pressers ?? []).length === 0) {
            const boss = bosses[0];
            return {
                gate: 'ENCOUNTER',
                why: `no presser in level ${run.level} publishes its group; its opener is `
                    + `${boss.id ?? 'the FinalBoss'}'s death (the \`dead\` arm: `
                    + '`Button.activateAll(null, 0, true)` and `setPersistence(tag + 1)`, '
                    + '`FinalBoss.as`). The work order is the fight, not the room.',
            };
        }
        return {
            gate: 'ENCOUNTER',
            why: 'a `RockLock` kill-lock opens when `totalEnemies() == 0` (`RockLock.as:52`), and '
                + 'it is outside the model\'s activator roster, so the `kill` verb\'s kill-lock arm '
                + 'cannot be asked about it. The work order is the room\'s enemies.',
        };
    }
    return null;
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
     * R8's untracked planning record as the free oracle it is.
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
        { avoidVolumes: true, keys: run.progress('keys') }));
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
 *
 * ⛓⛓⛓ **FLIPPED TO `true` AT R9 SLICE 12e′'s RE-RUN, UNDER ⚖ RULINGS 41 + 49
 * + 50, AND IT IS ONE HALF OF ONE SERIES.** ⚖ Ruling 42's tail: the flip and
 * the re-record of the corridors it re-prices are never apart on a pushed head
 * — at `true` with nothing re-recorded, `solve-seedling-r9-campaign --check`
 * is RED by name on every segment the planner now dashes (12c′ measured 26
 * failures). So this commit is red BY NAME and BY DESIGN until the pipeline
 * has re-authored the thirteen tapes ⚖ 49 licenses.
 *
 * ⛔ WHAT IT DOES NOT MEAN. It is still the PERMISSION and not the choice, and
 * the two things that made an earlier flip a regression are both gone: the
 * opportunistic dash was RETIRED at 12c′ (§27.7's 400 t removed at its source)
 * and the planner primitive `planSwordDash` decides press by press. Table (D′)
 * — §34.7, thirteen rows, every one the MODEL's word until S1 asks the game —
 * is what this state was measured to buy.
 */
/**
 * ⛓⛓⛓ R9 SLICE 12i — **AND IT IS A THREE-STATE KNOB NOW, NOT A BOOLEAN**
 * (user, 2026-08-27: *"Yes, I want to implement the dash settings. Next time
 * we do a full record, I might want to change the default to no dashing, if
 * it makes that much of a difference."*).
 *
 * `none` — the window pass is not asked at all and `allowDash` is `false`:
 *   exactly the pre-flip roster, and the arm a `none` default would adopt.
 * `full` — the pass considers ONE candidate, the whole `DASH_CHAIN_PATTERN`.
 * `all`  — every prefix of it (⚖ ruling 45(b)), which is TODAY'S DEFAULT and
 *   the state every committed tape was recorded under.
 *
 * ⛔⛔ **THE DEFAULT IS THE USER'S, AND IT IS `all` (⚖ ruling 42's PERMISSION,
 * ⚖ ruling 40's "a re-record is a checkpoint event").** Moving it re-plans the
 * 205 dashes on 16 tapes §42.7 counts, which is a re-record decision taken at
 * a full record — never a side effect of a code change. What 12i adds is the
 * ABILITY to ask, per run, at no cost to the recorded roster.
 */
export const DASH_MODES = Object.freeze(['none', 'full', 'all']);

/** @see DASH_MODES — the roster's own state, and the one every tape carries. */
export const DEFAULT_DASH_MODE = 'all';

/**
 * ⛔ A MODE OUTSIDE THE SET IS A `fail()` BY NAME, NEVER A FALLBACK. A fallback
 * reinstates the defect it replaced: `--dash=nome` would silently plan under
 * `all` and the header would say so, which is the exact shape of a run whose
 * trace lies about what planned it.
 */
export function assertDashMode(mode, where = 'assertDashMode') {
    if (!DASH_MODES.includes(mode)) {
        fail(`${where}: \`${mode}\` is not a dash mode. The three states are `
            + `${DASH_MODES.join(' | ')} — \`none\` does not ask the window pass at all, `
            + '`full` asks it with the whole chain, `all` asks it with every prefix '
            + '(⚖ ruling 45(b)). There is no fallback: a mode nobody spelled is a run '
            + 'whose header would name a plan it did not make.');
    }
    return mode;
}

/**
 * ⛓⛓⛓ R9 SLICE 12j, ⚖ RULING 61 (ii) — **THE ECONOMIES GET A CONSTANT OF
 * THEIR OWN, BECAUSE THE YOKE THEY RODE IN ON WAS A RELEASE GATE AND NOT A
 * STATEMENT ABOUT WHAT THEY ARE.**
 *
 * ⚖ 46's collect stance (the `scored`/`nearest`/`tier` choice where the
 * committed core short-circuits on `(d, y, x)`) and ⚖ 47's early walk
 * (`remaining`, and an `earlyWalk` key that is ABSENT rather than `null`)
 * are ONE permission — `economies`, threaded the §40.3 way to
 * `solveSegment`'s three `ctx` construction sites and to `deriveStance`.
 * What they are NOT, and never were, is dashing.
 *
 * ⛔ THE HISTORY, BECAUSE IT IS THE WHOLE ARGUMENT. ⚖ Ruling 54 (5) shipped
 * both economies behind `ALLOW_DASH_ROSTER_WIDE` as their RELEASE GATE
 * (§40.3): the flag was `false` on `main`, their rows ran by handing the
 * permission directly, and ⚖ 41's flip released the dash and the economies
 * in one commit. **That gate has done its job** — the flag went `true` and
 * the whole roster is recorded under it. The yoke it left behind is inert
 * only while the dash default stays non-`none`, and 12i measured what it
 * costs when it is not: §49.5's column C (YOKED) and column D (DASH-ONLY)
 * differ on FIVE of seven producers, and §49.4 found the yoke had already
 * mis-attributed the two bulk rows' 4× to dashing when ~80 % of it is this
 * constant's economy. ⛓ **A flip that turns on two things prices them as
 * one**, and the attribution goes to whichever the commit message names.
 *
 * ⛓ SO THERE IS ONE CONSTANT PER PERMISSION NOW, AND THEY MOVE
 * INDEPENDENTLY: `--dash=` and `DEFAULT_DASH_MODE` price the window pass
 * ALONE, and this constant prices the economies alone.
 *
 * ⛔ IT WAS `true`, AND MOVING IT WAS THE USER'S (⚖ 42) — a re-record, not a
 * code change. ⛓⛓⛓ **THE USER MOVED IT** (⚖ 63 (c), 2026-08-28: *"I think I
 * would prefer to change it to off next time we do a re-record"*, executed
 * whole at ⚖ 64): it is `false` from R9 slice RR, landed inside the run that
 * re-recorded the artifacts below. ⇒ ⚖ 46's collect-stance scoring and ⚖ 47's
 * early walk are OFF roster-wide, and the committed corridors are the ones the
 * first-fit order produces.
 *
 * ⛓⛓ AND THE CENSUS IS RE-MEASURED HERE, BECAUSE THE OLD ONE IS ABOUT A
 * ROSTER THAT NO LONGER EXISTS. `solveSegment`'s `economies` docblock counts
 * `r8-solve-10` 90 → 89 · `r8-solve-20` 365 → 332 · `r8-d2-19` 864 → 807 ·
 * `r8-d2-20` 781 → 756. Every one of those is a PRE-RE-RECORD number: they
 * were measured on `main` before ⚖ 41's flip, with the dash OFF, and the
 * roster was re-recorded at the flip. Cutting the yoke is exactly what makes
 * the question askable at THIS head, so 12j asked it — one constant flipped,
 * `DEFAULT_DASH_MODE` left at `all`, the same `2>&1 | md5sum` method:
 *
 *   · `r8-solve-10`     78 → 83    (`solve-seedling-r8-battery`, and the
 *                                   campaign chain 3326 → 3331 with it)
 *   · `r8-solve-18`    410 → 485   (`solve-seedling-r8-l18`)
 *   · `r8-solve-20`    229 → 257   (`solve-seedling-r8-d2`)
 *   · `r8-d2-19`       721 → 746   (`solve-seedling-r8-d2-chain`)
 *   · `r8-d2-20`       554 → 560   (`solve-seedling-r8-d2-chain`)
 *   · the `r8-d2` headline 1685 → 1791, and its
 *     *"the headline's first 410 ticks ARE r8-solve-18's walk"* row parts at
 *     tick 292 — the tick the fade used to be stood through
 *   ⇒ FIVE of the seven producer `--check` md5s move; `r8-tail` and
 *     `r9-l3` do not, which is the same pair §49.5 finds unmoved by the dash.
 *
 * ⛔⛔ **AND THIS CENSUS SAID FOUR UNTIL R9 SLICE RR, WHICH IS THE SLICE THAT
 * SPENT IT.** `r8-d2-19` and `r8-d2-20` were missing from it, from §50.2 and
 * from ⚖ 61 (ii)'s list — every surface that quoted the number quoted FOUR.
 * They are the d2 chain's own SEGMENTS, and a census assembled per PRODUCER
 * rather than per ARTIFACT drops them, because the chain producer's headline
 * is the row a reader's eye lands on. The list above is now the `DRIFT` lines
 * of the seven producers' own `--check` at the flipped constant, which is a
 * derivation rather than a reading: SIX artifacts, twelve files (each tape and
 * its trace sidecar). ⛓ The chain re-coheres at the record — 485 + 746 + 560 =
 * 1791 — and the pre-record `sum(segment ticks)` refusal naming 1716 is the
 * committed lengths disagreeing with the solver, which is exactly what a
 * re-record is for.
 *
 * ⛔ THE SIGN IS THE OTHER WAY ROUND FROM THE OLD CENSUS AND THAT IS NOT A
 * CONTRADICTION: an economy SAVES ticks, so turning it off adds them. The old
 * list reads "what landing them did"; this one reads "what removing them
 * does", at a head where they have already landed.
 *
 * ⛓ RETIRES `ALLOW_DASH_ROSTER_WIDE` (12j). That name carried five reads and
 * only two of them were ever about the dash; §49.2's census is what split it.
 */
export const ECONOMIES_ROSTER_WIDE = false;

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
export function strikePolicyFor(run, { dashPlan = null,
    dashMode = DEFAULT_DASH_MODE } = {}) {
    assertDashMode(dashMode, 'strikePolicyFor');
    const hasSword = run.progress('inventory')?.hasSword || run.progress('inventory')?.hasGhostSword || false;
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
    if (!dashPlan && (run.entities('strikeBodies') ?? []).length === 0) return null;
    return createStrikePolicy({
        facingToward, facingKeys: FACING_KEYS, hasSword, dashPlan,
        /**
         * ⛓ R9 SLICE 12i — the boolean the policy enforces is now a QUESTION
         * ABOUT THE MODE, asked in one place. A handed plan is still its own
         * grant (`dashPlan ? true`), which is what lets an offline proof run
         * at a `none` head.
         */
        allowDash: dashPlan ? true : dashMode !== 'none',
        /**
         * ⛓⛓⛓ R9 SLICE 12e‴ (⚖ RULING 53) — the talk circles, from the run,
         * at the ONE construction site so the preview and the drive refuse
         * identically (⚖ ruling 30(c)). A press whose RELEASE would land
         * inside one opens a placed NPC's dialogue — `NPCs/NPC.as:191` reads
         * the SWORD key — and that is a freeze, not a cost: the policy
         * refuses rather than prices it.
         */
        talkCircles: run.entities('talkCircles') ?? [],
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
export function previewWalk(run, wps, tolerance = 0,
    { strike = null, standFor = 0, axisAligned = false, stall = null,
        /**
         * ⛓ SEEDLING FIDELITY L14 — an OPT-IN early stop: `(sample) => boolean`,
         * asked of each transit sample as it is taken; `true` ends the preview
         * there with `truncated.kind === 'stopped'`. The DETOUR search previews
         * hundreds of candidates and needs only each one's FIRST danger, which
         * on L16 lands ~40 ticks into a ~220-tick walk. `null` (every other
         * caller) changes nothing.
         */
        stopWhen = null } = {}) {
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
     * ⛓⛓⛓ U15-swim D2 — **AND THE TURRETS AND THEIR SPITS ADVANCE ON IT TOO**:
     * a turret aims at the previewed player and re-arms when the walk leaves its
     * range, so the spits at a sample's tick are the walk's own. `null` in a room
     * with no turret, so every other preview is byte-identical.
     */
    const spitForecast = run.spitForecast?.() ?? null;
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY LADDER2 — **AND THE PLACED GRENADES ADVANCE ON IT
     * TOO**: a dormant grenade is armed by the PREVIEWED player coming within
     * 32 px, and its blast lands a fixed fuse later, so whether a sample is
     * blasted is a function of the walk. `null` in a room with no grenade.
     */
    const grenadeForecast = run.grenadeForecast?.() ?? null;
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
    let bodiesForPolicy = strike ? (run.entities('strikeBodies') ?? []) : null;
    /**
     * ⛓ R9 slice 12c‴ — every body a PLANNED press's window struck, in the
     * order it struck them. See the push site for why it is the application and
     * not the aim.
     */
    const plannedStruck = [];
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
    const slashLive = strike ? run.progress('slashInfo') : null;
    let slashState = slashLive ? slashLive.state : null;
    /**
     * ⛓⛓⛓ R9 SLICE 12c‴ — **THE PREVIEW'S OWN SWORD WINDOW**, threaded exactly
     * as `slashState` is and stepped by the same `presses.swordWindowStep` the
     * run steps its own with.
     *
     * ⛔ IT STARTS EMPTY, AND THAT IS A CLAIM RATHER THAN A DEFAULT. A preview
     * begins where `drive` is about to commit its keys for the next tick, and a
     * thrust live at that moment is one the RUN has already scheduled and will
     * apply itself — `run.slashInfo` carries the gate and the timer, which is
     * everything a press decision needs, and there is no reading of a pending
     * thrust for the preview to inherit. ⚠ A rung that gives the preview a
     * mid-window start owes this line the run's live window.
     */
    let swordWindow = EMPTY_SWORD_WINDOW;
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
    const combatBefore = (state, at, walkHeld, bodiesNow) => {
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
        /**
         * ⛓⛓⛓⛓ R9 SLICE 12c‴ — **THE SWORD WINDOW, STEPPED HERE, BY THE SAME
         * FUNCTION `levelRun.advance` STEPS IT WITH** (⚖ rulings 17 and 30(c)).
         *
         * ⛔⛔ WHAT THIS REPLACES AND WHY IT WAS WRONG. The preview used to
         * model a press as ONE `chasers.hit` at the PRESS TICK. The run applies
         * the pending thrust at the TOP OF THE FOLLOWING tick and then runs four
         * more tests, each with the rect recomputed from the LIVE position.
         * §29.5 measured what that cost once ⚖ ruling 44's harmless window
         * turned a 30-tick-wide refusal into a THRESHOLD on `hitsTimer`: the two
         * sides read that value one apart, so one press per i-frame is spent by
         * one side and yielded by the other, and the equality parted at 79.
         *
         * ⛓⛓⛓ **AND THE GAME SETTLED WHICH SIDE IS WRONG** — not this model
         * arguing with itself. `probe-seedling-r9-harmless-window-mobiles.mjs`
         * inverts a struck body's own `hits_timer` out of the game's `botMobiles`
         * readout: three independent samples all put the landed hit at PRESS + 1.
         * The drive's convention is the game's.
         *
         * ⛔ THE CURE IS THE ORDER AND THE REPEATS, NOT A LAG. A scratch build
         * that merely DEFERRED the single previewed hit by one tick measured
         * WORSE (the parting fell 79 → 62): deferring one shot leaves the four
         * re-aimed tests missing, so the previewed room becomes a third room
         * that is neither side's.
         *
         * ⛔ THE ORDER IS `advance`'s, and the two things that make it that are
         * both above: the BODIES have already stepped this tick (`chasers.step`
         * runs at the top of the loop, as `stepChasersNow` runs above
         * `slashTimerTick`), and the PLAYER has not (`stepV2` is below this
         * call, as it is below the thrust in the run). So the rect is taken from
         * the PRE-MOVE player against POST-STEP bodies — the game's own pairing.
         */
        const fired = swordWindowStep(swordWindow, at);
        swordWindow = fired.window;
        for (const thrust of fired.fires) {
            if (thrust.weapon !== 'sword' || !chasers) continue;
            /**
             * ⛓ `slash()`'s TWO GATES, in the game's order: `collideRectInto`
             * against `getSlashRect()` first, then `distanceRectPoint` against
             * `slashingSprite.width * scaleX`. Both read the THRUST's scale, not
             * the run's current state, because the four repeats are the SAME
             * swing re-aimed — a press landing inside another press's window
             * must not retroactively re-scale the earlier one's tests.
             */
            const rectNow = slashRect(state.x, state.y, thrust.direction, thrust.scale);
            const reachLimit = slashReachFor(thrust.scale);
            for (const b of bodiesNow ?? []) {
                if (!rectsOverlapLocal(rectNow, b.rect)) continue;
                if (distanceRectPoint(state.x, state.y, b.rect) > reachLimit) continue;
                /**
                 * ⛔ THE RECEIVER DECIDES. `chasers.hit` runs `enemyHit`, whose
                 * own five gates refuse an i-framed body, a dying one and a
                 * destroyed one — which is why tests 2..5 of a press are no-ops
                 * against the body test 1 struck, and why a DIFFERENT body that
                 * walks into the rect on tick 3 is hit for real.
                 */
                chasers.hit(b.id, state);
                if (thrust.planned) plannedStruck.push({ tick: at, id: b.id });
            }
        }
        let dashImpulse = null;
        if (decision && decision.decision === STRIKE_PRESS) {
            const r = slashSet(slashState, {
                pressed: true,
                ...gate,
                direction: state.direction ?? 0,
            });
            slashState = r.state;
            if (r.outcome === 'slash' || r.outcome === 'dash') {
                slashEndsAt = at + SLASH_ANIM_TICKS[slashState.anim];
                /**
                 * ⛓⛓ THE REPLACEMENT AND THE SCHEDULE, in `advance`'s own two
                 * places: `play(anim, true)` restarts the animation so the
                 * earlier window's remaining tests are dropped, and the press's
                 * own thrust is scheduled for the TOP OF THE NEXT TICK.
                 *
                 * ⚠ `planned` RIDES ON THE THRUST so `plannedStruck` above can
                 * tell a MOVE's hit from a STRIKE's — and it rides through the
                 * four repeats too, because `swordWindowStep` spreads the
                 * pending thrust into them.
                 */
                swordWindow = swordWindowReplace(swordWindow);
                swordWindow = swordWindowSchedule(swordWindow, {
                    weapon: 'sword',
                    direction: r.slashDirection,
                    pressTick: at,
                    anim: slashState.anim,
                    scale: slashScaleFor(slashState.anim),
                    planned: decision.planned === true,
                });
            }
            if (r.outcome === 'dash') dashImpulse = r.impulse;
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
    /**
     * ⛓⛓ SEEDLING SWIM U4, D2 — **A PREVIEW THAT WALKS ONTO LETHAL FLOOR IS A
     * TRUNCATED PREVIEW, NOT AN ENGINE THROW.**
     *
     * Measured on the corridor-body sweep's 10 THREW post-sword cells (U3's
     * "pit class"; 6 pits and 4 drownings, replayed with a trace): every one
     * came out of a PREVIEW, not the walk. `deriveRefuge` previews a straight
     * walk to each clear cell (`open` 14x14 s5: `right+down` held at
     * (42.5,79.1)), the walk cut a corner onto a pass-2 `pit-patch` tile in level 900,
     * and 20 ticks later the preview's own step reached `fallDestination`,
     * whose `PhysicsV2Error` ("that pit is lethal floor, not transport")
     * escaped the solve and aborted the whole generation. The fall is
     * irreversible from its first tick (`step` drops the keys), so the walk
     * is dead where it BEGINS. The question is the model's own —
     * `fallDestination`, the function the step would call 20 ticks later —
     * asked when the fall starts, and a lethal answer ends the preview with
     * `kind: 'lethal-pit'`. Every caller already reads a truncated preview as
     * a walk it cannot take (a refuge or strike candidate is skipped, a
     * stance is rejected), and a transport pit keeps its old path to
     * `crossed`.
     *
     * ⛓ AND THE SAME SWEEP'S OTHER THROW IS THE SAME SENTENCE ON WATER. Four
     * of the cells threw *"the player DROWNED in level 900"* from the same
     * straight-line preview over a pass-2 `water-pool`. `checkDrowning`
     * LATCHES `drown.drowning` after eleven cumulative ticks (`drownTimer` is
     * never reset off-hazard) and `drown()` then runs to `die()` whatever is
     * held, so a preview whose state latches it has died where it latched —
     * `kind: 'drowned'`. A drown already latched when the preview STARTS is
     * the live run's, not this candidate's, and is left to the run.
     */
    const drowningAtStart = run.state.drown?.drowning === true;
    const lethalFloorOf = (state) => {
        if (!drowningAtStart && state.drown?.drowning === true) {
            return {
                kind: 'drowned',
                at: { x: state.x, y: state.y },
                why: `the preview LATCHED DROWNING at (${state.x.toFixed(1)},${state.y.toFixed(1)}) `
                    + `in level ${run.level} — \`checkDrowning\`'s cumulative timer ran out on `
                    + 'unprotected water or lava, and `drown()` runs to `die()`',
            };
        }
        if (!state.fall || state.fall.phase !== 'out') return null;
        try {
            fallDestination(run.world, state.fall.target);
            return null;
        } catch (e) {
            if (!(e instanceof PhysicsV2Error)) throw e;
            const t = state.fall.target;
            return {
                kind: 'lethal-pit',
                at: { x: state.x, y: state.y },
                why: `the preview fell into a LETHAL pit — the tile at (${t.x},${t.y}) in `
                    + `level ${run.level}, which has no control block, so the fall is a `
                    + 'death and not transport (`fallDestination`)',
            };
        }
    };
    let wpIndex = -1;
    /**
     * ⛓⛓ U15-swim D2 — **A STALL INSIDE THE WALK** (`stall: {at, ticks}`): at
     * walk-offset `at` the player stands `ticks` ticks with NO walk keys, then
     * the walk resumes. The DODGE rung's question — a turret's clock and aim
     * are the walk's, so standing a few ticks inside its range shifts every
     * later spit. Stepped exactly as the standing TAIL below is (one forecast
     * clock, one policy). `null` — every other caller — is byte-inert.
     */
    let stalled = stall === null;
    const stallHere = () => {
        stalled = true;
        for (let i = 0; i < stall.ticks; i += 1) {
            tick += 1;
            const arrows = forecast ? forecast.step(st) : null;
            const chaserBodies = chasers
                ? chasers.step(st, { slashing: slashState?.slashing === true }) : null;
            const sample = { x: st.x, y: st.y, tick, arrows, chasers: chaserBodies,
                phase: 'stall', wp: wpIndex };
            if (spitForecast) {
                sample.spits = spitForecast.step(st, { slashing: slashState?.slashing === true });
            }
            if (grenadeForecast) sample.grenades = grenadeForecast.step(st);
            samples.push(sample);
            let held = st.fall ? new Set() : NO_HELD_PREVIEW;
            const combat = combatBefore(st, tick - 1, held, chaserBodies);
            held = combat.held;
            sample.held = held;
            if (strike) bodiesForPolicy = (chasers ? chasers.bodies() : null) ?? [];
            st = step(st, held, { dashImpulse: combat.dashImpulse });
            combatAfter(tick - 1);
            truncated = lethalFloorOf(st);
            if (truncated) return;
            if (st.transition) {
                truncated = {
                    kind: 'crossed',
                    at: { x: st.x, y: st.y },
                    why: `the stall crossed to level ${st.transition.to_level}`,
                };
                return;
            }
        }
    };
    for (const wp of wps) {
        wpIndex += 1;
        let spent = 0;
        while (!hasArrived(st, wp, tolerance)) {
            if (!stalled && tick - startTick === stall.at) {
                stallHere();
                if (truncated) break;
                if (hasArrived(st, wp, tolerance)) break;
            }
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
            const chaserBodies = chasers
                ? chasers.step(st, { slashing: slashState?.slashing === true }) : null;
            // ⛓ R9 slice 12c′ — the sample carries WHICH LEG it belongs to, so a
            // caller can measure a corridor's own length rather than the whole
            // walk's. ⚖ Ruling 30(c) holds over a corridor's LENGTH (§27.8,
            // trap 587), and a bound nobody can evaluate per leg is a bound
            // nobody can respect.
            const sample = { x: st.x, y: st.y, tick, arrows, chasers: chaserBodies, wp: wpIndex };
            // ⛓ U15-swim D2: a spit updates before the player too (run-time
            // added, prepended), so it pairs with this PRE-move box.
            if (spitForecast) {
                sample.spits = spitForecast.step(st, { slashing: slashState?.slashing === true });
            }
            if (grenadeForecast) sample.grenades = grenadeForecast.step(st);
            samples.push(sample);
            if (stopWhen && stopWhen(sample)) {
                truncated = { kind: 'stopped', at: { x: st.x, y: st.y },
                    why: 'the caller stopped the preview at this sample' };
                break;
            }
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
            const combat = combatBefore(st, tick - 1, held, chaserBodies);
            held = combat.held;
            // ⛓ SEEDLING SWIM U2, D1 — `drive`'s own filter, at `drive`'s own
            // point (after the strike), so ⚖ ruling 30(c)'s equality holds.
            if (axisAligned) held = holdOneAxis(held, st, wp);
            // ⛓ R9 slice 12b: the sample carries the KEYS this tick spends, so
            // the preview/drive equality row has both sides of its claim.
            sample.held = held;
            /**
             * The policy's next reading — see `bodiesForPolicy` above.
             * ⛓⛓ R9 slice 12c‴: taken from the forecast AS IT STANDS NOW, not
             * from the array `step` handed back before this tick's sword window
             * fired. `run.strikeBodies` on the drive side is read at the END of
             * the tick and includes the hits; a stale snapshot here left the two
             * sides' `hitsTimer` exactly one apart for a whole i-frame.
             */
            if (strike) bodiesForPolicy = (chasers ? chasers.bodies() : null) ?? [];
            st = step(st, held, { dashImpulse: combat.dashImpulse });
            combatAfter(tick - 1);
            truncated = lethalFloorOf(st);
            if (truncated) break;
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
            const chaserBodies = chasers
                ? chasers.step(st, { slashing: slashState?.slashing === true }) : null;
            const sample = { x: st.x, y: st.y, tick, arrows, chasers: chaserBodies,
                phase: 'dwell', wp: wpIndex };
            if (spitForecast) {
                sample.spits = spitForecast.step(st, { slashing: slashState?.slashing === true });
            }
            if (grenadeForecast) sample.grenades = grenadeForecast.step(st);
            samples.push(sample);
            let held = st.fall ? new Set() : NO_HELD_PREVIEW;
            const combat = combatBefore(st, tick - 1, held, chaserBodies);
            held = combat.held;
            sample.held = held;
            if (strike) bodiesForPolicy = (chasers ? chasers.bodies() : null) ?? [];
            st = step(st, held, { dashImpulse: combat.dashImpulse });
            combatAfter(tick - 1);
            truncated = lethalFloorOf(st);
            if (truncated) break;
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
    return { samples, startTick, truncated, stood: standFor, plannedStruck };
}

/**
 * ⛓⛓⛓ R9 SLICE 12c′ — **THE PREVIEW/DRIVE AGREEMENT BOUND** (§27.8, trap 587).
 *
 * ⚖ Ruling 30(c)'s equality — the preview and the drive spend the same keys —
 * is TRUE and it is BOUNDED. The bound is a MEASUREMENT and it is not allowed
 * to decay quietly (trap 574): `solverBot.test.js`'s parting row asserts this
 * constant is at or below the index those fixtures actually measure, so a model
 * change that moves the skew reds the row rather than silently loosening the
 * filter it refuses against.
 *
 * ── THE HISTORY, BECAUSE EACH NUMBER NAMED A DIFFERENT MECHANISM ──────
 *
 * **144** (12c′) — `previewWalk` had no second pass, so `chasers.hit` ran at
 * the PRESS TICK where `applyThrust` runs at press+1. 12b priced that skew at
 * ~0.22 px of one body's travel; on a long stand it reached a held-set.
 * **79** (12c″) — ⚖ ruling 44's harmless window turned a 30-tick-wide refusal
 * into a THRESHOLD on `hitsTimer`, and the two sides read that value one apart,
 * so one press per i-frame was spent by one side and yielded by the other. A
 * blanket refusal is skew-PROOF and a threshold is not (trap 595). The cost was
 * measured on the population the bound REJECTS (trap 596): `r9-solve-0` offers
 * candidate legs of 92 and 95 and lost 168 t back to its committed 237.
 *
 * ⛓⛓⛓⛓ **195 (12c‴) — AND THE MECHANISM THE OTHER TWO NAMED IS CURED.**
 * `previewWalk` steps `presses.swordWindowStep`, the same function
 * `levelRun.advance` steps, in the run's own intra-tick order; and its policy
 * reading is taken from the forecast AS IT STANDS after that window rather than
 * from the array `step` handed back before it. ⛔ THE GAME SETTLED WHICH SIDE
 * WAS WRONG rather than this model arguing with itself:
 * `probe-seedling-r9-harmless-window-mobiles.mjs` inverts a struck body's own
 * `hits_timer` out of the game's `botMobiles` readout, three independent
 * samples agreeing, and puts the landed hit at PRESS + 1.
 *
 * ⛓ MEASURED, on §29.5's own fixtures: **the KEYS no longer part at all** —
 * the REFUSED arm agrees over the whole 260-tick stand (was 207) and the
 * planned-dashing arm over the whole 120-tick stand (was 79).
 *
 * ⛔⛔ SO WHY IS THERE STILL A CONSTANT? Because a SECOND stream still parts,
 * by a DIFFERENT mechanism, and retiring the bound would be claiming a cure the
 * measurement does not cover. The bodies the POLICY is handed first differ at
 * index **195**, and the difference is a DEATH REMOVAL: `bob@128,64` is killed
 * at tick 169 and leaves the drive's roster one tick before it leaves the
 * preview's. It changes no key inside these fixtures — but a body list is what
 * the next tick's scan reads, so on some other walk it could, and a bound
 * pinned to the earliest measured divergence of ANY stream is the honest place
 * to stand until the removal staging is measured too.
 *
 * ⚠⚠ AND IT IS STILL BOUNDING THE WRONG QUANTITY, unchanged from 12c″: it
 * bounds the longest LEG where a divergence accumulates over the WHOLE WALK.
 * It is necessary and not sufficient; what makes it nearly free now is that the
 * cure moved it far above every candidate leg the roster offers.
 *
 * ⇒ `planSwordDash` certifies CORRIDOR BY CORRIDOR and refuses to schedule a
 * leg longer than this.
 */
export const PREVIEW_AGREEMENT_BOUND = 195;

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
 * ⛓⛓⛓ R9 SLICE 12c‴, ⚖ RULING 45(b) — **THE PARTIAL WINDOWS** (user,
 * 2026-08-24: *"I would like the planner to consider dashes that aren't full
 * length, if possible."*).
 *
 * ⛔ A WINDOW IS NOT ALL-OR-NOTHING. `DASH_CHAIN_PATTERN` is the LONGEST
 * schedule one `slashTimer` window admits; every PREFIX of it is a legal
 * schedule too, and a shorter one buys less displacement for fewer presses —
 * which is exactly what a corridor whose full chain overshoots, stalls, or
 * strikes something needs.
 *
 * ⛓ DERIVED FROM THE PATTERN, so a chain that gains or loses a dash tomorrow
 * gains or loses a prefix with it and nothing here is typed (⚖ ruling 17). The
 * empty prefix is NOT one of them: pressing nothing is the undashed baseline,
 * which the pass already measures as its control.
 *
 * ⚠ VARIABLE OFFSETS ARE THE NEXT STEP AND ARE NOT BUILT. A single dash is
 * legal at any `+2 … +19` of the window, so the full candidate space is far
 * larger than these four; the prefixes are what ⚖ ruling 45(b) asked for "at
 * minimum", and the measurement of what they buy is what should decide whether
 * the rest is worth its previews.
 */
export const DASH_CHAIN_PREFIXES = Object.freeze(
    DASH_CHAIN_PATTERN.map((_, i) => Object.freeze(DASH_CHAIN_PATTERN.slice(0, i + 1))),
);

/**
 * ⛓⛓⛓ R9 SLICE 12i — **THE CANDIDATE SET IS DERIVED FROM THE MODE, AND IT IS
 * THE ONLY PLACE A MODE BECOMES A SET.**
 *
 * ⛔ NOTHING HERE IS TYPED (⚖ ruling 17). `full` is the pattern the two
 * `combatVerbs` constants decide; `all` is every prefix of that pattern; a
 * chain that gains or loses a dash tomorrow moves BOTH arms with it. `none`
 * returns the empty set — but the empty set is not how `none` is spent: the
 * call site does not ASK the pass at all, because asking it with `[]` is a
 * scan that reports `scanned` start ticks and no candidates, which reads like
 * a planner that found nothing rather than one that was never consulted.
 *
 * ⛔ A MODE OUTSIDE THE SET FAILS BY NAME HERE TOO, so a set can never be
 * silently smaller than the mode a header printed.
 */
export function dashPrefixesFor(mode) {
    assertDashMode(mode, 'dashPrefixesFor');
    if (mode === 'none') return Object.freeze([]);
    if (mode === 'full') return Object.freeze([DASH_CHAIN_PATTERN]);
    return DASH_CHAIN_PREFIXES;
}

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
export function planSwordDash(run, wps, { tolerance = 0, certify = null,
    dashMode = DEFAULT_DASH_MODE } = {}) {
    /**
     * ⛓⛓⛓ R9 SLICE 12i — **THE PASS READS ITS CANDIDATE SET, NEVER THE
     * CONSTANT**, and the set is the mode's own derivation.
     *
     * ⛔ `none` IS REFUSED HERE RATHER THAN SCANNED EMPTY. The call site is
     * meant to skip this function entirely at `none`; a caller that forgot
     * would otherwise run the whole sweep, ask nothing at each tick, and hand
     * back a refusal whose `scanned` counts start ticks — a bounded sweep that
     * names the wrong bound. Loud beats plausible.
     */
    assertDashMode(dashMode, 'planSwordDash');
    if (dashMode === 'none') {
        fail('planSwordDash was asked under `dashMode: none`, which is the state that '
            + 'means "do not ask". The permission is spent at the call site — `walkTo` '
            + 'does not build a plan at all — so reaching here is a threading defect, '
            + 'not an empty candidate set.');
    }
    const prefixes = dashPrefixesFor(dashMode);
    const startTick = run.ticksCompleted;
    const candidates = [];
    const refuse = (why) => ({ plan: null, ticks: null, saved: null, baseline: null,
        legs: null, windows: null, scanned: candidates.length, candidates, why,
        // ⛓ 12i: a report says which mode planned it and how wide its set was.
        mode: dashMode, prefixes: prefixes.length });
    /**
     * ⛔ NO SWORD, NO DASH — REFUSED FIRST AND BY NAME. `set slashing`'s outer
     * gate needs `hasSword || hasGhostSword`, so a press in a pre-sword room
     * is `gated` and buys nothing. §27.7 measured that this is TWELVE of the
     * campaign's twenty-three committed segments; asking each of them to
     * preview a whole corridor per candidate tick would be a scan whose answer
     * is known from one field.
     */
    if (!(run.progress('inventory')?.hasSword || run.progress('inventory')?.hasGhostSword)) {
        return refuse('this room holds no sword, so `set slashing`\'s outer gate refuses '
            + 'every press and no schedule can buy a single pixel');
    }
    // ⛓ SF2: a deadline already reached costs this corridor not even its baseline.
    if (deadlineReached('sword-dash')) return refuse('deadline');
    /**
     * ⛓⛓ R9 SLICE 12c‴, ⚖ RULING 45(a) — the two things a modelled hit is still
     * refused for, both read ONCE per corridor because both are facts about the
     * ROOM rather than about a candidate.
     *
     * ⛔ `shakeWritersHere` is `camera.SHAKE_WRITERS` MINUS `playerHit`, filtered
     * to the writers this room actually holds a body for — the run's own
     * derivation, never a level list here. `tagOfBody` is what turns a struck
     * body's id into the class `contactPricing` is keyed on; `run.strikeBodies`
     * is the one shape both sides of ⚖ ruling 30(c) already share.
     */
    const shakeWriters = run.shakeWritersHere ?? [];
    const tagOfBody = new Map((run.entities('strikeBodies') ?? []).map((b) => [b.id, b.tag]));
    const legsOf = (walk) => {
        const legs = [];
        for (const sample of walk.samples) legs[sample.wp] = (legs[sample.wp] ?? 0) + 1;
        return [...legs].map((n) => n ?? 0);
    };
    const previewFor = (dashPlan) => {
        const strike = strikePolicyFor(run, { dashPlan, dashMode });
        return { walk: previewWalk(run, wps, tolerance, { strike }), strike };
    };
    /**
     * ⛓ R9 slice 12c‴ — a window is `{at, pattern}` now, not a bare tick: ⚖
     * ruling 45(b)'s partial windows mean two windows at the same start tick can
     * be different schedules, and the plan has to carry WHICH.
     */
    const scheduleFor = (wins) => {
        const ticks = new Set();
        for (const w of wins) for (const d of w.pattern) ticks.add(w.at + d);
        return {
            ticks,
            starts: wins.map((w) => w.at),
            windows: wins.map((w) => ({ at: w.at, pattern: [...w.pattern] })),
            why: `⚖ ruling 35: ${wins.length} dash window(s) at `
                + `${wins.map((w) => `${w.at - startTick}[+${w.pattern.join('/+')}]`).join(', ')}`
                + ` — each an ordinary swing to open the ${ORDINARY_SWING_PERIOD}-tick `
                + `window, then its dash(es), each carrying the player `
                + `${DASH_DISPLACEMENT.total} px further along their own travel`,
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
    /**
     * ⛓⛓⛓ R9 SLICE 12c‴, ⚖ RULING 45(b) — **ONE CANDIDATE PER PREFIX**, and
     * the pass keeps the SHORTEST CERTIFIED WALK at each start tick, ties broken
     * by FEWER PRESSES.
     *
     * ⛔ THE COST IS NAMED RATHER THAN ABSORBED: this is `prefixes.length`
     * previews per start tick where 12c′ took one, and `scanned` counts every
     * one of them — so a reader can tell a scan that asked four questions per
     * tick from one that asked one. The candidate rows carry `prefix` and
     * `presses` for the same reason.
     *
     * ⛓ R9 SLICE 12i: `prefixes` is `dashPrefixesFor(dashMode)` — FOUR at
     * `all` (the roster's state and every committed tape's), ONE at `full`.
     * `none` never reaches this loop.
     *
     * ⛓ THE TIE-BREAK IS NOT COSMETIC. A shorter prefix that walks the same
     * number of ticks has spent fewer presses, and every press is a key the
     * corridor's certification has to hold — ⚖ ruling 35's safety-first read of
     * "dash whenever there is no reason not to".
     */
    const evaluateAt = (start, pattern) => {
        const plan = scheduleFor([...windows, { at: start, pattern }]);
        const { walk, strike } = previewFor(plan);
        const row = { at: start - startTick, prefix: [...pattern],
            presses: pattern.length, ticks: walk.samples.length, certified: false };
        /**
         * ⛓⛓⛓ R9 SLICE 12c‴, ⚖ RULING 45(a) — **A PLANNED PRESS MODELS THE HIT
         * IT DEALS; IT IS NOT REFUSED FOR HAVING ONE.**
         *
         * ⛔⛔ WHAT THE OLD RULE SAID AND WHY IT WAS OVER-BROAD. 12c′'s greedy
         * pass certified a schedule on L14 and the DRIVE then refused to step at
         * tick 73 — *"whether `bob@176,112` is on screen depends on where inside
         * `Game.shake`'s jiggle the camera landed"* — so the rule became "a
         * scheduled press may not cover a body", with a camera shake among its
         * four reasons. The user asked whether that was true (2026-08-24: *"Does
         * striking an enemy really cause camera shake?"*) and the AS3 census
         * says NO: `Player.hit` `+= 5` is the player TAKING a hit
         * (`Player.as:1391`); `Enemy.hit`, `startDeath`, `dieEffects`,
         * `SlashHit` and `genericHit` write none. 12c′'s tick-73 shake came from
         * the player being hit on an UNCERTIFIED first-cut run, never from a
         * dealt strike.
         *
         * ⇒ the other three consequences — knockback, the i-frame, the death —
         * are ALL MODELLED, and the preview already applies them (`chasers.hit`
         * runs `enemyHit` on the forecast's own body). So the candidate carries
         * the room its own press makes, and is priced on it.
         *
         * ⛔ WHAT SURVIVES, AND IT IS EXACTLY TWO THINGS:
         *  1. **a room that can open the shake band WITHOUT the player** — the
         *     `camera.SHAKE_WRITERS` table minus `playerHit`, asked of the RUN
         *     (`run.shakeWritersHere`). There a shake really is invisible to a
         *     frozen preview, and the old refusal is right.
         *  2. **a covered body whose CLASS is not priceable** —
         *     `combat.contactPricing` `unknown` (no combat row at all) or `boss`
         *     (an encounter script rather than a body, which prices its own
         *     `hitPlayer` override in its own step). Striking one models
         *     something this stack does not have.
         *
         * ⛓ AND THE STRIKE-THEN-DASH SEAM IS THE SCAN'S OWN FIRST GATE:
         * `strikeCandidates` rejects a target whose `hitsTimer > 0`, so a swing
         * over a body the walk has just knocked is not a hit at all and never
         * reaches either arm. A row asserts it.
         *
         * ⚠ THE COVERED SET IS THE PREVIEW'S OWN APPLICATION SITE
         * (`walk.plannedStruck`), not the policy's aim list — see its push site.
         * Today the two agree; when the preview adopts the shared sword window
         * this becomes the game's true five-tick coverage and this refusal
         * sharpens with it rather than needing a flag.
         */
        const struck = walk.plannedStruck ?? [];
        const struckIds = [...new Set(struck.map((h) => h.id))];
        const unpriced = struckIds
            .map((id) => ({ id, tag: tagOfBody.get(id) ?? null }))
            .map((b) => ({ ...b,
                kind: b.tag === null ? 'unknown' : contactPricing(b.tag).kind }))
            .filter((b) => b.kind === 'unknown' || b.kind === 'boss');
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
        } else if (struck.length && shakeWriters.length) {
            row.kind = 'shake-room';
            row.why = `a scheduled press at tick ${struck[0].tick} strikes ${struck[0].id}, `
                + `and this room can write \`Game.shake\` without the player: `
                + `${shakeWriters.join(', ')}. A strike itself writes NONE (⚖ ruling 45(a), `
                + 'the AS3 census), but a preview frozen at the plan tick cannot see a band '
                + 'this room opens on its own schedule, and an `onScreenUnderShake` verdict '
                + 'of `uncertain` is a body that may or may not damage. ⚖ Ruling 35 puts safety '
                + 'over speed';
        } else if (unpriced.length) {
            row.kind = 'unpriced-hit';
            row.why = `a scheduled press strikes ${unpriced.map((b) => `${b.id} `
                + `(${b.tag ?? 'no tag'}: ${b.kind})`).join(', ')}, whose class `
                + '`combat.contactPricing` does not price as a plain body — an `unknown` has '
                + 'no combat row at all and a `boss` is an encounter script that prices its '
                + 'own `hitPlayer` override in its own step. The dealt-hit effects this '
                + 'stack models (knockback, the i-frame, the death) are not that class\'s, '
                + 'so the room the corridor was certified for is not the room the press '
                + 'makes';
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
        return { row, walk };
    };
    while (at < startTick + current) {
        let best = null;
        for (const pattern of prefixes) {
            /**
             * ⛓ SF2 — THE DEADLINE IS ASKED BETWEEN PREVIEWS. On a trip the whole
             * schedule is dropped (`plan: null`, even windows already accepted)
             * and `walkTo` drives `wps` as it does after any refused scan: the
             * corridor was certified before this function was asked, the dash
             * is only its upgrade.
             */
            if (deadlineReached('sword-dash')) return { ...refuse('deadline'), baseline };
            const got = evaluateAt(at, pattern);
            candidates.push(got.row);
            if (!got.row.certified) continue;
            const better = best === null
                || got.row.ticks < best.row.ticks
                || (got.row.ticks === best.row.ticks && got.row.presses < best.row.presses);
            if (better) best = got;
        }
        if (best) {
            windows.push({ at, pattern: best.row.prefix });
            current = best.row.ticks;
            bestWalk = best.walk;
            at += ORDINARY_SWING_PERIOD;
        } else {
            at += 1;
        }
    }
    if (!windows.length) {
        /**
         * ⛓⛓⛓ R9 SLICE RR, ⚖ 64 (iv) — **THE SENTENCE SAYS WHAT IT COUNTS,
         * AND THIS IS THE SLICE THAT TOUCHES IT.**
         *
         * 12i left this as residue with its reason stated: the string reaches
         * the trace as `swordDash.why`, a trace byte IS a producer `--check`
         * md5 (§40.5, *"prose is not free to a producer"*), and 12i was a
         * tape-inert slice. ⚖ 64 bundles the correction into a run that is
         * already moving those bytes, so the sentence is free HERE and only
         * here.
         *
         * ⛔ WHAT WAS WRONG: `${candidates.length} start tick(s)` counted
         * PREVIEWS, not start ticks — 12c‴ gave every start tick one candidate
         * row per prefix, so the number was over by a factor of
         * `prefixes.length` and had been since. ⚖ 17: BOTH numbers are now
         * derived from the rows themselves (`row.at` is the start tick, so the
         * distinct-`at` count IS the scan width) rather than from a literal or
         * from an assumed shape — a sentence that multiplies two things must
         * be able to name both of them.
         *
         * ⛓ MEASURED REACH (slice RR W0, `grep -a` over the committed
         * sidecars): `swordDash` is a KEY in 20 of the 23 trace files, but
         * this sentence occurs in FOUR of them — `r8-solve-11`, `r9-solve-11`,
         * `r8-d2` and `r8-d2-19`, six occurrences — and it moves THREE of the
         * seven one-method producer md5s (battery, d2-chain, campaign) and NO
         * TAPE BYTE at all. The brief's "20 sidecars" is the key census, not
         * this string's.
         */
        const startsScanned = new Set(candidates.map((c) => c.at)).size;
        return { ...refuse(`no dash window certified faster than the undashed ${baseline} `
            + `tick(s) — ${startsScanned} start tick(s) x ${prefixes.length} preview(s) = `
            + `${candidates.length} scanned, each with its own reason`), baseline };
    }
    const plan = scheduleFor(windows);
    return {
        plan,
        ticks: current,
        saved: baseline - current,
        baseline,
        legs: legsOf(bestWalk),
        // ⛓ R9 slice 12c‴: a window carries its PREFIX now — two schedules at the
        // same start tick are different plans, and a report that printed only the
        // tick could not tell them apart.
        windows: windows.map((w) => ({ at: w.at - startTick, prefix: [...w.pattern] })),
        scanned: candidates.length,
        candidates,
        why: null,
        // ⛓ R9 slice 12i: the mode and the width of the set it was asked with.
        // A row that reads the DEFAULT is a landmine under a flipped default
        // (kickoff §40.6), so a report names the build it ran under.
        mode: dashMode,
        prefixes: prefixes.length,
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
    /**
     * ⛓⛓⛓ R9 SLICE RR — **THE SECOND SITE OF ⚖ 64 (iv)'s WRONG COUNT.**
     * ⚖ 64 named `swordDash.why`; this row carried the same arithmetic in a
     * different field and nobody had noticed, which is the shape ⚖ 64 exists
     * to stop rather than an instance of it. `dash.scanned` is
     * `candidates.length` — one row per (start tick x prefix) since 12c‴ — and
     * `v.n` counts the same rows, so BOTH numbers here are PREVIEWS and the
     * unit "start tick(s)" was over by `prefixes.length` at both ends.
     * ⇒ the unit is named for what it counts. MEASURED reach (W2, ruled GO by
     * the orchestrator, and the seal widened by that ruling rather than by
     * drift): 13 committed sidecars carry this wording against the four that
     * carry `swordDash.why`, and correcting it moves ONE further producer md5
     * (`solve-seedling-r9-campaign`) and NO tape byte — the sidecars are model
     * artifacts, so the widening costs no GPU.
     */
    const rows = [...byKind.entries()].sort((a, b) => b[1].n - a[1].n)
        .map(([kind, v]) => ({
            option: `sword-dash window: ${kind}`,
            why: `${v.n} of ${dash.scanned} scanned preview(s) — first at walk-offset `
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

/**
 * One goal, shape-checked. The two kinds slice 2 owns, `reach-pit`, and `encounter`.
 *
 * ⛓⛓ SEEDLING SWIM U1, D1 — **`reach-pit`, THE PIT COUNTERPART OF
 * `reach-exit`.** A level whose `control` block names a `fallthrough` level
 * is left by stepping onto a pit tile (`checkFallingInPit`); the survey's
 * route hands the hop as `{kind: 'reach-pit', pit: {tx, ty, x, y}}` (T3's
 * `pitEdgeFor`, cross-checked against the AP export). The tile is the goal's
 * identity, as a teleporter's OEL coordinates are `reach-exit`'s; `x`/`y` are
 * the tile's own rect origin and must agree with it (a disagreement is two
 * spellings of one pit, refused rather than resolved).
 */
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
    if (goal.kind === 'reach-pit') {
        const p = goal.pit;
        if (![p?.tx, p?.ty, p?.x, p?.y].every(Number.isInteger)
            || p.x !== p.tx * TILE_SIZE || p.y !== p.ty * TILE_SIZE) {
            fail(`${at}: reach-pit needs pit {tx, ty, x, y} — the pit TILE (finite `
                + `integers) and its rect origin (x = tx·${TILE_SIZE}, y = ty·${TILE_SIZE}), `
                + `got ${JSON.stringify(p ?? null)}. The MACRO layer names WHICH pit; the `
                + 'solver owns HOW to reach it.');
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
    /**
     * ⛓⛓ SEEDLING SWIM U5, D1 — **`encounter`, A LOCATION THAT IS A DROP.**
     * L32's `Level 032 - Bob Boss` has no pickup entity. `BobBoss.death`
     * spawns the Fire at runtime, so a `collect-placement` there resolves to
     * nothing. The goal names WHERE the fight is anchored (`at`, the location's
     * atlas tile), WHAT it drops (`drop.item`), and what the room asks after the
     * drop (`then`). That is `'reach-pit'` for L32, whose only exit is the pit
     * under the tree the Fire burns, and `null` when the route ends in the room.
     * The executor is `ENCOUNTER_EXECUTORS[drop.item]`.
     */
    if (goal.kind === 'encounter') {
        if (!Number.isFinite(goal.at?.x) || !Number.isFinite(goal.at?.y)
            || typeof goal.drop?.item !== 'string' || !goal.drop.item
            || !(goal.then === 'reach-pit' || goal.then === null)) {
            fail(`${at}: encounter needs at {x, y} (the location's atlas tile), drop `
                + '{item} (what the fight spawns) and then \'reach-pit\' | null (the '
                + `room's exit after the drop), got ${JSON.stringify(goal)}. The MACRO `
                + 'layer names WHICH encounter; the solver owns HOW to fight it.');
        }
        return goal;
    }
    /**
     * ⛓⛓ SEEDLING FIDELITY CLEARTAG — **`clear-tag`, A SAVED OBSTACLE BROKEN
     * FROM ITS OPEN SIDE** (⚖ 2026-10-05, *"break before first use"*). The
     * route survey's goal (`clearTagGoal`): `tag` is the persistence flag
     * `{level, tag}` the game writes when the obstacle goes, `at` the solid's
     * OEL cell, and `obstacle` (optional) its `<class>@<x>,<y>` id. The verb is
     * NOT the goal's: the executor selects it from `OBSTACLE_STRATEGIES`, as the
     * frontier does, and finishes on the run's `earnedClears` ledger.
     */
    if (goal.kind === 'clear-tag') {
        if (!Number.isInteger(goal.tag?.level) || !Number.isInteger(goal.tag?.tag) || goal.tag.tag < 0
            || !Number.isFinite(goal.at?.x) || !Number.isFinite(goal.at?.y)
            || (goal.obstacle !== undefined
                && !/^[a-z0-9_]+@-?\d+,-?\d+$/i.test(String(goal.obstacle)))) {
            fail(`${at}: clear-tag needs tag {level, tag} (the persistence flag, integers, tag >= 0), `
                + 'at {x, y} (the obstacle\'s OEL cell) and optionally obstacle \'<class>@<x>,<y>\', got '
                + `${JSON.stringify(goal)}. The MACRO layer names WHICH flag; the solver owns HOW to clear it.`);
        }
        return goal;
    }
    fail(`${at}: unknown goal kind ${JSON.stringify(goal.kind)}. The solver owns `
        + '\'reach-exit\', \'reach-pit\', \'collect-placement\', \'encounter\' and \'clear-tag\'; a new kind is a policy addition, '
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
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY F2, D1a: **AN APITEM IS A THIRD WORLD FOR THE
     * SAME GOAL.** A delivered set writes `<apitem>` into every randomized
     * location, so the macro layer's `collect-placement` at that location's
     * (x, y) is the goal, and which verb takes it is this selector's job (the
     * `assertGoal` contract). It is not a new goal kind because nothing about
     * WHAT is wanted differs from a pickup, and the JS arc's mapping
     * (`jsRuntimeSolver.solverGoalFor`: a `location` becomes `collect-placement
     * {placement}`) then reaches it with no new vocabulary. Its verb is
     * `apitem`: walk until the game's own contact rule fires
     * (`apItemTakenOnTick`), with no ceremony to run.
     */
    const apItem = (world.apItems ?? []).find((a) => a.x === placement.x && a.y === placement.y);
    if (apItem) {
        return {
            strategy: 'apitem',
            target: apItem,
            rejected: [{
                option: 'collect',
                why: `placement (${placement.x},${placement.y}) resolves to ${apItem.id} in `
                    + '`world.apItems` — an APItem never sets `special`, so its contact takes '
                    + '`removeSelf()` with no freeze and no ceremony for `runCollect` to wait on',
            }, {
                option: 'chest',
                why: `${apItem.id} is a Pickup, not a Solid with a probe line`,
            }],
        };
    }
    return null;
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY F2, D1a: **THE APITEM CONTACT, THE GAME'S RULE.**
 *
 * `Pickup.update` tests `collide("Player", x, y)` (`Pickups/Pickup.as:63-84`).
 * An `APItem` never sets `special`, so a contact takes the `removeSelf()` arm
 * (`:120-123`), and `APItem.removed()` clears its slot in the same frame
 * (`APItem.as:127-133`). The entity updates BEFORE the player (the Player is
 * added first, and `World.addUpdate` prepends), so the box it meets is the
 * one the PREVIOUS tick left. No contact is tested on a tick that changed
 * level, recorded a death, or began in a ceremony. These are the JS page's
 * own three exclusions (`jsRuntimeCore.tickOnce`), and the page and this
 * function are pinned equal tick for tick in `fidelityF2.test.js`. As on the
 * page, at most one apitem is taken per tick, the first in `.oel` order.
 *
 * @param {Array} apItems  the level's `world.apItems`, less those already taken
 * @param {{level:number, x:number, y:number, inCeremony:boolean, deaths:number,
 *          transitions:number}} pre  the run before the tick
 * @param {{level:number, deaths:number, transitions:number}} post  the run after it
 * @returns {object|null} the apitem the tick takes
 */
export function apItemTakenOnTick(apItems, pre, post) {
    if (pre.inCeremony || post.level !== pre.level || post.deaths !== pre.deaths
        || post.transitions !== pre.transitions) return null;
    const box = playerBoxAt(pre.x, pre.y);
    return apItems.find((a) => rectsOverlapLocal(box, a.rect)) ?? null;
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
 * ⛓⛓⛓ R9 SLICE L15 — THE BLOCK-ROUTE SEARCH (kickoff §54.4, ⚖ 65 (a)).
 *
 * `deriveShove` asked ONE question — *at which k does a corridor appear?* —
 * and L15's honest answer was none: the block is the only door out of the
 * arrival pocket, the exit is behind a lock whose one presser is a momentary
 * `Button`, and the only way to a cell the next lean must be leaned FROM is
 * through a rock that no corridor planner ever names. So the question is
 * widened, once, for both callers: **what SEQUENCE of the verbs the executors
 * already run puts the block where the post-condition needs it?**
 *
 * A best-first search over `{ block cell | DESTROYED, broken-rock set, player
 * cell }`, whose moves are `lean(dir, k)` and `break(rock)` and whose two goal
 * predicates are the two post-conditions ⚖ §11.8a already named:
 *   `clear-path` — a corridor plans from the state's player cell to the aim
 *                  (`resolveShoveStrategy`);
 *   `press`      — the block IS on the presser's tile (`resolveWeighStrategy`).
 * One search, two goal predicates — that is the whole of ⚖ 65 (a).
 *
 * ⛔ **THE ROCK LOGIC IS THE TRANSCRIPTION'S, ASKED OF A HYPOTHETICAL BAG
 * (§54.5, ⚖ 65 (b)) — no second physics.** An unbroken rock STOPS the block
 * because `blockBlockedAt` asks `collidesSolid` under a bag whose
 * `brokenRocks` is the state's; a rock is breakable only if `rockBreaksUnder`
 * and the primary slot fires the plain sword — the same two guards
 * `resolveBreakStrategy` applies live; a broken rock is gone for the VISIT, so
 * the set is monotone per state; and a block RESTING on a presser publishes
 * the group because `Button.hitables` is `["Player","Enemy","Solid"]` and a
 * `PushableBlock` is a `"Solid"` — so the state bag's `openActivators` gains
 * every group whose EVERY presser is covered by a Solid in the state, and a
 * corridor test can see THROUGH a lock the route has opened. ⛔ The player
 * never counts as a presser here (momentary), and a `localPublish` presser
 * stays `hold`'s. Each of these is one row of §54.5 and each has a mutant.
 *
 * ⛔⛔ **A ONE-STEP ROUTE IS TODAY'S RECORD, FIELD FOR FIELD** — measured by
 * `shoveWeighParity.test.js`, not argued. The START state's leans are scanned
 * in `deriveShove`'s own order and their rejections are phrased by the
 * CALLER (`phrase`), so the trace rows of every committed one-step room are
 * the bytes they were; the search only adds what a room like L15 needs.
 * Two bags per state, because today's code uses two: the stance test and the
 * block-stop test ask the world AS IT IS plus the state (other pushables are
 * WALLS to the block — guard (i) never discharged them for that question),
 * and only the corridor-to-aim test carries the guard-(i) hypothesis.
 *
 * ⛔ **BOUNDS, NAMED IN THE REFUSAL.** `MAX_ROUTE_ORDERS` and
 * `MAX_ROUTE_EXPANSIONS`; the other pushables stay guard-(i) hypotheses —
 * multi-block routing is out of scope and says so (§54.10). Cost is
 * lexicographic and total — `(orders, Σk, destroys, direction-order
 * sequence)` — so an emitted tape is an artifact and never a tie broken by
 * iteration order.
 *
 * @param {object} run
 * @param {object} row       the block's `world.pushables` row (the ROUTED block)
 * @param {{kind:'clear-path', aim:object, allowTeleporter?:*}|{kind:'press', onto:{tx,ty}}} goal
 * @param {Set|Iterable} contacts
 * @param {string[]} blocked  guard (ii) walls
 * @param {{discharged?: string[], phrase?: object}} [opts]
 * @returns {{steps: ?object[], rejected: object[], found: object[], expansions: number,
 *   refused: ?{bound: string, why: string}}}
 */
export const MAX_ROUTE_ORDERS = 8;
export const MAX_ROUTE_EXPANSIONS = 2000;

/**
 * ⛓ SEEDLING FIDELITY ROBUST, D1 — a cut block-route search as the refusal's
 * `bound` FIELD (`SolverRefusal.bound`): which bound, its limit, and the work
 * spent. `deadline` has no limit of its own (the caller's hook decided).
 */
function blockRouteBound(route, row, goalKind) {
    const name = route.refused.bound;
    return {
        name, site: 'block-route', goal: goalKind, block: row.id,
        limit: name === 'MAX_ROUTE_EXPANSIONS' ? MAX_ROUTE_EXPANSIONS
            : name === 'MAX_ROUTE_ORDERS' ? MAX_ROUTE_ORDERS : null,
        expansions: route.expansions,
    };
}

/** `deriveShove`'s own words for the START state's lean rejections. */
const SHOVE_PHRASE = Object.freeze({
    stance: (dir, stance) => ({
        option: `shove ${dir}`,
        why: `the near-side stance (${stance.x},${stance.y}) for a ${dir} lean does `
            + 'not plan a corridor from the live position — a lean needs the player '
            + 'box on the block\'s +-1 px probe with velocity INTO it, so a '
            + 'direction whose stance is in another component is not a direction',
    }),
    offMap: (dir, k, cell, run) => ({
        option: `shove ${dir} k=${k}`,
        why: `(${cell.tx},${cell.ty}) is OFF THE MAP — level ${run.level} is `
            + `${run.world.width}x${run.world.height} TILES. A block cannot rest `
            + 'outside the room, and a hypothesis that puts it there is asking '
            + 'whether a corridor exists once the block stops existing.',
    }),
    solid: (dir, k, cell) => ({
        option: `shove ${dir} k=${k}`,
        why: `(${cell.tx},${cell.ty}) is Solid to the block, which stops dead `
            + 'against one — so no k at or beyond this is reachable',
    }),
    noGoal: (dir, k, cell, destroys, goal) => ({
        option: `shove ${dir} k=${k}`,
        why: goal.kind === 'press'
            ? `(${cell.tx},${cell.ty}) is not the presser's tile (${goal.onto.tx},${goal.onto.ty})`
                + `${destroys ? ' — and the block is DESTROYED there' : ''}`
            : `no corridor to (${goal.aim.x},${goal.aim.y}) with the block hypothesised at `
                + `(${cell.tx},${cell.ty})${destroys ? ' (destroyed there)' : ''}`,
    }),
    rock: (rockId, why) => ({ option: `break ${rockId}`, why }),
});

const routeCost = (steps) => {
    let sumK = 0; let destroys = 0; const seq = [];
    for (const s of steps) {
        if (s.verb === 'shove') { sumK += s.k; if (s.destroys) destroys += 1; seq.push(s.dirIndex); }
        else seq.push(SHOVE_DIR_COUNT);
    }
    return { orders: steps.length, sumK, destroys, seq };
};
const SHOVE_DIR_COUNT = Object.keys(SHOVE_STEP).length;
/**
 * ⛔ NON-DESTRUCTIVE BEFORE FEWER TILES. Kickoff §54.4 wrote the tuple as
 * `(orders, Σk, destroys, …)`; that order would take a k=1 SINK over a k=3
 * push that keeps the block, which is the opposite of ⚖ §11.8a ruling 1
 * ("destruction is only ever an explicit LAST RESORT") and of `deriveShove`'s
 * own sort — and a one-step route must be today's record. Measured on the
 * witness room in `blockRoute.test.js` before the order was corrected.
 */
const compareCost = (a, b) => {
    if (a.orders !== b.orders) return a.orders - b.orders;
    if (a.destroys !== b.destroys) return a.destroys - b.destroys;
    if (a.sumK !== b.sumK) return a.sumK - b.sumK;
    const n = Math.min(a.seq.length, b.seq.length);
    for (let i = 0; i < n; i += 1) if (a.seq[i] !== b.seq[i]) return a.seq[i] - b.seq[i];
    return a.seq.length - b.seq.length;
};
const stateKey = (s) => `${s.block ? `${s.block.tx},${s.block.ty}` : 'X'}|`
    + `${[...s.rocks].sort().join(',')}|${Math.floor(s.player.x / DEFAULT_LATTICE)},`
    + `${Math.floor(s.player.y / DEFAULT_LATTICE)}`;

/**
 * The groups a state's Solids hold OPEN — §54.5 row 5. Every presser of the
 * group must be covered by a non-removed pushable rect in the bag; a group
 * with a `localPublish` presser is `hold`'s and is never opened here.
 */
function groupsHeldOpenBySolids(run, bag) {
    const opened = new Set();
    const solids = [...(bag.pushables?.values() ?? [])].filter((p) => p.rect && !p.removed);
    if (!solids.length) return opened;
    const groups = new Map();
    for (const p of (run.world.pressers ?? [])) {
        if (!groups.has(p.t)) groups.set(p.t, []);
        groups.get(p.t).push(p);
    }
    for (const [t, pressers] of groups) {
        if (pressers.some((p) => localPublish(p) !== null)) continue;
        if (!pressers.every((p) => solids.some((s) => rectsOverlapLocal(s.rect, p.rect)))) continue;
        for (const a of (run.world.activators ?? [])) {
            if (a.t === t && !(bag.openActivators?.has(a.id))) opened.add(a.id);
        }
    }
    return opened;
}

export function deriveBlockRoute(run, row, goal, contacts, blocked = [],
    { discharged = [], phrase = SHOVE_PHRASE } = {}) {
    const live = run.entities('pushables')?.get(row.id);
    if (!live || live.removed) return { steps: null, rejected: [], found: [], expansions: 0, refused: null };
    const base = run.liveGeometryOpts();
    const liveRocks = base.brokenRocks ?? new Set();
    const start = {
        block: { tx: Math.floor(live.rect.x / TILE_SIZE), ty: Math.floor(live.rect.y / TILE_SIZE) },
        rocks: new Set(), player: { x: run.state.x, y: run.state.y }, steps: [],
    };
    const dirs = Object.keys(SHOVE_STEP);
    const rocks = (run.world.solids ?? []).filter((s) => s.rockId && !liveRocks.has(s.rockId));

    /**
     * ⛓⛓⛓ THE PRESSERS A ROUTE MAY WALK OVER. L15's fourth order is a swing
     * from (7,1), whose only neighbour that is not Stone or the rock is the
     * BUTTON's own cell — a `proximity-hazard` the planner refuses. The game
     * does not: `Button.update` republishes from whoever stands there and
     * shuts the group the tick they leave, and a `Lock`'s fade is 101 ticks,
     * so a walk ACROSS a momentary button changes nothing the route cares
     * about. `hold` already crosses one by exemption (`resolved.exempt`); the
     * search does the same, in the same order `stanceReaches` uses — the
     * world as it IS first, and only then with the crossable pressers exempt
     * — and ONLY for states past the start, so a one-step room's questions
     * are today's by construction (§54.4's parity law) rather than by luck.
     * ⛔ Crossable = momentary (`localPublish` null) AND no arrow trap shares
     * the group: a press that arms a lane is a danger this search does not
     * price, and the honest answer there is the refusal it always was.
     */
    const armedGroups = new Set((run.world.arrowTraps ?? []).map((t) => t.t));
    const crossable = (run.world.pressers ?? []).filter((p) => localPublish(p) === null
        && !armedGroups.has(p.t))
        .map((p) => `proximity-hazard:${p.tag}@${p.x},${p.y}`);
    /**
     * ⛓ A CONSERVATIVE FLOOD BEFORE EVERY A\*. L16's search asked ~16,000
     * corridor plans (161 states × four rocks × up to 24 stance candidates)
     * and took 84 s; almost all of them were "no" for a cell on the far side
     * of a wall. So each (bag, exempt, from) gets ONE 8-neighbour flood over
     * the planner's own per-tile predicate (`plannerObstacleAt` at the cell
     * centre, no margin), and a target outside it is refused without an A\*.
     * ⛔ THE FLOOD IS A FILTER, NEVER THE ANSWER: it over-approximates
     * (eight neighbours, no box margin), so every "reachable" is still put
     * to `planWaypoints` — the instrument the walk then follows — and only
     * a cell the flood cannot reach at all is skipped. A yes the flood gives
     * and A\* refuses falls through to the next candidate as before.
     */
    const floods = new Map();
    /** One per-tile answer per (bag, exempt) — shared by every state that asks. */
    const tileAnswers = new Map();
    const bagKeyOf = (bag, exempt) => [...(bag.pushables?.values() ?? [])]
        .map((p) => `${p.rect?.x},${p.rect?.y},${p.removed ? 'x' : ''}`).join(';')
        + `|${[...(bag.brokenRocks ?? [])].sort().join(',')}`
        + `|${[...(bag.openActivators ?? [])].sort().join(',')}|${[...exempt].sort().join(',')}`;
    const floodFrom = (from, bag, exempt) => {
        const bagKey = bagKeyOf(bag, exempt);
        const key = `${bagKey}|${Math.floor(from.x / TILE_SIZE)},${Math.floor(from.y / TILE_SIZE)}`;
        if (floods.has(key)) return floods.get(key);
        if (!tileAnswers.has(bagKey)) tileAnswers.set(bagKey, new Map());
        const answers = tileAnswers.get(bagKey);
        const opts = solverPlanOpts(run, exempt, { liveBag: bag, nodeMargin: 0, triggerMargin: 0 });
        const blockedAt = (k, n) => {
            if (!answers.has(k)) {
                const centre = nodeCentre(n.tx, n.ty, DEFAULT_LATTICE);
                answers.set(k, Boolean(plannerObstacleAt(run.world, centre.x, centre.y, null, opts)));
            }
            return answers.get(k);
        };
        const seenCells = new Set();
        const start = { tx: Math.floor(from.x / TILE_SIZE), ty: Math.floor(from.y / TILE_SIZE) };
        const stack = [start];
        seenCells.add(`${start.tx},${start.ty}`);
        // ⛓ FOUR-CONNECTED, LIKE `planTilePath` — the flood is A\*'s own
        // connectivity at its margin-0 fallback; what it still ignores (the
        // trigger margin, the waterfall's directed edge) only ever makes it
        // say yes where A\* says no, which `verifyRoute` then catches.
        while (stack.length) {
            const c = stack.pop();
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const n = { tx: c.tx + dx, ty: c.ty + dy };
                if (n.tx < 0 || n.ty < 0 || n.tx >= run.world.width || n.ty >= run.world.height) continue;
                const k = `${n.tx},${n.ty}`;
                if (seenCells.has(k)) continue;
                if (blockedAt(k, n)) continue;
                seenCells.add(k);
                stack.push(n);
            }
        }
        floods.set(key, seenCells);
        return seenCells;
    };
    /**
     * ⚠ THE TARGET ITSELF MAY BE A CELL THE FLOOD REFUSES AND A\* ACCEPTS — a
     * stairs exit is a teleporter volume, a stance may sit in a trigger the
     * goal allows (A\* exempts its GOAL from the margins) — so a target
     * counts as flood-reached when it or one of its four neighbours is.
     */
    const floodReaches = (from, to, bag, exempt) => {
        const cells = floodFrom(from, bag, exempt);
        const tx = Math.floor(to.x / TILE_SIZE);
        const ty = Math.floor(to.y / TILE_SIZE);
        return cells.has(`${tx},${ty}`) || cells.has(`${tx + 1},${ty}`) || cells.has(`${tx - 1},${ty}`)
            || cells.has(`${tx},${ty + 1}`) || cells.has(`${tx},${ty - 1}`);
    };
    /**
     * ⛓⛓⛓ LAZY VERIFICATION. The START state's questions are `deriveShove`'s
     * own and are asked of A\* exactly as it asked them (the parity law).
     * Every DEEPER state answers reachability from the flood — which
     * over-approximates — and the route the search returns is then VERIFIED
     * step by step with `planWaypoints` under each prefix's own bag
     * (`verifyRoute`). A step A\* refuses blacklists that one transition
     * and the search resumes; so the instrument the walk follows is still
     * the one that decides, and the ~1,300 plans L16's search spent on
     * states it never used become the handful its answer needs.
     */
    const plansOrCrosses = (state, from, to, allowTeleporter, bag, exempt) => {
        if (state.steps.length === 0) {
            return corridorPlans(run.world, from, to, allowTeleporter,
                solverPlanOpts(run, exempt, { liveBag: bag })) ? exempt : null;
        }
        if (floodReaches(from, to, bag, exempt)) return exempt;
        if (!crossable.length) return null;
        const wider = new Set([...exempt, ...crossable]);
        return floodReaches(from, to, bag, wider) ? wider : null;
    };
    const plansExactly = (from, to, allowTeleporter, bag, exempt) => corridorPlans(
        run.world, from, to, allowTeleporter, solverPlanOpts(run, exempt, { liveBag: bag }));
    /** The two bags of a state (see the docblock), and the contacts they imply. */
    const bagsOf = (state) => {
        const at = state.block ?? { tx: -1, ty: -1 };
        let solid = bagWithBlockAt(base, row.id, at, state.block === null);
        if (state.rocks.size) solid = { ...solid, brokenRocks: new Set([...liveRocks, ...state.rocks]) };
        const opened = groupsHeldOpenBySolids(run, solid);
        if (opened.size) {
            solid = { ...solid, openActivators: new Set([...(base.openActivators ?? []), ...opened]) };
        }
        const exempt = opened.size
            ? new Set([...contacts, ...[...opened].map((id) => `proximity-hazard:${id}`)])
            : contacts;
        const corridor = discharged.length
            ? bagWithBlockAt(solid, row.id, at, state.block === null, discharged) : solid;
        return { solid, corridor, exempt };
    };
    const goalMet = (state, bags) => {
        if (goal.kind === 'press') {
            return Boolean(state.block) && state.block.tx === goal.onto.tx
                && state.block.ty === goal.onto.ty;
        }
        if (state.steps.length === 1) {
            // ⛓ THE ONE-STEP QUESTION IS `deriveShove`'s OWN, asked of A\* with
            // the guard-(i) bag and today's contacts — never the flood.
            return plansExactly(state.player, goal.aim, goal.allowTeleporter ?? null,
                bags.corridor, bags.exempt);
        }
        if (refusedMoves.has(`${stateKey(state)}|goal`)) return false;
        return Boolean(plansOrCrosses(state, state.player, goal.aim,
            goal.allowTeleporter ?? null, bags.corridor, bags.exempt));
    };

    const rejected = [];
    const found = [];
    const moveSig = (st) => (st.verb === 'shove' ? `shove:${st.dir}:${st.k}` : `break:${st.rock}`);
    /**
     * Replay a candidate route's prefixes and ask A\* every question the
     * flood answered for it. Returns `null` when every step plans, else the
     * `${stateKey}|${moveSig}` of the first transition A\* refuses.
     */
    const verifyRoute = (steps) => {
        let state = start;
        for (let i = 0; i < steps.length; i += 1) {
            const st = steps[i];
            const bags = bagsOf(state);
            const exempt = st.exempt ? new Set([...bags.exempt, ...st.exempt]) : bags.exempt;
            if (i > 0 && st.stance
                && !plansExactly(state.player, st.stance, null, bags.solid, exempt)) {
                return `${stateKey(state)}|${moveSig(st)}`;
            }
            state = st.verb === 'shove'
                ? { block: st.destroys ? null : st.to, rocks: state.rocks,
                    player: nodeCentre(st.to.tx - SHOVE_STEP[st.dir].dx,
                        st.to.ty - SHOVE_STEP[st.dir].dy, DEFAULT_LATTICE),
                    steps: steps.slice(0, i + 1) }
                : { block: state.block, rocks: new Set([...state.rocks, st.rock]),
                    player: st.stance ?? state.player, steps: steps.slice(0, i + 1) };
        }
        if (goal.kind === 'clear-path' && steps.length > 1) {
            const bags = bagsOf(state);
            const last = steps[steps.length - 1];
            const exempt = last.exempt ? new Set([...bags.exempt, ...last.exempt]) : bags.exempt;
            const wider = crossable.length ? new Set([...exempt, ...crossable]) : exempt;
            if (!plansExactly(state.player, goal.aim, goal.allowTeleporter ?? null,
                bags.corridor, exempt)
                && !plansExactly(state.player, goal.aim, goal.allowTeleporter ?? null,
                    bags.corridor, wider)) {
                return `${stateKey(state)}|goal`;
            }
        }
        return null;
    };
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY SF3 — **A CHEAP PROOF OF "THERE IS NONE", ASKED
     * BEFORE THE SEARCH**, for a `clear-path` goal.
     *
     * MEASURED (the l16-budget report §2): the S4 census's L16 pit `(13,4)` with
     * the kit spent 99 % of a 14 s refusal here, hitting `MAX_ROUTE_EXPANSIONS`
     * — and the pit is in another connected component even with this block
     * GONE, every rock broken and every lock open. No order of shoves and
     * breaks could have opened it.
     *
     * ⇒ the RELAXED bag: every pushable removed, every breakable rock broken,
     * every activator open, and every volume the search could ever exempt
     * exempted (`contacts`, the `crossable` pressers, each activator's own
     * `proximity-hazard`). Every bag `bagsOf` can build is a restriction of it
     * — a route only moves THIS block (or sinks it), breaks rocks and holds
     * groups open, and none of those adds an obstacle (`liveRectOf` answers
     * `null` for an open, broken or removed solid) — and the search's own
     * connectivity is this flood (the goal test of every route longer than
     * one order) or A\* at the same lattice, which the flood never refuses
     * where A\* passes (four-connected, margin 0). So a flood that cannot
     * reach the aim from the live position in the relaxed world proves the
     * search would never meet the post-condition.
     *
     * ⛔ THE ANSWER IS THE EXHAUSTED SHAPE (`bound: null`), not a bound —
     * the comment at `deriveShove`'s caller is why: "I could not decide" and
     * "there is none" are different claims, and this one is the second, so
     * the frontier reports it as it reports a search that ran dry.
     */
    if (goal.kind === 'clear-path') {
        const relaxed = {
            ...base,
            pushables: new Map([...(base.pushables ?? new Map())]
                .map(([id, p]) => [id, { ...p, removed: true }])),
            brokenRocks: new Set([...liveRocks, ...rocks.map((r) => r.rockId)]),
            openActivators: new Set([...(base.openActivators ?? []),
                ...(run.world.activators ?? []).map((a) => a.id)]),
        };
        const relaxedExempt = new Set([...contacts, ...crossable,
            ...(run.world.activators ?? []).map((a) => `proximity-hazard:${a.id}`)]);
        if (!floodReaches(run.state, goal.aim, relaxed, relaxedExempt)) {
            const why = `(${goal.aim.x},${goal.aim.y}) is not reachable from `
                + `(${run.state.x},${run.state.y}) even with every pushable removed, every `
                + `breakable rock broken (${rocks.length} live) and every lock open — no `
                + 'sequence of leans and breaks can open a corridor the relaxed room does '
                + 'not have (SF3: proved before the search, which was not run)';
            return { steps: null, found: [], expansions: 0,
                rejected: [{ option: `a block route for ${row.id}`, why }],
                refused: { bound: null, why } };
        }
    }
    const refusedMoves = new Set();
    let expansions = 0;
    let ordersBound = false;
    for (;;) {
    const queue = [];
    const push = (s) => {
        s.cost = routeCost(s.steps);
        let i = queue.length;
        while (i > 0 && compareCost(queue[i - 1].cost, s.cost) > 0) i -= 1;
        queue.splice(i, 0, s);
    };
    push(start);
    const seen = new Set();
    let restart = false;
    rejected.length = 0;
    found.length = 0;
    while (queue.length) {
        const state = queue.shift();
        const key = stateKey(state);
        if (seen.has(key)) continue;
        seen.add(key);
        const bags = bagsOf(state);
        if (state.steps.length > 0 && goalMet(state, bags)) {
            const bad = verifyRoute(state.steps);
            if (bad === null) {
                return { steps: state.steps, rejected, found, expansions, refused: null };
            }
            refusedMoves.add(bad);
            restart = true;
            break;
        }
        if (state.steps.length >= MAX_ROUTE_ORDERS) { ordersBound = true; continue; }
        // ⛓ SF2: the caller's deadline is a bound too, refused in the same shape.
        if (deadlineReached('block-route')) {
            return { steps: null, rejected, found, expansions, refused: {
                bound: 'deadline',
                why: `the caller's anytime deadline (\`shouldStop\`) was reached after `
                    + `${expansions} expansion(s), before the \`${goal.kind}\` post-condition `
                    + 'was met — the search was stopped, not exhausted',
            } };
        }
        expansions += 1;
        if (expansions > MAX_ROUTE_EXPANSIONS) {
            return { steps: null, rejected, found, expansions, refused: {
                bound: 'MAX_ROUTE_EXPANSIONS',
                why: `the block-route search expanded ${MAX_ROUTE_EXPANSIONS} states `
                    + `(\`MAX_ROUTE_EXPANSIONS\`) without meeting the \`${goal.kind}\` `
                    + 'post-condition — a route this long is a derivation that has lost its '
                    + 'room, not a long puzzle',
            } };
        }
        const atStart = state.steps.length === 0;
        if (state.block) {
            dirs.forEach((dir, dirIndex) => {
                const step = SHOVE_STEP[dir];
                const from = state.block;
                const stanceCell = { tx: from.tx - step.dx, ty: from.ty - step.dy };
                const stance = nodeCentre(stanceCell.tx, stanceCell.ty, DEFAULT_LATTICE);
                const exempt = plansOrCrosses(state, state.player, stance, null, bags.solid,
                    bags.exempt);
                if (!exempt) {
                    if (atStart) rejected.push(phrase.stance(dir, stance));
                    return;
                }
                const crossed = exempt === bags.exempt ? [] : [...exempt].filter(
                    (c) => !bags.exempt.has(c));
                for (let k = 1; k <= MAX_SHOVE_TILES; k += 1) {
                    const cell = { tx: from.tx + step.dx * k, ty: from.ty + step.dy * k };
                    if (cell.tx < 0 || cell.ty < 0
                        || cell.tx >= run.world.width || cell.ty >= run.world.height) {
                        if (atStart) rejected.push(phrase.offMap(dir, k, cell, run));
                        break;
                    }
                    const destroys = blockSinksOn(run.world, cell);
                    if (!destroys && blockBlockedAt(run, bags.solid, row.id, cell)) {
                        if (atStart) rejected.push(phrase.solid(dir, k, cell));
                        break;
                    }
                    if (refusedMoves.has(`${key}|shove:${dir}:${k}`)) {
                        if (destroys) break;
                        continue;
                    }
                    const next = {
                        block: destroys ? null : cell, rocks: state.rocks,
                        player: nodeCentre(cell.tx - step.dx, cell.ty - step.dy, DEFAULT_LATTICE),
                        steps: [...state.steps, { verb: 'shove', dir, dirIndex, k,
                            from: { ...from }, to: { ...cell }, destroys, stance,
                            ...(crossed.length ? { exempt: crossed } : {}) }],
                    };
                    if (atStart) {
                        /**
                         * ⛓ THE START STATE IS SCANNED EXACTLY AS `deriveShove` SCANNED
                         * IT: the goal is asked per k, a hit ends the direction (there is
                         * no k+1 once k plans), and every miss is a rejection in the
                         * caller's words. That is what keeps a one-step record byte-equal.
                         */
                        if (goalMet(next, bagsOf(next))) {
                            found.push({ dir, dirIndex, k, to: { ...cell }, destroys });
                            push(next);
                            break;
                        }
                        rejected.push(phrase.noGoal(dir, k, cell, destroys, goal));
                    }
                    push(next);
                    if (destroys) break;
                }
            });
        }
        for (const rock of rocks) {
            if (state.rocks.has(rock.rockId)) continue;
            if (refusedMoves.has(`${key}|break:${rock.rockId}`)) continue;
            const weapon = run.progress('primaryWeapon');
            if (weapon !== 'sword') {
                if (atStart) {
                    rejected.push(phrase.rock(rock.rockId, weapon === null
                        ? 'the run\'s `primary` slot holds NOTHING, so a swing is a SILENT '
                            + 'no-op (`weaponForPress` returns null) — the rock is a WALL to '
                            + 'this route and the sword is the work order'
                        : `the run's \`primary\` slot fires \`${weapon}\`, and only the plain `
                            + 'SWORD breaks a rock in this model — the rock is a WALL to this '
                            + 'route'));
                }
                continue;
            }
            if (!rockBreaksUnder(rock.rockType, run.progress('inventory'))) {
                if (atStart) {
                    rejected.push(phrase.rock(rock.rockId, `\`BreakableRock.hit(_t)\` is `
                        + `\`rockType <= _t\` with \`_t = hasGhostSword ? 1 : 0\`; this rock is `
                        + `rockType ${rock.rockType ?? 0} and the run holds NO ghost sword — `
                        + 'the swing would land and do nothing, so the rock is a WALL to this '
                        + 'route and the GHOST SWORD is the work order'));
                }
                continue;
            }
            let stance = breakStanceUnder(run, rock, bags.exempt, state.player, bags.solid,
                { live: atStart, reaches: atStart ? null : floodReaches, verify: atStart });
            let crossed = [];
            if (stance === undefined && !atStart && crossable.length) {
                const wider = new Set([...bags.exempt, ...crossable]);
                stance = breakStanceUnder(run, rock, wider, state.player, bags.solid,
                    { live: false, reaches: floodReaches, verify: false });
                if (stance !== undefined) crossed = crossable;
            }
            if (stance === undefined) {
                if (atStart) {
                    rejected.push(phrase.rock(rock.rockId, 'no cell within SLASH_REACH of it '
                        + 'both puts the slash rect on the rock and plans a corridor from '
                        + 'here — it is not reachable at this point of the route'));
                }
                continue;
            }
            push({
                block: state.block, rocks: new Set([...state.rocks, rock.rockId]),
                player: stance ?? state.player,
                steps: [...state.steps, { verb: 'break', rock: rock.rockId,
                    rockType: rock.rockType ?? 0, target: { ...rock.rect }, stance,
                    wait: WAIT_AFTER_PRESS_TICKS,
                    ...(crossed.length ? { exempt: crossed } : {}) }],
            });
        }
    }
    if (restart) continue;
    break;
    }
    return { steps: null, rejected, found, expansions, refused: ordersBound ? {
        bound: 'MAX_ROUTE_ORDERS',
        why: `every route the search could reach was cut at ${MAX_ROUTE_ORDERS} orders `
            + `(\`MAX_ROUTE_ORDERS\`) without meeting the \`${goal.kind}\` post-condition`,
    } : {
        bound: null,
        why: `the block-route search exhausted ${expansions} state(s) — no sequence of `
            + `leans and breaks meets the \`${goal.kind}\` post-condition`,
    } };
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
    const live = run.entities('pushables')?.get(row.id);
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
        const otherLive = run.entities('pushables')?.get(other.id);
        if (!otherLive || otherLive.removed) continue;
        if (!OBSTACLE_STRATEGIES[`solid:${other.tag}`]) continue;
        discharged.push(other.id);
    }
    /**
     * ⛓⛓⛓ R9 SLICE L15 — THE SCAN IS THE SEARCH'S START LAYER (§54.4). The
     * per-(dir, k) questions above are asked by `deriveBlockRoute` in exactly
     * this order and phrased in this function's own words, so a room that
     * answers in ONE lean returns the record it always did (`shoveWeighParity
     * .test.js` measures that); a room that needs breaks and further leans
     * — L15 — returns step 1 in the same fields plus `route`.
     */
    const route = deriveBlockRoute(run, row, { kind: 'clear-path', aim, allowTeleporter },
        contacts, blocked, { discharged });
    const { rejected, found } = route;
    if (!route.steps) {
        if (route.refused?.bound) {
            /**
             * ⛔ A CUT SEARCH IS NOT "NO ROUTE". Exhausting the space returns
             * `null` (today's refusal shape); hitting a bound refuses BY NAME,
             * because "I could not decide" and "there is none" are different
             * claims and only the second is the frontier's to report.
             */
            throw new SolverRefusal(`solverBot: the block-route search for ${row.id} in `
                + `level ${run.level} hit \`${route.refused.bound}\` — ${route.refused.why}`,
            { obstacle: { kind: 'solid', id: row.id },
                bound: blockRouteBound(route, row, 'clear-path') });
        }
        return { plan: null, rejected, discharged, refused: route.refused };
    }
    /**
     * ⛔ NON-DESTRUCTIVE FIRST, THEN SMALLEST `k`, THEN THE TABLE'S OWN
     * DIRECTION ORDER. The first key is the ruling; the second is the ruling's
     * own "MINIMUM tiles"; the third exists because an emitted tape is an
     * artifact and a tie broken by iteration order is a tie broken by nothing.
     */
    found.sort((a, b) => (a.destroys ? 1 : 0) - (b.destroys ? 1 : 0)
        || a.k - b.k || a.dirIndex - b.dirIndex);
    const first = route.steps[0];
    if (route.steps.length === 1 && first.verb === 'shove') {
        if (!found.length || found[0].dir !== first.dir || found[0].k !== first.k) {
            fail(`solverBot deriveShove(${row.id}): the search's one-step route `
                + `${first.dir} k=${first.k} is not the scan's own first choice `
                + `${found[0] ? `${found[0].dir} k=${found[0].k}` : 'NONE'} — the two `
                + 'orderings have parted, and a one-step record must be today\'s');
        }
        return { plan: found[0], rejected, alternatives: found.slice(1), discharged };
    }
    /**
     * ⛔ A ROUTE THAT NEVER LEANS IS NOT A SHOVE. The frontier named this
     * BLOCK, but if the search's whole answer is "break a rock" the door was
     * the rock, and a `shove` record with no lean in it would spell a verb
     * the room does not need. Refused here by name (the frontier's obstacle
     * order is out of this slice's scope, §54.10); the rejection says which
     * rock to name instead.
     */
    const lean = route.steps.find((st) => st.verb === 'shove');
    if (!lean) {
        return { plan: null, discharged, rejected: [{
            option: 'a route with no lean',
            why: `the search's only answer moves no block: ${describeRoute(route.steps)}. `
                + `${row.id} is not the door — the rock is — and a shove record cannot `
                + 'carry a verb the room does not need; name the rock.',
        }, ...rejected] };
    }
    return {
        plan: { dir: lean.dir, dirIndex: lean.dirIndex, k: lean.k, to: { ...lean.to },
            destroys: lean.destroys },
        route: route.steps, rejected, alternatives: [], discharged,
    };
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
 *   · a PICKUP's stance is a walkable lattice cell OUTSIDE its avoid volume,
 *     found by ring search (the pickup's own cell is refused by the planner —
 *     kickoff: "a leg that aimed AT the sword would be refused by name", and
 *     ⚖ ruling 46's own measurement is why that refusal STAYS); `runCollect`'s
 *     approach loop drives the last pixels from there, exactly as it did from
 *     a hand-authored stance. ⛓ R9 slice 12d′, ⚖ ruling 46: WHICH cell is the
 *     one the whole errand is cheapest THROUGH — the corridor the walk drives
 *     plus the line the approach presses — not the one nearest the pickup. See
 *     the scoring block below for the measurement that moved it.
 */
/**
 * ⛓ R9 SLICE P2 — `economies` IS ⚖ 46's OWN PERMISSION, DEFAULTED TO THE
 * ROSTER-WIDE FLAG. Exactly the shape `strikePolicyFor`'s `dashPlan` already
 * has: the permission handed directly IS the grant, which is what lets the
 * offline proof — and this file's ⚖ 46 rows — run at a `false` head. The
 * chest arm returns above this, so `resolveChestStrategy`'s call leaves it
 * defaulted on purpose.
 */
function deriveStance(run, resolved, contacts,
    { economies = ECONOMIES_ROSTER_WIDE } = {}) {
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
    /**
     * ⛓ R9 SLICE 12d′ — `route` IS `plans` WITH ITS ANSWER KEPT. The corridor
     * is planned either way; throwing the waypoint list away and re-planning it
     * to measure the walk would be two derivations of one route, which is the
     * defect this file spends its docblocks refusing. `plans` stays as the
     * boolean spelling for the callers that only ask a yes/no.
     */
    const route = (from, to, opts) => {
        try {
            return planWaypoints(run.world, from, to, null, opts);
        } catch (e) {
            if (!(e instanceof BotDriverV2Error)) throw e;
            return null;
        }
    };
    const plans = (from, to, opts) => route(from, to, opts) !== null;
    const canCollectFrom = (c) => plans({ x: c.x, y: c.y }, centre, approachOpts);
    /**
     * ⛓ THREE PASSES, AND THE THIRD IS THE COMMITTED CORE'S OWN ANSWER — so
     * this filter can never make a room worse than it was at `238f0dbe9`. If
     * NOTHING can collect the pickup as the world currently stands, the filter
     * has no opinion left to offer and the ladder gets the nearest cell, which
     * is exactly what the slice's first half already did.
     */
    /**
     * ⛓⛓⛓ R9 SLICE 12d′, ⚖ RULING 46 — **THE STANCE IS THE ONE THE WHOLE
     * ERRAND IS CHEAPEST THROUGH, NOT THE ONE NEAREST THE PICKUP** (user,
     * 2026-08-24: *"It first walks around the item to specifically reach the
     * tile to the north of the item, and then walks one tile south from there.
     * It should just plan a path directly to the item."*).
     *
     * ⛔ THE DETOUR WAS NEVER THE AVOID VOLUME. It is the `(d, y, x)` order
     * above: among the four cells at `d = 16` the smallest `y` is the NORTH
     * one, so **north wins every tie whichever side the walk arrives from**.
     * Measured on `shield@112,48` (L20, centre `(120,56)`, boot state
     * `(200,72)`): the corridor to the ring stance is FIVE waypoints
     * `(200,104) → (168,104) → (168,56) → (136,56) → (120,40)` and
     * `runCollect` then presses 16 px back SOUTH — while `(136,56)` is itself
     * at `d = 16`, collectable, and ALREADY ON THAT CORRIDOR. On
     * `sword@48,48` (L10, centre `(56,56)`) the walk is spurious outright: the
     * stance `(40,56)` costs 30 walk + 11 approach ticks where the BOOT cell
     * `(56,88)` collects in 24 with no walk at all — 70 t against 53 t.
     *
     * ⇒ **THE APPROACH KEEPS ITS RING AND THE WALK BREAKS THE TIE.** Among the
     * candidates that can collect and that a corridor reaches, take the ones at
     * the MINIMUM `d` — the shortest approach, exactly the population the
     * committed core already drove — and among THOSE take the shortest corridor,
     * then `(y, x)` so the emitted tape stays deterministic.
     *
     * ⛔⛔ AND THE `d` TIER IS NOT DECORATION — IT IS A MEASURED SAFETY BOUND,
     * paid for by a red I caused and then attributed. The first cut of this
     * scored `walk + d` outright, which on L10 preferred the boot cell at
     * `d = 32` (70 t → 53 t, real) and on L20 preferred a stance whose straight
     * approach crosses WATER: `r8-solve-20` refused by name — *"the player
     * entered Water in level 20 at (158.96, 95.76) on a tape that does not pin
     * `sound`"*. `canCollectFrom` is a TILE-PATH probe and its own docblock
     * says it is WEAKER THAN THE DRIVE IT MODELS — it answers "same walkable
     * component", not "clear line" — so a longer approach is a longer bet on a
     * question this function cannot ask. The CONTROL: at the same head with
     * only the dash flip, `r8-solve-20` solves in 267 t through the ring stance
     * `(120,40)` and its five-waypoint corridor. ⚖ Ruling 35 puts safety over
     * speed: the detour goes, the approach does not grow. [[feedback_certify_with_what_the_walk_can_have]]
     *
     * ⛔⛔ AND THE PICKUP'S OWN CELL STAYS REFUSED — the avoid-volume rule
     * encodes a GAME FACT, re-measured for this slice rather than inherited.
     * Every placed `Pickup` subclass is `special` with non-empty text, so
     * `pick_up()` raises `Game.freezeObjects` and spawns an NPC that only
     * `Input.released(keys[6])` dismisses (`NPCs/NPC.as:191`); `drive` presses
     * MOVEMENT keys and has no ceremony cadence. Driving straight at
     * `sword@48,48`'s centre from `r8-solve-10`'s boot burns the whole
     * 400-tick budget frozen at `(56,61.65)` with `collected 0` — L89's
     * feather stall, reproduced on demand. So the ceremony stays
     * `runCollect`'s, and its approach loop is KEPT: it IS the "path directly
     * to the item" the ruling asks for.
     *
     * ⚠ THE COST IS EXHAUSTIVE SCORING where the old order short-circuited:
     * every candidate is routed rather than the first one that fits. The
     * candidate set is bounded by the ring search (≤ 48 cells) and a collect
     * goal is rare, so this is a planner cost, not a walk cost.
     */
    /**
     * ⛓⛓⛓ R9 SLICE P2, ⚖ RULING 54 (5) — **THE ECONOMY IS BEHIND THE
     * ROSTER-WIDE PERMISSION, AND IT IS THERE BECAUSE IT WAS MEASURED TO MOVE
     * COMMITTED SOLVES AT `false`** (user, 2026-08-25: *"the economies behind
     * the roster-wide flag so every solver change lives on `main` inert"*).
     *
     * ⛔ IT IS NOT A DEFENSIVE GATE. P2's design says an economy is gated ONLY
     * if it is measured NOT to be naturally inert, and the gate's docblock
     * names the movers that forced it. Cherry-picked un-gated onto `main` at
     * `ECONOMIES_ROSTER_WIDE === false` (the constant was
     * `ALLOW_DASH_ROSTER_WIDE` until 12j cut ⚖ 54 (5)'s yoke — same state,
     * its own name now), this block moves FOUR committed
     * artifacts by name and five of seven producer `--check` md5s with them:
     *
     * ⛓ ⛔ THESE FOUR ARE PRE-RE-RECORD NUMBERS — measured on `main` before
     * ⚖ 41's flip, with the dash OFF. The roster was re-recorded at the flip,
     * so they no longer name today's artifacts; `ECONOMIES_ROSTER_WIDE`'s own
     * docblock carries the census re-measured at THIS head (12j).
     *
     *   · `r8-solve-10`   90 → 89   (campaign segment 10; battery prints it)
     *   · `r8-solve-20`  365 → 332  (`solve-seedling-r8-d2-chain`)
     *   · `r8-d2-19`     864 → 807  (`solve-seedling-r8-d2`)
     *   · `r8-d2-20`     781 → 756  (`solve-seedling-r8-d2`)
     *   ⇒ the `r8-d2` headline 2186 → 2000
     *
     * Those are §31.6's (E₀) column — *"economies, NO flip"* — reproduced at
     * this head to the digit for the three `r8-d2` rows. So the flip and the
     * stance are ONE permission said two ways (⚖ 42's tail, ⚖ 51): at `false`
     * the committed corridors are the committed corridors, and the re-record
     * series is what turns both on together.
     *
     * ⛓ THE `route`/`plans` REFACTOR ABOVE IS NOT GATED — `plans` is spelled
     * in terms of `route` and returns the same boolean, so it moves nothing.
     * Only the CHOICE is gated, which is the whole of what ⚖ 46 changed.
     *
     * ⚠ THE COST IS EXHAUSTIVE SCORING where the old order short-circuited:
     * every candidate is routed rather than the first one that fits. The
     * candidate set is bounded by the ring search (≤ 48 cells) and a collect
     * goal is rare, so this is a planner cost, not a walk cost — and at
     * `false` it is not paid at all.
     */
    if (economies) {
        const walkOpts = solverPlanOpts(run, contacts);
        const pathLength = (from, wps) => {
            let total = 0;
            let at = from;
            for (const wp of wps) {
                total += Math.hypot(wp.x - at.x, wp.y - at.y);
                at = wp;
            }
            return total;
        };
        const scored = [];
        for (const c of candidates) {
            if (!canCollectFrom(c)) continue;
            const wps = route(run.state, { x: c.x, y: c.y }, walkOpts);
            if (wps === null) continue;
            scored.push({ ...c, walk: pathLength(run.state, wps) });
        }
        if (scored.length > 0) {
            const nearest = Math.min(...scored.map((c) => c.d));
            const tier = scored.filter((c) => c.d === nearest);
            tier.sort((a, b) => a.walk - b.walk || a.y - b.y || a.x - b.x);
            const c = tier[0];
            return { x: c.x, y: c.y, corridor: true };
        }
    } else {
        /**
         * ⛔ THE COMMITTED CORE'S OWN ORDER, RESTORED VERBATIM — the ring
         * search's `(d, y, x)` short-circuit, first candidate that both plans
         * a corridor and can collect. This is the arm every committed tape on
         * `main` was solved through, and the four artifacts above are the
         * measurement that says so.
         */
        for (const c of candidates) {
            if (plans(run.state, { x: c.x, y: c.y }, solverPlanOpts(run, contacts))
                && canCollectFrom(c)) {
                return { x: c.x, y: c.y, corridor: true };
            }
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
        const shut = group.filter((a) => !run.entities('openActivators').has(a.id));
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
                test: (r) => shut.every((a) => r.entities('openActivators').has(a.id)),
            },
        };
    }
    if (traps.length > 0) {
        const bodies = run.entities('chasers').length;
        if (bodies > 0) {
            return {
                ticks: bodies * ARROW_KILL_FLOOR + HOLD_SLACK,
                until: {
                    why: `every bridged chaser in level ${run.level} has been removed by `
                        + 'the room\'s own ceiling — the observable the Arrow x Enemy '
                        + 'family added (R8 slice 3)',
                    test: (r) => r.entities('chasers').length === 0,
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
    // ⛓ SF1: asked only once a candidate's direct plan fails — and `walls` is
    // filled by that same ask, so every reader below forces it first.
    const hypothesis = lazyStanceHypothesis(run, blocked, contacts, walls);
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
        ? stancePrerequisite(run, candidates, exempt, hypothesis(), contacts, blocked) : null;
    if (pre) {
        return {
            stance: pre.stance,
            exempt,
            discharged: [],
            prerequisite: pre.prerequisite,
        };
    }
    const clause = prerequisites ? prerequisiteRefusalClause(run, hypothesis(), walls, blocked) : '';
    const sealed = sealedBehindWall(run, presser, candidates, exempt, walls);
    const refusal = new SolverRefusal(
        `solverBot: no REACHABLE stance inside ${presser.tag}@${presser.x},${presser.y} `
        + `in level ${run.level} — ${candidates.length} cell(s) land the player box in `
        + 'the button and none of them plans a corridor from '
        + `(${run.state.x},${run.state.y}). A hold that cannot be stood on is not a `
        + 'strategy for this obstacle.'
        + clause + (sealed ? sealedRefusalClause(sealed) : ''),
        { obstacle: { kind: 'proximity-hazard', id: `${presser.tag}@${presser.x},${presser.y}` } });
    // ⛓ RETURN: an optional instance field, set after construction so the
    // constructor's own field list is untouched. Absent unless the stance is
    // sealed behind a guard-(iii) wall.
    if (sealed) refusal.sealed = sealed;
    throw refusal;
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY RETURN — **THE PRESSER IS SEALED BEHIND A WALL**, and
 * the refusal says which one.
 *
 * Measured on L15 (`Dungeon2_2`) on the way back from L16 (the RETURN report,
 * D1). The forward trip shoves `pushableblock@64,64` onto `button@112,32`, and
 * that opens `lock@128,48` (tset 0). The return re-builds the room, and in the
 * game the lock comes back CLOSED whatever its tag:
 *   - `Lock.check()` removes a lock only when `tSet < 0` (`Lock.as:39-46`);
 *   - `PushableBlock` reads no persistence, so the block is back at (64,64).
 * The game's own stream (`return-l15-reentry`, and `-unclear` without the
 * clears) is held at x 146.5 by the lock. The arrival column (x 144..159) is
 * closed by Water to the south (`Player.as:1456`, no `canSwim`). So the button
 * and the block both lie on the far side of the very lock the button opens.
 *
 * Before this, the refusal was right (it is `cannot` in the game too) but it
 * was named wrong. Guard (iii)'s wall reads *"NO block in this room can reach
 * it"*, and a reader takes that for a fact about the room. `deriveWeigh` asks
 * it from the walker's side, and the forward trip is a block that DID reach it.
 *
 * ⇒ one more question, asked only on the throw path, so no plan that solves
 * pays for it. For each guard-(iii) wall: does a stance candidate plan once
 * THAT wall is discharged (opened, and its volume exempted, as
 * `stanceReaches` does)? If one does, the presser is sealed behind that wall.
 * `ownOpener` says the wall is one this presser itself opens (L15's shape:
 * nothing on this side can ever open it). The candidate list is the caller's,
 * in the caller's order.
 */
function sealedBehindWall(run, presser, candidates, exempt, walls) {
    const presserId = `${presser.tag}@${presser.x},${presser.y}`;
    for (const w of walls) {
        const opener = openerPresserFor(run, { id: w.id, tag: w.tag });
        const through = new Set([...exempt, `proximity-hazard:${w.id}`]);
        const bag = bagWithDischarged(run, run.liveGeometryOpts(),
            [{ id: w.id, kind: 'activator', tag: w.tag }]);
        for (const c of candidates) {
            if (!corridorPlans(run.world, run.state, { x: c.x, y: c.y }, null,
                solverPlanOpts(run, through, { liveBag: bag }))) continue;
            const openerId = opener ? `${opener.presser.tag}@${opener.presser.x},${opener.presser.y}` : null;
            return {
                wall: w.id,
                presser: presserId,
                ownOpener: openerId === presserId,
                group: opener ? opener.group : null,
                from: { x: run.state.x, y: run.state.y },
                stance: { x: c.x, y: c.y },
            };
        }
    }
    return null;
}

/** The sentence `sealedBehindWall`'s answer owes the refusal. */
function sealedRefusalClause(s) {
    return ` ⛔ SEALED BEHIND ${s.ownOpener ? 'ITS OWN LOCK' : 'A WALL'}: with ${s.wall} discharged `
        + `a corridor from (${s.from.x},${s.from.y}) reaches the stance (${s.stance.x},${s.stance.y}); `
        + `with it shut none does. ${s.ownOpener
            ? `So ${s.presser} lies on the far side of the very lock it opens (group t=${s.group}), `
                + 'and no block on this side can reach it: the "no block in this room" above is '
                + 'asked from the walker\'s side of that lock. An earlier visit that opened it '
                + 'does not carry over: a tSet ≥ 0 lock is rebuilt closed whatever its tag '
                + '(`Lock.as:39-46`), and a pushable block is rebuilt at its placement'
            : `${s.wall} is a wall nothing on this side can redeem durably (guard iii)`}. `
        + 'From this arrival, with this inventory, the button is out of reach. That is a '
        + 'fact about the room, not a rung the ladder lacks.';
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
        const live = run.entities('pushables')?.get(row.id);
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
        const live = run.entities('pushables')?.get(row.id);
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
        if (wall.has(a.id) || run.entities('openActivators').has(a.id)) continue;
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
 * ⛓⛓⛓ SEEDLING FIDELITY SF1 — **THE HYPOTHESIS IS ASKED ONLY WHEN A DIRECT
 * PLAN HAS FAILED**, which is the only place `stanceReaches` ever read it.
 *
 * ⛔ WHY IT WAS A COST AND NOT A VALUE. Every stance derivation (hold, fight,
 * keylock, touch, swing) computed `stanceHypothesis` BEFORE its first
 * candidate, and a `weigh` activator in the room makes that a `deriveWeigh` →
 * `deriveBlockRoute` search. MEASURED (the l16-budget report §2): on L16's
 * live arrival that search was ~30 % of the full solve and ~80 % of the
 * dashless one, for a plan whose verbs are `pull, walk` — a stance reached
 * directly, so the hypothesis was never read.
 *
 * ⇒ a thunk, memoised: the first candidate that fails its direct plan asks
 * it, every later one reuses the answer, and a derivation whose first
 * candidate reaches pays nothing. The value is the eager one exactly (same
 * arguments, same `walls` out-parameter), so a stance that needed it gets the
 * same hypothesis it always got.
 *
 * ⚠ THE ONE DIFFERENCE IS A THROW. `deriveWeigh` can throw (a block-route
 * bound, or its own `fail`); eagerly that throw escaped even when a candidate
 * was then reached directly. Lazily it escapes only when the hypothesis is
 * read. Measured over every solve the SF slice could run: the eager call never
 * threw (SF report, D1), so no committed solve depends on the old order.
 */
function lazyStanceHypothesis(run, blocked = [], contacts = NO_CONTACTS, walls = []) {
    let memo = null;
    // ⛓ SF2: a reached deadline answers "nothing to hypothesise" (and memoises it).
    return () => (memo ??= deadlineReached('stance-hypothesis')
        ? [] : stanceHypothesis(run, blocked, contacts, walls));
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
function stanceReaches(run, aim, contacts, hypothesisOf) {
    try {
        planWaypoints(run.world, run.state, aim, null, solverPlanOpts(run, contacts));
        return { discharged: [] };
    } catch (e) {
        if (!(e instanceof BotDriverV2Error)) throw e;
    }
    const hypothesis = hypothesisOf();
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
    if (resolved.latched === true && resolved.stance === null) {
        return runLatchedWait(run, perTick, resolved, ctx.what);
    }
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
    return execRoute(run, perTick, resolved, ctx, ctx.what);
}

/**
 * ⛓⛓⛓ R9 SLICE L15 — THE ROUTE, EXECUTED STEP BY STEP (§54.4).
 *
 * `resolved.route ?? [step 1]` is walked in order: a lean is `runShove`
 * (trap 146's closed form, the verb's own), a break is `execBreak`'s body —
 * ONE function, called here and from the strategy table — and between a
 * break and the next lean the executor waits the break's `wait`, which is
 * `execBreak`'s own exit condition (`pressedAt + wait`), because the rock is
 * Solid for its whole animation. ⛔ AFTER EVERY STEP THE POST-CONDITION IS
 * ASSERTED AGAINST THE LIVE RUN — the block's tile is `to` (`run.pushables`)
 * or gone when the step destroys; the rock is in `run.brokenRocks` — and a
 * step that leaves the world elsewhere refuses BY NAME with its index. The
 * walk between steps is the loop's own `walkTo`, no new driver verb.
 *
 * ⚠ A ONE-STEP ROUTE RETURNS `runShove`'s RECORD UNCHANGED — the trace
 * sidecars are byte-compared, so `steps` rides only when there are two or
 * more.
 */
function execRoute(run, perTick, resolved, ctx, what) {
    const route = resolved.route ?? [{ verb: 'shove', ...resolved.shove }];
    const refuse = (why) => {
        throw new SolverRefusal(why, { obstacle: { kind: 'solid', id: resolved.target?.id
            ?? `pushableblock@${resolved.shove.block.x},${resolved.shove.block.y}` } });
    };
    const tileOf = (l) => ({
        tx: Math.floor(l.rect.x / TILE_SIZE), ty: Math.floor(l.rect.y / TILE_SIZE),
    });
    const blockRow = () => resolveWalkPushableId(run, resolved.shove.block);
    const steps = [];
    let last = null;
    route.forEach((step, i) => {
        const label = `${what}${route.length > 1 ? ` (route step ${i + 1}/${route.length}: `
            + `${step.verb})` : ''}`;
        if (i > 0 && step.stance) {
            ctx.walkTo(ctx.goal, step.stance, { what: `${label} stance`,
                ...(step.exempt ? { contactsOverride: step.exempt } : {}) });
        }
        const from = perTick.length;
        if (step.verb === 'shove') {
            last = runShove(run, perTick, {
                block: resolved.shove.block, dir: step.dir, to: step.to,
                ...(step.destroys ? { destroys: true } : {}),
                ...(ctx.idleStrike ? { strike: ctx.idleStrike } : {}),
            }, label);
            const live = run.entities('pushables').get(blockRow());
            if (step.destroys ? !live?.removed
                : (!live || live.removed || tileOf(live).tx !== step.to.tx
                    || tileOf(live).ty !== step.to.ty)) {
                refuse(`${label}: after the lean the block is ${!live || live.removed
                    ? 'GONE' : `on (${tileOf(live).tx},${tileOf(live).ty})`}, not `
                    + `${step.destroys ? 'destroyed' : `on (${step.to.tx},${step.to.ty})`} `
                    + `as route step ${i + 1} requires. The search priced the world one way `
                    + 'and the run answered another — a rock, a Solid or a sink the '
                    + 'transcription does not know about.');
            }
        } else if (step.verb === 'break') {
            const rec = execBreak(run, perTick, {
                held: true, rock: step.rock, target: step.target, stance: step.stance,
                wait: step.wait, rejected: [],
            }, { ...ctx, what: label });
            if (!(run.entities('brokenRocks') ?? new Set()).has(step.rock)) {
                refuse(`${label}: ${step.rock} is not in the run's \`brokenRocks\` after `
                    + `route step ${i + 1}'s swing returned. The verb's own wait covers the `
                    + 'animation, so a rock still standing is a disagreement, not a budget.');
            }
            steps.push({ verb: 'break', ticks: rec.ticks, from, rock: step.rock });
            return;
        } else {
            refuse(`${label}: route step ${i + 1} has verb \`${step.verb}\`, which this `
                + 'executor does not run');
        }
        steps.push({ verb: 'shove', ticks: last.ticks, from, to: step.to });
    });
    if (route.length === 1) return last;
    return { ...last, steps, ticks: steps.reduce((n, st) => n + st.ticks, 0) };
}

/** The live id of the routed block, from the record coordinates the leg names. */
function resolveWalkPushableId(run, block) {
    const row = (run.world.pushables ?? []).find((p) => p.x === block.x && p.y === block.y);
    return row ? row.id : null;
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
    /**
     * ⛓⛓⛓ R9 SLICE L16 — THE FADE IS ARMED (⚖ ruling 30(b): the opportunistic
     * strike is a per-tick policy on EVERY walk, and a fade the player stands
     * through is one). L16's fade is waited out at (280.8,80) with `bob@224,96`
     * chasing along the wall below: unarmed, the dwell was HIT on its sixth
     * tick. `strikePolicyFor` is `null` in a room with no strike bodies, so a
     * fade in an empty room (L15's) spends exactly the ticks it always did.
     *
     * ⛔ AND THE ROUTE'S OWN IDLE TICKS WITH IT. Arming only the fade was
     * measured too late: the player stood unarmed through the last lean's
     * SETTLE (28 ticks at (280.8,80)) while the bob walked into contact range,
     * and the fade was hit on its second tick. So ONE policy covers the verb's
     * idle spans — each lean's settle window and each break's wait
     * (`ctx.idleStrike`) and the fade — and never a LEAN tick, whose held key
     * is the push. A plain `shove`/`break` is handed none.
     */
    const strike = strikePolicyFor(run, { dashMode: ctx.dashMode ?? DEFAULT_DASH_MODE });
    const armed = (d) => (strike ? { ...d, strike } : d);
    if (resolved.dwellOnly) {
        const only = runDwell(run, perTick, armed(resolved.dwell),
            `${ctx.what} (fade, block already home)`);
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
    const shove = execRoute(run, perTick, resolved, { ...ctx, idleStrike: strike }, `${ctx.what} (park the block)`);
    const dwell = runDwell(run, perTick, armed(resolved.dwell), `${ctx.what} (fade)`);
    return {
        kind: 'weigh',
        postCondition: 'press',
        presser: { ...resolved.target },
        shove,
        dwell,
        ...(shove.steps ? { steps: shove.steps } : {}),
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
 *             (⛓ F4: every static class but the ones `STATIC_ARROW_DEATH`
 *             lists, whose death the run computes and whose removal writes
 *             the tag itself — `SandTrap`, witnessed on `f4-l8-sandtraps`.)
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
    const live = new Set((run.entities('chasers') ?? []).map((c) => c.id));
    const bridged = new Set(bridgedChaserTags());
    // ⛓ KILLLOCK K4: a turret corpse the run has REMOVED (drowned, fallen) has left the count.
    const turrets = KILLLOCK_BODIES.turretRemovalLedger ? run.entities('turrets') : null;
    return census.filter((e) => {
        const id = `${e.tag}@${e.x},${e.y}`;
        if (stepped && bridged.has(e.tag)) return live.has(id);
        if (turrets?.get?.(id)?.removed === true) return false;
        return true;
    });
}

/**
 * ⛓ KILLLOCK K3 — can the kill work order's CHASER arm take this count? Every counted body left must be a live
 * body the run steps as a strike target (`run.entities('strikeBodies')`) whose class `KILL_ARM_POLICY` calls
 * `modelled`, and the run must hold a sword. Returns the ids, or the first reason it cannot.
 */
function deriveChaserKillOrder(run, bodies) {
    const strike = new Map((run.entities('strikeBodies') ?? []).map((b) => [b.id, b]));
    const ids = [];
    for (const e of bodies) {
        const id = `${e.tag}@${e.x},${e.y}`;
        // ⛓ K4: a stepped ice turret is killed in place (`killIceTurretInPlace`), not hunted.
        if (e.tag === 'iceturret' && KILLLOCK_BODIES.turretRemovalLedger
            && run.entities('turrets')?.get?.(id) && KILL_ARM_POLICY.IceTurret?.policy === 'modelled') {
            ids.push(id);
            continue;
        }
        const b = strike.get(id);
        if (!b) {
            return { ok: false, why: `${id} is counted and is not a live body this run steps — the chaser arm `
                + 'needs every counted body\'s live position (a static or unstepped body is another arm\'s)' };
        }
        if (!armIsModelled(b)) {
            return { ok: false, why: `KILL_ARM_POLICY.${b.enemyClass ?? b.as3} is not \`modelled\`, so a press `
                + `against ${id} is not something this model may claim` };
        }
        ids.push(id);
    }
    const inv = run.progress('inventory') ?? {};
    if (!(inv.hasSword || inv.hasGhostSword)) {
        return { ok: false, why: 'this run holds no sword, so `set slashing`\'s outer gate refuses every press' };
    }
    return { ok: true, ids };
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
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY KILLLOCK K3 — **THE CHASER ARM OF THE KILL WORK ORDER**, asked only when the room's
     * own ceiling has nothing to arm (so every room the ceiling already solves keeps its arm) and only under
     * `KILLLOCK_BODIES.chaserKillArm`. L60, L71, L98 and L99 hold no spinner and no arrow trap: their count is
     * chasers (jellyfish, lavarunners). When EVERY counted body left is a live body this run steps and a
     * `modelled` press target, the weapon is the player's own press and the stance is the combat ladder's
     * chaser arm (`deriveKillByChaser`): stand where the body comes, let the one strike policy press it.
     */
    if (!weapon.presser && KILLLOCK_BODIES.chaserKillArm) {
        const chaser = deriveChaserKillOrder(run, bodies);
        if (chaser.ok) {
            return {
                strategy: 'kill',
                arm: 'chaser',
                postCondition: 'kill-lock',
                target: { x: row.x ?? obstacle.x, y: row.y ?? obstacle.y },
                lock: row,
                stance: null,
                contacts,
                bodies: chaser.ids,
                rejected: [{
                    option: 'kill by the room\'s own ceiling',
                    why: weapon.why,
                }, {
                    option: 'hold',
                    why: `${obstacle.id} carries \`tset == ${KILL_LOCK_TSET}\`, so NO button `
                        + 'in the game answers it — `checkEnemies()` opens it when '
                        + '`Game.totalEnemies()` reaches zero (§12.8).',
                }, ...press.rejected],
            };
        }
        press.rejected.push({ option: 'kill the chasers by press (KILLLOCK K3)', why: chaser.why });
    }
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
    const live = run.entities('spinnerBodies') ?? [];
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
    /**
     * ⛓⛓ SEEDLING SWIM U4b — **A PRESS WITHOUT A SWORD IS NOT A KILL.** The
     * lock-less arm asked `primaryWeapon` before it called this; the KILL-LOCK
     * arm (`execKill`) never did. Its without-sword runs refused only because
     * the refuge wall fired first (*"nowhere to be"*). With the hammer priced
     * at its own tick that wall is gone, and `generateSeedlingLevel` seed 14's
     * `--require=hasSword` without-arm planned 278 strikes, landed 0, and
     * exhausted the 2010-tick bound (STRONG → BOUND-DEPENDENT). So the question
     * is asked here, for both callers, in the lock-less arm's own words —
     * LAST, after every per-body refusal, so each sentence this arm already
     * said keeps its place (L5's committed trace records *"tracks NO live
     * spinner bodies"*; an un-modelled body names `KILL_ARM_POLICY`), and the
     * weapon is asked only where a modelled live spinner is there to press.
     */
    const weapon = run.progress('primaryWeapon');
    if (weapon !== 'sword') {
        return no([{
            option: 'press a body',
            why: `the run's \`primary\` slot ${weapon === null ? 'holds NOTHING' : `fires \`${weapon}\``}`
                + ' — the kill this arm derives is a SWORD press (`KILL_ARM_POLICY.Spinner`). '
                + 'The sword is a SUB-ORDER the macro layer owes.',
        }]);
    }
    /**
     * ⛓ U4b D3 — the ADMISSION question ("is there a strike in this horizon at
     * all?") is asked once, so it may continue past the bounded pass; the
     * executor's per-tick re-derivations stay bounded, and adopt this strike
     * only when the continuation is what found it (`execKillByPress`).
     */
    const first = deriveStrike(run, `${bodies[0].tag}@${bodies[0].x},${bodies[0].y}`,
        contacts, 0, { continuation: true });
    if (!first || !first.cell) {
        rejected.push({
            option: 'a strike schedule',
            why: `no (cell, tick) in level ${run.level} over the next `
                + `${strikeHorizon(run)} ticks puts the whole five-dispatch train inside `
                + `${SLASH_REACH} px of a body while the player box stays clear of every `
                + `body's 7x7 rect and of ${hammerTestAt(run)} AND is reachable in time `
                + `along a transit-safe corridor. ${first?.considered ?? 0} `
                + 'opportunit(ies) were considered.'
                // ⛓ U3 D2 — named only when the line of sight skipped any, so
                // a refusal it did not touch keeps its text byte for byte.
                + ((first?.sighted ?? 0) > 0
                    ? ` ${first.sighted} (cell, tick) pair(s) were SKIPPED because the swing's `
                        + 'line to a body\'s entity point crosses a Solid (`Player.slash`\'s '
                        + 'line-of-sight gate, asked through `run.collideLineSolid`).'
                    : '')
                // ⛓ U6 D1 — named only when the dwell skipped any.
                + ((first?.dwelt ?? 0) > 0
                    ? ` ${first.dwelt} reachable strike(s) were SKIPPED because the DWELL — `
                        + 'standing on the cell from the walk\'s arrival to the train — '
                        + 'meets a body or its hammer.'
                    : '')
                // ⛓ U4b D3 — named only when the continuation previewed a cell.
                + ((first?.continued ?? 0) > 0
                    ? ` The scan then CONTINUED past them in tick order to +${strikeHorizon(run)} `
                        + `and previewed ${first.continued} more cell(s) (bound `
                        + `${STRIKE_CANDIDATES}); none is reachable in time along a `
                        + 'transit-safe corridor.'
                    : ''),
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
 * ⛔ THE INDEX CONVENTION IS THE RUN'S OWN CONTACT: `forecast[i]` is the bodies
 * as `stepSpinners` leaves them in the advance from `ticksCompleted + i`, and
 * that same advance bills them (`stepSpinnerContactsNow`) at `clock.now()`
 * BEFORE its `clock.tick()` — so the clock there is `gameTimeAt(i)`.
 *
 * ⛓⛓ SEEDLING SWIM U4b — THIS SENTENCE USED TO SAY `gameTimeAt(i + 1)`, and
 * the census chamber's (7,6) is what it cost. The press was priced clear at
 * `Game.time` 4885 and the run billed the hammer at 4884: a hit the plan never
 * saw, then a steer-blocked preview that stalled every refuge walk — which
 * printed as *"the room has nowhere to be"* with 39 cells clear for the whole
 * window. `spinnerClockPairing.test.js` drives the law: over 27 placements
 * whose first contact is the hammer, the same-index pairing names the hit tick
 * 27 times in 27 and the old one missed it 20 times. It was a wrong answer
 * that looked right 44 times in 45, which is the sentence this paragraph used
 * to warn about in the other direction.
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

export function clearOfHammersAt(run, box, forecast, i) {
    const step = forecast[i];
    if (!step) return false;
    const at = typeof run?.gameTimeAt === 'function' ? run.gameTimeAt(i) : null;
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
export function discClearanceAt(box, forecast, i) {
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

/**
 * ⛓⛓ SEEDLING SWIM U3 (D2) — **THE SWING'S LINE OF SIGHT, ASKED BEFORE IT IS
 * PLANNED.** `Player.slash` refuses a hit whose line from the player's entity
 * point to the body's crosses a Solid, and `levelRun` refuses to model that
 * miss (`assertSpinnerLineOfSight`: it throws). Until the run exposed the
 * query (`run.collideLineSolid`, U3 D1) the schedule could not ask it, so a
 * swing through the corner of a wall was planned and the run refused it at the
 * hit (U1's (2,2)). ⇒ the SAME predicate, asked of every body the dispatch
 * train could test: the slash rect from `from` at `dir` overlaps it and it is
 * within `SLASH_REACH` — the run's own two gates before the line.
 *
 * ⚠ THE WINDOW IS ONE WIDER THAN THE TRAIN. The five hit tests read the bodies
 * at forecast indices `i .. i + SLASH_HIT_TICKS - 1` (the press at
 * `ticksCompleted + i`, tests at `+1 .. +5`, `forecast[j]` = the top of tick
 * `ticksCompleted + 1 + j`); `i + SLASH_HIT_TICKS` is included for the same
 * pairing reason the hammer window is widened. A strike it drops for that one
 * tick was a strike the run might have refused.
 *
 * @returns {?{tag, at:{x, y}}} the first blocker, or null
 */
function strikeLineBlocked(run, from, dir, forecast, i) {
    const rect = slashRect(from.x, from.y, dir);
    for (let k = 0; k <= SLASH_HIT_TICKS; k += 1) {
        for (const r of forecast[i + k] ?? []) {
            if (!rectsOverlapLocal(rect, r)) continue;
            if (distanceRectPoint(from.x, from.y, r) > SLASH_REACH) continue;
            const blocker = run.collideLineSolid(from.x, from.y,
                r.x + SPINNER.originX, r.y + SPINNER.originY);
            if (blocker) return blocker;
        }
    }
    return null;
}

function deriveStrike(run, bodyId, contacts, notBefore = 0, { continuation = false } = {}) {
    const index = (run.entities('spinnerBodies') ?? []).findIndex((b) => b.id === bodyId);
    if (index < 0) return null;
    const horizon = strikeHorizon(run);
    const forecast = run.spinnerForecast(horizon);
    const cells = walkableCells(run, contacts);
    // ⛓ The admissible ETA floor, once per cell — see `minTicksBetween`.
    const floor = new Map(cells.map((c) => [c, minTicksBetween(run.state, c)]));
    const opportunities = [];
    let unreachable = 0;
    /** ⛓ U3 D2 — how many (cell, tick) pairs the line of sight SKIPPED; a
     *  skip, not a refusal, and the count rides the refusal text. */
    let sighted = 0;
    /** ⛓ U4b D3 — the tick the bounded pass stopped at, where a continuation
     *  (below) picks up. */
    let stoppedAt = horizon;
    /**
     * ⛓ U4b D3 — the (cell, tick) test, one spelling for both passes: in
     * reach at the landing, the whole train clear, a clear line. `false` when
     * the pair is not an opportunity; `sighted` counts the bounded pass's
     * line skips only, so the refusal's count keeps its meaning.
     */
    const opportunityAt = (i, c, mine, { countSighted = true } = {}) => {
        if (distanceRectPoint(c.x, c.y, mine) > SLASH_REACH) return false;
        if (!rectsOverlapLocal(slashRectToward(c, mine), mine)) return false;
        /**
         * ⚠ THE TRAIN IS CHECKED ONE WIDER AT EACH END, and the reason is
         * the pairing rather than caution: the assert reads the PRE-MOVE
         * box against the POST-STEP bodies, so the tick the player arrives
         * on and the tick after the last dispatch are both compared
         * against a body this window would otherwise not have asked about.
         */
        for (let k = -2; k <= SLASH_HIT_TICKS + 1; k += 1) {
            if (!clearOfHammersAt(run, c.box, forecast, i + k)) return false;
        }
        if (strikeLineBlocked(run, c, facingToward(c, mine), forecast, i)) {
            if (countSighted) sighted += 1;
            return false;
        }
        return true;
    };
    /**
     * ⛓⛓ SEEDLING SWIM U6 (D1) — **THE DWELL IS PRICED** (trap 154's
     * question, asked of the one wait this schedule plans and never priced).
     * The walk arrives at `eta` and the train is priced from `i − 2`; between
     * them the player STANDS on the cell, and nothing asked whether the cell
     * was clear there. The census chamber's (2,7) is what that cost: the
     * strike (88,88) pressed at +12, the walk arrived at about +5 and waited in
     * the billiard's path, and the corner it made was *"There is no step out."*
     * with all ten key sets failing on the first tick. ⇒ every forecast row in
     * `[eta, i − 2)` is asked at the cell's own box (`clearOfHammersAt`, the
     * one predicate); the first unsafe one names the skip, and the skips are
     * COUNTED so the refusal can say how many it dropped.
     *
     * @returns {number|null} the first unsafe forecast index, or null
     */
    let dwelt = 0;
    /** ⛓ hammer-phase A — how many candidates the ESCAPE admission dropped (`HAMMER_ESCAPE` on only). */
    let escaped = 0;
    const dwellUnsafeAt = (c, eta, i) => {
        for (let k = eta; k < i - 2; k += 1) {
            if (!clearOfHammersAt(run, c.box, forecast, k)) return k;
        }
        return null;
    };
    for (let i = Math.max(1, notBefore); i < horizon - SLASH_HIT_TICKS - 1; i += 1) {
        const mine = forecast[i + 1]?.[index];
        if (!mine) continue;
        for (const c of cells) {
            // ⛔ BEFORE the truncation, never after: a candidate the movement
            // model provably cannot reach must not consume one of the forty.
            if (i - 1 < floor.get(c)) { unreachable += 1; continue; }
            if (opportunityAt(i, c, mine)) opportunities.push({ i, cell: c });
        }
        if (opportunities.length >= STRIKE_CANDIDATES) { stoppedAt = i; break; }
    }
    const rejected = [];
    /**
     * ⛓ U4b D3 — WHAT A CELL'S WALK SAYS DOES NOT DEPEND ON THE TICK. The walk
     * is `previewWalk` from where the player is NOW to the cell, and its
     * transit verdict is asked at each sample's own ETA — neither reads `i`.
     * So one walk per cell answers every opportunity at that cell, and the
     * continuation below spends its budget on CELLS rather than on the same
     * cell at forty consecutive ticks.
     */
    const walks = new Map();
    const walkTo = (cell) => {
        if (walks.has(cell)) return walks.get(cell);
        const walk = previewWalk(run, [{ x: cell.x, y: cell.y }], DEFAULT_TOLERANCE);
        let unsafe = null;
        if (!walk.truncated) {
            for (const sm of walk.samples) {
                const d = dangerDuringTransit(run, sm.tick, playerBoxAt(sm.x, sm.y),
                    sm.arrows, sm.chasers, sm.spits ?? null, sm.grenades ?? null);
                if (d.danger) { unsafe = { sm, d }; break; }
            }
        }
        const out = { walk, eta: walk.samples.length, unsafe };
        walks.set(cell, out);
        return out;
    };
    for (const o of opportunities) {
        // `previewWalk` returns the samples `drive` would spend getting there.
        const { walk, unsafe } = walkTo(o.cell);
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
        if (unsafe) {
            rejected.push({ option: `strike (${o.cell.x},${o.cell.y}) at +${o.i}`,
                why: `the corridor is not transit-safe: `
                    + `(${unsafe.sm.x.toFixed(1)},${unsafe.sm.y.toFixed(1)}) at its own ETA `
                    + `names ${unsafe.d.sources.map((x) => `${x.kind}:${x.id}`).join(', ')}` });
            continue;
        }
        const waitHit = dwellUnsafeAt(o.cell, eta, o.i);
        if (waitHit !== null) {
            dwelt += 1;
            rejected.push({ option: `strike (${o.cell.x},${o.cell.y}) at +${o.i}`,
                why: `the DWELL is not safe: the walk arrives at +${eta} and stands there `
                    + `until the train at +${o.i - 2}, and at +${waitHit} the box meets a `
                    + `body's 7x7 rect or ${hammerTestAt(run)}` });
            continue;
        }
        // ⛓ hammer-phase A — the ESCAPE admission (`HAMMER_ESCAPE`; off ⇒ not reached).
        if (HAMMER_ESCAPE.enabled) {
            const esc = strikeEscape(run, { cell: o.cell, i: o.i, eta, walk, mine: forecast[o.i + 1][index], bodyId });
            if (!esc.ok && esc.claim) {
                escaped += 1;
                rejected.push({ option: `strike (${o.cell.x},${o.cell.y}) at +${o.i}`, why: esc.why });
                continue;
            }
        }
        return {
            cell: { x: o.cell.x, y: o.cell.y },
            pressAt: run.ticksCompleted + o.i,
            aimAt: run.ticksCompleted + o.i - 1,
            eta,
            rejected,
            considered: opportunities.length,
            sighted,
            dwelt,
            ...(HAMMER_ESCAPE.enabled ? { escaped } : {}),
        };
    }
    /**
     * ⛓⛓ U4b D3 — **THE CONTINUATION, ONLY WHERE THE BOUNDED PASS REFUSED,
     * AND ONLY FOR THE ADMISSION** (`derivePressKill`, `continuation: true`).
     * The census chamber's (3,6) spent its forty-three on four cells at
     * +104 … +126, every one's corridor crossing the hammer; the CORRIDOR arm
     * spent its forty-one on four cells down the far leg, every walk meeting the
     * billiard at the corner at +89. Both rooms had a strike later in tick
     * order — (3,6) at (88,88) +142 after ONE more cell, the corridor at
     * (120,24) +399 after four. The pass above is unchanged, so every strike it
     * finds is found byte for byte; past it the scan continues in tick order to
     * the horizon, asking the same four conditions, with the walk cached per
     * cell and the budget counted in DISTINCT cells previewed
     * (`STRIKE_CANDIDATES` again, named in the refusal).
     *
     * ⛔ WHY NOT EVERY DERIVATION. The executor re-derives on every tick it has
     * no strike (a refuge wait), and a continuation there is a 640-tick scan
     * per tick. It also re-plans committed fights: with it on every
     * derivation L18's `r8-solve-18` solves in 416 t, not 485, which is a tape
     * move and not this slice's. So the admission asks it once and
     * `execKillByPress` adopts the strike it found.
     */
    let continued = 0;
    for (let i = Math.max(stoppedAt + 1, notBefore, 1);
        continuation && i < horizon - SLASH_HIT_TICKS - 1 && continued < STRIKE_CANDIDATES;
        i += 1) {
        const mine = forecast[i + 1]?.[index];
        if (!mine) continue;
        for (const c of cells) {
            if (i - 1 < floor.get(c)) continue;
            const known = walks.get(c);
            if (known && (known.walk.truncated || known.unsafe || known.eta > i - 1)) continue;
            if (!opportunityAt(i, c, mine, { countSighted: false })) continue;
            if (!known) {
                if (continued >= STRIKE_CANDIDATES) break;
                continued += 1;
            }
            const { walk, eta, unsafe } = walkTo(c);
            if (walk.truncated || unsafe || eta > i - 1) continue;
            if (dwellUnsafeAt(c, eta, i) !== null) { dwelt += 1; continue; }
            if (HAMMER_ESCAPE.enabled) {
                const esc = strikeEscape(run, { cell: c, i, eta, walk, mine, bodyId });
                if (!esc.ok && esc.claim) { escaped += 1; continue; }
            }
            return {
                cell: { x: c.x, y: c.y },
                pressAt: run.ticksCompleted + i,
                aimAt: run.ticksCompleted + i - 1,
                eta,
                rejected,
                considered: opportunities.length,
                sighted,
                dwelt,
                continued,
                fromContinuation: true,
                ...(HAMMER_ESCAPE.enabled ? { escaped } : {}),
            };
        }
    }
    return {
        cell: null,
        rejected,
        considered: opportunities.length,
        sighted,
        dwelt,
        continued,
        // ⛓ A BOUNDED SWEEP MUST NAME WHAT IT BOUNDED. The refusal now says
        // how many (cell, tick) pairs the ETA floor dropped as well as how
        // many were previewed — the two numbers a reader needs to tell "the
        // room has no strike" from "the scan ran out of budget".
        unreachable,
        truncated: opportunities.length >= STRIKE_CANDIDATES,
        horizon,
        ...(HAMMER_ESCAPE.enabled ? { escaped } : {}),
    };
}

/**
 * ⛓ hammer-phase A — `deriveStrike`'s ESCAPE admission for one candidate: the walk's own previewed arrival (its
 * `held` re-stepped with the run's stepper), the stand until the aim tick, the aim key toward the body's forecast
 * rect, the press at `+i` — then `pressEscape`.
 */
function strikeEscape(run, { cell, i, eta, walk, mine, bodyId }) {
    // ⚠ FROM THE RUN'S OWN STATE, through the walk: a press already in flight tests from the walk's points too.
    const keys = walk.samples.slice(0, eta).map((sm) => sm.held ?? new Set());
    for (let k = eta; k < i - 1; k += 1) keys.push(new Set());
    keys.push(new Set([FACING_KEYS[facingToward(cell, mine)]]));
    return pressEscape(run, { state: run.state, at: run.ticksCompleted, keys,
        pressAt: run.ticksCompleted + i, id: bodyId });
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
function trainIsSafeHere(run, aimKeys = null) {
    const span = SLASH_HIT_TICKS + 3;
    const forecast = run.spinnerForecast(span);
    const box = playerBoxAt(run.state.x, run.state.y);
    for (let i = 0; i < span; i += 1) {
        if (!clearOfHammersAt(run, box, forecast, i)) return false;
    }
    if (!aimKeys) return true;
    /**
     * ⛓⛓ R9 SLICE L16 — AND THE TRAIN AS IT WILL ACTUALLY BE WALKED. The box
     * above is where the player stands NOW; the aim tick holds a facing key and
     * MOVES them, and the press lands one tick later on a box this function
     * never asked about. From `r9-solve-16`'s measured latch (L18, `Game.time`
     * 10052) that gap was the whole failure: `safeStep` then refused the press
     * as *"a strike the schedule should not have planned"*. So the train is also
     * PREVIEWED — the aim keys, the press, then `SLASH_HIT_TICKS` standing —
     * with the run's own stepper, each landing against the forecast index
     * `safeStep` itself pairs it with (a step's landing is `forecast[k]`).
     */
    const step = run.previewStepper();
    let st = { ...run.state };
    const keysAt = (k) => (k === 1 ? aimKeys : (k === 2 ? new Set(['primary']) : new Set()));
    for (let k = 1; k < span; k += 1) {
        st = step({ ...st }, keysAt(k));
        if (!clearOfHammersAt(run, playerBoxAt(st.x, st.y), forecast, k)) return false;
    }
    return true;
}

/**
 * ⛓⛓ U3 D2 — **AND THE LIVE ARM'S TRAIN ASKS THE LINE TOO.** The early press
 * below takes an opportunity the schedule did not plan, from where the player
 * actually is — which is exactly how U1's (2,2) swung through a wall: the body
 * wandered into reach of the START cell on the first ticks, across the corner
 * of the mouth's stone. So the train is PREVIEWED as `trainIsSafeHere`'s is (the
 * aim keys, the press, then standing) and every body the slash rect reaches
 * within `SLASH_REACH`, at the forecast index each landing pairs with and the
 * one before it, is asked `run.collideLineSolid` from the previewed position.
 * A blocked line means DO NOT press here; the schedule then plans a strike the
 * line admits.
 */
function trainLineBlockedHere(run, dir, aimKeys) {
    const span = SLASH_HIT_TICKS + 3;
    const forecast = run.spinnerForecast(span);
    const step = run.previewStepper();
    let st = { ...run.state };
    const keysAt = (k) => (k === 1 ? aimKeys : (k === 2 ? new Set(['primary']) : new Set()));
    for (let k = 1; k < span; k += 1) {
        st = step({ ...st }, keysAt(k));
        if (k < 2) continue;
        const rect = slashRect(st.x, st.y, dir);
        for (const j of [k - 1, k]) {
            for (const r of forecast[j] ?? []) {
                if (!rectsOverlapLocal(rect, r)) continue;
                if (distanceRectPoint(st.x, st.y, r) > SLASH_REACH) continue;
                if (run.collideLineSolid(st.x, st.y,
                    r.x + SPINNER.originX, r.y + SPINNER.originY)) return true;
            }
        }
    }
    return false;
}

/**
 * ⛓ ONE STEP TOWARD `aim` THAT DOES NOT LAND IN A DISC — the per-tick half of
 * the strike schedule, and the cheapest possible dodge.
 *
 * The key sets the controller can produce are scored by (SAFE, then
 * distance to the aim after the step), with the intended one preferred on a
 * tie so a clear walk is byte-identical to a plain `chooseHeld`.
 *
 * ⛓⛓ SEEDLING SWIM U6 (D3) — **NINE MOVEMENT SETS, NOT FIVE.** This paragraph
 * used to say "the five key sets the controller can produce", and the
 * controller produces nine: `applyInput` reads each axis on its own, so a
 * diagonal (`DIAGONAL_KEYS`) is as real a step as a facing. With the dwell
 * (D1) and the transit clock (D2) priced, L18's `r8-solve-18` walked into
 * *"There is no step out."* at (140.64,55.73): a press landed at t 239 and
 * the knocked-back body came off the wall at x≈157 at −4.07 px/tick along
 * the player's own row; at t 241 all ten key sets landed in its rect. The
 * knockback is player-coupled, so no forecast taken before the landing
 * shows it, and no step after it escapes — escalating to the diagonals only
 * once the facings fail (depth 4, 5 or 6) still refuses there. Scored as
 * ordinary options, the diagonals walk a different approach and the corner
 * never forms: `r8-solve-18` 485 → 522 t, `r9-solve-18` 394 → 455 t.
 * ⚠ When
 * nothing is safe the intended set is returned unchanged and `safeStep` — the
 * guard one layer down — is what refuses by name: a mover that silently did
 * something else would be the walk deciding to hide a corner it walked into.
 */
function stepToward(run, aim, intended) {
    if (!aim || (run.entities('spinnerBodies') ?? []).length === 0) return intended;
    const forecast = run.spinnerForecast(STEP_LOOKAHEAD + 2);
    if (!forecast.length) return intended;
    const step = run.previewStepper();
    // ⚠ THE ORDER IS THE TIE-BREAK: the facings and the stand keep the places
    // they had, and the diagonals follow them.
    const options = [intended, ...Object.values(FACING_KEYS).map((k) => new Set([k])),
        new Set(), ...DIAGONAL_KEYS.map((k) => new Set(k))];
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
    if ((run.entities('spinnerBodies') ?? []).length === 0) return held;
    const lands = (keys) => landsClearOfHammers(run, keys);
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
 * ⛓ `safeStep`'s own landing test, lifted out so the HAMMER-PHASE rung's
 * preview (F1c) asks the SAME question of a previewed tick that the guard asks
 * of the live one — one predicate, two callers, no second spelling.
 */
function landsClearOfHammers(run, keys) {
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
    // ⚠ No row at index 1 is "nothing to land in" — `safeStep`'s old early return.
    if (!ahead) return true;
    const next = run.previewStepper()({ ...run.state }, keys);
    // ⚠ `[ahead]` is a ONE-ELEMENT forecast whose index 0 is the run's
    // own index 1, so the clock is asked for `gameTimeAt(1)` by hand
    // rather than by the shared convention — see the comment above
    // (⛓ U4b: forecast row i swings at `gameTimeAt(i)`, `clearOfHammersAt`).
    return clearOfHammersAt(
        { gameTimeAt: (i) => run.gameTimeAt(i + 1) },
        playerBoxAt(next.x, next.y), [ahead], 0);
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY F1c — THE HAMMER-PHASE RUNG's PREVIEW: the press
 * kill's own approach, walked forward on the forecast without touching the run.
 *
 * ⛔ WHY A PREVIEW AND NOT A REWIND. `levelRun` has one mutator (`advance`) and
 * no snapshot, so "back off to an earlier safe point" cannot mean undoing ticks.
 * It means seeing the corner BEFORE the walk is in it. Three facts make that
 * exact during an approach:
 *   1. a `Spinner`'s path is a function of the room and the tick, not of the
 *      player (`spinnerForecast`'s docblock), until a press LANDS — and no
 *      press is held on an approach tick;
 *   2. the hammer's phase is `gameTimeAt(i)`, arithmetic on the clock;
 *   3. the step is `previewStepper()`, the run's own `stepV2`.
 * So a VIEW of the run `o` ticks ahead — the forecast and the clock shifted by
 * `o`, the player at the previewed state — answers `stepToward`'s and
 * `safeStep`'s questions exactly as the run will answer them `o` ticks later.
 *
 * The walk is the executor's: `chooseHeld` toward the strike cell (or nothing
 * once arrived), `stepToward`, then `safeStep`'s landing test with its own
 * alternatives. It ENDS
 *   · `reach` — the live arm's in-reach test passes (the executor aims there;
 *     its own `trainIsSafeHere` prices the press, so the preview stops);
 *   · `lapse` — the strike's `pressAt` passes (the executor re-derives from the
 *     run; nothing here can predict that derivation, so it is not claimed);
 *   · `unknown` — the forecast loses a body (a fade ends) or has no row;
 *   · `horizon` — `limit` ticks walked with a safe step every tick;
 *   · `corner` — a tick where no key set lands clear: what `safeStep` would
 *     refuse as *"There is no step out."*, seen `at` ticks early.
 *
 * `stall` = `{at, ticks}`: from preview offset `at`, the walk HOLDS for `ticks`
 * ticks — `stepToward` aimed at where it stood when the stall began, from an
 * empty key set, so the hold is the same safe-first chooser the approach uses
 * (a "safe holding step", not a frozen stand that a body can walk into).
 */
function previewPressApproach(run, { index, hitsTimer, lastPressAt, strike, stall = null,
    limit, alternatives, from = 0, st0 = null, trail = null }) {
    const n = run.ticksCompleted;
    const live = run.entities('spinnerBodies') ?? [];
    const rows = run.spinnerForecast(limit + STEP_LOOKAHEAD + 2);
    const step = run.previewStepper();
    let st = st0 ?? { ...run.state };
    let hold = null;
    const viewAt = (o, state) => ({
        state,
        level: run.level,
        world: run.world,
        ticksCompleted: n + o,
        // ⚠ The only family a previewed tick asks for is the bodies (`stepToward`'s
        // emptiness test); any other is a question the preview cannot answer.
        entities: (k) => {
            if (k !== 'spinnerBodies') {
                throw new Error(`previewPressApproach: a previewed tick has no '${k}' — the view `
                    + 'carries the spinner bodies only.');
            }
            return live;
        },
        spinnerForecast: (h) => run.spinnerForecast(o + Math.max(0, Math.ceil(h))).slice(o),
        gameTimeAt: (i) => run.gameTimeAt(o + i),
        previewStepper: () => step,
        collideLineSolid: (...a) => run.collideLineSolid(...a),
    });
    for (let o = from; o < limit; o += 1) {
        if (trail) trail[o] = st;
        const bodies = o === 0 ? live.map((b) => b.rect) : rows[o - 1];
        if (!bodies || bodies.length !== live.length || !rows[o + 1]) return { end: 'unknown', at: o };
        const view = viewAt(o, st);
        const rect = bodies[index];
        const keyToward = FACING_KEYS[facingToward(st, rect)];
        // ⛓ The executor's live in-reach test, verbatim in its conditions.
        if (n + o - lastPressAt > SLASH_HIT_TICKS
            && Math.max(0, hitsTimer - o) === 0
            && distanceRectPoint(st.x, st.y, rect) <= SLASH_REACH
            && rectsOverlapLocal(slashRect(st.x, st.y, facingToward(st, rect)), rect)
            && trainIsSafeHere(view, new Set([keyToward]))
            && !trainLineBlockedHere(view, facingToward(st, rect), new Set([keyToward]))) {
            return { end: 'reach', at: o };
        }
        if (n + o > strike.pressAt) return { end: 'lapse', at: o };
        let held;
        if (stall && o >= stall.at && o < stall.at + stall.ticks) {
            if (o === stall.at) hold = { x: st.x, y: st.y };
            held = stepToward(view, hold, new Set());
        } else {
            held = hasArrived(st, strike.cell, DEFAULT_TOLERANCE)
                ? new Set() : chooseHeld(st, strike.cell, DEFAULT_TOLERANCE);
            held = stepToward(view, strike.cell, held);
        }
        const safe = [held, ...alternatives].find((k) => landsClearOfHammers(view, k));
        if (!safe) return { end: 'corner', at: o };
        st = step({ ...st }, safe);
    }
    if (trail) trail[limit] = st;
    return { end: 'horizon', at: limit };
}

/**
 * ⛓ F1c — THE RUNG's PER-TICK PREVIEW, CARRIED FORWARD rather than re-walked.
 *
 * The preview is a pure function of (the player's state, the tick, the strike,
 * `lastPressAt`, and the bodies' forecast). When the run's state this tick IS
 * the state the last preview walked to for this tick, and nothing the forecast
 * cannot see has happened since (no press hit — `spinnerPressHits` is the
 * only player-coupled input to a body), the new preview is the old one shifted
 * by a tick, so only its far end is walked. Anything else re-walks it whole.
 * ⛔ Byte-inert by construction: the cache is the same walk, not a cheaper one.
 * Measured on the committed L18 solve: 4.5 s re-walking every tick, 1.3 s
 * carried, the same 455-tick walk byte for byte.
 */
function clearAhead(run, args, cache) {
    const now = run.ticksCompleted;
    const limit = HAMMER_PHASE_RUNG.horizon;
    const hits = (run.ledger('spinnerPressHits') ?? []).length;
    const c = cache.last;
    const same = c && c.strike === args.strike && c.lastPressAt === args.lastPressAt
        && c.hits === hits && c.level === run.level && now > c.t && c.trail[now - c.t]
        && sameState(c.trail[now - c.t], run.state);
    if (same) {
        const shift = now - c.t;
        if (c.end === 'reach' || c.end === 'lapse' || c.end === 'unknown') {
            // a terminal end is the same tick, nearer (a CORNER is always re-walked)
            if (c.t + c.at > now) return { end: c.end, at: c.t + c.at - now };
        } else if (c.end === 'horizon') {
            const trail = c.trail.slice(shift);
            const out = previewPressApproach(run, { ...args, limit,
                from: c.at - shift, st0: trail[c.at - shift], trail });
            cache.last = { ...c, t: now, trail, end: out.end, at: out.at };
            return out;
        }
    }
    const trail = [];
    const out = previewPressApproach(run, { ...args, limit, trail });
    cache.last = { t: now, trail, end: out.end, at: out.at, strike: args.strike,
        lastPressAt: args.lastPressAt, hits, level: run.level };
    return out;
}

/** Two player states are one state: every field, compared by value. */
function sameState(a, b) {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    for (const k of ka) {
        const x = a[k];
        const y = b[k];
        if (x === y) continue;
        if (x && y && typeof x === 'object' && typeof y === 'object'
            && JSON.stringify(x) === JSON.stringify(y)) continue;
        return false;
    }
    return true;
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY F1c — THE HAMMER-PHASE RUNG (⚖ the user, 2026-10-03:
 * *"F1c: phase-robust L18 kill, then re-record"*). U15's DODGE shape, asked of
 * the hammer's clock instead of a turret's.
 *
 * ⛔ WHAT IT FIXES, MEASURED. The press kill's approach is chosen a tick at a
 * time (`stepToward`, `STEP_LOOKAHEAD` deep) and guarded a tick at a time
 * (`safeStep`). A corner deeper than the lookahead is walked into: on
 * `r9-solve-18`'s staging at hammer residue 42 a press lands at t234, the
 * knocked-back body comes off the wall, and at t249 every key set meets the
 * line at its own phase — *"There is no step out."* F1b measured 12 of the 45
 * residues refusing that way. The approach meets the hammer at a PHASE, and a
 * different arrival tick is a different phase.
 *
 * ⇒ on every approach tick (a strike set, no stall in flight) the executor's
 * own walk is previewed one hammer period ahead (`previewPressApproach`). Clear
 * — which is every tick of every committed walk — and the rung does nothing,
 * so those walks are byte-identical. Cornered at `+c`, it searches a STALL:
 * walk-offsets `at` from `c − 1` back to `0`, holds of `1 … maxTicks`, first
 * one whose walk previews clear for the stall plus one more period wins; the
 * executor drives it (the hold re-asked of the live run every tick, and still
 * under `safeStep`) and then re-previews. No stall clears it ⇒ the refusal
 * that follows says so by name: no phase of the hammer admits a step.
 */
function hammerPhaseRung(run, { index, hitsTimer, lastPressAt, strike, alternatives, cache }) {
    const ahead = clearAhead(run, { index, hitsTimer, lastPressAt, strike, alternatives }, cache);
    if (ahead.end !== 'corner') return { fired: false };
    const corner = ahead.at;
    let tried = 0;
    for (let at = corner - 1; at >= 0; at -= HAMMER_PHASE_RUNG.step) {
        for (let ticks = 1; ticks <= HAMMER_PHASE_RUNG.maxTicks; ticks += 1) {
            tried += 1;
            // ⛓ Up to `at` the walk IS the cornered preview's, so it starts there.
            const walk = previewPressApproach(run, { index, hitsTimer, lastPressAt, strike,
                stall: { at, ticks }, limit: at + ticks + HAMMER_PHASE_RUNG.horizon,
                alternatives, from: at, st0: cache.last.trail[at] });
            if (walk.end === 'corner') continue;
            return { fired: true, corner, stall: { at, ticks }, end: walk.end, tried };
        }
    }
    return { fired: true, corner, stall: null, tried };
}

/**
 * ⛓ F1c — WHAT THE RUNG KNOWS ABOUT A CORNER `safeStep` REFUSED, in words, or
 * `null` when it knows nothing (the refusal then reads exactly as before).
 *
 * ⛔ THE REMAINDER IT NAMES, MEASURED ON THE 45-RESIDUE SWEEP: every corner the
 * rung cannot clear forms within a few ticks of a press LANDING on the body
 * (L18: t262 → t263…t267, t188 → t189). A landing's knockback is
 * player-coupled — `spinnerForecast` holds no hit it has not seen — so no
 * forecast taken before the landing carries the rebound, and from the landing
 * on the body comes off the wall faster than the player can leave the line's
 * reach. That is not "no phase admits a step" before the press; it is "the
 * press decided it", and the sentence says which.
 */
function hammerPhaseRefusal(run, searched, landings, bodyId) {
    const mine = landings.filter((l) => l.id === bodyId);
    const last = mine.length ? mine[mine.length - 1].t : null;
    const recent = last !== null && run.ticksCompleted - last <= HAMMER_PHASE_RUNG.horizon;
    const landed = recent
        ? `The corner formed ${run.ticksCompleted - last} tick(s) after the press on ${bodyId} `
            + `LANDED at t${last}: a landing's knockback is player-coupled, so no forecast taken `
            + 'before it carries the rebound (HAMMER_PHASE_RUNG).'
        : null;
    if (searched === null) {
        return landed === null ? null
            : `${landed} The rung's preview saw no corner on this approach before it (it ends `
                + 'where the strike lapses, and a refuge wait is not previewed).';
    }
    return `${searched} (HAMMER_PHASE_RUNG).${landed === null ? '' : ` ${landed}`}`;
}

/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE A (D2) — **THE ESCAPE: A STRIKE IS ADMITTED ONLY WITH A WAY OUT OF ITS OWN LANDING.**
 *
 * ⛔ WHAT IT FIXES, MEASURED (`sweep-seedling-l18-residues.mjs` at base): `r9-solve-18`'s staging refuses
 * `HAMMER_SAFETY` at ten of the 45 hammer residues, and eight of them are F1c's remainder — the corner forms 4–7 ticks
 * after a press LANDS on `spinner@112,48` (8, 18–22 on the approach, 4–6 in the refuge wait after the strike lapsed).
 * A landing's knockback is player-coupled, so no forecast before it held the rebound, and nothing planned past it.
 * D1's hit-aware forecast (`levelRun.spinnerForecastWithPress`) holds it, exactly; `spaceTimeReach` searches it.
 *
 * ⇒ with the switch ON, a press is admitted only if, under the forecast WITH that press, a path out of the landing
 * exists that stays clear of every body rect and hammer line (`clearOfHammersAt`, the one predicate) for
 * `HAMMER_ESCAPE_BOUNDS.horizon` ticks — and the executor then FOLLOWS that path (still under `safeStep`):
 *   - in `deriveStrike` (the admission, from the walk's own previewed arrival: approximate, since the executor's
 *     approach is `stepToward`'s and not the preview's), and
 *   - at the live arm's AIM (exact: the run's own state, the aim key, the press and the train previewed with the
 *     run's stepper, the dash's impulse included) — whose certificate is the one followed.
 *
 * ⛓ THE HORIZON, DERIVED: the landing opens the body's i-frame (`SPINNER.hitsTimerMax`), and no press can land on it
 * until that runs out. The loop's next strike is approached under the HAMMER-PHASE rung, which previews ONE hammer
 * period (`HAMMER_PHASE_RUNG.horizon`). So the path is certified for the i-frame PLUS one period: wherever the
 * certificate is left, the state has a verified continuation at least as long as the span the rung looks at.
 *
 * ⛓ WHEN IT IS FOLLOWED, MEASURED: the train stands until the landing (the forecast's test points ARE those), and
 * from the landing the certificate drives every tick ON WHICH THE LOOP HAS NO STRIKE — "until the next strike can be
 * derived" — instead of the refuge walk nothing previews (residues 4–6's corner formed there). `follow` is the span
 * driven outright whatever the loop finds, and it is ZERO: the residue sweep with the certificate driven through the
 * whole i-frame (`follow` = `hitsTimerMax`) solved 45/45 at +75 ticks a solve on the base's 35; with 0, 45/45 at
 * −49 (the i-frame is spent walking to the next strike, which the admission has already given a way out of).
 *
 * ⚖ ON BY DEFAULT since hammer-phase A2 (user, 2026-10-07: "I approve." — the flip and the re-records of the
 * movers A measured: `r8-solve-18` 520 → 363 t, the `r8-d2` chain, `r9-solve-18` 519 → 518 t and the chain after it,
 * the F1c phase witness's planner, and the generated-level rows whose certify solve kills a spinner).
 * `SEEDLING_HAMMER_ESCAPE=0` turns it OFF for a node measurement (nothing below is then reached: byte-identical to
 * the base); `withHammerEscape(false, fn)` for a test. The browser has no `process` and takes the default.
 */
export const HAMMER_ESCAPE = { enabled: globalThis.process?.env?.SEEDLING_HAMMER_ESCAPE !== '0' };

/** Run `fn` with the switch set to `enabled`, restoring the previous value. */
export function withHammerEscape(enabled, fn) {
    const was = HAMMER_ESCAPE.enabled;
    HAMMER_ESCAPE.enabled = enabled === true;
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            return out.finally(() => { HAMMER_ESCAPE.enabled = was; });
        }
        HAMMER_ESCAPE.enabled = was;
        return out;
    } catch (e) {
        HAMMER_ESCAPE.enabled = was;
        throw e;
    }
}

/**
 * The escape's bounds, each derived (see `HAMMER_ESCAPE`): the certified `horizon` (the i-frame plus one hammer
 * period), the `follow` span (zero, measured), the dedup `cell` (8 px: a body is 7 px and the player tops out near
 * 2 px/tick, so one cell is a few ticks of travel), and `maxExpansions`, the search's work bound: one escape's WHOLE
 * reachable set at the 8 px key and this horizon, measured on L18 (the D2 cost table: at most 41,463 expansions over
 * the committed walk's six landings), with room to spare. ⚠ A search the bound cuts is NO CLAIM (the press is taken
 * as with the switch off), never a refusal: only an exhausted search proves there is no way out.
 */
export const HAMMER_ESCAPE_BOUNDS = Object.freeze({
    horizon: SPINNER.hitsTimerMax + SPINNER.hammerPeriod,
    follow: 0,
    cell: 8,
    maxExpansions: 50000,
});

/**
 * ⛓⛓ THE ESCAPE OF ONE PRESS, from a given player state at a given tick (`at` ≥ the run's tick).
 *
 * `keys[k]` is held at tick `at + k` up to the press; the press is `primary` alone at `pressAt` (with the dash's
 * impulse when `slashSet` says the press dashes); the TRAIN then stands until the landing. The states are previewed
 * with the run's stepper, the forecast WITH the press is taken over them (the player's point at every test tick is
 * the previewed one), every previewed tick up to the landing is asked `clearOfHammersAt`, and the kernel searches
 * from the landing state (stand first). The certificate's own points then feed the forecast AGAIN — a test after the
 * landing is re-aimed from where the escape put the player — and the path must survive that forecast too, or the
 * escape is retried with the whole train stood.
 *
 * @returns {{ok: true, claim: true, pressAt, landing, outcome, impulse, keys: Set[], states: object[],
 *   expansions: number} | {ok: false, claim: true, why: string} | {ok: false, claim: false, why: string}}
 *   `claim: false` is "no claim either way" (an unmodelled hit source, the deadline): the caller admits as before.
 */
function pressEscape(run, { state, at, keys = [], pressAt, id, deadline = true }) {
    const n = run.ticksCompleted;
    const step = run.previewStepper();
    const NO_KEYS = new Set();
    const PRESS = new Set(['primary']);
    const states = new Map([[at, { ...state }]]);
    let st = { ...state };
    for (let t = at; t < pressAt; t += 1) {
        st = step({ ...st }, keys[t - at] ?? NO_KEYS);
        states.set(t + 1, st);
    }
    const direction = st.direction;
    const probe = run.spinnerForecastWithPress(0, { pressAt, direction, id, positions: [] });
    if (probe.unmodelled.length > 0) {
        return { ok: false, claim: false, why: `the forecast names ${probe.unmodelled.join(', ')} as unmodelled` };
    }
    st = step({ ...st }, PRESS, { dashImpulse: probe.impulse });
    states.set(pressAt + 1, st);
    const trainEnd = pressAt + SLASH_HIT_TICKS;
    for (let t = pressAt + 1; t < trainEnd + 1; t += 1) {
        st = step({ ...st }, NO_KEYS);
        states.set(t + 1, st);
    }
    const { horizon, cell, maxExpansions } = HAMMER_ESCAPE_BOUNDS;
    const rowsFor = (land) => land + horizon + 2 - n;
    const first = run.spinnerForecastWithPress(rowsFor(trainEnd), { pressAt, direction, id,
        positions: (t) => states.get(t) ?? null });
    if (first.lineBlocked) return { ok: false, claim: true, why: 'the press\'s line of sight is blocked' };
    if (!first.landing) return { ok: false, claim: true, why: `the press does not land: ${first.why}` };
    const L = first.landing.t;
    const safeIn = (rows) => (q, i) => clearOfHammersAt(run, playerBoxAt(q.x, q.y), rows, i);
    const safe = safeIn(first.rows);
    for (let t = at + 1; t <= L; t += 1) {
        if (!safe(states.get(t), t - n)) {
            return { ok: false, claim: true, why: `the approach or the train meets a body or the line at t${t}, `
                + 'before the press lands' };
        }
    }
    const search = (start, startIndex, rows) => spaceTimeReach({
        start, startIndex, step: (q, k) => step(q, k), safe: safeIn(rows), horizon: L + horizon - n - startIndex,
        keySets: HOLD_FIRST_KEY_SETS, keyOf: coarseKey(cell), maxExpansions,
        // ⛓ of two states with one coarse key, keep the one farther from every hammer's disc (the refuge's
        // preference, `discClearanceAt` — a robustness score, never the safety test)
        rank: (q, i) => discClearanceAt(playerBoxAt(q.x, q.y), rows, i),
        shouldStop: deadline && activeDeadline !== null ? () => deadlineReached('hammer-escape') : null,
    });
    const verdict = (r, from, pre) => {
        if (r.ok) return null;
        // ⚠ a search cut by its BUDGET proves nothing either way: only an EXHAUSTED one refuses the press
        if (r.bound === 'deadline' || r.bound === 'expansions') return { ok: false, claim: false, why: r.why };
        return { ok: false, claim: true, why: `no ESCAPE from the landing at t${L} (${pre}): ${r.why}` };
    };
    // ⛓ First: free from the landing. Then re-aim the remaining tests from the certificate's own points.
    let found = search(states.get(L), L - n, first.rows);
    const bad = verdict(found, L, 'free from the landing');
    if (bad) return bad;
    const at2 = (t) => (t <= L ? states.get(t) : found.states[t - L]);
    const again = run.spinnerForecastWithPress(rowsFor(trainEnd), { pressAt, direction, id, positions: at2 });
    const sameTests = JSON.stringify(again.tests.map((x) => [x.t, x.id, x.landed]))
        === JSON.stringify(first.tests.map((x) => [x.t, x.id, x.landed]));
    let pre = [];
    if (!sameTests || !found.states.every((q, k) => safe(q, L - n + k) && safeIn(again.rows)(q, L - n + k))) {
        // ⛓ The fallback: the whole train stood, the search from its last test.
        for (let t = L + 1; t <= trainEnd + 1; t += 1) {
            if (!safe(states.get(t), t - n)) {
                return { ok: false, claim: true, why: `the escape moves the train's later tests, and the train stood `
                    + `meets a body or the line at t${t}` };
            }
        }
        pre = Array.from({ length: trainEnd + 1 - L }, () => NO_KEYS);
        found = search(states.get(trainEnd + 1), trainEnd + 1 - n, first.rows);
        const bad2 = verdict(found, trainEnd + 1, 'the train stood');
        if (bad2) return bad2;
    }
    return {
        ok: true, claim: true, pressAt, landing: L, outcome: first.outcome, impulse: first.impulse,
        keys: [...pre, ...found.keys], expansions: found.expansions,
        states: [...pre.map((_, k) => states.get(L + k)), ...found.states],
    };
}

/**
 * ⛓ THE ESCAPE IN FLIGHT — what the executor holds at tick `now`, or `null` when it does not drive this tick.
 * The train stands until the landing; from the landing the certificate's keys, for `follow` ticks outright (zero)
 * and otherwise only when `noStrike` (the loop found nothing to walk to). A landing that did not happen when the
 * certificate said ends it.
 */
function escapeHeld(escape, now, landings, bodyId, noStrike) {
    if (!escape || now <= escape.pressAt) return null;
    if (now < escape.landing) return new Set();
    if (now > escape.landing && !landings.some((l) => l.id === bodyId && l.t === escape.landing)) return null;
    const k = now - escape.landing;
    if (k >= escape.keys.length) return null;
    if (k >= HAMMER_ESCAPE_BOUNDS.follow && !noStrike) return null;
    return escape.keys[k];
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
 * ⛓ U6 D3 — the four two-key steps `stepToward` scores beside the facings,
 * spelled from `FACING_KEYS` (one numbering, no second literal).
 */
const DIAGONAL_KEYS = Object.freeze([[RIGHT, UP], [LEFT, UP], [LEFT, DOWN], [RIGHT, DOWN]]
    .map(([h, v]) => Object.freeze([FACING_KEYS[h], FACING_KEYS[v]])));

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
    /**
     * ⛓ SEEDLING FIDELITY STANCE — **A PRESSER WITH NO STANCE IS THIS RUNG'S
     * REFUSAL, NOT THE SOLVE'S.** `deriveHoldStance` throws when no cell in the
     * button plans a corridor, and that throw used to escape the whole ladder: the
     * JS arc's sweep leg L8 → L7 from the L9 door (no items) declined with
     * *"no REACHABLE stance inside button@64,48 … A hold that cannot be stood on is
     * not a strategy for this obstacle"*, though the obstacle was a sandtrap and
     * the button only the ceiling's presser (cut off by `pushableblock@96,112` and
     * Water). The throw ended the solve, so nothing that solves passes here.
     */
    let stance;
    let exempt;
    try {
        ({ stance, exempt } = deriveHoldStance(run, resolved, contacts));
    } catch (e) {
        if (!(e instanceof SolverRefusal)) throw e;
        return { presser: null, why: `the ceiling's presser ${presser.tag}@${presser.x},${presser.y} `
            + `(group t=${presser.t}, arming [${arms.map((t) => t.id).join(', ')}]) has no stance this `
            + `run can stand on — ${String(e.message).replace(/^solverBot: /, '')}` };
    }
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
 * ⛓ SEEDLING FIDELITY F4: does the run compute this static census body's arrow
 * death? True only for a class `STATIC_ARROW_DEATH` lists as `modelled` (the
 * ones whose death was read off the game). Every other static body keeps the
 * §11.4 refusal: the run cannot watch it die, so its clear is the game's.
 */
const staticDeathComputed = (row) => STATIC_ARROW_DEATH[row?.as3]?.policy === 'modelled';

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
    const inFlight = () => (run.entities('arrowsInFlight') ?? []).length;
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
            test: (r) => (r.entities('arrowsInFlight') ?? []).length === 0,
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
    if (resolved.arm === 'chaser') return execKillByChaser(run, perTick, resolved, ctx);
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
        open: run.entities('openActivators'),
        armed: run.entities('armedPulsers') ?? new Set(),
        trapsArmed: run.entities('armedArrowTraps') ?? new Set(),
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
        const live = (run.entities('chasers') ?? []).filter(
            (c) => left.some((b) => `${b.tag}@${b.x},${b.y}` === c.id));
        const body = live[0] ?? null;
        if (!body) {
            /**
             * ⛔ THE BODY THE COUNT IS WAITING ON IS NOT ONE THIS RUN STEPS —
             * so the model cannot watch it die, and §11.4 refuses to compute
             * the death of a static `"Enemy"` body. That is a GAME-SOURCED
             * declaration, raised rather than invented.
             *
             * ⛓ F4: unless it is a class whose arrow death the run DOES
             * compute (`STATIC_ARROW_DEATH`). Then the `clear` phase above
             * already held for every one under a lane, and a body still here
             * stands outside every lane: the ceiling cannot reach it, and the
             * game would say the same. That is a refusal, not a declaration.
             */
            const stuck = left[0];
            const computed = left.filter((b) => staticDeathComputed(b));
            if (computed.length > 0) {
                throw new SolverRefusal(`${ctx.what}: the count is still waiting on `
                    + `[${computed.map((b) => `${b.tag}@${b.x},${b.y}`).join(', ')}], static `
                    + 'bodies whose arrow death this run computes (F4) — and none of them '
                    + 'stands in a lane this ceiling fires, so no hold kills them and no bait '
                    + 'moves them (a static body never writes `v`).',
                { goal: ctx.goal, obstacle: { kind: 'static-enemy', id: `${computed[0].tag}@${computed[0].x},${computed[0].y}` },
                    perTick: [...perTick] });
            }
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
                test: (r) => (r.entities('chasers') ?? []).some((c) => c.id === body.id
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
     *
     * ⛓⛓⛓ FIDELITY F1b — AND THE SUM IS SPELLED IN THE v9 `at` CONVENTION,
     * which is ONE LESS than `opensOnTick`. The ledger stamps the removal
     * `ticksCompleted + 1`; `turnOff()` lands on the 101st alpha step, in the
     * advance that completes tick `removal + 100`; and a declared v9 row fires
     * when `ticksCompleted === at`, i.e. at the start of that same advance —
     * the scratch layer's own `declaredAt: p.at - 1`, one rule for both
     * writers. MEASURED, not reasoned (`f1-l5-lock-removal`): removal t201,
     * `{5,0}@301` replays to the game's crossing on t303, and `@302` crosses
     * on t304. (`r2-terrain-killlock` agrees: removal 183, `@283`, t285.)
     * Until F1b this read `removal + 101` from a ledger that held the KILL,
     * and the two errors did not cancel: 166 + 101 = 267 against the game's
     * 301.
     */
    const declaredFade = fadeTicks - 1;
    const opens = (run.ledger('chaserKillLockOpens') ?? []).filter((o) => !o.nil && o.level === run.level);
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
        + `own arithmetic, in the v9 \`at\` spelling: ${last.t} + ${declaredFade} = `
        + `${last.t + declaredFade}.`,
    { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock.id },
        perTick: [...perTick],
        pending: {
            level: run.level, tag: resolved.lock.persistTag ?? null,
            source: 'model', at: last.t + declaredFade, removedAt: last.t, fade: declaredFade,
            lock: resolved.lock.id, phases,
            why: `\`chaserKillLockOpens\` computed the removal (the last body leaves the `
                + `world) at ${last.t}, and \`activators.opensOnTick(${RESPONDERS[resolved.lock.tag]?.fade
                    ?? RESPONDERS.lock.fade})\` is ${fadeTicks}, which a declared v9 row spells `
                + `${declaredFade}`,
        } });
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY KILLLOCK K3 — THE KILL WORK ORDER'S **CHASER** ARM.
 *
 * One body at a time, each by the combat ladder's own chaser arm: `deriveKillByChaser` scores a stance the body
 * comes to (inside its leash, danger-free for the whole wait, forecast with the bodies stepped against it),
 * `ctx.walkTo` walks there through the loop's own ladder, and `runDwell` stands armed with the one strike policy
 * until the body has LEFT the world (`strikeBodies`, i.e. the removal, after the die anim and the fade). Then the
 * lock's tail is the ceiling arm's: the run's own `chaserKillLockOpens` ledger plus the responder's fade is a
 * MODEL-sourced declaration, and pass 2 waits the fade out and finds the lock gone.
 */
/**
 * The dwell's CEILING for one chaser kill, from where the walk now stands: the body's straight-line travel at its
 * own `moveSpeed`, three kill windows (`combatVerbs.killWindowTicks`) and the slack — `deriveKillByChaser`'s own
 * `ceilingFor`, asked of the live position rather than of a candidate the walk may have reached differently.
 */
/**
 * ⛓ KILLLOCK K3 — THE CHASER KILL'S DWELL, GUARDED AT THE I-FRAME'S LAPSE.
 *
 * `Enemy.update` runs `hitUpdate(); hitPlayer();` in that order and the enemy updates BEFORE the player, so the
 * tick a struck body's `hitsTimer` reaches 0 is a contact tick if its box overlaps the player's — and the player's
 * press that tick lands only after. A Bob (0.5 px/tick) knocked back by the sword's force 5 is still clear when
 * its 30-tick i-frame lapses; a jellyfish (0.8) is already back (measured: L60 step 112, the second body hit the
 * standing player on its third approach), and in water the player (0.45) cannot outrun one.
 *
 * So the one strike policy decides every tick, and when it does not press and the hunted body is within
 * `CHASER_GUARD_RADIUS` px:
 *   · WITH A SHIELD, the player steps TOWARD it: `Player.shieldBump` (`levelRun.shieldBumpNow`) shoves a stepped
 *     chaser its shield box touches while the player moves (`knockback(5)`, no damage, no i-frame), which keeps the
 *     body off the player's box through the lapse, and the step leaves the player FACING it for the press;
 *   · without one, in the last `CHASER_LAPSE_GUARD` ticks of its i-frame it steps AWAY onto plannable floor.
 * The run stays the oracle: any hit refuses by name.
 */
const CHASER_LAPSE_GUARD = 8;
const CHASER_GUARD_RADIUS = 18;

function guardedChaserDwell(run, perTick, { id, bound, strike, contacts, what, ctx, lockId }) {
    const opts = solverPlanOpts(run, contacts);
    const hitsBefore = run.ledger('playerHits').length;
    const deathsBefore = run.ledger('playerDeaths').length;
    const gone = () => !(run.entities('strikeBodies') ?? []).some((c) => c.id === id);
    const shielded = run.progress('inventory')?.hasShield === true;
    let guardSteps = 0;
    /**
     * ⛓ THE TURRETS' RANGE IS A KEEP-OUT FOR A DWELL THAT STARTED OUTSIDE IT: no movement (the policy's aim step or
     * the guard's) may project the player within `attackRange` + the projection of a live ice turret (L98).
     */
    const liveTurrets = () => [...(run.entities('turrets')?.values?.() ?? [])].filter((t) => !t.dead && !t.removed);
    const inRange = (x, y, pad = 0) => liveTurrets()
        .some((t) => Math.trunc(Math.hypot(t.x - x, t.y - y)) <= 128 + pad);
    const keepOut = !inRange(run.state.x, run.state.y);
    const has = (keys, k) => (keys.has ? keys.has(k) : keys.includes(k));
    const project = (keys, d) => ({
        x: run.state.x + (has(keys, 'right') ? d : (has(keys, 'left') ? -d : 0)),
        y: run.state.y + (has(keys, 'down') ? d : (has(keys, 'up') ? -d : 0)),
    });
    const clearAt = (keys) => {
        const ahead = project(keys, 2);
        if (keepOut && inRange(ahead.x, ahead.y)) return false;
        const { x: px, y: py } = project(keys, 6);
        return plannerObstacleAt(run.world, px, py, null, opts) === null;
    };
    const toward = (b) => {
        const dx = b.x - run.state.x;
        const dy = b.y - run.state.y;
        const key = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        return clearAt([key]) ? new Set([key]) : null;
    };
    const away = (b) => {
        const dx = Math.sign(run.state.x - b.x) || 1;
        const dy = Math.sign(run.state.y - b.y);
        const kx = dx > 0 ? 'right' : 'left';
        const ky = dy > 0 ? 'down' : (dy < 0 ? 'up' : null);
        for (const keys of [[kx, ky], [kx, null], [null, ky]].map((k) => k.filter(Boolean))) {
            if (keys.length > 0 && clearAt(keys)) return new Set(keys);
        }
        return null;
    };
    for (let i = 1; i <= bound; i += 1) {
        let held = strike && !run.state.fall
            ? strike.decide(run.state, run.entities('strikeBodies'), run.ticksCompleted, new Set(),
                { slash: run.progress('slashInfo') }).held
            : new Set();
        if (keepOut && held.size > 0) {
            const pr = project(held, 2);
            if (inRange(pr.x, pr.y)) held = new Set([...held].filter((k) => k === 'primary'));
        }
        if (!held.has('primary')) {
            // The NEAREST live body, not only the hunted one: in a room of several, any of them can close
            // (measured: L98, `jellyfish@56,48` contacted the player while `jellyfish@72,104` was hunted).
            const b = (run.entities('chasers') ?? []).filter((c) => !c.dying && !c.destroy)
                .sort((p, q) => Math.hypot(p.x - run.state.x, p.y - run.state.y)
                    - Math.hypot(q.x - run.state.x, q.y - run.state.y))[0] ?? null;
            const near = b && Math.hypot(b.x - run.state.x, b.y - run.state.y) < CHASER_GUARD_RADIUS;
            const k = !near ? null
                : (shielded ? toward(b)
                    : (b.hitsTimer > 0 && b.hitsTimer <= CHASER_LAPSE_GUARD ? away(b) : null));
            if (k) { held = k; guardSteps += 1; }
        }
        perTick.push(held);
        const { transition } = run.advance(held);
        if (transition) {
            throw new SolverRefusal(`${what}: dwell tick ${i} crossed from level ${transition.from_level} to `
                + `${transition.to_level} — leaving respawns every counted body (trap 150).`,
            { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: lockId }, perTick: [...perTick] });
        }
        if (run.ledger('playerHits').length !== hitsBefore || run.ledger('playerDeaths').length !== deathsBefore) {
            const h = run.ledger('playerHits').at(-1);
            throw new SolverRefusal(`${what}: the dwell was HIT at dwell tick ${i} (run tick ${run.ticksCompleted}; `
                + `source ${h?.source ?? '?'}${h?.id ? ` ${h.id}` : ''}; `
                + `${guardSteps} guard step(s) so far). The run is the oracle; the stance and the lapse guard were `
                + 'a heuristic.',
            { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: lockId }, perTick: [...perTick] });
        }
        if (gone()) return { ticks: i, strikes: strike ? strike.strikes : 0, guardSteps };
    }
    /**
     * ⛓ THE BOUND RAN OUT — SAY WHERE THE BODY IS AND WHAT STANDS BETWEEN. A chaser walks a STRAIGHT line at the
     * player (no path-finding), so a solid on that line pins it: measured on L60's east arrivals, where
     * `jellyfish@56,64` stops on `lock@128,80`'s west face and the one-tile corridor between pits puts no cell on
     * the east side within the sword's reach of it.
     */
    const b = (run.entities('chasers') ?? []).find((c) => c.id === id);
    const blocker = b && typeof run.collideLineSolid === 'function'
        ? run.collideLineSolid(b.x, b.y, run.state.x, run.state.y) : null;
    const blockerId = blocker ? (blocker.id ?? blocker.tag ?? JSON.stringify(blocker).slice(0, 60)) : null;
    throw new SolverRefusal(`${what}: ${id} is still in the world after the whole ${bound}-tick bound `
        + `(${guardSteps} guard step(s)); it stands at (${b ? `${b.x.toFixed(1)},${b.y.toFixed(1)}` : '?'}), `
        + `${Math.hypot((b?.x ?? 0) - run.state.x, (b?.y ?? 0) - run.state.y).toFixed(1)} px from the player`
        + `${blockerId ? `, and its straight chase line to the player is blocked by ${blockerId} — the body is `
            + 'PINNED on the solid between them (a chaser does not path-find)' : ''}.`,
    { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: lockId }, perTick: [...perTick] });
}

/**
 * ⛓⛓ KILLLOCK K4 — AN ICE TURRET THE LOCK COUNTS, KILLED WHERE IT STANDS.
 *
 * `IceTurret` takes three sword hits (`hitsMax` 3, a 30-tick i-frame, NO knockback) and `death()` turns the first
 * `destroy` into a corpse; the corpse leaves `classCount` only through a fatal tile under it. So this is: a stance
 * beside the LIVE 32x32 box (outside it — the body's contact is force 3) within `SLASH_REACH` of it, reached
 * through the loop's own walk with the range braved; then, per press, one tick holding the facing key toward
 * the body (a press swings the facing the tick STARTED with) and one press, at `KILL_PRESS_CADENCE` (31, past the
 * i-frame). A faced shield stops the volleys (`IceTurretBlast` dies on `"Shield"`). The end is OBSERVED: the run's
 * own turret is `dead`, and — on a fatal tile — `removed`. A turret that dies on dry floor stays counted and the
 * arm refuses by name (a `burn`/`Pulse` slide is another order's).
 */
function killIceTurretInPlace(run, perTick, id, resolved, ctx) {
    const from = perTick.length;
    const turret = () => run.entities('turrets')?.get?.(id) ?? null;
    const t0 = turret();
    if (!t0) {
        throw new SolverRefusal(`${ctx.what}: the count waits on ${id} and this run does not step it`,
            { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null }, perTick: [...perTick] });
    }
    const r = t0.rect;
    const opts = solverPlanOpts(run, resolved.contacts ?? new Set());
    const sides = [
        // ⚠ THE MARGIN IS MEASURED, NOT A TIDY 1 px: a live turret's `input()` oscillates its box by 0.5 px
        // (`iceTurretInput`'s snap), and each facing tap drifts the player ~0.7 px toward it (L98).
        { key: 'up', x: (r.x + r.right) / 2, y: r.bottom + 2 + ICE_TURRET_STANCE_MARGIN, back: 'down' },
        { key: 'down', x: (r.x + r.right) / 2, y: r.y - 3 - ICE_TURRET_STANCE_MARGIN, back: 'up' },
        { key: 'left', x: r.right + 2 + ICE_TURRET_STANCE_MARGIN, y: (r.y + r.bottom) / 2, back: 'right' },
        { key: 'right', x: r.x - 2 - ICE_TURRET_STANCE_MARGIN, y: (r.y + r.bottom) / 2, back: 'left' },
    ].filter((c) => plannerObstacleAt(run.world, c.x, c.y, null, opts) === null)
        /**
         * ⛔ A stance the player WAITS in for three press cadences must be outside every spinning axe's blade disc
         * (`SPINNING_AXE` 32 px from its hub, plus the box) — the axe's exact blade is a transit question, and a
         * ninety-tick wait meets every angle (measured: L98's below-side stance is 20.6 px from both hubs).
         */
        .filter((c) => (run.world.combat?.hazards ?? []).filter((h) => h.tag === 'spinningaxe')
            .every((h) => Math.hypot(h.cx - c.x, h.cy - c.y) > 32 + 4))
        .filter((c) => planWaypointsOrNull(run.world, run.state, { x: c.x, y: c.y }, null, opts) !== null)
        .map((c) => ({ ...c, d: Math.hypot(c.x - run.state.x, c.y - run.state.y) }))
        .sort((a, b) => a.d - b.d);
    if (sides.length === 0) {
        throw new SolverRefusal(`${ctx.what}: no side of ${id}'s live box is plannable floor within the sword's reach`,
            { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null }, perTick: [...perTick] });
    }
    /**
     * Each side in turn, nearest first; a side whose walk refuses AT PLAN TIME (no tick spent) gives way to the
     * next (measured: L98's below-side stance is inside both spinning axes' blades; the side above is not).
     */
    let side = null;
    const sideWhys = [];
    for (const c of sides) {
        const before = perTick.length;
        if (hasArrived(run.state, c, DEFAULT_TOLERANCE)) { side = c; break; }
        try {
            ctx.walkTo(ctx.goal, { x: c.x, y: c.y }, {
                what: `${ctx.what} -> ${id} stance (${c.key})`,
                contactsOverride: new Set([...(resolved.contacts ?? []), `proximity-hazard:${id}`]),
            });
            side = c;
            break;
        } catch (e) {
            if (!(e instanceof SolverRefusal) || perTick.length !== before) throw e;
            sideWhys.push(`${c.key}: ${e.message.split('\n')[0].slice(0, 200)}`);
        }
    }
    if (!side) {
        throw new SolverRefusal(`${ctx.what}: no side of ${id} is reachable — ${sideWhys.join(' | ')}`,
            { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null }, perTick: [...perTick] });
    }
    const hitsBefore = run.ledger('playerHits').length;
    const step = (keys) => {
        perTick.push(keys);
        const { transition } = run.advance(keys);
        if (transition) {
            throw new SolverRefusal(`${ctx.what}: the turret kill crossed a door (trap 150)`,
                { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null }, perTick: [...perTick] });
        }
        if (run.ledger('playerHits').length !== hitsBefore) {
            const h = run.ledger('playerHits').at(-1);
            throw new SolverRefusal(`${ctx.what}: the player was HIT while killing ${id} at run tick `
                + `${run.ticksCompleted} (source ${h?.source ?? '?'}${h?.id ? ` ${h.id}` : ''}) from the `
                + `${side?.key ?? '?'} side at (${run.state.x.toFixed(1)},${run.state.y.toFixed(1)})`,
            { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null }, perTick: [...perTick] });
        }
    };
    const FACE = new Set([side.key]);
    const PRESS = new Set(['primary']);
    const NO_KEYS = new Set();
    let presses = 0;
    const drift = () => (side.key === 'up' ? side.y - run.state.y : side.key === 'down' ? run.state.y - side.y
        : side.key === 'left' ? side.x - run.state.x : run.state.x - side.x);
    for (let n = 0; n < ICE_TURRET_PRESS_BOUND && !(turret()?.dead); n += 1) {
        // Back to the stance first: the previous cycle's facing tap drifted the player toward the body.
        for (let b = 0; b < 4 && drift() > 0.5; b += 1) step(new Set([side.back]));
        step(FACE);
        step(PRESS);
        presses += 1;
        for (let w = 2; w < KILL_PRESS_CADENCE && !(turret()?.dead); w += 1) step(NO_KEYS);
    }
    if (!turret()?.dead) {
        throw new SolverRefusal(`${ctx.what}: ${presses} press(es) from the ${side.key} side and ${id} is not dead`,
            { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null }, perTick: [...perTick] });
    }
    for (let w = 0; w < ICE_TURRET_DROWN_BOUND && !(turret()?.removed); w += 1) step(NO_KEYS);
    if (!turret()?.removed) {
        throw new SolverRefusal(`${ctx.what}: ${id} is a CORPSE and still counted after ${ICE_TURRET_DROWN_BOUND} `
            + 'ticks — it died on floor that does not destroy it, and `classCount(IceTurret)` moves only when a '
            + 'fatal tile does (a `Fire`/`Pulse` bump slides a corpse; that is another order\'s)',
        { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null }, perTick: [...perTick] });
    }
    return { phase: 'turret-kill', target: id, side: side.key, stance: { x: side.x, y: side.y }, presses,
        ticks: perTick.length - from };
}
/** The stance's clearance from the live box, px (see `killIceTurretInPlace`). */
const ICE_TURRET_STANCE_MARGIN = 3;
/** Five presses: three landed hits with room for two whiffs. */
const ICE_TURRET_PRESS_BOUND = 5;
/** The drown (one update) plus `Mobile.death`'s eleven-call fade, with slack. */
const ICE_TURRET_DROWN_BOUND = 40;

const CHASER_KILL_REDERIVE = 3;

function chaserKillCeiling(run, body) {
    const row = ENEMY_CLASSES[body.tag];
    const travel = Math.hypot(body.x - run.state.x, body.y - run.state.y) / (row?.speed || 0.5);
    return Math.ceil(travel) + killWindowTicks(body.tag) * 3 + HOLD_SLACK;
}

function execKillByChaser(run, perTick, resolved, ctx) {
    const from = perTick.length;
    const phases = [];
    /**
     * ⛓ K4: a live counted turret whose range the player already stands in is shooting NOW, so it is the first
     * body (measured: a stance in L98's water pocket above the turret took a blast on t52 while waiting on a
     * jellyfish).
     */
    if (KILLLOCK_BODIES.turretRemovalLedger) {
        for (const e of countedBodiesLeft(run)) {
            if (e.tag !== 'iceturret') continue;
            const t = run.entities('turrets')?.get?.(`${e.tag}@${e.x},${e.y}`);
            if (!t || t.dead || t.removed) continue;
            if (Math.trunc(Math.hypot(t.x - run.state.x, t.y - run.state.y)) > 128) continue;
            phases.push(killIceTurretInPlace(run, perTick, t.id ?? `${e.tag}@${e.x},${e.y}`, resolved, ctx));
        }
    }
    const started = countedBodiesLeft(run).length;
    for (let turn = 0; turn < started; turn += 1) {
        const left = countedBodiesLeft(run);
        if (left.length === 0) break;
        const ids = new Set(left.map((b) => `${b.tag}@${b.x},${b.y}`));
        const dying = new Set((run.entities('chasers') ?? []).filter((c) => c.dying).map((c) => c.id));
        const live = (run.entities('strikeBodies') ?? []).filter((b) => ids.has(b.id) && !dying.has(b.id));
        if (live.length === 0) break;
        // Nearest first (to the player's live point), then id, so the order is total.
        live.sort((a, b) => Math.hypot(a.x - run.state.x, a.y - run.state.y)
            - Math.hypot(b.x - run.state.x, b.y - run.state.y) || (a.id < b.id ? -1 : 1));
        const tried = [];
        let hunted = null;
        let hunt = null;
        /**
         * ⛓ STAND HERE FIRST when here is outside every live ice turret's range (`IceTurret.attackRange` 128, a
         * truncated distance from the body centre) and the nearest body is inside its own leash of here: it comes,
         * and no volley reaches the wait (measured: L98, a derived stance inside the range took a blast at t299).
         */
        const turretsLive = [...(run.entities('turrets')?.values?.() ?? [])].filter((t) => !t.dead && !t.removed);
        const outOfRange = turretsLive.every((t) => Math.trunc(Math.hypot(t.x - run.state.x, t.y - run.state.y)) > 128);
        if (turretsLive.length > 0 && outOfRange) {
            const b = live[0];
            const leash = ENEMY_CLASSES[b.tag]?.aggro?.range ?? 0;
            if (Math.hypot(b.x - run.state.x, b.y - run.state.y) <= leash) {
                hunted = b;
                hunt = { stance: { x: run.state.x, y: run.state.y }, ticks: chaserKillCeiling(run, b), clears: [b.id],
                    why: `${b.id} is inside its ${leash} px leash of where the walk stands, and here is outside `
                        + `every live ice turret's range [${turretsLive.map((t) => t.id).join(', ')}], so it comes `
                        + 'and no volley reaches the wait' };
            }
        }
        for (const b of hunt ? [] : live) {
            const h = deriveKillByChaser(run, b, resolved.contacts ?? new Set(),
                { dashMode: ctx.dashMode ?? DEFAULT_DASH_MODE });
            if (h.stance) { hunted = b; hunt = h; break; }
            tried.push({ option: `kill ${b.id} by press`, why: h.why });
        }
        /**
         * ⛓ THE FALLBACK STANCE IS WHERE THE WALK STANDS, when the nearest body is inside its own leash of it: a
         * chaser comes, and the guarded dwell below is the run deciding, tick by tick, with any hit a refusal.
         * Measured: after L60's first kill `deriveKillByChaser`'s previews never settle (*"the preview spent 400
         * tick(s) without arriving"*) from the cell the player already stands in.
         */
        if (!hunt && live.length > 0) {
            const b = live[0];
            const leash = ENEMY_CLASSES[b.tag]?.aggro?.range ?? 0;
            if (Math.hypot(b.x - run.state.x, b.y - run.state.y) <= leash) {
                hunted = b;
                hunt = { stance: { x: run.state.x, y: run.state.y }, ticks: chaserKillCeiling(run, b), clears: [b.id],
                    why: `${b.id} is inside its ${leash} px leash of where the walk stands, so it comes; no derived `
                        + `stance previewed (${tried.map((t) => t.why.slice(0, 80)).join(' | ')})` };
                tried.push({ option: 'stand here', why: hunt.why });
            }
        }
        if (!hunt) {
            throw new SolverRefusal(`${ctx.what}: the count is still waiting on [${[...ids].join(', ')}] and no `
                + `stance derives for any of them — ${tried.map((t) => t.why).join(' | ') || 'none is a live strike body'}`,
            { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null },
                considered: tried, perTick: [...perTick] });
        }
        /**
         * ⛔ THE FORECAST IS RE-ASKED FROM WHERE THE WALK ARRIVED. `walkTo` re-enters the ladder and may reach the
         * stance by another corridor, at another tick and velocity, with the bodies elsewhere; a dwell certified
         * from the candidate's preview is then a wait nobody priced (measured: L60 step 112, hit at t101 on the
         * second body). So walk, re-derive, and dwell only on a stance asked from here (bounded).
         */
        for (let a = 0; a < CHASER_KILL_REDERIVE && hunt.stance
            && !hasArrived(run.state, hunt.stance, DEFAULT_TOLERANCE); a += 1) {
            ctx.walkTo(ctx.goal, hunt.stance, { what: `${ctx.what} -> chaser kill (${hunted.id}) stance` });
            if (!(run.entities('strikeBodies') ?? []).some((c) => c.id === hunted.id)) break;
            if (hasArrived(run.state, hunt.stance, DEFAULT_TOLERANCE)) break;
            hunt = deriveKillByChaser(run, hunted, resolved.contacts ?? new Set(),
                { dashMode: ctx.dashMode ?? DEFAULT_DASH_MODE });
        }
        if (!hunt.stance) {
            throw new SolverRefusal(`${ctx.what}: arrived for ${hunted.id} and no stance derives from here — ${hunt.why}`,
            { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null }, perTick: [...perTick] });
        }
        const strike = strikePolicyFor(run, { dashMode: ctx.dashMode ?? DEFAULT_DASH_MODE });
        /**
         * ⚠ `hunt.ticks` is `(deathTick − arrival) + HOLD_SLACK` and goes NEGATIVE when the forecast's own
         * strikes kill the body during the APPROACH (measured: L60 step 112, −180). The walk carries the same
         * strike policy, so the body may already be gone; the dwell's bound is then the slack alone.
         */
        if (!(run.entities('strikeBodies') ?? []).some((c) => c.id === hunted.id)) {
            phases.push({ phase: 'chaser-kill', target: hunted.id, stance: hunt.stance, ticks: 0,
                clears: hunt.clears, killedOnApproach: true });
            continue;
        }
        const rec = guardedChaserDwell(run, perTick, {
            id: hunted.id,
            bound: Math.max(hunt.ticks, chaserKillCeiling(run, hunted)),
            strike,
            contacts: resolved.contacts ?? new Set(),
            what: `${ctx.what} -> chaser kill (${hunted.id}) by press`,
            ctx,
            lockId: resolved.lock?.id ?? null,
        });
        phases.push({ phase: 'chaser-kill', target: hunted.id, stance: hunt.stance,
            ticks: rec.ticks, strikes: rec.strikes, guardSteps: rec.guardSteps, clears: hunt.clears });
    }
    // The killed chasers fade (`Mobile.death`) before the world lets go of them; wait that out before any further
    // walk, so no ladder rung plans against a corpse (measured: L98's turret approach tried to BAIT a fading body).
    {
        const NO = new Set();
        for (let i = 0; i <= MOBILE_DEATH_FADE.ticks + HOLD_SLACK
            && (run.entities('chasers') ?? []).some((c) => c.dying || c.destroy); i += 1) {
            perTick.push(NO);
            run.advance(NO);
        }
    }
    // ⛓ KILLLOCK K4 — an IceTurret still counted is killed by press and left to drown (`killIceTurretInPlace`).
    if (KILLLOCK_BODIES.turretRemovalLedger) {
        for (const e of countedBodiesLeft(run)) {
            if (e.tag !== 'iceturret') continue;
            phases.push(killIceTurretInPlace(run, perTick, `${e.tag}@${e.x},${e.y}`, resolved, ctx));
        }
    }
    // `strikeBodies` drops a body at `destroy`; `totalEnemies()` drops it at the REMOVAL, after `Mobile.death`'s
    // fade. Stand that out (the bodies are dying, nothing is left to strike).
    const NO_KEYS = new Set();
    for (let i = 0; i <= MOBILE_DEATH_FADE.ticks + HOLD_SLACK && countedBodiesLeft(run).length > 0
        && (run.entities('strikeBodies') ?? []).length === 0
        && !countedBodiesLeft(run).some((e) => e.tag === 'iceturret' && !run.entities('turrets')?.get?.(`${e.tag}@${e.x},${e.y}`)?.dead); i += 1) {
        perTick.push(NO_KEYS);
        run.advance(NO_KEYS);
    }
    const left = countedBodiesLeft(run);
    if (left.length > 0) {
        throw new SolverRefusal(`${ctx.what}: the chaser arm removed every body it could and `
            + `[${left.map((b) => `${b.tag}@${b.x},${b.y}`).join(', ')}] remain, so `
            + '`Game.totalEnemies()` never reaches zero and the kill-lock never arms.',
        { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null },
            perTick: [...perTick] });
    }
    const fadeTicks = opensOnTick(RESPONDERS[resolved.lock.tag]?.fade ?? RESPONDERS.lock.fade);
    const declaredFade = fadeTicks - 1;
    const opens = (run.ledger('chaserKillLockOpens') ?? []).filter((o) => !o.nil && o.level === run.level);
    const mine = opens.filter((o) => o.opens.some((x) => x.at === resolved.lock.id));
    const last = mine[mine.length - 1] ?? opens[opens.length - 1] ?? null;
    if (!last) {
        throw new SolverRefusal(`${ctx.what}: every counted body is gone and the run's own kill-lock ledger `
            + '(`chaserKillLockOpens`) recorded NOTHING — so nothing computed the consequence and there is no '
            + 'tick to declare (trap 119).',
        { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock?.id ?? null },
            perTick: [...perTick] });
    }
    // The fade is a wait: stand (the bodies are gone) until the lock leaves the world or the fade has run.
    const clearTick = last.t + fadeTicks;
    /**
     * ⚠ BOTH CLOCKS. The ledger and a declared v9 `at` are the RUN's clock (`ticksCompleted`, dead frames
     * included); `twoPassSolve` refuses a declaration beyond the TAPE the measuring pass spent. So the measuring
     * pass stands until both have passed the clear tick (measured: L60 step 112's run clock led its tape by 35).
     */
    const waitBound = Math.max(0, clearTick - perTick.length) + HOLD_SLACK;
    for (let i = 0; i <= waitBound; i += 1) {
        if (!(run.world.activators ?? []).some((a) => a.id === resolved.lock.id)) {
            return { kind: 'kill', verb: 'kill', arm: 'chaser', lock: resolved.lock.id, phases,
                removedAt: last.t, fade: fadeTicks, openedAt: run.ticksCompleted,
                from, ticks: perTick.length - from };
        }
        if (run.ticksCompleted >= clearTick && perTick.length >= clearTick) break;
        perTick.push(NO_KEYS);
        run.advance(NO_KEYS);
    }
    throw new PendingDeclaration(`${ctx.what}: \`Game.totalEnemies()\` reached zero at tick `
        + `${last.t} (${last.id}, ${last.cause}) and ${resolved.lock.id} is ARMING — the run's own ledger plus `
        + `the responder's ${fadeTicks}-step fade, in the v9 \`at\` spelling: ${last.t} + ${declaredFade} = `
        + `${last.t + declaredFade}.`,
    { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock.id },
        perTick: [...perTick],
        pending: {
            level: run.level, tag: resolved.lock.persistTag ?? null,
            source: 'model', at: last.t + declaredFade, removedAt: last.t, fade: declaredFade,
            lock: resolved.lock.id, phases,
            why: `\`chaserKillLockOpens\` computed the removal (the last body leaves the world) at ${last.t}, `
                + `and \`activators.opensOnTick\` is ${fadeTicks}, which a declared v9 row spells ${declaredFade} `
                + '(KILLLOCK K3, the chaser arm)',
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
/**
 * ⛓⛓⛓ R9 SLICE 12d′, ⚖ RULING 47 — **THE TILE BEFORE THE LOCK, DERIVED FROM
 * THE STILL-SOLID WORLD** (user, 2026-08-24: *"It could save time by starting
 * the walk immediately after triggering the lock to clear, and only waiting if
 * the lock hasn't cleared by the time it reaches the tile before the lock."*).
 *
 * A `Lock` stays SOLID for its whole fade — `activationStep` only drains alpha,
 * and `turnOff()` writes `type = ""` at the END of it (`Puzzlements/Lock.as:63-104`)
 * — so the world the early walk crosses is the world the planner already
 * prices, unchanged. That is why this needs no hypothetical: the tile before
 * the lock is an ORTHOGONAL neighbour of the lock's own cell that the
 * STILL-SOLID planner can reach, and the cells beyond the lock are exactly the
 * ones it cannot.
 *
 * ⛔ ORTHOGONAL, NOT THE EIGHT. A lock sits in a corridor and "the tile before
 * it" is the one the onward step leaves from; a diagonal neighbour is adjacent
 * without being on the way, and offering one would be a wait spot dressed as a
 * route. The shortest corridor wins — the errand is to spend the fade getting
 * close, not to pick a scenic neighbour — then `(y, x)` so the emitted tape is
 * deterministic.
 *
 * ⚠ **INSIDE THE ROOM BY CONSTRUCTION**, which trap 150 requires: every
 * candidate is a neighbour of a cell in THIS level, so no early walk can cross
 * a room edge and let a counted body respawn behind it. Asserted by the caller
 * rather than assumed.
 *
 * @returns {?{x: number, y: number, walk: number}} the stance, or `null` when
 *   no orthogonal neighbour is both walkable and reachable — the honest null,
 *   and the caller then waits where it stands exactly as before.
 */
function preLockStance(run, lock, contacts) {
    const opts = solverPlanOpts(run, contacts);
    const centre = {
        x: (lock.rect.x + lock.rect.right) / 2,
        y: (lock.rect.y + lock.rect.bottom) / 2,
    };
    const cell = nodeAt(centre.x, centre.y, DEFAULT_LATTICE);
    const nx = run.world.width * TILE_SIZE / DEFAULT_LATTICE;
    const ny = run.world.height * TILE_SIZE / DEFAULT_LATTICE;
    const found = [];
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
        const tx = cell.tx + dx;
        const ty = cell.ty + dy;
        if (tx < 0 || ty < 0 || tx >= nx || ty >= ny) continue;
        const c = nodeCentre(tx, ty, DEFAULT_LATTICE);
        if (plannerObstacleAt(run.world, c.x, c.y, null, opts)) continue;
        let wps;
        try {
            wps = planWaypoints(run.world, run.state, { x: c.x, y: c.y }, null, opts);
        } catch (e) {
            if (!(e instanceof BotDriverV2Error)) throw e;
            continue;
        }
        let walk = 0;
        let at = run.state;
        for (const wp of wps) {
            walk += Math.hypot(wp.x - at.x, wp.y - at.y);
            at = wp;
        }
        found.push({ x: c.x, y: c.y, walk });
    }
    found.sort((a, b) => a.walk - b.walk || a.y - b.y || a.x - b.x);
    return found[0] ?? null;
}

function execKillByPress(run, perTick, resolved, ctx) {
    /**
     * ⛓ R9 SLICE P2 — ⚖ 47's PERMISSION, off `ctx`, defaulted to the
     * roster-wide flag. `solveSegment` puts it on every `ctx` it builds, so a
     * test can grant it at a `false` head exactly as `dashPlan` grants the
     * dash; the fallback is the flag, so an executor reached through a `ctx`
     * this option has not been threaded onto still reads the roster's state.
     */
    const economies = ctx.economies ?? ECONOMIES_ROSTER_WIDE;
    const NO_KEYS = new Set();
    const PRESS = new Set(['primary']);
    /** `safeStep`'s alternatives — the stand and the four facings, fresh per tick. */
    const alternativesNow = () => [NO_KEYS, ...Object.values(FACING_KEYS)
        .map((k) => new Set([k]))];
    const from = perTick.length;
    const landings = [];
    const cycles = [];
    const contacts = new Set();
    let refuge = null;
    /** ⛓ F1c — the HAMMER-PHASE rung's stalls this kill (`HAMMER_PHASE_RUNG`). */
    const phaseStalls = [];
    /** ⛓ hammer-phase A — the escapes certified at an aim this kill (`HAMMER_ESCAPE` on only). */
    const escapes = [];
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
        /**
         * ⛓ F1c — the stall in flight (absolute ticks `[from, until)` and the
         * cell it holds around), and the rung's last refusal, which rides the
         * `safeStep` refusal it predicted.
         */
        let phaseStall = null;
        let phaseRefusal = null;
        /** ⛓ hammer-phase A — the escape certificate in flight (`pressEscape`), followed from the landing. */
        let escape = null;
        let phaseSeen = null;
        let phaseSpent = 0;
        const phaseCache = { last: null };
        /**
         * ⛓ U4b D3 — A STRIKE ONLY THE ADMISSION'S CONTINUATION FOUND IS
         * ADOPTED, not re-derived: the executor's own derivation is the bounded
         * pass and would refuse it on this same tick. A strike the bounded pass
         * found is re-derived here exactly as before, so that path is unchanged.
         */
        const seeded = resolved.first;
        if (seeded?.fromContinuation && seeded.cell && plan === resolved.plans[0]
            && run.ticksCompleted < seeded.aimAt) {
            strike = seeded;
            cycles.push({
                body: plan.id,
                cell: seeded.cell,
                pressAt: seeded.pressAt,
                eta: seeded.eta,
                considered: seeded.considered,
                rejected: seeded.rejected.slice(0, 3),
            });
        }
        for (; spent <= bound; spent += 1) {
            const body = (run.entities('spinnerBodies') ?? []).find((b) => b.id === plan.id);
            if (!body) break;
            let held = NO_KEYS;
            /**
             * ⛓ hammer-phase A — the escape in flight drives the train and the i-frame (`escapeHeld`); at the aim
             * the press is taken only with an escape (`pressEscape`, exact from the run's own state). Off ⇒ both
             * `null`, and every branch below reads exactly as before.
             */
            const following = HAMMER_ESCAPE.enabled
                ? escapeHeld(escape, run.ticksCompleted, landings, plan.id, false) : null;
            let aimEscape = null;
            const aimAdmitted = () => {
                if (!HAMMER_ESCAPE.enabled) return true;
                const aimKeys = new Set([FACING_KEYS[facingToward(run.state, body.rect)]]);
                aimEscape = pressEscape(run, { state: run.state, at: run.ticksCompleted, keys: [aimKeys],
                    pressAt: run.ticksCompleted + 1, id: plan.id });
                return aimEscape.ok || !aimEscape.claim;
            };
            if (aimed) {
                held = PRESS;
                lastPressAt = run.ticksCompleted;
                aimed = false;
                strike = null;
            } else if (following !== null) {
                held = following;
            } else if (run.ticksCompleted - lastPressAt > SLASH_HIT_TICKS
                && body.hitsTimer === 0
                && distanceRectPoint(run.state.x, run.state.y, body.rect) <= SLASH_REACH
                && rectsOverlapLocal(slashRect(run.state.x, run.state.y,
                    facingToward(run.state, body.rect)), body.rect)
                && trainIsSafeHere(run,
                    new Set([FACING_KEYS[facingToward(run.state, body.rect)]]))
                && !trainLineBlockedHere(run, facingToward(run.state, body.rect),
                    new Set([FACING_KEYS[facingToward(run.state, body.rect)]]))
                && aimAdmitted()) {
                if (aimEscape?.ok) {
                    escape = aimEscape;
                    escapes.push({ body: plan.id, t: run.ticksCompleted, pressAt: aimEscape.pressAt,
                        landing: aimEscape.landing, outcome: aimEscape.outcome, ticks: aimEscape.keys.length,
                        // ⛓ how many of the certificate's ticks move (a certificate of stands is the hold)
                        moves: aimEscape.keys.filter((k) => k.size > 0).length,
                        expansions: aimEscape.expansions });
                } else {
                    escape = null;
                }
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
                    } else if (HAMMER_ESCAPE.enabled
                        && escapeHeld(escape, run.ticksCompleted, landings, plan.id, true) !== null) {
                        /**
                         * ⛓ hammer-phase A — NO STRIKE, AND AN ESCAPE STILL HAS CERTIFIED TICKS: they replace
                         * the refuge walk, which nothing previews (residues 4–6's corner formed there).
                         */
                        strike = null;
                        refuge = null;
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
                const late = HAMMER_ESCAPE.enabled && !aim
                    ? escapeHeld(escape, run.ticksCompleted, landings, plan.id, true) : null;
                if (late !== null) held = late;
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
                if (late === null) held = stepToward(run, aim, held);
                /**
                 * ⛓⛓⛓ F1c — THE HAMMER-PHASE RUNG (`hammerPhaseRung`). Only on a
                 * STRIKE approach: a refuge wait re-derives a strike every tick
                 * from the run, which no preview can predict. A stall in flight
                 * is driven to its end before the walk is previewed again.
                 */
                const now = run.ticksCompleted;
                if (phaseStall && now >= phaseStall.until) phaseStall = null;
                if (phaseStall && now >= phaseStall.from) {
                    if (now === phaseStall.from) phaseStall.hold = { x: run.state.x, y: run.state.y };
                    held = stepToward(run, phaseStall.hold, NO_KEYS);
                } else if (!phaseStall && strike && aim === strike.cell) {
                    const verdict = hammerPhaseRung(run, {
                        index: (run.entities('spinnerBodies') ?? [])
                            .findIndex((b) => b.id === plan.id),
                        hitsTimer: body.hitsTimer,
                        lastPressAt,
                        strike,
                        alternatives: alternativesNow(),
                        cache: phaseCache,
                    });
                    if (!verdict.fired) phaseSeen = null;
                    else if (phaseSeen === null) phaseSeen = now;
                    phaseRefusal = null;
                    if (verdict.fired && verdict.stall && phaseSpent < HAMMER_PHASE_RUNG.maxPerKill) {
                        phaseSpent += 1;
                        phaseStall = { from: now + verdict.stall.at,
                            until: now + verdict.stall.at + verdict.stall.ticks, hold: null };
                        phaseStalls.push({ body: plan.id, t: now, corner: now + verdict.corner,
                            from: phaseStall.from, ticks: verdict.stall.ticks,
                            phase: run.gameTimeAt(verdict.stall.at) % SPINNER.hammerPeriod,
                            tried: verdict.tried });
                        if (verdict.stall.at === 0) {
                            phaseStall.hold = { x: run.state.x, y: run.state.y };
                            held = stepToward(run, phaseStall.hold, NO_KEYS);
                        }
                    } else if (verdict.fired) {
                        phaseRefusal = verdict.stall
                            ? `the HAMMER-PHASE rung first saw this corner at t${phaseSeen} and has `
                                + `already stalled ${phaseSpent} time(s) on ${plan.id} `
                                + `(HAMMER_PHASE_RUNG.maxPerKill ${HAMMER_PHASE_RUNG.maxPerKill}, one per `
                                + 'landing) — a walk that keeps meeting the line is not converging'
                            : `the HAMMER-PHASE rung first saw this corner at t${phaseSeen}, and from `
                                + `t${now} NO PHASE admits a step: no hold of `
                                + `1..${HAMMER_PHASE_RUNG.maxTicks} tick(s) at any walk-offset `
                                + `${verdict.corner - 1}..0 (${verdict.tried} tried) walks the approach `
                                + `clear for one more hammer period (${HAMMER_PHASE_RUNG.horizon} ticks)`;
                    }
                }
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
            try {
                const meant = held;
                held = safeStep(run, held, alternativesNow(), ctx.what, plan.id);
                // ⛓ hammer-phase A — a certificate `safeStep` overrode no longer describes the walk: it ends.
                if (escape && held !== meant
                    && escapeHeld(escape, run.ticksCompleted, landings, plan.id, true) === meant) escape = null;
            } catch (e) {
                const why = e instanceof SolverBotError && e.code === HAMMER_SAFETY
                    ? hammerPhaseRefusal(run, phaseRefusal, landings, plan.id) : null;
                if (why === null) throw e;
                // ⛓ F1c — the first sentence is unchanged; the rung's verdict follows it.
                throw new SolverBotError(`${e.message} ${why}`, { code: e.code });
            }
            const before = (run.ledger('spinnerPressHits') ?? []).length;
            perTick.push(held);
            const { transition } = run.advance(held);
            if (transition) {
                fail(`${ctx.what}: the run crossed to level ${transition.to_level} while `
                    + `pressing ${plan.id}. A kill does not survive the door (trap 150).`);
            }
            for (const h of (run.ledger('spinnerPressHits') ?? []).slice(before)) {
                if (h.landed) landings.push({ t: h.t, id: h.id, hits: h.hits });
            }
        }
        if ((run.entities('spinnerBodies') ?? []).some((b) => b.id === plan.id)) {
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
            landings, cycles, bodies: resolved.bodies,
            ...(phaseStalls.length ? { phaseStalls } : {}),
            ...(escapes.length ? { escapes } : {}) };
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
    /**
     * ⛓⛓⛓ R9 SLICE 12d′, ⚖ RULING 47 — **THE WALK STARTS AT THE TRIGGER, NOT
     * AT THE CLEAR**, and it is legal here for a reason this arm has in writing
     * one paragraph up: a `tset == -1` lock is opened by `checkEnemies()` and
     * NO button answers one, so the trigger — the last counted body's removal —
     * **stays satisfied without the player**. Nothing the walk does can
     * un-arm it. (The classes that CANNOT take this are the ones whose trigger
     * is the player: a plain `Button` re-assigns `activate` from whoever
     * collides EVERY tick (`Button.as:27-38`), so leaving snaps the lock's
     * alpha back to 1 and `returnToNormal()` re-solidifies it; and a
     * `ShieldLock` refuses the player input for the whole fade and restores it
     * only `if (p)` — a player who drifted out of its check rect is refused
     * input FOREVER.)
     *
     * ⛔ THE CLEAR TICK IS ARITHMETIC, NEVER A MARGIN AND NEVER A POLL. It is
     * the ledger's own removal tick plus `activators.opensOnTick` — the SAME
     * sum this executor's tail already declares, read here rather than
     * re-derived, so the wait and the declaration cannot drift apart.
     *
     * ⚠ AND THE REMAINDER IS `max(0, clearTick − now)`: a walk that outlasts
     * the fade waits ZERO and the loop below simply finds the lock gone.
     */
    const removals = (run.ledger('spinnerKillLockOpens') ?? [])
        .filter((o) => !o.nil && o.level === run.level);
    const removalsMine = removals.filter(
        (o) => o.opens.some((x) => x.at === resolved.lock.id));
    const removal = removalsMine[removalsMine.length - 1]
        ?? removals[removals.length - 1] ?? null;
    /**
     * ⛓⛓⛓ R9 SLICE P2, ⚖ RULING 54 (5) — **⚖ 47's ECONOMY IS BEHIND THE
     * ROSTER-WIDE PERMISSION, AND THE MEASUREMENT IS WHY.** Cherry-picked
     * un-gated onto `main` at `ECONOMIES_ROSTER_WIDE === false` (the constant
     * was `ALLOW_DASH_ROSTER_WIDE` until 12j — same state, its own name now),
     * this early walk moves ONE committed artifact by name and two producer
     * `--check`
     * md5s with it:
     *
     *   · `r8-solve-18`  541 → 437  (`solve-seedling-r8-l18`)
     *   ⇒ `solve-seedling-r8-d2`'s headline row *"the headline's first 541
     *     ticks ARE r8-solve-18's walk, key for key"* fails at tick 292 —
     *     the tick the fade used to be stood through
     *
     * That is §31.6's (E₀) `r8-solve-18` row, 541 → 437, reproduced at this
     * head to the digit. The campaign's only lock room is L5's arrow ceiling,
     * whose saving is measured ZERO (the header above), so ⚖ 47's whole win
     * lives on the `r8-d2` chain — and it lands with the flip, not before it.
     *
     * ⛔ AT `false` THE THREE QUANTITIES ARE THE COMMITTED ONES: no walk, no
     * `earlyWalk` FIELD ON THE RECORD AT ALL (a `null` would move the trace
     * sidecars, which the producers `--check` byte-for-byte alongside the
     * tapes), and `remaining === fade` — the loop bound the committed core
     * spent the whole fade on.
     */
    let earlyWalk = null;
    if (economies && removal !== null) {
        const stance = preLockStance(run, resolved.lock, contacts);
        if (stance && !hasArrived(run.state, stance, DEFAULT_TOLERANCE)) {
            const level = run.level;
            ctx.walkTo(ctx.goal, { x: stance.x, y: stance.y }, {
                what: `${ctx.what} -> the tile before ${resolved.lock.id} (⚖ 47: the `
                    + 'fade runs while the walk does)',
                contactsOverride: new Set(),
            });
            /**
             * ⛔ TRAP 150's OWN CONDITION, ASSERTED RATHER THAN ASSUMED. The
             * stance is a neighbour of a cell in this level, so a crossing is
             * impossible by construction — and a claim that cannot fail is
             * still worth making where the consequence is a room whose counted
             * bodies came back behind the walker.
             */
            if (run.level !== level) {
                fail(`${ctx.what}: the early walk to the tile before ${resolved.lock.id} `
                    + `crossed from level ${level} to ${run.level}. A kill does not `
                    + 'survive the door (trap 150), so the count this lock is waiting on '
                    + 'would be back.');
            }
            earlyWalk = {
                stance: { x: stance.x, y: stance.y },
                walk: stance.walk,
                arrivedAt: run.ticksCompleted,
            };
        }
    }
    const clearTick = removal === null ? null : removal.t + fade;
    const remaining = (!economies || clearTick === null)
        ? fade
        : Math.max(0, clearTick - run.ticksCompleted);
    /**
     * ⛓ THE RECORD CARRIES THE ARITHMETIC, not just its answer — `removedAt`,
     * `fade`, `clearTick` and the tick the walk ARRIVED on, so a reader can
     * re-do the subtraction. The row that gates ⚖ 47 asserts exactly that
     * identity, which is what makes a margin substituted for the arithmetic
     * fail BY NAME rather than by a tick count nobody can attribute.
     */
    if (earlyWalk !== null) {
        earlyWalk.removedAt = removal.t;
        earlyWalk.fade = fade;
        earlyWalk.clearTick = clearTick;
        earlyWalk.waits = remaining;
    }
    for (let i = 0; i <= remaining + HOLD_SLACK; i += 1) {
        if (!(run.world.activators ?? []).some((a) => a.id === resolved.lock.id)) {
            return { verb: 'kill', arm: 'press', from, ticks: perTick.length - from,
                landings, cycles, bodies: resolved.bodies,
                ...(economies ? { earlyWalk } : {}),
                ...(phaseStalls.length ? { phaseStalls } : {}),
                ...(escapes.length ? { escapes } : {}) };
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
    /**
     * ⛓ R9 SLICE 12d′: READ ONCE, ABOVE — `removal` is this same ledger row,
     * taken before ⚖ 47's early walk so the wait and the declaration are the
     * same arithmetic rather than two readings of it. Nothing between there and
     * here can add a row: every counted body is already gone.
     */
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY F5 (F1c D2's fix) — SPELLED IN THE v9 `at`
     * CONVENTION, ONE LESS than `opensOnTick`, as the chaser arm has since
     * F1b: a declared v9 row fires when `ticksCompleted === at`, i.e. at the
     * start of the advance that completes `removal + 100`, where `turnOff()`
     * lands. The ledger now stamps the alpha-zero step (`levelRun`'s
     * `assertSpinnerRemovalIsDeclared`), so the two together give the game's
     * tick: `f1c-l18-lock-removal` declares the ledger's own 416 = 316 + 100,
     * and the model crosses on t444 = the game's. Until F5 this read
     * `removal + 101` from a ledger one step late, two ticks after the game.
     */
    const declaredFade = fade - 1;
    const last = removal;
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
        + `slot), so the tick is the run's own ledger plus the responder's own arithmetic, `
        + `in the v9 \`at\` spelling: ${last.t} + ${declaredFade} = ${last.t + declaredFade}.`,
    { goal: ctx.goal, obstacle: { kind: 'kill-lock', id: resolved.lock.id },
        perTick: [...perTick],
        pending: {
            level: run.level, tag: resolved.lock.persistTag ?? null,
            source: 'model', at: last.t + declaredFade, removedAt: last.t, fade: declaredFade,
            lock: resolved.lock.id,
            why: `\`spinnerKillLockOpens\` computed the removal at ${last.t} and `
                + `\`activators.opensOnTick(${RESPONDERS[resolved.lock.tag]?.fade
                    ?? RESPONDERS.lock.fade})\` is ${fade}, which a declared v9 row spells `
                + `${declaredFade}`,
        } });
}

/** Executor: the `collect` verb, bound to live state. */
function execCollect(run, perTick, resolved, ctx) {
    /**
     * ⛓ SEEDLING FIDELITY PROXIMITY — in a level this run has SKIRTED, the
     * approach keeps the x grid (`walkTo`'s note): `runCollect`'s own approach
     * is `chooseHeld`'s free diagonal, so the walk at the pickup is taken here
     * with `holdOneAxis` until the ceremony starts or the ledger grows, and
     * `runCollect` then finds the collection already under way. Measured on L29
     * (survey step 57): the free approach left x at 115.53, off the grid the
     * return lane needs. `ctx.keepGrid` is `skirtGridKept` asked by the goal path;
     * every other call runs `runCollect` exactly as before.
     */
    if (ctx.keepGrid) {
        const t = resolved.target;
        const aim = t.rect
            ? { x: (t.rect.x + t.rect.right) / 2, y: (t.rect.y + t.rect.bottom) / 2 }
            : { x: t.x, y: t.y };
        const before = run.ledger('collected').length;
        const from = perTick.length;
        let approach = 0;
        // Arrive (the drive's own 1 px tolerance), then stand: a `special`
        // pickup is drawn to a STATIONARY player (`Pickup` attraction), and a
        // bang-bang walk at tolerance 0 never stops on its aim.
        for (let n = 0; n < ctx.maxTicksPerTarget && !run.progress('inCeremony')
            && run.ledger('collected').length === before; n += 1) {
            const arrived = hasArrived(run.state, aim, DEFAULT_TOLERANCE);
            const held = arrived ? new Set()
                : holdOneAxis(chooseHeld(run.state, aim, DEFAULT_TOLERANCE), run.state, aim);
            perTick.push(held);
            const { transition } = run.advance(held);
            if (transition) {
                fail(`${ctx.what}: the axis-aligned approach crossed from level `
                    + `${transition.from_level} to ${transition.to_level}.`);
            }
            approach += 1;
        }
        // A pickup whose ceremony is a single frame (`frames` 1) is collected
        // inside the approach's own tick; `runCollect` would wait for a second
        // one, so the record is written here, in its shape.
        if (run.ledger('collected').length === before + 1 && !run.progress('inCeremony')) {
            const record = run.ledger('collected').at(-1);
            return { pickup: { tag: t.tag, x: t.x, y: t.y }, item: record.item, level: run.level,
                approach, ceremony: 0, releases: 0, from, axisAligned: true };
        }
    }
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
    const hypothesis = lazyStanceHypothesis(run, blocked, contacts);
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
    const removedAt = () => (run.ledger('shieldBossKills') ?? []).find(
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
        const stabs = (run.ledger('shieldBossStabs') ?? []).filter(
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
    if (!run.progress('keys')?.has(row.keyType)) {
        return {
            strategy: 'keylock',
            held: false,
            // ⛓ SEEDLING SWIM U2, D2 — the refusal names the lock (`execKeylock`
            // prints `resolved.lock`; U1's survey read `keylock: undefined`).
            lock: obstacle.id,
            keyType: row.keyType,
            rejected: [{
                option: `stand on ${obstacle.id}`,
                why: `\`BossLock.update\` gates on \`Player.hasKey(${row.keyType})\` and `
                    + `this run holds [${[...(run.progress('keys') ?? [])].join(', ') || 'no keys'}]. `
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
                test: (r) => r.entities('openActivators').has(obstacle.id),
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
    const candidates = keylockCandidates(run, row, contacts);
    /**
     * ⛓⛓ SEEDLING FIDELITY STANCE — **A LOCK IS NOT ITS OWN PREREQUISITE.**
     * `stanceHypothesis` lists every shut activator with a registered verb, and
     * that included THIS lock: a stance on the far side was "reachable once
     * `bosslock@…` is discharged", the walk to it named the lock again, and the
     * frontier re-applied `keylock` until `MAX_STRATEGIES_PER_GOAL` ran out
     * (survey: L12, L48, *"keylock stance -> keylock stance -> …"*). The lock
     * is excluded from its own hypothesis (no committed trace discharges an
     * activator in a stance hypothesis, so nothing that solved leaned on it).
     */
    const base = lazyStanceHypothesis(run, [...blocked, row.id], contacts);
    /**
     * ⚠ AND A SIBLING BOSSLOCK ONLY WHERE ITS OWN KEY LINE IS IN REACH. L12's
     * `bosslock@416,240` and `@432,240` stand side by side and the stance
     * (424,264) is under both: with this lock excluded, the other one was still
     * "pending", the walk named this one again, and the loop came back. A
     * keylock that this run cannot stand under from where it is (no direct
     * corridor to any of its candidates) is not something the rest of the plan
     * will discharge, so it is a wall to this question (guard i's language).
     */
    let memo = null;
    const hypothesis = () => (memo ??= base().filter((h) => !keylockOutOfReach(run, h, contacts)));
    for (const c of candidates) {
        const reached = stanceReaches(run, { x: c.x, y: c.y }, contacts, hypothesis);
        if (reached) return { stance: { x: c.x, y: c.y }, discharged: reached.discharged };
    }
    const siblings = base().filter((h) => keylockOutOfReach(run, h, contacts));
    const sealed = keyLineBehindLock(run, row, candidates, contacts, siblings);
    const refusal = new SolverRefusal(
        `solverBot: no REACHABLE stance on ${row.id}'s key line in level ${run.level} — `
        + `${candidates.length} cell(s) put the player box on the line when walked into `
        + `the lock, none with a corridor from (${run.state.x},${run.state.y}).`
        + (sealed ? keyLineSealedClause(sealed) : ''),
        { obstacle: { kind: 'solid', id: row.id } });
    // ⛓ STANCE: an optional instance field (RETURN's `sealed` shape, `self: true`).
    if (sealed) refusal.sealed = sealed;
    throw refusal;
}

/**
 * The keylock's candidate cells (`deriveKeylockStance`'s builder, hoisted so a
 * sibling's reach can be asked with the same cells): a free lattice cell from
 * which a walk into the lock pins the box on the key line, nearest first.
 */
function keylockCandidates(run, row, contacts) {
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
    return candidates;
}

/**
 * Is `h` (a stance-hypothesis entry) a keylock whose key line this run cannot
 * reach directly? `false` for every other entry, and for a keylock whose key the
 * run lacks it is still asked by geometry only (`resolveKeylockStrategy` owns
 * the key question).
 */
function keylockOutOfReach(run, h, contacts) {
    if (h.kind !== 'activator' || h.strategy !== 'keylock') return false;
    const row = (run.world.activators ?? []).find((a) => a.id === h.id);
    if (!row?.keyLine) return false;
    // Memoised per run, per tick, per contact set: nothing a tick does not move changes it.
    let memo = KEYLOCK_REACH_MEMO.get(run);
    const key = `${run.level}|${run.ticksCompleted}|${run.state.x},${run.state.y}|${[...contacts].sort().join(';')}|${h.id}`;
    if (!memo || memo.tick !== run.ticksCompleted) {
        memo = { tick: run.ticksCompleted, answers: new Map() };
        KEYLOCK_REACH_MEMO.set(run, memo);
    }
    if (!memo.answers.has(key)) {
        const opts = solverPlanOpts(run, contacts);
        memo.answers.set(key, !keylockCandidates(run, row, contacts)
            .some((c) => corridorPlans(run.world, run.state, { x: c.x, y: c.y }, null, opts)));
    }
    return memo.answers.get(key);
}
const KEYLOCK_REACH_MEMO = new WeakMap();

/**
 * ⛓⛓⛓ SEEDLING FIDELITY STANCE — **THE KEY LINE IS ON THE LOCK'S FAR SIDE.**
 *
 * `BossLock.update` opens on `collideLine("Player", x-originX+2, y-originY+height+1,
 * …)`: the integer row one pixel BELOW the lock (`keyLine`). A player north of
 * the lock cannot put a box on that row without passing the lock. So the game
 * has exactly two states for a tagged bosslock (every one in the atlas carries a
 * tag), and the solver must say which one it is in:
 *   - the save still holds `{level, tag}`: the lock is built SOLID, and from the
 *     far side it is sealed (this refusal);
 *   - the flag is cleared (the lock was opened from its own side on an earlier
 *     visit): `BossLock.check()` removes it on build and the corridor plans.
 * Asked only on the throw path: is some candidate reachable with THIS lock open?
 */
function keyLineBehindLock(run, row, candidates, contacts, siblings = []) {
    const self = { id: row.id, kind: 'activator', tag: row.tag };
    const reaches = (c, withSet) => {
        const opened = [self, ...withSet];
        const through = new Set([...contacts, ...opened.map((h) => `proximity-hazard:${h.id}`)]);
        return corridorPlans(run.world, run.state, { x: c.x, y: c.y }, null,
            solverPlanOpts(run, through, { liveBag: bagWithDischarged(run, run.liveGeometryOpts(), opened) }));
    };
    for (const c of candidates) {
        if (!reaches(c, siblings)) continue;
        // Only the siblings this corridor needs are named (drop each one that is not).
        let needed = [...siblings];
        for (const h of siblings) {
            const without = needed.filter((x) => x !== h);
            if (reaches(c, without)) needed = without;
        }
        siblings = needed;
        return {
            wall: row.id,
            presser: null,
            self: true,
            with: siblings.map((h) => h.id),
            flag: Number.isInteger(row.persistTag) && row.persistTag >= 0
                ? { level: run.level, tag: row.persistTag } : null,
            keyLine: { ...row.keyLine },
            from: { x: run.state.x, y: run.state.y },
            stance: { x: c.x, y: c.y },
        };
    }
    return null;
}

/** The sentence `keyLineBehindLock`'s answer owes the refusal. */
function keyLineSealedClause(s) {
    return ` ⛔ SEALED BEHIND ITSELF: the key line is the row y=${s.keyLine.y} under ${s.wall} `
        + `(\`BossLock.update\`'s \`collideLine\`, x ${s.keyLine.x0}..${s.keyLine.x1}), and from `
        + `(${s.from.x},${s.from.y}) a corridor reaches the stance (${s.stance.x},${s.stance.y}) `
        + `only through the lock itself${s.with.length
            ? ` (and ${s.with.join(', ')}, whose key line is out of reach the same way)` : ''}. `
        + (s.flag
            ? `The save still holds its flag {${s.flag.level},${s.flag.tag}}, so the game builds it `
                + 'SOLID: this is the shut state, and from this side it does not open. Once the lock '
                + 'has been opened from its own side the flag is cleared and `BossLock.check()` '
                + 'removes it on every later build (the open state).'
            : 'It carries no tag, so it is built solid on every visit.')
        + ' That is a fact about the room and the save, not a rung the ladder lacks.';
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
    if (!run.progress('inventory')?.[need]) {
        return {
            strategy: 'touch',
            held: false,
            need,
            lock: obstacle.id,
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
        /**
         * ⛓ R9 SLICE 12d″ — the CLASS, carried so the executor can ask the
         * responder's own probe which way to lean. ⛔ It is the tag and not a
         * direction: the direction is `activators.touchApproachKey`'s to
         * derive, and a resolver that computed one here would be a second
         * place the answer lives. Not projected into the trace —
         * `seeRow`'s `strategy` is an explicit whitelist.
         */
        tag: row.tag,
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
    const hypothesis = lazyStanceHypothesis(run, blocked, contacts);
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
    /**
     * ⛓ R9 SLICE L16 (the parallel elements slice's W0 finding, via the
     * planner) — **A `SolverRefusal`, for `execBreak`'s reason.** This arm
     * used to `fail()`, which raises a `SolverBotError`; `procgenOracle.solve`
     * re-throws one rather than classifying it, so a generated room's
     * WITHOUT-shield arm came back `THREW:*`, `differentialGrade` called it
     * WEAK, and `require: ['hasShield']` could never be met. Missing the item
     * IS the claim about the level. ⚠ `resolveTouchStrategy`'s `held: false`
     * record now carries `lock` too — this message printed `undefined` for it.
     * `execKeylock`'s twin arm is left as `execBreak`'s docblock names it.
     */
    if (resolved.held === false) {
        throw new SolverRefusal(`${ctx.what}: ${resolved.lock} needs `
            + `\`Player.${resolved.need}\`, which this run does not hold — `
            + `${resolved.rejected[0].why}`,
        { obstacle: { kind: 'solid', id: resolved.lock } });
    }
    const NO_KEYS = new Set();
    /**
     * ⛓⛓⛓ R9 SLICE 12d″ — **THE LEAN IS THE MECHANISM'S OWN PROBE, NOT A
     * DOMINANT AXIS**, and the change is a REMOVAL: there is no longer a
     * comparison for arrival scatter to decide.
     *
     * `leanKeys(run.state, resolved.target)` asked `|dx| >= |dy|` against the
     * lock's CENTRE. R9 §31.7 measured what that costs on L20: the derived
     * stance is `(168,24)`, the target `(176,16)`, so the comparison is
     * `|+8.00| - |-8.00| = 0.00` — an EXACT TIE, broken only by the `>=`,
     * underneath a drive tolerance of 1.0 px (`botDriverV1.js:48`). Six
     * measured builds arrived at ±0.86 px of that point and scattered across
     * it: three leaned `right` and solved, two leaned `up` and the room was
     * UNSOLVABLE — `up` walks the player north into the wall at y = 18.04,
     * `x` never closes, and the pinned box's closest approach stays 4.88 px
     * for all 131 ticks. A room that works because a tie fell one way is not
     * a room that works.
     *
     * ⛔ AND THE ANSWER WAS NEVER A GEOMETRIC QUESTION. `ShieldLock.update`
     * is `p = collide("Player", x - 1, y)` — the mask shifted ONE PIXEL WEST
     * — so the touch is a WESTERN approach for every ShieldLock in the game,
     * at every stance, whatever the arithmetic to its centre says. The lean
     * is `right` by DERIVATION.
     *
     * ⛔ A RESPONDER WHOSE PROBE IS NOT TRANSCRIBED REFUSES BY NAME. Falling
     * back to the dominant axis for the unknown case would put this exact
     * defect back for exactly the classes nobody has read yet, which is the
     * population least able to survive it (trap 588's family).
     */
    const lean = touchApproachKey(resolved.tag);
    if (!lean) {
        return fail(`${ctx.what}: ${resolved.lock} is a \`${resolved.tag}\`, and `
            + '`activators.TOUCH_RESPONDERS` carries no PROBE for that class — so which '
            + 'side the touch is approached from is not a fact this run holds. ⛔ The '
            + 'lean is NOT guessed from the dominant axis to the lock CENTRE: R9 '
            + '§31.7 measured that comparison sitting on an exact tie at the derived '
            + 'stance, where a fatal `up` and a working `right` are separated by less '
            + 'than the tolerance the drive itself allows. The work order is to READ '
            + 'that class `collide("Player", …)` AND TRANSCRIBE ITS OFFSET — one line.');
    }
    const into = new Set([lean]);
    const from = perTick.length;
    const bound = resolved.window + HOLD_SLACK;
    let snappedAt = null;
    for (let spent = 0; spent <= bound; spent += 1) {
        if (run.entities('openActivators').has(resolved.lock)) {
            return { verb: 'touch', target: resolved.lock, from,
                ticks: perTick.length - from, snappedAt };
        }
        // ⛔ RELEASE ON THE SNAP. `run.inputRefused` is the run's own gate and
        // it is the honest signal — the game has already taken the player's
        // input, so a key held past it is a span that buys nothing and a
        // velocity that could carry them out of the rect.
        const refused = run.progress('inputRefused');
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
    const weapon = run.progress('primaryWeapon');
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
    if (!rockBreaksUnder(rock.rockType, run.progress('inventory'))) {
        return {
            strategy: 'break',
            held: false,
            rock: obstacle.id,
            rejected: [{
                option: `break ${obstacle.id}`,
                why: `\`BreakableRock.hit(_t)\` is \`if (rockType <= _t)\` and \`Player.as:`
                    + `1071-1074\` passes \`hasGhostSword ? 1 : 0\`; this rock is rockType `
                    + `${rock.rockType ?? 0} and the run holds `
                    + `${run.progress('inventory')?.hasGhostSword ? 'the ghost sword' : 'NO ghost sword'}`
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
/** Is a swing from `at` on the rock? — `execBreak`'s own in-reach test. */
const swingReaches = (at, rock) => distanceRectPoint(at.x, at.y, rock.rect) <= SLASH_REACH
    && rectsOverlapLocal(slashRectToward(at, rock.rect), rock.rect);

/**
 * The candidate cells for a swing at `rock`, in `deriveBreakStance`'s own
 * order — ONE builder for the live derivation and for the route search, so
 * the cell the search plans to swing from is the cell the executor would
 * have derived on arrival. `opts` decides which world the candidate is
 * tested in (the live bag, or a route state's).
 */
function breakStanceCandidates(run, rock, opts) {
    const pitch = DEFAULT_LATTICE;
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
    return { candidates, outOfReach, noRect };
}

/**
 * ⛓ R9 SLICE L15 — the break stance for a ROUTE STATE: from `from` under
 * `bag`, no guard-(i) hypothesis (the route's other pushables are walls to
 * this question exactly as they are to the block-stop test).
 * @returns `null` when the swing already reaches from `from`, a `{x, y}`
 *   stance when one plans, `undefined` when none does.
 */
function breakStanceUnder(run, rock, contacts, from, bag,
    { live = true, reaches = null, verify = true } = {}) {
    /**
     * ⛔ "ALREADY IN REACH" IS A CLAIM ABOUT A REAL POINT. Past the start
     * state the search's player point is a CELL CENTRE the walk approximates
     * — after a lean the player is a tile BEHIND the block's rest cell
     * (`runShove` releases at the commit tick and the block glides its last
     * tile alone; measured (79.7,72) against a modelled (88,72) on L15's
     * first order) — so the arm is asked only of the LIVE position, and every
     * deeper break gets a stance cell the executor walks to before
     * `execBreak` re-asks the question where the player actually stands.
     */
    if (live && swingReaches(from, rock)) return null;
    const { candidates } = breakStanceCandidates(run, rock,
        solverPlanOpts(run, contacts, { nodeMargin: 0, triggerMargin: 0, liveBag: bag }));
    const reachOpts = solverPlanOpts(run, contacts, { liveBag: bag });
    for (const c of candidates) {
        if (reaches && !reaches(from, { x: c.x, y: c.y }, bag, contacts)) continue;
        if (!verify || corridorPlans(run.world, from, { x: c.x, y: c.y }, null, reachOpts)) {
            return { x: c.x, y: c.y };
        }
    }
    return undefined;
}

/**
 * ⛓⛓⛓ R9 SLICE L16 (kickoff §59.4 D2) — THE PRESS-AT-RECT HALF OF
 * `deriveBreakStance`, HOISTED: a REACHABLE cell from which a swing lands on
 * `target.rect` (`swingReaches` / `breakStanceCandidates`, unchanged), asked of
 * the live position first. ONE derivation for every verb whose whole act is
 * "stand in reach and swing" — `break` (a rock) and `pull` (a rope). The
 * refusal is the caller's sentence, so each verb still says what it was for.
 * `admit` is an optional per-cell predicate the caller adds (`pull`'s: the cell
 * stands in no danger volume — a rope hangs in rooms with a sandtrap beside
 * it; `break` passes none, so its stances cannot move).
 */
function deriveSwingStance(run, target, contacts, blocked, refusal, admit = null) {
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
    if (swingReaches(run.state, target)) {
        return { stance: null, discharged: [] };
    }
    const { candidates, outOfReach, noRect } = breakStanceCandidates(run, target,
        solverPlanOpts(run, contacts, { nodeMargin: 0, triggerMargin: 0 }));
    const hypothesis = lazyStanceHypothesis(run, blocked, contacts);
    let unsafe = 0;
    for (const c of candidates) {
        if (admit && !admit(c)) { unsafe += 1; continue; }
        const reached = stanceReaches(run, { x: c.x, y: c.y }, contacts, hypothesis);
        if (reached) return { stance: { x: c.x, y: c.y }, discharged: reached.discharged };
    }
    throw new SolverRefusal(refusal({ candidates, outOfReach, noRect, unsafe }),
        { obstacle: { kind: 'solid', id: target.id } });
}

function deriveBreakStance(run, rock, contacts, blocked = []) {
    return deriveSwingStance(run, { rect: rock.rect, id: rock.rockId }, contacts, blocked,
        ({ candidates, outOfReach, noRect }) => 'solverBot: no REACHABLE stance for a '
            + `swing at ${rock.rockId} in level `
            + `${run.level} — ${candidates.length} cell(s) put the slash rect on the rock and `
            + `none plans a corridor from (${run.state.x},${run.state.y}); ${outOfReach} more `
            + `were beyond SLASH_REACH (${SLASH_REACH} px) and ${noRect} were in reach with the `
            + 'rect pointing elsewhere. ⇒ the rock is on the frontier and the room offers '
            + 'nowhere to stand and swing: the next work order is a way to REACH one of those '
            + 'cells, not a bigger budget.');
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
    const gone = () => (run.entities('brokenRocks') ?? NO_KEYS).has(resolved.rock);
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
        // ⛓ R9 slice L16 — a weigh route's break waits ARMED (`execWeigh`).
        let held = pressedAt !== null && ctx.idleStrike && !run.state.fall
            ? ctx.idleStrike.decide(run.state, run.entities('strikeBodies'), run.ticksCompleted, NO_KEYS,
                { slash: run.progress('slashInfo') }).held
            : NO_KEYS;
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
 * ⛓⛓⛓ R9 SLICE L16 (kickoff §59.4 D2) — **THE LANE'S SILENCER, DERIVED FROM
 * THE ROOM.** A lane is an obstacle with an off switch when (a) the danger on
 * the corridor is an ARMED trap's lane, (b) a `RopeStart` in the same room
 * publishes that trap's own group `t` (`RopeStart.set activate` walks every
 * `Activators` sharing `t` — `RopeStart.as:79-91`), and (c) the latch that
 * publication writes is the one that SILENCES the trap: `arrowTrapFires(trap,
 * true)` is false, i.e. `activate XOR shootDefault` with `shootDefault` set
 * (L16's three). A rope whose latch would ARM its group is no silencer, and a
 * room with no such rope has no PULL rung at all — nothing here is a list.
 *
 * @returns `null` when the rung does not apply (no lane on this corridor has a
 *   silencer in the room — the ladder then skips it WITHOUT a row, so a room
 *   with no rope climbs exactly as it always has), else `{rope, group, traps}`.
 *   ⛔ A lane that is still priced while its silencer is already LATCHED is a
 *   contradiction between the danger map and the run, and throws by name: a
 *   lane that fires while its group is latched is the tell of a model that
 *   stopped reading `latched` (§59.6 m5).
 *
 * `pulling` holds the ropes whose stance the solve is walking to RIGHT NOW. From
 * the far side of the lanes the stance is itself across them, so the walk to it
 * climbs this ladder again — and offering the same rope there would recurse for
 * ever. Skipped, the nested climb escalates past PULL like any other.
 */
/**
 * ⛓ SEEDLING FIDELITY ROBUST, D2 — how many dangers past the first the PULL
 * rung probes a corridor through for a silencable lane. Each is one preview of
 * the same corridor; L16's corridors meet their lane second.
 */
export const LATER_LANE_PROBES = 4;

/**
 * Does any armed lane in this room have a silencer (`deriveLaneSilencer`'s
 * (b) and (c), asked of the room rather than of a hit)? The gate that keeps
 * the later-lane probe out of every room without one.
 */
function roomHasLaneSilencer(run) {
    const ropes = (run.world.solids ?? []).filter((x) => x.ropeId);
    if (ropes.length === 0) return false;
    return (run.world.arrowTraps ?? []).some((t) => !arrowTrapFires(t, true)
        && ropes.some((r) => r.ropeT === t.t));
}

function deriveLaneSilencer(run, hit, what, pulling = new Set()) {
    const laneIds = new Set((hit?.sources ?? [])
        .filter((x) => x.kind === 'arrowLane').map((x) => x.id));
    if (laneIds.size === 0) return null;
    const traps = (run.world.arrowTraps ?? []).filter((t) => laneIds.has(t.id));
    const ropes = (run.world.solids ?? []).filter((x) => x.ropeId);
    const latched = run.entities('latchedGroups') ?? new Set();
    for (const t of traps) {
        if (arrowTrapFires(t, true)) continue;
        const rope = ropes.find((r) => r.ropeT === t.t);
        if (!rope) continue;
        // ⛔ A rope this solve is already walking to pull is not a silencer for
        // the corridor TO it (see `pulling` in the rung).
        if (pulling.has(rope.ropeId)) continue;
        if (latched.has(t.t)) {
            throw new SolverRefusal(`${what}: ${t.id}'s lane is priced as danger while its `
                + `group t=${t.t} is LATCHED in the live run (${rope.ropeId} has published `
                + 'it). `activate XOR shootDefault` with the latch set and `shootDefault` '
                + 'true is FALSE — the trap is silent in the game — so a lane that fires '
                + 'while its group is latched is a model that stopped reading the latch, not '
                + 'a corridor fact.', { obstacle: { kind: 'danger', id: t.id } });
        }
        const group = t.t;
        // What the latch silences is the ROOM's, not the corridor's: every trap
        // of the group whose `activate XOR shootDefault` the latch turns false.
        return {
            rope, group,
            traps: (run.world.arrowTraps ?? [])
                .filter((x) => x.t === group && !arrowTrapFires(x, true)).map((x) => x.id),
        };
    }
    return null;
}

/**
 * Executor: the `pull` verb — AIM, SWING, and assert the LATCH on the live run.
 *
 * `execBreak`'s aim/press alternation, verbatim in shape (the press consumes the
 * previous tick's facing), against the rope's own rect. ⛔ THE POST-CONDITION IS
 * THE WORLD'S: `run.latchedGroups.has(group)` — the same map
 * `armedArrowTraps` reads — never "the verb pressed". A rope that publishes
 * nothing leaves the lanes firing, and this refuses BY NAME at the pull step
 * rather than letting the next corridor walk into them (§59.6 m4). The bound
 * is the mechanism's: the aim tick, the press tick, the swing's
 * `SLASH_HIT_TICKS`, plus one re-aim.
 */
function execPull(run, perTick, resolved, ctx) {
    const refuse = (why) => {
        throw new SolverRefusal(why, { obstacle: { kind: 'solid', id: resolved.rope } });
    };
    const NO_KEYS = new Set();
    const PRESS = new Set(['primary']);
    const from = perTick.length;
    const latched = () => (run.entities('latchedGroups') ?? NO_KEYS).has(resolved.group);
    /**
     * ⛓ THE APPROACH MAY HAVE PULLED IT ALREADY. The walk to the stance carries
     * the strike policy and the dash windows, and a swing up the handle's column
     * reaches the rope's rect as surely as this verb's would (measured on L16:
     * a dash press at t=88 pulled `rope@32,16` twelve ticks before the stance).
     * The post-condition is the world's, so it is asked FIRST — a press after the
     * latch is `hit()`'s real no-op, and spending ticks on it proves nothing.
     */
    if (latched()) {
        const pull = (run.ledger('ropePulls') ?? []).find((p) => p.id === resolved.rope) ?? null;
        return { verb: 'pull', target: resolved.rope, group: resolved.group, from,
            ticks: 0, pressedAt: null, stance: resolved.stance, silenced: resolved.traps,
            pulledBy: `the approach — ${resolved.rope} was pulled at tick `
                + `${pull ? pull.t : '?'} by a swing of the walk to the stance` };
    }
    const bound = 2 * (2 + SLASH_HIT_TICKS);
    let pressedAt = null;
    let aimed = false;
    for (let spent = 0; spent <= bound; spent += 1) {
        if (pressedAt !== null && latched()) {
            return { verb: 'pull', target: resolved.rope, group: resolved.group, from,
                ticks: perTick.length - from, pressedAt, stance: resolved.stance,
                silenced: resolved.traps };
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
                    + `${resolved.rope} is not in reach of a swing from there `
                    + `(SLASH_REACH ${SLASH_REACH} px). The stance this verb derived was `
                    + `${resolved.stance
                        ? `(${resolved.stance.x},${resolved.stance.y})`
                        : 'THE LIVE POSITION'} — a walk that ends somewhere else is a `
                    + 'corridor finding, not a rope one.');
            }
            if (aimed || run.direction === want) {
                held = PRESS;
                pressedAt = run.ticksCompleted;
            } else {
                held = new Set([FACING_KEYS[want]]);
                aimed = true;
            }
        }
        perTick.push(held);
        const { transition } = run.advance(held);
        if (transition) {
            refuse(`${ctx.what}: the run crossed to level ${transition.to_level} while `
                + `pulling ${resolved.rope}.`);
        }
    }
    return refuse(`${ctx.what}: pressed ${resolved.rope} at tick `
        + `${pressedAt === null ? 'NEVER — the aim never resolved' : pressedAt} and group `
        + `t=${resolved.group} is NOT latched in the live run ${bound} ticks later `
        + `(latched: [${[...(run.entities('latchedGroups') ?? [])].join(', ')}]). The rope's `
        + '`set activate` publishes its group on the swing that lands; a pull that '
        + `latches nothing leaves [${resolved.traps.join(', ')}] firing, so the corridor `
        + 'this rung promised does not exist.');
}

/**
 * ⛓⛓⛓ ⚖ §11.8a RULING 2's LADDER — THE COMBAT POLICY'S DECISION ORDER.
 *
 *   AVOID -> TIME -> BAIT -> KILL, cheapest first, and every escalation is a
 *   trace row carrying the refused cheaper rung's reason.
 *
 * ⛓ R9 SLICE L16 — AND `pull` BETWEEN AVOID AND TIME, CONDITIONALLY: it exists
 * only in a room that holds a lane's silencer (`deriveLaneSilencer`), and a
 * climb in any other room skips it without a row.
 *
 * The list is EXPORTED so `r8Acceptance.assertEscalationIsOrdered` checks a
 * run's escalations against the RUNNING order rather than against a copy
 * typed beside the ruling (trap 89). A rung's own implementation is one
 * function below; the order is here and nowhere else.
 */
export const ESCALATION_LADDER = Object.freeze(['avoid', 'dodge', 'pull', 'time', 'bait', 'kill']);

/**
 * ⛓ U15-swim D2 — THE DODGE RUNG's bounds: walk-offsets searched backwards from
 * the hit in steps of `step`, stalls of 1..`maxTicks` (under one 54-tick volley
 * period, so every phase of a turret's clock is reachable), and at most
 * `maxPerSegment` stalls in one segment.
 */
const DODGE_RUNG = Object.freeze({ step: 4, maxTicks: 30, maxPerSegment: 12 });

/**
 * ⛓ SEEDLING FIDELITY AXE — THE DODGE RUNG's AXE ARM's bounds. The stall runs
 * 1 … `period − 1` ticks (derived per axe: `dangerMap.axePeriod`, one revolution,
 * so every other phase is reachable), at `offsets` walk-offsets `step` ticks
 * apart from just before the hit backwards, and it shares the spit arm's
 * per-segment count (`maxPerSegment`).
 */
export const AXE_DODGE_RUNG = Object.freeze({ step: 4, offsets: 8, detourOffsets: 2, detourPreviews: 60,
    rest: 12, maxPerSegment: DODGE_RUNG.maxPerSegment });

/**
 * ⛓ SEEDLING FIDELITY LADDER2 — the DODGE rung's PHASE arm (a lava chain, a beam
 * tower): AXE's shape and bounds, with the stall's length bounded by the
 * longest period in the family, `period` = 90 — `Game.time % 90` is the chain's
 * whole cycle (`LAVA_CHAIN.loops` x `TIME_PER_FRAME`), and every placed tower's
 * pattern is shorter (4 anim frames per side, at most 4 sides: ≤ 60 updates on
 * the map). So a stall of 1 … 89 reaches every phase of every member.
 */
export const PHASE_DODGE_RUNG = Object.freeze({ ...AXE_DODGE_RUNG, period: 90 });

/**
 * ⛓ SEEDLING FIDELITY F1c — THE HAMMER-PHASE RUNG's bounds, beside DODGE's and
 * DERIVED, not tuned (`hammerPhaseRung`):
 *   · `horizon` = `SPINNER.hammerPeriod` (45): one revolution of the line. A
 *     corner the line makes is made inside one turn; a walk previewed clear
 *     for a whole turn has met every phase once.
 *   · `maxTicks` = `hammerPeriod − 1` (44): a hold of 1 … 44 ticks shifts the
 *     arrival to every OTHER phase of the turn, and a 45th is the 0th again.
 *   · `step` = 1: the corner is decided at tick resolution — a body moves
 *     `SPINNER.moveSpeed` (1 px) a tick and the line sweeps 360/45 = 8° a tick,
 *     which is up to `hammerLength` · 8° ≈ 1.8 px at its tip, so a coarser step
 *     could skip the one offset where the player still stands outside the
 *     `hammerLength` (13 px) reach.
 *   · `maxPerKill` = `SPINNER.hitsMax` (3): a press that LANDS is the only
 *     thing the forecast cannot see (the knockback is player-coupled), so a
 *     faithful preview is invalidated at most once per landing, and a kill has
 *     `hitsMax` landings.
 */
export const HAMMER_PHASE_RUNG = Object.freeze({
    horizon: SPINNER.hammerPeriod,
    maxTicks: SPINNER.hammerPeriod - 1,
    step: 1,
    maxPerKill: SPINNER.hitsMax,
});

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
    /**
     * ⛓ R9 slice 12i — `dashMode` rides down here for the same reason ⚖ 46's
     * `economies` rides down to `deriveStance`: this is the one derivation
     * outside `solveSegment`'s closure that builds a strike policy, and a
     * policy built at the roster's default inside a segment granted a
     * different one is two builds pretending to be one.
     */
    { aim = null, allowTeleporter = null, tolerance = 0,
        dashMode = DEFAULT_DASH_MODE } = {}) {
    if (!(run.entities('strikeBodies') ?? []).some((b) => b.id === body.id)) {
        return { stance: null, why: `${body.id} is not a body this run steps — the chaser `
            + 'arm needs a live position, and a static census body has none' };
    }
    const target = run.entities('strikeBodies').find((b) => b.id === body.id);
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
    const planOpts = solverPlanOpts(run, contacts);
    const strikeFor = () => strikePolicyFor(run, { dashMode });

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
    /**
     * ⛓ SF2 — the stance scan below is the rung's cost (89 % of D's L14
     * decline, the l16-budget report §2), so a reached deadline refuses the rung
     * here, by name, and the ladder goes on.
     */
    if (deadlineReached('kill-chaser')) {
        return { stance: null, why: 'deadline — the caller\'s anytime deadline '
            + '(`shouldStop`) was reached before this rung\'s stance scan, so the scan '
            + 'was not run' };
    }
    const aimIsPlannable = aim !== null
        && corridorPlans(run.world, run.state, aim, allowTeleporter, planOpts);
    // ── condition 1, and the cheap half of 3 and 4 ────────────────────
    const inLeash = [];
    const candidates = [];
    /**
     * ⛓ FIDELITY CHECKPOINTS (the JS arc's recalibration, measured): the scan's
     * per-cell `corridorPlans` pairs were the longest ask-free stretch left —
     * L12's sphere-2.2 leg (`level_12__r0c37 -> level_21`) ran 663 s between
     * two `walk` asks inside this one derivation. Opted in, the `kill-chaser`
     * site is asked once per scanned cell and once per scored candidate; a trip
     * refuses the rung with the shape of the entry ask above (the ladder goes
     * on). Opted out, nothing is asked and the scan is byte-identical.
     */
    let scanned = 0;
    let scanTripped = false;
    const scanAround = (here) => {
        for (let dy = -STANCE_SCAN_CELLS; dy <= STANCE_SCAN_CELLS; dy += 1) {
            for (let dx = -STANCE_SCAN_CELLS; dx <= STANCE_SCAN_CELLS; dx += 1) {
                if (scanTripped) return;
                const c = nodeCentre(here.tx + dx, here.ty + dy, pitch);
                const d = Math.hypot(c.x - targetCentre.x, c.y - targetCentre.y);
                if (d > leash) continue;
                inLeash.push(c);
                if (fineDeadlineReached('kill-chaser')) { scanTripped = true; return; }
                scanned += 1;
                if (!corridorPlans(run.world, run.state, c, allowTeleporter, planOpts)) continue;
                if (aimIsPlannable
                    && !corridorPlans(run.world, c, aim, allowTeleporter, planOpts)) continue;
                candidates.push({ ...c, d,
                    approach: Math.hypot(c.x - run.state.x, c.y - run.state.y) });
            }
        }
    };
    scanAround(nodeAt(run.state.x, run.state.y, pitch));
    /**
     * ⛓⛓ SEEDLING SWIM U10, D1 — **THE FALLBACK SCAN, CENTRED ON THE TARGET**
     * (U7 § D4's wall 1, its scratch change 1, re-measured on main).
     *
     * The box above is centred on the PLAYER, which is where every committed
     * chaser fight asks from: the walk meets the body, so the body is near.
     * L12's ladder asks from the ARRIVAL, ~470 px from `puncher@416,256`, and
     * that box held "0 cell(s) inside its 80 px leash" — the body was never a
     * hypothesis, and the refusal read as geometry when it was the scan's
     * centre (trap candidate: a scan centred on the asker).
     *
     * ⛔ ONLY when the player's box holds no leash cell, so every stance a
     * committed solve chose is still chosen the same way (the six `--check`s
     * are the receipt). The refusal names which centre the cells came from.
     */
    const aroundTarget = inLeash.length === 0;
    if (aroundTarget) scanAround(nodeAt(targetCentre.x, targetCentre.y, pitch));
    if (scanTripped) {
        return { stance: null, why: 'deadline — the caller\'s anytime deadline (`shouldStop`) was '
            + `reached during this rung's stance scan, after ${scanned} cell(s), so the rest of the `
            + 'scan was not run' };
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
        if (fineDeadlineReached('kill-chaser')) {
            return { stance: null, why: 'deadline — the caller\'s anytime deadline (`shouldStop`) was '
                + `reached while this rung scored its stance candidates, after ${scored.length} scored, `
                + 'so the rest were not priced' };
        }
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
                sm.arrows, sm.chasers, sm.spits ?? null, sm.grenades ?? null);
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
                + `${aroundTarget ? `the ${STANCE_SCAN_CELLS}-cell box around the player's `
                    + 'node held 0 leash cells, so the box around the TARGET was scanned: ' : ''}`
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
 * ⛓ SEEDLING FIDELITY L14 — THE DETOUR RUNG's bounds. `maxVias` is how many
 * intermediate cells a candidate corridor may bend through; `maxPreviews` and
 * `maxPlanned` are the `previewWalk`s and the `planWaypoints` legs the search
 * may spend before it refuses BY NAME with the counts.
 *
 * ⚠ THE TWO WORK BOUNDS ARE CALIBRATED, AND SAY SO: L14's swordless crossing
 * is found at 253 previews and 397 legs, and the bounds are ~1.2x that. What
 * they buy is the cost of a FAILING search: L16's pre-sword chaser refusal
 * spent 45 s at 600 previews (its legs cost ~35 ms each — the string-pull), and
 * every chaser-only EXHAUSTED climb pays this rung before it refuses.
 */
export const DETOUR_RUNG = Object.freeze({ maxVias: 2, maxPreviews: 300, maxPlanned: 500 });

/** A polyline's length, from `from` through every waypoint. */
function corridorLength(from, wps) {
    let n = 0;
    let at = from;
    for (const w of wps) { n += Math.hypot(w.x - at.x, w.y - at.y); at = w; }
    return n;
}

/**
 * ⛓⛓⛓ SEEDLING FIDELITY L14 — **THE DETOUR RUNG: A CORRIDOR BENT THROUGH VIA
 * CELLS, PREVIEWED WITH THE CHASERS STEPPED AGAINST IT.**
 *
 * ⚖ The user, 2026-10-04: *"Make an attempt to find a swordless strategy that
 * gets through … We should derive the requirements from what the solver can
 * do."* Every rung below this one asks about ONE corridor — the planner's
 * shortest — or about a STANCE to wait in. None asks the question a chaser room
 * with nothing lethal in it actually poses: **is there a LONGER walk the bodies
 * cannot close on?** A bob chases only inside its 80 px leash and the walk is
 * faster than it, so a corridor that goes AROUND the pack (along a wall, out of
 * reach of the bodies it passes) is safe where the straight one is not.
 *
 * ⛔ THE SEARCH IS BEST-FIRST OVER VIA SEQUENCES AND EVERY CANDIDATE IS THE
 * PROBE'S OWN QUESTION. A candidate is `from → v1 [→ v2] → aim`, each leg the
 * planner's own (`planWaypoints` with the walk's own options), ordered by
 * planned length plus the straight line home — shortest first, ties by the
 * vias' y then x, so the corridor chosen is not an artifact of iteration order.
 * `certify(wps)` is the caller's `previewWalk` + `probeSamples`: the bodies are
 * stepped against THIS candidate's player, per tick, by the run's own
 * `chaserForecast` — one danger predicate, not a second reading of it (trap
 * 567). A prefix already dangerous on the way to its last via is not extended
 * (every extension walks those ticks first).
 *
 * ⛔ IT IS ASKED ONLY WHERE THE LADDER IS EXHAUSTED — after every existing
 * rung refused — so no corridor a committed solve walks can change.
 *
 * Returns `{wps, vias, previews, ticks, length}` or `{wps: null, why}`.
 *
 * @param {object} run
 * @param {object} o
 * @param {{x:number,y:number}} o.aim
 * @param {object} o.planOpts  the walk's own `solverPlanOpts`
 * @param {(wps: object[]) => {hit: object|null, truncated: object|null, ticks: number}} o.certify
 */
export function deriveChaserDetour(run, {
    aim, allowTeleporter = null, planOpts, certify,
    maxVias = DETOUR_RUNG.maxVias, maxPreviews = DETOUR_RUNG.maxPreviews,
    maxPlanned = DETOUR_RUNG.maxPlanned,
}) {
    /**
     * ⛓ the `detour` deadline site, asked FIRST: the via set below plans a leg to
     * every cell of the room before any preview (~225 plans in L16, at ~35 ms
     * each), so a check only inside the loop would still pay it.
     */
    if (deadlineReached('detour')) {
        return { wps: null, previews: 0, planned: 0, bound: { name: 'deadline', site: 'detour' },
            why: 'deadline — the caller\'s anytime '
                + 'deadline (`shouldStop`) was reached before the DETOUR search, so it was not run' };
    }
    const pitch = planOpts.lattice ?? DEFAULT_LATTICE;
    const from = { x: run.state.x, y: run.state.y };
    const home = nodeAt(from.x, from.y, pitch);
    const legs = new Map();
    let planned = 0;
    const leg = (a, b, tele) => {
        const k = `${a.x},${a.y}>${b.x},${b.y}`;
        if (!legs.has(k)) {
            planned += 1;
            legs.set(k, planWaypointsOrNull(run.world, a, b, tele, planOpts));
        }
        return legs.get(k);
    };
    // The via set: every lattice cell of the room the walk can plan to from here
    // (`world.width`/`height` are in TILES).
    const vias = [];
    const cols = Math.ceil(((run.world.width ?? 0) * TILE_SIZE) / pitch);
    const rows = Math.ceil(((run.world.height ?? 0) * TILE_SIZE) / pitch);
    for (let ty = 0; ty < rows; ty += 1) {
        for (let tx = 0; tx < cols; tx += 1) {
            if (tx === home.tx && ty === home.ty) continue;
            /**
             * ⛓ FIDELITY CHECKPOINTS — the `detour` site, once per cell: the via
             * set is the rung's longest stretch (L16 ~19 s here, L40 ~230 s), and
             * a trip refuses the rung with the shape the loop's own trip has.
             */
            if (fineDeadlineReached('detour')) {
                return { wps: null, previews: 0, planned, bound: { name: 'deadline', site: 'detour' },
                    why: `deadline — the caller's anytime deadline (\`shouldStop\`) was reached while `
                        + `the DETOUR search built its via set, after ${planned} leg(s), so the rest of `
                        + 'the search was not run' };
            }
            const c = nodeCentre(tx, ty, pitch);
            const wps = leg(from, c, null);
            if (wps && wps.length > 0) vias.push(c);
        }
    }
    /**
     * ⛓ THE OPEN SET IS A HEAP AND ITS LEGS ARE PLANNED LAZILY. A node enters
     * with the straight line to its newest via as its cost — a LOWER bound on
     * the planned leg — and is planned only when it reaches the top; then it
     * goes back in at its planned cost. The pop order is the planned-length
     * order either way (a bound never overtakes the exact cost it bounds); what
     * it saves is the A* for every extension nobody pops. Measured on L16's
     * pre-sword refusal: the eager form spent ~55 of its 63 s planning legs.
     */
    const order = (a, b) => {
        if (a.est !== b.est) return a.est - b.est;
        for (let i = 0; i < Math.min(a.seq.length, b.seq.length); i += 1) {
            if (a.seq[i].y !== b.seq[i].y) return a.seq[i].y - b.seq[i].y;
            if (a.seq[i].x !== b.seq[i].x) return a.seq[i].x - b.seq[i].x;
        }
        if (a.seq.length !== b.seq.length) return a.seq.length - b.seq.length;
        return (a.prefix ? 0 : 1) - (b.prefix ? 0 : 1);
    };
    const open = [];
    const heapPush = (n) => {
        open.push(n);
        for (let i = open.length - 1; i > 0;) {
            const up = (i - 1) >> 1;
            if (order(open[i], open[up]) >= 0) break;
            [open[i], open[up]] = [open[up], open[i]];
            i = up;
        }
    };
    const heapPop = () => {
        const top = open[0];
        const tail = open.pop();
        if (open.length > 0) {
            open[0] = tail;
            for (let i = 0; ;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let m = i;
                if (l < open.length && order(open[l], open[m]) < 0) m = l;
                if (r < open.length && order(open[r], open[m]) < 0) m = r;
                if (m === i) break;
                [open[i], open[m]] = [open[m], open[i]];
                i = m;
            }
        }
        return top;
    };
    const toAim = (v) => Math.hypot(aim.x - v.x, aim.y - v.y);
    // A planned node: `prefix` is its corridor through its last via.
    const pushPlanned = (seq, prefix) => heapPush({ seq, prefix,
        est: corridorLength(from, prefix) + toAim(seq[seq.length - 1]) });
    // A lazy node: its last leg is not planned yet; `est` bounds it from below.
    const pushLazy = (seq, base, baseLength) => {
        const a = seq[seq.length - 2];
        const v = seq[seq.length - 1];
        heapPush({ seq, prefix: null, base, baseLength,
            est: baseLength + Math.hypot(v.x - a.x, v.y - a.y) + toAim(v) });
    };
    for (const v of vias) pushPlanned([v], leg(from, v, null));
    let previews = 0;
    let candidates = 0;
    let pruned = 0;
    /**
     * ⛓ the `detour` deadline site (SF2's hook): asked before each preview, so a
     * trip refuses the rung by name with the work it had done, and the climb's
     * refusal says so (the ⏱ clause). With no deadline active it answers false.
     */
    const deadlineWhy = () => `deadline — the caller's anytime deadline (\`shouldStop\`) was `
        + `reached in the DETOUR search after ${previews} preview(s) and ${planned} leg(s), so `
        + 'the rest of the search was not run';
    while (open.length > 0 && previews < maxPreviews && planned < maxPlanned) {
        if (deadlineReached('detour')) {
            return { wps: null, previews, planned, bound: { name: 'deadline', site: 'detour' },
                why: deadlineWhy() };
        }
        const node = heapPop();
        const last = node.seq[node.seq.length - 1];
        if (!node.prefix) {
            const more = leg(node.seq[node.seq.length - 2], last, null);
            if (more && more.length > 0) pushPlanned(node.seq, [...node.base, ...more]);
            continue;
        }
        const tail = leg(last, aim, allowTeleporter);
        /**
         * ⛔ ONE PREVIEW PER CANDIDATE, AND IT ALSO ANSWERS THE PREFIX. A sample
         * carries the index of the waypoint it walks toward (`wp`), so a danger
         * met while still walking the prefix's waypoints condemns the prefix and
         * every extension of it; a danger met after them clears the prefix
         * (its ticks are the same ticks). Only a candidate with no plannable
         * tail spends a preview on the prefix alone.
         */
        let prefixClear = null;
        if (tail) {
            const wps = [...node.prefix, ...tail];
            candidates += 1;
            previews += 1;
            const r = certify(wps);
            if (!r.hit && (!r.truncated || r.truncated.kind === 'crossed')) {
                return { wps, vias: node.seq.map((v) => ({ x: v.x, y: v.y })), previews,
                    candidates, planned, ticks: r.ticks, length: Math.round(corridorLength(from, wps)) };
            }
            if (r.hit) prefixClear = r.hitWp >= node.prefix.length;
        }
        if (node.seq.length >= maxVias || previews >= maxPreviews) continue;
        if (prefixClear === null) {
            previews += 1;
            const p = certify(node.prefix);
            prefixClear = !p.hit && !p.truncated;
        }
        if (!prefixClear) { pruned += 1; continue; }
        const baseLength = corridorLength(from, node.prefix);
        for (const v of vias) {
            if (v.x === last.x && v.y === last.y) continue;
            pushLazy([...node.seq, v], node.prefix, baseLength);
        }
    }
    return {
        wps: null,
        previews,
        planned,
        /**
         * ⛓ SEEDLING FIDELITY ROBUST, D1 — WHICH BOUND ended the search, as a
         * field: `null` when the open set ran dry (a true "no corridor"), else
         * the counts the `why` sentence prints. The loop stops only on an empty
         * open set or a bound, so a candidate left unasked IS a bound.
         */
        bound: open.length === 0 ? null : {
            name: 'DETOUR_RUNG',
            hit: [previews >= maxPreviews ? 'maxPreviews' : null,
                planned >= maxPlanned ? 'maxPlanned' : null].filter(Boolean),
            previews, maxPreviews, planned, maxPlanned, maxVias, unasked: open.length,
        },
        why: `no corridor bent through at most ${maxVias} via cell(s) of the ${vias.length} `
            + `the walk can plan to probes clean: ${candidates} candidate corridor(s) previewed `
            + `with the bodies stepped against each, ${pruned} prefix(es) dangerous before their `
            + `last via, ${previews} preview(s) of the ${maxPreviews} bound spent and ${planned} `
            + `leg(s) of the ${maxPlanned} planned`
            + `${open.length > 0 ? `, ${open.length} candidate(s) left unasked` : ''}.`,
    };
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
    let live = new Set((run.entities('strikeBodies') ?? []).map((b) => b.id));
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
 * ⛓⛓⛓ SEEDLING FIDELITY SF2 — **THE ANYTIME DEADLINE**, the user's idea at the
 * solver's own grain (2026-10-04: *"first search for solutions that don't
 * involve sword dashes … and runs out of time while searching the dash
 * options, it falls back on the solution it already found. This same pattern
 * might work for other expensive and optional strategies."*).
 *
 * ⛔⛔ THE CLOCK IS THE CALLER'S, NEVER THIS MODULE'S. A wall-clock budget makes
 * a solve depend on machine load, and every committed solve (tapes, `--check`s,
 * certifications, CI) must stay byte-identical. So the hook is a CALLBACK the
 * caller owns — the live worker passes a clock, a test passes a deterministic
 * counter — and `solveSegment` without one (`shouldStop` null, the default) is
 * today's search exactly: no site below consults anything when no deadline is
 * active.
 *
 * ⛓ IT IS ASKED PER SITE, AND IT LATCHES PER SITE. `shouldStop(site)` names
 * the site asking (one of `DEADLINE_SITES`), so a caller may bound only the
 * lossless one (`site === 'sword-dash'`) or all of them; once it has answered
 * true for a site it is never asked for that site again, and that site stays
 * refused for the rest of the segment. A clock or a counter ignores the
 * argument and trips every site from the same instant, and the remainder of
 * the solve is a pure function of where each site tripped.
 *
 * ⛓ THE SITES, and what a trip there does (`DEADLINE_SITES`):
 *  - `sword-dash` — `planSwordDash`, before each candidate preview. It
 *    returns the ordinary refusal shape with `why: 'deadline'`, so `walkTo`
 *    drives the corridor it had ALREADY certified with no dash plan — the same
 *    branch every walk whose scan found no faster window takes. ⇒ a trip here
 *    cannot itself refuse anything.
 *  - `stance-hypothesis` — the lazy thunk (SF1) answers `[]`: a stance that
 *    needed another obstacle discharged is not found. CAN turn a solve into a
 *    refusal.
 *  - `block-route` — `deriveBlockRoute`, before each expansion: refused with
 *    `bound: 'deadline'`, the shape `MAX_ROUTE_EXPANSIONS` already has. CAN turn
 *    a solve into a refusal.
 *  - `kill-chaser` — `deriveKillByChaser`, before its stance scan: the rung
 *    refuses by name and the ladder continues. CAN turn a solve into a refusal.
 *  - `detour` — `deriveChaserDetour` (the L14 DETOUR rung), before its search
 *    and before each candidate preview: the rung answers no corridor, with a
 *    `deadline` reason, and the climb ends EXHAUSTED by name. It is the rung's
 *    whole cost on a failing chaser-only climb (L16's pre-sword refusal ~10–14 s,
 *    the L14 report). CAN turn a solve into a refusal (L14 swordless).
 *  - `axe-dodge` — the DODGE rung's AXE arm (fidelity AXE), before each stall
 *    preview: the arm answers no stall, with a `deadline` reason, and the climb
 *    goes on up the ladder. CAN turn a solve into a refusal.
 *  - `phase-dodge` — the DODGE rung's PHASE arm (fidelity LADDER2: a lava chain
 *    or a beam tower), asked exactly where `axe-dodge` is in its own arm, and
 *    with the same effect. Coarse (always asked), like `axe-dodge`: the arm
 *    exists only on a climb whose every reason is a clocked chain or beam,
 *    which refused EXHAUSTED before it, so no existing solve's sequence moves.
 *  - `hammer-escape` — the press kill's ESCAPE search (hammer-phase A,
 *    `pressEscape`), every `SPACE_TIME_CHECK_EVERY` expansions inside
 *    `spaceTimeReach`. Asked ONLY with `HAMMER_ESCAPE` on (ON by default since
 *    hammer-phase A2; OFF it is never asked). A trip is "no claim": the strike is
 *    admitted and the aim taken exactly as with the switch off, so a trip here
 *    cannot itself refuse anything.
 *
 * ⛓⛓ FIDELITY CHECKPOINTS — THE FINE SITES ARE OPT-IN (`solveSegment`'s
 * `fineCheckpoints: true`). The two below and the via-set asks of `detour` are
 * asked only then: every existing consult-counting caller (the JS arc's work
 * budget, `seedlingCanCross`'s consult budget, the SF witnesses) sees today's
 * sequence exactly until it opts in — the unit's meaning moves in ONE commit,
 * with the budget calibrated for it.
 *  - `time` — the TIME rung (fidelity CHECKPOINTS): asked before the mover's
 *    search and every `mover.DEFAULT_CHECK_EVERY` expansions inside it (one
 *    search ran ~22 s with no ask on L8). A trip ends the search with a
 *    NEGATIVE whose bound is `deadline`, and the ladder goes on to BAIT — FALLS
 *    THROUGH to the next rung. CAN turn a solve into a refusal (or into a
 *    different rung's plan) when TIME was the rung that solved.
 *  - `walk` — THE CORE (fidelity CHECKPOINTS): asked at each `walkTo` attempt,
 *    before its corridor is planned, and every `WALK_CHECK_TICKS` ticks the
 *    segment drives. Not an optional scan: L40's dashless walks ran ~3 s (8–13 s
 *    on a slower box) with no ask at all. Also asked between a walk's plan and
 *    its danger probe, and every `WALK_CHECK_TICKS` samples of that probe. A
 *    trip REFUSES THE SEGMENT BY NAME: a `SolverRefusal` with no obstacle, whose
 *    words name the `walk` site and where, plus the ⏱ clause and `e.deadline`.
 *    CAN turn any solve into a refusal — it is the bound on the whole solve's
 *    work.
 *
 * ⛓ FIDELITY CHECKPOINTS also ask `detour` inside the DETOUR rung's via set
 * (opt-in, as above), once per lattice cell it plans to (L16's ~225 legs ran
 * ~19–50 s between the rung's first two asks; L40's thousands, ~230 s after
 * its first).
 *
 * ⛔ IT IS NEVER SILENT: a segment that tripped returns `deadline` beside its
 * trace (the first site, and per-site counts), and a refusal raised after a
 * trip carries the same object and says so in its words.
 */
export const DEADLINE_SITES = Object.freeze(['sword-dash', 'stance-hypothesis',
    'block-route', 'kill-chaser', 'detour', 'axe-dodge', 'time', 'walk', 'phase-dodge', 'hammer-escape']);

/**
 * ⛓ FIDELITY CHECKPOINTS — the ticks a segment drives between two asks of the
 * `walk` site. A tick of L40's dashless walk costs ~2–3 ms here (every spinner
 * of the room is stepped), so 32 ticks keep the stretch near 0.1 s.
 */
export const WALK_CHECK_TICKS = 32;

/** The deadline the segment being solved runs under — `null` is "none". */
let activeDeadline = null;

/**
 * ⛓ FIDELITY CHECKPOINTS — is a deadline active that asked for the FINE sites
 * (`fineCheckpoints: true`)? With none active, or one that did not opt in,
 * every fine ask below answers false and calls nothing.
 */
const fineActive = () => activeDeadline !== null && activeDeadline.fine === true;

/** ⛓ FIDELITY CHECKPOINTS — `deadlineReached`, for a FINE ask (opt-in). */
const fineDeadlineReached = (site) => fineActive() && deadlineReached(site);

/**
 * Has the active deadline been reached for `site`? Asked by a site, before its
 * optional work. ⛔ With no deadline active this returns false and calls nothing.
 */
function deadlineReached(site) {
    const d = activeDeadline;
    if (d === null) return false;
    if (!d.tripped.has(site)) {
        if (!d.shouldStop(site)) return false;
        d.tripped.add(site);
        d.first ??= site;
    }
    d.sites[site] = (d.sites[site] ?? 0) + 1;
    return true;
}

/** The `deadline` object a tripped segment reports. */
const deadlineReport = (d) => ({ tripped: true, first: d.first, sites: { ...d.sites } });

/** The sentence a refusal raised after a trip carries. */
const deadlineClause = (d) => ` ⏱ DEADLINE: the caller's \`shouldStop\` tripped (first at `
    + `\`${d.first}\`) and refused ${Object.entries(d.sites)
        .map(([k, n]) => `${n} \`${k}\` scan(s)`).join(', ')} — this refusal may be the `
    + 'deadline\'s, not the room\'s.';

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
 * @param {?function} [o.shouldStop] SF2's anytime deadline: `(site) => boolean`,
 *   the caller's own (a clock live, a counter in a test). Consulted before each
 *   optional scan, with the site's name (`DEADLINE_SITES`), and latched per site
 *   once true. Omitted or `null`: no deadline, today's search exactly — every
 *   committed solve passes none.
 * @param {boolean} [o.fineCheckpoints] ⛓ FIDELITY CHECKPOINTS — also ask the
 *   FINE sites (`time`, `walk`, and `detour` inside its via set), so no long
 *   stretch of the solve runs without an ask. Default false: the consult
 *   sequence of every existing caller, exactly. Meaningless without a hook.
 * @returns {{perTick: Array<Set>, trace: object, transitions: Array,
 *            waypointsPlanned: number, replans: number, records: Array,
 *            deadline?: {tripped: true, first: string, sites: object}}}
 *   `deadline` is present only when the hook tripped.
 */
export function solveSegment(o) {
    const shouldStop = o?.shouldStop ?? null;
    // ⛔ No hook: the segment runs under whatever deadline is already active —
    // none at all for every committed caller — so the default is untouched.
    if (shouldStop === null) return solveSegmentUnder(o);
    if (typeof shouldStop !== 'function') {
        fail(`solveSegment: shouldStop must be a function (site) => boolean or null, got `
            + `${typeof shouldStop} — the deadline is a callback the caller owns, never a `
            + 'number of milliseconds this module would read a clock for.');
    }
    return withSolveDeadline({ shouldStop, fineCheckpoints: o.fineCheckpoints ?? false },
        () => solveSegmentUnder(o));
}

/**
 * ⛓ The deadline install `solveSegment` runs a hooked segment under, exported so
 * a rung can be driven under a deadline one layer in (the kill-chaser scan's
 * fine rows call `deriveKillByChaser` directly, as slice 12b′'s rows do). `fn`'s
 * object result gains `deadline` when a site tripped; a `SolverRefusal` it
 * throws gains the clause and `e.deadline`. Nested installs restore the outer.
 */
export function withSolveDeadline({ shouldStop, fineCheckpoints = false }, fn) {
    if (typeof shouldStop !== 'function') {
        fail(`solveSegment: shouldStop must be a function (site) => boolean or null, got `
            + `${typeof shouldStop} — the deadline is a callback the caller owns, never a `
            + 'number of milliseconds this module would read a clock for.');
    }
    const outer = activeDeadline;
    const fine = fineCheckpoints;
    if (typeof fine !== 'boolean') {
        fail(`solveSegment: fineCheckpoints must be a boolean, got ${typeof fine}`);
    }
    const deadline = { shouldStop, fine, first: null, tripped: new Set(), sites: {} };
    activeDeadline = deadline;
    try {
        const out = fn();
        return deadline.first === null ? out : { ...out, deadline: deadlineReport(deadline) };
    } catch (e) {
        if (deadline.first !== null && e instanceof SolverRefusal) {
            e.message += deadlineClause(deadline);
            e.deadline = deadlineReport(deadline);
        }
        throw e;
    } finally {
        activeDeadline = outer;
    }
}

function solveSegmentUnder({
    run, goals, name, boot,
    tolerance = DEFAULT_TOLERANCE,
    maxTicksPerTarget = DEFAULT_MAX_TICKS_PER_TARGET,
    /**
     * ⛓⛓⛓ R9 SLICE P2, ⚖ RULING 54 (5) — **THE ECONOMIES' PERMISSION, ONE
     * NAME, DEFAULTED TO THE ROSTER-WIDE FLAG.** ⚖ 46's collect stance and
     * ⚖ 47's early walk both move committed artifacts the moment they are
     * live (their own docblocks name which), so on `main` they are OFF and
     * the flip is what turns them on — the same series ⚖ 42's tail and ⚖ 51
     * bind together. Handing `economies: true` here IS the grant, which is
     * how their rows run at a `false` head without a second flag state for
     * the preview/drive equality to cover (`strikePolicyFor`'s `dashPlan`
     * is the same shape, and the reason this is one name and not two).
     */
    economies = ECONOMIES_ROSTER_WIDE,
    /**
     * ⛓⛓⛓ R9 SLICE 12i — **THE DASH PERMISSION, AND IT IS A FOURTH NAME
     * BESIDE `economies` RATHER THAN A RENAME OF IT.**
     *
     * ⛔ THE THREE `economies` READS ABOVE WERE NEVER DASH SITES. ⚖ Ruling
     * 54 (5) put ⚖ 46's collect stance and ⚖ 47's early walk BEHIND
     * `ALLOW_DASH_ROSTER_WIDE` as their RELEASE GATE (§40.3) — they merely
     * DEFAULTED off it. Spelling them `dashMode` would have made
     * `--dash=none` revert them too, moving four committed artifacts
     * (`r8-solve-10` 90 → 89 · `r8-solve-20` 365 → 332 · `r8-d2-19`
     * 864 → 807 · `r8-d2-20` 781 → 756, the `economies` docblock's own
     * census) that have nothing to do with dashing.
     *
     * ⛓⛓ AND AT 12j (⚖ RULING 61 (ii)) THE YOKE IS CUT AT THE OTHER END TOO.
     * `ECONOMIES_ROSTER_WIDE` is its own constant, so `DEFAULT_DASH_MODE`
     * no longer drags the economies with it: BOTH the `--dash=` grant and a
     * constant flip now price the window pass ALONE. 12i had to say the
     * opposite here — a `none` default dragged the derived alias false and
     * priced pass ∪ economies — and §49.5's C vs D columns are the
     * measurement of the difference, five producers of seven.
     */
    dashMode = DEFAULT_DASH_MODE,
    /**
     * ⛓⛓ SEEDLING JS SOLVER-WALK S0 — **A RUN THAT HAS ALREADY TICKED, ADMITTED
     * BY NAME.** `prefix` is the key sets the CALLER already advanced `run`
     * through from `boot`; the returned `perTick` is `prefix` followed by the
     * solution, so it is still one tape from `boot` and the trace's ticks index
     * it. The Playback Bot's solver mode replays its own session into a SHADOW
     * run and hands the replayed keys here, then plays the solution on the live
     * page. ⛔ The solver cannot check that `run` IS the prefix replayed from
     * `boot` — only the caller replayed it, so the caller owns that claim. The
     * default `[]` is the v1 path, refusal and all.
     */
    prefix = [],
    /**
     * ⛓ SEEDLING FIDELITY FRONTIER3 — the fine-lattice retry's grant
     * (`FINE_LATTICE`), defaulted to `FINE_LATTICE_ROSTER_WIDE` (off): a
     * frontier refusal is asked once more on the 8 px lattice only when this
     * is true.
     */
    fineLattice = FINE_LATTICE_ROSTER_WIDE,
}) {
    assertDashMode(dashMode, 'solveSegment');
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
    if (!Array.isArray(prefix) || !prefix.every((h) => h instanceof Set)) {
        fail('solveSegment: prefix must be an array of key Sets — the ticks the caller '
            + 'already advanced this run through from `boot`.');
    }
    const ticked = run.ticksCompleted;
    if (prefix.length === 0 && ticked !== 0) {
        fail('solveSegment: the run must be fresh (ticksCompleted 0) — the solver owns '
            + 'the whole segment from its declared boot, so the tape and the trace '
            + 'describe the same run from tick 0.');
    }
    if (prefix.length > 0 && ticked < prefix.length) {
        fail(`solveSegment: a prefix of ${prefix.length} tick(s) on a run that has `
            + `completed ${ticked} — the run cannot have been advanced through `
            + 'its prefix (dead frames make the run clock AT LEAST the tape clock, never '
            + 'less). The caller owns "this run is the prefix replayed from `boot`".');
    }

    const perTick = prefix.map((h) => new Set(h));
    /**
     * ⛓⛓⛓ SEEDLING FIDELITY F2, D1a: **THE APITEMS THIS SEGMENT TOOK,
     * observed on every advance.** The run does not model an apitem (no role,
     * no ledger: the JS page owns its report), so the take is a function of
     * the trajectory alone. It is read at the one place every executor's tick
     * passes through: `run.advance`. Any walk, wait or verb that crosses one
     * takes it exactly as the game would, which is how a goal met in passing
     * is recognised. The view is `Object.create(run)` with an own `advance`,
     * so every other member is the run's own (its getters close over the run,
     * not `this`), and a caller's recording Proxy (`jsRuntimeSolver`) sees
     * exactly one advance per tick, as before. With no apitem in the level the
     * observer reads three fields and changes nothing.
     *
     * Keyed `level:id`; the tick is the TAPE index of the advance that took
     * it (the prefix included), so a tape of `tick + 1` ticks takes it.
     */
    const apItemsTaken = new Map();
    /**
     * ⛓⛓ SEEDLING FIDELITY DASH, D3 — **THE DASHES THIS SEGMENT PRESSED,
     * COUNTED WHERE THE RUN DECIDES THEM.** A trace row's `strategy.swordDash`
     * is one walk's PLAN, and only the walk rows that survive `seeRow`'s
     * same-tick merge carry it — a rung's inner walk (L16's PULL walk to the
     * rope stance) plans a dash no row records (SF report residue 1). So the
     * count is read off the run itself, on the same `advance` every executor's
     * tick passes through: `slashDashed` rises only in `set slashing`'s DASH arm
     * (`combatVerbs.slashSet`) and falls only on the release, which is at least
     * four ticks later — so one false→true edge across one advance is exactly
     * one dash, whoever pressed it. `dashWalks` is the per-walk record (inner
     * rung walks included): what each walk's planner handed the drive and how
     * many of the run's dashes that walk's ticks pressed. Neither changes a
     * decision; both are read by nothing in this module.
     */
    let dashesPressed = 0;
    const dashWalks = [];
    /** ⛓ FRONTIER3 — the walks planned on `FINE_LATTICE` after the frontier refused. */
    const fineLatticeWalks = [];
    {
        const inner = run;
        let tapeTick = prefix.length;
        const advance = (held) => {
            const dashedBefore = inner.progress('slashInfo').state.slashDashed === true;
            const items = inner.world?.apItems ?? [];
            const pre = items.length === 0 ? null : {
                level: inner.level, x: inner.state.x, y: inner.state.y,
                inCeremony: Boolean(inner.progress('inCeremony')),
                deaths: inner.ledger('playerDeaths').length,
                transitions: inner.transitions.length,
            };
            /**
             * ⛓ FIDELITY CHECKPOINTS — the `walk` site, every `WALK_CHECK_TICKS`
             * ticks this segment drives (counted from its own first tick, so the
             * asks are a function of the solve alone). A trip refuses by name.
             */
            if (activeDeadline !== null && tapeTick > prefix.length
                && (tapeTick - prefix.length) % WALK_CHECK_TICKS === 0 && fineDeadlineReached('walk')) {
                refuseWalkDeadline(`after ${tapeTick - prefix.length} tick(s) of the segment's drive`);
            }
            const out = inner.advance(held);
            if (!dashedBefore && inner.progress('slashInfo').state.slashDashed === true) {
                dashesPressed += 1;
            }
            if (pre) {
                const open = items.filter((a) => !apItemsTaken.has(`${pre.level}:${a.id}`));
                const a = apItemTakenOnTick(open, pre, {
                    level: inner.level, deaths: inner.ledger('playerDeaths').length,
                    transitions: inner.transitions.length,
                });
                if (a) {
                    apItemsTaken.set(`${pre.level}:${a.id}`, { tick: tapeTick, level: pre.level, apItem: a });
                    // ⛓ F7 (D-B): `removed()`'s write, on the take tick, into the
                    // RUN's ledger — so a revisit in this run builds without it.
                    inner.takeApItem({ level: pre.level, id: a.id, tag: a.tag });
                }
            }
            tapeTick += 1;
            return out;
        };
        run = Object.create(inner, { advance: { value: advance } });
    }
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
    /**
     * ⛓⛓ SEEDLING SWIM U1, D1 — THE GOAL'S OWN PLAN EXEMPTION, per goal like
     * `applied`. A `reach-pit` goal sets `{allowPit: {tx, ty}}` — the driver's
     * own exemption (`plannerObstacleAt`, the pit-exit leg's `planNow`) — so
     * that ONE pit tile is floor to every plan this goal makes: the corridor,
     * the AVOID rung, the removal hypothesis and the frontier flood. Every
     * other goal kind leaves it `{}`, so their bags are the bags they were.
     */
    let goalPlanExtra = {};
    /**
     * ⛓⛓⛓ U12-swim D2 — THE GOAL'S RIDES, per goal like `goalPlanExtra`. A
     * `reach-pit` goal whose pit is fed by `Pull` currents the model STEPS
     * (`levelRun.stepPullsNow`) admits exactly those currents: their contact
     * keys join every attempt's `contacts`, so the plan, the frontier flood and
     * the drive's live volume watch all read the funnel as floor that carries
     * the player in. Any other pull stays an avoid volume. Empty for every
     * other goal, so their bags are the bags they were.
     */
    let goalRides = new Set();
    const grazes = [];
    const records = [];
    /**
     * ⛓ Swim U5 — the slot selections THIS segment made (`run.equipNow`), as
     * `{t, slot}`. A tape carries an equip as a field, not as keys, so a
     * caller that folds `perTick` into a tape (or replays it) must apply
     * these too. The staging's own equips are not here.
     */
    const solverEquips = [];
    const equip = (slot) => {
        run.equipNow(slot);
        solverEquips.push({ t: run.ticksCompleted, slot });
    };

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
    /** ⛓ FIDELITY CHECKPOINTS — the `walk` site's trip: the segment refuses by name. */
    const refuseWalkDeadline = (where) => refuse(`solverBot(${name}): the caller's anytime deadline `
        + `(\`shouldStop\`) was reached at the \`walk\` site ${where} — the segment's own work is `
        + 'bounded there, so the solve stops here instead of overrunning.');

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
        const opts = solverPlanOpts(run, contacts,
            { ...goalPlanExtra, nodeMargin: 0, triggerMargin: 0 });
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
         * ⛓⛓ U12-swim D2 — AN UNMODELLED PULL NEAREST THE AIM IS NAMED, not
         * passed over for the nearest resolvable sub-order. U11's wall 5 was
         * that misattribution: the funnel's pulls were the cut, and the
         * frontier named a keyType-1 lock elsewhere in the room. A pull the
         * model steps for the player is not this case (a pit leg rides it,
         * `pitRides`); one whose box would move a solid is (`pullModelled`).
         */
        {
            const nearest = [...frontier.values()].sort((a, b) => a.d - b.d)[0];
            if (nearest && nearest.kind === 'proximity-hazard' && nearest.tag === 'pull') {
                const p = run.entities('pulls').find((q) => q.id === nearest.id);
                const m = p ? pullModelled(p, run.world) : { modelled: false, why: 'not in this room\'s pull list' };
                if (!m.modelled) {
                    refuse(`solverBot(${name}): no corridor for goal ${goal.kind} toward `
                        + `(${aim.x},${aim.y}) in level ${run.level}. Obstacle: an unmodelled pull `
                        + `${nearest.id} — ${m.why}. \`Pull.update\` writes the position of `
                        + 'whatever overlaps it, and a current the model does not step is priced as '
                        + 'an avoid volume; no strategy crosses one (U12-swim D2).', {
                        goal, obstacle: { kind: 'unmodelled-pull', id: nearest.id },
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
            /**
             * ⛓ R9 SLICE L15 — a refused `shove` names WHAT the block-route
             * search refused (the item that gates a rock, the stance no lean
             * has, the bound it hit), so a refusal reads as a work order
             * rather than a shrug. The MESSAGE is unchanged — the survey and
             * every committed refusal text are the bytes they were; this is
             * the `considered` row on the refusal object.
             */
            const detail = strategy === 'shove'
                ? shoveRefusalDetail(run, obstacle, contacts, aim, allowTeleporter,
                    [...refusedOrders]) : null;
            considered.push({
                option: strategy,
                why: `selected for ${key} and REGISTERED, but the obstacle could not be `
                    + 'resolved against live state — the census row the frontier named '
                    + 'is not one this executor can bind'
                    + (detail ? `. The block-route search refused: ${detail}` : ''),
            });
        }
        if (strategy && !STRATEGY_EXECUTORS[strategy]) {
            considered.push({
                option: strategy,
                why: `selected for ${key} and NOT REGISTERED this slice — a later slice's `
                    + 'executor row, computed rather than guessed',
            });
        }
        const gate = strategy ? null : obstacleGateFor(run, obstacle);
        refuse(`solverBot(${name}): no corridor for goal ${goal.kind} toward `
            + `(${aim.x},${aim.y}) in level ${run.level}. Obstacle: ${key}`
            + `${obstacle.id ? ` (${obstacle.id})` : ''}`
            + `${actionable.length > 1
                ? `; also on the frontier: ${actionable.slice(1).map((o) => o.id).join(', ')}`
                : ''}. `
            + `${strategy
                ? `Strategy '${strategy}' ${STRATEGY_EXECUTORS[strategy]
                    ? 'failed to apply' : 'is SELECTED but not registered this slice'}.`
                : gate ? `${gate.gate}-GATE (${obstacle.id}): ${gate.why}`
                    : 'No strategy row exists for this obstacle.'} `
            + `Planner said: ${planError.message.slice(0, 300)}`,
        { goal, obstacle, considered: gate ? [...considered, { option: `${gate.gate.toLowerCase()}-gate`, why: gate.why }] : considered });
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
    const probeSamples = (samples, except = null, { walkCheck = false } = {}) => {
        for (let i = 0; i < samples.length; i += 1) {
            const s = samples[i];
            // ⛓ FIDELITY CHECKPOINTS — the `walk` site, every `WALK_CHECK_TICKS`
            // samples of the WALK's own probe (`walkCheck`, `walkTo` alone): one
            // probe of an L40 corridor ran ~0.8 s here.
            if (walkCheck && i > 0 && i % WALK_CHECK_TICKS === 0 && fineDeadlineReached('walk')) {
                refuseWalkDeadline(`after ${i} sample(s) of the corridor's danger probe`);
            }
            const d = withoutSources(
                dangerDuringTransit(run, s.tick, playerBoxAt(s.x, s.y), s.arrows, s.chasers,
                    s.spits ?? null, s.grenades ?? null),
                except);
            if (d.danger) return { x: s.x, y: s.y, tick: s.tick, ...d };
        }
        return null;
    };

    const probeCorridor = (wps, except = null, { axisAligned = false, walkCheck = false } = {}) => {
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
        const walk = previewWalk(run, wps, tolerance, axisAligned
            ? { strike: null, axisAligned }
            : { strike: strikePolicyFor(run, { dashMode }) });
        const hit = probeSamples(walk.samples, except, { walkCheck });
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
        const live = [...(run.entities('chasers') ?? [])].map((c) => ({ ...c, stepped: true }));
        /**
         * ⛓⛓ SEEDLING SWIM U1, D3 (F2) — **THE LIVE SPINNERS ARE HYPOTHESISED
         * TOO.** A spinner is in the `spinnerBodies` family, not `chasers`, so
         * until this slice a lock-less spinner on the corridor was never a
         * removal candidate and the kill rung said `!target`. Its death IS
         * observed: `Spinner.removed()` drops it from the roster (`spinnerRects`
         * skips `removed`) and writes its persistence flag
         * (`run.ledger('spinnerWrites')`). `kind: 'spinner'` routes it to the
         * press arm below; `stepped: true` because the run steps it.
         */
        const spinners = [...(run.entities('spinnerBodies') ?? [])].map((b) => ({
            id: b.id, tag: b.id.slice(0, b.id.indexOf('@')), x: b.x, y: b.y,
            kind: 'spinner', stepped: true,
        }));
        const stepped = (run.chaserRoomVerdict?.(run.level)?.stepped) === true;
        const bridged = new Set(bridgedChaserTags());
        const spinnerIds = new Set(spinners.map((b) => b.id));
        const statics = stepped ? [] : (run.world.combat?.enemies ?? [])
            .filter((e) => !bridged.has(e.tag) || !stepped)
            .filter((e) => !spinnerIds.has(`${e.tag}@${e.x},${e.y}`))
            .map((e) => ({ id: `${e.tag}@${e.x},${e.y}`, tag: e.tag, x: e.cx ?? e.x,
                y: e.cy ?? e.y, row: e, stepped: false }));
        const all = [...live, ...spinners, ...statics];
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
                    solverPlanOpts(run, contacts, { ...goalPlanExtra, extraVolumes: without }));
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
    /** ⛓ R9 slice L16 — the ropes whose pull stance a walk is heading for now. */
    const pullingRopes = new Set();
    /** ⛓ Swim R5, D1 — the bait walks in flight (`body@stance#tick`): a re-entry is refused. */
    const baitingBodies = new Set();
    /**
     * ⛓ Seedling fidelity STANCE — the frontier stance walks in flight
     * (`verb(obstacle)#tick`). A stance walk whose own frontier names the same
     * order at the same tick is a re-entry (`STANCE_REENTRY`, in `walkTo`).
     */
    const stanceWalks = new Set();
    /** ⛓ U15-swim D2 — the DODGE rung's stalls this segment (`DODGE_RUNG.maxPerSegment`). */
    let dodgesSpent = 0;
    const climbLadder = ({ goal, aim, contacts, allowTeleporter, what, hit,
        dangerExcept = null, corridor = null, axisAligned = false,
        // ⛓ FRONTIER3 — the AVOID rung re-plans on the lattice the walk was
        // planned on (`FINE_LATTICE` only after a frontier refusal).
        lattice = DEFAULT_LATTICE }) => {
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
        /**
         * ⛓ U15-swim D2 — A SPIT IS NOT A VOLUME. When every reason the probe gave
         * is a `TurretSpit`, the danger is the walk's own TIMING (the turret aims
         * at the player and its clock is the walk's), and no static volume the map
         * can forbid holds it — so a re-plan around the volumes answers a
         * different question. Measured: on L29 it chose a corridor that stalled
         * 400 ticks against a tree, whose truncated preview then probed clean.
         * Refused by name; DODGE below is the rung that asks the right one.
         */
        const spitOnly = hit.sources.length > 0 && hit.sources.every((s) => s.kind === 'spit');
        /**
         * ⛓ SEEDLING FIDELITY AXE — every reason is a SpinningAxe priced at its
         * own update count (`dangerMap.hazardDanger`'s transit arm sets `axe`).
         * The blade is the walk's TIMING too: the same corridor walked a few
         * ticks later meets it at another angle. AVOID is still asked (it may
         * route round the hub), and DODGE below gets the axe's own bounds.
         */
        const axeOnly = hit.sources.length > 0 && hit.sources.every((s) => s.kind === 'hazard' && s.axe);
        if (spitOnly && corridor) {
            refused = { rung: 'avoid', why: 'every reason the probe gave is a TurretSpit '
                + `(${reasonsOf(hit).slice(0, 160)}); a spit is the walk's own timing, not a `
                + 'static volume, so a re-plan around the danger map\'s volumes answers a '
                + 'different question' };
        } else {
            try {
                avoid = planWaypoints(run.world, run.state, aim, allowTeleporter,
                    solverPlanOpts(run, contacts, { ...goalPlanExtra, extraVolumes: vols,
                        ...(lattice === DEFAULT_LATTICE ? {} : { lattice }) }));
            } catch (e) {
                if (!(e instanceof BotDriverV2Error)) throw e;
                refused = { rung: 'avoid', why: `no admissible corridor with the danger map's `
                    + `${vols.length} volume(s) forbidden — ${e.message.slice(0, 200)}` };
            }
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

        /**
         * ── rung 1¼: DODGE — the shooters' own clock (U15-swim D2) ──────────
         *
         * CONDITIONAL, like PULL: it exists only when every reason the probe
         * gave is a `TurretSpit` (`dangerMap.spitDanger`). A turret's aim and
         * its 40-tick clock are FUNCTIONS OF THE WALK — the clock re-arms out of
         * range and the aim lags the player by a tenth per tick — so the same
         * corridor walked a few ticks later inside a range meets every later
         * spit somewhere else. The rung searches for that stall on the
         * corridor's own preview: `at` from just before the hit backwards in
         * steps of `DODGE_RUNG.step`, `ticks` from 1 to `DODGE_RUNG.maxTicks`,
         * and the whole walk (the stall, then the corridor to its end) must
         * probe clean with the same predicate (`probeSamples`).
         *
         * ⛓ IT DRIVES ONLY TO THE STALL'S END, then hands back `{}`: the walk
         * re-plans from where it stands, with the turrets as THEY stand, and
         * the ordinary probe certifies the rest. A corridor that still probes
         * a spit climbs again; `DODGE_RUNG.maxPerSegment` bounds the stalls.
         */
        if (spitOnly && corridor) {
            let dodge = null;
            let dodgeWhy = null;
            if (dodgesSpent >= DODGE_RUNG.maxPerSegment) {
                dodgeWhy = `this segment has already stalled ${dodgesSpent} time(s) for a `
                    + `spit (DODGE_RUNG.maxPerSegment ${DODGE_RUNG.maxPerSegment}) — a walk that `
                    + 'keeps meeting one is not converging';
            } else {
                const lastAt = Math.max(0, hit.tick - run.ticksCompleted - 1);
                search: for (let at = lastAt; at >= 0; at -= DODGE_RUNG.step) {
                    for (let ticks = 1; ticks <= DODGE_RUNG.maxTicks; ticks += 1) {
                        const walk = previewWalk(run, corridor, tolerance, axisAligned
                            ? { strike: null, axisAligned, stall: { at, ticks } }
                            : { strike: strikePolicyFor(run, { dashMode }), stall: { at, ticks } });
                        if (walk.truncated && walk.truncated.kind !== 'crossed') continue;
                        if (walk.samples.length < at + ticks) continue;
                        if (probeSamples(walk.samples, dangerExcept)) continue;
                        dodge = { at, ticks, walk };
                        break search;
                    }
                }
                if (!dodge) {
                    dodgeWhy = `no stall of 1..${DODGE_RUNG.maxTicks} tick(s) at any walk-offset `
                        + `${lastAt}..0 (step ${DODGE_RUNG.step}) clears the corridor of `
                        + `${reasonsOf(hit)}`;
                }
            }
            if (dodge) {
                dodgesSpent += 1;
                rowFor('dodge', refused, { stall: { at: dodge.at, ticks: dodge.ticks },
                    spit: hit.sources[0].id });
                for (const s of dodge.walk.samples.slice(0, dodge.at + dodge.ticks)) {
                    const held = new Set(s.held);
                    perTick.push(held);
                    const { transition } = run.advance(held);
                    if (transition) break;
                }
                return { escalations };
            }
            rowFor('dodge', refused);
            refused = { rung: 'dodge', why: dodgeWhy };
        }

        /**
         * ── rung 1¼, the AXE arm: DODGE a spinning axe by its own phase ──────
         * (SEEDLING FIDELITY AXE). CONDITIONAL like the spit arm: only when every
         * reason the probe gave is a SpinningAxe priced at its update count. The
         * blade's angle is a function of the visit's tick index alone (the AXE
         * report's D1, six game arms), so a stall before the sweep moves the
         * walk to another phase of every axe it then passes. The search is the
         * spit arm's shape with the axe's bounds (`AXE_DODGE_RUNG`): walk-offsets
         * from just before the hit backwards, stalls of 1 … period − 1 (every
         * other phase of one revolution), each candidate certified by the probe's
         * own predicate over the whole walk. Bounded, and a `shouldStop` site
         * (`axe-dodge`).
         */
        if (axeOnly && corridor) {
            let dodge = null;
            let dodgeWhy = null;
            let previews = 0;
            let tripped = false;
            /**
             * One corridor's stall search: the doorstep (the last sample before
             * the hit whose box no hit axe reaches at ANY angle — a stall inside
             * the reach is hit by the blade it waits out), then `offsets`
             * walk-offsets back from it, stalls of 1 … period − 1 at each, every
             * candidate certified by the probe's own predicate over the walk.
             */
            const axeStall = (wps, h, offsets) => {
                const period = Math.max(...h.sources.map((s) => s.axe.period));
                const hitAt = Math.max(0, h.tick - run.ticksCompleted - 1);
                const dangerous = (sm) => probeSamples([sm], dangerExcept) !== null;
                const optsFor = (stall) => (axisAligned
                    ? { strike: null, axisAligned, stall, stopWhen: dangerous }
                    : { strike: strikePolicyFor(run, { dashMode }), stall, stopWhen: dangerous });
                const base = previewWalk(run, wps, tolerance, optsFor(null));
                let door = Math.min(hitAt, base.samples.length - 1);
                while (door > 0 && h.sources.some((s) => axeCanReach(s.axe,
                    playerBoxAt(base.samples[door].x, base.samples[door].y)))) door -= 1;
                const certified = (at, ticks) => {
                    previews += 1;
                    const walk = previewWalk(run, wps, tolerance, optsFor({ at, ticks }));
                    if (walk.truncated && walk.truncated.kind !== 'crossed') return null;
                    if (walk.samples.length < at + ticks) return null;
                    if (probeSamples(walk.samples, dangerExcept)) return null;
                    return { at, ticks, walk, door, wps };
                };
                /**
                 * ⛓ THE SCREEN. Once the stall has brought the player to rest, a
                 * longer stall is the same walk LATER: the standing samples
                 * repeat and the resumed walk is the rest-length one shifted by
                 * the extra ticks. So one preview of a `rest`-tick stall prices
                 * every longer one against the room's axes by arithmetic
                 * (`hazards.axeHitsPlayer` at the shifted tick, the same count
                 * `dangerMap` uses), and only a stall that passes is previewed
                 * for real and certified by the probe. A stall still sliding at
                 * `rest` is previewed for real at every length, as before.
                 */
                const clock = axeVisitClock(run);
                const roomAxes = (run.world.combat?.hazards ?? []).filter((x) => x.tag === 'spinningaxe')
                    .map((x) => ({ cx: x.cx, cy: x.cy, rate: Number(x.attrs?.rate ?? 0) }));
                const rest = AXE_DODGE_RUNG.rest;
                const t0 = run.ticksCompleted;
                const hitsAxe = (x, y, tick) => roomAxes.some((axe) => {
                    const u = tick - clock.v + AXE_UPDATE_OFFSET;
                    return u >= 1 && axeHitsPlayer(axe, u, playerBoxAt(x, y)) !== null;
                });
                for (let k = 0; k < offsets; k += 1) {
                    const at = door - k * AXE_DODGE_RUNG.step;
                    if (at < 0) break;
                    let screen = null;
                    for (let ticks = 1; ticks < period; ticks += 1) {
                        if (deadlineReached('axe-dodge')) { tripped = true; return null; }
                        if (ticks <= rest || screen === null) {
                            const got = certified(at, ticks);
                            if (got) return got;
                            if (ticks === rest && clock.v !== null) {
                                previews += 1;
                                const full = previewWalk(run, wps, tolerance, axisAligned
                                    ? { strike: null, axisAligned, stall: { at, ticks: rest } }
                                    : { strike: strikePolicyFor(run, { dashMode }), stall: { at, ticks: rest } });
                                const sm = full.samples;
                                const still = sm.length > at + rest && sm[at + rest - 1].x === sm[at + rest - 2]?.x
                                    && sm[at + rest - 1].y === sm[at + rest - 2]?.y;
                                screen = still ? sm : false;
                            }
                            continue;
                        }
                        if (screen === false) {
                            const got = certified(at, ticks);
                            if (got) return got;
                            continue;
                        }
                        // ⛓ the stall of `ticks`: samples [0, at + rest) as previewed,
                        // the rest position until at + ticks, then the walk shifted.
                        const shift = ticks - rest;
                        const still = screen[at + rest - 1];
                        let clear = true;
                        for (let i = at; i < screen.length + shift && clear; i += 1) {
                            const s = i < at + rest ? screen[i] : (i < at + ticks ? still : screen[i - shift]);
                            if (hitsAxe(s.x, s.y, t0 + i + 1)) clear = false;
                        }
                        if (!clear) continue;
                        const got = certified(at, ticks);
                        if (got) return got;
                    }
                }
                return null;
            };
            const axes = hit.sources.map((s) => s.id).join(', ');
            let viaWhy = null;
            if (dodgesSpent >= AXE_DODGE_RUNG.maxPerSegment) {
                dodgeWhy = `this segment has already stalled ${dodgesSpent} time(s) for a `
                    + `clocked danger (AXE_DODGE_RUNG.maxPerSegment ${AXE_DODGE_RUNG.maxPerSegment}) — `
                    + 'a walk that keeps meeting one is not converging';
            } else {
                dodge = axeStall(corridor, hit, AXE_DODGE_RUNG.offsets);
                /**
                 * ⛓ AND WHEN THE PLANNER'S CORRIDOR HAS NO STALL, A BENT ONE MAY.
                 * Measured on L61: the shortest corridor from the L60 door climbs
                 * past the hub's west side AGAINST the blade's turn, so it is
                 * caught at every phase; the strip east under the hub turns WITH
                 * the blade, and the walk outruns it. Which side is a property of
                 * the motion, not of a distance, so no forbidden rect separates
                 * them. The DETOUR rung's own search (`deriveChaserDetour`: via
                 * cells, shortest first, bounded, the `detour` deadline site) is
                 * asked with a certifier that admits a corridor clean as it is or
                 * clean after an axe stall (`AXE_DODGE_RUNG.detourOffsets`).
                 */
                if (!dodge && !tripped) {
                    const stalls = new Map();
                    const detour = deriveChaserDetour(run, {
                        aim, allowTeleporter,
                        planOpts: solverPlanOpts(run, contacts, goalPlanExtra),
                        maxPreviews: AXE_DODGE_RUNG.detourPreviews,
                        certify: (wps) => {
                            const dangerous = (sm) => probeSamples([sm], dangerExcept) !== null;
                            const walk = previewWalk(run, wps, tolerance, axisAligned
                                ? { strike: null, axisAligned, stopWhen: dangerous }
                                : { strike: strikePolicyFor(run, { dashMode }), stopWhen: dangerous });
                            const h = probeSamples(walk.samples, dangerExcept);
                            const out = { hit: h, hitWp: h ? walk.samples.at(-1).wp : null,
                                truncated: h ? null : (walk.truncated ?? null), ticks: walk.samples.length };
                            if (!h || !h.sources.every((s) => s.kind === 'hazard' && s.axe) || tripped) return out;
                            const st = axeStall(wps, h, AXE_DODGE_RUNG.detourOffsets);
                            if (!st) return out;
                            stalls.set(wps, st);
                            return { hit: null, hitWp: null, truncated: null, ticks: st.walk.samples.length };
                        },
                    });
                    if (detour.wps) {
                        dodge = stalls.get(detour.wps)
                            ?? { at: null, ticks: 0, walk: null, door: null, wps: detour.wps };
                        dodge.vias = detour.vias;
                    } else {
                        viaWhy = detour.why;
                    }
                }
                if (!dodge) {
                    dodgeWhy = tripped
                        ? `the AXE arm's search stopped at the deadline after ${previews} preview(s) `
                            + `(\`axe-dodge\`) without a stall that clears ${axes}`
                        : `no stall of one revolution or less at the doorstep or ${AXE_DODGE_RUNG.offsets - 1} `
                            + `earlier walk-offset(s) (step ${AXE_DODGE_RUNG.step}) clears the corridor of `
                            + `${reasonsOf(hit)} (${previews} preview(s))`
                            + `${viaWhy ? `; and bent through via cells: ${viaWhy}` : ''}`;
                }
            }
            if (dodge) {
                dodgesSpent += 1;
                rowFor('dodge', refused, { stall: dodge.at === null ? null : { at: dodge.at, ticks: dodge.ticks },
                    axe: hit.sources[0].id, previews, ...(dodge.vias ? { vias: dodge.vias } : {}) });
                if (dodge.at === null) return { wps: dodge.wps, escalations };
                /**
                 * ⛔ THE STALL IS DRIVEN, AND THEN THE REST OF **THE SAME**
                 * CORRIDOR IS WALKED — from the waypoint the preview stood on —
                 * because the timing is the corridor's: a re-plan from the stall
                 * would hand back the planner's shortest corridor, which is the
                 * one that may have been the problem.
                 */
                const upto = dodge.at + dodge.ticks;
                for (const s of dodge.walk.samples.slice(0, upto)) {
                    const held = new Set(s.held);
                    perTick.push(held);
                    const { transition } = run.advance(held);
                    if (transition) return { escalations };
                }
                const wpAt = dodge.walk.samples[upto - 1]?.wp ?? 0;
                return { wps: dodge.wps.slice(Math.max(0, wpAt)), escalations };
            }
            rowFor('dodge', refused);
            refused = { rung: 'dodge', why: dodgeWhy };
        }

        /**
         * ── rung 1⅓, the PHASE arm: DODGE a lava chain or a beam tower by its
         * own clock (SEEDLING FIDELITY LADDER2). CONDITIONAL like the AXE arm:
         * only when every reason the probe gave is a chain or beam priced at its
         * update (`dangerMap.phaseHazardHit` sets `phase`). The chain's arm is
         * out ~20 of every 90 updates on `Game.time`; the beam is up on the
         * second frame of each side, the side turning by `rate` — the game's
         * clocks (`probe-seedling-ladder2-phase.mjs`, K = 0 on every arm). So a
         * stall moves the walk to another phase of every one it then passes.
         * AXE's search, its doorstep (`phaseHazardCanReach`: outside every rect
         * the hazard makes at any phase), its rest screen (the shifted walk
         * priced by `phaseHazardHit`) and its bent-corridor fallback, with
         * `PHASE_DODGE_RUNG` and the `phase-dodge` deadline site. The axe arm
         * above is untouched.
         */
        const phaseOnly = hit.sources.length > 0
            && hit.sources.every((s) => s.kind === 'hazard' && s.phase);
        if (phaseOnly && corridor) {
            let dodge = null;
            let dodgeWhy = null;
            let previews = 0;
            let tripped = false;
            const clock = axeVisitClock(run);
            const roomPhase = (run.world.combat?.hazards ?? [])
                .filter((x) => x.tag === 'lavachain' || x.tag === 'beamtower');
            const t0 = run.ticksCompleted;
            const hitsPhase = (x, y, tick) => roomPhase.some((h) => {
                const r = phaseHazardHit(run, h, clock, tick, playerBoxAt(x, y));
                return r !== null && r.hit !== null;
            });
            const phaseStall = (wps, h, offsets) => {
                const period = PHASE_DODGE_RUNG.period;
                const hitAt = Math.max(0, h.tick - run.ticksCompleted - 1);
                const dangerous = (sm) => probeSamples([sm], dangerExcept) !== null;
                const optsFor = (stall) => (axisAligned
                    ? { strike: null, axisAligned, stall, stopWhen: dangerous }
                    : { strike: strikePolicyFor(run, { dashMode }), stall, stopWhen: dangerous });
                const base = previewWalk(run, wps, tolerance, optsFor(null));
                let door = Math.min(hitAt, base.samples.length - 1);
                while (door > 0 && roomPhase.some((ph) => phaseHazardCanReach(ph,
                    playerBoxAt(base.samples[door].x, base.samples[door].y), run.world.world))) door -= 1;
                /**
                 * ⛓ PROGRESS, NOT ONLY A CLEAN WALK. Two of the arm's rooms (L75's
                 * chains, L103's beam) sit on corridors that then pass a
                 * SpinningAxe, and no single stall clears both clocks (measured:
                 * 1,110 of step 162's stalls clear the chains and meet
                 * `spinningaxe@80,144`). So a stall whose walk's FIRST danger is
                 * not a phase source, met past the last sample from which any
                 * phase hazard can reach, is kept as `partial`: the walk is
                 * driven through the stall, and the next probe meets the other
                 * danger alone — the AXE arm's question. A clean stall is
                 * preferred whenever one exists.
                 */
                let partial = null;
                const lastReach = (() => {
                    let last = -1;
                    base.samples.forEach((sm, i) => {
                        if (roomPhase.some((ph) => phaseHazardCanReach(ph, playerBoxAt(sm.x, sm.y), run.world.world))) last = i;
                    });
                    return last;
                })();
                const certified = (at, ticks) => {
                    previews += 1;
                    const walk = previewWalk(run, wps, tolerance, optsFor({ at, ticks }));
                    if (walk.truncated && walk.truncated.kind === 'stopped' && partial === null
                        && walk.samples.length > at + ticks) {
                        const i = walk.samples.length - 1;
                        const next = probeSamples(walk.samples.slice(-1), dangerExcept);
                        if (next && next.sources.every((x) => !x.phase) && i - ticks > lastReach) {
                            partial = { at, ticks, walk, door, wps, partial: next.sources.map((x) => x.id) };
                        }
                    }
                    if (walk.truncated && walk.truncated.kind !== 'crossed') return null;
                    if (walk.samples.length < at + ticks) return null;
                    if (probeSamples(walk.samples, dangerExcept)) return null;
                    return { at, ticks, walk, door, wps };
                };
                const rest = PHASE_DODGE_RUNG.rest;
                for (let k = 0; k < offsets; k += 1) {
                    const at = door - k * PHASE_DODGE_RUNG.step;
                    if (at < 0) break;
                    let screen = null;
                    for (let ticks = 1; ticks < period; ticks += 1) {
                        if (deadlineReached('phase-dodge')) { tripped = true; return null; }
                        if (ticks <= rest || screen === null) {
                            const got = certified(at, ticks);
                            if (got) return got;
                            if (ticks === rest && clock.v !== null) {
                                previews += 1;
                                const full = previewWalk(run, wps, tolerance, axisAligned
                                    ? { strike: null, axisAligned, stall: { at, ticks: rest } }
                                    : { strike: strikePolicyFor(run, { dashMode }), stall: { at, ticks: rest } });
                                const sm = full.samples;
                                const still = sm.length > at + rest && sm[at + rest - 1].x === sm[at + rest - 2]?.x
                                    && sm[at + rest - 1].y === sm[at + rest - 2]?.y;
                                screen = still ? sm : false;
                            }
                            continue;
                        }
                        if (screen === false) {
                            const got = certified(at, ticks);
                            if (got) return got;
                            continue;
                        }
                        const shift = ticks - rest;
                        const still = screen[at + rest - 1];
                        let clear = true;
                        for (let i = at; i < screen.length + shift && clear; i += 1) {
                            const sm = i < at + rest ? screen[i] : (i < at + ticks ? still : screen[i - shift]);
                            if (hitsPhase(sm.x, sm.y, t0 + i + 1)) clear = false;
                        }
                        if (!clear) continue;
                        const got = certified(at, ticks);
                        if (got) return got;
                    }
                }
                return partial;
            };
            const phased = hit.sources.map((s) => s.id).join(', ');
            let viaWhy = null;
            if (dodgesSpent >= PHASE_DODGE_RUNG.maxPerSegment) {
                dodgeWhy = `this segment has already stalled ${dodgesSpent} time(s) for a `
                    + `clocked danger (PHASE_DODGE_RUNG.maxPerSegment ${PHASE_DODGE_RUNG.maxPerSegment}) — `
                    + 'a walk that keeps meeting one is not converging';
            } else {
                dodge = phaseStall(corridor, hit, PHASE_DODGE_RUNG.offsets);
                if (!dodge && !tripped) {
                    const stalls = new Map();
                    const detour = deriveChaserDetour(run, {
                        aim, allowTeleporter,
                        planOpts: solverPlanOpts(run, contacts, goalPlanExtra),
                        maxPreviews: PHASE_DODGE_RUNG.detourPreviews,
                        certify: (wps) => {
                            const dangerous = (sm) => probeSamples([sm], dangerExcept) !== null;
                            const walk = previewWalk(run, wps, tolerance, axisAligned
                                ? { strike: null, axisAligned, stopWhen: dangerous }
                                : { strike: strikePolicyFor(run, { dashMode }), stopWhen: dangerous });
                            const h = probeSamples(walk.samples, dangerExcept);
                            const out = { hit: h, hitWp: h ? walk.samples.at(-1).wp : null,
                                truncated: h ? null : (walk.truncated ?? null), ticks: walk.samples.length };
                            if (!h || !h.sources.every((s) => s.kind === 'hazard' && s.phase) || tripped) return out;
                            const st = phaseStall(wps, h, PHASE_DODGE_RUNG.detourOffsets);
                            if (!st) return out;
                            stalls.set(wps, st);
                            return { hit: null, hitWp: null, truncated: null, ticks: st.walk.samples.length };
                        },
                    });
                    if (detour.wps) {
                        dodge = stalls.get(detour.wps)
                            ?? { at: null, ticks: 0, walk: null, door: null, wps: detour.wps };
                        dodge.vias = detour.vias;
                    } else {
                        viaWhy = detour.why;
                    }
                }
                if (!dodge) {
                    dodgeWhy = tripped
                        ? `the PHASE arm's search stopped at the deadline after ${previews} preview(s) `
                            + `(\`phase-dodge\`) without a stall that clears ${phased}`
                        : `no stall of 1..${PHASE_DODGE_RUNG.period - 1} tick(s) at the doorstep or `
                            + `${PHASE_DODGE_RUNG.offsets - 1} earlier walk-offset(s) (step `
                            + `${PHASE_DODGE_RUNG.step}) clears the corridor of ${reasonsOf(hit)} `
                            + `(${previews} preview(s))${viaWhy ? `; and bent through via cells: ${viaWhy}` : ''}`;
                }
            }
            if (dodge) {
                dodgesSpent += 1;
                rowFor('dodge', refused, { stall: dodge.at === null ? null : { at: dodge.at, ticks: dodge.ticks },
                    phase: hit.sources[0].id, previews, ...(dodge.vias ? { vias: dodge.vias } : {}),
                    ...(dodge.partial ? { partial: dodge.partial } : {}) });
                if (dodge.at === null) return { wps: dodge.wps, escalations };
                const upto = dodge.at + dodge.ticks;
                for (const sm of dodge.walk.samples.slice(0, upto)) {
                    const held = new Set(sm.held);
                    perTick.push(held);
                    const { transition } = run.advance(held);
                    if (transition) return { escalations };
                }
                const wpAt = dodge.walk.samples[upto - 1]?.wp ?? 0;
                return { wps: dodge.wps.slice(Math.max(0, wpAt)), escalations };
            }
            rowFor('dodge', refused);
            refused = { rung: 'dodge', why: dodgeWhy };
        }

        /**
         * ── rung 1½: PULL — the lane's own off switch (R9 slice L16, §59.4 D2) ──
         *
         * Cheapest after AVOID: a walk and ONE swing, and the lanes are gone
         * for the rest of the visit (the latch is never republished, and the
         * rope's persistence write keeps them silent on re-entry). A NESTED
         * OPENER in L15's `break` shape: the stance is the press-at-rect
         * derivation `break` uses, the walk to it is the ladder's own, and the
         * post-condition is asserted on the live run. Then the caller
         * re-plans, and AVOID sees a danger map whose lanes the run's own
         * `armedArrowTraps` no longer holds.
         *
         * ⛔ CONDITIONAL, AND SAYS SO: in a room with no silencer for a lane
         * on this corridor the rung does not exist — no row, no escalation —
         * which is what keeps every other room's climb byte-identical
         * (`R8_STRATEGY_EXECUTORS.ladder` marks it `conditional`, and
         * `assertEscalationIsOrdered` lets an escalation skip only that kind).
         */
        let silencer = deriveLaneSilencer(run, hit, what, pullingRopes);
        /**
         * ⛓⛓⛓ SEEDLING FIDELITY ROBUST, D2 + D3 — **A LANE FURTHER ALONG THE
         * CORRIDOR IS STILL ON THE CORRIDOR.**
         *
         * The probe answers with the corridor's FIRST danger, and this rung
         * used to ask only that one. Two measured failures on L16 were the
         * same failure:
         *  - D2, one idle tick: the planner's corridor from the door from L15
         *    dips past `bob@48,96`'s home. At the arrival tick the bob's phase
         *    keeps it 5 px clear and the first danger is `arrowtrap@96,32`'s
         *    lane (PULL, 206 t). One tick later the same corridor meets the bob
         *    first, PULL is never asked, and the ladder EXHAUSTS — although
         *    the tick-0 plan, started one to ten ticks late, still crosses
         *    with 0 hits in the model — and, one tick late, on the game
         *    (recorded; the ROBUST report). The refusal was the solver's.
         *  - D3, the Conch: swimming makes the corridor a straight line across
         *    the water onto `sandtrap@48,32`, whose first danger is the trap.
         *    AVOID has no corridor while the lanes are armed, so the ladder
         *    exhausted on an inventory that is strictly larger than one that
         *    solves (`{sword}`, PULL).
         * So: when the first danger has no silencer, the SAME corridor is
         * probed on past it (the sources already met excepted) for a lane
         * that does. The latch is the lane's own off switch for the rest of
         * the visit, and the caller re-plans against the world it leaves.
         *
         * ⛔ INERT WHERE IT CANNOT HELP, by construction: asked only with the
         * sword in the primary slot (the pull this rung derives is a sword
         * swing; a swordless climb keeps its words) and only in a room with a
         * silencer at all (`roomHasLaneSilencer`: L16 alone in the atlas).
         */
        if (!silencer && corridor && run.progress('primaryWeapon') === 'sword'
            && roomHasLaneSilencer(run)) {
            const passed = new Set(dangerExcept ?? []);
            for (let next = hit, n = 0; next && !silencer && n < LATER_LANE_PROBES; n += 1) {
                for (const sx of next.sources) passed.add(sx.id);
                next = probeCorridor(corridor, passed, { axisAligned });
                if (next) silencer = deriveLaneSilencer(run, next, what, pullingRopes);
            }
        }
        if (silencer) {
            const ropeId = silencer.rope.ropeId;
            let pull = null;
            let pullWhy = null;
            const weapon = run.progress('primaryWeapon');
            if (weapon !== 'sword') {
                // ⛔ `break`'s own gate: the pull this rung derives is a SWORD swing.
                pullWhy = `${ropeId} silences [${silencer.traps.join(', ')}] (group `
                    + `t=${silencer.group}), but the run's \`primary\` slot `
                    + `${weapon === null ? 'holds NOTHING' : `fires \`${weapon}\``} — the `
                    + 'pull this rung derives is a SWORD swing (`FIRE_ARM_POLICY.RopeStart` '
                    + 'is modelled too, but no rung of this ladder fires). The sword is a '
                    + 'SUB-ORDER the macro layer owes.';
            } else {
                try {
                    pull = deriveSwingStance(run, { rect: silencer.rope.rect, id: ropeId },
                        contacts, [], ({ candidates, outOfReach, noRect, unsafe }) => 'solverBot: '
                            + `no REACHABLE stance for a swing at ${ropeId} in level ${run.level} — `
                            + `${candidates.length} cell(s) put the slash rect on the rope, `
                            + `${unsafe} of them inside a danger volume, and none of the rest plans `
                            + `a corridor from (${run.state.x},${run.state.y}); ${outOfReach} more `
                            + `were beyond SLASH_REACH (${SLASH_REACH} px) and ${noRect} were in `
                            + 'reach with the rect pointing elsewhere.',
                        // ⛔ THE STANCE IS STOOD IN FOR A SWING, so it must be out of every
                        // static danger volume — the same map AVOID forbids.
                        (c) => !dangerVolumes(run, 0).some((v) => rectsOverlapLocal(
                            playerBoxAt(c.x, c.y), v.rect)));
                } catch (e) {
                    if (!(e instanceof SolverRefusal)) throw e;
                    pullWhy = `${ropeId} silences [${silencer.traps.join(', ')}] (group `
                        + `t=${silencer.group}), but ${e.message}`;
                }
            }
            if (pull) {
                rowFor('pull', refused, { target: ropeId, group: silencer.group,
                    stance: pull.stance });
                if (pull.stance) {
                    pullingRopes.add(ropeId);
                    try {
                        walkTo(goal, pull.stance, { what: `${what} -> pull (${ropeId}) stance` });
                    } finally {
                        pullingRopes.delete(ropeId);
                    }
                }
                const record = execPull(run, perTick, {
                    rope: ropeId, group: silencer.group, traps: silencer.traps,
                    target: silencer.rope.rect, stance: pull.stance,
                }, { what: `${what} -> pull (${ropeId})` });
                records.push({ goal: goal.kind, strategy: 'pull', ...record });
                return { escalations };
            }
            rowFor('pull', refused);
            refused = { rung: 'pull', why: pullWhy };
        }

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
        } else if (fineDeadlineReached('time')) {
            // ⛓ FIDELITY CHECKPOINTS — the `time` site, latched: the search is
            // not run and the ladder falls through to the next rung.
            timeWhy = 'deadline — the caller\'s anytime deadline (`shouldStop`) was reached '
                + 'before the TIME rung\'s search, so it was not run.';
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
                // ⛓ FIDELITY CHECKPOINTS — the `time` site inside the search; with
                // no deadline active the mover is handed nothing to ask.
                shouldStop: fineActive() ? () => deadlineReached('time') : null,
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
                + `[${(run.entities('chasers') ?? []).map((c) => c.id).join(', ') || 'empty'}]. A bait `
                + 'moves a body along its own straight line; a static census body, a '
                + 'hazard volume and an arrow lane do not have one, and a body whose '
                + 'removal changes no corridor is not what is in the way.';
        } else if ((ENEMY_CLASSES[body.tag]?.speed ?? 0) === 0) {
            baitWhy = `${body.id} has \`speed 0\` — it never writes \`v\`, so there is no `
                + 'straight line to bend and nothing to lure. That is a KILL question.';
        } else if (body.kind === 'spinner') {
            // ⛓ Swim U1, D3: a Spinner is a BILLIARD — its `v` is its own reflected
            // diagonal, never a chase toward the player — so there is nothing to lure.
            baitWhy = `${body.id} is a Spinner: a billiard whose \`v\` reflects off walls and `
                + 'never turns toward the player, so there is no line to bend. That is a KILL '
                + 'question, and the kill is the player\'s own press.';
        } else {
            const derived = deriveBaitStance(run, body, contacts);
            /**
             * ⛓⛓ SWIM R5, D1 — **THE BAIT WALK MAY NOT RE-ENTER ITSELF.** The
             * walk to a bait stance is an ordinary `walkTo`, so its corridor is
             * probed and a hit climbs THIS ladder again. When that inner climb
             * lands on the same body, the same stance and the same tick, it is
             * the outer call over again: nothing between the two spent a tick or
             * moved the run, so it walks to the same stance, hits the same
             * danger and climbs again until the JS stack runs out. Measured on
             * L6 (`in_L5_48_112` → `out_stairsup_224_32`, 70 walker ticks in):
             * `walkTo` → `climbLadder` → `walkTo` …, and the page declined with
             * *"Maximum call stack size exceeded"*. The re-entry is the missing
             * progress check, so it is refused BY NAME and the ladder goes on to
             * KILL, as after any other bait refusal.
             */
            const baitKey = derived.stance
                ? `${body.id}@${derived.stance.x},${derived.stance.y}#${perTick.length}` : null;
            const bait = baitKey && baitingBodies.has(baitKey)
                ? { stance: null, why: `${body.id}: the walk to its bait stance `
                    + `(${derived.stance.x},${derived.stance.y}) is itself a corridor that needs `
                    + `${body.id} baited — the ladder re-entered the same bait at tick `
                    + `${perTick.length} with nothing spent between, so a second bait would be `
                    + 'the first one again (BAIT_REENTRY).' }
                : derived;
            if (bait.stance) {
                rowFor('bait', refused, { stance: bait.stance, target: body.id });
                baitingBodies.add(baitKey);
                try {
                    walkTo(goal, bait.stance, {
                        what: `${what} -> bait (${body.id}) stance`,
                    });
                } finally {
                    baitingBodies.delete(baitKey);
                }
                const record = runDwell(run, perTick, {
                    ticks: bait.ticks,
                    why: `${body.id}: ${bait.why}`,
                    until: {
                        why: `${body.id} has left the world — the room's own kill region `
                            + 'removed it',
                        test: (r) => !(r.entities('chasers') ?? []).some((c) => c.id === body.id),
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
             *
             * ⛓⛓ SEEDLING FIDELITY F4 — EXCEPT FOR A CLASS WHOSE DEATH THE RUN
             * NOW COMPUTES (`STATIC_ARROW_DEATH`: `SandTrap`, read off the game
             * on `f4-l8-sandtraps`). The hold is the same hold; its `until`
             * reads the LIVE room, and the run removes the body on the tick the
             * game does (the record edit and `removed()`'s write of the tag), so
             * the hold ends by itself and no declaration is owed. A body the run
             * has already removed is never a target: a staging that boots with
             * its tag cleared builds the room without it.
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
                    open: run.entities('openActivators'),
                    armed: run.entities('armedPulsers') ?? new Set(),
                    trapsArmed: run.entities('armedArrowTraps') ?? new Set(),
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
                                + 'the room was rebuilt without it (⛓ F4: or, for a class '
                                + 'whose arrow death the run computes, that the run removed it '
                                + 'on the tick the game does)',
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
                     * ⛓ F4: a class whose death the run computes did NOT die in
                     * the bound. That is the model's own answer, not a tick the
                     * game owes, so it is a refusal by name.
                     */
                    if (staticDeathComputed(target.row)) {
                        const sb = (run.entities('staticBodies') ?? []).find((b) => b.id === target.id);
                        e.message += ` · ⛓ F4: the run COMPUTES ${target.id}'s arrow death `
                            + `(\`STATIC_ARROW_DEATH.${target.row.as3}\`), and after the whole ${bound}-tick `
                            + `bound it is still standing with ${sb ? `${sb.hits} hit(s)` : 'no arrow landed'}`
                            + ' — so the ceiling does not kill it from this stance, in the model or in the game.';
                        throw e;
                    }
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
        } else if (target && target.kind === 'spinner') {
            /**
             * ⛓⛓⛓ SEEDLING SWIM U1, D3 (F2) — **THE KILL WITHOUT A LOCK.** The
             * kill-lock's `tset: -1` used to supply the observation; the run
             * supplies it itself: the body leaves `run.entities('spinnerBodies')`
             * when `Spinner.removed()` runs, and a body with a persistence tag
             * banks `run.ledger('spinnerWrites')` on the same removal. So the
             * target is killed by the kill-lock's own PRESS arm (`derivePressKill`
             * — the strike schedule, the hammer's 13 px union and the receiver's
             * cadence — and `execKillByPress`, whose loop runs `until` the body
             * has left the roster, bounded), with `lock: null`: no fade, no
             * declaration, the roster is the end.
             *
             * ⛔ NO SWORD IS A REFUSAL BY NAME, the strong grade's shape: the
             * weapon is a SUB-ORDER the macro layer owes.
             */
            const weapon = run.progress('primaryWeapon');
            const [tagPart, xy] = target.id.split('@');
            const [cx, cy] = xy.split(',').map(Number);
            const press = weapon === 'sword'
                ? derivePressKill(run, [{ tag: tagPart, x: cx, y: cy }], contacts)
                : null;
            if (weapon !== 'sword') {
                killWhy = `${target.id} is a live Spinner whose removal the run OBSERVES (the `
                    + '`spinnerBodies` roster, and `spinnerWrites` for a tagged body), but the '
                    + `run's \`primary\` slot ${weapon === null ? 'holds NOTHING' : `fires \`${weapon}\``}`
                    + ' — the kill this rung derives is a SWORD press (`KILL_ARM_POLICY.Spinner`). '
                    + 'The sword is a SUB-ORDER the macro layer owes.';
            } else if (!press.first) {
                killWhy = `${target.id} is a live Spinner, and the press arm refused: `
                    + press.rejected.map((r) => `${r.option}: ${r.why}`).join(' · ');
            } else {
                rowFor('kill', refused, { arm: 'press', target: target.id });
                const writesBefore = (run.ledger('spinnerWrites') ?? []).length;
                let record = null;
                try {
                    record = execKillByPress(run, perTick, {
                        plans: press.plans, first: press.first, bodies: [target.id], lock: null,
                    }, {
                        maxTicksPerTarget, economies, dashMode, goal, walkTo,
                        what: `${what} -> kill (${target.id}) by press`,
                    });
                } catch (e) {
                    /**
                     * ⛔ THE MODEL'S OWN REFUSAL OF AN UNFAITHFUL HIT, SAID AS THE
                     * RUNG'S. `levelRun` refuses a swing whose line to the body's
                     * entity point crosses a Solid (`Player.slash`'s line-of-sight
                     * gate) rather than model the miss; the strike schedule does not
                     * ask that line (the query is the run's closure, not a run
                     * member — a U1 finding). The run is dead at that tick, so this
                     * is terminal: the ladder refuses with the press arm's reason
                     * instead of the solve escaping as a crash.
                     */
                    if (!/line-of-sight gate REFUSES that hit/.test(String(e?.message))) throw e;
                    killWhy = `${target.id} is a live Spinner and the press arm's schedule swung `
                        + 'through a Solid — the run refused the hit by name: '
                        + `${String(e.message).split('\n')[0]}`;
                }
                if (!killWhy) {
                    /**
                     * ⛔ THE CROSS-CHECK: the roster says removed; a TAGGED body must
                     * also have banked its flag in the ledger on that removal. Two
                     * readings of one death that disagree are a model defect, said
                     * here by name.
                     */
                    const tag = (run.world.spinners ?? []).find((p) => p.id === target.id)?.persistTag;
                    const wrote = (run.ledger('spinnerWrites') ?? []).slice(writesBefore)
                        .some((w) => w.id === target.id);
                    if (Number.isInteger(tag) && tag >= 0 && !wrote) {
                        fail(`${what} -> kill (${target.id}): the body left \`spinnerBodies\` but `
                            + `its tag ${tag} banked NO \`spinnerWrites\` row — the roster and the `
                            + 'ledger disagree about one death.');
                    }
                    records.push({ goal: goal.kind, strategy: 'kill', arm: 'press',
                        target: target.id, ledger: wrote ? 'spinnerWrites' : 'roster', ...record });
                    return { escalations };
                }
            }
        } else if (!target) {
            killWhy = 'the danger on this corridor is not a body this run can watch die — '
                + 'a kill needs a target whose removal the model OBSERVES (a live chaser or '
                + 'spinner the run steps; a live body without a recorded removal is not a '
                + 'target), and ⛔ a static "Enemy" body\'s own arrow death is REFUSED by '
                + 'name (§11.4): its clear is the tape\'s DECLARED v9 `at` row, and a second '
                + 'writer of one persistence slot is two cost models. (F4: the classes whose '
                + `death the run computes, [${Object.keys(STATIC_ARROW_DEATH).join(', ')}], are `
                + 'targets of the static arm, not of this one.)';
        } else {
            const kill = deriveKillByCeiling(run, target, contacts);
            if (kill.presser) {
                rowFor('kill', refused, { presser: kill.presser.tag, target: target.id });
                /**
                 * ⛓⛓⛓ SEEDLING FIDELITY F1 D2 — §11.7's law, the FOURTH place it
                 * bites. The static-body arm above takes its shut-before
                 * snapshot before the approach; this arm took it after. The
                 * stance is inside the presser, so the walk arms the ceiling,
                 * and a snapshot taken at hold start sees every trap already
                 * firing. `runHold`'s positive control then refused with
                 * *"every responder in group t=0 [] is ALREADY OPEN before the
                 * hold begins"*, which was true of nothing. ⛓ MEASURED on L5's
                 * open-lock arrival: `armedArrowTraps` is [] before the walk
                 * and all four traps after it.
                 */
                const before = {
                    open: run.entities('openActivators'),
                    armed: run.entities('armedPulsers') ?? new Set(),
                    trapsArmed: run.entities('armedArrowTraps') ?? new Set(),
                };
                walkTo(goal, kill.stance, {
                    what: `${what} -> kill (${target.id}) stance`,
                    contactsOverride: kill.exempt,
                });
                const holdFrom = run.ticksCompleted;
                // The tick the target last took a hit, read off the hold's own
                // per-tick test — the diagnosis below needs it on a refusal.
                let lastHits = (run.entities('chasers') ?? []).find((b) => b.id === target.id)?.hits ?? null;
                let lastHitAt = null;
                let record;
                try {
                    record = STRATEGY_EXECUTORS.hold(run, perTick, {
                        target: { x: kill.presser.x, y: kill.presser.y },
                        hold: {
                            ticks: KILL_BY_CEILING_BOUND,
                            until: {
                                why: `${target.id} has left the world — ${kill.why}`,
                                test: (r) => {
                                    const b = (r.entities('chasers') ?? []).find((c) => c.id === target.id);
                                    if (b && b.hits !== lastHits) { lastHits = b.hits; lastHitAt = r.ticksCompleted; }
                                    return !b;
                                },
                            },
                        },
                    }, {
                        maxTicksPerTarget,
                        what: `${what} -> kill (${target.id})`,
                        before,
                    });
                } catch (e) {
                    /**
                     * ⛓ F1 D2 — WHY THE BOUND RAN OUT, SAID FROM THE RUN. The
                     * lane claim (`deriveKillByCeiling`) is the body's position
                     * when the kill was planned. A chaser walks: on L5's
                     * open-lock arrival `bob@16,80` takes two arrows and ends
                     * at (58.87, 84.14), in column 3 between the lanes
                     * ([34,46) and [66,78)), where no armed lane reaches it.
                     * ⛓ The game agrees, body for body (F1 report § D2). So
                     * the refusal names what the hold measured: where the body
                     * stands, which armed lanes still cover it, and when it
                     * last took a hit.
                     */
                    const c = (run.entities('chasers') ?? []).find((b) => b.id === target.id);
                    if (!c || !/for the whole bound of \d+ tick\(s\) and the condition never became true/
                        .test(String(e?.message))) throw e;
                    const armed = run.entities('armedArrowTraps') ?? new Set();
                    const box = bodyRectOf(c);
                    const lanesNow = (run.world.arrowTraps ?? [])
                        .filter((t) => armed.has(t.id) && rectsOverlapLocal(laneRectOf(run, t), box))
                        .map((t) => t.id);
                    const volleys = (run.ledger('arrowVolleys') ?? [])
                        .filter((v) => v.t > (lastHitAt ?? holdFrom) && armed.has(v.id)).length;
                    e.message += ` ⛓ At the bound ${target.id} is alive at (${c.x.toFixed(2)}, `
                        + `${c.y.toFixed(2)}) with ${c.hits} hit(s), and ${lanesNow.length === 0
                            ? `NO armed lane covers it (it has walked out of [${kill.covering.join(', ')}])`
                            : `it stands in [${lanesNow.join(', ')}]`}. It last took a hit `
                        + `${lastHitAt === null ? `before the hold began (t${holdFrom})` : `at t${lastHitAt}`}, `
                        + `and the armed traps fired ${volleys} volley(s) after that. The lane claim was the body's `
                        + 'position when the kill was planned, and a chaser walks: this body is OUT OF '
                        + 'THE CEILING\'S REACH (BODY_OUT_OF_LANE).';
                    throw e;
                }
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
            /**
             * ⛓⛓ SEEDLING FIDELITY SF3 — **NO SWORD, NO CHASER ARM, AND NO SCAN.**
             * Both of this arm's outcomes without a sword are refusals: no stance
             * (the scan's own words) or a stance and *"this run holds no sword"*
             * below. MEASURED on D's swordless L14 (the l16-budget report §2):
             * the scan was 89 % of a 4.8 s decline that could not have ended in
             * anything else. So the gate `strikePolicyFor` would read after the
             * scan is read before it, and the arm refuses in its words.
             */
            const swordless = !(run.progress('inventory')?.hasSword
                || run.progress('inventory')?.hasGhostSword);
            const hunt = swordless
                ? { stance: null, why: `this run holds no sword, so \`set slashing\`'s `
                    + `outer gate refuses every press — no stance could strike ${hunted.id}, `
                    + 'and the stance scan was not run (SF3)' }
                : deriveKillByChaser(run, hunted, contacts,
                    { aim, allowTeleporter, tolerance, dashMode });
            if (hunt.stance) {
                rowFor('kill', refused, { arm: 'chaser', target: hunted.id,
                    stance: hunt.stance, runnersUp: hunt.runnersUp });
                const strike = strikePolicyFor(run, { dashMode });
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
                            test: (r) => !(r.entities('strikeBodies') ?? [])
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
        /**
         * ── rung 5: DETOUR — a longer corridor the bodies cannot close on ──
         * (SEEDLING FIDELITY L14, `deriveChaserDetour`). Asked ONLY here, after
         * every rung above refused, so no committed climb reaches it. Each
         * candidate is certified exactly as `probeCorridor` certifies a
         * corridor — the same preview, the same strike policy, the same
         * predicate — and the corridor it returns is walked by the caller like
         * AVOID's.
         *
         * ⛔ CONDITIONAL, like DODGE and PULL: it exists only when EVERY reason
         * the probe gave is a `chaser` — a body that comes to the player inside
         * its leash and stops outside it, which is the whole argument for a
         * longer walk. A spinner, an arrow or a static volume is not outrun by
         * walking round it, so in any other climb the rung is ABSENT (no row,
         * the refusal's words unchanged).
         */
        let lastWhy = killWhy;
        let lastOption = 'kill';
        let lastBound;
        if (hit.sources.length > 0 && hit.sources.every((sx) => sx.kind === 'chaser')) {
            const detour = deriveChaserDetour(run, {
                aim, allowTeleporter,
                planOpts: solverPlanOpts(run, contacts, goalPlanExtra),
                certify: (wps) => {
                    // ⛔ `probeSamples` on ONE sample is the probe's own predicate;
                    // the stop only saves the ticks after the first danger.
                    const dangerous = (sm) => probeSamples([sm], dangerExcept) !== null;
                    const walk = previewWalk(run, wps, tolerance, axisAligned
                        ? { strike: null, axisAligned, stopWhen: dangerous }
                        : { strike: strikePolicyFor(run, { dashMode }), stopWhen: dangerous });
                    const hit = probeSamples(walk.samples, dangerExcept);
                    return { hit, hitWp: hit ? walk.samples.at(-1).wp : null,
                        truncated: hit ? null : (walk.truncated ?? null), ticks: walk.samples.length };
                },
            });
            const killRefused = { rung: 'kill', why: killWhy };
            if (detour.wps) {
                rowFor('detour', killRefused, { vias: detour.vias, previews: detour.previews,
                    planned: detour.planned, waypoints: detour.wps.length, ticks: detour.ticks });
                return { wps: detour.wps, escalations };
            }
            // ⛓ ROBUST D1: the failed row carries the search's counts and its
            // bound (`null` = the open set ran dry) as fields.
            rowFor('detour', killRefused, { previews: detour.previews, planned: detour.planned,
                bound: detour.bound ?? null });
            lastWhy = detour.why;
            lastOption = 'detour';
            lastBound = detour.bound ?? null;
        }
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
            + `\n  ${escalations[escalations.length - 1].rung}: ${lastWhy}`, {
            goal,
            obstacle: { kind: 'danger', id: hit.sources[0]?.id ?? null },
            considered: escalations.map((e) => ({
                option: e.rung, why: e.refused?.why ?? 'attempted',
            })).concat([{ option: lastOption, why: lastWhy,
                ...(lastBound !== undefined ? { bound: lastBound } : {}) }]),
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
        /**
         * ⛓⛓ SEEDLING SWIM U2, D1 — AN AXIS-ALIGNED WALK: the plan is the A\*
         * path's corners (`planWaypoints`' `manhattan`), and the preview and
         * the drive hold one axis at a time (`holdOneAxis`) with no sword dash
         * and no opportunistic strike, whose presses and aim keys would add
         * the second axis back. Asked only by a resolution that says
         * `approach: 'axis-aligned'` — `skirt`'s, whose lane admits one x.
         */
        axisAligned: axisAlignedAsked = false,
    }) => {
        /**
         * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — **A SKIRTED LANE IS CROSSED TWICE,
         * SO THE GRID IS KEPT BETWEEN THE CROSSINGS.** The lane admits one x
         * exactly (L29: 126.000), `execSkirt` aligns by an x-only search, and an
         * x-only sequence cannot change x's fraction off the walk's 0.05 grid
         * (swim U2). U2 kept the OUTBOUND approach axis-aligned; but every walk
         * after the pass — to the key and back — was free to go diagonal, so the
         * RETURN stance was reached at x = 125.34132982111198 and no sequence of
         * any depth aligned from there (measured, survey step 57). So while this
         * run has skirted in the level it is in AND a remaining goal aims back
         * across the lane (`skirtGridKept`), every walk is axis-aligned too
         * (re-asked per attempt below). No other walk is touched.
         */
        let axisAligned = axisAlignedAsked;
        for (let attempt = 0; ; attempt += 1) {
            // ⛓ FIDELITY CHECKPOINTS — the `walk` site, before each attempt plans.
            if (fineDeadlineReached('walk')) refuseWalkDeadline(`before ${what}'s corridor (attempt ${attempt + 1})`);
            // Re-asked per attempt: a skirt applied by THIS walk's own ladder
            // turns the rest of it axis-aligned.
            axisAligned = axisAlignedAsked
                || skirtGridKept(run, goals.slice(Math.max(0, goals.indexOf(goal))));
            const contacts = contactsOverride
                ? new Set([...senseContacts(run), ...contactsOverride, ...goalRides])
                : new Set([...senseContacts(run), ...exemptions, ...goalRides]);
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
            let fine = false;
            try {
                wps = planWaypoints(run.world, run.state, aim, allowTeleporter,
                    axisAligned
                        ? { ...solverPlanOpts(run, contacts, goalPlanExtra), manhattan: true }
                        : solverPlanOpts(run, contacts, goalPlanExtra));
            } catch (e) {
                if (!(e instanceof BotDriverV2Error)) throw e;
                /**
                 * ⛓⛓ FRONTIER3 — A FRONTIER WITH NO VERB GETS ONE FINER ASK.
                 * `identifyAndSelect` refuses when no obstacle on the frontier
                 * has a strategy that applies. Before that refusal stands, the
                 * same plan is asked on the 8 px lattice (`FINE_LATTICE`): a
                 * corridor the tile lattice has no node in can still be one the
                 * player fits (L62's pit maze around `planttorch@120,152`). A
                 * plan that solved before never reaches this branch.
                 */
                let identified = null;
                try {
                    identified = identifyAndSelect(goal, aim, contacts, e, allowTeleporter);
                } catch (refusal) {
                    if (!fineLattice || !(refusal instanceof SolverRefusal) || axisAligned
                        || (solverPlanOpts(run, contacts).lattice ?? DEFAULT_LATTICE) <= FINE_LATTICE) {
                        throw refusal;
                    }
                    try {
                        wps = planWaypoints(run.world, run.state, aim, allowTeleporter,
                            solverPlanOpts(run, contacts, { ...goalPlanExtra, lattice: FINE_LATTICE }));
                    } catch (fineError) {
                        if (!(fineError instanceof BotDriverV2Error)) throw fineError;
                        throw refusal;
                    }
                    fine = true;
                    fineLatticeWalks.push({ tick: perTick.length, what, aim: { x: aim.x, y: aim.y },
                        waypoints: wps.length, refused: String(refusal.message).slice(0, 200) });
                }
                let plan = null;
                if (identified) {
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
                    plan = identified.resolved.prerequisite
                        ? prerequisiteOrder(goal, aim, identified, contacts, allowTeleporter, what)
                        : identified;
                    /**
                     * ⛓⛓⛓ SEEDLING FIDELITY STANCE — **A STANCE WALK MAY NOT
                     * RE-ENTER ITS OWN ORDER.** This walk may itself be the walk to
                     * `plan`'s stance (below), and nothing between that call and
                     * this plan spent a tick or changed the world. Applying the
                     * same verb to the same obstacle again would walk to the same
                     * stance and come back here, until `MAX_STRATEGIES_PER_GOAL`
                     * ran out: the survey's *"chest stance -> chest stance -> …"*.
                     *
                     * Measured on L48 (`chest@152,184`) and L46 (`chest@424,40`):
                     * the chest sits on a HALF tile, so its stance (160,202) is in
                     * a 16 px A\* tile whose centre the chest's own box covers, and
                     * the planner refuses the goal tile. The 8 px lattice plans it
                     * (`FINE_LATTICE`, the FRONTIER3 grant). So the re-entry asks
                     * that lattice for this aim first, and only then refuses by
                     * name. A walk that does not re-enter never reaches this.
                     */
                    const stanceKey = `${plan.strategy}(${plan.obstacle.id})#${perTick.length}`;
                    /**
                     * ⚠ AND ONE LEVEL EARLIER: an order whose stance IS this walk's
                     * aim, asked with the same plan inputs (no exemption of its own,
                     * no axis-aligned approach, none here either, no teleporter), is
                     * this walk again — its inner plan fails exactly as this one did.
                     * A `collect-placement` chest goal walks to the chest's own
                     * stance, so without this the goal, the order and the re-entry
                     * each ran `runChest` (L48: three records, one opening).
                     */
                    const sameWalk = Boolean(plan.resolved.stance)
                        && plan.resolved.stance.x === aim.x && plan.resolved.stance.y === aim.y
                        && !plan.resolved.exempt && !contactsOverride && allowTeleporter === null
                        && plan.resolved.approach !== 'axis-aligned' && !axisAligned;
                    if (stanceWalks.has(stanceKey) || sameWalk) {
                        let fineWps = null;
                        if (fineLattice && !axisAligned
                            && (solverPlanOpts(run, contacts).lattice ?? DEFAULT_LATTICE) > FINE_LATTICE) {
                            /**
                             * ⚠ AXIS-ALIGNED, and L48 measured why: a half-tile
                             * chest's centre column (x 160) is on no 8 px node
                             * (x ≡ 4 mod 8), so the last leg is diagonal, and a
                             * diagonal bang-bang approach to (160,202) cycles at
                             * ±1.5 px for the whole budget (vector friction shares
                             * one quantum between the axes). One axis at a time
                             * (`manhattan` corners, `holdOneAxis`) settles, as every
                             * committed chest approach does.
                             */
                            try {
                                fineWps = planWaypoints(run.world, run.state, aim, allowTeleporter,
                                    solverPlanOpts(run, contacts,
                                        { ...goalPlanExtra, lattice: FINE_LATTICE, manhattan: true }));
                            } catch (fineError) {
                                if (!(fineError instanceof BotDriverV2Error)) throw fineError;
                            }
                        }
                        if (!fineWps) {
                            refuse(`${what}: STANCE_REENTRY — the walk to ${plan.obstacle.id}'s `
                                + `\`${plan.strategy}\` stance (${aim.x},${aim.y}) is itself blocked by `
                                + `${plan.obstacle.id} at tick ${perTick.length}, with nothing spent `
                                + 'between, and the 8 px lattice plans no corridor to it either. '
                                + `Applying \`${plan.strategy}\` again would be the same walk again: the `
                                + 'stance is on the far side of the obstacle it is the stance of.',
                            { goal, obstacle: plan.obstacle });
                        }
                        wps = fineWps;
                        fine = true;
                        axisAligned = true;
                        fineLatticeWalks.push({ tick: perTick.length, what, aim: { x: aim.x, y: aim.y },
                            waypoints: wps.length, refused: `STANCE_REENTRY ${stanceKey}` });
                    }
                }
                if (plan && !fine) {
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
                            // ⛓ R9 slice L15 — only when the route has more than one order.
                            ...(plan.resolved.route?.length > 1
                                ? { route: plan.resolved.route.length } : {}),
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
                        open: run.entities('openActivators'),
                        armed: run.entities('armedPulsers') ?? new Set(),
                        trapsArmed: run.entities('armedArrowTraps') ?? new Set(),
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
                        chests: run.entities('openChests'),
                    };
                    // The stance first — planned with whatever exemptions the
                    // strategy's own resolution earned (trap 147: a hold is what
                    // ADDS its presser to the exemptions, so the stance and the
                    // exemption are one decision).
                    if (plan.resolved.stance) {
                        // ⛓ STANCE: the walk is registered so its own frontier can
                        // see a re-entry (`STANCE_REENTRY`, above).
                        const walking = `${plan.strategy}(${plan.obstacle.id})#${perTick.length}`;
                        stanceWalks.add(walking);
                        try {
                            walkTo(goal, plan.resolved.stance, {
                                what: `${what} -> ${plan.strategy} stance `
                                    + `(${plan.obstacle.id})`,
                                contactsOverride: plan.resolved.exempt,
                                axisAligned: plan.resolved.approach === 'axis-aligned',
                            });
                        } finally {
                            stanceWalks.delete(walking);
                        }
                    }
                    const record = STRATEGY_EXECUTORS[plan.strategy](run, perTick, plan.resolved, {
                        maxTicksPerTarget,
                        economies,
                        dashMode,
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
                        // ⛓ Seedling fidelity BURN — a verb may select a slot
                        // (`burn` selects the Fire's and then the old one again).
                        equip,
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
            // ⛓ FIDELITY CHECKPOINTS — the `walk` site between the plan and its probe.
            if (fineDeadlineReached('walk')) refuseWalkDeadline(`after ${what}'s corridor was planned (attempt ${attempt + 1})`);
            const hit = probeCorridor(wps, except, { axisAligned, walkCheck: true });
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
                    dangerExcept: except, corridor: wps, axisAligned,
                    ...(fine ? { lattice: FINE_LATTICE } : {}),
                });
                if (climbed.wps) { wps = climbed.wps; } else { continue; }
            }
            /**
             * ⛓⛓⛓ R9 SLICE 12c′, ⚖ RULING 35 — **THE PLANNER IS ASKED ONCE
             * PER CORRIDOR, ABOVE THE ONE POLICY THE WHOLE WALK SHARES.**
             *
             * ⛔ AT `dashMode === 'none'` IT IS NOT ASKED AT ALL, so no
             * committed corridor can reach a plan and the mode is one line.
             * ⛓ R9 slice 12i: NOT asked with an empty candidate set — an
             * empty scan reports start ticks it never previewed, which reads
             * like a planner that found nothing rather than one nobody
             * consulted. `dash` stays `null` and the walk row carries no
             * `swordDash` key at all, exactly as it did before ⚖ 41's flip.
             * When it is asked, its candidates are certified through
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
            const dash = (dashMode === 'none' || axisAligned)
                ? null
                : planSwordDash(run, wps, { tolerance, dashMode,
                    certify: (samples) => probeSamples(samples, except) });
            seeRow({
                tick: perTick.length,
                saw: saw(),
                goal: { kind: goal.kind, aim: { x: aim.x, y: aim.y } },
                strategy: {
                    verb: 'walk',
                    waypoints: wps.length,
                    // ⛓ FRONTIER3 — present only on a fine-lattice walk.
                    ...(fine ? { lattice: FINE_LATTICE } : {}),
                    /**
                     * ⛓⛓ R9 SLICE 12i — **THE MODE IS ON THE ROW, AND ONLY
                     * WHEN IT IS NOT THE ROSTER'S.** A trace that did not say
                     * which mode planned it would be a walk nobody can
                     * attribute; a trace that said `all` on every committed
                     * sidecar would move seven `--check` md5s for a word every
                     * one of them already implies. So the two keys are ABSENT
                     * at `DEFAULT_DASH_MODE` — the same shape ⚖ 47's
                     * `earlyWalk` key uses (§40.3), and for the same reason.
                     * At `none` there is no `dash` object at all.
                     */
                    ...(dash ? { swordDash: { planned: Boolean(dash.plan),
                        ticks: dash.ticks, baseline: dash.baseline, saved: dash.saved,
                        windows: dash.windows ?? null, legs: dash.legs ?? null,
                        scanned: dash.scanned, why: dash.why,
                        ...(dashMode === DEFAULT_DASH_MODE
                            ? {}
                            : { mode: dash.mode, prefixes: dash.prefixes }) } } : {}),
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
            const strike = axisAligned
                ? null
                : strikePolicyFor(run, { dashPlan: dash?.plan ?? null, dashMode });
            // ⛓ D3: the walk's dash record — see `dashWalks`. `pressed` is filled
            // as the walk's ticks run, so a refuted attempt keeps what it pressed.
            const dashWalk = dash ? {
                tick: perTick.length,
                what,
                attempt,
                planned: Boolean(dash.plan),
                windows: dash.plan ? (dash.windows ?? []).length : 0,
                ticks: dash.ticks ?? null,
                saved: dash.saved ?? null,
                why: dash.why ?? null,
                pressed: 0,
            } : null;
            const pressedAtWalk = dashesPressed;
            if (dashWalk) dashWalks.push(dashWalk);
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
                        axisAligned,
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
            } finally {
                if (dashWalk) dashWalk.pressed = dashesPressed - pressedAtWalk;
            }
        }
    };

    /**
     * ⛓⛓⛓ U12-swim D2 — THE PULLS THAT ARE A RIDE INTO PIT (tx, ty): every
     * current that drains into it (`pull.pullsDrainingInto`) AND that the model
     * steps for a walking player (`pull.pullModelled`), as contact keys. L12's
     * fourteen all qualify for (36,43): every push points the way the walk is
     * going. A pull that is not modelled stays a volume — and the frontier
     * names it (`identifyAndSelect`).
     */
    const pitRides = (tx, ty) => new Set(
        pullsDrainingInto(run.entities('pulls'), { tx, ty })
            .filter((p) => pullModelled(p, run.world).modelled)
            .map((p) => `proximity-hazard:${p.id}`));

    /**
     * ⛓⛓⛓ SEEDLING FIDELITY STEP-OFF, D3 — **A DOOR THE RUN STANDS LATCHED ON
     * IS CROSSED BY STEPPING OFF IT FIRST.** `Teleporter.check()` latches
     * `playerTouching` on a new `Game`'s first frame when the arrival box
     * overlaps the door, and `update()` clears it only on an update the box is
     * OFF the rect (`fidelityStepOff.js`, measured on the game: 0.05 px off is
     * enough, and the next overlap fires). The model carries the latch
     * (`run.state.latched`), so a walk aimed at the centre of the door the run
     * already stands on is a zero-length walk that never crosses — the old
     * 400-tick stall. So: walk to the nearest STANDABLE cell ringing the door
     * (`stepOffCellFor`), then the ordinary crossing walk back. A door no
     * standable, routable cell rings refuses as `closed`, by name.
     *
     * Returns the step-off's record, or null when the door is not latched.
     */
    let brokeForStepOff = false;
    const stepOffIfLatched = (goal, index, teleporter, whatExit) => {
        if (run.state.latched?.has?.(index) !== true) return null;
        const id = `${teleporter.isStairs ? 'stairs' : 'teleporter'}@${teleporter.x},${teleporter.y}`;
        const contacts = new Set([...senseContacts(run), ...exemptions, ...goalRides]);
        /**
         * ⛓⛓⛓ STEPOFF2, D1 — the MINIMAL step-off first: one direction held
         * until the box clears the rect (`stepOffMinimalFor`), the cheapest
         * whose transit the danger probe clears (`previewWalk` stopped on the
         * same "off" test, then `probeSamples`, the solve's own predicate).
         * The drive holds exactly the preview's keys for exactly its ticks, and
         * a run that does not end off the rect, or crosses, or falls, fails by
         * name. The walk back (below, the caller's `walkTo`) is the crossing;
         * its first tick is the door's update that releases the latch.
         */
        const r = teleporter.rect;
        const offRect = (x, y) => !rectsOverlap(playerBoxAt(x, y), r);
        const candidates = stepOffMinimalFor(run, index, tolerance);
        const rejected = [];
        let chosen = null;
        for (const c of candidates) {
            if (c.rejected) { rejected.push({ option: `step-off ${c.dir}`, why: c.rejected }); continue; }
            const walk = previewWalk(run, [c.aim], tolerance,
                { strike: null, stopWhen: (sm) => offRect(sm.x, sm.y) });
            const hit = probeSamples(walk.samples);
            if (hit) {
                rejected.push({ option: `step-off ${c.dir}`, why: `danger at (${hit.x},${hit.y}): `
                    + (hit.sources ?? []).map((s) => `${s.kind}:${s.id ?? '?'}`).join(', ') });
                continue;
            }
            chosen = c;
            break;
        }
        if (chosen) {
            const at = perTick.length;
            seeRow({
                tick: at,
                saw: saw(),
                goal: { kind: goal.kind, exit: { x: goal.exit.x, y: goal.exit.y } },
                obstacle: { kind: 'latched-door', id },
                strategy: { verb: 'step-off', dir: chosen.dir, ticks: chosen.ticks,
                    to: { x: chosen.at.x, y: chosen.at.y } },
                rejected,
                keys: [],
            });
            for (let k = 0; k < chosen.ticks; k += 1) {
                const held = chooseHeld(run.state, chosen.aim, tolerance);
                perTick.push(held);
                const { transition } = run.advance(held);
                if (transition || run.state.fall) {
                    refuse(`${whatExit}: the ${chosen.dir} step-off off ${id} ${transition
                        ? `crossed to level ${transition.to_level}` : 'started a fall'} at tick `
                        + `${k + 1} — the preview said it would not (a model/preview disagreement).`, {
                        goal, obstacle: { kind: 'latched-door', id },
                    });
                }
            }
            if (!offRect(run.state.x, run.state.y)) {
                refuse(`${whatExit}: the ${chosen.dir} step-off held ${chosen.ticks} tick(s) and the box `
                    + `is still on ${id} at (${run.state.x},${run.state.y}) — the preview said `
                    + `(${chosen.at.x},${chosen.at.y}) (a model/preview disagreement).`, {
                    goal, obstacle: { kind: 'latched-door', id },
                });
            }
            return { door: id, dir: chosen.dir, to: { x: run.state.x, y: run.state.y }, from: at,
                ticks: perTick.length - at };
        }
        const cell = stepOffCellFor(run, index, solverPlanOpts(run, contacts, goalPlanExtra));
        if (cell === null && !brokeForStepOff) {
            /**
             * ⛓⛓⛓ STEPOFF2, D3 — **A ROCK IN THE RING IS A STEP-OFF CELL THE
             * RUN CAN MAKE.** L3's pocket from L11: `breakablerock@96,112`
             * walls the door's only way off. With a sword the rock breaks from
             * the door itself (a swing from the arrival reaches it — the
             * committed `r9-solve-3` breaks it from there), and the step-off is
             * asked again of the world the break changed. Only a rock whose
             * box touches the ring, only from the live position (the run is
             * latched: there is nowhere else to stand), and only when the run
             * CAN break it — without a weapon `resolveBreakStrategy`'s own
             * refusal joins the `closed` words and nothing is pressed.
             */
            const ring = { x: r.x - TILE_SIZE, y: r.y - TILE_SIZE,
                right: r.right + TILE_SIZE, bottom: r.bottom + TILE_SIZE };
            const broken = run.entities('brokenRocks') ?? new Set();
            const rocks = (run.world.solids ?? [])
                .filter((so) => so.rockId && !broken.has(so.rockId) && rectsOverlap(so.rect, ring))
                .sort((a, b) => distanceRectPoint(run.state.x, run.state.y, a.rect)
                    - distanceRectPoint(run.state.x, run.state.y, b.rect) || (a.rockId < b.rockId ? -1 : 1));
            for (const rock of rocks) {
                const resolved = resolveBreakStrategy(run, { id: rock.rockId }, contacts);
                if (!resolved) continue;
                if (resolved.held === false) { rejected.push(...resolved.rejected); continue; }
                if (!swingReaches(run.state, rock)) {
                    rejected.push({ option: `break ${rock.rockId}`, why: 'a swing from the door does '
                        + `not reach it (SLASH_REACH ${SLASH_REACH} px), and the latched run has no `
                        + 'other cell to swing from' });
                    continue;
                }
                seeRow({
                    tick: perTick.length,
                    saw: saw(),
                    goal: { kind: goal.kind, exit: { x: goal.exit.x, y: goal.exit.y } },
                    obstacle: { kind: 'latched-door', id },
                    strategy: { verb: 'break', postCondition: 'gone', for: 'step-off' },
                    rejected: [...rejected],
                    keys: [],
                });
                const rec = STRATEGY_EXECUTORS.break(run, perTick, { ...resolved, stance: null },
                    { what: `${whatExit} -> break ${rock.rockId} (step-off)` });
                records.push({ goal: goal.kind, strategy: 'break', ...rec });
                brokeForStepOff = true;
                return stepOffIfLatched(goal, index, teleporter, whatExit);
            }
        }
        if (cell === null) {
            /**
             * ⛓ STEPOFF2, D2 — A DOOR WHOSE ONLY WAY OFF IS HAZARD FLOOR IS NOT
             * `closed`. When some direction's box clears the rect only across
             * water (no conch) or lava (no dark suit), the door opens with that
             * item: `hazard-floor`, by name, with every direction's reason, so
             * CANCROSS's caller can read the item the crossing needs.
             */
            const floors = [...new Set(candidates.filter((c) => c.hazard).map((c) => c.hazard))].sort();
            if (floors.length > 0) {
                const need = floors.map((f) => (f === 'water' ? 'water without the conch'
                    : 'lava without the dark suit')).join('; ');
                // ⚠ The `closed — …` clause stays word for word: it is still true
                // without the item, and the JS arc's rows quote it (they re-pin to
                // `obstacle.kind`, which is the new name).
                refuse(`${whatExit}: hazard-floor — every way off ${id}'s rect crosses `
                    + `${floors.join(' or ')} the run cannot stand on (${need}); without that, closed — `
                    + `the run stands LATCHED on ${id} in level ${run.level} and no standable cell next to `
                    + 'it can be walked to. The door fires only after one update with the box off its '
                    + `rect. Directions: ${rejected.map((c) => `${c.option}: ${c.why}`).join('; ')}.`, {
                    goal, obstacle: { kind: 'hazard-floor', id, floors }, considered: rejected,
                });
            }
            /**
             * ⛓ STEPOFF2, D2 — AND A RUN THAT STANDS INSIDE A SOLID IS NOT IN A
             * POCKET. A door under a lock (L66's `bosslock@72,64`, L24's pair)
             * boots the box inside the lock's solid, and every direction stalls
             * where it started. The name is the solid, so the opener is the
             * work order.
             */
            const box = playerBoxAt(run.state.x, run.state.y);
            const inside = (run.world.solids ?? []).filter((so) => so.rect && rectsOverlap(so.rect, box))
                .map((so) => so.rockId ?? so.id ?? `${so.tag ?? so.cls?.as3 ?? 'solid'}@${so.x ?? so.rect.x},`
                    + `${so.y ?? so.rect.y}`);
            if (inside.length > 0) {
                refuse(`${whatExit}: inside-solid — the run stands LATCHED on ${id} in level ${run.level} `
                    + `with its box INSIDE ${inside.join(', ')}: no direction moves it (every step-off stalls `
                    + 'where it started), so the door cannot be stepped off until that solid is gone.', {
                    goal, obstacle: { kind: 'inside-solid', id, solids: inside }, considered: rejected,
                });
            }
            refuse(`${whatExit}: closed — the run stands LATCHED on ${id} in level ${run.level} `
                + '(`Teleporter.check()` latched it on the arrival frame) and no standable cell '
                + 'next to it can be walked to. The door fires only on an update the player box '
                + 'is off its rect and the next one it is back on, so a crossing needs the player '
                + 'to step off it and back on.'
                + (rejected.length ? ` Considered: ${rejected.map((c) => `${c.option} — `
                    + `${c.why.split(' — ')[0].slice(0, 120)}`).join('; ')}.` : ''), {
                goal, obstacle: { kind: 'closed', id }, considered: rejected,
            });
        }
        const at = perTick.length;
        seeRow({
            tick: at,
            saw: saw(),
            goal: { kind: goal.kind, exit: { x: goal.exit.x, y: goal.exit.y } },
            obstacle: { kind: 'latched-door', id },
            strategy: { verb: 'step-off', to: { x: cell.x, y: cell.y } },
            rejected: [],
            keys: [],
        });
        walkTo(goal, cell, { allowTeleporter: index, what: `${whatExit} step-off to (${cell.x},${cell.y})` });
        return { door: id, to: { x: cell.x, y: cell.y }, from: at, ticks: perTick.length - at };
    };

    /**
     * ⛓⛓⛓ SEEDLING FIDELITY SLOTS — THE SWORD'S SLOT, SELECTED BEFORE ANY
     * PRESS THE WALKS WILL MAKE.
     *
     * Every strike and dash the walks press (`strikePolicyFor`) is a SWORD
     * press: the policy reads the inventory's sword, and presses `primary`.
     * `useItem(Main.primary)` reads the SLOT, so a segment that begins with
     * Fire's slot selected would fire on every one of those presses. Two ways
     * in, both measured: a slot array in arrival order (Fire received before
     * the sword is `[1, 0]`, so slot 0 is Fire from the boot), and a cut
     * inside `execBurn` (a continuation frozen after the Fire's equip and
     * before the restore). Either way the sword's slot, read off the run's
     * OWN array, is selected at the segment's first tick. A run holding Fire
     * and no sword keeps Fire (it has no strike, and its burns need it); any
     * other selection (the R4 spear, the wand) is left as staged.
     *
     * ⛔ ONE IDLE TICK FIRST WHEN THE SWORD ARRIVED ON THIS OBSERVATION. A
     * grant writes the flag at the top of its tick and the frame's tail
     * appends the slot, and `Bot.as` checks an equip at the top of the tick
     * (`drainEquipChecks`): selecting the sword's future slot now DISARMS the
     * bot (measured: "selected slot 1 but the inventory holds 1 item(s)").
     * The Fire collect below waits its tick for the same reason.
     */
    if (run.progress('primaryWeapon') === 'fire') {
        const isSword = (id) => id === INVENTORY_ITEM_IDS.sword || id === INVENTORY_ITEM_IDS.ghostsword;
        const inv = run.progress('inventory') ?? {};
        if ((inv.hasSword || inv.hasGhostSword) && !run.progress('inventorySlots').some(isSword)) {
            const NO_KEYS = new Set();
            perTick.push(NO_KEYS);
            const { transition } = run.advance(NO_KEYS);
            if (transition) {
                refuse(`the idle tick that lets the sword's slot arrive crossed to level ${transition.to_level}.`);
            }
        }
        const swordSlot = run.progress('inventorySlots').findIndex(isSword);
        if (swordSlot >= 0) equip(swordSlot);
    }

    /**
     * ⛓⛓ STEPOFF2, D1 — **THE WAY BACK FROM A MINIMAL STEP-OFF IS STRAIGHT
     * BACK.** The player stands a fraction of a pixel off the rect, still
     * moving away; the corridor back is the one the step-off just previewed.
     * The planner is not asked: its A\* start node is the TILE under a
     * sub-pixel position, which beside a door is often a wall's or the door's
     * own (measured: L83's cliffside, L74's frontier). So the walk back is
     * `chooseHeld` toward the door's centre, previewed first (`previewWalk`,
     * the danger probe on its samples) and accepted only when the preview
     * CROSSES within `STEP_OFF_MAX_TICKS`; then driven tick for tick, and the
     * crossing must be this door's (level and arrival). Null hands the walk
     * back to the ordinary `walkTo`.
     */
    const returnOntoDoor = (goal, index, teleporter, centre, whatExit) => {
        const walk = previewWalk(run, [centre], tolerance, { strike: null });
        if (walk.truncated?.kind !== 'crossed' || walk.samples.length > STEP_OFF_MAX_TICKS) return null;
        if (probeSamples(walk.samples)) return null;
        seeRow({
            tick: perTick.length,
            saw: saw(),
            goal: { kind: goal.kind, aim: { x: centre.x, y: centre.y } },
            strategy: { verb: 'walk', waypoints: 1, back: true },
            path: [{ x: centre.x, y: centre.y }],
            rejected: [],
            keys: [],
        });
        for (let k = 0; k <= STEP_OFF_MAX_TICKS; k += 1) {
            const held = run.state.fall ? new Set() : chooseHeld(run.state, centre, tolerance);
            perTick.push(held);
            const { transition } = run.advance(held);
            if (!transition) continue;
            if (transition.to_level !== teleporter.to || run.state.x !== teleporter.arrival.x
                || run.state.y !== teleporter.arrival.y) {
                refuse(`${whatExit}: the walk back onto the door crossed to level ${transition.to_level} `
                    + `at (${run.state.x},${run.state.y}), not this door's arrival (level ${teleporter.to} `
                    + `at (${teleporter.arrival.x},${teleporter.arrival.y})).`, {
                    goal, obstacle: { kind: 'latched-door', id: `teleporter@${teleporter.x},${teleporter.y}` },
                });
            }
            return transition;
        }
        refuse(`${whatExit}: the walk back onto the door did not cross within ${STEP_OFF_MAX_TICKS} `
            + 'ticks — the preview said it would (a model/preview disagreement).', { goal });
        return null;
    };

    /**
     * ⛓⛓⛓ SEEDLING FIDELITY ARRIVAL, D3 — **AN ARRIVAL INSIDE A SOLID IS
     * REFUSED BY NAME, BEFORE ANY SEARCH, WITH THE WAY OUT.**
     *
     * ⚖ The user (2026-10-05): *"Arrival inside a solid should only happen if
     * we play the game out of order. The proper fix for this might be to
     * restart using the menu, or just take a different path."* A landing ON a
     * breakable rock, a burnable tree, a lock or the final door's cell
     * (L12 -> L0 at (288,176) on `breakablerock@288,176`) is inside it exactly
     * when the save's flag still holds — the obstacle was never broken from
     * its own room's side — and `Entity.moveBy` then takes no step in any
     * direction (measured on the game: `probe-seedling-arrival-solid.mjs`,
     * 0 px in each hold; the model's stream is the game's). The build already
     * reads the save (`PERSISTENCE_RESPONSE`: a cleared flag builds no solid),
     * so this state is KNOWN, not guessed, and with the flag cleared the same
     * arrival solves as before.
     *
     * ⛔ NOTHING IS PRESSED FROM INSIDE. The game WOULD break a rock from
     * inside on a sword press (measured), but the ruling is a refusal with the
     * way out, not a strategy: the Menu's Restart (`seedlingStartSpawn`) or
     * another route into the level (every door that lands here on a box
     * outside any solid, named). A box that merely grazes a solid and can walk
     * out is not this state (`arrivalInsideSolid` asks every cardinal hold).
     *
     * ⛓ STEPOFF2's `inside-solid` (a boot ON a door under a lock) is the same
     * fact met later, inside `stepOffIfLatched`: it now refuses here first, and
     * its words ride along word for word (`Latched: inside-solid — …`).
     */
    const insideSolid = arrivalInsideSolid(run);
    if (insideSolid !== null) {
        const ids = insideSolid.solids.map((so) => so.id);
        const others = arrivalsInto(run, run.level)
            .filter((a) => (a.at.x !== run.state.x || a.at.y !== run.state.y)
                && solidsAt(run.world, a.at.x, a.at.y).length === 0);
        const latchedOn = [...(run.state.latched ?? [])].map((i) => run.world.teleporters[i])
            .filter(Boolean).map((tp) => `${tp.isStairs ? 'stairs' : 'teleporter'}@${tp.x},${tp.y}`);
        const flagWords = insideSolid.solids.map((so) => (so.flag
            ? `${so.id}: persistence {level ${so.flag.level}, tag ${so.flag.tag}} still holds — it is cleared `
                + `when the obstacle is ${so.action ?? 'removed'}${so.item ? ` (${so.item})` : ''}`
            : `${so.id}: its world row carries no persistence tag`)).join('; ');
        const wayOut = [
            { kind: 'restart', via: 'seedlingStartSpawn',
                why: 'the Menu\'s Restart warps the player to a new game\'s start (the rules arc\'s Restart edge)' },
            { kind: 'another-route', level: run.level, arrivals: others },
        ];
        refuse(`${name}: arrival-inside-solid — the run's box at (${run.state.x},${run.state.y}) in level `
            + `${run.level} is INSIDE ${ids.join(', ')} and no cardinal hold moves it (the game's `
            + '`Entity.moveBy` stops at the first collide). The save says the obstacle is still there '
            + `(${flagWords}): an arrival here means the game was played out of order. The solver does `
            + 'not act from inside a solid. Way out: Restart from the Menu (`seedlingStartSpawn`), or '
            + `another route into level ${run.level}`
            + (others.length ? ` (${others.map((a) => `L${a.from} ${a.door} -> (${a.at.x},${a.at.y})`)
                .join(', ')})` : ' (no other door lands in this level outside a solid)') + '.'
            + (latchedOn.length ? ` Latched: inside-solid — the run stands LATCHED on ${latchedOn[0]} in level `
                + `${run.level} with its box INSIDE ${ids.join(', ')}: no direction moves it (every step-off `
                + 'stalls where it started), so the door cannot be stepped off until that solid is gone.' : ''), {
            goal: goals[0],
            obstacle: {
                kind: 'arrival-inside-solid', id: ids[0], solids: ids,
                flags: insideSolid.solids.filter((so) => so.flag).map((so) => ({ solid: so.id, ...so.flag,
                    action: so.action, item: so.item })),
                at: { level: run.level, x: run.state.x, y: run.state.y },
                ...(latchedOn.length ? { latchedOn: latchedOn[0] } : {}),
                wayOut,
            },
            considered: Object.entries(insideSolid.moved).map(([dir, px]) => ({ option: `hold ${dir}`,
                why: `moves ${px} px in ${STUCK_TICKS} ticks` })),
        });
    }

    /**
     * ⛓⛓⛓ SEEDLING FIDELITY CLEARTAG — **THE `clear-tag` EXECUTOR: A SAVED
     * OBSTACLE BROKEN FROM ITS OPEN SIDE, FINISHED ON THE RUN'S LEDGER.**
     *
     * ⚖ The user (2026-10-05): *"break before first use"*. A door whose landing
     * is inside a persistence-decided solid needs that solid's flag cleared first
     * (the rules arc's event; ARRIVAL's `arrival-inside-solid` refusal is the
     * backstop). This goal is the order to clear it ON PURPOSE, from the side the
     * player can stand on — never from inside.
     *
     * ⛔ NO NEW VERB. The obstacle is named the way the frontier names it
     * (`solid:<class>`, id `<class>@<x>,<y>`), the verb is `OBSTACLE_STRATEGIES`'s
     * row (refined as the frontier refines it), the stance is the RESOLVER's own
     * (which already asks "reachable from here"), and the act is the REGISTERED
     * executor — `break`, `burn`, `touch`, `keylock`, `hold`, `pulse` … exactly
     * as a frontier order runs it. What is new is only the ORDER and the FINISH:
     *   · finished when the GAME's write has happened: `run.ledger('earnedClears')`
     *     holds `{level, tag}` AND the family's write has landed in the run
     *     (`clearTagLanded`). ⛔ The ledger row alone is not the write — it is
     *     the model's PERMISSION for the next build and is stamped earlier: a
     *     rock's at the hit (`endAnim` writes at `goneAt`), a tree's at the press
     *     (`removed()` writes at `goneAt`). Measured on the game (p4f, held cuts,
     *     `probe-seedling-cleartag.mjs --scan`): `persistence_cleared` first holds
     *     the flag after `T + 1` ticks, T = rock `goneAt` 50 (row t43), tree
     *     `goneAt` 105 (row t64), lock snap close 164 — and a solve that ended on
     *     the row (the lock's, 164 t) ended one tick BEFORE the game's write;
     *   · met before it was asked (`cleared-in-passing`) when the ledger already
     *     names it — also when the walk to the stance struck it (the walk's own
     *     strike policy) — and `already-clear` when the live world holds no such
     *     solid and the ledger is silent: the BUILD left it out, which is the
     *     game's own reading of a flag the boot's persistence holds cleared
     *     (`check()`). Either state is known by name and neither is walked at;
     *     a row whose write tick is still ahead is waited out (nothing held).
     *
     * Every refusal is `obstacle.kind: 'clear-tag'` with `flag`, `id` and a
     * `reason` — `wrong-level`, `no-verb` (no row, or a row with no registered
     * executor: the wand), `cannot-act` (the resolver's `held: false`, e.g. no
     * sword), `unresolved` (the resolver could not bind, or no REACHABLE
     * stance), `prerequisite`, `not-written` (the verb ran and the flag did not
     * land within `CLEAR_TAG_WRITE_TICKS`).
     */
    const execClearTag = (goal) => {
        const flag = { level: goal.tag.level, tag: goal.tag.tag };
        const parsed = goal.obstacle ? /^([a-z0-9_]+)@(-?\d+),(-?\d+)$/i.exec(goal.obstacle) : null;
        const solidAt = (s) => (s.x === goal.at.x && s.y === goal.at.y)
            || (s.rect?.x === goal.at.x && s.rect?.y === goal.at.y);
        const solid = (run.world.solids ?? []).find((s) => solidAt(s)
            && (!parsed || s.tag === parsed[1])) ?? null;
        const cls = parsed?.[1] ?? solid?.tag ?? null;
        const id = `${cls ?? '?'}@${goal.at.x},${goal.at.y}`;
        const whatCT = `solverBot(${name}) clear-tag {${flag.level},${flag.tag}} ${id}`;
        const refuseCT = (reason, why, extra = {}) => refuse(`${whatCT}: ${why}`, {
            goal, obstacle: { kind: 'clear-tag', id, flag: { ...flag }, reason }, ...extra,
        });
        if (run.level !== flag.level) {
            refuseCT('wrong-level', `the run stands in level ${run.level}; the flag is level `
                + `${flag.level}'s, and only that level's own world holds the obstacle. The macro layer `
                + 'owes the crossing first.');
        }
        const written = () => run.ledger('earnedClears')
            .find((c) => c.level === flag.level && c.tag === flag.tag) ?? null;
        /** The game has written it (`clearTagLanded`). */
        const landed = () => clearTagLanded(run, written(), id);
        const done = (arm, extra = {}) => {
            const row = written();
            records.push({
                ...extra, goal: 'clear-tag', arm, flag: { ...flag }, obstacle: id,
                // ⛔ `ledgerAt` is the row's own stamp, which for a rock (the hit) and a tree
                // (the press) is BEFORE the game's write; `confirmedAt` is the run's tick
                // count when the write was seen landed (>= the write tick + 1).
                ledgerAt: row?.t ?? null, confirmedAt: run.ticksCompleted, by: row?.by ?? null,
            });
        };
        const IDLE = new Set();
        /** Idle (nothing held) until the write lands; refuses by name past `CLEAR_TAG_WRITE_TICKS`. */
        const waitForWrite = (after) => {
            const from = perTick.length;
            while (!landed() && perTick.length - from < CLEAR_TAG_WRITE_TICKS) {
                perTick.push(IDLE);
                const { transition } = run.advance(IDLE);
                if (transition) {
                    refuseCT('not-written', `the run crossed to level ${transition.to_level} while waiting for `
                        + `the flag after ${after}`);
                }
            }
            if (!landed()) {
                refuseCT('not-written', `${after}, and the run's \`earnedClears\` `
                    + `${written() ? `holds {${flag.level},${flag.tag}} and the game's write has not landed`
                        : `still does not hold {${flag.level},${flag.tag}}`} ${CLEAR_TAG_WRITE_TICKS} ticks later — `
                    + 'the way may be clear, but the flag is what the next arrival reads');
            }
            return perTick.length - from;
        };
        if (written()) {
            const waited = waitForWrite('an earlier walk or verb cleared it');
            done('cleared-in-passing', { waited, why: `the run's \`earnedClears\` already holds {${flag.level},`
                + `${flag.tag}} — an earlier walk or verb cleared it, so the goal is met and not walked at` });
            return;
        }
        if (!solid) {
            done('already-clear', { why: `no ${cls ?? 'solid'} stands at (${goal.at.x},${goal.at.y}) in level `
                + `${run.level}'s live world and the ledger is silent: the build left it out, which is the `
                + 'game\'s own `check()` for a flag the boot\'s persistence holds cleared' });
            return;
        }
        const obstacle = { kind: 'solid', tag: cls, id };
        const key = `solid:${cls}`;
        const strategy = refineStrategy(run, OBSTACLE_STRATEGIES[key] ?? null, obstacle);
        if (!strategy || !STRATEGY_EXECUTORS[strategy]) {
            refuseCT('no-verb', strategy
                ? `${key} selects '${strategy}', which is NOT REGISTERED — no executor clears this flag `
                    + 'yet (a later slice\'s row, computed rather than guessed)'
                : `no strategy row exists for ${key} — the catalogue names no verb that clears it`);
        }
        const contacts = new Set([...senseContacts(run), ...exemptions]);
        let resolved;
        try {
            resolved = resolveObstacleStrategy(run, strategy, obstacle, contacts,
                { x: goal.at.x, y: goal.at.y }, null, [...refusedOrders]);
        } catch (e) {
            if (!(e instanceof SolverRefusal)) throw e;
            refuseCT('unresolved', `'${strategy}' could not be resolved from (${run.state.x},`
                + `${run.state.y}): ${e.message}`);
        }
        if (!resolved) {
            refuseCT('unresolved', `'${strategy}' is SELECTED and REGISTERED for ${key}, and the `
                + 'resolver could not bind this obstacle against live state');
        }
        if (resolved.held === false) {
            refuseCT('cannot-act', `'${strategy}' cannot act on ${id} with this run's bag — `
                + `${resolved.rejected?.[0]?.why ?? 'the resolver said held: false'}`);
        }
        if (resolved.prerequisite) {
            refuseCT('prerequisite', `'${strategy}''s stance is reachable only once `
                + `${resolved.prerequisite.id} is discharged (${resolved.prerequisite.via}: `
                + `${resolved.prerequisite.why}); a clear-tag order does not chain openers`);
        }
        const verb = resolved.strategy ?? strategy;
        seeRow({
            tick: perTick.length,
            saw: saw(),
            goal: { kind: goal.kind, tag: { ...flag }, at: { x: goal.at.x, y: goal.at.y } },
            obstacle: { kind: obstacle.kind, id },
            strategy: { verb },
            rejected: resolved.rejected ?? [],
            keys: [],
        });
        const before = {
            open: run.entities('openActivators'),
            armed: run.entities('armedPulsers') ?? new Set(),
            trapsArmed: run.entities('armedArrowTraps') ?? new Set(),
            chests: run.entities('openChests'),
        };
        if (resolved.stance) {
            walkTo(goal, resolved.stance, {
                what: `${whatCT} -> ${verb} stance`,
                contactsOverride: resolved.exempt,
                axisAligned: resolved.approach === 'axis-aligned',
            });
        }
        if (written()) {
            // The walk to the stance struck it (its strike policy swings at what it passes).
            const waited = waitForWrite('the walk to the stance cleared it');
            done('cleared-in-passing', { waited, during: 'stance walk', strategy: verb,
                why: `the walk to ${verb}'s stance cleared ${id} on its way — the verb is not run again` });
            return;
        }
        const record = STRATEGY_EXECUTORS[verb](run, perTick, resolved, {
            maxTicksPerTarget, economies, dashMode, what: `${whatCT} -> ${verb}`,
            before, walkTo, goal, equip,
        });
        for (const c of resolved.exempt ?? []) exemptions.add(c);
        // The verb's own finish is the WORLD's (the solid gone, the lock open);
        // the GAME's write can land later (a lock's `turnOff` closes its fade).
        const waited = waitForWrite(`'${verb}' ran (${JSON.stringify(record).slice(0, 160)})`);
        done('verb', { strategy: verb, waited, ...record });
    };

    // ── the goals, in order ───────────────────────────────────────────
    for (const goal of goals) {
        // The bound is PER GOAL: clearing L4's button for the crossing says
        // nothing about how many obstacles the next room's goal may need.
        applied = [];
        openerChain = [];
        goalPlanExtra = {};
        goalRides = new Set();
        /** The pit executor, shared by `reach-pit` and an encounter's `then` (swim U5). */
        const execReachPit = (goal, pitGoal) => {
            /**
             * ⛓⛓ SEEDLING SWIM U1, D1 — THE PIT EXECUTOR, `reach-exit`'s shape
             * with the driver's pit-exit leg's identity. The aim is the tile's
             * centre; the plan bag exempts THAT tile and no other (a pit met
             * anywhere else is still `{kind: 'pit'}` and refuses by name); the
             * crossing is accepted on the TILE the player stood on when the edge
             * fired (`drive`'s `crossTo.pit` arm), because every pit of a level
             * falls to the same level. The landing is the model's own:
             * `fallDestination` reads the level's `control` block, and the
             * run then coasts the transport (`coastThroughTransport`, the leg
             * runner's own) so the segment ends ON THE GROUND in the next level.
             */
            const { tx, ty } = pitGoal.pit;
            const pit = (run.world.pitTiles ?? []).find((p) => p.tx === tx && p.ty === ty);
            const whatPit = `solverBot(${name}) reach-pit (${tx},${ty})`;
            if (!pit) {
                refuse(`${whatPit}: level ${run.level} has no pit tile there — its pits are `
                    + `[${(run.world.pitTiles ?? []).slice(0, 12).map((p) => `(${p.tx},${p.ty})`)
                        .join(' ')}${(run.world.pitTiles ?? []).length > 12 ? ' …' : ''}]. A goal `
                    + 'about an absent pit is a macro-layer error.', {
                    goal, obstacle: { kind: 'absent-pit', id: `pit@${tx},${ty}` },
                });
            }
            let fall;
            try {
                fall = fallDestination(run.world, {
                    x: pit.rect.x + pit.rect.w / 2, y: pit.rect.y + pit.rect.h / 2,
                });
            } catch (e) {
                if (!(e instanceof PhysicsV2Error)) throw e;
                refuse(`${whatPit}: ${e.message}`, {
                    goal, obstacle: { kind: 'lethal-pit', id: `pit@${pit.rect.x},${pit.rect.y}` },
                });
            }
            const crossTo = { level: fall.to_level, pit, arrival: { ...fall.ctor } };
            goalPlanExtra = { allowPit: { tx, ty } };
            goalRides = pitRides(tx, ty);
            const t = walkTo(goal, {
                x: pit.rect.x + pit.rect.w / 2, y: pit.rect.y + pit.rect.h / 2,
            }, { crossTo, what: `${whatPit}->L${fall.to_level}` });
            goalPlanExtra = {};
            goalRides = new Set();
            const swapsBefore = run.transitions.length;
            const coast = coastThroughTransport(run, perTick, maxTicksPerTarget,
                `${whatPit}->L${fall.to_level}`);
            /**
             * ⛓⛓⛓ seedling fidelity DESCENT — A FALL CAN CHAIN. The descent is
             * the new Game's arrival and fires a live door it crosses
             * (`Teleporter.update` has no `fallFromCeiling` guard): L110's pit
             * lands on L0's stairs and the run ENDS in L2. `to` stays the
             * control's level (where the pit falls); `chained` (present only when
             * a door fired during the coast, so every other record is
             * byte-identical) names the swaps and where the run really ended.
             */
            const swaps = run.transitions.slice(swapsBefore);
            records.push({
                goal: 'reach-pit', to: fall.to_level, t: t.t, coast,
                ...(swaps.length > 0 ? {
                    chained: {
                        via: swaps.map((s) => ({ t: s.t, from_level: s.from_level, to_level: s.to_level })),
                        ends: { level: run.level, x: run.state.x, y: run.state.y },
                    },
                } : {}),
            });
        };
        if (goal.kind === 'reach-pit') {
            execReachPit(goal, goal);
            continue;
        }
        if (goal.kind === 'clear-tag') {
            execClearTag(goal);
            continue;
        }
        if (goal.kind === 'encounter') {
            /**
             * ⛓⛓ SEEDLING SWIM U5: the executor is looked up by the DROP, and
             * an unregistered drop refuses before a tick is spent. After the
             * drop, `then: 'reach-pit'` falls through the level's nearest pit
             * tile (its control block names where every pit lands).
             */
            const whatEnc = `solverBot(${name}) encounter (${goal.at.x},${goal.at.y})`
                + `->${goal.drop.item}`;
            const exec = ENCOUNTER_EXECUTORS[goal.drop.item];
            if (!exec) {
                refuse(`${whatEnc}: no encounter executor is registered for a `
                    + `'${goal.drop.item}' drop in level ${run.level}. An executor is derived from `
                    + 'an encounter the model SIMULATES (L32\'s, `bobBossFight.js`, registered '
                    + 'as `Fire`); a drop with no simulated encounter behind it has nothing to '
                    + 'derive a schedule from or verify a landing against.', {
                    goal,
                    obstacle: { kind: 'unmodelled-encounter',
                        id: `encounter@${goal.at.x},${goal.at.y}` },
                });
            }
            const enc = exec(run, perTick, goal, {
                maxTicksPerTarget, economies, dashMode, what: whatEnc, walkTo, goal,
                seeRow, saw, refuse, equip,
            });
            records.push(...enc.records);
            if (goal.then === 'reach-pit') {
                // The level's control block names where its pits fall; the
                // nearest pit tile is the one the walk takes.
                const pits = (run.world.pitTiles ?? []).slice().sort((p, q) =>
                    Math.hypot(p.rect.x + 8 - run.state.x, p.rect.y + 8 - run.state.y)
                    - Math.hypot(q.rect.x + 8 - run.state.x, q.rect.y + 8 - run.state.y));
                if (pits.length === 0) {
                    refuse(`${whatEnc}: then 'reach-pit', and level ${run.level} has no pit tile.`, { goal });
                }
                execReachPit(goal, { pit: { tx: pits[0].tx, ty: pits[0].ty } });
            }
            continue;
        }
        if (goal.kind === 'reach-exit') {
            const { index, teleporter } = findExit(run.world, goal.exit);
            const centre = {
                x: teleporter.rect.x + TILE_SIZE / 2,
                y: teleporter.rect.y + TILE_SIZE / 2,
            };
            const crossTo = { level: teleporter.to, arrival: { ...teleporter.arrival } };
            const whatExit = `solverBot(${name}) reach-exit (${goal.exit.x},${goal.exit.y})`
                + `->L${teleporter.to}`;
            const stepOff = stepOffIfLatched(goal, index, teleporter, whatExit);
            // ⛓ FRONTIER3: the walk's aim leaves a centre a pixel mask
            // blocks (`exitAimFor`); the step-off's straight walk back keeps
            // the centre it was witnessed with.
            const t = (stepOff?.dir ? returnOntoDoor(goal, index, teleporter, centre, whatExit) : null)
                ?? walkTo(goal, exitAimFor(run.world, index,
                    solverPlanOpts(run, senseContacts(run), goalPlanExtra)), {
                    allowTeleporter: index,
                    crossTo,
                    what: whatExit,
                });
            records.push({ goal: 'reach-exit', to: teleporter.to, t: t.t, ...(stepOff ? { stepOff } : {}) });
            continue;
        }
        // collect-placement
        const resolved = resolveCollectStrategy(run, goal.placement);
        if (!resolved) {
            refuse(`solverBot(${name}): collect-placement (${goal.placement.x},`
                + `${goal.placement.y}) resolves to NOTHING in level ${run.level} — `
                + 'no chest, no pickup and no apitem stands there. A goal about an absent thing '
                + 'is a macro-layer error, said here rather than walked at.', {
                goal,
                obstacle: { kind: 'absent-placement', id: null },
            });
        }
        if (resolved.strategy === 'apitem') {
            /**
             * ⛓⛓⛓ SEEDLING FIDELITY F2, D1a: THE `apitem` VERB. It walks to
             * the box's centre with the loop's own `walkTo` (planner, danger
             * gate, ladder), and the observer on `run.advance` says on which
             * tick the game took it. Any approach that ends on the centre
             * overlaps the box on its way in, so a walk that arrives and
             * took nothing is a model defect, refused by name. The walk runs
             * on to arrival after the take; the record names the take's
             * tick, so a caller that wants the tape to end there cuts it at
             * `takenAt + 1`.
             */
            const a = resolved.target;
            const whatA = `solverBot(${name}) apitem (${a.x},${a.y})`;
            const takenRow = () => apItemsTaken.get(`${run.level}:${a.id}`) ?? null;
            const record = (t, arm) => ({
                goal: 'collect-placement', strategy: 'apitem', arm,
                apItem: { id: a.id, tag: a.tag, x: a.x, y: a.y }, level: t.level, takenAt: t.tick,
                why: `${a.id} (tag ${a.tag}) was taken on tape tick ${t.tick}: the player box `
                    + 'the previous tick left overlaps its `apItem` box (`apItemTakenOnTick`)',
            });
            if (takenRow()) {
                records.push(record(takenRow(), 'collected-in-passing'));
                continue;
            }
            const centre = { x: (a.rect.x + a.rect.right) / 2, y: (a.rect.y + a.rect.bottom) / 2 };
            // The selection is recorded where it was made, before the walk:
            // the walk row on the same tick merges under it (`substantive`).
            seeRow({
                tick: perTick.length,
                saw: saw(),
                goal: { kind: goal.kind, placement: { ...goal.placement } },
                strategy: { verb: 'apitem' },
                obstacle: null,
                rejected: resolved.rejected,
                keys: [],
            });
            walkTo(goal, centre, { what: `${whatA} contact` });
            const taken = takenRow();
            if (!taken) {
                refuse(`${whatA}: the walk reached the apitem's centre (${centre.x},${centre.y}) `
                    + `in level ${run.level} and the contact rule never fired. A box the player `
                    + 'stands on is a box the previous tick overlapped, so this is the model '
                    + 'disagreeing with itself, not a walk to retry.', {
                    goal, obstacle: { kind: 'apitem', id: a.id },
                });
            }
            records.push(record(taken, 'walk'));
            continue;
        }
        let contacts = senseContacts(run);
        const what = `solverBot(${name}) ${resolved.strategy} `
            + `(${goal.placement.x},${goal.placement.y})`;
        /**
         * ⛓⛓⛓ SEEDLING SWIM U10, D4 — **A GOAL SATISFIED BEFORE IT WAS ASKED.**
         *
         * A fight's dodge, or the walk to an earlier goal's stance, can walk
         * over the pickup: the ceremony runs then and there, and `runCollect`
         * — which waits for the `collected` ledger to grow past its START
         * count — then walks at a pickup that is gone until its budget runs
         * out, reading as *"walked at totempart … without touching it"* (U6
         * § D5: four corridor-body cells). The run's own `takenPickups` names
         * it, so the goal is recognised as met rather than re-walked; asked
         * BEFORE the stance and again AFTER the walk to it, because either
         * walk can be the one that took it (trap candidate: a goal satisfied
         * before it was asked).
         */
        const collectedInPassing = (where) => {
            const p = resolved.target;
            if (resolved.strategy !== 'collect'
                || !run.progress('takenPickups').has(`pickup:${p.tag}@${p.x},${p.y}`)) return false;
            const row = run.ledger('collected').filter((c) => c.level === run.level).at(-1) ?? null;
            records.push({
                goal: 'collect-placement', strategy: 'collect', arm: 'collected-in-passing',
                pickup: { tag: p.tag, x: p.x, y: p.y },
                item: row?.item ?? null,
                level: run.level,
                // The last ceremony this level completed — the one that took it.
                collectedAt: row?.t ?? null,
                why: `${p.tag}@${p.x},${p.y} was already taken ${where} — the run's `
                    + '`takenPickups` names it, so the goal is met and not walked at',
            });
            return true;
        };
        if (collectedInPassing('before this goal began')) continue;
        /**
         * ⛔ CLEAR WHAT THE PLACEMENT IS INSIDE, BEFORE DERIVING A STANCE
         * NEAR IT. See `placementBlocker`: L19's boss key is inside the boss,
         * and a stance derivation cannot see that at all — it asks about
         * cells around the placement, and every one of them is fine.
         */
        for (let guard = 0; ; guard += 1) {
            /**
             * ⛓⛓⛓ SEEDLING FIDELITY PROXIMITY — a chest under a SHUT `Cover` is
             * inside a Solid that `placementBlocker` cannot name: the cover shares
             * the chest's own cell, which is that function's "not its own blocker"
             * exclusion. Asked here by identity (`coverOverChest`); its only verb is
             * `pulse` — a hold on the cover's momentary button would shut it again
             * the tick the walker left for the probe line (`resolveChestStrategy`).
             */
            const covered = resolved.strategy === 'chest' ? coverOverChest(run, resolved.target) : null;
            const blocker = placementBlocker(run, resolved, contacts)
                ?? (covered ? { kind: 'solid', tag: covered.tag, id: covered.id, covers: true } : null);
            if (!blocker) break;
            if (guard >= MAX_STRATEGIES_PER_GOAL) {
                refuse(`${what}: cleared ${guard} obstacle(s) and the placement is STILL `
                    + `inside ${blocker.id}.`, { goal, obstacle: blocker });
            }
            const key = blocker.tag ? `${blocker.kind}:${blocker.tag}` : blocker.kind;
            const strategy = blocker.covers
                ? (refineStrategy(run, 'hold', blocker) === 'pulse' ? 'pulse' : null)
                : refineStrategy(run,
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
                maxTicksPerTarget, economies, dashMode, what: `${what} -> ${strategy}`,
                before: null, walkTo, goal, equip,
            });
            records.push({ goal: goal.kind, strategy, ...rec });
            for (const c of resolvedBlocker.exempt ?? []) exemptions.add(c);
            contacts = senseContacts(run);
        }
        const stance = deriveStance(run, resolved, contacts, { economies });
        /**
         * ⛔ THE SHUT-BEFORE SNAPSHOT, taken BEFORE the approach — `runChest`
         * demands it because the trigger is a line the approach itself may
         * cross, so "shut when the verb began" is a state a correct walk is
         * never in at the stance.
         */
        const before = resolved.strategy === 'chest' ? { chests: run.entities('openChests') } : null;
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
        if (collectedInPassing('on the walk to its stance')) continue;
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
            maxTicksPerTarget, economies, dashMode, what, before, walkTo, goal, equip,
            // ⛓ FIDELITY PROXIMITY: `execCollect`'s grid-keeping approach.
            ...(skirtGridKept(run, goals.slice(goals.indexOf(goal)))
                ? { keepGrid: true } : {}),
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
        /** ⛓ Swim U5: the slot selections this segment made — see `solverEquips`. */
        equips: solverEquips,
        /**
         * ⛓⛓ SEEDLING FIDELITY DASH, D3 — **THE EXACT DASH COUNT** (an optional
         * result field; no caller is required to read it). `count` is the dash
         * presses this segment's ticks made — `set slashing`'s dash arm, read off
         * the run (see `dashesPressed`), every walk and verb included. `windows`
         * is the planned dash windows the planner handed a driven walk, inner
         * rung walks included; a window can hold more than one press, and a walk
         * refuted mid-way keeps the presses it made, so `count` is the number to
         * read and `windows` the plan's own account. `walks` is one row per walk
         * the planner was asked for, `{tick, what, attempt, planned, windows,
         * ticks, saved, why, pressed}`. At `dashMode: 'none'` it is
         * `{count: 0, windows: 0, walks: []}` (the planner is never asked).
         */
        dashes: {
            count: dashesPressed,
            windows: dashWalks.reduce((n, w) => n + w.windows, 0),
            walks: dashWalks.map((w) => ({ ...w })),
        },
        /**
         * ⛓ EDITOR ARC SLICE 9 — beside `trace`, deliberately, and not inside
         * it. A trace row is a DECISION and its `saw.danger` is a summary
         * (`kind:id`, no reason, no box); this is the query itself, with the
         * union's own `why` on every source. Folding it into the rows would
         * have changed the committed trace sidecars — which is the one thing
         * an instrument added to a solver may not do.
         */
        dangerQueries,
        /**
         * ⛓ FRONTIER3 — an optional result field, present only when a walk was
         * planned on `FINE_LATTICE` after the frontier refused: `{tick, what,
         * aim, waypoints, refused}` per walk (`refused` is the refusal it
         * replaced, cut to 200 characters).
         */
        ...(fineLatticeWalks.length ? { fineLatticeWalks } : {}),
    };
}
