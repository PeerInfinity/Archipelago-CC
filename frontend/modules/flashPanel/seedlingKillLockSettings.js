/**
 * flashPanel/seedlingKillLockSettings — ⛓ KILLLOCK HOOK (⚖ the user, 2026-10-10: fidelity's ask, relayed by
 * `seedling-js-planning-4`). The Seedling model's kill-lock body switches (`seedlingDemo/killLockBodies.js`,
 * K1–K5) as flashPanel settings: one boolean per switch, `flashPanel.seedlingKillLock<Key>`, whose schema
 * default IS `KILLLOCK_BODIES_DEFAULTS` (the schema is the default source, and a default typed here that
 * drifted from the model's would make the panel solve under a set no node gate measured).
 *
 * Where the set goes: the panel's own module instance (`applyKillLockBodies` — the wasm engine's host-side
 * solves), the JS runtime page (`?killLockBodies=`, see `jsRuntimePage.js`) and every solve worker (the
 * request's `killLockBodies` stamp, off-default only).
 */
import { KILLLOCK_BODIES_DEFAULTS, KILLLOCK_BODIES_KEYS, formatKillLockBodies, isDefaultKillLockBodies }
    from '../seedlingDemo/killLockBodies.js';

/** switch key → the flashPanel setting prop (`jellyfishLive` → `seedlingKillLockJellyfishLive`). */
export const killLockSettingProp = (key) => `seedlingKillLock${key[0].toUpperCase()}${key.slice(1)}`;

/** switch key → the full settings key. */
export const KILLLOCK_SETTING_KEYS = Object.freeze(Object.fromEntries(KILLLOCK_BODIES_KEYS.map((k) =>
    [k, `moduleSettings.flashPanel.${killLockSettingProp(k)}`])));

/** What each switch does, in a player's words (the model's own docblock has the evidence). */
const WHAT = Object.freeze({
    jellyfishLive: 'K1 — the model steps Jellyfish (they count toward an all-enemies-dead lock)',
    lavaRunnerLive: 'K2 — the model steps LavaRunners (no game witness yet: off by default)',
    chaserKillArm: 'K3 — the solver may open a kill lock by killing its live chasers one by one',
    turretRemovalLedger: 'K4 — an IceTurret kill counts when its corpse is destroyed (water, lava, a pit)',
    darkShieldIceTurret: 'K5 — the dark shield\'s bump hits an IceTurret',
});

/** The schema props, one boolean per switch, defaulted to `KILLLOCK_BODIES_DEFAULTS`. */
export function killLockSchemaProps() {
    return Object.fromEntries(KILLLOCK_BODIES_KEYS.map((k) => [killLockSettingProp(k), {
        type: 'boolean',
        default: KILLLOCK_BODIES_DEFAULTS[k],
        label: `Seedling model: kill-lock switch ${k}`,
        description: `${WHAT[k] ?? k}. Both runtimes, the Playback Bot's solver (and the JS runtime's own `
            + 'model). A set other than the defaults is stamped on every solve request and plan, so a plan made '
            + 'with it is labelled; changing it re-mounts the JS runtime page (a run played under one set '
            + 'cannot be replayed under another). Leave the defaults unless you are measuring the model.',
    }]));
}

/** The `?killLockBodies=` suffix for the JS runtime page: '' at the defaults (today's URL exactly). */
export function killLockPageQuery(set) {
    return isDefaultKillLockBodies(set) ? '' : `?killLockBodies=${encodeURIComponent(formatKillLockBodies(set))}`;
}
