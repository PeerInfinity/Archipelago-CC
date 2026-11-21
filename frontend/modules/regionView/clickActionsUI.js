/**
 * ⛓ THE "ON CLICK" STRIP — the shared UI of a map panel's click actions (mode-toggle design §4.5, slice CA-S2).
 *
 * ⚖ R2 (named choices), R5 (a Region list and a Location list), R6 (its own collapsible strip at the top of the
 * panel, outside Controls; collapsed, a one-line summary that keeps the ⏸ master switch), user 2026-11-16.
 *
 * It knows NO panel and NO action by name. It renders what `clickActions.js` has registered
 * (`listClickActions(target)`), generically:
 *   - a `toggle` is a checkbox;
 *   - a `choice` is a select per field: `choices` as an array is one select over those values (the setting is the
 *     value); `choices` as `{ field: [values] }` is one select per field (the setting is `{ field: value }`). Each
 *     select's first option is "off" (the setting `false`). Labels come from the descriptor (`label`,
 *     `choiceLabels`, `summary`).
 * An enabled id with no registered action (its panel is not loaded) is KEPT in the settings and shown greyed out as
 * "(not loaded)"; the strip never drops a key it does not know.
 *
 * MOUNT: `mountClickActionsStrip({ panelId, container, getSettings, saveSettings, doc? })`.
 *   - `getSettings()` → the panel's current `clickActions` object (synchronous; the host keeps it in memory);
 *   - `saveSettings(next)` → the host stores `next` (a NEW object; the strip never mutates what it was given);
 *   - `container` gets the strip's root element appended; `doc` defaults to the page's `document`.
 * → `{ element, render(), seed(), setExpanded(bool), isExpanded(), destroy() }`. It re-renders on its own when an
 * action is registered or unregistered; the host calls `render()` when the settings change from outside.
 *
 * PER PANEL (CA-S4): the strip lists only the actions offered to `panelId` (`offeredTo`), and shows an action its
 * settings do not name by its `initial(panelId)` (`effectiveValue`), as a click runs it.
 * SEED (CA-S4): `seed()` writes those initial values into the panel's settings ONCE (`withInitialValues`;
 * `saveSettings(next, { seeded: true })`), so after that the stored value decides. The host calls it when its own load
 * has landed (never before: an unloaded host holds the defaults); from then on, a registration seeds the new action.
 */
import {
    listClickActions, onClickActionsChanged, getClickAction, isOn, TARGETS, effectiveValue, withInitialValues,
} from './clickActions.js';

/** Class names / data attributes the in-app rows and the tests find the strip's parts by. */
export const STRIP = Object.freeze({
    root: 'click-actions-strip',
    header: 'click-actions-strip-header',
    toggle: 'click-actions-strip-toggle',
    summary: 'click-actions-strip-summary',
    master: 'click-actions-strip-master',
    body: 'click-actions-strip-body',
    list: 'click-actions-strip-list',
    row: 'click-actions-strip-row',
    unloaded: 'click-actions-strip-unloaded',
});

const TARGET_TITLES = Object.freeze({ region: 'Region', location: 'Location' });
const OFF = '';

/** A descriptor's summary text for `value` (on), or null. */
function summaryOf(desc, value) {
    if (typeof desc.summary === 'function') return desc.summary(value) ?? null;
    if (typeof desc.summary === 'string') return desc.summary;
    return desc.label;
}

/**
 * The collapsed one-line summary of `settings` over what is registered now. Pure (exported for the tests and for a
 * host's tooltip). Region parts, then the location parts after "location:". An id that is on but not registered
 * shows as `<id> (not loaded)`. With `panelId`: only the actions offered to that panel, each by its effective value.
 */
export function summarizeClickActions(settings, panelId = null) {
    if (!settings || typeof settings !== 'object') return 'On click: (no settings)';
    if (settings.enabled === false) return 'On click: ⏸ paused';
    const parts = {};
    for (const target of TARGETS) {
        const wanted = settings[target] ?? {};
        const out = [];
        const known = new Set();
        for (const desc of listClickActions(target, panelId)) {
            known.add(desc.id);
            const value = effectiveValue(desc, panelId, wanted);
            if (!isOn(desc, value)) continue;
            const s = summaryOf(desc, value);
            if (s) out.push(s);
        }
        for (const [id, v] of Object.entries(wanted)) {
            if (known.has(id) || getClickAction(id) || v === false || v === null || v === undefined) continue;
            out.push(`${id} (not loaded)`);
        }
        parts[target] = out;
    }
    const region = parts.region.length ? parts.region.join(' · ') : 'nothing';
    return parts.location.length ? `On click: ${region} — location: ${parts.location.join(' · ')}` : `On click: ${region}`;
}

/** `settings` with `settings[target][id] = value`, as a new object (nothing else is touched or dropped). */
export function withActionValue(settings, target, id, value) {
    const base = settings && typeof settings === 'object' ? settings : {};
    return { ...base, [target]: { ...(base[target] ?? {}), [id]: value } };
}

/** `settings` with the master switch set, as a new object. */
export function withEnabled(settings, enabled) {
    const base = settings && typeof settings === 'object' ? settings : {};
    return { ...base, enabled: !!enabled };
}

const labelOf = (desc, value) => desc.choiceLabels?.[value] ?? String(value);

export function mountClickActionsStrip({ panelId, container, getSettings, saveSettings, doc = globalThis.document } = {}) {
    if (typeof panelId !== 'string' || !panelId) throw new Error('mountClickActionsStrip: `panelId` is required');
    if (typeof getSettings !== 'function' || typeof saveSettings !== 'function') {
        throw new Error('mountClickActionsStrip: `getSettings` and `saveSettings` are required');
    }
    if (!doc?.createElement) throw new Error('mountClickActionsStrip: no document to build in');

    const el = (tag, cls, text) => {
        const e = doc.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    };

    let expanded = false;
    let destroyed = false;
    let seeding = false; // set by the host's first seed(): from then on a registration seeds the new action too

    const root = el('div', STRIP.root);
    root.dataset.panelId = panelId;
    Object.assign(root.style, {
        background: 'rgba(0, 0, 0, 0.7)', color: 'white', fontSize: '12px', padding: '3px 6px',
        borderRadius: '3px', maxWidth: '360px',
    });

    const header = el('div', STRIP.header);
    Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' });
    const toggle = el('button', STRIP.toggle, '▸');
    toggle.type = 'button';
    toggle.title = 'Show the click options';
    Object.assign(toggle.style, { background: 'none', border: '1px solid #555', color: 'white', padding: '0 5px',
        fontSize: '10px', cursor: 'pointer', borderRadius: '2px' });
    const summary = el('span', STRIP.summary, '');
    Object.assign(summary.style, { flex: '1', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
    const master = el('button', STRIP.master, '⏸');
    master.type = 'button';
    Object.assign(master.style, { background: 'none', border: '1px solid #555', color: 'white', padding: '0 5px',
        fontSize: '11px', cursor: 'pointer', borderRadius: '2px' });
    header.appendChild(toggle);
    header.appendChild(summary);
    header.appendChild(master);

    const body = el('div', STRIP.body);
    Object.assign(body.style, { display: 'none', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #555' });

    root.appendChild(header);
    root.appendChild(body);

    const save = (next) => {
        if (destroyed) return;
        saveSettings(next);
        render();
    };

    /** Write the offered actions' initial values the settings do not name yet, once (see the header). */
    function seed() {
        if (destroyed) return [];
        seeding = true;
        const { settings: next, added } = withInitialValues(panelId, getSettings());
        if (added.length) saveSettings(next, { seeded: true });
        return added;
    }

    const onToggle = () => setExpanded(!expanded);
    toggle.addEventListener('click', onToggle);
    summary.addEventListener('click', onToggle);
    master.addEventListener('click', () => {
        const s = getSettings();
        save(withEnabled(s, s?.enabled === false));
    });

    function rowFor(target, desc, value, settings) {
        const row = el('div', STRIP.row);
        row.dataset.actionId = desc.id;
        Object.assign(row.style, { margin: '2px 0', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' });
        if (desc.kind === 'toggle') {
            const label = el('label');
            label.style.cursor = 'pointer';
            const box = el('input');
            box.type = 'checkbox';
            box.checked = value === true;
            box.dataset.actionId = desc.id;
            box.addEventListener('change', () => save(withActionValue(getSettings(), target, desc.id, !!box.checked)));
            label.appendChild(box);
            label.appendChild(el('span', '', ` ${desc.label}`));
            row.appendChild(label);
            return row;
        }
        row.appendChild(el('span', '', `${desc.label}:`));
        const fields = Array.isArray(desc.choices) ? [null] : Object.keys(desc.choices);
        for (const field of fields) {
            const values = field === null ? desc.choices : desc.choices[field];
            const sel = el('select');
            sel.dataset.actionId = desc.id;
            if (field !== null) sel.dataset.field = field;
            const off = el('option', '', 'off');
            off.value = OFF;
            sel.appendChild(off);
            for (const v of values) {
                const o = el('option', '', labelOf(desc, v));
                o.value = String(v);
                sel.appendChild(o);
            }
            const current = !isOn(desc, value) ? OFF : (field === null ? value : value?.[field]);
            sel.value = current === undefined || current === null ? OFF : String(current);
            sel.addEventListener('change', () => {
                const picked = sel.value;
                const now = getSettings()?.[target]?.[desc.id];
                let next;
                if (picked === OFF) next = false;
                else if (field === null) next = picked;
                else {
                    // Only the declared fields: a stale field (a pre-ruling route's `distance`) is dropped here.
                    const prev = now && typeof now === 'object' ? now : {};
                    next = {};
                    for (const f of fields) {
                        const v = f === field ? picked : (prev[f] ?? desc.choices[f][0]);
                        next[f] = v;
                    }
                }
                save(withActionValue(getSettings(), target, desc.id, next));
            });
            row.appendChild(sel);
        }
        return row;
    }

    function unloadedRow(id, value) {
        const row = el('div', `${STRIP.row} ${STRIP.unloaded}`);
        row.dataset.actionId = id;
        Object.assign(row.style, { margin: '2px 0', opacity: '0.5', fontStyle: 'italic' });
        row.title = 'Its panel is not loaded; the setting is kept';
        row.textContent = `${id}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)} (not loaded)`;
        return row;
    }

    function render() {
        if (destroyed) return;
        const settings = getSettings();
        const enabled = settings?.enabled !== false;
        summary.textContent = summarizeClickActions(settings, panelId);
        summary.title = summary.textContent;
        master.textContent = enabled ? '⏸' : '▶';
        master.title = enabled ? 'Pause every click action (the master switch)' : 'Resume the click actions';
        master.setAttribute?.('aria-pressed', enabled ? 'false' : 'true');
        master.dataset.enabled = enabled ? 'true' : 'false';
        root.style.opacity = enabled ? '1' : '0.75';
        toggle.textContent = expanded ? '▾' : '▸';
        root.dataset.expanded = expanded ? 'true' : 'false';
        body.style.display = expanded ? 'block' : 'none';
        body.innerHTML = '';
        for (const target of TARGETS) {
            const list = el('div', STRIP.list);
            list.dataset.target = target;
            const title = el('div', '', `${TARGET_TITLES[target]}:`);
            title.style.fontWeight = 'bold';
            list.appendChild(title);
            const wanted = settings?.[target] ?? {};
            const known = new Set();
            for (const desc of listClickActions(target, panelId)) {
                known.add(desc.id);
                list.appendChild(rowFor(target, desc, effectiveValue(desc, panelId, wanted), settings));
            }
            for (const [id, v] of Object.entries(wanted)) {
                if (known.has(id) || getClickAction(id) || v === false || v === null || v === undefined) continue;
                list.appendChild(unloadedRow(id, v));
            }
            body.appendChild(list);
        }
    }

    function setExpanded(on) {
        expanded = !!on;
        render();
    }

    const unsubscribe = onClickActionsChanged(() => {
        if (seeding) seed();
        render();
    });
    container?.appendChild?.(root);
    render();

    return {
        element: root,
        render,
        seed,
        setExpanded,
        isExpanded: () => expanded,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            unsubscribe();
            root.parentNode?.removeChild?.(root);
        },
    };
}
