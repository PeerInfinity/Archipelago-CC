import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';
import settingsManager from '../../app/core/settingsManager.js';
import { getDispatcher, getModuleEventBus, setActivePanelInstance } from './index.js';
import { FlashBridgeAdapter } from './flashBridgeAdapter.js';
import { WasmBridgeAdapter } from './wasmBridgeAdapter.js';

function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('flashPanelUI', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[flashPanelUI] ${message}`, ...data);
  }
}

const GAMES_DIR = './modules/flashPanel/games/';
const SWF_DIR = './modules/flashPanel/swf/';
// SWFRecomp-recompiled game pages (__swfBridge contract). The built
// artifacts are NOT committed (23.8 MB wasm) — see this module's
// README.md for the copy command that stages them locally.
const WASM_DIR = './modules/flashPanel/wasm/';
const RUFFLE_CDN = 'https://unpkg.com/@ruffle-rs/ruffle';
// Transport selection, mirroring moduleSettings.bounceDemo.renderer:
// 'auto' (default) uses the wasm page when the game wiring provides
// one, real Flash otherwise; 'flash'/'wasm' force a transport.
const RUNTIME_SETTING_KEY = 'moduleSettings.flashPanel.runtime';

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
    // Pick per-game paths from componentState or rules.json's
    // flash_panel section. The actual lookup happens in
    // _initializeAdapter because stateManager.getStaticData may not
    // be populated yet when the component is constructed.
    this.configPath = this.componentState.configPath || null;
    this.swfPath = this.componentState.swfPath || null;
    this.wasmPath = this.componentState.wasmPath || null;

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

    // Wait for rules to actually finish loading before picking the
    // config. `stateManager:rulesLoaded` fires after the worker
    // confirms rules + snapshot are ready, which is when
    // `staticData.flash_panel` becomes authoritative.
    const readyHandler = async () => {
      this.eventBus.unsubscribe('stateManager:rulesLoaded', readyHandler);
      await this._initializeAdapter();
    };
    this.eventBus.subscribe('stateManager:rulesLoaded', readyHandler);

    // Fast path: if rules were already loaded before this panel
    // was constructed (e.g. created by a layout change after
    // startup), skip the event wait and initialize immediately.
    // game_name is populated in staticDataCache alongside
    // flash_panel, so it's a reliable "rules ready" signal.
    if (stateManager.getStaticData?.()?.game_name) {
      this.eventBus.unsubscribe('stateManager:rulesLoaded', readyHandler);
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
    for (const name of Object.keys(locationCoords)) {
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

  // Note: Clean Flash pauses the SWF when any click lands outside
  // the game area, and DOM focus() on the <object> doesn't resume
  // it — the plugin tracks its own activation state. After a
  // teleport button click the user needs to click back inside the
  // game to resume play; the queued path write is already applied
  // by the time that happens, so the player shows at the new
  // position as soon as the game unpauses.

  _manualTeleport() {
    if (!this.adapter) return;
    const level = parseInt(this.teleportLevelInput.value, 10);
    const x = parseInt(this.teleportXInput.value, 10);
    const y = parseInt(this.teleportYInput.value, 10);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      this._panelLog('teleport: x/y must be numbers', 'error');
      return;
    }
    const params = { x, y };
    if (!Number.isNaN(level)) params.level = level;
    this.adapter.teleport(params);
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

  _embedWasmIframe(width, height) {
    this.swfContainer.innerHTML = `
      <iframe id="${this.flashObjectId}" src="${this.wasmPath}"
          width="${width}" height="${height}"
          style="border:0;background:#000;display:block;"
          allow="autoplay"></iframe>
    `;
  }

  /**
   * Init flow for the wasm-iframe transport (SWFRecomp-recompiled
   * game page exposing __swfBridge). Differs from the real-Flash flow
   * in lifecycle, not semantics: the page loads immediately, but the
   * game — and with it the bridge callbacks — only starts on the
   * page's own ▶ Start button (a user gesture inside the iframe;
   * WebGPU/audio init consume the activation). So we wait for the
   * shim, tell the user to press Start, then wait as long as it takes
   * for the callbacks before configuring. None of the real-Flash
   * workarounds (Ruffle load, Clean Flash configure delay, host-shim
   * poll counters) apply here.
   */
  async _initializeWasm() {
    this._setStatus('loading config…');
    this.gameConfig = await this._loadConfig(this.configPath);
    this._panelLog(`config loaded: ${this.gameConfig.game} (wasm transport)`);
    this._setupTeleportUI();

    const [w, h] = this.gameConfig.stage_size || [480, 480];
    this._embedWasmIframe(w, h);

    this.adapter = new WasmBridgeAdapter({
      config: this.gameConfig,
      flashObjectId: this.flashObjectId,
      stateManager,
      dispatcher: getDispatcher(),
      eventBus: this.eventBus,
      log: (msg, cls) => this._panelLog(msg, cls),
    });

    try {
      this._setStatus('loading wasm page…');
      await this.adapter.waitForShim(30000);
      this._setStatus('click ▶ Start in the game');
      this._panelLog('wasm page loaded — click ▶ Start in the game to boot it');
      // Callbacks appear only after the user starts the game; wait
      // generously rather than timing out under them.
      await this.adapter.waitForBridge(10 * 60 * 1000);
      this._panelLog('bridge callbacks ready');
    } catch (err) {
      this._panelLog(`bridge not ready: ${err.message}`, 'error');
      this._setStatus('bridge timeout');
      return;
    }

    // Hook state reports before configure so the baseline reads that
    // follow it are seen (and suppressed) by the adapter.
    this.adapter.installStateHook();
    const result = this.adapter.configureBridge();
    this._panelLog(`configure: ${result}`);
    this._setStatus('configured');
    this.adapter.attach();
    setTimeout(() => this._verifyWasmBridgeConfigured(), 1000);
  }

  _verifyWasmBridgeConfigured() {
    if (!this.adapter) return;
    const raw = this.adapter.readState();
    if (typeof raw === 'string' && raw.indexOf('not configured') !== -1) {
      this._panelLog('bridge not configured — retrying');
      this.adapter.configureBridge();
      setTimeout(() => this._verifyWasmBridgeConfigured(), 1000);
      return;
    }
    if (typeof raw === 'string' && raw.indexOf('classes not resolved') !== -1) {
      this._panelLog('bridge waiting for classes to resolve…');
      setTimeout(() => this._verifyWasmBridgeConfigured(), 1000);
      return;
    }
    this._panelLog(`bridge verified: ${raw?.substring ? raw.substring(0, 80) : raw}`);
    this._setStatus('ready');
  }

  async _initializeAdapter() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      // Resolve config/SWF paths from the active preset's
      // rules.json `flash_panel` section, which is threaded through
      // stateManager.getStaticData(). componentState overrides win;
      // if neither source specifies a game, the panel stays idle.
      if (!this.configPath || !this.swfPath || !this.wasmPath) {
        const fp = stateManager.getStaticData?.()?.flash_panel;
        if (fp && (fp.config || fp.swf || fp.wasm)) {
          if (!this.configPath && fp.config) {
            this.configPath = GAMES_DIR + fp.config;
          }
          if (!this.swfPath && fp.swf) {
            this.swfPath = SWF_DIR + fp.swf;
          }
          if (!this.wasmPath && fp.wasm) {
            this.wasmPath = WASM_DIR + fp.wasm;
          }
          this._panelLog(`rules.json flash_panel: config=${fp.config} swf=${fp.swf} wasm=${fp.wasm}`);
        }
      }

      // Transport selection: 'auto' takes the wasm page whenever the
      // wiring provides one (it runs in any browser; real Flash needs
      // a plugin-capable one), 'flash'/'wasm' force their transport.
      // A forced transport with no matching path falls through to the
      // "not configured" messages below.
      let runtime = 'auto';
      try {
        runtime = await settingsManager.getSetting(RUNTIME_SETTING_KEY, 'auto');
      } catch { /* keep 'auto' */ }
      if (this.configPath && this.wasmPath && runtime !== 'flash') {
        await this._initializeWasm();
        return;
      }

      if (!this.configPath || !this.swfPath) {
        this._panelLog('no flash game configured in rules data');
        this._setStatus('no game configured');
        return;
      }

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
