// Census of generated levels for direction-out-of-range throws (the `slashRect: direction -1` family).
// One line per (biome, seed): the stop, or the ABORT and the engine's sentence. `caldera-cf` is the lab's
// counterfactual (caldera's items + terrain WITHOUT `floodWalks`).
//   node census-direction-throws.mjs <biome> <seedFrom-seedTo> [skeleton=empty] [obstacles=8]
import { createHash } from 'node:crypto';
import { CALDERA_PALETTE } from '../../../../frontend/modules/seedlingDemo/procgenPalette.js';
import { generateSeedlingLevel, seedlingSkeletonSpec } from '../../../../frontend/modules/seedlingDemo/procgenSeedling.js';
import { paletteWithTerrains } from '../../../../frontend/modules/seedlingDemo/watchGenerate.js';

const [biome, range, skel = 'empty', obst = '8'] = process.argv.slice(2);
const [a, b] = range.split('-').map(Number);
const palette = biome === 'caldera-cf' ? { ...CALDERA_PALETTE, floodWalks: undefined } : paletteWithTerrains(biome, '');
for (let seed = a; seed <= (b ?? a); seed++) {
    const t0 = Date.now();
    let row;
    try {
        const out = generateSeedlingLevel({ seed, palette,
            bounds: { obstacleTarget: Number(obst), triesPerStep: 4, saturationK: 4 }, skeleton: seedlingSkeletonSpec(skel) });
        const sha = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
        row = { biome, skel, seed, stop: out.summary.stop, record: sha(out.record),
            trace: sha(out.trace.map((r) => [r.instance, r.at, r.outcome, r.verdict, r.reasonText ?? null])) };
    } catch (e) {
        const inner = e.cause ?? e;
        row = { biome, skel, seed, ABORT: inner.name, msg: String(inner.message).split('\n')[0].slice(0, 200),
            directionFamily: /direction .* is not 0\.\.3/.test(String(inner.message)) };
    }
    row.ms = Date.now() - t0;
    console.log(JSON.stringify(row));
}
