#!/usr/bin/env node
/**
 * Measure-only — REPLAY A CAPTURED SOLVE REQUEST in node, N times, each in a FRESH process: is the solver's answer a
 * function of the request? The input is the divergence sweep's `--capture-requests` file (`probe-seedling-divergence-sweep.mjs`
 * / workflow input `capture_requests`): one line per leg `{id, key, requests: [{i, request, passes, result}]}`, each
 * request as the worker received it (`seedlingSolveRequestCodec.captureRequest`: no `levelSource`, Map/Set tagged).
 *
 * The replay is the worker's own dispatch (`jsRuntimeSolveWorker.js`): `levelSourceFromAtlas(source.records)`, then
 * `solveAnytime({...tape, levelSource}, {passes})` — the same budgets (`budgetWork`, `upgradeWindowWork`) the request
 * carries, the same fine checkpoints. A progress hook (`withSolveProgress`, which never reaches an answer) folds every
 * progress point into a rolling hash, checkpointed every `--every` points, so two runs that differ name the FIRST
 * checkpoint window where their search differed.
 *
 * One jsonl row per run: `{id, i, run, passes: [{pass, ok, kind, work, deadline, limit, ticks}], work, kind, answer
 * (sha1 of the answer's message/plan), points, trace (sha1), checkpoints}`. Then a `REPLAY:` line per request:
 * `k distinct answer(s) over N` and, when the traces differ, the first differing checkpoint. With `--live` it also
 * prints what the PAGE's worker answered (the captured `result`), for the same comparison.
 *
 * ⛓ SEAM TIME CENSUS — `--seam-time-sweep=<from>..<to>`: instead of N repeats, one replay per arrival game clock
 * `captured + d` (`atSeamTime`: only `staging.seam.time` moves), and a `SEAM-SWEEP:` line saying whether the answer
 * VARIES WITH seam.time, then one line per time. `--jobs=N` runs N processes at once (default 1).
 *
 * Run: node scripts/procgen/replay-seedling-solve-request.mjs --requests=<jsonl> [--id=N] [--i=K] [--n=3] [--seam-time-sweep=<from>..<to>] [--jobs=N] [--every=5000] [--out=<jsonl>] [--live]
 */
import { readFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { restoreRequest } from './seedlingSolveRequestCodec.js';

argvHelp(import.meta.url);


const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);

/** One replay of one captured request, in this process. */
export async function replayOnce(captured, { every = 5000 } = {}) {
    const { levelSourceFromAtlas } = await import('../../frontend/modules/seedlingDemo/atlasSource.js');
    const { solveAnytime, ANYTIME_PASSES } = await import('../../frontend/modules/seedlingDemo/jsRuntimeSolver.js');
    const { withSolveProgress } = await import('../../frontend/modules/seedlingDemo/solveProgress.js');
    const req = restoreRequest(captured);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);
    let h = createHash('sha1');
    let points = 0;
    const checkpoints = [];
    const t0 = Date.now();
    const answer = withSolveProgress((site) => {
        h.update(`${site};`);
        points += 1;
        if (points % every === 0) checkpoints.push(h.copy().digest('hex').slice(0, 8));
    }, () => solveAnytime({ ...tape, source, levelSource }, { passes }));
    const text = answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : String(answer.message ?? '');
    return { passes: (answer.passes ?? []).map(({ ms, ...r }) => r), work: answer.work ?? null, ok: answer.ok, kind: answer.kind ?? null,
        answer: sha(text), message: answer.ok ? null : text.slice(0, 300), points, trace: h.digest('hex').slice(0, 12), checkpoints,
        ms: Date.now() - t0 };
}

if (isEntryPoint(import.meta.url)) await main();

/** `--seam-time-sweep=-10..10` → the offsets, inclusive (empty = none). Not `<int>..<int>` → throws by name. */
export function parseSeamSweep(spec) {
    if (!spec) return null;
    const m = /^(-?\d+)\.\.(-?\d+)$/.exec(spec);
    if (!m || Number(m[1]) > Number(m[2])) throw new Error(`--seam-time-sweep: ${JSON.stringify(spec)} is not <from>..<to> (integers, from ≤ to)`);
    const out = [];
    for (let d = Number(m[1]); d <= Number(m[2]); d += 1) out.push(d);
    return out;
}

/**
 * ⛓ SEAM TIME — the same request staged at another arrival game clock: only `staging.seam.time` moves. Sound for the
 * census because the six captured 397 requests (seam times 5135–5141) differ in NOTHING else — every mobile, item,
 * flag and the `live` digest are the same; the model derives a mobile's phase from that clock.
 */
export function atSeamTime(captured, time) {
    return { ...captured, staging: { ...captured.staging, seam: { ...captured.staging.seam, time } } };
}

/** One fresh process per run; at most `jobs` at once. */
function runChild(args) {
    return new Promise((done) => {
        const c = spawn(process.execPath, [fileURLToPath(import.meta.url), ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        c.stdout.on('data', (d) => { out += d; });
        c.stderr.on('data', (d) => { err += d; });
        c.on('close', (code) => {
            const line = out.split('\n').find((l) => l.startsWith('RESULT '));
            done(line ? JSON.parse(line.slice(7)) : { error: `exit ${code}: ${err.split('\n').slice(-4).join(' | ')}` });
        });
    });
}
async function pool(tasks, jobs) {
    const out = new Array(tasks.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.max(1, jobs) }, async () => {
        while (next < tasks.length) { const k = next++; out[k] = await tasks[k](); } // eslint-disable-line no-await-in-loop
    }));
    return out;
}

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
    const FILE = arg('requests', '');
    const EVERY = Number(arg('every', '5000'));
    const lines = readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const ONE = arg('one', '');
    if (ONE) {
        const [id, i] = ONE.split(':').map(Number);
        const c = lines.find((l) => l.id === id).requests.find((r) => r.i === i);
        const at = arg('at', '');
        const req = at === '' ? c.request : atSeamTime(c.request, Number(at));
        console.log(`RESULT ${JSON.stringify(await replayOnce(req, { every: EVERY }))}`);
        return;
    }
    const N = Number(arg('n', '3'));
    const ID = arg('id', '');
    const I = arg('i', '');
    const OUT = arg('out', '');
    const JOBS = Number(arg('jobs', '1'));
    const SWEEP = parseSeamSweep(arg('seam-time-sweep', ''));
    for (const leg of lines.filter((l) => ID === '' || l.id === Number(ID))) {
        for (const c of leg.requests.filter((r) => I === '' || r.i === Number(I))) {
            const base = c.request.staging?.seam?.time ?? null;
            const plan = SWEEP ? SWEEP.map((d) => ({ run: 0, at: base + d })) : Array.from({ length: N }, (_, run) => ({ run, at: null }));
            const runs = await pool(plan.map((p) => async () => { // eslint-disable-line no-await-in-loop
                const r = await runChild([`--requests=${FILE}`, `--one=${leg.id}:${c.i}`, `--every=${EVERY}`, ...(p.at === null ? [] : [`--at=${p.at}`])]);
                const row = { id: leg.id, key: leg.key, i: c.i, run: p.run, seamTime: p.at ?? base, budgetWork: c.request.budgetWork ?? null, ...r };
                console.log(`ROW ${JSON.stringify(row)}`);
                if (OUT) appendFileSync(OUT, `${JSON.stringify(row)}\n`);
                return row;
            }), JOBS);
            const answerOf = (r) => `${r.kind}:${r.answer}:${r.work}`;
            if (SWEEP) {
                const answers = new Map();
                for (const r of runs) answers.set(answerOf(r), [...(answers.get(answerOf(r)) ?? []), r.seamTime]);
                console.log(`SEAM-SWEEP: leg ${leg.id} request ${c.i} (captured at ${base}, budget ${c.request.budgetWork ?? 'none'}): `
                    + `${answers.size} distinct answer(s) over ${runs.length} seam time(s)${answers.size > 1 ? ' — VARIES WITH seam.time' : ''}`);
                for (const r of runs) {
                    const d = r.passes?.map((x) => `${x.pass}:${x.work}${x.deadline ? `/${x.deadline}` : ''}`).join(',') ?? r.error;
                    console.log(`  t=${r.seamTime} ${r.kind} work=${r.work} [${d}] ${String(r.message ?? (r.ok ? 'PLAN' : '')).slice(0, 110)}`);
                }
                continue;
            }
            const answers = new Set(runs.map(answerOf));
            let first = null;
            const traces = new Set(runs.map((r) => r.trace));
            if (traces.size > 1) {
                const a = runs[0].checkpoints ?? [];
                for (const r of runs.slice(1)) {
                    const k = (r.checkpoints ?? []).findIndex((x, j) => x !== a[j]);
                    if (k >= 0 && (first === null || k < first)) first = k;
                }
            }
            console.log(`REPLAY: leg ${leg.id} request ${c.i} (budget ${c.request.budgetWork ?? 'none'}): ${answers.size} distinct answer(s) over ${N}`
                + `, ${traces.size} distinct trace(s)${first !== null ? `; first differing checkpoint ${first} (points ${first * EVERY}..${(first + 1) * EVERY})` : ''}`);
            if (process.argv.includes('--live')) console.log(`LIVE: the page's worker answered ${JSON.stringify(c.result)}`);
        }
    }
}
