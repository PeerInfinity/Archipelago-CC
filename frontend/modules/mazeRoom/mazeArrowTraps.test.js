/**
 * ARROW TRAPS + ROPES in the engine (slice tile-primitives-arrow-rope, ⚖ 2026-10-22 "New `traps`
 * primitive", "Strike the facing rope", "Both: this visit + event item"): a lane cell refuses the
 * player while its trap is armed; a rope struck down (this visit) or its event carried (an earlier
 * visit) activates the group; a held button does too. `whyBlocked` names the trap and its silencer.
 */

import { describe, it, expect } from 'vitest';
import {
    createState, step, whyBlocked, mazeVisitedKey, worldInputs, INPUT_WAIT, INPUT_N, INPUT_E, INPUT_S, INPUT_W,
    useInput, turnInput, serializeMazeEntities, deserializeMazeWorld, checkTraps, armedTrapAt, standsInArmedLane,
    effectiveInventory, ropeTokens,
} from './mazeRoomEngine.js';
import {
    arrowTrapPicture, ARROW_ROPE, ARROW_BUTTON, ROPE_EVENT, SWORD, ROCK_CORRIDOR, itemActionPicture,
} from './mazeItemActions.fixtures.js';

const walk = (world, state, inputs, inv) => inputs.reduce((s, i) => {
    const n = step(world, s, i, inv);
    if (n === null) throw new Error(`refused ${i} at ${JSON.stringify(s.player_pos)}: ${whyBlocked(world, s, i, inv)}`);
    return n;
}, state);
const withInv = (state, items) => ({ ...state, inventory: new Set(items) });

describe('the rope lane (L16 shape)', () => {
    const world = arrowTrapPicture(ARROW_ROPE);

    it('the lane refuses the player while armed, and says what silences it', () => {
        const s = walk(world, createState(world), [INPUT_E]);
        expect(s.player_pos).toEqual({ x: 2, y: 2 });
        expect(step(world, s, INPUT_E)).toBeNull();
        expect(whyBlocked(world, s, INPUT_E))
            .toBe('arrow lane of trap@3,1 is armed — cut rope@c at (1,1) (sword)');
    });

    it('a strike on the facing rope cuts it THIS visit and silences the lane', () => {
        const s0 = withInv(createState(world), [SWORD]);
        const cut = walk(world, s0, [turnInput('N'), useInput('sword')]);
        expect(cut.broken).toEqual(['1,1']);
        const across = walk(world, cut, [INPUT_E, INPUT_E, INPUT_E, INPUT_E, INPUT_E]);
        expect(across.player_pos).toEqual({ x: 6, y: 2 });
    });

    it('the carried EVENT (cut on an earlier visit) silences it with nothing broken', () => {
        const s = withInv(createState(world), [ROPE_EVENT]);
        expect(walk(world, s, [INPUT_E, INPUT_E, INPUT_E, INPUT_E, INPUT_E]).player_pos).toEqual({ x: 6, y: 2 });
        // …and through the override too, as the panel steps with stateManager's inventory.
        expect(step(world, walk(world, createState(world), [INPUT_E]), INPUT_E, new Set([ROPE_EVENT]))).not.toBeNull();
    });

    it('a cut opens the rope cell itself (a struck obstacle)', () => {
        const s = walk(world, withInv(createState(world), [SWORD]), [turnInput('N'), useInput('sword')]);
        expect(step(world, s, INPUT_N).player_pos).toEqual({ x: 1, y: 1 });
    });

    it('ropeTokens / effectiveInventory: per-visit cut and carried event both latch the token', () => {
        expect(ropeTokens(world, new Set(), [])).toBeNull();
        expect(ropeTokens(world, new Set(), ['1,1'])).toEqual(['sw_A']);
        expect(ropeTokens(world, new Set([ROPE_EVENT]), [])).toEqual(['sw_A']);
        expect(effectiveInventory(world, new Set(), { x: 1, y: 2 }, undefined, ['1,1']).has('sw_A')).toBe(true);
        // A world without ropes allocates nothing (the caller's own Set comes back).
        const plain = itemActionPicture(ROCK_CORRIDOR);
        const inv = new Set();
        expect(ropeTokens(plain, inv, [])).toBeNull();
        expect(effectiveInventory(plain, inv, { x: 1, y: 1 }, undefined, [])).toBe(inv);
    });

    it('an arrival IN an armed lane stands in it (⚖ never expect tanking a hit)', () => {
        const inLane = { ...createState(world), player_pos: { x: 3, y: 2 } };
        expect(standsInArmedLane(world, inLane)).toBe(true);
        expect(standsInArmedLane(world, withInv(inLane, [ROPE_EVENT]))).toBe(false);
        expect(standsInArmedLane(world, inLane, new Set([ROPE_EVENT]))).toBe(false);
        expect(standsInArmedLane(itemActionPicture(ROCK_CORRIDOR), createState(itemActionPicture(ROCK_CORRIDOR)))).toBe(false);
    });
});

describe('a button group (L67 / L4-5-8 shapes)', () => {
    it("'unless_active': standing on the button does not carry the silence off it; a BLOCK holds it", () => {
        const world = arrowTrapPicture(ARROW_BUTTON);
        const s = walk(world, createState(world), [INPUT_E, INPUT_E, INPUT_E]);
        expect(s.player_pos).toEqual({ x: 4, y: 1 });
        expect(whyBlocked(world, s, INPUT_E)).toBe('arrow lane of trap@5,1 is armed — hold button_A');
        // Push the block onto the button, walk round it: the lane is silent.
        const held = walk(world, createState(world), [INPUT_S, INPUT_E, INPUT_S, INPUT_E, INPUT_E, INPUT_N, INPUT_E, INPUT_E]);
        expect(held.blocks).toEqual(['3,2']);
        expect(held.player_pos).toEqual({ x: 6, y: 2 });
    });

    it("'while_active': the lane is quiet until the group is pressed", () => {
        const world = arrowTrapPicture(ARROW_BUTTON, { fires: 'while_active' });
        expect(walk(world, createState(world), [INPUT_E, INPUT_E, INPUT_E, INPUT_E]).player_pos).toEqual({ x: 5, y: 1 });
        const pressed = walk(world, createState(world), [INPUT_S, INPUT_E, INPUT_S, INPUT_E, INPUT_E]);
        expect(pressed.blocks).toEqual(['3,2']);
        expect(step(world, pressed, INPUT_E)).toBeNull();
        expect(whyBlocked(world, pressed, INPUT_E)).toBe('arrow lane of trap@5,1 is armed — nothing may stand on button_A');
    });
});

describe('the trap fields', () => {
    it('round-trip through serializeMazeEntities → deserializeMazeWorld', () => {
        const world = arrowTrapPicture(ARROW_ROPE);
        const out = serializeMazeEntities(world);
        expect(out.traps).toEqual([{ x: 3, y: 1, id: 'trap_A', label: 'trap@3,1', lane: [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }] }]);
        expect(out.trapLib).toEqual({ trap_A: { kind: 'arrow_trap', active: 'sw_A', fires: 'unless_active' } });
        const back = deserializeMazeWorld({
            width: world.width, height: world.height, tiles: [...world.tiles], entrance: world.entrance,
            exits: [...world.exits.values()], obstacles: [...world.obstacles].map(([k, id]) => ({ ...JSON.parse(`{"x":${k.split(',')[0]},"y":${k.split(',')[1]}}`), id })),
            items: [], obstacleLib: world.obstacleLib, ...out,
        });
        expect(armedTrapAt(back, new Set(), 3, 2)?.label).toBe('trap@3,1');
        expect(armedTrapAt(back, new Set(['sw_A']), 3, 2)).toBeNull();
        expect(armedTrapAt(back, new Set(), 2, 2)).toBeNull();
    });

    it('a world without traps emits no trap fields', () => {
        const out = serializeMazeEntities(itemActionPicture(ROCK_CORRIDOR));
        expect('traps' in out || 'trapLib' in out).toBe(false);
    });

    it('refuses by name: an unknown fires, a missing entry, a token-less entry, a lane off the grid', () => {
        const lib = { t: { active: 'sw', fires: 'unless_active' } };
        expect(() => checkTraps([{ x: 0, y: 0, id: 't', lane: [] }], { t: { active: 'sw', fires: 'always' } }, 3, 3, 'w'))
            .toThrow(/trapLib.t.fires is "always"/);
        expect(() => checkTraps([{ x: 0, y: 0, id: 'u', lane: [] }], lib, 3, 3, 'w')).toThrow(/names "u", which trapLib does not define/);
        expect(() => checkTraps([], { t: { fires: 'while_active' } }, 3, 3, 'w')).toThrow(/names no group token/);
        expect(() => checkTraps([{ x: 0, y: 0, id: 't', lane: [{ x: 5, y: 0 }] }], lib, 3, 3, 'w')).toThrow(/lane cell/);
    });
});

/** Every reachable state of a world (all items held, so every use is tried). */
function reachableStates(world, items) {
    const start = withInv(createState(world), items);
    const seen = new Map([[mazeVisitedKey(start), start]]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
        for (const input of worldInputs(world)) {
            const next = step(world, queue[i], input);
            if (next === null) continue;
            const k = mazeVisitedKey(next);
            if (!seen.has(k)) { seen.set(k, next); queue.push(next); }
        }
    }
    return [...seen.values()];
}

describe('whyBlocked ⇔ step over every reachable (state, input) of the trap fixtures', () => {
    const CASES = {
        'rope lane, no sword': [ARROW_ROPE, 'unless_active', []],
        'rope lane, sword': [ARROW_ROPE, 'unless_active', [SWORD]],
        'button lane, unless_active': [ARROW_BUTTON, 'unless_active', []],
        'button lane, while_active': [ARROW_BUTTON, 'while_active', []],
    };
    for (const [name, [rows, fires, items]] of Object.entries(CASES)) {
        it(name, () => {
            const world = arrowTrapPicture(rows, { fires });
            const states = reachableStates(world, items);
            let laneRefusals = 0;
            for (const s of states) {
                for (const input of [...worldInputs(world), INPUT_WAIT, INPUT_W]) {
                    const legal = step(world, s, input) !== null;
                    const why = whyBlocked(world, s, input);
                    expect(`${input}@${mazeVisitedKey(s)} ${why === null}`).toBe(`${input}@${mazeVisitedKey(s)} ${legal}`);
                    if (why?.startsWith('arrow lane')) laneRefusals += 1;
                }
            }
            expect(laneRefusals).toBeGreaterThan(0);
        });
    }
});
