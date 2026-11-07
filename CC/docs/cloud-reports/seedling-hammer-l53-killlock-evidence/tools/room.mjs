// scratch (L53-KILLLOCK W0): one captured request's arrival room — tile types (W water, # solid, . floor, other
// letters by id), the live chaser roster, the activators. Measure only.
// Usage: node room.mjs --requests=<jsonl> --id=N --i=K [--box=x0,y0,x1,y1]
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const JR = await import(M + 'jsRuntimeSolver.js');
let req = null;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    if (String(row.id) !== String(args.id)) continue;
    req = restoreRequest(row.requests.find((c) => String(c.i) === String(args.i)).request);
}
const { source, ...tape } = req;
const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
    scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
const w = run.world;
console.log(`level ${run.level} ${w.width}x${w.height} player (${run.state.x},${run.state.y}) tick ${run.ticksCompleted}`);
for (const c of run.entities('chasers') ?? []) console.log(`  chaser ${c.id} (${c.x.toFixed(1)},${c.y.toFixed(1)})`);
for (const a of w.activators ?? []) console.log(`  activator ${a.id} ${a.tag ?? ''}`);
const [x0, y0, x1, y1] = (args.box ?? `0,0,${w.width * 16},${w.height * 16}`).split(',').map(Number);
const CH = { 0: '.', 1: 'W', 2: '#', 3: 'b', 4: 'd', 6: 'P', 9: '#', 11: '#', 14: '#', 15: '#', 17: 'L', 19: '#', 20: '#', 23: '#', 24: '#', 25: 'F', 27: '#', 29: '=', 34: '#', 35: '#', 36: '#' };
let head = '      ';
for (let x = x0; x < x1; x += 16) head += String(Math.floor(x / 16) % 10);
console.log(head);
for (let y = y0; y < y1; y += 16) {
    let line = `${String(y).padStart(4)}  `;
    for (let x = x0; x < x1; x += 16) {
        const t = w.nearestWalkableTile(x + 8, y + 8, { beforeTypeFlip: true });
        const own = t && t.x === x + 8 && t.y === y + 8 ? t.t : (t && Math.floor(t.x / 16) === x / 16 && Math.floor(t.y / 16) === y / 16 ? t.t : null);
        line += own === null ? '?' : (CH[own] ?? String.fromCharCode(97 + (own % 26)));
    }
    console.log(line);
}
