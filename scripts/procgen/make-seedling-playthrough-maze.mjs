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
import { apRegionName } from '../../frontend/modules/procgenPipeline/regionAtlasValidator.js';
import { SHARED_WORLD_ALPHABET } from '../../frontend/modules/procgenPipeline/regionAtlasMazeProjection.js';
import { SEEDLING_TILE_SIZE } from '../../frontend/modules/flashPanel/seedlingSemantics.js';
import {
    PLAYTHROUGH_MAP, playthroughGridFor, playthroughAnalyzerOptions, playthroughRopeEvents,
    setPlaythroughLandingAtlas, playthroughLandingGates, buildPlaythroughAtlas, playthroughEventLayer,
} from './make-seedling-playthrough-rules.mjs';
import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ATLAS_DIR = resolve(REPO, 'frontend/modules/flashPanel/atlases');
export const OUT_FILE = resolve(REPO, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json');

/**
 * ⚖ The levels this preset carries, in atlas order. It GROWS (the user's ruling above) — since session
 * tile-primitives-sphere-order-1 in the FIRST-REACH order of the `seedling_playthrough` seed-1 sphere log (⚖ 2026-10-25:
 * "Start adding levels, and the features they require, in the order of the other playthrough's sphere log"): sphere 0's
 * L2–L11 + L94 joined L0 + L13–L20; L86, the last of sphere 0, once its landing under L0's building1 was floor (the
 * playthrough grid takes a building's footprint from its Pixelmask, session tile-primitives-pixelmask-l86).
 */
export const LEVELS = Object.freeze([
    'level_0', 'level_2', 'level_3', 'level_4', 'level_5', 'level_6', 'level_7', 'level_8', 'level_9', 'level_10', 'level_11',
    'level_13', 'level_14', 'level_15', 'level_16', 'level_17', 'level_18', 'level_19', 'level_20', 'level_86', 'level_94',
]);

/**
 * Where the preset starts while the playthrough's own start (level_0) is not listed. Pinned rather than "the
 * first listed": growing LEVELS outward (⚖ "L13 + L17", session tile-primitives-grow-levels) put L13 first in
 * atlas order, and the start is what the in-app row and the sphere log are measured from. With level_0 listed
 * (ring 2, ⚖ "level_0, row walks in", session tile-primitives-grow-ring2) the preset starts where the game does
 * and this is only the fallback for a batch without it.
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

/**
 * ⛓ ARROW TRAPS + ROPES (session tile-primitives-arrow-rope, ⚖ 2026-10-22 "Both: this visit + event item") — the
 * playthrough rules' ROPE EVENTS for `levels`: each minted rope's event location (cut in the sub-region its tile
 * borders) and the exit gates of the game landings in its lane (L17's stairs land in L16's lane: that departure
 * costs the cut). Derived by the rules producer (`playthroughRopeEvents`); PLACE is read off the atlas's persisted
 * partition, the same rule, since this compile does not run the producer's analysis pass. A gate or event whose
 * ends are not all in `levels` is left out (its exit is not wired here).
 */
export function ropeEventsFor(atlas, partition, levels) {
    const keep = new Set(levels);
    const place = (row) => {
        const region = atlas.regions.find((r) => r.map_ref === row.level);
        const part = partition.regions?.[region?.region_id];
        if (!region?.subgraph?.sub_regions) return { region_id: region.region_id, side: apRegionName(region.region_id) };
        if (!part) throw new Error(`rope events: the partition has no entry for ${region.region_id}`);
        const [x, y] = [Math.floor(row.x / SEEDLING_TILE_SIZE), Math.floor(row.y / SEEDLING_TILE_SIZE)];
        const [px, py] = part.origin ?? [0, 0];
        const beside = new Set([[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]]
            .map(([nx, ny]) => part.rows[ny - py]?.[nx - px]).filter((ch) => ch && ch !== '.')
            .map((ch) => part.sub_regions[SHARED_WORLD_ALPHABET.indexOf(ch)]));
        if (beside.size !== 1) {
            throw new Error(`rope events: L${row.level} rope@${row.x},${row.y} borders sub-regions [${[...beside].join(', ')}] — one was expected`);
        }
        const [sub] = beside;
        return { region_id: region.region_id, sub_region: sub, side: apRegionName(region.region_id, sub) };
    };
    const { events, exitGates } = playthroughRopeEvents(atlas, { place });
    const conns = atlas.vanilla_layout?.connections ?? [];
    return {
        events: events.filter((e) => keep.has(e.region_id)),
        exitGates: exitGates.filter((g) => keep.has(g.region_id) && conns.some((c) => c.from[0] === g.region_id
            && c.from[1] === g.exit_id && keep.has(c.to[0]))),
    };
}

/**
 * ⛓ LANDING GATES (session tile-primitives-gated-tiles, ⚖ 2026-10-22 "Landing gates now") — the playthrough rules'
 * `exitGates` for a landing on LETHAL terrain (L49 → L50 lands in water: the departure costs the Swim), for `levels`.
 * Derived by the rules producer (`playthroughLandingGates`) over the WHOLE atlas, never hand-coded: the maze world
 * already gates that water, and without these the preset's AP layer was looser than its own world (the whole-game
 * certifier: 17 exits). A gate whose crossing is not wired inside `levels` is left out, as `ropeEventsFor` does.
 */
export function landingGatesFor(atlas, levels) {
    const keep = new Set(levels);
    setPlaythroughLandingAtlas(atlas);
    const conns = atlas.vanilla_layout?.connections ?? [];
    return playthroughLandingGates(atlas).filter((g) => keep.has(g.region_id) && conns.some((c) => (
        (c.from[0] === g.region_id && c.from[1] === g.exit_id && keep.has(c.to[0]))
        || (c.one_way !== true && c.to[0] === g.region_id && c.to[1] === g.exit_id && keep.has(c.from[0])))));
}

/** The rules producer's event layer over the WHOLE playthrough atlas, built once per process (its analysis pass). */
let producerLayer = null;
function wholeEventLayer(atlas) {
    if (!producerLayer) {
        const doc = buildPlaythroughAtlas();
        if (JSON.stringify(doc) !== JSON.stringify(atlas)) {
            throw new Error('the playthrough atlas is stale against its producer — run make-seedling-playthrough-rules.mjs');
        }
        setPlaythroughLandingAtlas(doc);
        producerLayer = playthroughEventLayer(doc);
    }
    return producerLayer;
}

/**
 * ⛓ EVENTS AS LOCATIONS (session tile-primitives-events-as-locations, ⚖ 2026-10-23 "All AP; world rocks+locks" +
 * "Carry + name") — the playthrough rules' OBSTACLE, LOCK, BUTTON and TALK events for `levels`, with the exit gates
 * and the latched locks' internal exit rules they bring. Derived by the rules producer (`playthroughEventLayer`, the
 * one function its own compile calls), never hand-coded: without them the preset's AP layer was looser than the game
 * wherever a crossing depends on an event (whole game: 24 event locations, 18 gated exits, 10 lock returns). An event
 * the maze world cannot produce (a cross-room button, a talk) is carried all the same, so the AP layer is never looser
 * than the game; the certifier names it. A row whose region (or, for a gate, whose crossing) is not in `levels` is
 * left out, as `ropeEventsFor` does; a kept rule naming an event this compile does not mint throws by name.
 */
export function eventLayerFor(atlas, levels, { minted = [] } = {}) {
    const keep = new Set(levels);
    const layer = wholeEventLayer(atlas);
    const conns = atlas.vanilla_layout?.connections ?? [];
    const out = {
        events: layer.events.filter((e) => keep.has(e.region_id)),
        internalExitRules: layer.internalExitRules.filter((r) => keep.has(r.region_id)),
        exitGates: layer.exitGates.filter((g) => keep.has(g.region_id) && conns.some((c) => c.from[0] === g.region_id
            && c.from[1] === g.exit_id && keep.has(c.to[0]))),
    };
    // The events the maze WORLD models (⚖ "All AP; world rocks+locks"): an obstacle's opens it once carried, a latched
    // lock's is what its far side's crossing costs. A cross-room press or a talk has no world mechanism (⚖ "Carry + name").
    const mode = new Map([...layer.obstacle.events.map((e) => [e.name, 'open']), ...layer.locks.events.map((e) => [e.name, 'latch'])]);
    // `rule` = the event's own location rule: a sub-region world lays a touched lock no crossing uses by it (⚖ "Lay
    // touched event cells", session tile-primitives-sphere-order-2).
    out.world = out.events.filter((e) => mode.has(e.name)).map((e) => ({
        name: e.name, side: e.fields.side, mode: mode.get(e.name), obstacle: e.fields.obstacle, rule: e.access_rule ?? null,
    }));
    const all = new Set(layer.events.map((e) => e.name));
    const have = new Set([...out.events.map((e) => e.name), ...minted]);
    const named = (rule, acc = []) => {
        if (rule?.rule === 'Has' && all.has(rule.args.item_name)) acc.push(rule.args.item_name);
        for (const c of rule?.children ?? []) named(c, acc);
        return acc;
    };
    for (const [what, rule] of [
        ...out.events.map((e) => [`event "${e.name}"`, e.access_rule]),
        ...out.internalExitRules.map((r) => [`${r.region_id} ${r.from} -> ${r.to}`, r.rule]),
        ...out.exitGates.map((g) => [`${g.region_id}/${g.exit_id}`, g.rule]),
    ]) {
        const stray = named(rule).filter((n) => !have.has(n));
        if (stray.length) throw new Error(`events: ${what} needs ${stray.join(', ')}, whose region is not in the levels`);
    }
    return out;
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
    const ropes = ropeEventsFor(atlas, partition, levels);
    const layer = eventLayerFor(atlas, levels, { minted: ropes.events.map((e) => e.name) });
    const mazeProjection = seedlingMazeProjectionDeps({
        mapDoc: PLAYTHROUGH_MAP,
        events: layer.world,
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
        events: [...layer.events, ...ropes.events],
        internalExitRules: layer.internalExitRules,
        exitGates: [...layer.exitGates, ...landingGatesFor(atlas, levels), ...ropes.exitGates],
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
