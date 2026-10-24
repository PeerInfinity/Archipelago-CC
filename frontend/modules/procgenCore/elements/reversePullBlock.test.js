/**
 * procgenCore/elements/reversePullBlock.test — THE GADGET'S GEOMETRY.
 *
 * PROCGEN ELEMENTS arc 2, slice 2 (kickoff §3.2.1). ⛔ THIS FILE ASKS ONLY
 * GEOMETRIC QUESTIONS. Whether the thing is SOLVABLE is a question for an
 * engine, and `procgenCore/` imports no engine — that half lives in
 * `mazeRoom/reversePullBlock.certify.test.js` and it is the one that counts.
 *
 * ⚠ THE PROPERTIES ARE RECOMPUTED FROM THE WALK, NOT READ OFF THE PLACEMENT.
 * `buildReversePull` is exported so the walk record is visible; every claim
 * below rebuilds the cell set from `{button, dirs}` with the direction table
 * and compares. A test that read the same array the constructor wrote would be
 * a fixed point, and a fixed point tests self-consistency and never
 * correctness.
 */

import { describe, expect, it } from 'vitest';

import { ProcgenRng } from '../procgenRng.js';
import { DIR_DELTA } from '../elements.js';
import { connected } from '../gridFlood.js';
import {
    BUTTON_ID, DOOR_GAP, DOOR_ID, HOLD_ID, MIN_SITE, REVERSE_PULL_BLOCK, buildReversePull,
} from './reversePullBlock.js';
import { TILE_FLOOR, TILE_WALL } from '../../shared/procgen/mazeAlgorithms/gridTiles.js';

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
    name: 'mulberry32 (reversePullBlock.test)',
    assertSeed: (seed) => seed,
    create: (seed) => {
        const next = mulberry32(seed);
        return { next, nextIndex: (n) => Math.floor(next() * n), get state() { return 0; } };
    },
});
const rngFor = (seed) => new ProcgenRng(seed, { source: SOURCE });

const GENEROUS = Object.freeze({ x: 2, y: 3, w: 15, h: 15 });
const SEEDS = [...Array(24)].map((_, i) => i + 1);
const PAIRS = [];
for (let len = 2; len <= 6; len += 1) for (let turns = 0; turns <= 3; turns += 1) {
    PAIRS.push({ len, turns });
}

const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
const key = (c) => `${c.x},${c.y}`;
const go = (c, d) => ({ x: c.x + DIR_DELTA[d].dx, y: c.y + DIR_DELTA[d].dy });
const inSite = (s, c) => c.x >= s.x && c.x < s.x + s.w && c.y >= s.y && c.y < s.y + s.h;

/**
 * ⛓ THE INDEPENDENT RECONSTRUCTION — the block path, the stance cells, the
 * corner cells and the two corridors, derived from `{button, e, dirs}` alone.
 * This is what every set claim below is compared against.
 */
function rebuild(walk, site) {
    const { button, e, dirs } = walk;
    const len = dirs.length;
    const path = [button];
    for (let i = 0; i < len; i += 1) path.push(go(path[i], dirs[i]));
    const stances = dirs.map((d, i) => go(path[i + 1], d));
    const corners = [];
    for (let i = 0; i < len - 1; i += 1) {
        if (dirs[i + 1] !== dirs[i]) corners.push(go(stances[i], dirs[i + 1]));
    }
    const exitCells = [];
    for (let c = go(button, e); inSite(site, c); c = go(c, e)) exitCells.push(c);
    const entryCells = [];
    for (let c = stances[len - 1]; inSite(site, c); c = go(c, dirs[len - 1])) entryCells.push(c);
    const bypass = go(exitCells[0], dirs[0]);
    return { path, stances, corners, exitCells, entryCells, bypass,
        door: exitCells[DOOR_GAP - 1],
        exitPort: exitCells[exitCells.length - 1],
        entryPort: entryCells[entryCells.length - 1],
        all: new Set([...path, ...stances, ...corners, bypass, ...exitCells, ...entryCells]
            .map(key)) };
}

/** Every (len, turns, seed) that BUILT on the generous site. */
const BUILT = [];
for (const { len, turns } of PAIRS) {
    for (const seed of SEEDS) {
        const out = buildReversePull({ len, turns }, GENEROUS, rngFor(seed));
        BUILT.push({ len, turns, seed, out });
    }
}

/* ── What it refuses, by name ─────────────────────────────────────────── */

describe('the refusals — each by NAME, and the deterministic two spend NO draw', () => {
    it('turns > len-1 is impossible and says so, before any draw', () => {
        for (const { len, turns } of PAIRS.filter((p) => p.turns > p.len - 1)) {
            const rng = rngFor(1);
            const out = buildReversePull({ len, turns }, GENEROUS, rng);
            expect(out.refused.reason).toBe('TURNS_EXCEED_LEN');
            expect(rng.draws).toBe(0);
        }
        // …and it is exactly the three pairs (2,2) (2,3) (3,3).
        expect(PAIRS.filter((p) => p.turns > p.len - 1).map((p) => `${p.len},${p.turns}`))
            .toEqual(['2,2', '2,3', '3,3']);
    });

    it('a site under MIN_SITE on either axis refuses SITE_TOO_SMALL, before any draw', () => {
        for (const site of [{ x: 0, y: 0, w: 3, h: 9 }, { x: 0, y: 0, w: 9, h: 3 },
            { x: 0, y: 0, w: 1, h: 1 }]) {
            const rng = rngFor(1);
            expect(buildReversePull({ len: 3, turns: 1 }, site, rng).refused.reason)
                .toBe('SITE_TOO_SMALL');
            expect(rng.draws).toBe(0);
        }
        expect(MIN_SITE).toBe(4);
    });

    /**
     * ⚠ THE HONEST REFUSAL: the site is big enough for SOME gadget and the
     * draws did not find one for THIS (len, turns). It is the only refusal that
     * spends draws, and the only one a bigger bound could change — which is why
     * the bound is named in the message rather than tuned until this row
     * disappears.
     */
    it('a site that is legal but cramped refuses WALK_NOT_FOUND', () => {
        const tiny = { x: 0, y: 0, w: 4, h: 4 };
        const out = buildReversePull({ len: 6, turns: 3 }, tiny, rngFor(1));
        expect(out.refused.reason).toBe('WALK_NOT_FOUND');
        expect(out.refused.detail).toMatch(/independent draws/);
        // …and the same site DOES build the smallest gadget, so the refusal is
        // about the parameters and not about the site being unusable.
        expect(buildReversePull({ len: 2, turns: 0 }, tiny, rngFor(1)).refused).toBeUndefined();
    });

    it('every outcome on the generous site is a build or one of the three names', () => {
        const names = new Set(BUILT.map((b) => b.out.refused?.reason ?? 'BUILT'));
        expect([...names].sort()).toEqual(['BUILT', 'TURNS_EXCEED_LEN']);
    });
});

/* ── The walk ─────────────────────────────────────────────────────────── */

describe('the walk — exactly `turns` changes, never a reversal, never its own path', () => {
    it('holds for every (len, turns) × 24 seeds', () => {
        let checked = 0;
        for (const { len, turns, out } of BUILT) {
            if (out.refused) continue;
            const { dirs } = out.walk;
            expect(dirs).toHaveLength(len);
            let changes = 0;
            for (let i = 1; i < dirs.length; i += 1) {
                if (dirs[i] !== dirs[i - 1]) changes += 1;
                // ⛓ NEVER A REVERSAL — the block pulled back over the cell it
                // just came from. Guarded TWICE in the constructor (the draw is
                // from PERP, and the path cells must be distinct), which is why
                // a mutant has to drop both to be seen.
                expect(dirs[i]).not.toBe(OPPOSITE[dirs[i - 1]]);
            }
            expect(changes).toBe(turns);
            checked += 1;
        }
        expect(checked).toBe(17 * 24);
    });

    it('the first pull is PERPENDICULAR to the exit direction — the bypass depends on it', () => {
        for (const { out } of BUILT) {
            if (out.refused) continue;
            const { e, dirs } = out.walk;
            expect(dirs[0]).not.toBe(e);
            expect(dirs[0]).not.toBe(OPPOSITE[e]);
        }
    });

    it('the block path never repeats a cell', () => {
        for (const { out } of BUILT) {
            if (out.refused) continue;
            const path = rebuild(out.walk, GENEROUS).path;
            expect(new Set(path.map(key)).size).toBe(path.length);
        }
    });
});

/* ── The carve ────────────────────────────────────────────────────────── */

describe('the carve — the floor IS the path, the stances, the corners and the two corridors', () => {
    it('every built gadget: floor cells === the independent reconstruction', () => {
        for (const { out } of BUILT) {
            if (out.refused) continue;
            const want = rebuild(out.walk, GENEROUS).all;
            const floor = new Set(out.placement.tiles
                .filter((t) => t.tile === TILE_FLOOR).map(key));
            expect([...floor].sort()).toEqual([...want].sort());
            // …and everything else in the site is WALL: the element writes its
            // whole rectangle, which is what lets the ports be on its edge.
            expect(out.placement.tiles).toHaveLength(GENEROUS.w * GENEROUS.h);
            expect(out.placement.tiles.filter((t) => t.tile === TILE_WALL).length)
                .toBe(GENEROUS.w * GENEROUS.h - floor.size);
            // …the DECLARED area is exactly the floor, and the cost counts it.
            expect(new Set(out.placement.area.cells.map(key))).toEqual(floor);
            expect(out.placement.cost.cells).toBe(floor.size);
        }
    });

    it('the block STARTS at the far end of the walk and the button is where it ends', () => {
        for (const { len, out } of BUILT) {
            if (out.refused) continue;
            const r = rebuild(out.walk, GENEROUS);
            expect(out.placement.entities.blocks).toEqual([{ x: r.path[len].x, y: r.path[len].y }]);
            expect(out.placement.entities.buttons)
                .toEqual([{ x: r.path[0].x, y: r.path[0].y, id: BUTTON_ID }]);
            expect(out.placement.symbols).toEqual({ holds: [HOLD_ID], grants: [] });
        }
    });

    /** ⛓ §3.1-AS-BUILT / trap 302 — the law this whole element is shaped around. */
    it('door_A is on the exit axis and NEVER within DOOR_GAP of button_A', () => {
        for (const { out } of BUILT) {
            if (out.refused) continue;
            const b = out.placement.entities.buttons[0];
            const d = out.placement.entities.obstacles[0];
            expect(d.id).toBe(DOOR_ID);
            expect(Math.abs(d.x - b.x) + Math.abs(d.y - b.y)).toBe(DOOR_GAP);
            expect(d.x === b.x || d.y === b.y).toBe(true);
        }
    });

    it('both ports are on the site EDGE, on FLOOR, facing OUT', () => {
        for (const { out } of BUILT) {
            if (out.refused) continue;
            const floor = new Set(out.placement.tiles
                .filter((t) => t.tile === TILE_FLOOR).map(key));
            expect(out.placement.ports.map((p) => p.role).sort()).toEqual(['entry', 'exit']);
            for (const p of out.placement.ports) {
                expect(floor.has(key(p))).toBe(true);
                expect(inSite(GENEROUS, p)).toBe(true);
                expect(inSite(GENEROUS, go(p, p.dir))).toBe(false);
            }
        }
    });

    /**
     * ⛓⛓ THE DOOR IS THE CUT — the gadget's whole claim, re-flooded here from
     * the PLACEMENT (the constructor floods the carved set; this floods the
     * tiles it actually wrote, which is what a binding will stamp).
     */
    it('entry reaches exit, and does NOT with door_A treated as wall', () => {
        for (const { out } of BUILT) {
            if (out.refused) continue;
            const floor = new Set(out.placement.tiles
                .filter((t) => t.tile === TILE_FLOOR).map(key));
            const d = out.placement.entities.obstacles[0];
            const entry = out.placement.ports.find((p) => p.role === 'entry');
            const exit = out.placement.ports.find((p) => p.role === 'exit');
            const local = (c) => ({ x: c.x - GENEROUS.x, y: c.y - GENEROUS.y });
            const walk = (x, y) => floor.has(`${x + GENEROUS.x},${y + GENEROUS.y}`);
            const shut = (x, y) => walk(x, y)
                && !(x + GENEROUS.x === d.x && y + GENEROUS.y === d.y);
            expect(connected(GENEROUS.w, GENEROUS.h, walk, local(entry), local(exit))).toBe(true);
            expect(connected(GENEROUS.w, GENEROUS.h, shut, local(entry), local(exit))).toBe(false);
        }
    });

    it('the demand ring is the whole ring outside the site, minus the two mouths', () => {
        const { out } = BUILT.find((b) => !b.out.refused);
        const ring = (GENEROUS.w + 2) * (GENEROUS.h + 2) - GENEROUS.w * GENEROUS.h;
        expect(out.placement.demand).toHaveLength(ring - 2);
        expect(new Set(out.placement.demand.map((d) => d.must))).toEqual(new Set(['wall']));
        for (const p of out.placement.ports) {
            expect(out.placement.demand.some((d) => key(d) === key(go(p, p.dir)))).toBe(false);
        }
    });
});

/* ── Literal fixtures (trap 250) ──────────────────────────────────────── */

/**
 * ⛔ EXACT CELLS, not properties about cells. A property suite can be satisfied
 * by a gadget nobody would recognise; these four say what the thing LOOKS LIKE.
 *
 *   '#' wall · '.' floor · 'B' the block's start · 'b' button_A ·
 *   'D' door_A · 'I' the entry port · 'O' the exit port
 */
const render = (placement, site) => {
    const ch = new Map();
    for (const t of placement.tiles) ch.set(key(t), t.tile === TILE_FLOOR ? '.' : '#');
    for (const b of placement.entities.blocks) ch.set(key(b), 'B');
    for (const b of placement.entities.buttons) ch.set(key(b), 'b');
    for (const o of placement.entities.obstacles) ch.set(key(o), 'D');
    for (const p of placement.ports) ch.set(key(p), p.role === 'entry' ? 'I' : 'O');
    const rows = [];
    for (let y = site.y; y < site.y + site.h; y += 1) {
        let r = '';
        for (let x = site.x; x < site.x + site.w; x += 1) r += ch.get(`${x},${y}`);
        rows.push(r);
    }
    return rows;
};

const NINE = Object.freeze({ x: 0, y: 0, w: 9, h: 9 });

describe('literal fixtures — the exact gadget, on a 9×9 site', () => {
    it('seed 1, len=3 turns=1 — one turn, and the bypass cell beside the button', () => {
        const { walk, placement } = buildReversePull({ len: 3, turns: 1 }, NINE, rngFor(1));
        expect(render(placement, NINE)).toEqual([
            '#########',
            '#########',
            '#########',
            '###...b##',
            '###.B..##',
            '####.#D##',
            '####.#.##',
            '####.#.##',
            '####I#O##',
        ]);
        expect(walk.e).toBe('S');
        expect(walk.dirs).toEqual(['W', 'W', 'S']);
        expect(placement.entities).toEqual({
            blocks: [{ x: 4, y: 4 }],
            buttons: [{ x: 6, y: 3, id: BUTTON_ID }],
            obstacles: [{ x: 6, y: 5, id: DOOR_ID }],
            items: [],
        });
        expect(placement.ports).toEqual([
            { x: 4, y: 8, dir: 'S', role: 'entry' },
            { x: 6, y: 8, dir: 'S', role: 'exit' },
        ]);
        expect(placement.cost).toEqual({ len: 3, turns: 1, cells: 16 });
        // ⛓ (5,4) is the BYPASS: without it the player, standing at (5,3) after
        // the last push, could not reach the corridor at (6,4) — the block is
        // on (6,3) and there is no other way round.
        expect(render(placement, NINE)[4][5]).toBe('.');
    });

    it('seed 4, len=2 turns=0 — a straight lane (Seedling\'s `weigh` shape)', () => {
        const { walk, placement } = buildReversePull({ len: 2, turns: 0 }, NINE, rngFor(4));
        expect(render(placement, NINE)).toEqual([
            '###O#####',
            '###.#####',
            '###D#####',
            '##..#####',
            'IB.b#####',
            '#########',
            '#########',
            '#########',
            '#########',
        ]);
        expect(walk.dirs).toEqual(['W', 'W']);
        expect(placement.cost).toEqual({ len: 2, turns: 0, cells: 9 });
    });

    it('seed 7, len=5 turns=3 — three turns, three corner cells', () => {
        const { walk, placement } = buildReversePull({ len: 5, turns: 3 }, NINE, rngFor(7));
        expect(render(placement, NINE)).toEqual([
            'O....D.b#',
            '#####...#',
            '#####...#',
            'I....B.##',
            '#####..##',
            '#########',
            '#########',
            '#########',
            '#########',
        ]);
        expect(walk.dirs).toEqual(['S', 'W', 'S', 'S', 'W']);
        expect(placement.cost).toEqual({ len: 5, turns: 3, cells: 23 });
    });

    /**
     * ⛓ ABSOLUTE CELLS, PROVED BY TRANSLATION. The same seed on a site offset by
     * (+4,+6) is the identical picture with every coordinate shifted — which is
     * what "the element writes ABSOLUTE cells" has to mean and what a
     * relative-footprint bug would break in exactly one place.
     */
    it('the same draw on an OFFSET site is the same gadget, translated', () => {
        const OFFSET = { x: 4, y: 6, w: 9, h: 9 };
        const a = buildReversePull({ len: 3, turns: 1 }, NINE, rngFor(1));
        const b = buildReversePull({ len: 3, turns: 1 }, OFFSET, rngFor(1));
        expect(render(b.placement, OFFSET)).toEqual(render(a.placement, NINE));
        expect(b.placement.entities.buttons).toEqual([{ x: 10, y: 9, id: BUTTON_ID }]);
        expect(b.placement.entities.blocks).toEqual([{ x: 8, y: 10 }]);
        expect(b.placement.ports).toEqual([
            { x: 8, y: 14, dir: 'S', role: 'entry' },
            { x: 10, y: 14, dir: 'S', role: 'exit' },
        ]);
    });
});

/* ── Identity ─────────────────────────────────────────────────────────── */

describe('the element, through the contract', () => {
    it('two runs of the same seed are the same bytes', () => {
        const a = REVERSE_PULL_BLOCK.instantiate(rngFor(9)).construct(GENEROUS);
        const b = REVERSE_PULL_BLOCK.instantiate(rngFor(9)).construct(GENEROUS);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('⚠ overriding BOTH parameters spends no parameter draw — and the walk still draws', () => {
        const rng = rngFor(9);
        const el = REVERSE_PULL_BLOCK.instantiate(rng, { len: 4, turns: 2 });
        expect(rng.draws).toBe(0);
        expect(el.instance).toBe('reverse-pull-block(len=4,turns=2)');
        el.construct(GENEROUS);
        // The geometry is seeded detail BENEATH the declared domain: the same
        // (len, turns) on two streams is two different gadgets.
        expect(rng.draws).toBeGreaterThan(0);
        const other = REVERSE_PULL_BLOCK.instantiate(rngFor(10), { len: 4, turns: 2 });
        expect(JSON.stringify(other.construct(GENEROUS)))
            .not.toBe(JSON.stringify(REVERSE_PULL_BLOCK.instantiate(rngFor(9),
                { len: 4, turns: 2 }).construct(GENEROUS)));
    });

    it('the defaults are the ones the docblock argues for', () => {
        expect(REVERSE_PULL_BLOCK.params.map((p) => [p.key, p.default, [...p.domain]]))
            .toEqual([['len', 3, [2, 3, 4, 5, 6]], ['turns', 1, [0, 1, 2, 3]]]);
        expect(REVERSE_PULL_BLOCK.family).toBe('guard');
    });
});
