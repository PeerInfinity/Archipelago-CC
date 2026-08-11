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
    DEFAULT_TOLERANCE, DEFAULT_MAX_TICKS_PER_TARGET,
} from './botDriverV1.js';
import {
    BotDriverV2Error, DEFAULT_LATTICE, contactsAt, drive, findExit,
    nodeCentre, nodeAt, plannerObstacleAt, planWaypoints, runChest, runCollect, runHold,
} from './botDriverV2.js';
import { resolvePresser } from './botDriverV2.js';
import { RESPONDERS, opensOnTick } from './activators.js';
import { dangerAt } from './dangerMap.js';
import { createTraceBuilder } from './decisionTrace.js';
import { TILE_SIZE } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { HITBOX } from './playerPhysicsV1.js';
import { chestStanceBand } from './chest.js';

export class SolverBotError extends Error {
    constructor(message) { super(message); this.name = 'SolverBotError'; }
}

/**
 * ⛔ THE NAMED REFUSAL. "No path and no strategy" never stalls silently —
 * it throws this, carrying the goal, the obstacle (census vocabulary), every
 * strategy considered with why it was rejected, and the trace rows recorded
 * so far. A reader gets the whole decision, not a stack trace.
 */
export class SolverRefusal extends Error {
    constructor(message, { goal = null, obstacle = null, considered = [], rows = [] } = {}) {
        super(message);
        this.name = 'SolverRefusal';
        this.goal = goal;
        this.obstacle = obstacle;
        this.considered = considered;
        this.rows = rows;
    }
}

const fail = (m) => { throw new SolverBotError(m); };

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
    'solid:magicallock': 'kill',
    // A button guarding the frontier is L4's own shape: the room's answer
    // starts with HOLDING it (the hand-authored leg's `hold` mechanic).
    'proximity-hazard:button': 'hold',
    'proximity-hazard:chest': 'chest',
    'pickup': 'collect',
});

/**
 * Executors registered so far. ⛓ R8 slice 3 added `hold`, which is the first
 * row that had to DERIVE its own parameters rather than bind a placement: a
 * leg spec carried `{presser, ticks}` and a live policy has to work out both.
 */
export const STRATEGY_EXECUTORS = Object.freeze({
    collect: execCollect,
    chest: execChest,
    hold: execHold,
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
 * ⛓⛓⛓ RESOLVE a frontier obstacle into everything its executor needs —
 * the live counterpart of a leg spec's declared arguments.
 *
 * Returns `null` when the obstacle's census row is not one this executor can
 * bind, which the caller reports as a considered-and-rejected option rather
 * than as a crash: "the table names a strategy for this kind" and "this
 * particular body can be acted on" are different claims.
 */
function resolveObstacleStrategy(run, strategy, obstacle, contacts) {
    if (strategy !== 'hold') return null;
    const presser = (run.world.pressers ?? []).find(
        (p) => `${p.tag}@${p.x},${p.y}` === obstacle.id,
    );
    if (!presser) return null;
    const resolvedPresser = resolvePresser(run.world, { x: presser.x, y: presser.y },
        `solverBot hold (${obstacle.id})`);
    const { stance, exempt } = deriveHoldStance(run, resolvedPresser, contacts);
    return {
        strategy: 'hold',
        target: { x: presser.x, y: presser.y },
        stance,
        exempt,
        hold: deriveHold(run, resolvedPresser),
        rejected: [{
            option: 'route-around',
            why: `${obstacle.id} is a proximity-hazard volume on the frontier of the `
                + 'reachable component, so there is no route around it — A* refuses to '
                + 'plan THROUGH an avoid volume, and a hold is what adds its presser to '
                + 'the exemptions (trap 147)',
        }],
    };
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
 * The danger probe at a DECISION point: the union map's reason list for a
 * box at a position, at the run's own clock. Slice 2's response to a
 * non-empty list is a refusal that carries it (no dodge policy yet — slice
 * 3's charge); the probe is wired now so the seam exists and the trace can
 * carry what was seen.
 */
function dangerNow(run, x, y) {
    return dangerAt(run, run.ticksCompleted, playerBoxAt(x, y));
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
    const candidates = [];
    for (let r = 1; r <= 3; r += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
            for (let dx = -r; dx <= r; dx += 1) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const c = nodeCentre(cell.tx + dx, cell.ty + dy, DEFAULT_LATTICE);
                if (plannerObstacleAt(run.world, c.x, c.y, null, opts)) continue;
                candidates.push({ d: Math.hypot(c.x - centre.x, c.y - centre.y), ...c });
            }
        }
    }
    candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    for (const c of candidates) {
        try {
            planWaypoints(run.world, run.state, { x: c.x, y: c.y }, null,
                solverPlanOpts(run, contacts));
            return { x: c.x, y: c.y };
        } catch (e) {
            if (!(e instanceof BotDriverV2Error)) throw e;
        }
    }
    throw new SolverRefusal(
        `solverBot: no REACHABLE stance within 3 lattice rings of `
        + `${p.tag}@${p.x},${p.y} in level ${run.level} — `
        + `${candidates.length} walkable candidate(s), none with a corridor from `
        + `(${run.state.x},${run.state.y}). The pickup's own cell is an avoid volume `
        + 'by design; a walkable ring cell in an unreachable component is not a stance.',
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
function deriveHold(run, presser) {
    const group = run.world.activators.filter((a) => a.t === presser.t);
    const traps = (run.world.arrowTraps ?? []).filter((a) => a.t === presser.t);
    if (group.length > 0) {
        const shut = group.filter((a) => !run.openActivators.has(a.id));
        const cost = Math.max(...shut.map(
            (a) => opensOnTick(RESPONDERS[a.tag]?.fade ?? RESPONDERS.lock.fade),
        ));
        return {
            ticks: cost + HOLD_SLACK,
            until: {
                why: `every shut responder in group t=${presser.t} `
                    + `[${shut.map((a) => a.id).join(', ')}] is open`,
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
function deriveHoldStance(run, presser, contacts) {
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
    for (const c of candidates) {
        try {
            planWaypoints(run.world, run.state, { x: c.x, y: c.y }, null,
                solverPlanOpts(run, exempt));
            return { stance: { x: c.x, y: c.y }, exempt };
        } catch (e) {
            if (!(e instanceof BotDriverV2Error)) throw e;
        }
    }
    throw new SolverRefusal(
        `solverBot: no REACHABLE stance inside ${presser.tag}@${presser.x},${presser.y} `
        + `in level ${run.level} — ${candidates.length} cell(s) land the player box in `
        + 'the button and none of them plans a corridor from '
        + `(${run.state.x},${run.state.y}). A hold that cannot be stood on is not a `
        + 'strategy for this obstacle.',
        { obstacle: { kind: 'proximity-hazard', id: `${presser.tag}@${presser.x},${presser.y}` } });
}

/** `rectsOverlap`, local so this module keeps its own import list honest. */
function rectsOverlapLocal(a, b) {
    return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}

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
    const saw = () => {
        const s = run.state;
        const d = dangerNow(run, s.x, s.y);
        return {
            level: run.level, x: s.x, y: s.y, vx: s.vx, vy: s.vy,
            danger: d.sources.map((src) => `${src.kind}:${src.id ?? '?'}`),
        };
    };
    let replans = 0;
    let waypointsPlanned = 0;
    /**
     * ⛓ R8 slice 3 — the contact exemptions a STRATEGY earned, carried for
     * the rest of the segment. `senseContacts` answers "what am I standing
     * in"; this answers "what did I earn the right to stand in", and the two
     * are different claims about the same volume.
     */
    const exemptions = new Set();
    /** The strategies applied for the CURRENT goal, for the bound below. */
    let applied = [];
    const grazes = [];
    const records = [];

    /**
     * Refuse, with everything a reader needs. The rows recorded so far ride
     * on the error — a refused segment is still reviewable.
     */
    const refuse = (message, extra = {}) => {
        throw new SolverRefusal(message, { rows: [...rows], ...extra });
    };

    /**
     * The danger gate at a decision point: slice 2 SENSES and REFUSES.
     * Dodge is slice 3's policy; a policy that walked on past a named
     * danger would be worse than one that stops and says why.
     */
    const refuseDanger = (x, y, goal, what) => {
        const d = dangerNow(run, x, y);
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
    const identifyAndSelect = (goal, aim, contacts, planError) => {
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
        const actionable = [...frontier.values()].sort((a, b) => a.d - b.d);
        const obstacle = actionable[0] ?? { kind: 'no-corridor', tag: null, id: null };
        const key = obstacle.tag ? `${obstacle.kind}:${obstacle.tag}` : obstacle.kind;
        const strategy = OBSTACLE_STRATEGIES[key] ?? OBSTACLE_STRATEGIES[obstacle.kind] ?? null;
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
            const resolved = resolveObstacleStrategy(run, strategy, obstacle, contacts);
            if (resolved) return { obstacle, strategy, resolved, key };
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
     * Walk to `aim` through a planned corridor, re-planning ONCE per failure
     * with a trace row — never silently (the botDriverV2 doctrine, kept: a
     * silent re-plan hides a model divergence; a TRACED one is a decision a
     * reader can audit).
     */
    const walkTo = (goal, aim, {
        allowTeleporter = null, crossTo = null, what, contactsOverride = null,
    }) => {
        for (let attempt = 0; ; attempt += 1) {
            const contacts = contactsOverride
                ? new Set([...senseContacts(run), ...contactsOverride])
                : new Set([...senseContacts(run), ...exemptions]);
            refuseDanger(run.state.x, run.state.y, goal, what);
            let wps;
            try {
                wps = planWaypoints(run.world, run.state, aim, allowTeleporter,
                    solverPlanOpts(run, contacts));
            } catch (e) {
                if (!(e instanceof BotDriverV2Error)) throw e;
                const plan = identifyAndSelect(goal, aim, contacts, e);
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
                const before = perTick.length;
                seeRow({
                    tick: before,
                    saw: saw(),
                    goal: { kind: goal.kind, aim: { x: aim.x, y: aim.y } },
                    obstacle: { kind: plan.obstacle.kind, id: plan.obstacle.id },
                    strategy: { verb: plan.strategy },
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
            const SAMPLE = 8;
            let from = { x: run.state.x, y: run.state.y };
            for (const wp of wps) {
                const dist = Math.hypot(wp.x - from.x, wp.y - from.y);
                const steps = Math.max(1, Math.ceil(dist / SAMPLE));
                for (let i = 1; i <= steps; i += 1) {
                    const px = from.x + ((wp.x - from.x) * i) / steps;
                    const py = from.y + ((wp.y - from.y) * i) / steps;
                    const d = dangerNow(run, px, py);
                    if (d.danger) {
                        refuse(`${what}: the planned corridor passes through danger at `
                            + `(${px.toFixed(1)},${py.toFixed(1)}) — `
                            + d.sources.map((s) => `${s.kind}:${s.id ?? '?'} (${s.why})`)
                                .join('; ')
                            + '. Slice 2 refuses a dangerous corridor rather than '
                            + 'dodging through it (combat policy is slice 3; a route '
                            + 'the model can afford is not one the room with a live '
                            + 'hazard can — trap 151).',
                        {
                            goal,
                            obstacle: { kind: 'danger', id: d.sources[0]?.id ?? null },
                            considered: [
                                { option: 'dodge', why: 'not a registered policy this slice' },
                                { option: 'wait-for-window', why: 'not a registered policy this slice' },
                            ],
                        });
                    }
                }
                from = wp;
            }
            seeRow({
                tick: perTick.length,
                saw: saw(),
                goal: { kind: goal.kind, aim: { x: aim.x, y: aim.y } },
                strategy: { verb: 'walk', waypoints: wps.length },
                path: wps.map((w) => ({ x: w.x, y: w.y })),
                rejected: attempt === 0 ? [] : [{
                    option: 'keep-plan',
                    why: 'the previous corridor was refuted by the world '
                        + '(a blocked sweep or a stall); re-planned from the live position',
                }],
                keys: [],
            });
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
        const contacts = senseContacts(run);
        const stance = deriveStance(run, resolved, contacts);
        const what = `solverBot(${name}) ${resolved.strategy} `
            + `(${goal.placement.x},${goal.placement.y})`;
        /**
         * ⛔ THE SHUT-BEFORE SNAPSHOT, taken BEFORE the approach — `runChest`
         * demands it because the trigger is a line the approach itself may
         * cross, so "shut when the verb began" is a state a correct walk is
         * never in at the stance.
         */
        const before = resolved.strategy === 'chest' ? { chests: run.openChests } : null;
        walkTo(goal, stance, { what: `${what} stance` });
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
            maxTicksPerTarget, what, before,
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
    for (const row of rows) {
        const prev = merged[merged.length - 1];
        if (prev && prev.tick === row.tick) {
            row.note = `${prev.note ? `${prev.note}; ` : ''}merged: `
                + `${prev.strategy.verb} decided on the same tick`;
            merged[merged.length - 1] = row;
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
    };
}
