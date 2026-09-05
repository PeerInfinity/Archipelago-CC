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
 *   Phase F (Phase 3) — "Open in APWorld Editor" hands the compiled world over
 *     the dedicated apworldEditor:loadRules channel, and the EDITOR'S OWN model
 *     ends up holding the compiled regions.
 *   Phase G (Phase 5a) — "Analyze region" on a real room with a real item gate
 *     (Dungeon1_1, whose breakable rock walls off the way down) PROPOSES a split
 *     without touching the document, and Accept applies it. The accepted atlas
 *     is byte-identical to a headless analyze+apply of the same edits, so the
 *     panel's analyzer path is the CLI's, not a second one.
 *
 *   Phase H (EDITOR INTEGRATION B-a) — UNDO. The six inspector fields that used
 *     to write straight into the document are ops now, so a run of edits
 *     through them followed by one undo each returns the SAVED BYTES of the
 *     document before them. Byte identity is the claim: a hatch that still
 *     mutated in place, or an undo built from inverse ops rather than the
 *     fold, reproduces the content and not the bytes.
 *
 * Prereq: a dev server serving the repo root (`--host=`, default :8000;
 * localhost -> unbundled ES modules, so source edits are picked up).
 * Run: node scripts/procgen/verify-region-marking-tool.mjs [--host=URL]
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { takeBoxLockOrExit } from './boxLock.js';

/**
 * ⛓ R9 P3b, ⚖ 54 (7); ⚖ 62 at 12j — **THE BOX LOCK.** This instrument drives
 * the machine (browser), so it takes the box before it starts and refuses BY
 * NAME if another instrument holds it — replacing a hand-relayed "BOX BUSY".
 * A run UNDER a holder (`gates.mjs`, `standing-values`,
 * `rerecord-seedling-campaign`) recognises the holder's token and passes
 * through. `--wait-for-box=<sec>` queues instead of refusing.
 */

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
takeBoxLockOrExit({ name: 'verify-region-marking-tool.mjs', kind: 'browser' });

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

// ⛓ B-a — the host was hardcoded; the DEFAULT is unchanged, so every existing
//   invocation still points at :8000 and a parallel worktree can serve its own.
const HOST = (process.argv.find((a) => a.startsWith('--host=')) ?? '--host=http://localhost:8000').slice('--host='.length);

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
    await page.goto(`${HOST}/frontend/?mode=flash`, { waitUntil: 'domcontentloaded' });
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
    await clickToolbar('Open in APWorld Editor');
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
    // ── Phase H (B-a) — UNDO, in BYTES ────────────────────────────────────
    //
    // ⛔ THE BASELINE IS THE SAVED BYTES, not the content: `serialize()` is the
    // panel's own save path (stamped through the validator, laid out by the
    // compact writer), and key order is part of what every gate above compares.
    const beforeH = panelAfterAnalyze;
    const editsBefore = await page.evaluate(
        () => document.querySelector('.rmt-panel').__panel.session.edits().length,
    );
    check('Phase H: the session has an op list to undo from', editsBefore > 0, `${editsBefore} edit(s)`);

    /** Set an inspector field inside the section whose <h4> starts with `title`. */
    const setField = (title, label, value) => page.evaluate(({ title, label, value }) => {
        const section = [...document.querySelectorAll('.rmt-panel .rmt-section')]
            .find((sec) => sec.querySelector('h4')?.textContent.trim().startsWith(title));
        // ⛔ `Regions (2)` ALSO starts with "Region" and comes FIRST in the
        //    sidebar — the region inspector's title is `Region "<id>"`.
        if (!section) throw new Error(`no section starting "${title}"`);
        const field = [...section.querySelectorAll('.rmt-field')]
            .find((l) => l.querySelector('span')?.textContent.trim() === label);
        if (!field) throw new Error(`no field "${label}" in "${title}"`);
        const input = field.querySelector('input, select, textarea');
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { title, label, value });

    const setByPlaceholder = (placeholder, value) => page.evaluate(({ placeholder, value }) => {
        const input = [...document.querySelectorAll('.rmt-panel [placeholder]')]
            .find((n) => n.getAttribute('placeholder') === placeholder);
        if (!input) throw new Error(`no field with placeholder "${placeholder}"`);
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { placeholder, value });

    // ⛓ ONE EDIT PER HATCH, each naming the field it used to assign.
    await setField('Atlas', 'game', 'seedling_h');              // :701
    await setField('Atlas', 'name', 'Phase H atlas');           // :702
    await setField('Region "', 'name', 'Phase H region');       // :739
    await setField('Region "', 'rules_source', 'mixed');        // :742
    await setByPlaceholder('access_rule JSON (optional)',
        JSON.stringify({ rule: 'Has', args: { item_name: 'Progressive Sword' } }));  // :854
    await page.waitForTimeout(60);

    const afterEdits = await page.evaluate(() => {
        const panel = document.querySelector('.rmt-panel').__panel;
        return {
            edits: panel.session.edits().length,
            kinds: panel.session.edits().map((o) => o.op),
            text: panel.serialize(),
        };
    });
    const HATCH_OPS = ['set-game', 'set-name', 'set-region-name', 'set-rules-source', 'set-exit-rule'];
    check('Phase H: each inspector field recorded an OP (not an in-place write)',
        afterEdits.edits === editsBefore + HATCH_OPS.length
        && HATCH_OPS.every((k) => afterEdits.kinds.includes(k)),
        `${afterEdits.edits} edit(s); last ${afterEdits.kinds.slice(-HATCH_OPS.length).join(', ')}`);
    // Not vacuous: the document really moved.
    check('Phase H: …and the document MOVED', afterEdits.text !== beforeH);

    const undone = await page.evaluate((n) => {
        const panel = document.querySelector('.rmt-panel').__panel;
        for (let i = 0; i < n; i += 1) if (!panel._undo()) return { short: i };
        return { edits: panel.session.edits().length, text: panel.serialize() };
    }, HATCH_OPS.length);
    check('Phase H: one undo per edit takes the list back to where it was',
        undone.edits === editsBefore, JSON.stringify({ ...undone, text: undefined }));
    check('Phase H: …and the SAVED BYTES are the ones from before the edits',
        undone.text === beforeH,
        undone.text === beforeH ? '' : `undone ${undone.text?.length}B vs before ${beforeH.length}B`);

    // ⛔ THE KEY BINDING REFUSES INSIDE A TEXT FIELD, or a person typing a rule
    //    loses it to an atlas undo.
    const keyGuard = await page.evaluate(() => {
        const panel = document.querySelector('.rmt-panel').__panel;
        const before = panel.session.edits().length;
        // ⛔ FIRST: a press on the canvas must leave focus INSIDE the panel, or
        //    the key binding is unreachable for anyone who marks with the mouse.
        //
        // ⚠ THE BLUR IS THE WHOLE ROW. Playwright's `selectOption` FOCUSES the
        //    level picker back in Phase G, and that picker is inside the panel
        //    — so "is focus in the panel after the press" was true no matter
        //    what the press did, and the mutant that never attaches the
        //    listener passed 27/27. Focus is cleared first and its ABSENCE
        //    asserted, so the row measures the handler rather than the harness.
        document.activeElement?.blur?.();
        const focusedBefore = panel.rootElement.contains(document.activeElement);
        panel.canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        const focusedAfterCanvas = panel.rootElement.contains(document.activeElement);
        const input = document.querySelector('.rmt-panel .rmt-input');
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
        const afterInInput = panel.session.edits().length;
        panel.rootElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
        return {
            before, afterInInput, focusedBefore, focusedAfterCanvas,
            afterOnRoot: panel.session.edits().length,
        };
    });
    check('Phase H: a canvas press leaves focus inside the panel (the binding is reachable)',
        keyGuard.focusedBefore === false && keyGuard.focusedAfterCanvas === true,
        JSON.stringify(keyGuard));
    check('Phase H: Ctrl+Z inside a text field does NOT undo, and on the root DOES',
        keyGuard.afterInInput === keyGuard.before && keyGuard.afterOnRoot === keyGuard.before - 1,
        JSON.stringify(keyGuard));

    // ── Phase F′ (B-c) — THE APWORLD EDITOR ON A SESSION ──────────────────
    //
    // ⛔ Phase F proved the STASH; this proves the PANEL. It mounts the editor,
    //   re-runs the hand-off so the mounted panel adopts it live, and asks the
    //   four things a session is for: the ops are recorded, undo returns the
    //   document BYTE FOR BYTE, Apply publishes those same bytes, and the key
    //   binding refuses inside a field.
    //
    // ⛓ It runs LAST on purpose: Apply republishes `files:jsonLoaded`, which is
    //   an app-wide rules reload, and nothing above it should be measured
    //   downstream of that.
    await page.evaluate(() => {
        const tab = [...document.querySelectorAll('.lm_tab .lm_title')]
            .find((t) => t.textContent.trim() === 'APWorld Editor');
        if (!tab) throw new Error('no "APWorld Editor" tab in the layout');
        tab.click();
    });
    await page.waitForSelector('.apworld-editor-panel', { state: 'visible', timeout: 15000 });

    // Hand the compiled world over AGAIN, now that the panel is mounted: this is
    // the live-adopt arm (`_adoptHandoffRules`), where Phase F took the stash.
    await page.evaluate(() => {
        const tab = [...document.querySelectorAll('.lm_tab .lm_title')]
            .find((t) => t.textContent.trim() === 'Region Marking Tool');
        tab.click();
    });
    await page.waitForSelector('.rmt-panel', { state: 'visible', timeout: 15000 });
    await clickToolbar('Open in APWorld Editor');
    await page.waitForSelector('.apworld-editor-panel', { state: 'visible', timeout: 15000 });

    const apState = () => page.evaluate(() => {
        const panel = document.querySelector('.apworld-editor-panel').__panel;
        return {
            ops: panel.session ? panel.session.ops().length : null,
            kinds: panel.session ? panel.session.ops().map((o) => o.op) : null,
            base: panel.session ? panel.session.payload().base : null,
            text: panel.session ? JSON.stringify(panel.session.record()) : null,
            regions: Object.keys(panel.rulesDoc?.regions?.['1'] ?? {}),
            undoLabel: panel.undoButton?.textContent ?? null,
            bar: panel.validationBar.textContent.trim(),
        };
    });

    const handoff = await apState();
    // ⚠ NOT `EXPECTED_AP_REGIONS`: by now Phase G has added the split region, so
    //   the compiled world is a SUPERSET of Phase F's. What this row asserts is
    //   the session's identity and that the world really arrived.
    check('Phase F′: the panel MOUNTED on a session over the handed-over world',
        handoff.ops === 0 && handoff.base?.kind === 'rules' && handoff.base?.source === 'hand-off'
        && handoff.regions.includes(REGION_ID) && handoff.regions.includes('Menu'),
        JSON.stringify({ ops: handoff.ops, base: handoff.base, regions: handoff.regions }));

    // ⛓ TWO OPS, through the panel's own controls — the "+ Add region" button
    //   and the region-name field's `change`, which is the rename cascade.
    const afterTwo = await page.evaluate(async () => {
        const panel = document.querySelector('.apworld-editor-panel').__panel;
        const add = [...panel.scrollContainer.querySelectorAll('button')]
            .find((b) => b.textContent.trim() === '+ Add region');
        if (!add) throw new Error('no "+ Add region" button');
        add.click();
        const input = [...panel.scrollContainer.querySelectorAll('input')]
            .find((i) => i.value === 'New Region');
        if (!input) throw new Error('the added region has no name field');
        input.value = 'Phase F prime';
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return {
            ops: panel.session.ops().length,
            kinds: panel.session.ops().map((o) => o.op),
            text: JSON.stringify(panel.session.record()),
            undoLabel: panel.undoButton.textContent,
        };
    });
    check('Phase F′: the button and the name field each recorded an OP (not an in-place write)',
        afterTwo.ops === 2 && afterTwo.kinds.join(',') === 'add-region,rename-region',
        JSON.stringify({ ops: afterTwo.ops, kinds: afterTwo.kinds, label: afterTwo.undoLabel }));
    check('Phase F′: …and the document MOVED', afterTwo.text !== handoff.text);

    const apUndone = await page.evaluate((n) => {
        const panel = document.querySelector('.apworld-editor-panel').__panel;
        for (let i = 0; i < n; i += 1) if (!panel._undo()) return { short: i };
        return {
            ops: panel.session.ops().length,
            text: JSON.stringify(panel.session.record()),
            bar: panel.validationBar.textContent.trim(),
            undoLabel: panel.undoButton.textContent,
            disabled: panel.undoButton.disabled,
        };
    }, 2);
    check('Phase F′: one undo per edit takes the document back BYTE FOR BYTE',
        apUndone.ops === 0 && apUndone.text === handoff.text,
        apUndone.text === handoff.text ? '' : `undone ${apUndone.text?.length}B vs handoff ${handoff.text.length}B`);
    // ⛔ THE READOUTS ARE RE-READ FROM THE RECORD, not left standing across the
    //    undo — the derived-state row.
    check('Phase F′: the validation bar and the Undo control agree with the UNDONE document',
        apUndone.bar === handoff.bar && apUndone.disabled === true,
        JSON.stringify({ bar: apUndone.bar, was: handoff.bar, label: apUndone.undoLabel }));

    // ⛓ APPLY publishes `session.record()` and does NOT reset the session.
    const applied = await page.evaluate(async () => {
        const mod = await import('./modules/apworldEditor/index.js');
        const bus = mod.getModuleEventBus();
        let seen = null;
        const grab = (ev) => { if (ev?.sourceName === 'apworldEditorApply') seen = ev.jsonData; };
        bus.subscribe('files:jsonLoaded', grab);
        const panel = document.querySelector('.apworld-editor-panel').__panel;
        panel._handleApply();
        bus.unsubscribe('files:jsonLoaded', grab);
        return { published: seen === null ? null : JSON.stringify(seen) };
    });
    check('Phase F′: Apply publishes bytes EQUAL to the handed-over document',
        applied.published === handoff.text,
        applied.published === handoff.text ? '' : `published ${applied.published?.length}B vs handoff ${handoff.text.length}B`);

    // ⛔ AND THE KEY BINDING REFUSES INSIDE A FIELD. This panel is ALL inputs, so
    //    the guard is the important half: a browser's own undo in a half-typed
    //    region name is what a person means by ⌘Z with their cursor in it.
    const apKeys = await page.evaluate(() => {
        const panel = document.querySelector('.apworld-editor-panel').__panel;
        const add = [...panel.scrollContainer.querySelectorAll('button')]
            .find((b) => b.textContent.trim() === '+ Add region');
        add.click();                                        // one op to undo
        const before = panel.session.ops().length;
        document.activeElement?.blur?.();
        const focusedBefore = panel.rootElement.contains(document.activeElement);
        panel.scrollContainer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        const focusedAfterPress = panel.rootElement.contains(document.activeElement);
        const input = panel.scrollContainer.querySelector('input');
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
        const afterInInput = panel.session.ops().length;
        panel.rootElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
        return {
            before, afterInInput, focusedBefore, focusedAfterPress,
            afterOnRoot: panel.session.ops().length,
        };
    });
    check('Phase F′: a press on the panel leaves focus inside it (the binding is reachable)',
        apKeys.focusedBefore === false && apKeys.focusedAfterPress === true,
        JSON.stringify(apKeys));
    check('Phase F′: Ctrl+Z inside a text field does NOT undo, and on the root DOES',
        apKeys.afterInInput === apKeys.before && apKeys.afterOnRoot === apKeys.before - 1,
        JSON.stringify(apKeys));

    // ⛓⛓ THE VALIDATION BAR IS RE-READ FROM THE RECORD, and this row can SEE a
    //   stale one: the edit makes the validator say something DIFFERENT, so a
    //   bar left standing across the undo keeps the error.
    const barRow = await page.evaluate(() => {
        const panel = document.querySelector('.apworld-editor-panel').__panel;
        const before = panel.validationBar.textContent.trim();
        panel._applyOp({
            op: 'set-completion-condition',
            condition: { type: 'item_check', item: 'No Such Item' },
            player: '1',
        });
        const during = panel.validationBar.textContent.trim();
        panel._undo();
        return { before, during, after: panel.validationBar.textContent.trim() };
    });
    check('Phase F′: the validation bar MOVES on an edit and comes BACK on the undo',
        barRow.before !== barRow.during && barRow.after === barRow.before,
        JSON.stringify(barRow));

    // ⛓⛓ APPLY DOES NOT RESET THE SESSION, and RELOAD IS A BOUNDARY. The two
    //   are the same measurement from opposite sides: an edit survives an Apply
    //   (the person may keep editing), and does NOT survive a Reload (a
    //   different document arrived, so an undo across it would reconstruct
    //   bytes nobody ever saw).
    const boundary = await page.evaluate(() => {
        const panel = document.querySelector('.apworld-editor-panel').__panel;
        panel._applyOp({ op: 'add-region', player: '1' });
        const opsBeforeApply = panel.session.ops().length;
        panel._handleApply();
        const afterApply = {
            ops: panel.session.ops().length,
            undoable: !panel.undoButton.disabled,
        };
        panel._handleReload();                       // window.confirm is stubbed true
        return {
            opsBeforeApply,
            afterApply,
            afterReload: {
                ops: panel.session.ops().length,
                source: panel.session.payload().base?.source,
                undid: panel._undo(),
            },
        };
    });
    check('Phase F′: Apply does NOT reset the session — an edit is still undoable after it',
        boundary.opsBeforeApply === 1 && boundary.afterApply.ops === 1 && boundary.afterApply.undoable,
        JSON.stringify(boundary));
    check('Phase F′: Reload IS a boundary — a new base, no op list, and nothing to undo across it',
        boundary.afterReload.ops === 0 && boundary.afterReload.source === 'reload'
        && boundary.afterReload.undid === false,
        JSON.stringify(boundary.afterReload));

    // ── Phase F″ (B-c) — THE RULE TREE'S HOLDER ───────────────────────────
    //
    // ⛔⛔ THE RISKIEST PIECE, AND ITS TWO ROWS. `RuleTreeEditor` has TWO write
    //   paths: the four `ruleTreeOps` gestures (`_applyTreeOp`) AND about a
    //   dozen FIELD editors that write into a node it is already holding, in
    //   place and with no re-render. The panel hands it a HOLDER over a working
    //   copy and commits `set-rule-tree` carrying the RESULT — on a gesture
    //   (`onTree`) and on a captured, microtask-deferred `change`. If either
    //   half is missing, the field edits reach the DOM and never the session.
    const treeState = await page.evaluate(() => {
        const panel = document.querySelector('.apworld-editor-panel').__panel;
        const wraps = [...panel.scrollContainer.querySelectorAll('.apworld-rule')];
        return { wraps: wraps.length, path: wraps[0]?.dataset.rulePath ?? null };
    });
    check('Phase F′: the Regions tab rendered rule-tree editors, each carrying its own commit path',
        treeState.wraps > 0 && !!treeState.path, JSON.stringify(treeState));

    /**
     * ⛔ EVERY QUERY BELOW IS SCOPED TO ONE `.apworld-rule`. The first version of
     * this row found "the item field" by walking the whole panel for an input
     * whose parent text contained `item:` — and picked the `count:` input in the
     * same field row, whose `parseInt` of a name is NaN, whose write is
     * therefore a no-op, and whose commit the session correctly dropped. The row
     * reported the HOLDER as broken when what was broken was the row.
     */
    const fieldEdit = await page.evaluate(async () => {
        const panel = document.querySelector('.apworld-editor-panel').__panel;
        const wait = () => new Promise((r) => setTimeout(r, 0));
        const wrap = panel.scrollContainer.querySelector('.apworld-rule');
        const typeSel = [...wrap.querySelectorAll('select')]
            .find((s) => [...s.options].some((o) => o.value === 'Has'));
        if (!typeSel) throw new Error('no rule-type select offering `Has`');
        typeSel.value = 'Has';
        typeSel.dispatchEvent(new Event('change', { bubbles: true }));
        await wait();
        const afterType = {
            ops: panel.session.ops().length,
            kinds: panel.session.ops().map((o) => o.op),
            text: JSON.stringify(panel.session.record()),
        };
        // ⛓ `args.item_name = v` — one of the in-place field editors.
        //
        // ⛔ `input[type=text]`, and the type is the whole point: a `Has` row is
        //   the item NAME (text, datalist-backed) beside a `count` (number), and
        //   the first version of this row picked the count by walking label
        //   text — whose `parseInt` of a name is NaN, whose write is therefore a
        //   no-op, and whose commit the session correctly dropped. It reported
        //   the HOLDER as broken when what was broken was the row.
        //
        // ⚠ NOT `input[list]`: the datalist is only attached when the document
        //   HAS items, and this compiled world has none (the marking tool's
        //   projection carries regions and locations, not an item pool).
        const itemInput = wrap.querySelector('input[type=text]');
        if (!itemInput) throw new Error('no item field after switching to Has');
        itemInput.value = 'Phase F prime item';
        itemInput.dispatchEvent(new Event('input', { bubbles: true }));
        itemInput.dispatchEvent(new Event('change', { bubbles: true }));
        await wait();
        const afterField = {
            ops: panel.session.ops().length,
            kinds: panel.session.ops().map((o) => o.op),
            text: JSON.stringify(panel.session.record()),
        };
        panel._undo();
        return {
            afterType, afterField, undone: JSON.stringify(panel.session.record()),
            msg: panel._opMessage,
        };
    });
    check('Phase F′ (a): an in-place FIELD edit inside the tree editor lands as exactly ONE `set-rule-tree`',
        fieldEdit.afterField.ops === fieldEdit.afterType.ops + 1
        && fieldEdit.afterField.kinds.at(-1) === 'set-rule-tree'
        && fieldEdit.afterField.text.includes('Phase F prime item'),
        JSON.stringify({ before: fieldEdit.afterType.ops, after: fieldEdit.afterField.ops, kinds: fieldEdit.afterField.kinds.slice(-3), msg: fieldEdit.msg }));
    check('Phase F′ (a): …and ONE undo restores the previous tree BYTE FOR BYTE',
        fieldEdit.undone === fieldEdit.afterType.text,
        fieldEdit.undone === fieldEdit.afterType.text ? '' : `${fieldEdit.undone.length}B vs ${fieldEdit.afterType.text.length}B`);

    const rawEdit = await page.evaluate(async () => {
        const panel = document.querySelector('.apworld-editor-panel').__panel;
        const wait = () => new Promise((r) => setTimeout(r, 0));
        const wrap = panel.scrollContainer.querySelector('.apworld-rule');
        const typeSel = [...wrap.querySelectorAll('select')]
            .find((s) => [...s.options].some((o) => o.value === '__raw__'));
        if (!typeSel) throw new Error('no rule-type select offering the raw view');
        const beforeToggle = panel.session.ops().length;
        typeSel.value = '__raw__';
        typeSel.dispatchEvent(new Event('change', { bubbles: true }));
        await wait();
        const afterToggle = {
            ops: panel.session.ops().length,
            text: JSON.stringify(panel.session.record()),
        };
        const ta = wrap.querySelector('textarea');
        if (!ta) throw new Error('the raw view rendered no textarea');
        ta.value = JSON.stringify({ rule: 'CanReachRegion', args: { region_name: 'Phase F prime raw' } });
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
        await wait();
        const afterRaw = {
            ops: panel.session.ops().length,
            kinds: panel.session.ops().map((o) => o.op),
            text: JSON.stringify(panel.session.record()),
        };
        panel._undo();
        return { beforeToggle, afterToggle, afterRaw, undone: JSON.stringify(panel.session.record()) };
    });
    // ⛓ A VIEW TOGGLE IS NOT AN EDIT: switching to the raw view moves a WeakSet
    //   and no bytes, so its `change` commits a NO-OP the session drops.
    check('Phase F′ (b): switching to the RAW VIEW records nothing — a view toggle is not an edit',
        rawEdit.afterToggle.ops === rawEdit.beforeToggle,
        JSON.stringify({ before: rawEdit.beforeToggle, after: rawEdit.afterToggle.ops }));
    check('Phase F′ (b): the raw-JSON `Object.assign` path lands as exactly ONE `set-rule-tree`',
        rawEdit.afterRaw.ops === rawEdit.afterToggle.ops + 1
        && rawEdit.afterRaw.kinds.at(-1) === 'set-rule-tree'
        && rawEdit.afterRaw.text.includes('Phase F prime raw'),
        JSON.stringify({ before: rawEdit.afterToggle.ops, after: rawEdit.afterRaw.ops, kinds: rawEdit.afterRaw.kinds.slice(-3) }));
    check('Phase F′ (b): …and ONE undo restores the previous tree BYTE FOR BYTE',
        rawEdit.undone === rawEdit.afterToggle.text,
        rawEdit.undone === rawEdit.afterToggle.text ? '' : `${rawEdit.undone.length}B vs ${rawEdit.afterToggle.text.length}B`);

} finally {
    await browser.close();
}

console.log(failures === 0 ? '\nOK: region marking tool verified in-app' : `\nFAILED: ${failures} check(s)`);
process.exit(failures === 0 ? 0 : 1);
