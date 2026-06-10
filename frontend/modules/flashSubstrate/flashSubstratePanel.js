/**
 * Panel UI class — mounts an iframe pointing at a game page that exposes
 * the `__swfBridge` contract (configure / pollItems / sendLocation /
 * sendExit). After the iframe loads, the panel injects bridge.js into the
 * iframe document so the bridge can hook the in-iframe game and connect
 * to the host via IframeClient.
 *
 * The class is built by a factory (`createSubstrateIframePanelClass`) so
 * other substrates that speak the same `__swfBridge` contract can reuse
 * the panel with their own game page / component identity — bounceDemo
 * is the first (its JS game page was developed standalone-first against
 * a stubbed bridge precisely so embedding is a config swap, not a port).
 * Flash's own panel is the factory applied to the v1 placeholder page
 * (which stubs the contract so the whole substrate — registry entry,
 * panel, host module, bridge handshake, loadRegion -> configure,
 * objective -> user:locationCheck — is testable before the real
 * recompiled-game page lands).
 *
 * Why inject the bridge from the host (rather than ship a wrapper page
 * that hosts game + bridge together): mirrors jtaSubstrateWrapper — keeps
 * the game page Archipelago-naive (it only has to expose __swfBridge),
 * and lets a developer open the page URL standalone to see plain game.
 */

import eventBus from '../../app/core/eventBus.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { SubstrateInactiveOverlay } from '../shared/substrateInactiveOverlay.js';

/**
 * Build a panel UI class for a `__swfBridge`-contract game iframe.
 *
 * @param {object} config
 * @param {string} config.componentType  Golden Layout component type this
 *   panel is registered under — also what procgen:activeSubstrateChanged
 *   payloads are compared against for the inactive overlay.
 * @param {string} config.title          Panel tab title.
 * @param {string} config.iframeSrc      Game page URL. Must carry a unique
 *   `iframeId` query param so this wrapper doesn't collide with the other
 *   substrate iframes in iframeAdapterCore.iframes — without it, the
 *   AdapterClients default to the same passthrough id and the second one
 *   overwrites the first's window pointer, so forwarded events only reach
 *   whichever wrapper mounted most recently. The bridge also reads its
 *   loadRegion event name from a `loadRegionEvent` query param here
 *   (defaults to flash:loadRegion — see bridge.js).
 * @param {string} config.bridgeSrc      URL of bridge.js as resolvable
 *   FROM THE IFRAME PAGE's URL (script src is injected into the iframe
 *   document, so relative paths resolve against iframeSrc, not the host).
 * @param {string} config.moduleName     eventBus subscriber id + log tag.
 */
export function createSubstrateIframePanelClass({
    componentType,
    title,
    iframeSrc,
    bridgeSrc,
    moduleName,
}) {
    return class SubstrateIframePanel {
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
                container.setTitle(title);
            }
        }

        _initializeUI() {
            this.rootElement = document.createElement('div');
            this.rootElement.className = 'flashsub-root';
            // Overlay positions itself absolute over the iframe; the wrapper
            // needs a containing block.
            this.rootElement.style.position = 'relative';

            this.iframe = document.createElement('iframe');
            this.iframe.className = 'flashsub-iframe';
            this.iframe.src = iframeSrc;
            this.iframe.setAttribute('title', title);
            // allow-scripts: needed to run the game + the bridge.
            // allow-same-origin: needed so the iframe's ES module graph can
            // load — an opaque-origin sandbox can't CORS-fetch its own module
            // graph. Same-origin substrate iframes are accident containment,
            // not a malice boundary (per the external-iframe-modules trust
            // model — same trade-off as jtaSubstrateWrapper).
            this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

            // Inject the bridge after the iframe finishes loading the game
            // page. The bridge completes the iframeAdapter handshake and
            // drives the game from its loadRegion event via __swfBridge.
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
            eventBus.subscribe('procgen:activeSubstrateChanged', handler, moduleName);
            this._unsubActiveSubstrate = () =>
                eventBus.unsubscribe?.('procgen:activeSubstrateChanged', handler, moduleName);

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
            eventBus.subscribe('loopUI:modeChanged', handler, moduleName);
            this._unsubLoopMode = () =>
                eventBus.unsubscribe?.('loopUI:modeChanged', handler, moduleName);
        }

        _activateCurrentSubstratePanel() {
            const target = this._activeSubstrate?.componentType;
            if (target && eventBus?.publish) {
                eventBus.publish('ui:activatePanel', { panelId: target }, moduleName);
            }
        }

        _activateLoopsPanel() {
            if (eventBus?.publish) {
                eventBus.publish('ui:activatePanel', { panelId: 'loopsPanel' }, moduleName);
            }
        }

        _updateInactiveOverlay() {
            if (!this._inactiveOverlay || !this.iframe) return;
            const active = this._activeSubstrate;
            const isActiveForMe = !!(active && active.componentType === componentType);

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
                    console.warn(`[${moduleName}] no contentDocument; bridge not injected`);
                    return;
                }
                const script = doc.createElement('script');
                script.type = 'module';
                script.src = bridgeSrc;
                doc.body.appendChild(script);
            } catch (err) {
                console.error(`[${moduleName}] bridge injection failed:`, err);
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
    };
}

// ── Flash's own panel: the factory applied to the v1 placeholder page ──

// Unique iframeId — see the factory's iframeSrc doc for why collisions
// between substrate wrapper iframes break event forwarding.
const IFRAME_ID = 'flashSubstrate';
// Placeholder game page for v1. `managed=1` is forwarded for parity with
// the JtA pattern (the real recompiled page can read it to suppress
// auto-start); the placeholder ignores it. Swap to the real recompiled
// page when SWFRecomp-CC ships the __swfBridge surface.
const SWF_IFRAME_SRC = `./modules/flashSubstrate/placeholder/index.html?iframeId=${IFRAME_ID}&managed=1`;

export const FlashSubstratePanel = createSubstrateIframePanelClass({
    componentType: 'flashSubstratePanel',
    title: 'Flash',
    iframeSrc: SWF_IFRAME_SRC,
    // Relative to SWF_IFRAME_SRC (.../flashSubstrate/placeholder/index.html),
    // `../bridge.js` resolves to .../flashSubstrate/bridge.js.
    bridgeSrc: '../bridge.js',
    moduleName: 'flashSubstrate',
});
