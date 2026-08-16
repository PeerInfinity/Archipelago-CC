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
    SEEDLING_DEFAULTS, SEEDLING_SKELETON_KINDS, interiorCells, seedlingModel,
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
        expect(carved.carve).toMatchObject({
            kind: 'winding', backend: 'recursive_backtracker', postProcessors: ['pruneDeadEnds'],
        });
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
        for (const kind of ['branchy', 'bushy', 'winding']) {
            for (let seed = 1; seed <= 8; seed += 1) {
                const model = seedlingModel({ seed, skeleton: { kind } });
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
    it('every kind at its DEFAULTS is the room the kind built before the knobs existed', () => {
        for (const kind of CARVING) {
            for (const seed of [1, 2, 3, 4, 5, 6]) {
                const bare = render(room(kind, seed, undefined));
                expect(render(room(kind, seed, {}))).toBe(bare);
                expect(render(room(kind, seed, { chambers: 0 }))).toBe(bare);
            }
        }
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
