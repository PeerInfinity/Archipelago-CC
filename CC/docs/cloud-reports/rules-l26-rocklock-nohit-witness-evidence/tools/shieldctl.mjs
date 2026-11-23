// Shield x2 (Shield + Dark Shield, no weapon) closed-loop controller on the MODEL (levelRun), emitting a plan for the game.
// The dark shield's arm of `Player.shieldBump` (Player.as:1691-1707): while the player MOVES and the shield box overlaps an
// enemy whose hitsTimer <= 0, `o.hit(5, p, 0.5, "Shield")` -> 6 bumps kill a puncher (hitsMax 3), each starting its 30-tick
// hitsTimer, during which `Puncher.attackPlayer` returns (Puncher.as:174) and `Enemy.hitPlayer` is gated (Enemy.as:213).
// node shieldctl.mjs <prefix plan.json> <prefixTicks> <out plan.json> [--push=dist] [--mode=push|pulse] [--waypoints=x,y;x,y]
import { readFileSync, writeFileSync } from 'node:fs';
const R = new URL('../../../../../', import.meta.url).pathname;
const { createRunForStaging } = await import(R + 'frontend/modules/seedlingDemo/tapeRunner.js');
const { liveOf } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const ATLAS = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/atlases/seedling-map.json', 'utf8'));
const [preF, preN, outF] = process.argv.slice(2);
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const PUSH = Number(arg('push', 40)), MODE = arg('mode', 'push');
const LURE = arg('lure', '').split(';').filter(Boolean).map((s) => s.split(',').map(Number));
const goto = (d, pts) => { while (pts.length) { const [wx, wy] = pts[0]; const k = [];
    if (Math.abs(wx - d.s.x) > 1.5) k.push(wx > d.s.x ? 'right' : 'left'); else if (Math.abs(wy - d.s.y) > 1.5) k.push(wy > d.s.y ? 'down' : 'up');
    if (k.length) return k; pts.shift(); } return []; };
const WP = arg('waypoints', '').split(';').filter(Boolean).map((s) => s.split(',').map(Number));
const base = JSON.parse(readFileSync(preF, 'utf8'));
const items = Object.fromEntries(Object.keys(base.staging.seam.items).map((k) => [k, false]));
items.hasShield = true; items.hasDarkShield = true;
const staging = { ...base.staging, seam: { ...base.staging.seam, items }, inventory_slots: [] };
const run = createRunForStaging(staging, levelSourceFromAtlas(ATLAS), { scratchPersistence: true });
const plan = [];
const step = (k) => { plan.push(k); run.advance(new Set(k)); };
const dig = () => JSON.parse(liveOf(run).digest);
for (const k of base.plan.slice(0, Number(preN))) step(k);
const log = [];
let deadAt = null;
for (let t = 0; t < 1400 && run.level === 26; t++) {
    const d = dig();
    const live = (d.c ?? []).filter((c) => !c.dying && !c.destroy);
    if (!live.length) {
        deadAt ??= plan.length;
        if (plan.length - deadAt < 105) { step([]); continue; }    // the rocklock's 100-tick fade (RockLock.as:55-66)
        const [wx, wy] = WP[0] ?? [150, 216];
        const k = [];
        if (Math.abs(wy - d.s.y) > 1.5) k.push(wy > d.s.y ? 'down' : 'up');
        else if (Math.abs(wx - d.s.x) > 1.5) k.push(wx > d.s.x ? 'right' : 'left');
        else { WP.shift(); }
        step(k); continue;
    }
    const near = live.map((c) => ({ c, dx: c.x - d.s.x, dy: c.y - d.s.y })).map((o) => ({ ...o, r: Math.hypot(o.dx, o.dy) })).sort((a, b) => a.r - b.r)[0];
    const k = [];
    if (near.r <= PUSH) {
        const ax = Math.abs(near.dx) > Math.abs(near.dy) ? (near.dx > 0 ? 'right' : 'left') : (near.dy > 0 ? 'down' : 'up');
        const away = { right: 'left', left: 'right', up: 'down', down: 'up' }[ax];
        const IN = Number(arg('in', 2)), BACK = Number(arg('back', 11));
        if (MODE === 'push') k.push(ax);
        else if (near.c.hitsTimer <= IN) k.push(ax);                 // step in as the immunity lapses
        else if (near.r < BACK) k.push(away);                         // keep the bodies apart while it is immune
    } else if (live.length === 1 && LURE.length) k.push(...goto(d, LURE));   // walk toward the next body's wake
    if (t % 10 === 0) log.push(`t${plan.length} P(${d.s.x.toFixed(1)},${d.s.y.toFixed(1)}) hits=${run.playerHits.length} near=${near.c.id} (${near.c.x.toFixed(1)},${near.c.y.toFixed(1)}) h${near.c.hits} ht${near.c.hitsTimer} keys=${k.join('+')}`);
    step(k);
}
console.log(log.join('\n'));
console.log(JSON.stringify({ ticks: plan.length, endLevel: run.level, hits: run.playerHits.map((h) => `t${h.t} ${h.source} ${h.id}`), writes: run.scratchClears }));
writeFileSync(outF, JSON.stringify({ staging, perTick: base.perTick ?? [], plan }));
