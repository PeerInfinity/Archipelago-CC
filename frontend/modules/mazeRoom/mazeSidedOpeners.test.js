/**
 * ⛓⛓ SIDED LATCHING OPENERS (session tile-rules-automation-r-a4b; ⚖ Robert 2026-11-08 "A: R-A4b sided openers (Recommended)").
 * Game truth: a ShieldLock opens only for a player on its west face (`ShieldLock.as:32`), a BossLock only from the row below it
 * (`BossLock.as:62`), and neither closes again for the visit. So a lock opened from its side is open from the far side for the
 * rest of that walk, without any AP event having been granted.
 *
 * Proven on GADGET ROOMS (memory `feedback_no_single_game_code_for_a_test`), no level of any game:
 *   - the walk opens it from the probe side and comes back through the closed side; without the `probe` the return is refused;
 *   - from the closed side alone it never opens, holding the item;
 *   - a BossLock-shaped lock (probe S) behaves the same on its axis;
 *   - selection is by data: no probe, no gate naming the event, or a struck obstacle is not an opener;
 *   - scripted ≡ native over every reachable (state, input), and mutants of the `opens` helper are caught.
 */
import { describe, it, expect } from 'vitest';
import {
    createState, step, whyBlocked, mazeVisitedKey, worldInputs, deserializeMazeWorld, holdInInventory,
    sidedOpeners, openerEvents, effectiveInventory, hasLatches, INPUT_WAIT,
} from './mazeRoomEngine.js';
import { readFileSync } from 'node:fs';
import { scriptedStep, scriptedEffectiveInventory, openerIndex, MAZE_TILE_LIB } from './tileSpike/tileStep.js';
import { reachUnder, regionItems } from './tileSpike/deriveTileLogic.js';
import { nativeReachUnder } from './tileSpike/deriveLevelWorldLogic.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };

const EV = 'Lock opened';
const ITEM = 'Shield';
const has = (item_name) => ({ rule: 'Has', args: { item_name } });

/**
 * `#` wall, `P` entrance, `L` the lock, `G` a goal item. `probe`: the side it opens from. `closedDirs`: the moves that enter it
 * from the closed side (the entry gates naming the event). `entry`: the lock's obstacle-lib entry (overrides).
 */
function sidecar(rows, { probe = 'W', closedDirs = ['W'], entry = {}, event = {}, gateRule = has(EV) } = {}) {
    const height = rows.length;
    const width = rows[0].length;
    const at = (ch) => {
        const out = [];
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rows[y][x] === ch) out.push({ x, y });
        return out;
    };
    const [lock] = at('L');
    return {
        width,
        height,
        tiles: rows.flatMap((r) => [...r].map((c) => (c === '#' ? 1 : 0))),
        entrance: at('P')[0],
        obstacles: [{ ...lock, id: 'lock' }],
        items: at('G').map((c) => ({ ...c, id: 'goal' })),
        obstacleLib: {
            lock: {
                id: 'lock', name: 'lock', clear_set_type: 'rule', clear_rule: has(ITEM),
                events: [{ name: EV, side: 'near', ...(probe ? { probe } : {}), ...event }],
                ...entry,
            },
            gate: { id: 'gate', name: 'gate', clear_set_type: 'rule', clear_rule: gateRule },
        },
        entry_gates: closedDirs.map((dir) => ({ ...lock, dir, gate: 'gate' })),
    };
}
const world = (rows, opts) => deserializeMazeWorld(sidecar(rows, opts));

function holding(w, items = []) {
    const s = createState(w);
    for (const item of items) holdInInventory(s.inventory, item);
    return s;
}
const walk = (w, s, inputs) => inputs.reduce((acc, input) => {
    const n = step(w, acc, input);
    if (n === null) throw new Error(`refused ${input} at ${mazeVisitedKey(acc)}: ${whyBlocked(w, acc, input)}`);
    return n;
}, s);
function reachable(w, items, cap = 20000) {
    const start = holding(w, items);
    const seen = new Map([[mazeVisitedKey(start), start]]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
        for (const input of worldInputs(w)) {
            const n = step(w, queue[head], input);
            if (n === null || seen.has(mazeVisitedKey(n))) continue;
            seen.set(mazeVisitedKey(n), n);
            queue.push(n);
        }
        if (seen.size > cap) throw new Error('exploration truncated');
    }
    return [...seen.values()];
}
function disagreements(w, items, helpers = HELPERS) {
    const out = [];
    let latchings = 0;
    for (const s of reachable(w, items)) {
        for (const input of [...worldInputs(w), INPUT_WAIT]) {
            const native = step(w, s, input);
            const { next } = scriptedStep(w, s, input, helpers);
            const a = native === null ? null : mazeVisitedKey(native);
            const b = next === null ? null : mazeVisitedKey(next);
            if (a !== b) out.push(`${input}@${mazeVisitedKey(s)} native=${a} scripted=${b}`);
            if ((native?.latched?.length ?? 0) > (s.latched?.length ?? 0)) latchings += 1;
        }
    }
    return { out, latchings };
}

// The lock at (3,1): the near side is west, the far side east.
const ROOM = [
    '#######',
    '#P.L.G#',
    '#######',
];
// The player starts on the FAR side: it can never stand on the probe cell.
const FAR = [
    '#######',
    '#..L.P#',
    '#######',
];
// A BossLock's shape: the lock at (1,2), it opens from the south (1,3); the far side is north.
const BOSS = [
    '###',
    '#G#',
    '#L#',
    '#.#',
    '#P#',
    '###',
];
// The arrival IS the probe cell (L19's stairs): (1,4) is a dead end, so the walk can never stand there again; the far door at (1,2) costs the event.
const ARRIVE = [
    '###',
    '#G#',
    '#D#',
    '#.#',
    '#L#',
    '#P#',
    '###',
];
const withFarDoor = (rows, opts) => {
    const car = sidecar(rows, opts);
    const door = [...rows.keys()].flatMap((y) => [...rows[y]].flatMap((c, x) => (c === 'D' ? [{ x, y, id: 'far_door' }] : [])));
    car.obstacles.push(...door);
    car.tiles = rows.flatMap((r) => [...r].map((c) => (c === '#' ? 1 : 0)));
    car.obstacleLib.far_door = { id: 'far_door', name: 'far door', clear_set_type: 'rule', clear_rule: has(EV) };
    return deserializeMazeWorld(car);
};
const BOSS_OPTS = { probe: 'S', closedDirs: ['S'] };

describe('sided openers — selection is by data', () => {
    it('a non-struck obstacle with a probe and a gate naming its event is one, with its stand cell', () => {
        expect(sidedOpeners(world(ROOM))).toEqual([{ key: '3,1', stand: '2,1', event: EV, id: 'lock', rule: null }]);
        expect(sidedOpeners(world(BOSS, BOSS_OPTS))).toEqual([{ key: '1,2', stand: '1,3', event: EV, id: 'lock', rule: null }]);
        expect(hasLatches(world(ROOM))).toBe(true);
    });
    it('no probe, a gate naming something else, a struck obstacle, or no gate at all is not one', () => {
        expect(sidedOpeners(world(ROOM, { probe: null }))).toEqual([]);
        expect(sidedOpeners(world(ROOM, { gateRule: has('Something else') }))).toEqual([]);
        expect(sidedOpeners(world(ROOM, { entry: { struck_by: ['sword'] } }))).toEqual([]);
        expect(sidedOpeners(world(ROOM, { closedDirs: [] }))).toEqual([]);
        expect(hasLatches(world(ROOM, { probe: null }))).toBe(false);
    });
    it('refuses two openers on one cell, by name: `state.latched` holds one mark per cell', () => {
        const car = sidecar(ROOM);
        car.obstacleLib.lock.events.push({ name: 'Second', side: 'near', probe: 'W' });
        car.obstacleLib.gate.clear_rule = { rule: 'And', children: [has(EV), has('Second')] };
        expect(() => sidedOpeners(deserializeMazeWorld(car))).toThrow(/two openers on cell 3,1/);
    });
});

describe('sided openers — the engine (native step)', () => {
    it('opened from its side, the walk comes back through the closed side holding no event', () => {
        const w = world(ROOM);
        const near = walk(w, holding(w, [ITEM]), ['E']);       // on the probe cell (2,1)
        expect(near.latched).toEqual(['3,1']);
        expect(near.inventory.has(EV)).toBe(false);            // no AP event granted mid-walk
        expect(openerEvents(w, near.latched)).toEqual([EV]);
        expect(effectiveInventory(w, near.inventory, near.player_pos, near.blocks, near.broken, near.latched).has(EV)).toBe(true);
        const far = walk(w, near, ['E', 'E']);                 // through the lock, to (4,1)
        const back = walk(w, far, ['W', 'W']);                 // back through it: the entry gate names the event
        expect(back.player_pos).toEqual({ x: 2, y: 1 });
    });
    it('without the probe the same return is refused (the row the primitive exists for)', () => {
        const w = world(ROOM, { probe: null });
        const far = walk(w, holding(w, [ITEM]), ['E', 'E', 'E']);
        expect(step(w, far, 'W')).toBeNull();
    });
    it('without the item the player on the probe cell opens nothing, and cannot step through', () => {
        const w = world(ROOM);
        const near = walk(w, holding(w), ['E']);
        expect(near.latched ?? []).toEqual([]);
        expect(step(w, near, 'E')).toBeNull();
    });
    it('from the closed side alone it never opens, holding the item', () => {
        const w = world(FAR);
        const s = walk(w, holding(w, [ITEM]), ['W']);          // on (4,1), against the far face
        expect(s.latched ?? []).toEqual([]);
        expect(step(w, s, 'W')).toBeNull();
    });
    it('a carried event opens the closed side without recording a mark (no state split)', () => {
        const w = world(FAR);
        const s = walk(w, holding(w, [ITEM, EV]), ['W', 'W']);
        expect(s.player_pos).toEqual({ x: 3, y: 1 });
        expect(s.latched ?? []).toEqual([]);
    });
    it('a BossLock-shaped lock opens from the south and is open from the north afterwards', () => {
        const w = world(BOSS, BOSS_OPTS);
        const start = holding(w, [ITEM]);
        const south = walk(w, start, ['N']);                   // onto the probe cell (1,3)
        expect(south.latched).toEqual(['1,2']);
        const north = walk(w, south, ['N', 'N']);              // through it, onto (1,1)
        const back = walk(w, north, ['S']);                    // back into the lock moving south: the closed side
        expect(back.player_pos).toEqual({ x: 1, y: 2 });
    });
    it('an arrival ON the probe cell opens it for the walk, though the start state is noted before the search sets its inventory', () => {
        const w = withFarDoor(ARRIVE, BOSS_OPTS);
        const start = holding(w, [ITEM]);
        expect(start.latched).toEqual([]);                     // noted with the empty inventory
        const beyond = walk(w, start, ['N', 'N']);             // through the lock, onto (1,3): leaving the probe cell recorded it
        expect(beyond.latched).toEqual(['1,4']);
        expect(walk(w, beyond, ['N', 'N']).player_pos).toEqual({ x: 1, y: 1 }); // the far door, which costs the event
        for (const reach of [reachUnder(w, [ITEM], HELPERS), nativeReachUnder(w, [ITEM])]) {
            expect([...reach.cells.keys()]).toContain('1,1');
        }
    });
    it('a BossLock-shaped lock refuses the north side when the south was never stood on', () => {
        const w = deserializeMazeWorld({ ...sidecar(BOSS, BOSS_OPTS), entrance: { x: 1, y: 1 } });
        expect(step(w, holding(w, [ITEM]), 'S')).toBeNull();
    });
    it('a stacked cell pays the event\'s OWN rule: the cell\'s other clearance does not open it', () => {
        const rows = { event: { rule: has('Yellow Key') } };
        const w = world(ROOM, rows);
        expect(walk(w, holding(w, [ITEM]), ['E']).latched ?? []).toEqual([]);
        expect(walk(w, holding(w, ['Yellow Key']), ['E']).latched).toEqual(['3,1']);
    });
});

describe('sided openers — scripted ≡ native, and the `opens` helper is load-bearing', () => {
    const ROOMS = {
        'west probe, item held': [world(ROOM), [ITEM]],
        'west probe, nothing held': [world(ROOM), []],
        'closed side only': [world(FAR), [ITEM]],
        'closed side, event carried': [world(FAR), [ITEM, EV]],
        'south probe': [world(BOSS, BOSS_OPTS), [ITEM]],
        'arrival on the probe cell': [withFarDoor(ARRIVE, BOSS_OPTS), [ITEM]],
        'own rule': [world(ROOM, { event: { rule: has('Yellow Key') } }), ['Yellow Key']],
    };
    for (const [name, [w, items]] of Object.entries(ROOMS)) {
        it(`agrees over every reachable (state, input) of ${name}`, () => {
            expect(disagreements(w, items).out).toEqual([]);
        });
    }
    it('the open branch is exercised', () => {
        expect(disagreements(...ROOMS['west probe, item held']).latchings).toBeGreaterThan(0);
        expect(disagreements(...ROOMS['south probe']).latchings).toBeGreaterThan(0);
    });
    it('`opens` that never holds is caught', () => {
        const mutant = { ...HELPERS, opens: { ...HELPERS.opens, body: { type: 'constant', value: false } } };
        expect(disagreements(...ROOMS['west probe, item held'], mutant).out.length).toBeGreaterThan(0);
    });
    it('`opens` that ignores the item is caught', () => {
        const [notNone] = HELPERS.opens.body.conditions;
        const mutant = { ...HELPERS, opens: { ...HELPERS.opens, body: notNone } };
        expect(disagreements(...ROOMS['west probe, nothing held'], mutant).out.length).toBeGreaterThan(0);
    });
});

describe('sided openers — derived logic', () => {
    it('the far goal needs only the item; the return costs nothing extra in either search', () => {
        const w = world(ROOM);
        expect(regionItems(w)).toEqual(expect.arrayContaining([ITEM]));
        for (const reach of [reachUnder(w, [ITEM], HELPERS), nativeReachUnder(w, [ITEM])]) {
            expect([...reach.cells.keys()]).toEqual(expect.arrayContaining(['2,1', '3,1', '4,1', '5,1']));
        }
        for (const reach of [reachUnder(w, [], HELPERS), nativeReachUnder(w, [])]) {
            expect([...reach.cells.keys()]).not.toContain('3,1');
        }
    });
});

describe('sided openers — the scripted fast path skips nothing (probe-cell index, no copy when nothing is marked)', () => {
    const sidecars = JSON.parse(readFileSync(new URL('../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8')).preset_sidecars['1'];
    const openerWorlds = Object.entries(sidecars).filter(([, s]) => s.playable_payload)
        .map(([name, s]) => [name, deserializeMazeWorld(s.playable_payload)]).filter(([, w]) => sidedOpeners(w).length > 0);
    it('the committed preset has opener worlds, L12 among them, with six openers', () => {
        expect(openerWorlds.map(([n]) => n)).toContain('level_12__r0c19');
        expect(sidedOpeners(openerWorlds.find(([n]) => n === 'level_12__r0c19')[1]).length).toBe(6);
    });
    it('every opener of every committed world is in the index, under its lock cell and its probe cell', () => {
        for (const [, w] of openerWorlds) {
            const { byCell, byStand } = openerIndex(w);
            for (const o of sidedOpeners(w)) {
                expect(byCell.get(o.key)).toBe(o);
                expect(byStand.get(o.stand)).toContain(o);
            }
            expect([...byStand.values()].flat().length).toBe(sidedOpeners(w).length);
        }
    });
    it('on L12 the scripted step marks each of its six openers where the native one does, from its probe cell', () => {
        const [, w] = openerWorlds.find(([n]) => n === 'level_12__r0c19');
        for (const o of sidedOpeners(w)) {
            const [sx, sy] = o.stand.split(',').map(Number);
            const s = createState(w);
            s.inventory = new Set([...regionItems(w)].filter((i) => i !== o.event));
            s.player_pos = { x: sx, y: sy };
            for (const input of [...worldInputs(w), INPUT_WAIT]) {
                const native = step(w, s, input);
                const { next } = scriptedStep(w, s, input, HELPERS);
                expect(next === null ? null : mazeVisitedKey(next)).toBe(native === null ? null : mazeVisitedKey(native));
            }
            expect(step(w, s, INPUT_WAIT)?.latched ?? []).toContain(o.key);   // the native step does mark it from here
        }
    });
    it('no copy when nothing is marked: a world with openers hands back the carried inventory itself', () => {
        const w = world(ROOM);
        const carried = new Set([ITEM]);
        expect(scriptedEffectiveInventory(w, carried, { x: 1, y: 1 }, undefined, MAZE_TILE_LIB, HELPERS, undefined, [])).toBe(carried);
        expect(effectiveInventory(w, carried, { x: 1, y: 1 }, undefined, undefined, [])).toBe(carried);
        const marked = scriptedEffectiveInventory(w, carried, { x: 1, y: 1 }, undefined, MAZE_TILE_LIB, HELPERS, undefined, ['3,1']);
        expect(marked).not.toBe(carried);
        expect(marked.has(EV)).toBe(true);
    });
});
