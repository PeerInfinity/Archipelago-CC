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
    EXCLUDED_TEMPLATES, PLACEMENT_GROUP, PLACEMENT_TAG, POST_SWORD_PALETTE,
    POST_SWORD_TEMPLATES, PRE_SWORD_PALETTE, PRE_SWORD_TEMPLATES, ProcgenPaletteError,
    assertPalette, defineTemplate, enumerateInstantiations, enumerateValues, instantiateKept,
} from './procgenPalette.js';
import {
    SEEDLING_DEFAULTS, generateSeedlingLevel, placementGroupId, placementTagId,
    seedlingModel, seedlingOracle,
} from './procgenSeedling.js';
import { TAGS_PER_LEVEL } from './breakableRocks.js';
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
            // …and a zero-parameter template needs no rng at all.
            expect(byName('arrow-lane').instantiate(null).instance).toBe('arrow-lane');
        });

        /**
         * ⛓ THE ENUMERATION COUNTS `assertPalette`'s DOCBLOCK STATES, asserted
         * FROM the roster so the table cannot go stale silently (trap 199).
         */
        it('enumerates 42 pre-sword and 44 post-sword instantiations at module load', () => {
            expect(enumerateInstantiations(PRE_SWORD_PALETTE)).toHaveLength(42);
            expect(enumerateInstantiations(POST_SWORD_PALETTE)).toHaveLength(44);
            const perTemplate = Object.fromEntries(
                PRE_SWORD_TEMPLATES.map((t) => [t.name, enumerateValues(t).length]),
            );
            expect(perTemplate).toEqual({
                'wall-segment': 8,
                'water-pool': 9,
                'pit-patch': 6,
                'arrow-lane': 1,
                'wall-gap-block': 16,
                'wall-gap-lock-weigh': 2,
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
         * ⛓ SLICE 2 COLLAPSED THE WEIGH PAIR INTO ONE PARAMETERIZED ROW, so
         * the carriers are counted over INSTANTIATIONS rather than over table
         * rows — and every instantiation must carry the slot, not just the one
         * the default happens to build.
         */
        it('the shipped instantiations that carry the slot are exactly the weigh family', () => {
            const carriers = enumerateInstantiations(PRE_SWORD_PALETTE)
                .filter((t) => t.groups !== undefined);
            expect([...new Set(carriers.map((t) => t.name))]).toEqual(['wall-gap-lock-weigh']);
            expect(carriers.map((t) => t.instance)).toEqual([
                'wall-gap-lock-weigh(ori=h)', 'wall-gap-lock-weigh(ori=v)',
            ]);
            // ⚠ BY NAME rather than by count: a new switch/door template that
            // forgot the slot would keep the count where it is and arrive
            // silently.
            for (const t of carriers) {
                expect(t.groups).toBe(1);
                expect(t.entities.filter(
                    (e) => Object.values(e.attrs ?? {}).includes(PLACEMENT_GROUP),
                )).toHaveLength(2);
            }
            // ⛔ AND EVERY value of the family's own domain is a carrier — a
            // `build` that dropped the slot for ONE orientation would place a
            // lock in a private group and a button in group 0.
            expect(carriers).toHaveLength(enumerateValues(byName('wall-gap-lock-weigh')).length);
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

        it('the shipped instantiations that carry the tag slot are exactly the weigh family',
            () => {
                const carriers = enumerateInstantiations(PRE_SWORD_PALETTE)
                    .filter((t) => t.tags !== undefined);
                expect(carriers.map((t) => t.instance)).toEqual([
                    'wall-gap-lock-weigh(ori=h)', 'wall-gap-lock-weigh(ori=v)',
                ]);
                for (const t of carriers) expect(t.tags).toBe(1);
            });

        /**
         * ⚠ THE KILL-LOCK FAMILY IS **NOT** ON THE SLOT, AND THAT IS MEASURED
         * RATHER THAN OVERLOOKED. Its `tag: '1'` is READ (`Lock.check()`
         * despawns only when `tSet < 0`), so two placements sharing it would be
         * the same defect the weigh family's slot exists to end.
         *
         * ⛔⛔⛔ **AND THE REASON IT WAS LEFT LATENT HAS EXPIRED — MEASURED AT
         * SLICE 2, THE DAY THIS COMMENT PREDICTED.** It used to read: *"the
         * post-sword sweep (seeds 1..24, target 6) keeps a kill template in ONE
         * seed and never two, so the collision is LATENT… the day a second one
         * can be kept, someone has to come back here."* Re-scanned under the
         * parameterized roster (post-sword, seeds 1..40, target 6 — the pool is
         * 12/13/14/15/25): **seed 12 keeps TWO**, and both locks carry the same
         * literal tag 1, so one spinner's death now writes the persistence flag
         * both locks read.
         *
         * ⚖ NOT FIXED HERE, AND DELIBERATELY SO: the right value is not another
         * literal (`'0'` is the goal's), so it wants this same per-placement
         * slot on a field whose blast radius — the goal, the scratch layer,
         * `botDriverV1`'s v9 `at` declarations — was reported to the user with
         * evidence on 2026-08-13 and has still not been measured. What slice 2
         * owed was to notice that the LATENCY argument died, and this is that
         * notice. The assertions below are unchanged: they still pin the state
         * of affairs, and now the comment says the collision is REACHABLE.
         */
        it('⚠ the kill-lock family keeps its LITERAL tag 1 — now REACHABLE, and pinned', () => {
            const killLocks = enumerateInstantiations(POST_SWORD_PALETTE)
                .filter((t) => t.family === 'kill');
            expect(killLocks).toHaveLength(2);
            for (const t of killLocks) {
                expect(t.tags).toBeUndefined();
                const lock = t.entities.find((e) => e.type === 'lock');
                expect(lock.attrs.tag).toBe('1');
                // ⛔ and it still differs from the goal's, which is the law the
                // family discharged by construction.
                expect(lock.attrs.tag).not.toBe(SEEDLING_DEFAULTS.goalTag);
            }
        });
    });

    it('every family in the roster is represented, and the count comes FROM the roster', () => {
        const families = new Set(PRE_SWORD_TEMPLATES.map((t) => t.family));
        // ⛓ PoC slice 3b added `weigh` — the palette's SECOND clearer family
        // and the first whose template places three cooperating entities.
        expect([...families].sort())
            .toEqual(['arrow-lane', 'pit', 'shove', 'wall', 'water', 'weigh']);
        expect(PRE_SWORD_PALETTE.templates).toBe(PRE_SWORD_TEMPLATES);
        expect(PRE_SWORD_PALETTE.items).toEqual({ hasSword: false, hasShield: false });
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

    it('arrow-lane joins `arrowTraps` with shootDefault TRUE — it fires from tick 0', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'arrow-lane', { tx: 3, ty: 3 }));
        // ⛓ THE ZERO-PARAMETER CASE: no draw, no override, label == name.
        expect(instanceOf('arrow-lane').instance).toBe('arrow-lane');
        expect(instanceOf('arrow-lane').params).toEqual({});
        expect(world.arrowTraps).toHaveLength(1);
        const trap = world.arrowTraps[0];
        expect(trap.shootDefault).toBe(true);
        expect(trap.t).toBe(0);
        // ⛓ the ENTITY POINT is the ctor's own (+8,+2) — never retyped here
        expect({ x: trap.ex, y: trap.ey })
            .toEqual(arrowTrapEntityPoint(3 * TILE_SIZE, 3 * TILE_SIZE));
    });

    it('the arrow lane has NO presser in this palette, so nothing can turn it off', () => {
        const m = model();
        const world = worldFor(placedAt(m, 'arrow-lane', { tx: 3, ty: 3 }));
        expect(world.pressers).toEqual([]);
        expect(world.activators).toEqual([]);
    });

    /**
     * ⛓⛓ THE DOOR — slice 3's promotion, verified the same way as the other
     * five: what the template CLAIMS, asked of the built world.
     *
     * Two claims, and the second is the one that makes it a door rather than a
     * decoration: the wall's cells are Stone in `world.solids`, and the gap
     * holds a `pushableblock` in `world.pushables` — at the gap's own cell, so
     * the block really is standing in the one hole the wall leaves.
     */
    it('wall-gap-block(ori=h) walls the whole interior but one cell, and stands a block in it',
        () => {
        const m = model();
        const t = instanceOf('wall-gap-block', { ori: 'h', gap: 4 });
        const at = { tx: 1, ty: 4 };
        const world = worldFor(m.place(m.skeleton(), t, at));
        const gapDx = t.entities[0].dx;

        // ⚠ SCOPED TO THE TEMPLATE'S OWN CELLS. The room's BORDER RING is
        // Stone too and sits on every row, so an unscoped filter counts the
        // two border columns and reports 9 where the template wrote 7 — a
        // count about the room, not about the template.
        const cols = new Set(t.terrain.map((c) => (at.tx + c.dx) * TILE_SIZE));
        const row = world.solids.filter((s) => s.tag === 'tile:Stone'
            && s.rect.y === at.ty * TILE_SIZE && cols.has(s.rect.x));
        // The count comes FROM the template, never from a number typed here.
        expect(row).toHaveLength(t.terrain.length);
        // ⛔ and the gap is a HOLE in that row, not a cell the paint missed
        // elsewhere: no Stone stands at the gap column.
        expect(row.some((s) => s.rect.x === (at.tx + gapDx) * TILE_SIZE)).toBe(false);

        // ⚠ A `pushables` row carries the OEL POINT (`x`/`y`), not a `rect` —
        // unlike a `solids` row two assertions up, whose `x`/`y` are its
        // CENTRE. Two rosters, two conventions, and the id spells the point.
        expect(world.pushables).toHaveLength(1);
        const block = world.pushables[0];
        expect(block.tag).toBe('pushableblock');
        expect({ x: block.x, y: block.y })
            .toEqual({ x: (at.tx + gapDx) * TILE_SIZE, y: at.ty * TILE_SIZE });
        expect(block.id).toBe(`pushableblock@${block.x},${block.y}`);
    });

    /**
     * ⛓ THE SAME DOOR ON END, AT EVERY DECLARED GAP — because `gap` is what
     * decides WHICH cell is the hole, and a `build` that painted the wall from
     * one value and placed the block from another would still produce a wall
     * and a block. The two are compared to each other rather than to a
     * literal.
     */
    it('wall-gap-block(ori=v) is the same door on end, at every declared gap', () => {
        for (const { gap } of enumerateValues(byName('wall-gap-block'))
            .filter((v) => v.ori === 'v')) {
            const m = model();
            const t = instanceOf('wall-gap-block', { ori: 'v', gap });
            const at = { tx: 4, ty: 1 };
            const world = worldFor(m.place(m.skeleton(), t, at));
            const gapDy = t.entities[0].dy;
            expect(gapDy, `gap=${gap}`).toBe(gap);
            const rows = new Set(t.terrain.map((c) => (at.ty + c.dy) * TILE_SIZE));
            const column = world.solids.filter((s) => s.tag === 'tile:Stone'
                && s.rect.x === at.tx * TILE_SIZE && rows.has(s.rect.y));
            expect(column, `gap=${gap}`).toHaveLength(t.terrain.length);
            expect(column.some((s) => s.rect.y === (at.ty + gapDy) * TILE_SIZE)).toBe(false);
            // ⛔ and the block really stands IN the hole the wall left.
            expect(world.pushables).toHaveLength(1);
            expect(world.pushables[0].y).toBe((at.ty + gap) * TILE_SIZE);
        }
    });

    /**
     * ⛓⛓⛓ THE LOCKED DOOR — PoC slice 3b's promotion, verified the same way.
     *
     * Three claims, because it places three things and any two without the
     * third is a room with no answer (⚖ §1.2's atomic placement at its
     * fullest): the LOCK is in the wall's gap and in `world.activators`; the
     * BUTTON is in `world.pressers` and in the SAME tSet group; the BLOCK is
     * in `world.pushables` and shares the button's lane so a single lean
     * reaches it. The last one is the constraint `runShove` enforces — a lean
     * moves a block along ONE axis — and it is asserted here rather than
     * trusted, because a template whose block and button shared neither
     * coordinate would be L16's shape, which needs a chain nobody has ruled on.
     */
    for (const [ori, at, axis] of [
        ['h', { tx: 1, ty: 4 }, 'row'],
        ['v', { tx: 4, ty: 1 }, 'column'],
    ]) {
        it(`wall-gap-lock-weigh(ori=${ori}) stands a lock in the gap and a block that can `
            + 'reach its button', () => {
            const m = model();
            const t = instanceOf('wall-gap-lock-weigh', { ori });
            const world = worldFor(m.place(m.skeleton(), t, at));
            const entityAt = (type) => {
                const e = t.entities.find((x) => x.type === type);
                return { tx: at.tx + e.dx, ty: at.ty + e.dy };
            };

            // ── the LOCK, in the gap the wall leaves ──────────────────
            const lockCell = entityAt('lock');
            expect(world.activators).toHaveLength(1);
            const lock = world.activators[0];
            expect(lock.tag).toBe('lock');
            expect(lock.id).toBe(`lock@${lockCell.tx * TILE_SIZE},${lockCell.ty * TILE_SIZE}`);
            // ⛔ and it really is in a HOLE: the template paints no wall there.
            expect(t.terrain.some((c) => at.tx + c.dx === lockCell.tx
                && at.ty + c.dy === lockCell.ty)).toBe(false);

            // ── the BUTTON, publishing the lock's OWN group ───────────
            expect(world.pressers).toHaveLength(1);
            const button = world.pressers[0];
            expect(button.tag).toBe('button');
            // ⛔ THE GROUP IS COMPARED, NOT ASSUMED. A button in a different
            // tSet would build perfectly and open nothing — the template
            // would place an obstacle and a decoration.
            expect(button.t).toBe(lock.t);

            // ── the BLOCK, in the button's own lane ───────────────────
            expect(world.pushables).toHaveLength(1);
            const block = world.pushables[0];
            expect(block.tag).toBe('pushableblock');
            expect(block.family).toBe('walk');
            const blockTile = { tx: block.x / TILE_SIZE, ty: block.y / TILE_SIZE };
            const buttonTile = {
                tx: Math.floor(button.x / TILE_SIZE), ty: Math.floor(button.y / TILE_SIZE),
            };
            if (axis === 'row') {
                expect(blockTile.ty).toBe(buttonTile.ty);
                expect(buttonTile.tx).toBeGreaterThan(blockTile.tx);
            } else {
                expect(blockTile.tx).toBe(buttonTile.tx);
                expect(buttonTile.ty).toBeGreaterThan(blockTile.ty);
            }
        });
    }

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
     */
    it('⛔ TWO placements are TWO groups — the user-reported defect, as a test', () => {
        const m = model();
        const two = m.place(
            m.place(m.skeleton(), instanceOf('wall-gap-lock-weigh', { ori: 'h' }), { tx: 1, ty: 3 }),
            instanceOf('wall-gap-lock-weigh', { ori: 'h' }), { tx: 1, ty: 6 },
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
        const t = instanceOf('wall-gap-lock-weigh', { ori: 'h' });
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
        for (const at of [{ tx: 1, ty: 3 }, { tx: 1, ty: 6 }, { tx: 1, ty: 9 }]) {
            record = m.place(record, instanceOf('wall-gap-lock-weigh', { ori: 'h' }), at);
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
        const t = instanceOf('wall-gap-lock-weigh', { ori: 'h' });
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
        const record = m.place(m.skeleton(), instanceOf('wall-gap-lock-weigh', { ori: 'v' }), { tx: 4, ty: 1 });
        for (const e of record.entities) {
            for (const v of Object.values(e.attrs ?? {})) expect(v).not.toBe(PLACEMENT_GROUP);
        }
        // And the guard is real: a template carrying the slot with no `groups`
        // declaration is refused BY NAME rather than written as a literal.
        const undeclared = {
            ...instanceOf('wall-gap-lock-weigh', { ori: 'v' }), name: 'undeclared', groups: undefined,
        };
        expect(() => m.place(m.skeleton(), undeclared, { tx: 4, ty: 1 }))
            .toThrow(/declares no `groups`/);
    });

    /**
     * ⛔⛔ THE S1 GUARD, AND IT IS TEMPLATE LEGALITY RATHER THAN A SOLVER
     * SPECIAL CASE. `legalAt` tests footprint ∪ clearance with `isFree`, and
     * `isFree` refuses the start and the goal cells — so declaring the cells
     * the block slides THROUGH (clearance) and the cell it lands ON (the
     * button, footprint) makes it structurally impossible to anchor this
     * template where the shove would put a block on the goal.
     *
     * ⚠ Slice 3 met that shape on `wall-gap-block` and correctly left it to
     * the LOOP to reject, because there the destination is derived per-room
     * and unknowable at anchor time. Here the destination IS the button and
     * the button is part of the template. Same law, different information —
     * which is why this assertion can exist for one family and not the other.
     */
    it('the weigh templates declare the whole slide path, so no anchor can '
        + 'land the block on the goal', () => {
        // ⛓ SLICE 2: over every INSTANTIATION of the family, so the guard has to
        // hold for each value of `ori` rather than for the two rows somebody
        // happened to write.
        for (const t of enumerateInstantiations(PRE_SWORD_PALETTE)
            .filter((x) => x.family === 'weigh')) {
            const name = t.instance;
            const block = t.entities.find((e) => e.type === 'pushableblock');
            const button = t.entities.find((e) => e.type === 'button');
            const declared = new Set([...t.footprint, ...t.clearance]
                .map((c) => `${c.dx},${c.dy}`));
            // Every cell from the block to the button INCLUSIVE — the ones the
            // block occupies at some point during the lean.
            const dx = Math.sign(button.dx - block.dx);
            const dy = Math.sign(button.dy - block.dy);
            const steps = Math.max(Math.abs(button.dx - block.dx),
                Math.abs(button.dy - block.dy));
            for (let i = 0; i <= steps; i += 1) {
                const key = `${block.dx + dx * i},${block.dy + dy * i}`;
                expect(declared, `${name}: slide cell ${key} is not declared, so an anchor `
                    + 'could put the goal there').toContain(key);
            }
            // AND the stance behind the block, or the lean cannot start.
            expect(declared).toContain(`${block.dx - dx},${block.dy - dy}`);
        }
    });

    /**
     * ⛔ THE SPAN IS THE INTERIOR'S, AND THAT IS THE WHOLE DESIGN. A shorter
     * wall is walked around, the block is never in the way, and the template
     * becomes an obstacle that obstructs nothing (traps 171/173 — the same
     * failure `shoot="0"` would have been for the arrow lane). Asserted
     * against the ROOM's own size rather than against 8.
     */
    /**
     * ⛓⛓ SLICE 2 MAKES THIS THE LAW'S REAL GUARD. The span was a literal in two
     * frozen rows; it is now a consequence of a `build` that reads
     * `INTERIOR_SPAN`, and `gap` is a PARAMETER right beside it. So the claim is
     * asserted over EVERY DOOR INSTANTIATION IN BOTH BIOMES — a domain value
     * that shortened the wall, or a `build` that let `gap` shrink it, would be
     * a decoration the loop happily keeps.
     */
    it('every door instantiation spans the whole interior — anything less obstructs nothing',
        () => {
            const m = model();
            const room = m.skeleton();
            const doors = enumerateInstantiations(POST_SWORD_PALETTE)
                .filter((t) => ['shove', 'weigh', 'kill'].includes(t.family));
            // Built FROM the roster: a fourth door family arrives here as a
            // count that moved rather than as an unchecked row (trap 199).
            expect(doors.length).toBeGreaterThanOrEqual(16);
            for (const t of doors) {
                // The wall runs down the template's own axis; `ori` says which,
                // and for the plain door the gap is a hole IN that same line.
                const axis = t.params.ori === 'h' ? 'dx' : 'dy';
                const cross = t.params.ori === 'h' ? 'dy' : 'dx';
                const wall = t.footprint.filter((c) => c[cross] === 0);
                const span = Math.max(...wall.map((c) => c[axis])) + 1;
                const interior = (axis === 'dx' ? room.width : room.height) - 2;
                expect(span, t.instance).toBe(interior);
                expect(wall, t.instance).toHaveLength(interior);
                // ⛔ EXACTLY ONE HOLE, and the clearer stands in it. A door with
                // two gaps is a wall with a corridor round the obstacle.
                const painted = new Set(t.terrain.map((c) => c[axis]));
                const gaps = wall.map((c) => c[axis]).filter((o) => !painted.has(o));
                expect(gaps, t.instance).toHaveLength(1);
            }
        });

    /**
     * ⛓⛓⛓ AND IT CERTIFIES IN A ROOM THE LOOP ACTUALLY BUILT — the standard
     * every other family met (kickoff §9.2), which "the template builds what
     * it claims" does not reach: a door that builds correctly and is never
     * shoved would pass every assertion above.
     *
     * ⛔ THIS IS THE ROW SLICE 2 COULD NOT HAVE WRITTEN. Its measurement was
     * that `shove` is never SELECTED under a collect-only goal; here the loop
     * places the door, the solver shoves the block, and the run certifies its
     * collect — end to end, from the generator's own seed.
     */
    /**
     * ⛔ BOUND NAMED: seeds 1..20 at `obstacleTarget: 6`, and the search stops
     * at the first run that keeps the family. The bound is stated because a
     * search that found nothing and a search that was never run print the same
     * thing otherwise. [[feedback_bounded_sweep_must_name_what_it_bounded]]
     *
     * ⛓ Slice 3b widened this from ONE PINNED SEED to a named search, because
     * the palette is part of the draw stream: adding the two `weigh` templates
     * moved what seed 1 draws, and a test pinned to one seed is a test about
     * the draw order rather than about the family.
     *
     * ⛔⛔⛔ AND THE TICK CLAIM MOVED WITH IT, BECAUSE THE OLD ONE WAS NOT TRUE
     * OF THE FAMILY — it was true of one seed. `trace[].ticks` is the WHOLE
     * ROOM's solve after that placement, so it rises only when the obstacle is
     * on the route at all, and a full-span door with the goal on the START's
     * side is kept (the room still solves) having cost nothing. Comparing a
     * kept row against the SKELETON also mis-attributes: at seed 1 the water
     * pool placed after a weigh door reports the door's 330 as its own. The
     * honest comparison is against the row BEFORE it, and the honest claim is
     * an EXISTENCE one.
     */
    it('every CLEARER family is KEPT in a generated room that certifies its collect', () => {
        // Built FROM the roster's clearer families, so a third one added
        // without a case here is a missing test rather than an uncounted one.
        const clearers = [...new Set(PRE_SWORD_TEMPLATES.map((t) => t.family))]
            .filter((f) => f === 'shove' || f === 'weigh');
        expect(clearers.sort()).toEqual(['shove', 'weigh']);
        for (const family of clearers) {
            let found = null;
            for (let seed = 1; seed <= 20 && !found; seed += 1) {
                const out = generateSeedlingLevel({ seed, bounds: { obstacleTarget: 6 } });
                const kept = out.trace.filter((r) => r.family === family
                    && r.outcome === 'KEPT');
                if (kept.length) found = { out, kept };
            }
            expect(found, `no ${family} template was KEPT in seeds 1..20 at target 6`)
                .not.toBeNull();
            for (const d of found.kept) {
                expect(d.verdict).toBe('SOLVED');
                expect(d.ticks).toBeGreaterThan(0);
            }
        }
    });

    /**
     * ⛓⛓⛓ NON-VACUITY — the `weigh` door is not merely KEPT in generated
     * rooms, it is CROSSED in one.
     *
     * ⛔ THIS IS THE ASSERTION THE `shove` FAMILY WOULD FAIL, and finding that
     * out is what this test exists for. Measured over seeds 1..20 at target 6
     * (2026-08-12), splitting kept/reverted rows by whether the goal is beyond
     * the template's wall from the start:
     *
     *   | family | NEAR (goal on the start's side) | FAR (goal beyond it) |
     *   |---|---|---|
     *   | `weigh` | 15 KEPT, 0 REVERTED | **3 KEPT**, 3 REVERTED |
     *   | `shove` | 11 KEPT, 0 REVERTED | **0 KEPT**, 4 REVERTED |
     *
     * ⇒ `wall-gap-block` is kept in a generated room exactly when it is
     * IRRELEVANT, and refuses every time it is the room's actual door
     * (*"Obstacle: solid:pushableblock … Strategy 'shove' failed to apply"*).
     * Slice 3 promoted it on three dedicated probe geometries, which were
     * real; the GENERATED-room evidence for it has always been vacuous, and a
     * KEPT row looks identical whether or not the obstacle was ever in the
     * way. ⚠ NOT slice 3b's to fix — the family and its derivation are slice
     * 3's — but recorded here so the next slice starts from a measurement
     * rather than from a keep-count. [[feedback_graceful_skip_hides_the_surface]]
     *
     * The assertion is deliberately the EXISTENCE one for `weigh` only: a
     * count asserted here would be a test about the draw order again.
     */
    it('⛔ the weigh door is CROSSED in a generated room, not merely kept beside one', () => {
        let crossing = null;
        for (let seed = 1; seed <= 20 && !crossing; seed += 1) {
            const out = generateSeedlingLevel({ seed, bounds: { obstacleTarget: 6 } });
            const goal = seedlingModel({ seed }).goalCell;
            let prev = out.trace.find((r) => r.family === 'skeleton').ticks;
            for (const r of out.trace) {
                if (r.outcome !== 'KEPT' || r.family === 'skeleton') continue;
                /**
                 * ⛓⛓ SLICE 2: THE ORIENTATION COMES FROM `r.params.ori`, and
                 * the old spelling was `r.template.endsWith('-h')`. ⚠ THAT
                 * WOULD HAVE PASSED VACUOUSLY: with the pair collapsed, no
                 * template name ends in `-h` any more, so every row would have
                 * been read as VERTICAL and the "goal beyond the wall" test
                 * would have been asking about the wrong axis. A check that
                 * still goes green after the thing it inspects changed shape is
                 * the migration's own trap, and this is where it bit.
                 */
                const isFar = r.params.ori === 'h'
                    ? goal.ty > r.at.ty : goal.tx > r.at.tx;
                if (r.family === 'weigh' && isFar && r.ticks > prev) {
                    crossing = { seed, template: r.template, before: prev, after: r.ticks };
                    break;
                }
                prev = r.ticks;
            }
        }
        expect(crossing, 'no generated room in seeds 1..20 placed a `weigh` door BEYOND '
            + 'which the goal lay AND paid ticks for it — the family would then be kept '
            + 'only where it is irrelevant, which is what `shove` does').not.toBeNull();
        // The measured instance, as the record of what "crossed" cost.
        expect(crossing.after).toBeGreaterThan(crossing.before);
    });

    it('EVERY template in the roster is verified above — by name, not by count', () => {
        // The list this test compares against is the one the cases assert on.
        const verified = ['wall-segment', 'water-pool', 'pit-patch', 'arrow-lane',
            'wall-gap-block', 'wall-gap-lock-weigh'];
        expect(PRE_SWORD_TEMPLATES.map((t) => t.name).sort()).toEqual([...verified].sort());
    });
});

describe('the arrow lane\'s clearance rule is the ENGINE\'s geometry', () => {
    it('the lane rect comes from `arrowLaneForPlacement` + `arrowLaneRect`', () => {
        const m = model();
        const record = m.skeleton();
        const { lane, laneRect } = m.laneClear(record, 4, 2);
        const point = arrowTrapEntityPoint(4 * TILE_SIZE, 2 * TILE_SIZE);
        const expected = arrowLaneForPlacement({ id: lane.id, t: 0, ex: point.x, ey: point.y });
        expect(lane).toEqual(expected);
        expect(laneRect).toEqual(arrowLaneRect(expected, record.height * TILE_SIZE));
    });

    it('refuses an anchor whose lane covers the goal cell, and says which', () => {
        const m = model();
        // the model's goal cell for seed 1 — the lane straight above it
        const { tx, ty } = m.goalCell;
        const verdict = m.laneClear(m.skeleton(), tx, ty - 1);
        expect(verdict.ok).toBe(false);
        expect(verdict.over).toBe('the goal cell');
    });

    it('a lane that reaches neither the start nor the goal is legal', () => {
        const m = model();
        const far = m.goalCell.tx === 8 ? 2 : 8;
        expect(m.laneClear(m.skeleton(), far, 1).ok).toBe(true);
    });

    it('the anchor scan honours the rule — every drawn anchor is lane-clear', () => {
        const m = model();
        const rng = rngFor(3);
        for (let i = 0; i < 20; i += 1) {
            const at = m.anchorFor(m.skeleton(), instanceOf('arrow-lane'), rng);
            expect(at).not.toBeNull();
            expect(m.laneClear(m.skeleton(), at.tx, at.ty).ok).toBe(true);
        }
    });
});

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
        const once = placedAt(m, 'arrow-lane', { tx: 3, ty: 1 });
        expect(m.isFree(once, 3, 1)).toBe(false);
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

    it('`anchorFor` returns null rather than looping when nothing fits', () => {
        const m = model();
        // a template whose footprint is the whole interior cannot be placed
        const huge = {
            name: 'huge', family: 'x',
            footprint: Array.from({ length: 64 }, (_, i) => ({ dx: i % 8, dy: Math.floor(i / 8) })),
            terrain: [], entities: [],
        };
        expect(m.anchorFor(m.skeleton(), huge, rngFor(5))).toBeNull();
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
        for (const x of EXCLUDED_TEMPLATES) {
            expect(typeof x.cause).toBe('string');
            expect(x.cause.length).toBeGreaterThan(0);
            expect(typeof x.measured).toBe('string');
            expect(typeof x.wouldNeed).toBe('string');
        }
    });

    it('the MEASURED ones carry the refusal text verbatim, and it is THIS slice\'s', () => {
        const measured = EXCLUDED_TEMPLATES.filter((x) => x.refusalText !== null);
        expect(measured).toHaveLength(2);
        // ⛔ Both texts are re-measured on the CORRIDOR after the collect-path
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

    it('NOTHING excluded is also in the palette', () => {
        const paletteFamilies = new Set(PRE_SWORD_TEMPLATES.map((t) => t.family));
        for (const x of EXCLUDED_TEMPLATES) {
            expect(PRE_SWORD_TEMPLATES.some((t) => t.name === x.name)).toBe(false);
        }
        // ⛓ `shove` is NO LONGER on this list — slice 3 promoted it. The
        // families still out are the ones whose measurement still says so.
        for (const family of ['hold', 'kill', 'break', 'chaser']) {
            expect(paletteFamilies.has(family)).toBe(false);
        }
        expect(paletteFamilies.has('shove')).toBe(true);
    });
});
