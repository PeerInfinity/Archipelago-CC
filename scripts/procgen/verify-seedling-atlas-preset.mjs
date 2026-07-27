#!/usr/bin/env node
/**
 * Phase-3 milestone check for the region atlas (CC/docs/plans/region-atlas-plan.md):
 * the compiled Seedling atlas preset LOADS IN THE FRONTEND with the full region
 * graph.
 *
 *   Phase A — boot the app straight onto the registered preset
 *     (?game=seedling_atlas&seed=1, the modeDataLoader preset-lookup path) and
 *     wait for the state manager to report rules loaded.
 *   Phase B — assert the EFFECT: the regions the state manager actually holds
 *     are exactly the regions the compiler emits for the committed atlas, and
 *     every compiled exit is present as a real edge in the loaded model. Not
 *     "no console errors" — the loaded graph, compared against a headless
 *     compile of the same atlas.
 *   Phase C — the start wiring survives the round trip: Menu's GameStart exit
 *     points at the atlas's start region, which is what
 *     procgenPlayerEngine.findStartRegion follows.
 *
 * This script stays the GRAPH gate. Phase 4 added projection 3 on top of the
 * same compile, so Phase C now asserts the sidecars are present and consistent
 * with the graph rather than absent; the play-time behaviour they drive is
 * verify-seedling-atlas-play.mjs's job (it needs the wasm artifact, this does
 * not).
 *
 * Prereq: dev server on :8000. Run:
 *   node scripts/procgen/verify-seedling-atlas-preset.mjs
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const ATLAS_FILE = path.join(repoRoot, 'frontend/modules/flashPanel/atlases/seedling.json');
const MAP_FILE = path.join(repoRoot, 'frontend/modules/flashPanel/atlases/seedling-map.json');
const PRESET_FILE = path.join(repoRoot, 'frontend/presets/seedling_atlas/AP_1/AP_1_rules.json');

const { compileRegionAtlas } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/procgenPipeline/regionAtlasCompiler.js')));

const atlas = JSON.parse(fs.readFileSync(ATLAS_FILE, 'utf8'));
const mapDoc = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const { rules: expected, report } = compileRegionAtlas(atlas, { mapDoc });

// What the graph should be, straight off the headless compile.
const expectedRegions = Object.keys(expected.regions['1']).sort();
const expectedEdges = Object.values(expected.regions['1'])
    .flatMap((r) => r.exits.map((e) => `${r.name} -> ${e.connected_region}`)).sort();
const expectedLocations = Object.values(expected.regions['1'])
    .flatMap((r) => r.locations.map((l) => l.name)).sort();

let failures = 0;
const check = (label, ok, detail = '') => {
    console.log(`${ok ? '  ok  ' : 'FAIL  '}${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures += 1;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => { console.log(`  page error: ${e.message}`); failures += 1; });

try {
    // ── Phase A — boot on the preset ──────────────────────────────────────
    await page.goto('http://localhost:8000/frontend/?game=seedling_atlas&seed=1',
        { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
        () => window.stateManagerProxy?.getStaticData?.()?.regions?.size > 0,
        null, { timeout: 60000 },
    ).catch(() => {});

    const loaded = await page.evaluate(() => {
        const sd = window.stateManagerProxy?.getStaticData?.() ?? null;
        if (!sd) return null;
        return {
            gameName: sd.game_name ?? null,
            source: window.stateManagerProxy.currentRulesSource ?? null,
            regions: [...sd.regions.keys()],
            edges: [...sd.exits.values()].map((e) => `${e.parentRegion} -> ${e.connectedRegion}`),
            locations: [...sd.locations.keys()],
            startRegions: sd.startRegions ?? null,
            menuExits: (sd.regions.get('Menu')?.exits ?? []).map(
                (e) => ({ name: e.name, to: e.connected_region })),
        };
    });
    if (!loaded) {
        console.log('LOGS (last 20):', logs.slice(-20).join('\n'));
        throw new Error('the state manager never reported static data — the preset did not load');
    }
    check('Phase A: the registered preset loaded by ?game=seedling_atlas&seed=1',
        /seedling_atlas/.test(loaded.source ?? ''), `${loaded.gameName} from ${loaded.source}`);

    // ── Phase B — the loaded graph IS the compiled graph ──────────────────
    check('Phase B: every compiled region is in the loaded model, and no others',
        JSON.stringify([...loaded.regions].sort()) === JSON.stringify(expectedRegions),
        `loaded ${loaded.regions.length}, compiled ${expectedRegions.length}`);
    check('Phase B: every compiled exit is a real edge in the loaded model',
        JSON.stringify([...loaded.edges].sort()) === JSON.stringify(expectedEdges),
        `loaded ${loaded.edges.length}, compiled ${expectedEdges.length}`);
    check('Phase B: the atlas locations came through',
        JSON.stringify([...loaded.locations].sort()) === JSON.stringify(expectedLocations),
        loaded.locations.join(', '));
    // The omission is arithmetic, not vibes: the atlas authors N boundary
    // exits, `unwired` of them are wired by nothing, and each remaining one is
    // exactly one directed edge in the graph (the crossing's other direction is
    // the partner exit's own edge). GameStart is not a boundary exit.
    const authoredExits = atlas.regions.reduce((n, r) => n + r.exits.length, 0);
    const boundaryEdges = loaded.edges.filter((e) => !e.startsWith('Menu ->')).length;
    check('Phase B: the unwired boundary exits are absent from the graph',
        report.unwired_exits.length === 6
        && boundaryEdges === authoredExits - report.unwired_exits.length,
        `${authoredExits} authored - ${report.unwired_exits.length} unwired = ${boundaryEdges} edges`);

    // ── Phase C — the start wiring ────────────────────────────────────────
    check('Phase C: Menu carries the GameStart exit into the atlas start region',
        loaded.menuExits.length === 1
        && loaded.menuExits[0].name === 'GameStart'
        && loaded.menuExits[0].to === report.start_region,
        JSON.stringify(loaded.menuExits));

    const preset = JSON.parse(fs.readFileSync(PRESET_FILE, 'utf8'));
    // Phase 4: every region naming a level carries a play-time sidecar, and its
    // exits name AP exits that really exist in the graph — the registry's
    // exits-Map key requirement, checked against the loaded model.
    const sidecars = preset.preset_sidecars?.['1'] ?? {};
    const sidecarNames = Object.keys(sidecars).sort();
    check('Phase C: every sidecar region is a region in the loaded graph',
        sidecarNames.length === report.sidecar_regions.length
        && sidecarNames.every((n) => loaded.regions.includes(n)),
        sidecarNames.join(', '));
    const payloadExitNames = Object.values(sidecars)
        .flatMap((s) => s.playable_payload.exits.map((e) => e.exitName));
    const graphExitNames = new Set(Object.values(preset.regions['1'])
        .flatMap((r) => r.exits.map((e) => e.name)));
    check('Phase C: every sidecar exitName is a real AP exit name',
        payloadExitNames.length > 0 && payloadExitNames.every((n) => graphExitNames.has(n)),
        `${payloadExitNames.length} payload exits`);
    check('Phase C: the preset carries the flashPanel wiring that boots the game',
        preset.flash_panel?.config === 'seedling.json' && !!preset.flash_panel?.wasm,
        JSON.stringify(preset.flash_panel));
} finally {
    await browser.close();
}

console.log(failures === 0
    ? `\nOK: seedling_atlas preset loads with ${expectedRegions.length} regions and ${expectedEdges.length} exits`
    : `\nFAILED: ${failures} check(s)`);
process.exit(failures === 0 ? 0 : 1);
