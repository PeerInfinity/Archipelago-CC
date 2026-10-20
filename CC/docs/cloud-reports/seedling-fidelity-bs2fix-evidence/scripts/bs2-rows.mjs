import { readFileSync } from 'node:fs';
import { parseTape } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/tapeFormat.js';
import { createTapeStepper } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/tapeRunner.js';
import { atlasLevelSource } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/levelSource.js';
import { withPickupRemovedNextFrame } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/pickupRemoval.js';
const p = process.argv[2];
const tape = parseTape(readFileSync(p, 'utf8'));
function replay() {
  let run = null, killedAt = null, first = null; const stream = []; const hits = [];
  const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
  let r = st.next();
  for (; !r.done; r = st.next()) {
    const o = r.value.observation; stream.push([o.t, o.x, o.y, o.level]);
    if (!run) continue;
    const b = (run.entities('strikeBodies') ?? []).find((c) => c.id === 'bobsoldier@48,80');
    if (!b && killedAt === null && run.level === 30) killedAt = o.t;
    const c = (run.entities('chasers') ?? []).find((c) => c.id === 'bobsoldier@48,80');
    if (c && c.hits !== hits.at(-1)?.hits) hits.push({ t: o.t, hits: c.hits });
    if (first === null && run.inventory?.hasTorch === true) first = o.t;
  }
  return { killedAt, first, hits, stream: JSON.stringify(stream), playerHits: r.value.playerHits.length, lastLevel: r.value.ticks.at(-1).level };
}
const on = withPickupRemovedNextFrame(true, replay), off = withPickupRemovedNextFrame(false, replay);
console.log(JSON.stringify({ on: { ...on, stream: undefined }, off: { ...off, stream: undefined }, streamEqual: on.stream === off.stream }));
