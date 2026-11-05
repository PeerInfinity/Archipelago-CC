// Capture ONE keygate certification solve (request + answer) for a cell the sweep reported
// `the-goal-approach-is-blocked`. Usage: node capture.mjs <repo-root> [kind] [WxH] [seed] [palette]
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
const [REPO, kind = 'bushy', sizeArg = '14x14', seedArg = '3', paletteName = 'pre-sword'] = process.argv.slice(2);
const M = (p) => import(join(REPO, 'frontend/modules', p));
const OUT = new URL('.', import.meta.url).pathname;
const { seedlingSeam, seedlingSkeletonSpec, seedlingModel } = await M('seedlingDemo/procgenSeedling.js');
const { bootStaging, solve, DEFAULT_BUDGET, assertBudget } = await M('seedlingDemo/procgenOracle.js');
const { floodTerrainsFor } = await M('seedlingDemo/procgenLevel.js');
const { parseElementSpec } = await M('procgenCore/elementSpec.js');
const { parseAreaSpec } = await M('procgenCore/areaSpec.js');
const palette = (await M('seedlingDemo/watchGenerate.js')).paletteWithTerrains(paletteName, '');
const [width, height] = sizeArg.split('x').map(Number);
const seed = Number(seedArg);
const elements = parseElementSpec('keygate');
const areas = parseAreaSpec('0');
const defaults = { width, height };
const skeleton = seedlingSkeletonSpec(kind);
const calls = [];
const wrap = (o) => ({ ...o, solve(record, opts) { const out = o.solve(record, opts);
    calls.push({ record: structuredClone(record), opts, out }); return out; } });
// 1. the sweep's own entry point, exactly as sweep-yield-table.mjs calls it
const seam = seedlingSeam({ seed, defaults, skeleton, elements, areas, items: palette.items ?? null,
    floodWalks: palette.floodWalks, wrapOracle: wrap });
const cert = seam.certification;
if (!cert || cert.gap !== 'the-goal-approach-is-blocked') throw new Error(`cell did not refuse as expected: ${JSON.stringify(cert?.gap)}`);
// 2. the certification call = the solve with no templates whose reason is the certification's
const hit = calls.find((c) => (c.opts?.templates ?? []).length === 0 && c.out.reasonText === cert.reasonText) ?? calls[0];
// 3. rebuild the request the oracle closed over (the same seedlingModel call the seam makes) and replay it
const items = palette.items ?? null;
const model = seedlingModel({ seed, floodTerrains: floodTerrainsFor(items, palette.floodWalks), defaults, skeleton, elements, areas });
const record = model.skeleton();
if (!isDeepStrictEqual(JSON.parse(JSON.stringify(record)), JSON.parse(JSON.stringify(hit.record)))) throw new Error('rebuilt record differs from the certified one');
const { pinsForRecord } = await M('seedlingDemo/procgenSeedling.js');
const pinsReal = pinsForRecord(record, []);
const staging = bootStaging({ boot: model.boot(), items, pins: pinsReal });
const budget = assertBudget(DEFAULT_BUDGET);
const name = `procgen-l${record.level}`;
const replay = solve(record, staging, model.goals, budget, { name });
const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : v)));
const request = { config: { substrate: 'seedling', kind, size: sizeArg, seed, arm: paletteName, elements: 'keygate', areas: '0',
    sweepCommand: `node scripts/procgen/sweep-yield-table.mjs --substrate=seedling --kinds=${kind} --sizes=${sizeArg} --elements='keygate' --palette=${paletteName} --seeds=${seed} --count=3 --tries=4 --k=3 --anchortries=1 --cellbudget=600` },
    call: 'procgenOracle.solve(levelRecord, staging, goals, budget, { name })',
    levelRecord: strip(record), staging: strip(staging), goals: strip(model.goals), budget: strip(budget), opts: { name } };
const answer = { certification: strip(cert), seamSolveAnswer: strip(hit.out), replayAnswer: strip(replay),
    replayMatchesSeam: replay.verdict === hit.out.verdict && replay.reasonText === hit.out.reasonText };
writeFileSync(join(OUT, 'request.json'), JSON.stringify(request, null, 2) + '\n');
writeFileSync(join(OUT, 'answer.json'), JSON.stringify(answer, null, 2) + '\n');
console.log(JSON.stringify({ calls: calls.length, verdict: replay.verdict, gap: cert.gap, replayMatchesSeam: answer.replayMatchesSeam, reason: replay.reasonText }));
