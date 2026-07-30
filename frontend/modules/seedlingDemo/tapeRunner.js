/**
 * seedlingDemo/tapeRunner — replay a tape through the v1 physics and emit
 * an observation stream in exactly the shape `Bot.as` drains from the
 * recompiled game.
 *
 * The whole point is that this function and the AS3 bot's armed loop are
 * the same algorithm written twice, so the differential compares physics
 * rather than bookkeeping. The bookkeeping rule is RECORD-THEN-ACT (see
 * `tapeFormat.js`): the AS3 hook sits at the top of `Main.update()`,
 * before `super.update()` runs this tick's movement, so it records the
 * state it can see — which is the result of the PREVIOUS tick — and then
 * dispatches this tick's key edges.
 *
 * Consequence, and the easiest off-by-one in the arc: observation `t` is
 * the state after exactly `t` completed movement ticks. `ticks[0]` is the
 * boot position under no input, and an N-tick tape yields N+1
 * observations (0..N inclusive) — the last one being the only place the
 * final tick's movement is visible.
 */

import { heldKeysAt, parseTape } from './tapeFormat.js';
import { groundTerrain, spawnFromBoot, step } from './playerPhysicsV1.js';

/**
 * Run `tape` through the v1 physics.
 *
 * @param {object|string} tape        tape object or JSON (re-validated here)
 * @param {object}  [opts]
 * @param {Function} [opts.terrainStateAt]  terrain probe (default: ground)
 * @param {Function} [opts.onTick]    called as (t, state, held) after each
 *                                    observation is recorded — for tests and
 *                                    the bot driver, never for control flow
 * @returns {{ticks: Array, transitions: Array, final: object}}
 *   `ticks` is the observation stream; `final` is the full physics state
 *   (including velocity, which the game does not expose and the stream
 *   therefore cannot carry).
 */
export function runTape(tape, opts = {}) {
    const t = parseTape(tape);
    const { terrainStateAt = groundTerrain, onTick } = opts;

    if (!t.noclip) {
        // v1 has no collision model at all, so a collision tape would be
        // silently wrong rather than unsupported. Fail loudly instead.
        throw new Error(
            'runTape: this is the v1 (noclip) engine and the tape has '
            + 'noclip=false. Collision is the v2 rung — running it here would '
            + 'produce a stream that disagrees with the game for a reason the '
            + 'differential would misattribute to physics.',
        );
    }

    // The entity spawns half a tile in from the constructor args
    // (Player.as:357) — see SPAWN_OFFSET.
    const spawn = spawnFromBoot(t.boot);
    let state = { x: spawn.x, y: spawn.y, vx: 0, vy: 0 };
    const ticks = [];

    // <= tick_count: the final iteration records the last tick's result
    // without dispatching anything, mirroring the bot's disarm tick.
    for (let tick = 0; tick <= t.tick_count; tick++) {
        ticks.push({ t: tick, x: state.x, y: state.y, level: t.boot.level });
        if (onTick) onTick(tick, state, heldKeysAt(t, tick));
        if (tick === t.tick_count) break;
        state = step(state, heldKeysAt(t, tick), { terrainStateAt });
    }

    return {
        ticks,
        // Empty at the v1 rung (single level, no room loads). The field
        // exists now so the format does not churn when v2 crosses levels.
        transitions: [],
        final: state,
    };
}

/**
 * The observation stream alone, for direct comparison against a committed
 * oracle recording.
 */
export function runTapeToStream(tape, opts = {}) {
    const { ticks, transitions } = runTape(tape, opts);
    return { ticks, transitions };
}
