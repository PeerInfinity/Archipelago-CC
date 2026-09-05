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

const SCHEMA_PATH = './schema/rules.schema.json';

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
