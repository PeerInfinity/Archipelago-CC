/**
 * ⛓⛓ SEEDLING HAMMER-PHASE LB (HX) — TWO GUARDS ON THE PRESS KILL, EACH BEHIND ITS OWN SWITCH, BOTH ON.
 *
 * Fidelity's L40CONTACT D4 handed the hammer arc two ways the press kill (`execKillByPress`) leaves a solve by
 * something other than an answer, both measured on leg 414's atlas boot (`d4/boot-414.json`, ghost sword, the chest):
 *
 * 1. **`PRESS_KILL_SHAKE_GUARD` — the strike preview inside the camera's shake band (HO1).** A player death reboots
 *    the room with the killing hit's shake carried into the settle (`rebootShake`), and while the camera is a BAND
 *    the chaser forecast cannot say whether a body near the screen edge is on screen, so `onScreenAt` THROWS by
 *    design (⚖ the band stays: the jiggle's value is cosmetic RNG and is never modelled). `deriveStrike`'s preview
 *    of a candidate's walk (`walkTo` → `previewWalk`) met that throw at t2439 and nothing caught it: the solve
 *    escaped as a crash. ON, that preview's throw — and only that throw, recognised by `isShakeBandThrow` — makes
 *    the CANDIDATE refused by name (its walk reads as truncated, so every pass and the continuation skip it), and
 *    the press kill does what it does with no strike: a refuge wait, which re-derives on the next tick. So the
 *    refusal of the candidate IS the wait: the kill waits the band out one tick at a time.
 *
 * 2. **`PRESS_KILL_REBOOT_GUARD` — the schedule across a room reboot (HO2).** A death reboots the room: every body
 *    is rebuilt (the target's hits with it) and the player respawns at the arrival. The press kill ignored that and
 *    kept its schedule: with `chaserSpinnerWalls` ON, 414 died 9 times to `bob@736,752` (one landing per life) until
 *    the 11,418-tick bound threw `STRIKE_BOUND_EXHAUSTED`. ON, the first death inside the kill refuses it by name
 *    (`SolverRefusal`, `obstacle.kind: 'danger'`, the killing source), on the tick of the death.
 *
 * ⛔ NEITHER CHANGES ANYTHING OFF: the shake guard's catch rethrows every error when OFF, and the reboot guard reads
 * a ledger length and compares it, deciding nothing. No budget, deadline site, `shouldStop` or work unit is touched.
 *
 * ON by default since the user's flip (hammer-phase GF, 2026-10-23: *"Yes, please go ahead with that plan"* — both
 * guards ON first, `STRIKE_ETA_FLOOR` after, in its own slice). GS's whole-route A/B (`seedling-hammer-guards-sweep`)
 * found 0 of 850 legs and 0 of 878 replayed requests turning a solve into a refusal; the reboot guard fires on the L40
 * chest leg (L40 ← L39 → Chest), the shake guard on no request. `SEEDLING_PRESS_KILL_SHAKE_GUARD=0` /
 * `SEEDLING_PRESS_KILL_REBOOT_GUARD=0` opt a node process out (the page's worker has no `process`, so it is ON there);
 * `withPressKillShakeGuard(false, …)` / `withPressKillRebootGuard(false, …)` for a test or a witness about the OFF kill.
 */

import { playerShieldRect } from './solverView.js';

export const PRESS_KILL_SHAKE_GUARD = {
    enabled: globalThis.process?.env?.SEEDLING_PRESS_KILL_SHAKE_GUARD !== '0',
};
export const PRESS_KILL_SHAKE_GUARD_DEFAULT = true;

export const PRESS_KILL_REBOOT_GUARD = {
    enabled: globalThis.process?.env?.SEEDLING_PRESS_KILL_REBOOT_GUARD !== '0',
};
export const PRESS_KILL_REBOOT_GUARD_DEFAULT = true;

/** What the guards did in this process (measurement only; nothing reads it back). */
export const PRESS_KILL_GUARD_COUNTS = { shakeRefused: 0, rebootRefused: 0 };

/**
 * The chaser forecast's shake-band throw (`levelRun.js` `chaserForecast`'s `onScreenAt`), and nothing else. A plain
 * `Error` (fidelity's file gives it no class or code), so it is recognised by its own first words. ⚠ Narrow on
 * purpose: the LIVE run's own band throw (`levelRun: whether … is on screen at tick …`) is not a preview's question
 * and is never caught here.
 */
export function isShakeBandThrow(e) {
    return e instanceof Error && e.constructor === Error
        && /^chaserForecast: whether .+ is on screen depends on where inside `Game\.shake`'s jiggle the camera landed/
            .test(e.message);
}

function withSwitch(sw, enabled, fn) {
    const was = sw.enabled;
    sw.enabled = enabled === true;
    const restore = () => { sw.enabled = was; };
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

/** Run `fn` with `PRESS_KILL_SHAKE_GUARD` set to `enabled`, restoring the previous value. */
export const withPressKillShakeGuard = (enabled, fn) => withSwitch(PRESS_KILL_SHAKE_GUARD, enabled, fn);
/** Run `fn` with `PRESS_KILL_REBOOT_GUARD` set to `enabled`, restoring the previous value. */
export const withPressKillRebootGuard = (enabled, fn) => withSwitch(PRESS_KILL_REBOOT_GUARD, enabled, fn);

/**
 * ⛓⛓ SEEDLING HAMMER-PHASE SPIN — `PRESS_ESCAPE_SHIELD_CLAIM`: THE PRESS KILL'S ESCAPE CLAIMS THROUGH A CARRIED SHIELD
 * (⚖ the user queued the slice on 2026-10-30, one of four hammer slices run in parallel; L40C ranked its wall FIRST:
 * the first wall on leg 860, `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29`, the only Boss Key 2 arrival leg
 * that gets past `bobsoldier@880,832`). OFF by default.
 *
 * ⛔ THE WALL, MEASURED (`CC/docs/cloud-reports/seedling-hammer-spinner-press.md`). On 860 (A5, the deadline at 10240
 * work units, seam 5950) `kill (spinner@816,848) by press` refuses *"every key set … lands the player box on a body's
 * 7x7 rect or on the 13 px hammer line … at (770.96,860.99)"*, 19 ticks after the press LANDED at t2744. The press at
 * t2743 was taken with NO escape certificate: hammer-phase A's `pressEscape` asks the hit-aware forecast
 * (`levelRun.spinnerForecastWithPress`), which names `shieldBumpNow` as unmodelled whenever the inventory holds a
 * shield. A forecast that names an unmodelled source makes no claim either way, so on every press kill after the
 * shield the escape is inert, and the A3 fallback presses. Asked anyway, the escape kernel EXHAUSTS from that landing
 * (no state survives past 11 ticks), and the refuge walk after it has no surviving path either (a space-time search
 * from every refuge tick t2749–t2752 exhausts). The press decided the corner.
 *
 * ⇒ ON, when the shield bump is the ONLY unmodelled source (`shieldOnlyUnmodelled`), the escape is asked of the
 * bump-blind forecast, the one every other press-kill predicate already treats as the answer (`safeStep`, the
 * HAMMER-PHASE rung, the refuge, `deriveStrike`), and:
 *   - a CERTIFICATE is adopted only when no state on its whole path (approach, train, escape) puts the shield's
 *     envelope on a forecast body (`shieldEnvelopeMeets`: the union of `playerShieldRect`'s boxes, each state against
 *     the rows either side of its own, since the bump tests the previous frame's box against this tick's bodies).
 *     There the bump cannot fire, so the forecast is exact on the path and the claim is the claim OFF would make
 *     without a shield. A path that meets a body stays NO CLAIM;
 *   - an EXHAUSTED escape search (the kernel's own negative) is a claimed negative, so the aim waits for a certified
 *     strike instead of pressing into a landing with no way out (A3's preference, unchanged);
 *   - every other negative (a previewed death, the line, no landing, the approach or the train meeting a body, a
 *     budget cut) stays NO CLAIM, as OFF returns it.
 *
 * ⛔ OFF IS UNTOUCHED: `pressEscapeOnce` returns its no-claim at the same line, before any of this is read.
 * `SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM=1` turns it ON in a node process (the page's worker has no `process`, so it is
 * OFF there); `withPressEscapeShieldClaim(true, fn)` for a test or a witness.
 */
export const PRESS_ESCAPE_SHIELD_CLAIM = {
    enabled: globalThis.process?.env?.SEEDLING_PRESS_ESCAPE_SHIELD_CLAIM === '1',
};
export const PRESS_ESCAPE_SHIELD_CLAIM_DEFAULT = false;

/** What the switch did in this process (measurement only; nothing reads it back). */
export const PRESS_ESCAPE_SHIELD_CLAIM_COUNTS = { asked: 0, certified: 0, envelope: 0, exhausted: 0, noClaim: 0 };

/** Zero the counts (a test, or a witness, between solves). */
export function resetPressEscapeShieldClaimCounts() {
    for (const k of Object.keys(PRESS_ESCAPE_SHIELD_CLAIM_COUNTS)) PRESS_ESCAPE_SHIELD_CLAIM_COUNTS[k] = 0;
}

/** The forecast's own words for the shield bump (`levelRun.spinnerForecastWithPress`'s `unmodelled` entry). */
const SHIELD_BUMP_UNMODELLED = /`shieldBumpNow`/;

/** Is the shield bump the ONLY source the forecast names as unmodelled (and is it named at all)? */
export function shieldOnlyUnmodelled(unmodelled) {
    return Array.isArray(unmodelled) && unmodelled.length > 0
        && unmodelled.every((u) => SHIELD_BUMP_UNMODELLED.test(String(u)));
}

/**
 * The shield's ENVELOPE about the player's point: the union of every box `playerShieldRect` places (the four
 * facings, standing and moving, slashing or not), DERIVED from the transcription rather than retyped. A body this
 * box does not overlap cannot be touched by the shield whatever the facing.
 */
export const SHIELD_ENVELOPE = Object.freeze((() => {
    const boxes = [];
    for (const direction of [0, 1, 2, 3]) {
        for (const vx of [-1, 0, 1]) {
            for (const slashing of [false, true]) {
                const r = playerShieldRect({ x: 0, y: 0, vx, direction }, slashing);
                if (r) boxes.push(r);
            }
        }
    }
    return {
        x: Math.min(...boxes.map((b) => b.x)), y: Math.min(...boxes.map((b) => b.y)),
        right: Math.max(...boxes.map((b) => b.right)), bottom: Math.max(...boxes.map((b) => b.bottom)),
    };
})());

/**
 * The first path index at which the shield's envelope meets a forecast body, or `null` when it meets none.
 * `path` is `[[index, state], …]` in forecast-index order (`rows[i]` = the bodies after the advance of tick
 * `ticksCompleted + i`); each state is asked against rows `i − 1`, `i` and `i + 1`, with its own point and the next
 * state's, because the game's bump tests the box the PREVIOUS frame rendered against the bodies this tick stepped
 * (`shieldBumpTouches`). A missing row is no body. Strict overlap (`Entity.collide`).
 */
export function shieldEnvelopeMeets(path, rows) {
    const env = (q) => ({ x: q.x + SHIELD_ENVELOPE.x, y: q.y + SHIELD_ENVELOPE.y,
        right: q.x + SHIELD_ENVELOPE.right, bottom: q.y + SHIELD_ENVELOPE.bottom });
    for (let j = 0; j < path.length; j += 1) {
        const [i, q] = path[j];
        const q2 = path[j + 1]?.[1] ?? q;
        for (const e of [env(q), env(q2)]) {
            for (const ri of [i - 1, i, i + 1]) {
                for (const r of rows[ri] ?? []) {
                    if (e.x < r.right && e.right > r.x && e.y < r.bottom && e.bottom > r.y) return i;
                }
            }
        }
    }
    return null;
}

/** Run `fn` with `PRESS_ESCAPE_SHIELD_CLAIM` set to `enabled`, restoring the previous value. */
export const withPressEscapeShieldClaim = (enabled, fn) => withSwitch(PRESS_ESCAPE_SHIELD_CLAIM, enabled, fn);

/**
 * ⛓ hammer-phase SPIN — THE PRESS KILL'S COMPLETION, OBSERVED: `execKillByPressOnce` hands `sink` the kill's keys once
 * every counted body is gone (`{bodies, from, t, landings, perTick, equips}`; `equips` is the run's fired slot selections,
 * `ledger('equipsFired')`, which a replay of the keys applies too), so a witness can replay them on a fresh run (⚖ 30(c)).
 * `null` by default; nothing reads it back and nothing it does changes the kill.
 */
export const PRESS_KILL_DONE_TRACE = { sink: null };
