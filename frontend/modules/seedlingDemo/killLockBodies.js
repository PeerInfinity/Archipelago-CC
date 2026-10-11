/**
 * seedlingDemo/killLockBodies — the switches for slice `seedling-fidelity-killlock` (planner
 * `seedling-fidelity-planning-3`, wave 8). With every switch false the model is byte-identical to the one before the
 * slice; they shipped OFF because turning them on moves committed artifacts (the measured movers are in the slice's
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
 *   - the browser (⚖ the user, 2026-10-10, fidelity's ask): the flashPanel settings
 *     `flashPanel.seedlingKillLock<Key>` (one boolean per switch, schema default = `KILLLOCK_BODIES_DEFAULTS`).
 *     The panel applies them to ITS module instance (`applyKillLockBodies`); the JS runtime page gets them as
 *     `?killLockBodies=<keys>|none` (the env grammar) and applies them before its first run — a change re-mounts
 *     the page, because a session played under one set cannot be replayed under another. A solve worker imports
 *     its own copy, so the switch set TRAVELS WITH THE REQUEST: the solve services stamp `killLockBodies` on a
 *     request made off-default (`killLockBodiesStamp`), and the solve runs under it and stamps its plan. ⚖
 *     "Identical plans on every machine": at the defaults nothing is stamped — the request is byte-identical to
 *     the one before the hook — so a plan made off-default is always LABELLED.
 */
/**
 * ⚖ THE DEFAULTS (user, 2026-10-06; flipped at the wave-8 harvest by `seedling-fidelity-planning-4`): K1, K3, K4 and
 * K5 ON; K2 `lavaRunnerLive` stays OFF. Its lavarunner GAME witness now exists (STATICLADDER D3,
 * `staticladder-k2-step190-lavarunner`), and the user licensed the flip on 2026-10-10, but the wave-10 harvest
 * measured movers the licence did not list: `R8_ENEMY_BRIDGE`'s declared scope (+ lavarunner) and the LADDER2 L75
 * chain witness (a live lavarunner's on-screen test falls inside `Game.shake`'s jiggle and refuses). Held OFF until
 * the user rules on those.
 * ⛓ seedling-fidelity-k2prep (wave 11) made every one of those rows green with K2 OFF AND ON, still shipping OFF:
 * the scope joins under the switch (`R8_ENEMY_BRIDGE.pendingSwitchScope`, + `axe-l71-reach-l76`); the L75 chain
 * walk's refutation was `LavaChain.reach`'s `"Enemy"` arm, now stepped (`levelRun.stepLavaChainsNow`), and the
 * walk is the game's with K2 ON; the shake band was the GRENADE arms', and a replay reads the game's recorded
 * camera there (`tapeRunner` `cameraWitness`); the refused-class controls are `IceTrap` (`canHit = false`). The
 * complete K2-ON mover list is that slice's report (`CC/docs/cloud-reports/seedling-fidelity-k2prep.md`).
 * ⚖ (user, 2026-10-10, "Yes to all") K2 ON at the wave-11 harvest, on that list: all five switches are ON.
 */
export const KILLLOCK_BODIES = {
    jellyfishLive: true,
    lavaRunnerLive: true,
    chaserKillArm: true,
    turretRemovalLedger: true,
    darkShieldIceTurret: true,
};
/** The defaults (the user's ruling above; the slice shipped every switch OFF). */
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

/**
 * The switch set a `SEEDLING_KILLLOCK_BODIES` / `?killLockBodies=` value names: `all`, `none`, or the keys that
 * are ON, comma-separated (every other switch OFF). An unknown key throws, naming `what`.
 */
export function parseKillLockBodies(value, what = 'SEEDLING_KILLLOCK_BODIES') {
    const want = value === 'all' ? KILLLOCK_BODIES_KEYS
        : (value === 'none' ? [] : String(value).split(',').map((k) => k.trim()).filter(Boolean));
    const set = Object.fromEntries(KILLLOCK_BODIES_KEYS.map((k) => [k, false]));
    for (const k of want) {
        if (!KILLLOCK_BODIES_KEYS.includes(k)) {
            throw new Error(`killLockBodies: ${what} names "${k}"; the keys are ${KILLLOCK_BODIES_KEYS.join(', ')}`);
        }
        set[k] = true;
    }
    return set;
}

/** The inverse of `parseKillLockBodies`: `none`, or the ON keys in `KILLLOCK_BODIES_KEYS` order. */
export function formatKillLockBodies(set) {
    const on = KILLLOCK_BODIES_KEYS.filter((k) => set?.[k] === true);
    return on.length ? on.join(',') : 'none';
}

/** A complete switch set: every key, a boolean (a missing key reads its DEFAULT; an unknown key throws). */
export function normalizeKillLockBodies(over = {}) {
    for (const k of Object.keys(over ?? {})) {
        if (!KILLLOCK_BODIES_KEYS.includes(k)) throw new Error(`killLockBodies: unknown switch "${k}"`);
    }
    return Object.fromEntries(KILLLOCK_BODIES_KEYS.map((k) => [k,
        typeof over?.[k] === 'boolean' ? over[k] : KILLLOCK_BODIES_DEFAULTS[k]]));
}

/** Is this (complete or partial) set the defaults? */
export function isDefaultKillLockBodies(set) {
    const full = normalizeKillLockBodies(set);
    return KILLLOCK_BODIES_KEYS.every((k) => full[k] === KILLLOCK_BODIES_DEFAULTS[k]);
}

/** Set THIS module instance's switches (a complete set; a missing key reads its default). */
export function applyKillLockBodies(set) {
    Object.assign(KILLLOCK_BODIES, normalizeKillLockBodies(set));
    return { ...KILLLOCK_BODIES };
}

/**
 * The stamp a solve request carries: this instance's switch set when it is OFF-default, else null (nothing is
 * stamped, so a default request is byte-identical to the one before the hook).
 */
export function killLockBodiesStamp() {
    return isDefaultKillLockBodies(KILLLOCK_BODIES) ? null : { ...KILLLOCK_BODIES };
}

const envFlags = globalThis.process?.env?.SEEDLING_KILLLOCK_BODIES;
if (envFlags) Object.assign(KILLLOCK_BODIES, parseKillLockBodies(envFlags));

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
