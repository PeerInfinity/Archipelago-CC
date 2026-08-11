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
    runShove, runDwell, SHOVE_STEP,
} from './botDriverV2.js';
import { resolvePresser } from './botDriverV2.js';
import { RESPONDERS, opensOnTick } from './activators.js';
import { bodyKillRegions, dangerAt, dangerVolumes, forbiddenByDanger } from './dangerMap.js';
import { planDash } from './mover.js';
import { arrowLane } from './arrowTrap.js';
import { chaserBoxAt } from './chasers.js';
import { createTraceBuilder } from './decisionTrace.js';
import { DESTROYING_TILE_TYPES } from './pushables.js';
import { rect, TILE_SIZE } from './levelWorld.js';
import { ENEMY_CLASSES, KILL_LOCK_TAGS, KILL_LOCK_TSET } from './combat.js';
import { MOBILE_DEATH_FADE } from './enemyDamage.js';
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
    /**
     * ⛓ R8 slice 3b: the first executor whose DESTINATION is derived rather
     * than its stance — ⚖ §11.8a ruling 1. `hold` derived a duration from a
     * mechanism; this derives a CELL from a post-condition, which is the
     * shape `kill` and the puzzle policy then follow.
     */
    shove: execShove,
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
    return row.t === KILL_LOCK_TSET ? 'kill' : strategy;
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
            if (cell.tx < 0 || cell.ty < 0
                || cell.tx >= run.world.world.width || cell.ty >= run.world.world.height) {
                rejected.push({ option: `shove ${dir} k=${k}`, why: 'off the map' });
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
function deriveKillByCeiling(run, body, contacts) {
    const world = run.world;
    const traps = world.arrowTraps ?? [];
    const options = [];
    for (const presser of (world.pressers ?? [])) {
        const covering = traps.filter((t) => t.t === presser.t).filter((t) => {
            const lane = arrowLaneRect(run, t);
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

/** An armed-or-not trap's lane, as a rect — `dangerMap`'s own derivation. */
function arrowLaneRect(run, trap) {
    const world = run.world;
    const lane = arrowLane({ id: trap.id, t: trap.t, x: trap.ex, y: trap.ey });
    return rect(lane.x0, lane.fromY, lane.x1 - lane.x0,
        Math.max(world.world.height - lane.fromY, 1));
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
        const actionable = [...frontier.values()].sort((a, b) => a.d - b.d);
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
            if (resolved) return { obstacle, strategy, resolved, key };
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
    const probeCorridor = (wps) => {
        const SAMPLE = 8;
        let from = { x: run.state.x, y: run.state.y };
        for (const wp of wps) {
            const dist = Math.hypot(wp.x - from.x, wp.y - from.y);
            const steps = Math.max(1, Math.ceil(dist / SAMPLE));
            for (let i = 1; i <= steps; i += 1) {
                const px = from.x + ((wp.x - from.x) * i) / steps;
                const py = from.y + ((wp.y - from.y) * i) / steps;
                const d = dangerNow(run, px, py);
                if (d.danger) return { x: px, y: py, ...d };
            }
            from = wp;
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
        const live = [...(run.chasers ?? [])];
        live.sort((a, b) => Math.hypot(a.x - aim.x, a.y - aim.y)
            - Math.hypot(b.x - aim.x, b.y - aim.y) || (a.id < b.id ? -1 : 1));
        for (const c of live) {
            const without = dangerVolumes(run, 0).filter((v) => v.id !== c.id);
            try {
                planWaypoints(run.world, run.state, aim, allowTeleporter,
                    solverPlanOpts(run, contacts, { extraVolumes: without }));
                return c;
            } catch (e) {
                if (!(e instanceof BotDriverV2Error)) throw e;
            }
        }
        return null;
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
    const climbLadder = ({ goal, aim, contacts, allowTeleporter, what, hit }) => {
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
        const vols = dangerVolumes(run, 0);
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
            const still = probeCorridor(avoid);
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
        const body = chooseBodyToRemove(goal, aim, contacts, allowTeleporter);
        let baitWhy = null;
        if (!body) {
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
        if (!target) {
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
            killWhy = kill.why;
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
                const plan = identifyAndSelect(goal, aim, contacts, e, allowTeleporter);
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
            const hit = probeCorridor(wps);
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
                });
                if (climbed.wps) { wps = climbed.wps; } else { continue; }
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
    };
}
