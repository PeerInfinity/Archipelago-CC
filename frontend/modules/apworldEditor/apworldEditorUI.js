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

import { getModuleEventBus, APWORLD_EDITOR_LOAD_RULES, consumePendingEditorRules } from './index.js';
import { stateManagerProxySingleton as stateManager, getLastRawJsonData } from '../stateManager/index.js';
import RuleTreeEditor from './ruleTreeEditor.js';
import { validateRules, cloneFullRulesDoc } from './rulesUtils.js';
import { createEditSession, describeOps, group, isGroup } from '../procgenCore/editCore.js';
import { rulesEditAdapter } from './rulesEditAdapter.js';
import {
  EXIT_FIELDS,
  ITEM_FIELDS,
  META_FIELDS,
  deleteItemOps,
  deleteRegionOps,
} from './rulesDocOps.js';
import { DEFAULT_PLAYER_ID } from '../shared/playerIdUtils.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { getRegionEditor } from '../procgenPipeline/regionEditors.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { applyRulesDocOp } from './rulesDocOps.js';
import {
  buildDocumentKeys,
  defaultPlayerOf,
  documentKeyRows,
  playerSlotsOf,
} from './documentKeys.js';
import { buildLinkRows } from './documentLinks.js';

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
 */

const TABS = [
  { id: 'regions', label: 'Regions' },
  { id: 'items', label: 'Items' },
  { id: 'meta', label: 'Meta' },
  { id: 'document', label: 'Document' },
  { id: 'links', label: 'Links' },
];

/** ⛓ Where the page fetches the schema the Document tab is DERIVED from. */
const RULES_SCHEMA_URL = './schema/rules.schema.json';

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
    this.rawJsonUnsubscribe = null;
    this.loadRulesUnsubscribe = null;
    this.pendingApply = false;
    this.activeTab = 'regions';

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
      if (this.pendingApply && eventData.source === APPLY_SOURCE) {
        this.pendingApply = false;
        log('info', 'Ignoring our own apply round-trip.');
        return;
      }
      // Full-doc clone preserves non-standard top-level keys (procgen_metadata
      // etc.) the editor doesn't edit — see cloneFullRulesDoc's contract.
      this._openSession(eventData.rawJsonData, {
        kind: 'rules', source: eventData.source ?? 'app-load', player: this.playerId,
      });
    });

    // Direct hand-off channel (§2.2): procgen's "Edit in APWorld Editor" routes
    // a world here without a global files:jsonLoaded, so the substrate panels
    // don't auto-activate and steal focus. Adopt immediately when we're already
    // open; the consume() also clears any stash so it can't go stale.
    this.loadRulesUnsubscribe = this.eventBus.subscribe(APWORLD_EDITOR_LOAD_RULES, (ev) => {
      if (ev && ev.jsonData) this._adoptHandoffRules(ev.jsonData);
      consumePendingEditorRules();
    });

    // If rules were loaded before the panel opened, pick them up now: first a
    // hand-off stashed by the load-rules channel, else the app-wide cache.
    const pending = consumePendingEditorRules();
    if (pending) {
      this._adoptHandoffRules(pending);
    } else if (!this.session) {
      const current = this._getCurrentAppRules();
      if (current) {
        this._openSession(current, { kind: 'rules', source: 'app-cache', player: this.playerId });
      }
    }

    this.isInitialized = true;
    this._loadRulesSchema();

    log('info', 'ApworldEditorUI initialized.');
  }

  // Adopt a world handed directly to the editor (load-rules channel). Same
  // full-doc clone the global load path uses, so procgen_metadata is preserved.
  _adoptHandoffRules(jsonData) {
    this._openSession(jsonData, { kind: 'rules', source: 'hand-off', player: this.playerId });
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

  /** ⛓ UNDO — the fold over a shorter list, never a stack pop. */
  _undo() {
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

    this.applyButton = this._makeButton('Apply', '#2e7d32', () => this._handleApply());
    this.applyButton.title = 'Publish edits as a fresh rules reload';
    toolbar.appendChild(this.applyButton);

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
    if (!current) {
      alert('No rules data is currently loaded in the app.');
      return;
    }
    if (!confirm('Discard your edits and reload the rules data the rest of the app currently has loaded?')) return;
    this._opMessage = null;
    this._openSession(current, { kind: 'rules', source: 'reload', player: this.playerId });
    log('info', 'Reloaded rules from the app\'s last published rules.json.');
  }

  _getCurrentAppRules() {
    // Last rules.json the app published (covers any load, not just the
    // startup one). The G_combinedModeData global is the legacy
    // fallback — it only reflects the startup load and goes stale
    // after preset switches.
    const last = getLastRawJsonData()?.rawJsonData;
    if (last) return last;
    return (typeof window !== 'undefined'
      && window.G_combinedModeData
      && window.G_combinedModeData.rulesConfig) || null;
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
   * (`pendingApply` + `APPLY_SOURCE`), which is what stops its own Apply from
   * opening a boundary that would discard the very edits it just published.
   */
  _handleApply() {
    if (!this.rulesDoc) {
      this._flashButton(this.applyButton, false);
      return;
    }
    try {
      this.pendingApply = true;
      // Emit a full-doc clone so preserved keys (procgen_metadata etc.) survive
      // the apply round-trip alongside the edited regions/items/rules.
      this.eventBus.publish('files:jsonLoaded', {
        jsonData: cloneFullRulesDoc(this.rulesDoc),
        selectedPlayerId: this.playerId,
        sourceName: APPLY_SOURCE,
      });
      this._flashButton(this.applyButton, true);
      log('info', 'Published files:jsonLoaded from APWorld Editor.');
    } catch (err) {
      this.pendingApply = false;
      log('error', 'Apply failed:', err);
      this._flashButton(this.applyButton, false);
    }
  }

  // ---------- Rendering ----------

  _render() {
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
    } else if (this.activeTab === 'meta') {
      this._renderMetaTab();
    } else if (this.activeTab === 'document') {
      this._renderDocumentTab();
    } else if (this.activeTab === 'links') {
      this._renderLinksTab();
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
    } else if (this.activeTab === 'meta') {
      summary = `${gameName} — metadata`;
    } else if (this.activeTab === 'document') {
      const n = this._documentRows().length;
      summary = `${gameName} — ${n} top-level key${n === 1 ? '' : 's'}`;
    } else if (this.activeTab === 'links') {
      const n = buildLinkRows(substrateRegistry).length;
      summary = `${gameName} — ${n} editor link${n === 1 ? '' : 's'}`;
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

  _renderValidationBar() {
    this.validationBar.innerHTML = '';
    if (!this.rulesDoc) return;

    const issues = validateRules(this.rulesDoc, this.playerId);
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warnCount = issues.length - errorCount;

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
        Object.assign(row.style, {
          display: 'flex',
          gap: '6px',
          padding: '2px 0',
          color: '#ccc',
          fontSize: '11px',
          cursor: issue.tab && issue.tab !== this.activeTab ? 'pointer' : 'default',
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
          if (issue.tab !== this.activeTab) {
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
    for (const row of rows) this.scrollContainer.appendChild(this._renderDocumentRow(row));
  }

  /** ⛓ ONE key: what it is, who writes it, what it holds, and how to change it. */
  _renderDocumentRow(row) {
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

    if (row.ownedByTab) {
      box.appendChild(this._makeOwnedByTabLine(row));
      return box;
    }
    box.appendChild(this._makeDocumentValueEditor(row));
    return box;
  }

  /**
   * ⛓ A key another tab already edits gets a POINTER, not a second editor. ⛔ Two
   * editors over one key is two places a person can change it and one of them
   * will be the stale one — and the tab that owns it knows the shape (a region
   * map is not a JSON blob to its own editor).
   */
  _makeOwnedByTabLine(row) {
    const line = document.createElement('div');
    Object.assign(line.style, {
      display: 'flex', alignItems: 'center', gap: '6px', margin: '5px 0 0',
      color: '#8a8', fontSize: '11px',
    });
    const tab = TABS.find((t) => t.id === row.ownedByTab);
    line.appendChild(document.createTextNode(`Edited in the ${tab ? tab.label : row.ownedByTab} tab.`));
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
    if (row.summary.kind === 'object' || row.summary.kind === 'array') {
      wrap.appendChild(this._makeDocumentBlockEditor(row));
      return wrap;
    }
    wrap.appendChild(this._makeDocumentScalarEditor(row));
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
    const wrap = document.createElement('div');
    const expanded = this._expandedKeys.has(row.key);

    const toggle = this._makeButton(expanded ? '▾ Hide JSON' : '▸ Show JSON', '#3a3a3a', () => {
      if (this._expandedKeys.has(row.key)) this._expandedKeys.delete(row.key);
      else this._expandedKeys.add(row.key);
      this._render();
    });
    toggle.style.fontSize = '11px';
    toggle.className = 'apworld-doc-toggle';
    wrap.appendChild(toggle);
    if (!expanded) return wrap;

    const text = document.createElement('textarea');
    text.className = 'apworld-doc-json';
    text.value = JSON.stringify(row.value, null, 2);
    Object.assign(text.style, {
      width: '100%', minHeight: '160px', marginTop: '5px', boxSizing: 'border-box',
      backgroundColor: '#111', color: '#ddd', border: '1px solid #444', borderRadius: '3px',
      fontFamily: 'monospace', fontSize: '11px',
    });
    wrap.appendChild(text);

    const size = document.createElement('div');
    size.style.color = '#777';
    size.style.fontSize = '10px';
    size.textContent = `${row.summary.inline} · ${text.value.length.toLocaleString()} characters `
      + 'of pretty-printed JSON';
    wrap.appendChild(size);

    const save = this._makeButton('Save JSON', '#2e7d32', () => {
      let parsed;
      try {
        parsed = JSON.parse(text.value);
      } catch (err) {
        this._opMessage = `Refused: \`${row.key}\` — ${err.message}. ⛔ The op carries the `
          + 'PARSED value, never the text: an edit list whose payload is a recipe that can '
          + 'fail to re-parse is not a record.';
        this._renderChrome();
        return;
      }
      this._applySetKey(row, parsed);
    });
    save.style.marginTop = '4px';
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
    const errors = this._schemaErrorsAddedBy(op);
    if (errors.length > 0) {
      this._opMessage = `Refused: \`${row.key}\` — ${errors.length} schema `
        + `error${errors.length === 1 ? '' : 's'}: ${errors.slice(0, 3).join(' · ')}`
        + `${errors.length > 3 ? ' · …' : ''}`;
      log('warn', `set-key refused by the schema: ${errors.join(' | ')}`);
      this._renderChrome();
      return;
    }
    this._applyOp(op);
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
    const open = this._makeButton('Open', row.target ? '#2e5f8a' : '#444',
      () => this._openLink(row));
    open.className = 'apworld-link-open';
    open.style.marginLeft = 'auto';
    open.disabled = !row.target;
    open.style.opacity = row.target ? '1' : '0.45';
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
      this.eventBus.publish('ui:activatePanel', { panelId: target.panelId });
      this._opMessage = `Opened ${row.label} (${target.panelId}). ⚠ Nothing happens if that `
        + 'panel is not in the current layout.';
      this._renderChrome();
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

    // Groups (comma-separated)
    const groupsInput = this._makeTextInput(
      Array.isArray(item.groups) ? item.groups.join(', ') : '',
      '100%',
    );
    groupsInput.placeholder = 'comma-separated';
    groupsInput.addEventListener('change', (e) => setField('groups', e.target.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)));
    row.appendChild(groupsInput);

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


  _renderRegion(regionName, region) {
    const block = document.createElement('div');
    Object.assign(block.style, {
      border: '1px solid #333',
      borderRadius: '4px',
      marginBottom: '10px',
      backgroundColor: '#242424',
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
