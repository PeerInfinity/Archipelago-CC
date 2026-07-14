#!/usr/bin/env node
/**
 * End-to-end round-trip verification for the region-library content source in
 * SPHERE-GROWTH mode with a MAZE library and the connection settings BOTH OFF
 * (region-library F6c — the maze analogue of the bounce/runner sphere roundtrips).
 * Proves that a sphere world mixing a committed MAZE library entry (relabelled onto
 * the needed child sides at its captured tiles) with generated maze regions survives
 * the whole toolchain and yields a WINNABLE seed:
 *
 *   committed demo pack (frontend/region-libraries/demo-maze-pack.json)
 *     → JS pipeline (growSpheres → buildRulesJson)   [library exits relabelled +
 *                                                      child gates overlaid as access_rules]
 *     → world_generator            (Locations.py, _worldgen_sidecars.json)
 *     → Generate.py                (exported rules.json + sphere log + spoiler)
 *
 * The INDEPENDENT stratum is Generate.py's fill: AP's own reachability solver places
 * the goal and emits a sphere log ONLY if the world is completable under the emitted
 * logic — it does NOT share the JS placement's assumptions. A library-placed region
 * IS a self-contained maze region (no library residency in the compiled world), and
 * its relocated locations must survive every hop and be reachable/checked. The
 * connection is side-based (stitchGrid), so a relabelled opening on the "wrong" tile
 * still connects in AP logic (the logic-looser-than-physics contract).
 *
 * Reuses the committed F3 demo-maze-pack (four 4-side, 2–3-slot rooms) rather than a
 * separate sphere pack — its entries already fit sphere slots; a new pack would just
 * duplicate them.
 *
 * Runs in a throwaway world/preset (region_library_sphere_maze*) and cleans up.
 * Requires the repo Python env. Run:
 *   node scripts/procgen/verify-region-library-sphere-roundtrip-maze.mjs
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const WORLD_DIR = path.join(repoRoot, 'worlds/region_library_sphere_maze_worldgen');
const GAME_NAME = 'Region Library Sphere Maze';
const PRESET_DIR = path.join(repoRoot, 'frontend/presets/region_library_sphere_maze_worldgen');
const PRESET_FILES_JSON = path.join(repoRoot, 'frontend/presets/preset_files.json');
const OUTPUT_DIR = path.join(repoRoot, 'output');
const LIBRARY_FILE = path.join(repoRoot, 'frontend/region-libraries/demo-maze-pack.json');
const SEED = Number(process.env.RL_SPH_SEED || 3);
const tmpRules = path.join(repoRoot, 'scripts/procgen/.rl-sphere-maze-rules.json');
const tmpTemplates = path.join(repoRoot, 'scripts/procgen/.rl-sphere-maze-templates');

const py = fs.existsSync(path.join(repoRoot, '.venv/bin/python'))
    ? path.join(repoRoot, '.venv/bin/python')
    : 'python3';

let failures = 0;
const ok = (cond, msg) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}: ${msg}`);
    if (!cond) failures++;
};
const run = (cmd, args, opts = {}) =>
    execFileSync(cmd, args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

const presetFilesBefore = fs.existsSync(PRESET_FILES_JSON)
    ? fs.readFileSync(PRESET_FILES_JSON, 'utf8') : null;

function cleanup() {
    fs.rmSync(tmpTemplates, { recursive: true, force: true });
    fs.rmSync(tmpRules, { force: true });
    if (process.env.RL_SPH_KEEP) {
        console.log(`\n[kept] world=${WORLD_DIR}\n[kept] preset=${PRESET_DIR}`);
        if (presetFilesBefore !== null) fs.writeFileSync(PRESET_FILES_JSON, presetFilesBefore);
        return;
    }
    for (const p of [WORLD_DIR, PRESET_DIR]) fs.rmSync(p, { recursive: true, force: true });
    if (fs.existsSync(OUTPUT_DIR)) {
        for (const f of fs.readdirSync(OUTPUT_DIR)) {
            if (/^AP_\d+\.zip$/.test(f)) fs.rmSync(path.join(OUTPUT_DIR, f), { force: true });
        }
    }
    if (presetFilesBefore !== null) fs.writeFileSync(PRESET_FILES_JSON, presetFilesBefore);
}

try {
    fs.rmSync(PRESET_DIR, { recursive: true, force: true });
    fs.rmSync(WORLD_DIR, { recursive: true, force: true });

    // --- Pass A: JS pipeline ------------------------------------------
    const imp = (p) => import(pathToFileURL(path.join(repoRoot, p)));
    await imp('frontend/modules/mazeRoom/mazeRoomLibrary.js'); // registers maze (+ bounce via its deps)
    const engine = await imp('frontend/modules/procgenPipeline/procgenPipelineEngine.js');
    const validator = await imp('frontend/modules/procgenPipeline/regionLibraryValidator.js');
    const { planSpheres } = await imp('frontend/modules/procgenPipeline/spherePlanner.js');
    const { substrateRegistry } = await imp('frontend/modules/shared/procgen/substrateRegistry.js');
    const maze = substrateRegistry.get('maze');

    // Load + validate the committed demo maze pack (capability check via maze).
    const lib = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
    const vr = validator.validateRegionLibrary(lib, { entryCapabilityCheck: (e) => maze.validateLibraryEntry(e) });
    ok(vr.ok, `demo maze pack validates (${vr.errors.join('; ') || 'no errors'})`);

    const srcId = engine.librarySourceId(lib.library_id);
    // maze gates everything through logic_gate / authored terms (no physics gates),
    // so gateableItems is empty and any item may gate a child exit.
    const plan = planSpheres({
        itemPool: { KeyA: 1, KeyB: 1, KeyC: 1, Victory: 1 },
        sphereCount: 3, exclusiveSpheres: { 1: ['KeyA'] },
        victoryItem: 'Victory', gateableItems: [], seed: 1,
    });
    // Mix generated maze regions with library slots (the start region is a generated
    // maze region; library entries fill non-root nodes). Both connection settings OFF
    // → captured openings relabel onto the needed child sides at their captured tiles.
    const { grid, startCell, tree } = engine.growSpheres({
        regionSize: { width: 11, height: 11 }, seed: SEED,
        regionParams: { mazeRequireSameWall: false, mazeRequireTileAlign: false },
        growthParams: {
            spherePlan: plan,
            substrateQuotas: { maze: 2, [srcId]: 6 },
            substrateConfig: { [srcId]: { libraryDoc: lib } },
            startSubstrate: 'maze', maxItemsPerRegion: 2, assumeBidirectional: true,
        },
    });

    // The region ids the library actually placed (node.substrate === srcId).
    const libRegionIds = tree.nodes
        .filter((n) => n.substrate === srcId)
        .map((n) => grid.getRegion(n.cell).region_id);
    ok(libRegionIds.length > 0, `Pass A: placed ${libRegionIds.length} library region(s)`);
    // Library-placed regions render as maze (self-contained; no library kind).
    for (const n of tree.nodes.filter((x) => x.substrate === srcId)) {
        ok(grid.getRegion(n.cell).substrate === 'maze', `Pass A: ${grid.getRegion(n.cell).region_id} renders as maze`);
    }

    const rules = engine.buildRulesJson(grid, {
        startCell, seed: SEED, completionConditionItem: 'Victory',
        procgenMetadata: { driver: 'sphere-growth', stop_reason: 'plan_complete' },
    });
    ok('preset_sidecars' in rules, 'Pass A: rules.json carries preset_sidecars');
    // No library residency leaks into the compiled world (build-time source only).
    ok(!JSON.stringify(rules).includes('libraryDoc') && !JSON.stringify(rules).includes(lib.library_id),
        'Pass A: compiled world carries NO library residency (self-contained regions)');
    // The overlaid gate is a real access_rule in the compiled world (logic).
    const compiledRegions = Object.values(rules.regions).flatMap((byName) => Object.entries(byName));
    const libGatedExits = compiledRegions
        .filter(([name]) => libRegionIds.includes(name))
        .flatMap(([, r]) => r.exits ?? [])
        .filter((e) => e.access_rule && !(typeof e.access_rule === 'object' && e.access_rule.rule === 'True_'));
    ok(libGatedExits.length > 0, `Pass A: library regions carry overlaid gate access_rules (${libGatedExits.length})`);

    // Locations the library regions contributed (region-namespaced).
    const libLocs = compiledRegions
        .filter(([name]) => libRegionIds.includes(name))
        .flatMap(([, r]) => r.locations ?? [])
        .map((l) => l.name);
    ok(libLocs.length > 0, `Pass A: library regions contribute ${libLocs.length} locations`);

    fs.writeFileSync(tmpRules, JSON.stringify(rules, null, 2));

    // --- world_generator ---------------------------------------------
    run(py, ['-m', 'world_generator', tmpRules, '-o', WORLD_DIR, '--game-name', GAME_NAME, '--force']);
    const locationsPy = fs.readFileSync(path.join(WORLD_DIR, 'Locations.py'), 'utf8');
    const wgHasLibLocs = libLocs.every((n) => locationsPy.includes(n));
    ok(wgHasLibLocs, 'world_generator: Locations.py has every library location');

    // --- Generate.py --------------------------------------------------
    run(py, ['-c', `from Options import generate_yaml_templates; generate_yaml_templates(${JSON.stringify(tmpTemplates)})`]);
    run(py, ['Generate.py', '--weights_file_path', path.join(tmpTemplates, `${GAME_NAME}.yaml`),
        '--multi', '1', '--seed', String(SEED)]);

    const apDirs = fs.readdirSync(PRESET_DIR).filter((n) => n.startsWith('AP_'));
    ok(apDirs.length === 1, `Generate.py: exactly one AP_* export (${apDirs.length})`);
    const seedId = apDirs[0];
    const apDir = path.join(PRESET_DIR, seedId);
    const exportedRules = JSON.parse(fs.readFileSync(path.join(apDir, `${seedId}_rules.json`), 'utf8'));
    const exRegionNames = new Set(Object.values(exportedRules.regions ?? {})
        .flatMap((byName) => Object.keys(byName)));
    const libRegionsKept = libRegionIds.every((id) => exRegionNames.has(id));
    ok(libRegionsKept, 'Generate.py: exported rules.json keeps every library region');

    const exLibLocs = Object.values(exportedRules.regions ?? {})
        .flatMap((byName) => Object.entries(byName))
        .filter(([name]) => libRegionIds.includes(name))
        .flatMap(([, r]) => r.locations ?? []).length;
    ok(exLibLocs === libLocs.length,
        `Generate.py: exported rules.json keeps all ${libLocs.length} library locations (${exLibLocs})`);

    // The sphere log must reference the relocated library locations (reachable +
    // checked) — i.e. AP could actually route through the reused regions.
    const sphereLines = fs.readFileSync(path.join(apDir, `${seedId}_sphere_log.jsonl`), 'utf8')
        .split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const sphereLocs = new Set();
    for (const e of sphereLines) {
        for (const pd of Object.values(e.player_data ?? {})) {
            for (const l of (pd.new_accessible_locations ?? [])) sphereLocs.add(l);
            for (const l of (pd.checked_locations ?? [])) sphereLocs.add(l);
        }
    }
    const libLocsInSphere = libLocs.filter((n) => sphereLocs.has(n)).length;
    ok(libLocsInSphere === libLocs.length,
        `Generate.py: sphere log references all ${libLocs.length} library locations (${libLocsInSphere})`);

    // A valid export at all means AP found a winnable fill with a placed goal.
    const victoryPlaced = Object.values(exportedRules.regions ?? {})
        .flatMap((byName) => Object.values(byName))
        .flatMap((r) => r.locations ?? [])
        .some((l) => l.item?.name === 'Victory');
    ok(victoryPlaced, 'Generate.py: Victory goal placed on a location (winnable seed)');

    const spoiler = fs.readFileSync(path.join(apDir, `${seedId}_Spoiler.txt`), 'utf8');
    const spoilerHasLibRegions = libRegionIds.every((id) => spoiler.includes(id));
    ok(spoilerHasLibRegions, 'Generate.py: spoiler lists every library region');
} finally {
    cleanup();
}

console.log(failures === 0
    ? '\nAll maze sphere region-library round-trip assertions passed.'
    : `\n${failures} assertion(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
