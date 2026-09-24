#!/usr/bin/env node
/**
 * Write a one-room Seedling preset, built headless from its state in
 * `procgenPipeline/presetDefs.js` (`--state=`, default `spiral`):
 *
 *   spiral → `seedling_spiral_room`: the shuffled-spiral world with ONE real
 *            Seedling room as the start region (seedling-in-the-pipeline T2),
 *            from `SEEDLING_SPIRAL_ROOM_STATE`;
 *   sphere → `seedling_sphere_room`: the sphere-growth world with ONE real
 *            Seedling room as a LEAF behind a maze gate (T3), from
 *            `SEEDLING_SPHERE_ROOM_STATE`;
 *   generated → `seedling_generated_room`: the shuffled spiral with TWO
 *            GENERATED Seedling rooms (`flash_seedling_gen`) and two maze rooms,
 *            the start room holding an AP item (seedling generated G2), from
 *            `SEEDLING_GENERATED_ROOM_STATE`;
 *   generated-leaf → `seedling_generated_leaf`: the sphere-growth world with ONE
 *            GENERATED Seedling room as a LEAF behind a maze gate, holding the
 *            victory item (seedling generated G3), from
 *            `SEEDLING_GENERATED_LEAF_STATE`.
 *
 * ONE recipe, four states: the same assembly, the same bytes rule, the same
 * `--check`.
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
 * Registration is separate and done once per preset
 * (`scripts/utils/register-preset.py --game-id <game id> <file>`); each is a dev
 * preset, listed in `scripts/release/preserved-dev-presets.txt`, not in
 * `preset_files.live.json`. The box gates that PLAY them are
 * `check-seedling-spiral-room-play.mjs`, `check-seedling-sphere-room-play.mjs`,
 * `check-seedling-generated-room-play.mjs` and `check-seedling-generated-leaf-play.mjs`.
 *
 * Usage:
 *   node scripts/procgen/make-seedling-spiral-room-preset.mjs [--state=spiral|sphere|generated|generated-leaf] [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
/** Each preset this recipe writes: the presetDefs export it is a function of, and where it goes. */
const PRESETS = Object.freeze({
    spiral: Object.freeze({ stateExport: 'SEEDLING_SPIRAL_ROOM_STATE', gameId: 'seedling_spiral_room' }),
    sphere: Object.freeze({ stateExport: 'SEEDLING_SPHERE_ROOM_STATE', gameId: 'seedling_sphere_room' }),
    generated: Object.freeze({ stateExport: 'SEEDLING_GENERATED_ROOM_STATE', gameId: 'seedling_generated_room' }),
    'generated-leaf': Object.freeze({ stateExport: 'SEEDLING_GENERATED_LEAF_STATE', gameId: 'seedling_generated_leaf' }),
});
const imp = (rel) => import(pathToFileURL(path.join(repoRoot, rel)));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

async function main() {
    const choice = process.argv.find((a) => a.startsWith('--state='))?.slice('--state='.length) ?? 'spiral';
    const preset = PRESETS[choice];
    if (!preset) {
        console.error(`ERROR: --state=${choice} names no preset of this recipe — choose one of `
            + `${Object.keys(PRESETS).join(', ')}`);
        process.exit(2);
    }
    const OUT_FILE = path.join(repoRoot, `frontend/presets/${preset.gameId}/AP_1/AP_1_rules.json`);
    const { REGISTRY_LIBRARIES } = await import('./reference/registry.mjs');
    for (const rel of REGISTRY_LIBRARIES) {
        // eslint-disable-next-line no-await-in-loop
        await imp(rel);
    }
    const { [preset.stateExport]: state } = await imp('frontend/modules/procgenPipeline/presetDefs.js');
    const { buildRunFromState, runPresetHeadless } = await imp('frontend/modules/procgenPipeline/presetRun.js');

    const { rulesJson, ms } = await runPresetHeadless(buildRunFromState(structuredClone(state)));
    const text = JSON.stringify(rulesJson, null, 2);
    const rel = path.relative(repoRoot, OUT_FILE);
    const sidecars = Object.entries(rulesJson.preset_sidecars?.['1'] ?? {});
    const summary = `${sidecars.length} regions (${sidecars.map(([r, s]) => `${r}:${s.substrate}`).join(', ')}), `
        + `start ${rulesJson.regions['1'].Menu.exits[0].connected_region}, built in ${ms} ms`;

    if (process.argv.includes('--check')) {
        const committed = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : null;
        if (committed !== text) {
            console.error(`ERROR: ${rel} differs from a fresh build of ${preset.stateExport}`
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
