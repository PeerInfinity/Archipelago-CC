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
 * @param {object} [opts]
 */
export function createRuntimeWalker({ apItemOf, locationPointOf = null, isCollected, onEvent = () => {} } = {}, {
    replanEvery = REPLAN_EVERY, giveUpTicks = WALK_GIVE_UP_TICKS,
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

    const emit = (type, message) => {
        try { onEvent({ type, state, goal: goal ? { ...goal } : null, message }); } catch { /* a listener's bug is not the walk's */ }
    };
    const settle = (next, why) => {
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
        get stats() { return { plans, driven, planError }; },
        /** Replace the goal. `null` clears it. */
        setGoal(next) {
            goal = next ? { ...next } : null;
            waypoints = null;
            sincePlan = Infinity;
            driven = 0;
            planError = null;
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
                    + `(${run.state.x}, ${run.state.y})${planError ? `; the planner said: ${planError}` : ''}`);
                return null;
            }
            driven += 1;
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
            if (crossing) { waypoints = null; return; }
            if (death) { waypoints = null; sincePlan = Infinity; }
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
