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
 * ⛓ SPHERE 0.1 (session tile-primitives-sphere-order-2):
 *   - L12: a per-sub-region world walled the event locks its component touches but no crossing uses — the doorway's second
 *     Red-Key lock (27,15) and the magical lock stacked on a boss lock at (2,54), whose crossing (to L83) is unwired —
 *     ⚖ "Lay touched event cells";
 *   - L67: the spear block was a static Ghost Spear gate; the game spears it onto the button that silences the key's lane,
 *     from two cells away across a wall — ⚖ "Reach-2 strike-push".
 * ⛓ SPHERES 3.5 + 3.7 (session tile-primitives-sphere-order-4):
 *   - L32: the atlas puts Times (the third BobBoss's kill) and Bob Boss (its Fire drop) on ONE tile, the boss rock's (5,8);
 *     the projection wrote the second over the first and Bob Boss had no cell — ⚖ "Spill to nearest floor". The fight is
 *     the rules' own weapon gate, laid static (⚖ "Keep static, name it").
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlaythroughMaze } from '../../../../scripts/procgen/make-seedling-playthrough-maze.mjs';
import { certifyPlaythroughMaze } from './certifyPlaythroughMaze.js';
import { pressLocations } from '../../procgenPipeline/regionAtlasMazeProjection.js';
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
    }, 180_000);
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
        // Priced from where the game lands L0's door (3,3) (session tile-primitives-pit-sinks-landings).
        expect(line(out, 'level_86->level_0__r7c6<@3,3=')).toBe(FREE);
        expect(line(out, 'level_86@Level 086 - Chest<@3,3=')).toBe(FREE);
    });

    it('L0\'s world floors building1\'s door (10,17) and the landing (10,18); the mask row above stays wall', () => {
        const p = Object.values(compile(['level_0', 'level_86']).preset_sidecars['1'])
            .find((s) => s.playable_payload?.atlas_region === 'level_0').playable_payload;
        expect([18, 17, 16].map((y) => p.tiles[y * p.width + 10])).toEqual([0, 0, 1]);
    });
});

describe('L12 — a sub-region world lays the event locks it touches', () => {
    it('L12 certifies clean; the doorway\'s second lock is Red Key from r0c19, the stacked locks each their own item', () => {
        const out = certify(['level_12']);
        expect(out.problems).toEqual([]);
        expect(out.accepted).toEqual([]);
        expect(line(out, 'level_12__r0c19@L12 flag 4: bosslock@416,240 cleared=')).toBe(JSON.stringify([['Red Key']]));
        expect(line(out, 'level_12__r0c19@L12 flag 5: bosslock@432,240 cleared=')).toBe(JSON.stringify([['Red Key']]));
        expect(line(out, 'level_12__r42c28@L12 flag 12: bosslock@32,864 cleared=')).toBe(JSON.stringify([['Yellow Key']]));
        expect(line(out, 'level_12__r42c28@L12 flag 7: magicallock@32,864 cleared=')).toBe(JSON.stringify([['Wand']]));
    });

    it('the touched lock is a dead-end gate in its world; the stacked cell carries both events', () => {
        const sc = compile(['level_12']).preset_sidecars['1'];
        const at = (name, x, y) => {
            const p = sc[name].playable_payload;
            const ob = p.obstacles.find((o) => o.x === x && o.y === y);
            return ob && p.obstacleLib[ob.id];
        };
        expect(at('level_12__r0c19', 27, 15).events.map((e) => e.name)).toEqual(['L12 flag 5: bosslock@432,240 cleared']);
        expect(at('level_12__r0c37', 26, 15).events.map((e) => e.name)).toEqual(['L12 flag 4: bosslock@416,240 cleared']);
        expect(at('level_12__r42c28', 2, 54).events.map((e) => e.name).sort())
            .toEqual(['L12 flag 12: bosslock@32,864 cleared', 'L12 flag 7: magicallock@32,864 cleared']);
    });
});

describe('L67 — the spear block is speared onto the button', () => {
    it('L59 + L67 certify clean; the Boss Key, priced from r6c11 (its only way in), needs only the Ghost Spear', () => {
        const out = certify(['level_59', 'level_67']);
        expect(out.problems).toEqual([]);
        expect(out.accepted).toEqual([]);
        expect(line(out, 'level_67__r3c2@Level 067 - Boss Key 4<level_67__r6c11=')).toBe(JSON.stringify([['Ghost Spear']]));
    });
});

describe('L32 — two locations on the boss rock\'s tile', () => {
    it('L30 + L32 certify clean; Bob Boss spills to (5,7), each priced by the weapon from the landing', () => {
        const out = certify(['level_30', 'level_32']);
        expect(out.problems).toEqual([]);
        expect(out.accepted).toEqual([]);
        const WEAPON = JSON.stringify([['Ghost Spear'], ['Progressive Sword']]);
        expect(line(out, 'level_32@Level 032 - Bob Boss<@4,7=')).toBe(WEAPON);
        expect(line(out, 'level_32@Level 032 - Times<@4,7=')).toBe(WEAPON);
        const items = compile(['level_30', 'level_32']).preset_sidecars['1'].level_32.playable_payload.items;
        expect(items.map((i) => `${i.locationName}@${i.x},${i.y}`).sort())
            .toEqual(['Level 032 - Bob Boss@5,8', 'Level 032 - Times@5,7']);
    });
});

describe('L38 — a cross-room press is a location on its button', () => {
    const PRESS = 'L39 flag 8: wandlock@144,592 cleared';

    it('L37 + L38 certify clean; the press for L39\'s wand lock is reached empty-handed', () => {
        const out = certify(['level_37', 'level_38']);
        expect(out.problems).toEqual([]);
        expect(out.accepted).toEqual([]);
        expect(out.lines.filter((l) => l.startsWith(`level_38@${PRESS}`))).not.toEqual([]);
        for (const l of out.lines.filter((x) => x.startsWith(`level_38@${PRESS}`))) expect(l.slice(l.indexOf('=') + 1)).toBe(FREE);
    });

    it('a mutant AP rule on the press (Wand) is caught: the world reaches the button without it', () => {
        const rules = structuredClone(compile(['level_37', 'level_38']));
        rules.regions['1'].level_38.locations.find((l) => l.name === PRESS).access_rule = { rule: 'Has', args: { item_name: 'Wand' } };
        const out = certifyPlaythroughMaze(rules, HELPERS, { native: true, atlas: ATLAS });
        expect(out.problems.some((p) => p.startsWith(`level_38 @ ${PRESS}`) || (p.includes(PRESS) && p.includes('derived true, atlas false')))).toBe(true);
    });

    it('a button off the grid presses from the tile of its centre: L61\'s (176,40) → (11,3), one cell', () => {
        // Its 8x6 hitbox straddles tiles y 2 and 3; the whole-game compile threw on the two-tile footprint before this.
        const items = compile(['level_61']).preset_sidecars['1'].level_61__r0c10.playable_payload.items;
        const POLE = 'L63 flag 1: lightpole@64,88 cleared';
        expect(items.filter((i) => i.locationName === POLE)).toEqual([{ x: 11, y: 3, id: POLE, locationName: POLE }]);
    });

    it('a press whose own rule is not True_ is refused by name (its location carries no rule, so it would be looser)', () => {
        const region = { region_id: 'level_38' };
        const ev = (rule) => ({ name: PRESS, side: 'level_38', mode: 'press', tiles: [[2, 3]], ...(rule ? { rule } : {}) });
        const loc = { name: PRESS, tile: [2, 3], vanilla_item: PRESS };
        expect(pressLocations(region, [ev(null)])).toEqual([loc]);
        expect(pressLocations(region, [ev({ rule: 'True_' })])).toEqual([loc]);
        expect(() => pressLocations(region, [ev({ rule: 'Has', args: { item_name: 'Wand' } })])).toThrow(/its own rule .*Wand.* is not True_/);
    });

    it('the press sits on the ButtonRoom\'s own cell (32,48) → (2,3), granting the event', () => {
        const items = compile(['level_37', 'level_38']).preset_sidecars['1'].level_38.playable_payload.items;
        expect(items.filter((i) => i.locationName === PRESS)).toEqual([{ x: 2, y: 3, id: PRESS, locationName: PRESS }]);
    });
});
