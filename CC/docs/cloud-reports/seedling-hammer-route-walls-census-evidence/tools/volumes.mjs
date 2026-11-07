// scratch (ROUTE-WALLS-CENSUS): one captured request's arrival — its danger volumes, an ASCII map of the planner's
// walkable lattice (16 px) with them overlaid, and which volume SETS, removed, admit a corridor to --aim (the chooser's
// own question, `plansReach` under `extraVolumes` minus the set; every volume kind, not only chasers). Measure only.
// Usage: node volumes.mjs --requests=<jsonl> --id=N --i=K --aim=x,y [--box=x0,y0,x1,y1] [--contacts=a;b] [--root=…]
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const JR = await import(M + 'jsRuntimeSolver.js');
const SB = await import(M + 'solverBot.js');
const DM = await import(M + 'dangerMap.js');
const BD = await import(M + 'botDriverV2.js');
let req = null;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    if (String(row.id) !== String(args.id)) continue;
    req = restoreRequest(row.requests.find((c) => String(c.i) === String(args.i)).request);
}
const { source, ...tape } = req;
const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
    scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
const CONTACTS = new Set((args.contacts ?? '').split(';').filter(Boolean));
const [ax, ay] = args.aim.split(',').map(Number);
const aim = { x: ax, y: ay };
console.log(`level ${run.level} player (${run.state.x},${run.state.y}) tick ${run.ticksCompleted} aim (${ax},${ay})`);
for (const c of (run.entities('chasers') ?? [])) console.log(`  chaser ${c.id} at (${c.x?.toFixed?.(1)},${c.y?.toFixed?.(1)})`);
const vols = DM.dangerVolumes(run, 0);
console.log(`volumes: ${vols.length}`);
for (const v of vols) console.log(`  ${v.id} ${JSON.stringify(v.rect)} ${String(v.why ?? '').slice(0, 90)}`);
const planOpts = (without) => SB.solverPlanOpts(run, CONTACTS, { extraVolumes: vols.filter((v) => !without.includes(v.id)) });
const admits = (without) => {
    const opts = planOpts(without);
    try { BD.planWaypoints(run.world, run.state, aim, null, opts); return true; } catch (e) { return `no (${String(e.message).slice(0, 140)})`; }
};
console.log(`admits, nothing removed: ${admits([])}`);
console.log(`admits, every volume removed: ${admits(vols.map((v) => v.id))}`);
const ids = [...new Set(vols.map((v) => v.id))];
for (let k = 1; k <= Math.min(3, ids.length); k += 1) {
    const found = [];
    const rec = (s, acc) => { if (acc.length === k) { if (admits(acc) === true) found.push(acc.join(' + ')); return; }
        for (let i = s; i < ids.length; i += 1) rec(i + 1, [...acc, ids[i]]); };
    rec(0, []);
    console.log(`size ${k}: ${found.length ? found.join(' | ') : 'none admits'}`);
    if (found.length) break;
}
const [x0, y0, x1, y1] = (args.box ?? '0,0,320,240').split(',').map(Number);
const letters = {}; const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
for (const v of vols) letters[v.id] ??= L[Object.keys(letters).length % 26];
const o0 = SB.solverPlanOpts(run, CONTACTS, {});
console.log('legend: # not walkable; letter = walkable but inside that volume; . walkable; @ player; * aim');
for (const [id, l] of Object.entries(letters)) console.log(`  ${l} = ${id}`);
for (let y = y0; y < y1; y += 16) {
    let line = `${String(y).padStart(4)}  `;
    for (let x = x0; x < x1; x += 16) {
        const tx = Math.floor(x / 16); const ty = Math.floor(y / 16); const cx = tx * 16 + 8; const cy = ty * 16 + 8;
        let ch = BD.isWalkableTile(run.world, tx, ty, null, o0) ? '.' : '#';
        if (ch === '.') { const v = vols.find((vv) => cx >= vv.rect.x && cx < vv.rect.x + vv.rect.w && cy >= vv.rect.y && cy < vv.rect.y + vv.rect.h); if (v) ch = letters[v.id].toLowerCase(); }
        if (Math.floor(run.state.x / 16) === tx && Math.floor(run.state.y / 16) === ty) ch = '@';
        if (Math.floor(ax / 16) === tx && Math.floor(ay / 16) === ty) ch = '*';
        line += ch;
    }
    console.log(line);
}
