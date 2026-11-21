// The rock-room census for the ceremonytower slice: every atlas level holding a `fallrock` (or `fallrocklarge`) with
// every entity type in it, grouped by whether the game updates it BEFORE or AFTER the rock (`Game.as` add order:
// `addUpdate` prepends, so a type added at a later line updates earlier). Also every room with a beam tower and a
// special pickup. Usage: node tools/rockrooms.mjs > d1/rockrooms.json
import { readFileSync } from 'node:fs';
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
const game = readFileSync(new URL('../../../../../vendor/seedling/src/Game.as', import.meta.url), 'utf8').split('\n');
const line = {};
game.forEach((s, i) => { const m = s.match(/xml\.objects\[0\]\.(\w+)\)/); if (m && !(m[1] in line)) line[m[1]] = i + 1; });
const rockLine = line.fallrock;
const SPECIAL = ['bosskey','totempart','conch','darkshield','darksuit','feather','firewand','ghostspear','ghostsword','health','shield','sword','torchpickup','wand','seed','apitem','fire'];
const out = { addLine: line, rocks: [], towers: [] };
for (const L of loadAtlas().levels) {
  const es = L.entities ?? []; const n = (e) => String(e.type).toLowerCase();
  const types = [...new Set(es.map(n))];
  if (types.includes('beamtower')) out.towers.push({ level: L.level, special: es.filter((e) => SPECIAL.includes(n(e))).map((e) => `${n(e)}@${e.x},${e.y}`) });
  if (!types.includes('fallrock') && !types.includes('fallrocklarge')) continue;
  const after = types.filter((t) => line[t] !== undefined && line[t] < rockLine).sort((a, b) => line[b] - line[a]);
  const before = types.filter((t) => line[t] !== undefined && line[t] > rockLine);
  const unknown = types.filter((t) => line[t] === undefined);
  out.rocks.push({ level: L.level,
    rocks: es.filter((e) => ['fallrock','fallrocklarge'].includes(n(e))).map((e) => `${n(e)}@${e.x},${e.y} t${e.attrs?.tset ?? '?'}`),
    sources: es.filter((e) => ['button','rope','wand','buttonroom'].includes(n(e)) || n(e).startsWith('rope')).map((e) => `${n(e)}@${e.x},${e.y}${e.attrs?.tset !== undefined ? ' t' + e.attrs.tset : ''}`),
    updatesAfterRock: after, updatesBeforeRock: before, notInLoadlevel: unknown });
}
console.log(JSON.stringify(out, null, 1));
