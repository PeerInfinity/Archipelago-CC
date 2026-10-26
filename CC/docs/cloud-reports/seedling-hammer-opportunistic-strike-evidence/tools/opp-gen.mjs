const D = (process.env.OPP_ROOT ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { paletteFor } = await import(D + 'watchGenerate.js');
const { generateSeedlingLevel, seedlingSkeletonSpec } = await import(D + 'procgenSeedling.js');
const { parseElementSpec } = await import((process.env.OPP_ROOT ?? '/home/user/Archipelago-CC') + '/frontend/modules/procgenCore/elementSpec.js');
const seed = Number(process.env.SEED ?? 30);
const t0 = Date.now();
const out = generateSeedlingLevel({ seed, palette: paletteFor(process.env.PALETTE ?? 'post-sword'),
    bounds: { obstacleTarget: Number(process.env.TARGET ?? 3) }, skeleton: seedlingSkeletonSpec(process.env.SKEL ?? 'empty'), ...(process.env.ELEM ? { elements: parseElementSpec(process.env.ELEM) } : {}) });
console.log(`# elements placed: ${JSON.stringify(out.model?.elements?.placed ?? null).slice(0, 300)}`);
console.log(`# generated seed ${seed}: stop ${out.summary.stop}, finalTicks ${out.summary.finalTicks}, ${((Date.now() - t0) / 1000).toFixed(1)} s, digest ${JSON.stringify(out.summary).length}`);
console.log(`# summary: ${JSON.stringify(out.summary).slice(0, 400)}`);
if (process.env.OPP_SCRIPT) await import(process.env.OPP_SCRIPT);
globalThis.__oppReport(Boolean(process.env.MISSES));
