import { describe, expect, it } from 'vitest';

import { firstDifference, pairings, sameJson } from './check-worldgen-package-sidecars.mjs';

describe('check-worldgen-package-sidecars — the packages carry what their presets carry', () => {
    it('sameJson ignores key order, nothing else', () => {
        expect(sameJson({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
        expect(sameJson({ exits: [{ side: 'E' }] }, { exits: [{ side: 'E', x: 4, y: 5 }] })).toBe(false);
        expect(sameJson([1, 2], [2, 1])).toBe(false);
    });

    it('firstDifference names the path — an exit tile the package still carries', () => {
        expect(firstDifference({ r: { exits: [{ side: 'E' }] } }, { r: { exits: [{ side: 'E', x: 4 }] } }))
            .toBe('.r.exits.0.x only in the package');
        expect(firstDifference({ a: 1 }, { a: 1 })).toBeNull();
    });

    it('⛓⛓ the real tree: every package/preset pair is equal, and the pairing finds the multiworld slots', () => {
        const { pairs } = pairings();
        expect(pairs.length).toBeGreaterThanOrEqual(11);
        expect(pairs.filter((p) => !sameJson(p.presetSidecars, p.packageSidecars)).map((p) => `${p.pkg} ${p.doc} ${p.slot}`))
            .toEqual([]);
        expect(new Set(pairs.map((p) => p.pkg))).toEqual(new Set(['bounce_worldgen', 'procgen_maze_worldgen',
            'runner_sphere_worldgen', 'runner_worldgen']));
    });
});
