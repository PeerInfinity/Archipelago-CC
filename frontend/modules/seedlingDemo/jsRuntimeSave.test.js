/**
 * ⛓⛓ RE2 — THE JS RUNTIME'S SAVE SURVIVES A PAGE RELOAD (slice `seedling-js-save-localstorage`; ⚖ Robert 2026-11-14:
 * "Progress now, position next"; damage: "No, a fresh life"). A reload is modelled as what it is: a SECOND, fresh core
 * (the page's memory is gone), booted the way the host boots it (the vanilla map, the start teleport, or the same set
 * delivered), handed the first core's `exportSave()` through JSON (what localStorage holds) by `restoreSave`.
 *
 * ⛔ THE FIXTURE IS THE SHIPPED RULES: the L0 rock is `seedling_playthrough`'s event record (`runtimeEventsOf`), walked
 * by the solver's clear-tag as the live page walks it; the generated set is `seedling_generated_room`'s.
 *
 * ── THE MUTATION LIST (run during development, each red by name here) ──
 *   m1 `restoreSave` skips the flags              → "a reload restores (a)–(f)…" red (the slot order [1, 0] is dropped
 *                                                    against empty flags: the restore boot's run has no slots)
 *   m2 `boot` ignores `restoredSlots`             → "a reload restores (a)–(f)…" red (the slot order is the flags' [0, 1])
 *   m3 the restore's reboot carries the damage    → "damage is NOT restored…" red (hits 1 after the restore)
 *   m4 `mount` keeps the restored slots           → "a NEW SET clears…" red (restorePending stays true)
 *   m5 `restoreSave` skips `carried`              → "a reload restores (a)–(f)…" red (the rock is back: {0,1} not cleared)
 *   m6 `jsSaveKey` ignores the room               → "a different room's key is ignored" red (room B restores A's save),
 *                                                    and "the key is the room's…" red (two rooms collide)
 *   m7 the write's catch does not report          → "a failed write is reported" red (no report)
 *   m8 `restoreSave` skips `time`                 → "a version-2 save brings back the day clock…" red (the reloaded
 *                                                    clock is a fresh page's 4822, not 7844)
 *   m9 `JS_SAVE_VERSIONS_READ` drops version 1     → "a version-1 save (no time) restores…" red (refused by version)
 *   m10 `flush` writes only a pending change       → "a flush with nothing announced still writes the moved clock…" red
 *                                                    (the stored time is the last boot's, 7822 → 4822)
 *   m11 the clock flush ignores a refused restore  → "a REFUSED stored save is never overwritten…" red
 *   m12 a malformed `time` refuses the whole save   → "a version-2 save with a MALFORMED time restores everything else…" red
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { createJsRuntime, JS_SAVE_VERSION, JS_SAVE_VERSIONS_READ } from './jsRuntimeCore.js';
import { PAGE_BOOT_TIME } from './gameClock.js';
import { dayLightAlpha } from './seedlingNightSkin.js';
import { WALK_STATES } from './jsRuntimeWalker.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';
import { planLevelSetChunks } from './levelSetValidator.js';
import { cellOf, routeWalker, tileRoute } from './jsRuntimeTestWalk.js';
import { atlasEventGoal, runtimeEventsOf } from '../flashPanel/seedlingPlaybackController.js';
import { bindJsSave, JS_SAVE_KEY_PREFIX, JS_SAVE_OWNER, jsSaveKey } from '../flashPanel/seedlingJsSave.js';

const readJson = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const MAP = readJson('../flashPanel/atlases/seedling-map.json');
const GAME_CONFIG = readJson('../flashPanel/games/seedling.json');
const FULL_CONFIG = { classes: GAME_CONFIG.classes, state_properties: GAME_CONFIG.state_properties, path_reads: GAME_CONFIG.path_reads };
const PT = readJson('../../presets/seedling_playthrough/AP_1/AP_1_rules.json');
const GEN = readJson('../../presets/seedling_generated_room/AP_1/AP_1_rules.json');
const EVENTS = runtimeEventsOf(PT).events;
const ROCK = EVENTS.find((e) => e.eventId === 'flag:L0:1');
const ROCK_ROOM = PT.preset_sidecars['1'][ROCK.side].playable_payload;
const ROCK_GOAL = atlasEventGoal(ROCK, ROCK_ROOM.level);
const START = [0, 80, 128];   // `Main.as:51`, the playthrough's start (`seedlingStartSpawn` 'boot')

const teleport = ([level, x, y]) => ({ invocation: 'new_instance', className: 'Game', args: [level, x, y] });
const flag = (property, value = true) => ({ class: 'Main', property, value });
const keyCall = (i) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasKeySet', args: [i, true] });
const sealCall = (slot, id) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasSealPartSet', args: [slot, id] });
const totemCall = (i) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasTotemPartSet', args: [i, true] });
const cleared = (rt) => JSON.parse(rt.game.botStatus()).persistence_cleared;
/** What localStorage would hand back. */
const reloaded = (save) => JSON.parse(JSON.stringify(save));
/** The save's progress: everything but the position (not used) and the day clock (it runs on after the reboot). */
const withoutAt = ({ at, time, ...rest }) => rest;

/** A fresh page on the vanilla map, at `at` (the host's start teleport). */
function vanillaPage(at = START) {
    const rt = createJsRuntime();
    rt.game.configure(FULL_CONFIG);
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, teleport(at)]);
    rt.tick();
    return rt;
}

/** The generated set delivered and started (the host's delivery + reset). */
function generatedPage() {
    const assembled = assembleGeneratedSeedlingSet(GEN, { selfPlayer: 1 });
    const rt = createJsRuntime();
    rt.game.configure(FULL_CONFIG);
    rt.tick();
    for (const c of planLevelSetChunks(assembled.set).chunks) rt.game.botLoadLevels(JSON.stringify(c));
    const { x, y, level } = assembled.set.start;
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, teleport([level, x, y])]);
    rt.tick();
    return { rt, assembled };
}

describe('⛓⛓ RE2 — the JS save across a page reload', () => {
    it('a reload restores (a)–(f): the broken L0 rock, keys, seals, totems, the slot order and the flags; the position is recorded, the player at the start', () => {
        // ── page 1: play ──
        const a = vanillaPage([ROCK_ROOM.level, ROCK_ROOM.exits.find((x) => x.entrance_spawn).entrance_spawn.x,
            ROCK_ROOM.exits.find((x) => x.entrance_spawn).entrance_spawn.y]);
        a.queueItems([flag('hasFire')]);
        a.tick();
        a.queueItems([flag('hasSword')]);
        a.tick();
        expect(a.run.inventorySlots).toEqual([1, 0]);        // the acquisition order (a fresh boot would be [0, 1])
        a.queueItems([keyCall(0), keyCall(3), sealCall(0, 5), totemCall(2)]);
        a.tick();
        a.playback.setSolverWalk(true);
        expect(a.playback.walkTo(ROCK_GOAL)).toEqual({ ok: true });
        a.playback.play();
        for (let t = 0; t < 4000 && ![WALK_STATES.DONE, WALK_STATES.FAILED].includes(a.playback.state); t += 1) a.tick();
        expect(a.playback.state).toBe(WALK_STATES.DONE);
        expect(cleared(a)).toContainEqual({ level: 0, tag: 1 });   // the rock is broken, in THIS run (not banked yet)
        const save = a.exportSave();
        expect(save).toMatchObject({ version: JS_SAVE_VERSION, set: null, keys: [0, 3], totems: [2],
            seals: [5, ...Array(15).fill(-1)], collected: [],
            slots: { slots: [1, 0] }, flags: { hasFire: true, hasSword: true } });
        expect(save.carried).toContainEqual([0, 1]);
        // the position: where the player stands (constructor args), recorded
        expect(save.at).toEqual({ level: a.run.level, x: a.run.state.x - 8, y: a.run.state.y - 8 });
        expect('player_damage' in save || 'damage' in save || 'hits' in save).toBe(false);

        // ── the reload: a fresh page, at the start, handed the stored save ──
        const b = vanillaPage(START);
        expect(cleared(b)).toEqual([]);
        expect(b.restoreSave(reloaded(save))).toEqual({ ok: true });
        expect(cleared(b)).toContainEqual({ level: 0, tag: 1 });   // at once: the host's event load read sees it
        expect(b.restorePending).toBe(true);
        b.tick();                                                  // the restore's reboot in place
        expect(b.restorePending).toBe(false);
        // ⛓ seedling-js-item-live-delivery — the restore is the one reboot in place left; its note names it
        expect(b.events.at(-1).message).toMatch(/boot level 0 at \(80, 128\) — the save was restored$/);
        expect(Number.isInteger(b.run.worldCtor.x) && Number.isInteger(b.run.worldCtor.y)).toBe(true);   // an int ctor
        expect([b.run.level, b.run.worldCtor.x, b.run.worldCtor.y]).toEqual(START);   // ⚖ the player at the start
        expect(b.run.inventorySlots).toEqual([1, 0]);
        expect([...b.run.keys].sort()).toEqual([0, 3]);
        // (a)–(f) byte-for-byte: everything but the position (the reload put the player at the start)
        expect(withoutAt(b.exportSave())).toEqual(withoutAt(save));
        // and the restored clear is no live clear: nothing is reported as newly cleared
        expect(b.events.filter((e) => e.type === 'check')).toEqual([]);
    }, 120_000);

    it('a reload restores the collected apitems of a delivered set (the apitem is not there to take again)', () => {
        const { rt: a } = generatedPage();
        const run = a.run;
        const route = tileRoute(a.mounted.records.get(run.level), cellOf(run.state.x, run.state.y), { tx: 4, ty: 1 });
        const walker = routeWalker(route);
        for (let t = 0; t < 3000 && !walker.done; t += 1) a.tick(walker.next(a.run.state.x, a.run.state.y));
        a.tick();
        expect([...a.collected]).toEqual(['0:0']);
        const save = a.exportSave();
        expect(save.collected).toEqual([[0, 0]]);
        expect(save.set).toBe(a.mounted.set.set_id);
        const { rt: b } = generatedPage();
        expect(b.view().apItems.some((x) => x.tag === 0)).toBe(true);
        expect(b.restoreSave(reloaded(save))).toEqual({ ok: true });
        b.tick();
        expect([...b.collected]).toEqual(['0:0']);
        expect(b.view().apItems.some((x) => x.tag === 0)).toBe(false);
        expect(withoutAt(b.exportSave())).toEqual(withoutAt(save));
    });

    it('damage is NOT restored: the restore\'s reboot is a fresh life (an item flag\'s reboot keeps it — the control)', () => {
        const ITEMS_73 = { hasTorch: true, hasSpear: true, hasFeather: true, canSwim: true, hasWand: true, hasFire: true, hasShield: true,
            hasSword: true, hasDarkSword: true, hasDarkShield: true };
        const hitPage = () => {
            const rt = createJsRuntime();
            rt.setVanilla(MAP);
            rt.queueItems([...Object.entries(ITEMS_73).map(([p, v]) => flag(p, v)), flag('hitsMax', 3), teleport([73, 64, 16])]);
            rt.tick();
            rt.tick(new Set(['down', 'right']));
            expect(rt.run.damage.hits).toBe(1);
            return rt;
        };
        // the control: an item flag's reboot in place keeps the hit
        const control = hitPage();
        control.queueItems([flag('hasDarkSuit')]);
        control.tick(new Set());
        expect(control.run.damage.hits).toBe(1);
        // the restore: the same page, its own save put back — the hit is gone
        const rt = hitPage();
        expect(rt.restoreSave(reloaded(rt.exportSave()))).toEqual({ ok: true });
        rt.tick(new Set());
        expect(rt.run.level).toBe(73);
        expect(rt.run.stagedDamage).toBe(null);
        expect(rt.run.damage.hits).toBe(0);
    });

    it('a NEW SET clears everything a restore put back, as it clears a played save', () => {
        const { rt, assembled } = generatedPage();
        const save = { ...rt.exportSave(), carried: [[0, 3]], keys: [1], totems: [0], seals: rt.exportSave().seals.map((_, i) => (i === 0 ? 2 : -1)),
            slots: { slots: [0], primary: 0, secondary: 0, firstUse: false }, flags: { ...rt.exportSave().flags, hasSword: true } };
        expect(rt.restoreSave(save)).toEqual({ ok: true });
        expect(rt.restorePending).toBe(true);
        // a different set arrives (its own id): the mount clears the save, restored or played
        const other = structuredClone(assembled.set);
        other.set_id = `${other.set_id}-other`;
        for (const c of planLevelSetChunks(other).chunks) rt.game.botLoadLevels(JSON.stringify(c));
        expect(rt.mounted.set.set_id).toBe(other.set_id);
        expect(rt.restorePending).toBe(false);
        expect(rt.exportSave()).toMatchObject({ set: other.set_id, carried: [], collected: [], keys: [], totems: [],
            seals: save.seals.map(() => -1), slots: null, at: null });
        // … and a save for the OLD set is refused by name on the new one
        const refused = rt.restoreSave(save);
        expect(refused.ok).toBe(false);
        expect(refused.reason).toMatch(/is for level set .* and .*-other is mounted/);
    });

    it('a malformed save is refused by name and changes nothing', () => {
        const rt = vanillaPage();
        const before = rt.exportSave();
        expect(rt.restoreSave({ version: 99 }).reason).toMatch(/version 99/);
        expect(rt.restoreSave({ ...before, carried: [[0, 'x']] }).reason).toMatch(/carried/);
        expect(rt.exportSave()).toEqual(before);
        expect(rt.restorePending).toBe(false);
    });
});

describe('⛓⛓ RE2 — the host keeps the save: one localStorage key per room (`seedlingJsSave.js`)', () => {
    const memoryStorage = (init = {}) => {
        const m = new Map(Object.entries(init));
        return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, map: m };
    };
    const manualTimers = () => {
        const q = new Map();
        let id = 0;
        return { setTimeout: (fn) => { id += 1; q.set(id, fn); return id; }, clearTimeout: (i) => q.delete(i),
            run: () => { const fns = [...q.values()]; q.clear(); fns.forEach((f) => f()); }, get pending() { return q.size; } };
    };

    it('the key is the room\'s: the prefix the Storage panel declares, a stable hash of the mount key, and two rooms differ', () => {
        expect(jsSaveKey('room A')).toBe(jsSaveKey('room A'));
        expect(jsSaveKey('room A')).toMatch(new RegExp(`^${JS_SAVE_KEY_PREFIX}[0-9a-f]{16}$`));
        expect(jsSaveKey('room A')).not.toBe(jsSaveKey('room B'));
        const flashIndex = readFileSync(new URL('../flashPanel/index.js', import.meta.url), 'utf8');
        expect(flashIndex).toContain(`prefix: '${JS_SAVE_KEY_PREFIX}'`);
    });

    it('a change is written once, debounced; dispose flushes; the stored save restores into the next page of the SAME room', () => {
        const storage = memoryStorage();
        const timers = manualTimers();
        const a = vanillaPage();
        const bound = bindJsSave({ runtime: a, roomKey: 'room A', storage, timers });
        expect(bound.restored).toBe(null);
        a.queueItems([keyCall(2)]);
        a.tick();                           // a key: a reboot in place → the boot announces a change
        a.queueItems([keyCall(4)]);
        a.tick();
        expect(timers.pending).toBe(1);     // debounced: one write pending for both
        timers.run();
        expect(JSON.parse(storage.getItem(jsSaveKey('room A'))).keys).toEqual([2, 4]);
        a.queueItems([totemCall(1)]);
        a.tick();
        bound.dispose();                    // the panel's teardown: the pending write lands now
        expect(JSON.parse(storage.getItem(jsSaveKey('room A'))).totems).toEqual([1]);
        // the reload: the same room's page restores it
        const b = vanillaPage();
        const again = bindJsSave({ runtime: b, roomKey: 'room A', storage, timers });
        expect(again.restored).toEqual({ ok: true });
        b.tick();
        expect([...b.run.keys].sort()).toEqual([2, 4]);
    });

    it('a different room\'s key is ignored: nothing is restored', () => {
        const storage = memoryStorage();
        const a = vanillaPage();
        a.queueItems([keyCall(5)]);
        a.tick();
        storage.setItem(jsSaveKey('room A'), JSON.stringify(a.exportSave()));
        const b = vanillaPage();
        const spy = vi.spyOn(b, 'restoreSave');
        const bound = bindJsSave({ runtime: b, roomKey: 'room B', storage, timers: manualTimers() });
        expect(bound.restored).toBe(null);
        expect(spy).not.toHaveBeenCalled();
        b.tick();
        expect([...b.run.keys]).toEqual([]);
    });

    it('a failed write is reported (`reportStorageWriteFailure`, the key, the value, the owner) and logged', () => {
        const quota = Object.assign(new Error('the quota has been exceeded'), { name: 'QuotaExceededError' });
        const storage = { getItem: () => null, setItem: () => { throw quota; } };
        const report = vi.fn();
        const logs = [];
        const timers = manualTimers();
        const rt = vanillaPage();
        const bound = bindJsSave({ runtime: rt, roomKey: 'room A', storage, report, timers, log: (m) => logs.push(m) });
        rt.queueItems([keyCall(1)]);
        rt.tick();
        timers.run();
        expect(report).toHaveBeenCalledTimes(1);
        const [failure] = report.mock.calls[0];
        expect(failure).toMatchObject({ key: bound.key, error: quota, owner: JS_SAVE_OWNER });
        expect(JSON.parse(failure.value).keys).toEqual([1]);
        expect(logs.some((m) => /NOT written/.test(m))).toBe(true);
    });
});

describe('⛓ sdc-js-save-day-clock — the JS save brings back the time of day (⚖ Robert 2026-11-22: "Keep it, and make JS match")', () => {
    /** Play `n` ticks standing still (the clock runs one `Game.time` a tick). */
    const idle = (rt, n) => { for (let i = 0; i < n; i += 1) rt.tick(); };
    /** What a fresh page's clock reads above `PAGE_BOOT_TIME` once booted (the pre-swap frame + the room fade). */
    const freshOffset = () => vanillaPage().run.gameTime - PAGE_BOOT_TIME;

    it('the version is 2 and the reader still reads 1', () => {
        expect(JS_SAVE_VERSION).toBe(2);
        expect(JS_SAVE_VERSIONS_READ).toEqual([1, 2]);
    });

    it('a version-2 save brings back the day clock: the reloaded run reads the saved `Main.time` plus a fresh boot\'s own offset, in the same day phase', () => {
        const a = vanillaPage();
        const offset = freshOffset();
        expect(offset).toBeGreaterThan(0);
        expect(a.run.gameTime).toBe(PAGE_BOOT_TIME + offset);   // a fresh page: midday (`Main.time`'s default)
        idle(a, 3000);
        const save = a.exportSave();
        expect(save.time).toBe(a.run.gameTime);
        expect(save.time).toBe(PAGE_BOOT_TIME + offset + 3000);
        expect(dayLightAlpha(save.time, true)).toBeLessThan(1);  // twilight: a darker screen than the fresh page's
        const b = vanillaPage();
        expect(b.run.gameTime).toBe(PAGE_BOOT_TIME + offset);
        expect(b.restoreSave(reloaded(save))).toEqual({ ok: true });
        expect(b.exportSave().time).toBe(save.time);              // pending: the save still holds the restored clock
        b.tick();                                                 // the restore's reboot in place
        // the wasm game's arithmetic: its explicit-start reset is a `new Game` that keeps `Main.time`
        expect(b.run.gameTime).toBe(save.time + offset);
        expect(b.run.gameTime - save.time).toBe(offset);
        // the same day phase (twilight), the screen as dark as when it was left, give or take the boot's own frames
        expect(dayLightAlpha(b.run.gameTime, true)).toBeLessThan(1);
        expect(Math.abs(dayLightAlpha(b.run.gameTime, true) - dayLightAlpha(save.time, true))).toBeLessThan(0.01);
        // and the progress is the save's, exactly
        expect(withoutAt(b.exportSave())).toEqual(withoutAt(save));
        // a second reload round-trips again (the clock ran on: what the next save holds)
        idle(b, 10);
        const save2 = b.exportSave();
        expect(save2.time).toBe(save.time + offset + 10);
        const c = vanillaPage();
        c.restoreSave(reloaded(save2));
        c.tick();
        expect(c.run.gameTime).toBe(save2.time + offset);
    });

    it('a version-1 save (no time) restores everything it has, with a fresh start\'s clock — never refused for lacking `time`', () => {
        const a = vanillaPage();
        a.queueItems([keyCall(0), keyCall(3), sealCall(0, 5), totemCall(2), flag('hasSword')]);
        a.tick();
        idle(a, 3000);
        const { time, ...rest } = a.exportSave();
        const v1 = reloaded({ ...rest, version: 1 });
        expect('time' in v1).toBe(false);
        const b = vanillaPage();
        expect(b.restoreSave(v1)).toEqual({ ok: true });
        expect(b.events.at(-1).message).toMatch(/the clock a fresh start's$/);
        expect(b.exportSave().time).toBe(null);                   // pending: a fresh start's clock
        b.tick();
        expect(b.run.gameTime).toBe(PAGE_BOOT_TIME + freshOffset());
        const after = b.exportSave();
        expect(after.version).toBe(2);
        expect(withoutAt(after)).toEqual(withoutAt({ ...v1, version: 2 }));
        expect([...b.run.keys].sort()).toEqual([0, 3]);
        // a null `time` (a version-2 save written with no counting clock) reads the same way
        const c = vanillaPage();
        expect(c.restoreSave(reloaded({ ...rest, time: null }))).toEqual({ ok: true });
        c.tick();
        expect(c.run.gameTime).toBe(PAGE_BOOT_TIME + freshOffset());
    });

    it('a version-2 save with a MALFORMED time restores everything else, with a fresh start\'s clock, said by name', () => {
        const a = vanillaPage();
        a.queueItems([keyCall(0), keyCall(3), totemCall(2), flag('hasSword')]);
        a.tick();
        idle(a, 3000);
        const good = reloaded(a.exportSave());
        for (const bad of [0, -5, 'x', Number.NaN]) {
            const b = vanillaPage();
            const save = { ...good, time: bad };
            expect(b.restoreSave(save)).toEqual({ ok: true });
            expect(b.events.at(-1).message).toContain(`the saved clock ${JSON.stringify(bad)} was not a positive number; the clock is a fresh start's`);
            expect(b.exportSave().time).toBe(null);
            b.tick();
            expect(b.run.gameTime).toBe(PAGE_BOOT_TIME + freshOffset());
            expect([...b.run.keys].sort()).toEqual([0, 3]);
            expect(withoutAt(b.exportSave())).toEqual(withoutAt(good));
            expect(b.exportSave().time).toBe(b.run.gameTime);      // the next write stores a valid clock
        }
    });

    it('with no restore the clock is untouched: every boot is a fresh page\'s (the save OFF is today\'s run)', () => {
        const a = vanillaPage();
        const b = vanillaPage();
        idle(a, 50);
        idle(b, 50);
        expect(a.run.gameTime).toBe(b.run.gameTime);
        expect(a.run.gameTime).toBe(PAGE_BOOT_TIME + freshOffset() + 50);
        // a teleport (a new Game) boots the default clock, as before this slice
        a.queueItems([teleport(START)]);
        a.tick();
        expect(a.run.gameTime).toBe(PAGE_BOOT_TIME + freshOffset());
    });

    it('the restored clock is staged ONCE: the boot after the restore\'s reboot is a default one again', () => {
        const a = vanillaPage();
        idle(a, 3000);
        const save = a.exportSave();
        const b = vanillaPage();
        b.restoreSave(reloaded(save));
        b.tick();
        expect(b.run.gameTime).toBe(save.time + freshOffset());
        b.queueItems([teleport(START)]);
        b.tick();
        expect(b.run.gameTime).toBe(PAGE_BOOT_TIME + freshOffset());
    });

    it('a NEW SET drops a restored clock no boot has staged', () => {
        const { rt, assembled } = generatedPage();
        const save = { ...rt.exportSave(), time: 9000 };
        expect(rt.restoreSave(save)).toEqual({ ok: true });
        expect(rt.exportSave().time).toBe(9000);
        const other = structuredClone(assembled.set);
        other.set_id = `${other.set_id}-other`;
        for (const c of planLevelSetChunks(other).chunks) rt.game.botLoadLevels(JSON.stringify(c));
        expect(rt.restorePending).toBe(false);
        expect(rt.exportSave().time).toBe(null);
    });
});

describe('⛓ sdc-js-save-day-clock — the host writes the clock on a flush (the page hiding, the binding disposed)', () => {
    const memoryStorage = (init = {}) => {
        const m = new Map(Object.entries(init));
        const sets = [];
        return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { sets.push(k); m.set(k, String(v)); }, map: m, sets };
    };
    const noTimers = { setTimeout: () => 1, clearTimeout: () => {} };

    it('a flush with nothing announced still writes the moved clock, and the next page of the room reads it back', () => {
        const storage = memoryStorage();
        const a = vanillaPage();
        const bound = bindJsSave({ runtime: a, roomKey: 'room A', storage, timers: noTimers });
        for (let i = 0; i < 3000; i += 1) a.tick();             // only the clock moves: no change is announced
        bound.flush();                                          // `pagehide`
        const stored = JSON.parse(storage.getItem(jsSaveKey('room A')));
        expect(stored.time).toBe(a.run.gameTime);
        expect(storage.sets.length).toBe(1);
        bound.flush();                                          // the clock has not moved since: nothing more
        expect(storage.sets.length).toBe(1);
        const b = vanillaPage();
        const offset = b.run.gameTime - PAGE_BOOT_TIME;
        expect(bindJsSave({ runtime: b, roomKey: 'room A', storage, timers: noTimers }).restored).toEqual({ ok: true });
        b.tick();
        expect(b.run.gameTime).toBe(stored.time + offset);
    });

    it('a REFUSED stored save is never overwritten by the clock alone (a flush, a dispose)', () => {
        const a = vanillaPage();
        for (let i = 0; i < 100; i += 1) a.tick();
        const text = JSON.stringify({ ...a.exportSave(), version: 99 });
        const storage = memoryStorage({ [jsSaveKey('room A')]: text });
        const b = vanillaPage();
        const bound = bindJsSave({ runtime: b, roomKey: 'room A', storage, timers: noTimers });
        expect(bound.restored.ok).toBe(false);
        for (let i = 0; i < 100; i += 1) b.tick();
        bound.dispose();
        expect(storage.getItem(jsSaveKey('room A'))).toBe(text);
        expect(storage.sets).toEqual([]);
    });
});
