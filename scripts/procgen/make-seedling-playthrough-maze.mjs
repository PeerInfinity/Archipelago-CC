#!/usr/bin/env node
/**
 * The `seedling_playthrough_maze` preset: Seedling's PLAYTHROUGH atlas, restricted to a growing list of
 * levels, projected into the MAZE substrate (tile-primitives Stage 2, session tile-primitives-stage2-l15).
 *
 * ⚖ The user, 2026-10-21: "New tiny preset. I'll want to gradually expand it to include all of Seedling."
 * So the preset is named for that growth, and `LEVELS` below is the one place it grows: add a region id,
 * regenerate, and every level with an INTERACTION (a block, a button, a rock — derived from the semantics
 * tables, never listed by hand) plays as one shared level world; the rest project as they always have.
 *
 * The restricted atlas is the playthrough atlas with:
 *   - only the listed regions, each played in the maze (their `substrate: flash_seedling` dropped — the
 *     compile's maze flavour is the default);
 *   - only the vanilla connections between listed regions (the others are UNWIRED and omitted, which the
 *     compile report names);
 *   - the playthrough's start when its region is listed, else `START_LEVEL` (else the first listed region),
 *     at its first sub-region;
 *   - its identity restamped (a different document must not keep the source's content hash).
 * The shared-world ownership comes from the playthrough atlas's OWN persisted partition
 * (`atlases/seedling-subregion-partition.json`, keyed by the SOURCE atlas id).
 *
 * ⛓ THE GRID IS THE ATLAS'S OWN (session tile-primitives-levels-gap3; ⚖ the user, 2026-10-21: "Atlas's own
 * grid"). The playthrough atlas was analysed on its generator's OVERLAY grid over the DELIVERED (set-patched)
 * rooms, so the projection recomputes on exactly that (`playthroughGridFor` + `playthroughAnalyzerOptions`,
 * the pair the partition generator re-runs) and reads the entity rows off the delivered rooms too. On the
 * raw transcription 45 of the 115 regions disagreed with their own atlas (overlay cells, pruned pockets).
 *
 * Deterministic, so `--check` is an exact byte gate.
 *
 * Usage:
 *   node scripts/procgen/make-seedling-playthrough-maze.mjs [--check] [--quiet]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRegionAtlas, formatCompileReport } from '../../frontend/modules/procgenPipeline/regionAtlasCompiler.js';
import { stampAtlasIdentity } from '../../frontend/modules/procgenPipeline/regionAtlasValidator.js';
import { stringifyRulesJson } from '../../frontend/modules/shared/rulesJsonBuilder.js';
import { seedlingMazeProjectionDeps } from '../../frontend/modules/flashPanel/seedlingAtlasAnalysis.js';
import {
    PLAYTHROUGH_MAP, playthroughGridFor, playthroughAnalyzerOptions,
} from './make-seedling-playthrough-rules.mjs';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ATLAS_DIR = resolve(REPO, 'frontend/modules/flashPanel/atlases');
export const OUT_FILE = resolve(REPO, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json');

/** ⚖ The levels this preset carries, in atlas order. It GROWS (the user's ruling above). */
export const LEVELS = Object.freeze(['level_13', 'level_14', 'level_15', 'level_16', 'level_17']);

/**
 * Where the preset starts while the playthrough's own start (level_0) is not listed. Pinned rather than "the
 * first listed": growing LEVELS outward (⚖ "L13 + L17", session tile-primitives-grow-levels) put L13 first in
 * atlas order, and the start is what the in-app row and the sphere log are measured from.
 */
export const START_LEVEL = 'level_14';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** The playthrough atlas cut down to `levels`, restamped. Pure. */
export function restrictAtlas(atlas, levels, { start: fallback } = {}) {
    const keep = new Set(levels);
    const missing = levels.filter((id) => !atlas.regions.some((r) => r.region_id === id));
    if (missing.length > 0) throw new Error(`the playthrough atlas has no region(s) ${missing.join(', ')}`);
    const regions = atlas.regions.filter((r) => keep.has(r.region_id))
        // eslint-disable-next-line no-unused-vars
        .map(({ substrate, ...rest }) => rest);
    const layout = atlas.vanilla_layout ?? {};
    const startKept = keep.has(layout.start_region);
    const startRegion = regions.find((r) => r.region_id === fallback) ?? regions[0];
    const start = startKept ? layout.start_region : startRegion.region_id;
    const startSub = startKept ? layout.start_sub_region : startRegion.subgraph?.sub_regions?.[0];
    const restricted = {
        ...atlas,
        regions,
        vanilla_layout: {
            ...layout,
            start_region: start,
            ...(startSub !== undefined ? { start_sub_region: startSub } : {}),
            connections: (layout.connections ?? []).filter((c) => keep.has(c.from[0]) && keep.has(c.to[0])),
        },
    };
    if (startSub === undefined) delete restricted.vanilla_layout.start_sub_region;
    return stampAtlasIdentity(restricted, 'seedling');
}

/** Compile the preset (or, for a measurement, the playthrough restricted to `levels`). Returns `{text, report}`. */
export function buildPlaythroughMaze({ levels = LEVELS } = {}) {
    const atlas = readJson(resolve(ATLAS_DIR, 'seedling-playthrough.json'));
    const mapDoc = readJson(resolve(ATLAS_DIR, atlas.tile_space.map_document));
    const gameConfig = readJson(resolve(REPO, 'frontend/modules/flashPanel/games/seedling.json'));
    const partitionDoc = readJson(resolve(ATLAS_DIR, 'seedling-subregion-partition.json'));
    const partition = partitionDoc.atlases?.[atlas.atlas_id];
    if (!partition) {
        throw new Error(`the sub-region partition has no entry for "${atlas.atlas_id}" — run make-seedling-subregion-partition.mjs`);
    }
    const mazeProjection = seedlingMazeProjectionDeps({
        mapDoc: PLAYTHROUGH_MAP,
        gameConfig,
        levelWorlds: { partition },
        analysis: {
            gridForLevel: (level) => playthroughGridFor(level),
            conditionKey: playthroughAnalyzerOptions.conditionKey,
            resolveCondition: playthroughAnalyzerOptions.resolveCondition,
        },
    });
    const { rules, report } = compileRegionAtlas(restrictAtlas(atlas, levels, { start: START_LEVEL }), {
        mapDoc,
        embedSphereLog: true,
        sidecarFlavor: 'maze',
        mazeProjection,
    });
    return { text: `${stringifyRulesJson(rules)}\n`, report, unresolved: mazeProjection.unresolved ?? [] };
}

if (isEntryPoint(import.meta.url)) {
    const check = process.argv.includes('--check');
    const quiet = process.argv.includes('--quiet');
    let built;
    try {
        built = buildPlaythroughMaze();
    } catch (e) {
        console.error(`ERROR: ${e.message}`);
        process.exit(1);
    }
    if (!quiet) for (const line of formatCompileReport(built.report)) console.log(line);
    const rel = OUT_FILE.slice(REPO.length + 1);
    if (check) {
        if (!existsSync(OUT_FILE)) {
            console.error(`FAIL: ${rel} does not exist — run without --check to write it`);
            process.exit(1);
        }
        if (readFileSync(OUT_FILE, 'utf8') !== built.text) {
            console.error(`FAIL: ${rel} is not what the playthrough atlas compiles to — regenerate it`);
            process.exit(1);
        }
        console.log(`OK: ${rel} is byte-identical to the compiled atlas`);
        process.exit(0);
    }
    mkdirSync(dirname(OUT_FILE), { recursive: true });
    writeFileSync(OUT_FILE, built.text);
    if (!quiet) console.log(`wrote ${rel} (${built.text.length} bytes)`);
}
