/**
 * STRUCK BLOCKS (session tile-primitives-sphere-order-2, ⚖ 2026-10-26 "Reach-2 strike-push"). Seedling's
 * `PushableBlockSpear` (`Puzzlements/PushableBlockSpear.as`: `moveTypes = ["Spear"]`, type "Solid") is never walked
 * into; a spear thrust — a 32 px stab rect with no reach gate and no line test (`Player.as:964-989`) — moves it one
 * cell the way the player faces (`Player.as:1121-1123`). L67's block stands between pits, so the game spears it from
 * two cells away across them (the seedling-fidelity spear legs). ⛓ BLOCK KINDS (session tile-mechanisms-m1): the
 * world-level `block_strike` retired into the `block_lib` kind `spear` (`{walk: false, struck_by: ['spear']}`), named
 * by each block, and its `reach` (cells straight ahead) into the spear's own footprint — here a reach-r footprint.
 */
import { describe, it, expect } from 'vitest';
import {
    createState, step, whyBlocked, mazeVisitedKey, worldInputs, deserializeMazeWorld, serializeMazeEntities,
    checkBlockLib, strikePushes, effectiveInventory, getExitAt,
} from './mazeRoomEngine.js';
import { scriptedStep } from './tileSpike/tileStep.js';
import { deriveRequires } from './mazeQueueExecutor.js';
import { useEntry } from './mazeKeys.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };
import { buildPlaythroughMaze } from '../../../scripts/procgen/make-seedling-playthrough-maze.mjs';

const SPEAR = 'Ghost Spear';
/** The cells `reach` ahead, per facing — the retired `block_strike.reach` as a footprint. */
const reachFootprint = (reach) => Object.fromEntries(Object.entries({ N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] })
    .map(([f, [dx, dy]]) => [f, Array.from({ length: reach }, (_, i) => [dx * (i + 1), dy * (i + 1)])]));
const actions = (reach = 2) => ({ spear: { item: SPEAR, primitive: 'strike', condition: 'strikes', key: 'x', footprint: reachFootprint(reach) } });
const ACTIONS = actions();
const SPEAR_KIND = { spear: { walk: false, struck_by: ['spear'] } };

/**
 *   #  wall   P entrance   X exit   B block   o button (holds sw_0)   D door (opens to sw_0)   w water that SINKS a block
 */
function sidecar(rows, { reach = 2, strike = true } = {}) {
    const height = rows.length;
    const width = rows[0].length;
    const at = (ch) => {
        const out = [];
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rows[y][x] === ch) out.push({ x, y });
        return out;
    };
    const [entrance] = at('P');
    return {
        width,
        height,
        tiles: rows.flatMap((r) => [...r].map((c) => (c === '#' ? 1 : 0))),
        entrance,
        exits: at('X').map((c) => ({ exit_id: 'exit', ...c })),
        obstacles: [...at('D').map((c) => ({ ...c, id: 'door' })), ...at('w').map((c) => ({ ...c, id: 'water' }))],
        items: [],
        obstacleLib: {
            door: { id: 'door', name: 'door', clear_set: [['sw_0']] },
            water: { id: 'water', name: 'water', clear_set: [['Progressive Swim']] },
        },
        blocks: strike ? at('B').map((c) => ({ ...c, kind: 'spear' })) : at('B'),
        ...(at('o').length > 0 ? { buttons: at('o').map((c) => ({ ...c, id: 'button_0' })), buttonLib: { button_0: { kind: 'button', holds: 'sw_0' } } } : {}),
        ...(at('w').length > 0 ? { block_sinks: at('w') } : {}),
        action_lib: actions(reach),
        ...(strike ? { block_lib: SPEAR_KIND } : {}),
    };
}

const world = (rows, opts) => deserializeMazeWorld(sidecar(rows, opts));
const holding = (w, items, pos = null, facing = null) => {
    const s = createState(w);
    s.inventory = new Set(items);
    if (pos) s.player_pos = { ...pos };
    if (facing) s.facing = facing;
    return s;
};

/** A thrust east from (1,1) over the wall (2,1) at the block (3,1); (5,1) beyond the reach of a second thrust. */
const LINE = [
    '########',
    '#P#B...#',
    '#......#',
    '########',
];

describe('the spear kind — checked, round-tripped', () => {
    it('refuses a missing action and an empty list by name', () => {
        expect(() => checkBlockLib({ spear: { walk: false, struck_by: ['sword'] } }, ACTIONS, 't')).toThrow(/names sword, which the action_lib does not hold/);
        expect(() => checkBlockLib({ spear: { walk: false, struck_by: [] } }, ACTIONS, 't')).toThrow(/non-empty list/);
        expect(() => checkBlockLib([], ACTIONS, 't')).toThrow(/must be a non-empty object/);
    });

    it('the retired block_strike is refused by name — one spelling', () => {
        const sc = { ...sidecar(LINE, { strike: false }), block_strike: { struck_by: ['spear'] } };
        expect(() => deserializeMazeWorld(sc)).toThrow(/"block_strike" is retired/);
    });

    it('serializes back as it was loaded; a world without it carries none', () => {
        const out = serializeMazeEntities(world(LINE));
        expect(out.block_lib).toEqual(SPEAR_KIND);
        expect(out.blocks).toEqual([{ x: 3, y: 1, kind: 'spear' }]);
        const plain = serializeMazeEntities(world(LINE, { strike: false }));
        expect(plain.block_lib).toBeUndefined();
        expect(plain.blocks).toEqual([{ x: 3, y: 1 }]);
    });
});

describe('a struck block moves only by a thrust', () => {
    it('walking into it is refused — native, scripted and whyBlocked agree', () => {
        const w = world(LINE);
        const s = holding(w, [SPEAR], { x: 3, y: 2 });
        expect(step(w, s, 'N')).toBeNull();
        expect(scriptedStep(w, s, 'N', HELPERS).refused.primitive).toBe('push');
        expect(whyBlocked(w, s, 'N')).toMatch(/block at \(3,1\) \(spear\) is not walk-pushed — a strike moves it \(spear\)/);
        // Control: the same corridor without the spear kind walk-pushes its block.
        const ROOM = ['######', '#PB..#', '######'];
        expect(step(world(ROOM, { strike: false }), holding(world(ROOM, { strike: false }), []), 'E').blocks).toEqual(['3,1']);
        expect(step(world(ROOM), holding(world(ROOM), [SPEAR]), 'E')).toBeNull();
    });

    it('a thrust moves it one cell from two cells away, over a wall; three cells is out of reach', () => {
        const w = world(LINE);
        const near = step(w, holding(w, [SPEAR], { x: 1, y: 1 }, 'E'), 'USE:spear');
        expect(near.blocks).toEqual(['4,1']);
        expect(near.player_pos).toEqual({ x: 1, y: 1 });
        const far = world(['########', '#P.#B..#', '#......#', '########']);
        expect(step(far, holding(far, [SPEAR], { x: 1, y: 1 }, 'E'), 'USE:spear').blocks).toEqual(['4,1']);
        const reach1 = world(LINE, { reach: 1 });
        expect(step(reach1, holding(reach1, [SPEAR], { x: 1, y: 1 }, 'E'), 'USE:spear').blocks).toEqual(['3,1']);
    });

    it('without the spear the use is refused; a thrust at a block that cannot move passes a turn', () => {
        const w = world(LINE);
        expect(step(w, holding(w, [], { x: 1, y: 1 }, 'E'), 'USE:spear')).toBeNull();
        const stuck = world(['######', '#P#B##', '#....#', '######']);
        const s = step(stuck, holding(stuck, [SPEAR], { x: 1, y: 1 }, 'E'), 'USE:spear');
        expect(s.blocks).toEqual(['3,1']);
        expect(s.turn).toBe(1);
    });

    it('it sinks in water and holds a button it is parked on', () => {
        const sink = world(['######', '#PB w#', '#....#', '######'].map((r) => r.replace(' ', '.')));
        const once = step(sink, holding(sink, [SPEAR], { x: 1, y: 1 }, 'E'), 'USE:spear');
        expect(step(sink, once, 'USE:spear').blocks).toEqual([]);
        const btn = world(['#######', '#PB.oD#', '#.....#', '#######']);
        let s = holding(btn, [SPEAR], { x: 1, y: 1 }, 'E');
        s = step(btn, s, 'USE:spear');
        s = step(btn, s, 'USE:spear');
        expect(s.blocks).toEqual(['4,1']);
        expect(effectiveInventory(btn, s.inventory, s.player_pos, s.blocks, s.broken).has('sw_0')).toBe(true);
        // Three cells ahead now: out of reach, so a third thrust moves nothing (and the door stays held).
        expect(strikePushes(btn, s, 'spear', s.inventory)).toEqual([]);
    });

    it('native step ≡ scripted step over every reachable state and input', () => {
        // The exit is behind a door the button holds; only the thrust block parked on the button holds it there.
        const w = world(['#########', '#P.B..o.#', '#..#...D#', '#.....#X#', '#########']);
        const start = holding(w, [SPEAR]);
        const seen = new Map([[mazeVisitedKey(start), start]]);
        const frontier = [start];
        let compared = 0;
        while (frontier.length) {
            const s = frontier.pop();
            for (const input of worldInputs(w)) {
                const native = step(w, s, input);
                const scripted = scriptedStep(w, s, input, HELPERS).next;
                expect(scripted === null ? null : mazeVisitedKey(scripted), `${mazeVisitedKey(s)} ${input}`)
                    .toBe(native === null ? null : mazeVisitedKey(native));
                compared += 1;
                if (native && !seen.has(mazeVisitedKey(native))) { seen.set(mazeVisitedKey(native), native); frontier.push(native); }
            }
        }
        expect(compared).toBeGreaterThan(100);
        expect([...seen.values()].some((s) => getExitAt(w, s.player_pos.x, s.player_pos.y))).toBe(true);
    });

    it('a recording that thrusts needs the spear (deriveRequires)', () => {
        const w = world(LINE);
        const s = holding(w, [SPEAR], { x: 1, y: 1 }, 'E');
        const { requires } = deriveRequires(w, s, [useEntry('spear')]);
        expect(requires).toEqual([SPEAR]);
    });
});

describe('L67 — the spear block projects as a struck block', () => {
    it('its world carries the spear kind (on its footprint: two cells ahead) and the block, not a Ghost Spear gate', () => {
        const rules = JSON.parse(buildPlaythroughMaze({ levels: ['level_59', 'level_67'] }).text);
        const p = Object.values(rules.preset_sidecars['1']).find((s) => s.playable_payload?.atlas_region === 'level_67').playable_payload;
        // ⛓ WEAPON FOOTPRINTS (session tile-primitives-weapon-footprints): the reach is the spear's footprint now.
        // ⛓ BLOCK KINDS (session tile-mechanisms-m1): `block_strike` retired into the `spear` kind.
        expect(p.block_strike).toBeUndefined();
        expect(p.block_lib).toEqual(SPEAR_KIND);
        expect(p.action_lib.spear.footprint.E).toEqual([[1, 0], [2, 0]]);
        expect(p.blocks).toEqual([{ x: 9, y: 7, kind: 'spear' }]);
        expect(p.action_lib.spear.item).toBe(SPEAR);
        expect(p.obstacles.find((o) => o.x === 9 && o.y === 7)).toBeUndefined();
    }, 120000); // the first compile in the file pays the producer's cold analysis pass
});
