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

/**
 * ── THE RESPONDERS THAT PRESS THEMSELVES (R3) ─────────────────────────
 *
 * A `ShieldLock` has no button. `ShieldLock.update`
 * (`Puzzlements/ShieldLock.as:30-41`) is the whole mechanic:
 *
 *     p = collide("Player", x - 1, y) as Player;
 *     if (p && !activate && ((hasDarkShield && shieldType == 1)
 *                         || (hasShield    && shieldType == 0))) {
 *         p.y = y - originY + 7;
 *         p.directionFace = 0;
 *         p.receiveInput = false;
 *         activate = true;
 *     }
 *     activationStep();
 *
 * Three things follow, and each of them is a way the button model above
 * would have been wrong here:
 *
 * 1. **`activate` LATCHES.** `ShieldLock` forces `tSet = -2`
 *    (`ShieldLock.as:26` — R2's FORCED_TSET finding), so no `Button`'s
 *    `activateAll` ever republishes the flag and nothing sets it false.
 *    The button arm's every-tick republication, and with it the occupancy
 *    restore, is dead code for this class: once touched, the fade runs to
 *    completion whatever the player does, and the lock never closes again.
 * 2. **It WRITES THE PLAYER'S POSITION and REFUSES INPUT.** The fade is
 *    ordinary — the same 0.01 per tick as any other `Lock`, so
 *    `opensOnTick` still answers 101 — but the player cannot act for the
 *    duration. That window is the caller's problem (`levelRun`), so this
 *    module REPORTS it rather than pretending the fade is the whole story.
 * 3. **⚠ `turnOff()` RESTORES INPUT ONLY `if (p)`** — and `p` is
 *    re-collided every tick, so a player who has drifted out of the check
 *    rect by the time the fade ends is refused input FOREVER. That is a
 *    real terminal state in the game, not a modelling gap, and it is why
 *    the turn-off event carries whether the player was still there.
 *
 * ⚠ `directionFace` is deliberately absent: it selects a sprite row and
 * nothing in the observation stream can see it.
 */
export const TOUCH_RESPONDERS = Object.freeze({
    shieldlock: { as3: 'ShieldLock', src: 'Puzzlements/ShieldLock.as:30-51' },
    shieldlocknorm: { as3: 'ShieldLock', src: 'Puzzlements/ShieldLock.as:30-51' },
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
        // `touched` is the LATCHED `activate` of a touch responder — see
        // TOUCH_RESPONDERS. It is a separate field rather than a reuse of
        // `held` because `held` counts CONTINUOUS ticks and resets, which is
        // the opposite of a latch.
        byId.set(a.id, { alpha: 1, open: false, held: 0, touched: false });
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
 * ⚠ THE ORDER, CORRECTED BY THE GAME AT R3. `Game.loadlevel` adds the
 * Player at `Game.as:2040` and every scenery and puzzle entity in the loop
 * BELOW it, and `World.add` -> `addUpdate` PREPENDS — so the update list is
 * reverse add order and **a Lock updates BEFORE the Player**, reading the
 * position the previous frame left. (R2's docblock here said the opposite,
 * and no recording could tell: the player is stationary for the whole of
 * `l71-button-lock`.)
 *
 * Calling this AFTER the movement is nonetheless right, because the two
 * labellings produce the SAME STATE — "derived from the position at the end
 * of tick N" is one object whether you compute it at the bottom of tick N or
 * the top of tick N+1, and the player's sweep in tick N+1 reads it either
 * way. A caller that stepped it BEFORE the movement would open a lock a tick
 * early, in every run, forever.
 *
 * What the two labellings do NOT share is a SIDE EFFECT on the player. The
 * `snap` event below is written by the lock at the top of the next tick,
 * ahead of the player's own update, so `levelRun` defers it by one tick —
 * see `pendingSnapY`, and the recording that found it.
 *
 * `opts.inventory` is the run's item mirror, and it is REQUIRED in any level
 * holding a touch responder — see TOUCH_RESPONDERS.
 *
 * Returns the EVENTS a touch responder produced this tick (see `events`
 * below), not the state: the state is mutated in place, and returning it as
 * well would offer a caller two ways to read one thing.
 *
 * ⚠ ONE BOX FOR THE WHOLE PASS, which is a bounded imprecision the game
 * does not share. A `snap` moves the player, and in the game an entity
 * updating after the ShieldLock would collide against the NEW position. The
 * pass here uses the pre-snap box throughout, so a SECOND responder whose
 * volume the snap moves the player into or out of would be one tick late.
 * L71's other two locks are 176 px away, and it is the only touch responder
 * on any route so far; recorded rather than assumed, because "no route does
 * that yet" is how the statue got its offset wrong for two slices.
 */
export function stepActivators(state, world, playerBox, opts = {}) {
    const { inventory = null } = opts;
    const pressed = pressedGroups(world, playerBox);
    /**
     * What a touch responder DID this tick, for the caller that owns the
     * player: `{kind: 'snap'|'turnoff', id, y?, touching?}`.
     *
     * Returned rather than applied, because this module does not own the
     * player's position and a module that reached across to write it would
     * be the second copy of the world swap all over again.
     */
    const events = [];
    for (const a of world.activators) {
        const s = state.byId.get(a.id);
        if (!s) fail(`activator ${a.id} has no state — was createActivatorState called `
            + `for level ${world.level}?`);
        const responder = RESPONDERS[a.tag];
        let active;
        // `p` in the AS3: re-collided EVERY tick, which is what makes the
        // `turnOff` guard below a live question rather than a formality.
        let touching = false;
        if (TOUCH_RESPONDERS[a.tag]) {
            if (inventory === null) {
                fail(`level ${world.level} holds ${a.id}, a touch responder whose `
                    + `activation gates on \`${a.shield}\` — but stepActivators was `
                    + 'called with no inventory. Defaulting the item to false would '
                    + 'model a lock that can never open, silently, in the one level '
                    + 'where opening it is the errand.');
            }
            touching = rectsOverlap(playerBox, a.touchRect);
            if (touching && !s.touched && inventory[a.shield] === true) {
                s.touched = true;
                events.push({ kind: 'snap', id: a.id, y: a.snapY, persistTag: a.persistTag });
            }
            // ⚠ THE LATCH, not the press. Nothing republishes this flag, so
            // it stays true whatever the player does next — including
            // walking away, which for a button-lock would close it.
            active = s.touched;
        } else {
            active = a.t >= 0 && pressed.has(a.t);
        }
        if (active) {
            if (s.alpha > 0) {
                s.alpha = clampAlpha(s.alpha - responder.fade);
                // Cover tests immediately after decrementing; Lock waits
                // for the next tick to see a zero. That one tick is the
                // whole difference between opening on 11 and on 101.
                if (responder.fade === 0.1 && s.alpha <= 0) s.open = true;
            } else if (responder.fade !== 0.1) {
                s.open = true;   // Lock.turnOff()
                // ⚠ AND IT KEEPS BEING CALLED. `activate` is still true and
                // `alpha` is pinned at 0, so this branch runs on EVERY
                // subsequent tick — `Lock.turnOff`'s own `type == normType`
                // guard makes the second call a no-op, but `ShieldLock`'s
                // override does not have that guard, so its `if (p)` is
                // re-evaluated every tick. A player who missed the restore
                // and later drifts back into the rect gets input back.
                if (TOUCH_RESPONDERS[a.tag]) {
                    events.push({ kind: 'turnoff', id: a.id, touching, persistTag: a.persistTag });
                }
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
    return events;
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
