/**
 * Panel UI class — mounts an iframe pointing at the wrapper's
 * index-iframe.html. The bridge.js loaded inside that iframe drives
 * the engine and communicates with the host via IframeClient (which
 * uses the existing iframeAdapter postMessage protocol).
 */

import eventBus from '../../app/core/eventBus.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { SubstrateInactiveOverlay } from '../shared/substrateInactiveOverlay.js';
import { substrateRegistryEntry } from './textAdventureSubstrateWrapperLibrary.js';

export const PANEL_SHOWN_EVENT = 'textAdventureSubstrateWrapper:panelShown';

// Unique iframeId so multiple wrapper panels each get their own slot
// in iframeAdapterCore.iframes — without this, the in-iframe
// AdapterClient defaults to generateClientId('iframe-client'),
// which returns the customName unchanged. Every wrapper would then
// register as "iframe-client" and the second mount would silently
// overwrite the first one's window pointer (every subsequent
// forwarded event would go only to whichever wrapper registered
// most recently). See modules/shared/communicationProtocol.js
// generateClientId() for the unchanged-passthrough.
const IFRAME_ID = 'textAdventureSubstrateWrapper';
const IFRAME_SRC = `./modules/textAdventureSubstrateWrapper/index-iframe.html?iframeId=${IFRAME_ID}`;

export class TextAdventureSubstrateWrapperPanel {
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
            container.setTitle('Text Adventure (wrapper)');
        }
    }

    /**
     * Called by panelManager when this panel becomes the active tab
     * in its Golden Layout stack. Used to refocus the engine's
     * command input across the iframe boundary — the iframe content
     * stays alive when GL hides the tab (CSS display:none), but
     * focus is lost. Publish a host-side event the bridge subscribes
     * to so the engine can re-focus its input when the player
     * returns.
     */
    onShow() {
        eventBus.publish(PANEL_SHOWN_EVENT, {});
    }

    _initializeUI() {
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'tasw-root';
        // Overlay positions itself absolute over the iframe; the
        // wrapper needs a containing block.
        this.rootElement.style.position = 'relative';

        this.iframe = document.createElement('iframe');
        this.iframe.className = 'tasw-iframe';
        this.iframe.src = IFRAME_SRC;
        this.iframe.setAttribute('title', 'Text Adventure (wrapper)');
        // No sandbox attribute: this iframe loads first-party, same-origin
        // content that must run bridge.js AND fetch its own ES module graph.
        // Both needs force `allow-scripts allow-same-origin` (verified
        // 2026-05-20: dropping allow-same-origin fails with "Module source URI
        // is not allowed in this document"), and that combination already
        // disables origin isolation — so the sandbox attribute was no real
        // boundary, only the source of the browser's "can escape its
        // sandboxing" warning. Same-origin substrate iframes are accident
        // containment, not a malice boundary, so the attribute is omitted.
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
        eventBus.subscribe('procgen:activeSubstrateChanged', handler, 'textAdventureSubstrateWrapper');
        this._unsubActiveSubstrate = () =>
            eventBus.unsubscribe?.('procgen:activeSubstrateChanged', handler, 'textAdventureSubstrateWrapper');

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
        eventBus.subscribe('loopUI:modeChanged', handler, 'textAdventureSubstrateWrapper');
        this._unsubLoopMode = () =>
            eventBus.unsubscribe?.('loopUI:modeChanged', handler, 'textAdventureSubstrateWrapper');
    }

    _activateCurrentSubstratePanel() {
        const target = this._activeSubstrate?.componentType;
        if (target && eventBus?.publish) {
            eventBus.publish('ui:activatePanel', { panelId: target }, 'textAdventureSubstrateWrapper');
        }
    }

    _activateLoopsPanel() {
        if (eventBus?.publish) {
            eventBus.publish('ui:activatePanel', { panelId: 'loopsPanel' }, 'textAdventureSubstrateWrapper');
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
