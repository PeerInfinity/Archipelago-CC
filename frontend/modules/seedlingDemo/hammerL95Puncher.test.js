/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE L95-PUNCHER — the kill rung that answers `puncher@416,256` on the `in_L95_624_64` legs
 * once `CLEARTAG_STAND` prices the keylock hold. ⚖ The user queued it on 2026-11-04 ("Hold; fix L95 first"): the
 * `CLEARTAG_STAND` flip is held until it stops losing those two solves.
 *
 * MEASURED at main `26ed405d3f` (`CC/docs/cloud-reports/seedling-hammer-l95-puncher.md`): with `CLEARTAG_STAND` ON the
 * clear-tag keylock walk's probe meets the punch, and the kill rung's chaser arm is asked at the walk's start (24,360).
 * Of the 17 reachable leash stances only (376,248) can kill — on every L12 leg, the 8 clean ones and L35 included. On
 * L0/L35 the arrival there leaves the puncher's phase such that each wind-up ends inside the i-frame of the strike
 * before it; from L95_624_64 the walk arrives 0.5 px lower (y 248.8 vs 248.3), the second wind-up ends at t610 — the
 * tick the i-frame lapses — and the third strike lands one tick late (t611). The other 16 are hit too (the bare body
 * on the tick its i-frame lapses, as the strike's aim step meets it), and two, (376,232) and (376,216), are hitless but
 * the body never comes inside their ceiling. That is exactly the shape `CHASER_STAGED_HUNT` (hammer BK2COMBAT, OFF)
 * answers: stage at (376,232) (the arm's own `waits`), ask again from there — the arm prices (376,248) at once, the
 * 19-tick approach from the staging cell meeting the body at a phase whose every wind-up ends inside an i-frame — and
 * kill, 0 hits. No new mechanism is needed, so these rows pin the existing switch on the L95 leg.
 *
 * The state is the page's own request for leg 160 (`level_12__r0c19 <- in_L95_624_64 -> location:L12 flag 4:
 * bosslock@416,240 cleared`), captured at `26ed405d3f`, its atlas records cut to level 12 (byte-identical answers to
 * the uncut capture at the defaults, with `CLEARTAG_STAND`, and with both switches). Leg 127 (L35) is
 * CLEARTAG-STAND's own fixture.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
    CHASER_STAGED_HUNT, CHASER_STAGED_HUNT_COUNTS, CHASER_STAGED_HUNT_DEFAULT, resetChaserStagedHuntCounts,
    withChaserStagedHunt, withClearTagStand,
} from './solverBot.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const FIX = (dir, name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', dir, name))).toString('utf8'));
const LEG_L95 = FIX('hammer-l95-puncher', 'leg160-l95-l12-request.json.gz');
const LEG_L35 = FIX('hammer-cleartag-stand', 'leg127-l35-l12-request.json.gz');
const PUNCHER = 'puncher@416,256';

/** A captured leg solved as the worker does, under the two switches; the model's hits re-driven from the plan. */
function solveLeg(leg, { cleartag, staged }) {
    const req = restoreRequest(leg.requests[0].request);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const levelSource12 = levelSourceFromAtlas(source.records);
    resetChaserStagedHuntCounts();
    const answer = withClearTagStand(cleartag, () => withChaserStagedHunt(staged,
        () => solveAnytime({ ...tape, source, levelSource: levelSource12 }, { passes })));
    const asks = CHASER_STAGED_HUNT_COUNTS.asks.map((a) => ({ ...a }));
    if (!answer.ok) return { ok: false, message: String(answer.message ?? ''), asks };
    const shadow = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution],
        levelSource: levelSource12, scratchPersistence: tape.scratchPersistence });
    return { ok: true, ticks: answer.plan.solution.length, plan: JSON.stringify(answer.plan.solution.map((k) => [...k])),
        hits: shadow.ledger('playerHits').map((h) => [h.t, h.source, h.id]), asks };
}

describe('hammer-phase L95-PUNCHER — the L95_624_64 puncher kill under `CLEARTAG_STAND` (`CHASER_STAGED_HUNT`)', () => {
    it('the switch ships OFF (`SEEDLING_CHASER_STAGED_HUNT=1` turns it on in node; the page channel knows the name)', () => {
        expect(CHASER_STAGED_HUNT_DEFAULT).toBe(false);
        expect(CHASER_STAGED_HUNT.enabled).toBe(ENV.SEEDLING_CHASER_STAGED_HUNT === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_CHASER_STAGED_HUNT');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_CLEARTAG_STAND');
    });

    it('L95 leg 160, CLEARTAG ON: OFF the ladder is exhausted (no leash stance waits clean); ON it stages and kills, 0 hits', () => {
        const off = solveLeg(LEG_L95, { cleartag: true, staged: false });
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(/the combat ladder is EXHAUSTED/);
        expect(off.message).toMatch(new RegExp(`chaser arm: no stance derives for ${PUNCHER} on level 12: .*`
            + '17 of those reachable and with a corridor onward, and 17 of THOSE refused by the forecast'));
        expect(off.asks).toEqual([]);
        const on = solveLeg(LEG_L95, { cleartag: true, staged: true });
        expect(on.ok).toBe(true);
        expect(on.hits).toEqual([]);
        expect(on.ticks).toBe(794);
        // the staging the arm's own `waits` named: (376,232), hitless and out of the body's reach inside its ceiling.
        // Asked again from there the arm prices (376,248) at once (wait 0): the 19-tick approach from the staging cell
        // meets the body at a phase whose wind-ups all end inside an i-frame. (The second row is the full pass's
        // dash upgrade, cut by the work budget; the plan is the dashless pass's.)
        expect(on.asks[0]).toEqual({ id: PUNCHER, t: 0, cell: { x: 376, y: 232 }, wait: 0, verdict: 'staged' });
        expect(on.asks.filter((a) => a.verdict === 'staged')).toHaveLength(1);
    }, 120_000);

    it('L35 leg 127, CLEARTAG ON: the switch ON answers OFF\'s plan byte for byte (the arm priced a stance; never staged)', () => {
        const off = solveLeg(LEG_L35, { cleartag: true, staged: false });
        const on = solveLeg(LEG_L35, { cleartag: true, staged: true });
        expect(off.ok && on.ok).toBe(true);
        expect(off.ticks).toBe(643);
        expect(on.plan).toBe(off.plan);
        expect(on.hits).toEqual([]);
        expect(on.asks).toEqual([]);
    }, 120_000);

    it('L95 leg 160 at the defaults (CLEARTAG OFF): the switch alone changes nothing — the hold\'s 2 punches stand', () => {
        const off = solveLeg(LEG_L95, { cleartag: false, staged: false });
        const on = solveLeg(LEG_L95, { cleartag: false, staged: true });
        expect(off.ok && on.ok).toBe(true);
        expect(off.ticks).toBe(632);
        expect(off.hits).toEqual([[575, 'punch', PUNCHER], [615, 'punch', PUNCHER]]);
        expect(on.plan).toBe(off.plan);
        expect(on.asks).toEqual([]);
    }, 120_000);
});
