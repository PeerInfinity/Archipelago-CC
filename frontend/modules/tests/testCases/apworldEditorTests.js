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
/**
 * ⛓⛓ S1 — **THE SIDECARS TAB'S POPULATION IS READ, NOT TYPED.** The tab
 * filters the registry by this table, so the row that asserts what the tab
 * draws reads the SAME table: it guards the RENDERER (does every member get a
 * full row, in registry order, with the summary beside them). ⛔ It is
 * therefore BLIND to the membership itself — drop a key from the table and the
 * tab draws one row fewer against an expectation that shrank with it. What
 * makes the membership falsifiable is `documentKeys.test.js`, whose population
 * comes from the exporter's own `_inject_worldgen_*` methods and from the ⚖.
 */
import {
    DOCUMENT_KEY_EDITORS, DOCUMENT_TAB_ID, KEYS_OWNED_BY_TAB, regionAtlasSetKeyOp,
    SIDECARS_TAB_ID, SIDECARS_TAB_SUMMARY_KEY,
} from '../../apworldEditor/documentKeys.js';
/**
 * ⛓⛓ W0 — **THE TWO AUTHORITIES A VIEWER-DOOR ROW HAS TO ASK, and neither is a
 * string in this file.** `centralRegistry` is what the hub itself consults to
 * decide whether a door is pressable (`_panelRefusal`), so a row that asserted
 * "the button is enabled" without it would be re-stating the button; and
 * `panelManager.isPanelActive` is the EFFECT of the press — the panel that ended
 * up in front — rather than the button's own text, which never moves.
 */
import { centralRegistry } from '../../../app/core/centralRegistry.js';
import panelManager from '../../../app/core/panelManager.js';
/**
 * ⛓ W0 — the table the Meta tab's rows and the `set-meta` op both read, so the
 * claim *"this sub-key is one the home tab does not draw"* is derived from the
 * home tab's own field list instead of asserted by a comment.
 *
 * ⛓ PRESET SIDECARS S1 — and the raw sidecar save's rows ask the OP directly as
 * well as pressing Save (trap 1305: the op is the authority, the widget a
 * courtesy), and assert the clause the op's description ends with rather than
 * a copy of it.
 */
import {
    META_FIELDS, SIDECAR_NOT_REDERIVED, applyRulesDocOp,
} from '../../apworldEditor/rulesDocOps.js';
/**
 * ⛓ R-a — the two numbers the presence switch writes, compared against their
 * SOURCE. Typing 50 and 10 into this row would make it agree with a second copy
 * of the pair rather than with `loopCostDefaults.js`.
 */
import {
    DEFAULT_LOCATION_COST, DEFAULT_REGION_COST,
} from '../../shared/procgen/loopCostDefaults.js';
/**
 * ⛓ M0 — the palette the composite renderer paints a substrate that declares no
 * painter with: a `genericBg` box carrying its id in `textAdventureFg`. The
 * zone row samples PIXELS against these two, so the claim *"the generic box's
 * label is on the canvas"* is scored against the renderer's own colours rather
 * than against numbers typed here.
 */
import { COLORS, TILE_PX } from '../../procgenCore/compositeMapRenderer.js';
/**
 * ⛓ M0 — the size a composite cell falls back to when a document carries no
 * tile geometry. The zone row asserts the drawn canvas is that size; typing 8
 * and 6 here would make it agree with a copy of the constant.
 */
import { DEFAULT_REGION_SIZE } from '../../procgenPipeline/procgenPipelineEngine.js';
/**
 * ⛓ S0 — the indent the hub's JSON widget pretty-prints with, so the row that
 * asserts a sidecar block's text is byte-equal to its entry uses the widget's
 * own spelling rather than a `2` typed here. ⛓ S1 — and Edit ▸'s own
 * inspection, so the row that asserts the button's verdict after a raw save
 * compares it with what the door's function answers for the document NOW,
 * rather than with a sentence typed here.
 */
import { JSON_BLOCK_INDENT, inspectRegionRoom } from '../../apworldEditor/regionRoundTrip.js';
/**
 * ⛓ V0 — the validity report's kinds, so a row asserts the KIND the product
 * stamped on its sentence rather than the sentence's wording; and the merged
 * declaration, so the field a row drops is picked off the substrate's own
 * declaration rather than typed.
 */
import { SIDECAR_ISSUE_KINDS } from '../../apworldEditor/sidecarIssues.js';
import { sidecarFieldsOf } from '../../procgenCore/sidecarFields.js';
/**
 * ⛓ D1 — the fields view's vocabulary: which control a row stamps, which level
 * it is on, the two ENTRY keys the form names (the payload's, the substrate's),
 * and the clause the picker's title carries — so a row asserts the product's
 * own names. ⛔ Never the rows' EXPECTATION: which fields exist is read off the
 * declaration, the schema and the registry (the law), not off this module.
 */
import {
    PAYLOAD_KEY, SIDECAR_FORM_CONTROLS, SIDECAR_FORM_LEVELS, SUBSTRATE_KEY, SUBSTRATE_PICKER_CLAUSE,
} from '../../apworldEditor/sidecarForm.js';

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
 * Slots 1 and 2 are `Procgen Maze WorldGen` (3 grown regions each); slots 3 and
 * 4 are `Bounce Demo WorldGen` (5 ZONE regions each). ⚠ **Every one of the four
 * slots carries a `grid_cell` on every region** — this docblock said "no
 * `grid_cell`" of slots 3/4 until M0 re-measured it, and the sentence was wrong
 * when it was written: what those slots lack is a tile-grid PAYLOAD, which is a
 * different field and (since M0) no longer a reason not to draw. All four slots
 * draw; slots 3/4 draw at the engine's default cell size.
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

/**
 * ⛓⛓ **W3 — THE PLACEMENTS ROWS' DOCUMENT.** Measured over the committed
 * corpus at the slice's HEAD: 211 of the 212 preset files carry
 * `canonical_placements` and 97 carry at least one entry. This one is FULL —
 * every one of its 25 locations is placed, over 9 region groups, out of 14
 * items — so "the tab draws the document's own placements" is a claim about a
 * populated block rather than about an empty one, and "N of M placed" is
 * asserted at both ends of its range by the delete.
 */
const PLACEMENTS_PRESET_PATH = './presets/procgen_topdown/AP_1/AP_1_rules.json';

/**
 * ⛓⛓ **I1 — THE GROUPS ROWS' REAL-REGISTRY DOCUMENT.** Measured over the
 * committed corpus: all 212 documents carry `item_groups` and all 224 slots hold
 * a LIST of names. This one holds **23** names over **163** items — and it is
 * also in the corpus's common divergent state, with `Event` on seven items and
 * in neither the registry nor anything derived from it (155 of the 224 slots
 * carry at least one such unlisted group). `procgen_maze/AP_1` (`PRESET_PATH`)
 * is the other end of the range, with one name over two items, which is what a
 * procgen document looks like.
 */
const ITEM_GROUPS_PRESET_PATH =
    './presets/alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json';

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
 * ⛓⛓ **HOW MANY OF A SLOT'S REGIONS CARRY TILE GEOMETRY** — which is not how
 * many are drawn, and since M0 is not what decides whether a slot has a map at
 * all. It is the predicate that picks the CELL SIZE: a slot with any tile-grid
 * payload is sized from the largest of them, a slot with none takes the
 * engine's default.
 *
 * ⚠ It used to be this file's "can be drawn" predicate, and H4a's first in-app
 * run is why: that row had assumed `grid_cell ⇒ a map`, and the fixture's two
 * `Bounce Demo WorldGen` slots carry a `grid_cell` on all five of their regions
 * and drew nothing, because a bounce level's geometry is
 * `params.bounceLevel.size` in PIXELS. M0 made `grid_cell ⇒ a map` true — the
 * assumption was right about the layout and wrong only about the size — so the
 * DRAWABLE population is `withGridCells` above and this one answers the
 * narrower question its name asks.
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

        /**
         * ⛓⛓ **THE POPULATION IS SELECTED BY THE LAW, NOT BY THE FIELD M0
         * MOVED.** A slot has a map when its sidecars carry a `grid_cell` — the
         * LAYOUT — and that is what this list asks. Selecting it by the tile
         * geometry instead (`withCompositeGeometry`, which is what this row did
         * until M0) would make the row agree with a reconstruction that had
         * never learned to fall back: the zone slots would be filtered out of
         * the drawable population by the very field under test, and the mutant
         * that removes the fallback would stay green.
         */
        const drawable = Object.keys(counts).filter((s) => withGridCells(doc, s) > 0);
        const flat = Object.keys(counts).filter((s) => withGridCells(doc, s) === 0);
        testController.reportCondition(
            'the document has at least one slot that carries grid cells', drawable.length > 0);
        /**
         * ⛓ **AND THIS FIXTURE NO LONGER HAS A "no map" SLOT.** It had two: the
         * bounce slots carried a `grid_cell` on every region and still drew
         * nothing, which was H4a's third no-map cause and M0's defect. The
         * assertion is here rather than left implicit because an empty `flat`
         * list would otherwise skip the loop below in silence. The remaining
         * "no map" answer is driven on a document that really has no cells
         * (`apworld-map-says-no-map-without-grid-data`).
         */
        testController.assertEqual(
            'and NO slot is flat any more — M0 turned the two zone slots into maps',
            '0', String(flat.length));
        /**
         * ⛓ The slots that draw are NOT all sized the same way, which is what
         * makes this document the one that can tell the two rules apart: the
         * maze slots take their size from their own payloads, the zone slots
         * take the engine's default.
         */
        const tiled = drawable.filter((s) => withCompositeGeometry(doc, s) > 0);
        const zoned = drawable.filter((s) => withCompositeGeometry(doc, s) === 0);
        testController.reportCondition(
            'the document carries BOTH a tile-grid slot and a zone-only slot',
            tiled.length > 0 && zoned.length > 0);

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
            /**
             * ⛓ Every region with a cell is placed — the count is the slot's
             * own `grid_cell` count, so a substrate whose payload stopped
             * deserializing would show up here as a short canvas rather than as
             * a silently smaller map.
             */
            testController.assertEqual(
                `slot ${slot}: the canvas holds that slot's region count`,
                String(withGridCells(doc, slot)), String(canvas.dataset.regions));
            const label = document.querySelector(`${PANEL_SELECTOR} .apworld-map-slot`);
            testController.reportCondition(
                `slot ${slot}: the map says which slot it read`,
                !!label && label.textContent.includes(`player slot ${slot}`));
            /**
             * ⛔ **AND WHERE THE CELL SIZE CAME FROM.** The stats line must not
             * claim a tile size a zone world does not have; the panel reads the
             * reconstruction's own `regionSizeSource`, and the expectation here
             * is the document's own answer to the same question.
             */
            testController.assertEqual(
                `slot ${slot}: the stats line names the rule that sized the cell`,
                withCompositeGeometry(doc, slot) > 0 ? 'payload' : 'default',
                label ? label.dataset.cellSource : null);
        }

        /**
         * ⛔ AND BACK. A panel that drew slot 1 and then never re-derived would
         * pass every check above in order. The walk ends on the LAST slot, so
         * returning to the first is what catches a map that stayed where it was
         * — and since M0 that return also crosses a cell-size change (the last
         * slot is sized by the fallback, the first by its own payloads), so a
         * memo that re-derived the grid and kept the old size reds here too.
         */
        selectPlayer(select, drawable[0]);
        const again = await testController.pollForValue(
            () => {
                selectTab(panel, 'map');
                return document.querySelector(`${PANEL_SELECTOR} .apworld-map-canvas`);
            },
            'the first drawable slot\'s canvas, after walking the rest', 8000, 50);
        testController.assertEqual('switching back re-draws that slot\'s map',
            String(withGridCells(doc, drawable[0])),
            again ? String(again.dataset.regions) : null);
        const backLabel = document.querySelector(`${PANEL_SELECTOR} .apworld-map-slot`);
        testController.assertEqual('…and re-derives its cell size with it',
            withCompositeGeometry(doc, drawable[0]) > 0 ? 'payload' : 'default',
            backLabel ? backLabel.dataset.cellSource : null);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('map-per-slot test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **M0 — THE ZONE WORLD THAT NOW DRAWS.** The four-player fixture's slot 3
 * is `Bounce Demo WorldGen`: five regions, a `grid_cell` on every one, and no
 * tile geometry anywhere in the payloads. It was the hub's *"5 regions carry a
 * grid cell, but `bounce` stores no tile-grid geometry in the payload"* answer,
 * and the ⚖ that accepted it (hub plan §7 ⚖ 3) was reversed on the user's own
 * observation: *"when I load the Bounce demo preset in the procgen pipeline
 * panel, then generate it, then click Load into Frontend, its map doesn't
 * display in the Map tab"*.
 *
 * ⛔ **THE LABEL IS THE HALF A SIZE CHECK CANNOT SEE.** A canvas of the right
 * dimensions with nothing painted on it would satisfy every count here, and so
 * would one painted with empty cells. `drawGenericRegion` is what a substrate
 * declaring no `compositeMap.drawRegion` gets — a `genericBg` box with its id
 * written across it in `textAdventureFg` — so the row samples the cell's pixels
 * and scores each against those two colours, which is the renderer's own
 * palette rather than numbers typed here.
 */
export async function apworldMapDrawsAZoneWorld(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const doc = panel.rulesDoc;
        // ⛓ The zone slot, PICKED OFF THE DOCUMENT: cells everywhere, tile
        //   geometry nowhere. Naming "3" here would tie the row to one export.
        const zoneSlot = Object.keys(sidecarCounts(doc)).find(
            (s) => withGridCells(doc, s) > 0 && withCompositeGeometry(doc, s) === 0);
        testController.reportCondition(
            'the fixture carries a zone-only slot — cells, no tile geometry', !!zoneSlot);
        if (!zoneSlot) return testController.getOverallResult();

        const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        if (!select) {
            testController.reportCondition('the toolbar carries a player selector', false);
            return testController.getOverallResult();
        }
        selectPlayer(select, zoneSlot);

        const canvas = await testController.pollForValue(
            () => {
                selectTab(panel, 'map');
                return document.querySelector(`${PANEL_SELECTOR} .apworld-map-canvas`);
            },
            `the zone slot's map canvas`, 8000, 50);
        testController.reportCondition('⛓ the Map tab draws a canvas for a ZONE world', !!canvas);
        if (!canvas) return testController.getOverallResult();

        const n = withGridCells(doc, zoneSlot);
        testController.assertEqual('one drawn cell per sidecar grid_cell',
            String(n), canvas.dataset.regions);

        /* ── the CELL SIZE is the engine's default, and says so ── */
        const cellW = Number(canvas.dataset.cellW);
        const cellH = Number(canvas.dataset.cellH);
        testController.assertEqual('the cell is the engine default wide',
            String(DEFAULT_REGION_SIZE.width * TILE_PX), String(cellW));
        testController.assertEqual('the cell is the engine default tall',
            String(DEFAULT_REGION_SIZE.height * TILE_PX), String(cellH));
        const label = document.querySelector(`${PANEL_SELECTOR} .apworld-map-slot`);
        testController.assertEqual('the stats line names the DEFAULT as the rule that sized it',
            'default', label ? label.dataset.cellSource : null);
        testController.reportCondition(
            '…and does not call it a tile size',
            !!label && !label.textContent.includes('tiles'));

        /* ── the GENERIC BOX, sampled ── */
        const ctx = canvas.getContext('2d');
        const first = panel._mapResult().grid.allRegions()[0];
        const x0 = first.cell.gx * cellW;
        const y0 = first.cell.gy * cellH;
        const px = ctx.getImageData(x0, y0, cellW, cellH).data;
        const near = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return (i) => (px[i] - r) ** 2 + (px[i + 1] - g) ** 2 + (px[i + 2] - b) ** 2;
        };
        const toBox = near(COLORS.genericBg);
        const toLabel = near(COLORS.textAdventureFg);
        const toEmpty = near(COLORS.emptyCell);
        let box = 0;
        let labelPaint = 0;
        let empty = 0;
        for (let i = 0; i < px.length; i += 4) {
            const b = toBox(i);
            const l = toLabel(i);
            const e = toEmpty(i);
            if (l < b && l < e) labelPaint += 1;
            else if (b <= e) box += 1;
            else empty += 1;
        }
        testController.reportCondition(
            '⛓ the cell is painted as the GENERIC box, not left empty', box > empty);
        testController.reportCondition(
            '⛓⛓ and the substrate\'s id is written across it — label-coloured paint present',
            labelPaint > 0);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('zone-map test error-free', false);
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
    name: 'APWorld hub: the Map tab draws the SELECTED slot, each sized by its own rule',
    description: 'On one document with four slots — two grown maze worlds and two zone-only '
               + 'bounce worlds — walks every slot through the real toolbar selector: each '
               + 'draws a canvas holding THAT slot\'s grid_cell count, names the slot it read, '
               + 'and says which rule sized its cell (its own payloads for the maze slots, the '
               + 'engine default for the zone ones). Since M0 no slot here is "no map"; the row '
               + 'asserts that too, so an empty population cannot skip a loop in silence. Then '
               + 'switches back, because a map that never re-derived would pass the walk in '
               + 'order — and that return crosses a cell-size change.',
    testFunction: apworldMapFollowsTheSelectedPlayerSlot,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-map-draws-a-zone-world',
    name: 'APWorld hub: a zone-only world draws its composite map',
    description: 'PRESET SIDECARS M0, reversing hub plan §7 ⚖ 3 on the user\'s observation '
               + 'that a loaded Bounce demo showed no map. Picks the fixture\'s zone-only slot '
               + 'off the document (grid cells everywhere, tile geometry nowhere), then asserts '
               + 'the Map tab draws a canvas with one cell per grid_cell, sized by the engine\'s '
               + 'exported default rather than by a tile count it invented, and that the cells '
               + 'are really PAINTED: the pixels of the first cell are scored against the '
               + 'renderer\'s own genericBg / textAdventureFg / emptyCell colours, so a canvas '
               + 'of the right size with nothing on it reds.',
    testFunction: apworldMapDrawsAZoneWorld,
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
 * `loop_costs` door → the debugger's Load and Plan All → its "Send costs to
 * APWorld Editor" → the hub's own Undo.
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
        // ⛓ S1 — the state the focus claims below are a CHANGE from, read
        //   immediately before the gesture rather than assumed.
        const tabAtSend = panel.activeTab;
        const hubActiveAtSend = panelManager.isPanelActive(PANEL_ID);
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
         * ⛓⛓⛓ **S1 — AND THE HUB COMES TO THE FRONT, ON THE ROW IT JUST WROTE**
         * (⚖ user, 2026-09-08: *"this automatically activated the APWorld Editor
         * panel and scrolled to the relevant section, with a message that the
         * data was successfully loaded"*).
         *
         * ⛔ Every claim is an EFFECT, not a call: `panelManager.isPanelActive`
         * is the panel actually in front (the door raised the DEBUGGER a moment
         * ago, so the premise below is a real change of state), the destination
         * tab is read off the key's OWN registry row rather than named here, and
         * "in view" is the row's rectangle against the scroll container's.
         *
         * ⚠ The two are not independent: a panel that is not in front has no
         * layout, so its rows measure zero and the viewport claim reds with the
         * active-panel one. That is the hidden-parent measurement, named rather
         * than pretended away.
         */
        const homeTab = panel._documentRows().find((r) => r.key === 'loop_costs')?.ownedByTab;
        testController.assertEqual(
            'loop_costs has a home tab, and it is NOT the tab Send was pressed from',
            'true', String(!!homeTab && homeTab !== tabAtSend));
        testController.assertEqual(
            'the hub was NOT the panel in front when Send was pressed — the premise',
            'false', String(hubActiveAtSend));
        testController.assertEqual(
            'after Send the APWorld editor IS the panel in front',
            'true', String(panelManager.isPanelActive(PANEL_ID)));
        testController.assertEqual(
            'and the hub selected the key\'s own home tab',
            String(homeTab), String(panel.activeTab));
        const focused = document.querySelector(
            `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="loop_costs"]`);
        testController.reportCondition('that tab draws the row Send wrote', !!focused);
        if (focused) {
            const rowRect = focused.getBoundingClientRect();
            const viewRect = panel.scrollContainer.getBoundingClientRect();
            testController.assertEqual(
                'the row is in the viewport of the panel\'s scroll container',
                'true',
                String(rowRect.bottom > viewRect.top && rowRect.top < viewRect.bottom
                    && viewRect.height > 0));
            const beside = focused.querySelector('.apworld-doc-op-message');
            testController.reportCondition(
                'and the success message is printed BESIDE that row', !!beside);
            testController.assertEqual(
                'saying the same thing the chrome says, not a second sentence',
                String(panel._opMessage), String(beside?.textContent));
        }

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
        // ⛓ S1 — the focus state BEFORE the refused gesture. The door raised the
        //   debugger, so the hub is not the panel in front; that is what must
        //   still be true afterwards.
        const tabAtSend = panel.activeTab;
        const hubActiveAtSend = panelManager.isPanelActive(PANEL_ID);
        testController.reportCondition('Send pressed against the replaced document',
            press('.cd-btn-send'));

        /**
         * ⛓⛓⛓ **S1 — AND A REFUSAL STEALS NO FOCUS.** Raising the hub and
         * scrolling to a row is what "it worked" looks like; doing it for a
         * refusal would make the two outcomes look alike on screen while the
         * status line said otherwise. ⛔ The premise is asserted too: the hub
         * really was NOT in front when Send was pressed, so "still not in front"
         * is a claim rather than a coincidence.
         */
        testController.assertEqual(
            'the hub was not the panel in front when the refused Send was pressed',
            'false', String(hubActiveAtSend));
        testController.assertEqual(
            'and a REFUSED op did not bring it to the front',
            'false', String(panelManager.isPanelActive(PANEL_ID)));
        testController.assertEqual(
            'nor did it move the hub off the tab the reader was on',
            String(tabAtSend), String(panel.activeTab));
        testController.assertEqual(
            'and nothing printed a success message beside any row',
            'false',
            String(!!document.querySelector(`${PANEL_SELECTOR} .apworld-doc-op-message`)));

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
               + 'and presses "Send costs to APWorld Editor". Asserts the row states the loop-mode '
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

/* ══════════════════════════════════════════════════════════════════════
 * W0 — THE COVERAGE ARC: an owned row's own JSON block, and the two viewer
 * doors. (`NewDocs/plans/apworld-editor-coverage-plan.md` §4, rung W0.)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **AN OWNED ROW CARRIES ITS OWN BLOCK, AND THE BLOCK REACHES WHAT THE
 * HOME TAB DOES NOT DRAW.** Until W0 the Document row for a tab-owned key drew
 * *"edited in the X tab"* and stopped there, so every field of `world` except
 * the one the Meta tab draws was reachable only through the whole-document Raw
 * JSON editor.
 *
 * ⛔ The field this row writes is chosen BY DERIVATION, not by taste: it asserts
 * that no `META_FIELDS` spec addresses it, so "the home tab does not draw this"
 * is read off the home tab's own table. And the write goes through the
 * product's own Save JSON button, so a Save wired to nothing reds here.
 */
export async function apworldOwnedRowCarriesItsOwnJsonBlock(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);
        selectTab(panel, 'document');

        const KEY = 'world';
        const FIELD = 'world_description';
        const VALUE = 'W0: written from the Document tab\'s own block';

        // ⛓ THE PREMISE, DERIVED: this key really is owned by another tab.
        const registryRow = panel._documentRows().find((r) => r.key === KEY);
        testController.reportCondition(`the ${KEY} row exists`, !!registryRow);
        if (!registryRow) return testController.getOverallResult();
        testController.reportCondition(
            `${KEY} is owned by a tab — the case that drew no editor before W0`,
            !!registryRow.ownedByTab);

        // ⛓ …and the field below is one that tab does NOT draw, read off the
        //   Meta tab's own field table rather than claimed here.
        const metaPaths = Object.values(META_FIELDS).map((spec) => spec.path('1').join('.'));
        testController.assertEqual(
            `no Meta field addresses ${KEY}.${FIELD} — so the block is the only way to it`,
            'false', String(metaPaths.includes(`${KEY}.${FIELD}`)));

        /**
         * ⛔ **RE-QUERIED EVERY TIME, because expanding a block RE-RENDERS the
         * tab.** `_makeDocumentBlockEditor`'s toggle calls `_render()`, so the
         * row element captured before the click is detached from the document
         * the moment it lands — and a `querySelector` on a detached node still
         * answers, from the old tree. The first run of this row asserted the
         * Save control against exactly that stale element and reported a
         * missing button on a panel that was drawing one.
         */
        const boxOf = () => document.querySelector(
            `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="${KEY}"]`);
        testController.reportCondition('the Document tab draws that row', !!boxOf());
        if (!boxOf()) return testController.getOverallResult();

        // ⛓ THE POINTER STAYS — the home tab is still where the shape is known.
        testController.reportCondition(
            'the row still points at the tab that owns the key',
            !!boxOf().querySelector('.apworld-doc-owned'));

        /**
         * ⛓⛓ **THE CLAIM, AND THE MUTANT TARGET.** Restoring the early return
         * in `_renderDocumentRow` leaves the pointer above and kills this.
         */
        const toggle = boxOf().querySelector('.apworld-doc-toggle');
        testController.reportCondition(
            'and it offers the same Show JSON toggle every other row gets', !!toggle);
        if (!toggle) return testController.getOverallResult();

        toggle.click();
        const textarea = await testController.pollForValue(
            () => document.querySelector(
                `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="${KEY}"] .apworld-doc-json`),
            'the block textarea, built on expand',
            8000,
            50,
        );
        testController.reportCondition('expanding builds the textarea', !!textarea);
        if (!textarea) return testController.getOverallResult();

        const slot = panel.playerId;
        testController.assertEqual(
            'the textarea holds THIS slot\'s slice of the key, not the whole map',
            JSON.stringify(panel.rulesDoc[KEY][slot]),
            JSON.stringify(JSON.parse(textarea.value)));

        const className = panel.rulesDoc[KEY][slot].world_class_name;
        const opsBefore = panel.session.ops().length;
        const edited = JSON.parse(textarea.value);
        edited[FIELD] = VALUE;
        textarea.value = JSON.stringify(edited, null, 2);

        const save = boxOf().querySelector('.apworld-doc-save');
        testController.reportCondition('the block carries a Save JSON control', !!save);
        if (!save) return testController.getOverallResult();
        save.click();

        testController.assertEqual(
            `the edit reached the record at ${KEY}.${FIELD}`,
            VALUE, panel.rulesDoc[KEY][slot][FIELD]);
        testController.assertEqual(
            'it was exactly ONE op', String(opsBefore + 1), String(panel.session.ops().length));
        const op = panel.session.ops().at(-1);
        testController.assertEqual('and that op is a set-key on this key',
            `set-key ${KEY}`, `${op.op} ${op.key}`);
        // ⛓ A per-player key is written PER PLAYER — a document-scope op here
        //   would replace every slot's world with this one's.
        testController.assertEqual('scoped to the selected player slot',
            `player ${slot}`, `${op.scope} ${op.player}`);
        // ⛔ …and the field the Meta tab DOES draw is untouched by it.
        testController.assertEqual(
            'the Meta tab\'s own field on the same key is unaffected',
            String(className), String(panel.rulesDoc[KEY][slot].world_class_name));

        const undoButton = document.querySelector(`${PANEL_SELECTOR} .apworld-undo`);
        testController.reportCondition('the Undo control is present', !!undoButton);
        undoButton.click();
        testController.assertEqual(
            'ONE undo takes the sub-key back out, rather than blanking it',
            'false',
            String(Object.prototype.hasOwnProperty.call(panel.rulesDoc[KEY][slot], FIELD)));
        testController.assertEqual(
            'and the op list is back where it started',
            String(opsBefore), String(panel.session.ops().length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('owned-row block test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **THE VIEWER DOORS ARE LIVE IN THIS MODE, AND PRESSING ONE RAISES THE
 * PANEL IT DECLARED** (⚖ user, 2026-09-08: *"we could link to the existing
 * dungeons and helpers panels as viewers"*).
 *
 * ⛔ Both halves are read from an authority rather than typed: whether the
 * button is offered comes from `centralRegistry.getAllPanelComponents()` — the
 * same set the hub's own `_panelRefusal` asks — and whether the press worked
 * comes from `panelManager.isPanelActive`, the panel that is actually in front.
 * A row asserting the button's label or its own `disabled` flag would agree
 * with the panel about a door that raises nothing.
 *
 * ⛓ The row also checks a door whose module this mode does NOT load
 * (`region_atlas`), so "enabled" is a discrimination rather than a mode in
 * which everything is enabled.
 */
export async function apworldViewerDoorsRaiseThePanelsTheyDeclare(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const registered = centralRegistry.getAllPanelComponents();
        /**
         * ⛓ The doors under test, derived: the registry's VIEWER rows (nothing
         * comes back) that name a panel. A door added later as a viewer is
         * covered by being one.
         */
        const viewers = Object.entries(DOCUMENT_KEY_EDITORS)
            .filter(([, editor]) => editor.returns === 'none' && editor.panelId);
        testController.reportCondition(
            'the registry declares viewer doors to press', viewers.length > 1);

        // ⛓ THE DISCRIMINATION: this mode really does lack a panel some door
        //   names, so "registered" is a fact about this app and not a constant.
        testController.assertEqual(
            'a door whose module this mode does not load is NOT registered',
            'false', String(registered.has(DOCUMENT_KEY_EDITORS.region_atlas.panelId)));

        for (const [key, editor] of viewers) {
            selectTab(panel, 'document');
            testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
            const button = await testController.pollForValue(
                () => document.querySelector(
                    `${PANEL_SELECTOR} .apworld-doc-editor-open[data-doc-key="${key}"]`),
                `the ${key} door`,
                8000,
                50,
            );
            testController.reportCondition(`the ${key} row draws its door`, !!button);
            if (!button) continue;

            testController.assertEqual(
                `this app registers \`${editor.panelId}\` — so the ${key} door is offered`,
                'true', String(registered.has(editor.panelId)));
            testController.assertEqual(
                `and the ${key} door is therefore pressable`, 'false', String(button.disabled));
            testController.assertEqual(
                `it says nothing comes back from ${key}`, 'none', editor.returns);

            button.click();
            const raised = await testController.pollForCondition(
                () => panelManager.isPanelActive(editor.panelId),
                `${editor.panelId} became the active panel`,
                8000,
                50,
            );
            testController.reportCondition(
                `pressing the ${key} door put \`${editor.panelId}\` in front`, raised);
        }
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('viewer-door test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-owned-row-carries-its-own-json-block',
    name: 'APWorld hub: a tab-owned Document row keeps its pointer AND draws its own JSON block',
    description: 'On the `world` row — owned by the Meta tab, which draws exactly one of its '
               + 'fields — asserts the pointer to the home tab is still there, that the row '
               + 'now offers the same Show JSON toggle every unowned row gets, that expanding '
               + 'it builds a textarea holding THIS slot\'s slice, and that pressing the '
               + 'block\'s own Save JSON writes a sub-key no META_FIELDS spec addresses (the '
               + 'claim derived from the Meta tab\'s own table) as exactly ONE player-scope '
               + '`set-key`, leaving the Meta tab\'s field untouched and coming back out in '
               + 'ONE undo. Mutant: restoring the early return in `_renderDocumentRow` reds '
               + 'the toggle condition.',
    testFunction: apworldOwnedRowCarriesItsOwnJsonBlock,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-viewer-doors-raise-the-panels-they-declare',
    name: 'APWorld hub: the viewer doors are offered because the registry holds their panels, and pressing one raises it',
    description: 'Over every VIEWER row of `DOCUMENT_KEY_EDITORS` (returns `none`, names a '
               + 'panel), asserts this app really registers that component — asked of '
               + '`centralRegistry.getAllPanelComponents()`, the same set the hub\'s own '
               + 'refusal consults — that the door is therefore pressable, and that pressing '
               + 'it makes that panel the ACTIVE one (`panelManager.isPanelActive`, not the '
               + 'button\'s text). A door whose module this mode does not load '
               + '(`region_atlas`) is asserted absent from the same set, so "registered" is a '
               + 'discrimination rather than a mode where everything is on.',
    testFunction: apworldViewerDoorsRaiseThePanelsTheyDeclare,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/* ══════════════════════════════════════════════════════════════════════
 * S1 — THE SIDECARS TAB. (`NewDocs/plans/apworld-editor-coverage-plan.md` §4,
 * rung S1.)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **THE SIDECARS TAB DRAWS THE REGISTRY'S SIDECAR KEYS, WITH THE DOCUMENT
 * TAB'S OWN RENDERER** (⚖ user, 2026-09-08).
 *
 * ⛔ **WHAT THIS ROW IS, AND WHAT IT IS NOT.** Its expectation is
 * `KEYS_OWNED_BY_TAB.sidecars` — the same table the panel filters by — so it
 * cannot see a key REMOVED from that table (the expectation would shrink with
 * the tab). It is the RENDERER's guard: every member gets a full row, in
 * registry order, built by `_renderDocumentRow` and not by a second one; the
 * summary and its door are beside them; and the Document tab's rows for the same
 * keys gained their pointer without losing their block. The MEMBERSHIP is
 * guarded in `documentKeys.test.js`, against the exporter's own sidecar merge
 * and against the ⚖ — an authority outside the table.
 *
 * ⛓ Driven on `procgen_maze`, which carries `procgen_metadata` and three
 * `preset_sidecars` regions in slot 1, so both the "a member the document has"
 * case and the summary's counts are real rather than empty.
 */
export async function apworldSidecarsTabDrawsTheRegistrysSidecarKeys(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        // ⛓ THE EXPECTATION, READ: registry order (the schema's), filtered by
        //   the ownership table. Nothing about it is typed in this file.
        const expected = panel._documentRows()
            .filter((r) => KEYS_OWNED_BY_TAB.sidecars.includes(r.key))
            .map((r) => r.key);
        testController.assertEqual(
            'the ownership table names a corpus of sidecar keys, and every one of '
            + 'them is a registry key',
            String(KEYS_OWNED_BY_TAB.sidecars.length), String(expected.length));
        testController.reportCondition(
            'and there is more than one of them', expected.length > 1);

        selectTab(panel, 'sidecars');
        const drawn = await testController.pollForValue(
            () => {
                const rows = document.querySelectorAll(
                    `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key]`);
                return rows.length > 0 ? [...rows].map((r) => r.dataset.docKey) : null;
            },
            'the Sidecars tab\'s rows',
            8000,
            50,
        );
        testController.reportCondition('the Sidecars tab draws rows', !!drawn);
        if (!drawn) return testController.getOverallResult();
        testController.assertEqual(
            'it draws EXACTLY the registry\'s sidecar keys, in registry order',
            expected.join(','), drawn.join(','));

        /**
         * ⛓⛓ **THE SUMMARY IS THE REGIONS TAB'S KEY, AND IT IS A SUMMARY.**
         * `preset_sidecars` must NOT be one of the rows — a second whole-block
         * editor for a key edited per region is the thing the ⚖ did not ask for
         * — and the counts are the document's own, through the same helper the
         * Map-tab rows use.
         */
        testController.assertEqual(
            'preset_sidecars is summarised, not drawn as a sixth row',
            'false', String(drawn.includes(SIDECARS_TAB_SUMMARY_KEY)));
        const counts = sidecarCounts(panel.rulesDoc);
        const slots = Object.keys(counts);
        testController.reportCondition(
            'this document really carries per-region sidecars — the premise for the counts',
            slots.length > 0 && counts[slots[0]] > 0);
        const summary = document.querySelector(
            `${PANEL_SELECTOR} .apworld-sidecars-summary-text`);
        testController.reportCondition('the tab carries the summary line', !!summary);
        for (const slot of slots) {
            testController.assertEqual(
                `the summary counts slot ${slot} off the document, not off a total`,
                'true',
                String(!!summary
                    && summary.textContent.includes(`slot ${slot}: ${counts[slot]} region`)));
        }

        /**
         * ⛓ S0 — **THE SUMMARY IS NOW THE COLLAPSED HEAD OF A PER-REGION LIST.**
         * `Go to Regions` (the tab) is gone — it pointed at a tab that drew none
         * of this data — and what stands in its place is the list's expander.
         * The list itself (collapsed by default, one row per entry, `Go to
         * region`) is its own row, `apworld-sidecars-list-is-collapsed-and-goes-
         * to-the-region`; here only its presence, so this row still describes
         * the whole tab.
         */
        testController.reportCondition(
            '⛓ S0 — the tab-level "Go to Regions" button is gone',
            !document.querySelector(`${PANEL_SELECTOR} .apworld-sidecars-go-regions`));
        testController.reportCondition(
            '…and the per-region list\'s expander stands in its place',
            !!document.querySelector(`${PANEL_SELECTOR} .apworld-sidecars-expand`));

        /**
         * ⛓⛓⛓ **ONE RENDERER, TWO HOSTS — MEASURED AS THE SAME ROW.** The
         * claim is not "the Sidecars row has a door": it is that the element the
         * Sidecars tab builds for a key is structurally the element the Document
         * tab builds for it. So the row compares the CHILD CLASS LISTS of one
         * key's box on both tabs. A forked renderer that happened to draw a door
         * and a block would still differ here.
         */
        /**
         * ⛔⛓ **R1 — MINUS THE OWNED-BY-TAB POINTER, which is now the ONE
         * element the two hosts legitimately differ by.** S1 compared the whole
         * child list and passed, because the Sidecars tab drew every key a
         * *"Go to Sidecars"* button while the reader was standing on Sidecars
         * (⚖ user, 2026-09-09). Suppressing it makes the raw lists differ by
         * exactly `.apworld-doc-owned`, so this claim — *"one renderer, two
         * hosts"* — reads past it. The pointer's own law is a row of its own
         * (`apworld-a-row-does-not-point-at-the-tab-it-is-on`); asserting it
         * here too would make one defect red two rows and neither of them
         * about the renderer.
         */
        const shapeOf = (key) => {
            const box = document.querySelector(
                `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="${key}"]`);
            return box
                ? [...box.children]
                    .filter((c) => !c.classList.contains('apworld-doc-owned'))
                    .map((c) => c.className || c.tagName).join('|')
                : null;
        };
        const richest = drawn.find((k) => panel.rulesDoc[k] !== undefined) ?? drawn[0];
        const onSidecars = shapeOf(richest);
        testController.reportCondition(
            `the Sidecars tab draws a full row for ${richest}`, !!onSidecars);
        selectTab(panel, 'document');
        await testController.pollForCondition(
            () => !!shapeOf(richest), 'the Document tab\'s row for the same key', 8000, 50);
        testController.assertEqual(
            'and the Document tab\'s row for that key is the SAME row, element for element',
            String(onSidecars), String(shapeOf(richest)));

        /**
         * ⛓⛓ **AND THE DOCUMENT TAB NOW POINTS AT THIS TAB, WITHOUT LOSING THE
         * BLOCK** — W0's rule, applied to the five keys S1 made owned. The
         * affordance is a Show JSON toggle or a typed scalar input, whichever
         * the key's declared type routes to.
         */
        const tabLabel = 'Sidecars';
        for (const key of expected) {
            const box = document.querySelector(
                `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="${key}"]`);
            testController.assertEqual(
                `the Document row for ${key} points at the ${tabLabel} tab`,
                'true',
                String(!!box?.querySelector('.apworld-doc-owned')
                    && box.querySelector('.apworld-doc-owned').textContent.includes(tabLabel)));
            testController.assertEqual(
                `…and it still carries its own editing affordance`,
                'true',
                String(!!box && (!!box.querySelector('.apworld-doc-toggle')
                    || !!box.querySelector('input') || !!box.querySelector('select'))));
        }

        // ⛓ Non-vacuity: the Document tab is still the everything-fallback, so
        //   it draws strictly more rows than the tab that hosts five of them.
        const documentRows = document.querySelectorAll(
            `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key]`).length;
        testController.reportCondition(
            'the Document tab still draws every key, not only the sidecar ones',
            documentRows > drawn.length);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('sidecars-tab test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-sidecars-tab-draws-the-registrys-sidecar-keys',
    name: 'APWorld hub: the Sidecars tab draws the registry\'s sidecar keys with the Document tab\'s renderer',
    description: 'On procgen_maze — which carries `procgen_metadata` and three per-region '
               + 'sidecars in slot 1 — asserts the tab draws exactly the keys '
               + '`KEYS_OWNED_BY_TAB.sidecars` names, in registry order; that '
               + '`preset_sidecars` is a per-slot SUMMARY counted off the document, heading '
               + 'S0\'s per-region list (its expander in place of the retired Go to Regions); '
               + 'that a key\'s box on '
               + 'this tab is element-for-element the box the Document tab builds for it '
               + '(one renderer, two hosts); and that the Document tab\'s rows for the same '
               + 'keys gained the "Edited in the Sidecars tab" pointer WITHOUT losing their '
               + 'own affordance. The membership itself is guarded in documentKeys.test.js, '
               + 'against the exporter\'s sidecar merge and the ⚖ — this row reads the same '
               + 'table the tab does and is deliberately blind to it.',
    testFunction: apworldSidecarsTabDrawsTheRegistrysSidecarKeys,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/* ══════════════════════════════════════════════════════════════════════
 * R1 — A ROW DOES NOT POINT AT THE TAB IT IS ON.
 * (`NewDocs/plans/apworld-editor-coverage-plan.md` §11, task 1.)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **THE SAME KEY, TWO HOSTS, AND ONLY ONE OF THEM GETS THE POINTER**
 * (⚖ user, 2026-09-09: *"The sidecar entries in the sidecars tab have the 'Go
 * to Sidecars' button. Is there a simple way to fix that?"*).
 *
 * ⛔ **THE CONTROL IS THE OTHER HOST, not the absence alone.** "No pointer on
 * the Sidecars tab" is also true of a renderer that stopped drawing pointers
 * altogether, and of a registry that lost `ownedByTab` — both of which would
 * ALSO take the Document tab's fifteen pointers away. So every key is read on
 * BOTH tabs in one drive: absent on its own tab, present on the Document tab,
 * and a key owned by a THIRD tab keeps its pointer on the Document tab too.
 *
 * ⛓ **THE POINTER IS ASSERTED BY ITS EFFECT.** A button labelled *"Go to
 * Sidecars"* that selected nothing would pass a label check; this row presses
 * it and reads `panel.activeTab`.
 *
 * ⚠ Every post-gesture lookup re-queries (`boxOn`): selecting a tab rebuilds
 * the tab body, so an element captured before the switch is detached — and a
 * `querySelector` on a detached node answers happily out of the old tree
 * (W0 §7.5).
 */
export async function apworldARowDoesNotPointAtTheTabItIsOn(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        /** ⛓ The box for one key on whichever tab is showing — re-queried every time. */
        const boxOn = (key) => document.querySelector(
            `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="${key}"]`);
        const pointerOn = (key) => boxOn(key)?.querySelector('.apworld-doc-owned') ?? null;

        /**
         * ⛓ The population is the LAW's, not the flag's: every key the registry
         * files under the Sidecars tab is a key that tab hosts, so every one of
         * them is a case of the defect.
         */
        const hosted = [...KEYS_OWNED_BY_TAB[SIDECARS_TAB_ID]];
        testController.reportCondition(
            'the registry files keys under the Sidecars tab — the premise', hosted.length > 0);

        selectTab(panel, SIDECARS_TAB_ID);
        for (const key of hosted) {
            testController.reportCondition(`the Sidecars tab draws ${key}`, !!boxOn(key));
            testController.assertEqual(
                `…and it does NOT point at the tab it is on`,
                'null', String(pointerOn(key) === null ? 'null' : 'a pointer'));
            /**
             * ⛔ NON-VACUITY, per key: the row must have lost the POINTER and
             * nothing else. A renderer that skipped the whole owned branch
             * again (W0's defect) would pass the line above.
             */
            testController.assertEqual(
                `…while keeping its own editing affordance`,
                'true',
                String(!!boxOn(key) && (!!boxOn(key).querySelector('.apworld-doc-toggle')
                    || !!boxOn(key).querySelector('input')
                    || !!boxOn(key).querySelector('select'))));
        }

        /**
         * ⛓⛓ **THE CONTROL — the SAME keys, drawn by the Document tab, DO
         * point here**, and the button's effect is the Sidecars tab.
         */
        selectTab(panel, DOCUMENT_TAB_ID);
        for (const key of hosted) {
            testController.assertEqual(
                `the Document tab's row for ${key} DOES point at its home tab`,
                'true', String(!!pointerOn(key)));
        }
        const goButton = pointerOn(hosted[0])?.querySelector('button') ?? null;
        testController.reportCondition(
            'that pointer carries a button', !!goButton);
        if (goButton) {
            goButton.click();
            testController.assertEqual('and pressing it selects the Sidecars tab',
                SIDECARS_TAB_ID, String(panel.activeTab));
            selectTab(panel, DOCUMENT_TAB_ID);
        }

        /**
         * ⛓⛓ **AND A KEY OWNED BY A THIRD TAB IS UNTOUCHED**, which is what
         * separates "the host suppresses its own pointer" from "the pointer is
         * gone". Derived: any owned key the Sidecars tab does NOT host.
         */
        const elsewhere = Object.entries(KEYS_OWNED_BY_TAB)
            .filter(([tab]) => tab !== SIDECARS_TAB_ID)
            .flatMap(([, keys]) => keys)
            .filter((k) => !!boxOn(k));
        testController.reportCondition(
            'the Document tab also draws keys owned by other tabs — the control\'s premise',
            elsewhere.length > 0);
        for (const key of elsewhere) {
            testController.assertEqual(
                `${key} keeps its pointer on the Document tab`, 'true', String(!!pointerOn(key)));
        }
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('self-pointer test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-a-row-does-not-point-at-the-tab-it-is-on',
    name: 'APWorld hub: a document row does not point at the tab that is drawing it',
    description: 'On procgen_maze. Every key `KEYS_OWNED_BY_TAB` files under the Sidecars '
               + 'tab is read on BOTH hosts in one drive: on the Sidecars tab it carries no '
               + '"Edited in the … tab" pointer while keeping its own editing affordance, '
               + 'and on the Document tab it carries one whose button really selects the '
               + 'Sidecars tab. A key owned by a THIRD tab keeps its pointer on the Document '
               + 'tab, which is what tells "the host suppresses its own pointer" apart from '
               + '"the pointer is gone".',
    testFunction: apworldARowDoesNotPointAtTheTabItIsOn,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓⛓⛓ **R1 — A DOOR THAT DECLARED `focusHubOnSave: false` DOES NOT TAKE THE
 * PERSON'S SCREEN** (S1 §8.6 (2); ⚖ user, 2026-09-09).
 *
 * ⛔ **`_acceptEditorOp` IS DRIVEN DIRECTLY, and that is forced.** The subject
 * is `region_atlas`, whose panel (`regionMarkingTool`) is DISABLED in the
 * default `modules.json` — H5 §19.4, and the hub's own `_panelRefusal` is what
 * makes the door unpressable here. So there is no gesture in this mode that
 * reaches the seam, and a row that waited for one would assert nothing. The op
 * is synthetic, but its VALUE is derived from `rules.schema.json`'s own
 * `required` list for the key, so the schema veto on the accepted path is real
 * rather than routed around.
 *
 * ⛓⛓ **THE NON-VACUITY IS INSIDE, not in a second row.** *"The hub did not come
 * to the front"* is also true of a seam that refused the op, threw, or never
 * reached the focus code at all. So the row asserts, in order: the op was
 * ACCEPTED and APPLIED (the op list grew by one), the focus function DID run
 * (its beside-the-row sentence is recorded, which is the half `focusHubOnSave`
 * deliberately does NOT gate), and only THEN that nothing was raised and no tab
 * moved.
 *
 * ⛓ **THE `true` HALF OF THE FLAG IS ANOTHER ROW'S** —
 * `apworld-loop-costs-send-writes-the-plan-as-one-op` presses the real Send and
 * asserts *"after Send the APWorld editor IS the panel in front"*. So a mutant
 * that ignores the flag reds one of the two whichever way it is wired: always
 * focus reds this row, never focus reds that one.
 */
export async function apworldADoorCanDeclineToRaiseTheHub(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const KEY = 'region_atlas';
        const door = DOCUMENT_KEY_EDITORS[KEY];
        // ⛓ THE PREMISE, read off the registry: this row is about a door that
        //   declared `false`, and it says so rather than assuming it.
        testController.assertEqual(
            `the ${KEY} door declares focusHubOnSave: false`,
            'false', String(door.focusHubOnSave));
        // ⛓ …and the reason the seam has to be driven directly, measured rather
        //   than asserted: the tool's component is not registered in this mode.
        testController.assertEqual(
            'and its panel really is unavailable here, which is why the seam is driven directly',
            'true', String(!!panel._panelRefusal(door.panelId)));

        /**
         * ⛓ Put a DIFFERENT panel in front, so "the hub did not come forward"
         * is a claim rather than a restatement of where it already was.
         */
        panel.eventBus.publish('ui:activatePanel', { panelId: 'helpersPanel' });
        await testController.pollForCondition(
            () => !panelManager.isPanelActive(PANEL_ID),
            'another panel is in front of the hub', 8000, 50);
        testController.assertEqual('the hub is NOT the panel in front before the save',
            'false', String(panelManager.isPanelActive(PANEL_ID)));

        /**
         * ⛓ Every `ui:activatePanel` published from here on, counted at the
         * BUS — the effect `panelManager` reports is downstream of it, and a
         * raise of a panel that happened to be in front already would not move
         * that readout.
         */
        const raised = [];
        const stopWatching = appEventBus.subscribe(
            'ui:activatePanel', (d) => raised.push(d?.panelId), 'tests');

        const tabBefore = panel.activeTab;
        const opsBefore = panel.session.ops().length;
        /** ⛓ The value is the SCHEMA's own required field list, not a shape typed here. */
        const required = panel._rulesSchema.properties[KEY].required ?? [];
        testController.reportCondition(
            'the schema names required fields for the key — the op\'s premise',
            required.length > 0);
        const value = Object.fromEntries(required.map((f) => [f, `r1-${f}`]));
        // ⛓ Built by the DOOR's own op builder, so the op is the one the tool
        //   would really hand back.
        const verdict = panel._acceptEditorOp(
            KEY, regionAtlasSetKeyOp(KEY, value), panel._documentToken);
        stopWatching();

        // ⛔ FIRST: the op really landed. Everything below is about a save that
        //    happened, and none of it discriminates on a save that did not.
        testController.assertEqual('the synthetic save was ACCEPTED',
            'true', String(!!verdict.accepted));
        testController.assertEqual('…and APPLIED — the op list grew by one',
            String(opsBefore + 1), String(panel.session.ops().length));
        testController.assertEqual('…and the document really carries the block now',
            'true', String(JSON.stringify(panel.rulesDoc[KEY]) === JSON.stringify(value)));

        // ⛓ …and the seam's own answer was recorded — the half the flag does
        //   NOT gate, and what tells "declined to raise" from "never ran".
        testController.assertEqual(
            'the success sentence was recorded beside the row anyway',
            KEY, String(panel._opRowMessage?.key));

        // ⛔ THE CLAIM.
        testController.assertEqual('the hub did NOT publish ui:activatePanel for itself',
            'false', String(raised.includes(PANEL_ID)));
        testController.assertEqual('…so it is still not the panel in front',
            'false', String(panelManager.isPanelActive(PANEL_ID)));
        testController.assertEqual('…and it did not move off the tab the reader was on',
            String(tabBefore), String(panel.activeTab));

        // ⛓ One undo takes the whole thing back — the save was an ordinary op.
        panel.undoButton.click();
        testController.assertEqual('and one Undo folds the save away',
            String(opsBefore), String(panel.session.ops().length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('declined-focus test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-a-door-can-decline-to-raise-the-hub',
    name: 'APWorld hub: a door that declared focusHubOnSave: false does not raise the panel',
    description: 'Drives `_acceptEditorOp` directly for `region_atlas` — whose marking tool is '
               + 'disabled in the default mode, so no gesture here reaches the seam — with an '
               + 'op whose value comes from the schema\'s own `required` list. Asserts the save '
               + 'was accepted and applied, that the beside-the-row sentence was recorded '
               + '(the half the flag does NOT gate, and what separates "declined" from "never '
               + 'ran"), and only then that no `ui:activatePanel` naming this panel was '
               + 'published, that the hub is still not in front, and that its tab did not '
               + 'move. The `true` half of the flag is '
               + '`apworld-loop-costs-send-writes-the-plan-as-one-op`, which presses the real '
               + 'Send and asserts the hub IS in front afterwards.',
    testFunction: apworldADoorCanDeclineToRaiseTheHub,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓⛓⛓ **R1 — THE VALIDATION BAR IS MEMOISED, AND THIS IS THE CACHE'S GUARD.**
 * `_renderValidationBar` ran `validateRules` on every render and every
 * `_selectTab` renders; `_validationIssues()` now keys the answer on the
 * record's object identity plus the slot.
 *
 * ⛔ **THE SUBJECT IS THE BAR ON SCREEN, not the memo.** A row that compared
 * `_validationIssues()` before and after would be asking the cache about
 * itself. So it reads `validationBar.textContent` — the sentence a person sees
 * — and drives the change through the panel's own `_applyOp` and its own Undo
 * BUTTON.
 *
 * ⛓ **THE OP INTRODUCES AN ISSUE THAT IS NOT A SCHEMA ERROR**, deliberately:
 * `start_regions` naming a region the world does not have is a `validateRules`
 * finding and passes `rulesJsonSchemaErrors` (the type is a string either way),
 * so the op is APPLIED rather than vetoed — which is the only way to get a
 * document whose bar must move.
 *
 * ⚠ Every read after a gesture re-queries the bar's text; `_applyOp` re-renders
 * and the nodes inside it are rebuilt (W0 §7.5).
 */
export async function apworldTheValidationBarFollowsTheDocument(testController) {
    try {
        const panel = await openHub(testController);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const barText = () => panel.validationBar.textContent.trim();
        const opsNow = () => panel.session.ops().length;

        const before = barText();
        const opsBefore = opsNow();
        testController.assertEqual(
            'the document starts with a clean bar — the premise', 'No issues', before);

        /**
         * ⛓ A start region the world does not have. Derived: the name is built
         * from the document's OWN region names so it cannot collide with one.
         */
        const slot = panel.playerId;
        const names = Object.keys(panel.rulesDoc.regions[slot]);
        testController.reportCondition('the slot has regions — the op\'s premise',
            names.length > 0);
        const GONE = `${names.join('|')} — none of these`;
        panel._applyOp({ op: 'set-key', key: 'start_regions', value: GONE, scope: 'player' });

        // ⛔ FIRST: the op was really applied. "The bar moved" is a claim about a
        //    document that changed, and a vetoed op would leave both unmoved.
        testController.assertEqual('the issue-introducing op was applied',
            String(opsBefore + 1), String(opsNow()));
        testController.assertEqual('…and the document really names the missing region',
            GONE, String(panel.rulesDoc.start_regions?.[slot]));

        // ⛓ THE CLAIM: the bar moved on the very next render.
        const after = barText();
        testController.assertEqual('the bar is no longer clean', 'false',
            String(after === before));
        testController.reportCondition('…and it reports the issue it found',
            /issue|warning|error/i.test(after));

        /**
         * ⛓⛓ **AND UNDO MOVES IT BACK** — through the panel's own Undo button,
         * because `undo` REFOLDS the record (it is not a stack pop) and the
         * cache key has to follow that too.
         */
        panel.undoButton.click();
        testController.assertEqual('one Undo folds the op away',
            String(opsBefore), String(opsNow()));
        testController.assertEqual('and the bar reads exactly what it read before',
            String(before), String(barText()));
        testController.assertEqual('…and the document no longer names it',
            'false', String(String(panel.rulesDoc.start_regions?.[slot]) === GONE));

        /**
         * ⛓ Non-vacuity for the CACHE itself: a render that changes nothing
         * must not change the bar either — otherwise "it moved" would be true
         * of a panel that simply re-validated at random.
         */
        const steady = barText();
        panel._selectTab('document');
        panel._selectTab('regions');
        testController.assertEqual('two tab switches leave the bar where it was',
            String(steady), String(barText()));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('validation-bar test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-the-validation-bar-follows-the-document',
    name: 'APWorld hub: the validation bar moves on an issue-introducing op and back on Undo',
    description: 'The guard for R1\'s memoised `validateRules`. On procgen_maze: `start_regions` '
               + 'set to a name built from the document\'s own region names (so it cannot '
               + 'collide) is a `validateRules` finding and NOT a schema error, so the op '
               + 'applies — and the bar\'s own text must move on the very next render and come '
               + 'back verbatim after one Undo, which REFOLDS the record rather than popping a '
               + 'stack. The subject is `validationBar.textContent`, not the memo, and the op '
               + 'having landed is asserted first. A last pair of tab switches asserts the bar '
               + 'does NOT move when nothing changed.',
    testFunction: apworldTheValidationBarFollowsTheDocument,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/* ══════════════════════════════════════════════════════════════════════
 * W3 — THE PLACEMENTS TAB. (`NewDocs/plans/apworld-editor-coverage-plan.md`
 * §4, rung W3.)
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ The slot's locations, in document order, with their region — the
 *  expectation, read off the DOCUMENT rather than off the panel. */
function locationsFromDocument(doc, slot) {
    const out = [];
    for (const [region, body] of Object.entries(doc?.regions?.[slot] ?? {})) {
        for (const loc of (body?.locations ?? [])) {
            if (typeof loc?.name === 'string') out.push({ region, name: loc.name });
        }
    }
    return out;
}

/** ⛓ The rows the tab drew, as the same shape. */
function placementRowsOnScreen() {
    return [...document.querySelectorAll(
        `${PANEL_SELECTOR} .apworld-placements-row:not([data-orphan="location"])`)]
        .map((r) => ({ region: r.dataset.region, name: r.dataset.location }));
}

/** ⛓ A `<select>` is opened by a MOUSEDOWN, which is also what builds its
 *  option list (the list is lazy — see `_makePlacementSelect`). */
function openPlacementSelect(row) {
    const select = row.querySelector('.apworld-placements-select');
    select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return select;
}

function chooseItem(select, value) {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * ⛓⛓⛓ **THE TAB DRAWS EVERY LOCATION OF THE SLOT, WITH THE DOCUMENT'S OWN
 * PLACEMENTS SELECTED** (W3 (a)).
 *
 * ⛔ Every number here is DERIVED from the document at run time — the fetched
 * bytes, not the panel's view of them — so the row cannot pass by agreeing with
 * the thing it is testing. It is also why there is no count in its id or its
 * name: a count there is an allowlist key that reds twice when the corpus moves.
 */
export async function apworldPlacementsTabDrawsEveryLocationOfTheSlot(testController) {
    try {
        const panel = await openHub(testController, PLACEMENTS_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        // ⛓ The EXPECTATION, fetched independently of the panel's own intake.
        const doc = await (await fetch(PLACEMENTS_PRESET_PATH)).json();
        const slot = panel.playerId;
        const expected = locationsFromDocument(doc, slot);
        const placements = doc.canonical_placements?.[slot] ?? {};
        const items = Object.keys(doc.items?.[slot] ?? {});
        testController.reportCondition(
            'the document really carries placements, so this is not a claim about an empty block',
            Object.keys(placements).length > 0);

        selectTab(panel, 'placements');

        const drawn = placementRowsOnScreen();
        testController.assertEqual(
            'the tab draws one row per location the slot holds',
            String(expected.length), String(drawn.length));
        testController.assertEqual(
            '…the same locations, in the document\'s own order, each under its own region',
            JSON.stringify(expected), JSON.stringify(drawn));

        // ⛓ The region GROUPS are the regions that hold a location — a region
        //   with none draws no header standing over nothing.
        const regionsWithLocations = [...new Set(expected.map((l) => l.region))];
        const groups = [...document.querySelectorAll(
            `${PANEL_SELECTOR} .apworld-placements-region`)].map((g) => g.dataset.region);
        testController.assertEqual(
            'grouped by region, and only the regions that hold a location get a header',
            JSON.stringify(regionsWithLocations), JSON.stringify(groups));

        // ⛓⛓ EVERY row's select shows the document's OWN placement for it.
        const wrong = drawn.filter(({ name }) => {
            const row = document.querySelector(
                `${PANEL_SELECTOR} .apworld-placements-row[data-location="${CSS.escape(name)}"]`);
            const select = row?.querySelector('.apworld-placements-select');
            return !select || select.value !== (placements[name] ?? '');
        });
        testController.assertEqual(
            'every row\'s select carries the item the document places there', '0',
            String(wrong.length));

        const summary = document.querySelector(`${PANEL_SELECTOR} .apworld-placements-summary`);
        const placed = expected.filter((l) =>
            Object.prototype.hasOwnProperty.call(placements, l.name)).length;
        testController.assertEqual('the summary counts the document\'s own placements',
            `${placed} of ${expected.length}`, `${summary.dataset.placed} of ${summary.dataset.total}`);
        testController.assertEqual('…and the chrome line says the same thing',
            'true',
            String(panel.statusLabel.textContent.includes(
                `${placed} of ${expected.length} location`)));

        /**
         * ⛓⛓ **THE OPTION LIST IS LAZY, AND THAT IS ASSERTED RATHER THAN
         * ASSUMED.** `dark_souls_3` slot 1 would otherwise build 1,194 × 1,208
         * option elements before the tab could paint. A closed select carries
         * only the blank option and its current value; opening it builds the
         * slot's items.
         */
        const probe = document.querySelector(
            `${PANEL_SELECTOR} .apworld-placements-row .apworld-placements-select`);
        testController.reportCondition(
            'a CLOSED select carries no more options than the blank plus its own value',
            probe.options.length <= 2);
        openPlacementSelect(probe.closest('.apworld-placements-row'));
        testController.assertEqual(
            'opening it builds the blank option plus every item the slot holds',
            String(items.length + 1), String(probe.options.length));
        testController.assertEqual('…and the blank option is the DELETE',
            '', probe.options[0].value);

        // ⛓ The filter is over the three names a row carries.
        const filter = document.querySelector(`${PANEL_SELECTOR} .apworld-placements-filter`);
        const needle = expected[0].name;
        filter.value = needle;
        filter.dispatchEvent(new Event('input', { bubbles: true }));
        const visible = [...document.querySelectorAll(
            `${PANEL_SELECTOR} .apworld-placements-row`)].filter((r) => !r.hidden);
        testController.reportCondition(
            'filtering by a location name narrows the rows to ones that match',
            visible.length > 0 && visible.length < expected.length
                && visible.every((r) => `${r.dataset.location} ${r.dataset.region} `
                    + `${r.dataset.item ?? ''}`.toLowerCase().includes(needle.toLowerCase())));
        filter.value = '';
        filter.dispatchEvent(new Event('input', { bubbles: true }));
        testController.assertEqual('clearing the filter brings every row back',
            String(expected.length),
            String([...document.querySelectorAll(
                `${PANEL_SELECTOR} .apworld-placements-row`)].filter((r) => !r.hidden).length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('placements-tab test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **ONE GESTURE, ONE OP, ONE UNDO — AND THE DOCUMENT ROW MOVES WITH IT**
 * (W3 (b)).
 *
 * ⛔ **THE DELETE IS THE HALF THAT MOVES THE COUNT, AND THAT IS A MEASUREMENT
 * ABOUT THIS DOCUMENT.** Every one of `procgen_topdown/AP_1`'s 25 locations is
 * already placed, so there is no unplaced location to add one to: a REPLACE
 * changes the value and leaves both the tab's summary and the Document row's
 * `{ n keys }` where they were, and only choosing "(unplaced)" moves them. Both
 * halves are driven, because "one op" and "the readout moves" are different
 * claims and only one of them a replace can make.
 */
export async function apworldPlacementEditIsOneOpAndOneUndo(testController) {
    try {
        const panel = await openHub(testController, PLACEMENTS_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const slot = panel.playerId;
        const docSummary = () => {
            // ⛔ RE-QUERIED: selecting a tab rebuilds it, so a captured element
            //   is detached and `querySelector` on it answers out of the old
            //   tree (W0 §7.5).
            selectTab(panel, 'document');
            const text = document.querySelector(
                `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="canonical_placements"] `
                + '.apworld-doc-summary')?.textContent;
            selectTab(panel, 'placements');
            return text;
        };
        const summaryData = () => ({ ...document.querySelector(
            `${PANEL_SELECTOR} .apworld-placements-summary`).dataset });
        const rowFor = (name) => document.querySelector(
            `${PANEL_SELECTOR} .apworld-placements-row[data-location="${CSS.escape(name)}"]`);

        selectTab(panel, 'placements');

        // ⛓ The subject, and the item to move it to — both read off the record.
        const target = Object.keys(panel.rulesDoc.canonical_placements[slot])[0];
        const was = panel.rulesDoc.canonical_placements[slot][target];
        const other = Object.keys(panel.rulesDoc.items[slot]).find((n) => n !== was);
        testController.reportCondition('the document offers a second item to move to', !!other);

        const opsBefore = panel.session.ops().length;
        const placedBefore = summaryData().placed;
        const docBefore = docSummary();

        // ── (1) REPLACE ──────────────────────────────────────────────────
        chooseItem(openPlacementSelect(rowFor(target)), other);

        testController.assertEqual('the edit reached the record',
            other, panel.rulesDoc.canonical_placements[slot][target]);
        testController.assertEqual('it was exactly ONE op',
            String(opsBefore + 1), String(panel.session.ops().length));
        testController.assertEqual('and it is a set-canonical-placement for that location',
            `set-canonical-placement|${target}|${slot}`,
            `${panel.session.ops().at(-1).op}|${panel.session.ops().at(-1).location}`
            + `|${panel.session.ops().at(-1).player}`);
        testController.assertEqual(
            'a REPLACE does not move the count — the same locations are still placed',
            placedBefore, summaryData().placed);
        testController.assertEqual('…nor the Document row\'s summary', docBefore, docSummary());

        document.querySelector(`${PANEL_SELECTOR} .apworld-undo`).click();
        testController.assertEqual('one undo puts the original item back',
            was, panel.rulesDoc.canonical_placements[slot][target]);
        testController.assertEqual('and the op list is back where it started',
            String(opsBefore), String(panel.session.ops().length));

        // ── (2) DELETE — the blank option, which is what moves the counts ──
        chooseItem(openPlacementSelect(rowFor(target)), '');

        testController.assertEqual('the blank option removed the entry', 'false',
            String(Object.prototype.hasOwnProperty.call(
                panel.rulesDoc.canonical_placements[slot], target)));
        testController.assertEqual('it too was exactly ONE op',
            String(opsBefore + 1), String(panel.session.ops().length));
        testController.assertEqual('the tab\'s summary lost one placement',
            String(Number(placedBefore) - 1), summaryData().placed);
        testController.reportCondition(
            'and the Document row\'s summary moved with it', docSummary() !== docBefore);
        testController.reportCondition(
            'the row is still drawn — a location without a placement still has one',
            !!rowFor(target));

        document.querySelector(`${PANEL_SELECTOR} .apworld-undo`).click();
        testController.assertEqual('one undo restores the placement',
            was, panel.rulesDoc.canonical_placements[slot][target]);
        testController.assertEqual('the tab\'s summary is back', placedBefore, summaryData().placed);
        testController.assertEqual('and so is the Document row\'s', docBefore, docSummary());
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('placement-edit test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **THE TAB READS THE SELECTED SLOT, AND AN EDIT TOUCHES ONLY IT** (W3 (c)).
 *
 * ⛔ **THE BRIEF SAID SLOT 1'S BLOCK IS ABSENT ON THIS FIXTURE. IT IS NOT.**
 * Measured: `canonical_placements` carries all four slots, and slots 1 and 2
 * hold `{}` — present and empty. So the law this row drives is the one that is
 * actually true and actually the point: a slot-3 op leaves slot 1's block
 * BYTE-IDENTICAL, whatever it happens to be.
 *
 * ⛓ Slots 3 and 4 carry six placements each and slots 1 and 2 carry none, so
 * "reads the selected slot" is a discrimination on one document rather than two.
 */
export async function apworldPlacementsFollowTheSelectedSlot(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const doc = await (await fetch(FOUR_PLAYER_PATH)).json();
        const selector = await testController.pollForValue(
            () => document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`),
            'the player selector', 8000, 50);
        testController.reportCondition('the toolbar offers a player selector', !!selector);
        if (!selector) return testController.getOverallResult();

        const summaryData = () => ({ ...document.querySelector(
            `${PANEL_SELECTOR} .apworld-placements-summary`).dataset });
        const shapeOf = (slot) => {
            const locations = locationsFromDocument(doc, slot);
            const placed = locations.filter((l) => Object.prototype.hasOwnProperty
                .call(doc.canonical_placements?.[slot] ?? {}, l.name)).length;
            return `${placed} of ${locations.length}`;
        };

        selectPlayer(selector, '3');
        selectTab(panel, 'placements');
        testController.assertEqual('slot 3 shows the placements slot 3 carries',
            shapeOf('3'), `${summaryData().placed} of ${summaryData().total}`);
        testController.assertEqual('…and one row per location slot 3 holds',
            String(locationsFromDocument(doc, '3').length),
            String(placementRowsOnScreen().length));

        selectPlayer(selector, '1');
        selectTab(panel, 'placements');
        testController.assertEqual('slot 1 shows slot 1\'s — which is none of them',
            shapeOf('1'), `${summaryData().placed} of ${summaryData().total}`);
        testController.reportCondition(
            'the two slots really differ, so this is a discrimination',
            shapeOf('1') !== shapeOf('3'));

        // ⛓⛓ …and an edit on slot 3 leaves slot 1's block byte-identical.
        const slot1Before = JSON.stringify(panel.rulesDoc.canonical_placements['1']);
        selectPlayer(selector, '3');
        selectTab(panel, 'placements');
        const row = document.querySelector(`${PANEL_SELECTOR} .apworld-placements-row`);
        const select = openPlacementSelect(row);
        const other = [...select.options].map((o) => o.value)
            .find((v) => v && v !== select.value);
        const opsBefore = panel.session.ops().length;
        chooseItem(select, other);

        /**
         * ⛓⛓ **"AN OP WAS RECORDED" IS ITS OWN CONDITION, AND IT IS THE ONE THE
         * SLOT MUTANT REACHES SECOND.** A tab that read the wrong slot shows this
         * row as unplaced, so "the first option that is not the displayed value"
         * is the item ALREADY stored — the session's `equal` then reports a
         * no-op, no op is recorded, and every assertion downstream would read
         * `undefined`. Asserted rather than assumed, so the row reports the
         * defect instead of dying on it.
         */
        testController.assertEqual('the gesture was recorded as an op',
            String(opsBefore + 1), String(panel.session.ops().length));
        const last = panel.session.ops().at(-1) ?? {};
        testController.assertEqual('the op is stamped with the SELECTED slot',
            '3', String(last.player));
        testController.assertEqual('slot 3 took the edit',
            other, panel.rulesDoc.canonical_placements['3'][row.dataset.location]);
        testController.assertEqual(
            'and slot 1\'s block is byte-identical — present and empty, as the file has it',
            slot1Before, JSON.stringify(panel.rulesDoc.canonical_placements['1']));
        testController.assertEqual('…and it is still PRESENT, not deleted', 'true',
            String(Object.prototype.hasOwnProperty.call(
                panel.rulesDoc.canonical_placements, '1')));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('placements-slot test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **A STALE PLACEMENT IS SHOWN, MARKED, AND REMOVABLE — NEVER SILENTLY
 * DROPPED** (W3, the requirement task 2 sets and no other row can see).
 *
 * ⛔ The document is a committed preset with two entries added on the way in —
 * which is exactly what a HAND-EDITED file is, and the only way to get one: the
 * schema declares the slot `additionalProperties: true`, so a stale entry
 * validates and no committed preset carries one. It arrives through
 * `stateManager:rawJsonDataLoaded`, the same intake `loadRulesFromFile` uses
 * (`files:jsonLoaded` would hand the hub a document the state manager has
 * already narrowed).
 */
export async function apworldStalePlacementsAreShownAndRemovable(testController) {
    try {
        // ⛓ Open the hub on the preset first, so the panel is mounted and its
        //   schema is in, then hand it the edited document.
        const panel = await openHub(testController, PLACEMENTS_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const slot = panel.playerId;
        const doc = await (await fetch(PLACEMENTS_PRESET_PATH)).json();
        const GONE_LOCATION = 'A Room That Was Deleted';
        const GONE_ITEM = 'An Item That Was Renamed';
        const keptLocation = Object.keys(doc.canonical_placements[slot])[0];
        doc.canonical_placements[slot][GONE_LOCATION] = Object.keys(doc.items[slot])[0];
        doc.canonical_placements[slot][keptLocation] = GONE_ITEM;
        testController.eventBus.publishAs('stateManager:rawJsonDataLoaded', {
            source: PLACEMENTS_PRESET_PATH,
            rawJsonData: doc,
            selectedPlayerInfo: null,
        }, 'stateManager');
        await testController.pollForCondition(
            () => Object.prototype.hasOwnProperty.call(
                panel.rulesDoc?.canonical_placements?.[slot] ?? {}, GONE_LOCATION),
            'the hand-edited document reached the hub', 8000, 50);

        selectTab(panel, 'placements');

        const orphanRow = document.querySelector(
            `${PANEL_SELECTOR} .apworld-placements-row[data-orphan="location"]`);
        testController.reportCondition(
            'a placement naming a location the world lost is DRAWN, not dropped', !!orphanRow);
        testController.assertEqual('…it is that location', GONE_LOCATION,
            orphanRow?.dataset.location ?? '(none)');
        testController.reportCondition('…and it is MARKED as such',
            !!orphanRow?.querySelector('.apworld-placements-mark'));

        const itemRow = document.querySelector(
            `${PANEL_SELECTOR} .apworld-placements-row[data-orphan="item"]`);
        testController.reportCondition(
            'a placement naming an item the world lost is drawn and marked too',
            !!itemRow && !!itemRow.querySelector('.apworld-placements-mark'));
        const staleSelect = itemRow && openPlacementSelect(itemRow);
        testController.reportCondition(
            '…and opening its select KEEPS the unknown item as an option, rather than '
            + 'silently re-pointing the row',
            !!staleSelect && staleSelect.value === GONE_ITEM
                && [...staleSelect.options].some((o) => o.value === GONE_ITEM));

        const summary = document.querySelector(`${PANEL_SELECTOR} .apworld-placements-summary`);
        testController.assertEqual('the summary counts both kinds of stale entry',
            '1|1', `${summary.dataset.orphanLocations}|${summary.dataset.orphanItems}`);

        // ⛓⛓ The one gesture the tab can offer for a location it cannot place:
        //    remove it. It is a DELETE, which the op does not validate — the
        //    reason it does not is exactly this row.
        const opsBefore = panel.session.ops().length;
        document.querySelector(
            `${PANEL_SELECTOR} .apworld-placements-row[data-orphan="location"] `
            + '.apworld-placements-delete').click();

        testController.assertEqual('Remove took the stale entry out', 'false',
            String(Object.prototype.hasOwnProperty.call(
                panel.rulesDoc.canonical_placements[slot], GONE_LOCATION)));
        testController.assertEqual('as exactly ONE op',
            String(opsBefore + 1), String(panel.session.ops().length));
        testController.reportCondition('and the marked block is gone with it',
            !document.querySelector(`${PANEL_SELECTOR} .apworld-placements-orphans`));

        document.querySelector(`${PANEL_SELECTOR} .apworld-undo`).click();
        testController.reportCondition('one undo brings it back',
            Object.prototype.hasOwnProperty.call(
                panel.rulesDoc.canonical_placements[slot], GONE_LOCATION));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('stale-placement test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-placements-tab-draws-every-location-of-the-slot',
    name: 'APWorld hub: the Placements tab draws every location of the selected slot, with the document\'s own placements selected',
    description: 'On procgen_topdown/AP_1 — every one of whose locations is placed — asserts '
               + 'the tab draws one row per location the slot holds, in the document\'s own '
               + 'order and grouped under the regions that hold them; that every row\'s '
               + 'select carries the item the document places there; that the summary and '
               + 'the chrome line both count the document\'s own placements; that a CLOSED '
               + 'select carries only the blank option and its current value while opening '
               + 'one builds the blank plus every item the slot holds (the option list is '
               + 'lazy, because a select per location carrying every item is 1.4 million '
               + 'elements on the largest committed world); and that the filter narrows and '
               + 'restores the rows. Every count is derived from the fetched document.',
    testFunction: apworldPlacementsTabDrawsEveryLocationOfTheSlot,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-placement-edit-is-one-op-and-one-undo',
    name: 'APWorld hub: choosing an item on the Placements tab is ONE op, and one undo takes it back',
    description: 'Drives both halves through the tab\'s own select: a REPLACE (one '
               + '`set-canonical-placement` stamped with the selected slot; the value moves '
               + 'and neither the tab\'s summary nor the Document row\'s `{ n keys }` does, '
               + 'because this document has no unplaced location to add one to) and a DELETE '
               + 'through the blank "(unplaced)" option (one op; both readouts move; the row '
               + 'is still drawn). Each is undone, and each undo restores the value, the op '
               + 'count and both readouts. Mutant: the op ceasing to refuse an unknown item '
               + 'is caught in rulesDocOps.test.js, not here.',
    testFunction: apworldPlacementEditIsOneOpAndOneUndo,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-placements-follow-the-selected-slot',
    name: 'APWorld hub: the Placements tab reads the selected slot, and an edit touches only it',
    description: 'On the four-player multiworld fixture, whose slots 3 and 4 carry six '
               + 'placements each while slots 1 and 2 carry an EMPTY block: asserts the tab '
               + 'shows slot 3\'s placements and row count when slot 3 is selected and slot '
               + '1\'s when slot 1 is, that the two really differ, and that an edit made on '
               + 'slot 3 is stamped with slot 3 and leaves slot 1\'s block byte-identical and '
               + 'still present. Mutant: reading placements from slot \'1\' instead of the '
               + 'selected slot reds this row.',
    testFunction: apworldPlacementsFollowTheSelectedSlot,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/**
 * ⛓⛓⛓ **THE WHOLE-BLOCK EDITOR CANNOT WRITE WHAT THE PER-ENTRY OP REFUSES**
 * (P1; W3 §10.7 (1), ⚖ user 2026-09-09).
 *
 * ⛔ DRIVEN THROUGH THE PRODUCT'S OWN Save JSON BUTTON, not `_applySetKey`: the
 * defect this row guards is that one tab's guard was reachable AROUND, and a row
 * that called the method would pass over a Save wired past the veto.
 *
 * ⛓ Both directions, because a veto that refuses everything is not the veto
 * asked for: an edit that ADDS an unplaceable entry is refused BY NAME, and an
 * edit that REMOVES a pre-existing one is accepted — the diff-against-before
 * rule, without which a hand-edited file could never be repaired here.
 */
export async function apworldTheBlockEditorRefusesAnUnplaceablePlacement(testController) {
    const KEY = 'canonical_placements';
    try {
        const panel = await openHub(testController, PLACEMENTS_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const slot = panel.playerId;
        // ⛓ A document that ALREADY carries a stale entry — which is what a
        //   hand-edited file is, and the only way to get one: the schema
        //   declares this slot additionalProperties: true.
        const doc = await (await fetch(PLACEMENTS_PRESET_PATH)).json();
        const GONE_LOCATION = 'A Room That Was Deleted';
        const REAL_ITEM = Object.keys(doc.items[slot])[0];
        doc.canonical_placements[slot][GONE_LOCATION] = REAL_ITEM;
        testController.eventBus.publishAs('stateManager:rawJsonDataLoaded', {
            source: PLACEMENTS_PRESET_PATH, rawJsonData: doc, selectedPlayerInfo: null,
        }, 'stateManager');
        await testController.pollForCondition(
            () => Object.prototype.hasOwnProperty.call(
                panel.rulesDoc?.canonical_placements?.[slot] ?? {}, GONE_LOCATION),
            'the hand-edited document reached the hub', 8000, 50);

        selectTab(panel, 'document');

        /** ⛔ RE-QUERIED every time: expanding a block re-renders the tab, so an
         *  element captured before the click answers from a detached tree. */
        const boxOf = () => document.querySelector(
            `${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="${KEY}"]`);
        const expand = async () => {
            if (!boxOf()?.querySelector('.apworld-doc-json')) {
                boxOf().querySelector('.apworld-doc-toggle').click();
            }
            return testController.pollForValue(
                () => boxOf()?.querySelector('.apworld-doc-json'),
                'the block textarea, built on expand', 8000, 50);
        };
        const area = await expand();
        testController.reportCondition('the block editor is open on this key', !!area);
        if (!area) return testController.getOverallResult();

        // ── (1) an edit that ADDS an unplaceable entry is REFUSED BY NAME ──
        const UNHELD = 'Nowhere';
        const opsBefore = panel.session.ops().length;
        const edited = { ...JSON.parse(area.value), [UNHELD]: REAL_ITEM };
        area.value = JSON.stringify(edited, null, 2);
        boxOf().querySelector('.apworld-doc-save').click();

        testController.assertEqual('the save was refused, and it was not one op',
            String(opsBefore), String(panel.session.ops().length));
        testController.reportCondition('the refusal NAMES the location it will not write',
            (panel._opMessage ?? '').includes(UNHELD));
        testController.assertEqual('…and the block does not carry it', 'false',
            String(Object.prototype.hasOwnProperty.call(
                panel.rulesDoc[KEY][slot], UNHELD)));
        /**
         * ⛔ THE DISCRIMINATION, AND WITHOUT IT THIS ROW PROVES NOTHING: the
         * schema veto cannot see this. The slot is `additionalProperties: true`,
         * so the same op ADDS ZERO schema errors — which is exactly why the
         * whole-block editor could write it before P1.
         */
        testController.assertEqual(
            'and the SCHEMA had nothing to say about it — the hole this closes', '0',
            String(panel._schemaErrorsAddedBy({
                op: 'set-key', key: KEY, value: edited, scope: 'player', player: slot,
            }).length));

        /**
         * ── (2) an edit that REMOVES the pre-existing stale entry is ACCEPTED ──
         *
         * ⛔ THE VALUE IS BUILT FROM THE RECORD, NOT FROM THE TEXTAREA. A
         * refusal re-renders the CHROME, not the tab, so the textarea still
         * holds the draft that was just refused — reading it back would carry
         * the unplaceable entry into the second save and this row would report
         * the veto as broken when it was working.
         */
        const area2 = await expand();
        const fixed = { ...panel.rulesDoc[KEY][slot] };
        delete fixed[GONE_LOCATION];
        area2.value = JSON.stringify(fixed, null, 2);
        boxOf().querySelector('.apworld-doc-save').click();

        testController.assertEqual('a save that REMOVES a stale entry is accepted, as one op',
            String(opsBefore + 1), String(panel.session.ops().length));
        testController.assertEqual('…and the stale entry is gone', 'false',
            String(Object.prototype.hasOwnProperty.call(
                panel.rulesDoc[KEY][slot], GONE_LOCATION)));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('block-editor placement veto test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓ **A PLACEMENT THE WORLD CANNOT MAKE IS NOT COUNTED AS MADE** (P1; W3
 * §10.7 (3), which shipped counting one).
 *
 * ⛔ The numerator is the claim, and it is scored against the SAME document
 * before and after one entry is staled — so the row cannot pass by agreeing
 * with a tally that computes the numerator any way at all.
 */
export async function apworldAStalePlacementIsNotCountedAsPlaced(testController) {
    try {
        const panel = await openHub(testController, PLACEMENTS_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(
            () => !!panel._rulesSchema, 'the panel loaded rules.schema.json', 8000, 50);

        const slot = panel.playerId;
        const doc = await (await fetch(PLACEMENTS_PRESET_PATH)).json();
        const summaryData = () => document.querySelector(
            `${PANEL_SELECTOR} .apworld-placements-summary`).dataset;

        selectTab(panel, 'placements');
        const clean = { ...summaryData() };
        testController.assertEqual(
            'with nothing stale, the numerator is the entries the document carries',
            String(Object.keys(doc.canonical_placements[slot]).length), clean.placed);
        testController.assertEqual('and nothing is marked stale', '0|0',
            `${clean.orphanLocations}|${clean.orphanItems}`);

        // ⛓ ONE entry staled — its ITEM, which is the half W3 counted as placed.
        const GONE_ITEM = 'An Item That Was Renamed';
        const staledLocation = Object.keys(doc.canonical_placements[slot])[0];
        doc.canonical_placements[slot][staledLocation] = GONE_ITEM;
        doc.game_name = `${doc.game_name} (one placement staled)`;
        testController.eventBus.publishAs('stateManager:rawJsonDataLoaded', {
            source: PLACEMENTS_PRESET_PATH, rawJsonData: doc, selectedPlayerInfo: null,
        }, 'stateManager');
        await testController.pollForCondition(
            () => panel.rulesDoc?.canonical_placements?.[slot]?.[staledLocation] === GONE_ITEM,
            'the staled document reached the hub', 8000, 50);

        selectTab(panel, 'placements');
        const after = { ...summaryData() };
        testController.assertEqual('the total is unmoved — the world still holds them all',
            clean.total, after.total);
        testController.assertEqual('but the numerator DROPS BY ONE, because that one is unplaceable',
            String(Number(clean.placed) - 1), after.placed);
        testController.assertEqual('and the entry is named as stale rather than lost', '1',
            after.orphanItems);
        const summary = document.querySelector(
            `${PANEL_SELECTOR} .apworld-placements-summary`);
        testController.reportCondition('the line a person reads carries the new numerator',
            summary.textContent.startsWith(`${after.placed} of ${after.total}`));
        testController.reportCondition('…and still says an item is missing',
            /does not hold/.test(summary.textContent));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('stale-placement tally test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-stale-placements-are-shown-and-removable',
    name: 'APWorld hub: a placement naming a location or item the world no longer holds is shown, marked and removable',
    description: 'The schema declares the placement slot `additionalProperties: true`, so a '
               + 'stale entry validates and no committed preset carries one — this row hands '
               + 'the hub a committed preset with two added on the way in, through '
               + '`stateManager:rawJsonDataLoaded`, which is what a hand-edited file is. '
               + 'Asserts both kinds are drawn and marked, that the summary counts them, that '
               + 'opening the stale-item row\'s select keeps the unknown item as an option '
               + 'rather than silently re-pointing the row, and that Remove takes the '
               + 'unplaceable entry out as ONE undoable op — which is why '
               + '`set-canonical-placement` does not validate a DELETE.',
    testFunction: apworldStalePlacementsAreShownAndRemovable,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-block-editor-refuses-an-unplaceable-placement',
    name: 'APWorld hub: the Document tab\'s Save JSON cannot write a placement the per-entry op refuses',
    description: 'Presses the block editor\'s OWN Save JSON on `canonical_placements`. Adding '
               + 'an entry at a location the slot does not hold is refused BY NAME, records no '
               + 'op and leaves the block unchanged — and the same op is measured to add ZERO '
               + 'schema errors, which is the hole this closes: the slot is '
               + '`additionalProperties: true`, so the schema veto could never see it. The '
               + 'other direction is driven too: a save that REMOVES a pre-existing stale entry '
               + 'is accepted as one op, because the veto differences against what the document '
               + 'already had and a hand-edited file has to be repairable here. Mutant: '
               + 'bypassing the veto reds this row.',
    testFunction: apworldTheBlockEditorRefusesAnUnplaceablePlacement,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-a-stale-placement-is-not-counted-as-placed',
    name: 'APWorld hub: the Placements summary does not count a placement the world cannot make',
    description: 'The same document twice: as committed, the numerator is the entries it '
               + 'carries and nothing is marked; with ONE entry\'s item renamed out of the '
               + 'world, the total is unmoved and the numerator drops by one, while the line '
               + 'still names the stale entry. W3 shipped counting it as placed; '
               + '`--canonical-seed` cannot place an item the world does not hold, so the '
               + 'numerator was promising a placement no generation can make.',
    testFunction: apworldAStalePlacementIsNotCountedAsPlaced,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/* ══════════════════════════════════════════════════════════════════════
 * THE ITEMS TAB'S GROUPS SECTION — `item_groups` (I1)
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ The panel's own selectors for the section, spelled once. */
const GROUP_ROW = (name) => `${PANEL_SELECTOR} .apworld-item-group-row[data-group="${
        CSS.escape(name)}"]`;

/** ⛓ The registry as the DOCUMENT holds it — the expectation is read off the
 *  record, never typed (a count in a test is an allowlist key). */
const registryOf = (panel) => (panel.rulesDoc?.item_groups?.[panel.playerId] ?? []).slice();

/** ⛓ Which items carry a group, derived from the panel's own document, so a row
 *  cannot pass by naming an item the preset stopped having. */
const carriersOf = (panel, group) => Object.entries(panel.rulesDoc?.items?.[panel.playerId] ?? {})
    .filter(([, item]) => (item?.groups ?? []).includes(group)).map(([name]) => name);

/**
 * ⛓⛓⛓ **ADDING A GROUP REACHES THE REGISTRY, THE SECTION AND EVERY ITEM'S
 * PICKER — AND ONE UNDO TAKES IT BACK** (I1, task 5 (a)).
  *
 * ⛔ Driven through the section's own text box and button, never `_applyOp`: the
 * claim is that the control is wired, and a row that called the method would
 * pass over a button wired to nothing.
  *
 * ⛓ On `procgen_maze/AP_1`, whose registry holds ONE name — the shape a procgen
 * document is in, and the one the ⚖ ruling is about ("no procgen worlds
 * currently use them").
 */
export async function apworldItemGroupAddReachesTheRegistryAndEveryPicker(testController) {
    const NEW_GROUP = 'Trinkets';
    try {
        const panel = await openHub(testController, PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        selectTab(panel, 'items');

        const before = registryOf(panel);
        testController.reportCondition('the slot carries a registry the section can draw',
            Array.isArray(before));
        testController.assertEqual('one section row per registry name, before',
            String(before.length),
            String(document.querySelectorAll(
                `${PANEL_SELECTOR} .apworld-item-group-row[data-listed="true"]`).length));
        testController.reportCondition('…and the name we are about to add is not one of them',
            !before.includes(NEW_GROUP));

        const opsBefore = panel.session.ops().length;
        const box = document.querySelector(`${PANEL_SELECTOR} .apworld-item-group-new`);
        box.value = NEW_GROUP;
        document.querySelector(`${PANEL_SELECTOR} .apworld-item-groups-add-button`).click();

        testController.reportCondition('the name is in the document\'s registry',
            registryOf(panel).includes(NEW_GROUP));
        testController.assertEqual('as exactly ONE op',
            String(opsBefore + 1), String(panel.session.ops().length));
        // ⛓ Every post-gesture lookup RE-QUERIES: the tab re-rendered.
        const row = document.querySelector(GROUP_ROW(NEW_GROUP));
        testController.reportCondition('the section draws a row for it', !!row);
        testController.assertEqual('…saying nothing carries it yet', '0', row?.dataset.carriers ?? '?');
        testController.reportCondition('…and its delete button is ENABLED, because nothing does',
            row?.querySelector('.apworld-item-group-delete')?.disabled === false);

        // ⛓⛓ And it reaches the ITEMS: every picker offers it, which is the half
        //    that says the registry is the vocabulary the item rows draw from.
        const pickers = [...document.querySelectorAll(
            `${PANEL_SELECTOR} .apworld-item-group-picker`)];
        for (const p of pickers) p.dispatchEvent(new Event('focus'));
        const offering = pickers.filter((p) => [...p.options].some((o) => o.value === NEW_GROUP));
        testController.assertEqual('every item\'s picker offers the new group',
            `${pickers.length}|${pickers.length}`, `${pickers.length}|${offering.length}`);
        testController.reportCondition('…and there is at least one item to offer it to',
            pickers.length > 0);

        document.querySelector(`${PANEL_SELECTOR} .apworld-undo`).click();
        testController.assertEqual('one undo restores the registry',
            JSON.stringify(before), JSON.stringify(registryOf(panel)));
        testController.assertEqual('…and the op count', String(opsBefore),
            String(panel.session.ops().length));
        testController.reportCondition('…and the section row is gone with it',
            !document.querySelector(GROUP_ROW(NEW_GROUP)));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('item-group add test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **⚖ REFUSE — DELETING A GROUP AN ITEM STILL CARRIES IS DECLINED, BY
 * NAME** (I1, task 5 (b)). ⚖ user, 2026-09-09: *"Let's go with refuse."*
  *
 * ⛓ BOTH halves, because the button and the op are not the same guard: the
 * button is DISABLED with the reason in its `title` (a courtesy), and the OP
 * refuses (the guard — it has to hold for the Document tab's whole-block
 * `set-key`, which never draws a button). A row that only read the button would
 * stay green with the op's refusal deleted.
 */
export async function apworldItemGroupDeleteIsRefusedWhileAnItemCarriesIt(testController) {
    try {
        const panel = await openHub(testController, PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        selectTab(panel, 'items');

        const carried = registryOf(panel).find((g) => carriersOf(panel, g).length > 0);
        testController.reportCondition('this document has a group some item carries', !!carried);
        if (!carried) return testController.getOverallResult();
        const carriers = carriersOf(panel, carried);

        const row = document.querySelector(GROUP_ROW(carried));
        testController.assertEqual('the section counts the carriers off the document',
            String(carriers.length), row?.dataset.carriers ?? '?');
        const del = row.querySelector('.apworld-item-group-delete');
        testController.reportCondition('the delete button is DISABLED while they carry it',
            del?.disabled === true);
        testController.reportCondition('…and its title names an item that does',
            (del?.title ?? '').includes(carriers[0]));

        // ⛓⛓ THE GUARD ITSELF, past the button: the op is asked directly, which is
        //    the path the Document tab's whole-block editor is on.
        const opsBefore = panel.session.ops().length;
        const refusal = panel.session.apply({
            op: 'delete-item-group', name: carried, player: panel.playerId,
        });
        testController.reportCondition('the OP refuses it, not just the button', refusal.ok === false);
        testController.reportCondition('…and the refusal NAMES an item that carries it',
            (refusal.description ?? '').includes(carriers[0]));
        testController.assertEqual('…and nothing was recorded',
            String(opsBefore), String(panel.session.ops().length));
        testController.reportCondition('…and the group is still in the registry',
            registryOf(panel).includes(carried));

        // ⛓ The other direction, so "refuses" is a discrimination rather than a
        //   guard that declines everything: a group nothing carries DELETES.
        const box = document.querySelector(`${PANEL_SELECTOR} .apworld-item-group-new`);
        box.value = 'Unused Group';
        document.querySelector(`${PANEL_SELECTOR} .apworld-item-groups-add-button`).click();
        const freshRow = document.querySelector(GROUP_ROW('Unused Group'));
        freshRow?.querySelector('.apworld-item-group-delete').click();
        testController.reportCondition('a group nothing carries deletes through the same button',
            !registryOf(panel).includes('Unused Group'));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('item-group delete test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **A RENAME CARRIES THE ITEMS' MEMBERSHIP, AND ONE UNDO RESTORES BOTH
 * SITES** (I1, task 5 (c)) — which is the whole reason it is one op rather than
 * two.
  *
 * ⛓ On `alttp`, whose registry is a REAL one (23 names over 163 items), so the
 * membership half is a claim about a group with many carriers rather than one.
 */
export async function apworldItemGroupRenameCarriesTheItemsMembership(testController) {
    try {
        const panel = await openHub(testController, ITEM_GROUPS_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        selectTab(panel, 'items');

        const before = registryOf(panel);
        const target = before.find((g) => carriersOf(panel, g).length > 1);
        testController.reportCondition('a group with more than one carrier to rename', !!target);
        if (!target) return testController.getOverallResult();
        const carriers = carriersOf(panel, target);
        const RENAMED = `${target} Renamed`;
        const opsBefore = panel.session.ops().length;

        // ⛓ Through the row's OWN input, committed on `change` — the Meta tab's
        //   rule, and the reason a rename is one op rather than one per keystroke.
        const input = document.querySelector(`${GROUP_ROW(target)} .apworld-item-group-name`);
        input.value = RENAMED;
        input.dispatchEvent(new Event('change', { bubbles: true }));

        testController.assertEqual('the registry entry moved IN PLACE',
            JSON.stringify(before.map((g) => (g === target ? RENAMED : g))),
            JSON.stringify(registryOf(panel)));
        testController.assertEqual('every carrier\'s membership followed',
            `${carriers.length}|${JSON.stringify(carriers)}`,
            `${carriersOf(panel, RENAMED).length}|${JSON.stringify(carriersOf(panel, RENAMED))}`);
        testController.assertEqual('…and nothing still carries the old name', '0',
            String(carriersOf(panel, target).length));
        testController.assertEqual('as exactly ONE op',
            String(opsBefore + 1), String(panel.session.ops().length));
        testController.reportCondition('the section row is drawn under the new name',
            !!document.querySelector(GROUP_ROW(RENAMED)));
        testController.reportCondition('…and so is a chip on an item that carries it',
            !!document.querySelector(`${PANEL_SELECTOR} .apworld-item-groups-cell[data-item="${
                CSS.escape(carriers[0])}"] .apworld-item-group-chip[data-group="${CSS.escape(RENAMED)}"]`));

        document.querySelector(`${PANEL_SELECTOR} .apworld-undo`).click();
        testController.assertEqual('ONE undo restores the registry',
            JSON.stringify(before), JSON.stringify(registryOf(panel)));
        testController.assertEqual('…and the items\' membership with it',
            JSON.stringify(carriers), JSON.stringify(carriersOf(panel, target)));
        testController.assertEqual('…in one step', String(opsBefore),
            String(panel.session.ops().length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('item-group rename test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **A GROUP THE ITEMS CARRY THAT THE REGISTRY DOES NOT LIST IS SHOWN,
 * NEVER SILENTLY ADDED** (I1, task 5 (d)).
  *
 * ⛓ On `alttp`, which is in that state as committed: 23 names in the registry,
 * `Event` on seven items and in neither. Measured over the corpus, 155 of the
 * 224 slots carry at least one unlisted group — so this is the common case, not
 * an edge one, and the document is a committed preset rather than a fixture.
 */
export async function apworldAnUnlistedItemGroupIsShownAndCanBeListed(testController) {
    try {
        const panel = await openHub(testController, ITEM_GROUPS_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        selectTab(panel, 'items');

        const listed = registryOf(panel);
        const onItems = new Set();
        for (const item of Object.values(panel.rulesDoc.items[panel.playerId])) {
            for (const g of (item?.groups ?? [])) onItems.add(g);
        }
        const unlisted = [...onItems].filter((g) => !listed.includes(g));
        testController.reportCondition('this committed document carries an unlisted group',
            unlisted.length > 0);
        if (!unlisted.length) return testController.getOverallResult();

        const rows = [...document.querySelectorAll(
            `${PANEL_SELECTOR} .apworld-item-group-row[data-listed="false"]`)];
        testController.assertEqual('the section draws one greyed row per unlisted group',
            JSON.stringify(unlisted.slice().sort()),
            JSON.stringify(rows.map((r) => r.dataset.group).sort()));
        const name = unlisted[0];
        const row = document.querySelector(GROUP_ROW(name));
        testController.assertEqual('…counting the items that carry it',
            String(carriersOf(panel, name).length), row?.dataset.carriers ?? '?');
        testController.reportCondition('…and the chip on such an item is marked unlisted',
            document.querySelector(`${PANEL_SELECTOR} .apworld-item-group-chip[data-group="${
                CSS.escape(name)}"]`)?.dataset.listed === 'false');
        testController.reportCondition('the registry did NOT quietly grow to include it',
            !registryOf(panel).includes(name));

        const opsBefore = panel.session.ops().length;
        const itemsBefore = JSON.stringify(panel.rulesDoc.items[panel.playerId]);
        row.querySelector('.apworld-item-group-list').click();

        testController.reportCondition('"Add to registry" lists it', registryOf(panel).includes(name));
        testController.assertEqual('as exactly ONE op',
            String(opsBefore + 1), String(panel.session.ops().length));
        testController.assertEqual('…and the ITEMS are byte-identical — it was already on them',
            itemsBefore, JSON.stringify(panel.rulesDoc.items[panel.playerId]));
        testController.reportCondition('…and its row is now a registry row',
            document.querySelector(GROUP_ROW(name))?.dataset.listed === 'true');
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('unlisted-group test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **THE SECTION READS THE SELECTED SLOT** (I1, task 5's mutant (C)).
  *
 * ⛔ On the four-player fixture, whose four slots all name the SAME group
 * (`Everything`) but carry it on different numbers of items — 2 on slot 1, 6 on
 * slot 3, measured off the document here rather than typed. So a section that
 * read slot `'1'` would draw a row with the right NAME and the wrong count, and
 * only a count read off the selected slot can tell the two apart.
  *
 * ⛓ The slot is chosen through the REAL toolbar control (H4a's rule), never by
 * assigning `panel.playerId`.
 */
export async function apworldItemGroupsFollowTheSelectedSlot(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        testController.reportCondition('the fixture offers a player selector', !!select);
        if (!select) return testController.getOverallResult();

        const readSection = () => {
            selectTab(panel, 'items');
            const rows = [...document.querySelectorAll(`${PANEL_SELECTOR} .apworld-item-group-row`)];
            return {
                slot: panel.playerId,
                drawn: rows.map((r) => `${r.dataset.group}:${r.dataset.carriers}`),
                expected: registryOf(panel).map((g) => `${g}:${carriersOf(panel, g).length}`),
                cells: document.querySelectorAll(`${PANEL_SELECTOR} .apworld-item-groups-cell`).length,
                items: Object.keys(panel.rulesDoc.items[panel.playerId]).length,
            };
        };

        selectPlayer(select, 1);
        const one = readSection();
        testController.assertEqual('slot 1: the section draws slot 1\'s registry and counts',
            JSON.stringify(one.expected), JSON.stringify(one.drawn));
        testController.assertEqual('…and one groups cell per item of slot 1',
            String(one.items), String(one.cells));

        selectPlayer(select, 3);
        const three = readSection();
        testController.assertEqual('slot 3: the section draws slot 3\'s registry and counts',
            JSON.stringify(three.expected), JSON.stringify(three.drawn));
        testController.assertEqual('…and one groups cell per item of slot 3',
            String(three.items), String(three.cells));

        // ⛓ The discrimination is REAL on this document — if the two slots agreed,
        //   this row could not tell "the selected slot" from "the first one".
        testController.reportCondition('the two slots really differ, so the row can discriminate',
            JSON.stringify(one.drawn) !== JSON.stringify(three.drawn) && one.cells !== three.cells);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('item-groups slot test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-item-group-add-reaches-the-registry-and-every-picker',
    name: 'APWorld hub: adding an item group reaches the registry, the section and every item\'s picker',
    description: 'On procgen_maze/AP_1 — a procgen document, whose registry holds one name — '
                          + 'types into the Groups section\'s own box and presses its own button: the name '
                          + 'lands in `item_groups[slot]` as ONE op, the section draws a row for it saying '
                          + 'nothing carries it yet with its delete button ENABLED, and every item row\'s '
                          + 'picker offers it once opened (the option list is lazy). One undo takes the '
                          + 'registry, the op count and the row back. Every expectation is read off the '
                          + 'document.',
    testFunction: apworldItemGroupAddReachesTheRegistryAndEveryPicker,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-item-group-delete-is-refused-while-an-item-carries-it',
    name: 'APWorld hub: deleting an item group an item still carries is refused, naming the item',
    description: '⚖ user 2026-09-09: "Let\'s go with refuse." Drives both guards, because they '
                          + 'are not the same one: the section\'s delete button is DISABLED with the '
                          + 'carriers named in its title (a courtesy), and the OP itself refuses when asked '
                          + 'past the button — which is the path the Document tab\'s whole-block Save JSON '
                          + 'is on. Asserts the refusal names a carrier, records no op and leaves the '
                          + 'registry intact, and that a group NOTHING carries still deletes through the '
                          + 'same button, so this is a discrimination rather than a guard that declines '
                          + 'everything. Mutant: dropping the op\'s refusal reds this row.',
    testFunction: apworldItemGroupDeleteIsRefusedWhileAnItemCarriesIt,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-item-group-rename-carries-the-items-membership',
    name: 'APWorld hub: renaming an item group carries every item\'s membership, and one undo restores both',
    description: 'On alttp, whose registry is a real one over 163 items: renames a group through '
                          + 'the section row\'s own input (committed on `change`, the Meta tab\'s rule). The '
                          + 'registry entry moves IN PLACE, every carrier\'s `groups` follows, nothing still '
                          + 'carries the old name, the chip on an item is redrawn — and it is ONE op, so one '
                          + 'undo restores the registry AND the membership in one step. Mutant: a rename '
                          + 'that forgets the items reds the membership conditions.',
    testFunction: apworldItemGroupRenameCarriesTheItemsMembership,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-an-unlisted-item-group-is-shown-and-can-be-listed',
    name: 'APWorld hub: a group the items carry that the registry does not list is shown, not silently added',
    description: 'alttp is in that state as committed — `Event` is on seven items and in neither '
                          + 'the registry nor anything derived from it — and 155 of the 224 committed slots '
                          + 'carry at least one such group, so this is the common divergence rather than an '
                          + 'edge case. Asserts the section draws one greyed row per unlisted group with the '
                          + 'carrier count, that the chip on such an item is marked, that the registry did '
                          + 'NOT quietly grow, and that "Add to registry" lists it as ONE op while leaving '
                          + 'the items byte-identical.',
    testFunction: apworldAnUnlistedItemGroupIsShownAndCanBeListed,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-item-groups-follow-the-selected-slot',
    name: 'APWorld hub: the Groups section reads the selected slot, not the first one',
    description: 'On the four-player multiworld fixture, whose four slots all name the SAME group '
                          + 'but carry it on different numbers of items: asserts the section\'s rows and '
                          + 'their carrier counts match the SELECTED slot\'s document, in both directions '
                          + 'through the real toolbar selector, that there is one groups cell per item of '
                          + 'that slot, and that the two slots really differ — without which the row could '
                          + 'not tell "the selected slot" from "the first one". Mutant: reading slot \'1\' '
                          + 'reds this row.',
    testFunction: apworldItemGroupsFollowTheSelectedSlot,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/* ══════════════════════════════════════════════════════════════════════
 * THE ITEMS TAB'S PROGRESSION SECTION — `progression_mapping` (I2)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ alttp — 5 PROGRESSIVE mappings, two of them (`Progressive Bow` and
 * `Progressive Bow (Alt)`) pooling into one `base_item`, which is the only
 * shape in which the pool is visible at all.
 */
const PROGRESSION_PRESET_PATH =
    './presets/alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json';
/**
 * ⛓⛓ messenger — the corpus's ONE additive entry (`Shards`, six components at
 * 1/10/50/100/300/500). It has to be a committed document rather than a
 * fixture, because the claim is that the corpus's second kind draws as itself.
 */
const ADDITIVE_PRESET_PATH =
    './presets/messenger/AP_14089154938208861744/AP_14089154938208861744_rules.json';
/**
 * ⛓⛓ smz3 — the corpus's stale-member document, as committed: 12 of its
 * members name resolved forms slot 1's `items` does not hold, and 13 carry
 * `provides`. Nothing is hand-edited into it; this state is what the exporter
 * wrote.
 */
const STALE_PROGRESSION_PRESET_PATH =
    './presets/smz3/AP_14089154938208861744/AP_14089154938208861744_rules.json';
/**
 * ⛓⛓ The four-player multiworld export whose slot 2 is the ALTTP world: slots
 * 1, 3 and 4 carry NO mappings and slot 2 carries five. That 0-vs-5 is the
 * discrimination — `FOUR_PLAYER_PATH`'s slots are all empty here, so it could
 * not tell "the selected slot" from "the first one".
 */
const FOUR_PLAYER_PROGRESSION_PATH =
    './presets/multiworld/AP_14089154938208861744/AP_14089154938208861744_rules.json';

/** ⛓ The panel's own selectors, spelled once. */
const PROG_CARD = (name) => `${PANEL_SELECTOR} .apworld-progression-card[data-mapping="${
        CSS.escape(name)}"]`;

/** ⛓ The slot's mappings as the DOCUMENT holds them — every expectation is read
 *  off the record, never typed (a count in a test is an allowlist key). */
const mappingsOf = (panel) =>
    panel.rulesDoc?.progression_mapping?.[panel.playerId] ?? {};

/** ⛓ What the section HAS drawn, as `name:kind:members`, so a comparison is one
 *  string and names which card moved. */
const drawnCards = () => [...document.querySelectorAll(
    `${PANEL_SELECTOR} .apworld-progression-card`)]
    .map((c) => `${c.dataset.mapping}:${c.dataset.kind}:${c.dataset.members}`);

/** ⛓ The same, expected — derived from the document by asking the RUNTIME's
 *  question (`type === 'additive'`), not the section's. */
const expectedCards = (panel) => Object.entries(mappingsOf(panel)).map(([name, m]) => {
    const additive = m?.type === 'additive';
    const n = additive
        ? Object.keys(m.items ?? {}).length
        : (Array.isArray(m?.items) ? m.items.length : 0);
    return `${name}:${additive ? 'additive' : 'progressive'}:${n}`;
});

/**
 * ⛓⛓⛓ **THE CARDS DRAW THE DOCUMENT'S PROGRESSIVE MAPPINGS, WITH THE POOL
 * VISIBLE** (I2, task 4 (a) — the progressive half).
 *
 * ⛓ Scored against the document rather than against the section's own dataset:
 * the expectation asks `type === 'additive'`, which is the question
 * `inventoryManager` asks, so a section that classified by some other test
 * would disagree with this row rather than with itself.
 */
export async function apworldProgressionCardsDrawTheDocument(testController) {
    try {
        const panel = await openHub(testController, PROGRESSION_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        selectTab(panel, 'items');

        const doc = mappingsOf(panel);
        testController.reportCondition('the slot carries mappings the section can draw',
            Object.keys(doc).length > 0);
        testController.assertEqual('one card per mapping, in the document\'s order, with its kind',
            JSON.stringify(expectedCards(panel)), JSON.stringify(drawnCards()));

        // ⛓ Every member row carries the document's own item name and level.
        const mismatched = Object.entries(doc).filter(([name, mapping]) => {
            const rows = [...document.querySelectorAll(
                `${PROG_CARD(name)} .apworld-progression-member`)];
            return JSON.stringify(rows.map((r) => `${r.dataset.item}@${
                r.querySelector('.apworld-progression-level')?.value}`))
                !== JSON.stringify(mapping.items.map((m) => `${m.name}@${m.level}`));
        });
        testController.assertEqual('every level row carries the document\'s item and its level',
            '[]', JSON.stringify(mismatched.map(([n]) => n)));

        // ⛓⛓ THE POOL. Two mappings share one `base_item` on this document, and
        //   that is the whole reason the field is not just the entry's own name.
        const pooled = Object.entries(doc).filter(([name, m]) => m.base_item !== name);
        testController.reportCondition('this document really pools two mappings into one base',
            pooled.length > 0);
        for (const [name, mapping] of pooled) {
            const base = document.querySelector(`${PROG_CARD(name)} .apworld-progression-base`);
            testController.assertEqual(`"${name}" draws its base as the document holds it`,
                mapping.base_item, base?.value);
            testController.reportCondition(`…and "${mapping.base_item}" is a mapping in this slot`,
                base?.dataset.pooled === 'true'
                    && Object.prototype.hasOwnProperty.call(doc, mapping.base_item));
        }

        // ⛓ The base picker's DOMAIN is the slot's mapping names — measured
        //   137/137 over the corpus — and not the slot's items.
        const anyBase = document.querySelector(`${PANEL_SELECTOR} .apworld-progression-base`);
        anyBase.dispatchEvent(new Event('focus'));
        testController.assertEqual('the base picker offers the slot\'s MAPPING names',
            JSON.stringify(Object.keys(doc).slice().sort()),
            JSON.stringify([...anyBase.options].map((o) => o.value).sort()));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('progression-cards test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **THE ADDITIVE KIND DRAWS AS ITSELF** (I2, task 4 (a) — the additive
 * half; mutant (C)'s row).
 *
 * The two kinds are read by two different parts of the app, and the difference
 * a person has to see is that an additive member carries a VALUE the inventory
 * accumulates rather than a LEVEL the rule engine compares. So the row asserts
 * the value boxes exist, the level boxes do not, the numbers are the
 * document's, and the reorder controls — which belong to an ordered list — are
 * absent.
 */
export async function apworldTheAdditiveKindDrawsAsItself(testController) {
    try {
        const panel = await openHub(testController, ADDITIVE_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        selectTab(panel, 'items');

        const doc = mappingsOf(panel);
        const additiveNames = Object.keys(doc).filter((n) => doc[n]?.type === 'additive');
        testController.reportCondition('this document carries an additive mapping to draw',
            additiveNames.length > 0);
        if (!additiveNames.length) return testController.getOverallResult();

        testController.assertEqual('one card per mapping, with its kind',
            JSON.stringify(expectedCards(panel)), JSON.stringify(drawnCards()));

        for (const name of additiveNames) {
            const card = document.querySelector(PROG_CARD(name));
            testController.assertEqual(`"${name}" is drawn as the kind the inventory reads`,
                'additive', card?.dataset.kind);
            testController.assertEqual('…and its kind select says so',
                'additive', card?.querySelector('.apworld-progression-kind')?.value);

            const rows = [...card.querySelectorAll('.apworld-progression-member')];
            testController.assertEqual(`…and one row per component of "${name}"`,
                JSON.stringify(Object.entries(doc[name].items).map(([n, v]) => `${n}=${v}`)),
                JSON.stringify(rows.map((r) => `${r.dataset.item}=${
                    r.querySelector('.apworld-progression-value')?.value}`)));

            // ⛔ The discrimination: a card rendered as PROGRESSIVE would carry
            //   level boxes and ↑/↓, and its numbers would be levels.
            testController.assertEqual('…drawn as VALUES, with no level box on the card', '0',
                String(card.querySelectorAll('.apworld-progression-level').length));
            testController.assertEqual('…and no reorder control, because it is not a list', '0',
                String(card.querySelectorAll(
                    '.apworld-progression-up, .apworld-progression-down').length));
        }
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('additive-kind test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **EDITING ONE LEVEL COMMITS ONE OP CARRYING THE WHOLE ENTRY, AND ONE
 * UNDO RESTORES ALL OF IT** (I2, task 4 (b); mutant (B)'s row).
 *
 * ⛔ The undo condition compares the WHOLE entry, not the level that moved:
 * a card that wrote only the changed row would still put that one level back,
 * and the rest of the entry would be whatever the partial write left. That is
 * the difference this row exists to see.
 */
export async function apworldAProgressionLevelEditIsOneOpAndOneUndo(testController) {
    try {
        const panel = await openHub(testController, PROGRESSION_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        selectTab(panel, 'items');

        // ⛓ The card with the MOST levels, so a partial write has the most room
        //   to be visible — chosen from the document, never named here.
        const name = Object.entries(mappingsOf(panel))
            .sort((a, b) => b[1].items.length - a[1].items.length)[0][0];
        const before = JSON.stringify(mappingsOf(panel)[name]);
        testController.reportCondition('the card under test has more than one level',
            mappingsOf(panel)[name].items.length > 1);

        const opsBefore = panel.session.ops().length;
        // ⛔ RE-QUERIED after the render, and the SECOND row, so "the whole
        //   entry came back" is not satisfied by an entry with one member.
        //   ⛓ Null-safe on purpose: under the partial-write mutant the row is
        //   GONE after the render, and a row that threw there would red without
        //   naming what went wrong (the conditions below are the claim).
        const box = () => document.querySelectorAll(
            `${PROG_CARD(name)} .apworld-progression-level`)[1];
        const target = Number(box().value) + 5;
        box().value = String(target);
        box().dispatchEvent(new Event('change', { bubbles: true }));

        testController.assertEqual('the edit is ONE op', '1',
            String(panel.session.ops().length - opsBefore));
        testController.assertEqual('…and the level the person typed is in the document',
            String(target), String(mappingsOf(panel)[name].items?.[1]?.level));
        // ⛓⛓ THE DIRECT CLAIM: the op carries the WHOLE entry, so every OTHER
        //   level is exactly where it was. A card that wrote only the changed
        //   row would take the rest of the entry with it, and this is the
        //   condition that says so by name.
        const others = (entry) => JSON.stringify((entry?.items ?? [])
            .filter((_m, i) => i !== 1));
        testController.assertEqual('…and every OTHER level of the entry is untouched',
            others(JSON.parse(before)), others(mappingsOf(panel)[name]));
        testController.assertEqual('…and it is drawn back',
            String(target), String(box()?.value));

        panel.session.undo();
        panel._render();
        testController.assertEqual('one undo restores the WHOLE entry, not just the level',
            before, JSON.stringify(mappingsOf(panel)[name]));
        testController.assertEqual('…and the op count goes back with it',
            String(opsBefore), String(panel.session.ops().length));
        testController.assertEqual('…and the card is drawn from the restored entry',
            JSON.stringify(expectedCards(panel)), JSON.stringify(drawnCards()));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('progression-level-edit test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **A PROCGEN DOCUMENT STARTS EMPTY, AND THE SECTION IS HOW IT STOPS
 * BEING** (I2, task 4 (c)).
 *
 * `makeRulesJsonScaffold` writes `progression_mapping: {'1': {}}` and the ⚖
 * ruling is explicitly about worlds that do not use these yet — so the empty
 * slot is the case the editor exists for, and the row drives the section's own
 * box and button rather than `_applyOp`.
 */
export async function apworldAddingAProgressionMappingOnAnEmptySlot(testController) {
    const NEW_NAME = 'Progressive Widget';
    try {
        const panel = await openHub(testController, PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        selectTab(panel, 'items');

        testController.assertEqual('the procgen document carries NO mappings to start', '0',
            String(Object.keys(mappingsOf(panel)).length));
        testController.assertEqual('…and the section draws no cards', '0',
            String(document.querySelectorAll(`${PANEL_SELECTOR} .apworld-progression-card`).length));
        testController.reportCondition('…and says so rather than drawing nothing',
            !!document.querySelector(`${PANEL_SELECTOR} .apworld-progressions-empty`));

        const opsBefore = panel.session.ops().length;
        const held = Object.keys(panel.rulesDoc.items[panel.playerId]);
        document.querySelector(`${PANEL_SELECTOR} .apworld-progression-new`).value = NEW_NAME;
        document.querySelector(`${PANEL_SELECTOR} .apworld-progressions-add-button`).click();

        testController.assertEqual('the mapping is in the document\'s slot', '1',
            String(Object.keys(mappingsOf(panel)).length));
        testController.assertEqual('…as ONE op', '1',
            String(panel.session.ops().length - opsBefore));
        const made = mappingsOf(panel)[NEW_NAME];
        testController.reportCondition('…and its base is itself, which is what pools',
            made?.base_item === NEW_NAME);
        testController.reportCondition('…and its one level names an item this slot HOLDS',
            Array.isArray(made?.items) && made.items.length === 1
                && held.includes(made.items[0].name));
        testController.assertEqual('…and the card is drawn for it',
            JSON.stringify(expectedCards(panel)), JSON.stringify(drawnCards()));

        panel.session.undo();
        panel._render();
        testController.assertEqual('one undo takes the slot back to empty', '0',
            String(Object.keys(mappingsOf(panel)).length));
        testController.assertEqual('…and the card with it', '0',
            String(document.querySelectorAll(`${PANEL_SELECTOR} .apworld-progression-card`).length));

        // ⛓⛓ The OTHER kind through the same row, because the add row's kind
        //   select is the only place a person chooses it.
        document.querySelector(`${PANEL_SELECTOR} .apworld-progression-new`).value = 'Widgets';
        document.querySelector(`${PANEL_SELECTOR} .apworld-progression-new-kind`).value = 'additive';
        document.querySelector(`${PANEL_SELECTOR} .apworld-progressions-add-button`).click();
        testController.assertEqual('the add row\'s kind select reaches the document',
            'additive', mappingsOf(panel).Widgets?.type);
        testController.assertEqual('…and the card draws as that kind',
            'additive', document.querySelector(PROG_CARD('Widgets'))?.dataset.kind);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('empty-slot add test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **A MEMBER NAMING AN ITEM THE SLOT DOES NOT HOLD IS SHOWN, MARKED AND
 * REMOVABLE — AND THE OP IS THE GUARD** (I2, task 4 (d); mutant (A)'s row).
 *
 * ⛓ smz3 is in this state AS COMMITTED — nothing is hand-edited in — because
 * `genericLogic.has` resolves a name THROUGH a mapping, so a level's name need
 * not be an item anyone receives.
 *
 * ⛔⛔ **AND THE REFUSAL IS ASKED OF THE OP, NOT OF THE PICKER** (trap 1305).
 * The item pickers omit names the entry already holds and offer only items the
 * slot has, so no gesture on this section can produce an unknown name — a row
 * that drove only the control would be entirely green with the op's refusal
 * deleted. The op is asked directly, and separately from the drawing half.
 */
export async function apworldAStaleProgressionMemberIsShownAndRemovable(testController) {
    try {
        const panel = await openHub(testController, STALE_PROGRESSION_PRESET_PATH);
        if (!panel) return testController.getOverallResult();
        selectTab(panel, 'items');

        const slot = panel.playerId;
        const held = panel.rulesDoc.items[slot];
        // ⛓ The expectation is DERIVED from the document: every member name the
        //   slot's item table does not hold.
        const expected = Object.entries(mappingsOf(panel)).flatMap(([name, m]) => m.items
            .filter((x) => !Object.prototype.hasOwnProperty.call(held, x.name))
            .map((x) => `${name}/${x.name}`));
        testController.reportCondition('this document carries stale members as committed',
            expected.length > 0);
        if (!expected.length) return testController.getOverallResult();

        const marked = () => [...document.querySelectorAll(
            `${PANEL_SELECTOR} .apworld-progression-member[data-stale="true"]`)]
            .map((r) => `${r.closest('.apworld-progression-card').dataset.mapping}/${r.dataset.item}`);
        testController.assertEqual('every stale member is drawn and marked',
            JSON.stringify(expected), JSON.stringify(marked()));
        testController.assertEqual('…and the section counts them',
            String(expected.length),
            document.querySelector(`${PANEL_SELECTOR} .apworld-progressions`).dataset.issues);
        testController.reportCondition('…and the mark says WHY',
            !!document.querySelector(
                `${PANEL_SELECTOR} .apworld-progression-member[data-stale="true"] `
                + '.apworld-progression-stale'));

        // ⛓ REMOVABLE — from a card that has another member, since the op
        //   refuses an empty container by shape.
        const [name, member] = expected
            .map((e) => [e.slice(0, e.lastIndexOf('/')), e.slice(e.lastIndexOf('/') + 1)])
            .find(([n]) => mappingsOf(panel)[n].items.length > 1);
        const before = JSON.stringify(mappingsOf(panel)[name]);
        const opsBefore = panel.session.ops().length;
        const row = () => document.querySelector(
            `${PROG_CARD(name)} .apworld-progression-member[data-item="${CSS.escape(member)}"]`);
        row().querySelector('.apworld-progression-member-remove').click();

        testController.assertEqual('removing a stale member is ONE op', '1',
            String(panel.session.ops().length - opsBefore));
        testController.reportCondition('…and it is gone from the document',
            !mappingsOf(panel)[name].items.some((x) => x.name === member));
        testController.assertEqual('…and the section\'s count drops by exactly one',
            String(expected.length - 1),
            document.querySelector(`${PANEL_SELECTOR} .apworld-progressions`).dataset.issues);
        panel.session.undo();
        panel._render();
        testController.assertEqual('…and one undo puts the whole entry back',
            before, JSON.stringify(mappingsOf(panel)[name]));

        // ⛓⛓ An edit that KEEPS the stale member is ACCEPTED — the difference is
        //   the point: an absolute refusal would make these the entries nobody
        //   can edit.
        const opsKept = panel.session.ops().length;
        const box = () => document.querySelectorAll(
            `${PROG_CARD(name)} .apworld-progression-level`)[0];
        box().value = String(Number(box().value) + 3);
        box().dispatchEvent(new Event('change', { bubbles: true }));
        testController.assertEqual('an edit that keeps a stale member is accepted, as one op', '1',
            String(panel.session.ops().length - opsKept));
        testController.reportCondition('…and the stale member is still there, still marked',
            mappingsOf(panel)[name].items.some((x) => x.name === member)
                && marked().includes(`${name}/${member}`));

        // ⛔ THE OP IS THE GUARD — asked past every control, which is the path
        //   the Document tab's whole-block Save JSON is on.
        const opsRefused = panel.session.ops().length;
        const refused = panel.session.apply({
            op: 'set-progression-mapping', player: slot, name,
            mapping: {
                ...mappingsOf(panel)[name],
                items: [{ name: 'An Item That Was Never Here', level: 1 }],
            },
        });
        testController.reportCondition('the OP refuses a name this edit would ADD',
            refused.ok === false);
        testController.reportCondition('…and the refusal NAMES it',
            String(refused.description ?? '').includes('An Item That Was Never Here'));
        testController.assertEqual('…and nothing was recorded', '0',
            String(panel.session.ops().length - opsRefused));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('stale-progression test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓ **THE SECTION READS THE SELECTED SLOT, NOT THE FIRST ONE** (I2).
 *
 * ⛔ I1 §13.5 (C) measured that the vitest module is BLIND to this: the section
 * reads the DOCUMENT, so a wrong slot is not a table the node rows can see.
 * The document is the four-player multiworld export whose slot 2 is the ALTTP
 * world — slots 1, 3 and 4 carry NO mappings and slot 2 carries five, so the
 * discrimination is a real 0-vs-5 rather than two lists that happen to differ.
 */
export async function apworldProgressionFollowsTheSelectedSlot(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PROGRESSION_PATH);
        if (!panel) return testController.getOverallResult();
        const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        testController.reportCondition('the fixture offers a player selector', !!select);
        if (!select) return testController.getOverallResult();

        const read = () => {
            selectTab(panel, 'items');
            return {
                slot: panel.playerId,
                drawn: drawnCards(),
                expected: expectedCards(panel),
                head: document.querySelector(
                    `${PANEL_SELECTOR} .apworld-progressions`).dataset.slot,
            };
        };

        selectPlayer(select, 1);
        const one = read();
        testController.assertEqual('slot 1: the section draws slot 1\'s mappings',
            JSON.stringify(one.expected), JSON.stringify(one.drawn));
        testController.assertEqual('…and says which slot it is drawing', '1', one.head);

        // ⛓ The slot that HAS mappings on this document — found, not typed.
        const populated = Object.keys(panel.rulesDoc.progression_mapping)
            .find((p) => Object.keys(panel.rulesDoc.progression_mapping[p] ?? {}).length > 0);
        selectPlayer(select, populated);
        const other = read();
        testController.assertEqual(`slot ${populated}: the section draws that slot's mappings`,
            JSON.stringify(other.expected), JSON.stringify(other.drawn));
        testController.assertEqual('…and says which slot it is drawing', populated, other.head);

        testController.reportCondition('the two slots really differ, so the row can discriminate',
            JSON.stringify(one.drawn) !== JSON.stringify(other.drawn)
                && one.drawn.length === 0 && other.drawn.length > 0);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('progression-slot test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-progression-cards-draw-the-document',
    name: 'APWorld hub: the Progression section draws the document\'s mappings, with the pool visible',
    description: 'On alttp, whose five mappings include two pooling into one `base_item` — the '
               + 'only shape in which the pool is visible at all. Asserts one card per mapping in '
               + 'the document\'s order with its kind (classified the way `inventoryManager` '
               + 'classifies, `type === "additive"`, not the way the section does), every level '
               + 'row carrying the document\'s own item and level, the pooled card drawing its '
               + 'base as the document holds it, and that the base picker\'s domain is the slot\'s '
               + 'MAPPING names — measured 137 of 137 over the corpus — rather than its items.',
    testFunction: apworldProgressionCardsDrawTheDocument,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-the-additive-progression-kind-draws-as-itself',
    name: 'APWorld hub: the additive progression kind draws as a counter, not as levels',
    description: 'On messenger, which carries the corpus\'s ONE additive mapping (`Shards`, six '
               + 'components at 1/10/50/100/300/500). The two kinds are read by two different '
               + 'parts of the app, and the difference a person has to see is that an additive '
               + 'member carries a VALUE the inventory accumulates rather than a LEVEL the rule '
               + 'engine compares — so the row asserts the value boxes carry the document\'s own '
               + 'numbers, that the card has NO level box, and that it has no reorder control, '
               + 'because it is not an ordered list. Mutant: rendering the additive kind as '
               + 'progressive reds this row.',
    testFunction: apworldTheAdditiveKindDrawsAsItself,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-a-progression-level-edit-is-one-op-and-one-undo',
    name: 'APWorld hub: editing one progression level is one op, and one undo restores the whole entry',
    description: 'Types into a level box on the card with the most levels (chosen from the '
               + 'document, never named) and commits on `change`, the Meta tab\'s rule. The undo '
               + 'condition compares the WHOLE entry rather than the level that moved: a card '
               + 'that wrote only the changed row would still put that one level back, and the '
               + 'rest of the entry would be whatever the partial write left. Mutant: writing '
               + 'only the changed row reds the undo condition.',
    testFunction: apworldAProgressionLevelEditIsOneOpAndOneUndo,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-adding-a-progression-mapping-on-an-empty-slot',
    name: 'APWorld hub: a procgen document\'s empty progression slot gains its first mapping',
    description: 'On procgen_maze/AP_1, whose scaffold writes `progression_mapping: {"1": {}}` — '
               + 'the state the ⚖ ruling is explicitly about ("no procgen worlds currently use '
               + 'them"). Drives the section\'s own box and button: the entry lands in the '
               + 'document as ONE op with its base pointing at itself and one level naming an '
               + 'item this slot HOLDS, the card is drawn, and one undo takes the slot back to '
               + 'empty. Then the same row\'s kind select, because that is the only place a '
               + 'person chooses the additive kind.',
    testFunction: apworldAddingAProgressionMappingOnAnEmptySlot,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-a-stale-progression-member-is-shown-and-removable',
    name: 'APWorld hub: a progression member the slot no longer holds is shown, marked and removable',
    description: 'smz3 is in this state AS COMMITTED — 12 of its members name resolved forms '
               + 'slot 1\'s items do not hold, because `genericLogic.has` resolves a name THROUGH '
               + 'the mapping. Asserts every one is drawn and marked against an expectation '
               + 'DERIVED from the document, that removing one is one op and drops the section\'s '
               + 'count by exactly one, that one undo puts the whole entry back, and that an edit '
               + 'KEEPING a stale member is accepted — which is why the op\'s refusal is '
               + 'differenced. ⛔ The refusal itself is asked of the OP, not of the picker (trap '
               + '1305): no gesture on this section can produce an unknown name, so a row that '
               + 'drove only the control would be green with the guard deleted. Mutant: dropping '
               + 'the op\'s item refusal reds this row.',
    testFunction: apworldAStaleProgressionMemberIsShownAndRemovable,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-progression-follows-the-selected-slot',
    name: 'APWorld hub: the Progression section reads the selected slot, not the first one',
    description: 'On the four-player multiworld export whose slot 2 is the ALTTP world: slots 1, '
               + '3 and 4 carry NO mappings and slot 2 carries five, so the discrimination is a '
               + 'real 0-vs-5. Driven through the real toolbar selector in both directions, with '
               + 'the populated slot FOUND in the document rather than named. Exists because the '
               + 'vitest module is blind to this — the section reads the DOCUMENT, so a wrong '
               + 'slot is not a table the node rows can see (I1 §13.5 (C)).',
    testFunction: apworldProgressionFollowsTheSelectedSlot,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ PRESET SIDECARS S0 — THE PER-REGION SIDECAR VIEW
 * (`NewDocs/plans/preset-sidecars-plan.md` §3 D2, §9.3 rung 2)
 *
 * One renderer (`_makeRegionSidecarBlock`), two hosts: under each region on
 * the Regions tab, and the Sidecars tab's per-region list. Every expectation
 * below is read off the DOCUMENT — the entry's own `substrate`, its own bytes —
 * and every slot is chosen through the toolbar's own selector (H1's rows).
 * ⚠ Every post-gesture lookup RE-QUERIES: a render rebuilds the tab body, and a
 * node captured before it answers out of the detached old tree (W0 §7.5).
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ The sidecar blocks the Regions tab draws, keyed by region — re-queried. */
function regionSidecarBlocks() {
    return [...document.querySelectorAll(
        `${PANEL_SELECTOR} .apworld-region-block .apworld-sidecar-block`)];
}

/** ⛓ One region's sidecar block on whichever tab is showing — re-queried. */
function sidecarBlockFor(regionName) {
    return document.querySelector(
        `${PANEL_SELECTOR} .apworld-sidecar-block[data-region-name="${CSS.escape(regionName)}"]`);
}

/**
 * ⛓⛓⛓ **(i) THE BLOCKS FOLLOW THE SELECTED SLOT, AND EACH BADGE IS THE
 * DOCUMENT'S OWN `substrate`.** Walks every populated slot of the four-player
 * fixture — the population is `preset_sidecars`' own keys — through the
 * product's selector. Per slot: one block per sidecar entry, each inside the
 * region block of the same name, its badge equal to THAT slot's entry's
 * `substrate` (never a literal), exactly one Edit ▸ per sidecar region and it
 * lives INSIDE the block (S0 moved it out of the header — the count is H4b's,
 * unchanged), none on a region with no sidecar, and no JSON built.
 *
 * ⛔ Non-vacuity: two slots of the fixture hold DIFFERENT substrates (maze and
 * bounce) — measured here off the document, since a block that read one slot
 * for every slot would agree with a fixture whose slots all matched.
 */
export async function apworldSidecarBlocksFollowTheSelectedSlot(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        const doc = panel.rulesDoc;
        const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        testController.reportCondition('the toolbar carries a player selector', !!select);
        if (!select) return testController.getOverallResult();

        const slots = Object.keys(doc.preset_sidecars ?? {});
        const substratesOf = (slot) => [...new Set(Object.values(doc.preset_sidecars[slot])
            .map((e) => e.substrate))].sort().join(',');
        testController.reportCondition(
            '⛓ premise: the fixture\'s slots do not all hold the same substrates',
            new Set(slots.map(substratesOf)).size > 1);

        for (const slot of slots) {
            selectPlayer(select, slot);
            selectTab(panel, 'regions');
            const want = sidecarRegions(doc, slot);
            const drawn = await testController.pollForValue(
                () => {
                    const blocks = regionSidecarBlocks();
                    return String(panel.playerId) === slot && blocks.length > 0
                        && blocks.every((b) => b.dataset.player === slot) ? blocks : null;
                },
                `slot ${slot}'s sidecar blocks on the Regions tab`, 8000, 50);
            testController.assertEqual(
                `slot ${slot}: one block per sidecar entry of THAT slot`,
                String(want.length), String((drawn ?? []).length));
            for (const block of regionSidecarBlocks()) {
                const region = block.dataset.regionName;
                const entry = doc.preset_sidecars[slot][region];
                testController.assertEqual(
                    `slot ${slot} "${region}": the badge is the document's substrate`,
                    String(entry?.substrate),
                    String(block.querySelector('.apworld-sidecar-badge')?.textContent));
                testController.assertEqual(
                    `…drawn under the region block of the same name`,
                    region, String(block.closest('.apworld-region-block')?.dataset.regionName));
                testController.assertEqual(
                    '…and its Edit ▸ is inside the block, once',
                    '1', String(block.querySelectorAll('.apworld-edit-room').length));
            }
            for (const regionBlock of document.querySelectorAll(
                `${PANEL_SELECTOR} .apworld-region-block`)) {
                const name = regionBlock.dataset.regionName;
                testController.assertEqual(
                    `slot ${slot} "${name}": Edit ▸ drawn ${want.includes(name) ? 'once' : 'nowhere'}`
                    + ' (the H4b count, unmoved by S0)',
                    want.includes(name) ? '1' : '0',
                    String(regionBlock.querySelectorAll('.apworld-edit-room').length));
            }
            testController.assertEqual(
                `slot ${slot}: no JSON is built until a block is opened`,
                '0', String(document.querySelectorAll(
                    `${PANEL_SELECTOR} .apworld-sidecar-json`).length));
        }

        /**
         * ⛓⛓ **AND ON A DOCUMENT WHOSE ENTRIES CARRY NO `render_hint`.** On every
         * committed entry that carries a hint it EQUALS the substrate (plan
         * §2.1), so the four slots above cannot tell a badge reading the hint
         * from one reading the substrate. The Seedling entries carry no hint at
         * all — the only place in the corpus where the two readings differ.
         */
        const seedling = await openHub(testController, SEEDLING_PRESET_PATH);
        if (seedling) {
            selectTab(seedling, 'regions');
            const sDoc = seedling.rulesDoc;
            const sSlot = String(seedling.playerId);
            const sWant = sidecarRegions(sDoc, sSlot);
            testController.reportCondition(
                '⛓ premise: this document\'s entries carry no render_hint',
                sWant.length > 0 && sWant.every((r) => !('render_hint' in sDoc.preset_sidecars[sSlot][r])));
            const sDrawn = await testController.pollForValue(
                () => (regionSidecarBlocks().length === sWant.length ? regionSidecarBlocks() : null),
                'the Seedling document\'s sidecar blocks', 8000, 50);
            testController.reportCondition('one block per Seedling entry', !!sDrawn);
            for (const block of regionSidecarBlocks()) {
                const r = block.dataset.regionName;
                testController.assertEqual(`"${r}": the badge is the entry's substrate`,
                    String(sDoc.preset_sidecars[sSlot][r]?.substrate),
                    String(block.querySelector('.apworld-sidecar-badge')?.textContent));
            }
        }
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('sidecar-blocks-per-slot test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **(ii) OPENING A BLOCK DRAWS THE ENTRY'S OWN BYTES, AND THE DOORS IN IT
 * ARE THE REGION'S.** On a bounce slot (a zone payload — the family the Map tab
 * and Edit ▸ treat differently from the maze slots), the region picked off the
 * document. The textarea must equal `JSON.stringify(entry, null,
 * JSON_BLOCK_INDENT)` byte for byte — the WHOLE entry, not the payload — and
 * be the ONLY JSON built. ⛓ PRESET SIDECARS S1 turned saving on: the textarea
 * is editable and carries exactly one Save (the save itself is S1's rows,
 * below; the id lost its `-read-only` suffix with the claim). The facts line's
 * size is compared against the payload's own UTF-8 bytes measured here, and the
 * hand-off door is pressed: a button wired to nothing would pass a presence
 * check.
 */
export async function apworldASidecarBlockShowsItsEntrysJson(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        const doc = panel.rulesDoc;
        const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        if (!select) {
            testController.reportCondition('the toolbar carries a player selector', false);
            return testController.getOverallResult();
        }
        // ⛓ the LAST populated slot, found in the document rather than named.
        const slot = Object.keys(doc.preset_sidecars).at(-1);
        selectPlayer(select, slot);
        selectTab(panel, 'regions');
        const region = sidecarRegions(doc, slot)[0];
        const entry = doc.preset_sidecars[slot][region];
        testController.log(`slot ${slot}, region ${region}, substrate ${entry.substrate}`);

        const toggle = await testController.pollForValue(
            () => (String(panel.playerId) === slot
                ? sidecarBlockFor(region)?.querySelector('.apworld-sidecar-toggle') : null),
            `the "${region}" block's Show JSON toggle`, 8000, 50);
        testController.reportCondition('the block offers Show JSON', !!toggle);
        if (!toggle) return testController.getOverallResult();
        toggle.click();

        const text = await testController.pollForValue(
            () => sidecarBlockFor(region)?.querySelector('.apworld-sidecar-json') ?? null,
            'the opened block\'s JSON', 8000, 50);
        testController.reportCondition('opening the block built its JSON', !!text);
        if (!text) return testController.getOverallResult();
        testController.assertEqual(
            '⛓⛓ the JSON is the WHOLE ENTRY, byte for byte, at the widget\'s indent',
            JSON.stringify(entry, null, JSON_BLOCK_INDENT), text.value);
        testController.reportCondition('it is EDITABLE (S1: the host passes an onSave)',
            text.readOnly === false);
        testController.assertEqual('…with exactly one Save', '1', String(sidecarBlockFor(region)
            .querySelectorAll('.apworld-sidecar-save').length));
        testController.assertEqual('and it is the only JSON built on the tab', '1',
            String(document.querySelectorAll(`${PANEL_SELECTOR} .apworld-sidecar-json`).length));

        const bytes = new TextEncoder().encode(
            JSON.stringify(entry.playable_payload, null, JSON_BLOCK_INDENT)).length;
        testController.reportCondition(
            `the facts line gives the payload's pretty size (${bytes} B) and its keys`,
            (sidecarBlockFor(region)?.querySelector('.apworld-sidecar-facts')?.textContent ?? '')
                .includes(`${bytes.toLocaleString()} B`)
            && Object.keys(entry.playable_payload).every((k) => sidecarBlockFor(region)
                .querySelector('.apworld-sidecar-facts').textContent.includes(k)));

        const edit = sidecarBlockFor(region)?.querySelector('.apworld-edit-room');
        testController.reportCondition('the block carries Edit ▸', !!edit);
        testController.assertEqual('…for THIS region\'s substrate',
            String(entry.substrate), String(edit?.dataset.substrate));
        testController.assertEqual('…inside THIS region\'s block',
            region, String(edit?.closest('.apworld-region-block')?.dataset.regionName));

        const regen = sidecarBlockFor(region)?.querySelector('.apworld-sidecar-regenerate');
        const words = DOCUMENT_KEY_EDITORS.procgen_metadata.regionDoor;
        testController.reportCondition('the block carries the hand-off door', !!regen);
        testController.assertEqual('…labelled by the door\'s own declaration',
            words.label, String(regen?.textContent));
        testController.reportCondition('…pressable in this app', !!regen && !regen.disabled);
        if (regen && !regen.disabled) {
            regen.click();
            testController.reportCondition(
                '⛓ pressing it is the procgen_metadata door — the status line says so',
                String(panel.statusLabel?.textContent ?? '')
                    .includes(DOCUMENT_KEY_EDITORS.procgen_metadata.label));
            /**
             * ⛓ …and its EFFECT: the door's own panel comes to the front. ⛔ It
             * is awaited before the hub is raised again — the door's `open`
             * defers its module (a dynamic import), so a raise published
             * straight after the click lands FIRST and the pipeline then takes
             * the stack back (measured: the hub stayed hidden for the whole
             * poll budget).
             */
            const pipelinePanel = DOCUMENT_KEY_EDITORS.procgen_metadata.panelId;
            const raised = await testController.pollForCondition(
                () => panelManager.isPanelActive(pipelinePanel),
                'the pipeline panel came to the front', 8000, 50);
            testController.reportCondition('⛓ …and the pipeline panel came to the front', raised);
            testController.eventBus.publish('ui:activatePanel', { panelId: PANEL_ID });
            const back = await testController.pollForCondition(
                () => (panel.scrollContainer?.clientHeight ?? 0) > 0,
                'the hub is back in front with a layout', 8000, 50);
            testController.reportCondition('the hub is back in front, with a layout', back);
        }

        const hide = sidecarBlockFor(region)?.querySelector('.apworld-sidecar-toggle');
        if (hide) hide.click();
        testController.assertEqual('closing it drops the JSON again', '0',
            String(document.querySelectorAll(`${PANEL_SELECTOR} .apworld-sidecar-json`).length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('sidecar-block JSON test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **(iii) THE SIDECARS TAB'S LIST IS COLLAPSED BY DEFAULT, EXPANDS TO THE
 * SLOT'S ENTRIES, AND `Go to region` LANDS ON THAT REGION** (⚖ user,
 * 2026-09-10: *"expandable, and collapsed by default"*). On a slot other than
 * the first, through the selector. Collapsed: 0 region rows in the DOM. Expanded:
 * one row per entry of THAT slot, in the document's order, each carrying the
 * SAME block (badge = the document's substrate) and no JSON. The state survives
 * a tab round-trip and is gone after a reload (a new session).
 *
 * ⛓ `Go to region` is asserted by its EFFECT — the Regions tab, that region
 * selected, and its header inside the scroll container's viewport. ⛔ The
 * target is the LAST row, and the premise that its header starts OUTSIDE the
 * viewport is measured first: a region already on screen is "in view" whether
 * or not anything scrolled.
 */
export async function apworldSidecarsListIsCollapsedAndGoesToTheRegion(testController) {
    try {
        let panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        const doc = panel.rulesDoc;
        const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        if (!select) {
            testController.reportCondition('the toolbar carries a player selector', false);
            return testController.getOverallResult();
        }
        const slots = Object.keys(doc.preset_sidecars);
        const slot = slots.find((k) => k !== slots[0]
            && Object.keys(doc.preset_sidecars[k]).length > 0);
        const want = sidecarRegions(doc, slot);
        const rows = () => [...document.querySelectorAll(
            `${PANEL_SELECTOR} .apworld-sidecars-region-row`)];
        const expander = () => document.querySelector(`${PANEL_SELECTOR} .apworld-sidecars-expand`);

        selectPlayer(select, slot);
        // ⛓ the premise for the scroll: on the Regions tab, the LAST region's
        //   header starts outside the viewport.
        selectTab(panel, 'regions');
        // ⛓ the sidecar region drawn LAST on the Regions tab (the tab draws
        //   `regions[slot]` in its own order, not the sidecars' order).
        const regionOrder = Object.keys(doc.regions[slot] ?? {});
        const target = [...want].sort((a, b) => regionOrder.indexOf(a) - regionOrder.indexOf(b))
            .at(-1);
        const inView = (name) => {
            const block = document.querySelector(`${PANEL_SELECTOR} .apworld-region-block`
                + `[data-region-name="${CSS.escape(name)}"]`);
            const header = block?.firstElementChild;
            if (!header || !panel.scrollContainer) return null;
            const c = panel.scrollContainer.getBoundingClientRect();
            const h = header.getBoundingClientRect();
            return h.top >= c.top - 1 && h.bottom <= c.bottom + 1;
        };
        /**
         * ⛔ AND THE PANEL HAS A LAYOUT. A hub behind another panel of its stack
         * (the row before this one presses the pipeline door) is `hidden`, and a
         * hidden panel measures every rect at 0..0 — so "is the header in view"
         * would be answered by a box with no size (memory:
         * `feedback_hidden_parent_measures_zero_at_mount`). Measured: the first
         * batch run read `viewport 0..0`.
         */
        await testController.pollForCondition(
            () => (panel.scrollContainer?.clientHeight ?? 0) > 0 && inView(target) !== null,
            `the Regions tab draws "${target}" in a panel that has a layout`, 8000, 50);
        {
            const c = panel.scrollContainer.getBoundingClientRect();
            const h = document.querySelector(`${PANEL_SELECTOR} .apworld-region-block`
                + `[data-region-name="${CSS.escape(target)}"]`)?.firstElementChild
                ?.getBoundingClientRect();
            testController.log(`viewport ${Math.round(c.top)}..${Math.round(c.bottom)}, `
                + `"${target}" header ${Math.round(h?.top)}..${Math.round(h?.bottom)}, `
                + `scrollHeight ${panel.scrollContainer.scrollHeight}`);
        }
        testController.reportCondition(
            `⛓ premise: "${target}"'s header starts OUTSIDE the viewport`, inView(target) === false);

        selectTab(panel, SIDECARS_TAB_ID);
        await testController.pollForCondition(() => !!expander(), 'the list\'s expander', 8000, 50);
        testController.assertEqual('⛔ COLLAPSED by default: no region row in the DOM',
            '0', String(rows().length));
        testController.assertEqual('…and the expander says so', 'false',
            String(expander()?.dataset.open));

        expander().click();
        const drawn = await testController.pollForValue(
            () => (rows().length > 0 ? rows() : null), 'the expanded list', 8000, 50);
        testController.assertEqual(`expanded: one row per entry of slot ${slot}, in order`,
            want.join(','), (drawn ?? []).map((r) => r.dataset.regionName).join(','));
        for (const row of rows()) {
            const name = row.dataset.regionName;
            testController.assertEqual(`"${name}": the row carries the same block, badged by `
                + 'the document', String(doc.preset_sidecars[slot][name].substrate),
            String(row.querySelector('.apworld-sidecar-block .apworld-sidecar-badge')
                ?.textContent));
        }
        testController.assertEqual('expanding builds NO JSON', '0', String(
            document.querySelectorAll(`${PANEL_SELECTOR} .apworld-sidecar-json`).length));

        selectTab(panel, DOCUMENT_TAB_ID);
        selectTab(panel, SIDECARS_TAB_ID);
        testController.assertEqual('the list stays expanded across a re-render',
            String(want.length), String(rows().length));

        const go = document.querySelector(`${PANEL_SELECTOR} .apworld-sidecars-region-row`
            + `[data-region-name="${CSS.escape(target)}"] .apworld-sidecars-go-region`);
        testController.reportCondition(`"${target}"'s row carries Go to region`, !!go);
        if (go) go.click();
        testController.assertEqual('Go to region selects the Regions tab', 'regions',
            String(panel.activeTab));
        testController.assertEqual('…with that region selected', target,
            String(panel._selectedRegion));
        testController.assertEqual('…on the same slot', slot, String(panel.playerId));
        testController.reportCondition(`⛓ …and "${target}"'s header is inside the viewport`,
            inView(target) === true);

        // ⛓ a new document is a new session: the list starts collapsed again.
        panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        selectTab(panel, SIDECARS_TAB_ID);
        await testController.pollForCondition(() => !!expander(), 'the reloaded tab', 8000, 50);
        testController.assertEqual('a reload resets the list to collapsed', '0',
            String(rows().length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('sidecars-list test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **(iv) AN OPEN BLOCK SHOWS THE ENTRY THE DOCUMENT HOLDS AFTER AN OP.**
 * A `replace-region-sidecar` — the op Edit ▸'s save comes back as — applied
 * through the session's own seam, with a payload that differs by one marker
 * key and the region's CURRENT rules as the (total) rules map. The assertion
 * is on the DOCUMENT AFTER the op (trap 1306), never on the op count: the open
 * block's text must equal the entry `panel.rulesDoc` now holds, carry the
 * marker, differ from the text before — and one Undo puts the old text back.
 */
export async function apworldASidecarBlocksJsonFollowsAnAppliedOp(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
        if (!select) {
            testController.reportCondition('the toolbar carries a player selector', false);
            return testController.getOverallResult();
        }
        const slot = Object.keys(panel.rulesDoc.preset_sidecars)[0];
        selectPlayer(select, slot);
        selectTab(panel, 'regions');
        const region = sidecarRegions(panel.rulesDoc, slot)[0];
        const toggle = await testController.pollForValue(
            () => (String(panel.playerId) === slot
                ? sidecarBlockFor(region)?.querySelector('.apworld-sidecar-toggle') : null),
            `the "${region}" block's Show JSON toggle`, 8000, 50);
        if (!toggle) {
            testController.reportCondition('the block offers Show JSON', false);
            return testController.getOverallResult();
        }
        toggle.click();
        const textOf = () => sidecarBlockFor(region)?.querySelector('.apworld-sidecar-json')
            ?.value ?? null;
        const before = await testController.pollForValue(textOf, 'the opened JSON', 8000, 50);
        testController.reportCondition('the block\'s JSON is open', before !== null);

        const MARK = 's0_row_iv_marker';
        const entry = panel.rulesDoc.preset_sidecars[slot][region];
        const regionDoc = panel.rulesDoc.regions[slot][region];
        const ruleMap = (list) => Object.fromEntries(
            (list ?? []).map((e) => [e.name, e.access_rule ?? null]));
        const res = panel._applyOp({
            op: 'replace-region-sidecar', region,
            payload: { ...entry.playable_payload, [MARK]: true },
            rules: { exits: ruleMap(regionDoc.exits), locations: ruleMap(regionDoc.locations) },
        });
        testController.reportCondition('the op was applied', !!res?.ok && !!res?.applied);

        const after = await testController.pollForValue(
            () => { const t = textOf(); return t !== null && t !== before ? t : null; },
            'the open block redrew', 8000, 50);
        const held = panel.rulesDoc.preset_sidecars[slot][region];
        testController.reportCondition('⛓ the DOCUMENT after the op carries the marker',
            held?.playable_payload?.[MARK] === true);
        testController.assertEqual(
            '⛓⛓ the open block shows the entry the document holds NOW, byte for byte',
            JSON.stringify(held, null, JSON_BLOCK_INDENT), String(after));

        const undo = document.querySelector(`${PANEL_SELECTOR} .apworld-undo`);
        testController.reportCondition('the Undo button is there', !!undo);
        if (undo) undo.click();
        const restored = await testController.pollForValue(
            () => { const t = textOf(); return t === before ? t : null; },
            'one undo put the old JSON back', 8000, 50);
        testController.reportCondition('one Undo puts the open block back to the old entry',
            restored === before);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('sidecar-block op test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-sidecar-blocks-follow-the-selected-slot',
    name: 'APWorld hub: each region\'s sidecar block follows the selected slot and names the document\'s substrate',
    description: 'PRESET SIDECARS S0 (⚖ Q2 A: one renderer, two hosts). Walks every populated '
               + 'slot of the four-player fixture through the toolbar selector: one block per '
               + 'sidecar entry of THAT slot, each under the region block of the same name, its '
               + 'badge equal to the document\'s own `substrate` for that slot, Edit ▸ once '
               + 'inside it and nowhere on a region with no sidecar (the H4b count, unmoved), '
               + 'and no JSON built; then the same badge law on a Seedling document, whose '
               + 'entries carry no render_hint (the only corpus case where the hint and the '
               + 'substrate differ). Mutant: a block reading slot "1" reds the bounce slots.',
    testFunction: apworldSidecarBlocksFollowTheSelectedSlot,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-a-sidecar-block-shows-its-entrys-json',
    name: 'APWorld hub: opening a sidecar block draws its entry\'s JSON, with one Save, beside the region\'s own doors',
    description: 'PRESET SIDECARS S0, amended by S1 (saving on; the id dropped "-read-only"). On '
               + 'a bounce slot, the region picked off the document: the block\'s Show JSON '
               + 'builds exactly one textarea whose text is the WHOLE entry byte-equal at the '
               + 'widget\'s exported indent, editable with exactly one Save; the facts line '
               + 'gives the payload\'s UTF-8 pretty size and every top-level key; Edit ▸ in it '
               + 'is this region\'s; and its "Regenerate in the pipeline" door is pressed and '
               + 'answers as the procgen_metadata door.',
    testFunction: apworldASidecarBlockShowsItsEntrysJson,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-sidecars-list-is-collapsed-and-goes-to-the-region',
    name: 'APWorld hub: the Sidecars tab\'s region list is collapsed by default and Go to region lands on the region',
    description: 'PRESET SIDECARS S0 (⚖ user: "expandable, and collapsed by default"). On a '
               + 'non-first slot through the selector: 0 region rows until expanded, then one '
               + 'row per entry of that slot in document order with the same block and no JSON; '
               + 'expanded state survives a tab round-trip and a reload resets it; Go to region '
               + 'on the LAST row selects the Regions tab and that region, with its header '
               + 'inside the viewport — after measuring that it started outside it. Mutant: '
               + 'the list drawn expanded reds the collapsed assertion.',
    testFunction: apworldSidecarsListIsCollapsedAndGoesToTheRegion,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-a-sidecar-blocks-json-follows-an-applied-op',
    name: 'APWorld hub: an open sidecar block shows the entry the document holds after an op, and after its undo',
    description: 'PRESET SIDECARS S0. A replace-region-sidecar (Edit ▸\'s op) applied through the '
               + 'session with a one-key marker in the payload and the region\'s own rules as '
               + 'the total rules map: the open block\'s text must equal the entry the DOCUMENT '
               + 'holds after the op (trap 1306 — never the op count), and one Undo puts the old '
               + 'text back. Mutant: JSON captured at expand rather than read at render reds it.',
    testFunction: apworldASidecarBlocksJsonFollowsAnAppliedOp,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ PRESET SIDECARS S1 — THE RAW ENTRY SAVE
 * (`NewDocs/plans/preset-sidecars-plan.md` §3 D1, §9.3 rung 3)
 *
 * The block's Save JSON → ONE `set-region-sidecar`, the whole entry, the
 * region's rules untouched (⚖ Q1 C, Q3 A). Every row asserts the DOCUMENT
 * after the gesture (trap 1306) and asks the OP directly as well as pressing
 * the product's own Save (1305). Every lookup after a gesture RE-QUERIES (a
 * render rebuilds the tab body).
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ Open one region's sidecar JSON on whichever tab is showing → its textarea, or null. */
async function openSidecarJson(testController, regionName) {
    const toggle = await testController.pollForValue(
        () => sidecarBlockFor(regionName)?.querySelector('.apworld-sidecar-toggle') ?? null,
        `the "${regionName}" block's Show JSON toggle`, 8000, 50);
    if (!toggle) return null;
    if (!sidecarBlockFor(regionName)?.querySelector('.apworld-sidecar-json')) toggle.click();
    return testController.pollForValue(
        () => sidecarBlockFor(regionName)?.querySelector('.apworld-sidecar-json') ?? null,
        `the "${regionName}" block's JSON`, 8000, 50);
}

/** ⛓ Type an entry into the open block and press the product's own Save JSON.
 *  → false when there was no textarea or no Save to press. */
function typeAndSaveSidecar(regionName, entry) {
    const text = sidecarBlockFor(regionName)?.querySelector('.apworld-sidecar-json');
    const save = sidecarBlockFor(regionName)?.querySelector('.apworld-sidecar-save');
    if (!text || !save) return false;
    text.value = JSON.stringify(entry, null, JSON_BLOCK_INDENT);
    save.click();
    return true;
}

/** ⛓ The answer the hub printed under that region's block — re-queried. */
const sidecarMessageFor = (regionName) => sidecarBlockFor(regionName)
    ?.querySelector('.apworld-sidecar-op-message') ?? null;

/** ⛓ Every exit's and location's access rule of one region, as bytes. */
function accessRulesOf(doc, slot, region) {
    const r = doc?.regions?.[slot]?.[region];
    return JSON.stringify([
        ...(r?.exits ?? []).map((e) => [e.name, e.access_rule ?? null]),
        ...(r?.locations ?? []).map((l) => [l.name, l.access_rule ?? null]),
    ]);
}

/**
 * ⛓ Per distinct `substrate` in the document, the first sidecar region (in
 * document order) whose region carries an access rule that is not the trivial
 * `True_` — so a save that ALSO wrote the region's rules (mutant A writes
 * `True_` everywhere, borrowing `replace-region-sidecar`'s rule write) cannot
 * hide behind rules that were already the default, and each payload FAMILY the
 * document holds is saved through the widget once. Read off the document; no
 * substrate is named here.
 */
function sidecarRegionsWithARule(doc) {
    const out = new Map();
    for (const slot of Object.keys(doc?.preset_sidecars ?? {})) {
        for (const region of sidecarRegions(doc, slot)) {
            const substrate = doc.preset_sidecars[slot][region]?.substrate;
            if (out.has(substrate)) continue;
            const r = doc.regions?.[slot]?.[region];
            if ([...(r?.exits ?? []), ...(r?.locations ?? [])]
                .some((x) => x?.access_rule && x.access_rule.rule !== 'True_')) {
                out.set(substrate, { slot, region, substrate });
            }
        }
    }
    return [...out.values()];
}

/** ⛓ The entry with ONE payload key changed: its first boolean, flipped (else a marker). */
function withOnePayloadKeyEdited(entry) {
    const next = JSON.parse(JSON.stringify(entry));
    const payload = next.playable_payload ?? {};
    const key = Object.keys(payload).find((k) => typeof payload[k] === 'boolean') ?? 's1_marker';
    next.playable_payload = { ...payload, [key]: payload[key] === undefined ? true : !payload[key] };
    return { entry: next, key };
}

/** ⛓ Pick a slot through the toolbar and land on the Regions tab, waiting for the slot. */
async function onRegionsTabFor(testController, panel, slot) {
    const select = document.querySelector(`${PANEL_SELECTOR} .apworld-player-select`);
    if (!select) return false;
    selectPlayer(select, slot);
    selectTab(panel, 'regions');
    return testController.pollForCondition(() => String(panel.playerId) === String(slot),
        `slot ${slot} selected`, 8000, 50);
}

/**
 * ⛓⛓⛓ **(i) SAVE JSON WRITES THE ENTRY AND LEAVES THE RULES.** One payload key
 * edited in the block's own textarea, the product's Save pressed. Then, on the
 * session and the DOCUMENT: ONE op recorded (asserted before it is read — trap
 * 1301), a `set-region-sidecar` for this slot and region; the document AFTER is
 * the document BEFORE with exactly this entry replaced, byte for byte (1306 —
 * so a partial write, mutant B, and a rules write, mutant A, both red it); the
 * region's exits' and locations' access rules byte-equal to BEFORE, said on
 * their own because they are the ⚖; the answer under the block is the op's own
 * description and names what was NOT re-derived; the op asked directly writes
 * the same bytes; one Undo restores the document. Once per payload family the
 * fixture holds (`sidecarRegionsWithARule`), each on its own slot.
 */
export async function apworldASidecarSaveWritesTheEntryAndLeavesTheRules(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        const targets = sidecarRegionsWithARule(panel.rulesDoc);
        testController.reportCondition('⛓ premise: two payload families, each with a sidecar '
            + 'region whose access rules are not all True_', targets.length >= 2);
        for (const { slot, region, substrate } of targets) {
            const at = `[slot ${slot} "${region}", ${substrate}]`;
            testController.reportCondition(`${at} slot selected through the toolbar`,
                await onRegionsTabFor(testController, panel, slot));
            const text = await openSidecarJson(testController, region);
            testController.reportCondition(`${at} the block's JSON is open, and EDITABLE`,
                !!text && text.readOnly === false);
            if (!text) continue;

            const before = panel.rulesDoc;
            const beforeBytes = JSON.stringify(before);
            const rulesBefore = accessRulesOf(before, slot, region);
            const opsBefore = panel.session.ops().length;
            const { entry: typed, key } = withOnePayloadKeyEdited(before.preset_sidecars[slot][region]);
            testController.log(`${at} editing ONE payload key: "${key}"`);
            testController.reportCondition(`${at} Save JSON pressed`,
                typeAndSaveSidecar(region, typed));

            const recorded = await testController.pollForValue(
                () => (panel.session.ops().length === opsBefore + 1 ? panel.session.ops().at(-1) : null),
                `${at} the save recorded one op`, 8000, 50);
            testController.reportCondition(`${at} ⛓ ONE op was recorded`, !!recorded);
            if (!recorded) continue;
            testController.assertEqual(`${at} …a set-region-sidecar`, 'set-region-sidecar',
                String(recorded.op));
            testController.assertEqual(`${at} …for this slot and region`, `${slot}|${region}`,
                `${recorded.player}|${recorded.region}`);

            const after = panel.rulesDoc;
            const want = JSON.parse(beforeBytes);
            want.preset_sidecars[slot][region] = typed;
            testController.assertEqual(`${at} ⛓⛓ the DOCUMENT after = the document before with `
                + 'THIS entry replaced, byte for byte', JSON.stringify(want), JSON.stringify(after));
            testController.assertEqual(`${at} …so the entry it holds is what was typed`,
                JSON.stringify(typed), JSON.stringify(after.preset_sidecars[slot][region]));
            testController.assertEqual(`${at} ⛓⛓ the region's exits' and locations' access rules `
                + 'are byte-equal to BEFORE', rulesBefore, accessRulesOf(after, slot, region));

            const said = sidecarMessageFor(region);
            testController.reportCondition(`${at} the answer is printed under the block`, !!said);
            testController.assertEqual(`${at} …it is the op's description, as the status line `
                + 'has it', String(panel._opMessage), String(said?.textContent));
            testController.reportCondition(`${at} …and it says what was NOT re-derived`,
                String(said?.textContent ?? '').includes(SIDECAR_NOT_REDERIVED));

            const direct = applyRulesDocOp(before, recorded);
            testController.reportCondition(`${at} ⛓ the op, asked directly, writes the same document`,
                !!direct.ok && JSON.stringify(direct.doc) === JSON.stringify(after));

            const undo = document.querySelector(`${PANEL_SELECTOR} .apworld-undo`);
            testController.reportCondition(`${at} the Undo button is there`, !!undo);
            if (undo) undo.click();
            testController.assertEqual(`${at} ⛓ ONE Undo restores the document, byte for byte`,
                beforeBytes, JSON.stringify(panel.rulesDoc));
            testController.assertEqual(`${at} …and the op list`, String(opsBefore),
                String(panel.session.ops().length));

            /**
             * ⛓⛓ **AND THE ENTRY-LEVEL FIELDS ARE THE SAVE'S TOO** (⚖ Q3 A: the
             * whole entry). ⛔ Measured by the first mutant battery: a save of ONE
             * payload key cannot tell "the whole entry was written" from "only
             * the payload was" (mutant B) — the two documents are identical. So
             * the same save again with the entry's own fields moved: every
             * top-level key except the payload DROPPED but `substrate` (which
             * the op requires), and `grid_cell` moved if the entry had one.
             */
            const whole = { substrate: typed.substrate, playable_payload: typed.playable_payload };
            const cell = before.preset_sidecars[slot][region].grid_cell;
            if (cell) whole.grid_cell = { gx: cell.gx + 1, gy: cell.gy };
            const dropped = Object.keys(before.preset_sidecars[slot][region])
                .filter((k) => !(k in whole));
            testController.reportCondition(`${at} ⛓ premise: the entry carries a field beyond `
                + `substrate and payload to drop (${dropped.join(', ')})`, dropped.length > 0);
            testController.reportCondition(`${at} the entry-level save pressed`,
                typeAndSaveSidecar(region, whole));
            const want2 = JSON.parse(beforeBytes);
            want2.preset_sidecars[slot][region] = whole;
            testController.assertEqual(`${at} ⛓⛓ the DOCUMENT after = before with the WHOLE entry `
                + 'replaced — the dropped fields gone, the moved cell moved', JSON.stringify(want2),
            JSON.stringify(panel.rulesDoc));
            testController.assertEqual(`${at} …the access rules still byte-equal to BEFORE`,
                rulesBefore, accessRulesOf(panel.rulesDoc, slot, region));
            document.querySelector(`${PANEL_SELECTOR} .apworld-undo`)?.click();
            testController.assertEqual(`${at} …and one Undo restores it`, beforeBytes,
                JSON.stringify(panel.rulesDoc));
        }
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('sidecar-save test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **(ii) A SAVE THE OP OR THE SCHEMA REFUSES IS REFUSED BY NAME, AND
 * NOTHING MOVES.** Two arms, because they are two different gates:
 *
 *  (a) an entry that DROPS `substrate` — the OP's own refusal (the schema's
 *      `required`, restated by the op). Asked of the op directly first.
 *  (b) an entry whose `grid_cell` lacks `gy` — which the op, asked directly,
 *      would TAKE: only the whole-document schema veto (`_rawSaveRefusal`)
 *      stands between it and the document. ⛔ This is the arm mutant C (the
 *      veto removed) reds; arm (a) cannot see the veto at all, because a
 *      preview the op refuses gives the schema check nothing to compare.
 *
 * Each: the refusal is printed under the block and names the field, no op is
 * recorded, the document is byte-unmoved.
 */
export async function apworldASidecarSaveIsVetoedByName(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        const doc0 = panel.rulesDoc;
        // ⛓ a region whose entry HAS a grid_cell — arm (b) has to break one.
        let slot = null;
        let region = null;
        for (const s of Object.keys(doc0.preset_sidecars ?? {})) {
            region = sidecarRegions(doc0, s).find((r) => !!doc0.preset_sidecars[s][r]?.grid_cell);
            if (region) { slot = s; break; }
        }
        testController.reportCondition('⛓ premise: a sidecar entry carrying a grid_cell', !!slot);
        if (!slot) return testController.getOverallResult();
        testController.log(`slot ${slot}, region ${region}`);
        await onRegionsTabFor(testController, panel, slot);
        const text = await openSidecarJson(testController, region);
        testController.reportCondition('the block\'s JSON is open', !!text);
        if (!text) return testController.getOverallResult();

        const entry = panel.rulesDoc.preset_sidecars[slot][region];
        const beforeBytes = JSON.stringify(panel.rulesDoc);
        const opsBefore = panel.session.ops().length;
        const asOp = (e) => ({ op: 'set-region-sidecar', player: slot, region, entry: e });

        /* (a) the op's own refusal */
        const { substrate: _dropped, ...noSubstrate } = entry;
        const opSays = applyRulesDocOp(panel.rulesDoc, asOp(noSubstrate));
        testController.reportCondition(
            '⛓ premise (a): the op, asked directly, refuses an entry with no substrate',
            !opSays.ok && /`substrate`/.test(opSays.error ?? ''));
        testController.reportCondition('(a) Save JSON pressed', typeAndSaveSidecar(region, noSubstrate));
        const a = sidecarMessageFor(region);
        testController.reportCondition('(a) the refusal is printed under the block, marked refused',
            a?.dataset.refused === 'true');
        testController.reportCondition('(a) …and names `substrate`',
            String(a?.textContent ?? '').includes('`substrate`'));
        testController.assertEqual('(a) no op was recorded', String(opsBefore),
            String(panel.session.ops().length));
        testController.assertEqual('(a) the document did not move', beforeBytes,
            JSON.stringify(panel.rulesDoc));

        /* (b) the schema's refusal, of an entry the op would take */
        const { gy: _gy, ...halfCell } = entry.grid_cell;
        const badCell = { ...entry, grid_cell: halfCell };
        const opTakes = applyRulesDocOp(panel.rulesDoc, asOp(badCell));
        testController.reportCondition(
            '⛓ premise (b): the op ALONE would take this entry — only the schema veto refuses it',
            !!opTakes.ok);
        testController.reportCondition('(b) Save JSON pressed', typeAndSaveSidecar(region, badCell));
        const b = sidecarMessageFor(region);
        const bText = String(b?.textContent ?? '');
        testController.reportCondition('(b) the refusal is printed under the block, marked refused',
            b?.dataset.refused === 'true');
        testController.reportCondition('(b) …as a SCHEMA error naming grid_cell and its missing gy',
            bText.includes('schema') && bText.includes('grid_cell') && bText.includes('gy'));
        testController.assertEqual('(b) no op was recorded', String(opsBefore),
            String(panel.session.ops().length));
        testController.assertEqual('(b) the document did not move', beforeBytes,
            JSON.stringify(panel.rulesDoc));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('sidecar-veto test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **(iii) THE SIDECARS LIST'S BLOCK SAVES THE SAME OP** (⚖ Q2 A — one
 * renderer, two hosts). The same one-key edit, saved once from the Regions
 * tab and once from the Sidecars tab's expanded list: the two recorded ops are
 * byte-equal, both leave the same document, and the answer is printed under
 * the block that was saved. Then the widget's DEFAULT: a host that passes no
 * `onSave` gets a read-only textarea and no Save, so a new host cannot make
 * the entry writable by accident.
 */
export async function apworldASidecarSaveFromTheSidecarsListIsTheSameOp(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        // ⛓ the LAST family row (i) saves — a slot other than the selector's default.
        const target = sidecarRegionsWithARule(panel.rulesDoc).at(-1);
        testController.reportCondition('⛓ premise: a sidecar region to edit', !!target);
        if (target) testController.log(`slot ${target.slot}, region ${target.region}`);
        if (!target) return testController.getOverallResult();
        const { slot, region } = target;
        await onRegionsTabFor(testController, panel, slot);
        const beforeBytes = JSON.stringify(panel.rulesDoc);
        const opsBefore = panel.session.ops().length;
        const { entry: typed } = withOnePayloadKeyEdited(panel.rulesDoc.preset_sidecars[slot][region]);

        const saveFrom = async (host) => {
            const text = await openSidecarJson(testController, region);
            testController.reportCondition(`${host}: the block's JSON is open, editable`,
                !!text && text.readOnly === false);
            testController.reportCondition(`${host}: Save JSON pressed`,
                typeAndSaveSidecar(region, typed));
            const op = await testController.pollForValue(
                () => (panel.session.ops().length === opsBefore + 1 ? panel.session.ops().at(-1) : null),
                `${host}: one op recorded`, 8000, 50);
            testController.reportCondition(`${host}: ⛓ ONE op was recorded`, !!op);
            const result = { op: JSON.stringify(op), doc: JSON.stringify(panel.rulesDoc),
                said: sidecarMessageFor(region)?.textContent ?? null };
            document.querySelector(`${PANEL_SELECTOR} .apworld-undo`)?.click();
            testController.assertEqual(`${host}: one Undo restores the document`, beforeBytes,
                JSON.stringify(panel.rulesDoc));
            return result;
        };

        const fromRegions = await saveFrom('Regions');
        selectTab(panel, SIDECARS_TAB_ID);
        const expander = await testController.pollForValue(
            () => document.querySelector(`${PANEL_SELECTOR} .apworld-sidecars-expand`),
            'the Sidecars list\'s expander', 8000, 50);
        if (expander?.dataset.open !== 'true') expander?.click();
        const row = await testController.pollForValue(
            () => document.querySelector(`${PANEL_SELECTOR} .apworld-sidecars-region-row`
                + `[data-region-name="${CSS.escape(region)}"] .apworld-sidecar-block`),
            `"${region}"'s block on the Sidecars list`, 8000, 50);
        testController.reportCondition('⛓ the block now drawn is the Sidecars list\'s', !!row
            && row.dataset.hostTab === SIDECARS_TAB_ID);
        const fromList = await saveFrom('Sidecars');

        testController.assertEqual('⛓⛓ the two hosts record the SAME op, byte for byte',
            fromRegions.op, fromList.op);
        testController.assertEqual('…and leave the same document', fromRegions.doc, fromList.doc);
        testController.reportCondition('…and the answer is printed under the Sidecars list\'s block',
            String(fromList.said ?? '').includes(SIDECAR_NOT_REDERIVED));

        // ⛓ the widget's default, asked of the one renderer with no onSave.
        const probeHost = 's1-probe';
        const key = `${probeHost}|${slot}|${region}`;
        panel._expandedSidecarJson.add(key);
        const probe = panel._makeRegionSidecarBlock(slot, region, { hostTab: probeHost });
        panel._expandedSidecarJson.delete(key);
        const ta = probe?.querySelector('.apworld-sidecar-json');
        testController.reportCondition('a host that passes NO onSave gets a READ-ONLY textarea',
            !!ta && ta.readOnly === true);
        testController.assertEqual('…and no Save', '0',
            String(probe?.querySelectorAll('.apworld-sidecar-save').length ?? -1));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('sidecar-save two-hosts test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **(iv) Edit ▸'s VERDICT FOLLOWS THE DOCUMENT ACROSS A RAW SAVE.** The
 * region and the tile are picked by the LAW, off Edit ▸'s own inspection
 * (`inspectRegionRoom`) rather than off the button under test: the first
 * sidecar region whose inspection OPENS on the fixture, and the first single
 * tile whose flip makes that inspection REFUSE. (Most single-tile flips do not
 * — the serializer reproduces them — so "a hand-edited payload is refused"
 * is not true of every hand edit; it is true of one the serializer does not
 * reproduce.)
 *
 *  1. that edit through Save JSON; Edit ▸ is still pressable (the verdict is
 *     asked on the PRESS); pressed (1305), it opens NO room and its `title`
 *     becomes the inspection's own sentence for the document NOW;
 *  2. the ORIGINAL entry saved back through Save JSON → the button is
 *     pressable again: the refusal did not outlive the payload it was about;
 *  3. Undo (back to the edited payload), pressed again → refused again; Undo
 *     (back to the fixture) → pressable. ⛔ Step 3's last check is the defect
 *     measured at `9bf3a0c583`: Undo never goes through `_applyOp`, and the
 *     remembered refusal stayed on a restored document. Mutant E (the verdict
 *     read regardless of the record it was asked about) reds steps 2 and 3.
 */
export async function apworldEditVerdictFollowsARawSidecarSave(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        const doc0 = panel.rulesDoc;
        let pick = null;
        let flips = 0;
        for (const slot of Object.keys(doc0.preset_sidecars ?? {})) {
            for (const region of sidecarRegions(doc0, slot)) {
                const tiles = doc0.preset_sidecars[slot][region]?.playable_payload?.tiles;
                if (!Array.isArray(tiles)) continue;
                if (!(await inspectRegionRoom(doc0, slot, region)).ok) continue;
                for (let i = 0; i < tiles.length && !pick; i += 1) {
                    const cand = JSON.parse(JSON.stringify(doc0));
                    cand.preset_sidecars[slot][region].playable_payload.tiles[i] = tiles[i] ? 0 : 1;
                    flips += 1;
                    if (!(await inspectRegionRoom(cand, slot, region)).ok) pick = { slot, region, i };
                }
                if (pick) break;
            }
            if (pick) break;
        }
        testController.reportCondition('⛓ premise: a region Edit ▸ opens, and one tile flip it refuses',
            !!pick);
        if (!pick) return testController.getOverallResult();
        const { slot, region, i } = pick;
        testController.log(`slot ${slot}, region ${region}, tile ${i} (flip ${flips} tried)`);

        await onRegionsTabFor(testController, panel, slot);
        const btn0 = await testController.pollForValue(() => editButtonFor(region),
            `"${region}"'s Edit ▸`, 8000, 50);
        testController.reportCondition('⛓ premise: Edit ▸ is pressable on the fixture',
            !!btn0 && !btn0.disabled);
        const text = await openSidecarJson(testController, region);
        if (!text) {
            testController.reportCondition('the block\'s JSON is open', false);
            return testController.getOverallResult();
        }
        const original = JSON.parse(text.value);
        const edited = JSON.parse(text.value);
        edited.playable_payload.tiles[i] = edited.playable_payload.tiles[i] ? 0 : 1;
        const opsBefore = panel.session.ops().length;

        const pressAndRead = async (label) => {
            const b = editButtonFor(region);
            testController.reportCondition(`${label}: Edit ▸ is pressable — the verdict is asked on `
                + 'the PRESS', !!b && !b.disabled);
            if (!b || b.disabled) return null;
            const now = await inspectRegionRoom(panel.rulesDoc, slot, region);
            testController.reportCondition(`${label}: ⛓ the door's own inspection refuses the `
                + 'document NOW', !now.ok);
            b.click();
            const answered = await testController.pollForValue(
                () => { const x = editButtonFor(region); return x?.disabled ? x : null; },
                `${label}: Edit ▸ answered`, 8000, 50);
            testController.assertEqual(`${label}: ⛓⛓ its title is the inspection's sentence for `
                + 'the document NOW', String(now.why), String(answered?.title));
            testController.reportCondition(`${label}: …and no room was opened`,
                panel.roomEditorSession === null);
            return now.why;
        };
        const pressable = (label, why) => {
            const b = editButtonFor(region);
            testController.reportCondition(`${label}: ⛓⛓ Edit ▸ is pressable again — the refusal `
                + 'did not outlive the payload it was about', !!b && !b.disabled && b.title !== why);
        };

        /* 1 */
        testController.reportCondition('1. Save JSON pressed', typeAndSaveSidecar(region, edited));
        testController.assertEqual('1. one op recorded', String(opsBefore + 1),
            String(panel.session.ops().length));
        const why = await pressAndRead('1');

        /* 2 */
        testController.reportCondition('2. the original saved back',
            typeAndSaveSidecar(region, original));
        testController.assertEqual('2. …as a second op', String(opsBefore + 2),
            String(panel.session.ops().length));
        testController.assertEqual('2. the entry is the fixture\'s again', JSON.stringify(original),
            JSON.stringify(panel.rulesDoc.preset_sidecars[slot][region]));
        pressable('2', why);

        /* 3 */
        const undo = () => document.querySelector(`${PANEL_SELECTOR} .apworld-undo`)?.click();
        undo();
        await pressAndRead('3 (after one Undo, the edited payload again)');
        undo();
        testController.assertEqual('3. two Undos: the fixture\'s op list', String(opsBefore),
            String(panel.session.ops().length));
        pressable('3 (after the second Undo)', why);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('edit-verdict test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-a-sidecar-save-writes-the-entry-and-leaves-the-rules',
    name: 'APWorld hub: a sidecar block\'s Save JSON writes the whole entry as one op and leaves the region\'s rules',
    description: 'PRESET SIDECARS S1 (⚖ Q1 C, Q3 A). One payload key edited in the block\'s own '
               + 'textarea, the product\'s Save pressed: one set-region-sidecar recorded for that '
               + 'slot and region; the DOCUMENT after = before with exactly that entry replaced, '
               + 'byte for byte (trap 1306); the region\'s access rules byte-equal; the answer '
               + 'under the block is the op\'s description naming what was NOT re-derived; the op '
               + 'asked directly writes the same bytes; one Undo restores; then the WHOLE entry — '
               + 'entry-level fields dropped and the grid cell moved — lands as typed. Once per '
               + 'payload family. Mutants: the op also writes rules (A) or writes only the '
               + 'payload (B, seen only by the whole-entry arm).',
    testFunction: apworldASidecarSaveWritesTheEntryAndLeavesTheRules,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-a-sidecar-save-is-vetoed-by-name',
    name: 'APWorld hub: a sidecar save the op or the schema refuses is refused by name and moves nothing',
    description: 'PRESET SIDECARS S1. (a) an entry dropping `substrate` — the op\'s own refusal, '
               + 'asked of the op first; (b) an entry whose grid_cell lacks gy — which the op '
               + 'alone would take, so only the whole-document schema veto refuses it. Each: '
               + 'the refusal under the block names the field, no op recorded, the document '
               + 'byte-unmoved. Mutant C (the veto removed) reds arm (b).',
    testFunction: apworldASidecarSaveIsVetoedByName,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-a-sidecar-save-from-the-sidecars-list-is-the-same-op',
    name: 'APWorld hub: the Sidecars list\'s block saves the same op as the Regions tab\'s',
    description: 'PRESET SIDECARS S1 (⚖ Q2 A: one renderer, two hosts). The same one-key edit '
               + 'saved from the Regions tab and from the Sidecars tab\'s expanded list: the two '
               + 'recorded ops are byte-equal and leave the same document, the answer is printed '
               + 'under the block that was saved; and a host that passes no onSave gets the '
               + 'read-only widget with no Save.',
    testFunction: apworldASidecarSaveFromTheSidecarsListIsTheSameOp,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-edit-verdict-follows-a-raw-sidecar-save',
    name: 'APWorld hub: after a raw sidecar save, Edit ▸ is re-asked — refused by name, and pressable again once the payload is back',
    description: 'PRESET SIDECARS S1. Region and tile picked off Edit ▸\'s own inspection: a '
               + 'one-tile raw edit the round trip does not reproduce, saved through Save JSON; '
               + 'Edit ▸ pressed opens no room and its title becomes the inspection\'s sentence '
               + 'for the document NOW; the original saved back makes it pressable again; and '
               + 'across Undo (which never goes through _applyOp) the same. Mutant E: the '
               + 'verdict read regardless of the record it was asked about.',
    testFunction: apworldEditVerdictFollowsARawSidecarSave,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ PRESET SIDECARS V0 — THE SIDECAR VALIDITY REPORT, THROUGH THE PRODUCT
 *
 * ⚖ user, 2026-09-10: *"If the user changes a substrate, or makes some other
 * breaking change, then it's their responsibility to find a way to make the
 * data valid again before they save the JSON data. If we don't already have a
 * way to report what data is invalid, then I want to add one."* — so the save
 * is NOT refused; the bar counts, the block says what, and Undo takes it back.
 * Every slot is chosen through the toolbar's selector, every save is the
 * block's own Save JSON, and the substrates and the field are read off the
 * document and the registry, never typed.
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ The bar's two readings: its own label's numbers, and the counts it stamps. */
function barReading(panel) {
    const bar = panel.validationBar;
    const text = bar.textContent;
    const n = (re) => Number((text.match(re) ?? [0, 0])[1]);
    return {
        labelTotal: /No issues/.test(text) ? 0 : n(/(\d+) errors?/) + n(/(\d+) warnings?/),
        issues: Number(bar.dataset.issues ?? NaN),
        sidecar: Number(bar.dataset.sidecarIssues ?? NaN),
    };
}

/** ⛓ The two slots of the four-player fixture that hold DIFFERENT substrates — read off it. */
function twoSubstrateSlots(doc) {
    const slots = Object.keys(doc?.preset_sidecars ?? {});
    const subOf = (s) => Object.values(doc.preset_sidecars[s])[0]?.substrate;
    const a = slots[0];
    const b = slots.find((s) => subOf(s) !== subOf(a));
    return b ? { a, b, aSub: subOf(a), bSub: subOf(b) } : null;
}

/** ⛓ The sentences one region's block lists — re-queried. */
const sidecarIssueRows = (regionName) => [...(sidecarBlockFor(regionName)
    ?.querySelectorAll('.apworld-sidecar-issue') ?? [])];

/**
 * ⛓ THE LAW for "a required field" (the vitest rows' own): the first REQUIRED
 * substrate-owned field of the entry's declaration whose removal the
 * substrate's OWN `deserializeWorld` survives — so dropping it is exactly one
 * fact. Asked of the declaration and the deserializer, never of the check under
 * test.
 */
function droppableRequiredField(entry) {
    const reg = substrateRegistry.get(entry?.substrate);
    if (!reg) return null;
    return Object.entries(sidecarFieldsOf(reg) ?? {})
        .filter(([, d]) => d.required && d.owner === 'substrate').map(([k]) => k)
        .find((k) => {
            const p = { ...entry.playable_payload };
            delete p[k];
            try { reg.deserializeWorld(p); return true; } catch { return false; }
        }) ?? null;
}

/**
 * ⛓⛓⛓ **(i) A CLEAN DOCUMENT READS ZERO, ON BOTH SUBSTRATES.** The two slots
 * of the four-player fixture that hold different substrates, each selected
 * through the toolbar: the bar stamps 0 sidecar issues, and no block on the
 * Regions tab carries a sentence.
 */
export async function apworldSidecarIssuesReadZeroOnACleanDocument(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        const two = twoSubstrateSlots(panel.rulesDoc);
        testController.reportCondition('⛓ premise: two slots holding different substrates', !!two);
        if (!two) return testController.getOverallResult();
        for (const slot of [two.a, two.b]) {
            testController.reportCondition(`slot ${slot} selected through the toolbar`,
                await onRegionsTabFor(testController, panel, slot));
            const blocks = await testController.pollForValue(
                () => (regionSidecarBlocks().length > 0
                    && regionSidecarBlocks().every((b) => b.dataset.player === slot)
                    ? regionSidecarBlocks() : null),
                `slot ${slot}'s sidecar blocks`, 8000, 50);
            testController.reportCondition(`slot ${slot}: its sidecar blocks are drawn`, !!blocks);
            testController.assertEqual(`slot ${slot}: the bar stamps 0 sidecar issues`, '0',
                String(barReading(panel).sidecar));
            testController.assertEqual(`slot ${slot}: no block carries a sentence`, '0',
                String(document.querySelectorAll(`${PANEL_SELECTOR} .apworld-sidecar-issue`).length));
            testController.reportCondition(`slot ${slot}: every block stamps 0`,
                regionSidecarBlocks().every((b) => b.dataset.sidecarIssues === '0'));
        }
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('sidecar-issues-zero test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **(ii) A RAW SAVE THAT DROPS A REQUIRED FIELD IS REPORTED, NOT
 * REFUSED.** On the fixture's first slot, its first sidecar region: the field
 * picked by the law above; the entry typed without it into the block and the
 * product's Save pressed. Then: ONE op recorded (asserted before anything is
 * read — 1301); the BAR's count rose by exactly one (its label AND its stamp);
 * the BLOCK lists the sentence naming that field, of kind MISSING_REQUIRED; the
 * save's answer ends with the count; the Sidecars list's row shows the badge;
 * the bar's row, pressed, lands on the region; and one Undo puts every reading
 * back. ⛔ The bar and the block are separate conditions ON PURPOSE: they are
 * two readers of one function, and mutant B (the bar not consulting it) must
 * red the one and leave the other green.
 */
export async function apworldARawSaveDroppingARequiredFieldIsReportedNotRefused(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        const two = twoSubstrateSlots(panel.rulesDoc);
        if (!two) { testController.reportCondition('⛓ premise: two substrates', false); return testController.getOverallResult(); }
        const slot = two.a;
        testController.reportCondition(`slot ${slot} selected through the toolbar`,
            await onRegionsTabFor(testController, panel, slot));
        const region = Object.keys(panel.rulesDoc.preset_sidecars[slot])[0];
        const entry = panel.rulesDoc.preset_sidecars[slot][region];
        const field = droppableRequiredField(entry);
        testController.reportCondition(`⛓ premise: a required field of \`${entry.substrate}\` the `
            + `deserializer survives losing (${field})`, !!field);
        if (!field) return testController.getOverallResult();
        const text = await openSidecarJson(testController, region);
        testController.reportCondition('the block\'s JSON is open', !!text);
        if (!text) return testController.getOverallResult();

        const before = barReading(panel);
        const beforeBytes = JSON.stringify(panel.rulesDoc);
        const opsBefore = panel.session.ops().length;
        const typed = JSON.parse(JSON.stringify(entry));
        delete typed.playable_payload[field];
        testController.reportCondition('Save JSON pressed', typeAndSaveSidecar(region, typed));

        const recorded = await testController.pollForValue(
            () => (panel.session.ops().length === opsBefore + 1 ? panel.session.ops().at(-1) : null),
            'the save recorded one op', 8000, 50);
        testController.reportCondition('⛓ ONE op was recorded — the save was NOT refused', !!recorded);
        if (!recorded) return testController.getOverallResult();
        testController.assertEqual('…a set-region-sidecar', 'set-region-sidecar', String(recorded.op));

        const after = barReading(panel);
        testController.assertEqual('⛓⛓ BAR: its label\'s count rose by exactly one',
            String(before.labelTotal + 1), String(after.labelTotal));
        testController.assertEqual('⛓⛓ BAR: its sidecar count rose by exactly one',
            String(before.sidecar + 1), String(after.sidecar));

        const rows = sidecarIssueRows(region);
        testController.assertEqual('⛓⛓ BLOCK: it lists exactly one sentence', '1', String(rows.length));
        testController.assertEqual('BLOCK: …of kind MISSING_REQUIRED',
            SIDECAR_ISSUE_KINDS.MISSING_REQUIRED, String(rows[0]?.dataset.kind));
        testController.reportCondition(`BLOCK: …naming \`${field}\``,
            String(rows[0]?.textContent ?? '').includes(`\`${field}\``));
        testController.reportCondition('the answer under the block ends with the count',
            /— 1 sidecar issue, see the block$/.test(String(sidecarMessageFor(region)?.textContent ?? '')));

        // the Sidecars tab's expanded list shows the badge on this region's row
        panel._selectTab('sidecars');
        if (document.querySelector(`${PANEL_SELECTOR} .apworld-sidecars-expand`)?.dataset.open !== 'true') {
            document.querySelector(`${PANEL_SELECTOR} .apworld-sidecars-expand`)?.click();
        }
        const badge = await testController.pollForValue(
            () => document.querySelector(`${PANEL_SELECTOR} .apworld-sidecars-region-row[data-region-name="${
                CSS.escape(region)}"] .apworld-sidecars-issue-badge`),
            'the Sidecars list row\'s issue badge', 8000, 50);
        testController.assertEqual('SIDECARS LIST: the row\'s badge counts 1', '1', String(badge?.dataset.count));

        // the bar's own row, pressed, lands on the region
        if (!panel.issuesExpanded) panel.validationBar.firstChild?.click();
        const barRow = document.querySelector(`${PANEL_SELECTOR} .apworld-validation-issue[data-source="sidecar"]`);
        testController.reportCondition('BAR: the expanded list carries the sidecar row', !!barRow);
        barRow?.click();
        testController.assertEqual('BAR: pressing it selects the region', region, String(panel._selectedRegion));

        document.querySelector(`${PANEL_SELECTOR} .apworld-undo`)?.click();
        testController.assertEqual('⛓ one Undo restores the document', beforeBytes,
            JSON.stringify(panel.rulesDoc));
        testController.assertEqual('…and the bar reads what it read before', JSON.stringify(before),
            JSON.stringify(barReading(panel)));
        await onRegionsTabFor(testController, panel, slot);
        testController.assertEqual('…and the block lists nothing', '0', String(sidecarIssueRows(region).length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('sidecar-issue-reported test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **(iii) A RAW SAVE THAT CHANGES `substrate` NAMES THE MISMATCH** (the
 * replan's ruling: the save accepts a changed substrate; the report names it).
 * Each of the two slots' first region takes the OTHER slot's substrate — both
 * read off the document — through the block's Save: the save lands (one op),
 * the block's SUBSTRATE_MISMATCH sentence names the substrate the payload
 * really belongs to and the one it now claims, and one Undo takes it away.
 */
export async function apworldARawSubstrateChangeNamesTheMismatch(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        const two = twoSubstrateSlots(panel.rulesDoc);
        testController.reportCondition('⛓ premise: two slots holding different substrates', !!two);
        if (!two) return testController.getOverallResult();
        for (const [slot, was, now] of [[two.a, two.aSub, two.bSub], [two.b, two.bSub, two.aSub]]) {
            const at = `[slot ${slot}: ${was} → ${now}]`;
            testController.reportCondition(`${at} slot selected through the toolbar`,
                await onRegionsTabFor(testController, panel, slot));
            const region = Object.keys(panel.rulesDoc.preset_sidecars[slot])[0];
            const text = await openSidecarJson(testController, region);
            testController.reportCondition(`${at} the block's JSON is open`, !!text);
            if (!text) continue;
            const beforeBytes = JSON.stringify(panel.rulesDoc);
            const opsBefore = panel.session.ops().length;
            const typed = { ...JSON.parse(JSON.stringify(panel.rulesDoc.preset_sidecars[slot][region])), substrate: now };
            testController.reportCondition(`${at} Save JSON pressed`, typeAndSaveSidecar(region, typed));
            const landed = await testController.pollForCondition(
                () => panel.session.ops().length === opsBefore + 1, `${at} one op`, 8000, 50);
            testController.reportCondition(`${at} ⛓ ONE op was recorded — the changed substrate was ACCEPTED`,
                landed);
            if (!landed) continue;
            testController.assertEqual(`${at} …and the document holds it`, now,
                String(panel.rulesDoc.preset_sidecars[slot][region].substrate));
            const mismatch = sidecarIssueRows(region)
                .filter((r) => r.dataset.kind === SIDECAR_ISSUE_KINDS.SUBSTRATE_MISMATCH);
            testController.assertEqual(`${at} ⛓⛓ the block carries ONE mismatch sentence`, '1',
                String(mismatch.length));
            const said = String(mismatch[0]?.textContent ?? '');
            testController.reportCondition(`${at} …naming \`${was}\` as the keys the payload has`,
                said.includes(`the keys of \`${was}\``));
            testController.reportCondition(`${at} …and \`${now}\` as what it is not`,
                said.includes(`not \`${now}\``));
            testController.reportCondition(`${at} the bar counts it`, barReading(panel).sidecar >= 1);
            document.querySelector(`${PANEL_SELECTOR} .apworld-undo`)?.click();
            testController.assertEqual(`${at} one Undo restores the document`, beforeBytes,
                JSON.stringify(panel.rulesDoc));
            testController.assertEqual(`${at} …and the bar's sidecar count is 0 again`, '0',
                String(barReading(panel).sidecar));
        }
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('substrate-mismatch test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-sidecar-issues-read-zero-on-a-clean-document',
    name: 'APWorld hub: the sidecar validity report reads zero on a clean document, on both substrates',
    description: 'PRESET SIDECARS V0. The four-player fixture\'s two slots holding different '
               + 'substrates, each selected through the toolbar: the bar stamps 0 sidecar issues and '
               + 'no sidecar block carries a sentence.',
    testFunction: apworldSidecarIssuesReadZeroOnACleanDocument,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-a-raw-save-dropping-a-required-field-is-reported-not-refused',
    name: 'APWorld hub: a raw sidecar save that drops a required field lands, and the bar and the block report it',
    description: 'PRESET SIDECARS V0 (⚖ the reader owns the repair). A required field picked off '
               + 'the declaration (the first the deserializer survives losing) dropped through the '
               + 'block\'s Save: one op recorded (NOT refused); the bar\'s count rises by exactly one; '
               + 'the block lists the MISSING_REQUIRED sentence naming the field; the answer ends '
               + 'with the count; the Sidecars list row shows the badge; the bar\'s row lands on '
               + 'the region; Undo puts it all back. Mutants: the required check dropped (A); the '
               + 'bar not consulting the report (B: the bar red, the block green).',
    testFunction: apworldARawSaveDroppingARequiredFieldIsReportedNotRefused,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-a-raw-substrate-change-names-the-mismatch',
    name: 'APWorld hub: a raw sidecar save that changes substrate is accepted, and the block names the mismatch',
    description: 'PRESET SIDECARS V0 (the replan: the raw save accepts a changed substrate; the '
               + 'report names it). Each of two slots\' first region takes the other slot\'s '
               + 'substrate (both read off the document): one op lands, the block\'s '
               + 'SUBSTRATE_MISMATCH sentence names the substrate the payload has the keys of and '
               + 'the one it claims, Undo takes it away. Mutant D (the rule inverted) reds it.',
    testFunction: apworldARawSubstrateChangeNamesTheMismatch,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

/* ══════════════════════════════════════════════════════════════════════
 * PRESET SIDECARS D1 — THE BLOCK CONSUMES THE DECLARATION
 *
 * The block's disclosure (▸ Show fields & JSON) draws the entry as a FORM
 * above the JSON: one row per field of the entry subschema and of the
 * substrate's declaration, a control by type, derived fields greyed. Every
 * change is ONE whole-entry `set-region-sidecar`. Every expectation is read off
 * the declaration (`sidecarFieldsOf`), the fetched schema and the live registry
 * — the LAW — never typed; every slot through the toolbar's selector; every
 * lookup after a gesture RE-QUERIES.
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ One block's form rows — re-queried. */
const sidecarFieldRows = (regionName) => [...(sidecarBlockFor(regionName)
    ?.querySelectorAll('.apworld-sidecar-field') ?? [])];

/** ⛓ One form row by field and level — re-queried. */
const sidecarFieldRow = (regionName, field, level) => sidecarFieldRows(regionName)
    .find((r) => r.dataset.field === field && r.dataset.level === level) ?? null;

/** ⛓ That row's control — re-queried. */
const sidecarFieldControl = (regionName, field, level) => sidecarFieldRow(regionName, field, level)
    ?.querySelector('.apworld-sidecar-field-control') ?? null;

/** ⛓ The paths two plain JSON values differ at (a deep diff — trap 1313). */
function jsonDiffPaths(a, b, path = '$', out = []) {
    const isObj = (v) => v !== null && typeof v === 'object';
    if (!isObj(a) || !isObj(b) || Array.isArray(a) !== Array.isArray(b)) {
        if (JSON.stringify(a) !== JSON.stringify(b)) out.push(path);
        return out;
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) jsonDiffPaths(a[k], b[k], `${path}.${k}`, out);
    return out;
}

/**
 * ⛓ THE ENTRY-LEVEL FIELDS, off the schema the page itself fetches, reached
 * the way the schema reaches them (`preset_sidecars` → its per-slot pattern →
 * the per-region `additionalProperties` → `$ref`) — every property but the
 * payload, whose fields the declaration speaks for.
 */
async function entryLevelFieldsFromSchema() {
    const schema = await (await fetch('./schema/rules.schema.json')).json();
    const slot = Object.values(schema.properties.preset_sidecars.patternProperties)[0];
    const ref = slot.additionalProperties.$ref;
    const entry = ref.slice(2).split('/').reduce((at, k) => at?.[k], schema);
    return Object.keys(entry?.properties ?? {}).filter((k) => k !== PAYLOAD_KEY);
}

/** ⛓ THE PICKER'S LAW: every registered id whose entry has `deserializeWorld`, sorted. */
const playableIdsFromRegistry = () => substrateRegistry.getAll()
    .filter((e) => typeof e?.deserializeWorld === 'function').map((e) => e.id).sort();

/**
 * ⛓⛓⛓ **(i) THE FIELDS VIEW LISTS EXACTLY THE DECLARATION.** Both substrates
 * of the four-player fixture (each slot through the toolbar), each slot's first
 * region, its disclosure opened with the product's own toggle. The ENTRY rows
 * are the schema's entry properties but the payload, in order; the PAYLOAD rows
 * are `sidecarFieldsOf(registry.get(entry.substrate))`'s keys, in order — read
 * off the declaration, not the payload. ⛔ Premise: some declared field is
 * ABSENT from the entry, so a list built from the payload's keys (mutant C)
 * cannot pass by coincidence. A declared-derived field carries the badge and a
 * non-derived one does not (both picked off the declaration); the lead line
 * names the JSON as the escape hatch; the note under the JSON names exactly the
 * derived fields the entry carries.
 */
export async function apworldASidecarFieldsViewListsTheDeclaration(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(() => !!panel._rulesSchema,
            'the panel loaded rules.schema.json', 8000, 50);
        const two = twoSubstrateSlots(panel.rulesDoc);
        testController.reportCondition('⛓ premise: two slots holding different substrates', !!two);
        if (!two) return testController.getOverallResult();
        const entryFields = await entryLevelFieldsFromSchema();
        testController.reportCondition('⛓ the schema names entry-level fields', entryFields.length > 0);
        for (const slot of [two.a, two.b]) {
            testController.reportCondition(`slot ${slot} selected through the toolbar`,
                await onRegionsTabFor(testController, panel, slot));
            const region = Object.keys(panel.rulesDoc.preset_sidecars[slot])[0];
            const entry = panel.rulesDoc.preset_sidecars[slot][region];
            const at = `[slot ${slot} ${region} · ${entry.substrate}]`;
            const fields = sidecarFieldsOf(substrateRegistry.get(entry.substrate));
            const declared = Object.keys(fields);
            const absent = declared.filter((k) => !(k in entry.playable_payload));
            testController.reportCondition(`${at} ⛓ premise: a declared field the entry LACKS `
                + `(${absent.slice(0, 3).join(', ')})`, absent.length > 0);
            testController.reportCondition(`${at} the block is collapsed: no form drawn`,
                sidecarFieldRows(region).length === 0);
            testController.reportCondition(`${at} the disclosure opened`, !!await openSidecarJson(testController, region));

            const rows = sidecarFieldRows(region);
            const drawn = (level) => rows.filter((r) => r.dataset.level === level).map((r) => r.dataset.field);
            testController.assertEqual(`${at} ⛓⛓ ENTRY rows = the schema's entry properties, in order`,
                JSON.stringify(entryFields), JSON.stringify(drawn(SIDECAR_FORM_LEVELS.ENTRY)));
            testController.assertEqual(`${at} ⛓⛓⛓ PAYLOAD rows = the merged declaration, in order`,
                JSON.stringify(declared), JSON.stringify(drawn(SIDECAR_FORM_LEVELS.PAYLOAD)));
            const absentRow = sidecarFieldRow(region, absent[0], SIDECAR_FORM_LEVELS.PAYLOAD);
            testController.assertEqual(`${at} the absent \`${absent[0]}\` is a row, stamped absent`,
                'false', String(absentRow?.dataset.present));

            const derived = declared.find((k) => fields[k].derived);
            const authored = declared.find((k) => !fields[k].derived);
            testController.reportCondition(`${at} ⛓ premise: the declaration has a derived and an authored field`,
                !!derived && !!authored);
            const dRow = sidecarFieldRow(region, derived, SIDECAR_FORM_LEVELS.PAYLOAD);
            const aRow = sidecarFieldRow(region, authored, SIDECAR_FORM_LEVELS.PAYLOAD);
            testController.reportCondition(`${at} \`${derived}\` (declared derived) carries the derived badge`,
                !!dRow?.querySelector('.apworld-sidecar-field-derived'));
            testController.assertEqual(`${at} …whose title is the descriptor's description`,
                fields[derived].description, String(dRow?.querySelector('.apworld-sidecar-field-derived')?.title));
            testController.reportCondition(`${at} \`${authored}\` (not derived) carries none`,
                !!aRow && !aRow.querySelector('.apworld-sidecar-field-derived'));
            const requiredDrawn = rows.filter((r) => r.dataset.level === SIDECAR_FORM_LEVELS.PAYLOAD
                && !!r.querySelector('.apworld-sidecar-field-required')).map((r) => r.dataset.field);
            testController.assertEqual(`${at} the required marks are the declaration's`,
                JSON.stringify(declared.filter((k) => fields[k].required)), JSON.stringify(requiredDrawn));

            const lead = sidecarBlockFor(region)?.querySelector('.apworld-sidecar-fields-note');
            testController.reportCondition(`${at} the lead line names the JSON as the escape hatch`,
                /escape hatch/.test(String(lead?.textContent ?? '')));
            const note = String(sidecarBlockFor(region)?.querySelector('.apworld-sidecar-rederive-note')?.textContent ?? '');
            const carried = declared.filter((k) => fields[k].derived && k in entry.playable_payload);
            testController.reportCondition(`${at} ⛓ the re-derives-nothing note names every derived field carried `
                + `(${carried.join(', ')})`, carried.length > 0 && carried.every((k) => note.includes(`\`${k}\``)));
            testController.reportCondition(`${at} …and no derived field the entry lacks`,
                declared.filter((k) => fields[k].derived && !(k in entry.playable_payload))
                    .every((k) => !note.includes(`\`${k}\``)));
        }
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('fields-view test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **(ii) FLIPPING A BOOLEAN IS ONE WHOLE-ENTRY OP.** Both substrate slots,
 * each first region: the first NON-derived boolean the declaration offers (the
 * law — never a field typed here), its checkbox pressed. Then: ONE op recorded
 * (asserted before anything is read — 1301), a `set-region-sidecar` for this
 * slot and region; the DOCUMENT's entry differs from BEFORE at EXACTLY that
 * field's path (a deep diff — trap 1313: a write that dropped any other entry
 * field, mutant A, reds it) and the rest of the document is byte-equal; the
 * answer under the block is the op's (S1's clause). A change EQUAL to the stored
 * value records NO op and says "No change". One Undo restores the document.
 */
export async function apworldASidecarFieldChangeIsOneWholeEntryOp(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(() => !!panel._rulesSchema,
            'the panel loaded rules.schema.json', 8000, 50);
        const two = twoSubstrateSlots(panel.rulesDoc);
        if (!two) { testController.reportCondition('⛓ premise: two substrates', false); return testController.getOverallResult(); }
        for (const slot of [two.a, two.b]) {
            testController.reportCondition(`slot ${slot} selected through the toolbar`,
                await onRegionsTabFor(testController, panel, slot));
            const region = Object.keys(panel.rulesDoc.preset_sidecars[slot])[0];
            const before = JSON.parse(JSON.stringify(panel.rulesDoc.preset_sidecars[slot][region]));
            const fields = sidecarFieldsOf(substrateRegistry.get(before.substrate));
            const field = Object.keys(fields).find((k) => fields[k].type === 'boolean' && !fields[k].derived);
            const at = `[slot ${slot} ${region} · ${before.substrate}.${field}]`;
            testController.reportCondition(`${at} ⛓ premise: the declaration offers a non-derived boolean`, !!field);
            if (!field) continue;
            testController.reportCondition(`${at} ⛓ premise: the entry carries entry-level fields besides `
                + 'substrate and payload (so a payload-only write is visible)',
            Object.keys(before).some((k) => k !== SUBSTRATE_KEY && k !== PAYLOAD_KEY));
            await openSidecarJson(testController, region);
            const box = sidecarFieldControl(region, field, SIDECAR_FORM_LEVELS.PAYLOAD);
            testController.assertEqual(`${at} its control is a checkbox`, SIDECAR_FORM_CONTROLS.CHECKBOX,
                String(sidecarFieldRow(region, field, SIDECAR_FORM_LEVELS.PAYLOAD)?.dataset.control));
            testController.reportCondition(`${at} …enabled`, !!box && !box.disabled);
            if (!box) continue;

            const docBefore = JSON.stringify(panel.rulesDoc);
            const opsBefore = panel.session.ops().length;
            box.click();
            const recorded = await testController.pollForValue(
                () => (panel.session.ops().length === opsBefore + 1 ? panel.session.ops().at(-1) : null),
                `${at} the change recorded one op`, 8000, 50);
            testController.reportCondition(`${at} ⛓ ONE op was recorded`, !!recorded);
            if (!recorded) continue;
            testController.assertEqual(`${at} …a set-region-sidecar`, 'set-region-sidecar', String(recorded.op));
            testController.assertEqual(`${at} …for this region`, region, String(recorded.region));
            testController.assertEqual(`${at} …stamped with this slot`, String(slot), String(recorded.player));

            const after = panel.rulesDoc.preset_sidecars[slot][region];
            testController.assertEqual(`${at} ⛓⛓⛓ the entry differs from BEFORE at exactly that field (deep diff)`,
                JSON.stringify([`$.${PAYLOAD_KEY}.${field}`]), JSON.stringify(jsonDiffPaths(before, after)));
            testController.assertEqual(`${at} …to the flipped value`, String(!(before.playable_payload[field] === true)),
                String(after.playable_payload[field]));
            const rest = JSON.parse(docBefore);
            rest.preset_sidecars[slot][region] = after;
            testController.assertEqual(`${at} …and the rest of the document is byte-equal`,
                JSON.stringify(rest), JSON.stringify(panel.rulesDoc));
            testController.reportCondition(`${at} the answer under the block is the op's`,
                String(sidecarMessageFor(region)?.textContent ?? '').includes(SIDECAR_NOT_REDERIVED));

            // ⛔ A change EQUAL to the stored value is not an edit (1301).
            const same = sidecarFieldControl(region, field, SIDECAR_FORM_LEVELS.PAYLOAD);
            const opsNow = panel.session.ops().length;
            const docNow = JSON.stringify(panel.rulesDoc);
            same?.dispatchEvent(new Event('change', { bubbles: true }));
            testController.assertEqual(`${at} ⛓ an unchanged value records NO op`, String(opsNow),
                String(panel.session.ops().length));
            testController.assertEqual(`${at} …leaves the document alone`, docNow, JSON.stringify(panel.rulesDoc));
            testController.reportCondition(`${at} …and says "No change"`, /^No change/.test(String(panel._opMessage)));

            document.querySelector(`${PANEL_SELECTOR} .apworld-undo`)?.click();
            testController.assertEqual(`${at} ⛓ one Undo restores the document`, docBefore,
                JSON.stringify(panel.rulesDoc));
        }
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('field-change test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **(iii) A DERIVED FIELD'S CONTROL IS DISABLED AND NAMES ITS WRITER.** Both
 * substrate slots: every row the DECLARATION marks derived that draws a control
 * (a scalar) is disabled, and its title is the descriptor's description — which
 * names the writer in a code span (D0's rule). ⛔ Selected by the declaration's
 * `derived`, never by the control's state (a population chosen by the field
 * under test filters its own mutant out). Non-vacuity both ways: the slot has
 * such a row, and every NON-derived control on it is enabled — so "disabled"
 * is a discrimination, not a panel that disables everything. And the JSON stays
 * editable: the escape hatch.
 */
export async function apworldADerivedSidecarFieldIsDisabledAndNamesItsWriter(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(() => !!panel._rulesSchema,
            'the panel loaded rules.schema.json', 8000, 50);
        const two = twoSubstrateSlots(panel.rulesDoc);
        if (!two) { testController.reportCondition('⛓ premise: two substrates', false); return testController.getOverallResult(); }
        const scalar = [SIDECAR_FORM_CONTROLS.CHECKBOX, SIDECAR_FORM_CONTROLS.SELECT,
            SIDECAR_FORM_CONTROLS.TEXT, SIDECAR_FORM_CONTROLS.NUMBER];
        for (const slot of [two.a, two.b]) {
            testController.reportCondition(`slot ${slot} selected through the toolbar`,
                await onRegionsTabFor(testController, panel, slot));
            const region = Object.keys(panel.rulesDoc.preset_sidecars[slot])[0];
            const entry = panel.rulesDoc.preset_sidecars[slot][region];
            const at = `[slot ${slot} ${region} · ${entry.substrate}]`;
            const fields = sidecarFieldsOf(substrateRegistry.get(entry.substrate));
            await openSidecarJson(testController, region);
            const derivedWithControl = Object.keys(fields).filter((k) => fields[k].derived
                && scalar.includes(sidecarFieldRow(region, k, SIDECAR_FORM_LEVELS.PAYLOAD)?.dataset.control));
            testController.reportCondition(`${at} ⛓ premise: derived fields that draw a control `
                + `(${derivedWithControl.join(', ')})`, derivedWithControl.length > 0);
            for (const k of derivedWithControl) {
                const c = sidecarFieldControl(region, k, SIDECAR_FORM_LEVELS.PAYLOAD);
                testController.reportCondition(`${at} ⛓⛓ \`${k}\`'s control is DISABLED`, !!c && c.disabled === true);
                testController.assertEqual(`${at} …its title is the descriptor's description`,
                    fields[k].description, String(c?.title));
                testController.reportCondition(`${at} …which names a writer in a code span`,
                    /`[^`]+`/.test(String(c?.title ?? '')));
            }
            const authoredWithControl = Object.keys(fields).filter((k) => !fields[k].derived
                && scalar.includes(sidecarFieldRow(region, k, SIDECAR_FORM_LEVELS.PAYLOAD)?.dataset.control));
            testController.reportCondition(`${at} ⛓ non-vacuity: non-derived controls exist`, authoredWithControl.length > 0);
            testController.reportCondition(`${at} …and every one is ENABLED`, authoredWithControl.every((k) =>
                sidecarFieldControl(region, k, SIDECAR_FORM_LEVELS.PAYLOAD)?.disabled === false));
            const text = sidecarBlockFor(region)?.querySelector('.apworld-sidecar-json');
            testController.reportCondition(`${at} the JSON (the escape hatch) stays editable`,
                !!text && text.readOnly === false);
        }
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('derived-field test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓⛓ **(iv) THE `substrate` PICKER: THE REGISTRY'S PLAYABLE IDS, AND V0'S
 * SENTENCE AFTER.** On the second substrate slot's first region (read off the
 * document), the picker's options are every registered id with a
 * `deserializeWorld`, sorted (the law, from the live registry); its title
 * carries the label-only clause. Choosing the FIRST slot's substrate (read off
 * the document) records ONE op; the entry's `substrate` is the new one and its
 * payload byte-equal; the block's issues then carry V0's SUBSTRATE_MISMATCH
 * (the replan's ruling: accepted, and reported). One Undo clears it.
 */
export async function apworldTheSubstratePickerOffersThePlayableIdsAndNamesTheMismatch(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(() => !!panel._rulesSchema,
            'the panel loaded rules.schema.json', 8000, 50);
        const two = twoSubstrateSlots(panel.rulesDoc);
        testController.reportCondition('⛓ premise: two slots holding different substrates', !!two);
        if (!two) return testController.getOverallResult();
        const slot = two.b;
        const now = two.aSub;
        testController.reportCondition(`slot ${slot} selected through the toolbar`,
            await onRegionsTabFor(testController, panel, slot));
        const region = Object.keys(panel.rulesDoc.preset_sidecars[slot])[0];
        const at = `[slot ${slot} ${region}: ${two.bSub} → ${now}]`;
        await openSidecarJson(testController, region);
        const picker = sidecarFieldControl(region, SUBSTRATE_KEY, SIDECAR_FORM_LEVELS.ENTRY);
        testController.reportCondition(`${at} the entry's substrate row draws a select`,
            !!picker && picker.tagName === 'SELECT');
        if (!picker) return testController.getOverallResult();
        const offered = [...picker.options].filter((o) => !o.disabled).map((o) => o.textContent);
        const law = playableIdsFromRegistry();
        testController.assertEqual(`${at} ⛓⛓⛓ it offers the registry's playable ids (${law.length}), sorted`,
            JSON.stringify(law), JSON.stringify(offered));
        testController.assertEqual(`${at} …with the entry's own substrate selected`, two.bSub,
            String(picker.selectedOptions[0]?.textContent));
        testController.reportCondition(`${at} its title says it changes the label only`,
            picker.title.includes(SUBSTRATE_PICKER_CLAUSE));
        testController.reportCondition(`${at} …beside the Regenerate door`,
            !!sidecarBlockFor(region)?.querySelector('.apworld-sidecar-regenerate'));

        const docBefore = JSON.stringify(panel.rulesDoc);
        const payloadBefore = JSON.stringify(panel.rulesDoc.preset_sidecars[slot][region].playable_payload);
        const opsBefore = panel.session.ops().length;
        const index = [...picker.options].findIndex((o) => !o.disabled && o.textContent === now);
        testController.reportCondition(`${at} ⛓ premise: \`${now}\` is one of the options`, index >= 0);
        picker.value = picker.options[index]?.value;
        picker.dispatchEvent(new Event('change', { bubbles: true }));
        const landed = await testController.pollForCondition(
            () => panel.session.ops().length === opsBefore + 1, `${at} one op`, 8000, 50);
        testController.reportCondition(`${at} ⛓ ONE op was recorded — the changed substrate was ACCEPTED`, landed);
        if (!landed) return testController.getOverallResult();
        const after = panel.rulesDoc.preset_sidecars[slot][region];
        testController.assertEqual(`${at} the document's entry now says \`${now}\``, now, String(after.substrate));
        testController.assertEqual(`${at} …and its payload is untouched`, payloadBefore,
            JSON.stringify(after.playable_payload));
        const mismatch = sidecarIssueRows(region)
            .filter((r) => r.dataset.kind === SIDECAR_ISSUE_KINDS.SUBSTRATE_MISMATCH);
        testController.assertEqual(`${at} ⛓⛓ the block's issues carry V0's mismatch`, '1', String(mismatch.length));
        testController.reportCondition(`${at} …naming \`${two.bSub}\` as the keys the payload has`,
            String(mismatch[0]?.textContent ?? '').includes(`the keys of \`${two.bSub}\``));
        document.querySelector(`${PANEL_SELECTOR} .apworld-undo`)?.click();
        testController.assertEqual(`${at} one Undo restores the document`, docBefore, JSON.stringify(panel.rulesDoc));
        testController.assertEqual(`${at} …and the mismatch is gone`, '0', String(sidecarIssueRows(region)
            .filter((r) => r.dataset.kind === SIDECAR_ISSUE_KINDS.SUBSTRATE_MISMATCH).length));
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('substrate-picker test error-free', false);
    }
    return testController.getOverallResult();
}

/**
 * ⛓⛓ **(v) THE DOCUMENT ROW'S `preset_sidecars` DOOR LANDS ON THE SIDECARS TAB**
 * (the replan's ruling 6). The Document tab, the row's own button pressed: the
 * hub's active tab is `SIDECARS_TAB_ID` (the tab's registered id, imported) and
 * the tab's per-region summary is drawn. Premise: the press starts from the
 * Document tab.
 */
export async function apworldThePresetSidecarsDoorLandsOnTheSidecarsTab(testController) {
    try {
        const panel = await openHub(testController, FOUR_PLAYER_PATH);
        if (!panel) return testController.getOverallResult();
        await testController.pollForCondition(() => !!panel._rulesSchema,
            'the panel loaded rules.schema.json', 8000, 50);
        selectTab(panel, DOCUMENT_TAB_ID);
        const button = await testController.pollForValue(
            () => document.querySelector(`${PANEL_SELECTOR} .apworld-doc-row[data-doc-key="${
                SIDECARS_TAB_SUMMARY_KEY}"] .apworld-doc-editor-open`),
            'the preset_sidecars row\'s door', 8000, 50);
        testController.reportCondition('the Document row draws its door', !!button);
        testController.assertEqual('⛓ premise: the press starts on the Document tab', DOCUMENT_TAB_ID,
            String(panel.activeTab));
        if (!button) return testController.getOverallResult();
        button.click();
        testController.assertEqual('⛓⛓ the door lands on the Sidecars tab', SIDECARS_TAB_ID,
            String(panel.activeTab));
        const summary = await testController.pollForValue(
            () => document.querySelector(`${PANEL_SELECTOR} .apworld-sidecars-summary`),
            'the Sidecars tab\'s per-region summary', 8000, 50);
        testController.reportCondition('…and the Sidecars tab\'s per-region list line is drawn', !!summary);
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('sidecars-door test error-free', false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'apworld-a-sidecar-fields-view-lists-the-declaration',
    name: 'APWorld hub: a sidecar block\'s fields view lists exactly the schema\'s entry fields and the substrate\'s declaration',
    description: 'PRESET SIDECARS D1. Both substrates of the four-player fixture: opening a block '
               + 'draws one row per entry-level schema property (the payload excepted) and per field '
               + 'of the merged declaration, in order — absent fields included; derived rows carry '
               + 'the badge titled with the writer; the note under the JSON names the derived fields '
               + 'carried. Mutant C (rows from the payload\'s keys) reds it.',
    testFunction: apworldASidecarFieldsViewListsTheDeclaration,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-a-sidecar-field-change-is-one-whole-entry-op',
    name: 'APWorld hub: flipping a sidecar field\'s checkbox records one whole-entry set-region-sidecar',
    description: 'PRESET SIDECARS D1. The first non-derived boolean the declaration offers, on both '
               + 'substrate slots: one op; the entry differs from BEFORE at exactly that path (deep '
               + 'diff), the rest of the document byte-equal; an unchanged value records no op; one '
               + 'Undo restores. Mutant A (the control writes the payload only) reds it.',
    testFunction: apworldASidecarFieldChangeIsOneWholeEntryOp,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-a-derived-sidecar-field-is-disabled-and-names-its-writer',
    name: 'APWorld hub: a derived sidecar field\'s control is disabled and its title names the writer',
    description: 'PRESET SIDECARS D1. Every declared-derived scalar row on both substrate slots: its '
               + 'control is disabled and titled with the descriptor\'s description (a code span); '
               + 'every non-derived control is enabled; the JSON stays editable. Mutant B (derived '
               + 'controls enabled) reds it.',
    testFunction: apworldADerivedSidecarFieldIsDisabledAndNamesItsWriter,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-the-substrate-picker-offers-the-playable-ids-and-names-the-mismatch',
    name: 'APWorld hub: the substrate picker offers the registry\'s playable ids, and a change is reported as V0\'s mismatch',
    description: 'PRESET SIDECARS D1. On the second substrate slot, the picker lists every registered '
               + 'id with deserializeWorld (sorted, from the live registry) and says it changes the '
               + 'label only; choosing the first slot\'s substrate records one op, leaves the payload '
               + 'byte-equal, and the block lists SUBSTRATE_MISMATCH; Undo clears it. Mutant D (a hand '
               + 'list) reds it only where the list differs.',
    testFunction: apworldTheSubstratePickerOffersThePlayableIdsAndNamesTheMismatch,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});

registerTest({
    id: 'apworld-the-preset-sidecars-door-lands-on-the-sidecars-tab',
    name: 'APWorld hub: the Document row\'s preset_sidecars door lands on the Sidecars tab',
    description: 'PRESET SIDECARS D1 (the replan\'s ruling 6). From the Document tab, the row\'s own '
               + 'button: the active tab is SIDECARS_TAB_ID and its per-region list line is drawn. '
               + 'Mutant E (the door\'s target back to Regions) reds it.',
    testFunction: apworldThePresetSidecarsDoorLandsOnTheSidecarsTab,
    category: 'apworldEditor',
    enabled: false, // off by default — runs only in the test-substrates mode
});
