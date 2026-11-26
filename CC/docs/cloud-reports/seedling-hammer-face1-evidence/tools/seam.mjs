// FACE 1: one captured page request (re-measure-6 A1 26:8 / 26:9, cut to req/A1-26-<i>.json.gz) re-stamped to an arrival
// clock, solved by the worker's dispatch (`solveAnytime`, the request's own budgets and passes, or --budget=<work>) at the
// switches the process env sets (SEEDLING_*=1 on, =0 off); a solved plan replayed on a fresh run and its hits counted.
// (L40-CORNER / L40-PAIR's seam.mjs, reading the capture format instead of a fixture.)
//   node seam.mjs --req=<file.json.gz> [--seam=<clock>] [--budget=<work>] [--plan=<out.json>] [--full]  → one JSON line
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
const R = process.env.REPO || process.cwd();
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
const M = (p) => import(join(R, 'frontend/modules/seedlingDemo', p));
const { restoreRequest } = await import(join(R, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await M('atlasSource.js');
const JR = await M('jsRuntimeSolver.js');
// --cf=<key,key>: CONTACT_FIDELITY keys set ON over the defaults (only those keys; the rest keep their defaults)
const CF = (await M('contactFidelity.js')).CONTACT_FIDELITY;
const cfOn = arg('cf') ? arg('cf').split(',') : [];
for (const k of cfOn) { if (!(k in CF)) throw new Error(`no CONTACT_FIDELITY key ${k}`); CF[k] = true; }
const cap = JSON.parse(gunzipSync(readFileSync(arg('req'))).toString('utf8'));
const c0 = cap.request;
const seam = arg('seam') === null ? c0.staging.seam.time : Number(arg('seam'));
const { passes = JR.ANYTIME_PASSES, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest({ ...c0,
    staging: { ...c0.staging, seam: { ...c0.staging.seam, time: seam } } });
const budget = arg('budget') === null ? budgetWork : Number(arg('budget'));
// --wait=<W>: the arrival idles W ticks (no keys) before the solve's segment starts: `perTick` gains W empty key sets,
// so the solver's segment starts at tick W with every body where the room's own update put it. The plan is the W idle
// ticks followed by the segment's keys (`hits` counts both).
const wait = Number(arg('wait') ?? 0);
if (wait > 0) {
    if ((tape.perTick ?? []).length !== 0) throw new Error('--wait needs a request with an empty perTick');
    tape.perTick = Array.from({ length: wait }, () => new Set());
}
const levelSource = levelSourceFromAtlas(source.records);
if (wait > 0) {
    // the live digest is the arrival's: re-take it at tick W off a replay of the idle ticks (the page would hold it there)
    const idle = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    if (idle.playerHits.length > 0) throw new Error(`the idle wait itself is hit: ${idle.playerHits.map((h) => `${h.t}:${h.id}`)}`);
    tape.live = JR.liveOf(idle);
}
const on = [...Object.keys(process.env).filter((k) => k.startsWith('SEEDLING_')).sort().map((k) => `${k.slice(9)}=${process.env[k]}`), ...cfOn.map((k) => `cf.${k}`)];
const t0 = Date.now();
const ans = JR.solveAnytime({ ...tape, source, budgetWork: budget, upgradeWindowWork, levelSource }, { passes });
const text = ans.ok ? JSON.stringify(ans.plan.solution.map((k) => [...k])) : String(ans.message ?? '');
const r = { req: `${cap.id}:${cap.i}`, seam, wait, d: seam - c0.staging.seam.time, on, ok: ans.ok, ms: Date.now() - t0,
    work: ans.work ?? null, budget, answer: createHash('sha1').update(text).digest('hex').slice(0, 12),
    passes: (ans.passes ?? []).map((p) => `${p.pass}:${p.ok ? p.ticks : (p.kind ?? 'no')}${p.work ? `@${p.work}` : ''}`) };
if (ans.ok) {
    const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const h0 = wait > 0 ? 0 : run.playerHits.length;
    for (let k = 0; k < ans.plan.solution.length; k += 1) {
        const slot = ans.plan.equipsAt?.get?.(k); if (slot !== undefined) run.equipNow(slot);
        run.advance(ans.plan.solution[k]);
    }
    Object.assign(r, { ticks: ans.plan.solution.length, verbs: ans.plan.verbs,
        sha: createHash('sha256').update(JSON.stringify(ans.plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12),
        hits: run.playerHits.slice(h0).map((h) => `${h.t}:${h.id}`), deaths: run.playerDeaths.length,
        end: [run.level, +run.state.x.toFixed(2), +run.state.y.toFixed(2)],
        clears: (run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`).sort() });
    if (arg('plan')) writeFileSync(arg('plan'), JSON.stringify({ staging: tape.staging,
        keys: ans.plan.solution.map((k) => [...k]), equipsAt: [...(ans.plan.equipsAt ?? [])] }));
} else {
    r.kind = ans.kind ?? null; r.code = ans.code ?? null;
    r.message = process.argv.includes('--full') ? text : text.slice(0, 600);
}
console.log(JSON.stringify(r));
