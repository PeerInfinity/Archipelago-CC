#!/usr/bin/env node
// rules-fire-only-witness: a model search for a hitless Fire-only L73 north crossing (r3c7 -> r0c4: the L72 landing
// (32,128) -> break `@64,48` -> the L74 door (64,0)). Each candidate: walk to a lure point P (every Igneous floor tile
// centre of the south floor), idle w1, walk to a stance S below the rock, idle w2, press Fire, idle 24 + w3, walk north.
// The model CHOOSES and PREDICTS; any candidate it calls hitless is then played on the game (`fireonly.mjs --play`).
// Every candidate starts with PREFIX: the bulb's lava kill bulb-search.mjs found (go (72,120), go (40,136), idle 80).
// Usage: node l73-search.mjs
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const T = await import('./fireonly.mjs');
const { atlasLevelSource } = await import(join(R, 'frontend/modules/seedlingDemo/levelSource.js'));
const { buildLevelWorld, ROLES } = await import(join(R, 'frontend/modules/seedlingDemo/levelWorld.js'));
const w = buildLevelWorld(atlasLevelSource()(73), { roles: ROLES });
const solid = new Set(w.solids.map((s) => `${Math.floor(s.rect.x / 16)},${Math.floor(s.rect.y / 16)}`));
const floor = w.tiles.filter((t) => /Igneous/.test(t.name) && !solid.has(`${t.tx},${t.ty}`) && t.ty >= 4).map((t) => [t.tx * 16 + 8, t.ty * 16 + 8]);
const L72 = { level: 73, x: 32, y: 128 };
const STANCES = [[72, 73], [68, 72], [76, 72], [72, 76]];
const PREFIX = [['go', 72, 120], ['go', 40, 136], ['wait', 80]];
const north = [['go', 72, 24], ['keys', 'up', 40], ['wait', 20]];
let n = 0; let best = null;
const tryScript = async (label, script) => {
    n += 1;
    const a = await T.author({ boot: L72, items: ['hasFire'], script });
    const r = { label, level: a.model.end.level, hits: a.model.end.hits, firstHit: a.model.firstHit, rocks: a.model.rocks, by: a.model.hitBy.map((h) => { try { return JSON.parse(h).id; } catch { return h.slice(0, 40); } }) };
    if (r.hits === 0 && r.level === 74) console.log('HITLESS', JSON.stringify(r), JSON.stringify(script));
    if (!best || (r.firstHit ?? 1e9) > (best.firstHit ?? 1e9)) best = r;
    return r;
};
const tally = {};
for (const P of floor) for (const w1 of [0, 20, 40, 70, 100, 150]) for (const S of STANCES) for (const w2 of [0, 10, 30]) {
    const r = await tryScript(`P${P} w1=${w1} S${S} w2=${w2}`, [...PREFIX, ['go', ...P], ['wait', w1], ['go', ...S], ['wait', w2], ['fire'], ['wait', 24], ...north]);
    const k = `${r.level}/${r.hits === 0 ? 0 : 'hit'}/${r.by[0] ?? '-'}`; tally[k] = (tally[k] ?? 0) + 1;
}
console.log('TRIED', n, 'TALLY', JSON.stringify(tally));
console.log('LATEST-FIRST-HIT', JSON.stringify(best));
