/**
 * ⛓⛓⛓ SEEDLING GENERATED LEVELS G4 — **THE HOST ENFORCES A GENERATED DOOR'S AP
 * GATE.** The predicate (`seedlingDoorGate.js`), the binding's refused-door arm
 * and its state table (plan §9.1 #3 — one row per line, each mark's age both
 * sides), and the glue that applies `locked` and `bounce`.
 *
 * The world is the COMMITTED `seedling_generated_room` preset's `region_0_0`
 * put through the entry's own `deserializeWorld`, with a gate written into its
 * payload's `exitGates` the way `serializeGenRoom` writes one — so the rows run
 * on the shape the pipeline emits, not a hand-built stand-in. The evaluator is
 * the REAL one (`createSnapshotInterface` + `evaluateRule`).
 *
 * ⛓ G6 — the gate reads the rule from the state manager's STATIC DATA (the
 * region's exit by its AP name), so `STATIC` is the same preset's own regions
 * with the same gate on `exit_1` — the rule the logic would evaluate. The G6
 * rows below pull the two sources apart (static wins; the payload only as a
 * named fallback), and run both entries on their COMMITTED worlds.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
    DOOR_GATE_ERRORS,
    DOOR_GATE_ERROR_DEFAULT,
    DOOR_RULE_FALLBACK,
    SNAPSHOT_INTERFACE_MODULE_PATH,
    createDoorGate,
    createSnapshotInterfaceLoader,
    lockedDoorMessage,
    ruleItemNames,
    staticExitOf,
} from './seedlingDoorGate.js';
import { ARRIVAL_ECHO_TIMEOUT_MS, SeedlingRegionBinding, doorVerdict } from './seedlingRegionBinding.js';
import { DOOR_LOCKED_EVENT, SeedlingRegionGlue } from './seedlingRegionGlue.js';
import { substrateRegistryEntry as genEntry } from './flashSeedlingGenLibrary.js';
import { FLASH_SEEDLING_LOAD_REGION_EVENT, substrateRegistryEntry as atlasEntry } from './flashSeedlingLibrary.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';

const PRESET = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../presets/seedling_generated_room/AP_1/AP_1_rules.json', import.meta.url)), 'utf8'));
const ROOM = 'region_0_0';
const PAYLOAD = PRESET.preset_sidecars['1'][ROOM].playable_payload;
const HAS_BLUE = Object.freeze({ rule: 'Has', args: Object.freeze({ item_name: 'key_blue' }) });

/** The room, with `exit_1` (the door to the maze) gated the way the serializer records a gate. */
const gatedWorld = (rule = HAS_BLUE) => genEntry.deserializeWorld({
    ...structuredClone(PAYLOAD), exitGates: { exit_1: structuredClone(rule) },
});
const DOOR = PAYLOAD.exits.find((e) => e.exitName === 'exit_1');
const [DOOR_TX, DOOR_TY] = DOOR.exit_tiles[0];
const PARKING = 2; // the assembled set's parking level (2 generated rooms + 1)
const L = PAYLOAD.level;
/** The game's own report for that door: `<seq>|<fromLevel>|teleporter|<x>|<y>|<to>`. */
const fire = (seq = 1) => `${seq}|${L}|teleporter|${DOOR_TX * 16}|${DOOR_TY * 16}|${PARKING}`;

/** Static data as the proxy holds it (`regions` a Map) — a rules.json's regions, `exits` edited per region. */
const staticOf = (rulesJson, edit = {}) => ({
    game_name: rulesJson.game_name,
    items: new Map(Object.entries(rulesJson.items['1'])),
    locations: new Map(),
    regions: new Map(Object.entries(structuredClone(rulesJson.regions['1'])).map(([name, r]) => [name,
        { ...r, exits: r.exits.map((e) => (edit[name]?.[e.name] ? { ...e, access_rule: edit[name][e.name] } : e)) }])),
    game_info: rulesJson.game_info,
});
const STATIC = staticOf(PRESET, { [ROOM]: { exit_1: HAS_BLUE } });
const realGate = (inventory, staticData = STATIC) => createDoorGate({
    getSnapshot: () => (inventory === null ? null : { inventory, flags: [] }),
    getStaticData: () => staticData,
    getSnapshotInterface: () => createSnapshotInterface,
});
const IN_ROOM = Object.freeze({ region: ROOM });

let clock;
beforeEach(() => { clock = 1_000_000; });
const bindingWith = (canPass) => {
    const b = new SeedlingRegionBinding({ now: () => clock, canPass });
    b.onLoadRegion({ region_id: ROOM, world: gatedWorld(), arrivedFrom: null });
    b.onStateReport('level', String(L)); // the baseline — releases the boot arrival
    b.onStateReport('level', String(L)); // (already on L: nothing armed)
    return b;
};
const types = (effects) => effects.map((e) => e.type);

describe('the predicate — seedlingDoorGate', () => {
    it('ruleItemNames reads the items a rule NAMES, in order, once each, in both spellings', () => {
        expect(ruleItemNames(HAS_BLUE)).toEqual(['key_blue']);
        expect(ruleItemNames({ rule: 'True_' })).toEqual([]);
        expect(ruleItemNames({ rule: 'And', children: [HAS_BLUE, { rule: 'HasAll', args: { item_names: ['key_red', 'key_blue'] } }] }))
            .toEqual(['key_blue', 'key_red']);
        expect(ruleItemNames({ type: 'and', conditions: [{ type: 'item_check', item: 'key_red' }, { type: 'count_check', item: 'key_green', count: 2 }] }))
            .toEqual(['key_red', 'key_green']);
        expect(ruleItemNames(null)).toEqual([]);
    });

    it('the locked sentence names the region and the item(s)', () => {
        expect(lockedDoorMessage('region_1_0', ['key_blue'])).toBe('the door to region_1_0 is locked — you need key_blue');
        expect(lockedDoorMessage('r', ['a', 'b', 'c'])).toBe('the door to r is locked — you need a, b and c');
        expect(lockedDoorMessage('r', [])).toBe('the door to r is locked — its rule is not met yet');
    });

    it('with the REAL evaluator: refuses without the item, passes with it, and names what is missing', () => {
        const exit = gatedWorld().exits.get('exit_1');
        expect(exit.access_rule).toEqual(HAS_BLUE);
        expect(realGate({})(exit, IN_ROOM)).toEqual({ pass: false, gated: true, needs: ['key_blue'],
            missing: ['key_blue'], source: 'static' });
        expect(realGate({ key_red: 1 })(exit, IN_ROOM)).toMatchObject({ pass: false, missing: ['key_blue'] });
        expect(realGate({ key_blue: 1 })(exit, IN_ROOM)).toEqual({ pass: true, gated: true, needs: ['key_blue'],
            missing: [], source: 'static' });
    });

    it('an exit whose rule is `True_` (or absent) passes without asking for a snapshot or the evaluator', () => {
        const getSnapshot = vi.fn(() => { throw new Error('asked'); });
        const getSnapshotInterface = vi.fn(() => null);
        const gate = createDoorGate({ getSnapshot, getStaticData: () => STATIC, getSnapshotInterface });
        expect(gate(gatedWorld().exits.get('exit_0'), IN_ROOM)).toEqual({ pass: true, gated: false, needs: [],
            missing: [], source: 'static' });
        expect(getSnapshot).not.toHaveBeenCalled();
        expect(getSnapshotInterface).not.toHaveBeenCalled();
    });

    /**
     * ⛔ THE THREE FAILURES, AND TWO OF THEM DO NOT THROW IN THE ENGINE (W0 #2,
     * measured): a null snapshot evaluates to `false` and an unknown rule to
     * `undefined`. Read as answers they would silently LOCK a door; each must be
     * an ERROR by sentence.
     */
    it('no evaluator / no snapshot / a non-boolean answer are ERRORS by sentence, never answers', () => {
        const exit = gatedWorld().exits.get('exit_1');
        const notLoaded = createDoorGate({ getSnapshot: () => ({ inventory: {} }), getStaticData: () => STATIC,
            getSnapshotInterface: () => null });
        expect(() => notLoaded(exit, IN_ROOM)).toThrow(DOOR_GATE_ERRORS.notLoaded());
        expect(() => realGate(null)(exit, IN_ROOM)).toThrow(DOOR_GATE_ERRORS.noSnapshot());
        const odd = gatedWorld({ rule: 'NoSuchRule', args: {} }).exits.get('exit_1');
        const oddStatic = staticOf(PRESET, { [ROOM]: { exit_1: { rule: 'NoSuchRule', args: {} } } });
        expect(() => realGate({}, oddStatic)(odd, IN_ROOM)).toThrow(/evaluated to undefined, not true or false/);
        // ⛓ G6 — and a fourth: no static data at all (the rule's source) is an error too, never "ungated"
        expect(() => realGate({}, null)(exit, IN_ROOM)).toThrow(DOOR_GATE_ERRORS.noStaticData());
    });

    it('the lazy loader: a COMPUTED url, one load, a failure named and retryable', async () => {
        const seen = [];
        const ok = createSnapshotInterfaceLoader({ baseURI: 'http://h:1/frontend/',
            importer: async (url) => { seen.push(url); return { createSnapshotInterface }; } });
        expect(ok.get()).toBe(null);
        await Promise.all([ok.load(), ok.load()]);
        expect(seen).toEqual([`http://h:1/frontend/${SNAPSHOT_INTERFACE_MODULE_PATH}`]);
        expect(ok.get()).toBe(createSnapshotInterface);
        const logs = [];
        let fail = true;
        const flaky = createSnapshotInterfaceLoader({ baseURI: 'http://h:1/', log: (m) => logs.push(m),
            importer: async () => { if (fail) throw new Error('404'); return { createSnapshotInterface }; } });
        expect(await flaky.load()).toBe(false);
        expect(logs[0]).toMatch(/did not load — a gated generated door will stay OPEN .*404/);
        fail = false;
        expect(await flaky.load()).toBe(true);
        expect(await createSnapshotInterfaceLoader({ baseURI: null }).load()).toBe(false);
    });
});

describe('doorVerdict — what a gate answered, normalised', () => {
    it('no predicate passes; booleans and verdicts are read; a throw or a shapeless answer is an error', () => {
        expect(doorVerdict(null, {})).toEqual({ pass: true, gated: false });
        expect(doorVerdict(() => false, {})).toEqual({ pass: false, gated: true });
        expect(doorVerdict(() => ({ pass: false, missing: ['k'] }), {})).toMatchObject({ pass: false, missing: ['k'] });
        expect(DOOR_GATE_ERROR_DEFAULT).toBe('open');
        expect(doorVerdict(() => { throw new Error('boom'); }, {})).toEqual({ pass: true, gated: true, error: 'boom' });
        expect(doorVerdict(() => 'yes', {})).toMatchObject({ pass: true, error: expect.stringMatching(/not a pass\/refuse verdict/) });
    });
});

describe('the binding — the state table (plan §9.1 #3)', () => {
    /**
     * ⛓ NULL ⇒ TODAY, BYTE FOR BYTE. The same report sequence through a binding
     * with no predicate, with a predicate that always passes, and through the
     * REAL gate holding the item: identical effects at every step.
     */
    it('M1/M2 — no predicate, a passing one and the real gate WITH the item all do exactly today\'s crossing', () => {
        const run = (canPass) => {
            const b = bindingWith(canPass);
            return [b.onStateReport('pendingExit', fire()), b.onStateReport('level', String(PARKING)),
                b.pendingDeparture, b.pendingBounce];
        };
        const today = run(null);
        expect(today[0]).toEqual([{ type: 'regionMove', sourceRegion: ROOM, targetRegion: 'region_1_0',
            exitName: 'exit_1', exitId: DOOR.exit_id, fromLevel: L, toLevel: PARKING, external: true }]);
        expect(today[1]).toEqual([]); // the swap, swallowed
        expect(run(() => true)).toEqual(today);
        expect(run(realGate({ key_blue: 1 }))).toEqual(today);
    });

    it('U1 — an unmet door publishes NO region move: `locked`, naming the region and the missing item', () => {
        const b = bindingWith(realGate({}));
        const out = b.onStateReport('pendingExit', fire());
        expect(out).toEqual([{ type: 'locked', sourceRegion: ROOM, region: 'region_1_0', exit: 'exit_1',
            exitId: DOOR.exit_id, needs: ['key_blue'],
            message: 'the door to region_1_0 is locked — you need key_blue' }]);
        expect(b.pendingBounce).toMatchObject({ level: PARKING, at: clock });
        expect(b.pendingDeparture).toBe(null);
    });

    it('U2/U3 — the swap is swallowed and ANSWERED with the bounce onto the APPROACH cell; its echo swallowed', () => {
        const b = bindingWith(realGate({}));
        b.onStateReport('pendingExit', fire());
        clock += 100;
        const swap = b.onStateReport('level', String(PARKING));
        expect(swap).toEqual([{ type: 'bounce', level: L, x: DOOR.entrance_spawn.x, y: DOOR.entrance_spawn.y,
            exit: DOOR.exit_id, region: ROOM }]);
        // ⛔ the approach, NOT the door tile (the latch would not fire again; the game does not draw the player there)
        expect([swap[0].x, swap[0].y]).not.toEqual([DOOR_TX * 16, DOOR_TY * 16]);
        expect(b.pendingBounce).toBe(null);
        expect(b.pendingArrival).toMatchObject({ level: L });
        clock += 100;
        expect(b.onStateReport('level', String(L))).toEqual([]); // the bounce's own landing
        expect(b.pendingArrival).toBe(null);
        // and the door works again the next time — with the item this time, a real crossing
        b.setCanPass(realGate({ key_blue: 1 }));
        expect(types(b.onStateReport('pendingExit', fire(2)))).toEqual(['regionMove']);
    });

    it('U2 age — inside T the swap bounces; past T the mark is written off and the swap is read as REAL', () => {
        const inside = bindingWith(realGate({}));
        inside.onStateReport('pendingExit', fire());
        clock += ARRIVAL_ECHO_TIMEOUT_MS;
        expect(types(inside.onStateReport('level', String(PARKING)))).toEqual(['bounce']);
        const past = bindingWith(realGate({}));
        past.onStateReport('pendingExit', fire());
        clock += ARRIVAL_ECHO_TIMEOUT_MS + 1;
        const out = past.onStateReport('level', String(PARKING));
        expect(types(out)).toEqual(['warn']); // the existing loud "no marked exit to level 2"
        expect(past.pendingBounce).toBe(null);
    });

    it('U3 age — inside T the landing is swallowed; past T it is a real crossing', () => {
        const mk = () => {
            const b = bindingWith(realGate({}));
            b.onStateReport('pendingExit', fire());
            b.onStateReport('level', String(PARKING));
            return b;
        };
        const inside = mk();
        clock += ARRIVAL_ECHO_TIMEOUT_MS;
        expect(inside.onStateReport('level', String(L))).toEqual([]);
        const past = mk();
        clock += ARRIVAL_ECHO_TIMEOUT_MS + 1;
        expect(past.onStateReport('level', String(L)).length).toBeGreaterThan(0);
    });

    it('U2\'\' — a report of ANOTHER level falls through with the mark kept; the swap still bounces after it', () => {
        const b = bindingWith(realGate({}));
        b.onStateReport('pendingExit', fire());
        b.onStateReport('level', '-1'); // the game's no-game sentinel — ignored
        expect(b.pendingBounce).not.toBe(null);
        b.onStateReport('level', '1'); // another room: read as usual (the gen↔gen crossing arm)
        expect(b.pendingBounce).not.toBe(null);
        expect(types(b.onStateReport('level', String(PARKING)))).toEqual(['bounce']);
    });

    it('Up — a park and a game restart both drop an unanswered bounce', () => {
        const parked = bindingWith(realGate({}));
        parked.onStateReport('pendingExit', fire());
        parked.setActive(false);
        expect(parked.pendingBounce).toBe(null);
        const restarted = bindingWith(realGate({}));
        restarted.onStateReport('pendingExit', fire());
        restarted.onGameRestart();
        expect(restarted.pendingBounce).toBe(null);
    });

    it('E1 — a gate that cannot evaluate takes the declared default (OPEN) and SAYS WHY', () => {
        const b = bindingWith(realGate(null)); // no snapshot
        const out = b.onStateReport('pendingExit', fire());
        expect(types(out)).toEqual(['warn', 'regionMove']);
        expect(out[0].message).toContain('could not evaluate the rule on the door to "region_1_0" ("exit_1")');
        expect(out[0].message).toContain(DOOR_GATE_ERRORS.noSnapshot());
        expect(out[0].message).toContain('left OPEN (the declared default)');
        const thrown = bindingWith(() => { throw new Error('evaluator exploded'); });
        expect(thrown.onStateReport('pendingExit', fire())[0].message).toContain('evaluator exploded');
    });

    it('the ungated door beside it is untouched by the gate', () => {
        const b = bindingWith(realGate({}));
        const other = PAYLOAD.exits.find((e) => e.exitName === 'exit_0');
        const [tx, ty] = other.exit_tiles[0];
        expect(types(b.onStateReport('pendingExit', `1|${L}|teleporter|${tx * 16}|${ty * 16}|1`))).toEqual(['regionMove']);
    });
});

describe('the glue applies `locked` and `bounce`', () => {
    const harness = (canPass) => {
        const subs = new Map();
        const bus = [];
        const eventBus = { subscribe: (n, fn) => { subs.set(n, fn); return () => subs.delete(n); },
            publish: (name, data) => bus.push({ name, data }) };
        const published = [];
        const panel = [];
        const glue = new SeedlingRegionGlue({ eventBus, loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
            getDispatcher: () => ({ publish: (name, data) => published.push({ name, data }) }),
            getPanel: () => ({ _panelLog: (m, cls) => panel.push({ m, cls }) }), now: () => clock, canPass });
        glue.start();
        const adapter = { teleport: vi.fn(() => true), onStateReport: null };
        glue.attachAdapter(adapter);
        subs.get(FLASH_SEEDLING_LOAD_REGION_EVENT)({ region_id: ROOM, world: gatedWorld(), arrivedFrom: null });
        adapter.onStateReport('level', String(L));
        adapter.teleport.mockClear();
        return { glue, adapter, bus, published, panel };
    };

    it('unmet: a panel line + `flashSeedling:doorLocked`, no region move, then the teleport home once the swap lands', () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        const h = harness(realGate({}));
        h.adapter.onStateReport('pendingExit', fire());
        expect(h.published).toEqual([]);
        expect(h.glue.stats.doorsLocked).toBe(1);
        expect(h.panel.at(-1)).toEqual({ m: '[door gate] the door to region_1_0 is locked — you need key_blue', cls: 'warn' });
        expect(h.bus.filter((e) => e.name === DOOR_LOCKED_EVENT)).toEqual([{ name: DOOR_LOCKED_EVENT, data: {
            sourceRegion: ROOM, region: 'region_1_0', exit: 'exit_1', exitId: DOOR.exit_id, needs: ['key_blue'],
            message: 'the door to region_1_0 is locked — you need key_blue' } }]);
        expect(h.adapter.teleport).not.toHaveBeenCalled(); // ⛔ not before the swap
        h.adapter.onStateReport('level', String(PARKING));
        expect(h.adapter.teleport).toHaveBeenCalledWith({ level: L, x: DOOR.entrance_spawn.x, y: DOOR.entrance_spawn.y });
        expect(h.glue.stats.bounces).toBe(1);
        h.adapter.onStateReport('level', String(L));
        expect(h.published).toEqual([]);
        expect(h.glue.stats.warnings).toBe(0);
    });

    it('G6 — a rule read off the payload (static data has no such exit) says so on the panel line', () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        const h = harness(realGate({}, { ...STATIC, regions: new Map() }));
        h.adapter.onStateReport('pendingExit', fire());
        expect(h.panel.at(-1)).toEqual({ m: `[door gate] the door to region_1_0 is locked — you need key_blue `
            + `(${DOOR_RULE_FALLBACK(ROOM, 'exit_1')})`, cls: 'warn' });
    });

    it('met: the crossing is published exactly as before', () => {
        const h = harness(realGate({ key_blue: 1 }));
        h.adapter.onStateReport('pendingExit', fire());
        expect(h.published.map((p) => [p.name, p.data.targetRegion])).toEqual([['user:regionMove', 'region_1_0']]);
        expect(h.glue.stats).toMatchObject({ doorsLocked: 0, bounces: 0 });
    });
});

/**
 * ⛓⛓ SEEDLING GENERATED G6 — **THE RULE'S SOURCE IS THE STATE MANAGER'S STATIC
 * DATA** (plan §12.1 #3): the region's exit by its AP name (`exitName`), for
 * BOTH entries, payload-agnostic; the world's own rule only as a NAMED
 * fallback. Every world below is a COMMITTED preset through its entry's own
 * `deserializeWorld`, and its static data is that preset's own regions.
 */
const committed = (gameId) => JSON.parse(readFileSync(
    fileURLToPath(new URL(`../../presets/${gameId}/AP_1/AP_1_rules.json`, import.meta.url)), 'utf8'));
const worldOf = (rulesJson, region) => {
    const sc = rulesJson.preset_sidecars['1'][region];
    return (sc.substrate === 'flash_seedling' ? atlasEntry : genEntry).deserializeWorld(sc.playable_payload);
};
const exitNamed = (world, name) => [...(world.exits instanceof Map ? world.exits.values() : world.exits)]
    .find((e) => (e.exitName ?? e.exit_id) === name);

describe('G6 — the gate reads static data', () => {
    it('static data WINS over the payload: a payload gate static data does not carry is not enforced, and vice versa', () => {
        const ungatedStatic = staticOf(PRESET); // the committed room: exit_1 is True_ in the logic
        const payloadGated = gatedWorld().exits.get('exit_1');
        expect(realGate({}, ungatedStatic)(payloadGated, IN_ROOM)).toEqual({ pass: true, gated: false, needs: [],
            missing: [], source: 'static' });
        const payloadOpen = genEntry.deserializeWorld(structuredClone(PAYLOAD)).exits.get('exit_1');
        expect(payloadOpen.access_rule).toBeUndefined();
        expect(realGate({})(payloadOpen, IN_ROOM)).toMatchObject({ pass: false, missing: ['key_blue'], source: 'static' });
    });

    it('the exit is found by its AP name (`exitName`), never its `exit_id`; region and name both matter', () => {
        expect(staticExitOf(STATIC, ROOM, 'exit_1').access_rule).toEqual(HAS_BLUE);
        expect(staticExitOf(STATIC, ROOM, DOOR.exit_id)).toBe(null);
        // the region matters: another region's `exit_1` is another door (here gated differently), and no region no exit
        expect(staticExitOf(STATIC, 'region_1_0', 'exit_1')).not.toBe(staticExitOf(STATIC, ROOM, 'exit_1'));
        expect(staticExitOf(STATIC, 'no_such_region', 'exit_1')).toBe(null);
        // the proxy holds a Map; a rules.json an object — both read
        expect(staticExitOf({ regions: PRESET.regions['1'] }, ROOM, 'exit_0').access_rule).toEqual({ rule: 'True_' });
    });

    it('the FALLBACK: static data with no such exit → the payload\'s rule, and the verdict, the effect and the line SAY SO', () => {
        const noRoom = { ...STATIC, regions: new Map() };
        const verdict = realGate({}, noRoom)(gatedWorld().exits.get('exit_1'), IN_ROOM);
        expect(verdict).toMatchObject({ pass: false, source: 'world', fallback: DOOR_RULE_FALLBACK(ROOM, 'exit_1') });
        expect(verdict.fallback).toBe(`the rule is the room's own payload's — the state manager's static data has no `
            + `exit "exit_1" out of region "${ROOM}"`);
        const b = bindingWith(realGate({}, noRoom));
        const [locked] = b.onStateReport('pendingExit', fire());
        expect(locked).toMatchObject({ type: 'locked', fallback: DOOR_RULE_FALLBACK(ROOM, 'exit_1') });
        // an OPEN fallback carries no sentence (nothing is enforced off the payload)
        expect(realGate({}, noRoom)(genEntry.deserializeWorld(structuredClone(PAYLOAD)).exits.get('exit_1'), IN_ROOM))
            .toEqual({ pass: true, gated: false, needs: [], missing: [], source: 'world' });
    });

    it('a REAL-atlas room (`flash_seedling`, committed seedling_sphere_room): its door carries no rule, static data gates it', () => {
        const rj = committed('seedling_sphere_room');
        const world = worldOf(rj, 'region_3_2');
        const door = exitNamed(world, 'region_2_2');
        expect(door.exit_id).toBe('stairs_up');
        expect(door.access_rule).toBeUndefined();
        const gate = (inv) => realGate(inv, staticOf(rj))(door, { region: 'region_3_2' });
        expect(gate({})).toMatchObject({ pass: false, gated: true, missing: ['key_blue'], source: 'static' });
        expect(gate({ key_blue: 1 })).toMatchObject({ pass: true, gated: true, source: 'static' });
    });

    it('a real room whose doors are `True_` in the logic (committed seedling_spiral_room) is UNGATED — no evaluator asked', () => {
        const rj = committed('seedling_spiral_room');
        const world = worldOf(rj, 'region_0_0');
        const gate = createDoorGate({ getSnapshot: () => { throw new Error('asked'); }, getStaticData: () => staticOf(rj),
            getSnapshotInterface: () => { throw new Error('asked'); } });
        for (const name of ['exit_S', 'exit_E']) {
            expect(gate(exitNamed(world, name), { region: 'region_0_0' })).toEqual({ pass: true, gated: false, needs: [],
                missing: [], source: 'static' });
        }
    });

    it('§9.0 #5 CLOSED — a generated room\'s ENGINE-inserted back exit (committed seedling_generated_leaf) is gated now', () => {
        const rj = committed('seedling_generated_leaf');
        const world = worldOf(rj, 'region_3_3');
        const back = exitNamed(world, 'region_2_3');
        expect(back.access_rule).toBeUndefined(); // the payload's exitGates never saw it
        const gate = (inv) => realGate(inv, staticOf(rj))(back, { region: 'region_3_3' });
        expect(gate({})).toMatchObject({ pass: false, missing: ['key_red'], source: 'static' });
        expect(gate({ key_red: 1 })).toMatchObject({ pass: true, source: 'static' });
    });

    it('the committed generated HOST answers the same under the static read as under G4\'s payload read', () => {
        const rj = committed('seedling_generated_host');
        const world = worldOf(rj, 'region_2_2');
        const door = exitNamed(world, 'exit');
        const fromStatic = (inv) => realGate(inv, staticOf(rj))(door, { region: 'region_2_2' });
        const fromPayload = (inv) => realGate(inv, { ...staticOf(rj), regions: new Map() })(door, { region: 'region_2_2' });
        expect(staticExitOf(staticOf(rj), 'region_2_2', 'exit').access_rule).toEqual(door.access_rule);
        for (const inv of [{}, { key_blue: 1 }, { key_red: 1 }]) {
            const { source: s1, fallback: _f, ...a } = fromPayload(inv);
            const { source: s2, ...b } = fromStatic(inv);
            expect([s1, s2]).toEqual(['world', 'static']);
            expect(b).toEqual(a);
        }
    });
});
