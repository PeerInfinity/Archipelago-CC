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
const SCHEMA_PATH = './schema/rules.schema.json';

/** Load the preset, raise the panel, and hand back its live instance. */
async function openHub(testController, presetPath = PRESET_PATH) {
    testController.log(`Loading ${presetPath}…`);
    await testController.loadRulesFromFile(presetPath);
    await testController.stateManager.pingWorker('after-rules-load', 5000);
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
        8000,
        50,
    );
    testController.reportCondition('APWorld editor panel holds a document', !!panel);
    return panel;
}

/** Select a tab through the panel's own control, then let it render. */
function selectTab(panel, tabId) {
    panel._selectTab(tabId);
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
 * ⛓⛓ **THE RAW VIEW — one `replace-document` op, and the MEASURED guard.**
 * The threshold is not typed here: it is imported from the module that carries
 * the measurement, so moving the constant retargets this row instead of
 * breaking it, and HALVING it flips the at-the-limit case below.
 */
export async function apworldRawViewReplacesTheDocumentAsOneOp(testController) {
    try {
        const { RAW_VIEW_LIMIT_BYTES } = await import('../../apworldEditor/rawView.js');
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();

        selectTab(panel, 'raw');
        const area = await testController.pollForValue(
            () => document.querySelector(`${PANEL_SELECTOR} .apworld-raw-text`),
            'the raw view\'s text area',
            8000,
            50,
        );
        testController.reportCondition('a small document mounts the raw view', !!area);
        if (!area) return testController.getOverallResult();

        const recordText = JSON.stringify(panel.rulesDoc, null, 2);
        testController.reportCondition(
            'the view holds the WORKING COPY, pretty-printed', area.value === recordText);

        const before = JSON.stringify(panel.session.record());
        const opsBefore = panel.session.ops().length;

        const edited = JSON.parse(recordText);
        edited.preset_label = 'H2 raw view';
        area.value = JSON.stringify(edited, null, 2);
        area.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector(`${PANEL_SELECTOR} .apworld-raw-save`).click();

        testController.assertEqual('the text edit reached the record',
            'H2 raw view', panel.rulesDoc.preset_label);
        testController.assertEqual('it was exactly ONE op',
            String(opsBefore + 1), String(panel.session.ops().length));
        testController.assertEqual('and the op is a replace-document',
            'replace-document', panel.session.ops().at(-1).op);

        /**
         * ⛔ THE UNDO IS THE DISCRIMINATOR. An op that stored the caller's
         * parsed object rather than a copy applies fine and re-folds to
         * something nobody typed — only the fold over the shorter list sees it.
         */
        document.querySelector(`${PANEL_SELECTOR} .apworld-undo`).click();
        testController.reportCondition(
            'one undo takes the whole text edit back, BYTE FOR BYTE',
            JSON.stringify(panel.session.record()) === before);
        testController.assertEqual('and the op list is back where it started',
            String(opsBefore), String(panel.session.ops().length));

        /* ── the MEASURED guard ─────────────────────────────────────────── */

        const pad = (bytes) => {
            const doc = { game_name: 'Threshold probe', preset_label: '' };
            const overhead = JSON.stringify(doc, null, 2).length;
            doc.preset_label = 'x'.repeat(Math.max(0, bytes - overhead));
            return doc;
        };

        // ⛓ AT the limit — shown. This is the case a HALVED constant flips.
        const atLimit = pad(RAW_VIEW_LIMIT_BYTES);
        panel._openSession(atLimit, { kind: 'rules', source: 'probe', player: '1', origin: null });
        selectTab(panel, 'raw');
        panel._render();
        testController.assertEqual(
            'a document AT the measured limit is still shown',
            String(RAW_VIEW_LIMIT_BYTES), String(panel._rawVerdict().bytes));
        testController.reportCondition(
            '…and it mounts the text view',
            !!document.querySelector(`${PANEL_SELECTOR} .apworld-raw-text`)
            && !document.querySelector(`${PANEL_SELECTOR} .apworld-raw-overlimit`));

        // ⛓ One byte over — the guard, with the download beside it.
        panel._openSession(pad(RAW_VIEW_LIMIT_BYTES + 1),
            { kind: 'rules', source: 'probe', player: '1', origin: null });
        selectTab(panel, 'raw');
        panel._render();
        const over = document.querySelector(`${PANEL_SELECTOR} .apworld-raw-overlimit`);
        testController.reportCondition('one byte over the limit refuses the view', !!over);
        testController.reportCondition(
            '…and mounts no text area at all',
            !document.querySelector(`${PANEL_SELECTOR} .apworld-raw-text`));
        testController.reportCondition(
            '…and offers the download instead',
            !!document.querySelector(`${PANEL_SELECTOR} .apworld-raw-download`));
        testController.reportCondition(
            'the size line says how big it is and what the limit is',
            (document.querySelector(`${PANEL_SELECTOR} .apworld-raw-size`)?.textContent ?? '')
                .includes('download instead'));

        // ⛓ And the guard is ADVICE, not a lock: the owner can still look.
        document.querySelector(`${PANEL_SELECTOR} .apworld-raw-force`).click();
        testController.reportCondition(
            '"Show it anyway" mounts the view over an oversized document',
            !!document.querySelector(`${PANEL_SELECTOR} .apworld-raw-text`));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('raw-view test error-free', false);
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
    name: 'APWorld hub: the raw view saves as ONE replace-document op, under a measured limit',
    description: 'Edits the whole document as text, saves, and asserts exactly one '
               + 'replace-document op moved the record and one undo takes it back byte for '
               + 'byte; then drives the size guard at the measured threshold, one byte over '
               + 'it, and through the "show it anyway" escape — the threshold imported from '
               + 'the module that carries the measurement, never typed here.',
    testFunction: apworldRawViewReplacesTheDocumentAsOneOp,
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
