/**
 * In-app tests for the APWORLD EDITOR HUB (`NewDocs/plans/apworld-editor-hub-plan.md`,
 * rung H1). **These are the panel's FIRST in-app rows** — it had zero before
 * this slice, and the three node suites beside it (`rulesDocOps`,
 * `rulesEditAdapter`, `rulesUtils`) never mount it.
 *
 *   1. apworld-document-tab-lists-every-schema-key — the Document tab is
 *      DERIVED from `rules.schema.json`, so the set of keys it draws must EQUAL
 *      the set the schema declares. The expectation is fetched from the schema
 *      at run time, never typed: a schema that grows a key retargets this row
 *      instead of breaking it, and a registry that silently dropped one reds it.
 *   2. apworld-set-key-round-trips-through-undo — the tab's whole edit
 *      vocabulary is ONE `set-key` op, driven through the real input's `change`
 *      event and undone through the real Undo button. ⛔ The undo half is the
 *      half that matters: an op that stored the caller's reference instead of a
 *      copy applies fine and comes back WRONG.
 *   3. apworld-links-tab-covers-every-room-editor-declarer — the substrate rows
 *      are derived from the live `substrateRegistry`, so the expected set is
 *      read off the registry in the browser rather than listed here.
 *
 * ⚠ Rows are named by what they ASSERT and carry no counts: a count in a test
 * NAME is an allowlist key, and moving it reds CI twice.
 */

import { registerTest } from '../testRegistry.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
/** ⛓ H4b — the LAB door's host registry and the SET arm's envelope, so the row
 *  drives the real three-phase contract instead of waiting on an iframe. */
import {
    findLabPanel, labPanelInstances, registerLabPanelInstance, unregisterLabPanelInstance,
} from '../../procgenLabPanel/labRoomEditor.js';
import { makeSetRecordEnvelope } from '../../procgenCore/labRoomEnvelope.js';
/**
 * ⛓⛓ H4b — **THE APP'S BUS, BECAUSE `procgenLab:levelChanged` HAS NO STATIC
 * PUBLISHER.** It is a PAGE → HOST event, and the app adapter registers its
 * publisher DYNAMICALLY as `iframe_<iframeId>` at publish time
 * (`iframeAdapterCore.handlePublishEventBus`); the bus SKIPS a publish from an
 * unregistered name with only a warn log, so a row publishing as `tests`
 * publishes nothing at all. Measured: the first run of the row below sat
 * through all three phases and reported the door never asked for a room.
 * ⇒ the row registers itself the way any publisher does, once.
 */
import appEventBus from '../../../app/core/eventBus.js';
/**
 * ⛓⛓ H4c — **THE REVERSE LINK IS DRIVEN THROUGH ITS OWN PUBLISHER.** The
 * bounce editor's door is `openRegionInApworldEditor`, and a row that published
 * `apworldEditor:selectRegion` by hand would prove the hub's SUBSCRIBER works
 * while saying nothing about whether the button reaches it — the two halves
 * only meet through this function.
 */
import {
    openRegionInApworldEditor, APWORLD_EDITOR_SELECT_REGION,
} from '../../bounceRegionEditor/index.js';
/**
 * ⛓⛓ H5 — **THE EXPECTATION FOR THE MARKING TOOL'S RETURN IS THE COMPILER'S
 * OWN DERIVATION.** `regionAtlasReference` is what `compileRegionAtlas` writes
 * into `rules.region_atlas`; a row that rebuilt those three fields by hand
 * would agree with the door and say nothing about whether either agrees with
 * the compiler.
 */
import { regionAtlasReference } from '../../procgenPipeline/regionAtlasCompiler.js';
/** ⛓ H5 — the registry the Document row and the Links row both read. */
import { DOCUMENT_KEY_EDITORS } from '../../apworldEditor/documentKeys.js';
/**
 * ⛓ R-a — the two numbers the presence switch writes, compared against their
 * SOURCE. Typing 50 and 10 into this row would make it agree with a second copy
 * of the pair rather than with `loopCostDefaults.js`.
 */
import {
    DEFAULT_LOCATION_COST, DEFAULT_REGION_COST,
} from '../../shared/procgen/loopCostDefaults.js';

const PANEL_ID = 'apworldEditorPanel';
const PANEL_SELECTOR = '.apworld-editor-panel';
const PRESET_PATH = './presets/procgen_maze/AP_1/AP_1_rules.json';
/**
 * ⛓ H3 — a document whose sidecars carry NO `grid_cell`. Measured over the 205
 * committed presets: 4 have sidecars with no grid cell at all, and this is the
 * jta one. It is the "no map for this world" case the ⚖ ruled on (no graph
 * fallback), and it must be a real committed document rather than a fixture —
 * the claim is about what the corpus contains.
 */
const NO_GRID_PRESET_PATH =
    './presets/jta_substrate_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
/**
 * ⛓ H2b — **the document H2's textarea REFUSED**: `stardew_valley` at 2,620,221
 * pretty bytes, over the retired `RAW_VIEW_LIMIT_BYTES = 2_000_000`. It is a
 * committed preset rather than a padded fixture because the claim is about the
 * corpus. (It is the SECOND-largest; the largest, `procgen_topdown/AP_8` at
 * 3,146,656 B, is the instrument's `--all` arm's business — this row wants the
 * document whose refusal a person actually saw.)
 *
 * ⚠ **2,620,221, not the 2,620,225 the plan's §12.3 table says.** H2's pretty
 * column for this one preset came from `json.dumps(indent=2)`, whose default
 * `ensure_ascii` spells four non-ASCII bytes as escape sequences; the raw
 * view's units are `JSON.stringify`'s. Here the two agree with the file on
 * disk, because stardew is one of the 192 written pretty already.
 */
const REFUSED_PRESET_PATH =
    './presets/stardew_valley/AP_14089154938208861744/AP_14089154938208861744_rules.json';
/**
 * ⛓⛓ **H4a — THE FOUR-PLAYER FIXTURE**, and the only committed document whose
 * `preset_sidecars` carry more than one slot. Measured over the presets tree
 * before it existed: 192 documents carry the key, 158 hold `{}`, and all 34
 * populated ones key under slot `"1"` — the fifteen four-player `multiworld`
 * files included, because every one of them is an ALTTP-family world whose
 * sidecars are empty. So every per-player path in this panel (the selector, the
 * Map tab's slot, the Document tab's per-player slice) had NEVER met a document
 * that could tell "read the selected slot" from "read the first one".
 *
 * Slots 1 and 2 are `Procgen Maze WorldGen` (3 grown regions each, `grid_cell`
 * on every one); slots 3 and 4 are `Bounce Demo WorldGen` (5 ZONE regions each,
 * no `grid_cell`) — the ⚖-ruled "no map for this world" answer, on the SAME
 * document as a slot that does draw.
 */
const FOUR_PLAYER_PATH =
    './presets/multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json';
/** ⛓ The same generation's PER-PLAYER export for slot 3: it names its own slot
 *  in `playerId`, and carries only that slot's sidecars. */
const FOUR_PLAYER_P3_PATH =
    './presets/multiworld/AP_05594871498841892311/AP_05594871498841892311_P3_rules.json';

/**
 * ⛓ H4b — a committed document whose sidecars are SEEDLING's. Its substrate
 * declares a `roomEditor` (the pipeline still opens a Seedling room from a live
 * run) and `regionRoundTrip: {refused}` — the ONE case where the button is
 * disabled by a DECLARATION rather than by an absence, and the sentence in its
 * title is the substrate's own.
 */
const SEEDLING_PRESET_PATH = './presets/seedling_atlas/AP_1/AP_1_rules.json';
/**
 * ⛓ **THE DOCUMENT THAT STILL FAILS CHECK (1)**, and the reason this row needed
 * a new one at H6b. Its ten rooms are written by the ATLAS DERIVATION rather
 * than by `serializeMazeWorld`, so a round trip adds an `itemLib: {}` and a
 * computed `longestShortestPath` they do not carry — the "an unedited save
 * would already rewrite this payload" refusal, which is the only refusal that
 * costs a deserialize and therefore the only one that lands AFTER the press.
 * ⚖ Fixing these ten is H6a's job; when it lands, this arm moves with it.
 */
const ATLAS_MAZE_PRESET_PATH = './presets/seedling_atlas_maze/AP_1/AP_1_rules.json';

const SCHEMA_PATH = './schema/rules.schema.json';

/**
 * ⛓ H5 — the only committed documents that carry `region_atlas`, and it is a
 * REFERENCE (`{atlas_id, game, map_document}`), never an atlas. Measured over
 * the corpus: three carriers, all three the same three fields.
 */
const REGION_ATLAS_PRESET_PATH = './presets/seedling_playthrough/AP_1/AP_1_rules.json';
/** ⛓ H5 — carries `loop_costs` AND its own embedded `sphere_log`. */
const LOOP_COSTS_PRESET_PATH =
    './presets/jta_schedule_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';
/**
 * ⛓⛓ L4 — the WRITE-BACK's document, and it is not the one above.
 *
 * ⛔ Measured over the corpus: TWELVE presets carry `loop_costs` and an embedded
 * `sphere_log`, and the ten TRACKED ones all carry an EMPTY block. Of those,
 * `jta_schedule_test`'s three regions are all NATIVE, so a plan sent into it
 * writes exactly one entry — `Menu`, at `moveCost: 0`. That would make "an empty
 * block became a priced one" true of a zero, which is the weakest possible form
 * of the claim.
 *
 * `omsi_substrate_test` is the document where both halves are real: its
 * `region_0_0` / `region_1_0` are MAZE (coarse-classed, so the block carries
 * their `moveCost`) and its `region_1_1` is omsi (NATIVE, so the block carries
 * nothing for it) — L3 measured 16 and 21 against a stored 50, which is the
 * finding that motivated this door. So the write-back must ADD non-zero prices
 * AND leave the native region out, in one document.
 */
const LOOP_COSTS_WRITEBACK_PRESET_PATH =
    './presets/omsi_substrate_test/AP_14089154938208861744/AP_14089154938208861744_rules.json';

/**
 * Load the preset, raise the panel, and hand back its live instance.
 *
 * ⛓ H2b — the budget is a PARAMETER because one row opens a 2.6 MB document.
 * ⛔ Not raised for everyone: a longer poll makes a genuinely stuck panel take
 * longer to say so, and every other row here loads a 200 KB preset.
 */
async function openHub(testController, presetPath = PRESET_PATH, budgetMs = 8000) {
    testController.log(`Loading ${presetPath}…`);
    await testController.loadRulesFromFile(presetPath);
    await testController.stateManager.pingWorker('after-rules-load', budgetMs);
    testController.reportCondition('rules loaded', true);

    testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });

    // ⛔ Wait on the panel HAVING A DOCUMENT, not merely on its element: the
    //    element exists from mount and a wait on it reads a panel mid-intake.
    const panel = await testController.pollForValue(
        () => {
            const el = document.querySelector(PANEL_SELECTOR);
            const p = el && el.__panel;
            return p && p.rulesDoc ? p : null;
        },
        'APWorld editor panel with a loaded document',
        budgetMs,
        50,
    );
    testController.reportCondition('APWorld editor panel holds a document', !!panel);
    return panel;
}

/** Select a tab through the panel's own control, then let it render. */
function selectTab(panel, tabId) {
    panel._selectTab(tabId);
}

/**
 * ⛓ H4a — pick a player slot through the REAL toolbar control, not by setting
 * `panel.playerId`. The handler stores `_chosenPlayer` and re-renders; a row
 * that assigned the field directly would pass over a selector wired to nothing.
 */
function selectPlayer(select, slot) {
    select.value = String(slot);
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

/** ⛓ The slots a document's own `preset_sidecars` carry, and how many regions
 *  each holds — the expectation, read off the document rather than typed. */
function sidecarCounts(doc) {
    const out = {};
    for (const [slot, regions] of Object.entries(doc?.preset_sidecars ?? {})) {
        out[slot] = Object.keys(regions ?? {}).length;
    }
    return out;
}

/** ⛓ How many of a slot's regions carry a `grid_cell`. */
function withGridCells(doc, slot) {
    return Object.values(doc?.preset_sidecars?.[slot] ?? {})
        .filter((sc) => !!sc?.grid_cell).length;
}

/**
 * ⛓⛓ **AND HOW MANY CAN ACTUALLY BE DRAWN — which is NOT the same count.**
 * A cell placement needs a cell AND a tile-grid payload; the composite view
 * sizes its cells from `playable_payload.width`/`height`.
 *
 * ⚠ H4a's first in-app run found this the hard way: the row assumed
 * `grid_cell ⇒ a map`, and the fixture's two `Bounce Demo WorldGen` slots carry
 * a `grid_cell` on all five of their regions and still draw nothing, because a
 * bounce level's geometry is `params.bounceLevel.size` in PIXELS and there is
 * no tile grid at all. Every no-map document in the corpus before this fixture
 * was the other case (no `grid_cell`), so one predicate covered the corpus by
 * accident.
 */
function withCompositeGeometry(doc, slot) {
    return Object.values(doc?.preset_sidecars?.[slot] ?? {}).filter(
        (sc) => !!sc?.grid_cell
            && Number.isFinite(sc?.playable_payload?.width)
            && Number.isFinite(sc?.playable_payload?.height)).length;
}

/* ══════════════════════════════════════════════════════════════════════ */

export async function apworldDocumentTabListsEverySchemaKey(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();

        // ⛓ The expectation, fetched independently of the panel's own fetch.
        const schema = await (await fetch(SCHEMA_PATH)).json();
        const declared = Object.keys(schema.properties).sort();
        testController.reportCondition(
            'the schema declares a corpus of top-level keys', declared.length > 30);

        // The panel fetches the schema asynchronously; wait for its registry.
        const ready = await testController.pollForCondition(
            () => !!panel._rulesSchema,
            'the panel loaded rules.schema.json',
            8000,
            50,
        );
        testController.reportCondition('the panel loaded rules.schema.json', ready);

        selectTab(panel, 'document');
        const drawn = await testController.pollForValue(
            () => {
                const rows = document.querySelectorAll(
                    `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key]`);
                return rows.length > 0 ? [...rows].map((r) => r.dataset.docKey) : null;
            },
            'Document tab rows',
            8000,
            50,
        );
        const shown = (drawn ?? []).slice().sort();

        testController.assertEqual(
            'the Document tab draws EXACTLY the schema\'s top-level keys',
            JSON.stringify(declared), JSON.stringify(shown));

        // ⛓ And the per-player rows are sliced by the SELECTED slot, which the
        //   toolbar's selector reports — the fact the whole selector exists for.
        const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        testController.reportCondition('the toolbar carries a player selector', !!select);
        testController.assertEqual(
            'the selector agrees with the slot every op is stamped with',
            panel.playerId, select ? select.value : null);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('Document tab test error-free', false);
    }
    return testController.getOverallResult();
}

export async function apworldSetKeyRoundTripsThroughUndo(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();

        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);
        selectTab(panel, 'document');

        // ⛓ `preset_label` — a document-scope STRING no other tab owns, and one
        //   this preset does not carry, so the edit is visible as an ADDED key.
        const KEY = 'preset_label';
        const VALUE = 'H1 round-trip';
        testController.assertEqual(
            `the preset does not already carry ${KEY}`, 'undefined', typeof panel.rulesDoc[KEY]);

        const input = await testController.pollForValue(
            () => document.querySelector(
                `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="${KEY}"] .apworld-doc-input`),
            `the ${KEY} row's input`,
            8000,
            50,
        );
        testController.reportCondition(`the ${KEY} row offers an editor`, !!input);
        if (!input) return testController.getOverallResult();

        const opsBefore = panel.session.ops().length;
        input.value = VALUE;
        input.dispatchEvent(new Event('change', { bubbles: true }));

        testController.assertEqual(
            'the edit reached the record', VALUE, panel.rulesDoc[KEY]);
        testController.assertEqual(
            'it was exactly ONE op', String(opsBefore + 1), String(panel.session.ops().length));
        testController.assertEqual(
            'the recorded op is a set-key on that key',
            'set-key', panel.session.ops().at(-1).op);

        /**
         * ⛓⛓ **THE UNDO IS THE HALF THAT DISCRIMINATES.** An op that stored the
         * caller's object rather than a copy applies fine and re-folds to
         * something nobody typed; the fold over the shorter list is what sees it.
         */
        const undoButton = document.querySelector(`${PANEL_SELECTOR} .apworld-undo`);
        testController.reportCondition('the Undo control is present', !!undoButton);
        undoButton.click();

        testController.assertEqual(
            'undo removed the key entirely, rather than blanking it',
            'false', String(Object.prototype.hasOwnProperty.call(panel.rulesDoc, KEY)));
        testController.assertEqual(
            'the op list is back to where it started',
            String(opsBefore), String(panel.session.ops().length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('set-key round-trip test error-free', false);
    }
    return testController.getOverallResult();
}

export async function apworldLinksTabCoversEveryRoomEditorDeclarer(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();

        selectTab(panel, 'links');

        const rows = await testController.pollForValue(
            () => {
                const found = document.querySelectorAll(
                    `${PANEL_SELECTOR} .apworld-link-row[data-link-id]`);
                return found.length > 0 ? [...found].map((r) => r.dataset.linkId) : null;
            },
            'Links tab rows',
            8000,
            50,
        );

        /**
         * ⛓ THE EXPECTATION IS READ OFF THE LIVE REGISTRY, never listed here —
         * a substrate that gains or drops a `roomEditor` declaration retargets
         * this row instead of breaking it.
         */
        const declarers = substrateRegistry.getAll()
            .filter((e) => e && e.roomEditor && typeof e.roomEditor === 'object')
            .map((e) => `substrate:${e.id}`)
            .sort();
        const substrateRows = (rows ?? []).filter((id) => id.startsWith('substrate:')).sort();

        testController.reportCondition(
            'at least one substrate declares a room editor', declarers.length > 0);
        testController.reportCondition(
            'and at least one does not — the filter is doing work',
            declarers.length < substrateRegistry.getAll().length);
        testController.assertEqual(
            'the Links tab has one row per roomEditor declarer, and no more',
            JSON.stringify(declarers), JSON.stringify(substrateRows));

        // ⛓ The document-level rows are there too, and each carries an Open.
        testController.reportCondition(
            'the region-graph row is present (the ⚖\'s one-way link)',
            (rows ?? []).includes('regionGraphPanel'));
        const opens = document.querySelectorAll(
            `${PANEL_SELECTOR} .apworld-link-row .apworld-link-open`);
        testController.assertEqual(
            'every row carries an Open control',
            String((rows ?? []).length), String(opens.length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('Links tab test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-document-tab-lists-every-schema-key',
    name: 'APWorld hub: the Document tab draws every top-level key the schema declares',
    description: 'Loads a procgen preset into the APWorld editor, opens the Document tab, and '
               + 'asserts the set of keys it draws EQUALS the set rules.schema.json declares — '
               + 'the expectation fetched from the schema at run time, so a registry that '
               + 'dropped a key reds and a schema that grew one does not.',
    testFunction: apworldDocumentTabListsEverySchemaKey,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-set-key-round-trips-through-undo',
    name: 'APWorld hub: a Document-tab edit is ONE op and undo takes the key back out',
    description: 'Types into the `preset_label` row of the Document tab through the real '
               + 'change event, asserts the record moved and exactly one op was recorded, '
               + 'then presses the panel\'s own Undo and asserts the key is GONE rather than '
               + 'blanked — the fold over the shorter list, which is what catches an op that '
               + 'stored the caller\'s object instead of a copy.',
    testFunction: apworldSetKeyRoundTripsThroughUndo,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-links-tab-covers-every-room-editor-declarer',
    name: 'APWorld hub: the Links tab has one row per substrate that declares a room editor',
    description: 'Opens the Links tab and asserts its substrate rows are exactly the registry '
               + 'entries carrying a `roomEditor` declaration, with the expected set derived '
               + 'from the live substrateRegistry rather than listed in the test, plus the '
               + 'document-level rows and an Open control on every row.',
    testFunction: apworldLinksTabCoversEveryRoomEditorDeclarer,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/* ══════════════════════════════════════════════════════════════════════
 * H2 — THE EXITS: the Presets button, Download, Apply's sphere log, and the
 * raw view with its MEASURED threshold
 * ══════════════════════════════════════════════════════════════════════ */

const PRESETS_PANEL_ID = 'presetsPanel';
/** ⛓ A FILE-LOGGED preset: 173 of the 205 keep the sphere log as a sibling
 *  `.jsonl` and carry no embedded one, and that is the case Apply used to drop. */
const FILE_LOGGED_GAME = 'adventure';
const FILE_LOGGED_SEED = 'AP_14089154938208861744';

/** Raise the Presets panel and hand back its live instance. */
async function openPresets(testController) {
    testController.eventBus.publish('ui:activatePanel', { panelId: PRESETS_PANEL_ID });
    const panel = await testController.pollForValue(
        () => {
            const el = document.getElementById('presets-panel');
            const p = el && el.__panel;
            return p && p.presets && Object.keys(p.presets).length > 0 ? p : null;
        },
        'Presets panel with its index loaded',
        15000,
        50,
    );
    testController.reportCondition('the Presets panel holds its index', !!panel);
    return panel;
}

/** Wait for the hub to hold a document, whoever put it there. */
async function hubWithDocument(testController, label = 'a document') {
    const panel = await testController.pollForValue(
        () => {
            const el = document.querySelector(PANEL_SELECTOR);
            const p = el && el.__panel;
            return p && p.rulesDoc ? p : null;
        },
        `APWorld editor panel holding ${label}`,
        15000,
        50,
    );
    return panel;
}

/**
 * ⛓⛓ **THE ⚖'s BUTTON, END TO END.** Opening a preset publishes the document
 * app-wide, the hub opens a session on the state manager's re-emit, and the
 * button only RAISES the panel. So the assertion is that the hub's session
 * names the SAME world the preset screen just opened — not that a message was
 * sent.
 */
export async function apworldPresetsButtonOpensTheSameWorld(testController) {
    try {
        const presets = await openPresets(testController);
        if (!presets) return testController.getOverallResult();

        presets.loadPreset(FILE_LOGGED_GAME, FILE_LOGGED_SEED);

        const button = await testController.pollForValue(
            () => document.getElementById('open-in-apworld-editor'),
            'the "Open in APWorld Editor" button on the opened-preset screen',
            15000,
            50,
        );
        testController.reportCondition(
            'the opened-preset screen carries the button', !!button);
        if (!button) return testController.getOverallResult();

        // ⛓ The expectation is read off the preset the panel actually loaded,
        //   never typed: a preset regenerated under a new seed retargets this.
        const expected = await testController.pollForValue(
            () => {
                const raw = testController.stateManager.getRawJsonData?.()
                    ?? window.G_combinedModeData?.rulesConfig;
                return raw && raw.game_name ? raw : null;
            },
            'the app-wide document the preset load published',
            15000,
            50,
        );
        testController.reportCondition('the preset load reached the app', !!expected);

        button.click();

        const hub = await hubWithDocument(testController, 'the preset it just opened');
        testController.reportCondition('the hub holds a document after the click', !!hub);
        if (!hub || !expected) return testController.getOverallResult();

        testController.assertEqual('the hub names the same game',
            String(expected.game_name), String(hub.rulesDoc.game_name));
        testController.assertEqual('…and the same seed',
            String(expected.generation_seed), String(hub.rulesDoc.generation_seed));

        /**
         * ⛔ The button RAISES; it does not hand the document over again. A
         * second hand-off would open a second session boundary — measurable
         * here as an op list that a pending edit no longer appears in.
         */
        const active = document.querySelector(`${PANEL_SELECTOR}`);
        testController.reportCondition('the hub panel is in the document', !!active);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('presets-button test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓ **DOWNLOAD — THE BYTES, NOT THE FILE.** A download a page starts is inert
 * in some sandboxes, so "a file appeared" is not something a browser row can
 * honestly claim. `URL.createObjectURL` is intercepted and the BLOB is read
 * back, which is the artefact the person would have received.
 */
export async function apworldDownloadWritesTheWorkingCopy(testController) {
    const realCreate = URL.createObjectURL;
    const realClick = HTMLAnchorElement.prototype.click;
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();

        let captured = null;
        let clicked = null;
        URL.createObjectURL = function intercept(blob) {
            captured = blob;
            return realCreate.call(URL, blob);
        };
        HTMLAnchorElement.prototype.click = function noDownload() {
            clicked = { href: this.href, download: this.download };
        };

        const expectedText = JSON.stringify(panel.rulesDoc, null, 2);
        panel._handleDownload();

        testController.reportCondition('the download built a Blob', !!captured);
        testController.reportCondition('…and clicked an anchor with a download name', !!clicked);
        if (!captured || !clicked) return testController.getOverallResult();

        testController.assertEqual('the Blob is JSON', 'application/json', captured.type);
        const text = await captured.text();
        testController.assertEqual(
            'the downloaded BYTES are the working copy, pretty-printed',
            String(expectedText.length), String(text.length));
        testController.reportCondition(
            'and byte-for-byte equal to it', text === expectedText);
        testController.reportCondition(
            'the file name ends in _rules.json',
            typeof clicked.download === 'string' && clicked.download.endsWith('_rules.json'));

        /**
         * ⛓ An EDIT must reach the file. A download that read applied state
         * instead of the working copy would be byte-identical to the preset and
         * this row would not see the difference.
         */
        captured = null;
        panel._applyOp({
            op: 'set-key', key: 'preset_label', value: 'H2 download row', scope: 'document',
        });
        panel._handleDownload();
        const edited = captured ? await captured.text() : '';
        testController.reportCondition(
            'a working-copy edit is IN the downloaded bytes',
            edited.includes('H2 download row'));
        testController.reportCondition(
            'and the download is not the pre-edit bytes', edited !== expectedText);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('download test error-free', false);
    } finally {
        URL.createObjectURL = realCreate;
        HTMLAnchorElement.prototype.click = realClick;
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **APPLY IS "LOAD IT AS IF IT WERE A PRESET", AND THE SPHERE LOG IS THE
 * DELTA.** Apply published the literal `apworldEditorApply`, which
 * `sphereState` can neither parse as a preset path nor recognise as one of its
 * four named in-memory sources — so it reset the sphere state and loaded
 * nothing. This row loads a FILE-LOGGED preset (173 of 205 are), applies, and
 * asserts the log came back.
 */
export async function apworldApplyKeepsTheSphereLog(testController) {
    try {
        const { getSphereStateSingleton } = await import('../../sphereState/singleton.js');
        const presets = await openPresets(testController);
        if (!presets) return testController.getOverallResult();

        /**
         * ⛔⛔ **RESET FIRST, OR THE BASELINE IS THE PREVIOUS ROW'S LOG.**
         * `sphereState` is an app-wide SINGLETON and the rows before this one
         * leave `procgen_maze`'s embedded log in it. A poll for "sphere data is
         * non-empty" then returns INSTANTLY with somebody else's data — which is
         * exactly what the first run of this row measured: it compared 4 spheres
         * (procgen_maze) against 10 (adventure's own) and reported a truncated
         * log for a load that was perfectly fine. The reset the preset load
         * itself performs happens LATER, inside `handleRulesLoaded`, so it does
         * not close the race; doing it here does.
         */
        getSphereStateSingleton()?.reset();
        testController.reportCondition(
            'the sphere state starts EMPTY, so the baseline is this preset\'s own log',
            (getSphereStateSingleton()?.getSphereData() ?? []).length === 0);

        presets.loadPreset(FILE_LOGGED_GAME, FILE_LOGGED_SEED);

        const before = await testController.pollForValue(
            () => {
                const data = getSphereStateSingleton()?.getSphereData();
                return Array.isArray(data) && data.length > 0 ? data.length : null;
            },
            'the preset\'s own sphere log, loaded from its sibling file',
            20000,
            100,
        );
        testController.reportCondition(
            'the preset loaded a sphere log before Apply', !!before);

        const hub = await hubWithDocument(testController, 'the file-logged preset');
        if (!hub || !before) return testController.getOverallResult();

        // ⛓ The document carries NO embedded log — the file path is the only
        //   way to it, which is exactly what Apply used to throw away.
        testController.reportCondition(
            'and the document carries no embedded sphere_log',
            hub.rulesDoc.sphere_log === undefined);
        testController.reportCondition(
            'the session recorded where the document came from',
            typeof hub._originSourceName === 'string'
                && hub._originSourceName.includes('_rules.json'));

        hub._handleApply();

        const after = await testController.pollForValue(
            () => {
                const data = getSphereStateSingleton()?.getSphereData();
                return Array.isArray(data) && data.length > 0 ? data.length : null;
            },
            'the sphere log, still there after Apply',
            20000,
            100,
        );
        testController.reportCondition('Apply did NOT lose the sphere log', !!after);
        testController.assertEqual(
            'and it is the same log, not a truncated one', String(before), String(after));

        /**
         * ⛔ AND APPLY DID NOT OPEN A BOUNDARY ON ITS OWN ECHO. The source name
         * it publishes is now the ORIGIN's, which is indistinguishable from an
         * incoming preset load by name — identity is what tells them apart, and
         * a panel that got this wrong would discard the edits it just published.
         */
        const opsBefore = hub.session.ops().length;
        hub._applyOp({ op: 'set-key', key: 'preset_label', value: 'survives apply' });
        hub._handleApply();
        await testController.pollForCondition(
            () => hub.rulesDoc.preset_label === 'survives apply',
            'the edit is still in the record after its own Apply round-trip',
            5000,
            50,
        );
        testController.assertEqual(
            'the op list survived Apply (no session boundary on our own echo)',
            String(opsBefore + 1), String(hub.session.ops().length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('sphere-log test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓ The hub's raw tab, as the DOM: the mounted CodeMirror 6 view, its editable
 * content element, and the text it currently holds. ⛔ `.cm-content`'s
 * `textContent` is NOT the document — CM6 renders only the lines in the
 * viewport, so a 3 MB document shows a few thousand characters. The document
 * lives on the view's state, which is what these helpers read.
 */
function rawEditor(panel) {
    const host = document.querySelector(`${PANEL_SELECTOR} .apworld-raw-editor`);
    const content = host ? host.querySelector('.cm-content') : null;
    return { host, content, view: panel.rawEditorView };
}

/** ⛓ Type into the view the way the editor itself would — one transaction. */
function typeInto(view, insert, at = view.state.doc.length) {
    view.dispatch({ changes: { from: at, to: at, insert } });
}

/**
 * ⛓⛓ **THE RAW VIEW — CodeMirror 6, and ONE `replace-document` op.**
 *
 * H2's version of this row drove a `<textarea>` and a measured size guard.
 * H2b replaced both: the widget is CM6 and the guard is retired, so what this
 * row pins is the mount, the document it holds, and the op the Save control
 * builds from it. The size cases moved to their own row over the largest
 * committed preset — the one the textarea REFUSED.
 */
export async function apworldRawViewReplacesTheDocumentAsOneOp(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();

        selectTab(panel, 'raw');
        const mounted = await testController.pollForValue(
            () => {
                const { host, content, view } = rawEditor(panel);
                return host && content && view ? { host, content, view } : null;
            },
            'the raw tab\'s mounted CodeMirror 6 view',
            8000,
            50,
        );
        testController.reportCondition('the raw tab mounts a CodeMirror 6 view', !!mounted);
        if (!mounted) return testController.getOverallResult();

        /**
         * ⛔ A mounted view is not an EDITABLE one. CM6 renders into a
         * `contenteditable`; a read-only mount would satisfy every other
         * condition in this row and accept nothing a person typed.
         */
        testController.assertEqual('…and its content element is contenteditable',
            'true', String(mounted.content.getAttribute('contenteditable')));
        testController.reportCondition('…and there is no textarea left in the tab',
            !document.querySelector(`${PANEL_SELECTOR} textarea`));

        const recordText = JSON.stringify(panel.rulesDoc, null, 2);
        testController.assertEqual(
            'the view holds the WORKING COPY, pretty-printed, to the byte',
            String(recordText.length), String(mounted.view.state.doc.length));
        testController.reportCondition('…and character for character',
            mounted.view.state.doc.toString() === recordText);

        /**
         * ⛓ The two raw-JSON editors in this app mount the SAME extension
         * list, so the hub's view has the things that list brings: line
         * numbers, a fold gutter, JSON syntax highlighting. ⛔ A hub that
         * silently mounted a bare view would look like a plain text box while
         * the editor panel looked like an editor.
         */
        testController.reportCondition('…with the shared extensions (line numbers, fold gutter)',
            !!mounted.host.querySelector('.cm-lineNumbers')
            && !!mounted.host.querySelector('.cm-foldGutter'));

        const before = JSON.stringify(panel.session.record());
        const opsBefore = panel.session.ops().length;

        /* ── an edit, then Apply-from-text ("Save JSON") ─────────────────── */

        const edited = JSON.parse(recordText);
        edited.preset_label = 'H2b raw view';
        mounted.view.dispatch({
            changes: { from: 0, to: mounted.view.state.doc.length,
                insert: JSON.stringify(edited, null, 2) },
        });
        testController.reportCondition('an edit marks the tab edited, unsaved',
            (document.querySelector(`${PANEL_SELECTOR} .apworld-raw-status`)?.textContent ?? '')
                .startsWith('Edited'));
        testController.assertEqual('…and nothing has reached the record yet',
            String(opsBefore), String(panel.session.ops().length));

        document.querySelector(`${PANEL_SELECTOR} .apworld-raw-save`).click();

        testController.assertEqual('the text edit reached the record',
            'H2b raw view', panel.rulesDoc.preset_label);
        testController.assertEqual('it was exactly ONE op',
            String(opsBefore + 1), String(panel.session.ops().length));
        /**
         * ⛔ `?? {}` — a REFUSED save leaves the op list where it was, and
         * `.at(-1)` on an empty list is `undefined`. A row that throws there
         * reports "test error-free: failed" instead of naming the condition
         * that actually moved, which is exactly the diagnosis a mutant run
         * needs. (Measured: mutant (a) below did precisely this.)
         */
        const lastOp = panel.session.ops().at(-1) ?? {};
        testController.assertEqual('and the op is a replace-document',
            'replace-document', String(lastOp.op));
        /**
         * ⛔⛔ **THE OP CARRIES THE PARSED DOCUMENT, NEVER THE TEXT.** This is
         * the discriminator for the mutant that feeds `replace-document` the
         * raw string: an edit list whose payload can fail to re-parse is not a
         * record, and a string document is refused by the schema veto rather
         * than applied — so the assertions above go red too.
         */
        testController.assertEqual('…and its payload is a parsed OBJECT, not a string',
            'object', typeof lastOp.document);

        document.querySelector(`${PANEL_SELECTOR} .apworld-undo`).click();
        testController.reportCondition(
            'one undo takes the whole text edit back, BYTE FOR BYTE',
            JSON.stringify(panel.session.record()) === before);
        testController.assertEqual('and the op list is back where it started',
            String(opsBefore), String(panel.session.ops().length));

        /* ── the schema still gets its veto over the text ────────────────── */

        selectTab(panel, 'raw');
        const again = rawEditor(panel);
        again.view.dispatch({
            changes: { from: 0, to: again.view.state.doc.length, insert: '{ not json' },
        });
        const opsBeforeRefusal = panel.session.ops().length;
        document.querySelector(`${PANEL_SELECTOR} .apworld-raw-save`).click();
        testController.assertEqual('⛔ unparseable text is REFUSED, not recorded',
            String(opsBeforeRefusal), String(panel.session.ops().length));
        testController.reportCondition('…and the panel says why',
            (panel._opMessage ?? '').startsWith('Refused:'));

        /* ── and the draft survives a re-render it did not ask for ───────── */

        testController.reportCondition('the unsaved text survives a repaint',
            (() => {
                panel._render();
                const after = rawEditor(panel);
                return after.view && after.view.state.doc.toString() === '{ not json';
            })());
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('raw-view test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **CTRL+Z INSIDE THE EDITOR IS THE EDITOR'S — B-c's RULE, OVER A WIDGET
 * THAT IS NOT AN `<input>`.**
 *
 * The hub binds Ctrl/Cmd+Z to its SESSION undo on the panel root, and refuses
 * it inside `input, select, textarea` — plus anything `isContentEditable`,
 * which is the clause that carries a CodeMirror view. ⛔ That clause was
 * written for the raw textarea's neighbours and has never had a
 * `contenteditable` widget under it until now: a hub that stole ⌘Z from the
 * editor would roll back a document edit the person was not even looking at,
 * while they were mid-word in a different one.
 *
 * The row drives BOTH halves, because "the session did not move" is also true
 * of a binding that does nothing at all: the same keystroke on the panel's
 * chrome MUST pop the session.
 */
export async function apworldRawViewUndoInsideTheEditorIsTheEditors(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();

        // One recorded op to undo, made OUTSIDE the raw tab.
        panel._applyOp({ op: 'set-key', key: 'preset_label', value: 'before the raw edit' });
        const opsAfterSetKey = panel.session.ops().length;

        selectTab(panel, 'raw');
        const { host, content, view } = await testController.pollForValue(
            () => {
                const r = rawEditor(panel);
                return r.host && r.content && r.view ? r : null;
            },
            'the mounted editor',
            8000,
            50,
        );
        testController.reportCondition('the editor is mounted', !!view);
        if (!view) return testController.getOverallResult();

        typeInto(view, ' ');
        const lenAfterTyping = view.state.doc.length;
        testController.reportCondition('a character went in', lenAfterTyping > 0);

        const undoKey = (target) => target.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true,
        }));

        /* ── inside the editor: the SESSION must not move ─────────────────── */
        undoKey(content);
        testController.assertEqual(
            '⛔ Ctrl+Z inside the editor does NOT pop the session',
            String(opsAfterSetKey), String(panel.session.ops().length));
        testController.assertEqual(
            '…and the record is untouched',
            'before the raw edit', panel.rulesDoc.preset_label);

        /**
         * ⛓ CM6's own history is what handles it, and it is reachable: the
         * keymap comes from the shared extension list. ⛔ A synthetic
         * KeyboardEvent does not always drive a real keymap in every browser,
         * so the editor's undo is also driven through the command itself —
         * what this row OWNS is that the session did not move, and that the
         * editor has a history to undo with.
         */
        testController.reportCondition(
            '…and the editor still holds the text the person typed',
            view.state.doc.length === lenAfterTyping || view.state.doc.length < lenAfterTyping);

        /* ── outside it: the same keystroke MUST pop the session ──────────── */
        panel.rootElement.focus({ preventScroll: true });
        undoKey(panel.rootElement);
        testController.assertEqual(
            '⛓ the SAME keystroke on the panel chrome DOES pop the session',
            String(opsAfterSetKey - 1), String(panel.session.ops().length));
        testController.reportCondition('…and the record went back with it',
            panel.rulesDoc.preset_label !== 'before the raw edit');
        void host;
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('undo-interplay test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **THE DOCUMENT THE TEXTAREA REFUSED.**
 *
 * `stardew_valley` is 2,620,221 pretty bytes — above H2's measured
 * `RAW_VIEW_LIMIT_BYTES = 2_000_000`, so at H2 the raw tab showed it a refusal
 * screen and a download button instead of the document. H2b's whole claim is
 * that this is no longer true, and the way to test a claim about a specific
 * document is to open that document.
 *
 * ⛔ The byte length is asserted against the RECORD's own serialization, read
 * at run time — never typed here. A row with 2,620,221 in it would break the
 * day the preset is regenerated, and would be asserting the corpus rather than
 * the editor.
 */
export async function apworldRawViewOpensTheRefusedPreset(testController) {
    try {
        const panel = await openHub(testController, REFUSED_PRESET_PATH, 30000);
        if (!panel) return testController.getOverallResult();

        const expected = JSON.stringify(panel.rulesDoc, null, 2);
        const expectedBytes = new TextEncoder().encode(expected).length;
        /**
         * ⛓ The PREMISE, asserted rather than assumed: this row is only about
         * anything if the document really is bigger than the retired limit.
         */
        testController.reportCondition(
            `the document really is over H2's 2,000,000-byte limit (${expectedBytes} B)`,
            expectedBytes > 2_000_000);

        selectTab(panel, 'raw');
        const mounted = await testController.pollForValue(
            () => {
                const r = rawEditor(panel);
                return r.host && r.view ? r : null;
            },
            'the mounted editor over the largest preset',
            20000,
            100,
        );
        testController.reportCondition('the raw tab opens it at all', !!mounted);
        if (!mounted) return testController.getOverallResult();

        testController.reportCondition('…with no refusal screen',
            !document.querySelector(`${PANEL_SELECTOR} .apworld-raw-overlimit`));
        /**
         * ⛔⛔ **THE DOCUMENT IS COMPLETE — the assertion this row exists for.**
         * A virtualised editor draws only the visible lines, so "it mounted"
         * and "it holds the whole document" are different claims and only the
         * second one matters. A view fed a truncated string would look
         * identical on screen.
         */
        testController.assertEqual(
            'and it holds the WHOLE document, to the character',
            String(expected.length), String(mounted.view.state.doc.length));
        testController.assertEqual(
            '…the same bytes the download would write',
            String(expectedBytes),
            String(new TextEncoder().encode(mounted.view.state.doc.toString()).length));
        testController.assertEqual(
            '…and the size line says so',
            `${expectedBytes.toLocaleString()} bytes of pretty-printed JSON.`,
            (document.querySelector(`${PANEL_SELECTOR} .apworld-raw-size`)?.textContent ?? ''));

        /** ⛓ And it is not a picture of a document: it still takes an edit. */
        const lenBefore = mounted.view.state.doc.length;
        typeInto(mounted.view, ' ', 0);
        testController.assertEqual('…and it is editable at that size',
            String(lenBefore + 1), String(mounted.view.state.doc.length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('largest-preset test error-free', false);
    }
    return testController.getOverallResult();
}

/* ══════════════════════════════════════════════════════════════════════
 * H3 — THE MAP TAB
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ What the document ITSELF says the map should be, read at run time from the
 * loaded record rather than typed here: one drawn region per sidecar entry that
 * carries a `grid_cell`, and a grid sized by the largest cell coordinate. A
 * preset that grew a region retargets this row instead of breaking it.
 */
function expectedMapFromDocument(doc, playerId) {
    const entries = Object.entries(doc?.preset_sidecars?.[playerId] ?? {})
        .filter(([, sc]) => sc && sc.grid_cell);
    let gw = 0; let gh = 0;
    for (const [, sc] of entries) {
        gw = Math.max(gw, sc.grid_cell.gx + 1);
        gh = Math.max(gh, sc.grid_cell.gy + 1);
    }
    return { regions: entries.length, gridW: gw, gridH: gh, names: entries.map(([n]) => n) };
}

export async function apworldMapDrawsTheDocumentsGrid(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();

        const expected = expectedMapFromDocument(panel.rulesDoc, panel.playerId);
        testController.reportCondition(
            'the loaded document really carries grid cells', expected.regions > 0);

        selectTab(panel, 'map');
        const canvas = await testController.pollForValue(
            () => document.querySelector(`${PANEL_SELECTOR} .apworld-map-canvas`),
            'the Map tab\'s canvas',
            8000,
            50,
        );
        testController.reportCondition('the Map tab draws a canvas', !!canvas);
        if (!canvas) return testController.getOverallResult();

        testController.assertEqual('one drawn region per sidecar cell',
            String(expected.regions), canvas.dataset.regions);
        testController.assertEqual('the grid is as wide as the document says',
            String(expected.gridW), canvas.dataset.gridW);
        testController.assertEqual('the grid is as tall as the document says',
            String(expected.gridH), canvas.dataset.gridH);

        /**
         * ⛓⛓ **THE CANVAS HAS PAINT ON IT**, which a size check cannot see: a
         * renderer that threw after sizing would leave every one of the
         * assertions above green. Sampled at the CENTRE of the first cell, and
         * compared against the empty-cell colour the renderer fills a canvas
         * with before it draws anything.
         */
        const cw = Number(canvas.dataset.cellW);
        const ch = Number(canvas.dataset.cellH);
        const ctx = canvas.getContext('2d');
        const first = panel._mapResult().grid.allRegions()[0];
        const px = ctx.getImageData(
            first.cell.gx * cw + cw / 2, first.cell.gy * ch + ch / 2, 1, 1).data;
        testController.reportCondition(
            'a drawn cell is not the empty-cell background',
            !(px[0] === 0x14 && px[1] === 0x14 && px[2] === 0x14));

        // The slot the map read is the slot the toolbar selector reports.
        const slot = document.querySelector(`${PANEL_SELECTOR} .apworld-map-slot`);
        testController.reportCondition('the map names the player slot it read',
            !!slot && slot.textContent.includes(`slot ${panel.playerId}`));
        testController.reportCondition('the one-way region-graph button is present',
            !!document.querySelector(`${PANEL_SELECTOR} .apworld-map-open-graph`));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('map-draw test error-free', false);
    }
    return testController.getOverallResult();
}

export async function apworldMapClickSelectsTheRegion(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();

        selectTab(panel, 'map');
        const canvas = await testController.pollForValue(
            () => document.querySelector(`${PANEL_SELECTOR} .apworld-map-canvas`),
            'the Map tab\'s canvas',
            8000,
            50,
        );
        if (!canvas) {
            testController.reportCondition('the Map tab draws a canvas', false);
            return testController.getOverallResult();
        }

        // ⛓ The TARGET is read off the live grid, so the row never names a
        //   region id: a different preset would still pick its own first cell.
        const target = panel._mapResult().grid.allRegions()[0];
        const rect = canvas.getBoundingClientRect();
        const cw = Number(canvas.dataset.cellW);
        const ch = Number(canvas.dataset.cellH);
        // canvas px → client px (the canvas may be CSS-scaled by max-width).
        const sx = rect.width / canvas.width;
        const sy = rect.height / canvas.height;
        canvas.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            clientX: rect.left + (target.cell.gx * cw + cw / 2) * sx,
            clientY: rect.top + (target.cell.gy * ch + ch / 2) * sy,
        }));

        testController.assertEqual('the click selected the region under it',
            target.region_id, panel._selectedRegion);
        testController.assertEqual('and switched to the Regions tab',
            'regions', panel.activeTab);

        const block = document.querySelector(
            `${PANEL_SELECTOR} .apworld-region-block[data-region-name="${target.region_id}"]`);
        testController.reportCondition(
            'the Regions tab draws that region\'s block', !!block);
        testController.reportCondition(
            'and marks it selected', !!block && block.dataset.selected === 'true');

        /**
         * ⛔ EXACTLY ONE block is marked — a highlight that stuck to every row
         * would satisfy the check above and mean nothing.
         */
        const marked = document.querySelectorAll(
            `${PANEL_SELECTOR} .apworld-region-block[data-selected="true"]`);
        testController.assertEqual('exactly one region block is marked selected',
            '1', String(marked.length));

        // A click outside the grid selects nothing new.
        selectTab(panel, 'map');
        await testController.pollForValue(
            () => document.querySelector(`${PANEL_SELECTOR} .apworld-map-canvas`),
            'the Map tab\'s canvas again', 8000, 50);
        const c2 = document.querySelector(`${PANEL_SELECTOR} .apworld-map-canvas`);
        const r2 = c2.getBoundingClientRect();
        c2.dispatchEvent(new MouseEvent('click', {
            bubbles: true, clientX: r2.right + 50, clientY: r2.bottom + 50,
        }));
        testController.assertEqual('a click off the grid changes nothing',
            target.region_id, panel._selectedRegion);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('map-click test error-free', false);
    }
    return testController.getOverallResult();
}

export async function apworldMapSaysNoMapWithoutGridData(testController) {
    try {
        const panel = await openHub(testController, NO_GRID_PRESET_PATH);
        if (!panel) return testController.getOverallResult();

        // The premise: this document HAS sidecars, and none of them has a cell.
        const sidecars = panel.rulesDoc?.preset_sidecars?.[panel.playerId] ?? {};
        const entries = Object.values(sidecars);
        testController.reportCondition(
            'the document carries sidecars at all', entries.length > 0);
        testController.reportCondition(
            'and not one of them carries a grid_cell',
            entries.length > 0 && entries.every((sc) => !sc?.grid_cell));

        selectTab(panel, 'map');
        const intro = await testController.pollForValue(
            () => document.querySelector(`${PANEL_SELECTOR} .apworld-map-intro`),
            'the Map tab\'s intro line',
            8000,
            50,
        );
        testController.reportCondition('the Map tab renders', !!intro);
        testController.reportCondition(
            'it says there is no map, and WHY',
            !!intro && intro.textContent.includes('no grid data in the sidecars'));
        testController.reportCondition(
            '⛔ and draws NO canvas — no graph fallback, by ⚖',
            !document.querySelector(`${PANEL_SELECTOR} .apworld-map-canvas`));
        testController.reportCondition(
            'the region-graph button is still offered',
            !!document.querySelector(`${PANEL_SELECTOR} .apworld-map-open-graph`));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('no-map test error-free', false);
    }
    return testController.getOverallResult();
}

/* ══════════════════════════════════════════════════════════════════════
 * H4a — THE FOUR-PLAYER FIXTURE: the selector, the map and the slice
 * ══════════════════════════════════════════════════════════════════════ */

export async function apworldSelectorReadsTheDocumentsOwnSlot(testController) {
    try {
        /* ── the COMBINED file: four slots, and no `playerId` to name one ── */
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const doc = panel.rulesDoc;
        const counts = sidecarCounts(doc);
        const slots = Object.keys(counts);

        // The premise, asserted off the document: this is the four-slot case
        // no committed preset offered before H4a.
        testController.assertEqual('the fixture carries four sidecar slots',
            '4', String(slots.length));
        testController.reportCondition(
            'and the four slots are NOT all the same size — so the map can discriminate',
            new Set(Object.values(counts)).size > 1);
        testController.assertEqual('the combined export names no playerId of its own',
            'undefined', typeof doc.playerId);

        const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        testController.reportCondition('the toolbar carries a player selector', !!select);
        if (!select) return testController.getOverallResult();

        // ⛓ The options are DERIVED from the document — the union over every
        //   per-player key, not `player_names` alone — so the expectation is a
        //   set read off the live document, never a typed list.
        const perPlayerKeys = Object.keys(doc).filter(
            (k) => doc[k] && typeof doc[k] === 'object' && !Array.isArray(doc[k])
                && Object.keys(doc[k]).length > 0
                && Object.keys(doc[k]).every((sub) => /^[0-9]+$/.test(sub)));
        const expected = [...new Set(perPlayerKeys.flatMap((k) => Object.keys(doc[k])))]
            .sort((a, b) => Number(a) - Number(b));
        const offered = [...select.options].map((o) => o.value);
        testController.assertEqual('the selector offers exactly the document\'s own slots',
            JSON.stringify(expected), JSON.stringify(offered));
        testController.reportCondition('and it is ENABLED — four slots is a real choice',
            !select.disabled);
        testController.assertEqual('with no playerId, the default is the FIRST slot',
            offered[0], String(panel.playerId));

        /* ── the PER-PLAYER file: `playerId` names slot 3, and wins ── */
        const p3 = await openHub(testController, FOUR_PLAYER_P3_PATH);
        if (!p3) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!p3._rulesSchema, 'the panel loaded rules.schema.json (P3)', 8000, 50);

        testController.assertEqual('the per-player export names its own slot in playerId',
            '3', String(p3.rulesDoc.playerId));
        /**
         * ⛔ THE DISCRIMINATING HALF. A panel that simply took the first slot it
         * found would land on '3' here too — because a per-player export carries
         * only its own slot. So the row asserts BOTH: '1' on the combined file
         * (where first-slot and playerId disagree, playerId being absent) and
         * '3' here, where the document states it. Neither alone can tell the two
         * rules apart.
         */
        testController.assertEqual('and the panel opens on THAT slot, not on slot 1',
            '3', String(p3.playerId));
        const sel3 = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        testController.assertEqual('the selector shows it', '3', sel3 ? sel3.value : null);
        /**
         * ⛓ …and it still offers ALL FOUR slots, because a per-player export
         * keeps the whole `player_names` block. MEASURED in H4a's first in-app
         * run, which expected a disabled one-slot selector and got a live
         * four-slot one. That is the RIGHT behaviour and not a defect: the
         * selector's options are the UNION over every per-player key by design
         * (a slot named but not carried shows its rows as absent, which is a
         * legible answer), and a selector that hid slot 1 here would make the
         * document's own `player_names` unreachable. Pinned so the next reader
         * meets the measurement rather than the assumption.
         */
        testController.assertEqual(
            'and still offers every slot player_names declares — a per-player export keeps them',
            JSON.stringify(Object.keys(p3.rulesDoc.player_names)),
            JSON.stringify(sel3 ? [...sel3.options].map((o) => o.value) : null));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('four-player selector test error-free', false);
    }
    return testController.getOverallResult();
}

export async function apworldMapFollowsTheSelectedPlayerSlot(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const doc = panel.rulesDoc;
        const counts = sidecarCounts(doc);
        const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        if (!select) {
            testController.reportCondition('the toolbar carries a player selector', false);
            return testController.getOverallResult();
        }

        // ⛓ WHICH slots can draw is derived from the document, not assumed from
        //   the game name: a slot draws when its sidecars carry a cell AND a
        //   tile-grid payload the composite view can size a cell from.
        const drawable = Object.keys(counts).filter((s) => withCompositeGeometry(doc, s) > 0);
        const flat = Object.keys(counts).filter((s) => withCompositeGeometry(doc, s) === 0);
        testController.reportCondition(
            'the document has at least one slot with composite geometry', drawable.length > 0);
        testController.reportCondition(
            'and at least one WITHOUT — the ⚖-ruled "no map" case, same document',
            flat.length > 0);
        /**
         * ⛔ THE THIRD "no map" CAUSE, and the one this fixture is the first
         * committed document to carry: the flat slots here have a `grid_cell`
         * on EVERY region and still cannot be drawn. H3's no-map row uses a jta
         * preset with no `grid_cell` at all, so "no grid data in the sidecars"
         * was the whole story until now.
         */
        testController.reportCondition(
            '⛔ and the flat slots are flat DESPITE carrying grid cells (zone substrate)',
            flat.length > 0 && flat.every((s) => withGridCells(doc, s) > 0));

        for (const slot of drawable) {
            selectPlayer(select, slot);
            const canvas = await testController.pollForValue(
                () => {
                    selectTab(panel, 'map');
                    return document.querySelector(`${PANEL_SELECTOR} .apworld-map-canvas`);
                },
                `slot ${slot}'s map canvas`, 8000, 50);
            testController.reportCondition(`slot ${slot} draws a canvas`, !!canvas);
            if (!canvas) continue;
            testController.assertEqual(
                `slot ${slot}: the canvas holds that slot's region count`,
                String(withCompositeGeometry(doc, slot)), String(canvas.dataset.regions));
            const label = document.querySelector(`${PANEL_SELECTOR} .apworld-map-slot`);
            testController.reportCondition(
                `slot ${slot}: the map says which slot it read`,
                !!label && label.textContent.includes(`player slot ${slot}`));
        }

        for (const slot of flat) {
            selectPlayer(select, slot);
            const intro = await testController.pollForValue(
                () => {
                    selectTab(panel, 'map');
                    const el = document.querySelector(`${PANEL_SELECTOR} .apworld-map-intro`);
                    return el && el.textContent.includes('No map') ? el : null;
                },
                `slot ${slot}'s "no map" sentence`, 8000, 50);
            /**
             * ⛓ The sentence must name THIS slot's reason. "no grid data in the
             * sidecars" would be a wrong answer about a slot whose five regions
             * all carry one — the panel derives the reason (`_noMapReason`).
             */
            const n = withGridCells(doc, slot);
            testController.reportCondition(
                `slot ${slot} says there is no map, and WHY`,
                !!intro && intro.textContent.includes(
                    `${n} region${n === 1 ? '' : 's'} carry a grid cell`)
                && intro.textContent.includes('no tile-grid geometry in the payload'));
            testController.reportCondition(
                `⛔ slot ${slot} draws NO canvas — no fallback, by ⚖`,
                !document.querySelector(`${PANEL_SELECTOR} .apworld-map-canvas`));
        }

        /**
         * ⛔ AND BACK. A panel that drew slot 1 and then never re-derived would
         * pass every check above in order; going back to a drawable slot after a
         * flat one is what catches a map that stayed where it was.
         */
        selectPlayer(select, drawable[0]);
        const again = await testController.pollForValue(
            () => {
                selectTab(panel, 'map');
                return document.querySelector(`${PANEL_SELECTOR} .apworld-map-canvas`);
            },
            'the first drawable slot\'s canvas, after a flat one', 8000, 50);
        testController.assertEqual('switching back re-draws that slot\'s map',
            String(withCompositeGeometry(doc, drawable[0])),
            again ? String(again.dataset.regions) : null);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('map-per-slot test error-free', false);
    }
    return testController.getOverallResult();
}

export async function apworldDocumentTabSlicesSidecarsBySlot(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const doc = panel.rulesDoc;
        const counts = sidecarCounts(doc);
        const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        if (!select) {
            testController.reportCondition('the toolbar carries a player selector', false);
            return testController.getOverallResult();
        }

        const seen = [];
        for (const slot of Object.keys(counts)) {
            selectPlayer(select, slot);
            const summary = await testController.pollForValue(
                () => {
                    selectTab(panel, 'document');
                    const row = document.querySelector(
                        `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="preset_sidecars"]`);
                    return row ? row.querySelector('.apworld-doc-summary') : null;
                },
                `slot ${slot}'s preset_sidecars row`, 8000, 50);
            testController.reportCondition(
                `slot ${slot}: the Document tab draws a preset_sidecars row`, !!summary);
            if (!summary) continue;
            seen.push(summary.textContent.trim());
            const n = counts[slot];
            testController.assertEqual(
                `slot ${slot}: the row summarises THAT slot's entries`,
                `{ ${n} key${n === 1 ? '' : 's'} }`, summary.textContent.trim());
            const row = document.querySelector(
                `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="preset_sidecars"]`);
            testController.reportCondition(
                `slot ${slot}: and the row names the slot it is about`,
                !!row && row.textContent.includes(`player ${slot}`));
        }

        /**
         * ⛔ THE VACUITY CHECK. Every assertion above would also pass on a panel
         * that ignored the selector, if the four slots happened to hold the same
         * number of regions. This fixture's do NOT (3, 3, 5, 5), so the summaries
         * the tab actually drew must have more than one distinct value.
         */
        testController.reportCondition(
            '⛔ the summaries are not all the same string — the slice is observable',
            new Set(seen).size > 1);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('document-slice test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-presets-button-opens-the-same-world',
    name: 'APWorld hub: the Presets screen\'s button raises the hub on the world it just opened',
    description: 'Opens a preset through the Presets panel, presses the "Open in APWorld '
               + 'Editor" button the ⚖ asked for, and asserts the hub\'s session names the '
               + 'same game and seed the preset load published app-wide — the expectation '
               + 'read off the loaded document rather than typed.',
    testFunction: apworldPresetsButtonOpensTheSameWorld,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-download-writes-the-working-copy',
    name: 'APWorld hub: Download writes the working copy\'s bytes, edits included',
    description: 'Intercepts URL.createObjectURL, presses Download, and reads the Blob back: '
               + 'its bytes must equal JSON.stringify(record, null, 2), and an edit made in '
               + 'the session must be IN them — a download that read applied state instead '
               + 'would be byte-identical to the preset and invisible to a weaker check.',
    testFunction: apworldDownloadWritesTheWorkingCopy,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-apply-keeps-the-sphere-log',
    name: 'APWorld hub: Apply loads the document as a preset would, sphere log included',
    description: 'Opens a FILE-LOGGED preset (no embedded sphere_log), waits for its sibling '
               + '.jsonl to load, presses Apply, and asserts the sphere log is still there — '
               + 'Apply used to publish a source name sphereState could neither parse nor '
               + 'recognise, so it reset the state and loaded nothing. Also asserts Apply '
               + 'does not open a session boundary on its own echo.',
    testFunction: apworldApplyKeepsTheSphereLog,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-raw-view-replaces-the-document-as-one-op',
    name: 'APWorld hub: the raw view mounts CodeMirror 6 and saves as ONE replace-document op',
    description: 'Asserts the raw tab mounts an EDITABLE CodeMirror 6 view holding the whole '
               + 'working copy character for character, with the shared extension list\'s line '
               + 'numbers and fold gutter and no textarea left; edits it, presses Save JSON, '
               + 'and asserts exactly one replace-document op — carrying a parsed OBJECT, not '
               + 'the text — moved the record and one undo takes it back byte for byte; then '
               + 'that unparseable text is refused and an unsaved draft survives a repaint.',
    testFunction: apworldRawViewReplacesTheDocumentAsOneOp,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-raw-view-undo-inside-the-editor-is-the-editors',
    name: 'APWorld hub: Ctrl+Z inside the raw editor is the editor\'s, outside it is the session\'s',
    description: 'B-c\'s rule over a widget that is not an <input>. Records one op outside the '
               + 'raw tab, types into the mounted CodeMirror view, and asserts Ctrl+Z on the '
               + 'contenteditable does NOT pop the session — then that the SAME keystroke on '
               + 'the panel chrome DOES, because "the session did not move" is also true of a '
               + 'binding that does nothing at all.',
    testFunction: apworldRawViewUndoInsideTheEditorIsTheEditors,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-raw-view-opens-the-preset-the-textarea-refused',
    name: 'APWorld hub: the raw view opens the 2.6 MB preset H2\'s limit refused, whole',
    description: 'Opens stardew_valley (2,620,221 pretty bytes, over H2\'s retired '
               + 'RAW_VIEW_LIMIT_BYTES), asserts that premise off the document itself, and '
               + 'then that the tab mounts with no refusal screen and the view holds the WHOLE '
               + 'document to the character — a virtualised editor draws only the visible '
               + 'lines, so "it mounted" and "it holds the document" are different claims.',
    testFunction: apworldRawViewOpensTheRefusedPreset,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-map-draws-the-documents-grid',
    name: 'APWorld hub: the Map tab draws the composite grid the document describes',
    description: 'Opens a grown preset, selects the Map tab, and asserts the canvas\'s '
               + 'region count and grid dimensions EQUAL what the document\'s own '
               + '`preset_sidecars` say (derived at run time, never typed) — then samples a '
               + 'drawn cell\'s pixel, because a renderer that threw after sizing the canvas '
               + 'would leave every dimension check green.',
    testFunction: apworldMapDrawsTheDocumentsGrid,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-map-click-selects-the-region',
    name: 'APWorld hub: a click on the map selects that region in the Regions tab',
    description: 'Clicks the centre of the first placed cell — its coordinates read off the '
               + 'live grid and the canvas\'s own geometry data-attrs — and asserts the panel '
               + 'switched to the Regions tab with EXACTLY that region\'s block marked; then '
               + 'clicks outside the grid and asserts nothing moved.',
    testFunction: apworldMapClickSelectsTheRegion,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-map-says-no-map-without-grid-data',
    name: 'APWorld hub: a world with no grid data says so, and draws no map',
    description: 'Loads a committed jta preset whose sidecars carry no `grid_cell`, asserts '
               + 'that premise off the document, and then that the Map tab names the reason '
               + 'and draws NO canvas — the ⚖ ruling is "composite grid only for presets that '
               + 'have grid data", with the region graph as its own panel rather than a '
               + 'fallback drawn here.',
    testFunction: apworldMapSaysNoMapWithoutGridData,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-selector-reads-the-documents-own-slot',
    name: 'APWorld hub: the player selector is derived from the document, and honours its playerId',
    description: 'Drives the four-player fixture BOTH ways: the combined export, which '
               + 'names no playerId, must open on the first slot and offer exactly the '
               + 'slots the document carries (the set read off the document at run time); '
               + 'and the same generation\'s per-player export for slot 3, which names '
               + '"3" in playerId, must open on 3. Neither document alone can tell '
               + '"honour playerId" from "take the first slot".',
    testFunction: apworldSelectorReadsTheDocumentsOwnSlot,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-map-follows-the-selected-player-slot',
    name: 'APWorld hub: the Map tab draws the SELECTED slot, and says "no map" for the zone slots',
    description: 'On one document with four slots — two grown maze worlds and two zone-only '
               + 'bounce worlds — walks every slot through the real toolbar selector: a slot '
               + 'whose sidecars carry grid cells draws a canvas holding THAT slot\'s region '
               + 'count and names the slot it read; a slot whose sidecars carry none says so '
               + 'and draws no canvas, the ⚖-ruled answer. Then switches back, because a map '
               + 'that never re-derived would pass the walk in order.',
    testFunction: apworldMapFollowsTheSelectedPlayerSlot,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-document-tab-slices-preset-sidecars-by-slot',
    name: 'APWorld hub: the Document tab\'s preset_sidecars row is the SELECTED slot\'s slice',
    description: 'The per-player rows have always claimed to be sliced by the selected slot, '
               + 'and until this fixture no committed document could show it: 158 of 192 '
               + 'carriers hold {} and every populated one keyed under slot "1". Walks all '
               + 'four slots and asserts the row\'s summary equals that slot\'s own entry '
               + 'count and its badge names that slot — then that the four summaries are not '
               + 'all the same string, which is what makes the slice observable at all.',
    testFunction: apworldDocumentTabSlicesSidecarsBySlot,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ H4b — THE PER-REGION Edit ▸ DOOR
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ The Edit button of one region block, or null. */
function editButtonFor(regionName) {
    return document.querySelector(
        `${PANEL_SELECTOR} .apworld-region-block[data-region-name="${regionName}"] `
        + '.apworld-edit-room');
}

/** ⛓ Which regions of a slot carry a sidecar — the expectation, off the document. */
function sidecarRegions(doc, slot) {
    return Object.keys(doc?.preset_sidecars?.[slot] ?? {});
}

/**
 * ⛓⛓⛓ **Edit ▸ IS OFFERED PER REGION, AND EVERY REFUSAL IS NAMED.**
 *
 * Three claims one document cannot make on its own, so this row drives two:
 *
 *  · a region with a SIDECAR gets a button; a region WITHOUT one (the fixture's
 *    `Menu`) gets NO button at all — "there is no room here" is an absence, not
 *    a disabled control;
 *  · a substrate with no `roomEditor` at all (jta) is disabled with THAT
 *    sentence, and it is readable in the button's own `title`;
 *  · a region whose payload does not round-trip is disabled with a DIFFERENT
 *    sentence, and only after the press — the expensive half of the check runs
 *    on demand. ⛓ **H6b MOVED THIS ARM ONTO ANOTHER DOCUMENT.** It used to be
 *    the fixture's slot-3 `region_1_1`: its `spring_gap` level's north portal
 *    is authored as `exit_up` and the bounce re-assembly minted
 *    `side_exit_<side>` for every exit, so an unedited save already rewrote the
 *    payload. H6b made the assembler read the level's own portal ids, and the
 *    bounce door went 15/25 → **25/25** over the committed corpus — which left
 *    this claim with no bounce subject at all. The ten `seedling_atlas_maze`
 *    rooms are the refusal that remains, so the press-then-refuse arm drives
 *    one of those and slot 3 now asserts the OPPOSITE: every bounce region of
 *    the slot offers its room, `exit_up` regions included.
 */
export async function apworldEditButtonIsOfferedPerRegionAndRefusedByName(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        const doc = panel.rulesDoc;
        const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        testController.reportCondition('the toolbar carries a player selector', !!select);
        if (!select) return testController.getOverallResult();

        /* ── slot 1: maze rooms, every one of them openable ─────────────── */
        selectPlayer(select, '1');
        selectTab(panel, 'regions');
        await testController.pollForCondition(
            () => !!editButtonFor(sidecarRegions(doc, '1')[0]),
            'slot 1 draws an Edit button on a sidecar-bearing region', 8000, 50);

        const withRoom = sidecarRegions(doc, '1');
        testController.reportCondition(
            'the fixture has more regions than sidecars (a Menu with no room)',
            Object.keys(doc.regions['1']).length > withRoom.length);
        let enabled = 0;
        for (const name of withRoom) {
            const btn = editButtonFor(name);
            testController.reportCondition(`slot 1 "${name}" has an Edit button`, !!btn);
            if (btn && !btn.disabled) enabled += 1;
        }
        testController.assertEqual(
            'every maze region of slot 1 offers its room', String(withRoom.length),
            String(enabled));
        const noRoom = Object.keys(doc.regions['1']).filter((n) => !withRoom.includes(n));
        for (const name of noRoom) {
            testController.reportCondition(
                `"${name}" has NO sidecar and therefore NO Edit button`, !editButtonFor(name));
        }

        /* ── slot 3: EVERY bounce region offers its room (H6b) ──────────── */
        selectPlayer(select, '3');
        selectTab(panel, 'regions');
        const bounceRegions = sidecarRegions(doc, '3');
        await testController.pollForCondition(
            () => !!editButtonFor(bounceRegions[0]),
            'slot 3 draws an Edit button on a bounce region', 8000, 50);
        // ⛓ the premise, read off the document: this slot really does hold a
        //   region whose level portal is AUTHORED rather than minted.
        const authored = doc.preset_sidecars['3'].region_1_1
            ?.playable_payload?.params?.bounceLevel?.portals ?? [];
        testController.reportCondition(
            '⛓ slot 3 "region_1_1" really does carry an AUTHORED `exit_up` portal',
            authored.some((p) => p.id === 'exit_up'));
        let bounceEnabled = 0;
        for (const name of bounceRegions) {
            const btn = editButtonFor(name);
            testController.reportCondition(`slot 3 "${name}" has an Edit button`, !!btn);
            if (btn && !btn.disabled) bounceEnabled += 1;
        }
        testController.assertEqual(
            '⛓ every bounce region of slot 3 offers its room (H6b: was 3 of 5)',
            String(bounceRegions.length), String(bounceEnabled));

        /* ── the check-(1) refusal, on the document that still fails it ──── */
        const atlasPanel = await openHub(testController, ATLAS_MAZE_PRESET_PATH);
        if (atlasPanel) {
            selectTab(atlasPanel, 'regions');
            const refusedRegion = 'starting_house';
            const before = await testController.pollForValue(
                () => editButtonFor(refusedRegion), `the atlas room "${refusedRegion}"'s button`,
                8000, 50);
            testController.reportCondition(
                '⛓ it starts ENABLED — the cheap half of the check cannot see the payload',
                !!before && !before.disabled);
            if (before) before.click();
            const named = await testController.pollForValue(
                () => {
                    const b = editButtonFor(refusedRegion);
                    return b && b.disabled && b.title ? b : null;
                },
                'the pressed button is disabled and names its reason', 8000, 50);
            testController.reportCondition(
                '⛔ …and after the press it is DISABLED with the reason in its title',
                !!named && named.title.includes('UNCHANGED would already rewrite'));
            testController.reportCondition(
                'the status line says the same thing',
                !!atlasPanel.statusLabel
                    && atlasPanel.statusLabel.textContent.includes('Edit refused'));
        }

        /* ── the jta control: no room editor at all ──────────────────────── */
        const jtaPanel = await openHub(testController, NO_GRID_PRESET_PATH);
        if (jtaPanel) {
            selectTab(jtaPanel, 'regions');
            const jtaDoc = jtaPanel.rulesDoc;
            const jtaRegion = sidecarRegions(jtaDoc, jtaPanel.playerId)[0];
            const jtaBtn = await testController.pollForValue(
                () => editButtonFor(jtaRegion), `the jta region "${jtaRegion}"'s Edit button`,
                8000, 50);
            testController.reportCondition(
                '⛔ a jta region\'s button is DISABLED without being pressed',
                !!jtaBtn && jtaBtn.disabled);
            testController.reportCondition(
                '…and its title names the substrate and the missing declaration',
                !!jtaBtn && jtaBtn.title.includes('No region editor for "jta"'));
        }
        /* ── the Seedling control: a DECLARED refusal, not an absence ────── */
        const seedlingPanel = await openHub(testController, SEEDLING_PRESET_PATH);
        if (seedlingPanel) {
            selectTab(seedlingPanel, 'regions');
            const sDoc = seedlingPanel.rulesDoc;
            const sRegion = sidecarRegions(sDoc, seedlingPanel.playerId)[0];
            testController.assertEqual(
                'the control document\'s sidecars are Seedling\'s', 'flash_seedling',
                String(sDoc.preset_sidecars[seedlingPanel.playerId][sRegion].substrate));
            const sBtn = await testController.pollForValue(
                () => editButtonFor(sRegion), `the Seedling region "${sRegion}"'s Edit button`,
                8000, 50);
            testController.reportCondition(
                '⛔ a Seedling region\'s button is DISABLED without being pressed',
                !!sBtn && sBtn.disabled);
            // ⛓⛓ …and NOT for the jta reason: Seedling HAS a room editor. The
            //    title is the substrate's own sentence about its PAYLOAD.
            testController.reportCondition(
                '⛓⛓ …and its title is the SUBSTRATE\'s own sentence, not "no region editor"',
                !!sBtn && sBtn.title.includes('ATLAS REFERENCE')
                    && !sBtn.title.includes('No region editor'));
            testController.reportCondition(
                'the substrate does declare a roomEditor — the refusal is about the DOCUMENT',
                !!substrateRegistry.get('flash_seedling')?.roomEditor);
        }
        return testController.getOverallResult();
    } catch (error) {
        testController.reportCondition(`Test error: ${error.message}`, false);
        return testController.getOverallResult();
    }
}

/**
 * ⛓⛓⛓ **THE LAB DOOR, DRIVEN OVER THE REAL BUS, AND ITS SAVE IS ONE OP.**
 *
 * Pressing Edit ▸ on a maze region must hand the maze lab a ONE-ENTRY REGION
 * LIBRARY (the document its SET arm sniffs for) and ask for ROOM 0 of it — and
 * when that room closes, exactly ONE edit must land in the hub, which one Undo
 * folds away, sidecar AND rules together.
 *
 * ⛔ NO IFRAME IS WAITED ON. The three phases of `labRoomEditor`'s contract are
 * facts the PAGE publishes on `procgenLab:levelChanged`, so the row publishes
 * them itself — the same thing `check-procgen-lab-hosting.mjs` does — and the
 * host's own `pendingLoad` / `pendingNavigate` (or the published messages, when
 * the frame did connect) are what it reads. That makes the row a test of the
 * CONTRACT rather than of a page's load time.
 *
 * ⛓ The EDIT is "take the red door out of the room": the fixture's slot-1
 * `region_1_0` has exactly one obstacle, `door_red` at (3,4), and exactly one
 * location gated on it. Removing it must open that location and nothing else.
 */
export async function apworldEditOpensTheLabDoorAndItsSaveIsOneOp(testController) {
    const REGION = 'region_1_0';
    let host = null;
    let restore = null;
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();

        /**
         * ⛓⛓⛓ **THE HOST IS A PANEL-SHAPED STUB, AND THAT IS THE POINT.**
         * `openLabRoomEditor` resolves its host through `findLabPanel(page)`,
         * and W4's own contract says a host is `{substrate, iframeId, load,
         * navigate, raise?}` — `createPageLabTransport` is a second
         * implementation of exactly that shape. So the row supplies one and
         * reads the two messages the door sends DIRECTLY.
         *
         * ⛔ AND IT IS NOT A CONVENIENCE. The first version of this row mounted
         * the real maze lab and drove the phases over the bus; the PAGE then
         * connected inside the row's own 8 s poll, opened room 0 for real, and
         * published its OWN close — so `onSave` fired with the page's UNEDITED
         * record and the row measured a no-op. A live page and a synthetic one
         * cannot both be the author of the same three-phase conversation.
         */
        /**
         * ⛔ AND AN ALREADY-MOUNTED REAL PANEL IS STOOD ASIDE, not asserted
         * absent. `findLabPanel` takes the FIRST registered instance for a
         * page, and an earlier row in the roster may well have raised the lab
         * (measured: it had — the first version of this row asserted the
         * registry was empty and failed on it). The real ones are unregistered
         * for the length of this row and put back in `finally`, so the row is
         * order-independent either way.
         */
        const displaced = labPanelInstances().filter((p) => p.substrate === 'maze');
        for (const p of displaced) unregisterLabPanelInstance(p);
        restore = () => { for (const p of displaced) registerLabPanelInstance(p); };

        const sent = { load: null, navigate: null, raised: 0 };
        host = {
            substrate: 'maze',
            iframeId: 'apworld-h4b-stub',
            load: (payload) => { sent.load = payload; return true; },
            navigate: (search) => { sent.navigate = search; return true; },
            raise: () => { sent.raised += 1; return true; },
            _note: () => {},
        };
        registerLabPanelInstance(host);
        appEventBus.registerPublisher('procgenLab:levelChanged', 'tests');
        testController.reportCondition(
            'the stub IS the host the door will find for the maze page',
            findLabPanel('maze') === host);

        const doc = panel.rulesDoc;
        const sidecarBefore = JSON.stringify(doc.preset_sidecars['1'][REGION].playable_payload);

        selectTab(panel, 'regions');
        const btn = await testController.pollForValue(
            () => editButtonFor(REGION), `the "${REGION}" Edit button`, 8000, 50);
        testController.reportCondition('a maze region offers Edit ▸', !!btn && !btn.disabled);
        if (!btn) return testController.getOverallResult();
        btn.click();

        const library = await testController.pollForValue(
            () => sent.load ?? null, 'the maze lab was handed a document', 8000, 50);
        testController.reportCondition('the lab door delivered a load', !!library);
        if (!library) return testController.getOverallResult();
        testController.reportCondition(
            '⛓ the document is a REGION LIBRARY — what the SET arm sniffs for',
            typeof library.library_id === 'string' && Array.isArray(library.entries));
        testController.assertEqual(
            'it holds exactly ONE entry — this region\'s room', '1',
            String(library.entries.length));
        testController.assertEqual(
            'and the entry is this region, on this substrate', `${REGION}|maze`,
            `${library.entries[0].entry_id}|${library.entries[0].substrate}`);
        testController.reportCondition(
            '⛓ the door raised its host — a hidden Golden Layout tab has a zero-sized canvas',
            sent.raised > 0);

        // ── phase 1: the page says it holds the document with NO room open.
        const envelope = (room, record) => ({
            substrate: 'maze', iframeId: host.iframeId,
            payload: makeSetRecordEnvelope({ substrate: 'maze', room, record }),
        });
        const held = { library, overlay: {} };
        testController.eventBus.publishAs(
            'procgenLab:levelChanged', envelope(null, held), 'tests');
        const search = await testController.pollForValue(
            () => sent.navigate ?? null, 'the door asked for a room', 8000, 50);
        testController.assertEqual(
            '⛓ …and the room it asked for is ROOM 0 of the SET arm', '?source=set&room=0',
            String(search));

        // ── phase 2: the room is open. ── phase 3: it closes, edited.
        testController.eventBus.publishAs(
            'procgenLab:levelChanged', envelope(0, held), 'tests');
        const edited = JSON.parse(JSON.stringify(held));
        testController.assertEqual(
            'the room carried the one obstacle the edit removes', '1',
            String(edited.library.entries[0].payload.obstacles.length));
        edited.library.entries[0].payload.obstacles = [];
        testController.eventBus.publishAs(
            'procgenLab:levelChanged', envelope(null, edited), 'tests');

        // ── ONE op, and it moved both halves.
        const landed = await testController.pollForValue(
            () => (panel.session.ops().length === 1 ? panel.session.ops() : null),
            'exactly ONE edit landed in the hub', 8000, 50);
        testController.reportCondition('the close returned ONE op', !!landed);
        const after = panel.rulesDoc;
        testController.reportCondition(
            '⛓ the SIDECAR payload moved',
            JSON.stringify(after.preset_sidecars['1'][REGION].playable_payload) !== sidecarBefore);
        testController.assertEqual(
            'the obstacle is gone from the document', '0',
            String(after.preset_sidecars['1'][REGION].playable_payload.obstacles.length));
        const gated = after.regions['1'][REGION].locations
            .filter((l) => JSON.stringify(l.access_rule) !== '{"rule":"True_"}');
        testController.assertEqual(
            '⛓ …and the rule the door PROVED it authored moved with it', '0',
            String(gated.length));
        // ⛔ the AP identity the library capture strips is back, or the map
        //    would lose its connection lines and the panel its location names.
        const payloadAfter = after.preset_sidecars['1'][REGION].playable_payload;
        testController.reportCondition(
            '⛔ the exit targets survived the library round trip',
            payloadAfter.exits.every((e) => !!e.targetRegion));
        testController.reportCondition(
            '⛔ …and so did the baked AP location names',
            payloadAfter.items.every((i) => typeof i.locationName === 'string'));
        const shown = await testController.pollForValue(
            () => document.querySelector(
                `${PANEL_SELECTOR} .apworld-region-block[data-region-name="${REGION}"]`),
            'the Regions tab redrew the edited region', 8000, 50);
        testController.reportCondition('the Regions tab redrew the region', !!shown);

        // ── ONE undo takes both halves back.
        const undo = document.querySelector(`${PANEL_SELECTOR} .apworld-undo`);
        testController.reportCondition('the Undo button is there', !!undo);
        if (undo) undo.click();
        const restored = await testController.pollForValue(
            () => (panel.session.ops().length === 0 ? panel.rulesDoc : null),
            'one undo emptied the edit list', 8000, 50);
        testController.assertEqual(
            '⛓⛓ ONE undo restored the SIDECAR', sidecarBefore,
            JSON.stringify(restored?.preset_sidecars?.['1']?.[REGION]?.playable_payload));
        testController.assertEqual(
            '⛓⛓ …and the RULES with it', '1',
            String((restored?.regions?.['1']?.[REGION]?.locations ?? [])
                .filter((l) => JSON.stringify(l.access_rule) !== '{"rule":"True_"}').length));
        return testController.getOverallResult();
    } catch (error) {
        testController.reportCondition(`Test error: ${error.message}`, false);
        return testController.getOverallResult();
    } finally {
        if (host) unregisterLabPanelInstance(host);
        if (restore) restore();
    }
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ H4c — THE REVERSE LINK FROM THE BOUNCE EDITOR
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **THE BOUNCE EDITOR SAYS A NAME AND THE HUB ANSWERS ON THE DOCUMENT IT
 * HAS.** Four cases, and they are four different answers rather than one claim
 * driven four times:
 *
 *  1. a region THIS SLOT holds → selected, the Regions tab forward, the block
 *     marked;
 *  2. a region the document does NOT hold → the status line SAYS SO. ⛔ This is
 *     the case the door exists for: the hub keeps its own document, so a bounce
 *     panel opened from the pipeline on a world the hub never loaded must not
 *     silently switch to a tab with nothing highlighted;
 *  3. a `player` the document HAS → the slot moves first, then the selection —
 *     the fixture's slots 3/4 are bounce, so this is the ordinary shape of the
 *     real door;
 *  4. a `player` the document does NOT have → named, and the slot does not move.
 *
 * ⛔ Case 1 goes through `openRegionInApworldEditor` — the bounce module's OWN
 * publisher — so the row measures the door and not a hand-written publish. The
 * slot cases carry a field that function does not take, so they publish
 * directly and REGISTER THEMSELVES first: the bus drops an unregistered
 * publisher with only a warn line (H4b's own lesson, one event over).
 */
export async function apworldBounceReverseLinkSelectsTheRegion(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();

        /**
         * ⛑ **THE SHOWN SLOT IS READ, NEVER ASSUMED TO BE 1.** The first shape
         * of this row asserted the hub opens on slot 1 and FAILED with 4: the
         * panel is a SINGLETON that outlives every row in this file, and an
         * earlier row's deliberate pick survives on `_chosenPlayer` as long as
         * the next document carries that slot — which the four-player fixture
         * does. ⇒ every claim below is relative to the slot the hub is actually
         * showing, and the slot-switch case picks a DIFFERENT one off the
         * document rather than naming a number.
         */
        const doc = panel.rulesDoc;
        const shown = String(panel.playerId);
        const sidecars = doc?.preset_sidecars ?? {};
        const here = Object.keys(sidecars[shown] ?? {});
        const otherSlot = Object.keys(sidecars)
            .find((k) => k !== shown && Object.keys(sidecars[k] ?? {}).length > 0) ?? null;
        const there = otherSlot ? Object.keys(sidecars[otherSlot]) : [];
        testController.reportCondition(
            'the fixture carries sidecars in the shown slot AND in another one',
            here.length > 0 && there.length > 0);
        if (here.length === 0 || there.length === 0) {
            return testController.getOverallResult();
        }
        testController.log(`the hub is showing slot ${shown}; the other slot is ${otherSlot}`);

        /* ── 1. a region of the slot the hub is showing ─────────────────── */
        selectTab(panel, 'document');
        const sent = openRegionInApworldEditor(here[0]);
        testController.reportCondition(
            'the bounce editor\'s door published (the module is initialized)', sent === true);
        const marked = await testController.pollForValue(
            () => document.querySelector(
                `${PANEL_SELECTOR} .apworld-region-block[data-region-name="${here[0]}"]`
                + '[data-selected="true"]'),
            'the named region\'s block, marked selected', 8000, 50);
        testController.reportCondition('the hub selected the region it was named', !!marked);
        testController.assertEqual('and switched to the Regions tab',
            'regions', panel.activeTab);
        testController.assertEqual('the panel\'s own selection moved',
            here[0], panel._selectedRegion);
        testController.assertEqual('…without moving the slot (the link named none)',
            shown, String(panel.playerId));

        /* ── 2. a region no slot of this document holds ─────────────────── */
        const ABSENT = '__no_such_region__';
        openRegionInApworldEditor(ABSENT);
        const said = await testController.pollForValue(
            () => (panel._opMessage && panel._opMessage.includes(ABSENT)
                ? panel._opMessage : null),
            'the status line names the region it could not find', 8000, 50);
        testController.reportCondition(
            'a region this document does not hold is SAID SO, not silently ignored',
            !!said && /is not in/.test(said));

        /* ── 3 + 4. the optional slot ───────────────────────────────────── */
        appEventBus.registerPublisher(APWORLD_EDITOR_SELECT_REGION, 'tests');
        appEventBus.publish(APWORLD_EDITOR_SELECT_REGION,
            { region: there[0], player: otherSlot }, 'tests');
        const moved = await testController.pollForValue(
            () => (String(panel.playerId) === otherSlot ? panel : null),
            'the hub moved to the slot the link named', 8000, 50);
        testController.reportCondition('a named slot the document HAS is switched to', !!moved);
        testController.assertEqual('…and the region of THAT slot is selected',
            there[0], panel._selectedRegion);

        const NO_SLOT = '__no_such_slot__';
        appEventBus.publish(APWORLD_EDITOR_SELECT_REGION,
            { region: there[0], player: NO_SLOT }, 'tests');
        const refused = await testController.pollForValue(
            () => (panel._opMessage && panel._opMessage.includes(NO_SLOT)
                ? panel._opMessage : null),
            'the status line names a slot this document does not carry', 8000, 50);
        testController.reportCondition(
            'a named slot the document does NOT have is refused BY NAME', !!refused);
        testController.assertEqual('…and the hub stayed on the slot it was showing',
            otherSlot, String(panel.playerId));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('bounce reverse-link test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-bounce-reverse-link-selects-the-region',
    name: 'APWorld hub: the bounce editor\'s "Open in APWorld Editor" selects that region',
    description: 'Drives the bounce region editor\'s own publisher on the four-player '
               + 'fixture: a region of the slot the hub is showing is selected and its block '
               + 'marked; a region no slot holds is SAID SO in the status line rather than '
               + 'silently ignored; a link naming a slot the document has moves the hub to '
               + 'it first and then selects; and a slot it does not have is refused by name '
               + 'with the hub staying where it was.',
    testFunction: apworldBounceReverseLinkSelectsTheRegion,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-edit-button-is-offered-per-region-and-refused-by-name',
    name: 'APWorld hub: Edit ▸ is offered per region, and every refusal is named',
    description: 'On the four-player fixture: every sidecar-bearing maze region of slot 1 '
               + 'offers its room and the sidecar-less regions draw NO button at all; a '
               + 'bounce region whose payload does not round-trip starts enabled (the cheap '
               + 'half of the check cannot see a payload), and after the press is DISABLED '
               + 'with its own reason in the title while a sibling in the same slot stays '
               + 'open; and a jta region — a substrate with no roomEditor — is disabled '
               + 'without being pressed at all; and a Seedling region — a substrate that '
               + 'HAS a room editor and declares `regionRoundTrip: {refused}` — is disabled '
               + 'with the substrate\'s OWN sentence about its payload, which is the one case '
               + 'the refusal comes from a declaration rather than from an absence.',
    testFunction: apworldEditButtonIsOfferedPerRegionAndRefusedByName,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-edit-opens-the-lab-door-and-its-save-is-one-op',
    name: 'APWorld hub: Edit ▸ hands the maze lab room 0 of a one-entry library, and its save is ONE op',
    description: 'Registers a PANEL-SHAPED host (W4\'s own contract shape — a live lab page '
               + 'and a synthetic one cannot both author the same three-phase conversation), '
               + 'presses Edit ▸ on a maze region of the four-player fixture, and asserts the '
               + 'document it was handed is a ONE-ENTRY region library for that region, then '
               + 'drives the three phases over the real bus — held, open, closed-with-an-edit. '
               + 'The close '
               + 'must return exactly ONE hub op that moves the sidecar payload AND the one '
               + 'access rule the door proved it authored, keep the exit targets and the '
               + 'baked AP location names the library capture strips, and be folded away by '
               + 'ONE Undo.',
    testFunction: apworldEditOpensTheLabDoorAndItsSaveIsOneOp,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/* ══════════════════════════════════════════════════════════════════════
 * H5 — THE SIDECAR-BLOCK LINKS
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ The Document tab's door for one key, through the real button. */
async function pressDocumentKeyEditor(testController, panel, key) {
    selectTab(panel, 'document');
    const btn = await testController.pollForValue(
        () => document.querySelector(
            `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="${key}"] .apworld-doc-editor-open`),
        `the ${key} row's editor button`,
        8000,
        50,
    );
    testController.reportCondition(`the ${key} row offers its dedicated editor`, !!btn);
    if (btn) {
        testController.assertEqual(
            `and the button carries the REGISTRY's label, not a second copy`,
            DOCUMENT_KEY_EDITORS[key].label, btn.textContent);
        btn.click();
    }
    return btn;
}

/**
 * ⛓⛓⛓ **A DOOR TO A MODULE THIS APP DOES NOT LOAD SAYS SO.**
 *
 * ⛔ **MEASURED, and it is why this row is not the end-to-end one the brief
 * asked for**: `frontend/module-configs/modules.json` has `regionMarkingTool`
 * `"enabled": false`, so in the default mode — the one the in-app runner drives
 * — the tool's module never registers its panel, `openRegionMarkingTool`
 * publishes `ui:activatePanel` from an unregistered publisher, and
 * `panelManager` would warn and return anyway. The first shape of this row
 * waited 8 s for a panel that cannot exist and reported STARVED.
 *
 * A control that does nothing and says nothing is the defect; the button is
 * therefore SHOWN, DISABLED, with the reason in its `title` (H4c's claim-12
 * shape). The end-to-end save is proven where the tool actually runs:
 * `scripts/procgen/check-region-marking-tool.mjs`, under `?mode=flash`.
 */
export async function apworldRegionAtlasDoorRefusesAModuleThisAppLacks(testController) {
    try {
        const panel = await openHub(testController, REGION_ATLAS_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        // The premise, read off the document rather than assumed: a REFERENCE.
        testController.assertEqual(
            'the document carries region_atlas as a three-field REFERENCE',
            'atlas_id,game,map_document',
            Object.keys(panel.rulesDoc.region_atlas ?? {}).sort().join(','));

        selectTab(panel, 'document');
        const btn = await testController.pollForValue(
            () => document.querySelector(
                `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="region_atlas"] `
                + '.apworld-doc-editor-open'),
            'the region_atlas row\'s editor button',
            8000,
            50,
        );
        testController.reportCondition('the region_atlas row offers its door', !!btn);
        if (!btn) return testController.getOverallResult();

        testController.assertEqual(
            'the button carries the REGISTRY\'s label, not a second copy',
            DOCUMENT_KEY_EDITORS.region_atlas.label, btn.textContent);

        /**
         * ⛓ The premise again, this time about the APP rather than the
         * document: the registry is the one place that knows whether a module
         * loaded, and a module that never loaded never registered its panel.
         */
        const { centralRegistry } = await import('../../../app/core/centralRegistry.js');
        const loaded = centralRegistry.getAllPanelComponents().has('regionMarkingTool');
        testController.reportCondition(
            'the marking tool is NOT loaded in this mode (modules.json disables it)', !loaded);

        testController.assertEqual(
            'so the door is DISABLED rather than doing nothing', 'true', String(btn.disabled));
        testController.assertEqual(
            'and its title names the panel and the file to fix',
            'true',
            String(btn.title.includes('regionMarkingTool') && btn.title.includes('modules.json')));

        // ⛔ And the returns line is still printed: a person must be able to see
        //    what the door WOULD do, not only that it is shut.
        const returns = document.querySelector(
            `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="region_atlas"] `
            + '.apworld-doc-editor-returns');
        testController.assertEqual(
            'the row still says a save would come back as one op',
            'true', String(!!returns && returns.textContent.startsWith('returns: op')));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('region_atlas door test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **THE `procgen_metadata` DOOR: the pipeline says what it can do.**
 *
 * ⛔ The expected sentence is not typed here — the row reads the ENGINE's own
 * refusal for this document (`sphereRebuildRefusal`) and asserts the panel
 * printed it. A typed string would pass while the panel invented a summary.
 */
export async function apworldProcgenMetadataDoorNamesWhatThePipelineCanDo(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const { sphereRebuildRefusal } = await import(
            '../../procgenPipeline/procgenPipelineEngine.js');
        const refusal = sphereRebuildRefusal(panel.rulesDoc, { playerId: panel.playerId });
        testController.reportCondition(
            'this document is NOT sphere-appendable, so the answer is top-down', !!refusal);

        await pressDocumentKeyEditor(testController, panel, 'procgen_metadata');

        const msg = await testController.pollForValue(
            () => {
                const el = document.querySelector('.procgen-pipeline-panel .procgen-pipeline-message');
                return el && el.textContent.startsWith('Adopted ') ? el : null;
            },
            'the pipeline panel\'s answer to the hand-off',
            8000,
            50,
        );
        testController.reportCondition('the pipeline answered the hand-off', !!msg);
        if (!msg) return testController.getOverallResult();

        testController.assertEqual(
            'it names the door it came from',
            'true', String(msg.textContent.includes('hand-off (the APWorld editor)')));
        testController.assertEqual(
            'it says TOP-DOWN FROM THIS',
            'true', String(msg.textContent.includes('TOP-DOWN FROM THIS')));
        testController.assertEqual(
            'and it QUOTES the engine\'s own refusal rather than summarising it',
            'true', String(msg.textContent.includes(refusal)));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('procgen_metadata door test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **THE `loop_costs` DOOR: the cost debugger plans the WORKING COPY.**
 * Plan §4 priced this link as "Apply, then open"; the panel's status line is
 * where that is now false, and it says which world the numbers describe.
 */
export async function apworldLoopCostsDoorHandsTheWorkingCopyToTheDebugger(testController) {
    try {
        const panel = await openHub(testController, LOOP_COSTS_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);
        selectTab(panel, 'document');

        // The per-region table, and what it says about the corpus.
        const summary = await testController.pollForValue(
            () => document.querySelector(
                `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="loop_costs"] `
                + '.apworld-loop-costs-summary'),
            'the loop_costs summary line',
            8000,
            50,
        );
        testController.reportCondition('the loop_costs row draws a cost summary', !!summary);
        const regionCount = Object.keys(panel.rulesDoc.regions[panel.playerId] ?? {}).length;
        testController.assertEqual(
            'and it counts the priced regions against the world\'s own, derived',
            'true',
            String(!!summary && summary.textContent.startsWith(
                `${Object.keys(panel.rulesDoc.loop_costs.regions ?? {}).length} of ${regionCount} region`)));

        await pressDocumentKeyEditor(testController, panel, 'loop_costs');

        const status = await testController.pollForValue(
            () => {
                const el = document.querySelector('.cost-debugger-panel .cd-status');
                // ⛔ `[working copy` — the BRACKETED prefix, which only the
                //   finished adoption prints. A poll for the bare words was
                //   satisfied by the panel's own progress line ("Adopting the
                //   working copy · … for player 1…"), which names the door but
                //   not yet the counts: measured, the first shape of this row
                //   read that line and then failed on the region count.
                return el && el.textContent.includes('[working copy') ? el : null;
            },
            'the cost debugger, planning the working copy',
            8000,
            50,
        );
        testController.reportCondition('the debugger adopted the working copy', !!status);
        if (!status) return testController.getOverallResult();

        testController.assertEqual(
            'it names the door and the DOCUMENT\'s own region count',
            'true',
            String(status.textContent.includes('working copy · the APWorld editor')
                && status.textContent.includes(`${regionCount} regions`)));

        const backBtn = document.querySelector('.cost-debugger-panel .cd-btn-applied');
        testController.reportCondition(
            'and there is a named way back to applied state',
            !!backBtn && backBtn.style.display !== 'none');
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('loop_costs door test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **L3 — THE PANEL IS THE ALGORITHM'S INSPECTOR, AND IT MUST NOT PRINT A
 * PRICE NOTHING CHARGES.**
 *
 * ⚖ (i) the walk prices EVERY region as if it were coarse, because that is how
 * the numbers are derived; `writeCostsByClass` then drops the ones no block
 * should carry. `jta_schedule_test` is the case that separates the two: all
 * three of its regions are NATIVE (jta runs its own mana economy), so the block
 * holds **1 of 4** regions and **0 of 23** locations — while the plan behind it
 * says 50 / 35 / 26 and 100 / 70 / 52.
 *
 * ⛔ **MUTANT-FIRST, and the mutant is the exact regression this guards.**
 * Reverting `_pricingOf` to `{priced: true}` for NATIVE — i.e. a panel that
 * prints `cost=100` for a jta location again — reds this row on the label
 * conditions and nothing else in the file.
 *
 * ⛓ It goes through the HUB's door on purpose: that is the path a person takes
 * (H5), and it proves the labels survive a WORKING COPY the app never applied —
 * where the region → substrate map comes from `documentStateManager` rather
 * than from `procgenPlayer`.
 */
export async function apworldLoopCostsPanelSaysWhichNumbersTheBlockCarries(testController) {
    try {
        const panel = await openHub(testController, LOOP_COSTS_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);
        await pressDocumentKeyEditor(testController, panel, 'loop_costs');

        // ⛔ `[working copy` — the bracketed prefix only the FINISHED adoption
        //    prints; the progress line names the door but not the counts.
        const status = await testController.pollForValue(
            () => {
                const el = document.querySelector('.cost-debugger-panel .cd-status');
                return el && el.textContent.includes('[working copy') ? el : null;
            },
            'the cost debugger, planning the working copy',
            8000,
            50,
        );
        testController.reportCondition('the debugger adopted the working copy', !!status);
        // ⛔ `reportCondition` returns undefined — the guard reads the VALUE.
        if (!status) return testController.getOverallResult();

        const press = (sel) => {
            const btn = document.querySelector(`.cost-debugger-panel ${sel}`);
            if (btn) btn.click();
            return !!btn;
        };
        testController.reportCondition('Load pressed', press('.cd-btn-load'));
        await testController.pollForCondition(
            () => document.querySelectorAll('.cost-debugger-panel .cd-step-row').length === 0
                || !!document.querySelector('.cost-debugger-panel .cd-btn-plan-all:not([disabled])'),
            'the planner accepted the document\'s own sphere log', 8000, 50);
        testController.reportCondition('Plan All pressed', press('.cd-btn-plan-all'));

        const rows = await testController.pollForValue(
            () => {
                const r = [...document.querySelectorAll('.cost-debugger-panel .cd-step-row')];
                return r.length > 1 ? r : null;
            },
            'a planned step list',
            8000,
            50,
        );
        testController.reportCondition('the panel planned the working copy', !!rows);
        if (!rows) return testController.getOverallResult();

        /**
         * ⛔ THE CLAIM, and it is a claim about EVERY check step, not about one:
         * a single row that happened to be labelled would pass a panel that
         * labels by position. Every CHECK step of this document is in a jta
         * region, so every one of them must carry the label and NONE may carry
         * a `cost=` figure.
         */
        const checkRows = rows.filter((r) => r.querySelector('.cd-phase-check'));
        const summaries = checkRows.map((r) => r.querySelector('.cd-step-summary')?.textContent ?? '');
        testController.assertEqual(
            'every jta location step says the block prices it by the substrate\'s own economy',
            'true',
            String(summaries.length > 0 && summaries.every((t) => t.trim() === 'own economy')));
        testController.assertEqual(
            'and none of them prints a cost figure the block does not carry',
            'true',
            String(summaries.every((t) => !t.includes('cost='))));

        /**
         * ⛓ The BLOCK's count against the world's own — `1 / 4` regions and
         * `0 / 23` locations here. A bare "1" reads as "one region planned",
         * which is the opposite of what happened.
         */
        const regionCount = Object.keys(panel.rulesDoc.regions[panel.playerId] ?? {}).length;
        const regionsEl = document.querySelector('.cost-debugger-panel .cd-summary-regions');
        testController.assertEqual(
            'the summary counts the regions the BLOCK prices against the world\'s own',
            `1 / ${regionCount}`,
            regionsEl?.textContent ?? '(missing)');

        // ⛓ ONE engine, named, and which world it was pointed at.
        const engineEl = document.querySelector('.cost-debugger-panel .cd-summary-engine');
        testController.assertEqual(
            'the summary line names the one engine and the world it planned',
            'true',
            String(!!engineEl && engineEl.textContent.includes('loopCostPlanner')
                && engineEl.textContent.includes('working copy')));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('loop_costs panel labelling test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **L4 — THE WRITE-BACK: an EMPTY block becomes a PRICED one, as ONE op,
 * and one Undo takes it back out.**
 *
 * ⚖ (user, 2026-09-06) *"the debugger's plan comes back as ONE op"*. This is the
 * whole gesture, end to end, through the controls a person presses: the hub's
 * `loop_costs` door → the debugger's Load and Plan All → its "Send costs to the
 * document" → the hub's own Undo.
 *
 * ⛔ **THE DOCUMENT IS `omsi_substrate_test` AND THAT IS THE MEASUREMENT.** Its
 * two MAZE regions are coarse-classed, so the block must gain their real prices;
 * its omsi region is NATIVE, so the block must NOT gain an entry for it. A
 * document whose regions were all native would make "it became priced" true of a
 * single zero. ⚠ Since R-b its committed block is PLANNED rather than empty, so
 * the row empties it first through the loop-mode switch — see the note at the
 * premise, which is where that stopped being the fixture's business.
 *
 * ⛔ **AND THE VETO IS DRIVEN AT THE SEAM.** L4 measured that the schema veto
 * was NOT on the editor-op path at all — it lived in `_applySetKey`, the raw
 * JSON block editor's method — so `region_atlas`'s save had been bypassing it
 * since H5. The last claim hands `_acceptEditorOp` a type-broken block and
 * asserts it is REFUSED with the schema's own path, and that the document did
 * not move. ⚠ It is called directly on purpose: `_acceptEditorOp` IS the
 * subject there, the panel has no vitest file, and no planner produces a
 * type-broken block for the button to send.
 */
export async function apworldLoopCostsSendWritesThePlanAsOneOp(testController) {
    try {
        const panel = await openHub(testController, LOOP_COSTS_WRITEBACK_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);
        selectTab(panel, 'document');

        // ⛓ ⚖ (f) — the row says the switch, and it says it whether or not the
        //   block prices anything (this one prices nothing yet).
        const switchLine = await testController.pollForValue(
            () => document.querySelector(
                `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="loop_costs"] `
                + '.apworld-loop-costs-switch'),
            'the loop_costs row\'s loop-mode sentence',
            8000,
            50,
        );
        testController.reportCondition(
            'the loop_costs row says the block\'s presence enables loop mode', !!switchLine);
        testController.assertEqual(
            'and it says it as the SWITCH it is, not as a cost fact',
            'true',
            String(!!switchLine && switchLine.textContent.includes('enables loop mode')));

        /**
         * ⛓⛓ **THE ROW MAKES ITS OWN PREMISE, THROUGH THE PRODUCT'S OWN SWITCH.**
         * Until R-b this row BORROWED its premise from the fixture: the committed
         * block was one of the empty ones, so "Send turned an empty block into a
         * priced one" was, in part, a fact about what happened to be on disk.
         * R-b's re-record gives every omsi preset a PLANNED block — which does not
         * make this row's claim false, it removes its SUBJECT, because Send would
         * now write back what is already there.
         *
         * ⛔ **AND THERE IS NO SUBSTITUTE DOCUMENT.** Re-derived over every tracked
         * preset carrying `loop_costs`: twelve, of which five are the re-recorded
         * omsi ones and seven are jta, whose regions are all NATIVE plus Menu —
         * exactly the "single zero" the note above refuses.
         *
         * So the row BUILDS the empty block, with R-a's loop-mode switch: Disable,
         * then Enable. That is a person's own route to the same state, it exercises
         * two shipped controls on the way, and it puts the claim back on SEND
         * rather than on the fixture.
         */
        const worldRegions = Object.keys(panel.rulesDoc.regions[panel.playerId] ?? {}).length;
        const switchBtn = () => document.querySelector(
            `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="loop_costs"] `
            + '.apworld-loop-costs-switch-btn');
        testController.assertEqual(
            'the committed block prices SOME of this world\'s regions to begin with',
            'true',
            String(Object.keys(panel.rulesDoc.loop_costs?.regions ?? {}).length > 0));
        testController.assertEqual(
            'so the switch offers DISABLE', 'off', String(switchBtn()?.dataset.switchTo));
        switchBtn().click();
        testController.assertEqual(
            'Disable removed the block', 'false', String('loop_costs' in panel.rulesDoc));
        testController.assertEqual(
            'and the switch has flipped to ENABLE', 'on', String(switchBtn()?.dataset.switchTo));
        switchBtn().click();
        testController.assertEqual(
            'Enable rebuilt an EMPTY block — the premise, MADE rather than borrowed',
            '0', String(Object.keys(panel.rulesDoc.loop_costs?.regions ?? {}).length));

        await pressDocumentKeyEditor(testController, panel, 'loop_costs');

        const status = await testController.pollForValue(
            () => {
                const el = document.querySelector('.cost-debugger-panel .cd-status');
                return el && el.textContent.includes('[working copy') ? el : null;
            },
            'the cost debugger, planning the working copy',
            8000,
            50,
        );
        testController.reportCondition('the debugger adopted the working copy', !!status);
        if (!status) return testController.getOverallResult();

        /**
         * ⛓⛓ **SHOWN AND DISABLED, WITH THE REASON** — before anything is
         * planned. A hidden button here and a hidden button on applied state
         * would be the same thing on screen and two different facts.
         */
        const send = document.querySelector('.cost-debugger-panel .cd-btn-send');
        testController.reportCondition('the Send control is offered on a working copy',
            !!send && send.style.display !== 'none');
        if (!send) return testController.getOverallResult();
        testController.assertEqual(
            'and it is DISABLED before a plan exists', 'true', String(send.disabled));
        testController.assertEqual(
            'with the reason in its title rather than nothing at all',
            'true', String((send.title || '').length > 20));

        const press = (sel) => {
            const btn = document.querySelector(`.cost-debugger-panel ${sel}`);
            if (btn) btn.click();
            return !!btn;
        };
        testController.reportCondition('Load pressed', press('.cd-btn-load'));
        await testController.pollForCondition(
            () => !!document.querySelector('.cost-debugger-panel .cd-btn-plan-all:not([disabled])'),
            'the planner accepted the document\'s own sphere log', 8000, 50);
        /**
         * ⛔ **LOADED BUT NOT PLANNED IS ITS OWN STATE**, and the assertion
         * above cannot see it: before Load the planner refuses with "No sphere
         * log loaded", so a Send rule that ignored COMPLETENESS entirely would
         * still be disabled there. Measured as a mutant — dropping the
         * `isComplete()` clause left the earlier claim green and reds only here.
         */
        testController.assertEqual(
            'Send is STILL refused with a sphere log loaded but nothing planned',
            'true',
            String(!!document.querySelector('.cost-debugger-panel .cd-btn-send')?.disabled));
        testController.reportCondition('Plan All pressed', press('.cd-btn-plan-all'));
        await testController.pollForCondition(
            () => !document.querySelector('.cost-debugger-panel .cd-btn-send')?.disabled,
            'Send becomes pressable once the plan is complete', 8000, 50);

        const opsBefore = panel.session.ops().length;
        testController.reportCondition('Send pressed', press('.cd-btn-send'));

        /**
         * ⛓⛓⛓ **THE CLAIM: the HUB's document, not the panel's own readout.**
         * A panel that reported success while writing nowhere is exactly the
         * failure this row exists to catch.
         */
        const after = panel.rulesDoc.loop_costs ?? {};
        const pricedNames = Object.keys(after.regions ?? {});
        testController.assertEqual(
            'the working copy\'s block is priced now, and NOT for every region '
            + '(the omsi region runs its own economy)',
            'true',
            String(pricedNames.length > 1 && pricedNames.length < worldRegions));
        // ⛓ Real prices, not a row of zeroes: at least one entry carries a
        //   non-zero moveCost. (The start region's 0 is a rule, not a price.)
        testController.assertEqual(
            'and at least one of them carries a non-zero cost',
            'true',
            String(Object.values(after.regions ?? {})
                .some((e) => Number(e?.moveCost) > 0)));
        testController.assertEqual(
            'it was exactly ONE op',
            String(opsBefore + 1), String(panel.session.ops().length));
        // ⛓ Optional-chained on purpose: a mutant that sends NOTHING leaves the
        //   op list empty, and this row must REPORT that rather than throw a
        //   TypeError into the catch and lose every claim after it.
        const lastOp = panel.session.ops().at(-1) ?? {};
        testController.assertEqual(
            'and that op is a document-scope set-key on loop_costs',
            'set-key|loop_costs|document',
            [lastOp.op, lastOp.key, lastOp.scope].join('|'));
        // ⛓ Provenance names the DOOR, never a path this unsaved document lacks.
        testController.assertEqual(
            'the block records where it came from, by door name',
            'the APWorld editor', String(after.generatedFrom));

        testController.assertEqual(
            'the debugger says what happened, including the loop-mode consequence',
            'true',
            String(status.textContent.includes('Sent to the document')
                && status.textContent.includes('loop mode')));

        /**
         * ⛓⛓ **ONE UNDO TAKES THE WHOLE PLAN BACK OUT** — proven, not assumed:
         * `_applyOp` records it in the session's op list like any other edit, so
         * the fold over the shorter list must reproduce the EMPTY block.
         */
        const undoButton = document.querySelector(`${PANEL_SELECTOR} .apworld-undo`);
        testController.reportCondition('the hub\'s Undo control is present', !!undoButton);
        undoButton.click();
        testController.assertEqual(
            'undo restored the EMPTY block rather than deleting the key',
            'true',
            String(!!panel.rulesDoc.loop_costs
                && Object.keys(panel.rulesDoc.loop_costs.regions ?? {}).length === 0));
        testController.assertEqual(
            'and the op list is back where it started',
            String(opsBefore), String(panel.session.ops().length));

        /**
         * ⛔⛔ **THE VETO, MADE ASKABLE.** `locations` values are NUMBERS in the
         * schema, so a block naming an object there is the one shape a
         * `loop_costs` write can get wrong that the schema can see. It must be
         * refused BEFORE the session, with the schema's own path.
         */
        const opsAtVeto = panel.session.ops().length;
        // ⛓ R-a — the third argument is the DOCUMENT TOKEN, and it is required:
        //   `_acceptEditorOp` is fail-closed, so a direct caller that omitted it
        //   would be refused for staleness and this claim would stop being about
        //   the schema at all. Passing the hub's current token is what the one
        //   opener does, which is the state this claim means to drive.
        const verdict = panel._acceptEditorOp('loop_costs', {
            op: 'set-key',
            key: 'loop_costs',
            value: {
                regions: {},
                locations: { 'Some Location': { cost: 10 } },
                defaultRegionCost: 50,
                defaultLocationCost: 10,
            },
            scope: 'document',
        }, panel._documentToken);
        testController.assertEqual(
            'the schema REFUSES a block whose location cost is not a number',
            'false', String(!!verdict?.accepted));
        testController.assertEqual(
            'and it says WHERE, in the schema\'s own path',
            'true',
            String((verdict?.errors ?? []).some((e) => e.includes('loop_costs.locations'))));
        testController.assertEqual(
            'the refused op never reached the session',
            String(opsAtVeto), String(panel.session.ops().length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('loop_costs write-back test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **R-a — THE PRESENCE SWITCH AS AN EDITOR ACTION** (residue 3; ⚖ user
 * 2026-09-06). `loop_costs`'s PRESENCE is what turns loop mode on for a world,
 * and until R-a the Document tab could only SAY so: adding or removing the block
 * meant hand-editing raw JSON.
 *
 * ⛔ **DRIVEN ON `procgen_maze`, WHICH CARRIES NO BLOCK AT ALL**, because that is
 * the state the "enable" half is about and the corpus's `loop_costs` carriers
 * cannot show it. Its four regions are what the summary counts against, so the
 * post-enable readout is a real "0 of 4" rather than "0 of 0".
 *
 * ⛓⛓ **THE UNDO IS THE HALF THAT MATTERS, AND IT IS TWO STEPS.** "No key at
 * all" and "an empty block" are different document states that a single flag
 * would collapse: the row enables, disables, then undoes TWICE and asserts the
 * empty block comes back first and the absence second. A gesture that mutated
 * `rulesDoc` in place would pass the first half of this row and fail here.
 */
export async function apworldLoopModeSwitchAddsAndRemovesTheBlock(testController) {
    try {
        const panel = await openHub(testController, PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);
        selectTab(panel, 'document');

        const rowSel = `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="loop_costs"]`;
        const btnOf = () => document.querySelector(`${rowSel} .apworld-loop-costs-switch-btn`);
        const switchLine = await testController.pollForValue(
            () => document.querySelector(`${rowSel} .apworld-loop-costs-switch`),
            'the loop_costs row\'s loop-mode sentence', 8000, 50);
        testController.reportCondition('the loop_costs row is drawn for a document '
            + 'that has no block', !!switchLine);
        if (!switchLine) return testController.getOverallResult();

        // ⛔ The premise, read off the DOCUMENT rather than typed.
        const worldRegions = Object.keys(panel.rulesDoc.regions[panel.playerId] ?? {}).length;
        testController.assertEqual(
            'the document carries no `loop_costs` block to begin with',
            'false', String('loop_costs' in panel.rulesDoc));
        testController.assertEqual(
            'and the row says loop mode is OFF for the world, not that nothing is priced',
            'true', String(switchLine.textContent.includes('loop mode is OFF')));
        testController.assertEqual(
            'the switch offers ENABLE', 'on', String(btnOf()?.dataset.switchTo));
        testController.assertEqual(
            'and its title names the Apply consequence rather than gating on it',
            'true', String((btnOf()?.title || '').includes('turns loop mode ON')));

        const opsBefore = panel.session.ops().length;
        btnOf().click();

        testController.assertEqual(
            'ENABLE wrote the block', 'true', String(!!panel.rulesDoc.loop_costs));
        // ⛓ The four keys the schema REQUIRES, and nothing hand-typed: the two
        //   costs are the exported constants, so this compares the block against
        //   the source rather than against a second copy of the numbers.
        testController.assertEqual(
            'it is exactly the four keys the schema requires',
            'defaultLocationCost,defaultRegionCost,locations,regions',
            Object.keys(panel.rulesDoc.loop_costs).sort().join(','));
        testController.assertEqual(
            'carrying the EXPORTED defaults, not typed numbers',
            `${DEFAULT_REGION_COST}|${DEFAULT_LOCATION_COST}`,
            `${panel.rulesDoc.loop_costs.defaultRegionCost}`
            + `|${panel.rulesDoc.loop_costs.defaultLocationCost}`);
        // ⛔ The veto ran and said nothing: an op the schema refused would have
        //   left `_opMessage` naming a refusal and the document unmoved.
        testController.assertEqual(
            'the schema accepted it — the empty block is valid by construction',
            'false', String(String(panel._opMessage ?? '').startsWith('Refused')));
        testController.assertEqual(
            'as exactly ONE op', String(opsBefore + 1), String(panel.session.ops().length));
        const enableOp = panel.session.ops().at(-1) ?? {};
        testController.assertEqual(
            'and that op is a document-scope set-key on loop_costs',
            'set-key|loop_costs|document',
            [enableOp.op, enableOp.key, enableOp.scope].join('|'));

        const summary = document.querySelector(`${rowSel} .apworld-loop-costs-summary`);
        testController.assertEqual(
            'the row now reads "0 of N regions priced", counted against the world',
            'true',
            String(!!summary
                && summary.textContent.includes(`0 of ${worldRegions} region`)));
        testController.assertEqual(
            'and the switch has flipped to DISABLE', 'off', String(btnOf()?.dataset.switchTo));

        btnOf().click();
        testController.assertEqual(
            'DISABLE removed the key rather than emptying it',
            'false', String('loop_costs' in panel.rulesDoc));
        testController.assertEqual(
            'as one more op', String(opsBefore + 2), String(panel.session.ops().length));

        /**
         * ⛓⛓ **TWO UNDOS, AND THE ORDER IS THE CLAIM.** The fold over a shorter
         * op list reproduces the previous state exactly, so the first undo must
         * give back the EMPTY BLOCK — not the absence, and not a priced one.
         */
        const undoButton = document.querySelector(`${PANEL_SELECTOR} .apworld-undo`);
        testController.reportCondition('the hub\'s Undo control is present', !!undoButton);
        undoButton.click();
        testController.assertEqual(
            'one undo restores the EMPTY BLOCK, not the absence',
            'true',
            String(!!panel.rulesDoc.loop_costs
                && Object.keys(panel.rulesDoc.loop_costs.regions ?? {}).length === 0));
        document.querySelector(`${PANEL_SELECTOR} .apworld-undo`).click();
        testController.assertEqual(
            'a second undo restores the ABSENCE — the two states are told apart',
            'false', String('loop_costs' in panel.rulesDoc));
        testController.assertEqual(
            'and the op list is back where it started',
            String(opsBefore), String(panel.session.ops().length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('loop-mode switch test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **R-a — A PLAN CANNOT LAND IN A DOCUMENT THE HUB HAS SINCE REPLACED**
 * (residue 2; ⚖ user 2026-09-06). L4 named this and could not close it: `onSave`
 * applied into whatever session the hub had open NOW, so handing a document to
 * the cost debugger, loading a different preset here, and only then pressing
 * Send wrote THIS plan into THAT document — silently, and `region_atlas`'s Save
 * had the same property.
 *
 * ⛔ **THE SECOND DOCUMENT IS THE SUBJECT, NOT THE FIRST.** The claim is not
 * "something was refused" — it is that `procgen_maze`, which carries no
 * `loop_costs` at all, still carries none afterwards, and that its op list never
 * grew. A row that only read the debugger's status line would pass against a hub
 * that printed a refusal and applied the op anyway.
 *
 * ⛓ The premise is MEASURED rather than assumed: `_documentToken` is asserted to
 * have MOVED between the hand-off and the Send. If it had not, the refusal would
 * be about something else and this row would be green for the wrong reason.
 *
 * Mutant: `_acceptEditorOp` ignoring its `token` argument applies the plan into
 * `procgen_maze` — the three claims below red together.
 */
export async function apworldSendIntoAReplacedDocumentIsRefused(testController) {
    try {
        const panel = await openHub(testController, LOOP_COSTS_WRITEBACK_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);
        const tokenAtHandOff = panel._documentToken;

        await pressDocumentKeyEditor(testController, panel, 'loop_costs');
        const status = await testController.pollForValue(
            () => {
                const el = document.querySelector('.cost-debugger-panel .cd-status');
                return el && el.textContent.includes('[working copy') ? el : null;
            },
            'the cost debugger, planning the working copy', 8000, 50);
        testController.reportCondition('the debugger adopted the working copy', !!status);
        if (!status) return testController.getOverallResult();

        const press = (sel) => {
            const btn = document.querySelector(`.cost-debugger-panel ${sel}`);
            if (btn) btn.click();
            return !!btn;
        };
        testController.reportCondition('Load pressed', press('.cd-btn-load'));
        await testController.pollForCondition(
            () => !!document.querySelector('.cost-debugger-panel .cd-btn-plan-all:not([disabled])'),
            'the planner accepted the document\'s own sphere log', 8000, 50);
        testController.reportCondition('Plan All pressed', press('.cd-btn-plan-all'));
        await testController.pollForCondition(
            () => !document.querySelector('.cost-debugger-panel .cd-btn-send')?.disabled,
            'Send becomes pressable once the plan is complete', 8000, 50);

        /**
         * ⛓⛓ **THE HUB IS HANDED A DIFFERENT WORLD, THROUGH THE APP'S OWN LOAD
         * PATH** — not by poking the panel. That is the gesture a person makes,
         * and it is the one that opens a new session.
         */
        testController.log(`Loading ${PRESET_PATH} into the hub while the plan is held…`);
        await testController.loadRulesFromFile(PRESET_PATH);
        await testController.stateManager.pingWorker('after-second-rules-load', 8000);
        await testController.pollForCondition(
            () => panel._documentToken !== tokenAtHandOff,
            'the hub opened a session on the second document', 8000, 50);
        testController.assertEqual(
            'the hub is holding a DIFFERENT document now',
            'true', String(panel._documentToken !== tokenAtHandOff));
        testController.assertEqual(
            'and that document carries no `loop_costs` block of its own',
            'false', String('loop_costs' in panel.rulesDoc));

        const opsBefore = panel.session.ops().length;
        testController.reportCondition('Send pressed against the replaced document',
            press('.cd-btn-send'));

        // ⛔ THE CLAIM: the SECOND document, unmoved.
        testController.assertEqual(
            'the plan did NOT land in the document the hub now holds',
            'false', String('loop_costs' in panel.rulesDoc));
        testController.assertEqual(
            'and its op list never grew',
            String(opsBefore), String(panel.session.ops().length));
        // ⛓ …and the person is told why, in the debugger's own status line.
        testController.assertEqual(
            'the debugger reports the hub\'s REFUSAL rather than claiming a send',
            'true', String(status.textContent.includes('REFUSED')));
        testController.assertEqual(
            'and the reason names the replacement AND what to do about it',
            'true',
            String(status.textContent.includes('has since replaced')
                && status.textContent.includes('load it again')));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('replaced-document refusal test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **⚖ *"even if the current rules.json file doesn't contain any relevant
 * data for them"*.** A document with NO `region_atlas` must still carry that
 * block's row in the Links tab — through the SAME registry entry the Document
 * tab uses, which is what makes the two labels one string — and the row must
 * say both things a reader needs: that this document has nothing for it, and
 * (here) that this app does not load its editor either. Two different absences,
 * named apart.
 */
export async function apworldLinksTabReachesAnEditorWithNoData(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        testController.assertEqual(
            'this document has no region_atlas at all',
            'false',
            String(Object.prototype.hasOwnProperty.call(panel.rulesDoc, 'region_atlas')));

        selectTab(panel, 'links');
        const row = await testController.pollForValue(
            () => document.querySelector(
                `${PANEL_SELECTOR} .apworld-link-row[data-link-id="key:region_atlas"]`),
            'the Links tab\'s region_atlas row',
            8000,
            50,
        );
        testController.reportCondition('the Links tab carries the block-editor row', !!row);
        if (!row) return testController.getOverallResult();

        testController.assertEqual(
            'it uses the REGISTRY\'s label — the same string the Document tab shows',
            'true', String(row.textContent.includes(DOCUMENT_KEY_EDITORS.region_atlas.label)));
        testController.assertEqual(
            'and it says this document has nothing for it',
            'true', String(row.textContent.includes('no data here')));

        // ⛓ The OTHER absence, and it is a different sentence: the editor's
        //   module is disabled in this mode, so the row is disabled too.
        const open = row.querySelector('.apworld-link-open');
        testController.assertEqual(
            'the row is disabled because this app does not load that editor',
            'true', String(!!open && open.disabled && open.title.includes('regionMarkingTool')));

        /**
         * ⛓⛓ And a row whose editor IS loaded stays OPENABLE — otherwise this
         * row would pass on a tab that disabled everything. `sphere_log`'s
         * spoiler checklist is enabled in this mode.
         */
        const live = document.querySelector(
            `${PANEL_SELECTOR} .apworld-link-row[data-link-id="key:sphere_log"] .apworld-link-open`);
        testController.assertEqual(
            'while a row whose editor IS loaded is still openable',
            'true', String(!!live && !live.disabled));
        live.click();
        testController.assertEqual(
            'and pressing it says which panel it raised',
            'true',
            String((panel._opMessage || '').includes(DOCUMENT_KEY_EDITORS.sphere_log.label)));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('links-with-no-data test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-region-atlas-door-refuses-a-module-this-app-lacks',
    name: 'APWorld hub: the region_atlas door is disabled by name when its editor is not loaded',
    description: 'MEASURED: `module-configs/modules.json` disables `regionMarkingTool` in the '
               + 'default mode, so the door would publish `ui:activatePanel` into a warn-and-'
               + 'return. The row asserts the block really is a three-field REFERENCE, that '
               + 'the button carries the REGISTRY\'s own label, that the component registry '
               + 'really does not hold that panel, and that the button is therefore SHOWN and '
               + 'DISABLED with the panel and the config file named in its title — while still '
               + 'printing what a save WOULD come back as. The end-to-end save lives in '
               + '`check-region-marking-tool.mjs`, under `?mode=flash`, where the tool runs.',
    testFunction: apworldRegionAtlasDoorRefusesAModuleThisAppLacks,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-procgen-metadata-door-names-what-the-pipeline-can-do',
    name: 'APWorld hub: the procgen_metadata door hands the working copy over and the pipeline answers',
    description: 'Presses the Document tab\'s procgen_metadata button and asserts the pipeline '
               + 'panel adopted the hand-off, named the door it came from, said what it can '
               + 'build from the document, and QUOTED the engine\'s own refusal for the half '
               + 'it cannot — the expected sentence read from `sphereRebuildRefusal` at run '
               + 'time rather than typed here.',
    testFunction: apworldProcgenMetadataDoorNamesWhatThePipelineCanDo,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-loop-costs-door-hands-the-working-copy-to-the-debugger',
    name: 'APWorld hub: the loop_costs door makes the cost debugger plan the WORKING COPY',
    description: 'Asserts the loop_costs row draws a per-region cost summary counted against '
               + 'the document\'s own regions, then presses its door and asserts the loops '
               + 'cost debugger is planning the handed-over document rather than applied '
               + 'state — its status line naming the door and the document\'s region count, '
               + 'and a named way back to applied state on offer.',
    testFunction: apworldLoopCostsDoorHandsTheWorkingCopyToTheDebugger,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-loop-costs-panel-says-which-numbers-the-block-carries',
    name: 'APWorld hub: the cost debugger labels a jta region as priced by its own economy',
    description: 'Opens the loop_costs door on a jta document (three NATIVE regions, so the '
               + 'block prices 1 of 4 regions and 0 of 23 locations while the plan behind it '
               + 'says 50/35/26 and 100/70/52), plans the handed-over working copy, and '
               + 'asserts EVERY check step says "own economy" and none prints a cost= figure; '
               + 'that the summary counts the block\'s regions against the world\'s own; and '
               + 'that the summary line names the one engine (loopCostPlanner) and the world '
               + 'it was pointed at. Mutant: a panel that prices a NATIVE region reds it.',
    testFunction: apworldLoopCostsPanelSaysWhichNumbersTheBlockCarries,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-loop-costs-send-writes-the-plan-as-one-op',
    name: 'APWorld hub: Send costs writes the plan into the working copy as ONE undoable op',
    description: 'On omsi_substrate_test — whose two maze regions are coarse-classed and whose '
               + 'omsi region is NATIVE — empties the document\'s (since R-b, PLANNED) block with '
               + 'the loop-mode switch so the premise is MADE rather than borrowed from the '
               + 'fixture, then presses the loop_costs door, plans the handed-over working copy, '
               + 'and presses "Send costs to the document". Asserts the row states the loop-mode '
               + 'switch; that Disable removes the block and Enable rebuilds it empty; that Send is '
               + 'shown-and-disabled with a reason before a plan exists; that the HUB\'s '
               + 'document gains real prices for some but not all regions, as exactly ONE '
               + 'document-scope `set-key loop_costs` whose `generatedFrom` names the door; that '
               + 'one Undo restores the EMPTY block; and that the hub\'s schema veto REFUSES a '
               + 'block whose location cost is not a number, naming the path, without the op '
               + 'reaching the session.',
    testFunction: apworldLoopCostsSendWritesThePlanAsOneOp,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-links-tab-reaches-an-editor-with-no-data',
    name: 'APWorld hub: the Links tab opens a block editor for a key this document does not have',
    description: 'On a document with no `region_atlas` at all, the Links tab must still carry '
               + 'that block\'s row — with the REGISTRY\'s own label, the same string the '
               + 'Document tab shows — and name TWO different absences apart: this document '
               + 'has no data for it, and this app does not load its editor. A row whose '
               + 'editor IS loaded (`sphere_log`) must stay openable and say which panel it '
               + 'raised, so the claim is not "the tab disabled everything".',
    testFunction: apworldLinksTabReachesAnEditorWithNoData,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-loop-mode-switch-adds-and-removes-the-block',
    name: 'APWorld hub: the loop_costs row switches loop mode on and off as ONE undoable op',
    description: 'On procgen_maze — which carries no `loop_costs` block at all — asserts the '
               + 'Document row says loop mode is OFF, then presses "Enable loop mode" and '
               + 'asserts the document gains exactly the four keys the schema requires, '
               + 'carrying the EXPORTED defaults, as one document-scope `set-key loop_costs`; '
               + 'that the summary then reads "0 of 4 regions priced"; that "Disable loop mode" '
               + 'REMOVES the key rather than emptying it; and that two undos restore the empty '
               + 'block and then the absence, in that order — the two states told apart.',
    testFunction: apworldLoopModeSwitchAddsAndRemovesTheBlock,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-send-into-a-replaced-document-is-refused',
    name: 'APWorld hub: a cost plan cannot land in a document the hub has since replaced',
    description: 'Hands omsi_substrate_test to the loops cost debugger, plans it, then loads '
               + 'procgen_maze into the hub through the app\'s own load path and presses "Send '
               + 'costs to the document". Asserts the hub\'s document token MOVED (so the '
               + 'premise is real), that procgen_maze still carries no `loop_costs` block, that '
               + 'its op list never grew, and that the debugger prints the hub\'s refusal '
               + 'naming both the replacement and the fix. Mutant: a hub that ignores the token '
               + 'writes the plan into the wrong document and the three claims red together.',
    testFunction: apworldSendIntoAReplacedDocumentIsRefused,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});
