/**
 * seedlingDemo/r1Walk — the R1 full walk: what it collects, where it
 * breaks into segments, and how a route turns into tape specs.
 *
 * Region-atlas Phase 8, subtractive ladder rung R1, slice 4. Brief:
 * `CC/docs/plans/seedling-bot-r1-opus-kickoff.md` §3.3–§3.5 and §8.7.
 *
 * The ROUTE itself — the leg list — is data, computed once by
 * `scripts/procgen/plan-seedling-r1-route.mjs` and committed as
 * `fixtures/r1-route.json`. This file holds the two things that are
 * DECISIONS rather than derivations (which rooms, in which order, and where
 * the walk breaks into recordable pieces) plus the one piece of logic both
 * the tape generator and the tests need: turning a route into the tape
 * specs the driver synthesizes from.
 *
 * Dependency-free on purpose, like the other core modules: the route
 * arrives as an argument, exactly as a level record does.
 *
 * ── Why segments exist ────────────────────────────────────────────────
 * The full walk is ~8–11k live ticks, which is seven to eight minutes of
 * real-GPU replay per `--record`. That is over the iteration threshold, so
 * the roster splits into six segment tapes and the full walk is kept as the
 * HEADLINE — the thing that gates the rung — rather than the thing you
 * re-record while debugging geometry.
 *
 * ⚠ **Every boundary is a level ARRIVAL, deliberately.** An arrival's
 * position is exactly the constructor half-tile `(playerx + 8, playery + 8)`,
 * its velocity is zero and its terrain state is fresh — which is precisely
 * the state a parameterised boot reproduces, so `boot: {level, x, y}`
 * matches `atBootPosition()` and the chain claim is EXACT rather than
 * approximate. A boundary mid-level could not be booted into at all: the
 * `Game` constructor takes ints and adds 8.
 *
 * ── Why a segment inherits its items in ONE grant entry ───────────────
 * A grant fires on the FIRST OBSERVATION TICK whose level matches, and the
 * boot level is observed at tick 0 — so a single `{level: <boot level>,
 * items: [...everything collected earlier]}` entry reproduces the inventory
 * the previous segment ended with, on the tick the segment starts. That is
 * the whole of the mechanism; there is no separate "initial inventory"
 * concept for either consumer to disagree about.
 *
 * ⚠ And it is why ENDS-MEET is load-bearing rather than ceremonial. A
 * segment chain proves nothing on its own: six tapes that each start
 * wherever they like and each end wherever they get to would be six
 * unrelated walks. The claim is that segment N ends where segment N+1
 * boots — level AND component AND position AND item set — and that every
 * boundary is a state the HEADLINE walk actually passes through.
 */

import { rect } from './levelWorld.js';

/** The build's baked-in spawn, which is also where the walk starts. */
export const R1_BOOT = Object.freeze({ level: 0, x: 80, y: 128 });

/**
 * ⚠ PIT IS OMITTED, and that is the rung.
 *
 * R1 leaves pits LIVE and models the fall as a transport primitive the
 * planner routes with. `hazard-boot-pit` (the full five-name set, pit
 * COERCED) stays committed beside the R1 tapes as the contrast pair that
 * pins the set semantics from the other side.
 */
export const R1_NO_HAZARDS = Object.freeze(['water', 'lava', 'ice', 'waterfall']);

/**
 * The item rooms, IN VISIT ORDER — 11 of the 13 non-combat items.
 *
 * Entering the room IS collection at this rung: the grant fires on the
 * arrival tick, so a leg touches the room and turns around rather than
 * approaching the pickup (less interior exposure, smaller census, and the
 * pickup rect stays comfortably un-clipped).
 *
 * The order is a 2-opt tour over component-graph hop distance with two
 * constraints, and both are real:
 *
 *   **wand before darksword.** The Witch (L12) grants `darksword` from
 *   `doneTalking()` under `hasWand && !hasDarkSword` — the one true
 *   item→item dependency in the game. A tour that touched L12 early would
 *   grant darksword before wand and quietly contradict it. It is honoured
 *   only because L43 is reachable without L12 (0 → 89 → 87 → 44 → 37 → 38
 *   → 39 → 40 → 43, then 43 → 37 → 12).
 *
 *   **the fall-only cluster last.** L74 (darkshield) and L79 (darksuit) sit
 *   behind `83 ⇓ 84 ⇓ 85`, and the way out is another fall (`71 ⇓ 82`).
 *
 * ⚠ `fire`, `ghostsword` and `firewand` are NOT here, and their absence is
 * the rung's published blocked list rather than an omission — all three are
 * enemy-shaped and land at R5 (kickoff §9).
 */
export const R1_ITEM_ROOMS = Object.freeze([
    Object.freeze({ level: 10, items: Object.freeze(['sword']) }),
    Object.freeze({ level: 20, items: Object.freeze(['shield']) }),
    Object.freeze({ level: 89, items: Object.freeze(['feather']) }),
    Object.freeze({ level: 49, items: Object.freeze(['conch']) }),
    Object.freeze({ level: 43, items: Object.freeze(['wand']) }),
    Object.freeze({ level: 12, items: Object.freeze(['darksword']) }),
    Object.freeze({ level: 30, items: Object.freeze(['torch']) }),
    Object.freeze({ level: 64, items: Object.freeze(['spear']) }),
    Object.freeze({ level: 68, items: Object.freeze(['health']) }),
    Object.freeze({ level: 74, items: Object.freeze(['darkshield']) }),
    Object.freeze({ level: 79, items: Object.freeze(['darksuit']) }),
]);

/**
 * Where the walk breaks, as `[level, occurrence]` — "the Nth leg in level
 * L" — rather than as raw leg indices.
 *
 * A raw index would silently point somewhere else the first time the route
 * shifts by a leg; naming the arrival makes a route change a LOUD failure
 * in the planner ("the route enters L12 fewer than 4 times") instead of six
 * tapes that quietly no longer chain. The route revisits L12 four times,
 * which is exactly why the occurrence is part of the name.
 */
export const R1_SEGMENT_BOUNDARIES = Object.freeze([
    Object.freeze([0, 3]),    // 1 ends: sword and shield collected, back in L0
    Object.freeze([44, 2]),   // 2 ends: feather and the conch loop done
    Object.freeze([12, 1]),   // 3 ends: wand, then the Witch
    Object.freeze([12, 2]),   // 4 ends: torch, back at the Witch
    Object.freeze([12, 3]),   // 5 ends: ghostspear and health, back at the Witch
]);

/**
 * ⚠ THE ONE PLACE THIS WALK CHANGES THE GAME'S PERSISTENCE, and what it
 * costs.
 *
 * `in(L38) = {37}` and L37's only exit to it arrives at ctor (144,288) —
 * which is exactly where L38's `buttonroom {tset:4, tag:5, flip:1,
 * room:37}` sits. The player's box overlaps its 8x6 hitbox on the arrival
 * tick, `ButtonRoom.update` collides `hitables` (which includes "Player")
 * and the setter runs. There is no route that avoids it: the game puts the
 * player there, and the room was built as a room-entry puzzle.
 *
 * The press does two writes (`ButtonRoom.as:73-88`):
 *   `Game.setPersistence(t=4, false, room=37)`  — `flip` inverts `persist`
 *   `Game.setPersistence(tag=5, false)`         — its own flag, in L38
 *
 * The second reaches nothing: no other entity in L38 carries tag 5. The
 * first reaches **L37's `fallrock {tset:0, tag:4}` at (288,32)**, and
 * `FallRock`'s CONSTRUCTOR (`FallRock.as:41-46`) reads
 * `Game.checkPersistence(tag)` — so the NEXT time L37 is built, the rock
 * exists at `fallTo`, `type = "Solid"`, `_active = true`. Slice 3 priced
 * `fallrock` as an evidenced INERT precisely because a fresh boot leaves
 * every persistence flag true; this route is what makes that premise stop
 * holding, in one level, for one rock.
 *
 * Under `noclip` the solidity is irrelevant. The position write is not:
 * `FallRock.update` does `if (activate && y >= fallTo) { p = collide(
 * "Player", x, y); if (p) p.y = ... }` — a direct write outside both
 * `noclip` and `noDamage`, the eighth member of R0 §8.7a's family. So the
 * rock's 16x16 hitbox at its entity position (296,40) becomes an avoid
 * volume for every leg after the press, and the route is planned around it
 * rather than found to miss it.
 *
 * The alternative was to route around L38 entirely, which costs the wand
 * AND darksword (the Witch grants it under `hasWand`) — two items, to
 * avoid one cited, deterministic, one-shot flag. Recorded here rather than
 * modelled generally: a persistence NAMESPACE is R3's, and this rung needs
 * one flag.
 */
export const R1_PERSISTENCE_EFFECTS = Object.freeze([
    Object.freeze({
        contact: 'proximity-hazard:buttonroom@144,288',
        level: 37,
        tag: 'fallrock tag 4, built FALLEN',
        // ⚠ `right`/`bottom` are not decoration: `rectsOverlap` reads THEM,
        // and the first cut of this entry omitted them — so the planner and
        // the executor both compared against `undefined`, both reported the
        // route clear, and the model walked the player through the armed
        // rock. The GAME is what noticed, 2389 ticks into a segment: its y
        // stopped and reversed where `FallRock.update` writes it, while the
        // model's kept falling. Built through `levelWorld.rect` now, and
        // `synthesizeLegs` asserts the shape.
        rect: Object.freeze(rect(288, 32, 16, 16)),
        why: "L38's arrival buttonroom wrote persistence(4) = false into L37, so "
            + "L37's FallRock at (288,32) is now built already fallen and its update "
            + 'writes the player\'s y directly.',
    }),
]);

/**
 * Per-waypoint tick budget for the R1 walk, well above v2's 400.
 *
 * v2's default was sized for level 0. R1 crosses levels up to 40 tiles
 * wide, and the smoother deliberately produces FEW, LONG waypoints (each
 * one costs a full stop), so a single waypoint can be ~900 px of diagonal
 * — about 860 ticks at the controller's ~1.05 px/tick limit cycle. 400
 * turned three segments into "not reached within 400 ticks" while the run
 * was still moving at nearly full speed.
 *
 * It stays a real stall detector: a genuine stall reports `v=(0,0)` and a
 * position that stopped changing, which this bound still catches — it is
 * the distance that grew, not the failure mode.
 */
export const R1_MAX_TICKS_PER_WAYPOINT = 1500;

/** Segment tape names, and the headline. `--only=` takes these. */
export const R1_SEGMENT_NAMES = Object.freeze([
    'r1-walk-1-sword-shield',
    'r1-walk-2-feather-conch',
    'r1-walk-3-wand-darksword',
    'r1-walk-4-torch',
    'r1-walk-5-spear-health',
    'r1-walk-6-cluster',
]);
export const R1_FULL_WALK_NAME = 'r1-walk-full';

/** Every item the walk ends holding, in collection order. */
export function r1AllItems() {
    return R1_ITEM_ROOMS.flatMap((r) => [...r.items]);
}

const legsMatch = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Validate a committed route against the decisions above.
 *
 * Loud rather than trusting: the route is generated, and a generated
 * artifact that has drifted from the intent it was generated for is exactly
 * the thing a committed file cannot tell you on its own.
 */
export function assertRouteWellFormed(route) {
    const fail = (m) => { throw new Error(`r1-route.json: ${m}`); };
    if (!route || !Array.isArray(route.legs) || route.legs.length === 0) {
        fail('no legs');
    }
    if (!legsMatch(route.boot, { ...R1_BOOT })) {
        fail(`boot ${JSON.stringify(route.boot)} is not the R1 boot `
            + `${JSON.stringify(R1_BOOT)}`);
    }
    if (!legsMatch(route.noHazards, [...R1_NO_HAZARDS])) {
        fail(`noHazards ${JSON.stringify(route.noHazards)} is not the R1 set — pit is `
            + 'LIVE at this rung and the tapes must say so');
    }
    if (route.legs[0].level !== R1_BOOT.level) fail('the first leg is not the boot level');
    if (route.legs[route.legs.length - 1].exit) fail('the last leg declares an exit');
    if (route.leg_boots.length !== route.legs.length) {
        fail(`${route.leg_boots.length} leg boots for ${route.legs.length} legs`);
    }
    route.legs.forEach((leg, i) => {
        if (route.leg_boots[i].level !== leg.level) {
            fail(`leg ${i} is in L${leg.level} but its boot names `
                + `L${route.leg_boots[i].level}`);
        }
    });
    if (!Array.isArray(route.persistence_effects)) fail('no persistence_effects list');
    const declaredEffects = R1_PERSISTENCE_EFFECTS.map((e) => e.contact).join(' ');
    const routeEffects = route.persistence_effects.map((e) => e.contact).join(' ');
    if (declaredEffects !== routeEffects) {
        fail(`persistence effects [${routeEffects}] are not the declared ones `
            + `[${declaredEffects}] — an effect the route no longer causes, or one it `
            + 'causes that nobody priced');
    }
    for (const e of route.persistence_effects) {
        const leg = route.legs[e.fromLeg];
        if (!leg || !(leg.contacts ?? []).includes(e.contact)) {
            fail(`persistence effect ${e.contact} names leg ${e.fromLeg}, which does `
                + 'not make that contact');
        }
    }
    const granted = route.grants.map((g) => `${g.level}:${g.items.join('+')}`).join(' ');
    const want = R1_ITEM_ROOMS.map((r) => `${r.level}:${r.items.join('+')}`).join(' ');
    if (granted !== want) fail(`grants [${granted}] are not the R1 item rooms [${want}]`);
    if (route.segment_boundaries.length !== R1_SEGMENT_BOUNDARIES.length) {
        fail(`${route.segment_boundaries.length} boundaries for `
            + `${R1_SEGMENT_BOUNDARIES.length} declared`);
    }
    let prev = 0;
    for (const b of route.segment_boundaries) {
        if (!Number.isInteger(b) || b <= prev || b >= route.legs.length) {
            fail(`boundary ${b} is not a strictly increasing leg index in `
                + `(0, ${route.legs.length})`);
        }
        prev = b;
    }
    return route;
}

/**
 * The tape specs the driver synthesizes from: six segments and the
 * headline, each `{name, boot, legs, relax, firstLeg, lastLeg, inherited}`.
 *
 * `relax` is the ONE object `synthesizeLegs` uses for the plan, the run and
 * the emitted tape — so a spec cannot give the planner and the tape
 * different ideas of which experiment this is.
 */
export function r1TapeSpecs(route) {
    assertRouteWellFormed(route);
    // ⚠ THE BOUNDARY LEG IS SHARED. Segment N's LAST leg and segment N+1's
    // FIRST leg are the same leg of the route: the boundary is the ARRIVAL
    // in that level, so one segment ends by arriving there (its exit
    // stripped — it stops rather than leaving) and the next boots there and
    // takes that leg's exit for real. An off-by-one the other way would
    // leave the walk standing in a level nobody exits.
    const bounds = [0, ...route.segment_boundaries, route.legs.length - 1];
    const specs = [];

    for (let s = 0; s < R1_SEGMENT_NAMES.length; s++) {
        const firstLeg = bounds[s];
        const lastLeg = bounds[s + 1];
        const legs = route.legs.slice(firstLeg, lastLeg + 1)
            .map((l, i) => (i === lastLeg - firstLeg ? { level: l.level, targets: [] } : { ...l }));
        const boot = route.leg_boots[firstLeg];
        const firstEntry = (g) => routeFirstEntry(route, g.level);
        // Everything collected up to and including the boundary the segment
        // boots at — the previous segment ended by arriving there, so its
        // grant has already fired. One entry at the boot level, which is
        // observed at tick 0.
        const inherited = s === 0 ? []
            : route.grants.filter((g) => firstEntry(g) <= firstLeg).flatMap((g) => [...g.items]);
        const own = route.grants
            .filter((g) => firstEntry(g) <= lastLeg
                && (s === 0 ? firstEntry(g) >= firstLeg : firstEntry(g) > firstLeg))
            .map((g) => ({ level: g.level, items: [...g.items] }));
        const grants = inherited.length > 0
            ? [{ level: boot.level, items: inherited }, ...own]
            : own;
        specs.push({
            name: R1_SEGMENT_NAMES[s],
            segment: s + 1,
            boot: { ...boot },
            legs,
            firstLeg,
            lastLeg,
            inherited,
            // Re-based on the segment's own leg indices. An effect caused
            // before this segment starts is already in force (leg 0); one
            // caused after it ends never fires here, and the filter drops it.
            extraVolumes: route.persistence_effects
                .filter((e) => e.fromLeg <= lastLeg)
                .map((e) => driverVolume(e, Math.max(0, e.fromLeg - firstLeg))),
            maxTicksPerTarget: R1_MAX_TICKS_PER_WAYPOINT,
            relax: { noclip: true, noDamage: true, noHazards: [...R1_NO_HAZARDS], grants },
        });
    }

    specs.push({
        name: R1_FULL_WALK_NAME,
        segment: null,
        boot: { ...route.boot },
        legs: route.legs.map((l) => ({ ...l })),
        firstLeg: 0,
        lastLeg: route.legs.length - 1,
        inherited: [],
        extraVolumes: route.persistence_effects.map((e) => driverVolume(e, e.fromLeg)),
        maxTicksPerTarget: R1_MAX_TICKS_PER_WAYPOINT,
        relax: {
            // ⚠ R1 IS THE NOCLIP RUNG, and it says so now rather than
            // inheriting it. R2's walk keeps every other relaxation and puts
            // the solids back, so `noclip` stopped being derivable from "is
            // this a relaxed walk" — see `synthesizeLegs`.
            noclip: true,
            noDamage: true,
            noHazards: [...R1_NO_HAZARDS],
            grants: route.grants.map((g) => ({ level: g.level, items: [...g.items] })),
        },
    });
    return specs;
}

/**
 * One persistence effect as the DRIVER wants it, with the rect rebuilt.
 *
 * ⚠ The route file stores `{x, y, w, h}` — that is the data — but
 * `rectsOverlap` reads `right`/`bottom`, and a rect without them never
 * overlaps anything, so every check against it silently passes. R1 shipped
 * exactly that and the GAME caught it 2389 ticks into a segment. The shape
 * is this module's to own, so it is rebuilt here through `levelWorld.rect`
 * rather than trusted from JSON.
 */
function driverVolume(effect, fromLeg) {
    return {
        ...effect,
        fromLeg,
        rect: rect(effect.rect.x, effect.rect.y, effect.rect.w, effect.rect.h),
    };
}

/** The first leg index that enters `level`. */
export function routeFirstEntry(route, level) {
    return route.legs.findIndex((l) => l.level === level);
}
