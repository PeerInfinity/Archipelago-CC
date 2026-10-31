/**
 * ⛓⛓ ANNOTATED PUZZLE LOCKS (session tile-mechanisms-m2-w1, ⚖ user 2026-10-31 "Fallback, build here"): the maze does not play a
 * puzzle — the LOCK it opens carries the side it unlocks from and what completing the puzzle requires, as `enter` gates on the
 * lock's cell (`make-seedling-playthrough-maze.mjs` `puzzleLocksFor` / `playthroughPuzzleLockGridFor`). Pinned here: the verdicts
 * it reads, L40's one lock and its grid, what the compiled L40 world does with it, and every refusal by name.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    puzzleLockVerdicts, puzzleLocksFor, playthroughPuzzleLockGridFor,
} from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { PLAYTHROUGH_MAP, playthroughHandRuledGridFor, playthroughGridFor } from '../../../../scripts/procgen/make-seedling-playthrough-rules.mjs';
import { L40_EAST_RULE } from '../../flashPanel/seedlingPlaythroughOverlay.js';
import { deserializeMazeWorld } from '../mazeRoomEngine.js';
import { nativeReachUnder, enteredAt } from './deriveLevelWorldLogic.js';

const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
const PARTITION = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-subregion-partition.json', import.meta.url), 'utf8'))
    .atlases[ATLAS.atlas_id];
const RULES = JSON.parse(readFileSync(new URL('../../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
const L40 = PLAYTHROUGH_MAP.levels.find((l) => l.level === 40);
const L40_ARRIVALS = ATLAS.regions.find((r) => r.region_id === 'level_40').exits.map((e) => e.entrance_tile);
const at = (grid, x, y) => grid.cells[(y - grid.origin.y) * grid.width + (x - grid.origin.x)];

describe('the verdicts and L40\'s lock', () => {
    it('reads the rules producer\'s verdicts that name their lock — today exactly one, L40_EAST_RULE', () => {
        expect(puzzleLockVerdicts()).toEqual([L40_EAST_RULE]);
    });

    it('L40: wandlock@512,480 at (32,30) unlocks from the WEST (its t2 holder\'s side), priced Fire AND a weapon', () => {
        const locks = puzzleLocksFor(L40, playthroughHandRuledGridFor(L40), { arrivals: L40_ARRIVALS });
        expect(locks).toEqual([{ door: 'wandlock@512,480', x: 32, y: 30, opensFrom: ['W'], requires: L40_EAST_RULE.condition, group: 2 }]);
    });

    it('the grid: the lock\'s cell gates both moves through it; the interior piece (30,30) reverts; the crossing piece and the tree keep the ruling', () => {
        const grid = playthroughPuzzleLockGridFor(L40, { atlas: ATLAS, partition: PARTITION });
        const hand = playthroughHandRuledGridFor(L40);
        const base = playthroughGridFor(L40);
        expect(at(grid, 32, 30).enter).toEqual({ N: null, S: null, E: [L40_EAST_RULE.condition], W: [L40_EAST_RULE.condition] });
        expect(at(grid, 32, 30).puzzle_lock).toEqual({ door: 'wandlock@512,480', opens_from: ['W'] });
        expect(at(grid, 30, 30)).toEqual(at(base, 30, 30));           // the fire block's own cell: Fire, the analyzer's
        expect(at(hand, 30, 30)).not.toEqual(at(base, 30, 30));       // ... which the hand ruling had raised (non-vacuous)
        for (const [x, y] of [[36, 36], [55, 49], [55, 50]]) expect(at(grid, x, y)).toEqual(at(hand, x, y));
        // Every other level's grid is the hand-ruled one, untouched.
        const l39 = PLAYTHROUGH_MAP.levels.find((l) => l.level === 39);
        expect(playthroughPuzzleLockGridFor(l39, { atlas: ATLAS, partition: PARTITION })).toEqual(playthroughHandRuledGridFor(l39));
    });

    it('the compiled L40 world: from r23c29\'s arrival the east half behind (32,30) takes Fire AND a weapon, and (30,30) Fire alone', () => {
        const world = deserializeMazeWorld(RULES.preset_sidecars['1'].level_40__r0c53.playable_payload);
        const from = enteredAt(world, 'level_40__r23c29');
        const reaches = (items, cell) => nativeReachUnder(from, items).cells.has(cell);
        const EAST = '33,30';
        expect(reaches(['Fire'], EAST)).toBe(false);
        expect(reaches(['Progressive Sword'], EAST)).toBe(false);
        expect(reaches(['Fire', 'Progressive Sword'], EAST)).toBe(true);
        expect(reaches(['Fire', 'Ghost Spear'], EAST)).toBe(true);
        expect(reaches(['Fire'], '30,30')).toBe(true);
        expect(reaches([], '30,30')).toBe(false);
    });
});

/**
 * A gadget level read from a picture, its grid and its groups: `#` wall, `.` floor, `h` the holder (a button of group 0),
 * `D` the lock (`wandlock`, group 0), `a` an arrival. The tiles are map tiles of 16 px.
 */
function gadget(rows, { latching = false, group = 0, verdictTile = null } = {}) {
    const find = (ch) => {
        const out = [];
        rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) out.push([x, y]); }));
        return out;
    };
    const [[dx, dy]] = find('D');
    const level = { level: 900, entities: [{ type: 'wandlock', x: dx * 16, y: dy * 16, attrs: { tset: String(group) } }] };
    const grid = {
        width: rows[0].length, height: rows.length, origin: { x: 0, y: 0 },
        cells: rows.flatMap((r) => [...r].map((c) => (c === '#' ? { kind: 'wall', conditions: [] } : c === 'D'
            ? { kind: 'directional', conditions: [], enter: { N: null, S: null } } : { kind: 'open', conditions: [] }))),
    };
    const groups = new Map([['900:0', { latching, holders: find('h') }]]);
    const verdicts = [{ level: 900, door: `wandlock@${dx * 16},${dy * 16}`, tile: verdictTile ?? [dx, dy], condition: { flag: 'hasFire' } }];
    return { level, grid, groups, verdicts, arrivals: find('a') };
}
const locks = (g) => puzzleLocksFor(g.level, g.grid, g);

describe('refused by name', () => {
    it('a gadget with its arrival on the opener side is laid (the control)', () => {
        expect(locks(gadget(['#######', '#ah.D.#', '#######']))).toEqual([
            { door: 'wandlock@64,16', x: 4, y: 1, opensFrom: ['W'], requires: { flag: 'hasFire' }, group: 0 },
        ]);
    });

    it('an arrival on the FAR side meets the lock shut — per-visit opening is not built', () => {
        expect(() => locks(gadget(['#######', '#.h.D.a', '#######']))).toThrow(/arrival \(6,1\) stands on its E side, where the lock is shut/);
    });

    it('a group that LATCHES (a ButtonRoom, a rope) is the owed in-level latch', () => {
        expect(() => locks(gadget(['#######', '#ah.D.#', '#######'], { latching: true }))).toThrow(/t0 LATCHES/);
    });

    it('a lock no holder reaches', () => {
        expect(() => locks(gadget(['#######', '#a..D.#', '#######']))).toThrow(/no side of it reaches a holder of t0/);
    });

    it('a verdict whose tile is not its entity\'s, and one naming no entity', () => {
        expect(() => locks(gadget(['#######', '#ah.D.#', '#######'], { verdictTile: [3, 1] }))).toThrow(/stands on \(4,1\), the verdict says \(3,1\)/);
        const g = gadget(['#######', '#ah.D.#', '#######']);
        g.verdicts[0].door = 'lock@64,16';
        expect(() => locks(g)).toThrow(/names no entity of L900/);
    });

    it('a group with no opener in its level', () => {
        expect(() => locks(gadget(['#######', '#ah.D.#', '#######'], { group: 3 }))).toThrow(/group t3 has no opener in L900/);
    });
});
