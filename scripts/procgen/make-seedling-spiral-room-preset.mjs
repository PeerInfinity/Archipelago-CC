#!/usr/bin/env node
/**
 * Write the `seedling_spiral_room` preset: the shuffled-spiral world with ONE
 * real Seedling room (seedling-in-the-pipeline T2), built headless from
 * `SEEDLING_SPIRAL_ROOM_STATE` in `procgenPipeline/presetDefs.js`.
 *
 * The preset is a FUNCTION of that committed state, never a hand edit: this
 * script builds it through `presetRun.js` — the assembly the Procgen Pipeline
 * panel's Generate calls (`buildRunFromState` → `runPresetHeadless`) — with the
 * panel's whole registry loaded (`REGISTRY_LIBRARIES`), and writes the rules.json
 * the way the sibling JS-pipeline presets are written (`JSON.stringify(…, null, 2)`,
 * `dump-sphere-growth.js --rules-out`). `--check` rebuilds and compares bytes
 * (the `make-seedling-starter-atlas.mjs --check` precedent), so a change to the
 * engine, the maze generator or the flash_seedling content source that moves
 * this world goes red here rather than leaving a stale preset behind.
 *
 * Registration is separate and done once (`scripts/utils/register-preset.py
 * --game-id seedling_spiral_room <file>`); it is a dev preset, listed in
 * `scripts/release/preserved-dev-presets.txt`, not in `preset_files.live.json`.
 * The box gate that PLAYS it is `check-seedling-spiral-room-play.mjs`.
 *
 * Usage:
 *   node scripts/procgen/make-seedling-spiral-room-preset.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const OUT_FILE = path.join(repoRoot, 'frontend/presets/seedling_spiral_room/AP_1/AP_1_rules.json');
const imp = (rel) => import(pathToFileURL(path.join(repoRoot, rel)));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

async function main() {
    const { REGISTRY_LIBRARIES } = await import('./reference/registry.mjs');
    for (const rel of REGISTRY_LIBRARIES) {
        // eslint-disable-next-line no-await-in-loop
        await imp(rel);
    }
    const { SEEDLING_SPIRAL_ROOM_STATE } = await imp('frontend/modules/procgenPipeline/presetDefs.js');
    const { buildRunFromState, runPresetHeadless } = await imp('frontend/modules/procgenPipeline/presetRun.js');

    const { rulesJson, ms } = await runPresetHeadless(buildRunFromState(structuredClone(SEEDLING_SPIRAL_ROOM_STATE)));
    const text = JSON.stringify(rulesJson, null, 2);
    const rel = path.relative(repoRoot, OUT_FILE);
    const sidecars = Object.entries(rulesJson.preset_sidecars?.['1'] ?? {});
    const summary = `${sidecars.length} regions (${sidecars.map(([r, s]) => `${r}:${s.substrate}`).join(', ')}), `
        + `start ${rulesJson.regions['1'].Menu.exits[0].connected_region}, built in ${ms} ms`;

    if (process.argv.includes('--check')) {
        const committed = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : null;
        if (committed !== text) {
            console.error(`ERROR: ${rel} differs from a fresh build of SEEDLING_SPIRAL_ROOM_STATE`
                + `${committed === null ? ' (the file is missing)' : ''} — ${summary}`);
            process.exit(1);
        }
        console.log(`OK: ${rel} matches a fresh build — ${summary}`);
    } else {
        fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
        fs.writeFileSync(OUT_FILE, text);
        console.log(`wrote ${rel} — ${summary}`);
    }
}
