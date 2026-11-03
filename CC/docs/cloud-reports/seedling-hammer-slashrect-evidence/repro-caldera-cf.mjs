// Rebuild the lab's COUNTERFACTUAL caldera sweep: caldera's items and terrain WITHOUT its
// melt flood widening (floodWalks), element set `empty`, 8 obstacles. Usage:
//   node CC/docs/cloud-reports/seedling-hammer-slashrect-evidence/repro-caldera-cf.mjs [seeds=1-12] [--stack]
import { createHash } from 'node:crypto';
import { CALDERA_PALETTE } from '../../../../frontend/modules/seedlingDemo/procgenPalette.js';
import { generateSeedlingLevel, seedlingSkeletonSpec } from '../../../../frontend/modules/seedlingDemo/procgenSeedling.js';
const spec = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '1-12';
const [a, b] = spec.split('-').map(Number);
const palette = { ...CALDERA_PALETTE, floodWalks: undefined };
for (let seed = a; seed <= (b ?? a); seed++) {
    const t0 = Date.now();
    try {
        const out = generateSeedlingLevel({ seed, palette,
            bounds: { obstacleTarget: 8, triesPerStep: 4, saturationK: 4 }, skeleton: seedlingSkeletonSpec('empty') });
        console.log(JSON.stringify({ seed, stop: out.summary.stop, record: createHash('sha256').update(JSON.stringify(out.record)).digest('hex').slice(0, 16),
            trace: createHash('sha256').update(JSON.stringify(out.trace.map((r) => [r.instance, r.at, r.outcome, r.verdict]))).digest('hex').slice(0, 16), ms: Date.now() - t0 }));
    } catch (e) {
        console.log(JSON.stringify({ seed, ABORT: `${e.name}: ${e.message}`, ms: Date.now() - t0 }));
        if (process.argv.includes('--stack')) console.log(e.stack);
    }
}
