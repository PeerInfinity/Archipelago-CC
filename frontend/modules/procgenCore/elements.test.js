/**
 * procgenCore/elements.test — THE ELEMENT CONTRACT'S OWN CLAIMS.
 *
 * PROCGEN ELEMENTS arc 2, slice 2 (`NewDocs/plans/procgen-elements-arc2-
 * kickoff.md` §3.2). Two subjects, on purpose:
 *
 *   a TOY element, built here, whose whole job is to be BROKEN in one specific
 *   way per row — a contract asserted only against a correct element is a
 *   contract nobody has seen refuse anything;
 *   the REAL gadget, so the sweep the contract demands is spent on something
 *   that has to survive it.
 *
 * ⛔ The stream is mulberry32 TRANSCRIBED (the idiom `areaGraph.test.js`
 * established): a `procgenCore` test that imported `mazeRoom/procgenRng.js`
 * would be a shared module tested through one substrate.
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from './procgenRng.js';
import {
    DIR_DELTA, ElementContractError, PORT_DIRS, assertElement, defineElement,
    enumerateElementInstantiations,
} from './elements.js';
import { REVERSE_PULL_BLOCK } from './elements/reversePullBlock.js';
import { TILE_FLOOR, TILE_WALL } from '../shared/procgen/mazeAlgorithms/gridTiles.js';

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
    name: 'mulberry32 (elements.test)',
    assertSeed: (seed) => seed,
    create: (seed) => {
        const next = mulberry32(seed);
        return { next, nextIndex: (n) => Math.floor(next() * n), get state() { return 0; } };
    },
});
const rngFor = (seed) => new ProcgenRng(seed, { source: SOURCE });

/* ── The toy ──────────────────────────────────────────────────────────── */

const SITE = Object.freeze({ x: 2, y: 3, w: 6, h: 5 });

/**
 * A minimal LEGAL element: it floors the site's top TWO rows, puts one item on
 * them, ports out of both ends of the first, demands the ring above stay wall.
 * Every `bad` override below breaks exactly one clause of the contract.
 *
 * ⚠ TWO rows and not one, because with one the whole floor is on the site's
 * edge and there is no cell that is INTERIOR **and** floor — so the row that
 * asks "a port in the interior refuses" could only be written against a wall
 * cell, where the wall clause fires first and the row proves nothing about the
 * clause it names. Found by writing it the obvious way and reading the message.
 */
const toyPlacement = (site, bad = {}) => {
    const tiles = [];
    for (let y = site.y; y < site.y + site.h; y += 1) {
        for (let x = site.x; x < site.x + site.w; x += 1) {
            tiles.push({ x, y, tile: y < site.y + 2 ? TILE_FLOOR : TILE_WALL });
        }
    }
    const left = { x: site.x, y: site.y };
    const right = { x: site.x + site.w - 1, y: site.y };
    return {
        tiles,
        entities: { blocks: [], buttons: [], obstacles: [],
            items: [{ x: site.x + 1, y: site.y, id: 'key_red' }] },
        ports: [
            { ...left, dir: 'W', role: 'entry' },
            { ...right, dir: 'E', role: 'exit' },
        ],
        demand: [{ x: site.x, y: site.y - 1, must: 'wall' }],
        area: { cells: tiles.filter((t) => t.tile === TILE_FLOOR).map(({ x, y }) => ({ x, y })),
            kind: 'element' },
        symbols: { holds: [], grants: ['key_red'] },
        cost: { cells: site.w * 2 },
        ...bad,
    };
};

const toy = (opts = {}) => defineElement({
    name: 'toy',
    family: 'test',
    why: 'a legal element, so the illegal ones below differ in exactly one clause',
    params: [
        { key: 'a', domain: [1, 2], default: 1, why: 'the first draw' },
        { key: 'b', domain: ['x', 'y'], default: 'x', why: 'the second draw' },
    ],
    construct: opts.construct ?? ((values, site) => toyPlacement(site, opts.bad)),
    assertPlacement: opts.assertPlacement ?? null,
});

/* ── The schema, the draws, the identity ──────────────────────────────── */

describe('defineElement — the schema is the TEMPLATE schema, and it says ELEMENT', () => {
    it('refuses an element with no name, no construct, or a bad assertPlacement', () => {
        expect(() => defineElement({ name: '', family: 'f', construct: () => ({}) }))
            .toThrow(ElementContractError);
        expect(() => defineElement({ name: 'n', family: 'f' }))
            .toThrow(/has no `construct`/);
        expect(() => defineElement({ name: 'n', family: 'f', construct: () => ({}),
            assertPlacement: 'nope' })).toThrow(/`assertPlacement` must be a function/);
    });

    /**
     * ⛔ ONE SCHEMA LANGUAGE — `assertParamSchema` is the template contract's
     * and is not re-spelled here. ⚠ But it is asked FIRST by `defineElement`,
     * so the sentence a reader meets names the thing they declared.
     */
    it('a bad domain refuses in the words "element", not "template"', () => {
        const bad = { name: 'n', family: 'f', construct: () => ({}),
            params: [{ key: 'a', domain: [], default: 1, why: 'w' }] };
        expect(() => defineElement(bad)).toThrow(/element "n" parameter "a" has no finite/);
        expect(() => defineElement({ ...bad,
            params: [{ key: 'a', domain: [1], default: 9, why: 'w' }] }))
            .toThrow(/element "n" parameter "a" defaults to/);
    });

    it('⛔ draws its parameters in SCHEMA ORDER, one pick each — the literal order', () => {
        const el = toy();
        const rng = rngFor(11);
        const seen = [];
        const spy = { pick: (items) => { seen.push([...items]); return items[0]; } };
        el.instantiate(spy);
        expect(seen).toEqual([[1, 2], ['x', 'y']]);
        // …and the real stream spends exactly two draws for two parameters.
        el.instantiate(rng);
        expect(rng.draws).toBe(2);
    });

    it('⛔ an override spends NO draw, and both overridden spends none at all', () => {
        const el = toy();
        const one = rngFor(11);
        el.instantiate(one, { a: 2 });
        expect(one.draws).toBe(1);
        const none = rngFor(11);
        const row = el.instantiate(none, { a: 2, b: 'y' });
        expect(none.draws).toBe(0);
        expect(row.params).toEqual({ a: 2, b: 'y' });
        expect(row.instance).toBe('toy(a=2,b=y)');
        expect(row.name).toBe('toy');
        expect(row.family).toBe('test');
    });

    it('the same seed builds the same element twice, and a different seed need not', () => {
        const el = toy();
        const a = el.instantiate(rngFor(5));
        const b = el.instantiate(rngFor(5));
        expect(a.instance).toBe(b.instance);
        expect(JSON.stringify(a.construct(SITE))).toBe(JSON.stringify(b.construct(SITE)));
    });

    it('enumerateElementInstantiations covers the whole declared product', () => {
        const rows = enumerateElementInstantiations(toy(), rngFor);
        expect(rows.map((r) => r.instance)).toEqual([
            'toy(a=1,b=x)', 'toy(a=1,b=y)', 'toy(a=2,b=x)', 'toy(a=2,b=y)',
        ]);
    });
});

/* ── The placement, clause by clause ──────────────────────────────────── */

const constructToy = (bad) => () => toy({ bad }).instantiate(rngFor(1)).construct(SITE);

describe('the placement contract — one row per clause, each REFUSED by name', () => {
    it('the legal toy passes', () => {
        expect(() => constructToy()()).not.toThrow();
    });

    it('a cell OUTSIDE the site', () => {
        expect(constructToy({ tiles: [{ x: SITE.x - 1, y: SITE.y, tile: TILE_FLOOR }] }))
            .toThrow(/is OUTSIDE its site/);
    });

    it('an empty footprint', () => {
        expect(constructToy({ tiles: [] })).toThrow(/produced no `tiles`/);
    });

    it('one cell written twice', () => {
        const tiles = toyPlacement(SITE).tiles;
        expect(constructToy({ tiles: [...tiles, tiles[0]] })).toThrow(/wrote \(2,3\) twice/);
    });

    it('a tile that is neither floor nor wall', () => {
        expect(constructToy({ tiles: [{ x: SITE.x, y: SITE.y, tile: 7 }] }))
            .toThrow(/has exactly two tiles/);
    });

    it('⛓ A PORT WRITTEN AS WALL — the mouth that is not a mouth', () => {
        expect(constructToy({ ports: [{ x: SITE.x, y: SITE.y + 2, dir: 'W', role: 'entry' }] }))
            .toThrow(/wrote that cell as WALL/);
    });

    it('a port in the site INTERIOR', () => {
        expect(constructToy({ ports: [{ x: SITE.x + 1, y: SITE.y + 1, dir: 'W', role: 'entry' }] }))
            .toThrow(/is not on its site's EDGE/);
    });

    it('a port facing INWARD', () => {
        expect(constructToy({ ports: [{ x: SITE.x, y: SITE.y, dir: 'E', role: 'entry' }] }))
            .toThrow(/points back INTO its own site/);
    });

    it('no ports at all', () => {
        expect(constructToy({ ports: [] })).toThrow(/declared no `ports`/);
    });

    it('a demand on a cell the element WRITES ITSELF', () => {
        expect(constructToy({ demand: [{ x: SITE.x, y: SITE.y, must: 'wall' }] }))
            .toThrow(/a cell it WRITES itself/);
    });

    it('an area cell on WALL, and an empty area', () => {
        expect(constructToy({ area: { cells: [{ x: SITE.x, y: SITE.y + 2 }], kind: 'element' } }))
            .toThrow(/which it did not write as FLOOR/);
        expect(constructToy({ area: { cells: [], kind: 'element' } }))
            .toThrow(/declared an EMPTY area/);
        expect(constructToy({ area: { cells: [{ x: SITE.x, y: SITE.y }], kind: 'chamber' } }))
            .toThrow(/declared an area of kind/);
    });

    it('an entity on WALL, and one with no id', () => {
        expect(constructToy({ entities: { blocks: [{ x: SITE.x, y: SITE.y + 2 }], buttons: [],
            obstacles: [], items: [] } })).toThrow(/did not write as FLOOR/);
        expect(constructToy({ entities: { blocks: [], buttons: [], obstacles: [],
            items: [{ x: SITE.x, y: SITE.y }] } })).toThrow(/with no `id`/);
        expect(constructToy({ entities: { blocks: [], buttons: [], obstacles: [] } }))
            .toThrow(/has no `entities.items` array/);
    });

    it('a symbol list that is not a list, and a cost that is not a number', () => {
        expect(constructToy({ symbols: { holds: 'sw_A', grants: [] } }))
            .toThrow(/has no `symbols.holds` array/);
        expect(constructToy({ cost: { note: 'cheap' } })).toThrow(/A cost record\s+holds numbers/);
    });

    it('a refusal with no reason is itself a defect', () => {
        const el = toy({ construct: () => ({ refused: {} }) });
        expect(() => el.instantiate(rngFor(1)).construct(SITE)).toThrow(/without a `reason`/);
    });

    it('a legitimate refusal is a VALUE and never a throw', () => {
        const el = toy({ construct: () => ({ refused: { reason: 'TOO_SMALL', detail: 'x' } }) });
        expect(el.instantiate(rngFor(1)).construct(SITE))
            .toEqual({ refused: { reason: 'TOO_SMALL', detail: 'x' } });
    });

    it('the element\'s OWN invariant hook runs, with its values and site', () => {
        let saw = null;
        const el = toy({ assertPlacement: (placement, ctx) => { saw = ctx; ctx.fail('nope'); } });
        expect(() => el.instantiate(rngFor(1), { a: 1, b: 'x' }).construct(SITE)).toThrow(/nope/);
        expect(saw.values).toEqual({ a: 1, b: 'x' });
        expect(saw.site).toEqual(SITE);
    });

    it('a site that is not a rectangle refuses before anything is constructed', () => {
        expect(() => toy().instantiate(rngFor(1)).construct({ x: 0, y: 0, w: 0, h: 3 }))
            .toThrow(/A site is/);
    });
});

/* ── The sweep ────────────────────────────────────────────────────────── */

describe('assertElement — the load-time sweep, and its non-vacuity', () => {
    it('sweeps the toy\'s whole product and reports a census', () => {
        const census = assertElement(toy(), { site: SITE, makeRng: rngFor, seeds: [1, 2] });
        expect(census.constructed).toBe(8);
        expect(census.refused).toEqual({});
        expect(census.rows).toHaveLength(8);
    });

    /**
     * ⛔ AN ELEMENT THAT REFUSES EVERYTHING IS A DEFECT, NOT A GREEN WALL. The
     * sweep would otherwise pass with `constructed: 0` — every clause of the
     * contract vacuously satisfied because no placement was ever produced.
     */
    it('refuses an element that constructed NOTHING over its own domains', () => {
        const el = toy({ construct: () => ({ refused: { reason: 'ALWAYS' } }) });
        expect(() => assertElement(el, { site: SITE, makeRng: rngFor }))
            .toThrow(/constructed NOTHING over its own declared/);
    });

    it('needs a stream — an element\'s GEOMETRY draws, so a sweep without one never ran', () => {
        expect(() => assertElement(toy(), { site: SITE })).toThrow(/needs a `makeRng\(key\)`/);
    });

    /** ⛓ THE REAL SUBJECT: the gadget, over its whole declared product. */
    it('the reverse-pull gadget survives the whole sweep on a generous site', () => {
        const census = assertElement(REVERSE_PULL_BLOCK, {
            site: { x: 2, y: 3, w: 15, h: 15 }, makeRng: rngFor, seeds: [1, 2, 3],
        });
        expect(census.constructed).toBe(51);
        // 3 impossible (len, turns) pairs — (2,2) (2,3) (3,3) — × 3 seeds.
        expect(census.refused).toEqual({ TURNS_EXCEED_LEN: 9 });
        expect(census.constructed + Object.values(census.refused).reduce((a, b) => a + b))
            .toBe(census.rows.length);
    });
});

/* ── ⛓⛓⛓ THE SECOND PHASE (arc 3, slice 4a, D1) ──────────────────────── */

/**
 * ⛔ THE ROOM PROBE THE BINDING BUILDS, drawn as a toy: a 10x10 room whose
 * interior is a one-wide corridor along row 1 with a spur, the START at (1,1)
 * and the GOAL at (8,1). Every clause below breaks exactly one rule.
 */
const ROOM_FLOOR = new Set(['1,1', '2,1', '3,1', '4,1', '5,1', '6,1', '7,1', '8,1', '3,2']);
const ROOM_SITE = Object.freeze({ x: 1, y: 1, w: 8, h: 8 });
const roomProbe = (over = {}) => ({
    width: 10,
    height: 10,
    start: { x: 1, y: 1 },
    goal: { x: 8, y: 1 },
    floorAt: (x, y) => ROOM_FLOOR.has(`${x},${y}`),
    mainPath: [1, 2, 3, 4, 5, 6, 7, 8].map((x) => ({ x, y: 1 })),
    isCut: () => true,
    doorLaw: () => null,
    ...over,
});
const onConnectorSite = (over = {}) => ({ ...ROOM_SITE, room: roomProbe(over) });

/** A minimal LEGAL `on-connector` placement: a lock on (5,1), its opener on the
 *  spur (3,2), and NOT ONE TILE WRITTEN — which is the ordinary corridor case. */
const doorPlacement = (bad = {}) => ({
    tiles: [],
    entities: { blocks: [], buttons: [],
        obstacles: [{ x: 5, y: 1, id: 'door_K' }, { x: 3, y: 2, id: 'body_K' }], items: [] },
    doorCells: [{ x: 5, y: 1 }],
    clearer: [{ x: 3, y: 2 }],
    demand: [],
    area: null,
    symbols: { holds: [], grants: [] },
    cost: { wall: 0, carved: 0 },
    ...bad,
});

const door = (opts = {}) => defineElement({
    name: 'toy-door',
    family: 'test',
    phase: 'on-connector',
    why: 'a legal on-connector element, so the illegal ones differ in exactly one clause',
    params: [],
    construct: opts.construct ?? (() => doorPlacement(opts.bad)),
});

const constructDoor = (opts, site = onConnectorSite()) => () => door(opts)
    .instantiate(rngFor(1), {}).construct(site);

describe('⛓⛓⛓ D1 — the `on-connector` phase, one contract and two shapes', () => {
    it('a phase outside the declared two refuses BY NAME', () => {
        expect(() => defineElement({ name: 'n', family: 'f', construct: () => ({}),
            phase: 'after-pass-2' })).toThrow(/the phases are \[pre-carve, on-connector\]/);
    });

    /** ⛔ THE DEFAULT IS THE OLD LAW — asserted on the element every earlier
     *  slice shipped, so "pre-carve is unchanged" is a row and not a claim. */
    it('`pre-carve` is the DEFAULT, and the shipped gadget is one', () => {
        expect(toy().phase).toBe('pre-carve');
        expect(REVERSE_PULL_BLOCK.phase).toBe('pre-carve');
        expect(REVERSE_PULL_BLOCK.instantiate(rngFor(3), {}).phase).toBe('pre-carve');
    });

    it('an `on-connector` element declares its phase on the concrete instance too', () => {
        expect(door().phase).toBe('on-connector');
        expect(door().instantiate(rngFor(1), {}).phase).toBe('on-connector');
    });

    /** ⛓ THE ORDINARY CORRIDOR CASE WRITES NO TILE AT ALL, and the contract
     *  accepts it — which is the one thing `pre-carve` may never do. */
    it('accepts a placement whose `tiles` are EMPTY and whose entities are the whole of it',
        () => { expect(constructDoor({})().doorCells).toEqual([{ x: 5, y: 1 }]); });

    it('refuses an `on-connector` placement with no entity at all', () => {
        expect(constructDoor({ bad: { entities: { blocks: [], buttons: [],
            obstacles: [], items: [] } } })).toThrow(/with NO entity/);
    });

    it('refuses a write OUTSIDE the site', () => {
        expect(constructDoor({ bad: { tiles: [{ x: 0, y: 0, tile: TILE_WALL }] } }))
            .toThrow(/which is OUTSIDE its site/);
    });

    it('refuses a placement with no `doorCells`, and one with an EMPTY `doorCells`', () => {
        expect(constructDoor({ bad: { doorCells: undefined } }))
            .toThrow(/no `doorCells` array/);
        expect(constructDoor({ bad: { doorCells: [] } }))
            .toThrow(/EMPTY `doorCells`/);
    });

    /**
     * ⚠ THE ENTITY WALK RUNS BEFORE THE DOOR-CELL WALK, so an element that
     * WALLS its own door cell meets the entity clause first — the lock standing
     * there is the same cell. The row asserts the sentence the reader ACTUALLY
     * gets rather than the one the rule order suggests; the door-cell clause's
     * own gate is the clearer half, which has no entity on it.
     */
    it('refuses a door cell the element WALLS, and a clearer on wall', () => {
        expect(constructDoor({ bad: { tiles: [{ x: 5, y: 1, tile: TILE_WALL }] } }))
            .toThrow(/put a obstacles entry at \(5,1\), which this element did not write/);
        expect(constructDoor({ bad: { clearer: [{ x: 7, y: 5 }] } }))
            .toThrow(/named \(7,5\) in `clearer` and it is not FLOOR after this element/);
    });

    it('refuses a door cell OUTSIDE the site', () => {
        expect(constructDoor({ bad: { doorCells: [{ x: 0, y: 1 }] } }))
            .toThrow(/in `doorCells`, which is OUTSIDE its site/);
    });

    /** ⛔ AN ENTITY ON THE SKELETON'S OWN FLOOR IS LEGAL HERE AND ONLY HERE. */
    it('an entity on a cell the SKELETON floored is legal; one on skeleton wall is not', () => {
        expect(constructDoor({ bad: { entities: { blocks: [], buttons: [],
            obstacles: [{ x: 7, y: 1, id: 'door_K' }], items: [] },
        doorCells: [{ x: 7, y: 1 }], clearer: [] } })().doorCells).toEqual([{ x: 7, y: 1 }]);
        expect(constructDoor({ bad: { entities: { blocks: [], buttons: [],
            obstacles: [{ x: 7, y: 5, id: 'door_K' }], items: [] },
        doorCells: [{ x: 7, y: 5 }], clearer: [] } })).toThrow(/did not write as FLOOR/);
    });

    it('refuses a PORT (it stands in the connector) and a declared AREA (it CUTS one)', () => {
        expect(constructDoor({ bad: { ports: [{ x: 1, y: 1, dir: 'W', role: 'entry' }] } }))
            .toThrow(/declared 1 port\(s\)/);
        expect(constructDoor({ bad: { area: { cells: [{ x: 5, y: 1 }], kind: 'element' } } }))
            .toThrow(/A door does not MAKE an area, it CUTS one/);
    });

    /** ⛔ AND THE TRAFFIC RUNS BOTH WAYS: a `pre-carve` element that declared
     *  the door phase's fields is refused too, so the two shapes cannot blur. */
    it('refuses `doorCells` on a `pre-carve` element', () => {
        expect(() => toy({ bad: { doorCells: [{ x: 2, y: 3 }] } })
            .instantiate(rngFor(1), {}).construct(SITE))
            .toThrow(/is a `pre-carve` element and declared/);
    });

    it('refuses an `on-connector` site with no `room` probe, and one missing a member', () => {
        expect(() => door().instantiate(rngFor(1), {}).construct(ROOM_SITE))
            .toThrow(/`room` probe has no `floorAt\(\)`/);
        const { doorLaw, ...rest } = roomProbe();
        expect(() => door().instantiate(rngFor(1), {})
            .construct({ ...ROOM_SITE, room: rest })).toThrow(/`room` probe has no `doorLaw\(\)`/);
        expect(() => door().instantiate(rngFor(1), {})
            .construct({ ...ROOM_SITE, room: roomProbe({ mainPath: undefined }) }))
            .toThrow(/missing width\/height\/start\/goal\/mainPath/);
    });

    /** ⛓ A REFUSAL IS STILL A VALUE, in this phase as in the other. */
    it('an on-connector element may refuse a room BY NAME', () => {
        const refuser = { construct: () => ({
            refused: { reason: 'no-cut-cell', detail: 'the toy says so' } }) };
        expect(constructDoor(refuser)().refused.reason).toBe('no-cut-cell');
    });
});

describe('the direction vocabulary is ONE vocabulary', () => {
    it('PORT_DIRS and DIR_DELTA agree, in the maze engine\'s INPUTS order', () => {
        expect(PORT_DIRS).toEqual(['N', 'S', 'E', 'W']);
        expect(PORT_DIRS.map((d) => [DIR_DELTA[d].dx, DIR_DELTA[d].dy]))
            .toEqual([[0, -1], [0, 1], [1, 0], [-1, 0]]);
    });
});
