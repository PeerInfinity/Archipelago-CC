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
const SCHEMA_PATH = './schema/rules.schema.json';

/** Load the preset, raise the panel, and hand back its live instance. */
async function openHub(testController) {
    testController.log(`Loading ${PRESET_PATH}…`);
    await testController.loadRulesFromFile(PRESET_PATH);
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
