// SCRATCH (seedling-hammer-sf D1): the model's walk of a witness tape — the player per tick and the hits, around a tick.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { createRunForStaging, createTapeStepper, stagingFromTape } = await M('tapeRunner.js');
const { parseTape } = await M('tapeFormat.js');
const { atlasLevelSource } = await M('levelSource.js');
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const [lo, hi] = process.argv[3].split('-').map(Number);
const held = [];
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
for (let r = st.next(); !r.done; r = st.next());
const run = createRunForStaging({ ...stagingFromTape(tape), equips: [] }, atlasLevelSource());
for (const k of held.filter(Boolean)) {
    run.advance(k);
    const t = run.ticksCompleted;
    if (t >= lo && t <= hi) {
        const b = (run.entities('strikeBodies') ?? []).filter((x) => x.id.startsWith('bob@736,752')).map((x) => [x.id, +x.x.toFixed(2), +x.y.toFixed(2)]);
        console.log(t, [...k].join('+'), run.state.x.toFixed(3), run.state.y.toFixed(3), run.state.vx.toFixed(3), run.state.vy.toFixed(3), JSON.stringify(b));
    }
    if (t > hi) break;
}
console.log('hits', JSON.stringify(run.playerHits.slice(0, 3)));
