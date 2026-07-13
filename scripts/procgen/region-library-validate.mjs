#!/usr/bin/env node
// Region-library validate/restamp CLI — the hand-authoring helper
// (region-library-plan.md ruling 2, F1). Structural + content-hash validation
// of a region-library JSON file, with an optional --restamp that recomputes the
// content hash and rewrites the library_id suffix after a deliberate hand edit.
//
// Substrate-aware capability check: when the maze/bounce substrate libraries are
// importable, their `validateLibraryEntry` hook (F2) is wired as the validator's
// entryCapabilityCheck so a payload whose real exits/slots contradict the entry's
// denormalized capability metadata is rejected. Absent hooks ⇒ structural-only
// (a warning is printed).
//
// Usage:
//   node scripts/procgen/region-library-validate.mjs [--restamp] <library.json>
import { readFileSync, writeFileSync } from 'node:fs';

// Register the v1 library substrates so their capability hooks resolve.
import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import { substrateRegistry } from '../../frontend/modules/shared/procgen/substrateRegistry.js';
import {
    validateRegionLibrary,
    stampLibraryIdentity,
} from '../../frontend/modules/procgenPipeline/regionLibraryValidator.js';

const argv = process.argv.slice(2);
const restamp = argv.includes('--restamp');
const file = argv.find((a) => !a.startsWith('--'));
if (!file) {
    console.error('usage: node scripts/procgen/region-library-validate.mjs [--restamp] <library.json>');
    process.exit(2);
}

// Wire each substrate's capability hook (F2) if present; else structural-only.
let anyCapHook = false;
function entryCapabilityCheck(entry) {
    const adapter = substrateRegistry.get(entry.substrate);
    if (adapter && typeof adapter.validateLibraryEntry === 'function') {
        anyCapHook = true;
        return adapter.validateLibraryEntry(entry);
    }
    return {};
}

const library = JSON.parse(readFileSync(file, 'utf8'));
if (restamp) {
    const oldId = library.library_id;
    stampLibraryIdentity(library);
    writeFileSync(file, `${JSON.stringify(library, null, 2)}\n`);
    console.log(`restamped: ${oldId} -> ${library.library_id}`);
}

const result = validateRegionLibrary(library, { entryCapabilityCheck });
if (!anyCapHook) {
    console.log('note: no substrate capability hooks available — structural checks only');
}
for (const w of result.warnings) console.log(`WARN: ${w}`);
for (const e of result.errors) console.error(`ERROR: ${e}`);
if (result.ok) {
    const s = result.stats;
    const subs = Object.entries(s.substrates).map(([k, n]) => `${n} ${k}`).join(', ');
    console.log(`OK: ${library.library_id} — ${s.entries} entries (${subs}) (${result.warnings.length} warnings)`);
}
process.exit(result.ok ? 0 : 1);
