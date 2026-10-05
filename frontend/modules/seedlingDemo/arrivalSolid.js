/**
 * seedlingDemo/arrivalSolid — **AN ARRIVAL WHOSE BOX IS INSIDE A SOLID, AND
 * THE SAVED FLAG THAT DECIDES WHETHER THE SOLID IS THERE** (Seedling fidelity
 * ARRIVAL, D2/D3). Pure reads of a live run; the solver's entry check
 * (`solveSegment` → `arrivalInsideSolid`) and the census/probe derivation
 * (`fidelityArrival.js`) share it.
 *
 * ⚖ The user (2026-10-05): *"Arrival inside a solid should only happen if we
 * play the game out of order. The proper fix for this might be to restart
 * using the menu, or just take a different path. The broken state of some
 * obstacles is saved in the save data."* ⇒ the model KNOWS the state (the
 * build already reads the save's persistence: a cleared flag builds no
 * solid), and the solver refuses BY NAME with the way out. Nothing here
 * swings, burns or presses from inside.
 *
 * ⛓ THE GAME'S RULE. `Entity.moveBy` sweeps a pixel at a time and stops at
 * the first `collide("Solid", x + sign, y)`, so a box that starts inside a
 * solid never takes a step in any direction. Measured on the game (p4f,
 * `probe-seedling-arrival-solid.mjs`, `fixtures/arrival-solid-oracle.json`):
 * four landings with the flag held, 0 px in each of the four holds; the same
 * landings with the flag cleared walk free. The model's stream is the game's,
 * 0 px, on every one of those arms.
 */

import { rectsOverlap } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { PROFILE } from './seedlingProfile.js';

/**
 * ⛓ WHAT WRITES EACH CLASS'S FLAG — the action that removes the solid, read
 * at the class's own `Game.setPersistence(tag, false)` (`vendor/seedling/src`).
 * `item` names the inventory flag the action needs, when one does: the
 * rules arc's input (which item opens which saved obstacle).
 */
export const FLAG_ACTIONS = Object.freeze({
    breakablerock: Object.freeze({ action: 'broken by a sword strike', item: 'hasSword',
        cite: 'Puzzlements/BreakableRock.as hit(_t) -> endAnim(): setPersistence(tag, false)' }),
    breakablerockghost: Object.freeze({ action: 'broken by a ghost-sword strike', item: 'hasGhostSword',
        cite: 'Puzzlements/BreakableRock.as hit(_t): rockType 1 <= _t' }),
    burnabletree: Object.freeze({ action: 'burned by fire', item: 'hasFire',
        cite: 'Scenery/BurnableTree.as removed(): setPersistence(tag, false)' }),
    bosslock: Object.freeze({ action: 'opened by walking its key line with the matching boss key', item: 'hasKey',
        cite: 'Puzzlements/BossLock.as update(): Player.hasKey(keyType) -> setPersistence(tag, false)' }),
    magicallock: Object.freeze({ action: 'broken by a wand shot', item: 'hasWand',
        cite: 'Puzzlements/MagicalLock.as hit(_t): lockType 0 <= _t -> setPersistence(tag, false)' }),
    magicallockfire: Object.freeze({ action: 'broken by a fire-wand shot', item: 'hasFireWand',
        cite: 'Puzzlements/MagicalLock.as hit(_t): lockType 1 <= _t' }),
    lock: Object.freeze({ action: 'opened by its activation group (turnOff)', item: null,
        cite: 'Puzzlements/Lock.as turnOff(): setPersistence(tag, false); check() needs tSet < 0' }),
    wandlock: Object.freeze({ action: 'opened by its activation group (turnOff)', item: null,
        cite: 'Puzzlements/Lock.as turnOff()' }),
    grasslock: Object.freeze({ action: 'opened by its activation group (turnOff)', item: null,
        cite: 'Puzzlements/Lock.as turnOff()' }),
    shieldlock: Object.freeze({ action: 'opened by its activation group (turnOff; ShieldLock forces tSet = -2)', item: null,
        cite: 'Puzzlements/ShieldLock.as -> Lock.as turnOff()' }),
    shieldlocknorm: Object.freeze({ action: 'opened by its activation group (turnOff)', item: null,
        cite: 'Puzzlements/ShieldLock.as -> Lock.as turnOff()' }),
    rocklock: Object.freeze({ action: 'opened by its activation group', item: null,
        cite: 'Puzzlements/RockLock.as update(): setPersistence(tag, false)' }),
    finaldoor: Object.freeze({ action: 'opened once the Watcher has spoken (its removal)', item: null,
        cite: 'Scenery/FinalDoor.as removed(): setPersistence(tag, false)' }),
    fallrock: Object.freeze({ action: 'made to FALL (a clear ADDS this solid)', item: null,
        cite: 'Scenery/FallRock.as fall(): setPersistence(tag, false); check(): false = fell' }),
    fallrocklarge: Object.freeze({ action: 'made to FALL (a clear ADDS this solid)', item: null,
        cite: 'Scenery/FallRockLarge.as' }),
});

/** A solid row's id as the solver names it (`breakablerock@288,176`). */
export const solidIdOf = (so) => so.rockId ?? so.activatorId ?? so.treeId ?? so.magicalLockId
    ?? so.finalDoorId ?? so.id ?? `${so.tag ?? 'solid'}@${so.rect.x},${so.rect.y}`;

/**
 * The persistence tag a WORLD row carries for a solid: the solid's own
 * `persistTag` (rocks, trees, magical locks), else its activator's (locks),
 * else its final door's. null when the world row carries none (a `rocklock`
 * today: the census reads it off the map instead).
 */
export function persistTagOfSolid(world, so) {
    if (Number.isInteger(so.persistTag)) return so.persistTag;
    const id = solidIdOf(so);
    const row = (world.activators ?? []).find((a) => a.id === id)
        ?? (world.finalDoors ?? []).find((f) => f.id === id)
        ?? (world.magicalLocks ?? []).find((m) => m.id === id);
    return Number.isInteger(row?.persistTag) ? row.persistTag : null;
}

/** The solids a box at (x, y) overlaps in `world` (positive area, `Entity.collide`'s test). */
export const solidsAt = (world, x, y) => {
    const box = playerBoxAt(x, y);
    return (world.solids ?? []).filter((so) => so.rect && rectsOverlap(so.rect, box));
};

/** The four cardinal holds the stuck test makes, and how long each is held. */
export const STUCK_DIRS = Object.freeze(['left', 'right', 'up', 'down']);
export const STUCK_TICKS = 30;

/**
 * The MODEL's verdict: does any cardinal hold move the box at all? The run's
 * own preview stepper (`run.previewStepper()`), so the answer is the drive's
 * physics. `moved[dir]` is the farthest |dx|,|dy| reached.
 */
export function modelStuck(run, ticks = STUCK_TICKS) {
    const moved = {};
    for (const dir of STUCK_DIRS) {
        const step = run.previewStepper();
        let st = { ...run.state };
        let far = 0;
        for (let k = 0; k < ticks; k += 1) {
            try { st = step(st, new Set([dir])); } catch { break; }
            far = Math.max(far, Math.abs(st.x - run.state.x), Math.abs(st.y - run.state.y));
            if (st.transition || st.fall) break;
        }
        moved[dir] = far;
    }
    return { stuck: Object.values(moved).every((d) => d === 0), moved };
}

/**
 * Every door in the map that lands in `level`, read through the run's own
 * world builder (`run.worldFor`, so each level is built under the run's
 * clears): `{from, door, at}` with `at` the landing in state coordinates.
 */
export function arrivalsInto(run, level, levelCount = PROFILE.levelCount) {
    const out = [];
    for (let n = 0; n < levelCount; n += 1) {
        let w;
        try { w = run.worldFor(n); } catch { continue; }
        for (const tp of w?.teleporters ?? []) {
            if (tp.to !== level || !tp.arrival) continue;
            out.push({ from: n, door: `${tp.isStairs ? 'stairs' : 'teleporter'}@${tp.x},${tp.y}`,
                at: { x: tp.arrival.x, y: tp.arrival.y } });
        }
    }
    return out;
}

/**
 * ⛓ D3 — **IS THIS RUN'S ARRIVAL INSIDE A SOLID?** null unless the box
 * overlaps a solid AND no cardinal hold moves it (`modelStuck`): a box that
 * merely grazes a solid and can walk out is not this state. Otherwise the
 * solids (each with its flag `{level, tag}` and the action that clears it)
 * and the stuck test's reading.
 */
export function arrivalInsideSolid(run) {
    const under = solidsAt(run.world, run.state.x, run.state.y);
    if (under.length === 0) return null;
    const stuck = modelStuck(run);
    if (!stuck.stuck) return null;
    const solids = under.map((so) => {
        const tag = persistTagOfSolid(run.world, so);
        const act = FLAG_ACTIONS[so.tag] ?? null;
        return {
            id: solidIdOf(so), cls: so.tag ?? null,
            flag: tag === null || tag < 0 ? null : { level: run.level, tag },
            action: act?.action ?? null, item: act?.item ?? null,
        };
    });
    return { solids, moved: stuck.moved };
}
