// scratch (BK2COMBAT): one captured request (--id, --i) solved ONCE (solveFromTape, --dash=none default) under the env;
// prints the verdict, the refusal's kill/bait rows (arm, target, stance) and its spent-tick count. Decides nothing.
// Usage: node reqrows.mjs --requests=<jsonl> --id=N --i=K [--budget=<work>]
import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const { solveFromTape } = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const SB = await import(ROOT + '/frontend/modules/seedlingDemo/solverBot.js');
let req = null;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    if (String(row.id) !== args.id) continue;
    req = restoreRequest(row.requests.find((c) => String(c.i) === args.i).request);
}
const { passes, source, ...tape } = req;
const t0 = Date.now();
let o;
try {
    const plan = solveFromTape({ ...tape, levelSource: levelSourceFromAtlas(source.records), dashMode: args.dash ?? 'none' });
    console.log('SOLVED', plan.solution.length, 'ms', Date.now() - t0);
    o = plan;
    if (args.out) writeFileSync(args.out, JSON.stringify({ solution: plan.solution.map((k) => [...k]) }));
} catch (e) {
    if (!(e instanceof SB.SolverRefusal)) throw e;
    console.log('REFUSED ms', Date.now() - t0, String(e.message).slice(0, +(args.len ?? 1500)));
    console.log('perTick', e.perTick?.length, 'prefix', tape.perTick.length, 'obstacle', JSON.stringify(e.obstacle ?? null));
    o = e;
}
for (const r of o.rows ?? o.trace?.rows ?? []) {
    if (r.strategy && /kill|bait/.test(r.strategy.verb)) console.log('ROW', r.tick, r.strategy.verb, r.obstacle?.id, JSON.stringify(r.strategy).slice(0, 260));
    else if (r.strategy && r.strategy.verb !== 'walk' && !/time/.test(r.strategy.verb)) console.log('ROW', r.tick, r.strategy.verb, r.obstacle?.id);
}
for (const r of o.records ?? []) if (r.strategy && r.strategy !== 'walk') console.log('REC', JSON.stringify(r).slice(0, 400));
