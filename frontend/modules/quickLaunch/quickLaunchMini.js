/**
 * The Quick Launch panel's "Mini panels" section, at the top: one row per mini-capable panel saying how it
 * shows now (mini, full, closed — the Tutorial: split, merged), with a button that switches it, and the
 * mini row's Locked / Draggable switch. The state and the switching are the miniPanels module's (its public
 * functions); this file only draws them. No miniPanels module in this mode → no section.
 */
import { centralRegistry } from '../../app/core/centralRegistry.js';

const MINI_MODULE = 'miniPanels';

/** Class names, one per control, so tests and CSS address them by name. */
export const MINI_CONTROLS = Object.freeze({
    section: 'ql-mini',
    row: 'ql-mini-row',
    name: 'ql-mini-name',
    state: 'ql-mini-state',
    toggle: 'ql-mini-toggle',
});

export const MINI_TEXT = Object.freeze({
    heading: 'Mini panels',
    desktopOnly: 'The mini row is part of the desktop layout.',
    state: {
        bot: { closed: 'closed', full: 'full', mini: 'mini' },
        checks: { off: 'off', 'own-row': 'mini', 'in-bot': 'in the bot\'s row' },
        tutorial: { closed: 'closed', merged: 'merged', split: 'split' },
        locked: { true: 'locked', false: 'draggable' },
    },
    /** Each row's tooltip: what the switch does. */
    title: {
        bot: 'The Playback Bot as one row above the middle column — its buttons and status line — or the full panel. ⤢ in the mini row expands it too.',
        checks: 'The "Checked: …" line in the mini row: a row of its own, or inside the Playback Bot\'s mini row while that is mini.',
        tutorial: 'The Tutorial panel in a stack of its own under the panels it shares a stack with (split), or back among them (merged).',
        locked: 'Locked: the mini row is a fixed strip (no tabs to drag or close). Draggable: each mini panel has a tab you can drag anywhere; it stays mini until expanded.',
    },
    button: {
        bot: { closed: 'Open mini', full: 'Make mini', mini: 'Expand' },
        checks: { off: 'Turn on', 'own-row': 'Turn off', 'in-bot': 'Turn off' },
        tutorial: { closed: 'Open split', merged: 'Split', split: 'Merge' },
        locked: { true: 'Make draggable', false: 'Lock' },
    },
});

function fn(name) {
    return centralRegistry.getPublicFunction?.(MINI_MODULE, name) ?? null;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export class MiniSection {
    constructor() {
        this.element = el('details', MINI_CONTROLS.section);
        this.element.open = true;
    }

    /** Draw from the miniPanels state now; hidden when the module is not loaded. */
    render() {
        const getState = fn('getState');
        const state = typeof getState === 'function' ? getState() : null;
        this.element.hidden = !state;
        if (!state) return;
        const summary = el('summary', null, MINI_TEXT.heading);
        const rows = [];
        if (!state.desktop) {
            rows.push(el('div', 'ql-mini-note', MINI_TEXT.desktopOnly));
        } else {
            if (state.available.checks) {
                rows.push(this._row('checks', 'Checks', state.checks, () => fn('setChecksOn')?.(state.checks === 'off')));
            }
            if (state.available.bot) {
                rows.push(this._row('bot', 'Playback Bot', state.bot, () => fn('setBotMini')?.(state.bot !== 'mini')));
            }
            if (state.available.tutorial) {
                rows.push(this._row('tutorial', 'Tutorial', state.tutorial, () => fn('toggleTutorial')?.()));
            }
            rows.push(this._row('locked', 'Mini row', String(state.locked), () => fn('setLocked')?.(!state.locked)));
        }
        this.element.replaceChildren(summary, ...rows);
    }

    _row(key, name, value, onClick) {
        const row = el('div', MINI_CONTROLS.row);
        row.title = MINI_TEXT.title[key];
        row.dataset.mini = key;
        row.dataset.state = value;
        // ⛔ NOT `.ql-ctl`: that class means "an edit-mode control" (the Quick Launch tests wait for none outside edit mode).
        const toggle = el('button', MINI_CONTROLS.toggle, MINI_TEXT.button[key][value]);
        toggle.type = 'button';
        toggle.addEventListener('click', () => onClick());
        row.append(el('span', MINI_CONTROLS.name, name), el('span', MINI_CONTROLS.state, MINI_TEXT.state[key][value]), toggle);
        return row;
    }
}
