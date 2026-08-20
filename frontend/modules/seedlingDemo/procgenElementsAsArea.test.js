/**
 * seedlingDemo/procgenElementsAsArea.test — **ELEMENTS-AS-AREA, AND C11's
 * LAW**: an element declares floor as an AREA and the partition/graph consume
 * it through the SAME seam the guard's uses; and a DROPPED area-bearing
 * element TAKES ITS AREA WITH IT.
 *
 * PROCGEN ELEMENTS arc 5, slice 3 (§3.3; arc-3 kickoff §18.2 C11). ⛔ There is
 * no second partition mechanism to test: the chamber reaches
 * `partitionAreas({declared})` by the very line the guard reaches it by
 * (`procgenSeedling`'s `declaredAreas`), and what these rows assert is that the
 * consequences follow.
 *
 * ── ⛓⛓⛓ C11, IN ONE SENTENCE ─────────────────────────────────────────
 *
 * *A dropped area-bearing element re-runs the partition WITHOUT it and the
 * graph re-adjudicates; a refusal there is the level's honest grade, by name.*
 *
 * ⛔ THE ROWS BELOW ARE NOT VACUOUS AND THAT IS MEASURED: over `winding`,
 * `branchy`, `bushy`, `loopy` and `open` × seeds 1..12 at 20x20, **44 of 44
 * runs that ACCEPT with the chamber REFUSE without it**, every one of them with
 * `no-area-at-that-key-level-can-hold-its-key` — so the "the graph
 * re-adjudicates" half of the law is exercised by real data rather than
 * asserted about a stale object nothing would have noticed.
 */

import { describe, expect, it } from 'vitest';

import { wideBlobs } from '../procgenCore/areaPartition.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import { reachableFrom } from '../procgenCore/gridFlood.js';
import { seedlingModel, seedlingSkeletonSpec } from './procgenSeedling.js';
import { deriveSites } from '../procgenCore/sites.js';
import { terrainAt } from './procgenLevel.js';

const SPEC = 'chamber;w=2;h=3';
const KINDS = ['winding', 'branchy', 'bushy', 'loopy', 'open'];
const SEEDS = [...Array(12)].map((_, i) => i + 1);
const key = (c) => `${c.x},${c.y}`;

const modelFor = (kind, seed, extra = {}) => seedlingModel({
    seed,
    skeleton: seedlingSkeletonSpec(kind),
    defaults: { width: 20, height: 20 },
    elements: parseElementSpec(SPEC),
    ...extra,
});

/** Every (kind, seed) at 20x20 whose chamber actually PLACED. */
const PLACED = [];
for (const kind of KINDS) {
    for (const seed of SEEDS) {
        if (modelFor(kind, seed).elements.ran) PLACED.push({ kind, seed });
    }
}

describe('the chamber\'s blob is an area BOTH vocabularies agree about', () => {
    it('placed on enough of the ladder for the rows below to mean anything', () => {
        expect(PLACED.length).toBeGreaterThan(20);
    });

    /**
     * ⛓⛓⛓ **THE SITE VOCABULARY SEES IT AS A CHAMBER.** `sites.js`' `chamber`
     * class passes the WHOLE live ground to `wideBlobs` — it has no declared
     * areas — so the element's blob has to be a chamber THERE on its own
     * merits, or the binding would be declaring an area the room's own
     * derivation calls corridor. ⛔ ASKED of the derived sites of a real
     * chamber-bearing skeleton, not of the element in isolation.
     */
    it('every cell of the element\'s blob is in `sites.chamber`', () => {
        let checked = 0;
        for (const { kind, seed } of PLACED) {
            const m = modelFor(kind, seed);
            /** ⛓ `model.sites` speaks TILES (`{tx, ty}`) and the partition speaks
             *  CELLS (`{x, y}`) — the same grid in the two vocabularies this
             *  binding keeps apart, translated here rather than assumed equal. */
            const chamberCells = new Set(m.sites.chamber.map((t) => `${t.tx},${t.ty}`));
            for (const c of m.elements.placed[0].areaCells) {
                expect(chamberCells.has(key(c)), `${kind}/${seed} ${key(c)}`).toBe(true);
                checked += 1;
            }
        }
        expect(checked).toBeGreaterThan(100);
    });

    /** ⛓ AND THE PARTITION CARRIES IT AS `E0`, kind `element` — the guard's
     *  own id and kind, from the same `declaredAreas` line. */
    it('the partition carries it as a DECLARED area of kind `element`', () => {
        for (const { kind, seed } of PLACED) {
            const p = modelFor(kind, seed).areaPartition();
            const declared = p.areas.filter((a) => a.kind === 'element');
            expect(declared, `${kind}/${seed}`).toHaveLength(1);
            expect(declared[0].id).toBe('E0');
        }
    });

    /**
     * ⛔ **EXCLUDED FROM THE BLOB RULE, WHICH IS THE SEAM'S OWN DIFFERENCE 1.**
     * A declared area's cells belong to it and to nothing else, so no `A*`
     * chamber may contain one — and this is what makes "one mechanism" a
     * measurement rather than a diff-reading.
     */
    it('no discovered chamber contains a declared cell', () => {
        for (const { kind, seed } of PLACED) {
            const m = modelFor(kind, seed);
            const declared = new Set(m.elements.placed[0].areaCells.map(key));
            for (const a of m.areaPartition().areas.filter((x) => x.kind !== 'element')) {
                for (const c of a.cells) expect(declared.has(key(c))).toBe(false);
            }
        }
    });
});

describe('C11 — a DROPPED area-bearing element takes its area with it', () => {
    /** The (kind, seed) rows whose graph ACCEPTS with the chamber committed. */
    const ACCEPTS = PLACED.filter(({ kind, seed }) => modelFor(kind, seed, { areas: { keys: 1 } })
        .areas.ran);

    it('accepts on enough rows to be worth dropping', () => {
        expect(ACCEPTS.length).toBeGreaterThan(20);
    });

    /**
     * ⛓⛓⛓ **THE PARTITION IS RE-RUN OVER THE ROOM THE DROP LEFT, AND THE
     * WITNESS IS INDEPENDENT OF IT.** The dropped room's LIVE FLOOR is flooded
     * here, from the start, over the record's own terrain; the partition's
     * areas and corridor components must cover exactly that set.
     *
     * ⛔ THIS IS WHAT A STALE PARTITION FAILS. With the chamber committed its
     * blob is ground; after the drop the composite is not committed and those
     * cells are whatever the carve left — so a partition carried across the
     * drop would claim cells that are WALL in the room that shipped, and the
     * cover would not match. A row that merely re-read the partition's own
     * fields would agree with itself forever (trap 250).
     */
    it('the dropped partition covers exactly the LIVE FLOOR of the dropped room', () => {
        for (const { kind, seed } of ACCEPTS) {
            const dropped = modelFor(kind, seed, { areas: { keys: 1 }, dropElement: true });
            expect(dropped.elements.ran, `${kind}/${seed}`).toBe(false);
            const p = dropped.areaPartition();
            expect(p.areas.some((a) => a.kind === 'element'), `${kind}/${seed}`).toBe(false);
            const record = dropped.skeleton();
            const live = reachableFrom(20, 20, (x, y) => terrainAt(record, x, y) === 'ground',
                { x: dropped.defaults.start.tx, y: dropped.defaults.start.ty });
            const covered = new Set([
                ...p.areas.flatMap((a) => a.cells.map(key)),
                ...p.corridorComponents.flatMap((c) => [...c.cells]),
            ]);
            expect(covered.size, `${kind}/${seed}`).toBe(live.size);
            for (const k of live) expect(covered.has(k), `${kind}/${seed} ${k}`).toBe(true);
        }
    });

    /** ⛓ AND `E0` IS NOWHERE — not an area, not an adjacency endpoint, not a
     *  lock's home. "A stale graph kept after the drop" is exactly the shape
     *  this row names. */
    it('nothing in the dropped model still mentions the element\'s area id', () => {
        for (const { kind, seed } of ACCEPTS) {
            const dropped = modelFor(kind, seed, { areas: { keys: 1 }, dropElement: true });
            const p = dropped.areaPartition();
            expect(p.areas.map((a) => a.id)).not.toContain('E0');
            for (const e of p.adjacency) {
                expect([e.a, e.b], `${kind}/${seed}`).not.toContain('E0');
            }
            for (const l of dropped.areas.locks) expect(l.area).not.toBe('E0');
        }
    });

    /**
     * ⛓⛓⛓ **AND THE GRAPH RE-ADJUDICATES — A REFUSAL IS THE HONEST GRADE.**
     * ⛔ NON-VACUOUS ON REAL DATA: every accepting row above flips to a graded
     * refusal when the chamber goes, and the reason NAMES the missing place.
     * A binding that kept the pre-drop graph would report a level with locks on
     * an area that is not in the room.
     */
    it('the graph re-adjudicates, and refuses BY NAME, on every dropped row', () => {
        const reasons = new Set();
        for (const { kind, seed } of ACCEPTS) {
            const dropped = modelFor(kind, seed, { areas: { keys: 1 }, dropElement: true });
            expect(dropped.areas.ran, `${kind}/${seed}`).toBe(false);
            expect(dropped.areas.locks).toHaveLength(0);
            expect(dropped.areas.flags).toHaveLength(0);
            expect(dropped.areas.refused.reason).toBeTruthy();
            reasons.add(dropped.areas.refused.reason);
        }
        expect([...reasons]).toEqual(['no-area-at-that-key-level-can-hold-its-key']);
    });

    /**
     * ⛓ AND THE ROOM ITSELF LOSES THE BLOB. The drop does not commit the
     * composite, so the floor the chamber wrote is back to whatever the carve
     * left — asked with the site's own cells rather than by counting.
     */
    it('the dropped room does not carry the chamber\'s floor as an area', () => {
        for (const { kind, seed } of ACCEPTS.slice(0, 8)) {
            const kept = modelFor(kind, seed, { areas: { keys: 1 } });
            const site = kept.elements.placed[0].site;
            const dropped = modelFor(kind, seed, { areas: { keys: 1 }, dropElement: true });
            const owned = new Set(dropped.areaPartition().areas
                .flatMap((a) => a.cells.map(key)));
            expect(kept.elements.ran).toBe(true);
            const all = [];
            for (let y = site.y; y < site.y + site.h; y += 1) {
                for (let x = site.x; x < site.x + site.w; x += 1) all.push(key({ x, y }));
            }
            expect(all.every((k) => owned.has(k)), `${kind}/${seed}`).toBe(false);
        }
    });
});

/** ⛓ The primitive both callers share, asked once here so a reader of this file
 *  can see that `deriveSites` and `partitionAreas` are one rule. */
describe('one blob primitive', () => {
    it('`sites.chamber` and `wideBlobs` agree on a chamber-bearing room', () => {
        const { kind, seed } = PLACED[0];
        const m = modelFor(kind, seed);
        const record = m.skeleton();
        const ground = (x, y) => terrainAt(record, x, y) === 'ground';
        const sites = deriveSites(20, 20, ground, {
            from: { x: m.defaults.start.tx, y: m.defaults.start.ty },
            to: { x: m.goalCell.tx, y: m.goalCell.ty },
        });
        const blobs = wideBlobs(20, 20, ground);
        expect(sites.chambers.length).toBe(blobs.length);
    });
});
