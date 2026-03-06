// Stub queue display panel - shows current queue entries and execution state
import { ActionState } from '../shared/actionQueue/actionTypes.js';

export class JTAQueuePanelUI {
    /** @type {HTMLElement} */
    #container;

    /** @type {import('../shared/actionQueue/actionQueue.js').ActionQueue|null} */
    #queue = null;

    constructor(container) {
        this.#container = container;
        this.#render();
    }

    /**
     * Bind to a queue for display
     * @param {import('../shared/actionQueue/actionQueue.js').ActionQueue} queue
     */
    bind(queue) {
        this.#queue = queue;
        this.refresh();
    }

    /** Refresh the display */
    refresh() {
        const list = this.#container.querySelector('.aq-queue-list');
        if (!list || !this.#queue) return;

        const entries = this.#queue.getEntries();
        if (entries.length === 0) {
            list.innerHTML = '<div class="aq-empty">Queue is empty. Add actions from the Actions panel.</div>';
            return;
        }

        const cursor = this.#queue.cursor;
        list.innerHTML = entries.map((entry, idx) => {
            const status = this.#queue.getStatus(entry.entryId);
            const stateClass = status ? `aq-state-${status.state}` : '';
            const isCurrent = idx === cursor && this.#queue.running;
            const currentClass = isCurrent ? 'aq-current' : '';
            const disabledClass = entry.disabled ? 'aq-disabled' : '';
            const loopText = entry.loops > 1 ? ` x${entry.loops}` : '';
            const loopProgress = status && status.loopsCompleted > 0 ? ` (${status.loopsCompleted}/${entry.loops})` : '';

            return `<div class="aq-entry ${stateClass} ${currentClass} ${disabledClass}" data-entry-id="${entry.entryId}">
                <span class="aq-entry-index">${idx + 1}</span>
                <span class="aq-entry-label">${entry.label}${loopText}${loopProgress}</span>
                <span class="aq-entry-group">${entry.group || ''}</span>
                <span class="aq-entry-state">${status ? status.state : ''}</span>
                <button class="aq-remove-btn" data-entry-id="${entry.entryId}" title="Remove">&times;</button>
            </div>`;
        }).join('');
    }

    /** @private */
    #render() {
        this.#container.innerHTML = `
            <div class="aq-queue-panel">
                <div class="aq-queue-header">
                    <strong>Action Queue</strong>
                </div>
                <div class="aq-queue-list"></div>
            </div>
        `;

        // Handle remove button clicks
        this.#container.addEventListener('click', (e) => {
            const btn = e.target.closest('.aq-remove-btn');
            if (btn && this.#queue) {
                const entryId = btn.dataset.entryId;
                this.#queue.remove(entryId);
                this.refresh();
            }
        });
    }
}
