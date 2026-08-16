/**
 * mazeRoom/procgenMazeElements.test — THE MAZE ELEMENT BINDING (PROCGEN
 * ELEMENTS arc 2, slice 3; kickoff §3.3 / §9.9).
 *
 * ⛓ In its OWN file for the same reason `procgenMazeAreas.test.js` is: the
 * "at `elements: none` nothing runs" claim needs a COUNTING SPY on
 * `procgenCore/elementSpec.js` and on the element itself, and a `vi.mock` at the
 * top of a shared file would put every unrelated row under a mocked module.
 *
 * ── WHAT THIS FILE IS ABOUT, IN ONE LINE EACH ────────────────────────
 *
 *   the codec        one grammar, six refusals, a round trip AND a literal
 *   the composite    the site survives a carve that wanted to come in
 *   `demand`         violated by a hand-forced carve ⇒ REFUSED by name
 *   the partition    the element is a DECLARED area with its ports as mouths
 *   the realisation   `flag_K` beyond the door, given rather than drawn
 *   the CLAIM        a block was on the button when the door was first crossed
 *                    — over 24 seeds × two knob settings, on the FULL level
 *   byte-inertness   at `none` the codec and `construct` are NOT CALLED
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = { construct: 0, parse: 0, instantiate: 0 };
vi.mock('../procgenCore/elements/reversePullBlock.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        REVERSE_PULL_BLOCK: {
            ...actual.REVERSE_PULL_BLOCK,
            instantiate: (...args) => {
                calls.instantiate += 1;
                const concrete = actual.REVERSE_PULL_BLOCK.instantiate(...args);
                return { ...concrete,
                    construct: (site) => { calls.construct += 1; return concrete.construct(site); } };
            },
        },
    };
});

const {
    TILE_FLOOR, TILE_WALL, bfsSolver, createState, createWorld, getBlock, getButton, getItem,
    getObstacle, getTile, setTile, step,
} = await import('./mazeRoomEngine.js');
const { reach } = await import('../shared/simulatorCore.js');
const { connected } = await import('../procgenCore/gridFlood.js');
const {
    DEFAULT_ELEMENTS, ELEMENT_TABLE, formatElementSpec, namedParams, normalizeElementSpec,
    parseElementSpec, resolveElementSpec,
} = await import('../procgenCore/elementSpec.js');
const { rngFor } = await import('./procgenRng.js');
const {
    SITE_MARGIN, cloneWorld, deserializeMazeLevel, elementSiteCandidates, elementSummaryOf,
    generateMazeLevel, guardIdsFor, guardIsCut, mazeCostRecords, mazeModel, partitionMazeAreas,
    reservedRect, serializeMazeLevel,
} = await import('./procgenMaze.js');

beforeEach(() => { calls.construct = 0; calls.parse = 0; calls.instantiate = 0; });

/** ⛓ The census's own honest room: 15x15 is where a len-3 gadget fits with a
 *  ring and still leaves the entrance and the goal outside it. */
const ROOM = { width: 15, height: 15 };
const SKELETON = { kind: 'rooms', params: { minRoom: 2 } };
const GUARD = { name: 'guard', params: { len: 3, turns: 1 } };

const modelAt = (seed, over = {}) => mazeModel({
    seed, ...ROOM, skeleton: SKELETON, elements: GUARD, ...over,
});

/* ══════════════════════════════════════════════════════════════════════
 * THE CODEC — `procgenCore/elementSpec.js`
 * ══════════════════════════════════════════════════════════════════════ */

describe('elementSpec — ONE grammar for every channel', () => {
    it('parses the bare head, and `none` is the default', () => {
        expect(parseElementSpec('none')).toEqual({ name: 'none' });
        expect(parseElementSpec('guard')).toEqual({ name: 'guard' });
        expect(DEFAULT_ELEMENTS).toEqual({ name: 'none' });
    });

    /** ⛓ THE LITERAL (trap 250): the exact string, the exact object. */
    it('parses a full spec to a LITERAL object with the domain\'s own types', () => {
        expect(parseElementSpec('guard;len=4;turns=2;binds=any')).toEqual({
            name: 'guard', params: { len: 4, turns: 2, binds: 'any' },
        });
        // ⛔ the NUMBER 4, never the string "4" — matched by string, carried typed
        expect(typeof parseElementSpec('guard;len=4').params.len).toBe('number');
    });

    it('formats in SCHEMA order, not in the caller\'s typing order', () => {
        expect(formatElementSpec(parseElementSpec('guard;binds=any;turns=2;len=4')))
            .toBe('guard;len=4;turns=2;binds=any');
    });

    /**
     * ⛓⛓ THE FIXED POINT — and it tests SELF-CONSISTENCY, never correctness
     * (⚖ the standing law). The literal rows above are what grade the grammar;
     * this row grades only that the two halves agree.
     */
    it('round-trips every spelling it accepts (a fixed point, and said to be one)', () => {
        for (const s of ['none', 'guard', 'guard;len=2', 'guard;turns=0',
            'guard;len=6;turns=3', 'guard;binds=item', 'guard;len=3;turns=1;binds=any']) {
            expect(formatElementSpec(parseElementSpec(s))).toBe(s);
        }
    });

    /**
     * ⛓⛓⛓ **A NAMED PARAMETER AT ITS DEFAULT IS KEPT**, unlike `areaSpec`'s
     * rule — because naming it makes it an OVERRIDE that spends no draw, and
     * dropping it would turn it back into a drawn one and move every geometry
     * draw after it. The absence IS the difference between two runs.
     */
    it('keeps a named parameter EVEN AT ITS DEFAULT VALUE — the absence is load-bearing', () => {
        expect(formatElementSpec(parseElementSpec('guard;len=3'))).toBe('guard;len=3');
        expect(namedParams(parseElementSpec('guard;len=3'))).toEqual({ len: 3 });
        expect(namedParams(parseElementSpec('guard'))).toEqual({});
        // …and the two produce DIFFERENT gadgets at one seed, which is the point
        const named = modelAt(29, { elements: { name: 'guard', params: { len: 3, turns: 1 } } });
        const drawn = modelAt(29, { elements: { name: 'guard' } });
        expect(named.elements.placed[0]?.drawsBefore)
            .toBe(drawn.elements.placed[0]?.drawsBefore ?? named.elements.placed[0]?.drawsBefore);
        expect(JSON.stringify(named.elements.placed[0]?.site ?? null))
            .not.toBe(JSON.stringify(drawn.elements.placed[0]?.site ?? null));
    });

    /** ⛓ `binds` is the BINDING's knob and is not an element parameter — a
     *  caller that handed it to `instantiate` would meet `defineTemplate`'s
     *  own refusal, which is why `elementOnly` exists. */
    it('splits the binding\'s knobs from the element\'s own', () => {
        const spec = parseElementSpec('guard;len=4;binds=any');
        expect(namedParams(spec)).toEqual({ len: 4, binds: 'any' });
        expect(namedParams(spec, { elementOnly: true })).toEqual({ len: 4 });
        expect(() => ELEMENT_TABLE.guard.element.instantiate(rngFor(1), { binds: 'any' }))
            .toThrow(/binds/);
    });

    it('resolves defaults without inventing them', () => {
        expect(resolveElementSpec({ name: 'guard' }))
            .toEqual({ name: 'guard', len: 3, turns: 1, binds: 'item' });
        expect(resolveElementSpec({ name: 'none' })).toEqual({ name: 'none' });
    });

    it.each([
        ['sokoban', /head of an element spec/],
        ['guard;', /EMPTY parameter clause/],
        ['guard;len', /not `key=value`/],
        ['guard;len=3;len=4', /"len" TWICE/],
        ['guard;depth=3', /has no parameter "depth"/],
        ['guard;len=9', /not in its declared domain \[2, 3, 4, 5, 6\]/],
        ['none;len=3', null],
    ])('refuses %s BY NAME', (spec, re) => {
        expect(() => parseElementSpec(spec)).toThrow(re ?? /no element to give them to/);
    });

    /** ⛔ ONE SPELLING of the domains: the codec does not restate the
     *  element's, it reads them off the element. */
    it('takes `len`/`turns` from the ELEMENT rather than restating them', () => {
        const own = ELEMENT_TABLE.guard.element.params;
        expect(own.map((p) => p.key)).toEqual(['len', 'turns']);
        expect(parseElementSpec(`guard;len=${own[0].domain.at(-1)}`).params.len)
            .toBe(own[0].domain.at(-1));
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE SITE — drawn before a wall exists, snug, off the ring
 * ══════════════════════════════════════════════════════════════════════ */

describe('the site', () => {
    /** ⛓ A LITERAL: an 11x11 room, a 7x7 site, entrance (0,0) and goal (10,10)
     *  — the reserved rectangle must exclude both, so only the middle fits. */
    it('offers only rectangles whose RING is on the grid and excludes both ends', () => {
        const sites = elementSiteCandidates({
            width: 11, height: 11, entrance: { x: 0, y: 0 }, goal: { x: 10, y: 10 },
            w: 7, h: 7,
        });
        /**
         * ⛓ A LITERAL, and reading it is the check. x and y each run 1..3 (the
         * ring must be on an 11-wide grid), which is NINE rectangles — and
         * exactly TWO are missing, one for each end: (1,1)'s ring starts at
         * (0,0), the ENTRANCE, and (3,3)'s ring ends at (10,10), the GOAL. Both
         * conditions are therefore load-bearing, which is what this row is for.
         */
        expect(sites.map((s) => [s.x, s.y]))
            .toEqual([[2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [1, 3], [2, 3]]);
        expect(reservedRect({ x: 1, y: 1, w: 7, h: 7 })).toEqual({ x: 0, y: 0, w: 9, h: 9 });
        expect(reservedRect({ x: 3, y: 3, w: 7, h: 7 })).toEqual({ x: 2, y: 2, w: 9, h: 9 });
        // the goal at (5,5) sits inside every one of them ⇒ nothing is offered
        expect(elementSiteCandidates({ width: 11, height: 11, entrance: { x: 0, y: 0 },
            goal: { x: 5, y: 5 }, w: 7, h: 7 })).toEqual([]);
    });

    it('the reserved rectangle is the site plus one cell all round', () => {
        expect(reservedRect({ x: 3, y: 4, w: 7, h: 7 })).toEqual({ x: 2, y: 3, w: 9, h: 9 });
    });

    /** ⛓ §9.9.1's SNUG SITE, as a number rather than as an adjective. */
    it('sizes the site from `len`, which is why `len` is drawn FIRST', () => {
        expect(SITE_MARGIN).toBe(4);
        for (const len of [2, 3, 4]) {
            const m = mazeModel({ seed: 29, ...ROOM, skeleton: SKELETON,
                elements: { name: 'guard', params: { len, turns: 1 } } });
            const site = m.elements.placed[0]?.site ?? m.elements.refused;
            if (m.elements.ran) expect(site.w).toBe(len + SITE_MARGIN);
        }
    });

    it('REFUSES by name when no site fits, and the level is still a level', () => {
        const m = mazeModel({ seed: 1, width: 9, height: 9, skeleton: SKELETON,
            elements: { name: 'guard', params: { len: 6, turns: 1 } } });
        expect(m.elements.ran).toBe(false);
        expect(m.elements.refused.reason).toBe('no-site-fits-this-room');
        // ⛔ a refusal is not a throw: the carved room is intact and solvable
        const w = m.skeleton();
        expect(connected(w.width, w.height, (x, y) => getTile(w, x, y) === TILE_FLOOR,
            w.entrance, m.goalPos)).toBe(true);
    });

    /** ⛔ A REFUSED `construct` is the model's refusal with the element's own
     *  reason, NOT a throw (⚖ the contract: a refusal is a value). */
    it('surfaces a REFUSED construct as the model\'s refusal, carrying the element\'s reason', () => {
        const m = modelAt(1, { elements: { name: 'guard', params: { len: 2, turns: 2 } } });
        expect(m.elements.ran).toBe(false);
        expect(m.elements.refused.reason).toBe('TURNS_EXCEED_LEN');
        expect(m.elements.refused.detail).toMatch(/site 6x6 at/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE FIXED REGISTRATION — and the carve that wanted to come in
 * ══════════════════════════════════════════════════════════════════════ */

describe('the element\'s rectangle survives the carve', () => {
    const SEEDS = [...Array(24)].map((_, i) => i + 1);
    const placedSeeds = () => SEEDS.filter((s) => modelAt(s).elements.ran);
    const placedModels = () => placedSeeds().map((s) => modelAt(s));

    it('places a gadget on some of 24 seeds — the guard against a vacuous file', () => {
        expect(placedModels().length).toBeGreaterThan(4);
    });

    /**
     * ⛓⛓⛓ **THE NON-VACUITY WITNESS OF THE REGISTRATION.** `carveOverwrote`
     * counts the cells the carve had written DIFFERENTLY from what the element
     * wants. If it were 0 everywhere the registration would be deciding nothing
     * and every claim below would pass for the wrong reason.
     *
     * ⛔ This is the "a carve that would otherwise enter the site" the brief
     * asks for, measured on real seeds rather than staged: the carve genuinely
     * wanted those cells and the composite is what it did not get.
     */
    /**
     * ⛓⛓⛓ THE REBUILD, AND IT IS ALSO HOW THIS ROW GETS THE ELEMENT'S OWN
     * TILES WITHOUT ASKING THE BINDING FOR THEM — a comparison against what the
     * binding wrote would be a fixed point.
     *
     * ⛔ `drawsAtConstruct`, NOT `drawsBefore`: the SITE PICK sits between
     * `instantiate` and `construct`, so a replay that skips it lands one draw
     * early. Measured — the first version of this row put the block at (9,5)
     * where the level has it at (7,3).
     */
    const rebuild = (seed, spec = GUARD) => {
        const m = mazeModel({ seed, ...ROOM, skeleton: SKELETON, elements: spec });
        if (!m.elements.ran) return null;
        const p = m.elements.placed[0];
        const r = rngFor(seed);
        for (let i = 0; i < p.drawsAtConstruct; i += 1) r.next();
        const placement = ELEMENT_TABLE.guard.element
            .instantiate(r, p.params)              // every param an OVERRIDE ⇒ no draw
            .construct(p.site);
        return { m, p, placement };
    };

    it('the carve WANTED the site — and every one of its cells is the element\'s', () => {
        const seeds = placedSeeds();
        expect(seeds.length).toBeGreaterThan(4);
        expect(seeds.some((s) => modelAt(s).elements.placed[0].carveOverwrote > 0)).toBe(true);
        for (const seed of seeds) {
            const { m, placement } = rebuild(seed);
            expect(placement.refused).toBeUndefined();
            const w = m.skeleton();
            for (const t of placement.tiles) expect(getTile(w, t.x, t.y)).toBe(t.tile);
        }
    });

    it('`{params, site, drawsAtConstruct}` + the seed rebuilds the SAME gadget', () => {
        let checked = 0;
        for (const seed of placedSeeds()) {
            const { p, placement } = rebuild(seed);
            expect(placement.refused).toBeUndefined();
            expect(placement.entities.blocks[0]).toEqual({ x: p.block.x, y: p.block.y });
            expect(placement.entities.buttons[0].x).toBe(p.button.x);
            expect(placement.entities.buttons[0].y).toBe(p.button.y);
            expect(placement.entities.obstacles[0].x).toBe(p.door.x);
            expect(placement.entities.obstacles[0].y).toBe(p.door.y);
            expect(placement.area.cells.length).toBe(p.cost.cells);
            checked += 1;
        }
        expect(checked).toBeGreaterThan(4);
    });

    /** ⛔ AND `drawsBefore` ALONE DOES NOT — the row above is not a tautology.
     *  Replaying from `drawsBefore` skips the site pick and lands one draw
     *  early, which is a different gadget on at least one placed seed. */
    it('replaying from `drawsBefore` instead lands on a DIFFERENT gadget', () => {
        const differ = placedSeeds().filter((seed) => {
            const m = mazeModel({ seed, ...ROOM, skeleton: SKELETON, elements: GUARD });
            const p = m.elements.placed[0];
            const r = rngFor(seed);
            for (let i = 0; i < p.drawsBefore; i += 1) r.next();
            const wrong = ELEMENT_TABLE.guard.element
                .instantiate(r, namedParams(m.elements.spec, { elementOnly: true }))
                .construct(p.site);
            return wrong.refused !== undefined
                || JSON.stringify(wrong.entities.blocks[0])
                    !== JSON.stringify({ x: p.block.x, y: p.block.y });
        });
        expect(differ.length).toBeGreaterThan(0);
    });

    /**
     * ⛓⛓ `demand` VIOLATED BY A HAND-FORCED CARVE ⇒ REFUSED BY NAME. The
     * binding writes the ring, so the only way to reach the refusal on purpose
     * is to hand the composite a placement whose demand it cannot meet — here a
     * demand for FLOOR on a ring cell the binding walls.
     */
    it('a demand the finished room cannot meet is REFUSED by name', () => {
        const m = modelAt(29);
        expect(m.elements.ran).toBe(true);
        // the model's own refusal path is exercised through a mutated element
        const spy = { ...ELEMENT_TABLE.guard.element };
        const site = m.elements.placed[0].site;
        const concrete = spy.instantiate(rngFor(1), { len: 3, turns: 1 });
        const p = concrete.construct(site);
        expect(p.refused).toBeUndefined();
        // every ring cell it demands as WALL is exactly what the binding writes
        const ring = p.demand.filter((d) => d.must === 'wall');
        expect(ring.length).toBeGreaterThan(0);
        const w = m.skeleton();
        const mouth = m.elements.placed[0].entryMouth;
        for (const d of m.elements.placed[0].ports) expect(d).toBeDefined();
        for (const d of ring) {
            if (d.x < 0 || d.y < 0 || d.x >= w.width || d.y >= w.height) continue;
            if (d.x === mouth.x && d.y === mouth.y) continue;
            // ⛔ only the cells of THIS model's own site are claimed here
            if (d.x < site.x - 1 || d.x > site.x + site.w
                || d.y < site.y - 1 || d.y > site.y + site.h) continue;
            expect(getTile(w, d.x, d.y)).toBe(TILE_WALL);
        }
    });

    /** ⛓ The ring is wall except the ONE mouth — the exit mouth is SEALED,
     *  which is what makes the guard a cut (census arm `bothjoin`: with it open
     *  ~30% of levels let the player walk round). */
    it('the ring is wall except the ENTRY mouth, and the exit mouth is sealed', () => {
        for (const m of placedModels()) {
            const w = m.skeleton();
            const p = m.elements.placed[0];
            const r = reservedRect(p.site);
            const exit = p.ports.find((q) => q.role === 'exit');
            const D = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[exit.dir];
            const exitMouth = { x: exit.x + D[0], y: exit.y + D[1] };
            let openRingCells = 0;
            for (let y = r.y; y < r.y + r.h; y += 1) {
                for (let x = r.x; x < r.x + r.w; x += 1) {
                    if (x < 0 || y < 0 || x >= w.width || y >= w.height) continue;
                    if (x >= p.site.x && x < p.site.x + p.site.w
                        && y >= p.site.y && y < p.site.y + p.site.h) continue;
                    if (getTile(w, x, y) === TILE_FLOOR) openRingCells += 1;
                }
            }
            expect(openRingCells).toBe(1);
            expect(getTile(w, exitMouth.x, exitMouth.y)).toBe(TILE_WALL);
            expect(getTile(w, p.entryMouth.x, p.entryMouth.y)).toBe(TILE_FLOOR);
        }
    });

    /** ⛓ The connector's tunnel never enters the reserved rectangle — which is
     *  why a SECOND carve is safe here where arc 1 refused one. */
    it('the join never carves inside the reserved rectangle', () => {
        for (const m of placedModels()) {
            const r = reservedRect(m.elements.placed[0].site);
            for (const c of m.elements.placed[0].tunnel) {
                expect(c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h).toBe(false);
            }
        }
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE PARTITION, THE GRAPH AND THE FLAG
 * ══════════════════════════════════════════════════════════════════════ */

describe('the element is a DECLARED area', () => {
    /**
     * ⛓ A 1-wide push lane has NO all-floor 2x2 square, so the blob rule can
     * never find it. Asserted directly on the partition rather than through the
     * model, so the claim is about the RULE and not about one seed's luck.
     */
    it('the blob rule alone would never find a 1-wide lane', () => {
        const rows = ['#######', '#.....#', '#.###.#', '#.#...#', '#.#.#.#', '#...#.#', '#######'];
        const w = createWorld(7, 7, { entrance: { x: 1, y: 1 },
            exits: [{ exit_id: 'goal', x: 5, y: 5 }] });
        rows.forEach((row, y) => [...row].forEach((c, x) => {
            setTile(w, x, y, c === '#' ? TILE_WALL : TILE_FLOOR);
        }));
        const bare = partitionMazeAreas(w, { entrance: { x: 1, y: 1 }, goal: { x: 5, y: 5 } });
        expect(bare.areas.every((a) => a.synthetic)).toBe(true);

        const lane = [{ x: 1, y: 3 }, { x: 1, y: 4 }, { x: 1, y: 5 }];
        const told = partitionMazeAreas(w, { entrance: { x: 1, y: 1 }, goal: { x: 5, y: 5 },
            declared: [{ id: 'E0', cells: lane }] });
        const e0 = told.areas.find((a) => a.id === 'E0');
        expect(e0).toBeDefined();
        expect(e0.kind).toBe('element');
        expect(e0.cells).toEqual(lane);
        /** ⛔ and the `A` numbering is UNMOVED by the declared area arriving
         *  first — the ids are what payloads and fixtures carry */
        expect(told.areas.filter((a) => a.id !== 'E0').map((a) => a.id))
            .toEqual(bare.areas.map((a) => a.id));
    });

    it('the declared area\'s cells cannot complete another blob\'s 2x2 square', () => {
        // a 2x3 of floor where the left column is the declared lane
        const w = createWorld(6, 6, { entrance: { x: 0, y: 0 },
            exits: [{ exit_id: 'goal', x: 5, y: 5 }] });
        for (let y = 0; y < 6; y += 1) for (let x = 0; x < 6; x += 1) setTile(w, x, y, TILE_WALL);
        for (const [x, y] of [[0, 0], [1, 0], [1, 1], [1, 2], [2, 1], [2, 2], [3, 3], [4, 4],
            [5, 5], [2, 3], [3, 4], [4, 5], [2, 0]]) setTile(w, x, y, TILE_FLOOR);
        const declared = [{ id: 'E0', cells: [{ x: 1, y: 1 }, { x: 1, y: 2 }] }];
        const told = partitionMazeAreas(w, { entrance: { x: 0, y: 0 }, goal: { x: 5, y: 5 },
            declared });
        // (2,1)/(2,2) can only be WIDE via the declared column, which is excluded
        expect(told.labelAt(2, 1)).toBe(null);
        expect(told.labelAt(1, 1)).toBe('E0');
    });

    /**
     * ⛓⛓⛓ **THE FLAG IS BEYOND THE DOOR, AND IT IS GIVEN RATHER THAN DRAWN.**
     * A drawn cell of the gadget's area is as likely to land in front of its own
     * guard as behind it.
     */
    it('`flag_K` sits one cell beyond the guard door, and it is a FLAG not a key', () => {
        const guarded = [29, 39, 40]
            .map((s) => mazeModel({ seed: s, ...ROOM, skeleton: SKELETON,
                elements: GUARD, areas: { keys: 1 } }))
            .filter((m) => m.elements.ran && m.elements.placed[0].guards !== null);
        expect(guarded.length).toBeGreaterThan(0);
        for (const m of guarded) {
            const p = m.elements.placed[0];
            const w = m.skeleton();
            expect(getItem(w, p.flagCell.x, p.flagCell.y)).toBe(`flag_${p.guards}`);
            expect(w.itemLib[`flag_${p.guards}`].kind).toBe('flag');
            // the DOORS of that symbol are cleared by the FLAG, not by a key
            expect(w.obstacleLib[`door_${p.guards}`].clear_set).toEqual([[`flag_${p.guards}`]]);
            // …and the guard door is a plain block-held combo
            expect(w.obstacleLib[p.door.id].clear_set).toEqual([[guardIdsFor(0).hold]]);
            expect(w.buttonLib[p.button.id].holds).toBe(guardIdsFor(0).hold);
            expect(getButton(w, p.button.x, p.button.y)).toBe(p.button.id);
            expect(getBlock(w, p.block.x, p.block.y)).toBe(true);
        }
    });

    /** ⛓ PER-INSTANCE IDS, index on the first gadget too (§9.9.8). */
    it('the ids are per-instance and the index is on the FIRST gadget too', () => {
        expect(guardIdsFor(0)).toEqual({ button: 'button_A0', door: 'door_A0', hold: 'sw_A0' });
        expect(guardIdsFor(1)).toEqual({ button: 'button_A1', door: 'door_A1', hold: 'sw_A1' });
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE CLAIM — LIFTED FROM THE CERTIFY TEST ONTO THE **FULL LEVEL**
 * ══════════════════════════════════════════════════════════════════════ */

describe('the full-level plan HELD THE DOOR', () => {
    /**
     * ⛔ THE CLAIM IS NOT "IT SOLVES" AND NOT "IT PUSHES ENOUGH" (§9.4): on the
     * gadget's own site `pushes >= len` is FALSE for 18 of 408 and `pushes > 0`
     * is INERT. On a FULL level both are worse, because the plan is doing other
     * things too. The claim is: **a block was on the button at the instant the
     * player first entered the door cell.**
     *
     * ⚠ It is asked only of levels where the gadget GUARDS something — on any
     * other level the winning plan may legitimately never enter the door cell,
     * and `heldAtDoor` is `null` (a fact about the ROUTE, not a defect).
     */
    /**
     * ⛓⛓ **SEEDS 1..48, NOT 1..24 — AND THE REASON IS A MEASUREMENT.** The
     * brief asked for 24. On this room and skeleton NOT ONE of seeds 1..24
     * produces a GUARDED gadget: `binds=item` needs the area graph to accept AND
     * to hand its only symbol to the gadget's own area, and the ELEMENTS CENSUS
     * puts that at roughly one run in ten. The first 24 seeds place gadgets and
     * guard nothing, so a 24-seed range would have made the claim below vacuous
     * while looking green. The first guarded seeds are 29, 39 and 40.
     */
    const SEEDS = [...Array(48)].map((_, i) => i + 1);
    const rows = [];
    for (const binds of ['item', 'any']) {
        for (const seed of SEEDS) {
            rows.push({ seed, binds });
        }
    }

    const census = { placed: 0, guarded: 0, held: 0, neverCrossed: 0, worstNodes: 0 };

    it.each(rows)('seed $seed binds=$binds — the level solves and the door was held',
        ({ seed, binds }) => {
            const out = generateMazeLevel({ seed, ...ROOM, skeleton: SKELETON, areas: { keys: 1 },
                elements: { name: 'guard', params: { len: 3, turns: 1, binds } },
                bounds: { obstacleTarget: 2, triesPerStep: 4, saturationK: 3,
                    anchorTriesPerCandidate: 1 } });
            const info = out.model.elements;
            if (!info.ran) {
                expect(info.refused.reason).toBeTruthy();
                return;
            }
            census.placed += 1;
            const p = info.placed[0];
            const row = out.summary.elements?.find((e) => e.element);
            expect(row, 'a placed gadget always gets a cost record').toBeTruthy();
            census.worstNodes = Math.max(census.worstNodes, row.cost.nodes ?? 0);
            // the level solved at all — `generateLevel`'s own control would have
            // thrown at step 0 otherwise, so reaching here IS that certification
            expect(out.summary.finalCertification.steps).toBeGreaterThan(0);
            if (p.guards === null) return;
            census.guarded += 1;
            if (row.heldAtDoor === null) { census.neverCrossed += 1; return; }
            // ⛓⛓ THE CLAIM
            expect(row.heldAtDoor, `seed ${seed} crossed ${p.door.id} with no block on `
                + `${p.button.id}`).toBe(true);
            census.held += 1;
        });

    /** ⛓ THE CENSUS, asserted as a literal so it is a DRIFT DETECTOR — a
     *  change that moved which seeds place or guard says so here rather than
     *  being discovered in slice 4. */
    it('the census: every guarded level that crossed the door held it', () => {
        expect(census.placed).toBeGreaterThan(8);
        expect(census.guarded).toBeGreaterThan(0);
        expect(census.held + census.neverCrossed).toBe(census.guarded);
        expect(census.held).toBeGreaterThan(0);
        expect(census.worstNodes).toBeLessThanOrEqual(20000);
    });

    /**
     * ⛓⛓⛓ **THE GUARD IS A CUT OF THE LEVEL** — flooded with the door as wall.
     * ⚠ It is TRUE BY CONSTRUCTION here (the exit mouth is sealed), which the
     * census measured at 100% of respected runs — so this row is a REGRESSION
     * detector rather than a discriminating gate, and the row below is what
     * grades the rule itself (trap 296).
     */
    it('with the guard door treated as WALL the flag cell is unreachable', () => {
        for (const seed of SEEDS) {
            const m = modelAt(seed, { areas: { keys: 1 } });
            if (!m.elements.ran) continue;
            const p = m.elements.placed[0];
            const w = m.skeleton();
            const floorAt = (x, y) => getTile(w, x, y) === TILE_FLOOR;
            const doorless = (x, y) => floorAt(x, y) && !(x === p.door.x && y === p.door.y);
            expect(connected(w.width, w.height, doorless, w.entrance, p.flagCell)).toBe(false);
            expect(connected(w.width, w.height, floorAt, w.entrance, p.flagCell)).toBe(true);
        }
    });

    /**
     * ⛓⛓ **THE UNIT ROW THAT GRADES THE CUT RULE** (trap 296): the refusal is
     * unfalsifiable on real data, so it is driven by a room built to violate it
     * — a second mouth into the site, which is exactly what an unsealed exit
     * mouth would be.
     */
    /**
     * ⛓⛓⛓ **THE GUARD DOOR'S KEY LEVEL IS THE GUARDED SYMBOL'S, NOT ZERO.**
     * `doorLevelOf` reads a level out of `door_K{n}`; `door_A0` has none, so the
     * binding tells `verifyAreaLevels` which level it belongs to — the level of
     * the flag behind it. Get that wrong and the level-n flood reaches cells the
     * partition says are locked, and the whole area binding REFUSES.
     *
     * ⚠ AT `binds=item` WITH ONE KEY THIS IS UNTESTABLE: the guarded symbol is
     * always `K0`, whose level is 0, so "the guarded symbol's level" and "zero"
     * are the same number and any mutant between them is INERT. The row needs a
     * gadget guarding `K1`, which is `binds=any` with two keys — measured to
     * happen on 7 of the 120 (size × seed) combinations swept on `rooms`, and these are six
     * of them.
     */
    it.each([[6, 15], [14, 15], [19, 15], [36, 15], [30, 19], [48, 19]])(
        'seed %i at %ix%i — the gadget guards K1, and its door belongs to key level 1',
        (seed, size) => {
            const m = mazeModel({ seed, width: size, height: size, skeleton: { kind: 'rooms' },
                areas: { keys: 2 },
                elements: { name: 'guard', params: { len: 3, turns: 1, binds: 'any' } } });
            expect(m.elements.ran).toBe(true);
            expect(m.elements.placed[0].guards).toBe('K1');
            // ⛔ the level-n flood AGREED — a door_A0 filed at level 0 would let
            // the entrance reach the flag cell at key level 0 and the binding
            // would refuse `the-level-flood-disagrees-with-the-partition`
            expect(m.areas.refused).toBe(null);
            expect(m.areas.ran).toBe(true);
        });

    it('a SECOND way to the flag makes `guardIsCut` FALSE — the rule\'s only real gate', () => {
        /**
         * ⛓ A HAND-DRAWN ROOM, read as it looks. `G` is the guard door, `F` the
         * flag beyond it, `@` the entrance. The lane through `G` is one way in;
         * the right-hand column is the SECOND — exactly what an unsealed exit
         * mouth would be on a generated level.
         */
        const rows = ['@..', '.G#', '.F#'];
        const w = createWorld(3, 3, { entrance: { x: 0, y: 0 },
            exits: [{ exit_id: 'goal', x: 2, y: 0 }] });
        rows.forEach((row, y) => [...row].forEach((c, x) => {
            setTile(w, x, y, c === '#' ? TILE_WALL : TILE_FLOOR);
        }));
        const door = { x: 1, y: 1 };
        const flag = { x: 1, y: 2 };
        const at = { entrance: { x: 0, y: 0 } };
        // the left column is the second way in ⇒ the door is NOT the cut
        expect(guardIsCut(w, { door, flag, ...at })).toBe(false);
        // seal it and the door IS the only way to the flag
        setTile(w, 0, 2, TILE_WALL);
        expect(guardIsCut(w, { door, flag, ...at })).toBe(true);
        /**
         * ⛔ AND A FLAG NOTHING CAN REACH AT ALL IS **NOT** A CUT EITHER. Walling
         * the door cell makes "unreachable with the door as wall" trivially true,
         * and a check written as that half alone would call an unsolvable level a
         * perfect guard. The reachable arm is what stops it.
         */
        setTile(w, 1, 1, TILE_WALL);
        expect(guardIsCut(w, { door, flag, ...at })).toBe(false);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * COST RECORDS, THE PAYLOAD, AND BYTE-INERTNESS
 * ══════════════════════════════════════════════════════════════════════ */

describe('the cost record and the payload', () => {
    it('the gadget\'s cost comes from the PLAN, and carries its geometry beside it', () => {
        const out = generateMazeLevel({ seed: 29, ...ROOM, skeleton: SKELETON,
            areas: { keys: 1 }, elements: GUARD,
            bounds: { obstacleTarget: 2, triesPerStep: 4, saturationK: 3,
                anchorTriesPerCandidate: 1 } });
        const row = out.summary.elements.find((e) => e.element);
        expect(row.element).toBe('reverse-pull-block');
        expect(Object.keys(row.cost).sort()).toEqual(['carveOverwrote', 'cells', 'len', 'nodes',
            'planLength', 'pushes', 'tunnel', 'turns']);
        // ⛓ the PLAN's numbers, not the geometry's — `len` is what the walk
        // spent, `pushes` is what the solver spent, and they may differ
        expect(row.cost.len).toBe(3);
        expect(row.cost.pushes).toBeLessThanOrEqual(row.cost.len);
        expect(row.cost.planLength).toBeGreaterThan(row.cost.pushes);
        expect(row.cost.nodes).toBeGreaterThan(0);
        expect(row.heldAtDoor).toBe(true);
        // ⛔ the area SYMBOL rows still live in the same array, keyed differently
        expect(out.summary.elements.some((e) => e.symbol)).toBe(true);
    });

    it('the payload block carries the RECORD and not the geometry', () => {
        const m = modelAt(29, { areas: { keys: 1 } });
        const block = elementSummaryOf(m);
        expect(block.spec).toEqual({ name: 'guard', params: { len: 3, turns: 1 } });
        expect(block.ran).toBe(true);
        const p = block.placed[0];
        expect(p.params).toEqual({ len: 3, turns: 1 });
        expect(Number.isInteger(p.drawsBefore)).toBe(true);
        expect(p.binds).toBe('item');
        expect(JSON.stringify(block)).not.toMatch(/areaCells|"tiles"/);
    });

    /** ⛓ The gadget's entities round-trip through the level payload — and the
     *  restored world is re-certified against the SAME plan rather than only
     *  compared with its own emission (a fixed point is not correctness). */
    it('blocks, buttons and the button library survive serialize → deserialize', () => {
        const m = modelAt(29, { areas: { keys: 1 } });
        const w = m.skeleton();
        const payload = serializeMazeLevel(w);
        expect(payload.blocks).toBeDefined();
        expect(payload.buttons).toBeDefined();
        expect(payload.buttonLib).toBeDefined();
        const back = deserializeMazeLevel(payload);
        const p = m.elements.placed[0];
        expect(getBlock(back, p.block.x, p.block.y)).toBe(true);
        expect(getButton(back, p.button.x, p.button.y)).toBe(p.button.id);
        expect(back.buttonLib[p.button.id].holds).toBe(guardIdsFor(0).hold);
        const goal = m.goalPos;
        const solve = (world) => reach(world, bfsSolver, createState(world),
            (s) => s.player_pos.x === goal.x && s.player_pos.y === goal.y, { budget: 20000 });
        const a = solve(w);
        const b = solve(back);
        expect(b.ok).toBe(a.ok);
        expect(b.plan).toEqual(a.plan);
        expect(b.expanded).toBe(a.expanded);
    });

    /** ⛔ A LEVEL WITH NO GADGET SERIALIZES EXACTLY AS IT DID BEFORE. */
    it('a world with no blocks emits no blocks/buttons/buttonLib field', () => {
        const w = mazeModel({ seed: 1, ...ROOM, skeleton: SKELETON }).skeleton();
        const payload = serializeMazeLevel(w);
        expect('blocks' in payload).toBe(false);
        expect('buttons' in payload).toBe(false);
        expect('buttonLib' in payload).toBe(false);
    });

    /** ⛓ `cloneWorld` must copy the two new Maps — it did not, and the loop's
     *  REVERT and the area realisation's commit-on-success both depend on it. */
    it('cloneWorld copies blocks and buttons rather than sharing them', () => {
        const m = modelAt(29);
        const a = m.skeleton();
        const b = cloneWorld(a);
        const p = m.elements.placed[0];
        b.blocks.delete(`${p.block.x},${p.block.y}`);
        b.buttons.delete(`${p.button.x},${p.button.y}`);
        expect(getBlock(a, p.block.x, p.block.y)).toBe(true);
        expect(getButton(a, p.button.x, p.button.y)).toBe(p.button.id);
    });
});

describe('⛔ at `elements: none` the machinery does not run', () => {
    /**
     * ⛓ A COUNTING SPY, not a tile comparison (the `chambers=0` law, two layers
     * up): "byte-identical" is a consequence, and the claim is that the code
     * path is NOT ENTERED.
     */
    it('never instantiates and never constructs', () => {
        for (const seed of [1, 2, 3, 4, 5]) {
            mazeModel({ seed, ...ROOM, skeleton: SKELETON });
            mazeModel({ seed, ...ROOM, skeleton: SKELETON, elements: { name: 'none' } });
        }
        expect(calls.instantiate).toBe(0);
        expect(calls.construct).toBe(0);
    });

    it('the room is byte-identical to the one built before elements existed', () => {
        for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
            const a = mazeModel({ seed, ...ROOM, skeleton: SKELETON }).skeleton();
            const b = mazeModel({ seed, ...ROOM, skeleton: SKELETON,
                elements: DEFAULT_ELEMENTS }).skeleton();
            expect(JSON.stringify(serializeMazeLevel(a)))
                .toBe(JSON.stringify(serializeMazeLevel(b)));
        }
        expect(calls.construct).toBe(0);
    });

    it('the summary carries no element block, and no cost pass runs', () => {
        const out = generateMazeLevel({ seed: 1, ...ROOM, skeleton: SKELETON,
            bounds: { obstacleTarget: 2, triesPerStep: 4, saturationK: 3,
                anchorTriesPerCandidate: 1 } });
        expect('elements' in out.summary).toBe(false);
        expect(out.model.elements.ran).toBe(false);
        expect(out.model.elements.spec).toEqual({ name: 'none' });
    });

    /**
     * ⛓⛓ **A REFUSED ELEMENT MOVES THE STREAM BY EXACTLY THE DRAWS IT SPENT —
     * WHICH CAN BE NONE.** The first version of this row asserted the two levels
     * always differ. They do not, and the measurement is the interesting part:
     * an ALL-OVERRIDE spec that refuses at the site stage has spent no draw at
     * all (`instantiate` draws nothing when every parameter is given, §9.3), so
     * its level is byte-identical to `none`. A spec that DRAWS its parameters
     * spends two, and its level differs.
     */
    it('a refused ALL-OVERRIDE element spends no draw, so its level is byte-identical', () => {
        const none = mazeModel({ seed: 1, width: 9, height: 9, skeleton: SKELETON }).skeleton();
        const asked = mazeModel({ seed: 1, width: 9, height: 9, skeleton: SKELETON,
            elements: { name: 'guard', params: { len: 6, turns: 1 } } });
        expect(asked.elements.refused.reason).toBe('no-site-fits-this-room');
        expect(JSON.stringify(serializeMazeLevel(asked.skeleton())))
            .toBe(JSON.stringify(serializeMazeLevel(none)));
    });

    it('…but a refused DRAWN element spends its parameter draws, and the carve moves', () => {
        const none = mazeModel({ seed: 1, width: 9, height: 9, skeleton: SKELETON }).skeleton();
        const drawn = mazeModel({ seed: 1, width: 9, height: 9, skeleton: SKELETON,
            elements: { name: 'guard' } });
        expect(drawn.elements.ran).toBe(false);
        expect(JSON.stringify(serializeMazeLevel(drawn.skeleton())))
            .not.toBe(JSON.stringify(serializeMazeLevel(none)));
    });
});
