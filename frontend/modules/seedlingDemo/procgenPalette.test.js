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
    POST_SWORD_TEMPLATES, PRE_SWORD_PALETTE, PRE_SWORD_TEMPLATES, PaletteRosterError,
    ProcgenPaletteError,
    assertPalette, catalogueRows, defineTemplate, dischargesVerb, enumerateInstantiations,
    enumerateValues, instantiateKept, restrictPalette, verbOf,
} from './procgenPalette.js';
import {
    SEEDLING_DEFAULTS, generateSeedlingLevel, placementGroupId, placementTagId,
    seedlingModel, seedlingOracle,
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
        it('enumerates 41 pre-sword and 43 post-sword instantiations at module load', () => {
            // ⛓ ARC 3 SLICE 1: 42/44 before `arrow-lane`'s ONE zero-parameter
            // instantiation left with the row (⚖ design ruling 9).
            expect(enumerateInstantiations(PRE_SWORD_PALETTE)).toHaveLength(41);
            expect(enumerateInstantiations(POST_SWORD_PALETTE)).toHaveLength(43);
            const perTemplate = Object.fromEntries(
                PRE_SWORD_TEMPLATES.map((t) => [t.name, enumerateValues(t).length]),
            );
            expect(perTemplate).toEqual({
                'wall-segment': 8,
                'water-pool': 9,
                'pit-patch': 6,
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
         * ⛓ …AND POST-SWORD IT IS THE WEIGH FAMILY **PLUS THE KILL FAMILY**
         * (slice 3 track C). Built FROM the roster so a third tag-bearing
         * family arriving without a case here is a MISSING test rather than an
         * uncounted one (trap 199).
         */
        it('post-sword, the kill family is on the slot too — the literal is GONE', () => {
            const carriers = enumerateInstantiations(POST_SWORD_PALETTE)
                .filter((t) => t.tags !== undefined);
            expect(carriers.map((t) => t.instance)).toEqual([
                'wall-gap-lock-weigh(ori=h)', 'wall-gap-lock-weigh(ori=v)',
                'wall-gap-spinner-killlock(ori=h)', 'wall-gap-spinner-killlock(ori=v)',
            ]);
            for (const t of carriers) expect(t.tags).toBe(1);
        });

        /**
         * ⛓⛓⛓ **THE COLLISION THAT WAS PINNED HERE IS FIXED** — GENERATE-mode
         * UI slice 3, track C, and this case is its replacement rather than its
         * relaxation.
         *
         * THE HISTORY IN THREE LINES. Slice 4e shipped the kill lock on a
         * LITERAL `tag: '1'` with the argument that only one could ever be
         * kept, so the collision was LATENT. Slice 2 measured that the argument
         * had died — post-sword **seed 12 at target 6 keeps TWO**, both on the
         * literal — and escalated rather than converting, because the field had
         * been ⚖ deferred by the user. Slice 3 took the blast-radius
         * measurement (`scripts/procgen/measure-seedling-killlock-tag.mjs`),
         * the user's ⚖ conditional approval applied, and the literal is gone.
         *
         * ⛓ WHAT THE MEASUREMENT FOUND, because it is not what the escalation
         * assumed: lock 2 does NOT open on spinner 1's death — a `tset == -1`
         * lock opens on `totalEnemies()` reaching ZERO, a GLOBAL condition, so
         * both open on the LAST death in one event. The collision's real
         * product was a DUPLICATE persistence write (two `scratchClears` rows
         * naming one slot), which the v9 parser would refuse by name. The
         * driven case below is the one that would have caught it.
         */
        it('⛓ the kill lock is on the PER-PLACEMENT slot — no literal, no shared flag', () => {
            const killLocks = enumerateInstantiations(POST_SWORD_PALETTE)
                .filter((t) => t.family === 'kill');
            expect(killLocks).toHaveLength(2);
            for (const t of killLocks) {
                expect(t.tags).toBe(1);
                const lock = t.entities.find((e) => e.type === 'lock');
                expect(lock.attrs.tag).toBe(PLACEMENT_TAG);
                // ⛓ the spinner keeps its literal `-1` — the game's own
                // spelling of UNTAGGED, which `assertTagSlot` allows on purpose.
                expect(t.entities.find((e) => e.type === 'spinner').attrs.tag).toBe('-1');
            }
        });

        /**
         * ⛓⛓ THE DRIVEN HALF, and it is the half that can FAIL. The structural
         * case above only says the sentinel is in the table; this one places
         * TWO kill locks in ONE room and reads the tags off the RECORD.
         *
         * ⚠ THE SUBJECT IS THE MEASURED COLLISION ITSELF — post-sword seed 12
         * at target 6, the level slice 2 found keeping two. A seed that keeps
         * ONE cannot distinguish the two builds at all: `placementTagId`
         * allocates the LOWEST free slot and the goal always holds 0, so a
         * single kill lock is allocated **1** — exactly the value the literal
         * had (trap 235's shape, one field over).
         */
        it('⛓ DRIVEN: seed 15 keeps TWO tag-bearing locks and they take DISTINCT tags', () => {
            /**
             * ⛓⛓ RE-PICKED, AND THE SUBJECT'S SHAPE CHANGED (arc 3 slice 1,
             * trap 285 — the target and the count are named). `arrow-lane`
             * leaving the roster moved every draw, and the property seed 12 had
             * is now RARE: SCANNED post-sword at `obstacleTarget: 6` over seeds
             * 1..60, **NOT ONE seed keeps two KILL locks** (eight keep exactly
             * one: 13, 14, 15, 19, 32, 41, 49, 54).
             *
             * ⛔ SO THE SUBJECT IS RE-STATED RATHER THAN RELAXED. What
             * `placementTagId` actually claims is *"only levels holding TWO
             * TAG-BEARING TEMPLATES move, and their tags differ"* — and a KILL
             * lock plus a WEIGH lock is exactly two tag-bearing placements.
             * THREE seeds have that (15, 19, 32); **15 is taken**. The claim
             * below is unchanged; only the pair of templates producing it is.
             */
            const out = generateSeedlingLevel({
                seed: 15, palette: POST_SWORD_PALETTE, bounds: { obstacleTarget: 6 },
            });
            // the subject's own property, asserted BEFORE the claim about it
            const families = out.summary.kept.map((k) => k.family);
            expect(families.filter((f) => f === 'kill')).toHaveLength(1);
            expect(families.filter((f) => f === 'weigh')).toHaveLength(1);
            const locks = out.record.entities.filter((e) => e.type === 'lock');
            expect(locks).toHaveLength(2);
            const tags = locks.map((l) => l.attrs.tag);
            expect(new Set(tags).size).toBe(2);
            for (const t of tags) {
                expect(t).not.toBe(SEEDLING_DEFAULTS.goalTag);
                expect(Number.parseInt(t, 10)).toBeGreaterThanOrEqual(0);
            }
        });
    });

    it('every family in the roster is represented, and the count comes FROM the roster', () => {
        const families = new Set(PRE_SWORD_TEMPLATES.map((t) => t.family));
        // ⛓ PoC slice 3b added `weigh` — the palette's SECOND clearer family
        // and the first whose template places three cooperating entities.
        // ⛓ ARC 3 SLICE 1: `arrow-lane` (a family AND a template) is gone.
        expect([...families].sort())
            .toEqual(['pit', 'shove', 'wall', 'water', 'weigh']);
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
        const verified = ['wall-segment', 'water-pool', 'pit-patch',
            'wall-gap-block', 'wall-gap-lock-weigh'];
        expect(PRE_SWORD_TEMPLATES.map((t) => t.name).sort()).toEqual([...verified].sort());
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
         * ⛓ RE-PICKED (arc 3 slice 1): the subject was `arrow-lane`, the only
         * one-cell entity template, and it left the roster. `wall-gap-lock-weigh`
         * is the pre-sword row that places entities, so the cell is FOUND from
         * the record rather than hard-coded — the claim is "an entity's cell is
         * not free", and reading the offset off the template would make it a
         * claim about this row's geometry instead.
         */
        const once = placedAt(m, 'wall-gap-lock-weigh', { tx: 1, ty: 3 }, { ori: 'h' });
        const block = once.entities.find((e) => e.type === 'pushableblock');
        expect(block).toBeTruthy();
        const tx = Math.floor(block.x / TILE_SIZE);
        const ty = Math.floor(block.y / TILE_SIZE);
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
     * ⛓⛓⛓ THE DEDICATED CASE THE SEARCH EXISTS FOR — a template the FIRST
     * anchor refuses and the SECOND accepts.
     *
     * ⚠ THE SUBJECT IS MEASURED, NOT CHOSEN FOR CONVENIENCE. Walking every
     * legal anchor of `wall-gap-block(ori=v,gap=0)` over seeds 1..12, the first
     * anchor SOLVES at eleven of them; seed 7 is the one where it does not
     * (`firstSolve` = 2 of 6 legal). A subject whose first anchor already
     * solved could not distinguish the two bounds at all.
     */
    it('⛓ seed 7: the plain door REFUSES at anchor 1 and SOLVES at anchor 2', () => {
        const m = seedlingModel({ seed: 7 });
        const door = PRE_SWORD_PALETTE.templates.find((t) => t.name === 'wall-gap-block')
            .instantiate(null, { ori: 'v', gap: 0 });
        const oracle = seedlingOracle({ model: m, items: PRE_SWORD_PALETTE.items ?? null });
        const sk = m.skeleton();
        const two = m.anchorsFor(sk, door, rngFor(7), 2);
        expect(two).toHaveLength(2);
        // the one-anchor bound sees ONLY the first, and it refuses
        expect(m.anchorsFor(sk, door, rngFor(7), 1)).toEqual([two[0]]);
        expect(oracle.solve(m.place(sk, door, two[0]), { templates: [door] }).verdict)
            .not.toBe('SOLVED');
        expect(oracle.solve(m.place(sk, door, two[1]), { templates: [door] }).verdict)
            .toBe('SOLVED');
    });

    /**
     * ⛓⛓⛓ …AND THE SAME THING THROUGH THE WHOLE LOOP. Pre-sword seed 5 at
     * target 6 with `anchorTriesPerCandidate: 3` KEEPS a candidate at its
     * SECOND anchor that the default bound REVERTS — measured over seeds 1..12
     * (seeds 2, 4, 5 and 12 produce such a rescue; 5 produces two).
     *
     * ⛔ THE ROW PAIR IS THE CLAIM. The rescued row shares `step`/`try` with the
     * refusal before it and differs in `anchorTry` AND in `at`: a search that
     * re-tested the FIRST anchor would produce the same two rows with the same
     * ordinals and the same verdicts, and only the CELL separates them.
     */
    it('⛓ DRIVEN: seed 9 keeps at anchor 2+ a candidate the default bound reverts', () => {
        /**
         * ⛓ RE-PICKED (arc 3 slice 1, trap 285 — the target and the count are
         * named). `arrow-lane` leaving the roster moved every draw, so seed 5's
         * rescue is gone. SCANNED: pre-sword, `obstacleTarget: 6`,
         * `anchorTriesPerCandidate: 3`, seeds 1..30 — EIGHT seeds still produce
         * a rescue (4, 9, 10, 13, 15, 22, 23, 25) and all eight discriminate
         * against the default bound. **Seed 9 is taken because it produces
         * THREE**, the most of any, so the loop below is not a claim about one
         * lucky row.
         */
        const bounds = { obstacleTarget: 6, anchorTriesPerCandidate: 3 };
        const wide = generateSeedlingLevel({ seed: 9, palette: PRE_SWORD_PALETTE, bounds });
        const rescued = wide.trace.filter((r) => r.outcome === 'KEPT' && r.anchorTry > 1);
        expect(rescued.length).toBe(3);
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
            seed: 9, palette: PRE_SWORD_PALETTE, bounds: { obstacleTarget: 6 },
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

    it('⛔ answers `null` for a LEGAL anchor and a SENTENCE for an illegal one', () => {
        const m = seedlingModel({ seed: 6 });
        const sk = m.skeleton();
        const door = instance('pre-sword', 'wall-gap-block', { ori: 'v', gap: 1 });
        // measured (see the slice-6 as-built): seed 6's plain vertical door is
        // legal at (7,1) and its footprint runs down to (7,8).
        expect(m.refusalAt(sk, door, 7, 1)).toBeNull();
        expect(typeof m.refusalAt(sk, door, 1, 1)).toBe('string');
    });

    it('⛔⛔ `legalAt` AGREES WITH IT ON EVERY INTERIOR CELL — one adjudication', () => {
        for (const [biome, name, overrides] of [
            ['pre-sword', 'wall-gap-block', { ori: 'v', gap: 1 }],
            ['pre-sword', 'water-pool', { w: 3, h: 3 }],
            ['post-sword', 'wall-gap-spinner-killlock', { ori: 'h' }],
        ]) {
            const m = seedlingModel({ seed: 6 });
            const t = instance(biome, name, overrides);
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
            const why = m.refusalAt(m.skeleton(),
                instance('pre-sword', 'wall-gap-block', { ori: 'v', gap: 1 }), 1, 1);
            expect(why).toMatch(/\(1,1\) is the START cell/);
            expect(why).toMatch(/about GEOMETRY rather than about the template/);
        });

        it('the GOAL cell — seed 6 puts it at (3,1)', () => {
            const m = seedlingModel({ seed: 6 });
            expect(m.goalCell).toEqual({ tx: 3, ty: 1 });
            expect(m.refusalAt(m.skeleton(),
                instance('pre-sword', 'wall-gap-block', { ori: 'v', gap: 1 }), 3, 1))
                .toMatch(/\(3,1\) is the GOAL cell/);
        });

        it('a footprint cell OUTSIDE the interior names the cell, not the anchor', () => {
            const m = seedlingModel({ seed: 6 });
            // the anchor (5,5) is itself free; the vertical door's 8th cell is
            // (5,12), which is not a cell of this room at all.
            expect(m.isFree(m.skeleton(), 5, 5)).toBe(true);
            const why = m.refusalAt(m.skeleton(),
                instance('pre-sword', 'wall-gap-block', { ori: 'v', gap: 1 }), 5, 5);
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
         * ⛓ MEASURED SUBJECT: post-sword seed 6's goal is at (3,1), so EVERY
         * anchor whose footprint fits is refused by the door rule — (1,4) is
         * one, and its footprint cells are all free (asserted).
         */
        it('the DOOR rule — the goal is on the START\'s side, so the wall is decoration', () => {
            const m = seedlingModel({ seed: 6 });
            const kill = instance('post-sword', 'wall-gap-spinner-killlock', { ori: 'h' });
            const sk = m.skeleton();
            for (const c of kill.footprint) expect(m.isFree(sk, 1 + c.dx, 4 + c.dy)).toBe(true);
            const why = m.refusalAt(sk, kill, 1, 4);
            expect(why).toMatch(/declares door 'h'/);
            expect(why).toMatch(/GOAL \(3,1\) is on the START's side of that wall/);
            expect(why).toMatch(/RUN ABORT/);
        });

        /**
         * ⛔⛔ THE ORDER IS PART OF THE ANSWER, AND THIS IS THE CASE THAT SHOWS
         * WHY. `doorClear` REFUSES BY THROWING for an anchor north-west of the
         * start; the footprint walk runs first and rejects every cell outside
         * the interior, so a click on the border ring meets a SENTENCE and not
         * an assertion. Reordering the two rules turns this into a page crash.
         */
        it('⛔ a cell on the BORDER RING is a sentence, never the door rule\'s throw', () => {
            const m = seedlingModel({ seed: 6 });
            const kill = instance('post-sword', 'wall-gap-spinner-killlock', { ori: 'h' });
            expect(m.refusalAt(m.skeleton(), kill, 0, 0))
                .toMatch(/\(0,0\) is not in the room's INTERIOR/);
            expect(() => m.doorClear(kill, 0, 0)).toThrow(/north-west of every anchor/);
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
    it('⛓ seed 24: every solve AFTER the pool is kept still carries `sound`', () => {
        /**
         * ⛓ RE-PICKED (arc 3 slice 1, trap 285). `arrow-lane` leaving moved
         * seed 9's kept list, and with it the solve↔kept-row mapping this case
         * depends on. SCANNED: pre-sword, `obstacleTarget: 4`, seeds 1..30, for
         * a seed that KEEPS a water pool BEFORE its last row **and** keeps its
         * FIRST candidate at every step (so solve k really is kept row k-1) —
         * SEVEN qualify (5, 18, 24, 26, 27, 29, 30). **Seed 24 is taken because
         * its pool is kept at index 1**: one pin-FREE solve before it and three
         * pinned solves after, so the case has both arms rather than one.
         */
        const seed = 24;
        const bounds = { obstacleTarget: 4 };
        const m = seedlingModel({ seed });
        const base = seedlingOracle({ model: m, items: PRE_SWORD_PALETTE.items ?? null });
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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ VERB 1 — RESTRICT, AND THE CATALOGUE (GENERATE-mode UI slice 4)
 * ══════════════════════════════════════════════════════════════════════ */

describe('restrictPalette — the sub-roster a run may draw from', () => {
    it('narrows by FAMILY and keeps ROSTER ORDER and the SAME frozen objects', () => {
        const r = restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'families', names: ['weigh', 'water'],
        });
        // ⛔ FROM THE ROSTER, never a literal (trap 199): the expected list is
        // the palette's own order filtered, so a template added to the `water`
        // family arrives here without an edit.
        const expected = PRE_SWORD_TEMPLATES.filter(
            (t) => ['water', 'weigh'].includes(t.family));
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
            axis: 'families', names: ['water', 'weigh'],
        });
        const byName_ = restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'templates', names: ['water-pool', 'wall-gap-lock-weigh'],
        });
        expect(byName_.templates).toEqual(byFamily.templates);
        // ⚠ …and they are still DIFFERENT restrictions, because the NAME says
        // which question was asked. A run's palette name rides in
        // `summary.palette`, the payload and the readout.
        expect(byFamily.name).toBe('pre-sword[families:water,weigh]');
        expect(byName_.name).toBe('pre-sword[templates:wall-gap-lock-weigh,water-pool]');
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
            axis: 'families', names: ['weigh', 'water', 'weigh'],
        });
        const b = restrictPalette(PRE_SWORD_PALETTE, { axis: 'families', names: ['water', 'weigh'] });
        expect(a.name).toBe(b.name);
        expect(a.roster.names).toEqual(['water', 'weigh']);
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
        expect(() => restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'templates', names: ['wall-gap-spinner-killlock'],
        })).toThrow(PaletteRosterError);
        expect(() => restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'templates', names: ['wall-gap-spinner-killlock'],
        })).toThrow(/names "wall-gap-spinner-killlock", which palette "pre-sword" does not offer/);
        expect(restrictPalette(POST_SWORD_PALETTE, {
            axis: 'templates', names: ['wall-gap-spinner-killlock'],
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
        const r = restrictPalette(POST_SWORD_PALETTE, { axis: 'families', names: ['kill', 'water'] });
        expect(() => assertPalette(r)).not.toThrow();
        // ⛓ AND the sentinel slots survive the subset: the kill lock's tag and
        // the group slot are properties of the TEMPLATE OBJECT, which is the
        // same object, so a restricted run cannot lose them.
        const kill = r.templates.find((t) => t.family === 'kill');
        const rows = enumerateValues(kill).map((v) => kill.instantiate(null, v));
        expect(rows.some((row) => row.entities.some((e) => e.attrs?.tag === PLACEMENT_TAG)))
            .toBe(true);
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
     * ⛓ THE SUBJECT IS MEASURED, NOT PICKED. `families:water,weigh` at
     * pre-sword seed 3, target 2 is the cheapest scanned case (68 ms, 2
     * attempts) that keeps BOTH a water pool — the only pin-declaring family,
     * so `summary.pins` has something to be wrong about — and a weigh lock,
     * which is the pre-sword template that uses BOTH sentinel slots
     * (`PLACEMENT_GROUP` and `PLACEMENT_TAG`). Scanned over seeds 1..6: 1, 2,
     * 3 and 6 keep both; 4 and 5 keep two pools.
     *
     * ⛔ AND THE UNRESTRICTED RUN OF THE SAME SEED KEEPS NEITHER — it keeps
     * `pit-patch` and `wall-gap-block` (⛓ RE-MEASURED at arc 3 slice 1; it was
     * `pit-patch` and `arrow-lane` until ⚖ design ruling 9 took that row out,
     * and seed 3 is still one of six disjoint seeds in 1..14). That is what
     * makes this a DISCRIMINATOR
     * (trap 235): a restriction the loop ignored would show up as kept
     * templates that are not in the restriction at all.
     */
    const ROSTER = Object.freeze({ axis: 'families', names: ['water', 'weigh'] });
    const restricted = () => restrictPalette(PRE_SWORD_PALETTE, ROSTER);
    const run = (palette) => generateSeedlingLevel({
        seed: 3, palette, bounds: { obstacleTarget: 2 },
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
        expect(run(restricted()).summary.palette).toBe('pre-sword[families:water,weigh]');
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

    it('the SENTINEL SLOTS are resolved per placement, restricted or not', () => {
        const r = run(restricted());
        const weigh = r.summary.kept.find((k) => k.family === 'weigh');
        expect(weigh).toBeTruthy();
        const world = worldFor(r.record);
        // the lock and its button share ONE allocated group, and the goal's
        // own tag 0 is not what the lock was given.
        const tags = world.magicalLocks.map((l) => tagOf(l));
        expect(tags.every((t) => t !== PLACEMENT_TAG)).toBe(true);
    });

    it('is DETERMINISTIC under the restriction — same roster, same level', () => {
        expect(run(restricted()).record).toEqual(run(restricted()).record);
        // ⚠ and the two SPELLINGS of one sub-roster produce one level, because
        // the subset and its ORDER are what the rng indexes.
        const byName_ = restrictPalette(PRE_SWORD_PALETTE, {
            axis: 'templates', names: ['wall-gap-lock-weigh', 'water-pool'],
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

    it('names the verb of every CLEARER family', () => {
        expect(verbOf('shove')).toBe('shove');
        expect(verbOf('weigh')).toBe('weigh');
        expect(verbOf('kill')).toBe('kill');
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
            // ⛔ AND THE ROSTER REALLY HOLDS BOTH KINDS, or this case would be
            // asserting about an empty half of its own claim.
            expect(families.filter((f) => verbOf(f) !== null).length).toBeGreaterThan(0);
            expect(families.filter((f) => verbOf(f) === null).length).toBeGreaterThan(0);
        });
});
