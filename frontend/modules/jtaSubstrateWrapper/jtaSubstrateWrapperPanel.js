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
import { substrateRegistryEntry, setJtaDataset, getJtaDataset } from './jtaSubstrateWrapperLibrary.js';
import { importDatasetText, exportDatasetText } from './datasetTransfer.js';
import { JTA_VANILLA_DATASET } from './vanillaDataset.js';

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
        // No sandbox attribute: this iframe loads first-party, same-origin
        // content that must run JtA + the bridge AND fetch its own ES module
        // graph (JtA's build/game.js and its imports; an opaque-origin sandbox
        // can't CORS-fetch its own module graph). Both needs force
        // `allow-scripts allow-same-origin`, which already disables origin
        // isolation — so the sandbox attribute was no real boundary, only the
        // source of the browser's "can escape its sandboxing" warning.
        // Same-origin substrate iframes are accident containment, not a malice
        // boundary (external-iframe-modules trust model), so it is omitted.

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

        this.rootElement.appendChild(this._buildDatasetToolbar());
        this.rootElement.appendChild(this.iframe);

        this._inactiveOverlay = new SubstrateInactiveOverlay({
            onActivateSubstrate: () => this._activateCurrentSubstratePanel(),
            onActivateLoops: () => this._activateLoopsPanel(),
        });
        this.rootElement.appendChild(this._inactiveOverlay.root);
    }

    // New-stack dataset import/export toolbar (synthetic-data rider D-b).
    // Import: file-picker -> datasetTransfer.importDatasetText (restamp if
    // hand-edited, authoritative validation) -> setJtaDataset (host zone
    // view) + iframe loadGameData (the game re-inits against the
    // dataset-keyed save slot). Export: download the CURRENT world's
    // DOCUMENT (live dataset, or the vanilla fixture when none is loaded) —
    // the document, not the mutated live state, so import->export->import
    // is a fixed point. Note a manual import overrides the live game until
    // the next region load re-applies the world's own carriage (the bridge
    // re-applies per dataset_id). Byte-inert until a button is clicked.
    _buildDatasetToolbar() {
        const bar = document.createElement('div');
        bar.className = 'jtasw-dataset-toolbar';

        const importBtn = document.createElement('button');
        importBtn.type = 'button';
        importBtn.textContent = 'Import dataset…';

        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.textContent = 'Export dataset';

        const status = document.createElement('span');
        status.className = 'jtasw-dataset-status';

        const setStatus = (text, isError = false) => {
            status.textContent = text;
            status.classList.toggle('jtasw-dataset-status-error', isError);
        };

        const filePicker = document.createElement('input');
        filePicker.type = 'file';
        filePicker.accept = '.json,application/json';
        filePicker.style.display = 'none';

        filePicker.addEventListener('change', () => {
            const file = filePicker.files?.[0];
            filePicker.value = '';
            if (!file) return;
            file.text().then((text) => {
                const result = importDatasetText(text);
                if (!result.ok) {
                    console.error('[jtaSubstrateWrapper] dataset import failed:', result.errors);
                    setStatus(`import failed: ${result.errors[0]}${result.errors.length > 1 ? ` (+${result.errors.length - 1} more — see console)` : ''}`, true);
                    return;
                }
                const win = this.iframe?.contentWindow;
                if (typeof win?.loadGameData !== 'function') {
                    setStatus('import failed: game iframe not ready', true);
                    return;
                }
                const load = win.loadGameData(result.doc);
                if (!load?.ok) {
                    console.error('[jtaSubstrateWrapper] game rejected the dataset:', load?.errors);
                    setStatus(`import failed: game rejected the dataset (see console)`, true);
                    return;
                }
                setJtaDataset(result.doc);
                setStatus(`live: ${result.doc.dataset_id}${result.restamped ? ' (edited — restamped)' : ''}`);
            }, (e) => setStatus(`import failed: ${e.message}`, true));
        });

        importBtn.addEventListener('click', () => filePicker.click());
        exportBtn.addEventListener('click', () => {
            const doc = getJtaDataset() ?? JTA_VANILLA_DATASET;
            const blob = new Blob([exportDatasetText(doc)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${doc.dataset_id}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
            setStatus(`exported: ${doc.dataset_id}`);
        });

        bar.append(importBtn, exportBtn, status, filePicker);
        return bar;
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
        eventBus.subscribe('gameState:loopModeChanged', handler, 'jtaSubstrateWrapper');
        this._unsubLoopMode = () =>
            eventBus.unsubscribe?.('gameState:loopModeChanged', handler, 'jtaSubstrateWrapper');
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
