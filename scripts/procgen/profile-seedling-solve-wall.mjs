#!/usr/bin/env node
/**
 * profile-seedling-solve-wall — ⛓ SEEDLING HAMMER-PHASE SPINNER880 step 1: **WHERE A SOLVE'S WALL CLOCK GOES WHEN NO
 * WORK UNIT IS SPENT.** Measure only: it replays one captured solve request (the divergence sweep's / the whole-game
 * walk's `--capture-requests` file, as `replay-seedling-solve-request.mjs` reads it) in THIS process, under two
 * observers that change nothing the solver reads:
 *
 *   1. the solver's own progress hook (`solveProgress.withSolveProgress`) — every deadline-site ask point
 *      (`solverBot.DEADLINE_SITES`: the places `passShouldStop`'s work clock CAN tick) and every count point is stamped
 *      with the monotonic clock. The GAPS between two consecutive deadline-site points are the stretches the budget
 *      cannot see (a work unit is one `shouldStop` ask; nothing between two asks is metered).
 *   2. V8's sampling CPU profiler (`node:inspector`), on the same clock — each sample is attributed to the gap it fell
 *      in, so a long gap names the functions (inclusive: every frame on the stack, once per sample) that ran inside it.
 *
 * Output (stdout): the answer (kind, work, passes, wall ms), the ask counts per site, the gap histogram, the share of
 * the wall spent in gaps over `--long=<ms>` (default 1000), the top `--top=<n>` (default 12) gaps with the sites that
 * bound them and their top functions, and the whole solve's top functions by inclusive and self time. `--json=<path>`
 * also writes every gap and table. Writes nothing else; runs NOTHING on import (an entry-point CLI only).
 *
 * Run:
 *   node scripts/procgen/profile-seedling-solve-wall.mjs --requests=<jsonl> --id=19 --i=1 [--long=1000] [--top=12]
 *        [--interval-us=1000] [--json=<path>] [--seam-time=<t>] [--focus=<functionName> [--depth=8]]
 *   `--focus=` prints the call tree under that function (its outermost frame per sample): the loop inside it that
 *   holds the wall, children of at least 3 % of its samples.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

/** Monotonic µs — the clock V8's profiler stamps its samples with (CLOCK_MONOTONIC on linux, as `hrtime`). */
const nowUs = () => Number(process.hrtime.bigint() / 1000n);

/** The function key of a profile node's call frame: `name file:line`. */
export function frameKey(cf) {
    const file = cf.url ? basename(cf.url.replace(/^file:\/\//, '')) : '';
    return `${cf.functionName || '(anonymous)'} ${file}${file ? `:${cf.lineNumber + 1}` : ''}`;
}

/**
 * The profile's samples as `{t (µs), self (key), stack (Set of keys)}` — every frame once per sample (inclusive).
 * `(program)`, `(idle)` and `(garbage collector)` are kept as their own keys.
 */
export function samplesOf(profile) {
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const parent = new Map();
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    const stackCache = new Map();
    const stackOf = (id) => {
        let s = stackCache.get(id);
        if (s !== undefined) return s;
        const keys = [];
        for (let x = id; x !== undefined; x = parent.get(x)) {
            const cf = byId.get(x).callFrame;
            if (cf.functionName === '(root)') continue;
            keys.push(frameKey(cf));
        }
        s = { set: new Set(keys), path: keys.reverse() };
        stackCache.set(id, s);
        return s;
    };
    const out = [];
    let t = profile.startTime;
    for (let k = 0; k < profile.samples.length; k += 1) {
        t += profile.timeDeltas[k];
        const id = profile.samples[k];
        const st = stackOf(id);
        out.push({ t, self: frameKey(byId.get(id).callFrame), stack: st.set, path: st.path });
    }
    return out;
}

/**
 * The call tree under the frame whose function name is `focus` (its outermost occurrence on each sample's stack),
 * over `samples`: `[{depth, key, n}]` in depth-first order, children by count, pruned below `minShare` of the focus's
 * samples and past `maxDepth`. The question it answers: which loop inside `focus` holds the wall.
 */
export function treeUnder(samples, focus, { maxDepth = 8, minShare = 0.03 } = {}) {
    const root = { key: focus, n: 0, kids: new Map() };
    for (const s of samples) {
        const k = s.path.findIndex((key) => key.split(' ')[0] === focus);
        if (k < 0) continue;
        root.n += 1;
        let node = root;
        for (let d = k + 1; d < s.path.length && d - k <= maxDepth; d += 1) {
            let c = node.kids.get(s.path[d]);
            if (c === undefined) {
                c = { key: s.path[d], n: 0, kids: new Map() };
                node.kids.set(s.path[d], c);
            }
            c.n += 1;
            node = c;
        }
    }
    const rows = [];
    const walk = (node, depth) => {
        rows.push({ depth, key: node.key, n: node.n });
        for (const c of [...node.kids.values()].sort((a, b) => b.n - a.n)) {
            if (c.n >= minShare * root.n) walk(c, depth + 1);
        }
    };
    walk(root, 0);
    return rows;
}

/** Top `n` of a Map key → count, as `[key, count]` descending. */
const topOf = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);

/**
 * The gaps between consecutive deadline-site points (`points`: `{t, site, deadline}` in order), with the samples
 * inside each attributed by inclusive function. `t0`/`t1` bound the solve (the stretch before the first site and after
 * the last are gaps too).
 */
export function gapsOf(points, samples, t0, t1) {
    const marks = points.filter((p) => p.deadline);
    const edges = [{ t: t0, site: '(start)' }, ...marks, { t: t1, site: '(end)' }];
    const gaps = [];
    let s = 0;
    for (let k = 1; k < edges.length; k += 1) {
        const a = edges[k - 1];
        const b = edges[k];
        const g = { from: a.site, to: b.site, at: k - 1, ms: (b.t - a.t) / 1000, samples: 0, incl: new Map(),
            beats: 0, counts: new Map() };
        while (s < samples.length && samples[s].t < a.t) s += 1;
        for (; s < samples.length && samples[s].t < b.t; s += 1) {
            g.samples += 1;
            for (const key of samples[s].stack) g.incl.set(key, (g.incl.get(key) ?? 0) + 1);
        }
        gaps.push(g);
    }
    // the count points (non-deadline sites) inside each gap
    let gi = 0;
    for (const p of points) {
        if (p.deadline) continue;
        while (gi < gaps.length - 1 && p.t >= edges[gi + 1].t) gi += 1;
        const g = gaps[gi];
        g.counts.set(p.site, (g.counts.get(p.site) ?? 0) + 1);
        if (p.site === 'heartbeat') g.beats += 1;
    }
    return gaps;
}

/** Gap histogram buckets (ms upper bounds). */
export const GAP_BUCKETS = [1, 10, 100, 1000, 10000, 60000, Infinity];

export function histogramOf(gaps) {
    const rows = GAP_BUCKETS.map((ub) => ({ ub, n: 0, ms: 0 }));
    for (const g of gaps) {
        const r = rows.find((x) => g.ms <= x.ub);
        r.n += 1;
        r.ms += g.ms;
    }
    return rows;
}

async function main() {
    const arg = (name, fallback) => (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback);
    const FILE = arg('requests', '');
    const ID = Number(arg('id', 'NaN'));
    const I = Number(arg('i', 'NaN'));
    const LONG = Number(arg('long', '1000'));
    const TOP = Number(arg('top', '12'));
    const INTERVAL = Number(arg('interval-us', '1000'));
    const JSON_OUT = arg('json', '');
    const FOCUS = arg('focus', '');
    const DEPTH = Number(arg('depth', '8'));
    const AT = arg('seam-time', '');
    if (!FILE || !Number.isInteger(ID) || !Number.isInteger(I)) throw new Error('--requests=<jsonl> --id=<leg> --i=<k> are required');

    const { restoreRequest } = await import('./seedlingSolveRequestCodec.js');
    const { atSeamTime } = await import('./replay-seedling-solve-request.mjs');
    const { levelSourceFromAtlas } = await import('../../frontend/modules/seedlingDemo/atlasSource.js');
    const { solveAnytime, ANYTIME_PASSES } = await import('../../frontend/modules/seedlingDemo/jsRuntimeSolver.js');
    const { withSolveProgress } = await import('../../frontend/modules/seedlingDemo/solveProgress.js');
    const { DEADLINE_SITES } = await import('../../frontend/modules/seedlingDemo/solverBot.js');
    const inspector = await import('node:inspector/promises');

    let captured = null;
    for (const l of readFileSync(FILE, 'utf8').split('\n')) {
        if (!l) continue;
        const leg = JSON.parse(l);
        if (leg.id !== ID) continue;
        captured = leg.requests.find((r) => r.i === I) ?? null;
        break;
    }
    if (captured === null) throw new Error(`no request ${ID}:${I} in ${FILE}`);
    const reqRaw = AT === '' ? captured.request : atSeamTime(captured.request, Number(AT));
    const req = restoreRequest(reqRaw);
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);

    const deadline = new Set(DEADLINE_SITES);
    const points = [];
    const segs = [];
    const hook = (site, peek) => {
        const t = nowUs();
        points.push({ t, site, deadline: deadline.has(site) });
        if (site === 'done') {
            const s = peek();
            segs.push({ t, name: s?.segment?.name ?? null, outcome: s?.segment?.outcome ?? null, work: s?.budget?.work ?? null,
                asks: s?.budget?.asks ?? null });
        }
    };

    const session = new inspector.Session();
    session.connect();
    await session.post('Profiler.enable');
    await session.post('Profiler.setSamplingInterval', { interval: INTERVAL });
    await session.post('Profiler.start');
    const t0 = nowUs();
    const answer = withSolveProgress(hook, () => solveAnytime({ ...tape, source, levelSource }, { passes }));
    const t1 = nowUs();
    const { profile } = await session.post('Profiler.stop');
    session.disconnect();

    const samples = samplesOf(profile);
    const gaps = gapsOf(points, samples, t0, t1);
    const wallMs = (t1 - t0) / 1000;
    const siteCounts = new Map();
    for (const p of points) siteCounts.set(p.site, (siteCounts.get(p.site) ?? 0) + 1);

    console.log(`PROFILE: request ${ID}:${I} (${captured.key ?? ''}) budget ${req.budgetWork ?? 'none'}${AT === '' ? '' : ` seam.time ${AT}`}`);
    console.log(`ANSWER: ok=${answer.ok} kind=${answer.kind ?? null} work=${answer.work ?? null} wall=${wallMs.toFixed(0)} ms`
        + ` passes=${JSON.stringify((answer.passes ?? []).map((p) => ({ pass: p.pass, kind: p.kind, work: p.work, ms: p.ms, deadline: p.deadline ?? null, limit: p.limit ?? null })))}`);
    if (!answer.ok) console.log(`MESSAGE: ${String(answer.message ?? '').slice(0, 400)}`);
    console.log(`SAMPLES: ${samples.length} at ${INTERVAL} µs; first sample ${((samples[0]?.t ?? t0) - t0) / 1000} ms after start`);
    console.log(`POINTS: ${points.length} (${points.filter((p) => p.deadline).length} at deadline sites)`);
    console.log(`  per site: ${topOf(siteCounts, 40).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    for (const s of segs) console.log(`  segment ${s.name} ${s.outcome ?? ''} work=${JSON.stringify(s.work)}`);
    console.log('GAPS between deadline-site points (ms upper bound: count, total ms, share of wall):');
    for (const r of histogramOf(gaps)) console.log(`  <=${r.ub}: ${r.n} ${r.ms.toFixed(0)} ms ${(100 * r.ms / wallMs).toFixed(1)}%`);
    const long = gaps.filter((g) => g.ms > LONG);
    const longMs = long.reduce((a, g) => a + g.ms, 0);
    console.log(`LONG GAPS (> ${LONG} ms): ${long.length}, ${longMs.toFixed(0)} ms = ${(100 * longMs / wallMs).toFixed(1)}% of the wall`);
    // the long gaps' bounding site pairs
    const pairs = new Map();
    for (const g of long) {
        const k = `${g.from} -> ${g.to}`;
        const r = pairs.get(k) ?? { n: 0, ms: 0 };
        r.n += 1;
        r.ms += g.ms;
        pairs.set(k, r);
    }
    for (const [k, r] of [...pairs].sort((a, b) => b[1].ms - a[1].ms)) console.log(`  ${k}: ${r.n} gap(s), ${r.ms.toFixed(0)} ms`);
    // inclusive functions over the long gaps together
    const longIncl = new Map();
    let longSamples = 0;
    for (const g of long) {
        longSamples += g.samples;
        for (const [k, v] of g.incl) longIncl.set(k, (longIncl.get(k) ?? 0) + v);
    }
    console.log(`LONG-GAP FUNCTIONS (inclusive, of ${longSamples} samples in long gaps):`);
    for (const [k, v] of topOf(longIncl, 30)) console.log(`  ${(100 * v / Math.max(1, longSamples)).toFixed(1)}% ${(v * INTERVAL / 1000).toFixed(0)} ms ${k}`);
    console.log(`TOP ${TOP} GAPS:`);
    for (const g of [...gaps].sort((a, b) => b.ms - a.ms).slice(0, TOP)) {
        console.log(`  #${g.at} ${g.ms.toFixed(0)} ms ${g.from} -> ${g.to}; count points inside: ${topOf(g.counts, 8).map(([k, v]) => `${k}=${v}`).join(' ') || 'none'}`);
        for (const [k, v] of topOf(g.incl, 10)) console.log(`      ${(100 * v / Math.max(1, g.samples)).toFixed(0)}% ${k}`);
    }
    const self = new Map();
    const incl = new Map();
    for (const s of samples) {
        self.set(s.self, (self.get(s.self) ?? 0) + 1);
        for (const k of s.stack) incl.set(k, (incl.get(k) ?? 0) + 1);
    }
    console.log(`WHOLE SOLVE, inclusive (of ${samples.length} samples):`);
    for (const [k, v] of topOf(incl, 30)) console.log(`  ${(100 * v / samples.length).toFixed(1)}% ${(v * INTERVAL / 1000).toFixed(0)} ms ${k}`);
    console.log('WHOLE SOLVE, self:');
    for (const [k, v] of topOf(self, 20)) console.log(`  ${(100 * v / samples.length).toFixed(1)}% ${(v * INTERVAL / 1000).toFixed(0)} ms ${k}`);
    if (FOCUS) {
        const rows = treeUnder(samples, FOCUS, { maxDepth: DEPTH });
        console.log(`TREE under ${FOCUS} (${rows[0]?.n ?? 0} samples; children >= 3%, depth <= ${DEPTH}):`);
        for (const r of rows) console.log(`  ${'  '.repeat(r.depth)}${(100 * r.n / Math.max(1, rows[0].n)).toFixed(1)}% ${(r.n * INTERVAL / 1000).toFixed(0)} ms ${r.key}`);
    }
    if (JSON_OUT) {
        writeFileSync(JSON_OUT, JSON.stringify({ id: ID, i: I, wallMs, answer: { ok: answer.ok, kind: answer.kind ?? null, work: answer.work ?? null },
            siteCounts: Object.fromEntries(siteCounts), segs,
            gaps: gaps.map((g) => ({ at: g.at, from: g.from, to: g.to, ms: g.ms, samples: g.samples, counts: Object.fromEntries(g.counts),
                top: topOf(g.incl, 15) })),
            wholeIncl: topOf(incl, 80), wholeSelf: topOf(self, 40) }));
    }
}

if (isEntryPoint(import.meta.url)) await main();
