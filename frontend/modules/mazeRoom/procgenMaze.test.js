/**
 * mazeRoom/procgenMaze.test — THE SECOND SUBSTRATE'S OWN CLAIMS.
 *
 * CONSTRUCTIVE-MODE arc, slice 2. The rows that are about the LOOP's seam and
 * can be asked of both bindings in the same words live in
 * `procgenCore/bindingContract.test.js`; what is here is what only the MAZE can
 * be asked — its world model's five refusals, its BFS oracle's three verdicts
 * and its certification, its v1 palette, and the CLI's two-process identity.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ATTEMPT, STOP, VERDICT } from '../procgenCore/levelGenerator.js';
import { defineTemplate } from '../procgenCore/templateContract.js';
import {
    TILE_FLOOR, TILE_WALL, getItem, getObstacle, getTile, setTile,
} from './mazeRoomEngine.js';
import {
    DEFAULT_MAZE_BUDGET, MAZE_DEFAULTS, MAZE_PALETTE, MazePlacementError, ProcgenMazeError,
    allCells, assertMazePalette, cloneWorld, generateMazeLevel, mazeModel, mazeOracle,
    serializeMazeLevel,
} from './procgenMaze.js';
import { rngFor } from './procgenRng.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CLI = join(REPO, 'scripts/procgen/generate-maze-level.mjs');

const rowOf = (name, values) => MAZE_PALETTE.templates
    .find((t) => t.name === name).instantiate(null, values);

/** Wall every neighbour of a cell — the sealed-room fixture. */
const sealOff = (world, x, y) => {
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
        setTile(world, nx, ny, TILE_WALL);
    }
    return world;
};

describe('the maze LEVEL MODEL', () => {
    it('the skeleton is the plain OPEN room — all floor, entrance at the corner, one exit '
        + 'at the goal', () => {
        const model = mazeModel({ seed: 1 });
        const w = model.skeleton();
        expect(w.width).toBe(MAZE_DEFAULTS.width);
        expect(w.height).toBe(MAZE_DEFAULTS.height);
        expect([...w.tiles].every((t) => t === TILE_FLOOR)).toBe(true);
        expect(w.entrance).toEqual({ x: 0, y: 0 });
        expect([...w.exits.values()]).toEqual([expect.objectContaining({
            exit_id: 'goal', x: model.goalCell.tx, y: model.goalCell.ty,
        })]);
        expect(w.obstacles.size).toBe(0);
        expect(w.items.size).toBe(0);
        // ⛔ …and the goal is never the entrance, or the room would solve in
        // zero steps and the control would be vacuous.
        expect(model.goalCell).not.toEqual({ tx: 0, ty: 0 });
    });

    /**
     * ⛓⛓⛓ ⚖ KICKOFF §3.4's DRAW ORDER, ASSERTED RATHER THAN DESCRIBED. The goal
     * is the ROOM stream's FIRST draw, which is what lets slice 5 drop a carver
     * in as a `skeleton()` kind without moving the goal: the carver draws AFTER
     * this, so the goal of seed s under kind K is the goal of seed s under the
     * open room, and this slice's seed→level pairs do not expire.
     */
    it('⛔ the goal is the room stream\'s FIRST draw — computed independently here', () => {
        for (const seed of [1, 2, 7, 12]) {
            const model = mazeModel({ seed });
            const independent = rngFor(seed).pick(
                allCells({ width: MAZE_DEFAULTS.width, height: MAZE_DEFAULTS.height })
                    .filter((c) => !(c.tx === 0 && c.ty === 0)),
            );
            expect(model.goalCell).toEqual(independent);
        }
    });

    it('two calls to `skeleton()` are INDEPENDENT worlds, not one shared mutable one', () => {
        const model = mazeModel({ seed: 4 });
        const a = model.skeleton();
        const b = model.skeleton();
        setTile(a, 3, 3, TILE_WALL);
        a.obstacles.set('1,1', 'door_red');
        expect(getTile(b, 3, 3)).toBe(TILE_FLOOR);
        expect(b.obstacles.size).toBe(0);
    });

    /**
     * ⛔⛔ THE SHUFFLE IS OVER THE WHOLE GRID, so the DRAW COUNT of one attempt
     * cannot depend on what earlier attempts kept. A shuffle over the FLOOR
     * cells would shrink as the room filled and make the stream a function of
     * the room's history — deterministic, but a different function of the seed,
     * and one that moves the day a bound changes.
     */
    it('⛔ one shuffle of the WHOLE grid per call — the draw count is the grid\'s size and '
        + 'nothing else', () => {
        const model = mazeModel({ seed: 9, width: 6, height: 6 });
        const row = rowOf('wall-segment', { ori: 'h', len: 1 });
        const empty = model.skeleton();
        const filled = model.skeleton();
        for (let i = 0; i < 20; i += 1) setTile(filled, i % 6, Math.floor(i / 6), TILE_WALL);

        const a = rngFor(9);
        const b = rngFor(9);
        const c = rngFor(9);
        model.anchorsFor(empty, row, a, 1);
        model.anchorsFor(empty, row, b, 12);
        model.anchorsFor(filled, row, c, 1);
        expect(a.draws).toBe(6 * 6 - 1);
        expect(b.draws).toBe(a.draws);
        expect(c.draws).toBe(a.draws);
    });

    it('`anchorsFor` returns [] when the whole grid refuses, rather than throwing', () => {
        const model = mazeModel({ seed: 3, width: 4, height: 4 });
        const world = model.skeleton();
        for (const c of allCells(world)) setTile(world, c.tx, c.ty, TILE_WALL);
        expect(model.anchorsFor(world, rowOf('wall-segment', { ori: 'h', len: 1 }),
            rngFor(3), 5)).toEqual([]);
    });

    /**
     * ⛔ FIVE CLAIMS, ASKED SEPARATELY AND NAMED SEPARATELY. The last two are the
     * ones a tile check cannot make: a `door-key` writes an obstacle onto a cell
     * whose TILE it never touches, so a later candidate would find `TILE_FLOOR`
     * there and happily paint a wall over somebody's door.
     */
    it('`refusalAt` names WHICH claim failed, in the model\'s own words', () => {
        const model = mazeModel({ seed: 6, width: 5, height: 5 });
        const row = rowOf('wall-segment', { ori: 'h', len: 1 });
        const world = model.skeleton();
        const g = model.goalCell;

        expect(model.refusalAt(world, row, -1, 0)).toMatch(/is not on the 5x5 grid/);
        expect(model.refusalAt(world, row, 0, 0)).toMatch(/is the ENTRANCE cell/);
        expect(model.refusalAt(world, row, g.tx, g.ty)).toMatch(/is the GOAL cell/);

        const free = allCells(world).find((c) => model.legalAt(world, row, c.tx, c.ty));
        setTile(world, free.tx, free.ty, TILE_WALL);
        expect(model.refusalAt(world, row, free.tx, free.ty))
            .toMatch(/is not untouched FLOOR — an earlier template walled it/);

        const other = allCells(world).find((c) => model.legalAt(world, row, c.tx, c.ty));
        world.obstacles.set(`${other.tx},${other.ty}`, 'door_red');
        expect(model.refusalAt(world, row, other.tx, other.ty))
            .toMatch(/already carries the obstacle "door_red"/);
        world.obstacles.clear();
        world.items.set(`${other.tx},${other.ty}`, 'key_red');
        expect(model.refusalAt(world, row, other.tx, other.ty))
            .toMatch(/already carries the item "key_red"/);
    });

    it('a CLEARANCE cell is refused under its own label, not the footprint\'s', () => {
        const model = mazeModel({ seed: 6, width: 5, height: 5 });
        const world = model.skeleton();
        const row = { name: 'probe', instance: 'probe', footprint: [{ dx: 0, dy: 0 }],
            clearance: [{ dx: 0, dy: -1 }] };
        // (2,0)'s clearance cell is (2,-1) — off the grid.
        expect(model.refusalAt(world, row, 2, 0)).toMatch(/needs CLEARANCE cell/);
        expect(model.refusalAt(world, row, 2, 2)).toBeNull();
    });

    /**
     * ⛔⛔ ⚖ §1.2's ATOMIC PLACEMENT, AND THE MAZE'S OWN MUTABILITY TRAP. The
     * loop's REVERT is "keep the old record" and there is no undo, so a `place`
     * that wrote in place would leave every rejected candidate standing.
     * `bindingContract.test.js` asks the shared half of this; here it is asked
     * of every mutable container the maze world has.
     */
    it('⛔ `place` writes the door AND its key together, into a CLONE', () => {
        const model = mazeModel({ seed: 8 });
        const world = model.skeleton();
        const row = rowOf('door-key', { dir: 'E', dist: 2 });
        const at = { tx: 3, ty: 3 };
        expect(model.refusalAt(world, row, at.tx, at.ty)).toBeNull();
        const next = model.place(world, row, at);

        expect(getObstacle(next, 3, 3)).toBe('door_red');
        expect(getItem(next, 5, 3)).toBe('key_red');
        // ⛔ …and NOTHING of it landed in the input world.
        expect(next).not.toBe(world);
        expect(next.tiles).not.toBe(world.tiles);
        expect(next.obstacles).not.toBe(world.obstacles);
        expect(next.items).not.toBe(world.items);
        expect(next.exits).not.toBe(world.exits);
        expect(world.obstacles.size).toBe(0);
        expect(world.items.size).toBe(0);
    });

    it('⛔ the clone does not carry the engine\'s lazy `_exitsByPos` cache', () => {
        const model = mazeModel({ seed: 8 });
        const world = model.skeleton();
        world._exitsByPos = new Map([['999,999', { exit_id: 'lie' }]]);
        expect(cloneWorld(world)).not.toHaveProperty('_exitsByPos');
    });

    it('`place` refuses an off-grid write and a DOUBLED write BY NAME', () => {
        const model = mazeModel({ seed: 8, width: 5, height: 5 });
        const world = model.skeleton();
        expect(() => model.place(world, rowOf('wall-segment', { ori: 'h', len: 3 }),
            { tx: 4, ty: 2 })).toThrow(MazePlacementError);
        expect(() => model.place(world, rowOf('wall-segment', { ori: 'h', len: 3 }),
            { tx: 4, ty: 2 })).toThrow(/off the 5x5 grid/);

        const doubled = { name: 'doubled', instance: 'doubled',
            footprint: [{ dx: 0, dy: 0 }],
            tiles: [{ dx: 0, dy: 0, tile: TILE_WALL }, { dx: 0, dy: 0, tile: TILE_FLOOR }] };
        expect(() => model.place(world, doubled, { tx: 2, ty: 2 }))
            .toThrow(/writes a tile at \(2,2\) TWICE/);
    });

    it('⛔ a template that writes NOTHING refuses — it would be kept and reported as an '
        + 'obstacle', () => {
        const model = mazeModel({ seed: 8 });
        const empty = { name: 'nothing', instance: 'nothing', footprint: [{ dx: 0, dy: 0 }] };
        expect(() => model.place(model.skeleton(), empty, { tx: 2, ty: 2 }))
            .toThrow(/wrote NOTHING/);
    });
});

describe('the maze ORACLE', () => {
    const modelFor = (seed, w = 7, h = 7) => mazeModel({ seed, width: w, height: h });

    it('the open room SOLVES, and the verdict is certified by REPLAYING the plan', () => {
        const model = modelFor(2);
        const oracle = mazeOracle({ model });
        const out = oracle.solve(model.skeleton());
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.plan.length).toBe(out.ticks);
        expect(out.certification.steps).toBe(out.plan.length);
        expect(out.certification.endedAt).toEqual({ x: model.goalCell.tx, y: model.goalCell.ty });
        expect(out.classifiedBy).toMatch(/REPLAYED through `step`/);
        expect(out.reasonText).toBeNull();
        // ⛓ the manhattan distance is the shortest path in an empty room — an
        // INDEPENDENT answer, so the plan length is checked against arithmetic
        // rather than against the solver that produced it.
        expect(out.ticks).toBe(model.goalCell.tx + model.goalCell.ty);
    });

    it('a SEALED goal is REFUSED, with the entrance, the goal and the search size named', () => {
        const model = modelFor(2);
        const world = sealOff(model.skeleton(), model.goalCell.tx, model.goalCell.ty);
        const out = mazeOracle({ model }).solve(world);
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.ticks).toBeNull();
        expect(out.plan).toBeNull();
        expect(out.certification).toBeNull();
        expect(out.reasonText).toMatch(/^no route from the entrance \(0,0\) to the goal /);
        expect(out.reasonText).toMatch(/exhausted every reachable state after \d+ expansion/);
        expect(out.reasonText).toMatch(/wall tile\(s\)/);
        expect(out.budgetKind).toBeNull();
    });

    /**
     * ⛓ THE ATOMIC PLACEMENT'S POINT, DRIVEN: the door and its key are one
     * placement, and WHICH SIDE the key lands on is what decides the verdict.
     * A key the walk can reach first SOLVES; a key sealed behind its own door
     * REFUSES. ⛔ This is also what makes the loop depth-1: no candidate ever
     * needs a SECOND cooperating placement to become solvable.
     */
    it('a key the walk reaches first SOLVES and the records carry the pickup; a key sealed '
        + 'behind its own door REFUSES', () => {
        // ⛓ A 4x2 room whose bottom row is walled IS a 4x1 corridor, and the
        // corridor is what makes the claim sharp: with only one route, WHICH
        // SIDE the key lands on is the whole verdict. (`createWorld` refuses a
        // room under 2x2, so the strip is built rather than declared; seed 12
        // is the first whose goal draw lands on the far end of the top row.)
        //
        // ⚠ AND THE KEY IS AT (1,0), NOT ON THE ENTRANCE. `step` grants an item
        // on ARRIVAL, so a key sitting under the player's starting feet is
        // never collected — which is one more reason the model refuses the
        // ENTRANCE cell as an anchor: that rule is not only about geometry, it
        // also keeps the palette from placing a clearer nothing can pick up.
        const model = mazeModel({ seed: 12, width: 4, height: 2 });
        expect(model.goalCell).toEqual({ tx: 3, ty: 0 });
        const strip = () => {
            const w = model.skeleton();
            for (let x = 0; x < 4; x += 1) setTile(w, x, 1, TILE_WALL);
            return w;
        };
        const open = strip();
        open.obstacles.set('2,0', 'door_red');
        open.items.set('1,0', 'key_red');                    // between the start and the door
        const solved = mazeOracle({ model }).solve(open);
        expect(solved.verdict).toBe(VERDICT.SOLVED);
        expect(solved.certification.collected).toEqual(['key_red']);
        expect(solved.records.map((r) => r.type)).toContain('exit_cross');

        const sealed = strip();
        sealed.obstacles.set('2,0', 'door_red');
        sealed.items.set('3,0', 'key_red');                  // beyond the door it opens
        const refused = mazeOracle({ model }).solve(sealed);
        expect(refused.verdict).toBe(VERDICT.REFUSED);
        expect(refused.reasonText).toMatch(/door_red@\(2,0\)/);
        expect(refused.reasonText).toMatch(/key_red@\(3,0\)/);
    });

    /**
     * ⛔ BUDGET_EXHAUSTED IS A CLASS SOMEBODY CAN REACH. `makeBfsSolver` has a
     * real node cap (`options.budget`), so this verdict is READ off the solver
     * rather than invented — and it is driven here with a deliberately tiny cap
     * so it is not a verdict that exists only in a docblock.
     *
     * ⚠ AND THE DEFAULT NEVER BINDS, which is stated as a bound rather than
     * left to be discovered: the whole state space of the default room is
     * `121 x 2 = 242` states.
     */
    it('a tiny expansion cap is BUDGET_EXHAUSTED — a claim about the SEARCH, named as one',
        () => {
            const model = modelFor(2);
            const out = mazeOracle({ model, budget: { maxExpansions: 1 } })
                .solve(model.skeleton());
            expect(out.verdict).toBe(VERDICT.BUDGET_EXHAUSTED);
            expect(out.budgetKind).toBe('maxExpansions');
            expect(out.classifiedBy).toMatch(/never a proof that the level is unsolvable/);
            expect(out.reasonText).toMatch(/budget of 1 expansion\(s\)/);
            // …and the same world at the default budget solves, so the tiny cap
            // is what produced the verdict and not the world.
            expect(mazeOracle({ model }).solve(model.skeleton()).verdict).toBe(VERDICT.SOLVED);
            expect(DEFAULT_MAZE_BUDGET.maxExpansions).toBeGreaterThan(
                MAZE_DEFAULTS.width * MAZE_DEFAULTS.height * 2,
            );
        });

    it('refuses a budget that is not a positive integer BY NAME', () => {
        const model = modelFor(2);
        expect(() => mazeOracle({ model, budget: { maxExpansions: 0 } }))
            .toThrow(ProcgenMazeError);
        expect(() => mazeOracle({ model, budget: { maxExpansions: -1 } }))
            .toThrow(/no value meaning "unbounded"/);
    });

    it('a starting inventory opens a door the world holds no key for', () => {
        const model = mazeModel({ seed: 12, width: 4, height: 2 });
        const world = model.skeleton();
        for (let x = 0; x < 4; x += 1) setTile(world, x, 1, TILE_WALL);
        world.obstacles.set('2,0', 'door_red');
        expect(mazeOracle({ model }).solve(world).verdict).toBe(VERDICT.REFUSED);
        expect(mazeOracle({ model, items: ['key_red'] }).solve(world).verdict)
            .toBe(VERDICT.SOLVED);
    });
});

describe('the maze PALETTE v1', () => {
    it('passes its own structural assertion at load and on demand', () => {
        expect(assertMazePalette()).toBe(true);
        expect(MAZE_PALETTE.items).toBeNull();
    });

    it('every `wall-segment` instantiation paints only TILE_WALL, inside its footprint', () => {
        for (const ori of ['h', 'v']) {
            for (const len of [1, 2, 3]) {
                const t = rowOf('wall-segment', { ori, len });
                expect(t.instance).toBe(`wall-segment(ori=${ori},len=${len})`);
                expect(t.footprint).toHaveLength(len);
                expect(t.tiles.every((w) => w.tile === TILE_WALL)).toBe(true);
                expect(t.tiles).toHaveLength(len);
                expect(t.obstacles ?? []).toHaveLength(0);
                expect(t.items ?? []).toHaveLength(0);
                for (const w of t.tiles) {
                    expect(t.footprint.some((c) => c.dx === w.dx && c.dy === w.dy)).toBe(true);
                }
            }
        }
    });

    it('every `door-key` instantiation carries BOTH halves, each in the footprint', () => {
        for (const dir of ['N', 'S', 'E', 'W']) {
            for (const dist of [1, 2, 3]) {
                const t = rowOf('door-key', { dir, dist });
                expect(t.footprint).toHaveLength(2);
                expect(t.obstacles).toEqual([expect.objectContaining({ dx: 0, dy: 0,
                    id: 'door_red' })]);
                expect(t.items).toHaveLength(1);
                expect(t.items[0].id).toBe('key_red');
                expect(Math.abs(t.items[0].dx) + Math.abs(t.items[0].dy)).toBe(dist);
                for (const w of [...t.obstacles, ...t.items]) {
                    expect(t.footprint.some((c) => c.dx === w.dx && c.dy === w.dy)).toBe(true);
                }
            }
        }
    });

    const bad = (build) => ({ name: 'bad', templates: [defineTemplate({
        name: 'bad', family: 'bad', why: 'a fixture', build,
    })] });

    it('refuses a write outside its own footprint — the legality check reserved the '
        + 'footprint', () => {
        expect(() => assertMazePalette(bad(() => ({
            footprint: [{ dx: 0, dy: 0 }],
            tiles: [{ dx: 5, dy: 5, tile: TILE_WALL }],
        })))).toThrow(/not in its own footprint/);
    });

    /**
     * ⛔ THE ONE THAT MATTERS MOST, and its reason is in the refusal:
     * `isObstacleCleared` treats an UNKNOWN obstacle id as "no gate" and
     * returns TRUE, so a typo would place a door that opens for everybody —
     * a gate that does not gate, kept by every solve, invisible in every trace.
     */
    it('refuses an obstacle id the library does not hold — an unknown id is a gate that '
        + 'does not gate', () => {
        expect(() => assertMazePalette(bad(() => ({
            footprint: [{ dx: 0, dy: 0 }],
            obstacles: [{ dx: 0, dy: 0, id: 'door_taupe' }],
        })))).toThrow(/a gate that does not gate/);
        expect(() => assertMazePalette(bad(() => ({
            footprint: [{ dx: 0, dy: 0 }],
            items: [{ dx: 0, dy: 0, id: 'key_taupe' }],
        })))).toThrow(/the item library does not hold/);
    });

    it('refuses a tile value outside the grid vocabulary, and a doubled footprint cell', () => {
        expect(() => assertMazePalette(bad(() => ({
            footprint: [{ dx: 0, dy: 0 }],
            tiles: [{ dx: 0, dy: 0, tile: 7 }],
        })))).toThrow(/an Int8Array value nothing reads/);
        expect(() => assertMazePalette(bad(() => ({
            footprint: [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }],
        })))).toThrow(/twice in its footprint/);
        expect(() => assertMazePalette(bad(() => ({ footprint: [] }))))
            .toThrow(/empty footprint/);
    });
});

describe('generateMazeLevel — the whole seam, wired', () => {
    it('generates, and the record holds exactly what the summary says it kept', () => {
        const out = generateMazeLevel({ seed: 1 });
        expect(out.summary.stop).toBe(STOP.TARGET_REACHED);
        expect(out.summary.keptCount).toBe(6);
        for (const k of out.summary.kept) {
            const row = MAZE_PALETTE.templates.find((t) => t.name === k.template)
                .instantiate(null, k.params);
            for (const w of row.tiles ?? []) {
                expect(getTile(out.record, k.at.tx + w.dx, k.at.ty + w.dy)).toBe(w.tile);
            }
            for (const o of row.obstacles ?? []) {
                expect(getObstacle(out.record, k.at.tx + o.dx, k.at.ty + o.dy)).toBe(o.id);
            }
            for (const i of row.items ?? []) {
                expect(getItem(out.record, k.at.tx + i.dx, k.at.ty + i.dy)).toBe(i.id);
            }
        }
        // ⛔ …and NOTHING ELSE is in the world: a reverted candidate that had
        // been written in place would show up here as an extra overlay.
        const kept = out.summary.kept.flatMap((k) => MAZE_PALETTE.templates
            .find((t) => t.name === k.template).instantiate(null, k.params).obstacles ?? []);
        expect(out.record.obstacles.size).toBe(kept.length);
    });

    /**
     * ⛓ THE REVERT PATH IS REACHED, AND IT IS REACHED ON PURPOSE. On the 11x11
     * default the v1 palette is nearly free — six small obstacles do not
     * constrain an open room, and seeds 1..12 revert nothing. A small room at a
     * high target is where the loop's own no is exercised; the yield table
     * (slice 6) is where that observation becomes a measurement rather than a
     * fixture choice.
     */
    it('a small room at a high target REVERTS, and every reverted row carries the ORACLE\'s '
        + 'own text', () => {
        const out = generateMazeLevel({ seed: 4, width: 5, height: 5,
            bounds: { obstacleTarget: 12, triesPerStep: 8, saturationK: 3 } });
        const reverted = out.trace.filter((r) => r.outcome === ATTEMPT.REVERTED);
        expect(reverted.length).toBeGreaterThan(0);
        for (const r of reverted) {
            expect(r.verdict).toBe(VERDICT.REFUSED);
            expect(r.reasonText).toMatch(/^no route from the entrance/);
        }
        const noAnchor = out.trace.filter((r) => r.outcome === ATTEMPT.NO_ANCHOR);
        expect(noAnchor.length).toBeGreaterThan(0);
        for (const r of noAnchor) {
            expect(r.anchorsOffered).toBe(0);
            expect(r.verdict).toBeNull();
        }
        /**
         * ⛔⛔ AND NOTHING A REVERT THREW AWAY IS STILL IN THE WORLD. ⛓ This
         * assertion lives HERE and not on the 11x11 default run, and the
         * placement is the point: at the default the v1 palette reverts
         * NOTHING, so the same check there passes whether `place` clones or
         * not — a fixture that cannot distinguish the two builds. (Measured:
         * the clone-forgetting mutant leaves this run's world holding more
         * than it kept, and leaves the 11x11 run's world exactly right.)
         */
        const keptWalls = out.summary.kept
            .map((k) => MAZE_PALETTE.templates.find((t) => t.name === k.template)
                .instantiate(null, k.params))
            .reduce((n, row) => n + (row.tiles ?? []).length, 0);
        let walls = 0;
        for (const t of out.record.tiles) if (t === TILE_WALL) walls += 1;
        expect(walls).toBe(keptWalls);
    });

    it('SATURATION is reachable and is reported BY NAME, never as a quiet short run', () => {
        const out = generateMazeLevel({ seed: 5, width: 4, height: 4,
            bounds: { obstacleTarget: 8, triesPerStep: 8, saturationK: 3 } });
        expect(out.summary.stop).toBe(STOP.SATURATED);
        expect(out.summary.keptCount).toBeLessThan(8);
    });

    it('the level SOLVES at the end — the loop only ever keeps a room that still completes',
        () => {
            for (const seed of [1, 5, 9]) {
                const out = generateMazeLevel({ seed });
                const verdict = mazeOracle({ model: out.model }).solve(out.record);
                expect(verdict.verdict).toBe(VERDICT.SOLVED);
                expect(verdict.ticks).toBe(out.summary.finalTicks);
            }
        });

    it('`serializeMazeLevel` is stable and sorted — the CLI\'s determinism channel', () => {
        const a = generateMazeLevel({ seed: 3 });
        const b = generateMazeLevel({ seed: 3 });
        expect(JSON.stringify(serializeMazeLevel(a.record)))
            .toBe(JSON.stringify(serializeMazeLevel(b.record)));
        const s = serializeMazeLevel(a.record);
        expect(s.tiles).toHaveLength(s.width * s.height);
        for (const list of [s.obstacles, s.items]) {
            const keys = list.map((e) => e.y * s.width + e.x);
            expect(keys).toEqual([...keys].sort((x, y) => x - y));
        }
    });
});

/**
 * ⛔ TWO PROCESSES, NOT TWO CALLS. One process proves the generator is a
 * function; two prove it depends on nothing the process carries — an import
 * order, a module-level cache, a `Date.now()` somebody added.
 */
describe('the CLI is byte-identical across two processes', () => {
    const md5 = (s) => createHash('md5').update(s).digest('hex');
    // ⛔ stderr is IGNORED, not merged: it is the CLI's non-determinism channel
    // (the timing line), and folding it into what this test compares would make
    // the identity check fail on a slow box for a reason that is not drift.
    const runCli = (args) => execFileSync(process.execPath, [CLI, ...args],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

    it('seeds 1..12 at count 4 reproduce byte for byte', () => {
        for (let seed = 1; seed <= 12; seed += 1) {
            const args = [`--seed=${seed}`, '--count=4', '--json'];
            const a = runCli(args);
            const b = runCli(args);
            expect(md5(a), `seed ${seed} drifted between two processes`).toBe(md5(b));
            expect(JSON.parse(a).seed).toBe(seed);
        }
    }, 60000);

    it('`--verify` reports the identity itself', () => {
        expect(runCli(['--seed=7', '--count=4', '--verify']))
            .toMatch(/^two-process identity at seed 7: IDENTICAL, \d+ bytes, md5 [0-9a-f]{32}$/m);
    }, 30000);
});
