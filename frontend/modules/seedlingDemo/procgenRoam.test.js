/**
 * procgenRoam.test — **THE ROAMING ENEMY'S SEEDLING BINDING** (concept library
 * F1, D4).
 *
 * The rows ask the four things the binding adds for a `none`-law element:
 *
 *   1. NO LOCK — the composite gives a placement with bodies and `killLock:
 *      false` no `killLockCell`, and the mapping realises it as spinners only,
 *      spending NO tag.
 *   2. THE TEXTLESS GOAL — a level whose COMMITTED record holds a roaming body
 *      certifies against `ROAMING_GOAL_CLASS`; every other level keeps
 *      `torchpickup` (a `chamber` level at the same seed is the control).
 *   ⛓ F1b re-pinned rows 2-6 on THROUGH-ROOM subjects (the F1 subjects' blobs
 *   were dead-end rooms; most now refuse `the-through-room-is-not-on-the-route`):
 *   `rooms` 10x10 s10 places (INERT pre-sword, COSTS post-sword 127 vs 69), and
 *   `winding` 14x14 s12 is the solver's refusal on both boots.
 *   3. THE NAMED CERTIFICATION REFUSAL — `winding` 14x14 seed 12 (F1b's scan; F1's was `rooms` 10):
 *      the solver REFUSES the room with the body in it, on both boots, and the
 *      gap is `the-solver-cannot-cross-the-roaming-body` with the solver's own
 *      words; the level ships with the element DROPPED and the torch back.
 *   4. THE KILL-LOCK CLAUSE — a `tset:-1` lock offered to a room that holds a
 *      roaming body is refused BY NAME at the anchor; the same template in a
 *      room without one is not.
 *   5. (D5) THE BODY ABLATION — the level solved with and without its bodies at
 *      the SAME boot: `empty` s2 pre-sword is INERT (the body stays in its side
 *      room), `branchy` s7 post-sword COSTS (149 vs 86 ticks, measured at F1).
 *   6. (D7) THE PIPELINE ROOM — `generateGenRoom` with `elements: 'roam'`
 *      builds at re-roll 0 with the bodies in it and AP location 0 on the goal
 *      cell (the assembler matches the goal by POSITION, so the textless class
 *      rides through untouched).
 */

import { describe, expect, it } from 'vitest';

import { ROAM } from '../procgenCore/elements/roam.js';
import {
    BODY_ABLATION_VERDICTS, ROAMING_GOAL_CLASS, SEEDLING_DEFAULTS, bodyAblation,
    generateSeedlingLevel, seedlingModel, seedlingSeam, seedlingSkeletonSpec,
} from './procgenSeedling.js';
import { GRADES } from '../procgenCore/differentialGrade.js';
import { generateGenRoom, placeGenItems } from './seedlingGenRoom.js';
import { compositeSeedlingElement, seedlingElementEntities } from './procgenSeedlingElements.js';
import {
    POST_SWORD_ITEMS, POST_SWORD_PALETTE, PRE_SWORD_ITEMS, PRE_SWORD_PALETTE,
} from './procgenPalette.js';
import { rngFor } from './procgenRng.js';
import { TILE_FLOOR } from '../shared/procgen/mazeAlgorithms/gridTiles.js';

const ROOMS = seedlingSkeletonSpec('rooms');
const goalOf = (record) => record.entities.find((e) => e.attrs?.tag === SEEDLING_DEFAULTS.goalTag
    && e.type !== 'spinner');

describe('roam — the composite and the mapping carry NO lock', () => {
    /** A 10x10 open room, a 3x3 roam blob at (3,3), start (1,1), goal (8,8). */
    const placementAt = (seed) => {
        const site = { x: 3, y: 3, w: 3, h: 3 };
        const concrete = ROAM.instantiate(rngFor(seed), { w: 3, h: 3, bodies: 2 });
        return { site, placement: concrete.construct(site) };
    };
    const open = (x, y) => x > 0 && y > 0 && x < 9 && y < 9;

    it('killLock:false records the bodies and a NULL kill lock; killLock:true (the arena\'s '
        + 'law) puts one on a cut', () => {
        const { site, placement } = placementAt(3);
        const args = { width: 10, height: 10, groundAt: open, site, placement,
            start: { tx: 1, ty: 1 }, goal: { tx: 8, ty: 8 } };
        const roam = compositeSeedlingElement({ ...args, killLock: false });
        expect(roam.refused, roam.refused?.detail).toBeUndefined();
        expect(roam.placed.bodies).toHaveLength(2);
        expect(roam.placed.killLockCell).toBeNull();
        /** ⛓ the default is the arena's — every caller before F1 is unchanged. */
        const arena = compositeSeedlingElement(args);
        if (!arena.refused) expect(arena.placed.killLockCell).not.toBeNull();
        else expect(arena.refused.reason).toBe('no-cut-for-the-kill-lock');
    });

    it('realises each body as `spinner {tag:-1}`, no lock, and spends NO tag', () => {
        const placed = { door: null, killLockCell: null,
            bodies: [{ x: 4, y: 4, id: 'roam_body_0' }, { x: 5, y: 4, id: 'roam_body_1' }] };
        let asked = 0;
        const out = seedlingElementEntities({ placed, groupIdFor: () => 1,
            tagFor: () => { asked += 1; return 7; }, ids: null });
        expect(asked).toBe(0);
        expect(out.tags).toEqual({});
        expect(out.entities.map((e) => e.type)).toEqual(['spinner', 'spinner']);
        expect(out.entities.every((e) => e.attrs.tag === '-1')).toBe(true);
    });
});

/**
 * ⛓⛓⛓ F1b (D2) — **THE THROUGH-ROOM COMPOSITE**, on hand-built rooms so each
 * row is one clause. A 12x10 room, a 3x3 blob at (5,3) (reserved rectangle
 * x 4..8, y 2..6), start (1,4), goal (10,4). The blob's N entry (6,3) has its
 * mouth at (6,2); its paired S exit (6,5) has its mouth at (6,6). `walls` are
 * the skeleton's walls beside the border ring.
 */
describe('F1b — the through-room: both mouths open, both joined, and a CUT', () => {
    const W = 12;
    const H = 10;
    const site = { x: 5, y: 3, w: 3, h: 3 };
    const placement = (() => {
        const tiles = [];
        const cells = [];
        for (let y = site.y; y < site.y + site.h; y += 1) {
            for (let x = site.x; x < site.x + site.w; x += 1) {
                tiles.push({ x, y, tile: TILE_FLOOR });
                cells.push({ x, y });
            }
        }
        return { tiles,
            entities: { blocks: [], buttons: [], items: [],
                obstacles: [{ x: 6, y: 4, id: 'roam_body_0' }] },
            ports: [{ x: 6, y: 3, dir: 'N', role: 'entry' }, { x: 6, y: 5, dir: 'S', role: 'exit' }],
            demand: [], area: { cells, kind: 'element' },
            symbols: { holds: [], grants: [] }, cost: { cells: 9 } };
    })();
    const roomWith = (walls, h = H) => {
        const wall = new Set(walls.map(([x, y]) => `${x},${y}`));
        return (x, y) => x > 0 && y > 0 && x < W - 1 && y < h - 1 && !wall.has(`${x},${y}`);
    };
    /** The separators: the top row splits between (6,1) and (7,1), the bottom two
     *  rows at x=5..6 — so left and right meet only through the reserved
     *  rectangle, and each mouth is one wall cell from its own side. */
    const SPLIT = [[6, 1], [7, 1], [5, 7], [6, 7], [5, 8]];
    const run = (groundAt, over = {}) => compositeSeedlingElement({ width: W, height: H,
        groundAt, site, placement, start: { tx: 1, ty: 4 }, goal: { tx: 10, ty: 4 },
        killLock: false, through: true, ...over });
    const paintedAt = (placed, x, y) => placed.painted.find((c) => c.tx === x && c.ty === y)
        ?.terrain;

    it('opens BOTH mouths as floor and JOINS both — entry to the start, exit to the goal', () => {
        const out = run(roomWith(SPLIT));
        expect(out.refused, out.refused?.detail).toBeUndefined();
        const p = out.placed;
        expect(p.through).toBe(true);
        expect(p.entryMouth).toEqual({ x: 6, y: 2 });
        expect(p.exitMouth).toEqual({ x: 6, y: 6 });
        expect(paintedAt(p, 6, 2)).toBe('ground');
        expect(paintedAt(p, 6, 6)).toBe('ground');
        expect(p.tunnel).toEqual([{ x: 6, y: 1 }]);
        expect(p.exitTunnel).toEqual([{ x: 6, y: 7 }]);
        expect(p.killLockCell).toBeNull();
        // ⛓ every OTHER ring cell is wall — the blob has exactly two openings.
        const ring = p.painted.filter((c) => !(c.tx >= 5 && c.tx <= 7 && c.ty >= 3 && c.ty <= 5)
            && c.tx >= 4 && c.tx <= 8 && c.ty >= 2 && c.ty <= 6);
        expect(ring.filter((c) => c.terrain === 'ground').map((c) => `${c.tx},${c.ty}`))
            .toEqual(['6,2', '6,6']);
    });

    it('THE CUT HOLDS: with the blob walled the goal is unreachable from the start', () => {
        const p = run(roomWith(SPLIT)).placed;
        const ground = new Set(p.painted.filter((c) => c.terrain === 'ground')
            .map((c) => `${c.tx},${c.ty}`));
        const wallSet = new Set(p.painted.filter((c) => c.terrain === 'wall')
            .map((c) => `${c.tx},${c.ty}`));
        const base = roomWith(SPLIT);
        const at = (x, y) => !(x >= 5 && x <= 7 && y >= 3 && y <= 5)
            && (ground.has(`${x},${y}`) || (!wallSet.has(`${x},${y}`) && base(x, y)));
        const seen = new Set(['1,4']);
        const queue = [[1, 4]];
        while (queue.length) {
            const [x, y] = queue.shift();
            for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                const k = `${x + dx},${y + dy}`;
                if (!seen.has(k) && at(x + dx, y + dy)) { seen.add(k); queue.push([x + dx, y + dy]); }
            }
        }
        expect(seen.has('10,4')).toBe(false);
        expect(seen.has('6,2')).toBe(true);
    });

    it('refuses a room the OUTSIDE already joins, before any tunnel, BY NAME', () => {
        const out = run(roomWith([]));
        expect(out.refused?.reason).toBe('the-through-room-is-not-on-the-route');
        expect(out.refused.detail).toMatch(/before either tunnel is carved/);
    });

    it('refuses a room whose TUNNEL joins the two sides round the blob, BY NAME', () => {
        // (7,1) open: the entry tunnel (6,1) now touches the goal's side too.
        const out = run(roomWith(SPLIT.filter(([x, y]) => !(x === 7 && y === 1))));
        expect(out.refused?.reason).toBe('the-through-room-is-not-on-the-route');
        expect(out.refused.detail).toMatch(/joined the two sides/);
    });

    it('refuses an exit mouth on the border ring, BY NAME, and never seals it instead', () => {
        // A 7-high room: the S exit's mouth (6,6) is the border ring.
        const out = compositeSeedlingElement({ width: W, height: 7, groundAt: roomWith([], 7),
            site, placement, start: { tx: 1, ty: 4 }, goal: { tx: 10, ty: 4 },
            killLock: false, through: true });
        expect(out.refused?.reason).toBe('the-exit-mouth-is-the-rooms-border-ring');
        // ⛓ The same room without `through` asks the entry alone.
        const sealed = compositeSeedlingElement({ width: W, height: 7, groundAt: roomWith([], 7),
            site, placement, start: { tx: 1, ty: 4 }, goal: { tx: 10, ty: 4 }, killLock: false });
        expect(sealed.refused?.reason).not.toBe('the-exit-mouth-is-the-rooms-border-ring');
    });

    it('refuses a through-room that SHORTENS the walk, BY NAME', () => {
        /** The skeleton's only way across is a U inside the rectangle (17 steps);
         *  the through-room crosses it straight on row 4 (9 steps). The ports are
         *  the blob's W/E pair so the route is the straight one. */
        const u = new Set(['4,2', '4,3', '4,4', '4,5', '4,6', '5,6', '6,6', '7,6', '8,6', '8,5',
            '8,4', '8,3', '8,2']);
        const walls = [[6, 1], [6, 7], [6, 8], [3, 3], [3, 4], [3, 5], [3, 6], [9, 3], [9, 4],
            [9, 5], [9, 6]];
        for (let y = 2; y <= 6; y += 1) {
            for (let x = 4; x <= 8; x += 1) if (!u.has(`${x},${y}`)) walls.push([x, y]);
        }
        const we = { ...placement, ports: [{ x: 5, y: 4, dir: 'W', role: 'entry' },
            { x: 7, y: 4, dir: 'E', role: 'exit' }] };
        const out = run(roomWith(walls), { placement: we });
        expect(out.refused?.reason).toBe('the-through-room-shortens-the-way');
        expect(out.refused.detail).toMatch(/from 17 steps to 9/);
    });

    /** ⛓ The SAME room sealed is F1's `the-reserved-rectangle-seals-the-room` —
     *  the refusal a through-room turns into a placement; and on an open room
     *  (where a through-room is refused) the sealed element places with its exit
     *  mouth WALL and no exit keys in its record. */
    it('a sealed element at the SAME site still seals: the exit mouth is wall, no exit keys', () => {
        expect(run(roomWith(SPLIT), { through: false }).refused?.reason)
            .toBe('the-reserved-rectangle-seals-the-room');
        const out = run(roomWith([]), { through: false });
        expect(out.refused, out.refused?.detail).toBeUndefined();
        expect(paintedAt(out.placed, 6, 6)).toBe('wall');
        expect(paintedAt(out.placed, 6, 2)).toBe('ground');
        for (const k of ['through', 'exitMouth', 'exitTunnel']) {
            expect(Object.keys(out.placed)).not.toContain(k);
        }
    });
});

describe('roam — the textless goal is the COMMITTED record\'s', () => {
    it('is `totempart`, a different class from the default torch', () => {
        expect(ROAMING_GOAL_CLASS).toBe('totempart');
        expect(SEEDLING_DEFAULTS.goalClass).toBe('torchpickup');
    });

    /** ⛓ `rooms` seed 10 places a through-room (F1b's scan) — and the SAME seed
     *  with the chamber head is the control that keeps the torch. */
    it('a level holding a roaming body certifies against the textless goal; a chamber '
        + 'level at the same seed keeps the torch', () => {
        const roam = seedlingModel({ seed: 10, skeleton: ROOMS, elements: { name: 'roam' } });
        expect(roam.elements.placed[0].through).toBe(true);
        expect(roam.elements.ran).toBe(true);
        expect(roam.roamingBodies.length).toBeGreaterThan(0);
        expect(roam.goalClass).toBe(ROAMING_GOAL_CLASS);
        const sk = roam.skeleton();
        expect(goalOf(sk).type).toBe(ROAMING_GOAL_CLASS);
        expect(sk.entities.filter((e) => e.type === 'lock')).toEqual([]);
        expect(sk.entities.filter((e) => e.type === 'spinner'))
            .toHaveLength(roam.roamingBodies.length);

        const chamber = seedlingModel({ seed: 10, skeleton: ROOMS, elements: { name: 'chamber' } });
        expect(chamber.roamingBodies).toEqual([]);
        expect(chamber.goalClass).toBe('torchpickup');
        expect(goalOf(chamber.skeleton()).type).toBe('torchpickup');
    });

    it('a roam level whose element REFUSED keeps the torch (the record holds no body)', () => {
        const m = seedlingModel({ seed: 1, elements: { name: 'roam' } });
        expect(m.elements.ran).toBe(false);
        expect(m.roamingBodies).toEqual([]);
        expect(goalOf(m.skeleton()).type).toBe('torchpickup');
    });
});

describe('roam — the solver\'s refusal is the element\'s, BY NAME', () => {
    /** ⛓ F1b — a 2x4 blob whose two bodies stand in the corridor's own column:
     *  the route MUST cross them, which is W0's refusing half. */
    for (const [boot, items] of [['pre-sword', PRE_SWORD_ITEMS], ['post-sword', POST_SWORD_ITEMS]]) {
        it(`winding 14x14 seed 12, ${boot}: the-solver-cannot-cross-the-roaming-body, with the `
            + 'solver\'s own words, and the element is DROPPED', () => {
            const seam = seedlingSeam({ seed: 12, items, skeleton: seedlingSkeletonSpec('winding'),
                defaults: { width: 14, height: 14 }, elements: { name: 'roam' } });
            const c = seam.certification;
            expect(c.certified).toBe(false);
            expect(c.verdict).toBe('REFUSED');
            expect(c.gap).toBe('the-solver-cannot-cross-the-roaming-body');
            expect(c.reasonText).toMatch(/the combat ladder is EXHAUSTED/);
            expect(seam.model.elements.ran).toBe(false);
            expect(seam.model.roamingBodies).toEqual([]);
            expect(goalOf(seam.model.skeleton()).type).toBe('torchpickup');
        });
    }
});

describe('roam — a kill lock in a room that holds a roaming body is refused BY NAME', () => {
    /** A fake pass-2 template: nothing but a `tset:-1` lock on one cell. */
    const killLock = Object.freeze({ name: 'probe-kill-lock', footprint: [{ dx: 0, dy: 0 }],
        terrain: [], entities: [{ type: 'lock', dx: 0, dy: 0, attrs: { tset: '-1' } }] });
    const firstFree = (m) => m.interiorCells(m.skeleton()).find((c) => m.isFree(m.skeleton(),
        c.tx, c.ty));

    it('refuses it where the record holds a roaming body', () => {
        const m = seedlingModel({ seed: 10, skeleton: ROOMS, elements: { name: 'roam' } });
        const c = firstFree(m);
        expect(m.refusalAt(m.skeleton(), killLock, c.tx, c.ty))
            .toMatch(/a-kill-lock-would-count-the-roaming-bodies/);
    });

    it('does not, where it holds none (the chamber at the same seed)', () => {
        const m = seedlingModel({ seed: 10, skeleton: ROOMS, elements: { name: 'chamber' } });
        const c = firstFree(m);
        expect(m.refusalAt(m.skeleton(), killLock, c.tx, c.ty) ?? '')
            .not.toMatch(/a-kill-lock-would-count-the-roaming-bodies/);
    });
});

describe('roam — the BODY ABLATION (D5)', () => {
    const level = (kind, seed, palette) => generateSeedlingLevel({ seed, palette,
        skeleton: seedlingSkeletonSpec(kind), elements: { name: 'roam' } });

    /** ⛓ Two of the three BORROW the differential's words with the differential's
     *  meaning (INERT = equal cost, NOT-ESTABLISHED = no claim); `COSTS` is the
     *  ablation's own and is NOT added to `GRADES`, whose six words are pinned
     *  across both substrates. */
    it('declares three verdicts and adds NO word to differentialGrade.GRADES', () => {
        expect(BODY_ABLATION_VERDICTS).toEqual(['INERT', 'COSTS', 'NOT-ESTABLISHED']);
        expect(Object.values(GRADES)).toEqual(['STRONG', 'BOUND-DEPENDENT', 'WEAK', 'INERT',
            'SHORTENS', 'NOT-ESTABLISHED']);
        expect(Object.values(GRADES)).not.toContain('COSTS');
        expect(GRADES.INERT).toBe('INERT');
        expect(GRADES.NOT_ESTABLISHED).toBe('NOT-ESTABLISHED');
    });

    it('is absent from the summary of a level with no roaming body', () => {
        const lv = generateSeedlingLevel({ seed: 2, palette: PRE_SWORD_PALETTE,
            elements: { name: 'chamber' } });
        expect(lv.summary.bodyAblation).toBeUndefined();
        expect(bodyAblation({ model: lv.model, out: lv, palette: PRE_SWORD_PALETTE })).toBeNull();
    });

    /**
     * ⛓⛓ **THE SAME-BOOT PIN.** A body the walk crosses without touching is
     * INERT — and INERT is only reachable if the two arms ran at ONE boot:
     * the pre-sword and post-sword solves of any room differ (the census's empty
     * control is 218 vs 123), so an ablation whose without-arm ran at the other
     * boot reads COSTS or NOT-ESTABLISHED here (F1 mutant (b)).
     */
    it('rooms s10 pre-sword: INERT — both arms SOLVED in the same tick count, the body removed',
        () => {
            const lv = level('rooms', 10, PRE_SWORD_PALETTE);
            const a = lv.summary.bodyAblation;
            expect(lv.summary.goalClass).toBe(ROAMING_GOAL_CLASS);
            expect(a.removed).toBe(a.bodies);
            expect(a.withBodies.verdict).toBe('SOLVED');
            expect(a.withoutBodies.verdict).toBe('SOLVED');
            expect(a.withoutBodies.ticks).toBe(a.withBodies.ticks);
            expect(a.verdict).toBe('INERT');
        });

    /** ⛓ F1b — the SAME through-room one boot later: the route crosses the blob
     *  and the bodies cost it 58 ticks (measured, 127 vs 69). */
    it('rooms s10 post-sword: COSTS — the route crosses the bodies (127 vs 69 ticks)', () => {
        const a = level('rooms', 10, POST_SWORD_PALETTE).summary.bodyAblation;
        expect(a.verdict).toBe('COSTS');
        expect([a.withBodies.ticks, a.withoutBodies.ticks]).toEqual([127, 69]);
        expect(a.withBodies.ticks).toBeGreaterThan(a.withoutBodies.ticks);
        expect(a.deltaTicks).toBe(a.withBodies.ticks - a.withoutBodies.ticks);
    });
});

describe('roam — the pipeline room (D7, re-measured at F1b)', () => {
    /** An rng whose first draw yields `seed` as the room's drawn seed (the gen-room tests' own). */
    const rngDrawing = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
    /**
     * ⛓⛓ F1b — **THE PIPELINE ROOM'S OPEN 10x10 NEVER HOLDS A THROUGH-ROOM**:
     * over drawn seeds 1-300 (pre-sword 300 built, post-sword 296 + 4 pre-existing
     * pass-2 throws) not one places the element — the outside always joins the
     * start and the goal. F1's 8 of 13 were dead-end rooms. ⇒ the row pins the
     * room that still BUILDS, keeps the torch and seats location 0 on the goal.
     */
    for (const biome of ['pre-sword', 'post-sword']) {
        it(`${biome}: drawn seed 16807 builds at re-roll 0, the through-room REFUSED, the torch `
            + 'kept, and location 0 on the goal cell', () => {
            const { world } = generateGenRoom({ region_id: 'roam', exits: [{}],
                size: { width: 10, height: 10 }, rng: rngDrawing(16807),
                params: { seedlingGen: { biome, elements: 'roam' } } });
            expect(world.generation.rerolls).toBe(0);
            expect(world.generation.elements).toBe('roam');
            expect(world.record.entities.filter((e) => e.type === 'spinner')).toEqual([]);
            expect(world.record.entities.filter((e) => e.type === 'lock')).toEqual([]);
            const goal = world.record.entities.find((e) => e.x === world.goalCell.tx * 16
                && e.y === world.goalCell.ty * 16);
            expect(goal.type).toBe('torchpickup');
            placeGenItems(world, { items_to_place: ['Sword'] });
            expect(world.locations[0].cell).toEqual(world.goalCell);
            expect(world.locations[0].tag).toBe(0);
        });
    }
});
