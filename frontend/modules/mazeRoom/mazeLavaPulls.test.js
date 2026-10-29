/**
 * PULLS in the engine (session tile-primitives-sphere-order-9, ⚖ 2026-10-29 "Forced pull, rules' disc"): a trap reels
 * the player onto its own cell — Seedling's LavaTrap (`LavaTrap.as:22,56-90`), whose tongue grabs within 32 px, crosses
 * lava or a pit, releases the player holding the Dark Suit, and re-arms only once the player is out of range. A move
 * from OUTSIDE a disc into it, holding the gate, ends on the trap's cell; an arrival inside it is not pulled until it
 * has left. The scripted step agrees with the native one on every reachable state.
 */

import { describe, it, expect } from 'vitest';
import {
    createWorld, setTile, TILE_WALL, createState, step, whyBlocked, mazeVisitedKey, worldInputs, INPUT_E, INPUT_W,
    checkPulls, pullAfterMove, serializeMazeEntities, deserializeMazeWorld, setItem,
} from './mazeRoomEngine.js';
import { scriptedStep } from './tileSpike/tileStep.js';
import { regionItems } from './tileSpike/deriveTileLogic.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };

const SUIT = 'Dark Suit';
const GATE = Object.freeze({ id: 'pull_5_1', kind: 'pull', clear_set_type: 'rule', clear_rule: { rule: 'Has', args: { item_name: SUIT } } });
/** L80's shape in one row: the start (1,1), the disc (3,1) beyond (2,1), a pit (4,1) the tongue crosses, the trap (5,1). */
const PULL = Object.freeze({ x: 5, y: 1, from: [{ x: 3, y: 1 }, { x: 4, y: 1 }], gate: 'pull_5_1' });

function pullPicture({ start = { x: 1, y: 1 }, pulls = [PULL], exits = [{ exit_id: 'exit', x: 1, y: 2 }] } = {}) {
    const rows = ['#######', '#...#.#', '#.#####'];
    const w = createWorld(7, 3, { entrance: start, exits });
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < 7; x++) if (rows[y][x] === '#') setTile(w, x, y, TILE_WALL);
    w.obstacleLib = { ...w.obstacleLib, pull_5_1: GATE };
    w.pulls = checkPulls(pulls, w, 'test');
    return w;
}
const walk = (world, state, inputs, inv) => inputs.reduce((s, i) => {
    const n = step(world, s, i, inv);
    if (n === null) throw new Error(`refused ${i} at ${JSON.stringify(s.player_pos)}: ${whyBlocked(world, s, i, inv)}`);
    return n;
}, state);
const withInv = (state, items) => ({ ...state, inventory: new Set(items) });

describe('a trap reels the player onto its cell', () => {
    it('holding the gate, stepping into the disc lands on the trap, over the pit', () => {
        const world = pullPicture();
        const s = walk(world, withInv(createState(world), [SUIT]), [INPUT_E, INPUT_E]);
        expect(s.player_pos).toEqual({ x: 5, y: 1 });
        expect(pullAfterMove(world, { x: 2, y: 1 }, { x: 3, y: 1 }, new Set([SUIT]))).toEqual({ x: 5, y: 1 });
    });

    it('without the gate nothing happens (the rules\' bound: the disc is not lethal either)', () => {
        const world = pullPicture();
        const s = walk(world, createState(world), [INPUT_E, INPUT_E]);
        expect(s.player_pos).toEqual({ x: 3, y: 1 });
        expect(step(world, s, INPUT_E)).toBeNull(); // the pit is a wall to walk
    });

    it('an arrival inside the disc is not pulled until it has left and come back (the re-arm)', () => {
        const world = pullPicture({ start: { x: 3, y: 1 } });
        const s = withInv(createState(world), [SUIT]);
        expect(walk(world, s, [INPUT_W]).player_pos).toEqual({ x: 2, y: 1 });
        expect(walk(world, s, [INPUT_W, INPUT_E]).player_pos).toEqual({ x: 5, y: 1 });
    });

    it('a move within the disc is no pull, and the trap cell is part of the disc', () => {
        const world = pullPicture();
        expect(pullAfterMove(world, { x: 3, y: 1 }, { x: 4, y: 1 }, new Set([SUIT]))).toBeNull();
        expect(pullAfterMove(world, { x: 5, y: 1 }, { x: 4, y: 1 }, new Set([SUIT]))).toBeNull();
    });

    it('picks up on the cell it grabbed from and on the trap cell (in-room play)', () => {
        const world = pullPicture();
        setItem(world, 3, 1, 'Seal');
        setItem(world, 5, 1, 'Health');
        const s = walk(world, withInv(createState(world), [SUIT]), [INPUT_E, INPUT_E]);
        expect([...s.inventory].sort()).toEqual([SUIT, 'Health', 'Seal'].sort());
        // 'ap' mode (a fixed inventory) picks up nothing
        const ap = walk(world, createState(world), [INPUT_E, INPUT_E], new Set([SUIT]));
        expect(ap.player_pos).toEqual({ x: 5, y: 1 });
        expect(ap.inventory.size ?? ap.inventory.length).toBe(0);
    });

    it('the gate is an item of the search axis', () => {
        expect(regionItems(pullPicture())).toContain(SUIT);
    });
});

describe('overlapping discs (L108\'s ferry)', () => {
    it('released on one trap, a step into the next trap\'s disc from outside it fires that trap', () => {
        // a column: trap A (1,1) grabs (1,2); trap B (1,4) grabs (1,2), (1,3); (1,2) is in both, entered from A's cell
        const rows = ['###', '#.#', '#.#', '#.#', '#.#', '###'];
        const w = createWorld(3, 6, { entrance: { x: 1, y: 1 }, exits: [] });
        for (let y = 0; y < rows.length; y++) for (let x = 0; x < 3; x++) if (rows[y][x] === '#') setTile(w, x, y, TILE_WALL);
        w.obstacleLib = { ...w.obstacleLib, pull_5_1: GATE };
        w.pulls = checkPulls([
            { x: 1, y: 1, from: [{ x: 1, y: 2 }], gate: 'pull_5_1' },
            { x: 1, y: 4, from: [{ x: 1, y: 2 }, { x: 1, y: 3 }], gate: 'pull_5_1' },
        ], w, 'test');
        expect(walk(w, withInv(createState(w), [SUIT]), ['S']).player_pos).toEqual({ x: 1, y: 4 });
    });
});

describe('a malformed pull is refused by name', () => {
    const bad = (opts) => () => pullPicture(opts);
    it('a missing gate, a non-floor trap, a doubled cell, an exit in the disc, overlapping discs', () => {
        expect(bad({ pulls: [{ ...PULL, gate: 'nope' }] })).toThrow(/names gate "nope", which the obstacleLib does not hold/);
        expect(bad({ pulls: [{ ...PULL, x: 4 }] })).toThrow(/trap at \(4,1\) is not on floor/);
        expect(bad({ pulls: [{ ...PULL, from: [{ x: 5, y: 1 }] }] })).toThrow(/lists \(5,1\) twice \(or its own cell\)/);
        expect(bad({ exits: [{ exit_id: 'exit', x: 3, y: 1 }] })).toThrow(/grabs from the exit tile \(3,1\)/);
        // (2,1) → (3,1) enters both discs from outside both
        expect(bad({ pulls: [PULL, { ...PULL, x: 1, from: [{ x: 3, y: 1 }] }] })).toThrow(/traps at \(5,1\) and \(1,1\) both grab a step from 2,1 into 3,1/);
        expect(bad({ pulls: [{ ...PULL, from: [] }] })).toThrow(/grabs from no cell/);
    });

    it('round-trips through the sidecar', () => {
        const world = pullPicture();
        const sc = {
            width: world.width, height: world.height, tiles: [...world.tiles], entrance: world.entrance, exits: [...world.exits.values()],
            obstacles: [], items: [], obstacleLib: world.obstacleLib, ...serializeMazeEntities(world),
        };
        expect(sc.pulls).toEqual([PULL]);
        const back = deserializeMazeWorld(sc);
        expect(walk(back, withInv(createState(back), [SUIT]), [INPUT_E, INPUT_E]).player_pos).toEqual({ x: 5, y: 1 });
    });
});

describe('scripted ≡ native over every reachable state of the pull picture', () => {
    for (const [name, items] of Object.entries({ 'no suit': [], suit: [SUIT] })) {
        it(name, () => {
            const world = pullPicture();
            const start = withInv(createState(world), items);
            const seen = new Map([[mazeVisitedKey(start), start]]);
            const queue = [start];
            let pulled = 0;
            while (queue.length) {
                const s = queue.shift();
                for (const input of worldInputs(world)) {
                    const native = step(world, s, input);
                    const { next } = scriptedStep(world, s, input, HELPERS);
                    expect(next === null ? null : mazeVisitedKey(next), `${input}@${mazeVisitedKey(s)}`)
                        .toBe(native === null ? null : mazeVisitedKey(native));
                    if (native && Math.abs(native.player_pos.x - s.player_pos.x) > 1) pulled += 1;
                    if (native && !seen.has(mazeVisitedKey(native))) { seen.set(mazeVisitedKey(native), native); queue.push(native); }
                }
            }
            expect(pulled > 0).toBe(items.includes(SUIT));
        });
    }
});
