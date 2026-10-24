/**
 * `moverTotem.test.js` — THE MOVER'S FIRST LIVE CUSTOMER, and §9.8's two
 * debts discharged.
 *
 * Slice 1 shipped the planner and named what it had NOT done:
 *
 *   · *"the `dash` verb's tape-side integration is slice 2+'s when a window
 *      needs it"*;
 *   · *"no certificate has been replayed through `runTape` yet —
 *      `certificateToTape` exists and is tested for shape; the independent
 *      stratum is exercised when a window uses it."*
 *
 * W-totem is the window that needs it, and this is where both land. The leg
 * is the fight's own approach: from the boot's column (x 152, dead centre
 * of the laser's fixed [135, 169) band) to the safe column west of it,
 * inside the 148 model ticks the wake buys.
 *
 * ── ⛔⛔ WHAT THE MOVER IS AND IS NOT USED FOR HERE ───────────────────
 *
 * It plans the APPROACH. It does NOT plan the tracking descent, and the
 * reason is §9.4's: the range is short (half a tile exactly, ~3 tiles as an
 * upper bound at a named `dwell`) and the descent is 150 px against a body
 * whose position is a function of the same clock. A plan that long would be
 * a decomposition into waypoints, and the descent has a closed shape — an
 * eight-tick burst per 22-tick cycle — that a search cannot improve on
 * because the CADENCE is set by the boss's `hitsTimer` and not by the
 * player's speed. The mover's product here is the leg where "as fast as
 * possible" is the actual question. Stating that is the point: a search
 * PROPOSES and the clock DISPOSES, and the clock in this room is 20 ticks
 * wide whatever the mover says.
 */

import { describe, expect, it } from 'vitest';

import { certificateToTape, planDash, replayThroughStepper } from './mover.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, rect } from './levelWorld.js';
import { runTape } from './tapeRunner.js';

const levelSource = atlasLevelSource();
const l43 = buildLevelWorld(atlasLevelSource()(43), { roles: ['blocking', 'trigger', 'pickup', 'proximity-hazard'] });

/**
 * The state the tape is actually in when the shuffle starts — read off the
 * committed tape's own replay, not invented. The wand ceremony has just
 * ended and the player is at rest under the pickup.
 */
const SHUFFLE_TICK = 120;
function stateAtShuffle() {
    let found = null;
    runTape(loadTape('r6-totem-kill'), {
        levelSource,
        onTick: (t, s) => { if (t === SHUFFLE_TICK) found = { ...s }; },
    });
    return found;
}
const start = stateAtShuffle();

/** The one column the fight's own arithmetic leaves open on the west side. */
const SAFE_WEST = Object.freeze({ lo: 129.5, hi: 133.5 });

describe('the approach leg, planned', () => {
    const from = {
        x: start.x, y: start.y, vx: start.vx, vy: start.vy, tick: 0,
    };
    const plan = planDash({
        start: from,
        // The END REGION, not a point — R5's law: constrain the end region.
        // Anywhere whose 4-wide box is clear of the laser band and inside
        // the arena will do, and the search picks the earliest.
        endRegion: (s) => s.x + 2 <= 135 && s.x - 2 >= 114 && Math.abs(s.y - from.y) <= 2,
        stepOpts: {
            collides: (x, y) => !!l43.collidesSolid(rect(x - 2, y - 2, 4, 5), {
                bosses: new Map([['bosstotem@152,168', { activated: false }]]),
            }),
        },
        heuristicTarget: { x: 132, y: from.y },
        timelineName: 'L43 wake — the boss walks at model tick 212',
        dwell: 4,
    });

    it('⛓ the leg is 19 px and the planner answers', () => {
        expect(from.x).toBeCloseTo(152, 5);
        expect(plan.ok).toBe(true);
        expect(plan.ticks).toBeGreaterThan(0);
    });

    it('⛔ …and it says which timeline, at which granularity, under which bound', () => {
        // §9's law: the certificate never CLAIMS "safe" — it says the
        // opposite, in words, and the assertion is on the words.
        expect(plan.certifiedAgainst.claim).toMatch(/NOT "safe"/);
        expect(plan.certifiedAgainst.timeline).toMatch(/walks at model tick 212/);
        expect(plan.certifiedAgainst.claim).toMatch(/UPPER BOUND|tick-optimal/);
    });

    it('⛓ the weak stratum reproduces it exactly', () => {
        expect(replayThroughStepper(plan, {})).toMatchObject({ ok: true, drift: 0 });
    });

    it('⛓ the mover\'s leg is SHORTER than the hand-derived shuffle', () => {
        // The tape holds `left` for 15 ticks from 120 and then slides to
        // rest; the plan lands the same end region in 16 ticks TOTAL from
        // the same start. ⚠ The tape is not re-authored from it: the hand
        // leg is already inside the wake by 77 ticks, and re-recording two
        // 40-minute tapes to save none of them is not an improvement.
        expect(plan.ticks).toBe(16);
        const leftSpan = loadTape('r6-totem-kill').inputs
            .find((sp) => sp.key === 'left');
        expect(leftSpan).toMatchObject({ from: 120, to: 135 });
    });

    it('⛓⛓⛓ …and it ARRIVES INSIDE THE WAKE, with ticks to spare', () => {
        // The whole point of a timeline claim: the leg has to finish before
        // the boss's machine starts, and the answer is arithmetic once the
        // plan has a tick count.
        expect(SHUFFLE_TICK + plan.ticks).toBeLessThan(212);
    });
});

describe('⛓⛓⛓ THE SECOND STRATUM — a certificate through `runTape`', () => {
    /**
     * §9.8's second debt. `certificateToTape` had a SHAPE test and no
     * consumer; this drives the plan's own spans through the loop the
     * 100-tape `--win` differential proves byte-exact against the real
     * game. A plan verified only against the successor function that
     * produced it is [[feedback_verifier_shared_assumption]].
     */
    const from = { x: 152, y: 240, vx: 0, vy: 0, tick: 0 };
    const plan = planDash({
        start: from,
        endRegion: (s) => s.x <= 133.5 && s.x >= 129.5,
        stepOpts: {},
        heuristicTarget: { x: 132, y: 240 },
        timelineName: 'none — the open-ground leg, for the replay stratum',
        dwell: 4,
    });

    it('the plan exists and its spans encode the keys it chose', () => {
        expect(plan.ok).toBe(true);
        expect(plan.spans.length).toBeGreaterThan(0);
        expect(plan.spans.every((s) => s.to > s.from)).toBe(true);
    });

    it('⛔⛔ …and `runTape` lands the player where the certificate says', () => {
        const tape = certificateToTape(plan, {
            tape_version: 6,
            game: 'seedling',
            // ⚠ NOCLIP, and it is the honest choice for THIS claim. The
            // certificate above was planned on open ground (no `collides`),
            // so replaying it against real geometry would be checking a
            // different plan. The claim is "the span encoding drives the
            // physics the planner used", and the geometry-aware version is
            // the leg in the block above.
            boot: { level: 43, x: 144, y: 232 },
            noclip: true,
            noHazards: [],
            persistence: [],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            grants: [],
            equips: [],
            pins: [],
            noDamage: true,
            name: 'mover-cert-through-runtape',
            description: 'scratch, in-memory only — the certificate replay stratum',
        });
        const r = runTape(tape, { levelSource });
        const want = plan.path[plan.path.length - 1];
        // ⛓ The BOOT offsets the whole leg by the spawn's own half tile, so
        // the DISPLACEMENT is what compares, not the absolute x.
        const moved = r.final.x - (144 + 8);
        expect(moved).toBeCloseTo(want.x - from.x, 10);
        expect(r.final.vx).toBeCloseTo(want.vx, 10);
    });
});

describe('the stance, against the fight timeline', () => {
    it('⛓ the committed tape reaches the safe column and holds it', () => {
        let last = null;
        runTape(loadTape('r6-totem-kill'), {
            levelSource,
            onTick: (t, s, held, run) => {
                if (run?.bossesWoken?.[0]?.walking) last = s.x;
            },
        });
        expect(last).toBeGreaterThan(SAFE_WEST.lo);
        expect(last).toBeLessThan(SAFE_WEST.hi);
    });

    it('⛔ and the mover could not have improved the CADENCE, only the leg', () => {
        // The schedule's 22 ticks are the boss's `hitsTimer` 20 plus the two
        // the travelling shot needs at this offset. No amount of player
        // speed changes it — which is why the descent is a closed cycle and
        // not a search. [[feedback_search_proposes_clock_disposes]]
        const hits = runTape(loadTape('r6-totem-kill'), { levelSource }).bossHits;
        const gaps = hits.slice(1).map((h, i) => h.t - hits[i].t);
        expect(Math.min(...gaps)).toBeGreaterThanOrEqual(20);
        expect(Math.max(...gaps)).toBeLessThanOrEqual(24);
    });
});
