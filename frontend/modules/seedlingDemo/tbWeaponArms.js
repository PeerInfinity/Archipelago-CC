/**
 * ⛓⛓ hammer-phase TB-WEAPONS (`TB_WEAPON_ARMS`, `SEEDLING_TB_WEAPON_ARMS`, OFF) — **THE TENTACLED BEAST'S VERB, PER WEAPON.**
 *
 * `solverBot.resolveTentacleBeastStrategy` serves only a run that holds a sword: *"a tentacle dies to one sword hit
 * while it sits; this run holds no sword"*. By source a tentacle (`Tentacle.as:50-52,66`: `type = "Enemy"`,
 * `hitsMax` 1, `canHit` while it sits) dies to anything that reaches `Enemy.hit` while it sits — the Spear's thrust
 * (`Player.spear()`, `genericHit(…, "Spear", …)`) and the Wand's shot (`WandShot.checkEntity`, `Enemy.hit(…, "Wand")`)
 * as much as the sword's swing. The model already carries the Spear's arm on a tentacle (`levelRun.tentacleSlashNow`,
 * `gameSpear`); the policy (`tentacleBeastPolicy.js`) was the sword's alone: its strike test is the sword's rect and
 * reach, its stand-off the sword's 16 px, its re-press guard the sword's `slashing`.
 *
 * ON, this module hands the policy a WEAPON ROW for a bladeless run, read from the press model (no level, no body and
 * no coordinate named here):
 *   · `lands(x, y, dir, t)` — the press rect the model collides (`spearArm.spearStrikeGeometry`: `spearHitRect`,
 *     `pressRectTouches`) against the tentacle's box (`tentacleRect`), then the model's reach gate;
 *   · `period` — the ticks after a press before another press starts a thrust (`SPEAR_ANIM_TICKS`; a press while
 *     `spearing` is up is swallowed by `set spearing`);
 *   · `extent` — how far ahead of the player the rect reaches, MEASURED off the rect itself (`rect(0, 0, up)`), so a
 *     stand-off is the sword's plus the extra reach.
 * The sword keeps no row: its policy is today's, byte for byte, ON or OFF.
 *
 * ⛔ THE WAND HAS NO ROW YET, BY NAME. The game's shot kills a sitting tentacle (above), but the model's shot never
 * meets one: `levelRun.wandShotBlockerAt` classifies `world.collidesSolid`, the woken totems, the spinners and (behind
 * `wandShotChaserBodies`) the chasers, and no tentacle — so a shot fired at a sitting tentacle flies through it, and a
 * Wand policy played on a fork could never open the mouth (measured at the base: all five variants, all three L57
 * arrivals, "the mouth is not open after 6000 ticks" or a death). That is fidelity's model (`levelRun.js`), so the
 * Wand arm REFUSES by name here until the model's shot sees a tentacle (TB-WEAPONS report §9, the hand-over).
 *
 * OFF nothing here is read: the resolver's sword-only refusal stands, word for word.
 */
import { distanceRectPoint, INVENTORY_ITEM_IDS, tentacleRect } from './solverView.js';
import { spearStrikeGeometry } from './spearArm.js';

export const TB_WEAPON_ARMS = {
    enabled: globalThis.process?.env?.SEEDLING_TB_WEAPON_ARMS === '1',
};
export const TB_WEAPON_ARMS_DEFAULT = false;

/** `rows` built (a fight served with a non-sword weapon), `refusals` the bladeless runs the arm still refused. */
export const TB_WEAPON_ARMS_COUNTS = { rows: 0, refusals: 0 };

export function resetTbWeaponArmsCounts() {
    for (const k of Object.keys(TB_WEAPON_ARMS_COUNTS)) TB_WEAPON_ARMS_COUNTS[k] = 0;
}

/** Run `fn` with `TB_WEAPON_ARMS` set to `enabled`, restoring the previous value (`withSpearArm`'s shape). */
export function withTbWeaponArms(enabled, fn) {
    const was = TB_WEAPON_ARMS.enabled;
    TB_WEAPON_ARMS.enabled = enabled === true;
    const restore = () => { TB_WEAPON_ARMS.enabled = was; };
    try {
        const out = fn();
        if (out && typeof out.then === 'function') return out.finally(restore);
        restore();
        return out;
    } catch (e) {
        restore();
        throw e;
    }
}

/** The direction ids the press model takes (0 right, 1 up, 2 left, 3 down). */
const UP = 1;

/**
 * The weapon row for a press geometry (`spearStrikeGeometry`'s shape: `weapon`, `rect`, `touches`, `reach`, `period`).
 * Exported for the unit rows; the verb builds it through `tentacleWeaponArm`.
 */
export function tentacleWeaponRow(geometry) {
    const probe = geometry.rect(0, 0, UP);
    const extent = Math.round(probe.bottom - probe.y);
    return Object.freeze({
        weapon: geometry.weapon,
        period: geometry.period,
        extent,
        lands(x, y, dir, t) {
            const box = tentacleRect(t);
            if (!geometry.touches(geometry.rect(x, y, dir), box)) return false;
            return distanceRectPoint(x, y, box) <= geometry.reach;
        },
    });
}

/**
 * The arm the verb fights with, for the run's bag and slot array: `null` when the switch is off or the run holds a
 * sword (today's policy serves it); else `{ weapon, slot, row }` for a weapon with a row, or `{ refusal }` naming why
 * the bladeless run is still not served.
 */
export function tentacleWeaponArm(inventory, inventorySlots) {
    if (!TB_WEAPON_ARMS.enabled) return null;
    const inv = inventory ?? {};
    if (inv.hasSword) return null;
    const slots = inventorySlots ?? [];
    if (inv.hasSpear && !inv.hasGhostSword) {
        const slot = slots.indexOf(INVENTORY_ITEM_IDS.spear);
        if (slot >= 0) {
            TB_WEAPON_ARMS_COUNTS.rows += 1;
            return { weapon: 'spear', slot, row: tentacleWeaponRow(spearStrikeGeometry()) };
        }
    }
    TB_WEAPON_ARMS_COUNTS.refusals += 1;
    if (inv.hasWand || inv.hasFireWand) {
        return { refusal: 'a tentacle dies to one sword or spear hit while it sits, and to a wand shot in the game '
            + '(`WandShot.checkEntity` → `Enemy.hit`); this run holds no sword and no spear, and the model\'s wand shot '
            + 'does not meet a tentacle (`levelRun.wandShotBlockerAt` has no tentacle arm), so no Wand play can be '
            + 'checked on a fork' };
    }
    return { refusal: 'a tentacle dies to one sword or spear hit while it sits; this run holds neither' };
}
