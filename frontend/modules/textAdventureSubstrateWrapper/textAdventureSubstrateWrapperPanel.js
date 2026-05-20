/**
 * Panel UI class — mounts an iframe pointing at the wrapper's
 * index-iframe.html. The bridge.js loaded inside that iframe drives
 * the engine and communicates with the host via IframeClient (which
 * uses the existing iframeAdapter postMessage protocol).
 */

const IFRAME_SRC = './modules/textAdventureSubstrateWrapper/index-iframe.html';

export class TextAdventureSubstrateWrapperPanel {
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
            container.setTitle('Text Adventure (wrapper)');
        }
    }

    _initializeUI() {
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'tasw-root';

        this.iframe = document.createElement('iframe');
        this.iframe.className = 'tasw-iframe';
        this.iframe.src = IFRAME_SRC;
        this.iframe.setAttribute('title', 'Text Adventure (wrapper)');
        // Both flags are required; the resulting "can escape sandboxing"
        // browser warning is unavoidable. allow-scripts runs bridge.js;
        // allow-same-origin lets the iframe fetch its own ES module graph
        // (an opaque-origin sandbox can't load same-server module scripts —
        // they go through CORS and get blocked). Verified 2026-05-20:
        // dropping allow-same-origin fails with "Module source URI is not
        // allowed in this document".
        this.iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        this.rootElement.appendChild(this.iframe);
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
