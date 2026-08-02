/**
 * seedlingDemo/r3Walk — the R3 full walk: the same map as R2 with the
 * CRUTCHES OFF.
 *
 * Region-atlas Phase 8, subtractive ladder rung R3, slices 5-6. Brief:
 * `CC/docs/plans/seedling-bot-r3-opus-kickoff.md` §9 (the rulings) and §11.
 *
 * Same division of labour as `r1Walk.js` and `r2Walk.js`: the ROUTE is
 * data, computed by `scripts/procgen/plan-seedling-r3-route.mjs` and
 * committed as `fixtures/r3-route.json`; this file holds the DECISIONS —
 * which items, in which order, which clears survive and why, where the walk
 * breaks — plus the logic the tape generator and the tests both need.
 *
 * ── What R3 is, and what it is NOT ────────────────────────────────────
 * R2 walked with the solids back and took EIGHT items, every one of them
 * handed over by a `grants` entry on room entry, through a map opened by
 * twenty-five declared persistence clears. R3 changes neither the map nor
 * the physics. It changes who does the work:
 *
 *   - **Items are COLLECTED.** The walk stands on each pickup and pages its
 *     ceremony through with X releases. `grants` is EMPTY.
 *   - **One blocker is OPENED.** L71's `shieldlock@288,256` is touched
 *     while holding the dark shield, which is what a player does.
 *   - **The clear list shrinks from 25 to 10**, and every survivor is a
 *     NAMED EXCEPTION with the rung that retires it.
 *
 * ⚠ AND THE HEADLINE IS SIX ITEMS, NOT ELEVEN, in two steps down.
 *
 * The rung's brief asked for eleven, and SLICE 0 found that three of the
 * four extra ones are not R3-shaped at source (kickoff §8.2): `conch`'s
 * Karlore despawns on `Player.hasFire`, not on being talked to; `wand`
 * gates its whole pickup on `hasAllTotemParts()`; `darksword`'s only
 * source is the Witch, who needs the wand. `health`'s two openers are both
 * in enemy rooms. That put the target at seven — and `darksword` LEFT the
 * claim, because R2 only had it by way of a grant the game's own logic
 * would have refused.
 *
 * ⛔ Then SLICE 5's narrowing took `shield` as well, and it is the R2
 * crutch arriving to be paid for rather than a routing difficulty. See
 * `R3_BLOCKED`: the walk reaches level 20 and cannot reach the pickup
 * inside it, which at R2 was the same thing.
 *
 * So the claim is SIX, and it is the SAME MAP WITH THE CRUTCHES OFF rather
 * than more items.
 */

/** The build's baked-in spawn, which is also where the walk starts. */
export const R3_BOOT = Object.freeze({ level: 0, x: 80, y: 128 });

/** Carried unchanged from R2: pit is OMITTED, so pits stay LIVE. */
export const R3_NO_HAZARDS = Object.freeze(['water', 'lava', 'ice', 'waterfall']);

/**
 * The item rooms, IN VISIT ORDER — and now with the PICKUP, not just the
 * level.
 *
 * ⚠ THIS IS THE NARROWING THE RUNG TURNS ON. At R2 entering the room WAS
 * collection: the grant fired on the arrival tick, so a leg could touch the
 * doorway and turn around. At R3 the walk has to reach the pickup's own
 * volume and stand in it, so a route that gets into the room and no further
 * is a route that collects nothing. The tour targets a component the pickup
 * can be walked into FROM, and the leg carries a `collect` naming it.
 *
 * `tag` is the pickup's OWN persistence tag — what its `removed()` writes
 * false. It is the difference between "the item boolean is true" and "the
 * game recorded the player taking it", and the R3 ledger asserts both: the
 * flags off at the end must be EXACTLY the declared clears, plus the one
 * the touch earns, plus these six. Nothing else.
 *
 * ⚠ THE ORDER IS LOAD-BEARING IN ONE PLACE. `darkshield` (L74) must precede
 * `darksuit` (L79), because the only way to L79 is L71's shield lock and
 * `ShieldLock.update` gates on `Player.hasDarkShield`. R2's order already
 * had it that way; here it is a requirement rather than a coincidence, and
 * the executor's `runTouch` refuses by name if it is ever violated.
 */
export const R3_ITEM_ROOMS = Object.freeze([
    Object.freeze({ level: 10, item: 'sword', tag: 0, pickup: Object.freeze({ x: 48, y: 48 }) }),
    Object.freeze({
        level: 89, item: 'feather', tag: 0, pickup: Object.freeze({ x: 160, y: 96 }),
    }),
    Object.freeze({ level: 30, item: 'torch', tag: 4, pickup: Object.freeze({ x: 64, y: 64 }) }),
    Object.freeze({ level: 64, item: 'spear', tag: 1, pickup: Object.freeze({ x: 72, y: 24 }) }),
    Object.freeze({
        level: 74, item: 'darkshield', tag: 0, pickup: Object.freeze({ x: 48, y: 32 }),
    }),
    Object.freeze({
        level: 79, item: 'darksuit', tag: 0, pickup: Object.freeze({ x: 40, y: 152 }),
    }),
]);

/**
 * The ONE blocker R3 opens by hand, and the item that opens it.
 *
 * `shieldlock@288,256` seals L71's east door — the teleporter at (304,256)
 * to L76, and with it the whole L76 -> L77 -> L78 -> L79 chain that ends at
 * `darksuit`. `ShieldLock.update` collides at `x - 1`, snaps `p.y`, refuses
 * input for its ~101-tick fade, and `turnOff()` then restores input and
 * writes `setPersistence(2, false)` — so the clear R2 DECLARED is the same
 * flag R3 EARNS.
 */
export const R3_TOUCH = Object.freeze({
    level: 71,
    lock: Object.freeze({ x: 288, y: 256 }),
    tag: 2,
    shield: 'hasDarkShield',
    item: 'darkshield',
    opens: 'the teleporter at (304,256) to level 76, and the chain to darksuit',
});

/**
 * The clears that SURVIVE, each with the ONE opener it is waiting for and
 * the rung that retires it.
 *
 * ⚠ TEN, NOT TWENTY-FIVE, AND NOT TEN BY NECESSITY EITHER. R2's list
 * was offered PER LEVEL rather than per need — `persistenceClearsFor` hands
 * over every clearable tag in every level the route enters — so seventeen
 * of the twenty-five retire by DELETION: the walk never needed them.
 *
 * ⚠ And a one-out sweep is NOT the bill. Removing clears one at a time says
 * seven are individually load-bearing, and those seven alone reach only
 * three of the seven item rooms: two clears in a doorway wide enough for
 * either each answer "not required", and then both come off and the door
 * shuts. The bill is an IRREDUNDANT set — remove one at a time and KEEP the
 * removal only while every room stays reachable — which is what
 * `recon-seedling-r3.mjs --minimal` computes and what the shipped planner
 * then has to confirm.
 *
 * ⚠⚠ AND THE PLANNER DID NOT CONFIRM IT — THREE TIMES. The recon asked its
 * question at LEVEL granularity, because that is what R2's reachability
 * meant, and it asked it of a REACHABILITY GRAPH. The shipped planner asks
 * it at the PICKUP'S OWN TILE, with the driver's own clearances and the
 * controller's own overshoot, and the answer is two clears bigger again:
 *
 *   `L30 tag 0`   the narrowing            the torch's tile, not its level
 *   `L3 tag 0`    the driver's own A*      no path across L3 at any clearance
 *   `L11 tag 0`   the CONTROLLER           the overshoot clips a chest
 *
 * The thing to carry is not that the instrument was buggy — it was
 * answering the question it was asked. It is that a reachability graph and
 * a walk are different questions, and only the second one is the claim.
 *
 * ⚠ THREE OUTCOMES, NOT TWO. "Unreachable without the lock" is only
 * CIRCULAR if the room was reachable WITH it. L19 and L67 are unreachable
 * under every clear list, which is a different seal needing a different
 * name — calling it circular would send a later rung hunting a lock that is
 * not the problem.
 */
export const R3_CLEARS = Object.freeze([
    Object.freeze({
        level: 3, tag: 0, note: 'breakablerock@96,112',
        opener: 'a sword swing (Player.as:1098 genericHit)',
        why: 'THE SHIPPED PLANNER PUT THIS ONE BACK, and the reachability instrument '
            + 'could not have: with the rock standing, the driver\'s own A* finds no '
            + 'walkable path across L3 at ANY clearance it will descend to. ⚠ A slash is '
            + 'a bare X press (Main.primary defaults to the sword), so this one is '
            + 'nearly in reach — what it needs is the enemy-free-room policy of §3 '
            + 'applied to L3 and a swing primitive, which slice 0 ruled out of this rung',
        rung: 'R4',
    }),
    Object.freeze({
        level: 11, tag: 0, note: 'chest@32,48',
        opener: 'walking under it (Chest.update collides a 1-px line beneath)',
        why: 'ALSO THE PLANNER\'S, and it is not an opener question at all: the chest is '
            + 'a Solid AND an avoid volume in a corridor the walk has to thread, and the '
            + 'controller\'s overshoot clips it. Opening one spawns a SealPiece (150 '
            + 'frozen frames), writes persistence, and burns an UNBOUNDED number of '
            + 'Math.random() draws for the seal index — so the RNG stream shifts by an '
            + 'amount that depends on saved state',
        rung: 'R5',
    }),
    Object.freeze({
        level: 12, tag: 3, note: 'bosslock@80,656',
        opener: 'BossKey (keyType 1) in L29',
        why: 'CIRCULAR — L29 is reachable only through a bosslock clear',
        rung: 'R4',
    }),
    Object.freeze({
        level: 12, tag: 5, note: 'bosslock@432,240',
        opener: 'BossKey (keyType 0) in L19',
        why: 'L19 is unreachable under EVERY clear list — a different seal, not a '
            + 'circular one',
        rung: 'R4',
    }),
    Object.freeze({
        level: 12, tag: 7, note: 'magicallock@32,864',
        opener: 'a wand shot (WandShot.checkEntity -> MagicalLock.hit)',
        why: 'the wand gates its whole pickup on Player.hasAllTotemParts()',
        rung: 'R5',
    }),
    Object.freeze({
        level: 12, tag: 12, note: 'bosslock@32,864',
        opener: 'BossKey (keyType 4) in L67',
        why: 'L67 is unreachable under EVERY clear list',
        rung: 'R4',
    }),
    Object.freeze({
        level: 24, tag: 0, note: 'burnabletree@32,128',
        opener: 'fire',
        why: 'fire is dropped by BobBoss — combat-gated by construction',
        rung: 'R5',
    }),
    Object.freeze({
        level: 30, tag: 0, note: 'bosslock@64,32',
        opener: 'a BossKey (keyType 0)',
        why: 'THE NARROWING PUT THIS ONE BACK. R2 declared it and the level-granular '
            + 'minimal bill dropped it, because entering L30 was collection — with the '
            + 'pickup\'s own tile as the target it is the ONE thing that unseals the '
            + 'torch, checked one at a time over every clear the map offers',
        rung: 'R4',
    }),
    Object.freeze({
        level: 60, tag: 0, note: 'lock@128,80',
        opener: 'totalEnemies() == 0',
        why: 'a tSet == -1 kill-lock, ruled a named exception at slice 0',
        rung: 'R5',
    }),
    Object.freeze({
        level: 71, tag: 0, note: 'lock@112,192',
        opener: 'totalEnemies() == 0',
        why: 'a tSet == -1 kill-lock, ruled a named exception at slice 0',
        rung: 'R5',
    }),
]);

/**
 * The items that are NOT on the claim, each with the ONE thing that seals
 * it at SOURCE — not "the route could not get there", which is a claim
 * about a map, but "the game refuses", which is a claim about the game.
 */
export const R3_BLOCKED = Object.freeze([
    Object.freeze({
        item: 'shield',
        seal: "L20's shield@112,48 is in the level's OTHER component. The walk arrives "
            + 'from L13 into a 2x4 shaft sealed by lock@32,80 (tset 0, so no clear '
            + 'despawns it), whose only presser buttonroom@192,16 is adjacent to NO '
            + 'walkable component at all — it is walled in behind shieldlocknorm@176,16, '
            + 'which needs Player.hasShield. The other entrance is L19\'s stairs, and '
            + 'L19 is Dungeon2_Boss: shieldboss@80,32 means the census cannot build the '
            + 'level. NO clear list on the map unseals it, checked one at a time over '
            + 'all 72 offered clears and all of them together. ⚠ R2 "collected" it by '
            + 'entering the level and turning around.',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'conch',
        seal: 'Karlore.added() removes him ONLY on Player.hasFire; doneTalking() calls '
            + 'unlockMedal and nothing else, and his tag is -1 so no clear reaches him. '
            + 'Talking does NOT despawn him.',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'wand',
        seal: 'Wand.update gates the entire pickup on Player.hasAllTotemParts() '
            + '(Wand.as:78) — five totempart pickups in L39-L42, and L40 alone holds 22 '
            + 'enemies',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'darksword',
        seal: 'Witch.doneTalking() requires Main.hasWand, and NO darksword placement '
            + 'exists anywhere in the extract — she is its only source. R2 collected it '
            + 'because a grant is a property write that does not consult her.',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'health',
        seal: "L63's bridge and L65's rock@192,96 are both inside enemy rooms "
            + '(bob@208,80 is 16 px from the rock); L68 holds magicallock@16,32 beside '
            + 'health@16,16',
        rung: 'R4/R5',
    }),
]);

/**
 * ⚠ `hitsMax` STAYS AT ITS BASE, and it is an assertion rather than a
 * default. `Player.hitsMaxDef` is 3 and `health` ADDS 1 — so a run that
 * reported 4 would mean an item was taken in a room the walk never entered.
 * The one claim in the readout proved by a NEGATIVE, carried from R2.
 */
export const R3_HITS_MAX = 3;

/** Every item the walk ends holding, in collection order. */
export function r3AllItems() {
    return R3_ITEM_ROOMS.map((r) => r.item);
}

/** The A* cell pitch, the clearances and the budget — all carried from R2. */
export const R3_LATTICE = 8;
export const R3_NODE_MARGIN = 2;
export const R3_TRIGGER_MARGIN = 4;
export const R3_MAX_TICKS_PER_WAYPOINT = 1500;

/**
 * The hold FLOOR a hold edge declares, carried from R2 unchanged.
 *
 * ⚠ A FLOOR, NOT A MEASUREMENT. `Button.update` presses on OVERLAP and the
 * approach overlaps for several ticks before the full stop an arrival
 * requires, so the run reaches the hold with the fade already part-way
 * down. Over-state, never under-state; what the executor actually asserts
 * is the EFFECT.
 */
export const R3_HOLD_TICKS = 101;

/**
 * Where the walk breaks, as `[level, occurrence]` — "the Nth leg in level
 * L" — rather than as raw leg indices.
 *
 * A raw index would silently point somewhere else the first time the route
 * shifts by a leg; naming the arrival makes a route change a LOUD failure
 * in the planner instead of tapes that quietly no longer chain.
 *
 * ⚠ AND THE BOUNDARIES ARE CHOSEN SO A RE-ROUTE TOUCHES THE FEWEST TAPES —
 * the R1 lesson, priced. One item per segment, each boundary at a hub the
 * walk passes through once, so a change inside one segment cannot move
 * another's endpoints.
 */
export const R3_SEGMENT_BOUNDARIES = Object.freeze([
    Object.freeze([0, 2]),     // 1 ends: sword collected, back in L0
    Object.freeze([12, 1]),    // 2 ends: the feather round trip, at the Witch
    Object.freeze([12, 2]),    // 3 ends: the torch, back at the Witch
    Object.freeze([12, 3]),    // 4 ends: the spear, back at the Witch
    Object.freeze([71, 2]),    // 5 ends: the 83-84-85 fall, the HOLD, darkshield
]);

/** Segment tape names, and the headline. `--only=` takes these. */
export const R3_SEGMENT_NAMES = Object.freeze([
    'r3-walk-1-sword',
    'r3-walk-2-feather',
    'r3-walk-3-torch',
    'r3-walk-4-spear',
    'r3-walk-5-darkshield',
    'r3-walk-6-darksuit',
]);
export const R3_FULL_WALK_NAME = 'r3-walk-full';

const listsMatch = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Validate a committed route against the decisions above.
 *
 * Loud rather than trusting: the route is generated, and a generated
 * artifact that has drifted from the intent it was generated for is exactly
 * the thing a committed file cannot tell you on its own.
 */
export function assertRouteWellFormed(route) {
    const fail = (m) => { throw new Error(`r3-route.json: ${m}`); };
    if (!route || !Array.isArray(route.legs) || route.legs.length === 0) fail('no legs');
    if (!listsMatch(route.boot, { ...R3_BOOT })) {
        fail(`boot ${JSON.stringify(route.boot)} is not the R3 boot`);
    }
    if (!listsMatch(route.noHazards, [...R3_NO_HAZARDS])) fail('noHazards is not the set');
    if (route.legs[0].level !== R3_BOOT.level) fail('the first leg is not the boot level');
    if (route.legs[route.legs.length - 1].exit) fail('the last leg declares an exit');
    if (route.leg_boots.length !== route.legs.length) fail('leg_boots length mismatch');
    route.legs.forEach((leg, i) => {
        if (route.leg_boots[i].level !== leg.level) {
            fail(`leg ${i} is in L${leg.level} but its boot names `
                + `L${route.leg_boots[i].level}`);
        }
    });

    // ⚠ THE LEDGER, AT THE ROUTE LEVEL. `grants` EMPTY is the whole rung:
    // every item on the claim is walked onto and talked through.
    if (!Array.isArray(route.grants) || route.grants.length > 0) {
        fail(`grants is ${JSON.stringify(route.grants)} — R3's headline grants NOTHING; `
            + 'every item is collected by the player');
    }
    const collected = (route.collects ?? []).map((c) => c.item);
    if (!listsMatch(collected, r3AllItems())) {
        fail(`collects [${collected.join(' ')}] are not the R3 item order `
            + `[${r3AllItems().join(' ')}]`);
    }
    for (const c of route.collects) {
        const leg = route.legs[c.leg];
        if (!leg || leg.level !== c.level) {
            fail(`${c.item}'s collect names leg ${c.leg}, which is not in L${c.level}`);
        }
        const t = (leg.targets ?? []).find((q) => q.collect
            && q.collect.pickup.x === c.pickup.x && q.collect.pickup.y === c.pickup.y);
        if (!t) fail(`leg ${c.leg} carries no collect target for ${c.item}`);
    }
    // ...and the other direction: a collect target with no record.
    route.legs.forEach((leg, i) => {
        for (const t of leg.targets ?? []) {
            if (t.collect && !route.collects.some((c) => c.leg === i)) {
                fail(`leg ${i} collects ${JSON.stringify(t.collect.pickup)} but the `
                    + "route's collects list does not record it");
            }
        }
    });

    // ── the touch, and the ORDER it depends on ────────────────────────
    if (!Array.isArray(route.touches) || route.touches.length !== 1) {
        fail(`${route.touches?.length} touches — R3 opens exactly one blocker by hand`);
    }
    const touch = route.touches[0];
    if (touch.level !== R3_TOUCH.level || touch.lock.x !== R3_TOUCH.lock.x
        || touch.lock.y !== R3_TOUCH.lock.y) {
        fail(`the touch names ${JSON.stringify(touch.lock)} in L${touch.level}, not `
            + `${JSON.stringify(R3_TOUCH.lock)} in L${R3_TOUCH.level}`);
    }
    const shieldLeg = route.collects.find((c) => c.item === R3_TOUCH.item)?.leg;
    if (!(shieldLeg < touch.leg)) {
        fail(`the ${R3_TOUCH.item} collect is on leg ${shieldLeg} and the touch on leg `
            + `${touch.leg}: ShieldLock.update gates on Player.${R3_TOUCH.shield}, so the `
            + 'shield has to come FIRST or the lock never activates');
    }

    // ── the clear list ────────────────────────────────────────────────
    if (!Array.isArray(route.persistence)) fail('no persistence list');
    const declared = R3_CLEARS.map((c) => `${c.level}:${c.tag}`).sort().join(' ');
    const onRoute = route.persistence.map((c) => `${c.level}:${c.tag}`).sort().join(' ');
    if (declared !== onRoute) {
        fail(`the route clears [${onRoute}] but R3_CLEARS declares [${declared}] — the `
            + 'named-exception list and the tape must be the same list');
    }
    const levels = new Set(route.legs.map((l) => l.level));
    for (const c of route.persistence) {
        if (!levels.has(c.level)) {
            fail(`the clear list names L${c.level} tag ${c.tag}, which the walk never `
                + 'enters — a crutch applied where nobody is looking');
        }
        if (!c.note) fail(`the clear for L${c.level} tag ${c.tag} names no blocker`);
    }
    // ⚠ AND THE EARNED ONE IS NOT ON IT. `L71 tag 2` is the flag the PLAYER
    // turns off; declaring it too would make the touch prove nothing.
    if (route.persistence.some((c) => c.level === R3_TOUCH.level && c.tag === R3_TOUCH.tag)) {
        fail(`the tape DECLARES L${R3_TOUCH.level} tag ${R3_TOUCH.tag}, which is the flag `
            + 'the touch earns. A declared clear despawns the lock before the walk '
            + 'reaches it, so the touch would open nothing and prove nothing.');
    }

    if (route.segment_boundaries.length !== R3_SEGMENT_BOUNDARIES.length) {
        fail(`${route.segment_boundaries.length} boundaries for `
            + `${R3_SEGMENT_BOUNDARIES.length} declared`);
    }
    let prev = 0;
    for (const b of route.segment_boundaries) {
        if (!Number.isInteger(b) || b <= prev || b >= route.legs.length) {
            fail(`boundary ${b} is not a strictly increasing leg index`);
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
 * headline.
 *
 * ⚠ A SEGMENT INHERITS ITS ITEMS AS A GRANT, AND THE HEADLINE DOES NOT.
 * That is not the crutch coming back: a segment is a SLICE of a longer
 * walk, and the items it starts holding were really collected in the
 * segments before it. The headline is the claim, and its `grants` is empty.
 * The inheritance is load-bearing rather than cosmetic — segment 6 opens
 * L71's shield lock, and `ShieldLock.update` gates on
 * `Player.hasDarkShield`, which segment 5 collected.
 *
 * ⚠ EVERY SEGMENT CARRIES THE WHOLE CLEAR LIST, not the subset its own
 * levels need. A clear is applied once before the first live tick and
 * `buildLevelWorld` hands a level only its OWN tags, so the list is inert
 * where it does not apply — and six different lists would be six different
 * experiments, which is exactly what the chain claim cannot survive.
 */
export function r3TapeSpecs(route) {
    assertRouteWellFormed(route);
    const clears = () => route.persistence.map((c) => ({ ...c }));
    // The boundary leg is SHARED: segment N ends by ARRIVING in it (its
    // exit stripped) and segment N+1 boots there and takes that exit.
    const bounds = [0, ...route.segment_boundaries, route.legs.length - 1];
    const common = {
        lattice: R3_LATTICE,
        nodeMargin: R3_NODE_MARGIN,
        triggerMargin: R3_TRIGGER_MARGIN,
        allowGrazes: true,
        maxTicksPerTarget: R3_MAX_TICKS_PER_WAYPOINT,
    };
    const specs = [];
    for (let s = 0; s < R3_SEGMENT_NAMES.length; s++) {
        const firstLeg = bounds[s];
        const lastLeg = bounds[s + 1];
        const legs = route.legs.slice(firstLeg, lastLeg + 1)
            .map((l, i) => (i === lastLeg - firstLeg
                ? { level: l.level, targets: [], ...(l.contacts ? { contacts: l.contacts } : {}) }
                : JSON.parse(JSON.stringify(l))));
        const boot = route.leg_boots[firstLeg];
        const inherited = route.collects.filter((c) => c.leg < firstLeg).map((c) => c.item);
        specs.push({
            name: R3_SEGMENT_NAMES[s],
            segment: s + 1,
            boot: { ...boot },
            legs,
            firstLeg,
            lastLeg,
            inherited,
            ...common,
            relax: {
                noclip: false,
                noDamage: true,
                noHazards: [...R3_NO_HAZARDS],
                grants: inherited.length > 0
                    ? [{ level: boot.level, items: [...inherited] }] : [],
                persistence: clears(),
            },
        });
    }
    specs.push({
        name: R3_FULL_WALK_NAME,
        segment: null,
        boot: { ...route.boot },
        legs: JSON.parse(JSON.stringify(route.legs)),
        firstLeg: 0,
        lastLeg: route.legs.length - 1,
        inherited: [],
        ...common,
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [...R3_NO_HAZARDS],
            // ⛔ EMPTY. The whole rung is this line.
            grants: [],
            persistence: clears(),
        },
    });
    return specs;
}
