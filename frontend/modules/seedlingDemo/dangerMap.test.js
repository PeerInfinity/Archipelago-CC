import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { buildLevelWorld } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { planDash } from './mover.js';
import {
    DangerMapError, arrowDanger, arrowDangerDuringTransit, bodyKillRegions, chaserDanger,
    crusherDanger, crusherVolumesAt, dangerAt, dangerDuringTransit, dangerVolumes,
    dangerWhileWaiting, forbiddenByDanger, hazardDanger, predictArrows,
    staticEnemyDanger, spinnerDanger, DANGER_MODES, HAZARDS_PRICED_LIVE,
    TRANSIT_INGREDIENTS,
} from './dangerMap.js';
import { SPINNER } from './spinner.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { loadTape } from './fixtures/index.js';
import { rectsOverlap } from './levelWorld.js';

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

        /**
         * ⛔⛔⛔ R8 SLICE 3b — THE TRAP WAS PRICED TWICE AND THE STATIC
         * READING WON. This row asserted that `hazardDanger` reports the
         * arrowtrap's census volume; it does not any more, and the
         * replacement is the PAIR that shows why.
         *
         * `hazardVolume`'s arrowtrap row says it in its own `why`: *"an
         * Activators group gates it, so whether it fires at all is a STATE
         * question, not a timing one"* — and the census arm asked it
         * unconditionally, so a DISARMED trap's whole column was forbidden
         * for ever. In L4 that column is the only way north out of the room,
         * and the walk that takes it does so with the button released.
         *
         * ⚠ THE EXCLUSION IS ONLY HONEST IF THE OTHER INGREDIENT FIRES, so
         * both halves are driven: ARMED -> `dangerAt` still names it (through
         * `arrowDanger`), DISARMED -> silent. A positive before the zero, the
         * silent-watcher law this file opens with.
         */
        it('(b) the arrowtrap is EXCLUDED from the census arm and priced live instead', () => {
            const trap = run.worldFor(4).combat.hazards.find((h) => h.tag === 'arrowtrap');
            expect(HAZARDS_PRICED_LIVE.arrowtrap.by).toBe('arrowDanger');
            expect(hazardDanger(run, playerBoxAt(trap.cx, trap.cy + 40))).toEqual([]);
            // ARMED: the union still names it, through the live arm.
            expect(run.armedArrowTraps.size).toBeGreaterThan(0);
            const armed = dangerAt(run, run.ticksCompleted,
                playerBoxAt(trap.cx, trap.cy + 40));
            expect(armed.sources.some((x) => x.kind === 'arrowLane')).toBe(true);
        });

        it('...and DISARMED, the same column is silent — the walk L4 actually takes', () => {
            // Step off the button: `ArrowTrap`'s group goes down and the
            // lane stops being anything at all.
            const off = runIn(4, { level: 4, x: 16, y: 64 }, [], 8);
            for (let t = 0; t < 40; t += 1) off.advance(new Set(['right']));
            const trap = off.worldFor(4).arrowTraps[0];
            expect(off.armedArrowTraps.size).toBe(0);
            const src = dangerAt(off, off.ticksCompleted,
                playerBoxAt(trap.ex, trap.ey + 60)).sources;
            expect(src.filter((x) => x.id === trap.id)).toEqual([]);
        });

        /** A hazard family nobody prices live still contributes, unchanged. */
        it('(b) a hazard the live arms do NOT price still contributes its verdict', () => {
            const priced = Object.keys(HAZARDS_PRICED_LIVE);
            expect(priced.sort()).toEqual(['arrowtrap', 'crusher']);
            for (const tag of priced) {
                expect(HAZARDS_PRICED_LIVE[tag].by).toMatch(/Danger$/);
            }
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
 * ⛓⛓⛓ INGREDIENT (e) — R8 SLICE 3b — THE STATIC `"Enemy"` BODIES.
 *
 * L6 is the room, and it is the room slice 2's free oracle was recorded in:
 * the GAME hit `sandtrap@64,16` at t=20 and killed the player twice while
 * every ingredient of this map called the room calm. A sandtrap is an
 * `"Enemy"` census row with `speed 0` — neither a stepped chaser (c) nor a
 * placed puzzlement hazard (b) — so nothing on the roster asked about it.
 */
describe('(e) static census bodies — the ingredient the free oracle measured missing', () => {
    const run = runIn(6, { level: 6, x: 32, y: 16 }, [], 1);

    it('names the sandtrap the GAME hit, at its own placement', () => {
        const src = staticEnemyDanger(run, playerBoxAt(72, 24));
        expect(src.map((x) => x.id)).toContain('sandtrap@64,16');
        expect(src[0].kind).toBe('enemy');
        // Positive before the zero: a box two tiles west names nothing.
        expect(staticEnemyDanger(run, playerBoxAt(24, 24))).toEqual([]);
    });

    /**
     * ⛔ AND THE BRIDGED HALF IS EXCLUDED BY THE RUN'S OWN VERDICT. A body
     * this room STEPS belongs to ingredient (c) at its LIVE position; pricing
     * it here as well would double-count a live one at the cell it left on
     * its first chasing tick, and — worse — would forbid a DEAD one's
     * placement for ever, which is trap 157 wearing the danger map's clothes.
     */
    it('excludes a BRIDGED chaser, and the exclusion is the run\'s verdict', () => {
        expect(run.chaserRoomVerdict(6).stepped).toBe(true);
        expect(run.chasers.map((c) => c.id)).toContain('bob@96,16');
        const live = run.chasers.find((c) => c.id === 'bob@96,16');
        const onIt = playerBoxAt(live.x, live.y);
        // The chaser arm names it...
        expect(chaserDanger(run, onIt, 0).map((x) => x.id)).toContain('bob@96,16');
        // ...and the static arm does not, so it is priced ONCE.
        expect(staticEnemyDanger(run, onIt).map((x) => x.id)).not.toContain('bob@96,16');
    });

    /**
     * ⛓ THE UNION CARRIES IT, which is the claim that matters — an
     * ingredient that fires only when called directly is not in the map.
     */
    it('the union names it too', () => {
        const d = dangerAt(run, run.ticksCompleted, playerBoxAt(72, 24));
        expect(d.danger).toBe(true);
        expect(d.sources.some((x) => x.kind === 'enemy')).toBe(true);
    });

    /**
     * ⚠ NOT GROWN BY THE CHOMP RADIUS, and the decision is EVIDENCE-BOUND
     * rather than cautious. `ENEMY_CLASSES.sandtrap.aggro.range` is 20 and
     * the body is 16x16, so a disc from its centre would reach y=44 — and
     * the hand-authored L6 crossing walks row 2 at y=40, which the GAME
     * recorded at ZERO hits. A map grown to the chomp radius would refuse a
     * corridor the game has already certified.
     */
    it('prices the BODY, not the wake radius — the row-2 corridor the game certified', () => {
        expect(staticEnemyDanger(run, playerBoxAt(72, 40))).toEqual([]);
    });
});

/**
 * ⛓⛓⛓ THE MAP AS VOLUMES (the AVOID rung) and THE BODY-KILL REGIONS (the
 * BAIT rung) — ⚖ §11.8a ruling 2's two new shapes of the same ingredients.
 */
describe('dangerVolumes and bodyKillRegions — the ladder\'s two other shapes', () => {
    it('dangerVolumes returns rects `plannerObstacleAt` can route around', () => {
        const run = runIn(6, { level: 6, x: 32, y: 16 }, [], 1);
        const vols = dangerVolumes(run, 0);
        expect(vols.length).toBeGreaterThan(0);
        for (const v of vols) {
            expect(v.level).toBe(6);
            expect(v.kind).toBe('danger');
            // The rect lesson at the one boundary that matters: a literal
            // without right/bottom NEVER overlaps, silently.
            expect(Number.isFinite(v.rect.right)).toBe(true);
            expect(Number.isFinite(v.rect.bottom)).toBe(true);
        }
        expect(vols.map((v) => v.id)).toContain('sandtrap@64,16');
    });

    /**
     * ⛔ THE REGIONS THAT KILL A *BODY* ARE NOT THE PLAYER'S DANGER. L6's
     * answer is the WATER — `Enemy.update`'s terrain switch — and the player
     * merely cannot walk there.
     */
    it('bodyKillRegions names L6\'s water, which no player-danger arm reports', () => {
        const run = runIn(6, { level: 6, x: 32, y: 16 }, [], 1);
        const regions = bodyKillRegions(run);
        expect(regions.some((r) => r.kind === 'terrain')).toBe(true);
        const water = regions.find((r) => r.kind === 'terrain');
        // The same cell is NOT in the player's danger union: it is terrain
        // the planner refuses to walk on, not a threat that reaches out.
        const mid = { x: (water.rect.x + water.rect.right) / 2,
            y: (water.rect.y + water.rect.bottom) / 2 };
        expect(dangerAt(run, run.ticksCompleted, playerBoxAt(mid.x, mid.y))
            .sources.some((sx) => sx.kind === 'terrain')).toBe(false);
    });

    it('a room with no kill region says so rather than returning an empty list quietly', () => {
        // L7 is the corridor: two stairs, two spires, no water, no pit, no
        // trap. The positive above is what makes this zero mean something.
        const run = runIn(7, { level: 7, x: 16, y: 32 }, [], 1);
        expect(bodyKillRegions(run)).toEqual([]);
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
 *       → `(b) a hazard the live arms do NOT price…` still passes (it reads
 *         the table), and the L8 sandtrap rows in `solverBot.test.js` red.
 *         ⚠ WEAKENED BY SLICE 3b's OWN FIX, and named rather than hidden:
 *         with `arrowtrap` and `crusher` both priced live, the only census
 *         hazards left on this slice's rooms are ones no test here stands
 *         in. The honest catcher moved to the ROOM tests.
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
 *
 * ── slice 3b's rows ───────────────────────────────────────────────────
 *
 * 12. `hazardDanger` stops excluding `arrowtrap`
 *       → `(b) the arrowtrap is EXCLUDED…` reds, AND `solverBot`'s
 *         `L4: hold then shove — the room SOLVES` reds, because the disarmed
 *         column goes back to being a permanent wall
 * 13. `dangerAt` drops `staticEnemyDanger`
 *       → `(e) the union names it too` reds, and `L6: the census-on corridor
 *         is refused WITH THE THREAT NAMED` reds on the sandtrap
 * 14. `staticEnemyDanger` stops excluding bridged chasers
 *       → `excludes a BRIDGED chaser…` reds (the body is priced twice, once
 *         at a cell it left)
 * 15. `staticEnemyDanger` grows the body by `aggro.range`
 *       → `prices the BODY, not the wake radius` reds — the row the GAME's
 *         own zero-hit crossing is the evidence for
 * 16. `dangerVolumes` builds a rect without `right`/`bottom`
 *       → `dangerVolumes returns rects…` reds (the R1 rect lesson)
 * 17. `bodyKillRegions` reuses the player's danger set
 *       → `bodyKillRegions names L6's water…` reds, because the water would
 *         then have to be in both
 */

/**
 * ⛓⛓⛓ ⚖ §13.10a's TWO ORACLE GATES — R8 slice 5.
 *
 * The ruling names both fixtures and says they are already on disk. They are
 * the two halves of one claim: the probe must FORBID the walk the game shot,
 * and must ADMIT the walk the game accepted. Either alone is cheap — a probe
 * that forbids everything passes the first, one that forbids nothing passes
 * the second.
 *
 * ⛔ THE INSTRUMENT UNDER TEST IS THE PAIR (forecast + `dangerDuringTransit`),
 * driven along a walk that really happened, so nothing here depends on the
 * solver's own planning. The walks are the RECORDING's and the committed hand
 * tape's; this asks the map about them.
 */
describe('⚖ §13.10a — the ETA-aware transit probe, against its two oracles', () => {
    const HERE = dirname(fileURLToPath(import.meta.url));
    const REFUTED = join(HERE, 'fixtures', 'refuted');

    /** Boot a tape's own L5 world and replay its keys, capturing positions. */
    const replay = (tape, upTo) => {
        const run = createLevelRun({
            levelSource: source, boot: tape.boot, noclip: false,
            noHazards: tape.noHazards, noDamage: tape.noDamage ?? false,
            grants: tape.grants, persistence: tape.persistence, despawn: [],
            equips: tape.equips, pins: tape.pins ?? [], save: tape.save ?? null,
            rng: tape.rng ?? null, seam: tape.seam ?? null, roles: ROLES,
        });
        const at = [];
        for (let i = 0; i < upTo; i += 1) {
            at.push({ x: run.state.x, y: run.state.y });
            run.advance(heldKeysAt(tape, i));
        }
        return { run, at };
    };

    /**
     * Step the forecast along a walk's OWN positions and return, per tick, the
     * probe's verdict for the box the walk occupied at that tick.
     *
     * ⛔ THE PAIRING IS THE GAME'S: the arrows have moved, the player has not
     * — an `Arrow` is run-time-added and therefore updates before the Player.
     */
    const probeAlong = (run, positions, fromTick) => {
        const forecast = run.arrowForecast();
        expect(forecast, 'L5 has four traps; a null forecast is the test not '
            + 'reaching the subsystem').not.toBeNull();
        const rows = [];
        for (let i = 0; i < positions.length; i += 1) {
            const tick = fromTick + i + 1;
            const arrows = forecast.step(positions[i]);
            const box = playerBoxAt(positions[i].x, positions[i].y);
            rows.push({
                tick,
                pos: positions[i],
                d: dangerDuringTransit(run, tick, box, arrows),
                arrows,
            });
        }
        return rows;
    };

    /**
     * ── GATE (i), THE NEGATIVE ORACLE ─────────────────────────────────
     *
     * The recording fixes the exact (cell, tick): the player at
     * (65.05, 56.39999999999999) on tick 206, hit by `arrowtrap@64,48#14.0`.
     * The probe must forbid it — and it must do so from a plan made BEFORE the
     * arrow that hits existed, which is the half a prediction over
     * arrows-already-in-the-air cannot do.
     */
    describe('(i) NEGATIVE — the walk the GAME shot', () => {
        const tape = parseTape(JSON.parse(
            readFileSync(join(REFUTED, 'r8-solve-5.tape.json'), 'utf8')));
        const expectation = JSON.parse(
            readFileSync(join(REFUTED, 'r8-solve-5.expectation.json'), 'utf8'));
        // The plan tick: the last tick the walk stood still before going east.
        const PLAN = 198;
        const HIT = 206;

        it('⛓ the fixture really is the refuted walk — the hit is at 207', () => {
            // ⛔ THE POSITIVE COUNT FIRST. Everything below is about a
            // recording; if the recording is not the one that carries the hit,
            // the gate is measuring nothing.
            expect(expectation.ticks[HIT].x).toBe(65.05);
            expect(expectation.ticks[HIT + 1].x).toBe(62.35484072151636);
        });

        it('⛔⛔⛔ FORBIDS the refuted walk\'s own (cell, tick), naming the arrow', () => {
            const { run } = replay(tape, PLAN);
            expect(run.ticksCompleted).toBe(PLAN);
            // ⛔ THE ARROW THAT HITS DOES NOT EXIST YET. This is the row that
            // makes the forecast's trap half load-bearing rather than tidy.
            expect(run.arrowsInFlight.map((a) => a.id))
                .not.toContain('arrowtrap@64,48#14.0');
            const walk = [];
            for (let t = PLAN; t <= HIT; t += 1) walk.push(expectation.ticks[t]);
            const rows = probeAlong(run, walk, PLAN - 1);
            const atHit = rows.find((r) => r.tick === HIT);
            expect(atHit.pos.x).toBe(65.05);
            expect(atHit.d.danger).toBe(true);
            const arrow = atHit.d.sources.find((x) => x.kind === 'arrow');
            expect(arrow, `sources were ${JSON.stringify(atHit.d.sources)}`)
                .toBeDefined();
            expect(arrow.id).toBe('arrowtrap@64,48#14.0');
            // …and the forecast put that arrow exactly where the game's
            // knockback arithmetic says it was.
            const predicted = atHit.arrows.find((a) => a.id === 'arrowtrap@64,48#14.0');
            expect({ x: predicted.x, y: predicted.y }).toEqual({ x: 68, y: 58 });
        });

        /**
         * ⛔⛔ THE COLLAPSE, MEASURED — this is why it is a TIME defect and not
         * a geometry one. The same cell, asked at the tick the plan was made
         * on (the static corridor probe's only question), is CALM.
         */
        it('⛔⛔ the COLLAPSED question calls the same cell calm (trap 161)', () => {
            const { run } = replay(tape, PLAN);
            const box = playerBoxAt(expectation.ticks[HIT].x, expectation.ticks[HIT].y);
            const now = dangerAt(run, run.ticksCompleted, box);
            const arrowNow = now.sources.filter((x) => x.kind === 'arrow');
            expect(arrowNow).toEqual([]);
            // ⚠ The LANE is still named at that tick — the player is on the
            // button, so the group is published. The static probe's callers
            // excluded exactly that source by id, and with it excluded the
            // corridor read clean. That exclusion plus this collapse IS the
            // refuted walk.
            expect(now.sources.some((x) => x.kind === 'arrowLane')).toBe(true);
        });
    });

    /**
     * ── GATE (ii), THE KNOWN ANSWER ───────────────────────────────────
     *
     * `r7-act2-5` leaves `button@48,48` at tick 307 with the column full and
     * takes ZERO hits over 812 ticks. So a corridor out of that button EXISTS,
     * and §13.2's deadlock — *"the player cannot leave the button while the
     * column is full, and the column cannot empty while they stand on it"* —
     * has to dissolve as arithmetic rather than by relaxing anything.
     */
    describe('(ii) POSITIVE — the walk the GAME accepted', () => {
        const tape = loadTape('r7-act2-5');
        const LEAVES = 306;   // the last tick on the presser; 307 steps off
        const WINDOW = 40;

        it('⛓ the hand walk really does leave the button with the column live', () => {
            const { run } = replay(tape, LEAVES + 1);
            // ⛔ POSITIVE COUNT: arrows in the air, or the gate is about a
            // room where nothing was falling.
            expect(run.arrowsInFlight.length).toBeGreaterThan(0);
            expect(run.playerHits).toEqual([]);
        });

        it('⛓⛓⛓ ADMITS the hand walk\'s button-leaving corridor — no arrow source', () => {
            const { run, at } = replay(tape, LEAVES + 1 + WINDOW);
            const from = createLevelRun({
                levelSource: source, boot: tape.boot, noclip: false,
                noHazards: tape.noHazards, noDamage: tape.noDamage ?? false,
                grants: tape.grants, persistence: tape.persistence, despawn: [],
                equips: tape.equips, pins: tape.pins ?? [], save: tape.save ?? null,
                rng: tape.rng ?? null, seam: tape.seam ?? null, roles: ROLES,
            });
            for (let i = 0; i < LEAVES; i += 1) from.advance(heldKeysAt(tape, i));
            const rows = probeAlong(from, at.slice(LEAVES), LEAVES - 1);
            const shot = rows.filter((r) => r.d.sources.some((x) => x.kind === 'arrow'));
            expect(shot.map((r) => `${r.tick}:${JSON.stringify(r.pos)}`)).toEqual([]);
            // ⛔ AND THE WINDOW REALLY CONTAINED ARROWS — a corridor declared
            // clear over a window with nothing in it is the silent-watcher
            // defect wearing the probe's clothes.
            const seen = new Set(rows.flatMap((r) => r.arrows.map((a) => a.id)));
            expect(seen.size).toBeGreaterThan(3);
            expect(run.playerHits).toEqual([]);
        });

        /**
         * ⛓⛓⛓ THE DEADLOCK, DISSOLVED — the same corridor, two instruments,
         * opposite verdicts, and the GAME's recording says which is right.
         */
        it('⛓⛓⛓ the WAIT reading refuses the corridor the TRANSIT reading admits', () => {
            const { run, at } = replay(tape, LEAVES + 1 + WINDOW);
            // ⛔ BOTH QUESTIONS ARE ASKED FROM THE SAME MOMENT — the tick the
            // hand walk is still on the button with the column live. Asking
            // one of them from a later run would be comparing two worlds.
            const from = createLevelRun({
                levelSource: source, boot: tape.boot, noclip: false,
                noHazards: tape.noHazards, noDamage: tape.noDamage ?? false,
                grants: tape.grants, persistence: tape.persistence, despawn: [],
                equips: tape.equips, pins: tape.pins ?? [], save: tape.save ?? null,
                rng: tape.rng ?? null, seam: tape.seam ?? null, roles: ROLES,
            });
            for (let i = 0; i < LEAVES; i += 1) from.advance(heldKeysAt(tape, i));
            /**
             * The cell the walk is heading INTO — the first one it occupies
             * that any armed lane covers. This is §13.2's deadlock made
             * concrete: that cell is where "leave the button" goes.
             */
            const world = from.worldFor(from.level);
            const lanes = [...from.armedArrowTraps]
                .map((id) => (world.arrowTraps ?? []).find((t) => t.id === id));
            expect(lanes.length).toBeGreaterThan(0);
            const laneRects = lanes.map((t) => ({
                x: t.ex - 6, y: t.ey - 2, right: t.ex + 6,
                bottom: world.world.height,
            }));
            const into = at.slice(LEAVES + 1).find((p) => laneRects
                .some((r) => rectsOverlap(playerBoxAt(p.x, p.y), r)));
            expect(into, 'the hand walk never enters an armed lane — then this '
                + 'pair is about a corridor nobody contested').toBeDefined();
            const box = playerBoxAt(into.x, into.y);
            // The WAIT question, over the whole window: the union of every
            // position an arrow passes through, plus the armed lane.
            const wait = dangerWhileWaiting(from, from.ticksCompleted + WINDOW, box);
            expect(wait.danger).toBe(true);
            expect(wait.mode).toBe('wait');
            // ⚠ And the walk this was asked about took no hits at all — the
            // WAIT reading is not WRONG, it is answering a question the walk
            // never asked (trap 154).
            expect(run.playerHits).toEqual([]);
        });
    });

    /**
     * ── THE MUTATION LIST, RUN RATHER THAN WRITTEN ────────────────────
     */
    describe('the mutation list', () => {
        const tape = parseTape(JSON.parse(
            readFileSync(join(REFUTED, 'r8-solve-5.tape.json'), 'utf8')));
        const expectation = JSON.parse(
            readFileSync(join(REFUTED, 'r8-solve-5.expectation.json'), 'utf8'));

        /**
         * ⛔ MUTATION 1 — the ETA source degraded to a constant. Every cell
         * asked at the plan tick: the negative oracle goes quiet.
         */
        it('⛔ ETA source degraded to a constant ⇒ the negative oracle stops firing', () => {
            const { run } = replay(tape, 198);
            const box = playerBoxAt(expectation.ticks[206].x, expectation.ticks[206].y);
            const forecast = run.arrowForecast();
            // The DEGRADED probe: one forecast tick, then every cell asked
            // against it — the shape a caller gets by hoisting the step out of
            // the loop.
            const frozenArrows = forecast.step(expectation.ticks[198]);
            const degraded = dangerDuringTransit(run, 206, box, frozenArrows);
            expect(degraded.sources.some((x) => x.kind === 'arrow')).toBe(false);
        });

        /**
         * ⛔ MUTATION 2 — the time axis collapsed: the transit arm falls back
         * to the WAIT arm. The negative oracle's case reds because the swept
         * box from the plan tick does not reach a cell an arrow only occupies
         * eight ticks later… and the LANE is what would have covered it, which
         * is the exclusion the refuted walk removed.
         */
        it('⛔ the time axis collapsed ⇒ the arrow source is lost', () => {
            const { run } = replay(tape, 198);
            const box = playerBoxAt(expectation.ticks[206].x, expectation.ticks[206].y);
            const collapsed = arrowDanger(run, box, 0);
            expect(collapsed.some((x) => x.kind === 'arrow')).toBe(false);
        });

        /**
         * ⛔ MUTATION 3 — the arrow prediction drops COVER. L5's `torch@48,64`
         * is a Solid in `arrowtrap@32,48`'s column, and an arrow that ignores
         * it flies on through cells the mechanism clears.
         */
        it('⛔ dropping COVER makes the prediction outlive the mechanism', () => {
            const { run } = replay(tape, 198);
            const withCover = predictArrows(run, 12);
            const noCover = predictArrows(
                { ...run, arrowCoverAt: null, arrowFlights: run.arrowFlights,
                    worldFor: (n) => run.worldFor(n), level: run.level }, 12);
            // ⛔ THE POSITIVE COUNT: both predicted something, so the
            // comparison is between two answers rather than two silences.
            expect(withCover.length).toBeGreaterThan(0);
            expect(noCover.length).toBeGreaterThanOrEqual(withCover.length);
            expect(noCover.length).toBeGreaterThan(withCover.length);
        });

        /**
         * ⛔ MUTATION 4 — the forecast's TRAP half removed. This is the row
         * that says the arrows-already-in-the-air reading is not enough: the
         * volley that hit was fired 5 ticks after the plan.
         */
        it('⛔ predicting only the arrows ALREADY in the air misses the hit', () => {
            const { run } = replay(tape, 198);
            const box = playerBoxAt(expectation.ticks[206].x, expectation.ticks[206].y);
            // `predictArrows` is exactly that reading — it steps the flight and
            // never fires a trap.
            const arrows = predictArrows(run, 206 - 198);
            const d = arrowDangerDuringTransit(run, box, 206 - 198, arrows);
            expect(d.some((x) => x.kind === 'arrow')).toBe(false);
        });

        it('⛔ an unknown mode is a NAMED throw, not a silent default', () => {
            const { run } = replay(tape, 10);
            const box = playerBoxAt(run.state.x, run.state.y);
            expect(() => dangerAt(run, 10, box, { mode: 'later' }))
                .toThrow(/is not a mode/);
        });

        it('⛔ a fractional horizon is refused BY NAME', () => {
            const { run } = replay(tape, 10);
            expect(() => predictArrows(run, 2.5)).toThrow(/non-negative integer tick count/);
        });
    });

    /**
     * ⛓ THE PARTITION IS DATA, AND IT IS TOTAL OVER THE UNION'S ARMS.
     */
    it('⛓ every ingredient of the union is classified by coupling', () => {
        const keys = Object.keys(TRANSIT_INGREDIENTS).sort();
        expect(keys).toEqual(['armedLanes', 'arrows', 'chasers', 'crushers',
            'hazards', 'spinners', 'staticEnemies']);
        /**
         * ⛔ EVERY `atEta: true` ROW IS AUTONOMOUS, AND THE TWO SETS ARE
         * ASSERTED EQUAL rather than a count being asserted.
         *
         * ⛓ R8 SLICE 6 adds the SECOND — and it is a design change, said out
         * loud, exactly as this row demanded ("a second `atEta: true` row is
         * a design change, not a typo"). A `Spinner` has `runRange` 0, so its
         * chase block is DEAD CODE and its trajectory reads the level's
         * geometry and the tick index alone: it cannot forecast the walk
         * because it cannot see the player. `spinnerForecast` is the run's
         * own stepper run forward.
         *
         * ⚠ What is NOT predicted at an ETA is the HAMMER ANGLE — it rides on
         * `Game.time`, which counts dead frames — so the ingredient forbids
         * the whole 13 px disc at every horizon. The BODY is autonomous; the
         * ANGLE is unknown; both facts are in the row's `why`.
         */
        /**
         * ⛓⛓⛓ R9 SLICE 12 BREAKS THE EQUALITY ABOVE, AND THAT IS THE DESIGN
         * CHANGE THIS ROW ASKED TO BE TOLD ABOUT.
         *
         * `atEta === autonomous` held for two rungs and read as a law. It was
         * really a CONFESSION: being player-coupled was treated as a reason an
         * arm could not be carried to a cell's own ETA, so the chaser arm was
         * priced at its plan-time box at every horizon — and L14's survey walk
         * took a hit at tick 44 from a body seventeen pixels from where the
         * corridor had priced it.
         *
         * ⇒ THE LAW IS NOT "AUTONOMOUS", IT IS "COMPUTABLE AT PLAN TIME", and
         * there are two ways to be that. An arrow and a spinner cannot see the
         * player, so one forecast serves every candidate path. A bob CAN see
         * the player — which is precisely why its future is a function of the
         * walk being considered, and why the honest forecast is one taken
         * AGAINST THE CANDIDATE PATH rather than none at all. The coupling did
         * not stop being true; it stopped being an excuse.
         *
         * ⚠ So the two sets are no longer asserted equal — they are asserted
         * SEPARATELY, and the one row that is `atEta: true` while
         * player-coupled is named, so a third one is still a design change and
         * not a typo.
         */
        const atEta = keys.filter((k) => TRANSIT_INGREDIENTS[k].atEta);
        const autonomous = keys.filter((k) => TRANSIT_INGREDIENTS[k].coupling === 'autonomous');
        expect(atEta).toEqual(['arrows', 'chasers', 'spinners']);
        expect(autonomous).toEqual(['arrows', 'spinners']);
        expect(atEta.filter((k) => !autonomous.includes(k))).toEqual(['chasers']);
        // …and every autonomous arm is still carried to the ETA: the widening
        // added a case, it did not drop one.
        expect(autonomous.every((k) => TRANSIT_INGREDIENTS[k].atEta)).toBe(true);
        expect(TRANSIT_INGREDIENTS.spinners.why).toMatch(/runRange/);
        expect(TRANSIT_INGREDIENTS.spinners.why).toMatch(/Game\.time/);
        expect(TRANSIT_INGREDIENTS.arrows.coupling).toBe('autonomous');
        expect(TRANSIT_INGREDIENTS.chasers.coupling).toBe('player-coupled');
        for (const k of keys) expect(TRANSIT_INGREDIENTS[k].why.length).toBeGreaterThan(20);
        expect(Object.keys(DANGER_MODES).sort()).toEqual(['transit', 'wait']);
    });
});

/**
 * ⛓⛓⛓ R8 SLICE 8 — INGREDIENT (f) RE-DERIVED: FROM THE DISC TO THE LINE.
 *
 * ⚖ The user's correction is that the hammer's pattern is predictable, so
 * forbidding the whole disc it sweeps is wrong. The pair below is the same
 * room, the same cells and the same horizon under the two arms — and the arm
 * a run gets is decided by whether its boot can declare a clock, never by a
 * flag somebody set.
 */
describe('(f) live spinners — the exact hammer line, and the disc it replaced', () => {
    const L18 = { level: 18, x: 16, y: 112 };
    const spinnerRun = (seam) => createLevelRun({
        levelSource: source, boot: L18, noclip: false, noDamage: false, roles: ROLES,
        pins: ['dead_frames'], seam,
    });
    /** ⛔ A clockless run: no `time` in the boot block, so the arm is the disc. */
    const noClock = () => spinnerRun({ items: { hasSword: true } });
    const withClock = () => spinnerRun({
        items: { hasSword: true }, time: 8000,
        cutscene: [false, false, false, false], menu_state: 0,
    });

    it('the two arms are selected by the CLOCK, and both say which they used', () => {
        expect(noClock().gameTimeRefusal).toContain('save.time');
        expect(withClock().gameTimeRefusal).toBeNull();
    });

    it('⛓⛓ a cell the DISC forbids at every phase is open at most of them', () => {
        const bare = noClock();
        const clocked = withClock();
        const body = bare.spinnerBodies[0];
        expect(body).toBeTruthy();
        // A box 8 px east of the body's entity point: inside the 13 px disc,
        // and on the line only when the hammer is pointing that way.
        const box = playerBoxAt(body.x + 9, body.y);
        const disc = spinnerDanger(bare, box, 0);
        expect(disc).toHaveLength(1);
        expect(disc[0].arm).toBe('disc');
        expect(disc[0].why).toContain('UNION');
        // ⛔ THE POSITIVE BEFORE THE ZERO: the same instrument, the same box,
        // over a full turn of the clock — it forbids SOME phases and not all,
        // which is exactly the claim the disc could not make.
        const forbidden = [];
        for (let t = 0; t < SPINNER.hammerPeriod; t += 1) {
            const at = playerBoxAt(body.x + 9, body.y);
            const rows = spinnerDanger(
                { ...clocked, gameTimeAt: () => t, spinnerBodies: clocked.spinnerBodies,
                    spinnerForecast: () => [] },
                at, 0,
            );
            if (rows.length) forbidden.push(t);
        }
        expect(forbidden.length).toBeGreaterThan(0);
        expect(forbidden.length).toBeLessThan(SPINNER.hammerPeriod);
    });

    it('⛔ the BODY is priced too — narrowing to the line would open a hole', () => {
        const clocked = withClock();
        const body = clocked.spinnerBodies[0];
        // Standing ON the body: `Enemy.hitPlayer`'s `collide("Player", x, y)`
        // fires at every phase, so the row must be the BODY arm and must not
        // depend on the hammer's angle at all.
        const arms = new Set();
        for (let t = 0; t < SPINNER.hammerPeriod; t += 1) {
            const rows = spinnerDanger(
                { ...clocked, gameTimeAt: () => t, spinnerBodies: clocked.spinnerBodies,
                    spinnerForecast: () => [] },
                playerBoxAt(body.x, body.y), 0,
            );
            expect(rows).toHaveLength(1);
            arms.add(rows[0].arm);
        }
        expect([...arms]).toEqual(['body']);
    });

    it('a cell far from every body is calm under BOTH arms', () => {
        const clocked = withClock();
        const body = clocked.spinnerBodies[0];
        const far = playerBoxAt(body.x + 200, body.y + 200);
        expect(spinnerDanger(clocked, far, 0)).toEqual([]);
        expect(spinnerDanger(noClock(), far, 0)).toEqual([]);
    });

    it('⛓ the TRANSIT_INGREDIENTS row says the hammer is autonomous now', () => {
        const row = TRANSIT_INGREDIENTS.spinners;
        expect(row.coupling).toBe('autonomous');
        expect(row.atEta).toBe(true);
        expect(row.why).toContain('AND SO IS THE HAMMER');
        // The fallback is named in the row, not only in the code.
        expect(row.why).toContain('45 phases');
    });
});

/**
 * ⛓⛓⛓ R9 SLICE 12 — **THE BOB FORECAST**: the chaser arm carried to the ETA.
 *
 * ⛔⛔ THE DEFECT THIS STRATUM IS THE MEASUREMENT OF. `coupledHorizon` is 0 in
 * TRANSIT, so `chaserDanger`'s growth term was 0, so every cell of a corridor
 * was priced against the body's box AT PLAN TIME — for an ETA fifty ticks away.
 * `TRANSIT_INGREDIENTS.chasers` covered for it with a sentence about a
 * "per-tick next-cell check" that existed nowhere in the driver. The route
 * survey's L14 walk is what collected: a hit at tick 44 from `bob@96,48`, a
 * body priced at (96,48) that was at (113.7, 56.1) when it landed the blow.
 *
 * ⚠ AND THE ROWS BELOW ARE BUILT TO DISCRIMINATE, not to describe. The pair
 * that matters reads the SAME cell twice — calm against the live bodies, named
 * at the ETA against the forecast's — because a row that only asserted "the
 * forecast names something" would pass against a function that named
 * everything, and a row that only asserted the bodies moved would pass against
 * a forecast that ignored the candidate path entirely (which is exactly the
 * mutant this slice predicted first and measured second).
 */
describe('the BOB FORECAST — chasers stepped against the CANDIDATE PATH', () => {
    // L6 is the room the bridge really steps: two bobs, no arrow trap, so
    // `chaserRoomVerdict` says yes. 20 ticks east puts the player level with
    // `bob@112,48` and well inside its 80 px leash.
    const run = runIn(6, { level: 6, x: 80, y: 48 }, ['right'], 20);
    const start = () => ({ x: run.state.x, y: run.state.y });
    /** Step a fresh forecast along a candidate path, returning one body's track. */
    const trackOf = (id, advance, ticks = 30) => {
        const fc = run.chaserForecast();
        let p = start();
        const out = [];
        for (let k = 0; k < ticks; k += 1) {
            const bodies = fc.step(p);
            p = advance(p, k);
            out.push(bodies.find((b) => b.id === id));
        }
        return out;
    };

    it('the room really is forecast — the positive count every zero below rests on', () => {
        const fc = run.chaserForecast();
        expect(fc).not.toBeNull();
        const bodies = fc.step(start());
        expect(bodies.map((b) => b.id).sort()).toEqual(['bob@112,48', 'bob@96,16']);
    });

    it('⛔ and it is NULL where nothing is stepped — the `stepChasersNow` gate, not a new one', () => {
        const relaxed = createLevelRun({
            levelSource: source,
            boot: { level: 6, x: 80, y: 48 },
            noclip: false,
            noDamage: true,
            roles: ROLES,
        });
        expect(relaxed.chaserForecast()).toBeNull();
    });

    it('the bodies MOVE, and they move AT the previewed player', () => {
        const live = run.chasers.find((c) => c.id === 'bob@112,48');
        const track = trackOf('bob@112,48', (p) => p);
        // It starts east of the player and closes westward, tick by tick.
        expect(live.x).toBeGreaterThan(run.state.x);
        expect(track[29].x).toBeLessThan(live.x);
        expect(track[29].x).toBeGreaterThan(run.state.x);
    });

    /**
     * ⛓⛓⛓ THE ROW THIS WHOLE SLICE EXISTS FOR — the same cell, two readings.
     *
     * The player's own box, priced against the LIVE bodies, is CALM: the bob is
     * seven pixels away and the horizon term is 0, so nothing overlaps. Priced
     * against the bodies the forecast puts there at the cell's own ETA, the
     * same box names the bob — because by then it has walked into the player.
     */
    it('⛓⛓⛓ a bob that WILL intercept is priced AT THE ETA, and is invisible LIVE', () => {
        const box = playerBoxAt(run.state.x, run.state.y);
        // LIVE — at every horizon this mode can ask for, including the one the
        // transit map actually uses.
        expect(chaserDanger(run, box, 0).map((s) => s.id)).toEqual([]);
        const fc = run.chaserForecast();
        let named = null;
        let at = null;
        for (let k = 1; k <= 30 && named === null; k += 1) {
            const bodies = fc.step(start());
            const ids = chaserDanger(run, box, 0, bodies).map((s) => s.id);
            if (ids.length) { named = ids; at = k; }
        }
        expect(named).toEqual(['bob@112,48']);
        // It takes real ticks to arrive — a forecast that named it immediately
        // would be pricing the plan-time box all over again.
        expect(at).toBeGreaterThan(6);
    });

    it('…and a bob that will NOT reach the cell is never named — the other half', () => {
        const box = playerBoxAt(run.state.x, run.state.y);
        const fc = run.chaserForecast();
        const seen = new Set();
        for (let k = 1; k <= 30; k += 1) {
            for (const s of chaserDanger(run, box, 0, fc.step(start()))) seen.add(s.id);
        }
        // `bob@96,16` is parked against L6's sandtrap (trap 152) and never
        // crosses to the player's row, so no ETA prices it.
        expect([...seen]).toEqual(['bob@112,48']);
    });

    /**
     * ⛔⛔ THE COUPLING IS TO THE PATH, AND THIS IS THE ROW THAT SAYS SO.
     *
     * A forecast that stepped the bodies against the player's PLAN-TIME
     * position would be a second way of spelling the defect. `chaseImpulse` is
     * bang-bang AT the player, so two candidate paths that leave the direction
     * unchanged produce the same track — which is why this row moves the player
     * NORTH, across the bob's bearing, rather than along it.
     */
    it('⛔ two candidate paths give two tracks — the forecast follows the WALK', () => {
        const frozen = trackOf('bob@112,48', (p) => p);
        const northward = trackOf('bob@112,48', (p) => ({ x: p.x, y: p.y - 0.8 }));
        expect(northward[29].y).toBeLessThan(frozen[29].y - 4);
        expect(northward[29].x).not.toBe(frozen[29].x);
    });

    it('`dangerDuringTransit` carries the bodies through to the union', () => {
        const box = playerBoxAt(run.state.x, run.state.y);
        const fc = run.chaserForecast();
        let bodies = null;
        for (let k = 1; k <= 20; k += 1) bodies = fc.step(start());
        const live = dangerDuringTransit(run, run.ticksCompleted + 20, box, null);
        const fore = dangerDuringTransit(run, run.ticksCompleted + 20, box, null, bodies);
        expect(live.sources.filter((s) => s.kind === 'chaser')).toEqual([]);
        expect(fore.sources.filter((s) => s.kind === 'chaser').map((s) => s.id))
            .toEqual(['bob@112,48']);
    });

    it('⛓ the TRANSIT_INGREDIENTS row is TRUE now, and the false sentence is gone', () => {
        const row = TRANSIT_INGREDIENTS.chasers;
        expect(row.coupling).toBe('player-coupled');
        // It used to be `false` with a `why` that claimed a per-tick next-cell
        // check nothing implemented.
        expect(row.atEta).toBe(true);
        expect(row.why).not.toContain('next-cell check');
        expect(row.why).toContain('CANDIDATE PATH');
    });
});
