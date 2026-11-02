/**
 * SEEDLING STRATEGY SWITCH r1 × THE CROSS-PASS ESCAPE CACHE — hammer-2's option (a): the `disable` scope is installed
 * OUTSIDE the cache's. `twoPassSolve` captures its `disable` list at entry and creates the cache under that list's key;
 * every pass solves under the same list, and a cache read or write under a different live set refuses
 * `STRATEGY_DISABLED_SCOPE_CHANGED`.
 *
 * The rows (L18, `r9-solve-18`: the room `escapeCrossPassCache.test.js` measures cross-pass hits on):
 *   - VERIFY (`SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1`'s knob): a `twoPassSolve` under `disable: ['wand']` (a verb
 *     L18 never consults: 0 hits) recomputes every hit — 0 mismatches, the cache is used (lookups and cross-pass hits),
 *     and the walk is the walk without the option;
 *   - THE MUTANT: the cache's scope created WITHOUT the set (what installing the disable scope INSIDE `twoPassSolve`'s
 *     cache scope amounts to) refuses by name at the first lookup.
 */

import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { STRATEGY_DISABLED_SCOPE_CHANGED, withStrategySwitch } from './strategySwitch.js';
import {
    ESCAPE_CROSS_PASS_CACHE, ESCAPE_CROSS_PASS_CACHE_COUNTS, ESCAPE_CROSS_PASS_CACHE_MISMATCHES, SolverRefusal,
    escapeCrossPassScope, resetEscapeCrossPassCacheCounts, solveSegment, withEscapeCrossPassScope,
} from './solverBot.js';

const SOURCE = atlasLevelSource();
const L18 = { tape: 'r9-solve-18', goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }] };

/** The fixture's staging, honest (`escapeCrossPassCache.test.js`'s `stagingOf`, no residue). */
function stagingOf(name) {
    const base = stagingFromTape(loadTape(name));
    return { ...base, noclip: false, noDamage: false, equips: [],
        persistence: base.persistence.filter((c) => c.at === undefined) };
}

function withCache(o, fn) {
    const was = { ...ESCAPE_CROSS_PASS_CACHE };
    Object.assign(ESCAPE_CROSS_PASS_CACHE, o);
    try {
        return fn();
    } finally {
        Object.assign(ESCAPE_CROSS_PASS_CACHE, was);
    }
}

/** One `twoPassSolve` (async only for its game oracle, which throws): its outcome and the cache's counts. */
async function solve({ disable, verify = false } = {}) {
    const staging = stagingOf(L18.tape);
    resetEscapeCrossPassCacheCounts();
    let promise = null;
    withStrategySwitch(true, () => withCache({ enabled: true, verify }, () => {
        promise = twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
            goals: L18.goals, name: L18.tape, boot: staging.boot, persistence: staging.persistence,
            gameTick: () => { throw new Error('no game oracle here'); },
            ...(disable === undefined ? {} : { disable }) });
    }));
    const value = await promise;
    return { value, cache: { ...ESCAPE_CROSS_PASS_CACHE_COUNTS }, mismatches: [...ESCAPE_CROSS_PASS_CACHE_MISMATCHES] };
}

describe('strategy switch × escape cache — the scope is OUTSIDE the cache (hammer-2 option (a))', () => {
    it('VERIFY under `disable: [wand]`: 0 mismatches, the cache used, the walk unchanged', async () => {
        const plain = await solve();
        const under = await solve({ disable: ['wand'], verify: true });
        expect(under.mismatches).toEqual([]);
        expect(under.cache.verifyMismatches).toBe(0);
        expect(under.cache.lookups).toBeGreaterThan(0);
        expect(under.cache.verified).toBeGreaterThan(0);
        expect(under.value.out.disabled).toEqual({ asked: ['wand'], hits: {}, first: null, absent: [] });
        expect(under.value.out.perTick.map((k) => [...k].sort().join('+')))
            .toEqual(plain.value.out.perTick.map((k) => [...k].sort().join('+')));
        expect(plain.value.out).not.toHaveProperty('disabled');
    }, 120000);

    it('THE MUTANT — the cache scope created without the set refuses STRATEGY_DISABLED_SCOPE_CHANGED', () => {
        const staging = stagingOf(L18.tape);
        const scope = escapeCrossPassScope(); // captured under NO set: the disable scope is then installed inside it
        expect(scope.disabled).toBe(null);
        const runFor = () => scope.adopt(createRunForStaging(staging, SOURCE));
        let err = null;
        try {
            withStrategySwitch(true, () => withCache({ enabled: true }, () => withEscapeCrossPassScope(scope,
                () => solveSegment({ run: runFor(), goals: L18.goals, name: L18.tape, boot: staging.boot,
                    forkRun: runFor, disable: ['wand'] }))));
        } catch (e) { err = e; }
        expect(err).toBeInstanceOf(SolverRefusal);
        expect(err.code).toBe(STRATEGY_DISABLED_SCOPE_CHANGED);
        expect(err.message).toMatch(/escape cache \(scope \d+\) holds answers made under `disable: \[\]` and was asked under `disable: \[wand\]`/);
        // and captured under the SAME set, the same pass is served
        const right = escapeCrossPassScope({ disabled: 'wand' });
        const runRight = () => right.adopt(createRunForStaging(staging, SOURCE));
        const out = withStrategySwitch(true, () => withCache({ enabled: true }, () => withEscapeCrossPassScope(right,
            () => {
                try {
                    return solveSegment({ run: runRight(), goals: L18.goals, name: L18.tape, boot: staging.boot,
                        forkRun: runRight, disable: ['wand'] });
                } catch (e) {
                    return { refused: e.code ?? e.name };
                }
            })));
        expect(out.refused).not.toBe(STRATEGY_DISABLED_SCOPE_CHANGED);
        expect(right.counts.lookups).toBeGreaterThan(0);
    }, 120000);
});
