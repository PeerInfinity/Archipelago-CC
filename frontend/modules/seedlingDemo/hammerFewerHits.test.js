/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE FEWER-HITS — a third, hit-avoiding pass (`jsRuntimeSolver.HIT_AVOID_PASS`, OFF) and fewer
 * hits first between two hit plans (`jsRuntimeSolver.FEWER_HITS_RANK`, OFF). ⚖ The user, 2026-11-19: *"Fewer-hits
 * ranking (Recommended)"*.
 *
 * MEASURED (`CC/docs/cloud-reports/seedling-hammer-fewer-hits.md`): L30 `bosslock@64,32` from L28 (sweep key
 * `level_30__r2c10 <- in_L28_304_16 -> location:L30 flag 0: bosslock@64,32 cleared`) takes its intermittent hit in a
 * CONTINUATION: an item delivery replans the walk at t57 or t58 (`fixtures/hammer-fewer-hits/`, p4g page captures at
 * base f43e2de8, each cut to level 30). From t57 both passes take one hit (dashless 103 t, full 101 t); from t58 the
 * full pass is hitless (98 t). One idle tick first gives a hitless plan: the hit is a phase question.
 *
 * Red under a mutant:
 *   the pass never runs / runs with the switch OFF            -> 't57 ON' / 'OFF' rows red
 *   the idle ticks left out of the plan (ticks, rows, hits)   -> 't57 ON: the plan re-drives …' red
 *   the pass runs on a hitless plan                           -> 't58' row red (a `hit-avoid` row appears)
 *   fewer-hits ranking reads the counts with its switch OFF   -> 'OFF: …' rows red
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { FADE_MOVE as __FADE_MOVE_HOLD } from './solverBot.js';

// ⛓ `FADE_MOVE` held OFF for this whole file: it ships ON since the ROCKLOCK + FADE flip (⚖ the user, 2026-11-22).
// ON, L30 t57's dashless pass is already hitless (103 t, was 1 hit), so the hit-avoid pass has nothing to do. These rows pin other switches;
// held OFF they are byte for byte their pre-flip selves.
let __fadeWas;
beforeAll(() => { __fadeWas = __FADE_MOVE_HOLD.enabled; __FADE_MOVE_HOLD.enabled = false; });
afterAll(() => { __FADE_MOVE_HOLD.enabled = __fadeWas; });
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
    ANYTIME_PASSES, betterAnswer, delayedPlan, FEWER_HITS_RANK, FEWER_HITS_RANK_DEFAULT, fewerHitsOrder, HIT_AVOID_PASS,
    HIT_AVOID_PASS_DEFAULT, replayTape, solveAnytime, withFewerHitsRank, withHitAvoidPass, withHitAwareAnswer,
} from './jsRuntimeSolver.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const FIX = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-fewer-hits', name))).toString('utf8'));

const plan = (ticks, hits, { pass = 'p', deaths = 0 } = {}) => ({ ok: true, pass,
    plan: { pass, solution: new Array(ticks).fill([]), ...(hits === null ? {} : { modelHits: { hits, deaths } }) } });

/** A captured request solved as the worker does; the shipped plan re-driven on a fresh replay of the tape. */
function solveLeg(leg, { avoid }) {
    const req = restoreRequest(leg.requests[0].request);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);
    const answer = withHitAwareAnswer(true, () => withHitAvoidPass(avoid, () => solveAnytime({ ...tape, source, levelSource }, { passes })));
    expect(answer.ok).toBe(true);
    const rp = (perTick) => replayTape({ staging: tape.staging, perTick, levelSource, scratchPersistence: tape.scratchPersistence,
        equips: tape.equips, holds: tape.holds });
    const base = rp(tape.perTick);
    const run = rp([...tape.perTick, ...answer.plan.solution]);
    const last = answer.plan.expected.at(-1);
    return {
        shipped: answer.plan.pass, ticks: answer.plan.solution.length, stamp: answer.plan.modelHits ?? null,
        delay: answer.plan.hitAvoidDelay ?? null, rows: answer.passes.map(({ ms: _m, ...r }) => r),
        model: { hits: run.ledger('playerHits').length - base.ledger('playerHits').length, deaths: run.playerDeaths.length - base.playerDeaths.length },
        endMatches: run.level === last.level && run.state.x === last.x && run.state.y === last.y,
        rowsMatch: answer.plan.expected.length === answer.plan.solution.length + 1,
        plan: JSON.stringify(answer.plan.solution.map((k) => [...k])),
    };
}

describe('FEWER-HITS — the switches', () => {
    it('HIT_AVOID_PASS ON by default since the FH flip (=0 opts out), FEWER_HITS_RANK OFF; named on the env channel, restored after a throw', () => {
        expect(HIT_AVOID_PASS_DEFAULT).toBe(true);
        expect(FEWER_HITS_RANK_DEFAULT).toBe(false);
        expect(HIT_AVOID_PASS.enabled).toBe(ENV.SEEDLING_HIT_AVOID_PASS !== '0');
        expect(FEWER_HITS_RANK.enabled).toBe(ENV.SEEDLING_FEWER_HITS_RANK === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_HIT_AVOID_PASS');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_FEWER_HITS_RANK');
        const [a, f] = [HIT_AVOID_PASS.enabled, FEWER_HITS_RANK.enabled];
        expect(withHitAvoidPass(true, () => HIT_AVOID_PASS.enabled)).toBe(true);
        expect(withFewerHitsRank(true, () => FEWER_HITS_RANK.enabled)).toBe(true);
        expect(() => withHitAvoidPass(true, () => { throw new Error('x'); })).toThrow('x');
        expect(() => withFewerHitsRank(true, () => { throw new Error('x'); })).toThrow('x');
        expect([HIT_AVOID_PASS.enabled, FEWER_HITS_RANK.enabled]).toEqual([a, f]);
    });
});

describe('FEWER-HITS — betterAnswer on synthetic answers (both plans hit)', () => {
    it('ON: fewer hits wins, then fewer deaths, then strictly fewer ticks', () => withHitAwareAnswer(true, () => withFewerHitsRank(true, () => {
        expect(betterAnswer(plan(100, 2), plan(200, 1))).toBe(true); // longer, one hit fewer: replaces
        expect(betterAnswer(plan(200, 1), plan(100, 2))).toBe(false);
        expect(betterAnswer(plan(100, 2, { deaths: 1 }), plan(200, 2))).toBe(true); // same hits, no death: replaces
        expect(betterAnswer(plan(200, 2), plan(100, 2, { deaths: 1 }))).toBe(false);
        expect(betterAnswer(plan(200, 2), plan(100, 2))).toBe(true); // same counts: the length rule
        expect(betterAnswer(plan(100, 2), plan(100, 2))).toBe(false);
        // a verdict difference still decides first, and a hitless plan never loses to a hit one
        expect(betterAnswer(plan(300, 0), plan(100, 1))).toBe(false);
        expect(betterAnswer(plan(100, 1), plan(300, 0))).toBe(true);
        expect(betterAnswer(plan(100, 0), plan(90, 0))).toBe(true);
        expect(betterAnswer(plan(100, null), plan(200, 1))).toBe(false); // unstamped: length
    })));

    it('OFF: two hit plans rank by length alone (today\'s rule)', () => withHitAwareAnswer(true, () => withFewerHitsRank(false, () => {
        expect(betterAnswer(plan(100, 2), plan(200, 1))).toBe(false);
        expect(betterAnswer(plan(200, 1), plan(100, 3, { deaths: 1 }))).toBe(true);
    })));

    it('fewerHitsOrder reads only two hit stamps', () => {
        expect(fewerHitsOrder({ modelHits: { hits: 2, deaths: 0 } }, { modelHits: { hits: 1, deaths: 0 } })).toBe(true);
        expect(fewerHitsOrder({ modelHits: { hits: 0, deaths: 0 } }, { modelHits: { hits: 1, deaths: 0 } })).toBe(null);
        expect(fewerHitsOrder({}, { modelHits: { hits: 1, deaths: 0 } })).toBe(null);
        expect(fewerHitsOrder({ modelHits: { hits: 1, deaths: 0 } }, { modelHits: { hits: 1, deaths: 0 } })).toBe(null);
    });
});

describe('FEWER-HITS — delayedPlan re-bases a later-start plan on the tape\'s end', () => {
    it('idle ticks first, rows from the idle replay, equips and hits shifted / added', () => {
        const p = { solution: [new Set(['right'])], expected: [{ x: 2 }, { x: 3 }], equipsAt: new Map([[0, 1]]),
            equipItems: new Map([[0, { a: 1 }]]), prefixLength: 60, modelHits: { hits: 0, deaths: 0 }, trailingEquip: 1 };
        const d = delayedPlan(p, { delay: 2, idleRows: [{ x: 0 }, { x: 1 }, { x: 2 }], idle: { hits: 0, deaths: 0 }, prefixLength: 58 });
        expect(d.solution.map((s) => [...s])).toEqual([[], [], ['right']]);
        expect(d.expected).toEqual([{ x: 0 }, { x: 1 }, { x: 2 }, { x: 3 }]);
        expect([...d.equipsAt]).toEqual([[2, 1]]);
        expect([...d.equipItems.keys()]).toEqual([2]);
        expect([d.prefixLength, d.hitAvoidDelay, d.trailingEquip]).toEqual([58, 2, 3]);
        expect(delayedPlan({ ...p, modelHits: { hits: 1, deaths: 0 } }, { delay: 1, idleRows: [{}, {}], idle: { hits: 1, deaths: 0 }, prefixLength: 58 })
            .modelHits).toEqual({ hits: 2, deaths: 0 });
    });
});

describe('FEWER-HITS — witness: L30 bosslock@64,32 from L28, the delivery continuation (page captures, p4g)', () => {
    const T57 = FIX('leg302-l28-l30-delivery-t57-request.json.gz');
    const T58 = FIX('leg302-l28-l30-delivery-t58-request.json.gz');

    it('t57 OFF: both passes take one model hit; the full 101 t ships with it', () => {
        const r = solveLeg(T57, { avoid: false });
        expect(r.rows.map((p) => [p.pass, p.ticks, p.modelHits])).toEqual([
            ['dashless', 103, { hits: 1, deaths: 0 }], ['full', 101, { hits: 1, deaths: 0 }]]);
        expect([r.shipped, r.ticks, r.model]).toEqual(['full', 101, { hits: 1, deaths: 0 }]);
    });

    it('t57 ON: the hit-avoid pass ships a hitless plan one idle tick later; the plan re-drives hitless to its end', () => {
        const r = solveLeg(T57, { avoid: true });
        expect([r.shipped, r.delay, r.ticks]).toEqual(['hit-avoid', 1, 97]);
        expect(r.stamp).toEqual({ hits: 0, deaths: 0 });
        expect(r.model).toEqual({ hits: 0, deaths: 0 });
        expect(r.endMatches && r.rowsMatch).toBe(true);
        expect(JSON.parse(r.plan)[0]).toEqual([]);
        const row = r.rows.find((p) => p.pass === 'hit-avoid');
        expect([row.ok, row.tries, row.delay]).toEqual([true, 1, 1]);
        expect(row.limit ?? row.deadline ?? null).toBe(null); // never read as a cut of the shipped passes
    });

    it('t58: the full pass is already hitless — ON = OFF byte for byte, and the pass never runs', () => {
        const off = solveLeg(T58, { avoid: false });
        const on = solveLeg(T58, { avoid: true });
        expect([off.shipped, off.ticks, off.model]).toEqual(['full', 98, { hits: 0, deaths: 0 }]);
        expect([on.shipped, on.ticks, on.plan]).toEqual([off.shipped, off.ticks, off.plan]);
        expect(on.rows.map((p) => p.pass)).toEqual(['dashless', 'full']);
    });
});
