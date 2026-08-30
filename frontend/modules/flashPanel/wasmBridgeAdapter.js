/**
 * WasmBridgeAdapter
 *
 * FlashBridgeAdapter over the wasm-iframe transport: a SWFRecomp-
 * recompiled game page (same-origin iframe) exposing the
 * `window.__swfBridge` contract, instead of a real-Flash <object>
 * element with ExternalInterface callback methods.
 *
 * The AS3 side is the same injected BridgeGeneric in both transports,
 * so all mapping/queue/echo/suppression semantics are inherited
 * unchanged. What inverts is the plumbing:
 *
 *   - callbacks: real Flash surfaces wireCheck/configure/readState as
 *     METHODS on the <object> element; the wasm page surfaces them as
 *     `contentWindow.__swfBridge.game.<cb>()`. Overriding _getFlash()
 *     to return that `game` object makes the inherited waitForBridge /
 *     configureBridge / wireCheck / readState work verbatim.
 *   - item writes: real Flash POLLS the host-window getItemQueue
 *     global; the wasm page's own window has the poll target, so the
 *     host must PUSH via `__swfBridge.queueItems(...)`. A host-side
 *     interval feeds it from the inherited _buildQueue(). BridgeGeneric
 *     dedups repeat property writes (_lastWritten) exactly as in the
 *     polled transport, so re-pushing the rebuilt queue is safe; the
 *     queue is empty until gameReady, so nothing accumulates in the
 *     iframe while the game sits on its Start button.
 *   - state events: real Flash calls the host-window stateChanged
 *     global; the wasm page funnels them to `__swfBridge.onStateChanged`,
 *     which the host overrides (installStateHook).
 *
 * The game must be started by a USER GESTURE inside the iframe (the
 * page's own ▶ Start button — WebGPU/audio init consume the
 * activation), and the bridge callbacks only appear after that, so
 * waitForBridge deserves a generous timeout on this transport.
 */

import { FlashBridgeAdapter } from './flashBridgeAdapter.js';

// Push cadence for host->game queue items. The game polls its local
// getItemQueue every frame (~33ms); pushing less often just batches.
const PUSH_INTERVAL_MS = 100;

export class WasmBridgeAdapter extends FlashBridgeAdapter {
  constructor(opts) {
    super(opts);
    this._pushTimer = null;
    // Stable hook identity so installStateHook can detect (and survive)
    // an iframe reload, which replaces the whole __swfBridge object.
    // Mirrors the attached-gate of the real-Flash global shim.
    this._stateHook = (property, value) => {
      if (this.attached) this._onStateChanged(property, value);
    };
  }

  _getBridge() {
    const el = document.getElementById(this.flashObjectId);
    try {
      return el?.contentWindow?.__swfBridge || null;
    } catch {
      // cross-origin access throws; the page must be same-origin
      return null;
    }
  }

  // The inherited waitForBridge/configureBridge/wireCheck/readState all
  // probe `_getFlash()` for callback methods — return the wasm page's
  // callback surface (only once the game registered its callbacks,
  // which happens after the in-iframe Start click).
  _getFlash() {
    const game = this._getBridge()?.game;
    return game && typeof game.wireCheck === 'function' ? game : null;
  }

  /**
   * Wait for the page's __swfBridge shim itself (present as soon as
   * the page loads, long before the game starts). Distinct from
   * waitForBridge, which waits for the game's registered callbacks.
   */
  async waitForShim(maxMs) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (this._cancelled) throw new Error('adapter detached');
      if (this._getBridge()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`__swfBridge shim did not appear within ${maxMs}ms`);
  }

  // Same probe loop as the inherited version, plus the cancellation
  // check — the wasm flow waits up to minutes for the user's Start
  // click, and a preset switch must be able to abort that wait (a
  // replacement iframe reuses the same element id, so a stale loop
  // would otherwise resolve against the NEW game page).
  async waitForBridge(maxMs) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (this._cancelled) throw new Error('adapter detached');
      const el = this._getFlash();
      if (el) return el;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`bridge did not become ready within ${maxMs}ms`);
  }

  /**
   * Route the page's stateChanged reports into the inherited handler.
   * Idempotent; re-run from the push tick so an iframe reload (which
   * resets __swfBridge to its default logging handler) re-hooks.
   */
  installStateHook() {
    const bridge = this._getBridge();
    if (!bridge) return false;
    if (bridge.onStateChanged !== this._stateHook) {
      bridge.onStateChanged = this._stateHook;
    }
    return true;
  }

  attach() {
    super.attach();
    if (!this._pushTimer) {
      this._pushTimer = setInterval(() => this._pushTick(), PUSH_INTERVAL_MS);
    }
  }

  _pushTick() {
    const bridge = this._getBridge();
    if (!bridge) return;
    this.installStateHook();
    const items = this._buildQueue();
    if (items.length > 0) bridge.queueItems(items);
  }

  detach() {
    this._cancelled = true;
    if (this._pushTimer) {
      clearInterval(this._pushTimer);
      this._pushTimer = null;
    }
    super.detach();
  }
}
