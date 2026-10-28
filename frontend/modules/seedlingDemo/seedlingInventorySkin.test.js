import { describe, expect, it } from 'vitest';

import { INVENTORY_KEYS, inventoryOps, inventoryView } from './seedlingInventorySkin.js';
import { OFFSET_MIN, createInventoryMenu, inventoryMenuFrame } from './inventoryMenu.js';

/** A stand-in art pack: every inventory key, 1:1 frames, origin at the frame's centre for the item sheet. */
const art = {
    has: (k) => Object.values(INVENTORY_KEYS).includes(k),
    frameRect: (key, frame) => {
        const size = { [INVENTORY_KEYS.panel]: [66, 148, 0], [INVENTORY_KEYS.items]: [17, 17, 8],
            [INVENTORY_KEYS.side]: [8, 8, 0], [INVENTORY_KEYS.totem]: [16, 24, 0] }[key];
        return { frame, sheetRef: key, sx: frame * size[0], sy: 0, sw: size[0], sh: size[1], ox: size[2], oy: size[2] };
    },
};
const fakeRun = (over = {}) => ({
    inventorySlots: [1, 0], primary: 1, secondary: 0,
    inventory: { canSwim: true, hasTorch: false, hasFeather: false, hasDarkSword: false },
    saveState: { keys: [true, false, false, false, true], totem_parts: [false, true, false, false, false] }, ...over,
});
const openMenu = () => {
    const m = createInventoryMenu();
    inventoryMenuFrame(m, new Set(['inventory']), { openable: true, firstUse: true, slotCount: 2 });
    for (let k = 0; k < 100; k += 1) inventoryMenuFrame(m, new Set(), { openable: true, firstUse: true, slotCount: 2 });
    return m;
};
const cam = { x: 100, y: 50 };

describe('seedlingInventorySkin — Inventory.render as ops (Inventory.as:334-435)', () => {
    it('closed and slid out: nothing at all', () => {
        expect(inventoryOps(inventoryView(fakeRun(), createInventoryMenu()), art, { cam })).toEqual([]);
        expect(createInventoryMenu().offset.x).toBe(OFFSET_MIN.x);
    });

    it(':339-399 — panel, items (the selected one tinted), the totem part, the conch, the two keys, in that order', () => {
        const ops = inventoryOps(inventoryView(fakeRun(), openMenu()), art, { cam });
        expect(ops.map((o) => `${o.key}#${o.frame}`)).toEqual([
            `${INVENTORY_KEYS.panel}#0`,
            `${INVENTORY_KEYS.items}#1`, `${INVENTORY_KEYS.items}#0`,
            `${INVENTORY_KEYS.totem}#1`,
            `${INVENTORY_KEYS.side}#0`,
            `${INVENTORY_KEYS.side}#3`, `${INVENTORY_KEYS.side}#7`,
        ]);
        expect(ops[1].tint).toBe('#ffff44');          // slot 0 is selected
        expect(ops[2].tint).toBeUndefined();
        // the panel at offsetMax (-23 unextended, y = 80 - 74) in screen space, plus the camera
        expect({ x: ops[0].dx, y: ops[0].dy }).toEqual({ x: cam.x - 23, y: cam.y + 6 });
        // item i centred at ceil(offset + (40, 24 + 32 i))
        expect({ x: ops[2].dx + 8, y: ops[2].dy + 8 }).toEqual({ x: cam.x - 23 + 40, y: cam.y + 6 + 24 + 32 });
    });

    it(':345-348 — the dark sword draws frame 6 over item 0', () => {
        const ops = inventoryOps(inventoryView(fakeRun({ inventory: { hasDarkSword: true } }), openMenu()), art, { cam });
        expect(ops.filter((o) => o.key === INVENTORY_KEYS.items).map((o) => o.frame)).toEqual([1, 6]);
    });

    it(':404-415 — "X" on the primary row and "C" on the secondary row, black, via the caller\'s font', () => {
        const calls = [];
        inventoryOps(inventoryView(fakeRun(), openMenu()), art, { cam, textOps: (t, x, y, c) => { calls.push({ t, x, y, c }); return []; } });
        expect(calls.map((c) => [c.t, c.c])).toEqual([['X', '#000000'], ['C', '#000000']]);
        expect(calls[0].y - calls[1].y).toBe(32);       // primary is slot 1, secondary slot 0: one row apart
        expect(calls[1].x).toBeGreaterThan(calls[0].x);
    });

    it('an undecoded pack draws the panel and the items as rectangles, never nothing', () => {
        const ops = inventoryOps(inventoryView(fakeRun(), openMenu()), { has: () => false }, { cam });
        expect(ops.length).toBe(3);
        expect(ops.every((o) => o.rect)).toBe(true);
    });
});
