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
    DELIVERY_CLAUSES, deliveredItems, deliveredSaveArrays, deliveryRefusal, firstTickSlotRefusal, itemDelta, itemsAfterWrites, liveSaveArrays, mergeSaveArrays,
    SAVE_ARRAY_MERGE, SAVE_ARRAYS, saveArraysOfWrites, saveDelta, slotItemAt, slotsAfterDelivery, stageItems, stageSaveArrays, UNION_SAVE_ARRAYS,
} from './wasmDelivery.js';
import { SAVE_ARRAY_RULES } from './saveArrayRules.js';
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
const HOUSE = readJson('frontend/modules/seedlingDemo/fixtures/wasm-arrival-p4g.json').arrivals.find((a) => a.status.level === 86);
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

    it('⛓ ENCOUNTERS-2 — deliveredItems is what a re-staging may put at the ARRIVAL: the changed rows only, never the room\'s own grant', () => {
        // the game holds the Fire the room granted mid-room; AP delivers the shield (and its own copy of the Fire)
        const game = { ...HOUSE.status.items, hasFire: true };
        expect(deliveredItems(game, { ...game, hasShield: true })).toEqual({ hasShield: true });
        expect(deliveredItems(game, game)).toEqual({});
        expect(deliveredItems({ hitsMax: 3 }, { hitsMax: 4 })).toEqual({ hitsMax: 4 });
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

describe('⛓ KEY DELIVERY — the save-array channel (`save.keys`) and its merge rule', () => {
    const keyWrite = (i) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasKeySet', args: [i, true],
        observed: { property: 'keyMask', bit: i }, save_array: 'keys', index: i });
    const bools = (idx) => Array.from({ length: 5 }, (_, i) => idx.includes(i));

    it('⚖ the rule is named PER ARRAY: keys UNION (never an overwrite); ⛓ SEAL DELIVERY: totems count-fill, seals log-append', () => {
        expect(SAVE_ARRAY_MERGE).toBe('per-array');
        expect(UNION_SAVE_ARRAYS).toEqual(['keys']);
        expect(SAVE_ARRAYS).toEqual(['keys', 'totem_parts', 'seal_parts']);
        expect(SAVE_ARRAY_RULES).toEqual({ keys: 'union', totem_parts: 'count-fill', seal_parts: 'log-append' });
        expect(() => saveArraysOfWrites([{ save_array: 'hasCoins', index: 0 }])).toThrow(/merge rule/);
    });

    it('the writes declare what they reach; property writes declare nothing', () => {
        expect(saveArraysOfWrites([keyWrite(3), { property: 'hasSword', value: true }, keyWrite(0)])).toEqual({ keys: [0, 3] });
        expect(saveArraysOfWrites([{ property: 'hasSword', value: true }])).toEqual({});
        expect(liveSaveArrays({ save: { keys: bools([1, 4]), totem_parts: bools([]) } })).toEqual({ keys: [1, 4], totem_parts: [] });
    });

    it('granted → staged; a key the GAME holds (picked up in play, AP does not hold it) is KEPT', () => {
        const s = { ...houseStaging(), save: { ...houseStaging().save, keys: [3] } };
        expect(stageSaveArrays(s, { keys: [0] }).save.keys).toEqual([0, 3]);
        expect(stageSaveArrays(s, {}).save.keys).toEqual([3]);
        expect(stageSaveArrays(s, { keys: [3] }).save.keys).toEqual([3]);
        expect(stageItems(s, HOUSE.status.items, { save: { keys: [1] } }).save.keys).toEqual([1, 3]);
        expect(mergeSaveArrays({ keys: [3] }, { keys: [0] }, { keys: [3, 2] })).toEqual({ keys: [0, 2, 3] });
        // the model reads it
        expect([...createRunForStaging(stageSaveArrays(s, { keys: [0] }), SRC, { scratchPersistence: true }).keys]).toEqual([0, 3]);
    });

    it('deliveredSaveArrays: only what is new to BOTH the staging and the game (a key the run picked up itself is not re-staged)', () => {
        const staging = { ...houseStaging(), save: { ...houseStaging().save, keys: [3] } };
        expect(deliveredSaveArrays({ staging, status: { save: { keys: bools([1]) } }, save: { keys: [0, 1, 3] } })).toEqual({ keys: [0] });
        expect(deliveredSaveArrays({ staging, status: { save: { keys: bools([0]) } }, save: { keys: [0, 3] } })).toEqual({});
        expect(saveDelta({ keys: [3] }, { keys: [0, 3] })).toEqual([{ array: 'keys', index: 0 }]);
    });

    it('deliveryRefusal: a key into the house, or into L19 at its arrival, is taken (null) — and the re-staged model holds it', () => {
        const st = status({}, { save: { keys: bools([]) } });
        expect(deliveryRefusal({ staging: houseStaging(), shipped: [], items: st.items, save: { keys: [0] }, status: st, levelSource: SRC })).toBeNull();
        // L19: the Boss Key 0 room, its lock `bosslock@48,32` the walk's sphere-2.1 refusal. (The model's digest does not
        // carry a pickup's presence, so the standing BossKey is no `build` difference; the lock is the live witness's.)
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [19, 16, 144] }]);
        rt.tick();
        const l19 = rt.session.staging;
        const at = { items: { ...l19.seam.items }, save: { keys: bools([]) } };
        expect(deliveryRefusal({ staging: l19, shipped: [], items: at.items, save: { keys: [0] }, status: at, levelSource: SRC })).toBeNull();
        expect([...createRunForStaging(stageItems(l19, at.items, { save: { keys: [0] } }), SRC, { scratchPersistence: true }).keys]).toEqual([0]);
        expect([...createRunForStaging(l19, SRC, { scratchPersistence: true }).keys]).toEqual([]);
    });
});

describe('⛓ SEAL DELIVERY — the seal LOG and the totem COUNT through the save-array channel', () => {
    const sealWrite = (slot, id = slot) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasSealPartSet', args: [slot, id],
        save_array: 'seal_parts', index: slot, fill: { rule: 'log', slot } });
    const totemWrite = (i) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasTotemPartSet', args: [i, true],
        save_array: 'totem_parts', index: i, fill: { rule: 'set', slot: i } });
    const log = (ids) => Array.from({ length: 16 }, (_, i) => (i < ids.length ? ids[i] : -1));
    const bools = (idx) => Array.from({ length: 5 }, (_, i) => idx.includes(i));
    const sixteen = Array.from({ length: 16 }, (_, i) => i);

    it('the writes declare the LOG in slot order; the game\'s log is its filled prefix', () => {
        expect(saveArraysOfWrites([sealWrite(1), sealWrite(0)])).toEqual({ seal_parts: [0, 1] });
        expect(saveArraysOfWrites([totemWrite(1), totemWrite(0)])).toEqual({ totem_parts: [0, 1] });
        expect(liveSaveArrays({ save: { seal_parts: log([7, 3]) } })).toEqual({ seal_parts: [7, 3] });
    });

    it('⚖ POSITIONAL, never a union: the game\'s log is the prefix; AP extends it to N slots with identities it does not hold', () => {
        expect(mergeSaveArrays({ seal_parts: [5] }, { seal_parts: [0, 1] })).toEqual({ seal_parts: [5, 0] });
        expect(mergeSaveArrays({ seal_parts: [5, 0] }, { seal_parts: [0] })).toEqual({ seal_parts: [5, 0] });   // never shortened
        expect(mergeSaveArrays({ seal_parts: [] }, { seal_parts: [0, 1, 2] })).toEqual({ seal_parts: [0, 1, 2] });
        // a union would have been [0, 1, 5] — three seals where AP and the game agree on two
        expect(mergeSaveArrays({ seal_parts: [5] }, { seal_parts: [0, 1] }).seal_parts).toHaveLength(2);
        // totems: a COUNT — the game's own index 3 and AP's one shard are ONE shard
        expect(mergeSaveArrays({ totem_parts: [3] }, { totem_parts: [0] })).toEqual({ totem_parts: [3] });
        expect(mergeSaveArrays({ totem_parts: [3] }, { totem_parts: [0, 1] })).toEqual({ totem_parts: [0, 3] });
    });

    it('stagings carry the seals: the arrival staging is EXTENDED (withApSave\'s stageSaveArrays), and the model reads them', () => {
        const s = { ...houseStaging(), save: { ...houseStaging().save, seal_parts: [9] } };
        expect(stageSaveArrays(s, { seal_parts: sixteen }).save.seal_parts).toEqual([9, ...sixteen.filter((i) => i !== 9)]);
        expect(stageSaveArrays(s, { seal_parts: [0] }).save.seal_parts).toEqual([9]);
        const run = createRunForStaging(stageSaveArrays(houseStaging(), { seal_parts: sixteen }), SRC, { scratchPersistence: true });
        expect(run.saveState.bootSealParts).toEqual(sixteen);
        // a staging with no seal granted is the staging unchanged (byte-identical defaults)
        const h = houseStaging();
        expect(stageSaveArrays(h, {})).toBe(h);
        expect(JSON.stringify(stageSaveArrays(h, { seal_parts: [] }).save)).toBe(JSON.stringify(h.save));
    });

    it('deliveredSaveArrays / stageItems: the DELTA is added at the arrival (a 2nd seal over a staged 1st is 2, not a fill to 1)', () => {
        const staging = { ...houseStaging(), save: { ...houseStaging().save, seal_parts: [0] } };
        const added = deliveredSaveArrays({ staging, status: { save: { seal_parts: log([0]) } }, save: { seal_parts: [0, 1] } });
        expect(added).toEqual({ seal_parts: [1] });
        expect(stageItems(staging, HOUSE.status.items, { save: added }).save.seal_parts).toEqual([0, 1]);
        expect(deliveredSaveArrays({ staging, status: { save: { seal_parts: log([0, 1]) } }, save: { seal_parts: [0, 1] } })).toEqual({});
        expect(saveDelta({ seal_parts: [4] }, { seal_parts: [4, 0] })).toEqual([{ array: 'seal_parts', index: 1, value: 0 }]);
        const t = { ...houseStaging(), save: { ...houseStaging().save, totem_parts: [3] } };
        const tAdded = deliveredSaveArrays({ staging: t, status: { save: { totem_parts: bools([3]) } }, save: { totem_parts: [0, 3] } });
        expect(tAdded).toEqual({ totem_parts: [0] });
        expect(stageItems(t, HOUSE.status.items, { save: tAdded }).save.totem_parts).toEqual([0, 3]);
    });

    it('deliveryRefusal: the 16th seal into the house at its arrival is taken (null), and named by its slot', () => {
        const st = status({}, { save: { seal_parts: log(sixteen.slice(0, 15)) } });
        const staging = { ...houseStaging(), save: { ...houseStaging().save, seal_parts: sixteen.slice(0, 15) } };
        expect(deliveryRefusal({ staging, shipped: [], items: st.items, save: { seal_parts: sixteen }, status: st, levelSource: SRC })).toBeNull();
    });
});
