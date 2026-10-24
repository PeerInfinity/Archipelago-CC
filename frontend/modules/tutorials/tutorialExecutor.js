/**
 * tutorialExecutor.js — turns a step's declarative `actions` (tutorialShape.js)
 * into real presses on the real UI, with an animated cursor and an outline on
 * the target. The panel's "Do it" / "Play" and the in-app test row run the SAME
 * executor, so a step that the test passes is a step the panel can perform.
 *
 * REACHING A PANEL (⚖ the plan, 2026-10-10): the panel's TAB first — through
 * the stack's overflow dropdown when the tab has spilled into it — because
 * "find the X tab" is what the guide tells a person to do. Only a CLOSED panel
 * (no tab exists) goes through Quick Launch, whose button reopens it; and when
 * Quick Launch is not there either, `ui:activatePanel`.
 *
 * Desktop only for the cursor and outline: on the mobile layout (or with
 * `animate: false`, as the test runs) every action is performed directly.
 */
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { actionTarget } from './tutorialShape.js';
import { componentItems, isDesktopLayout } from './tutorialLayout.js';

export const CURSOR_CLASS = 'tutorial-cursor';
export const OUTLINE_CLASS = 'tutorial-outline';
const QUICK_LAUNCH = 'quickLaunchPanel';
const FRAME = () => new Promise((r) => requestAnimationFrame(() => r()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── finding things ───────────────────────────────────────────────────────

/** The component item a panel target names, or null when it has no tab (closed). */
export function findItem({ panel, title }) {
    return componentItems(panel, title)[0] ?? null;
}

/** The element a panel's content is drawn in (selectors are scoped to it). */
export function panelElement(item) {
    return item?.container?.element ?? null;
}

function isActiveTab(item) {
    const stack = item?.parentItem;
    return Boolean(stack) && stack.getActiveComponentItem?.() === item;
}

/** Is a panel's content showing? (its tab is the active one of its stack) */
export function isPanelShowing(target) {
    const item = findItem(target);
    return Boolean(item) && isActiveTab(item);
}

function visible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
}

/**
 * The control a click/key target names, inside its panel (`text` picks one of several matches). A target with
 * `frame` (a selector for an iframe in the panel) is looked up in that frame's document — the wasm game's ▶ Start.
 */
export function findControl(target) {
    let root = panelElement(findItem(target));
    if (root && target.frame) {
        try { root = root.querySelector(target.frame)?.contentDocument ?? null; } catch { root = null; }
    }
    if (!root || !target.selector) return root;
    const all = [...root.querySelectorAll(target.selector)];
    if (target.text === undefined) return all[0] ?? null;
    return all.find((el) => el.textContent.trim() === target.text) ?? null;
}

// ── the cursor and the outline ───────────────────────────────────────────

let cursorEl = null;
let outlineEl = null;
let outlineTarget = null;
let outlineTimer = null;

function cursor() {
    if (cursorEl?.isConnected) return cursorEl;
    cursorEl = document.createElement('div');
    cursorEl.className = CURSOR_CLASS;
    cursorEl.setAttribute('aria-hidden', 'true');
    // An arrow pointer, drawn: the tip is the element's top-left corner.
    cursorEl.innerHTML = '<svg width="22" height="26" viewBox="0 0 22 26"><path d="M1 1 L1 20 L6 15.5 L9.5 24 L13 22.5 L9.5 14 L16 14 Z"'
        + ' fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    cursorEl.style.left = `${Math.round(window.innerWidth / 2)}px`;
    cursorEl.style.top = `${Math.round(window.innerHeight / 2)}px`;
    document.body.appendChild(cursorEl);
    return cursorEl;
}

/** Remove the cursor (end of a Do it / Play). */
export function hideCursor() {
    cursorEl?.remove();
    cursorEl = null;
}

/** An element's rect on THIS page — one inside a (same-origin) iframe is offset by the frame's own. */
function pageRect(el) {
    const r = el.getBoundingClientRect();
    const frame = el.ownerDocument?.defaultView?.frameElement;
    if (!frame || el.ownerDocument === document) return r;
    const f = frame.getBoundingClientRect();
    return { left: r.left + f.left, top: r.top + f.top, width: r.width, height: r.height };
}

function centre(el) {
    const r = pageRect(el);
    return { x: r.left + Math.min(r.width / 2, 40), y: r.top + r.height / 2 };
}

async function moveCursorTo(el, ms) {
    const c = cursor();
    const { x, y } = centre(el);
    c.style.transitionDuration = `${ms}ms`;
    await FRAME();
    c.style.left = `${Math.round(x)}px`;
    c.style.top = `${Math.round(y)}px`;
    await sleep(ms + 30);
    c.classList.add('tutorial-cursor-press');
    await sleep(160);
    c.classList.remove('tutorial-cursor-press');
}

function placeOutline() {
    if (!outlineEl) return;
    const el = outlineTarget?.();
    if (!visible(el)) {
        outlineEl.style.display = 'none';
        return;
    }
    const r = pageRect(el);
    outlineEl.style.display = '';
    outlineEl.style.left = `${r.left - 3}px`;
    outlineEl.style.top = `${r.top - 3}px`;
    outlineEl.style.width = `${r.width + 6}px`;
    outlineEl.style.height = `${r.height + 6}px`;
}

/**
 * Outline what `resolve()` returns, following it as the layout moves (it is
 * re-resolved every tick, so a tab that moves into the dropdown, or a control
 * drawn later, is followed). `null` clears it.
 */
export function setOutline(resolve) {
    clearInterval(outlineTimer);
    outlineTimer = null;
    outlineTarget = resolve;
    if (!resolve || !isDesktopLayout()) {
        outlineEl?.remove();
        outlineEl = null;
        return;
    }
    if (!outlineEl?.isConnected) {
        outlineEl = document.createElement('div');
        outlineEl.className = OUTLINE_CLASS;
        outlineEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(outlineEl);
    }
    placeOutline();
    outlineTimer = setInterval(placeOutline, 250);
}

/**
 * The element a person should press NEXT to carry out `action` from where the
 * UI is now: the tab (or the dropdown button that reveals it) while the panel
 * is not showing, else the control itself. Null when nothing is pressable
 * (e.g. a closed panel — Quick Launch's button is offered then).
 */
export function nextPressable(action) {
    const { kind, target } = actionTarget(action);
    const item = findItem(target);
    if (!item) return quickLaunchButton(target.panel)?.button ?? null;
    if (!isActiveTab(item)) {
        const tab = item.tab?.element;
        if (tab?.closest('.lm_tabdropdown_list') && !visible(tab)) return dropdownButton(item);
        return tab ?? null;
    }
    if (kind === 'activate') return null;
    return findControl(target);
}

// ── performing ───────────────────────────────────────────────────────────

function dropdownButton(item) {
    return item.parentItem?.element?.querySelector(':scope > .lm_header .lm_tabdropdown') ?? null;
}

function quickLaunchButton(componentType) {
    const ql = findItem({ panel: QUICK_LAUNCH });
    const root = panelElement(ql);
    const button = root?.querySelector(`button.ql-panel[data-component-type="${CSS.escape(componentType)}"]`) ?? null;
    return button ? { ql, button } : null;
}

async function press(el, opts) {
    if (!el) throw new Error('nothing to press');
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (opts.animate) await moveCursorTo(el, opts.moveMs);
    if (el instanceof HTMLCanvasElement) {
        // A canvas hit-tests the pointer's position, and el.click() sends
        // (0,0): press its centre, as a person's click would.
        const r = el.getBoundingClientRect();
        const at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
        for (const type of ['mousedown', 'mouseup', 'click']) {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, ...at }));
        }
    } else {
        el.click();
    }
    await FRAME();
}

/** Make a panel's tab the active one: the tab, via the dropdown if it overflowed. */
async function showTab(item, opts) {
    if (isActiveTab(item)) return;
    const tab = item.tab?.element;
    if (!tab) {
        item.parentItem?.setActiveComponentItem?.(item, true);
        return;
    }
    if (tab.closest('.lm_tabdropdown_list') && !visible(tab)) {
        await press(dropdownButton(item), opts);
        await FRAME();
    }
    await press(tab, opts);
    // GL closes its dropdown on a document mouseup, which a synthetic click never sends.
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    if (!isActiveTab(item)) item.parentItem?.setActiveComponentItem?.(item, true);
}

/** Bring a panel forward, reopening it through Quick Launch when it is closed. */
async function activatePanel(target, opts) {
    let item = findItem(target);
    if (!item) {
        const ql = quickLaunchButton(target.panel);
        if (ql) {
            await showTab(ql.ql, opts);
            for (let d = ql.button.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
            const filter = panelElement(ql.ql)?.querySelector('.ql-filter');
            if (filter?.value) {
                filter.value = '';
                filter.dispatchEvent(new Event('input', { bubbles: true }));
                await FRAME();
            }
            await press(quickLaunchButton(target.panel)?.button, opts);
        } else {
            // What Quick Launch's own button does (`activate` in quickLaunchUI.js):
            // enabling a closed panel's module recreates it; `ui:activatePanel`
            // only raises a panel that exists.
            const moduleId = centralRegistry.panelComponents?.get?.(target.panel)?.moduleId;
            const api = typeof window !== 'undefined' ? window.moduleManagerApi : null;
            if (moduleId && api?.enableModule) await api.enableModule(moduleId);
            else opts.eventBus?.publish('ui:activatePanel', { panelId: target.panel }, 'tutorials');
        }
        item = await waitFor(() => findItem(target), 5000);
        if (!item) throw new Error(`panel ${target.panel} did not open`);
    }
    await showTab(item, opts);
    return item;
}

/** Resolves with `fn()`'s first truthy value, or null after `ms`. */
export async function waitFor(fn, ms, every = 100) {
    const end = Date.now() + ms;
    for (;;) {
        const v = await fn();
        if (v) return v;
        if (Date.now() >= end) return null;
        await sleep(every);
    }
}

/**
 * Perform one action. `opts`: { animate, moveMs, eventBus, controlTimeoutMs }.
 * Throws, naming the target, when it cannot be carried out.
 */
export async function performAction(action, opts) {
    const o = { animate: false, moveMs: 600, controlTimeoutMs: 8000, ...opts };
    o.animate = o.animate && isDesktopLayout();
    const { kind, target } = actionTarget(action);
    await activatePanel(target, o);
    if (kind === 'activate') return;
    if (target.optional && !findControl(target)) {
        await FRAME();
        if (!findControl(target)) return;
    }
    const el = await waitFor(() => {
        const c = findControl(target);
        return c && visible(c) && !c.disabled ? c : null;
    }, o.controlTimeoutMs);
    const name = `${target.panel} ${target.selector}${target.text !== undefined ? ` "${target.text}"` : ''}`;
    if (!el) throw new Error(`no enabled control ${name}`);
    if (kind === 'click') {
        await press(el, o);
        return;
    }
    if (kind === 'select' || kind === 'fill') {
        if (kind === 'select' && ![...(el.options ?? [])].some((opt) => opt.value === target.value)) {
            throw new Error(`${name} has no option "${target.value}"`);
        }
        el.scrollIntoView?.({ block: 'nearest' });
        if (o.animate) await moveCursorTo(el, o.moveMs);
        el.focus?.();
        el.value = target.value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        await FRAME();
        return;
    }
    // key: focus the control (or the panel), then send the key to it.
    el.scrollIntoView?.({ block: 'nearest' });
    if (o.animate) await moveCursorTo(el, o.moveMs);
    el.focus?.();
    for (const type of ['keydown', 'keyup']) {
        el.dispatchEvent(new KeyboardEvent(type, { key: target.key, code: target.key, bubbles: true }));
    }
    await FRAME();
}

/** Perform a step: its actions in order, then its `run`. */
export async function performStep(step, ctx, opts) {
    for (const a of step.actions ?? []) await performAction(a, opts);
    if (step.run) await step.run(ctx);
}
