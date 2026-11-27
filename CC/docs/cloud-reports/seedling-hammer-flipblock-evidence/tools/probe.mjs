#!/usr/bin/env node
// flipblock probe (measure only): solve ONE captured request (the sweep's --capture-requests jsonl) in this process,
// the worker's dispatch (as replay-seedling-solve-request.mjs), and print per pass: verdict, work, wall, and the three
// switches' counters with the deadline-site ask count at each GSW try / PKH row. Switches by env (SEEDLING_*=1).
// Run: node probe.mjs (--requests=<jsonl> --id=N --i=K | --fixture=<request.json.gz>) [--seam-time=T] [--budget=N] [--json=<out>] [--pm-free=N]
import { readFileSync, writeFileSync } from 'node:fs';
import { restoreRequest } from '../../../../../scripts/procgen/seedlingSolveRequestCodec.js';
const arg = (k, d = null) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=') || d;
const R = '../../../../../frontend/modules/seedlingDemo/';
const { levelSourceFromAtlas } = await import(R + 'atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(R + 'jsRuntimeSolver.js');
const { withSolveProgress } = await import(R + 'solveProgress.js');
const sb = await import(R + 'solverBot.js');
if (arg('pm-free') !== null) sb.PREVIEW_METER.freeStatesPerAsk = Number(arg('pm-free'));
import { gunzipSync } from 'node:zlib';
const line = arg('fixture') ? { id: arg('fixture'), key: arg('fixture') } : readFileSync(arg('requests'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => r.id === Number(arg('id')));
const cap = arg('fixture') ? { i: null, request: JSON.parse(gunzipSync(readFileSync(arg('fixture')))).request } : line.requests.find((q) => q.i === Number(arg('i')));
let captured = cap.request;
if (arg('seam-time')) captured = JSON.parse(JSON.stringify(captured)), captured.staging.seam.time = Number(arg('seam-time'));
const req = restoreRequest(captured);
if (arg('budget')) req.budgetWork = Number(arg('budget'));
let { passes = ANYTIME_PASSES, source, ...tape } = req;
if (arg('pass')) passes = passes.filter((p) => p.name === arg('pass'));
const levelSource = levelSourceFromAtlas(source.records);
const SITES = new Set(sb.DEADLINE_SITES);
let asks = 0; const bySite = {}; let pass = null;
const t0 = performance.now();
const ms = () => Math.round(performance.now() - t0);
const gsw = []; const origPush = sb.GOAL_START_WAIT_COUNTS.tries.push.bind(sb.GOAL_START_WAIT_COUNTS.tries);
sb.GOAL_START_WAIT_COUNTS.tries.push = (r) => { gsw.push({ ...r, why: r.why?.slice(0, 140), asks, ms: ms(), pass }); return origPush(r); };
const pkh = [];
const passRows = [];
let passAsk0 = 0, passMs0 = 0, pm0 = { ...sb.PREVIEW_METER_COUNTS };
const answer = withSolveProgress((site, peek) => {
    if (SITES.has(site)) { asks += 1; bySite[site] = (bySite[site] ?? 0) + 1; }
}, () => solveAnytime({ ...tape, source, levelSource }, { passes, onPass: (one, best, index) => {
    const pm = sb.PREVIEW_METER_COUNTS;
    passRows.push({ index, pass: one.pass ?? passes[index]?.name ?? index, ok: one.ok, kind: one.kind ?? null, asks: asks - passAsk0, ms: ms() - passMs0,
        pm: { states: pm.states - pm0.states, asked: pm.asked - pm0.asked, tripped: pm.tripped - pm0.tripped },
        msg: one.ok ? `${one.plan?.solution?.length} t` : String(one.message ?? '').slice(0, 260) });
    passAsk0 = asks; passMs0 = ms(); pm0 = { ...pm };
} }));
for (const r of sb.PRESS_KILL_HOLD_COUNTS.rows) pkh.push(JSON.parse(JSON.stringify(r)));
const out = { id: line.id, key: line.key, i: cap.i, budget: req.budgetWork, seam: captured.staging?.seam?.time,
    env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('SEEDLING_'))),
    ok: answer.ok, kind: answer.kind ?? null, work: answer.work ?? null, ticks: answer.ok ? answer.plan.solution.length : null,
    passes: (answer.passes ?? []).map(({ ms: m, ...r }) => ({ ...r, ms: m })), passRows, asks, bySite, wall: ms(), gsw, pkh,
    pm: { ...sb.PREVIEW_METER_COUNTS, free: sb.PREVIEW_METER.freeStatesPerAsk }, gswDeferred: sb.GOAL_START_WAIT_COUNTS.deferred ?? 0, msg: answer.ok ? null : String(answer.message ?? '').slice(0, 400) };
console.log(JSON.stringify(out));
if (arg('json')) writeFileSync(arg('json'), JSON.stringify({ ...out, solution: answer.ok ? answer.plan.solution.map((k) => [...k]) : null }));
