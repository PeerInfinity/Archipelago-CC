// Capture the solve request that throws `slashRect: direction -1` on the caldera
// COUNTERFACTUAL (caldera's items + terrain, WITHOUT `floodWalks`), `empty`, 8 obstacles.
// Writes { record, staging, goals, budget, name } of the FIRST solve that throws a
// non-verdict error. Usage: node capture-seed7.mjs [seed=7] [out.json]
import { writeFileSync } from 'node:fs';
import { CALDERA_PALETTE } from '../../../../frontend/modules/seedlingDemo/procgenPalette.js';
import { seedlingSeam, seedlingSkeletonSpec } from '../../../../frontend/modules/seedlingDemo/procgenSeedling.js';
import { bootStaging, solve } from '../../../../frontend/modules/seedlingDemo/procgenOracle.js';
import { generateLevel } from '../../../../frontend/modules/procgenCore/levelGenerator.js';
import { rngFor } from '../../../../frontend/modules/seedlingDemo/procgenRng.js';

const seed = Number(process.argv[2] ?? 7);
const outPath = process.argv[3];
const palette = { ...CALDERA_PALETTE, floodWalks: undefined };
let captured = null;
const wrap = (o) => ({
    ...o,
    pinsFor: o.pinsFor,
    solve(record, opts = {}) {
        try { return o.solve.call(this, record, opts); } catch (e) {
            if (!captured) {
                const pins = o.pinsFor(opts.templates ?? [], record);
                captured = { record, pins, error: e };
            }
            throw e;
        }
    },
});
const { model, oracle } = seedlingSeam({ seed, items: palette.items, skeleton: seedlingSkeletonSpec('empty'),
    floodWalks: palette.floodWalks, wrapOracle: wrap });
try {
    generateLevel({ rng: rngFor(seed), model, oracle, palette,
        bounds: { obstacleTarget: 8, triesPerStep: 4, saturationK: 4 } });
    console.log('no throw');
} catch (e) {
    console.log(`${e.name}: ${e.message.slice(0, 200)}`);
}
if (captured) {
    console.log('INNER STACK:\n' + captured.error.stack);
    const staging = bootStaging({ boot: model.boot(), items: palette.items, pins: captured.pins });
    const req = { record: captured.record, staging, goals: model.goals, budget: oracle.budget,
        name: `procgen-l${captured.record.level}` };
    if (outPath) writeFileSync(outPath, JSON.stringify(req));
    // standalone replay
    try { solve(req.record, req.staging, req.goals, req.budget, { name: req.name }); console.log('REPLAY: no throw'); }
    catch (e) { console.log(`REPLAY: ${e.name}: ${e.message}`); }
}
