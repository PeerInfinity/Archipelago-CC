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

import { getModuleEventBus } from './index.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import RuleTreeEditor from './ruleTreeEditor.js';

const RAW_JSON_LOADED = 'stateManager:rawJsonDataLoaded';
const APP_READY = 'app:readyForUiDataLoad';
const APPLY_SOURCE = 'apworldEditorApply';
const PLAYER_ID = '1';

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('apworldEditorUI', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[apworldEditorUI] ${message}`, ...data);
  }
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function defaultAccessRule() {
  return { rule: 'True_' };
}

class ApworldEditorUI {
  constructor(container, componentState) {
    Object.defineProperty(this, 'eventBus', { get: () => getModuleEventBus(), configurable: true });
    this.container = container;
    this.componentState = componentState;

    this.rulesDoc = null;
    this.isInitialized = false;
    this.rawJsonUnsubscribe = null;
    this.pendingApply = false;

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
      this.rulesDoc = deepClone(eventData.rawJsonData);
      this._render();
    });

    // If rules were loaded before the panel opened, pick them up now from the
    // app-wide cache rather than waiting for another event.
    if (!this.rulesDoc) {
      const current = this._getCurrentAppRules();
      if (current) {
        this.rulesDoc = deepClone(current);
        this._render();
      }
    }

    this.isInitialized = true;
    log('info', 'ApworldEditorUI initialized.');
  }

  onPanelDestroy() {
    if (this.rawJsonUnsubscribe) {
      try { this.rawJsonUnsubscribe(); } catch (_) { /* noop */ }
      this.rawJsonUnsubscribe = null;
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
    this.clearButton.title = 'Remove all regions, exits, and locations';
    toolbar.appendChild(this.clearButton);

    this.reloadButton = this._makeButton('Reload', '#444', () => this._handleReload());
    this.reloadButton.title = 'Discard edits and reload the rules data the rest of the app currently has loaded';
    toolbar.appendChild(this.reloadButton);

    this.addRegionButton = this._makeButton('+ Add region', '#444', () => this._handleAddRegion());
    toolbar.appendChild(this.addRegionButton);

    this.statusLabel = document.createElement('span');
    this.statusLabel.style.color = '#888';
    this.statusLabel.style.marginLeft = 'auto';
    this.statusLabel.textContent = 'No rules loaded';
    toolbar.appendChild(this.statusLabel);

    this.rootElement.appendChild(toolbar);

    this.scrollContainer = document.createElement('div');
    Object.assign(this.scrollContainer.style, {
      flex: '1 1 auto',
      overflow: 'auto',
      padding: '8px',
    });
    this.rootElement.appendChild(this.scrollContainer);
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
    region.exits.push({
      name,
      connected_region: '',
      access_rule: defaultAccessRule(),
    });
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
      access_rule: defaultAccessRule(),
    });
    this._render();
  }

  _handleDeleteLocation(regionName, index) {
    const region = this._regions()[regionName];
    if (!region || !region.locations) return;
    region.locations.splice(index, 1);
    this._render();
  }

  _handleReload() {
    const current = this._getCurrentAppRules();
    if (!current) {
      alert('No rules data is currently loaded in the app.');
      return;
    }
    if (!confirm('Discard your edits and reload the rules data the rest of the app currently has loaded?')) return;
    this.rulesDoc = deepClone(current);
    this._render();
    log('info', 'Reloaded rules from window.G_combinedModeData.rulesConfig.');
  }

  _getCurrentAppRules() {
    return (typeof window !== 'undefined'
      && window.G_combinedModeData
      && window.G_combinedModeData.rulesConfig) || null;
  }

  _handleClear() {
    if (!this.rulesDoc) {
      alert('Load a rules.json first.');
      return;
    }
    if (!confirm('Remove all regions, exits, and locations? (Other rules.json metadata is kept.)')) return;
    if (!this.rulesDoc.regions) this.rulesDoc.regions = {};
    this.rulesDoc.regions[PLAYER_ID] = {};
    this._render();
    log('info', 'Cleared all regions for player ' + PLAYER_ID + '.');
  }

  _handleApply() {
    if (!this.rulesDoc) {
      this._flashButton(this.applyButton, false);
      return;
    }
    try {
      this.pendingApply = true;
      this.eventBus.publish('files:jsonLoaded', {
        jsonData: deepClone(this.rulesDoc),
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
    const regions = this._regions();
    const names = Object.keys(regions);
    this.statusLabel.textContent = `${gameName} — ${names.length} region${names.length === 1 ? '' : 's'}`;

    for (const regionName of names) {
      this.scrollContainer.appendChild(this._renderRegion(regionName, regions[regionName]));
    }
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
    nameInput.title = 'Location name';
    nameInput.addEventListener('input', (e) => { locData.name = e.target.value; });
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
