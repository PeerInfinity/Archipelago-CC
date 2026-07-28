import { describe, it, expect } from 'vitest';
import { findPath, bestPathKey, stepsToInputs, stepsToActions } from './mazeAutopather.js';

// Minimal world fixture: tiles array of 0 (floor) / 1 (wall). Caller
// supplies entrance and exits.
function makeWorld({ width, height, tiles = null, entrance = { x: 0, y: 0 }, exits = [], itemLocations = [] }) {
    const t = tiles ?? new Int8Array(width * height); // default: all floor
    const exitsMap = new Map();
    for (const e of exits) {
        exitsMap.set(e.exit_id, {
            exit_id: e.exit_id, x: e.x, y: e.y, side: e.side ?? null,
        });
    }
    const itemLocationNames = new Map();
    for (const loc of itemLocations) {
        itemLocationNames.set(`${loc.x},${loc.y}`, loc.name);
    }
    return {
        width, height, tiles: t,
        entrance: { x: entrance.x, y: entrance.y },
        exits: exitsMap,
        itemLocationNames,
    };
}

describe('mazeAutopather — findPath', () => {
    describe('tile target', () => {
        it('returns trivial path when from === to', () => {
            const w = makeWorld({ width: 3, height: 3 });
            const r = findPath(w, { x: 1, y: 1 }, { kind: 'tile', x: 1, y: 1 });
            expect(r).toEqual({ steps: [{ x: 1, y: 1 }], length: 0 });
        });

        it('walks a straight line on an open grid', () => {
            const w = makeWorld({ width: 5, height: 1 });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 });
            expect(r.length).toBe(4);
            expect(r.steps).toHaveLength(5);
            expect(r.steps[0]).toEqual({ x: 0, y: 0 });
            expect(r.steps[4]).toEqual({ x: 4, y: 0 });
        });

        it('routes around walls', () => {
            // 5x3 grid with vertical wall at x=2, y=1 and y=2; must go around via y=0
            const tiles = new Int8Array(15);
            tiles[5 + 2] = 1; // (2,1) wall
            tiles[10 + 2] = 1; // (2,2) wall
            const w = makeWorld({ width: 5, height: 3, tiles });
            const r = findPath(w, { x: 1, y: 1 }, { kind: 'tile', x: 3, y: 1 });
            expect(r).not.toBeNull();
            expect(r.length).toBe(4);
            // Path should go through (2, 0)
            expect(r.steps.some((s) => s.x === 2 && s.y === 0)).toBe(true);
        });

        it('returns null when target is unreachable', () => {
            const tiles = new Int8Array(9).fill(1);
            tiles[0] = 0; // (0,0) floor
            tiles[4] = 0; // (1,1) floor (isolated)
            const w = makeWorld({ width: 3, height: 3, tiles });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'tile', x: 1, y: 1 });
            expect(r).toBeNull();
        });

        it('returns null when from is on a wall tile', () => {
            const tiles = new Int8Array(9);
            tiles[4] = 1; // (1,1) wall
            const w = makeWorld({ width: 3, height: 3, tiles });
            const r = findPath(w, { x: 1, y: 1 }, { kind: 'tile', x: 0, y: 0 });
            expect(r).toBeNull();
        });
    });

    describe('exit target', () => {
        it('finds an exit by id', () => {
            const w = makeWorld({
                width: 5, height: 1,
                exits: [{ exit_id: 'east', x: 4, y: 0 }],
            });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'exit', exitId: 'east' });
            expect(r).not.toBeNull();
            expect(r.length).toBe(4);
            expect(r.steps.at(-1)).toEqual({ x: 4, y: 0 });
        });

        it('returns null for an unknown exit id', () => {
            const w = makeWorld({
                width: 5, height: 1,
                exits: [{ exit_id: 'east', x: 4, y: 0 }],
            });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'exit', exitId: 'nonexistent' });
            expect(r).toBeNull();
        });
    });

    describe('location target', () => {
        it('finds a location tile by name', () => {
            const w = makeWorld({
                width: 5, height: 1,
                itemLocations: [{ x: 3, y: 0, name: 'Slay Yorgle' }],
            });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'location', locationName: 'Slay Yorgle' });
            expect(r).not.toBeNull();
            expect(r.length).toBe(3);
            expect(r.steps.at(-1)).toEqual({ x: 3, y: 0 });
        });

        it('returns null when the location name is not in the world', () => {
            const w = makeWorld({
                width: 5, height: 1,
                itemLocations: [{ x: 3, y: 0, name: 'Slay Yorgle' }],
            });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'location', locationName: 'Other' });
            expect(r).toBeNull();
        });
    });

    describe('closestUnexplored target', () => {
        it('walks one step into the closest unseen walkable tile', () => {
            // 5x1 grid; player at (0,0), seen tiles up to (2,0); the
            // closest unseen walkable tile is (3,0). Path = three steps
            // ending on the unseen tile (which becomes seen on arrival).
            const w = makeWorld({ width: 5, height: 1 });
            const seenTiles = new Set(['0,0', '1,0', '2,0']);
            const r = findPath(
                w, { x: 0, y: 0 },
                { kind: 'closestUnexplored' },
                { seenTiles },
            );
            expect(r).not.toBeNull();
            expect(r.length).toBe(3);
            expect(r.steps.at(-1)).toEqual({ x: 3, y: 0 });
        });

        it('returns null when every walkable tile is already seen', () => {
            // Whole grid is seen → no unseen tile to walk to.
            const w = makeWorld({ width: 3, height: 1 });
            const seenTiles = new Set(['0,0', '1,0', '2,0']);
            const r = findPath(
                w, { x: 0, y: 0 },
                { kind: 'closestUnexplored' },
                { seenTiles },
            );
            expect(r).toBeNull();
        });

        it('returns null when seenTiles is missing', () => {
            const w = makeWorld({ width: 3, height: 1 });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'closestUnexplored' });
            expect(r).toBeNull();
        });

        it('walks one step into an unseen neighbor when the player\'s tile is on the boundary', () => {
            // Player at (1,0); seen = (0,0), (1,0); (2,0) is unseen.
            // The goal is (2,0) — one step into the unseen.
            // (Earlier, the closestUnexplored target was the player's
            // own frontier tile and the path returned length 0 — that
            // meant walkToTile no-oped and the explore action parked.)
            const w = makeWorld({ width: 3, height: 1 });
            const seenTiles = new Set(['0,0', '1,0']);
            const r = findPath(
                w, { x: 1, y: 0 },
                { kind: 'closestUnexplored' },
                { seenTiles },
            );
            expect(r).not.toBeNull();
            expect(r.length).toBe(1);
            expect(r.steps.at(-1)).toEqual({ x: 2, y: 0 });
        });

        it('returns null when all unseen tiles are unreachable behind walls', () => {
            // 3x1 with a wall at (1,0): the only walkable tiles are
            // (0,0) and (2,0). (0,0) seen, (2,0) unseen but unreachable.
            const tiles = new Int8Array(3);
            tiles[1] = 1;
            const w = makeWorld({ width: 3, height: 1, tiles });
            const seenTiles = new Set(['0,0']);
            const r = findPath(
                w, { x: 0, y: 0 },
                { kind: 'closestUnexplored' },
                { seenTiles },
            );
            expect(r).toBeNull();
        });
    });

    describe('bestPathKey', () => {
        it('composes exit-target keys', () => {
            expect(bestPathKey('Forest', 'south_entrance', { kind: 'exit', exitId: 'north_exit' }))
                .toBe('Forest|south_entrance|exit:north_exit');
        });

        it('composes location-target keys', () => {
            expect(bestPathKey('Forest', 'south_entrance', { kind: 'location', locationName: 'Slay Yorgle' }))
                .toBe('Forest|south_entrance|loc:Slay Yorgle');
        });

        it('uses "entrance" when fromExitId is null/undefined', () => {
            expect(bestPathKey('Forest', null, { kind: 'exit', exitId: 'e' }))
                .toBe('Forest|entrance|exit:e');
            expect(bestPathKey('Forest', undefined, { kind: 'exit', exitId: 'e' }))
                .toBe('Forest|entrance|exit:e');
        });

        it('returns null on missing fields', () => {
            expect(bestPathKey('', 'in', { kind: 'exit', exitId: 'e' })).toBeNull();
            expect(bestPathKey('R', 'in', null)).toBeNull();
            expect(bestPathKey('R', 'in', { kind: 'exit' })).toBeNull(); // no exitId
            expect(bestPathKey('R', 'in', { kind: 'location' })).toBeNull(); // no locationName
            expect(bestPathKey('R', 'in', { kind: 'tile', x: 1, y: 1 })).toBeNull(); // unsupported kind
        });
    });

    describe('inventory / obstacle awareness', () => {
        function withObstacle({ width = 5, height = 1, obstacleAt, obstacleId = 'door_red', obstacleLib = {} } = {}) {
            const w = makeWorld({ width, height });
            w.obstacles = new Map([[`${obstacleAt.x},${obstacleAt.y}`, obstacleId]]);
            w.obstacleLib = obstacleLib;
            return w;
        }

        it('routes through obstacle tiles when inventory is omitted (geometry-only mode)', () => {
            // Obstacle blocks the only path; without inventory awareness
            // we should still find a route (geometric fallback).
            const w = withObstacle({
                obstacleAt: { x: 2, y: 0 },
                obstacleId: 'door_red',
                obstacleLib: { door_red: { id: 'door_red', clear_set: [['key_red']] } },
            });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 });
            expect(r).not.toBeNull();
            expect(r.length).toBe(4); // routes through (2,0)
        });

        it('blocks routing through unclearable obstacles when inventory is provided', () => {
            const w = withObstacle({
                obstacleAt: { x: 2, y: 0 },
                obstacleId: 'door_red',
                obstacleLib: { door_red: { id: 'door_red', clear_set: [['key_red']] } },
            });
            const r = findPath(
                w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 },
                { inventory: new Set() }, // empty inventory
            );
            // 5x1 corridor with a locked door at (2,0) and no key —
            // unreachable.
            expect(r).toBeNull();
        });

        it('passes through clearable obstacles when the player has the key', () => {
            const w = withObstacle({
                obstacleAt: { x: 2, y: 0 },
                obstacleId: 'door_red',
                obstacleLib: { door_red: { id: 'door_red', clear_set: [['key_red']] } },
            });
            const r = findPath(
                w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 },
                { inventory: new Set(['key_red']) },
            );
            expect(r).not.toBeNull();
            expect(r.length).toBe(4);
        });
    });

    describe('excludeOtherExits', () => {
        it('routes through arbitrary exits by default (geometry-only)', () => {
            // 5x1 with an exit at (2,0). Default behaviour (no exit
            // exclusion) lets the path pass through.
            const w = makeWorld({
                width: 5, height: 1,
                exits: [
                    { exit_id: 'mid', x: 2, y: 0 },
                    { exit_id: 'far', x: 4, y: 0 },
                ],
            });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 });
            expect(r).not.toBeNull();
            expect(r.length).toBe(4);
        });

        it('treats off-route exits as walls when excludeOtherExits is set', () => {
            const w = makeWorld({
                width: 5, height: 1,
                exits: [
                    { exit_id: 'mid', x: 2, y: 0 }, // off-route exit blocks the corridor
                    { exit_id: 'far', x: 4, y: 0 },
                ],
            });
            const r = findPath(
                w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 },
                { excludeOtherExits: true },
            );
            // 5x1 corridor with the off-route exit blocking → no path
            expect(r).toBeNull();
        });

        it('still allows the goal tile itself to be an exit when excludeOtherExits is on', () => {
            const w = makeWorld({
                width: 5, height: 1,
                exits: [{ exit_id: 'far', x: 4, y: 0 }],
            });
            const r = findPath(
                w, { x: 0, y: 0 }, { kind: 'exit', exitId: 'far' },
                { excludeOtherExits: true },
            );
            expect(r).not.toBeNull();
            expect(r.steps.at(-1)).toEqual({ x: 4, y: 0 });
        });
    });

    describe('stepsToInputs', () => {
        it('returns empty for a zero-or-one-step path', () => {
            expect(stepsToInputs([])).toEqual([]);
            expect(stepsToInputs([{ x: 0, y: 0 }])).toEqual([]);
        });

        it('encodes cardinal moves as N/S/E/W', () => {
            const steps = [
                { x: 0, y: 0 },
                { x: 1, y: 0 }, // E
                { x: 1, y: 1 }, // S
                { x: 0, y: 1 }, // W
                { x: 0, y: 0 }, // N
            ];
            expect(stepsToInputs(steps)).toEqual(['E', 'S', 'W', 'N']);
        });

        it('emits WAIT for duplicate-tile entries', () => {
            const steps = [
                { x: 0, y: 0 },
                { x: 1, y: 0 }, // E
                { x: 1, y: 0 }, // wait
                { x: 2, y: 0 }, // E
            ];
            expect(stepsToInputs(steps)).toEqual(['E', 'WAIT', 'E']);
        });
    });

    describe('stepsToActions', () => {
        it('returns empty for a zero-or-one-step path', () => {
            expect(stepsToActions([])).toEqual([]);
            expect(stepsToActions([{ x: 0, y: 0 }])).toEqual([]);
        });

        it('encodes cardinal moves as {type:move, dir}', () => {
            const steps = [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 1 },
            ];
            expect(stepsToActions(steps)).toEqual([
                { type: 'move', dir: 'E' },
                { type: 'move', dir: 'S' },
            ]);
        });

        it('emits {type:wait} for duplicate-tile entries', () => {
            const steps = [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 0 }, // wait
                { x: 1, y: 0 }, // wait
                { x: 2, y: 0 },
            ];
            expect(stepsToActions(steps)).toEqual([
                { type: 'move', dir: 'E' },
                { type: 'wait' },
                { type: 'wait' },
                { type: 'move', dir: 'E' },
            ]);
        });
    });

    describe('hazard-aware planning (time-expanded BFS)', () => {
        function linearHazard(tiles, phase = 0) {
            return {
                shape: 'linear',
                length: tiles.length,
                tiles,
                cycleLength: 2 * (tiles.length - 1),
                phase,
            };
        }

        it('returns the plain straight-line path when no hazards provided', () => {
            const w = makeWorld({ width: 5, height: 1 });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 });
            expect(r.steps).toEqual([
                { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
                { x: 3, y: 0 }, { x: 4, y: 0 },
            ]);
        });

        it('returns the plain path when hazards array is empty', () => {
            const w = makeWorld({ width: 5, height: 1 });
            const r = findPath(
                w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 },
                { hazards: [] },
            );
            expect(r.length).toBe(4);
        });

        it('routes around a hazard when an alternate route exists', () => {
            // 5x3 open grid. A length-3 hazard cycles at (1,1)→(2,1)→(3,1)
            // (cycle 4) covering the middle row. Player at (0,1)
            // wants (4,1). Direct path through y=1 has hazard tiles
            // at every step — but the player can route via y=0 or y=2.
            const w = makeWorld({ width: 5, height: 3 });
            const haz = linearHazard(
                [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
                0,
            );
            const r = findPath(
                w, { x: 0, y: 1 }, { kind: 'tile', x: 4, y: 1 },
                { hazards: [haz] },
            );
            expect(r).not.toBeNull();
            // The route should NOT lie entirely on y=1. Verify by
            // checking at least one step deviates.
            const hasDeviation = r.steps.some((s) => s.y !== 1);
            expect(hasDeviation).toBe(true);
        });

        it('rejects moves that would step into hazard.next at the right turn', () => {
            // Single-row corridor: 4 tiles. Hazard length-2 cycle
            // between (1,0) and (2,0) starting at phase 0
            // (cur=(1,0), next=(2,0)). Player at (0,0) wants (3,0).
            // Direct east-walk: turn 0 to (1,0) — Rule 2 fires (head-
            // on into facing). All other moves off-grid. → no path.
            const w = makeWorld({ width: 4, height: 1 });
            const haz = linearHazard([{ x: 1, y: 0 }, { x: 2, y: 0 }], 0);
            const r = findPath(
                w, { x: 0, y: 0 }, { kind: 'tile', x: 3, y: 0 },
                { hazards: [haz] },
            );
            // Player at (0,0). At turn 0, hazard at (1,0) facing (2,0).
            //   Move E to (1,0): Rule 1 → blocked (1,0 != hazard.next=2,0;
            //     actually Rule 1 doesn't fire). Rule 2: to=(1,0)=hazard.cur,
            //     from=(0,0)≠hazard.next=(2,0). Rule 2 doesn't fire.
            //     So Move E IS allowed at turn 0. But then turn 1
            //     hazard at (2,0). Move E from (1,0) to (2,0) at turn 1:
            //     hazard.cur=(2,0), hazard.next=(1,0). Rule 1: to=(2,0)=
            //     hazard.next? No, hazard.next=(1,0). Rule 2: to=(2,0)=
            //     hazard.cur, from=(1,0)=hazard.next. BLOCKED.
            //     So player can step to (1,0) at turn 0, but is then
            //     trapped — can't go E without head-on, can't go back
            //     to (0,0) at turn 1 (hazard moves to (1,0), Rule 1
            //     would block returning). Wait isn't an option in v1.
            //     → no path.
            expect(r).toBeNull();
        });

        it('finds a path when hazard cycling lets the player phase past', () => {
            // 5x2 grid. Hazard cycles (1,0)↔(2,0) (cycle 2). At turn
            // 0 the hazard is at (1,0) facing (2,0). A direct
            // east-walk fails at turn 1 (head-on into the cycling
            // hazard), but the planner can detour through y=1 to
            // reach (4,0) — confirming the time-expanded BFS doesn't
            // give up just because the straight path is blocked.
            //
            // Note: the planner CAN step onto a hazard's current tile
            // when it's about to step off elsewhere — co-location at
            // the current tile is allowed (only Rule 2's head-on is
            // blocked). So the path's tile set may include (1,0) or
            // (2,0); what matters is that every step is hazard-safe
            // per validateMove at its turn.
            const w = makeWorld({ width: 5, height: 2 });
            const haz = linearHazard([{ x: 1, y: 0 }, { x: 2, y: 0 }], 0);
            const r = findPath(
                w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 },
                { hazards: [haz] },
            );
            expect(r).not.toBeNull();
            expect(r.steps[0]).toEqual({ x: 0, y: 0 });
            expect(r.steps[r.steps.length - 1]).toEqual({ x: 4, y: 0 });
            // Path is 4-connected at every step.
            for (let i = 1; i < r.steps.length; i++) {
                const dx = Math.abs(r.steps[i].x - r.steps[i - 1].x);
                const dy = Math.abs(r.steps[i].y - r.steps[i - 1].y);
                expect(dx + dy).toBe(1);
            }
            // Plain BFS (no hazards) would find a length-4 direct
            // path. Hazard-aware planning has to detour, so the path
            // is strictly longer than 4.
            expect(r.length).toBeGreaterThan(4);
        });

        it('allowWait ignored when no hazards (would just lengthen paths)', () => {
            // Trivial 5x1 corridor, no hazards. Even with allowWait,
            // the planner produces the plain shortest path — no wait
            // insertions, no extra cost.
            const w = makeWorld({ width: 5, height: 1 });
            const r = findPath(
                w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 },
                { allowWait: true },
            );
            expect(r.length).toBe(4);
            for (let i = 1; i < r.steps.length; i++) {
                expect(r.steps[i]).not.toEqual(r.steps[i - 1]);
            }
        });

        it('with allowWait, can shorten a route by waiting for the hazard cycle', () => {
            // 5x3 grid. A length-3 hazard sweeps the middle row left-
            // to-right at phases 0..3 (cycle 4). The plain detour
            // via row 0 OR row 2 is 6 moves (2 verticals + 4
            // easts). With allowWait, the player can take the
            // shorter 4-move route across the middle row by waiting
            // for the hazard to be elsewhere on a step's turn.
            //
            // What we verify here is the looser version: with
            // allowWait the path is AT MOST as long as the plain-
            // BFS path, and the geometry is still valid (4-connected
            // or duplicate-tile waits). Edge cases (when wait yields
            // strictly shorter) depend on BFS tie-breaking, which we
            // don't pin down at the unit-test level.
            const w = makeWorld({ width: 5, height: 3 });
            const haz = linearHazard(
                [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }], 0,
            );
            const noWait = findPath(
                w, { x: 0, y: 1 }, { kind: 'tile', x: 4, y: 1 },
                { hazards: [haz] },
            );
            const withWait = findPath(
                w, { x: 0, y: 1 }, { kind: 'tile', x: 4, y: 1 },
                { hazards: [haz], allowWait: true },
            );
            expect(noWait).not.toBeNull();
            expect(withWait).not.toBeNull();
            // allowWait should never find a strictly worse path —
            // the search space is a strict superset of the no-wait
            // search.
            expect(withWait.length).toBeLessThanOrEqual(noWait.length);
            // 4-connected check (each step is a cardinal move OR a
            // wait — Manhattan distance 0 or 1).
            for (let i = 1; i < withWait.steps.length; i++) {
                const dx = Math.abs(withWait.steps[i].x - withWait.steps[i - 1].x);
                const dy = Math.abs(withWait.steps[i].y - withWait.steps[i - 1].y);
                expect(dx + dy).toBeLessThanOrEqual(1);
            }
        });

        it('wait neighbor is gated by Rule 1 (no hazard.next at current tile)', () => {
            // Player at (1,0), hazard at (0,0) facing (1,0). Waiting
            // at the player's tile would be a stomp — Rule 1 blocks
            // wait. So allowWait shouldn't help find a "wait then
            // move" route from this start.
            const w = makeWorld({ width: 3, height: 1 });
            const haz = linearHazard(
                [{ x: 0, y: 0 }, { x: 1, y: 0 }], 0,
            );
            const r = findPath(
                w, { x: 1, y: 0 }, { kind: 'tile', x: 2, y: 0 },
                { hazards: [haz], allowWait: true },
            );
            // The pre-tick stomp check is the substrate's
            // responsibility — at the planner level we just verify
            // the first emitted step isn't a wait at the (stomp-
            // prone) start position.
            if (r) {
                // first step is either a move out of the stomp tile
                // or the trivial-path early-return. Should NOT be a
                // wait at (1,0) since that would have been blocked.
                const firstStep = r.steps[1];
                if (firstStep) {
                    const wasWait = firstStep.x === 1 && firstStep.y === 0;
                    expect(wasWait).toBe(false);
                }
            }
        });

        it('mutating the original hazards array does not affect the search', () => {
            // Regression: the search snapshots hazards-at-turn-t into
            // fresh objects each turn; the input array should remain
            // untouched by the search.
            const w = makeWorld({ width: 5, height: 3 });
            const haz = linearHazard(
                [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
                0,
            );
            const snap = { ...haz };
            findPath(
                w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 },
                { hazards: [haz] },
            );
            // Phase + tiles preserved.
            expect(haz.phase).toBe(snap.phase);
            expect(haz.tiles).toBe(snap.tiles);
        });
    });

    describe('error / edge cases', () => {
        it('returns null on missing world', () => {
            expect(findPath(null, { x: 0, y: 0 }, { kind: 'tile', x: 1, y: 1 })).toBeNull();
        });
        it('returns null on missing from', () => {
            expect(findPath(makeWorld({ width: 3, height: 3 }), null, { kind: 'tile', x: 1, y: 1 })).toBeNull();
        });
        it('returns null on missing target', () => {
            expect(findPath(makeWorld({ width: 3, height: 3 }), { x: 0, y: 0 }, null)).toBeNull();
        });
        it('returns null on unknown target kind', () => {
            const w = makeWorld({ width: 3, height: 3 });
            expect(findPath(w, { x: 0, y: 0 }, { kind: 'made_up' })).toBeNull();
        });
    });
});

describe('mazeAutopather — clearanceOpts', () => {
    // findPath must judge a rule-typed gate with the SAME evaluator the caller
    // will hand `step`. Without this bag the planner falls back to the
    // procgen-local subset evaluator and can route through a door the engine
    // then refuses (or around one that is really open) — the two-evaluator
    // divergence that made the maze panel's walkTo path disagree with its own
    // keyboard path.
    const OBSTACLES = {
        gate: { clear_set_type: 'rule', clear_rule: { rule: 'CountItem', args: { item: 'x' } } },
    };
    // 5x2: row 0 floor, row 1 wall, so the gate at (2,0) is the only way past.
    const corridor = () => {
        const tiles = new Int8Array(10);
        for (let x = 0; x < 5; x++) tiles[5 + x] = 1;
        const w = makeWorld({ width: 5, height: 2, tiles });
        w.obstacles = new Map([['2,0', 'gate']]);
        w.obstacleLib = OBSTACLES;
        return w;
    };
    const walk = (opts) => findPath(corridor(), { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 }, opts);

    it('without an evaluator, an unexpressible rule blocks the route', () => {
        expect(walk({ inventory: new Set() })).toBeNull();
    });

    it('forwards the bag so the caller\'s evaluator decides', () => {
        const seen = [];
        const r = walk({
            inventory: new Set(),
            clearanceOpts: { evaluateRule: (rule) => { seen.push(rule.rule); return true; } },
        });
        expect(r?.length).toBe(4);
        expect(seen).toContain('CountItem');
    });

    it('an evaluator that refuses still blocks', () => {
        expect(walk({
            inventory: new Set(),
            clearanceOpts: { evaluateRule: () => false },
        })).toBeNull();
    });

    it('a Map inventory keeps counts, so a count gate needs the count', () => {
        const w = () => {
            const c = corridor();
            c.obstacleLib = {
                gate: {
                    clear_set_type: 'rule',
                    clear_rule: { rule: 'Has', args: { item_name: 'Swim', count: 2 } },
                },
            };
            return c;
        };
        const goal = { kind: 'tile', x: 4, y: 0 };
        expect(findPath(w(), { x: 0, y: 0 }, goal, { inventory: new Map([['Swim', 1]]) })).toBeNull();
        expect(findPath(w(), { x: 0, y: 0 }, goal, { inventory: new Map([['Swim', 2]]) })?.length).toBe(4);
        // A count-collapsed Set can never satisfy it — which is precisely why
        // the panel now carries counts all the way to the planner.
        expect(findPath(w(), { x: 0, y: 0 }, goal, { inventory: new Set(['Swim']) })).toBeNull();
    });
});
