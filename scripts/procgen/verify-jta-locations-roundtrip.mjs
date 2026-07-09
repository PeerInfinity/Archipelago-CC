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
 * Phase 3a additionally asserts the loose count-based access rules
 * (HasFromListUnique) survive the toolchain AND actually do their job:
 * the exported sphere log must be NON-DEGENERATE (more than one sphere,
 * with Victory out of logic in sphere 0). Before those rules existed every
 * location was `True_`, the whole game collapsed into sphere 0, and the
 * §2b balancing pass had no progression order to walk.
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
// Zone count. 3 keeps the round trip fast; JTA_RT_QUOTA=15 exercises the real
// v1 scope (zones 0–14), where zone 14 demands 14 perks out of a 21-perk pool
// — the configuration where the count-based gates are most likely to strand
// fill.
const QUOTA = Number(process.env.JTA_RT_QUOTA || 3);
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
    // JTA_RT_KEEP=1 leaves the generated world/preset in place for inspection
    // (the exported sphere log is Pass B's input — handy to eyeball).
    if (process.env.JTA_RT_KEEP) {
        console.log(`\n[kept] world=${WORLD_DIR}\n[kept] preset=${PRESET_DIR}`);
        if (presetFilesBefore !== null) fs.writeFileSync(PRESET_FILES_JSON, presetFilesBefore);
        return;
    }
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

    // Phase 2: the library emits a real 'Victory'-bearing location in the
    // goal zone (setJtaGoalZone) and can shuffle perk placement in-pipeline
    // (setJtaPerkShuffleSeed) — no scaffolding. arrangeShuffledSpiral maps
    // the Nth jta region to zone N, so the deepest emitted zone is QUOTA-1.
    jtaLib.setJtaEmitZoneLocations(true);
    jtaLib.setJtaGoalZone(QUOTA - 1);
    jtaLib.setJtaPerkShuffleSeed(SEED);
    const { grid, startCell } = engine.arrangeShuffledSpiral({
        regionSize: { width: 8, height: 6 }, itemPool: {}, obstaclePool: {}, seed: SEED,
        growthParams: { substrateQuotas: { jta: QUOTA }, assumeBidirectional: true, startSubstrate: 'jta' },
    });

    // Confirm exactly one Victory item landed in the pool (the goal item),
    // emitted by the library rather than injected by the test.
    const victoryName = substrateRegistry.get('jta').victoryItem;
    let victoryLocs = 0;
    for (const [, region] of grid.cells) {
        for (const l of (region.extracted_rules?.locations ?? [])) {
            if (l.item === victoryName) victoryLocs++;
        }
    }
    ok(victoryLocs === 1, `Pass A: library emitted exactly one 'Victory' location (${victoryLocs})`);

    const rules = engine.buildRulesJson(grid, {
        startCell, seed: SEED,
        completionConditionItem: victoryName,
        // Pin Victory to the goal-zone slot the library chose. Without this
        // AP fill treats it as an ordinary progression item and can shuffle
        // it into free zone 0, making the seed winnable at sphere 0 — the
        // zone gates then order everything except the goal.
        //
        // Both options are required: lockedCanonicalItems stamps locked:true
        // on the compiled location, and procgen_metadata is what makes
        // world_generator set honor_locked_placements (extractors.py:1367) so
        // a non-event locked item survives into LOCKED_PLACEMENTS rather than
        // being treated as a mere canonical placement and re-randomized.
        lockedCanonicalItems: [victoryName],
        procgenMetadata: { driver: 'top-down' },
    });

    const allRegions = Object.values(rules.regions).flatMap((byName) => Object.values(byName));
    const locCount = allRegions.reduce((a, r) => a + (r.locations?.length ?? 0), 0);
    ok(locCount > 0, `Pass A: rules.json carries ${locCount} jta task locations`);

    const sidecars = Object.values(rules.preset_sidecars ?? {}).flatMap((byName) => Object.values(byName));
    const withAp = sidecars.filter((s) => (s.playable_payload ?? s).ap_locations);
    ok(withAp.length === QUOTA, `Pass A: all ${QUOTA} sidecars carry ap_locations (${withAp.length})`);
    ok(sidecars.every((s) => typeof (s.playable_payload ?? s).jtaZone === 'number'),
        'Pass A: every sidecar carries jtaZone');
    ok(sidecars.every((s) => Array.isArray((s.playable_payload ?? s).task_patches)),
        'Pass A: every sidecar carries task_patches (grant-suppression delivery seam)');
    const totalPatches = sidecars.reduce(
        (a, s) => a + ((s.playable_payload ?? s).task_patches?.length ?? 0), 0);
    ok(totalPatches > 0, `Pass A: task_patches emitted (${totalPatches} perk-task suppressions)`);
    ok(Array.isArray(rules.sphere_log) && rules.sphere_log.length > 0,
        `Pass A: sphere_log emitted (${rules.sphere_log?.length} entries)`);

    // Phase 3a: loose count-based zone gating. arrangeShuffledSpiral maps the
    // Nth jta region to zone N, and free_zones=1 ⇒ zone Z needs Z perks.
    const byZoneIdx = new Map();
    for (const [, region] of grid.cells) {
        const zoneIdx = (region.playable_payload ?? {}).jtaZone;
        if (typeof zoneIdx === 'number') byZoneIdx.set(zoneIdx, region);
    }
    ok(byZoneIdx.size === QUOTA, `Pass A: ${QUOTA} zones mapped by jtaZone`);
    const zone0Locs = byZoneIdx.get(0).extracted_rules.locations;
    ok(zone0Locs.every((l) => !l.access_rule),
        'Pass A: free zone 0 carries no access_rule (True_ default)');
    for (let z = 1; z < QUOTA; z++) {
        const locs = byZoneIdx.get(z).extracted_rules.locations;
        const gated = locs.filter((l) => l.access_rule?.rule === 'HasFromListUnique'
            && l.access_rule.args.count === z);
        ok(gated.length === locs.length,
            `Pass A: all ${locs.length} zone-${z} locations gated on ${z} perk(s)`);
    }
    const universe = zone0Locs.length && byZoneIdx.get(1).extracted_rules.locations[0]
        .access_rule.args.item_names;
    ok(Array.isArray(universe) && universe.length >= QUOTA - 1
        && universe.every((n) => jtaLib.JTA_PERK_ITEM_NAMES.includes(n)),
        `Pass A: access-rule item_names are ${universe.length} real perk names`);

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
    ok((wgStr.match(/task_patches/g) ?? []).length === QUOTA,
        `world_generator: _worldgen_sidecars.json keeps task_patches for all ${QUOTA} zones`);
    const rulesPy = fs.readFileSync(path.join(WORLD_DIR, 'Rules.py'), 'utf8');
    ok(rulesPy.includes('HasFromListUnique'),
        'world_generator: Rules.py emits HasFromListUnique zone gates');

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
    ok((exStr.match(/task_patches/g) ?? []).length === QUOTA,
        `Generate.py: exported sidecars keep task_patches for all ${QUOTA} zones`);
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

    // Phase 3a: the sphere log must be NON-DEGENERATE — the whole point of the
    // access rules. Integer sphere indices are real progression steps;
    // fractional ones ("0.1") are AP collecting already-reachable progression
    // items within a sphere. Before the rules existed there was exactly one
    // integer sphere and Victory sat in logic at sphere 0.
    const updates = sphereLines.filter((e) => e.type === 'state_update');
    const intSpheres = new Set(updates
        .map((e) => Math.floor(Number(e.sphere_index)))
        .filter((n) => Number.isFinite(n)));
    ok(intSpheres.size > 1,
        `Generate.py: sphere log is non-degenerate (${intSpheres.size} progression spheres)`);

    const victoryLocName = Object.values(exportedRules.regions ?? {})
        .flatMap((byName) => Object.values(byName))
        .flatMap((r) => r.locations ?? [])
        .find((l) => l.item?.name === victoryName)?.name;
    ok(!!victoryLocName, `Generate.py: Victory placed on a location (${victoryLocName})`);
    const sphere0 = updates.find((e) => String(e.sphere_index) === '0');
    const sphere0Accessible = Object.values(sphere0?.player_data ?? {})
        .flatMap((pd) => pd.new_accessible_locations ?? []);
    ok(!sphere0Accessible.includes(victoryLocName),
        'Generate.py: Victory is NOT in logic at sphere 0 (zone gates hold)');

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
