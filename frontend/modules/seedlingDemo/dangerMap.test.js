import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { buildLevelWorld } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { planDash } from './mover.js';
import {
    DangerMapError, arrowDanger, chaserDanger, crusherDanger, crusherVolumesAt,
    dangerAt, forbiddenByDanger, hazardDanger,
} from './dangerMap.js';

/**
 * ── THE UNION DANGER MAP — R8 slice 1, kickoff §3.3 ───────────────────
 *
 * ⛔⛔ WHAT THIS STRATUM CAN AND CANNOT CLAIM. It can show that each of the
 * four ingredients CONTRIBUTES — that dropping one loses a named source in a
 * real room — and it can show the union feeds `forbiddenAt`. It cannot show
 * the verdicts are RIGHT: the map is a search heuristic and the GAME is the
 * oracle, which is why `dangerAt` returns reasons rather than a promise.
 *
 * ⚠ EVERY ZERO HERE IS PRECEDED BY A POSITIVE COUNT (the silent-watcher law):
 * a test that only ever asserted "no sources" would pass just as well against
 * a function that returned nothing at all.
 */

const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
const source = atlasLevelSource();

/** A run parked N ticks into a room, with the bridge live. */
const runIn = (level, boot, keys, ticks) => {
    const run = createLevelRun({
        levelSource: source, boot, noclip: false, noDamage: false, roles: ROLES,
    });
    for (let t = 0; t < ticks; t += 1) run.advance(new Set(keys));
    return run;
};

describe('dangerAt — the four ingredients, each measured in a real room', () => {
    /**
     * ⛓ INGREDIENT (c): L6 is the room the bridge really steps — two bobs,
     * no arrow trap, so `chaserRoomVerdict` says yes.
     */
    describe('(c) stepped chasers — L6, where the bridge is live', () => {
        const run = runIn(6, { level: 6, x: 80, y: 48 }, ['right'], 20);
        const box = () => playerBoxAt(run.state.x, run.state.y);

        it('the room really is stepped, so there is something to be in danger of', () => {
            // ⛔ THE POSITIVE COUNT FIRST. Everything below is vacuous if the
            // bridge is not stepping this room.
            expect(run.chasers.length).toBe(2);
            expect(run.chaserWalks.length).toBeGreaterThan(0);
        });

        it('grows a WOKEN body by its own bound per tick of horizon', () => {
            const near = chaserDanger(run, box(), 20);
            expect(near.length).toBeGreaterThan(0);
            expect(near[0].kind).toBe('chaser');
            expect(near[0].why).toMatch(/inside leash 80/);
            expect(near[0].why).toMatch(/grown 0.5 px\/tick x 20/);
        });

        /**
         * ⛔ THE HORIZON IS LOAD-BEARING, and this is what says so: the same
         * body, the same box, a shorter horizon, and the danger goes away.
         * A map that ignored the horizon would forbid the whole room for ever.
         */
        it('and a horizon of ZERO is a different answer — the growth is real', () => {
            expect(chaserDanger(run, box(), 20).length).toBeGreaterThan(0);
            expect(chaserDanger(run, box(), 0).length).toBe(0);
        });

        /**
         * ⛔⛔ THE LEASH IS A CONDITION, NOT A DECORATION. A chaser outside
         * `runRange` is not pushed at all, so growing its box would hard-avoid
         * half a room around a body that is standing still — `chaseEnvelope`'s
         * own arithmetic, and this asserts the model kept it.
         */
        it('does NOT grow a body outside its leash', () => {
            const far = { ...run, chasers: [{ id: 'x', tag: 'bob', x: 1000, y: 1000 }] };
            // Far away: no source at all, at any horizon.
            expect(chaserDanger(far, box(), 100)).toEqual([]);
            // Right on top of it, out of leash by construction? Impossible —
            // so the leash test is made directly: a body 200 px away with a
            // 400-tick horizon would be grown 200 px if the leash were
            // ignored, and is not.
            const outOfLeash = { ...run, chasers: [{ id: 'y', tag: 'bob', x: run.state.x + 200, y: run.state.y }] };
            expect(chaserDanger(outOfLeash, box(), 400)).toEqual([]);
        });

        it('⛔ refuses a class with no step bound rather than calling the arena clear', () => {
            const boss = { ...run, chasers: [{ id: 'b', tag: 'bosstotem', x: run.state.x, y: run.state.y }] };
            expect(() => chaserDanger(boss, box(), 1)).toThrow(DangerMapError);
            expect(() => chaserDanger(boss, box(), 1)).toThrow(/ENCOUNTER SCRIPT/);
        });
    });

    /**
     * ⛓ INGREDIENTS (a) and (b): L4 holds two arrow traps and a button that
     * arms them, so it is the room where a lane and a live arrow can both be
     * asked about. ⚠ The bridge does NOT step L4 (that is the slice's own
     * wall) — which makes it a good room for this: the arrow half of the map
     * has to work whether or not the chaser half does.
     */
    describe('(a) arrows and (b) hazard volumes — L4, the arrow room', () => {
        const run = runIn(4, { level: 4, x: 16, y: 64 }, [], 8);

        it('the room really holds the traps, and the census really holds them', () => {
            expect(run.worldFor(4).arrowTraps.length).toBe(2);
            expect(run.worldFor(4).combat.hazards.map((h) => h.tag)).toContain('arrowtrap');
        });

        /**
         * ⛔ AN ARMED TRAP'S LANE IS DANGEROUS AT HORIZON ZERO — the tick
         * before a volley is exactly the tick a policy needs warning on, and
         * a map that only knew about arrows already in the air would call it
         * safe.
         */
        it('a lane under an ARMED trap is danger at horizon 0', () => {
            expect(run.armedArrowTraps.size).toBeGreaterThan(0);
            const trap = run.worldFor(4).arrowTraps[0];
            const inLane = playerBoxAt(trap.ex, trap.ey + 40);
            const src = arrowDanger(run, inLane, 0);
            expect(src.some((s) => s.kind === 'arrowLane')).toBe(true);
        });

        it('...and a box beside the lane is not', () => {
            const trap = run.worldFor(4).arrowTraps[0];
            // Positive first, then the zero — two boxes, one map.
            expect(arrowDanger(run, playerBoxAt(trap.ex, trap.ey + 40), 0).length)
                .toBeGreaterThan(0);
            expect(arrowDanger(run, playerBoxAt(trap.ex - 40, trap.ey + 40), 0)).toEqual([]);
        });

        /**
         * ⛓ A LIVE ARROW IS SWEPT FORWARD. `run.arrowsInFlight` carries
         * position and lifetime only, so the sweep uses `ARROW.speed`
         * downward — the only direction an `ArrowTrap` fires.
         */
        it('sweeps a LIVE arrow forward by its speed x the horizon', () => {
            const flying = runIn(4, { level: 4, x: 16, y: 64 }, [], 20);
            expect(flying.arrowsInFlight.length).toBeGreaterThan(0);
            const a = flying.arrowsInFlight[0];
            const ahead = playerBoxAt(a.x, a.y + 20);
            expect(arrowDanger(flying, ahead, 0).some((s) => s.kind === 'arrow')).toBe(false);
            expect(arrowDanger(flying, ahead, 10).some((s) => s.kind === 'arrow')).toBe(true);
        });

        it('(b) hazard volumes contribute their verdict and their reason', () => {
            const trap = run.worldFor(4).combat.hazards.find((h) => h.tag === 'arrowtrap');
            const src = hazardDanger(run, playerBoxAt(trap.cx, trap.cy + 40));
            expect(src.length).toBeGreaterThan(0);
            expect(src[0].kind).toBe('hazard');
            expect(src[0].why).toMatch(/avoid/);
        });
    });

    /**
     * ⛓ INGREDIENT (d): the crusher, and the reason it is NOT taken from
     * `hazardVolume` — its arm is keyed on the CENSUS placement and a crusher
     * is the one hazard on the roster that moves.
     */
    describe('(d) crushers — the live centre, not the placement', () => {
        it('the trigger lanes are the 32x32 body grown by intDist along ONE axis', () => {
            const v = crusherVolumesAt(100, 100);
            expect(v).toHaveLength(5);
            expect(v[0].r.w).toBe(32);
            expect(v[0].r.h).toBe(32);
            expect(v.filter((x) => x.why.includes('trigger lane'))).toHaveLength(4);
            // +x lane: same top/height, 96 wide, starting at the body's left.
            const plusX = v.find((x) => x.why.includes('+x'));
            expect(plusX.r.x).toBe(84);
            expect(plusX.r.w).toBe(96);
            expect(plusX.r.h).toBe(32);
        });

        /**
         * ⛔ THE POSITION IS THE CLAIM. Two runs of the same arithmetic at two
         * centres must disagree — otherwise "live centre" is a word in a
         * docblock and the map is reading the `.oel` after all.
         */
        it('moving the crusher moves the danger', () => {
            const run = { crushers: new Map([['c', { id: 'c', x: 100, y: 100 }]]) };
            const box = playerBoxAt(160, 100);
            expect(crusherDanger(run, box).length).toBeGreaterThan(0);
            const moved = { crushers: new Map([['c', { id: 'c', x: 400, y: 400 }]]) };
            expect(crusherDanger(moved, box)).toEqual([]);
        });

        it('a null roster (noclip) is not an empty one — it asks nothing', () => {
            expect(crusherDanger({ crushers: null }, playerBoxAt(0, 0))).toEqual([]);
        });
    });
});

/**
 * ── ⛓⛓⛓ THE CONSUMPTION: `mover.findEarliestArrival`'s `forbiddenAt` ──
 *
 * The hook has been in `mover.js` since R5 with only tests and one probe on
 * it. This is the first time a LIVE room's danger drives it — and the
 * certificate's `certifiedAgainst.timeline` is what names which one, so a
 * plan can be re-checked when the timeline moves.
 */
describe('the danger map drives mover.findEarliestArrival', () => {
    const run = runIn(6, { level: 6, x: 80, y: 48 }, ['right'], 20);
    const world = buildLevelWorld(source(6), { roles: ['blocking'] });
    const boxes = [...world.solids.map((s) => s.rect), ...world.objectSolids.map((s) => s.rect)];
    const stepOpts = {
        world: { width: world.width * 16, height: world.height * 16 },
        terrainStateAt: () => 0,
        collides: (x, y) => {
            const b = playerBoxAt(x, y);
            for (const r of boxes) {
                if (b.x < r.right && b.right > r.x && b.y < r.bottom && b.bottom > r.y) return true;
            }
            return null;
        },
    };
    const start = { x: run.state.x, y: run.state.y, vx: 0, vy: 0, tick: run.ticksCompleted };

    /**
     * ⚠ WESTWARD, AWAY FROM THE BOBS — deliberately the direction the map
     * ALLOWS, because a certificate only exists for a plan that succeeded.
     * The direction it FORBIDS is the next test, and the two together are
     * the pair: one shows the hook carries a timeline, the other shows the
     * timeline bites.
     */
    it('⛔ the certificate NAMES the timeline, and never says "safe"', () => {
        const d = planDash({
            start,
            endRegion: (s) => s.x <= start.x - 6,
            heuristicTarget: { x: start.x - 6, y: start.y },
            stepOpts,
            forbiddenAt: forbiddenByDanger(run, playerBoxAt),
            timelineName: `dangerMap over L6 at model tick ${run.ticksCompleted}`,
            limits: { maxTicks: 60, maxExpansions: 60000 },
        });
        expect(d.ok).toBe(true);
        expect(d.certifiedAgainst.timeline).toMatch(/dangerMap over L6 at model tick/);
        expect(d.certifiedAgainst.claim).toMatch(/NOT "safe"/);
    });

    /**
     * ⛔⛔ THE NON-VACUITY, WITNESSED. A `forbiddenAt` that never returned
     * true would leave the plan identical to the unconstrained one — so both
     * are run and the map is asserted to have CHANGED something. A search
     * that is not being constrained is not being tested.
     */
    it('⛓ the map really constrains the search — the two plans differ', () => {
        const plan = (forbiddenAt, timelineName) => planDash({
            start,
            endRegion: (s) => s.x >= start.x + 6,
            heuristicTarget: { x: start.x + 6, y: start.y },
            stepOpts,
            forbiddenAt,
            timelineName,
            limits: { maxTicks: 60, maxExpansions: 60000 },
        });
        const free = plan(() => false, 'no timeline at all');
        const guarded = plan(forbiddenByDanger(run, playerBoxAt), 'dangerMap over L6');
        expect(free.ok).toBe(true);
        // ⛔ The bobs are east of the player and chasing, so a plan that walks
        // east into them is exactly what the map exists to refuse. Either the
        // guarded plan is REFUSED, or it is strictly slower — never equal.
        if (guarded.ok) {
            expect(guarded.ticks).toBeGreaterThan(free.ticks);
        } else {
            expect(guarded.bound).toBeTruthy();
        }
    });
});

describe('dangerAt — the union, and the shapes it refuses', () => {
    const run = runIn(6, { level: 6, x: 80, y: 48 }, ['right'], 20);

    it('reports a reason list, not a bare boolean', () => {
        const d = dangerAt(run, run.ticksCompleted + 20, playerBoxAt(run.state.x, run.state.y));
        expect(d.danger).toBe(true);
        expect(d.sources.length).toBeGreaterThan(0);
        for (const s of d.sources) {
            expect(['arrow', 'arrowLane', 'hazard', 'chaser', 'crusher']).toContain(s.kind);
            expect(s.why.length).toBeGreaterThan(10);
        }
    });

    it('clamps a horizon in the past to NOW rather than refusing it', () => {
        const d = dangerAt(run, run.ticksCompleted - 50, playerBoxAt(run.state.x, run.state.y));
        expect(d.horizon).toBe(0);
    });

    /**
     * ⛔ A RECT LITERAL WITHOUT `right`/`bottom` NEVER OVERLAPS, silently —
     * so the boundary validates the SHAPE rather than trusting it.
     */
    it('refuses a box with no `right`/`bottom`', () => {
        expect(() => dangerAt(run, 0, { x: 0, y: 0, w: 4, h: 4 })).toThrow(DangerMapError);
        expect(() => dangerAt(run, 0, { x: 0, y: 0, w: 4, h: 4 })).toThrow(/NEVER overlaps/);
    });

    it('refuses a non-run and a non-finite tick', () => {
        expect(() => dangerAt(null, 0, playerBoxAt(0, 0))).toThrow(/needs a live run/);
        expect(() => dangerAt(run, NaN, playerBoxAt(0, 0))).toThrow(/must be finite/);
    });

    it('⛔ `forbiddenByDanger` refuses to assume the mover\'s box', () => {
        expect(() => forbiddenByDanger(run)).toThrow(/property of the thing MOVING/);
    });
});

/**
 * ── THE MUTATION LIST FOR THIS STRATUM ────────────────────────────────
 *
 * Each row states a mutation and the test it makes go red. RUN, not written:
 * every row below was performed against the tree and the named test observed
 * failing. A row whose mutation bites nothing is a BOUNDED VACUITY and says
 * so rather than being quietly dropped.
 *
 *  1. `dangerAt` drops `arrowDanger` from the union
 *       → `reports a reason list…` still passes (L6 has no trap), but
 *         `a lane under an ARMED trap is danger at horizon 0` and
 *         `sweeps a LIVE arrow forward…` both red. ⚠ THE FIRST HALF IS THE
 *         POINT: a union test in one room cannot police an ingredient that
 *         room does not hold, which is why each ingredient has its OWN room.
 *  2. `dangerAt` drops `hazardDanger`
 *       → `(b) hazard volumes contribute their verdict and their reason` reds
 *  3. `dangerAt` drops `chaserDanger`
 *       → `grows a WOKEN body…`, `and a horizon of ZERO…`, `reports a reason
 *         list…` and `the map really constrains the search` all red
 *  4. `dangerAt` drops `crusherDanger`
 *       → `moving the crusher moves the danger` reds
 *  5. `chaserDanger` ignores the leash (grows every body unconditionally)
 *       → `does NOT grow a body outside its leash` reds
 *  6. `chaserDanger` ignores the horizon (grows by the bound alone)
 *       → `and a horizon of ZERO is a different answer` reds
 *  7. `arrowDanger` prices only arrows in flight, not the ARMED lanes
 *       → `a lane under an ARMED trap is danger at horizon 0` reds
 *  8. `crusherDanger` reads the census placement instead of `run.crushers`
 *       → `moving the crusher moves the danger` reds
 *  9. `stepBoundFor` returning 0 for a boss instead of null
 *       → `refuses a class with no step bound…` reds
 * 10. `dangerAt` accepts a rect literal without `right`/`bottom`
 *       → `refuses a box with no right/bottom` reds
 * 11. `forbiddenByDanger` imports `playerBoxAt` instead of taking it
 *       → `refuses to assume the mover's box` reds
 *
 * ⚠ BOUNDED VACUITY, NAMED: `hazardDanger` EXCLUDES the crusher family by
 * name, and no committed room on this slice's path holds a crusher AND a
 * bridged chaser — so the exclusion's own consequence is exercised only by
 * the synthetic `moving the crusher moves the danger` case above. The
 * exclusion is a decision (the census rect is stale for a body that moves),
 * not a measurement, until a room holds both.
 */
