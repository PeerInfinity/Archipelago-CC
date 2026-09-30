/**
 * procgenCore/elements/roam.test — **THE ROAMING ENEMY**, asked only geometric
 * questions (concept library F1, D2).
 *
 * ⛔ Like `arena.test.js` this file imports no engine: whether a room with a
 * roaming body in it SOLVES is the binding's certification, and what the body
 * costs the walk is the binding's body ablation. What is asked here is the
 * contract — the shared blob, the shared body draw, the four mouths, the draw
 * count, the law and the two refusals.
 *
 * ⛓⛓⛓ **THE FIRST ROW IS THE "NO FORK" PROOF, TWICE.** A roaming enemy is the
 * chamber's blob plus the arena's bodies minus the lock. So at the SAME values,
 * site and seed it must build the chamber's tiles/area/ports AND the arena's
 * body CELLS, object for object — only the ids differ, because each element
 * names its own bodies.
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import { ELEMENT_LAWS, LAW_CUT, LAW_NONE, OPPOSITE_DIR as OPPOSITE } from '../elements.js';
import { ARENA, BODIES_DOMAIN, buildArena } from './arena.js';
import { buildOpenChamber, openChamberFootprint } from './openChamber.js';
import { ROAM, ROAM_REFUSALS, buildRoam, roamBodyId } from './roam.js';
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
    name: 'mulberry32 (roam.test)',
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

describe('roam — the chamber\'s blob and the arena\'s bodies, and nothing else', () => {
    it('builds the SAME blob and eight mouths as `chamber`, and the SAME body cells as '
        + '`arena`, at the same seed', () => {
        for (const values of VALUES) {
            for (const seed of SEEDS.slice(0, 4)) {
                const site = siteFor(values);
                const r = buildRoam(values, site, rngFor(seed)).placement;
                const c = buildOpenChamber(values, site, rngFor(seed)).placement;
                const a = buildArena(values, site, rngFor(seed)).placement;
                expect(r.tiles, JSON.stringify(values)).toEqual(c.tiles);
                expect(r.area).toEqual(c.area);
                expect(r.ports).toEqual(c.ports);
                expect(r.entities.obstacles.map(key)).toEqual(a.entities.obstacles.map(key));
            }
        }
    });

    it('fills its site with FLOOR and declares every cell of it an area', () => {
        for (const values of VALUES.slice(0, 12)) {
            const site = siteFor(values);
            const { placement } = buildRoam(values, site, rngFor(5));
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

    it('declares one entry port PER SIDE, each with its mirrored exit', () => {
        for (const values of VALUES.slice(0, 16)) {
            const { placement } = buildRoam(values, siteFor(values), rngFor(2));
            const entries = placement.ports.filter((p) => p.role === 'entry');
            const exits = placement.ports.filter((p) => p.role === 'exit');
            expect(placement.ports).toHaveLength(8);
            expect(entries.map((p) => p.dir).sort()).toEqual(['E', 'N', 'S', 'W']);
            for (const entry of entries) {
                expect(exits.some((p) => p.dir === OPPOSITE[entry.dir])).toBe(true);
            }
        }
    });

    /** ⛓⛓ WHAT MAKES IT NOT AN ARENA: no symbol, no door, no clearer, no lock
     *  anywhere in the placement — nothing a binding could hang a gate on. */
    it('holds and grants NOTHING and declares no door cell, no clearer and no demand', () => {
        for (const values of VALUES) {
            const { placement } = buildRoam(values, siteFor(values), rngFor(7));
            expect(placement.symbols).toEqual({ holds: [], grants: [] });
            expect(placement.demand).toEqual([]);
            expect(placement.doorCells).toBeUndefined();
            expect(placement.clearer).toBeUndefined();
        }
    });
});

describe('roam — the bodies', () => {
    it('places exactly `bodies` of them, inside the blob, on distinct cells, named roam_body_<i>',
        () => {
            for (const values of VALUES) {
                for (const seed of SEEDS) {
                    const { placement } = buildRoam(values, siteFor(values), rngFor(seed));
                    const { obstacles } = placement.entities;
                    expect(obstacles, JSON.stringify(values)).toHaveLength(values.bodies);
                    expect(placement.entities.blocks).toEqual([]);
                    expect(placement.entities.buttons).toEqual([]);
                    expect(placement.entities.items).toEqual([]);
                    expect(new Set(obstacles.map(key)).size).toBe(values.bodies);
                    const inSite = new Set(placement.area.cells.map(key));
                    for (const [i, o] of obstacles.entries()) {
                        expect(o.id).toBe(roamBodyId(i));
                        expect(inSite.has(key(o))).toBe(true);
                    }
                }
            }
        });

    it('draws them WITHOUT replacement — 0 collisions in 200 seeds on a 2x2 blob', () => {
        const values = { w: 2, h: 2, bodies: 2 };
        const site = siteFor(values);
        const pairs = new Set();
        let collisions = 0;
        for (let seed = 1; seed <= 200; seed += 1) {
            const [a, b] = buildRoam(values, site, rngFor(seed)).placement.entities.obstacles;
            if (key(a) === key(b)) collisions += 1;
            pairs.add([key(a), key(b)].sort().join('|'));
        }
        expect(collisions).toBe(0);
        expect(pairs.size).toBeGreaterThan(1);
    });

    /** ⛔ THE DECLARED DRAW COUNT — the arena's `2 + bodies`, which is what the
     *  shared draw makes true by construction; asked anyway so a later edit to
     *  either file that moved a draw reds here. */
    it('spends exactly 2 + `bodies` draws at construct', () => {
        for (const values of VALUES) {
            const rng = rngFor(11);
            const before = rng.draws;
            buildRoam(values, siteFor(values), rng);
            expect(rng.draws - before, JSON.stringify(values)).toBe(2 + values.bodies);
        }
    });
});

describe('roam — the law and the refusals', () => {
    /** ⛓ ITS LAW IS `none`: no door cell, so neither the cut law nor the
     *  shortcut law has anything to ask; the body ablation is its check. */
    it('declares law `none`, a member of ELEMENT_LAWS, and is pre-carve like the arena', () => {
        expect(ELEMENT_LAWS).toContain(LAW_NONE);
        expect(ROAM.law).toBe(LAW_NONE);
        expect(ARENA.law).toBe(LAW_CUT);
        expect(ROAM.phase).toBe('pre-carve');
        expect(ROAM.family).toBe('roam');
    });

    it('refuses a site that is not one of its declared footprints, BY NAME', () => {
        const out = buildRoam({ w: 3, h: 4, bodies: 1 }, { x: 2, y: 2, w: 5, h: 5 }, rngFor(3));
        expect(out.refused?.reason).toBe('site-is-not-a-declared-footprint');
        expect(out.placement).toBeUndefined();
    });

    /** ⛓ Unreachable through the shipped domain (a 2x2 blob holds 4 and the
     *  domain tops out at 2), asked of a value the contract would refuse a
     *  caller for — the arena's own reasoning for the arena's own clause. */
    it('refuses more bodies than the blob has cells, BY NAME', () => {
        const values = { w: 2, h: 2, bodies: 5 };
        const out = buildRoam(values, siteFor(values), rngFor(3));
        expect(out.refused?.reason).toBe('roam-has-no-room-for-its-bodies');
        expect(ROAM_REFUSALS).toEqual(['roam-has-no-room-for-its-bodies']);
    });

    it('constructs at every declared value combination, through the contract', () => {
        for (const values of VALUES) {
            const concrete = ROAM.instantiate(rngFor(1), values);
            const out = concrete.construct(siteFor(values));
            expect(out.refused, `${JSON.stringify(values)} ${out.refused?.detail}`)
                .toBeUndefined();
        }
    });

    it('declares the ARENA\'s body domain, which is the one the cost arm priced', () => {
        const p = ROAM.params.find((q) => q.key === 'bodies');
        expect(p.domain).toEqual([...BODIES_DOMAIN]);
        expect(p.default).toBe(1);
    });
});
