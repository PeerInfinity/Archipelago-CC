/**
 * seedlingDemo/bridges — the one terrain type that rewrites its own
 * solidity, and the two lifetimes that makes it need.
 *
 * Region-atlas Phase 8, subtractive ladder rung R4, slice 3. Brief:
 * `CC/docs/plans/seedling-bot-r4-opus-kickoff.md` §2.2/§3.3.
 *
 * A Bridge (`t = 29`) is the reason `Tile.types[29]` is the string
 * `"Unused"`: every other tile takes its type once, in its own first
 * `update()`, and then goes `active = false` forever. A bridge takes its
 * type from a TIMER inside `render()`, on every frame, for as long as it is
 * on screen — so it is neither walkable nor solid until something has
 * looked at it.
 *
 * ── THE CYCLE, from `Tile.as:344-378` ─────────────────────────────────
 *
 *   timer >= 60   `type = "Solid"`                      CLOSED
 *   0 < timer     `timer--` then `type = "Solid"`       OPENING
 *   timer <= 0    `type = "Tile"`                       OPEN (state 29)
 *
 * The only decrement from gameplay is `Player.as:1098` — `(e as
 * Tile).bridgeOpeningTimer--` inside `genericHit`'s `e is Tile` arm, under
 * `t == "Spear"`. A thrust tips 60 to 59, and from then on the render loop
 * walks it down on its own.
 *
 * ⚠ BUT ONE PRESS IS NOT ONE THRUST, and this docblock said it was until
 * the model was wired into `levelRun`. The chain is four classes deep:
 * `Player.update()` calls `spear()` BEFORE `super.update()`, so the rect
 * fires on the tick AFTER the `input()` that set `spearing`; `spearing` is
 * cleared by `spearEnd`, the COMPLETE CALLBACK of an 8-frame, 45 fps
 * `Spritemap`; `spear()` re-fires whenever `spearDelay` (max **1**) has
 * drained, i.e. every OTHER tick for as long as `spearing` holds; and the
 * `e is Tile` arm has NO already-open guard, so every firing decrements.
 * The decrement count is therefore a sprite frame rate divided by an
 * engine frame rate — arithmetic across two subsystems this model does not
 * have.
 *
 * That was measured rather than derived, and the measurement is exact:
 * `scripts/procgen/probe-seedling-bridge.mjs` pins the player against
 * L63's bridge, presses ONCE at tick 25, holds DOWN, and the player's `y`
 * first moves off the face **on tick 85**.
 *
 *   t=25   `input()` sets `spearing`, `spearDirection = direction` (3)
 *   t=26   `spear()` fires the rect; the `e is Tile` arm takes 60 to 59,
 *          and that tick's render takes it to 58
 *   t=84   the render that walks it to 0 — STILL Solid (the `> 0` arm)
 *   t=85   the render that takes the `<= 0` arm and writes `type = "Tile"`;
 *          the player, already holding DOWN, moves through on that tick
 *
 * ⇒ **ONE PRESS IS ONE DECREMENT after all**, and `framesToOpen()`'s 60 is
 * the whole delay. `spearing` does not survive long enough for
 * `spearDelay` to drain and re-fire — so the four-class chain above is a
 * hazard the model has to know about (a rung that lengthens the animation,
 * or a weapon with a longer one, re-opens it) and not a correction. The
 * one thing it DID confirm is the lag: the hit lands the tick AFTER the
 * press, which is what the leg's frame count is measured from.
 *
 * ⚠ NOTHING EVER RE-INCREMENTS IT. Within one world instance the open
 * state is a LATCH: there is no re-close countdown to race, and the "60
 * frames" is a delay before the crossing rather than a window during it.
 *
 * ⚠ AND IT IS AN INSTANCE VARIABLE WITH NO PERSISTENCE. A re-entered level
 * builds the bridge CLOSED, whatever the player did last visit — which is
 * the opposite lifetime from the clear a shield lock earns (`levelRun`
 * banks that one and cashes it on the next entry). Two families, two
 * lifetimes; unifying them would either make an earned clear evaporate or
 * make a bridge stay open across a rebuild, and the R4 route walks back
 * through L63.
 *
 * ── ⚠ FRAMES, NOT TICKS ───────────────────────────────────────────────
 *
 * `render()` is driven by the Engine independently of `Game.update`'s
 * `blackCover` gate — the same fact that settled the statue's `setHitbox`
 * at v2 — so a bridge keeps opening during frames the tape does not count:
 * the ~19 fade frames of an arrival, the 151 frozen frames of a pickup
 * ceremony, a `Help`. This model counts TICKS, and the two coincide only
 * while nothing freezes. That is a BOUNDED ASSUMPTION with a stated
 * condition rather than a transcription: `assertNoFreezeDuringOpening`
 * makes a leg that would violate it a named failure at synthesis instead
 * of a divergence in a recording.
 */

export class BridgeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BridgeError';
    }
}

/** `Tile.as:78-79` — `bridgeOpeningTimerMax`, and the value one starts at. */
export const BRIDGE_TIMER_MAX = 60;

/** `Tile.types` index a bridge occupies, and the terrain state when open. */
export const BRIDGE_STATE = 29;

/**
 * The camera radius the opening policy asserts against, in pixels.
 *
 * ⚠ DERIVED, NOT CHOSEN. `Game.view()` targets `player - 80` in each axis
 * (x additionally shifted by `Inventory.width/2 + Inventory.offset.x/2`
 * = 33 - 35 = -2, a constant because the inventory never opens — which the
 * R4 equip directive is precisely what guarantees), lerps
 * `1/cameraSpeedDivisor` = 1/10 of the remaining distance per frame,
 * clamps to the level, then rounds. `loadlevel` SNAPS the camera onto the
 * player at every arrival (`Game.as:2041-2042`), so the only standing
 * error is the steady-state lag: at most 10x the ~1.45 px/tick velocity
 * peak, plus half a pixel of rounding.
 *
 * A Tile is `onScreen` while its 16 px rect meets the 160 px window, so
 * the true bound is 88 - 15 = 73 px in y and 71 px in x. Sixty-four is
 * that with slack, and round.
 *
 * ⚠ PRECONDITION, and it is asserted rather than assumed: this holds only
 * while `cameraSpeedDivisor` is its default 10. `Game.as:914` sets it to
 * 50 in a cutscene branch, which would quintuple the lag to ~72 px and
 * break the bound. R4 enters no cutscene; a rung that does must re-derive.
 */
export const ON_SCREEN_RADIUS = 64;

/** A fresh bridge, as `loadlevel` builds it. */
export function newBridge() {
    return { timer: BRIDGE_TIMER_MAX };
}

/**
 * A Spear press landing on the tile: `bridgeOpeningTimer--`, once.
 *
 * ⚠ It decrements UNCONDITIONALLY — there is no "already open" guard in
 * `genericHit` — so a second press on an open bridge drives the timer
 * NEGATIVE and the `<= 0` arm keeps it open. Harmless, and transcribed
 * rather than clamped, because a clamp would hide a double-press the
 * executor should be reporting.
 */
export function bridgeHit(bridge) {
    return { timer: bridge.timer - 1 };
}

/**
 * One rendered frame, with the tile on screen or not.
 *
 * Returns the timer AND the type the frame leaves behind, because the two
 * are decided in the same switch and a caller that recomputed the type
 * from the timer would have to re-derive the `>= 60` / `> 0` / `<= 0`
 * split — which is the thing worth having in one place.
 */
export function bridgeRender(bridge, onScreen) {
    // The `onScreen` early return is the whole reason a bridge that has
    // never been looked at is type `"Unused"`: no render, no switch, no
    // type. `loadlevel` gives it `type = "Tile"` at construction and the
    // first `update()` assigns `types[29]`, which IS `"Unused"` — so the
    // tile is in neither the walkable list nor the solid list until a
    // render has run.
    if (!onScreen) return { timer: bridge.timer, type: 'Unused' };
    if (bridge.timer >= BRIDGE_TIMER_MAX) return { timer: bridge.timer, type: 'Solid' };
    if (bridge.timer > 0) return { timer: bridge.timer - 1, type: 'Solid' };
    return { timer: bridge.timer, type: 'Tile' };
}

/**
 * How many ON-SCREEN frames after a single Spear hit before the tile is
 * walkable.
 *
 * ⚠ SIXTY, and the fencepost is worth stating: the hit leaves 59, then
 * fifty-nine renders walk it to 0 while it is STILL SOLID, and the
 * sixtieth render is the one that takes the `<= 0` arm and flips the type.
 * A model that answered 59 would have the player step onto a solid tile.
 */
export function framesToOpen(fromTimer = BRIDGE_TIMER_MAX - 1) {
    let bridge = { timer: fromTimer };
    for (let n = 1; n <= BRIDGE_TIMER_MAX * 4; n++) {
        const r = bridgeRender(bridge, true);
        bridge = { timer: r.timer };
        if (r.type === 'Tile') return n;
    }
    throw new BridgeError(`a bridge at timer ${fromTimer} never opened`);
}

/** Is `(x, y)` inside the conservative on-screen radius of a tile centre? */
export function withinOnScreenRadius(x, y, tileCentre, radius = ON_SCREEN_RADIUS) {
    return Math.abs(x - tileCentre.x) <= radius
        && Math.abs(y - tileCentre.y) <= radius;
}

/**
 * The policy §3.3 rules, asserted from the RUN's own state.
 *
 * The model does not grow a camera — it grows a promise about where the
 * player is, checked every tick from the press through the crossing. A leg
 * that cannot keep the promise is a synthesis throw, not a model guess.
 *
 * @param {Array}  positions   `{t, x, y}` per tick, press tick through crossing
 * @param {object} tileCentre  the bridge tile's centre
 * @param {object} [opts]
 * @param {number} [opts.radius]
 * @param {Array}  [opts.frozenTicks]  ticks the run was frozen on, if any
 */
export function assertOnScreenThroughout(positions, tileCentre, opts = {}) {
    const { radius = ON_SCREEN_RADIUS, frozenTicks = [] } = opts;
    if (positions.length === 0) {
        throw new BridgeError(
            'assertOnScreenThroughout was given no positions — an empty window '
            + 'satisfies every radius, which is the shape of a check that cannot fail',
        );
    }
    const strayed = positions.filter((p) => !withinOnScreenRadius(p.x, p.y, tileCentre, radius));
    if (strayed.length > 0) {
        const first = strayed[0];
        throw new BridgeError(
            `the run left the bridge's on-screen radius at tick ${first.t}: `
            + `(${first.x}, ${first.y}) is more than ${radius} px from the tile centre `
            + `(${tileCentre.x}, ${tileCentre.y}). \`Tile.render\` early-returns when the `
            + 'tile is off screen, so the opening timer STOPS — the model would count '
            + 'frames the game never ran. Keep the leg near the bridge, or re-plan it.',
        );
    }
    // ⚠ The frames-not-ticks assumption, made into a named failure.
    if (frozenTicks.length > 0) {
        const from = positions[0].t;
        const to = positions[positions.length - 1].t;
        const inside = frozenTicks.filter((t) => t >= from && t <= to);
        if (inside.length > 0) {
            throw new BridgeError(
                `the run was FROZEN on tick(s) ${inside.slice(0, 5).join(', ')} during the `
                + `bridge opening (${from}..${to}). \`Tile.render\` runs on frozen frames `
                + 'and this model counts TICKS, so the game would open the bridge earlier '
                + 'than the model says. Move the ceremony out of the opening window.',
            );
        }
    }
    return positions.length;
}

/**
 * Ticks from the `primary` PRESS to the tick the player can move onto the
 * tile, measured on the game (`probe-seedling-bridge.mjs`).
 *
 * ⚠ SIXTY, and it is the sum of two ones that cancel rather than a
 * coincidence with `framesToOpen()`. The press at tick T sets `spearing`
 * inside `input()`, which runs AFTER `spear()` in the same
 * `Player.update()`; so the rect fires at T+1 and the hit's own tick is
 * also the first render of the sixty. The sixtieth render — T+60 — is the
 * one that writes `type = "Tile"`, and a player already holding the
 * direction moves through on it.
 *
 * Held as its own constant rather than as `framesToOpen()` reused, because
 * they answer different questions: one is the TILE's transcription and one
 * is the LEG's obligation, and a rung that changes the spear animation
 * moves the second without touching the first.
 */
export const TICKS_FROM_PRESS_TO_WALKABLE = 60;

/**
 * The on-screen window a leg must keep its promise over: the press tick
 * through the tick the player steps on.
 *
 * A leg that presses at `pressTick` may not leave the 64 px radius before
 * `pressTick + TICKS_FROM_PRESS_TO_WALKABLE` — `Tile.render` early-returns
 * off screen and the opening simply STOPS, so a leg that wanders is not
 * slow, it is stuck.
 */
export function openingWindow(pressTick) {
    if (!Number.isInteger(pressTick) || pressTick < 0) {
        throw new BridgeError(`openingWindow: pressTick must be a non-negative integer, `
            + `got ${JSON.stringify(pressTick)}`);
    }
    return { from: pressTick, to: pressTick + TICKS_FROM_PRESS_TO_WALKABLE };
}
