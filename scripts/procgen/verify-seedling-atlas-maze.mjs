#!/usr/bin/env node
/**
 * Phase-5b gate for the region atlas (CC/docs/plans/region-atlas-plan.md): the
 * atlas's analyzed tile map, projected into the MAZE substrate, is a payload the
 * runtime can actually play — and the committed preset still IS that projection.
 *
 * Unlike verify-seedling-atlas-play.mjs (the flash flavour, which SKIPs without
 * its machine-local wasm artifact), everything here runs from the committed repo,
 * which is the whole point of the maze flavour.
 *
 *   Phase A — payload consistency, read off the COMMITTED preset file rather than
 *     a fresh compile: every exit / obstacle / item cell inside bounds and on
 *     FLOOR, every obstacle id resolvable in its payload's obstacleLib, every
 *     rule-typed gate carrying a rule, every exitName a real AP exit of that AP
 *     region, every targetRegion a real AP region, and every targetExitId an exit
 *     of the target payload that points back.
 *   Phase B — walkability, through the REAL engine: each payload is loaded with
 *     mazeRoomEngine's own deserializeMazeWorld and every exit and item tile must
 *     be reachable from the spawn. A payload whose exit is walled off would
 *     compile, load, render — and never be crossable.
 *   Phase C — byte-stable regeneration: the committed preset is exactly what the
 *     atlas compiles to (the same gate the flash preset carries), and the
 *     projection report is PRINTED — the walled unlabelled crossings and every
 *     approximation the projection took are output, not assumptions.
 *   Phase D — it loads in the DEFAULT (procgen) mode and the maze panel adopts
 *     the start sub-region's world, matching the committed payload tile for tile.
 *     Walking it is the in-app suite's job (seedlingAtlasMazeTests.js).
 *
 * Prereq for Phase D: dev server on :8000. Run:
 *   node scripts/procgen/verify-seedling-atlas-maze.mjs [--no-browser]
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const ATLAS_FILE = path.join(repoRoot, 'frontend/modules/flashPanel/atlases/seedling.json');
const MAP_FILE = path.join(repoRoot, 'frontend/modules/flashPanel/atlases/seedling-map.json');
const CONFIG_FILE = path.join(repoRoot, 'frontend/modules/flashPanel/games/seedling.json');
const PRESET_FILE = path.join(repoRoot, 'frontend/presets/seedling_atlas_maze/AP_1/AP_1_rules.json');
const PRESET_ID = 'seedling_atlas_maze';

const noBrowser = process.argv.includes('--no-browser');

const load = (p) => import(pathToFileURL(path.join(repoRoot, p)));
const { compileRegionAtlas, formatCompileReport } = await load('frontend/modules/procgenPipeline/regionAtlasCompiler.js');
const { seedlingMazeProjectionDeps } = await load('frontend/modules/flashPanel/seedlingAtlasAnalysis.js');
const { stringifyRulesJson } = await load('frontend/modules/shared/rulesJsonBuilder.js');
const { deserializeMazeWorld, floorReachableSet, TILE_FLOOR } = await load('frontend/modules/mazeRoom/mazeRoomEngine.js');
const { MAZE_SUBSTRATE } = await load('frontend/modules/procgenPipeline/regionAtlasMazeProjection.js');

let failures = 0;
const check = (label, ok, detail = '') => {
    console.log(`${ok ? '  ok  ' : 'FAIL  '}${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures += 1;
};

const atlas = JSON.parse(fs.readFileSync(ATLAS_FILE, 'utf8'));
const mapDoc = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const gameConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const preset = JSON.parse(fs.readFileSync(PRESET_FILE, 'utf8'));

const sidecars = preset.preset_sidecars?.['1'] ?? {};
const apRegions = preset.regions?.['1'] ?? {};
const names = Object.keys(sidecars);

// ── Phase A — payload consistency ────────────────────────────────────────────
console.log('\nPhase A — payload consistency (committed preset)');
check('the preset carries maze sidecars for every AP region but Menu',
    names.length > 0
    && names.sort().join('|') === Object.keys(apRegions).filter((n) => n !== 'Menu').sort().join('|'),
    `${names.length} sidecar(s)`);
check('no flash_panel wiring — nothing here boots the original engine',
    preset.flash_panel === undefined);

const problems = [];
let exitCount = 0;
let gateCount = 0;
let itemCount = 0;
for (const [name, sc] of Object.entries(sidecars)) {
    const p = sc.playable_payload;
    const where = (msg) => problems.push(`${name}: ${msg}`);
    if (sc.substrate !== MAZE_SUBSTRATE) where(`substrate is "${sc.substrate}", not "${MAZE_SUBSTRATE}"`);
    if (p.tiles.length !== p.width * p.height) where(`tiles ${p.tiles.length} != ${p.width}x${p.height}`);
    const inBounds = (x, y) => x >= 0 && y >= 0 && x < p.width && y < p.height;
    const isFloor = (x, y) => p.tiles[y * p.width + x] === TILE_FLOOR;
    const apExitNames = new Set((apRegions[name]?.exits ?? []).map((e) => e.name));
    if (!inBounds(p.entrance.x, p.entrance.y) || !isFloor(p.entrance.x, p.entrance.y)) {
        where(`spawn (${p.entrance.x},${p.entrance.y}) is out of bounds or not floor`);
    }
    for (const e of p.exits) {
        exitCount += 1;
        // The invariant every committed maze preset holds. mazeRoomEngine keys
        // world.exits on exit_id while procgenPlayer resolves an arrival by
        // exitName, so keying them apart sends every arrival to the entrance
        // tile instead of the crossing the player walked through.
        if (e.exit_id !== e.exitName) where(`exit_id "${e.exit_id}" is not its exitName "${e.exitName}" — arrivals would fall back to the entrance`);
        if (!inBounds(e.x, e.y)) where(`exit ${e.exit_id} at (${e.x},${e.y}) is out of bounds`);
        else if (!isFloor(e.x, e.y)) where(`exit ${e.exit_id} at (${e.x},${e.y}) sits on a wall`);
        if (!apExitNames.has(e.exitName)) where(`exit ${e.exit_id} names AP exit "${e.exitName}", which this AP region does not have`);
        if (!apRegions[e.targetRegion]) where(`exit ${e.exit_id} targets "${e.targetRegion}", which is not an AP region`);
        if (e.targetExitId) {
            const back = sidecars[e.targetRegion]?.playable_payload?.exits
                ?.find((t) => t.exit_id === e.targetExitId);
            if (!back) where(`exit ${e.exit_id} points at ${e.targetRegion}/${e.targetExitId}, which does not exist`);
            else if (back.targetRegion !== name) where(`exit ${e.exit_id} pairs with ${e.targetExitId}, which points at "${back.targetRegion}" instead of back here`);
        }
    }
    for (const o of p.obstacles) {
        gateCount += 1;
        if (!inBounds(o.x, o.y)) where(`obstacle ${o.id} at (${o.x},${o.y}) is out of bounds`);
        else if (!isFloor(o.x, o.y)) where(`obstacle ${o.id} at (${o.x},${o.y}) sits on a wall, where it can never be met`);
        const def = p.obstacleLib?.[o.id];
        if (!def) where(`obstacle id "${o.id}" is not in this payload's obstacleLib`);
        else if (def.clear_set_type !== 'rule' || !def.clear_rule) where(`obstacle "${o.id}" is not a rule-typed gate with a rule`);
    }
    for (const it of p.items ?? []) {
        itemCount += 1;
        if (!inBounds(it.x, it.y) || !isFloor(it.x, it.y)) where(`item at (${it.x},${it.y}) is out of bounds or on a wall`);
        if (!it.locationName) where(`item at (${it.x},${it.y}) carries no AP locationName — its check can never fire`);
        else if (!(apRegions[name]?.locations ?? []).some((l) => l.name === it.locationName)) {
            where(`item at (${it.x},${it.y}) names location "${it.locationName}", which this AP region does not have`);
        }
    }
}
check('every exit / obstacle / item is in bounds, on floor and resolvable',
    problems.length === 0,
    problems.length === 0
        ? `${exitCount} exits, ${gateCount} gates, ${itemCount} items`
        : `\n      ${problems.join('\n      ')}`);

// ── Phase B — walkability through the real engine ────────────────────────────
console.log('\nPhase B — walkability (mazeRoomEngine)');
const unreachable = [];
for (const [name, sc] of Object.entries(sidecars)) {
    let world;
    try {
        world = deserializeMazeWorld(sc.playable_payload);
    } catch (e) {
        unreachable.push(`${name}: deserializeMazeWorld threw — ${e.message}`);
        continue;
    }
    const reachable = floorReachableSet(world);
    for (const e of world.exits.values()) {
        if (!reachable.has(`${e.x},${e.y}`)) unreachable.push(`${name}: exit ${e.exit_id} at (${e.x},${e.y}) is walled off from the spawn`);
    }
    for (const key of world.items.keys()) {
        if (!reachable.has(key)) unreachable.push(`${name}: item at (${key}) is walled off from the spawn`);
    }
}
check('every payload loads and every exit / item is walkable from the spawn',
    unreachable.length === 0,
    unreachable.length === 0 ? `${names.length} worlds` : `\n      ${unreachable.join('\n      ')}`);

// ── Phase C — byte-stable regeneration + the projection report ───────────────
console.log('\nPhase C — regeneration + projection report');
const { rules, report } = compileRegionAtlas(JSON.parse(JSON.stringify(atlas)), {
    mapDoc,
    sidecarFlavor: 'maze',
    mazeProjection: seedlingMazeProjectionDeps({ mapDoc, gameConfig }),
});
check('the committed preset is byte-identical to what the atlas compiles to',
    `${stringifyRulesJson(rules)}\n` === fs.readFileSync(PRESET_FILE, 'utf8'));
check('the atlas validates', report.atlas_valid, report.atlas_errors.join('; '));
for (const line of formatCompileReport(report)) console.log(`      ${line}`);

// ── Phase D — it loads in the default mode ───────────────────────────────────
if (noBrowser) {
    console.log('\nPhase D — SKIPPED (--no-browser)');
} else {
    console.log('\nPhase D — the preset loads in the default (procgen) mode');
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const logs = [];
    page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => { logs.push(`[pageerror] ${e.message}`); failures += 1; });
    try {
        await page.goto(`http://localhost:8000/frontend/?game=${PRESET_ID}&seed=1`,
            { waitUntil: 'domcontentloaded' });
        // Hand-rolled poll rather than waitForFunction: the predicate has to
        // dynamic-import the panel module, which THROWS until the app's own
        // module graph is up, and waitForFunction rejects on the first throw
        // instead of polling past it.
        const readPanel = () => page.evaluate(async () => {
            const m = await import('./modules/mazeRoom/index.js');
            const panel = m.getPanelInstance();
            if (!panel?.world || !panel.currentRegionId || !panel.state) return null;
            return {
                region: panel.currentRegionId,
                width: panel.world.width,
                height: panel.world.height,
                floors: [...panel.world.tiles].filter((t) => t === 0).length,
                exits: [...panel.world.exits.keys()],
                spawn: { x: panel.state.player_pos.x, y: panel.state.player_pos.y },
                source: window.stateManagerProxy?.currentRulesSource ?? null,
            };
        });
        let adopted = null;
        for (const deadline = Date.now() + 60000; Date.now() < deadline;) {
            try { adopted = await readPanel(); } catch { /* app still booting */ }
            if (adopted) break;
            await page.waitForTimeout(500);
        }
        if (!adopted) {
            console.log('  PAGE LOGS (last 25):\n    ' + logs.slice(-25).join('\n    '));
            check('the maze panel adopted a world from the preset', false, 'timed out');
        } else {
            check('the preset loaded by ?game=' + PRESET_ID,
                /seedling_atlas_maze/.test(adopted.source ?? ''), adopted.source ?? 'unknown');
            const expected = sidecars[adopted.region]?.playable_payload;
            check('the panel stands in an atlas sub-region the preset carries',
                !!expected, adopted.region);
            check('the panel is at the compiled START sub-region',
                adopted.region === report.start_region, `${adopted.region} (compiled: ${report.start_region})`);
            if (expected) {
                check('the adopted world IS the committed payload',
                    adopted.width === expected.width
                    && adopted.height === expected.height
                    && adopted.floors === expected.tiles.filter((t) => t === 0).length
                    && adopted.exits.sort().join('|') === expected.exits.map((e) => e.exit_id).sort().join('|'),
                    `${adopted.width}x${adopted.height}, ${adopted.floors} floor tiles, exits [${adopted.exits.join(', ')}]`);
                check('the player spawned on the sub-region\'s entrance tile',
                    adopted.spawn.x === expected.entrance.x && adopted.spawn.y === expected.entrance.y,
                    `(${adopted.spawn.x},${adopted.spawn.y}) vs (${expected.entrance.x},${expected.entrance.y})`);
            }
        }
    } finally {
        await browser.close();
    }
}

console.log(failures === 0
    ? `\nOK: ${names.length} atlas sub-regions are playable maze worlds (${exitCount} exits, ${gateCount} gates)`
    : `\nFAILED: ${failures} check(s)`);
process.exit(failures === 0 ? 0 : 1);
