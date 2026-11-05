// Write a generated keygate room's certification request as a compact test fixture (levelRecord, staging, goals,
// budget, name), built exactly as capture.mjs builds `request.json`. The cut drops only `config` / `call` (prose), so
// `procgenOracle.solve` answers it byte-identically (the test's own row replays it).
// Usage: node make-fixture.mjs <repo-root> <kind> <WxH> <seed> <palette> <out.json>
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
const [REPO, kind, sizeArg, seedArg, paletteName, outPath] = process.argv.slice(2);
const M = (p) => import(join(REPO, 'frontend/modules', p));
const { seedlingSkeletonSpec, seedlingModel, pinsForRecord } = await M('seedlingDemo/procgenSeedling.js');
const { bootStaging, DEFAULT_BUDGET, assertBudget } = await M('seedlingDemo/procgenOracle.js');
const { floodTerrainsFor } = await M('seedlingDemo/procgenLevel.js');
const { parseElementSpec } = await M('procgenCore/elementSpec.js');
const { parseAreaSpec } = await M('procgenCore/areaSpec.js');
const palette = (await M('seedlingDemo/watchGenerate.js')).paletteWithTerrains(paletteName, '');
const [width, height] = sizeArg.split('x').map(Number);
const items = palette.items ?? null;
const model = seedlingModel({ seed: Number(seedArg), floodTerrains: floodTerrainsFor(items, palette.floodWalks),
    defaults: { width, height }, skeleton: seedlingSkeletonSpec(kind), elements: parseElementSpec('keygate'),
    areas: parseAreaSpec('0') });
const record = model.skeleton();
const staging = bootStaging({ boot: model.boot(), items, pins: pinsForRecord(record, []) });
const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : v)));
const fixture = { cell: `${paletteName} ${kind} ${sizeArg} seed ${seedArg} elements=keygate areas=0`,
    levelRecord: strip(record), staging: strip(staging), goals: strip(model.goals),
    budget: strip(assertBudget(DEFAULT_BUDGET)), name: `procgen-l${record.level}` };
writeFileSync(outPath, JSON.stringify(fixture) + '\n');
console.log(outPath, JSON.stringify(fixture).length, 'bytes');
