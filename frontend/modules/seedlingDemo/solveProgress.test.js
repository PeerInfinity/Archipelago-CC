/**
 * solveProgress — SEEDLING HAMMER-PHASE D1/D3: the solver's PROGRESS EMITTER, pinned.
 *
 * The contract (`solveProgress.js`'s docblock, `seedling-solve-progress.md`):
 *  - BYTE-IDENTITY: with and without a hook (one that peeks at every call, one that never peeks, one that throws),
 *    under no deadline and under a deadline that never trips, every plan, trace, record and verdict is the same bytes;
 *  - STRUCTURE: the tree's keys are role paths, stable across a stream; counts never fall; a tile's `reached` never
 *    falls and its `firstTick` never rises;
 *  - CLONE SAFETY: a snapshot survives `structuredClone`, and mutating it leaves the next snapshot unchanged;
 *  - THE WORK UNIT: under a deadline, `budget.work.shouldStop` is the caller's own count of `shouldStop` calls.
 *
 * Three solves: the L18 hammer room at residue 21 (`hammerEscape.test.js`'s witness `hammer-a-l18-escape21`: a
 * press kill, its escapes, three two-pass segments), L6 (`r8-solve-6`: a ladder climb, AVOID → PULL → TIME → BAIT)
 * and L3 (`r8-solve-3`: a plain walk).
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   m1 `progressPreview` cuts the preview it was handed (`samples.length = 5`): an observer that writes what the
 *        solver reads -> the L6 and L18 byte-identity rows red
 *   m2 `reach` keeps the LATEST tick instead of the earliest -> both `firstTick never rises` rows red
 *   m3 `snapshotOf` hands out the live `asks` object instead of a copy -> the clone-safety row red
 *   ⚠ m1 first nudged each sample's x by 0.001 px instead: no row went red, because a calm room's decisions do not
 *      move for it. The cut is the mutation that pins "an observer that writes".
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { SPINNER } from './spinner.js';
import { DEADLINE_SITES, solveSegment, withSolveDeadline, withSolveProgress as reExported } from './solverBot.js';
import {
    PROGRESS_POINTS, PROGRESS_TILE, SOLVE_PROGRESS_VERSION, activeProgress, installSolveProgress, progressReason,
    withSolveProgress,
} from './solveProgress.js';

const SOURCE = atlasLevelSource();

/** A fixture's staging, honest, the persistence rows without an `at`, no equips (the hammer rows' shape). */
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

const SOLVES = [
    { what: 'L18 hammer room (residue 21)', tape: 'r9-solve-18', residue: 21,
        goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], ticks: 445, passes: 3 },
    { what: 'L6 ladder climb', tape: 'r8-solve-6', goals: [{ kind: 'reach-exit', exit: { x: 224, y: 32 } }],
        ticks: 294, passes: 1 },
    { what: 'L3 plain walk', tape: 'r8-solve-3', goals: [{ kind: 'reach-exit', exit: { x: 128, y: 48 } }],
        ticks: 245, passes: 1 },
];

/**
 * One `twoPassSolve` of `s`, synchronously: it is `async` only for its game oracle, and this one throws synchronously,
 * so no `await` is reached and every pass runs inside the caller's installs. Returns the settled answer.
 */
function solve(s, { hook = null, deadline = null } = {}) {
    const staging = stagingOf(s.tape, s.residue ?? null);
    const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
        goals: s.goals, name: s.tape, boot: staging.boot, persistence: staging.persistence,
        gameTick: () => { throw new Error('no game oracle here'); } });
    const deadlined = () => (deadline === null ? go() : withSolveDeadline(deadline, go));
    let settled = null;
    const p = hook === null ? deadlined() : withSolveProgress(hook, deadlined);
    p.then((value) => { settled = { ok: true, value }; }, (error) => { settled = { ok: false, error }; });
    return p.then(() => settled, () => settled);
}

const md5 = (x) => createHash('md5').update(x).digest('hex');
/** The answer's bytes: what "byte-identical with and without the hook" compares. */
const digest = (r) => (r.ok
    ? md5(JSON.stringify({ perTick: r.value.out.perTick.map((h) => [...h].sort()), trace: r.value.out.trace,
        records: r.value.out.records, transitions: r.value.out.transitions, dashes: r.value.out.dashes,
        waypointsPlanned: r.value.out.waypointsPlanned, replans: r.value.out.replans, passes: r.value.passes,
        persistence: r.value.persistence }))
    : md5(JSON.stringify({ name: r.error.name, message: r.error.message })));

/** A hook that peeks at EVERY call and keeps the stream. */
function streamHook() {
    const stream = [];
    const hook = (site, peek) => { stream.push({ site, snap: peek() }); };
    return { hook, stream };
}

describe('hammer-phase D1 — the progress hook is observation only (byte-identity)', () => {
    for (const s of SOLVES) {
        it(`⛓⛓⛓ ${s.what}: no hook, a peeking hook, a silent hook and a throwing hook give the same bytes`, async () => {
            const off = await solve(s);
            expect(off.ok).toBe(true);
            expect(off.value.out.perTick.length).toBe(s.ticks);
            expect(off.value.passes.length).toBe(s.passes);
            const want = digest(off);
            const { hook, stream } = streamHook();
            expect(digest(await solve(s, { hook }))).toBe(want);
            expect(stream.length).toBeGreaterThan(0);
            let silent = 0;
            expect(digest(await solve(s, { hook: () => { silent += 1; } }))).toBe(want);
            expect(silent).toBe(stream.length);
            expect(digest(await solve(s, { hook: (site, peek) => { peek(); throw new Error('a listener bug'); } })))
                .toBe(want);
            expect(activeProgress).toBe(null);
        }, 300_000);
    }

    it('⛓⛓ under a deadline that never trips (the page\'s budgeted pass), the hook changes nothing either, and work.shouldStop IS the caller\'s count', async () => {
        const s = SOLVES[0];
        let calls = 0;
        const deadline = () => ({ shouldStop: () => { calls += 1; return false; }, fineCheckpoints: true });
        const off = await solve(s, { deadline: deadline() });
        const offCalls = calls;
        calls = 0;
        const { hook, stream } = streamHook();
        const on = await solve(s, { hook, deadline: deadline() });
        expect(digest(on)).toBe(digest(off));
        expect(calls).toBe(offCalls);
        // ⛓ the three passes are three segments: each one's last snapshot counts its own `shouldStop` calls
        const lasts = new Map();
        for (const { snap } of stream) if (snap) lasts.set(snap.segment.index, snap);
        expect([...lasts.keys()]).toEqual([0, 1, 2]);
        const counted = [...lasts.values()].reduce((n, x) => n + x.budget.work.shouldStop, 0);
        expect(counted).toBe(calls);
        // ⛓ and with nothing tripped, every ask point reached asked the caller once
        for (const x of lasts.values()) {
            expect(Object.values(x.budget.asks).reduce((n, k) => n + k, 0)).toBe(x.budget.work.shouldStop);
            expect(Object.keys(x.budget.asks).every((k) => DEADLINE_SITES.includes(k))).toBe(true);
        }
        expect(lasts.get(2).budget.asks['hammer-escape']).toBeGreaterThan(0);
    }, 300_000);

    it('⛓ the install: solveSegment takes onProgress, solverBot re-exports withSolveProgress, nested installs restore the outer', () => {
        expect(reExported).toBe(withSolveProgress);
        const seen = [];
        withSolveProgress(() => seen.push('outer'), () => {
            const outer = activeProgress;
            withSolveProgress(() => seen.push('inner'), () => {
                expect(activeProgress).not.toBe(outer);
            });
            expect(activeProgress).toBe(outer);
        });
        expect(activeProgress).toBe(null);
        expect(() => withSolveProgress(42, () => {})).toThrow(/onProgress must be a function/);
        const staging = stagingOf('r8-solve-3');
        const sites = [];
        const out = solveSegment({ run: createRunForStaging(staging, SOURCE), goals: SOLVES[2].goals,
            name: 'r8-solve-3', boot: staging.boot, onProgress: (site) => sites.push(site) });
        expect(out.perTick.length).toBe(245);
        expect(sites[0]).toBe('segment');
        expect(sites.at(-1)).toBe('done');
        expect(sites.every((x) => PROGRESS_POINTS.includes(x) || DEADLINE_SITES.includes(x))).toBe(true);
        expect(activeProgress).toBe(null);
        // ⛓ the persistent install (the preload's): until uninstalled, every solve reports; the uninstall restores
        const persistent = [];
        const uninstall = installSolveProgress((site) => persistent.push(site));
        const out2 = solveSegment({ run: createRunForStaging(staging, SOURCE), goals: SOLVES[2].goals,
            name: 'r8-solve-3', boot: staging.boot });
        uninstall();
        expect(activeProgress).toBe(null);
        expect(persistent).toEqual(sites);
        expect(JSON.stringify(out2.trace)).toBe(JSON.stringify(out.trace));
        uninstall();
        expect(activeProgress).toBe(null);
    }, 120_000);
});

describe('hammer-phase D1 — the snapshot\'s structure', () => {
    const streams = new Map();
    const streamOf = async (s) => {
        if (!streams.has(s.tape)) {
            const { hook, stream } = streamHook();
            await solve(s, { hook });
            streams.set(s.tape, stream.filter((x) => x.snap !== null).map((x) => ({ site: x.site, snap: x.snap })));
        }
        return streams.get(s.tape);
    };
    const nodes = (n, out = []) => { out.push(n); for (const c of n.children) nodes(c, out); return out; };

    for (const s of SOLVES.slice(0, 2)) {
        it(`⛓⛓ ${s.what}: keys are role paths, stable across the stream; counts never fall`, async () => {
            const stream = await streamOf(s);
            expect(stream.length).toBeGreaterThan(10);
            const roleOf = new Map();
            const prev = new Map();
            let seg = -1;
            let seq = 0;
            for (const { snap } of stream) {
                expect(snap.v).toBe(SOLVE_PROGRESS_VERSION);
                // ⛓ `seq` (the JS arc's ask): the install's hook-call count, strictly rising — the page orders and dedupes by it
                expect(Number.isInteger(snap.seq) && snap.seq > seq).toBe(true);
                seq = snap.seq;
                if (snap.segment.index !== seg) { seg = snap.segment.index; prev.clear(); }
                const all = nodes(snap.tree);
                for (const n of nodes(snap.tree)) {
                    for (const c of n.children) {
                        expect(c.key.startsWith(`${n.key}/`)).toBe(true);
                        expect(c.key.slice(n.key.length + 1)).not.toContain('/');
                    }
                    const was = roleOf.get(n.key);
                    if (was) expect([n.role, n.label]).toEqual(was);
                    roleOf.set(n.key, [n.role, n.label]);
                    const p = prev.get(n.key);
                    if (p) {
                        expect(n.attempts).toBeGreaterThanOrEqual(p.attempts);
                        expect(n.successes).toBeGreaterThanOrEqual(p.successes);
                        for (const [k, v] of Object.entries(p.rejections)) {
                            expect(n.rejections[k]).toBeGreaterThanOrEqual(v);
                        }
                    }
                }
                for (const key of prev.keys()) expect(all.some((n) => n.key === key)).toBe(true);
                for (const n of all) prev.set(n.key, n);
                expect(['segment', 'goal', 'walk', 'verb', 'climb', 'rung', 'arm', 'search'])
                    .toEqual(expect.arrayContaining(all.map((n) => n.role)));
            }
            const last = stream.at(-1).snap;
            expect(last.segment.outcome).toBe('solved');
            expect(nodes(last.tree).every((n) => !n.active)).toBe(true);
        }, 300_000);

        it(`⛓⛓ ${s.what}: a tile's count never falls and its firstTick never rises`, async () => {
            const stream = await streamOf(s);
            const cells = new Map();
            let checked = 0;
            for (const { snap } of stream) {
                if (snap.tiles === null) continue;
                expect(snap.tiles.tile).toBe(PROGRESS_TILE);
                expect(Number.isInteger(snap.tiles.cols) && Number.isInteger(snap.tiles.rows)).toBe(true);
                for (const [col, row, reached, firstTick] of snap.tiles.cells) {
                    const k = `${snap.segment.index}:${snap.tiles.level}:${col},${row}`;
                    const was = cells.get(k);
                    if (was) {
                        expect(reached).toBeGreaterThanOrEqual(was[0]);
                        expect(firstTick).toBeLessThanOrEqual(was[1]);
                        checked += 1;
                    }
                    cells.set(k, [reached, firstTick]);
                }
            }
            expect(checked).toBeGreaterThan(0);
        }, 300_000);
    }

    it('⛓⛓ the ladder\'s rows: L6 climbs AVOID → PULL → TIME → BAIT, and each rejection key is the solver\'s own words', async () => {
        const s = SOLVES[1];
        const stream = await streamOf(s);
        const last = stream.at(-1).snap;
        const climb = nodes(last.tree).find((n) => n.role === 'climb');
        expect(climb.children.map((c) => c.label)).toEqual(['avoid', 'pull', 'time', 'bait']);
        const off = await solve(s);
        const whys = off.value.out.trace.rows.flatMap((r) => (r.rejected ?? []).map((x) => x.why));
        for (const rung of climb.children) {
            for (const key of Object.keys(rung.rejections)) {
                const re = new RegExp(key.replace(/…$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    .replace(/#/g, '-?\\d+(?:\\.\\d+)?'));
                expect(whys.some((w) => re.test(w))).toBe(true);
            }
        }
        expect(climb.children.find((c) => c.label === 'bait').successes).toBe(1);
    }, 300_000);

    it('⛓⛓ the hammer room: the press arm\'s escape searches are leaves with their bounds, and the map holds both units', async () => {
        const stream = await streamOf(SOLVES[0]);
        const last = stream.at(-1).snap;
        expect(last.segment.index).toBe(2);
        const press = nodes(last.tree).find((n) => n.key.endsWith('/verb:kill/arm:press'));
        expect(press.successes).toBe(1);
        const esc = press.children.find((c) => c.label === 'escape-free');
        expect(esc.attempts).toBeGreaterThan(esc.successes);
        expect(Object.keys(esc.rejections)).toEqual(['exhausted']);
        expect(last.budget.work.searchStates).toBeGreaterThan(0);
        expect(last.budget.work.previewStates).toBeGreaterThan(0);
        expect(last.budget.work.ticks).toBe(445);
    }, 300_000);
});

describe('hammer-phase D1 — a snapshot is a copy', () => {
    it('⛓⛓ it survives structuredClone, and mutating it leaves the next snapshot unchanged', async () => {
        // ⛔ the hook's own throws are swallowed by design (a listener's bug is not the solve's), so the hook only
        // RECORDS what it saw and the assertions run after the solve
        const seen = [];
        const hook = (site, peek) => {
            const a = peek();
            if (a === null) return;
            const keep = JSON.stringify(a);
            const cloned = JSON.stringify(structuredClone(a)) === keep;
            a.tree.attempts = -1;
            a.tree.rejections.mutated = 99;
            a.tree.children.push({ key: 'x' });
            if (a.tree.children[0]) a.tree.children[0].label = 'mutated';
            a.budget.work.ticks = -5;
            a.budget.asks.mutated = 1;
            a.segment.name = 'mutated';
            if (a.tiles) { a.tiles.cells.push([0, 0, 0, 0]); if (a.tiles.cells[0]) a.tiles.cells[0][2] = -7; }
            seen.push({ cloned, unchanged: JSON.stringify(peek()) === keep });
        };
        await solve(SOLVES[1], { hook });
        expect(seen.length).toBeGreaterThan(10);
        expect(seen.filter((x) => !x.cloned)).toEqual([]);
        expect(seen.filter((x) => !x.unchanged)).toEqual([]);
    }, 300_000);
});

describe('hammer-phase D1 — progressReason: the solver\'s own words', () => {
    it('⛓ a code, a bound, a named code, then the deciding clause with numbers masked', () => {
        expect(progressReason({ code: 'HAMMER_SAFETY', message: 'x' })).toBe('HAMMER_SAFETY');
        expect(progressReason({ ok: false, bound: 'exhausted', why: 'no state …' })).toBe('exhausted');
        expect(progressReason('solverBot(t) reach-exit (1,2)->L3: STANCE_REENTRY — the walk to …'))
            .toBe('STANCE_REENTRY');
        expect(progressReason('bob@1,2: a walk … (LIGHT_REENTRY).')).toBe('LIGHT_REENTRY');
        expect(progressReason(new Error('solverBot(t) reach-exit (96,128)->L11 -> break: breakablerock@96,112 '
            + 'cannot be broken by this run — the run\'s `primary` slot holds NOTHING')))
            .toBe('breakablerock@#,# cannot be broken by this run');
        expect(progressReason('the danger-forbidden corridor STILL probes dangerous at (12.5,3.0) — x'))
            .toBe('the danger-forbidden corridor STILL probes dangerous at');
        expect(progressReason('a'.repeat(200))).toHaveLength(96);
        expect(progressReason(null)).toBe('unknown');
    });
});
