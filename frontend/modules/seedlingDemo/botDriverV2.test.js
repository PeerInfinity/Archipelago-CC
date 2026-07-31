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

import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { spawnFromBoot } from './playerPhysicsV1.js';
import { playerBoxAt, terrainProbeRect } from './playerPhysicsV2.js';
import { runTapeToStream } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { DEFAULT_TOLERANCE } from './botDriverV1.js';
import {
    isWalkableTile,
    planTilePath,
    planWaypoints,
    plannerObstacleAt,
    controllerPathClear,
    synthesizeLegs,
    synthesizeWalk,
    tileAt,
    tileCentre,
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

    it('reports a PIXELMASK instead of throwing, which is the whole point', () => {
        // `collidesSolid` throws on a pixelmask deliberately, so the physics
        // dies loudly on one. A planner cannot route around an obstacle by
        // catching the exception that says it already hit it, and one stray
        // probe would abort the search. Two faces, one seam.
        const building = level0.pixelmasks.find((p) => p.cls.as3 === 'Building');
        const c = { x: building.rect.x + 8, y: building.rect.y + 8 };
        expect(() => level0.collidesSolid(playerBoxAt(c.x, c.y))).toThrow(/pixelmask/);
        const o = plannerObstacleAt(level0, c.x, c.y);
        expect(o?.kind).toBe('pixelmask');
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
        expect(plannerObstacleAt(level0, c.x, c.y)?.kind).toBe('terrain');
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
            .toThrow(/goal tile \(9,9\).*not walkable: terrain Water/s);
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
        expect(blocked).toContain('terrain');
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
        expect(plannerObstacleAt(level0, 112, 192)?.kind).toBe('terrain');
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
            .toThrow(/not walkable: terrain Water/);
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
