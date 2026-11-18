/**
 * ⛓⛓ seedling-js-item-live-delivery — A HOST DELIVERY IS WRITTEN INTO THE LIVE RUN; NOTHING IS REBUILT
 * (⚖ Robert 2026-11-18T01:41Z, "Live apply, no rebuild"; cure A of the diagnosis
 * `CC/docs/cloud-reports/seedling-js-item-reboot-diagnosis.md`, reviewed by seedling-fidelity-planning-22).
 *
 * Until this slice an item flag, a key, a totem part or a seal part from the host REBOOTED the JS run where the
 * player stood (`jsRuntimeCore.rebootInPlace`): every killed enemy and pushed block came back and the respawn point
 * moved to the pickup. Robert's two reports were that, measured: L40 (the Red Key echo of the chest brings the
 * bobsoldier back under the chest, which is now the respawn point: a death every 52 ticks) and L39 (the Seal echo of
 * the totem resets the three fire blocks, so the three shaft locks shut again). Here the game's setters are what
 * they are — a save write (`Main.as:187-212`) read live — and these rows pin it.
 *
 * ── THE MUTATION LIST (each measured red; the report has the runs) ──
 *   d1 the core reboots again (`applyDeliveries` → `rebootInPlace(IN_PLACE_REBOOT_WHY)`)
 *        -> L40, L39, "no boot", the echo, the boundary rows red.
 *   d2 `deliver` syncs the slot at once (`syncSlots()` after the write)  -> the boundary row reds (slot before the tail).
 *   d3 the seal read is a build constant again (`hasAllSealPartsNow` → its value at construction)
 *        -> the 16th-seal chest row reds (the chest never goes).
 *   d4 the chest leaves at the boundary, not at the end of its own update (`sealRemovedAt` check dropped)
 *        -> the 16th-seal chest row reds (the player moves on the first tick).
 *   d5 the live seal's clear is not banked (the `chestgone`/`checkBySeal` arm `continue`s first) -> the chest row reds.
 *   d6 the Karlore hold dropped (`addedTimeHold` never set) -> the "current visit keeps him" row reds.
 *   d7 the session does not record the delivery on its staging (`session.deliver` without the push)
 *        -> the solver-shadow row reds (`ShadowDivergence`), and so does the L0 rock walk in `jsRuntimeSave.test.js`.
 *   d8 `deliver` not idempotent (a held key / seal value / flag value recorded again) -> the echo row reds.
 *   d9 `rebootInPlace` keeps the float constructor -> the restore row reds.
 *   d10 the tape deferral dropped (`tape.armed` out of `applyDeliveries`' gate) -> the tape row reds.
 *   (m5 of `jsRuntimeEncounterLegWalk.test.js` — `encounterHoldsDelivery` → false — reds that file's Bob row.)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createJsRuntime, IN_PLACE_REBOOT_WHY } from './jsRuntimeCore.js';
import { createRunForStaging } from './tapeRunner.js';
import { replayShadow } from './jsRuntimeSolver.js';
import { ADDED_TIME_PROPERTIES, ADDED_TIME_REMOVAL, buildLevelWorld } from './levelWorld.js';
import { ITEM_PROPERTIES } from './tapeFormat.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const TAPE_R5_SHAFT = readFileSync(join(HERE, 'fixtures/tapes/r5-shaft.json'), 'utf8');

const flag = (property, value = true) => ({ class: 'Main', property, value });
const keyCall = (i) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasKeySet', args: [i, true] });
const sealCall = (slot, id) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasSealPartSet', args: [slot, id] });
const totemCall = (i) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasTotemPartSet', args: [i, true] });
const newGame = (level, x, y) => ({ invocation: 'new_instance', className: 'Game', args: [level, x, y] });

/** A page on the vanilla map, booted by a host `new Game` after `before` (items staged into that boot). */
function page(level, x, y, before = []) {
    const rt = createJsRuntime({ log: () => {} });
    rt.game.configure(JSON.stringify({ state_properties: [{ class: 'Game', property: 'pendingCheck' }, { class: 'Main', property: 'level' }] }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, ...before, newGame(level, x, y)]);
    rt.tick();
    return rt;
}
const boots = (rt) => rt.events.filter((e) => e.type === 'boot').length;
const deliveryNotes = (rt) => rt.events.filter((e) => e.type === 'delivery');
const cleared = (rt, level, tag) => JSON.parse(rt.game.botStatus()).persistence_cleared.some((c) => c.level === level && c.tag === tag);
const pendingCheck = (rt) => JSON.parse(rt.game.readState()).pendingCheck;

describe('⛓ L40 — the chest\'s Red Key echo (Robert\'s death loop): no boot, the bobsoldier stays dead, no respawn at the chest', () => {
    // The diagnosis' `probe-reboot.mjs l40`: `new Game(40, 864, 848)` (restartLevel's own constructor), the bosslock
    // key staged before the boot; kill the bobsoldier, open the chest from below, the host echoes `hasKeySet(0, true)`.
    function toTheChest() {
        const rt = page(40, 864, 848, [flag('hasSword'), flag('hasShield'), flag('hasFire'), flag('hasWand'), keyCall(2)]);
        for (let t = 0; t < 3000; t += 1) {
            const p = rt.run.state;
            const b = rt.run.chasers.find((c) => c.id.startsWith('bobsoldier'));
            if (!b || b.destroy) break;
            const dx = b.x - p.x;
            const dy = b.y - p.y;
            const face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            rt.tick(Math.hypot(dx, dy) > 18 ? new Set([face]) : (t % 6 < 2 ? new Set(['primary']) : new Set([face])));
        }
        for (let t = 0; t < 20; t += 1) rt.tick(new Set());
        expect(rt.run.chasers.find((c) => c.id === 'bobsoldier@880,832')).toBeUndefined();
        // under the chest (tile 55,52), then UP into it until the check fires
        for (let t = 0; t < 120 && Math.abs(rt.run.state.x - 887.63) > 1; t += 1) rt.tick(new Set([rt.run.state.x < 887.63 ? 'right' : 'left']));
        const pc0 = pendingCheck(rt);
        for (let t = 0; t < 240 && pendingCheck(rt) === pc0; t += 1) rt.tick(new Set(['up']));
        expect(pendingCheck(rt)).toMatch(/\|40\|13\|0$/);
        return rt;
    }

    it('the echo is written into the live run: same run, no boot note, the ctor is the room\'s entry, the bobsoldier stays dead, 0 deaths in 1800 idle ticks', () => {
        const rt = toTheChest();
        const run0 = rt.run;
        const boots0 = boots(rt);
        const deaths0 = rt.deaths.length;
        rt.queueItems([keyCall(0)]);
        rt.tick();
        expect(rt.run).toBe(run0);
        expect(boots(rt)).toBe(boots0);
        expect(rt.events.some((e) => e.type === 'boot' && e.why === IN_PLACE_REBOOT_WHY)).toBe(false);
        expect(deliveryNotes(rt).at(-1)).toMatchObject({ kind: 'key', key: 0, changed: true, level: 40 });
        expect([...rt.run.keys].sort()).toEqual([0, 2]);
        expect(rt.run.worldCtor).toEqual({ x: 864, y: 848 });
        expect(rt.run.chasers.find((c) => c.id === 'bobsoldier@880,832')).toBeUndefined();
        for (let t = 0; t < 1800; t += 1) rt.tick(new Set());
        expect(rt.deaths.length - deaths0).toBe(0);
        expect(rt.run.chasers.find((c) => c.id === 'bobsoldier@880,832')).toBeUndefined();
        expect(rt.run.worldCtor).toEqual({ x: 864, y: 848 });
    }, 60_000);
});

describe('⛓ L39 — the totem\'s Seal echo (Robert\'s "some lock blocks reappear"): the three shaft locks stay open', () => {
    it('after tape r5-shaft holds the three locks open, the Seal is written live: same run, blocks and buttons kept, locks open 600 ticks on', () => {
        const rt = page(39, 144, 608);
        expect(rt.game.botLoadTape(TAPE_R5_SHAFT)).toMatch(/^ok/);
        expect(rt.game.botStart()).toMatch(/^ok/);
        for (let t = 0; t < 4000 && !JSON.parse(rt.game.botStatus()).finished; t += 1) rt.tick();
        const locks = () => (rt.run.activatorsNow?.responders ?? [])
            .filter((r) => ['wandlock@144,64', 'wandlock@144,48', 'wandlock@144,32', 'cover@144,112', 'cover@176,144', 'cover@112,144'].includes(r.id))
            .map((r) => `${r.id}:${r.open ? 'open' : 'shut'}`).sort();
        const open6 = ['cover@112,144:open', 'cover@144,112:open', 'cover@176,144:open', 'wandlock@144,32:open', 'wandlock@144,48:open', 'wandlock@144,64:open'];
        expect(locks()).toEqual(open6);
        for (let t = 0; t < 120 && rt.run.saveState?.totem_parts?.[2] !== true; t += 1) rt.tick(new Set(['left']));
        expect(rt.run.saveState.totem_parts[2]).toBe(true);
        const run0 = rt.run;
        const boots0 = boots(rt);
        const pushed0 = JSON.stringify(rt.run.pushedBlocks);
        rt.queueItems([sealCall(0, 0)]);
        for (let t = 0; t < 600; t += 1) rt.tick(new Set());
        expect(deliveryNotes(rt).filter((e) => e.kind === 'seal' && e.changed)).toHaveLength(1);
        expect(rt.run).toBe(run0);
        expect(boots(rt)).toBe(boots0);
        expect(JSON.stringify(rt.run.pushedBlocks)).toBe(pushed0);
        expect(locks()).toEqual(open6);
        expect(rt.run.worldCtor).toEqual({ x: 144, y: 608 });
    }, 60_000);
});

describe('⛓ condition 1 — WHEN IN THE TICK: at a tick boundary; live at the next step, the slot at that step\'s tail', () => {
    it('a flag queued between tick t and t+1: the run holds it before t+1\'s step, its slot appears at t+1\'s tail and not before', () => {
        const rt = page(19, 48, 48);
        for (let i = 0; i < 5; i += 1) rt.tick();
        const t = rt.run.ticksCompleted;
        rt.queueItems([flag('hasSword')]);
        expect(rt.run.inventory.hasSword).toBe(false);       // queued, not yet drained (the host's write is between frames)
        rt.drainItems();                                     // the boundary (a held frame's poll: no step)
        expect(rt.run.ticksCompleted).toBe(t);
        expect(rt.run.inventory.hasSword).toBe(true);        // live for the next step …
        expect(rt.run.inventorySlots).toEqual([]);           // … and the slot is NOT appended yet (no tail has run)
        expect(rt.run.deliveries).toEqual([{ t, level: 19, kind: 'flag', property: 'hasSword', value: true }]);
        rt.tick();
        expect(rt.run.ticksCompleted).toBe(t + 1);
        expect(rt.run.inventorySlots).toEqual([0]);          // t+1's tail (`syncSlotsAtTail`)
    });

    it('the live write is the GRANT path without its level gate: a delivery at t 0 and a boot grant read the same, tick for tick', () => {
        const a = page(19, 48, 48);
        const staging = { ...a.session.staging };
        const granted = createRunForStaging({ ...staging, grants: [{ level: 19, items: ['sword'] }] }, a.vanilla.source, { scratchPersistence: true });
        const delivered = createRunForStaging(staging, a.vanilla.source, { scratchPersistence: true });
        expect(delivered.deliver({ kind: 'flag', property: 'hasSword', value: true })).toEqual({ changed: true });
        // (the digest itself differs by construction: it carries the grant ledger, `grantsByLevel`)
        const read = (r) => JSON.stringify({ x: r.state.x, y: r.state.y, inv: r.inventory, slots: r.inventorySlots,
            primary: r.primary, presses: r.presses.map((p) => [p.t, p.fired, p.weapon]) });
        const keys = [new Set(), new Set(['primary']), new Set(), new Set(['right']), new Set(['primary']), new Set(), new Set()];
        for (const k of keys) {
            granted.advance(k);
            delivered.advance(k);
            expect(read(delivered)).toBe(read(granted));
        }
        expect(delivered.presses.length).toBeGreaterThan(0);   // not vacuous: the sword was swung
    });

    it('`deliver` refuses an unknown kind or an out-of-range slot by name', () => {
        const rt = page(19, 48, 48);
        expect(() => rt.run.deliver({ kind: 'potion' })).toThrow(/unknown kind/);
        expect(() => rt.run.deliver({ kind: 'key', key: 9 })).toThrow(/out of range/);
        expect(() => rt.run.deliver({ kind: 'seal', slot: 16, identity: 0 })).toThrow(/out of range/);
        expect(() => rt.run.deliver({ kind: 'flag', property: 'hasCake', value: true })).toThrow(/not an item property/);
    });
});

describe('⛓ a delivered KEY opens a BossLock in the same visit (L19, `bosslock@48,32`, keyType 0)', () => {
    it('without the key the lock holds the player; with it delivered live the same run walks through', () => {
        const ys = {};
        for (const deliver of [false, true]) {
            const rt = page(19, 48, 48);
            const run0 = rt.run;
            if (deliver) rt.queueItems([keyCall(0)]);
            for (let t = 0; t < 150; t += 1) rt.tick(new Set(['up']));
            const lock = rt.run.activatorsNow.responders.find((r) => r.id === 'bosslock@48,32');
            expect(rt.run).toBe(run0);
            expect(lock.open).toBe(deliver);
            ys[deliver] = rt.run.state.y;
        }
        expect(ys.false).toBeGreaterThan(48);   // held below the lock
        expect(ys.true).toBeLessThan(32);       // through it
    });
});

describe('⛓ condition 2 — SEAL 16 / CHESTSEAL\'s live half: the chest goes on the next frame, its flag banked as open()\'s', () => {
    it('L36 `chest@64,48` (tag 0): fifteen seals staged, the sixteenth delivered live while the player pushes into it', () => {
        const rt = page(36, 48, 48, Array.from({ length: 15 }, (_, i) => sealCall(i, i)));
        for (let t = 0; t < 40; t += 1) rt.tick(new Set(['right']));
        const x0 = rt.run.state.x;
        expect(x0).toBeLessThan(64);                              // the chest holds the player
        expect(rt.run.chestsSealRemoved).toBe(false);
        expect(cleared(rt, 36, 0)).toBe(false);
        const run0 = rt.run;
        rt.queueItems([sealCall(15, 15)]);
        rt.tick(new Set(['right']));                              // t+1: Chest.update's checkBySeal (before the Player)
        expect(rt.run).toBe(run0);
        expect(rt.run.chestsSealRemoved).toBe(true);
        expect(cleared(rt, 36, 0)).toBe(true);                    // (a) the flag is banked that frame
        expect(rt.run.state.x).toBe(x0);                          // (b) … and the chest was still a wall to the Player
        rt.tick(new Set(['right']));                              // t+2: `updateLists()` removed it at t+1's end
        expect(rt.run.state.x).toBeGreaterThan(x0);
        for (let t = 0; t < 20; t += 1) rt.tick(new Set(['right']));
        expect(rt.run.state.x).toBeGreaterThan(64 + 8);           // walked through the chest's cell
        expect(rt.events.filter((e) => e.type === 'check')).toHaveLength(1);   // reported once, as the game's write
    });
});

describe('⛓ condition 3 — KARLORE: a delivered Fire does not change the current visit; the next L48 entry builds without him', () => {
    const karlore = (run) => run.world.talkers.some((t) => t.tag === 'karlore');

    it('in L48: Fire delivered → Karlore stays (and stays through a mid-visit rebuild); the next new Game(48) drops him', () => {
        const rt = page(48, 112, 300);
        expect(karlore(rt.run)).toBe(true);
        rt.queueItems([flag('hasFire')]);
        for (let t = 0; t < 5; t += 1) rt.tick();
        expect(rt.run.inventory.hasFire).toBe(true);
        expect(karlore(rt.run)).toBe(true);                      // `added()` already ran this visit
        // a MID-VISIT memo drop (a v9 timed clear of the chest, tag 0, at tick 3) rebuilds the room: still him
        const staging = { ...rt.session.staging, persistence: [{ level: 48, tag: 0, at: 3 }] };
        const run = createRunForStaging(staging, rt.vanilla.source, { scratchPersistence: true });
        const w0 = run.world;
        run.deliver({ kind: 'flag', property: 'hasFire', value: true });
        for (let t = 0; t < 6; t += 1) run.advance(new Set());
        expect(run.world).not.toBe(w0);                          // (the rebuild happened: the chest is gone)
        expect(run.world.chests).toHaveLength(0);
        expect(karlore(run)).toBe(true);
        // the next `new Game(48, …)` builds without him (the host's re-entry; a death or a door in the same run goes
        // through `enterWorld` → `dropWorldIfBuiltStale`, R5 slice 4's path, which compares the same `addedTimeKey`)
        rt.queueItems([newGame(48, 112, 300)]);
        rt.tick();
        expect(rt.run.level).toBe(48);
        expect(karlore(rt.run)).toBe(false);
    });

    it('Fire delivered in another room: the next L48 build has no Karlore', () => {
        const rt = page(19, 48, 48);
        rt.queueItems([flag('hasFire')]);
        rt.tick();
        rt.queueItems([newGame(48, 112, 300)]);
        rt.tick();
        expect(rt.run.level).toBe(48);
        expect(karlore(rt.run)).toBe(false);
    });

    it('CENSUS of the build-time readers: a build reads the inventory for ADDED_TIME_REMOVAL only (Karlore/hasFire), and no key, totem or seal at all', () => {
        // (i) the builder's inputs, read off its own signature: no key / totem / seal input exists
        const src = readFileSync(join(HERE, 'levelWorld.js'), 'utf8');
        const sig = src.match(/export function buildLevelWorld\(levelRecord, \{\s*([^}]*)\}\s*=\s*\{\}\)/);
        expect(sig).not.toBeNull();
        expect(sig[1].split(',').map((s) => s.trim().split(/\s*=/)[0]).filter(Boolean).sort())
            .toEqual(['cleared', 'inventory', 'nextLevelRecord', 'roles']);
        // (ii) its `inventory` reads, code lines only: the parameter, the removal test, the key it stamps (+ `addedTimeKey`)
        const code = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
        expect(code.filter((l) => /\binventory\b/.test(l)).length).toBe(5);
        expect(code.filter((l) => /\b(totemParts|sealParts|hasAllSealParts|hasAllTotemParts|bootSave)\b/.test(l))).toEqual([]);
        expect(Object.keys(ADDED_TIME_REMOVAL)).toEqual(['karlore']);
        expect(ADDED_TIME_PROPERTIES).toEqual(['hasFire']);
        // (iii) MEASURED over the vanilla 116: an empty inventory and every item held build the same room but L48's
        const rt = page(19, 48, 48);
        const props = Object.values(ITEM_PROPERTIES);
        const empty = Object.fromEntries(props.map((s) => [s.property, s.kind === 'add' ? s.base : false]));
        const full = Object.fromEntries(props.map((s) => [s.property, s.kind === 'add' ? s.base + 5 : true]));
        const text = (w) => JSON.stringify({ ...w, addedTimeKey: null });
        const differ = [...rt.vanilla.records.keys()].filter((lv) => text(buildLevelWorld(rt.vanilla.source(lv), { inventory: empty }))
            !== text(buildLevelWorld(rt.vanilla.source(lv), { inventory: full })));
        expect(differ).toEqual([48]);
        // (iv) `levelRun`'s readers of the save mirrors, code lines only — every one is a per-tick read, the boot, or
        // `deliver` (reviewed for this slice; a NEW reader turns this red until it is classified)
        const lr = readFileSync(join(HERE, 'levelRun.js'), 'utf8').split('\n')
            .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
        const readers = lr.filter((l) => /\b(sealParts|totemParts|hasAllTotemParts|hasAllSealPartsNow)\b/.test(l));
        expect(readers.length).toBe(21);
        expect(lr.some((l) => /HAS_ALL_SEAL_PARTS/.test(l))).toBe(false);   // the build constant is gone
    }, 60_000);
});

describe('⛓ condition 5 — IDEMPOTENCE: the host\'s echo of what the run already holds changes nothing', () => {
    it('run.deliver: a held key, the same seal in the same slot, a flag at its value — unchanged, recorded once, one slot', () => {
        const rt = page(19, 48, 48);
        const run = rt.run;
        const s = rt.session;   // the core's path: the session writes the run and records the change on its staging
        expect(s.deliver({ kind: 'key', key: 1 })).toEqual({ changed: true });
        expect(s.deliver({ kind: 'key', key: 1 })).toEqual({ changed: false });
        expect(s.deliver({ kind: 'seal', slot: 0, identity: 4 })).toEqual({ changed: true });
        expect(s.deliver({ kind: 'seal', slot: 0, identity: 4 })).toEqual({ changed: false });
        expect(s.deliver({ kind: 'totem', index: 3 })).toEqual({ changed: true });
        expect(s.deliver({ kind: 'totem', index: 3 })).toEqual({ changed: false });
        expect(s.deliver({ kind: 'flag', property: 'hasSword', value: true })).toEqual({ changed: true });
        expect(s.deliver({ kind: 'flag', property: 'hasSword', value: true })).toEqual({ changed: false });
        rt.tick();
        expect(s.deliver({ kind: 'flag', property: 'hasSword', value: true })).toEqual({ changed: false });
        rt.tick();
        expect(run.inventorySlots).toEqual([0]);
        expect(run.deliveries.map((d) => d.kind)).toEqual(['key', 'seal', 'totem', 'flag']);
        expect(rt.session.staging.deliveries).toHaveLength(4);
    });

    it('through the core: the echo of a key the run picked up itself, and a re-pushed totem/seal, write nothing', () => {
        const rt = page(19, 48, 48);
        rt.run.deliver({ kind: 'key', key: 0 });           // as if picked up in play (the run's own `keys`)
        rt.queueItems([keyCall(0), totemCall(1), sealCall(2, 7)]);
        rt.tick();
        rt.queueItems([keyCall(0), totemCall(1), sealCall(2, 7)]);
        rt.tick();
        expect(deliveryNotes(rt).filter((e) => e.changed).map((e) => e.kind)).toEqual(['totem', 'seal']);
        expect(boots(rt)).toBe(2);
    });
});

describe('⛓ condition 4 — the TAPE deferral and the encounter hold are kept', () => {
    it('a delivery queued while a tape is armed waits for the tape\'s end, then lands live (no boot)', () => {
        const rt = page(39, 144, 608);
        expect(rt.game.botLoadTape(TAPE_R5_SHAFT)).toMatch(/^ok/);
        expect(rt.game.botStart()).toMatch(/^ok/);
        rt.tick();
        rt.queueItems([flag('hasTorch')]);
        rt.tick();
        expect(rt.run.inventory.hasTorch).toBe(false);
        for (let t = 0; t < 4000 && !JSON.parse(rt.game.botStatus()).finished; t += 1) rt.tick();
        const tapeRun = rt.run;
        const boots0 = boots(rt);
        rt.tick();
        expect(rt.run.inventory.hasTorch).toBe(true);
        expect(rt.run).toBe(tapeRun);
        expect(boots(rt)).toBe(boots0);
    }, 60_000);
});

describe('⛓ the JS solver\'s shadow replays a live delivery (the staging records it: `deliveries`)', () => {
    it('after live deliveries mid-room, `replayShadow` of the session reproduces the live run', () => {
        const rt = page(19, 48, 48);
        for (let t = 0; t < 4; t += 1) rt.tick(new Set(['right']));
        const t1 = rt.run.ticksCompleted;
        rt.queueItems([flag('hasSword'), keyCall(0)]);
        for (let t = 0; t < 6; t += 1) rt.tick(new Set(['up']));
        rt.queueItems([flag('hasShield')]);
        rt.drainItems();                                    // a write at the very end of the prefix
        expect(rt.session.staging.deliveries.map((d) => d.t)).toEqual([t1, t1, t1 + 6]);
        expect(rt.session.perTick).toHaveLength(t1 + 6);
        const shadow = replayShadow(rt.session, rt.vanilla.source, { scratchPersistence: true });
        expect(shadow.stateDigest()).toBe(rt.run.stateDigest());
        expect(shadow.inventory.hasShield).toBe(true);
    });
});

describe('⛓ condition 6 — `rebootInPlace` survives only for the RE2 restore, at an INTEGER constructor', () => {
    it('a restore mid-room reboots once, at the truncated position minus the half tile', () => {
        const rt = page(19, 48, 48);
        for (let t = 0; t < 7; t += 1) rt.tick(new Set(['down', 'right']));
        const { x, y } = rt.run.state;
        expect(Number.isInteger(x) && Number.isInteger(y)).toBe(false);   // not vacuous: a fractional position
        expect(rt.restoreSave(rt.exportSave())).toEqual({ ok: true });
        rt.tick();
        const boot = rt.events.filter((e) => e.type === 'boot').at(-1);
        expect(boot.why).toBe(IN_PLACE_REBOOT_WHY);
        expect(rt.run.worldCtor).toEqual({ x: Math.trunc(x - 8), y: Math.trunc(y - 8) });
    });
});
