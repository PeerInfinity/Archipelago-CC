#!/usr/bin/env node
/**
 * Phase 1 round-trip verification for the jta zone-locations channel
 * (plan §2b enabler). Proves that jta task locations + their sidecar
 * payload fields (ap_locations, jtaZone) + the sphere log survive the
 * whole toolchain:
 *
 *   JS pipeline (extractZoneRules → buildRulesJson)
 *     → world_generator            (Locations.py, _worldgen_sidecars.json)
 *     → Generate.py                (exported rules.json + sphere log + spoiler)
 *
 * These are Pass B's inputs: the in-app rebalance (a later phase) reads
 * the exported rules.json's preset_sidecars (ap_locations) and the
 * sphere log at rules-load time. If anything drops here, the pass-through
 * is a Phase 1 fix — so this asserts each survives.
 *
 * Runs entirely in a throwaway world/preset (jta_loctest_roundtrip*) and
 * cleans up after itself (world dir, preset dir, preset_files.json).
 * Requires the repo Python env (world_generator + Generate.py). Run:
 *   node scripts/procgen/verify-jta-locations-roundtrip.mjs
 *
 * NOTE: Goal placement is TEST SCAFFOLDING here — the script marks the
 * goal zone's last task-location as 'Victory' so Generate.py has a
 * beatable game. Where the victory item really lands is a Phase 2 (AP
 * integration) decision, not part of the zone-locations skeleton.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const WORLD_DIR = path.join(repoRoot, 'worlds/jta_loctest_roundtrip_worldgen');
const GAME_NAME = 'JtA LocTest Roundtrip';
const PRESET_DIR = path.join(repoRoot, 'frontend/presets/jta_loctest_roundtrip_worldgen');
const PRESET_FILES_JSON = path.join(repoRoot, 'frontend/presets/preset_files.json');
const OUTPUT_DIR = path.join(repoRoot, 'output');
const SEED = 1;
const QUOTA = 3;
const tmpRules = path.join(repoRoot, 'scripts/procgen/.jta-roundtrip-rules.json');
const tmpTemplates = path.join(repoRoot, 'scripts/procgen/.jta-roundtrip-templates');

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

// Snapshot preset_files.json so Generate.py's mutation can be reverted.
const presetFilesBefore = fs.existsSync(PRESET_FILES_JSON)
    ? fs.readFileSync(PRESET_FILES_JSON, 'utf8') : null;

function cleanup() {
    for (const p of [WORLD_DIR, PRESET_DIR, tmpTemplates]) {
        fs.rmSync(p, { recursive: true, force: true });
    }
    fs.rmSync(tmpRules, { force: true });
    fs.rmSync(path.join(OUTPUT_DIR, 'AP_14089154938208861744.zip'), { force: true });
    if (presetFilesBefore !== null) fs.writeFileSync(PRESET_FILES_JSON, presetFilesBefore);
}

try {
    // --- Pass A: JS pipeline ------------------------------------------
    // Substrate libraries register on import.
    await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js')));
    const jtaLib = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js')));
    const engine = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/procgenPipeline/procgenPipelineEngine.js')));
    const { substrateRegistry } = await import(pathToFileURL(path.join(repoRoot, 'frontend/modules/shared/procgen/substrateRegistry.js')));

    jtaLib.setJtaEmitZoneLocations(true);
    const { grid, startCell } = engine.arrangeShuffledSpiral({
        regionSize: { width: 8, height: 6 }, itemPool: {}, obstaclePool: {}, seed: SEED,
        growthParams: { substrateQuotas: { jta: QUOTA }, assumeBidirectional: true, startSubstrate: 'jta' },
    });

    // Goal scaffolding: place 'Victory' on the goal zone's (highest
    // jtaZone) last location BEFORE buildRulesJson, so the item pool is
    // computed with it and Generate.py has a beatable game.
    let goalRegion = null, goalZone = -1;
    for (const [, region] of grid.cells) {
        const z = region.playable_payload?.jtaZone;
        if (typeof z === 'number' && z > goalZone) { goalZone = z; goalRegion = region; }
    }
    const goalLocs = goalRegion?.extracted_rules?.locations ?? [];
    ok(goalLocs.length > 0, `goal zone ${goalZone} has locations to host Victory`);
    goalLocs[goalLocs.length - 1].item = substrateRegistry.get('jta').victoryItem; // 'Victory'

    const rules = engine.buildRulesJson(grid, {
        startCell, seed: SEED,
        completionConditionItem: substrateRegistry.get('jta').victoryItem,
    });

    const allRegions = Object.values(rules.regions).flatMap((byName) => Object.values(byName));
    const locCount = allRegions.reduce((a, r) => a + (r.locations?.length ?? 0), 0);
    ok(locCount > 0, `Pass A: rules.json carries ${locCount} jta task locations`);

    const sidecars = Object.values(rules.preset_sidecars ?? {}).flatMap((byName) => Object.values(byName));
    const withAp = sidecars.filter((s) => (s.playable_payload ?? s).ap_locations);
    ok(withAp.length === QUOTA, `Pass A: all ${QUOTA} sidecars carry ap_locations (${withAp.length})`);
    ok(sidecars.every((s) => typeof (s.playable_payload ?? s).jtaZone === 'number'),
        'Pass A: every sidecar carries jtaZone');
    ok(Array.isArray(rules.sphere_log) && rules.sphere_log.length > 0,
        `Pass A: sphere_log emitted (${rules.sphere_log?.length} entries)`);

    fs.writeFileSync(tmpRules, JSON.stringify(rules, null, 2));

    // --- world_generator ---------------------------------------------
    run(py, ['-m', 'world_generator', tmpRules, '-o', WORLD_DIR,
        '--game-name', GAME_NAME, '--force']);
    const locationsPy = fs.readFileSync(path.join(WORLD_DIR, 'Locations.py'), 'utf8');
    const wgLocs = new Set(locationsPy.match(/region_\d+_\d+__\d+/g) ?? []).size;
    ok(wgLocs === locCount, `world_generator: Locations.py has all ${locCount} jta locations (${wgLocs})`);
    const wgSidecars = JSON.parse(fs.readFileSync(path.join(WORLD_DIR, '_worldgen_sidecars.json'), 'utf8'));
    const wgStr = JSON.stringify(wgSidecars);
    ok((wgStr.match(/ap_locations/g) ?? []).length === QUOTA,
        `world_generator: _worldgen_sidecars.json keeps ap_locations for all ${QUOTA} zones`);
    ok((wgStr.match(/jtaZone/g) ?? []).length === QUOTA,
        `world_generator: _worldgen_sidecars.json keeps jtaZone for all ${QUOTA} zones`);

    // --- Generate.py --------------------------------------------------
    run(py, ['-c', `from Options import generate_yaml_templates; generate_yaml_templates(${JSON.stringify(tmpTemplates)})`]);
    run(py, ['Generate.py', '--weights_file_path', path.join(tmpTemplates, `${GAME_NAME}.yaml`),
        '--multi', '1', '--seed', String(SEED)]);

    const apDir = path.join(PRESET_DIR, 'AP_14089154938208861744');
    const exportedRules = JSON.parse(fs.readFileSync(path.join(apDir, 'AP_14089154938208861744_rules.json'), 'utf8'));
    const exStr = JSON.stringify(exportedRules.preset_sidecars ?? {});
    ok('preset_sidecars' in exportedRules, 'Generate.py: exported rules.json keeps preset_sidecars');
    ok((exStr.match(/ap_locations/g) ?? []).length === QUOTA,
        `Generate.py: exported sidecars keep ap_locations for all ${QUOTA} zones`);
    ok((exStr.match(/jtaZone/g) ?? []).length === QUOTA,
        `Generate.py: exported sidecars keep jtaZone for all ${QUOTA} zones`);
    const exLocs = Object.values(exportedRules.regions ?? {})
        .flatMap((byName) => Object.values(byName))
        .reduce((a, r) => a + (r.locations ?? []).filter((l) => (l.name ?? '').includes('__')).length, 0);
    ok(exLocs === locCount, `Generate.py: exported rules.json keeps all ${locCount} jta locations (${exLocs})`);

    const sphereLines = fs.readFileSync(path.join(apDir, 'AP_14089154938208861744_sphere_log.jsonl'), 'utf8')
        .split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const sphereLocs = new Set();
    for (const e of sphereLines) {
        for (const pd of Object.values(e.player_data ?? {})) {
            for (const l of (pd.new_accessible_locations ?? [])) sphereLocs.add(l);
            for (const l of (pd.checked_locations ?? [])) sphereLocs.add(l);
        }
    }
    const jtaInSphere = [...sphereLocs].filter((l) => l.includes('__')).length;
    ok(jtaInSphere === locCount, `Generate.py: sphere log references all ${locCount} jta locations (${jtaInSphere})`);

    const spoiler = fs.readFileSync(path.join(apDir, 'AP_14089154938208861744_Spoiler.txt'), 'utf8');
    const spoilerLocs = new Set(spoiler.match(/region_\d+_\d+__\d+/g) ?? []).size;
    ok(spoilerLocs === locCount, `Generate.py: spoiler lists all ${locCount} jta locations (${spoilerLocs})`);
} finally {
    cleanup();
}

console.log(failures === 0
    ? '\nAll round-trip assertions passed.'
    : `\n${failures} assertion(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
