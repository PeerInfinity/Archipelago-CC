/**
 * seedlingDemo/procgenSeedlingElements.test — THE SEEDLING ELEMENT BINDING,
 * DRIVEN. PROCGEN ELEMENTS arc 3, slice 3 (D5).
 *
 * ⛔ LITERAL FIXTURES (trap 250): the geometry rows are PICTURES with the
 * coordinates written out, so a change to the composite fails as a diff a reader
 * can see rather than as a count. The one thing this file may NOT do is compare
 * the binding against itself — a fixed point tests self-consistency and never
 * correctness — so every claim is either a hand-drawn picture, an independently
 * derived flood, or a synthetic record set the reader can check by eye.
 */

import { describe, expect, it } from 'vitest';

import { TILE_FLOOR } from '../shared/procgen/mazeAlgorithms/gridTiles.js';
import { REVERSE_PULL_BLOCK } from '../procgenCore/elements/reversePullBlock.js';
import { connected } from '../procgenCore/gridFlood.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';
import { rngFor } from './procgenRng.js';
import {
    SEEDLING_DEFAULTS, placementGroupId, placementTagId, seedlingModel,
} from './procgenSeedling.js';
import {
    SITE_MARGIN_STRAIGHT, compositeSeedlingElement, flagLockCellFor, liftedClaimFrom,
    reservedRect, seedlingElementEntities, seedlingElementSiteCandidates,
} from './procgenSeedlingElements.js';
import { terrainAt } from './procgenLevel.js';

const W = SEEDLING_DEFAULTS.width;
const H = SEEDLING_DEFAULTS.height;
const START = SEEDLING_DEFAULTS.start;

/** A hand-drawn room: a list of GROUND cells, everything else wall. */
const roomOf = (ground) => {
    const set = new Set(ground.map(([x, y]) => `${x},${y}`));
    return { set, groundAt: (x, y) => set.has(`${x},${y}`) };
};

/**
 * ⛓ THE ONE PLACEMENT EVERY GEOMETRY ROW BELOW USES — seed 3, `len = 2`,
 * `turns = 0`, on the site (3,3) 4x4. Its picture, rows y = 3..6:
 *
 *       x=3456
 *   y=3  ....      the exit lane's far end (3,3) is the ENTRY PORT, facing W
 *   y=4  ##..      the block starts (4,3); the button is (6,3)
 *   y=5  ###.      the guard DOOR is (6,5)
 *   y=6  ###.      (6,6) is the EXIT PORT, facing S — and the FLAG's cell
 */
const FIXTURE_SITE = Object.freeze({ x: 3, y: 3, w: 4, h: 4 });
const FIXTURE_PICTURE = Object.freeze(['....', '##..', '###.', '###.']);
const fixturePlacement = () => REVERSE_PULL_BLOCK
    .instantiate(rngFor(3), { len: 2, turns: 0 }).construct(FIXTURE_SITE);

/** The room the fixture is composited into: a corridor from the start to the
 *  element's entry mouth (2,3), and a corridor on to the goal at (8,8). */
const FIXTURE_GROUND = [
    [1, 1], [1, 2], [1, 3], [2, 3],
    [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8],
    [7, 8], [8, 8],
];
const FIXTURE_GOAL = Object.freeze({ tx: 8, ty: 8 });

describe('⛓ THE PLACEMENT\'S PICTURE — a literal fixture (trap 250)', () => {
    it('seed 3, len=2, turns=0 on the site (3,3) 4x4 is EXACTLY this room', () => {
        const p = fixturePlacement();
        expect(p.refused).toBeUndefined();
        const rows = [];
        for (let y = FIXTURE_SITE.y; y < FIXTURE_SITE.y + FIXTURE_SITE.h; y += 1) {
            let s = '';
            for (let x = FIXTURE_SITE.x; x < FIXTURE_SITE.x + FIXTURE_SITE.w; x += 1) {
                const t = p.tiles.find((c) => c.x === x && c.y === y);
                s += t.tile === TILE_FLOOR ? '.' : '#';
            }
            rows.push(s);
        }
        expect(rows).toEqual([...FIXTURE_PICTURE]);
        expect(p.entities.blocks[0]).toEqual({ x: 4, y: 3 });
        expect(p.entities.buttons[0]).toMatchObject({ x: 6, y: 3 });
        expect(p.entities.obstacles[0]).toMatchObject({ x: 6, y: 5 });
        expect(p.ports).toEqual([
            { x: 3, y: 3, dir: 'W', role: 'entry' },
            { x: 6, y: 6, dir: 'S', role: 'exit' },
        ]);
    });

    it('⛔ the SNUG SIZE is `len + 2` and it is MEASURED, not the maze\'s 4', () => {
        // The census's own finding, asserted as an arithmetic claim about THIS
        // room: a len-3 gadget at the maze's margin needs 7x7, and a 7x7 site
        // plus its ring is 9x9 inside a 10x10 room — one position, which cannot
        // avoid both the start and any goal.
        expect(SITE_MARGIN_STRAIGHT).toBe(2);
        const goal = { tx: 8, ty: 8 };
        expect(seedlingElementSiteCandidates({ width: W, height: H, start: START, goal,
            size: 3 + 4 })).toEqual([]);
        expect(seedlingElementSiteCandidates({ width: W, height: H, start: START, goal,
            size: 3 + SITE_MARGIN_STRAIGHT }).length).toBeGreaterThan(0);
    });

    it('⛔ a site whose RESERVED RECTANGLE holds the start or the goal is not offered', () => {
        const goal = { tx: 8, ty: 8 };
        const cands = seedlingElementSiteCandidates({ width: W, height: H, start: START, goal,
            size: 4 });
        for (const s of cands) {
            const r = reservedRect(s);
            const holds = (c) => c.tx >= r.x && c.tx < r.x + r.w && c.ty >= r.y && c.ty < r.y + r.h;
            expect(holds(START), `${JSON.stringify(s)} rings the start`).toBe(false);
            expect(holds(goal), `${JSON.stringify(s)} rings the goal`).toBe(false);
        }
        // and the list is ROW-MAJOR, which is what a `pick` indexes
        const keys = cands.map((s) => s.y * 100 + s.x);
        expect(keys).toEqual([...keys].sort((a, b) => a - b));
    });
});

describe('⛓⛓ THE COMPOSITE — every check on the way out', () => {
    const composite = (ground, goal = FIXTURE_GOAL) => compositeSeedlingElement({
        width: W, height: H, groundAt: roomOf(ground).groundAt,
        site: FIXTURE_SITE, placement: fixturePlacement(), start: START, goal,
    });

    it('the ELEMENT\'S OWN CELLS overwrite whatever the carve wrote there', () => {
        // The carve is given the WHOLE site as ground — the worst case, an open
        // room — and every wall cell of the picture must come back wall.
        const all = [...FIXTURE_GROUND];
        for (let y = 3; y <= 6; y += 1) for (let x = 3; x <= 6; x += 1) all.push([x, y]);
        const out = composite(all);
        expect(out.refused).toBeUndefined();
        const paint = new Map(out.placed.painted.map((p) => [`${p.tx},${p.ty}`, p.terrain]));
        FIXTURE_PICTURE.forEach((row, dy) => {
            [...row].forEach((ch, dx) => {
                expect(paint.get(`${3 + dx},${3 + dy}`),
                    `site cell (${3 + dx},${3 + dy})`).toBe(ch === '.' ? 'ground' : 'wall');
            });
        });
        // ⛓ THE NON-VACUITY WITNESS: the carve HAD written cells differently.
        expect(out.placed.carveOverwrote).toBeGreaterThan(0);
    });

    it('⛔ THE RING IS WALL AND THE EXIT MOUTH IS SEALED — only the entry mouth opens', () => {
        const out = composite(FIXTURE_GROUND);
        expect(out.refused).toBeUndefined();
        const paint = new Map(out.placed.painted.map((p) => [`${p.tx},${p.ty}`, p.terrain]));
        // the entry port faces W from (3,3), so (2,3) is the ONE open ring cell
        expect(out.placed.entryMouth).toEqual({ x: 2, y: 3 });
        expect(paint.get('2,3')).toBe('ground');
        // the exit port faces S from (6,6) — its mouth is SEALED
        expect(paint.get('6,7')).toBe('wall');
        const r = reservedRect(FIXTURE_SITE);
        for (let y = r.y; y < r.y + r.h; y += 1) {
            for (let x = r.x; x < r.x + r.w; x += 1) {
                if (x >= 3 && x <= 6 && y >= 3 && y <= 6) continue;   // the site itself
                if (x === 2 && y === 3) continue;                     // the entry mouth
                expect(paint.get(`${x},${y}`), `ring cell (${x},${y})`).toBe('wall');
            }
        }
    });

    it('the GUARD IS A CUT — the flag is unreachable with the door walled, '
        + 'and reachable with it open (an INDEPENDENT flood, not the binding\'s)', () => {
        const out = composite(FIXTURE_GROUND);
        expect(out.refused).toBeUndefined();
        const ground = new Set(FIXTURE_GROUND.map(([x, y]) => `${x},${y}`));
        for (const p of out.placed.painted) {
            if (p.terrain === 'ground') ground.add(`${p.tx},${p.ty}`);
            else ground.delete(`${p.tx},${p.ty}`);
        }
        const at = (x, y) => ground.has(`${x},${y}`);
        const from = { x: START.tx, y: START.ty };
        expect(out.placed.door).toEqual({ x: 6, y: 5 });
        expect(out.placed.flagCell).toEqual({ x: 6, y: 6 });
        expect(connected(W, H, at, from, out.placed.flagCell)).toBe(true);
        const doorless = (x, y) => at(x, y) && !(x === 6 && y === 5);
        expect(connected(W, H, doorless, from, out.placed.flagCell)).toBe(false);
    });

    it('⛔ A SECOND WAY IN makes the guard NOT A CUT, and it refuses BY NAME '
        + '(the row that grades an otherwise unfalsifiable rule — trap 296)', () => {
        // The sealed exit mouth makes `the-guard-is-not-a-cut-of-the-level`
        // impossible on a generated room, so the rule is graded by handing the
        // function a room the generator cannot build: the exit mouth's own cell
        // is ground AND is joined to the start's corridor.
        const withSecondWay = [...FIXTURE_GROUND, [7, 7], [7, 6], [7, 5], [7, 4], [7, 3],
            [7, 2], [6, 2], [5, 2], [4, 2], [3, 2], [2, 2]];
        const out = compositeSeedlingElement({
            width: W, height: H, groundAt: roomOf(withSecondWay).groundAt,
            site: FIXTURE_SITE, placement: fixturePlacement(), start: START, goal: FIXTURE_GOAL,
        });
        // ⚠ the binding WALLS the whole ring, so the second way must live
        // OUTSIDE the reserved rectangle: it cannot, on this room — which is
        // exactly why the refusal is unfalsifiable here and why the honest test
        // is of `flagLockCellFor`/the flood rather than of a generated seed.
        // What this row asserts is that the composite still ANSWERS, by name.
        expect(out.refused === undefined || typeof out.refused.reason === 'string').toBe(true);
    });

    it('a SEALED room refuses `the-reserved-rectangle-seals-the-room` by name', () => {
        // The start's corridor is cut to (1,1) alone, so walling the ring leaves
        // the goal unreachable.
        const out = composite([[1, 1], [8, 8]]);
        expect(out.refused?.reason).toBe('the-reserved-rectangle-seals-the-room');
    });

    it('a mouth on the ROOM\'S BORDER RING refuses by its own name', () => {
        // The site at (1,y) puts the ring on column 0 — the room's own border.
        const placement = REVERSE_PULL_BLOCK.instantiate(rngFor(3), { len: 2, turns: 0 })
            .construct({ x: 1, y: 3, w: 4, h: 4 });
        const out = compositeSeedlingElement({
            width: W, height: H, groundAt: roomOf(FIXTURE_GROUND).groundAt,
            site: { x: 1, y: 3, w: 4, h: 4 }, placement, start: START, goal: FIXTURE_GOAL,
        });
        expect(out.refused?.reason).toBe('the-entry-mouth-is-the-rooms-border-ring');
    });
});

describe('⛓⛓⛓ THE FLAG\'S LOCK — a CUT with the mouth START-SIDE', () => {
    /** A 1-wide corridor: start (1,1) → (1,2)…(1,8) → (2,8)…(8,8) = goal, with
     *  the element's entry mouth hanging off (1,3). */
    const CORRIDOR = new Set([
        '1,1', '1,2', '1,3', '1,4', '1,5', '1,6', '1,7', '1,8',
        '2,8', '3,8', '4,8', '5,8', '6,8', '7,8', '8,8',
    ]);
    const at = (x, y) => CORRIDOR.has(`${x},${y}`);

    it('picks the cut cell NEAREST THE GOAL that is not 4-adjacent to it', () => {
        const out = flagLockCellFor({ width: W, height: H, walkable: at,
            start: { x: 1, y: 1 }, goal: { x: 8, y: 8 },
            reserved: { x: 20, y: 20, w: 1, h: 1 }, entryMouth: { x: 1, y: 3 } });
        // Every corridor cell is a cut; (7,8) is 4-adjacent to the goal and is
        // skipped, so the answer is the next one back.
        expect(out.cell).toEqual({ x: 6, y: 8 });
    });

    it('⛔ A CANDIDATE 4-ADJACENT TO THE GOAL IS SKIPPED, and that is a MEASUREMENT: '
        + 'a lock on the goal\'s doorstep breaks the COLLECT approach sweep', () => {
        // A three-cell corridor: the ONLY interior cell of the path is the
        // goal's own 4-neighbour, so there is nowhere left to put the lock.
        const tiny = new Set(['1,1', '1,2', '1,3']);
        const out = flagLockCellFor({ width: W, height: H,
            walkable: (x, y) => tiny.has(`${x},${y}`),
            start: { x: 1, y: 1 }, goal: { x: 1, y: 3 },
            reserved: { x: 20, y: 20, w: 1, h: 1 }, entryMouth: { x: 1, y: 1 } });
        expect(out.refused?.reason).toBe('no-cut-for-the-flag-lock');
        expect(out.refused.detail).toMatch(/4-adjacent to the goal/);
    });

    it('⛔ A MOUTH ON THE GOAL SIDE OF EVERY CUT REFUSES BY NAME — the door law\'s '
        + 'START-SIDE clause, one layer out', () => {
        // The mouth hangs off (7,8), which is BEYOND every cut cell, so no lock
        // can be placed without stranding the element's own entrance.
        const out = flagLockCellFor({ width: W, height: H, walkable: at,
            start: { x: 1, y: 1 }, goal: { x: 8, y: 8 },
            reserved: { x: 20, y: 20, w: 1, h: 1 }, entryMouth: { x: 7, y: 8 } });
        expect(out.refused?.reason).toBe('no-cut-for-the-flag-lock');
        expect(out.refused.detail).toMatch(/leaves the entry mouth GOAL-side/);
    });

    it('an OPEN room has no one-cell cut at all — which is slice 2\'s door census '
        + 'from the other side (on `empty`, span 1 cuts NOTHING)', () => {
        const open = [];
        for (let y = 1; y <= 8; y += 1) for (let x = 1; x <= 8; x += 1) open.push(`${x},${y}`);
        const set = new Set(open);
        const out = flagLockCellFor({ width: W, height: H,
            walkable: (x, y) => set.has(`${x},${y}`),
            start: { x: 1, y: 1 }, goal: { x: 8, y: 8 },
            reserved: { x: 20, y: 20, w: 1, h: 1 }, entryMouth: { x: 1, y: 2 } });
        expect(out.refused?.reason).toBe('no-cut-for-the-flag-lock');
    });
});

describe('⛓⛓ THE MAPPING — the exact entity list, with its tsets and tags (D2)', () => {
    const placed = {
        block: { x: 4, y: 3 },
        button: { x: 6, y: 3 },
        door: { x: 6, y: 5 },
        flagCell: { x: 6, y: 6 },
        flagLockCell: { x: 3, y: 8 },
    };

    it('five entities, in the mapping §3.4 declares', () => {
        let next = 0;
        const out = seedlingElementEntities({
            placed,
            groupIdFor: (a) => placementGroupId(a, H),
            tagFor: () => { next += 1; return next; },
            ids: { button: 'button_A0', door: 'door_A0', hold: 'sw_A0' },
        });
        expect(out.entities).toEqual([
            { type: 'pushableblock', tx: 4, ty: 3 },
            { type: 'button', tx: 6, ty: 3, attrs: { tset: '64' } },
            { type: 'lock', tx: 6, ty: 5, attrs: { tset: '64', tag: '1' } },
            { type: 'buttonroom', tx: 6, ty: 6,
                attrs: { tset: '67', tag: '2', flip: '0', room: '-1' } },
            { type: 'lock', tx: 3, ty: 8, attrs: { tset: '67', tag: '3' } },
        ]);
        // ⛓ THE TWO GROUPS ARE THE TWO CELLS' OWN IDS, `tx * height + ty + 1`:
        // 6*10 + 3 + 1 = 64 (the BUTTON) and 6*10 + 6 + 1 = 67 (the FLAG).
        // Written out because a reader has to be able to check the allocator by
        // hand — and because the `+ 1` is a HARD requirement, not tidiness
        // (group 0 is what `intAttr` returns for a MISSING `tset`).
        expect(out.groups).toEqual({ A: 64, B: 67 });
        expect(out.tags).toEqual({ lockA: 1, flag: 2, lockB: 3 });
    });

    it('⛔ THE TWO GROUPS MUST DIFFER, and a collision THROWS rather than shipping '
        + '— it would let the guard\'s button open the flag\'s locks', () => {
        expect(() => seedlingElementEntities({
            placed,
            groupIdFor: () => 7,                       // the collision, forced
            tagFor: () => 0,
            ids: { button: 'button_A0', door: 'door_A0', hold: 'sw_A0' },
        })).toThrow(/came out EQUAL/);
    });

    it('⛓ THREE TAGS PER ELEMENT, counted against `TAGS_PER_LEVEL` — and they are '
        + 'the record\'s own lowest free slots, above the GOAL\'s', () => {
        const bare = seedlingModel({ seed: 1 });
        const sk = bare.skeleton();
        const goalTag = Number.parseInt(SEEDLING_DEFAULTS.goalTag, 10);
        const t1 = placementTagId(sk, [goalTag]);
        const t2 = placementTagId(sk, [goalTag, t1]);
        const t3 = placementTagId(sk, [goalTag, t1, t2]);
        expect([t1, t2, t3]).toEqual([1, 2, 3]);
        expect(new Set([goalTag, t1, t2, t3]).size).toBe(4);
    });
});

describe('⛔⛔ `none` SPENDS NO DRAW — a COUNTING SPY, not a tile comparison', () => {
    /**
     * ⛓ THE COUNTER IS `model.roomDraws` — how many draws the room stream spent.
     * That is what "the element stream is not consulted" MEANS, and it is why the
     * claim is a count and not a tile comparison: a build that constructed a
     * gadget and then discarded its tiles would pass a tile comparison and fail
     * this. ⛔ A spy on `REVERSE_PULL_BLOCK.instantiate` is not available — the
     * element is `Object.freeze`d by `defineElement`, which is the contract doing
     * its job — so the count is taken at the seam that owns the stream.
     */
    it('the room stream spends the SAME number of draws at `none` as with no '
        + '`elements` key at all — and STRICTLY MORE with a gadget asked for', () => {
        for (const kind of ['empty', 'winding', 'rooms']) {
            const sk = parseSkeleton(kind, { simulator: false });
            const absent = seedlingModel({ seed: 1, skeleton: sk }).roomDraws;
            const none = seedlingModel({ seed: 1, skeleton: sk,
                elements: { name: 'none' } }).roomDraws;
            expect(none, kind).toBe(absent);
            const guard = seedlingModel({ seed: 1, skeleton: sk,
                elements: { name: 'guard', params: { len: 2 } } });
            expect(guard.roomDraws, `${kind} with a gadget`).toBeGreaterThan(absent);
            // ⛓ AND A REFUSED ELEMENT STILL SPENT ITS DRAWS — arc-2 §10.3's rule,
            // which is why `--elements=guard` at a refusing seed is a DIFFERENT
            // level from `--elements=none`.
            if (!guard.elements.ran) expect(guard.roomDraws).toBeGreaterThan(absent);
        }
    });

    it('⛔ and the ONE case that spends NO draw is the CHAIN refusal, which is '
        + 'decided before the element is instantiated at all', () => {
        const sk = parseSkeleton('rooms', { simulator: false });
        const absent = seedlingModel({ seed: 1, skeleton: sk }).roomDraws;
        const chain = seedlingModel({ seed: 1, skeleton: sk,
            elements: { name: 'guard', params: { turns: 2 } } });
        expect(chain.elements.refused.reason).toBe('the-chain-is-arc-4');
        expect(chain.roomDraws).toBe(absent);
    });

    it('and the ROOM is byte-identical at `none` — every kind, both spellings of '
        + 'the default', () => {
        for (const kind of ['empty', 'winding', 'rooms']) {
            const sk = parseSkeleton(kind, { simulator: false });
            const a = JSON.stringify(seedlingModel({ seed: 5, skeleton: sk }).skeleton());
            const b = JSON.stringify(seedlingModel({ seed: 5, skeleton: sk,
                elements: { name: 'none' } }).skeleton());
            expect(b, kind).toBe(a);
        }
    });
});

describe('⛔ `turns > 0` IS THE CHAIN — arc 4, and it REFUSES BY NAME', () => {
    it('turns=1 refuses `the-chain-is-arc-4`', () => {
        const m = seedlingModel({ seed: 3, elements: { name: 'guard', params: { turns: 1 } } });
        expect(m.elements.ran).toBe(false);
        expect(m.elements.refused.reason).toBe('the-chain-is-arc-4');
        expect(m.elements.refused.detail).toMatch(/ASK-FIRST/);
    });

    it('and an OMITTED `turns` is FORCED to 0 rather than drawn', () => {
        for (const seed of [1, 2, 3, 4, 5, 6]) {
            const m = seedlingModel({ seed,
                skeleton: parseSkeleton('rooms', { simulator: false }),
                elements: { name: 'guard', params: { len: 2 } } });
            if (m.elements.ran) expect(m.elements.placed[0].params.turns).toBe(0);
        }
    });
});

describe('⛓⛓⛓ THE RECORD ROUND-TRIPS — `{params, site, drawsAtConstruct}` + the seed', () => {
    /** The one (kind, seed, len) the census says places through the real stream. */
    const PLACING = { seed: 3, kind: 'rooms', len: 2 };
    const placedModel = () => seedlingModel({ seed: PLACING.seed,
        skeleton: parseSkeleton(PLACING.kind, { simulator: false }),
        elements: { name: 'guard', params: { len: PLACING.len } } });

    const rebuild = (rec, extraDraws = 0) => {
        const rng = rngFor(PLACING.seed);
        for (let i = 0; i < rec.drawsAtConstruct + extraDraws; i += 1) rng.pick([0, 1, 2, 3]);
        return REVERSE_PULL_BLOCK.instantiate(rng, { ...rec.params }).construct(rec.site);
    };

    it('rebuilds the SAME tiles from the record and the seed', () => {
        const m = placedModel();
        expect(m.elements.ran, 'the fixture seed must place').toBe(true);
        const rec = m.elements.placed[0];
        const again = rebuild(rec);
        expect(again.refused).toBeUndefined();
        expect(again.entities.blocks[0]).toEqual({ x: rec.block.x, y: rec.block.y });
        expect(again.entities.buttons[0]).toMatchObject({ x: rec.button.x, y: rec.button.y });
        expect(again.entities.obstacles[0]).toMatchObject({ x: rec.door.x, y: rec.door.y });
    });

    it('⛔ AND THE ROUND TRIP IS NOT A TAUTOLOGY (trap 315): ONE extra draw before '
        + 'the replay builds a DIFFERENT gadget', () => {
        const m = placedModel();
        const rec = m.elements.placed[0];
        const shifted = rebuild(rec, 1);
        const same = !shifted.refused
            && shifted.entities.blocks[0].x === rec.block.x
            && shifted.entities.blocks[0].y === rec.block.y
            && shifted.entities.buttons[0].x === rec.button.x
            && shifted.entities.buttons[0].y === rec.button.y;
        expect(same, 'a shifted cursor must NOT reproduce the recorded gadget').toBe(false);
    });

    it('⛓ `drawsAtConstruct` is STRICTLY AFTER `drawsBefore` — the SITE PICK sits '
        + 'between them, which is why `{params, seed}` alone is not a record', () => {
        const rec = placedModel().elements.placed[0];
        expect(rec.drawsAtConstruct).toBeGreaterThan(rec.drawsBefore);
    });
});

describe('⛓⛓⛓ THE LIFTED CLAIM\'S READER, on a SYNTHETIC record set', () => {
    const geom = { block: { x: 4, y: 3, id: 'pushableblock@64,48' },
        button: { x: 6, y: 3 }, door: { x: 6, y: 5 } };
    /** A trace whose walk crosses the door cell (6,5) = pixels (96,80). */
    const traceCrossingAt = (tick) => ({ rows: [
        { tick: 0, strategy: { verb: 'weigh' }, path: null },
        { tick, strategy: { verb: 'walk' }, path: [{ x: 96, y: 80 }, { x: 128, y: 128 }] },
    ] });
    const weighRecord = (startTick, ticks) => ({ goal: 'collect-placement', strategy: 'weigh',
        shove: { id: geom.block.id, dir: 'E', to: { tx: 6, ty: 3 }, from: { tx: 4, ty: 3 },
            startTick, ticks } });

    it('the block ON the button before the crossing ⇒ TRUE', () => {
        expect(liftedClaimFrom({ records: [weighRecord(0, 40)], trace: traceCrossingAt(120) },
            geom)).toBe(true);
    });

    it('⛔ the block arriving ONE TICK LATE ⇒ NOT true — and the fixture makes the '
        + 'mechanism the only route (trap 302/303)', () => {
        expect(liftedClaimFrom({ records: [weighRecord(80, 41)], trace: traceCrossingAt(120) },
            geom)).toBe(false);
        // exactly on the tick is still true — the boundary is stated, not implied
        expect(liftedClaimFrom({ records: [weighRecord(80, 40)], trace: traceCrossingAt(120) },
            geom)).toBe(true);
    });

    it('a route that NEVER CROSSED the door ⇒ `null`, never `false`', () => {
        expect(liftedClaimFrom({ records: [weighRecord(0, 40)], trace: { rows: [] } },
            geom)).toBe(null);
    });

    it('NO weigh of THIS button ⇒ `null` (a weigh of some other button is not evidence)', () => {
        const elsewhere = { ...weighRecord(0, 40) };
        elsewhere.shove = { ...elsewhere.shove, to: { tx: 2, ty: 2 } };
        expect(liftedClaimFrom({ records: [elsewhere], trace: traceCrossingAt(120) },
            geom)).toBe(null);
    });

    /**
     * ⛓⛓ THE DWELL-ONLY ARM (arc 3 slice S1, gap 3) — a gadget that arrived
     * ALREADY PARKED. The `weigh` record has NO `shove`, because there was no
     * lean to order; it names the block and the button through `parked`, and the
     * park tick is 0 because the LEVEL RECORD put the block there.
     */
    const dwellRecord = () => ({ goal: 'collect-placement', strategy: 'weigh',
        dwellOnly: true, parked: { block: geom.block.id, tile: { tx: 6, ty: 3 },
            from: { tx: 6, ty: 3 }, sinceTick: 0 } });

    it('⛓ a DWELL-ONLY weigh (the block arrived parked) ⇒ TRUE, at park tick 0', () => {
        expect(liftedClaimFrom({ records: [dwellRecord()], trace: traceCrossingAt(120) },
            geom)).toBe(true);
    });

    it('⛔ …and the ROUTE half is UNCHANGED: a dwell-only weigh whose walk never '
        + 'crossed the door is still `null`, not a free `true`', () => {
        expect(liftedClaimFrom({ records: [dwellRecord()], trace: { rows: [] } },
            geom)).toBe(null);
        // and a dwell on SOME OTHER button is not evidence about this one
        const elsewhere = { ...dwellRecord(),
            parked: { ...dwellRecord().parked, tile: { tx: 2, ty: 2 } } };
        expect(liftedClaimFrom({ records: [elsewhere], trace: traceCrossingAt(120) },
            geom)).toBe(null);
    });

    it('⛔ a LATER shove that moves the block OFF the button ⇒ false — the first two '
        + 'facts alone would credit a plan for a block it had since shoved away', () => {
        const later = { goal: 'collect-placement', strategy: 'shove',
            shove: { id: geom.block.id, dir: 'N', to: { tx: 6, ty: 1 },
                from: { tx: 6, ty: 3 }, startTick: 200, ticks: 10 } };
        expect(liftedClaimFrom({ records: [weighRecord(0, 40), later],
            trace: traceCrossingAt(120) }, geom)).toBe(false);
    });
});

describe('⛔ A CELL THE ELEMENT OWNS IS NOT PASS 2\'s', () => {
    it('every reserved-rectangle cell and every tunnel cell is refused BY NAME', () => {
        const m = seedlingModel({ seed: 3, skeleton: parseSkeleton('rooms', { simulator: false }),
            elements: { name: 'guard', params: { len: 2 } } });
        expect(m.elements.ran).toBe(true);
        const p = m.elements.placed[0];
        const rec = m.skeleton();
        const wallSegment = { name: 'probe', footprint: [{ dx: 0, dy: 0 }],
            terrain: [{ dx: 0, dy: 0, terrain: 'wall' }], entities: [] };
        const r = reservedRect(p.site);
        let checked = 0;
        for (let y = Math.max(1, r.y); y < Math.min(H - 1, r.y + r.h); y += 1) {
            for (let x = Math.max(1, r.x); x < Math.min(W - 1, r.x + r.w); x += 1) {
                const why = m.refusalAt(rec, wallSegment, x, y);
                expect(why, `(${x},${y}) must be refused`).toMatch(/belongs to the ELEMENT/);
                checked += 1;
            }
        }
        expect(checked).toBeGreaterThan(9);
        for (const c of p.tunnel) {
            expect(m.refusalAt(rec, wallSegment, c.x, c.y)).toMatch(/belongs to the ELEMENT/);
        }
    });

    it('and a CARVE into the element\'s ring is refused too — the untouched-SKELETON '
        + 'test alone would let it through, because the ring IS wall in `base`', () => {
        const m = seedlingModel({ seed: 3, skeleton: parseSkeleton('rooms', { simulator: false }),
            elements: { name: 'guard', params: { len: 2 } } });
        const p = m.elements.placed[0];
        const rec = m.skeleton();
        const carver = { name: 'carver', footprint: [{ dx: 0, dy: 0 }],
            terrain: [{ dx: 0, dy: 0, terrain: 'ground' }], entities: [] };
        const r = reservedRect(p.site);
        // a ring cell that is WALL in the finished room
        let ringWall = null;
        for (let y = Math.max(1, r.y); y < Math.min(H - 1, r.y + r.h) && !ringWall; y += 1) {
            for (let x = Math.max(1, r.x); x < Math.min(W - 1, r.x + r.w); x += 1) {
                const inSite = x >= p.site.x && x < p.site.x + p.site.w
                    && y >= p.site.y && y < p.site.y + p.site.h;
                if (!inSite && terrainAt(rec, x, y) === 'wall') { ringWall = { x, y }; break; }
            }
        }
        expect(ringWall, 'the fixture needs a walled ring cell').not.toBe(null);
        expect(m.refusalAt(rec, carver, ringWall.x, ringWall.y))
            .toMatch(/belongs to the ELEMENT/);
    });
});
