// Re-drive a saved plan (arms.mjs --out) on a fresh levelRun run with other seam items: node replay-with.mjs <plan.json> <itemsJSON>
// Prints end level, hits (tick + source), deaths, the clears. Also the player/puncher positions every 10 ticks with --trace.
import { readFileSync } from 'node:fs';
const R = new URL('../../../../../', import.meta.url).pathname;
const { replayTape } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { inventorySlotsFor } = await import(R + 'frontend/modules/seedlingDemo/tapeFormat.js');
const ATLAS = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/atlases/seedling-map.json', 'utf8'));
const [file, itemsJson] = process.argv.slice(2);
const p = JSON.parse(readFileSync(file, 'utf8'));
const extra = itemsJson ? JSON.parse(itemsJson) : {};
const items = { ...p.staging.seam.items, ...extra };
const staging = { ...p.staging, seam: { ...p.staging.seam, items }, inventory_slots: inventorySlotsFor(items) };
const run = replayTape({ staging, perTick: [...p.perTick, ...p.plan].map((k) => new Set(k)), levelSource: levelSourceFromAtlas(ATLAS), scratchPersistence: p.scratchPersistence });
console.log(JSON.stringify({ file: file.split('/').pop(), items: Object.keys(items).filter((k) => items[k]), slots: staging.inventory_slots, ticks: p.plan.length,
    endLevel: run.level, hits: run.ledger('playerHits'), deaths: run.ledger('playerDeaths').length,
    writes: run.scratchClears.map(({ level, tag, at, lock }) => ({ level, tag, at, lock })) }));
