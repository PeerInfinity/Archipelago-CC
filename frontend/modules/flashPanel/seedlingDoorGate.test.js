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
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
    DOOR_GATE_ERRORS,
    DOOR_GATE_ERROR_DEFAULT,
    SNAPSHOT_INTERFACE_MODULE_PATH,
    createDoorGate,
    createSnapshotInterfaceLoader,
    lockedDoorMessage,
    ruleItemNames,
} from './seedlingDoorGate.js';
import { ARRIVAL_ECHO_TIMEOUT_MS, SeedlingRegionBinding, doorVerdict } from './seedlingRegionBinding.js';
import { DOOR_LOCKED_EVENT, SeedlingRegionGlue } from './seedlingRegionGlue.js';
import { substrateRegistryEntry as genEntry } from './flashSeedlingGenLibrary.js';
import { FLASH_SEEDLING_LOAD_REGION_EVENT } from './flashSeedlingLibrary.js';
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

const STATIC = { game_name: PRESET.game_name, items: new Map(Object.entries(PRESET.items['1'])),
    locations: new Map(), regions: new Map() };
const realGate = (inventory) => createDoorGate({
    getSnapshot: () => (inventory === null ? null : { inventory, flags: [] }),
    getStaticData: () => STATIC,
    getSnapshotInterface: () => createSnapshotInterface,
});

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
        expect(realGate({})(exit)).toEqual({ pass: false, gated: true, needs: ['key_blue'], missing: ['key_blue'] });
        expect(realGate({ key_red: 1 })(exit)).toMatchObject({ pass: false, missing: ['key_blue'] });
        expect(realGate({ key_blue: 1 })(exit)).toEqual({ pass: true, gated: true, needs: ['key_blue'], missing: [] });
    });

    it('an exit with NO rule passes without asking the state manager anything', () => {
        const getSnapshot = vi.fn(() => { throw new Error('asked'); });
        const gate = createDoorGate({ getSnapshot, getStaticData: () => null, getSnapshotInterface: () => null });
        expect(gate(gatedWorld().exits.get('exit_0'))).toEqual({ pass: true, gated: false, needs: [], missing: [] });
        expect(getSnapshot).not.toHaveBeenCalled();
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
        expect(() => notLoaded(exit)).toThrow(DOOR_GATE_ERRORS.notLoaded());
        expect(() => realGate(null)(exit)).toThrow(DOOR_GATE_ERRORS.noSnapshot());
        const odd = gatedWorld({ rule: 'NoSuchRule', args: {} }).exits.get('exit_1');
        expect(() => realGate({})(odd)).toThrow(/evaluated to undefined, not true or false/);
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

    it('met: the crossing is published exactly as before', () => {
        const h = harness(realGate({ key_blue: 1 }));
        h.adapter.onStateReport('pendingExit', fire());
        expect(h.published.map((p) => [p.name, p.data.targetRegion])).toEqual([['user:regionMove', 'region_1_0']]);
        expect(h.glue.stats).toMatchObject({ doorsLocked: 0, bounces: 0 });
    });
});
