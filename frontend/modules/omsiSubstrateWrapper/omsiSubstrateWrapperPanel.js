/**
 * Panel UI class — mounts an iframe pointing at the omsi-loops fork's
 * own index.html (the PeerInfinity/omsi-loops submodule at
 * frontend/modules/omsi-loops/). `?managed=1` makes the fork boot in
 * managed mode BEFORE any host code runs: index.html's boot script
 * calls IdleLoopsManaged.boot() instead of startGame(), so the game
 * loads from its dedicated `idleLoops_substrate` save slot and the
 * clock never starts (time advances only through the bridge's
 * host-driven step() calls).
 *
 * After the iframe finishes loading, the panel injects bridge.js into
 * the iframe document (same host-injection pattern as the jta
 * wrapper): the fork stays Archipelago-ignorant, and opening the
 * iframe URL standalone shows plain managed-mode Idle Loops for
 * debugging the fork in isolation.
 */

import eventBus from '../../app/core/eventBus.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { SubstrateInactiveOverlay } from '../shared/substrateInactiveOverlay.js';
import { substrateRegistryEntry } from './omsiSubstrateWrapperLibrary.js';

// Unique iframeId so this wrapper doesn't collide with the other
// substrate-wrapper iframes in iframeAdapterCore.iframes (without it,
// AdapterClients register under the same generated id and forwarded
// events only reach whichever wrapper mounted most recently).
const IFRAME_ID = 'omsiSubstrateWrapper';
const OMSI_IFRAME_SRC = `./modules/omsi-loops/index.html?iframeId=${IFRAME_ID}&managed=1`;
const BRIDGE_SRC = '../omsiSubstrateWrapper/bridge.js';  // relative to OMSI_IFRAME_SRC

export class OmsiSubstrateWrapperPanel {
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
            container.setTitle('Idle Loops');
        }
    }

    _initializeUI() {
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'omsisw-root';
        // Overlay positions itself absolute over the iframe; the
        // wrapper needs a containing block.
        this.rootElement.style.position = 'relative';

        this.iframe = document.createElement('iframe');
        this.iframe.className = 'omsisw-iframe';
        this.iframe.src = OMSI_IFRAME_SRC;
        this.iframe.setAttribute('title', 'Idle Loops');
        // No sandbox attribute — same reasoning as the jta wrapper:
        // first-party same-origin content that must run scripts AND
        // fetch its own resources needs `allow-scripts
        // allow-same-origin`, which already disables origin isolation,
        // so the attribute would be no real boundary.

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
        eventBus.subscribe('procgen:activeSubstrateChanged', handler, 'omsiSubstrateWrapper');
        this._unsubActiveSubstrate = () =>
            eventBus.unsubscribe?.('procgen:activeSubstrateChanged', handler, 'omsiSubstrateWrapper');

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
        eventBus.subscribe('gameState:loopModeChanged', handler, 'omsiSubstrateWrapper');
        this._unsubLoopMode = () =>
            eventBus.unsubscribe?.('gameState:loopModeChanged', handler, 'omsiSubstrateWrapper');
    }

    _activateCurrentSubstratePanel() {
        const target = this._activeSubstrate?.componentType;
        if (target && eventBus?.publish) {
            eventBus.publish('ui:activatePanel', { panelId: target }, 'omsiSubstrateWrapper');
        }
    }

    _activateLoopsPanel() {
        if (eventBus?.publish) {
            eventBus.publish('ui:activatePanel', { panelId: 'loopsPanel' }, 'omsiSubstrateWrapper');
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
                console.warn('[omsiSubstrateWrapper] no contentDocument; bridge not injected');
                return;
            }
            const script = doc.createElement('script');
            script.type = 'module';
            // Resolves to ./modules/omsiSubstrateWrapper/bridge.js
            // relative to the iframe's URL.
            script.src = BRIDGE_SRC;
            doc.body.appendChild(script);
        } catch (err) {
            console.error('[omsiSubstrateWrapper] bridge injection failed:', err);
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
