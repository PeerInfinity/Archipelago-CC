/**
 * ⛓⛓ SEEDLING HAMMER-PHASE OPP-DASH-DEFERS (train tier) — `OPP_DASH_DEFERS` (OFF) on leg `level_40__r48c54 <-
 * in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared` (871's key) under the
 * hammerClearTagChain train row's set (dashless, uncapped, `withL40Flip(false)`), with and without
 * `HAMMER_BODY_GATE`; leg 872 (`… <- in_L43_176_464 ~> …`, same room and goal) is the control. Each plan is re-driven on
 * a fresh run of the staging, row by row (⚖ 30(c)). The fast rows are `hammerOppDashDefers.test.js`.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { withChaserStagedHunt, withClearTagChain, withHammerBodyGate, withStanceBurn } from './solverBot.js';
import { OPP_DASH_DEFERS_COUNTS, withOppDashDefers } from './strikePolicy.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import { withPressEscapeExact } from './pressEscapeExact.js';
import { withContactFidelity } from './contactFidelity.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { replayTape, settleSolve, solveFromTape } from './jsRuntimeSolver.js';
import { withL40Flip } from './l40FlipSet.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-cleartag-chain', name)))
    .toString('utf8'));
const withSet = (fn) => withClearTagChain(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
    () => withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true }, fn))))));

/** One leg's dashless pass under the set at `defers` / `bodyGate`, uncapped; a plan re-driven on a fresh run. */
function solveLeg(name, defers, bodyGate) {
    const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX(name).requests[0].request);
    const levelSource = levelSourceFromAtlas(source.records);
    for (const c of Object.keys(OPP_DASH_DEFERS_COUNTS)) OPP_DASH_DEFERS_COUNTS[c] = 0;
    let work = 0;
    const answer = withL40Flip(false, () => withSet(() => withHammerBodyGate(bodyGate, () => withOppDashDefers(defers,
        () => settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null, fineCheckpoints: true,
            shouldStop: () => { work += 1; return false; } }))))));
    const deferred = OPP_DASH_DEFERS_COUNTS.deferred;
    if (!answer.ok) return { ok: false, work, deferred, message: answer.message };
    const { plan } = answer;
    const run = withL40Flip(false, () => withSet(() => replayTape({ staging: tape.staging, perTick: tape.perTick,
        levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null,
        holds: tape.holds ?? null })));
    const row = () => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
    const hits0 = run.playerHits.length;
    let mismatches = 0;
    withL40Flip(false, () => withSet(() => {
        for (let k = 0; k < plan.solution.length; k += 1) {
            const slot = plan.equipsAt?.get?.(k);
            if (slot !== undefined) run.equipNow(slot);
            run.advance(plan.solution[k]);
            if (plan.expected[k + 1] && JSON.stringify(row()) !== JSON.stringify(plan.expected[k + 1])) mismatches += 1;
        }
    }));
    return {
        ok: true, work, ticks: plan.solution.length, deferred, mismatches,
        sha: createHash('sha256').update(JSON.stringify(plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12),
        hits: run.playerHits.slice(hits0).map((h) => [h.t, h.source, h.id]),
        deaths: run.playerDeaths.length,
        clears: (run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`).sort(),
    };
}

describe('hammer-phase OPP-DASH-DEFERS (train) — 871\'s key under the train set', () => {
    it('OFF refuses as today (work 885); ON solves hitless without HAMMER_BODY_GATE, and the same plan with it', () => {
        const off = solveLeg('leg871-l39-l40-request.json.gz', false, false);
        expect(off.ok).toBe(false);
        expect(off.work).toBe(885);
        expect(off.deferred).toBe(0);
        expect(off.message).toContain('-> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED');
        const SOLVED = { ok: true, work: 2935, ticks: 1123, deferred: 13, mismatches: 0, sha: '6a59f4db8770', hits: [],
            deaths: 0, clears: ['40:0', '40:12'] };
        expect(solveLeg('leg871-l39-l40-request.json.gz', true, false)).toEqual(SOLVED);
        expect(solveLeg('leg871-l39-l40-request.json.gz', true, true)).toEqual(SOLVED);
    }, 900000);

    it('control: leg 872 (from L43) is the same plan OFF and ON', () => {
        const off = solveLeg('leg872-l43-l40-request.json.gz', false, false);
        const on = solveLeg('leg872-l43-l40-request.json.gz', true, false);
        expect(off).toMatchObject({ ok: true, hits: [], deaths: 0, mismatches: 0 });
        expect({ ...on, deferred: 0 }).toEqual(off);
    }, 900000);
});
