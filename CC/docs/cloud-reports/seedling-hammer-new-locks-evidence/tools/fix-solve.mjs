// scratch (NEW-LOCKS): solve one fixture or one captured request as the worker does (`solveAnytime`, the request's
// own passes and budgets), under the env's switches; print ok/ticks/planSha/work/message. Measure only.
// Usage: node fix-solve.mjs <fixture.json.gz | requests.jsonl> [id] [i]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const ROOT = process.env.ROOT ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const JR = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [file, id, i] = process.argv.slice(2);
let cap;
if (file.endsWith('.gz')) cap = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')).requests[0];
else cap = readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse).find((r) => String(r.id) === id).requests.find((c) => String(c.i) === String(i ?? 0));
const req = restoreRequest(cap.request);
const { passes = JR.ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const t0 = Date.now();
const a = JR.solveAnytime({ ...tape, source, levelSource }, { passes });
const text = a.ok ? JSON.stringify(a.plan.solution.map((k) => [...k])) : String(a.message ?? '');
let hits = null; let scratch = null;
if (a.ok) {
    const fresh = JR.replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...a.plan.solution], levelSource, scratchPersistence: tape.scratchPersistence });
    hits = fresh.ledger('playerHits').length; scratch = fresh.scratchClears.map((c) => `${c.level}:${c.tag}@${c.at}:${c.lock}`);
}
console.log(JSON.stringify({ ok: a.ok, ticks: a.ok ? a.plan.solution.length : null, sha: createHash('sha1').update(text).digest('hex').slice(0, 12), work: a.work ?? null, budget: tape.budgetWork ?? null, passes: (a.passes ?? []).map((p) => `${p.pass}:${p.ok ? 'ok' : p.kind}:${p.work}`), hits, scratch, verbs: a.ok ? a.plan.verbs : null, ms: Date.now() - t0, msg: a.ok ? null : text.slice(0, Number(process.env.MSG ?? 300)) }));
