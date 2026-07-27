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
 *   Phase G (Phase 5a) — "Analyze region" on a real room with a real item gate
 *     (Dungeon1_1, whose breakable rock walls off the way down) PROPOSES a split
 *     without touching the document, and Accept applies it. The accepted atlas
 *     is byte-identical to a headless analyze+apply of the same edits, so the
 *     panel's analyzer path is the CLI's, not a second one.
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
const { analyzeSeedlingRegion, applySeedlingRegionAnalysis } = await import(pathToFileURL(
    path.join(repoRoot, 'frontend/modules/flashPanel/seedlingAtlasAnalysis.js')));

const MAP_DOC = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const GAME_CONFIG = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));

// The edits the browser will perform, and the headless model's answer to them.
const LEVEL = 12;                       // OverWorld1_1 — a 20x20 overworld room
const REGION_ID = 'verify_region';
const BOUNDS = { x: 2, y: 2, w: 8, h: 6 };
const EXIT_ID = 'verify_north';
const EXIT_TILES = [[4, 2], [5, 2], [6, 2]];
const LOCATION_TILE = [5, 5];
const LOCATION_NAME = 'Verify - Chest';

// Phase G: a room the analyzer has something to say about. Dungeon1_1's
// breakable rock sits between the room and the tile holding the stairs down, so
// the split is 18 walkable tiles + 1, crossed by "Sword OR Spear".
const SPLIT_LEVEL = 3;
const SPLIT_REGION_ID = 'verify_split';
const SPLIT_BOUNDS = { x: 0, y: 0, w: 9, h: 9 };
const SPLIT_EXIT_ID = 'verify_up';
const SPLIT_EXIT_TILE = [4, 0];
const EXPECTED_SUB_REGIONS = ['r0c4', 'r8c6'];

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

/**
 * The document the model produces for phases B-D PLUS the Phase-G split region,
 * analyzed and accepted. Mirrors what the panel does, through the same modules
 * — including the panel's `stamp: false` (the session owns identity, and
 * toDocument() is the single stamping path).
 */
function headlessAfterAnalyze() {
    const s = headlessSession();
    s.addRegion({ region_id: SPLIT_REGION_ID, bounds: SPLIT_BOUNDS, map_ref: SPLIT_LEVEL });
    s.addExit(SPLIT_REGION_ID, { exit_id: SPLIT_EXIT_ID, tiles: [SPLIT_EXIT_TILE], kind: 'teleporter' });
    const analysis = analyzeSeedlingRegion(s.atlas, SPLIT_REGION_ID, { mapDoc: MAP_DOC, gameConfig: GAME_CONFIG });
    applySeedlingRegionAnalysis(s.atlas, analysis, { stamp: false });
    return { text: compactJsonFile(s.toDocument()), analysis };
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
    // `preset_sidecars` used to be asserted ABSENT here — Phase 3 was graph
    // only. Phase 4 made the compiler emit projection 3 for every region naming
    // a level, so the marked region (map_ref 12) now carries one, and the
    // assertion has been stale since 49a70ff35. It asserts the Phase-4 truth
    // instead: a sidecar exists, bound to the per-game substrate, with no exit
    // entries because the region's one exit is unwired.
    const sidecar = exported.preset_sidecars?.['1']?.[REGION_ID];
    check('Phase E: the exported graph holds the marked region and the start wiring',
        Object.keys(exported.regions['1']).sort().join(',') === EXPECTED_AP_REGIONS
        && exported.regions['1'].Menu.exits[0].connected_region === REGION_ID
        && exported.regions['1'][REGION_ID].locations[0].name === LOCATION_NAME
        && sidecar?.substrate === 'flash_seedling'
        && sidecar?.playable_payload?.level === LEVEL
        && sidecar?.playable_payload?.exits.length === 0,
        `${Object.keys(exported.regions['1']).join(', ')}; sidecar ${JSON.stringify(sidecar?.substrate ?? null)}`);
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

    // ── Phase G (Phase 5a) — analyze a real room ──────────────────────────
    //
    // Phase F's `ui:activatePanel` handed focus to the editor, so the tool's tab
    // has to come back forward before anything can be clicked on it.
    await page.evaluate(() => {
        const tab = [...document.querySelectorAll('.lm_tab .lm_title')]
            .find((t) => t.textContent.trim() === 'Region Marking Tool');
        if (!tab) throw new Error('no "Region Marking Tool" tab in the layout');
        tab.click();
    });
    await page.waitForSelector('.rmt-panel select', { state: 'visible', timeout: 15000 });

    // The prompt queue from Phase A is exhausted, so it is re-armed with the
    // two ids this phase needs.
    await page.evaluate(({ regionId, exitId }) => {
        const answers = [regionId, exitId];
        window.prompt = () => answers.shift() ?? null;
    }, { regionId: SPLIT_REGION_ID, exitId: SPLIT_EXIT_ID });

    await selectLevel(SPLIT_LEVEL);
    await clickToolbar('Region');
    await drag([SPLIT_BOUNDS.x, SPLIT_BOUNDS.y],
        [SPLIT_BOUNDS.x + SPLIT_BOUNDS.w - 1, SPLIT_BOUNDS.y + SPLIT_BOUNDS.h - 1]);
    await clickToolbar('Teleporter');
    await drag(SPLIT_EXIT_TILE, SPLIT_EXIT_TILE);
    const marked = await page.evaluate((id) => {
        const r = document.querySelector('.rmt-panel').__panel.session.regions().find((x) => x.region_id === id);
        return r ? { bounds: r.bounds, exits: r.exits.length, subgraph: r.subgraph ?? null } : null;
    }, SPLIT_REGION_ID);
    check('Phase G: the split region was marked and has no subgraph yet',
        marked && marked.exits === 1 && marked.subgraph === null
        && JSON.stringify(marked.bounds) === JSON.stringify(SPLIT_BOUNDS),
        JSON.stringify(marked));

    await clickToolbar('Analyze region');
    await page.waitForFunction(() => document.querySelector('.rmt-panel').__panel.analysis !== null,
        null, { timeout: 15000 });
    const proposal = await page.evaluate((id) => {
        const panel = document.querySelector('.rmt-panel').__panel;
        const region = panel.session.regions().find((x) => x.region_id === id);
        return {
            components: panel.analysis.components.map((c) => c.id),
            rows: panel.analysis.internal_exits,
            // The proposal must not have touched the document.
            liveSubgraph: region.subgraph ?? null,
            overlay: panel.renderer.partitionOverlay?.components?.length ?? 0,
            section: [...document.querySelectorAll('.rmt-section h4')].map((h) => h.textContent).includes('Proposed split'),
        };
    }, SPLIT_REGION_ID);
    check('Phase G: Analyze PROPOSED a split without touching the document',
        proposal.components.join(',') === EXPECTED_SUB_REGIONS.join(',')
        && proposal.liveSubgraph === null
        && proposal.overlay === 2
        && proposal.section === true,
        JSON.stringify({ components: proposal.components, live: proposal.liveSubgraph, overlay: proposal.overlay }));
    check('Phase G: the proposed crossing carries the breakable rock\'s real rule',
        proposal.rows.length === 1
        && proposal.rows[0].source === 'analyzer'
        && proposal.rows[0].bidirectional === true
        && JSON.stringify(proposal.rows[0].access_rule) === JSON.stringify({
            rule: 'Or',
            children: [
                { rule: 'Has', args: { item_name: 'Progressive Sword' } },
                { rule: 'Has', args: { item_name: 'Ghost Spear' } },
            ],
        }),
        JSON.stringify(proposal.rows));

    await clickToolbar('Accept');
    const accepted = await page.evaluate((id) => {
        const panel = document.querySelector('.rmt-panel').__panel;
        const region = panel.session.regions().find((x) => x.region_id === id);
        return {
            pending: panel.analysis,
            subRegions: region.subgraph?.sub_regions ?? null,
            rows: region.subgraph?.internal_exits ?? null,
            rulesSource: region.annotations?.rules_source,
            exitSub: region.exits[0].sub_region,
            overlay: panel.renderer.partitionOverlay,
        };
    }, SPLIT_REGION_ID);
    check('Phase G: Accept applied the split and cleared the proposal',
        accepted.pending === null
        && accepted.overlay === null
        && (accepted.subRegions ?? []).join(',') === EXPECTED_SUB_REGIONS.join(',')
        && accepted.rows?.length === 1
        && accepted.rulesSource === 'analyzer'
        && accepted.exitSub === EXPECTED_SUB_REGIONS[0],
        JSON.stringify({ subs: accepted.subRegions, source: accepted.rulesSource, exitSub: accepted.exitSub }));

    // The strong check, the same shape as Phase D's: the panel's analyzer path
    // is the headless one, byte for byte.
    const { text: expectedAfterAnalyze } = headlessAfterAnalyze();
    const panelAfterAnalyze = await page.evaluate(
        () => document.querySelector('.rmt-panel').__panel.serialize(),
    );
    check('Phase G: the panel\'s analyze+accept path IS the model\'s (byte-identical)',
        panelAfterAnalyze === expectedAfterAnalyze,
        panelAfterAnalyze === expectedAfterAnalyze
            ? ''
            : `panel ${panelAfterAnalyze.length}B vs headless ${expectedAfterAnalyze.length}B`);
} finally {
    await browser.close();
}

console.log(failures === 0 ? '\nOK: region marking tool verified in-app' : `\nFAILED: ${failures} check(s)`);
process.exit(failures === 0 ? 0 : 1);
