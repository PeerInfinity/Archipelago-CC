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
    SEEDLING_DEFAULTS, carveLawRefusal, defaultElementsFor, doorLawRefusal, seedlingModel,
    seedlingSeam,
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
        /** ⛓ arc 5 slice 3 added the `chamber` head and slice 4 the `arena` —
         *  the roster is asserted LITERALLY (never `toContain`) so a head
         *  arriving without a decision reds a row rather than sliding in. */
        expect(ELEMENT_NAMES).toEqual([
            'none', 'guard', 'killgate', 'blockpocket', 'chamber', 'arena',
        ]);
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

    /**
     * ⛓⛓⛓ **THE BIOME DEFAULT IS A PIN, AND A PIN WANTS A ROW** — PROCGEN
     * ELEMENTS arc 5, slice 6a.
     *
     * ⛔ Until this slice NOTHING asserted what the default CONTAINS. The
     * nearest row (`procgenDocs/generated.test.js`) only checked that the
     * post-sword string contains `killgate` and the pre-sword one does not, so
     * a head could have been added to either list — including one no ruling
     * covers, `arena` being the live example — and every gate in the tree would
     * have stayed green while every committed artifact moved underneath it.
     * That is what mutant (c) measured, and this row is the answer.
     *
     * ⛓ IT IS LITERAL ON PURPOSE, on the `ELEMENT_NAMES` precedent above: the
     * SPELLING, the ORDER (the `+` list's `pick` reads the members in the order
     * the caller wrote them, so order is part of the run), and WHICH PARAMETERS
     * ARE NAMED — because a named parameter spends no draw and an omitted one
     * is DRAWN, so `guard` and `guard;len=2` are different defaults even when
     * `len` resolves to 2.
     */
    it('⛔ the BIOME DEFAULT spec, both biomes, pinned LITERALLY — spelling, '
        + 'order, and which parameters are NAMED', () => {
        expect(formatElementSpec(defaultElementsFor(PRE_SWORD_ITEMS)))
            .toBe('guard;len=2|3|4+blockpocket+chamber;w=2;h=3');
        expect(formatElementSpec(defaultElementsFor(POST_SWORD_ITEMS)))
            .toBe('guard;len=2|3|4+killgate+blockpocket+chamber;w=2;h=3');
        /** ⛓ the two biomes differ by EXACTLY the sword-gated head. */
        const pre = defaultElementsFor(PRE_SWORD_ITEMS).any.map((m) => m.name);
        const post = defaultElementsFor(POST_SWORD_ITEMS).any.map((m) => m.name);
        expect(pre).toEqual(['guard', 'blockpocket', 'chamber']);
        expect(post).toEqual(['guard', 'killgate', 'blockpocket', 'chamber']);
        expect(post.filter((n) => !pre.includes(n))).toEqual(['killgate']);
        /**
         * ⛔ THE TWO-STREAMS HALF, READ OFF THE NORMALIZED SPEC — and since
         * SEEDLING BOT R9 slice 1 (D1) the guard's `len` is the THIRD kind:
         * a SUBSET, which spends the same ONE draw an omitted parameter spends
         * but names WHICH values it may land on. `turns` is still absent (⇒
         * drawn over its whole domain), the chamber carries BOTH of its own (⇒
         * no draw on either), and `killgate` declares none at all. ⛔ The three
         * states are pinned on one line each, because a subset silently turned
         * into a pin would spend one draw fewer and move every draw after it.
         */
        const memberOf = (spec, name) => spec.any.find((m) => m.name === name);
        expect(memberOf(defaultElementsFor(POST_SWORD_ITEMS), 'guard').params)
            .toEqual({ len: { pick: [2, 3, 4] } });
        expect(memberOf(defaultElementsFor(PRE_SWORD_ITEMS), 'guard').params.turns)
            .toBeUndefined();
        /** ⛓ …and the values are the DOMAIN's own typed members, in the order
         *  written — the draw is a `pick` over that array. */
        expect(memberOf(defaultElementsFor(PRE_SWORD_ITEMS), 'guard').params.len.pick)
            .toEqual([2, 3, 4]);
        expect(memberOf(defaultElementsFor(POST_SWORD_ITEMS), 'chamber').params)
            .toEqual({ w: 2, h: 3 });
        expect(memberOf(defaultElementsFor(POST_SWORD_ITEMS), 'killgate').params)
            .toBeUndefined();
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
            /**
             * ⛓⛓ RE-PICKED AT SLICE 4c (trap 285). The GOAL DRAW moved
             * `winding` seed 3's room and the head it draws there now REFUSES,
             * which puts the row back in the exact trap its own docblock
             * describes — measuring the list pick AND the placement at once.
             * RE-SCANNED over `winding`/`branchy`/`rooms`/`empty` seeds 1..8
             * for a cell whose drawn head PLACES: **`winding` seed 1 is the
             * first**, and the relation holds at 11 of the 12 `winding`/
             * `branchy` cells that place. ⚠ It does NOT hold on `rooms` (there
             * the site pick's own draws differ between the two runs) — which is
             * a fact about that skeleton's stream and is why the subject is
             * NAMED rather than looped over every kind.
             */
            const list = seedlingModel({ seed: 1, skeleton: kindOf('winding'),
                elements: parseElementSpec('killgate+blockpocket') });
            expect(list.elements.ran, 'the subject\'s drawn head must PLACE').toBe(true);
            const bare = seedlingModel({ seed: 1, skeleton: kindOf('winding'),
                elements: { name: list.elementHead.name } });
            expect(list.roomDraws).toBe(bare.roomDraws + 1);
        });

    /** ⛓⛓ AND AN `on-connector` ELEMENT THAT REFUSES SPENDS **NOTHING** — it
     *  returns before its own `pick`. ⛔ Which is the opposite of the pre-carve
     *  rule (arc-2 §10.3) and is why §12.7's level shas match. */
    /**
     * ⛓⛓⛓ **RE-PICKED, AND THE OLD SUBJECT WAS A REFUSAL SLICE 4c ABOLISHED**
     * (trap 312 — replace with the sentence that survives). It drove `winding`
     * seed 8 asserting `no-cut-cell`: seed 8 put the goal ADJACENT to the start,
     * so the main path was two cells and there was no interior cell to stand a
     * door on. The GOAL DRAW's `manhattan >= 3` rule makes that state
     * UNREACHABLE — `no-cut-cell` and `goal-too-close` are both gone from the
     * whole 10-kind x 12-seed census (`procgenGoalDraw.test.js` drives it).
     *
     * ⛔ THE ROW'S CLAIM IS ABOUT DRAWS, NOT ABOUT THAT NAME, so it takes a
     * refusal that still exists. RE-SCANNED over ten kinds x seeds 1..12: two
     * names remain — **`wall-does-not-seal` (a room with two routes is not cut
     * by one line) and `pocket-not-legal`**.
     *
     * ⛓ **RE-SCANNED AGAIN IN SLICE 4b**, because the `chambers` default moved
     * every carved room: `loopy` seed 1 now PLACES. The same scan over nine
     * kinds x seeds 1..12 finds **22 `wall-does-not-seal` cells and 4
     * `pocket-not-legal`**, and `branchy` seed 7 is the first of the 22. The
     * class is what it always was; the members moved with the rooms.
     */
    it('a REFUSED on-connector element spends no draw at all', () => {
        const plain = seedlingModel({ seed: 7, skeleton: kindOf('branchy') });
        const asked = seedlingModel({ seed: 7, skeleton: kindOf('branchy'),
            elements: { name: 'killgate' } });
        expect(asked.elements.ran).toBe(false);
        expect(asked.elements.refused.reason).toBe('wall-does-not-seal');
        expect(asked.roomDraws).toBe(plain.roomDraws);
    });
});

/* ── the room probe ───────────────────────────────────────────────────── */

describe('⛓⛓ THE ROOM PROBE — what a door is allowed to know', () => {
    /**
     * ⛓ PINNED AT `chambers: 0` SINCE SLICE 4b — the last row of this block is
     * about a **ONE-WIDE CORRIDOR**, and that room is spelled `{chambers: 0}`
     * now that Seedling's carved tree kinds default the stamp ON (D6). The
     * subject did not move; its spelling did.
     */
    const model = seedlingModel({ seed: 1,
        skeleton: { ...kindOf('winding'), params: { chambers: 0 } } });
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
     * MEASUREMENT rather than taste.
     *
     * ⛓⛓ RE-MEASURED AT SLICE 4c BY THE SAME RULE (4a's own stale-subject
     * warning). `winding;chambers=2` seed 3 certified in 698 ms under the old
     * goal draw and REFUSES under the new one (145 ms). RE-SCANNED over seven
     * kinds x seeds 1..4, timed through the seam:
     *
     *   **winding/4      651 ms  CERTIFIED**  <- taken
     *   rooms;minRoom=4/3  995 · rooms/3 1043 · bushy/3 1431
     *   winding;chambers=2/2 2044 · empty/2 **8163**
     *   ⚠ bushy/2 spends **48.7 SECONDS** to REFUSE, and `winding` 1/2 and
     *   `branchy` 1 THROW the pocket-corner `collideLine` class (§9b.3, ⚖
     *   endorsed as an R9 exception — the element inherits it, it does not
     *   discharge it). A row that drove any of those would be a minute-long
     *   test asserting nothing `winding` 4 does not.
     *
     * ⛓⛓ **RE-SCANNED AGAIN AT SLICE 4b** — the `chambers` default (D6) moved
     * every carved room, and `winding` seed 4 stopped certifying. Same rule,
     * same seven kinds x seeds 1..4, timed through the seam; the certifying
     * cells with the claim TRUE are
     *
     *   **open/2 555 ms**  <- taken   ·  rooms/3 770 · branchy/3 792
     *   rooms;minRoom=4/3 947 · bushy/3 1342
     */
    it('post-sword: the kill gate certifies, with `kill` and the claim TRUE', () => {
        const out = seedlingSeam({ seed: 2, skeleton: kindOf('open'),
            items: POST_SWORD_ITEMS, elements: { name: 'killgate' } });
        expect(out.certification.certified).toBe(true);
        expect(out.certification.strategies).toContain('kill');
        expect(out.certification.heldAtDoor).toBe(true);
    });

    /**
     * ⛓ THE BLOCK POCKET NEEDS NO ITEM — a shove is a pre-sword verb.
     *
     * ⛓ RE-PICKED AT SLICE 4b BY THE SAME SCAN: `winding` seed 1 stopped
     * certifying when the `chambers` default moved its room. **17 of the 28
     * scanned cells certify with the claim TRUE**, and `winding` seed 3 is the
     * cheapest at 95 ms.
     */
    it('pre-sword: the block pocket certifies, with `shove` and the claim TRUE', () => {
        const out = seedlingSeam({ seed: 3, skeleton: kindOf('winding'),
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
