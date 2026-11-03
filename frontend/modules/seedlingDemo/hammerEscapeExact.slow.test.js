/**
 * ⛓⛓ SEEDLING HAMMER-PHASE ESCAPE-EXACT — `PRESS_ESCAPE_EXACT` on leg 860 (the slow row; the fast ones are
 * `hammerEscapeExact.test.js`). Leg 860's captured request 860/1 at L40C's seam 5950, under SPIN's arm A5
 * (`hammerSpinnerPress.slow.test.js`: CPAIR-3, ICEST, OPP, LWF, `orbitFreeAim`, SBD), the deadline at 10240 work units.
 *
 * ⚠ THE BRIEF EXPECTED "860 HITLESS WITH SPIN OFF + THE SWITCH ON". MEASURED, IT IS NOT: with fidelity's key ON the
 * exact escape answers 200 asks (OFF 29, all no claim), and at t541 it CLAIMS `no-landing` for `deriveStrike`'s
 * candidates on `spinner@880,848` — the same claim the escape makes with no shield (the bump-blind forecast does not
 * land either; no bump is on those paths). OFF's no-claim had admitted those presses. The walk then takes another
 * path and the solve refuses at t2119 by NAME: a press on an ice turret's freeze (`FROZEN_TICK_PRESS`, the known
 * `unmodelled-frozen-press` can't-do), before `spinner@816,848` is reached. This row pins that measured answer, so the
 * day the frozen press is scheduled around (not this arc's), it reds and is re-read.
 *
 * Skipped BY NAME where fidelity's `forecastShieldBump` does not exist (main, when this landed).
 *
 * ⛓ fidelity W37 FROZENPRESS (`frozenPressForecast`, the walk's opportunistic strike stands down on a forecast freeze):
 * the t2119 row above is the world WITHOUT it, so it pins the key OFF (guarded: the key may not exist). Its sibling pins
 * the key ON: the press is no longer scheduled into the freeze, and the solve runs on to the next wall.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { ANYTIME_PASSES, solveAnytime } from './jsRuntimeSolver.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import { PRESS_KILL_DONE_TRACE, withPressEscapeShieldClaim } from './pressKillGuards.js';
import { SHIELD_BUMP_FORECAST_KEY, withPressEscapeExact } from './pressEscapeExact.js';
import { CHOOSER_PAIR, HAMMER_ESCAPE_TRACE, withChooserPair, withIceTurretStaticKill, withLatchWeighFirst }
    from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NO_KEY = !CONTACT_FIDELITY_KEYS.includes(SHIELD_BUMP_FORECAST_KEY);
const SPIN_BODY = 'spinner@816,848';
const FROZEN_KEY = 'frozenPressForecast';
const NO_FROZEN_KEY = !CONTACT_FIDELITY_KEYS.includes(FROZEN_KEY);

function leg860Request(seam = 5950) {
    const row = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'spin-witness', 'leg860-request.json.gz')))
        .toString('utf8'));
    const c = row.request;
    return restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: seam } } });
}

/** SPIN's arm A5 (its slow file's `underA5`), the shield-bump key ON, SPIN OFF, the switch ON; `frozen` sets fidelity's
 * `frozenPressForecast` where that key exists (an unknown key throws in `withContactFidelity`). */
function solve860Exact(frozen = false) {
    const { passes = ANYTIME_PASSES, source, ...tape } = leg860Request();
    const kills = [];
    const escapes = [];
    PRESS_KILL_DONE_TRACE.sink = (k) => kills.push(k);
    HAMMER_ESCAPE_TRACE.sink = (r) => escapes.push({ t: r.t, caller: r.caller, ok: r.ok, claim: r.claim, bound: r.bound });
    const size = CHOOSER_PAIR.size;
    CHOOSER_PAIR.size = 3;
    try {
        const solve = () => solveAnytime({ ...tape, budgetWork: 10240, source,
            levelSource: levelSourceFromAtlas(source.records) }, { passes });
        const exact = () => withPressEscapeShieldClaim(false, () => withPressEscapeExact(true, solve));
        const keys = () => withContactFidelity({ orbitFreeAim: true, strategyBoundDistinct: true,
            [SHIELD_BUMP_FORECAST_KEY]: true, ...(NO_FROZEN_KEY ? {} : { [FROZEN_KEY]: frozen }) }, exact);
        const answer = withChooserPair(true, () => withIceTurretStaticKill(true, () => withOpportunisticStrike(true,
            () => withLatchWeighFirst(true, keys))));
        return { answer, kills, escapes };
    } finally {
        CHOOSER_PAIR.size = size;
        PRESS_KILL_DONE_TRACE.sink = null;
        HAMMER_ESCAPE_TRACE.sink = null;
    }
}

describe('hammer-phase ESCAPE-EXACT — leg 860, A5, deadline 10240, seam 5950', () => {
    it.skipIf(NO_KEY)('[needs fidelity\'s forecastShieldBump] key ON, SPIN OFF, ON: the t541 no-landing claims, then '
        + 'the frozen-tick press refusal at t2119 — spinner@816,848 is not reached (measured; not the brief\'s "hitless")',
    () => {
        const { answer, kills, escapes } = solve860Exact(false);
        expect(answer.ok).toBe(false);
        expect(answer.message).toMatch(/^levelRun: a `primary` press at tick 2119 lands on a FROZEN tick/);
        expect(kills.some((k) => k.bodies.includes(SPIN_BODY))).toBe(false);
        const t541 = escapes.filter((e) => e.t === 541 && e.caller === 'walk');
        expect(t541.length).toBeGreaterThan(0);
        expect(t541.every((e) => !e.ok && e.claim && e.bound === 'no-landing')).toBe(true);
        expect(escapes.some((e) => !e.ok && !e.claim)).toBe(false);
    }, 1_800_000);

    it.skipIf(NO_KEY || NO_FROZEN_KEY)('[needs forecastShieldBump + frozenPressForecast] the same arm with the freeze '
        + 'forecast ON: no press lands on a frozen tick, and the solve runs past t2119 to its next wall', () => {
        // measured on main c660a0b5c4 + fidelity-harvest/frozenpress a2b6b5a226: the next wall is LWEIGH's (fidelity's
        // FROZENPRESS hand-over (2), hammer's VOLLEY-APPROACH candidate)
        const { answer, kills } = solve860Exact(true);
        expect(answer.ok).toBe(false);
        expect(answer.message).not.toMatch(/FROZEN tick/);
        expect(answer.message).toContain('the reordered corpse weigh took a hit at t2118 (blast:iceturret@472,400#2.0) '
            + 'on its way to iceturret@472,400\'s kill stance (488,445)');
        expect(kills.map((k) => k.bodies)).toEqual([['spinner@880,848'], ['spinner@880,848']]);
        expect(kills.some((k) => k.bodies.includes(SPIN_BODY))).toBe(false);
    }, 1_800_000);
});
