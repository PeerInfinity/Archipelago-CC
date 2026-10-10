/**
 * seedlingWasmPlayback ⛓ MID-ROOM REPLAN — the engine's DELIVERY GATE (⚖ the user, 2026-10-03: an item that
 * arrives mid-room, from another player too, is replanned IN the room; never by leaving and re-entering it).
 *
 * The game is a FAKE over W1's recorded house arrival (`seedlingDemo/fixtures/wasm-arrival-p4f.json`) that
 * drains a plan a few rows per read and honours `botHold` (a frozen tape drains nothing); the adapter is a
 * fake delivery handle (`{setItemGate, writesOf, inventory, push}`) whose `push()` writes what the gate
 * returns. The SOLVE is real (the in-place service over the vanilla map). The live witness is
 * `scripts/procgen/probe-seedling-wasm-midroom-replan.mjs`.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *
 *   m1 the gate off (`gateFilter` returns the live inventory: the item written mid-tape)
 *        -> 'a delivery while a plan PLAYS: …' reds (the item reaches the game before any freeze)
 *   m2 the replan without the item staged (`room.staging` left as the arrival read it)
 *        -> 'a delivery while a plan PLAYS: …' and 'a delivery into the HELD room …' red
 *   m3 the hold never released (a refused delivery leaves `botHold("on")` standing)
 *        -> 'a delivery the model cannot take …' reds (the plan never drains on)
 *   ⛓ SLOTS CONSUMER (measured, restored md5-identical):
 *   s1 the slot-lag check off (`ship()` never asks `firstTickSlotRefusal`) -> 'the SLOT LAG …' reds (1)
 *   s2 the delivery re-stage without the game's array (`stageItems` with no `slots`) -> 'two slot items …' reds (1)
 *   s3 the arrival stages no slot array -> 13 red over this file + `wasmArrival.test.js`
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWasmPlayback } from './seedlingWasmPlayback.js';
import { indexLevels } from '../seedlingDemo/atlasSource.js';
import { createInPlaceProduceService } from '../seedlingDemo/wasmWalkTape.js';
import { appendInventorySlots } from '../seedlingDemo/tapeFormat.js';
import { createRunForStaging } from '../seedlingDemo/tapeRunner.js';
import { SHIPPED_RNG } from '../seedlingDemo/wasmPlayback.js';
import { atlasLevelSource } from '../seedlingDemo/levelSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const RECORDED = readJson('frontend/modules/seedlingDemo/fixtures/wasm-arrival-p4f.json').arrivals;
const RECORDS = indexLevels(readJson('frontend/modules/flashPanel/atlases/seedling-map.json'));
const HOUSE = 86;
const A = RECORDED.find((a) => a.label.startsWith('A ') && a.status.level === HOUSE);
const CHEST = { kind: 'location', level: HOUSE, tag: 0, entityType: 'chest', name: 'Starting House - Chest' };
const DOOR = { kind: 'exit', level: HOUSE, tiles: [[3, 4]], name: 'exit_S' };

/** The panel's inventory → write mapping, cut down to the items these rows deliver (a key writes nothing). */
const WRITES = { 'Progressive Sword': 'hasSword', 'Progressive Shield': 'hasShield', Fire: 'hasFire', 'Ghost Spear': 'hasSpear',
    'Ghost Sword': 'hasGhostSword' };
const writesOf = (counts) => Object.entries(counts).filter(([n, c]) => c > 0 && WRITES[n]).map(([n]) => ({ property: WRITES[n], value: true }));
/** ⛓ KEY DELIVERY — and the keys as the shipped config writes them: `Main.hasKeySet(i, true)`, declaring `save.keys`. */
const KEY_INDEX = { 'Red Key': 0, 'Green Key': 1 };
const keyWritesOf = (counts) => [...writesOf(counts), ...Object.entries(counts).filter(([n, c]) => c > 0 && n in KEY_INDEX)
    .map(([n]) => ({ invocation: 'method_call', path: [{ class: 'Main' }], method: 'hasKeySet', args: [KEY_INDEX[n], true],
        observed: { property: 'keyMask', bit: KEY_INDEX[n] }, save_array: 'keys', index: KEY_INDEX[n] }))];
const boolKeys = (idx) => Array.from({ length: 5 }, (_, i) => (idx ?? []).includes(i));

function manualTimers() {
    let q = [];
    let id = 0;
    return {
        setTimeout(fn, ms) { q.push({ id: ++id, fn, ms }); return id; },
        clearTimeout(h) { q = q.filter((t) => t.id !== h); },
        run(max = 5000) {
            let n = 0;
            while (q.length && n < max) { const t = q.shift(); t.fn(); n += 1; }
            return n;
        },
    };
}

/** A game over the recorded house arrival whose plan tapes drain `chunk` rows per read and stop while frozen. */
function fakeGame({ chunk = 4, items = {}, slots = [], status = {}, keys = [], clearAt = null } = {}) {
    const baseline = { ...A.seam.beginEntry, 'save.time': A.seam.beginEntry['save.time'] - 100, 'rng.gameplay': 1 };
    const g = {
        be: baseline, held: false, armed: false, finished: false, frozen: false, tape: null, rows: null, drained: 0, tick: 0,
        pos: null, seq: 0, calls: [], tapes: [], cleared: false,
        items: { ...A.status.items, ...items }, slots: [...slots], keys: boolKeys(keys),
        land() { g.be = A.seam.beginEntry; },
        botSeam() { return JSON.stringify({ beginEntry: g.be, latched: false }); },
        botStatus() {
            const keys = g.armed && g.tape && g.tick >= 1 ? heldAt(g.tape, g.tick - 1) : [];
            return JSON.stringify({ ...A.status, ...status, game_time: g.be['save.time'], items: { ...g.items }, inventory_slots: [...g.slots],
                save: { ...A.status.save, keys: [...g.keys] },
                // ⛓ SERVED LOCATION — the chest's own check: its flag clears once `clearAt` rows have drained (and stays)
                ...(g.cleared || (clearAt !== null && g.armed && g.drained >= clearAt) ? (g.cleared = true, { persistence_cleared: [{ level: HOUSE, tag: 0 }] }) : {}),
                ...(g.pos ? { level: g.pos.level, x: g.pos.x, y: g.pos.y } : {}),
                input: { ...A.status.input, held: keys, t: g.tick - 1 },
                held: g.held, armed: g.armed, finished: g.finished, frozen: g.frozen, tick: g.tick, error: '' });
        },
        readState() { return JSON.stringify({ freezeObjects: false, ...A.state, ...g.items, pendingCheck: g.seq ? `${g.seq}|86|0|0` : '' }); },
        botLevelSet() { return JSON.stringify({ start_level: 0 }); },
        botMobiles() { return undefined; },
        botHold(arg) { g.calls.push(`botHold:${arg}`); g.frozen = arg === 'on'; return 'ok'; },
        botLoadTape(json) { g.calls.push('botLoadTape'); g.tape = JSON.parse(json); g.tapes.push(g.tape); g.armed = false; return 'ok'; },
        botStart() {
            g.calls.push('botStart');
            g.seq += g.tape.persistence.length;
            // `Bot.as`'s R5 save-array block: every host tape boot RESETS the keys to the tape's declaration.
            if (g.tape.save) g.keys = boolKeys(g.tape.save.keys);
            g.held = false;
            g.frozen = false;
            g.tick = 0;
            g.drained = 0;
            if (g.tape.tick_count === 0) { g.armed = false; g.finished = true; g.held = !!g.tape.hold; } else { g.armed = true; g.finished = false; }
            // A continuation behind a LEAD tick is one tick longer than its solve's rows: its first row is where the player stands.
            if (g.rows && g.pos && g.tape.tick_count === g.rows.length) g.rows = [{ ...g.pos, t: 0 }, ...g.rows.map((r, t) => ({ ...r, t: t + 1 }))];
            return 'ok';
        },
        botReset() { g.calls.push('botReset'); g.held = false; g.armed = false; g.frozen = false; g.be = baseline; g.pos = null; return 'ok'; },
        botDrain() {
            if (!g.armed || g.frozen || !g.rows) return JSON.stringify({ ticks: [] });
            const ticks = g.rows.slice(g.drained, g.drained + chunk);
            g.drained += ticks.length;
            g.tick = Math.min(g.drained, g.tape.tick_count);
            // After k rows (0..k-1) the player stands where row k says (the game's measured semantics).
            if (ticks.length) g.pos = g.rows[Math.min(g.drained, g.rows.length - 1)];
            if (g.drained >= g.rows.length) { g.armed = false; g.finished = true; g.held = !!g.tape.hold; }
            return JSON.stringify({ ticks, transitions: [] });
        },
    };
    return g;
}

/** The keys a game-visible tape holds at tick `t` (its spans `[from, to)`). */
function heldAt(tape, t) {
    const out = new Set();
    for (const i of tape.inputs ?? []) if (i.from <= t && t < i.to) out.add(i.key);
    return [...out];
}

/** A fake panel adapter: the live AP inventory, the gate the engine installs, and the writes a push makes. */
function fakeDelivery(game, live = {}, { keys = false, writeKeys = true } = {}) {
    const wo = keys ? keyWritesOf : writesOf;
    const d = {
        live: { ...live }, gate: null, gateCalls: 0, pushes: 0,
        setItemGate(fn) { d.gate = typeof fn === 'function' ? fn : null; },
        writesOf: wo,
        inventory() { return { ...d.live }; },
        /** One adapter push: the gate's answer is what the game receives. */
        push() {
            d.pushes += 1;
            const inv = d.gate ? (d.gateCalls += 1, d.gate({ ...d.live })) : d.live;
            for (const w of wo(inv)) {
                if (w.method === 'hasKeySet') { if (writeKeys) game.keys[w.args[0]] = true; } else game.items[w.property] = w.value;
            }
            // the frame's tail (`addItemsFromSave`): a slot item is APPENDED to the game's array
            game.slots = appendInventorySlots(game.slots, game.items).slots;
        },
        receive(name) { d.live[name] = (d.live[name] ?? 0) + 1; },
    };
    return d;
}

function setup({ game: gopts = {}, live = {}, decline = false, editPlan = null, keys = false, writeKeys = true } = {}) {
    const game = fakeGame(gopts);
    const timers = manualTimers();
    const delivery = fakeDelivery(game, live, { keys, writeKeys });
    const inner = createInPlaceProduceService();
    const seen = [];
    const service = {
        start(request) {
            const h = inner.start(request);
            if (decline && seen.length > 0) h.result = { ok: false, kind: 'refusal', message: 'declined (the test)' };
            if (editPlan && h.result.ok) h.result = { ...h.result, plan: editPlan(h.result.plan, seen.length) };
            seen.push({ request, result: h.result });
            if (h.result.ok) game.rows = h.result.plan.expected.map((r, t) => ({ t, level: r.level, x: r.x, y: r.y }));
            return { ...h, startedAt: 0 };
        },
        warm() {}, dispose() {},
    };
    const failures = [];
    const dones = [];
    let t = 0;
    const engine = createWasmPlayback({
        getGame: () => game, teleport: () => { game.land(); return true; }, records: RECORDS, solveService: service, timers,
        now: () => (t += 1), getDelivery: () => delivery, onFailed: (r) => failures.push(r), onDone: (x) => dones.push(x),
    });
    const runUntil = (pred, max = 4000) => { for (let i = 0; i < max && !pred(); i++) timers.run(1); };
    return { engine, game, timers, delivery, seen, failures, dones, runUntil };
}

describe('⛓ MID-ROOM REPLAN — the delivery gate', () => {
    it('a delivery while a plan PLAYS: held back, the room FROZEN, the item written, re-staged at the arrival, replanned from the frozen tick behind a lead tick', () => {
        const e = setup({ live: { 'Red Key': 1 } });
        expect(e.engine.walkTo(CHEST).ok).toBe(true);
        expect(e.delivery.gate).toBeTypeOf('function');
        // (the chest plan holds `up` over ticks 26..30: the freeze's own drain lands it inside that span)
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.drained >= 24);
        expect(e.engine.status().phase).toBe('playing');
        // Another player's sword arrives; the adapter pushes: the GATE holds it back.
        e.delivery.receive('Progressive Sword');
        e.delivery.push();
        expect(e.game.items.hasSword).toBe(false);
        expect(e.engine.status().gate).toEqual({ pending: true, deferred: null });
        e.runUntil(() => e.engine.stats.deliveries.length > 0);
        const k = e.engine.stats.deliveries[0].tick;
        expect(k).toBeGreaterThanOrEqual(24);
        e.timers.run();
        expect(e.failures).toEqual([]);
        // Frozen, then written, then ONE new tape over the frozen one: no reset in between.
        const tail = e.game.calls.slice(e.game.calls.indexOf('botHold:on'));
        expect(tail.slice(0, 3)).toEqual(['botHold:on', 'botLoadTape', 'botStart']);
        expect(e.game.items.hasSword).toBe(true);
        const row = e.engine.stats.deliveries[0];
        expect(row).toMatchObject({ phase: 'playing', outcome: 'replanned', items: [{ property: 'hasSword', from: false, to: true }] });
        expect(Number.isFinite(row.freezeMs) && Number.isFinite(row.landMs)).toBe(true);
        // The continuation: the arrival WITH the sword staged, the frozen prefix (+ the lead tick) as S0's prefix.
        const cont = e.seen[1].request;
        expect(cont.staging.seam.items.hasSword).toBe(true);
        expect(cont.perTick).toHaveLength(k + row.lead.length);
        expect(row.heldKeys).toEqual(['up']);
        expect(row.lead).toEqual([['up']]);
        const tape = e.game.tapes.at(-1);
        for (const key of row.heldKeys) expect(heldAt(tape, 0)).toContain(key);
        expect(e.engine.stats.heldChecks.at(-1)).toMatchObject({ frozen: true, equal: true, shipped: k });
        expect(e.dones.map((d) => [d.goal.name, d.continuation, d.prefix])).toEqual([[CHEST.name, true, k]]);
        expect(e.engine.stats.forcedBy).toEqual({ 'cold-start': 1 });
        expect(e.engine.stats.history.map((h) => h.outcome)).toEqual(['interrupted', 'done']);
    });

    it('a delivery the game cannot SEE (a Seal: no write) is admitted at once: no freeze', () => {
        const e = setup();
        e.engine.walkTo(CHEST);
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.drained >= 12);
        e.delivery.receive('Seal');
        e.delivery.push();
        expect(e.engine.status().gate).toEqual({ pending: false, deferred: null });
        e.timers.run();
        expect(e.game.calls.filter((c) => c.startsWith('botHold'))).toEqual([]);
        expect(e.engine.stats.deliveries).toEqual([]);
        expect(e.dones).toHaveLength(1);
    });

    it('⛓ SLOTS CONSUMER — a LATE slot (Fire held [1], the sword delivered mid-plan): replanned in the game\'s order, the re-stage carries its array', () => {
        // The game's slots become [1, 0]; the model, staged over [1], appends the sword as the game does (was: deferred, `slot-order`).
        const e = setup({ game: { items: { hasFire: true }, slots: [1] }, live: { Fire: 1 } });
        e.engine.walkTo(CHEST);
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.drained >= 24);
        expect(e.seen[0].request.staging.inventory_slots).toEqual([1]);
        e.delivery.receive('Progressive Sword');
        e.delivery.push();
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.engine.stats.deliveryDeferred).toEqual([]);
        expect(e.engine.stats.deliveries[0]).toMatchObject({ phase: 'playing', outcome: 'replanned' });
        expect(e.game.slots).toEqual([1, 0]);
        const cont = e.seen[1].request;
        expect(cont.staging.inventory_slots).toEqual([1]);
        expect(createRunForStaging(cont.staging, atlasLevelSource()).inventorySlots).toEqual([1, 0]);
        expect(e.dones.map((d) => [d.goal.name, d.continuation])).toEqual([[CHEST.name, true]]);
    });

    it('a delivery the model cannot take mid-run (a fusion moves the selected slot) waits out the room: the tape resumes, named', () => {
        // The sword and the spear held ([0, 3], primary 1); the ghost sword fuses them: [4], primary 1 % 1 = 0. The model,
        // re-staged over [0, 3], fuses at construction, so its FIRST row's primary is not the game's: `build` names it.
        const e = setup({ game: { items: { hasSword: true, hasSpear: true }, slots: [0, 3], status: { primary: 1 } },
            live: { 'Progressive Sword': 1, 'Ghost Spear': 1 } });
        e.engine.walkTo(CHEST);
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.drained >= 16);
        e.delivery.receive('Ghost Sword');
        e.delivery.push();
        e.runUntil(() => e.engine.stats.deliveryDeferred.length > 0);
        expect(e.engine.stats.deliveryDeferred[0]).toMatchObject({ clause: 'build', at: 'playing' });
        expect(e.game.calls.slice(-2)).toEqual(['botHold:on', 'botHold:off']);
        expect(e.game.frozen).toBe(false);
        e.timers.run(3000);
        expect(e.failures).toEqual([]);
        expect(e.dones.map((d) => [d.goal.name, d.continuation])).toEqual([[CHEST.name, false]]); // the SAME tape, finished
        expect(e.game.items.hasGhostSword).toBe(false); // still held back: the room is the same
        expect(e.engine.status().gate).toMatchObject({ pending: true, deferred: { clause: 'build' } });
        e.engine.stop();
        expect(e.delivery.gate).toBeNull();
        e.delivery.push();
        expect(e.game.items.hasGhostSword).toBe(true); // outside bot driving: as before
    });

    it('a delivery into the HELD room (between goals) lands at once and the next goal is solved from it', () => {
        const e = setup();
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.engine.status().phase).toBe('held');
        e.delivery.receive('Progressive Shield');
        e.delivery.push();
        e.timers.run(200);
        expect(e.game.items.hasShield).toBe(true);
        expect(e.engine.stats.deliveries[0]).toMatchObject({ phase: 'held', outcome: 'staged' });
        expect(e.game.calls.filter((c) => c.startsWith('botHold'))).toEqual([]);
        e.engine.walkTo(DOOR);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.seen.at(-1).request.staging.seam.items.hasShield).toBe(true);
        expect(e.dones.map((d) => [d.goal.name, d.continuation])).toEqual([[CHEST.name, false], [DOOR.name, true]]);
    });

    it('the SLOT LAG: Fire delivered into the held room fills slot 0 one frame late — a continuation pressing X there first falls back, named', () => {
        // Nothing held: [] with primary 0 (past the end: reads 0, the sword's id); Fire makes it [1] (slot 0 = Fire).
        // ⛓ SLOTS CONSUMER: re-staged from the lag at primary 0 on an EMPTY array — the chest plan presses nothing
        // without a weapon, so staging Fire moves no prefix tick (the spear over [0] at primary 1 now changed the
        // prefix's dash presses: getItem's out-of-range index reads the sword, the staged spear's slot does not).
        const e = setup({ game: { items: {}, slots: [], status: { primary: 0 } },
            editPlan: (plan, n) => (n === 1 ? { ...plan, solution: [new Set(['primary', ...plan.solution[0]]), ...plan.solution.slice(1)] } : plan) });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.engine.status().phase).toBe('held');
        expect(e.seen[0].result.plan.solution.some((h) => h.has('primary'))).toBe(false);
        e.delivery.receive('Fire');
        e.delivery.push();
        e.timers.run(200);
        expect(e.engine.stats.deliveries[0]).toMatchObject({ phase: 'held', outcome: 'staged' });
        e.engine.walkTo(DOOR);
        e.timers.run(3000);
        expect(e.engine.stats.fallbacks.map((f) => f.kind)).toContain('delivery-first-tick');
        expect(e.engine.stats.fallbacks.find((f) => f.kind === 'delivery-first-tick').why).toMatch(/presses primary on its first tick.*\(0 → 1\)/);
    });

    it('⛓ SLOTS CONSUMER — two slot items into the held room (Fire, then the sword): each re-stage carries the game\'s array as it stood, so the model holds [1, 0]', () => {
        const e = setup();
        e.engine.walkTo(CHEST);
        e.timers.run();
        e.delivery.receive('Fire');
        e.delivery.push();
        e.timers.run(200);
        e.delivery.receive('Progressive Sword');
        e.delivery.push();
        e.timers.run(200);
        expect(e.engine.stats.deliveries.map((d) => d.outcome)).toEqual(['staged', 'staged']);
        expect(e.game.slots).toEqual([1, 0]);
        e.engine.walkTo(DOOR);
        e.timers.run();
        expect(e.failures).toEqual([]);
        const staging = e.seen.at(-1).request.staging;
        expect(staging.inventory_slots).toEqual([1]);
        expect(createRunForStaging(staging, atlasLevelSource()).inventorySlots).toEqual([1, 0]);
    });

    it('a replan the solver DECLINES while frozen: the interrupted plan RESUMES (the item changes none of its ticks) — no re-entry', () => {
        const e = setup({ decline: true });
        e.engine.walkTo(CHEST);
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.drained >= 20);
        e.delivery.receive('Progressive Shield');
        e.delivery.push();
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.engine.stats.deliveries[0]).toMatchObject({ outcome: 'resumed' });
        expect(e.engine.stats.deliveries[0].why).toMatch(/declined/);
        expect(e.game.calls.filter((c) => c === 'botHold:off')).toHaveLength(1);
        expect(e.game.calls.filter((c) => c === 'botLoadTape')).toHaveLength(2); // the freeze + the plan: nothing re-shipped
        expect(e.dones.map((d) => [d.goal.name, d.continuation])).toEqual([[CHEST.name, false]]);
        expect(e.engine.stats.forcedBy).toEqual({ 'cold-start': 1 });
        expect(e.game.items.hasShield).toBe(true);
    });

    it('an engine without the gate handle (W4/W5\'s own engines) installs nothing and plays as before', () => {
        const game = fakeGame();
        const timers = manualTimers();
        const inner = createInPlaceProduceService();
        const engine = createWasmPlayback({
            getGame: () => game, teleport: () => { game.land(); return true; }, records: RECORDS, timers,
            solveService: { start(r) { const h = inner.start(r); if (h.result.ok) game.rows = h.result.plan.expected.map((x, t) => ({ t, ...x })); return { ...h, startedAt: 0 }; }, warm() {}, dispose() {} },
        });
        engine.walkTo(CHEST);
        timers.run();
        expect(engine.status().gate).toBeNull();
        expect(engine.stats.done).toBe(1);
    });
});

/**
 * ⛓ WASM EQUIPS — the engine ships a plan's slot selections (`plan.equipsAt`) as the tape's `equips`, indexes them
 * by the room's shipped ticks for every later shadow, and shifts them by a frozen continuation's LEAD tick. The
 * plans here carry an injected selection of the sword's own slot (a no-op on the model: the house arrival's real
 * plans select nothing); the real BURN plan's two selections are `seedlingDemo/wasmEquips.test.js`.
 *
 *   e1 equips dropped (`shippedTape` without `equips`)              -> 'the plan tape carries …' reds
 *   e2 a continuation's room equips unshifted (offset 0, not the room's shipped ticks) -> '… the room's ticks' reds
 *   e3 the lead tick not counted (`equipsAt` not shifted in `ship`)  -> '… behind the LEAD tick' reds
 */
describe('⛓ WASM EQUIPS — the engine ships the solver\'s slot selections', () => {
    const SWORD = { hasSword: true };
    const withEquip = (plan, t) => ({ ...plan, equipsAt: new Map([[t, 0]]), equipItems: new Map([[t, { ...SWORD }]]) });
    const sword = { game: { items: SWORD, slots: [0] }, live: { 'Progressive Sword': 1 } };

    it('the plan tape carries the plan\'s `equips`; the next goal\'s continuation replays them at the room\'s ticks, and its own land after them', () => {
        const e = setup({ ...sword, editPlan: (plan, n) => withEquip(plan, n === 0 ? 5 : 2) });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.failures).toEqual([]);
        const chestTape = e.game.tapes.find((t) => t.tick_count > 0);
        expect(chestTape.equips).toEqual([{ t: 5, slot: 0 }]);
        const chestTicks = chestTape.tick_count;
        e.engine.walkTo(DOOR);
        e.runUntil(() => e.engine.status().phase === 'playing');
        const cont = e.seen[1].request;
        expect(cont.perTick).toHaveLength(chestTicks);
        expect([...cont.equips]).toEqual([[5, 0]]);
        expect(e.game.tapes.at(-1).equips).toEqual([{ t: 2, slot: 0 }]);
        // While the door plays, the room's selections are indexed by its shipped ticks (the chest's, then the door's).
        expect(e.engine.room.equips).toEqual([{ t: 5, slot: 0 }, { t: chestTicks + 2, slot: 0 }]);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.dones.map((d) => [d.goal.name, d.continuation])).toEqual([[CHEST.name, false], [DOOR.name, true]]);
    });

    it('a delivery-frozen continuation: the re-solve\'s equips ship behind the LEAD tick (t + 1) and index the room after the frozen prefix', () => {
        // The first test's freeze (the chest plan holds `up` over 26..30); the delivered sword makes slot 0 selectable.
        const e = setup({ live: { 'Red Key': 1 }, editPlan: (plan, n) => (n === 1 ? withEquip(plan, 3) : plan) });
        e.engine.walkTo(CHEST);
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.drained >= 24);
        e.delivery.receive('Progressive Sword');
        e.delivery.push();
        e.timers.run();
        expect(e.failures).toEqual([]);
        const row = e.engine.stats.deliveries[0];
        expect(row).toMatchObject({ outcome: 'replanned', lead: [['up']] });
        expect(e.seen[1].request.equips).toBeNull();
        expect(e.game.tapes.at(-1).equips).toEqual([{ t: 4, slot: 0 }]);
        expect(e.engine.room.equips).toEqual([{ t: row.tick + 4, slot: 0 }]);
    });

    it('⛓ SLOTS CONSUMER — Fire first (the game\'s [1, 0]): the arrival stages the array and the plan\'s selection of the sword\'s slot 1 SHIPS (was refused, `slotOrderRefusal`)', () => {
        const kit = { hasSword: true, hasFire: true };
        const e = setup({ game: { items: kit, slots: [1, 0] },
            editPlan: (plan) => ({ ...plan, equipsAt: new Map([[5, 1]]), equipItems: new Map([[5, kit]]) }) });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.seen[0].request.staging.inventory_slots).toEqual([1, 0]);
        expect(e.game.tapes.find((t) => t.tick_count > 0).equips).toEqual([{ t: 5, slot: 1 }]);
        expect(e.dones).toHaveLength(1);
    });

    it('an UNOWNED slot (past the end of the game\'s array) is refused BY NAME before the plan ships', () => {
        const kit = { hasSword: true, hasFire: true };
        const e = setup({ game: { items: kit, slots: [1, 0] },
            editPlan: (plan) => ({ ...plan, equipsAt: new Map([[5, 2]]), equipItems: new Map([[5, kit]]) }) });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.failures).toHaveLength(1);
        expect(JSON.stringify(e.failures[0])).toMatch(/the plan tape was not shipped — the plan selects slot 2 at tick 5, and the game will hold 2 slot\(s\) \[1,0\] — an UNOWNED slot/);
        expect(e.game.tapes.filter((t) => t.tick_count > 0)).toEqual([]);
    });
});

describe('⛓ KEY DELIVERY — an AP key reaches the game: the gate, the staging, the tape declaration', () => {
    it('a KEY while a plan PLAYS: held back, the room FROZEN, `save.keys` lands, re-staged at the arrival, replanned', () => {
        const e = setup({ keys: true });
        e.engine.walkTo(CHEST);
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.drained >= 24);
        e.delivery.receive('Red Key');
        e.delivery.push();
        expect(e.game.keys[0]).toBe(false);                                 // a key is a delivery the game SEES now
        expect(e.engine.status().gate).toEqual({ pending: true, deferred: null });
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.game.keys[0]).toBe(true);
        const row = e.engine.stats.deliveries[0];
        expect(row).toMatchObject({ phase: 'playing', outcome: 'replanned', items: [], save: [{ array: 'keys', index: 0 }] });
        expect(e.seen[1].request.staging.save.keys).toEqual([0]);           // the continuation's arrival holds it
        expect(e.game.tapes.at(-1).save.keys).toEqual([0]);                 // and the shipped tape declares it
        expect(e.dones.map((d) => [d.goal.name, d.continuation])).toEqual([[CHEST.name, true]]);
    });

    it('⛓ SERVED LOCATION — the goal\'s OWN key delivered AT contact (its flag already cleared): no freeze, no re-solve; the tape ends, the goal is DONE, the key lands in the held room', () => {
        const e = setup({ keys: true, game: { clearAt: 20 } });
        e.engine.walkTo(CHEST);
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.drained >= 24);
        e.delivery.receive('Red Key');
        e.delivery.push();
        expect(e.game.keys[0]).toBe(false);                                 // still held back while the tape plays
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.game.calls.filter((c) => c.startsWith('botHold'))).toEqual([]);
        expect(e.seen).toHaveLength(1);                                     // the goal was never solved again
        expect(e.engine.stats.deliveryServed).toEqual([{ level: HOUSE, goal: CHEST.name, tick: expect.any(Number) }]);
        expect(e.dones.map((d) => [d.goal.name, d.continuation])).toEqual([[CHEST.name, false]]);
        expect(e.engine.stats.history.map((h) => h.outcome)).toEqual(['done']);
        expect(e.engine.stats.forcedBy).toEqual({ 'cold-start': 1 });
        expect(e.engine.status().phase).toBe('held');
        expect(e.game.keys[0]).toBe(true);
        expect(e.engine.stats.deliveries).toEqual([expect.objectContaining({ phase: 'held', outcome: 'staged', save: [{ array: 'keys', index: 0 }] })]);
        e.engine.walkTo(DOOR);                                              // the next goal is solved from the room holding it
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.seen.at(-1).request.staging.save.keys).toEqual([0]);
    });

    it('⛓ SERVED LOCATION — a DIFFERENT item delivered mid-room BEFORE the contact: the existing replan (§ mid-room), the guard does not fire', () => {
        const e = setup({ keys: true, game: { clearAt: 40 } });
        e.engine.walkTo(CHEST);
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.drained >= 24);
        expect(e.game.cleared).toBe(false);
        e.delivery.receive('Progressive Sword');
        e.delivery.push();
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.engine.stats.deliveryServed).toEqual([]);
        expect(e.engine.stats.deliveries[0]).toMatchObject({ phase: 'playing', outcome: 'replanned' });
        expect(e.seen).toHaveLength(2);
        expect(e.dones.map((d) => [d.goal.name, d.continuation])).toEqual([[CHEST.name, true]]);
    });

    it('a KEY that never shows in `botStatus.save.keys` fails BY NAME after DELIVERY_LAND_MS (it is never taken as landed)', () => {
        const e = setup({ keys: true, writeKeys: false });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.engine.status().phase).toBe('held');
        e.delivery.receive('Red Key');
        e.delivery.push();
        e.timers.run(5000);
        expect(e.engine.stats.deliveries[0]).toMatchObject({ phase: 'held', outcome: 'unlanded' });
        expect(e.failures.join(' ')).toMatch(/did not show in the game within 3 s \(save\.keys\[0\]\)/);
    });

    it('a KEY into the HELD room lands at once; the next goal is solved from a staging that holds it', () => {
        const e = setup({ keys: true });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.engine.status().phase).toBe('held');
        e.delivery.receive('Green Key');
        e.delivery.push();
        e.timers.run(200);
        expect(e.game.keys[1]).toBe(true);
        expect(e.engine.stats.deliveries[0]).toMatchObject({ phase: 'held', outcome: 'staged', save: [{ array: 'keys', index: 1 }] });
        e.engine.walkTo(DOOR);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.seen.at(-1).request.staging.save.keys).toEqual([1]);
    });

    it('an AP key the GAME does not hold at the arrival (the adapter has not written it): the arrival staging carries it, its tape hands it over', () => {
        const e = setup({ keys: true, writeKeys: false, live: { 'Red Key': 1 } });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.seen[0].request.staging.save.keys).toEqual([0]);
        expect(e.game.tapes[0].save.keys).toEqual([0]);                     // the freeze tape: the host channel
        expect(e.game.keys[0]).toBe(true);
        expect(e.dones).toHaveLength(1);
    });

    it('⚖ MERGE: a key the GAME holds and AP does not (picked up in play) is kept on every tape; the AP key joins it', () => {
        const e = setup({ keys: true, writeKeys: false, game: { keys: [3] }, live: { 'Red Key': 1 } });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.seen[0].request.staging.save.keys).toEqual([0, 3]);
        expect(e.game.tapes.map((t) => t.save.keys)).toEqual(e.game.tapes.map(() => [0, 3]));
        expect(e.game.keys).toEqual(boolKeys([0, 3]));
    });

    it('a CONTINUATION re-declares the AP key: lost from the game between plans (a reset), the continuation tape restores it', () => {
        const e = setup({ keys: true, writeKeys: false, live: { 'Red Key': 1 } });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.engine.status().phase).toBe('held');
        e.game.keys = boolKeys([]);                                          // the game lost it (nothing re-wrote it yet)
        e.engine.walkTo(DOOR);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.dones.map((d) => [d.goal.name, d.continuation])).toEqual([[CHEST.name, false], [DOOR.name, true]]);
        expect(e.seen.at(-1).request.staging.save.keys).toEqual([0]);
        expect(e.game.tapes.at(-1).save.keys).toEqual([0]);
        expect(e.game.keys[0]).toBe(true);
    });
});

/** ⛓ RNG-SPLIT STAGING — the delivery gate's re-stages keep the SHIPPED split (the recorded reads echo false). */
describe('⛓ RNG-SPLIT STAGING — the mid-room replan and the held-room delivery re-stage carry SHIPPED_RNG\'s split, never the echo', () => {
    // ⛓ FP REQUEST — everything but the seed, so an `fp` key on ANY path reds the row: fp is FlashPunk's LCG —
    // waterfall particles only — not solver input, and it is never staged (the begin record keeps it).
    const rngOf = (staging) => { const { seed: _seed, ...rest } = staging.rng; return rest; };
    const WANT = { split: SHIPPED_RNG.split, cosmetic: SHIPPED_RNG.cosmetic };
    it('the MID-ROOM replan (a delivery while a plan plays): the re-staged continuation', () => {
        expect(A.status.rng.split).toBe(false);
        const e = setup();
        e.engine.walkTo(CHEST);
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.drained >= 24);
        e.delivery.receive('Progressive Sword');
        e.delivery.push();
        e.runUntil(() => e.engine.stats.deliveries.length > 0);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.engine.stats.deliveries[0].outcome).toBe('replanned');
        expect(e.seen[1].request.staging.seam.items.hasSword).toBe(true);
        expect(rngOf(e.seen[1].request.staging)).toEqual(WANT);
    });
    it('the DELIVERY-GATE re-stage into the held room: the next goal\'s staging', () => {
        const e = setup();
        e.engine.walkTo(CHEST);
        e.timers.run();
        e.delivery.receive('Progressive Shield');
        e.delivery.push();
        e.timers.run(200);
        expect(e.engine.stats.deliveries[0]).toMatchObject({ phase: 'held', outcome: 'staged' });
        e.engine.walkTo(DOOR);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.seen.at(-1).request.staging.seam.items.hasShield).toBe(true);
        expect(rngOf(e.seen.at(-1).request.staging)).toEqual(WANT);
    });
});

/**
 * ⛓ ENCOUNTERS-2 — the ROOM grants an item mid-room (an encounter's drop: the Fire at L32, the dark sword at L12),
 * its check fires, and AP's copy of the same item comes back through the gate. The fake room grants it by setting
 * the game's flag itself (no write), as `BobBoss` / the Witch do.
 *
 *   e1 `alreadyInGame` off (the delivery the game already shows goes on to freeze + replan)
 *        -> 'the room\'s OWN drop …' reds (a freeze, an interrupted leg, a continuation)
 *   e2 the re-stage of the game's WHOLE readout (`stageItems(…, landed.items, …)`, the pre-fix spelling)
 *        -> 'a DIFFERENT item after the room\'s grant …' reds (the grant staged at the arrival)
 *   e3 no end-of-tape guard in `freezeAndDeliver` (`botHold("on")` → `botHold("off")` on a finished tape)
 *        -> 'a delivery after the tape ENDED …' reds (the hold the plan ends on is released; the goal never finishes)
 *   e4 the goal finished at its last DRAINED tick (the `finished` read skipped)
 *        -> 'the leg ends at the game\'s `finished` …' reds (the disarm frame's flag is not yet in the game)
 */
describe('⛓ ENCOUNTERS-2 — the room\'s own grant and the delivery gate', () => {
    it('the room\'s OWN drop (the game set hasFire itself; AP\'s Fire came back): admitted at once — no freeze, no replan, nothing re-staged', () => {
        const e = setup();
        e.engine.walkTo(CHEST);
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.drained >= 12);
        // the room grants the drop: the game's flag and its slot, no host write
        e.game.items.hasFire = true;
        e.game.slots = appendInventorySlots(e.game.slots, e.game.items).slots;
        // the check fired; AP's Fire arrives and the adapter pushes: the gate sees a write and holds it
        e.delivery.receive('Fire');
        e.delivery.push();
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.game.calls.filter((c) => c.startsWith('botHold'))).toEqual([]);
        expect(e.engine.stats.deliveryInGame).toBe(1);
        expect(e.engine.stats.deliveries).toEqual([]);
        expect(e.engine.stats.deliveryDeferred).toEqual([]);
        expect(e.engine.status().gate).toEqual({ pending: false, deferred: null });
        expect(e.seen).toHaveLength(1);
        expect(e.engine.stats.history.map((h) => h.outcome)).toEqual(['done']);
        expect(e.game.items.hasFire).toBe(true);
    });

    it('a DIFFERENT item after the room\'s grant: replanned, and the re-stage carries ONLY the delivered item — the grant stays the run\'s', () => {
        const e = setup();
        e.engine.walkTo(CHEST);
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.drained >= 12);
        e.game.items.hasDarkSword = true; // the Witch's grant (not a slot item): the game's own flag
        e.runUntil(() => e.game.drained >= 24);
        e.delivery.receive('Progressive Shield');
        e.delivery.push();
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.engine.stats.deliveries[0]).toMatchObject({ phase: 'playing', outcome: 'replanned',
            items: [{ property: 'hasShield', from: false, to: true }] });
        const cont = e.seen[1].request;
        expect(cont.staging.seam.items.hasShield).toBe(true);
        // ⛔ the arrival never held the room's grant: staged there, an encounter's boss leaves at construction
        expect(cont.staging.seam.items.hasDarkSword ?? false).toBe(A.status.items.hasDarkSword ?? false);
        expect(cont.staging.seam.items.hasDarkSword ?? false).toBe(false);
    });

    it('a delivery after the tape ENDED (finished, held): no botHold toggle — the plan\'s hold stands and the goal finishes', () => {
        const e = setup();
        // the game's botHold("off") releases a held end too (the toggle storm's mechanism)
        const hold = e.game.botHold;
        e.game.botHold = (arg) => { const r = hold(arg); if (arg === 'off') e.game.held = false; return r; };
        e.engine.walkTo(CHEST);
        e.runUntil(() => e.engine.status().phase === 'playing' && e.game.finished);
        expect(e.game.held).toBe(true);
        expect(e.engine.status().phase).toBe('playing');
        e.delivery.receive('Progressive Shield');
        e.delivery.push();
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.game.calls.filter((c) => c.startsWith('botHold'))).toEqual([]);
        expect(e.dones.map((d) => [d.goal.name, d.continuation])).toEqual([[CHEST.name, false]]);
        expect(e.engine.stats.deliveries).toEqual([expect.objectContaining({ phase: 'held', outcome: 'staged' })]);
        expect(e.game.items.hasShield).toBe(true);
    });

    it('the leg ends at the game\'s `finished`, not at its last drained tick: the disarm frame\'s flag is in the game when the goal is done', () => {
        const e = setup();
        // the game: every planned row drained → disarmed, but `finished` (and the pickup's flag, a frame late) only
        // on the frame after (fidelity ENCOUNTERS2 D3: the flag lands one frame after the plan's last tick)
        const drain = e.game.botDrain;
        let disarm = null;
        e.game.botDrain = () => {
            const out = drain();
            if (e.game.finished && disarm === null) { e.game.finished = false; e.game.held = false; disarm = 0; }
            return out;
        };
        const st = e.game.botStatus;
        e.game.botStatus = () => {
            if (disarm !== null && !e.game.finished && (disarm += 1) >= 2) {
                e.game.finished = true; e.game.held = !!e.game.tape.hold; e.game.items.hasDarkSword = true;
            }
            return st();
        };
        const atDone = [];
        e.engine.walkTo(CHEST);
        const done0 = e.dones.length;
        e.runUntil(() => e.dones.length > done0);
        atDone.push(e.game.items.hasDarkSword);
        expect(e.failures).toEqual([]);
        expect(disarm).toBeGreaterThanOrEqual(2);
        expect(atDone).toEqual([true]);
    });
});
