/**
 * APWorld Editor UI
 *
 * GUI CRUD over rules.json — regions, exits, locations, access rules.
 * Mutates an in-memory copy of the rules doc and publishes files:jsonLoaded
 * on Apply (same pathway the Editor module uses).
 *
 * v1: single-player only (slot "1"). Rules are authored in Rule Builder
 * format. Access rules are edited as raw JSON (placeholder until the
 * tree editor lands).
 */

import { getModuleEventBus, APWORLD_EDITOR_LOAD_RULES, consumePendingEditorRules } from './index.js';
import { stateManagerProxySingleton as stateManager, getLastRawJsonData } from '../stateManager/index.js';
import RuleTreeEditor from './ruleTreeEditor.js';
import {
  validateRules,
  renameItemInRules,
  renameRegionInRules,
  renameLocationInRules,
  cloneFullRulesDoc,
} from './rulesUtils.js';
import { DEFAULT_PLAYER_ID } from '../shared/playerIdUtils.js';
import { makeExit, makeTrueRule } from '../shared/rulesJsonBuilder.js';

const RAW_JSON_LOADED = 'stateManager:rawJsonDataLoaded';
const APP_READY = 'app:readyForUiDataLoad';
const APPLY_SOURCE = 'apworldEditorApply';
// ⛓ Was a module-local `= '1'` — one of the three duplicates of
// shared/playerIdUtils' DEFAULT_PLAYER_ID (§15 D12). The other two are inside
// the `shared/` SUBMODULE and are not this slice's to delete.
const PLAYER_ID = DEFAULT_PLAYER_ID;

const TABS = [
  { id: 'regions', label: 'Regions' },
  { id: 'items', label: 'Items' },
  { id: 'meta', label: 'Meta' },
];

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

    this.rulesDoc = null;
    this.isInitialized = false;
    this.rawJsonUnsubscribe = null;
    this.loadRulesUnsubscribe = null;
    this.pendingApply = false;
    this.activeTab = 'regions';

    this.rootElement = document.createElement('div');
    this.rootElement.classList.add('apworld-editor-panel');
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
      this.rulesDoc = cloneFullRulesDoc(eventData.rawJsonData);
      this._render();
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
    } else if (!this.rulesDoc) {
      const current = this._getCurrentAppRules();
      if (current) {
        this.rulesDoc = cloneFullRulesDoc(current);
        this._render();
      }
    }

    this.isInitialized = true;
    log('info', 'ApworldEditorUI initialized.');
  }

  // Adopt a world handed directly to the editor (load-rules channel). Same
  // full-doc clone the global load path uses, so procgen_metadata is preserved.
  _adoptHandoffRules(jsonData) {
    this.rulesDoc = cloneFullRulesDoc(jsonData);
    this._render();
  }

  onPanelDestroy() {
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

  // ---------- Accessors on the in-memory doc ----------

  _regions() {
    if (!this.rulesDoc) return {};
    const all = this.rulesDoc.regions || (this.rulesDoc.regions = {});
    return all[PLAYER_ID] || (all[PLAYER_ID] = {});
  }

  _regionNames() {
    return Object.keys(this._regions());
  }

  _items() {
    if (!this.rulesDoc) return {};
    const all = this.rulesDoc.items || (this.rulesDoc.items = {});
    return all[PLAYER_ID] || (all[PLAYER_ID] = {});
  }

  _itemPoolCounts() {
    if (!this.rulesDoc) return {};
    const all = this.rulesDoc.itempool_counts || (this.rulesDoc.itempool_counts = {});
    return all[PLAYER_ID] || (all[PLAYER_ID] = {});
  }

  _startingItems() {
    if (!this.rulesDoc) return [];
    const all = this.rulesDoc.starting_items || (this.rulesDoc.starting_items = {});
    if (!Array.isArray(all[PLAYER_ID])) all[PLAYER_ID] = [];
    return all[PLAYER_ID];
  }

  _startingCount(itemName) {
    let n = 0;
    for (const s of this._startingItems()) {
      if (s === itemName) n++;
    }
    return n;
  }

  _setStartingCount(itemName, count) {
    const list = this._startingItems();
    // Remove all existing entries for this item.
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] === itemName) list.splice(i, 1);
    }
    // Add back `count` entries.
    const c = Math.max(0, Math.floor(count) || 0);
    for (let i = 0; i < c; i++) list.push(itemName);
  }

  // ---------- Mutations ----------

  _handleAddRegion() {
    if (!this.rulesDoc) {
      alert('Load a rules.json first.');
      return;
    }
    const regions = this._regions();
    let i = 1;
    let name = 'New Region';
    while (regions[name]) name = `New Region ${++i}`;
    regions[name] = { name, exits: [], locations: [] };
    this._render();
  }

  _handleDeleteRegion(oldName) {
    if (!confirm(`Delete region "${oldName}" and all its exits and locations?`)) return;
    const regions = this._regions();
    delete regions[oldName];
    // Also clean up any exits pointing to this region (set to empty string so the
    // user notices the dangling reference).
    for (const r of Object.values(regions)) {
      for (const ex of r.exits || []) {
        if (ex.connected_region === oldName) ex.connected_region = '';
      }
    }
    this._render();
  }

  _handleRenameRegion(oldName, newName) {
    newName = (newName || '').trim();
    if (!newName || newName === oldName) return;
    const regions = this._regions();
    if (regions[newName]) {
      alert(`A region named "${newName}" already exists.`);
      this._render();
      return;
    }
    // Rebuild dict preserving order.
    const ordered = {};
    for (const [k, v] of Object.entries(regions)) {
      if (k === oldName) {
        v.name = newName;
        ordered[newName] = v;
      } else {
        ordered[k] = v;
      }
    }
    this.rulesDoc.regions[PLAYER_ID] = ordered;
    // Cascade: update exit destinations.
    for (const r of Object.values(ordered)) {
      for (const ex of r.exits || []) {
        if (ex.connected_region === oldName) ex.connected_region = newName;
      }
    }
    // Cascade: CanReachRegion references in access rules.
    renameRegionInRules(this.rulesDoc, PLAYER_ID, oldName, newName);
    // Cascade: start_regions.default entries.
    const sr = this.rulesDoc.start_regions?.[PLAYER_ID];
    if (sr && Array.isArray(sr.default)) {
      sr.default = sr.default.map(n => n === oldName ? newName : n);
    }
    this._render();
  }

  _handleAddExit(regionName) {
    const region = this._regions()[regionName];
    if (!region) return;
    if (!region.exits) region.exits = [];
    const existingNames = new Set(region.exits.map(e => e.name));
    let i = 1;
    let name = `${regionName} → ?`;
    while (existingNames.has(name)) name = `${regionName} → ? ${++i}`;
    region.exits.push(makeExit(name, ''));
    this._render();
  }

  _handleDeleteExit(regionName, index) {
    const region = this._regions()[regionName];
    if (!region || !region.exits) return;
    region.exits.splice(index, 1);
    this._render();
  }

  _handleAddLocation(regionName) {
    const region = this._regions()[regionName];
    if (!region) return;
    if (!region.locations) region.locations = [];
    const existingNames = new Set(region.locations.map(l => l.name));
    let i = 1;
    let name = 'New Location';
    while (existingNames.has(name)) name = `New Location ${++i}`;
    region.locations.push({
      name,
      id: null,
      access_rule: makeTrueRule(),
    });
    this._render();
  }

  _handleDeleteLocation(regionName, index) {
    const region = this._regions()[regionName];
    if (!region || !region.locations) return;
    region.locations.splice(index, 1);
    this._render();
  }

  _handleRenameLocation(regionName, index, newName) {
    newName = (newName || '').trim();
    const region = this._regions()[regionName];
    if (!region || !region.locations) return;
    const loc = region.locations[index];
    if (!loc) return;
    const oldName = loc.name;
    if (!newName || newName === oldName) return;
    // Check for collision within the same region's locations.
    if (region.locations.some((l, i) => i !== index && l && l.name === newName)) {
      alert(`A location named "${newName}" already exists in this region.`);
      this._render();
      return;
    }
    loc.name = newName;
    // Cascade: update CanReachLocation references in access rules.
    renameLocationInRules(this.rulesDoc, PLAYER_ID, oldName, newName);
    this._render();
  }

  _handleAddItem() {
    if (!this.rulesDoc) {
      alert('Load a rules.json first.');
      return;
    }
    const items = this._items();
    let i = 1;
    let name = 'New Item';
    while (items[name]) name = `New Item ${++i}`;
    items[name] = {
      name,
      id: null,
      groups: [],
      classification: 'filler',
      type: null,
      max_count: 1,
    };
    this._itemPoolCounts()[name] = 1;
    this._render();
  }

  _handleDeleteItem(name) {
    if (!confirm(`Delete item "${name}"?`)) return;
    const items = this._items();
    delete items[name];
    const counts = this._itemPoolCounts();
    delete counts[name];
    this._setStartingCount(name, 0);
    this._render();
  }

  _handleRenameItem(oldName, newName) {
    newName = (newName || '').trim();
    if (!newName || newName === oldName) return;
    const items = this._items();
    if (items[newName]) {
      alert(`An item named "${newName}" already exists.`);
      this._render();
      return;
    }
    // Rebuild dict preserving order.
    const ordered = {};
    for (const [k, v] of Object.entries(items)) {
      if (k === oldName) {
        v.name = newName;
        ordered[newName] = v;
      } else {
        ordered[k] = v;
      }
    }
    this.rulesDoc.items[PLAYER_ID] = ordered;
    // Cascade into itempool_counts and starting_items.
    const counts = this._itemPoolCounts();
    if (oldName in counts) {
      counts[newName] = counts[oldName];
      delete counts[oldName];
    }
    const startList = this._startingItems();
    for (let i = 0; i < startList.length; i++) {
      if (startList[i] === oldName) startList[i] = newName;
    }
    // Cascade into access rules (Has / HasAll / HasAny / HasFromList / CountItem).
    renameItemInRules(this.rulesDoc, PLAYER_ID, oldName, newName);
    // Cascade into completion_condition if it's an item_check for this item.
    const cc = this.rulesDoc.game_info?.[PLAYER_ID]?.completion_condition;
    if (cc && cc.type === 'item_check' && cc.item === oldName) {
      cc.item = newName;
    }
    this._render();
  }

  _handleReload() {
    const current = this._getCurrentAppRules();
    if (!current) {
      alert('No rules data is currently loaded in the app.');
      return;
    }
    if (!confirm('Discard your edits and reload the rules data the rest of the app currently has loaded?')) return;
    this.rulesDoc = cloneFullRulesDoc(current);
    this._render();
    log('info', 'Reloaded rules from window.G_combinedModeData.rulesConfig.');
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

  _handleClear() {
    if (!this.rulesDoc) {
      alert('Load a rules.json first.');
      return;
    }
    if (!confirm('Remove all regions, exits, locations, items, pool counts, and starting items? (Other rules.json metadata is kept.)')) return;
    if (!this.rulesDoc.regions) this.rulesDoc.regions = {};
    this.rulesDoc.regions[PLAYER_ID] = {};
    if (!this.rulesDoc.items) this.rulesDoc.items = {};
    this.rulesDoc.items[PLAYER_ID] = {};
    if (!this.rulesDoc.itempool_counts) this.rulesDoc.itempool_counts = {};
    this.rulesDoc.itempool_counts[PLAYER_ID] = {};
    if (!this.rulesDoc.starting_items) this.rulesDoc.starting_items = {};
    this.rulesDoc.starting_items[PLAYER_ID] = [];
    this._render();
    log('info', 'Cleared regions/items for player ' + PLAYER_ID + '.');
  }

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
        selectedPlayerId: PLAYER_ID,
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
    this._renderValidationBar();

    if (!this.rulesDoc) {
      this.statusLabel.textContent = 'No rules loaded';
      const msg = document.createElement('div');
      msg.style.color = '#888';
      msg.style.padding = '12px';
      msg.textContent = 'Load a rules.json (via Presets, File, or Editor) to begin editing.';
      this.scrollContainer.appendChild(msg);
      return;
    }

    const gameName = this.rulesDoc.game_name || '(unnamed game)';
    if (this.activeTab === 'items') {
      const items = this._items();
      const count = Object.keys(items).length;
      this.statusLabel.textContent = `${gameName} — ${count} item${count === 1 ? '' : 's'}`;
      this._renderItemsTab();
    } else if (this.activeTab === 'meta') {
      this.statusLabel.textContent = `${gameName} — metadata`;
      this._renderMetaTab();
    } else {
      const regions = this._regions();
      const names = Object.keys(regions);
      this.statusLabel.textContent = `${gameName} — ${names.length} region${names.length === 1 ? '' : 's'}`;
      this._renderRegionsTab(regions, names);
    }
  }

  _renderValidationBar() {
    this.validationBar.innerHTML = '';
    if (!this.rulesDoc) return;

    const issues = validateRules(this.rulesDoc, PLAYER_ID);
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

  _renderMetaTab() {
    const doc = this.rulesDoc;

    this.scrollContainer.appendChild(this._makeSectionHeader('Game'));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Game name',
      doc.game_name || '',
      (v) => { doc.game_name = v; },
    ));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Game directory',
      doc.game_directory || '',
      (v) => { doc.game_directory = v; },
      'Folder name for the generated APWorld (e.g. "robotkitty")',
    ));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'World class name',
      (doc.world && doc.world[PLAYER_ID] && doc.world[PLAYER_ID].world_class_name) || '',
      (v) => {
        if (!doc.world) doc.world = {};
        if (!doc.world[PLAYER_ID]) doc.world[PLAYER_ID] = {};
        doc.world[PLAYER_ID].world_class_name = v;
      },
      'Python class name for the generated World (e.g. "RobotKittyWorld")',
    ));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Archipelago version',
      doc.archipelago_version || '',
      (v) => { doc.archipelago_version = v; },
    ));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Schema version',
      doc.schema_version == null ? '' : String(doc.schema_version),
      (v) => {
        const n = parseInt(v, 10);
        doc.schema_version = Number.isFinite(n) ? n : undefined;
      },
      'rules.json schema version the exporter targets',
    ));

    this.scrollContainer.appendChild(this._makeSectionHeader('Generation'));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Seed',
      doc.generation_seed == null ? '' : String(doc.generation_seed),
      (v) => {
        const n = parseInt(v, 10);
        doc.generation_seed = Number.isFinite(n) ? n : undefined;
      },
    ));
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Seed name',
      doc.seed_name || '',
      (v) => { doc.seed_name = v; },
    ));

    this.scrollContainer.appendChild(this._makeSectionHeader('Player 1'));
    const playerName = (doc.player_names && doc.player_names[PLAYER_ID]) || '';
    this.scrollContainer.appendChild(this._makeMetaRow(
      'Player name',
      playerName,
      (v) => {
        if (!doc.player_names) doc.player_names = {};
        doc.player_names[PLAYER_ID] = v;
      },
    ));
    this.scrollContainer.appendChild(this._makeStartRegionRow());

    this.scrollContainer.appendChild(this._makeSectionHeader('Victory condition'));
    this.scrollContainer.appendChild(this._makeCompletionConditionEditor());
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

  _makeMetaRow(label, value, onChange, description) {
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
    input.addEventListener('input', (e) => onChange(e.target.value));
    row.appendChild(input);
    return row;
  }

  _makeStartRegionRow() {
    const doc = this.rulesDoc;
    if (!doc.start_regions) doc.start_regions = {};
    if (!doc.start_regions[PLAYER_ID]) doc.start_regions[PLAYER_ID] = { default: [], available: [] };
    const sr = doc.start_regions[PLAYER_ID];
    if (!Array.isArray(sr.default)) sr.default = [];

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
    const current = sr.default[0] || '';
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
      const v = e.target.value;
      sr.default = v ? [v] : [];
    });
    wrap.appendChild(select);

    if (sr.default.length > 1) {
      const note = document.createElement('span');
      note.style.color = '#c80';
      note.style.fontSize = '11px';
      note.textContent = `+${sr.default.length - 1} more (edit raw JSON to manage multiple starts)`;
      wrap.appendChild(note);
    }

    row.appendChild(wrap);
    return row;
  }

  _makeCompletionConditionEditor() {
    const doc = this.rulesDoc;
    if (!doc.game_info) doc.game_info = {};
    if (!doc.game_info[PLAYER_ID]) doc.game_info[PLAYER_ID] = {};
    const gi = doc.game_info[PLAYER_ID];
    if (!gi.completion_condition || typeof gi.completion_condition !== 'object') {
      gi.completion_condition = { type: 'item_check', item: 'Victory' };
    }
    const cc = gi.completion_condition;

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
    typeSelect.value = cc.type === 'item_check' ? 'item_check' : '__raw__';
    typeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'item_check') {
        gi.completion_condition = { type: 'item_check', item: cc.item || 'Victory' };
      } else {
        // Keep existing shape if already non-item_check, else start from blank.
        if (cc.type === 'item_check') {
          gi.completion_condition = { type: 'constant', value: true };
        }
      }
      this._render();
    });
    typeRow.appendChild(typeSelect);
    wrap.appendChild(typeRow);

    if (cc.type === 'item_check') {
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
      if (cc.item && !known.has(cc.item)) {
        const missing = document.createElement('option');
        missing.value = cc.item;
        missing.textContent = `${cc.item} (missing)`;
        missing.style.color = '#c44';
        itemSelect.appendChild(missing);
      }
      for (const n of itemNames) {
        const o = document.createElement('option');
        o.value = n;
        o.textContent = n;
        itemSelect.appendChild(o);
      }
      itemSelect.value = cc.item || '';
      itemSelect.addEventListener('change', (e) => {
        cc.item = e.target.value;
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
      ta.value = JSON.stringify(cc, null, 2);
      ta.addEventListener('input', () => {
        try {
          const parsed = JSON.parse(ta.value);
          if (!parsed || typeof parsed !== 'object') throw new Error('must be an object');
          for (const k of Object.keys(cc)) delete cc[k];
          Object.assign(cc, parsed);
          ta.style.borderColor = '#333';
          ta.title = '';
        } catch (e) {
          ta.style.borderColor = '#c44';
          ta.title = `Parse error: ${e.message}`;
        }
      });
      rawRow.appendChild(ta);
      wrap.appendChild(rawRow);
    }

    return wrap;
  }

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
    idInput.addEventListener('input', (e) => {
      const v = e.target.value.trim();
      if (v === '') {
        item.id = null;
      } else {
        const n = parseInt(v, 10);
        item.id = Number.isFinite(n) ? n : null;
      }
    });
    row.appendChild(idInput);

    // Classification — dropdown + fallback to raw text if unknown
    row.appendChild(this._makeClassificationEditor(item));

    // Max count
    const maxInput = this._makeTextInput(item.max_count == null ? '' : String(item.max_count), '100%');
    maxInput.placeholder = '—';
    maxInput.addEventListener('input', (e) => {
      const v = e.target.value.trim();
      if (v === '') {
        delete item.max_count;
      } else {
        const n = parseInt(v, 10);
        if (Number.isFinite(n)) item.max_count = n;
      }
    });
    row.appendChild(maxInput);

    // Itempool count
    const counts = this._itemPoolCounts();
    const poolInput = this._makeTextInput(counts[name] == null ? '' : String(counts[name]), '100%');
    poolInput.placeholder = '0';
    poolInput.title = 'Number of this item placed in the item pool';
    poolInput.addEventListener('input', (e) => {
      const v = e.target.value.trim();
      if (v === '') {
        delete counts[name];
      } else {
        const n = parseInt(v, 10);
        if (Number.isFinite(n) && n >= 0) counts[name] = n;
      }
    });
    row.appendChild(poolInput);

    // Groups (comma-separated)
    const groupsInput = this._makeTextInput(
      Array.isArray(item.groups) ? item.groups.join(', ') : '',
      '100%',
    );
    groupsInput.placeholder = 'comma-separated';
    groupsInput.addEventListener('input', (e) => {
      item.groups = e.target.value
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    });
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
    startInput.addEventListener('input', (e) => {
      const n = parseInt(e.target.value, 10);
      this._setStartingCount(name, Number.isFinite(n) ? n : 0);
    });
    startLabel.appendChild(startInput);
    row2.appendChild(startLabel);

    const eventLabel = document.createElement('label');
    eventLabel.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
    const eventCb = document.createElement('input');
    eventCb.type = 'checkbox';
    eventCb.checked = item.event === true;
    eventCb.addEventListener('change', () => {
      if (eventCb.checked) item.event = true;
      else delete item.event;
    });
    eventLabel.appendChild(eventCb);
    eventLabel.appendChild(document.createTextNode('event'));
    eventLabel.title = 'Event items are internal (not placed in the pool). Typically used for Victory.';
    row2.appendChild(eventLabel);

    const wrap = document.createElement('div');
    wrap.appendChild(row);
    wrap.appendChild(row2);
    return wrap;
  }

  _makeClassificationEditor(item) {
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
        if (e.target.value === '__other__') {
          item.classification = 'custom';
        } else {
          item.classification = e.target.value;
        }
        this._render();
      });
      return select;
    }
    // Unknown classification — show a text input so user can edit freely.
    const input = this._makeTextInput(current, '100%');
    input.title = 'Custom classification (switch to a standard one via the dropdown after refresh)';
    input.addEventListener('input', (e) => { item.classification = e.target.value; });
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
    nameInput.title = 'Exit name';
    nameInput.addEventListener('input', (e) => { exitData.name = e.target.value; });
    topLine.appendChild(nameInput);

    const arrow = document.createElement('span');
    arrow.textContent = '→';
    arrow.style.color = '#aaa';
    topLine.appendChild(arrow);

    const destSelect = this._makeRegionSelect(exitData.connected_region || '');
    destSelect.addEventListener('change', (e) => { exitData.connected_region = e.target.value; });
    topLine.appendChild(destSelect);

    const spacer = document.createElement('span');
    spacer.style.flex = '1 1 auto';
    topLine.appendChild(spacer);

    const delBtn = this._makeButton('×', '#8a2a2a', () => this._handleDeleteExit(regionName, index));
    delBtn.title = 'Delete exit';
    topLine.appendChild(delBtn);

    row.appendChild(topLine);
    row.appendChild(this._renderAccessRuleEditor(exitData, 'access_rule'));
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
    row.appendChild(this._renderAccessRuleEditor(locData, 'access_rule'));
    return row;
  }

  _renderAccessRuleEditor(parentObj, key) {
    const wrap = document.createElement('div');
    wrap.style.marginTop = '4px';

    const label = document.createElement('div');
    label.textContent = 'access rule:';
    label.style.color = '#888';
    label.style.fontSize = '11px';
    label.style.marginBottom = '2px';
    wrap.appendChild(label);

    const tree = new RuleTreeEditor(parentObj, key, {
      getItemNames: () => this._allItemNames(),
      getRegionNames: () => this._regionNames(),
      getLocationNames: () => this._allLocationNames(),
    });
    wrap.appendChild(tree.getRootElement());
    return wrap;
  }

  _allItemNames() {
    if (!this.rulesDoc) return [];
    const items = (this.rulesDoc.items && this.rulesDoc.items[PLAYER_ID]) || {};
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
