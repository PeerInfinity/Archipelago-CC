/**
 * seedlingDemo/levelRun — ONE run of the v2 engine across levels, with the
 * end-of-tick world swap in it.
 *
 * v2 slice 4. This is a factoring, not a new mechanism: every line below
 * was `tapeRunner`'s loop, and it moved here the moment a SECOND caller
 * appeared. `botDriverV2` has to advance the same physics through the same
 * transitions while CHOOSING each tick's keys instead of reading them off a
 * tape, and the two ways of getting a held-key set must not each grow their
 * own idea of what a world swap is.
 *
 * That is not a tidiness argument. The swap is five coupled facts — the
 * arrival offset, the zeroed velocity, the reset terrain state, the
 * pre-armed latch, and the destination world's own `beforeTypeFlip` tick —
 * and a second copy would agree with the first exactly until one of them
 * was edited. The differential could not catch it either, because the
 * driver's copy is what SYNTHESIZES the tape the differential then runs
 * through the runner's copy: they would be wrong together and the tape
 * would still reconcile. (The same failure mode as a verifier sharing the
 * generator's assumptions, and the same fix — one implementation.)
 *
 * ── What this owns, and what it does not ──────────────────────────────
 * It owns: which level we are in, that level's world, the physics state,
 * the latch, the `beforeTypeFlip` flag, the transition log, and the count
 * of completed ticks. It does NOT own the observation stream — that is
 * RECORD-THEN-ACT bookkeeping and belongs to whoever is recording (see
 * `tapeRunner`), because "record the state, then advance" is a rule about
 * the AS3 hook's position, not about the engine.
 *
 * Worlds are built lazily and memoised, for the reason `playerPhysicsV2`'s
 * docblock gives: `buildLevelWorld` throws by name on geometry v2 does not
 * model, and that throw should fire when a run walks INTO a level, naming
 * it, rather than eagerly for all 116.
 */

import { buildLevelWorld } from './levelWorld.js';
import { spawnFromBoot } from './playerPhysicsV1.js';
import {
    INITIAL_TERRAIN_STATE,
    arriveIn,
    initialLatch,
    step as stepV2,
} from './playerPhysicsV2.js';

/**
 * Start a run at `boot`, in the level the boot names.
 *
 * @param {object}   opts
 * @param {Function} opts.levelSource  `(level) => levelRecord` — the ONE seam
 *                                     by which real geometry enters
 * @param {object}   opts.boot         `{level, x, y}` GAME CONSTRUCTOR args;
 *                                     the half-tile spawn offset is applied here
 * @param {boolean}  opts.noclip       the tape's flag: picks the arm of the AS3's
 *                                     `Bot.noclip ? null : collideTypes(...)`
 * @returns {{
 *   level: number, world: object, state: object, transitions: Array,
 *   ticksCompleted: number, advance: (held: Set<string>) => object,
 * }} a live view — `level`/`state`/... are getters over the run's own state,
 *    so a caller may hold the object and read fields after each `advance`.
 */
export function createLevelRun({ levelSource, boot, noclip = false }) {
    if (typeof levelSource !== 'function') {
        throw new TypeError('createLevelRun needs a levelSource (level) => levelRecord');
    }

    const worlds = new Map();
    const worldFor = (n) => {
        if (!worlds.has(n)) worlds.set(n, buildLevelWorld(levelSource(n)));
        return worlds.get(n);
    };

    let level = boot.level;
    let world = worldFor(level);
    const spawn = spawnFromBoot(boot);
    let state = {
        x: spawn.x,
        y: spawn.y,
        vx: 0,
        vy: 0,
        terrain: INITIAL_TERRAIN_STATE,
        // The boot `Game` arms the latch on its first frame exactly as an
        // arrival does (`Game.as:803-812` runs `check()` above the
        // blackCover gate), so a spawn that sits on a teleporter does not
        // immediately fall through it.
        latched: initialLatch(world, spawn.x, spawn.y),
        hitX: null,
        hitY: null,
    };
    // The world's first LIVE tick, when no Tile has run its own first
    // update yet and so no tile is solid. `blackCover` frames update
    // nothing, so tick 0 is that tick for the boot world — and the tick
    // after an arrival is that tick for the destination world, for exactly
    // the same reason. It is per WORLD, not per run.
    let firstTickInWorld = true;
    let ticksCompleted = 0;
    const transitions = [];

    return {
        get level() { return level; },
        get world() { return world; },
        get state() { return state; },
        get transitions() { return transitions; },
        get ticksCompleted() { return ticksCompleted; },
        /** Build (and memoise) another level's world — for planning ahead. */
        worldFor,

        /**
         * Run one tick with `held` down, applying the end-of-tick swap if a
         * teleporter fired.
         *
         * Returns `{transition, hitX, hitY}` for this tick: `transition` is
         * the `{t, from_level, to_level}` record that was just appended (or
         * null), and the two hits are the sweep results the AS3 caller
         * discards — the driver needs them to tell "walked the whole way"
         * from "stopped early", which is the difference between a plan that
         * worked and a planner bug.
         *
         * ⚠ On a transition the returned `hitX`/`hitY` are the OLD player's,
         * from the last doomed step it completes in the old level before the
         * swap. That step is never observed; the hits are reported anyway
         * rather than swallowed, because a caller that wants to ignore them
         * can, and one that wants them cannot get them back.
         */
        advance(held) {
            const next = stepV2(state, held, {
                level: world,
                noclip,
                beforeTypeFlip: firstTickInWorld,
            });
            ticksCompleted++;
            const hits = { hitX: next.hitX, hitY: next.hitY };

            if (!next.transition) {
                state = next;
                firstTickInWorld = false;
                return { transition: null, ...hits };
            }

            // End-of-tick: `Engine.checkWorld` swaps only after the whole
            // tick has run, so `next` is the old player's last (never
            // observed) position and the state that survives is the arrival.
            // `ticksCompleted` is now "the number of completed movement
            // ticks", which is exactly the index of the first observation
            // showing the new level — the §1 ruling 2 definition of `t`.
            const record = {
                t: ticksCompleted,
                from_level: next.transition.from_level,
                to_level: next.transition.to_level,
            };
            transitions.push(record);
            level = next.transition.to_level;
            world = worldFor(level);
            state = arriveIn(world, next.transition.teleporter);
            firstTickInWorld = true;
            return { transition: record, ...hits };
        },
    };
}
