#!/usr/bin/env node
/**
 * End-to-end round-trip verification for the region-library content source
 * (region-library-plan.md gate §5.3). Proves that a spiral world mixing
 * `library:<id>` slots with a procedural maze substrate survives the whole
 * toolchain and yields a winnable seed:
 *
 *   committed demo library (frontend/region-libraries/demo-maze-pack.json)
 *     → JS pipeline (arrangeShuffledSpiral → buildRulesJson)
 *     → world_generator            (Locations.py, _worldgen_sidecars.json)
 *     → Generate.py                (exported rules.json + sphere log + spoiler)
 *
 * The library is a BUILD-TIME content source: instantiated library regions are
 * self-contained maze regions, so the compiled world carries NO library
 * residency — it round-trips exactly like any procedural spiral world, and the
 * relocated `region_*__slot_*` locations must survive every hop and be
 * reachable/checkable.
 *
 * Runs in a throwaway world/preset (region_library_roundtrip*) and cleans up.
 * Requires the repo Python env. Run:
 *   node scripts/procgen/verify-region-library-roundtrip.mjs
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const WORLD_DIR = path.join(repoRoot, 'worlds/region_library_roundtrip_worldgen');
const GAME_NAME = 'Region Library Roundtrip';
const PRESET_DIR = path.join(repoRoot, 'frontend/presets/region_library_roundtrip_worldgen');
const PRESET_FILES_JSON = path.join(repoRoot, 'frontend/presets/preset_files.json');
const OUTPUT_DIR = path.join(repoRoot, 'output');
const LIBRARY_FILE = path.join(repoRoot, 'frontend/region-libraries/demo-maze-pack.json');
const SEED = Number(process.env.RL_RT_SEED || 1);
const tmpRules = path.join(repoRoot, 'scripts/procgen/.rl-roundtrip-rules.json');
const tmpTemplates = path.join(repoRoot, 'scripts/procgen/.rl-roundtrip-templates');

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
    if (process.env.RL_RT_KEEP) {
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
    await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/mazeRoom/mazeRoomLibrary.js')));
    const engine = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/procgenPipeline/procgenPipelineEngine.js')));
    const validator = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/procgenPipeline/regionLibraryValidator.js')));
    const { substrateRegistry } = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/shared/procgen/substrateRegistry.js')));
    const maze = substrateRegistry.get('maze');

    // Load + validate the committed demo library (the capability hook is now
    // available, so capability-vs-payload is checked too).
    const lib = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
    const vr = validator.validateRegionLibrary(lib, { entryCapabilityCheck: (e) => maze.validateLibraryEntry(e) });
    ok(vr.ok, `demo library validates (${vr.errors.join('; ') || 'no errors'})`);

    const srcId = engine.librarySourceId(lib.library_id);
    // Mix 2 procedural maze slots (which carry the scenario-pool items, incl. the
    // Victory goal) with 4 library slots.
    const { grid, startCell } = engine.arrangeShuffledSpiral({
        regionSize: { width: 11, height: 11 }, seed: SEED,
        itemPool: { Victory: 1, 'Red Key': 1, 'Blue Key': 1 }, obstaclePool: {},
        regionParams: {},
        growthParams: {
            substrateQuotas: { maze: 2, [srcId]: 4 },
            substrateConfig: { [srcId]: { libraryDoc: lib } },
            assumeBidirectional: true,
        },
        hazardOpts: null,
    });

    const regions = [...grid.allRegions()];
    ok(regions.length === 6, `Pass A: built 6 regions (${regions.length})`);
    ok(regions.every((r) => r.substrate === 'maze'), 'Pass A: every region renders as maze');

    // The library regions contribute region-namespaced slot locations.
    const slotLocs = regions
        .flatMap((r) => r.extracted_rules?.locations ?? [])
        .map((l) => l.id)
        .filter((id) => /__slot_\d+/.test(id));
    ok(slotLocs.length >= 8, `Pass A: library slot locations emitted (${slotLocs.length})`);

    const rules = engine.buildRulesJson(grid, {
        startCell, seed: SEED,
        completionConditionItem: 'Victory',
        procgenMetadata: { driver: 'shuffled-spiral', stop_reason: 'spiral_complete' },
    });
    const allRegions = Object.values(rules.regions).flatMap((byName) => Object.values(byName));
    const rulesSlotLocs = allRegions
        .flatMap((r) => r.locations ?? [])
        .map((l) => l.name ?? '')
        .filter((n) => /__slot_\d+/.test(n));
    ok(rulesSlotLocs.length === slotLocs.length,
        `Pass A: rules.json carries all ${slotLocs.length} library slot locations (${rulesSlotLocs.length})`);
    ok('preset_sidecars' in rules, 'Pass A: rules.json carries preset_sidecars');
    // No library residency leaks into the compiled world (build-time source only).
    ok(!JSON.stringify(rules).includes('libraryDoc') && !JSON.stringify(rules).includes(lib.library_id),
        'Pass A: compiled world carries NO library residency (self-contained regions)');

    fs.writeFileSync(tmpRules, JSON.stringify(rules, null, 2));

    // --- world_generator ---------------------------------------------
    run(py, ['-m', 'world_generator', tmpRules, '-o', WORLD_DIR, '--game-name', GAME_NAME, '--force']);
    const locationsPy = fs.readFileSync(path.join(WORLD_DIR, 'Locations.py'), 'utf8');
    const wgSlotLocs = new Set(locationsPy.match(/region_\d+_\d+__slot_\d+/g) ?? []).size;
    ok(wgSlotLocs === slotLocs.length,
        `world_generator: Locations.py has all ${slotLocs.length} library slot locations (${wgSlotLocs})`);

    // --- Generate.py --------------------------------------------------
    run(py, ['-c', `from Options import generate_yaml_templates; generate_yaml_templates(${JSON.stringify(tmpTemplates)})`]);
    run(py, ['Generate.py', '--weights_file_path', path.join(tmpTemplates, `${GAME_NAME}.yaml`),
        '--multi', '1', '--seed', String(SEED)]);

    const apDirs = fs.readdirSync(PRESET_DIR).filter((n) => n.startsWith('AP_'));
    ok(apDirs.length === 1, `Generate.py: exactly one AP_* export (${apDirs.length})`);
    const seedId = apDirs[0];
    const apDir = path.join(PRESET_DIR, seedId);
    const exportedRules = JSON.parse(fs.readFileSync(path.join(apDir, `${seedId}_rules.json`), 'utf8'));
    const exSlotLocs = Object.values(exportedRules.regions ?? {})
        .flatMap((byName) => Object.values(byName))
        .flatMap((r) => r.locations ?? [])
        .filter((l) => /__slot_\d+/.test(l.name ?? '')).length;
    ok(exSlotLocs === slotLocs.length,
        `Generate.py: exported rules.json keeps all ${slotLocs.length} library slot locations (${exSlotLocs})`);

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
    const slotInSphere = [...sphereLocs].filter((l) => /__slot_\d+/.test(l)).length;
    ok(slotInSphere === slotLocs.length,
        `Generate.py: sphere log references all ${slotLocs.length} library slot locations (${slotInSphere})`);

    // A valid export at all means AP found a winnable fill with a placed goal.
    const victoryPlaced = Object.values(exportedRules.regions ?? {})
        .flatMap((byName) => Object.values(byName))
        .flatMap((r) => r.locations ?? [])
        .some((l) => l.item?.name === 'Victory');
    ok(victoryPlaced, 'Generate.py: Victory goal placed on a location (winnable seed)');

    const spoiler = fs.readFileSync(path.join(apDir, `${seedId}_Spoiler.txt`), 'utf8');
    const spoilerSlotLocs = new Set(spoiler.match(/region_\d+_\d+__slot_\d+/g) ?? []).size;
    ok(spoilerSlotLocs === slotLocs.length,
        `Generate.py: spoiler lists all ${slotLocs.length} library slot locations (${spoilerSlotLocs})`);
} finally {
    cleanup();
}

console.log(failures === 0
    ? '\nAll region-library round-trip assertions passed.'
    : `\n${failures} assertion(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
