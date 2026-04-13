import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import { getDispatcher, getModuleEventBus, setActivePanelInstance } from './index.js';
import { FlashBridgeAdapter } from './flashBridgeAdapter.js';

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('flashPanelUI', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[flashPanelUI] ${message}`, ...data);
  }
}

const DEFAULT_CONFIG_PATH = './modules/flashPanel/games/seedling.json';
const DEFAULT_SWF_PATH = './modules/flashPanel/swf/seedling_injected.swf';
const RUFFLE_CDN = 'https://unpkg.com/@ruffle-rs/ruffle';

let instanceCounter = 0;
let rufflePromise = null;

/**
 * Detect whether a Flash Player (native plugin or Clean Flash
 * browser extension) is available. The Clean Flash Chrome extension
 * exposes itself via navigator.plugins['Shockwave Flash'], so this
 * check also returns true when the extension is active.
 *
 * See SWFRecomp-CC/SWFRecompDocs/guides/flash-browser-setup.md for
 * the supported browser setups.
 */
function hasFlashPlayer() {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.plugins &&
    navigator.plugins['Shockwave Flash']
  );
}

/**
 * Lazy-load Ruffle as a last-resort fallback when no Flash Player
 * is detected. Skipped entirely when Clean Flash (or any other
 * native plugin) is present — Ruffle's polyfill would otherwise
 * fight the extension over <object> tag handling and has been
 * observed to mangle SWF URLs when both are active at once.
 */
function ensureRuffleLoaded() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (hasFlashPlayer()) return Promise.resolve();
  if (window.RufflePlayer) return Promise.resolve();
  if (rufflePromise) return rufflePromise;

  rufflePromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = RUFFLE_CDN;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load Ruffle from ${RUFFLE_CDN}`));
    document.head.appendChild(s);
  });
  return rufflePromise;
}

export class FlashPanelUI {
  constructor(container, componentState) {
    this.container = container;
    this.componentState = componentState || {};
    Object.defineProperty(this, 'eventBus', { get: () => getModuleEventBus(), configurable: true });

    this.instanceId = ++instanceCounter;
    this.flashObjectId = `FlashPanelSWF_${this.instanceId}`;
    this.configPath = this.componentState.configPath || DEFAULT_CONFIG_PATH;
    this.swfPath = this.componentState.swfPath || DEFAULT_SWF_PATH;

    this.rootElement = null;
    this.swfContainer = null;
    this.statusElement = null;
    this.logElement = null;

    this.gameConfig = null;
    this.adapter = null;
    this.unsubscribeHandles = [];
    this.isInitialized = false;

    this._createBaseUI();

    // Make this instance available to the dispatcher receivers
    // registered at module scope (index.js). Only one flash panel
    // is expected to be visible at a time, so last-writer-wins
    // here is fine.
    setActivePanelInstance(this);

    this.container.on('destroy', () => this.destroy());

    const readyHandler = async () => {
      this.eventBus.unsubscribe('app:readyForUiDataLoad', readyHandler);
      await this._initializeAdapter();
    };
    this.eventBus.subscribe('app:readyForUiDataLoad', readyHandler);

    if (stateManager.getStaticData()?.items) {
      this.eventBus.unsubscribe('app:readyForUiDataLoad', readyHandler);
      this._initializeAdapter();
    }
  }

  getRootElement() {
    return this.rootElement;
  }

  _createBaseUI() {
    this.rootElement = document.createElement('div');
    this.rootElement.classList.add('flash-panel-container', 'panel-container');
    this.rootElement.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: auto;
      background: #1a1a1a;
      color: #e0e0e0;
      font-family: monospace;
      padding: 8px;
      box-sizing: border-box;
    `;

    this.rootElement.innerHTML = `
      <div class="flash-panel-header" style="flex-shrink: 0; margin-bottom: 6px;">
        <span style="color: #e94560;">Flash Game</span>
        <span class="flash-panel-status" style="margin-left: 12px; color: #aaa; font-size: 12px;">initializing…</span>
      </div>
      <div class="flash-panel-swf" style="flex-shrink: 0;"></div>
      <div class="flash-panel-controls" style="flex-shrink: 0; margin-top: 6px; font-size: 12px;">
        <button class="flash-panel-wirecheck" style="background:#e94560;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;margin-right:4px;">Wire Check</button>
        <button class="flash-panel-readstate" style="background:#e94560;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;margin-right:4px;">Read State</button>
        <button class="flash-panel-configure" style="background:#e94560;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;">Configure Bridge</button>
      </div>
      <div class="flash-panel-teleport" style="flex-shrink: 0; margin-top: 6px; font-size: 12px; display: none;">
        <span style="color:#aaa;margin-right:4px;">Teleport:</span>
        <input class="flash-panel-tp-level" type="number" placeholder="level" style="width:55px;background:#333;color:#e0e0e0;border:1px solid #555;padding:2px 4px;border-radius:3px;" />
        <input class="flash-panel-tp-x" type="number" placeholder="x" style="width:55px;background:#333;color:#e0e0e0;border:1px solid #555;padding:2px 4px;border-radius:3px;" />
        <input class="flash-panel-tp-y" type="number" placeholder="y" style="width:55px;background:#333;color:#e0e0e0;border:1px solid #555;padding:2px 4px;border-radius:3px;" />
        <button class="flash-panel-tp-go" style="background:#e94560;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;margin-left:4px;">Go</button>
        <span class="flash-panel-tp-region-wrap" style="display:none;">
          <span style="margin-left:10px;color:#aaa;">Region:</span>
          <select class="flash-panel-tp-region" style="background:#333;color:#e0e0e0;border:1px solid #555;padding:2px 4px;border-radius:3px;"></select>
          <button class="flash-panel-tp-region-go" style="background:#e94560;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;margin-left:4px;">Go</button>
        </span>
        <span style="margin-left:10px;color:#aaa;">Location:</span>
        <select class="flash-panel-tp-location" style="background:#333;color:#e0e0e0;border:1px solid #555;padding:2px 4px;border-radius:3px;"></select>
        <button class="flash-panel-tp-location-go" style="background:#e94560;color:#fff;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;margin-left:4px;">Go</button>
        <label style="margin-left:10px;color:#aaa;"><input class="flash-panel-tp-on-click" type="checkbox" /> TP on UI click</label>
      </div>
      <div class="flash-panel-log" style="flex-grow: 1; margin-top: 6px; background: #111; border: 1px solid #333; border-radius: 4px; padding: 6px; font-size: 11px; overflow-y: auto; min-height: 60px; white-space: pre-wrap;"></div>
    `;

    this.swfContainer = this.rootElement.querySelector('.flash-panel-swf');
    this.statusElement = this.rootElement.querySelector('.flash-panel-status');
    this.logElement = this.rootElement.querySelector('.flash-panel-log');
    this.teleportRow = this.rootElement.querySelector('.flash-panel-teleport');
    this.teleportLevelInput = this.rootElement.querySelector('.flash-panel-tp-level');
    this.teleportXInput = this.rootElement.querySelector('.flash-panel-tp-x');
    this.teleportYInput = this.rootElement.querySelector('.flash-panel-tp-y');
    this.teleportRegionSelect = this.rootElement.querySelector('.flash-panel-tp-region');
    this.teleportLocationSelect = this.rootElement.querySelector('.flash-panel-tp-location');
    this.teleportOnClickCheckbox = this.rootElement.querySelector('.flash-panel-tp-on-click');

    this.rootElement.querySelector('.flash-panel-wirecheck')
      .addEventListener('click', () => this._wireCheck());
    this.rootElement.querySelector('.flash-panel-readstate')
      .addEventListener('click', () => this._readState());
    this.rootElement.querySelector('.flash-panel-configure')
      .addEventListener('click', () => this._configureBridge());
    this.rootElement.querySelector('.flash-panel-tp-go')
      .addEventListener('click', () => this._manualTeleport());
    this.rootElement.querySelector('.flash-panel-tp-region-go')
      .addEventListener('click', () => this._regionTeleport());
    this.rootElement.querySelector('.flash-panel-tp-location-go')
      .addEventListener('click', () => this._locationTeleport());

    this.container.element.appendChild(this.rootElement);
  }

  _setupTeleportUI() {
    if (!this.gameConfig?.teleport) return;
    this.teleportRow.style.display = '';

    // Populate region dropdown (hidden by default but wired in
    // case we ever want to re-enable it without editing HTML).
    const regionCoords = this.gameConfig.region_coords || {};
    this.teleportRegionSelect.innerHTML = '';
    for (const name of Object.keys(regionCoords).sort()) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      this.teleportRegionSelect.appendChild(opt);
    }

    // Populate location dropdown from location_coords config.
    const locationCoords = this.gameConfig.location_coords || {};
    this.teleportLocationSelect.innerHTML = '';
    for (const name of Object.keys(locationCoords).sort()) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      this.teleportLocationSelect.appendChild(opt);
    }

    // Subscribe to region-graph node clicks (eventBus). The "TP on
    // UI click" checkbox gates whether the click triggers a
    // teleport; we always subscribe so toggling the checkbox
    // starts working immediately.
    const unsub = this.eventBus.subscribe('regionGraph:nodeSelected', (payload) => {
      if (!this.teleportOnClickCheckbox?.checked) return;
      if (!payload?.nodeId) return;
      this._teleportToRegion(payload.nodeId);
    });
    this._teleportUnsub = unsub;
  }

  /**
   * Called by index.js when user:locationCheck fires through the
   * dispatcher chain. Gated on the "TP on UI click" checkbox.
   * Ignores events originating from this panel so we don't
   * re-teleport when Flash itself reports a pickup.
   */
  handleUserLocationCheck(eventData) {
    if (!this.teleportOnClickCheckbox?.checked) return;
    if (!eventData?.locationName) return;
    if (eventData.originator === 'FlashPanel') return;
    this._teleportToLocation(eventData.locationName);
  }

  _manualTeleport() {
    if (!this.adapter) return;
    const level = parseInt(this.teleportLevelInput.value, 10);
    const x = parseInt(this.teleportXInput.value, 10);
    const y = parseInt(this.teleportYInput.value, 10);
    if (Number.isNaN(level) || Number.isNaN(x) || Number.isNaN(y)) {
      this._panelLog('teleport: level/x/y must be numbers', 'error');
      return;
    }
    this.adapter.teleport({ level, x, y });
  }

  _regionTeleport() {
    if (!this.adapter) return;
    const name = this.teleportRegionSelect.value;
    if (!name) return;
    this._teleportToRegion(name);
  }

  _teleportToRegion(regionName) {
    if (!this.adapter) return;
    const ok = this.adapter.teleportToRegion(regionName);
    if (!ok) {
      this._panelLog(`teleport: no coords for region "${regionName}"`);
    }
  }

  _locationTeleport() {
    if (!this.adapter) return;
    const name = this.teleportLocationSelect.value;
    if (!name) return;
    this._teleportToLocation(name);
  }

  _teleportToLocation(locationName) {
    if (!this.adapter) return;
    const ok = this.adapter.teleportToLocation(locationName);
    if (!ok) {
      this._panelLog(`teleport: no coords for location "${locationName}"`);
    }
  }

  _embedSwf(width, height) {
    this.swfContainer.innerHTML = `
      <object id="${this.flashObjectId}" name="${this.flashObjectId}"
          type="application/x-shockwave-flash"
          data="${this.swfPath}" width="${width}" height="${height}">
        <param name="movie" value="${this.swfPath}" />
        <param name="quality" value="high" />
        <param name="AllowScriptAccess" value="always" />
        <div style="padding:12px;color:#e94560;">Flash Player not available. Install Basilisk + Clean Flash NPAPI, or Ruffle.</div>
      </object>
    `;
  }

  async _initializeAdapter() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      this._setStatus('loading config…');
      this.gameConfig = await this._loadConfig(this.configPath);
      this._panelLog(`config loaded: ${this.gameConfig.game}`);
      this._setupTeleportUI();

      const [w, h] = this.gameConfig.stage_size || [480, 480];

      try {
        await ensureRuffleLoaded();
      } catch (err) {
        this._panelLog(`ruffle load failed: ${err.message} (native Flash may still work)`);
      }

      this._embedSwf(w, h);
      this._setStatus('waiting for bridge…');

      this.adapter = new FlashBridgeAdapter({
        config: this.gameConfig,
        flashObjectId: this.flashObjectId,
        stateManager,
        dispatcher: getDispatcher(),
        eventBus: this.eventBus,
        log: (msg, cls) => this._panelLog(msg, cls),
      });

      try {
        await this.adapter.waitForBridge(15000);
        this._panelLog('bridge ready');
        this._setStatus('bridge ready');

        // Give Clean Flash / native-messaging extensions time to
        // finish wiring the round-trip for ExternalInterface.addCallback
        // stubs. Without this delay, the first flash.configure(json)
        // call is silently dropped — the JS-side stub exists (which
        // is why waitForBridge already resolved) but the Flash side
        // of the channel for inbound calls with arguments isn't
        // reliably ready yet. Empirically 1500ms is enough to skip
        // the retry path on Chrome + Clean Flash, while the retry
        // below handles the rare case where it isn't.
        await new Promise((r) => setTimeout(r, 1500));

        this._configureRetries = 0;
        this._configureBridge();
      } catch (err) {
        this._panelLog(`bridge not ready: ${err.message}`, 'error');
        this._setStatus('bridge timeout');
      }
    } catch (err) {
      log('error', '[FlashPanelUI] Init failed', err);
      this._panelLog(`init failed: ${err.message}`, 'error');
      this._setStatus('error');
    }
  }

  async _loadConfig(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${path}`);
    return res.json();
  }

  _configureBridge() {
    if (!this.adapter) return;
    const result = this.adapter.configureBridge();
    // Some Flash runtimes (notably the Clean Flash Chrome extension,
    // which marshals ExternalInterface through native messaging)
    // return `undefined` instead of the bridge's real return value
    // because the call is actually asynchronous. Don't gate on the
    // return value — attach optimistically and verify separately.
    this._panelLog(`configure: ${result}`);
    this._setStatus('configured');
    this.adapter.attach();

    // Verify the bridge actually picked up the configuration by
    // reading state after a short delay. If readState returns an
    // error about not being configured, the configure call was lost
    // and we should retry.
    setTimeout(() => this._verifyBridgeConfigured(), 1500);
  }

  _verifyBridgeConfigured() {
    if (!this.adapter) return;
    const raw = this.adapter.readState();
    if (typeof raw === 'string' && raw.indexOf('not configured') !== -1) {
      this._panelLog('bridge not configured — retrying');
      this.adapter.configureBridge();
      return;
    }
    if (typeof raw === 'string' && raw.indexOf('classes not resolved') !== -1) {
      this._panelLog('bridge waiting for classes to resolve…');
      setTimeout(() => this._verifyBridgeConfigured(), 1500);
      return;
    }
    this._panelLog(`bridge verified: ${raw?.substring ? raw.substring(0, 80) : raw}`);

    // Check whether Flash is actually polling via the raw shim
    // counter. If it's still zero 1.5s after configure, the call
    // was lost — retry up to 3 times with increasing delay.
    const shimCalls = (typeof window !== 'undefined' && window.__flashShimGetItemQueueCalls) || 0;
    const stateChangedCalls = (typeof window !== 'undefined' && window.__flashShimStateChangedCalls) || 0;
    this._panelLog(`diag: shim getItemQueue=${shimCalls}  stateChanged=${stateChangedCalls}`);

    if (shimCalls === 0) {
      const maxRetries = 3;
      if (this._configureRetries < maxRetries) {
        this._configureRetries++;
        const delay = 1000 * this._configureRetries;
        this._panelLog(`no flash polling — retrying configure (attempt ${this._configureRetries}/${maxRetries}) in ${delay}ms`);
        setTimeout(() => {
          this.adapter.configureBridge();
          setTimeout(() => this._verifyBridgeConfigured(), 1500);
        }, delay);
        return;
      }
      this._panelLog('flash polling never started — giving up', 'error');
      this._setStatus('no polling');
      return;
    }

    this._setStatus('ready');
  }

  _wireCheck() {
    if (!this.adapter) { this._panelLog('adapter not ready'); return; }
    this._panelLog(`wireCheck: ${this.adapter.wireCheck()}`);
  }

  _readState() {
    if (!this.adapter) { this._panelLog('adapter not ready'); return; }
    this._panelLog(`readState: ${this.adapter.readState()}`);
  }

  _setStatus(text) {
    if (this.statusElement) this.statusElement.textContent = text;
  }

  _panelLog(msg, cls) {
    if (!this.logElement) return;
    const span = document.createElement('span');
    if (cls === 'error') span.style.color = '#e94560';
    else if (cls === 'location') span.style.color = '#5ae9e0';
    else if (cls === 'item') span.style.color = '#6ae95a';
    span.textContent = msg + '\n';
    this.logElement.appendChild(span);
    this.logElement.scrollTop = this.logElement.scrollHeight;
  }

  destroy() {
    log('info', '[FlashPanelUI] Destroying');
    if (this.adapter) {
      this.adapter.detach();
      this.adapter = null;
    }
    if (this._teleportUnsub) {
      this._teleportUnsub();
      this._teleportUnsub = null;
    }
    this.unsubscribeHandles.forEach((u) => typeof u === 'function' && u());
    this.unsubscribeHandles = [];
    setActivePanelInstance(null);
  }
}
