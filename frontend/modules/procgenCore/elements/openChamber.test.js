/**
 * procgenCore/elements/openChamber.test — **THE ELEMENT THAT IS SPACE**, asked
 * only geometric questions.
 *
 * PROCGEN ELEMENTS arc 5, slice 3 (§3.3). ⛔ Like `reversePullBlock.test.js`
 * this file imports no engine: whether a room with a chamber in it SOLVES is
 * the binding's certification and lives in `seedlingDemo/`. What is asked here
 * is the contract — the declared footprint, the write, the area, the ports,
 * and the one refusal.
 *
 * ⚠ THE PROPERTIES ARE RECOMPUTED, NOT READ BACK. Every claim below rebuilds
 * the expected cell set from `{site}` and compares; a row that read the array
 * the constructor wrote would be a fixed point, and a fixed point tests
 * self-consistency and never correctness (trap 250).
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import { DIR_DELTA, assertFootprints } from '../elements.js';
import { wideBlobs } from '../areaPartition.js';
import {
    MIN_CHAMBER, OPEN_CHAMBER, OPEN_CHAMBER_REFUSALS, buildOpenChamber, openChamberFootprint,
} from './openChamber.js';
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
    name: 'mulberry32 (openChamber.test)',
    assertSeed: (seed) => seed,
    create: (seed) => {
        const next = mulberry32(seed);
        return { next, nextIndex: (n) => Math.floor(next() * n), get state() { return 0; } };
    },
});
const rngFor = (seed) => new ProcgenRng(seed, { source: SOURCE });

const SEEDS = [...Array(16)].map((_, i) => i + 1);
const VALUES = [];
for (const w of [2, 3, 4, 5, 6]) for (const h of [2, 3, 4, 5, 6]) VALUES.push({ w, h });
const key = (c) => `${c.x},${c.y}`;
/** The site a binding that ASKS would offer, in the element's first orientation. */
const siteFor = (values, at = { x: 4, y: 5 }) => {
    const [f] = openChamberFootprint(values);
    return { x: at.x, y: at.y, w: f.w, h: f.h };
};

describe('openChamber — the declared footprint', () => {
    it('is w x h, and both ways round when they differ', () => {
        expect(openChamberFootprint({ w: 4, h: 4 }))
            .toEqual([{ w: 4, h: 4, orient: 'square' }]);
        expect(openChamberFootprint({ w: 2, h: 5 })).toEqual([
            { w: 2, h: 5, orient: 'wide' },
            { w: 5, h: 2, orient: 'tall' },
        ]);
    });

    it('satisfies the contract for every declared value combination', () => {
        for (const values of VALUES) {
            expect(() => assertFootprints(openChamberFootprint(values),
                `openChamber ${JSON.stringify(values)}`)).not.toThrow();
        }
    });

    /** ⛓ NON-VACUITY: the contract refuses one rectangle named twice, so a
     *  square MUST declare one entry — this asserts the split really happens
     *  rather than that both branches are the same. */
    it('declares ONE entry when the axes coincide and TWO when they do not', () => {
        const squares = VALUES.filter((v) => v.w === v.h);
        const oblongs = VALUES.filter((v) => v.w !== v.h);
        expect(squares.length).toBe(5);
        expect(oblongs.length).toBe(20);
        for (const v of squares) expect(openChamberFootprint(v)).toHaveLength(1);
        for (const v of oblongs) expect(openChamberFootprint(v)).toHaveLength(2);
    });
});

describe('openChamber — the geometry', () => {
    it('fills its whole site with FLOOR and declares every cell of it an area', () => {
        for (const values of VALUES) {
            for (const seed of SEEDS.slice(0, 4)) {
                const site = siteFor(values);
                const out = buildOpenChamber(values, site, rngFor(seed));
                expect(out.refused, JSON.stringify(values)).toBeUndefined();
                const { placement } = out;
                const want = new Set();
                for (let y = site.y; y < site.y + site.h; y += 1) {
                    for (let x = site.x; x < site.x + site.w; x += 1) want.add(key({ x, y }));
                }
                expect(placement.tiles).toHaveLength(want.size);
                expect(placement.tiles.every((t) => t.tile === TILE_FLOOR)).toBe(true);
                expect(new Set(placement.tiles.map(key))).toEqual(want);
                expect(new Set(placement.area.cells.map(key))).toEqual(want);
                expect(placement.area.kind).toBe('element');
                expect(placement.cost.cells).toBe(want.size);
            }
        }
    });

    /**
     * ⛓⛓⛓ **THE BLOB IS A CHAMBER BY `wideBlobs`' OWN RULE** — asserted, not
     * assumed (the element's docblock claims it and this is the measurement).
     * The primitive is the one `sites.js`' `chamber` class and the partition
     * both call, so a blob it did not call wide would be a declared area the
     * room's own vocabulary disagrees with.
     */
    it('writes a blob the 2x2 WIDE rule calls one single chamber', () => {
        for (const values of VALUES) {
            const site = siteFor(values, { x: 3, y: 3 });
            const { placement } = buildOpenChamber(values, site, rngFor(7));
            const floor = new Set(placement.tiles.map(key));
            const blobs = wideBlobs(20, 20, (x, y) => floor.has(key({ x, y })));
            expect(blobs, JSON.stringify(values)).toHaveLength(1);
            expect(blobs[0]).toHaveLength(site.w * site.h);
        }
    });

    it('puts NO entity, holds and grants NOTHING, and demands nothing outside itself', () => {
        for (const values of VALUES.slice(0, 8)) {
            const { placement } = buildOpenChamber(values, siteFor(values), rngFor(3));
            for (const k of ['blocks', 'buttons', 'obstacles', 'items']) {
                expect(placement.entities[k]).toEqual([]);
            }
            expect(placement.symbols).toEqual({ holds: [], grants: [] });
            expect(placement.demand).toEqual([]);
        }
    });

    it('declares one entry port and one exit port, mirrored across the site', () => {
        for (const values of VALUES) {
            for (const seed of SEEDS) {
                const site = siteFor(values);
                const { placement } = buildOpenChamber(values, site, rngFor(seed));
                const entry = placement.ports.find((p) => p.role === 'entry');
                const exit = placement.ports.find((p) => p.role === 'exit');
                expect(placement.ports).toHaveLength(2);
                const d = DIR_DELTA[entry.dir];
                /** the port is ON the edge its dir points off, and the dir is OUTWARD */
                expect(entry.x + d.dx < site.x || entry.x + d.dx >= site.x + site.w
                    || entry.y + d.dy < site.y || entry.y + d.dy >= site.y + site.h).toBe(true);
                /** the exit is the SAME offset on the opposite edge — a derivation */
                if (d.dx === 0) {
                    expect(exit.x).toBe(entry.x);
                    expect(exit.y).toBe(entry.y === site.y ? site.y + site.h - 1 : site.y);
                } else {
                    expect(exit.y).toBe(entry.y);
                    expect(exit.x).toBe(entry.x === site.x ? site.x + site.w - 1 : site.x);
                }
            }
        }
    });

    /**
     * ⛔ THE DRAW COUNT IS A CONSTANT — two, whatever the parameters — so a
     * record of this element is `{params, site}` plus the seed and a replay
     * cannot land a draw early (arc-2 §10.5.1's finding, one element over).
     */
    it('spends exactly TWO draws at construct, whatever the parameters', () => {
        for (const values of VALUES) {
            const rng = rngFor(11);
            const before = rng.draws;
            buildOpenChamber(values, siteFor(values), rng);
            expect(rng.draws - before, JSON.stringify(values)).toBe(2);
        }
    });

    /** ⛓ A DIFFERENT STREAM IS A DIFFERENT MOUTH — otherwise the two draws
     *  would be spent on a decision nobody can see, which is trap 321's shape. */
    it('puts the mouth somewhere the seed decides', () => {
        const seen = new Set();
        for (const seed of SEEDS) {
            const { placement } = buildOpenChamber({ w: 4, h: 4 }, siteFor({ w: 4, h: 4 }),
                rngFor(seed));
            const p = placement.ports.find((q) => q.role === 'entry');
            seen.add(`${p.dir}@${key(p)}`);
        }
        expect(seen.size).toBeGreaterThan(1);
    });
});

describe('openChamber — the one refusal', () => {
    it('refuses a site that is not one of its declared footprints, BY NAME', () => {
        const out = buildOpenChamber({ w: 3, h: 4 }, { x: 2, y: 2, w: 6, h: 6 }, rngFor(1));
        expect(out.refused.reason).toBe('site-is-not-a-declared-footprint');
        expect(out.refused.detail).toContain('6x6');
        expect(out.refused.detail).toContain('3x4');
        expect(OPEN_CHAMBER_REFUSALS).toContain(out.refused.reason);
    });

    /** ⛔ IT SPENDS NO DRAW — a refusal that moved the stream would make a
     *  binding's next element a different one for a site it never used. */
    it('spends no draw when it refuses', () => {
        const rng = rngFor(5);
        const before = rng.draws;
        buildOpenChamber({ w: 3, h: 3 }, { x: 1, y: 1, w: 4, h: 4 }, rng);
        expect(rng.draws).toBe(before);
    });

    /**
     * ⛓⛓ **THE MAZE'S OWN SQUARE IS REFUSED RATHER THAN THROWN AT.** A binding
     * that sizes its site itself (`len + SITE_MARGIN`) offers a rectangle this
     * element did not name; the refusal is what makes that a countable fact
     * about the SITE instead of an `ElementContractError` about the element.
     */
    it('refuses through the CONTRACT wrapper too, and never throws', () => {
        const concrete = OPEN_CHAMBER.instantiate(rngFor(2), { w: 2, h: 2 });
        expect(() => concrete.construct({ x: 1, y: 1, w: 5, h: 5 })).not.toThrow();
        expect(concrete.construct({ x: 1, y: 1, w: 5, h: 5 }).refused.reason)
            .toBe('site-is-not-a-declared-footprint');
    });

    /** ⛓ MIN_CHAMBER is the domain's own floor, so a 1-wide chamber is not
     *  sayable through the schema at all — asserted so a widened domain has to
     *  meet this row. */
    it('cannot be asked for a blob narrower than the WIDE rule allows', () => {
        for (const p of OPEN_CHAMBER.params) {
            expect(Math.min(...p.domain)).toBeGreaterThanOrEqual(MIN_CHAMBER);
        }
    });
});
