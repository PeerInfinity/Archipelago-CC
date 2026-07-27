#!/usr/bin/env node
// Region-atlas validate/restamp CLI — the hand-authoring helper for the
// per-game map-partition format (CC/docs/plans/region-atlas-plan.md, Phase 1).
// Structural + content-hash validation of an atlas JSON file, with an optional
// --restamp that recomputes the content hash and rewrites the atlas_id suffix
// after a deliberate hand edit (the restamp is what invalidates the downstream
// projections keyed on atlas_id).
//
// Usage:
//   node scripts/procgen/region-atlas-validate.mjs [--restamp] <atlas.json>
import { readFileSync, writeFileSync } from 'node:fs';

import {
    validateRegionAtlas,
    stampAtlasIdentity,
} from '../../frontend/modules/procgenPipeline/regionAtlasValidator.js';

const argv = process.argv.slice(2);
const restamp = argv.includes('--restamp');
const file = argv.find((a) => !a.startsWith('--'));
if (!file) {
    console.error('usage: node scripts/procgen/region-atlas-validate.mjs [--restamp] <atlas.json>');
    process.exit(2);
}

const atlas = JSON.parse(readFileSync(file, 'utf8'));
if (restamp) {
    const oldId = atlas.atlas_id;
    stampAtlasIdentity(atlas);
    writeFileSync(file, `${JSON.stringify(atlas, null, 2)}\n`);
    console.log(`restamped: ${oldId} -> ${atlas.atlas_id}`);
}

const result = validateRegionAtlas(atlas);
for (const w of result.warnings) console.log(`WARN: ${w}`);
for (const e of result.errors) console.error(`ERROR: ${e}`);
if (result.ok) {
    const s = result.stats;
    console.log(
        `OK: ${atlas.atlas_id} — ${s.regions} regions, ${s.sub_regions} sub-regions, `
        + `${s.exits} exits, ${s.locations} locations, ${s.connections} connections `
        + `(${result.warnings.length} warnings)`,
    );
}
process.exit(result.ok ? 0 : 1);
