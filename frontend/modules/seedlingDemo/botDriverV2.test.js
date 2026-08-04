/**
 * botDriverV2 — the pathing driver, and the fixtures it synthesized.
 *
 * The verification doctrine is v1's, and it is the reason this suite is
 * worth reading: **the driver's own running state proves nothing.** Every
 * arrival claim below is re-checked by running the EMITTED TAPE back
 * through `runTape` — a separate consumer of the same physics — and the
 * committed fixtures are then checked against the real game's recordings in
 * `tapeRunner.test.js`. A planner that quietly disagreed with the engine
 * would still report success to itself; it would fail here.
 *
 * The second thing this suite exists for is the claim the `thread-the-gap`
 * fixture MAKES: that a straight line to its target does not work. That is
 * asserted, not described — a pathing fixture whose target is reachable in
 * a straight line witnesses nothing about pathing.
 */

import { describe, expect, it } from 'vitest';

import { loadExpectation, loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';

/** Real level records, for the R1 pit-exit block at the bottom. */
const levelRecord = atlasLevelSource();
import { RELAXED_ROLES, buildLevelWorld } from './levelWorld.js';
import { spawnFromBoot } from './playerPhysicsV1.js';
import { playerBoxAt, terrainProbeRect } from './playerPhysicsV2.js';
import { runTape, runTapeToStream } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { DEFAULT_TOLERANCE } from './botDriverV1.js';
import {
    climbsArmedWaterfall,
    isWalkableTile,
    planTilePath,
    planWaypoints,
    plannerObstacleAt,
    controllerPathClear,
    synthesizeLegs,
    synthesizeWalk,
    tileAt,
    tileCentre,
    PRESS_GAP,
} from './botDriverV2.js';

const levelSource = atlasLevelSource();
const level0 = buildLevelWorld(levelSource(0));
const level94 = buildLevelWorld(levelSource(94));
const SPAWN = spawnFromBoot({ x: 80, y: 128 });

/** Replay an emitted tape independently and return the observation stream. */
const replay = (tape) => runTapeToStream(tape, { levelSource });

describe('tile helpers', () => {
    it('a tile centre is where the Tile entity actually sits', () => {
        // Scenery/Tile.as:101-110 — super(_x + w/2, _y + h/2). This is not
        // a convention the planner picked; it is what `nearestToPoint`
        // measures distance to.
        expect(tileCentre(5, 8)).toEqual({ x: 88, y: 136 });
        expect(tileAt(88, 136)).toEqual({ tx: 5, ty: 8 });
        expect(tileAt(95.9, 143.9)).toEqual({ tx: 5, ty: 8 });
        expect(tileAt(96, 144)).toEqual({ tx: 6, ty: 9 });
    });

    it('the spawn tile is walkable and is where the player starts', () => {
        expect(tileAt(SPAWN.x, SPAWN.y)).toEqual({ tx: 5, ty: 8 });
        expect(isWalkableTile(level0, 5, 8)).toBe(true);
    });

    it('treats tiles outside the level as unwalkable rather than throwing', () => {
        expect(isWalkableTile(level0, -1, 8)).toBe(false);
        expect(isWalkableTile(level0, 20, 8)).toBe(false);
        expect(isWalkableTile(level0, 5, 20)).toBe(false);
    });
});

describe('the planner sees four kinds of obstacle', () => {
    it('reports a solid without throwing', () => {
        // The BreakableRock at oel (80,112) occupies [80,96)x[112,128) —
        // the same one `collide-up-rock` pins against.
        const o = plannerObstacleAt(level0, 88, 120);
        expect(o?.kind).toBe('solid');
        expect(o.blocker.tag).toBe('breakablerock');
    });

    it('reports a PIXELMASK, per pixel, exactly where the physics stops', () => {
        // v2 THREW here and the planner reported; R2 models the masks, so
        // both faces answer from the same bitmap. They must agree at a
        // solid pixel...
        const building = level0.pixelmasks.find((p) => p.cls.as3 === 'Building');
        const c = { x: building.rect.x + 8, y: building.rect.y + 8 };
        expect(level0.collidesSolid(playerBoxAt(c.x, c.y))).toBe(building);
        expect(plannerObstacleAt(level0, c.x, c.y)?.kind).toBe('pixelmask');
        // ...and at a TRANSPARENT one inside the same bounding box, which is
        // the claim the bounding rect could not make. Level 0's building is
        // `BuildingMask`, 64x48 with 256 transparent pixels; find one and
        // require BOTH faces to let the player stand there.
        const m = building.mask;
        let gap = null;
        for (let j = 0; j < m.h && !gap; j++) {
            for (let i = 0; i + 4 <= m.w; i++) {
                // a run wide and tall enough for the whole 4x5 player box
                let clear = true;
                for (let dy = 0; dy < 5 && clear; dy++) {
                    for (let dx = 0; dx < 4; dx++) {
                        if (j + dy >= m.h || m.rows[j + dy][i + dx] === '#') { clear = false; break; }
                    }
                }
                if (clear) { gap = { x: building.maskX + i + 2, y: building.maskY + j + 2 }; break; }
            }
        }
        expect(gap, 'BuildingMask has a player-sized transparent run').not.toBeNull();
        expect(level0.collidesSolid(playerBoxAt(gap.x, gap.y))).toBeNull();
        expect(plannerObstacleAt(level0, gap.x, gap.y)?.kind).not.toBe('pixelmask');
    });

    it('reports UNMODELLED TERRAIN, which blocks nothing at all in the game', () => {
        // Water is walkable geometry — no solid, no mask, the player swims
        // straight in — but standing on it ends a v2 run through
        // `assertModelledTerrain`. A planner that asked only about solids
        // would route a fixture into the lake. Tile (9,9) is level 0's.
        const water = level0.tiles.find((t) => t.tx === 9 && t.ty === 9);
        expect(water.t).toBe(1);
        const c = tileCentre(9, 9);
        expect(level0.collidesSolid(playerBoxAt(c.x, c.y))).toBeNull();
        // ⛓ R5 slice 4: `lethal-terrain`, not `terrain`. Water joined
        // `MODELLED_TILE_TYPES` when the swim sound term became modellable
        // under the pin — so it is no longer UNMODELLED terrain. It is
        // still forbidden floor, by the R4 lethal-terrain policy that was
        // written for exactly this moment, and the exemption is `canSwim`.
        expect(plannerObstacleAt(level0, c.x, c.y)?.kind).toBe('lethal-terrain');
        expect(isWalkableTile(level0, 9, 9)).toBe(false);
    });

    it('reports a live TELEPORTER volume — planning policy, not geometry', () => {
        // An in-level route that clipped a trigger would silently end up in
        // another level. That is exactly the accident that ate v1's original
        // `clamp-left` fixture, which was quietly testing room transitions.
        const west = level0.teleporters.find((t) => t.x === 0 && t.y === 128);
        const c = { x: west.rect.x + 8, y: west.rect.y + 8 };
        expect(plannerObstacleAt(level0, c.x, c.y)?.kind).toBe('teleporter');
        // ...unless it is the one the leg named.
        const i = level0.teleporters.indexOf(west);
        expect(plannerObstacleAt(level0, c.x, c.y, i)).toBeNull();
    });

    it('does not consult geometry the level does not have', () => {
        expect(plannerObstacleAt(level0, SPAWN.x, SPAWN.y)).toBeNull();
    });
});

describe('A*', () => {
    it('finds a path and returns 4-connected tile steps', () => {
        const path = planTilePath(level0, SPAWN, { x: 264, y: 216 });
        expect(path[0]).toEqual({ tx: 5, ty: 8 });
        expect(path[path.length - 1]).toEqual({ tx: 16, ty: 13 });
        for (let i = 1; i < path.length; i++) {
            const d = Math.abs(path[i].tx - path[i - 1].tx)
                + Math.abs(path[i].ty - path[i - 1].ty);
            expect(d).toBe(1);
            expect(isWalkableTile(level0, path[i].tx, path[i].ty)).toBe(true);
        }
    });

    it('repeats within a process; the CROSS-run pin is the fixture', () => {
        // Weaker than it first looked, and worth saying so. Two calls in one
        // process cannot catch an iteration-order dependence, and a mutation
        // pass confirmed the roster is insensitive to the tie-break at all:
        // reversing the neighbour order AND removing the (ty, tx) tie-break
        // both leave every test green, because level 0's routes have no
        // equal-f tie that survives the smoother. The tie-break stays as a
        // DEFENSIVE measure, not a tested one. What actually pins
        // determinism across runs and engines is "the committed fixtures are
        // what the driver emits today" at the bottom of this file — the tape
        // there was recorded from the real game in a different process on a
        // different day.
        const a = planTilePath(level0, SPAWN, { x: 264, y: 216 });
        const b = planTilePath(level0, SPAWN, { x: 264, y: 216 });
        expect(a).toEqual(b);
    });

    it('never routes THROUGH a live trigger', () => {
        // Stronger than "reports one": the trigger policy has to change the
        // PLAN, not merely be visible to a query. Tile (2,12) holds level
        // 0's stairsdown to level 13.
        const stairs = level0.teleporters.find((t) => t.x === 32 && t.y === 192);
        expect(stairs.isStairs).toBe(true);
        expect(tileAt(stairs.rect.x, stairs.rect.y)).toEqual({ tx: 2, ty: 12 });
        expect(isWalkableTile(level0, 2, 12)).toBe(false);
        const path = planTilePath(level0, SPAWN, tileCentre(2, 13));
        expect(path.some((t) => t.tx === 2 && t.ty === 12)).toBe(false);
    });

    it('names the offending tile when an endpoint is not walkable', () => {
        expect(() => planTilePath(level0, SPAWN, tileCentre(9, 9)))
            .toThrow(/goal tile \(9,9\).*not walkable: lethal-terrain Water/s);
        expect(() => planTilePath(level0, tileCentre(9, 9), SPAWN))
            .toThrow(/start tile \(9,9\)/);
    });

    it('refuses rather than approximates when the target is walled off', () => {
        // Tile (18,8) is in level 0's east corridor: walkable, and cut off
        // from the spawn by the lake and the cliff. "No path" is a named
        // error, not an empty list a caller might read as "already there".
        // 49 of level 0's 152 box-fitting tiles are unreachable like this,
        // which is worth knowing before believing any coverage claim about
        // the level.
        expect(isWalkableTile(level0, 18, 8)).toBe(true);
        expect(() => planTilePath(level0, SPAWN, tileCentre(18, 8)))
            .toThrow(/no walkable tile path/);
    });
});

describe('smoothing', () => {
    it('the straight line from spawn to the thread-the-gap target is NOT clear', () => {
        // THE FIXTURE'S CENTRAL CLAIM. A pathing witness whose target is
        // reachable in a straight line witnesses nothing about pathing, so
        // this is asserted rather than asserted-in-prose. Note what stops
        // it: WATER, which blocks nothing in the game.
        const target = { x: 264, y: 216 };
        expect(controllerPathClear(level0, SPAWN, target)).toBe(false);
        const blocked = [];
        for (let f = 0; f <= 1; f += 0.01) {
            const p = { x: SPAWN.x + (target.x - SPAWN.x) * f, y: SPAWN.y + (target.y - SPAWN.y) * f };
            const o = plannerObstacleAt(level0, p.x, p.y);
            if (o) blocked.push(o.kind);
        }
        expect(blocked).toContain('lethal-terrain');
    });

    it('collapses the tile path to far fewer waypoints, all of them clear', () => {
        const path = planTilePath(level0, SPAWN, { x: 264, y: 216 });
        const wps = planWaypoints(level0, SPAWN, { x: 264, y: 216 });
        expect(wps.length).toBeLessThan(path.length);
        let from = SPAWN;
        for (const wp of wps) {
            expect(controllerPathClear(level0, from, wp)).toBe(true);
            from = wp;
        }
    });

    it('the last waypoint is the TARGET, not its tile centre', () => {
        // A caller asking for (118,180) must get (118,180), not the centre
        // of tile (7,11), which is (120,184).
        const wps = planWaypoints(level0, SPAWN, { x: 118, y: 180 });
        expect(wps[wps.length - 1]).toEqual({ x: 118, y: 180 });
        expect(tileCentre(7, 11)).toEqual({ x: 120, y: 184 });
    });

    it('models the 45-degree leg, not the straight line', () => {
        // THE CORRECTION THIS SLICE PAID FOR. The controller drives both
        // axes at the same rate until the shorter one arrives, so a shallow
        // leg dives well below its own straight line. From (104,184) toward
        // (232,200) the straight line is at y = 185 by x = 112, but the
        // player is at y = 192 — over the water at tile (7,12), where the
        // terrain resolver fires. A straight-segment test certifies this;
        // the controller-path test must not.
        const a = { x: 104, y: 184 };
        const b = { x: 232, y: 200 };
        const straightMidY = a.y + (b.y - a.y) * ((112 - a.x) / (b.x - a.x));
        expect(straightMidY).toBeLessThan(186);
        expect(plannerObstacleAt(level0, 112, straightMidY)).toBeNull();
        expect(plannerObstacleAt(level0, 112, 192)?.kind).toBe('lethal-terrain');
        expect(controllerPathClear(level0, a, b)).toBe(false);
    });

    it('samples finely enough to see a tile-sized obstacle', () => {
        // SEGMENT_SAMPLE_STEP is half a pixel because the sweep advances at
        // most one; a coarse sampler would skip past a 16 px obstacle and
        // the only thing that would notice is the wall the executor throws
        // on. Straight across the BreakableRock, so the 45-degree leg is
        // zero-length and this tests the sampler alone.
        const rock = level0.solids.find((s) => s.tag === 'breakablerock');
        const a = { x: rock.rect.x - 6, y: rock.rect.y + 8 };
        const b = { x: rock.rect.right + 6, y: rock.rect.y + 8 };
        expect(controllerPathClear(level0, a, b)).toBe(false);
    });
});

describe('single-level tasks', () => {
    it('reaches its target — checked by REPLAYING the emitted tape', () => {
        const { tape, arrivals } = synthesizeWalk([{ x: 264, y: 216 }], { levelSource });
        const { ticks } = replay(tape);
        expect(ticks).toHaveLength(tape.tick_count + 1);
        for (const a of arrivals) {
            const o = ticks[a.tick];
            expect(o.level).toBe(a.level);
            // Exact, not close: the driver and the runner are the same
            // engine, so anything but exact means they have diverged.
            expect(o.x).toBe(a.x);
            expect(o.y).toBe(a.y);
            expect(Math.abs(o.x - a.target.x)).toBeLessThanOrEqual(DEFAULT_TOLERANCE);
            expect(Math.abs(o.y - a.target.y)).toBeLessThanOrEqual(DEFAULT_TOLERANCE);
        }
    });

    it('emits a noclip:FALSE tape — the v2 rung is collision', () => {
        const { tape } = synthesizeWalk([{ x: 120, y: 184 }], { levelSource });
        expect(tape.noclip).toBe(false);
        // ...and the v1 driver still emits noclip:true, so the shared
        // span-folding did not quietly re-rung the older fixtures.
        expect(loadTape('straight-run').noclip).toBe(true);
    });

    it('every position the run visits is clear — checked from the REPLAY', () => {
        // The executor throws on a sweep hit, so "it did not throw" is
        // already a claim — but only about the driver's own run. This is
        // slice 1's trick applied to a synthesized route: replay the tape in
        // the other consumer and put every observed position back through
        // the planner's own obstacle test. A route that grazed a solid, or
        // that the smoother certified while the controller went elsewhere,
        // shows up here as a position the planner would never have chosen.
        const { tape } = synthesizeWalk([{ x: 264, y: 216 }], { levelSource });
        const { ticks } = replay(tape);
        const bad = ticks.map((o) => [o, plannerObstacleAt(level0, o.x, o.y)])
            .filter(([, obstacle]) => obstacle !== null)
            .map(([o, obstacle]) => `t${o.t} (${o.x},${o.y}): ${obstacle.kind}`);
        expect(bad).toEqual([]);
        expect(ticks.length).toBeGreaterThan(100);
    });

    it('refuses to run without injected geometry', () => {
        expect(() => synthesizeWalk([{ x: 120, y: 100 }]))
            .toThrow(/opts.levelSource .* is required/);
    });

    it('refuses a target it cannot stand on, naming what is there', () => {
        expect(() => synthesizeWalk([tileCentre(9, 9)], { levelSource }))
            .toThrow(/not walkable: lethal-terrain Water/);
    });
});

describe('R4: the DIRECTED edge rule — an armed waterfall cannot be CLIMBED', () => {
    // ⛔ `Player.input()`'s last act is `v.y += 0.8` unless
    // `hasFeather && v.y < 0`, and the water move speed is below 0.8. So an
    // armed waterfall is a ONE-WAY DOWNWARD tile — the only directed edge on
    // the ladder, and the only one a component flood cannot see.
    const L0 = buildLevelWorld(atlasLevelSource()(0));
    const ARMED = { noHazards: ['water'], lattice: 8 };
    const COERCED = { noHazards: ['water', 'waterfall'], lattice: 8 };
    // Level 0's band is two tiles: (13,7) and (16,7). At pitch 8 a tile is
    // 2x2 cells, so tile (16,7) is cells (32..33, 14..15).
    const below = { tx: 32, ty: 16 };
    const inBand = { tx: 32, ty: 15 };
    const above = { tx: 32, ty: 13 };

    it('the census found exactly the two tiles', () => {
        expect(L0.waterfallTiles.map((t) => `${t.tx},${t.ty}`).sort())
            .toEqual(['13,7', '16,7']);
    });

    it('an UPWARD step into or out of the band is refused', () => {
        expect(climbsArmedWaterfall(L0, below, inBand, ARMED)).toBe(true);
        expect(climbsArmedWaterfall(L0, inBand, above, ARMED)).toBe(true);
    });

    it('...and DOWNWARD and SIDEWAYS are not, which is the whole point', () => {
        // Refusing the CELL was the first cut, and it cut level 0 in two: a
        // waterfall is something a route crosses downward all the time. What
        // is impossible is climbing one, so what is forbidden is a STEP.
        expect(climbsArmedWaterfall(L0, inBand, below, ARMED)).toBe(false);
        expect(climbsArmedWaterfall(L0, above, inBand, ARMED)).toBe(false);
        expect(climbsArmedWaterfall(L0, inBand, { tx: 33, ty: 15 }, ARMED)).toBe(false);
    });

    it('the FEATHER exempts it, which is what makes the seal circular', () => {
        expect(climbsArmedWaterfall(L0, below, inBand,
            { ...ARMED, inventory: { hasFeather: true } })).toBe(false);
    });

    it('and COERCION makes it inert — which is why R1/R2/R3 never met it', () => {
        // The gate is the ITEM; the coercion decides whether the tile is
        // armed at all. R4 ships with waterfall coerced, so this rule is a
        // bounded vacuity on this rung with its witness at the next one.
        expect(climbsArmedWaterfall(L0, below, inBand, COERCED)).toBe(false);
    });

    it('a level with no waterfall answers false without looking', () => {
        const L10 = buildLevelWorld(atlasLevelSource()(10));
        expect(L10.waterfallTiles).toEqual([]);
        expect(climbsArmedWaterfall(L10, below, inBand, ARMED)).toBe(false);
    });
});

describe('R4: the spear leg verb', () => {
    // L63's bridge at tile (2,9) is a genuine seal: column 2 is the only
    // north-south corridor in that half of the level. The stance is the one
    // `probe-seedling-bridge.mjs` used against the real game.
    const relax = {
        noclip: false,
        noDamage: true,
        noHazards: ['water', 'lava', 'ice', 'waterfall'],
        grants: [{ level: 63, items: ['sword', 'spear'] }],
        persistence: [],
        equips: [{ t: 0, slot: 1 }],
    };
    const task = (spear) => [{
        level: 63,
        targets: [{ x: 40, y: 140, spear }],
    }];
    const opts = { levelSource, relax, boot: { level: 63, x: 32, y: 128 } };

    it('presses once, waits, and the bridge is open — and the REPLAY agrees', () => {
        const out = synthesizeLegs(
            task({ bridge: { tx: 2, ty: 9 }, facing: 'S' }), opts,
        );
        expect(out.spears).toHaveLength(1);
        expect(out.spears[0]).toMatchObject({ kind: 'bridge', id: '2,9', facing: 'S' });
        // The tape is ONE `primary` tick and a wait — everything else about
        // the press lives in these records, which is why they exist.
        expect(out.tape.tape_version).toBe(4);
        expect(out.tape.inputs.filter((i) => i.key === 'primary'))
            .toEqual([{ key: 'primary', from: out.spears[0].pressTick, to: out.spears[0].pressTick + 1 }]);
        // ...and the run's own press ledger says what the rect CONTAINED,
        // which is the other half: intent above, effect here.
        expect(out.presses).toEqual([expect.objectContaining({
            weapon: 'spear', level: 63, hits: [{ as3: 'Tile', id: '2,9' }],
        })]);
        // The tape replays in the other consumer without throwing, which is
        // the whole point of the driver and the runner sharing `levelRun`.
        expect(replay(out.tape).ticks.length).toBe(out.tape.tick_count + 1);
    });

    it('NUDGES a facing the approach did not leave the player in, and says so', () => {
        // `set spearing` captures `spearDirection = direction`, and
        // `sprites()` derives that from VELOCITY — so a leg that arrives
        // facing south while the press aims west would fire its rect behind
        // the player. The verb taps the facing key for one tick and lets
        // friction stop them, where `direction` sticks.
        //
        // ⚠ It used to THROW here, and the route is why it does not any
        // more: the bang-bang controller OVERSHOOTS its waypoint and
        // corrects back, so the last tick with any velocity points the wrong
        // way even when the whole approach was along the push axis. L67's
        // push arrived at (180.045, 116.519) facing E — one twentieth of a
        // pixel past the aim point — with a stance that was otherwise
        // perfect.
        const out = synthesizeLegs(task({ bridge: { tx: 2, ty: 9 }, facing: 'W' }), opts);
        expect(out.spears).toHaveLength(1);
        expect(out.spears[0]).toMatchObject({ kind: 'bridge', id: '2,9', facing: 'W' });
        // The nudge is a TAP: the player moves a fraction of a pixel and the
        // press still lands. A tape holding the key for longer would be a
        // walk, not a turn.
        const taps = out.tape.inputs.filter((i) => i.key === 'left');
        expect(taps[taps.length - 1].to - taps[taps.length - 1].from).toBe(1);
        // ...and it is still checked rather than assumed: the run's own
        // facing at the press is what the record carries.
        expect(replay(out.tape).ticks.length).toBe(out.tape.tick_count + 1);
    });

    it('...but a nudge that cannot turn the player is still a NAMED failure', () => {
        // A stance pinned against a wall in the facing direction produces no
        // velocity, so `direction` never changes and the press would fire at
        // that wall. The tap is a fix for the controller's overshoot, not a
        // licence to declare any facing from any stance.
        //
        // L63's bridge stance sits against the level's north edge, so a
        // press declared NORTH cannot be turned into.
        expect(() => synthesizeLegs(
            task({ bridge: { tx: 2, ty: 9 }, facing: 'N' }), opts,
        )).toThrow(/a tap of up left them facing|bridge 2,9 is STILL SOLID/);
    });

    it('refuses a press with nothing to prove, and one aimed at no bridge', () => {
        expect(() => synthesizeLegs(
            task({ bridge: { tx: 0, ty: 0 }, facing: 'S' }), opts,
        )).toThrow(/no bridge tile at \(0,0\)/);
        expect(() => synthesizeLegs(task({ facing: 'S' }), opts))
            .toThrow(/names EXACTLY ONE/);
        expect(() => synthesizeLegs(
            task({ bridge: { tx: 2, ty: 9 }, facing: 'NW' }), opts,
        )).toThrow(/must be one of E\/N\/W\/S/);
    });

    it('⚠ with the equip dropped the same leg FAILS — the arm is Spear-only', () => {
        // The pair's shut arm as a driver-side check: `genericHit`'s Tile arm
        // fires only under t == "Spear", so a sword press leaves the timer at
        // 60 and the verb's effect check is what says so.
        expect(() => synthesizeLegs(task({ bridge: { tx: 2, ty: 9 }, facing: 'S' }), {
            ...opts, relax: { ...relax, equips: [] },
        })).toThrow(/bridge 2,9 is STILL SOLID/);
    });
});

describe('cross-level legs', () => {
    const task = [
        { level: 0, targets: [{ x: 88, y: 168 }], exit: { x: 0, y: 128 } },
        { level: 94, targets: [{ x: 216, y: 200 }], exit: { x: 304, y: 160 } },
        { level: 0, targets: [] },
    ];

    it('crosses twice, and the REPLAY agrees tick for tick', () => {
        const { tape, arrivals, transitions } = synthesizeLegs(task, { levelSource });
        const stream = replay(tape);
        expect(stream.transitions).toEqual(transitions);
        expect(transitions).toEqual([
            { t: 96, from_level: 0, to_level: 94 },
            { t: 257, from_level: 94, to_level: 0 },
        ]);
        for (const a of arrivals) {
            const o = stream.ticks[a.tick];
            expect({ x: o.x, y: o.y, level: o.level })
                .toEqual({ x: a.x, y: a.y, level: a.level });
        }
    });

    it('the last observation is the arrival back in level 0', () => {
        const { tape } = synthesizeLegs(task, { levelSource });
        const { ticks } = replay(tape);
        const last = ticks[ticks.length - 1];
        // The teleporter at (304,160) in level 94 sends the player to
        // (24,136) — playerx/playery + the half-tile ctor offset.
        expect(last).toEqual({ t: tape.tick_count, x: 24, y: 136, level: 0 });
    });

    it('aims at the trigger CENTRE, clear of the ambiguous overlap band', () => {
        // Level 0's west pair sits at (0,128) and (0,144), and a player with
        // y in (141,146) is in BOTH volumes with different arrivals — which
        // the physics refuses as a named error. The aim point is y=136.
        const { tape, transitions } = synthesizeLegs(task, { levelSource });
        const { ticks } = replay(tape);
        // The last level-0 observation is the position the trigger fired
        // from — derived from the record rather than hardcoded, so a route
        // change moves it instead of silently pointing at another tick.
        const lastInLevel0 = ticks[transitions[0].t - 1];
        expect(lastInLevel0.level).toBe(0);
        expect(lastInLevel0.y).toBeLessThan(141);
        // ...and the arrival is the (0,128) trigger's, not (0,144)'s.
        expect(ticks[transitions[0].t]).toMatchObject({ x: 296, y: 168, level: 94 });
    });

    it("refuses a leg whose level is not where the previous exit landed", () => {
        expect(() => synthesizeLegs([
            { level: 0, targets: [], exit: { x: 0, y: 128 } },
            { level: 12, targets: [] },
        ], { levelSource })).toThrow(/goes to level 94, but legs\[1\] declares level 12/);
    });

    it('refuses an exit that is not a teleporter in that level', () => {
        expect(() => synthesizeLegs([
            { level: 0, targets: [], exit: { x: 7, y: 7 } },
            { level: 94, targets: [] },
        ], { levelSource })).toThrow(/has no teleporter at \(7,7\)/);
    });

    it('refuses a non-final leg with no exit, and a final leg WITH one', () => {
        expect(() => synthesizeLegs([
            { level: 0, targets: [] },
            { level: 94, targets: [] },
        ], { levelSource })).toThrow(/has no exit but is not the last leg/);
        expect(() => synthesizeLegs([
            { level: 0, targets: [], exit: { x: 0, y: 128 } },
        ], { levelSource })).toThrow(/is the last leg but declares an exit/);
    });

    it('refuses to search the teleporter graph on the caller\'s behalf', () => {
        // §1 ruling 4: the CALLER names the teleporter. A leg that merely
        // declares a destination level is not a request to find the way.
        expect(() => synthesizeLegs([
            { level: 0, targets: [] },
            { level: 94, targets: [] },
        ], { levelSource })).toThrow(/has to say how the run leaves it/);
    });
});

describe('the committed fixtures are what the driver emits today', () => {
    // A synthesized fixture is only an oracle-checkable claim while the
    // driver still produces it. Comparing the SUBSTANCE (boot, noclip,
    // tick count, spans) rather than the file leaves the hand-written
    // `description` free to be improved without a re-record.
    // Both sides go through `parseTape` first: it SORTS spans, and the
    // driver emits them in the order the folds closed, so comparing raw
    // objects would report a span-order difference as a route change.
    const substance = (raw) => {
        const t = parseTape(raw);
        return {
            boot: t.boot, noclip: t.noclip, tick_count: t.tick_count,
            // ⚠ The RELAXATIONS are substance, not decoration: they decide
            // which experiment the tape runs, so a driver that emitted the
            // same key spans under a different hazard set has NOT reproduced
            // the fixture — it has produced a tape whose oracle recording
            // happens to still be readable.
            tape_version: t.tape_version,
            noDamage: t.noDamage,
            noHazards: [...t.noHazards],
            grants: t.grants.map((g) => ({ level: g.level, items: [...g.items] })),
            inputs: t.inputs.map((s) => ({ key: s.key, from: s.from, to: s.to })),
        };
    };

    it('thread-the-gap', () => {
        const { tape } = synthesizeWalk([{ x: 264, y: 216 }], { levelSource });
        expect(substance(tape)).toEqual(substance(loadTape('thread-the-gap')));
    });

    it('cross-level-leg', () => {
        const { tape } = synthesizeLegs([
            { level: 0, targets: [{ x: 88, y: 168 }], exit: { x: 0, y: 128 } },
            { level: 94, targets: [{ x: 216, y: 200 }], exit: { x: 304, y: 160 } },
            { level: 0, targets: [] },
        ], { levelSource });
        expect(substance(tape)).toEqual(substance(loadTape('cross-level-leg')));
    });

    it('grant-sword-room — the R0 witness', () => {
        // The strongest net a synthesized fixture has: the PLAN depends on
        // the geometry, so any change to a tile type, an entity rect, an
        // avoid volume or the coerce rule moves the emitted tape and turns
        // this red — even along stretches the route never comes near. It is
        // how the statue offset was caught at v2 despite the route avoiding
        // the statue.
        const { tape } = synthesizeLegs([
            { level: 0, exit: { x: 256, y: 272 } },
            { level: 2, exit: { x: 48, y: 96 } },
            { level: 3, exit: { x: 96, y: 128 } },
            { level: 11, exit: { x: 32, y: 80 } },
            { level: 10, targets: [{ x: 88, y: 24 }] },
        ], {
            levelSource,
            relax: {
                noclip: true,
                noDamage: true,
                noHazards: ['water', 'pit', 'lava', 'ice', 'waterfall'],
                grants: [{ level: 10, items: ['sword'] }],
            },
        });
        expect(substance(tape)).toEqual(substance(loadTape('grant-sword-room')));
    });
});

describe('what the R0 fixtures pin, in values', () => {
    // Recorded from the real game, so these are claims about SEEDLING, not
    // about this module. Stated in values so a later refactor that moved the
    // whole stream in step could not quietly take the meaning with it.

    it('grant-sword-room: four crossings, and the grant on the arrival tick', () => {
        const { stream } = loadExpectation('grant-sword-room');
        expect(stream.transitions).toEqual([
            { t: 140, from_level: 0, to_level: 2 },
            { t: 187, from_level: 2, to_level: 3 },
            { t: 274, from_level: 3, to_level: 11 },
            { t: 330, from_level: 11, to_level: 10 },
        ]);
        // The grant's tick IS the last crossing's tick — the contract both
        // sides implement. The game's own `botStatus.grants` is what the
        // verify script checks it against; this pins the JS side's half.
        const out = runTapeToStream(loadTape('grant-sword-room'), { levelSource });
        expect(out.transitions).toEqual(stream.transitions);
    });

    it('hazard-walk-water: ends STANDING on water, at the plain ground speed', () => {
        const { stream } = loadExpectation('hazard-walk-water');
        const last = stream.ticks[stream.ticks.length - 1];
        // Column 9 of row 8 is Water; x = 158.3 is inside [144,160).
        expect(Math.floor(last.x / 16)).toBe(9);
        expect(last.y).toBe(136);
        expect(last.level).toBe(0);
        // The whole tape stays in level 0: nothing drowned, nothing reloaded.
        expect(new Set(stream.ticks.map((o) => o.level))).toEqual(new Set([0]));
        // And the resolver stored the RAW hazard state while the physics
        // consumed the coerced one — the claim the stream alone cannot make.
        const { final } = runTape(loadTape('hazard-walk-water'), { levelSource });
        expect(final.terrain).toBe(1);
    });

    it('hazard-boot-pit: boots into level 83 and does NOT fall through to 84', () => {
        const { stream } = loadExpectation('hazard-boot-pit');
        // The parameterised boot, from the game's own first observation.
        // `new Game(83, 32, 32)` puts the entity at (40,40) — the ctor's
        // half-tile. Nothing but change (d) makes this observation possible.
        expect(stream.ticks[0]).toEqual({ t: 0, x: 40, y: 40, level: 83 });
        // The pit at tile (2,1) would set receiveInput = false and transport
        // the player to level 84 (level 83's control block). It does not:
        // ZERO transitions, and every observation still in 83.
        expect(stream.transitions).toEqual([]);
        expect(new Set(stream.ticks.map((o) => o.level))).toEqual(new Set([83]));
        const { final } = runTape(loadTape('hazard-boot-pit'), { levelSource });
        expect(final.terrain).toBe(6);
    });
});

describe('what statue-press pins, in values', () => {
    // The slice's headline correction, put back under the oracle. With
    // `thread-the-gap` now routed AROUND the statue, no synthesized fixture
    // touches it any more — a driver whose job is to never hit a wall cannot
    // produce a wall-press — so this one is a driver-planned approach with a
    // hand-authored 40-tick RIGHT held into the statue's left edge.
    it('pins x against the statue edge at 184, and the game agrees', () => {
        const { ticks } = replay(loadTape('statue-press'));
        const pinned = ticks.slice(-14);
        expect(new Set(pinned.map((o) => o.x))).toEqual(new Set([181.97065141119558]));
        // A DIRECT measurement of the collider's left edge: one more pixel
        // right puts the box's right edge at 184.  The slice-1 rect had that
        // edge at 176, eight pixels away.
        const box = playerBoxAt(181.97065141119558, 183.31024524876432);
        expect(box.right).toBeGreaterThan(183);
        expect(box.right).toBeLessThanOrEqual(184);
    });

    it('the approach is planned and the press is not — by construction', () => {
        // Tile (11,11) is not a legal A* goal at all: the player box does
        // not fit at its centre because the statue covers it. So the press
        // could not have been synthesized, which is exactly why the tail is
        // hand-written.
        expect(isWalkableTile(level0, 11, 11)).toBe(false);
        expect(isWalkableTile(level0, 10, 11)).toBe(true);
        const tape = loadTape('statue-press');
        const tail = tape.inputs.filter((i) => i.to === tape.tick_count && i.key === 'right');
        expect(tail).toHaveLength(1);
        expect(tail[0].from).toBe(tape.tick_count - 40);
    });
});

describe('what wall-slide pins, in values', () => {
    // Hand-authored rather than synthesized: the driver's whole job is to
    // NOT touch walls, so the fixture that pins what happens when you do
    // has to be written by hand.
    const stream = () => replay(loadTape('wall-slide'));

    it('X pins for 31 consecutive ticks while Y descends on every one', () => {
        const { ticks } = stream();
        const pinnedX = ticks.slice(1).filter((o, i) => o.x === ticks[i].x);
        const movedY = ticks.slice(1).filter((o, i) => o.y > ticks[i].y);
        expect(pinnedX).toHaveLength(31);
        expect(movedY).toHaveLength(ticks.length - 1);
        // One axis resolved, the other not, from the same diagonal velocity
        // — which a per-axis-independent sweep is the only way to get.
        expect(ticks[20].x).toBe(66.2288148957249);
        expect(ticks[50].x).toBe(66.2288148957249);
    });

    it('t=50 is the ORDER witness: X is swept before Y, and Y at the new x', () => {
        // `Mobile.as:38-39` is `moveX(v.x); moveY(v.y);` where moveY reads
        // the member x that moveX has already written. Swapping the two puts
        // the player at x = 65.2908729652601 on this tick instead — measured
        // against a swapped-order engine, which is why the value is here.
        const { ticks } = stream();
        expect(ticks[50].x).toBe(66.2288148957249);
        expect(ticks[51].x).toBeLessThan(66.2288148957249);
    });

    it('stays in level 0 and clear of the terrain seam', () => {
        const { ticks, transitions } = stream();
        expect(transitions).toEqual([]);
        expect(ticks.every((o) => o.level === 0)).toBe(true);
        // 70 ticks is the budget: at ~90 the route reaches the Water tiles
        // in rows 14-15 and the resolver fires. Pinned so a later edit that
        // lengthens the tape finds out here rather than in a recording run.
        expect(loadTape('wall-slide').tick_count).toBe(70);
    });
});

/**
 * R0: the RELAXED mode — the driver that plans the subtractive ladder's
 * walks.
 *
 * The property that makes this worth testing here rather than only against
 * the game: `relax` is ONE object, and it decides the plan, the run and the
 * emitted tape together. A driver that planned around water while emitting
 * a tape that disables it would produce a tape the runner and the game both
 * accept and neither walks the way the planner imagined — the same class of
 * bug as the maze arc's walkTo divergence, one level up.
 *
 * The witness walk itself (boot -> the sword's room) is a fixture and lives
 * with its oracle recording; what is checked here is the machinery.
 */
describe('the relaxed driver', () => {
    const RELAX = Object.freeze({
        noclip: true,
        noDamage: true,
        noHazards: ['water', 'pit', 'lava', 'ice', 'waterfall'],
        grants: [],
    });
    /** The R0 witness chain: boot -> 2 -> 3 -> 11 -> the sword's room. */
    const WITNESS_LEGS = [
        { level: 0, exit: { x: 256, y: 272 } },
        { level: 2, exit: { x: 48, y: 96 } },
        { level: 3, exit: { x: 96, y: 128 } },
        { level: 11, exit: { x: 32, y: 80 } },
        { level: 10, targets: [{ x: 88, y: 24 }] },
    ];

    it('refuses a partial relaxation rather than defaulting one', () => {
        for (const missing of ['noclip', 'noDamage', 'noHazards', 'grants']) {
            const relax = { ...RELAX };
            delete relax[missing];
            expect(() => synthesizeLegs([{ level: 0, targets: [{ x: 96, y: 136 }] }],
                { levelSource, relax })).toThrow(new RegExp(`must declare ${missing}`));
        }
    });

    it('emits a version 2 tape carrying exactly the relaxations it planned with', () => {
        const { tape } = synthesizeLegs([{ level: 0, targets: [{ x: 96, y: 136 }] }],
            { levelSource, relax: RELAX });
        const parsed = parseTape(tape);
        expect(parsed.tape_version).toBe(2);
        expect(parsed.noclip).toBe(true);
        expect(parsed.noDamage).toBe(true);
        expect(parsed.noHazards).toEqual(['water', 'pit', 'lava', 'ice', 'waterfall']);
    });

    it('still emits a version 1 tape without `relax` — the v2 path is untouched', () => {
        const { tape } = synthesizeWalk([{ x: 104, y: 136 }], { levelSource });
        expect(parseTape(tape).tape_version).toBe(1);
        expect(parseTape(tape).noclip).toBe(false);
    });

    it('walks THROUGH level 0 water a relaxed tape has disabled', () => {
        // Level 0's row 8 hits Water at column 9. At v2 that tile is an
        // obstacle to the planner AND a throw to the physics; relaxed it is
        // neither, and the route may cross it. This is the whole relaxation
        // in one target — and the emitted tape is replayed independently
        // below, so it is the TAPE that crosses, not the planner's opinion.
        const target = { x: 9 * 16 + 8, y: 8 * 16 + 8 };
        expect(() => synthesizeWalk([target], { levelSource })).toThrow(/Water/);
        const { tape } = synthesizeWalk([target], { levelSource, relax: RELAX });
        const { ticks } = runTapeToStream(tape, { levelSource });
        expect(ticks[ticks.length - 1].x).toBeCloseTo(target.x, 0);
        expect(ticks[ticks.length - 1].y).toBeCloseTo(target.y, 0);
    });

    it('routes AROUND a pickup and a proximity hazard', () => {
        // Level 10 is a 7x7 room whose middle holds the sword; level 11's
        // chest sits between the arrival and the exit. Neither stops the
        // player in the game, so the only evidence the route respected them
        // is that no planned waypoint and no executed tick overlaps one.
        const { tape, waypoints } = synthesizeLegs(WITNESS_LEGS,
            { levelSource, relax: RELAX });
        const worlds = new Map([10, 11].map((n) => [n,
            buildLevelWorld(levelSource(n), { roles: ['trigger', 'pickup', 'proximity-hazard'] })]));
        expect(worlds.get(10).pickups).toHaveLength(1);
        expect(worlds.get(11).proximityHazards).toHaveLength(1);

        // Every WAYPOINT the planner kept, in the two levels that have
        // volumes...
        for (const wp of waypoints.flat()) {
            for (const w of worlds.values()) {
                expect(w.avoidVolumesAt(playerBoxAt(wp.x, wp.y))).toEqual([]);
            }
        }
        // ...and every position the replayed TAPE actually occupied there.
        const { ticks } = runTapeToStream(tape, { levelSource });
        for (const o of ticks) {
            const w = worlds.get(o.level);
            if (w) expect(w.avoidVolumesAt(playerBoxAt(o.x, o.y)), `tick ${o.t}`).toEqual([]);
        }
    });

    it('plans the whole witness chain and fires the grant at the arrival tick', () => {
        const out = synthesizeLegs(WITNESS_LEGS, {
            levelSource,
            relax: { ...RELAX, grants: [{ level: 10, items: ['sword'] }] },
        });
        expect(out.transitions.map((t) => t.to_level)).toEqual([2, 3, 11, 10]);
        const arrival = out.transitions[out.transitions.length - 1];
        // The grant lands on the SAME tick as the arrival, which is the
        // contract `Bot.as` implements on the other side.
        expect(out.grants).toEqual([{ t: arrival.t, level: 10, items: ['sword'] }]);
        expect(out.inventory.hasSword).toBe(true);
        // ...and only that one.
        expect(out.inventory.hasShield).toBe(false);
        expect(out.inventory.hitsMax).toBe(3);
    });

    it('FAILS on a grant for a level the planned walk never enters', () => {
        expect(() => synthesizeLegs(WITNESS_LEGS, {
            levelSource,
            relax: { ...RELAX, grants: [{ level: 43, items: ['wand'] }] },
        })).toThrow(/grant items in level\(s\) 43, which the planned walk never enters/);
    });

    // ⚠ BOUNDED VACUITY, recorded rather than left implied by a green
    // mutation table. Removing the EXECUTOR's avoid-volume throw turns
    // nothing red — the planner's own policy keeps every current route
    // clear, so the executor never gets a volume to notice. Same shape and
    // same verdict as v2's executor hit-throw: keep it, because the
    // alternative is a tape that walks over a pickup and produces a
    // perfectly plausible stream the real game answers with a deadlock.
    // The witness that would close it: a route whose SMOOTHED segment
    // clips a volume that the tile-centre test cleared — which needs a
    // volume placed off-centre in a tile the route must pass through.

    it('builds worlds with the RELAXED census, which R5 made a vacuous distinction', () => {
        // R2 paid the blocking bill for the R1 ROUTE, so the witness chain's
        // own levels (2 and 3 among them) build both ways; the claim then
        // needed a level R2 deliberately did NOT price, and level 1 was one.
        //
        // ⛔ R5 CLASSIFIED EVERY REMAINING TAG, so there is no longer a level
        // that the relaxed census builds and the full one refuses — level 1
        // included. The relaxation still exists and `synthesizeLegs` still
        // passes it; what it no longer BUYS is a level. Asserted in that
        // direction, and recorded as a bounded vacuity rather than deleted:
        // the witness that would revive it is the next tag the extract
        // gains, or R6's `pod`.
        expect(() => buildLevelWorld(levelSource(1))).not.toThrow();
        expect(() => buildLevelWorld(levelSource(1), { roles: RELAXED_ROLES })).not.toThrow();
        expect(() => synthesizeLegs(WITNESS_LEGS, { levelSource, relax: RELAX }))
            .not.toThrow();
    });
});

describe('R1: pit exits, and the forbidden-floor policy', () => {
    const R1 = {
        noclip: true, noHazards: ['water', 'lava', 'ice', 'waterfall'],
        noDamage: true, grants: [],
    };
    const CLUSTER = [
        { level: 83, targets: [], exit: { pit: { tx: 2, ty: 1 } } },
        { level: 84, targets: [], exit: { pit: { tx: 2, ty: 2 } } },
        { level: 85, targets: [{ x: 88, y: 88 }] },
    ];
    const plan = () => synthesizeLegs(CLUSTER, {
        levelSource, boot: { level: 83, x: 16, y: 16 }, name: 'cluster-probe', relax: R1,
    });

    it('falls 83 -> 84 -> 85 at the ticks the GAME put them', () => {
        // The strongest cross-check available without another recording: the
        // hand-authored `pit-fall-chain-85` tape holds RIGHT from a standing
        // start and the game crossed at 28 and 89. This is a DIFFERENT tape,
        // planned by the driver from a task list, and it crosses at the same
        // two ticks — so the transport's timing is a property of the model
        // rather than of one input sequence.
        const r = plan();
        expect(r.transitions).toEqual([
            { t: 28, from_level: 83, to_level: 84 },
            { t: 89, from_level: 84, to_level: 85 },
        ]);
        expect(r.arrivals.at(-1)).toMatchObject({ leg: 2, level: 85 });
    });

    it('emits NO input span inside a transport window', () => {
        // The rule, from both sides: the game refuses input from the tick
        // after the edge until the descent lands, so a span there is one the
        // JS honours and the game drops. Checked against the run's OWN
        // transport windows rather than against hard-coded ticks.
        const r = plan();
        const held = [];
        for (const span of r.tape.inputs) {
            for (let t = span.from; t < span.to; t += 1) held[t] = true;
        }
        // ⚠ `perTick[i]` is tick i+1's input (push-then-advance), so a span
        // `[69,70)` is the input for tick 70 — the first tick AFTER the
        // descent landed, where the player has control again and the
        // controller legitimately presses toward the next pit. The edge tick
        // is likewise held, and correctly: `receiveInput = false` is set
        // after `super.update()`, so the game runs input() on it too.
        //
        // Window 1: the fall-out into 84 plus its descent, which lands on
        // tick 69 — inputs for ticks 10..69, i.e. perTick[9..68].
        for (let t = 9; t <= 68; t += 1) {
            expect(held[t], `tick ${t + 1} is inside the first transport`).toBeUndefined();
        }
        // Window 2: the chained fall out of 84 and the bouncing descent into
        // 85, from the tick after that edge until the walk resumes.
        for (let t = 70; t <= 168; t += 1) {
            expect(held[t], `tick ${t + 1} is inside the second transport`).toBeUndefined();
        }
        // Positive control: without this the two loops pass on an empty tape.
        expect(r.tape.inputs.length).toBeGreaterThan(2);
        expect(held[0]).toBe(true);
    });

    it('REFUSES to route across a pit the leg did not name', () => {
        // Pit tiles stopped being unmodelled terrain when the transport
        // landed, so `plannerBlockerAt` no longer reports them for free.
        // Without the driver's own policy the planner walks over holes that
        // kill in 27 of the 116 levels.
        const L83 = buildLevelWorld(levelRecord(83), { roles: RELAXED_ROLES });
        const opts = { noclip: true, noHazards: R1.noHazards, avoidVolumes: true };
        const pit = tileCentre(2, 1);
        expect(plannerObstacleAt(L83, pit.x, pit.y, null, opts))
            .toMatchObject({ kind: 'pit' });
        // ...and allows exactly the one tile a leg names, the same shape of
        // exemption the leg's own teleporter gets.
        expect(plannerObstacleAt(L83, pit.x, pit.y, null,
            { ...opts, allowPit: { tx: 2, ty: 1 } })).toBeNull();
        // A DIFFERENT pit stays forbidden even while one is exempt.
        const L84 = buildLevelWorld(levelRecord(84), { roles: RELAXED_ROLES });
        const other = tileCentre(1, 1);
        expect(plannerObstacleAt(L84, other.x, other.y, null,
            { ...opts, allowPit: { tx: 2, ty: 2 } })).toMatchObject({ kind: 'pit' });
    });

    it('REFUSES to route across ARMED LETHAL TERRAIN (R4)', () => {
        // The same trap the pit policy above exists for, one rung on.
        // Adding 17/22/25 to `MODELLED_TILE_TYPES` is what lets a tape ARM
        // a hazard at all — and it silently took armed lava OFF
        // `plannerBlockerAt`'s unmodelled-terrain report, so without this
        // policy the planner walks across a lava floor and the run drowns
        // eleven ticks later.
        //
        // L71 carries 148 lava tiles and is on the R3 route. Tile (0,0) is
        // one of them (`--hazard-tiles`).
        const L71 = buildLevelWorld(levelRecord(71), { roles: RELAXED_ROLES });
        const lava = L71.lethalTerrainTiles[0];
        const at = { x: lava.tx * 16 + 8, y: lava.ty * 16 + 8 };
        const armed = { noclip: true, noHazards: ['water', 'ice', 'waterfall'] };

        // ARMED: forbidden floor.
        expect(plannerObstacleAt(L71, at.x, at.y, null, armed))
            .toMatchObject({ kind: 'lethal-terrain' });
        // COERCED (R1-R3's own set): inert, exactly as those rungs planned
        // it — which is why all 50 frozen recordings are unaffected.
        expect(plannerObstacleAt(L71, at.x, at.y, null,
            { noclip: true, noHazards: R1.noHazards })).toBeNull();
        // And the gate is the ITEM, not the tape: the dark suit is what
        // `checkDrowning` spares the player with.
        expect(plannerObstacleAt(L71, at.x, at.y, null,
            { ...armed, inventory: { hasDarkSuit: true } })).toBeNull();
        expect(plannerObstacleAt(L71, at.x, at.y, null,
            { ...armed, inventory: { canSwim: true } }))
            .toMatchObject({ kind: 'lethal-terrain' });
    });

    it('does NOT forbid ice or waterfall, which are armed and walkable', () => {
        // Forbidding these instead of modelling them is what collapses the
        // walk from 60 nodes to 11 (slice 0 §8.2): a waterfall cannot drown
        // you (`checkDrowning` tests `eff == 1` alone) and ice is merely
        // slippery. L59 carries 28 waterfall tiles and is on the route.
        const L59 = buildLevelWorld(levelRecord(59), { roles: RELAXED_ROLES });
        const falls = L59.tiles.filter((t) => t.t === 25);
        expect(falls.length).toBeGreaterThan(0);
        expect(L59.lethalTerrainTiles.every((t) => t.t !== 25)).toBe(true);
    });

    it('names a pit exit that is not a pit, and one that falls elsewhere', () => {
        expect(() => synthesizeLegs([
            { level: 83, targets: [], exit: { pit: { tx: 0, ty: 0 } } },
            { level: 84, targets: [] },
        ], { levelSource, boot: { level: 83, x: 16, y: 16 }, relax: R1 }))
            .toThrow(/has no pit there/);
        expect(() => synthesizeLegs([
            { level: 83, targets: [], exit: { pit: { tx: 2, ty: 1 } } },
            { level: 12, targets: [] },
        ], { levelSource, boot: { level: 83, x: 16, y: 16 }, relax: R1 }))
            .toThrow(/falls to level 84, but legs\[1\] declares level 12/);
    });
});

/**
 * ── R2: the relaxation that keeps the SOLIDS ──────────────────────────
 *
 * Until R2 the driver read `noclip: Boolean(relax)`. Every tape that
 * existed was a noclip tape, so the derivation was true — and it was true
 * for a reason that stopped holding the moment a rung wanted `noDamage`,
 * `noHazards`, `grants` and a clear list WITH collision on. What is
 * checked here is that the one object still decides all three consumers
 * (plan, run, tape) now that it decides one more thing.
 */
describe('R2: a relaxed walk with collision ON', () => {
    const R2 = Object.freeze({
        noclip: false,
        noDamage: true,
        noHazards: ['water', 'lava', 'ice', 'waterfall'],
        grants: [],
    });

    it('emits a tape that says noclip false, and plans the same way', () => {
        // Level 0's lake and its statue are real obstacles to this walk; the
        // v2 fixtures already prove the planner threads them. The claim here
        // is narrower and is the one that was derivable before: the EMITTED
        // TAPE agrees with the plan.
        const { tape } = synthesizeWalk([{ x: 264, y: 216 }], { levelSource, relax: R2 });
        const parsed = parseTape(tape);
        expect(parsed.tape_version).toBe(2);
        expect(parsed.noclip).toBe(false);
        expect(parsed.noDamage).toBe(true);
        // ...and the tape the runner reads walks the walk the driver drove.
        const run = runTape(tape, { levelSource });
        expect(Math.abs(run.final.x - 264)).toBeLessThanOrEqual(DEFAULT_TOLERANCE);
        expect(Math.abs(run.final.y - 216)).toBeLessThanOrEqual(DEFAULT_TOLERANCE);
    });

    it('consults the census, and an unpriced VOLUME still stops it by name', () => {
        // The mirror image of R0 slice 1b: a walk may not cross a level
        // whose geometry nobody priced. The exemplar tag has now rotted
        // TWICE — `arrowtrap` in L4 until R4's L67 probes priced it, then
        // `finaldoor` in L113 until R5's sweep did — which is the third time
        // this arc has learned that a coincidental exemplar rots silently.
        //
        // So the pick is no longer a BLOCKING holdout (there are none): it
        // is the one piece of geometry that is unpriced by RULING rather
        // than by neglect — `pod`, L112, whose avoid volume belongs to R6
        // with the ending. When R6 prices it, this test moves to whatever
        // the census still refuses, and if nothing does, it says so.
        expect(() => synthesizeLegs([{ level: 112, targets: [{ x: 120, y: 120 }] }],
            { levelSource, boot: { level: 112, x: 112, y: 112 }, relax: R2 }))
            .toThrow(/"pod".*PROXIMITY HAZARD/s);
        // ...and noclip does not save it either, because `proximity-hazard`
        // is a CHEAP role: this one is about the volume, not the collider.
        expect(() => buildLevelWorld(levelSource(112), { roles: RELAXED_ROLES }))
            .toThrow(/"pod".*PROXIMITY HAZARD/s);
    });

    it('refuses a non-boolean noclip rather than coercing it', () => {
        expect(() => synthesizeWalk([{ x: 96, y: 136 }],
            { levelSource, relax: { ...R2, noclip: 'false' } }))
            .toThrow(/noclip must be a boolean/);
    });

    describe('persistence rides the same object', () => {
        // L3's `breakablerock@96,112` carries tag 0 and `BreakableRock.as:50`
        // removes it on a cleared flag. One clear, one blocker, one level.
        const CLEAR = Object.freeze([{ level: 3, tag: 0, note: 'breakablerock@96,112' }]);

        it('makes a version 3 tape by PRESENCE, not by value', () => {
            const empty = synthesizeWalk([{ x: 264, y: 216 }],
                { levelSource, relax: { ...R2, persistence: [] } });
            expect(parseTape(empty.tape).tape_version).toBe(3);
            expect(parseTape(empty.tape).persistence).toEqual([]);
            // ...and omitting it is still the version 2 tape R1 emits, which
            // is what keeps the twenty-three frozen fixtures byte-identical.
            const absent = synthesizeWalk([{ x: 264, y: 216 }], { levelSource, relax: R2 });
            expect(parseTape(absent.tape).tape_version).toBe(2);
        });

        it('carries the clears into the tape it emits', () => {
            const { tape } = synthesizeLegs([{ level: 3, targets: [{ x: 40, y: 72 }] }], {
                levelSource,
                boot: { level: 3, x: 32, y: 64 },
                relax: { ...R2, persistence: [...CLEAR] },
            });
            expect(parseTape(tape).persistence)
                .toEqual([{ level: 3, tag: 0, note: 'breakablerock@96,112' }]);
        });

        it('plans against the CLEARED world, not the built one', () => {
            const shut = buildLevelWorld(levelSource(3));
            const open = buildLevelWorld(levelSource(3), { cleared: [0] });
            const rock = (w) => w.solids.some((s) => s.tag === 'breakablerock');
            expect(rock(shut)).toBe(true);
            expect(rock(open)).toBe(false);
        });

        it('refuses a persistence that is not an array', () => {
            expect(() => synthesizeWalk([{ x: 96, y: 136 }],
                { levelSource, relax: { ...R2, persistence: { 3: 0 } } }))
                .toThrow(/persistence must be an array/);
        });
    });
});

/**
 * ── R2: THE HOLD ──────────────────────────────────────────────────────
 *
 * L71's `lock@112,160` is the only way north into Dungeon 7 and it opens on
 * nothing but 101 ticks on the `button@112,176` below it. The leg
 * vocabulary had no word for that, and the executor had no way to tell a
 * hold that ran 101 ticks from one that ran 99 — which would have
 * presented as a collision divergence two thousand ticks later, in another
 * level, against a lock nobody was looking at.
 *
 * The geometry that makes this the right fixture: the shaft to the button
 * is sealed BELOW by `lock@112,192` (tset -1, tag 0), which a persistence
 * clear despawns, and ABOVE by `lock@112,160` (tset 0, tag 3), which one
 * does NOT — `Lock.check()` needs `tSet < 0`. So the hold is the only way
 * through, and the clear is what gets you to the button at all.
 */
describe('R2: the hold primitive', () => {
    const CLEARS = Object.freeze([
        { level: 71, tag: 0, note: 'lock@112,192 (tset -1) — the shaft below the button' },
        { level: 71, tag: 1, note: 'chest@160,256' },
        { level: 71, tag: 2, note: 'shieldlock@288,256' },
    ]);
    const R2 = Object.freeze({
        noclip: false,
        noDamage: true,
        noHazards: ['water', 'lava', 'ice', 'waterfall'],
        grants: [],
        persistence: [...CLEARS],
    });
    /** Tile (7,14), at the foot of the shaft. */
    const BOOT = Object.freeze({ level: 71, x: 112, y: 224 });
    const BUTTON = Object.freeze({ x: 112, y: 176 });
    const LOCK_RECT = Object.freeze({ x: 112, y: 160, right: 128, bottom: 176 });

    const walk = (ticks, opts = {}) => synthesizeLegs([{
        level: 71,
        targets: [
            { x: 120, y: 184, hold: { ticks, presser: { ...BUTTON } } },
            { x: 120, y: 120 },
        ],
    }], { levelSource, boot: { ...BOOT }, relax: R2, name: 'l71-hold', ...opts });

    it('holds, opens the lock, and walks THROUGH where it stood', () => {
        const { tape, holds, arrivals } = walk(101);
        expect(holds).toHaveLength(1);
        expect(holds[0].presser).toEqual({ tag: 'button', x: 112, y: 176, t: 0 });
        expect(holds[0].ticks).toBe(101);
        expect(holds[0].to - holds[0].from).toBe(101);
        expect(holds[0].opened).toEqual(['lock@112,160']);

        // ⚠ THE EFFECT, from an INDEPENDENT replay of the emitted tape —
        // not from the planner's own running state. The claim is that the
        // player ends up NORTH of a lock that was solid when the walk
        // started, which is only possible if the hold really opened it.
        const stream = runTapeToStream(tape, { levelSource });
        const through = stream.ticks.filter((o) => o.x >= LOCK_RECT.x && o.x < LOCK_RECT.right
            && o.y >= LOCK_RECT.y && o.y < LOCK_RECT.bottom);
        expect(through.length).toBeGreaterThan(0);
        const last = stream.ticks[stream.ticks.length - 1];
        expect(last.level).toBe(71);
        expect(last.y).toBeLessThan(LOCK_RECT.y);
        expect(Math.abs(last.y - arrivals[1].y)).toBeLessThan(1e-9);
    });

    it('emits NOTHING during the hold window', () => {
        // A hold presses no key, so no span may overlap its ticks. A span
        // that did would be a tape whose two consumers disagree about what
        // it asked for — the v1 boot asymmetry, one primitive later.
        const { tape, holds } = walk(101);
        const { from, to } = holds[0];
        const overlapping = tape.inputs.filter((s) => s.from < to && s.to > from);
        expect(overlapping).toEqual([]);
    });

    /**
     * ⚠ THE MUTATION THE PRIMITIVE EXISTS FOR. `Image.alpha` clamps at 0
     * and `Lock.activationStep` tests `alpha > 0` BEFORE decrementing, so
     * the lock opens on 101 and 100 leaves it solid. One tick short must be
     * a NAMED failure here, not a wall met somewhere certified clear.
     */
    it('goes red on a hold that is one tick short, naming the lock', () => {
        // ⚠ 90, not 100, and the difference is the mechanic being honest.
        // `Button.update` presses on OVERLAP, and the approach up the shaft
        // overlaps the button for a few ticks before the controller comes to
        // the full stop an arrival requires — so the run reaches the hold
        // with the fade already part-way down. The declared count is
        // therefore a FLOOR the author derives from the AS3 (101 for a
        // Lock), safe to over-state and never to under-state, and what the
        // executor actually asserts is the EFFECT. 94 is the first count
        // that opens it here — the approach pressed the other 7 — and 93 is
        // the last that does not.
        expect(() => walk(93)).toThrow(/lock@112,160.*STILL SOLID/s);
        expect(() => walk(93)).toThrow(/held button@112,176 for 93 tick\(s\)/);
        expect(() => walk(94)).not.toThrow();
    });

    it('refuses a hold that opens nothing — the positive control', () => {
        // "The lock is open after the hold" is satisfied by a lock that was
        // never shut. So a SECOND hold on the same button, with the first
        // one's lock still held open by occupancy, is a named failure rather
        // than a free pass. This is `l71-lock-shut`'s job on the JS side.
        expect(() => synthesizeLegs([{
            level: 71,
            targets: [
                { x: 120, y: 184, hold: { ticks: 101, presser: { ...BUTTON } } },
                { x: 120, y: 184, hold: { ticks: 101, presser: { ...BUTTON } } },
            ],
        }], { levelSource, boot: { ...BOOT }, relax: R2 }))
            .toThrow(/ALREADY OPEN before the hold begins/);
    });

    it('refuses a presser the level does not have', () => {
        expect(() => synthesizeLegs([{
            level: 71,
            targets: [{ x: 120, y: 184, hold: { ticks: 101, presser: { x: 0, y: 0 } } }],
        }], { levelSource, boot: { ...BOOT }, relax: R2 }))
            .toThrow(/has no presser at \(0,0\)/);
    });

    it('refuses a hold whose target does not land ON the button', () => {
        expect(() => synthesizeLegs([{
            level: 71,
            // Tile (7,13) — in the shaft, one tile below the button.
            targets: [{ x: 120, y: 216, hold: { ticks: 101, presser: { ...BUTTON } } }],
        }], { levelSource, boot: { ...BOOT }, relax: R2 }))
            .toThrow(/is NOT on button@112,176/);
    });

    it('refuses a hold under noclip, where it would verify nothing', () => {
        expect(() => synthesizeLegs([{
            level: 71,
            targets: [{ x: 120, y: 184, hold: { ticks: 101, presser: { ...BUTTON } } }],
        }], {
            levelSource,
            boot: { ...BOOT },
            relax: { ...R2, noclip: true, persistence: undefined },
        })).toThrow(/the noclip arm does not run it/);
    });

    it('refuses a tick count that is not a positive integer', () => {
        for (const ticks of [0, -1, 1.5, undefined, '101']) {
            expect(() => synthesizeLegs([{
                level: 71,
                targets: [{ x: 120, y: 184, hold: { ticks, presser: { ...BUTTON } } }],
            }], { levelSource, boot: { ...BOOT }, relax: R2 }))
                .toThrow(/hold\.ticks must be a positive integer/);
        }
    });

    it('is unreachable at all without the clear that opens the shaft', () => {
        // The positive control for the clear list: the same walk with L71's
        // tag 0 not cleared cannot even get to the button, because
        // `lock@112,192` is still standing in the shaft.
        expect(() => walk(101, {
            relax: { ...R2, persistence: CLEARS.filter((c) => c.tag !== 0) },
        })).toThrow(/no walkable tile path in level 71/);
    });
});

/**
 * ── R3: THE TOUCH ─────────────────────────────────────────────────────
 *
 * L71's `shieldlock@288,256` is the last thing between the walk and
 * `darksuit`, and R2 opened it with a persistence clear. R3's whole rung is
 * retiring that crutch, and this is the one blocker on the bill that R3
 * itself opens: the player walks into the lock holding the dark shield and
 * the lock takes them over — snapping `p.y`, refusing input, fading for its
 * 101 ticks, then handing input back and writing `setPersistence(2, false)`.
 *
 * Two things make it a different primitive from the hold rather than a
 * parameterisation of it. The window REFUSES INPUT rather than merely being
 * a stretch the driver chooses to sit out, so the count is the game's and
 * not the author's; and the position is WRITTEN by the lock, so "did not
 * move" is not the invariant — "stayed inside the collide rect" is, because
 * `ShieldLock.turnOff` restores input only `if (p)`.
 */
describe('R3: the touch primitive', () => {
    const R3 = Object.freeze({
        noclip: false,
        noDamage: true,
        noHazards: ['water', 'lava', 'ice', 'waterfall'],
        grants: [{ level: 71, items: ['darkshield'] }],
        persistence: [],
    });
    /** Two tiles west of the lock, on its own row. */
    const BOOT = Object.freeze({ level: 71, x: 256, y: 256 });
    const LOCK = Object.freeze({ x: 288, y: 256 });
    const LOCK_RECT = Object.freeze({ x: 288, y: 256, right: 304, bottom: 272 });

    const walk = (opts = {}) => synthesizeLegs([
        {
            level: 71,
            targets: [{ x: 272, y: 264, touch: { lock: { ...LOCK } } }],
            exit: { x: 304, y: 256 },
        },
        { level: 76, targets: [{ x: 40, y: 88 }] },
    ], {
        levelSource,
        boot: { ...BOOT },
        relax: R3,
        name: 'l71-touch',
        lattice: 8,
        nodeMargin: 2,
        triggerMargin: 4,
        allowGrazes: true,
        ...opts,
    });

    it('touches, opens the lock, and crosses THROUGH where it stood', () => {
        const { tape, touches, transitions } = walk();
        expect(touches).toHaveLength(1);
        expect(touches[0].lock).toEqual({
            id: 'shieldlock@288,256', tag: 'shieldlock', x: 288, y: 256,
        });
        expect(touches[0].shield).toBe('hasDarkShield');
        // What `Lock.turnOff()` writes false, which is exactly the clear R2
        // used to declare on the tape.
        expect(touches[0].persistTag).toBe(2);
        // The GAME's count, not the driver's: `Lock.activationStep` decrements
        // on the tick the touch itself fires, so 100 more follow it.
        expect(touches[0].window).toBe(100);
        expect(touches[0].snappedTo).toBe(263);

        // ⚠ THE EFFECT, from an INDEPENDENT replay of the emitted tape.
        // The player ends up east of a lock that was Solid when the walk
        // started, and then in another level entirely.
        const stream = runTapeToStream(tape, { levelSource });
        const through = stream.ticks.filter((o) => o.level === 71
            && o.x >= LOCK_RECT.x && o.x < LOCK_RECT.right
            && o.y >= LOCK_RECT.y && o.y < LOCK_RECT.bottom);
        expect(through.length).toBeGreaterThan(0);
        expect(transitions.map((t) => t.to_level)).toEqual([76]);
        expect(stream.ticks[stream.ticks.length - 1].level).toBe(76);
    });

    it('emits NOTHING during the input-refused window', () => {
        // ⚠ THE RULE THIS PRIMITIVE EXISTS FOR. The tick counter runs while
        // the player cannot act, so a controller left alone would choose keys
        // for a hundred ticks the game drops on the floor — and 100 spans
        // against a runtime with a measured span ceiling is not free either.
        const { tape, touches } = walk();
        const from = touches[0].from + touches[0].approach;
        const to = touches[0].to;
        expect(to - from).toBe(touches[0].window);
        expect(tape.inputs.filter((s) => s.from < to && s.to > from)).toEqual([]);
    });

    it('...and the run really is refused input for exactly those ticks', () => {
        // The other side of the same claim, from the RUN rather than the
        // tape: an empty span list is also what a window that never opened
        // looks like.
        const { tape, touches } = walk();
        const { lockSnaps } = runTape(tape, { levelSource });
        expect(lockSnaps).toHaveLength(1);
        expect(lockSnaps[0]).toMatchObject({
            id: 'shieldlock@288,256', level: 71, persistTag: 2, y: 263, ticks: 100,
        });
        expect(lockSnaps[0].from).toBe(touches[0].from + touches[0].approach);
        expect(lockSnaps[0].to).toBe(touches[0].to);
    });

    it('refuses a touch with no shield — which is a ROUTE ORDER defect', () => {
        // `ShieldLock.update`'s condition is simply false without it, so the
        // lock is an ordinary wall and the approach would spend its whole
        // budget pressing into it. Named for what it is, not diagnosed from
        // the stall it causes.
        expect(() => walk({ relax: { ...R3, grants: [] } }))
            .toThrow(/opens on `Player\.hasDarkShield`, which the run does NOT have/);
    });

    it('refuses a touch on a lock that is already gone — the positive control', () => {
        // "The player got through" is satisfied by a lock that was never
        // there, and a persistence clear is exactly how it would not be
        // there. This is `l71-shieldlock-shut`'s job on the JS side.
        expect(() => walk({
            relax: {
                ...R3,
                persistence: [{ level: 71, tag: 2, note: 'shieldlock@288,256' }],
            },
        })).toThrow(/has no activator at \(288,256\)/);
    });

    it('refuses a responder that does not open on touch', () => {
        // `lock@112,160` is a button-lock. Reading "it is an Activators" as
        // "it opens on contact" would drive a walk into a wall forever.
        expect(() => synthesizeLegs([{
            level: 71,
            targets: [{ x: 272, y: 264, touch: { lock: { x: 112, y: 160 } } }],
        }], { levelSource, boot: { ...BOOT }, relax: R3 }))
            .toThrow(/does not open on TOUCH/);
    });

    it('refuses a lock the level does not have', () => {
        expect(() => synthesizeLegs([{
            level: 71,
            targets: [{ x: 272, y: 264, touch: { lock: { x: 0, y: 0 } } }],
        }], { levelSource, boot: { ...BOOT }, relax: R3 }))
            .toThrow(/has no activator at \(0,0\)/);
    });

    it('refuses a touch under noclip, where it would verify nothing', () => {
        expect(() => synthesizeLegs([{
            level: 71,
            targets: [{ x: 272, y: 264, touch: { lock: { ...LOCK } } }],
        }], {
            levelSource,
            boot: { ...BOOT },
            relax: { ...R3, noclip: true, persistence: undefined },
        })).toThrow(/the noclip arm does not run it/);
    });

    it('refuses a malformed touch', () => {
        for (const touch of [null, {}, { lock: {} }, { lock: { x: 288 } }, 'shieldlock']) {
            expect(() => synthesizeLegs([{
                level: 71,
                targets: [{ x: 272, y: 264, touch }],
            }], { levelSource, boot: { ...BOOT }, relax: R3 }))
                .toThrow(/touch(\.lock)? must be/);
        }
    });
});

/**
 * ── R3: THE COLLECT ───────────────────────────────────────────────────
 *
 * Every rung before this one took an item by ENTERING ITS ROOM. R3 makes
 * the driver stand on the pickup and page its dialogue through, which is a
 * different verb rather than a tighter tolerance: the planner has to be
 * allowed INTO a volume it exists to avoid, the ceremony costs ticks the
 * author does not get to choose, and the presses that pay for it are one
 * mis-spacing away from being a dash.
 */
describe('R3: the collect primitive', () => {
    const R3 = Object.freeze({
        noclip: false,
        noDamage: true,
        noHazards: ['water', 'lava', 'ice', 'waterfall'],
        grants: [],
        persistence: [],
    });
    /** Level 10's sword room; the pickup is at (48,48), the boot two tiles south. */
    const BOOT = Object.freeze({ level: 10, x: 48, y: 72 });
    const SWORD = Object.freeze({ x: 48, y: 48 });

    const walk = (opts = {}, targets = null) => synthesizeLegs([{
        level: 10,
        targets: targets ?? [{ x: 56, y: 80, collect: { pickup: { ...SWORD } } }],
    }], {
        levelSource,
        boot: { ...BOOT },
        relax: R3,
        name: 'l10-collect',
        lattice: 8,
        nodeMargin: 2,
        triggerMargin: 4,
        allowGrazes: true,
        ...opts,
    });

    it('walks ONTO the pickup and pages its ceremony through', () => {
        const { tape, collects } = walk();
        expect(collects).toHaveLength(1);
        expect(collects[0]).toMatchObject({
            pickup: { tag: 'sword', x: 48, y: 48 }, item: 'sword', level: 10,
        });
        // The release count is the CEREMONY's, not a number in this file.
        expect(collects[0].releases).toBeGreaterThan(0);

        // ⚠ THE LEDGER, from an INDEPENDENT replay: grants EMPTY and the
        // property true. That pair is the whole of "collected for real".
        expect(tape.grants).toEqual([]);
        const run = runTape(tape, { levelSource });
        expect(run.grants).toEqual([]);
        expect(run.collected).toHaveLength(1);
        expect(run.collected[0]).toMatchObject({ item: 'sword', level: 10 });
        expect(run.inventory.hasSword).toBe(true);
    });

    it('spaces every press at least PRESS_GAP apart, and lands none after the end', () => {
        // ⚠ `slashTimer` is 20: one press after the ceremony is a swing and
        // two inside twenty ticks is a DASH that moves the player. So the
        // spacing is physics, and the last release must be the one that
        // ENDED the ceremony rather than a spare after it.
        const { tape, collects } = walk();
        const presses = tape.inputs.filter((s) => s.key === 'primary');
        expect(presses.length).toBe(collects[0].releases);
        for (let i = 1; i < presses.length; i++) {
            expect(presses[i].from - presses[i - 1].from,
                `gap ${i}`).toBeGreaterThanOrEqual(PRESS_GAP);
        }
        const end = collects[0].to;
        expect(presses[presses.length - 1].to).toBeLessThanOrEqual(end);
    });

    it('emits no MOVEMENT span once the ceremony has started', () => {
        // The approach's last held set lands on the tick before contact, so
        // everything from there is a press or nothing. A movement span
        // overlapping the freeze would be inert in the game and honoured by
        // nothing — the asymmetry the format exists to prevent.
        const { tape, collects } = walk();
        const from = collects[0].from + collects[0].approach;
        const moves = tape.inputs.filter((s) => s.key !== 'primary' && s.to > from);
        expect(moves).toEqual([]);
    });

    it('refuses a SECOND collect of the same pickup — the positive control', () => {
        // The pickup is gone after the first ceremony, so the approach can
        // never reach one. "The item is held afterwards" is otherwise
        // satisfied by a collect that did nothing.
        expect(() => walk({}, [
            { x: 56, y: 80, collect: { pickup: { ...SWORD } } },
            { x: 56, y: 80, collect: { pickup: { ...SWORD } } },
        ])).toThrow(/without touching it/);
    });

    it('refuses a pickup the level does not have', () => {
        expect(() => walk({}, [{ x: 56, y: 80, collect: { pickup: { x: 0, y: 0 } } }]))
            .toThrow(/has no pickup at \(0,0\)/);
    });

    it('refuses a malformed collect', () => {
        for (const collect of [null, {}, { pickup: {} }, { pickup: { x: 48 } }, 'sword']) {
            expect(() => walk({}, [{ x: 56, y: 80, collect }]))
                .toThrow(/collect(\.pickup)? must be/);
        }
    });
});
