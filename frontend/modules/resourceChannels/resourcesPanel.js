/**
 * The Resources panel (ActionNodes design §5, ruled 2026-11-15 Q3: "a new Resources panel").
 *
 * Driven by the sharing declarations, not by any one substrate: for each substrate of the loaded world that declares
 * a sharing category, a section with what the host keeps for it.
 *   - mana: the shared pool (current / starting) and the per-item starting mana in force;
 *   - stats and resources: the ledger's values, when the ledger's owner is that substrate;
 *   - the boosts in effect: which Archipelago item gives what, and how many are held (the owner states them).
 * Other games' item counts live inside those games; showing them needs a report event from each bridge (later).
 *
 * AN-TIME-2: the pool line reads the loaded world's pool name (`poolName.js`, "Mana" by default), and a world with a
 * clock shows the Time line instead: "Time: 11:00 · 6 h left · the day ends 17:00".
 *
 * The rendering is a pure function of a model (`resourcesPanelModel`), so it is tested without a DOM.
 */

import eventBus from '../../app/core/eventBus.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { getResourceLedger } from './resourceChannelsLibrary.js';
import { LEDGER_CHANGED_EVENT } from './resourceLedger.js';
import { DEFAULT_POOL, clockLineOfWorld, loadedWorldSubstrates, poolAmount, poolOfWorld } from './poolName.js';

export const RESOURCES_PANEL_COMPONENT_TYPE = 'resourcesPanel';
const MODULE = 'resourceChannels';

/** Format a gives block as "Strength +1, Gold +5, +10 mana" (the pool in the world's name: AN-TIME-2). */
export function describeGives(gives = {}, names = { stats: {}, resources: {} }, pool = DEFAULT_POOL) {
    const parts = [];
    for (const [id, n] of Object.entries(gives.stats ?? {})) parts.push(`${names.stats?.[id] ?? id} +${n}`);
    for (const [id, n] of Object.entries(gives.resources ?? {})) parts.push(`${names.resources?.[id] ?? id} +${n}`);
    if (typeof gives.mana === 'number' && gives.mana !== 0) parts.push(`+${poolAmount(gives.mana, pool)}`);
    return parts.length ? parts.join(', ') : 'nothing';
}

/**
 * The panel's content as data.
 * @param {{ledger: object, mana: {current, max}|null, substrates: string[], registry?: object}} input
 *        `ledger` is a ledger snapshot; `substrates` the ids present in the loaded world
 * @returns {{mana: object|null, sections: Array<{id, label, rows: Array<{kind, label, value}>}>, empty: boolean,
 *   pool: {name, unit}, manaText: string|null}} `manaText` is the pool line: "Mana: 6 / 8 (starting)", or with a
 *   clock "Time: 11:00 · 6 h left · the day ends 17:00"
 */
export function resourcesPanelModel({ ledger, mana = null, substrates = [], registry = substrateRegistry }) {
    const sections = [];
    const pool = poolOfWorld([...new Set(substrates)].sort(), registry);
    for (const id of [...new Set(substrates)].sort()) {
        const entry = registry.get(id);
        const sharing = entry?.sharing;
        if (!sharing) continue;
        const rows = [];
        const owns = ledger?.owner === id;
        if (owns) {
            for (const [sid, v] of Object.entries(ledger.stats ?? {})) {
                rows.push({ kind: 'stat', id: sid, label: ledger.names?.stats?.[sid] ?? sid, value: v });
            }
            for (const [rid, v] of Object.entries(ledger.resources ?? {})) {
                rows.push({ kind: 'resource', id: rid, label: ledger.names?.resources?.[rid] ?? rid, value: v });
            }
            for (const b of ledger.boosts ?? []) {
                rows.push({ kind: 'boost', id: b.item, label: b.item, value: `${b.held} held: ${describeGives(b.gives, ledger.names, pool)}` });
            }
        }
        const categories = ['mana', 'items', 'stats', 'resources'].filter((c) => sharing[c] !== undefined);
        sections.push({ id, label: entry.label ?? id, categories, rows });
    }
    let manaText = null;
    if (mana) {
        const clock = clockLineOfWorld(mana.current, [...new Set(substrates)].sort(), registry);
        manaText = clock
            ? `${pool.name}: ${clock.now} · ${clock.leftText} left · the day ends ${clock.ends}`
            : `${pool.name}: ${Math.round(mana.current * 10) / 10} / ${mana.max} (starting)`;
    }
    return { mana, sections, empty: sections.length === 0, pool, manaText };
}

function el(tag, attrs = {}, text = null) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== null) e.textContent = text;
    return e;
}

export class ResourcesPanel {
    constructor(container) {
        this.container = container;
        this.root = el('div', { class: 'resources-panel', 'data-testid': 'resources-panel' });
        this.root.style.cssText = 'padding:8px;font-size:13px;overflow:auto;height:100%;box-sizing:border-box;';
        this.container.element.appendChild(this.root);
        this._unsubs = [];
        const rerender = () => this.render();
        // `actionNodes:stateChanged`: a substrate's clock moved (a wait, an act) — the Time line reads it (AN-TIME-2).
        for (const ev of [LEDGER_CHANGED_EVENT, 'gameState:manaChanged', 'stateManager:rulesLoaded', 'procgen:activeSubstrateChanged',
            'actionNodes:stateChanged']) {
            try {
                const off = eventBus.subscribe(ev, rerender, MODULE);
                if (typeof off === 'function') this._unsubs.push(off);
            } catch { /* event unknown in this module set */ }
        }
        this.container.on?.('destroy', () => this.destroy());
        this.render();
    }

    getRootElement() {
        return this.root;
    }

    /** The substrate ids of the loaded world (procgenPlayer's warehouse), or none. */
    _worldSubstrates() {
        return loadedWorldSubstrates();
    }

    render() {
        let gs = null;
        try { gs = getGameStateSingleton(); } catch { gs = null; }
        const model = resourcesPanelModel({
            ledger: getResourceLedger().snapshot(),
            mana: gs ? { current: gs.getCurrentMana(), max: gs.getMaxMana() } : null,
            substrates: this._worldSubstrates(),
        });
        this.root.replaceChildren();
        if (model.mana) {
            const m = el('div', { class: 'resources-mana', 'data-testid': 'resources-mana' }, model.manaText);
            m.style.marginBottom = '6px';
            this.root.appendChild(m);
        }
        if (model.empty) {
            this.root.appendChild(el('div', { class: 'resources-empty' }, 'No substrate of the loaded world shares resources.'));
            return;
        }
        for (const sec of model.sections) {
            const box = el('div', { class: 'resources-section', 'data-substrate': sec.id });
            box.style.cssText = 'border-top:1px solid #444;padding-top:4px;margin-top:4px;';
            box.appendChild(el('div', { class: 'resources-section-title' }, `${sec.label} — shares ${sec.categories.join(', ')}`));
            if (!sec.rows.length) box.appendChild(el('div', { class: 'resources-none' }, 'Nothing kept by the host.'));
            for (const row of sec.rows) {
                const r = el('div', { class: `resources-row resources-${row.kind}`, 'data-kind': row.kind, 'data-id': row.id },
                    `${row.kind === 'boost' ? 'Boost ' : ''}${row.label}: ${row.value}`);
                box.appendChild(r);
            }
            this.root.appendChild(box);
        }
    }

    destroy() {
        for (const off of this._unsubs) {
            try { off(); } catch { /* ignore */ }
        }
        this._unsubs = [];
    }
}
