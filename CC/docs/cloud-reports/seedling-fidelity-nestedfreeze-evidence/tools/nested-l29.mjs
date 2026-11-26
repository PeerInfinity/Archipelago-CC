// A pickup on L29's button at frame A (wave 57): stage `.oel` rows into L29, walk up from (112,160), tap the talk key from
// advance TALK; print the ledgers and, per tick, the clock, the player, the turrets and the bombs.
// Usage: node tools/nested-l29.mjs '<inject json>' '<remove types json>' '<over json>' [ticks] [talkFrom]
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
const [inj, rem, over, ticks, talkFrom] = [JSON.parse(process.argv[2]), JSON.parse(process.argv[3]), JSON.parse(process.argv[4]), +(process.argv[5] ?? 60), +(process.argv[6] ?? 1000)];
const atlas = structuredClone(loadAtlas());
const L = atlas.levels.find((l) => l.level === 29);
L.entities = L.entities.filter((e) => !rem.includes(e.type)).concat(inj);
const src = levelSourceFromAtlas(atlas);
withContactFidelity(over, () => {
  const r = createLevelRun({ levelSource: src, boot: { level: 29, x: 112, y: 160 }, seam: { time: 900 },
    roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'], pins: ['sound', 'dead_frames'] });
  let thrown = null; const fam = [];
  try { for (let k = 0; k < ticks; k++) { r.advance(new Set(k >= talkFrom ? (k % 2 ? ['primary'] : []) : ['up'])); fam.push([k + 1, r.gameTime, +r.state.y.toFixed(2), JSON.stringify(r.shooters), JSON.stringify(r.bombs)]); } }
  catch (e) { thrown = e.message.slice(0, 300); }
  console.log(JSON.stringify({ thrown, starts: r.ceremonyStarts.map(c=>[c.t,c.tag]), collected: r.collected.map(c=>[c.t,c.item]), spits: r.spitEvents.length, fam }));
});
