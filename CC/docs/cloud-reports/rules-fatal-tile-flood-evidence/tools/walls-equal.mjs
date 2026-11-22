// ⛓ rules-fatal-tile-flood — designer term 1, measured: over EVERY level of the delivered map, are the `wall` cells of
// `SEM.buildSeedlingRegionGrid` WITHOUT the producer's entityOverride (the build the prototype patch uses at import time)
// the same cells as the producer's analyzer grid (`playthroughGridFor`, the walls `playthroughLavaTrapPulls` reads)?
// `ROOT=<tree> node walls-equal.mjs`
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = process.env.ROOT ?? process.cwd();
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const P = await imp('scripts/procgen/make-seedling-playthrough-rules.mjs');
const OV = await imp('frontend/modules/flashPanel/seedlingPlaythroughOverlay.js');
const SEM = await imp('frontend/modules/flashPanel/seedlingSemantics.js');
let levels = 0; const diff = [];
for (const level of P.PLAYTHROUGH_MAP.levels) {
    levels += 1;
    const a = P.playthroughGridFor(level);
    const b = SEM.buildSeedlingRegionGrid({ x: 0, y: 0, w: level.width, h: level.height }, level, { tileOverride: OV.overlayTileSemantics, pixelMaskFootprints: true });
    for (let i = 0; i < a.cells.length; i += 1) {
        const wa = a.cells[i].kind === 'wall'; const wb = b.cells[i]?.kind === 'wall';
        if (wa !== wb) diff.push(`L${level.level} ${i % a.width},${Math.floor(i / a.width)} grid=${a.cells[i].kind} plain=${b.cells[i]?.kind}`);
    }
}
console.log(JSON.stringify({ root: ROOT, levels, differingCells: diff.length, diff: diff.slice(0, 50) }, null, 1));
