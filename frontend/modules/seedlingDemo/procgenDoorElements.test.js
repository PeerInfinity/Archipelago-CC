/**
 * seedlingDemo/procgenDoorElements — **THE SEEDLING BINDING OF THE TWO ROOM-
 * AWARE DOOR ELEMENTS**: the room probe, the composite's own three refusals,
 * the entity mapping, the two lifted claims, the codec's new heads and the `+`
 * list.
 *
 * PROCGEN ELEMENTS arc 3, slice 4a. ⛓ The elements' GEOMETRY is gated in
 * `procgenCore/elements/roomDoor.test.js`, on hand-drawn rooms and with a test
 * double for the door law. THIS file is the other half: the REAL law
 * (`doorLawRefusal`), the REAL carve rule (`carveLawRefusal`), the real probe
 * `seedlingModel` builds, and the records a real solve leaves. One law, two
 * callers, and both callers have rows.
 */

import { describe, expect, it } from 'vitest';

import {
    SEEDLING_DEFAULTS, carveLawRefusal, doorLawRefusal, seedlingModel, seedlingSeam,
} from './procgenSeedling.js';
import {
    compositeSeedlingOnConnector, liftedClaimFor, seedlingOnConnectorEntities,
} from './procgenSeedlingElements.js';
import { POST_SWORD_ITEMS, PRE_SWORD_ITEMS } from './procgenPalette.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';
import {
    ELEMENT_NAMES, formatElementSpec, isElementList, parseElementSpec,
} from '../procgenCore/elementSpec.js';
import { TILE_FLOOR, TILE_WALL } from '../shared/procgen/mazeAlgorithms/gridTiles.js';

const kindOf = (k) => parseSkeleton(k, { simulator: false, substrate: 'the door element rows' });

/* ── the codec ────────────────────────────────────────────────────────── */

describe('⛓ THE CODEC — two new heads, and the `+` list', () => {
    it('parses `killgate` and `blockpocket`, and NEITHER takes a parameter', () => {
        expect(ELEMENT_NAMES).toEqual(['none', 'guard', 'killgate', 'blockpocket']);
        expect(parseElementSpec('killgate')).toEqual({ name: 'killgate' });
        expect(parseElementSpec('blockpocket')).toEqual({ name: 'blockpocket' });
        expect(() => parseElementSpec('killgate;span=8'))
            .toThrow(/element "killgate" has no parameter "span"/);
        expect(() => parseElementSpec('blockpocket;len=2'))
            .toThrow(/element "blockpocket" has no parameter "len"/);
    });

    it('a `+` LIST parses, normalizes, formats and ROUND-TRIPS', () => {
        const spec = parseElementSpec('guard;len=2+killgate+blockpocket');
        expect(isElementList(spec)).toBe(true);
        expect(spec.any.map((m) => m.name)).toEqual(['guard', 'killgate', 'blockpocket']);
        expect(spec.any[0].params).toEqual({ len: 2 });
        expect(formatElementSpec(spec)).toBe('guard;len=2+killgate+blockpocket');
        expect(parseElementSpec(formatElementSpec(spec))).toEqual(spec);
    });

    /** ⛔ `none` IS A LEGAL MEMBER — *"and sometimes nothing"* is sayable, which
     *  is what D5's default spec needs. */
    it('`none` is a legal member, and a ONE-member list and a REPEAT both refuse', () => {
        expect(parseElementSpec('none+killgate').any.map((m) => m.name))
            .toEqual(['none', 'killgate']);
        expect(() => parseElementSpec('guard+guard')).toThrow(/names "guard" TWICE/);
        expect(() => parseElementSpec('guard+')).toThrow(/EMPTY list member/);
    });

    /** ⛔ A LIST HAS NO RESOLVED PARAMETERS OF ITS OWN — the caller draws a head. */
    it('resolving a list refuses and says what to do instead', () => {
        expect(() => seedlingModel({ seed: 1, elements: parseElementSpec('guard+killgate'),
            skeleton: kindOf('empty') })).not.toThrow();
        const m = seedlingModel({ seed: 1, skeleton: kindOf('winding'),
            elements: parseElementSpec('killgate+blockpocket') });
        expect(['killgate', 'blockpocket']).toContain(m.elementHead.name);
        expect(isElementList(m.elementSpec)).toBe(true);
    });

    /**
     * ⛓ THE LIST DRAW IS ONE `pick` AND IT MOVES THE STREAM — which is why a
     * bare head is left alone and a list is a different run.
     *
     * ⛔ THE BARE CONTROL IS THE HEAD THE LIST **DREW**, not a head this row
     * picked. The first cut compared `killgate` against `killgate+blockpocket`
     * and was measuring two things at once: the list pick AND whether the drawn
     * element PLACED (a refused `on-connector` element returns before its own
     * `rng.pick`, so it spends nothing). Mutant (b) reddened it for a reason
     * with nothing to do with lists, which is how the fragility was found.
     */
    it('a bare head spends NO list draw; a list spends exactly one MORE than the head it drew',
        () => {
            const list = seedlingModel({ seed: 3, skeleton: kindOf('winding'),
                elements: parseElementSpec('killgate+blockpocket') });
            const bare = seedlingModel({ seed: 3, skeleton: kindOf('winding'),
                elements: { name: list.elementHead.name } });
            expect(list.roomDraws).toBe(bare.roomDraws + 1);
        });

    /** ⛓⛓ AND AN `on-connector` ELEMENT THAT REFUSES SPENDS **NOTHING** — it
     *  returns before its own `pick`. ⛔ Which is the opposite of the pre-carve
     *  rule (arc-2 §10.3) and is why §12.7's level shas match. */
    it('a REFUSED on-connector element spends no draw at all', () => {
        const plain = seedlingModel({ seed: 8, skeleton: kindOf('winding') });
        const asked = seedlingModel({ seed: 8, skeleton: kindOf('winding'),
            elements: { name: 'killgate' } });
        expect(asked.elements.ran).toBe(false);
        expect(asked.elements.refused.reason).toBe('no-cut-cell');
        expect(asked.roomDraws).toBe(plain.roomDraws);
    });
});

/* ── the room probe ───────────────────────────────────────────────────── */

describe('⛓⛓ THE ROOM PROBE — what a door is allowed to know', () => {
    const model = seedlingModel({ seed: 1, skeleton: kindOf('winding') });
    const room = model.roomProbe();

    it('is memoised, and its main path runs START -> GOAL over the SKELETON', () => {
        expect(model.roomProbe()).toBe(room);
        expect(room.mainPath[0]).toEqual({ x: SEEDLING_DEFAULTS.start.tx,
            ty: undefined, y: SEEDLING_DEFAULTS.start.ty });
        expect(room.mainPath.at(-1)).toEqual({ x: model.goalCell.tx, y: model.goalCell.ty });
        for (const c of room.mainPath) expect(room.floorAt(c.x, c.y)).toBe(true);
    });

    /** ⛓ `isCut` IS THE ONE-CELL SPECIAL CASE OF `connectedWith`, spelled once —
     *  the row drives both and asserts they agree. */
    it('`isCut(cell)` === `!connectedWith({walled:[cell]})` on every main-path cell', () => {
        for (const c of room.mainPath) {
            expect(room.isCut(c)).toBe(!room.connectedWith({ walled: [c] }));
        }
    });

    it('every interior main-path cell of a ONE-WIDE corridor IS a cut', () => {
        const interior = room.mainPath.slice(1, -1);
        expect(interior.length).toBeGreaterThan(0);
        expect(interior.every((c) => room.isCut(c))).toBe(true);
    });
});

/* ── the composite's own three refusals ───────────────────────────────── */

/**
 * ⛔⛔ ALL THREE ARE TRUE BY CONSTRUCTION FOR THE TWO SHIPPED ELEMENTS (trap
 * 296) — both filter their candidates with `room.doorLaw`, the same function the
 * composite re-asks. These rows are their ONLY gate: each hands the composite a
 * hand-built placement of exactly the shape an element that did NOT ask would
 * produce.
 */
describe('⛓⛓⛓ THE COMPOSITE\'s three refusals, each on a placement it must refuse', () => {
    const W = 10;
    const H = 10;
    const START = { tx: 1, ty: 1 };
    const GOAL = { tx: 5, ty: 1 };
    /** ⛓ THE NUB HANGS OFF (2,1) — the cell BEFORE the door — because that is
     *  where the element's own search puts it and it is what clause 2 demands.
     *  A nub at (3,2), off the DOOR cell, is unreachable the moment the door is
     *  walled, and the first cut of this fixture was refused for exactly that. */
    const FLOOR = new Set(['1,1', '2,1', '3,1', '4,1', '5,1', '2,2']);
    const groundAt = (x, y) => FLOOR.has(`${x},${y}`);
    const call = (placement) => compositeSeedlingOnConnector({
        width: W,
        height: H,
        groundAt,
        skeletonWallAt: (x, y) => !groundAt(x, y),
        placement,
        start: START,
        goal: GOAL,
        doorLaw: ({ paintedFor, doorKeys, clearerKeys }) => doorLawRefusal({
            width: W, height: H, walkableFor: paintedFor,
            start: { x: START.tx, y: START.ty }, goal: { x: GOAL.tx, y: GOAL.ty },
            doorKeys, clearerKeys, name: 'the fixture', askOpenHalf: true,
        }),
        carveLaw: ({ carved, walkableAfter, walkableBefore }) => carveLawRefusal({
            width: W, height: H, carved, walkableAfter, walkableBefore,
            start: { x: START.tx, y: START.ty }, goal: { x: GOAL.tx, y: GOAL.ty },
            name: 'the fixture',
        }),
    });
    const base = {
        tiles: [],
        entities: { blocks: [], buttons: [],
            obstacles: [{ x: 3, y: 1, id: 'killgate_door' },
                { x: 2, y: 2, id: 'killgate_body' }], items: [] },
        doorCells: [{ x: 3, y: 1 }],
        clearer: [{ x: 2, y: 2 }],
        demand: [],
        area: null,
        symbols: { holds: [], grants: [] },
        cost: { wall: 0, carved: 0 },
    };

    it('the LEGAL placement passes, so the three below differ in exactly one thing', () => {
        expect(call(base).placed.doorCell).toEqual({ x: 3, y: 1 });
    });

    it('`the-elements-write-lands-on-the-start-or-the-goal`', () => {
        const out = call({ ...base, tiles: [{ x: 1, y: 1, tile: TILE_WALL }] });
        expect(out.refused.reason).toBe('the-elements-write-lands-on-the-start-or-the-goal');
        expect(call({ ...base, tiles: [{ x: 5, y: 1, tile: TILE_WALL }] }).refused.reason)
            .toBe('the-elements-write-lands-on-the-start-or-the-goal');
    });

    /** ⛓ A CARVE WITH TWO MOUTHS IS A TUNNEL — slice 2's clause (a), asked of
     *  an element's cells for the first time. */
    it('`the-elements-carve-is-not-legal` — a carve with TWO mouths', () => {
        // (3,2) touches BOTH (3,1) and (2,2) once carved: a TUNNEL, not a pocket.
        const out = call({ ...base, tiles: [{ x: 3, y: 2, tile: TILE_FLOOR }] });
        expect(out.refused.reason).toBe('the-elements-carve-is-not-legal');
        expect(out.refused.detail).toMatch(/2 MOUTH\(S\)/);
    });

    /** ⛔⛔ CLAUSE 2 OF THE DOOR LAW, gated where it CAN be violated — the
     *  elements cannot produce a goal-side clearer (their pocket hangs off the
     *  cell BEFORE the door, `roomDoor.test.js`'s own row), so the fixture
     *  hands the composite one. */
    it('a GOAL-SIDE clearer refuses — clause 2, on the REAL law', () => {
        const out = call({ ...base,
            entities: { ...base.entities,
                obstacles: [{ x: 3, y: 1, id: 'killgate_door' },
                    { x: 4, y: 1, id: 'killgate_body' }] },
            clearer: [{ x: 4, y: 1 }] });
        expect(out.refused.reason).toBe('the-elements-door-is-not-a-cut');
        expect(out.refused.detail).toMatch(/is on the GOAL side of it/);
    });

    it('`the-elements-door-is-not-a-cut` — a door cell the walk goes round', () => {
        // (2,2) is a side nub, not a cut of the corridor.
        const out = call({ ...base,
            entities: { ...base.entities,
                obstacles: [{ x: 2, y: 2, id: 'killgate_door' },
                    { x: 2, y: 1, id: 'killgate_body' }] },
            doorCells: [{ x: 2, y: 2 }], clearer: [{ x: 2, y: 1 }] });
        expect(out.refused.reason).toBe('the-elements-door-is-not-a-cut');
        expect(out.refused.detail).toMatch(/NOT A CUT/);
    });

    /** ⛔ AND THE OPEN HALF — the clause a TEMPLATE gets free from `sealRefusal`
     *  and an element pays for itself (`askOpenHalf`). */
    it('a door whose own WALL seals the room refuses on clause 1\'s OTHER half', () => {
        const out = call({ ...base,
            tiles: [{ x: 2, y: 1, tile: TILE_WALL }] });
        expect(out.refused.reason).toBe('the-elements-door-is-not-a-cut');
        expect(out.refused.detail).toMatch(/its own TERRAIN SEALS the room/);
    });
});

/* ── the entity mapping ───────────────────────────────────────────────── */

describe('⛓⛓ THE MAPPING — ids to Seedling parts, and ONE tag not three', () => {
    const placed = {
        entities: [
            { role: 'obstacle', x: 3, y: 1, id: 'killgate_door' },
            { role: 'obstacle', x: 3, y: 2, id: 'killgate_body' },
        ],
    };

    it('`killgate_door` -> `lock {tset:-1}` with a tag; `killgate_body` -> `spinner {tag:-1}`',
        () => {
            const out = seedlingOnConnectorEntities({ placed, tagFor: () => 7 });
            expect(out.entities).toEqual([
                { type: 'lock', tx: 3, ty: 1, attrs: { tset: '-1', tag: '7' } },
                { type: 'spinner', tx: 3, ty: 2, attrs: { tag: '-1' } },
            ]);
            expect(out.tags).toEqual({ lock: 7 });
        });

    /** ⛓ THE BLOCK POCKET COSTS NOTHING OUT OF `TAGS_PER_LEVEL`'s 30 — a
     *  `pushableblock` carries no tag at all. */
    it('a block costs NO tag', () => {
        const out = seedlingOnConnectorEntities({
            placed: { entities: [{ role: 'block', x: 4, y: 1 }] },
            tagFor: () => { throw new Error('a block must not ask for a tag'); },
        });
        expect(out.entities).toEqual([{ type: 'pushableblock', tx: 4, ty: 1 }]);
        expect(out.tags).toEqual({});
    });

    /** ⛔ AN ID THE TABLE DOES NOT CARRY IS A THROW, never a dropped entity. */
    it('an unknown id THROWS rather than dropping the entity', () => {
        expect(() => seedlingOnConnectorEntities({
            placed: { entities: [{ role: 'obstacle', x: 3, y: 1, id: 'hammer_ring' }] },
            tagFor: () => 1,
        })).toThrow(/has no Seedling part for it/);
    });
});

/* ── the lifted claims ────────────────────────────────────────────────── */

describe('⛓⛓⛓ THE LIFTED CLAIMS — what each reader reads, and what refutes it', () => {
    const gate = { doorCell: { x: 3, y: 7 }, clearer: [{ x: 2, y: 6 }] };
    const claimGate = liftedClaimFor('kill-gate');
    const clear = (over = {}) => ({ tag: 1, at: 608, declaredAt: 607,
        by: 'spinner@32,96', lock: 'lock@48,112', cause: 'sword', ...over });
    const crossed = { rows: [{ tick: 700, saw: { x: 40, y: 100 },
        path: [{ x: 56, y: 120 }] }] };

    /** ⛓ THE RECORD CARRIES NO LOCK AND NO OPEN TICK — `scratchClears` does. */
    it('kill gate: TRUE when THIS gate\'s body cleared THIS gate\'s lock before the crossing',
        () => {
            expect(claimGate({ records: [{ strategy: 'kill' }], scratchClears: [clear()],
                trace: crossed }, gate)).toBe(true);
        });

    it('kill gate: FALSE when some OTHER body earned the clear', () => {
        expect(claimGate({ records: [{ strategy: 'kill' }],
            scratchClears: [clear({ by: 'spinner@112,16' })], trace: crossed }, gate)).toBe(false);
    });

    it('kill gate: FALSE when the clear landed AFTER the route crossed the door', () => {
        expect(claimGate({ records: [{ strategy: 'kill' }], scratchClears: [clear({ at: 900 })],
            trace: crossed }, gate)).toBe(false);
    });

    it('kill gate: NULL when the route never crossed, and when no lock of ours cleared', () => {
        expect(claimGate({ records: [{ strategy: 'kill' }], scratchClears: [clear()],
            trace: { rows: [] } }, gate)).toBe(null);
        expect(claimGate({ records: [{ strategy: 'kill' }],
            scratchClears: [clear({ lock: 'lock@16,16' })], trace: crossed }, gate)).toBe(null);
    });

    const pocket = { doorCell: { x: 2, y: 1 }, cost: { push: 4 } };
    const claimBlock = liftedClaimFor('block-pocket');
    const shove = (over = {}) => ({ strategy: 'shove', from: { tx: 2, ty: 1 },
        to: { tx: 6, ty: 1 }, ...over });

    /**
     * ⛔ NO ROUTE HALF — measured: the player crosses the door DURING the shove
     * (they follow the block under the lean), so no decision row's corridor
     * contains it. The row asserts the claim is TRUE with an EMPTY trace, which
     * is exactly what the first cut of this reader got wrong.
     */
    it('block pocket: TRUE on the shove alone, with no trace at all', () => {
        expect(claimBlock({ records: [shove()], trace: { rows: [] } }, pocket)).toBe(true);
    });

    it('block pocket: FALSE when the block travelled LESS than the guarantee', () => {
        expect(claimBlock({ records: [shove({ to: { tx: 3, ty: 1 } })] }, pocket)).toBe(false);
    });

    it('block pocket: FALSE when a later shove put it BACK on the door cell', () => {
        expect(claimBlock({ records: [shove(),
            { strategy: 'shove', from: { tx: 6, ty: 1 }, to: { tx: 2, ty: 1 } }] }, pocket))
            .toBe(false);
    });

    it('block pocket: NULL when nothing was ever shoved off the door cell', () => {
        expect(claimBlock({ records: [shove({ from: { tx: 9, ty: 9 } })] }, pocket)).toBe(null);
        expect(claimBlock({ records: [] }, pocket)).toBe(null);
    });

    it('an element with no reader answers NULL rather than a green nobody measured', () => {
        expect(liftedClaimFor('hammer')({ records: [] }, {})).toBe(null);
    });
});

/* ── the seam ─────────────────────────────────────────────────────────── */

describe('⛓⛓⛓ THE SEAM — the item gate, and the two elements certifying', () => {
    /**
     * ⛔ THE KILL GATE CANNOT CERTIFY PRE-SWORD, and the refusal is FREE:
     * `weaponForPress` returns null with no sword slot, so the press is a silent
     * no-op. Spending a full solver budget to learn what the boot flags already
     * say is the cost this arc keeps refusing to pay.
     */
    it('pre-sword: the kill gate refuses `the-element-needs-an-item-…` with NO solve', () => {
        const out = seedlingSeam({ seed: 1, skeleton: kindOf('winding'),
            items: PRE_SWORD_ITEMS, elements: { name: 'killgate' } });
        expect(out.certification.certified).toBe(false);
        expect(out.certification.gap).toBe('the-element-needs-an-item-this-biome-does-not-grant');
        expect(out.certification.needs).toEqual(['hasSword']);
        expect(out.certification.verdict).toBe(null);
        expect(out.certification.geometry.length).toBe(1);
        // and the level SHIPPED without it — the draws were spent either way
        expect(out.model.elements.ran).toBe(false);
    });

    /**
     * ⛓ THE CHEAPEST CERTIFYING CELL IN THE TABLE, and the choice is a
     * MEASUREMENT rather than taste: `winding;chambers=2` seed 3 certifies in
     * **698 ms**, `branchy` 2 in 2.6 s, `winding` 2 in 3.9 s and `winding` 1 in
     * **126 SECONDS** — which is why the yield table's 120 s cell budget
     * TIMEOUT-ABORTS two `killgate` cells and why the corridor kill lock's cost
     * (§9b) is the element's inheritance too. A row that drove seed 1 would be a
     * two-minute test asserting nothing seed 3 does not.
     */
    it('post-sword: the kill gate certifies, with `kill` and the claim TRUE', () => {
        const out = seedlingSeam({ seed: 3, skeleton: kindOf('winding;chambers=2'),
            items: POST_SWORD_ITEMS, elements: { name: 'killgate' } });
        expect(out.certification.certified).toBe(true);
        expect(out.certification.strategies).toContain('kill');
        expect(out.certification.heldAtDoor).toBe(true);
    });

    /** ⛓ THE BLOCK POCKET NEEDS NO ITEM — a shove is a pre-sword verb. */
    it('pre-sword: the block pocket certifies, with `shove` and the claim TRUE', () => {
        const out = seedlingSeam({ seed: 1, skeleton: kindOf('winding'),
            items: PRE_SWORD_ITEMS, elements: { name: 'blockpocket' } });
        expect(out.certification.certified).toBe(true);
        expect(out.certification.strategies).toContain('shove');
        expect(out.certification.heldAtDoor).toBe(true);
    });

    /** ⛔ EVERY CELL THE DOOR OWNS IS OFF LIMITS TO PASS 2 — and it is CELLS,
     *  not a rectangle: reserving one would cost a corridor's worth of room. */
    it('the door\'s own cells are refused to pass 2, BY NAME', () => {
        const model = seedlingModel({ seed: 1, skeleton: kindOf('winding'),
            elements: { name: 'blockpocket' } });
        const p = model.elements.placed[0];
        const template = { name: 'probe', footprint: [{ dx: 0, dy: 0 }], terrain: [] };
        const why = model.refusalAt(model.skeleton(), template, p.doorCell.x, p.doorCell.y);
        expect(why).toMatch(/belongs to the ELEMENT/);
        expect(why).toMatch(/its door cell/);
    });
});
