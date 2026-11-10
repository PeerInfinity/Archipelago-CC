// scratch: tile-type map of a captured request's room (nearestWalkableTile t), drills overlaid.
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = '/home/user/Archipelago-CC'; const M = ROOT + '/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const JR = await import(M + 'jsRuntimeSolver.js');
let req = null;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
  const row = JSON.parse(line); if (String(row.id) !== String(args.id)) continue;
  req = restoreRequest(row.requests[Number(args.i ?? 0)].request);
}
const { source, ...tape } = req;
const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
  scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
console.log('level', run.level, 'player', run.state.x, run.state.y);
const w = run.world;
const W = (w.width ?? 20) * 16, H = (w.height ?? 15) * 16;
const sym = (t) => (t === undefined ? '?' : t === 1 ? '~' : t === 17 ? 'L' : t === 6 ? 'O' : null);
for (let y = 8; y < H; y += 16) {
  let s = String(y - 8).padStart(4) + ' ';
  for (let x = 8; x < W; x += 16) {
    const tile = w.nearestWalkableTile(x, y);
    const solid = w.isSolidAt ? w.isSolidAt(x, y) : null;
    const t = tile?.t; const near = tile && Math.floor(tile.x / 16) === Math.floor(x / 16) && Math.floor(tile.y / 16) === Math.floor(y / 16);
    s += near ? (sym(t) ?? (t === 0 ? '.' : String(t % 10))) : '#';
  }
  console.log(s);
}
console.log('drills', JSON.stringify([...(run.entities('drillBodies') ?? [])].map((d) => [d.id, d.x, d.y])));
