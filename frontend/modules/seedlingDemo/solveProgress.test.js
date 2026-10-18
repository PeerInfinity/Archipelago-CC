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
    installSolveProgress, kindEntered, progressKind, progressReason, progressWhy, withSolveProgress,
} from './solveProgress.js';
import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';

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
/** v1's bytes of a v2 snapshot: no `v`, no `lastWhy`, no `rejectionKinds`. */
const v1Of = (snap) => {
    const strip = (n) => { const { rejectionKinds, children, ...rest } = n; return { ...rest, children: children.map(strip) }; };
    const { v, lastWhy, tree, ...rest } = snap;
    return { ...rest, tree: strip(tree) };
};
/** `lastWhy` is null or ONE plain object `{why, kind, key}`, and its key is a node of the tree it rides with. */
function expectLastWhy(snap) {
    const lw = snap.lastWhy;
    if (lw === null) return;
    expect(Array.isArray(lw)).toBe(false);
    expect(Object.keys(lw)).toEqual(['why', 'kind', 'key']);
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
        // ⛓ the cut key is not the verbatim why: it is the sentence's first word, and it has no kind of its own
        expect(progressReason(err)).toBe('levelRun');
        expect(progressKind(progressReason(err))).toBe('other');
        for (const snap of f.stream) expectLastWhy(snap);
        expect(f.stream.filter((x) => x.lastWhy !== null).length).toBeGreaterThan(0);
    }, 300_000);

    it('⛓⛓ lastWhy is a refused rung\'s why verbatim: L40\'s and L6\'s last rejections are rows of their own traces', async () => {
        for (const s of [RK_SOLVES[1], RK_SOLVES[2]]) {
            const { on, finals } = await runOf(s);
            const whys = on.value.out.trace.rows.flatMap((r) => (r.rejected ?? []).map((x) => x.why));
            const last = finals.at(-1).lastWhy;
            expect(last).not.toBe(null);
            expect(whys).toContain(last.why);
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
            ['sealDoorApproach', refusal(`solverBot: approach finaldoor@96,16 in level 113 — ${door}.`,
                { obstacle: { kind: 'solid', id: 'finaldoor@96,16', tag: 'finaldoor' } }), 'does-not-apply'],
            ['sealDoorApproach', refusal('solverBot: no stance to approach finaldoor@96,16 from in level 113 — 4 '
                + 'walkable cell(s) lie 40..64 px from it and none plans a corridor from (16,16).',
            { obstacle: { kind: 'solid', id: 'finaldoor@96,16' } }), 'exhausted'],
            ['sealDoorApproach', refusal('x: held toward finaldoor@96,16 for 120 tick(s) and it never played "open" '
                + '(closest 30.00 px; the circle is 36; ceremonies 1).'), 'diverged'],
            ['sealDoorApproach', refusal('x: finaldoor@96,16 was still standing 90 tick(s) after "open" played.'),
                'diverged'],
            ['sealDoorApproach', refusal(`solverBot(t) clear-tag {113,0} finaldoor@96,16: 'approach' could not be `
                + `resolved from (16,16): ${door}`, { obstacle: { kind: 'clear-tag', reason: 'unresolved' } }),
            'exhausted'],
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
        expect(bot).not.toMatch(/\bprogress(?:Kind|Why)\(|\bkindEntered\b/);
        const own = readFileSync(join(HERE, 'solveProgress.js'), 'utf8');
        const body = own.slice(own.indexOf('export function progressKind('), own.indexOf('function noteLast('));
        expect(body.length).toBeGreaterThan(200);
        expect(body).not.toMatch(/shouldStop\(|activeDeadline|performance|Date\./);
    });
});
