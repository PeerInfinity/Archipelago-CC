import { readFileSync } from 'node:fs';
const R = new URL('../../frontend/modules/', import.meta.url).pathname;
const { stagingFromWasmArrival } = await import(R + 'seedlingDemo/wasmArrival.js');
const { createRunForStaging } = await import(R + 'seedlingDemo/tapeRunner.js');
const { indexLevels, levelSourceFromAtlas } = await import(R + 'seedlingDemo/atlasSource.js');
const MAP = JSON.parse(readFileSync(R + 'flashPanel/atlases/seedling-map.json', 'utf8'));
const RECORDS = indexLevels(MAP); const SRC = levelSourceFromAtlas(RECORDS);
for (const n of ['rope', 'norope']) {
  const cap = JSON.parse(readFileSync(`l16back-${n}.json`, 'utf8')); const read = cap.reads[0];
  const { staging } = stagingFromWasmArrival({ seam: read.seam, status: read.status, state: read.state, record: RECORDS.get(16) });
  const run = createRunForStaging(staging, SRC, { scratchPersistence: true });
  const show = () => { const a = run.entities('armedArrowTraps'); return a ? [...a] : a; };
  const ser = (f) => { const v = run.entities(f); return v == null ? v : [...v].map((x) => typeof x === 'object' ? (x.id ?? JSON.stringify(x).slice(0,80)) : x); }; const traps = { pulledRopes: ser('pulledRopes'), latchedGroups: ser('latchedGroups'), openActivators: ser('openActivators') };
  const out = { n, persistence: staging.persistence?.filter((p) => p.level === 16), traps, armed0: show() };
  for (let i = 0; i < 3; i++) { run.advance?.(new Set()); out['armed' + (i + 1)] = show(); }
  console.log(JSON.stringify(out));
}
