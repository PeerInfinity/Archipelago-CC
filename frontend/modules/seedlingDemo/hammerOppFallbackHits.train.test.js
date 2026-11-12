/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE OPP-FALLBACK-HITS (train tier) — `OPP_FALLBACK_HITS` on its two witnesses.
 *
 * (1) THE HIT-BEARING REDO. Leg `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12:
 * wandlock@480,560 cleared` (`fixtures/hammer-cleartag-chain/leg871-l39-l40-request.json.gz`), solved as the
 * hammerClearTagChain train row solves it: dashless, uncapped, the pre-flip defaults (`withL40Flip(false)`) + its set.
 * The first branch's spinner press refuses `HAMMER_SAFETY` at t724; `OPP_PRESS_FALLBACK` rewinds to t0 and redoes the
 * kill with OPP off. OFF the redo is adopted (826 ticks) although the model bills two chaser contact hits on it, and
 * the segment refuses later (work 885). ON the redo is refused by name and the original refusal stands (work 255).
 *
 * (2) THE HITLESS REDO, UNCHANGED. Leg 377 (`level_40__r0c53 <- in_L42_240_336 -> location:L40 flag 1:
 * wandlock@176,80 cleared`) at the arrival clock 5323 with the flip set ON: the fallback's redo is adopted, hitless
 * (`hammerOppPressFallback.train.test.js`); ON it is audited, kept, and the plan is byte-identical.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { withContactFidelity } from './contactFidelity.js';
import { settleSolve, solveAnytime, solveFromTape } from './jsRuntimeSolver.js';
import { withL40Flip } from './l40FlipSet.js';
import {
    OPP_FALLBACK_HITS, OPP_FALLBACK_HITS_COUNTS, resetOppFallbackHitsCounts, withOppFallbackHits,
} from './oppFallbackHits.js';
import { OPP_PRESS_FALLBACK_COUNTS, resetOppPressFallbackCounts, withOppPressFallback } from './oppPressFallback.js';
import { withPressEscapeExact } from './pressEscapeExact.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import { withChaserStagedHunt, withClearTagChain, withStanceBurn } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TIMEOUT = 600_000;
const fixture = (dir, name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', dir, name))).toString('utf8'));
const digest = (plan) => createHash('sha1').update(JSON.stringify(plan.solution.map((k) => [...k])))
    .digest('hex').slice(0, 12);

/** Run `fn` with both instruments zeroed and `census` set; return its value plus a copy of both. */
function measured(census, fn) {
    resetOppPressFallbackCounts();
    resetOppFallbackHitsCounts();
    OPP_FALLBACK_HITS.census = census;
    try {
        const out = fn();
        return { ...out, opf: { ...OPP_PRESS_FALLBACK_COUNTS },
            ofh: { ...OPP_FALLBACK_HITS_COUNTS, rows: OPP_FALLBACK_HITS_COUNTS.rows.map((r) => ({ ...r })) } };
    } finally {
        OPP_FALLBACK_HITS.census = false;
    }
}

/** Leg 871 as the hammerClearTagChain train row solves it (its set, dashless, uncapped). */
function solve871() {
    const FIX = fixture('hammer-cleartag-chain', 'leg871-l39-l40-request.json.gz');
    const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
    const levelSource = levelSourceFromAtlas(source.records);
    const fid = { forecastShieldBump: true };
    return withL40Flip(false, () => withClearTagChain(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
        () => withChaserStagedHunt(true, () => withPressEscapeExact(true, () => withContactFidelity(fid, () => {
            let work = 0;
            let caught = null;
            const answer = settleSolve(() => {
                try {
                    return solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null, fineCheckpoints: true,
                        shouldStop: () => { work += 1; return false; } });
                } catch (e) {
                    caught = e;
                    throw e;
                }
            });
            return { answer, work, caught };
        })))))));
}

/** Leg 377 at the arrival clock 5323, the page's own `solveAnytime` at the captured budget. */
function solve377() {
    const c = fixture('hammer-l40-flip', 'leg377-l42-l40-request.json.gz').requests[0].request;
    const { passes, source, ...tape } = restoreRequest({ ...c, staging: { ...c.staging, seam: { ...c.staging.seam,
        time: 5323 } } });
    return { answer: solveAnytime({ ...tape, levelSource: levelSourceFromAtlas(source.records) }, { passes }) };
}

const HITS_871 = [{ t: 666, source: 'chaser', id: 'bob@736,752' }, { t: 737, source: 'chaser', id: 'bob@736,752' }];

describe('hammer-phase OPP-FALLBACK-HITS — leg 871 (L40 flag 12): the redo that takes hits', () => {
    it('OFF (census instrument): the redo is ADOPTED with 2 hits, and the segment refuses later at work 885', () => {
        const s = measured(true, () => withOppFallbackHits(false, solve871));
        expect(s.answer.ok).toBe(false);
        expect(s.work).toBe(885);
        expect(s.caught.perTick.length).toBe(826);
        expect(s.answer.message).toContain('-> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED');
        expect(s.opf).toEqual({ asked: 1, solved: 1, refused: 0 });
        expect(s.ofh.rows).toEqual([{ t: 0, ticks: 826, bodies: ['spinner@880,848'], hits: HITS_871, refused: false }]);
    }, TIMEOUT);

    it('ON: the redo is REFUSED by name, undone, and the original HAMMER_SAFETY refusal stands (work 255)', () => {
        const s = measured(false, () => withOppFallbackHits(true, solve871));
        expect(s.answer.ok).toBe(false);
        expect(s.work).toBe(255);
        expect(s.answer.message).toContain('-> kill (spinner@880,848) by press: every key set');
        expect(s.answer.message).toContain('There is no step out.');
        expect(s.answer.message).toContain('`OPP_FALLBACK_HITS`');
        expect(s.answer.message).toContain('2 player hit(s) on the redo (t666 chaser:bob@736,752, t737 chaser:bob@736,752)');
        expect(s.opf).toEqual({ asked: 1, solved: 0, refused: 1 });
        expect(s.ofh).toMatchObject({ audited: 1, hit: 1, refused: 1 });
        expect(s.caught.oppPressFallback).toMatchObject({ t: 0, refused: 'HAMMER_SAFETY', refusedAt: 724,
            verdict: 'refused', retryRefused: 'OPP_FALLBACK_HITS', hits: HITS_871 });
    }, TIMEOUT);
});

describe('hammer-phase OPP-FALLBACK-HITS — leg 377 (L40 flag 1) at 5323: the hitless redo, unchanged', () => {
    it('ON keeps the hitless redo: audited, not refused, and the plan is OFF\'s byte for byte', () => {
        const off = measured(false, () => withL40Flip(true, () => withOppPressFallback(true,
            () => withOppFallbackHits(false, solve377))));
        const on = measured(false, () => withL40Flip(true, () => withOppPressFallback(true,
            () => withOppFallbackHits(true, solve377))));
        expect(off.answer.ok).toBe(true);
        expect(on.answer.ok).toBe(true);
        expect(digest(on.answer.plan)).toBe(digest(off.answer.plan));
        expect(off.ofh.audited).toBe(0); // OFF reads nothing
        expect(on.opf.solved).toBeGreaterThan(0);
        expect(on.opf).toEqual(off.opf);
        expect(on.ofh).toMatchObject({ audited: on.opf.solved, hit: 0, refused: 0 });
    }, TIMEOUT);
});
