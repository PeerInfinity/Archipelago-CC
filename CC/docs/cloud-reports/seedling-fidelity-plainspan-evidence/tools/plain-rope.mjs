// The rope rock (wave 59): replay `rockbutton-l28-livefall` on L28 with staged apitems, asking the solver's own
// contact call at every tick (its view's pre/post shape). Prints the pull tick's box, the solver takes and the run's.
// Usage: node tools/plain-rope.mjs '<inject json>' '<over json>'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { parseTape } from '../../../../../frontend/modules/seedlingDemo/tapeFormat.js';
import { createTapeStepper } from '../../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { ROCKBUTTON_WITNESS_DIR } from '../../../../../frontend/modules/seedlingDemo/fidelityRockButton.js';
import { apItemTakenOnTick } from '../../../../../frontend/modules/seedlingDemo/solverBot.js';
const [inj, over] = [2, 3].map((i) => JSON.parse(process.argv[i] ?? '[]'));
const fixture = JSON.parse(readFileSync(join(ROCKBUTTON_WITNESS_DIR, 'rockbutton-l28-livefall.json'), 'utf8'));
const atlas = structuredClone(loadAtlas());
const L = atlas.levels.find((l) => l.level === 28);
L.entities = L.entities.concat(inj);
withContactFidelity(over, () => {
  let rn = null; let pre = null; const solverTakes = []; const taken = new Set(); const rows = [];
  const st = createTapeStepper(parseTape(JSON.stringify(fixture.tape)), { levelSource: levelSourceFromAtlas(atlas),
    onTick: (t, s, h, r) => {
      if (pre && r.world?.apItems) {
        const open = r.world.apItems.filter((a) => !taken.has(a.id));
        const a = apItemTakenOnTick(open, pre, { level: r.level, deaths: r.ledger('playerDeaths').length, transitions: r.transitions.length });
        if (a) { taken.add(a.id); solverTakes.push({ tick: t, id: a.id, run: r.takeApItem({ level: pre.level, id: a.id, tag: a.tag }) }); }
      }
      rn = r;
      pre = { level: r.level, x: r.state.x, y: r.state.y, inCeremony: Boolean(r.progress('inCeremony')),
        deaths: r.ledger('playerDeaths').length, transitions: r.transitions.length };
      if (t >= 150 && t <= 158) rows.push([t, r.ticksCompleted, +r.state.x.toFixed(2), +r.state.y.toFixed(2), r.gameTime, pre.inCeremony]);
    } });
  let x = st.next(); while (!x.done) x = st.next();
  console.log(JSON.stringify({ solverTakes, falls: rn.rockFalls.map((f) => [f.t, f.id, f.deadFrames]), rows,
    runTakes: rn.plainFreezeTakes ?? null }));
});
