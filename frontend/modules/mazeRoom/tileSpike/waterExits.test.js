/**
 * ⛓ WATER EXITS (session tile-primitives-water-exits, ⚖ 2026-10-25 "Level world + step gates", "Lay the grid's own
 * cell", "Same entry-gate primitive") — the projection's soundness rows the counted-rules slice unmasked, each on its
 * own level compiled alone and held to the certifier (every witness replayed on the engine):
 *   - WATER EXIT TILES (L89, L115, L54): crossings out of one sub-region shared one water cell; the first exit kept the
 *     name, the last crossing's rule the gate — L89 r11c12 → r1c10 and L115 r8c2 → r2c2 asked one Swim where AP asks
 *     two (LOOSER). The Swim×2 is a WATERFALL climbed north (the Feather). Such a level is a level world now, its
 *     waterfalls ENTRY GATES;
 *   - UNLAID CROSSINGS (L53, L71): a room-clear lock (tset -1, no button) was walled; its cell is laid as the grid has it;
 *   - L0's islands: joined by two waterfall cells the level world had walled.
 * And the level-world flaws the conversion exposed (L58, L0, L19): an arrival placed off its sub-region's own ground,
 * an exit tile's rule replacing its terrain gate, a pit taken from another sub-region, a strike made on the arrival
 * exit, a door inside an untranscribed building, a latched lock's closed side.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlaythroughMaze } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { playthroughGridFor, PLAYTHROUGH_MAP, playthroughAnalyzerOptions } from '../../../../scripts/procgen/make-seedling-playthrough-rules.mjs';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
const SWIM = 'Progressive Swim';
const has = (item, count) => ({ rule: 'Has', args: { item_name: item, ...(count ? { count } : {}) } });
const compiled = new Map();
const compile = (levels) => {
    const key = levels.join(',');
    if (!compiled.has(key)) compiled.set(key, JSON.parse(buildPlaythroughMaze({ levels }).text));
    return compiled.get(key);
};
const certify = (levels) => certifyPlaythroughMaze(compile(levels), HELPERS, { native: true, atlas: ATLAS });
const line = (out, prefix) => out.lines.find((l) => l.startsWith(prefix))?.slice(prefix.length);
const carrier = (rules, level) => Object.values(rules.preset_sidecars['1'])
    .find((s) => s.playable_payload?.atlas_region === level).playable_payload;
const gateAt = (payload, x, y) => payload.obstacleLib[payload.obstacles.find((o) => o.x === x && o.y === y)?.id]?.clear_rule;
const entryGate = (payload, x, y, dir) => {
    const g = payload.entry_gates?.find((e) => e.x === x && e.y === y && e.dir === dir);
    return g === undefined ? undefined : g.gate === null ? null : payload.obstacleLib[g.gate].clear_rule;
};

describe('water exit tiles — LOOSER first', () => {
    it('L89 r11c12 → r1c10 needs two Swims in the world, as AP says; the level certifies clean', () => {
        const out = certify(['level_89']);
        expect(out.problems).toEqual([]);
        expect(line(out, 'level_89__r11c12>level_89__r1c10=')).toBe(JSON.stringify([[SWIM, SWIM]]));
        expect(line(out, 'level_89__r11c12>level_89__r4c4=')).toBe(JSON.stringify([[SWIM]]));
    });

    it('L115 r8c2 → r2c2 likewise; the level certifies clean', () => {
        const out = certify(['level_115']);
        expect(out.problems).toEqual([]);
        expect(line(out, 'level_115__r8c2>level_115__r2c2=')).toBe(JSON.stringify([[SWIM, SWIM]]));
    });

    it('L54 (every crossing had been "not priced") certifies clean', () => {
        expect(certify(['level_54']).problems).toEqual([]);
    });

    it('the Swim×2 is the waterfall, climbed north: an entry gate of the level world', () => {
        const p = carrier(compile(['level_89']), 'level_89');
        expect(p.shared_world.key).toBe('level_89');
        const grid = playthroughGridFor(PLAYTHROUGH_MAP.levels.find((l) => l.level === 89));
        const falls = grid.cells.map((c, i) => [c, i]).filter(([c]) => c.labels?.includes('waterfall'));
        expect(falls.length).toBeGreaterThan(0);
        for (const [, i] of falls) {
            const [x, y] = [i % grid.width, Math.floor(i / grid.width)];
            if (p.tiles[(y - 1) * p.width + x] !== 0) continue;
            expect(entryGate(p, x, y - 1, 'N'), `climbing out of the fall at (${x},${y})`).toEqual(has(SWIM, 2));
            expect(entryGate(p, x, y - 1, 'S')).toBeUndefined();
        }
    });
});

describe('crossings the world never laid: room-clear locks are laid as the grid has their cells', () => {
    for (const [level, [x, y]] of [['level_53', [9, 13]], ['level_71', [7, 12]]]) {
        it(`${level} (${x},${y}) is floor carrying the grid's own gate, and the level certifies clean`, () => {
            const p = carrier(compile([level]), level);
            expect(p.tiles[y * p.width + x]).toBe(0);
            const grid = playthroughGridFor(PLAYTHROUGH_MAP.levels.find((l) => l.level === Number(level.slice(6))));
            const [cond] = grid.cells[y * grid.width + x].conditions;
            expect(gateAt(p, x, y)).toEqual(playthroughAnalyzerOptions.resolveCondition(cond));
            expect(certify([level]).problems).toEqual([]);
        });
    }
});

describe('L0: the islands are one world', () => {
    const p = carrier(compile(['level_0']), 'level_0');

    it('its two waterfall cells are floor: down free, up with two Swims', () => {
        for (const x of [13, 16]) {
            expect(p.tiles[7 * p.width + x]).toBe(0);
            expect(entryGate(p, x, 7, 'N'), `(${x},7) entered from below`).toEqual(has(SWIM, 2));
            expect(entryGate(p, x, 8, 'S')).toBeUndefined();
        }
    });

    it('certifies clean, r11c19 striking its event rock from the arrival exit', () => {
        const out = certify(['level_0']);
        expect(out.problems).toEqual([]);
        // the arrival IS r11c19's exit to L12; a strike there is not a walk onto it
        expect(JSON.parse(line(out, 'level_0__r11c19>level_0__r7c6='))).toContainEqual(['Ghost Spear']);
    });

    // ⛓ tile-primitives-pixelmask-l86: building1's Pixelmask leaves its doorway clear, so the door is floor — nothing is carved.
    it('its door to L86, in building1\'s doorway, is reached and priced', () => {
        const out = certify(['level_0', 'level_86']);
        expect(out.problems.filter((q) => q.startsWith('level_0'))).toEqual([]);
        expect(line(out, 'level_0__r7c6->level_86=')).toBe('[[]]');
    });
});

describe('the level-world flaws the conversion exposed (L58, L19)', () => {
    const p = carrier(compile(['level_58']), 'level_58');

    it('an arrival is on its sub-region\'s own ground: never its pit, never its exit in the water', () => {
        expect(p.shared_world.entrances.level_58__r1c4).toEqual({ x: 4, y: 1 });
        expect(p.shared_world.entrances.level_58__r4c1).not.toEqual({ x: 3, y: 7 });
    });

    it('r1c4\'s pit (to L46) is taken from r1c4 only; a teleporter in the water still costs the Swim', () => {
        const wired = carrier(compile(['level_46', 'level_57', 'level_58']), 'level_58');
        expect(entryGate(wired, 5, 1, 'N')).toBeNull(); // from r2c5's (5,2)
        expect(entryGate(wired, 5, 1, 'E')).toBeUndefined(); // from r1c4's own (4,1)
        expect(gateAt(wired, 4, 7).children).toContainEqual(has(SWIM)); // r6c5's teleporter to L57
    });

    // ⛓ tile-primitives-sphere-order-7: alone, L58's talk gates nothing (its crossing to L46 is unwired), so it is not carried
    // (`eventLayerFor`); with L46 listed it is, and the certifier names it.
    it('certifies clean alone, and with L46 with only the named talk left (the yeti)', () => {
        expect(certify(['level_58']).problems).toEqual([]);
        expect(certify(['level_46', 'level_58']).problems.filter((p) => p.startsWith('level_58__r3c3: location'))).toEqual([
            'level_58__r3c3: location L58 flag 1: yeti@56,56 cleared is not priced — the maze world cannot produce it (a talk)',
        ]);
    });

    it('L19\'s latched boss lock: its closed side costs the lock\'s event', () => {
        const l19 = carrier(compile(['level_19']), 'level_19');
        const E = 'L19 flag 1: bosslock@48,32 cleared';
        // (3,2) is open moving N (from (3,3)); its one other floor neighbour is (3,1), above — entered moving S
        expect(entryGate(l19, 3, 2, 'S')).toEqual(has(E));
        expect(entryGate(l19, 3, 2, 'N')).toBeUndefined();
    });
});
