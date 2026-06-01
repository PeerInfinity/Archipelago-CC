/**
 * Panel UI class — mounts an iframe pointing at a recompiled Flash game
 * page (SWF -> WASM via SWFRecomp-CC). After the iframe loads, the panel
 * injects bridge.js into the iframe document so the bridge can hook the
 * in-iframe game via the window-exposed `__swfBridge` contract
 * (configure / pollItems / sendLocation) and connect to the host via
 * IframeClient.
 *
 * v1 points the iframe at a bundled placeholder page
 * (./modules/swfrecompSubstrate/placeholder/index.html) that stubs the
 * __swfBridge contract, so the whole substrate (registry entry, panel,
 * host module, bridge handshake, loadRegion -> configure, objective ->
 * user:locationCheck) is testable before the real recompiled-game page
 * lands. Swap SWF_IFRAME_SRC to the real page when SWFRecomp-CC ships the
 * __swfBridge surface.
 *
 * Why inject the bridge from the host (rather than ship a wrapper page
 * that hosts game + bridge together): mirrors jtaSubstrateWrapper — keeps
 * the game page Archipelago-naive (it only has to expose __swfBridge),
 * and lets a developer open the page URL standalone to see plain game.
 */

import eventBus from '../../app/core/eventBus.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { SubstrateInactiveOverlay } from '../shared/substrateInactiveOverlay.js';
import { substrateRegistryEntry } from './swfrecompSubstrateLibrary.js';

// Unique iframeId so this wrapper doesn't collide with the
// textAdventureSubstrateWrapper / jtaSubstrateWrapper iframes in
// iframeAdapterCore.iframes. Without it, the AdapterClients default to
// the same passthrough id and the second one overwrites the first's
// window pointer, so forwarded events only reach whichever wrapper
// mounted most recently.
const IFRAME_ID = 'swfrecompSubstrate';
// Placeholder game page for v1. `managed=1` is forwarded for parity with
// the JtA pattern (the real recompiled page can read it to suppress
// auto-start); the placeholder ignores it.
const SWF_IFRAME_SRC = `./modules/swfrecompSubstrate/placeholder/index.html?iframeId=${IFRAME_ID}&managed=1`;
// Relative to SWF_IFRAME_SRC (.../swfrecompSubstrate/placeholder/index.html),
// `../bridge.js` resolves to .../swfrecompSubstrate/bridge.js.
const BRIDGE_SRC = '../bridge.js';

export class SwfrecompSubstratePanel {
    constructor(container, componentState) {
        this.container = container;
        this.componentState = componentState;
        this.rootElement = null;
        this.iframe = null;
        this._inactiveOverlay = null;
        this._activeSubstrate = null;
        this._isLoopModeActive = false;
        this._unsubActiveSubstrate = null;
        this._unsubLoopMode = null;
        this._initializeUI();
        this._subscribeToActiveSubstrate();
        this._subscribeToLoopMode();
    }

    getRootElement() {
        return this.rootElement;
    }

    onMount(container) {
        if (container && typeof container.setTitle === 'function') {
            container.setTitle('Flash (SWFRecomp)');
        }
    }

    _initializeUI() {
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'swfsub-root';
        // Overlay positions itself absolute over the iframe; the wrapper
        // needs a containing block.
        this.rootElement.style.position = 'relative';

        this.iframe = document.createElement('iframe');
        this.iframe.className = 'swfsub-iframe';
        this.iframe.src = SWF_IFRAME_SRC;
        this.iframe.setAttribute('title', 'Flash (SWFRecomp)');
        // allow-scripts: needed to run the game + the bridge.
        // allow-same-origin: needed so the iframe's ES module graph can
        // load — an opaque-origin sandbox can't CORS-fetch its own module
        // graph. Same-origin substrate iframes are accident containment,
        // not a malice boundary (per the external-iframe-modules trust
        // model — same trade-off as jtaSubstrateWrapper).
        this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

        // Inject the bridge after the iframe finishes loading the game
        // page. The bridge completes the iframeAdapter handshake and
        // drives the game from swfrecomp:loadRegion via __swfBridge.
        this.iframe.addEventListener('load', () => this._injectBridge());

        this.rootElement.appendChild(this.iframe);

        this._inactiveOverlay = new SubstrateInactiveOverlay({
            onActivateSubstrate: () => this._activateCurrentSubstratePanel(),
            onActivateLoops: () => this._activateLoopsPanel(),
        });
        this.rootElement.appendChild(this._inactiveOverlay.root);
    }

    _subscribeToActiveSubstrate() {
        if (!eventBus?.subscribe) return;
        const handler = (payload) => {
            this._activeSubstrate = payload || null;
            this._updateInactiveOverlay();
        };
        eventBus.subscribe('procgen:activeSubstrateChanged', handler, 'swfrecompSubstrate');
        this._unsubActiveSubstrate = () =>
            eventBus.unsubscribe?.('procgen:activeSubstrateChanged', handler, 'swfrecompSubstrate');

        const initial = centralRegistry.getPublicFunction?.('procgenPlayer', 'getActiveSubstrate')?.();
        this._activeSubstrate = initial || null;
        this._updateInactiveOverlay();
    }

    _subscribeToLoopMode() {
        if (!eventBus?.subscribe) return;
        const handler = (data) => {
            this._isLoopModeActive = !!data?.active;
            this._updateInactiveOverlay();
        };
        eventBus.subscribe('loopUI:modeChanged', handler, 'swfrecompSubstrate');
        this._unsubLoopMode = () =>
            eventBus.unsubscribe?.('loopUI:modeChanged', handler, 'swfrecompSubstrate');
    }

    _activateCurrentSubstratePanel() {
        const target = this._activeSubstrate?.componentType;
        if (target && eventBus?.publish) {
            eventBus.publish('ui:activatePanel', { panelId: target }, 'swfrecompSubstrate');
        }
    }

    _activateLoopsPanel() {
        if (eventBus?.publish) {
            eventBus.publish('ui:activatePanel', { panelId: 'loopsPanel' }, 'swfrecompSubstrate');
        }
    }

    _updateInactiveOverlay() {
        if (!this._inactiveOverlay || !this.iframe) return;
        const myComponent = substrateRegistryEntry.panelComponentType;
        const active = this._activeSubstrate;
        const isActiveForMe = !!(active && active.componentType === myComponent);

        if (isActiveForMe) {
            this._inactiveOverlay.setVisible(false);
            this.iframe.style.display = '';
            return;
        }

        const state = active ? 'wrong-substrate' : 'no-active-substrate';
        this._inactiveOverlay.update({
            state,
            activeSubstrate: active,
            loopModeActive: !!this._isLoopModeActive,
        });
        this._inactiveOverlay.setVisible(true);
        this.iframe.style.display = 'none';
    }

    _injectBridge() {
        try {
            const doc = this.iframe?.contentDocument;
            if (!doc) {
                console.warn('[swfrecompSubstrate] no contentDocument; bridge not injected');
                return;
            }
            const script = doc.createElement('script');
            script.type = 'module';
            // Resolves to ./modules/swfrecompSubstrate/bridge.js relative
            // to the iframe's URL (.../placeholder/index.html).
            script.src = BRIDGE_SRC;
            doc.body.appendChild(script);
        } catch (err) {
            console.error('[swfrecompSubstrate] bridge injection failed:', err);
        }
    }

    destroy() {
        if (this._unsubActiveSubstrate) { this._unsubActiveSubstrate(); this._unsubActiveSubstrate = null; }
        if (this._unsubLoopMode) { this._unsubLoopMode(); this._unsubLoopMode = null; }
        if (this.iframe) {
            this.iframe.src = 'about:blank';
            this.iframe = null;
        }
        if (this.rootElement && this.rootElement.parentNode) {
            this.rootElement.parentNode.removeChild(this.rootElement);
        }
        this.rootElement = null;
        this._inactiveOverlay = null;
    }
}
