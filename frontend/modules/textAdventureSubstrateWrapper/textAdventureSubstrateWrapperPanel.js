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
        // Allow scripts + same-origin so the bridge can use IframeClient
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
