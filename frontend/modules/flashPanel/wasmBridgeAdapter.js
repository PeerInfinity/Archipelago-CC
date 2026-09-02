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
import { pollUntil } from './pollUntil.js';
import {
  bridgeOf, frameWindow, gameUp, runtimeUp, RUNTIME_WITNESSES,
} from './wasmGamePage.js';

// Push cadence for host->game queue items. The game polls its local
// getItemQueue every frame (~33ms); pushing less often just batches.
const PUSH_INTERVAL_MS = 100;

// What an aborted readiness wait throws. ⛔ ONE spelling: both waits refuse
// with it, and `detach()` is the only thing that arms it.
const DETACHED_MESSAGE = 'adapter detached';

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

  /**
   * The frame's own window, re-read from the DOM on every call.
   *
   * ⛔ RE-READ, NEVER CAPTURED: a preset switch replaces the iframe under the
   * SAME element id, and a captured window is the previous game's.
   */
  _getWin() {
    return frameWindow(document.getElementById(this.flashObjectId));
  }

  _getBridge() {
    return bridgeOf(this._getWin());
  }

  // The inherited waitForBridge/configureBridge/wireCheck/readState all
  // probe `_getFlash()` for callback methods — return the wasm page's
  // callback surface (only once the game registered its callbacks,
  // which happens after the in-iframe Start click).
  //
  // ⛔⛔ THE GATE IS `wasmGamePage.gameUp` NOW, AND IT MOVED — this used to
  // answer on `wireCheck` alone. MEASURED on the live p4d page (see that
  // file's table): `wireCheck` registers 1,542 ms BEFORE `botStatus`, so for a
  // second and a half this method handed out a `game` on which `botLoadLevels`
  // and `botLevelSet` did not exist yet. The lab has always waited for
  // `botStatus`; both hosts now ask the same question.
  _getFlash() {
    return gameUp(this._getWin());
  }

  /**
   * Wait for the page's RUNTIME (`wasmGamePage.runtimeUp`, Q1). Distinct from
   * waitForBridge, which waits for the game's registered callbacks.
   *
   * ⛔⛔ IT USED TO WAIT ON THE SHIM ALONE, AND THAT WAS 271 ms TOO EARLY —
   * WHICH IS ALSO WHY IT IS NO LONGER CALLED `waitForShim`. `__swfBridge` is
   * installed by a CLASSIC script before the wasm glue (measured at 0.3 ms,
   * with `game` still `{}`), while `__runtimeReady` is what
   * `Module.onRuntimeInitialized` sets and what ENABLES the ▶ Start button. So
   * the caller's *"click ▶ Start in the game"* was printed over a disabled
   * button. Q1 is the later of the two, and a method named for the earlier one
   * would be the next reader's first wrong idea.
   *
   * ⛓ The TIMEOUT stays the caller's: 30 s here, 180 s in the lab. What is
   * waited for is a fact about the page; how long is a judgement about a user.
   */
  async waitForRuntime(maxMs) {
    await pollUntil(() => runtimeUp(this._getWin()), {
      maxMs,
      cancelled: () => this._cancelled,
      cancelledMessage: DETACHED_MESSAGE,
      timeoutMessage: `the wasm page's runtime did not come up within ${maxMs}ms `
        + `(${RUNTIME_WITNESSES.join(' + ')})`,
    });
    // ⛔ `true`, not the bridge: the callers treat this as a stage gate, and
    // handing out the bridge object would invite a second capture of the very
    // reference `_getBridge()` exists to re-read.
    return true;
  }

  // Same probe loop as the inherited version, plus the cancellation
  // check — the wasm flow waits up to minutes for the user's Start
  // click, and a preset switch must be able to abort that wait (a
  // replacement iframe reuses the same element id, so a stale loop
  // would otherwise resolve against the NEW game page).
  async waitForBridge(maxMs) {
    return pollUntil(() => this._getFlash(), {
      maxMs,
      cancelled: () => this._cancelled,
      cancelledMessage: DETACHED_MESSAGE,
      timeoutMessage: `bridge did not become ready within ${maxMs}ms`,
    });
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
