/**
 * seedlingDemo/tapeRunner — replay a tape through the physics and emit an
 * observation stream in exactly the shape `Bot.as` drains from the
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
 *
 * ── Which engine runs ─────────────────────────────────────────────────
 * `opts.levelSource` decides, and it is the ONE seam by which real
 * geometry enters (see `playerPhysicsV2`'s docblock for why injection
 * rather than loading):
 *
 *   without it   the v1 engine — no collision, terrain stubbed to ground.
 *                A `noclip: false` tape is REFUSED rather than run, because
 *                a stream produced without collision disagrees with the
 *                game for a reason the differential would misattribute to
 *                physics.
 *   with it      the v2 engine — the level's real solids and its real,
 *                sticky `getState`, with the sweep's collision test on or
 *                off exactly as the tape's `noclip` flag says.
 *
 * The v1 fixtures are run BOTH ways by `tapeRunner.test.js`: without a
 * source they are the byte-identical regression net for the v2 refactor,
 * and with one they are 220 further ticks of real routes over which the
 * new terrain resolver has to agree with the recordings too.
 */

import { heldKeysAt, parseTape } from './tapeFormat.js';
import { buildLevelWorld } from './levelWorld.js';
import { groundTerrain, spawnFromBoot, step as stepV1 } from './playerPhysicsV1.js';
import { INITIAL_TERRAIN_STATE, step as stepV2 } from './playerPhysicsV2.js';

/**
 * Run `tape` through the physics.
 *
 * @param {object|string} tape        tape object or JSON (re-validated here)
 * @param {object}  [opts]
 * @param {Function} [opts.levelSource]     `(level) => levelRecord`; selects the
 *                                    v2 engine (see the docblock above)
 * @param {Function} [opts.terrainStateAt]  v1-engine terrain probe (default: ground)
 * @param {Function} [opts.onTick]    called as (t, state, held) after each
 *                                    observation is recorded — for tests and
 *                                    the bot driver, never for control flow
 * @returns {{ticks: Array, transitions: Array, final: object}}
 *   `ticks` is the observation stream; `final` is the full physics state
 *   (including velocity and the sticky terrain state, neither of which the
 *   game exposes and the stream therefore cannot carry).
 */
export function runTape(tape, opts = {}) {
    const t = parseTape(tape);
    const { terrainStateAt = groundTerrain, onTick, levelSource } = opts;

    if (!t.noclip && !levelSource) {
        throw new Error(
            'runTape: the tape has noclip=false and no opts.levelSource was given, '
            + 'so there is no collision geometry to run it against. Collision is the '
            + 'v2 rung — running it on the v1 engine would produce a stream that '
            + 'disagrees with the game for a reason the differential would '
            + 'misattribute to physics. Pass a levelSource (node: '
            + "`atlasLevelSource()` from ./levelSource.js).",
        );
    }

    // Worlds are built lazily and memoised: `buildLevelWorld` throws by name
    // on geometry v2 does not model, and that should fire when a run walks
    // INTO the level, not eagerly for levels it never visits.
    const worlds = new Map();
    const worldFor = (level) => {
        if (!worlds.has(level)) worlds.set(level, buildLevelWorld(levelSource(level)));
        return worlds.get(level);
    };

    // The entity spawns half a tile in from the constructor args
    // (Player.as:357) — see SPAWN_OFFSET.
    const spawn = spawnFromBoot(t.boot);
    let state = {
        x: spawn.x, y: spawn.y, vx: 0, vy: 0, terrain: INITIAL_TERRAIN_STATE,
    };
    const ticks = [];

    // <= tick_count: the final iteration records the last tick's result
    // without dispatching anything, mirroring the bot's disarm tick.
    for (let tick = 0; tick <= t.tick_count; tick++) {
        ticks.push({ t: tick, x: state.x, y: state.y, level: t.boot.level });
        if (onTick) onTick(tick, state, heldKeysAt(t, tick));
        if (tick === t.tick_count) break;
        const held = heldKeysAt(t, tick);
        state = levelSource
            ? stepV2(state, held, {
                level: worldFor(t.boot.level),
                noclip: t.noclip,
                // The world's first LIVE tick, when no Tile has run its own
                // first update yet and so no tile is solid. `blackCover`
                // frames are dead frames on both sides and update nothing,
                // so tape tick 0 IS that first live tick.
                beforeTypeFlip: tick === 0,
            })
            : stepV1(state, held, { terrainStateAt });
    }

    return {
        ticks,
        // Still empty at slice 2: `playerPhysicsV2` THROWS on a teleporter
        // overlap rather than modelling the swap. Slice 3 fills this in
        // (`{t, from_level, to_level}` per §1 ruling 2), derived from the
        // engine's OWN world swap — never re-derived from the level field,
        // or the differential degenerates into diffing the tick stream
        // against itself.
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
