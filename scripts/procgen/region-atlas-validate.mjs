#!/usr/bin/env node
// Region-atlas validate/restamp CLI — the hand-authoring helper for the
// per-game map-partition format (CC/docs/plans/region-atlas-plan.md, Phase 1).
// Structural + content-hash validation of an atlas JSON file, with an optional
// --restamp that recomputes the content hash and rewrites the atlas_id suffix
// after a deliberate hand edit (the restamp is what invalidates the downstream
// projections keyed on atlas_id).
//
// --restamp rewrites through the compact writer (Phase 2, Deliverable 4), the
// same one the marking tool saves with, so a restamp produces the file the tool
// would have produced. It used to use JSON.stringify(…, 2), which exploded
// every tile pair to one number per line and made the flag unusable on a
// hand-maintained document.
//
// When the atlas names a map-source document (tile_space.map_document), it is
// loaded from beside the atlas and every region's map_ref is resolved against
// it. A missing map document is a warning, not an error: the atlas is still
// structurally checkable without it.
//
// Usage:
//   node scripts/procgen/region-atlas-validate.mjs [--restamp] <atlas.json>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
    validateRegionAtlas,
    stampAtlasIdentity,
} from '../../frontend/modules/procgenPipeline/regionAtlasValidator.js';
import { compactJsonFile } from '../../frontend/modules/procgenPipeline/compactJson.js';

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
    writeFileSync(file, compactJsonFile(atlas));
    console.log(`restamped: ${oldId} -> ${atlas.atlas_id}`);
}

const mapName = atlas.tile_space?.map_document;
let mapDoc;
if (typeof mapName === 'string' && mapName.length > 0) {
    const mapPath = resolve(dirname(resolve(file)), mapName);
    if (existsSync(mapPath)) {
        mapDoc = JSON.parse(readFileSync(mapPath, 'utf8'));
    } else {
        console.log(`WARN: tile_space.map_document "${mapName}" not found beside the atlas — map_ref values are unresolved`);
    }
}

const result = validateRegionAtlas(atlas, mapDoc === undefined ? {} : { mapDoc });
for (const w of result.warnings) console.log(`WARN: ${w}`);
for (const e of result.errors) console.error(`ERROR: ${e}`);
if (result.ok) {
    const s = result.stats;
    console.log(
        `OK: ${atlas.atlas_id} — ${s.regions} regions, ${s.sub_regions} sub-regions, `
        + `${s.exits} exits, ${s.locations} locations, ${s.connections} connections `
        + `(${result.warnings.length} warnings${mapDoc ? `, map_ref resolved against ${mapName}` : ''})`,
    );
}
process.exit(result.ok ? 0 : 1);
