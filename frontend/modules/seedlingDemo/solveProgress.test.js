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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { SPINNER } from './spinner.js';
import { DEADLINE_SITES, solveSegment, withSolveDeadline, withSolveProgress as reExported } from './solverBot.js';
import {
    BOUND_KINDS, CLEAR_TAG_KINDS, PROGRESS_POINTS, PROGRESS_TILE, REFUSAL_KINDS, SOLVE_PROGRESS_VERSION, activeProgress,
    dangerKindOf, frameEntered, installSolveProgress, kindEntered, progressErrorName, progressKind, progressReason,
    progressWhy, withSolveProgress,
} from './solveProgress.js';
import { isWalkableTile } from './botDriverV2.js';
import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';
import { arrivalStaging } from './fidelityArrival.js';

const SOURCE = atlasLevelSource();
const HERE = dirname(fileURLToPath(import.meta.url));

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

/**
 * ── HAMMER-PHASE RK — REFUSAL KINDS AND THE LAST `why` (`v: 2`) ─────────
 *
 * The W0 values below were measured at `3f5c3ff0fd` with the v1 emitter (the report:
 * `CC/docs/cloud-reports/seedling-hammer-refusal-kinds.md`): L18's and L40's `shouldStop` totals and each segment's
 * asks under a deadline that never trips (fine checkpoints on), and the md5 of every segment's final snapshot (peeked
 * at `done`) with `v` dropped — at v2 also `lastWhy` and every node's `rejectionKinds`. Equal ⇒ v1's fields are the
 * same bytes at v2.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   k1 the kind is read off the CUT key (`progressKind(progressReason(err))` in `progressLeave`) -> the committed-solves
 *        row red (L18's `levelRun` key is `other`), and the deadline-clause row
 *   k2 `lastWhy` kept as a growing list (`seg.lastWhy = [...(seg.lastWhy ?? []), {…}]`) -> the lastWhy rows red
 *   k3 a kind lookup that calls `shouldStop` (`rowFor`: `activeDeadline?.shouldStop('walk')` before `progressRow`)
 *        -> the L40 byte-identity row red (`shouldStop` 167 -> 171)
 *   k4 a kind lookup unhooked (`rowFor`: `progressKind(refused)` outside the null check) -> the L40 row red
 *        (`kindEntered()` moves with no hook) and the source row
 */
const RK_SOLVES = [
    { what: 'L18 hammer room (residue 21)', tape: 'r9-solve-18', residue: 21, deadline: true,
        goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }], ticks: 445, shouldStop: 165,
        asks: [{ 'walk': 13, 'hammer-escape': 37 }, { 'walk': 14, 'hammer-escape': 37 },
            { 'walk': 18, 'hammer-escape': 37, 'sword-dash': 9 }],
        v1: '84b55e41f71e00298238dbd053ba464e', kinds: { pending: 10, exhausted: 3 } },
    { what: 'L40 kill rung (the totem part at (160,640))', tape: 'r5-l40-part5', deadline: true,
        goals: [{ kind: 'collect-placement', placement: { x: 160, y: 640 } }], ticks: 679, shouldStop: 167,
        asks: [{ 'walk': 61, 'kill-chaser': 97, 'sword-dash': 9 }],
        v1: '642785a181d63fba342dea4906adc76a', kinds: { danger: 1, bound: 1, exhausted: 1 } },
    { what: 'L6 ladder climb', tape: 'r8-solve-6', deadline: false, goals: SOLVES[1].goals, ticks: 294,
        v1: 'c2d3c373186a656b56bead7fe1a9530b', kinds: { exhausted: 1, bound: 1 } },
    { what: 'L3 plain walk', tape: 'r8-solve-3', deadline: false, goals: SOLVES[2].goals, ticks: 245,
        v1: 'd87fd4b1e894b5a6662eb329ce035610', kinds: {} },
];

/** One `twoPassSolve` of `s` (under a deadline that never trips when `s.deadline`), `hook` or none, its finals. */
async function solveRk(s, hook = null) {
    const staging = stagingOf(s.tape, s.residue ?? null);
    let shouldStops = 0;
    const go = () => twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
        goals: s.goals, name: s.tape, boot: staging.boot, persistence: staging.persistence,
        gameTick: () => { throw new Error('no game oracle here'); } });
    const deadlined = () => (s.deadline
        ? withSolveDeadline({ shouldStop: () => { shouldStops += 1; return false; }, fineCheckpoints: true }, go) : go());
    let settled = null;
    const p = hook === null ? deadlined() : withSolveProgress(hook, deadlined);
    await p.then((value) => { settled = { ok: true, value }; }, (error) => { settled = { ok: false, error }; });
    return { ...settled, shouldStops };
}

/** A hook that keeps every segment's final snapshot (peeked at `done`) and, with `all`, every snapshot. */
function finalsHook(all = false) {
    const finals = [];
    const stream = [];
    const hook = (site, peek) => {
        if (all) { const x = peek(); if (x !== null) stream.push(x); }
        if (site === 'done') finals.push(peek());
    };
    return { hook, finals, stream };
}

const nodesOf = (n, out = []) => { out.push(n); for (const c of n.children) nodesOf(c, out); return out; };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
/** v1's bytes of a v2 snapshot: no `v`, no `lastWhy`, no `rejectionKinds` (⛓ TC2: and no `frame`). */
const v1Of = (snap) => {
    const strip = (n) => { const { rejectionKinds, children, ...rest } = n; return { ...rest, children: children.map(strip) }; };
    const { v, lastWhy, frame, tree, ...rest } = snap;
    return { ...rest, tree: strip(tree) };
};
/**
 * `lastWhy` is null or ONE plain object `{why, kind, key, name}` (⛓ RK2: `name` ADDED after RK's three, which keep
 * their names and order — js-7's condition), and its key is a node of the tree it rides with.
 */
function expectLastWhy(snap) {
    const lw = snap.lastWhy;
    if (lw === null) return;
    expect(Array.isArray(lw)).toBe(false);
    expect(Object.keys(lw)).toEqual(['why', 'kind', 'key', 'name']);
    expect(lw.name === null || (typeof lw.name === 'string' && lw.name.length > 0)).toBe(true);
    expect(typeof lw.why).toBe('string');
    expect(REFUSAL_KINDS).toContain(lw.kind);
    expect(nodesOf(snap.tree).some((n) => n.key === lw.key)).toBe(true);
}

describe('hammer-phase RK — refusal kinds and the last why (v: 2)', () => {
    const runs = new Map();
    const runOf = async (s) => {
        if (!runs.has(s.tape)) {
            const entered = kindEntered();
            const off = await solveRk(s);
            const enteredOff = kindEntered() - entered;
            const f = finalsHook();
            const on = await solveRk(s, f.hook);
            runs.set(s.tape, { off, on, finals: f.finals, enteredOff });
        }
        return runs.get(s.tape);
    };

    for (const s of RK_SOLVES.slice(0, 2)) {
        it(`⛓⛓⛓ ${s.what}: the answer, the shouldStop total and the asks are W0's, hooked and unhooked; unhooked, no kind is looked up`, async () => {
            const { off, on, finals, enteredOff } = await runOf(s);
            expect(enteredOff).toBe(0);
            expect(off.ok && on.ok).toBe(true);
            expect(off.value.out.perTick.length).toBe(s.ticks);
            expect(digest(on)).toBe(digest(off));
            expect([off.shouldStops, on.shouldStops]).toEqual([s.shouldStop, s.shouldStop]);
            expect(finals.map((x) => x.budget.asks)).toEqual(s.asks);
            expect(sum(Object.assign({}, ...finals.map((x, i) => ({ [i]: sum(x.budget.asks) }))))).toBe(s.shouldStop);
            expect(activeProgress).toBe(null);
        }, 600_000);
    }

    for (const s of RK_SOLVES) {
        it(`⛓⛓⛓ ${s.what}: v1's fields are W0's bytes; every rejection has ONE kind, none of them \`other\``, async () => {
            const { finals } = await runOf(s);
            expect(finals.every((x) => x.v === 2 && SOLVE_PROGRESS_VERSION === 2)).toBe(true);
            expect(md5(JSON.stringify(finals.map(v1Of)))).toBe(s.v1);
            const kinds = {};
            for (const snap of finals) {
                expectLastWhy(snap);
                for (const n of nodesOf(snap.tree)) {
                    expect(Object.keys(n.rejectionKinds).every((k) => REFUSAL_KINDS.includes(k))).toBe(true);
                    expect(sum(n.rejectionKinds)).toBe(sum(n.rejections));
                    for (const [k, v] of Object.entries(n.rejectionKinds)) kinds[k] = (kinds[k] ?? 0) + v;
                }
            }
            expect(kinds.other ?? 0).toBe(0);
            expect(kinds).toEqual(s.kinds);
        }, 600_000);
    }

    it('⛓⛓ non-vacuous: the committed solves reject at least K = 15 times, in at least four kinds', async () => {
        const kinds = {};
        for (const s of RK_SOLVES) {
            for (const snap of (await runOf(s)).finals) {
                for (const n of nodesOf(snap.tree)) {
                    for (const [k, v] of Object.entries(n.rejectionKinds)) kinds[k] = (kinds[k] ?? 0) + v;
                }
            }
        }
        expect(sum(kinds)).toBeGreaterThanOrEqual(15);
        expect(Object.keys(kinds).length).toBeGreaterThanOrEqual(4);
    }, 600_000);

    it('⛓⛓⛓ lastWhy is the thrown why VERBATIM: L18\'s first pass refuses, and its last why is the error\'s message', () => {
        // ⛓ twoPassSolve's first pass, alone: the undeclared kill lock's `levelRun` throw, from under the press arm
        const s = RK_SOLVES[0];
        const staging = stagingOf(s.tape, s.residue);
        const f = finalsHook(true);
        let err = null;
        try {
            solveSegment({ run: createRunForStaging(staging, SOURCE), goals: s.goals, name: s.tape, boot: staging.boot,
                onProgress: f.hook });
        } catch (e) { err = e; }
        expect(err).not.toBe(null);
        const last = f.finals.at(-1);
        expect(last.segment.outcome).toBe('threw');
        expect(last.lastWhy.why).toBe(err.message);
        expect(last.lastWhy.why).toBe(progressWhy(err));
        expect(last.lastWhy.kind).toBe('pending');
        expect(last.lastWhy.key).toBe('segment/goal#0/walk/verb:kill/arm:press');
        // ⛓ RK2: the thrown CLASS, off the error object — `levelRun`'s plain `Error`, not the sentence's first word
        expect(last.lastWhy.name).toBe(err.name);
        expect(last.lastWhy.name).toBe('Error');
        expect(err.message.startsWith('levelRun')).toBe(true);
        // ⛓ the cut key is not the verbatim why: it is the sentence's first word, and it has no kind of its own
        expect(progressReason(err)).toBe('levelRun');
        expect(progressKind(progressReason(err))).toBe('other');
        for (const snap of f.stream) expectLastWhy(snap);
        expect(f.stream.filter((x) => x.lastWhy !== null).length).toBeGreaterThan(0);
    }, 300_000);

    it('⛓⛓ a REAL sealDoorApproach-ON refusal: the 0-seal L113 door throws clear-tag `unresolved`, and its kind is `precondition`', () => {
        // ⛓ fidelity-9's residue row (the harvest): the same call as fidelityClearTag's {113,0} row — a 0-seal,
        // unspoken-Watcher arrival; with the switch ON the `approach` verb resolves and refuses by name
        // ⛓ RK2 RE-PIN (`exhausted` → `precondition`): the refusal is a STATE GATE (0 of 16 seals, {114,0} SET), not a
        // search that ran out. `unresolved` is the resolver's generic outcome, so the kind is read on the approach
        // resolver's own STABLE lead-in inside it — "the door cannot open in this state:" (fidelity-9) — never on the
        // predicate clauses after it, which may grow.
        const boot = { level: 113, x: 72, y: 128 };
        const goal = { kind: 'clear-tag', tag: { level: 113, tag: 0 }, at: { x: 112, y: 0 }, obstacle: 'finaldoor@112,0' };
        const f = finalsHook(true);
        let err = null;
        withContactFidelity({ sealDoorApproach: true }, () => {
            try {
                solveSegment({ run: createRunForStaging(arrivalStaging(boot), SOURCE), goals: [goal],
                    name: 'rk-seal-113', boot, onProgress: f.hook });
            } catch (e) { err = e; }
        });
        expect(err?.name).toBe('SolverRefusal');
        expect(err.obstacle).toMatchObject({ kind: 'clear-tag', reason: 'unresolved' });
        const last = f.finals.at(-1);
        expect(last.segment.outcome).toBe('refused');
        expect(last.lastWhy.why).toBe(err.message);
        expect(err.message).toContain('the door cannot open in this state:');
        expect(last.lastWhy.kind).toBe('precondition');
        expect(progressKind(err)).toBe('precondition');
        expect(last.lastWhy.name).toBe('SolverRefusal');
        for (const snap of f.stream) expectLastWhy(snap);
        const kinds = nodesOf(last.tree).flatMap((n) => Object.keys(n.rejectionKinds));
        expect(kinds.length).toBeGreaterThan(0);
        expect(kinds).not.toContain('other');
    }, 300_000);

    it('⛓⛓ RK2 lastWhy.name on the committed solves: each segment\'s thrown class, null for a row or a search leaf', async () => {
        const names = {};
        for (const s of RK_SOLVES) {
            names[s.tape] = (await runOf(s)).finals.map((x) => (x.lastWhy === null ? 'no rejection' : x.lastWhy.name));
        }
        // L18: `levelRun`'s plain Error (the undeclared kill lock), the PendingDeclaration, then the escape search's
        // leaf; L40 and L6 end on a refused rung's row; L3 rejects nothing
        expect(names).toEqual({ 'r9-solve-18': ['Error', 'PendingDeclaration', null], 'r5-l40-part5': [null],
            'r8-solve-6': [null], 'r8-solve-3': ['no rejection'] });
    }, 600_000);

    it('⛓⛓ lastWhy is a refused rung\'s why verbatim: L40\'s and L6\'s last rejections are rows of their own traces', async () => {
        for (const s of [RK_SOLVES[1], RK_SOLVES[2]]) {
            const { on, finals } = await runOf(s);
            const whys = on.value.out.trace.rows.flatMap((r) => (r.rejected ?? []).map((x) => x.why));
            const last = finals.at(-1).lastWhy;
            expect(last).not.toBe(null);
            expect(whys).toContain(last.why);
            expect(last.name).toBe(null);   // ⛓ RK2: a rung row is not an error
            expect(last.key.endsWith(`/rung:${on.value.out.trace.rows.flatMap((r) => r.rejected ?? [])
                .find((x) => x.why === last.why).option}`)).toBe(true);
        }
    }, 600_000);
});

describe('hammer-phase RK — progressKind: the solver\'s own words, read on the verbatim why', () => {
    it('⛓⛓ a deadline clause at the END is read (the cut key would drop it)', () => {
        const why = 'solverBot(t) reach-exit (1,2)->L3: no stance within bob@1,2\'s leash (80) — 0 cell(s). '
            + ' ⏱ DEADLINE: the caller\'s `shouldStop` tripped (first at `walk`) and refused 1 `walk` scan(s) — this '
            + 'refusal may be the deadline\'s, not the room\'s.';
        const err = Object.assign(new Error(why), { name: 'SolverRefusal' });
        expect(progressKind(err)).toBe('deadline');
        expect(progressKind(progressReason(err))).not.toBe('deadline');
        expect(progressKind(why.slice(0, why.indexOf(' ⏱')))).toBe('exhausted');
    });

    it('⛓ fields first: a search\'s bound, a pending declaration, a code, an obstacle, a clear-tag reason', () => {
        expect(progressKind({ ok: false, bound: 'deadline', why: 'no stance' })).toBe('deadline');
        expect(progressKind({ ok: false, bound: 'exhausted', why: 'x' })).toBe('exhausted');
        expect(progressKind({ ok: false, bound: 'expansions' })).toBe('bound');
        expect(progressKind(Object.assign(new Error('levelRun: x'), { undeclaredKillLock: {} }))).toBe('pending');
        expect(progressKind(Object.assign(new Error('x'), { name: 'PendingDeclaration' }))).toBe('pending');
        expect(progressKind(Object.assign(new Error('x'), { code: 'HAMMER_SAFETY' }))).toBe('danger');
        expect(progressKind(Object.assign(new Error('x'), { code: 'STRIKE_BOUND_EXHAUSTED' }))).toBe('bound');
        expect(progressKind(Object.assign(new Error('x'), { name: 'SolverRefusal', obstacle: { kind: 'danger' } })))
            .toBe('danger');
        expect(progressKind(new TypeError('x is undefined'))).toBe('error');
        expect(progressKind(Object.assign(new Error('x'), { name: 'SolverRefusal' }))).toBe('other');
        expect(progressKind(null)).toBe('other');
        expect(progressWhy({ ok: false, bound: 'exhausted' })).toBe('exhausted');
        expect(progressWhy({ rung: 'time', why: 'the aim is 64 px away' })).toBe('the aim is 64 px away');
    });

    it('⛓⛓ closed over the source: every search bound and every clear-tag reason the solver writes has its kind', () => {
        const src = (f) => readFileSync(join(HERE, f), 'utf8');
        const bounds = new Set();
        for (const f of ['solverBot.js', 'spaceTimeReach.js']) {
            for (const re of [/\bbound: '([a-z-]+)'/g, /\bno\((?:true|false), '([a-z-]+)'/g, /\bnegative\('([a-z-]+)'/g]) {
                for (const m of src(f).matchAll(re)) bounds.add(m[1]);
            }
        }
        expect(bounds.size).toBeGreaterThanOrEqual(10);
        for (const b of bounds) expect([b, Object.hasOwn(BOUND_KINDS, b)]).toEqual([b, true]);
        const reasons = new Set([...src('solverBot.js').matchAll(/\brefuseCT\('([a-z-]+)'/g)].map((m) => m[1]));
        expect(reasons.size).toBeGreaterThanOrEqual(5);
        for (const r of reasons) expect([r, Object.hasOwn(CLEAR_TAG_KINDS, r)]).toEqual([r, true]);
        for (const k of [...Object.values(BOUND_KINDS), ...Object.values(CLEAR_TAG_KINDS)]) {
            expect(REFUSAL_KINDS).toContain(k);
        }
        expect(REFUSAL_KINDS.at(-1)).toBe('other');
    });

    it('⛓⛓ the fidelity switches\' rungs classify the same ON and OFF, and none of their refusals is `other`', () => {
        // ⛓ each payload is the shape its site in solverBot.js writes (the sentence's fixed words, the fields)
        const refusal = (message, extra = {}) => Object.assign(new Error(message), { name: 'SolverRefusal', ...extra });
        const door = 'the door cannot open in this state: the run holds 2 of the 3 seal parts. The game plays the '
            + 'SealController\'s ceremony on approach ("Face the Watcher and return") and the door stays shut';
        const CORPUS = [
            // axeTimingRung — the AXE arm's blade-gap rows and the crossing's refusal (`AXETIMING —`)
            ['axeTimingRung', { rung: 'dodge', why: 'no stall of one revolution or less at the doorstep or 7 earlier '
                + 'walk-offset(s) (step 4) clears the corridor of axe:axe@64,32 (12 preview(s)); and on the axe\'s '
                + 'clock at dash speed (AXETIMING, 40 preview(s)): no gap of the chain is wide enough' }, 'exhausted'],
            ['axeTimingRung', { rung: 'dodge', why: 'the AXE arm\'s search stopped at the deadline after 9 preview(s) '
                + '(`axe-dodge`) without a stall that clears axe@64,32' }, 'deadline'],
            ['axeTimingRung', { rung: 'dodge', why: 'this segment has already stalled 4 time(s) for a clocked danger '
                + '(AXE_DODGE_RUNG.maxPerSegment 4) — a walk that keeps meeting one is not converging' }, 'bound'],
            ['axeTimingRung', refusal('solverBot(t) reach-exit (1,2)->L3: AXETIMING — the crossing of axe@64,32 '
                + 'certified clean (stall 3 at sample 5, the dash chain 2 t after the resume) was HIT on the run at t40 '
                + 'by axe@64,32 — the run bills what the certificate priced clean, so it is not walked on (driven '
                + 't30..t41).', { obstacle: { kind: 'danger', id: 'axe@64,32' } }), 'danger'],
            // arrowLaneCrossing — the ARMED lane's refusal (`ARROWLANE —`)
            ['arrowLaneCrossing', refusal('solverBot(t) reach-exit (1,2)->L3: ARROWLANE — the corridor crosses an '
                + 'ARMED lane (separated: arrowtrap@16,32; arrows are not dodged, they are billed) and the crossing is '
                + 'not admitted: the crossing takes 3 arrow hit(s), over the budget\'s 1',
            { obstacle: { kind: 'danger', id: 'arrowtrap@16,32' } }), 'danger'],
            // sealDoorApproach — the door's predicate sentence, its stance, its wait, and the clear-tag order's refusals
            // ⛓ RK2: the door's predicate sentence and the `unresolved` that wraps it are STATE GATES — `precondition`
            ['sealDoorApproach', refusal(`solverBot: approach finaldoor@96,16 in level 113 — ${door}.`,
                { obstacle: { kind: 'solid', id: 'finaldoor@96,16', tag: 'finaldoor' } }), 'precondition'],
            ['sealDoorApproach', refusal('solverBot: no stance to approach finaldoor@96,16 from in level 113 — 4 '
                + 'walkable cell(s) lie 40..64 px from it and none plans a corridor from (16,16).',
            { obstacle: { kind: 'solid', id: 'finaldoor@96,16' } }), 'exhausted'],
            ['sealDoorApproach', refusal('x: held toward finaldoor@96,16 for 120 tick(s) and it never played "open" '
                + '(closest 30.00 px; the circle is 36; ceremonies 1).'), 'diverged'],
            ['sealDoorApproach', refusal('x: finaldoor@96,16 was still standing 90 tick(s) after "open" played.'),
                'diverged'],
            ['sealDoorApproach', refusal(`solverBot(t) clear-tag {113,0} finaldoor@96,16: 'approach' could not be `
                + `resolved from (16,16): ${door}`, { obstacle: { kind: 'clear-tag', reason: 'unresolved' } }),
            'precondition'],
            ['sealDoorApproach', refusal('x: \'approach\' is SELECTED and REGISTERED for solid:finaldoor, and the '
                + 'resolver could not bind this obstacle against live state',
            { obstacle: { kind: 'clear-tag', reason: 'unresolved' } }), 'exhausted'],
            ['sealDoorApproach', refusal('x: solid:finaldoor selects \'approach\', which is NOT REGISTERED — no '
                + 'executor clears this flag yet', { obstacle: { kind: 'clear-tag', reason: 'no-verb' } }), 'unmodelled'],
        ];
        for (const sw of ['axeTimingRung', 'arrowLaneCrossing', 'sealDoorApproach']) {
            expect(Object.hasOwn(CONTACT_FIDELITY, sw)).toBe(true);
            const rows = CORPUS.filter((c) => c[0] === sw);
            expect(rows.length).toBeGreaterThan(0);
            const on = withContactFidelity({ [sw]: true }, () => rows.map((c) => progressKind(c[1])));
            const off = withContactFidelity({ [sw]: false }, () => rows.map((c) => progressKind(c[1])));
            expect([sw, on]).toEqual([sw, off]);
            expect([sw, on]).toEqual([sw, rows.map((c) => c[2])]);
            expect(on).not.toContain('other');
        }
    });

    it('⛓⛓ only an install reaches a kind: solverBot never calls the lookup, and the lookup reads no deadline', () => {
        const bot = readFileSync(join(HERE, 'solverBot.js'), 'utf8');
        expect(bot).not.toMatch(/\bprogress(?:Kind|Why|ErrorName)\(|\bkindEntered\b/);
        const own = readFileSync(join(HERE, 'solveProgress.js'), 'utf8');
        const body = own.slice(own.indexOf('export function progressKind('), own.indexOf('function noteLast('));
        expect(body.length).toBeGreaterThan(200);
        expect(body).not.toMatch(/shouldStop\(|activeDeadline|performance|Date\./);
    });
});

/**
 * ⛓ HAMMER-PHASE RK2 — the follow-ups: the `precondition` kind (a STATE GATE), `lastWhy.name`, and the rules that
 * name the static residue's families. Every family row's sentence is READ OUT OF `solverBot.js` (its adjacent
 * string literals joined, as the solver writes it at run time, each `${…}` filled with `7`), so a reworded site turns
 * its row red instead of silently falling to `other`.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   r1 a `precondition` rule on the FIELD alone (`CLEAR_TAG_KINDS.unresolved = 'precondition'`) -> the
 *        non-gate-`unresolved` row red (the resolver's "could not bind" and "no stance to approach" are `exhausted`)
 *   r2 `name` taken from the MESSAGE (`/^[\w$]+/.exec(progressWhy(x))`) -> the L18 first-pass row (`levelRun`, not
 *        `Error`), the seal row (`solverBot`, not `SolverRefusal`) and the committed solves' names row red
 *   r3 a family rule keyed on a RUNG name (`if (o.rung === 'dodge') return 'diverged'`) -> the rung-independence row
 *        red, and the source row (the lookup reads `.rung`)
 */
describe('hammer-phase RK2 — precondition, the error\'s name, and the residue\'s families', () => {
    const SRC = readFileSync(join(HERE, 'solverBot.js'), 'utf8');
    /** The solver's source with its adjacent string literals joined and its whitespace collapsed. */
    const JOINED = SRC.replace(/(['"`])\s*\+\s*(['"`])/g, '').replace(/\s+/g, ' ');
    /**
     * The sentence from `start` to `end` (inclusive) as `solverBot.js` writes it, each `${…}` filled with `7`. `start`
     * and `end` are SOURCE text (a raw `${…}` in them pins the site when its words recur elsewhere).
     */
    function fromSource(start, end = start) {
        const i = JOINED.indexOf(start);
        expect([start, i >= 0]).toEqual([start, true]);
        const j = JOINED.indexOf(end, i);
        expect([end, j >= i]).toEqual([end, true]);
        let s = JOINED.slice(i, j + end.length);
        for (let k = s.indexOf('${'); k >= 0; k = s.indexOf('${')) {
            let depth = 0;
            let e = k + 1;
            for (; e < s.length; e += 1) {
                if (s[e] === '{') depth += 1;
                if (s[e] === '}' && --depth === 0) break;
            }
            s = `${s.slice(0, k)}7${s.slice(e + 1)}`;
        }
        return s.replace(/\\(['`])/g, '$1');
    }
    const refusal = (message, extra = {}) => Object.assign(new Error(message), { name: 'SolverRefusal', ...extra });
    const botError = (message) => Object.assign(new Error(message), { name: 'SolverBotError', code: null });

    /** [kind, the family, start, end, the payload's maker] — one real sentence per family, from its site. */
    const FAMILIES = [
        // precondition — a STATE GATE: the run or the world is not in the state the action needs
        ['precondition', 'the seal door (fidelity-9\'s stable lead-in)', 'the door cannot open in this state:', 'not this room.', refusal],
        ['precondition', 'the Witch reads the WAND', 'the Witch adds the dark sword only for a player holding the WAND', 'with nothing added.', refusal],
        ['precondition', 'the bag lacks a slot', 'the inventory has no Wand slot.', undefined, refusal],
        ['precondition', 'a key the run does not hold (a contract `fail`)', 'needs a key this run does not hold.', 'no mechanism behind it.', botError],
        ['precondition', 'the run cannot act on it', 'cannot be broken by this run', undefined, refusal],
        ['precondition', 'an opener not yet discharged', 's stance needs ${p.id} discharged first', 'the stance is unreachable.', refusal],
        ['precondition', 'a crusher still charging', 'a crusher in this room is CHARGING', 'is not one.', refusal],
        ['precondition', 'the teleporter: a box inside a solid', 'inside-solid — the run stands LATCHED on', 'until that solid is gone.', refusal],
        ['precondition', 'the sword is a sub-order', 'but this run holds no sword', 'refuses every press.', refusal],
        // diverged — an executor's outcome the run did not reach
        ['diverged', 'the encounter ran out its ticks', 'the encounter has run', 'without the drop.', refusal],
        ['diverged', 'the Witch\'s dialogue', 'the Witch\'s dialogue closed', 'and added nothing.', refusal],
        ['diverged', 'the freeze', 'still frozen after', 'ticks.', refusal],
        ['diverged', 'the walk rests elsewhere', 'the walk came to rest at', 'not a tree one.', refusal],
        ['diverged', 'the spear press\'s block', 'after the thrust the block is', 'requires.', refusal],
        ['diverged', 'the exit trigger', '${what}: reached the exit aim without a transition', 'certified corridor.', refusal],
        ['diverged', 'the static sword\'s settle', 'the player does not settle at', 'ticks', refusal],
        // unmodelled — what the model does not compute
        ['unmodelled', 'the crusher ordering search', 'the ordering search found ${found.ordering.length}', 'in-solver search.', refusal],
        ['unmodelled', 'a body this run does not step', 'the count waits on', 'does not step it', refusal],
        ['unmodelled', 'the kill-lock ledger', 'every counted body is gone and the run\'s own kill-lock ledger', 'nothing computed the consequence', refusal],
        ['unmodelled', 'the spear\'s repeats', 'could walk into the thrust\'s rect', 'SPEAR_HIT_TICKS_UNMODELLED', refusal],
        ['unmodelled', 'a strategy not registered', 'is selected and NOT registered this slice.', undefined, refusal],
        // exhausted — a search with nothing left to try
        ['exhausted', 'the ceiling\'s wait cell', 'NO reachable cell within four tiles', 'it is waiting to drain.', refusal],
        ['exhausted', 'an arm that removed all it could', 'the ceiling removed every body it could', 'never arms.', refusal],
        ['exhausted', 'the teleporter: closed', '${whatExit}: closed — the run stands LATCHED on', 'step off it and back on.', refusal],
        ['exhausted', 'the teleporter: hazard-floor', 'hazard-floor — every way off', 'can be walked to.', refusal],
        ['exhausted', 'a light arm re-entered', 'the walk to its light stance re-entered', '(LIGHT_REENTRY).', refusal],
        // bound — a bound the solver names
        ['bound', 'strategies per goal', 'strategies for one goal', 'not making progress.', refusal],
        ['bound', 'the placement\'s guard', 'cleared ${guard} obstacle(s)', 'is STILL inside ${blocker.id}.', refusal],
        ['bound', 'the opener chain\'s depth', 'and redeeming it would be link', 'NESTED_OPENER_DEPTH', refusal],
        // danger, does-not-apply
        ['danger', 'a spit at every wait', 'fires a spit before the kill', 'to face it', refusal],
        ['does-not-apply', 'not a body the run can watch die', 'the danger on this corridor is not a body this run can watch die', 'not of this one.)', refusal],
        // ⚠ the named residue: a soft-lock is neither damage nor a missing state — no kind is honest, so `other`
        ['other', 'the Watcher\'s live Seed (a soft-lock)', 'the dialogue opened with the box at', 'is a soft-lock.', refusal],
    ];

    it('⛓⛓⛓ each family\'s real sentence, read out of solverBot.js, has its kind', () => {
        const got = FAMILIES.map(([, fam, start, end, make]) => [fam, progressKind(make(`x: ${fromSource(start, end)}`))]);
        expect(got).toEqual(FAMILIES.map(([kind, fam]) => [fam, kind]));
        expect(REFUSAL_KINDS).toContain('precondition');
        expect(REFUSAL_KINDS.indexOf('precondition')).toBe(REFUSAL_KINDS.indexOf('does-not-apply') + 1);
        expect(REFUSAL_KINDS.at(-1)).toBe('other');
    });

    it('⛓⛓ the clear-tag reasons: prerequisite and cannot-act are state gates; `unresolved` is one only by a gate\'s own words', () => {
        const ct = (reason, why) => refusal(`solverBot(t) clear-tag {113,0} finaldoor@112,0: ${why}`,
            { obstacle: { kind: 'clear-tag', reason } });
        expect(progressKind(ct('prerequisite', fromSource('stance is reachable only once ${resolved.prerequisite.id}', 'does not chain openers'))))
            .toBe('precondition');
        expect(progressKind(ct('cannot-act', fromSource('cannot act on ${id} with this run\'s bag')))).toBe('precondition');
        // ⛓ r1's catcher: the resolver's GENERIC outcomes stay `exhausted` — they are not state gates
        const generic = fromSource('is SELECTED and REGISTERED for ${key}, and the resolver could not bind', 'against live state');
        expect(progressKind(ct('unresolved', `'approach' ${generic}`))).toBe('exhausted');
        const noStance = fromSource('no stance to approach', 'plans a corridor from');
        expect(progressKind(ct('unresolved', `'approach' could not be resolved from (16,16): solverBot: ${noStance}`)))
            .toBe('exhausted');
        // …and the door's lead-in inside it is a gate, whatever clauses follow it (fidelity-9: they may grow)
        const lead = fromSource('the door cannot open in this state:');
        for (const clause of ['the save holds 0 of 16 seal slot(s)', '{114,0} is SET', 'a Watcher clause not yet written']) {
            expect(progressKind(ct('unresolved', `'approach' could not be resolved from (16,16): ${lead} ${clause}.`)))
                .toBe('precondition');
        }
        // ⚠ the lead-in, not a looser cousin: a door that "cannot open" without "in this state:" is not read as a gate
        expect(progressKind(ct('unresolved', '\'approach\' could not be resolved: the door cannot open'))).toBe('exhausted');
    });

    it('⛓⛓ no rule is keyed on a rung: every family\'s sentence has the same kind under every rung the solver names', () => {
        const rungs = new Set([...SRC.matchAll(/\browFor\('([a-z-]+)'/g), ...SRC.matchAll(/refused = \{ rung: '([a-z-]+)'/g)]
            .map((m) => m[1]));
        expect(rungs.size).toBeGreaterThanOrEqual(6);
        for (const [kind, fam, start, end] of FAMILIES) {
            const why = fromSource(start, end);
            expect([fam, [...rungs].map((rung) => progressKind({ rung, why }))]).toEqual([fam, [...rungs].map(() => kind)]);
        }
        const own = readFileSync(join(HERE, 'solveProgress.js'), 'utf8');
        const body = own.slice(own.indexOf('export function progressKind('), own.indexOf('function noteLast('));
        expect(body).not.toMatch(/\.rung\b|\.option\b/);
    });

    it('⛓⛓ progressErrorName: the error object\'s class, never its words; null for a row or a search', () => {
        expect(progressErrorName(Object.assign(new Error('levelRun: x'), { undeclaredKillLock: {} }))).toBe('Error');
        expect(progressErrorName(refusal('solverBot(t) reach-exit: x'))).toBe('SolverRefusal');
        expect(progressErrorName(Object.assign(new Error('x'), { name: 'PendingDeclaration' }))).toBe('PendingDeclaration');
        expect(progressErrorName(botError('x'))).toBe('SolverBotError');
        expect(progressErrorName(new TypeError('x is undefined'))).toBe('TypeError');
        expect(progressErrorName({ rung: 'time', why: 'the aim is 64 px away' })).toBe(null);
        expect(progressErrorName({ ok: false, bound: 'exhausted', why: 'x' })).toBe(null);
        expect(progressErrorName('a why string')).toBe(null);
        expect(progressErrorName(null)).toBe(null);
        // ⛓ a thrown non-refusal whose words match a rule keeps its kind AND its class (RK's residue 3)
        const planner = new Error('no walkable tile path in level 6 from (16,16)');
        expect([progressKind(planner), progressErrorName(planner)]).toEqual(['exhausted', 'Error']);
        const own = readFileSync(join(HERE, 'solveProgress.js'), 'utf8');
        const body = own.slice(own.indexOf('export function progressErrorName('), own.indexOf('/**', own.indexOf('export function progressErrorName(')));
        expect(body).not.toMatch(/message|progressWhy|\.why\b/);
        expect(SRC).not.toMatch(/\bprogressErrorName\(/);
    });
});

/**
 * ⛓ HAMMER-PHASE TC2 — `frame`, THE ACTIVE FRAME'S DETAIL (additive within `v: 2`): the innermost open frame that has
 * a target, a stance or a blocking danger, with its active node's key — ONE object or null, never a list. Every value
 * is one the solver had already computed: a climb's `hit` (the walk probe's), a rung row's `target` / `stance`, a
 * frontier verb's obstacle and stance, the press arm's strike (its body and cell).
 *
 * W0's pins (`seedling-hammer-active-frame-evidence/w0/v2proj-w0.jsonl`, measured at the base, where no snapshot has
 * a frame): `pre` is the md5 of EVERY snapshot of a peek-at-every-call stream with `frame` dropped — every pre-TC2
 * byte — and `work` is each segment's final `budget.work`.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   f1 `frame` kept as a growing list (`frameOf` returns every open frame's detail) -> the shape row red
 *   f2 a frame field computed by a FRESH probe (the climb's line: `probeCorridor(corridor, dangerExcept)` instead of
 *        the `hit` it was handed) -> the byte-identity row red (`budget.work.previews` moves)
 *   f3 a frame read outside the null check (`progressFrame` made null-safe and one site's guard dropped) -> the
 *        byte-identity row red (`frameEntered()` moves with no hook) and the source row
 */
describe('hammer-phase TC2 — the active frame (`frame`, additive within v: 2)', () => {
    const TC2 = {
        'r9-solve-18': { pre: '815d03a141424a831b3318151c604107', snapshots: 1593, work: [
            { shouldStop: 50, ticks: 408, previews: 401, previewStates: 25884, searchStates: 18362, expansions: 10444,
                waypointsPlanned: 0, replans: 0, dashesPressed: 0 },
            { shouldStop: 51, ticks: 441, previews: 401, previewStates: 25884, searchStates: 18362, expansions: 10444,
                waypointsPlanned: 0, replans: 0, dashesPressed: 0 },
            { shouldStop: 64, ticks: 445, previews: 411, previewStates: 26472, searchStates: 18362, expansions: 10444,
                waypointsPlanned: 1, replans: 0, dashesPressed: 6 }] },
        'r5-l40-part5': { pre: 'ffb863ee0a956e0489b522a266fb28a7', snapshots: 372, work: [
            { shouldStop: 167, ticks: 679, previews: 33, previewStates: 15970, searchStates: 0, expansions: 0,
                waypointsPlanned: 11, replans: 0, dashesPressed: 3 }] },
        'r8-solve-6': { pre: '4225dd84ae1a1fef66fe8030ba00a40a', snapshots: 41, work: [
            { shouldStop: 0, ticks: 294, previews: 5, previewStates: 988, searchStates: 0, expansions: 0,
                waypointsPlanned: 5, replans: 0, dashesPressed: 0 }] },
        'r8-solve-3': { pre: 'b45dd8f1ad52a3a482c0c4c1a12da15d', snapshots: 27, work: [
            { shouldStop: 0, ticks: 245, previews: 1, previewStates: 245, searchStates: 0, expansions: 0,
                waypointsPlanned: 6, replans: 0, dashesPressed: 0 }] },
    };
    /** A hook that peeks at EVERY call: the pre-TC2 bytes' md5, every snapshot's `frame` (with its tree), the finals. */
    function streamOf() {
        const pre = createHash('md5');
        const frames = [];
        const finals = [];
        let snapshots = 0;
        const hook = (site, peek) => {
            const x = peek();
            if (x !== null) {
                snapshots += 1;
                const { frame, ...rest } = x;
                pre.update(JSON.stringify(rest));
                pre.update('\n');
                frames.push({ site, has: Object.hasOwn(x, 'frame'), frame, tree: x.tree, segment: x.segment.index });
            }
            if (site === 'done') finals.push(peek());
        };
        return { hook, frames, finals, digest: () => pre.digest('hex'), count: () => snapshots };
    }
    const runs = new Map();
    const runOf = async (s) => {
        if (!runs.has(s.tape)) {
            const entered = frameEntered();
            const off = await solveRk(s);
            const enteredOff = frameEntered() - entered;
            const st = streamOf();
            const on = await solveRk(s, st.hook);
            runs.set(s.tape, { off, on, st, enteredOff, enteredOn: frameEntered() - entered - enteredOff,
                pre: st.digest() });
        }
        return runs.get(s.tape);
    };
    const tileOf = (p) => [Math.floor(p.x / PROGRESS_TILE), Math.floor(p.y / PROGRESS_TILE)];

    for (const s of RK_SOLVES.slice(0, 2)) {
        it(`⛓⛓⛓ ${s.what}: the answer, shouldStop, the asks and the work are W0's, hooked and unhooked; unhooked, no frame is read`, async () => {
            const { off, on, st, enteredOff, enteredOn } = await runOf(s);
            expect(enteredOff).toBe(0);
            expect(enteredOn).toBeGreaterThan(0);
            expect(off.ok && on.ok).toBe(true);
            expect(digest(on)).toBe(digest(off));
            expect([off.shouldStops, on.shouldStops]).toEqual([s.shouldStop, s.shouldStop]);
            expect(st.finals.map((x) => x.budget.asks)).toEqual(s.asks);
            expect(st.finals.map((x) => x.budget.work)).toEqual(TC2[s.tape].work);
            expect(activeProgress).toBe(null);
        }, 600_000);
    }

    for (const s of RK_SOLVES) {
        it(`⛓⛓⛓ ${s.what}: every pre-TC2 byte of every snapshot is W0's; \`frame\` is null or ONE object of the declared shape`, async () => {
            const { st, pre } = await runOf(s);
            expect([st.count(), pre]).toEqual([TC2[s.tape].snapshots, TC2[s.tape].pre]);
            expect(st.finals.map((x) => x.budget.work)).toEqual(TC2[s.tape].work);
            for (const { has, frame, tree } of st.frames) {
                expect(has).toBe(true);
                if (frame === null) continue;
                expect(Array.isArray(frame)).toBe(false);
                expect(Object.keys(frame)).toEqual(['key', 'target', 'stance', 'danger']);
                const node = nodesOf(tree).find((n) => n.key === frame.key);
                expect([frame.key, node?.active]).toEqual([frame.key, true]);
                expect(frame.target === null || (typeof frame.target === 'string' && frame.target.length < 80)).toBe(true);
                for (const cell of [frame.stance, frame.danger?.at ?? null]) {
                    if (cell === null) continue;
                    expect(cell.length).toBe(2);
                    expect(cell.every(Number.isInteger)).toBe(true);
                }
                if (frame.danger !== null) {
                    expect(Object.keys(frame.danger)).toEqual(['source', 'tick', 'kind', 'at']);
                    expect(['forecast', 'volume', 'phase']).toContain(frame.danger.kind);
                    expect(typeof frame.danger.source).toBe('string');
                    expect(Number.isInteger(frame.danger.tick)).toBe(true);
                }
            }
            // a closed segment has no open frame
            expect(st.finals.every((x) => x.frame === null)).toBe(true);
        }, 600_000);
    }

    it('⛓⛓⛓ L40\'s kill rung: the frame\'s body is a body of the room, its stance a walkable cell, its danger the trace\'s', async () => {
        const s = RK_SOLVES[1];
        const { on, st } = await runOf(s);
        const kill = st.frames.filter((x) => x.frame?.key.endsWith('/climb/rung:kill/arm:chaser'));
        expect(kill.length).toBeGreaterThan(0);
        const row = on.value.out.trace.rows.find((r) => r.strategy?.rung === 'kill' && r.strategy.arm === 'chaser');
        const run = createRunForStaging(stagingOf(s.tape), SOURCE);
        const room = new Set((run.world.combat?.enemies ?? []).map((e) => `${e.tag}@${e.x},${e.y}`));
        for (const { frame } of kill) {
            expect(room.has(frame.target)).toBe(true);
            expect(frame.target).toBe(row.strategy.target);
            expect(frame.stance).toEqual(tileOf(row.strategy.stance));
            expect(isWalkableTile(run.world, frame.stance[0], frame.stance[1], null, { lattice: PROGRESS_TILE })).toBe(true);
            expect(frame.danger.source).toBe(row.obstacle.id);
            expect(frame.danger.kind).toBe('forecast');
        }
        // the rungs below it carry the climb's danger and no body of their own
        const below = st.frames.filter((x) => /\/climb\/rung:(?:avoid|pull|time|bait)$/.test(x.frame?.key ?? ''));
        expect(below.length).toBeGreaterThan(0);
        expect(below.every((x) => x.frame.target === null && x.frame.danger.source === row.obstacle.id)).toBe(true);
    }, 600_000);

    it('⛓⛓ L18\'s press arm: each frame is a strike the record kept (its body, its cell), read and not re-derived', async () => {
        const { on, st } = await runOf(RK_SOLVES[0]);
        const press = st.frames.filter((x) => x.frame?.key.endsWith('/verb:kill/arm:press'));
        expect(press.length).toBeGreaterThan(0);
        const rec = on.value.out.records.find((r) => r.arm === 'press');
        const kept = new Set(rec.cycles.map((c) => JSON.stringify([c.body, tileOf(c.cell)])));
        for (const { frame } of press) {
            expect(kept.has(JSON.stringify([frame.target, frame.stance]))).toBe(true);
            expect(frame.danger).toBe(null);
        }
        // every kept strike was shown, in the record's order (the last segment's stream is the record's run)
        const last = press.filter((x) => x.segment === 2).map((x) => JSON.stringify([x.frame.target, x.frame.stance]));
        const shown = last.filter((k, i) => i === 0 || k !== last[i - 1]);
        const order = rec.cycles.map((c) => JSON.stringify([c.body, tileOf(c.cell)]))
            .filter((k, i, a) => i === 0 || k !== a[i - 1]);
        expect(shown).toEqual(order);
    }, 600_000);

    it('⛓⛓ the danger\'s kind is read off the source\'s own fields', () => {
        expect(dangerKindOf({ kind: 'hazard', id: 'lavachain@1,2', phase: { tag: 'lavachain' } })).toBe('phase');
        expect(dangerKindOf({ kind: 'hazard', id: 'spinningaxe@1,2', axe: { cx: 1 } })).toBe('phase');
        for (const k of ['arrow', 'chaser', 'spinner', 'spit', 'bomb']) expect(dangerKindOf({ kind: k })).toBe('forecast');
        for (const k of ['hazard', 'enemy', 'crusher', 'terrain', 'pit', 'danger']) expect(dangerKindOf({ kind: k })).toBe('volume');
        expect(dangerKindOf(null)).toBe(null);
        // ⛓ every source kind `dangerMap.js` writes is one of those
        const dm = readFileSync(join(HERE, 'dangerMap.js'), 'utf8');
        const kinds = new Set([...dm.matchAll(/\bkind: '([a-z-]+)'/g)].map((m) => m[1]));
        expect([...kinds].sort()).toEqual(['arrow', 'bomb', 'chaser', 'crusher', 'danger', 'enemy', 'hazard', 'pit',
            'spinner', 'spit', 'terrain']);
    });

    it('⛓⛓ only an install reaches a frame: every solverBot site is one guarded line, and the setter reads no deadline', () => {
        const bot = readFileSync(join(HERE, 'solverBot.js'), 'utf8');
        const lines = bot.split('\n').filter((l) => /\bprogressFrame\(/.test(l));
        expect(lines.length).toBe(6);
        expect(lines.every((l) => /^\s*if \(activeProgress !== null\) progressFrame\(\{[^}]*\}\); \/\/ ⛓ TC2/.test(l))).toBe(true);
        expect(bot).not.toMatch(/\bframeEntered\b|\bdangerKindOf\b/);
        const own = readFileSync(join(HERE, 'solveProgress.js'), 'utf8');
        const body = own.slice(own.indexOf('let frameEntries'), own.indexOf('// ── the snapshot'));
        expect(body.length).toBeGreaterThan(500);
        expect(body).not.toMatch(/shouldStop|activeDeadline|performance|Date\.|emit\(|work\(|dangerAt|probe\w*\(/);
    });
});
