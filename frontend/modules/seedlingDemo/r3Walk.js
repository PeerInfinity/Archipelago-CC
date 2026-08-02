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
 *   - **The clear list shrinks from 25 to 7**, and every survivor is a
 *     NAMED EXCEPTION with the rung that retires it.
 *
 * ⚠ AND THE HEADLINE IS SEVEN ITEMS, NOT ELEVEN. The rung's original brief
 * asked for eleven, and slice 0 found that three of the four extra ones are
 * not R3-shaped at source (kickoff §8.2): `conch`'s Karlore despawns on
 * `Player.hasFire`, not on being talked to; `wand` gates its whole pickup
 * on `hasAllTotemParts()`; `darksword`'s only source is the Witch, who
 * needs the wand. `health`'s two openers are both in enemy rooms. So the
 * claim is the SAME MAP WITH THE CRUTCHES OFF rather than more items — and
 * `darksword` LEAVES the claim, because R2 only had it by way of a grant
 * the game's own logic would have refused.
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
 * ⚠ THE ORDER IS LOAD-BEARING IN ONE PLACE. `darkshield` (L74) must precede
 * `darksuit` (L79), because the only way to L79 is L71's shield lock and
 * `ShieldLock.update` gates on `Player.hasDarkShield`. R2's order already
 * had it that way; here it is a requirement rather than a coincidence, and
 * the executor's `runTouch` refuses by name if it is ever violated.
 */
export const R3_ITEM_ROOMS = Object.freeze([
    Object.freeze({ level: 10, item: 'sword', pickup: Object.freeze({ x: 48, y: 48 }) }),
    Object.freeze({ level: 20, item: 'shield', pickup: Object.freeze({ x: 112, y: 48 }) }),
    Object.freeze({ level: 89, item: 'feather', pickup: Object.freeze({ x: 160, y: 96 }) }),
    Object.freeze({ level: 30, item: 'torch', pickup: Object.freeze({ x: 64, y: 64 }) }),
    Object.freeze({ level: 64, item: 'spear', pickup: Object.freeze({ x: 72, y: 24 }) }),
    Object.freeze({ level: 74, item: 'darkshield', pickup: Object.freeze({ x: 48, y: 32 }) }),
    Object.freeze({ level: 79, item: 'darksuit', pickup: Object.freeze({ x: 40, y: 152 }) }),
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
 * ⚠ SEVEN, NOT TWENTY-FIVE, AND NOT SEVEN BY NECESSITY EITHER. R2's list
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
 * ⚠ THREE OUTCOMES, NOT TWO. "Unreachable without the lock" is only
 * CIRCULAR if the room was reachable WITH it. L19 and L67 are unreachable
 * under every clear list, which is a different seal needing a different
 * name — calling it circular would send a later rung hunting a lock that is
 * not the problem.
 */
export const R3_CLEARS = Object.freeze([
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
