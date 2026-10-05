/**
 * seedlingDemo/wasmDelivery — MID-ROOM REPLAN's pure decisions: what a delivery writes, the slot order the
 * game will hold, and whether the model can take an item mid-run (`deliveryRefusal`'s clauses, each driven).
 *
 * The `prefix` witness is the census's own finding (slice `seedling-js-midroom-replan`): L6 with the kit, the
 * plan solved WITHOUT the dark sword, replayed WITH it staged at the arrival, leaves the model elsewhere at
 * the first slash — while the same plan's earlier ticks take it unchanged.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    DELIVERY_CLAUSES, deliveryRefusal, firstTickSlotRefusal, itemDelta, itemsAfterWrites, slotItemAt, slotsAfterDelivery, stageItems,
} from './wasmDelivery.js';
import { stagingFromWasmArrival } from './wasmArrival.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { liveOf, solveFromTape } from './jsRuntimeSolver.js';
import { createRunForStaging } from './tapeRunner.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { inventorySlotsFor } from './tapeFormat.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const SRC = levelSourceFromAtlas(indexLevels(MAP));
const HOUSE = readJson('frontend/modules/seedlingDemo/fixtures/wasm-arrival-p4f.json').arrivals.find((a) => a.status.level === 86);
const KIT = ['hasSword', 'hasShield', 'hasFire', 'hasWand', 'canSwim', 'hasSpear', 'hasFeather', 'hasTorch', 'hasDarkSuit'];

const houseStaging = () => stagingFromWasmArrival(HOUSE).staging;
const status = (items = {}, extra = {}) => ({ items: { ...HOUSE.status.items, ...items }, inventory_slots: inventorySlotsFor({ ...HOUSE.status.items, ...items }),
    primary: 0, secondary: 0, ...extra });

describe('wasmDelivery — what a delivery writes', () => {
    it('itemsAfterWrites takes item properties only; itemDelta names each change in property order', () => {
        const after = itemsAfterWrites({ hasSword: false, hitsMax: 3 }, [{ property: 'hasSword', value: true }, { property: 'hitsMax', value: 4 },
            { property: 'pendingExit', value: 'x' }]);
        expect(after).toEqual({ hasSword: true, hitsMax: 4 });
        expect(itemDelta({ hasSword: false, hitsMax: 3 }, after)).toEqual([{ property: 'hasSword', from: false, to: true },
            { property: 'hitsMax', from: 3, to: 4 }]);
    });

    it('stageItems writes the arrival\'s rows: `seam.items` booleans, and hitsMax where the block keeps it (`hits_max` in a latch block)', () => {
        const s = stageItems(houseStaging(), { ...HOUSE.status.items, hasSword: true, hitsMax: 5 });
        expect(s.seam.items.hasSword).toBe(true);
        expect(s.seam.hits_max).toBe(5);
        expect(s.seam.items.hitsMax).toBeUndefined();
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [86, 56, 56] }]);
        rt.tick();
        expect(stageItems(rt.session.staging, { hitsMax: 4 }).seam.items.hitsMax).toBe(4);
        expect(createRunForStaging(s, SRC, { scratchPersistence: true }).inventory.hasSword).toBe(true);
    });
});

describe('wasmDelivery — the slots the game will hold (`addItemsFromSave` over the CURRENT array)', () => {
    it('a slot added late lands at the END: [fire] + sword = [1, 0], not the model\'s [0, 1]', () => {
        expect(slotsAfterDelivery({ slots: [] }, { hasSword: true }).slots).toEqual([0]);
        expect(slotsAfterDelivery({ slots: [0] }, { hasSword: true, hasFire: true }).slots).toEqual([0, 1]);
        expect(slotsAfterDelivery({ slots: [1] }, { hasSword: true, hasFire: true }).slots).toEqual([1, 0]);
        expect(inventorySlotsFor({ hasSword: true, hasFire: true })).toEqual([0, 1]);
    });

    it('an EMPTIED array is `% 0`: the int setters make primary AND secondary 0 (the model\'s appendInventorySlots)', () => {
        expect(slotsAfterDelivery({ slots: [0], primary: 2, secondary: 3 }, { hasSword: true, hasSpear: true, hasGhostSword: true }))
            .toEqual({ slots: [4], primary: 0, secondary: 0 });
    });

    it('a fusion splices, and its removeItem takes primary/secondary modulo the shorter array', () => {
        expect(slotsAfterDelivery({ slots: [0, 3], primary: 1, secondary: 0 }, { hasSword: true, hasSpear: true, hasGhostSword: true }))
            .toEqual({ slots: [4], primary: 0, secondary: 0 });
        expect(slotsAfterDelivery({ slots: [0, 1, 2] }, { hasSword: true, hasFire: true, hasWand: true, hasFireWand: true }).slots).toEqual([0, 5]);
    });

    it('slotItemAt: an index past the end reads 0 (the sword\'s id), as `Inventory.getItem` coerces it', () => {
        expect(slotItemAt([], 0)).toBe(0);
        expect(slotItemAt([1, 3], 1)).toBe(3);
        expect(slotItemAt([1], 1)).toBe(0);
    });

    it('firstTickSlotRefusal: a first-tick press on a slot the delivery CHANGES is refused; the empty slot (reads the sword) is not', () => {
        expect(firstTickSlotRefusal({ before: [], after: [0], solution: [['primary']] })).toBeNull();
        expect(firstTickSlotRefusal({ before: [0], after: [0, 3], primary: 1, solution: [['primary']] })).toMatch(/first tick.*0 → 3/);
        expect(firstTickSlotRefusal({ before: [0], after: [0, 3], primary: 1, solution: [['right']] })).toBeNull();
    });
});

describe('wasmDelivery — deliveryRefusal, clause by clause', () => {
    it('the clauses, in order', () => {
        expect(DELIVERY_CLAUSES).toEqual(['build', 'prefix', 'slot-use', 'slot-index']);
    });

    it('nothing changes → null; a sword into the house mid-walk (no slot key pressed) → null', () => {
        const staging = houseStaging();
        expect(deliveryRefusal({ staging, shipped: [], items: HOUSE.status.items, status: status(), levelSource: SRC })).toBeNull();
        const walk = [...Array(20).fill(['up']), ...Array(10).fill([])];
        expect(deliveryRefusal({ staging, shipped: walk, items: { ...HOUSE.status.items, hasSword: true }, status: status(), levelSource: SRC })).toBeNull();
    });

    it('slot-use: the prefix pressed X while the game had no sword — the swing state is not in the digest', () => {
        const staging = houseStaging();
        const r = deliveryRefusal({ staging, shipped: [['primary'], [], []], items: { ...HOUSE.status.items, hasSword: true }, status: status(), levelSource: SRC });
        expect(r).toMatchObject({ clause: 'slot-use' });
        expect(r.why).toMatch(/tick 1/);
        // a PASSIVE item is not refused for the same press
        expect(deliveryRefusal({ staging, shipped: [['primary'], [], []], items: { ...HOUSE.status.items, hasShield: true }, status: status(), levelSource: SRC })).toBeNull();
    });

    it('⛓ SLOTS CONSUMER — a LATE slot (Fire held, the sword delivered) is taken: re-staged over the game\'s array, the model appends it as the game does', () => {
        const fire = status({ hasFire: true }, { inventory_slots: [1] });
        const staging = stageItems(houseStaging(), fire.items, { slots: [1] });
        const items = { ...fire.items, hasSword: true };
        expect(deliveryRefusal({ staging, shipped: [], items, status: fire, levelSource: SRC })).toBeNull();
        const restaged = stageItems(staging, items, { slots: fire.inventory_slots });
        expect(restaged.inventory_slots).toEqual([1]);
        const run = createRunForStaging(restaged, SRC, { scratchPersistence: true });
        expect(run.inventorySlots).toEqual(slotsAfterDelivery({ slots: [1] }, items).slots);
        expect(run.inventorySlots).toEqual([1, 0]);
        // omitted = the staging's own array
        expect(stageItems(staging, items).inventory_slots).toEqual([1]);
    });

    it('slot-index: a fusion moves the selected slot on the frame it lands', () => {
        const kit = { ...HOUSE.status.items, hasSword: true, hasSpear: true };
        const ss = stageItems(houseStaging(), kit);
        expect(deliveryRefusal({ staging: ss, shipped: [], items: { ...kit, hasGhostSword: true }, status: status(kit, { primary: 1 }), levelSource: SRC }))
            .toMatchObject({ clause: 'slot-index' });
    });

    it('prefix: L6 with the kit — the dark sword staged at the arrival moves the model at the first slash, not before', () => {
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems(KIT.map((p) => ({ class: 'Main', property: p, value: true })));
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [6, 32, 16] }]);
        rt.tick();
        const staging = rt.session.staging;
        const run = createRunForStaging(staging, SRC, { scratchPersistence: true });
        const plan = solveFromTape({ staging, perTick: [], live: liveOf(run), levelSource: SRC, solverGoal: { kind: 'reach-exit', exit: { x: 224, y: 32 } },
            scratchPersistence: true, dashMode: 'none' });
        const slash = plan.solution.findIndex((h) => h.has('primary'));
        expect(slash).toBeGreaterThan(0);
        const items = { ...staging.seam.items };
        const st = { items, inventory_slots: inventorySlotsFor(items), primary: 0, secondary: 0 };
        const dark = { ...items, hasDarkSword: true };
        expect(deliveryRefusal({ staging, shipped: plan.solution.slice(0, slash), items: dark, status: st, levelSource: SRC })).toBeNull();
        const r = deliveryRefusal({ staging, shipped: plan.solution, items: dark, status: st, levelSource: SRC });
        expect(r).toMatchObject({ clause: 'prefix' });
        expect(Number(r.why.match(/tick (\d+)/)[1])).toBeGreaterThan(slash);
    });
});
