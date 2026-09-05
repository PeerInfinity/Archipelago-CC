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
