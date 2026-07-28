#!/usr/bin/env node
/**
 * End-to-end round-trip gate for REGION-ATLAS placement in sphere growth
 * (CC/docs/plans/region-atlas-plan.md, Phase 6 — the atlas analogue of
 * verify-region-library-sphere-roundtrip.mjs). Proves that a sphere world
 * carrying pieces of the REAL Seedling map survives the whole toolchain and
 * yields a WINNABLE seed:
 *
 *   committed atlas pool (frontend/atlas-pools/seedling-atlas-pool.json)
 *     → JS pipeline (growSpheres → buildRulesJson)   [real map regions placed
 *                                                     behind synthetic gates]
 *     → world_generator            (Locations.py, _worldgen_sidecars.json)
 *     → Generate.py                (exported rules.json + sphere log + spoiler)
 *
 * The INDEPENDENT stratum is Generate.py's fill: AP's own reachability solver
 * places the goal and emits a sphere log ONLY if the world is completable under
 * the emitted logic, and it shares none of the JS placement's assumptions. What
 * it CANNOT see is whether a placed region is physically enterable — an atlas
 * region is sized to its own bounds and is mostly wall, so an arrival computed
 * the way a generated region's would be lands the player in solid rock while
 * every compile and every oracle stays green. That witness is the in-app leg
 * `seedling-atlas-sphere-placed-region`; here it is checked structurally
 * (Pass A) so a break is caught without a browser too.
 *
 * Runs in a throwaway world/preset (atlas_sphere*) and cleans up.
 * Requires the repo Python env. Run:
 *   node scripts/procgen/verify-atlas-sphere-roundtrip.mjs
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const WORLD_DIR = path.join(repoRoot, 'worlds/atlas_sphere_worldgen');
const GAME_NAME = 'Atlas Sphere';
const PRESET_DIR = path.join(repoRoot, 'frontend/presets/atlas_sphere_worldgen');
const PRESET_FILES_JSON = path.join(repoRoot, 'frontend/presets/preset_files.json');
const OUTPUT_DIR = path.join(repoRoot, 'output');
const POOL_FILE = path.join(repoRoot, 'frontend/atlas-pools/seedling-atlas-pool.json');
const SEED = Number(process.env.ATLAS_SPH_SEED || 1);
const tmpRules = path.join(repoRoot, 'scripts/procgen/.atlas-sphere-rules.json');
const tmpTemplates = path.join(repoRoot, 'scripts/procgen/.atlas-sphere-templates');

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
    if (process.env.ATLAS_SPH_KEEP) {
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
    await imp('frontend/modules/mazeRoom/mazeRoomLibrary.js'); // registers maze
    const engine = await imp('frontend/modules/procgenPipeline/procgenPipelineEngine.js');
    const poolMod = await imp('frontend/modules/procgenPipeline/regionAtlasPool.js');
    const { planSpheres, computeItemSpheres, compareSpheresToPlan } =
        await imp('frontend/modules/procgenPipeline/spherePlanner.js');
    const { sortAtlasRegionsIntoSpheres, formatAtlasSortReport } =
        await imp('frontend/modules/procgenPipeline/sphereAtlasSorter.js');

    const pool = JSON.parse(fs.readFileSync(POOL_FILE, 'utf8'));
    const vr = poolMod.validateAtlasPool(pool);
    ok(vr.ok, `the committed Seedling atlas pool validates (${vr.errors.join('; ') || 'no errors'})`);

    const srcId = poolMod.atlasSourceId(pool.game);
    const itemPool = { key_red: 1, key_green: 1, key_blue: 1, key_yellow: 1, victory: 1 };
    const plan = planSpheres({
        itemPool, sphereCount: 3, victoryItem: 'victory', seed: 1,
    });
    // The SORTER route (slice 2), which is the ruled primary design: each
    // region's gate is the real game's own entry requirement, made legitimate by
    // scheduling that requirement into a strictly earlier sphere. `plan` is
    // MUTATED, and the oracle below compares against the same object.
    const sorted = sortAtlasRegionsIntoSpheres(plan, pool);
    for (const line of formatAtlasSortReport(sorted)) console.log(`  ${line}`);
    ok(sorted.assignments.length > 0, `sorter: ${sorted.assignments.length} region(s) sorted`);
    ok(sorted.injected.length > 0,
        `sorter: scheduled ${sorted.injected.map((i) => `${i.item}→S${i.sphere}`).join(', ')}`);
    for (const inj of sorted.injected) {
        ok(plan.spheres[inj.sphere - 1].items.includes(inj.item),
            `sorter: ${inj.item} really is a sphere-${inj.sphere} item now`);
        const gatedWaves = sorted.assignments
            .filter((a) => a.gate.includes(inj.item)).map((a) => a.wave);
        ok(gatedWaves.every((w) => w >= inj.sphere),
            `sorter: every region behind ${inj.item} sits at wave >= ${inj.sphere} `
            + `(the stratification invariant) — waves [${gatedWaves.join(', ')}]`);
    }
    ok(sorted.declined.length === 0,
        `sorter: the whole starter atlas is in vocabulary — ${sorted.declined.length} declined `
        + `(${sorted.declined.map((d) => d.entry_id).join(', ') || 'none'})`);
    const orGated = sorted.assignments.filter((a) => a.gateRule?.rule === 'Or');
    ok(orGated.length > 0,
        `sorter: ${orGated.length} region(s) keep a DISJUNCTIVE gate — the map says either `
        + 'weapon opens the crossing, and so does the world');

    const { grid, startCell, tree } = engine.growSpheres({
        regionSize: { width: 8, height: 6 },
        seed: SEED,
        growthParams: {
            spherePlan: plan,
            substrateQuotas: { maze: 6, [srcId]: pool.entries.length },
            substrateConfig: { [pool.game]: { atlasDoc: pool } },
            atlasAssignments: sorted.assignments,
            startSubstrate: 'maze',
            maxItemsPerRegion: 2,
            fillerCount: 2,
            assumeBidirectional: true,
        },
    });

    const atlasNodes = tree.nodes.filter((n) => n.substrate === srcId);
    const atlasRegionIds = atlasNodes.map((n) => n.region_id);
    ok(atlasNodes.length === sorted.assignments.length,
        `Pass A: placed exactly the ${sorted.assignments.length} region(s) the sorter accepted: ${atlasRegionIds.join(', ')}`);
    for (const a of sorted.assignments) {
        const node = atlasNodes.find((n) => n.region_id === a.entry_id);
        ok(!!node && node.wave === a.wave && JSON.stringify(node.gate) === JSON.stringify(a.gate),
            `Pass A: ${a.entry_id} sits at wave ${a.wave} behind `
            + `[${a.gate.join(', ') || 'nothing'}] — the map's own requirement`);
    }
    ok(sorted.declined.every((d) => !atlasRegionIds.includes(d.entry_id)),
        'Pass A: no declined region was placed anyway');
    // Child hosting (Phase-6 fence 2, lifted): the tree hangs regions off the
    // real map's own doors, never more of them than the pinned entry has.
    const atlasIdx = new Set(atlasNodes.map((n) => n.index));
    const hostedOnAtlas = tree.nodes.filter((n) => atlasIdx.has(n.parent));
    ok(hostedOnAtlas.length > 0,
        `Pass A: ${hostedOnAtlas.length} region(s) hang off an atlas region's own exits`);
    for (const host of atlasNodes) {
        const entry = pool.entries.find((e) => e.entry_id === host.region_id);
        const kids = tree.nodes.filter((n) => n.parent === host.index);
        ok(kids.length <= entry.exits.length,
            `Pass A: ${host.region_id} hosts ${kids.length} child(ren) on its `
            + `${entry.exits.length} door(s)`);
    }
    ok(atlasRegionIds.every((id) => pool.entries.some((e) => e.entry_id === id)),
        'Pass A: every placed region is named after the map it came from');
    ok(new Set(atlasRegionIds).size === atlasRegionIds.length,
        'Pass A: no atlas region is placed twice (an entry is a specific place)');
    for (const n of atlasNodes) {
        ok(grid.getRegion(n.cell).substrate === 'maze',
            `Pass A: ${n.region_id} renders as a self-contained maze region`);
    }
    // The structural half of the "arrival is enterable" witness (see the header).
    for (const n of atlasNodes) {
        const region = grid.getRegion(n.cell);
        const back = [...engine.getRegionExits(region).values()].find((e) => e.isBackExit);
        const w = region.playable_payload;
        ok(!!back && w.tiles[back.y * w.width + back.x] === 0,
            `Pass A: ${n.region_id}'s arrival tile is walkable floor of the real map`);
    }

    const rules = engine.buildRulesJson(grid, {
        startCell, seed: SEED, completionConditionItem: 'victory',
        procgenMetadata: {
            driver: 'sphere-growth', stop_reason: 'plan_complete', sphere_plan: plan,
            sphere_tree: engine.compactSphereTree(tree),
        },
    });
    ok(compareSpheresToPlan(computeItemSpheres(rules), plan).length === 0,
        'Pass A: the sphere oracle is exact with atlas gates counted');
    const text = JSON.stringify(rules);
    ok(!text.includes('atlasDoc') && !text.includes(pool.pool_id),
        'Pass A: the compiled world carries NO atlas residency (build-time source only)');

    const compiledRegions = Object.values(rules.regions).flatMap((byName) => Object.entries(byName));
    // Locations the atlas regions contributed, under the names the MAP gave them.
    const atlasLocs = compiledRegions
        .filter(([name]) => atlasRegionIds.includes(name))
        .flatMap(([, r]) => r.locations ?? []).map((l) => l.name);
    const seedlingNamed = atlasLocs.filter((n) => n.includes(' - '));
    ok(atlasLocs.length > 0, `Pass A: atlas regions contribute ${atlasLocs.length} location(s)`);
    ok(seedlingNamed.length > 0,
        `Pass A: they keep their Seedling names (${seedlingNamed.join(', ') || 'NONE'})`);
    // The map's own gates rode in with the geometry.
    const sidecars = rules.preset_sidecars['1'];
    const withMapGates = atlasRegionIds.filter((id) => Object.values(
        sidecars[id].playable_payload.obstacleLib ?? {}).some((o) => o.clear_set_type === 'rule'));
    ok(withMapGates.length > 0,
        `Pass A: ${withMapGates.length} placed region(s) carry the map's own rule gates`);

    fs.writeFileSync(tmpRules, JSON.stringify(rules, null, 2));

    // --- world_generator ---------------------------------------------
    run(py, ['-m', 'world_generator', tmpRules, '-o', WORLD_DIR, '--game-name', GAME_NAME, '--force']);
    const locationsPy = fs.readFileSync(path.join(WORLD_DIR, 'Locations.py'), 'utf8');
    ok(atlasLocs.every((n) => locationsPy.includes(n)),
        'world_generator: Locations.py has every atlas location');

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
    ok(atlasRegionIds.every((id) => exRegionNames.has(id)),
        'Generate.py: the exported rules.json keeps every atlas region, under its map name');

    const exAtlasLocs = Object.values(exportedRules.regions ?? {})
        .flatMap((byName) => Object.entries(byName))
        .filter(([name]) => atlasRegionIds.includes(name))
        .flatMap(([, r]) => r.locations ?? []).length;
    ok(exAtlasLocs === atlasLocs.length,
        `Generate.py: the exported rules.json keeps all ${atlasLocs.length} atlas location(s) (${exAtlasLocs})`);

    // The sphere log must reference them — i.e. AP could actually route through
    // the reused map regions.
    const sphereLines = fs.readFileSync(path.join(apDir, `${seedId}_sphere_log.jsonl`), 'utf8')
        .split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const sphereLocs = new Set();
    for (const e of sphereLines) {
        for (const pd of Object.values(e.player_data ?? {})) {
            for (const l of (pd.new_accessible_locations ?? [])) sphereLocs.add(l);
            for (const l of (pd.checked_locations ?? [])) sphereLocs.add(l);
        }
    }
    const inSphere = atlasLocs.filter((n) => sphereLocs.has(n)).length;
    ok(inSphere === atlasLocs.length,
        `Generate.py: the sphere log references all ${atlasLocs.length} atlas location(s) (${inSphere})`);

    const victoryPlaced = Object.values(exportedRules.regions ?? {})
        .flatMap((byName) => Object.values(byName))
        .flatMap((r) => r.locations ?? [])
        .some((l) => l.item?.name === 'victory');
    ok(victoryPlaced, 'Generate.py: the goal is placed on a location (winnable seed)');

    // The spoiler is keyed by LOCATION, and a generated region's locations carry
    // its region id in their names while an atlas location keeps the name the map
    // gave it — so this is also the end-to-end witness for ruling 3.
    const spoiler = fs.readFileSync(path.join(apDir, `${seedId}_Spoiler.txt`), 'utf8');
    ok(seedlingNamed.length > 0 && seedlingNamed.every((n) => spoiler.includes(n)),
        `Generate.py: the spoiler lists the map's own location names (${seedlingNamed.join(', ')})`);
    // ...and AP's fill put a real item there, rather than the engine's filler
    // surviving as if the slot were decorative.
    const chestLine = spoiler.split('\n').find((l) => l.trim().startsWith(`${seedlingNamed[0]}:`));
    ok(!!chestLine && !chestLine.includes('Region Library Filler'),
        `Generate.py: the fill placed a real item in the map's own chest (${chestLine?.trim()})`);

    // --- the committed demo preset still IS what these flags produce ---
    const COMMITTED = path.join(repoRoot,
        'frontend/presets/seedling_atlas_sphere/AP_1/AP_1_rules.json');
    if (fs.existsSync(COMMITTED)) {
        const regen = path.join(repoRoot, 'scripts/procgen/.atlas-sphere-regen.json');
        try {
            run('node', ['scripts/procgen/dump-sphere-growth.js', '--seed', '1',
                '--region', '8x6', '--quota', 'maze=6', '--quota', 'atlas:seedling=10',
                '--start', 'maze', '--fillers', '3',
                '--atlas', 'frontend/atlas-pools/seedling-atlas-pool.json',
                '-o', path.join(repoRoot, 'scripts/procgen/.atlas-sphere-dump.json'),
                '--rules-out', regen]);
            ok(fs.readFileSync(regen, 'utf8') === fs.readFileSync(COMMITTED, 'utf8'),
                'the committed seedling_atlas_sphere preset regenerates byte-identically');
        } finally {
            fs.rmSync(regen, { force: true });
            fs.rmSync(path.join(repoRoot, 'scripts/procgen/.atlas-sphere-dump.json'), { force: true });
        }
    }
} finally {
    cleanup();
}

console.log(failures === 0
    ? '\nAll atlas sphere round-trip assertions passed.'
    : `\n${failures} assertion(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
