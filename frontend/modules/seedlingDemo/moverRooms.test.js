import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import {
    chebyshevHeuristic, findEarliestArrival, planDash, replayThroughStepper,
} from './mover.js';

/**
 * The mover against REAL ROOMS — R6 slice 1's regression stratum.
 *
 * The unit tests in `mover.test.js` run on open ground with no geometry,
 * which is the right place to pin the search's own properties and the
 * wrong place to learn anything about the game. These run the same search
 * against the committed atlas through the shipped `buildLevelWorld`, with
 * the level's real solids wired into the stepper's collision seam.
 *
 * ⛔ WHAT THIS IS FOR, and it is as much the NEGATIVES as the positives.
 * §3.3's promise is that "safe-window checks become arithmetic"; slice 1's
 * measured answer is that the instrument reaches about three tiles. A
 * regression suite that only recorded the successes would let that range
 * rot silently, so the refusals are pinned too — each with the bound that
 * produced it, because "no path" and "no path within this budget at this
 * granularity" are different claims and only one of them is true.
 */
describe('the mover on real rooms', () => {
    const source = atlasLevelSource();

    /**
     * A `stepOpts` over a real level. `roles: ['blocking']` on purpose: this
     * is a GEOMETRY question and the richer role sets refuse L112 outright
     * (slice 0 named both refusals — `pod` has neither a proximity-hazard
     * volume nor a combat row). Borrowing the refusal here would test the
     * census, not the mover.
     */
    const roomOpts = (level, { without = [] } = {}) => {
        const w = buildLevelWorld(source(level), { roles: ['blocking'] });
        // ⛓ `without` DROPS NAMED OBJECT SOLIDS, and it exists because one of
        // these rooms needs it: `bosstotem` is `type = "Solid"` only until it
        // ACTIVATES (`BossTotem.as:296/315`), so a post-wake plan must not be
        // blocked by a wall that is no longer there. Dropping it silently
        // would be a crutch; naming it at the call site is a modelled state.
        const boxes = [
            ...w.solids.map((s) => s.rect),
            ...w.objectSolids.filter((s) => !without.includes(s.tag)).map((s) => s.rect),
        ];
        return {
            world: { width: w.width * 16, height: w.height * 16 },
            terrainStateAt: () => 0,
            // The collision seam is `(x, y) => blocker | null`, exactly the
            // AS3's `collideTypes(solids, x + d, y)`.
            collides: (x, y) => {
                const b = playerBoxAt(x, y);
                for (const r of boxes) {
                    if (b.x < r.right && b.right > r.x && b.y < r.bottom && b.bottom > r.y) {
                        return true;
                    }
                }
                return null;
            },
            _world: w,
            _boxes: boxes,
        };
    };

    describe('L112 — the Owl\'s room, where the shove has to happen', () => {
        const opts = roomOpts(112);

        // Slice 0 measured every pod leg clearing the lava by the same
        // 3.00 px, with the Owl's real 12x12 hitbox. The leg the fight is
        // easiest on is pod1(48,128) -> pod2(120,200), whose closest
        // approach is at s = 34 — i.e. the point below.
        const CLOSEST_APPROACH = { x: 72.05, y: 152.05 };

        it('the room builds, and the lava is where slice 0 said', () => {
            const lava = opts._world.tiles.filter((t) => t.t === 17);
            expect(lava).toHaveLength(16);
            expect(Math.min(...lava.map((c) => c.tx))).toBe(5);
            expect(Math.max(...lava.map((c) => c.tx))).toBe(9);
        });

        it('⛓ a SHORT final approach to the shove point is planned and replays exactly', () => {
            // Start one tile north-west of the closest-approach point: the
            // last leg of an approach, which is the length the mover is for.
            const start = { x: CLOSEST_APPROACH.x - 8, y: CLOSEST_APPROACH.y - 8, vx: 0, vy: 0 };
            const d = planDash({
                start,
                endRegion: (s) => Math.abs(s.x - CLOSEST_APPROACH.x) <= 2
                    && Math.abs(s.y - CLOSEST_APPROACH.y) <= 2,
                heuristicTarget: CLOSEST_APPROACH,
                stepOpts: opts,
                timelineName: null,
                dwell: 2,
                limits: { maxTicks: 120, maxExpansions: 60000 },
            });
            expect(d.ok, d.bound ?? '').toBe(true);
            expect(d.replay.drift).toBe(0);
            expect(d.certifiedAgainst.claim).toMatch(/NOT "safe"/);
        });

        it('⛓⛓ AND A 62 px LEG SUCCEEDS HERE — WALLS PRUNE THE SEARCH', () => {
            // ⚠ NOT (32,208), THE TELEPORTER'S OWN LANDING POINT. L111's
            // `teleporter@128,48` declares `playerx=32 playery=208`, and
            // under the shipped collision model the player's box THERE
            // overlaps a solid — so a search from it cannot move at all and
            // any verdict would have been true for the wrong reason. That
            // (32,208) is blocked is itself worth carrying: the game's
            // teleport does not collision-check its destination.
            //
            // ⛔⛔ AND THIS TEST WAS WRITTEN TO ASSERT A REFUSAL. `MOVER_RANGE`
            // says 64 px does not answer at dwell 4, so a 62 px leg across
            // the room should have been out of reach. It is not — because
            // that table is measured on OPEN GROUND, where every direction
            // is available and the reachable set grows unchecked. L112 is
            // walled, the walls collapse the state space, and the same
            // search finishes. ⇒ **the range table is a WORST CASE, not a
            // ceiling**, and geometry is the search's friend rather than its
            // difficulty. Pinning the success is what keeps that true.
            const r = findEarliestArrival({
                start: { x: 40, y: 200, vx: 0, vy: 0 },
                accept: (s) => Math.abs(s.x - CLOSEST_APPROACH.x) <= 2
                    && Math.abs(s.y - CLOSEST_APPROACH.y) <= 2,
                heuristic: chebyshevHeuristic(CLOSEST_APPROACH),
                stepOpts: opts,
                dwell: 4,
                limits: { maxTicks: 200, maxExpansions: 20000 },
            });
            expect(r.ok, r.bound ?? '').toBe(true);
            // Not optimal — dwell 4 — and the certificate must say so.
            expect(r.optimal).toBe(false);
            expect(replayThroughStepper(r, opts).drift).toBe(0);
            // Every state stays out of the lava the fight is ABOUT.
            const lava = opts._world.tiles.filter((t) => t.t === 17).map((t) => t.rect);
            for (const st of replayThroughStepper(r, opts).states) {
                const inLava = lava.some((rect) => st.x >= rect.x && st.x < rect.right
                    && st.y >= rect.y && st.y < rect.bottom);
                expect(inLava, `tick ${st.tick} at (${st.x},${st.y})`).toBe(false);
            }
        });

        it('⛔ and a budget too small to finish still REFUSES with its bound', () => {
            // The negative that keeps the positive honest: the same query
            // under a budget it cannot meet must name the bound rather than
            // return a partial plan.
            const r = findEarliestArrival({
                start: { x: 40, y: 200, vx: 0, vy: 0 },
                accept: (s) => Math.abs(s.x - CLOSEST_APPROACH.x) <= 2
                    && Math.abs(s.y - CLOSEST_APPROACH.y) <= 2,
                heuristic: chebyshevHeuristic(CLOSEST_APPROACH),
                stepOpts: opts,
                dwell: 1,
                limits: { maxTicks: 200, maxExpansions: 3000 },
            });
            expect(r.ok).toBe(false);
            expect(r.bound).toMatch(/maxExpansions=3000/);
            expect(r.closest).toBeTruthy();
        });
    });

    describe('L43 — the totem arena, under a floor that moves', () => {
        // ⛔ WITHOUT THE BOSS'S OWN WALL. `bosstotem@152,168` is a Solid over
        // x[112,192) y[180,212) until it activates, and the clamp only exists
        // AFTER it activates — so a plan against the descending floor is a
        // plan in a room where that wall is already gone. The first cut of
        // this test started the player at (152,200), which is INSIDE that
        // box, and the search correctly found no path at all.
        const opts = roomOpts(43, { without: ['bosstotem'] });

        it('the room builds and the arena columns are where the census says', () => {
            expect(opts._world.width).toBe(19);
            expect(opts._world.height).toBe(35);
        });

        /**
         * ⛓⛓ THE CLAMP AS A TIMELINE — the shape §3.3 calls a boss-coupled
         * timeline, in its simplest form.
         *
         * `BossTotem`'s clamp is `p.y = y + 44` and his `y` descends 1 px per
         * tick once `rate` has ramped, so the floor SWEEPS 180 -> 352. A
         * plan made against a static floor is a plan against one tick of a
         * cycle. Here the floor is a function of the tick and the mover has
         * to stay under it.
         */
        it('plans a descent that stays below a DESCENDING floor', () => {
            // ⚠ THE ARENA'S OWN FLOOR IS AT y 220, NOT 180. A column scan at
            // x = 152 with the boss's wall already dropped is solid from 180
            // to 212 and free from 220 down — so the clamp's SPAWN value of
            // 212 sits inside static geometry and the first tick a player can
            // actually be under it is well below. The first cut of this test
            // started at (152,200) and the search correctly found no path;
            // the defect was the stance, not the mover.
            const floorAt = (tick) => 220 + tick; // the clamp, 1 px/tick
            const start = { x: 152, y: 232, vx: 0, vy: 0 };
            const d = planDash({
                start,
                endRegion: (s) => s.y >= 264,
                heuristicTarget: { x: 152, y: 264 },
                stepOpts: opts,
                // ⛔ The player is FORBIDDEN above the floor: the clamp would
                // teleport them, and a plan that relied on being teleported
                // is a plan about the assignment, not about movement.
                forbiddenAt: (tick, _x, y) => y < floorAt(tick),
                timelineName: 'BossTotem clamp, 1 px/tick from 180',
                dwell: 3,
                limits: { maxTicks: 200, maxExpansions: 80000 },
            });
            expect(d.ok, d.bound ?? '').toBe(true);
            expect(d.replay.drift).toBe(0);
            // Every state of the plan must be below its own tick's floor —
            // asserted from the REPLAY, not from the search's bookkeeping.
            for (const s of d.replay.states) {
                expect(s.y, `tick ${s.tick}`).toBeGreaterThanOrEqual(floorAt(s.tick));
            }
            expect(d.certifiedAgainst.timeline).toMatch(/clamp/);
        });

        it('⛔ and a floor that descends FASTER than the player can refuses', () => {
            // The negative that makes the positive mean something: at 3
            // px/tick the floor outruns a player whose downward speed peaks
            // at 1.6, so no plan exists and the refusal must say which bound
            // it hit rather than reporting a plan that ignores the timeline.
            const fast = (tick) => 220 + 3 * tick;
            const r = findEarliestArrival({
                start: { x: 152, y: 232, vx: 0, vy: 0 },
                accept: (s) => s.y >= 380,
                heuristic: chebyshevHeuristic({ x: 152, y: 380 }),
                stepOpts: opts,
                forbiddenAt: (tick, _x, y) => y < fast(tick),
                dwell: 2,
                limits: { maxTicks: 120, maxExpansions: 40000 },
            });
            expect(r.ok).toBe(false);
            expect(r.bound).toMatch(/maxTicks|maxExpansions/);
        });
    });

    describe('L19 — the ShieldBoss band', () => {
        const opts = roomOpts(19);

        it('the 48x16 stand-under band is reachable, and the body blocks', () => {
            // Slice 0: the body is (104,64) with a 48x48 box over
            // x[80,128) y[40,88), and the band is x[80,128) y[88,104).
            // A plan from the room's south into the band must exist…
            const intoBand = planDash({
                start: { x: 104, y: 120, vx: 0, vy: 0 },
                endRegion: (s) => s.x >= 82 && s.x <= 126 && s.y >= 90 && s.y <= 102,
                heuristicTarget: { x: 104, y: 96 },
                stepOpts: opts,
                timelineName: null,
                dwell: 2,
                limits: { maxTicks: 120, maxExpansions: 60000 },
            });
            expect(intoBand.ok, intoBand.bound ?? '').toBe(true);
            expect(intoBand.replay.drift).toBe(0);

            // …and every state of it must stay OUT of the boss's body box,
            // because `"ShieldBoss"` is in `Mobile.solids`. This is the
            // check that would catch a collision seam wired to the wrong
            // world.
            for (const s of intoBand.replay.states) {
                const inBody = s.x > 80 && s.x < 128 && s.y > 40 && s.y < 88;
                expect(inBody, `tick ${s.tick} at (${s.x},${s.y})`).toBe(false);
            }
        });
    });
});
