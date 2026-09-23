/**
 * substrateRegistryPanel/substrateRegistryPanelUI — **THE DOM.** Draws the
 * view-model `describeRegistry` makes of the LIVE `substrateRegistry` and the
 * checked-in snapshot: a drift block first, then one `<details>` per entry
 * (identity, every field grouped by the snapshot's groups with its FULL value,
 * and the two callable answers only a running app can give).
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
import { describeRegistry, driftIsEmpty, fullValueText } from './substrateRegistryPanelLibrary.js';

/** ⛓ Where the snapshot's own full reading lives, relative to `frontend/`. */
export const REFERENCE_HREF = 'modules/procgenDocs/reference.html#section-registry';

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
        const link = el('a', 'srp-reference', 'snapshot reference ↗');
        link.href = REFERENCE_HREF;
        link.target = '_blank';
        link.rel = 'noopener';
        bar.append(this.headerEl, this.refreshButton, link);

        this.bodyEl = el('div', 'srp-body');
        this.rootElement.append(bar, this.bodyEl);
    }

    getRootElement() { return this.rootElement; }

    onMount() { this.render(); }

    /** Re-read the registry and redraw everything. */
    render() {
        const vm = describeRegistry(substrateRegistry.getAll(), REGISTRY);
        this.viewModel = vm;
        this.headerEl.textContent = `${vm.columns.length} entries · ${vm.rows.length} fields · `
            + `snapshot: ${vm.snapshotCount} entries`;
        this.bodyEl.replaceChildren(this._drift(vm), ...vm.columns.map((c) => this._entry(vm, c)));
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
