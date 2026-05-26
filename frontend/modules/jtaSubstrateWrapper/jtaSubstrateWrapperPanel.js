/**
 * Panel UI class — mounts an iframe pointing at the JtA fork's own
 * index.html (loaded as a same-origin local page from the submodule
 * at frontend/modules/journey-to-ascension/). After the iframe loads,
 * the panel injects bridge.js into the iframe document so the bridge
 * can hook the in-iframe JtA via the window-exposed substrate API
 * (setManagedMode / pauseGameLoop / initializeHeadless / etc.) and
 * connect to the host via IframeClient.
 *
 * Why inject the bridge from the host (rather than ship a wrapper
 * page that hosts JtA + bridge together):
 *  - JtA is a self-contained app, not a library; the cleanest way to
 *    run it unmodified is to point the iframe at its own index.html.
 *  - Injecting from the host keeps the fork edits minimal: the fork
 *    only needs the window-exposed hooks (Phase 3); it doesn't need to
 *    know anything about Archipelago or the bridge.
 *  - Direct iframe.src = jta/index.html means a developer can open the
 *    URL standalone and see plain JtA — useful for debugging the fork
 *    in isolation.
 */

import eventBus from '../../app/core/eventBus.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { SubstrateInactiveOverlay } from '../shared/substrateInactiveOverlay.js';
import { substrateRegistryEntry } from './jtaSubstrateWrapperLibrary.js';

// Unique iframeId so this wrapper doesn't collide with the
// textAdventureSubstrateWrapper iframe in iframeAdapterCore.iframes.
// Without it, both wrappers' AdapterClients default to
// generateClientId('iframe-client') — which is a passthrough — and
// register as the same id; the second one overwrites the first's
// window pointer, so forwarded events only reach whichever wrapper
// mounted most recently.
const IFRAME_ID = 'jtaSubstrateWrapper';
// `managed=1` tells the JtA fork to flip on managed mode at module load
// (before DOMContentLoaded), so its auto-bootstrap doesn't load/save state
// or start the tick loop. Without it, the fork builds task DOM whose
// click handlers close over Task instances the bridge would later orphan
// when wiping GAMESTATE — producing the "first-load clicks register no
// completion until the next reset" bug.
const JTA_IFRAME_SRC = `./modules/journey-to-ascension/index.html?iframeId=${IFRAME_ID}&managed=1`;
const BRIDGE_SRC = '../jtaSubstrateWrapper/bridge.js';  // relative to JTA_IFRAME_SRC

export class JtaSubstrateWrapperPanel {
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
            container.setTitle('Journey to Ascension');
        }
    }

    _initializeUI() {
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'jtasw-root';
        // Overlay positions itself absolute over the iframe; the
        // wrapper needs a containing block.
        this.rootElement.style.position = 'relative';

        this.iframe = document.createElement('iframe');
        this.iframe.className = 'jtasw-iframe';
        this.iframe.src = JTA_IFRAME_SRC;
        this.iframe.setAttribute('title', 'Journey to Ascension');
        // allow-scripts: needed to run JtA and the bridge.
        // allow-same-origin: needed so the iframe's ES module graph
        // (JtA's own build/game.js and its imports) can load — an
        // opaque-origin sandbox can't CORS-fetch its own module graph.
        // The trade-off (the browser's "can escape sandboxing" warning)
        // is documented in the external-iframe-modules trust-model
        // plan: same-origin substrate iframes are accident containment,
        // not a malice boundary.
        this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

        // Inject the bridge after the iframe finishes loading JtA. By
        // this point JtA has already flipped on managed mode (via the
        // ?managed=1 URL param read in game.ts before DOMContentLoaded),
        // initialized a fresh GAMESTATE, built its task DOM bound to
        // that GAMESTATE's Task instances, and skipped the tick loop.
        // The bridge then completes the iframeAdapter handshake and
        // drives region transitions via loadZone (which rebuilds the
        // task DOM on each call so click handlers stay bound to the
        // current GAMESTATE.tasks).
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
        eventBus.subscribe('procgen:activeSubstrateChanged', handler, 'jtaSubstrateWrapper');
        this._unsubActiveSubstrate = () =>
            eventBus.unsubscribe?.('procgen:activeSubstrateChanged', handler, 'jtaSubstrateWrapper');

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
        eventBus.subscribe('loopUI:modeChanged', handler, 'jtaSubstrateWrapper');
        this._unsubLoopMode = () =>
            eventBus.unsubscribe?.('loopUI:modeChanged', handler, 'jtaSubstrateWrapper');
    }

    _activateCurrentSubstratePanel() {
        const target = this._activeSubstrate?.componentType;
        if (target && eventBus?.publish) {
            eventBus.publish('ui:activatePanel', { panelId: target }, 'jtaSubstrateWrapper');
        }
    }

    _activateLoopsPanel() {
        if (eventBus?.publish) {
            eventBus.publish('ui:activatePanel', { panelId: 'loopsPanel' }, 'jtaSubstrateWrapper');
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
                console.warn('[jtaSubstrateWrapper] no contentDocument; bridge not injected');
                return;
            }
            const script = doc.createElement('script');
            script.type = 'module';
            // Resolves to ./modules/jtaSubstrateWrapper/bridge.js
            // relative to the iframe's URL.
            script.src = BRIDGE_SRC;
            doc.body.appendChild(script);
        } catch (err) {
            console.error('[jtaSubstrateWrapper] bridge injection failed:', err);
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
