// The wand's fallrocks (wave 59): drive `r5-l43-wand` on L43 with staged rows (a tset-0 fallrock over the stance, so
// it SNAPS the player; apitems), asking the solver's own contact call at every tick. Prints the collect, the falls,
// the snap position, the solver takes and the run's.
// Usage: node tools/plain-wand.mjs '<inject json>' '<over json>' [from] [to]
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
import { heldKeysAt } from '../../../../../frontend/modules/seedlingDemo/tapeFormat.js';
import { loadTape } from '../../../../../frontend/modules/seedlingDemo/fixtures/index.js';
import { apItemTakenOnTick } from '../../../../../frontend/modules/seedlingDemo/solverBot.js';
const [inj, over] = [2, 3].map((i) => JSON.parse(process.argv[i] ?? '[]'));
const from = +(process.argv[4] ?? 0), to = +(process.argv[5] ?? -1);
const atlas = structuredClone(loadAtlas());
const L = atlas.levels.find((l) => l.level === 43);
L.entities = L.entities.concat(inj);
const t = loadTape('r5-l43-wand');
withContactFidelity(over, () => {
  const run = createLevelRun({ levelSource: levelSourceFromAtlas(atlas), boot: t.boot, noclip: t.noclip, noHazards: t.noHazards,
    noDamage: t.noDamage, grants: t.grants, persistence: t.persistence, equips: t.equips, pins: t.pins, save: t.save });
  const solverTakes = []; const taken = new Set(); const rows = []; let thrown = null;
  try {
    for (let k = 0; k < t.tick_count; k += 1) {
      const pre = { level: run.level, x: run.state.x, y: run.state.y, inCeremony: Boolean(run.progress('inCeremony')),
        deaths: run.ledger('playerDeaths').length, transitions: run.transitions.length };
      const items = run.world?.apItems ?? [];
      run.advance(heldKeysAt(t, k));
      const a = apItemTakenOnTick(items.filter((x) => !taken.has(x.id)), pre, { level: run.level, deaths: run.ledger('playerDeaths').length, transitions: run.transitions.length });
      if (a) { taken.add(a.id); solverTakes.push({ tick: k, id: a.id, run: run.takeApItem({ level: pre.level, id: a.id, tag: a.tag }) }); }
      if (k >= from && k <= to) rows.push([k, +run.state.x.toFixed(2), +run.state.y.toFixed(2), pre.inCeremony ? 'C' : '', run.gameTime]);
    }
  } catch (e) { thrown = e.message.slice(0, 300); }
  console.log(JSON.stringify({ thrown, ticks: t.tick_count, collected: run.collected.map((c) => [c.t, c.item]),
    falls: run.rockFalls.map((f) => [f.t, f.id, f.deadFrames]), solverTakes, runTakes: run.plainFreezeTakes, rows }));
});
