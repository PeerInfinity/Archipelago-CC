/**
 * seedlingDemo/seedlingInventorySkin — THE V INVENTORY MENU, IN THE ORIGINAL GRAPHICS: `Inventory.render`
 * (`Inventory.as:334-435`) as screen-anchored draw ops, for `seedlingEffectSkin.screenOps`' `inventory` slot
 * (`Game.render()` draws it after the cover and before the hearts, `Game.as:1078-1082`).
 *
 * PURE: `inventoryView(run, menu)` copies what the picture needs (the slots, the X/C slots, the side items, the
 * keys, the totem parts, the menu's slide); `inventoryOps(view, art, { cam, font, textOps })` turns it into ops in
 * the effect skin's op shape. It reads the run's getters only and writes nothing.
 *
 * ⛔ NOT DRAWN: the Newgrounds tank (`:401`, left out of the pack with the other promotional images) and the
 * first-use / extended help text (`:417-432`): under the Bot `Inventory.help` is false, so neither tutorial is up.
 */
import { spriteOp } from './seedlingEnemySkin.js';
import { PANEL } from './inventoryMenu.js';

export const INVENTORY_KEYS = Object.freeze({
    panel: 'seedling:ui/inventory',
    items: 'seedling:ui/inventoryItems',
    side: 'seedling:ui/inventoryItemsSide',
    totem: 'seedling:ui/inventoryItemsTotem',
});

/** `Inventory.as:43-48` — the item column, the key grid, the side items and the totem, off the panel's offset. */
const ITEM_OFFSET = Object.freeze({ x: 40, y: 24 });
const ITEM_STEP = 32;
const ITEM_SIZE = 17;
const KEY_POSITIONS = Object.freeze([[2, 60], [15, 60], [2, 72], [15, 72], [9, 84]]);
const SIDE_POSITIONS = Object.freeze([[9, 107], [3, 119], [15, 119]]);
const TOTEM_POSITION = Object.freeze([5, 19]);
/** `Player.totemParts` — the totem sheet's frames (80 px / 16). */
const TOTEM_PARTS = 5;
/** `:345-348` — the dark sword draws over item 0. */
const DARK_SWORD_FRAME = 6;
/** `:351` — the selected item's `color`. */
const SELECTED_TINT = '#ffff44';

/** The picture's inputs, copied from the run and the core's menu readout. null when there is no run. */
export function inventoryView(run, menu) {
    if (!run || !menu) return null;
    const inv = run.inventory ?? {};
    const save = run.saveState ?? {};
    return {
        offset: { ...menu.offset },
        selected: menu.selected,
        scale: menu.scale,
        textScale: [...menu.textScale],
        slots: [...(run.inventorySlots ?? [])],
        primary: run.primary ?? 0,
        secondary: run.secondary ?? 0,
        darkSword: inv.hasDarkSword === true,
        side: [inv.canSwim === true, inv.hasTorch === true, inv.hasFeather === true],
        keys: Array.isArray(save.keys) ? [...save.keys] : [],
        totems: Array.isArray(save.totem_parts) ? [...save.totem_parts] : [],
    };
}

/**
 * The ops, in `Inventory.render`'s order: the panel, the items (the selected one tinted and pulsing), the totem
 * parts, the side items and keys, then the "X" and "C" markers (black, pulsing on a write). `textOps(text, x, y,
 * colour, scale)` is the caller's glyph drawer (the effect skin's font); `cam` is the camera's top-left.
 */
export function inventoryOps(view, art, { cam, textOps = null } = {}) {
    if (!view || !cam || view.offset.x + PANEL.w <= 0) return [];
    const ops = [];
    const at = (x, y) => ({ x: cam.x + x, y: cam.y + y });
    const fallbackRect = (x, y, w, h, colour) => ({ rect: { x, y, w, h, right: x + w, bottom: y + h }, colour, alpha: 1, layer: 0 });
    const sprite = (key, frame, p, opts = {}, fb = null) => {
        const op = art?.has?.(key) ? spriteOp(art, key, frame, p, { layer: 0, fallback: fb, ...opts }) : null;
        if (op) ops.push(op);
        else if (fb) ops.push(fb);
    };
    const o = view.offset;
    // `:339` — the background.
    const bg = at(o.x, o.y);
    sprite(INVENTORY_KEYS.panel, 0, bg, {}, fallbackRect(bg.x, bg.y, PANEL.w, PANEL.h, '#2a2a3a'));
    // `:342-360` — the item column, each centred (centerOO) at ceil(offset + itemOffset + 32·i).
    view.slots.forEach((id, i) => {
        const frame = view.darkSword && id === 0 ? DARK_SWORD_FRAME : id;
        const sel = view.selected === i;
        const p = at(Math.ceil(o.x + ITEM_OFFSET.x), Math.ceil(o.y + ITEM_OFFSET.y + ITEM_STEP * i));
        const fb = fallbackRect(p.x - 8, p.y - 8, ITEM_SIZE, ITEM_SIZE, sel ? SELECTED_TINT : '#cccccc');
        sprite(INVENTORY_KEYS.items, frame, p, sel ? { tint: SELECTED_TINT, scaleX: view.scale, scaleY: view.scale } : {}, fb);
    });
    // `:361-368` — the totem parts held, one frame each at (5, 19).
    for (let i = 0; i < TOTEM_PARTS; i += 1) {
        if (view.totems[i]) sprite(INVENTORY_KEYS.totem, i, at(o.x + TOTEM_POSITION[0], o.y + TOTEM_POSITION[1]));
    }
    // `:369-399` — the conch, the torch, the feather, then keys 0..4.
    view.side.forEach((held, i) => {
        if (held) sprite(INVENTORY_KEYS.side, i, at(o.x + SIDE_POSITIONS[i][0], o.y + SIDE_POSITIONS[i][1]));
    });
    KEY_POSITIONS.forEach(([x, y], k) => {
        if (view.keys[k]) sprite(INVENTORY_KEYS.side, 3 + k, at(o.x + x, o.y + y));
    });
    // `:404-415` — "X" left of the primary slot, "C" right of the secondary, black. FlashPunk's `Text` box is
    // `textWidth + 4` square-ish and `centerOO`, so its top-left is the point minus half the box.
    if (textOps && view.slots.length > 0) {
        const box = { w: 8, h: 12 };
        const rowY = (slot) => o.y + ITEM_OFFSET.y + ITEM_SIZE / 2 - box.h / 2 + ITEM_STEP * slot;
        const xLeft = o.x + ITEM_OFFSET.x - ITEM_SIZE / 2 - box.w / 2;
        const cLeft = o.x + ITEM_OFFSET.x + ITEM_SIZE + 1 - box.w / 2;
        ops.push(...textOps('X', cam.x + Math.round(xLeft - box.w / 2), cam.y + Math.round(rowY(view.primary) - box.h / 2), '#000000'));
        ops.push(...textOps('C', cam.x + Math.round(cLeft - box.w / 2), cam.y + Math.round(rowY(view.secondary) - box.h / 2), '#000000'));
    }
    return ops;
}
