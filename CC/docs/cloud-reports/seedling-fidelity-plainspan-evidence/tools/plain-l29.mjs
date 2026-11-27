// An APItem on L29 (wave 59): stage `.oel` rows into L29, walk up from (112,160) (talk from TALK), and at every tick
// ask the solver's own contact call (`apItemTakenOnTick`, the solver view's pre/post shape). Print the solver's take
// tick, the run's own banked takes (`apItemFlags` via `earnedClears`-like readout), the starts, falls and spans.
// Usage: node tools/plain-l29.mjs '<inject json>' '<remove types json>' '<over json>' [ticks] [talkFrom] [level] [bootJson]
import { loadAtlas } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { levelSourceFromAtlas } from '../../../../../frontend/modules/seedlingDemo/atlasSource.js';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { createLevelRun } from '../../../../../frontend/modules/seedlingDemo/levelRun.js';
import { apItemTakenOnTick } from '../../../../../frontend/modules/seedlingDemo/solverBot.js';
const [inj, rem, over] = [2, 3, 4].map((i) => JSON.parse(process.argv[i]));
const ticks = +(process.argv[5] ?? 60), talkFrom = +(process.argv[6] ?? 1000), lv = +(process.argv[7] ?? 29);
const boot = JSON.parse(process.argv[8] ?? '{"level":29,"x":112,"y":160}');
const keys = JSON.parse(process.argv[9] ?? '["up"]');
const atlas = structuredClone(loadAtlas());
const L = atlas.levels.find((l) => l.level === lv);
L.entities = L.entities.filter((e) => !rem.includes(e.type)).concat(inj);
const src = levelSourceFromAtlas(atlas);
withContactFidelity(over, () => {
  const r = createLevelRun({ levelSource: src, boot, seam: { time: 900 },
    roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'], pins: ['sound', 'dead_frames'] });
  let thrown = null; const solverTakes = []; const per = []; const taken = new Set();
  try {
    for (let k = 0; k < ticks; k++) {
      const items = r.world?.apItems ?? [];
      const pre = { level: r.level, x: r.state.x, y: r.state.y, inCeremony: Boolean(r.progress('inCeremony')),
        deaths: r.ledger('playerDeaths').length, transitions: r.transitions.length };
      const t0 = r.gameTime;
      r.advance(new Set(k >= talkFrom ? (k % 2 ? ['primary'] : []) : keys));
      const open = items.filter((a) => !taken.has(a.id));
      const a = apItemTakenOnTick(open, pre, { level: r.level, deaths: r.ledger('playerDeaths').length, transitions: r.transitions.length });
      if (a) { taken.add(a.id); solverTakes.push({ tapeTick: k, id: a.id, run: r.takeApItem({ level: pre.level, id: a.id, tag: a.tag }) }); }
      per.push([k, t0, r.gameTime, +r.state.x.toFixed(2), +r.state.y.toFixed(2), pre.inCeremony ? 'C' : '']);
    }
  } catch (e) { thrown = e.message.slice(0, 400); }
  console.log(JSON.stringify({ thrown, solverTakes, starts: r.ceremonyStarts.map((c) => [c.t, c.tag]),
    collected: r.collected.map((c) => [c.t, c.item]), runTakes: r.plainFreezeTakes.map((x) => [x.t, x.id, x.why]), bank: r.earnedClears?.filter?.((e) => String(e.by).startsWith("apitem")).map((e) => [e.t, e.by]), falls: (r.rockFalls ?? []).map((f) => [f.t, f.id, f.deadFrames]),
    per: process.env.PER ? per : undefined }));
});
