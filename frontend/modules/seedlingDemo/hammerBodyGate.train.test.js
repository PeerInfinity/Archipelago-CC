// ⚖ Robert 2026-11-02 CI manual-only P1: TRAIN tier. Runs on js-land/** train pushes and on dispatch (`-f train=true`),
// NOT on a slice push. `npm run test:unit:train`.
/**
 * ⛓⛓ SEEDLING HAMMER-PHASE SPINNER-CORNER — `HAMMER_BODY_GATE`'s solve rows (the fast ones: `hammerBodyGate.test.js`).
 *
 * Leg `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared` (sweep id
 * 871 when captured): `hammerClearTagChain.train`'s request and set (CLEARTAG_CHAIN, STANCE_BURN, OPP, staged hunt,
 * PRESS_ESCAPE_EXACT, `forecastShieldBump`), `withL40Flip(false)`, dashless, uncapped.
 *   - OFF: refused at work 885 (the first branch's press kill corners at t724, OPP_PRESS_FALLBACK's redo exhausts the
 *     ladder at clock 826 — DYING-BODY-WAIT's measurement).
 *   - ON: solved, every expected row matched on a fresh run, no player hit, no death, flag 12 earned.
 * The control is leg 872 (`… <- L43 …`, same room and goal), whose plan presses the same spinners: OFF = ON.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { withChaserStagedHunt, withClearTagChain, withHammerBodyGate, withStanceBurn } from './solverBot.js';
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

/** Solve the leg (switch at `on`), then drive the plan on a fresh run: rows, hits, deaths, clears. */
function solveLeg(name, on) {
    const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX(name).requests[0].request);
    const levelSource = levelSourceFromAtlas(source.records);
    let work = 0;
    const answer = withL40Flip(false, () => withSet(() => withHammerBodyGate(on, () => settleSolve(() => solveFromTape({
        ...tape, levelSource, dashMode: 'none', adds: null, fineCheckpoints: true,
        shouldStop: () => { work += 1; return false; } })))));
    if (!answer.ok) return { ok: false, work, message: answer.message };
    const { plan } = answer;
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const row = () => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
    const hits0 = run.playerHits.length;
    let mismatches = JSON.stringify(row()) === JSON.stringify(plan.expected[0]) ? 0 : 1;
    for (let k = 0; k < plan.solution.length; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(plan.solution[k]);
        if (plan.expected[k + 1] && JSON.stringify(row()) !== JSON.stringify(plan.expected[k + 1])) mismatches += 1;
    }
    return { ok: true, work, ticks: plan.solution.length, mismatches,
        sha: createHash('sha256').update(JSON.stringify(plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12),
        hits: run.playerHits.slice(hits0).length, deaths: run.playerDeaths.length,
        clears: (run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`).sort() };
}

describe('HAMMER_BODY_GATE — leg 871 (… flag 12 <- L39)', () => {
    it('OFF: refused at work 885 (today\'s refusal)', () => {
        const off = solveLeg('leg871-l39-l40-request.json.gz', false);
        expect(off.ok).toBe(false);
        expect(off.work).toBe(885);
        expect(off.message).toMatch(/burn stance \(burnabletree@872,784\): the combat ladder is EXHAUSTED/);
    }, 900_000);

    it('ON: solved hitless — 1114 t, rows exact on a fresh run, flag 12 earned', () => {
        const on = solveLeg('leg871-l39-l40-request.json.gz', true);
        expect(on).toMatchObject({ ok: true, work: 2932, ticks: 1114, sha: 'b833d3f60baa', mismatches: 0, hits: 0,
            deaths: 0 });
        expect(on.clears).toContain('40:12');
    }, 900_000);
});

describe('HAMMER_BODY_GATE — control: leg 872 (… flag 12 <- L43) is unchanged', () => {
    it('OFF = ON: 2385 t, sha 0c51cdb94854, hitless', () => {
        const off = solveLeg('leg872-l43-l40-request.json.gz', false);
        const on = solveLeg('leg872-l43-l40-request.json.gz', true);
        expect(off).toMatchObject({ ok: true, work: 3823, ticks: 2385, sha: '0c51cdb94854', hits: 0, deaths: 0 });
        expect(on).toEqual(off);
    }, 900_000);
});
