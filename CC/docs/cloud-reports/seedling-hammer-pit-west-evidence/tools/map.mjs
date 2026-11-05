// scratch (PIT-WEST W0): the L40 arrival of a captured request — an ASCII map of the planner's walkable lattice
// (16 px) with the danger volumes overlaid, the live chaser roster (leash, speed), and which removal SETS of chasers
// admit a corridor to the aim (the chooser's own question, `plansReach` under `extraVolumes` minus the set).
// Measure only. Usage: node map.mjs --requests=<jsonl> --id=N --i=K --aim=x,y [--box=x0,y0,x1,y1] [--sets=1]
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
const { ENEMY_CLASSES } = await import(M + 'combat.js').catch(() => ({ ENEMY_CLASSES: {} }));
let req = null;
for (const line of readFileSync(args.requests, 'utf8').trim().split('\n')) {
    const row = JSON.parse(line);
    if (String(row.id) !== String(args.id)) continue;
    req = restoreRequest(row.requests.find((c) => String(c.i) === String(args.i)).request);
}
const { source, ...tape } = req;
const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
    scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
const CONTACTS = new Set((args.contacts ?? 'proximity-hazard:iceturret@472,400').split(';').filter(Boolean));
const [ax, ay] = (args.aim ?? '392,456').split(',').map(Number);
const aim = { x: ax, y: ay };
console.log(`level ${run.level} player (${run.state.x},${run.state.y}) tick ${run.ticksCompleted} aim (${ax},${ay})`);
const chasers = [...(run.entities('chasers') ?? [])];
for (const c of chasers) {
    const row = ENEMY_CLASSES[c.tag] ?? {};
    console.log(`  chaser ${c.id} at (${c.x?.toFixed?.(1)},${c.y?.toFixed?.(1)}) speed ${row.speed} leash ${row.leash ?? row.chaseRadius ?? '?'} pad ${row.threatPad ?? 0}`);
}
for (const b of (run.entities('spinnerBodies') ?? [])) console.log(`  spinner ${b.id} at (${b.x},${b.y})`);
const vols = DM.dangerVolumes(run, 0);
console.log(`volumes: ${vols.length}`);
for (const v of vols) console.log(`  ${v.id} ${JSON.stringify(v.rect)} ${v.why.slice(0, 60)}`);
const planOpts = (without) => SB.solverPlanOpts(run, CONTACTS, { allowPit: { tx: Math.floor(ax / 16), ty: Math.floor(ay / 16) },
    extraVolumes: vols.filter((v) => !without.includes(v.id)) });
const admits = (without) => {
    const opts = planOpts(without);
    const reach = BD.plansReach(run.world, null, opts);
    if (reach) return reach.from(run.state)(aim);
    try { BD.planWaypoints(run.world, run.state, aim, null, opts); return true; } catch { return false; }
};
console.log(`admits with nothing removed: ${admits([])}; with every chaser removed: ${admits(chasers.map((c) => c.id))}`);
// map
const [x0, y0, x1, y1] = (args.box ?? '64,368,560,928').split(',').map(Number);
const letters = {};
const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
vols.forEach((v, i) => { letters[v.id] ??= L[Object.keys(letters).length % 26]; });
const o0 = SB.solverPlanOpts(run, CONTACTS, {});
const oV = planOpts([]);
console.log('legend: # not walkable (no volumes); letter = walkable but inside that volume; . walkable; @ player; * aim');
for (const [id, l] of Object.entries(letters)) console.log(`  ${l} = ${id}`);
let head = '      ';
for (let x = x0; x < x1; x += 16) head += String(Math.floor(x / 16) % 100).padStart(2, ' ').slice(-1);
console.log(head);
for (let y = y0; y < y1; y += 16) {
    let line = `${String(y).padStart(4)}  `;
    for (let x = x0; x < x1; x += 16) {
        const tx = Math.floor(x / 16); const ty = Math.floor(y / 16);
        const cx = tx * 16 + 8; const cy = ty * 16 + 8;
        let ch = BD.isWalkableTile(run.world, tx, ty, null, o0) ? '.' : '#';
        if (ch === '.') {
            const v = vols.find((vv) => cx >= vv.rect.x && cx < vv.rect.x + vv.rect.w && cy >= vv.rect.y && cy < vv.rect.y + vv.rect.h);
            if (v) ch = letters[v.id].toLowerCase();
            else if (!BD.isWalkableTile(run.world, tx, ty, null, oV)) ch = ',';
        }
        if (Math.floor(run.state.x / 16) === tx && Math.floor(run.state.y / 16) === ty) ch = '@';
        if (Math.floor(ax / 16) === tx && Math.floor(ay / 16) === ty) ch = '*';
        line += ch;
    }
    console.log(line);
}
if (args.sets) {
    const ids = chasers.map((c) => c.id);
    const near = ids.filter((id) => { const c = chasers.find((q) => q.id === id); return Math.hypot(c.x - 300, c.y - 560) < 400; });
    console.log(`near set: ${near.join(' ')}`);
    const found = [];
    for (let k = 1; k <= Math.min(5, near.length); k += 1) {
        const rec = (start, acc) => {
            if (acc.length === k) { if (admits(acc)) found.push([...acc]); return; }
            for (let i = start; i < near.length; i += 1) rec(i + 1, [...acc, near[i]]);
        };
        rec(0, []);
        if (found.length) { console.log(`smallest admitting sets (size ${k}):`); for (const s of found) console.log('  ' + s.join(' + ')); break; }
        console.log(`size ${k}: none admits`);
    }
}
