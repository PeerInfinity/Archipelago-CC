#!/usr/bin/env node
/**
 * In-app UI verification for the Region Marking Tool panel (region-atlas plan,
 * Phase 2, Deliverable 2). Drives the REAL panel in a browser — no shortcuts
 * through the model — and proves the whole path works:
 *
 *   Phase A — boot: ?mode=flash loads the module, the panel mounts, and the
 *     committed Seedling map document loads with all 116 levels in the picker.
 *   Phase B — mark: with Region mode armed, DRAG a rectangle on the canvas to
 *     create a region; drag along its top edge to create an exit and assert the
 *     panel derived side N from the geometry (nothing typed it); click a tile
 *     to place a location.
 *   Phase C — layout + save: set the start region, then Save, and capture the
 *     downloaded file.
 *   Phase D — the downloaded document validates clean through the SAME
 *     validator the CLI uses, resolves its map_ref against the committed map
 *     document, and is byte-identical to what the headless AtlasSession +
 *     compact writer produce for the same edits. That last equality is what
 *     makes this a verification rather than a smoke test: the panel's save path
 *     is proven to be the model's, not a parallel one.
 *   Phase E (Phase 3) — "Export rules.json" downloads the compiled projection,
 *     byte-identical to what the headless compiler produces for the same atlas:
 *     the panel's export path is the CLI's compiler, not a second projection.
 *   Phase F (Phase 3) — "Edit in APWorld Editor" hands the compiled world over
 *     the dedicated apworldEditor:loadRules channel, and the EDITOR'S OWN model
 *     ends up holding the compiled regions.
 *
 * Prereq: dev server on :8000 (localhost -> unbundled ES modules, so source
 * edits are picked up). Run: node scripts/procgen/verify-region-marking-tool.mjs
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const MAP_FILE = path.join(repoRoot, 'frontend/modules/flashPanel/atlases/seedling-map.json');

const { AtlasSession, createEmptyAtlas } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/regionMarkingTool/atlasSession.js')));
const { validateRegionAtlas } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/procgenPipeline/regionAtlasValidator.js')));
const { compactJsonFile } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/procgenPipeline/compactJson.js')));
const { compileRegionAtlas } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/procgenPipeline/regionAtlasCompiler.js')));
const { stringifyRulesJson } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/shared/rulesJsonBuilder.js')));

const MAP_DOC = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));

// The edits the browser will perform, and the headless model's answer to them.
const LEVEL = 12;                       // OverWorld1_1 — a 20x20 overworld room
const REGION_ID = 'verify_region';
const BOUNDS = { x: 2, y: 2, w: 8, h: 6 };
const EXIT_ID = 'verify_north';
const EXIT_TILES = [[4, 2], [5, 2], [6, 2]];
const LOCATION_TILE = [5, 5];
const LOCATION_NAME = 'Verify - Chest';

function headlessSession() {
    const s = new AtlasSession(createEmptyAtlas({
        game: 'seedling', tileSize: MAP_DOC.tile_size, mapSource: 'ogmo-extract', mapDocument: 'seedling-map.json',
    }));
    s.addRegion({ region_id: REGION_ID, bounds: BOUNDS, map_ref: LEVEL });
    s.addExit(REGION_ID, { exit_id: EXIT_ID, tiles: EXIT_TILES });
    s.addLocation(REGION_ID, { name: LOCATION_NAME, tile: LOCATION_TILE });
    s.setStart(REGION_ID);
    return s;
}

function headlessDocument() {
    return compactJsonFile(headlessSession().toDocument());
}

/** The projection the CLI would emit for the same atlas (Phase 3). */
function headlessRules() {
    return compileRegionAtlas(headlessSession().toDocument(), { mapDoc: MAP_DOC });
}

let failures = 0;
const check = (label, ok, detail = '') => {
    console.log(`${ok ? '  ok  ' : 'FAIL  '}${label}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures += 1;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => { console.log(`  page error: ${e.message}`); failures += 1; });

try {
    // ── Phase A — boot ────────────────────────────────────────────────────
    await page.goto('http://localhost:8000/frontend/?mode=flash', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rmt-panel', { state: 'attached', timeout: 30000 });
    // The layout preset puts the tool in a component stack, so it mounts behind
    // whichever tab is active. Bring it forward the way a user would.
    await page.evaluate(() => {
        const tab = [...document.querySelectorAll('.lm_tab .lm_title')]
            .find((t) => t.textContent.trim() === 'Region Marking Tool');
        if (!tab) throw new Error('no "Region Marking Tool" tab in the layout');
        tab.click();
    });
    await page.waitForSelector('.rmt-panel', { state: 'visible', timeout: 15000 });
    check('Phase A: panel mounts under ?mode=flash and its tab activates', true);

    await page.waitForFunction(
        () => document.querySelector('.rmt-panel select')?.options.length > 100,
        null, { timeout: 30000 },
    );
    const levels = await page.evaluate(() => document.querySelector('.rmt-panel select').options.length);
    check('Phase A: map document loaded', levels === MAP_DOC.levels.length, `${levels} levels in the picker`);

    // Modal prompts would block the drags; answer them with the ids under test.
    await page.evaluate(({ regionId, exitId, locationName }) => {
        const answers = [regionId, exitId, locationName];
        window.prompt = () => answers.shift() ?? null;
        window.confirm = () => true;
    }, { regionId: REGION_ID, exitId: EXIT_ID, locationName: LOCATION_NAME });

    // ── Phase B — mark ────────────────────────────────────────────────────
    const selectLevel = async (levelId) => {
        await page.selectOption('.rmt-panel select', String(levelId));
        await page.waitForTimeout(150);
    };
    const clickToolbar = async (label) => {
        await page.evaluate((text) => {
            const btn = [...document.querySelectorAll('.rmt-panel button')].find((b) => b.textContent.trim() === text);
            if (!btn) throw new Error(`no toolbar button "${text}"`);
            btn.click();
        }, label);
        await page.waitForTimeout(60);
    };
    // Real mouse drags, aimed through the renderer's own tile->client mapping,
    // so this exercises the pan/zoom transform rather than assuming it.
    const clientOf = (tile) => page.evaluate(
        (t) => document.querySelector('.rmt-panel').__panel.renderer.tileToClient(t),
        tile,
    );
    const drag = async (fromTile, toTile) => {
        const a = await clientOf(fromTile);
        const b = await clientOf(toTile);
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2);
        await page.mouse.move(b.x, b.y);
        await page.mouse.up();
        await page.waitForTimeout(120);
    };

    await selectLevel(LEVEL);
    await clickToolbar('Region');
    await drag([BOUNDS.x, BOUNDS.y], [BOUNDS.x + BOUNDS.w - 1, BOUNDS.y + BOUNDS.h - 1]);

    const afterRegion = await page.evaluate(() => {
        const s = document.querySelector('.rmt-panel').__panel.session;
        return s.regions().map((r) => ({ id: r.region_id, bounds: r.bounds, map_ref: r.map_ref }));
    });
    check('Phase B: dragging a rectangle created the region',
        afterRegion.length === 1
        && afterRegion[0].id === REGION_ID
        && JSON.stringify(afterRegion[0].bounds) === JSON.stringify(BOUNDS)
        && afterRegion[0].map_ref === LEVEL,
        JSON.stringify(afterRegion[0] ?? null));

    await clickToolbar('Edge exit');
    await drag(EXIT_TILES[0], EXIT_TILES[EXIT_TILES.length - 1]);
    const exit = await page.evaluate(
        () => document.querySelector('.rmt-panel').__panel.session.regions()[0].exits[0] ?? null,
    );
    check('Phase B: the edge exit\'s side was DERIVED from the geometry',
        exit?.side === 'N' && exit?.kind === 'edge' && exit.exit_tiles.length === 3
        && JSON.stringify(exit.entrance_tile) === JSON.stringify(EXIT_TILES[1]),
        JSON.stringify(exit));

    await clickToolbar('Location');
    await drag(LOCATION_TILE, LOCATION_TILE);
    const location = await page.evaluate(
        () => document.querySelector('.rmt-panel').__panel.session.regions()[0].locations[0] ?? null,
    );
    check('Phase B: clicking placed the location',
        location?.name === LOCATION_NAME && JSON.stringify(location.tile) === JSON.stringify(LOCATION_TILE),
        JSON.stringify(location));

    // ── Phase C — layout + save ───────────────────────────────────────────
    await clickToolbar('Set as start');
    await clickToolbar('Validate');
    const status = await page.textContent('.rmt-status');
    check('Phase C: the panel reported the atlas valid', /^valid —/.test(status.trim()), status.trim());

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await clickToolbar('Save');
    const download = await downloadPromise;
    const savedPath = path.join(repoRoot, 'test_dumps', `rmt-verify-${download.suggestedFilename()}`);
    fs.mkdirSync(path.dirname(savedPath), { recursive: true });
    await download.saveAs(savedPath);
    const savedText = fs.readFileSync(savedPath, 'utf8');
    check('Phase C: Save downloaded an atlas', savedText.length > 0, download.suggestedFilename());

    // ── Phase D — the saved document ──────────────────────────────────────
    const saved = JSON.parse(savedText);
    const result = validateRegionAtlas(saved, { mapDoc: MAP_DOC });
    check('Phase D: the downloaded atlas validates clean, map_ref resolved',
        result.ok, result.ok ? `${result.warnings.length} warnings` : result.errors.join('; '));

    const expected = headlessDocument();
    check('Phase D: the panel\'s save path IS the model\'s (byte-identical)',
        savedText === expected,
        savedText === expected ? '' : `saved ${savedText.length}B vs headless ${expected.length}B`);

    fs.rmSync(savedPath, { force: true });

    // ── Phase E — Export rules.json (projection 1) ────────────────────────
    const { rules: expectedRules } = headlessRules();
    const expectedRulesText = `${stringifyRulesJson(expectedRules)}\n`;

    const rulesDownloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await clickToolbar('Export rules.json');
    const rulesDownload = await rulesDownloadPromise;
    const rulesPath = path.join(repoRoot, 'test_dumps', `rmt-verify-${rulesDownload.suggestedFilename()}`);
    await rulesDownload.saveAs(rulesPath);
    const rulesText = fs.readFileSync(rulesPath, 'utf8');
    check('Phase E: Export rules.json downloaded the projection',
        rulesText.length > 0, rulesDownload.suggestedFilename());
    check('Phase E: the panel\'s export path IS the CLI\'s compiler (byte-identical)',
        rulesText === expectedRulesText,
        rulesText === expectedRulesText ? '' : `exported ${rulesText.length}B vs headless ${expectedRulesText.length}B`);
    // Not vacuous: the projection actually carries the marked region.
    const exported = JSON.parse(rulesText);
    const EXPECTED_AP_REGIONS = [REGION_ID, 'Menu'].sort().join(',');
    check('Phase E: the exported graph holds the marked region and the start wiring',
        Object.keys(exported.regions['1']).sort().join(',') === EXPECTED_AP_REGIONS
        && exported.regions['1'].Menu.exits[0].connected_region === REGION_ID
        && exported.regions['1'][REGION_ID].locations[0].name === LOCATION_NAME
        && exported.preset_sidecars === undefined,
        Object.keys(exported.regions['1']).join(', '));
    // The status line must NAME what was dropped — the marked exit is unwired,
    // so the projection omits it, and an author who cannot see that reads a
    // partial atlas as a complete one.
    const exportStatus = (await page.textContent('.rmt-status')).trim();
    check('Phase E: the status line names the omitted unwired exit',
        exportStatus.includes('unwired') && exportStatus.includes(EXIT_ID), exportStatus);

    fs.rmSync(rulesPath, { force: true });

    // ── Phase F — hand off to the APWorld Editor ──────────────────────────
    //
    // Under ?mode=flash the editor panel is enabled but not mounted, so the
    // path this exercises is the module-level stash: apworldEditor/index.js
    // subscribes to apworldEditor:loadRules at initialize() and holds the world
    // until the panel drains it on mount (apworldEditorUI.js:129). Reading the
    // stash through the module's own consumePendingEditorRules() is the same
    // call the panel makes.
    //
    // Cleared FIRST so the assertion afterwards cannot pass on something stale:
    // the slot is empty, the click fills it. A publish the bus rejected (the
    // publisher not registered in regionMarkingTool/index.js) leaves it empty,
    // so this check pins that registration too.
    const readStash = () => page.evaluate(async () => {
        const mod = await import('./modules/apworldEditor/index.js');
        const doc = mod.consumePendingEditorRules();
        return doc?.regions?.['1'] ? Object.keys(doc.regions['1']) : null;
    });
    check('Phase F: nothing stashed for the editor before the button is pressed',
        (await readStash()) === null);

    // The publish is synchronous inside the click handler, so the stash is
    // filled by the time clickToolbar returns.
    await clickToolbar('Edit in APWorld Editor');
    const adopted = await readStash();
    check('Phase F: the APWorld Editor\'s OWN model holds the compiled regions',
        Array.isArray(adopted) && adopted.sort().join(',') === EXPECTED_AP_REGIONS,
        JSON.stringify(adopted));
} finally {
    await browser.close();
}

console.log(failures === 0 ? '\nOK: region marking tool verified in-app' : `\nFAILED: ${failures} check(s)`);
process.exit(failures === 0 ? 0 : 1);
