/**
 * seedlingDemo/procgenPalette.test — EVERY TEMPLATE AGAINST A BUILT WORLD,
 * and the bindings that place them.
 *
 * PROCGEN PoC arc, slice 2. `procgenLevel.test.js`'s law, one layer up: a
 * template's claim about what it builds is only worth what the ENGINE says.
 * So each template is placed into a real room, the room is built with
 * `buildLevelWorld`, and the template is found by the ROSTER it is for — a
 * wall in `solids`, water in `lethalTerrainTiles`, a pit in `pitTiles`, an
 * arrow trap in `arrowTraps` with the `shootDefault` its attrs claim.
 *
 * ⚠ TRAP 199's LESSON IS THE STRUCTURE HERE: the roster assertions are built
 * FROM `PRE_SWORD_TEMPLATES`, so a template added to the palette without a
 * verification arrives as a FAILING test rather than as an uncounted row.
 */

import { describe, expect, it } from 'vitest';

import { ROLES, TILE_SIZE, buildLevelWorld, tagOf } from './levelWorld.js';
import { arrowLaneForPlacement, arrowLaneRect, arrowTrapEntityPoint } from './arrowTrap.js';
import { ProcgenLevelError, terrainAt } from './procgenLevel.js';
import {
    EXCLUDED_TEMPLATES, PLACEMENT_GROUP, PLACEMENT_TAG, POST_SWORD_EXCLUDED_TEMPLATES,
    POST_SWORD_PALETTE, POST_SWORD_TEMPLATES, PRE_SWORD_PALETTE, PRE_SWORD_TEMPLATES,
    PaletteRosterError,
    ProcgenPaletteError,
    assertPalette, catalogueRows, defineTemplate, dischargesVerb, doorGeometry,
    enumerateInstantiations, enumerateValues, instantiateKept, restrictPalette, verbOf,
} from './procgenPalette.js';
import {
    SEEDLING_DEFAULTS, generateSeedlingLevel, placementGroupId, placementTagId,
    seedlingModel, seedlingOracle, seedlingSeam,
} from './procgenSeedling.js';
import { TAGS_PER_LEVEL } from './breakableRocks.js';
import { generateLevel } from '../procgenCore/levelGenerator.js';
import { rngFor } from './procgenRng.js';

const model = () => seedlingModel({ seed: 1 });
const worldFor = (record) => buildLevelWorld(record, { roles: ROLES });
const byName = (name) => PRE_SWORD_TEMPLATES.find((t) => t.name === name);

/**
 * ⛓ SLICE 2: `byName` returns a BASE, which has no geometry at all — every
 * assertion below is about a CONCRETE ROW, so it names the values it is about.
 * `at()` with no overrides is only legal for a zero-parameter template, by
 * `instantiate`'s own refusal.
 */
const instanceOf = (name, values = {}) => byName(name).instantiate(null, values);

/** Place a concrete instance at a chosen anchor, ignoring the draw. */
const placedAt = (m, name, at, values = {}) => m.place(m.skeleton(), instanceOf(name, values), at);

/**
 * ⛓⛓⛓ **THE SLOT FIXTURE — arc 3, slice 4c, and it exists because the slot's
 * only SHIPPED consumer retired.**
 *
 * `PLACEMENT_GROUP` and `PLACEMENT_TAG` were built for two USER-REPORTED
 * DEFECTS (2026-08-13: *"both of the switches open both of the doors"*, and the
 * weigh lock toggling the GOAL's persistence tag) and every driven row for them
 * used `wall-gap-lock-weigh` as its subject. Slice 4c retired that template into
 * the `guard` ELEMENT. ⛔ THE MECHANISM DID NOT RETIRE WITH IT — `place`,
 * `placementGroupId`, `placementTagId` and `assertPalette`'s three invariants
 * are all still live, and arc 5's arena is the next row that will want them.
 *
 * ⇒ the rows below are RE-POINTED at this fixture rather than deleted. A
 * regression test for a shipped defect is not something to drop because the
 * template that first exhibited it left; what it costs is one honest sentence,
 * which is this one: **the slot has no shipped consumer today**, and the row
 * just below `enumerateInstantiations` says exactly that and would fail the day
 * a roster row arrived carrying the slot without a verification (trap 199's own
 * structure, inverted).
 *
 * The shape is the weigh row's, reduced to what the slot needs: a LOCK on both
 * slots standing in the anchor cell (invariant 3 — a group-bearing row must
 * OCCUPY AND WRITE its own anchor), and a BUTTON on the group slot two cells
 * along. No `door`, so the door law does not run; no block, because the shove
 * lane was the retired template's geometry and not the slot's.
 */
const SLOT_DOOR = defineTemplate({
    name: 'slot-door-fixture',
    family: 'slot-fixture',
    site: 'straight',
    params: [],
    why: 'a slot-bearing fixture — the mechanism\'s subject after slice 4c retired its only '
        + 'shipped consumer',
    build: () => ({
        groups: 1,
        tags: 1,
        footprint: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }],
        terrain: [{ dx: 1, dy: 0, terrain: 'wall' }],
        entities: [
            {
                dx: 0, dy: 0, type: 'lock', attrs: { tset: PLACEMENT_GROUP, tag: PLACEMENT_TAG },
            },
            { dx: 2, dy: 0, type: 'button', attrs: { tset: PLACEMENT_GROUP } },
        ],
        pins: [],
    }),
});

const slotDoor = () => SLOT_DOOR.instantiate(null, {});

/** A minimal well-formed base, for the negative cases below. */
const fakeTemplate = (over = {}) => defineTemplate({
    name: 'g',
    family: 'g',
    params: [],
    why: 'a fixture',
    build: () => ({
        footprint: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }],
        terrain: [{ dx: 0, dy: 0, terrain: 'wall' }],
        entities: [],
    }),
    ...over,
});

describe('the palette itself is well formed', () => {
    it('passes its own structural assertion at load and on demand', () => {
        expect(assertPalette()).toBe(true);
    });

    it('refuses a template that writes outside its own footprint', () => {
        expect(() => assertPalette({
            name: 'bad',
            templates: [fakeTemplate({
                name: 'x',
                build: () => ({
                    footprint: [{ dx: 0, dy: 0 }],
                    terrain: [{ dx: 5, dy: 5, terrain: 'wall' }],
                }),
            })],
        })).toThrow(ProcgenPaletteError);
    });

    it('refuses a duplicate name — the trace keys on it (trap 199)', () => {
        expect(() => assertPalette({
            name: 'dup', templates: [fakeTemplate({ name: 'x' }), fakeTemplate({ name: 'x' })],
        })).toThrow(/must be unique/);
    });

    /**
     * ── ⛓⛓⛓ THE PARAMETERIZED-TEMPLATE SEAM (GENERATE-mode UI arc, slice 2)
     *
     * ⚖ Ruling 2: a template is *"a function that generates a coherent set of
     * features"*. These are the seam's own claims — the ones that hold whatever
     * the wave-1 domains happen to be.
     */
    describe('a template is a FUNCTION, and its schema is checked where it is declared', () => {
        it('⛔ REFUSES a frozen row in the roster — it would appear in no sweep', () => {
            expect(() => assertPalette({
                name: 'frozen',
                templates: [{ name: 'x', family: 'x', footprint: [{ dx: 0, dy: 0 }] }],
            })).toThrow(/not a PARAMETERIZED template/);
        });

        it('refuses a default that is not in its own domain — a control offering an '
            + 'illegal value', () => {
            expect(() => defineTemplate({
                name: 'x', family: 'x', why: 'w', build: () => ({}),
                params: [{ key: 'k', domain: [1, 2], default: 9, why: 'w' }],
            })).toThrow(/is not in its own domain/);
        });

        it('refuses an empty domain — ⚖ ruling 4 certifies a domain by ENUMERATING it', () => {
            expect(() => defineTemplate({
                name: 'x', family: 'x', why: 'w', build: () => ({}),
                params: [{ key: 'k', domain: [], default: undefined, why: 'w' }],
            })).toThrow(/no finite\s+domain/);
        });

        it('refuses a parameter with no `why`, and a duplicated key', () => {
            expect(() => defineTemplate({
                name: 'x', family: 'x', why: 'w', build: () => ({}),
                params: [{ key: 'k', domain: [1], default: 1 }],
            })).toThrow(/carries no\s+`why`/);
            expect(() => defineTemplate({
                name: 'x', family: 'x', why: 'w', build: () => ({}),
                params: [
                    { key: 'k', domain: [1], default: 1, why: 'w' },
                    { key: 'k', domain: [2], default: 2, why: 'w' },
                ],
            })).toThrow(/missing or\s+duplicated key/);
        });

        /**
         * ⛔ A `build` MAY VARY GEOMETRY AND MAY NOT RENAME ITS OWN TEMPLATE.
         * The base name is the roster key the pin union looks up and the family
         * is what the report counts (trap 199), so both are stamped AFTER the
         * spread — this drives that the stamp actually wins.
         */
        it('stamps name, family, params and the instance label OVER whatever build returns',
            () => {
                const t = defineTemplate({
                    name: 'real', family: 'realfam', why: 'w',
                    params: [{ key: 'k', domain: [1, 2], default: 1, why: 'w' }],
                    build: () => ({ name: 'forged', family: 'forged', params: ['nonsense'] }),
                });
                const row = t.instantiate(null, { k: 2 });
                expect(row.name).toBe('real');
                expect(row.family).toBe('realfam');
                expect(row.params).toEqual({ k: 2 });
                expect(row.instance).toBe('real(k=2)');
            });

        it('refuses an override outside the domain, and an override of a parameter it '
            + 'does not declare', () => {
            const t = byName('wall-segment');
            expect(() => t.instantiate(null, { ori: 'h', len: 99 }))
                .toThrow(/not in its\s+declared domain/);
            expect(() => t.instantiate(null, { nope: 1 })).toThrow(/has no parameter "nope"/);
        });

        /**
         * ⛔⛔ THE REFUSAL THAT MAKES THE RECONSTRUCTION SAFE. A caller with no
         * rng and an incomplete `overrides` would otherwise get the DEFAULT
         * instance — a different geometry wearing the same name — and the pin
         * union could not tell the two apart, because pins are static per
         * template in v1. So the absence refuses instead of defaulting.
         */
        it('⛔ REFUSES to draw with no rng rather than falling back to the default', () => {
            expect(() => byName('wall-segment').instantiate(null, { ori: 'h' }))
                .toThrow(/needs a DRAW for "len"/);
            expect(() => byName('wall-segment').instantiate(null, {}))
                .toThrow(/needs a DRAW for "ori"/);
            /**
             * …and a zero-parameter template needs no rng at all. ⛓ ARC 3
             * SLICE 1: the SHIPPED ROSTER no longer holds one (`arrow-lane`
             * was it, and ⚖ design ruling 9 took it out), so the degenerate
             * case is exercised by a synthetic row rather than dropped — trap
             * 312: a retired row makes a claim VACUOUS, and the answer is the
             * sentence that still has content, not silence.
             */
            const zeroParam = fakeTemplate({ name: 'z', params: [] });
            expect(zeroParam.instantiate(null).instance).toBe('z');
            expect(PRE_SWORD_TEMPLATES.some((t) => t.params.length === 0)).toBe(false);
        });

        /**
         * ⛓ THE ENUMERATION COUNTS `assertPalette`'s DOCBLOCK STATES, asserted
         * FROM the roster so the table cannot go stale silently (trap 199).
         */
        it('enumerates 23 instantiations at module load, and BOTH biomes ship the SAME '
            + 'roster', () => {
            // ⛓ ARC 3 SLICE 1: 42/44 before `arrow-lane`'s ONE zero-parameter
            // instantiation left with the row (⚖ design ruling 9).
            // ⛓⛓ ARC 3 SLICE 2: post-sword 43 -> 45 (`wall-gap-spinner-killlock`
            // gained a MEASURED two-value `span`), pre-sword stayed 41.
            // ⛓⛓⛓ ARC 3 SLICE 4c: 41/45 -> 23/23. The THREE DOOR TEMPLATES
            // retired into ELEMENTS (⚖ user, 2026-08-16/17), taking 16 + 2
            // pre-sword instantiations and the post-sword kill family's 4 with
            // them. ⛔ THE TWO COUNTS ARE NOW EQUAL AND THAT IS THE HEADLINE:
            // `KILL_LOCK_TEMPLATES` is empty, so the BIOME is the BOOT ITEMS
            // plus the elements' `needs` and nothing else.
            expect(enumerateInstantiations(PRE_SWORD_PALETTE)).toHaveLength(23);
            expect(enumerateInstantiations(POST_SWORD_PALETTE)).toHaveLength(23);
            const perTemplate = Object.fromEntries(
                PRE_SWORD_TEMPLATES.map((t) => [t.name, enumerateValues(t).length]),
            );
            expect(perTemplate).toEqual({
                'wall-segment': 8,
                'water-pool': 9,
                'pit-patch': 6,
            });
            // ⛔ every instance label is unique across the whole palette, which
            // is what lets a pane row identify a geometry rather than a key.
            const labels = enumerateInstantiations(POST_SWORD_PALETTE).map((t) => t.instance);
            expect(new Set(labels).size).toBe(labels.length);
        });

        /**
         * ⛓⛓ THE ONE RECONSTRUCTION, both callers' — `watchGenerate` and
         * `procgenSeedling` reach the same function.
         */
        it('instantiateKept rebuilds the exact instance a kept row names', () => {
            const kept = { template: 'wall-segment', params: { ori: 'v', len: 5 } };
            const back = instantiateKept(PRE_SWORD_PALETTE, kept);
            expect(back.instance).toBe('wall-segment(ori=v,len=5)');
            expect(back.footprint).toHaveLength(5);
            expect(JSON.stringify(back))
                .toBe(JSON.stringify(instanceOf('wall-segment', { ori: 'v', len: 5 })));
        });

        it('⛔ instantiateKept REFUSES a row whose params are missing — never the default',
            () => {
                expect(() => instantiateKept(PRE_SWORD_PALETTE, { template: 'wall-segment' }))
                    .toThrow(/needs a DRAW for "ori"/);
                expect(() => instantiateKept(PRE_SWORD_PALETTE, { template: 'nope' }))
                    .toThrow(/which palette .* does not hold/);
            });
    });

    /**
     * ⛔⛔⛔ THE GROUP SLOT'S INVARIANTS — every one of them forbids a shape
     * that would look FIXED AND BEHAVE BROKEN, which is why they are checked
     * at module load rather than reviewed.
     */
    describe('the placement-group slot is declared, not assumed', () => {
        /**
         * ⛓ SLICE 2: THESE RUN AGAINST AN INSTANTIATION NOW, which is strictly
         * more than they used to — a `build` that produced a half-converted row
         * for ONE domain value would be caught where a frozen row could only
         * ever be right or wrong once.
         */
        const withEntities = (entities, extra = {}) => fakeTemplate({
            build: () => ({
                footprint: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }],
                terrain: [{ dx: 0, dy: 0, terrain: 'wall' }],
                entities,
                ...extra,
            }),
        });
        const slot = (dx) => ({ dx, dy: 0, type: 'lock', attrs: { tset: PLACEMENT_GROUP } });

        it('refuses the HALF-CONVERTED row — a third entity left on a literal', () => {
            expect(() => assertPalette({
                name: 'half',
                templates: [withEntities([
                    slot(0), slot(1), { dx: 2, dy: 0, type: 'button', attrs: { tset: '0' } },
                ], { groups: 1 })],
            })).toThrow(/still carries the LITERAL tset/);
        });

        it('refuses a SOLO group — one entity that can publish to nothing', () => {
            expect(() => assertPalette({
                name: 'solo',
                templates: [withEntities([slot(0)], { groups: 1 })],
            })).toThrow(/A group of one/);
        });

        it('refuses the slot with NO `groups` — it would reach the level as a literal', () => {
            expect(() => assertPalette({
                name: 'undeclared',
                templates: [withEntities([slot(0), slot(1)])],
            })).toThrow(/declares no `groups`/);
        });

        /**
         * ⛓ THE INJECTIVITY GUARD. The id is derived from the anchor cell, so
         * two kept placements sharing an anchor would share a group. They
         * cannot, because `isFree` refuses a painted or occupied cell — but
         * only if the template WRITES its own (0,0). This keeps that true by
         * construction instead of by a lucky reading of two geometries.
         */
        it('refuses a group-bearing template that does not consume its own anchor', () => {
            expect(() => assertPalette({
                name: 'loose',
                templates: [fakeTemplate({
                    build: () => ({
                        // (0,0) is OCCUPIED but never written — no terrain, no
                        // entity — so a later placement could anchor in it.
                        footprint: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 2, dy: 0 }],
                        terrain: [{ dx: 1, dy: 0, terrain: 'wall' }],
                        entities: [slot(1), slot(2)],
                        groups: 1,
                    }),
                })],
            })).toThrow(/occupy AND write its own anchor/);
        });

        /**
         * ⛓⛓⛓ **NO SHIPPED ROW CARRIES THE SLOT SINCE SLICE 4c**, and saying so
         * is the row rather than deleting it.
         *
         * Until 4c the carriers were exactly the weigh family (`wall-gap-lock-
         * weigh(ori=h)` and `(ori=v)`, two of them, `groups: 1` each). That
         * template retired into the `guard` ELEMENT, and the elements carry
         * their OWN ids (`procgenCore/elements.guardIdsFor`) rather than this
         * palette's sentinel. ⛔ The mechanism is untouched: the three
         * invariants above still refuse, and `SLOT_DOOR` (this file's fixture)
         * is what the driven rows below place.
         *
         * ⚠ THE CLAIM IS AN EMPTY SET, WHICH IS THE WEAKEST KIND — so it is
         * paired with the one that can fail: EVERY carrier, if one ever
         * arrives, must declare `groups` and put the sentinel on at least two
         * entities. A roster row added with the sentinel and no declaration
         * lands here as a FAILING test rather than as an uncounted row.
         */
        it('NO shipped instantiation carries the group slot today — and any that did '
            + 'would have to declare it', () => {
            const carriers = enumerateInstantiations(POST_SWORD_PALETTE)
                .filter((t) => t.groups !== undefined);
            expect(carriers.map((t) => t.instance)).toEqual([]);
            const sentinelled = enumerateInstantiations(POST_SWORD_PALETTE).filter(
                (t) => (t.entities ?? []).some(
                    (e) => Object.values(e.attrs ?? {}).includes(PLACEMENT_GROUP),
                ),
            );
            expect(sentinelled.map((t) => t.instance)).toEqual([]);
            // ⛓ and the fixture the driven rows use IS a carrier, so the
            // assertion above is about the ROSTER and not about the check.
            expect(slotDoor().groups).toBe(1);
            expect(slotDoor().entities.filter(
                (e) => Object.values(e.attrs ?? {}).includes(PLACEMENT_GROUP),
            )).toHaveLength(2);
        });
    });

    /**
     * ⛔⛔ THE TAG SLOT — the group's invariants with ONE deliberate difference,
     * and the difference is the point: a group of one is meaningless, a TAG of
     * one is the normal case (a lock's private flag is its own).
     */
    describe('the placement-tag slot is declared, not assumed', () => {
        const row = (entities, extra = {}) => fakeTemplate({
            name: 't',
            family: 't',
            build: () => ({
                footprint: [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }],
                terrain: [{ dx: 0, dy: 0, terrain: 'wall' }],
                entities,
                ...extra,
            }),
        });
        const tagSlot = (dx) => ({ dx, dy: 0, type: 'lock', attrs: { tag: PLACEMENT_TAG } });

        it('refuses the slot with NO `tags` — it would be read as the goal\'s flag', () => {
            expect(() => assertPalette({ name: 'u', templates: [row([tagSlot(0)])] }))
                .toThrow(/declares no `tags`/);
        });

        it('refuses `tags` with nothing on the slot — a claim with nothing behind it', () => {
            expect(() => assertPalette({
                name: 'empty', templates: [row([{ dx: 0, dy: 0, type: 'lock' }], { tags: 1 })],
            })).toThrow(/no entity carries PLACEMENT_TAG/);
        });

        it('refuses a LITERAL tag >= 0 beside the slot — two rows of the table', () => {
            expect(() => assertPalette({
                name: 'lit',
                templates: [row([
                    tagSlot(0), { dx: 1, dy: 0, type: 'lock', attrs: { tag: '4' } },
                ], { tags: 1 })],
            })).toThrow(/still carries the LITERAL tag/);
        });

        /**
         * ⛓ AND `-1` IS ALLOWED, which a copy of the group's rule would have
         * broken: it is the game's own spelling of UNTAGGED (`tagOf` returns it
         * for a missing attribute) and `KILL_LOCK_TEMPLATES`'s spinner carries
         * it deliberately.
         */
        it('ALLOWS a literal -1 beside the slot — that is "untagged", not a slot', () => {
            expect(assertPalette({
                name: 'ok',
                templates: [row([
                    tagSlot(0), { dx: 1, dy: 0, type: 'spinner', attrs: { tag: '-1' } },
                ], { tags: 1 })],
            })).toBe(true);
        });

        it('NO shipped instantiation carries the tag slot today, in EITHER biome', () => {
            // ⛓⛓ SLICE 4c: the carriers were the weigh family pre-sword and the
            // weigh + kill families post-sword; all three retired into ELEMENTS.
            // ⛔ BOTH biomes are asked, because the post-sword list is where the
            // kill row lived and an empty-set claim about the smaller one would
            // not cover it.
            for (const palette of [PRE_SWORD_PALETTE, POST_SWORD_PALETTE]) {
                expect(enumerateInstantiations(palette)
                    .filter((t) => t.tags !== undefined).map((t) => t.instance)).toEqual([]);
                expect(enumerateInstantiations(palette).filter(
                    (t) => (t.entities ?? []).some(
                        (e) => Object.values(e.attrs ?? {}).includes(PLACEMENT_TAG),
                    ),
                ).map((t) => t.instance)).toEqual([]);
            }
            expect(slotDoor().tags).toBe(1);
        });

        /**
         * ⛓⛓⛓ **THREE ROWS STOOD HERE AND THEY WENT WITH THEIR SUBJECT** (arc 3
         * slice 4c) — *"post-sword, the kill family is on the slot too"*, *"the
         * kill lock is on the PER-PLACEMENT slot — no literal, no shared flag"*
         * and *"DRIVEN: seed 31 keeps THREE tag-bearing locks and they take
         * DISTINCT tags"*. All three asserted about `wall-gap-spinner-killlock`
         * and `wall-gap-lock-weigh`, which retired into the `killgate` and
         * `guard` ELEMENTS.
         *
         * ⛔ WHAT THE THIRD ONE PROVED IS NOT LOST, AND THAT IS WHY THIS
         * TOMBSTONE NAMES IT. It was the DRIVEN half of the tag collision (⚖
         * GENERATE-mode UI slice 3 track C: a LITERAL `tag: '1'` on two kept
         * kill locks wrote two `scratchClears` rows for one slot), and its
         * subject was a GENERATED ROOM holding two tag-bearing placements. No
         * generated room can hold one now — the roster has no tag-bearing row at
         * all — so the claim moved DOWN a layer rather than sideways: `⛔ every
         * placement gets a PRIVATE tag, and none of them is the goal's` places
         * THREE `SLOT_DOOR`s in one record and reads the tags off it, which is
         * the same question asked of `place` instead of of the loop.
         *
         * ⚠ WHAT IS HONESTLY WEAKER: nothing now drives the LOOP's own
         * two-placements-in-one-generated-level path. It cannot be driven until
         * a slot-bearing row ships again (arc 5's arena), and inventing a
         * roster row to keep a test green would be a fixture pretending to be a
         * product.
         */
    });

    it('every family in the roster is represented, and the count comes FROM the roster', () => {
        const families = new Set(PRE_SWORD_TEMPLATES.map((t) => t.family));
        // ⛓ PoC slice 3b added `weigh` — the palette's SECOND clearer family
        // and the first whose template places three cooperating entities.
        // ⛓ ARC 3 SLICE 1: `arrow-lane` (a family AND a template) is gone.
        // ⛓⛓⛓ ARC 3 SLICE 4c: `shove` and `weigh` left with their templates
        // (and `kill` left the post-sword list), so the shipped roster is THREE
        // DECORATION families and NO clearer. That is the retirement stated as
        // a set: what pass 2 still does is decorate, and every MECHANISM the
        // generator ships is an ELEMENT built in pass 1.
        expect([...families].sort()).toEqual(['pit', 'wall', 'water']);
        expect(PRE_SWORD_PALETTE.templates).toBe(PRE_SWORD_TEMPLATES);
        expect(PRE_SWORD_PALETTE.items).toEqual({ hasSword: false, hasShield: false });
    });

    /**
     * ⛓⛓⛓ **THE BIOME IS THE BOOT ITEMS PLUS THE ELEMENTS' `needs` — ONE
     * ROSTER, TWO INVENTORIES** (arc 3, slice 4c; ⚖ user, 2026-08-17).
     *
     * Slice 4e split the two rosters for `wall-gap-spinner-killlock`, the arc's
     * only sword-gated FAMILY. 4c retired it, so `KILL_LOCK_TEMPLATES` is empty
     * and `POST_SWORD_TEMPLATES` is a spread of a list with nothing added. ⛔
     * The seam is kept (an empty array with its docblock) rather than deleted —
     * arc 5's arena is the next sword-gated family — but a reader must not be
     * left thinking the two biomes still differ in what they can DRAW.
     *
     * ⚠ ASSERTED BY VALUE AND NOT BY IDENTITY: `POST_SWORD_TEMPLATES` is a NEW
     * frozen array (the spread), so `toBe` would fail for a reason that has
     * nothing to do with the claim. What is claimed is that the two rosters name
     * the same rows in the same order, and that the ONLY difference between the
     * biomes is the boot.
     */
    it('⛓⛓ BOTH biomes ship the SAME roster — the biome is the BOOT ITEMS', () => {
        expect(POST_SWORD_TEMPLATES.map((t) => t.name))
            .toEqual(PRE_SWORD_TEMPLATES.map((t) => t.name));
        // ⛔ the same frozen ROW objects, not equal-looking copies — a second
        // instantiation of one template is the two-cost-models shape.
        for (const [i, t] of POST_SWORD_TEMPLATES.entries()) {
            expect(t).toBe(PRE_SWORD_TEMPLATES[i]);
        }
        // ...and the boot is where the two differ, which is the whole split now.
        expect(PRE_SWORD_PALETTE.items).toEqual({ hasSword: false, hasShield: false });
        expect(POST_SWORD_PALETTE.items).toEqual({ hasSword: true, hasShield: false });
    });
});

describe('every template builds what it claims — asked of the BUILT WORLD', () => {
    /**
     * ⛓⛓ SLICE 2: THE SIZE FAMILIES ARE DRIVEN ACROSS THEIR WHOLE DOMAIN, not
     * at the one size the frozen row happened to hold. The claim each makes is
     * the same claim it always made — the cells reach the right ENGINE ROSTER —
     * and the count comes from the INSTANCE rather than from a number typed
     * here, so a `build` that ignored its own `len` would fail rather than
     * quietly ship a 3-cell wall labelled `len=5`.
     *
     * ⛔ THIS IS THE CASE THAT CATCHES AN `instantiate` THAT IGNORES ITS DRAW.
     * `assertPalette` walks every instantiation for SHAPE; only a built world
     * says the shape is the one the label claims.
     */
    for (const len of enumerateValues(byName('wall-segment'))
        .filter((v) => v.ori === 'h').map((v) => v.len)) {
        it(`wall-segment(ori=h,len=${len}) joins \`solids\` with the Stone tag, `
            + `${len} cells of it`, () => {
            const m = model();
            const world = worldFor(placedAt(m, 'wall-segment', { tx: 1, ty: 3 }, { ori: 'h', len }));
            /**
             * ⚠ a solid's `x`/`y` are its CENTRE; `rect` is the cell.
             *
             * ⛔ THE RANGE IS THE WHOLE INTERIOR, NOT `len` — and that is a
             * defect caught in this slice's own mutant run. The first cut
             * bounded the filter at `len * TILE_SIZE`, so a `build` that
             * ignored its `len` and always emitted THREE cells passed at
             * `len=2` (the filter only counted the two it was looking for) and
             * failed at 4 and 5. A window sized by the number under test cannot
             * see an OVERSHOOT. Scoped to the interior, an over-long wall is
             * counted and the case reds at every value.
             */
            const placed = world.solids.filter((s) => s.tag === 'tile:Stone'
                && s.rect.y === 3 * TILE_SIZE
                && s.rect.x >= 1 * TILE_SIZE && s.rect.x <= 8 * TILE_SIZE);
            expect(placed).toHaveLength(len);
        });
    }

    it('wall-segment(ori=v) is the same segment on end, at every declared length', () => {
        for (const { len } of enumerateValues(byName('wall-segment')).filter((v) => v.ori === 'v')) {
            const m = model();
            const world = worldFor(placedAt(m, 'wall-segment', { tx: 3, ty: 1 }, { ori: 'v', len }));
            // ⛔ the whole interior, not `len` — see the horizontal case above.
            const placed = world.solids.filter((s) => s.tag === 'tile:Stone'
                && s.rect.x === 3 * TILE_SIZE
                && s.rect.y >= 1 * TILE_SIZE && s.rect.y <= 8 * TILE_SIZE);
            expect(placed, `len=${len}`).toHaveLength(len);
        }
    });

    it('water-pool lands w x h cells in `lethalTerrainTiles` as tile type 1, every size', () => {
        for (const { w, h } of enumerateValues(byName('water-pool'))) {
            const m = model();
            const world = worldFor(placedAt(m, 'water-pool', { tx: 3, ty: 3 }, { w, h }));
            const pool = world.lethalTerrainTiles.filter((t) => t.tx >= 3 && t.tx < 3 + w
                && t.ty >= 3 && t.ty < 3 + h);
            expect(pool, `${w}x${h}`).toHaveLength(w * h);
            expect(pool.every((t) => t.t === 1)).toBe(true);
        }
    });

    it('pit-patch lands w x h cells in `pitTiles` as tile type 6, every size', () => {
        for (const { w, h } of enumerateValues(byName('pit-patch'))) {
            const m = model();
            const world = worldFor(placedAt(m, 'pit-patch', { tx: 3, ty: 3 }, { w, h }));
            const pit = world.pitTiles.filter((t) => t.tx >= 3 && t.tx < 3 + w
                && t.ty >= 3 && t.ty < 3 + h);
            expect(pit, `${w}x${h}`).toHaveLength(w * h);
            expect(pit.every((t) => t.t === 6)).toBe(true);
        }
    });

    /**
     * ⛓ TWO ROWS STOOD HERE — *"arrow-lane joins `arrowTraps` with shootDefault
     * TRUE"* and *"the arrow lane has NO presser in this palette"*. ⛔ THEY ARE
     * DELETED, NOT SKIPPED: ⚖ design ruling 9 took `arrow-lane` out of the
     * generator, and a test of a template no palette holds is a test of
     * nothing. The ENGINE's arrow trap is untouched and is still driven by
     * `arrowTrap.test.js` and `levelWorld.test.js` — what left is the
     * GENERATOR's use of it, which is what the ruling was about.
     */
    /**
     * ⛓⛓⛓ **THREE ROWS STOOD HERE AND RETIRED WITH THE DOOR TEMPLATES** (arc 3,
     * slice 4c) — *"wall-gap-block(ori=h) walls the whole interior but one cell,
     * and stands a block in it"*, *"wall-gap-block(ori=v) is the same door on
     * end, at every declared gap"* and *"wall-gap-lock-weigh(ori=h|v) stands a
     * lock in the gap and a block that can reach its button"*.
     *
     * ⛔ DELETED RATHER THAN TOMBSTONED WITH A LESSON, because what they asked
     * was *does this template's build write the geometry it claims* — a question
     * about a row that no longer exists. What the two doors TAUGHT is on their
     * `EXCLUDED_TEMPLATES` rows (`procgenPalette.js`) with the numbers that
     * retired them, and the mechanisms themselves are driven where they now
     * live: `procgenDoorElements.test.js` (the kill gate and the block pocket,
     * built and CERTIFIED) and `procgenSeedlingElements.test.js` (the guard's
     * lock/button pair, its lane and its round trip).
     *
     * ⚠ THE ONE CLAIM THAT WAS NEITHER GEOMETRY NOR MECHANISM — *the button
     * publishes the LOCK's own group* — is the group slot's, and it is driven
     * below on `SLOT_DOOR`.
     */

    /**
     * ⛔⛔⛔ THE CLAIM THE ONE ABOVE COULD NOT MAKE — and the user's
     * 2026-08-13 defect lived in the gap between them for the whole arc.
     *
     * `expect(button.t).toBe(lock.t)` is a claim about ONE placement, and it
     * is true of a shared literal and a private group alike: it passed on
     * every commit while *"both of the switches open both of the doors"* was
     * true of every two-pair level the generator emitted. The missing claim is
     * the CROSS-placement one, so it is made here, of a world holding two.
     *
     * ⛓ MEASURED BEFORE THE FIX (`--seed=1 --count=4`, the default seed):
     * `lock@80,48 t=0`, `button@96,32 t=0`, `lock@80,80 t=0`,
     * `button@96,64 t=0` — one group, four entities, and
     * `activators.js`'s setter publishes to every one of them.
     *
     * ⛓⛓ RE-POINTED AT `SLOT_DOOR` IN SLICE 4c — the subject was the weigh
     * template, which retired into the `guard` ELEMENT. ⛔ The DEFECT is a fact
     * about `place` and `placementGroupId`, not about that template, so the row
     * stays and its subject is the fixture. See `SLOT_DOOR`'s docblock.
     */
    it('⛔ TWO placements are TWO groups — the user-reported defect, as a test', () => {
        const m = model();
        const two = m.place(
            m.place(m.skeleton(), slotDoor(), { tx: 1, ty: 3 }),
            slotDoor(), { tx: 1, ty: 6 },
        );
        const world = worldFor(two);
        expect(world.activators).toHaveLength(2);
        expect(world.pressers).toHaveLength(2);

        const [lockA, lockB] = world.activators;
        expect(lockA.t).not.toBe(lockB.t);

        // ⛔ THE PAIRING ITSELF, asked the way `solverBot.refineStrategy` asks
        // it (`pressers.filter((p) => p.t === row.t)`): each lock has EXACTLY
        // ONE opener. Before the fix this returned two for both locks — the
        // solver was already asking the group question correctly and the
        // palette was answering it wrongly.
        for (const lock of world.activators) {
            expect(world.pressers.filter((p) => p.t === lock.t)).toHaveLength(1);
        }
    });

    it('⛔ neither group is 0, −1 or −2 — the ranges the ENGINE has claimed', () => {
        const m = model();
        // `tSetOf` returns 0 for a MISSING tset, so group 0 is "every unmarked
        // activator in the room"; `FORCED_TSET` holds −1 (bosslock) and −2
        // (shieldlock), and `levelWorld` reads t < 0 as lock-despawn. A
        // generated group in any of those is a collision with the game itself.
        for (const c of m.interiorCells(m.skeleton())) {
            expect(placementGroupId(c, m.defaults.height)).toBeGreaterThan(0);
        }
    });

    /**
     * ⚖ THE DETERMINISM DECLARATION, DRIVEN — `placementGroupId`'s docblock
     * says the allocator is the ANCHOR and not a counter, and the reason is
     * that `levelGenerator` calls `place` on rejected candidates too. A
     * counter would make a kept placement's group a function of how many
     * candidates were thrown away first; this asserts it is not.
     */
    it('the group is a function of the ANCHOR — not of what the loop tried first', () => {
        const m = model();
        const at = { tx: 2, ty: 5 };
        // ⛓ SLICE 4c: `SLOT_DOOR`, for the reason in its docblock.
        const t = slotDoor();
        const lockOf = (record) => worldFor(record).activators[0].t;

        const straight = lockOf(m.place(m.skeleton(), t, at));
        // The same anchor, reached after two OTHER placements the loop would
        // have reverted — placed here on a record that keeps them, which is
        // strictly harder than the reverting case.
        const after = lockOf(m.place(
            m.place(m.place(m.skeleton(), instanceOf('wall-segment', { ori: 'h', len: 3 }), { tx: 5, ty: 1 }),
                instanceOf('wall-segment', { ori: 'v', len: 3 }), { tx: 7, ty: 4 }),
            t, at,
        ));
        expect(after).toBe(straight);
        expect(straight).toBe(placementGroupId(at, m.defaults.height));

        // ...and two anchors are two groups, over the whole interior.
        const cells = m.interiorCells(m.skeleton());
        const ids = cells.map((c) => placementGroupId(c, m.defaults.height));
        expect(new Set(ids).size).toBe(cells.length);
    });

    /**
     * ⛔⛔⛔ THE PERSISTENCE TAG, and the defect here was WITH THE GOAL rather
     * than between two placements.
     *
     * `Lock.turnOff()` writes `setPersistence(tag, false)` with no `tag >= 0`
     * guard and `returnToNormal()` writes it back TRUE, so a weigh lock on
     * `tag: '0'` toggled `SEEDLING_DEFAULTS.goalTag` — the flag
     * `TorchPickup.check()` reads to decide whether the goal still exists.
     *
     * ⛓ MEASURED before the fix, post-sword seeds 1..24 at target 6: 12 of 24
     * levels shared a tag, every one of them the goal's; seed 10 had
     * `torchpickup@32,112` sharing tag 0 with THREE locks.
     */
    it('⛔ every placement gets a PRIVATE tag, and none of them is the goal\'s', () => {
        const m = model();
        let record = m.skeleton();
        // ⛓ SLICE 4c: three `SLOT_DOOR`s, for the reason in its docblock — and
        // this is also where the retired *"seed 31 keeps THREE tag-bearing
        // locks"* row's claim now lives, asked of `place` rather than the loop.
        for (const at of [{ tx: 1, ty: 3 }, { tx: 1, ty: 6 }, { tx: 1, ty: 8 }]) {
            record = m.place(record, slotDoor(), at);
        }
        const tags = record.entities
            .map((e) => tagOf(e.type, e.attrs))
            .filter((t) => t >= 0);
        // goal + three locks, all distinct
        expect(tags).toHaveLength(4);
        expect(new Set(tags).size).toBe(4);

        const goalTag = Number.parseInt(m.defaults.goalTag, 10);
        const lockTags = record.entities
            .filter((e) => e.type === 'lock')
            .map((e) => tagOf(e.type, e.attrs));
        expect(lockTags).toHaveLength(3);
        for (const t of lockTags) {
            expect(t).not.toBe(goalTag);
            // ⛔ IN RANGE. The game indexes one flat array as `level * 30 + tag`
            // with no bounds check, so an out-of-range tag writes the NEXT
            // level's row rather than erroring.
            expect(t).toBeGreaterThanOrEqual(0);
            expect(t).toBeLessThan(TAGS_PER_LEVEL);
        }
    });

    it('the tag is a function of the RECORD — not of what the loop tried first', () => {
        const m = model();
        const t = slotDoor();
        const at = { tx: 1, ty: 6 };
        const lockTagOf = (record) => record.entities
            .filter((e) => e.type === 'lock').map((e) => tagOf(e.type, e.attrs)).pop();

        const straight = lockTagOf(m.place(m.skeleton(), t, at));
        // A candidate the loop would REVERT does not enter the record, so it
        // cannot shift a later tag. Placing and discarding proves it: the
        // discarded record is simply not threaded on.
        const skeleton = m.skeleton();
        m.place(skeleton, t, { tx: 1, ty: 3 });          // built, then dropped
        expect(lockTagOf(m.place(skeleton, t, at))).toBe(straight);
        // ...and the reserved list holds even against a record with no goal.
        expect(placementTagId({ entities: [] }, [0])).toBe(1);
        expect(placementTagId({ entities: [] })).toBe(0);
    });

    it('⛔ REFUSES BY NAME when all 30 tags are gone, rather than writing tag 30', () => {
        const full = {
            entities: Array.from({ length: TAGS_PER_LEVEL }, (_, i) => ({
                type: 'lock', attrs: { tag: String(i) },
            })),
        };
        expect(() => placementTagId(full)).toThrow(/already uses all 30 persistence tags/);
    });

    it('⛔ NO SENTINEL SURVIVES INTO A LEVEL — an unresolved slot parses as group 0', () => {
        const m = model();
        const record = m.place(m.skeleton(), slotDoor(), { tx: 4, ty: 1 });
        for (const e of record.entities) {
            for (const v of Object.values(e.attrs ?? {})) expect(v).not.toBe(PLACEMENT_GROUP);
        }
        // And the guard is real: a template carrying the slot with no `groups`
        // declaration is refused BY NAME rather than written as a literal.
        const undeclared = { ...slotDoor(), name: 'undeclared', groups: undefined };
        expect(() => m.place(m.skeleton(), undeclared, { tx: 4, ty: 1 }))
            .toThrow(/declares no `groups`/);
    });

    /**
     * ⛓⛓⛓ **FOUR ROWS STOOD HERE AND ALL FOUR RETIRED WITH THE DOOR
     * TEMPLATES** (arc 3, slice 4c). Named, because two of them cost real money
     * and one of them taught something:
     *
     *  · *"the weigh templates declare the whole slide path, so no anchor can
     *    land the block on the goal"* — the S1 GUARD, and it was TEMPLATE
     *    legality rather than a solver special case. ⛓ THE LAW SURVIVES ITS
     *    SUBJECT AND IS NOW THE ELEMENT'S: `blockPocket` refuses by name when
     *    the straight run reaches the goal, and `procgenDoorElements.test.js`
     *    drives it. The difference is that the element MEASURES the run instead
     *    of declaring a footprint that covers it.
     *  · *"every door instantiation is a LINE with exactly ONE gap, and the gap
     *    is the DOOR CELL"* — asked of `doorGeometry`'s output through the three
     *    door rows. `doorGeometry` itself is untouched and
     *    `procgenSeedlingDoorCut.test.js` still drives it directly, which is
     *    where it now has its only callers (that file and the door census).
     *  · *"every CLEARER family is KEPT in a generated room that certifies its
     *    collect"* and *"⛔ the weigh door is CROSSED in a generated room, not
     *    merely kept beside one"*. ⛔⛔ **THESE TWO WERE THE 118x SUITE COST**
     *    (§13.0.4): each scanned `seed = 1..20` calling
     *    `generateSeedlingLevel({bounds:{obstacleTarget: 6}})` until a kept
     *    `shove`/`weigh` template appeared, and the goal draw made that rarer
     *    before the retirement made it impossible. There is no clearer family
     *    in either roster now, so the loop would run all twenty seeds and find
     *    nothing — a row that cannot pass rather than a row that is slow.
     *    ⛓ WHAT THEY PROVED — *a mechanism is not merely KEPT beside the route,
     *    it is USED by the solve* — is the CERTIFICATION's job now, and it is a
     *    stronger form of the same claim: `seedlingSeam` runs the element's own
     *    solve and records the `{strategy}` it discharged plus the LIFTED CLAIM,
     *    and `procgenDoorElements.test.js` / `procgenSeedlingElementsCertify
     *    .test.js` assert both. A kept-count could never say which; a lifted
     *    claim says it by construction.
     */
    it('EVERY template in the roster is verified above — by name, not by count', () => {
        // The list this test compares against is the one the cases assert on.
        // ⛓ SLICE 4c: the two door rows left it with their templates.
        const verified = ['wall-segment', 'water-pool', 'pit-patch'];
        expect(PRE_SWORD_TEMPLATES.map((t) => t.name).sort()).toEqual([...verified].sort());
        // ⛔ AND THE POST-SWORD ROSTER IS VERIFIED BY THE SAME LIST NOW, which
        // is the retirement's headline said once more where it can fail.
        expect(POST_SWORD_TEMPLATES.map((t) => t.name).sort()).toEqual([...verified].sort());
    });
});

/**
 * ⛓ A `describe` BLOCK STOOD HERE — *"the arrow lane's clearance rule is the
 * ENGINE's geometry"*, four rows driving `model.laneClear`. ⛔ DELETED WITH THE
 * RULE: `laneClear` was `arrow-lane`'s own contract and its only caller, so it
 * left with the row (⚖ arc-3 kickoff §6 Q3's named default). Keeping the rule
 * to keep its tests green would have been dead code wearing a legality rule's
 * name; the measurement it carried now lives on the `arrow-lane` row in
 * `EXCLUDED_TEMPLATES`.
 */

describe('the bindings place atomically and refuse illegally', () => {
    it('the skeleton is a bordered room with exactly the goal pickup in it', () => {
        const m = model();
        const record = m.skeleton();
        expect(record.entities).toHaveLength(1);
        expect(record.entities[0].type).toBe('torchpickup');
        expect(terrainAt(record, 0, 0)).toBe('wall');
        expect(terrainAt(record, 1, 1)).toBe('ground');
    });

    it('never anchors on the start or the goal cell', () => {
        const m = model();
        expect(m.isFree(m.skeleton(), m.defaults.start.tx, m.defaults.start.ty)).toBe(false);
        expect(m.isFree(m.skeleton(), m.goalCell.tx, m.goalCell.ty)).toBe(false);
    });

    it('never anchors on a cell an earlier template already painted', () => {
        const m = model();
        const once = placedAt(m, 'wall-segment', { tx: 3, ty: 3 }, { ori: 'h', len: 3 });
        expect(m.isFree(once, 3, 3)).toBe(false);
        expect(m.isFree(once, 4, 3)).toBe(false);
        expect(m.isFree(once, 6, 3)).toBe(true);
    });

    it('never anchors on a cell an earlier ENTITY template occupies', () => {
        const m = model();
        /**
         * ⛓ RE-PICKED TWICE. Arc 3 slice 1: the subject was `arrow-lane`, the
         * only one-cell entity template, and it left the roster;
         * `wall-gap-lock-weigh` took over. ⛓⛓ ARC 3 SLICE 4c: that row retired
         * too, and **NO SHIPPED TEMPLATE PLACES AN ENTITY ANY MORE** — the three
         * that did are the door families, now ELEMENTS. So the subject is
         * `SLOT_DOOR`, this file's fixture.
         *
         * ⛔ THAT IS THE RIGHT SUBJECT RATHER THAN A CONVENIENT ONE: the claim
         * is *an entity's cell is not free*, which is a fact about `place` and
         * `isFree`. It was never a fact about the template, and the two earlier
         * re-picks were chasing whichever roster row happened to carry an
         * entity. ⚠ The cell is still FOUND from the record rather than
         * hard-coded, so reading an offset off the fixture cannot turn this into
         * a claim about the fixture's geometry.
         */
        const once = m.place(m.skeleton(), slotDoor(), { tx: 1, ty: 3 });
        const lock = once.entities.find((e) => e.type === 'lock');
        expect(lock).toBeTruthy();
        const tx = Math.floor(lock.x / TILE_SIZE);
        const ty = Math.floor(lock.y / TILE_SIZE);
        expect(m.isFree(m.skeleton(), tx, ty)).toBe(true);
        expect(m.isFree(once, tx, ty)).toBe(false);
    });

    it('PLACEMENT IS PURE — the old record is untouched, which is what revert is', () => {
        const m = model();
        const before = m.skeleton();
        const json = JSON.stringify(before);
        const after = m.place(before, instanceOf('water-pool', { w: 2, h: 2 }), { tx: 3, ty: 3 });
        expect(JSON.stringify(before)).toBe(json);
        expect(after).not.toBe(before);
        expect(Object.isFrozen(after)).toBe(true);
    });

    it('an out-of-rectangle footprint is refused by the LEVEL MODEL, by name', () => {
        const m = model();
        expect(() => m.place(m.skeleton(), instanceOf('wall-segment', { ori: 'h', len: 3 }), { tx: 9, ty: 5 }))
            .toThrow(ProcgenLevelError);
        // and the loop is told which error class is the model's own
        expect(m.placementError).toBe(ProcgenLevelError);
    });

    it('`anchorsFor` returns an EMPTY LIST rather than looping when nothing fits', () => {
        const m = model();
        // a template whose footprint is the whole interior cannot be placed
        const huge = {
            name: 'huge', family: 'x',
            footprint: Array.from({ length: 64 }, (_, i) => ({ dx: i % 8, dy: Math.floor(i / 8) })),
            terrain: [], entities: [],
        };
        expect(m.anchorsFor(m.skeleton(), huge, rngFor(5), 1)).toEqual([]);
        // ⛓ and raising the bound does not conjure one — the whole interior refuses
        expect(m.anchorsFor(m.skeleton(), huge, rngFor(5), 12)).toEqual([]);
    });

    /**
     * ⛓⛓⛓ GENERATE-mode UI slice 3, TRACK B — **THE MECHANISM THAT MAKES
     * DEFAULT 1 BYTE-INERT**, asserted rather than argued.
     *
     * The anchor search would move every recorded seed→level pair if raising
     * the bound cost extra draws, because the loop's very next `rng.pick` would
     * come off a different stream position. It does not: `anchorsFor` spends
     * ONE shuffle whatever the limit is, and the limit only truncates the
     * already-drawn order.
     */
    it('⛓ the anchor list costs the SAME draws at every limit, and is a PREFIX chain', () => {
        const m = model();
        const t = instanceOf('wall-segment', { ori: 'h', len: 3 });
        const spend = (limit) => {
            const rng = rngFor(5);
            const anchors = m.anchorsFor(m.skeleton(), t, rng, limit);
            return { anchors, draws: rng.draws, state: rng.state };
        };
        const one = spend(1);
        const three = spend(3);
        const twelve = spend(12);
        // ⛔ the stream is left in the SAME place — this is the whole claim
        expect(three.draws).toBe(one.draws);
        expect(twelve.draws).toBe(one.draws);
        expect(three.state).toBe(one.state);
        expect(twelve.state).toBe(one.state);
        // and the longer list EXTENDS the shorter one rather than reordering it
        expect(three.anchors.slice(0, 1)).toEqual(one.anchors);
        expect(twelve.anchors.slice(0, 3)).toEqual(three.anchors);
        expect(three.anchors).toHaveLength(3);
        // every cell is legal, and no cell is offered twice
        for (const c of twelve.anchors) {
            expect(m.legalAt(m.skeleton(), t, c.tx, c.ty)).toBe(true);
        }
        expect(new Set(twelve.anchors.map((c) => `${c.tx},${c.ty}`)).size)
            .toBe(twelve.anchors.length);
    });

    it('refuses a limit that is not a positive integer — the bound is named in the trace',
        () => {
            const m = model();
            const t = instanceOf('wall-segment', { ori: 'h', len: 3 });
            expect(() => m.anchorsFor(m.skeleton(), t, rngFor(5), 0))
                .toThrow(/positive integer limit/);
        });

    /**
     * ⛓⛓⛓ **A ROW STOOD HERE AND ITS SUBJECT CANNOT BE REBUILT** — *"⛓ seed 7:
     * the plain door REFUSES at anchor 1 and SOLVES at anchor 2"* (arc 3, slice
     * 4c). It was the UNIT-level case the anchor search exists for: one
     * template, one bare skeleton, the first anchor refusing and the second
     * solving. Its subject was `wall-gap-block(ori=v,gap=0)`, retired.
     *
     * ⛔ **RE-PICKED BY ITS OWN SCAN, AND THE SCAN CAME BACK EMPTY** (trap 285 —
     * the target and the count are named). Every instantiation of every
     * remaining pre-sword row, walked over its first three legal anchors on the
     * bare skeleton, seeds 1..30: **240 (instance, seed) cells tested, 0 with a
     * refusing first anchor.** That is not bad luck, it is the retirement's own
     * consequence: the three families that could SEAL a bare room were the door
     * templates, and `wall-segment`/`water-pool`/`pit-patch` are decoration —
     * a bare 10x10 room solves around all three at every anchor.
     *
     * ⛓ WHAT THE CLAIM BECOMES is the row below, which is the same question
     * asked where it still has an answer: **a room that already holds
     * obstacles**. That is where a candidate's first anchor can fail, and it is
     * also the only place the bound was ever spent for real. ⇒ deleted rather
     * than weakened to a case that cannot fail (⚖ a vacuous row is worse than
     * no row), and the deletion is recorded here with the number.
     */

    /**
     * ⛓⛓⛓ …AND THIS IS NOW THE ONLY PLACE THE BOUND IS DRIVEN (see the
     * tombstone above). Pre-sword at target 6 with `anchorTriesPerCandidate: 3`
     * KEEPS a candidate at a later anchor that the default bound REVERTS.
     *
     * ⛔ THE ROW PAIR IS THE CLAIM. The rescued row shares `step`/`try` with the
     * refusal before it and differs in `anchorTry` AND in `at`: a search that
     * re-tested the FIRST anchor would produce the same two rows with the same
     * ordinals and the same verdicts, and only the CELL separates them.
     */
    it('⛓ DRIVEN: seed 18 keeps at anchor 2+ a candidate the default bound reverts', () => {
        /**
         * ⛓ RE-PICKED TWICE, BOTH TIMES BY THE SAME SCAN (trap 285 — the target
         * and the count are named). Arc 3 slice 1: `arrow-lane` left and seed 5's
         * rescue went with it; eight seeds still produced one and seed 9 was
         * taken because it produced THREE.
         *
         * ⛓⛓ ARC 3 SLICE 4c: the retirement and the goal draw moved every level
         * again. RE-SCANNED at the same bounds over seeds 1..30 through the
         * SHIPPED default generator (the biome's element spec included — this is
         * the generator a reader gets): **FOUR seeds produce a rescue — 18, 21,
         * 24 and 30 — one each, and none produces more.** ⇒ **seed 18** is
         * taken, and the expected count falls from 3 to 1 because that is what
         * the roster now yields, not because the row was relaxed.
         *
         * ⚠ THE THINNING IS ITSELF THE RETIREMENT'S SHADOW and is said rather
         * than absorbed: eight seeds with three rescues at the top became four
         * with one. A room drawing from three decoration families reverts less
         * often, so there is less for a wider anchor walk to rescue.
         */
        const bounds = { obstacleTarget: 6, anchorTriesPerCandidate: 3 };
        const wide = generateSeedlingLevel({ seed: 18, palette: PRE_SWORD_PALETTE, bounds });
        const rescued = wide.trace.filter((r) => r.outcome === 'KEPT' && r.anchorTry > 1);
        expect(rescued.length).toBe(1);
        for (const r of rescued) {
            const i = wide.trace.indexOf(r);
            const before = wide.trace[i - 1];
            expect(before.step).toBe(r.step);
            expect(before.try).toBe(r.try);
            expect(before.anchorTry).toBe(r.anchorTry - 1);
            expect(before.outcome).toBe('REVERTED');
            // ⛔ the walk really ADVANCED
            expect(`${before.at.tx},${before.at.ty}`).not.toBe(`${r.at.tx},${r.at.ty}`);
            expect(r.anchorsOffered).toBeGreaterThanOrEqual(r.anchorTry);
        }
        // and the default bound really does lose it: same (step,try), REVERTED
        const narrow = generateSeedlingLevel({
            seed: 18, palette: PRE_SWORD_PALETTE, bounds: { obstacleTarget: 6 },
        });
        const first = rescued[0];
        const same = narrow.trace.find((r) => r.step === first.step && r.try === first.try);
        expect(same.outcome).toBe('REVERTED');
        expect(same.anchorTry).toBe(1);
        expect(JSON.stringify(narrow.record)).not.toBe(JSON.stringify(wide.record));
    });
});

/**
 * ── ⛓⛓⛓ `refusalAt` — WHY ONE NAMED CELL IS REFUSED (slice 6) ─────────
 *
 * ⛔ EVERY CLASS IS DRIVEN AGAINST THE REAL MODEL AND THE REAL PALETTE, with
 * its subject MEASURED rather than picked: a class asserted against a
 * hand-built template would be a claim about the test's own literal.
 *
 * ⛔ AND THE DERIVATION IS THE CLAIM. `legalAt` is `refusalAt(…) === null`, so
 * the pair cannot drift — which is asserted over the WHOLE interior below,
 * because two spellings of one legality rule agree right up until the day they
 * do not, and that day the loop would place a template the page called illegal.
 */
describe('⛓⛓⛓ `refusalAt` — the model says WHY, and `legalAt` is derived from it', () => {
    const instance = (biome, name, overrides) => (biome === 'post-sword'
        ? POST_SWORD_PALETTE : PRE_SWORD_PALETTE).templates
        .find((t) => t.name === name).instantiate(null, overrides);

    /**
     * ⛓⛓⛓ **THE DOOR SUBJECT IS A BARE WALL-AND-GAP NOW** (arc 3, slice 4c).
     *
     * Every row in this block used to take its door from the ROSTER
     * (`wall-gap-block(ori=v,gap=1)` and `wall-gap-spinner-killlock(ori=h,
     * span=8)`), and all three door templates retired into the elements. ⛔ The
     * rows are about `refusalAt`'s VOCABULARY — the free/painted/occupied walk,
     * the interior walk, the DOOR law — which is the model's and not any
     * template's, so the subject is rebuilt from `doorGeometry`: the SAME
     * function the retired rows called and the SAME shape
     * `census-seedling-doors.mjs` measures the `span` domain with.
     *
     * ⚠ NOT A HAND-DRAWN LITERAL, and that is the whole reason `doorGeometry`
     * stayed exported: a fixture that built its own wall would drive the door
     * law on a door nothing in the pipeline can produce.
     */
    const bareDoor = (ori, span, gap) => defineTemplate({
        name: 'bare-door',
        family: 'door-fixture',
        site: 'straight',
        params: [],
        why: 'the census\'s own door shape, as a fixture — arc 3 slice 4c',
        build: () => {
            const g = doorGeometry(ori, span, gap);
            return {
                door: ori,
                doorCells: [g.doorCell],
                /** ⛓ EMPTY is the right answer for a door whose clearer stands
                 *  IN the door cell — `assertDoorCells` says so in as many
                 *  words, and it has to be SAID rather than omitted. */
                clearer: [],
                footprint: g.cells,
                terrain: g.wall,
                entities: [],
                pins: [],
            };
        },
    }).instantiate(null, {});

    it('⛔ answers `null` for a LEGAL anchor and a SENTENCE for an illegal one', () => {
        const m = seedlingModel({ seed: 6 });
        const sk = m.skeleton();
        const door = bareDoor('v', 8, 1);
        /**
         * ⛓⛓ RE-MEASURED AT ARC 3 SLICE 2 (the CUT law), AND AGAIN AT SLICE 4c
         * (the GOAL DRAW). Seed 6's goal moved from (3,1) to **(5,1)** — the
         * `manhattan >= 3` rule — so the legal columns moved with it. Re-scanned
         * over all eight interior columns with this exact door: **(2,1), (3,1)
         * and (4,1) are legal** and (6,1) is the first NOT-A-CUT (the goal is on
         * the START's side of a wall that far along).
         * ⛔ REPLACED, NEVER RELAXED: the assertion is still `toBeNull()`.
         */
        expect(m.refusalAt(sk, door, 2, 1)).toBeNull();
        expect(typeof m.refusalAt(sk, door, 1, 1)).toBe('string');
        // ⛓ a column with the goal on the START's side is a sentence, not a door.
        expect(m.refusalAt(sk, door, 6, 1)).toMatch(/it is NOT A CUT/);
    });

    it('⛔⛔ `legalAt` AGREES WITH IT ON EVERY INTERIOR CELL — one adjudication', () => {
        for (const t of [
            bareDoor('v', 8, 1),
            instance('pre-sword', 'water-pool', { w: 3, h: 3 }),
            bareDoor('h', 8, 4),
        ]) {
            const m = seedlingModel({ seed: 6 });
            const record = m.skeleton();
            let disagreed = 0;
            for (const c of m.interiorCells(record)) {
                const legal = m.legalAt(record, t, c.tx, c.ty);
                if (legal !== (m.refusalAt(record, t, c.tx, c.ty) === null)) disagreed += 1;
            }
            expect(disagreed).toBe(0);
        }
    });

    /**
     * ⚠ EACH SUBJECT IS MEASURED AND QUOTED, because a refusal class asserted
     * on a cell that also fails an EARLIER rule would be a test about the
     * ordering rather than about the class. The four `freeRefusal` claims are
     * asked in order, then the lane, then the door.
     */
    describe('the classes, each driven and each named by its own rule', () => {
        it('the START cell, and it says the terrain check is NOT what refused it', () => {
            const m = seedlingModel({ seed: 6 });
            const why = m.refusalAt(m.skeleton(), bareDoor('v', 8, 1), 1, 1);
            expect(why).toMatch(/\(1,1\) is the START cell/);
            expect(why).toMatch(/about GEOMETRY rather than about the template/);
        });

        /**
         * ⛓⛓ RE-PICKED AT SLICE 4c BECAUSE THE GOAL DRAW MOVED IT (trap 285 —
         * the cell is NAMED and asserted before it is used). Seed 6's goal was
         * (3,1) and is **(5,1)**: (3,1) is at Manhattan 2 from the start and the
         * `GOAL_MIN_FROM_START = 3` rule excludes it. ⛔ The row is unchanged in
         * what it claims; only the cell follows the measurement.
         */
        it('the GOAL cell — seed 6 puts it at (5,1)', () => {
            const m = seedlingModel({ seed: 6 });
            expect(m.goalCell).toEqual({ tx: 5, ty: 1 });
            expect(m.refusalAt(m.skeleton(), bareDoor('v', 8, 1), 5, 1))
                .toMatch(/\(5,1\) is the GOAL cell/);
        });

        it('a footprint cell OUTSIDE the interior names the cell, not the anchor', () => {
            const m = seedlingModel({ seed: 6 });
            // the anchor (5,5) is itself free; the vertical door's 8th cell is
            // (5,12), which is not a cell of this room at all.
            expect(m.isFree(m.skeleton(), 5, 5)).toBe(true);
            const why = m.refusalAt(m.skeleton(), bareDoor('v', 8, 1), 5, 5);
            expect(why).toMatch(/anchored at \(5,5\) needs FOOTPRINT cell \(5,9\)/);
            expect(why).toMatch(/not in the room's INTERIOR/);
            expect(why).toMatch(/\(1,1\) to \(8,8\)/);
        });

        it('a cell an EARLIER template painted says so, with the terrain it holds', () => {
            const st = generateSeedlingLevel({
                seed: 6, palette: PRE_SWORD_PALETTE, bounds: { obstacleTarget: 2 },
            });
            const m = seedlingModel({ seed: 6 });
            const wall = instance('pre-sword', 'wall-segment', { ori: 'h', len: 2 });
            const hits = m.interiorCells(st.record)
                .map((c) => m.refusalAt(st.record, wall, c.tx, c.ty))
                .filter((w) => w && /already holds/.test(w));
            expect(hits.length).toBeGreaterThan(0);
            // ⛓ RE-MEASURED at arc 3 slice 2 (the door law) and again at slice 4c
        // (the goal draw + the retirement): the first painted cell this walk
        // meets now holds WALL. ⛔ The claim is unchanged — "it names the
        // terrain it holds" — and the quoted terrain follows the measurement
        // rather than the other way. ⚠ It has been "wall" and "water" at
        // different commits, which is the point of quoting a MEASURED value.
        expect(hits[0]).toMatch(/already holds "wall" and not untouched `ground`/);
            expect(hits[0]).toMatch(/an earlier template painted it/);
        });

        /**
         * ⛓ A ROW STOOD HERE — the LANE rule, seed 1, an arrow at (5,1) firing
         * down the goal's column. ⛔ DELETED with `laneClear` and `arrow-lane`
         * (⚖ design ruling 9). The refusal vocabulary this block grades is now
         * three sentences, not four: the free/painted/occupied walk, the SEAL
         * pre-check, and the DOOR rule below.
         */
        /**
         * ⛓ MEASURED SUBJECT: seed 6's goal is at (5,1) (slice 4c's draw), so a
         * HORIZONTAL full-span wall at row 4 has the goal on the START's side of
         * it and every such anchor is refused by the door rule — (1,4) is one,
         * and its footprint cells are all free (asserted). ⛓ RE-SCANNED at 4c:
         * NO horizontal span-8 anchor is legal at this seed at all (7 of 7 are
         * NOT-A-CUT), which is the same fact the row has always driven.
         */
        it('the DOOR LAW — walling the gap leaves the goal reachable, so it is NOT A CUT', () => {
            const m = seedlingModel({ seed: 6 });
            const kill = bareDoor('h', 8, 4);
            const sk = m.skeleton();
            for (const c of kill.footprint) expect(m.isFree(sk, 1 + c.dx, 4 + c.dy)).toBe(true);
            const why = m.refusalAt(sk, kill, 1, 4);
            /**
             * ⛓⛓⛓ ARC 3 SLICE 2 — THE SAME SUBJECT, THE NEW SENTENCE. This
             * anchor was refused by `doorClear`'s compass ("the goal (3,1) is on
             * the START's side of that wall") and is refused by the FLOOD now,
             * which is the equivalence ⚖ ruling 3 asked to be measured rather
             * than assumed. ⛔ The refusal NAMES THE DOOR CELL, which the old
             * sentence could not: the reader who moved the anchor needs to know
             * WHICH cell the law walled to reach its answer.
             */
            expect(why).toMatch(/declares a door, and it is NOT A CUT/);
            expect(why).toMatch(/with its door cell\(s\) \(5,4\) walled/);
            expect(why).toMatch(/the GOAL \(5,1\) is STILL reachable from the START \(1,1\)/);
            expect(why).toMatch(/DECORATION rather than a door/);
            // ⛓ the KILL GATE's own consequence survives BOTH rewrites — slice
            // 2's flood and slice 4c's retirement. The sentence names the
            // ELEMENT now (`a KILL GATE`) because the family it used to name
            // left the palette, and a constant label that outlives its cause is
            // a reader pointed at nothing (trap 354).
            expect(why).toMatch(/for a KILL GATE that is a RUN ABORT/);
        });

        /**
         * ⛔⛔ THE ORDER IS PART OF THE ANSWER, AND THIS IS THE CASE THAT SHOWS
         * WHY. `doorClear` REFUSES BY THROWING for an anchor north-west of the
         * start; the footprint walk runs first and rejects every cell outside
         * the interior, so a click on the border ring meets a SENTENCE and not
         * an assertion. Reordering the two rules turns this into a page crash.
         */
        it('⛔ a cell on the BORDER RING is a sentence, and the FOOTPRINT walk is why', () => {
            const m = seedlingModel({ seed: 6 });
            const kill = bareDoor('h', 8, 4);
            expect(m.refusalAt(m.skeleton(), kill, 0, 0))
                .toMatch(/\(0,0\) is not in the room's INTERIOR/);
            /**
             * ⛓⛓ ARC 3 SLICE 2 — **THIS ROW'S OLD SECOND HALF IS GONE AND IS
             * REPLACED RATHER THAN DELETED** (trap 312). It used to assert that
             * `doorClear` THREW off-domain, which was the reason the footprint
             * walk had to run first. `doorClear` is retired: the door law reads
             * the flood and has no compass domain to be outside of, so there is
             * no throw left to order the rules against.
             *
             * ⛔ THE ORDERING CLAIM SURVIVES ON ITS REAL CAUSE, which is the one
             * that was always the stronger of the two: a FLOOD handed writes
             * outside the rectangle would read `terrainAt` past the room. So the
             * row asserts the surface is gone (a caller of `doorClear` must meet
             * a failure rather than a silently different answer) and
             * `procgenSeedlingPrecheck.test.js` drives the ordering itself.
             */
            expect(m.doorClear).toBeUndefined();
        });
    });
});

describe('the water template obliges the `sound` pin, by argument', () => {
    it('the oracle takes the pin union over the templates a candidate holds', () => {
        const m = model();
        const oracle = seedlingOracle({ model: m });
        expect(oracle.pinsFor([])).toEqual(['dead_frames']);
        expect(oracle.pinsFor([instanceOf('wall-segment', { ori: 'h', len: 3 })])).toEqual(['dead_frames']);
        expect(oracle.pinsFor([instanceOf('water-pool', { w: 2, h: 2 })]).sort())
            .toEqual(['dead_frames', 'sound']);
        expect(oracle.pinsFor([instanceOf('water-pool', { w: 2, h: 2 }), instanceOf('water-pool', { w: 2, h: 2 })]))
            .toHaveLength(2);
    });

    /**
     * ⛓ SLICE 2: OVER EVERY INSTANTIATION. Pins are static per template in v1
     * (⚖ kickoff §3.1) and this is what says so out loud — a pool obliges
     * `sound` at 1x1 and at 3x3 alike. The day a pin depends on a parameter,
     * this case is the one that goes red, which is the design's own
     * requirement that such a pin arrive with its own test.
     */
    it('only the water family declares it, at EVERY size — the pin is static in v1', () => {
        const rows = enumerateInstantiations(PRE_SWORD_PALETTE);
        expect(rows.filter((t) => t.family === 'water')).toHaveLength(9);
        for (const t of rows) {
            expect(t.pins, t.instance).toEqual(t.family === 'water' ? ['sound'] : []);
        }
    });

    /**
     * ⛓⛓⛓ GENERATE-mode UI slice 3, TRACK A — **THE LOOP'S OWN SOLVES TAKE THE
     * UNION OVER KEPT + CANDIDATE**, and this is the Seedling half of the claim
     * (`levelGenerator.test.js` asserts the loop's side without Seedling).
     *
     * ⛔ WHAT WAS MEASURED AT SLICE 2 (§9.5(a)) — this exact subject, before the
     * fix:
     *
     *     solve 2: 2 template(s) -> ["dead_frames","sound"]   the water CANDIDATE
     *     solve 3: 3 template(s) -> ["dead_frames"]           the pool is KEPT; the pin is GONE
     *     solve 4: 4 template(s) -> ["dead_frames"]
     *
     * while `summary.pins` — the level's CERTIFICATION — read
     * `["dead_frames","sound"]`. Two cost models, inside the seam.
     *
     * ⚠ THE INSTRUMENT HAS TO BE A WRAPPED ORACLE, because
     * `generateSeedlingLevel` builds its own and the pin set is not in the
     * trace. ⛔ So the case wires the three injections itself — and then
     * asserts the wiring is the SAME one by comparing the record and the trace
     * to `generateSeedlingLevel`'s BYTE FOR BYTE. A hand-wired instrument that
     * had drifted would be measuring a run nobody else does, and that
     * comparison is what makes this a measurement of the shipped path.
     *
     * ⚠ AND THE SUBJECT'S OWN PROPERTY IS ASSERTED BEFORE THE CLAIM: a seed
     * whose water pool is kept LAST would have no later solve to be wrong
     * about, and the case would pass over a loop that still dropped the union.
     */
    it('⛓ seed 21: every solve AFTER the pool is kept still carries `sound`', () => {
        /**
         * ⛓ RE-PICKED TWICE, BY THE SAME SCAN BOTH TIMES (trap 285 — the target
         * and the count are named). Arc 3 slice 1: `arrow-lane` leaving moved
         * seed 9's kept list, and seed 24 was taken. ⛓⛓ ARC 3 SLICE 4c: the
         * retirement and the goal draw moved every level again and seed 24's
         * pool is now kept LAST — which the subject-property guard below caught,
         * exactly as it is there to (*"and it must be kept before the LAST
         * one"*).
         *
         * RE-SCANNED through the SHIPPED default generator: pre-sword,
         * `obstacleTarget: 4`, seeds 1..30, for a seed that KEEPS a water pool
         * BEFORE its last row **and** keeps its FIRST candidate at every step
         * (so solve k really is kept row k-1) — **TEN qualify** (4, 9, 13, 14,
         * 15, 19, 21, 23, 25, 27). **Seed 21 is taken because its pool is kept
         * at index 1**: one pin-FREE solve before it and three pinned solves
         * after, so the case has both arms rather than one — the same rule that
         * chose seed 24.
         */
        /**
         * ⛓⛓⛓ RE-WIRED AT SLICE 4c, AND THE ROW'S OWN BYTE-COMPARISON IS WHAT
         * CAUGHT IT. The instrument built its model with `seedlingModel({seed})`
         * — a BARE room — which was the same model `generateSeedlingLevel` used
         * while `--elements=` defaulted to `none`. The biome default puts an
         * ELEMENT in the skeleton and DROPS it when its certification refuses,
         * so the shipped model is `seedlingSeam(…).model` and nothing else.
         * ⛔ The instrument now takes both the model AND the oracle from the
         * seam, which is exactly what `generateSeedlingLevel` does, and the
         * record/trace comparison below is what says so.
         */
        const seed = 21;
        const bounds = { obstacleTarget: 4 };
        const seam = seedlingSeam({ seed, items: PRE_SWORD_PALETTE.items ?? null });
        const m = seam.model;
        const base = seam.oracle;
        const perSolve = [];
        const spy = {
            ...base,
            solve(record, ctx) {
                perSolve.push(this.pinsFor(ctx?.templates ?? []).sort());
                return base.solve.call(this, record, ctx);
            },
        };
        const out = generateLevel({
            rng: rngFor(seed), model: m, oracle: spy, palette: PRE_SWORD_PALETTE, bounds,
        });
        const shipped = generateSeedlingLevel({ seed, palette: PRE_SWORD_PALETTE, bounds });
        // the instrument is the shipped path, not an agreeing copy of it
        expect(JSON.stringify(out.record)).toBe(JSON.stringify(shipped.record));
        expect(JSON.stringify(out.trace)).toBe(JSON.stringify(shipped.trace));

        // the subject's own property, first
        const waterAt = out.summary.kept.findIndex((k) => k.family === 'water');
        expect(waterAt, 'the subject must KEEP a water pool for this case to mean anything')
            .toBeGreaterThanOrEqual(0);
        expect(waterAt, 'and it must be kept before the LAST one, or no later solve exists')
            .toBeLessThan(out.summary.kept.length - 1);

        /**
         * Solve 0 is the skeleton and solve k is the candidate for kept row
         * k-1 (every step here keeps its first candidate). Every solve from the
         * pool's own onward must carry `sound`.
         */
        for (let i = waterAt + 1; i < perSolve.length; i += 1) {
            expect(perSolve[i], `solve ${i} lost the pool's pin`)
                .toEqual(['dead_frames', 'sound']);
        }
        // ⛓ AND THE INVARIANT THE FIX BUYS: the LAST accepting solve's union is
        // the level's own certification. Before track A these disagreed by
        // construction; `summary.pins` is computed by a different route
        // (`instantiateKept` over the kept RECORDS), so this compares the
        // retained rows against the one reconstruction.
        expect(perSolve[perSolve.length - 1]).toEqual([...shipped.summary.pins].sort());
    });
});

describe('the exclusions are a list with measurements in it', () => {
    it('names the three clearer families the kickoff asked for, each with a cause', () => {
        const names = EXCLUDED_TEMPLATES.map((x) => x.name);
        // ⛓ SLICE 3: `pushable-block` is GONE from this list because it was
        // PROMOTED — the row's cause was a solver defect and the defect is
        // fixed. An exclusion whose cause has been repaired is a stale claim,
        // and leaving it here would have the palette arguing against itself.
        expect(names).not.toContain('pushable-block');
        expect(names).toContain('button-lock-pair');
        expect(names).toContain('arrow-ceiling-killlock');
        /**
         * ⛓⛓⛓ SLICE 4c — THE THREE DOOR TEMPLATES JOINED THE LIST (⚖ user,
         * 2026-08-16/17), and their cause is a THIRD kind: not a mechanism the
         * oracle could not adjudicate (`button-lock-pair`), not a RULING against
         * the mechanism itself (`arrow-lane`), but SUPERSESSION — the room-aware
         * ELEMENTS do what a pass-2 template could not, and each row carries the
         * measurement that retired it.
         *
         * ⛔ THE KILL ROW IS ON THE **POST-SWORD** LIST, because that is where
         * the template lived (`KILL_LOCK_TEMPLATES`, now empty). An exclusion is
         * a claim about a palette, and putting it on the pre-sword list would
         * say the pre-sword biome had considered and rejected a family it never
         * held.
         */
        expect(names).toContain('wall-gap-block');
        expect(names).toContain('wall-gap-lock-weigh');
        expect(names).not.toContain('wall-gap-spinner-killlock');
        expect(POST_SWORD_EXCLUDED_TEMPLATES.map((x) => x.name))
            .toContain('wall-gap-spinner-killlock');
        for (const x of [...EXCLUDED_TEMPLATES, ...POST_SWORD_EXCLUDED_TEMPLATES]
            .filter((r) => /^wall-gap-/.test(r.name))) {
            expect(x.cause).toMatch(/SUPERSEDED \(user, 2026-08-16\)/);
            // ⛔ each names the ELEMENT that superseded it — a row that said
            // only "superseded" would send a reader nowhere.
            expect(x.wouldNeed + x.cause + x.measured)
                .toMatch(/blockpocket|guard|killgate|blockPocket/);
        }
        for (const x of EXCLUDED_TEMPLATES) {
            expect(typeof x.cause).toBe('string');
            expect(x.cause.length).toBeGreaterThan(0);
            expect(typeof x.measured).toBe('string');
            expect(typeof x.wouldNeed).toBe('string');
        }
    });

    it('the MEASURED ones carry the refusal text verbatim, and it is THIS slice\'s', () => {
        const measured = EXCLUDED_TEMPLATES.filter((x) => x.refusalText !== null);
        // ⛓ ARC 3 SLICE 1: THREE now — `arrow-lane` joined them, and it is the
        // first row here excluded by a RULING rather than by a mechanism the
        // oracle could not adjudicate. Its text was captured at `58fa04225`
        // BEFORE the row was removed, because afterwards there is no way to
        // produce another; the row itself publishes the command that made it.
        expect(measured).toHaveLength(3);
        expect(measured.find((x) => x.name === 'arrow-lane').refusalText)
            .toMatch(/the combat ladder is EXHAUSTED/);
        // ⛔ The other two texts are re-measured on the CORRIDOR after the collect-path
        // fix. Slice 2's texts were about a path that no longer exists, and a
        // refusal text is this arc's evidence channel (kickoff §3.1) — a stale
        // one is a claim about a run nobody can reproduce.
        expect(measured.find((x) => x.name === 'button-lock-pair').refusalText)
            .toMatch(/grazing 396 solid\(s\): lock at \(64,80\)/);
        expect(measured.find((x) => x.name === 'arrow-ceiling-killlock').refusalText)
            .toMatch(/held button@32,48 for the whole bound of 227 tick\(s\)/);
        // ⚠ NOT ONE of them still carries the derivation message the fix
        // deleted — the regression that says the list was actually re-measured.
        for (const x of measured) {
            expect(x.refusalText).not.toMatch(/no REACHABLE stance/);
        }
    });

    it('NOTHING excluded is also in the palette — in EITHER biome', () => {
        const paletteFamilies = new Set(POST_SWORD_TEMPLATES.map((t) => t.family));
        for (const x of EXCLUDED_TEMPLATES) {
            expect(PRE_SWORD_TEMPLATES.some((t) => t.name === x.name)).toBe(false);
        }
        // ⛓ SLICE 4c: the post-sword list is asked too, because that is where
        // the kill row went and the pre-sword walk above cannot see it.
        for (const x of POST_SWORD_EXCLUDED_TEMPLATES) {
            expect(POST_SWORD_TEMPLATES.some((t) => t.name === x.name)).toBe(false);
        }
        // ⛓ `shove` WAS promoted by slice 3 and RETIRED by slice 4c, and it is
        // named here rather than dropped: the list of out-families is the
        // palette's own account of what it decided against, and `shove` is now
        // on it for a different reason from the other four (superseded by an
        // ELEMENT, not un-adjudicable).
        for (const family of ['hold', 'kill', 'break', 'chaser', 'shove', 'weigh']) {
            expect(paletteFamilies.has(family)).toBe(false);
        }
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ VERB 1 — RESTRICT, AND THE CATALOGUE (GENERATE-mode UI slice 4)
 * ══════════════════════════════════════════════════════════════════════ */

describe('restrictPalette — the sub-roster a run may draw from', () => {
    it('narrows by FAMILY and keeps ROSTER ORDER and the SAME frozen objects', () => {
        // ⛓ SLICE 4c: the pair used to be `weigh` + `water`; `weigh` retired
        // into the `guard` ELEMENT, so the second family is `pit`. ⛔ The pair
        // is still given OUT OF ROSTER ORDER on purpose — the claim is that the
        // result keeps the ROSTER's order and not the caller's.
        const r = restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'families', names: ['pit', 'water'],
        });
        // ⛔ FROM THE ROSTER, never a literal (trap 199): the expected list is
        // the palette's own order filtered, so a template added to the `water`
        // family arrives here without an edit.
        const expected = PRE_SWORD_TEMPLATES.filter(
            (t) => ['water', 'pit'].includes(t.family));
        expect(r.templates.map((t) => t.name)).toEqual(expected.map((t) => t.name));
        // ⛓ IDENTITY, not equality. `rng.pick` indexes this list and
        // `instantiateKept` looks a base up in it, so a COPY of a template
        // would be a second object that could drift; a subset of the same
        // frozen objects cannot.
        for (const [i, t] of r.templates.entries()) expect(t).toBe(expected[i]);
        expect(r.items).toBe(PRE_SWORD_PALETTE.items);
    });

    it('narrows by TEMPLATE, and the two axes can name the SAME sub-roster', () => {
        const byFamily = restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'families', names: ['water', 'pit'],
        });
        const byName_ = restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'templates', names: ['water-pool', 'pit-patch'],
        });
        expect(byName_.templates).toEqual(byFamily.templates);
        // ⚠ …and they are still DIFFERENT restrictions, because the NAME says
        // which question was asked. A run's palette name rides in
        // `summary.palette`, the payload and the readout.
        expect(byFamily.name).toBe('pre-sword[families:pit,water]');
        expect(byName_.name).toBe('pre-sword[templates:pit-patch,water-pool]');
    });

    it('⛔ SPELLS ITS AXIS — and the collision that FORCED that is now GONE', () => {
        /**
         * ⛓ RE-MEASURED (arc 3 slice 1), and the honest answer changed shape.
         * The rule was bought by a MEASUREMENT: `arrow-lane` was BOTH a family
         * and a template, so kickoff §3.4's `pre-sword[arrow-lane]` named two
         * different sub-rosters. ⚖ Design ruling 9 removed that row, so TODAY
         * no shipped name equals a shipped family — asserted here rather than
         * assumed, because it is the fact that changed.
         *
         * ⛔ THE RULE STAYS ANYWAY, and this is the sentence that still has
         * content (trap 312): a roster is a thing slices ADD to, and a spelling
         * that is unambiguous only until the next row lands is a spelling
         * nobody can rely on. So the axis still rides in the name, and the
         * refusal for a bare name is still the refusal.
         */
        const families = new Set(PRE_SWORD_TEMPLATES.map((t) => t.family));
        const names = new Set(PRE_SWORD_TEMPLATES.map((t) => t.name));
        expect([...names].filter((n) => families.has(n))).toEqual([]);
        // …and both axes still spell themselves, on a name that exists in one.
        expect(restrictPalette(PRE_SWORD_PALETTE, { axis: 'families', names: ['wall'] })
            .name).toBe('pre-sword[families:wall]');
        expect(restrictPalette(PRE_SWORD_PALETTE, { axis: 'templates', names: ['wall-segment'] })
            .name).toBe('pre-sword[templates:wall-segment]');
        // ⛔ and an axis-less restriction is still REFUSED BY NAME.
        expect(() => restrictPalette(PRE_SWORD_PALETTE, { names: ['wall'] }))
            .toThrow(/axis must be "families" or "templates"/);
    });

    it('SORTS and DEDUPES, so one sub-roster has exactly one name', () => {
        const a = restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'families', names: ['pit', 'water', 'pit'],
        });
        const b = restrictPalette(PRE_SWORD_PALETTE, { axis: 'families', names: ['water', 'pit'] });
        expect(a.name).toBe(b.name);
        expect(a.roster.names).toEqual(['pit', 'water']);
    });

    it('null means THE WHOLE ROSTER and hands back the palette itself', () => {
        expect(restrictPalette(PRE_SWORD_PALETTE, null)).toBe(PRE_SWORD_PALETTE);
        expect(restrictPalette(PRE_SWORD_PALETTE, undefined)).toBe(PRE_SWORD_PALETTE);
    });

    it('⛔ REFUSES an unknown member BY NAME and lists the roster', () => {
        expect(() => restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'families', names: ['water', 'kill'],
        })).toThrow(/names "kill".*does not offer.*wall, water, pit/s);
        // ⚠ THE POINT OF THE REFUSAL: a dropped member would WIDEN the roster.
        // `kill` is a real post-sword family, so this is the typo that costs.
        // ⛓ CONSTRUCTIVE-MODE slice 3: the roster machinery moved to
        // `procgenCore/paletteRoster.js` (the maze lab page has the same
        // `?families=` spelling and may not import `seedlingDemo/`), so its
        // refusals carry ITS class — the same shape `templateContract` took in
        // slice 2. ⛔ The row is REPOINTED, not relaxed: it still asserts a
        // typed refusal, and the message is asserted unchanged beside it.
        /**
         * ⛓⛓ RE-PICKED AT SLICE 4c, AND THE SUBJECT HAD TO CHANGE SHAPE. The
         * unknown name used to be `wall-gap-spinner-killlock` — a row the
         * pre-sword palette did not hold and the post-sword one did, so ONE
         * name drove both halves. The retirement emptied
         * `KILL_LOCK_TEMPLATES`, so **no name is in one roster and not the
         * other any more** (the biome is the BOOT now).
         *
         * ⛔ SO THE TWO HALVES ARE SEPARATED RATHER THAN THE ROW WEAKENED: the
         * refusal is driven with a name NEITHER palette holds (a RETIRED one,
         * which is the realistic typo — somebody's old link), and the
         * "accepted where it IS held" half is driven with a name both hold.
         * ⚠ The `templates` axis no longer distinguishes the two biomes at all,
         * and that is asserted just above (`BOTH biomes ship the SAME roster`)
         * rather than left as a silence here.
         */
        expect(() => restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'templates', names: ['wall-gap-spinner-killlock'],
        })).toThrow(PaletteRosterError);
        expect(() => restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'templates', names: ['wall-gap-spinner-killlock'],
        })).toThrow(/names "wall-gap-spinner-killlock", which palette "pre-sword" does not offer/);
        expect(() => restrictPalette(POST_SWORD_PALETTE, {
            axis: 'templates', names: ['wall-gap-spinner-killlock'],
        })).toThrow(/which palette "post-sword" does not offer/);
        expect(restrictPalette(POST_SWORD_PALETTE, {
            axis: 'templates', names: ['pit-patch'],
        }).templates).toHaveLength(1);
    });

    it('⛔ REFUSES an EMPTY restriction, which is not the same as absent', () => {
        expect(() => restrictPalette(PRE_SWORD_PALETTE, { axis: 'families', names: [] }))
            .toThrow(/EMPTY restriction on "families" names nothing/);
    });

    it('⛔ REFUSES an axis it does not know', () => {
        expect(() => restrictPalette(PRE_SWORD_PALETTE, { axis: 'family', names: ['water'] }))
            .toThrow(/axis must be "families" or "templates"/);
    });

    it('carries the EXCLUSIONS whole — a restriction is not an exclusion', () => {
        const r = restrictPalette(PRE_SWORD_PALETTE, { axis: 'families', names: ['water'] });
        expect(r.excluded).toBe(PRE_SWORD_PALETTE.excluded);
        expect(r.excluded.length).toBe(EXCLUDED_TEMPLATES.length);
    });

    it('the restricted palette still passes `assertPalette` — every instantiation', () => {
        const r = restrictPalette(POST_SWORD_PALETTE, { axis: 'families', names: ['pit', 'water'] });
        expect(() => assertPalette(r)).not.toThrow();
        /**
         * ⛓⛓ THE SENTINEL HALF OF THIS ROW RETIRED WITH THE KILL FAMILY (slice
         * 4c). It asserted that a restricted subset keeps the tag slot, on the
         * ground that the templates are the SAME frozen objects — and that
         * ground is what is asserted instead, of every row in the subset. ⛔ A
         * sentinel assertion re-pointed at `SLOT_DOOR` would be testing this
         * file's fixture against `restrictPalette`, which never sees it.
         */
        for (const t of r.templates) expect(POST_SWORD_TEMPLATES).toContain(t);
        expect(r.templates.map((t) => t.name)).toEqual(['water-pool', 'pit-patch']);
    });
});

describe('catalogueRows — ⚖ ruling 1\'s "a list of things that can be generated"', () => {
    it('groups the WHOLE roster by family, built FROM the roster (trap 199)', () => {
        const cat = catalogueRows(PRE_SWORD_PALETTE);
        expect(cat.counts.templates).toBe(PRE_SWORD_TEMPLATES.length);
        expect(cat.counts.excluded).toBe(EXCLUDED_TEMPLATES.length);
        const listed = cat.groups.flatMap((g) => g.templates.map((t) => t.name));
        expect(listed).toEqual(PRE_SWORD_TEMPLATES.map((t) => t.name));
        // every family in the roster has a group, and no group is invented
        for (const t of PRE_SWORD_TEMPLATES) {
            expect(cat.groups.some((g) => g.family === t.family)).toBe(true);
        }
    });

    it('carries each template\'s DECLARED param schema and its `why`', () => {
        const cat = catalogueRows(PRE_SWORD_PALETTE);
        for (const t of PRE_SWORD_TEMPLATES) {
            const row = cat.groups.flatMap((g) => g.templates).find((r) => r.name === t.name);
            expect(row.params).toBe(t.params);
            expect(row.why).toBe(t.why);
            for (const p of row.params) {
                expect(p.domain.length).toBeGreaterThan(0);
                expect(p.domain).toContain(p.default);
                expect(typeof p.why).toBe('string');
            }
        }
    });

    it('⛔ THE EXCLUDED ROWS ARE IN IT, with cause + measured + wouldNeed VERBATIM', () => {
        for (const palette of [PRE_SWORD_PALETTE, POST_SWORD_PALETTE]) {
            const cat = catalogueRows(palette);
            const listed = cat.groups.flatMap((g) => g.excluded);
            /**
             * ⚠ EVERY ROW, EXACTLY ONCE — as a SET, because grouping by family
             * legitimately reorders the list: pre-sword excludes TWO `kill`
             * rows (`arrow-ceiling-killlock`, `sandtrap-room`) with two other
             * families between them, and they join one group. The order this
             * claim cares about is WITHIN a family, asserted below.
             */
            expect([...listed.map((e) => e.name)].sort())
                .toEqual([...palette.excluded.map((e) => e.name)].sort());
            expect(listed).toHaveLength(palette.excluded.length);
            for (const g of cat.groups) {
                expect(g.excluded.map((e) => e.name)).toEqual(
                    palette.excluded.filter((e) => e.family === g.family).map((e) => e.name));
            }
            for (const e of palette.excluded) {
                const row = listed.find((r) => r.name === e.name);
                // VERBATIM — the measurement IS the content of these rows, and
                // a catalogue that summarised it would show a lossy copy.
                expect(row.cause).toBe(e.cause);
                expect(row.measured).toBe(e.measured);
                expect(row.wouldNeed).toBe(e.wouldNeed);
                expect(row.refusalText).toBe(e.refusalText ?? null);
            }
        }
    });

    it('⛔ an excluded row is NOT selectable and a roster row IS', () => {
        const cat = catalogueRows(POST_SWORD_PALETTE);
        const rows = cat.groups.flatMap((g) => [...g.templates, ...g.excluded]);
        expect(rows.length).toBe(POST_SWORD_PALETTE.templates.length
            + POST_SWORD_PALETTE.excluded.length);
        for (const r of rows) {
            const isRoster = POST_SWORD_PALETTE.templates.some((t) => t.name === r.name);
            expect(r.selectable).toBe(isRoster);
        }
        // ⚠ …and the number of SELECTABLE rows is the number of checkboxes the
        // page mounts, which is the roster's own length and not a literal.
        expect(rows.filter((r) => r.selectable)).toHaveLength(
            POST_SWORD_PALETTE.templates.length);
    });

    it('a RESTRICTED palette still catalogues its exclusions, and names its roster', () => {
        const r = restrictPalette(PRE_SWORD_PALETTE, { axis: 'families', names: ['water'] });
        const cat = catalogueRows(r);
        expect(cat.palette).toBe('pre-sword[families:water]');
        expect(cat.roster).toEqual({ axis: 'families', names: ['water'] });
        expect(cat.counts.excluded).toBe(EXCLUDED_TEMPLATES.length);
        expect(cat.counts.templates).toBe(1);
    });
});

describe('⛓ a RESTRICTED run through the whole certification path', () => {
    /**
     * ⛓ THE SUBJECT IS MEASURED, NOT PICKED — and it was re-measured at slice
     * 4c, because `weigh` retired into the `guard` ELEMENT and half the old
     * restriction stopped existing.
     *
     * RE-SCANNED (trap 285 — the target and the count are named): `families:
     * water,pit` at target 2 through the SHIPPED default generator, seeds 1..12.
     * Eight of the twelve keep a water pool — the only pin-declaring family, so
     * `summary.pins` has something to be wrong about — and **seed 6 is the
     * cheapest that keeps ONE OF EACH family in the restriction (54 ms, 2
     * attempts, `water-pool` + `pit-patch`)**. Seed 8 is marginally cheaper (46
     * ms) and keeps two pools, which would leave half the restriction unexercised.
     *
     * ⛔ AND THE UNRESTRICTED RUN OF THE SAME SEED KEEPS A `wall-segment`,
     * which the restriction forbids. That is what makes this a DISCRIMINATOR
     * (trap 235): a restriction the loop ignored would show up as kept
     * templates that are not in the restriction at all. ⚠ Four of the twelve
     * seeds do NOT discriminate (3, 9, 10, 12 — the unrestricted run happens to
     * keep only allowed rows), which is a thinner margin than the old roster
     * gave and is why the seed is named rather than assumed.
     */
    const ROSTER = Object.freeze({ axis: 'families', names: ['water', 'pit'] });
    const restricted = () => restrictPalette(PRE_SWORD_PALETTE, ROSTER);
    const run = (palette) => generateSeedlingLevel({
        seed: 6, palette, bounds: { obstacleTarget: 2 },
    });

    it('draws ONLY from the restriction, and the unrestricted run proves it is a subset', () => {
        const r = run(restricted());
        const full = run(PRE_SWORD_PALETTE);
        const allowed = restricted().templates.map((t) => t.name);
        expect(r.summary.keptCount).toBe(2);
        for (const k of r.summary.kept) expect(allowed).toContain(k.template);
        // the control: the same seed, unrestricted, keeps templates the
        // restriction forbids — so "kept ⊆ restriction" is not vacuous here.
        expect(full.summary.kept.some((k) => !allowed.includes(k.template))).toBe(true);
        expect(r.record).not.toEqual(full.record);
    });

    it('the derived palette name rides in `summary.palette`', () => {
        expect(run(restricted()).summary.palette).toBe('pre-sword[families:pit,water]');
        expect(run(PRE_SWORD_PALETTE).summary.palette).toBe('pre-sword');
    });

    it('the PIN UNION and the reconstruction behave identically on the subset', () => {
        const r = run(restricted());
        // the water pool is kept, so `sound` is obliged — the pin machinery is
        // exercised rather than passed over.
        expect(r.summary.kept.some((k) => k.family === 'water')).toBe(true);
        expect(r.summary.pins).toContain('sound');
        // ⛔ ONE RECONSTRUCTION, and it works against the RESTRICTED palette
        // because the subset holds the same base objects.
        for (const k of r.summary.kept) {
            const row = instantiateKept(restricted(), k);
            expect(row.name).toBe(k.template);
            expect(row.params).toEqual(k.params);
        }
    });

    /**
     * ⛓⛓⛓ **A ROW STOOD HERE AND ITS SUBJECT RETIRED** — *"the SENTINEL SLOTS
     * are resolved per placement, restricted or not"* (arc 3, slice 4c). It
     * placed a WEIGH lock through a restricted run and read the resolved tag off
     * the built world; the weigh family became the `guard` ELEMENT, and no
     * shipped row carries a sentinel to resolve.
     *
     * ⛓ IT WAS ALREADY GUARDED AGAINST GOING VACUOUS — `expect(weigh)
     * .toBeTruthy()` caught exactly this at slice 2 — and that guard is what
     * says the row must go rather than be re-seeded: there is no seed at which
     * it is non-vacuous now. ⛔ The claim it made (*a sentinel never survives
     * into a level; each placement gets its own*) is driven on `SLOT_DOOR` in
     * the placement block above, at the layer where it is a fact about `place`.
     * What is NOT covered any more is the interaction of a RESTRICTION with the
     * slots, and that is a nothing: `restrictPalette` hands back the SAME frozen
     * template objects, which the row just above asserts directly.
     */
    it('is DETERMINISTIC under the restriction — same roster, same level', () => {
        expect(run(restricted()).record).toEqual(run(restricted()).record);
        // ⚠ and the two SPELLINGS of one sub-roster produce one level, because
        // the subset and its ORDER are what the rng indexes.
        const byName_ = restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'templates', names: ['pit-patch', 'water-pool'],
        });
        expect(run(byName_).record).toEqual(run(restricted()).record);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE DISCHARGE TEST — ONE SPELLING (GENERATE-mode UI slice 5)
 * ══════════════════════════════════════════════════════════════════════ */
describe('⛓ `verbOf` / `dischargesVerb` — ⚖ §12.1\'s evidence standard, once', () => {
    it('⛔ answers `null`, not `false`, for a family with NO verb to discharge', () => {
        /**
         * ⛔ THE DISTINCTION IS THE WHOLE POINT. `false` would let a readout
         * print "solved-only" — "we looked for the good outcome and did not get
         * it" — about a wall, for which there was never anything to look for.
         * `toBe(null)` and not `toBeFalsy()`: the latter passes on `false` and
         * would be a check that cannot see the defect it exists for.
         */
        for (const family of ['wall', 'water', 'pit']) {
            expect(verbOf(family)).toBeNull();
            expect(dischargesVerb(family, [{ strategy: 'shove' }])).toBeNull();
        }
    });

    /**
     * ⛓⛓⛓ **THE MAP OUTLIVED ITS TEMPLATES, ON PURPOSE** (arc 3, slice 4c). The
     * three families it names all retired into ELEMENTS, so `CLEARER_STRATEGY`
     * answers for nothing in either roster today. It STAYS because its readers
     * did not retire with them: `batch-seedling-acceptance.mjs` and
     * `sweep-seedling-anchor-search.mjs` key on it, the elements' own
     * certification records carry the SAME three verb words
     * (`{strategy:'shove'|'weigh'|'kill'}`), and arc 5's arena is the next row
     * that will want one. ⛔ A map deleted for having no caller this week is a
     * vocabulary somebody re-invents next week with different words.
     */
    it('names the verb of every CLEARER family — which no shipped TEMPLATE is today', () => {
        expect(verbOf('shove')).toBe('shove');
        expect(verbOf('weigh')).toBe('weigh');
        expect(verbOf('kill')).toBe('kill');
        // ⛔ …and NOT ONE of them is a family either roster still holds. Said
        // here, where a reader meets the map, rather than left to be discovered.
        const shipped = new Set(POST_SWORD_TEMPLATES.map((t) => t.family));
        for (const f of ['shove', 'weigh', 'kill']) expect(shipped.has(f)).toBe(false);
    });

    it('is true only when a `{strategy}` RECORD names that family\'s own verb', () => {
        expect(dischargesVerb('shove', [{ strategy: 'shove' }])).toBe(true);
        // ⛔ ANOTHER family's verb is NOT this family's discharge — the check
        // that would have passed on any clearer at all.
        expect(dischargesVerb('shove', [{ strategy: 'weigh' }])).toBe(false);
        expect(dischargesVerb('weigh', [])).toBe(false);
        expect(dischargesVerb('kill', null)).toBe(false);
        expect(dischargesVerb('kill', undefined)).toBe(false);
    });

    it('⛓ EVERY family in both rosters gets an answer, and it is built FROM the roster',
        () => {
            /**
             * ⛓ Trap 199: the families come from the palettes themselves, so a
             * family added to the table is answered here without an edit — and a
             * family that got NEITHER a verb nor a null (i.e. `undefined`) would
             * red, which is the case a `?? null` dropped from `verbOf` produces.
             */
            const families = [...new Set([...PRE_SWORD_PALETTE.templates,
                ...POST_SWORD_PALETTE.templates].map((t) => t.family))];
            expect(families.length).toBeGreaterThan(0);
            for (const f of families) {
                const v = verbOf(f);
                expect(v === null || typeof v === 'string').toBe(true);
            }
            /**
             * ⛓⛓ THE OLD SECOND HALF ASSERTED THE ROSTER HOLDS **BOTH** KINDS,
             * and slice 4c made that false: every shipped family is verb-less.
             * ⛔ REPLACED RATHER THAN DELETED (trap 312) — the sentence that
             * survives is the one that can still fail, and it is the STRONGER
             * half of the pair. `verbOf` must answer `null` and never
             * `undefined`, which is exactly the case a `?? null` dropped from
             * its body produces, and the whole roster now drives it.
             */
            for (const f of families) expect(verbOf(f)).toBeNull();
            // ⛓ …and the OTHER kind is asserted where it still exists — on the
            // map itself, in the row above.
        });
});
