/**
 * seedlingDemo/procgenSeedlingSkeleton.test — **THE CONSTRUCTIVE SKELETON, ON
 * THE SEEDLING BINDING.**
 *
 * CONSTRUCTIVE-MODE arc, slice 5 (kickoff §3.3–3.4). The kind VOCABULARY and
 * the carvers themselves are gated substrate-free in
 * `procgenCore/skeletonKinds.test.js`; what is here is what only Seedling can
 * be asked — the wall ring, the draw ORDER against the goal, the record the
 * carve produces, and the promise that the OPEN ROOM did not move.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_SKELETON_KIND } from '../procgenCore/skeletonKinds.js';
import { terrainAt } from './procgenLevel.js';
import {
    SEEDLING_CHAMBERS_KINDS, SEEDLING_DEFAULTS, SEEDLING_SKELETON_KINDS, interiorCells,
    seedlingExplicitSkeletonParams, seedlingModel, seedlingSkeletonSpec,
} from './procgenSeedling.js';

const CARVING = SEEDLING_SKELETON_KINDS.filter((k) => k !== DEFAULT_SKELETON_KIND);

const render = (record) => {
    const rows = [];
    for (let ty = 0; ty < record.height; ty += 1) {
        let row = '';
        for (let tx = 0; tx < record.width; tx += 1) {
            row += terrainAt(record, tx, ty) === 'ground' ? '.' : '#';
        }
        rows.push(row);
    }
    return rows.join('\n');
};

const groundCells = (record) => interiorCells(record)
    .filter((c) => terrainAt(record, c.tx, c.ty) === 'ground');

describe('procgenSeedling — which kinds this binding offers', () => {
    it('offers every PORTABLE kind and refuses the two simulator-bound ones BY NAME', () => {
        expect(SEEDLING_SKELETON_KINDS)
            .toEqual(['empty', 'branchy', 'bushy', 'loopy', 'open', 'rooms', 'winding']);
        expect(() => seedlingModel({ seed: 1, skeleton: { kind: 'corridor' } }))
            .toThrow(/"corridor" needs the maze simulator.*the Seedling binding offers/s);
        expect(() => seedlingModel({ seed: 1, skeleton: { kind: 'classic' } }))
            .toThrow(/needs the maze simulator/);
        expect(() => seedlingModel({ seed: 1, skeleton: { kind: 'spiral' } }))
            .toThrow(/is not a skeleton kind/);
    });

    it('names the kind that built it, and what the carve ran', () => {
        const open = seedlingModel({ seed: 3 });
        expect(open.skeletonKind).toBe('empty');
        expect(open.skeletonSpec).toEqual({ kind: 'empty' });
        expect(open.carve).toBeNull();
        const carved = seedlingModel({ seed: 3, skeleton: { kind: 'winding' } });
        expect(carved.skeletonKind).toBe('winding');
        /**
         * ⛓⛓ ARC 3, SLICE 4b — **`chambers` IS IN THE POST-PROCESSOR LIST NOW,
         * BECAUSE SEEDLING DEFAULTS IT TO 1** on the five carved TREE kinds
         * (D6). ⛔ The list is the EFFECTIVE carve's, which is the point of the
         * row: it says what actually ran, and what actually runs on this
         * substrate is the stamp.
         */
        expect(carved.carve).toMatchObject({
            kind: 'winding',
            backend: 'recursive_backtracker',
            postProcessors: ['pruneDeadEnds', 'chambers'],
        });
        expect(carved.skeletonEffective).toEqual({ kind: 'winding', params: { chambers: 1 } });
        /** ⛔ AND THE CODEC'S OWN DEFAULT IS STILL 0 — a caller who says so gets
         *  the bare backend and the post-processor is not appended at all. */
        const bare = seedlingModel({ seed: 3,
            skeleton: { kind: 'winding', params: { chambers: 0 } } });
        expect(bare.carve).toMatchObject({ postProcessors: ['pruneDeadEnds'] });
        expect(bare.skeletonSpec).toEqual({ kind: 'winding' });
    });
});

describe('procgenSeedling — ⛔ THE OPEN ROOM DID NOT MOVE', () => {
    /**
     * ⛓⛓ THE SLICE'S CENTRAL PROMISE, asked of the record itself. ⛔ The
     * default kind does not run the carve at all — `empty` is not "the `empty`
     * backend", it is the room this file has always built — so the claim is
     * that the code path is absent, and the observable form of that is a
     * skeleton whose whole interior is untouched `ground`.
     */
    it('leaves every interior cell `ground` at the default kind, seeds 1..12', () => {
        for (let seed = 1; seed <= 12; seed += 1) {
            const record = seedlingModel({ seed }).skeleton();
            expect(groundCells(record).length, `seed ${seed}`)
                .toBe(interiorCells(record).length);
        }
    });

    it('an explicit `{kind:"empty"}` IS the default — the same record, cell for cell', () => {
        for (let seed = 1; seed <= 8; seed += 1) {
            expect(render(seedlingModel({ seed, skeleton: { kind: 'empty' } }).skeleton()))
                .toBe(render(seedlingModel({ seed }).skeleton()));
        }
    });
});

describe('procgenSeedling — ⛓ THE DRAW ORDER IS THE IDENTITY', () => {
    /**
     * ⛓⛓⛓ THE GOAL IS `roomRng`'s FIRST DRAW AND THE CARVE COMES AFTER IT
     * (⚖ kickoff §3.4), so the goal of seed s under kind K is the goal of seed
     * s under the open room. ⛔ THIS TEST IS WHY THE ORDER IS WRITTEN THAT WAY:
     * a carve that drew first would move every goal and expire the empty-room
     * seed→level pairs for nothing. (The mutant that swaps them reddens exactly
     * this row and leaves the `empty` rows above green.)
     */
    it('the goal of seed s under ANY kind is the goal of seed s under `empty`', () => {
        for (let seed = 1; seed <= 24; seed += 1) {
            const open = seedlingModel({ seed }).goalCell;
            for (const kind of CARVING) {
                expect(seedlingModel({ seed, skeleton: { kind } }).goalCell, `${kind} @ ${seed}`)
                    .toEqual(open);
            }
        }
    });

    /**
     * ⛔ `skeleton()` IS A PURE ACCESSOR. The carve spends draws, and the page
     * calls `skeleton()` separately from the loop — so a carve inside it would
     * hand out a different room on the second call from one seed.
     */
    it('calling `skeleton()` twice returns the same room (the carve ran ONCE)', () => {
        for (const kind of CARVING) {
            const model = seedlingModel({ seed: 5, skeleton: { kind } });
            expect(render(model.skeleton())).toBe(render(model.skeleton()));
        }
    });

    it('is DETERMINISTIC across models — same seed, same kind, same room', () => {
        for (const kind of CARVING) {
            expect(render(seedlingModel({ seed: 9, skeleton: { kind } }).skeleton()))
                .toBe(render(seedlingModel({ seed: 9, skeleton: { kind } }).skeleton()));
        }
    });
});

describe('procgenSeedling — what a carved room looks like', () => {
    /**
     * ⛓⛓⛓ THE RING IS THE ROOM. `emptyLevel`'s own docblock: *"nothing stops a
     * player from walking off a floor that ends"*. The grid contract knows
     * nothing about a border, and `recursive_division` starts from an all-floor
     * grid and only ADDS walls — so the binding hands the carvers a grid whose
     * ring is ALREADY wall, and this is the row that says it worked.
     */
    it('keeps the whole border ring `wall`, every kind, seeds 1..12', () => {
        for (const kind of CARVING) {
            for (let seed = 1; seed <= 12; seed += 1) {
                const r = seedlingModel({ seed, skeleton: { kind } }).skeleton();
                for (let i = 0; i < r.width; i += 1) {
                    expect(terrainAt(r, i, 0), `${kind} seed ${seed}`).toBe('wall');
                    expect(terrainAt(r, i, r.height - 1)).toBe('wall');
                }
                for (let i = 0; i < r.height; i += 1) {
                    expect(terrainAt(r, 0, i)).toBe('wall');
                    expect(terrainAt(r, r.width - 1, i)).toBe('wall');
                }
            }
        }
    });

    it('carves LESS than the open room, and always leaves the start and the goal walkable', () => {
        for (const kind of CARVING) {
            for (let seed = 1; seed <= 12; seed += 1) {
                const model = seedlingModel({ seed, skeleton: { kind } });
                const r = model.skeleton();
                expect(groundCells(r).length, `${kind} seed ${seed}`)
                    .toBeLessThan(interiorCells(r).length);
                expect(terrainAt(r, SEEDLING_DEFAULTS.start.tx, SEEDLING_DEFAULTS.start.ty))
                    .toBe('ground');
                expect(terrainAt(r, model.goalCell.tx, model.goalCell.ty)).toBe('ground');
            }
        }
    });

    /**
     * ⛓ THE GOAL PICKUP RIDES AS IT ALWAYS DID — the carve changes the TERRAIN
     * and nothing else, so a carved skeleton is still a room with exactly one
     * entity and it is the goal.
     */
    it('still carries exactly the goal entity', () => {
        for (const kind of SEEDLING_SKELETON_KINDS) {
            const r = seedlingModel({ seed: 4, skeleton: { kind } }).skeleton();
            expect(r.entities).toHaveLength(1);
            expect(r.entities[0].type).toBe(SEEDLING_DEFAULTS.goalClass);
        }
    });

    /**
     * ⚠ THE 10x10 ROOM'S LATTICE IS 4x4 CELLS AT ODD COORDINATES, so the tree
     * kinds never use column 8 or row 8 — 7x7 effective. Stated in the
     * docblock and driven here, because "the dead strip" is the kind of fact
     * that is true until somebody changes the room size and nothing says so.
     */
    it('leaves the lattice dead strip (col 8 / row 8) walled for the TREE kinds', () => {
        /**
         * ⚠⚠ ARC 3, SLICE 4b — **ASKED AT `chambers: 0`, AND THAT IS THE ONLY
         * ARM THE CLAIM WAS EVER ABOUT.** The dead strip is a property of the
         * tree BACKENDS' 4x4 lattice; `chambers` is a STAMP that runs after
         * them and is bounded only by `margin: 1` (the wall ring), so it may
         * legitimately open cells in column 8 or row 8. Seedling now defaults
         * that stamp ON (D6), so a bare `{kind}` no longer isolates the
         * backend — and re-pointing the row is the honest edit rather than
         * weakening the claim to one the stamp cannot violate.
         */
        for (const kind of ['branchy', 'bushy', 'winding']) {
            for (let seed = 1; seed <= 8; seed += 1) {
                const model = seedlingModel({ seed,
                    skeleton: { kind, params: { chambers: 0 } } });
                const r = model.skeleton();
                const onStrip = groundCells(r).filter((c) => c.tx === 8 || c.ty === 8);
                // ⛓ …except where `connectFixedTiles` had to L-carve the GOAL
                // out of the strip, which is the one thing that may reach it.
                for (const c of onStrip) {
                    expect(model.goalCell.tx === 8 || model.goalCell.ty === 8,
                        `${kind} seed ${seed} touched (${c.tx},${c.ty}) with the goal at `
                        + `(${model.goalCell.tx},${model.goalCell.ty})`).toBe(true);
                }
            }
        }
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ SLICE 7 — THE KIND PARAMETERS, ON THIS BINDING
 * ══════════════════════════════════════════════════════════════════════ */

describe('procgenSeedling — the kind parameters', () => {
    const room = (kind, seed, params) => seedlingModel({
        seed, skeleton: { kind, params },
    }).skeleton();

    /**
     * ⛓⛓⛓ THE BYTE-INERT CLAIM, AT THE BINDING. ⛔ It is asserted against the
     * room built with NO `params` argument at all — not against a second run
     * with the defaults spelled out — because the question is whether the room
     * a link WITHOUT parameters builds is the room that shipped.
     */
    it('⛓⛓⛓ SLICE 4b — the SEEDLING default is `chambers = 1` on the five carved '
        + 'TREE kinds, and NOTHING ELSE MOVED', () => {
        /**
         * ⛔⛔ **THIS ROW REPLACES "every kind at its DEFAULTS is the room the
         * kind built before the knobs existed", WHICH IS THE CLAIM D6
         * DELIBERATELY RETIRES** — and it is stated as a replacement rather
         * than deleted, because a reader of slice 7's records needs to know
         * which sentence stopped being true and why.
         *
         * ⚖ The user ruled (2026-08-17) that Seedling's carved kinds default to
         * `chambers = k > 0`: *a bare corridor plus one element is the OTHER
         * extreme of ruling 12, not its intent.* The yield table picked k = 1
         * (102 kept of 120 against `chambers=2`'s 113 pre-sword, 105 against
         * 103 post-sword; the control keeps 4).
         *
         * ⛔ THE CODEC'S DEFAULT IS UNMOVED AT 0 — `CHAMBERS_PARAM` is shared BY
         * REFERENCE with the maze, whose byte-identity md5 is this slice's gate.
         * What moved is one substrate's resolution of an OMITTED value.
         */
        for (const kind of SEEDLING_CHAMBERS_KINDS) {
            for (const seed of [1, 2, 3, 4, 5, 6]) {
                const omitted = render(room(kind, seed, undefined));
                expect(render(room(kind, seed, {}))).toBe(omitted);
                expect(render(room(kind, seed, { chambers: 1 }))).toBe(omitted);
                /** ⛔ AND TYPED-0 IS A DIFFERENT ROOM — the TWO STREAMS the
                 *  resolver exists to keep apart. */
                expect(render(room(kind, seed, { chambers: 0 }))).not.toBe(omitted);
            }
        }
        /** ⛓ `rooms` DECLARES `chambers` AND THE DEFAULT DOES NOT REACH IT:
         *  `recursive_division` already makes rooms (the census measures 1.7-2.0
         *  real chambers there against 0.1-0.2 on a bare tree kind), so the
         *  byte-inert claim survives intact on the kind the default leaves
         *  alone. */
        for (const seed of [1, 2, 3, 4, 5, 6]) {
            const bare = render(room('rooms', seed, undefined));
            expect(render(room('rooms', seed, {}))).toBe(bare);
            expect(render(room('rooms', seed, { chambers: 0 }))).toBe(bare);
        }
    });

    it('⛔ the RESOLVER is idempotent, and its output is what a caller passes on', () => {
        for (const spelling of ['winding', 'winding;chambers=0', 'winding;chambers=2', 'rooms']) {
            const once = seedlingSkeletonSpec(spelling);
            expect(seedlingSkeletonSpec(once)).toEqual(once);
            expect(render(seedlingModel({ seed: 4, skeleton: once }).skeleton()))
                .toBe(render(seedlingModel({ seed: 4, skeleton: spelling === 'rooms'
                    ? { kind: 'rooms' } : seedlingSkeletonSpec(spelling) }).skeleton()));
        }
        /** ⛔ AND `model.skeletonSpec` IS **NOT** AN INPUT — it is the canonical
         *  spelling (default by absence), so feeding it back would lose a typed
         *  0 exactly as a bare `parseSkeleton` result would. Driven, so the
         *  contract is a row rather than a docblock. */
        const typedZero = seedlingModel({ seed: 4,
            skeleton: seedlingSkeletonSpec('winding;chambers=0') });
        expect(typedZero.skeletonSpec).toEqual({ kind: 'winding' });
        expect(render(seedlingModel({ seed: 4, skeleton: typedZero.skeletonSpec }).skeleton()))
            .not.toBe(render(typedZero.skeleton()));
    });

    /**
     * ⛓⛓⛓ PROCGEN ELEMENTS arc 3, slice 5a (D2) — **THE KEYS A LINK MUST SPELL
     * EXPLICITLY**, and they are DERIVED from the resolver rather than listed.
     *
     * ⛔ THE LITERALS ARE STATED HERE, so a build whose `SEEDLING_CHAMBERS_KINDS`
     * silently lost a member reds this row rather than quietly writing a URL
     * that means a different room. ⚠ `rooms` DECLARES `chambers` and is NOT one
     * of the five — the difference between *the codec declares this knob* and
     * *this binding overrides its default*.
     */
    it('⛓ the EXPLICIT key list is the resolver\'s own, kind by kind', () => {
        for (const kind of ['winding', 'branchy', 'bushy', 'loopy', 'open']) {
            expect(seedlingExplicitSkeletonParams(kind)).toEqual(['chambers']);
        }
        for (const kind of ['empty', 'rooms', 'classic', 'corridor']) {
            expect(seedlingExplicitSkeletonParams(kind)).toEqual([]);
        }
        expect(seedlingExplicitSkeletonParams(undefined)).toEqual([]);
        /** ⛔ AND IT IS EXACTLY THE KEY SET THE RESOLVER FORCES — asked of the
         *  resolver, so the two cannot drift. */
        for (const kind of ['winding', 'rooms', 'empty', 'bushy']) {
            expect(seedlingExplicitSkeletonParams(kind))
                .toEqual(kind === 'rooms' || kind === 'empty'
                    ? [] : Object.keys(seedlingSkeletonSpec({ kind }).params ?? {}));
        }
    });

    /**
     * ⛓⛓⛓ THE DISCRIMINATING PAIR, AS A **VALUE** (trap 269): a typed 0 and an
     * omitted `chambers` build DIFFERENT ROOMS, counted in ground cells rather
     * than compared as spellings.
     */
    it('⛔ a TYPED chambers=0 is a different room from an omitted one', () => {
        const ground = (spec) => {
            const rec = seedlingModel({ seed: 1, skeleton: spec }).skeleton();
            let n = 0;
            for (let ty = 1; ty < rec.height - 1; ty += 1) {
                for (let tx = 1; tx < rec.width - 1; tx += 1) {
                    if (terrainAt(rec, tx, ty) === 'ground') n += 1;
                }
            }
            return n;
        };
        expect(ground(seedlingSkeletonSpec('winding'))).toBe(23);
        expect(ground(seedlingSkeletonSpec('winding;chambers=0'))).toBe(16);
    });

    /**
     * ⛓ THE DRAW ORDER, RE-DRIVEN UNDER PARAMETERS. `chambers` runs LAST, so
     * turning it on must not move the goal — which is `roomRng`'s FIRST draw
     * and therefore the thing every earlier slice's pairs rest on.
     */
    it('the goal is unmoved by any parameter value — it is drawn FIRST', () => {
        for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
            const base = seedlingModel({ seed }).goalCell;
            for (const kind of CARVING) {
                for (const chambers of [0, 1, 2, 3]) {
                    expect(seedlingModel({ seed, skeleton: { kind, params: { chambers } } })
                        .goalCell).toEqual(base);
                }
            }
            expect(seedlingModel({ seed, skeleton: { kind: 'rooms', params: { minRoom: 2 } } })
                .goalCell).toEqual(base);
        }
    });

    it('`chambers` opens MORE ground, MONOTONELY, on every carving kind', () => {
        for (const kind of CARVING) {
            const none = groundCells(room(kind, 3, { chambers: 0 }));
            const some = groundCells(room(kind, 3, { chambers: 3 }));
            expect(some.length).toBeGreaterThan(none.length);
            for (const c of none) {
                expect(some.some((d) => d.tx === c.tx && d.ty === c.ty)).toBe(true);
            }
        }
    });

    /**
     * ⛓⛓ THE MARGIN, PROVED BY THE BINDING'S OWN REFUSAL. `procgenSeedling`
     * REFUSES a carve that leaves a border cell as ground (trap 272), so a
     * `chambers` that ignored `margin: 1` would not merely look wrong here — it
     * would THROW. The claim is therefore "it built a room at all", over every
     * kind × every k × 12 seeds, plus the ring, cell by cell.
     */
    it('keeps the border ring WALL at every chambers value, seeds 1..12', () => {
        for (const kind of CARVING) {
            for (const chambers of [1, 2, 3]) {
                for (let seed = 1; seed <= 12; seed += 1) {
                    const rec = room(kind, seed, { chambers });
                    for (let tx = 0; tx < rec.width; tx += 1) {
                        expect(terrainAt(rec, tx, 0)).not.toBe('ground');
                        expect(terrainAt(rec, tx, rec.height - 1)).not.toBe('ground');
                    }
                    for (let ty = 0; ty < rec.height; ty += 1) {
                        expect(terrainAt(rec, 0, ty)).not.toBe('ground');
                        expect(terrainAt(rec, rec.width - 1, ty)).not.toBe('ground');
                    }
                }
            }
        }
    });

    it('`minRoom` reaches the backend, and the model carries the NORMALIZED spec', () => {
        expect(render(room('rooms', 5, { minRoom: 2 })))
            .not.toBe(render(room('rooms', 5, { minRoom: 4 })));
        expect(seedlingModel({ seed: 5, skeleton: { kind: 'rooms', params: { minRoom: 3 } } })
            .skeletonSpec).toEqual({ kind: 'rooms' });
        expect(seedlingModel({ seed: 5, skeleton: { kind: 'rooms', params: { minRoom: 2 } } })
            .skeletonSpec).toEqual({ kind: 'rooms', params: { minRoom: 2 } });
    });

    it('REFUSES a parameter this kind does not declare, and an out-of-domain value', () => {
        expect(() => seedlingModel({ seed: 1, skeleton: { kind: 'branchy', params: { prune: 1 } } }))
            .toThrow(/"branchy" has no parameter "prune"/);
        expect(() => seedlingModel({ seed: 1, skeleton: { kind: 'rooms', params: { minRoom: 9 } } }))
            .toThrow(/declared domain \[2, 3, 4\]/);
    });
});
