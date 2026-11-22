#!/usr/bin/env node
// show.mjs — print a witness2 trace compactly: every Nth tick, player + movers (WallFlyer W, Bob B, PushableBlock K, WandShot *).
import { readFileSync } from 'node:fs';
const [f, every = '2', from = '0', to = '99999'] = process.argv.slice(2);
const t = JSON.parse(readFileSync(f, 'utf8'));
const tag = { WallFlyer: 'W', Bob: 'B', PushableBlock: 'K', WandShot: '*', Explosion: 'X' };
for (const r of t.rows) {
    if (r.tick % Number(every) !== 0 || r.tick < Number(from) || r.tick > Number(to)) continue;
    const mob = r.mob.filter((m) => m.c !== 'Player' && r.lv === 25).map((m) => `${tag[m.c] ?? m.c}(${m.x.toFixed(0)},${m.y.toFixed(0)}${m.ht ? ` s${m.ht}` : ''}${m.h ? ` h${m.h}` : ''}${m.vx || m.vy ? ` v${m.vx.toFixed(1)},${m.vy.toFixed(1)}` : ''})`);
    console.log(`${r.tick} L${r.lv} P(${r.x.toFixed(1)},${r.y.toFixed(1)}) hits${r.hits ?? 0} ${mob.join(' ')}`);
}
for (const e of t.events) console.log(`EVENT ${e}`);
