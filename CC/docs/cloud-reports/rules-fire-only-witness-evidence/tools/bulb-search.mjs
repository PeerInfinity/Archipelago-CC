#!/usr/bin/env node
// rules-fire-only-witness: model search for a hitless way to put L73's bulb (Bulb.as: a Bob, 0.65 px/tick; Enemy.as
// case 17 `dieInLava` defaults true) into lava: walk to A, idle a, walk to B, idle b (A, B: every south-floor tile
// centre plus four sub-tile corners next to the lava pit c3 r8). Prints each hitless kill and a tally.
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const T = await import('./fireonly.mjs');
const { atlasLevelSource } = await import(join(R, 'frontend/modules/seedlingDemo/levelSource.js'));
const { buildLevelWorld, ROLES } = await import(join(R, 'frontend/modules/seedlingDemo/levelWorld.js'));
const w = buildLevelWorld(atlasLevelSource()(73), { roles: ROLES });
const solid = new Set(w.solids.map((s) => `${Math.floor(s.rect.x / 16)},${Math.floor(s.rect.y / 16)}`));
const floor = w.tiles.filter((t) => /Igneous/.test(t.name) && !solid.has(`${t.tx},${t.ty}`) && t.ty >= 4).map((t) => [t.tx * 16 + 8, t.ty * 16 + 8]);
const near = [[36, 140], [44, 140], [36, 132], [76, 140], [68, 140], [76, 132], [52, 116], [60, 118]];
const L72 = { level: 73, x: 32, y: 128 };
const tally = {}; let n = 0;
for (const A of floor) for (const a of [0, 40]) for (const B of [...near, ...floor.filter((p) => p[1] >= 104)]) for (const b of [60, 160]) {
    n += 1;
    const r = await T.author({ boot: L72, items: ['hasFire'], script: [['go', ...A], ['wait', a], ['go', ...B], ['wait', b]] }, 'fire', { trace: true });
    const gone = r.log.find((s) => s.level === 73 && !s.chasers.some((c) => c.startsWith('bulb')));
    const k = `${r.model.end.hits === 0 ? 'clean' : 'hit'}/${gone ? 'bulbGone' : 'bulbAlive'}`; tally[k] = (tally[k] ?? 0) + 1;
    if (gone && r.model.end.hits === 0 && r.model.end.level === 73) console.log('KILL', JSON.stringify({ A, a, B, b, goneAt: gone.t, end: r.model.end }));
}
console.log('TRIED', n, JSON.stringify(tally));
