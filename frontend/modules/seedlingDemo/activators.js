/**
 * seedlingDemo/activators — buttons, locks and covers, as the game runs them.
 *
 * R2 slice 3. Brief: `CC/docs/plans/seedling-bot-r2-opus-kickoff.md` §9.1.
 *
 * ── Why this is not a crutch ──────────────────────────────────────────
 * Every other relaxation on this ladder is something a later rung has to
 * retire. This one is the opposite: it is a piece of the GAME that the
 * model did not have yet. L71's exit to Dungeon 7 is behind a `Lock` whose
 * button sits directly below it, and opening it needs nothing but standing
 * still — no item, no attack key, no flag. Modelling it adds a mechanic
 * rather than removing one, so nothing later has to undo it.
 *
 * ── The whole state machine, in the game's own order ──────────────────
 * `Button.update` (`Puzzlements/Button.as:26-38`) collides
 * `["Player", "Enemy", "Solid"]` at its own position and sets
 * `activate = anything overlaps that is not a Cover`. Its SETTER
 * (`:40-46`) then calls `activateAll(this, t, activate)`, which walks every
 * `Activators` in the world and copies the flag onto each one sharing its
 * `t`. That runs EVERY TICK, unconditionally — the flag is not latched, it
 * is republished, so it goes false the moment the player steps off.
 *
 * `Lock.activationStep` (`Puzzlements/Lock.as:63-88`) then either fades or
 * restores:
 *
 *     activate  -> alpha > 0 ? alpha -= 0.01 : turnOff()
 *     otherwise -> if (type == normType) alpha = 1
 *                  if (!collideTypes(hitables, x, y)) returnToNormal()
 *
 * ⚠ `Image.alpha` CLAMPS to [0, 1] (`graphics/Image.as:155-158`), so the
 * fade cannot go negative and the count is exact: 100 decrements to reach
 * 0, and `turnOff()` on the tick AFTER that — tick **101** of holding the
 * button. `Cover`'s fade is 0.1 per tick and it tests after decrementing
 * rather than before, so a cover opens on tick **11**. Both are
 * transcribed as repeated subtraction, never as `1 / step`: the R1 pit
 * fall's 20-tick knife-edge came from exactly that difference.
 *
 * ⚠⚠ AND THE RESTORE IS GUARDED BY OCCUPANCY. `returnToNormal()` only
 * fires when NOTHING in `hitables` overlaps the lock — so a lock cannot
 * close on the player standing in it. That is what makes the crossing
 * possible at all, because the button volume and the lock volume are
 * DISJOINT: L71's button is `[116,124) x [181,187)` and its lock is
 * `[112,128) x [160,176)`, so there is no position that touches both. The
 * player has to leave the button and enter the lock in ONE tick, and the
 * lock then holds itself open because they are inside it.
 *
 * Whether the real game agrees is not something this module can settle —
 * see the `l71-button-lock` oracle fixture.
 */

import { rectsOverlap } from './levelWorld.js';

export class ActivatorError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ActivatorError';
    }
}

const fail = (message) => { throw new ActivatorError(message); };

/**
 * How each responder class answers `activate`.
 *
 * `step` is the per-tick alpha decrement and `opensOn` is the tick of
 * continuous activation at which it stops being solid — derived here from
 * the AS3 rather than hard-coded, so the two cannot drift apart.
 *
 * ⚠ `BossLock` and `RockLock` are Activators and are NOT here. Their
 * `set activate` overrides do nothing but play a sound and store the flag
 * (`BossLock.as:49-56`, `RockLock.as:40-47`) — they open on a key or an
 * item, which is R3. `Pulser` is likewise absent: it is `type = "Solid"`
 * unconditionally and `activate` only drives its radius animation. Listing
 * them here would model an opening that does not exist.
 */
export const RESPONDERS = Object.freeze({
    lock: { as3: 'Lock', fade: 0.01, guard: 'occupancy', src: 'Puzzlements/Lock.as:63-104' },
    wandlock: { as3: 'WandLock', fade: 0.01, guard: 'occupancy', src: 'Puzzlements/Lock.as:63-104' },
    shieldlock: { as3: 'ShieldLock', fade: 0.01, guard: 'occupancy', src: 'Puzzlements/Lock.as:63-104' },
    shieldlocknorm: { as3: 'ShieldLock', fade: 0.01, guard: 'occupancy', src: 'Puzzlements/Lock.as:63-104' },
    grasslock: { as3: 'GrassLock', fade: 0.01, guard: 'occupancy', src: 'Puzzlements/Lock.as:63-104' },
    cover: { as3: 'Cover', fade: 0.1, guard: 'occupancy-unless-chest', src: 'Puzzlements/Cover.as:37-73' },
});

/** The two classes that PRESS. Both are `Activators` with a `t`. */
export const PRESSERS = Object.freeze({
    button: { as3: 'Button', src: 'Puzzlements/Button.as:26-46' },
    buttonroom: { as3: 'ButtonRoom', src: 'Puzzlements/ButtonRoom.as:60-99' },
});

/** `Image.alpha`'s setter clamps — graphics/Image.as:155-158. */
const clampAlpha = (v) => (v < 0 ? 0 : (v > 1 ? 1 : v));

/**
 * How many ticks of continuous activation a responder needs before it
 * stops being solid. Computed by running the fade, because the answer is a
 * float question and reading it off `1 / fade` gives 100 for the lock and
 * 10 for the cover — one of which is wrong.
 */
export function opensOnTick(fade) {
    let alpha = 1;
    if (fade === 0.1) {
        // Cover: decrement THEN test, with no `alpha > 0` guard.
        for (let tick = 1; tick <= 1000; tick++) {
            alpha = clampAlpha(alpha - fade);
            if (alpha <= 0) return tick;
        }
    } else {
        // Lock: test `alpha > 0` FIRST, so `turnOff` lands one tick later.
        for (let tick = 1; tick <= 1000; tick++) {
            if (alpha > 0) alpha = clampAlpha(alpha - fade);
            else return tick;
        }
    }
    return fail(`a fade of ${fade} never opens`);
}

/**
 * Per-level activator state. One entry per responder, keyed by the id
 * `levelWorld` gave it.
 *
 * `open` is the modelled `type == ""`. It starts false because every
 * responder assigns `type = normType` in its constructor.
 */
export function createActivatorState(world) {
    const byId = new Map();
    for (const a of world.activators) {
        byId.set(a.id, { alpha: 1, open: false, held: 0 });
    }
    return { byId, level: world.level };
}

/**
 * Which groups are pressed, given where the player is.
 *
 * ⚠ ONLY THE PLAYER PRESSES, in this model. The game's `hitables` is
 * `["Player", "Enemy", "Solid"]`, so an enemy or a pushed block holds a
 * button down too — and that is the intended solution to more than one
 * room (L38's `pushableblockfire` sits one tile below its button). Neither
 * enemies nor pushing is modelled at R2, and both were ruled onto the
 * blocked list rather than approximated, so this omission is the SAME
 * boundary rather than a new one.
 *
 * ⚠ A STATIC solid resting on a button would hold it forever and this
 * model would miss it. `assertNoStaticPress` is the guard, and it runs
 * over every level rather than being asserted in prose.
 */
export function pressedGroups(world, playerBox) {
    const groups = new Set();
    for (const p of world.pressers) {
        if (rectsOverlap(playerBox, p.rect)) groups.add(p.t);
    }
    return groups;
}

/**
 * One tick of the activator machinery, run AFTER the player has moved.
 *
 * The order is the game's: `World.addUpdate` PREPENDS and `loadlevel` adds
 * the Player LAST (`Game.as:2040`), so the Player updates FIRST and reads
 * the state as of the END of the previous tick. A caller that stepped this
 * before the movement would let the player walk into a lock on the tick it
 * opened, one tick early, forever.
 */
export function stepActivators(state, world, playerBox) {
    const pressed = pressedGroups(world, playerBox);
    for (const a of world.activators) {
        const s = state.byId.get(a.id);
        if (!s) fail(`activator ${a.id} has no state — was createActivatorState called `
            + `for level ${world.level}?`);
        const active = a.t >= 0 && pressed.has(a.t);
        const responder = RESPONDERS[a.tag];
        if (active) {
            if (s.alpha > 0) {
                s.alpha = clampAlpha(s.alpha - responder.fade);
                // Cover tests immediately after decrementing; Lock waits
                // for the next tick to see a zero. That one tick is the
                // whole difference between opening on 11 and on 101.
                if (responder.fade === 0.1 && s.alpha <= 0) s.open = true;
            } else if (responder.fade !== 0.1) {
                s.open = true;   // Lock.turnOff()
            }
            s.held += 1;
        } else {
            s.held = 0;
            if (!s.open) s.alpha = 1;   // `if (type == normType) alpha = 1`
            // returnToNormal / reset — BOTH are guarded by occupancy, and
            // the guard is why a crossing is possible at all.
            if (!rectsOverlap(playerBox, a.rect)) {
                s.open = false;
                s.alpha = 1;
            }
        }
    }
    return state;
}

/** The ids that are currently NOT solid. */
export function openActivatorIds(state) {
    const open = new Set();
    for (const [id, s] of state.byId) if (s.open) open.add(id);
    return open;
}

/**
 * ⚠ THE GUARD THIS MODEL NEEDS AND CANNOT DERIVE.
 *
 * `Button.update` presses on any `["Player", "Enemy", "Solid"]` overlap
 * that is not a `Cover`. This model presses only on the player, which is
 * exact only while no STATIC solid rests on a button — a wall tile, a
 * pole, a rock. If one did, that button would be held from the first frame
 * and its group would be permanently open, and the model would report the
 * lock shut for the whole run.
 *
 * Checked rather than assumed, over every level, in the test suite.
 */
export function staticPressesIn(world) {
    const hits = [];
    for (const p of world.pressers) {
        for (const s of world.solids) {
            // A Cover is explicitly excluded by the game's own loop.
            if (s.tag === 'cover') continue;
            if (rectsOverlap(s.rect, p.rect)) {
                hits.push({ presser: p, solid: s.tag, at: { x: s.x, y: s.y } });
            }
        }
    }
    return hits;
}
