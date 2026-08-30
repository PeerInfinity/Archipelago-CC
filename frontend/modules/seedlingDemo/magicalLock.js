/**
 * `magicalLock.js` — THE LOCK ONLY A WAND OPENS.
 *
 * Region-atlas Phase 8, rung **R6, slice 2**. `MagicalLock` has been a
 * `levelWorld` census row (a 16x16 `"Solid"`) since R2 and a persistence
 * responder (`'despawn'`) since R4 — what it has never had is the arm that
 * OPENS it, because nothing in the model could fire a `WandShot`.
 *
 * Source: `Puzzlements/MagicalLock.as` (whole class, 78 lines),
 * `Game.as:2148-2149` (the two constructions), `:1818-1826`
 * (`checkPersistence` / `setPersistence`),
 * `net/flashpunk/graphics/Spritemap.as:70-101,111-140,182-190`.
 *
 * ── ⛔ `lockType <= shotType`, AND THE COMPARISON IS THE WHOLE ARM ─────
 *
 * ```
 *   public function hit(_t:int):void {
 *       if (lockType <= _t) { …playSound; Game.setPersistence(tag, false);
 *                             (graphic as Spritemap).play("destroy"); }
 *   }
 * ```
 *
 * ⇒ a PLAIN wand (`shotType` 0) opens a `magicallock` (`lockType` 0) and
 * NOT a `magicallockfire` (`lockType` 1); the FireWand (`shotType` 1) opens
 * both. Two tags, one class, one `<=`. `magicalLockOpens` is that line and
 * `MAGICAL_LOCK_MATRIX` is its four cases as data, because a `<=` written
 * as a `==` passes three of the four.
 *
 * ── ⛔⛔ THE TAG WRITE IS `false`, AND THE DESPAWN IS ON THE NEXT BOOT ─
 *
 * `Game.setPersistence(tag, false)` — the persistence for this lock's tag
 * goes FALSE, and `check()` is `if (tag >= 0 && !Game.checkPersistence(tag))
 * FP.world.remove(this)`. So the flag's polarity is the reverse of a boss
 * tag's: a `{43,5}` is SET when the boss dies, and a magical lock's tag is
 * CLEARED when the lock breaks. A ledger that read them the same way would
 * report the lock as un-opened for ever.
 *
 * ⛓ AND THE TWO REMOVALS ARE INDEPENDENT. Within the visit the lock leaves
 * on its own `animEnd` (`FP.world.remove`), 15 updates after the hit; on
 * every LATER `new Game` it never gets added, via `check()`. `levelWorld`'s
 * `PERSISTENCE_RESPONSE.magicallock = 'despawn'` is the second half and was
 * already right — this module owns the first.
 *
 * ── ⛓⛓ IT IS SOLID FOR THE WHOLE DESTROY ANIMATION ────────────────────
 *
 * `hit()` plays an animation and writes a flag; it does NOT touch `type`,
 * `collidable` or the hitbox. `type` stays `"Solid"` until the entity is
 * removed. ⇒ the cell opens **15 updates after the shot lands**, not on
 * the landing tick — the `BurnableTree` lesson (§R5 slice 12: *"a set keyed
 * on the PRESS tick would open a 2x2 cell forty-one ticks early"*) with a
 * different number. `MAGICAL_LOCK_DESTROY_UPDATES` is derived, never
 * divided.
 *
 * ⚠ AND `add("destroy", …)` TAKES THE DEFAULT `loop = true`, so the
 * callback is a WRAP rather than a completion. It fires once and removes
 * the entity, so the difference is invisible — named because the two paths
 * through `Spritemap.update` differ by one `break` and the derivation has
 * to pick one.
 *
 * ── ⛓ THE RENDER-SIDE FRAME WRITE IS INERT ONCE IT IS HIT ─────────────
 *
 * `render()` is `if (currentAnim != "destroy") frame = Game.worldFrame(3)`,
 * and `Spritemap.set frame` NULLS `_anim`. Before the hit `_anim` is
 * already null (nothing ever `play()`s the idle), so the write changes
 * nothing but the displayed frame; after the hit the guard skips it and the
 * destroy animation survives. A model that missed the guard would have the
 * lock cancel its own death every render.
 */

import { FP_MAX_ELAPSED } from './breakableRocks.js';

export class MagicalLockError extends Error {
    constructor(message) { super(message); this.name = 'MagicalLockError'; }
}
const fail = (m) => { throw new MagicalLockError(m); };

/**
 * The two `.oel` tags and the `_type` each is constructed with
 * (`Game.as:2148-2149`).
 */
export const MAGICAL_LOCK_TYPES = Object.freeze({
    magicallock: 0,
    magicallockfire: 1,
});

/** `WandShot`'s own `shotType`, by wand (`Projectiles/WandShot.as:29,58`). */
export const WAND_SHOT_TYPES = Object.freeze({ wand: 0, firewand: 1 });

/**
 * Geometry, from `super(_x + Tile.w/2, _y + Tile.h/2)` + `setHitbox(16, 16,
 * 8, 8)` — the same cell `levelWorld`'s census row already carries, stated
 * here so the two can be asserted equal rather than kept in step by hand.
 */
export const MAGICAL_LOCK_GEOMETRY = Object.freeze({
    dx: 8, dy: 8, w: 16, h: 16, originX: 8, originY: 8, type: 'Solid',
});

/** `Spritemap.add("destroy", [3,4,5,6,7,8,9], 15)` — 7 frames, default loop. */
export const MAGICAL_LOCK_DESTROY_ANIM = Object.freeze({
    frames: Object.freeze([3, 4, 5, 6, 7, 8, 9]), frameCount: 7, frameRate: 15, loop: true,
});

/**
 * How many `Spritemap.update` calls from `play("destroy")` to `animEnd`.
 *
 * SIMULATED. `Math.ceil(7 / (15 * 0.0333))` and the loop agree here, and
 * §R6's own trap 70 is that they agree everywhere measured — the loop is
 * still what runs, so the loop is what this counts.
 */
function deriveDestroyUpdates() {
    const a = MAGICAL_LOCK_DESTROY_ANIM;
    const step = a.frameRate * FP_MAX_ELAPSED;
    let timer = 0;
    let index = 0;
    for (let update = 1; update <= 10000; update += 1) {
        timer += step;
        while (timer >= 1) {
            timer -= 1;
            index += 1;
            if (index === a.frameCount) return update;
        }
    }
    return fail('deriveDestroyUpdates: the destroy animation never wrapped');
}

/** ⛓ 15 — the `Spritemap.update` CALL INDEX on which `animEnd` fires. */
export const MAGICAL_LOCK_DESTROY_UPDATES = deriveDestroyUpdates();

/**
 * ⛓⛓⛓ AN UPDATE INDEX IS NOT A TICK, AND THE OFFSET IS SETTLED BY THE
 * UPDATE LIST — the §19 law, third customer.
 *
 * `World.addUpdate` PREPENDS, and a `WandShot` is added at RUN TIME while
 * the lock was added by `Game.loadlevel`. So on the landing tick the pass
 * reaches the SHOT first (head of the list), `checkEntity` calls
 * `MagicalLock.hit` → `play("destroy")`, and the pass then walks DOWN to
 * the lock, whose `e._graphic.update()` runs in the same tick.
 *
 * ⇒ destroy update 1 is the HIT TICK itself, so update 15 — the callback —
 * runs on `hitTick + 14`.
 */
export const MAGICAL_LOCK_CALLBACK_TICK_OFFSET = MAGICAL_LOCK_DESTROY_UPDATES - 1;

/**
 * The first tick on which the cell is passable.
 *
 * `animEnd` is `FP.world.remove(this)`, which is DEFERRED to
 * `updateLists()` at the end of the frame — and the lock is still in
 * `_typeFirst["Solid"]` for the rest of the callback tick, including for
 * the PLAYER, who is further down the update list than the lock
 * (`Game.as:2092` adds the player, `:2148` the lock, and `addUpdate`
 * prepends). ⇒ one tick later.
 */
export const MAGICAL_LOCK_OPEN_TICK_OFFSET = MAGICAL_LOCK_DESTROY_UPDATES;

/**
 * `if (lockType <= _t)` — `MagicalLock.as:66`.
 *
 * @param {number} lockType  0 (`magicallock`) or 1 (`magicallockfire`)
 * @param {number} shotType  0 (wand) or 1 (firewand)
 */
export function magicalLockOpens(lockType, shotType) {
    for (const [n, v] of [['lockType', lockType], ['shotType', shotType]]) {
        if (v !== 0 && v !== 1) {
            fail(`magicalLockOpens: ${n} must be 0 or 1, got ${v}. Both are constructed `
                + 'from a fixed set (Game.as:2148-2149 for the lock, WandShot.as:58 for '
                + 'the shot), so a third value is a model defect, not an input.');
        }
    }
    return lockType <= shotType;
}

/**
 * The four cases, as data — because `<=` and `==` differ on exactly one of
 * them and a test written over the function alone would not know that.
 */
export const MAGICAL_LOCK_MATRIX = Object.freeze([
    Object.freeze({ lock: 'magicallock', lockType: 0, shot: 'wand', shotType: 0, opens: true }),
    Object.freeze({ lock: 'magicallock', lockType: 0, shot: 'firewand', shotType: 1, opens: true }),
    Object.freeze({
        lock: 'magicallockfire', lockType: 1, shot: 'wand', shotType: 0, opens: false,
        why: '⛔ THE ONLY FALSE ROW, and the reason L43\'s exit is a plain-wand exit '
            + 'while a `magicallockfire` is not on this rung\'s honest path at all.',
    }),
    Object.freeze({
        lock: 'magicallockfire', lockType: 1, shot: 'firewand', shotType: 1, opens: true,
    }),
]);

/**
 * One lock's live state for a visit.
 *
 * @param {string} id
 * @param {object} placement  `{tag, x, y}` from the `.oel` (the CELL corner,
 *   not the entity point — the +8/+8 is applied here so a caller cannot
 *   forget it, exactly as `levelWorld`'s census row does)
 * @param {number} lockType
 */
export function createMagicalLock(id, placement, lockType) {
    const { tag = -1, x, y } = placement;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        fail(`createMagicalLock(${id}): placement needs finite x/y, got (${x}, ${y})`);
    }
    if (lockType !== 0 && lockType !== 1) {
        fail(`createMagicalLock(${id}): lockType must be 0 or 1, got ${lockType}`);
    }
    return {
        id,
        tag,
        lockType,
        ex: x + MAGICAL_LOCK_GEOMETRY.dx,
        ey: y + MAGICAL_LOCK_GEOMETRY.dy,
        /** null until a shot with a high enough type reaches it. */
        hitTick: null,
        /** The tick `animEnd` runs and `FP.world.remove` is QUEUED. */
        callbackTick: null,
        /** The first tick the cell is passable — one later, see the constant. */
        openTick: null,
        removed: false,
        /** Set the instant `hit()` lands — `Game.setPersistence(tag, false)`. */
        persistenceCleared: false,
    };
}

/**
 * `MagicalLock.hit(shotType)`.
 *
 * ⚠ NOT IDEMPOTENT IN THE SOURCE and idempotent here for a reason that is
 * in the source too: a second landing shot would `play("destroy")` again
 * and restart the fifteen, but no second shot can reach a cell the first
 * one is still filling — the lock is `"Solid"` and in the shot's own
 * `solids`, so shot two stops on the same box and dispatches again. That IS
 * reachable, so it is modelled: a re-hit RESTARTS the animation, and the
 * open tick moves.
 *
 * @returns {{opened:boolean, restarted:boolean}}
 */
export function hitMagicalLock(state, shotType, tick) {
    if (state.removed) return { opened: false, restarted: false };
    if (!magicalLockOpens(state.lockType, shotType)) {
        return { opened: false, restarted: false };
    }
    const restarted = state.hitTick !== null;
    state.hitTick = tick;
    state.persistenceCleared = true;
    state.callbackTick = tick + MAGICAL_LOCK_CALLBACK_TICK_OFFSET;
    state.openTick = tick + MAGICAL_LOCK_OPEN_TICK_OFFSET;
    return { opened: true, restarted };
}

/**
 * One `Spritemap.update` worth of the destroy clock, run from the world's
 * graphic pass.
 *
 * ⚠ THE CLOCK IS NOT FREEZE-GATED. `World.update` steps `e._graphic` below
 * `e.update()` and OUTSIDE the `e.active` test, and `Game.freezeObjects` is
 * consulted by neither — so a lock hit just before a ceremony finishes
 * dying through it. (§8.2's standing note, third class.)
 */
export function stepMagicalLock(state, tick) {
    if (state.removed || state.hitTick === null) return { removed: false };
    if (tick >= state.openTick) {
        state.removed = true;
        return { removed: true };
    }
    return { removed: false };
}

/**
 * Is the lock's box still a wall at `tick`?
 *
 * ⛓ TRUE THROUGH THE WHOLE ANIMATION — the header's third finding, as the
 * predicate `collidesSolid`'s live view consumes.
 */
export function magicalLockIsSolid(state, tick) {
    if (state.removed) return false;
    if (state.hitTick === null) return true;
    return tick < state.openTick;
}
