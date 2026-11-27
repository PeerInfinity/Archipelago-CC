// MEASUREMENT-ONLY: one captured request through the page's expiry logic (seedlingWasmPlayback.pollSolve's budget branch,
// mirrored): attempt at the request's budget; budgetCut → expiryAction → a held retry at 4x of passesAfter(answered);
// the final pick as pollSolve makes it. Prints each attempt's pass rows and the outcome, plus the shipped plan's hits.
// node page.mjs <jsonl.gz> <id> <i> [perTickShift]   (perTickShift>0: N idle ticks appended to the prefix — a later arrival)
import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib'; import { createHash } from 'node:crypto';
const [file, id, i, shiftArg] = process.argv.slice(2);
const ROOT = '/home/user/Archipelago-CC';
const raw = file.endsWith('.gz') ? gunzipSync(readFileSync(file)).toString() : readFileSync(file, 'utf8');
const row = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const req = row.requests[Number(i)];
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const J = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { expiryAction, SOLVE_RETRY_BUDGET_FACTOR } = await import(`${ROOT}/frontend/modules/seedlingDemo/wasmPlayback.js`);
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12);
const { passes = J.ANYTIME_PASSES, source, ...tape0 } = restoreRequest(req.request);
const levelSource = levelSourceFromAtlas(source.records);
const seamShift = Number(process.env.SEAM_SHIFT ?? 0);
if (seamShift) tape0.staging.seam.time += seamShift;
let tape = { ...tape0, source, levelSource };
const shift = Number(shiftArg ?? 0);
if (shift > 0) {
    const perTick = [...tape.perTick, ...Array.from({ length: shift }, () => new Set())];
    const run = J.replayTape({ staging: tape.staging, perTick, levelSource, equips: tape.equips ?? null, holds: tape.holds ?? null,
        scratchPersistence: tape.scratchPersistence === true });
    tape = { ...tape, perTick, live: J.liveOf(run) };
}
const attempt = (budgetWork, ps) => J.solveAnytime({ ...tape, budgetWork }, { passes: ps });
const { answeredOf } = await import(`${ROOT}/frontend/modules/seedlingDemo/hammerHitPlanRetryRows.js`);
let budget = tape.budgetWork; let ps = passes; let retries = 0; let best = null; const rows = [];
let res = attempt(budget, ps); rows.push({ budget, res });
let outcome = null;
for (;;) {
    if (J.budgetCut(res)) {
        const unanswered = answeredOf(res, ps) < ps.length;
        const action = expiryAction({ provisional: res, retries, unanswered });
        if (action === 'retry') {
            retries += 1;
            if (J.betterAnswer(best, res)) best = res;
            ps = J.passesAfter(ps, answeredOf(res, ps)); budget *= SOLVE_RETRY_BUDGET_FACTOR;
            if (ps.length) { res = attempt(budget, ps); rows.push({ budget, res }); continue; }
        }
        if (action === 'give-up') { outcome = 'FAIL (give-up)'; break; }
        outcome = action === 'provisional' ? 'provisional' : 'retry-empty';
    }
    if (best && !J.betterAnswer(best, res)) res = best;
    outcome = (outcome ? outcome + ' → ' : '') + (res.ok ? 'ship ' + res.pass : 'FAIL (declined)');
    break;
}
for (const r of rows) console.log(`  attempt budget=${r.budget} ok=${r.res.ok} work=${r.res.work} ` + r.res.passes.map((p) => `${p.pass}:${p.ok ? 'ok' : (p.kind ?? '-')}${p.ticks ? '/' + p.ticks + 't' : ''}/w${p.work ?? '?'}${p.limit ? '/' + p.limit : ''}${p.cut ? '/cut=' + p.cut : ''}${p.modelHits ? '/h' + p.modelHits.hits : ''}`).join(' '));
let tail = '';
if (res.ok) {
    const run = J.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips ?? null, holds: tape.holds ?? null,
        scratchPersistence: tape.scratchPersistence === true });
    const h0 = run.playerHits.length; const d0 = run.playerDeaths.length;
    for (const [k, held] of res.plan.solution.entries()) { const slot = res.plan.equipsAt?.get(k); if (slot !== undefined) run.equipNow(slot); run.advance(held); }
    const hits = run.playerHits.slice(h0).map((h) => `t${h.t} ${h.source}:${h.id}`);
    tail = ` ticks=${res.plan.solution.length} hits=${hits.length} deaths=${run.playerDeaths.length - d0} ${JSON.stringify(hits)} answer=${(shift || seamShift) ? '' : sha(JSON.stringify(res.plan.solution.map((k) => [...k])))}`;
}
console.log(`PAGE ${id}:${i} seam=${tape.staging.seam?.time} shift=${seamShift} retries=${retries} ${outcome}${tail}`);
