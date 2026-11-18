/**
 * ⛓⛓ seedling-early-delivery — AN ITEM THE SERVER SENDS BEFORE THE PAGE HAS FINISHED LOADING IS APPLIED ONCE LOADING
 * FINISHES, EXACTLY ONCE (⚖ Robert 2026-11-18T15:36:30Z: *"Measure both wasm and js. I don't want either to drop
 * items that arrive from the server early."*). The report: `CC/docs/cloud-reports/seedling-early-delivery.md`.
 *
 * The rows drive the REAL panel adapter (`FlashBridgeAdapter` over the shipped `games/seedling.json`) wired to the
 * REAL core the way `jsRuntimePage` wires them (`configure` → `onStateChanged` → `_onStateChanged`; `_buildQueue` →
 * `queueItems`), in the panel's own order: the page boots its vanilla first frame, the adapter attaches, the AP load
 * mounts its level set and teleports to the set's start. The AP inventory is the snapshot the adapter reads (the sink
 * the client's `ReceivedItems` writes). Five items: Progressive Sword (a slot flag), Red Key (a method item), one Seal
 * (a fill-log item), one Totem Shard (a fill-set item) and Health (`hitsMax` 3 → 4: an `add`, the TWICE detector).
 *
 * Two modes, both measured in the report:
 *   ONCE     the adapter's first push that carries the items, then nothing — what the CORE does with one write
 *            (the core must not depend on the adapter writing again);
 *   ADAPTER  the adapter keeps pushing every 3 ticks (the page's 100 ms at 30 fps) — what the PAGE does.
 *
 * ── THE MUTATION LIST (each applied to `jsRuntimeCore.js`, measured red, reverted; the report has the runs) ──
 *   e1 `stageSession` without the `hits_max` line (Health staged under `items`, which no seam key reads)
 *        -> every Health row reds (ONCE and ADAPTER: the ledger says 4, so the adapter never writes it again).
 *   e2 `mount` without `reseatHostDeliveries()` (item 8 of seedling-js-item-live-delivery: the mount wipes the
 *        AP inventory's keys, seals and totems) -> the ONCE "vanilla first frame" row reds.
 *   e3 `restoreSave` without `reseatHostDeliveries()` -> the ONCE restore row reds (sword, seal, Health).
 *   e4 `reseatHostDeliveries` appends a seal identity the log already holds (the `includes` guard dropped)
 *        -> the restore row reds TWICE (two seal slots for one Seal).
 *   e5 `applyItem` does not record the host's seal (`hostDelivered.seals` never written) -> the vanilla row reds.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createJsRuntime } from './jsRuntimeCore.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import { planLevelSetChunks } from './levelSetValidator.js';
import { FlashBridgeAdapter } from '../flashPanel/flashBridgeAdapter.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const GAME = readJson('frontend/modules/flashPanel/games/seedling.json');
const SET = assembleGeneratedSeedlingSet(readJson('frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json'), { selfPlayer: 1 }).set;
const ITEMS = Object.freeze({ 'Progressive Sword': 1, 'Red Key': 1, Seal: 1, 'Totem Shard': 1, Health: 1 });
const HELD = Object.freeze({ sword: true, key0: true, seals: 1, totems: 1, hitsMax: 4 });
const tp = (l, x, y) => ({ invocation: 'new_instance', className: 'Game', args: [l, x, y] });

/** A page: the core, the adapter over an AP inventory, wired as `jsRuntimePage` wires them. */
function makePage(mode) {
    const inventory = {};
    let adapter = null;
    const rt = createJsRuntime({ onStateChanged: (p, v) => adapter?._onStateChanged(p, v), log: () => {} });
    adapter = new FlashBridgeAdapter({
        config: GAME, flashObjectId: `early-delivery-${mode}`, stateManager: { getLatestStateSnapshot: () => ({ inventory }) },
        dispatcher: { publish: () => {} }, eventBus: { subscribe: () => () => {} }, log: () => {},
    });
    adapter._getFlash = () => rt.game;
    rt.setVanilla(MAP);
    let armed = false;
    let carried = 0;
    /** The adapter's push; true when it carried an item write (not a clear, not the menu). */
    const pushNow = () => {
        const items = adapter._buildQueue();
        if (!items.length) return false;
        rt.queueItems(items);
        return items.some((i) => i.method || (i.property && i.value !== false && i.property !== 'menu'));
    };
    const page = {
        rt,
        attach() { expect(adapter.configureBridge()).toBe('ok'); adapter.attach(); },
        grant() { Object.assign(inventory, ITEMS); armed = true; },
        push() {
            if (mode === 'adapter' || armed) {
                const c = pushNow();
                if (c) carried += 1;
                if (c && mode === 'once') armed = false;
            }
        },
        tick(n = 1) {
            for (let i = 0; i < n; i += 1) {
                if (i % 3 === 0 && (mode === 'adapter' || armed)) page.push();
                rt.tick();
            }
        },
        mount() {
            let r;
            for (const c of planLevelSetChunks(SET).chunks) r = rt.game.botLoadLevels(JSON.stringify(c));
            expect(r).toBe('ok');
        },
        start() { rt.queueItems([tp(SET.start.level, SET.start.x, SET.start.y)]); },
        get carried() { return carried; },
    };
    return page;
}

/** What the LIVE run holds (not a ledger, not a readout): what the player has. */
function held(rt) {
    const run = rt.run;
    return {
        sword: run.inventory.hasSword === true,
        key0: run.keys.has(0),
        seals: run.finalDoorGate.sealSlotsFilled,
        totems: run.saveState.totem_parts.filter((v) => v === true).length,
        hitsMax: run.inventory.hitsMax,
    };
}

/** The windows (the report's map); each returns the page after loading finished + 120 ticks. */
const WINDOWS = {
    /** the vanilla first frame runs; the items land in it; THEN the AP load mounts and teleports to the start */
    vanilla(p) { p.attach(); p.tick(3); p.grant(); p.push(); p.tick(3); p.mount(); p.start(); p.tick(120); },
    /** the set is mounted (no run), the start teleport not yet taken */
    mounted(p) { p.attach(); p.tick(3); p.mount(); p.grant(); p.push(); p.start(); p.tick(120); },
    /** in the same queue as a host `new Game`, before it */
    sameBoot(p) { p.attach(); p.tick(3); p.mount(); p.start(); p.tick(3); p.grant(); p.push(); p.start(); p.tick(120); },
    /** the run is up; the items land and, at the same boundary, the RE2 save written BEFORE them is restored */
    restore(p) {
        p.attach(); p.tick(3); p.mount(); p.start(); p.tick(6);
        const save = p.rt.exportSave();
        p.grant(); p.push(); p.rt.drainItems();
        expect(p.rt.restoreSave(save)).toEqual({ ok: true });
        p.tick(120);
    },
    /**
     * the RE2 save written AFTER the items (a reload: the server re-sends everything on connect): the restored save
     * and the host's write name the SAME seal and Health — held once, not twice (one seal slot, `hitsMax` 4)
     */
    restoreHeld(p) {
        p.attach(); p.tick(3); p.mount(); p.start(); p.tick(3); p.grant(); p.push(); p.tick(6);
        const save = p.rt.exportSave();
        expect(save.seals.filter((v) => v !== -1)).toHaveLength(1);   // not vacuous: the save holds the Seal
        expect(p.rt.restoreSave(save)).toEqual({ ok: true });
        p.tick(120);
    },
    /** CONTROL — the run is up, the items land live (no mount, no boot, no restore) */
    control(p) { p.attach(); p.tick(3); p.mount(); p.start(); p.tick(6); p.grant(); p.push(); p.tick(120); },
};

describe('⛓ seedling-early-delivery — ONCE: the core keeps one early write through the mount, a boot and the RE2 restore', () => {
    for (const [name, run] of Object.entries(WINDOWS)) {
        it(`${name}: every item is held by the live run once loading finished, exactly once`, () => {
            const p = makePage('once');
            run(p);
            expect(p.carried).toBe(1);                       // not vacuous: one push carried the items, and only one
            expect(p.rt.run.level).toBe(SET.start.level);
            expect(held(p.rt)).toEqual(HELD);
        });
    }

    it('vanilla: the items written into the vanilla first frame stay the new save\'s (the mount keeps the host\'s, not the old runs\')', () => {
        const p = makePage('once');
        p.attach(); p.tick(3); p.grant(); p.push(); p.tick(3);
        expect(held(p.rt)).toEqual(HELD);                    // written live into the vanilla L0 run first
        p.mount();
        expect(p.rt.exportSave()).toMatchObject({ keys: [0], totems: [0] });
        expect(p.rt.exportSave().seals.filter((v) => v !== -1)).toHaveLength(1);
        p.start(); p.tick(3);
        expect(held(p.rt)).toEqual(HELD);
        // staged by the start's boot, not delivered again: no delivery note after the mount
        const after = p.rt.events.slice(p.rt.events.findIndex((e) => e.type === 'mount'));
        expect(after.filter((e) => e.type === 'delivery')).toEqual([]);
    });
});

describe('⛓ seedling-early-delivery — ADAPTER: the page (the adapter re-pushing) holds every early item once', () => {
    for (const [name, run] of Object.entries(WINDOWS)) {
        it(`${name}: every item is held by the live run, exactly once`, () => {
            const p = makePage('adapter');
            run(p);
            expect(p.rt.run.level).toBe(SET.start.level);
            expect(held(p.rt)).toEqual(HELD);
        });
    }
});

describe('⛓ seedling-early-delivery — a level set mount still drops what the OLD set\'s runs earned and a restored save', () => {
    it('a key the run picked up itself and a restored save\'s key go at the mount; the host\'s key stays', () => {
        const p = makePage('once');
        p.attach(); p.tick(3); p.mount(); p.start(); p.tick(3);
        p.rt.run.deliver({ kind: 'key', key: 2 });             // as if picked up in play (the run's own `keys`)
        const save = { ...p.rt.exportSave(), keys: [2, 3] };
        expect(p.rt.restoreSave(save)).toEqual({ ok: true });
        p.grant(); p.push(); p.tick(3);
        expect(p.rt.exportSave().keys).toEqual([0, 2, 3]);
        p.mount();
        expect(p.rt.exportSave().keys).toEqual([0]);            // only the host's Red Key survives the new set
    });
});
