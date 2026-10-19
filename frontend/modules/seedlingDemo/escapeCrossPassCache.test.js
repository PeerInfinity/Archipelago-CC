/**
 * SEEDLING HAMMER-PHASE XC — the cross-pass escape cache (`ESCAPE_CROSS_PASS_CACHE`, OFF), keyed on
 * `run.stateDigest()` + the call's arguments + the solver-side globals, scoped per `twoPassSolve` call
 * (`CC/docs/cloud-reports/seedling-hammer-cross-pass-cache.md`).
 *
 * The rows:
 *   - ON IS OFF: L18 (defaults and `STRIKE_ETA_FLOOR` ON), L6 and L3 solve to the same bytes, the same progress stream
 *     (every peek, whole), the same `shouldStop` total and asks by site, and the same instruments — with cross-pass
 *     hits on L18 (the row is not vacuous);
 *   - THE DEADLINE: a budget that trips mid-search gives OFF's answer and asks, a hit tripped at its k-th ask
 *     included; a tripped miss is never stored, and an entry stored before a trip is never read after one;
 *   - VERIFY: every hit recomputed and compared, 0 mismatches;
 *   - THE CAP: a tiny cap is OFF exactly, and refuses to store rather than evict;
 *   - THE SCOPE: a second `twoPassSolve` starts empty;
 *   - THE KEY, a row per field a mutant could drop: two seam times across the hammer's phase (and a beam-tower room)
 *     are two entries; `pressAt` and the held sets' order are in the key; the deadline's presence is in the key; a
 *     call that builds a lazy visit state mid-tick is never stored (the per-TICK digest's trap).
 * Each mutant in the report's list turns one of these red.
 */

import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { SPINNER } from './spinner.js';
import { canonicalDigestText } from './levelRun.js';
import { PRESS_KILL_COST_COUNTS, resetPressKillCostCounts } from './pressKillCost.js';
import { withSolveProgress } from './solveProgress.js';
import {
    ESCAPE_CROSS_PASS_CACHE, ESCAPE_CROSS_PASS_CACHE_COUNTS, ESCAPE_CROSS_PASS_CACHE_MISMATCHES,
    ESCAPE_CROSS_PASS_CACHE_TRACE, HAMMER_ESCAPE_TRACE, STRIKE_ETA_FLOOR, escapeCrossPassScope, pressEscape,
    resetEscapeCrossPassCacheCounts, withEscapeCrossPassCache, withEscapeCrossPassScope, withSolveDeadline,
} from './solverBot.js';

const SOURCE = atlasLevelSource();
const L18 = { tape: 'r9-solve-18', goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }] };

/** A fixture's staging, honest, the persistence rows without an `at`, no equips (solveProgress.test.js's shape). */
function stagingOf(name, residue = null, shift = 0) {
    const base = stagingFromTape(loadTape(name));
    let seam = base.seam;
    if (residue !== null) {
        const P = SPINNER.hammerPeriod;
        const was = ((base.seam.time % P) + P) % P;
        seam = { ...base.seam, time: base.seam.time + ((((residue - was) % P) + P) % P) - P };
    }
    if (shift !== 0) seam = { ...seam, time: seam.time + shift };
    return { ...base, seam, noclip: false, noDamage: false, equips: [],
        persistence: base.persistence.filter((c) => c.at === undefined) };
}

/** Run `fn` with the cache's switch (and its knobs) set, restored after. */
function withCache(o, fn) {
    const was = { ...ESCAPE_CROSS_PASS_CACHE };
    Object.assign(ESCAPE_CROSS_PASS_CACHE, o);
    try {
        return fn();
    } finally {
        Object.assign(ESCAPE_CROSS_PASS_CACHE, was);
    }
}

const sorted = (k, v) => (v instanceof Set ? [...v].sort() : (v instanceof Map ? [...v] : v));

/**
 * One `twoPassSolve`, synchronously (it is `async` only for its game oracle, which throws): everything a row compares.
 * `deadline` is `null` (none) or `(site, calls) => boolean`.
 */
function solve({ tape, goals }, { residue = null, cache = false, verify = false, hook = false, deadline = null,
    floor = false, maxEntries } = {}) {
    const staging = stagingOf(tape, residue);
    const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
        goals, name: tape, boot: staging.boot, persistence: staging.persistence,
        gameTick: () => { throw new Error('no game oracle here'); } });
    let calls = 0;
    const stream = [];
    const lasts = new Map();
    const peek = (site, p) => {
        const snap = p();
        stream.push(JSON.stringify({ site, snap }));
        if (snap) lasts.set(snap.segment.index, snap);
    };
    // ⚠ a tripped `withSolveDeadline` spreads its report onto the value: the promise is kept from inside it
    let promise = null;
    let report = null;
    const deadlined = () => {
        if (deadline === null) return (promise = go());
        report = withSolveDeadline({ fineCheckpoints: true,
            shouldStop: (site) => { calls += 1; return deadline(site, calls); } }, () => (promise = go())).deadline ?? null;
        return promise;
    };
    resetPressKillCostCounts();
    resetEscapeCrossPassCacheCounts();
    const wasFloor = STRIKE_ETA_FLOOR.enabled;
    STRIKE_ETA_FLOOR.enabled = floor;
    let settled = null;
    try {
        const knobs = { enabled: cache, verify, ...(maxEntries === undefined ? {} : { maxEntries }) };
        withCache(knobs, () => (hook ? withSolveProgress(peek, deadlined) : deadlined()));
        promise.then((value) => { settled = { ok: true, value }; }, (error) => { settled = { ok: false, error }; });
    } finally {
        STRIKE_ETA_FLOOR.enabled = wasFloor;
    }
    return Promise.resolve().then(() => {
        const asks = {};
        for (const x of lasts.values()) for (const [k, n] of Object.entries(x.budget.asks)) asks[k] = (asks[k] ?? 0) + n;
        const r = settled;
        return {
            bytes: r.ok ? JSON.stringify({ out: r.value.out, passes: r.value.passes, persistence: r.value.persistence,
                report }, sorted) : JSON.stringify({ name: r.error.name, message: r.error.message, report }),
            ok: r.ok, value: r.ok ? r.value : null, staging, stream: stream.join('\n'), peeks: stream.length, shouldStop: calls, asks,
            pk: { ...PRESS_KILL_COST_COUNTS }, cache: { ...ESCAPE_CROSS_PASS_CACHE_COUNTS },
            mismatches: [...ESCAPE_CROSS_PASS_CACHE_MISMATCHES],
        };
    });
}

/** The comparable part of two `solve`s (the cache's own counts aside). */
const same = (a) => ({ bytes: a.bytes, stream: a.stream, shouldStop: a.shouldStop, asks: a.asks, pk: a.pk });

/** An L18 run at `shift` ticks of `seam.time`, driven along the committed tape to tick `T`. */
function l18At(T, shift = 0) {
    const tape = loadTape(L18.tape);
    const run = createRunForStaging(stagingOf(L18.tape, null, shift), SOURCE);
    for (let t = 0; t < T; t += 1) run.advance(heldKeysAt(tape, t));
    return run;
}

/** The answer's own bytes. */
const answerText = (a) => canonicalDigestText(a);

/** `fn()` under a deadline whose `shouldStop` is `stop`, its OWN value (not `withSolveDeadline`'s merged one). */
function under(stop, fn) {
    let out;
    withSolveDeadline({ shouldStop: stop }, () => { out = fn(); return {}; });
    return out;
}

describe('hammer-phase XC — the cross-pass escape cache: ON is OFF', () => {
    it('⛓⛓ OFF by default; the scope is per call and empty', () => {
        expect(ESCAPE_CROSS_PASS_CACHE.enabled).toBe(false);
        expect(ESCAPE_CROSS_PASS_CACHE.verify).toBe(false);
        expect(ESCAPE_CROSS_PASS_CACHE.maxEntries).toBeGreaterThan(0);
        expect(withEscapeCrossPassCache(true, () => ESCAPE_CROSS_PASS_CACHE.enabled)).toBe(true);
        expect(ESCAPE_CROSS_PASS_CACHE.enabled).toBe(false);
        const a = escapeCrossPassScope();
        const b = escapeCrossPassScope();
        expect(a.id).not.toBe(b.id);
        expect(a.entries.size).toBe(0);
    });

    for (const floor of [false, true]) {
        it(`⛓⛓⛓ L18 residue 21${floor ? ', STRIKE_ETA_FLOOR ON' : ''}: the bytes, the stream, the asks, the shouldStop total and the instruments are OFF's, with cross-pass hits`, async () => {
            const o = { residue: 21, floor, hook: true, deadline: () => false };
            const off = await solve(L18, o);
            const on = await solve(L18, { ...o, cache: true });
            expect(off.ok).toBe(true);
            expect(same(on)).toEqual(same(off));
            expect(off.shouldStop).toBeGreaterThan(0);
            if (!floor) expect(off.asks['hammer-escape']).toBeGreaterThan(0);
            // ⛓ not vacuous: the passes after the first are served by the first
            expect(on.cache.crossPassHits).toBeGreaterThan(0);
            expect(on.cache.crossPassHits / on.cache.lookups).toBeGreaterThan(0.5);
            // ⛓ and with no hook and no deadline, the plain bytes too
            const offPlain = await solve(L18, { residue: 21, floor });
            const onPlain = await solve(L18, { residue: 21, floor, cache: true });
            expect(onPlain.bytes).toBe(offPlain.bytes);
            expect(onPlain.pk).toEqual(offPlain.pk);
            expect(onPlain.cache.crossPassHits).toBe(on.cache.crossPassHits);
        }, 300_000);
    }

    for (const [what, s] of [
        ['L6 ladder climb', { tape: 'r8-solve-6', goals: [{ kind: 'reach-exit', exit: { x: 224, y: 32 } }] }],
        ['L3 plain walk', { tape: 'r8-solve-3', goals: [{ kind: 'reach-exit', exit: { x: 128, y: 48 } }] }],
    ]) {
        it(`⛓ ${what}: ON is OFF (no escape is asked; nothing is looked up)`, async () => {
            const o = { hook: true, deadline: () => false };
            const off = await solve(s, o);
            const on = await solve(s, { ...o, cache: true });
            expect(off.ok).toBe(true);
            expect(same(on)).toEqual(same(off));
            expect(on.cache.lookups).toBe(0);
        }, 300_000);
    }
});

describe('hammer-phase XC — the deadline (js-7 condition 1)', () => {
    it('⛓⛓⛓ a budget that trips mid-search gives OFF\'s answer, stream and asks — a hit tripped at its k-th ask included', async () => {
        let replayed = 0;
        for (const k of [5, 50, 80]) {
            // ⛓ the budget trips at the escape site's k-th ask
            let asked = 0;
            const o = { residue: 21, hook: true, deadline: (site) => site === 'hammer-escape' && (asked += 1) >= k };
            const off = await solve(L18, o);
            asked = 0;
            const on = await solve(L18, { ...o, cache: true });
            expect(same(on)).toEqual(same(off));
            expect(on.cache.bypassedTripped).toBeGreaterThan(0);
            replayed += on.cache.tripReplays;
            if (k === 5) {
                // ⛓ the trip lands in pass 1, on a miss: it is not stored, and nothing after it is read
                expect(on.cache.notStoredTripped).toBe(1);
                expect(on.cache.hits).toBe(0);
            }
        }
        // ⛓ not vacuous: at least one trip landed on a HIT and was re-derived at its ask
        expect(replayed).toBeGreaterThan(0);
    }, 300_000);
});

describe('hammer-phase XC — verify mode (js-7 condition 2)', () => {
    for (const floor of [false, true]) {
        it(`⛓⛓⛓ every hit recomputed and compared: 0 mismatches${floor ? ' (floor ON)' : ''}, and the bytes are OFF's`, async () => {
            const off = await solve(L18, { residue: 21, floor, hook: true, deadline: () => false });
            const on = await solve(L18, { residue: 21, floor, hook: true, deadline: () => false, cache: true,
                verify: true });
            expect(same(on)).toEqual(same(off));
            expect(on.cache.verified).toBeGreaterThan(0);
            expect(on.cache.verified).toBe(on.cache.hits);
            expect(on.cache.verifyMismatches).toBe(0);
            expect(on.mismatches).toEqual([]);
        }, 300_000);
    }
});

describe('hammer-phase XC — the cap (js-7 condition 3)', () => {
    for (const maxEntries of [0, 1, 7]) {
        it(`⛓⛓ maxEntries ${maxEntries}: OFF exactly, and a full scope misses rather than evicts`, async () => {
            const off = await solve(L18, { residue: 21, hook: true, deadline: () => false });
            const on = await solve(L18, { residue: 21, hook: true, deadline: () => false, cache: true, maxEntries });
            expect(same(on)).toEqual(same(off));
            expect(on.cache.stored).toBe(maxEntries);
            expect(on.cache.notStoredCap).toBeGreaterThan(0);
            if (maxEntries === 0) expect(on.cache.hits).toBe(0);
        }, 300_000);
    }
});

describe('hammer-phase XC — the scope (js-7 condition 4)', () => {
    it('⛓⛓⛓ two solves back to back: the second\'s first lookup misses, and it hits exactly as the first did', async () => {
        const seen = [];
        ESCAPE_CROSS_PASS_CACHE_TRACE.sink = (r) => { seen.push({ scope: r.scope, run: r.run, outcome: r.outcome }); };
        let a;
        let b;
        try {
            a = await solve(L18, { residue: 21, cache: true });
            b = await solve(L18, { residue: 21, cache: true });
        } finally {
            ESCAPE_CROSS_PASS_CACHE_TRACE.sink = null;
        }
        const scopes = [...new Set(seen.map((r) => r.scope))];
        expect(scopes.length).toBe(2);
        const second = seen.filter((r) => r.scope === scopes[1]);
        expect(second[0].outcome).toBe('miss');
        expect(second[0].run).toBe(1);
        expect(b.bytes).toBe(a.bytes);
        expect(b.cache.hits).toBe(a.cache.hits);
        for (const s of scopes) expect(seen.find((r) => r.scope === s).outcome).toBe('miss');
    }, 300_000);
});

/**
 * ⛓ THE KEY'S ROWS — constructed calls, each in one scope over runs it adopted, each answer compared with OFF's (the
 * same call on a fresh run, no scope). The call that has a real search behind it (asks, nodes) is taken from a solve:
 * the L18 residue-21 call with the most `hammer-escape` asks, re-asked on a run driven to its tick.
 */
function scoped(fn) {
    const scope = escapeCrossPassScope();
    return withCache({ enabled: true, verify: false }, () => withEscapeCrossPassScope(scope, () => fn(scope)));
}

/**
 * The call with the most expansions on the SOLVING pass of an L18 residue-21 solve (its walk is the answer's, so a
 * fresh run driven along it reaches the call's state — asserted by digest): its tick and its arguments, copied.
 */
let biggest = null;
async function biggestCall() {
    if (biggest !== null) return biggest;
    const calls = [];
    let pending = null;
    ESCAPE_CROSS_PASS_CACHE_TRACE.sink = (r) => {
        pending = { t: r.t, run: r.run, opts: { ...r.opts, state: { ...r.opts.state }, keys: [...(r.opts.keys ?? [])] } };
    };
    HAMMER_ESCAPE_TRACE.sink = (r) => {
        if (pending !== null) calls.push({ ...pending, expansions: r.expansions, digest: r.run.stateDigest() });
        pending = null;
    };
    let out;
    try {
        out = await solve(L18, { residue: 21, cache: true });
    } finally {
        ESCAPE_CROSS_PASS_CACHE_TRACE.sink = null;
        HAMMER_ESCAPE_TRACE.sink = null;
    }
    expect(out.ok).toBe(true);
    walk21 = { staging: { ...out.staging, persistence: out.value.persistence }, perTick: out.value.out.perTick };
    // ⛓ the costliest (its search asks the deadline), and the costliest whose held sets are not all one set (their
    // ORDER is then a real argument)
    const last = Math.max(...calls.map((c) => c.run));
    const most = (cs) => cs.reduce((a, c) => (c.expansions > a.expansions ? c : a));
    const varied = (c) => new Set(c.opts.keys.map((k) => [...k].sort().join('+'))).size > 1;
    const mine = calls.filter((c) => c.run === last);
    biggest = { asking: most(mine), varied: most(mine.filter(varied)) };
    for (const c of Object.values(biggest)) expect(replayTo(c.t).stateDigest()).toBe(c.digest);
    return biggest;
}

describe('hammer-phase XC — the key', () => {
    it('⛓⛓⛓ the clocked hazard: one call at two seam times across the hammer\'s phase is two entries, and the two answers differ', () => {
        // ⛓ P = 77, the tape's second press, asked from t76: shift 0 escapes, shift 1 is exhausted (measured)
        const T = 76;
        const tape = loadTape(L18.tape);
        const opts = (run) => ({ state: run.state, at: T, keys: [heldKeysAt(tape, T)], pressAt: 77,
            id: run.entities('spinnerBodies')[0].id });
        const off0 = pressEscape(l18At(T, 0), opts(l18At(T, 0)));
        const off1 = pressEscape(l18At(T, 1), opts(l18At(T, 1)));
        expect(answerText(off0)).not.toBe(answerText(off1));
        expect(off0.ok).toBe(true);
        expect(off1.bound).toBe('exhausted');
        let entered = 0;
        HAMMER_ESCAPE_TRACE.sink = () => { entered += 1; };
        try {
            scoped((scope) => {
                const a = scope.adopt(l18At(T, 0));
                const b = scope.adopt(l18At(T, 1));
                resetEscapeCrossPassCacheCounts();
                expect(answerText(pressEscape(a, opts(a)))).toBe(answerText(off0));
                expect(answerText(pressEscape(b, opts(b)))).toBe(answerText(off1));
                expect(ESCAPE_CROSS_PASS_CACHE_COUNTS.misses).toBe(2);
                expect(scope.entries.size).toBe(2);
            });
        } finally {
            HAMMER_ESCAPE_TRACE.sink = null;
        }
        expect(entered).toBe(2);
    }, 120_000);

    it('⛓⛓ the clocked hazard in a beam-tower room (L104): the escape is entered, the two seam times are two entries', () => {
        const tape = loadTape('ladder2-l104-beam');
        const at = (shift) => {
            const st = stagingFromTape(tape);
            const run = createRunForStaging({ ...st, seam: { ...st.seam, time: st.seam.time + shift } }, SOURCE);
            for (let t = 0; t < 100; t += 1) run.advance(heldKeysAt(tape, t));
            return run;
        };
        const opts = (run) => ({ state: run.state, at: 100, keys: [new Set()], pressAt: 101, id: 'none' });
        let entered = 0;
        HAMMER_ESCAPE_TRACE.sink = () => { entered += 1; };
        try {
            scoped((scope) => {
                const a = scope.adopt(at(0));
                const b = scope.adopt(at(7));
                expect(a.level).toBe(104);
                expect(a.stateDigest({ parts: true }).parts.clock).not.toBe(b.stateDigest({ parts: true }).parts.clock);
                resetEscapeCrossPassCacheCounts();
                pressEscape(a, opts(a));
                pressEscape(b, opts(b));
                expect(ESCAPE_CROSS_PASS_CACHE_COUNTS.lookups).toBe(2);
                expect(ESCAPE_CROSS_PASS_CACHE_COUNTS.hits).toBe(0);
                expect(scope.entries.size).toBe(2);
            });
        } finally {
            HAMMER_ESCAPE_TRACE.sink = null;
        }
        expect(entered).toBe(2);
    }, 120_000);

    it('⛓⛓⛓ the arguments: `pressAt` and the held sets\' ORDER are in the key — each variant is OFF\'s answer', async () => {
        const big = (await biggestCall()).varied;
        const keys = big.opts.keys;
        expect(keys.length).toBeGreaterThan(1);
        const rev = [...keys].reverse();
        expect(canonicalDigestText(rev)).not.toBe(canonicalDigestText(keys));
        const variants = [big.opts, { ...big.opts, pressAt: big.opts.pressAt + 1 }, { ...big.opts, keys: rev }];
        const fresh = () => replayTo(big.t);
        const offs = variants.map((v) => answerText(pressEscape(fresh(), v)));
        expect(new Set(offs).size).toBe(3);
        scoped((scope) => {
            const run = scope.adopt(fresh());
            resetEscapeCrossPassCacheCounts();
            const ons = variants.map((v) => answerText(pressEscape(run, v)));
            expect(ons).toEqual(offs);
            expect(ESCAPE_CROSS_PASS_CACHE_COUNTS.misses).toBe(3);
            // ⛓ and the same call again is a hit with the same answer
            expect(answerText(pressEscape(run, variants[0]))).toBe(offs[0]);
            expect(ESCAPE_CROSS_PASS_CACHE_COUNTS.hits).toBe(1);
        });
    }, 300_000);

    it('⛓⛓⛓ the deadline\'s presence is in the key; a tripped miss is never stored; an entry stored before a trip is never read after one', async () => {
        const big = (await biggestCall()).asking;
        expect(big.expansions).toBeGreaterThan(250);
        const fresh = () => replayTo(big.t);
        let asks = 0;
        const counting = (trip = () => false) => () => { asks += 1; return trip(asks); };
        // OFF: the call with no deadline, and under one that never trips (its asks counted)
        const offNone = answerText(pressEscape(fresh(), big.opts));
        asks = 0;
        const offLive = under(counting(), () => answerText(pressEscape(fresh(), big.opts)));
        const offAsks = asks;
        expect(offAsks).toBeGreaterThan(0);
        // OFF: tripped at its first ask
        asks = 0;
        const offTrip = under(counting(() => true), () => pressEscape(fresh(), big.opts));
        expect(offTrip.claim).toBe(false);
        scoped((scope) => {
            const run = scope.adopt(fresh());
            resetEscapeCrossPassCacheCounts();
            // ⛓ (a) no deadline, stored; then live: a MISS, and it asks what OFF asks
            expect(answerText(pressEscape(run, big.opts))).toBe(offNone);
            asks = 0;
            expect(under(counting(), () => answerText(pressEscape(run, big.opts)))).toBe(offLive);
            expect(asks).toBe(offAsks);
            expect(ESCAPE_CROSS_PASS_CACHE_COUNTS.hits).toBe(0);
            expect(scope.entries.size).toBe(2);
        });
        scoped((scope) => {
            const run = scope.adopt(fresh());
            resetEscapeCrossPassCacheCounts();
            // ⛓ (b) a trip at the first ask is not stored: the same call under a live budget is OFF's whole answer
            asks = 0;
            expect(answerText(under(counting(() => true), () => pressEscape(run, big.opts))))
                .toBe(answerText(offTrip));
            expect(ESCAPE_CROSS_PASS_CACHE_COUNTS.notStoredTripped).toBe(1);
            expect(scope.entries.size).toBe(0);
            asks = 0;
            expect(under(counting(), () => answerText(pressEscape(run, big.opts)))).toBe(offLive);
            expect(asks).toBe(offAsks);
        });
        scoped((scope) => {
            const run = scope.adopt(fresh());
            resetEscapeCrossPassCacheCounts();
            // ⛓ (c) stored under a live budget, the budget then trips (the same call on a run the scope does not serve):
            // the first call again is OFF's tripped answer, read through no entry
            let tripNow = false;
            under(() => tripNow, () => {
                expect(answerText(pressEscape(run, big.opts))).toBe(offLive);
                tripNow = true;
                expect(pressEscape(fresh(), big.opts).claim).toBe(false);
                expect(answerText(pressEscape(run, big.opts))).toBe(answerText(offTrip));
            });
            expect(ESCAPE_CROSS_PASS_CACHE_COUNTS.hits).toBe(0);
            expect(ESCAPE_CROSS_PASS_CACHE_COUNTS.bypassedTripped).toBe(1);
        });
    }, 300_000);

    it('⛓⛓⛓ the digest is per CALL: a call that builds a lazy visit state is never stored, so the next run builds it too (the per-tick mutant\'s trap)', () => {
        const tape = loadTape(L18.tape);
        const keys = [];
        for (let t = 0; t < 44; t += 1) keys.push(heldKeysAt(tape, t));
        const opts = (run) => ({ state: run.state, at: 0, keys, pressAt: 44, id: run.entities('spinnerBodies')[0].id });
        const offRun = l18At(0);
        const before = offRun.stateDigest();
        const off = answerText(pressEscape(offRun, opts(offRun)));
        const after = offRun.stateDigest();
        // ⛓ the first escape of a fresh run builds visit state: the digest moves across it, in `visit` alone
        expect(after).not.toBe(before);
        scoped((scope) => {
            resetEscapeCrossPassCacheCounts();
            const a = scope.adopt(l18At(0));
            expect(answerText(pressEscape(a, opts(a)))).toBe(off);
            expect(ESCAPE_CROSS_PASS_CACHE_COUNTS.notStoredMoved).toBe(1);
            // ⛓ a second fresh run in the scope (pass 2's shape): its first call misses and builds what OFF builds
            const b = scope.adopt(l18At(0));
            expect(b.stateDigest()).toBe(before);
            expect(answerText(pressEscape(b, opts(b)))).toBe(off);
            expect(b.stateDigest()).toBe(after);
            expect(ESCAPE_CROSS_PASS_CACHE_COUNTS.hits).toBe(0);
            // ⛓ and the same call again, now that nothing builds, is stored and then served
            expect(answerText(pressEscape(b, opts(b)))).toBe(off);
            expect(answerText(pressEscape(a, opts(a)))).toBe(off);
            expect(ESCAPE_CROSS_PASS_CACHE_COUNTS.hits).toBe(1);
            expect(a.stateDigest()).toBe(after);
        });
    }, 120_000);
});

/** A residue-21 L18 run driven to tick `t` along the solve's own walk (re-solved once, OFF, and kept). */
let walk21 = null;
function replayTo(t) {
    if (walk21 === null) throw new Error('replayTo: solve first (biggestCall)');
    const run = createRunForStaging(walk21.staging, SOURCE);
    for (let k = 0; k < t; k += 1) run.advance(walk21.perTick[k]);
    return run;
}
