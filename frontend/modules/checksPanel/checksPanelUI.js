/**
 * ChecksPanelUI — the checks line ("Checked: 0/24, Reachable: 10, Unreachable: 14, Events: 0/1") as a panel of
 * its own, for the mini row (modules/miniPanels). Its full view is the same line with room around it.
 */
import eventBus from '../../app/core/eventBus.js';
import { stateManagerProxySingleton } from '../stateManager/index.js';
import { mountChecksLine } from '../commonUI/checksLine.js';

export class ChecksPanelUI {
    constructor(container) {
        this.container = container;
        this._mini = false;
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'checks-panel';
        this._content = document.createElement('div');
        this._content.className = 'checks-panel-content';
        this.rootElement.appendChild(this._content);
        this._line = mountChecksLine(this._content, {
            bus: eventBus, stateManager: stateManagerProxySingleton, moduleName: 'checksPanel',
        });
        this.container?.on?.('destroy', () => this.destroy());
    }

    getRootElement() { return this.rootElement; }

    /** The mini row measures this (its natural height) to size the row. */
    getMiniContentElement() { return this._content; }

    isMiniMode() { return this._mini; }

    setMiniMode(on) {
        this._mini = !!on;
        this.rootElement.classList.toggle('is-mini', this._mini);
    }

    destroy() {
        this._line?.dispose();
        this._line = null;
    }
}
