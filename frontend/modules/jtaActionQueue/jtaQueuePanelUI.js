// Queue display panel - shows queue entries with per-action controls and drag-and-drop
import { ActionState } from '../shared/actionQueue/actionTypes.js';

export class JTAQueuePanelUI {
    /** @type {HTMLElement} */
    #container;

    /** @type {import('../shared/actionQueue/actionQueue.js').ActionQueue|null} */
    #queue = null;

    /** @type {Function|null} */
    #onQueueChanged = null;

    /** @type {number} Amount to add/remove per click */
    #addAmount = 1;

    /** @type {string|null} entryId being dragged */
    #dragSourceId = null;

    constructor(container) {
        this.#container = container;
        this.#render();
    }

    /**
     * Bind to a queue for display
     * @param {import('../shared/actionQueue/actionQueue.js').ActionQueue} queue
     * @param {Function} [onQueueChanged] - Called when queue is modified by UI
     */
    bind(queue, onQueueChanged) {
        this.#queue = queue;
        this.#onQueueChanged = onQueueChanged || null;
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

            return `<div class="aq-entry ${stateClass} ${currentClass} ${disabledClass}" data-entry-id="${entry.entryId}" data-index="${idx}" draggable="true">
                <span class="aq-entry-index">${idx + 1}</span>
                <span class="aq-entry-label">${entry.label}${loopText}${loopProgress}</span>
                <span class="aq-entry-group">${entry.group || ''}</span>
                <span class="aq-entry-state">${status ? status.state : ''}</span>
                <div class="aq-entry-buttons">
                    <button class="aq-btn aq-btn-up" data-action="up" title="Move up">&uarr;</button>
                    <button class="aq-btn aq-btn-down" data-action="down" title="Move down">&darr;</button>
                    <button class="aq-btn aq-btn-plus" data-action="plus" title="Add loops (+${this.#addAmount})">+</button>
                    <button class="aq-btn aq-btn-minus" data-action="minus" title="Remove loops (-${this.#addAmount})">&minus;</button>
                    <button class="aq-btn aq-btn-disable" data-action="disable" title="${entry.disabled ? 'Enable' : 'Disable'}">${entry.disabled ? '&#x25cb;' : '&#x2298;'}</button>
                    <button class="aq-btn aq-btn-remove" data-action="remove" title="Remove">&times;</button>
                </div>
            </div>`;
        }).join('');
    }

    /** @private */
    #render() {
        this.#container.innerHTML = `
            <div class="aq-queue-panel">
                <div class="aq-queue-header">
                    <strong>Action Queue</strong>
                    <div class="aq-amount-selector">
                        <span class="aq-amount-label">&plusmn;</span>
                        <button class="aq-amount-btn aq-amount-active" data-amount="1">1</button>
                        <button class="aq-amount-btn" data-amount="5">5</button>
                        <button class="aq-amount-btn" data-amount="10">10</button>
                        <input type="number" class="aq-amount-input" min="1" max="999999" value="" placeholder="#" title="Custom loop amount" style="width: 40px; background: #333; color: #ccc; border: 1px solid #555; border-radius: 3px; padding: 1px 3px; font-size: 0.75em;">
                    </div>
                </div>
                <div class="aq-queue-list" style="padding-bottom: 8px;"></div>
            </div>
        `;

        const amountSelector = this.#container.querySelector('.aq-amount-selector');

        // Amount button clicks
        amountSelector.addEventListener('click', (e) => {
            const btn = e.target.closest('.aq-amount-btn');
            if (!btn) return;
            this.#addAmount = parseInt(btn.dataset.amount, 10);
            amountSelector.querySelectorAll('.aq-amount-btn').forEach(b => b.classList.remove('aq-amount-active'));
            btn.classList.add('aq-amount-active');
            amountSelector.querySelector('.aq-amount-input').value = '';
            this.refresh();
        });

        // Custom amount input
        amountSelector.querySelector('.aq-amount-input').addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (val > 0) {
                this.#addAmount = val;
                amountSelector.querySelectorAll('.aq-amount-btn').forEach(b => b.classList.remove('aq-amount-active'));
                this.refresh();
            }
        });

        // Delegated click handler for all entry buttons
        this.#container.querySelector('.aq-queue-list').addEventListener('click', (e) => {
            const btn = e.target.closest('.aq-btn');
            if (!btn || !this.#queue) return;

            const entryEl = btn.closest('.aq-entry');
            if (!entryEl) return;
            const entryId = entryEl.dataset.entryId;
            const idx = parseInt(entryEl.dataset.index, 10);
            const action = btn.dataset.action;

            switch (action) {
                case 'up':
                    if (idx > 0) {
                        this.#queue.reorder(idx, idx - 1);
                        this.#notifyChanged();
                    }
                    break;
                case 'down':
                    if (idx < this.#queue.length - 1) {
                        this.#queue.reorder(idx, idx + 1);
                        this.#notifyChanged();
                    }
                    break;
                case 'plus': {
                    const entries = this.#queue.getEntries();
                    const entry = entries[idx];
                    if (entry) {
                        const newLoops = Math.min(entry.loops + this.#addAmount, 1e12);
                        this.#queue.updateEntry(entryId, { loops: newLoops });
                        this.#notifyChanged();
                    }
                    break;
                }
                case 'minus': {
                    const entries = this.#queue.getEntries();
                    const entry = entries[idx];
                    if (entry) {
                        const newLoops = Math.max(entry.loops - this.#addAmount, 1);
                        this.#queue.updateEntry(entryId, { loops: newLoops });
                        this.#notifyChanged();
                    }
                    break;
                }
                case 'disable': {
                    const entries = this.#queue.getEntries();
                    const entry = entries[idx];
                    if (entry) {
                        this.#queue.updateEntry(entryId, { disabled: !entry.disabled });
                        this.#notifyChanged();
                    }
                    break;
                }
                case 'remove':
                    this.#queue.remove(entryId);
                    this.#notifyChanged();
                    break;
            }
        });

        // Drag-and-drop on the queue list
        const list = this.#container.querySelector('.aq-queue-list');
        list.addEventListener('dragstart', (e) => {
            const entryEl = e.target.closest('.aq-entry');
            if (!entryEl) return;
            this.#dragSourceId = entryEl.dataset.entryId;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', entryEl.dataset.entryId);
            entryEl.classList.add('aq-dragging');
        });

        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const entryEl = e.target.closest('.aq-entry');
            // Clear all drag-over highlights
            list.querySelectorAll('.aq-drag-over').forEach(el => el.classList.remove('aq-drag-over'));
            if (entryEl && entryEl.dataset.entryId !== this.#dragSourceId) {
                entryEl.classList.add('aq-drag-over');
            }
        });

        list.addEventListener('dragleave', (e) => {
            const entryEl = e.target.closest('.aq-entry');
            if (entryEl) entryEl.classList.remove('aq-drag-over');
        });

        list.addEventListener('drop', (e) => {
            e.preventDefault();
            list.querySelectorAll('.aq-drag-over').forEach(el => el.classList.remove('aq-drag-over'));

            if (!this.#queue) return;

            const targetEl = e.target.closest('.aq-entry');
            if (!targetEl) return;

            const targetIndex = parseInt(targetEl.dataset.index, 10);

            // Check if this is a drag from the actions panel (external)
            const actionData = e.dataTransfer.getData('application/aq-action');
            if (actionData) {
                try {
                    const parsed = JSON.parse(actionData);
                    if (parsed && parsed.actionType && this.#onExternalDrop) {
                        this.#onExternalDrop(parsed, targetIndex);
                    }
                } catch (err) { /* ignore */ }
                return;
            }

            // Internal reorder
            if (this.#dragSourceId) {
                const fromIndex = this.#queue.findIndex(this.#dragSourceId);
                if (fromIndex !== -1 && fromIndex !== targetIndex) {
                    this.#queue.reorder(fromIndex, targetIndex);
                    this.#notifyChanged();
                }
            }
        });

        list.addEventListener('dragend', () => {
            this.#dragSourceId = null;
            list.querySelectorAll('.aq-dragging').forEach(el => el.classList.remove('aq-dragging'));
            list.querySelectorAll('.aq-drag-over').forEach(el => el.classList.remove('aq-drag-over'));
        });
    }

    /** @type {Function|null} */
    #onExternalDrop = null;

    /**
     * Set a handler for when an action is dragged from the actions panel onto the queue
     * @param {Function} handler - (catalogEntry, targetIndex) => void
     */
    set onExternalDrop(handler) {
        this.#onExternalDrop = handler;
    }

    #notifyChanged() {
        this.refresh();
        if (this.#onQueueChanged) this.#onQueueChanged();
    }
}
