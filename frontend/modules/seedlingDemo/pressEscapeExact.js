/**
 * ⛓⛓ SEEDLING HAMMER-PHASE ESCAPE-EXACT — `PRESS_ESCAPE_EXACT` (OFF): THE PRESS ESCAPE SEARCH, EXACT UNDER A SHIELD.
 *
 * Report: `CC/docs/cloud-reports/seedling-hammer-escape-exact.md`. ⚖ the user queued the slice on 2026-11-02.
 *
 * **The gap.** A carried shield bumps every body its box touches while the player moves (`levelRun.shieldBumpNow`).
 * `pressEscapeOnce` (`solverBot.js`) asked the press forecast a ZERO-ROW probe first, and the forecast names the bump as
 * unmodelled whenever a shield is carried, so the escape made no claim either way under a shield. SPIN
 * (`PRESS_ESCAPE_SHIELD_CLAIM`, `pressKillGuards.js`, OFF) is a stand-in: the bump-blind forecast plus an ENVELOPE (the
 * union of every shield box) kept off every body on the certificate's path. Fidelity's SHIELDBUMP
 * (`CONTACT_FIDELITY.forecastShieldBump`, OFF, on fidelity's branch until it lands) made the forecast step the plain
 * bump exactly on every row it is TOLD the player's state (`players`), and report it modelled only where every row was
 * stepped. The escape's search walks paths no forecast is told, so fidelity handed three parts to this arc.
 *
 * **ON (all three parts; each is a named member of `parts` so the design table can be measured part by part):**
 *   (i) `probe` — THE COVERAGE, NOT THE PROBE. The zero-row probe can never be "modelled" (it steps no row). ON, when
 *       the probe names the shield bump and nothing else, and the forecast steps the bump (`shieldBumpForecastStepped`:
 *       fidelity's key exists AND is ON), the escape goes on: the approach and the train are previewed as OFF, and
 *       `first` is asked with `players` = those previewed states. Its own report (`shieldBump.uncoveredFrom`: the
 *       first row no state was told) must cover every row from the run's tick through the last previewed state, or
 *       the escape makes no claim (`uncovered`, named). The rows there are then the bump-stepped rows of the very path
 *       the approach and train checks ask.
 *   (ii) `prune` — THE SEARCH'S OWN PATHS CARRY NO BUMP. Past the last stepped tick the rows are bump-blind, and they
 *       are exact on a path exactly when no bump fires on it. So every search state there whose shield box
 *       (`shieldBumpTouches`, the live gate and box, at EITHER `slashing`: the search's states carry no swing clock)
 *       touches a live, non-dying body on its own row is pruned, as `deriveFight`'s `bumps` prune does. A certificate
 *       is then exact on its whole path. A NEGATIVE is exact only if the prune cut nothing: an exhausted search that
 *       cut a bump state may have missed a way out through the bump, so it is NO CLAIM (`exhaustedCut`, named); with
 *       no cut it is the claim OFF would make with no shield. Every other negative (a previewed death, the line, no
 *       landing, the approach or the train meeting a body) is read off stepped rows, so it is claimed.
 *       (`deriveFight`'s other form, a forecast cursor forked per search node, is not built: § M of the report
 *       measures that the two answer alike wherever the prune cuts nothing.)
 *   (iii) `contact` — THE AIM TICK'S CONTACT. The approach check asked `clearOfHammersAt` from `at + 1`, so a body
 *       that steps onto the player DURING the aim tick (row `at − n`, against the state at the top of that tick) was
 *       never asked: the run is hit there and the escape previewed a walk away. ON, the check starts at `at`, for every
 *       escape (with or without a shield). A contact there is a claimed `approach` negative.
 * Where (i) does not apply (no shield, the key absent or OFF, another unmodelled source) the escape is OFF's, SPIN
 * included; under (i) SPIN is not consulted (the exact answer replaces its envelope).
 *
 * ⛔ OFF IS BYTE-IDENTICAL, with or without fidelity's key: nothing below is read (`PRESS_ESCAPE_EXACT.enabled` gates
 * every site), and the key is read only where it exists (`Object.hasOwn(CONTACT_FIDELITY, …)`, the same test as
 * `CONTACT_FIDELITY_KEYS.includes(…)`; `withContactFidelity` throws on an unknown key, so nothing here names it
 * there). `SEEDLING_PRESS_ESCAPE_EXACT=1` turns it ON in a node process (the page's worker reads it through
 * `?seedlingSolverEnv=`); `withPressEscapeExact(true, fn)` for a test or a witness.
 * ⚠ Like the key, FIXED PER PROCESS for a solve: the cross-pass escape cache keys on it only when it is ON.
 */

import { CONTACT_FIDELITY, shieldBumpTouches } from './solverView.js';

export const PRESS_ESCAPE_EXACT = {
    enabled: globalThis.process?.env?.SEEDLING_PRESS_ESCAPE_EXACT === '1',
    /** The three parts (the docblock's (i)–(iii)); all ON with the switch. A measurement may turn one off. */
    parts: { probe: true, prune: true, contact: true },
};
export const PRESS_ESCAPE_EXACT_DEFAULT = false;

/** What the switch did in this process (measurement only; nothing reads it back). */
export const PRESS_ESCAPE_EXACT_COUNTS = { asked: 0, uncovered: 0, certified: 0, claimedNegative: 0, exhausted: 0,
    exhaustedCut: 0, noClaim: 0, cuts: 0, contact: 0, rowsReforecast: 0 };

export function resetPressEscapeExactCounts() {
    for (const k of Object.keys(PRESS_ESCAPE_EXACT_COUNTS)) PRESS_ESCAPE_EXACT_COUNTS[k] = 0;
}

/** The fidelity key's name, spelled once (read only where it exists: `Object.hasOwn`, = `CONTACT_FIDELITY_KEYS`). */
export const SHIELD_BUMP_FORECAST_KEY = 'forecastShieldBump';

/**
 * Does the press forecast step the plain shield bump in this process (the key exists and is ON)? The existence test is
 * `Object.hasOwn(CONTACT_FIDELITY, …)`, which is `CONTACT_FIDELITY_KEYS.includes(…)` (that list is the object's own
 * keys) read through the solver's door (`solverView.js`).
 */
export const shieldBumpForecastStepped = () => Object.hasOwn(CONTACT_FIDELITY, SHIELD_BUMP_FORECAST_KEY)
    && CONTACT_FIDELITY[SHIELD_BUMP_FORECAST_KEY] === true;

/**
 * Did the forecast step the bump on every row from 0 through `lastIndex` (its `shieldBump` report, ON-only)? `null`
 * `uncoveredFrom` is every row; otherwise the first unstepped row's TICK, which must lie past `n + lastIndex`.
 */
export function bumpCoveredThrough(forecast, n, lastIndex) {
    const b = forecast?.shieldBump;
    if (!b || !Number.isInteger(b.stepped)) return false;
    return b.uncoveredFrom === null || b.uncoveredFrom > n + lastIndex;
}

/**
 * Would a shield bump fire on row `i` for a player at `q` (the top of that tick)? Any live, non-dying body of the row
 * whose rect the shield box touches, at either `slashing` (`bobBossFight.shieldBumpTouches`, the live gate `v > 0`
 * and the box `playerShieldRect` places). `rows[i]` / `bodies[i]` are the press forecast's, in one order.
 */
export function shieldBumpFiresAt(q, rows, bodies, i) {
    const row = rows[i] ?? [];
    const meta = bodies?.[i] ?? [];
    for (let k = 0; k < row.length; k += 1) {
        if (meta[k]?.destroy) continue;
        if (shieldBumpTouches(q, false, row[k], q) || shieldBumpTouches(q, true, row[k], q)) return true;
    }
    return false;
}

export function withPressEscapeExact(enabled, fn) {
    const was = PRESS_ESCAPE_EXACT.enabled;
    PRESS_ESCAPE_EXACT.enabled = enabled === true;
    const restore = () => { PRESS_ESCAPE_EXACT.enabled = was; };
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
