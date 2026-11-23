// Trace a plan on the MODEL (levelRun): every N ticks the player and both punchers (x, y, hits), and the player's hits.
// node trace.mjs <plan.json> [itemsJSON] [N=10]
import { readFileSync } from 'node:fs';
const R = new URL('../../../../../', import.meta.url).pathname;
const { createRunForStaging } = await import(R + 'frontend/modules/seedlingDemo/tapeRunner.js');
const { liveOf } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { inventorySlotsFor } = await import(R + 'frontend/modules/seedlingDemo/tapeFormat.js');
const ATLAS = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/atlases/seedling-map.json', 'utf8'));
const [file, itemsJson, nArg] = process.argv.slice(2);
const p = JSON.parse(readFileSync(file, 'utf8'));
const items = { ...p.staging.seam.items, ...(itemsJson ? JSON.parse(itemsJson) : {}) };
const staging = { ...p.staging, seam: { ...p.staging.seam, items }, inventory_slots: inventorySlotsFor(items) };
const run = createRunForStaging(staging, levelSourceFromAtlas(ATLAS), { scratchPersistence: true });
const N = Number(nArg ?? 10);
const keys = [...(p.perTick ?? []), ...p.plan];
keys.forEach((k, t) => {
    run.advance(new Set(k));
    if (t % N === 0 || t === keys.length - 1) {
        const d = JSON.parse(liveOf(run).digest);
        console.log(`t${t + 1} L${d.L} P(${d.s.x.toFixed(1)},${d.s.y.toFixed(1)}) hits=${run.playerHits.length} keys=${[...k].join('+') || '-'} ` +
            (d.c ?? []).map((c) => `${c.id.split('@')[1]}:(${c.x.toFixed(1)},${c.y.toFixed(1)}) h${c.hits}${c.dying ? ' dying' : ''}${c.destroy ? ' gone' : ''}`).join(' '));
    }
});
