/**
 * seedlingDemo/fidelityStepOff — **ONE DERIVATION OF THE STEP-OFF ARMS**,
 * shared by the game probe (`scripts/procgen/probe-seedling-stepoff.mjs`) and
 * the node rows (`fidelityStepOff.test.js`), so the tape the game played and
 * the tape the rows replay are one tape.
 *
 * ⛓ THE GAME'S RULE (`Teleporter.as`; `Stairs.update()` is `super.update()`,
 * so stairs and teleporters share it):
 *
 *     check():  if (collide("Player", x, y)) playerTouching = true;   // the new Game's FIRST frame
 *     update(): checkDeactivated(); if (deactivated) return;
 *               if (collide("Player", x, y)) { if (!playerTouching) FP.world = new Game(to, …); }
 *               else playerTouching = false;
 *
 * `Game.update` runs `check()` on every entity once, on the world's first
 * frame, above the `blackCover` gate (`Game.as`'s `!checked` latch). So an
 * arrival (a boot, a crossing, a respawn: every one is a `new Game`) whose
 * player box overlaps a door's 16x16 hitbox pre-latches that door. "Stepped
 * off" is ONE `update()` of the door on which the box does not overlap its
 * rect (positive-area `Rectangle.intersects`; the door updates before the
 * player, so it reads the position the previous tick left). The next overlap
 * fires. Nothing else resets the flag. The model carries it as
 * `playerPhysicsV2.initialLatch` / `updateTeleporters` (`state.latched`).
 *
 * An ARM boots ON a door with a fresh JS-runtime staging and either stands
 * (`n = null`) or holds `dir` for `n` ticks and then the opposite way for
 * `RETURN_TICKS`. `n = nMin - 1` never clears the latch on the way out; `n =
 * nMin` clears it, and the way back fires the door.
 */

import { ITEM_PROPERTIES, parseTape } from './tapeFormat.js';
import { JS_RUNTIME_PINS } from './jsRuntimeCore.js';
import { bootStaging } from './procgenOracle.js';
import { buildStagedTape } from './botDriverV1.js';
import { createRunForStaging } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';
import { atlasLevelSource } from './levelSource.js';

/** Every boolean item flag false: the JS runtime's fresh boot (`seam.items` holds the booleans only). */
const BASE_FLAGS = Object.freeze(Object.fromEntries(Object.values(ITEM_PROPERTIES)
    .filter((s) => s.kind !== 'add').map((s) => [s.property, false])));

/** The staging a fresh JS-runtime boot at `{level, x, y}` carries. */
export const stepOffStagingAt = ({ level, x, y }) => bootStaging({
    boot: { level, x, y }, items: { ...BASE_FLAGS }, pins: [...JS_RUNTIME_PINS],
});

/** How long a stand arm stands, and how long an arm walks back. */
export const STAND_TICKS = 60;
export const RETURN_TICKS = 40;

const OPPOSITE = Object.freeze({ right: 'left', left: 'right', up: 'down', down: 'up' });

/**
 * The doors the arms boot on. `nMin` is the model's least hold that clears the
 * latch (measured by `fidelityStepOff.test.js`, held to the game by the probe).
 *   · L87 `teleporter@432,304` -> L88 and L106 `teleporter@64,48` -> L101: two
 *     `crosses` rows of `jsRuntimeArrivalOnDoor`'s ARRIVALS_ON_A_DOOR, at the
 *     arrival's own spawn.
 *   · L17 `stairsup@32,48` -> L16: STAIRS. No vanilla arrival lands on a stairs
 *     door the bot can step off (L37's is ringed by lava), so this arm boots on
 *     it: a boot is a `new Game`, the same first frame an arrival has.
 */
export const STEPOFF_DOORS = Object.freeze([
    Object.freeze({ door: 'L87-teleporter', boot: { level: 87, x: 432, y: 304 }, exit: { x: 432, y: 304 }, stairs: false, dir: 'up', nMin: 10 }),
    Object.freeze({ door: 'L106-teleporter', boot: { level: 106, x: 64, y: 48 }, exit: { x: 64, y: 48 }, stairs: false, dir: 'left', nMin: 9 }),
    Object.freeze({ door: 'L17-stairs', boot: { level: 17, x: 32, y: 48 }, exit: { x: 32, y: 48 }, stairs: true, dir: 'up', nMin: 10 }),
]);

/** The arm's tape: stand (`n = null`) or `dir` for `n` ticks, then back. */
export function stepOffArmTape(door, n) {
    const stand = n === null;
    const inputs = stand ? [] : [
        { key: door.dir, from: 0, to: n },
        { key: OPPOSITE[door.dir], from: n, to: n + RETURN_TICKS },
    ];
    return parseTape({
        tape_version: 8,
        game: 'seedling',
        name: `stepoff-${door.door}-${stand ? 'stand' : `n${n}`}`,
        ...stepOffStagingAt(door.boot),
        tick_count: stand ? STAND_TICKS : n + RETURN_TICKS,
        inputs,
    });
}

/** Every arm: per door, STAND, SHORT (`nMin - 1`) and MIN (`nMin`). */
export function stepOffArms() {
    const out = [];
    for (const d of STEPOFF_DOORS) {
        out.push({ arm: `${d.door}-STAND`, door: d, n: null, tape: stepOffArmTape(d, null),
            expect: { crosses: false, why: 'standing on the arrival door never crosses' } });
        out.push({ arm: `${d.door}-SHORT`, door: d, n: d.nMin - 1, tape: stepOffArmTape(d, d.nMin - 1),
            expect: { crosses: false, why: `${d.nMin - 1} tick(s) away never leaves the rect: no crossing` } });
        out.push({ arm: `${d.door}-MIN`, door: d, n: d.nMin, tape: stepOffArmTape(d, d.nMin),
            expect: { crosses: true, why: `${d.nMin} tick(s) away leaves the rect: the way back crosses` } });
    }
    return out;
}

/** A stream as compact rows `[t, level, x, y]` (the oracle's shape). */
export const compactTicks = (ticks) => ticks.map((o) => [o.t, o.level, o.x, o.y]);

/**
 * D3 — the solver's own `reach-exit` from the arrival on each door: the plan's
 * key sets as a tape (`buildStagedTape`), so the game plays exactly what the
 * solver chose. `out` carries the solve (its `records[0].stepOff` names the
 * step-off cell and its ticks).
 */
export function stepOffSolverArm(door, levelSource) {
    const staging = stepOffStagingAt(door.boot);
    const run = createRunForStaging(staging, levelSource);
    const out = solveSegment({
        run, goals: [{ kind: 'reach-exit', exit: { ...door.exit } }],
        name: `stepoff-solver-${door.door}`, boot: { ...door.boot },
    });
    const tape = parseTape(buildStagedTape({ staging, perTick: out.perTick, name: `stepoff-solver-${door.door}` }));
    return { arm: `SOLVER-${door.door}`, door, n: null, tape, out,
        expect: { crosses: true, why: 'the solver\'s step-off plan crosses' } };
}

/** Every D3 arm (one per door). */
export function stepOffSolverArms(levelSource = atlasLevelSource()) {
    return STEPOFF_DOORS.map((d) => stepOffSolverArm(d, levelSource));
}
