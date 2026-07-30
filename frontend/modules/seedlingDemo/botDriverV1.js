/**
 * seedlingDemo/botDriverV1 — synthesize an input tape that walks the
 * player to a list of targets, at the v1 rung (noclip, one level).
 *
 * ── Why this plans by SIMULATING rather than by solving ───────────────
 * The obvious approach — compute a hold length analytically from the
 * distance — founders on the physics: velocity is not proportional to
 * anything convenient. `Player.input()` overshoots its own speed cap
 * (threshold test, full-magnitude add), so holding a direction produces a
 * ~3-tick limit cycle peaking near 2x `moveSpeed`, and friction is
 * vector-length based, so the two axes are coupled whenever both move.
 * A closed-form solution would be a second model of the physics, free to
 * drift from the first.
 *
 * So the driver runs the REAL physics module in a loop, choosing each
 * tick's held keys greedily, and emits the resulting hold spans as the
 * tape. The physics has exactly one implementation, and the tape is the
 * artifact — which is also what makes the verification honest: the tests
 * re-run the emitted tape through `runTape` independently and check the
 * arrivals, rather than trusting the planner's own running state.
 *
 * ── The braking rule ──────────────────────────────────────────────────
 * Each tick, per axis: hold toward the target if releasing now would stop
 * SHORT of it, otherwise release and coast. "Would stop short" is itself
 * computed by simulating friction-only decay with the real
 * `applyFriction`, so the axis coupling is handled exactly rather than
 * approximated.
 *
 * ── Reachable precision ───────────────────────────────────────────────
 * Movement is quantized by the fact that the player cannot stop instantly.
 * The smallest possible excursion is a single 1-tick tap from rest, which
 * travels 0.8 + 0.55 + 0.30 + 0.05 = 1.70px before friction snaps the
 * velocity to zero. Stopping positions are therefore ~1.70px apart in the
 * worst case, so the tightest *always*-achievable arrival tolerance is
 * half that. DEFAULT_TOLERANCE is 1.0px, comfortably above 0.85.
 */

import { serializeTape, TAPE_VERSION } from './tapeFormat.js';
import {
    applyFriction,
    DEFAULT_FRICTION,
    groundTerrain,
    step,
} from './playerPhysicsV1.js';

/** See the precision note above: 1.70px quantum → 0.85 worst case. */
export const DEFAULT_TOLERANCE = 1.0;

/** Per-target tick budget. Crossing the 160px world takes well under this. */
export const DEFAULT_MAX_TICKS_PER_TARGET = 400;

/**
 * Displacement the player would still travel if all keys were released
 * now — i.e. friction-only decay to a full stop.
 *
 * Uses the real `applyFriction`, so the vector coupling between axes is
 * exact rather than modelled per-axis. Mirrors the tick order: friction
 * runs BEFORE the move, so each tick contributes its POST-friction
 * velocity.
 */
export function coastDistance(vx, vy) {
    let v = { x: vx, y: vy };
    let dx = 0;
    let dy = 0;
    // The snap-to-zero below 0.05 guarantees termination; the guard is a
    // tripwire for a physics change that breaks that, not flow control.
    for (let i = 0; i < 1000; i++) {
        if (v.x === 0 && v.y === 0) return { dx, dy };
        v = applyFriction(v, DEFAULT_FRICTION);
        dx += v.x;
        dy += v.y;
    }
    throw new Error('coastDistance did not converge — friction no longer snaps to zero?');
}

/** Which keys to hold this tick to approach `target` from `state`. */
function chooseHeld(state, target, tolerance) {
    const held = new Set();
    const coast = coastDistance(state.vx, state.vy);

    const dx = target.x - state.x;
    if (Math.abs(dx) > tolerance) {
        // Hold only if coasting from here would leave us short of the
        // target on this axis; otherwise release and let friction land it.
        const remainingAfterCoast = dx - coast.dx;
        if (remainingAfterCoast > 0) held.add('right');
        else if (remainingAfterCoast < 0) held.add('left');
    }

    const dy = target.y - state.y;
    if (Math.abs(dy) > tolerance) {
        const remainingAfterCoast = dy - coast.dy;
        if (remainingAfterCoast > 0) held.add('down');
        else if (remainingAfterCoast < 0) held.add('up');
    }

    return held;
}

function arrived(state, target, tolerance) {
    return Math.abs(target.x - state.x) <= tolerance
        && Math.abs(target.y - state.y) <= tolerance
        // Require a full stop: an "arrival" while still moving would be a
        // position the very next tick invalidates, which is not a place the
        // bot can be said to have reached.
        && state.vx === 0
        && state.vy === 0;
}

/**
 * Plan a tape that visits `targets` in order.
 *
 * @param {Array<{x:number,y:number}>} targets
 * @param {object}  [opts]
 * @param {object}  [opts.boot]      `{level, x, y}` (default level 0 @ 80,128 —
 *                                   the skip-splash spawn the bot build boots to)
 * @param {number}  [opts.tolerance]
 * @param {number}  [opts.maxTicksPerTarget]
 * @param {Function}[opts.terrainStateAt]
 * @param {string}  [opts.name]
 * @returns {{tape: object, arrivals: Array<{index:number,target:object,tick:number,x:number,y:number}>}}
 */
export function synthesizeTape(targets, opts = {}) {
    if (!Array.isArray(targets) || targets.length === 0) {
        throw new Error('synthesizeTape: targets must be a non-empty array');
    }
    const {
        boot = { level: 0, x: 80, y: 128 },
        tolerance = DEFAULT_TOLERANCE,
        maxTicksPerTarget = DEFAULT_MAX_TICKS_PER_TARGET,
        terrainStateAt = groundTerrain,
        name,
    } = opts;

    targets.forEach((target, i) => {
        if (!Number.isFinite(target?.x) || !Number.isFinite(target?.y)) {
            throw new Error(`synthesizeTape: targets[${i}] must be {x, y} finite numbers`);
        }
    });

    let state = { x: boot.x, y: boot.y, vx: 0, vy: 0 };
    /** @type {Array<Set<string>>} held-key set per tick */
    const perTick = [];
    const arrivals = [];

    targets.forEach((target, index) => {
        let ticksForThisTarget = 0;
        while (!arrived(state, target, tolerance)) {
            if (ticksForThisTarget >= maxTicksPerTarget) {
                throw new Error(
                    `synthesizeTape: target ${index} (${target.x},${target.y}) not reached `
                    + `within ${maxTicksPerTarget} ticks; stalled at `
                    + `(${state.x},${state.y}) v=(${state.vx},${state.vy}). `
                    + 'A target outside the world clamp bounds is the usual cause.',
                );
            }
            const held = chooseHeld(state, target, tolerance);
            perTick.push(held);
            state = step(state, held, { terrainStateAt });
            ticksForThisTarget++;
        }
        // Record-then-act indexing: after N recorded ticks the player has
        // completed N movement ticks, so the arrival observation is at
        // index perTick.length.
        arrivals.push({
            index,
            target: { x: target.x, y: target.y },
            tick: perTick.length,
            x: state.x,
            y: state.y,
        });
    });

    return {
        tape: buildTape(perTick, boot, name),
        arrivals,
    };
}

/**
 * Fold a per-tick held-key log into hold spans.
 *
 * Exported because it is the inverse of `heldKeysAt` and the round-trip
 * (`perTick → spans → heldKeysAt`) is worth pinning in tests: an
 * off-by-one here would produce a tape that no longer means what the
 * planner simulated, and the game would be the first to notice.
 */
export function buildTape(perTick, boot = { level: 0, x: 80, y: 128 }, name) {
    const open = new Map();   // key → span start tick
    const inputs = [];

    perTick.forEach((held, tick) => {
        for (const key of held) {
            if (!open.has(key)) open.set(key, tick);
        }
        for (const [key, from] of [...open.entries()]) {
            if (!held.has(key)) {
                inputs.push({ key, from, to: tick });
                open.delete(key);
            }
        }
    });
    for (const [key, from] of open.entries()) {
        inputs.push({ key, from, to: perTick.length });
    }

    return {
        tape_version: TAPE_VERSION,
        game: 'seedling',
        ...(name ? { name } : {}),
        boot: { level: boot.level, x: boot.x, y: boot.y },
        noclip: true,
        tick_count: perTick.length,
        inputs,
    };
}

/** Convenience: synthesize and serialize in one step. */
export function synthesizeTapeJson(targets, opts = {}) {
    return serializeTape(synthesizeTape(targets, opts).tape);
}
