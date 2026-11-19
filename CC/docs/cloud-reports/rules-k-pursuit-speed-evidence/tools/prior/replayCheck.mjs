// Model check of the step-rule sim: feed a GAME run's player trajectory (per-tick reads) into `kNarrow.chase` for one body
// and print the model body beside the game's body, tick by tick. NEEDS ../producer-hook.patch.
// Usage: K_NARROW=K node replayCheck.mjs <level> <body label> <run.game.json.gz> [every=6] [statics=0|1]
import fs from 'node:fs'; import zlib from 'node:zlib';
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
process.env.K_NARROW_REPORT = '1';
const P = await import(pathToFileURL(path.join(repo, 'scripts/procgen/make-seedling-playthrough-rules.mjs')));
const KN = await import(pathToFileURL(path.join(repo, 'CC/docs/cloud-reports/rules-k-chaser-narrowing-evidence/tools/kNarrow.mjs')));
const FCG = await import(pathToFileURL(path.join(repo, 'scripts/procgen/seedlingFireChaserGuard.js')));
const [n, label, run, every = '6'] = process.argv.slice(2);
const level = P.PLAYTHROUGH_MAP.levels.find((l) => l.level === Number(n));
globalThis.__kRooms = [];
P.playthroughGridFor(level);
const lab = (b) => `${b.tag}@${b.x},${b.y}`;
const room = globalThis.__kRooms.find((r) => r.bodies.some((b) => lab(b) === label));
const body = room.bodies.find((b) => lab(b) === label);
const cls = FCG.guardClassOf(body.tag);
const centre = room.centreOf(body);
const statics = KN.staticBoxes(body, room.bodies, room.centreOf);
const S = KN.solidsOf(body, cls, room.grid, room.tileTypes, statics, null);
const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(run)));
const byT = new Map();
for (const x of d.reads) if (x.tick !== undefined && x.level === Number(n) && !byT.has(x.tick)) byT.set(x.tick, x);
const ticks = [...byT.keys()].sort((a, b) => a - b);
const traj = ticks.map((t) => byT.get(t));
const pos = [];
const hit = KN.chase(body, centre, cls, S, (t) => (traj[t] ? { x: traj[t].x, y: traj[t].y } : null), {
  maxTicks: traj.length, peers: KN.peersOf(body, room), wake: (t, p) => Math.hypot(p.x - centre[0], p.y - centre[1]) <= cls.runRange, onPos: (x, y, t) => { pos[t] = [x, y]; },
});
console.log(`model contact tick: ${hit}  (game firstHit ${JSON.stringify(d.row.firstHit)})`);

// the game's body: the mob entry that starts at the spawn centre, followed by index
const parse = (m) => m.match(/([-\d.]+),([-\d.]+)\)$/).slice(1).map(Number);
const m0 = traj[0].mob.map(parse);
const idx = m0.findIndex(([x, y]) => Math.abs(x - centre[0]) < 0.6 && Math.abs(y - centre[1]) < 0.6);
console.log(`game body index ${idx} (${traj[0].mob[idx]})`);
let minModel = Infinity, minGame = Infinity;
for (let t = 0; t < traj.length; t += 1) {
  const p = traj[t];
  const g = p.mob[idx] ? parse(p.mob[idx]) : null;
  const m = pos[t] ?? null;
  if (m) minModel = Math.min(minModel, Math.hypot(m[0] - p.x, m[1] - p.y));
  if (g) minGame = Math.min(minGame, Math.hypot(g[0] - p.x, g[1] - p.y));
  if (t % Number(every) === 0) console.log(`t${t} player ${p.x.toFixed(1)},${p.y.toFixed(1)}  game ${g ? g.map((v) => v.toFixed(1)).join(',') : '-'}  model ${m ? m.map((v) => v.toFixed(1)).join(',') : '(asleep)'}`);
}
console.log(`closest: game ${minGame.toFixed(1)} px, model ${minModel.toFixed(1)} px`);
