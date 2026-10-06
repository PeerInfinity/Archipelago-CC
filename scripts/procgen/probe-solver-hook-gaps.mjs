#!/usr/bin/env node
/**
 * Measure-only (fidelity CHECKPOINTS, planner `seedling-fidelity-planning-3`) — THE HOOK GAPS: every leg of
 * `--legs=<jsonl>` (`seedling-divergence-legs.mjs`) solved BARE (no inventory) through the same request path
 * `seedling-divergence-bare.mjs` stages (`arrivalSolverGoal` → `arrivalSolveRequest` → one `solveSegment` per
 * `ANYTIME_PASSES` pass, called the way `solveFromTape` calls it), with a COUNTING `shouldStop` that records, per
 * hook call, its site and the wall time
 * since the previous call (the pass start for the first; the pass end closes the last gap). A sampling profiler
 * (an inspector session a worker thread opens on the main thread, so a leg killed at `--timeout` still writes
 * what it sampled) attributes each gap over `--gap-ms` to the `frontend/modules` frames that ran in it.
 *
 *   `--sword`          the arrival holds the sword (`Main.hasSword`), so the `full` pass runs as well.
 *   `--fine`           the solve opts in to the FINE checkpoints (`solveSegment`'s `fineCheckpoints: true`).
 *   `--budget=<work>`  the hook is the worker's own (`passShouldStop`, one work clock per leg, the upgrade
 *                      window `--window=<work>` with a plan in hand) wrapped by the recorder — the answer the
 *                      page would get. Omitted: the hook never trips — the unbounded search, which is what
 *                      exposes a stretch with no call.
 *
 * One jsonl row per leg (appended as each leg lands, in finishing order): `passes[]` = `{pass, outcome, ticks, ms, calls, sites, maxGapMs, maxGapAfter, lastGapMs,
 * deadline}`, `gaps[]` = the gaps over `--gap-ms` (`{pass, index, after, before, ms, frames}`; `frames` = the
 * top inclusive `frontend/modules` frames, `name:line share%`). A killed leg's row is `outcome: 'timeout'` with the
 * calls it streamed. No browser; nothing tracked changes.
 *
 * Run: node scripts/procgen/probe-solver-hook-gaps.mjs --legs=<jsonl> --ids=a,b --out=<jsonl> [--jobs=N] [--timeout=<s>] [--gap-ms=<ms>] [--budget=<work>] [--window=<work>]
 *        switches: --fine --sword --no-profile
 *        (the parent spawns one child per leg with --one=<leg json> --dir=<profile dir>; not for hand use)
 */
import { readFileSync, writeFileSync, appendFileSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
const nowMs = () => Number(process.hrtime.bigint()) / 1e6;
/** The profiler's worker thread (`startProfiler`). */
let profilerWorker = null;

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) await main();

async function main() {
    const ONE = arg('one', '');
    if (ONE) { await oneLeg(JSON.parse(ONE)); process.exit(0); }
    const legs = readFileSync(arg('legs', ''), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const ids = arg('ids', '').split(',').filter(Boolean).map(Number);
    const pick = ids.length ? ids.map((id) => legs.find((l) => l.id === id)).filter(Boolean) : legs;
    const jobs = Number(arg('jobs', '1'));
    const timeoutS = Number(arg('timeout', '600'));
    const gapMs = Number(arg('gap-ms', '1000'));
    const profile = !process.argv.includes('--no-profile');
    const budget = arg('budget', '');
    const window = arg('window', '');
    const self = fileURLToPath(import.meta.url);
    const outPath = arg('out', '');
    if (outPath) writeFileSync(outPath, '');
    const out = [];
    let next = 0;
    async function worker() {
        while (next < pick.length) {
            const leg = pick[next++];
            const dir = mkdtempSync(join(tmpdir(), 'hookgaps-'));
            // eslint-disable-next-line no-await-in-loop
            const row = await new Promise((resolve) => {
                const p = spawn(process.execPath, [self, `--one=${JSON.stringify(leg)}`, `--dir=${dir}`, `--gap-ms=${gapMs}`,
                    `--timeout=${timeoutS}`, ...(profile ? [] : ['--no-profile']), ...['--fine', '--sword'].filter((f) => process.argv.includes(f)),
                    ...(budget ? [`--budget=${budget}`] : []), ...(window ? [`--window=${window}`] : [])],
                { stdio: ['ignore', 'pipe', 'pipe'] });
                let so = '';
                let se = '';
                p.stdout.on('data', (d) => { so += d; });
                p.stderr.on('data', (d) => { se += d; });
                const t = setTimeout(() => {
                    // the profiler worker writes its profile at the timeout; give it a moment, then kill.
                    const kill = setInterval(() => { if (existsSync(join(dir, 'profile.done'))) { clearInterval(kill); p.kill('SIGKILL'); } }, 200);
                    setTimeout(() => { clearInterval(kill); p.kill('SIGKILL'); }, 30000);
                }, timeoutS * 1000);
                p.on('close', () => {
                    clearTimeout(t);
                    const line = so.split('\n').filter((l) => l.startsWith('{"row"')).at(-1);
                    if (line) resolve(JSON.parse(line).row);
                    else resolve(rowFromStream(leg, so, dir, gapMs, se));
                });
            });
            out.push(row);
            if (outPath) appendFileSync(outPath, `${JSON.stringify(row)}\n`);
            console.log(`ROW ${summary(row)}`);
        }
    }
    await Promise.all(Array.from({ length: jobs }, worker));
    if (!outPath) console.log(out.map((r) => JSON.stringify(r)).join('\n'));
}

function summary(r) {
    return `${r.id} L${r.level} ${r.outcome} ${r.passes.map((p) => `${p.pass}:${p.outcome}/${p.calls}c/${p.ms}ms/max${p.maxGapMs}`).join(' ')}${r.err ? ` ERR ${r.err.slice(-200)}` : ''}`;
}

/** A leg killed mid-pass: rebuild its row from the streamed `CALL` / `PASS` lines (and the profile, if written). */
function rowFromStream(leg, so, dir, gapMs, se) {
    const ev = so.split('\n').filter((l) => l.startsWith('EV ')).map((l) => JSON.parse(l.slice(3)));
    const passes = passesOf(ev);
    const row = { id: leg.id, level: leg.level, outcome: 'timeout', err: se.slice(-300), passes };
    row.gaps = gapsOf(ev, gapMs, readProfile(dir));
    return row;
}

function readProfile(dir) {
    const f = join(dir, 'profile.json');
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

/** Events → per-pass rows. `ev`: `{e:'start'|'call'|'end', pass, t, site?, outcome?, ...}`; an unclosed pass ends at the last event. */
function passesOf(ev) {
    const rows = [];
    let cur = null;
    let prev = 0;
    const close = (end, extra) => {
        const last = end - prev;
        if (last > cur.maxGapMs) { cur.maxGapMs = last; cur.maxGapAfter = cur.calls ? '(last call → end)' : '(start → end)'; }
        cur.lastGapMs = Math.round(last);
        cur.ms = Math.round(end - cur.t0);
        cur.maxGapMs = Math.round(cur.maxGapMs);
        delete cur.t0;
        Object.assign(cur, extra);
        rows.push(cur);
        cur = null;
    };
    for (const e of ev) {
        if (e.e === 'start') { cur = { pass: e.pass, t0: e.t, calls: 0, sites: {}, maxGapMs: 0, maxGapAfter: null }; prev = e.t; }
        else if (e.e === 'call') {
            const g = e.t - prev;
            if (g > cur.maxGapMs) { cur.maxGapMs = g; cur.maxGapAfter = cur.calls ? `call ${cur.calls} (${cur.lastSite}) → ${e.site}` : `start → ${e.site}`; }
            cur.calls += 1;
            cur.sites[e.site] = (cur.sites[e.site] ?? 0) + 1;
            cur.lastSite = e.site;
            prev = e.t;
        } else if (e.e === 'end') close(e.t, { outcome: e.outcome, ticks: e.ticks ?? null, deadline: e.deadline ?? null, err: e.err });
    }
    if (cur) close(ev.at(-1).t, { outcome: 'unfinished' });
    for (const r of rows) delete r.lastSite;
    return rows;
}

/** Gaps over `gapMs`, each with the `frontend/modules` frames the profile sampled inside it. */
function gapsOf(ev, gapMs, profile) {
    const out = [];
    let prev = null;
    let pass = null;
    let idx = 0;
    let prevSite = null;
    const samples = profile ? sampleTimes(profile) : null;
    const push = (from, to, after, before) => {
        if (to - from <= gapMs) return;
        out.push({ pass, index: idx, after, before, ms: Math.round(to - from), frames: samples ? framesIn(samples, from, to) : null });
    };
    for (const e of ev) {
        if (e.e === 'start') { pass = e.pass; prev = e.t; idx = 0; prevSite = 'start'; }
        else if (e.e === 'call') { push(prev, e.t, prevSite, e.site); prev = e.t; idx += 1; prevSite = `${e.site}#${idx}`; }
        else if (e.e === 'end') { push(prev, e.t, prevSite, 'end'); prev = null; }
    }
    if (prev !== null && ev.length) push(prev, samples?.end ?? ev.at(-1).t, prevSite, '(killed)');
    return out;
}

/** The profile's samples as `{t (ms, the hrtime clock), stack: [frame keys]}` — V8's ticks are the same monotonic clock. */
function sampleTimes(profile) {
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const parent = new Map();
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    const stackOf = new Map();
    const stack = (id) => {
        if (stackOf.has(id)) return stackOf.get(id);
        const keys = [];
        for (let k = id; k !== undefined; k = parent.get(k)) {
            const cf = byId.get(k).callFrame;
            if (cf.url.includes('/frontend/modules/')) {
                keys.push(`${cf.url.split('/').at(-1).replace('.js', '')}:${cf.functionName || '(anon)'}:${cf.lineNumber + 1}`);
            }
        }
        const uniq = [...new Set(keys)];
        stackOf.set(id, uniq);
        return uniq;
    };
    const rows = [];
    let t = profile.startTime;
    for (let i = 0; i < profile.samples.length; i += 1) {
        t += profile.timeDeltas[i];
        rows.push({ t: t / 1000, stack: stack(profile.samples[i]) });
    }
    return { rows, end: profile.endTime / 1000 };
}

function framesIn(samples, from, to) {
    const count = new Map();
    let n = 0;
    for (const s of samples.rows) {
        if (s.t < from || s.t > to) continue;
        n += 1;
        for (const k of s.stack) count.set(k, (count.get(k) ?? 0) + 1);
    }
    if (n === 0) return [];
    return [...count].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([k, c]) => `${k} ${Math.round((100 * c) / n)}%`);
}

async function oneLeg(leg) {
    const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const dir = arg('dir', '');
    const gapMs = Number(arg('gap-ms', '1000'));
    const timeoutS = Number(arg('timeout', '600'));
    const M = (p) => import(join(REPO, 'frontend/modules', p));
    const { createJsRuntime } = await M('seedlingDemo/jsRuntimeCore.js');
    const { arrivalSolverGoal, arrivalSolveRequest } = await M('seedlingDemo/wasmArrival.js');
    const { wasmGoalRefusal } = await M('seedlingDemo/wasmPlayback.js');
    const { ANYTIME_PASSES, PASS_STRATEGIES, replayTape, passShouldStop, createWorkClock } = await M('seedlingDemo/jsRuntimeSolver.js');
    const { solveSegment } = await M('seedlingDemo/solverBot.js');
    const { indexLevels, levelSourceFromAtlas } = await M('seedlingDemo/atlasSource.js');
    const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
    const RECS = new Map(indexLevels(MAP));
    const SRC = levelSourceFromAtlas(RECS);
    const row = { id: leg.id, level: leg.level, arrive: [leg.arrive.x, leg.arrive.y], goal: leg.goal.name };
    const emit = (e) => process.stdout.write(`EV ${JSON.stringify(e)}\n`);
    const ev = [];
    const log = (e) => { ev.push(e); emit(e); };
    if (leg.goal.kind !== 'exit') { row.outcome = 'not-an-exit-leg'; row.passes = []; console.log(JSON.stringify({ row })); return; }
    const goal = { kind: 'exit', level: leg.level, tiles: leg.goal.tiles, name: leg.goal.name };
    const ref = wasmGoalRefusal(goal, RECS.get(leg.level) ?? null);
    if (ref) { row.outcome = 'wasm-refused'; row.err = ref; row.passes = []; console.log(JSON.stringify({ row })); return; }
    const rt = createJsRuntime();
    rt.setVanilla(RECS);
    // `--sword`: the arrival holds the sword (the JS page's own grant), so the `full` pass runs too.
    if (process.argv.includes('--sword')) rt.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [leg.level, leg.arrive.x, leg.arrive.y] }]);
    rt.tick();
    const mapped = arrivalSolverGoal(goal, { staging: rt.session.staging, levelSource: SRC, record: RECS.get(leg.level) });
    if (!mapped.goal) { row.outcome = 'no-solver-goal'; row.passes = []; console.log(JSON.stringify({ row })); return; }
    const req = arrivalSolveRequest({ staging: rt.session.staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS, scratchPersistence: true });
    const budget = arg('budget', '') ? Number(arg('budget', '')) : null;
    const windowWork = arg('window', '') ? Number(arg('window', '')) : null;
    const work = createWorkClock();
    const fine = process.argv.includes('--fine');
    /**
     * One pass as `solveFromTape` solves it — the tape replayed into a fresh shadow (`replayTape`), the pass
     * skipped when its strategy is unusable (`PASS_STRATEGIES`), then `solveSegment` — called here directly so
     * `--fine` can hand `fineCheckpoints` (which `solveFromTape` does not forward). The shadow is the run.
     */
    const solvePass = (p, shouldStop) => {
        const shadow = replayTape({ staging: req.staging, perTick: req.perTick, levelSource: req.levelSource,
            scratchPersistence: req.scratchPersistence, equips: req.equips });
        const unusable = p.adds ? PASS_STRATEGIES[p.adds](shadow) : null;
        if (unusable) { const e = new Error(`${p.adds} is not available here: ${unusable}`); e.name = 'PassSkipped'; throw e; }
        const out = solveSegment({ run: shadow, goals: [req.solverGoal], name: req.name, boot: req.staging.boot,
            prefix: req.perTick, dashMode: p.dashMode, shouldStop, ...(fine ? { fineCheckpoints: true } : {}) });
        return { ticks: out.perTick.length - req.perTick.length, deadline: out.deadline ?? null };
    };
    if (!process.argv.includes('--no-profile')) startProfiler(dir, timeoutS);
    let planInHand = false;
    for (const p of ANYTIME_PASSES) {
        const inner = budget ? passShouldStop(p, { budgetWork: budget, windowWork, planInHand, work, limit: {} }) : () => false;
        const shouldStop = (site) => { log({ e: 'call', pass: p.pass, site, t: nowMs() }); return inner(site); };
        log({ e: 'start', pass: p.pass, t: nowMs() });
        try {
            const ans = solvePass(p, shouldStop);
            planInHand = true;
            log({ e: 'end', pass: p.pass, t: nowMs(), outcome: 'solved', ticks: ans.ticks, deadline: ans.deadline?.first ?? null });
        } catch (e) {
            log({ e: 'end', pass: p.pass, t: nowMs(), outcome: e.name === 'PassSkipped' ? 'skipped' : 'refused',
                err: `${e.name}: ${String(e.message).split('\n')[0].slice(0, 200)}`, deadline: e.deadline?.first ?? null });
        }
    }
    const profile = stopProfiler(dir);
    row.outcome = 'done';
    row.passes = passesOf(ev);
    row.gaps = gapsOf(ev, gapMs, profile);
    console.log(JSON.stringify({ row }));
}

/**
 * The sampling profiler on THIS (main) thread, driven from a worker thread: the inspector dispatches a session's
 * messages by interrupt while the main thread runs JS, so the worker can stop the profile and write it at the
 * timeout even though the solve never yields.
 */
function startProfiler(dir, timeoutS) {
    const { Worker } = process.getBuiltinModule('node:worker_threads');
    const src = `
const { workerData, parentPort } = require('node:worker_threads');
const inspector = require('node:inspector');
const fs = require('node:fs');
const s = new inspector.Session();
s.connectToMainThread();
const done = () => s.post('Profiler.stop', (err, r) => {
  if (!err) fs.writeFileSync(workerData.dir + '/profile.json', JSON.stringify(r.profile));
  fs.writeFileSync(workerData.dir + '/profile.done', '1');
  s.disconnect();
  parentPort.postMessage('stopped');
});
s.post('Profiler.enable', () => s.post('Profiler.setSamplingInterval', { interval: 2000 }, () => s.post('Profiler.start', () => fs.writeFileSync(workerData.dir + '/profile.started', '1'))));
const t = setTimeout(done, workerData.timeoutS * 1000 - 2000);
parentPort.on('message', (m) => { if (m === 'stop') { clearTimeout(t); done(); } });
`;
    profilerWorker = new Worker(src, { eval: true, workerData: { dir, timeoutS } });
    spinUntil(join(dir, 'profile.started'), 10000);
}

/** Busy-wait in JS (not `Atomics.wait`): the inspector's messages to this thread are dispatched at JS interrupt checks. */
function spinUntil(file, ms) {
    const until = Date.now() + ms;
    let n = 0;
    while (Date.now() < until) { n += 1; if (n % 20000 === 0 && existsSync(file)) return true; }
    return existsSync(file);
}

function stopProfiler(dir) {
    if (!profilerWorker) return null;
    profilerWorker.postMessage('stop');
    spinUntil(join(dir, 'profile.done'), 20000);
    return readProfile(dir);
}
