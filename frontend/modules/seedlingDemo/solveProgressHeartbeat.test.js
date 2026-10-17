/**
 * solveProgressHeartbeat — SEEDLING HAMMER-PHASE HB: the solver HEARTBEAT, pinned.
 *
 * The heartbeat (`solveProgress.progressHeartbeat`, `HEARTBEAT_EVERY`) is an emit-only count point inside the solver's
 * long loops: every N-th pass calls the hook with site `heartbeat`, so the worker's tap (which reads the clock) gets a
 * chance to post where the solver is otherwise silent. The contract, row by row:
 *  - `previewWalk`'s every output is byte-identical with a hook installed and without, on a committed walk, and the
 *    hooked walk did beat;
 *  - under a deadline that never trips, on L18's hammer room and L40's kill rung: the answer digest and the caller's
 *    `shouldStop` count are equal with no hook and under the worker's real tap at every rate (1000 / 100 / 50 / 0 ms);
 *  - the heartbeat is not a deadline site: every segment's `budget.asks` holds deadline sites only, and Σ asks is the
 *    unhooked solve's `shouldStop` count (an ask point reached asks the caller once);
 *  - non-vacuous: L40 beats at least `K` times, and `snapshot.heartbeat.count` is the hook's own count of them;
 *  - unhooked, no heartbeat path runs (`heartbeatEntered()` does not move), and every call site is one null check
 *    with a literal key.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   h1 the kill-stance heartbeat also calls the caller's `shouldStop` (`activeDeadline?.shouldStop('kill-chaser')`)
 *        -> the L40 row red (`shouldStop` 167 -> 187), and the call-site row
 *   h2 the heartbeat is a deadline site (`progressHeartbeat` reports through `progressSite('heartbeat')`)
 *        -> the L18 and L40 rows red (`budget.asks` holds `heartbeat`)
 *   h3 the preview heartbeat moves a counter the plan reads (the preview's `tick += 1` per beat)
 *        -> the `previewWalk` byte-identity row, the L40 row (its digest) and the call-site row red; L18's digest
 *           does not move for it (its previews' decisions survive a one-tick shift), which is why the preview row
 *           exists
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { loadTape } from './fixtures/index.js';
import { createLevelRun } from './levelRun.js';
import { ROLES } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { SPINNER } from './spinner.js';
import { DEFAULT_TOLERANCE } from './botDriverV1.js';
import { DEADLINE_SITES, previewWalk, strikePolicyFor, withSolveDeadline } from './solverBot.js';
import { HEARTBEAT_EVERY, PROGRESS_POINTS, activeProgress, heartbeatEntered, progressSegment,
    withSolveProgress } from './solveProgress.js';
import { createProgressTap } from './solveProgressTap.js';

const SOURCE = atlasLevelSource();
const HERE = dirname(fileURLToPath(import.meta.url));

/** A fixture's staging, honest, the persistence rows without an `at`, no equips (`solveProgress.test.js`'s shape). */
function stagingOf(name, residue = null) {
    const base = stagingFromTape(loadTape(name));
    let seam = base.seam;
    if (residue !== null) {
        const P = SPINNER.hammerPeriod;
        const was = ((base.seam.time % P) + P) % P;
        seam = { ...base.seam, time: base.seam.time + ((((residue - was) % P) + P) % P) - P };
    }
    return { ...base, seam, noclip: false, noDamage: false, equips: [],
        persistence: base.persistence.filter((c) => c.at === undefined) };
}

/**
 * The two solves the investigation measured: L18's hammer room (1,441 hook calls) and L40's kill rung, the chaser
 * arm's stance scan (211 hook calls, 86 % of the solve in gaps over 100 ms). `beats` is L40's floor (`K`).
 */
const SOLVES = [
    { what: 'L18 hammer room (residue 21)', tape: 'r9-solve-18', residue: 21,
        goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], ticks: 445 },
    { what: 'L40 kill rung (the totem part at (160,640))', tape: 'r5-l40-part5',
        goals: [{ kind: 'collect-placement', placement: { x: 160, y: 640 } }], ticks: 679, beats: 40 },
];

const md5 = (x) => createHash('md5').update(x).digest('hex');
const digest = (r) => (r.ok
    ? md5(JSON.stringify({ perTick: r.value.out.perTick.map((h) => [...h].sort()), trace: r.value.out.trace,
        records: r.value.out.records, transitions: r.value.out.transitions, dashes: r.value.out.dashes,
        waypointsPlanned: r.value.out.waypointsPlanned, replans: r.value.out.replans, passes: r.value.passes,
        persistence: r.value.persistence }))
    : md5(JSON.stringify({ name: r.error.name, message: r.error.message })));

/**
 * One `twoPassSolve` of `s` under a deadline that never trips (fine checkpoints on: the page's budgeted pass), with
 * `hook` installed or none. Synchronous inside its installs (`solveProgress.test.js`'s note). Returns the settled
 * answer and the caller's `shouldStop` count.
 */
async function solve(s, hook = null) {
    const staging = stagingOf(s.tape, s.residue ?? null);
    let shouldStops = 0;
    const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
        goals: s.goals, name: s.tape, boot: staging.boot, persistence: staging.persistence,
        gameTick: () => { throw new Error('no game oracle here'); } });
    const deadlined = () => withSolveDeadline({ shouldStop: () => { shouldStops += 1; return false; },
        fineCheckpoints: true }, go);
    let settled = null;
    const p = hook === null ? deadlined() : withSolveProgress(hook, deadlined);
    await p.then((value) => { settled = { ok: true, value }; }, (error) => { settled = { ok: false, error }; });
    return { ...settled, shouldStops };
}

/** The worker's own tap at `ms`, on this process's clock; it keeps every segment's last posted snapshot. */
function tapAt(ms) {
    const sites = {};
    const lasts = new Map();
    const tap = createProgressTap({ passes: [{ pass: 'probe', stop: 'all' }], clock: () => performance.now(),
        minIntervalMs: ms, budgetWork: null, post: (snap) => { lasts.set(snap.segment.index, structuredClone(snap)); } });
    const hook = (site, peek) => { sites[site] = (sites[site] ?? 0) + 1; tap.hook(site, peek); };
    return { hook, tap, sites, lasts };
}

/** `previewWalk`'s output as bytes: a held set is its sorted keys. */
const previewBytes = (pv) => JSON.stringify(pv, (k, v) => (v instanceof Set ? [...v].sort() : v));

describe('hammer-phase HB — the heartbeat is emit-only', () => {
    it('⛓⛓⛓ previewWalk: every output is byte-identical with a hook installed and without, and the hooked walk beats', () => {
        // ⛓ solverBot.test.js's committed L6 room (R9 slice 12b): two bobs, a sword, the strike policy, a corridor
        // east past `bob@112,48`, then a standing tail long enough for the transit and dwell loops to both beat.
        const l6 = () => createLevelRun({
            levelSource: SOURCE, boot: { level: 6, x: 80, y: 48 }, noclip: false, noHazards: [],
            noDamage: false, grants: [], persistence: [], despawn: [], equips: [],
            pins: ['dead_frames'], save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
        });
        const WPS = [{ x: 128, y: 56 }];
        const opts = (run) => ({ strike: strikePolicyFor(run), standFor: 3 * HEARTBEAT_EVERY['preview-sample'] });
        const a = l6();
        const off = previewBytes(previewWalk(a, WPS, DEFAULT_TOLERANCE, opts(a)));
        const b = l6();
        const sites = [];
        let pv = null;
        withSolveProgress((site) => sites.push(site), () => progressSegment('hb', b, () => {
            pv = previewWalk(b, WPS, DEFAULT_TOLERANCE, opts(b));
        }));
        expect(previewBytes(pv)).toBe(off);
        expect(pv.samples.length).toBeGreaterThanOrEqual(2 * HEARTBEAT_EVERY['preview-sample']);
        const beats = sites.filter((x) => x === 'heartbeat').length;
        expect(beats).toBe(Math.floor(pv.samples.length / HEARTBEAT_EVERY['preview-sample']));
        expect(activeProgress).toBe(null);
    }, 120_000);

    for (const s of SOLVES) {
        it(`⛓⛓⛓ ${s.what}: the digest and the shouldStop count are equal with no hook and under the tap at every rate; the asks are deadline sites only`, async () => {
            const entered = heartbeatEntered();
            const off = await solve(s);
            // ⛓ unhooked, no heartbeat code path runs
            expect(heartbeatEntered()).toBe(entered);
            expect(off.ok).toBe(true);
            expect(off.value.out.perTick.length).toBe(s.ticks);
            const want = digest(off);
            for (const ms of [1000, 100, 50, 0]) {
                const t = tapAt(ms);
                const on = await solve(s, t.hook);
                t.tap.finish();
                expect([ms, digest(on)]).toEqual([ms, want]);
                expect([ms, on.shouldStops]).toEqual([ms, off.shouldStops]);
                expect(Object.keys(t.sites).every((x) => PROGRESS_POINTS.includes(x) || DEADLINE_SITES.includes(x)))
                    .toBe(true);
                if (ms !== 0) continue;
                // ⛓ at 0 ms every hook call posts, so each segment's last post is its final snapshot
                let asked = 0;
                for (const snap of t.lasts.values()) {
                    expect(Object.keys(snap.budget.asks).every((k) => DEADLINE_SITES.includes(k))).toBe(true);
                    asked += Object.values(snap.budget.asks).reduce((n, k) => n + k, 0);
                }
                expect(asked).toBe(off.shouldStops);
                const last = [...t.lasts.values()].at(-1);
                expect(last.heartbeat?.count ?? 0).toBe(t.sites.heartbeat ?? 0);
                if (s.beats) expect(t.sites.heartbeat).toBeGreaterThanOrEqual(s.beats);
            }
            expect(activeProgress).toBe(null);
        }, 600_000);
    }

    it('⛓⛓ every call site is one null check with a literal key of HEARTBEAT_EVERY (unhooked: no allocation, no call)', () => {
        const src = readFileSync(join(HERE, 'solverBot.js'), 'utf8');
        const calls = src.match(/progressHeartbeat\(/g) ?? [];
        const sites = [...src.matchAll(/ if \(activeProgress !== null\) progressHeartbeat\('([a-z-]+)'\);/g)];
        // the import names it once; every other mention is a guarded call with a literal key
        expect(calls.length).toBe(sites.length);
        expect(sites.length).toBeGreaterThan(0);
        for (const m of sites) expect(Object.keys(HEARTBEAT_EVERY)).toContain(m[1]);
        expect(new Set(sites.map((m) => m[1]))).toEqual(new Set(Object.keys(HEARTBEAT_EVERY)));
        expect(Object.values(HEARTBEAT_EVERY).every((n) => Number.isInteger(n) && n >= 1)).toBe(true);
        expect(DEADLINE_SITES).not.toContain('heartbeat');
    });
});
