/**
 * LIGHTPOLES in the engine (session tile-primitives-lightpoles, ⚖ 2026-10-28 "Rope-shaped, stances"): a pole is a
 * rope-shaped obstacle laid on the DarkTrap cells its light kills, struck ONLY from its stances (`struck_from`: a cell
 * and a facing from which the spear's thrust reaches the pole's bob box) — never through its own cells, whose
 * DarkTrap `hit()` is empty. A cut this visit opens it; so does carrying its event, or the event that lights it from
 * another room (`opened_by`). The scripted step agrees with the native one on every reachable state.
 */

import { describe, it, expect } from 'vitest';
import {
    createWorld, setTile, TILE_WALL, setObstacle, createState, step, whyBlocked, mazeVisitedKey, worldInputs, INPUT_N, INPUT_S,
    useInput, turnInput, strikeTargets, stanceStrikes, ropeTokens, ropeLatch, serializeMazeEntities, deserializeMazeWorld,
} from './mazeRoomEngine.js';
import { scriptedStep } from './tileSpike/tileStep.js';
import { regionItems } from './tileSpike/deriveTileLogic.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };

const SPEAR = 'Ghost Spear';
const PRESS = 'L62 flag 0: lightpole@120,200 cleared';
const ACTIONS = Object.freeze({
    spear: Object.freeze({ item: SPEAR, primitive: 'strike', condition: 'strikes', key: 'x' }),
});

/**
 * The L62 shape: the start below, the trap (2,3) between it and the pocket (2,2) under the exit (2,1). The pole is
 * reached by a thrust N from (2,4) or S from the pocket — not from (1,4) or (3,4), and not by striking the trap cell.
 */
function polePicture({ event, openedBy } = { openedBy: PRESS }) {
    const rows = ['#####', '##.##', '##.##', '##.##', '#...#', '#####'];
    const w = createWorld(5, 6, { entrance: { x: 1, y: 4 }, exits: [{ exit_id: 'exit', x: 2, y: 1 }], actionLib: ACTIONS });
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < 5; x++) if (rows[y][x] === '#') setTile(w, x, y, TILE_WALL);
    w.obstacleLib = {
        ...w.obstacleLib,
        pole_7_12: {
            id: 'pole_7_12', kind: 'pole', clear_set: [['pole_7_12_lit']], activates: 'pole_7_12_lit', at: '2,3',
            struck_by: ['spear'], struck_from: { spear: ['2,2,S', '2,4,N'] },
            ...(event ? { event } : {}), ...(openedBy ? { opened_by: openedBy } : {}),
        },
    };
    setObstacle(w, 2, 3, 'pole_7_12');
    return w;
}
const walk = (world, state, inputs, inv) => inputs.reduce((s, i) => {
    const n = step(world, s, i, inv);
    if (n === null) throw new Error(`refused ${i} at ${JSON.stringify(s.player_pos)}: ${whyBlocked(world, s, i, inv)}`);
    return n;
}, state);
const withInv = (state, items) => ({ ...state, inventory: new Set(items) });

describe('a pole struck from its stances', () => {
    const world = polePicture();

    it('the trap cell refuses the player until the pole is lit', () => {
        const s = walk(world, createState(world), ['E']);
        expect(s.player_pos).toEqual({ x: 2, y: 4 });
        expect(step(world, s, INPUT_N)).toBeNull();
        expect(whyBlocked(world, s, INPUT_N)).toBe(`pole_7_12 is shut — light pole_7_12 (spear from a stance, or ${PRESS})`);
    });

    it('a thrust N from (2,4) lights it THIS visit and the player walks through', () => {
        const s = walk(world, withInv(createState(world), [SPEAR]), ['E', turnInput('N'), useInput('spear')]);
        expect(s.broken).toEqual(['2,3']);
        expect(walk(world, s, [INPUT_N, INPUT_N, INPUT_N]).player_pos).toEqual({ x: 2, y: 1 });
    });

    it('no other stance or facing reaches it, and a hit on the trap cell itself is nothing', () => {
        const at = (x, y, facing) => ({ ...withInv(createState(world), [SPEAR]), player_pos: { x, y }, facing });
        expect(stanceStrikes(world, at(2, 4, 'N'), 'spear')).toEqual(['2,3']);
        expect(stanceStrikes(world, at(2, 2, 'S'), 'spear')).toEqual(['2,3']);
        expect(stanceStrikes(world, at(2, 4, 'E'), 'spear')).toEqual([]);
        expect(stanceStrikes(world, at(1, 4, 'N'), 'spear')).toEqual([]);
        // a footprint covering the trap cell from (1,3)/(3,3) would strike a rope; it does not strike a pole
        const faced = { ...withInv(createState(world), [SPEAR]), player_pos: { x: 2, y: 4 }, facing: 'N' };
        const footprinted = { ...world, actionLib: { spear: { ...ACTIONS.spear, footprint: { N: [[0, -1]], E: [[1, 0]], S: [[0, 1]], W: [[-1, 0]] } } } };
        expect(strikeTargets(footprinted, { ...faced, player_pos: { x: 2, y: 2 }, facing: 'S' }, 'spear')).toEqual(['2,3']);
        footprinted.obstacleLib = { ...world.obstacleLib, pole_7_12: { ...world.obstacleLib.pole_7_12, struck_from: { spear: ['2,4,N'] } } };
        expect(strikeTargets(footprinted, { ...faced, player_pos: { x: 2, y: 2 }, facing: 'S' }, 'spear')).toEqual([]);
    });

    it('the press carried (opened_by) lights it with nothing broken; it is no event of this world', () => {
        expect(ropeLatch(world.obstacleLib.pole_7_12)).toBe(PRESS);
        expect(ropeTokens(world, new Set([PRESS]), [])).toEqual(['pole_7_12_lit']);
        const s = withInv(createState(world), [PRESS]);
        expect(walk(world, s, ['E', INPUT_N, INPUT_N, INPUT_N]).player_pos).toEqual({ x: 2, y: 1 });
        // the press is an item of the axis (carried), never a target the cut prices
        expect(regionItems(world).includes(PRESS)).toBe(true);
    });

    it('an in-room pole is its own event: carrying it latches the token, and it is an item of the axis', () => {
        const own = polePicture({ event: 'L63 flag 6: lightpole@48,272 cleared' });
        expect(ropeTokens(own, new Set(['L63 flag 6: lightpole@48,272 cleared']), [])).toEqual(['pole_7_12_lit']);
        expect(regionItems(own).includes('L63 flag 6: lightpole@48,272 cleared')).toBe(true);
    });

    it('round-trips through the sidecar and refuses a malformed struck_from by name', () => {
        const sc = {
            width: world.width, height: world.height, tiles: [...world.tiles], entrance: world.entrance, exits: [...world.exits.values()],
            obstacles: [{ x: 2, y: 3, id: 'pole_7_12' }], items: [], ...serializeMazeEntities(world),
        };
        const back = deserializeMazeWorld({ ...sc, obstacleLib: world.obstacleLib, action_lib: ACTIONS });
        expect(back.obstacleLib.pole_7_12.struck_from).toEqual({ spear: ['2,2,S', '2,4,N'] });
        const bad = (entry) => () => deserializeMazeWorld({ ...sc, obstacleLib: { pole_7_12: { ...world.obstacleLib.pole_7_12, ...entry } }, action_lib: ACTIONS });
        expect(bad({ struck_from: { sword: ['2,4,N'] } })).toThrow(/names "sword", which the entry is not struck_by/);
        expect(bad({ struck_from: { spear: ['2,4,Q'] } })).toThrow(/not an in-grid "x,y,F" stance/);
        expect(bad({ struck_from: { spear: ['9,4,N'] } })).toThrow(/not an in-grid "x,y,F" stance/);
        expect(bad({ activates: undefined })).toThrow(/needs a rope-shaped entry/);
    });
});

describe('scripted ≡ native over every reachable state of the pole picture', () => {
    for (const [name, items] of Object.entries({ 'no spear': [], spear: [SPEAR], press: [PRESS] })) {
        it(name, () => {
            const world = polePicture();
            const start = withInv(createState(world), items);
            const seen = new Map([[mazeVisitedKey(start), start]]);
            const queue = [start];
            let strikes = 0;
            while (queue.length) {
                const s = queue.shift();
                for (const input of [...worldInputs(world), INPUT_S]) {
                    const native = step(world, s, input);
                    const { next } = scriptedStep(world, s, input, HELPERS);
                    expect(next === null ? null : mazeVisitedKey(next), `${input}@${mazeVisitedKey(s)}`)
                        .toBe(native === null ? null : mazeVisitedKey(native));
                    if (native && native.broken?.length > (s.broken?.length ?? 0)) strikes += 1;
                    if (native && !seen.has(mazeVisitedKey(native))) { seen.set(mazeVisitedKey(native), native); queue.push(native); }
                }
            }
            expect(strikes > 0).toBe(items.includes(SPEAR));
        });
    }
});
