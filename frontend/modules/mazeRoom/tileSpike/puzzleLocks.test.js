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

    it('a hand verdict on a lock the analyzer\'s block paths already DECIDE (the derived price stands; a hand row only where derivation fails)', () => {
        const decided = gadget(['#######', '#ah.D.#', '#######']);
        decided.grid.lockVerdicts = [{ tiles: [[4, 1]], decided: true, why: null }];
        expect(() => locks(decided)).toThrow(/analyzer already DERIVES its price/);
        const undecided = gadget(['#######', '#ah.D.#', '#######']);
        undecided.grid.lockVerdicts = [{ tiles: [[4, 1]], decided: false, why: 'pulser-arm' }];
        expect(locks(undecided)).toHaveLength(1);                    // the control: undecided is where a hand verdict belongs
    });
});

/**
 * ⛓ tile-mechanisms-m3 (⚖ user 2026-11-01 "Pin + guard, no preset change"): THE DERIVED / HAND SPLIT. Every grouped re-closing
 * lock whose group is HELD (a Button, not a latch) is priced by the analyzer's block paths (`blockHolderVerdict` decided →
 * `cell.enter`) or, where they cannot decide, keeps the player-reach fallback; a hand verdict (`puzzleLockVerdicts`) exists only
 * on an UNDECIDED lock. m2-w1's rollout line ("L39/L41 would need rules-arc verdict rows") is overturned: both are derived.
 */
describe('the derived / hand split, over the whole map', () => {
    const RC = new Set(['lock', 'wandlock', 'grasslock']);
    const rows = [];
    for (const level of PLAYTHROUGH_MAP.levels) {
        const grid = playthroughHandRuledGridFor(level);
        for (const v of grid.lockVerdicts ?? []) {
            for (const [x, y] of v.tiles) {
                const e = (level.entities ?? []).find((n) => RC.has(n.type) && Math.floor(n.x / 16) === x && Math.floor(n.y / 16) === y);
                rows.push({ level: level.level, door: e ? `${e.type}@${e.x},${e.y}` : null, decided: v.decided, why: v.why });
            }
        }
    }
    const tag = (r) => `L${r.level} ${r.door}`;

    it('the analyzer DECIDES every held lock but L40\'s three (pulser-arm: a fire block starts beside the pulser)', () => {
        expect(rows.filter((r) => !r.decided).map((r) => `${tag(r)} ${r.why}`)).toEqual([
            'L40 wandlock@448,432 pulser-arm', 'L40 wandlock@512,480 pulser-arm', 'L40 wandlock@800,400 pulser-arm',
        ]);
        // L39's lock run + (3,10) and L41's (15,6) are derived (non-vacuous: the puzzle locks m2-w1 thought needed rows).
        const decided = rows.filter((r) => r.decided).map(tag);
        for (const d of ['L39 wandlock@144,64', 'L39 wandlock@144,48', 'L39 wandlock@144,32', 'L39 wandlock@48,160', 'L41 wandlock@240,96']) {
            expect(decided).toContain(d);
        }
    });

    it('every hand verdict sits on an undecided lock, and none on a decided one', () => {
        const undecided = new Set(rows.filter((r) => !r.decided).map(tag));
        for (const v of puzzleLockVerdicts()) expect(undecided.has(`L${v.level} ${v.door}`)).toBe(true);
    });

    it('OPEN (rules discussion after the maze arc): L40 (28,27) t2 and (50,25) t5 keep the player-reach fallback', () => {
        // Undecided and unruled: entered free from their button's side, though the player cannot hold its own button. The
        // rules and the maze agree (the certifier is clean), so this is a named divergence from the game, not a maze defect.
        const verdicts = new Set(puzzleLockVerdicts().map((v) => `L${v.level} ${v.door}`));
        expect(['L40 wandlock@448,432', 'L40 wandlock@800,400'].filter((d) => !verdicts.has(d))).toHaveLength(2);
        const hand = playthroughHandRuledGridFor(L40);
        // ⛓ tile-rules-automation-r-a5: + `E: [flag 12]`. `E` is a step INTO (28,27) moving east, from (27,27) in the body; the
        //   player-reach price floods from the t2 button (30,24) to (27,27) without the lock, and the only such way is south
        //   through wandlock@480,560, which now costs its press (flag 12). Named, pre-existing divergence: an iceturret corpse on
        //   the button would hold it, but the holder census counts no enemy (⚖ "Enemies don't count", 2026-10-20).
        expect(at(hand, 28, 27).enter).toEqual({ N: null, S: null, E: [{ event: 'L40 flag 12: wandlock@480,560 cleared' }] });
        expect(at(hand, 50, 25).enter).toEqual({ S: null });
    });
});
