/**
 * seedlingDemo/jsRuntimeWalker — **THE PLAYBACK BOT'S FEET ON THE SEEDLING JS
 * RUNTIME** (Seedling JS runtime J2; plan
 * `NewDocs/plans/seedling-js-substrate-plan.md`, J0(b) option C).
 *
 * The walk is a CLOSED LOOP over the page's own live run — there is no run
 * clone to solve against (J0(b)), and re-booting a fresh run to solve from
 * refuses mid-ceremony, so neither is used:
 *
 *   every `REPLAN_EVERY` ticks   `planWaypoints(run.world, run.state, target,
 *                                 allowTeleporter, livePerVisitOpts(run) +
 *                                 snapStart)` — the solver's own planner, over
 *                                 the live geometry (opened chests, pushed
 *                                 blocks, broken rocks: the per-visit opts);
 *   every tick                   `driveStepHeld` toward the first waypoint not
 *                                 yet reached — the per-tick choice lifted out
 *                                 of `botDriverV2.drive`, so the walk holds the
 *                                 keys the solver's walk would;
 *   while a ceremony is up       nothing of ours: `jsRuntimeCore.tick` hands
 *                                 the held set to `session.heldFor`, which
 *                                 REPLACES it with the hoisted ceremony cadence.
 *
 * ⛔ DOM-FREE AND CLOCK-FREE. It DECIDES keys; the page's clock decides when a
 * tick runs (`watchManual.js` "THE LOOP QUESTION": this is a producer, and the
 * page's accumulator is the only pacer). `jsRuntimeCore` asks `heldFor(run)`
 * once per tick and reports the tick's outcome back through `observe`.
 *
 * ⛔ WHAT IT DOES NOT SEE (accepted, J2 brief): enemies and arrows. A
 * generated room holds only solver-certified elements; a room the loop cannot
 * cross is recorded, the model is not extended (⚖ ruling 4).
 *
 * Goals arrive already RESOLVED to the room's own coordinates — the host
 * controller (`flashPanel/seedlingPlaybackController.js`) maps an AP name to
 * `{kind:'location', level, tag}` or `{kind:'exit', level, tile:[tx, ty]}`;
 * this file maps those to a point and a teleporter of the LIVE world.
 *
 * ⛓ J3 — ATLAS GOALS. A real room's location is an entity of the room (a
 * chest opened from below, a pickup touched), so the point comes from the
 * injected `locationPointOf(goal)`; and an exit may name a SET of boundary
 * cells (`tiles: [[tx, ty], …]`) — the walk heads for the NEAREST live
 * teleporter among them (an atlas exit's `exit_tiles`). ⛔ A boundary cell
 * with no teleporter on it is not a crossing on either runtime: the wasm
 * binding is level-granular (`seedlingRegionBinding.js`, ruling 1) and the
 * game reports no sub-level boundary, so such an exit is refused, by name.
 */

import { planWaypoints, livePerVisitOpts, driveStepHeld, BotDriverV2Error } from './botDriverV2.js';
import { hasArrived } from './botDriverV1.js';
import { TILE_SIZE } from './levelWorld.js';
import { SOLVER_RETRY_AFTER_TICKS, SOLVER_RETRY_MAX } from './jsRuntimeSolver.js';

/** Re-plan cadence, in ticks (J0(b)'s demo: 8 reached both targets from a live state). */
export const REPLAN_EVERY = 8;
/** Arrival tolerance at a waypoint (botDriverV1's default). */
export const WALK_TOLERANCE = 1;
/** A walk that has neither completed nor been replaced after this many driven ticks gives up, by name. */
export const WALK_GIVE_UP_TICKS = 30 * 60;

export const WALK_STATES = Object.freeze({
    IDLE: 'idle',
    WAITING: 'waiting',     // the goal names a level the run is not in (yet)
    WALKING: 'walking',
    DONE: 'done',
    FAILED: 'failed',
});


/** The live teleporter a door tile names: its `.oel` cell is the tile. */
export function teleporterAtTile(world, [tx, ty]) {
    const tps = world?.teleporters ?? [];
    const index = tps.findIndex((tp) => !tp.deactivated
        && Math.floor(tp.x / TILE_SIZE) === tx && Math.floor(tp.y / TILE_SIZE) === ty);
    return index < 0 ? null : { index, teleporter: tps[index] };
}

/** ⛓ J3 — the cells an exit goal names: `tiles` (a boundary set) or the one `tile`. */
export function goalTiles(goal) {
    if (Array.isArray(goal?.tiles) && goal.tiles.length > 0) return goal.tiles;
    return Array.isArray(goal?.tile) ? [goal.tile] : [];
}

/** ⛓ J3 — the live teleporter on any of `tiles` nearest `from`, or null. */
export function nearestTeleporterAt(world, tiles, from) {
    let best = null;
    for (const tile of tiles) {
        const hit = teleporterAtTile(world, tile);
        if (!hit) continue;
        const c = { x: tile[0] * TILE_SIZE + TILE_SIZE / 2, y: tile[1] * TILE_SIZE + TILE_SIZE / 2 };
        const d = from ? (c.x - from.x) ** 2 + (c.y - from.y) ** 2 : 0;
        if (!best || d < best.d) best = { ...hit, tile, d };
    }
    return best;
}

const centreOf = (rect) => ({ x: (rect.x + rect.right) / 2, y: (rect.y + rect.bottom) / 2 });
const tileCentrePoint = ([tx, ty]) => ({ x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 });

/**
 * @param {object} deps
 * @param {(level:number, tag:number) => ({rect}|null)} deps.apItemOf  the
 *   mounted room's apitem (`jsRuntimeCore`'s table), null when absent
 * @param {(goal:object) => ({x:number, y:number}|null)} [deps.locationPointOf]
 *   ⛓ J3 — where a location goal is taken; absent = the apitem's centre
 * @param {(level:number, tag:number) => boolean} deps.isCollected
 * @param {(e:object) => void} [deps.onEvent]  `{type, goal, message}` per
 *   state change — the page logs it, the host controller relays it
 * @param {object} [deps.solver]  ⛓ solver-walk S1 — the solver mode
 *   (`jsRuntimeSolver.createRuntimeSolver`): asked FIRST for a tick's keys
 *   once the goal is resolved; `{held}` drives the tick, `{declined}` hands
 *   the goal to this walk WITH the reason in the status, `{failed}` fails
 *   the goal, null (off, or not a solver goal) walks as before.
 *   ⛓ S2 — `{solving}` HOLDS the tick (the core does not step the run; the
 *   walk's give-up clock does not run), and a declined goal is offered to
 *   the solver AGAIN after a death, a crossing, or `retryAfter` walked
 *   ticks — at most `retryMax` times, each retry named in the status.
 * @param {object} [opts]
 */
export function createRuntimeWalker({ apItemOf, locationPointOf = null, isCollected, onEvent = () => {}, solver = null } = {}, {
    replanEvery = REPLAN_EVERY, giveUpTicks = WALK_GIVE_UP_TICKS,
    retryAfter = SOLVER_RETRY_AFTER_TICKS, retryMax = SOLVER_RETRY_MAX,
} = {}) {
    let goal = null;
    let state = WALK_STATES.IDLE;
    let reason = null;
    let playing = false;
    let stepBudget = 0;
    let waypoints = null;
    let sincePlan = Infinity;
    let driven = 0;
    let plans = 0;
    let planError = null;
    /** ⛓ S1 — the solver's reason for declining this goal (the walk then walks it), or null. */
    let declined = null;
    /** ⛓ S1 — whether THIS tick's keys came from the solver's plan. */
    let solverDriving = false;
    /** ⛓ S2 — whether THIS tick is held while a solve is in flight. */
    let solverHolding = false;
    /** ⛓ S2 — the decline-retry state: retries made, walked ticks since the decline, a death/crossing seen since. */
    let retries = 0;
    let sinceDecline = 0;
    let retryCause = null;
    /** ⛓ S2 — every retry, named (`{n, after, declined}`), for the status and the rows. */
    let retryLog = [];

    const emit = (type, message) => {
        try { onEvent({ type, state, goal: goal ? { ...goal } : null, message }); } catch { /* a listener's bug is not the walk's */ }
    };
    const settle = (next, why) => {
        // ⛓ S2 — leaving the walk drops a solve in flight (its worker is terminated).
        if (next !== WALK_STATES.WALKING) solver?.cancel?.(`the walk is ${next}`);
        state = next;
        reason = why ?? null;
        waypoints = null;
        emit(next, why);
    };

    /** The point and the teleporter (if any) the goal names in the live run, or a refusal. */
    function resolve(run) {
        if (goal.kind === 'location') {
            if (locationPointOf) {
                const p = locationPointOf(goal);
                if (!p) return { refused: `level ${goal.level} has no ${goal.entityType ?? 'apitem'} with tag ${goal.tag}` };
                return { target: p, allowTeleporter: null };
            }
            const a = apItemOf(goal.level, goal.tag);
            if (!a) return { refused: `level ${goal.level} has no apitem with tag ${goal.tag}` };
            return { target: centreOf(a.rect), allowTeleporter: null };
        }
        if (goal.kind === 'exit') {
            const tiles = goalTiles(goal);
            const hit = nearestTeleporterAt(run.world, tiles, run.state);
            if (!hit) {
                return { refused: `level ${goal.level} has no live teleporter on ${tiles.length === 1
                    ? `tile (${tiles[0][0]}, ${tiles[0][1]})` : `any of the tiles ${JSON.stringify(tiles)}`}` };
            }
            return { target: tileCentrePoint(hit.tile), allowTeleporter: hit.index };
        }
        return { target: tileCentrePoint(goal.tile), allowTeleporter: null };
    }

    function done(run) {
        if (goal.kind === 'location') return isCollected(goal.level, goal.tag);
        if (goal.kind === 'tile') {
            return run.level === goal.level && hasArrived(run.state, tileCentrePoint(goal.tile), WALK_TOLERANCE);
        }
        return false; // an exit completes on its crossing (observe)
    }

    return {
        get state() { return state; },
        get reason() { return reason; },
        get goal() { return goal ? { ...goal } : null; },
        get playing() { return playing; },
        get stats() { return { plans, driven, planError, declined, retries, retryLog: retryLog.map((r) => ({ ...r })) }; },
        /** ⛓ S1 — true when the last `heldFor` returned the solver's keys. */
        get solverDriving() { return solverDriving; },
        /** ⛓ S2 — true when the last `heldFor` HELD the tick for a solve in flight. */
        get solverHolding() { return solverHolding; },
        /** Replace the goal. `null` clears it. */
        setGoal(next) {
            goal = next ? { ...next } : null;
            waypoints = null;
            sincePlan = Infinity;
            driven = 0;
            planError = null;
            declined = null;
            retries = 0;
            sinceDecline = 0;
            retryCause = null;
            retryLog = [];
            solver?.clear();
            if (goal) settle(WALK_STATES.WAITING, null);
            else settle(WALK_STATES.IDLE, null);
        },
        play() { playing = true; },
        stop() { playing = false; stepBudget = 0; },
        /** Drive exactly the next page tick, then stand. */
        step() { stepBudget += 1; },
        reset() { playing = false; stepBudget = 0; this.setGoal(null); },
        /**
         * The keys for this tick, or null when the walker is not driving
         * (no goal, paused, settled, or the run is in another level).
         */
        heldFor(run) {
            solverDriving = false;
            solverHolding = false;
            if (!goal || !run) return null;
            if (state === WALK_STATES.DONE || state === WALK_STATES.FAILED) return null;
            if (!playing && stepBudget === 0) return null;
            if (run.level !== goal.level) {
                if (state !== WALK_STATES.WAITING) settle(WALK_STATES.WAITING, `the run is in level ${run.level}`);
                return null;
            }
            if (done(run)) { settle(WALK_STATES.DONE, null); return null; }
            const r = resolve(run);
            if (r.refused) { settle(WALK_STATES.FAILED, r.refused); return null; }
            if (state !== WALK_STATES.WALKING) settle(WALK_STATES.WALKING, null);
            if (stepBudget > 0) stepBudget -= 1;
            if (driven >= giveUpTicks) {
                settle(WALK_STATES.FAILED, `not reached within ${giveUpTicks} ticks — stalled at `
                    + `(${run.state.x}, ${run.state.y})${planError ? `; the planner said: ${planError}` : ''}`
                    + `${declined ? `; the solver declined: ${declined}` : ''}`);
                return null;
            }
            if (solver && declined !== null && retries < retryMax && solver.enabled
                && (retryCause || sinceDecline >= retryAfter)) {
                // ⛓ S2 — the decline-retry policy: a later state may solve (§1.6: W=60 refused, W=150 solved).
                retries += 1;
                const after = retryCause ?? `${sinceDecline} walked tick(s)`;
                retryLog.push({ n: retries, after, declined });
                declined = null;
                retryCause = null;
                sinceDecline = 0;
                reason = `asking the solver again (retry ${retries}/${retryMax}, after ${after})`;
                emit(WALK_STATES.WALKING, reason);
                emit('solver', reason);
            }
            if (solver && declined === null) {
                const s = solver.keysFor(run, goal, r);
                if (s?.solving) {
                    // ⛓ S2 — the room is HELD while the worker thinks: the run does not step, the give-up clock does not run.
                    solverHolding = true;
                    if (stepBudget === 0 && !playing) stepBudget = 1;
                    const note = `solving… (budget ${Math.round((solver.budgetMs ?? 0) / 100) / 10} s)`;
                    if (reason !== note) { reason = note; emit('solver', note); }
                    return null;
                }
                if (reason?.startsWith('solving…') || reason?.startsWith('asking the solver again')) {
                    reason = null;
                    if (s?.held) emit('solver', null);
                }
                if (s?.held) { driven += 1; solverDriving = true; return s.held; }
                if (s?.failed) { settle(WALK_STATES.FAILED, s.failed); return null; }
                if (s?.declined) {
                    declined = s.declined;
                    sinceDecline = 0;
                    retryCause = null;
                    // The status carries WHY the solver declined (plan §2.2 step 6) — never silently.
                    reason = `the solver declined — ${declined}; walking instead`
                        + `${retries > 0 ? ` (after ${retries} retr${retries === 1 ? 'y' : 'ies'})` : ''}`;
                    emit(WALK_STATES.WALKING, reason);
                    emit('solver', reason);
                }
            }
            driven += 1;
            if (declined !== null) sinceDecline += 1;
            if (waypoints === null || sincePlan >= replanEvery) {
                try {
                    waypoints = planWaypoints(run.world, run.state, r.target, r.allowTeleporter,
                        { ...livePerVisitOpts(run), snapStart: true });
                    planError = null;
                } catch (e) {
                    if (!(e instanceof BotDriverV2Error)) throw e;
                    // Mid-transport or a momentary overlap: keep the last plan, retry next tick.
                    planError = e.message.split('\n')[0];
                    waypoints ??= [r.target];
                }
                plans += 1;
                sincePlan = 0;
            }
            sincePlan += 1;
            const wp = waypoints.find((w) => !hasArrived(run.state, w, WALK_TOLERANCE)) ?? waypoints[waypoints.length - 1];
            return driveStepHeld(run, wp, WALK_TOLERANCE);
        },
        /** What the tick did — a crossing completes an exit goal, a check a location one. */
        observe({ crossing = null, death = null } = {}) {
            if (!goal || state !== WALK_STATES.WALKING) return;
            if (crossing && goal.kind === 'exit' && crossing.from === goal.level) {
                settle(WALK_STATES.DONE, null);
                return;
            }
            if (crossing) { waypoints = null; if (declined !== null) retryCause = 'a crossing'; return; }
            if (death) { waypoints = null; sincePlan = Infinity; if (declined !== null) retryCause = 'a death'; }
        },
        /** Exposed for the page's status line. */
        describe() {
            if (!goal) return 'bot: idle';
            const what = goal.kind === 'location' ? `apitem tag ${goal.tag}`
                : goal.kind === 'exit' ? `door (${goalTiles(goal).map((t) => t.join(', ')).join(' | ')})` : `tile (${goal.tile.join(', ')})`;
            return `bot: ${state} → ${goal.name ?? what} in level ${goal.level}${reason ? ` — ${reason}` : ''}`
                + `${playing ? '' : ' (paused)'}`;
        },
    };
}
