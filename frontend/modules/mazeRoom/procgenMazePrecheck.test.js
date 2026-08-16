/**
 * mazeRoom/procgenMazePrecheck.test — **THE CONNECTIVITY PRE-CHECK, ON THE
 * MAZE BINDING.**
 *
 * CONSTRUCTIVE-MODE arc, slice 6 (kickoff §3.6 item 2). The FLOOD is gated
 * substrate-free in `procgenCore/gridFlood.test.js` and Seedling's half in
 * `seedlingDemo/procgenSeedlingPrecheck.test.js`; what is here is what only the
 * maze can be asked — that a `door-key` is NEVER sealed by it (obstacles are the
 * ORACLE's question) while a `wall-segment` across the same corridor is, that
 * the rule is KIND-SCOPED, and that the ORACLE agrees with every refusal the
 * rule makes.
 *
 * ⛓⛓ THE MAZE IS WHERE THE PRE-CHECK CAN BE CHECKED AGAINST A **COMPLETE**
 * ORACLE. Seedling's solver is a heuristic, so "the rule refused it and the
 * oracle would have too" is only ever evidence there. The maze's BFS is exact
 * over `cells x 2^items`, so this file drives the strongest form of the claim
 * available anywhere in the arc: **every candidate the rule refuses, the oracle
 * also refuses** — the soundness argument, measured rather than argued.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_SKELETON_KIND } from '../procgenCore/skeletonKinds.js';
import { enumerateValues } from '../procgenCore/templateContract.js';
import {
    MAZE_PALETTE, MAZE_SKELETON_KINDS, allCells, mazeModel, mazeOracle,
} from './procgenMaze.js';
import { TILE_FLOOR, getTile } from './mazeRoomEngine.js';
import { rngFor } from './procgenRng.js';

const CARVING = MAZE_SKELETON_KINDS.filter((k) => k !== DEFAULT_SKELETON_KIND);
const INSTANCES = MAZE_PALETTE.templates
    .flatMap((base) => enumerateValues(base).map((v) => base.instantiate(null, v)));

const SEAL = /would SEAL the room/;

/**
 * ⛓ THE INDEPENDENT ANSWER — a second flood, written from the rule's english
 * and in a different shape from `gridFlood.js` (a `Set` frontier over string
 * keys, not a typed index), so an indexing defect cannot be shared.
 */
const independentlyConnected = (world, writes, from, to) => {
    const painted = new Map(writes.map((w) => [`${w.x},${w.y}`, w.tile]));
    const walkable = (x, y) => {
        if (x < 0 || y < 0 || x >= world.width || y >= world.height) return false;
        return (painted.get(`${x},${y}`) ?? getTile(world, x, y)) === TILE_FLOOR;
    };
    if (!walkable(from.x, from.y) || !walkable(to.x, to.y)) return false;
    const seen = new Set([`${from.x},${from.y}`]);
    let frontier = [{ ...from }];
    while (frontier.length) {
        const next = [];
        for (const p of frontier) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const q = { x: p.x + dx, y: p.y + dy };
                const key = `${q.x},${q.y}`;
                if (seen.has(key) || !walkable(q.x, q.y)) continue;
                if (q.x === to.x && q.y === to.y) return true;
                seen.add(key);
                next.push(q);
            }
        }
        frontier = next;
    }
    return false;
};

const writesOf = (template, tx, ty) => (template.tiles ?? [])
    .map((w) => ({ x: tx + w.dx, y: ty + w.dy, tile: w.tile }));

const footprintFree = (model, world, template, tx, ty) => [
    ...(template.footprint ?? []), ...(template.clearance ?? []),
].every((c) => model.isFree(world, tx + c.dx, ty + c.dy));

describe('procgenMaze — the connectivity pre-check refuses a sealing candidate BY NAME', () => {
    it('names the rule, the entrance, the goal, the tile count and the KIND SCOPE', () => {
        const model = mazeModel({ seed: 3, skeleton: { kind: 'winding' } });
        const world = model.skeleton();
        const wall = INSTANCES.find((t) => t.name === 'wall-segment');
        const hit = allCells(world)
            .map((c) => ({ c, why: model.refusalAt(world, wall, c.tx, c.ty) }))
            .find((r) => r.why !== null && SEAL.test(r.why));
        expect(hit).toBeDefined();
        expect(hit.why).toMatch(/^"[^"]+" at \(\d+,\d+\): its TERRAIN would SEAL the room/);
        expect(hit.why).toMatch(/no floor path from the ENTRANCE \(0,0\) to the GOAL \(\d+,\d+\)/);
        expect(hit.why).toMatch(/once the \d+ wall tile\(s\) it writes are painted/);
        expect(hit.why).toMatch(/skeleton "winding".*at "empty" this rule is off/);
    });

    it('⛔⛔ a `door-key` is NEVER sealed by it — obstacles and items are the ORACLE\'s', () => {
        // ⛓ §12.10's asymmetry is the thing this protects: on a corridor the
        // maze KEEPS every door-key and REVERTS every wall-segment. A flood
        // that treated a door as a wall would refuse the one template the
        // substrate is good at.
        let doorCells = 0;
        for (const kind of CARVING) {
            for (let seed = 1; seed <= 4; seed += 1) {
                const model = mazeModel({ seed, skeleton: { kind } });
                const world = model.skeleton();
                for (const t of INSTANCES.filter((i) => i.name === 'door-key')) {
                    for (const c of allCells(world)) {
                        const why = model.refusalAt(world, t, c.tx, c.ty);
                        if (why) expect(`${kind}/${seed} ${t.instance}: ${why}`).not.toMatch(SEAL);
                        if (why === null) doorCells += 1;
                    }
                }
            }
        }
        expect(doorCells).toBeGreaterThan(0);
    });

    it('…while a `wall-segment` across the same corridor IS refused', () => {
        const sealed = [];
        const wall = INSTANCES.find((t) => t.name === 'wall-segment');
        for (const kind of CARVING) {
            for (let seed = 1; seed <= 4; seed += 1) {
                const model = mazeModel({ seed, skeleton: { kind } });
                const world = model.skeleton();
                for (const c of allCells(world)) {
                    const why = model.refusalAt(world, wall, c.tx, c.ty);
                    if (why && SEAL.test(why)) sealed.push(`${kind}/${seed}@${c.tx},${c.ty}`);
                }
            }
        }
        expect(sealed.length).toBeGreaterThan(0);
    });
});

describe('procgenMaze — ⛓⛓ THE DIFFERENTIAL, and the ORACLE as the second opinion', () => {
    it('agrees with an INDEPENDENT flood on every cell x every row x four seeds', () => {
        let compared = 0;
        let sealedCases = 0;
        for (const kind of CARVING) {
            for (let seed = 1; seed <= 4; seed += 1) {
                const model = mazeModel({ seed, skeleton: { kind } });
                const world = model.skeleton();
                for (const t of INSTANCES) {
                    for (const c of allCells(world)) {
                        if (!footprintFree(model, world, t, c.tx, c.ty)) continue;
                        const writes = writesOf(t, c.tx, c.ty);
                        const blocking = writes.filter((w) => w.tile !== TILE_FLOOR).length;
                        const stillOpen = blocking === 0 || independentlyConnected(
                            world, writes, world.entrance,
                            { x: model.goalCell.tx, y: model.goalCell.ty },
                        );
                        const why = model.refusalAt(world, t, c.tx, c.ty) ?? '';
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
        expect(compared).toBeGreaterThan(1000);
        expect(sealedCases).toBeGreaterThan(50);
    });

    it('⛔⛔ SOUNDNESS, MEASURED: every candidate the rule refuses, the EXACT BFS also refuses', () => {
        const oracle = (model) => mazeOracle({ model, items: MAZE_PALETTE.items ?? null });
        let checked = 0;
        for (const kind of ['winding', 'branchy']) {
            for (let seed = 1; seed <= 3; seed += 1) {
                const model = mazeModel({ seed, skeleton: { kind } });
                const world = model.skeleton();
                const o = oracle(model);
                for (const t of INSTANCES.filter((i) => i.name === 'wall-segment')) {
                    for (const c of allCells(world)) {
                        if (!footprintFree(model, world, t, c.tx, c.ty)) continue;
                        const why = model.refusalAt(world, t, c.tx, c.ty);
                        if (!why || !SEAL.test(why)) continue;
                        // ⛔ `place` still works on a REFUSED anchor — legality
                        // is the model's rule, not `place`'s — so the oracle can
                        // be asked what it WOULD have said.
                        const out = o.solve(model.place(world, t, { tx: c.tx, ty: c.ty }));
                        expect(`${kind}/${seed}@${c.tx},${c.ty}: ${out.verdict}`)
                            .toBe(`${kind}/${seed}@${c.tx},${c.ty}: REFUSED`);
                        checked += 1;
                    }
                }
            }
        }
        expect(checked).toBeGreaterThan(20);
    });
});

describe('procgenMaze — ⛔ THE RULE IS KIND-SCOPED (⚖ §6.2 default)', () => {
    it('⛓⛓ THE DISCRIMINATING SUBJECT: ONE world, ONE template, ONE cell, TWO models', () => {
        /**
         * ⛔ A fixture has to distinguish two builds. "The open room never
         * seals" is NOT that fixture on the maze — §9.6's 5x5 and 4x4 rooms are
         * small enough that a `wall-segment` CAN seal an open room, which is
         * exactly why the scope exists. The subject that isolates the scope
         * variable is the carved world handed to BOTH models: ⚖ §3.4's draw
         * order makes the goal of seed s identical under every kind, so the two
         * differ in nothing else.
         */
        const carved = mazeModel({ seed: 3, skeleton: { kind: 'winding' } });
        const open = mazeModel({ seed: 3 });
        expect(open.goalCell).toEqual(carved.goalCell);
        expect(open.skeletonKind).toBe(DEFAULT_SKELETON_KIND);

        const world = carved.skeleton();
        const wall = INSTANCES.find((t) => t.name === 'wall-segment');
        const hit = allCells(world)
            .map((c) => ({ c, why: carved.refusalAt(world, wall, c.tx, c.ty) }))
            .find((r) => r.why !== null && SEAL.test(r.why));
        expect(hit).toBeDefined();
        expect(open.refusalAt(world, wall, hit.c.tx, hit.c.ty)).toBeNull();
    });

    it('⛓ a 3x3 OPEN ROOM can be sealed by ONE template and is NOT refused — the scope, at '
        + 'the only size where it can be seen', () => {
        /**
         * ⛓⛓ **THE SIZE IS A MEASUREMENT, NOT A GUESS**, and the measurement
         * overturned the brief's own suggestion. Slice 6 scanned every open
         * room from 2x2 to 11x11 over seeds 1..40 for a SINGLE palette row that
         * seals it:
         *
         *     2x2  0 · **3x3  29** · 4x4  0 · 5x5  0 · 6x6  0 · 7x7  0 · 11x11  0
         *
         * ⇒ §9.6's saturation at 4x4 is an ACCUMULATION effect (target 8 on a
         * 16-cell room), not a one-template one, so a 4x4 or 5x5 fixture here
         * would be INERT against the "drop the kind scope" mutant. 3x3 is the
         * only width at which one `wall-segment(len=3)` spans the room, and it
         * is therefore the only open-room subject that can tell the two builds
         * apart.
         */
        let sealableOpenCells = 0;
        // ⚠ EVERY `wall-segment` INSTANCE, not the first: only `len=3` spans a
        // 3x3 room, and a fixture that swept `len=1` alone would be green about
        // a rule it never reached.
        const walls = INSTANCES.filter((t) => t.name === 'wall-segment');
        for (let seed = 1; seed <= 8; seed += 1) {
            const model = mazeModel({ seed, width: 3, height: 3 });
            const world = model.skeleton();
            for (const wall of walls) {
                for (const c of allCells(world)) {
                    if (!footprintFree(model, world, wall, c.tx, c.ty)) continue;
                    const writes = writesOf(wall, c.tx, c.ty);
                    const open = independentlyConnected(world, writes, world.entrance,
                        { x: model.goalCell.tx, y: model.goalCell.ty });
                    if (open) continue;
                    sealableOpenCells += 1;
                    // ⛔ SEALED, AND STILL LEGAL — because the room is `empty`.
                    expect(model.refusalAt(world, wall, c.tx, c.ty)).toBeNull();
                }
            }
        }
        expect(sealableOpenCells).toBeGreaterThan(0);
    });
});

describe('procgenMaze — ⛔ THE ORDER, AND WHAT IS DERIVED FROM THE RULE', () => {
    it('the FOOTPRINT walk still runs FIRST — an off-grid cell meets a sentence, not a flood', () => {
        const model = mazeModel({ seed: 3, skeleton: { kind: 'winding' } });
        const world = model.skeleton();
        const wall = INSTANCES.find((t) => t.name === 'wall-segment');
        const why = model.refusalAt(world, wall, world.width - 1, world.height - 1);
        expect(why).toMatch(/needs FOOTPRINT cell/);
        expect(why).not.toMatch(SEAL);
    });

    it('`legalAt` and `anchorsFor` INHERIT it — a sealing cell is never offered', () => {
        const model = mazeModel({ seed: 3, skeleton: { kind: 'winding' } });
        const world = model.skeleton();
        const wall = INSTANCES.find((t) => t.name === 'wall-segment');
        const sealing = allCells(world).filter((c) => {
            const why = model.refusalAt(world, wall, c.tx, c.ty);
            return why !== null && SEAL.test(why);
        });
        expect(sealing.length).toBeGreaterThan(0);
        for (const c of sealing) expect(model.legalAt(world, wall, c.tx, c.ty)).toBe(false);
        for (const at of model.anchorsFor(world, wall, rngFor(3), 121)) {
            expect(sealing.some((c) => c.tx === at.tx && c.ty === at.ty)).toBe(false);
        }
    });
});
