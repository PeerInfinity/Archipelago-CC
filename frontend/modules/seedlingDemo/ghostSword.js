/**
 * ghostSword — ⛓⛓⛓ SEEDLING FIDELITY GHOSTSWORD: THE GHOST SWORD'S PRESS, TRANSCRIBED.
 *
 * ⚖ The user (2026-10-05): *"The first priority is to expand the model to include everything in the game."* Wave 9's
 * GHOSTSWORD slice. The route survey's whole endgame (ten steps, L101–L115) refused on this one item: `levelRun`
 * THREW on a ghostsword press, and the break verb refused a `breakablerockghost` because only the plain sword broke a
 * rock "in this model". This module is the press's arithmetic; `levelRun.applyThrust` is its executor and
 * `presses.swordWindowStep` its window, all behind `GHOSTSWORD_PRESS` (below; ON).
 *
 * ── WHAT THE GAME DOES (`Player.as`, the AS3 the wasm builds are compiled from) ─────────────────────────────────
 *
 *   `useItem`       case 0 AND case 4 are one arm: `if (slashDelay <= 0) slashing = true` (`:1579-1585`). So a
 *                   ghostsword press is `set slashing` — the SAME four outcomes (dash · slash · swallowed · gated) —
 *                   and nothing about the item reaches the setter except its `hasSword || hasGhostSword` gate.
 *   `getSword()`    `hasGhostSword ? sprGhostSword : …` (`:616-632`), re-read at the TOP of every `update()`
 *                   (`:479`). ⛔ So the WEAPON is the FLAG, not the slot: a slot holding the plain sword's id (or an
 *                   index past the end, `getItem` → 0) swings the GHOST sword while `hasGhostSword` is up.
 *   the sprite      `Spritemap(imgGhostSword, 24, 7)` — 24 wide, 7 high.
 *   the rect        `getSlashRect` (`:931-952`): `h = hasGhostSword ? width*2 : height` = **48**, so the rect is
 *                   24 along the swing and 48 ACROSS it — a superset of the sword's 16 x 32, anchored the same way.
 *                   ⛔ The scale is ALWAYS 1: `render`'s squash is `currentAnim == "slashnarrow" && !hasGhostSword`
 *                   (`:1260`), so a ghost DASH swings the full 24 x 48 (it rotates the sprite instead).
 *   the reach       `slash()`'s distance gate is `slashingSprite.width * scaleX` = **24** (point to box; centre to
 *                   centre for Grass).
 *   the line        `!collideLine("Solid", …) || hasGhostSword || …` (`:917`) — ⛔ WAIVED FOR EVERY TARGET. The
 *                   ghost sword cuts through walls.
 *   the arm         `genericHit(v[i], hasGhostSword ? "Spear" : "Sword", swordForce, ghostSwordDamage)` (`:924`):
 *                   type **"Spear"**, force 5 (`swordForce`), damage **2** (`ghostSwordDamage`, `:113`) — and
 *                   `spearDirection = direction` first (`:919-922`), the facing NOW, not the latched swing.
 *   the window      `sprGhostSword.add("slash", [0,1,2,2,3,3,4], 30)` and `("slashnarrow", [0,1,2,3], 20)`
 *                   (`:399-404`): under the `FP.elapsed` clamp a swing wraps on update 8 and a dash on update 7 —
 *                   **7** and **6** hit tests (the sword's are 5 and 4).
 *   ⛔ the caller   `slash()` is called from `update()` ONLY `if (hasSword)` (`:560-563`). A ghost sword with no
 *                   sword sets `slashing` (the sprite plays, the dash timer is written) and NEVER TESTS — and the
 *                   `slashTimer` decrement lives in `slash()` too. That state is REFUSED here by name, not modelled.
 *
 * ── WHAT `genericHit` DOES WITH "Spear" THAT IT DOES NOT DO WITH "Sword" (the press's per-class table) ────────────
 *
 *   `Enemy`            `hit(5, p, 2, "Spear")` — two damage, the same knockback and i-frame (`Enemy.hit`).
 *   `BreakableRock`    `hit(hasGhostSword ? 1 : 0)` — the FLAG, not `t`: rockType 0 AND 1 break (`:1093`).
 *   `LightPole`        `if (t == "Spear") hit()` — a ghost swing TOGGLES a pole; a sword swing never does.
 *   `Tile` (bridge)    `if (t == "Spear") bridgeOpeningTimer--` — and on EVERY one of the seven tests.
 *   `Grass`/`Tree`     `cut(t)` / `hit(t)` — inert either way (no geometry, no persistence).
 *   `RopeStart`        `hit()` — no `t`; pulled exactly as by the sword (the reach is 24 now).
 *   `PushableBlockSpear`  `hit(<spearDirection's unit>, t, true)` — the RELATIVE arm, which ignores `t`.
 */

import { SLASH_SPRITES, SWORD_DAMAGE, animCompleteTicks, slashRect as combatSlashRect } from './combatVerbs.js';
import { PROFILE } from './seedlingProfile.js';

/**
 * ⛓ THE SWITCH — ON by default. ON, the press is modelled (this module + `levelRun` + the break verb's row); OFF is
 * the BEFORE model, which THROWS on a ghostsword press exactly as it did since R5. Measured with it ON (D2): every
 * committed tape replays byte-identically (tapeRunner's 557 pre-slice rows) and all six producer `--check`s are
 * unmoved — no committed run ever held the ghost sword — so it ships ON, as fidelity BOBSOLDIER's switches did. The
 * three witnesses (`ghostsword-l3-rockghost`, `ghostsword-l3-rock`, `ghostsword-l30-bobsoldier`) need it ON.
 *
 * The node measuring hook: `SEEDLING_GHOSTSWORD=0` (or `off`) turns it OFF for a process, `1`/`on` ON.
 */
export const GHOSTSWORD_PRESS = { enabled: true };
export const GHOSTSWORD_PRESS_DEFAULT = true;

const envFlag = globalThis.process?.env?.SEEDLING_GHOSTSWORD;
if (envFlag !== undefined && envFlag !== '') {
    GHOSTSWORD_PRESS.enabled = envFlag === '1' || envFlag === 'on' || envFlag === 'true';
}

/** Run `fn` with the switch set to `on`, restoring it after (a test's and a measuring script's door). */
export function withGhostSwordPress(on, fn) {
    const was = GHOSTSWORD_PRESS.enabled;
    GHOSTSWORD_PRESS.enabled = on;
    try {
        return fn();
    } finally {
        GHOSTSWORD_PRESS.enabled = was;
    }
}

/** `Player.ghostSwordDamage` (`Player.as:113`). */
export const GHOST_SWORD_DAMAGE = SWORD_DAMAGE.ghostsword;

/** `genericHit`'s `t` for a ghost swing — `hasGhostSword ? "Spear" : "Sword"` (`Player.as:924`). */
export const GHOST_SWORD_HIT_TYPE = 'Spear';

/** The distance gate, `slashingSprite.width * scaleX` with the scale pinned at 1 — 24 px. */
export const GHOST_SWORD_REACH = SLASH_SPRITES.ghostsword.w;

/** `Player.as:399-400`, the two frame lists, and `swordSpeed` / `swordSpeedDash`. */
export const GHOST_SWORD_FRAMES = Object.freeze({
    slash: Object.freeze([0, 1, 2, 2, 3, 3, 4]),
    slashnarrow: Object.freeze([0, 1, 2, 3]),
});

/**
 * The hit tests a ghost swing buys, per animation — derived under the `FP.elapsed` clamp exactly as the sword's
 * (`combatVerbs.animCompleteTicks`): **7** for a swing, **6** for a dash.
 */
export const GHOST_SLASH_ANIM_TICKS = Object.freeze({
    slash: animCompleteTicks(GHOST_SWORD_FRAMES.slash.length, PROFILE.swordAnimRate),
    slashnarrow: animCompleteTicks(GHOST_SWORD_FRAMES.slashnarrow.length, PROFILE.swordAnimRateDash),
});

/** The ghost swing's hit-test count for `anim` (null/undefined = the plain swing, as `slashHitTicksFor`). */
export function ghostSlashHitTicksFor(anim) {
    if (anim === undefined || anim === null) return GHOST_SLASH_ANIM_TICKS.slash;
    const n = GHOST_SLASH_ANIM_TICKS[anim];
    if (!Number.isInteger(n)) {
        throw new Error(`ghostSlashHitTicksFor: unknown slash animation ${JSON.stringify(anim)}; know `
            + `${Object.keys(GHOST_SLASH_ANIM_TICKS).join(', ')}`);
    }
    return n;
}

/** `getSlashRect()` under `hasGhostSword`: 24 along the swing, 48 across it, scale 1 (`combatVerbs.slashRect`). */
export function ghostSlashRect(x, y, direction) {
    return combatSlashRect(x, y, direction, { sword: 'ghostsword' });
}

/**
 * ⛓ THE PER-CLASS TABLE (D1), as data: what `genericHit(e, "Spear", 5, 2)` does to each responder a ghost swing
 * can collect, and what the model does with it. `model` is one of `modelled` (the run's per-visit state takes it),
 * `inert` (the arm changes nothing observable) or `refused` (real, unmodelled, a throw that names the row).
 */
export const GHOST_PRESS_ARMS = Object.freeze({
    Enemy: { game: '`Enemy.hit(5, p, 2, "Spear")`: two damage, the knockback, the i-frame', model: 'modelled',
        why: 'the per-class kill arms (`KILL_ARM_POLICY`) with `d` 2 and `t` "Spear"' },
    IceTurret: { game: '`bump(p, "Spear")` (refused: not Fire/Pulse) then `Enemy.hit(…, 2, "Spear")`',
        model: 'modelled', why: 'the turret arm with `d` 2' },
    BreakableRock: { game: '`hit(hasGhostSword ? 1 : 0)` — rockType 0 and 1 both break', model: 'modelled',
        why: '`rockBreaksUnder` reads the flag' },
    RopeStart: { game: '`hit()` — no `t`', model: 'modelled', why: '`pullRope`, the sword\'s arm at reach 24' },
    LightPole: { game: '`if (t == "Spear") hit()` — a ghost swing TOGGLES it', model: 'modelled',
        why: 'the pole arm (its own `hitsTimer` refuses the repeat tests)' },
    Tile: { game: '`if (t == "Spear") bridgeOpeningTimer--` on every test', model: 'refused',
        why: 'the bridge model counts ONE decrement per press (the spear\'s single thrust); a ghost swing decrements '
            + 'on each of its seven tests, which shortens the opening — not transcribed' },
    PushableBlockSpear: { game: '`hit(<facing NOW>, t, true)` — the relative arm, `t` ignored', model: 'refused',
        why: 'the push direction is `spearDirection = direction` (the facing at the TEST, not the latched swing), on '
            + 'up to seven tests — not transcribed' },
    Grass: { game: '`cut("Spear")`', model: 'inert', why: 'no geometry, no persistence' },
    Tree: { game: '`hit("Spear")` — an empty body', model: 'inert', why: 'empty' },
});

/**
 * ⛔ The one inventory a ghost swing is refused for by name: `hasGhostSword` without `hasSword`. `slash()` — the
 * hit test AND the `slashTimer` decrement — is called only `if (hasSword)` (`Player.as:560-563`).
 * @returns {?string} the refusal, or null when the swing tests
 */
export function ghostSwingRefusal(inventory) {
    if (inventory?.hasGhostSword && !inventory?.hasSword) {
        return 'the run holds the GHOST SWORD and not the sword: `Player.update` calls `slash()` only `if (hasSword)` '
            + '(`Player.as:560-563`), so the swing plays and NEVER TESTS, and `slashTimer` never counts down — a state '
            + 'this model does not carry. Refused by name rather than modelled as a swing that hits.';
    }
    return null;
}
