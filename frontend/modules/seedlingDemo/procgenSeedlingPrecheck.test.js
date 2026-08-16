/**
 * seedlingDemo/procgenSeedlingPrecheck.test — **THE CONNECTIVITY PRE-CHECK, ON
 * THE SEEDLING BINDING.**
 *
 * CONSTRUCTIVE-MODE arc, slice 6 (kickoff §3.6 item 2). The FLOOD itself is
 * gated substrate-free in `procgenCore/gridFlood.test.js`; what is here is what
 * only Seedling can be asked — which terrains block, where the rule sits in the
 * order, that it is KIND-SCOPED, and that `legalAt`/`anchorsFor` inherit it
 * because they are DERIVED from `refusalAt` rather than beside it.
 *
 * ⛓⛓ THE MAIN ROW IS A **DIFFERENTIAL**, NOT A SPOT CHECK. A test that pointed
 * at one cell and said *"this one is refused"* would pass for a build that
 * refused everything. So the differential walks every interior cell x every
 * wave-1 instantiation x four seeds and asserts the seal refusal fires EXACTLY
 * when an INDEPENDENT flood — written here, in this file, from the rule's
 * english — says the room is sealed. ⚖ Kickoff §5: a fixed point tests
 * self-consistency; an independently produced answer tests correctness.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_SKELETON_KIND } from '../procgenCore/skeletonKinds.js';
import { PRE_SWORD_PALETTE, enumerateValues } from './procgenPalette.js';
import { terrainAt } from './procgenLevel.js';
import { SEEDLING_SKELETON_KINDS, interiorCells, seedlingModel } from './procgenSeedling.js';
import { rngFor } from './procgenRng.js';

const CARVING = SEEDLING_SKELETON_KINDS.filter((k) => k !== DEFAULT_SKELETON_KIND);

/** Every concrete row the wave-1 palette can produce. */
const INSTANCES = PRE_SWORD_PALETTE.templates
    .flatMap((base) => enumerateValues(base).map((v) => base.instantiate(null, v)));

/**
 * ⛓ THE INDEPENDENT ANSWER — a second flood, written from the RULE'S ENGLISH
 * and not from `gridFlood.js`: *4-neighbour, `ground` only, over the record's
 * terrain with the candidate's writes applied.* ⛔ Deliberately a different
 * shape (a recursive-free `Set` frontier over string keys rather than a typed
 * `Uint8Array` index), so a defect that is an INDEXING mistake in one cannot be
 * the same mistake in the other.
 */
const independentlyConnected = (record, writes, from, to) => {
    const painted = new Map(writes.map((w) => [`${w.tx},${w.ty}`, w.terrain]));
    const walkable = (x, y) => {
        if (x < 0 || y < 0 || x >= record.width || y >= record.height) return false;
        return (painted.get(`${x},${y}`) ?? terrainAt(record, x, y)) === 'ground';
    };
    if (!walkable(from.tx, from.ty) || !walkable(to.tx, to.ty)) return false;
    const seen = new Set([`${from.tx},${from.ty}`]);
    let frontier = [{ x: from.tx, y: from.ty }];
    while (frontier.length) {
        const next = [];
        for (const p of frontier) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const q = { x: p.x + dx, y: p.y + dy };
                const key = `${q.x},${q.y}`;
                if (seen.has(key) || !walkable(q.x, q.y)) continue;
                if (q.x === to.tx && q.y === to.ty) return true;
                seen.add(key);
                next.push(q);
            }
        }
        frontier = next;
    }
    return false;
};

const writesOf = (template, tx, ty) => (template.terrain ?? [])
    .map((w) => ({ tx: tx + w.dx, ty: ty + w.dy, terrain: w.terrain }));

/** True when the footprint/clearance walk — which runs FIRST — would pass. */
const footprintFree = (model, record, template, tx, ty) => [
    ...(template.footprint ?? []), ...(template.clearance ?? []),
].every((c) => model.isFree(record, tx + c.dx, ty + c.dy));

const SEAL = /would SEAL the room/;

describe('procgenSeedling — the connectivity pre-check refuses a sealing candidate BY NAME', () => {
    it('names the rule, the start, the goal and how many cells it counted', () => {
        const model = seedlingModel({ seed: 3, skeleton: { kind: 'winding' } });
        const record = model.skeleton();
        const hits = [];
        for (const t of INSTANCES) {
            for (const c of interiorCells(record)) {
                const why = model.refusalAt(record, t, c.tx, c.ty);
                if (why && SEAL.test(why)) hits.push({ t, c, why });
            }
        }
        expect(hits.length).toBeGreaterThan(0);
        const { why } = hits[0];
        expect(why).toMatch(/^"[^"]+" at \(\d+,\d+\): its TERRAIN would SEAL the room/);
        expect(why).toMatch(/no ground path from the START \(1,1\) to the GOAL \(\d+,\d+\)/);
        expect(why).toMatch(/once the \d+ wall\/water\/pit cell\(s\) it writes are painted/);
    });

    it('⛓ a WALL SEGMENT across a carved corridor is one of them', () => {
        const wall = INSTANCES.find((t) => t.name === 'wall-segment');
        const sealed = [];
        for (const kind of CARVING) {
            for (let seed = 1; seed <= 6; seed += 1) {
                const model = seedlingModel({ seed, skeleton: { kind } });
                const record = model.skeleton();
                for (const c of interiorCells(record)) {
                    const why = model.refusalAt(record, wall, c.tx, c.ty);
                    if (why && SEAL.test(why)) sealed.push(`${kind}/${seed}/${c.tx},${c.ty}`);
                }
            }
        }
        expect(sealed.length).toBeGreaterThan(0);
    });

    it('⛓ a PIT PATCH and a WATER POOL that seal are refused too — every blocking terrain', () => {
        const found = new Map();
        for (const kind of CARVING) {
            for (let seed = 1; seed <= 8; seed += 1) {
                const model = seedlingModel({ seed, skeleton: { kind } });
                const record = model.skeleton();
                for (const t of INSTANCES) {
                    if (!['pit-patch', 'water-pool'].includes(t.name)) continue;
                    for (const c of interiorCells(record)) {
                        const why = model.refusalAt(record, t, c.tx, c.ty);
                        if (why && SEAL.test(why)) found.set(t.name, why);
                    }
                }
            }
        }
        expect([...found.keys()].sort()).toEqual(['pit-patch', 'water-pool']);
        // ⛔ WATER AND PIT BLOCK. Both land in the walk's own hazard tables
        // (`world.lethalTerrainTiles` / `world.pitTiles`), so a route cannot
        // cross either — the rule's soundness argument, asserted rather than
        // described.
        for (const why of found.values()) expect(why).toMatch(/wall\/water\/pit/);
    });

    it('an anchor BESIDE a corridor is legal — the rule refuses sealing, not carving', () => {
        const wall = INSTANCES.find((t) => t.name === 'wall-segment');
        let legal = 0;
        for (let seed = 1; seed <= 6; seed += 1) {
            const model = seedlingModel({ seed, skeleton: { kind: 'branchy' } });
            const record = model.skeleton();
            for (const c of interiorCells(record)) {
                if (model.refusalAt(record, wall, c.tx, c.ty) === null) legal += 1;
            }
        }
        expect(legal).toBeGreaterThan(0);
    });
});

describe('procgenSeedling — ⛓⛓ THE DIFFERENTIAL: the rule fires exactly when the room seals', () => {
    it('agrees with an INDEPENDENT flood on every interior cell x every wave-1 row', () => {
        let compared = 0;
        let sealedCases = 0;
        for (const kind of CARVING) {
            for (let seed = 1; seed <= 4; seed += 1) {
                const model = seedlingModel({ seed, skeleton: { kind } });
                const record = model.skeleton();
                for (const t of INSTANCES) {
                    for (const c of interiorCells(record)) {
                        if (!footprintFree(model, record, t, c.tx, c.ty)) continue;
                        const writes = writesOf(t, c.tx, c.ty);
                        const blocking = writes.filter((w) => w.terrain !== 'ground').length;
                        const stillOpen = blocking === 0 || independentlyConnected(
                            record, writes, model.defaults.start, model.goalCell,
                        );
                        const why = model.refusalAt(record, t, c.tx, c.ty) ?? '';
                        compared += 1;
                        if (stillOpen) {
                            expect(`${kind}/${seed}/${t.instance}@${c.tx},${c.ty}: ${why}`)
                                .not.toMatch(SEAL);
                        } else {
                            sealedCases += 1;
                            expect(`${kind}/${seed}/${t.instance}@${c.tx},${c.ty}: ${why}`)
                                .toMatch(SEAL);
                        }
                    }
                }
            }
        }
        // ⛔ THE DENOMINATOR, ASSERTED. A differential whose "sealed" arm never
        // fired would be a green test about a rule that never ran.
        expect(compared).toBeGreaterThan(1000);
        expect(sealedCases).toBeGreaterThan(50);
    });
});

describe('procgenSeedling — ⛔ THE RULE IS KIND-SCOPED (⚖ §6.2 default)', () => {
    it('the `empty` room never produces a seal refusal, over the whole palette', () => {
        for (let seed = 1; seed <= 8; seed += 1) {
            const model = seedlingModel({ seed });
            const record = model.skeleton();
            for (const t of INSTANCES) {
                for (const c of interiorCells(record)) {
                    const why = model.refusalAt(record, t, c.tx, c.ty);
                    if (why) expect(`seed ${seed} ${t.instance}: ${why}`).not.toMatch(SEAL);
                }
            }
        }
    });

    it('⛓⛓ THE DISCRIMINATING SUBJECT: ONE record, ONE template, ONE cell, TWO models', () => {
        /**
         * ⛔ THE FIXTURE HAS TO DISTINGUISH TWO BUILDS
         * (`feedback_fixture_must_discriminate_two_builds`). "The empty room
         * never seals" is true of a build with NO kind scope too, because a
         * three-cell wall cannot seal an open 8x8 interior — so that row alone
         * would be inert against the mutant that drops the scope.
         *
         * ⛓ The subject that CAN tell them apart is the CARVED record handed to
         * BOTH models. `refusalAt` is a pure function of `(record, template,
         * cell)` plus the model's own kind, start and goal — and ⚖ §3.4's draw
         * order makes the start and the goal of seed s identical under every
         * kind, so the two models differ in EXACTLY the variable under test.
         */
        const carved = seedlingModel({ seed: 3, skeleton: { kind: 'winding' } });
        const open = seedlingModel({ seed: 3 });
        expect(open.goalCell).toEqual(carved.goalCell);
        expect(open.skeletonKind).toBe(DEFAULT_SKELETON_KIND);

        const record = carved.skeleton();
        let subject = null;
        for (const t of INSTANCES) {
            for (const c of interiorCells(record)) {
                const why = carved.refusalAt(record, t, c.tx, c.ty);
                if (why && SEAL.test(why)) { subject = { t, c, why }; break; }
            }
            if (subject) break;
        }
        expect(subject).not.toBeNull();
        // the CARVED model refuses it by name…
        expect(subject.why).toMatch(SEAL);
        // …and the OPEN model, given the identical record, template and cell,
        // does not — because the rule is off at `empty`.
        expect(open.refusalAt(record, subject.t, subject.c.tx, subject.c.ty)).toBeNull();
    });
});

describe('procgenSeedling — ⛔ THE ORDER, AND WHAT IS DERIVED FROM THE RULE', () => {
    it('the FOOTPRINT walk still runs FIRST — a border cell meets a sentence, not a flood', () => {
        // ⛓ Trap 255's shape, unchanged: `doorClear` throws off-domain, so the
        // footprint walk has to run before anything else. The flood is inserted
        // BETWEEN them, so an off-interior cell must still be refused by the
        // footprint sentence rather than reaching a flood that would read
        // outside the room.
        const model = seedlingModel({ seed: 3, skeleton: { kind: 'winding' } });
        const record = model.skeleton();
        const wall = INSTANCES.find((t) => t.name === 'wall-segment');
        const why = model.refusalAt(record, wall, 0, 0);
        expect(why).toMatch(/is not in the room's INTERIOR/);
        expect(why).not.toMatch(SEAL);
    });

    it('`legalAt` and `anchorsFor` INHERIT it — a sealing cell is never offered', () => {
        const model = seedlingModel({ seed: 3, skeleton: { kind: 'winding' } });
        const record = model.skeleton();
        const wall = INSTANCES.find((t) => t.name === 'wall-segment');
        const sealing = interiorCells(record).filter((c) => {
            const why = model.refusalAt(record, wall, c.tx, c.ty);
            return why !== null && SEAL.test(why);
        });
        expect(sealing.length).toBeGreaterThan(0);
        for (const c of sealing) expect(model.legalAt(record, wall, c.tx, c.ty)).toBe(false);
        const offered = model.anchorsFor(record, wall, rngFor(3), 64);
        for (const at of offered) {
            expect(sealing.some((c) => c.tx === at.tx && c.ty === at.ty)).toBe(false);
        }
    });
});
