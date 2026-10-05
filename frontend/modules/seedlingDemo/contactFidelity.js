/**
 * seedlingDemo/contactFidelity — the switches for slice `seedling-fidelity-terrain` (planner
 * `seedling-fidelity-planning-3`, wave 6). Every one is OFF: with all of them false the model is byte-identical to
 * the one before the slice. Each names the AS3 it transcribes and the game rows that measured it
 * (`probe-seedling-contact-divergence.mjs`, `replay-seedling-contact-capture.mjs`).
 *
 * ⛔ The divergence sweep filed these rows as "terrain": a 1.3–2.7 px jump on both axes. They are not terrain. The
 * held compare read the game's `hits` 0 → 1 at the divergence tick itself on every reproduced row: each one is a
 * CONTACT KNOCKBACK, `Player.hit(e, 3, …)` → `knockback(3, …)`, that one side billed and the other did not.
 */

/**
 * W1 — `World.collideLine` STEPS IN `Number`, NOT `int`.
 *
 *     World.as:411   collideLine(type, fromX:int, fromY:int, toX:int, toY:int, …)
 *     World.as:434   x:Number = fromX, y:Number = fromY …   x += xSign; y += ySign;
 *     World.as:389   collidePoint(type, pX:Number, pY:Number)   →   Entity.collidePoint(x, y, pX:Number, pY:Number)
 *
 * Only the four END POINTS are cast to `int`. The minor axis then advances by a fraction, and every sampled point is
 * tested as the `Number` it is. `crusher.collideLineSolid` truncated each sampled point as well. Against a solid with
 * integer bounds (a tile, a placed entity) the two agree for every non-negative point. Against the PLAYER'S box
 * (fractional bounds) they do not: a wallflyer launched horizontally carries `-4·sin(π)` = −4.9e-16 in `vy`, so its
 * ray's `toY` casts to `y − 1`, and the game's ray falls from y to y − 1 across 160 px where the model's sat at
 * y − 1 from its first step. Measured: L27 `wallflyer@192,48` launches on t13 in the game and t12 in the model
 * (player box bottom 55.65 vs the game's ray at y ≈ 55.8); L25 `wallflyer@48,48` launches a tick LATE (the mirror).
 */
//   → `CONTACT_FIDELITY.collideLinePointsExact`

/**
 * W2 — THE PLAYER'S SWORD HITS A WALLFLYER.
 *
 *     Player.as:99    hitables = ["Enemy", …]           (a WallFlyer is `type = "Enemy"`)
 *     Player.as:917   if (!collideLine("Solid", x, y, v[i].x, v[i].y) || …) genericHit(v[i])
 *     genericHit      `e is Enemy` → e.hit(swordForce 5, Point(x, y), swordDamage, "Sword")
 *     Enemy.as:140    hit(): hits += d; hitsTimer = 30; knockback(f, p)   — WallFlyer.knockback is `v = -v`
 *
 * The model's press census synthesizes live responders for the bridged chasers only, so a slash whose rect
 * covered a wallflyer reached NOTHING: no hit, no i-frame, no reversal — a silent zero, not even the refusal
 * `KILL_ARM_POLICY.WallFlyer` would have raised. Measured: L22 t43 `wallflyer@48,112` and L25 t51
 * `wallflyer@48,48` take `hits_timer` 30 and reverse in the game; the model's fly on, and the model later bills a
 * contact (L22 t52 `wallflyer@64,80`, struck at t46) that the game's i-frame refuses. Flag ON: the run hands the
 * wallflyers to the census as `Enemy`-arm responders (`family: 'wallflyer'`), and the arm runs `slash()`'s two
 * gates (the reach, the line of sight) and then `wallFlyer.hitWallFlyer`. A KILL is refused by name, as the dark
 * suit's retaliation is: the die anim's ledger consequence is not staged for this class.
 */
//   → `CONTACT_FIDELITY.wallFlyerSwordHits`

/**
 * W3 — THE DRILL IS A LIVE BODY (`drill.js`, `Enemies/Drill.as`).
 *
 * The model had no drill: `contactPricing('drill')` is a `mover`, so the run threw only if the player stood in the
 * PLACEMENT and billed nothing anywhere else. Measured: L88 `drill@128,160` hops (120,184) → (104,168) on t47 and
 * its contact knocks the player +2.5 px on t48 (`hits` 0 → 1); the model's player walks on. Flag ON: in a room whose
 * ONLY census enemy is one drill (L88), `levelRun.stepDrillsNow` steps it in its slot and bills its contact through
 * `applyPlayerHit`, a slash reaches it (`Enemy.hit`, an empty knockback), and a kill is refused by name. Any other
 * drill room (L28 with a BobSoldier, L91 with three bobs) is unchanged and stays residue.
 */
//   → `CONTACT_FIDELITY.drillLive`

/**
 * THE SWITCHES. All OFF: the model is byte-identical to the one before the slice. They are read at CALL time, so a
 * measurement can turn them on without editing this file:
 *   - node: `SEEDLING_CONTACT_FIDELITY=all` (or a comma list of the keys) in the environment, read once at import;
 *   - a test: `withContactFidelity({ drillLive: true }, () => …)`, which restores the previous values.
 * ⛔ The browser has no such hook on purpose: the page and its solve worker run the defaults.
 */
export const CONTACT_FIDELITY = {
    collideLinePointsExact: false,
    wallFlyerSwordHits: false,
    drillLive: false,
};
export const CONTACT_FIDELITY_KEYS = Object.freeze(Object.keys(CONTACT_FIDELITY));

const envFlags = globalThis.process?.env?.SEEDLING_CONTACT_FIDELITY;
if (envFlags) {
    const want = envFlags === 'all' ? CONTACT_FIDELITY_KEYS : envFlags.split(',').map((k) => k.trim()).filter(Boolean);
    for (const k of want) {
        if (!CONTACT_FIDELITY_KEYS.includes(k)) {
            throw new Error(`contactFidelity: SEEDLING_CONTACT_FIDELITY names "${k}"; the keys are ${CONTACT_FIDELITY_KEYS.join(', ')}`);
        }
        CONTACT_FIDELITY[k] = true;
    }
}

/** Run `fn` with some switches set, then restore them (also on a throw; after the promise, for an async `fn`). */
export function withContactFidelity(over, fn) {
    const before = { ...CONTACT_FIDELITY };
    for (const [k, v] of Object.entries(over)) {
        if (!CONTACT_FIDELITY_KEYS.includes(k)) throw new Error(`withContactFidelity: unknown switch "${k}"`);
        CONTACT_FIDELITY[k] = v === true;
    }
    let out;
    try {
        out = fn();
    } catch (e) {
        Object.assign(CONTACT_FIDELITY, before);
        throw e;
    }
    if (out && typeof out.then === 'function') return out.finally(() => Object.assign(CONTACT_FIDELITY, before));
    Object.assign(CONTACT_FIDELITY, before);
    return out;
}
