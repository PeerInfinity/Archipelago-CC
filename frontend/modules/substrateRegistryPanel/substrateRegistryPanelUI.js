/**
 * substrateRegistryPanel/substrateRegistryPanelUI — **THE DOM.** Draws the
 * view-model `describeRegistry` makes of the LIVE `substrateRegistry` and the
 * checked-in snapshot, in one of two MODES:
 * - **Matrix** (the default): one table, fields and their feature rows down,
 *   entries across, each cell ✓ / ✗ / a number (`matrixOf`); groups collapse,
 *   a filter narrows the rows by name, and a collapsible Columns section
 *   hides and reorders the entry columns (`applyColumnControls`).
 * - **Detail**: a drift block first, then one `<details>` per entry
 *   (identity, every field grouped by the snapshot's groups with its FULL
 *   value, and the two callable answers only a running app can give).
 *
 * ⛔ Every value reaches the page through `textContent`, never `innerHTML` — a
 * registry value is data, and a label or a type name is a string somebody
 * else wrote.
 *
 * ⚠ THE REGISTRY HAS NO CHANGE EVENT. The panel reads `getAll()` when it
 * mounts and when Refresh is pressed; an entry registered in between shows up
 * on the next Refresh, not by itself.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { REGISTRY } from '../procgenDocs/generated/registry.js';
import {
    applyColumnControls, describeRegistry, driftIsEmpty, fullValueText, GLYPH, matrixOf, reorderIds, ROW_KINDS,
} from './substrateRegistryPanelLibrary.js';

/** ⛓ Where the snapshot's own full reading lives, relative to `frontend/`. */
export const REFERENCE_HREF = 'modules/procgenDocs/reference.html#section-registry';

/** ⛓ The panel's view modes; the button for each carries `data-mode`. */
export const MODES = Object.freeze({ matrix: 'matrix', detail: 'detail' });

/** ⛓ The mode the panel opens in — the matrix is what was asked for. */
export const DEFAULT_MODE = MODES.matrix;

const MODE_LABELS = Object.freeze({ [MODES.detail]: 'Detail', [MODES.matrix]: 'Matrix' });

/** ⛓ The Matrix mode's one-line key. */
export const LEGEND = `${GLYPH.yes} carried / true · ${GLYPH.no} absent / false · a number: its value, `
    + 'or a list\'s count · an indented row: one element of the list above · hover a cell for the full value';

/** ⛓ The Columns section's buttons; each carries its key as `data-action`. */
export const COLUMN_ACTIONS = Object.freeze({
    all: 'all', none: 'none', registryOrder: 'registry-order', up: 'up', down: 'down',
});

const COLUMN_ACTION_LABELS = Object.freeze({
    [COLUMN_ACTIONS.all]: 'All',
    [COLUMN_ACTIONS.none]: 'None',
    [COLUMN_ACTIONS.registryOrder]: 'Registry order',
    [COLUMN_ACTIONS.up]: '▲',
    [COLUMN_ACTIONS.down]: '▼',
});

/** ⛓ The Columns section's summary line. */
export const columnsSummary = (shown, total) => `Columns · ${shown} of ${total} shown`;

const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
};

/** A two-column table; each cell is a string or `{ text, note }`. */
function table(head, rows) {
    const t = el('table', 'srp-table');
    const thead = el('thead');
    const hr = el('tr');
    for (const h of head) hr.appendChild(el('th', null, h));
    thead.appendChild(hr);
    t.appendChild(thead);
    const tbody = el('tbody');
    for (const r of rows) {
        const tr = el('tr');
        for (const c of r) {
            const td = el('td');
            const v = typeof c === 'string' ? { text: c, note: false, code: false } : c;
            td.appendChild(el(v.code ? 'code' : 'span', v.note ? 'srp-note' : null, v.text));
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    t.appendChild(tbody);
    return t;
}

const code = (text) => ({ text, note: false, code: true });

export class SubstrateRegistryPanelUI {
    constructor(container, componentState, componentType) {
        this.container = container;
        this.componentState = componentState || {};
        this.componentType = componentType;
        this.rootElement = el('div', 'substrate-registry-panel');

        const bar = el('div', 'srp-bar');
        this.headerEl = el('span', 'srp-header');
        this.refreshButton = el('button', 'srp-refresh', 'Refresh');
        this.refreshButton.type = 'button';
        this.refreshButton.addEventListener('click', () => this.render());
        this.mode = DEFAULT_MODE;
        /** Group titles the reader collapsed — kept across Refresh. */
        this.collapsed = new Set();
        this.filterText = '';
        /** Entry ids the reader unticked, and the reader's column order (empty
         *  = registry order) — both kept across Refresh, not across reloads. */
        this.hidden = new Set();
        this.order = [];
        this.modeButtons = Object.values(MODES).map((m) => {
            const b = el('button', 'srp-mode', MODE_LABELS[m]);
            b.type = 'button';
            b.dataset.mode = m;
            b.addEventListener('click', () => { this.mode = m; this.render(); });
            return b;
        });
        this.filterInput = el('input', 'srp-filter');
        this.filterInput.type = 'search';
        this.filterInput.placeholder = 'filter rows';
        this.filterInput.addEventListener('input', () => {
            this.filterText = this.filterInput.value;
            this._applyMatrixState();
        });
        const link = el('a', 'srp-reference', 'snapshot reference ↗');
        link.href = REFERENCE_HREF;
        link.target = '_blank';
        link.rel = 'noopener';
        bar.append(this.headerEl, ...this.modeButtons, this.filterInput, this.refreshButton, link);
        this.legendEl = el('div', 'srp-legend', LEGEND);
        /* One element for the panel's life, re-filled by each render, so the
         * reader's open/closed choice survives every control press. */
        this.controlsEl = el('details', 'srp-controls');
        this.controlsSummaryEl = el('summary');
        this.controlsListEl = el('div', 'srp-controls-list');
        this.controlsEl.append(this.controlsSummaryEl, this.controlsListEl);

        this.bodyEl = el('div', 'srp-body');
        this.rootElement.append(bar, this.legendEl, this.controlsEl, this.bodyEl);
    }

    getRootElement() { return this.rootElement; }

    onMount() { this.render(); }

    /** Re-read the registry and redraw everything. */
    render() {
        const vm = describeRegistry(substrateRegistry.getAll(), REGISTRY);
        this.viewModel = vm;
        this.headerEl.textContent = `${vm.columns.length} entries · ${vm.rows.length} fields · `
            + `snapshot: ${vm.snapshotCount} entries`;
        const matrix = this.mode === MODES.matrix;
        for (const b of this.modeButtons) b.setAttribute('aria-pressed', String(b.dataset.mode === this.mode));
        this.filterInput.hidden = !matrix;
        this.legendEl.hidden = !matrix;
        this.controlsEl.hidden = !matrix;
        this.matrixGroups = [];
        if (matrix) {
            this._controls(vm);
            this.bodyEl.replaceChildren(this._matrix(vm));
        }
        else this.bodyEl.replaceChildren(this._drift(vm), ...vm.columns.map((c) => this._entry(vm, c)));
    }

    /** One table: entries across, each group's field and feature rows down. */
    _matrix(vm) {
        // Once, before the header and the rows: a hidden column is never drawn.
        const m = applyColumnControls(matrixOf(vm), { hidden: this.hidden, order: this.order });
        const t = el('table', 'srp-matrix');
        const thead = el('thead');
        const hr = el('tr');
        hr.appendChild(el('th', 'srp-matrix-corner', 'field'));
        for (const c of m.columns) {
            const th = el('th', 'srp-matrix-col');
            th.appendChild(el('code', null, c.id));
            th.title = c.label ?? c.id;
            hr.appendChild(th);
        }
        thead.appendChild(hr);
        t.appendChild(thead);
        const tbody = el('tbody');
        for (const g of m.groups) {
            const header = el('tr', 'srp-matrix-group');
            const th = el('th', null, g.title);
            th.colSpan = m.columns.length + 1;
            th.addEventListener('click', () => {
                if (this.collapsed.has(g.title)) this.collapsed.delete(g.title);
                else this.collapsed.add(g.title);
                this._applyMatrixState();
            });
            header.appendChild(th);
            tbody.appendChild(header);
            const rows = g.rows.map((r) => {
                const tr = el('tr', 'srp-matrix-row');
                const name = el('th', r.kind === ROW_KINDS.feature ? 'srp-feature' : null, r.name);
                if (r.parent) name.title = r.parent;
                tr.appendChild(name);
                for (const c of r.cells) {
                    const td = el('td', `srp-cell srp-${c.kind}`, c.text);
                    td.title = c.title;
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
                return { tr, name: r.name.toLowerCase() };
            });
            this.matrixGroups.push({ title: g.title, header, rows });
        }
        t.appendChild(tbody);
        this._applyMatrixState();
        return t;
    }

    /** The Columns section: one line per live entry in the CURRENT display
     *  order — tick, id, label, ▲ ▼ — then All · None · Registry order. */
    _controls(vm) {
        const ids = vm.columns.map((c) => c.id);
        const shown = reorderIds(ids, this.order);
        this.controlsSummaryEl.textContent = columnsSummary(shown.filter((id) => !this.hidden.has(id)).length,
            ids.length);
        const button = (action, onClick, disabled = false) => {
            const b = el('button', 'srp-col-action', COLUMN_ACTION_LABELS[action]);
            b.type = 'button';
            b.dataset.action = action;
            b.disabled = disabled;
            b.addEventListener('click', () => { onClick(); this.render(); });
            return b;
        };
        const lines = shown.map((id, i) => {
            const col = vm.columns.find((c) => c.id === id);
            const line = el('div', 'srp-col-line');
            line.dataset.substrateId = id;
            const tick = el('input');
            tick.type = 'checkbox';
            tick.checked = !this.hidden.has(id);
            tick.setAttribute('aria-label', id);
            tick.addEventListener('change', () => {
                if (tick.checked) this.hidden.delete(id);
                else this.hidden.add(id);
                this.render();
            });
            line.append(tick, el('code', null, id), el('span', 'srp-sub', col.label ?? ''),
                button(COLUMN_ACTIONS.up, () => this._swap(shown, i, i - 1), i === 0),
                button(COLUMN_ACTIONS.down, () => this._swap(shown, i, i + 1), i === shown.length - 1));
            return line;
        });
        const all = el('div', 'srp-col-all');
        all.append(
            button(COLUMN_ACTIONS.all, () => this.hidden.clear()),
            button(COLUMN_ACTIONS.none, () => { this.hidden = new Set(ids); }),
            button(COLUMN_ACTIONS.registryOrder, () => { this.order = []; }),
        );
        this.controlsListEl.replaceChildren(...lines, all);
    }

    /** Swap two places of the display order — seeded from what is shown, so
     *  the swap is well-defined whatever `this.order` held before. */
    _swap(shown, a, b) {
        const next = [...shown];
        [next[a], next[b]] = [next[b], next[a]];
        this.order = next;
    }

    /** Collapse and filter, over the drawn rows — no redraw. */
    _applyMatrixState() {
        const needle = this.filterText.trim().toLowerCase();
        for (const g of this.matrixGroups ?? []) {
            const collapsed = this.collapsed.has(g.title);
            g.header.toggleAttribute('data-collapsed', collapsed);
            let visible = 0;
            for (const r of g.rows) {
                const filtered = needle !== '' && !r.name.includes(needle);
                r.tr.toggleAttribute('data-filtered', filtered);
                r.tr.toggleAttribute('data-collapsed', collapsed);
                if (!filtered) visible += 1;
            }
            g.header.hidden = visible === 0;
        }
    }

    _drift(vm) {
        const box = el('section', 'srp-drift');
        box.appendChild(el('h3', null, 'Drift against the snapshot'));
        const { drift } = vm;
        if (driftIsEmpty(drift)) {
            box.classList.add('srp-drift-none');
            box.appendChild(el('p', null, `No drift: the live registry has the snapshot's `
                + `${vm.snapshotCount} entries and every field's short value matches it.`));
            return box;
        }
        if (drift.liveOnly.length) {
            box.appendChild(el('p', 'srp-drift-line',
                `Live only (not in the snapshot): ${drift.liveOnly.join(', ')}`));
        }
        if (drift.snapshotOnly.length) {
            box.appendChild(el('p', 'srp-drift-line',
                `Snapshot only (not registered in this app): ${drift.snapshotOnly.join(', ')}`));
        }
        if (drift.fields.length) {
            box.appendChild(el('p', 'srp-drift-line',
                `${drift.fields.length} field value(s) differ from the snapshot:`));
            box.appendChild(table(['entry', 'field', 'snapshot', 'live'], drift.fields.map((f) => [
                code(f.id), code(f.name), code(f.snapshot), code(f.live)])));
        }
        return box;
    }

    _entry(vm, col) {
        const d = el('details', 'srp-entry');
        d.dataset.substrateId = col.id;
        const summary = el('summary');
        summary.append(el('code', null, col.id),
            el('span', 'srp-sub', `${col.label ?? ''} · ${col.fields} fields`));
        d.appendChild(summary);

        d.appendChild(table(['', ''], [
            ['label', col.label ?? { text: '—', note: true }],
            ['fields carried', String(col.fields)],
            ['registered by (snapshot)', col.registeredBy
                ? code(col.registeredBy) : { text: '— not in the snapshot', note: true }],
        ]));

        const idx = vm.columns.indexOf(col);
        for (const g of vm.groups) {
            const present = g.rows
                .map((name) => ({ name, cell: vm.rows.find((r) => r.name === name).cells[idx] }))
                .filter(({ cell }) => cell.present);
            if (!present.length) continue;
            d.appendChild(el('div', 'srp-group', g.title));
            d.appendChild(table(['field', 'value'], present.map(({ name, cell }) => {
                const v = fullValueText(cell);
                return [code(name), v.note ? v : code(v.text)];
            })));
        }

        const a = vm.answers[col.id];
        d.appendChild(el('div', 'srp-group', 'Live answers (called in this app, now)'));
        d.appendChild(table(['callable', 'answer'], [
            [code('getPlaybackController()'), code(a.playbackController)],
            [code('sharing.items types'), Array.isArray(a.itemTypes)
                ? (a.itemTypes.length ? code(a.itemTypes.join(', ')) : { text: 'empty', note: true })
                : code(a.itemTypes)],
        ]));
        return d;
    }

    destroy() {
        if (this.rootElement?.parentNode) this.rootElement.parentNode.removeChild(this.rootElement);
    }
}
