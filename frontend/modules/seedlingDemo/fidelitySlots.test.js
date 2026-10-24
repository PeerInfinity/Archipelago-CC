/**
 * Seedling fidelity SLOTS: the inventory's SLOT ARRAY is session state.
 *
 *   · The game's rule (`Inventory.as`): `items` is STATIC (`:51`);
 *     `addItemsFromSave` (`:291-332`) runs in every frame's tail and only
 *     APPENDS what the flags imply and the array lacks, its two fusions remove
 *     their parts (`removeItem`, `Main.primary %= length`, `:109-120`) and
 *     splice at a fixed index; only `Main.clearSave` / `freshSaveForLevelSet`
 *     (`clearItems`) empty it, and `Bot.botStart` calls neither. So the order is
 *     the order items ARRIVED: Fire granted before the sword is `[1, 0]` for the
 *     rest of the session. Measured on the game by
 *     `scripts/procgen/probe-seedling-slot-order.mjs` (`fixtures/slot-order-oracle.json`).
 *   · The model (`levelRun`): the array is the run's `slotOrder`, staged by the
 *     optional `inventory_slots` (a live game's `botStatus.inventory_slots`),
 *     grown by `tapeFormat.appendInventorySlots` in the frame's tail (a grant's
 *     item is not in it on the grant's own tick), with `Bot.drainEquipChecks`'s
 *     timing for an equip's bound and `getItem`'s out-of-range read (0, the sword).
 *   · The solver (`solverBot`): a segment that starts with Fire's slot selected
 *     while it holds a sword selects the sword's slot first (one idle tick when
 *     the sword arrived on that observation); the burn's slots are found in the
 *     run's own array; a tree already alight is waited out.
 *   · The witnesses (`plan-seedling-slots-witness.mjs`, recorded on the game):
 *     `slots-l24-fire-first` (D2), `slots-l24-burn-fire-first` (D3),
 *     `slots-l24-burn-cut-80` / `-110` (D4). tapeRunner holds the model to them.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { INVENTORY_ITEM_IDS, appendInventorySlots, inventorySlotsFor, inventorySlotsRefusal, parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape, stagingFromTape } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const ORACLE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'slot-order-oracle.json'), 'utf8'));
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const BASE = tape(ORACLE.base);
const NONE = new Set();
const FLAGS = ['hasSword', 'hasFire', 'hasWand', 'hasSpear', 'hasGhostSword', 'hasFireWand'];
const { sword, fire, wand, spear, ghostsword, firewand } = INVENTORY_ITEM_IDS;

/** The probe's window: the base staging, the window's items/grants/primary, idle. */
const windowStaging = (w) => {
    const t = parseTape({ ...BASE, seam: { ...BASE.seam, items: { ...BASE.seam.items, ...w.items }, primary: w.primary ?? 0 },
        grants: w.grants, equips: [], inputs: [], tick_count: ORACLE.idleTicks });
    return stagingFromTape(t);
};
/** The base staging with its own equips dropped, Fire held and the sword arriving by a grant at L24. */
const fireFirst = () => ({ ...stagingFromTape(BASE), equips: [],
    seam: { ...BASE.seam, items: { ...BASE.seam.items, hasSword: false } }, grants: [{ level: 24, items: ['sword'] }] });

describe('SLOTS D1 — the game\'s slot array (the oracle, recorded on the game)', () => {
    for (const arm of ORACLE.arms) {
        it(`${arm.name}: the model's array and primary equal the game's after every window`, () => {
            let staged = null;
            arm.rows.forEach((row, i) => {
                const run = createRunForStaging({ ...windowStaging(arm.windows[i]), ...(staged ? { inventory_slots: staged } : {}) }, SRC);
                for (let k = 0; k < ORACLE.idleTicks; k += 1) run.advance(NONE);
                staged = run.inventorySlots;
                expect(row.game.error).toBe('');
                expect({ slots: run.inventorySlots, primary: run.primary }).toEqual({ slots: row.game.slots, primary: row.game.primary });
            });
        });
    }
    it('the arms are the claim: Fire first is [1, 0], a later botStart rebuilds nothing, the fusion splices [0, 5]', () => {
        const last = (name) => ORACLE.arms.find((a) => a.name === name).rows.at(-1).game;
        expect(last('FIRE-FIRST').slots).toEqual([fire, sword]);
        expect(last('CANONICAL').slots).toEqual([sword, fire]);
        expect(last('NO-REBUILD').slots).toEqual([fire, sword]);
        expect(last('FUSION')).toMatchObject({ slots: [sword, firewand], primary: 0 });
        expect(ORACLE.press).toMatchObject({ game: { slots: [fire, sword], primary: 0, level: 12, burned: true } });
    });
});

describe('SLOTS D1 — `appendInventorySlots`, the transcription', () => {
    /** The fixed-order derivation `inventorySlotsFor` was until this slice, kept here as the reference. */
    const canonical = (items) => {
        const s = [];
        if (!items.hasGhostSword) { if (items.hasSword) s.push(sword); } else s.splice(0, 0, ghostsword);
        if (!items.hasFireWand) { if (items.hasFire) s.push(fire); if (items.hasWand) s.push(wand); } else s.splice(1, 0, firewand);
        if (!items.hasGhostSword && items.hasSpear) s.push(spear);
        return s;
    };
    it('from an empty array it IS the old fixed order, for all 64 flag sets (a fresh game reads byte-identically)', () => {
        for (let m = 0; m < 64; m += 1) {
            const items = Object.fromEntries(FLAGS.map((f, i) => [f, Boolean(m & (1 << i))]));
            expect(inventorySlotsFor(items)).toEqual(canonical(items));
        }
    });
    it('a late item is APPENDED; a held one is never re-added; a false flag removes nothing', () => {
        expect(appendInventorySlots([fire], { hasFire: true, hasSword: true }).slots).toEqual([fire, sword]);
        expect(appendInventorySlots([spear, sword], { hasSword: true, hasSpear: true }).slots).toEqual([spear, sword]);
        expect(appendInventorySlots([fire, sword], { hasFire: false, hasSword: true }).slots).toEqual([fire, sword]);
    });
    it('the fusions remove their parts and splice; `primary` is taken modulo after each removal, `% 0` landing on 0', () => {
        expect(appendInventorySlots([fire, sword, wand], { hasSword: true, hasFire: true, hasWand: true, hasFireWand: true },
            { primary: 2 })).toEqual({ slots: [sword, firewand], primary: 0 });
        expect(appendInventorySlots([spear, fire, sword], { hasSword: true, hasSpear: true, hasFire: true, hasGhostSword: true },
            { primary: 2 })).toEqual({ slots: [ghostsword, fire], primary: 0 }); // 2 % 2, then 0 % 1
        expect(appendInventorySlots([], { hasGhostSword: true }, { primary: 3 })).toEqual({ slots: [ghostsword], primary: 0 });
    });
    it('a staged array is refused by name when the game could hold it but this model cannot carry it', () => {
        expect(inventorySlotsRefusal([fire, sword], { hasFire: true, hasSword: true })).toBeNull();
        expect(inventorySlotsRefusal([fire, sword], { hasFire: true })).toMatch(/holds item 0 and the staged items do not hold hasSword/);
        expect(inventorySlotsRefusal([fire, fire], { hasFire: true })).toMatch(/twice/);
        expect(inventorySlotsRefusal([9], {})).toMatch(/not an item id/);
    });
});

describe('SLOTS D2 — the model carries the array as STAGED STATE', () => {
    it('a staging with `inventory_slots` boots in that order; without it, a fresh game\'s', () => {
        const staging = { ...stagingFromTape(BASE), equips: [] };
        expect(createRunForStaging(staging, SRC).inventorySlots).toEqual([sword, fire]);
        const staged = createRunForStaging({ ...staging, inventory_slots: [fire, sword] }, SRC);
        expect([staged.inventorySlots, staged.primaryWeapon, staged.progress('inventorySlots')]).toEqual([[fire, sword], 'fire', [fire, sword]]);
        expect(() => createRunForStaging({ ...staging, inventory_slots: [fire, sword, wand] }, SRC))
            .toThrow(/staged inventory_slots \[1,0,2\] holds item 2 and the staged items do not hold hasWand/);
    });
    it('a grant on the boot observation appends in that frame\'s TAIL: [1] at t0 (slot 0 reads Fire), [1, 0] after it', () => {
        const run = createRunForStaging(fireFirst(), SRC);
        expect([run.inventorySlots, run.primaryWeapon]).toEqual([[fire], 'fire']);
        run.advance(NONE);
        expect(run.inventorySlots).toEqual([fire, sword]);
    });
    it('`Bot.drainEquipChecks` at ITS time: the sword\'s slot selected on its grant\'s tick is refused (the bot disarms, measured)', () => {
        expect(() => createRunForStaging({ ...fireFirst(), equips: [{ t: 0, slot: 1 }] }, SRC))
            .toThrow(/equips slot 1 at tick 0, but the run holds 1 item\(s\) \(slots \[1\]\) when `Bot.as` checks it/);
        const run = createRunForStaging({ ...fireFirst(), equips: [{ t: 1, slot: 1 }] }, SRC);
        run.advance(NONE); // tick 0: its tail appends the sword
        run.advance(NONE); // tick 1: the equip, at the top, checked against [1, 0]
        expect([run.primary, run.primaryWeapon]).toEqual([1, 'sword']);
    });
    it('…and an EMPTY array defers the check, as the game does (a segment granting its items and selecting at t0)', () => {
        const staging = { ...stagingFromTape(BASE), seam: { ...BASE.seam, items: { ...BASE.seam.items, hasSword: false, hasFire: false } },
            grants: [{ level: 24, items: ['sword', 'fire'] }], equips: [{ t: 0, slot: 1 }] };
        const run = createRunForStaging(staging, SRC);
        expect([run.inventorySlots, run.primary]).toEqual([[], 1]);
        run.advance(NONE);
        expect([run.inventorySlots, run.primaryWeapon]).toEqual([[sword, fire], 'fire']);
    });
    it('`getItem` past the end reads 0, the sword: a press there is a SLASH while the sword is held (and nothing without it)', () => {
        const staging = { ...stagingFromTape(BASE), equips: [], seam: { ...BASE.seam, primary: 1,
            items: { ...BASE.seam.items, hasFire: false } } };
        expect(createRunForStaging(staging, SRC).primaryWeapon).toBe('sword');
        const bare = { ...staging, seam: { ...staging.seam, items: { ...staging.seam.items, hasSword: false, hasFire: true } } };
        expect(createRunForStaging(bare, SRC).primaryWeapon).toBe(null);
    });
    it('the D2 witness: its one press (slot 0) burns the tree in arrival order; the fresh-game order slashes and never crosses', () => {
        const w = tape('slots-l24-fire-first');
        expect([w.equips, w.grants]).toEqual([[], [{ level: 24, items: ['sword'] }]]);
        const out = runTape(w, { levelSource: SRC });
        expect([out.ticks.at(-1).level, out.treeBurns.length]).toEqual([12, 1]);
        // CONTROL: the same keys with both items in the seam (one sync: [0, 1]) — slot 0 is the sword.
        const control = parseTape({ ...w, grants: [], seam: { ...w.seam, items: { ...w.seam.items, hasSword: true } } });
        const c = runTape(control, { levelSource: SRC });
        expect([c.ticks.at(-1).level, c.treeBurns.length]).toEqual([24, 0]);
    });
});

describe('SLOTS D3 — the solver indexes the staged order', () => {
    const goal = { kind: 'reach-exit', exit: { x: 32, y: 144 } };
    const solveFrom = (staging) => {
        const run = createRunForStaging(staging, SRC);
        const out = solveSegment({ run, goals: [goal], name: 'slots-d3', boot: staging.boot, dashMode: 'all' });
        return { run, out };
    };
    it('Fire first (the sword arriving at t0): one idle tick, the sword\'s slot 1, Fire\'s 0 for the burn, the sword\'s 1 again', () => {
        const { run, out } = solveFrom(fireFirst());
        expect(out.equips).toEqual([{ t: 1, slot: 1 }, { t: 61, slot: 0 }, { t: 115, slot: 1 }]);
        expect(out.perTick[0].size).toBe(0);
        expect([run.level, run.primaryWeapon]).toEqual([12, 'sword']);
        // The committed witness is this plan.
        expect(tape('slots-l24-burn-fire-first').equips).toEqual(out.equips);
    });
    it('a STAGED [1, 0] (a live game\'s array): the sword\'s slot on tick 0, the same keys as the vanilla plan', () => {
        const { out } = solveFrom({ ...stagingFromTape(BASE), equips: [], inventory_slots: [fire, sword] });
        expect(out.equips).toEqual([{ t: 0, slot: 1 }, { t: 60, slot: 0 }, { t: 114, slot: 1 }]);
        const vanilla = tape('burn-l24-reach-exit');
        expect(out.perTick.length).toBe(vanilla.tick_count);
    });
});

describe('SLOTS D4 — BURN\'s residues, on the committed cuts (recorded on the game)', () => {
    it('cut at K=80 (mid-burn): the continuation selects the sword\'s slot and waits until the tree is gone (t105) before a key', () => {
        const w = tape('slots-l24-burn-cut-80');
        expect(w.equips).toEqual([{ t: 60, slot: 1 }, { t: 81, slot: 0 }]);
        const first = w.inputs.filter((i) => i.from > 80).map((i) => i.from).sort((a, b) => a - b)[0];
        expect(first).toBeGreaterThanOrEqual(105);
        expect(runTape(w, { levelSource: SRC }).ticks.at(-1).level).toBe(12);
    });
    it('the FENCEPOST: cut-80 walked one tick earlier steps toward the tree on update goneAt - 1 (t104), and the tree is still solid there', () => {
        const w = tape('slots-l24-burn-fencepost');
        const first = w.inputs.filter((i) => i.from > 80).map((i) => i.from).sort((a, b) => a - b)[0];
        expect(first).toBe(104);
        // The geometry is asked FOR the update at `ticksCompleted` (the game's recording: blocked on t104, through on t105).
        const out = runTape(w, { levelSource: SRC });
        expect(out.treeBurns[0].goneAt).toBe(105);
        expect([out.ticks[105].y, out.ticks[106].y > out.ticks[105].y]).toEqual([out.ticks[104].y, true]);
    });
    it('cut at K=110 (Fire\'s slot still selected): the continuation selects the sword\'s slot on its first tick', () => {
        const w = tape('slots-l24-burn-cut-110');
        expect(w.equips).toEqual([{ t: 60, slot: 1 }, { t: 111, slot: 0 }]);
        expect(runTape(w, { levelSource: SRC }).ticks.at(-1).level).toBe(12);
    });
});
