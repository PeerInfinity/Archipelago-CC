#!/usr/bin/env node
/**
 * Measure-only — REPLAY A CAPTURED SOLVE REQUEST in node, N times, each in a FRESH process: is the solver's answer a
 * function of the request? The input is the divergence sweep's `--capture-requests` file (`probe-seedling-divergence-sweep.mjs`
 * / workflow input `capture_requests`): one line per leg `{id, key, requests: [{i, request, passes, result}]}`, each
 * request as the worker received it (`seedlingDivergenceLab.captureRequest`: no `levelSource`, Map/Set tagged).
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
 * Run: node scripts/procgen/replay-seedling-solve-request.mjs --requests=<jsonl> [--id=N] [--i=K] [--n=3] [--every=5000] [--out=<jsonl>] [--live]
 */
import { readFileSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
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

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
    const FILE = arg('requests', '');
    const EVERY = Number(arg('every', '5000'));
    const lines = readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const ONE = arg('one', '');
    if (ONE) {
        const [id, i] = ONE.split(':').map(Number);
        const c = lines.find((l) => l.id === id).requests.find((r) => r.i === i);
        console.log(`RESULT ${JSON.stringify(await replayOnce(c.request, { every: EVERY }))}`);
        return;
    }
    const N = Number(arg('n', '3'));
    const ID = arg('id', '');
    const I = arg('i', '');
    const OUT = arg('out', '');
    for (const leg of lines.filter((l) => ID === '' || l.id === Number(ID))) {
        for (const c of leg.requests.filter((r) => I === '' || r.i === Number(I))) {
            const runs = [];
            for (let run = 0; run < N; run += 1) {
                const p = spawnSync(process.execPath, [fileURLToPath(import.meta.url), `--requests=${FILE}`, `--one=${leg.id}:${c.i}`, `--every=${EVERY}`],
                    { encoding: 'utf8', maxBuffer: 1 << 28 });
                const line = (p.stdout ?? '').split('\n').find((l) => l.startsWith('RESULT '));
                const r = line ? JSON.parse(line.slice(7)) : { error: `exit ${p.status}: ${(p.stderr ?? '').split('\n').slice(-4).join(' | ')}` };
                const row = { id: leg.id, key: leg.key, i: c.i, run, budgetWork: c.request.budgetWork ?? null, ...r };
                runs.push(row);
                console.log(`ROW ${JSON.stringify(row)}`);
                if (OUT) appendFileSync(OUT, `${JSON.stringify(row)}\n`);
            }
            const answers = new Set(runs.map((r) => `${r.kind}:${r.answer}:${r.work}`));
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
