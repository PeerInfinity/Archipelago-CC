// scratch (L40-CENSUS): one captured request (--id, --i) solved under the env's switches with the anytime DEADLINE
// lifted to --cap work units (default 40960), every pass as `solveAnytime` runs them on ONE work clock (the upgrade
// window only with a plan in hand, as there). Instruments (measure-only, nothing tracked is edited):
//   - every work unit: its site and the innermost solver frame of interest (stack attribution);
//   - every trace row the solver records (`seeRow`'s rows, nested solves included), stamped with the work unit it
//     landed at — detected by a scratch Array.prototype.push wrapper for this process only;
//   - the units at which the page's budgets (640, 2560) are crossed, and the last row before each.
// Prints one JSON line (--out appends it). Decides nothing.
// Usage: [ENV...] node chain.mjs --requests=<jsonl> --id=N --i=K [--cap=40960] [--out=<jsonl>] [--arm=<label>]
import { appendFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { atlasLevelSource } = await import(ROOT + '/frontend/modules/seedlingDemo/levelSource.js');
const { atSeamTime } = await import(ROOT + '/scripts/procgen/replay-seedling-solve-request.mjs');
const { gunzipSync } = await import('node:zlib');
const JR = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const CAP = Number(args.cap ?? 40960);
let req = null; let key = null;
{ const w = JSON.parse(gunzipSync(readFileSync(args.fix)).toString()); key = w.leg.key;
  req = restoreRequest(atSeamTime(w.request, Number(args.seam ?? w.seam))); args.id = 376; args.i = Number(args.seam ?? w.seam); }
if (!req) { console.error('no such request'); process.exit(2); }
const { passes = JR.ANYTIME_PASSES, budgetWork: capturedBudget, upgradeWindowWork: windowWork = null, ...tape } = req;
// WHAT-IF (measure only): --persist=40:12,40:0 adds those persistence rows to the request's staging (a flag a
// route that went there first would have banked; the page sweep stages only arrival/goal-rule events).
if (args.persist) {
    const add = args.persist.split(',').map((s) => { const [level, tag] = s.split(':').map(Number); return { level, tag, note: 'census what-if' }; });
    tape.staging = { ...tape.staging, persistence: [...(tape.staging.persistence ?? []), ...add] };
}
const levelSource = atlasLevelSource();
let units = 0;
const rows = [];
const bySite = {}; const byFrame = {};
const marks = {};
const INTEREST = /^(exec\w+|resolve\w+Strategy|derive\w+|staged\w+|climb\w+|prerequisite\w+|stancePrerequisite|walkToUnder|walkTo|holdStance\w*|press\w+|orbit\w+|kill\w+|bait\w+|detour\w*|frontier\w+|solveSegmentUnder|solveSegment|turret\w+|latch\w+|weigh\w+|corpse\w+|chooser\w+|approach\w+)$/;
Error.stackTraceLimit = 200;
const frameOf = () => {
    const st = new Error().stack.split('\n');
    // innermost interesting solver frame, and the outermost exec/resolve frame (the wall being worked)
    let inner = null; let outer = null;
    for (const l of st) {
        const m = /at (?:Object\.|async )?([A-Za-z0-9_$]+) \(.*seedlingDemo\/(\w+)\.js/.exec(l);
        if (!m) continue;
        if (INTEREST.test(m[1])) { inner ??= m[1]; if (/^(exec|resolve|staged|prerequisite)/.test(m[1])) outer = m[1]; }
    }
    return `${outer ?? '-'}>${inner ?? '-'}`;
};
const lastRow = () => rows.length ? rows[rows.length - 1] : null;
const origPush = Array.prototype.push;
const seen = new WeakSet();
// eslint-disable-next-line no-extend-native
Array.prototype.push = function (...xs) {
    if (xs.length === 1) {
        const o = xs[0];
        if (o && typeof o === 'object' && 'saw' in o && 'strategy' in o && 'tick' in o && !seen.has(o)) {
            seen.add(o);
            origPush.call(rows, { u: units, tick: o.tick, verb: o.strategy?.verb ?? null,
                ob: o.obstacle?.id ?? o.strategy?.target ?? o.strategy?.id ?? null });
        }
    }
    return origPush.apply(this, xs);
};
const t0 = Date.now();
let best = null; const passRows = [];
for (const p of passes) {
    const planInHand = best?.ok === true;
    const windowAt = p.stop === 'window' && planInHand ? JR.upgradeWindowWork(CAP, windowWork) : null;
    const w0 = units; const p0 = Date.now();
    const shouldStop = (site) => {
        units += 1;
        bySite[site] = (bySite[site] ?? 0) + 1;
        if (args.frames !== '0') { const f = frameOf(); byFrame[f] = (byFrame[f] ?? 0) + 1; }
        for (const b of [640, 2560, 10240]) if (units === b) marks[b] = { pass: p.pass, ms: Date.now() - t0, row: lastRow() };
        if (units > CAP) return true;
        if (windowAt !== null && units > windowAt) return true;
        return false;
    };
    const answer = JR.settleSolve(() => JR.solveFromTape({ ...tape, levelSource, dashMode: p.dashMode, adds: p.adds ?? null,
        shouldStop, fineCheckpoints: true }));
    passRows.push({ pass: p.pass, ok: answer.ok, kind: answer.kind ?? null, work: units - w0, ms: Date.now() - p0,
        ticks: answer.ok ? answer.plan.solution.length : null, capped: units > CAP });
    if (JR.betterAnswer(best, answer)) best = answer;
    if (answer.kind === 'divergence') { best = answer; break; }
}
Array.prototype.push = origPush;
// 30(c): a SOLVED plan's keys on a FRESH run of the request's staging, row by row against the plan's expected rows;
// its hits and deaths (BK2COMBAT's arms.mjs `modelled`, copied).
const rowOf = (run) => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
const same = (a, b) => a.level === b.level && a.x === b.x && a.y === b.y && a.deaths === b.deaths;
function modelled(plan) {
    const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: atlasLevelSource(),
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const hits0 = run.playerHits.length; const deaths0 = run.playerDeaths.length;
    if (!same(rowOf(run), plan.expected[0])) return { gm: false, at: -1, why: 'prefix row differs' };
    for (let k = 0; k < plan.solution.length; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(plan.solution[k]);
        const want = plan.expected[k + 1];
        if (want && !same(rowOf(run), want)) return { gm: false, at: k, why: `row ${JSON.stringify(rowOf(run))} != ${JSON.stringify(want)}` };
    }
    const hits = run.playerHits.slice(hits0).map((h) => ({ t: h.t, source: h.source, id: h.id }));
    return { gm: run.playerDeaths.length === deaths0, hits, deaths: run.playerDeaths.length - deaths0 };
}
let gm = null;
if (best.ok) { try { gm = modelled(best.plan); } catch (e) { gm = { gm: false, why: `THREW ${e?.message ?? e}` }; } }
const msg = best.ok ? null : best.message;
const out = { id: Number(args.id), key, i: Number(args.i), arm: args.arm ?? 'D0', persist: args.persist ?? null, cap: CAP, capturedBudget,
    ok: best.ok, gm, verbs: best.ok ? best.plan.verbs : null, ticks: best.ok ? best.plan.solution.length : null, work: units, ms: Date.now() - t0, passes: passRows,
    digest: createHash('md5').update(best.ok ? JSON.stringify(best.plan.solution.map((k) => [...k])) : msg).digest('hex').slice(0, 12),
    head: msg ? msg.slice(0, 4000) : null, marks, bySite, byFrame, rows };
if (args.out) appendFileSync(args.out, JSON.stringify(out) + '\n');
console.log(`${args.id}/${args.i} ${args.arm ?? 'D0'} ${out.ok ? `SOLVED ${out.ticks} gm=${JSON.stringify(gm)}` : 'REFUSED'} work=${units} ms=${out.ms} passes=${JSON.stringify(passRows)}`);
if (msg) console.log(msg.slice(0, 1200));
