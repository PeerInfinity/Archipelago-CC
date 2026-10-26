/**
 * ⛓ SPHERE ORDER (session tile-primitives-sphere-order-1, ⚖ 2026-10-25: "Start adding levels, and the features they
 * require, in the order of the other playthrough's sphere log") — sphere 0's levels L2–L11 + L94 each needed a feature
 * the maze lacked, shown here on the level compiled with its neighbours and held to the certifier (every witness
 * replayed on the engine):
 *   - L3: the GHOST ROCK refused the compile (a strike was one item; the fusion's is an And) — ⚖ "action_lib `rule`";
 *   - L8: L8 → L9 needed Swim — the lane block is shoved into the water, where the game's block SINKS — ⚖ "Sink from grid
 *     terrain";
 *   - L94: r3c4's two cells are joined by a CLIFFSIDE the per-sub-region world walled — ⚖ "Entry gates in every world".
 * ⛓ PIXELMASK FOOTPRINTS (session tile-primitives-pixelmask-l86, ⚖ "Pixelmask fix, then L86") — L86, the last sphere-0 level:
 *   - L86: the game lands its return on L0 (10,18), under building1's SPRITE but outside its 48x32 Pixelmask; the grid boxed
 *     the sprite, so the maze world walled the landing. The playthrough grid now takes a building's footprint from its mask.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlaythroughMaze } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import HELPERS from './maze_tiles.helpers.json' with { type: 'json' };

const ATLAS = JSON.parse(readFileSync(new URL('../../flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
const compiled = new Map();
const compile = (levels) => {
    const key = levels.join(',');
    if (!compiled.has(key)) compiled.set(key, JSON.parse(buildPlaythroughMaze({ levels }).text));
    return compiled.get(key);
};
const certify = (levels) => certifyPlaythroughMaze(compile(levels), HELPERS, { native: true, atlas: ATLAS });
const line = (out, prefix) => out.lines.find((l) => l.startsWith(prefix))?.slice(prefix.length);
const FREE = JSON.stringify([[]]);

describe('L3 — the ghost rock compiles, its strike the fusion', () => {
    it('L2 + L3 compile and certify clean; the ghost action needs Fusion, Spear and Sword', () => {
        const out = certify(['level_2', 'level_3', 'level_4']);
        expect(out.problems).toEqual([]);
        expect(line(out, 'level_2->level_3__r0c4=')).toBe(FREE);
        const lib = Object.values(compile(['level_2', 'level_3', 'level_4']).preset_sidecars['1'])
            .find((s) => s.playable_payload?.atlas_region === 'level_3').playable_payload.action_lib;
        expect(lib.ghostsword.rule.children.map((c) => c.args.item_name))
            .toEqual(['Ghost Sword Fusion', 'Ghost Spear', 'Progressive Sword']);
        expect(lib.ghostsword.item).toBeUndefined();
    });
});

describe('L8 — the lane block sinks', () => {
    it('L7 + L8 + L9: L8 → L9 is free in the world, as AP says; the levels certify clean', () => {
        const out = certify(['level_7', 'level_8', 'level_9']);
        expect(out.problems).toEqual([]);
        expect(out.accepted).toEqual([]);
        expect(line(out, 'level_8->level_9=')).toBe(FREE);
    });
});

describe('L94 — a per-sub-region world floors its cliffside', () => {
    it('r3c4 reaches r2c16 empty-handed; L94 certifies clean', () => {
        const out = certify(['level_94']);
        expect(out.problems).toEqual([]);
        expect(line(out, 'level_94__r3c4->level_94__r2c16=')).toBe(FREE);
        const p = compile(['level_94']).preset_sidecars['1'].level_94__r3c4.playable_payload;
        for (const [x, y] of [[4, 3], [4, 4], [4, 5], [4, 6]]) expect(p.tiles[y * p.width + x], `(${x},${y})`).toBe(0);
    });

    it('a per-sub-region world with no directional cell beside its ground carries no entry gates', () => {
        const rules = compile(['level_2', 'level_6', 'level_7', 'level_9', 'level_10', 'level_11']);
        for (const [name, sc] of Object.entries(rules.preset_sidecars['1'])) {
            expect(sc.playable_payload.entry_gates, name).toBeUndefined();
        }
    });
});

describe('L86 — its landing under L0\'s building is floor', () => {
    it('L0 + L86 certify clean; L86 -> L0 is free and its Chest is reached empty-handed', () => {
        const out = certify(['level_0', 'level_86']);
        expect(out.problems).toEqual([]);
        expect(out.accepted).toEqual([]);
        expect(line(out, 'level_86->level_0__r7c6=')).toBe(FREE);
        expect(line(out, 'level_86@Level 086 - Chest=')).toBe(FREE);
    });

    it('L0\'s world floors building1\'s door (10,17) and the landing (10,18); the mask row above stays wall', () => {
        const p = Object.values(compile(['level_0', 'level_86']).preset_sidecars['1'])
            .find((s) => s.playable_payload?.atlas_region === 'level_0').playable_payload;
        expect([18, 17, 16].map((y) => p.tiles[y * p.width + 10])).toEqual([0, 0, 1]);
    });
});
