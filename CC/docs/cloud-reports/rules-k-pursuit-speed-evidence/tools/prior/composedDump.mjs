// Run at base (patch not applied) and at the tip (`git apply ../producer-wiring.patch`); rename the outputs. routeWalk.py,
// vanillaSpheres.py and allItemsReach.py read the rules JSON it writes (gunzip the committed copies first).
// Compile AP_1 with the derived-rule table HIDDEN (the composed rules only) and dump every exit/location rule.
// Usage: node composedDump.mjs <out.json>. The table file is moved aside for the import and restored in `finally`.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const TABLE = path.join(repo, 'frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json');
const ASIDE = `${TABLE}.aside`;
fs.renameSync(TABLE, ASIDE);
let P;
try {
  P = await import(pathToFileURL(path.join(repo, 'scripts/procgen/make-seedling-playthrough-rules.mjs')));
} finally { fs.renameSync(ASIDE, TABLE); }
const doc = P.buildPlaythroughAtlas();
const { rules } = P.compilePlaythroughRules(doc);
const out = {};
for (const [rname, r] of Object.entries(rules.regions['1'])) {
  for (const e of r.exits ?? []) out[`${rname}|exit|${e.name}`] = e.access_rule ?? { rule: 'True_' };
  for (const l of r.locations ?? []) out[`${rname}|loc|${l.name}`] = l.access_rule ?? { rule: 'True_' };
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 0));
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({ regions: rules.regions }));
console.log(Object.keys(out).length, 'elements');
