#!/usr/bin/env node
/**
 * Measure-only (slice L371): the press kill's tick-by-tick state, through the solver's own read-only probe
 * (`REWIND_PROBE`: its sink gets the live inner run before each tape tick's advance, and at each press kill's start).
 * Nothing the solver reads is written. One captured request, at `--seam=<time>`, the worker's `solveAnytime`.
 * Prints `KILL` lines (each press kill's start), and from `--from` to `--to` one `T` line per tick of pass `--pass`
 * (dashless | full): player x,y, deaths, each spinner's x,y,hits,timer, and the bomb events that tick.
 *
 * Run: node l371-trace.mjs --requests=<jsonl> --seam=<t> [--pass=dashless] [--from=1300] [--to=1400]
 */
import { readFileSync } from 'node:fs';

const arg = (k, d = null) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=') || d;
const R = '../../../../../';
const rel = (p) => new URL(R + p, import.meta.url).href;
const { restoreRequest } = await import(rel('scripts/procgen/seedlingSolveRequestCodec.js'));
const { atSeamTime } = await import(rel('scripts/procgen/replay-seedling-solve-request.mjs'));
const { levelSourceFromAtlas } = await import(rel('frontend/modules/seedlingDemo/atlasSource.js'));
const { solveAnytime, ANYTIME_PASSES } = await import(rel('frontend/modules/seedlingDemo/jsRuntimeSolver.js'));
const sb = await import(rel('frontend/modules/seedlingDemo/solverBot.js'));

const line = readFileSync(arg('requests'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))[0];
let captured = line.requests[0].request;
if (arg('seam') !== null) captured = atSeamTime(captured, Number(arg('seam')));
const req = restoreRequest(captured);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const want = arg('pass', 'dashless');
const from = Number(arg('from', '1300'));
const to = Number(arg('to', '1400'));
const r2 = (v) => Math.round(v * 100) / 100;

let passIdx = 0;
let seenBomb = 0;
let lastName = null;
sb.REWIND_PROBE.ticks = { has: () => true };
sb.REWIND_PROBE.sink = ({ t, kind, name, live }) => {
    const pass = passes[passIdx]?.pass;
    if (kind === 'kill-start') {
        const sp = (live.entities('spinnerBodies') ?? []).map((b) => `${b.id}:${r2(b.x)},${r2(b.y)} h${b.hits} tm${b.hitsTimer}`);
        console.log(`KILL ${pass} t${t} seg=${lastName} player=${r2(live.state.x)},${r2(live.state.y)} deaths=${live.ledger('playerDeaths').length} ${sp.join(' ')}`);
        return;
    }
    lastName = name;
    if (pass !== want) return;
    const ev = live.ledger('bombEvents') ?? [];
    const news = ev.slice(seenBomb);
    seenBomb = ev.length;
    if (t < from || t > to) return;
    const sp = (live.entities('spinnerBodies') ?? []).map((b) => `${b.id}:${r2(b.x)},${r2(b.y)} h${b.hits} tm${b.hitsTimer}`);
    const ne = news.map((e) => `${e.what}:${e.id}${e.body ? `→${e.body}` : ''}${e.at ? `@${r2(e.at.x)},${r2(e.at.y)}` : ''}`);
    console.log(`T ${t} ${name} p=${r2(live.state.x)},${r2(live.state.y)} d=${live.ledger('playerDeaths').length} hits=${live.ledger('playerHits').length} ${sp.join(' ')}${ne.length ? ` | ${ne.join(' ')}` : ''}`);
};
const answer = solveAnytime({ ...tape, source, levelSource }, { passes, onPass: (one) => {
    console.log(`PASS ${one.pass} ok=${one.ok} ${one.ok ? `${one.plan.solution.length} t` : String(one.message).slice(0, 400)}`);
    passIdx += 1;
    seenBomb = 0;
} });
console.log(`ANSWER ok=${answer.ok} work=${answer.work}`);
