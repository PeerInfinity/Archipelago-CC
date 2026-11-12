import { readFileSync } from 'node:fs';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { modelWandSamples } = await import(M + 'wandWitness.js');
const { parseTape } = await import(M + 'tapeFormat.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { patchedMapDocument } = await import(M + 'seedlingSetPatches.js');
const [tapeF, witF] = process.argv.slice(2);
const tape = parseTape(readFileSync(tapeF, 'utf8'));
const game = JSON.parse(readFileSync(witF, 'utf8')).rows;
const srcs = { unpatched: atlasLevelSource(),
  patched: levelSourceFromAtlas(patchedMapDocument(JSON.parse(readFileSync('/home/user/Archipelago-CC/frontend/modules/flashPanel/atlases/seedling-map.json', 'utf8')))) };
for (const [n, src] of Object.entries(srcs)) {
  const col = modelWandSamples(tape, src);
  let first = null, max = 0, maxAt = null;
  for (let i = 0; i < Math.min(col.length, game.length); i++) {
    const g = game[i], m = col[i];
    if (m?.px === undefined || !g?.player) continue;
    const d = Math.hypot(g.player.x - m.px, g.player.y - m.py);
    if (d > 1e-6 && first === null) first = { t: g.t, d, g: g.player, m: {x: m.px, y: m.py} };
    if (d > max) { max = d; maxAt = g.t; }
  }
  console.log(n, 'samples', col.length, 'first', JSON.stringify(first), 'max', max.toFixed(3), 'at', maxAt, 'end model', JSON.stringify([col[col.length-1]?.px, col[col.length-1]?.py]), 'level', col[col.length-1]?.level);
}
console.log(JSON.stringify(Object.keys(modelWandSamples(tape, srcs.patched)[0] ?? {})));
{
  const col = modelWandSamples(tape, srcs.patched);
  const band = (a, b) => { let mx = 0, n = 0; for (let i = a; i < Math.min(b, game.length, col.length); i++) { const g = game[i], m = col[i]; if (!g?.player || m?.px === undefined || m.level !== 43) continue; n++; mx = Math.max(mx, Math.hypot(g.player.x - m.px, g.player.y - m.py)); } return `${a}-${b}: n ${n} max ${mx.toFixed(3)}`; };
  console.log([band(0, 100), band(100, 161), band(161, 200), band(200, 782), band(782, 1056)].join(' | '));
}
