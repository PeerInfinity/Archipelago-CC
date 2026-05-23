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

// Unique iframeId so this wrapper doesn't collide with the
// textAdventureSubstrateWrapper iframe in iframeAdapterCore.iframes.
// Without it, both wrappers' AdapterClients default to
// generateClientId('iframe-client') — which is a passthrough — and
// register as the same id; the second one overwrites the first's
// window pointer, so forwarded events only reach whichever wrapper
// mounted most recently.
const IFRAME_ID = 'jtaSubstrateWrapper';
const JTA_IFRAME_SRC = `./modules/journey-to-ascension/index.html?iframeId=${IFRAME_ID}`;
const BRIDGE_SRC = '../jtaSubstrateWrapper/bridge.js';  // relative to JTA_IFRAME_SRC

export class JtaSubstrateWrapperPanel {
    constructor(container, componentState) {
        this.container = container;
        this.componentState = componentState;
        this.rootElement = null;
        this.iframe = null;
        this._initializeUI();
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
        // this point JtA has constructed GAMESTATE, run start() (which
        // calls loadGame), kicked off rendering, and started its tick
        // loop. The bridge then calls setManagedMode(true), pauses the
        // loop, and calls initializeHeadless() to wipe the loaded
        // state. There is a brief window where JtA's localStorage is
        // touched before the bridge can suppress saves; this is
        // acceptable for v1 and revisitable post-v1 if it matters.
        this.iframe.addEventListener('load', () => this._injectBridge());

        this.rootElement.appendChild(this.iframe);
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
        if (this.iframe) {
            this.iframe.src = 'about:blank';
            this.iframe = null;
        }
        if (this.rootElement && this.rootElement.parentNode) {
            this.rootElement.parentNode.removeChild(this.rootElement);
        }
        this.rootElement = null;
    }
}
