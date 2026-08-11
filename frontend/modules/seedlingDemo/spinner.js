/**
 * seedlingDemo/spinner — THE BILLIARD BALL, and the one mover it blocks.
 *
 * R5 slice 13 step 0, and it exists because of a cell. §25.3 diagnosed the
 * shaft's parting at t852 down to *"a wandering `Spinner` stood in block 2's
 * glide corridor"* and stopped there: the motion was read out of the source
 * and not built, so `runFire` had to REFUSE every pushable press in a room
 * with live enemies — L39 (the shaft) and L40 (the boss-key leg) both.
 * §26 is the transcription that diagnosis left behind; this file is it,
 * checked against the source again rather than trusted.
 *
 * ── ⛓⛓ WHY THIS CLASS IS MODELLABLE AND ALMOST NO OTHER ENEMY IS ──────
 *
 *   `runRange = 0`   `Spinner.as:23`. The chase arm's gate is `d <= runRange`
 *                    against `FP.distance`, which is never negative and is
 *                    zero only if the player's entity is exactly on the
 *                    spinner's. ⇒ THE WHOLE `nearestToPoint("Player")` BLOCK
 *                    IS DEAD CODE, and the motion is player-INDEPENDENT.
 *   `activeOffScreen` `= true` (`:44`), so `Enemy.update`'s `!onScreen()`
 *                    early return never fires. ⛓ No camera coupling at all —
 *                    §25's pan-audit worry does not reach this class, and a
 *                    spinner keeps bouncing in a room the player has walked
 *                    out of the view of.
 *   `friction()`     OVERRIDDEN (`:124-135`) to `v.normalize(max(|v| - f,
 *                    moveSpeed))` — the floor is `moveSpeed`, not 0. IT NEVER
 *                    STOPS, and a knockback DECAYS BACK to speed 1 rather
 *                    than to rest. ⇒ a fire shove on a spinner is temporary
 *                    by construction; `DISPLACE` is not a verb here.
 *   `moveX`/`moveY`  OVERRIDDEN (`:137-171`) to REFLECT (`v.x = -v.x`) and
 *                    return, instead of `Mobile`'s stop-and-return.
 *
 * ⇒ its trajectory is a function of the level's static geometry and the tick
 * index alone. It can be simulated forward from tick 0 of a visit with no
 * route input, which is what makes a press schedule threadable at all.
 *
 * ── ⛔⛔ WHAT IT BLOCKS, AND WHAT BLOCKS IT — TWO DIFFERENT LISTS ──────
 *
 * The spinner's own `solids` is `Mobile`'s, untouched:
 * `["Solid","Tree","Rock","Rope","ShieldBoss"]` — NOT `"Player"` and NOT
 * `"Enemy"`. So it passes through the player and through its siblings, and
 * reflects only off static geometry and off a pushable block (whose `type`
 * is `"Solid"`, `PushableBlockFire.as:30`).
 *
 * ⛓⛓ **AND THE COLLISION IS MUTUAL AND ASYMMETRIC IN OUTCOME.** The block's
 * list carries `"Enemy"`, so the same contact STOPS the block and BOUNCES
 * the spinner. That asymmetry is the whole wedge: one tick of overlap parks
 * a block forever, because a blocked block keeps `v` non-zero and
 * `PushableBlockFire.hit`'s first line is `if (v.length > 0) return`.
 *
 * ── ⛓ THE UPDATE ORDER IS THE OTHER HALF, AND IT IS DERIVABLE ─────────
 *
 * `Game.loadlevel` adds the pushables at `:2216-2218` and the spinners at
 * `:2250`, and `World.addUpdate` PREPENDS (`World.as:937-948`) — so the
 * update list is REVERSE add order and
 *
 *     spinner  ->  pushable block  ->  … ->  Player
 *
 * A caller therefore steps spinners at the very top of the tick, ABOVE
 * `stepPushables`: the block's sweep this tick must read the spinner where
 * this tick left it, and the player's sweep reads both.
 *
 * ── ⛔⛔ AND IT WRITES A PERSISTENCE FLAG WITHOUT BEING KILLED ─────────
 *
 * `removed()` is `if (doActions) Game.setPersistence(tag, false)` with no
 * test of HOW it was removed — and `Enemy.update` destroys it in water and
 * lava and fades it out over a pit. ⇒ **a spinner that bounces into a hazard
 * banks the same ledger write a sword kill would**, on a tick the route
 * never chose. `SPINNER_TERRAIN_WRITE` names it; `terrainDeaths` on the run
 * state is where a ledger reads it back. A model that only wrote the flag on
 * a kill would report a clean ledger for a room that had quietly earned one.
 *
 * ── ⚠ THE FREEZE GATES, VERIFIED RATHER THAN ASSUMED ──────────────────
 *
 * §26 asked for this to be established at source and not inherited from
 * `Bob` (which returns on `Game.freezeObjects`) or `Jellyfish` (which never
 * tests it). `Spinner` has NO gate of its own; what it inherits is:
 *
 *   MOTION      gated. `Mobile.mobileUpdate:35` wraps `friction/input/
 *               moveX/moveY` in `if (!Game.freezeObjects)`. ⇒ A CEREMONY
 *               PARKS A SPINNER, unlike a `Crusher` (an `Activators`, no
 *               gate at all — `crusher.CEREMONY_RULE`).
 *   DAMAGE      gated, but ONE LEVEL DOWN. `Spinner.update`'s hammer line
 *               and `Enemy.hitPlayer` both run through the freeze; what
 *               stops them is `Player.hit`'s own
 *               `if (hitsTimer <= 0 && hits < hitsMax && !Game.freezeObjects)`
 *               (`Player.as:1380`). ⇒ the calls happen and land on a no-op.
 *   TERRAIN     NOT gated. `Enemy.update`'s `getState()` switch is above
 *               `super.update()`, so a spinner already standing in water
 *               keeps fading through a ceremony — and `death()` is outside
 *               `mobileUpdate`'s gate too, so it can be REMOVED mid-freeze
 *               and write its flag there.
 *
 * ⇒ a part-collect beside a spinner is a POSITIONAL claim, not the
 * survival claim a crusher forces: prove the stance is clear of the body and
 * the 13 px hammer on the freeze's FIRST frame and it is clear for all 150.
 */

import { rectsOverlap, SOLIDS_BY_MOVER } from './levelWorld.js';
/**
 * ⛓⛓ `World.collideLine`, THE ONE TRANSCRIPTION — imported from the module
 * whose caller happened to need it first.
 *
 * The `Solid` in the name is the TYPE `Crusher.update` passes, not a
 * restriction of the function: it takes a box list and walks the game's own
 * integer raycast over it (the `int` cast at the signature, the `while (x <
 * toX)` that never samples the endpoint, the fractional minor axis). The
 * hammer's line is the same `World.as:411-500` and must not become a second
 * copy of it — [[feedback_two_cost_models_must_agree]] is exactly what a
 * "just for the hammer" raycast would be, and the two would agree until one
 * of them was edited.
 */
import { collideLineSolid } from './crusher.js';

export class SpinnerError extends Error {
    constructor(message) { super(message); this.name = 'SpinnerError'; }
}
const fail = (m) => { throw new SpinnerError(m); };

const TILE = 16;

/** `FP.sign` — 0 maps to 0, which `Math.sign` also does. */
const sign = (n) => Math.sign(n);

/**
 * `Enemies/Spinner.as` + the `Enemy`/`Mobile` chain above it, transcribed.
 *
 * Every number here is a literal from the source, not a derived one — the
 * two that look derived carry their arithmetic.
 */
export const SPINNER = Object.freeze({
    /** `super(_x + Tile.w/2, _y + Tile.h/2, …)` — the entity is the CELL CENTRE. */
    dx: TILE / 2,
    dy: TILE / 2,
    /** `setHitbox(7, 7, 4, 4)` ⇒ the box is [x-4, x+3) x [y-4, y+3). */
    w: 7,
    h: 7,
    originX: 4,
    originY: 4,
    /** `moveSpeed:Number = 1` — and `friction()`'s FLOOR, not just its start. */
    moveSpeed: 1,
    /** `Mobile.DEFAULT_FRICTION`. Inert while |v| == moveSpeed; live after a shove. */
    f: 0.25,
    /** `Mobile.friction`'s per-axis dead band, which the override keeps. */
    zeroBand: 0.05,
    /** `v = moveSpeed * (cos(-PI/4), sin(-PI/4))` — north-EAST, at the ctor. */
    heading: -Math.PI / 4,
    /** ⛔ ZERO. The chase arm is unreachable; the motion is player-independent. */
    runRange: 0,
    /** ⛔ TRUE. `Enemy.update`'s `!onScreen()` early return never fires. */
    activeOffScreen: true,
    /** `hammerLength = sprSpinner.width - sprSpinner.originX` = 18 - 5. */
    hammerLength: 13,
    /** `Game.timePerFrame` — the hammer's period, in updates. */
    hammerPeriod: 45,
    /** `hitForce`, `damage` (from `Enemy`), `hitsMax`. */
    hitForce: 4,
    damage: 1,
    hitsMax: 3,
    hitsTimerMax: 30,
    /**
     * ⛓⛓ THE TWO FADES, AND THEY DO NOT BOTH DIVIDE.
     *
     * Both are `alpha -= k` on a `Number` — a double, in AS3 exactly as
     * here — tested with `alpha <= 0`. So the length is the ACCUMULATION,
     * not `1 / k`, and the two disagree about whether that matters:
     *
     * ```
     *   death()          1 -= 0.1  x10  ->  1.39e-16, STILL > 0  ⇒ 11 ticks
     *   fallAlphaSpeed   1 -= 0.05 x20  -> -3.19e-16,      <= 0  ⇒ 20 ticks
     * ```
     *
     * ⛔ So a model that wrote `1 / alphaFade` would be ONE FRAME EARLY on
     * every death and right on every pit fall — the worst kind of wrong,
     * because the case that would catch it passes. Simulated, not divided:
     * the same law `burnableTree`'s 41 ticks was built under, one class over.
     */
    fallAlphaSpeed: 0.05,
    alphaFade: 0.1,
    /** Measured by accumulation, and pinned by `spinner.test.js`. */
    deathTicks: 11,
    pitFallTicks: 20,
    /** Its runtime `type`, from `Enemy`'s ctor. Not overwritten (cf. `BombPusher`). */
    type: 'Enemy',
    /** ⛓ `Mobile.solids`, VERBATIM — no `push` anywhere in the chain. */
    solids: SOLIDS_BY_MOVER.enemy,
    /** `Enemy.getState()`'s switch, by `Tile.t`. */
    terrain: Object.freeze({ 1: 'water', 6: 'pit', 17: 'lava' }),
    src: 'Enemies/Spinner.as:22-45,124-171 + Enemies/Enemy.as:62-118 + Mobile.as:26-118',
});

/**
 * ⛔⛔ THE CTOR'S RNG DRAWS — THREE OF THEM, ON TWO DIFFERENT STREAMS.
 *
 * §26 banked *"the ctor draws ONE `Math.random` (coins)"*. Re-read, it draws
 * **two**, and it advances a third generator that is not `Math.random` at
 * all:
 *
 * ```
 *   Enemy.as:30    coins:int = 4 + Math.random() * 4          ← Flash's
 *   Enemy.as:35    fallSpinSpeed = 8 * FP.choose(-1, 1)       ← FP's LFSR
 *   Spinner.as:24  coins:int = 4 + Math.random() * 4          ← Flash's, AGAIN
 * ```
 *
 * `FP.choose` -> `FP.rand` -> `_seed = (_seed * 16807) % 2147483647`
 * (`FP.as:404-422`) — a Lehmer generator with its own state, NOT the
 * platform RNG. Two streams, and a model that folded them together would be
 * wrong about both.
 *
 * ⚠ INERT, AND THE INERTNESS IS THE CLAIM. `dropCoins()` is commented out in
 * `removed()`, `Spinner.coins` is read nowhere else, and `fallSpinSpeed`
 * only ever reaches a graphic's `angle`. The model consumes NEITHER stream
 * (no `Math.random` and no `FP.random` anywhere under `seedlingDemo/`), so
 * this table exists to be checked against the source rather than to be used
 * — the day something modelled draws from either, three draws per spinner
 * construction is a phase error nobody would look for.
 */
export const SPINNER_CTOR_RNG = Object.freeze({
    mathRandomDraws: 2,
    fpLfsrDraws: 1,
    observable: false,
    why: '`dropCoins()` is commented out of `removed()`; `fallSpinSpeed` reaches only '
        + '`(graphic as Image).angle` on a pit fall. Both draws are pure advances.',
    src: 'Enemies/Enemy.as:30,35 + Enemies/Spinner.as:24 + net/flashpunk/FP.as:404-422',
});

/**
 * ⛔⛔ THE FLAG A SPINNER WRITES WITHOUT BEING FOUGHT.
 *
 * `removed()` has no test of the cause, so every path out of the world banks
 * the clear: a sword kill, a crusher's 1000 damage, AND `Enemy.update`'s
 * terrain arms. The last one is the dangerous member — it is a ledger entry
 * the route did not choose and cannot see coming without this model.
 *
 * ⚠ `doActions` is the ONE gate, and it is false only when `check()` already
 * despawned the spinner for a cleared flag on entry — i.e. exactly when the
 * flag is clear already. So "unconditional" is right in every live case.
 */
export const SPINNER_TERRAIN_WRITE = Object.freeze({
    writes: 'Game.setPersistence(tag, false)',
    gate: 'doActions — false only after `check()` despawned it for an already-clear flag',
    causes: Object.freeze(['sword kill', 'crusher (damage 1000)', 'water', 'lava', 'pit']),
    src: 'Enemies/Spinner.as:57-64 + Enemies/Enemy.as:68-103',
    why: 'a billiard that bounces into water banks the same flag a kill does, on a tick '
        + 'no route picked. A ledger assertion that only counted kills would pass a room '
        + 'that had quietly earned an extra clear.',
});

/** The 7x7 body — its collider, and what `hitPlayer` touches you with. */
export function spinnerRect(s) {
    if (!Number.isFinite(s?.x) || !Number.isFinite(s?.y)) {
        fail('spinnerRect: a spinner needs a finite entity position');
    }
    const x = s.x - SPINNER.originX;
    const y = s.y - SPINNER.originY;
    return { x, y, w: SPINNER.w, h: SPINNER.h, right: x + SPINNER.w, bottom: y + SPINNER.h };
}

/**
 * `Spinner.friction()` — the OVERRIDE, whose floor is `moveSpeed`.
 *
 * ⚠ NOT `pushables.frictionStep`. That one transcribes `Mobile.friction`,
 * whose floor is 0, and the two differ by exactly the term that makes this
 * class never stop. They are separate functions on purpose: sharing one with
 * a `floor` parameter would let a future edit to the block's friction reach
 * the spinner's, and the AS3 has two bodies.
 *
 * ⛓ The `< 0.05` per-axis zeroing runs AFTER the normalize, on the SCALED
 * components — so a near-axis-aligned spinner is snapped onto the axis
 * rather than being left with a 0.04 px/tick drift.
 */
export function spinnerFriction(vx, vy) {
    const len = Math.hypot(vx, vy);
    let nx = vx;
    let ny = vy;
    // `Point.normalize` on a zero-length point cannot scale — the same guard
    // `pushables.frictionStep` carries, for the same reason.
    if (len > 0) {
        const scaled = Math.max(len - SPINNER.f, SPINNER.moveSpeed);
        nx = (vx / len) * scaled;
        ny = (vy / len) * scaled;
    }
    if (Math.abs(nx) < SPINNER.zeroBand) nx = 0;
    if (Math.abs(ny) < SPINNER.zeroBand) ny = 0;
    return { vx: nx, vy: ny };
}

/**
 * `Spinner.moveX` / `moveY` for one axis: the `Mobile` sweep with a REFLECT
 * where the base class has a stop.
 *
 * ⚠ THE LOOP, NOT THE CLOSED FORM. `for (i = 0; i < Math.abs(rel); i++)`
 * with `step = min(1, |rel| - i) * sign(rel)`: at |v| = 0.7071 that is ONE
 * substep of 0.7071, so the position accumulates a fraction per axis per
 * tick and never lands on an integer. At |v| > 1 (a knockback) it is
 * several, and the reflect ABORTS the remaining ones — `return c` is inside
 * the loop. A model that multiplied `sign(rel) * |rel|` would agree on the
 * common case and disagree on every shoved one.
 */
function reflectAxis(pos, rel, collides) {
    let p = pos;
    for (let i = 0; i < Math.abs(rel); i += 1) {
        const step = Math.min(1, Math.abs(rel) - i) * sign(rel);
        const hit = collides(p + step);
        // `v.x = -v.x; return c;` — the flip is the caller's to apply, and
        // the sweep stops where it stood.
        if (hit) return { pos: p, v: -rel, blocked: hit };
        p += step;
    }
    return { pos: p, v: rel, blocked: null };
}

/**
 * One spinner, at its `.oel` cell.
 *
 * @param {object} p  `{id, x, y, persistTag}` — `x`/`y` are the OEL CORNER;
 *   the entity lands at `+ (Tile.w/2, Tile.h/2)`, which is where every
 *   collision, the hammer's origin and `getState`'s probe all read from.
 */
export function newSpinner({ id, x, y, persistTag = -1 }) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        fail(`newSpinner: ${id} needs a finite .oel position`);
    }
    return {
        id,
        as3: 'Spinner',
        persistTag,
        x: x + SPINNER.dx,
        y: y + SPINNER.dy,
        vx: SPINNER.moveSpeed * Math.cos(SPINNER.heading),
        vy: SPINNER.moveSpeed * Math.sin(SPINNER.heading),
        hits: 0,
        hitsTimer: 0,
        alpha: 1,
        destroy: false,
        fallInPit: false,
        fell: false,
        removePending: false,
        removed: false,
        /** How it left the world, once it has — for the ledger's attribution. */
        deathCause: null,
    };
}

/**
 * One `Spinner.update()`, which is `Enemy.update()` around
 * `Mobile.mobileUpdate()` with two overrides in it.
 *
 * `ctx`:
 *   `collides(rect)`   the SPINNER's own solids list — static geometry and
 *                      pushable blocks, NOT the player and NOT its siblings.
 *                      Returns a blocker or null.
 *   `tileTypeAt(x, y)` `nearestToPoint("Tile", x, y).t` at the ENTITY point.
 *                      ⚠ THE ENTITY, not the box centre: they coincide here
 *                      and do NOT on a `PushableBlockFire`, whose `input()`
 *                      probes `x - originX + width/2`. Required — a ctx
 *                      without it must say `noTerrain: true`, because an
 *                      unasked terrain check reads as "it survives".
 *   `frozen`           `Game.freezeObjects`. Gates the MOTION only; see the
 *                      file docblock for the three-way split.
 *
 * @returns the next spinner state (a new object; the input is not mutated)
 */
export function stepSpinner(s, ctx = {}) {
    const { collides = () => null, tileTypeAt = null, noTerrain = false, frozen = false } = ctx;
    if (s.removed) return s;
    // `World.updateLists` processes `_remove` at the TOP of the frame, so a
    // spinner whose alpha hit zero last tick is gone before this one runs —
    // and THAT is the tick its `removed()` write lands on.
    if (s.removePending) return { ...s, removed: true, removePending: false };

    let { x, y, vx, vy, alpha, destroy, fallInPit, fell, hitsTimer, deathCause } = s;

    // ── Enemy.update: the onScreen gate ───────────────────────────────
    // `if (!activeOffScreen && !onScreen()) return;` — `activeOffScreen` is
    // true, so this never returns. Stated rather than omitted: it is the
    // reason no camera state is threaded into this function at all.

    // ── Enemy.update: getState(), ABOVE the move ──────────────────────
    // The tile is probed at the position the PREVIOUS tick left, and the
    // switch runs even under a freeze.
    if (!destroy) {
        if (tileTypeAt) {
            const kind = SPINNER.terrain[tileTypeAt(x, y)];
            if (kind === 'water' || kind === 'lava') {
                destroy = true;
                deathCause = kind;
            } else if (kind === 'pit' && !fallInPit) {
                fallInPit = true;
            }
        } else if (!noTerrain) {
            fail(`stepSpinner: ${s.id} has no \`tileTypeAt\` in its ctx, so `
                + '`Enemy.update`\'s water/lava/pit switch cannot be run. Pass the '
                + 'resolver, or pass `noTerrain: true` to state that the caller knows '
                + 'this spinner cannot reach one — an unasked terrain check reads as '
                + '"it survives", and a terrain death WRITES ITS PERSISTENCE TAG '
                + '(`SPINNER_TERRAIN_WRITE`).');
        }
    }

    if (!destroy && fallInPit) {
        // ── the pit branch — and `super.update()` is NOT called in it ──
        // No friction, no move, no `death()`. It drifts to the cell centre a
        // tenth at a time and fades at 0.05, which is 20 ticks.
        x += (Math.floor(x / TILE) * TILE + TILE / 2 - x) / 10;
        y += (Math.floor(y / TILE) * TILE + TILE / 2 - y) / 10;
        alpha -= SPINNER.fallAlphaSpeed;
        if (alpha <= 0) {
            destroy = true;
            fell = true;
            deathCause = 'pit';
        }
        return { ...s, x, y, vx, vy, alpha, destroy, fallInPit, fell, hitsTimer, deathCause };
    }

    // ── Mobile.mobileUpdate ───────────────────────────────────────────
    if (!destroy) {
        if (!frozen) {
            const fric = spinnerFriction(vx, vy);
            vx = fric.vx;
            vy = fric.vy;
            // `input()` is `Mobile`'s empty body — the Spinner does not
            // override it. Named so a reader checking this against the class
            // sees the same four calls.
            const sx = reflectAxis(x, vx, (nx) => collides(spinnerRect({ x: nx, y })));
            x = sx.pos;
            vx = sx.v;
            // ⚠ `moveY(v.y)` reads `v.y` AFTER `moveX` may have flipped
            // `v.x` — the two axes are independent and only the hit one
            // flips. Reading `vy` here rather than snapshotting it above is
            // that fact.
            const sy = reflectAxis(y, vy, (ny) => collides(spinnerRect({ x, y: ny })));
            y = sy.pos;
            vy = sy.v;
        }
        // `layering()` sets a render layer. Nothing observable.
    }
    // ── Mobile.death(), OUTSIDE the `!destroy` block and outside the
    // freeze gate. A spinner destroyed by water fades and is removed even
    // through a ceremony.
    let removePending = false;
    if (destroy) {
        alpha -= SPINNER.alphaFade;
        if (alpha <= 0) removePending = true;
    }
    // `hitUpdate()` / `hitPlayer()` run under `if (!destroy)`; the timer is
    // the only part with state, and it is what a kill verb's cadence reads.
    if (!destroy && hitsTimer > 0) hitsTimer -= 1;

    return { ...s, x, y, vx, vy, alpha, destroy, fallInPit, fell, hitsTimer, removePending, deathCause };
}

/**
 * ⛔⛔⛔ `Enemy.hit` + `Enemy.knockback`, TRANSCRIBED — and the shaft's
 * control arm is why this exists.
 *
 * Slice 13 recorded `r5-shaft-control` byte-exact and the GAME's ledger
 * carried **{39,4}** — `spinner@224,112`'s own tag — which the model did not
 * predict. Nothing on that arm fights anything: the eighteen presses are
 * deleted. ⛓ What kills it is `Pulser.hit`'s THIRD arm,
 * `(c as Enemy).hit(force, …, damage, "Pulse")` (`Pulser.as:110`) — an arm
 * `pulser.armFor` has always named and `levelRun` never had an enemy to
 * hand it. **Modelling a position creates a bill for everything that acts
 * on it**, and this is the first instalment.
 *
 * ⚠ AND THE KNOCKBACK IS NOT COSMETIC. `f = 6` against `moveSpeed = 1`, and
 * `friction()`'s floor means the shove decays back to 1 over ~20 ticks
 * rather than to rest — so a pulsed spinner travels several pixels a tick
 * for twenty of them, through a `moveX` loop that then takes SIX substeps
 * and can reflect partway. The trajectory after a pulse is nothing like the
 * one before it, which is exactly why "the pulser only slows it down" would
 * have been a wrong and comfortable assumption.
 *
 * ⛓ THE GATES, IN SOURCE ORDER: `hitsTimer <= 0 || hitByDarkStuff`, then
 * `!Game.freezeObjects`, then `canHit`, then `onlyHitBy`, then the fire
 * exemption. A `Spinner` overrides none of them — `maxForce` is -1,
 * `onlyHitBy` is "", `hitByFire` is false — so the only live ones are the
 * timer and the freeze.
 *
 * @param {object} s
 * @param {object} opts  `{force, from: {x, y}, damage, t, frozen}`
 */
export function hitSpinner(s, { force = 0, from = null, damage = 1, t = '', frozen = false } = {}) {
    if (s.removed || s.destroy) return s;
    // `hitsTimer <= 0 || hitByDarkStuff` — a Spinner is never hit by dark
    // stuff on this arc (no Shield, no Suit), so the timer is the gate.
    if (s.hitsTimer > 0) return s;
    if (frozen) return s;
    // `hitByFire` is false on `Enemy` and the Spinner does not override it,
    // so a FIRE press knocks it back and does NOT damage it.
    if (t === 'Fire') return knockbackSpinner(s, force, from);
    if (s.hits >= SPINNER.hitsMax) return s;
    const hits = s.hits + damage;
    const next = { ...s, hits, hitsTimer: SPINNER.hitsTimerMax };
    if (hits >= SPINNER.hitsMax) {
        // `startDeath` -> `destroy = true`. `death()` then fades it out over
        // `SPINNER.deathTicks` and `removed()` writes the tag.
        return { ...next, destroy: true, deathCause: t === '' ? 'killed' : t.toLowerCase() };
    }
    return knockbackSpinner(next, force, from);
}

/** `Enemy.knockback` — an atan2 shove, on top of whatever `v` already is. */
function knockbackSpinner(s, f, p) {
    if (!p || s.destroy) return s;
    const a = Math.atan2(s.y - p.y, s.x - p.x);
    return { ...s, vx: s.vx + f * Math.cos(a), vy: s.vy + f * Math.sin(a) };
}

/**
 * ⚠ THE HAMMER IS A FUNCTION OF `Game.time` AND NOTHING ELSE.
 *
 * `hammerAngle = (Game.time % Game.timePerFrame) / Game.timePerFrame * 2π`,
 * and the damage test is `collideLine("Player", x, y, x + 13·cos a,
 * y + 13·sin a)`. So it is a rotating LINE from the entity, one full turn
 * every 45 updates, and its phase rides on the ACCUMULATED tick index —
 * dead frames included, since `time += timeRate` is outside the
 * `blackCover` gate but a frozen frame still increments it.
 *
 * ⛓ It is priced by `combat.js` as a 13 px pad already (`threatPad: 13`,
 * `envelopeProof: false`). This function is the exact form, for a stance
 * that has to be proven clear rather than padded.
 *
 * ⚠ It does NOT stop for a ceremony — `Spinner.update` calls it after
 * `super.update()` with no gate — but `Player.hit` does (`Player.as:1380`),
 * so a frozen player is not hit by it. See the file docblock.
 */
export function hammerLine(s, gameTime) {
    const a = ((gameTime % SPINNER.hammerPeriod) / SPINNER.hammerPeriod) * 2 * Math.PI;
    return {
        angle: a,
        x0: s.x,
        y0: s.y,
        x1: s.x + SPINNER.hammerLength * Math.cos(a),
        y1: s.y + SPINNER.hammerLength * Math.sin(a),
    };
}

/**
 * The disc a stance must clear to be safe from a spinner AT A GIVEN
 * POSITION for every hammer phase — the body grown by the hammer's reach.
 *
 * ⚠ A BOUND, AND IT SAYS SO. The exact test is a line at one angle; this is
 * the union over all 45 of them, which is what a stance held for a whole
 * ceremony has to clear anyway.
 *
 * ⛔⛔⛔ R8 SLICE 8 — AND IT IS NO LONGER THE ANSWER, ONLY THE FALLBACK.
 * ⚖ THE USER'S CORRECTION (kickoff §16.8): *"the hammer spins in a
 * predictable pattern; forbidding the whole disc it passes through is
 * wrong."* Measured over the same 60 walkable cells of L18 and the same
 * 600-tick horizon, the disc left **one** clear stance and the exact line
 * left **sixteen** — so the conservative ingredient was not merely costing
 * routes, it had MANUFACTURED the policy problem the slice went on to solve
 * ([[feedback_conservative_ingredient_makes_the_problem]]).
 *
 * ⇒ `hammerHitsPlayer` below is the exact question, and this disc is what a
 * caller falls back to when the CLOCK is undeclared — the union over all 45
 * phases is still the honest answer when the phase is unknowable.
 */
export function hammerReach(s) {
    return { x: s.x, y: s.y, r: SPINNER.hammerLength };
}

/**
 * ⛓⛓⛓ R8 SLICE 8 — ⚖ **THE BILLING RULING, TAKEN FROM THE SOURCE.**
 *
 * The charge asked whether a hammer contact should route through
 * `applyPlayerHit` or keep refusing on the line, and pre-delegated the answer
 * to what the GAME does. It bills, and the call is four arguments long:
 *
 * ```as3
 *   Spinner.as:72-76
 *     var player:Player = FP.world.collideLine("Player", x, y,
 *                            x + hammerLength * Math.cos(hammerAngle),
 *                            y + hammerLength * Math.sin(hammerAngle)) as Player;
 *     if (player) { player.hit(this, hitForce, new Point(x, y)); }
 *   Player.as   public function hit(e:Enemy=null, f:Number=0, p:Point=null, d:Number=1)
 * ```
 *
 * ⇒ FORCE 4 (`Spinner.hitForce`), DAMAGE 1 (`Player.hit`'s own default — the
 * 4 in the call is the force, trap 143 one family over), and the knockback
 * point is the spinner's ENTITY POINT. Nothing about it is special: it is an
 * ordinary priced contact, and the refusal was the conservative era's shape
 * rather than a property of the mechanism.
 *
 * ⛔ AND IT IS THE **SECOND** BILL, NOT THE ONLY ONE. `Enemy.update` calls
 * `hitUpdate(); hitPlayer();` inside the `super.update()` on the line ABOVE
 * the hammer, and `hitPlayer` is `collide("Player", x, y)` -> `p.hit(this, 3,
 * new Point(x, y), damage)`. So a spinner damages through its 7x7 BODY at
 * force 3 and through its 13 px LINE at force 4, in that order, in one frame
 * — and the first one to land sets `hitsTimer` and makes the second a no-op
 * inside `Player.hit`'s own gate. A model that narrowed the refusal to the
 * line and forgot the body would have opened a hole exactly the size of the
 * thing the disc used to cover.
 */
export const HAMMER_BILLING = Object.freeze({
    routes: 'applyPlayerHit',
    force: SPINNER.hitForce,
    /** `Player.hit`'s `d:Number=1` — the call passes three arguments. */
    damage: 1,
    from: 'the spinner ENTITY point (x, y), not a box corner',
    src: 'Enemies/Spinner.as:70-76 + Player.as `hit(e, f, p, d=1)`',
    /** The other arm of the same frame, and it fires FIRST. */
    body: Object.freeze({
        force: 3,
        damage: SPINNER.damage,
        gate: '`!destroy && currentAnim != "die" && hitsTimer <= 0`, on the SPINNER',
        src: 'Enemies/Enemy.as:104-110,211-221',
    }),
    /**
     * ⚠ THE HAMMER HAS NO `destroy` GATE OF ITS OWN. `Spinner.update` runs
     * the line unconditionally after `super.update()`, while `hitPlayer` is
     * inside an `if (!destroy)`. So a spinner mid-`death()` — parked, because
     * the move is gated and the fade is not — KEEPS SWINGING for its eleven
     * fade frames and stops touching you with its body. Two arms, two
     * lifetimes, four lines apart in the source.
     */
    dyingStillSwings: true,
});

/**
 * ⛔⛔⛔ THE HAMMER, AS A CONTACT: does the line at `gameTime` reach this box?
 *
 * `hammerAngle = (Game.time % Game.timePerFrame) / Game.timePerFrame * 2π`
 * and the test is `collideLine("Player", x, y, x + 13·cos a, y + 13·sin a)`.
 * Transcribed AT THE RUNTIME'S OWN PRECISION (trap 118): the endpoints are
 * whatever the doubles say and `collideLineSolid` applies the `int` cast the
 * signature does, which is where the quantisation belongs. A model that
 * rounded the endpoint itself would be a different — and more "accurate" —
 * raycast than the one the game runs.
 *
 * ⚠ THE ENDPOINT IS NEVER SAMPLED. `World.collideLine`'s loop is
 * `while (x < toX)`, so the last pixel of the reach is not tested — the
 * measured skip the crusher's transcription already carries, kept here rather
 * than re-derived.
 *
 * @param {object} s          the spinner state (`x`/`y` are the ENTITY point)
 * @param {number} gameTime   `Game.time` at the TOP of this frame
 * @param {object} playerBox  `{x, y, right, bottom}` — the PRE-move box, because
 *   a spinner updates above the Player (`Game.loadlevel` add order + PREPEND)
 * @returns {{angle, x0, y0, x1, y1}|null} the line that hit, or null
 */
export function hammerHitsPlayer(s, gameTime, playerBox) {
    if (!Number.isFinite(gameTime)) {
        fail(`hammerHitsPlayer: ${gameTime} is not a \`Game.time\`. The angle rides on it `
            + 'and a caller without a clock must ask `hammerReach` — the union over all '
            + `${SPINNER.hammerPeriod} phases — rather than pass a guess.`);
    }
    if (!playerBox || !Number.isFinite(playerBox.right) || !Number.isFinite(playerBox.bottom)) {
        fail('hammerHitsPlayer: playerBox must be a full box — {x, y, right, bottom}. A '
            + 'rect literal missing `right`/`bottom` never overlaps anything and returns '
            + 'a clean, plausible "the hammer missed you".');
    }
    const line = hammerLine(s, gameTime);
    return collideLineSolid([playerBox], line.x0, line.y0, line.x1, line.y1) ? line : null;
}

/**
 * ⛓ Every phase of one full turn at which the hammer would reach this box,
 * for a spinner held at this position.
 *
 * ⛔ THE POSITION IS THE CALLER'S PROBLEM AND THE PHASE IS THIS FUNCTION'S.
 * A spinner MOVES, so "safe at phase p" is only a claim about the tick whose
 * body position was passed in — which is why the danger map asks per (cell,
 * tick) rather than once per cell. What this answers is the other half: given
 * the body HERE, which of the 45 clock residues touch that box.
 *
 * @returns {number[]} the residues `Game.time % 45` that hit, ascending
 */
export function hammerPhasesHitting(s, playerBox) {
    const out = [];
    for (let phase = 0; phase < SPINNER.hammerPeriod; phase += 1) {
        if (hammerHitsPlayer(s, phase, playerBox)) out.push(phase);
    }
    return out;
}

// ── the run-state family (per VISIT — a spinner has no live persistence) ──

/**
 * Per-visit spinner state for one level.
 *
 * ⚠ PER VISIT, like a pushable block and unlike a broken rock. `Spinner`
 * holds `x`/`y`/`v` in instance variables with no persistence at all, so a
 * re-entered level rebuilds every one at its `.oel` cell heading north-east.
 * The only thing that crosses a door is the FLAG a death wrote, and
 * `check()` reads that back to despawn it — which `buildLevelWorld` already
 * does, so a cleared spinner is not in `world.spinners` to begin with.
 */
export function createSpinnerState(world) {
    const byId = new Map();
    for (const p of world.spinners ?? []) byId.set(p.id, newSpinner(p));
    return { byId, level: world.level };
}

/** One tick for every spinner in the level. */
export function stepSpinners(state, ctx = {}) {
    for (const [id, s] of state.byId) state.byId.set(id, stepSpinner(s, ctx));
    return state;
}

/**
 * The live bodies, as rects — what `pushableCtx().collides` has to include
 * and what a stance is proven clear of.
 *
 * ⚠ A spinner mid-`death()` IS STILL SOLID. `destroy` stops the motion and
 * starts the fade; nothing writes `collidable = false`, and the entity is in
 * the `"Enemy"` type list until `FP.world.remove` actually runs. So the
 * filter is `removed`, not `destroy` — a block can be wedged by a spinner
 * that is already dying.
 */
export function spinnerRects(state) {
    const out = [];
    for (const s of state.byId.values()) {
        if (s.removed) continue;
        out.push({ id: s.id, rect: spinnerRect(s), spinner: s });
    }
    return out;
}

/** The flags this visit's spinners have banked by dying, with the cause. */
export function spinnerTerrainWrites(state) {
    const out = [];
    for (const s of state.byId.values()) {
        if (!s.removed || s.persistTag < 0) continue;
        out.push({ id: s.id, tag: s.persistTag, cause: s.deathCause });
    }
    return out;
}

/**
 * ⚖ THE LIST `runFire`'s REFUSAL NARROWS TO.
 *
 * §25.3 made the refusal total: any live enemy in the room and a `moves`
 * press is refused, because the model tracked no enemy position at all. With
 * this file there is exactly ONE class whose position it tracks, and the
 * refusal has to narrow to that and not one class further — an unmodelled
 * enemy in the room is still an uncertifiable glide.
 *
 * ⚠ THE KEY IS THE AS3 CLASS, and the entry says what makes it modellable.
 * A class earns a row by having a `step*` in this package and a per-visit
 * state in `levelRun` — not by being understood.
 */
export const MODELLED_ENEMY_CLASSES = Object.freeze({
    Spinner: Object.freeze({
        module: 'spinner.js',
        why: 'runRange 0 and activeOffScreen true ⇒ the motion is a function of the '
            + 'level geometry and the tick index alone',
        stepped: 'levelRun.advance, ABOVE stepPushables',
        // ⛓ `levelRun.pushableCtx().collides` consults `spinnerRectsNow()`
        // after `world.collidesSolid`, so this body really is in the block's
        // sweep — which is what makes `runFire`'s narrowing sound for it.
        wedgeVisible: true,
    }),
    /**
     * ⛓⛓⛓ R8 SLICE 1 — THE SECOND ROW, AND THE FIRST ONE WHOSE MOTION IS A
     * FUNCTION OF THE PLAYER.
     *
     * A `Spinner` earns its row by being INDEPENDENT of the player: geometry
     * and a tick index, nothing else. A `Bob` is the opposite — every tick of
     * its walk is `atan2` to the player's own position — and it earns the row
     * anyway, because the rule is "a `step*` in this package and a per-visit
     * state in `levelRun`", not "a motion nobody has to think about".
     *
     * ⛔ THE TRANSCRIPTION IS NOT NEW AND IS NOT RE-WRITTEN HERE. `chasers.js`
     * has carried `chaserStep`/`chaseImpulse` exactly since R5 slice 3 and
     * NOTHING has ever called them: the bridge is a call site, not a second
     * model. Two cost models that must agree are one cost model
     * ([[feedback_two_cost_models_must_agree]]).
     *
     * ⚠ WHAT THE ROW DOES *NOT* CLAIM. `chaserStep` is `Enemy.update`'s
     * movement half — the off-screen return, `Mobile.friction`, the two
     * sweeps, and the subclass chase block. `Enemy.update`'s TERRAIN switch
     * (water/lava destroy, the pit fall) is NOT in it, and R7 slice 6e's L6
     * despawn is the standing witness that the game's own water is what
     * removes a body the model therefore cannot remove. `levelRun` prices the
     * i-frame drain and the contact; the terrain arm stays a declared
     * `despawn` until a slice needs to earn it.
     */
    Bob: Object.freeze({
        module: 'chasers.js',
        why: 'the walk is `atan2` to the player and a bang-bang impulse toward `toV` — a '
            + 'function of live state the run already holds, transcribed exactly since R5 '
            + 'slice 3 and unwired until R8 slice 1',
        stepped: 'levelRun.advance, the LAST enemy slot — `Game.as:2141` adds `bob` FIRST '
            + 'of the enemy families and `World.addUpdate` PREPENDS, so a Bob updates '
            + 'AFTER every other enemy in the room and immediately BEFORE the Player',
        /**
         * ⛔⛔⛔ FALSE, AND THIS FIELD EXISTS BECAUSE OF IT.
         *
         * `runFire`'s refusal narrows to this roster, and its REASON is the
         * block wedge: `PushableBlock`'s ctor pushes "Enemy", so a body in
         * the glide corridor stops the block permanently. `levelRun`'s
         * `pushableCtx().collides` models that arm for SPINNERS ONLY — a
         * stepped bob is invisible to a block's sweep. So "the model steps
         * it" and "the model would predict its wedge" are DIFFERENT CLAIMS,
         * and a row that answered only the first would have narrowed a
         * refusal the model cannot honour: the press would be certified and
         * the real block would jam.
         *
         * ⇒ the roster answers the second question too, per row, and
         * `enemiesUnseenByBlockSweep` reads THIS field rather than mere
         * membership. Feeding chaser bodies into the block sweep is what
         * would flip it — and that moves L8/L39/L40 block sweeps, which is a
         * re-record this rung has no licence for.
         * ([[feedback_capability_lights_up_two_controls]].)
         */
        wedgeVisible: false,
    }),
});

/**
 * ⛔ THE QUESTION `runFire` REALLY ASKS: which live bodies in this census
 * would be INVISIBLE to a pushable block's own sweep?
 *
 * ⚠ THIS IS NOT "which classes does the model step", and R8 slice 1 is where
 * the two came apart. Membership in `MODELLED_ENEMY_CLASSES` says a class has
 * a stepper and a per-visit position; `wedgeVisible` says `levelRun`'s
 * `pushableCtx().collides` really consults that body. `runFire`'s refusal is
 * about the WEDGE, so it is the second question — and a predicate that read
 * membership would have silently certified a glide the moment `Bob` earned a
 * row, because a stepped bob is not in the block's sweep at all.
 *
 * ⇒ named for the question, not for the table: a caller cannot reach for this
 * one meaning to ask the other. `MODELLED_ENEMY_CLASSES` is still the roster;
 * this is one field of it.
 */
export function enemiesUnseenByBlockSweep(enemies = []) {
    const names = new Set();
    for (const e of enemies) {
        if (e.removed) continue;
        const as3 = e.as3 ?? e.tag;
        if (MODELLED_ENEMY_CLASSES[as3]?.wedgeVisible !== true) names.add(as3);
    }
    return [...names];
}
