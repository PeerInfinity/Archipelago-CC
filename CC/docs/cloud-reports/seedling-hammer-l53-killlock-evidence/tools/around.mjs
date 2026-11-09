// MEASUREMENT ONLY (L53-KILLLOCK): one captured request (--id, --i) solved as the worker solves it (`solveAnytime`
// with the request's own budget and passes), the plan replayed on a fresh run, and the model's rows printed for
// ticks [--from, --to]: the player, every live chaser (position, hits, i-frame, dying), the hits ledger.
// Usage: [ENV...] node around.mjs --requests=<jsonl> --id=N --i=K --from=T0 --to=T1
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const JR = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
let req = null;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    if (String(row.id) !== String(args.id)) continue;
    req = restoreRequest(row.requests.find((c) => String(c.i) === String(args.i)).request);
}
const { passes = JR.ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const answer = JR.solveAnytime({ ...tape, source, levelSource }, { passes });
if (!answer.ok) { console.log('REFUSED', String(answer.message).slice(0, 600)); process.exit(0); }
const sol = answer.plan.solution;
console.log(`SOLVED ${sol.length} t, pass ${answer.plan.pass ?? '?'}, verbs ${JSON.stringify(answer.plan.verbs)}, sha ${createHash('sha1').update(JSON.stringify(sol.map((k) => [...k]))).digest('hex').slice(0, 12)}`);
const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true,
    equips: tape.equips ?? null, holds: tape.holds ?? null });
const from = Number(args.from ?? 0); const to = Number(args.to ?? sol.length);
const h0 = run.playerHits.length;
for (let k = 0; k < sol.length && k <= to; k += 1) {
    const slot = answer.plan.equipsAt?.get?.(k);
    if (slot !== undefined) run.equipNow(slot);
    if (k >= from) {
        const cs = (run.entities('chasers') ?? []).filter((c) => !c.removed)
            .map((c) => `${c.id.split('@')[0][0]}${c.id.split('@')[1]}:(${c.x.toFixed(1)},${c.y.toFixed(1)}) h${c.hits} i${c.hitsTimer}${c.dying ? ' D' : ''} d${Math.hypot(c.x - run.state.x, c.y - run.state.y).toFixed(1)}`);
        console.log(`t${k} p(${run.state.x.toFixed(2)},${run.state.y.toFixed(2)}) keys[${[...sol[k]].join('+')}] ${cs.join(' | ')}`);
    }
    run.advance(sol[k]);
}
console.log('model hits', JSON.stringify(run.playerHits.slice(h0)));
