/**
 * ⛓ ENTRY GATES (session tile-primitives-water-exits, ⚖ 2026-10-25 "Level world + step gates"): a gate on ENTERING a
 * cell while MOVING one way — the game's direction physics as the region analyzer prices a step (a waterfall climbed
 * north costs the Feather = Progressive Swim ×2, a cliff face refuses). One fixture, a waterfall column:
 *
 *     (1,0)  entered moving N: no entry at all (a face)
 *     (1,1)  entered moving N: Has(Progressive Swim, 2); moving S: free
 *     (1,2)  the entrance
 *
 * Native `step` / `whyBlocked` and the SCRIPTED step (`tile.entry` + the helper conditions) must agree at every
 * inventory; a pushed block never crosses a gated entry.
 */
import { describe, it, expect } from 'vitest';
import {
    deserializeMazeWorld, createState, step, whyBlocked, serializeMazeEntities, checkEntryGates,
} from './mazeRoomEngine.js';
import { scriptedStep } from './tileSpike/tileStep.js';
import { regionItems, regionLevels } from './tileSpike/deriveTileLogic.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };

const SWIM = 'Progressive Swim';
const FEATHER = { rule: 'Has', args: { item_name: SWIM, count: 2 } };
const sidecar = (extra = {}) => ({
    width: 3,
    height: 3,
    tiles: new Array(9).fill(0),
    entrance: { x: 1, y: 2 },
    exits: [],
    obstacles: [],
    items: [],
    obstacleLib: { feather: { id: 'feather', name: 'feather', clear_set_type: 'rule', clear_rule: FEATHER } },
    entry_gates: [{ x: 1, y: 1, dir: 'N', gate: 'feather' }, { x: 1, y: 0, dir: 'N', gate: null }],
    ...extra,
});
const swims = (n) => (n === 0 ? new Set() : new Map([[SWIM, n]]));
const at = (world, x, y, inventory) => {
    const s = createState(world);
    s.player_pos = { x, y };
    s.inventory = inventory;
    return s;
};

describe('entry gates — the engine primitive', () => {
    const world = deserializeMazeWorld(sidecar());

    it('climbing the fall needs two Swims; going down is free', () => {
        for (const [n, open] of [[0, false], [1, false], [2, true]]) {
            expect(step(world, at(world, 1, 2, swims(n)), 'N') !== null, `${n} Swim(s) moving N`).toBe(open);
        }
        expect(step(world, at(world, 1, 0, swims(0)), 'S')?.player_pos).toEqual({ x: 1, y: 1 });
        // the gate is on ENTERING moving N only: stepping into (1,1) from the side is free
        expect(step(world, at(world, 0, 1, swims(0)), 'E')?.player_pos).toEqual({ x: 1, y: 1 });
    });

    it('a null gate refuses that way in at every inventory, and only that way', () => {
        expect(step(world, at(world, 1, 1, swims(2)), 'N')).toBeNull();
        expect(step(world, at(world, 0, 0, swims(0)), 'E')?.player_pos).toEqual({ x: 1, y: 0 });
    });

    it('whyBlocked names the gate, and agrees with step', () => {
        expect(whyBlocked(world, at(world, 1, 2, swims(1)), 'N')).toMatch(/^entry into \(1,1\) moving N is shut — feather is shut/);
        expect(whyBlocked(world, at(world, 1, 1, swims(2)), 'N')).toBe('no entry into (1,0) moving N');
        expect(whyBlocked(world, at(world, 1, 2, swims(2)), 'N')).toBeNull();
    });

    it('a pushed block never crosses a gated entry', () => {
        const w = deserializeMazeWorld(sidecar({ blocks: [{ x: 1, y: 1 }] }));
        const s = at(w, 1, 2, swims(2));
        expect(step(w, s, 'N')).toBeNull();
        expect(whyBlocked(w, s, 'N')).toMatch(/block at \(1,1\) cannot move: \(1,0\) is gated moving N/);
    });

    it('the SCRIPTED step agrees with the native one at every inventory and move', () => {
        const blocked = deserializeMazeWorld(sidecar({ blocks: [{ x: 1, y: 0 }] }));
        for (const w of [world, blocked]) {
            for (let y = 0; y < 3; y += 1) {
                for (let x = 0; x < 3; x += 1) {
                    for (const n of [0, 1, 2]) {
                        for (const input of ['N', 'S', 'E', 'W']) {
                            const s = at(w, x, y, swims(n));
                            const native = step(w, s, input);
                            const scripted = scriptedStep(w, s, input, HELPERS, undefined, { latch: false }).next;
                            expect(scripted?.player_pos ?? null, `(${x},${y}) ${n} Swim(s) ${input}`).toEqual(native?.player_pos ?? null);
                        }
                    }
                }
            }
        }
    });

    it('the search axis reads the gates\' items and counts', () => {
        expect(regionItems(world)).toEqual([SWIM]);
        expect(regionLevels(world)).toEqual(new Map([[SWIM, new Set([2])]]));
    });

    it('round-trips through serializeMazeEntities, and refuses a bad list by name', () => {
        expect(serializeMazeEntities(world).entry_gates).toEqual(sidecar().entry_gates);
        const lib = sidecar().obstacleLib;
        expect(() => checkEntryGates([{ x: 1, y: 1, dir: 'NE', gate: null }], lib, 3, 3, 't')).toThrow(/dir "NE"/);
        expect(() => checkEntryGates([{ x: 1, y: 1, dir: 'N', gate: 'nope' }], lib, 3, 3, 't')).toThrow(/gate "nope"/);
        expect(() => checkEntryGates([{ x: 3, y: 1, dir: 'N', gate: null }], lib, 3, 3, 't')).toThrow(/not a cell/);
        expect(() => checkEntryGates([{ x: 1, y: 1, dir: 'N', gate: null }, { x: 1, y: 1, dir: 'N', gate: 'feather' }], lib, 3, 3, 't'))
            .toThrow(/twice/);
    });

    it('a sidecar without entry_gates is unchanged (no gate map at all)', () => {
        const plain = deserializeMazeWorld(sidecar({ entry_gates: undefined }));
        expect(plain.entryGates).toBeUndefined();
        expect(step(plain, at(plain, 1, 1, swims(0)), 'N')?.player_pos).toEqual({ x: 1, y: 0 });
        expect(serializeMazeEntities(plain).entry_gates).toBeUndefined();
    });
});
