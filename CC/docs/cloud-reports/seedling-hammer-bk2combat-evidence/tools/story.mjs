// scratch (BK2COMBAT: equips read from e.equips — the scratch SCRATCH_EQUIPS=1 hook in refuse(); + chaser ids; from POCKET-BURN)
// scratch (POCKET-BURN): one captured request (--id, --i) solved ONCE (dashless, no deadline) under the env's switches; a
// refusal's spent ticks (with its slot selections — needs the scratch SCRATCH_EQUIPS=1 hook) are replayed on a FRESH run of
// the request's staging, and the story printed: trees burnt, activators opened, chasers/spinners/turret removed, hits,
// deaths, position every 100 ticks. Decides nothing. Usage: SCRATCH_EQUIPS=1 node story.mjs --requests=<jsonl> --id=N --i=K
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const { solveFromTape, replayTape } = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const SB = await import(ROOT + '/frontend/modules/seedlingDemo/solverBot.js');
let req = null;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    if (String(row.id) !== args.id) continue;
    req = restoreRequest(row.requests.find((c) => String(c.i) === args.i).request);
}
const { passes, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
let perTick = null; let equips = []; let msg = 'SOLVED';
try {
    const plan = solveFromTape({ ...tape, levelSource, dashMode: args.dash ?? 'none' });
    perTick = [...tape.perTick, ...plan.solution];
    equips = [...(plan.equipsAt ?? new Map())].map(([k, slot]) => ({ t: tape.perTick.length + k, slot }));
} catch (e) {
    if (!(e instanceof SB.SolverRefusal)) throw e;
    msg = 'REFUSED: ' + e.message.slice(0, 600);
    perTick = e.perTick; equips = e.equips ?? [];
}
console.log(msg);
const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
    scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
const eq = new Map(equips.map((q) => [q.t, q.slot]));
const snap = () => ({
    burnt: [...(run.entities('burnedTrees') ?? [])].sort().join(','),
    open: [...run.entities('openActivators')].sort().join(','),
    chasers: run.entities('chasers').map((c) => c.id ?? c).sort().join(','),
    hits: run.playerHits.length, deaths: run.playerDeaths.length });
let last = snap();
console.log(`t${run.ticksCompleted} start (${run.state.x.toFixed(0)},${run.state.y.toFixed(0)})`, JSON.stringify(last));
for (let k = tape.perTick.length; k < perTick.length; k += 1) {
    if (eq.has(run.ticksCompleted)) run.equipNow(eq.get(run.ticksCompleted));
    run.advance(perTick[k]);
    const s = snap();
    for (const f of Object.keys(s)) if (s[f] !== last[f]) console.log(`t${run.ticksCompleted} (${run.state.x.toFixed(0)},${run.state.y.toFixed(0)}) ${f}: ${last[f]} -> ${s[f]}`);
    last = s;
    if (run.ticksCompleted % 200 === 0) console.log(`t${run.ticksCompleted} at (${run.state.x.toFixed(0)},${run.state.y.toFixed(0)})`);
}
console.log('END', run.ticksCompleted, 'hits', JSON.stringify(run.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id }))),
    'collected', JSON.stringify(run.ledger('collected').map((c) => ({ t: c.t, keyType: c.keyType ?? c.tag ?? null }))));
