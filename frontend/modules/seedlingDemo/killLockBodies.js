/**
 * seedlingDemo/killLockBodies — the switches for slice `seedling-fidelity-killlock` (planner
 * `seedling-fidelity-planning-3`, wave 8). With every switch false the model is byte-identical to the one before the
 * slice; they ship OFF because turning them on moves committed artifacts (the measured movers are in the slice's
 * report, `CC/docs/cloud-reports/seedling-fidelity-killlock.md`), and a re-record is the user's licence to give.
 *
 * ⛔ The survey refused L60 ×6, L71 ×2 and L99 with *"the kill work order has no weapon — level N tracks NO live
 * spinner bodies in this run"*. The rooms hold no spinner. A `tset == -1` lock opens on `Game.totalEnemies() == 0`
 * (`Puzzlements/Lock.as:111`, `Game.as:1855-1882`), and L60's count is two `Jellyfish`, L71's five `LavaRunner`,
 * L99's three `LavaRunner`, L98's three `Jellyfish` plus one `IceTurret`. The run stepped none of the chasers (no
 * `MODELLED_ENEMY_CLASSES` row), so the kill work order's only arm that asks for a live body — the spinner press
 * arm — found none, and the census rows stayed "alive for as long as the world carries them" for ever.
 *
 * K1 — `jellyfishLive`: `chasers.CHASERS.jellyfish` (transcribed since R5, called by nothing) joins the bridged
 *     roster, its terrain switch reads `combat.ENEMY_CLASSES.jellyfish.terrain` (it survives water and lava and never
 *     falls: `Jellyfish.as:31-37`), and `enemyDamage.KILL_ARM_POLICY.Jellyfish` reads `modelled`.
 * K2 — `lavaRunnerLive`: the same for `LavaRunner` (`Enemies/LavaRunner.as`, a `Bob` with a 12x12 box, `hitsMax` 2,
 *     a 9-frame "die" at rate 15, its whole update behind `Game.freezeObjects`, and `moveSpeed` re-chosen each tick
 *     by the tile under it: 1 on water/lava, 1.5 elsewhere).
 * K4 — `turretRemovalLedger`: an `IceTurret` kill is a CORPSE (`death()` consumes the first `destroy`), and
 *     `classCount(IceTurret)` moves only when the corpse is later destroyed by a fatal tile — water or lava under it,
 *     `Enemy.update`'s switch with `dieInWater = hits >= hitsMax`, or a pit (`iceTurret.js` steps all of it). L98's
 *     turret stands ON water (`iceturret@104,24`'s body centre (120,40) is tile (7,2), Water), so its sword kill
 *     drowns on the next update and the fade removes it. With K4 the removal runs the kill-lock ledger (with every
 *     removed chaser and turret gone) and the solver's count drops the removed corpse.
 * K5 — `darkShieldIceTurret`: `Player.shieldBump` hits every `"Enemy"` its shield touches, an `IceTurret` included,
 *     and with the DARK shield that is `hit(5, p, 0.5, "Shield")` (damage, the i-frame, the `hitByDarkStuff` latch).
 *     The model's bump reached chasers, spinners and the BobBoss only; measured on the game (`killlock-l98-turret`:
 *     the turret's hits go 0 → 0.5 → 2.5 → 3 under a facing tap, a sword, a facing tap).
 * K3 — `chaserKillArm`: the kill work order (`solverBot.resolveKillStrategy`) gains a `chaser` arm: when every
 *     counted body left is a live stepped chaser, kill them one at a time with the combat ladder's own chaser arm
 *     (`deriveKillByChaser` + the strike policy), then raise the model-sourced declaration the ceiling arm raises.
 *
 * THE SWITCHES are read at CALL time:
 *   - node: `SEEDLING_KILLLOCK_BODIES=all|none|<keys>` in the environment, read once at import;
 *   - a test: `withKillLockBodies({ jellyfishLive: true }, () => …)`, which restores the previous values.
 * ⛔ The browser has no such hook on purpose: the page and its solve worker run the defaults.
 */
export const KILLLOCK_BODIES = {
    jellyfishLive: false,
    lavaRunnerLive: false,
    chaserKillArm: false,
    turretRemovalLedger: false,
    darkShieldIceTurret: false,
};
/** The defaults this slice shipped. */
export const KILLLOCK_BODIES_DEFAULTS = Object.freeze({ ...KILLLOCK_BODIES });
export const KILLLOCK_BODIES_KEYS = Object.freeze(Object.keys(KILLLOCK_BODIES));

/** Census tag → the switch that bridges it. */
export const KILLLOCK_SWITCHED_CHASERS = Object.freeze({
    jellyfish: 'jellyfishLive',
    lavarunner: 'lavaRunnerLive',
});

/** Is this census tag bridged by a switch that is ON? */
export function killLockBridged(tag) {
    const k = KILLLOCK_SWITCHED_CHASERS[tag];
    return k !== undefined && KILLLOCK_BODIES[k] === true;
}

const envFlags = globalThis.process?.env?.SEEDLING_KILLLOCK_BODIES;
if (envFlags) {
    const want = envFlags === 'all' ? KILLLOCK_BODIES_KEYS
        : (envFlags === 'none' ? [] : envFlags.split(',').map((k) => k.trim()).filter(Boolean));
    for (const k of KILLLOCK_BODIES_KEYS) KILLLOCK_BODIES[k] = false;
    for (const k of want) {
        if (!KILLLOCK_BODIES_KEYS.includes(k)) {
            throw new Error(`killLockBodies: SEEDLING_KILLLOCK_BODIES names "${k}"; the keys are ${KILLLOCK_BODIES_KEYS.join(', ')}`);
        }
        KILLLOCK_BODIES[k] = true;
    }
}

/** Run `fn` with some switches set, then restore them (also on a throw; after the promise, for an async `fn`). */
export function withKillLockBodies(over, fn) {
    const before = { ...KILLLOCK_BODIES };
    for (const [k, v] of Object.entries(over)) {
        if (!KILLLOCK_BODIES_KEYS.includes(k)) throw new Error(`withKillLockBodies: unknown switch "${k}"`);
        KILLLOCK_BODIES[k] = v === true;
    }
    let out;
    try {
        out = fn();
    } catch (e) {
        Object.assign(KILLLOCK_BODIES, before);
        throw e;
    }
    if (out && typeof out.then === 'function') return out.finally(() => Object.assign(KILLLOCK_BODIES, before));
    Object.assign(KILLLOCK_BODIES, before);
    return out;
}
