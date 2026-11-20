/**
 * ⛓⛓ rules-lavatrap-pull-line (⚖ Robert 2026-11-20 "Fix pull disc, then K"): A LAVATRAP'S PULL DISC TAKES THE GAME'S
 * CLEAR-LINE TEST, ONCE, AND RULE T READS THAT DISC.
 *
 * `LavaTrap.as:81-90`: the tongue launches when `int(FP.distance) <= chompRange` AND `!collideLine("Solid", trap, player)`.
 * `OV.lavaTrapPulls` applies both (`pullLineClear`, centre to centre, with the caller's stand-in for "Solid"); the producer's
 * `playthroughLavaTrapPulls` passes its grid's `wall` cells; rule T (`trapTongueCells`), the lifts and the maze read it.
 * Rows: the disc == the tongue disc on every committed level with a LavaTrap; the cuts by name; a wall cuts, a clear line
 * and a pit keep; the line test dropped (the mutant) reds the equality row; an omitted `solid` is refused.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { lavaTrapPulls, pullLineClear, LAVATRAP_PULL } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
import { trapTongueCells } from './seedlingTrapTongueGuard.js';
import { BLOCKING } from './seedlingHolderParking.js';
import {
    PLAYTHROUGH_MAP, playthroughGridFor, playthroughLavaTrapPulls, playthroughLavaTrapPullMap, playthroughTrapTongues,
} from './make-seedling-playthrough-rules.mjs';

const LEVELS = PLAYTHROUGH_MAP.levels;
const TRAP_LEVELS = LEVELS.filter((l) => (l.entities ?? []).some((e) => e.type === LAVATRAP_PULL.tag));
const key = ([x, y]) => `${x},${y}`;
const MAZE = JSON.parse(readFileSync(new URL('../../frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));

/**
 * THE ROW: for one level, `pulls` (a disc) is the game's tongue disc — every tile within chompRange whose centre-to-centre
 * line to the trap crosses no wall of the producer's grid — and rule T's charged cells are exactly that disc's player cells.
 * Returns the list of mismatches (empty = the row holds). The game's test is re-derived here from the grid, independently
 * of `lavaTrapPulls`' own loop.
 */
function discRow(level, pulls) {
    const grid = playthroughGridFor(level);
    const wall = (x, y) => grid.cells[y * grid.width + x]?.kind === 'wall';
    const bad = [];
    for (const p of pulls) {
        const [tx, ty] = p.tile;
        const want = [];
        for (let y = 0; y < level.height; y += 1) {
            for (let x = 0; x < level.width; x += 1) {
                if (x === tx && y === ty) continue;
                const d = Math.floor(Math.hypot((x - tx) * 16, (y - ty) * 16));
                if (d > LAVATRAP_PULL.chompRange) continue;
                if (pullLineClear([x, y], [tx, ty], 16, wall)) want.push(key([x, y]));
            }
        }
        const have = p.from.map(key);
        if (JSON.stringify([...want].sort()) !== JSON.stringify([...have].sort())) bad.push(`L${level.level} (${p.tile}) disc ${have} != game line disc ${want}`);
        // rule T reads the SAME disc: its cells (no landing / door exemption here) are the disc's player cells
        const tongue = [...trapTongueCells(p, { grid })].map((i) => key([i % grid.width, Math.floor(i / grid.width)])).sort();
        const players = have.filter((k) => { const [x, y] = k.split(',').map(Number); return !BLOCKING.has(grid.cells[y * grid.width + x].kind); }).sort();
        if (JSON.stringify(tongue) !== JSON.stringify(players)) bad.push(`L${level.level} (${p.tile}) tongue ${tongue} != disc ${players}`);
        // the game's line, cell by cell: a T-charged cell must have a clear line (the old T's own test)
        for (const k of tongue) {
            const [x, y] = k.split(',').map(Number);
            if (!pullLineClear([x, y], [tx, ty], 16, wall)) bad.push(`L${level.level} (${p.tile}) tongue cell ${k} has no clear line`);
        }
    }
    return bad;
}

describe('the pull disc is the tongue disc (one line test)', () => {
    it('the committed levels with a LavaTrap are L77, L78, L80, L108 (9 traps)', () => {
        expect(TRAP_LEVELS.map((l) => l.level)).toEqual([77, 78, 80, 108]);
        expect(TRAP_LEVELS.reduce((n, l) => n + playthroughLavaTrapPulls(l).length, 0)).toBe(9);
    });

    it('on EVERY committed level with a LavaTrap: the pull disc == the game\'s clear-line disc == rule T\'s tongue disc', () => {
        for (const level of TRAP_LEVELS) expect(discRow(level, playthroughLavaTrapPulls(level)), `L${level.level}`).toEqual([]);
    });

    it('MUTANT: the line test dropped (`solid: null`) reds the row, on the levels the wall cuts', () => {
        const red = TRAP_LEVELS.filter((l) => discRow(l, lavaTrapPulls(l, 16, { solid: null })).length > 0).map((l) => l.level);
        expect(red).toEqual([77, 78, 80]);
    });

    it('the cuts, by name (the uncut disc minus the line-cut disc): L77 (6,10); L78 (11,6), (9,8); L80 (0,14), a wall tile', () => {
        const cuts = {};
        for (const level of TRAP_LEVELS) {
            const raw = lavaTrapPulls(level, 16, { solid: null });
            const cut = playthroughLavaTrapPulls(level);
            raw.forEach((p, i) => {
                const kept = new Set(cut[i].from.map(key));
                const gone = p.from.map(key).filter((k) => !kept.has(k));
                if (gone.length) cuts[`L${level.level} (${p.tile})`] = gone;
            });
        }
        expect(cuts).toEqual({ 'L77 (6,12)': ['6,10'], 'L78 (9,6)': ['11,6', '9,8'], 'L80 (2,14)': ['0,14'] });
        // L80's (0,14) is a wall: no player stands there (the maze's `from` never carried it)
        expect(playthroughGridFor(LEVELS.find((l) => l.level === 80)).cells[14 * 10 + 0].kind).toBe('wall');
    });

    it('L108\'s ferry keeps every hop: the pit between each pair is "Tile", not "Solid" (Tile.as:24-27), so nothing is cut', () => {
        const pulls = playthroughLavaTrapPulls(LEVELS.find((l) => l.level === 108));
        const reaches = (i, t) => pulls[i].from.some((c) => c[0] === t[0] && c[1] === t[1]);
        expect([reaches(0, [8, 3]), reaches(1, [8, 6]), reaches(2, [8, 9])]).toEqual([true, true, true]);
        const grid = playthroughGridFor(LEVELS.find((l) => l.level === 108));
        for (const y of [4, 7, 10]) expect(grid.cells[y * grid.width + 8].kind, `(8,${y})`).toBe('sink');
    });

    it('rule T\'s stamped cells (L77, L78) all lie in the line-cut pull disc', () => {
        for (const n of [77, 78]) {
            const level = LEVELS.find((l) => l.level === n);
            playthroughGridFor(level);
            const disc = new Map(playthroughLavaTrapPulls(level).map((p) => [key(p.tile), new Set(p.from.map(key))]));
            for (const t of playthroughTrapTongues.get(n).traps) for (const c of t.cells) expect(disc.get(key(t.trap)).has(key(c)), `L${n} ${c}`).toBe(true);
        }
    });

    it('the maze\'s pull rows are the producer\'s disc: every `from` cell in it, and no cut cell', () => {
        const map = playthroughLavaTrapPullMap();
        let rows = 0;
        for (const s of Object.values(MAZE.preset_sidecars['1'])) {
            const pp = s.playable_payload;
            if (!pp?.pulls) continue;
            const level = pp.level ?? Number(String(pp.atlas_region).match(/^level_(\d+)/)[1]);
            for (const p of pp.pulls) {
                const disc = map.get(level).find((q) => q.tile[0] === p.x && q.tile[1] === p.y);
                for (const c of p.from) expect(disc.from.map(key), `L${level} (${p.x},${p.y})`).toContain(key([c.x, c.y]));
                rows += 1;
            }
        }
        expect(rows).toBe(9);
        const l78 = Object.values(MAZE.preset_sidecars['1']).find((s) => s.playable_payload?.shared_world?.key === 'level_78').playable_payload;
        const from96 = l78.pulls.find((p) => p.x === 9 && p.y === 6).from.map((c) => key([c.x, c.y]));
        expect(from96).not.toContain('11,6');
        expect(from96).not.toContain('9,8');
    });
});

describe('the line test, synthetic', () => {
    // '#' a Solid wall, 'p' a pit (no wall), '.' floor; the trap at T
    const room = (rows) => {
        const at = [];
        rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'T') at.push([x, y]); }));
        const level = { level: 0, width: rows[0].length, height: rows.length, entities: at.map(([x, y]) => ({ type: 'lavatrap', x: x * 16, y: y * 16 })) };
        return lavaTrapPulls(level, 16, { solid: (x, y) => rows[y]?.[x] === '#' })[0];
    };
    const has = (p, c) => p.from.some((t) => t[0] === c[0] && t[1] === c[1]);

    it('a wall-blocked cell is cut, a clear cell is kept, a pit between is kept', () => {
        const p = room([
            '.....',
            '..#..',
            '..T..',
            '..p..',
            '.....',
        ]);
        expect(has(p, [2, 0])).toBe(false); // behind the wall (2,1): cut
        expect(has(p, [2, 4])).toBe(true); //  across the pit (2,3): kept (a pit is not Solid)
        expect(has(p, [0, 2])).toBe(true); //  a clear line: kept
        expect(has(p, [1, 1])).toBe(true); //  diagonal past the wall's corner, sampled clear: kept
    });

    it('`solid: null` is the uncut disc, by name; an omitted `solid` is refused', () => {
        const level = { width: 5, height: 5, entities: [{ type: 'lavatrap', x: 32, y: 32 }] };
        expect(lavaTrapPulls(level, 16, { solid: null })[0].from).toHaveLength(12);
        expect(() => lavaTrapPulls(level)).toThrow(/pass `solid`/);
        expect(() => lavaTrapPulls(level, 16, { solid: 'walls' })).toThrow(/pass `solid`/);
    });

    it('the yields race reads the cut discs: a step into a disc only through a wall is no race', () => {
        // the overlay's race (seedlingPlaythroughOverlay.test.js): traps (0,2) and (3,3) both take (2,2) from (2,1), and (0,2),
        // whose disc the walk enters second, YIELDS that step. A wall at (1,2) cuts (2,2) from (0,2): no race is left there.
        const at = (x, y) => ({ type: 'lavatrap', x: x * 16, y: y * 16 });
        const level = { width: 5, height: 6, entities: [at(0, 2), at(3, 3)] };
        const step = { from: [2, 1], to: [2, 2] };
        const open = lavaTrapPulls(level, 16, { solid: null });
        expect(open[0].yields).toContainEqual(step);
        const walled = lavaTrapPulls(level, 16, { solid: (x, y) => x === 1 && y === 2 });
        expect(walled[0].from.some((t) => t[0] === 2 && t[1] === 2)).toBe(false);
        expect(walled[0].yields).not.toContainEqual(step);
        expect(walled[1].from.some((t) => t[0] === 2 && t[1] === 2)).toBe(true); // (3,3) still takes it, alone
    });
});
