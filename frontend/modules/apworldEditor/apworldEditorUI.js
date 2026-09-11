/**
 * APWorld Editor UI
 *
 * GUI CRUD over rules.json — regions, exits, locations, access rules.
 * Publishes files:jsonLoaded on Apply (same pathway the Editor module uses).
 *
 * v1: single-player only (slot "1"). Rules are authored in Rule Builder
 * format.
 *
 * ⛓⛓⛓ **IT IS AN `editCore` SESSION NOW, SO IT HAS UNDO** (EDITOR INTEGRATION
 * slice B-c). `rulesDoc` used to be a FIELD that fourteen handlers and
 * twenty-odd inline closures wrote IN PLACE; it is a GETTER over
 * `session.record()` with NO SETTER, so an assignment throws in this module's
 * strict mode and the only way into the document is `_applyOp`.
 *
 * ⛔ **THE THREE INTAKE PATHS ARE SESSION BOUNDARIES, NOT OPS**: the app's
 * `stateManager:rawJsonDataLoaded`, the marking tool's `apworldEditor:loadRules`
 * hand-off, and Reload. Each is a DIFFERENT document arriving from outside, and
 * nothing in an edit list can express one — so each opens a NEW session with a
 * new base, and undo does not cross a reload.
 *
 * ⛓ **CLEAR IS AN OP** and Apply does NOT reset the session — see `_handleClear`
 * and `_handleApply`.
 *
 * ⛔ **AND THE ACCESSORS BELOW ARE PURE READS.** They used to lazily CREATE
 * their container (`this.rulesDoc.regions || (this.rulesDoc.regions = {})`),
 * which over a session is a write THROUGH the folded record — and at zero ops
 * `record()` IS the base, so a render would have quietly modified the document
 * the session reconstructs from.
 */

/**
 * ⛓⛓ S1 — **`APWORLD_EDITOR_PANEL_ID` IS THE PANEL'S OWN COMPONENT TYPE**, and
 * this panel needs it because the accepted-op focus publishes `ui:activatePanel`
 * FOR ITSELF. ⛔ It is declared in `index.js`, which is where the registration
 * and `moduleInfo.componentType` use it AT MODULE LOAD, and only READ here —
 * inside a method. This module and `index.js` are a cycle (has been since H1);
 * a constant declared on this side and consumed at index.js's top level would
 * be in the TDZ whenever this module is evaluated first.
 */
import {
  getModuleEventBus, APWORLD_EDITOR_LOAD_RULES, APWORLD_EDITOR_SELECT_REGION,
  APWORLD_EDITOR_PANEL_ID,
  consumePendingEditorRules, consumePendingSelectRegion,
} from './index.js';
import { stateManagerProxySingleton as stateManager, getLastRawJsonData } from '../stateManager/index.js';
import RuleTreeEditor from './ruleTreeEditor.js';
import { validateRules, cloneFullRulesDoc } from './rulesUtils.js';
import { createEditSession, describeOps, group, isGroup } from '../procgenCore/editCore.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import {
  EXIT_FIELDS,
  ITEM_FIELDS,
  ADDITIVE_TYPE,
  ITEM_GROUPS_KEY,
  META_FIELDS,
  PLACEMENT_ISSUE_REASONS,
  PROGRESSION_ISSUE_REASONS,
  PROGRESSION_KINDS,
  PROGRESSION_MAPPING_KEY,
  canonicalPlacementIssues,
  canonicalPlacementIssuesByPlayer,
  deleteItemOps,
  deleteRegionOps,
  describePlacementIssue,
  itemGroupRegistry,
  itemsCarryingGroup,
  locationsOfPlayer,
  progressionKindOf,
  progressionMappingIssues,
  progressionMappings,
  unlistedItemGroups,
} from './rulesDocOps.js';
import { DEFAULT_PLAYER_ID } from '../shared/playerIdUtils.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
/**
 * ⛓⛓ R-a — **THE EMPTY BLOCK'S TWO NUMBERS, EXPORTED** (⚖ k, user 2026-09-06:
 * *"the code to use exported constants, not hardcoded numbers"*). The presence
 * switch writes a block, and a `50` and a `10` typed here would be the sixth and
 * seventh copies of the pair `loopCostDefaults.js` exists to have killed.
 *
 * ⚠ Imported from `loopCostDefaults.js` DIRECTLY, not through
 * `loopCostGenerator.js`'s re-export, and that is a deliberate departure from
 * that file's own ⚠. The re-export is the door for the RUNTIME readers, which
 * already hold the generator; this panel plans nothing, and reaching it through
 * the generator would pull `loopCostPlanner.js` (the whole cost SIMULATION) and
 * `xpFormulas.js` onto the hub's graph for two fallback numbers. `loopCostDefaults.js`
 * has no imports of its own by design — being importable from anywhere is what
 * it is for.
 */
import {
  DEFAULT_LOCATION_COST, DEFAULT_REGION_COST,
} from '../shared/procgen/loopCostDefaults.js';
import { getRegionEditor } from '../procgenPipeline/regionEditors.js';
/**
 * ⛓ H4b — the per-region Edit door. `regionRoundTrip` names NO substrate: it
 * resolves `roomEditor` and `regionRoundTrip` off the registry, so this panel
 * grows an Edit button for a new substrate the day that substrate declares two
 * fields, and never here.
 */
import {
  inspectRegionRoom, JSON_BLOCK_INDENT, openRegionRoom, regionRoundTripOf, sidecarEntryFacts,
  sidecarOf,
} from './regionRoundTrip.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
/**
 * ⛓⛓ PRESET SIDECARS V0 — the FOURTH validator: what is wrong with the selected
 * slot's sidecar entries. One pure function with three readers — the bar
 * (`_validationIssues`), the per-region block and its count badge
 * (`_makeRegionSidecarBlock`), and `check-sidecar-fields.mjs` — so none of
 * them spells a check of its own. It names no substrate: whatever differs per
 * substrate is read off the registry entry.
 */
import { describeSidecarIssue, sidecarIssues } from './sidecarIssues.js';
/**
 * ⛓⛓ H5 — **IS THAT PANEL EVEN IN THIS APP?** `ui:activatePanel` reaches a
 * `panelManager` that warns and returns when the component type is not in the
 * layout, so a link to a module `module-configs/modules.json` has DISABLED is a
 * control that does nothing and says nothing. The component registry is the one
 * place that knows: a module that never loaded never registered its panel.
 */
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { applyRulesDocOp } from './rulesDocOps.js';
import {
  buildDocumentKeys,
  defaultPlayerOf,
  documentKeyRows,
  playerSlotsOf,
  DOCUMENT_KEY_EDITORS,
  DOCUMENT_TAB_ID,
  EDITOR_RETURN_KINDS,
  KEYS_OWNED_BY_TAB,
  PLACEMENTS_TAB_KEY,
  SIDECARS_TAB_ID,
  SIDECARS_TAB_SUMMARY_KEY,
} from './documentKeys.js';
import { buildLinkRows, DOCUMENT_LINKS } from './documentLinks.js';
/**
 * ⛓ H3 — the MAP tab. The renderer names no substrate (each one declares its
 * own `compositeMap.drawRegion`); `compositeMapDocument` is the pure
 * sidecars → Grid reader, which is on the pipeline side because it builds a
 * `Grid`. Neither import drags a panel in.
 */
import {
  TILE_PX, drawCompositeMap, canvasPointOf, cellAtPoint,
} from '../procgenCore/compositeMapRenderer.js';
import { reconstructResultFromSidecars } from '../procgenPipeline/compositeMapDocument.js';
import { downloadJson, rulesDownloadName } from './downloadJson.js';
/**
 * ⛓⛓ H2b — the raw tab is a CodeMirror 6 view, not a `<textarea>`. The barrel
 * is the LOCAL bundled CM6 library (no CDN) and it is already in this app's
 * import graph in BOTH modes: `init-bundled.js:73` imports
 * `editorCodeMirror6/index.js` statically, and that module is `enabled: true`
 * in `module-configs/modules.json`, so the 837 KB library is fetched at init on
 * localhost too. ⇒ this import costs the bundle and the first paint nothing;
 * H2b measured both (plan §14).
 *
 * ⛔ The extension list is NOT built here — `jsonEditorExtensions` is the one
 * list both raw-JSON editors mount, so the two cannot drift apart.
 */
import { EditorState, EditorView } from '../editorCodeMirror6/codemirror6Imports.js';
import { jsonEditorExtensions } from '../editorCodeMirror6/jsonEditorExtensions.js';
import {
  parseRawView,
  rawViewText,
  rawViewVerdict,
  utf8Bytes,
} from './rawView.js';

const RAW_JSON_LOADED = 'stateManager:rawJsonDataLoaded';
const APP_READY = 'app:readyForUiDataLoad';
const APPLY_SOURCE = 'apworldEditorApply';
/**
 * ⛓⛓⛓ **THE SLOT IS A PANEL FIELD NOW, NOT A MODULE CONSTANT** (APWORLD
 * EDITOR HUB slice H1). It used to be `const PLAYER_ID = DEFAULT_PLAYER_ID` and
 * 42 sites read it, which made this panel a single-player editor over documents
 * that are not: 15 committed presets carry four players, and their `regions`,
 * `items`, `itempool_counts` and `world` really are per-slot.
 *
 * ⛔ `DEFAULT_PLAYER_ID` survives as the FALLBACK only — the slot a document
 * with no per-player data at all is edited under. Everything else reads
 * `this.playerId`, which `_syncPlayer` derives from the document on every
 * render (`documentKeys.defaultPlayerOf` holds the order and why the document's
 * own `playerId` key comes first).
 *
 * ⚠ H0's ⚖ 3: `preset_sidecars` is `{}` in 158 of its 192 carriers and every
 * populated one keys under slot "1" — the four-player multiworld documents
 * INCLUDED. So nothing about the selector may be gated on sidecars; what makes
 * it falsifiable against committed data is `regions`/`items`/`world`.
 */

/**
 * ⛓ The Document and Links tabs are the HUB's two: `document` renders EVERY
 * top-level key the schema names (plus anything the file carries that it does
 * not), and `links` is the door to every other editor. The first three are the
 * editor this panel already was.
 *
 * ⛓⛓ **S1 — AND `sidecars` SITS BETWEEN Map AND Document, DELIBERATELY.** The
 * tab order is a product choice and this is the one made: the five keys it
 * hosts are all *about the world the procgen side produced* — the same subject
 * as Map, which draws that world's grid — and every one of them also appears on
 * the Document tab, which is the everything-fallback and therefore reads best
 * as the LAST of the per-subject tabs rather than as the middle of them. ⚖ user
 * 2026-09-08: *"a 'Sidecars' tab, for the data that's specifically in the
 * sidecars"*; the membership and its authority are `KEYS_OWNED_BY_TAB.sidecars`
 * in `documentKeys.js`, not here.
 *
 * ⛓⛓ **W3 — AND `placements` SITS BETWEEN Items AND Meta.** A canonical
 * placement is a `location → item` pair: its left half is the REGIONS tab's
 * vocabulary and its right half is the ITEMS tab's, and it is the only tab that
 * can draw nothing until both of those exist. So it reads immediately after the
 * two tabs whose words it joins, and before Meta — which is about the DOCUMENT
 * rather than about the world. ⚖ user 2026-09-08: *"Yes, canonical placements
 * should have their own tab."*
 */

const TABS = [
  { id: 'regions', label: 'Regions' },
  { id: 'items', label: 'Items' },
  { id: 'placements', label: 'Placements' },
  { id: 'meta', label: 'Meta' },
  { id: 'map', label: 'Map' },
  // ⛓ R1 — these two ids are the ONE pair `_renderDocumentRow` compares a key's
  //   `ownedByTab` against, so they come from `documentKeys.js` rather than
  //   being spelled a second time here.
  { id: SIDECARS_TAB_ID, label: 'Sidecars' },
  { id: DOCUMENT_TAB_ID, label: 'Document' },
  { id: 'links', label: 'Links' },
  { id: 'raw', label: 'Raw JSON' },
];


/** ⛓ Where the page fetches the schema the Document tab is DERIVED from. */
const RULES_SCHEMA_URL = './schema/rules.schema.json';

/**
 * ⛓⛓ **THE STALE-DOCUMENT REFUSAL, AS ONE SENTENCE** (R-a). It reaches a person
 * through three surfaces — this panel's status line, the `errors` array the
 * answer carries, and whatever the door prints from that (the cost debugger's
 * status line) — so it is stated ONCE. ⛔ It names the FIX, not just the fault:
 * a refusal a person cannot act on is a silent no-op with extra words.
 */
const STALE_DOCUMENT_REFUSAL = 'this plan was made for a document the editor has since '
  + 'replaced — load it again and Send again.';

/**
 * ⛓⛓⛓ **THE BLOCK THE PRESENCE SWITCH ADDS** (R-a, residue 3). Exactly the four
 * keys `rules.schema.json` requires of a `loop_costs` block and nothing else —
 * so "turn loop mode on" writes the smallest document the schema calls valid,
 * and every region falls back to the defaults until something prices them.
 *
 * ⛔ A FUNCTION, not a frozen constant: it is written into a document through an
 * op, and a shared object would put one mutable block behind every world that
 * ever pressed the button.
 */
const emptyLoopCostsBlock = () => ({
  regions: {},
  locations: {},
  defaultRegionCost: DEFAULT_REGION_COST,
  defaultLocationCost: DEFAULT_LOCATION_COST,
});

const ITEM_CLASSIFICATIONS = [
  'progression',
  'useful',
  'filler',
  'trap',
  'progression_skip_balancing',
];

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('apworldEditorUI', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[apworldEditorUI] ${message}`, ...data);
  }
}

/**
 * ⛓ M0 — the cell size the Map tab DREW, and where it came from, read off the
 * reconstruction's own `regionSizeSource` rather than derived a second time.
 * ⛔ A stats line that printed `8×6 tiles` for a zone world would be claiming a
 * tile size the document does not have; the fallback's own name is the honest
 * readout, and the panel must not re-decide which rule fired — a second
 * spelling of the precedence is a second thing to keep in step.
 */
function mapCellNote(result) {
    const { width, height } = result?.regionSize ?? {};
    if (!Number.isFinite(width) || !Number.isFinite(height)) return '';
    const size = `${width}×${height}`;
    if (result.regionSizeSource === 'payload') return `cell ${size} tiles`;
    if (result.regionSizeSource === 'declared') return `cell ${size} (declared by the substrate)`;
    return `cell ${size} (the engine's default — this world stores no tile geometry)`;
}

class ApworldEditorUI {
  constructor(container, componentState) {
    Object.defineProperty(this, 'eventBus', { get: () => getModuleEventBus(), configurable: true });
    this.container = container;
    this.componentState = componentState;

    /**
     * ⛓⛓⛓ **THE DOCUMENT IS THE SESSION'S RECORD, AND THERE IS NO SETTER.**
     * `sess.rulesDoc = x` THROWS. That is not decoration: three intake paths
     * and fourteen handlers used to assign this field, and a mutator that still
     * did would be writing a record the next undo re-folds away — a defect with
     * no visible cause until somebody presses ↶.
     */
    Object.defineProperty(this, 'rulesDoc', {
      get: () => (this.session ? this.session.record() : null),
      enumerable: true,
      configurable: true,
    });
    this.session = null;
    this.isInitialized = false;
    /**
     * ⛓⛓⛓ **WHERE THIS DOCUMENT CAME FROM, CARRIED THROUGH APPLY** (H2 Task 3).
     * The string the app published as `sourceName` when the session opened,
     * kept only when it is a real load path rather than an in-panel hand-off.
     * `_handleApply` re-publishes it, which is the whole of "load into the app
     * as if it was a preset" — see the method for the measurement.
     */
    this._originSourceName = null;
    /**
     * ⛓⛓⛓ **WHICH DOCUMENT THIS HUB IS HOLDING, AS AN IDENTITY A CLOSURE CAN
     * CAPTURE** (LOOP COSTS R-a, residue 2; ⚖ user 2026-09-06).
     *
     * ⛔ L4's finding: `onSave` applied into whatever session the hub had open
     * NOW. Hand a document to the cost debugger, load a DIFFERENT preset here,
     * then press Send, and that plan landed in THIS document — arc-wide, not a
     * property of one door (`region_atlas`'s Save had it too). Closing it needs
     * a document identity the hub did not carry. This is it.
     *
     * ⛓ A MONOTONIC COUNTER, never persisted and never compared across
     * instances: the only question it answers is *"is the document I was handed
     * still the one open?"*, and a number bumped at the ONE session boundary
     * answers exactly that. It is deliberately NOT a hash of the record — two
     * loads of the same bytes are two documents to a person (they discard an op
     * list between them), and a content hash would call them one.
     *
     * ⛓ It starts at 0 and `_openSession` makes it ≥ 1, which is what makes the
     * check FAIL-CLOSED: a caller that hands `_acceptEditorOp` no token at all
     * gets `undefined !== 1` and is refused rather than trusted.
     */
    this._documentToken = 0;
    /**
     * ⛓ S1 — the accepted-op message that is printed BESIDE the row it was
     * written on, `{key, text}` or null — or, for a region's sidecar block
     * (PRESET SIDECARS S1), `{sidecar: 'slot|region', text, refused}`, which no
     * Document row's `key` can match. The chrome's `_opMessage` still
     * carries the same sentence: a person who was looking at the status line
     * should not have to hunt for the answer, and a person the hub has just
     * scrolled to a row should not have to look back up at the chrome.
     */
    this._opRowMessage = null;
    /**
     * ⛓⛓ **THE ECHO OF OUR OWN APPLY, TOLD APART BY OBJECT IDENTITY.** It used
     * to be told apart by `sourceName === APPLY_SOURCE`, which stopped working
     * the moment Apply started republishing the ORIGIN's source name: the panel
     * would have seen a preset path, called it a session boundary, and thrown
     * away the very edits it had just published. `stateManager` re-emits
     * `rawJsonData: eventData.jsonData` BY REFERENCE, so the object we handed
     * out is the object that comes back.
     */
    this._appliedDocs = new WeakSet();
    /** ⛓ The raw tab's uncommitted text, so a re-render does not eat a draft. */
    this._rawDraft = null;
    /** ⛓ Whether that text differs from the record — the status line's source. */
    this._rawEdited = false;
    /** ⛓ H2b — the MOUNTED CodeMirror 6 view, or null when the tab is elsewhere. */
    this.rawEditorView = null;
    this.rawJsonUnsubscribe = null;
    this.loadRulesUnsubscribe = null;
    /** ⛓ H4c — the bounce editor's "select this region" door. */
    this.selectRegionUnsubscribe = null;
    this.activeTab = 'regions';
    /**
     * ⛓⛓ H3 — **THE REGION THE MAP PICKED**, and the memoised map behind it.
     * A click on the Map tab's canvas selects a region in the Regions tab
     * (plan §3 idea 4); the cache exists because `_render` runs on every tab
     * switch and rebuilding a whole `Grid` out of `preset_sidecars` per render
     * would put a deserialize pass beside the `validateRules` pass H2 measured
     * at 4.6 s on `stardew_valley`. Keyed on the RECORD's identity (the session
     * hands out a new object per op) plus the slot, so an edit or a slot change
     * invalidates it and nothing else has to remember to.
     */
    this._selectedRegion = null;
    this._mapCache = null;

    /**
     * ⛓⛓⛓ **R1 — AND THE VALIDATION PASS IS MEMOISED THE SAME WAY.**
     * `_renderValidationBar` ran `validateRules` on EVERY render, and every
     * `_selectTab` renders.
     *
     * ⛔ **AND THE SIZE OF THAT IS NOT WHAT THE TAB SWITCH COSTS.** MEASURED on
     * the largest committed world (`?game=stardew_valley&seed=1`, 209 regions /
     * 1,073 items, scratch Playwright, the app let settle first):
     * `validateRules` itself is **2.6–4.6 ms**, while `_selectTab('regions')`
     * is **5.4–8.0 s** and `_selectTab('items')` **0.36–0.40 s**. The Regions
     * cost is the REGIONS TAB's own renderer, not this pass — a slice that
     * wants that number has to go there. What this memo actually buys is
     * `_renderChrome`, which every tab pays alike: **2.2–4.0 ms → 0.3–0.7 ms**.
     *
     * ⛓ Keyed exactly like `_mapCache` above: the RECORD's identity plus the
     * slot. `editCore` hands out a NEW record object whenever the document
     * moves (`apply` assigns `res.record`; `undo` re-folds) and returns the
     * SAME one when an op changed nothing — so object identity is precisely
     * *"could the answer have changed"*, with nothing to remember to bump.
     *
     * ⛔ **NOT the op COUNT.** `session.ops().length` is the obvious key and it
     * COLLIDES: apply an op, undo it, apply a different one, and the count
     * reads 1 for two different documents — the second would be shown the
     * first's issues. Measured (see the R1 record). The `_documentToken` is not
     * in the key either, and does not need to be: `_openSession` clones a fresh
     * record, so a new document is a new object by construction.
     */
    this._validationCache = null;
    /**
     * ⛓⛓ PRESET SIDECARS V0 — **AND THE SIDECAR REPORT IS MEMOISED ON THE SAME
     * KEY**, the record's identity plus the slot, in its OWN cache: the block
     * reads it without going through the bar, so the bar and the block are two
     * readers of one function rather than one reader and a copy. ⛔ Keyed on the
     * record and never cleared on apply — an Undo re-folds the record without
     * passing through `_applyOp` (trap 1311). Inside the function, each entry's
     * issues are memoised on the entry object, so an op re-asks only what it
     * touched.
     */
    this._sidecarIssueCache = null;

    /**
     * ⛓⛓⛓ H4b — **THE OPEN ROOM IS PARKED, NOT TORN DOWN ON A RE-RENDER.**
     * `rawEditorView` (H2b) is the precedent for state a tab holds across
     * renders, and its rule is the OPPOSITE of this one on purpose: the raw
     * view lives INSIDE this panel's DOM, so `_render` has to unmount it before
     * emptying the container. A room session lives in ANOTHER panel (the maze
     * lab, the bounce editor) and outlives every render of this one — closing
     * it here would shut the room the reader is standing in the moment an
     * unrelated field re-rendered the Regions tab.
     *
     * ⇒ it is closed in exactly two places: when a SECOND room is opened, and
     * in `onPanelDestroy`.
     */
    this.roomEditorSession = null;
    /**
     * ⛓ Per-region verdicts the ASYNC inspection produced, `key → {doc, why}`.
     * The cheap half of the check (does this substrate have a room editor and
     * a round trip at all?) is two registry lookups and runs on every render;
     * the expensive half (does THIS region's payload round-trip?) deserializes
     * a world, so it runs when the button is PRESSED and its refusal is
     * remembered here so the button can then say so without being pressed again.
     *
     * ⛓⛓ **A VERDICT IS ABOUT ONE RECORD, AND IT IS KEYED ON THAT RECORD** (PRESET
     * SIDECARS S1). It is read only while `doc === this.rulesDoc`. Until S1 it
     * was CLEARED by `_applyOp`, and `_undo` does not go through `_applyOp` —
     * measured live at `9bf3a0c583`: a hand-edited payload, Edit ▸ pressed
     * (refused, remembered), one Undo (the document back to its bytes, 0 ops)
     * and the button stayed DISABLED with the refusal of a payload that no
     * longer existed. The raw sidecar save makes that a two-click path. The
     * record is immutable (copy-on-write ops, undo is a re-fold), so identity is
     * exactly "the document this was asked about": every applied op, undo and
     * boundary moves it, and a no-op does not.
     */
    this._roomVerdicts = new Map();

    /**
     * ⛓⛓ S0 — **THE SIDECAR VIEW'S TWO DISCLOSURES, PER SESSION.** Which
     * per-region JSON blocks are open (`host|slot|region`, so opening an
     * entry's JSON on the Sidecars tab does not open it under the region on
     * Regions — each host's disclosure is its own), and whether the Sidecars
     * tab's per-region list is expanded. Both survive a re-render — every op
     * and every tab switch re-renders — and both are dropped at `_openSession`,
     * the `_mapCache` / `_roomVerdicts` precedent: a new document is a
     * different world, and its list starts COLLAPSED (⚖ user, 2026-09-10:
     * *"expandable, and collapsed by default"*).
     */
    this._expandedSidecarJson = new Set();
    this._sidecarListOpen = false;

    /**
     * ⛓⛓ **THE SELECTED SLOT, AND THE ONE THE PERSON PICKED, KEPT APART.**
     * `playerId` is what every tab reads and every op is stamped with;
     * `_chosenPlayer` is non-null only after a deliberate pick, so a NEW
     * document re-derives its own default instead of inheriting the previous
     * one's — a session boundary installs a different world, and slot 3 of the
     * old one means nothing in the new.
     */
    this.playerId = DEFAULT_PLAYER_ID;
    this._chosenPlayer = null;

    /**
     * ⛓ The parsed `rules.schema.json`, fetched once. ⛔ NOT imported: the
     * evaluator's own law is that the schema is INJECTED (`jsonSchemaCheck.js`
     * is in the browser page graph and a `node:fs` import would make that whole
     * graph unloadable), so the page fetches and hands it in.
     */
    this._rulesSchema = null;
    this._schemaError = null;
    /** ⛓ Which Document rows are expanded — per KEY, so a re-render keeps them. */
    this._expandedKeys = new Set();

    this.rootElement = document.createElement('div');
    this.rootElement.classList.add('apworld-editor-panel');
    // ⛓ The handle every browser verifier reaches the session through — the
    //   marking tool's `.rmt-panel.__panel` precedent.
    this.rootElement.__panel = this;
    Object.assign(this.rootElement.style, {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      color: '#ddd',
      backgroundColor: '#1a1a1a',
      fontFamily: 'sans-serif',
      fontSize: '13px',
      overflow: 'hidden',
    });

    this.container.element.appendChild(this.rootElement);

    const readyHandler = () => {
      this.initialize();
      this.eventBus.unsubscribe(APP_READY, readyHandler);
    };
    this.eventBus.subscribe(APP_READY, readyHandler);

    if (stateManager.getStaticData()) {
      this.initialize();
      this.eventBus.unsubscribe(APP_READY, readyHandler);
    }

    this.container.on('destroy', () => this.onPanelDestroy());
  }

  initialize() {
    if (this.isInitialized) return;
    log('info', 'Initializing ApworldEditorUI...');

    this._buildChrome();

    this.rawJsonUnsubscribe = this.eventBus.subscribe(RAW_JSON_LOADED, (eventData) => {
      if (!eventData || !eventData.rawJsonData) return;
      if (this._appliedDocs.has(eventData.rawJsonData)) {
        this._appliedDocs.delete(eventData.rawJsonData);
        log('info', 'Ignoring our own apply round-trip.');
        return;
      }
      // Full-doc clone preserves non-standard top-level keys (procgen_metadata
      // etc.) the editor doesn't edit — see cloneFullRulesDoc's contract.
      this._openSession(eventData.rawJsonData, {
        kind: 'rules', source: eventData.source ?? 'app-load', player: this.playerId,
        // ⛓ The load's OWN source string — the one Apply re-publishes.
        origin: eventData.source ?? null,
      });
    });

    // Direct hand-off channel (§2.2): procgen's "Open in APWorld Editor" routes
    // a world here without a global files:jsonLoaded, so the substrate panels
    // don't auto-activate and steal focus. Adopt immediately when we're already
    // open; the consume() also clears any stash so it can't go stale.
    this.loadRulesUnsubscribe = this.eventBus.subscribe(APWORLD_EDITOR_LOAD_RULES, (ev) => {
      if (ev && ev.jsonData) this._adoptHandoffRules(ev.jsonData, ev.source ?? null);
      consumePendingEditorRules();
    });

    /**
     * ⛓⛓⛓ H4c — **THE BOUNCE EDITOR'S REVERSE LINK.** It carries a region NAME
     * and no document: this panel already holds one, and the answer is
     * `selectRegion`'s own — which says, in the status line, when the document
     * in front of the reader does not hold that region rather than switching to
     * a tab with nothing highlighted.
     */
    this.selectRegionUnsubscribe = this.eventBus.subscribe(APWORLD_EDITOR_SELECT_REGION,
      (ev) => {
        if (!ev || typeof ev.region !== 'string' || ev.region === '') return;
        this._adoptRegionSelection(ev.region, ev.player ?? null);
        consumePendingSelectRegion();
      });

    // If rules were loaded before the panel opened, pick them up now: first a
    // hand-off stashed by the load-rules channel, else the app-wide cache.
    const pending = consumePendingEditorRules();
    if (pending) {
      this._adoptHandoffRules(pending.jsonData, pending.source);
    } else if (!this.session) {
      const current = this._getCurrentAppRules();
      if (current.doc) {
        this._openSession(current.doc, {
          kind: 'rules', source: 'app-cache', player: this.playerId, origin: current.source,
        });
      }
    }

    /**
     * ⛓ …and a stashed SELECTION last, because it names a region of whatever
     * document the two branches above just opened. Draining it first would
     * select into a session `_openSession` is about to discard.
     */
    const pendingSelect = consumePendingSelectRegion();
    if (pendingSelect) {
      this._adoptRegionSelection(pendingSelect.region, pendingSelect.player);
    }

    this.isInitialized = true;
    this._loadRulesSchema();

    log('info', 'ApworldEditorUI initialized.');
  }

  /**
   * ⛓⛓ H4c — one door, two entries (live event / stash drained at mount), so
   * the slot-switch and the refusal sentence cannot drift between them.
   *
   * ⛔ THE SLOT IS SWITCHED ONLY WHEN THE DOCUMENT HAS IT. A caller that named
   * a player this document does not carry would otherwise leave the hub
   * pointing at an empty slot, which is a worse answer than "this document does
   * not hold that region" — and `selectRegion` is what says the latter.
   */
  _adoptRegionSelection(region, player) {
    let slotNote = null;
    if (player != null && String(player) !== String(this.playerId)) {
      const slots = this._playerSlots();
      if (slots.includes(String(player))) {
        /**
         * ⛔ `_chosenPlayer`, NOT `playerId`. `_syncPlayer` re-derives
         * `playerId` from the record on EVERY render and honours only a
         * DELIBERATE pick — so a slot written straight onto `playerId` would
         * be overwritten by the very `_render()` this door ends with, and the
         * hub would answer on the slot it was already showing while reporting
         * that it had moved. (Measured: the in-app row below caught exactly
         * that, because the panel's own selector goes through this field too.)
         */
        this._chosenPlayer = String(player);
        this._syncPlayer();
      } else {
        slotNote = `Slot ${player} is not in this document (slots: `
          + `${slots.join(', ') || 'none'}) — staying on slot ${this.playerId}. `;
      }
    }
    this.selectRegion(region, 'the editor that asked');
    /**
     * ⛓ THE SLOT REFUSAL GOES IN FRONT OF `selectRegion`'S OWN SENTENCE rather
     * than instead of it: two things happened (the slot was refused AND the
     * region was looked for), and a status line that reported only the first
     * would leave the reader guessing what the hub is now showing.
     */
    if (slotNote) {
      this._opMessage = slotNote + this._opMessage;
      this._render();
    }
  }

  // Adopt a world handed directly to the editor (load-rules channel). Same
  // full-doc clone the global load path uses, so procgen_metadata is preserved.
  _adoptHandoffRules(jsonData, handOffSource = null) {
    /**
     * ⛔ A HAND-OFF HAS NO ORIGIN, and that is the honest answer rather than a
     * missing feature: the pipeline, the marking tool and (H4c) the two lab
     * pages build this document in memory, so there is no preset path whose
     * sphere log belongs to it. ⛓ `origin` stays `null` for exactly that
     * reason and `source` NAMES the door instead — H4c added a third and fourth
     * publisher to this channel, and "hand-off" alone no longer tells a reader
     * which one they pressed.
     */
    this._openSession(jsonData, {
      kind: 'rules',
      source: handOffSource ? `hand-off · ${handOffSource}` : 'hand-off',
      player: this.playerId,
      origin: null,
    });
  }

  /**
   * ⛓⛓⛓ **ONE PLACE OPENS A SESSION, AND IT IS THE ONLY BOUNDARY.** The base
   * RECORD is a full-doc clone (so the app's object is never the one being
   * edited, and `procgen_metadata` and friends round-trip); the base TAG is the
   * opaque `{kind, …}` `editCore` carries verbatim and never interprets.
   *
   * ⛔ A NEW SESSION DISCARDS THE OP LIST, and that is what a boundary MEANS:
   * the edits described a document that is no longer the one in front of the
   * person, so an undo across it would reconstruct bytes nobody ever saw.
   */
  _openSession(jsonData, baseTag) {
    this.session = createEditSession(rulesEditAdapter, cloneFullRulesDoc(jsonData),
      { base: baseTag });
    /**
     * ⛓⛓ R-a — **A NEW DOCUMENT IS A NEW IDENTITY**, stamped at the SAME place
     * the op list is discarded. ⛔ Bumped here and nowhere else: Apply does not
     * reset the session (it re-publishes the record), `Clear` is an op, and undo
     * re-folds — none of those replace the document, so none of them may
     * invalidate a plan somebody is holding.
     */
    this._documentToken += 1;
    // ⛓ RECORDED, never inferred later: a boundary is the only place the
    //   document's provenance is known, and Apply is downstream of every op.
    this._originSourceName = baseTag?.origin ?? null;
    // ⛓ S1 — a message about a row of the OLD document says nothing about this
    //   one, and the row it names may not even be present here.
    this._opRowMessage = null;
    this._rawDraft = null;
    this._rawEdited = false;
    // ⛓ A boundary installs a different world: a region name from the old one
    //   means nothing in the new, and neither does a cached grid.
    this._selectedRegion = null;
    this._mapCache = null;
    // ⛓ R1 — nor a verdict about the old document's issues. Keyed on the record
    //   object, so this is hygiene (it drops the reference) rather than
    //   correctness: the new session's record is a different object.
    this._validationCache = null;
    this._sidecarIssueCache = null;
    /**
     * ⛓ H4b — …and neither does a remembered room verdict. The key is
     * `slot|region`, and two documents can hold the same slot and the same
     * region NAME while one of them round-trips and the other does not. (S1:
     * each verdict is keyed on its record, so this is hygiene — it drops the
     * old record's references — rather than correctness.) ⛔ Also the open
     * room: it was opened on the OLD record's working copy, so its save would
     * land an op built against a document nobody is editing any more.
     */
    this._roomVerdicts.clear();
    this._closeRoomEditor();
    // ⛓ S0 — and the sidecar view's disclosures: a new document's list starts
    //   collapsed, and a `slot|region` key from the old one names nothing here.
    this._expandedSidecarJson.clear();
    this._sidecarListOpen = false;
    this._render();
  }

  /**
   * ⛓⛓ ONE OP → the session → a re-render. ⛔ The THREE outcomes are told apart
   * by NAME, exactly as `editCore` reports them: a refusal prints the
   * substrate's own sentence (which, where the op broke a reference, is
   * `validateRules`' own), a no-op says so rather than claiming an edit, and
   * only an applied op moves the readout.
   *
   * ⚠ The validation bar and the status line are re-rendered from the RECORD on
   * every outcome, so a bar read after an undo cannot be the one from before it.
   */
  _applyOp(op, { message = null, rerender = true } = {}) {
    if (!this.session) {
      alert('Load a rules.json first.');
      return { ok: false, applied: false, description: 'no session' };
    }
    // ⛓ S1 — the beside-the-row message describes ONE op. The next edit
    //   replaces it (`_focusAcceptedOp` sets it again straight after this
    //   returns) rather than leaving a sentence about an older one standing.
    this._opRowMessage = null;
    // ⛓ H4b — an applied edit can change whether a region's room round-trips;
    //   S1 keyed each remembered verdict on the RECORD it was asked about
    //   (see `_roomVerdicts`), which this op replaces — so no clear here, and
    //   an undo, which never comes through here, is covered the same way.
    const res = this.session.apply(this._stampPlayer(op));
    if (!res.ok) {
      this._opMessage = `Refused: ${res.description}`;
      log('warn', `op refused: ${res.description}`);
      alert(res.description);
    } else if (!res.applied) {
      this._opMessage = `No change (${res.description}).`;
    } else {
      this._opMessage = message ? message(res) : res.description;
    }
    if (rerender) this._render(); else this._renderChrome();
    return res;
  }

  /**
   * ⛓⛓ **THE SCHEMA, FETCHED ONCE, AND A FAILURE IS NAMED RATHER THAN
   * SILENT.** The Document tab is DERIVED from it, so without it there is no
   * registry — but the tab still has to draw, because a document's own keys are
   * visible whether or not the schema arrived. ⇒ on failure the tab says which
   * URL failed and falls back to the unknown-key row for EVERY key, which is
   * the same row an undeclared key gets.
   */
  _loadRulesSchema() {
    if (this._rulesSchema || this._schemaPending) return;
    this._schemaPending = true;
    fetch(RULES_SCHEMA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((schema) => {
        this._rulesSchema = schema;
        this._schemaError = null;
        this._schemaPending = false;
        log('info', `Loaded rules.schema.json — ${Object.keys(schema.properties ?? {}).length} `
          + 'top-level keys for the Document tab.');
        if (this.isInitialized) this._render();
      })
      .catch((err) => {
        this._schemaPending = false;
        this._schemaError = `${RULES_SCHEMA_URL}: ${err.message}`;
        log('warn', `Could not load the rules schema: ${this._schemaError}`);
        if (this.isInitialized) this._render();
      });
  }

  /**
   * ⛓⛓ **THE SLOT, RE-DERIVED FROM THE RECORD ON EVERY RENDER.** ⛔ Not cached
   * across a session boundary and not trusted across an undo: a slot the
   * document no longer carries would leave every tab drawing an empty world
   * with no visible reason, so a chosen slot that vanished falls back to the
   * document's own default rather than persisting as a ghost.
   */
  _syncPlayer() {
    const slots = this._playerSlots();
    if (this._chosenPlayer && (slots.length === 0 || slots.includes(this._chosenPlayer))) {
      this.playerId = this._chosenPlayer;
      return;
    }
    this._chosenPlayer = null;
    this.playerId = this.rulesDoc
      ? defaultPlayerOf(this.rulesDoc, this._rulesSchema, DEFAULT_PLAYER_ID)
      : DEFAULT_PLAYER_ID;
  }

  /** ⛓ The slots this document is ABOUT — the union over every per-player key. */
  _playerSlots() {
    if (!this.rulesDoc || !this._rulesSchema) return [];
    try {
      return playerSlotsOf(this.rulesDoc, this._rulesSchema);
    } catch (err) {
      log('warn', `Could not derive the document's player slots: ${err.message}`);
      return [];
    }
  }

  /**
   * ⛓ THE SELECTOR, DERIVED. Its options are the document's own slots and its
   * value is `this.playerId`; a document with one slot still shows it, because
   * "which player am I editing" is a question the panel used to answer silently
   * with `'1'` and now answers out loud.
   */
  _renderPlayerSelector() {
    if (!this.playerSelect) return;
    const slots = this._playerSlots();
    const shown = slots.length > 0 ? slots : [this.playerId];
    const names = this.rulesDoc?.player_names ?? {};
    this.playerSelect.innerHTML = '';
    for (const slot of shown) {
      const opt = document.createElement('option');
      opt.value = slot;
      opt.textContent = names[slot] ? `${slot} — ${names[slot]}` : `Player ${slot}`;
      this.playerSelect.appendChild(opt);
    }
    this.playerSelect.value = this.playerId;
    this.playerSelect.disabled = !this.rulesDoc || shown.length <= 1;
    this.playerSelect.style.opacity = this.playerSelect.disabled ? '0.5' : '1';
    this.playerSelect.title = slots.length > 1
      ? `This document carries ${slots.length} player slots; every tab and every edit `
        + 'is about the one selected here.'
      : 'This document is about one player slot.';
  }

  /**
   * ⛓⛓ **THE SELECTED SLOT IS STAMPED HERE, NOT REMEMBERED BY EACH CALLER.**
   * Every op in `rulesDocOps` carries `player` and every handler in this file
   * passes `this.playerId` — but a handler that FORGOT would silently edit slot
   * `'1'` (`playerOf`'s default) while the person is looking at slot 3, and
   * nothing would say so. So the one application path fills a missing `player`
   * in, group members included; an op that names one keeps it.
   *
   * ⛔ It never OVERWRITES a stated slot: `deleteRegionOps`/`deleteItemOps`
   * build their cascades against a slot the caller chose, and a stamp that won
   * over the builder would silently re-target a cascade mid-group.
   */
  _stampPlayer(op) {
    if (!op || typeof op !== 'object') return op;
    if (isGroup(op)) {
      return { ...op, ops: op.ops.map((member) => this._stampPlayer(member)) };
    }
    return op.player === undefined ? { ...op, player: this.playerId } : op;
  }

  /** ⛓ UNDO — the fold over a shorter list, never a stack pop.
   *
   * ⛓ S1 — and it takes the beside-the-row message with it: *"saved — applied
   * as one `set-key` you can undo here"* standing beside a row whose op has
   * just been undone is a readout about a document that no longer exists. */
  _undo() {
    this._opRowMessage = null;
    if (!this.session || !this.session.undo()) {
      this._opMessage = 'Nothing to undo.';
      this._render();
      return false;
    }
    this._opMessage = `Undone — ${describeOps(this.session.ops())} left.`;
    this._render();
    return true;
  }

  /**
   * ⛓⛓ **Ctrl/Cmd+Z, AND IT REFUSES INSIDE AN INPUT.** ⛔ This panel is ALL
   * inputs — every region name, every exit name, every item field, the raw-JSON
   * textareas — so the guard is the important half of the binding: a browser's
   * own undo inside a half-typed field is what a person means by ⌘Z while their
   * cursor is in it, and stealing it would roll back a document edit they were
   * not even looking at.
   */
  _onKeyDown(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if ((e.key ?? '').toLowerCase() !== 'z') return;
    const t = e.target;
    if (t && typeof t.closest === 'function' && t.closest('input, select, textarea')) return;
    if (t && t.isContentEditable) return;
    e.preventDefault();
    this._undo();
  }

  onPanelDestroy() {
    this._teardownRawEditor();
    this._closeRoomEditor();
    if (this._keyHandler) {
      this.rootElement.removeEventListener('keydown', this._keyHandler);
      this.rootElement.removeEventListener('mousedown', this._focusHandler);
      this._keyHandler = null;
      this._focusHandler = null;
    }
    if (this.rawJsonUnsubscribe) {
      try { this.rawJsonUnsubscribe(); } catch (_) { /* noop */ }
      this.rawJsonUnsubscribe = null;
    }
    if (this.loadRulesUnsubscribe) {
      try { this.loadRulesUnsubscribe(); } catch (_) { /* noop */ }
      this.loadRulesUnsubscribe = null;
    }
    if (this.selectRegionUnsubscribe) {
      try { this.selectRegionUnsubscribe(); } catch (_) { /* noop */ }
      this.selectRegionUnsubscribe = null;
    }
  }

  getRootElement() {
    return this.rootElement;
  }

  // ---------- Chrome (toolbar + scroll container) ----------

  _buildChrome() {
    const toolbar = document.createElement('div');
    Object.assign(toolbar.style, {
      padding: '6px 8px',
      backgroundColor: '#222',
      borderBottom: '1px solid #333',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flex: '0 0 auto',
    });

    /**
     * ⛓ APPLY KEEPS ITS NAME. The ⚖ asked for "a way to load the rules.json
     * data into the app, as if it was a preset", and that is what this button
     * has always done — a second button beside it doing the same thing under a
     * different name would be two doors into one room. What changed is the
     * BEHAVIOUR (the origin source name rides along, so the sphere log
     * survives) and the title, which now says what the gesture means.
     */
    this.applyButton = this._makeButton('Apply', '#2e7d32', () => this._handleApply());
    this.applyButton.title = 'Load this document into the app, as if it were a preset '
      + '(publishes it app-wide under the source it came from, so its sphere log follows)';
    toolbar.appendChild(this.applyButton);

    this.downloadButton = this._makeButton('⭳ Download', '#33506e', () => this._handleDownload());
    this.downloadButton.classList.add('apworld-download');
    this.downloadButton.title = 'Save this document as a rules.json file';
    toolbar.appendChild(this.downloadButton);

    this.clearButton = this._makeButton('Clear', '#8a2a2a', () => this._handleClear());
    this.clearButton.title = 'Remove all regions, exits, locations, and items (metadata kept)';
    toolbar.appendChild(this.clearButton);

    this.reloadButton = this._makeButton('Reload', '#444', () => this._handleReload());
    this.reloadButton.title = 'Discard edits and reload the rules data the rest of the app currently has loaded';
    toolbar.appendChild(this.reloadButton);

    /**
     * ⛓⛓ UNDO — its label and its `disabled` are DERIVED from
     * `describeOps(session.ops())` on every render, never from a flag this file
     * keeps in step. A delete cascade of three ops is ONE group and therefore
     * reads as ONE edit, which is what undo is a count of.
     */
    this.undoButton = this._makeButton('↶ Undo', '#444', () => this._undo());
    this.undoButton.classList.add('apworld-undo');
    toolbar.appendChild(this.undoButton);

    /**
     * ⛓ THE PLAYER SELECTOR sits in the toolbar because it is not a property of
     * any one tab — every tab and every op reads it.
     */
    const playerWrap = document.createElement('label');
    Object.assign(playerWrap.style, {
      display: 'flex', alignItems: 'center', gap: '4px', color: '#aaa', fontSize: '12px',
    });
    playerWrap.appendChild(document.createTextNode('Player'));
    this.playerSelect = document.createElement('select');
    this.playerSelect.className = 'apworld-player-select';
    Object.assign(this.playerSelect.style, {
      backgroundColor: '#333', color: '#eee', border: '1px solid #555',
      borderRadius: '3px', fontSize: '12px', padding: '2px 4px',
    });
    this.playerSelect.addEventListener('change', (e) => {
      this._chosenPlayer = e.target.value;
      this._opMessage = `Editing player ${this._chosenPlayer}.`;
      this._render();
    });
    playerWrap.appendChild(this.playerSelect);
    toolbar.appendChild(playerWrap);

    this.statusLabel = document.createElement('span');
    this.statusLabel.style.color = '#888';
    this.statusLabel.style.marginLeft = 'auto';
    this.statusLabel.textContent = 'No rules loaded';
    toolbar.appendChild(this.statusLabel);

    this.rootElement.appendChild(toolbar);

    this.tabBar = document.createElement('div');
    Object.assign(this.tabBar.style, {
      display: 'flex',
      alignItems: 'stretch',
      backgroundColor: '#1d1d1d',
      borderBottom: '1px solid #333',
      flex: '0 0 auto',
    });
    this.tabButtons = {};
    for (const tab of TABS) {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      Object.assign(btn.style, {
        padding: '5px 14px',
        backgroundColor: 'transparent',
        color: '#aaa',
        border: 'none',
        borderBottom: '2px solid transparent',
        cursor: 'pointer',
        fontSize: '12px',
      });
      btn.addEventListener('click', () => this._selectTab(tab.id));
      this.tabBar.appendChild(btn);
      this.tabButtons[tab.id] = btn;
    }
    this.rootElement.appendChild(this.tabBar);
    this._updateTabStyles();

    this.validationBar = document.createElement('div');
    Object.assign(this.validationBar.style, {
      flex: '0 0 auto',
      borderBottom: '1px solid #333',
      backgroundColor: '#1a1a1a',
      fontSize: '12px',
    });
    this.rootElement.appendChild(this.validationBar);
    this.issuesExpanded = false;

    this.scrollContainer = document.createElement('div');
    Object.assign(this.scrollContainer.style, {
      flex: '1 1 auto',
      overflow: 'auto',
      padding: '8px',
    });
    this.rootElement.appendChild(this.scrollContainer);

    /**
     * ⛔ **THE ROOT HAS TO HOLD FOCUS OR THE KEY BINDING IS UNREACHABLE** (trap
     * 874, B-a's and B-b's): a `<div>` with no tabindex is not focusable, so a
     * press on the panel's chrome would send ⌘Z to `<body>`. Focus moves to the
     * root on a press anywhere that is NOT itself a control — a control keeps
     * the focus the browser is about to give it, because this listener runs
     * BEFORE mousedown's default focus action.
     */
    this.rootElement.tabIndex = -1;
    this._focusHandler = (e) => {
      const t = e.target;
      if (t && typeof t.closest === 'function'
        && t.closest('input, select, textarea, button, [contenteditable]')) return;
      this.rootElement.focus({ preventScroll: true });
    };
    this._keyHandler = (e) => this._onKeyDown(e);
    this.rootElement.addEventListener('mousedown', this._focusHandler);
    this.rootElement.addEventListener('keydown', this._keyHandler);
  }

  /** ⛓ The Undo control, DERIVED from the op list on every render. */
  _renderUndoButton() {
    if (!this.undoButton) return;
    const n = this.session ? this.session.ops().length : 0;
    this.undoButton.disabled = n === 0;
    this.undoButton.style.opacity = n === 0 ? '0.45' : '1';
    this.undoButton.style.cursor = n === 0 ? 'default' : 'pointer';
    this.undoButton.textContent = `↶ Undo (${describeOps(this.session ? this.session.ops() : [])})`;
    this.undoButton.title = n === 0
      ? 'Nothing to undo'
      : 'Undo the last edit (Ctrl/Cmd+Z — refused inside a text field)';
  }

  _selectTab(tabId) {
    if (!TABS.some(t => t.id === tabId)) return;
    if (this.activeTab === tabId) return;
    this.activeTab = tabId;
    this._updateTabStyles();
    this._render();
  }

  _updateTabStyles() {
    for (const tab of TABS) {
      const btn = this.tabButtons[tab.id];
      if (!btn) continue;
      const active = this.activeTab === tab.id;
      btn.style.color = active ? '#fff' : '#aaa';
      btn.style.borderBottomColor = active ? '#2e7d32' : 'transparent';
      btn.style.backgroundColor = active ? '#262626' : 'transparent';
    }
  }

  _makeButton(label, bg, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, {
      padding: '3px 10px',
      backgroundColor: bg,
      color: '#fff',
      border: '1px solid #555',
      borderRadius: '3px',
      cursor: 'pointer',
      fontSize: '12px',
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  _flashButton(btn, success) {
    const originalBg = btn.style.backgroundColor;
    const originalText = btn.textContent;
    btn.textContent = success ? 'Applied!' : 'Error';
    btn.style.backgroundColor = success ? '#4CAF50' : '#f44336';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.backgroundColor = originalBg;
    }, success ? 1000 : 2000);
  }

  // ---------- Accessors on the session's record ----------
  //
  // ⛔ PURE READS, every one. Each of these used to lazily CREATE its container
  //   (`all[this.playerId] || (all[this.playerId] = {})`), which over a session is a
  //   write THROUGH the folded record — and at zero ops `record()` IS the base,
  //   so a render would have modified the document the fold starts from. The
  //   ops create what they need, copy-on-write.

  _regions() {
    return this.rulesDoc?.regions?.[this.playerId] ?? {};
  }

  _regionNames() {
    return Object.keys(this._regions());
  }

  _items() {
    return this.rulesDoc?.items?.[this.playerId] ?? {};
  }

  _itemPoolCounts() {
    return this.rulesDoc?.itempool_counts?.[this.playerId] ?? {};
  }

  _startingItems() {
    const list = this.rulesDoc?.starting_items?.[this.playerId];
    return Array.isArray(list) ? list : [];
  }

  _startingCount(itemName) {
    let n = 0;
    for (const s of this._startingItems()) {
      if (s === itemName) n++;
    }
    return n;
  }

  // ---------- Mutations — every one an OP through the session ----------

  _setStartingCount(itemName, count) {
    this._applyOp({ op: 'set-starting-count', item: itemName, count, player: this.playerId });
  }

  _handleAddRegion() {
    // ⛓ The name is DERIVED BY THE OP from the record, so `{op:'add-region'}`
    //   with no name folds to the same name every time (bounceLevelOps.nextId's
    //   rule) and undo reproduces the document byte for byte.
    this._applyOp({ op: 'add-region', player: this.playerId });
  }

  _handleDeleteRegion(oldName) {
    if (!confirm(`Delete region "${oldName}" and all its exits and locations?`)) return;
    // ⛓⛓ THE CASCADE IS A GROUP, so ONE undo restores the region AND the
    //    destinations the delete blanked. The atomic `delete-region` REFUSES
    //    while a surviving exit still points at it, which is what makes the
    //    split enforceable rather than conventional.
    const ops = deleteRegionOps(this.rulesDoc, oldName, this.playerId);
    this._applyOp(ops.length === 1 ? ops[0] : group(`delete region ${oldName}`, ops));
  }

  _handleRenameRegion(oldName, newName) {
    this._applyOp({
      op: 'rename-region', from: oldName, to: newName, player: this.playerId,
    });
  }

  _handleAddExit(regionName) {
    this._applyOp({ op: 'add-exit', region: regionName, player: this.playerId });
  }

  _handleDeleteExit(regionName, index) {
    this._applyOp({ op: 'delete-exit', region: regionName, index, player: this.playerId });
  }

  _handleAddLocation(regionName) {
    this._applyOp({ op: 'add-location', region: regionName, player: this.playerId });
  }

  _handleDeleteLocation(regionName, index) {
    this._applyOp({ op: 'delete-location', region: regionName, index, player: this.playerId });
  }

  _handleRenameLocation(regionName, index, newName) {
    this._applyOp({
      op: 'rename-location', region: regionName, index, to: newName, player: this.playerId,
    });
  }

  _handleAddItem() {
    this._applyOp({ op: 'add-item', player: this.playerId });
  }

  _handleDeleteItem(name) {
    if (!confirm(`Delete item "${name}"?`)) return;
    // ⛓⛓ The same cascade shape: the pool count and the starting entries are
    //    cleared FIRST — each is a validator ERROR on its own — then the item.
    const ops = deleteItemOps(this.rulesDoc, name, this.playerId);
    this._applyOp(ops.length === 1 ? ops[0] : group(`delete item ${name}`, ops));
  }

  _handleRenameItem(oldName, newName) {
    this._applyOp({ op: 'rename-item', from: oldName, to: newName, player: this.playerId });
  }

  /**
   * ⛓⛓ **RELOAD IS A SESSION BOUNDARY, NOT AN OP.** The document it installs
   * came from OUTSIDE — it is whatever the rest of the app currently holds —
   * and no edit list can express that. So it opens a NEW session, the op list
   * goes with the document it described, and undo does not cross it. That is
   * also exactly what the button has always promised: *discard your edits*.
   */
  _handleReload() {
    const current = this._getCurrentAppRules();
    if (!current.doc) {
      alert('No rules data is currently loaded in the app.');
      return;
    }
    if (!confirm('Discard your edits and reload the rules data the rest of the app currently has loaded?')) return;
    this._opMessage = null;
    this._openSession(current.doc, {
      kind: 'rules', source: 'reload', player: this.playerId, origin: current.source,
    });
    log('info', 'Reloaded rules from the app\'s last published rules.json.');
  }

  /**
   * ⛓⛓ **THE DOCUMENT *AND* THE NAME THE APP LOADED IT UNDER, together.** ⛔ The
   * two used to be fetched separately and that is how a provenance goes wrong:
   * the legacy `G_combinedModeData` fallback reflects only the STARTUP load and
   * goes stale after a preset switch, so pairing its document with the last
   * published source would attribute one world's bytes to another world's path
   * — and Apply would then fetch the wrong sphere log.
   */
  _getCurrentAppRules() {
    const last = getLastRawJsonData();
    if (last?.rawJsonData) return { doc: last.rawJsonData, source: last.source ?? null };
    const legacy = (typeof window !== 'undefined'
      && window.G_combinedModeData
      && window.G_combinedModeData.rulesConfig) || null;
    return { doc: legacy, source: null };
  }

  /**
   * ⛓⛓⛓ **CLEAR IS AN OP, AND THAT IS A DEPARTURE FROM THE BRIEF, MEASURED.**
   * The kickoff grouped it with Reload as a session boundary. ⛔ The two are not
   * the same kind of thing, and the difference is where the input comes from:
   * Reload installs a document that arrived from OUTSIDE, which nothing in a
   * record can express; CLEAR INVENTS NO NEW BASE — it is a function of the
   * document being edited (empty the four per-slot containers, keep every other
   * key, including `procgen_metadata`). So it is expressible, deterministic and
   * therefore UNDOABLE, which is the whole point of the slice. As a boundary it
   * would have been the one gesture in this panel that destroys work with no way
   * back — behind a `confirm()` precisely because it had none.
   */
  _handleClear() {
    if (!confirm('Remove all regions, exits, locations, items, pool counts, and starting items? (Other rules.json metadata is kept.)')) return;
    this._applyOp({ op: 'clear', player: this.playerId });
  }

  /**
   * ⛓⛓ **APPLY DOES NOT RESET THE SESSION.** It publishes `session.record()`
   * back to the app as a fresh rules reload and leaves the op list alone: the
   * person may well keep editing, and an undo after an Apply must still work.
   * ⛔ The echo of that publish is the one `RAW_JSON_LOADED` this panel ignores
   * (`_appliedDocs`, by object identity), which is what stops its own Apply
   * from opening a boundary that would discard the edits it just published.
   *
   * ── ⛓⛓⛓ **APPLY IS "LOAD IT AS IF IT WERE A PRESET", AND THE DELTA IS THE
   *    SPHERE LOG** (H2 Task 3; ⚖ user: *"I want a way to load the rules.json
   *    data into the app, as if it was a preset."*)
   *
   * The brief's first guess was that the delta was the `rules:loaded` event a
   * preset load publishes and Apply does not. ⚠ OVERTURNED before this slice
   * started: `rules:loaded` has NO subscriber anywhere in `frontend/` — only a
   * publisher registration (`presets/index.js:55`) — so publishing it from here
   * would be a cargo-cult line.
   *
   * ⛓ **THE REAL DELTA, MEASURED.** `files:jsonLoaded.sourceName` becomes
   * `stateManagerProxy.currentRulesSource` (`app/initialization/index.js:730`)
   * and reaches `sphereState` as `stateManager:rulesLoaded.source`
   * (`stateManagerProxy.js:523`). `sphereState/index.js:254` parses it as a
   * preset path to derive `./presets/<game>/<dir>/<seed>_sphere_log.jsonl`, and
   * when it cannot parse it, it recognises exactly four in-memory sources by
   * name (`moduleSpecificConfigProvidedRules`, `editorApply`, `procgenPipeline`,
   * `hardcodedFallback:*`) and tries the EMBEDDED `sphere_log` for three of
   * them. `apworldEditorApply` is not one of the four. ⇒ Apply used to reset the
   * sphere state and then load nothing at all:
   *
   *   · **173 of the 205 committed presets** keep their sphere log as a
   *     SIBLING FILE and carry no embedded one — the file path is the only way
   *     to reach it, and Apply threw the path away.
   *   · **26** carry an embedded `sphere_log` and no file — and those lost it
   *     too, because the embedded fallback is gated on that four-name list.
   *   · 6 have neither. (Measured over the 205 committed presets; the command
   *     is in the plan's §12.)
   *
   * ⇒ **Apply re-publishes the session's ORIGIN source name.** That is the
   * smaller of the two fixes the brief offered and the only one that does not
   * change the document: embedding the fetched log under the schema's
   * `sphere_log` key would put bytes into the person's document that their
   * preset never had, and the ⚖ says the save destination IS the rules.json
   * data. Carrying the origin makes both cases work through the code that
   * already exists — the file path re-derives the sibling log; an embedded log
   * rides along inside the document it was always part of.
   *
   * ⛔ `APPLY_SOURCE` survives as the fallback for a document with NO origin (a
   * pipeline or marking-tool hand-off, which was built in memory and has no
   * preset path). `scripts/procgen/check-region-marking-tool.mjs:653` grabs the
   * published event by that exact string, and its session is a hand-off — a
   * node row below pins that pairing so a future change to the fallback reds
   * here rather than in a hand-run browser gate.
   */
  _handleApply() {
    if (!this.rulesDoc) {
      this._flashButton(this.applyButton, false);
      return;
    }
    try {
      // Emit a full-doc clone so preserved keys (procgen_metadata etc.) survive
      // the apply round-trip alongside the edited regions/items/rules.
      const published = cloneFullRulesDoc(this.rulesDoc);
      this._appliedDocs.add(published);
      const sourceName = this._originSourceName ?? APPLY_SOURCE;
      this.eventBus.publish('files:jsonLoaded', {
        jsonData: published,
        selectedPlayerId: this.playerId,
        sourceName,
        // ⛓ An explicit marker, since `sourceName` is now the ORIGIN's. Extra
        //   fields are dropped by the state manager's `rawJsonDataLoaded`
        //   re-emit, so nothing downstream can key on it by accident.
        appliedBy: APPLY_SOURCE,
      });
      this._flashButton(this.applyButton, true);
      this._opMessage = sourceName === APPLY_SOURCE
        ? 'Applied — this document has no preset origin, so no sphere log is fetched.'
        : `Applied as ${sourceName}.`;
      this._renderChrome();
      log('info', `Published files:jsonLoaded from APWorld Editor as ${sourceName}.`);
    } catch (err) {
      log('error', 'Apply failed:', err);
      this._flashButton(this.applyButton, false);
    }
  }

  // ---------- Rendering ----------

  _render() {
    // ⛔ BEFORE the container is emptied — see `_teardownRawEditor`.
    this._teardownRawEditor();
    this.scrollContainer.innerHTML = '';
    this._renderChrome();

    /**
     * ⛓ THE LINKS TAB DRAWS WITH NO DOCUMENT, and that is the ⚖ the tab exists
     * for: *"a convenient way to open [the other editors] even if the current
     * rules.json file doesn't contain any relevant data for them"* — and "no
     * document at all" is the strongest case of that.
     */
    if (!this.rulesDoc && this.activeTab !== 'links') {
      const msg = document.createElement('div');
      msg.style.color = '#888';
      msg.style.padding = '12px';
      msg.textContent = 'Load a rules.json (via Presets, File, or Editor) to begin editing. '
        + 'The Links tab works without one.';
      this.scrollContainer.appendChild(msg);
      return;
    }

    if (this.activeTab === 'items') {
      this._renderItemsTab();
    } else if (this.activeTab === 'placements') {
      this._renderPlacementsTab();
    } else if (this.activeTab === 'meta') {
      this._renderMetaTab();
    } else if (this.activeTab === 'sidecars') {
      this._renderSidecarsTab();
    } else if (this.activeTab === 'document') {
      this._renderDocumentTab();
    } else if (this.activeTab === 'links') {
      this._renderLinksTab();
    } else if (this.activeTab === 'raw') {
      this._renderRawTab();
    } else if (this.activeTab === 'map') {
      this._renderMapTab();
    } else {
      const regions = this._regions();
      this._renderRegionsTab(regions, Object.keys(regions));
    }
  }

  /**
   * ⛓⛓ **THE CHROME IS RE-READ FROM THE RECORD AFTER EVERY APPLY AND EVERY
   * UNDO** — the validation bar, the Undo control's count and the status line.
   * ⛔ A bar left standing across an undo would be a readout about a document
   * that no longer exists, which is the derived-state defect this slice was
   * asked to sweep for.
   */
  _renderChrome() {
    this._syncPlayer();
    this._renderPlayerSelector();
    this._renderValidationBar();
    this._renderUndoButton();
    if (!this.rulesDoc) {
      this.statusLabel.textContent = this._opMessage ?? 'No rules loaded';
      return;
    }
    const gameName = this.rulesDoc.game_name || '(unnamed game)';
    let summary;
    if (this.activeTab === 'items') {
      const count = Object.keys(this._items()).length;
      summary = `${gameName} — ${count} item${count === 1 ? '' : 's'}`;
    } else if (this.activeTab === 'placements') {
      const { placed, total } = this._placementTally();
      summary = `${gameName} — ${placed} of ${total} location${total === 1 ? '' : 's'} placed`;
    } else if (this.activeTab === 'meta') {
      summary = `${gameName} — metadata`;
    } else if (this.activeTab === 'sidecars') {
      const n = this._sidecarRows().length;
      const carried = this._sidecarRows().filter((r) => r.topLevelPresent).length;
      summary = `${gameName} — ${carried} of ${n} sidecar key`
        + `${n === 1 ? '' : 's'} in this document`;
    } else if (this.activeTab === 'document') {
      const n = this._documentRows().length;
      summary = `${gameName} — ${n} top-level key${n === 1 ? '' : 's'}`;
    } else if (this.activeTab === 'links') {
      const n = buildLinkRows(substrateRegistry).length;
      summary = `${gameName} — ${n} editor link${n === 1 ? '' : 's'}`;
    } else if (this.activeTab === 'raw') {
      summary = `${gameName} — ${this._rawVerdict().bytes.toLocaleString()} bytes`;
    } else if (this.activeTab === 'map') {
      const result = this._mapResult();
      summary = result
        ? `${gameName} — ${result.stats.regionsBuilt} region${result.stats.regionsBuilt === 1 ? '' : 's'} `
          + `on a ${result.grid.width}×${result.grid.height} grid (slot ${result.playerId})`
        : `${gameName} — no map for this world`;
    } else {
      const n = this._regionNames().length;
      summary = `${gameName} — ${n} region${n === 1 ? '' : 's'}`;
    }
    this.statusLabel.textContent = this._status(summary);
  }

  /**
   * ⛓ The status line is the DOCUMENT's summary, plus the last op's own
   * sentence when there is one — a refusal, a `No change (…)`, or what the
   * substrate called the edit. ⛔ The three outcomes read differently, so a
   * click that changed nothing cannot look like one that did.
   */
  _status(summary) {
    return this._opMessage ? `${summary} · ${this._opMessage}` : summary;
  }

  /**
   * ⛓⛓⛓ **R1 — THE ISSUE LIST, MEMOISED ON THE RECORD.** ⛔ `validateRules`
   * itself is untouched: this changes WHEN it runs, never WHAT it reports. See
   * `_validationCache` in the constructor for the key and for why the op count
   * is not it.
   */
  _validationIssues() {
    const doc = this.rulesDoc;
    if (!doc) return [];
    const c = this._validationCache;
    if (c && c.doc === doc && c.playerId === this.playerId) return c.issues;
    // ⛓ V0 — the sidecar report joins the list, each issue carrying the region it
    //   is about (the row's click lands there) and the sentence the gate prints.
    const sidecar = this._sidecarIssues().map((i) => ({
      ...i, tab: 'regions', source: 'sidecar', message: describeSidecarIssue(i),
    }));
    const issues = [...validateRules(doc, this.playerId), ...sidecar];
    this._validationCache = { doc, playerId: this.playerId, issues };
    return issues;
  }

  /**
   * ⛓⛓ PRESET SIDECARS V0 — **THE SELECTED SLOT'S SIDECAR ISSUES**, memoised on
   * the record and the slot (see `_sidecarIssueCache`). ⛔ The block draws the
   * SELECTED slot (its own docblock says why), so this is the only slot it asks.
   */
  _sidecarIssues() {
    const doc = this.rulesDoc;
    if (!doc) return [];
    const c = this._sidecarIssueCache;
    if (c && c.doc === doc && c.playerId === this.playerId) return c.issues;
    const issues = sidecarIssues(doc, this.playerId);
    this._sidecarIssueCache = { doc, playerId: this.playerId, issues };
    return issues;
  }

  /** ⛓ V0 — one region's sidecar issues (the block's list, the Sidecars row's badge). */
  _sidecarIssuesOf(regionName) {
    return this._sidecarIssues().filter((i) => i.region === regionName);
  }

  _renderValidationBar() {
    this.validationBar.innerHTML = '';
    if (!this.rulesDoc) return;

    const issues = this._validationIssues();
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warnCount = issues.length - errorCount;
    // ⛓ V0 — the bar's counts, readable: the whole list, and how many of it the
    //   sidecar report contributed.
    this.validationBar.dataset.issues = String(issues.length);
    this.validationBar.dataset.sidecarIssues = String(
      issues.filter((i) => i.source === 'sidecar').length);

    const summary = document.createElement('div');
    Object.assign(summary.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 8px',
      cursor: issues.length ? 'pointer' : 'default',
      userSelect: 'none',
    });

    const dot = document.createElement('span');
    dot.style.display = 'inline-block';
    dot.style.width = '8px';
    dot.style.height = '8px';
    dot.style.borderRadius = '50%';
    if (errorCount > 0) dot.style.backgroundColor = '#e05040';
    else if (warnCount > 0) dot.style.backgroundColor = '#d6a030';
    else dot.style.backgroundColor = '#4CAF50';
    summary.appendChild(dot);

    const label = document.createElement('span');
    if (!issues.length) {
      label.textContent = 'No issues';
      label.style.color = '#8a8';
    } else {
      const parts = [];
      if (errorCount) parts.push(`${errorCount} error${errorCount === 1 ? '' : 's'}`);
      if (warnCount) parts.push(`${warnCount} warning${warnCount === 1 ? '' : 's'}`);
      const caret = this.issuesExpanded ? '▾' : '▸';
      label.textContent = `${caret} ${parts.join(', ')}`;
      label.style.color = errorCount ? '#e8a095' : '#d6a030';
    }
    summary.appendChild(label);

    if (issues.length) {
      summary.addEventListener('click', () => {
        this.issuesExpanded = !this.issuesExpanded;
        this._renderValidationBar();
      });
    }
    this.validationBar.appendChild(summary);

    if (issues.length && this.issuesExpanded) {
      const list = document.createElement('div');
      Object.assign(list.style, {
        maxHeight: '180px',
        overflowY: 'auto',
        borderTop: '1px solid #2a2a2a',
        padding: '4px 8px 6px',
      });
      for (const issue of issues) {
        const row = document.createElement('div');
        row.className = 'apworld-validation-issue';
        row.dataset.severity = issue.severity;
        if (issue.source) row.dataset.source = issue.source;
        if (issue.kind) row.dataset.kind = issue.kind;
        // ⛓ V0 — a sidecar issue names its region: the click lands ON it.
        const toRegion = issue.source === 'sidecar' && issue.region;
        Object.assign(row.style, {
          display: 'flex',
          gap: '6px',
          padding: '2px 0',
          color: '#ccc',
          fontSize: '11px',
          cursor: toRegion || (issue.tab && issue.tab !== this.activeTab) ? 'pointer' : 'default',
        });
        const icon = document.createElement('span');
        icon.textContent = issue.severity === 'error' ? '⛔' : '⚠';
        icon.style.flex = '0 0 auto';
        row.appendChild(icon);
        const msg = document.createElement('span');
        msg.textContent = issue.message;
        row.appendChild(msg);
        if (issue.tab) {
          const tag = document.createElement('span');
          tag.textContent = `[${issue.tab}]`;
          tag.style.color = '#888';
          tag.style.marginLeft = 'auto';
          tag.style.flex = '0 0 auto';
          row.appendChild(tag);
          if (toRegion) {
            row.addEventListener('click', () => this.selectRegion(issue.region, 'the validation bar'));
          } else if (issue.tab !== this.activeTab) {
            row.addEventListener('click', () => this._selectTab(issue.tab));
          }
        }
        list.appendChild(row);
      }
      this.validationBar.appendChild(list);
    }
  }

  _renderRegionsTab(regions, names) {
    const addBtn = this._makeButton('+ Add region', '#444', () => this._handleAddRegion());
    addBtn.style.marginBottom = '8px';
    this.scrollContainer.appendChild(addBtn);
    for (const regionName of names) {
      this.scrollContainer.appendChild(this._renderRegion(regionName, regions[regionName]));
    }
  }

  _renderItemsTab() {
    // ⛓ I1 — the slot's group VOCABULARY first, then the items that use it:
    //   a person adds a group before they can put anything in it, and the
    //   per-item picker below draws only names this section lists.
    this.scrollContainer.appendChild(this._renderItemGroupsSection());
    // ⛓ I2 — then the mappings that turn those items into levels and counters.
    //   Both sections are ABOUT the item rows below and are read before them.
    this.scrollContainer.appendChild(this._renderProgressionSection());

    const addBtn = this._makeButton('+ Add item', '#444', () => this._handleAddItem());
    addBtn.style.marginBottom = '8px';
    this.scrollContainer.appendChild(addBtn);

    const items = this._items();
    const names = Object.keys(items);
    if (!names.length) {
      const hint = document.createElement('div');
      hint.style.color = '#888';
      hint.style.padding = '8px';
      hint.textContent = 'No items yet. Click "+ Add item" to start.';
      this.scrollContainer.appendChild(hint);
      return;
    }

    // Column header
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'grid',
      gridTemplateColumns: '1.4fr 70px 1.1fr 80px 80px 1fr 32px',
      gap: '6px',
      padding: '4px 8px',
      color: '#9ab',
      fontSize: '11px',
      fontWeight: 'bold',
      borderBottom: '1px solid #333',
    });
    for (const label of ['Name', 'id', 'Classification', 'Max', 'Pool', 'Groups', '']) {
      const cell = document.createElement('div');
      cell.textContent = label;
      header.appendChild(cell);
    }
    this.scrollContainer.appendChild(header);

    for (const name of names) {
      this.scrollContainer.appendChild(this._renderItemRow(name, items[name]));
    }

    // Starting items summary
    const startList = this._startingItems();
    if (startList.length) {
      const startHeader = document.createElement('div');
      startHeader.style.cssText = 'color:#9ab;font-weight:bold;margin:14px 0 4px;';
      startHeader.textContent = `Starting items (${startList.length})`;
      this.scrollContainer.appendChild(startHeader);
      const startDesc = document.createElement('div');
      startDesc.style.cssText = 'color:#888;font-size:11px;margin-bottom:4px;';
      startDesc.textContent = 'Edit per-item "Start" counts on the rows above to change starting items.';
      this.scrollContainer.appendChild(startDesc);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
   * THE GROUPS SECTION — `item_groups`, the slot's group NAME REGISTRY
   * ══════════════════════════════════════════════════════════════════ */

  /**
   * ⛓⛓⛓ **THE REGISTRY IS A NAME LIST; MEMBERSHIP IS ON THE ITEMS — AND THIS
   * SECTION NEVER RECONCILES THE TWO BEHIND THE PERSON'S BACK** (I1).
   *
   * Measured over the 212 committed documents: all 224 slots hold an ARRAY of
   * names, the registry EQUALS the union of the items' own `groups` in 69 slots
   * and differs in 155 — always in the same direction (an item carries a name
   * the registry lacks; `Event` in 154 of them). ⇒ two kinds of row:
   *
   *   · a REGISTRY row, with the count of items carrying it — derived, so it
   *     cannot drift from what `delete-item-group` refuses;
   *   · an UNLISTED row, greyed, for a name the items carry that the registry
   *     does not list, with the one gesture that fits: add it to the registry.
   *
   * ⛔ Neither direction is "fixed" automatically. A registry entry nothing
   * carries is legal (it is what `add` produces on the way to populating it)
   * and an unlisted group is what 155 of the 224 committed slots look like.
   *
   * ⛓ Every count on this section is DERIVED from `itemsCarryingGroup`, the
   * same predicate the op's refusal reads — so the disabled delete button and
   * the refusal can never disagree.
   */
  _renderItemGroupsSection() {
    const registry = itemGroupRegistry(this.rulesDoc, this.playerId);
    const unlisted = unlistedItemGroups(this.rulesDoc, this.playerId);

    const wrap = document.createElement('div');
    wrap.className = 'apworld-item-groups';
    wrap.dataset.slot = String(this.playerId);
    wrap.dataset.listed = String(registry.length);
    wrap.dataset.unlisted = String(unlisted.length);
    Object.assign(wrap.style, {
      border: '1px solid #333', borderRadius: '3px', backgroundColor: '#1f1f1f',
      padding: '6px 8px', margin: '0 0 10px',
    });

    const head = document.createElement('div');
    head.className = 'apworld-item-groups-head';
    head.textContent = `Item groups — slot ${this.playerId}: `
      + `${registry.length} in the registry`
      + (unlisted.length
        ? `, ${unlisted.length} on items but unlisted`
        : '');
    Object.assign(head.style, { color: '#cfe', fontSize: '12px', fontWeight: 'bold',
      marginBottom: '3px' });
    wrap.appendChild(head);

    const intro = document.createElement('div');
    intro.className = 'apworld-item-groups-intro';
    Object.assign(intro.style, { color: '#888', fontSize: '11px', lineHeight: '1.4',
      marginBottom: '6px' });
    intro.textContent = `\`${ITEM_GROUPS_KEY}\` is this slot's list of group NAMES; which items `
      + 'are in a group is the `groups` field on each item row below. `HasGroup`, `group_count` '
      + 'and `group_check` rules count through the items, so the two are edited separately and '
      + 'neither is derived from the other. A group can be listed with no members, and an item '
      + 'can carry a name the registry does not list — both are states committed worlds are in.';
    wrap.appendChild(intro);

    if (!registry.length && !unlisted.length) {
      const none = document.createElement('div');
      none.className = 'apworld-item-groups-empty';
      none.style.cssText = 'color:#888;font-size:11px;margin-bottom:6px;';
      none.textContent = 'No item groups yet. Add one below, then put items in it with the '
        + 'Groups picker on each item row.';
      wrap.appendChild(none);
    }

    for (const name of registry) wrap.appendChild(this._makeItemGroupRow(name, true));
    for (const name of unlisted) wrap.appendChild(this._makeItemGroupRow(name, false));

    wrap.appendChild(this._makeItemGroupAddRow());
    return wrap;
  }

  /**
   * ⛓ One registry (or unlisted) row. ⛓ The rename input commits on `change`
   * — the Meta tab's rule, so one rename is one op and one undo rather than one
   * per keystroke — and Enter blurs into that same commit.
   *
   * ⛓⛓ The delete button is DISABLED with the reason in its `title` while items
   * carry the group. ⛔ That is a COURTESY, not the guard: the guard is
   * `delete-item-group`'s own refusal, which holds for a caller that never drew
   * a button (the Document tab's whole-block `set-key` is one).
   */
  _makeItemGroupRow(name, listed) {
    const carriers = itemsCarryingGroup(this.rulesDoc, name, this.playerId);
    const row = document.createElement('div');
    row.className = 'apworld-item-group-row';
    row.dataset.group = name;
    row.dataset.listed = String(listed);
    row.dataset.carriers = String(carriers.length);
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0',
      opacity: listed ? '1' : '0.75',
    });

    if (listed) {
      const input = this._makeTextInput(name, '100%');
      input.className = 'apworld-item-group-name';
      input.style.flex = '1 1 40%';
      input.title = 'Rename this group — every item carrying it follows, as one op';
      input.addEventListener('change', (e) => {
        const next = e.target.value.trim();
        if (next === name) { e.target.value = name; return; }
        this._applyOp({
          op: 'rename-item-group', name, newName: next, player: this.playerId,
        });
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      });
      row.appendChild(input);
    } else {
      const label = document.createElement('code');
      label.className = 'apworld-item-group-name';
      label.textContent = name;
      Object.assign(label.style, { color: '#e0a030', fontSize: '11px', flex: '1 1 40%' });
      label.title = 'On items, but not in this slot\'s registry';
      row.appendChild(label);
    }

    const count = document.createElement('span');
    count.className = 'apworld-item-group-count';
    count.textContent = `${carriers.length} item${carriers.length === 1 ? '' : 's'}`;
    Object.assign(count.style, { color: '#9ab', fontSize: '11px', flex: '0 0 auto' });
    count.title = carriers.length
      ? `Carried by ${carriers.slice(0, 12).join(', ')}`
        + `${carriers.length > 12 ? `, … and ${carriers.length - 12} more` : ''}`
      : 'No item in this slot carries this group';
    row.appendChild(count);

    if (listed) {
      const del = this._makeButton('×', carriers.length ? '#3a3a3a' : '#8a2a2a',
        () => this._applyOp({
          op: 'delete-item-group', name, player: this.playerId,
        }));
      del.className = 'apworld-item-group-delete';
      del.style.padding = '2px 8px';
      del.style.marginLeft = 'auto';
      // ⛓⛓ ⚖ user 2026-09-09: "Let's go with refuse." The button says why it
      //   cannot, by name, rather than offering a click that ends in an alert.
      del.disabled = carriers.length > 0;
      del.title = carriers.length
        ? `${carriers.length} item${carriers.length === 1 ? '' : 's'} still `
          + `carr${carriers.length === 1 ? 'ies' : 'y'} "${name}" `
          + `(${carriers.slice(0, 6).join(', ')}`
          + `${carriers.length > 6 ? ', …' : ''}). Take the group off `
          + `${carriers.length === 1 ? 'it' : 'them'} first — deleting the registry entry will `
          + 'not do it for you.'
        : `Delete the group "${name}" from this slot's registry`;
      if (carriers.length) { del.style.cursor = 'not-allowed'; del.style.color = '#888'; }
      row.appendChild(del);
    } else {
      const add = this._makeButton('Add to registry', '#3a5a3a', () => this._applyOp({
        op: 'add-item-group', name, player: this.playerId,
      }));
      add.className = 'apworld-item-group-list';
      add.style.fontSize = '11px';
      add.style.marginLeft = 'auto';
      add.title = `Put "${name}" in this slot's \`${ITEM_GROUPS_KEY}\` list — the items already `
        + 'carrying it are not touched';
      row.appendChild(add);
    }
    return row;
  }

  /** ⛓ The add row. Both the button and Enter commit the same way, and the op
   *  is the one that refuses an empty or duplicate name — this only reads the
   *  box. */
  _makeItemGroupAddRow() {
    const line = document.createElement('div');
    line.className = 'apworld-item-groups-add';
    Object.assign(line.style, { display: 'flex', alignItems: 'center', gap: '6px',
      marginTop: '6px' });
    const input = this._makeTextInput('', '100%');
    input.className = 'apworld-item-group-new';
    input.placeholder = 'new group name';
    input.style.flex = '1 1 auto';
    const commit = () => {
      const name = input.value.trim();
      if (!name) return;
      this._applyOp({ op: 'add-item-group', name, player: this.playerId });
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
    });
    line.appendChild(input);
    const btn = this._makeButton('+ Add group', '#444', commit);
    btn.className = 'apworld-item-groups-add-button';
    line.appendChild(btn);
    return line;
  }

  /**
   * ⛓⛓⛓ **THE ITEM'S GROUPS CELL — A PICKER OVER THE REGISTRY, AND ITS OPTION
   * LIST IS LAZY BECAUSE OF WHAT THE CORPUS HOLDS** (I1).
   *
   * The cell was a comma-separated TEXT INPUT until I1: a person had to know a
   * group's exact spelling, and a typo silently created a new unlisted group.
   * Now the item's groups are CHIPS (each removable, an unlisted one marked)
   * and adding one is a select over the registry names the item does not yet
   * carry.
   *
   * ⛓⛓ **AND IT FILLS ON OPEN, MEASURED ON BOTH BUILDS RATHER THAN REASONED
   * ABOUT.** The worst case in the committed corpus is `sc2` slot 1 — 1,741
   * items under an 889-name registry. The same page, with `fill()` called at
   * construction and then reverted:
   *
   *              option elements   Items-tab paint   opening one picker
   *     eager        1,540,414          16,688 ms      0 ms (already built)
   *     lazy             1,741           1,948 ms      7 ms, 877 options
   *
   * 8.6× on the paint and 885× on the elements. ⛑ The element count is NOT the
   * naive `1,741 × (889 + 1) = 1,549,490`: a picker offers only the names its
   * own item does not already carry, so the eager total is
   * `Σᵢ (1 + |registry \ groupsᵢ|)` — which reproduces 1,540,414 exactly, and
   * 3,498 on alttp. (Quoting the product instead of the measurement is
   * trap 1300, from W3's Placements select — the same rule for the same
   * reason, §10.4.)
   *
   * ⛓ ONE `set-item-field groups` per gesture, so one chip removed or one name
   * added is one op and one undo.
   */
  _makeItemGroupsCell(name, item, setField) {
    const carried = Array.isArray(item.groups) ? item.groups : [];
    const registry = itemGroupRegistry(this.rulesDoc, this.playerId);
    const listed = new Set(registry);

    const cell = document.createElement('div');
    cell.className = 'apworld-item-groups-cell';
    cell.dataset.item = name;
    cell.dataset.groups = String(carried.length);
    Object.assign(cell.style, {
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3px',
    });

    for (const groupName of carried) {
      const chip = document.createElement('span');
      chip.className = 'apworld-item-group-chip';
      chip.dataset.group = groupName;
      chip.dataset.listed = String(listed.has(groupName));
      Object.assign(chip.style, {
        display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10px',
        padding: '0 2px 0 4px', borderRadius: '8px',
        border: `1px solid ${listed.has(groupName) ? '#3a5a7a' : '#5a4520'}`,
        color: listed.has(groupName) ? '#cfe' : '#e0a030',
        backgroundColor: '#1a1a1a',
      });
      const text = document.createElement('span');
      text.textContent = groupName;
      chip.appendChild(text);
      chip.title = listed.has(groupName)
        ? `"${groupName}" is in this slot's registry`
        : `"${groupName}" is NOT in this slot's registry — the Groups section above can add it`;
      const off = document.createElement('button');
      off.className = 'apworld-item-group-chip-remove';
      off.textContent = '×';
      Object.assign(off.style, {
        background: 'none', border: 'none', color: '#a88', cursor: 'pointer',
        fontSize: '11px', padding: '0 2px', lineHeight: '1',
      });
      off.title = `Take "${groupName}" off ${name}`;
      off.addEventListener('click', () => setField('groups',
        carried.filter((g) => g !== groupName)));
      chip.appendChild(off);
      cell.appendChild(chip);
    }

    const pick = document.createElement('select');
    pick.className = 'apworld-item-group-picker';
    pick.dataset.item = name;
    Object.assign(pick.style, {
      backgroundColor: '#222', color: '#ddd', border: '1px solid #444',
      borderRadius: '3px', padding: '1px 2px', fontSize: '10px', maxWidth: '100%',
    });
    const option = (value, text) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = text;
      return o;
    };
    const available = () => registry.filter((g) => !carried.includes(g));
    const placeholder = () => option('', available().length ? '+ group…' : '(all listed)');
    pick.appendChild(placeholder());
    // ⛓ The list is built on OPEN — see the docblock's measurement.
    const fill = () => {
      if (pick.dataset.filled === 'true') return;
      pick.dataset.filled = 'true';
      pick.textContent = '';
      pick.appendChild(placeholder());
      for (const g of available()) pick.appendChild(option(g, g));
    };
    pick.addEventListener('focus', fill);
    pick.addEventListener('mousedown', fill);
    pick.addEventListener('change', () => {
      const chosen = pick.value;
      if (!chosen) return;
      setField('groups', [...carried, chosen]);
    });
    pick.disabled = registry.length === 0;
    pick.title = registry.length
      ? 'Add a group from this slot\'s registry'
      : 'This slot\'s registry is empty — add a group in the Groups section above';
    cell.appendChild(pick);
    return cell;
  }

  /* ══════════════════════════════════════════════════════════════════
   * THE PROGRESSION SECTION — `progression_mapping`, the two kinds (I2)
   * ══════════════════════════════════════════════════════════════════ */

  /**
   * ⛓⛓⛓ **ONE CARD PER MAPPING, AND THE CARD IS THE UNIT OF UNDO.**
   *
   * `progression_mapping[p]` is `name → mapping` in two kinds, and the section
   * draws the kind the RUNTIME would read (`mapping.type === 'additive'`, the
   * one question `inventoryManager` asks). Every gesture on a card — a level
   * typed, a member added or removed, the order changed, the kind switched —
   * commits ONE `set-progression-mapping` carrying the WHOLE entry, so one
   * Undo puts the card a person was looking at back rather than one row of it.
   *
   * ⛓⛓ **THE BASE PICKER OFFERS THE SLOT'S MAPPING NAMES, NOT ITS ITEMS**, and
   * that is a measurement rather than a preference: `genericLogic` compares one
   * entry's `base_item` only against ANOTHER entry's, never looking it up in
   * `items`, and over the 212 committed documents `base_item` is a mapping KEY
   * of the same slot in **137 of 137** entries and an item in only 135. The
   * ten that differ are alttp's `Progressive Bow (Alt)` → `Progressive Bow`,
   * which is what the field is FOR: two receivable items pooling into one
   * level count.
   *
   * ⛓ **A STALE MEMBER IS SHOWN, MARKED AND REMOVABLE — never dropped.** 12
   * committed members (smz3's four entries) name resolved forms the slot's
   * `items` does not hold; the op differences its refusal so an entry that
   * arrived with one stays editable, and the mark reads the SAME predicate the
   * refusal does (`progressionMappingIssues`).
   */
  _renderProgressionSection() {
    const mappings = progressionMappings(this.rulesDoc, this.playerId);
    const names = Object.keys(mappings);
    const issues = progressionMappingIssues(this.rulesDoc, this.playerId);

    const wrap = document.createElement('div');
    wrap.className = 'apworld-progressions';
    wrap.dataset.slot = String(this.playerId);
    wrap.dataset.mappings = String(names.length);
    wrap.dataset.issues = String(issues.length);
    Object.assign(wrap.style, {
      border: '1px solid #333', borderRadius: '3px', backgroundColor: '#1f1f1f',
      padding: '6px 8px', margin: '0 0 10px',
    });

    const head = document.createElement('div');
    head.className = 'apworld-progressions-head';
    head.textContent = `Progression — slot ${this.playerId}: ${names.length} mapping`
      + `${names.length === 1 ? '' : 's'}`
      + (issues.length ? `, ${issues.length} naming something this slot does not hold` : '');
    Object.assign(head.style, { color: '#cfe', fontSize: '12px', fontWeight: 'bold',
      marginBottom: '3px' });
    wrap.appendChild(head);

    const intro = document.createElement('div');
    intro.className = 'apworld-progressions-intro';
    Object.assign(intro.style, { color: '#888', fontSize: '11px', lineHeight: '1.4',
      marginBottom: '6px' });
    intro.textContent = `\`${PROGRESSION_MAPPING_KEY}\` maps a name to the items it resolves to, `
      + 'in two kinds. A PROGRESSIVE mapping is read by the rule engine: a level\'s item counts '
      + 'as held once the pooled count of every mapping sharing this one\'s base item reaches '
      + 'that level, and the mapping\'s own name is normally a real item the player receives. An '
      + 'ADDITIVE mapping is read by the inventory: its name is a VIRTUAL counter, a direct add '
      + 'of it is skipped, and each component item adds its value to the counter instead. The '
      + 'base item is the POOL every mapping sharing it counts into — it names a mapping in this '
      + 'slot, not an item.';
    wrap.appendChild(intro);

    if (!names.length) {
      const none = document.createElement('div');
      none.className = 'apworld-progressions-empty';
      none.style.cssText = 'color:#888;font-size:11px;margin-bottom:6px;';
      none.textContent = 'No progression mappings yet. Add one below, then put this slot\'s '
        + 'items in it as levels (progressive) or values (additive).';
      wrap.appendChild(none);
    }

    for (const name of names) wrap.appendChild(this._makeProgressionCard(name, mappings[name]));
    wrap.appendChild(this._makeProgressionAddRow());
    return wrap;
  }

  /**
   * ⛓ ONE `set-progression-mapping` carrying the whole entry — the only way
   * this section writes. An absent `mapping` deletes the entry.
   */
  _commitProgression(name, mapping) {
    return this._applyOp({
      op: 'set-progression-mapping', name, mapping, player: this.playerId,
    });
  }

  /**
   * ⛓⛓ **THE ITEM PICKER, LAZY — I1's measurement, one key over.** The corpus's
   * worst case is `sc2` slot 1 at 1,741 items; a `<select>` filled at
   * construction is open at rest, and I1 measured 1,540,414 option elements
   * and a 16,688 ms Items-tab paint against 1,741 and 1,948 ms for the lazy
   * form. So the list is built on `focus`/`mousedown`.
   *
   * ⛓⛓ And the CURRENT value is always an option, even when the slot does not
   * hold it (W3's rule): a select whose value is not in its list silently
   * re-points the row to something else the moment it is opened, which for a
   * stale member would be the "silently dropped" outcome this section exists
   * to prevent.
   */
  _makeItemPicker(current, { className, placeholder, exclude, onPick }) {
    // ⛓ Names the entry already holds are not offered: `set-progression-mapping`
    //   refuses a duplicate member by shape, and a picker whose every option
    //   ends in an alert is not a picker. ⛔ The OP is still the guard — the
    //   omission is a courtesy (trap 1305), and the in-app refusal row asks
    //   the op rather than the control.
    const skip = exclude ?? new Set();
    const items = Object.keys(this._items()).filter((n) => !skip.has(n));
    const pick = document.createElement('select');
    pick.className = className;
    if (current != null) pick.dataset.item = current;
    Object.assign(pick.style, {
      backgroundColor: '#222', color: '#ddd', border: '1px solid #444',
      borderRadius: '3px', padding: '1px 2px', fontSize: '11px', maxWidth: '100%',
    });
    const option = (value, text) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = text;
      return o;
    };
    const rest = () => (current == null ? items : items.filter((n) => n !== current));
    const first = () => (current == null
      ? option('', items.length ? placeholder : '(no items)')
      : option(current, current));
    pick.appendChild(first());
    const fill = () => {
      if (pick.dataset.filled === 'true') return;
      pick.dataset.filled = 'true';
      pick.textContent = '';
      pick.appendChild(first());
      for (const n of rest()) pick.appendChild(option(n, n));
    };
    pick.addEventListener('focus', fill);
    pick.addEventListener('mousedown', fill);
    pick.addEventListener('change', () => {
      const chosen = pick.value;
      if (!chosen || chosen === current) return;
      onPick(chosen);
    });
    pick.disabled = !items.length;
    return pick;
  }

  /** ⛓ A small number box that commits on `change` — never per keystroke (the
   *  Meta tab's rule), so one level typed is one op and one undo. */
  _makeProgressionNumber(value, { className, title, onCommit }) {
    const input = this._makeTextInput(String(value), '56px');
    input.className = className;
    input.title = title;
    input.addEventListener('change', (e) => {
      const n = parseInt(e.target.value, 10);
      if (!Number.isFinite(n)) { e.target.value = String(value); return; }
      if (n === value) return;
      onCommit(n);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
    return input;
  }

  /**
   * ⛓⛓ One card. ⛔ Every handler rebuilds the WHOLE entry from `mapping` and
   * hands it to `_commitProgression`, so a mutant that wrote only the changed
   * row would take the rest of the card with it — which is what row (b)'s undo
   * condition measures.
   */
  _makeProgressionCard(name, mapping) {
    const kind = progressionKindOf(mapping);
    const additive = kind === PROGRESSION_KINDS.ADDITIVE;
    const stale = new Set(progressionMappingIssues(this.rulesDoc, this.playerId)
      .filter((i) => i.name === name && i.reason === PROGRESSION_ISSUE_REASONS.UNKNOWN_ITEM)
      .map((i) => i.member));
    const members = additive
      ? Object.entries(mapping.items ?? {}).map(([n, v]) => ({ name: n, value: v }))
      : (Array.isArray(mapping.items) ? mapping.items : []);

    const card = document.createElement('div');
    card.className = 'apworld-progression-card';
    card.dataset.mapping = name;
    card.dataset.kind = kind;
    card.dataset.base = String(mapping?.base_item ?? '');
    card.dataset.members = String(members.length);
    card.dataset.stale = String(stale.size);
    Object.assign(card.style, {
      border: '1px solid #2e2e2e', borderRadius: '3px', backgroundColor: '#191919',
      padding: '4px 6px', margin: '0 0 6px',
    });

    /** ⛓ Rebuild the entry's `items` container from a member LIST, in the kind
     *  the card is currently in — the one place the two shapes are written. */
    const rebuilt = (list, asAdditive = additive) => (asAdditive
      ? {
        ...mapping,
        type: ADDITIVE_TYPE,
        items: Object.fromEntries(list.map((m) => [m.name, m.value ?? m.level ?? 1])),
      }
      : (() => {
        const { type: _dropped, ...rest } = mapping ?? {};
        return {
          ...rest,
          items: list.map((m) => (m.value === undefined
            ? m
            : { name: m.name, level: m.value })),
        };
      })());

    /* ── the head: name, kind, base, delete ───────────────────────── */
    const head = document.createElement('div');
    Object.assign(head.style, { display: 'flex', alignItems: 'center', gap: '6px',
      flexWrap: 'wrap' });

    const label = document.createElement('code');
    label.className = 'apworld-progression-name';
    label.textContent = name;
    Object.assign(label.style, { color: '#cfe', fontSize: '12px', fontWeight: 'bold' });
    label.title = additive
      ? `"${name}" is a VIRTUAL counter: the inventory skips a direct add of it and each `
        + 'component below adds its value instead.'
      : `"${name}" is normally a real item this slot holds — the rule engine resolves a level's `
        + 'item once the pooled count reaches that level.';
    head.appendChild(label);

    const kindPick = document.createElement('select');
    kindPick.className = 'apworld-progression-kind';
    Object.assign(kindPick.style, {
      backgroundColor: '#222', color: '#ddd', border: '1px solid #444',
      borderRadius: '3px', padding: '1px 2px', fontSize: '11px',
    });
    for (const k of Object.values(PROGRESSION_KINDS)) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = k;
      if (k === kind) o.selected = true;
      kindPick.appendChild(o);
    }
    kindPick.title = 'progressive: levels the rule engine resolves through the pooled count. '
      + 'additive: a virtual counter the inventory accumulates into.';
    kindPick.addEventListener('change', () => {
      const next = kindPick.value === PROGRESSION_KINDS.ADDITIVE;
      if (next === additive) return;
      // ⛓⛓ An additive member is `name: number` and carries NOTHING else, so a
      //   conversion that would drop a field this editor does not draw
      //   (`provides`, schema-declared and on 13 committed members) says so
      //   first rather than losing it silently.
      const losing = next ? members.filter((m) => m.provides !== undefined) : [];
      if (losing.length && !confirm(`Converting "${name}" to additive drops \`provides\` from `
        + `${losing.length} level${losing.length === 1 ? '' : 's'} `
        + `(${losing.map((m) => m.name).join(', ')}). Continue?`)) {
        kindPick.value = kind;
        return;
      }
      this._commitProgression(name, rebuilt(
        next ? members.map((m) => ({ name: m.name, value: m.level ?? m.value ?? 1 }))
          : members.map((m, i) => ({ name: m.name, level: m.value ?? m.level ?? (i + 1) })),
        next,
      ));
    });
    head.appendChild(kindPick);

    const baseWrap = document.createElement('span');
    baseWrap.style.cssText = 'color:#888;font-size:11px;';
    baseWrap.textContent = 'base ';
    head.appendChild(baseWrap);
    head.appendChild(this._makeProgressionBasePicker(name, mapping));

    const del = this._makeButton('×', '#8a2a2a', () => {
      if (!confirm(`Delete the progression mapping "${name}"?`)) return;
      this._commitProgression(name, undefined);
    });
    del.className = 'apworld-progression-delete';
    del.style.padding = '2px 8px';
    del.style.marginLeft = 'auto';
    del.title = `Remove "${name}" from slot ${this.playerId}'s \`${PROGRESSION_MAPPING_KEY}\``;
    head.appendChild(del);
    card.appendChild(head);

    /* ── the members ──────────────────────────────────────────────── */
    for (const [index, member] of members.entries()) {
      card.appendChild(this._makeProgressionMemberRow({
        name, member, index, members, additive, stale, rebuilt,
      }));
    }

    /* ── add a member ─────────────────────────────────────────────── */
    const addLine = document.createElement('div');
    Object.assign(addLine.style, { display: 'flex', alignItems: 'center', gap: '6px',
      marginTop: '3px', paddingLeft: '14px' });
    const addPick = this._makeItemPicker(null, {
      className: 'apworld-progression-add-member',
      placeholder: additive ? '+ component item…' : '+ level item…',
      exclude: new Set(members.map((m) => m.name)),
      onPick: (chosen) => this._commitProgression(name, rebuilt(additive
        ? [...members, { name: chosen, value: 1 }]
        : [...members, { name: chosen, level: members.length + 1 }])),
    });
    addPick.title = additive
      ? 'Add a component item, at value 1'
      : 'Add a level, numbered after the last one';
    addLine.appendChild(addPick);
    card.appendChild(addLine);
    return card;
  }

  /**
   * ⛓⛓ The base picker — over the slot's MAPPING NAMES (see
   * `_renderProgressionSection`'s docblock), with the entry's own name always
   * offered and the current value kept even when it names nothing, so a
   * dangling base is visible rather than silently re-pointed.
   */
  _makeProgressionBasePicker(name, mapping) {
    const bases = Object.keys(progressionMappings(this.rulesDoc, this.playerId));
    const current = typeof mapping?.base_item === 'string' ? mapping.base_item : '';
    const pick = document.createElement('select');
    pick.className = 'apworld-progression-base';
    pick.dataset.base = current;
    pick.dataset.pooled = String(bases.includes(current));
    Object.assign(pick.style, {
      backgroundColor: '#222', color: bases.includes(current) ? '#ddd' : '#e0a030',
      border: `1px solid ${bases.includes(current) ? '#444' : '#5a4520'}`,
      borderRadius: '3px', padding: '1px 2px', fontSize: '11px', maxWidth: '160px',
    });
    for (const b of [current, ...bases.filter((b) => b !== current)]) {
      const o = document.createElement('option');
      o.value = b;
      o.textContent = b;
      if (b === current) o.selected = true;
      pick.appendChild(o);
    }
    pick.title = bases.includes(current)
      ? `Every mapping whose base is "${current}" pools its inventory count into one level total`
      : `"${current}" is not a mapping in this slot — nothing pools with it`;
    pick.addEventListener('change', () => {
      if (pick.value === current) return;
      this._commitProgression(name, { ...mapping, base_item: pick.value });
    });
    return pick;
  }

  /**
   * ⛓ One member row. ⛓⛓ Reordering swaps ARRAY POSITIONS and leaves each
   * level with its own row: the runtime resolves a member by NAME and reads
   * that member's own `level` (`genericLogic.has`), so the array's order is
   * presentation — renumbering on a move would silently change what the rules
   * resolve.
   */
  _makeProgressionMemberRow({ name, member, index, members, additive, stale, rebuilt }) {
    const isStale = stale.has(member.name);
    const row = document.createElement('div');
    row.className = 'apworld-progression-member';
    row.dataset.item = member.name;
    row.dataset.stale = String(isStale);
    row.dataset.index = String(index);
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '6px', padding: '1px 0 1px 14px',
    });

    const replaceAt = (next) => this._commitProgression(name,
      rebuilt(members.map((m, i) => (i === index ? next : m))));

    row.appendChild(this._makeItemPicker(member.name, {
      className: 'apworld-progression-item',
      placeholder: 'item…',
      exclude: new Set(members.map((m) => m.name).filter((n) => n !== member.name)),
      onPick: (chosen) => replaceAt({ ...member, name: chosen }),
    }));

    if (isStale) {
      const mark = document.createElement('span');
      mark.className = 'apworld-progression-stale';
      mark.textContent = PROGRESSION_ISSUE_REASONS.UNKNOWN_ITEM;
      Object.assign(mark.style, { color: '#e0a030', fontSize: '10px' });
      mark.title = `"${member.name}" is not an item slot ${this.playerId} holds. It is kept `
        + 'and still editable — the rule engine can resolve a name through a mapping even when '
        + 'the item pool has no such item. Remove it with the × if it is a leftover.';
      row.appendChild(mark);
    }

    const value = additive ? member.value : member.level;
    row.appendChild(this._makeProgressionNumber(value, {
      className: additive ? 'apworld-progression-value' : 'apworld-progression-level',
      title: additive
        ? `Each "${member.name}" received adds this much to "${name}"`
        : `"${member.name}" resolves once the pool of "${name}" reaches this level`,
      onCommit: (n) => replaceAt(additive
        ? { ...member, value: n }
        : { ...member, level: n }),
    }));

    if (Array.isArray(member.provides) && member.provides.length) {
      const also = document.createElement('span');
      also.className = 'apworld-progression-provides';
      also.textContent = `also provides ${member.provides.join(', ')}`;
      Object.assign(also.style, { color: '#7a8', fontSize: '10px' });
      also.title = '`provides` is schema-declared and carried through by the op. Nothing in the '
        + 'frontend reads it today, so this section shows it rather than editing it.';
      row.appendChild(also);
    }

    if (!additive) {
      const move = (delta) => {
        const next = members.slice();
        const [taken] = next.splice(index, 1);
        next.splice(index + delta, 0, taken);
        this._commitProgression(name, rebuilt(next));
      };
      const up = this._makeButton('↑', '#3a3a3a', () => move(-1));
      up.className = 'apworld-progression-up';
      up.style.padding = '0 5px';
      up.disabled = index === 0;
      up.title = 'Move this level up — the levels themselves do not renumber';
      row.appendChild(up);
      const down = this._makeButton('↓', '#3a3a3a', () => move(1));
      down.className = 'apworld-progression-down';
      down.style.padding = '0 5px';
      down.disabled = index === members.length - 1;
      down.title = 'Move this level down — the levels themselves do not renumber';
      row.appendChild(down);
    }

    // ⛓⛓ The last member cannot go through this button, because the op refuses
    //   an empty container by shape — deleting the whole card is the gesture,
    //   and the button says so instead of ending in an alert (I1's courtesy
    //   rule; the OP is still the guard).
    const off = this._makeButton('×', members.length > 1 ? '#8a2a2a' : '#3a3a3a',
      () => this._commitProgression(name,
        rebuilt(members.filter((_m, i) => i !== index))));
    off.className = 'apworld-progression-member-remove';
    off.style.padding = '0 6px';
    off.style.marginLeft = 'auto';
    off.disabled = members.length <= 1;
    off.title = members.length > 1
      ? `Take "${member.name}" out of "${name}"`
      : `"${member.name}" is the only entry — a mapping with none is refused, so delete the `
        + 'whole mapping instead';
    row.appendChild(off);
    return row;
  }

  /** ⛓ The add row: a name and a kind. The op refuses an empty name and a
   *  duplicate is simply an overwrite of that entry, so this only reads the
   *  boxes and builds the smallest entry each kind allows — one member, which
   *  the shape rule requires. */
  _makeProgressionAddRow() {
    const line = document.createElement('div');
    line.className = 'apworld-progressions-add';
    Object.assign(line.style, { display: 'flex', alignItems: 'center', gap: '6px',
      marginTop: '6px', flexWrap: 'wrap' });

    const input = this._makeTextInput('', '100%');
    input.className = 'apworld-progression-new';
    input.placeholder = 'new mapping name';
    input.style.flex = '1 1 120px';
    line.appendChild(input);

    const kindPick = document.createElement('select');
    kindPick.className = 'apworld-progression-new-kind';
    Object.assign(kindPick.style, {
      backgroundColor: '#222', color: '#ddd', border: '1px solid #444',
      borderRadius: '3px', padding: '1px 2px', fontSize: '11px',
    });
    for (const k of Object.values(PROGRESSION_KINDS)) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = k;
      kindPick.appendChild(o);
    }
    line.appendChild(kindPick);

    const firstItem = Object.keys(this._items())[0];
    const commit = () => {
      const name = input.value.trim();
      if (!name) return;
      // ⛓ The shape rule wants a non-empty container, so the new entry starts
      //   with the slot's FIRST item at level/value 1 — the picker on the card
      //   is how it becomes the right one. ⛔ A slot with no items cannot make
      //   a legal mapping at all, and the op is what says so.
      const member = firstItem ?? '';
      this._commitProgression(name, kindPick.value === PROGRESSION_KINDS.ADDITIVE
        ? { type: ADDITIVE_TYPE, base_item: name, items: { [member]: 1 } }
        : { base_item: name, items: [{ name: member, level: 1 }] });
      input.value = '';
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
    });
    const btn = this._makeButton('+ Add mapping', '#444', commit);
    btn.className = 'apworld-progressions-add-button';
    btn.title = firstItem
      ? `Creates the mapping with "${firstItem}" at 1 — change it on the card`
      : 'This slot has no items yet, so a mapping cannot name one';
    line.appendChild(btn);
    return line;
  }

  /* ══════════════════════════════════════════════════════════════════
   * THE PLACEMENTS TAB — `canonical_placements`, the --canonical-seed input
   * ══════════════════════════════════════════════════════════════════ */

  /**
   * ⛓ The selected slot's placement map, READ-ONLY (the accessors' standing
   * rule: one that lazily CREATED its container would write through the
   * session's folded record).
   */
  _placements() {
    const block = this.rulesDoc ? this.rulesDoc[PLACEMENTS_TAB_KEY] : undefined;
    const slot = block && typeof block === 'object' && !Array.isArray(block)
      ? block[this.playerId] : undefined;
    return slot && typeof slot === 'object' && !Array.isArray(slot) ? slot : {};
  }

  /**
   * ⛓⛓ **THE TALLY, DERIVED — every number on this tab comes from here.**
   *
   * `total` is the locations the SLOT holds (`locationsOfPlayer`, the same
   * function the op refuses against, so the tab can never offer a row whose
   * every edit would be refused).
   *
   * ⛓⛓⛓ **P1 — AND WHICH ENTRIES ARE STALE IS `canonicalPlacementIssues`,
   * NOT THIS METHOD.** Until P1 the tab carried its own two scans, and they
   * were a second spelling of the op's refusals; they are now one call, so the
   * rows this tab marks are exactly the writes the op declines and exactly the
   * findings `check-canonical-placements.mjs` reports over the corpus.
   *
   * ⛓⛓ **AND A STALE ENTRY IS DEDUCTED FROM `placed`** (W3 §10.7 (3), ⚖ user
   * 2026-09-09). W3 counted an entry naming a missing ITEM as placed, on the
   * grounds that the file says it is placed. It is not: `--canonical-seed`
   * cannot place an item the world does not hold, so the numerator was
   * promising a placement that no generation can make. The stale entries are
   * still named on the same line — the count says how many, the numerator no
   * longer includes them.
   *
   * ⛓ `orphanLocations` are the entries whose LOCATION the slot does not hold
   * (they have no region to sit under, so the tab draws them in their own
   * block) and `orphanItems` are the held locations whose stored VALUE the slot
   * cannot supply — a missing item name, or a value that is not a name at all.
   * Neither is silently dropped; both are drawn, marked and offered a delete.
   */
  _placementTally() {
    const placements = this._placements();
    const locations = locationsOfPlayer(this.rulesDoc, this.playerId);
    const issues = canonicalPlacementIssues(this.rulesDoc, this.playerId);
    const stale = new Set(issues.map((i) => i.location));
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const placed = locations
      .filter((l) => has(placements, l.name) && !stale.has(l.name)).length;
    const reason = (r) => issues.filter((i) => i.reason === r).map((i) => i.location);
    return {
      locations,
      placements,
      issues,
      // ⛓ location → reason, so a ROW does not re-derive staleness a third time.
      staleReason: new Map(issues.map((i) => [i.location, i.reason])),
      placed,
      total: locations.length,
      orphanLocations: reason(PLACEMENT_ISSUE_REASONS.UNKNOWN_LOCATION),
      orphanItems: [
        ...reason(PLACEMENT_ISSUE_REASONS.NON_STRING_VALUE),
        ...reason(PLACEMENT_ISSUE_REASONS.UNKNOWN_ITEM),
      ],
    };
  }

  /**
   * ⛓⛓⛓ **EVERY LOCATION OF THE SLOT, GROUPED BY REGION, IN DOCUMENT ORDER** —
   * because that is the order the generator wrote the world in, and a person
   * reading a generated world reads it that way. ⛔ Not sorted: a sort would be
   * this tab inventing an order the document does not have.
   *
   * ⛓ The whole tab is ONE op per gesture (`set-canonical-placement`), which is
   * the SECOND vocabulary on this key — the Document tab's `set-key` still
   * writes the whole block, and its row points here (W0's rule: the pointer AND
   * the block; the same situation W0's §7.7 (1) names for the six fields the
   * Meta and Document tabs both write).
   *
   * ⛔ **A tab-local edit does NOT publish `ui:activatePanel`.** `_focusAcceptedOp`
   * is for DOORS — an editor ELSEWHERE handing an op back — and raising the
   * panel a person is already typing in would be a readout about nothing.
   */
  _renderPlacementsTab() {
    const tally = this._placementTally();
    const items = Object.keys(this._items());

    const intro = document.createElement('div');
    intro.className = 'apworld-placements-intro';
    Object.assign(intro.style, {
      color: '#888', fontSize: '11px', padding: '2px 0 6px', lineHeight: '1.4',
    });
    intro.textContent = `\`${PLACEMENTS_TAB_KEY}\` for slot ${this.playerId}: which item this `
      + 'world places at which location. It is an INPUT rather than a readout — the world '
      + 'generator reads it as the `--canonical-seed` placement source, so what you set here '
      + 'is what the next Generate.py places. Every location the slot holds has a row, whether '
      + 'or not it is placed; the blank option removes a placement. '
      + '⛔ `is_canonical` is a different key — the exporter\'s stamp — and this tab does not '
      + 'touch it.';
    this.scrollContainer.appendChild(intro);

    const summary = document.createElement('div');
    summary.className = 'apworld-placements-summary';
    summary.dataset.placed = String(tally.placed);
    summary.dataset.total = String(tally.total);
    summary.dataset.orphanLocations = String(tally.orphanLocations.length);
    summary.dataset.orphanItems = String(tally.orphanItems.length);
    Object.assign(summary.style, {
      color: '#cfe', fontSize: '12px', margin: '0 0 6px', padding: '5px 8px',
      border: '1px solid #333', borderRadius: '3px', backgroundColor: '#1f1f1f',
    });
    summary.textContent = `${tally.placed} of ${tally.total} `
      + `location${tally.total === 1 ? '' : 's'} placed`
      + (tally.orphanLocations.length
        ? ` — ${tally.orphanLocations.length} placement`
          + `${tally.orphanLocations.length === 1 ? ' names' : 's name'} a location this `
          + 'document does not hold'
        : '')
      + (tally.orphanItems.length
        ? ` — ${tally.orphanItems.length}`
          + `${tally.orphanItems.length === 1 ? ' names' : ' name'} an item it does not hold`
        : '');
    this.scrollContainer.appendChild(summary);

    if (items.length === 0) {
      const none = document.createElement('div');
      none.style.color = '#e0a030';
      none.style.fontSize = '11px';
      none.textContent = 'This slot has no items, so there is nothing to place. Add items on '
        + 'the Items tab first.';
      this.scrollContainer.appendChild(none);
    }

    this.scrollContainer.appendChild(this._makePlacementFilterBox());

    // ⛓ The stale entries FIRST: they are the ones a person came here to fix,
    //   and they have no region to sit under.
    if (tally.orphanLocations.length) {
      this.scrollContainer.appendChild(this._makeOrphanPlacements(tally.orphanLocations, tally));
    }

    if (tally.total === 0) {
      const none = document.createElement('div');
      none.style.color = '#888';
      none.textContent = 'This slot holds no locations.';
      this.scrollContainer.appendChild(none);
    }

    let group = null;
    let currentRegion = null;
    for (const loc of tally.locations) {
      if (loc.region !== currentRegion) {
        currentRegion = loc.region;
        group = document.createElement('div');
        group.className = 'apworld-placements-region';
        group.dataset.region = currentRegion;
        group.style.margin = '0 0 8px';
        const header = document.createElement('div');
        header.className = 'apworld-placements-region-name';
        header.textContent = currentRegion;
        Object.assign(header.style, {
          color: '#9ab', fontSize: '11px', fontWeight: 'bold', margin: '6px 0 3px',
          borderBottom: '1px solid #333',
        });
        group.appendChild(header);
        this.scrollContainer.appendChild(group);
      }
      group.appendChild(this._makePlacementRow(loc, tally));
    }
    this._applyPlacementFilter();
  }

  /**
   * ⛓ The filter, over location / item / region NAMES — the three things
   * written on a row. Its text lives on the panel rather than in the DOM,
   * because every edit re-renders the whole tab and a filter that reset itself
   * on each placement would make a long world unusable.
   */
  _makePlacementFilterBox() {
    const line = document.createElement('div');
    Object.assign(line.style, { display: 'flex', alignItems: 'center', gap: '6px',
      margin: '0 0 6px' });
    const label = document.createElement('span');
    label.textContent = 'Filter';
    Object.assign(label.style, { color: '#aaa', fontSize: '11px' });
    line.appendChild(label);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'apworld-placements-filter';
    input.placeholder = 'location, item or region name';
    input.value = this._placementFilter ?? '';
    Object.assign(input.style, {
      flex: '1 1 auto', backgroundColor: '#222', color: '#ddd',
      border: '1px solid #444', borderRadius: '3px', padding: '3px 6px', fontSize: '11px',
    });
    // ⛓ `input`, not `change`: filtering is a READ and costs no op, so the
    //   Meta tab's "commit on blur" rule (which is about not making one edit
    //   five undos) does not apply.
    input.addEventListener('input', () => {
      this._placementFilter = input.value;
      this._applyPlacementFilter();
    });
    line.appendChild(input);
    return line;
  }

  /**
   * ⛓ Hide what does not match, INCLUDING a region whose every row is hidden —
   * a header standing over nothing reads as "this region has no locations".
   */
  _applyPlacementFilter() {
    const needle = (this._placementFilter ?? '').trim().toLowerCase();
    const rows = this.scrollContainer.querySelectorAll('.apworld-placements-row');
    for (const row of rows) {
      const hay = `${row.dataset.location ?? ''} ${row.dataset.region ?? ''} `
        + `${row.dataset.item ?? ''}`;
      row.hidden = needle !== '' && !hay.toLowerCase().includes(needle);
    }
    for (const group of this.scrollContainer.querySelectorAll('.apworld-placements-region')) {
      const visible = [...group.querySelectorAll('.apworld-placements-row')]
        .some((r) => !r.hidden);
      group.hidden = !visible;
    }
    const orphans = this.scrollContainer.querySelector('.apworld-placements-orphans');
    if (orphans) {
      orphans.hidden = ![...orphans.querySelectorAll('.apworld-placements-row')]
        .some((r) => !r.hidden);
    }
  }

  /**
   * ⛓⛓⛓ **A PLACEMENT NAMING A LOCATION THIS DOCUMENT NO LONGER HOLDS IS
   * SHOWN, NOT DROPPED.** A hand-edited file (or a world whose regions were
   * edited after the seed was recorded) can carry one, and it is invisible
   * everywhere else in the app — the schema allows it
   * (`additionalProperties: true`) and the generator would simply fail to place
   * it. So it gets a row, marked, with the one gesture that can be offered:
   * remove it. ⛔ Which is why `set-canonical-placement` does not validate a
   * DELETE — see its docblock.
   */
  _makeOrphanPlacements(names, tally) {
    const wrap = document.createElement('div');
    wrap.className = 'apworld-placements-orphans';
    Object.assign(wrap.style, {
      border: '1px solid #5a4520', borderRadius: '3px', backgroundColor: '#2a2216',
      padding: '6px 8px', margin: '0 0 8px',
    });
    const head = document.createElement('div');
    head.className = 'apworld-placements-orphans-head';
    head.textContent = `${names.length} placement`
      + `${names.length === 1 ? ' names' : 's name'} a location this slot does not hold — the `
      + 'generator cannot place them. They are shown here rather than dropped; removing one is '
      + 'the only edit this tab can offer for it.';
    Object.assign(head.style, { color: '#e0a030', fontSize: '11px', marginBottom: '4px',
      lineHeight: '1.35' });
    wrap.appendChild(head);
    for (const name of names) {
      // ⛓ No region: an orphan has none, and a placeholder string there would
      //   be text the filter box could match on.
      const row = this._makePlacementRowShell(name, '', tally.placements[name]);
      row.dataset.orphan = 'location';
      const mark = document.createElement('span');
      mark.className = 'apworld-placements-mark';
      mark.textContent = 'no such location';
      Object.assign(mark.style, { color: '#e0a030', fontSize: '10px' });
      row.appendChild(mark);
      const value = document.createElement('code');
      value.className = 'apworld-placements-orphan-item';
      value.textContent = String(tally.placements[name]);
      Object.assign(value.style, { color: '#ddd', fontSize: '11px' });
      row.appendChild(value);
      const del = this._makeButton('Remove', '#5a3030',
        () => this._applyPlacement(name, ''));
      del.className = 'apworld-placements-delete';
      del.style.fontSize = '11px';
      del.style.marginLeft = 'auto';
      row.appendChild(del);
      wrap.appendChild(row);
    }
    return wrap;
  }

  /** ⛓ The row's chrome — the same shell for a real location and an orphan, so
   *  the filter reads one set of `data-` attributes. */
  _makePlacementRowShell(location, region, item) {
    const row = document.createElement('div');
    row.className = 'apworld-placements-row';
    row.dataset.location = location;
    row.dataset.region = region;
    if (item !== undefined) row.dataset.item = String(item);
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0',
    });
    const name = document.createElement('code');
    name.className = 'apworld-placements-location';
    name.textContent = location;
    Object.assign(name.style, { color: '#cfe', fontSize: '11px', flex: '1 1 40%',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    row.appendChild(name);
    return row;
  }

  /**
   * ⛓ P1 — the row's mark is the TALLY's reason (i.e. the validator's), not a
   * third scan of the item table: `staleReason` holds a location only when
   * `canonicalPlacementIssues` named it, and the words on the mark are the
   * words the gate prints for the same entry.
   */
  _makePlacementRow(loc, tally) {
    const has = Object.prototype.hasOwnProperty.call(tally.placements, loc.name);
    const current = has ? tally.placements[loc.name] : '';
    const row = this._makePlacementRowShell(loc.name, loc.region, has ? current : undefined);
    const staleItem = has ? (tally.staleReason.get(loc.name) ?? null) : null;
    if (staleItem) row.dataset.orphan = 'item';
    row.appendChild(this._makePlacementSelect(loc.name, has ? String(current) : '', !!staleItem));
    if (staleItem) {
      const mark = document.createElement('span');
      mark.className = 'apworld-placements-mark';
      mark.textContent = staleItem;
      Object.assign(mark.style, { color: '#e0a030', fontSize: '10px' });
      row.appendChild(mark);
    }
    return row;
  }

  /**
   * ⛓⛓⛓ **THE OPTION LIST IS BUILT ON FIRST OPEN, AND THAT IS A MEASUREMENT.**
   * Measured over the committed corpus: `dark_souls_3` slot 1 holds 1,194
   * locations and 1,208 items, `depgraph` 712 and 1,356. ⛓ And the eager build
   * was MEASURED rather than reasoned about — the same page, with `fill()`
   * called at construction: **1,443,546 option elements and 13,983 ms to
   * paint**, with the filter at 516 ms. Lazily: **1,194 elements, 178 ms**, one
   * select opening in 8 ms for 1,209 options, filter 8 ms. 79× on the paint.
   * So a closed select carries only what it has to show (the blank option and,
   * if placed, the current value) and fills itself on `focus`/`mousedown`,
   * which is what opening it IS.
   *
   * ⛔ Uniformly lazy, with no size threshold. A "fill eagerly when the document
   * is small" branch would mean the path every committed preset in the in-app
   * roster exercises is not the path the big worlds take.
   *
   * ⛓ An item the document no longer holds keeps an option of its own, marked,
   * so opening the select does not silently re-point the row at something else.
   */
  _makePlacementSelect(location, current, unknownItem) {
    const select = document.createElement('select');
    select.className = 'apworld-placements-select';
    select.dataset.location = location;
    Object.assign(select.style, {
      flex: '1 1 40%', backgroundColor: '#222', color: '#ddd', border: '1px solid #444',
      borderRadius: '3px', padding: '2px 4px', fontSize: '11px',
    });
    const option = (value, text) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = text;
      return o;
    };
    const blank = () => option('', '(unplaced)');
    select.appendChild(blank());
    if (current) {
      select.appendChild(option(current,
        unknownItem ? `${current} — not in this document` : current));
    }
    select.value = current;

    const fill = () => {
      if (select.dataset.filled === 'true') return;
      select.dataset.filled = 'true';
      const keep = select.value;
      select.textContent = '';
      select.appendChild(blank());
      if (current && unknownItem) {
        select.appendChild(option(current, `${current} — not in this document`));
      }
      for (const name of Object.keys(this._items())) select.appendChild(option(name, name));
      select.value = keep;
    };
    select.addEventListener('focus', fill);
    select.addEventListener('mousedown', fill);
    /**
     * ⛓ `change`, not `input`: one gesture, one op, one undo — the Meta tab's
     * rule. A `<select>` fires `change` once when the choice is made.
     */
    select.addEventListener('change', () => this._applyPlacement(location, select.value));
    return select;
  }

  /**
   * ⛓ ONE `set-canonical-placement` per gesture. ⛔ No schema preview here,
   * unlike `_applySetKey`: the slot is `additionalProperties: true`, so the
   * schema accepts every string the select can produce and a preview would be a
   * veto that can never fire. The guard is the op's own refusal, against the
   * document's regions and items — which is the check the schema cannot make.
   */
  _applyPlacement(location, item) {
    this._applyOp({
      op: 'set-canonical-placement',
      location,
      item,
      player: this.playerId,
    });
  }

  // ---------- Meta tab ----------

  /**
   * ⛓⛓ EVERY ROW NAMES A `META_FIELDS` KEY, and the op looks the PATH up in
   * that same table (trap 823's cure): a new metadata row is one table entry
   * rather than a ninth branch in the op, and `rulesDocOps.test.js` scans this
   * file for the keys it hands `set-meta` and asserts the two sets are EQUAL.
   */
  _renderMetaTab() {
    const doc = this.rulesDoc;
    const num = (v) => {
      const n = parseInt(v, 10);
      // ⚠ `undefined` DELETES the key. The old closure assigned `undefined`,
      //   which `JSON.stringify` then dropped — so the published bytes were
      //   always those of a delete and the op does what the bytes did.
      return Number.isFinite(n) ? n : undefined;
    };

    this.scrollContainer.appendChild(this._makeSectionHeader('Game'));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Game name', 'game_name', doc.game_name || '',
    ));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Game directory', 'game_directory', doc.game_directory || '', {
        description: 'Folder name for the generated APWorld (e.g. "robotkitty")',
      },
    ));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'World class name', 'world_class_name',
      (doc.world && doc.world[this.playerId] && doc.world[this.playerId].world_class_name) || '', {
        description: 'Python class name for the generated World (e.g. "RobotKittyWorld")',
      },
    ));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Archipelago version', 'archipelago_version', doc.archipelago_version || '',
    ));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Schema version', 'schema_version',
      doc.schema_version == null ? '' : String(doc.schema_version), {
        parse: num,
        description: 'rules.json schema version the exporter targets',
      },
    ));

    this.scrollContainer.appendChild(this._makeSectionHeader('Generation'));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Seed', 'generation_seed',
      doc.generation_seed == null ? '' : String(doc.generation_seed), { parse: num },
    ));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Seed name', 'seed_name', doc.seed_name || '',
    ));

    this.scrollContainer.appendChild(this._makeSectionHeader('Player 1'));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Player name', 'player_name',
      (doc.player_names && doc.player_names[this.playerId]) || '',
    ));
    this.scrollContainer.appendChild(this._makeStartRegionRow());

    this.scrollContainer.appendChild(this._makeSectionHeader('Victory condition'));
    this.scrollContainer.appendChild(this._makeCompletionConditionEditor());
  }

  /* ══════════════════════════════════════════════════════════════════
   * THE DOCUMENT TAB — every top-level key, derived from the schema
   * ══════════════════════════════════════════════════════════════════ */

  /**
   * ⛓ The rows, from the registry. ⛔ With no schema the registry is empty and
   * EVERY key the document carries falls through to the unknown-key row — which
   * is a degradation that still shows the whole document, rather than a tab
   * that renders nothing because a fetch failed.
   */
  _documentRows() {
    const schema = this._rulesSchema ?? { properties: {} };
    try {
      return documentKeyRows(this.rulesDoc, schema, { player: this.playerId });
    } catch (err) {
      log('warn', `Could not build the document rows: ${err.message}`);
      return [];
    }
  }

  /**
   * ⛓⛓⛓ **S1 — THE SIDECARS TAB'S ROWS ARE THE DOCUMENT TAB'S ROWS.** Same
   * builder, same registry, same order (`documentKeyRows` is in the schema's
   * own order), filtered to the keys `KEYS_OWNED_BY_TAB.sidecars` names.
   *
   * ⛔ **DERIVED, never a second list.** A key typed here would be a second
   * membership table that agrees with the first until somebody edits one of
   * them — and the table in `documentKeys.js` is the one that carries the
   * AUTHORITY (the worldgen round trip's own files for two of the five, a ⚖ for
   * the other three). Filtering the registry rows also means a key that stopped
   * being a schema key simply stops having a row, rather than drawing an empty
   * one about a key nothing produces.
   */
  _sidecarRows() {
    const wanted = new Set(KEYS_OWNED_BY_TAB.sidecars);
    return this._documentRows().filter((row) => wanted.has(row.key));
  }

  /**
   * ⛓⛓⛓ **S1 — ONE RENDERER, TWO HOSTS** (⚖ user, 2026-09-08: *"a 'Sidecars'
   * tab, for the data that's specifically in the sidecars"*). Every row here is
   * built by `_renderDocumentRow` — the doors, the `returns` line, the
   * loop-cost table, W0's JSON block — because a second row renderer for the
   * same five keys is a second vocabulary for one document, and the two would
   * agree only until one of them was changed.
   *
   * ⛓ `preset_sidecars` is not one of those rows: it is a per-REGION key, so
   * it is drawn per region — S0's expandable list for the selected slot, above
   * the rows, through the same `_makeRegionSidecarBlock` the Regions tab draws
   * under each region (⚖ user, 2026-09-10, Q2 A).
   */
  _renderSidecarsTab() {
    const rows = this._sidecarRows();
    const withDoors = rows.filter((r) => r.editor).map((r) => r.key);
    const rawOnly = rows.filter((r) => !r.editor).map((r) => r.key);

    const intro = document.createElement('div');
    intro.className = 'apworld-sidecars-intro';
    Object.assign(intro.style, { color: '#888', fontSize: '11px', padding: '2px 0 6px',
      lineHeight: '1.4' });
    intro.textContent = 'The data that travels BESIDE a world rather than inside its regions. '
      + `${rows.length} key${rows.length === 1 ? '' : 's'}: the worldgen round trip writes `
      + '`_worldgen_procgen_metadata.json` and `_worldgen_loop_costs.json` beside a generated '
      + 'world and the exporter merges them back in; `region_atlas`, `flash_panel` and '
      + '`provenance` are here by a ⚖ of 2026-09-08, for now. '
      + (withDoors.length
        ? `The door${withDoors.length === 1 ? '' : 's'} here (${withDoors.join(', ')}) `
          + `open${withDoors.length === 1 ? 's' : ''} on the WORKING COPY — what you are `
          + 'editing, not the world the app has loaded — and a save comes back as one '
          + 'undoable op. '
        : '')
      + (rawOnly.length
        ? `${rawOnly.join(' and ')} ${rawOnly.length === 1 ? 'has' : 'have'} no dedicated `
          + 'editor: the JSON block on the row is how they are changed. '
        : '')
      + 'These are the same rows the Document tab draws, in the same renderer.';
    this.scrollContainer.appendChild(intro);

    this.scrollContainer.appendChild(this._makePresetSidecarsSummary());

    if (rows.length === 0) {
      const none = document.createElement('div');
      none.style.color = '#888';
      none.textContent = 'No sidecar keys are declared.';
      this.scrollContainer.appendChild(none);
      return;
    }
    for (const row of rows) {
      this.scrollContainer.appendChild(this._renderDocumentRow(row, SIDECARS_TAB_ID));
    }
  }

  /**
   * ⛓⛓⛓ **S0 — `preset_sidecars`, PER REGION, FOR THE SELECTED SLOT** (⚖ user,
   * 2026-09-10: *"I want the region list in the sidecars tab to be expandable,
   * and collapsed by default."*). The collapsed line is the summary it always
   * was — per-slot counts — plus the expander; expanded, one row per region of
   * the SELECTED slot: its name, the SAME `_makeRegionSidecarBlock` the Regions
   * tab draws under that region, and **Go to region**, which lands on the
   * Regions tab with that region selected and scrolled into view
   * (`selectRegion`, the Map tab's and the bounce editor's focus helper — one
   * helper, three callers). The old **Go to Regions** (the TAB) is gone: it
   * pointed at a tab that drew none of this data (the user's own complaint,
   * 2026-09-09).
   *
   * ⛔ Counts are DERIVED per slot rather than summed: H0's ⚖ 3 measured that
   * every populated `preset_sidecars` keys under slot "1", four-player
   * documents included, so a single total would read as "this world has n" on a
   * document where three of the four slots have nothing.
   *
   * ⛔ Expanding builds N blocks and NO JSON: each block's textarea is built on
   * its own expand (W0's rule), so a 250-region Seedling slot pays for badges.
   */
  _makePresetSidecarsSummary() {
    const box = document.createElement('div');
    box.className = 'apworld-sidecars-summary';
    box.dataset.docKey = SIDECARS_TAB_SUMMARY_KEY;
    Object.assign(box.style, {
      border: '1px solid #333', borderRadius: '3px', margin: '0 0 6px', padding: '6px 8px',
      backgroundColor: '#1f1f1f', color: '#aaa', fontSize: '11px',
    });
    const line = document.createElement('div');
    Object.assign(line.style, {
      display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
    });
    box.appendChild(line);
    const name = document.createElement('code');
    name.textContent = SIDECARS_TAB_SUMMARY_KEY;
    Object.assign(name.style, { color: '#cfe', fontWeight: 'bold', fontSize: '12px' });
    line.appendChild(name);

    const block = this.rulesDoc ? this.rulesDoc[SIDECARS_TAB_SUMMARY_KEY] : undefined;
    const slots = block && typeof block === 'object' && !Array.isArray(block)
      ? Object.entries(block).map(([slot, regions]) => [slot,
        regions && typeof regions === 'object' ? Object.keys(regions).length : 0])
      : [];
    const text = document.createElement('span');
    text.className = 'apworld-sidecars-summary-text';
    text.textContent = slots.length === 0
      ? (block === undefined
        ? 'not in this document — the per-region payloads the procgen pipeline emits.'
        : 'present but empty — no slot carries a region payload.')
      : `${slots.map(([slot, n]) => `slot ${slot}: ${n} region${n === 1 ? '' : 's'}`).join(', ')}`
        + ' — one entry per region: its substrate, its facts and its JSON, drawn here for the '
        + 'selected slot and under each region on the Regions tab.';
    line.appendChild(text);

    const player = this.playerId;
    const entries = block && typeof block === 'object' && block[player]
      && typeof block[player] === 'object' ? Object.keys(block[player]) : [];
    const open = this._sidecarListOpen && entries.length > 0;
    const plural = entries.length === 1 ? '' : 's';
    const expand = this._makeButton(
      entries.length === 0
        ? `slot ${player} carries none`
        : (open ? `▾ Hide slot ${player}'s region${plural}`
          : `▸ Show slot ${player}'s ${entries.length} region${plural}`),
      '#3a3a3a',
      () => { this._sidecarListOpen = !this._sidecarListOpen; this._render(); });
    expand.className = 'apworld-sidecars-expand';
    expand.dataset.open = open ? 'true' : 'false';
    expand.style.fontSize = '11px';
    expand.style.marginLeft = 'auto';
    expand.disabled = entries.length === 0;
    line.appendChild(expand);
    if (!open) return box;

    const list = document.createElement('div');
    list.className = 'apworld-sidecars-region-list';
    Object.assign(list.style, { marginTop: '6px', borderTop: '1px solid #333' });
    const regenNote = DOCUMENT_KEY_EDITORS.procgen_metadata?.regionDoor;
    if (regenNote) {
      const note = document.createElement('div');
      note.textContent = `${regenNote.label} — ${regenNote.note}`;
      Object.assign(note.style, { color: '#777', fontSize: '10px', padding: '4px 0',
        lineHeight: '1.35' });
      list.appendChild(note);
    }
    for (const regionName of entries) {
      const row = document.createElement('div');
      row.className = 'apworld-sidecars-region-row';
      row.dataset.regionName = regionName;
      Object.assign(row.style, { border: '1px solid #2c2c2c', borderRadius: '3px',
        margin: '4px 0 0', backgroundColor: '#1c1c1c' });
      const head = document.createElement('div');
      Object.assign(head.style, { display: 'flex', alignItems: 'center', gap: '8px',
        padding: '4px 8px' });
      const label = document.createElement('code');
      label.textContent = regionName;
      Object.assign(label.style, { color: '#ddd', fontSize: '12px' });
      head.appendChild(label);
      // ⛓ V0 — the region's sidecar-issue count, beside its name, when there is one.
      const regionIssues = this._sidecarIssuesOf(regionName);
      if (regionIssues.length) {
        const errors = regionIssues.some((i) => i.severity === 'error');
        const badge = document.createElement('span');
        badge.className = 'apworld-sidecars-issue-badge';
        badge.dataset.count = String(regionIssues.length);
        badge.textContent = `${errors ? '⛔' : '⚠'} ${regionIssues.length}`;
        badge.title = `${regionIssues.length} sidecar issue${regionIssues.length === 1 ? '' : 's'} `
          + '— listed in the block below';
        Object.assign(badge.style, {
          padding: '0 6px', borderRadius: '8px', fontSize: '10px',
          color: errors ? '#e8a095' : '#d6a030',
          border: `1px solid ${errors ? '#6a2e2e' : '#6a5a2e'}`,
        });
        head.appendChild(badge);
      }
      const go = this._makeButton('Go to region', '#3a3a3a',
        () => this.selectRegion(regionName, 'the Sidecars tab'));
      go.className = 'apworld-sidecars-go-region';
      go.dataset.regionName = regionName;
      go.style.fontSize = '11px';
      go.style.marginLeft = 'auto';
      head.appendChild(go);
      row.appendChild(head);
      const sidecar = this._makeRegionSidecarBlock(player, regionName, {
        hostTab: SIDECARS_TAB_ID,
        onSave: (entry) => this._saveRegionSidecar(player, regionName, entry),
      });
      if (sidecar) row.appendChild(sidecar);
      list.appendChild(row);
    }
    box.appendChild(list);
    return box;
  }

  _renderDocumentTab() {
    const schema = this._rulesSchema;
    const rows = this._documentRows();
    const declared = schema ? buildDocumentKeys(schema).length : 0;

    const intro = document.createElement('div');
    Object.assign(intro.style, { color: '#888', fontSize: '11px', padding: '2px 0 6px' });
    intro.textContent = schema
      ? `Every top-level key of this rules.json. ${declared} are declared in `
        + `rules.schema.json; ${rows.length - declared} more are in this document and not in `
        + 'the schema. Per-player keys show the selected slot.'
      : 'The rules schema has not loaded, so every key below is shown raw.';
    this.scrollContainer.appendChild(intro);

    if (this._schemaError) {
      const warn = document.createElement('div');
      Object.assign(warn.style, {
        color: '#e0a030', fontSize: '11px', padding: '4px 6px', marginBottom: '6px',
        border: '1px solid #5a4520', backgroundColor: '#2a2216', borderRadius: '3px',
      });
      warn.textContent = `⚠ Could not load ${this._schemaError} — the key registry is DERIVED `
        + 'from that file, so without it there are no labels, no producers and no per-player '
        + 'slicing. Every key is drawn as raw JSON instead.';
      this.scrollContainer.appendChild(warn);
    }

    if (rows.length === 0) {
      const none = document.createElement('div');
      none.style.color = '#888';
      none.textContent = 'This document has no top-level keys.';
      this.scrollContainer.appendChild(none);
      return;
    }
    for (const row of rows) {
      this.scrollContainer.appendChild(this._renderDocumentRow(row, DOCUMENT_TAB_ID));
    }
  }

  /**
   * ⛓ ONE key: what it is, who writes it, what it holds, and how to change it.
   *
   * ⛓⛓⛓ **R1 — AND IT KNOWS WHICH TAB IS DRAWING IT** (⚖ user, 2026-09-09:
   * *"The sidecar entries in the sidecars tab have the 'Go to Sidecars'
   * button. Is there a simple way to fix that?"*). S1 gave the Sidecars tab
   * the Document tab's renderer, and the pointer came with it — so all five
   * sidecar rows drew *"Edited in the Sidecars tab"* and a **Go to Sidecars**
   * button while the reader was standing on that tab.
   *
   * ⛔ THE HOST IS A PARAMETER, not `this.activeTab`. Both are the same value
   * today (a tab body only renders when it is the active tab), but reading the
   * panel's mode inside a row renderer makes the row's content depend on
   * something no caller declared — and the next host (a preview, a dialog, a
   * second pane) would inherit whichever tab happened to be selected. Each
   * host names itself, once, at its own call site.
   *
   * ⚠ The default is `null` = *"no host"*, which draws every pointer — the
   * pre-R1 behaviour. It is deliberately not fail-closed: a pointer that is
   * merely redundant is a smaller defect than a key whose home tab a reader
   * cannot find, so an unnamed host errs towards saying too much.
   *
   * @param {object} row a `documentKeyRows` entry
   * @param {string|null} [hostTab] the id of the TAB drawing this row; a
   *   pointer naming that same tab is skipped.
   */
  _renderDocumentRow(row, hostTab = null) {
    const box = document.createElement('div');
    box.className = 'apworld-doc-row';
    box.dataset.docKey = row.key;
    Object.assign(box.style, {
      border: '1px solid #333', borderRadius: '3px', margin: '0 0 6px',
      padding: '6px 8px', backgroundColor: row.unknown ? '#241f19' : '#1f1f1f',
    });

    const head = document.createElement('div');
    Object.assign(head.style, { display: 'flex', alignItems: 'baseline', gap: '8px' });
    const name = document.createElement('code');
    name.textContent = row.key;
    Object.assign(name.style, { color: '#cfe', fontWeight: 'bold', fontSize: '12px' });
    head.appendChild(name);
    for (const [text, colour] of [
      [row.perPlayer ? `player ${row.player}` : null, '#7a9'],
      [row.required ? 'required' : null, '#9a7'],
      [row.type, '#888'],
      [row.unknown ? 'NOT in the schema' : null, '#e0a030'],
    ]) {
      if (!text) continue;
      const badge = document.createElement('span');
      badge.textContent = text;
      Object.assign(badge.style, { color: colour, fontSize: '10px' });
      head.appendChild(badge);
    }
    const summary = document.createElement('span');
    summary.className = 'apworld-doc-summary';
    summary.textContent = row.summary.inline;
    Object.assign(summary.style, { color: '#aaa', fontSize: '11px', marginLeft: 'auto' });
    head.appendChild(summary);
    box.appendChild(head);

    if (row.description) {
      const desc = document.createElement('div');
      desc.textContent = row.description;
      Object.assign(desc.style, {
        color: '#777', fontSize: '10px', margin: '3px 0 0', lineHeight: '1.35',
      });
      box.appendChild(desc);
    }

    /**
     * ⛓⛓⛓ **W0 — THE POINTER STAYS AND THE BLOCK COMES BACK.** Until W0 an
     * owned row drew the *"edited in the X tab"* line and RETURNED, which made
     * the Document tab an "every KEY" tab rather than the "every ELEMENT" one
     * ⚖ asked for: the Meta tab edits ONE field of `world` and ONE of
     * `game_info`, so the other fourteen sub-keys of `world` were reachable
     * only through the whole-document Raw JSON editor. The home tab is still
     * the place that KNOWS the shape (a region map is not a JSON blob to its
     * own editor) — hence the pointer, first and unchanged — and the block
     * below it is the fallback for everything that tab does not express.
     *
     * ⛔ It is the SAME affordance every other row gets, applied to all
     * fourteen owned keys uniformly, rather than a hand list of "the ones the
     * tabs only partially cover": such a list is a second table that agrees
     * with the tabs until the day a tab stops editing a field, and nobody
     * would red. The textarea is built ON EXPAND (`_makeDocumentBlockEditor`),
     * so a 600 KB `regions` costs nothing until somebody opens it.
     */
    // ⛓ R1 — …unless the tab that owns it is the tab drawing it (see the
    //   docblock): a row cannot usefully point at the tab it is on.
    if (row.ownedByTab && row.ownedByTab !== hostTab) {
      box.appendChild(this._makeOwnedByTabLine(row));
    }
    // ⛓ H5 — the DEDICATED editor's door, above the raw JSON rather than
    //   instead of it: the block is still data and the block editor is still
    //   the way to fix a value the dedicated editor cannot express.
    if (row.editor) box.appendChild(this._makeDocumentEditorLine(row));
    if (row.key === 'loop_costs') box.appendChild(this._makeLoopCostsTable(row));
    box.appendChild(this._makeDocumentValueEditor(row));
    /**
     * ⛓⛓ S1 — **AND THE ANSWER LANDS WHERE THE PERSON IS LOOKING.** An op a
     * linked editor handed back scrolls this row into view, so the sentence
     * saying what happened is printed here as well as in the chrome — ⚖ user
     * 2026-09-08: *"a message that the data was successfully loaded"*. Drawn
     * from the same state the scroll targets, so a row that carries the message
     * is a row the hub really did focus.
     */
    if (this._opRowMessage && this._opRowMessage.key === row.key) {
      const msg = document.createElement('div');
      msg.className = 'apworld-doc-op-message';
      msg.textContent = this._opRowMessage.text;
      Object.assign(msg.style, {
        color: '#8fd18f', fontSize: '11px', margin: '5px 0 0', padding: '3px 6px',
        border: '1px solid #2e5f2e', borderRadius: '3px', backgroundColor: '#182218',
      });
      box.appendChild(msg);
    }
    return box;
  }

  /**
   * ⛓⛓⛓ **THE LINKED EDITOR'S DOOR** (H5). One button, the registry's own
   * label — the same string the Links tab shows for the same key, because both
   * read `DOCUMENT_KEY_EDITORS[key].label`.
   *
   * ⛓ **`returns` IS PRINTED, and it is the question a person actually has**:
   * *"if I save over there, does it come back here as an undo step?"* Three
   * answers, spelled by `EDITOR_RETURN_KINDS` so nothing invents a fourth.
   */
  /**
   * ⛓ Why this door cannot be pressed, or null when it can. ⛔ It names the
   * CONFIG FILE, because "not loaded" is a thing a person can fix in one line
   * and a bare "nothing happened" is not.
   */
  _panelRefusal(panelId) {
    if (!panelId) return null;
    try {
      if (centralRegistry.getAllPanelComponents().has(panelId)) return null;
    } catch (err) {
      log('warn', `Could not ask the registry about ${panelId}: ${err.message}`);
      return null;
    }
    return `\`${panelId}\` is not loaded in this app — its module is disabled in `
      + '`frontend/module-configs/modules.json` for this mode. (The region marking tool '
      + 'is enabled under `?mode=flash`.)';
  }

  _makeDocumentEditorLine(row) {
    const line = document.createElement('div');
    line.className = 'apworld-doc-editor';
    Object.assign(line.style, {
      display: 'flex', alignItems: 'center', gap: '8px', margin: '5px 0 0',
      flexWrap: 'wrap',
    });
    const refusal = this._panelRefusal(row.editor.panelId);
    const btn = this._makeButton(row.editor.label, refusal ? '#444' : '#2e5f8a',
      () => this._openDocumentKeyEditor(row.key));
    btn.className = 'apworld-doc-editor-open';
    btn.dataset.docKey = row.key;
    // ⛓ SHOWN, DISABLED, with the reason in the title — H4c's claim-12 shape.
    //   Hiding it would make "this app does not carry that editor" and "this
    //   block has no editor at all" look identical.
    btn.disabled = !!refusal;
    btn.style.opacity = refusal ? '0.45' : '1';
    if (refusal) btn.title = refusal;
    line.appendChild(btn);

    const returns = document.createElement('span');
    returns.className = 'apworld-doc-editor-returns';
    returns.textContent = `returns: ${row.editor.returns} — `
      + `${EDITOR_RETURN_KINDS[row.editor.returns] ?? 'unknown return kind'}`;
    Object.assign(returns.style, { color: '#8a8', fontSize: '10px' });
    line.appendChild(returns);

    const note = document.createElement('div');
    note.textContent = row.editor.note;
    Object.assign(note.style, {
      color: '#777', fontSize: '10px', lineHeight: '1.35', flexBasis: '100%',
    });
    line.appendChild(note);
    return line;
  }

  /**
   * ⛓⛓ **THE PER-REGION COST TABLE** (H5), beside the raw JSON rather than
   * instead of it — `loop_costs` is small (12 presets carry it) and its shape
   * is two flat maps plus two defaults, which reads far better as rows.
   *
   * ⛔ **AND IT SAYS "NONE" OUT LOUD**, because that is what the corpus holds:
   * MEASURED at this tree, all twelve committed `loop_costs` blocks have
   * `regions: {}` and `locations: {}` and carry only the two defaults. A table
   * that rendered nothing for them would look like a rendering bug rather than
   * a true statement about the document.
   */
  _makeLoopCostsTable(row) {
    const wrap = document.createElement('div');
    wrap.className = 'apworld-loop-costs';
    Object.assign(wrap.style, { margin: '5px 0 0', fontSize: '11px' });
    const block = row.value && typeof row.value === 'object' ? row.value : {};
    const regions = block.regions && typeof block.regions === 'object' ? block.regions : {};
    const locations = block.locations && typeof block.locations === 'object'
      ? block.locations : {};
    const priced = Object.keys(regions).length;
    const worldRegions = Object.keys(this._regions()).length;

    const head = document.createElement('div');
    head.className = 'apworld-loop-costs-summary';
    head.textContent = `${priced} of ${worldRegions} region`
      + `${worldRegions === 1 ? '' : 's'} priced · ${Object.keys(locations).length} location`
      + `${Object.keys(locations).length === 1 ? '' : 's'} priced · default region cost `
      + `${block.defaultRegionCost ?? '(unset)'} · default location cost `
      + `${block.defaultLocationCost ?? '(unset)'}`;
    Object.assign(head.style, { color: '#9ab' });
    wrap.appendChild(head);

    /**
     * ⛓⛓ **⚖ (f) — THE PRESENCE OF THIS BLOCK IS THE LOOP-MODE SWITCH**, and
     * nothing else on the Document tab says so. `loops/index.js`'s
     * `handleRulesLoaded` turns loop mode on when `costDataManager.isLoaded()`
     * — i.e. when the block is non-null — so a document that gains one gains
     * loop mode, and deleting the block is how a world loses it. ⛔ Said on the
     * ROW rather than only in the door's note: a person editing the raw JSON
     * beside it never presses the door at all.
     */
    const switchLine = document.createElement('div');
    switchLine.className = 'apworld-loop-costs-switch';
    switchLine.textContent = row.present
      ? 'This block\'s presence enables loop mode for the world — a '
        + 'document that carries one boots with loop mode ON, even when it prices nothing.'
      : 'This document carries NO `loop_costs` block, so loop mode is OFF for the world. '
        + 'A block\'s presence is the switch — even one that prices nothing.';
    Object.assign(switchLine.style, { color: '#8a8', fontSize: '10px', marginTop: '2px' });
    wrap.appendChild(switchLine);
    wrap.appendChild(this._makeLoopModeSwitchButton(row));

    if (priced === 0) {
      const none = document.createElement('div');
      none.className = 'apworld-loop-costs-none';
      none.textContent = 'No region carries a cost, so every region falls back to the default. '
        + '(Every committed preset that carries this block is in the same state — the cost '
        + 'debugger is what fills it in.)';
      Object.assign(none.style, { color: '#777', fontSize: '10px', marginTop: '2px' });
      wrap.appendChild(none);
      return wrap;
    }

    const table = document.createElement('table');
    table.className = 'apworld-loop-costs-table';
    Object.assign(table.style, { borderCollapse: 'collapse', marginTop: '4px', width: '100%' });
    for (const [name, data] of Object.entries(regions)) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.textContent = name;
      Object.assign(td.style, { color: '#cfe', padding: '1px 6px 1px 0' });
      const cost = document.createElement('td');
      cost.textContent = data && typeof data === 'object'
        ? String(data.moveCost ?? '') : String(data);
      Object.assign(cost.style, { color: '#aaa', textAlign: 'right' });
      tr.append(td, cost);
      table.appendChild(tr);
    }
    wrap.appendChild(table);
    return wrap;
  }

  /**
   * ⛓⛓⛓ **THE PRESENCE SWITCH AS AN EDITOR ACTION** (R-a, residue 3; ⚖ user
   * 2026-09-06 — L4 named it as *"the smallest next thing this door could
   * gain"* and left it unbuilt).
   *
   * ⛓ ONE `set-key loop_costs` either way, through `_applySetKey` — so it gets
   * the schema veto, the undo step and the status line every other Document-tab
   * edit gets, and it cannot disagree with them about what a valid block is.
   * Removing is the SAME op with `undefined` as the value: `opSetKey` routes that
   * to `setPath`'s delete arm (`rulesDocOps.js:199`) and describes it as
   * *"loop_costs deleted"*, so there is no second op and no second spelling.
   *
   * ⛔ **AND IT IS UNDOABLE IN BOTH DIRECTIONS, WHICH IS WHY THE OP MATTERS.**
   * Undo re-folds over a shorter list, so it reproduces the document's previous
   * state EXACTLY — "no key at all" and "an empty block" are different states
   * and the fold tells them apart. A gesture that mutated `rulesDoc` in place
   * would collapse them.
   *
   * ⚠ **THE APPLY CONSEQUENCE IS IN THE TITLE, NOT IN A GATE** (⚖: presence =
   * loop mode on, unchanged). Applying a document that has just gained a block
   * turns loop mode on for the world at runtime. That is the ruled semantics, so
   * the button SAYS it and does not ask.
   */
  _makeLoopModeSwitchButton(row) {
    const line = document.createElement('div');
    line.className = 'apworld-loop-costs-switch-action';
    Object.assign(line.style, { margin: '4px 0 0' });
    const enabling = !row.present;
    const btn = this._makeButton(
      enabling
        ? 'Enable loop mode (adds an empty `loop_costs` block)'
        : 'Disable loop mode (removes the block)',
      enabling ? '#2e5f8a' : '#8a2a2a',
      () => this._applySetKey(row, enabling ? emptyLoopCostsBlock() : undefined),
    );
    btn.className = 'apworld-loop-costs-switch-btn';
    btn.dataset.switchTo = enabling ? 'on' : 'off';
    btn.style.fontSize = '11px';
    btn.title = enabling
      ? 'Writes the four keys the schema requires — regions {}, locations {}, and the '
        + `exported defaults (region ${DEFAULT_REGION_COST}, location ${DEFAULT_LOCATION_COST}). `
        + 'Nothing is priced yet; the loops cost debugger fills it in. ⚠ Applying this '
        + 'document afterwards turns loop mode ON for the world at runtime.'
      : 'Deletes the whole block as one undoable edit — every price in it goes with it. '
        + '⚠ Applying this document afterwards leaves loop mode OFF for the world.';
    line.appendChild(btn);
    return line;
  }

  /**
   * ⛓⛓⛓ **ONE OPENER FOR BOTH TABS** (H5). The Document row's button and the
   * Links tab's row both land here, so the door cannot behave differently
   * depending on which tab a person pressed it from.
   *
   * ⛔ **`onSave` WRAPS THE EDITOR'S ANSWER IN THE SESSION'S OWN
   * `_acceptEditorOp`**, which is where the schema veto, the slot stamp and the
   * undo step live — an editor handing back an op that bypassed them would be
   * an edit the hub could neither refuse nor undo. ⚠ H5 wrote *"`_applyOp`"*
   * here and named the veto as one of the three things it does; L4 measured
   * that the veto was in `_applySetKey` alone, so it is `_acceptEditorOp` that
   * runs it now and this sentence names that method.
   *
   * ⛓⛓⛓ **R-a — AND THE `onSave` IT BUILDS IS BOUND TO THIS DOCUMENT.** The
   * `_documentToken` is read here, once, and captured in the closure; a door
   * never sees it and therefore cannot forget it. That is why both
   * `region_atlas` and `loop_costs` gained the guard WITHOUT being changed —
   * one opener, one binding, both tabs.
   *
   * @param {string} key
   * @param {{withDocument?: boolean}} [opts] `false` from the Links tab, whose
   *   whole purpose is opening an editor with nothing (⚖ user).
   */
  _openDocumentKeyEditor(key, { withDocument = true } = {}) {
    const editor = DOCUMENT_KEY_EDITORS[key];
    if (!editor) {
      this._opMessage = `No dedicated editor is registered for \`${key}\`.`;
      this._renderChrome();
      return;
    }
    const refusal = this._panelRefusal(editor.panelId);
    if (refusal) {
      this._opMessage = `${editor.label}: ${refusal}`;
      this._renderChrome();
      return;
    }
    const rows = withDocument ? this._documentRows() : [];
    const row = rows.find((r) => r.key === key) ?? null;
    // ⛓ R-a — read ONCE, before the door opens: the editor's save may fire long
    //   after `open()` returned, and this is the document it was opened on.
    const token = this._documentToken;
    let context;
    try {
      context = {
        record: withDocument ? this.rulesDoc : null,
        player: this.playerId,
        key,
        value: row ? row.value : undefined,
        eventBus: this.eventBus,
        goToTab: (tab) => this._selectTab(tab),
        /**
         * ⛓⛓ R-a — **BOUND TO THE DOCUMENT IT WAS MADE FOR.** The token is
         * captured HERE, in the one opener both tabs go through, so no door can
         * forget it and no door has to remember it: a door receives `onSave`
         * and never sees the token at all.
         */
        onSave: (op) => this._acceptEditorOp(key, op, token),
      };
      const result = editor.open(context);
      if (result && typeof result.catch === 'function') {
        result.catch((err) => {
          log('error', `${key}: the editor door threw`, err);
          this._opMessage = `${editor.label}: ${err.message}`;
          this._renderChrome();
        });
      }
    } catch (err) {
      log('error', `${key}: the editor door threw`, err);
      this._opMessage = `${editor.label}: ${err.message}`;
      this._renderChrome();
      return;
    }
    this._opMessage = `${editor.label}${withDocument ? '' : ' (with no document)'}. `
      + `${EDITOR_RETURN_KINDS[editor.returns] ?? ''}`;
    this._renderChrome();
  }

  /**
   * ⛓ An op handed back by a linked editor. ⛔ It goes through `_applyOp` like
   * any other, and a door declared `returns: 'none'` handing one back is a
   * DEFECT in that door — said out loud rather than silently applied.
   *
   * ⛔⛔⛔ **L4 — THE SCHEMA VETO IS ON THIS PATH NOW, AND UNTIL L4 IT WAS NOT.**
   * H5's own docs say an `op` door's save is *"applied through the panel's own
   * `_applyOp` (schema veto, slot stamp, undo step)"* and `rulesDocOps`'
   * `set-key` docblock says *"the CALLER (the panel) runs `rulesJsonSchemaErrors`
   * over the candidate and refuses BY PATH before the op is ever built"*.
   * MEASURED at L4's W0: neither was true here. The veto lives in
   * `_applySetKey`, which is the RAW JSON block editor's path; an op arriving
   * from a linked editor reached `_applyOp` — i.e. `applyRulesDocOp`, which
   * reads no schema — untouched. So `region_atlas`'s save has been bypassing
   * the veto since H5 shipped. One call fixes it, and it is the same call the
   * block editor makes, so the two cannot disagree about what the schema
   * refuses.
   *
   * ⛓⛓ **AND IT ANSWERS.** Before L4 this returned `undefined`, so an editor
   * could not tell an applied save from a refused one and had to guess from the
   * hub's log. It returns the outcome now — `{accepted, applied, errors,
   * description}` — which is what lets the cost debugger's Send print what
   * happened instead of claiming success.
   *
   * ⛓⛓⛓ **R-a — AND IT REFUSES AN OP MADE FOR A DOCUMENT THIS HUB NO LONGER
   * HOLDS** (residue 2; ⚖ user 2026-09-06). Until R-a this applied into whatever
   * session was open NOW: hand a document to the cost debugger, load a different
   * preset here, press Send, and the plan landed in the second document with
   * nothing said. The op's `documentToken` is the one `_openDocumentKeyEditor`
   * captured when it opened that door, and a mismatch is refused BY NAME so the
   * person is told what to do about it rather than shown a silent no-op.
   *
   * ⛔ **THE TOKEN IS A REQUIRED ARGUMENT, AND THE CHECK IS FAIL-CLOSED.** A
   * caller that omits it hands `undefined`, which cannot equal a token
   * `_openSession` has made (they start at 1) — so a future door wired past the
   * opener is refused rather than trusted. ⚠ That makes the arity load-bearing:
   * a direct caller (the in-app row, which drives this method as its subject)
   * must pass `panel._documentToken` for the document it means.
   *
   * ⛔ The SESSION check comes first on purpose: with nothing loaded, *"load a
   * rules.json first"* is the actionable sentence and *"the editor replaced the
   * document"* would be a false account of what happened.
   *
   * @param {string} key
   * @param {object} op
   * @param {number} token the `_documentToken` this op was made against.
   * @returns {{accepted: boolean, applied: boolean, errors: string[],
   *   description: string}} `accepted` = the op reached the session without
   *   being refused; `applied` = it also CHANGED the document (an op that
   *   restates what is already there is accepted and not applied).
   */
  _acceptEditorOp(key, op, token) {
    const editor = DOCUMENT_KEY_EDITORS[key];
    const label = editor ? editor.label : key;
    const refuse = (description, errors) => {
      this._opMessage = `${label}: ${description}`;
      this._renderChrome();
      return { accepted: false, applied: false, errors, description };
    };
    if (!op || typeof op !== 'object') {
      return refuse('an editor saved something that is not an op.',
        [`${key}: not an op — got ${op === null ? 'null' : typeof op}.`]);
    }
    if (editor && editor.returns !== 'op') {
      log('warn', `${key}: a door declared \`returns: '${editor.returns}'\` handed back an op`);
    }
    if (!this.session) {
      return refuse('an editor saved, but there is no session to apply it to — '
        + 'load a rules.json first.', [`${key}: no session.`]);
    }
    if (token !== this._documentToken) {
      log('warn', `${key}: an editor's op was made for document #${token} and this hub `
        + `now holds #${this._documentToken} — refused`);
      return refuse(STALE_DOCUMENT_REFUSAL, [`${key}: ${STALE_DOCUMENT_REFUSAL}`]);
    }
    // ⛓ Previewed with the SAME op the session will see, stamp included: a
    //   preview of a different op is a veto over something nobody applies.
    const stamped = this._stampPlayer(op);
    const errors = this._schemaErrorsAddedBy(stamped);
    if (errors.length > 0) {
      log('warn', `${key}: an editor's op was refused by the schema: ${errors.join(' | ')}`);
      return refuse(`refused by the schema — ${errors.length} `
        + `error${errors.length === 1 ? '' : 's'}: ${errors.slice(0, 3).join(' · ')}`
        + `${errors.length > 3 ? ' · …' : ''}`, errors);
    }
    // ⛓⛓ P1 — and the same veto the block editor's Save JSON runs, at the same
    //   seam, for the same reason L4 moved the schema veto here: a door wired
    //   past the opener must not be the way around a guard.
    const placements = this._placementIssuesAddedBy(stamped);
    if (placements.length > 0) {
      const lines = placements.map(describePlacementIssue);
      log('warn', `${key}: an editor's op would add ${placements.length} placement(s) the `
        + `world cannot place: ${lines.join(' | ')}`);
      return refuse(`refused - ${this._placementRefusal(key, placements)}`, lines);
    }
    const res = this._applyOp(op);
    const accepted = !!(res && res.ok);
    const applied = !!(res && res.ok && res.applied);
    this._opMessage = accepted
      ? `${label} saved — applied as one \`${op.op}\` you can undo here.`
      : `${label}: ${res?.description ?? 'refused'}`;
    this._renderChrome();
    /**
     * ⛔ ONLY on the way out of the ACCEPTED path. Every refusal above returns
     * through `refuse()`, which never reaches here — see `_focusAcceptedOp`.
     *
     * ⛓⛓⛓ **R1 — AND WHETHER IT RAISES THE HUB IS THE DOOR'S OWN
     * DECLARATION.** `focusHubOnSave` is read FAIL-CLOSED: a door that does not
     * declare it does not bounce. The success sentence is recorded beside the
     * row either way, so an unfocused save still has its answer waiting where
     * the key lives (see `_focusAcceptedOp`'s `raise` option).
     */
    if (accepted) {
      this._focusAcceptedOp(key, this._opMessage, { raise: !!editor?.focusHubOnSave });
    }
    return { accepted, applied, errors: [], description: res?.description ?? '' };
  }

  /**
   * ⛓⛓⛓ **S1 — THE HUB COMES TO THE FRONT AND SHOWS THE ROW IT JUST WROTE**
   * (⚖ user, 2026-09-08: *"this automatically activated the APWorld Editor
   * panel and scrolled to the relevant section, with a message that the data
   * was successfully loaded"*).
   *
   * ⛓ **THE SEAM IS GENERIC, and that is the whole design.** The ⚖ was asked
   * about the cost debugger's Send, but the gesture it describes is *"an editor
   * elsewhere saved into this document"* — which is `_acceptEditorOp`, the one
   * seam every `op` door's save comes through (`region_atlas`'s included). A
   * focus wired into the cost debugger's door would be a second behaviour for
   * the next door somebody adds.
   *
   * ⛓⛓⛓ **R1 — BUT WHETHER IT FIRES IS THE DOOR'S DECLARATION, NOT THE SEAM'S
   * DEFAULT** (S1 §8.6 (2); ⚖ user, 2026-09-09). S1 shipped it unconditional,
   * and *"unconditional"* is a claim about every editor at once: the marking
   * tool is a workspace a person stays in, so its Save raising the hub takes
   * their screen for a checkpoint they did not finish on. `focusHubOnSave`
   * lives beside `returns` in `DOCUMENT_KEY_EDITORS`, is read fail-closed, and
   * gates ONLY the raise/tab/scroll — never the sentence, which is recorded
   * beside the row either way so it is waiting when they come back.
   *
   * ⛔⛔ **AND A REFUSED OP MUST NOT STEAL FOCUS.** Raising the panel and
   * scrolling to a row is what "it worked" looks like; doing it for a refusal
   * would make the two outcomes look alike on screen while the status line said
   * otherwise. Every refusal path returns through `_acceptEditorOp`'s `refuse()`
   * before this is reached, so the property is structural rather than a flag.
   *
   * ⛓ The tab is the key's OWN home tab — `loop_costs` lands on Sidecars,
   * `region_atlas` on Sidecars, and a key no tab owns on the Document tab, the
   * everything-fallback. Read off the registry row rather than mapped here, so
   * a key that changes homes changes this with it.
   */
  _focusAcceptedOp(key, text, { raise = true } = {}) {
    this._opRowMessage = { key, text };
    const row = this._documentRows().find((r) => r.key === key) ?? null;
    const tab = row?.ownedByTab ?? DOCUMENT_TAB_ID;
    /**
     * ⛓⛓⛓ **R1 — THE MESSAGE IS NOT PART OF THE BOUNCE.** A door that declared
     * `focusHubOnSave: false` still wrote the document, so the row still says
     * what happened; what it does not do is take the person's screen. So the
     * unraised arm re-renders the tab they are ALREADY on (the sentence is
     * drawn by the tab body, so `_renderChrome` alone would not draw it) and
     * stops: no `ui:activatePanel`, no tab change, no scroll.
     */
    if (!raise) {
      this._render();
      return;
    }
    /**
     * ⛓ The panel raises ITSELF, through the same `ui:activatePanel` every door
     * uses to raise somebody else — `index.js` registers this module as that
     * event's publisher (H5's defect: an unregistered publish is DROPPED).
     */
    try {
      this.eventBus.publish('ui:activatePanel', { panelId: APWORLD_EDITOR_PANEL_ID });
    } catch (err) {
      log('warn', `could not raise this panel for ${key}: ${err.message}`);
    }
    /**
     * ⛔ EXACTLY ONE render either way: `_selectTab` returns early when the tab
     * is already active, and the message above is drawn by the TAB BODY — so a
     * bare `_selectTab` on the tab we are already on would leave the row
     * without its sentence.
     */
    if (this.activeTab === tab) this._render(); else this._selectTab(tab);
    const box = this.scrollContainer
      ? this.scrollContainer.querySelector(`.apworld-doc-row[data-doc-key="${key}"]`)
      : null;
    // ⛓ Guarded: `scrollIntoView` is a DOM method a detached container lacks,
    //   and a hub that threw here would lose the op's own answer.
    if (box && typeof box.scrollIntoView === 'function') {
      box.scrollIntoView({ block: 'center' });
    }
  }

  /**
   * ⛓ A key another tab already edits gets a POINTER FIRST — the tab that owns
   * it knows the shape (a region map is not a JSON blob to its own editor), so
   * that is where a person should go for it.
   *
   * ⛓⛓ **W0 — and the pointer is no longer the WHOLE row.** H1 returned here
   * so that one key had one editor; what that actually bought was a key with no
   * editor at all for every field its home tab does not draw. The row now says
   * both things: go there for the shape, and the raw block below is the rest.
   */
  _makeOwnedByTabLine(row) {
    const line = document.createElement('div');
    line.className = 'apworld-doc-owned';
    Object.assign(line.style, {
      display: 'flex', alignItems: 'center', gap: '6px', margin: '5px 0 0',
      color: '#8a8', fontSize: '11px',
    });
    const tab = TABS.find((t) => t.id === row.ownedByTab);
    line.appendChild(document.createTextNode(
      `Edited in the ${tab ? tab.label : row.ownedByTab} tab — which knows this key's shape. `
      + 'The raw block below is the same key, for whatever that tab does not draw.'));
    const btn = this._makeButton(`Go to ${tab ? tab.label : row.ownedByTab}`, '#3a3a3a',
      () => this._selectTab(row.ownedByTab));
    btn.style.fontSize = '11px';
    line.appendChild(btn);
    return line;
  }

  /**
   * ⛓⛓ **THE EDIT AFFORDANCE IS ONE OP.** A scalar commits on blur/Enter (the
   * Meta tab's `change`-not-`input` rule: a per-keystroke op makes `Vault` five
   * undos); a container is a pretty-printed JSON block behind a disclosure, with
   * a Save that PARSES first and refuses by name.
   */
  _makeDocumentValueEditor(row) {
    const wrap = document.createElement('div');
    wrap.style.margin = '5px 0 0';
    /**
     * ⛓ The editor is chosen by the key's DECLARED type first and by the value
     * only when the schema says nothing. ⛔ Routing on the value alone gives an
     * ABSENT object key a text box, and the first thing typed into it is a
     * string the schema then refuses — a control that can only produce a
     * refusal is not an affordance.
     */
    const container = row.type === 'object' || row.type === 'array'
      || row.summary.kind === 'object' || row.summary.kind === 'array';
    wrap.appendChild(container
      ? this._makeDocumentBlockEditor(row)
      : this._makeDocumentScalarEditor(row));
    return wrap;
  }

  _makeDocumentScalarEditor(row) {
    const line = document.createElement('div');
    Object.assign(line.style, { display: 'flex', alignItems: 'center', gap: '6px' });
    if (row.type === 'boolean') {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'apworld-doc-input';
      cb.checked = row.value === true;
      cb.addEventListener('change', () => this._applySetKey(row, cb.checked));
      line.appendChild(cb);
      const lbl = document.createElement('span');
      lbl.style.color = '#aaa';
      lbl.style.fontSize = '11px';
      lbl.textContent = row.present ? String(row.value) : '(absent — unchecked writes false)';
      line.appendChild(lbl);
      return line;
    }
    const input = this._makeTextInput(
      row.value === undefined || row.value === null ? '' : String(row.value), '100%');
    input.className = 'apworld-doc-input';
    input.dataset.docKey = row.key;
    input.addEventListener('change', (e) => {
      const raw = e.target.value;
      if (row.type === 'integer' || row.type === 'number') {
        const n = Number(raw);
        if (raw === '' || !Number.isFinite(n)) {
          this._opMessage = `Refused: \`${row.key}\` is a ${row.type} and `
            + `${JSON.stringify(raw)} is not one.`;
          this._render();
          return;
        }
        this._applySetKey(row, row.type === 'integer' ? Math.trunc(n) : n);
        return;
      }
      this._applySetKey(row, raw);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
    line.appendChild(input);
    return line;
  }

  _makeDocumentBlockEditor(row) {
    return this._makeJsonBlock({
      classPrefix: 'apworld-doc',
      dataset: { docKey: row.key },
      name: row.key,
      expanded: this._expandedKeys.has(row.key),
      onToggle: () => {
        if (this._expandedKeys.has(row.key)) this._expandedKeys.delete(row.key);
        else this._expandedKeys.add(row.key);
        this._render();
      },
      // ⛓ An absent container is seeded with its own EMPTY form, so "add the key"
      //   and "edit the key" are the same gesture.
      value: () => (row.value !== undefined ? row.value : (row.type === 'array' ? [] : {})),
      sizeLabel: row.summary.inline,
      onSave: (parsed) => this._applySetKey(row, parsed),
    });
  }

  /**
   * ⛓⛓⛓ **S0 — ONE JSON WIDGET, AND THE DOCUMENT ROW IS ITS FIRST CALLER.**
   * A disclosure, a pretty-printed textarea built ONLY ON EXPAND (W0's rule: a
   * 600 KB `regions` — or 250 sidecar entries — costs nothing until somebody
   * opens it), a size line, and a Save that PARSES first and refuses by name.
   * The per-region sidecar block (`_makeRegionSidecarBlock`) is the second
   * caller: its host's `onSave` (PRESET SIDECARS S1 — one `set-region-sidecar`)
   * is passed through, and a host that passes none gets the same widget with a
   * read-only textarea and no Save — one widget, not a second one beside it.
   *
   * ⛔ `value` is a THUNK, called only when the block is expanded — never a
   *   value captured earlier. The tab re-renders on every op, so an expanded
   *   block always shows the value the document holds NOW.
   *
   * @param {object} o
   * @param {string} o.classPrefix  `apworld-doc` → `apworld-doc-toggle` / `-json` / `-save`
   * @param {object} [o.dataset]    stamped on the toggle, the textarea and the Save
   * @param {string} o.name         what the refusal sentence calls the value
   * @param {boolean} o.expanded
   * @param {Function} o.onToggle
   * @param {Function} o.value      () → the value to pretty-print
   * @param {string} o.sizeLabel    the text before the character count
   * @param {Function|null} [o.onSave] (parsed) → void; null = read-only
   */
  _makeJsonBlock({ classPrefix, dataset = {}, name, expanded, onToggle, value, sizeLabel,
    onSave = null }) {
    const wrap = document.createElement('div');

    const toggle = this._makeButton(expanded ? '▾ Hide JSON' : '▸ Show JSON', '#3a3a3a', onToggle);
    toggle.style.fontSize = '11px';
    toggle.className = `${classPrefix}-toggle`;
    Object.assign(toggle.dataset, dataset);
    wrap.appendChild(toggle);
    if (!expanded) return wrap;

    const text = document.createElement('textarea');
    text.className = `${classPrefix}-json`;
    Object.assign(text.dataset, dataset);
    text.value = JSON.stringify(value(), null, JSON_BLOCK_INDENT);
    // ⛓ READ-ONLY, not disabled: the text can still be selected and copied.
    if (!onSave) text.readOnly = true;
    Object.assign(text.style, {
      width: '100%', minHeight: '160px', marginTop: '5px', boxSizing: 'border-box',
      backgroundColor: '#111', color: '#ddd', border: '1px solid #444', borderRadius: '3px',
      fontFamily: 'monospace', fontSize: '11px',
    });
    wrap.appendChild(text);

    const size = document.createElement('div');
    size.style.color = '#777';
    size.style.fontSize = '10px';
    size.textContent = `${sizeLabel} · ${text.value.length.toLocaleString()} characters `
      + `of pretty-printed JSON${onSave ? '' : ' · read-only here'}`;
    wrap.appendChild(size);
    if (!onSave) return wrap;

    const save = this._makeButton('Save JSON', '#2e7d32', () => {
      let parsed;
      try {
        parsed = JSON.parse(text.value);
      } catch (err) {
        this._opMessage = `Refused: \`${name}\` — ${err.message}. ⛔ The op carries the `
          + 'PARSED value, never the text: an edit list whose payload is a recipe that can '
          + 'fail to re-parse is not a record.';
        this._renderChrome();
        return;
      }
      onSave(parsed);
    });
    save.style.marginTop = '4px';
    // ⛓ W0 — CLASSED so a row can press the product's own button. Until W0 the
    //   only addressable controls on a block row were the toggle and the
    //   textarea, so a row asserting a save had to call `_applySetKey` and
    //   would have passed over a Save wired to nothing.
    save.className = `${classPrefix}-save`;
    Object.assign(save.dataset, dataset);
    wrap.appendChild(save);
    return wrap;
  }

  /**
   * ⛓⛓⛓ **ONE `set-key`, AND THE SCHEMA GETS A VETO FIRST.**
   *
   * The op is applied to a PREVIEW of the document (`applyRulesDocOp` is pure,
   * so this costs one copy-on-write and touches no session), the preview is
   * validated whole, and the errors are DIFFERENCED against the ones the
   * document already had — `rulesDocOps`' own law, so an edit is never refused
   * for somebody else's pre-existing violation. Only then does it reach the
   * session.
   */
  _applySetKey(row, value) {
    if (!this.session) {
      alert('Load a rules.json first.');
      return;
    }
    const op = {
      op: 'set-key',
      key: row.key,
      value,
      scope: row.perPlayer ? 'player' : 'document',
      player: this.playerId,
    };
    const refusal = this._rawSaveRefusal(op, row.key);
    if (refusal) {
      this._opMessage = `Refused: ${refusal}`;
      this._renderChrome();
      return;
    }
    this._applyOp(op);
  }

  /**
   * ⛓⛓⛓ **THE RAW SAVES' ONE VETO — the schema, then P1's placements** — or
   * `null` when the op adds neither. Two raw JSON saves reach the session
   * through it: the Document tab's whole-key block (`_applySetKey`) and, since
   * PRESET SIDECARS S1, a region's sidecar entry (`_saveRegionSidecar`). ONE
   * function, so the two cannot disagree about what the schema refuses.
   *
   * ⚠ The placement half can find nothing for a `set-region-sidecar` — it never
   * touches `canonical_placements`, `regions` or `items` — and it runs anyway:
   * P1's own rule (`_placementIssuesAddedBy`) is that a guard which has to be
   * remembered per door is a guard that will not be. Measured on the largest
   * document (`procgen_topdown/AP_8`, 934,463 compact bytes) in the S1 record.
   *
   * @param {object} op   the op the session will see (slot included)
   * @param {string} name what the refusal sentence calls the value
   * @returns {string|null}
   */
  _rawSaveRefusal(op, name) {
    const errors = this._schemaErrorsAddedBy(op);
    if (errors.length > 0) {
      log('warn', `${op.op} refused by the schema: ${errors.join(' | ')}`);
      return `\`${name}\` — ${errors.length} schema `
        + `error${errors.length === 1 ? '' : 's'}: ${errors.slice(0, 3).join(' · ')}`
        + `${errors.length > 3 ? ' · …' : ''}`;
    }
    // ⛓⛓ P1 — the question the schema is not able to ask (see
    //   `_placementIssuesAddedBy`): the slot is `additionalProperties: true`.
    const placements = this._placementIssuesAddedBy(op);
    if (placements.length > 0) {
      log('warn', `${op.op} refused - ${placements.length} placement(s) the world cannot `
        + `place: ${placements.map(describePlacementIssue).join(' | ')}`);
      return this._placementRefusal(name, placements);
    }
    return null;
  }

  /**
   * ⛓⛓⛓ **PRESET SIDECARS S1 — A REGION'S SIDECAR ENTRY, SAVED AS ONE
   * `set-region-sidecar`.** The Save JSON of `_makeRegionSidecarBlock`'s widget
   * lands here with the PARSED entry (the widget refuses unparseable text by
   * name before calling). Three gates, each answering in the op's or the
   * schema's own words, and the answer is printed BESIDE the block as well as
   * in the chrome (the S1 accepted-op precedent — the person is looking at the
   * block they just saved):
   *
   *   1. the OP's own refusals, asked of a preview (the op is pure): no entry
   *      for this region — it replaces, never creates — a non-object entry, no
   *      `substrate`, a non-object payload. ⛔ Asked FIRST because the schema
   *      veto cannot see them: `_schemaErrorsAddedBy` returns `[]` for an op
   *      the preview refuses, so without this step the session's refusal would
   *      be the only answer, and it is an `alert`;
   *   2. `_rawSaveRefusal` — the SAME veto the whole-key block runs, so
   *      `grid_cell`'s `{gx, gy}`, `biome`'s type and the rest of the entry's
   *      declared shape are vetted by path (the payload stays OPAQUE);
   *   3. the session — ONE op, ONE undo. Its description says the rules were
   *      NOT re-derived (`SIDECAR_NOT_REDERIVED`), and the region's Edit ▸ is
   *      re-asked on its next press because its verdict was keyed on the record
   *      this op replaced (`_roomVerdicts`).
   */
  _saveRegionSidecar(player, regionName, entry) {
    if (!this.session) {
      alert('Load a rules.json first.');
      return;
    }
    const op = { op: 'set-region-sidecar', region: regionName, entry, player };
    const beside = (text, refused) => {
      this._opRowMessage = { sidecar: `${player}|${regionName}`, text, refused };
    };
    const preview = applyRulesDocOp(this.rulesDoc, op);
    const refusal = preview.ok
      ? this._rawSaveRefusal(op, `preset_sidecars.${player}.${regionName}`)
      : preview.error;
    if (refusal) {
      this._opMessage = `Refused: ${refusal}`;
      beside(this._opMessage, true);
      this._render();
      return;
    }
    const res = this._applyOp(op, { rerender: false });
    if (res.ok) beside(this._opMessage, false);
    this._render();
  }

  /**
   * ⛓⛓⛓ **P1 — THE PLACEMENT ISSUES THIS OP WOULD ADD, so the whole-block
   * editor cannot write what the per-entry op refuses** (W3 §10.7 (1); ⚖ user
   * 2026-09-09: *"We can go ahead and implement placement validation if it's
   * easy."*).
   *
   * ⛔⛔ **THE SCHEMA CANNOT ASK THIS, AND THAT IS WHY THE HOLE EXISTED.** The
   * placement slot is `additionalProperties: true` — a cross-reference between
   * `canonical_placements` and the document's own `regions` and `items` is not
   * something a JSON schema can assert — so `_schemaErrorsAddedBy` returned
   * `[]` for `{"Nowhere": "Sword"}` and the Document tab's Save JSON wrote a
   * placement `set-canonical-placement` refuses by name. This is the same veto
   * in the same shape, asking the one question the schema cannot.
   *
   * ⛓⛓ **DIFFERENCED AGAINST BEFORE, exactly as the schema veto is** — an edit
   * is refused for what IT introduces and never for a pre-existing stale entry.
   * ⛔ That is not a softening: a hand-edited file arrives WITH stale entries,
   * and the block editor is how a person fixes one. A veto that refused any
   * save leaving an issue behind would make the one document that needs editing
   * the one document that cannot be edited — the same law W3 wrote into the
   * op's delete path.
   *
   * ⛓ The identity is `player + location + reason`, not the location alone: the
   * slot is stamped because the veto compares two whole documents, and the
   * reason is part of it because an edit turning one kind of stale entry into
   * another has introduced the second.
   *
   * ⚠ It runs on EVERY op reaching these two seams, not only on a `set-key
   * canonical_placements`. Today no door writes that key (`region_atlas` and
   * `loop_costs` write their own), so the population it actually refuses is the
   * block editor's Save JSON — but this seam is where L4 found the schema veto
   * missing for exactly the opposite reason, and a guard that has to be
   * remembered when a door is added is a guard that will not be.
   */
  _placementIssuesAddedBy(op) {
    if (!this.rulesDoc) return [];
    const preview = applyRulesDocOp(this.rulesDoc, op);
    if (!preview.ok) return [];
    const identity = (i) => `${i.player} ${i.location} ${i.reason}`;
    const before = new Set(canonicalPlacementIssuesByPlayer(this.rulesDoc).map(identity));
    return canonicalPlacementIssuesByPlayer(preview.doc).filter((i) => !before.has(identity(i)));
  }

  /**
   * ⛓ The refusal sentence for what `_placementIssuesAddedBy` found — bounded
   * like the schema veto's, because a pasted block can be stale in a thousand
   * places and a refusal is a sentence rather than a dump.
   */
  _placementRefusal(key, issues) {
    return `\`${key}\` — ${issues.length} placement`
      + `${issues.length === 1 ? '' : 's'} this edit would ADD that the world cannot place: `
      + `${issues.slice(0, 3).map(describePlacementIssue).join(' - ')}`
      + `${issues.length > 3 ? ' - ...' : ''}`;
  }

  /**
   * ⛓ The schema errors this op would ADD — `[]` when it adds none, and `[]`
   * when there is no schema to ask (a fetch failure must not make the whole tab
   * read-only; the Python gate is still the authority on the corpus).
   */
  _schemaErrorsAddedBy(op) {
    if (!this._rulesSchema || !this.rulesDoc) return [];
    const preview = applyRulesDocOp(this.rulesDoc, op);
    if (!preview.ok) return [];
    try {
      const before = new Set(rulesJsonSchemaErrors(this.rulesDoc, this._rulesSchema));
      return rulesJsonSchemaErrors(preview.doc, this._rulesSchema).filter((e) => !before.has(e));
    } catch (err) {
      log('warn', `Schema check could not run: ${err.message}`);
      return [];
    }
  }

  /* ══════════════════════════════════════════════════════════════════
   * THE LINKS TAB — every other editor, derived where it can be
   * ══════════════════════════════════════════════════════════════════ */

  _renderLinksTab() {
    const rows = buildLinkRows(substrateRegistry);
    const intro = document.createElement('div');
    Object.assign(intro.style, { color: '#888', fontSize: '11px', padding: '2px 0 6px' });
    intro.textContent = 'Every editor that owns part of a rules.json. The substrate rows are '
      + 'DERIVED from the registry\'s `roomEditor` declarations; the rest is a table. Rows open '
      + 'their editor EMPTY when this document has nothing for it — that is the point of the tab.';
    this.scrollContainer.appendChild(intro);
    for (const row of rows) this.scrollContainer.appendChild(this._renderLinkRow(row));
  }

  /* ══════════════════════════════════════════════════════════════════
   * THE MAP TAB (H3)
   * ══════════════════════════════════════════════════════════════════ */

  /**
   * ⛓⛓ **THE COMPOSITE GRID, FROM THE WORKING COPY** — ⚖ *"I want [the code
   * that graphically displays all of the regions as an interconnected map] to
   * be accessible directly from a tab in the APWorld editor"*, and ⚖
   * *"show the composite grid only for presets that have grid data"*.
   *
   * ⛔ **NO GRAPH FALLBACK.** A document whose sidecars carry no `grid_cell`
   * (Seedling, jta, bounce; only the GROWN worlds carry them) gets a sentence
   * saying so and the one-way button, not a second drawing of what the region
   * graph panel already draws. The ⚖ is explicit that the graph stays its own
   * panel and gets NO button back.
   *
   * Memoised on the record's identity + the slot — see `_mapCache`.
   */
  _mapResult() {
    const doc = this.rulesDoc;
    if (!doc) return null;
    const c = this._mapCache;
    if (c && c.doc === doc && c.playerId === this.playerId) return c.result;
    const result = reconstructResultFromSidecars(doc, { playerId: this.playerId });
    this._mapCache = { doc, playerId: this.playerId, result };
    return result;
  }

  /**
   * ⛓ **ONE-WAY, BY ⚖.** *"We could add a button to open the region graph, but
   * I don't want a button in the region graph leading back to the APWorld
   * editor."* The panel id is the same one the Links tab's row names, so the
   * two doors cannot drift; nothing was added under `regionGraph/`.
   */
  _openRegionGraph() {
    const row = DOCUMENT_LINKS.find((r) => r.id === 'regionGraphPanel');
    if (!row) {
      this._opMessage = 'Region graph: no link row declares it (documentLinks.js).';
      this._renderChrome();
      return;
    }
    this._openLink(row);
  }

  /**
   * ⛓⛓⛓ **THE SELECTION API H4 READS.** A click on the map selects a region in
   * the Regions tab. There was no selection API on this panel, so this is it:
   * ONE method, named for what it does, returning whether the document
   * actually has that region — a map cell whose sidecar names a region the
   * `regions` block does not is a real document, and the caller should be able
   * to say so rather than silently switching to a tab with nothing highlighted.
   *
   * @param {string} name a region name (a sidecar's key, which is the same key
   *   `regions[player]` uses — 3 of `procgen_maze/AP_1`'s 4 region names have a
   *   sidecar, the missing one being `Menu`).
   * @returns {boolean} true when the working copy carries that region.
   */
  selectRegion(name, from = 'the map') {
    if (!name) return false;
    this._selectedRegion = name;
    const known = Object.prototype.hasOwnProperty.call(this._regions(), name);
    this.activeTab = 'regions';
    this._updateTabStyles();
    // ⛓ H4c — `from` NAMES THE CALLER, because there are two now: the Map tab's
    // own click and a reverse link from another panel. A sentence that said
    // "from the map" about a bounce editor's door would be a true refusal (or a
    // true confirmation) about the wrong subject.
    this._opMessage = known
      ? `Selected region ${name} from ${from}.`
      : `Region ${name} is named by ${from} but is not in \`regions.${this.playerId}\`.`;
    this._render();
    const block = this.scrollContainer.querySelector(
      `.apworld-region-block[data-region-name="${CSS.escape(name)}"]`);
    if (block && typeof block.scrollIntoView === 'function') {
      block.scrollIntoView({ block: 'nearest' });
    }
    return known;
  }

  /**
   * ⛓ WHY there is no map for the selected slot, in the document's own terms.
   * The answers are the ways `reconstructResultFromSidecars` returns null, in
   * the order it decides them — so a reader can act on the sentence rather than
   * guess which one it means.
   *
   * ⛔ **M0 RETIRED THE FOURTH ONE.** It read *"N regions carry a grid cell, but
   * `bounce` stores no tile-grid geometry in the payload"*, and it was the true
   * sentence for a rule that has since gone: the reconstruction sized its cell
   * only from tile geometry, so a zone slot with a `grid_cell` on every region
   * drew nothing. It now falls back to the engine's default region size and
   * DRAWS — measured over the committed corpus, 12 of the 16 null slots turned
   * into grids — so the sentence would now be a reason for something that does
   * not happen. The remaining three are the three ways the function still
   * returns null.
   */
  _noMapReason() {
    const byPlayer = this.rulesDoc?.preset_sidecars;
    if (!byPlayer || typeof byPlayer !== 'object' || Object.keys(byPlayer).length === 0) {
      return 'this document carries no `preset_sidecars` at all';
    }
    const entries = Object.values(byPlayer[this.playerId] ?? {});
    if (entries.length === 0) return `player slot ${this.playerId} carries no sidecars`;
    const withCells = entries.filter((sc) => !!sc?.grid_cell);
    if (withCells.length === 0) return 'no grid data in the sidecars';
    return 'no registered substrate here can rebuild a region from its payload';
  }


  _renderMapTab() {
    const result = this._mapResult();

    const intro = document.createElement('div');
    Object.assign(intro.style, { color: '#888', fontSize: '11px', padding: '2px 0 6px' });
    intro.className = 'apworld-map-intro';

    const bar = document.createElement('div');
    Object.assign(bar.style, {
      display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px',
    });
    const graphBtn = this._makeButton('Open region graph', '#2e5f8a',
      () => this._openRegionGraph());
    graphBtn.className = 'apworld-map-open-graph';
    graphBtn.title = 'Raises the region graph panel. One-way by ⚖: the graph has no button back here.';

    if (!result) {
      /**
       * ⛔ The sentence names the REASON, not just the absence — "no map" and
       * "no grid data in the sidecars" are different claims, and only the
       * second tells the person whether a different document would work.
       *
       * ⛓ M0 rewrote the second sentence, which had become false. It read
       * *"…write a `grid_cell` AND a tile-grid payload per region; Seedling, JtA
       * and zone-only worlds do not"* — true of the old sizing rule, and now
       * wrong twice over: a zone-only world DOES draw (its cells take the
       * engine's default size), and the tile-grid payload is no longer part of
       * what a map needs. What is left is the `grid_cell`, which is a claim
       * about the LAYOUT and names no substrate.
       */
      intro.textContent = `No map for this world (${this._noMapReason()}). `
        + 'A composite grid is laid out from the `grid_cell` each sidecar carries, so a slot '
        + 'whose sidecars carry none has no layout to draw — however playable its regions are. '
        + 'The region graph draws the topology for any document.';
      this.scrollContainer.appendChild(intro);
      bar.appendChild(graphBtn);
      this.scrollContainer.appendChild(bar);
      return;
    }

    const { grid, regionSize } = result;
    intro.textContent = 'The composite grid, rebuilt from `preset_sidecars` — the WORKING '
      + 'COPY\'s. Each substrate paints its own cells (registry slot `compositeMap`); one that '
      + 'declares no painter gets a box labelled with its id. Click a cell to select that '
      + 'region in the Regions tab.';
    this.scrollContainer.appendChild(intro);

    const slot = document.createElement('span');
    slot.className = 'apworld-map-slot';
    slot.dataset.cellSource = String(result.regionSizeSource ?? '');
    slot.textContent = `player slot ${result.playerId} · `
      + `${result.stats.regionsBuilt} region${result.stats.regionsBuilt === 1 ? '' : 's'} · `
      + mapCellNote(result);
    Object.assign(slot.style, { color: '#9ab', fontSize: '11px' });
    bar.appendChild(slot);
    graphBtn.style.marginLeft = 'auto';
    bar.appendChild(graphBtn);
    this.scrollContainer.appendChild(bar);

    const canvas = document.createElement('canvas');
    canvas.className = 'apworld-map-canvas';
    canvas.width = grid.width * regionSize.width * TILE_PX;
    canvas.height = grid.height * regionSize.height * TILE_PX;
    // ⛓ The same geometry data-attrs the pipeline's canvas carries, so a
    //   headless row can map a cell index to a click without re-deriving TILE_PX.
    canvas.dataset.gridW = String(grid.width);
    canvas.dataset.gridH = String(grid.height);
    canvas.dataset.cellW = String(regionSize.width * TILE_PX);
    canvas.dataset.cellH = String(regionSize.height * TILE_PX);
    canvas.dataset.regions = String(result.stats.regionsBuilt);
    canvas.style.cursor = 'pointer';
    canvas.style.maxWidth = '100%';
    canvas.title = 'Click a region to select it in the Regions tab';

    // The selected region's cell, so the map shows what the Regions tab shows.
    let selection = null;
    if (this._selectedRegion) {
      const hit = grid.allRegions().find((r) => r.region_id === this._selectedRegion);
      if (hit?.cell) selection = { kind: 'region', cell: hit.cell };
    }
    drawCompositeMap(canvas, grid, regionSize, { selection });

    canvas.addEventListener('click', (evt) => {
      const cell = cellAtPoint(grid, regionSize, canvasPointOf(canvas, evt));
      const region = cell ? grid.getRegion(cell) : null;
      if (!region) return;
      this.selectRegion(region.region_id);
    });
    this.scrollContainer.appendChild(canvas);
  }

  _renderLinkRow(row) {
    const box = document.createElement('div');
    box.className = 'apworld-link-row';
    box.dataset.linkId = row.id;
    Object.assign(box.style, {
      border: '1px solid #333', borderRadius: '3px', margin: '0 0 6px',
      padding: '6px 8px', backgroundColor: '#1f1f1f',
    });

    const head = document.createElement('div');
    Object.assign(head.style, { display: 'flex', alignItems: 'center', gap: '8px' });
    const label = document.createElement('span');
    label.textContent = row.label;
    Object.assign(label.style, { color: '#ddd', fontWeight: 'bold', fontSize: '12px' });
    head.appendChild(label);
    if (row.key) {
      const k = document.createElement('code');
      k.textContent = row.key;
      Object.assign(k.style, { color: '#cfe', fontSize: '10px' });
      head.appendChild(k);
      const has = document.createElement('span');
      has.textContent = this._documentHasDataFor(row.key) ? 'this document has data' : 'no data here';
      Object.assign(has.style, {
        color: this._documentHasDataFor(row.key) ? '#7a9' : '#777', fontSize: '10px',
      });
      head.appendChild(has);
    }
    // ⛓ H5 — a row whose panel this app does not load is DISABLED with the
    //   reason in its title, exactly like the Document tab's door.
    const notHere = row.target && (row.target.kind === 'panel'
      ? this._panelRefusal(row.target.panelId)
      : (row.target.kind === 'documentKeyEditor'
        ? this._panelRefusal(DOCUMENT_KEY_EDITORS[row.target.key]?.panelId) : null));
    const usable = !!row.target && !notHere;
    const open = this._makeButton('Open', usable ? '#2e5f8a' : '#444',
      () => this._openLink(row));
    open.className = 'apworld-link-open';
    open.style.marginLeft = 'auto';
    open.disabled = !usable;
    open.style.opacity = usable ? '1' : '0.45';
    if (notHere) open.title = notHere;
    head.appendChild(open);
    box.appendChild(head);

    const note = document.createElement('div');
    note.textContent = row.note;
    Object.assign(note.style, {
      color: '#777', fontSize: '10px', margin: '3px 0 0', lineHeight: '1.35',
    });
    box.appendChild(note);
    return box;
  }

  /** ⛓ Does the working copy carry anything for this key, in ANY slot? */
  _documentHasDataFor(key) {
    const top = this.rulesDoc ? this.rulesDoc[key] : undefined;
    if (top === undefined || top === null) return false;
    if (Array.isArray(top)) return top.length > 0;
    if (typeof top === 'object') return Object.keys(top).length > 0;
    return true;
  }

  /**
   * ⛓ A row's `target` resolved to an action. ⛔ The two kinds are named, and an
   * unknown one says so rather than doing nothing: a button that silently does
   * not work is indistinguishable from a panel the layout does not hold.
   */
  _openLink(row) {
    const target = row.target;
    if (!target) {
      this._opMessage = `${row.label}: no way to open it — ${row.note}`;
      this._renderChrome();
      return;
    }
    if (target.kind === 'panel') {
      const refusal = this._panelRefusal(target.panelId);
      if (refusal) {
        this._opMessage = `${row.label}: ${refusal}`;
        this._renderChrome();
        return;
      }
      this.eventBus.publish('ui:activatePanel', { panelId: target.panelId });
      this._opMessage = `Opened ${row.label} (${target.panelId}). ⚠ Nothing happens if that `
        + 'panel is not in the current layout.';
      this._renderChrome();
      return;
    }
    // ⛓ H5 — the registry's own door, with NO document: ⚖ *"a convenient way to
    //   open them even if the current rules.json file doesn't contain any
    //   relevant data for them"*.
    if (target.kind === 'documentKeyEditor') {
      this._openDocumentKeyEditor(target.key, { withDocument: false });
      return;
    }
    if (target.kind === 'substrateRoomEditor') {
      const open = getRegionEditor(target.substrate);
      if (typeof open !== 'function') {
        this._opMessage = `${row.label}: \`${target.substrate}\` declares a room editor that `
          + '`regionEditors.getRegionEditor` could not resolve — see the console for the reason '
          + 'it named.';
        this._renderChrome();
        return;
      }
      open({});
      this._opMessage = `Opened ${row.label} with no region.`;
      this._renderChrome();
      return;
    }
    this._opMessage = `${row.label}: unknown link target kind ${JSON.stringify(target.kind)}.`;
    this._renderChrome();
  }

  /* ══════════════════════════════════════════════════════════════════
   * THE EXITS — download, and the raw view over the working copy
   * ══════════════════════════════════════════════════════════════════ */

  /**
   * ⛓ DOWNLOAD. The bytes are the WORKING COPY's, pretty-printed exactly as the
   * committed presets are, so a file saved here and a file checked out of the
   * repo differ only where the person edited.
   */
  _handleDownload() {
    if (!this.rulesDoc) {
      this._flashButton(this.downloadButton, false);
      return;
    }
    try {
      const written = downloadJson(rulesDownloadName(this.rulesDoc), this.rulesDoc);
      this._opMessage = `Downloaded ${written.fileName} (${written.bytes.toLocaleString()} bytes).`;
      log('info', `Downloaded ${written.fileName} — ${written.bytes} bytes.`);
      this._renderChrome();
    } catch (err) {
      log('error', 'Download failed:', err);
      this._opMessage = `Download failed: ${err.message}`;
      this._flashButton(this.downloadButton, false);
      this._renderChrome();
    }
  }

  /**
   * ⛓⛓ The raw view's text, from wherever it currently lives: the MOUNTED
   * editor if there is one, else the draft parked at its teardown, else the
   * record.
   *
   * ⛔ This is the ONLY place the CM6 document is materialised as a string, and
   * it is called at SAVE time, not per keystroke. `doc.toString()` on a 3.1 MB
   * document allocates 3.1 MB; a listener that did it on every key would put
   * back exactly the cost CM6 was mounted to remove.
   */
  _rawText() {
    if (this.rawEditorView) return this.rawEditorView.state.doc.toString();
    return this._rawDraft ?? rawViewText(this.rulesDoc);
  }

  /**
   * ⛓⛓⛓ **THE EDITOR IS TORN DOWN BEFORE THE CONTAINER IT LIVES IN IS
   * EMPTIED** — `_render()` sets `scrollContainer.innerHTML = ''`, and a CM6
   * view whose DOM is yanked out from under it keeps its document, its
   * listeners and its `requestMeasure` loop alive with nothing to draw into.
   * (Trap family: a remounted panel keeping its old listeners.)
   *
   * ⛔ And the unsaved text has to survive the teardown, because a re-render is
   * something the panel does to ITSELF — an Apply elsewhere, an undo, a
   * validation refresh. Losing a person's half-typed document to a repaint
   * they did not ask for is the defect; the draft is captured here and the
   * next mount starts from it.
   */
  _teardownRawEditor() {
    if (!this.rawEditorView) return;
    if (this._rawEdited) this._rawDraft = this.rawEditorView.state.doc.toString();
    this.rawEditorView.destroy();
    this.rawEditorView = null;
    this.rawStatus = null;
  }

  /** ⛓ The size question, asked of the RECORD rather than of a stale draft. */
  _rawVerdict() {
    return rawViewVerdict(utf8Bytes(rawViewText(this.rulesDoc)));
  }

  /**
   * ⛓⛓⛓ **THE RAW VIEW IS OVER THE WORKING COPY, AND IT OPENS ANYTHING.**
   * ⛔ Not over applied state: the arc's ⚖ is that every linked editor opens
   * from `session.record()` and returns ONE op, and the raw view is the most
   * linked-editor-shaped of them all — a whole document in, a whole document
   * back, folded away by one undo.
   *
   * ⛓ H2 shipped a measured size threshold here with a refusal screen and a
   * "show it anyway" escape, because the widget was a `<textarea>` and the
   * corpus maximum took 12.9 s to open in one. H2b replaced the widget and
   * re-ran the measurement over ALL 205 committed presets; every one opens, so
   * the threshold, the refusal and the escape are gone. `rawView.js` carries
   * the table.
   */
  _renderRawTab() {
    const verdict = this._rawVerdict();

    const intro = document.createElement('div');
    Object.assign(intro.style, { color: '#888', fontSize: '11px', padding: '2px 0 6px' });
    intro.textContent = 'The whole document as text — the WORKING COPY, including every edit '
      + 'made in the other tabs and not yet applied. Save JSON (or Ctrl/Cmd+Enter) replaces the '
      + 'document as ONE op, so a single undo takes the text edit back out. Ctrl/Cmd+Z inside '
      + 'the editor is the editor\'s own undo, not the session\'s.';
    this.scrollContainer.appendChild(intro);

    const size = document.createElement('div');
    size.className = 'apworld-raw-size';
    size.textContent = verdict.message;
    Object.assign(size.style, { color: '#777', fontSize: '11px', padding: '0 0 6px' });
    this.scrollContainer.appendChild(size);

    /**
     * ⛓⛓⛓ **CODEMIRROR 6, NOT A `<textarea>` — AND THAT IS WHAT RETIRED THE
     * SIZE LIMIT** (H2b). Measured on the REAL mounted editor over the corpus
     * (`scripts/procgen/measure-apworld-raw-view.mjs`, table in `rawView.js`):
     * CM6 is viewport-virtualised, so its cost is FLAT in the document's size
     * where the textarea's is superlinear — the corpus maximum opened in 12.9 s
     * and typed at 1.25 s per keystroke on a textarea, which is why H2 needed a
     * threshold at all.
     *
     * ⛔ The extensions are `jsonEditorExtensions`', shared with the
     * `editorCodeMirror6` panel — the two raw-JSON editors in this app show the
     * same document the same way or one of them is lying about what it is.
     */
    const host = document.createElement('div');
    host.className = 'apworld-raw-editor';
    Object.assign(host.style, {
      height: '420px', border: '1px solid #444', borderRadius: '3px', overflow: 'hidden',
      fontSize: '11px',
    });
    this.scrollContainer.appendChild(host);
    this._teardownRawEditor();
    this.rawEditorView = new EditorView({
      state: EditorState.create({
        doc: this._rawDraft ?? rawViewText(this.rulesDoc),
        /**
         * ⛔ The draft is kept OUT of the record until Save. A per-keystroke op
         * would make one pasted document a thousand undos, and a per-keystroke
         * PARSE would refuse every intermediate state a person types through.
         * So the listener records only THAT something changed — it never reads
         * the text (see `_rawText`).
         */
        extensions: jsonEditorExtensions({
          keys: [{
            /**
             * ⛓ The keyboard twin of the Save JSON button. ⛔ Deferred out of
             * the keydown: saving re-renders the panel, which destroys this
             * very editor, and doing that inside CM6's own key handler
             * unmounts the DOM the event is still travelling through.
             */
            key: 'Mod-Enter',
            run: () => { setTimeout(() => this._handleRawSave(), 0); return true; },
          }],
          onDocChanged: () => { this._rawEdited = true; this._renderRawStatus(); },
        }),
      }),
      parent: host,
    });
    this._rawEdited = this._rawDraft !== null && this._rawDraft !== undefined;

    const bar = document.createElement('div');
    Object.assign(bar.style, {
      display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0 0', flexWrap: 'wrap',
    });
    /**
     * ⛓⛓ **THE APPLY-FROM-TEXT CONTROL IS CALLED "Save JSON"**, and it keeps
     * that name deliberately. ⛔ NOT "Apply": this panel's toolbar already has
     * an Apply, and it means something else entirely — publish the document to
     * the whole app. Two buttons called Apply, one writing the working copy and
     * one loading the app, would be two doors into different rooms with the
     * same sign on them. Save writes the RECORD; Apply publishes it.
     *
     * ⛔ And it is a CONTROL, not a keystroke handler: reading the text costs a
     * full-document string and parsing it a full `JSON.parse`, which at the
     * corpus maximum is 3.1 MB of each. Per key that is the wrong cost, and it
     * would refuse every intermediate state a person types through.
     */
    const save = this._makeButton('Save JSON', '#2e7d32', () => this._handleRawSave());
    save.className = 'apworld-raw-save';
    save.title = 'Parse the text and replace the whole document as ONE op '
      + '(Ctrl/Cmd+Enter inside the editor does the same). Apply, in the toolbar, '
      + 'is the separate gesture that loads the document into the app.';
    bar.appendChild(save);
    const revert = this._makeButton('Revert to the record', '#444', () => {
      this._rawDraft = null;
      this._rawEdited = false;
      this._opMessage = 'Raw text reverted to the document.';
      this._render();
    });
    revert.className = 'apworld-raw-revert';
    bar.appendChild(revert);
    const dl = this._makeButton('⭳ Download', '#33506e', () => this._handleDownload());
    dl.className = 'apworld-raw-download';
    bar.appendChild(dl);

    this.rawStatus = document.createElement('span');
    this.rawStatus.className = 'apworld-raw-status';
    Object.assign(this.rawStatus.style, { color: '#888', fontSize: '11px' });
    bar.appendChild(this.rawStatus);
    this.scrollContainer.appendChild(bar);
    this._renderRawStatus();
  }

  /**
   * ⛓ Whether the text differs from the record, said out loud.
   *
   * ⛔ The character count comes from `doc.length`, which CM6 answers in O(1)
   * off its rope. ⛔ NOT `doc.toString().length` — that is the 3 MB allocation
   * this whole design exists to keep out of the keystroke path.
   */
  _renderRawStatus() {
    if (!this.rawStatus) return;
    if (!this._rawEdited) {
      this.rawStatus.textContent = 'Unmodified.';
      this.rawStatus.style.color = '#888';
      return;
    }
    const chars = this.rawEditorView
      ? this.rawEditorView.state.doc.length
      : (this._rawDraft?.length ?? 0);
    this.rawStatus.textContent = `Edited — ${chars.toLocaleString()} characters, not saved yet.`;
    this.rawStatus.style.color = '#d6a030';
  }

  /**
   * ⛓⛓⛓ **ONE `replace-document`, AND THE SCHEMA GETS A VETO FIRST** — the
   * `set-key` veto's shape (a PREVIEW, validated whole, DIFFERENCED against the
   * errors the document already had, so an edit is never refused for somebody
   * else's dangling reference).
   *
   * ⛔ The op carries the PARSED document, never the text. An edit list whose
   * payload is a recipe that can fail to re-parse is not a record.
   */
  _handleRawSave() {
    if (!this.session) {
      alert('Load a rules.json first.');
      return;
    }
    const parsed = parseRawView(this._rawText());
    if (!parsed.ok) {
      this._opMessage = `Refused: ${parsed.error}`;
      log('warn', `raw save refused: ${parsed.error}`);
      this._renderChrome();
      return;
    }
    const op = { op: 'replace-document', document: parsed.document, player: this.playerId };
    const errors = this._schemaErrorsAddedBy(op);
    if (errors.length > 0) {
      this._opMessage = `Refused: ${errors.length} schema `
        + `error${errors.length === 1 ? '' : 's'} this edit would ADD: `
        + `${errors.slice(0, 3).join(' · ')}${errors.length > 3 ? ' · …' : ''}`;
      log('warn', `replace-document refused by the schema: ${errors.join(' | ')}`);
      this._renderChrome();
      return;
    }
    this._rawDraft = null;
    this._rawEdited = false;
    this._applyOp(op);
  }

  _makeSectionHeader(text) {
    const h = document.createElement('div');
    h.textContent = text;
    Object.assign(h.style, {
      color: '#9ab',
      fontWeight: 'bold',
      fontSize: '12px',
      margin: '14px 0 6px',
      borderBottom: '1px solid #333',
      paddingBottom: '3px',
    });
    return h;
  }

  /**
   * ⛓⛓ **`change`, NOT `input`** — and that is the one behaviour this slice
   * deliberately moved. A per-keystroke listener over a session records one op
   * PER CHARACTER, so `Vault` would be five edits and five undos; committing on
   * blur/Enter is what makes an undo undo a THING the person did. The two
   * rename fields in this panel already worked that way, so the rest now agree
   * with them rather than with each other.
   */
  _makeMetaRow(label, key, value, { description = null, parse = null } = {}) {
    if (!(key in META_FIELDS)) throw new Error(`apworldEditorUI: no META_FIELDS entry "${key}"`);
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'grid',
      gridTemplateColumns: '180px 1fr',
      gap: '8px',
      alignItems: 'center',
      padding: '3px 0',
    });
    const lbl = document.createElement('div');
    lbl.textContent = label;
    lbl.style.color = '#ccc';
    lbl.style.fontSize = '12px';
    if (description) lbl.title = description;
    row.appendChild(lbl);

    const input = this._makeTextInput(value, '100%');
    if (description) input.title = description;
    input.dataset.metaKey = key;
    input.addEventListener('change', (e) => {
      const raw = e.target.value;
      this._applyOp({
        op: 'set-meta', key, value: parse ? parse(raw) : raw, player: this.playerId,
      });
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
    row.appendChild(input);
    return row;
  }

  /**
   * ⛔ THE OLD BODY WROTE THE DOCUMENT WHILE RENDERING — it created
   * `start_regions[this.playerId]` and coerced `default` to an array before drawing
   * anything. Over a session that is a write through the folded record; the
   * reads here are pure and `set-start-region` creates what it needs.
   */
  _makeStartRegionRow() {
    const sr = this.rulesDoc?.start_regions?.[this.playerId] ?? {};
    const currentList = Array.isArray(sr.default) ? sr.default : [];

    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'grid',
      gridTemplateColumns: '180px 1fr',
      gap: '8px',
      alignItems: 'center',
      padding: '3px 0',
    });
    const lbl = document.createElement('div');
    lbl.textContent = 'Start region';
    lbl.style.color = '#ccc';
    lbl.style.fontSize = '12px';
    lbl.title = 'The region the player starts in';
    row.appendChild(lbl);

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';

    const select = document.createElement('select');
    Object.assign(select.style, {
      padding: '2px 5px',
      backgroundColor: '#111',
      color: '#ddd',
      border: '1px solid #333',
      borderRadius: '2px',
      fontSize: '12px',
      minWidth: '220px',
    });
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '(select region)';
    select.appendChild(placeholder);

    const regionNames = this._regionNames();
    const known = new Set(regionNames);
    const current = currentList[0] || '';
    if (current && !known.has(current)) {
      const missing = document.createElement('option');
      missing.value = current;
      missing.textContent = `${current} (missing)`;
      missing.style.color = '#c44';
      select.appendChild(missing);
    }
    for (const n of regionNames) {
      const o = document.createElement('option');
      o.value = n;
      o.textContent = n;
      select.appendChild(o);
    }
    select.value = current;
    select.addEventListener('change', (e) => {
      this._applyOp({ op: 'set-start-region', region: e.target.value, player: this.playerId });
    });
    wrap.appendChild(select);

    if (currentList.length > 1) {
      const note = document.createElement('span');
      note.style.color = '#c80';
      note.style.fontSize = '11px';
      note.textContent = `+${currentList.length - 1} more (edit raw JSON to manage multiple starts)`;
      wrap.appendChild(note);
    }

    row.appendChild(wrap);
    return row;
  }

  /**
   * ⛓⛓ `set-completion-condition` CARRIES THE PARSED TREE, never the text — the
   * `replace-level` rule (§15.4): an op holding raw JSON would be a recipe whose
   * parse could fail on the fold, and an edit list that cannot be re-folded is
   * not a record.
   *
   * ⛔ AND THE RAW TEXTAREA SPLITS ITS TWO JOBS. `input` keeps the live PARSE
   * FEEDBACK (the border and the tooltip) because that is DOM state and costs
   * the document nothing; `change` is where the edit is recorded. A per-keystroke
   * op here would put one edit in the list per character of a pasted condition.
   *
   * ⚠ The old body also CONSTRUCTED a default condition while rendering. That
   * read is pure now; a document with no condition shows the raw view of `{}`
   * and the first edit writes one.
   */
  _makeCompletionConditionEditor() {
    const cc = this.rulesDoc?.game_info?.[this.playerId]?.completion_condition;
    const isItemCheck = !!cc && cc.type === 'item_check';
    const shown = (cc && typeof cc === 'object' && !Array.isArray(cc)) ? cc : {};

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '6px';

    // Type dropdown: item_check / raw JSON
    const typeRow = document.createElement('div');
    Object.assign(typeRow.style, {
      display: 'grid',
      gridTemplateColumns: '180px 1fr',
      gap: '8px',
      alignItems: 'center',
    });
    const typeLbl = document.createElement('div');
    typeLbl.textContent = 'Condition type';
    typeLbl.style.color = '#ccc';
    typeLbl.style.fontSize = '12px';
    typeRow.appendChild(typeLbl);

    const typeSelect = document.createElement('select');
    Object.assign(typeSelect.style, {
      padding: '2px 5px',
      backgroundColor: '#111',
      color: '#ddd',
      border: '1px solid #333',
      borderRadius: '2px',
      fontSize: '12px',
      minWidth: '220px',
    });
    const options = [
      { value: 'item_check', label: 'Item check (wins when item is obtained)' },
      { value: '__raw__', label: '(raw JSON)' },
    ];
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      typeSelect.appendChild(opt);
    }
    typeSelect.value = isItemCheck ? 'item_check' : '__raw__';
    typeSelect.addEventListener('change', (e) => {
      const condition = e.target.value === 'item_check'
        ? { type: 'item_check', item: shown.item || 'Victory' }
        : (isItemCheck ? { type: 'constant', value: true } : shown);
      this._applyOp({ op: 'set-completion-condition', condition, player: this.playerId });
    });
    typeRow.appendChild(typeSelect);
    wrap.appendChild(typeRow);

    if (isItemCheck) {
      const itemRow = document.createElement('div');
      Object.assign(itemRow.style, {
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        gap: '8px',
        alignItems: 'center',
      });
      const itemLbl = document.createElement('div');
      itemLbl.textContent = 'Item';
      itemLbl.style.color = '#ccc';
      itemLbl.style.fontSize = '12px';
      itemRow.appendChild(itemLbl);

      const itemSelect = document.createElement('select');
      Object.assign(itemSelect.style, {
        padding: '2px 5px',
        backgroundColor: '#111',
        color: '#ddd',
        border: '1px solid #333',
        borderRadius: '2px',
        fontSize: '12px',
        minWidth: '220px',
      });
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '(select item)';
      itemSelect.appendChild(placeholder);
      const itemNames = Object.keys(this._items());
      const known = new Set(itemNames);
      if (shown.item && !known.has(shown.item)) {
        const missing = document.createElement('option');
        missing.value = shown.item;
        missing.textContent = `${shown.item} (missing)`;
        missing.style.color = '#c44';
        itemSelect.appendChild(missing);
      }
      for (const n of itemNames) {
        const o = document.createElement('option');
        o.value = n;
        o.textContent = n;
        itemSelect.appendChild(o);
      }
      itemSelect.value = shown.item || '';
      itemSelect.addEventListener('change', (e) => {
        this._applyOp({
          op: 'set-completion-condition',
          condition: { ...shown, item: e.target.value },
          player: this.playerId,
        });
      });
      itemRow.appendChild(itemSelect);
      wrap.appendChild(itemRow);
    } else {
      // Raw JSON fallback
      const rawRow = document.createElement('div');
      rawRow.style.marginTop = '4px';
      const rawLbl = document.createElement('div');
      rawLbl.textContent = 'Raw JSON';
      rawLbl.style.color = '#888';
      rawLbl.style.fontSize = '11px';
      rawLbl.style.marginBottom = '3px';
      rawRow.appendChild(rawLbl);

      const ta = document.createElement('textarea');
      Object.assign(ta.style, {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: '100px',
        fontFamily: 'monospace',
        fontSize: '12px',
        backgroundColor: '#111',
        color: '#ddd',
        border: '1px solid #333',
        borderRadius: '2px',
        padding: '4px 6px',
        resize: 'vertical',
      });
      ta.value = JSON.stringify(shown, null, 2);
      const parse = () => {
        try {
          const parsed = JSON.parse(ta.value);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('must be an object');
          }
          ta.style.borderColor = '#333';
          ta.title = '';
          return parsed;
        } catch (e) {
          ta.style.borderColor = '#c44';
          ta.title = `Parse error: ${e.message}`;
          return null;
        }
      };
      ta.addEventListener('input', parse);                     // DOM feedback only
      ta.addEventListener('change', () => {
        const condition = parse();
        if (condition) {
          this._applyOp({ op: 'set-completion-condition', condition, player: this.playerId });
        }
      });
      rawRow.appendChild(ta);
      wrap.appendChild(rawRow);
    }

    return wrap;
  }

  /**
   * ⛓⛓ **EVERY FIELD HERE NAMES AN `ITEM_FIELDS` KEY**, and `set-item-field`
   * accepts exactly that table (trap 823's cure — the row and the op read the
   * SAME one, and a test scans this file to assert the two sets are equal in
   * both directions). ⚠ The starting COUNT is not a field: it is a count of
   * entries in `starting_items`, and `set-starting-count` rewrites the list.
   */
  _renderItemRow(name, item) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'grid',
      gridTemplateColumns: '1.4fr 70px 1.1fr 80px 80px 1fr 32px',
      gap: '6px',
      padding: '4px 8px',
      alignItems: 'center',
      borderBottom: '1px solid #2a2a2a',
      backgroundColor: '#1c1c1c',
    });

    /** ⛓ ONE `set-item-field`, on `change` — never per keystroke. ⛔ The guard
     *  is the row's half of trap 823: this file cannot write a field the op
     *  would not accept, because both read `ITEM_FIELDS`. */
    const setField = (field, value) => {
      if (!(field in ITEM_FIELDS)) throw new Error(`apworldEditorUI: no ITEM_FIELDS entry "${field}"`);
      return this._applyOp({
        op: 'set-item-field', item: name, field, value, player: this.playerId,
      });
    };
    const onCommit = (input, handler) => {
      input.addEventListener('change', (e) => handler(e.target.value.trim()));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      });
    };

    // Name
    const nameInput = this._makeTextInput(name, '100%');
    nameInput.addEventListener('change', (e) => this._handleRenameItem(name, e.target.value));
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
    });
    row.appendChild(nameInput);

    // id (nullable int)
    const idInput = this._makeTextInput(item.id == null ? '' : String(item.id), '100%');
    idInput.placeholder = 'null';
    idInput.title = 'Archipelago item id (leave blank for events / auto-assign)';
    onCommit(idInput, (v) => {
      const n = parseInt(v, 10);
      setField('id', v === '' || !Number.isFinite(n) ? null : n);
    });
    row.appendChild(idInput);

    // Classification — dropdown + fallback to raw text if unknown
    row.appendChild(this._makeClassificationEditor(name, item));

    // Max count — a blank DELETES the key, as `delete item.max_count` did.
    const maxInput = this._makeTextInput(item.max_count == null ? '' : String(item.max_count), '100%');
    maxInput.placeholder = '—';
    onCommit(maxInput, (v) => {
      if (v === '') { setField('max_count', undefined); return; }
      const n = parseInt(v, 10);
      if (Number.isFinite(n)) setField('max_count', n);
    });
    row.appendChild(maxInput);

    // Itempool count — a blank DELETES the entry.
    const counts = this._itemPoolCounts();
    const poolInput = this._makeTextInput(counts[name] == null ? '' : String(counts[name]), '100%');
    poolInput.placeholder = '0';
    poolInput.title = 'Number of this item placed in the item pool';
    onCommit(poolInput, (v) => {
      if (v === '') { setField('pool_count', undefined); return; }
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n >= 0) setField('pool_count', n);
    });
    row.appendChild(poolInput);

    // ⛓ I1 — Groups: chips over the item's own membership plus a lazy picker
    //   over the slot's registry. It replaced a comma-separated TEXT INPUT, in
    //   which a typo silently created an unlisted group nobody meant.
    row.appendChild(this._makeItemGroupsCell(name, item, setField));

    // Delete
    const del = this._makeButton('×', '#8a2a2a', () => this._handleDeleteItem(name));
    del.style.padding = '2px 8px';
    row.appendChild(del);

    // Second line: starting count + event checkbox (spans full width)
    const row2 = document.createElement('div');
    Object.assign(row2.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '2px 8px 6px',
      fontSize: '11px',
      color: '#888',
      backgroundColor: '#1c1c1c',
      borderBottom: '1px solid #2a2a2a',
    });

    const startLabel = document.createElement('label');
    startLabel.style.cssText = 'display:flex;align-items:center;gap:4px;';
    startLabel.appendChild(document.createTextNode('Start:'));
    const startInput = this._makeTextInput(String(this._startingCount(name)), '50px');
    startInput.title = 'How many of this item the player starts with';
    onCommit(startInput, (v) => {
      const n = parseInt(v, 10);
      this._setStartingCount(name, Number.isFinite(n) ? n : 0);
    });
    startLabel.appendChild(startInput);
    row2.appendChild(startLabel);

    const eventLabel = document.createElement('label');
    eventLabel.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
    const eventCb = document.createElement('input');
    eventCb.type = 'checkbox';
    eventCb.checked = item.event === true;
    // ⛓ A checkbox HAS no half-typed state, so its `change` is the commit.
    //   `undefined` deletes the key, which is what `delete item.event` did.
    eventCb.addEventListener('change', () => setField('event', eventCb.checked ? true : undefined));
    eventLabel.appendChild(eventCb);
    eventLabel.appendChild(document.createTextNode('event'));
    eventLabel.title = 'Event items are internal (not placed in the pool). Typically used for Victory.';
    row2.appendChild(eventLabel);

    const wrap = document.createElement('div');
    wrap.appendChild(row);
    wrap.appendChild(row2);
    return wrap;
  }

  _makeClassificationEditor(name, item) {
    const setClassification = (value) => this._applyOp({
      op: 'set-item-field', item: name, field: 'classification', value, player: this.playerId,
    });
    const current = item.classification || 'filler';
    if (ITEM_CLASSIFICATIONS.includes(current)) {
      const select = document.createElement('select');
      Object.assign(select.style, {
        width: '100%',
        backgroundColor: '#111',
        color: '#ddd',
        border: '1px solid #333',
        borderRadius: '2px',
        padding: '2px 4px',
        fontSize: '12px',
      });
      for (const c of ITEM_CLASSIFICATIONS) {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
      }
      const otherOpt = document.createElement('option');
      otherOpt.value = '__other__';
      otherOpt.textContent = '(other…)';
      select.appendChild(otherOpt);
      select.value = current;
      select.addEventListener('change', (e) => {
        setClassification(e.target.value === '__other__' ? 'custom' : e.target.value);
      });
      return select;
    }
    // Unknown classification — show a text input so user can edit freely.
    const input = this._makeTextInput(current, '100%');
    input.title = 'Custom classification (switch to a standard one via the dropdown after refresh)';
    input.addEventListener('change', (e) => setClassification(e.target.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    });
    return input;
  }


  /**
   * ⛓⛓⛓ H4b — **THE PER-REGION Edit DOOR**. ⛓ S0 moved it from the Regions
   * header onto the region's sidecar block (`_makeRegionSidecarBlock`), which is
   * drawn under that header AND on the Sidecars tab's per-region list — one
   * button builder, so the verdict below has one home on both hosts.
   *
   * ⛔ **THREE OUTCOMES, AND "ABSENT" IS ONE OF THEM.** A classic AP region has
   * no `preset_sidecars` entry and therefore no ROOM: there is nothing to edit
   * and no reason to draw a control that says so. A region WITH a sidecar
   * always gets a button — enabled, or disabled with the reason in its `title`
   * — because "this world has a room here and you cannot open it" is a fact the
   * reader is owed.
   *
   * ⛓⛓ **THE CHEAP HALF RUNS PER RENDER, THE EXPENSIVE HALF ON THE PRESS.**
   * Whether a substrate HAS a room editor and a document round trip is two
   * registry lookups. Whether THIS region's payload actually round-trips
   * deserializes a world and re-derives its rules — measured at ~90 ms a region
   * — and a document can hold a hundred of them, so it runs when the button is
   * pressed and its answer is remembered in `_roomVerdicts`. ⇒ a refusal is
   * named either way; only WHEN it is named differs.
   *
   * @returns {HTMLElement|null} the button, or null when there is no room here
   */
  _makeRoomEditorButton(regionName) {
    const sidecar = sidecarOf(this.rulesDoc, this.playerId, regionName);
    if (!sidecar) return null;
    const substrate = sidecar.substrate ?? '(none)';
    const key = `${this.playerId}|${regionName}`;

    let why = null;
    if (!getRegionEditor(substrate)) {
      why = `No region editor for "${substrate}" yet — its registry entry declares no `
        + '`roomEditor`.';
    } else {
      const decl = regionRoundTripOf(substrate);
      if (!decl.rt) why = decl.why;
      else {
        // ⛓ S1 — a verdict counts only for the record it was asked about.
        const verdict = this._roomVerdicts.get(key);
        if (verdict && verdict.doc === this.rulesDoc) why = verdict.why;
      }
    }

    const btn = this._makeButton('Edit ▸', why ? '#3a3a3a' : '#33506e',
      () => this._handleEditRoom(regionName));
    btn.classList.add('apworld-edit-room');
    btn.dataset.substrate = substrate;
    if (why) {
      btn.disabled = true;
      btn.style.cursor = 'not-allowed';
      btn.style.color = '#999';
      btn.title = why;
    } else {
      btn.title = `Open this ${substrate} region's room in its own editor. Saving returns ONE `
        + 'edit here, which one Undo folds away.';
    }
    return btn;
  }

  /**
   * ⛓⛓ Press: run the full inspection, then open the room from the WORKING
   * COPY (⚖ *"Let's implement working copy for now"*) — `this.rulesDoc` IS
   * `session.record()`, and the op the save returns is applied to that same
   * session. Nothing here reads applied state.
   */
  async _handleEditRoom(regionName) {
    const key = `${this.playerId}|${regionName}`;
    // ⛓ S1 — captured BEFORE the await: the verdict is about this record, and
    //   an op landing while the inspection runs must not inherit it.
    const doc = this.rulesDoc;
    let inspection;
    try {
      inspection = await inspectRegionRoom(doc, this.playerId, regionName);
    } catch (err) {
      inspection = { ok: false, why: `the inspection threw — ${err.message}` };
    }
    if (!inspection.ok) {
      // ⛔ REMEMBERED, so the button now says it without being pressed again —
      //   for as long as the document is the one it was asked about.
      this._roomVerdicts.set(key, { doc, why: inspection.why });
      this._opMessage = `Edit refused: ${inspection.why}`;
      this._render();
      return;
    }
    this._closeRoomEditor();
    let handle;
    try {
      handle = await openRegionRoom(inspection, (out) => this._onRoomEdited(regionName, out));
    } catch (err) {
      this._opMessage = `Edit failed: ${err.message}`;
      this._render();
      return;
    }
    // ⛓ The LAB door answers `{ok, why, close}` synchronously; the PANEL door
    //   answers nothing (its ONE return path is `onSave`). A refusal is the
    //   door's own sentence — "no Procgen Lab panel is mounted", say — and is
    //   NOT cached: it is about the app's layout right now, not this document.
    if (handle && handle.ok === false) {
      this._opMessage = `Edit refused: ${handle.why}`;
      this._render();
      return;
    }
    this.roomEditorSession = { key, region: regionName, handle: handle ?? null };
    const frozen = inspection.frozen.length;
    this._opMessage = `Editing "${regionName}" in the ${inspection.substrate} editor. `
      + `Save there to return ONE edit here.${frozen
        ? ` ⚠ ${frozen} access rule${frozen === 1 ? '' : 's'} here cannot be re-derived from `
          + 'the room and will be left exactly as they are.'
        : ''}`;
    this._render();
  }

  /**
   * ⛓ The save, arriving as `{op, moved}` or `{error}` — the linked editors'
   * single return path, wrapped in the hub's single op.
   */
  _onRoomEdited(regionName, out) {
    this.roomEditorSession = null;
    if (out.error) {
      this._opMessage = `Save refused: ${out.error}`;
      log('warn', `room save refused: ${out.error}`);
      alert(out.error);
      this._render();
      return;
    }
    this._applyOp(out.op, {
      message: (res) => `${res.description}${out.moved
        ? ` — ${out.moved} access rule${out.moved === 1 ? '' : 's'} re-derived`
        : ' — no access rule moved'}`,
    });
  }

  /** ⛓ Give up on the parked room. ⛔ Its `onSave` never fires afterwards. */
  _closeRoomEditor() {
    try {
      this.roomEditorSession?.handle?.close?.();
    } catch (_) { /* the other panel may be mid-teardown */ }
    this.roomEditorSession = null;
  }

  /**
   * ⛓⛓⛓ **S0 — ONE REGION'S SIDECAR ENTRY, DRAWN BY ONE FUNCTION FOR TWO
   * HOSTS** (⚖ user, 2026-09-10, Q2 A: *"one renderer, two hosts"* — the
   * Regions tab under each region, and the Sidecars tab's per-region list).
   * Two renderers for one key would be two vocabularies for one document,
   * and they would agree only until one of them was changed (S1/R1's rule).
   *
   * What it draws, every word of it read off the ENTRY (`sidecarEntryFacts`)
   * and never off a table keyed by substrate name (⚖ standing):
   *
   *   · the substrate BADGE — `entry.substrate`, what the play-time host
   *     actually loads the room with;
   *   · the entry-level facts — grid cell, the render hint when it differs,
   *     the biome, the payload's top-level keys and its pretty size;
   *   · the two roads (plan §9.2): **Edit ▸**, H4b's in-place door, built by
   *     `_makeRoomEditorButton` so its verdict logic has one home, and
   *     **Regenerate in the pipeline ▸**, the `procgen_metadata` door's own
   *     `open` pressed through the one opener, with the regeneration COST in
   *     its title;
   *   · **▸ Show JSON** — the ENTRY, through `_makeJsonBlock`, built only on
   *     expand. ⛓ PRESET SIDECARS S1: editable when the HOST passes `onSave`,
   *     and read-only otherwise — the widget's own default, so a host that
   *     passes nothing cannot make the entry writable by accident. Both hosts
   *     pass one (⚖ Q2 A: one renderer, editable wherever it is drawn), and the
   *     answer to the save is printed under the block that was saved.
   *
   * ⛔ Every save — from either host — is the SAME `_saveRegionSidecar`, one
   *   `set-region-sidecar` op; `onSave` is how a host opts in, not a second
   *   save path.
   *
   * ⛔ The block is drawn for the SELECTED slot. `player` is the slot the
   *   entry is READ from, and each host passes `this.playerId`; the Edit door
   *   inside it reads the selected slot too, because the op its save returns
   *   is stamped with that slot (`_stampPlayer`) — a block for another slot
   *   would offer a door into a room the save could not land in.
   *
   * @param {string} player
   * @param {string} regionName
   * @param {{hostTab: string, onSave?: Function|null}} opts `hostTab` — the tab
   *   drawing it, the key its JSON disclosure is remembered under, so each
   *   host's is its own; `onSave` — `(entry) → void`, the host's opt-in to an
   *   editable entry (null = read-only)
   * @returns {HTMLElement|null} null when the region has no sidecar entry
   */
  _makeRegionSidecarBlock(player, regionName, { hostTab, onSave = null }) {
    const entry = sidecarOf(this.rulesDoc, player, regionName);
    const facts = sidecarEntryFacts(entry);
    if (!facts) return null;

    const box = document.createElement('div');
    box.className = 'apworld-sidecar-block';
    box.dataset.regionName = regionName;
    box.dataset.player = String(player);
    box.dataset.hostTab = hostTab;
    Object.assign(box.style, {
      padding: '5px 8px', borderBottom: '1px solid #333', backgroundColor: '#20232a',
      fontSize: '11px',
    });

    const line = document.createElement('div');
    Object.assign(line.style, { display: 'flex', alignItems: 'center', gap: '8px',
      flexWrap: 'wrap' });
    const badge = document.createElement('span');
    badge.className = 'apworld-sidecar-badge';
    badge.textContent = facts.substrate ?? '(no substrate)';
    badge.title = 'This region\'s sidecar entry: the substrate the play-time host loads its '
      + 'room with (`preset_sidecars.<slot>.<region>.substrate`).';
    Object.assign(badge.style, {
      padding: '1px 7px', borderRadius: '9px', border: '1px solid #4a6a8a',
      backgroundColor: '#1d3347', color: '#cfe', fontFamily: 'monospace',
    });
    line.appendChild(badge);

    const bits = [];
    if (facts.gridCell) bits.push(`cell (${facts.gridCell.gx}, ${facts.gridCell.gy})`);
    if (facts.renderHint) bits.push(`render hint ${facts.renderHint}`);
    if (facts.biome) bits.push(`biome ${facts.biome}`);
    bits.push(facts.payloadKeys.length
      ? `payload ${facts.payloadKeys.join(', ')} · ${facts.payloadBytes.toLocaleString()} B`
      : 'payload (empty)');
    const text = document.createElement('span');
    text.className = 'apworld-sidecar-facts';
    text.textContent = bits.join(' · ');
    Object.assign(text.style, { color: '#999', flex: '1 1 20em', minWidth: 0 });
    line.appendChild(text);

    const edit = this._makeRoomEditorButton(regionName);
    if (edit) line.appendChild(edit);

    /**
     * ⛓ The hand-off door. ⛔ Its words are the DOOR's (`regionDoor` on the
     *   registry entry), and its press is the one opener every other door of
     *   this panel goes through — so the panel-refusal, the document token and
     *   the status line are the Document row's, not a second copy.
     */
    const pipeline = DOCUMENT_KEY_EDITORS.procgen_metadata;
    if (pipeline?.regionDoor) {
      const refusal = this._panelRefusal(pipeline.panelId);
      const regen = this._makeButton(pipeline.regionDoor.label, refusal ? '#444' : '#3a3a3a',
        () => this._openDocumentKeyEditor('procgen_metadata'));
      regen.className = 'apworld-sidecar-regenerate';
      regen.style.fontSize = '11px';
      regen.disabled = !!refusal;
      regen.style.opacity = refusal ? '0.45' : '1';
      regen.title = refusal ?? pipeline.regionDoor.note;
      line.appendChild(regen);
    }
    box.appendChild(line);

    /**
     * ⛓⛓ PRESET SIDECARS V0 — **WHAT IS WRONG WITH THIS ENTRY, UNDER ITS FACTS**:
     * a sentence each, coloured by severity, NOTHING when clean. The same
     * `sidecarIssues` list the bar counts (this block reads it directly, not
     * through the bar). ⛔ Errors block nothing — the raw save is not vetoed by
     * them (⚖ user, 2026-09-10: the reader owns the repair); this is where the
     * reader is told what to repair.
     */
    const issues = (String(player) === String(this.playerId)
      ? this._sidecarIssues() : sidecarIssues(this.rulesDoc, player))
      .filter((i) => i.region === regionName);
    box.dataset.sidecarIssues = String(issues.length);
    if (issues.length) {
      const list = document.createElement('div');
      list.className = 'apworld-sidecar-issues';
      Object.assign(list.style, { margin: '4px 0 0', lineHeight: '1.4' });
      for (const i of issues) {
        const row = document.createElement('div');
        row.className = 'apworld-sidecar-issue';
        row.dataset.kind = i.kind;
        row.dataset.severity = i.severity;
        if (i.field) row.dataset.field = i.field;
        const error = i.severity === 'error';
        row.textContent = `${error ? '⛔' : '⚠'} ${i.message}`;
        Object.assign(row.style, { color: error ? '#e8a095' : '#d6a030' });
        list.appendChild(row);
      }
      box.appendChild(list);
    }

    const key = `${hostTab}|${player}|${regionName}`;
    box.appendChild(this._makeJsonBlock({
      classPrefix: 'apworld-sidecar',
      dataset: { regionName, player: String(player) },
      name: `preset_sidecars.${player}.${regionName}`,
      expanded: this._expandedSidecarJson.has(key),
      onToggle: () => {
        if (this._expandedSidecarJson.has(key)) this._expandedSidecarJson.delete(key);
        else this._expandedSidecarJson.add(key);
        this._render();
      },
      // ⛔ Re-read at expand, never the `entry` above held across renders: the
      //   tab re-renders on every op, so this is the entry the document holds NOW.
      value: () => sidecarOf(this.rulesDoc, player, regionName),
      sizeLabel: `the whole entry of ${regionName} (slot ${player})`,
      onSave,
    }));
    /**
     * ⛓ S1 — the answer to this block's own save, drawn under it (the Document
     * row's `apworld-doc-op-message` precedent): the op's description when it
     * landed — which says what was NOT re-derived — or the refusal, by name.
     * Keyed by slot and region, so it follows the entry to the other host.
     */
    const said = this._opRowMessage;
    if (said && said.sidecar === `${player}|${regionName}`) {
      const msg = document.createElement('div');
      msg.className = 'apworld-sidecar-op-message';
      msg.dataset.refused = said.refused ? 'true' : 'false';
      msg.textContent = said.text;
      Object.assign(msg.style, {
        color: said.refused ? '#f0a0a0' : '#8fd18f', fontSize: '11px', margin: '5px 0 0',
        padding: '3px 6px', borderRadius: '3px',
        border: `1px solid ${said.refused ? '#6a2e2e' : '#2e5f2e'}`,
        backgroundColor: said.refused ? '#2a1818' : '#182218',
      });
      box.appendChild(msg);
    }
    return box;
  }

  _renderRegion(regionName, region) {
    const block = document.createElement('div');
    /**
     * ⛓ H3 — the region block is ADDRESSABLE by name, which is what
     * `selectRegion` scrolls to and what a headless row asserts on. The
     * highlight is the same colour the map outlines the cell with, so the two
     * surfaces agree about which region is selected.
     */
    block.className = 'apworld-region-block';
    block.dataset.regionName = regionName;
    const selected = this._selectedRegion === regionName;
    if (selected) block.dataset.selected = 'true';
    Object.assign(block.style, {
      border: selected ? '1px solid #ffd24a' : '1px solid #333',
      borderRadius: '4px',
      marginBottom: '10px',
      backgroundColor: selected ? '#2b2a20' : '#242424',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 8px',
      backgroundColor: '#2e2e2e',
      borderBottom: '1px solid #333',
    });

    const caret = document.createElement('span');
    caret.textContent = '▼';
    caret.style.color = '#aaa';
    header.appendChild(caret);

    const nameInput = this._makeTextInput(regionName, '220px');
    nameInput.title = 'Region name (press Enter or blur to rename)';
    nameInput.addEventListener('change', (e) => this._handleRenameRegion(regionName, e.target.value));
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
    });
    header.appendChild(nameInput);

    const spacer = document.createElement('span');
    spacer.style.flex = '1 1 auto';
    header.appendChild(spacer);

    const delBtn = this._makeButton('× Delete', '#8a2a2a', () => this._handleDeleteRegion(regionName));
    header.appendChild(delBtn);

    block.appendChild(header);

    /**
     * ⛓⛓ S0 — **THE REGION'S SIDECAR, UNDER ITS HEADER.** H4b drew Edit ▸ in
     * the header and nothing else about the room; the block carries it now,
     * beside the substrate and the entry's facts, so the button is drawn ONCE
     * per region either way (measured before/after: 1 per sidecar region, 0 on
     * a region with none). ABSENT for a region with no sidecar — a classic AP
     * region has no room, and the block says nothing rather than "none".
     */
    const sidecarBlock = this._makeRegionSidecarBlock(this.playerId, regionName, {
      hostTab: 'regions',
      onSave: (entry) => this._saveRegionSidecar(this.playerId, regionName, entry),
    });
    if (sidecarBlock) block.appendChild(sidecarBlock);

    const body = document.createElement('div');
    body.style.padding = '6px 12px 10px';
    block.appendChild(body);

    body.appendChild(this._renderExitsSection(regionName, region));
    body.appendChild(this._renderLocationsSection(regionName, region));

    return block;
  }

  _renderExitsSection(regionName, region) {
    const section = document.createElement('div');
    section.style.marginTop = '6px';

    const heading = document.createElement('div');
    heading.textContent = 'Exits:';
    heading.style.color = '#9ab';
    heading.style.fontWeight = 'bold';
    heading.style.margin = '4px 0';
    section.appendChild(heading);

    const exits = region.exits || [];
    exits.forEach((exitData, idx) => {
      section.appendChild(this._renderExitRow(regionName, idx, exitData));
    });

    const addBtn = this._makeButton('+ Add exit', '#3a3a3a', () => this._handleAddExit(regionName));
    addBtn.style.marginTop = '4px';
    section.appendChild(addBtn);

    return section;
  }

  _renderExitRow(regionName, index, exitData) {
    /** ⛓ The exit row's half of trap 823 — same table, same guard. */
    const setExitField = (field, value) => {
      if (!EXIT_FIELDS.includes(field)) {
        throw new Error(`apworldEditorUI: no EXIT_FIELDS entry "${field}"`);
      }
      return this._applyOp({
        op: 'set-exit-field', region: regionName, index, field, value, player: this.playerId,
      });
    };
    const row = document.createElement('div');
    Object.assign(row.style, {
      marginBottom: '4px',
      padding: '4px 6px',
      backgroundColor: '#1c1c1c',
      border: '1px solid #2c2c2c',
      borderRadius: '3px',
    });

    const topLine = document.createElement('div');
    Object.assign(topLine.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });

    const nameInput = this._makeTextInput(exitData.name || '', '220px');
    nameInput.title = 'Exit name (press Enter or blur to commit)';
    // ⛓ `change`, not `input`: one op per NAME, not one per keystroke.
    nameInput.addEventListener('change', (e) => setExitField('name', e.target.value));
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
    });
    topLine.appendChild(nameInput);

    const arrow = document.createElement('span');
    arrow.textContent = '→';
    arrow.style.color = '#aaa';
    topLine.appendChild(arrow);

    const destSelect = this._makeRegionSelect(exitData.connected_region || '');
    destSelect.addEventListener('change', (e) => setExitField('connected_region', e.target.value));
    topLine.appendChild(destSelect);

    const spacer = document.createElement('span');
    spacer.style.flex = '1 1 auto';
    topLine.appendChild(spacer);

    const delBtn = this._makeButton('×', '#8a2a2a', () => this._handleDeleteExit(regionName, index));
    delBtn.title = 'Delete exit';
    topLine.appendChild(delBtn);

    row.appendChild(topLine);
    row.appendChild(this._renderAccessRuleEditor(exitData, { region: regionName, kind: 'exit', index }));
    return row;
  }

  _renderLocationsSection(regionName, region) {
    const section = document.createElement('div');
    section.style.marginTop = '10px';

    const heading = document.createElement('div');
    heading.textContent = 'Locations:';
    heading.style.color = '#9ab';
    heading.style.fontWeight = 'bold';
    heading.style.margin = '4px 0';
    section.appendChild(heading);

    const locations = region.locations || [];
    locations.forEach((locData, idx) => {
      section.appendChild(this._renderLocationRow(regionName, idx, locData));
    });

    const addBtn = this._makeButton('+ Add location', '#3a3a3a', () => this._handleAddLocation(regionName));
    addBtn.style.marginTop = '4px';
    section.appendChild(addBtn);

    return section;
  }

  _renderLocationRow(regionName, index, locData) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      marginBottom: '4px',
      padding: '4px 6px',
      backgroundColor: '#1c1c1c',
      border: '1px solid #2c2c2c',
      borderRadius: '3px',
    });

    const topLine = document.createElement('div');
    Object.assign(topLine.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });

    const nameInput = this._makeTextInput(locData.name || '', '260px');
    nameInput.title = 'Location name (press Enter or blur to commit — triggers CanReachLocation cascade)';
    nameInput.addEventListener('change', (e) => this._handleRenameLocation(regionName, index, e.target.value));
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
    });
    topLine.appendChild(nameInput);

    const spacer = document.createElement('span');
    spacer.style.flex = '1 1 auto';
    topLine.appendChild(spacer);

    const delBtn = this._makeButton('×', '#8a2a2a', () => this._handleDeleteLocation(regionName, index));
    delBtn.title = 'Delete location';
    topLine.appendChild(delBtn);

    row.appendChild(topLine);
    row.appendChild(this._renderAccessRuleEditor(locData, { region: regionName, kind: 'location', index }));
    return row;
  }

  /**
   * ⛓⛓⛓ **THE TREE EDITOR EDITS A DETACHED WORKING COPY, AND THE PANEL RECORDS
   * WHAT COMES OUT.**
   *
   * ⛔ THE MEASUREMENT BEHIND THIS SHAPE. `RuleTreeEditor` has TWO write paths,
   * not one: `_applyTreeOp` (the four `ruleTreeOps` gestures — replace, remove,
   * wrap, add-child) AND about a dozen FIELD editors that write into a node it
   * is already holding (`args.item_name = v`, `node.count = n`, the raw-JSON
   * `Object.assign(node, parsed)`), deliberately in place and with no re-render
   * so typing does not cost one. Handing it the LIVE node would mean every one
   * of those bypassed the session — one op recorded for the gesture and nothing
   * at all for the twelve.
   *
   * ⇒ It is handed a HOLDER over a clone. Both write paths land on the clone,
   * and the panel commits `set-rule-tree` carrying the RESULT at the two moments
   * a rule can have finished changing:
   *
   *   · `onTree` — a gesture, which the editor performs and then re-renders;
   *   · a bubbling `change`, in CAPTURE with the commit deferred to a microtask,
   *     so it runs AFTER the field editor's own handler has written the clone and
   *     regardless of whether that handler re-rendered the target out of the DOM.
   *
   * ⚠ `rerender: false`: the tree editor owns its own DOM and has already
   * redrawn it, so the panel refreshes only its CHROME. Rebuilding the whole
   * scroll container under a person's cursor mid-rule would be a re-render they
   * did not ask for — and it would drop the editor's per-node raw-view state.
   */
  _renderAccessRuleEditor(node, path) {
    const wrap = document.createElement('div');
    wrap.style.marginTop = '4px';
    // ⛓ The commit seam, ADDRESSABLE. A gate that has to find "the rule editor
    //   for this exit" by walking text is a gate that passes on the wrong node
    //   the day a label moves — measured, in this slice's first browser run.
    wrap.classList.add('apworld-rule');
    wrap.dataset.rulePath = JSON.stringify(path);

    const label = document.createElement('div');
    label.textContent = 'access rule:';
    label.style.color = '#888';
    label.style.fontSize = '11px';
    label.style.marginBottom = '2px';
    wrap.appendChild(label);

    const holder = {
      access_rule: cloneFullRulesDoc(node.access_rule ?? { rule: 'True_' }),
    };
    const commit = () => this._applyOp({
      op: 'set-rule-tree', path, tree: holder.access_rule, player: this.playerId,
    }, { rerender: false });

    const tree = new RuleTreeEditor(holder, 'access_rule', {
      getItemNames: () => this._allItemNames(),
      getRegionNames: () => this._regionNames(),
      getLocationNames: () => this._allLocationNames(),
      onTree: commit,
    });
    wrap.appendChild(tree.getRootElement());
    wrap.addEventListener('change', () => queueMicrotask(commit), true);
    return wrap;
  }

  _allItemNames() {
    if (!this.rulesDoc) return [];
    const items = (this.rulesDoc.items && this.rulesDoc.items[this.playerId]) || {};
    return Object.keys(items);
  }

  _allLocationNames() {
    const regions = this._regions();
    const names = [];
    for (const r of Object.values(regions)) {
      for (const loc of r.locations || []) {
        if (loc && loc.name) names.push(loc.name);
      }
    }
    return names;
  }

  _makeTextInput(value, width) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    Object.assign(input.style, {
      width,
      padding: '2px 5px',
      backgroundColor: '#111',
      color: '#ddd',
      border: '1px solid #333',
      borderRadius: '2px',
      fontSize: '12px',
      boxSizing: 'border-box',
    });
    return input;
  }

  _makeRegionSelect(currentValue) {
    const select = document.createElement('select');
    Object.assign(select.style, {
      padding: '2px 5px',
      backgroundColor: '#111',
      color: '#ddd',
      border: '1px solid #333',
      borderRadius: '2px',
      fontSize: '12px',
      minWidth: '180px',
    });

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '(select destination)';
    select.appendChild(placeholder);

    const names = this._regionNames();
    // If current value points to a region that no longer exists, keep it so the
    // dangling reference is visible.
    const allOptions = new Set(names);
    if (currentValue && !allOptions.has(currentValue)) {
      const dangling = document.createElement('option');
      dangling.value = currentValue;
      dangling.textContent = `${currentValue} (missing)`;
      dangling.style.color = '#c44';
      select.appendChild(dangling);
    }
    for (const name of names) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    }
    select.value = currentValue;
    return select;
  }
}

export default ApworldEditorUI;
