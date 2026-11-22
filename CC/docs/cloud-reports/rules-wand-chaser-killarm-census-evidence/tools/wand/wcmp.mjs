#!/usr/bin/env node
// rules-wand-chaser-killarm-census: replay a tape's keys in wsim and print sim vs GAME (player, runners) every N ticks.
//   node wcmp.mjs <tape.json> <run.game.json.gz> [every=10] [from=0] [to=1e9]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const { makeRoom, initState, tick } = await import('./wsim.mjs');
const [tf, gf, every = '10', from = '0', to = '1e9'] = process.argv.slice(2);
const tape = JSON.parse(readFileSync(tf, 'utf8'));
const g = JSON.parse(gunzipSync(readFileSync(gf)));
const byT = new Map(); for (const r of g.reads) byT.set(r.tick, r);
const n = Math.max(tape.tick_count, ...tape.inputs.map((i) => i.to));
const keys = Array.from({ length: n }, () => new Set()); for (const i of tape.inputs) for (let x = i.from; x < i.to; x++) keys[x].add(i.key);
const room = makeRoom(tape.boot.level);
const s = initState(room, { boot: tape.boot, seam: tape.seam ?? { items: {} } });
for (let t = 0; t < n; t++) {
    tick(room, s, keys[t]);
    const gr = byT.get(t + 1);
    if (t >= +from && t <= +to && (t % +every === 0 || s.dead !== null || s.contact)) {
        console.log(`t${t + 1} sim P(${s.p.x.toFixed(1)},${s.p.y.toFixed(1)}) ${s.e.map((e) => `${e.dead === null ? '' : 'X'}(${e.x.toFixed(0)},${e.y.toFixed(0)})h${e.hits}`).join(' ')} ${s.dead !== null ? 'DEAD:' + s.hz : ''}${s.contact ? 'CONTACT' : ''}`);
        if (gr) console.log(`      game P(${(+gr.x).toFixed(1)},${(+gr.y).toFixed(1)}) hits=${gr.hits} ${(gr.en ?? []).filter((e) => e.c === 'LavaRunner').map((e) => `(${e.x.toFixed(0)},${e.y.toFixed(0)})h${e.h}`).join(' ')}`);
    }
    if (s.dead !== null || s.contact) break;
}
console.log("HITSLOG", s.hitsLog.join(" "));
