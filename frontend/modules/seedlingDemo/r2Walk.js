/**
 * seedlingDemo/r2Walk — the R2 full walk: what it collects with the SOLIDS
 * BACK, where it breaks into segments, and how a route turns into tape
 * specs.
 *
 * Region-atlas Phase 8, subtractive ladder rung R2, slice 6. Brief:
 * `CC/docs/plans/seedling-bot-r2-opus-kickoff.md` §9 and §11.
 *
 * Same division of labour as `r1Walk.js`: the ROUTE is data, computed by
 * `scripts/procgen/plan-seedling-r2-route.mjs` and committed as
 * `fixtures/r2-route.json`; this file holds the DECISIONS (which rooms, in
 * which order, where the walk breaks) plus the one piece of logic both the
 * tape generator and the tests need.
 *
 * ── What R2 is ────────────────────────────────────────────────────────
 * R1 walked the whole map with collision off and reached eleven of the
 * thirteen non-combat items. R2 turns the solids back on. The ruled
 * crutches that stay: `noDamage`, the four-name `noHazards` set (pit is
 * LIVE and modelled), item grants on room entry, and a DERIVED persistence
 * clear list standing in for the interactive blockers the bot cannot yet
 * operate. The crutch that is NOT a crutch: buttons, locks and covers are
 * modelled game mechanics now, so L71's lock is opened by holding its
 * button, which is what a player does.
 *
 * ⚠ THREE ITEMS ARE LOST TO NAMED SOLIDS, and that is the ladder working
 * rather than failing. See `R2_BLOCKED` for each seal and the rung that
 * opens it.
 */

/** The build's baked-in spawn, which is also where the walk starts. */
export const R2_BOOT = Object.freeze({ level: 0, x: 80, y: 128 });

/**
 * Carried from R1 unchanged: pit is OMITTED, so pits stay LIVE and the
 * fall is a modelled transport the planner routes with.
 */
export const R2_NO_HAZARDS = Object.freeze(['water', 'lava', 'ice', 'waterfall']);

/**
 * How long a leg holds a button, in ticks.
 *
 * ⚠ A FLOOR, NOT A MEASUREMENT. `Lock.activationStep` decrements alpha by
 * 0.01 with `Image.alpha` clamping at 0 and the `alpha > 0` test BEFORE
 * the decrement, so a Lock needs 101 CONTINUOUS ticks of activation — but
 * `Button.update` presses on OVERLAP, and the approach to a button overlaps
 * it for a few ticks before the controller reaches the full stop an arrival
 * requires. So the run reaches the hold with the fade already part-way
 * down and 101 is comfortably more than enough. Over-stating it is safe (a
 * held button stays held); under-stating it is not, and what the executor
 * actually asserts is the EFFECT — the responders were shut when the hold
 * began and open when it ended.
 */
export const R2_HOLD_TICKS = 101;

/**
 * The item rooms, IN VISIT ORDER — 8 of the 13 non-combat items.
 *
 * R1's eleven minus `conch`, `wand` and `health`, in R1's own relative
 * order. Entering the room IS collection at this rung: the grant fires on
 * the arrival tick, so a leg touches the room and turns around rather than
 * approaching the pickup.
 *
 * ⚠ `darksword` is here and `wand` is not, which the GAME would not allow:
 * the Witch (L12) grants darksword from `doneTalking()` under
 * `hasWand && !hasDarkSword`, the one true item→item dependency in the
 * game. R1 honoured it by collecting the wand first; R2 cannot, because
 * L38's cover and L39's wandlocks seal the wand behind a pushable and an
 * item use. The grant crutch does not consult the Witch — it is a property
 * write on room entry — so darksword is collected anyway, and this is the
 * first place on the ladder where a grant asserts something the game's own
 * logic would refuse. Recorded here rather than hidden: R3 retires the
 * crutch for exactly this class of item and the dependency comes back.
 */
export const R2_ITEM_ROOMS = Object.freeze([
    Object.freeze({ level: 10, items: Object.freeze(['sword']) }),
    Object.freeze({ level: 20, items: Object.freeze(['shield']) }),
    Object.freeze({ level: 89, items: Object.freeze(['feather']) }),
    Object.freeze({ level: 12, items: Object.freeze(['darksword']) }),
    Object.freeze({ level: 30, items: Object.freeze(['torch']) }),
    Object.freeze({ level: 64, items: Object.freeze(['spear']) }),
    Object.freeze({ level: 74, items: Object.freeze(['darkshield']) }),
    Object.freeze({ level: 79, items: Object.freeze(['darksuit']) }),
]);

/**
 * The published blocked list, with the ONE named entity that seals each
 * and the rung that opens it.
 *
 * ⚠ Every seal is a SINGLE entity, established by removing one at a time
 * and re-testing the corridor at one-pixel granularity (kickoff §8.3). "It
 * is unreachable" is a claim about a map; "it is unreachable because
 * `karlore@112,272` stands in a one-tile corridor and removes itself only
 * when `Player.hasFire`" is a claim about a game, and only the second one
 * tells a later rung what to build.
 */
export const R2_BLOCKED = Object.freeze([
    Object.freeze({
        item: 'conch',
        seal: 'L48 karlore@112,272, an NPC in a 1-tile corridor whose own dialogue '
            + 'says so; Karlore.added() removes it only if Player.hasFire, and its '
            + 'tag is -1 so no clear reaches it',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'wand',
        seal: 'L38 cover@144,112 needs pushableblockfire@80,208 pushed onto '
            + 'button@80,192; then L39\'s three stacked wandlocks (tset 3/4/5) need '
            + 'wand shots',
        rung: 'R3',
    }),
    Object.freeze({
        item: 'health',
        seal: 'L63\'s bridge at tile (2,9) needs spearing (Player.as:1098 genericHit '
            + 'under t == "Spear"); then L65 rock@192,96 or pushableblockspear@176,128',
        rung: 'R3',
    }),
    Object.freeze({
        item: 'fire',
        seal: 'combat-gated by construction (BobBoss)',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'ghostsword',
        seal: 'L98\'s IceTurret disc covers its whole entrance room',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'firewand',
        seal: 'L108\'s darksuit-gated LavaTrap ferry',
        rung: 'R5',
    }),
]);

/**
 * ⚠ `hitsMax` STAYS AT ITS BASE, and that is an assertion rather than a
 * default. `Player.hitsMaxDef` is 3 and `health` ADDS 1, so R1's walk ended
 * at 4 and R2's must end at 3 — a run that reported 4 would mean a grant
 * fired for a room the walk never entered. It is the one claim in the
 * readout that is proved by a NEGATIVE.
 */
export const R2_HITS_MAX = 3;

/**
 * Where the walk breaks, as `[level, occurrence]` — "the Nth leg in level
 * L" — rather than as raw leg indices.
 *
 * A raw index would silently point somewhere else the first time the route
 * shifts by a leg; naming the arrival makes a route change a LOUD failure
 * in the planner instead of tapes that quietly no longer chain.
 *
 * ⚠ AND THE BOUNDARIES ARE CHOSEN SO A RE-ROUTE TOUCHES THE FEWEST TAPES.
 * That is the R1 lesson priced: when L37's FallRock forced a re-route, it
 * cost two recordings out of seven because the roster happened to be split
 * well. Each boundary here is at a hub the walk passes through once, so a
 * change inside one segment cannot move another's endpoints.
 */
export const R2_SEGMENT_BOUNDARIES = Object.freeze([
    Object.freeze([0, 3]),    // 1 ends: sword and shield collected, back in L0
    Object.freeze([0, 4]),    // 2 ends: the feather round trip, back in L0
    Object.freeze([12, 2]),   // 3 ends: darksword and torch, back at the Witch
    Object.freeze([12, 3]),   // 4 ends: the spear, back at the Witch
    Object.freeze([71, 2]),   // 5 ends: the 83-84-85 fall, the HOLD, darkshield
]);

/** Segment tape names, and the headline. `--only=` takes these. */
export const R2_SEGMENT_NAMES = Object.freeze([
    'r2-walk-1-sword-shield',
    'r2-walk-2-feather',
    'r2-walk-3-darksword-torch',
    'r2-walk-4-spear',
    'r2-walk-5-darkshield',
    'r2-walk-6-darksuit',
]);
export const R2_FULL_WALK_NAME = 'r2-walk-full';

/**
 * The A* cell pitch this walk plans at, in pixels.
 *
 * ⚠ EIGHT, NOT SIXTEEN, and it is the rung's geometry that forced it. A
 * tile lattice is sound and INCOMPLETE, and the incompleteness bites when a
 * collider sits off the tile grid: `planttorch@120,152` in level 62 is a
 * 16x16 solid half a tile off in both axes, standing in a corridor two
 * tiles wide. It clips all four surrounding tile centres, so the tile
 * lattice reports the shaft to level 64 — and with it the SPEAR —
 * unreachable, when 16 px of that corridor is clear and the player steps
 * one pixel at a time. This is the recon's own warning arriving on the
 * committed planner: a tile-centre instrument reported seven seals at R1
 * that do not exist.
 *
 * Eight is the coarsest pitch that threads it. See `botDriverV2`'s
 * DEFAULT_LATTICE docblock for why this is an option rather than a global
 * refinement — the R1 tapes are frozen and a finer lattice would re-route
 * them.
 */
export const R2_LATTICE = 8;

/**
 * The clearance A* itself keeps from a solid, in pixels.
 *
 * ⚠ THIS ONE DELETES LATTICE CELLS, so it is not a "more is safer" number:
 * raise it and the clearance pass finds no path at all, after which
 * `planWaypoints` walks its ladder down to nothing and the route loses its
 * clearance everywhere instead of in the one tight spot. Measured: moving
 * it from 2 to 6 traded one planner throw for an earlier one. Two is enough
 * to dodge the half-pixel clearances the smoother's fallback used to keep,
 * and small enough that a 16 px corridor still has a column.
 *
 * ⚠ There is deliberately NO smoother margin beside it any more. Growing
 * the box while testing a shortcut was R2's first answer to the
 * controller's overshoot; it worked, cost 30% more ticks and 4.7x the input
 * spans, and the recompiled runtime then could not load the headline tape
 * at all. `allowGrazes` answers the same problem better — see
 * `botDriverV2`'s `grow`.
 */
export const R2_NODE_MARGIN = 2;

/**
 * The clearance the planner keeps from a teleporter it is NOT taking.
 *
 * ⚠ BIGGER THAN THE OTHERS, AND IT DOES NOT DESCEND. An overshoot into a
 * wall is absorbed and reported as a graze; an overshoot into a trigger
 * ends up in another level, mid-route, with nothing to recover to. Three
 * R2 legs did exactly that — one aiming at level 64's exit and arriving in
 * level 61 — before this existed.
 *
 * ⚠ The route GRAPH does not use it, deliberately: an arrival tile is
 * inside its own trigger, so applying it there would fragment a component
 * around every door. The driver is therefore stricter than the graph, and
 * an edge the graph offers that the driver will not walk is a loud throw
 * during tape synthesis — before anything is recorded.
 */
export const R2_TRIGGER_MARGIN = 4;

/** Per-waypoint tick budget, carried from R1 — big levels, few waypoints. */
export const R2_MAX_TICKS_PER_WAYPOINT = 1500;

/**
 * The one HOLD on the R2 route, as the ACCEPTANCE READOUT needs it.
 *
 * ⚠ THE RECTS ARE COPIED, AND A TEST PINS THEM AGAINST `buildLevelWorld`.
 * `r2Acceptance` is dependency-free on purpose — it takes the game's reports
 * as data — so it cannot build a world to ask where the button is. A rect
 * copied out of the geometry is exactly the shape of thing that drifts
 * silently and turns every claim about it into a claim about nothing, so
 * `r2Walk.test.js` re-derives both from the extract and compares.
 *
 * `button` is `Button@112,176`'s hitbox and `lock` is `Lock@112,160`'s. They
 * are DISJOINT — y = 178 touches neither — which is why the crossing is a
 * knife-edge and why `l71-button-lock` / `l71-lock-shut` had to be recorded
 * before anyone believed it.
 */
export const R2_HOLD_WITNESS = Object.freeze({
    level: 71,
    presser: 'button@112,176',
    lock_tag: 'lock@112,160',
    button: Object.freeze({ x: 116, y: 181, right: 124, bottom: 187 }),
    lock: Object.freeze({ x: 112, y: 160, right: 128, bottom: 176 }),
});

/** Every item the walk ends holding, in collection order. */
export function r2AllItems() {
    return R2_ITEM_ROOMS.flatMap((r) => [...r.items]);
}

const listsMatch = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Validate a committed route against the decisions above.
 *
 * Loud rather than trusting: the route is generated, and a generated
 * artifact that has drifted from the intent it was generated for is exactly
 * the thing a committed file cannot tell you on its own.
 */
export function assertRouteWellFormed(route) {
    const fail = (m) => { throw new Error(`r2-route.json: ${m}`); };
    if (!route || !Array.isArray(route.legs) || route.legs.length === 0) fail('no legs');
    if (!listsMatch(route.boot, { ...R2_BOOT })) {
        fail(`boot ${JSON.stringify(route.boot)} is not the R2 boot `
            + `${JSON.stringify(R2_BOOT)}`);
    }
    if (!listsMatch(route.noHazards, [...R2_NO_HAZARDS])) {
        fail(`noHazards ${JSON.stringify(route.noHazards)} is not the R2 set — pit is `
            + 'LIVE at this rung and the tapes must say so');
    }
    if (route.legs[0].level !== R2_BOOT.level) fail('the first leg is not the boot level');
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
    const granted = route.grants.map((g) => `${g.level}:${g.items.join('+')}`).join(' ');
    const want = R2_ITEM_ROOMS.map((r) => `${r.level}:${r.items.join('+')}`).join(' ');
    if (granted !== want) fail(`grants [${granted}] are not the R2 item rooms [${want}]`);

    // ── the clear list ────────────────────────────────────────────────
    // Two properties, and both have bitten this arc in other costumes: a
    // clear for a level the walk never enters is a crutch nobody reviewed,
    // and a clear with no note is a pair of numbers nobody can audit.
    if (!Array.isArray(route.persistence)) fail('no persistence list');
    const levels = new Set(route.legs.map((l) => l.level));
    for (const c of route.persistence) {
        if (!levels.has(c.level)) {
            fail(`the clear list names L${c.level} tag ${c.tag}, which the walk never `
                + 'enters — a crutch applied where nobody is looking');
        }
        if (!c.note) {
            fail(`the clear for L${c.level} tag ${c.tag} names no blocker. The note is `
                + 'the audit surface: without it the list is forty pairs of numbers.');
        }
    }

    // ── the holds ─────────────────────────────────────────────────────
    if (!Array.isArray(route.holds)) fail('no holds list');
    for (const h of route.holds) {
        const leg = route.legs[h.leg];
        if (!leg || leg.level !== h.level) {
            fail(`hold ${h.presser} names leg ${h.leg}, which is not in L${h.level}`);
        }
        const target = (leg.targets ?? []).find((t) => t.hold);
        if (!target) fail(`leg ${h.leg} carries no hold target for ${h.presser}`);
        if (target.hold.ticks !== R2_HOLD_TICKS) {
            fail(`leg ${h.leg} holds for ${target.hold.ticks} ticks, not the declared `
                + `${R2_HOLD_TICKS}`);
        }
        if (h.opens.length === 0) fail(`hold ${h.presser} opens nothing`);
    }
    // ⚠ A LEG WITH A HOLD TARGET AND NO HOLD RECORD is the other direction,
    // and it is the one a route regeneration could produce quietly.
    route.legs.forEach((leg, i) => {
        for (const t of leg.targets ?? []) {
            if (t.hold && !route.holds.some((h) => h.leg === i)) {
                fail(`leg ${i} holds ${JSON.stringify(t.hold.presser)} but the route's `
                    + 'holds list does not record it');
            }
        }
    });

    if (route.segment_boundaries.length !== R2_SEGMENT_BOUNDARIES.length) {
        fail(`${route.segment_boundaries.length} boundaries for `
            + `${R2_SEGMENT_BOUNDARIES.length} declared`);
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

/** The first leg index that enters `level`. */
export function routeFirstEntry(route, level) {
    return route.legs.findIndex((l) => l.level === level);
}

/**
 * The tape specs the driver synthesizes from: six segments and the
 * headline, each `{name, boot, legs, relax, lattice, firstLeg, lastLeg,
 * inherited}`.
 *
 * `relax` is the ONE object `synthesizeLegs` uses for the plan, the run and
 * the emitted tape — and at R2 it carries `noclip: false` and the clear
 * list, so a spec cannot give the planner and the tape different ideas of
 * which experiment this is.
 *
 * ⚠ EVERY SEGMENT CARRIES THE WHOLE CLEAR LIST, not the subset its own
 * levels need. A clear is applied once, before the first live tick, and
 * `buildLevelWorld` only ever hands a level its OWN tags — so the list is
 * inert in every level a segment does not enter, and giving each segment a
 * different one would make the six tapes six different experiments. The
 * headline's list and the segments' lists being identical is what lets the
 * chain claim mean anything.
 */
export function r2TapeSpecs(route) {
    assertRouteWellFormed(route);
    const clears = () => route.persistence.map((c) => ({ ...c }));
    // ⚠ THE BOUNDARY LEG IS SHARED. Segment N's LAST leg and segment N+1's
    // FIRST leg are the same leg of the route: the boundary is the ARRIVAL
    // in that level, so one segment ends by arriving there (its exit
    // stripped — it stops rather than leaving) and the next boots there and
    // takes that leg's exit for real.
    const bounds = [0, ...route.segment_boundaries, route.legs.length - 1];
    const specs = [];

    for (let s = 0; s < R2_SEGMENT_NAMES.length; s++) {
        const firstLeg = bounds[s];
        const lastLeg = bounds[s + 1];
        const legs = route.legs.slice(firstLeg, lastLeg + 1)
            .map((l, i) => (i === lastLeg - firstLeg
                ? { level: l.level, targets: [] }
                : JSON.parse(JSON.stringify(l))));
        const boot = route.leg_boots[firstLeg];
        const firstEntry = (g) => routeFirstEntry(route, g.level);
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
            name: R2_SEGMENT_NAMES[s],
            segment: s + 1,
            boot: { ...boot },
            legs,
            firstLeg,
            lastLeg,
            inherited,
            lattice: R2_LATTICE,
            nodeMargin: R2_NODE_MARGIN,
            triggerMargin: R2_TRIGGER_MARGIN,
            allowGrazes: true,
            maxTicksPerTarget: R2_MAX_TICKS_PER_WAYPOINT,
            relax: {
                noclip: false,
                noDamage: true,
                noHazards: [...R2_NO_HAZARDS],
                grants,
                persistence: clears(),
            },
        });
    }

    specs.push({
        name: R2_FULL_WALK_NAME,
        segment: null,
        boot: { ...route.boot },
        legs: JSON.parse(JSON.stringify(route.legs)),
        firstLeg: 0,
        lastLeg: route.legs.length - 1,
        inherited: [],
        lattice: R2_LATTICE,
        nodeMargin: R2_NODE_MARGIN,
        triggerMargin: R2_TRIGGER_MARGIN,
        allowGrazes: true,
        maxTicksPerTarget: R2_MAX_TICKS_PER_WAYPOINT,
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [...R2_NO_HAZARDS],
            grants: route.grants.map((g) => ({ level: g.level, items: [...g.items] })),
            persistence: clears(),
        },
    });
    return specs;
}
