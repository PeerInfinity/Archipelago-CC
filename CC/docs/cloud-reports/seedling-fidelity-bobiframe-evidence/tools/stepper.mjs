// scratch (BOBIFRAME): replay a TAPE FILE on the model (tapeRunner stepper, as the mobiles probe does); dump per tick (jsonl).
import { readFileSync, writeFileSync } from 'node:fs';
const [file, out, setFile] = process.argv.slice(2);
const ROOT = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo';
const { parseTape } = await import(ROOT + '/tapeFormat.js');
const { createTapeStepper } = await import(ROOT + '/tapeRunner.js');
const { vanillaRecordSet } = await import(ROOT + '/levelSetExporter.js');
const { mountedRecordsOf } = await import(ROOT + '/wasmWalkTape.js');
const { levelSourceFromAtlas } = await import(ROOT + '/atlasSource.js');
const RJ = (rel) => JSON.parse(readFileSync('/home/user/Archipelago-CC/' + rel, 'utf8'));
const set = setFile ? JSON.parse(readFileSync(setFile, 'utf8')).deliveredSet : vanillaRecordSet(RJ('frontend/modules/seedlingDemo/fixtures/seedling-vanilla-set.json'), RJ('frontend/modules/flashPanel/atlases/seedling-map.json')).set;
const atlasLevelSource = () => levelSourceFromAtlas(mountedRecordsOf(set));
const tape = parseTape(readFileSync(file, 'utf8'));
let run = null; const lines = [];
const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
let r = st.next();
while (!r.done) {
  const o = r.value.observation;
  const row = { t: o.t, p: { x: o.x, y: o.y }, hits: run ? run.playerHits.length : 0 };
  if (run) for (const f of ['chasers', 'spinnerBodies']) row[f] = (run.entities(f) ?? []).map((e) => JSON.parse(JSON.stringify(e)));
  lines.push(JSON.stringify(row)); r = st.next();
}
writeFileSync(out, lines.join('\n') + '\n');
console.log('rows', lines.length, 'hits', JSON.stringify(run.playerHits.map((h) => ({ t: h.t, s: h.source, id: h.id }))));
