// Stub actions button panel - shows available actions as a button grid
import { createQueueEntry } from './jtaActionDefs.js';

export class JTAActionsPanelUI {
    /** @type {HTMLElement} */
    #container;

    /** @type {import('../shared/actionQueue/actionQueue.js').ActionQueue|null} */
    #queue = null;

    /** @type {object|null} Catalog from buildActionCatalog() */
    #catalog = null;

    /** @type {Function|null} */
    #onQueueChanged = null;

    constructor(container) {
        this.#container = container;
        this.#render();
    }

    /**
     * Bind to a queue and catalog
     * @param {import('../shared/actionQueue/actionQueue.js').ActionQueue} queue
     * @param {object} catalog - From buildActionCatalog()
     * @param {Function} [onQueueChanged] - Called when entries are added
     */
    bind(queue, catalog, onQueueChanged) {
        this.#queue = queue;
        this.#catalog = catalog;
        this.#onQueueChanged = onQueueChanged || null;
        this.#renderButtons();
    }

    /** @private */
    #render() {
        this.#container.innerHTML = `
            <div class="aq-actions-panel">
                <div class="aq-actions-header">
                    <strong>Available Actions</strong>
                </div>
                <div class="aq-actions-grid"></div>
            </div>
        `;
    }

    /** @private */
    #renderButtons() {
        const grid = this.#container.querySelector('.aq-actions-grid');
        if (!grid || !this.#catalog) return;

        let html = '';

        // Task actions grouped by zone
        const tasksByZone = new Map();
        for (const task of this.#catalog.tasks) {
            const group = task.group || 'Unknown';
            if (!tasksByZone.has(group)) tasksByZone.set(group, []);
            tasksByZone.get(group).push(task);
        }

        for (const [zoneName, tasks] of tasksByZone) {
            html += `<div class="aq-action-group">
                <div class="aq-action-group-header">${zoneName}</div>
                <div class="aq-action-group-buttons">`;
            for (const task of tasks) {
                html += `<button class="aq-action-btn" data-action-type="${task.actionType}" data-action-id="${task.actionId}" title="${zoneName}: ${task.label}">${task.label}</button>`;
            }
            html += `</div></div>`;
        }

        // Item and artifact actions grouped by their group field
        if (this.#catalog.items.length > 0) {
            const itemsByGroup = new Map();
            for (const item of this.#catalog.items) {
                const group = item.group || 'Items';
                if (!itemsByGroup.has(group)) itemsByGroup.set(group, []);
                itemsByGroup.get(group).push(item);
            }
            for (const [groupName, items] of itemsByGroup) {
                html += `<div class="aq-action-group">
                    <div class="aq-action-group-header">${groupName}</div>
                    <div class="aq-action-group-buttons">`;
                for (const item of items) {
                    html += `<button class="aq-action-btn aq-item-btn" data-action-type="${item.actionType}" data-action-id="${item.actionId}" title="Use ${item.label}">${item.icon || ''} ${item.label}</button>`;
                }
                html += `</div></div>`;
            }
        }

        // Prestige actions
        if (this.#catalog.prestige.length > 0) {
            html += `<div class="aq-action-group">
                <div class="aq-action-group-header">Special</div>
                <div class="aq-action-group-buttons">`;
            for (const action of this.#catalog.prestige) {
                html += `<button class="aq-action-btn aq-special-btn" data-action-type="${action.actionType}" data-action-id="${action.actionId}" title="${action.label}">${action.label}</button>`;
            }
            html += `</div></div>`;
        }

        grid.innerHTML = html;

        // Attach click handlers
        grid.addEventListener('click', (e) => {
            const btn = e.target.closest('.aq-action-btn');
            if (!btn || !this.#queue || !this.#catalog) return;

            const actionType = btn.dataset.actionType;
            const actionId = btn.dataset.actionId;

            // Find the catalog entry
            const allActions = [...this.#catalog.tasks, ...this.#catalog.items, ...this.#catalog.prestige];
            const catalogEntry = allActions.find(a =>
                a.actionType === actionType && String(a.actionId) === String(actionId)
            );

            if (catalogEntry) {
                const queueEntry = createQueueEntry(catalogEntry);
                this.#queue.add(queueEntry);
                if (this.#onQueueChanged) this.#onQueueChanged();
            }
        });
    }
}
