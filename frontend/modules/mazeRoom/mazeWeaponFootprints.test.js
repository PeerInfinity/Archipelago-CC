/**
 * WEAPON FOOTPRINTS (session tile-primitives-weapon-footprints, ⚖ 2026-10-28 "Tile centre", "All 4, one slice"). An
 * `action_lib` entry may carry `footprint: {N, E, S, W}` → `[[dx, dy]…]`, the cells a use hits from the player's tile;
 * absent, a use hits the faced cell (every world before this slice). The footprints are DERIVED
 * (`flashPanel/seedlingWeaponFootprints.js`) from the bot's game-measured hit tests at the tile-centre stance.
 */
import { describe, it, expect } from 'vitest';
import {
    createState, step, whyBlocked, useInput, turnInput, strikeTargets, checkActionLib, checkBlockStrike,
    deserializeMazeWorld, serializeMazeEntities, blockWithinReach, strikePushes, effectiveInventory,
} from './mazeRoomEngine.js';
import { scriptedStep } from './tileSpike/tileStep.js';
import { nativeReachUnder } from './tileSpike/deriveLevelWorldLogic.js';
import { reachUnder } from './tileSpike/deriveTileLogic.js';
import HELPERS from './tileSpike/maze_tiles.helpers.json' with { type: 'json' };
import { itemActionPicture, SWORD, SWORD_ACTION_LIB } from './mazeItemActions.fixtures.js';
import {
    weaponFootprint, deriveWeaponFootprint, WEAPON_FOOTPRINT_KINDS, FOOTPRINT_TARGETS,
} from '../flashPanel/seedlingWeaponFootprints.js';

const SWORD_FP = weaponFootprint('sword');
const SPEAR_FP = weaponFootprint('spear');
const withFootprint = (fp) => ({ sword: { ...SWORD_ACTION_LIB.sword, footprint: fp } });

describe('the derived footprints (Player.as through the bot\'s hit tests, tile-centre stance)', () => {
    it('sword: the faced cell, its two diagonals and the two SIDE cells', () => {
        expect(SWORD_FP.E).toEqual([[0, -1], [1, -1], [1, 0], [0, 1], [1, 1]]);
        expect(SWORD_FP.N).toEqual([[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]]);
    });
    it('ghost sword: the sword\'s five — its ×2 width adds no cell from the centre', () => {
        expect(weaponFootprint('ghostsword')).toEqual(SWORD_FP);
    });
    it('spear: two cells straight ahead (the old block reach 2)', () => {
        expect(SPEAR_FP).toEqual({ N: [[0, -2], [0, -1]], E: [[1, 0], [2, 0]], S: [[0, 1], [0, 2]], W: [[-2, 0], [-1, 0]] });
    });
    it('fire: all eight neighbours, whatever the facing', () => {
        const ring = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
        expect(weaponFootprint('fire')).toEqual({ N: ring, E: ring, S: ring, W: ring });
    });
    it('one footprint per action over every target class (rock, rope, block)', () => {
        for (const a of ['sword', 'ghostsword', 'spear', 'fire']) {
            for (const cls of Object.keys(FOOTPRINT_TARGETS)) expect(deriveWeaponFootprint(a, cls)).toEqual(weaponFootprint(a));
        }
    });
    it('every maze target is exempt from the slash\'s line test (Solid / Rope)', () => {
        expect(Object.values(FOOTPRINT_TARGETS).map((t) => t.type).every((t) => ['Solid', 'Rope'].includes(t))).toBe(true);
    });
    it('the wand is a named ray, not a footprint; an unknown action and target class are refused by name', () => {
        expect(WEAPON_FOOTPRINT_KINDS.wand).toMatch(/^ray/);
        expect(() => weaponFootprint('wand')).toThrow(/"wand" is a ray/);
        expect(() => weaponFootprint('boomerang')).toThrow(/"boomerang" is no Seedling weapon/);
        expect(() => deriveWeaponFootprint('sword', 'enemy')).toThrow(/target class "enemy"/);
    });
});

describe('action_lib footprint — checked, round-tripped', () => {
    it('refuses a bad shape by name', () => {
        const bad = (fp) => () => checkActionLib(withFootprint(fp), 't');
        expect(bad([])).toThrow(/footprint must be an object/);
        expect(bad({ N: [[0, -1]], E: [[1, 0]], S: [[0, 1]] })).toThrow(/footprint\.W/);
        expect(bad({ ...SWORD_FP, E: [[1, 0.5]] })).toThrow(/footprint\.E/);
        expect(bad({ ...SWORD_FP, E: [[0, 0]] })).toThrow(/the player's own cell/);
        expect(bad({ ...SWORD_FP, E: [[1, 0], [1, 0]] })).toThrow(/names a cell twice/);
        expect(() => checkActionLib(withFootprint(SWORD_FP), 't')).not.toThrow();
    });
});

/** The player at (3,2) facing E; rocks on the two SIDE cells (3,1) (3,3) and the faced cell's diagonal (4,1). */
const SIDES = [
    '#######',
    '#..r..#',
    '#P....#',
    '#..r..#',
    '#######',
];

describe('a use hits every struck obstacle in its footprint', () => {
    const at = (w, pos, facing, items = [SWORD]) => {
        const s = createState(w);
        s.player_pos = { ...pos };
        s.facing = facing;
        s.inventory = new Set(items);
        return s;
    };

    it('without a footprint (every world before): the faced cell only', () => {
        const w = itemActionPicture(SIDES);
        expect(strikeTargets(w, at(w, { x: 3, y: 2 }, 'E'), 'sword')).toEqual([]);
        expect(strikeTargets(w, at(w, { x: 3, y: 2 }, 'N'), 'sword')).toEqual(['3,1']);
    });

    it('with the sword\'s footprint: both side rocks break in ONE swing facing E', () => {
        const w = itemActionPicture(SIDES, { actionLib: withFootprint(SWORD_FP) });
        const s = at(w, { x: 3, y: 2 }, 'E');
        expect(strikeTargets(w, s, 'sword')).toEqual(['3,1', '3,3']);
        const next = step(w, s, useInput('sword'));
        expect(next.broken).toEqual(['3,1', '3,3']);
        // the diagonal stance (2,2) facing E reaches (3,1) and (3,3)
        expect(strikeTargets(w, at(w, { x: 2, y: 2 }, 'E'), 'sword')).toEqual(['3,1', '3,3']);
        // facing W from (4,2): its side cells are (4,1) (4,3) and its diagonals (3,1) (3,3)
        expect(strikeTargets(w, at(w, { x: 4, y: 2 }, 'W'), 'sword')).toEqual(['3,1', '3,3']);
        // an already broken rock is not struck again
        expect(strikeTargets(w, next, 'sword')).toEqual([]);
    });

    it('native ≡ scripted on every stance × facing', () => {
        const w = itemActionPicture(SIDES, { actionLib: withFootprint(SWORD_FP) });
        for (let y = 1; y <= 3; y++) {
            for (let x = 1; x <= 5; x++) {
                if (w.obstacles.has(`${x},${y}`)) continue;
                for (const f of ['N', 'E', 'S', 'W']) {
                    const s = at(w, { x, y }, f);
                    const native = step(w, s, useInput('sword'));
                    const { next } = scriptedStep(w, s, useInput('sword'), HELPERS);
                    expect(next.broken, `${x},${y} ${f}`).toEqual(native.broken);
                }
            }
        }
    });

    it('a rope run struck on two cells at once records its ONE cut (`at`)', () => {
        const w = itemActionPicture(['#####', '#.r.#', '#.P.#', '#####'], { actionLib: withFootprint(SWORD_FP) });
        w.obstacleLib.rope = { kind: 'rope', clear_set: [['rope_tok']], struck_by: ['sword'], activates: 'rope_tok', at: '1,1' };
        w.obstacles.set('1,1', 'rope');
        w.obstacles.set('2,1', 'rope');
        w.obstacles.set('3,1', 'rope');
        const s = at(w, { x: 2, y: 2 }, 'N');
        expect(strikeTargets(w, s, 'sword')).toEqual(['1,1']);
        expect(step(w, s, useInput('sword')).broken).toEqual(['1,1']);
        expect(scriptedStep(w, s, useInput('sword'), HELPERS).next.broken).toEqual(['1,1']);
    });
});

const SPEAR = 'Ghost Spear';
const SPEAR_LIB = { spear: { item: SPEAR, primitive: 'strike', condition: 'strikes', key: 'x', footprint: SPEAR_FP } };
const blockSidecar = (rows, blockStrike) => {
    const cells = (ch) => rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === ch ? [{ x, y }] : [])));
    return {
        width: rows[0].length,
        height: rows.length,
        tiles: rows.flatMap((r) => [...r].map((c) => (c === '#' ? 1 : 0))),
        entrance: cells('P')[0],
        exits: [{ exit_id: 'exit', ...cells('P')[0] }],
        obstacles: [],
        items: [],
        obstacleLib: {},
        blocks: cells('B'),
        action_lib: SPEAR_LIB,
        block_strike: blockStrike,
    };
};

describe('struck blocks read the action\'s footprint (block_strike `reach` retired where a footprint stands)', () => {
    const LINE = ['########', '#P#B...#', '#......#', '########'];

    it('block_strike names a footprint action and no reach; reach + footprint, or neither, is refused by name', () => {
        expect(checkBlockStrike({ struck_by: ['spear'] }, SPEAR_LIB, 't')).toEqual({ struckBy: ['spear'] });
        expect(() => checkBlockStrike({ struck_by: ['spear'], reach: 2 }, SPEAR_LIB, 't')).toThrow(/reach .* footprint/);
        const bare = { spear: { ...SPEAR_LIB.spear, footprint: undefined } };
        expect(() => checkBlockStrike({ struck_by: ['spear'] }, bare, 't')).toThrow(/reach must be a positive integer/);
    });

    it('a thrust over the wall moves the block 2 cells away, as reach 2 did; round-trips without reach', () => {
        const w = deserializeMazeWorld(blockSidecar(LINE, { struck_by: ['spear'] }));
        const s = createState(w);
        s.inventory = new Set([SPEAR]);
        s.facing = 'E';
        expect(blockWithinReach(w, s, 'spear')).toBe(true);
        const inv = effectiveInventory(w, s.inventory, s.player_pos, s.blocks, s.broken);
        expect(strikePushes(w, s, 'spear', inv)).toEqual([{ from: '3,1', to: '4,1' }]);
        expect(step(w, s, useInput('spear')).blocks).toEqual(['4,1']);
        expect(scriptedStep(w, s, useInput('spear'), HELPERS).next.blocks).toEqual(['4,1']);
        expect(serializeMazeEntities(w).block_strike).toEqual({ struck_by: ['spear'] });
        const turned = step(w, step(w, s, turnInput('S')), useInput('spear'));
        expect(turned.blocks).toEqual(['3,1']);
        expect(whyBlocked(w, s, 'E')).toBeTruthy();
    });
});

/**
 * Where a footprint changes LOGIC: a target struck, never walked into — a rope, whose cut is a token. Its four
 * neighbours are walls, so no stance FACES it; the sword's diagonal reaches it from (2,2), and the cut opens the door.
 * (A rock is walked into from a neighbour that already faces it, which is why the playthrough maze's derived lines
 * did not move.)
 */
const DIAGONAL_ROPE = [
    '#######',
    '###r###',
    '#P.#..#',
    '##D####',
    '##X####',
    '#######',
];

describe('a footprint is a way the search takes', () => {
    const ropeWorld = (actionLib) => {
        const w = itemActionPicture(DIAGONAL_ROPE, { actionLib });
        w.obstacleLib.rope = { kind: 'rope', clear_set: [['sw_A']], struck_by: ['sword'], activates: 'sw_A', at: '3,1' };
        w.obstacles.set('3,1', 'rope');
        return w;
    };
    it('the rope behind the corner is cut from the diagonal, so the exit is reached — and not without the footprint', () => {
        const inv = new Set([SWORD]);
        expect(nativeReachUnder(ropeWorld(withFootprint(SWORD_FP)), inv).cells.has('2,4')).toBe(true);
        expect(nativeReachUnder(ropeWorld(SWORD_ACTION_LIB), inv).cells.has('2,4')).toBe(false);
        expect(nativeReachUnder(ropeWorld(withFootprint(SWORD_FP)), new Set()).cells.has('2,4')).toBe(false);
    });
    it('the scripted search agrees', () => {
        const inv = new Set([SWORD]);
        for (const lib of [withFootprint(SWORD_FP), SWORD_ACTION_LIB]) {
            const w = ropeWorld(lib);
            expect(reachUnder(w, inv, HELPERS).cells.has('2,4')).toBe(nativeReachUnder(w, inv).cells.has('2,4'));
        }
    });
});
