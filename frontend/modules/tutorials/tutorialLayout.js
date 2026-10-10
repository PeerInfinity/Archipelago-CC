/**
 * tutorialLayout.js — split the Tutorial panel's column so the tutorial sits
 * in a stack of its own UNDER the panels it shares a stack with, and merge it
 * back. (⚖ the user, 2026-10-10: the default layout stays as it is; the split
 * happens when a tutorial starts, and there is a way to merge back. Desktop
 * only: the mobile layout is never split.)
 *
 * ⛓ Both moves keep the component INSTANCE: Golden Layout's own drag-and-drop
 * moves a tab with `removeChild(item, keepChild = true)` + `addChild`, and the
 * split below is its `Stack.onDrop` "bottom segment" path spelled out
 * (replaceChild the stack with a new column, then add the stack and a new stack
 * under it). So the panel's state — the tutorial, the step — survives.
 *
 * ⛓ The merge needs no layout surgery of its own: moving the component out of
 * the bottom stack empties it, an empty closable stack removes itself, and a
 * column left with one child replaces itself with that child
 * (`RowOrColumn.removeChild`). The left column is a plain stack again.
 */
import {
    ResolvedItemConfig, ResolvedStackItemConfig, SizeUnitEnum,
} from '../../libs/golden-layout/js/esm/golden-layout.js';

/** The id of the stack the split creates; the merge looks for it. */
export const TUTORIAL_STACK_ID = 'tutorial-stack';
/** The share of the column the tutorial's stack takes, in percent. */
export const TUTORIAL_STACK_SIZE = 40;

function layout() {
    return typeof window !== 'undefined' ? window.goldenLayoutInstance ?? null : null;
}

/** The layout's component items for `componentType` (and `title`, when given). */
export function componentItems(componentType, title) {
    const items = layout()?.getAllContentItems?.() ?? [];
    return items.filter((it) => it.isComponent && it.componentType === componentType
        && (title === undefined || it.title === title));
}

/** True on the desktop (Golden Layout) layout; the mobile layout has no instance. */
export function isDesktopLayout() {
    return Boolean(layout()) && !document.querySelector('.mobile-layout-container');
}

/** Is the tutorial's component in a stack of its own (split, or the user put it there)? */
export function isSplit(item) {
    const stack = item?.parentItem;
    return Boolean(stack?.isStack) && stack.contentItems.length === 1;
}

/**
 * Move `item` (the Tutorial panel's component) into a new stack under the stack
 * it is in now. No-op when it already has a stack to itself, or off the desktop
 * layout. Returns true when the panel ends in a stack of its own.
 */
export function splitOut(item) {
    const lm = layout();
    if (!lm || !item || !isDesktopLayout()) return false;
    if (isSplit(item)) return true;
    const stack = item.parentItem;
    const parent = stack?.parent;
    if (!stack?.isStack || !parent) return false;

    let column;
    if (parent.isColumn) {
        column = parent;                       // already in a column: just add a stack under it
    } else {
        column = lm.createContentItem(ResolvedItemConfig.createDefault('column'), stack);
        parent.replaceChild(stack, column);    // the column inherits the stack's width
        column.addChild(stack, 0, true);
    }
    const config = ResolvedStackItemConfig.createDefault();
    config.id = TUTORIAL_STACK_ID;
    const bottom = lm.createAndInitContentItem(config, column);
    stack.removeChild(item, true);
    bottom.addChild(item);
    const index = column.contentItems.indexOf(stack);
    column.addChild(bottom, index + 1, true);
    stack.size = 100 - TUTORIAL_STACK_SIZE;
    stack.sizeUnit = SizeUnitEnum.Percent;
    bottom.size = TUTORIAL_STACK_SIZE;
    bottom.sizeUnit = SizeUnitEnum.Percent;
    column.updateSize(false);
    bottom.setActiveComponentItem(item, false);
    return true;
}

/**
 * Put `item` back into the stack above it (the one the split put it under), as
 * its active tab. No-op unless it is alone in a stack inside a column.
 * Returns true when it moved.
 */
export function mergeBack(item) {
    if (!item || !isDesktopLayout() || !isSplit(item)) return false;
    const bottom = item.parentItem;
    const column = bottom.parent;
    if (!column?.isColumn) return false;
    const i = column.contentItems.indexOf(bottom);
    const above = column.contentItems[i - 1] ?? column.contentItems[i + 1];
    if (!above?.isStack) return false;
    bottom.removeChild(item, true);            // empties → removes itself → the column collapses
    above.addChild(item);
    above.setActiveComponentItem(item, false);
    return true;
}
