// LB D1 (measure only) — one captured (or rebuilt) solve request, replayed as the worker does it (`solveAnytime`), with
// a recording progress hook: the work units by site (`budget.asks` at each segment's `done`), the wall between hook
// calls by the site that opened the gap, the deadline asks by the frame's target/stance (--frames), each segment's
// tree rejection kinds and lastWhy, and optionally a CPU profile (--cpu=<out.cpuprofile>) with inclusive shares.
//
//   node lb-prof.mjs --requests=<jsonl> --id=414 [--i=0] [--seam=<abs>|--dseam=<d>] [--budget=<units>] [--window=<units>]
//   node lb-prof.mjs --rebuild397 [--seam=5129] …        (397: 414's request re-staged at boot (40,480,896))
//   [--frames] [--cpu=<file>] [--out=<json>]
// ⛔ --budget / --window change only the REQUEST's `budgetWork` / `upgradeWindowWork` (a diagnostic). No default moves.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Session } from 'node:inspector/promises';

const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const M = join(REPO, 'frontend/modules/seedlingDemo');
const arg = (n, f = null) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const has = (n) => process.argv.includes(`--${n}`);
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 8);

const { restoreRequest } = await import(join(REPO, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await import(join(M, 'atlasSource.js'));
const { solveAnytime, ANYTIME_PASSES, liveOf } = await import(join(M, 'jsRuntimeSolver.js'));
const { withSolveProgress } = await import(join(M, 'solveProgress.js'));

const file = arg('requests', join(REPO, 'CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/input/requests-414.jsonl'));
const line = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .find((r) => String(r.id) === arg('id', '414'));
let captured = line.requests.find((r) => String(r.i) === arg('i', '0')).request;
let req = restoreRequest(captured);
const { passes = ANYTIME_PASSES, source, ...tape0 } = req;
const levelSource = levelSourceFromAtlas(source.records);
let tape = tape0;
let seamTime = tape.staging.seam.time;
if (arg('seam') !== null) seamTime = Number(arg('seam'));
if (arg('dseam') !== null) seamTime += Number(arg('dseam'));
let staging = { ...tape.staging, seam: { ...tape.staging.seam, time: seamTime } };
let what = `${line.id}/i${arg('i', '0')}`;
if (has('rebuild397')) {
    // ⚠ a REBUILD: 397's leg arrives at (480,896) from L39 (its row's `arrive`); everything else is 414's request
    staging = { ...staging, boot: { level: 40, x: 480, y: 896 } };
    what = `397(rebuilt)/i${arg('i', '0')}`;
}
let live = tape.live;
if (has('rebuild397') || arg('seam') !== null || arg('dseam') !== null) {
    if (has('rebuild397')) {
        const { replayTape } = await import(join(M, 'jsRuntimeSolver.js'));
        const shadow = replayTape({ staging, perTick: [], levelSource, scratchPersistence: tape.scratchPersistence, equips: tape.equips });
        live = liveOf(shadow);
    }
}
tape = { ...tape, staging, live };
if (arg('budget') !== null) tape.budgetWork = Number(arg('budget'));
if (arg('window') !== null) tape.upgradeWindowWork = Number(arg('window'));

const us = () => Number(process.hrtime.bigint() / 1000n);
const sites = {};
const wallAfter = {};
const pairs = {};
const askBy = {};
const segs = [];
let prev = ['start', us()];
let points = 0;
const frames = has('frames');
const POINTS = new Set(['segment', 'goal', 'walk', 'verb', 'climb', 'rung', 'arm', 'search', 'preview', 'heartbeat', 'done']);
const hook = (site, peek) => {
    const t = us();
    points += 1;
    sites[site] = (sites[site] ?? 0) + 1;
    wallAfter[prev[0]] = (wallAfter[prev[0]] ?? 0) + (t - prev[1]);
    const pk = `${prev[0]}→${site}`;
    pairs[pk] ??= { n: 0, us: 0, max: 0 };
    pairs[pk].n += 1; pairs[pk].us += t - prev[1]; pairs[pk].max = Math.max(pairs[pk].max, t - prev[1]);
    if (frames && !POINTS.has(site)) {
        const f = peek()?.frame;
        const k = `${site} | ${f?.target ?? '-'} @ ${f?.stance ? f.stance.join(',') : '-'} | ${f?.key?.split('/').slice(-2).join('/') ?? '-'}`;
        askBy[k] = (askBy[k] ?? 0) + 1;
    }
    if (site === 'done') {
        const s = peek();
        if (s) {
            const kinds = {};
            const roles = {};
            const walk = (n) => {
                for (const [k, v] of Object.entries(n.rejectionKinds)) kinds[k] = (kinds[k] ?? 0) + v;
                roles[n.role] = (roles[n.role] ?? 0) + n.attempts;
                n.children.forEach(walk);
            };
            walk(s.tree);
            // --other: every node holding an `other`-kind rejection, with its reason keys (for PR)
            const others = [];
            const scan = (n) => { if (n.rejectionKinds.other) others.push({ key: n.key, rejections: n.rejections }); n.children.forEach(scan); };
            if (has('other')) scan(s.tree);
            segs.push({ ...(has('other') ? { others } : {}), name: s.segment.name, level: s.segment.level, outcome: s.segment.outcome, asks: s.budget.asks,
                work: s.budget.work, rejectionKinds: kinds, attemptsByRole: roles, lastWhy: s.lastWhy, heartbeat: s.heartbeat ?? null,
                topNodes: topNodes(s.tree) });
        }
    }
    prev = [site, us()];
};
function topNodes(tree) {
    const out = [];
    const walk = (n) => { out.push({ key: n.key, attempts: n.attempts, rej: Object.values(n.rejections).reduce((a, b) => a + b, 0) }); n.children.forEach(walk); };
    walk(tree);
    return out.sort((a, b) => b.attempts - a.attempts).slice(0, 25);
}

let session = null;
if (arg('cpu')) {
    session = new Session();
    session.connect();
    await session.post('Profiler.enable');
    await session.post('Profiler.setSamplingInterval', { interval: 500 });
    await session.post('Profiler.start');
}
const t0 = us();
let answer;
let threw = null;
try {
    answer = withSolveProgress(hook, () => solveAnytime({ ...tape, source, levelSource }, { passes }));
} catch (e) { threw = String(e?.stack ?? e).slice(0, 2000); }
const t1 = us();
let cpu = null;
if (session) {
    const { profile } = await session.post('Profiler.stop');
    writeFileSync(arg('cpu'), JSON.stringify(profile));
    cpu = inclusive(profile);
}
function inclusive(profile) {
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const parent = new Map();
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    const inc = {};
    const self = {};
    let total = 0;
    for (let i = 0; i < profile.samples.length; i += 1) {
        const dt = profile.timeDeltas[i + 1] ?? 0;
        total += dt;
        const seen = new Set();
        let leaf = true;
        for (let x = profile.samples[i]; x !== undefined; x = parent.get(x)) {
            const f = byId.get(x).callFrame;
            const k = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}`;
            if (leaf) { self[k] = (self[k] ?? 0) + dt; leaf = false; }
            if (seen.has(k)) continue;
            seen.add(k);
            inc[k] = (inc[k] ?? 0) + dt;
        }
    }
    const pct = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => [k, +(100 * v / total).toFixed(1)]));
    return { totalMs: Math.round(total / 1e3), inclusive: pct(inc), self: pct(self) };
}
const text = answer ? (answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : String(answer.message ?? '')) : threw;
const ms = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v / 1e3)]));
const out = {
    what, seamTime, budgetWork: tape.budgetWork, upgradeWindowWork: tape.upgradeWindowWork,
    fidelity: process.env.SEEDLING_CHASER_SPINNER_WALLS === '1' && process.env.SEEDLING_BOMB_BLAST_BODY === '1' ? 'walls+blast' : 'defaults',
    ok: answer?.ok ?? null, kind: answer?.kind ?? (threw ? 'threw' : null), work: answer?.work ?? null,
    ticks: answer?.ok ? answer.plan.solution.length : null, answer: sha(text ?? ''), message: answer?.ok ? 'PLAN' : String(text).slice(0, 700),
    passes: answer?.passes ?? null, wallMs: Math.round((t1 - t0) / 1e3), points, sites,
    wallAfterSiteMs: ms(wallAfter),
    topPairs: Object.fromEntries(Object.entries(pairs).sort((a, b) => b[1].us - a[1].us).slice(0, 15)
        .map(([k, v]) => [k, { n: v.n, ms: Math.round(v.us / 1e3), maxMs: Math.round(v.max / 1e3) }])),
    ...(frames ? { asksByFrame: Object.fromEntries(Object.entries(askBy).sort((a, b) => b[1] - a[1]).slice(0, 40)) } : {}),
    segments: segs, cpu,
};
const json = JSON.stringify(out, null, 1);
if (arg('out')) writeFileSync(arg('out'), json);
console.log(`LB ${out.what} seam=${seamTime} budget=${out.budgetWork} ${out.fidelity}: ${out.kind} work=${out.work} answer=${out.answer} wall=${out.wallMs}ms :: ${String(out.message).slice(0, 220)}`);
