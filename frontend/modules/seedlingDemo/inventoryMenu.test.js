import { describe, expect, it } from 'vitest';

import {
    OFFSET_MIN, TEXT_SCALE, SCALE, createInventoryMenu, inventoryMenuFrame, inventoryMenuVisible, offsetMaxFor,
} from './inventoryMenu.js';

const ctx = (over = {}) => ({ openable: true, firstUse: true, slotCount: 3, extended: false, ...over });
const rel = (...keys) => new Set(keys);

describe('inventoryMenu — Inventory.update transcribed (Inventory.as:161-289)', () => {
    it('Inventory.as:193-196 — a V RELEASE toggles open; I (keys[8]) does too', () => {
        const m = createInventoryMenu();
        expect(inventoryMenuFrame(m, rel('inventory'), ctx()).toggled).toBe(true);
        expect(m.open).toBe(true);
        inventoryMenuFrame(m, rel('inventory2'), ctx());
        expect(m.open).toBe(false);
    });

    it('Inventory.as:193 — no toggle before firstUse (fewer than two items ever held)', () => {
        const m = createInventoryMenu();
        expect(inventoryMenuFrame(m, rel('inventory'), ctx({ firstUse: false })).toggled).toBe(false);
        expect(m.open).toBe(false);
    });

    it('Inventory.as:193-217 — the OPENING frame reads that frame\'s Down and X releases (toggle first)', () => {
        const m = createInventoryMenu();
        const r = inventoryMenuFrame(m, rel('inventory', 'down', 'primary'), ctx());
        expect(m.open).toBe(true);
        expect(m.selected).toBe(1);
        expect(r.writes).toEqual([{ kind: 'primary', slot: 1 }]);
    });

    it('Inventory.as:193-217 — the CLOSING frame does not read its Down / X / C releases', () => {
        const m = createInventoryMenu();
        inventoryMenuFrame(m, rel('inventory'), ctx());
        const r = inventoryMenuFrame(m, rel('inventory', 'down', 'primary', 'secondary'), ctx());
        expect(m.open).toBe(false);
        expect(m.selected).toBe(0);
        expect(r.writes).toEqual([]);
    });

    it('Inventory.as:200-207 — Up / Down wrap modulo items.length', () => {
        const m = createInventoryMenu();
        inventoryMenuFrame(m, rel('inventory'), ctx());
        inventoryMenuFrame(m, rel('up'), ctx());
        expect(m.selected).toBe(2);
        inventoryMenuFrame(m, rel('down'), ctx());
        inventoryMenuFrame(m, rel('down'), ctx());
        expect(m.selected).toBe(1);
        expect(m.scale).toBeCloseTo(SCALE.max - SCALE.rate);
    });

    it('Inventory.as:208-217 — X release writes primary, C release writes secondary, X before C in one frame', () => {
        const m = createInventoryMenu();
        inventoryMenuFrame(m, rel('inventory'), ctx());
        inventoryMenuFrame(m, rel('down'), ctx());
        const r = inventoryMenuFrame(m, rel('secondary', 'primary'), ctx());
        expect(r.writes).toEqual([{ kind: 'primary', slot: 1 }, { kind: 'secondary', slot: 1 }]);
        expect(m.textScale[0]).toBeCloseTo(TEXT_SCALE.max - TEXT_SCALE.rate);
    });

    it('Inventory.as:197 — closed, the arrows and X/C do nothing', () => {
        const m = createInventoryMenu();
        const r = inventoryMenuFrame(m, rel('down', 'primary', 'secondary'), ctx());
        expect(r.writes).toEqual([]);
        expect(m.selected).toBe(0);
    });

    it('Game.as:1044-1051 — not openable (talking, no input, a freeze not the menu\'s): forced closed, no slide', () => {
        const m = createInventoryMenu();
        inventoryMenuFrame(m, rel('inventory'), ctx());
        const x = m.offset.x;
        const r = inventoryMenuFrame(m, rel('down'), ctx({ openable: false }));
        expect(m.open).toBe(false);
        expect(r.toggled).toBe(true);
        expect(m.offset.x).toBe(x);
    });

    it('Inventory.as:265-272, :443-453 — the slide moves 1/5 of the way and snaps within 0.1', () => {
        const m = createInventoryMenu();
        inventoryMenuFrame(m, rel('inventory'), ctx());
        const target = offsetMaxFor(false).x;
        expect(m.offset.x).toBeCloseTo(OFFSET_MIN.x + (target - OFFSET_MIN.x) / 5);
        for (let k = 0; k < 200; k++) inventoryMenuFrame(m, rel(), ctx());
        expect(m.offset.x).toBe(target);
        expect(offsetMaxFor(true).x).toBe(0);
        inventoryMenuFrame(m, rel('inventory'), ctx());
        for (let k = 0; k < 200; k++) inventoryMenuFrame(m, rel(), ctx());
        expect(m.offset.x).toBe(OFFSET_MIN.x);
        expect(inventoryMenuVisible(m)).toBe(false);
    });

    it('Game.as:459 — selected persists across a close and re-open (the inventory is static)', () => {
        const m = createInventoryMenu();
        inventoryMenuFrame(m, rel('inventory'), ctx());
        inventoryMenuFrame(m, rel('down'), ctx());
        inventoryMenuFrame(m, rel('inventory'), ctx());
        inventoryMenuFrame(m, rel('inventory'), ctx());
        expect(m.selected).toBe(1);
    });
});
