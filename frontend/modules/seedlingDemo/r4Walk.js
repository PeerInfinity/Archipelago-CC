/**
 * seedlingDemo/r4Walk — the R4 full walk: THE HAZARDS COME BACK, and with
 * them the one item three rungs said was sealed.
 *
 * Region-atlas Phase 8, subtractive ladder rung R4, slice 4-5. Brief:
 * `CC/docs/plans/seedling-bot-r4-opus-kickoff.md` §9 (the rulings), §11 (the
 * breach the route has to realize) and §13 (the mechanics, as built).
 *
 * Same division of labour as `r1Walk.js`, `r2Walk.js` and `r3Walk.js`: the
 * ROUTE is data, computed by `scripts/procgen/plan-seedling-r4-route.mjs`
 * and committed as `fixtures/r4-route.json`; this file holds the DECISIONS —
 * which items, in which order, which clears survive and why, which pushes,
 * where the walk breaks — plus the logic the tape generator and the tests
 * both need.
 *
 * ── What R4 is ────────────────────────────────────────────────────────
 * R3 walked with the crutches off and took six items through a map opened by
 * ten declared clears, with every hazard COERCED to plain floor. R4 keeps
 * every one of R3's retirements and arms the terrain:
 *
 *   - **`noHazards` is `["water", "waterfall"]`.** LAVA and ICE are LIVE.
 *     Ice costs nothing; lava is the one that bites, and it costs BOTH
 *     `darksuit` and `darkshield` — the R3 walk stood on lava for 1,392
 *     ticks across six levels, all of them before it held the suit. See
 *     `R4_NO_HAZARDS` for why waterfall could not be armed (the slice-0
 *     ruling that said it could is overturned there, by the route) and §8.2
 *     for why `noHazards: []` is not an R4 state at all.
 *   - **`health` JOINS it**, and that is the rung's headline. Three rungs
 *     called L68 sealed; §11's multi-push sweep found the breach and the
 *     game confirmed it to the pixel. It costs five spear presses across
 *     three levels, a boss key, and a lock that opens on it.
 *   - **`hitsMax == 4` is asserted as a POSITIVE.** R1, R2 and R3 all
 *     asserted 3 — a NEGATIVE, "no health was taken". This rung is the one
 *     that turns it over, and it is the only claim on the ladder whose
 *     truth value flips rather than its scope.
 *
 * ── ⛔ AND THE CLAIM IS FIVE, NOT SIX: `darkshield` LEFT TOO ───────────
 *
 * The rung was planned for six: R3's six with `darksuit` out and `health`
 * in. Armed lava makes that geometrically impossible, and the reason is not
 * a routing difficulty but a fact about the map:
 *
 * **THERE ARE TWO TERMINAL BRANCHES AND A WALK CAN ONLY END IN ONE.**
 *
 *   `darkshield` is in L74, inside `{71:0, 72, 73, 74, 75, 80}` — a
 *   strongly-connected set whose ONLY entrance is L71's button lock, and a
 *   `Lock` opened by standing on a button south of it can only be walked
 *   through NORTHWARD. R3 left that set two ways and armed lava closes
 *   both: the pit at (12,13) to L82 sits in L71's component 3, which no
 *   reachable component touches, and the east door to L76 leads to a
 *   L76 <-> L77 pair that stops at L78's lava. Swept: EVERY single clear the
 *   map offers for those eleven levels, one at a time, and all of them at
 *   once. NONE of them escapes.
 *
 *   `health` is in L68, behind L63 -> L65 -> L68, and that is one-way for a
 *   different reason. The walk enters L63 at component 1 and pushes the
 *   block east onto (8,6)'s pit, which destroys it and merges component 3
 *   in; on the way BACK it arrives from L65 INTO component 3 with the block
 *   rebuilt, and from there the only legal push is WEST — which lands on
 *   floor, opens nothing, and leaves the corridor plugged. The multi-push
 *   sweep says so at pitch 8, 4 and 2.
 *
 * So the rung chooses, and it chooses `health`: it is the rung's whole
 * subject, it is what three rungs called sealed, and `darkshield` is
 * already proved at R3 under a floor this rung is retiring. Five items with
 * `hitsMax == 4` is a smaller claim than six and a STRICTLY STRONGER one
 * than R3's, because every tile the walk crosses is one the game really
 * has.
 *
 * See `R4_BLOCKED` for `darkshield`'s entry, which carries the sweep.
 */

/** The build's baked-in spawn, which is also where the walk starts. */
export const R4_BOOT = Object.freeze({ level: 0, x: 80, y: 128 });

/**
 * ⛔ THE RUNG'S TERMINAL HAZARD STATE, and it is neither `[]` NOR `["water"]`.
 *
 * **WATER** — `canSwim` IS THE CONCH (`Bot.as:798`), which `Karlore.added()`
 * gates on `Player.hasFire` -> BobBoss -> R5. And `drownTimer` is never
 * reset off hazard — only set to 10 on first contact, decremented, and spun
 * by `drown()` — so the whole-run budget for un-swimmable water is ELEVEN
 * CUMULATIVE TICKS and then `die()`. Armed as forbidden floor it takes the
 * walk from 60 reachable nodes to 10. Ruled out at slice 0 (§8.2).
 *
 * **WATERFALL** — ⛔ AND THIS ONE THE SLICE-0 RULING GOT WRONG, in a way
 * only the route could find. §9 armed it on the strength of two true
 * sentences: `checkDrowning` tests `eff == 1` only, so a waterfall cannot
 * drown you; and the R3 walk really does STAND on one for 71 ticks. Both
 * hold. What neither of them says is that a waterfall cannot be CLIMBED:
 * `Player.input()`'s last act is
 *
 *     if (onWaterfall && (!hasFeather || v.y >= 0)) v.y += 0.8;
 *
 * and the water move speed is below 0.8. The shipped physics, asked
 * directly: a featherless player entering level 0's band from below and
 * holding UP for 400 ticks reaches **y = 125.98 and stalls** — fourteen
 * pixels short of clearing it. With the feather, y = 66.73.
 *
 * ⛔ AND LEVEL 0'S BAND IS THE ONLY CONNECTION between the half the game
 * BOOTS in and the half everything else is behind. A directed flood of L0
 * from the boot with climbs forbidden reaches 670 of 782 cells and NONE of
 * the north doors; deleting those doors from the whole-map graph leaves
 * **12 nodes across 11 levels and exactly one item, the sword.** The feather
 * — the item that exempts the push — is on the far side of the band that
 * needs it.
 *
 * So arming waterfall at R4 is circular in the same shape water is, one
 * item along: water needs the conch needs fire needs BobBoss; waterfall
 * needs the feather, and under THIS rung's clear bill the only path to the
 * feather crosses a waterfall. It retires at the rung that reaches L89
 * another way — L90 @48,96 and L91 @16,144 both open into it, and both are
 * behind openers R5 builds.
 *
 * **ICE** (22) costs nothing at all, floor policy included. **LAVA** (17) is
 * the one this rung arms, and it is the one that bites: `darksuit` and
 * `darkshield` both leave the claim for it.
 *
 * ⚠ The directed climb rule is BUILT and PINNED anyway
 * (`botDriverV2.climbsArmedWaterfall`), against level 0's own numbers. It
 * is inert here — coercion turns the tile back into floor before the rule
 * looks at it — and that is a bounded vacuity with a named witness rather
 * than dead code: the first walk that arms waterfall needs it on tick one,
 * and finding it then would mean finding it at slice 8.
 */
export const R4_NO_HAZARDS = Object.freeze(['water', 'waterfall']);

/**
 * The item rooms, IN VISIT ORDER.
 *
 * `tag` is the pickup's OWN persistence tag — what its `removed()` writes
 * false. The R4 ledger asserts the flags that are off at the end are
 * EXACTLY the declared clears, plus what the openers earned, plus these.
 *
 * ⚠ TWO ORDER CONSTRAINTS, and both are checked rather than hoped:
 *
 * 1. **`spear` (L64) must precede every press.** `Main.primary` selects into
 *    `Inventory.items`, and without the spear in it every X press is a SWORD
 *    SLASH — which fires no Tile arm, pushes no `PushableBlockSpear` through
 *    a wall, and reports success. `assertRouteWellFormed` refuses a route
 *    whose first spear leg is not after the spear collect.
 * 2. **The BOSS KEY must precede L68's bosslock**, and in the SAME SEGMENT.
 *    A segment inherits ITEMS through a boot-level grant; there is no
 *    inheritance channel for `Main.SAVE_FILE.data.hasKey`, deliberately —
 *    adding one would need its own AS3 side for a fact one segment boundary
 *    can simply avoid straddling.
 *
 * ⚠ AND `health` IS LAST BY NECESSITY, not by taste. L63 -> L65 -> L68 is a
 * ONE-WAY trip (see the header): the return into L63 lands on the far side
 * of a block the level rebuilt, and no push from that side opens anything.
 * A route that collected health in the middle would be a route that never
 * finished.
 */
export const R4_ITEM_ROOMS = Object.freeze([
    Object.freeze({ level: 10, item: 'sword', tag: 0, pickup: Object.freeze({ x: 48, y: 48 }) }),
    Object.freeze({
        level: 89, item: 'feather', tag: 0, pickup: Object.freeze({ x: 160, y: 96 }),
    }),
    Object.freeze({ level: 30, item: 'torch', tag: 4, pickup: Object.freeze({ x: 64, y: 64 }) }),
    Object.freeze({ level: 64, item: 'spear', tag: 1, pickup: Object.freeze({ x: 72, y: 24 }) }),
    Object.freeze({
        level: 68, item: 'health', tag: 2, pickup: Object.freeze({ x: 16, y: 16 }),
    }),
]);

/**
 * The SEVENTH pickup, which is not an item.
 *
 * `BossKey.removed()` is `Player.hasKeySet(keyType, true)` and nothing else
 * — it does not call `super.removed()`, so unlike every other pickup on the
 * ladder it writes NO persistence. That absence is load-bearing for the
 * ledger: SIX pickups are taken and FIVE flags go off.
 *
 * Its `text` is set only under `if (keyType == 0)` (`BossKey.as:24-27`), so
 * this one — keyType 4, the only reachable placement — inherits
 * `Pickup.text = ""` and self-resolves after 150 frozen frames with no
 * dialogue at all.
 */
export const R4_KEY_PICKUP = Object.freeze({
    level: 67,
    item: 'bosskey',
    keyType: 4,
    pickup: Object.freeze({ x: 48, y: 64 }),
    opens: "L68's bosslock@16,32, which seals health@16,16",
});

/**
 * ⛔ THE PUSH CHAINS — §11's breach, as the route realizes it.
 *
 * Every entry here is a stance the multi-push sweep
 * (`scripts/procgen/recon-seedling-pushes.mjs`) found at the PLANNER'S OWN
 * PITCH and the game then confirmed. They are DECLARED rather than searched
 * for at plan time because the search is an instrument and this is the
 * artifact: the planner's job is to confirm that each stance is standable,
 * reachable from the one before it, and that the chain opens what it claims.
 *
 * ⚠ A CHAIN IS PER VISIT. `PushableBlockFire` holds its position in an
 * instance variable with no persistence, so leaving the level and coming
 * back rebuilds every block in its corridor. Nothing here is banked.
 *
 * ⚠ AND `to: null` MEANS DESTROYED. A block that comes to rest on water,
 * lava or a pit destroys itself (`PushableBlockFire.input()`), which is
 * irreversible within the visit and is also what makes three of these five
 * pushes openers at all: a push into a pit is a REMOVAL, which is the one
 * sentence §8.5 got wrong.
 *
 * The `facing` names `Player.direction`, and the approach has to END moving
 * that way — `set spearing` captures `spearDirection = direction` and
 * `sprites()` derives it from VELOCITY, so a stance reached by a final
 * correction on the other axis faces the wrong way. Each stance therefore
 * carries a `from`: an axis-aligned setup point the leg drives to first, so
 * the last leg of the approach is purely along the push axis.
 */
export const R4_PUSH_CHAINS = Object.freeze([
    Object.freeze({
        level: 67,
        block: Object.freeze({ x: 144, y: 112 }),
        opens: 'bosskey@48,64 — the keyType-4 key',
        entry: 'L59 @224,112 (arrival 208,112)',
        pushes: Object.freeze([
            Object.freeze({
                at: Object.freeze({ x: 180, y: 116 }),
                from: Object.freeze({ x: 188, y: 116 }),
                facing: 'W',
                to: null,
                note: 'reach 2 across the pit at (10,7), landing on (8,7)\'s pit: '
                    + 'destroyed. 60 px². ⚠ A RE-AIM, NOT A SEAL: `lightpole@160,104`\'s '
                    + 'press box ends at y 112, so only a stance at y = 112 clips it and '
                    + 'y >= 115.5 is clean',
            }),
        ]),
    }),
    Object.freeze({
        level: 63,
        block: Object.freeze({ x: 112, y: 96 }),
        opens: 'the L65 door @128,304 — the entry L65\'s own chain needs',
        entry: 'L61 @0,96 (arrival 16,96)',
        pushes: Object.freeze([
            Object.freeze({
                at: Object.freeze({ x: 100, y: 100 }),
                from: Object.freeze({ x: 84, y: 100 }),
                facing: 'E',
                to: null,
                note: 'block (7,6) -> (8,6), a PIT: destroyed. 80 px² of rect on it, '
                    + 'the widest of the ten legal stances',
            }),
        ]),
    }),
    Object.freeze({
        level: 65,
        block: Object.freeze({ x: 176, y: 128 }),
        opens: "the L68 door @184,64 — health's own room",
        entry: 'L63 @128,304 (arrival 128,16)',
        pushes: Object.freeze([
            Object.freeze({
                at: Object.freeze({ x: 196, y: 132 }),
                from: Object.freeze({ x: 204, y: 132 }),
                facing: 'W',
                to: Object.freeze({ tx: 10, ty: 8 }),
                note: 'reach 1. 80 px² on the block — the same as the sweep\'s own '
                    + '(204,132), and a tile west of it BECAUSE THE SETUP HAS TO FIT. '
                    + 'The standable band at y = 132 stops at x = 204: (13,8) is a pit '
                    + 'and the node margin reaches it from 205. A W push is approached '
                    + 'from the EAST, so a stance at the east edge of the band has '
                    + 'nowhere to be approached from',
            }),
            Object.freeze({
                at: Object.freeze({ x: 164, y: 164 }),
                from: Object.freeze({ x: 164, y: 170 }),
                facing: 'N',
                to: Object.freeze({ tx: 10, ty: 7 }),
                note: 'reach 2 ACROSS the pit at (10,9). UP is the one arm of '
                    + '`spearRect` carrying the asymmetric `+ 1`, and no recording had '
                    + 'ever exercised it before the breach pair. 50 px². ⚠ THE SETUP IS '
                    + 'SIX PIXELS SOUTH and that is the whole band: (10,11) is a pit and '
                    + 'the node margin reaches it from y = 171. Six pixels is enough to '
                    + 'establish a northward velocity and nothing more — which is all '
                    + '`sprites()` needs, since `direction` sticks at rest',
            }),
            Object.freeze({
                at: Object.freeze({ x: 196, y: 116 }),
                from: Object.freeze({ x: 204, y: 116 }),
                facing: 'W',
                to: null,
                note: 'reach 2 THROUGH the Body Wall at (11,7), landing on (9,7)\'s pit: '
                    + 'destroyed. 60 px². ⚠ THIS IS THE STANCE THAT SEALS THE POLE — see '
                    + 'R4_EARNED',
            }),
        ]),
    }),
]);

/**
 * The ONE lock R4 opens with a key.
 *
 * `bosslock@16,32` (keyType 4, tag 0) and `magicallock@16,32` share a cell,
 * and together they seal `health@16,16` from the only door into L68. The
 * magical lock needs a wand shot and stays a DECLARED clear (R5); the boss
 * lock is EARNED.
 *
 * ⚠ THE STANCE IS A PIXEL, NOT A NODE. The probe row is at y = 49 and the
 * player box is `[y-2, y+3)`, so containing it needs `46 < y <= 51`; staying
 * out of the lock's own `[32,48)` needs `y >= 50`. The pitch-8 lattice
 * offers 44 (inside the lock) and 52 (below the row) and nothing between —
 * so the leg aims at the pin against the lock's south face, and the WALL is
 * what stops it. A route that aimed at a node centre would stand there for
 * eighty ticks and open nothing.
 */
export const R4_KEY_LOCK = Object.freeze({
    level: 68,
    lock: Object.freeze({ x: 16, y: 32 }),
    tag: 0,
    keyType: 4,
    at: Object.freeze({ x: 24, y: 50 }),
    from: Object.freeze({ x: 24, y: 66 }),
    window: 80,
    opens: 'health@16,16, which is the only thing behind it',
});

/**
 * ⚠ THE CLEARS THE PLAYER EARNS — asserted, never declared.
 *
 * Two of them, and they are two different mechanics writing one namespace:
 *
 *   `{68, 0}`   `BossLock`'s fade completing, 80 ticks after the key stance
 *   `{65, 2}`   `lightpole@176,120`, TOGGLED by the third L65 push
 *
 * ⛔ THE POLE IS NOT A CHOICE. The spear rect for that push necessarily
 * contains it: the block sits at tile (10,7) (x 176..192) and the pole's
 * press box is x [179,189) over the SAME rows, so any rect that reaches the
 * block's column from the east spans the pole's, and any rect whose y band
 * meets the block's meets the pole's. A sword cannot substitute — the push
 * needs reach 2 through a solid, which only the spear has. Ruled MODELLED
 * (kickoff §13.5) rather than refused, so the bill gains an EARNED entry
 * instead of a declared one.
 *
 * ⚠ AND THE POLE ENTRY IS DERIVED FROM THE FINAL STATE, never from a count
 * of hits. `LightPole.hit()` TOGGLES behind a 25-tick `hitsTimer`, so an
 * even number of presses leaves the flag exactly as it started — an
 * accounting that counted presses would report a clear the game does not
 * have. The route presses it once; the ledger asks the run.
 */
export const R4_EARNED = Object.freeze([
    Object.freeze({
        level: 68, tag: 0, by: 'bosslock@16,32',
        why: 'the keyType-4 BossKey from L67, held on its probe row for 80 ticks',
    }),
    Object.freeze({
        level: 65, tag: 2, by: 'lightpole@176,120',
        why: "the third L65 push's rect cannot avoid it — geometrically, at every "
            + 'stance in the row. `set activate` writes `setPersistence(tag, !activate)`',
    }),
]);

/**
 * The clears that SURVIVE, each with the ONE opener it is waiting for and
 * the rung that retires it.
 *
 * ⚠ EIGHT, DOWN FROM R3'S TEN — and the movement is in BOTH directions, which
 * is why the list is re-derived rather than inherited. Armed lava is a
 * different map, so R3's bill is a fact about a level set this walk does not
 * cross:
 *
 *   OFF (3)   `L12 tag 7`, `L12 tag 12`  the route no longer threads either
 *                                        corridor
 *             `L71 tag 0`                the walk never enters L71 at all
 *   ON  (1)   `L68 tag 1`                the magical lock sharing a cell
 *                                        with the boss lock the walk opens
 *
 * ⚠ `L12 tag 12` coming off is worth reading twice: it is a keyType-4
 * bosslock, and from L67 onward the walk is CARRYING that key. It is not
 * declared and not earned — the route simply has no errand at (32,864), and
 * its probe row is an avoid volume the planner now routes around precisely
 * because the walk holds the key. An earlier draft priced that volume
 * unconditionally and moved three rungs of committed routes; see
 * `levelWorld`'s `keyType` note.
 *
 * ⚠ AND A ONE-OUT SWEEP IS NOT THE BILL. Removing clears one at a time can
 * report "not required" for two clears in a doorway wide enough for either,
 * and then both come off and the door shuts. The sweep
 * (`R4_DROP_CLEAR=<i>` on the planner) is the SCREEN; the committed list is
 * what the planner confirms with every survivor in place, at the pickup's
 * own tile with the driver's own clearances.
 *
 * ⚠⚠ AND THE SWEEP LIED THREE TIMES, exactly as R3's did — twice because it
 * asks a REACHABILITY GRAPH and the claim is a WALK (`L3 tag 0`, where the
 * driver's A* finds no path at any clearance; `L11 tag 0`, where the
 * CONTROLLER's overshoot clips a chest), and once for a reason of its own: It reported `L68 tag 1`
 * NOT REQUIRED, because the health approach inside a level the walk itself
 * changed is computed by a helper that asks "is there a standable cell
 * beside the pickup" rather than "can the stance walk to it". The planner
 * asks the second question explicitly now, and it is the difference between
 * opening one of two locks and opening both.
 */
export const R4_CLEARS = Object.freeze([
    Object.freeze({
        level: 3, tag: 0, note: 'breakablerock@96,112',
        opener: 'a sword swing (Player.as:1098 genericHit)',
        why: '⚠ THE SHIPPED PLANNER PUT THIS ONE BACK, for the second rung running, and '
            + 'the one-out sweep could not have: the sweep asks a REACHABILITY GRAPH, '
            + 'whose flood is 4-connected lattice cells, and with the rock standing the '
            + "DRIVER's own A* finds no walkable path across L3 at any clearance it "
            + 'will descend to. A reachability graph and a walk are different questions. '
            + '⚠ NEARER THAN IT LOOKS NOW: R4 has the press primitive and a '
            + '`BreakableRock` arm would be one more entry in `PRESS_ARM_POLICY`. What '
            + 'it still needs is a swing at a stance in an enemy-free room, which is '
            + "R5's combat budget rather than this rung's",
        rung: 'R5',
    }),
    Object.freeze({
        level: 11, tag: 0, note: 'chest@32,48',
        opener: 'walking under it (Chest.update collides a 1-px line beneath)',
        why: 'ALSO THE DRIVER\'S, and not an opener question at all: the chest is a '
            + 'Solid AND an avoid volume in a corridor the walk has to thread, and the '
            + "CONTROLLER's overshoot clips it — which the graph cannot see either. "
            + 'Opening one spawns a SealPiece (150 frozen frames), writes persistence, '
            + 'and burns an UNBOUNDED number of Math.random() draws for the seal index, '
            + 'so the RNG stream shifts by an amount that depends on saved state',
        rung: 'R5',
    }),
    Object.freeze({
        level: 12, tag: 3, note: 'bosslock@80,656',
        opener: 'BossKey (keyType 1) in L29',
        why: 'CIRCULAR — L29 is reachable only through a bosslock clear. ⚠ The key '
            + 'MECHANIC is no longer the obstacle: R4 opens a bosslock by hand. What '
            + 'seals this one is that its key is behind a lock of its own colour',
        rung: 'R5',
    }),
    Object.freeze({
        level: 12, tag: 5, note: 'bosslock@432,240',
        opener: 'BossKey (keyType 0) in L19',
        why: 'L19 is unreachable under EVERY clear list — L19 is Dungeon2_Boss and '
            + 'shieldboss@80,32 means the census cannot build the level at all. A '
            + 'different seal from a circular one',
        rung: 'R5',
    }),
    Object.freeze({
        level: 24, tag: 0, note: 'burnabletree@32,128',
        opener: 'fire',
        why: 'fire is dropped by BobBoss — combat-gated by construction',
        rung: 'R5',
    }),
    Object.freeze({
        level: 30, tag: 0, note: 'bosslock@64,32',
        opener: 'a BossKey (keyType 1)',
        why: 'the ONE thing that unseals the torch\'s own tile, checked one at a time '
            + 'over every clear the map offers. Its key is L29\'s, behind L12 tag 3 — '
            + 'so this and that entry retire together or not at all',
        rung: 'R5',
    }),
    Object.freeze({
        level: 60, tag: 0, note: 'lock@128,80',
        opener: 'totalEnemies() == 0',
        why: 'a tSet == -1 kill-lock, ruled a named exception at R3 slice 0',
        rung: 'R5',
    }),
    Object.freeze({
        level: 68, tag: 1, note: 'magicallock@16,32',
        opener: 'a wand shot (WandShot.checkEntity -> MagicalLock.hit)',
        why: '⚠ THE ONE ENTRY R4 ADDS, and it is the price of the item the rung is '
            + 'for. It shares a cell with `bosslock@16,32`, which the walk opens with '
            + 'the key it earned — so of the two locks sealing health, one is now '
            + 'earned and one is still declared. `MagicalLock extends Entity`, not '
            + '`Activators`: it has no tSet, no button and no touch, and its only '
            + 'opener in the whole extract is a wand shot',
        rung: 'R5',
    }),
]);

/**
 * The items that are NOT on the claim, each with the ONE thing that seals it
 * at SOURCE — not "the route could not get there", which is a claim about a
 * map, but "the game refuses", which is a claim about the game.
 *
 * ⚠ AND THE RUNGS CHAIN. `water` needs the conch, the conch needs fire, fire
 * needs BobBoss — so one combat encounter retires three entries at once, and
 * a reader who does not see that would price them separately.
 */
export const R4_BLOCKED = Object.freeze([
    Object.freeze({
        item: 'darkshield',
        seal: '⛔ NOT SEALED AT SOURCE — SEALED BY THE CHOICE THIS RUNG HAD TO MAKE, and '
            + 'it is the one entry on this list that is about a WALK rather than about '
            + 'the game. Armed lava leaves the map with TWO TERMINAL BRANCHES and a walk '
            + 'can only end in one. `darkshield` (L74) sits inside '
            + '{71:0, 72, 73, 74, 75, 80} — strongly connected, entered ONLY through '
            + "L71's button lock, which a player can only walk NORTHWARD through "
            + '(the button is south of it and there is none on the far side). R3 left '
            + 'that set two ways and both are gone: the pit at (12,13) to L82 sits in '
            + "L71's component 3, which no reachable component touches, and the east "
            + 'door — reachable, since the walk would be holding the shield that opens '
            + 'its lock — leads to an L76 <-> L77 pair that stops at L78\'s lava. '
            + 'Swept: every single clear the map offers for those eleven levels, one at '
            + 'a time and all at once. NONE escapes. `health` (L68) is terminal for its '
            + 'own reason (the L63 return lands on the far side of a rebuilt block), so '
            + 'the two are mutually exclusive and the rung takes the one it is FOR. '
            + '⚠ Retiring this needs no new item: it needs an exit from that cluster, '
            + 'which is `darksuit` (L79, through L78\'s lava) — so this entry and the '
            + 'next one retire together.',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'darksuit',
        seal: '⚠ THE ONE THIS RUNG GAVE UP, and it is armed lava that took it. The R3 '
            + 'walk stood on lava for 1,392 ticks across L71/74/75/76/77/78, all of '
            + 'them BEFORE it collected the suit (t = 11171; darkshield t = 9692) — so '
            + 'the route that reached it was a route only the coercion allowed. Armed, '
            + 'lava seals L78, L79 and L82: a real wall in L80 rows 6-11 plus '
            + '`lavatrap`/`lavarunner` discs astride the dry corridors of L77 and L78. '
            + 'L79 holds the suit.',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'shield',
        seal: "L20's shield@112,48 is in the level's OTHER component. The walk arrives "
            + 'from L13 into a 2x4 shaft sealed by lock@32,80 (tset 0, so no clear '
            + 'despawns it), whose only presser buttonroom@192,16 is adjacent to NO '
            + 'walkable component at all — it is walled in behind shieldlocknorm@176,16, '
            + 'which needs Player.hasShield. The other entrance is L19\'s stairs, and '
            + 'L19 is Dungeon2_Boss: shieldboss@80,32 means the census cannot build the '
            + 'level. NO clear list on the map unseals it.',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'conch',
        seal: 'Karlore.added() removes him ONLY on Player.hasFire; doneTalking() calls '
            + 'unlockMedal and nothing else, and his tag is -1 so no clear reaches him. '
            + 'Talking does NOT despawn him. ⚠ AND THE CONCH IS WATER: `canSwim` is '
            + 'this item, so `noHazards: []` — the state that would retire the last '
            + 'coercion on the ladder — is gated on it, and therefore on fire, and '
            + 'therefore on BobBoss.',
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
            + 'exists anywhere in the extract — she is its only source.',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'fire',
        seal: 'dropped by BobBoss on death — combat-gated by construction, and the '
            + 'root of the chain conch and water hang off',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'ghostsword',
        seal: 'L45\'s ghostsword sits behind Dungeon 4; and modelling the press at all '
            + 'would need `genericHit`\'s ghost arm, which routes a SLASH through the '
            + 'Spear branch and doubles the rect height from the sprite WIDTH — '
            + '`levelRun.applyThrust` refuses it by name rather than approximating',
        rung: 'R5',
    }),
    Object.freeze({
        item: 'firewand',
        seal: 'the wand plus fire, so it inherits both seals at once',
        rung: 'R5',
    }),
]);

/**
 * ⛔ `hitsMax` IS THE POSITIVE NOW, and this constant is where three rungs
 * turn over.
 *
 * `Player.hitsMaxDef` is 3 and `health` is the ONLY thing in the game that
 * adds to it (`HealthPickup.removed()`: `Player.hitsMax++`). R1, R2 and R3
 * all asserted 3 — a claim proved by a NEGATIVE, "the walk did not enter
 * that room". R4 asserts 4, which means exactly one grant of it: 3 would say
 * the collection silently failed and 5 would say something granted it twice.
 *
 * ⚠ It is checked ON ITS OWN rather than folded into the four booleans,
 * because `health` has no boolean — `ITEM_PROPERTIES.health` is
 * `{kind: 'add'}`, so a run that lost `hasSword` and gained health would
 * satisfy any check that summed them.
 */
export const R4_HITS_MAX = 4;
export const R4_HITS_MAX_BASE = 3;

/** Every item the walk ends holding, in collection order. */
export function r4AllItems() {
    return R4_ITEM_ROOMS.map((r) => r.item);
}

/** The A* cell pitch, the clearances and the budget — all carried from R3. */
export const R4_LATTICE = 8;
export const R4_NODE_MARGIN = 2;
export const R4_TRIGGER_MARGIN = 4;
export const R4_MAX_TICKS_PER_WAYPOINT = 1500;

/**
 * The `Inventory.items` slot the walk selects, and the item it selects.
 *
 * ⚠ A SLOT IS A POSITION IN AN ARRAY THE RUN BUILDS, not an item id.
 * `addItemsFromSave` pushes sword, then fire, then wand, then spear — so
 * under sword+spear the array is `[0, 3]` and the spear is slot **1**. The
 * game confirmed exactly that on the real build (`primary: 1`,
 * `inventory_slots: [0, 3]`).
 *
 * ⚠ AND THE SLOT IS ASSERTED, NOT ASSUMED: `levelRun.equipNow` throws on an
 * over-range slot, because `Inventory.getItem` on a missing slot returns
 * `undefined` which `useItem`'s int coercion turns into 0 — the sword. An
 * over-range equip is a SILENT downgrade from a thrust to a slash, and it
 * surfaces two thousand ticks later against a bridge nobody was looking at.
 */
export const R4_EQUIP_SLOT = 1;
export const R4_EQUIP_ITEM = 'spear';

/**
 * Where the walk breaks, as `[level, occurrence]` — "the Nth leg in level
 * L" — rather than as raw leg indices.
 *
 * A raw index would silently point somewhere else the first time the route
 * shifts by a leg; naming the arrival makes a route change a LOUD failure in
 * the planner instead of tapes that quietly no longer chain.
 *
 * ⚠ AND THE BOUNDARIES ARE CHOSEN SO A RE-ROUTE TOUCHES THE FEWEST TAPES,
 * with one constraint the earlier rungs did not have: **the key and the lock
 * it opens must be in the SAME segment.** A segment inherits ITEMS through a
 * boot-level grant and there is no channel for
 * `Main.SAVE_FILE.data.hasKey` — so a boundary between L67 and L68 would
 * produce a final segment that stands on the probe row holding nothing and
 * reports success for eighty ticks. `assertRouteWellFormed` refuses it.
 */
export const R4_SEGMENT_BOUNDARIES = Object.freeze([
    Object.freeze([0, 2]),     // 1 ends: sword collected, back in L0
    Object.freeze([12, 1]),    // 2 ends: the feather round trip, at the Witch
    Object.freeze([12, 2]),    // 3 ends: the torch, back at the Witch
    Object.freeze([61, 1]),    // 4 ends: the trek south-east, at L61
    // ⚠ 5 ends where the KEY CHAIN begins, and this boundary is the one with
    // a rule behind it. Everything from here to the end — the L67 push, the
    // textless key ceremony, L63's push, L65's three, the boss lock and
    // health — is ONE segment, because a key is not inheritable through a
    // boot grant. A boundary anywhere inside it produces a final segment
    // that stands on the probe row holding nothing and reports success for
    // eighty ticks.
    Object.freeze([59, 2]),    // 5 ends: the spear + the EQUIP, back at L59
]);

/** Segment tape names, and the headline. `--only=` takes these. */
export const R4_SEGMENT_NAMES = Object.freeze([
    'r4-walk-1-sword',
    'r4-walk-2-feather',
    'r4-walk-3-torch',
    'r4-walk-4-approach',
    'r4-walk-5-spear',
    'r4-walk-6-health',
]);
export const R4_FULL_WALK_NAME = 'r4-walk-full';

const listsMatch = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Validate a committed route against the decisions above.
 *
 * Loud rather than trusting: the route is generated, and a generated
 * artifact that has drifted from the intent it was generated for is exactly
 * the thing a committed file cannot tell you on its own.
 */
export function assertRouteWellFormed(route) {
    const fail = (m) => { throw new Error(`r4-route.json: ${m}`); };
    if (!route || !Array.isArray(route.legs) || route.legs.length === 0) fail('no legs');
    if (!listsMatch(route.boot, { ...R4_BOOT })) {
        fail(`boot ${JSON.stringify(route.boot)} is not the R4 boot`);
    }
    if (!listsMatch(route.noHazards, [...R4_NO_HAZARDS])) {
        fail(`noHazards is ${JSON.stringify(route.noHazards)} and R4's terminal hazard `
            + `state is ${JSON.stringify([...R4_NO_HAZARDS])}. \`[]\` is NOT an R4 state: `
            + '`canSwim` is the conch, which is gated on fire, which is BobBoss.');
    }
    if (route.legs[0].level !== R4_BOOT.level) fail('the first leg is not the boot level');
    if (route.legs[route.legs.length - 1].exit) fail('the last leg declares an exit');
    if (route.leg_boots.length !== route.legs.length) fail('leg_boots length mismatch');
    route.legs.forEach((leg, i) => {
        if (route.leg_boots[i].level !== leg.level) {
            fail(`leg ${i} is in L${leg.level} but its boot names `
                + `L${route.leg_boots[i].level}`);
        }
    });

    // ⚠ THE LEDGER, AT THE ROUTE LEVEL. `grants` EMPTY is carried from R3
    // and it is still the sentence every claim below rests on.
    if (!Array.isArray(route.grants) || route.grants.length > 0) {
        fail(`grants is ${JSON.stringify(route.grants)} — the R4 headline grants `
            + 'NOTHING; every item is collected by the player');
    }
    const collected = (route.collects ?? []).filter((c) => c.item !== 'bosskey')
        .map((c) => c.item);
    if (!listsMatch(collected, r4AllItems())) {
        fail(`collects [${collected.join(' ')}] are not the R4 item order `
            + `[${r4AllItems().join(' ')}]`);
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
    route.legs.forEach((leg, i) => {
        for (const t of leg.targets ?? []) {
            if (t.collect && !route.collects.some((c) => c.leg === i)) {
                fail(`leg ${i} collects ${JSON.stringify(t.collect.pickup)} but the `
                    + "route's collects list does not record it");
            }
        }
    });

    // ── the key pickup, and the ORDER two mechanics depend on ─────────
    const key = (route.collects ?? []).find((c) => c.item === 'bosskey');
    if (!key) {
        fail(`no bosskey collect — L68's bosslock gates on `
            + `\`Player.hasKey(${R4_KEY_PICKUP.keyType})\` and nothing else writes it`);
    }
    if (key.level !== R4_KEY_PICKUP.level) {
        fail(`the bosskey collect is in L${key.level}, not L${R4_KEY_PICKUP.level}`);
    }

    // ⚠ THE EQUIP ORDER, ASSERTED. Without the spear in `Inventory.items`
    // every press is a SWORD SLASH: the Tile arm never runs, the reach-2
    // through-a-wall push never happens, and the tape is green and opens
    // nothing.
    if (!Array.isArray(route.equips) || route.equips.length !== 1) {
        fail(`${route.equips?.length} equips — the R4 headline selects exactly one slot`);
    }
    const equip = route.equips[0];
    if (equip.slot !== R4_EQUIP_SLOT) {
        fail(`the equip selects slot ${equip.slot}, not ${R4_EQUIP_SLOT}. Under `
            + `sword+spear \`addItemsFromSave\` builds [0, 3], so the ${R4_EQUIP_ITEM} `
            + 'is slot 1 — and an over-range slot is a silent downgrade to a slash.');
    }
    const spearCollect = route.collects.find((c) => c.item === R4_EQUIP_ITEM);
    if (!(spearCollect.leg < equip.leg
        || (spearCollect.leg === equip.leg && spearCollect.index < equip.index))) {
        fail(`the ${R4_EQUIP_ITEM} is collected on leg ${spearCollect.leg} and selected `
            + `on leg ${equip.leg}: the selection has to come SECOND or the slot does `
            + 'not exist yet');
    }
    for (const s of route.spears ?? []) {
        if (!(equip.leg < s.leg || (equip.leg === s.leg && equip.index < s.index))) {
            fail(`a spear press on leg ${s.leg} comes before the equip on leg `
                + `${equip.leg}: without the slot selected it is a SWORD SLASH, which `
                + 'fires no Tile arm and pushes no PushableBlockSpear through a wall');
        }
    }

    // ── the pushes ────────────────────────────────────────────────────
    const declaredPushes = R4_PUSH_CHAINS
        .flatMap((c) => c.pushes.map((p) => `${c.level}:${p.at.x},${p.at.y}:${p.facing}`));
    const routePushes = (route.spears ?? [])
        .map((s) => `${s.level}:${s.at.x},${s.at.y}:${s.facing}`);
    if (!listsMatch(routePushes, declaredPushes)) {
        fail(`the route's spear stances [${routePushes.join(' ')}] are not the declared `
            + `chains [${declaredPushes.join(' ')}]`);
    }

    // ── the keylock ───────────────────────────────────────────────────
    if (!Array.isArray(route.keylocks) || route.keylocks.length !== 1) {
        fail(`${route.keylocks?.length} keylocks — R4 opens exactly one by key`);
    }
    const kl = route.keylocks[0];
    if (kl.level !== R4_KEY_LOCK.level || kl.lock.x !== R4_KEY_LOCK.lock.x
        || kl.lock.y !== R4_KEY_LOCK.lock.y) {
        fail(`the keylock names ${JSON.stringify(kl.lock)} in L${kl.level}, not `
            + `${JSON.stringify(R4_KEY_LOCK.lock)} in L${R4_KEY_LOCK.level}`);
    }
    if (!(key.leg < kl.leg)) {
        fail(`the bosskey is collected on leg ${key.leg} and the lock opened on leg `
            + `${kl.leg}: \`BossLock.update\` gates on \`Player.hasKey\`, so the key has `
            + 'to come FIRST or the walk stands on the row for eighty ticks and opens '
            + 'nothing');
    }
    const healthCollect = route.collects.find((c) => c.item === 'health');
    if (!(kl.leg < healthCollect.leg
        || (kl.leg === healthCollect.leg && kl.index < healthCollect.index))) {
        fail(`the keylock is on leg ${kl.leg} and health's collect on leg `
            + `${healthCollect.leg}: the lock and the magicallock share a cell and are `
            + 'the only thing between the L68 door and the pickup');
    }

    // ── the clear list ────────────────────────────────────────────────
    if (!Array.isArray(route.persistence)) fail('no persistence list');
    const declared = R4_CLEARS.map((c) => `${c.level}:${c.tag}`).sort().join(' ');
    const onRoute = route.persistence.map((c) => `${c.level}:${c.tag}`).sort().join(' ');
    if (declared !== onRoute) {
        fail(`the route clears [${onRoute}] but R4_CLEARS declares [${declared}] — the `
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
    // ⚠ AND THE EARNED ONES ARE NOT ON IT. Declaring `{68, 0}` would despawn
    // the boss lock before the walk reaches it, so the key would open nothing
    // and prove nothing; declaring `{65, 2}` would hide the pole toggle the
    // push cannot avoid, which is the opposite of what the ledger is for.
    for (const e of R4_EARNED) {
        if (route.persistence.some((c) => c.level === e.level && c.tag === e.tag)) {
            fail(`the tape DECLARES L${e.level} tag ${e.tag}, which is a flag the walk `
                + `EARNS (${e.by}). A declared clear proves nothing.`);
        }
    }

    // ── the segments ──────────────────────────────────────────────────
    if (route.segment_boundaries.length !== R4_SEGMENT_BOUNDARIES.length) {
        fail(`${route.segment_boundaries.length} boundaries for `
            + `${R4_SEGMENT_BOUNDARIES.length} declared`);
    }
    let prev = 0;
    for (const b of route.segment_boundaries) {
        if (!Number.isInteger(b) || b <= prev || b >= route.legs.length) {
            fail(`boundary ${b} is not a strictly increasing leg index`);
        }
        prev = b;
    }
    // ⛔ THE KEY AND ITS LOCK IN ONE SEGMENT. A segment inherits ITEMS
    // through a boot-level grant; `Main.SAVE_FILE.data.hasKey` has no such
    // channel, so a boundary between them produces a final segment that
    // stands on the probe row holding nothing.
    const segmentOf = (leg) => route.segment_boundaries
        .filter((b) => b < leg).length;
    if (segmentOf(key.leg) !== segmentOf(kl.leg)) {
        fail(`the bosskey is collected in segment ${segmentOf(key.leg) + 1} and its lock `
            + `opened in segment ${segmentOf(kl.leg) + 1}. A key is NOT inheritable `
            + 'through a boot grant, so the two must not straddle a boundary — move the '
            + 'boundary, or add a key-inheritance channel with its own AS3 side.');
    }
    return route;
}

/** The first leg index that enters `level`. */
export function routeFirstEntry(route, level) {
    return route.legs.findIndex((l) => l.level === level);
}

/**
 * The tape specs the driver synthesizes from: six segments and the headline.
 *
 * ⚠ A SEGMENT INHERITS ITS ITEMS AS A GRANT, AND THE HEADLINE DOES NOT.
 * Carried from R3 unchanged, and R4 adds the equip to the same argument: a
 * segment that boots holding the spear also boots with it SELECTED
 * (`equips: [{t: 0, slot: 1}]`), because the selection was really made in an
 * earlier segment. The headline's `equips` is what the `equip` leg verb
 * MEASURED, which is the same fact arrived at honestly.
 *
 * ⚠ AND A SEGMENT CANNOT INHERIT THE KEY. There is no grant channel for
 * `Main.SAVE_FILE.data.hasKey`, which is why `assertRouteWellFormed` refuses
 * a boundary between the key and its lock rather than this function papering
 * over it.
 *
 * ⚠ EVERY SEGMENT CARRIES THE WHOLE CLEAR LIST, not the subset its own
 * levels need. A clear is applied once before the first live tick and
 * `buildLevelWorld` hands a level only its OWN tags, so the list is inert
 * where it does not apply — and six different lists would be six different
 * experiments, which is exactly what the chain claim cannot survive.
 */
export function r4TapeSpecs(route) {
    assertRouteWellFormed(route);
    const clears = () => route.persistence.map((c) => ({ ...c }));
    // The boundary leg is SHARED: segment N ends by ARRIVING in it (its exit
    // stripped) and segment N+1 boots there and takes that exit.
    const bounds = [0, ...route.segment_boundaries, route.legs.length - 1];
    const common = {
        lattice: R4_LATTICE,
        nodeMargin: R4_NODE_MARGIN,
        triggerMargin: R4_TRIGGER_MARGIN,
        allowGrazes: true,
        maxTicksPerTarget: R4_MAX_TICKS_PER_WAYPOINT,
    };
    const equipLeg = route.equips[0].leg;
    const specs = [];
    for (let s = 0; s < R4_SEGMENT_NAMES.length; s++) {
        const firstLeg = bounds[s];
        const lastLeg = bounds[s + 1];
        // ⚠ THE BOUNDARY LEG IS SHARED, and stripping its targets is right
        // for every boundary EXCEPT the last one. Segment N ends by ARRIVING
        // in the boundary leg; segment N+1 boots there and does its work. The
        // final segment has no N+1, so its last leg is not a boundary at all
        // and its targets are the rung's payoff — R4's are the boss lock and
        // health itself.
        //
        // R1, R2 and R3 all ended on a leg with no targets (a tail hop to a
        // hub), so this was invisible for three rungs: the shared-boundary
        // rule and "the walk ends on an empty leg" happened to agree.
        const isLast = s === R4_SEGMENT_NAMES.length - 1;
        const legs = route.legs.slice(firstLeg, lastLeg + 1)
            .map((l, i) => ((!isLast && i === lastLeg - firstLeg)
                ? { level: l.level, targets: [], ...(l.contacts ? { contacts: l.contacts } : {}) }
                : JSON.parse(JSON.stringify(l))));
        const boot = route.leg_boots[firstLeg];
        const inherited = route.collects
            .filter((c) => c.leg < firstLeg && c.item !== 'bosskey')
            .map((c) => c.item);
        // ⚠ THE SELECTION IS INHERITED TOO, and only once the item is. A
        // segment booting before the spear collect has no slot 1 to select
        // and `levelRun` throws by name rather than silently downgrading.
        const inheritsEquip = equipLeg < firstLeg;
        specs.push({
            name: R4_SEGMENT_NAMES[s],
            segment: s + 1,
            boot: { ...boot },
            legs,
            firstLeg,
            lastLeg,
            inherited,
            inheritsEquip,
            ...common,
            relax: {
                noclip: false,
                noDamage: true,
                noHazards: [...R4_NO_HAZARDS],
                grants: inherited.length > 0
                    ? [{ level: boot.level, items: [...inherited] }] : [],
                persistence: clears(),
                equips: inheritsEquip ? [{ t: 0, slot: R4_EQUIP_SLOT }] : [],
            },
        });
    }
    specs.push({
        name: R4_FULL_WALK_NAME,
        segment: null,
        boot: { ...route.boot },
        legs: JSON.parse(JSON.stringify(route.legs)),
        firstLeg: 0,
        lastLeg: route.legs.length - 1,
        inherited: [],
        inheritsEquip: false,
        ...common,
        relax: {
            noclip: false,
            noDamage: true,
            noHazards: [...R4_NO_HAZARDS],
            // ⛔ EMPTY. Carried from R3, and still the whole rung.
            grants: [],
            persistence: clears(),
            // ⚠ `[]` here is not "no equip" — it is "a version 4 tape whose
            // equips are a MEASUREMENT". `synthesizeLegs` replaces it with
            // what the `equip` leg verb actually fired, at the tick it fired.
            equips: [],
        },
    });
    return specs;
}
