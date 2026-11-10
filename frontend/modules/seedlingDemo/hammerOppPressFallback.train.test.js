/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE L40-FLIP-BUILD (train tier) — `OPPORTUNISTIC_STRIKE`'s regression on L40 flag 1, and
 * `OPP_PRESS_FALLBACK`'s answer to it, on the page's own request.
 *
 * The state is leg 377's (`level_40__r0c53 <- in_L42_240_336 -> location:L40 flag 1: wandlock@176,80 cleared`), captured
 * on the p4g page at `32d9c6468b` + wave 6's switches, its atlas records cut to level 40
 * (`fixtures/hammer-l40-flip/`; the cut answers the full request byte for byte: digest, trace hash, 2260 progress
 * points, 611 work units — `CC/docs/cloud-reports/seedling-hammer-l40-flip-build.md` § M). The arrival clock is moved to
 * 5323 (the clock CI's wave-6 sweep 42145740415 refused at), `staging.seam.time` only. Each solve is the page's own
 * `solveAnytime` at the captured budget (640), so the rows are the page's answers, not an uncapped search's.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { withL40Flip } from './l40FlipSet.js';
import { OPP_PRESS_FALLBACK_COUNTS, resetOppPressFallbackCounts, withOppPressFallback } from './oppPressFallback.js';
import { withOpportunisticStrike } from './pressKillCost.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-l40-flip', 'leg377-l42-l40-request.json.gz')))
    .toString('utf8'));
const TIMEOUT = 600_000;
const SEAM = 5323;

const digest = (plan) => createHash('sha1').update(JSON.stringify(plan.solution.map((k) => [...k])))
    .digest('hex').slice(0, 12);

/** The page's solve of leg 377 at the arrival clock `SEAM`, under whatever switches the caller set. */
function solve377() {
    const c = FIX.requests[0].request;
    const req = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam, time: SEAM } } });
    const { passes, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);
    resetOppPressFallbackCounts();
    const answer = solveAnytime({ ...tape, levelSource }, { passes });
    return { answer, counts: { ...OPP_PRESS_FALLBACK_COUNTS }, tape, source };
}

/** A plan re-driven on a FRESH run of the staging (⚖ 30(c)): its rows, its hits and deaths. */
function drive({ answer, tape, source }) {
    const { plan } = answer;
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const row = () => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
    const hits0 = run.playerHits.length;
    expect(row()).toEqual(plan.expected[0]);
    for (let k = 0; k < plan.solution.length; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(plan.solution[k]);
        if (plan.expected[k + 1]) expect(row()).toEqual(plan.expected[k + 1]);
    }
    return { hits: run.playerHits.length - hits0, deaths: run.playerDeaths.length };
}

describe('hammer-phase L40-FLIP-BUILD — leg 377 (L40 flag 1) at the arrival clock 5323', () => {
    let off = null;
    it('the defaults before the flip (the set OFF): SOLVED `hold, kill, walk`, hitless', () => {
        const s = withL40Flip(false, solve377);
        expect(s.answer.ok).toBe(true);
        expect(s.answer.plan.verbs).toEqual(['hold', 'kill', 'walk']);
        expect(s.answer.plan.solution.length).toBe(1460);
        expect(s.counts.asked).toBe(0); // OPP off: the fallback reads nothing
        expect(drive(s)).toEqual({ hits: 0, deaths: 0 });
        off = digest(s.answer.plan);
    }, TIMEOUT);

    it('the BEFORE: the flip set ON with the fallback OFF refuses inside the hold\'s rock prerequisite (OPP\'s press)', () => {
        const s = withL40Flip(true, () => withOppPressFallback(false, solve377));
        expect(s.answer.ok).toBe(false);
        expect(s.answer.message).toContain('hold stance -> break stance (breakablerock@176,128) -> kill (spinner@192,160) by press');
        expect(s.answer.message).toContain('There is no step out.');
        expect(s.counts.asked).toBe(0);
    }, TIMEOUT);

    it('…and OPP is the cause: the flip set ON with OPP alone OFF solves, the defaults\' plan', () => {
        const s = withL40Flip(true, () => withOppPressFallback(false, () => withOpportunisticStrike(false, solve377)));
        expect(s.answer.ok).toBe(true);
        expect(digest(s.answer.plan)).toBe(off);
    }, TIMEOUT);

    it('the AFTER: the flip set ON with the fallback ON solves — the retry asked and adopted, the defaults\' plan, hitless', () => {
        const s = withL40Flip(true, () => withOppPressFallback(true, solve377));
        expect(s.answer.ok).toBe(true);
        expect(s.answer.plan.verbs).toEqual(['hold', 'kill', 'walk']);
        expect(digest(s.answer.plan)).toBe(off);
        expect(s.counts.asked).toBeGreaterThan(0);
        expect(s.counts.solved).toBeGreaterThan(0);
        expect(s.answer.work).toBeLessThanOrEqual(640); // inside the page's first budget
        expect(drive(s)).toEqual({ hits: 0, deaths: 0 });
    }, TIMEOUT);
});
