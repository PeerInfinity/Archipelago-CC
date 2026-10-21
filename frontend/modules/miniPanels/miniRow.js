/**
 * miniRow.js — the mini row: stacks at the top of the layout's middle column, each holding one panel in its
 * MINI view (the panel shrunk, most of its content hidden), each just tall enough for its content.
 *
 * ⛓ Every move keeps the component INSTANCE, as the Tutorial's split does (tutorials/tutorialLayout.js):
 * `removeChild(item, keepChild = true)` + `addChild`. A panel's state (the Playback Bot's whole run) survives
 * going mini and back. The empty stack a move leaves removes itself, and a column left with one child
 * collapses into it, so leaving the mini row needs no layout surgery.
 *
 * ⛓ LOCKED vs DRAGGABLE: Golden Layout fixes a stack's header when the stack is created, so switching
 * re-creates each mini stack with the other header config and moves the same component into it. Locked =
 * no tab header (a fixed strip: nothing to drag or close); draggable = an ordinary tab the user can drag
 * anywhere (the panel stays mini wherever it goes, until it is expanded).
 *
 * ⛓ HEIGHT: Golden Layout sizes items in percent only, so `fitColumn` measures each mini panel's content and
 * sets its stack's percent of the column; the other children share the rest in their old proportions.
 */
import {
    ResolvedItemConfig, ResolvedStackItemConfig, SizeUnitEnum,
} from '../../libs/golden-layout/js/esm/golden-layout.js';
import { getPanelUi } from '../../app/core/panelUiRegistry.js';

/** A mini stack's id is this prefix + the panel's componentType. */
export const MINI_STACK_PREFIX = 'mini-row:';
/** The share a new mini stack starts with, until fitColumn sizes it to its content. */
const NEW_MINI_PERCENT = 5;

// ── pure decisions (unit-tested) ─────────────────────────────────────────

/**
 * Where the checks text goes (⚖ the user, 2026-10-20): with only Checks on, the Checks panel has its own mini
 * row; with the Playback Bot mini too, the text rides in the bot's mini row and the Checks panel is taken out.
 */
export function planChecks({ checksOn, botMini }) {
    return {
        checksPanelInRow: !!checksOn && !botMini,
        botShowsChecks: !!checksOn && !!botMini,
    };
}

/** The index of the root row's child the mini row sits above: the middle one of three, else the second. */
export function middleIndex(childCount) {
    if (childCount <= 1) return 0;
    return 1;
}

/**
 * Percent sizes for a column's children: each mini child gets `px / columnPx` of the column, the others share
 * what is left in proportion to their current sizes. `children`: `[{ mini, px?, size }]`. Returns the sizes,
 * or null when the column has no height yet (not laid out).
 */
export function fitSizes(children, columnPx) {
    if (!(columnPx > 0)) return null;
    const minis = children.map((c) => (c.mini ? Math.min(100, (100 * c.px) / columnPx) : null));
    const miniTotal = minis.reduce((sum, p) => sum + (p ?? 0), 0);
    const rest = Math.max(0, 100 - miniTotal);
    const othersTotal = children.reduce((sum, c) => sum + (c.mini ? 0 : (c.size > 0 ? c.size : 1)), 0);
    return children.map((c, i) => (c.mini ? minis[i]
        : (othersTotal > 0 ? (rest * (c.size > 0 ? c.size : 1)) / othersTotal : rest)));
}

// ── the live layout ──────────────────────────────────────────────────────

function layout() {
    return typeof window !== 'undefined' ? window.goldenLayoutInstance ?? null : null;
}

/** True on the desktop (Golden Layout) layout; the mobile layout has no mini row. */
export function isDesktopLayout() {
    return Boolean(layout()) && !document.querySelector('.mobile-layout-container');
}

/** The layout's first component item of `componentType`, or null. */
export function componentItem(componentType) {
    const items = layout()?.getAllContentItems?.() ?? [];
    return items.find((it) => it.isComponent && it.componentType === componentType) ?? null;
}

/**
 * The panel UI object of a component item. Golden Layout calls the panel factory as a plain function, so it
 * keeps nothing for us; panelManager records every panel in app/core/panelUiRegistry.js.
 */
export function panelOf(item) {
    return getPanelUi(item?.container);
}

export function isMiniStack(item) {
    return Boolean(item?.isStack) && typeof item.id === 'string' && item.id.startsWith(MINI_STACK_PREFIX);
}

/** Is `item` (a component) in a mini stack? */
export function inMiniRow(item) {
    return isMiniStack(item?.parentItem);
}

/** The middle column's item (a stack, or the column the mini row already made), or null. */
function middleItem() {
    const root = layout()?.rootItem;
    if (!root) return null;
    if (!root.isRow) return root;
    const kids = root.contentItems;
    return kids[middleIndex(kids.length)] ?? null;
}

/** The column the mini row lives in, making it (by wrapping the middle stack) when it does not exist yet. */
function ensureColumn() {
    const lm = layout();
    const middle = middleItem();
    if (!lm || !middle) return null;
    if (middle.isColumn) return middle;
    const parent = middle.parent;
    if (!parent) return null;
    const column = lm.createContentItem(ResolvedItemConfig.createDefault('column'), middle);
    parent.replaceChild(middle, column);    // the column inherits the middle item's width
    column.addChild(middle, 0, true);
    middle.size = 100;                      // ⛔ every child of a row/column must be in PERCENT before a resize
    middle.sizeUnit = SizeUnitEnum.Percent; //    (Golden Layout asserts ROCCAS6692 otherwise)
    return column;
}

/** The first stack under `item` that is not a mini stack (depth-first), or null. */
function firstFullStack(item) {
    if (!item) return null;
    if (item.isStack) return isMiniStack(item) ? null : item;
    for (const child of item.contentItems ?? []) {
        const found = firstFullStack(child);
        if (found) return found;
    }
    return null;
}

function newMiniStack(column, componentType, locked, index) {
    const lm = layout();
    const config = ResolvedStackItemConfig.createDefault();
    config.id = `${MINI_STACK_PREFIX}${componentType}`;
    if (locked) {
        config.header = { show: false, popout: false, close: false, maximise: false, minimise: false, tabDropdown: false };
    }
    const stack = lm.createAndInitContentItem(config, column);
    column.addChild(stack, index, true);
    // ⛔ Sizes in PERCENT before anything resizes (as tutorialLayout's split does): the new stack a small share,
    // the others scaled into the rest.
    const others = column.contentItems.filter((kid) => kid !== stack);
    const total = others.reduce((sum, kid) => sum + (kid.size > 0 ? kid.size : 1), 0);
    for (const kid of others) {
        kid.size = ((100 - NEW_MINI_PERCENT) * (kid.size > 0 ? kid.size : 1)) / total;
        kid.sizeUnit = SizeUnitEnum.Percent;
    }
    stack.size = NEW_MINI_PERCENT;
    stack.sizeUnit = SizeUnitEnum.Percent;
    return stack;
}

/** Index in the mini column after its existing mini stacks (minis stack in the order they arrived). */
function miniInsertIndex(column) {
    let i = 0;
    while (i < column.contentItems.length && isMiniStack(column.contentItems[i])) i++;
    return i;
}

/**
 * The active tab of the middle column's full stack — what a reconcile puts back in front afterwards: opening
 * a closed panel there (enableModule) makes it the active tab, and moving it on up leaves Golden Layout to
 * pick a fallback tab (the last one), not the one the user was looking at.
 */
export function middleActiveItem() {
    return firstFullStack(middleItem())?.getActiveComponentItem?.() ?? null;
}

/** Bring `item` to the front of its stack again (a no-op when it moved into the mini row or is gone). */
export function reactivate(item) {
    const stack = item?.parentItem;
    if (!stack?.isStack || isMiniStack(stack) || !stack.contentItems.includes(item)) return;
    stack.setActiveComponentItem(item, false);
}

/**
 * Move `item` (a component) into a mini stack of its own at the top of the middle column. No-op when it is
 * already in one. Returns true when it ends in the mini row.
 */
export function moveToMiniRow(item, { locked }) {
    if (!item || !isDesktopLayout()) return false;
    if (inMiniRow(item)) return true;
    const column = ensureColumn();
    if (!column) return false;
    const from = item.parentItem;
    const stack = newMiniStack(column, item.componentType, locked, miniInsertIndex(column));
    from.removeChild(item, true);
    stack.addChild(item);
    stack.setActiveComponentItem(item, false);
    column.updateSize(false);
    return true;
}

/**
 * Move `item` out of the mini row, as the active tab of the middle column's first full stack. Returns true when
 * it moved (or was already outside the mini row).
 */
export function moveToFull(item) {
    if (!item || !isDesktopLayout()) return false;
    if (!inMiniRow(item)) return true;
    const home = firstFullStack(middleItem()) ?? firstFullStack(layout()?.rootItem);
    if (!home) return false;
    item.parentItem.removeChild(item, true);   // empties → removes itself → the column collapses when bare
    home.addChild(item);
    home.setActiveComponentItem(item, false);
    return true;
}

/**
 * Re-create every mini stack whose header does not match `locked`, moving its panel across. A mini panel the
 * user dragged out of the mini row comes back into it when the row is locked.
 */
export function relock(items, { locked }) {
    for (const item of items) {
        if (!item) continue;
        const stack = item.parentItem;
        const ok = inMiniRow(item) && stack.headerShow !== undefined && (!stack.headerShow) === locked;
        if (ok) continue;
        if (inMiniRow(item)) {
            const column = stack.parent;
            const index = column.contentItems.indexOf(stack);
            const fresh = newMiniStack(column, item.componentType, locked, index);
            stack.removeChild(item, true);
            fresh.addChild(item);
            fresh.setActiveComponentItem(item, false);
            column.updateSize(false);
        } else if (locked) {
            moveToMiniRow(item, { locked });
        }
    }
}

/**
 * Size the mini row's stacks to their content. `measure(item)` returns a mini panel's content height in px.
 * A stack's header (draggable mode) is added to it.
 */
export function fitColumn(measure) {
    const middle = middleItem();
    if (!middle?.isColumn) return;
    const kids = middle.contentItems;
    if (!kids.some(isMiniStack)) return;
    const columnPx = middle.element?.clientHeight ?? 0;
    const children = kids.map((kid) => {
        if (!isMiniStack(kid)) return { mini: false, size: kid.size };
        const item = kid.contentItems[0];
        const headerPx = kid.headerShow ? (kid.header?.element?.offsetHeight ?? 0) : 0;
        return { mini: true, px: Math.ceil((item ? measure(item) : 0) + headerPx) };
    });
    const sizes = fitSizes(children, columnPx);
    if (!sizes) return;
    const changed = kids.some((kid, i) => Math.abs((kid.size ?? 0) - sizes[i]) > 0.25 || kid.sizeUnit !== SizeUnitEnum.Percent);
    if (!changed) return;
    kids.forEach((kid, i) => {
        kid.size = sizes[i];
        kid.sizeUnit = SizeUnitEnum.Percent;
    });
    middle.updateSize(false);
}
