#!/usr/bin/env node
// mktape.mjs — a held-input tape for the L69 Lights fight: r8-solve-11's staging re-pointed at L69 (default the
// L70 pit landing (48,128)), a weapon held, plus optional cleared flags. Inputs: --spans='key:from-to,key:from-to'
// (half-open), --ticks=N, --boot=x,y, --items=hasSword,hasSpear, --primary=<slot item id name>, --flags=69:0,..,
// --time=<seam time>. Writes the tape JSON to --out.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = '/home/user/Archipelago-CC';
const MODULE = join(REPO, 'frontend/modules/seedlingDemo');
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const { parseTape, INVENTORY_ITEM_IDS } = await import(join(MODULE, 'tapeFormat.js'));
const { solveStaging, stagingFromTape, createRunForStaging } = await import(join(MODULE, 'tapeRunner.js'));
const { buildStagedTape } = await import(join(MODULE, 'botDriverV1.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const base = parseTape(readFileSync(join(MODULE, 'fixtures/tapes/r8-solve-11.json'), 'utf8'));
const staging = solveStaging(stagingFromTape(base));
const [bx, by] = (arg('boot', '48,128')).split(',').map(Number);
staging.boot = { level: Number(arg('level', '69')), x: bx, y: by };
const items = (arg('items', 'hasSword')).split(',').filter(Boolean);
staging.seam = { ...staging.seam, items: { ...staging.seam.items, ...Object.fromEntries(items.map((p) => [p, true])) } };
if (arg('time') !== null) staging.seam.time = Number(arg('time'));
staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
for (const f of (arg('flags', '')).split(',').filter(Boolean)) {
    const [level, tag] = f.split(':').map(Number);
    if (!staging.persistence.some((r) => r.level === level && r.tag === tag)) staging.persistence.push({ level, tag });
}
const prim = arg('primary');
if (prim !== null) {
    const run = createRunForStaging(staging, atlasLevelSource());
    const slot = run.progress('inventorySlots').indexOf(INVENTORY_ITEM_IDS[prim]);
    if (slot < 0) throw new Error(`no slot holds ${prim}: ${run.progress('inventorySlots')}`);
    staging.seam = { ...staging.seam, primary: slot };
}
const ticks = Number(arg('ticks', '600'));
const spans = (arg('spans', '')).split(',').filter(Boolean).map((s) => {
    const [k, r] = s.split(':'); const [a, b] = r.split('-').map(Number); return { k, a, b };
});
const perTick = [];
for (let t = 0; t < ticks; t += 1) perTick.push(new Set(spans.filter((s) => t >= s.a && t < s.b).map((s) => s.k)));
const tape = buildStagedTape({ staging, perTick, name: arg('name', 'lights-d1') });
writeFileSync(arg('out'), JSON.stringify(tape, null, 1));
console.log('wrote', arg('out'), 'ticks', ticks, 'boot', staging.boot, 'primary', staging.seam.primary, 'time', staging.seam.time);
