/**
 * procgenCore/elements/arena.test — **THE CHAMBER WEAPONISED**, asked only
 * geometric questions.
 *
 * PROCGEN ELEMENTS arc 5, slice 4 (§3.4). ⛔ Like `openChamber.test.js` this
 * file imports no engine: whether a room with an arena in it SOLVES is the
 * binding's certification, and what a SPINNER costs the solver is the enemy
 * census. What is asked here is the contract — the shared blob, the bodies, the
 * four mouths, the draw count and the two refusals.
 *
 * ⛓⛓⛓ **THE FIRST ROW IS THE "NO FORK" PROOF.** The arena is meant to BE the
 * chamber plus a payload, and a claim like that decays the moment one of the
 * two grows a rule. So the row does not read the docblock: it builds both
 * elements at the SAME values, the SAME site and the SAME seed and asserts the
 * tiles, the area and all eight ports are equal object-for-object. The two
 * share `openChamberBlob` and `openChamberMouths`, and this is what says so.
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import { OPPOSITE_DIR as OPPOSITE } from '../elements.js';
import { ARENA, ARENA_REFUSALS, BODIES_DOMAIN, arenaBodyId, buildArena } from './arena.js';
import { buildOpenChamber, openChamberFootprint } from './openChamber.js';
import { TILE_FLOOR } from '../../shared/procgen/mazeAlgorithms/gridTiles.js';

const mulberry32 = (seed) => {
    let s = seed | 0;
    return () => {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
const SOURCE = Object.freeze({
    name: 'mulberry32 (arena.test)',
    assertSeed: (seed) => seed,
    create: (seed) => {
        const next = mulberry32(seed);
        return { next, nextIndex: (n) => Math.floor(next() * n), get state() { return 0; } };
    },
});
const rngFor = (seed) => new ProcgenRng(seed, { source: SOURCE });

const SEEDS = [...Array(12)].map((_, i) => i + 1);
const VALUES = [];
for (const w of [2, 3, 4, 5, 6]) {
    for (const h of [2, 3, 4, 5, 6]) {
        for (const bodies of BODIES_DOMAIN) VALUES.push({ w, h, bodies });
    }
}
const key = (c) => `${c.x},${c.y}`;
const siteFor = (values, at = { x: 4, y: 5 }) => {
    const [f] = openChamberFootprint(values);
    return { x: at.x, y: at.y, w: f.w, h: f.h };
};

describe('arena — it IS the chamber, plus a payload', () => {
    it('builds the SAME blob and the SAME eight mouths as `chamber` at the same seed', () => {
        for (const values of VALUES) {
            for (const seed of SEEDS.slice(0, 4)) {
                const site = siteFor(values);
                const a = buildArena(values, site, rngFor(seed)).placement;
                const c = buildOpenChamber(values, site, rngFor(seed)).placement;
                expect(a.tiles, JSON.stringify(values)).toEqual(c.tiles);
                expect(a.area).toEqual(c.area);
                expect(a.ports).toEqual(c.ports);
            }
        }
    });

    it('fills its site with FLOOR and declares every cell of it an area', () => {
        for (const values of VALUES.slice(0, 12)) {
            const site = siteFor(values);
            const { placement } = buildArena(values, site, rngFor(5));
            const want = new Set();
            for (let y = site.y; y < site.y + site.h; y += 1) {
                for (let x = site.x; x < site.x + site.w; x += 1) want.add(key({ x, y }));
            }
            expect(placement.tiles.every((t) => t.tile === TILE_FLOOR)).toBe(true);
            expect(new Set(placement.tiles.map(key))).toEqual(want);
            expect(new Set(placement.area.cells.map(key))).toEqual(want);
            expect(placement.area.kind).toBe('element');
        }
    });

    /** ⛓ THE MOUTHS ARE THE FOUR-MOUTH CONTRACT'S, asked of THIS element too —
     *  the arena is offered by the same site pick and meets the same rooms. */
    it('declares one entry port PER SIDE, each with its mirrored exit', () => {
        for (const values of VALUES.slice(0, 16)) {
            for (const seed of SEEDS.slice(0, 3)) {
                const site = siteFor(values);
                const { placement } = buildArena(values, site, rngFor(seed));
                const entries = placement.ports.filter((p) => p.role === 'entry');
                const exits = placement.ports.filter((p) => p.role === 'exit');
                expect(placement.ports).toHaveLength(8);
                expect(entries.map((p) => p.dir).sort()).toEqual(['E', 'N', 'S', 'W']);
                for (const entry of entries) {
                    expect(exits.some((p) => p.dir === OPPOSITE[entry.dir])).toBe(true);
                }
            }
        }
    });
});

describe('arena — the bodies', () => {
    it('places exactly `bodies` of them, inside the blob, on distinct cells', () => {
        for (const values of VALUES) {
            for (const seed of SEEDS) {
                const site = siteFor(values);
                const { placement } = buildArena(values, site, rngFor(seed));
                const { obstacles } = placement.entities;
                expect(obstacles, JSON.stringify(values)).toHaveLength(values.bodies);
                expect(placement.entities.blocks).toEqual([]);
                expect(placement.entities.buttons).toEqual([]);
                expect(placement.entities.items).toEqual([]);
                const cells = new Set(obstacles.map(key));
                expect(cells.size).toBe(values.bodies);
                const inSite = new Set(placement.area.cells.map(key));
                for (const [i, o] of obstacles.entries()) {
                    expect(o.id).toBe(arenaBodyId(i));
                    expect(inSite.has(key(o))).toBe(true);
                }
            }
        }
    });

    /**
     * ⛓⛓ **NON-VACUITY FOR "WITHOUT REPLACEMENT".** The row above would pass
     * for an element that always put both bodies in the SAME two cells, and it
     * would pass for one whose second `pick` ran over the full list and just
     * happened not to repeat on these seeds. What discriminates is the smallest
     * blob there is — 2x2, four cells, TWO bodies — where a `pick` with
     * replacement collides one time in four: over 200 seeds the collision count
     * must be ZERO, and the pairs must not all be the same pair.
     */
    it('draws them WITHOUT replacement — 0 collisions in 200 seeds on a 2x2 blob', () => {
        const values = { w: 2, h: 2, bodies: 2 };
        const site = siteFor(values);
        const pairs = new Set();
        let collisions = 0;
        for (let seed = 1; seed <= 200; seed += 1) {
            const { placement } = buildArena(values, site, rngFor(seed));
            const [a, b] = placement.entities.obstacles;
            if (key(a) === key(b)) collisions += 1;
            pairs.add([key(a), key(b)].sort().join('|'));
        }
        expect(collisions).toBe(0);
        expect(pairs.size).toBeGreaterThan(1);
    });

    /**
     * ⛔ THE DRAW COUNT IS `2 + bodies` — the two mouth draws `openChamber`
     * declares, plus one `pick` per body. It is a function of a parameter drawn
     * FIRST, so the stream decides the count before it spends it.
     */
    it('spends exactly 2 + `bodies` draws at construct', () => {
        for (const values of VALUES) {
            const rng = rngFor(11);
            const before = rng.draws;
            buildArena(values, siteFor(values), rng);
            expect(rng.draws - before, JSON.stringify(values)).toBe(2 + values.bodies);
        }
    });
});

describe('arena — the refusals', () => {
    it('refuses a site that is not one of its declared footprints, BY NAME', () => {
        const out = buildArena({ w: 3, h: 4, bodies: 1 },
            { x: 2, y: 2, w: 5, h: 5 }, rngFor(3));
        expect(out.refused?.reason).toBe('site-is-not-a-declared-footprint');
        expect(out.placement).toBeUndefined();
    });

    /**
     * ⛓ REACHED BY CONSTRUCTION RATHER THAN BY THE DOMAIN: the smallest blob is
     * 2x2 = 4 cells and `BODIES_DOMAIN`'s largest value is smaller than that, so
     * no SHIPPED combination can hit this. ⛔ It is asked anyway, of a value the
     * contract would refuse a caller for, because the clause exists for the day
     * the domain grows — a refusal nothing can reach is still the difference
     * between a named answer and two spinners in one tile.
     */
    it('refuses more bodies than the blob has cells, BY NAME', () => {
        const values = { w: 2, h: 2, bodies: 5 };
        const out = buildArena(values, siteFor(values), rngFor(3));
        expect(out.refused?.reason).toBe('arena-has-no-room-for-its-bodies');
        expect(ARENA_REFUSALS).toContain('arena-has-no-room-for-its-bodies');
    });

    /** ⛓ Every value the head declares constructs — the contract's own sweep. */
    it('constructs at every declared value combination, through the contract', () => {
        for (const values of VALUES) {
            for (const seed of SEEDS.slice(0, 2)) {
                const rng = rngFor(seed);
                const concrete = ARENA.instantiate(rng, values);
                const out = concrete.construct(siteFor(values));
                expect(out.refused, `${JSON.stringify(values)} ${out.refused?.detail}`)
                    .toBeUndefined();
            }
        }
    });

    /** ⛓ The knob is COST-FIRST (⚖ ruling 9) and this is the pin: the domain is
     *  what the D0 arm priced, and a value nobody swept is one nobody
     *  adjudicated. `bodies=3` REFUSED in the enemy census's arena arm. */
    it('declares the domain the cost arm priced', () => {
        expect(BODIES_DOMAIN).toEqual([1, 2]);
        const p = ARENA.params.find((q) => q.key === 'bodies');
        expect(p.domain).toEqual([1, 2]);
        expect(p.default).toBe(1);
    });
});
