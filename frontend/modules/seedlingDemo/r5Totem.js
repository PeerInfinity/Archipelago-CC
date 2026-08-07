/**
 * seedlingDemo/r5Totem — the totem path's entrance, and the gate behind it
 * that the brief did not know about.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 5 step 2.
 * Brief: `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §17.7 (the recon
 * this builds) and §18 (what it found).
 *
 * ── WHAT THIS IS ──────────────────────────────────────────────────────
 *
 * §17.7 overturned the brief's premise once already: "kill the 3 spinners"
 * is CIRCULAR, because L39's `wandlock tset -1 tag 8` counts enemies that
 * stand thirty tiles behind it, and the real opener is a `ButtonRoom` in
 * L38 whose write deletes the plug at BUILD time. This module is that
 * write, modelled — and the measurement of what is behind it, which
 * overturns the premise a SECOND time.
 *
 * Three things live here:
 *
 * 1. **`TOTEM_ENTRANCE`** — the L38 button, its TWO writes, and the pair
 *    that proves the plug was there.
 * 2. **`TOTEM_ROPE`** — the seventh press arm, and the group it publishes
 *    to (which contains a `FallRock`, so the R2 rule had to be checked
 *    rather than assumed).
 * 3. ⛔ **`TOTEM_SHAFT`** — the gate NOBODY priced: three `WandLock`s in
 *    the one column that reaches both `totempart 2` and the L40 door,
 *    behind six buttons, three covers and three `PushableBlockFire`s that
 *    only a **FIRE ATTACK** can move.
 *
 * ── ⛔⛔ THE SECOND OVERTURN, AND ITS ARITHMETIC ──────────────────────
 *
 * The recon stopped at 688 cells and called the rope the last gate. It is
 * not: the 688 cells do not include the top of the room.
 *
 * ```
 *     4 cells   arrival pocket, plug standing
 *    56 cells   {39,8} — the L38 button's write
 *   688 cells   ...and {39,9} — the rope pulled     <- §17.7 stopped here
 *   732 cells   ...and the three WandLocks open     <- the totempart and the door
 * ```
 *
 * Those last 44 cells are the whole errand. L39's map is a shaft: column 9
 * is the only route from the room (rows 5–17) to row 1, and rows 2, 3 and 4
 * of it are `wandlock@144,64 {t 3, tag 0}`, `wandlock@144,48 {t 4, tag 1}`
 * and `wandlock@144,32 {t 5, tag 2}`. Above them are `totempart 2` at
 * (72,40) and `teleporter@144,0 -> L40`.
 *
 * ⚠ AND THEY CANNOT BE OPENED IN SEQUENCE. `Lock.activationStep`
 * (`Puzzlements/Lock.as:63-88`) fades at 0.01 per tick while its group is
 * held and RESTORES the moment the group goes quiet *and* nothing overlaps
 * it (`returnToNormal` is occupancy-guarded). The three locks are
 * vertically adjacent and each of their buttons is five to seven tiles
 * away, so stepping off one lock's button to reach the next lock's button
 * closes the first. **Three simultaneous holds, one player.**
 *
 * The game's answer is the one the census has been carrying since R2 as an
 * omission: `pressedGroups`' docblock says in as many words that the game's
 * `hitables` is `["Player", "Enemy", "Solid"]` and that "a pushed block
 * holds a button down too — and that is the intended solution to more than
 * one room". This is that room, three times over. L39 holds exactly three
 * `PushableBlockFire`s, and there are exactly three lock-buttons.
 *
 * ⛔ **AND THE WEAPON THAT MOVES THEM IS NOT MODELLED.**
 * `PushableBlockFire.moveTypes` is `["Fire", "Pulse"]`, and
 * `PushableBlockFire.hit(p, t)` only moves for a `t` in that list. The
 * player's sword passes `"Sword"` (`Player.as:921`) and the ghostsword
 * `"Spear"`; the one thing that passes `"Fire"` is
 * **`Player.as:1030 — genericHit(e, "Fire", fireForce, fireDamage)`**, the
 * fire ATTACK, a 32x32 area around the player driven by `sprFire`'s
 * animation frames. `presses.js` models one weapon and it is the sword.
 *
 * ⇒ Slice 4 earned `fire` and §15 recorded that it "is never SPENT",
 * because Karlore's plug is removed at `added()` time. **This is where it
 * is spent, as a weapon, for the first time on the arc** — and it is the
 * price of every remaining step of slice 5, because L40 (step 3), the wand
 * (step 4) and therefore the Witch's darksword (step 5) are all behind
 * this one shaft.
 *
 * ── WHAT IS STILL TRUE, AND BUILT ─────────────────────────────────────
 *
 * The entrance itself is unaffected and is modelled here: the button's
 * cross-room write, the rope's arm, and the pair. A rung that stops at the
 * shaft still ships two mechanics and the door into the cluster.
 */

import { crossRoomWrites } from './activators.js';
import { WAIT_AFTER_PRESS_TICKS as BURN_WAIT } from './burnableTree.js';

export class TotemError extends Error {
    constructor(message) { super(message); this.name = 'TotemError'; }
}
const fail = (m) => { throw new TotemError(m); };

/** The only door into {39,40,41,42,43} from outside — measured, not assumed. */
export const CLUSTER = Object.freeze([39, 40, 41, 42, 43]);

/**
 * ⛓ THE ENTRANCE: `L38 buttonroom@32,48 {tset: 8, tag: 4, flip: 1, room: 39}`.
 *
 * `ButtonRoom.as:87-96` on a press:
 *
 * ```
 *   var persist:Boolean = _active;           // true
 *   if (flip) persist = !persist;            // -> FALSE
 *   else ... ; Game.setPersistence(t, persist, room);   // {39, 8} = false
 *   Game.setPersistence(tag, !activate);                // {38, 4} = false
 * ```
 *
 * ⚠ `t` IS THE TSET, NOT THE TAG, and the two are different numbers here
 * (8 and 4) — which is the whole reason this button is easy to misread as
 * touching L39's tag 4 rather than its tag 8. The source's own comment is
 * the authority on the sign: *"persist = false, then things won't exist"*.
 */
export const TOTEM_ENTRANCE = Object.freeze({
    presser: Object.freeze({
        level: 38, tag: 'buttonroom', x: 32, y: 48, t: 8, persistTag: 4, flip: true, room: 39,
    }),
    /** The 8x6 hitbox `setHitbox(8, 6, 4, 3)` leaves at `(x + 8, y + 8)`. */
    rect: Object.freeze({ x: 36, y: 53, w: 8, h: 6, right: 44, bottom: 59 }),
    /** Both writes, in the order `set activate` makes them. */
    writes: Object.freeze([
        Object.freeze({ level: 39, tag: 8, value: false, which: 'room' }),
        Object.freeze({ level: 38, tag: 4, value: false, which: 'own' }),
    ]),
    /** What the first write deletes, and the rule that deletes it. */
    plug: Object.freeze({
        level: 39, tag: 'wandlock', x: 144, y: 592, tSet: -1, persistTag: 8,
        tile: Object.freeze({ tx: 9, ty: 37 }),
        why: '`Lock.check()` is `tag >= 0 && tSet < 0 && !Game.checkPersistence(tag) -> '
            + 'FP.world.remove(this)`, so the plug is gone from the level\'s BUILD rather '
            + 'than opened during the visit. The arrival from L38 lands at tile (9,38), '
            + 'one tile south of it, in a corridor one tile wide.',
    }),
    /** ⛔ And the reading it replaces, kept so nobody re-derives it. */
    supersedes: Object.freeze({
        claim: 'kill the 3 spinners',
        why: 'a `tSet < 0` Lock opens on `Game.totalEnemies() <= 0`, and L39\'s three '
            + 'spinners are at (112,88), (224,112) and (224,208) — thirty tiles up, on '
            + 'the FAR SIDE of the lock they would open. 4 cells reachable from the '
            + 'arrival, and not one of the three. The bill is real and it is owed AFTER '
            + 'the entrance, not as it.',
    }),
    /** The measurement, from `probe-seedling-r5-totem-entrance`. */
    cells: Object.freeze({ shut: 4, buttonOnly: 56, andRope: 688, andShaft: 732 }),
});

/**
 * ⛔⛔ R5 SLICE 8: THE ENTRANCE BUTTON IS IN A ROOM THE ARRIVAL CANNOT REACH.
 *
 * `TOTEM_ENTRANCE` above is entirely correct about what the button DOES and
 * says nothing about how a walk gets to it, because until this slice nobody
 * tried. §20.8 priced the leg in one line — "boot at (144,288), the
 * entrance button at (36..44, 53..59), the door at (144,0)" — three
 * waypoints and a walk.
 *
 * ⛔ **L38 IS TWO DISJOINT ROOMS.** The only door into the cluster is L37's,
 * landing at (144,288) = tile (9,18) in the SOUTH room (205 lattice cells /
 * 64 tiles). `buttonroom@32,48` (2,3) and `teleporter@144,0 -> L39` (9,0)
 * are both in the NORTH one (195 / 65), which is otherwise entered only
 * from L39 — and L39 is only entered from here. The two floods share not
 * one tile.
 *
 * ⛔ **AND THE JOIN IS ONE CELL WITH TWO SOLIDS STACKED IN IT.** Row 7 is
 * solid across all nineteen columns; column 9 holds `cover@144,112 {t 0}`
 * and, underneath it, `chest@144,112 {tag 1}` — `type = "Solid"` in its
 * constructor. Opening the cover does not open the cell; it merely makes
 * the chest openable, because `Chest.update`'s gate is
 * `!collide("Solid", x, y)`.
 *
 * ── ⛓⛓ THE CHAIN, AND ITS ENGINE IS A `Pulser` ───────────────────────
 *
 * ```
 *   1  buttonroom@144,128  (9,8)   t 2, room -1   the SELF-LATCH (§20.6)
 *        -> cover@208,224 (13,14) fades open           +6 cells
 *   2  buttonroom@208,224  (13,14) t 1, room -1   a SECOND self-latch,
 *        under the cover link 1 opened
 *        -> pulser@80,224 (5,14) `activate = true`, permanently
 *   3  ⛔⛔ THE PULSE MOVES THE BLOCK. `Pulser.hit()` dispatches
 *        `(c as PushableBlockFire).hit(new Point(x, y), "Pulse")` on every
 *        tick of its expansion, and `pushableblockfire@80,208` at (5,13)
 *        is the pulser's exact NORTH neighbour — a pure axis, no atan2
 *        ambiguity — so it is shoved to (5,12)
 *   4  (5,12) IS `button@80,192 {t 0}`, and a block presses a button
 *        -> cover@144,112 (9,7) fades open, uncovering the chest
 *   5  `Chest.open()` sets **`type = ""`** (Chest.as:76). THAT is what
 *        makes column 9 passable, and it is an ENTITY STATE CHANGE no
 *        census flag can express — links 3, 4 and 5 add ZERO to the flood.
 * ```
 *
 * ⛓ **NOBODY CAN STAND ON `button@80,192`.** It is at (5,12), and the only
 * approaches are (5,13) — the block — and (5,14) — the pulser, a permanent
 * `type = "Solid"`. The group that opens the level's one join has exactly
 * one presser and it is not a player. That is what makes the block
 * mandatory rather than a shortcut.
 *
 * ⚠ **AND `moveTypes = ["Fire", "Pulse"]` HAS BEEN READ FIVE TIMES ON THIS
 * ARC AS "Fire is the one that matters"** (§18.9, §19.2, §19.8, §20.2,
 * §20.3). The other member has a writer, and it is a level's whole opening
 * mechanic. See [[feedback_inert_for_this_weapon]], from the other side:
 * the question is not only which weapon, it is also who is holding it.
 *
 * ⇒ THREE UNBUILT MECHANICS sit between the boot and the entrance button:
 * the `Pulser`'s periodic pulse (a world-driven `PushableBlockFire` mover
 * AND a 22 px player damage ring, `Pulser.as:88-115`), the `Chest`'s
 * open-and-desolidify, and the `SealPiece` that `open()` spawns — a
 * `special` pickup with a 150-frame ceremony and a `SealController` of its
 * own. `probe-seedling-r5-l38-entrance` is the measurement.
 */
export const L38_CHAIN = Object.freeze({
    level: 38,
    supersedes: Object.freeze({
        section: '§20.8',
        claim: 'the L38 leg (boot at (144,288), the entrance button, the door at (144,0))',
        why: 'the boot and the button are in disjoint rooms; the leg is a five-link '
            + 'puzzle whose middle three links are unmodelled',
    }),
    /** The two rooms, measured at the 8 px lattice every R5 route plans at. */
    rooms: Object.freeze([
        Object.freeze({
            name: 'south', from: 'L37 teleporter@288,0', arrival: Object.freeze({ x: 144, y: 288 }),
            tile: Object.freeze({ tx: 9, ty: 18 }), cells: 205, tiles: 64,
            holds: Object.freeze(['buttonroom t2 (9,8)', 'buttonroom t1 (13,14)',
                'button t0 (5,12)', 'the pulser (5,14)', 'the block (5,13)']),
        }),
        Object.freeze({
            name: 'north', from: 'L39 teleporter@144,624', arrival: Object.freeze({ x: 144, y: 16 }),
            tile: Object.freeze({ tx: 9, ty: 1 }), cells: 195, tiles: 65,
            holds: Object.freeze(['buttonroom@32,48 t8 — THE ENTRANCE (2,3)',
                'teleporter@144,0 -> L39 (9,0)']),
        }),
    ]),
    join: Object.freeze({
        tile: Object.freeze({ tx: 9, ty: 7 }),
        stacked: Object.freeze(['cover@144,112 (t 0)', 'chest@144,112 (tag 1)']),
        why: 'row 7 is solid across all 19 columns; this is the one cell, and the cover '
            + 'is only the OUTER of its two solids',
    }),
    links: Object.freeze([
        Object.freeze({
            n: 1, kind: 'buttonroom-local', at: Object.freeze({ x: 144, y: 128 }), t: 2,
            opens: 'cover@208,224', modelled: true,
            why: 'the `room = -1` self-latch slice 7 built (§20.6)',
        }),
        Object.freeze({
            n: 2, kind: 'buttonroom-local', at: Object.freeze({ x: 208, y: 224 }), t: 1,
            opens: 'pulser@80,224', modelled: false,
            why: '⛔ the `Pulser` is not in `world.activators` at all — the census collects '
                + 'responders that change GEOMETRY and a Pulser is `type = "Solid"` either '
                + 'way, so `runHold` here fails with "no responder answers"',
        }),
        Object.freeze({
            n: 3, kind: 'pulse-push', at: Object.freeze({ x: 80, y: 224 }), t: 1,
            moves: Object.freeze({ from: Object.freeze({ tx: 5, ty: 13 }), to: Object.freeze({ tx: 5, ty: 12 }) }),
            modelled: false,
            src: 'Puzzlements/Pulser.as:88-115 — `hit()` collides ["Player","Solid","Enemy"] '
                + 'in a `radiusHit = 22` box, filters on `FP.distanceRectPoint`, and '
                + 'dispatches `(c as PushableBlockFire).hit(new Point(x, y), "Pulse")`',
            why: '⛔⛔ THE ENGINE. The block is the pulser\'s exact north neighbour, so the '
                + 'push is a pure axis and lands on `button@80,192`.',
        }),
        Object.freeze({
            n: 4, kind: 'block-presses-button', at: Object.freeze({ x: 80, y: 192 }), t: 0,
            opens: 'cover@144,112', modelled: true,
            why: 'slice 6\'s `movingSolids` finding, in a level nobody had looked at — and '
                + 'here it is not an alternative to a player press, it is the ONLY one: '
                + '(5,12)\'s approaches are the block and the pulser',
        }),
        Object.freeze({
            n: 5, kind: 'chest-open', at: Object.freeze({ x: 144, y: 112 }), tag: 1,
            modelled: false,
            src: 'Chest.as:58-88 — `update` opens on `collideLine("Player", …)` one pixel '
                + 'below the box, gated on `!collide("Solid", x, y)`; `open()` sets '
                + '`type = ""`, spawns a `SealPiece`, and writes `setPersistence(tag, false)`',
            // ⚠ THE COVER GATES THE CHEST, NOT THE STANCE. The stance band is
            // IDENTICAL with the cover shut, because the cover and the chest
            // occupy the same cell — `!collide("Solid", x, y)` is the chest
            // colliding with the COVER, not with the player. So links 1-4 buy
            // the chest's own permission, not the walk's approach.
            coverGates: 'the chest\'s `!collide("Solid")`, not the player\'s approach',
            why: '⛓ THE DESOLIDIFY IS THE PASSAGE. And the stance is a GRAZE by '
                + 'construction, exactly as a keylock\'s is — but a TWO-PIXEL one, and '
                + 'the thing that bounds it below is the chest itself. The probe row is '
                + 'y = 129 (`y - originY + height + 1`), the player box is `[y-2, y+3)`, '
                + 'and the chest\'s box is `[112,128)`: so the walk has to reach '
                + 'y ∈ {130, 131} and nothing else. Measured, not derived — '
                + '`y - 2 <= 129 < y + 3` alone says [127,131] and four of those five '
                + 'pixels are inside the chest.',
            stanceBand: Object.freeze({ y: Object.freeze([130, 131]), probeRow: 129 }),
        }),
    ]),
    /** What a route has to build before this leg can be planned at all. */
    unbuilt: Object.freeze([
        Object.freeze({
            what: 'the `Pulser` cycle', src: 'Puzzlements/Pulser.as:51-86',
            why: 'a 20-tick wait, a 5-frame animation, then `hit()` once per tick while '
                + '`radius` grows from 10 by 0.8 to 28 — and `radius` is a Number, so the '
                + 'count is `ceil((28-10)/0.8)` rather than a division somebody rounds. It '
                + 'is the first WORLD-DRIVEN periodic hit on the arc: every mover before '
                + 'this was a player press.',
        }),
        Object.freeze({
            what: 'the pulse\'s player damage', src: 'Puzzlements/Pulser.as:110-113',
            why: '`(c as Player).hit(null, force 6, new Point(x, y), damage 1)` inside the '
                + 'same 22 px filter — so the ring is an encounter the ladder prices, and '
                + 'it is live for the whole rest of the visit once link 2 latches',
        }),
        Object.freeze({
            what: 'the `Chest` verb', src: 'Chest.as:58-88',
            why: 'a graze-stance press with no button: the effect is `type = ""` plus a '
                + 'persistence write, and the positive control is that the cell was solid '
                + 'before',
        }),
        Object.freeze({
            what: 'the `SealPiece` pickup', src: 'Chest.as:76 + Pickups/SealPiece.as:17-48',
            why: '⛔ `open()` adds one UNCONDITIONALLY, at the chest\'s own position — which '
                + 'is (9,7), the one cell the walk has to pass through. So it cannot be '
                + 'routed around: a `special = true` pickup is 150 frozen frames the tape '
                + 'has to know about, or the continuation assert sees them as dead.',
        }),
        Object.freeze({
            what: '⛔⛔ the `SealController` BEHIND the SealPiece',
            src: 'Pickups/SealPiece.as:41 + SealController.as:44-56,90-113,214-222',
            why: '`SealPiece.removed()` adds `new SealController()`, whose CONSTRUCTOR sets '
                + '`Game.freezeObjects = true` — a SECOND ceremony, chained behind the '
                + 'first, and a third freeze shape. It runs a 60-tick fade to full '
                + 'darkness, waits 60, and is dismissed by `Input.released(keys[6])` — the '
                + 'X key, the dialogue key — or auto-removes at `alphaStep >= 120`. So it '
                + 'is BOUNDED (≈120 ticks) but it is not optional, and `Bot.autoAdvance` '
                + 'is called only from inside the dead-frame branch (§15).',
        }),
        Object.freeze({
            what: '⚠ and it moves TWO `Music` STATICS',
            src: 'Pickups/SealPiece.as:29-30 + SealController.as:221',
            why: 'The pickup\'s ctor writes `Music.bkgdVolumeMaxExtern = 0` and '
                + '`Music.fadeVolumeMaxExtern = 0`; `SealController.removed()` restores '
                + 'both to 1. ⚠⚠ THE SOUND PIN READS THE MUSIC MIXER — that is the whole '
                + 'reason `swimSoundClock` exists — so this is a static the tape\'s own '
                + 'clock can see, and it is live for the ~120 ticks between the two '
                + 'writes. [[feedback_a_static_survives_the_reconstruction]], on the arc\'s '
                + 'one pinned channel.',
        }),
    ]),
});

/**
 * ⛓ THE SEVENTH PRESS ARM: `rope@96,384 {tset: 6, tag: 9}` in L39.
 *
 * Four facts, and three of them are ways a "clear the flag instead" would
 * have been wrong:
 *
 * 1. **IT IS A WALL.** `Mobile.solids` is
 *    `["Solid", "Tree", "Rock", "Rope", "ShieldBoss"]` (`Mobile.as:17`), so
 *    `type = "Rope"` blocks the player. Its hitbox is
 *    `setHitbox(_xend - _x + 16, 16, 8, 8)` with `_xend` from the entity's
 *    last `<node>` — 112 px wide, spanning [96,208) x [384,400): a
 *    seven-tile bar across the only shaft out of the arrival corridor.
 * 2. **A PRESS NEEDS NO WEAPON TYPE AND NO LINE OF SIGHT.**
 *    `Player.as:1093-1095` is `else if (e is RopeStart) (e as
 *    RopeStart).hit()` — no `t` argument at all — and `Player.as:916`
 *    exempts `v[i].type == "Rope"` from the `collideLine("Solid", ...)`
 *    test that every other target has to pass.
 * 3. **IT SHRINKS, IT DOES NOT DESPAWN.** `hit()` runs
 *    `setHitbox(16, 16, 8, 8)`, leaving a ONE-CELL solid at the span's
 *    start — [96,112) x [384,400). A model that removed it would open a
 *    tile the game keeps.
 * 4. ⚠ **AND IT PUBLISHES TO ITS GROUP.** `RopeStart.set activate` walks
 *    every `Activators` sharing `t` and copies the flag on. Group 6 in L39
 *    is `{rope, pulser@64,96, fallrock@144,624 tag 10}` — so the R2 rule
 *    ("a clear reaching a fallrock is refused by name") had to be checked
 *    rather than assumed. It survives, for a reason that is arithmetic:
 *    see `GROUP_6`.
 */
export const TOTEM_ROPE = Object.freeze({
    level: 39, tag: 'rope', x: 96, y: 384, t: 6, persistTag: 9,
    xend: 192,
    rect: Object.freeze({ x: 96, y: 384, w: 112, h: 16, right: 208, bottom: 400 }),
    shrunkRect: Object.freeze({ x: 96, y: 384, w: 16, h: 16, right: 112, bottom: 400 }),
    write: Object.freeze({ level: 39, tag: 9, value: false }),
    src: 'Puzzlements/RopeStart.as:20-49 + Player.as:916,1093-1095',
});

/**
 * ⚠ THE GROUP THE ROPE PUBLISHES TO, member by member, with the verdict.
 *
 * ⛔⛔ **R5 SLICE 10: THE `fallrock` VERDICT BELOW WAS WRONG, AND THE GAME
 * SAID SO.** The refuted shaft recording's ledger carried {39,10} — the
 * rock's own tag — and 197 of its 217 dead frames are the freeze the fall
 * holds. What follows is the argument that was made and why it failed, kept
 * rather than deleted, because the failure mode is reusable:
 *
 * The R2 rule is that a clear reaching a `FallRock` is REFUSED BY NAME —
 * an armed rock writes the player's `y` directly and is outside both
 * `noclip` and `noDamage`. Group 6 contains one, so the arm is only
 * admissible if the publication cannot arm it. It was argued that it cannot,
 * for two independent reasons:
 *
 * - `FallRock`'s constructor parks it at `y = -16` with `type = ""` unless
 *   `!Game.checkPersistence(tag)`, and its tag is **10**, which nothing on
 *   this route writes. The rope's write is tag **9**.
 * - `FallRock.update`'s position-writing arm is
 *   `if (activate && y >= fallTo)`, and a parked rock has `y = -16` against
 *   `fallTo = 632`. So even with `activate` published TRUE the arm is
 *   unreachable — and the whole falling branch below it is behind
 *   `if (!Game.checkPersistence(tag))`, which is the same flag again.
 *
 * ⛔⛔ **BOTH SENTENCES ARE TRUE ABOUT `update()`, AND THE MECHANISM IS IN
 * `set activate`.** `FallRock` overrides it: `if (a && !_active) { fall();
 * _active = a; }`, and `fall()`'s FIRST line is
 * `Game.setPersistence(tag, false)`. **The publication is not a read of tag
 * 10 — it is the write of it.** So "nothing on this route writes tag 10" is
 * false the instant the rope publishes, and `update()`'s gate is open
 * because the setter opened it. Two gates that share an opener are one
 * gate, and having two of them is what made the audit read as safe.
 * See `fallRock.js`, which transcribes all of it.
 *
 * ⛓⛓ **AND IT IS THE IDIOM.** Three `RopeStart`s exist in the game and TWO
 * publish to a `FallRock` (L28's `rope@160,64 {t 1}` -> `fallrock@112,240`).
 * Pull the rope, drop the rock — the pair was read as a coincidence for
 * four slices. [[feedback_kickoff_anchor_duplicate_engines]] from the data
 * side: the second instance was in the atlas the whole time.
 *
 * ⚠ THE PULSER IS NOT INERT AND IS NOT A REFUSAL EITHER. `Pulser.update`
 * is `if (activate || radius > radiusMin)`, so the publication turns it ON
 * — permanently, because nothing in L39 republishes group 6 as false. It
 * is `type = "Solid"` either way, so the GEOMETRY does not change; what
 * changes is that a 22 px damage ring starts pulsing at (72,104). That is
 * a route cost, priced as an encounter rather than as a wall, and it is
 * why `TOTEM_ROPE` is an arm the route makes DELIBERATELY at a chosen
 * tick rather than a clear declared at the boot.
 */
export const GROUP_6 = Object.freeze([
    Object.freeze({
        member: 'rope@96,384', verdict: 'the presser', persistTag: 9,
        why: 'the entity whose `hit()` publishes',
    }),
    Object.freeze({
        member: 'pulser@64,96', verdict: 'armed, and it is a cost',
        why: '`type = "Solid"` regardless, so no geometry moves; `activate` starts the '
            + 'pulse cycle and a 22 px damage ring at (72,104) that was quiet before',
    }),
    Object.freeze({
        // ⛔⛔ REFUTED BY THE GAME, R5 slice 10. The `was` field keeps the
        // wrong verdict as data rather than as prose, so the test that
        // asserts the correction cannot quietly stop asserting anything.
        member: 'fallrock@144,624', verdict: 'IT FALLS', persistTag: 10,
        why: '`FallRock.set activate` is `if (a && !_active) { fall(); _active = a; }` '
            + 'and `fall()` WRITES `Game.setPersistence(10, false)` itself — so the '
            + 'publication opens the very gate the old verdict read as shut. The cost is '
            + '197 frozen frames (`fallRock.fallRockFreezeTicks(632)`), a camera pan to '
            + 'the landing, `Game.shake = 30`, and a 16x16 `Solid` that lands ON the '
            + 'south teleporter back to L38.',
        was: 'no-op',
        wasWhy: 'parked at y = -16 with `type = ""` because tag 10 is still TRUE, and the '
            + 'position-writing arm is `activate && y >= fallTo` — -16 against 632. Both '
            + 'clauses are true about `update()`; neither is about `set activate`.',
        src: 'Scenery/FallRock.as:103-118, and `fallRock.js`',
    }),
]);

/**
 * ⛔⛔ THE SHAFT — the gate this step found, and the reason slice 5 stops
 * here rather than at L40.
 *
 * Every field is measured or cited. `blockedBy` is the honest answer to
 * "why is the rest of the totem path not built".
 */
export const TOTEM_SHAFT = Object.freeze({
    level: 39,
    /** The column, and the only two things above it that the route wants. */
    reaches: Object.freeze([
        Object.freeze({ what: 'totempart 2', x: 72, y: 40, tile: { tx: 4, ty: 2 } }),
        Object.freeze({ what: 'teleporter -> L40', x: 144, y: 0, tile: { tx: 9, ty: 0 },
            arrival: Object.freeze({ x: 480, y: 896 }) }),
    ]),
    /** Three locks, vertically adjacent, in the one column that gets there. */
    locks: Object.freeze([
        Object.freeze({ id: 'wandlock@144,64', t: 3, persistTag: 0, tile: { tx: 9, ty: 4 } }),
        Object.freeze({ id: 'wandlock@144,48', t: 4, persistTag: 1, tile: { tx: 9, ty: 3 } }),
        Object.freeze({ id: 'wandlock@144,32', t: 5, persistTag: 2, tile: { tx: 9, ty: 2 } }),
    ]),
    /**
     * ⚠ EACH LOCK-BUTTON IS UNDER A COVER, and the cover's own button is
     * open floor. So the room is six presses, not three: `button t 0` opens
     * `cover t 0`, which sits on top of `button t 4`, which opens
     * `wandlock t 4`. The three pairs are (0 -> 4), (1 -> 5), (2 -> 3).
     */
    pairs: Object.freeze([
        Object.freeze({ coverButton: { t: 0, x: 128, y: 144 }, cover: { t: 0, x: 144, y: 112 },
            lockButton: { t: 4, x: 144, y: 112 }, opens: 'wandlock@144,48' }),
        Object.freeze({ coverButton: { t: 1, x: 144, y: 128 }, cover: { t: 1, x: 176, y: 144 },
            lockButton: { t: 5, x: 176, y: 144 }, opens: 'wandlock@144,32' }),
        Object.freeze({ coverButton: { t: 2, x: 160, y: 144 }, cover: { t: 2, x: 112, y: 144 },
            lockButton: { t: 3, x: 112, y: 144 }, opens: 'wandlock@144,64' }),
    ]),
    /** The three holders the game provides, and the weapon that moves them. */
    blocks: Object.freeze([
        Object.freeze({ as3: 'PushableBlockFire', x: 144, y: 176, tile: { tx: 9, ty: 11 } }),
        Object.freeze({ as3: 'PushableBlockFire', x: 208, y: 80, tile: { tx: 13, ty: 5 } }),
        // ⚠ behind `wandlock@48,160 {t 1, tag 7}`, which the SAME `button t 1`
        // that opens cover 1 also opens — one press, two responders.
        Object.freeze({ as3: 'PushableBlockFire', x: 48, y: 176, tile: { tx: 3, ty: 11 },
            behind: 'wandlock@48,160' }),
    ]),
    blockedBy: Object.freeze({
        mechanic: 'the FIRE attack',
        as3: 'Player.as:1014-1035 — `genericHit(e, "Fire", fireForce, fireDamage)` over a '
            + '32x32 `sprFire` rect centred on the player, gated on `sprFire.frame` being '
            + 'between `fireHitFrameStart` and `fireHitFrameEnd`, with a radius cut '
            + '(`FP.distanceRects(...) > sprFire.width / 2`) that trims the corners',
        target: 'Puzzlements/PushableBlockFire.as:23,76-125 — `moveTypes = ["Fire", '
            + '"Pulse"]`, and `hit()` returns immediately `if (v.length > 0)`, snaps the '
            + 'destination to a whole tile away from the player by `Math.atan2`, then '
            + 'slides at `moveSpeed = 0.5` with a grid re-snap each tick',
        why: 'the sword passes "Sword" and the ghostsword "Spear"; neither is in '
            + '`moveTypes`, which is why `PRESS_ARM_POLICY.PushableBlockFire` has said '
            + '`inert` since R2 and was RIGHT to. It is inert for a SWORD. The route '
            + 'needs the other weapon.',
        alsoNeeds: Object.freeze([
            'a second press verb (the fire animation is its own timer and its own rect)',
            '`PushableBlockFire`\'s slide, including `destroy = true` on water/lava/pit',
            'the three-block placement as a PLAN, since a block on the wrong tile is '
                + 'unrecoverable within a visit — nothing pulls one back',
        ]),
    }),
    /** Measured with the three locks forced open, against 688 without. */
    cells: Object.freeze({ withoutShaft: 688, withShaft: 732 }),
});

/**
 * The step-2 PAIR, one field apart.
 *
 * ⚠ THE FIELD IS THE PRESS, NOT A FLAG. Both arms boot into L38 with the
 * same inventory and the same tape; the control's spans simply do not
 * route over the button. So the control walks into L39 and is PINNED at
 * the wandlock in the one-tile corridor, and the press arm walks past
 * where it stood. A declared clear in the control would have proved the
 * flag matters; this proves the BUTTON does.
 */
export const TOTEM_PAIR = Object.freeze({
    press: 'r5-totem-entrance',
    control: 'r5-totem-entrance-control',
    pinnedAt: Object.freeze({ level: 39, tile: Object.freeze({ tx: 9, ty: 38 }) }),
    /** The control's ledger, and it is not empty — see `arrivalButton`. */
    arrivalButton: Object.freeze({
        presser: 'buttonroom@144,288', level: 38, t: 4, persistTag: 5, flip: true, room: 37,
        why: '⚠ THE L37 -> L38 ARRIVAL LANDS ON A SECOND CROSS-ROOM BUTTON, and R1 met it '
            + 'first (`r1Walk.R1_PERSISTENCE_EFFECTS`). The player is placed at (144,288) '
            + 'and `buttonroom@144,288` is there, so BOTH arms press it on their first '
            + 'tick — writing {37,4} and {38,5}. It is in both ledgers and it is not the '
            + 'field the pair differs in, which is exactly why it has to be declared: an '
            + 'exact-set assertion that omitted it would go red on a correct walk.',
    }),
});

/**
 * Resolve a presser's writes and check them against a declaration.
 *
 * The declaration and the derivation are kept apart on purpose: the
 * derivation reads the census (which is generated) and the declaration is
 * this file (which is read out of the AS3). A drift between them is a
 * finding, and a helper that returned the declaration would hide it.
 */
export function assertPresserWrites(presser, declared) {
    const got = crossRoomWrites(presser);
    const key = (w) => `${w.level === null ? presser.level ?? '?' : w.level}:${w.tag}=${w.value}`;
    const a = got.map(key).sort();
    const b = declared.map((w) => `${w.level}:${w.tag}=${w.value}`).sort();
    if (JSON.stringify(a) !== JSON.stringify(b)) {
        fail(`${presser.tag}@${presser.x},${presser.y} writes [${a.join(', ')}] and the `
            + `declaration says [${b.join(', ')}]`);
    }
    return got;
}

/**
 * ── ⛔⛔ L40 FROM THE L39 ARRIVAL, R5 slice 10 ─────────────────────────
 *
 * The brief gave slice 10 two L40 predictions to turn into oracle facts or
 * named failures. Both are named failures, and neither needed the game:
 * one is refuted at source and the other is unreachable.
 *
 * ⛓ **BUT THE STEP IS NOT EMPTY.** A flood from the arrival at (488,904)
 * with EVERYTHING SHUT reaches 437 lattice cells / 180 tiles, and
 * `totempart 1 @160,640` is in it. Part 1 is a free walk: no group, no key,
 * no press, and nothing the shaft does not already deliver.
 *
 * ⛔ **PREDICTION 1 — "buttonroom self-latching opens the wandlock groups"
 * — CANNOT BE DRIVEN FROM HERE.** The mechanism is real and is now
 * modelled (`activators.localPublish`, `state.latched`), and §20.6's
 * reading of `ButtonRoom.as:79-95` stands. What does not stand is that it
 * is "L40's entire opening mechanic" *for this route*: **none of the three
 * `room = -1` buttonrooms is in the arrival flood**, and opening groups 0
 * and 1 by fiat adds **ZERO** cells to it. The rooms are behind the same
 * wall their own groups are.
 *
 * ⛔⛔ **PREDICTION 2 — "the keyType-2 boss key is NOT collected" — IS
 * REFUTED AT SOURCE.** §20.6 argued `bosslock@480,352` is an `Activators`
 * in group 0, so `buttonroom@272,208`'s latch opens it with no key.
 * `BossLock.as:31` is
 * `super(_x + Tile.w/2, _y + Tile.h/2, Game.bossLocks[_t], -1)` — the
 * group is a hard-wired **−1** and `_t` is the KEY TYPE, one argument to
 * its left. No publication can reach it; `BossLock.update`'s own probe
 * line plus `Player.hasKey(2)` is its only opener. See
 * `levelWorld.FORCED_TSET`, which the model was missing — it had the lock
 * in group 0 and would have opened a wall the game keeps shut.
 *
 * ⚠ The question is moot for this walk either way: **neither the lock nor
 * the key is in the arrival flood.**
 *
 * ⇒ **THE OPEN QUESTION, STATED RATHER THAN GUESSED:** L40's north half —
 * `totempart 0`, all three buttonrooms, both north teleporters, both fire
 * blocks, all three buttons, the chest and the breakable rocks — is
 * entered by something that is not this arrival. What the arrival DOES
 * reach besides part 1 is `stairsdown@320,576 -> L43` and the
 * `control@224,432` pit (also to L43) — and L43 is the wand room, which
 * this rung is told not to approach. Routing it is the next slice's.
 */
/**
 * ── ⛓⛓⛓ R5 SLICE 14: THE BURN'S FIRST DRIVE, AND IT IS L37's TREE ────
 *
 * `burnableTree.js` shipped in slice 12 and nothing burned anything for two
 * slices, so `OUT_OF_BAND_WRITERS.BurnableTree.witness` read `none yet`.
 * The brief's tree was L40's — and §27.9 measured that it stands BEHIND
 * `chest@880,816`, i.e. behind link 1 of an eleven-link chain. This one has
 * nothing in front of it, and the room has nothing else in it either: no
 * enemy, no pushable, no pit tile. A press here can only say one thing.
 *
 * ── ⛔⛔ AND "THE TREE IS A DOOR" WAS AN ARTEFACT OF THE FLOOD'S POLICY
 *
 * The first cut of this declaration read *"96 nodes shut, 584 burned — the
 * walk starts in a closed room and the tree is its only exit"*, and it was
 * **wrong in the way that is hardest to see: the flood and the DRIVE were
 * asking different questions.** `plannerObstacleAt`'s lethal-terrain
 * policy defaults to *"the player holds nothing"*, and the flood was run
 * without an `inventory`; the driver's `planNow` passes `run.inventory`,
 * and this route holds the CONCH. Re-run with the drive's own policy:
 *
 * ```
 *   flooded as the DRIVE plans      2049 shut -> 2065 burned    +16
 *   flooded holding nothing           96 shut ->  584 burned   +488
 * ```
 *
 * ⇒ **+16 is the tree's own 2x2 footprint at an 8 px lattice, and nothing
 * else.** A player who can swim walks around it; the "closed room" is
 * closed by 26 nodes of water and a teleporter, not by the tree. §27.9's
 * "+20" (measured over the whole level) was nearer the truth than the
 * correction that replaced it.
 *
 * ⛓⛓ **SO THIS TAPE IS A VERB CERTIFICATION, NOT AN OPENED-BLOCKER PAIR**,
 * and its load-bearing claim is the one that survives every policy: the
 * walk enters the tree's OWN CELLS — (8,13) and (9,13) — and the control
 * enters none of them. A cell a 32x32 Solid is standing in is unenterable
 * by construction, whatever the router believes about the water next door.
 *
 * ⚠ [[feedback_verifier_shared_assumption]] in its other direction: the
 * flood and the planner did not share an assumption they should have. The
 * numbers below therefore carry the POLICY in their names.
 */
export const L37_BURN = Object.freeze({
    level: 37,
    lattice: 8,
    /** `assets/levels/.../37.oel`, and the tag is >= 0 so the write is IN BAND. */
    tree: Object.freeze({ id: 'burnabletree@128,192', tag: 1, x: 128, y: 192 }),
    /**
     * §27.9's stance, kept. The 32x32 fire rect at (120,232) is
     * [104,136) x [216,248) and the tree's box is [128,160) x [192,224), so
     * they overlap in an 8x8 corner — which is enough for
     * `collideRectInclusive` and for the 16 px radius cut, and is the
     * closest a player can stand to a tree whose own cell they cannot
     * enter.
     */
    stance: Object.freeze({ x: 120, y: 232 }),
    /**
     * A tile in the closed room, far enough from the stance to need a walk.
     *
     * ⚠ `at` IS THE TILE CORNER AND `tile` IS WHERE THE PLAYER LANDS. A
     * `Bot` boot is `new Game(level, bootX, bootY)` and `Player.as:357`
     * adds (+8,+8) — the same relationship `L40_ARRIVAL` records as
     * `boot`/`spawn`. Booting at the tile CENTRE puts the player half a
     * tile into its neighbour, which here is a wall.
     */
    boot: Object.freeze({
        tile: Object.freeze({ tx: 3, ty: 17 }),
        at: Object.freeze({ x: 48, y: 272 }),
    }),
    /**
     * The third target — a tile east of the tree, far enough that the route
     * to it goes THROUGH the burned cells.
     *
     * ⚠ REPORTED, NOT CLAIMED. A player holding the conch can reach this
     * tile with the tree standing (see the flood above), so "the control
     * never enters it" is a fact about the control's SPANS and not about
     * the room — the §27.5 trap, which this declaration walked into once
     * already. The claim is `footprint` below.
     */
    proof: Object.freeze({ tx: 13, ty: 13 }),
    /**
     * ⛓⛓ THE CLAIM. The tree's own 2x2, in tiles. The route crosses (8,13)
     * and (9,13) after the burn; the control enters none of the four on any
     * tick. A 32x32 Solid's cells are unenterable while it stands, under
     * every terrain policy and every inventory — which is what makes this
     * the arm that survives.
     */
    footprint: Object.freeze([
        Object.freeze({ tx: 8, ty: 12 }), Object.freeze({ tx: 9, ty: 12 }),
        Object.freeze({ tx: 8, ty: 13 }), Object.freeze({ tx: 9, ty: 13 }),
    ]),
    crossed: Object.freeze(['8,13', '9,13']),
    /** `Main.primary` — one weapon, one equip, for the whole visit (§20.5). */
    fireSlot: 1,
    /**
     * ⛔ PINNED TO THE MODULE'S OWN OBLIGATION rather than typed. A burn is
     * solid for 41 ticks and `breakableRocks` exports a constant of the
     * SAME NAME for a 7-tick shatter; a hand-copied 53 here is how the two
     * drift apart, and a leg that waited the rock's number would walk into
     * a tree the game has not taken down.
     */
    wait: BURN_WAIT,
    /**
     * Measured by `plan-seedling-r5-l37-burn`, re-derived on every run —
     * BOTH policies, because the difference between them is the finding.
     * `held` is what the driver plans with; `nothing` is the conservative
     * default that made the first cut of this declaration wrong.
     */
    flood: Object.freeze({
        held: Object.freeze({ shut: 2049, burned: 2065, delta: 16 }),
        nothing: Object.freeze({ shut: 96, burned: 584, delta: 488 }),
        why: '+16 is the tree\'s own 2x2 at an 8 px lattice. A player holding the conch '
            + 'swims round it; the 96-node "room" is bounded by 26 nodes of lethal '
            + 'terrain and a teleporter, not by the tree.',
    }),
    control: Object.freeze({
        /**
         * The furthest column the control touches. ⚠ REPORTED DATA, per
         * §27.5: a control replays the whole tape into an unchanged world,
         * so its extent is the spans' artefact. It is here to catch drift,
         * not to carry a claim.
         */
        maxColumn: 7,
    }),
});

/**
 * ── ⛓⛓⛓ R5 SLICE 14: L40 LINKS 1 AND 2, DRIVEN ──────────────────────
 *
 * §24.5 priced the gate and could not open it: link 2 needed a burn verb
 * and the verb needed a `runFire` arm. Both exist now, and driving the pair
 * turned one of §24.5's remarks into a ROUTE constraint.
 *
 * ⛔⛔ **THE ORDER IS FORCED BY THE ROUTE, NOT BY THE FLAGS.** §24.5 read
 * the one pixel of shared edge — the tree's box ends at y = 816 where the
 * chest's begins, and `816 > 816` is false, so `Chest.update`'s
 * `!collide("Solid")` gate is satisfied with the tree standing — and
 * concluded *"one pixel either way and the ORDER of the two links would be
 * forced"*. It is forced anyway, one layer up: **every stance whose fire
 * rect reaches the tree is inside the chest's own cell**, and that cell is
 * Solid until the chest opens. The flags commute; the walk does not.
 *
 * ⇒ a gate can be conjunctive in its flags and SEQUENTIAL in its route, and
 * an audit that only asks the flags reports the wrong freedom.
 *
 * ⛓ The three arms, re-derived from the arrival on every run of
 * `plan-seedling-r5-l40-join`, agreeing with §24.5 exactly: 660 shut,
 * 664 chest-only, 660 tree-only, 700 both.
 */
export const L40_JOIN = Object.freeze({
    level: 40,
    chest: Object.freeze({ id: 'chest@880,816', x: 880, y: 816, persistTag: 13 }),
    tree: Object.freeze({ id: 'burnabletree@872,784', tag: 0, x: 872, y: 784 }),
    /** Carries the equip. The spawn itself, so the first target is a no-op walk. */
    approach: Object.freeze({ x: 488, y: 904 }),
    /**
     * ⚠ TWO ROWS, and `bobsoldier@880,832` stands in them. It is `type =
     * "Enemy"` and therefore not Solid to the player, and `BobSoldier`'s
     * own `update()` returns on `Game.freezeObjects` — so it neither blocks
     * the stance nor moves through the ceremony. Both halves checked at
     * source rather than assumed from "it is only an enemy".
     */
    chestStance: Object.freeze({ x: 884, y: 834 }),
    /**
     * ⛓ THE CHEST'S OWN CELL — tile (55,51), the +4 the chest buys. The
     * fire rect from here is [872,904) x [808,840) and the tree's box is
     * [872,904) x [784,816): an 8 px overlap on the tree's bottom edge,
     * with 4 px of rect-to-rect distance against a 16 px radius cut.
     */
    burnStance: Object.freeze({ x: 888, y: 824 }),
    /**
     * A tile in the +40 chamber that is NOT `buttonroom@880,768`'s own
     * (55,48). ⚠ Deliberate: stepping on the buttonroom is link 3 and would
     * put {40,12} in this tape's ledger, which would make the two-write
     * claim below a three-write one. Links are driven one tape at a time.
     */
    proof: Object.freeze({ x: 872, y: 776 }),
    fireSlot: 1,
    wait: BURN_WAIT,
    /** `Chest.open()`'s flag, then `BurnableTree.removed()`'s. */
    earned: Object.freeze(['40:13', '40:0']),
    /**
     * ⛔⛔ THE KILL-LEDGER RULE FOR THIS CHAMBER, source-verified.
     *
     * ```
     *   Bob.removed()         EMPTY  (`//if(!fell) dropCoins();`)
     *   BobSoldier.removed()  EMPTY  (the same commented-out line)
     *   Spinner.removed()     `Game.setPersistence(tag, false)`, NO test of
     *                         the cause
     * ```
     *
     * ⇒ clearing a press room of bobs costs the ledger NOTHING, and killing
     * a spinner costs it a flag whatever killed it — including a hazard the
     * billiard bounced into on a tick no route chose. So "kill or thread"
     * is decided PER SPINNER against the ledger prediction, and per BOB it
     * is free.
     */
    spinners: Object.freeze([
        Object.freeze({ id: 'spinner@816,848', tag: 15 }),
        Object.freeze({ id: 'spinner@880,848', tag: 16 }),
    ]),
});

/**
 * ── ⛓⛓⛓ R5 SLICE 14: L40's NW CLUSTER — LINK 11, AND THE THIRD CEREMONY
 *
 * §24.5 numbered this link 11 because that is where the ARRIVAL's ordering
 * puts it: behind the bosslock. Its own dependencies are internal and need
 * no key, so it is drivable from a boot into the cluster — which proves the
 * four links and the ceremony and NOT the route to them. Both halves of
 * that are said out loud because a tape that boots somewhere is very easy
 * to read as a tape that walked there.
 *
 * ── ⛔⛔ AND THE FREEZE GATES ARE NOT UNIFORM ACROSS THE ENEMY FAMILIES
 *
 * The brief asked for the `Spinner`/`Puncher`/`BombPusher` gates to be
 * checked before any class was trusted to hold still through a ceremony.
 * Source-verified, and they are a THREE-WAY SPLIT:
 *
 * ```
 *   Bob.update          `if (destroy || anim == "die" || Game.freezeObjects) return`
 *   BobSoldier.update   `if (Game.freezeObjects) return`
 *   Spinner             no own guard; `Mobile.mobileUpdate` PARKS the motion
 *   Puncher.update      ⛔ NO FREEZE TEST. Only `Mobile`'s gate stops it
 *                       MOVING; its chase arm keeps re-aiming `v` and its
 *                       attack state machine keeps running
 *   BombPusher.update   ⛔⛔ NO FREEZE TEST AT ALL, and `super.update()` is
 *                       the LAST line. `shotTime` keeps counting, the
 *                       Spritemap keeps animating (graphic updates are not
 *                       gated), and `endAnim` can `FP.world.add(new Bomb(x,
 *                       y, new Point(p.x, p.y)))` — aimed at a player who
 *                       cannot move. It is inert HERE only because
 *                       `Player.hit` is freeze-gated and `Bot.noDamage` is
 *                       on; a ceremony that ends while a bomb is in flight
 *                       is a different question.
 * ```
 *
 * ⇒ **"enemies stop during a ceremony" is true of the bob family and false
 * as a general rule.** §27.6's "a frozen player is invulnerable" still
 * holds — every damage path but `LavaTrap.attached.die()` goes through the
 * freeze-gated `Player.hit`, and no LavaTrap is in L40 — but "nothing
 * happens" does not.
 */
export const L40_NW = Object.freeze({
    level: 40,
    lattice: 8,
    /** `Bot.as:811` re-boots into the cluster; the spawn is boot + (8,8). */
    boot: Object.freeze({ x: 272, y: 224 }),
    spawn: Object.freeze({ x: 280, y: 232 }),
    /** `{t 0, tag 7}` and `{t 1, tag 1}`, both `room = -1` SELF-LATCHES. */
    buttonroom0: Object.freeze({ x: 272, y: 208 }),
    buttonroom1: Object.freeze({ x: 160, y: 128 }),
    /**
     * ⛔ 101 CONTINUOUS TICKS, NOT FOUR. `L38_CHAIN`'s buttonrooms open
     * COVERS, which fade in 11; both of these open `Lock`s, which need
     * **101** (`activators.opensOnKeyTick`). The self-latch means the group
     * stays published after the player steps off — that is what makes the
     * REST of the leg possible — but it does not make the fade shorter, and
     * a 4-tick hold reports "held, and the wall is still solid".
     */
    holdTicks: 105,
    group0: Object.freeze(['wandlock@208,128', 'wandlock@208,144', 'wandlock@208,160']),
    group1: Object.freeze(['wandlock@176,80', 'wandlock@176,208']),
    /**
     * ⛔⛔ THREE ROCKS, **TWO SWINGS** — and the second one is collateral
     * the first plan did not name.
     *
     * The obvious leg is one swing per rock, west-facing, from the column
     * east of each. Driven, it fails on target 2: *"breakablerock@176,144
     * is ALREADY GONE before the press"*. `breakablerock@176,128` and
     * `breakablerock@176,144` are VERTICALLY ADJACENT, and a sword slash is
     * an AREA — `genericHit` runs on everything the slash rect overlaps —
     * so one swing at (200,136) takes both down.
     *
     * ⇒ [[feedback_aimed_model_hides_collateral]], on a third mechanic: the
     * plan names the swing and its WHOLE effect, not the rock it was aimed
     * at. The tape's ledger claim (all three tags) is what proves nothing
     * was missed, and `runSpear`'s already-gone refusal is what caught it.
     */
    swings: Object.freeze([
        Object.freeze({
            aim: 'breakablerock@176,128',
            x: 176, y: 128,
            stance: Object.freeze({ x: 200, y: 136 }), facing: 'W',
            breaks: Object.freeze(['breakablerock@176,128', 'breakablerock@176,144']),
            why: '⛔ TWO ROCKS, ONE SLASH — the two are vertically adjacent and the '
                + 'slash rect covers both. Naming only the aimed one is what made the '
                + 'first cut of this leg refuse itself.',
        }),
        Object.freeze({
            aim: 'breakablerock@160,144',
            x: 160, y: 144,
            stance: Object.freeze({ x: 184, y: 152 }), facing: 'W',
            breaks: Object.freeze(['breakablerock@160,144']),
            why: 'the westmost, and it is behind the two the first swing removed — its '
                + 'stance is the cell `breakablerock@176,144` was standing in.',
        }),
    ]),
    rocks: Object.freeze([
        Object.freeze({ id: 'breakablerock@176,128', tag: 22, x: 176, y: 128 }),
        Object.freeze({ id: 'breakablerock@176,144', tag: 24, x: 176, y: 144 }),
        Object.freeze({ id: 'breakablerock@160,144', tag: 23, x: 160, y: 144 }),
    ]),
    part: Object.freeze({ x: 64, y: 144 }),
    /** A neighbour: a planner may not route ONTO a pickup. */
    collectStance: Object.freeze({ tx: 5, ty: 9 }),
    /** shut / +t0 / +rocks / +t1, from the boot, at the drive's own policy. */
    flood: Object.freeze([728, 760, 776, 968]),
    /** Three rock tags and two buttonroom tags. */
    earned: Object.freeze(['40:22', '40:23', '40:24', '40:7', '40:1']),
    spinners: Object.freeze([
        Object.freeze({ id: 'spinner@192,128', tag: 19 }),
        Object.freeze({ id: 'spinner@192,144', tag: 18 }),
        Object.freeze({ id: 'spinner@192,160', tag: 17 }),
    ]),
});

export const L40_ARRIVAL = Object.freeze({
    level: 40,
    /** `teleporter@144,0` in L39 says `playerx 480, playery 896`; +8,+8 is `Player.as:357`. */
    from: Object.freeze({ level: 39, teleporter: 'teleporter@144,0' }),
    boot: Object.freeze({ x: 480, y: 896 }),
    spawn: Object.freeze({ x: 488, y: 904 }),
    lattice: 8,
    /** Measured with the R5 item set and every group shut. */
    flood: Object.freeze({ cells: 437, tiles: 180 }),
    reached: Object.freeze([
        Object.freeze({ what: 'totempart 1', at: Object.freeze({ x: 160, y: 640 }),
            tile: Object.freeze({ tx: 10, ty: 40 }), why: '⛓ FREE — step 3\'s part 1' }),
        Object.freeze({ what: 'stairsdown -> L43', at: Object.freeze({ x: 320, y: 576 }),
            tile: Object.freeze({ tx: 20, ty: 36 }), why: '⚠ the WAND room — do not approach' }),
        Object.freeze({ what: 'control pit -> L43', at: Object.freeze({ x: 224, y: 432 }),
            tile: Object.freeze({ tx: 14, ty: 27 }), why: '⚠ the same room, by falling' }),
        Object.freeze({ what: 'teleporter -> L39', at: Object.freeze({ x: 480, y: 912 }),
            tile: Object.freeze({ tx: 30, ty: 57 }), why: 'the way back' }),
    ]),
    /** Everything the step wanted and the arrival does not reach. */
    unreached: Object.freeze([
        'totempart 0 @64,144', 'buttonroom@160,128', 'buttonroom@272,208',
        'buttonroom@880,768', 'bosslock@480,352', 'bosskey@656,528',
        'teleporter@944,96 -> L41', 'teleporter@848,0 -> L42',
        'button@480,384', 'button@768,400', 'button@816,400',
        'chest@880,816', 'pushableblockfire@480,480', 'pushableblockfire@576,576',
        'breakablerock@160,144',
    ]),
    /** ⛓ Opening groups 0 and 1 by fiat adds this many cells. It is zero. */
    groupDelta: 0,
});

/**
 * ── ⛓⛓ L40's OPENING CHAIN, MEASURED — R5 slice 11 ───────────────────
 *
 * §23.9 ended on an open question — *"L40's north half is entered by
 * something that is not this arrival"* — and this is the answer. It is
 * ELEVEN links, and the first two are the L38 join's shape one level on.
 *
 * ⛔⛔ **THE FIRST GATE IS TWO SOLIDS STACKED IN A ONE-CELL PASSAGE, AND
 * NEITHER ALONE OPENS IT.** Row 51 of the south-east chamber is wall
 * across columns 47-57 except at (55,51), where `chest@880,816` stands;
 * directly above it, `burnabletree@872,784` is a **32x32** solid covering
 * (54,49), (55,49), (54,50) and (55,50). Measured, from the arrival:
 *
 * ```
 *   chest opened, tree standing   +4 cells   — one cell, into the tree
 *   tree burned, chest shut       +0 cells   — the chamber is still sealed
 *   BOTH                         +40 cells   — and `buttonroom@880,768` is in it
 * ```
 *
 * That is `L38_CHAIN`'s "the join is one cell with two solids stacked in
 * it" (§21.4), with a different second solid — and it is why an audit of
 * either blocker alone reads as "no way through".
 *
 * ⛔ **AND THE BOSS KEY IS BEHIND A BLOCK, NOT BEHIND A FLAG.** With every
 * activator in the level open by fiat, `bosskey@656,528` is STILL
 * unreachable: its chamber's only door is `pushableblock@576,560` at
 * (36,35), and its own only approach is (36,36) — which
 * `pushableblockfire@576,576` is standing in. So the mini-chain the brief
 * named is load-bearing: `button@816,400 {t 4}` arms `pulser@592,576`, the
 * pulse shoves the fire block WEST off (36,36) (the fire block is the
 * pulser's exact west neighbour, `L38_CHAIN` link 3's geometry), the
 * player steps in, and the plain block is WALK-pushed north THREE times to
 * (36,32) before the row-33 corridor opens.
 *
 * ⚠ **THE PUSH IS A WALK AND NOT A PRESS** — `PushableBlock.input()`
 * collides "Player" at x±1/y±1 and reads the player's velocity SIGN
 * (`PUSHABLE_FAMILIES.pushableblock` is `'walk'`), so no weapon is
 * involved and no press census sees it.
 *
 * ⛔⛔ **AND SLICE 10's REFUTATION IS WHAT MAKES THE KEY MANDATORY.**
 * §20.6 concluded the walk should not collect `bosskey@656,528` because
 * `buttonroom@272,208` would open the bosslock with no key; §23.8 refuted
 * that (the group is a literal -1). The key is now the ONLY opener, and
 * the bosslock is the single largest link in the chain: **+732 cells**,
 * and it is what puts `teleporter@944,96 -> L41` and
 * `teleporter@848,0 -> L42` — L41's and L42's only doors — in reach.
 * ⇒ **`totempart 3` and `totempart 4` are behind this key.**
 */
/**
 * ⛔⛔ R5 SLICE 13 — `control@224,432`, RECONNED, AND IT IS NOT A THING IN
 * THE ROOM AT ALL.
 *
 * §24.5 got the shape right and left the arithmetic; the kickoff asked for
 * the recon before any route goes near it. Read at source, it is a
 * PARAMETER BLOCK consumed once at `Game.loadlevel` (`Game.as:2100-2106`)
 * and never again:
 *
 * ```
 *   fallthroughLevel  = @fallthrough                        = 43
 *   fallthroughOffset = (@x, @y) + (@xOff, @yOff)
 *                     = (224, 432) + (-64, -320)            = (160, 112)
 *   fallthroughSign   = int(@sign) - 1                      = -1
 * ```
 *
 * ⛓⛓ **SO ITS `@x,@y` IS NOT A POSITION IN L40.** It is the BASE OF AN
 * OFFSET, and a route that treated (224,432) as a volume to avoid would be
 * avoiding a cell with nothing in it while walking freely past the thing
 * that matters — which is every pit in the level.
 *
 * ⛔ AND THE ONLY CONSUMER IS A PIT FALL. `Player.checkFallingInPit`
 * (`Player.as:745-771`) fades the player out over twenty frames and then
 * branches on `Game.fallthroughLevel > -1`: with the block present it
 * TRANSPORTS to L43 at `floor(max(fallInPitPos - offset, 0) / 16) * 16`,
 * sets `Game.setFallFromCeiling = true` and `Game.sign = -1`; without it,
 * `die()`.
 *
 * ⇒ **a pit in L40 is a one-way door into the WAND ROOM**, not a death and
 * not a hazard the ladder's `hard-avoid` verdict describes correctly. It is
 * still a thing the route must never touch — L43 is the next slice's
 * business and there is no way back up — but for the opposite reason from
 * the one "hazard" implies.
 */
export const L40_FALLTHROUGH = Object.freeze({
    from: 40,
    entity: Object.freeze({ tag: 'control', x: 224, y: 432 }),
    toLevel: 43,
    /** `(@x,@y) + (@xOff,@yOff)` — subtracted from the fall position. */
    offset: Object.freeze({ x: 160, y: 112 }),
    /** `int(@sign) - 1`. */
    sign: -1,
    fallFromCeiling: true,
    isTrigger: false,
    consumedBy: 'Player.checkFallingInPit — at the END of the 20-frame fade, not on entry',
    landing: 'floor(max(fallInPitPos - offset, 0) / 16) * 16, per axis',
    why: 'the block is read once at loadlevel into three statics. Its @x,@y is the base '
        + 'of an OFFSET and not a place; what a route has to avoid is every PIT in L40, '
        + 'and what a pit does is transport rather than kill.',
    src: 'Game.as:2100-2106 + Player.as:745-771',
});

export const L40_CHAIN = Object.freeze({
    level: 40,
    lattice: 8,
    from: Object.freeze({ x: 480, y: 896 }),
    /**
     * ⚠ MEASURED AT THE PLANNER'S LATTICE (`nodeCentre` + `plannerObstacleAt`),
     * which is a different phase from §23.9's `collidesSolid` flood over
     * pixel multiples of 8 — so the two counts are not comparable and this
     * one is deliberately not "corrected" against 437. A component the
     * planner cannot walk is not a component; both floods agree on every
     * VERDICT, which is the claim that matters.
     */
    shutCells: 660,
    links: Object.freeze([
        Object.freeze({
            n: 1,
            what: 'chest@880,816 {tag 13} opened — `type = ""`, the second seal ceremony',
            gains: 4,
            why: 'the only opening in row 51; `Chest.update`\'s `!collide("Solid", x, y)` '
                + 'gate is satisfied with the tree standing, because the tree\'s box '
                + 'ends at y = 816 and the chest\'s starts there',
            built: 'chest.js + sealCeremony.js (§22.2, §22.3)',
        }),
        Object.freeze({
            n: 2,
            what: 'burnabletree@872,784 {tag 0} burned — a 32x32 solid, 41 ticks',
            gains: 36,
            why: '⛔ ZERO on its own, and +40 with link 1 — the two are one gate. '
                + 'A FIRE press only: `BurnableTree.hit(t)` is gated on `t == "Fire"`.',
            built: '⛔ NO — `FIRE_ARM_POLICY.BurnableTree` is `refused` and the burn is '
                + 'a per-visit removal with no geometry family (it would be the EIGHTH)',
        }),
        Object.freeze({
            n: 3,
            what: 'buttonroom@880,768 {t 3, tag 12} — a room -1 SELF-LATCH',
            gains: 128,
            why: 'opens `wandlock@480,560 {tag 11}`, the plug in the arrival\'s own '
                + 'column 30 — the first cell of the north half',
            built: 'activators.localPublish (§20.6)',
        }),
        Object.freeze({
            n: 4,
            what: 'button@480,384 {t 2} — a PLAIN button, so it does not latch',
            gains: 208,
            why: 'opens `wandlock@448,432 {tag 9}` and `wandlock@512,480 {tag 10}`; '
                + '⛔ the button is itself behind those two, so group 2 cannot '
                + 'bootstrap itself — link 3 is what reaches it',
            built: 'activators (R2)',
        }),
        Object.freeze({
            n: 5,
            what: 'button@768,400 {t 5} -> wandlock@800,400 {tag 21}',
            gains: 12,
            built: 'activators (R2)',
        }),
        Object.freeze({
            n: 6,
            what: 'button@816,400 {t 4} — arms pulser@592,576',
            gains: 0,
            why: '⚠ A `Button` REPUBLISHES rather than latching, so the pulser is armed '
                + 'only while something presses it — and the block\'s glide is 32 ticks',
            built: 'pulser.js (§21.65) — the CYCLE; not wired into `levelRun` for L40',
        }),
        Object.freeze({
            n: 7,
            what: 'the PULSE shoves pushableblockfire@576,576 WEST to (35,36)',
            gains: 4,
            why: 'the block is the pulser\'s exact WEST neighbour — `L38_CHAIN` link 3\'s '
                + 'geometry, mirrored. It is the only way off that cell: a fire press '
                + 'from the south would drive it NORTH into the plain block, and the '
                + 'cell east of it is the pulser, a permanent Solid.',
            built: 'pulser.pulsePushes + pushables (§21.65)',
        }),
        Object.freeze({
            n: 8,
            what: 'pushableblock@576,560 WALK-pushed north THREE times, (36,35) -> (36,32)',
            gains: 56,
            why: '⛔ ONE push is not enough and neither is two: the block plugs a '
                + 'one-wide column and the player must follow it up. Measured at each '
                + 'of (36,34) / (36,33) / (36,32); only the third reaches the key.',
            built: 'pushables.walkPushContact (R3)',
        }),
        Object.freeze({
            n: 9,
            what: 'bosskey@656,528 {keyType 2} collected',
            gains: 0,
            why: '⛔⛔ MANDATORY, and §20.6 said it was not — refuted by §23.8',
            built: 'r4 key leg',
        }),
        Object.freeze({
            n: 10,
            what: 'bosslock@480,352 {keyType 2, tag 8} unlocked',
            gains: 732,
            why: '⛓⛓ THE LARGEST LINK, and it is what reaches BOTH north teleporters — '
                + 'so L41 and L42, and `totempart 3` and `totempart 4`, are behind it',
            built: 'activators.KEY_RESPONDERS (R4)',
        }),
        Object.freeze({
            n: 11,
            what: 'buttonroom@272,208 {t 0, tag 7}, then the three breakablerocks '
                + '{tags 22,23,24}, then buttonroom@160,128 {t 1, tag 1}',
            gains: 240,
            why: 'the NW cluster, in that order — and only the last of the three puts '
                + '`totempart 0 @64,144` in reach',
            built: 'activators + breakableRocks (R2)',
        }),
    ]),
    /** What the closure reaches, against 660 shut — the whole level opened. */
    openCells: 2084,
    /** ⛔ The measured pairs that make link 1+2 one gate rather than two. */
    joinPairs: Object.freeze([
        Object.freeze({ open: 'chest only', cells: 664, reachesButtonroom: false }),
        Object.freeze({ open: 'tree only', cells: 660, reachesButtonroom: false }),
        Object.freeze({ open: 'both', cells: 700, reachesButtonroom: true }),
    ]),
});

/**
 * ── ⛔⛔ L41 AND L42 END AT THE SAME WALL — R5 slice 11 ────────────────
 *
 * Step 4's recon, done early because its answer changes what step 4 IS.
 * Both rooms hold one totem part and both are behind `L40_CHAIN`'s link 10
 * (the boss key), so neither is routable this slice — but which MECHANIC
 * blocks them is answerable from the extract, and it is **one mechanic,
 * not two**:
 *
 * ```
 *   L41  352 cells with the crusher, 408 without   totempart 3 crosses
 *   L42  304 cells with the crushers, 356 without  totempart 4 crosses
 * ```
 *
 * — measured with every activator open and every breakable rock broken, so
 * every OTHER opener in both rooms is already given away. L42 is the pure
 * case: it holds two crushers, one orb, one teleporter and the part, and
 * **no activator and no presser at all**. There is nothing else it could
 * be.
 *
 * ⛔⛔ **AND `tset -1` MEANS THE OPPOSITE OF WHAT IT MEANS ON A `Lock`.**
 * `Crusher.update` opens `if (activate || t == -1)` — a crusher in group -1
 * is ALWAYS ON. `Lock.check`'s `tSet < 0` is the kill-lock sentinel ("opens
 * when `Game.totalEnemies() <= 0`"). Same literal, two meanings, one class
 * apart, and both are in this cluster.
 *
 * ⛓ **THE MOTION, TRANSCRIBED BUT NOT BUILT.** Stationary, it snaps to the
 * tile grid and probes: `collideLine("Solid", x, y, p.x, p.y)` with its own
 * `type` temporarily set to `"BS"` so it does not block its own sight line;
 * if the line is clear it tests four rects — its 32x32 body grown by
 * `intDist` = 64 along each axis — and charges at 1 px/tick down whichever
 * one holds the player, until `moveX`/`moveY` hits a Solid and zeroes `v`.
 * ⚠ The direction loop has no `break`, so the LAST matching direction wins
 * ([[feedback_nested_dispatch_reuses_accumulator]]).
 *
 * ⛔⛔ **AND THE LADDER'S VERDICT AND THE LEVEL'S SOLUTION ARE THE SAME
 * VOLUME.** `hazards.hazardVolume` prices a crusher as HARD-AVOID over
 * exactly that plus of four lanes — correctly, at damage 1000 ("KILL
 * EVERYTHING", `Crusher.as:33`), where a contact is `die()` at any
 * `hitsMax`. The only way past one is to stand in a lane ON PURPOSE and
 * spend its charge. A route cannot satisfy the ladder and solve the room,
 * and which of the two gives is a RULING rather than a derivation.
 */
export const L41_L42_RECON = Object.freeze({
    /** The single mechanic between the route and totemparts 3 and 4. */
    blocker: 'crusher-motion',
    conflict: '⛔ hard-avoid is correct AND the charge is the solution — a ruling, not a '
        + 'derivation. The next slice cannot route either room without deciding it.',
    levels: Object.freeze([
        Object.freeze({
            level: 41,
            boot: Object.freeze({ x: 16, y: 160 }),
            from: 'L40 teleporter@944,96',
            part: 3,
            at: Object.freeze({ x: 240, y: 144 }),
            cells: Object.freeze({ withCrusher: 352, without: 408 }),
            why: 'every other opener is modelled and given away in the measurement — '
                + '`button@176,176 {t 1}` opens `wandlock@240,96`, `button@248,232 {t 0}` '
                + 'opens `cover@112,128`, and both `breakablerock`s are broken. What is '
                + 'left is `crusher@240,64`, sitting on the room\'s east exit.',
        }),
        Object.freeze({
            level: 42,
            boot: Object.freeze({ x: 240, y: 320 }),
            from: 'L40 teleporter@848,0',
            part: 4,
            at: Object.freeze({ x: 184, y: 152 }),
            cells: Object.freeze({ withCrusher: 304, without: 356 }),
            why: '⛓⛓ THE PURE CASE: L42 holds two crushers, one orb, one teleporter and '
                + 'the part, and NO activator and NO presser at all. The two crushers '
                + 'are the wall between the arrival corridor and the part\'s chamber, '
                + 'and there is nothing else the answer could be.',
        }),
    ]),
    /**
     * ⚠⚠ THE TRAP THIS MEASUREMENT NEARLY FELL INTO, recorded because the
     * wrong answer was convincing. Filtering `world.solids` AFTER
     * `buildLevelWorld` is a NO-OP — `collidesSolid` closes over the list
     * it was built with — so the first run of this comparison reported
     * "deleting the crushers changes nothing", which reads exactly like
     * "the crusher is not the wall". The stand-in has to be applied to the
     * SOURCE RECORD. A stand-in that silently does nothing and a mechanic
     * that genuinely does nothing are the same output.
     */
    standInMustBe: 'the level record, not `world.solids`',
});

/**
 * ── ⛓⛓ R5 SLICE 14: L41's SHIELD, ASSERTED AGAINST THE LEVEL ─────────
 *
 * §25.6 named the gap in its own words: *"L41's 'breaking the rocks
 * unleashes it' is asserted on the SIGHT MODEL, not on the level — the
 * shield test uses a CONSTRUCTED solid, and the L41 census check only
 * confirms the rocks exist."* Closed here, with L41's own solids:
 *
 * ```
 *   player (200,80), rocks standing   dir null, shielded by breakablerock@224,80
 *   the same player, rocks gone       dir W
 *   player (256,120) or (256,140)     shielded by `tile:Blue Wall`, BOTH ways
 * ```
 *
 * ⇒ **the ORDER §24.6 predicted is real**, and one more thing it did not:
 * the SOUTH lane is shielded by the room's own wall whatever the rocks do,
 * so the bait has to come from the WEST. A verb that assumed any lane would
 * serve would have been baiting a crusher that cannot see it.
 *
 * ⚠⚠ AND THE MEASUREMENT WAS WRONG TWICE BEFORE IT WAS RIGHT, both times
 * the same way: `collideLineSolid` reads `s.x/s.y/s.right/s.bottom` and a
 * `world.solids` entry carries its box on `.rect`, while `scanCrusher`'s
 * lane test needs a player BOX and not an `{x, y}`. Both wrong shapes
 * returned *"dir null, shieldedBy null, matched []"* — a clean, plausible
 * "the crusher does not see you", which is the answer a route would have
 * been built on. [[feedback_rect_literal_never_overlaps]], twice in one
 * probe.
 */
export const L41_SHIELD = Object.freeze({
    level: 41,
    crusher: Object.freeze({ id: 'crusher@240,64', rect: Object.freeze({ x: 240, y: 64, right: 272, bottom: 96 }) }),
    /** The two `breakablerock`s that stand between it and the west lane. */
    rocks: Object.freeze(['breakablerock@224,64', 'breakablerock@224,80']),
    /** A player in the west lane, 40 px out. */
    baitFrom: Object.freeze({ x: 200, y: 80 }),
    shieldedBy: 'breakablerock@224,80',
    unshieldedDir: 'W',
    /**
     * ⛔ AND THE SOUTH LANE IS SHIELDED BY THE ROOM. Both probe points
     * report `tile:Blue Wall` with the rocks standing AND gone — so the
     * crusher can only ever be baited westward, and `totempart 3` is on the
     * other side of that.
     */
    southBlocked: 'tile:Blue Wall',
    /**
     * ⛔⛔ NOT DRIVEN. `crusher.js` models the scan, the charge and the
     * park, and `levelRun` steps NO crusher: the class needs a per-visit
     * state family, a step at the top of the tick, and its moving box in
     * `collidesSolid` / `plannerBlockerAt` / `stepV2` — the `burnedTrees`
     * plumbing chain again, for a solid that MOVES. Until then
     * `hazards.hazardVolume` keeps returning `hard-avoid` and
     * `totempart 3` / `totempart 4` are unreachable: flooded from each
     * room's boot with every activator open and every rock broken, NEITHER
     * part is in the component (L41 356 nodes, L42 304).
     */
    driven: false,
});

/**
 * ── ⛓⛓⛓ R5 SLICE 15: L41 IS SOLVED, AND THE CRUSHER IS THE KEY THAT
 *    OPENS IT ────────────────────────────────────────────────────────────
 *
 * §24.6 measured that `totempart 3` "crosses on the crusher alone" and read
 * that as an obstacle. It is an obstacle AND it is the room's only usable
 * machine, and the second half is what makes the room solvable at all.
 *
 * ── THE TWO WALLS, and why neither yields to the player alone ─────────
 *
 * The part's chamber is rows 7-10 x cols 14-16 and it has exactly ONE
 * opening: `(15,6)` -> `(15,5)`. `(15,6)` is `wandlock@240,96 {t 1, tag 0}`
 * and `(15,4)/(15,5)/(16,4)/(16,5)` are the crusher's own constructor body.
 * So the route needs BOTH gone, and:
 *
 *   ⛔ THE WANDLOCK RE-CLOSES THE TICK ITS BUTTON IS RELEASED.
 *     `Lock.activationStep`'s else arm runs `returnToNormal()` unless
 *     `collideTypes(["Player","Enemy","Solid"], x, y)` finds something in
 *     its own cell — and the player cannot be both on `button@176,176`
 *     and in the doorway. So a SOLID has to hold that button, and the only
 *     one that can reach it is `pushableblockfire@112,144`.
 *   ⛔ THE BLOCK CANNOT MOVE UNTIL THE COVER OPENS. Its cell `(7,9)` is
 *     walled east and west; the only push stance is `(7,8)`, which IS
 *     `cover@112,128 {t 0}`.
 *   ⛔ AND THE COVER RE-CLOSES THE TICK ITS BUTTON IS RELEASED, by the same
 *     shape — `Cover.update`'s else arm calls `reset()` unless something
 *     that is not a `Chest` is standing in it. Its button is
 *     `button@248,232` at tile `(15,14)`, eight tiles from the cover.
 *
 * ⇒ TWO BUTTONS THAT BOTH NEED A SOLID ON THEM, ONE BLOCK, AND THE BLOCK
 * IS BEHIND THE FIRST OF THEM.
 *
 * ── ⛓⛓⛓ THE ANSWER: THE CRUSHER PRESSES THE COVER'S BUTTON ───────────
 *
 * `Button.update` collides `["Player","Enemy","Solid"]` and excludes only a
 * `Cover`. A `Crusher` is `type = "Solid"`. Baited three times it walks
 * itself from `(256,80)` to `(256,240)` — which is ON `button@248,232` —
 * and parks there permanently, because from that cell every lane it can
 * still see is walled:
 *
 * ```
 *   bait 1  W   (256,80) -> (64,80)    rocks broken; the west lane is the
 *                                      only one a living player can stand in
 *   bait 2  S   (64,80)  -> (64,240)   from cols 3-4, the one column pair
 *                                      whose row 6 is open
 *   bait 3  E   (64,240) -> (256,240)  along rows 14-15, onto the button
 * ```
 *
 * ⛓ AND THE FIRST BAIT IS ALSO WHAT CLEARS THE DOORWAY, so the same three
 * moves solve both walls. The crusher is not in the way of the solution; it
 * IS the solution, which is `CRUSHER_VERBS.park` doing work no other object
 * in the room can do. ⇒ `hazardVolume`'s hard-avoid is retired on a driven
 * witness, not on a source read.
 *
 * ⚠ AND IT CREATES A STANDING ROUTE CONSTRAINT. Parked on the button the
 * crusher still re-scans every tick: its WEST lane is cols 11-16 of rows
 * 14-15. A later leg that walks there charges it OFF the button and the
 * cover shuts. `AVOID_AFTER_BAIT3` is that volume, named.
 */
export const L41_PART3 = Object.freeze({
    level: 41,
    /** From L40's `teleporter@944,96`. */
    arrival: Object.freeze({ tx: 1, ty: 10 }),
    part: Object.freeze({ x: 240, y: 144, index: 3 }),
    crusher: 'crusher@240,64',
    rocks: Object.freeze([
        Object.freeze({ id: 'breakablerock@224,64', tag: 1 }),
        Object.freeze({ id: 'breakablerock@224,80', tag: 2 }),
    ]),
    block: 'pushableblockfire@112,144',
    cover: Object.freeze({ id: 'cover@112,128', t: 0, button: Object.freeze({ x: 248, y: 232 }) }),
    wandlock: Object.freeze({
        id: 'wandlock@240,96', t: 1, tag: 0, button: Object.freeze({ x: 176, y: 176 }),
    }),
    /**
     * ⛓ The three parks, as ENTITY positions — what `run.crushers` reports
     * and what `bait.park` asserts. A park is a POSITION because phase 2's
     * flood is taken against it.
     */
    parks: Object.freeze([
        Object.freeze({ dir: 'W', to: Object.freeze({ x: 64, y: 80 }) }),
        Object.freeze({ dir: 'S', to: Object.freeze({ x: 64, y: 240 }) }),
        Object.freeze({ dir: 'E', to: Object.freeze({ x: 256, y: 240 }) }),
    ]),
    /**
     * ⛓⛓⛓ THE THREE CHOREOGRAPHIES, SEARCHED AND DRIVEN — phase 1 of
     * `CRUSHER_PLAN`, as spans rather than as a plan.
     *
     * They are DATA and not a planner output because the planner is not
     * allowed to route against a live mover: each of these is verified tick
     * by tick against the same `stepCrusher` the run steps, and the claim is
     * `crusherContacts.length === 0` plus a park POSITION.
     *
     * ⚠ THE MARGIN IS THIN AND IT IS NOT SPEED. A walking player tops out at
     * 1.2 px/tick against the crusher's 1.0, so a straight retreat gains
     * 0.2 px/tick — the escape is the PERPENDICULAR step, because a charge
     * is committed at rest and never re-aimed. Measured: bait 3 with
     * `down 50` instead of `down 40` is run over 36 times.
     *
     * ⛓ Bank 1's prefix is the boot at (208,80) — tile (13,5), the swing
     * stance's own cell — with both rock tags declared clear, which is the
     * state the swing leaves.
     *
     * ── ⛔⛔ R5 SLICE 16: `approach` / `spans`, AND THE SPLIT IS NOT
     *    COSMETIC ────────────────────────────────────────────────────
     *
     * Slice 15 banked each of these as one flat span list and drove them
     * from a `describe` block, where "the crusher is awake" was never
     * anybody's precondition. `botDriverV2.runBait` demanded the player be
     * INSIDE a lane at the tick the verb starts — and baits 2 and 3 cannot
     * satisfy that, because for them **the approach IS the trigger**: the
     * stance they are driven to is deliberately outside the lane (standing
     * in it would have the crusher charging before the leg is ready) and
     * the first span is the step that enters it. So each choreography now
     * declares which of its spans present the player (`approach`) and which
     * get them out again (`spans`), and the verb's positive control moved
     * from *predicting* the scan to *observing* the commit.
     *
     * ⛓ `stance` is the player's ENTITY position when the bait begins,
     * MEASURED — it is the previous bait's own resting cell, so the drive
     * to it costs ZERO ticks and the emitted stream is span-for-span what
     * `r5Totem.test.js` has driven since slice 15. The plan asserts that
     * zero, because a stance that cost the walk even one tick would be a
     * choreography starting from somewhere its search never saw.
     */
    baits: Object.freeze([
        Object.freeze({
            dir: 'W',
            from: Object.freeze({ x: 256, y: 80 }),
            park: Object.freeze({ x: 64, y: 80 }),
            /** The boot cell (208,80) — the entity is a half-tile in. */
            stance: Object.freeze({ x: 216, y: 88 }),
            approach: Object.freeze([
                Object.freeze({ key: 'left', ticks: 21 }),
            ]),
            spans: Object.freeze([
                Object.freeze({ key: 'down', ticks: 40 }),
                Object.freeze({ key: null, ticks: 160 }),
            ]),
            why: 'the west lane is the only one a living player can stand in — the north '
                + 'and east are the room\'s own wall and the south is behind the wandlock. '
                + 'The escape is SOUTH at col 11, the one column of row 6 that is open '
                + 'west of the rocks.',
        }),
        Object.freeze({
            dir: 'S',
            from: Object.freeze({ x: 64, y: 80 }),
            park: Object.freeze({ x: 64, y: 240 }),
            stance: Object.freeze({ x: 185.795, y: 135.999 }),
            approach: Object.freeze([
                Object.freeze({ key: 'left', ticks: 40 }),
                Object.freeze({ key: 'down', ticks: 22 }),
                Object.freeze({ key: 'left', ticks: 70 }),
                Object.freeze({ key: 'up', ticks: 10 }),
            ]),
            spans: Object.freeze([
                Object.freeze({ key: 'down', ticks: 20 }),
                Object.freeze({ key: 'right', ticks: 40 }),
                Object.freeze({ key: null, ticks: 220 }),
            ]),
            why: 'cols 3-4 are the only column pair whose row 6 is open, so they are the '
                + 'only south lane the crusher can actually travel. The trigger is one '
                + 'step NORTH into row 9 and the escape is back south to row 10 and EAST '
                + 'out of the column.',
        }),
        Object.freeze({
            dir: 'E',
            from: Object.freeze({ x: 64, y: 240 }),
            park: Object.freeze({ x: 256, y: 240 }),
            stance: Object.freeze({ x: 104.969, y: 182.370 }),
            approach: Object.freeze([
                Object.freeze({ key: 'down', ticks: 40 }),
            ]),
            spans: Object.freeze([
                Object.freeze({ key: 'up', ticks: 12 }),
                Object.freeze({ key: null, ticks: 260 }),
            ]),
            why: '⛓⛓⛓ THE ONE THAT SOLVES THE ROOM: it ends ON `button@248,232`, and a '
                + 'Crusher is a `"Solid"` that `Button.update` collides. The escape is '
                + 'NORTH to row 13, and `down 50` instead of `down 40` is run over.',
        }),
    ]),
    /**
     * ⛔ THE VOLUME THE ROUTE MAY NOT RE-ENTER once bait 3 has landed: the
     * crusher's WEST lane from `(256,240)`. Walking into it charges the
     * crusher off `button@248,232`, the cover resets, and — if the block is
     * not yet parked — the room is shut again.
     *
     * ⛓ IT IS THE ONLY ONE OF THE FOUR THAT MATTERS, and that is measured
     * rather than assumed. The north lane is `[240,272) x [160,256)` — tiles
     * 15-16 of rows 10-15 — and the part chamber's own floor runs to row 10,
     * so the collect walk passes within a tile of it; what keeps the chamber
     * cold is the room's wall across rows 11-13, which blocks `collideLine`
     * from `(256,240)` to every cell in there. The east and south lanes
     * leave the room. See `PARKED_SCAN_AUDIT`.
     */
    avoidAfterBait3: Object.freeze({ x: 176, y: 224, right: 272, bottom: 256 }),
    /**
     * ⛓ The block's route to `button@176,176`, in tiles. Six pushes, each
     * with the stance the player fires from. The first is the only one that
     * needs the cover; every later stance is a cell the block has left or a
     * corridor the level already had.
     */
    pushes: Object.freeze([
        Object.freeze({ from: [7, 9], to: [7, 10], stance: [7, 8] }),
        Object.freeze({ from: [7, 10], to: [8, 10], stance: [6, 10] }),
        Object.freeze({ from: [8, 10], to: [9, 10], stance: [7, 10] }),
        Object.freeze({ from: [9, 10], to: [9, 11], stance: [9, 9] }),
        Object.freeze({ from: [9, 11], to: [10, 11], stance: [8, 11] }),
        Object.freeze({ from: [10, 11], to: [11, 11], stance: [9, 11] }),
    ]),
    /** `Lock`'s fade — 101 continuous ticks, and the BLOCK is what holds it. */
    lockTicks: 101,
    /**
     * ⛓ The ceremony's stance, in tiles: the chamber cell NORTH of the part,
     * reached through the doorway `wandlock@240,96` has just opened.
     *
     * ⚠ IT IS ALSO THE ONE STANCE THE PARKED CRUSHER'S NORTH LANE ALMOST
     * REACHES. That lane is `[240,272) x [160,256)` — tiles 15-16 of rows
     * 10-15 — and the part chamber's floor runs to row 10, so the collect
     * walk passes within one tile of it. What keeps the whole chamber COLD
     * is not distance: it is the room's own wall across rows 11-13, which
     * blocks `collideLine` from (256,240) to every cell in there. Measured
     * tick by tick by `plan-seedling-r5-l41-part3.mjs`'s parked-scanner
     * audit, not argued from the rects.
     */
    collectStance: Object.freeze([15, 8]),
    /**
     * ⚠ THE FLOOD, WITH THE CONFIGURATION THAT PRODUCED IT (§28.4's rule,
     * applied to the thing this slice varies). Both taken from the same
     * post-bait-1 stance under the ROUTE's inventory.
     */
    flood: Object.freeze({
        policy: 'inventory: sword+fire+conch+feather; activators OPEN; rocks {1,2} clear',
        crusherHome: Object.freeze({ nodes: 305, partReachable: false }),
        crusherParkedWest: Object.freeze({ nodes: 332, partReachable: true }),
    }),
    /**
     * ⛓⛓⛓ R5 SLICE 16 — DRIVEN, END TO END, AND RECORDED AS A PAIR.
     *
     * `r5-l41-part3` / `-control`: 2,261 ticks, 146 spans, one field apart
     * (the control does not declare the two rock tags, so the rocks stand,
     * the crusher is shielded and the identical spans move it not one
     * pixel). `plan-seedling-r5-l41-part3.mjs` is the generator and its
     * claims are the record.
     */
    tapes: Object.freeze(['r5-l41-part3', 'r5-l41-part3-control']),
    driven: true,
});

/**
 * ⛔⛔⛔ L40 LINK 4 — MEASURED, AND THE ANSWER IS THAT IT DOES NOT OPEN.
 *
 * R5 slice 16 step 2. §28.9 named this the thing to price first and said
 * what would follow if it did not work out: *"whether L40's three blocks
 * can reach these two is unmeasured … if they cannot, the chain from the
 * arrival is not walkable and §24.5's ordering needs a FINDING rather than
 * a route."* It is measured now, three ways, and all three are no.
 *
 * ```
 *   button@480,384 {tset 2}       a PLAIN button — no `room`, no latch
 *     -> wandlock@448,432 {tag 9}   Lock, 101 continuous ticks
 *     -> wandlock@512,480 {tag 10}  Lock, 101 continuous ticks
 * ```
 *
 * ⛔ **1. NO BLOCK REACHES IT.** Pushed over the whole level with EVERY
 * activator group open, `pushableblockfire@480,480` reaches 27 tiles and
 * neither button is among them; the other two reach ONE tile each, their
 * own. (`button@768,400 {tset 5}` -> `wandlock@800,400 {tag 21}` is the same
 * shape and the same answer.) The shaft solved this shape by parking blocks
 * on buttons; L40 cannot.
 *
 * ⛓⛓ **2. THE PLAYER CAN HOLD IT — AND IT COSTS 101 TICKS EXACTLY.** Booted
 * onto the button and left standing, both Locks open and both write
 * persistence `false` on tick **101**, together. So the hold is not the
 * problem: `Lock`'s fade is, because the player is the only thing holding
 * the group and stepping off unpublishes it.
 *
 * ⛔⛔ **3. AND THE WRITE IS INERT, WHICH IS THE ONE THAT DECIDES IT.**
 * `Lock.turnOff()` writing `Game.setPersistence(tag, false)` looks like a
 * window-boundary answer — hold it in one window, boot the next with the
 * tags clear, walk through a room that rebuilt without the locks. It is
 * not: `PERSISTENCE_RESPONSE.wandlock` is `lock-despawn`, and `Lock.as:42`
 * despawns on a cleared tag **only when `tSet < 0`**. These are group 2.
 * `buildLevelWorld(40, {cleared: [9, 10]})` is byte-identical to the shut
 * build — 1,121 solids either way.
 *
 * ⇒ **THE ONLY REMAINING OPENER IS AN ENEMY.** `Button.update` collides
 * `["Player","Enemy","Solid"]`, L40 has no crusher, and no block can reach
 * the cell — so what is left is parking one of the room's twelve bobs, two
 * punchers, bobsoldier or bombpusher on it for 101 continuous ticks. That
 * needs enemy MOTION modelled (the model has spawn cells and threat volumes
 * and nothing else), and a `Bob`'s LOS test is commented out so it chases
 * through walls. ⚠ NOT ATTEMPTED, and named rather than assumed.
 */
export const L40_LINK4 = Object.freeze({
    button: Object.freeze({ id: 'button@480,384', tset: 2, tile: Object.freeze({ tx: 30, ty: 24 }) }),
    opens: Object.freeze([
        Object.freeze({ id: 'wandlock@448,432', tag: 9, tset: 2 }),
        Object.freeze({ id: 'wandlock@512,480', tag: 10, tset: 2 }),
    ]),
    /** The same shape one link along, measured with it. */
    alsoUnreachable: Object.freeze({ id: 'button@768,400', tset: 5, tile: Object.freeze({ tx: 48, ty: 25 }) }),
    /** `Lock`'s fade, driven from a boot onto the button: both write on tick 101. */
    holdTicks: 101,
    /**
     * ⛔ The push-graph over the whole level with every activator open —
     * a block may step to a free tile when the tile OPPOSITE is free for
     * the player to stand in. ⚠ Each block is flooded with the others
     * STATIC, which is the bound this measurement has.
     */
    pushReach: Object.freeze([
        Object.freeze({ id: 'pushableblockfire@480,480', tiles: 27, reachesAButton: false }),
        Object.freeze({ id: 'pushableblockfire@576,576', tiles: 1, reachesAButton: false }),
        Object.freeze({ id: 'pushableblock@576,560', tiles: 1, reachesAButton: false }),
    ]),
    /** ⛔ And the clear is INERT — `Lock.as:42` needs `tSet < 0` and these are 2. */
    clearIsInert: true,
    verdict: 'UNOPENABLE BY THIS RUNG\'S MEANS. No block reaches the button, the player '
        + 'cannot both hold it and walk through the door it opens, and the persistence '
        + 'write a `Lock` makes is inert for a grouped one — so a window boundary does '
        + 'not carry it either. What is left is an ENEMY parked on the button, which '
        + 'needs enemy motion modelled.',
});

/**
 * ⛔⛔⛔ L42 — THE PURE CASE, AND IT IS A PURSUIT LOOP.
 *
 * R5 slice 16 step 1. L41 has two gates, a block and a button; L42 has
 * **no activator, no presser and no pushable at all** — one part, two
 * crushers and a corridor. §24.6 called it the pure case and it is: the
 * only mechanism in the room is the two crushers, and the only verb is
 * BAIT.
 *
 * ```
 *   rows 9-10, cols 4..12          the corridor, 2 tiles tall
 *     cols 4,5    free             the west corridor's mouth
 *     cols 6,7    crusher@96,144   "A"
 *     cols 8,9    crusher@128,144  "B"
 *     cols 10-12  free             the part pocket — totempart 4 @184,152
 * ```
 *
 * Four tiles of crusher plug a two-tile-tall corridor whose free space is
 * 2 tiles west and 3 east, and the pocket has no other opening. The
 * player arrives at tile (15,20) from `L40 teleporter@848,0`.
 *
 * ── ⛓⛓ WHAT IS MEASURED, AND IT IS A LOT ─────────────────────────────
 *
 * ⛓ **EACH CRUSHER SHIELDS THE OTHER, AND THE SHIELDING IS THE ORDER.**
 * B can be seen from nowhere the player can stand: its north lane is
 * blocked by the row 7-8 wall, its south lane by the row 11-12 wall, its
 * east lane is inside the pocket, and its west lane is A. So A moves
 * first, always.
 *
 * ⛓ **A's ONLY SIGHT LINE IS FROM THE WEST**, and its charge chain from
 * there is DRIVEN: `up 7 / down 30 / right 120` from tile (4,11) walks it
 * **W then S then E** — three separate charges, 208 px of travel, 557
 * ticks, ZERO contacts — from (112,160) to (192,224). That is the first
 * multi-charge choreography on the arc and the first time a park has
 * armed the next charge by itself.
 *
 * ⛔⛔ **AND THAT IS THE PROBLEM: A PARK RE-ARMS A LANE ACROSS THE
 * PLAYER'S OWN ESCAPE.** Every one of A's resting cells puts one of its
 * four 64 px lanes down the corridor the player just fled into:
 *
 * ```
 *   park (80,160)  cols 4,5 rows 9,10    N lane rows 5-10  } the whole west
 *                                        S lane rows 9-14  } corridor
 *   park (80,224)  cols 4,5 rows 13,14   N lane rows 9-14, E lane cols 4-11
 *   park (192,224) cols 11,12 rows 13,14 W lane cols 7-12, S lane rows 13-18
 * ```
 *
 * So the room is not "move the obstacle" — it is a PURSUIT. Traced by
 * hand round the full loop, A chases the player south, east, south again
 * along row 17, west, north up column 6 and west again, and ends back in
 * the corridor it started in. ⚠ `Crusher` writes no persistence, so the
 * loop has no state and no exit condition other than the player's route.
 *
 * ⚖ **A COMPONENT SEARCH SAYS IT IS SOLVABLE IN SIX BAITS**, and the
 * sequence is symmetric — each crusher does the same W/S/E dance, and the
 * FIRST one's park at cols 11,12 is exactly what stops the second at cols
 * 9,10 instead of the wall. ⛔ But a component search is not a
 * choreography: its first cut "solved" the room by letting the player
 * finish on the far side of a 32 px body moving down a 2-tile corridor,
 * and adding the swept volume was what made it honest.
 *
 * ⚠⚠ **NOT DRIVEN, AND NAMED AS THE MISS.** What is driven is A's chain
 * and nothing after it. What is unmeasured is whether the return leg —
 * the southern bypass at row 17, which A's park at (192,224) puts inside
 * its own south lane — can be walked at all, and whether L42's part is
 * meant to be taken WITHOUT the wand (L43 is the wand room and this rung
 * does not enter it).
 */
export const L42_PART4 = Object.freeze({
    level: 42,
    /** From `L40 teleporter@848,0 -> (240,320)`. */
    arrival: Object.freeze({ tx: 15, ty: 20 }),
    part: Object.freeze({ x: 184, y: 152, index: 4 }),
    crushers: Object.freeze([
        Object.freeze({ id: 'crusher@96,144', home: Object.freeze({ x: 112, y: 160 }) }),
        Object.freeze({ id: 'crusher@128,144', home: Object.freeze({ x: 144, y: 160 }) }),
    ]),
    /** ⛓ No activator, no presser, no pushable — the pure case. */
    openers: Object.freeze([]),
    /** The arrival flood with both crushers home: the part is not in it. */
    flood: Object.freeze({
        policy: 'inventory: sword+fire+conch+feather; crushers at their constructor cells',
        nodes: 304,
        partReachable: false,
    }),
    /**
     * ⛓⛓ A's THREE-CHARGE CHAIN, DRIVEN — `botDriverV2.runBait` with one
     * approach and three escapes, 0 contacts, park asserted.
     */
    chainA: Object.freeze({
        stance: Object.freeze({ tx: 4, ty: 11 }),
        approach: Object.freeze([Object.freeze({ key: 'up', ticks: 7 })]),
        spans: Object.freeze([
            Object.freeze({ key: 'down', ticks: 30 }),
            Object.freeze({ key: 'right', ticks: 120 }),
            Object.freeze({ key: null, ticks: 400 }),
        ]),
        charges: Object.freeze(['W', 'S', 'E']),
        park: Object.freeze({ x: 192, y: 224 }),
        ticks: 557,
        contacts: 0,
        /**
         * ⛓ The east park is NOT the room's east wall — it is the row-14
         * notch at cols 13,14. A crusher is 32 px tall and spans BOTH rows
         * of the corridor, so the lower row's wall stops it two tiles
         * short of the upper row's.
         */
        stoppedBy: 'tile:Blue Wall at (13,14)/(14,14) — the lower row of a 2-tile body',
    }),
    /**
     * ⚖ The component search's ordering, banked because it is what a
     * choreography would have to realise. Each entry is
     * `{crusher, dir, park}`; the two threes are the same dance.
     */
    orderingSearched: Object.freeze([
        Object.freeze({ id: 'crusher@96,144', dir: 'W', park: Object.freeze({ x: 80, y: 160 }) }),
        Object.freeze({ id: 'crusher@96,144', dir: 'S', park: Object.freeze({ x: 80, y: 224 }) }),
        Object.freeze({ id: 'crusher@96,144', dir: 'E', park: Object.freeze({ x: 192, y: 224 }) }),
        Object.freeze({ id: 'crusher@128,144', dir: 'W', park: Object.freeze({ x: 80, y: 160 }) }),
        Object.freeze({ id: 'crusher@128,144', dir: 'S', park: Object.freeze({ x: 80, y: 224 }) }),
        /** ⛓⛓ AND THE FIRST CRUSHER'S PARK IS THE SECOND'S WALL. */
        Object.freeze({ id: 'crusher@128,144', dir: 'E', park: Object.freeze({ x: 160, y: 224 }) }),
    ]),
    driven: false,
    miss: 'the six-bait ordering is a component result, not a choreography: only A\'s '
        + 'W/S/E chain is driven. What is unmeasured is the RETURN — the southern bypass '
        + 'at row 17 lies inside the south lane of A\'s own east park — and whether part '
        + '4 is meant to be taken without the wand at all.',
});

/**
 * ⛔⛔⛔ THE PARKED-SCANNER AUDIT — the check §29 did not name.
 *
 * §29.8 established that a park is a POSITION and not a state: a resting
 * `Crusher` re-derives `v` on every tick, so it is a live scanner sitting on
 * a button. `r5-l41-part3` then spends **1,307 ticks** after the third bait
 * doing six block pushes, a 160-tick wait, a walk the length of the room and
 * a 150-frame ceremony — every one of them beside it. One stance inside one
 * of its four 64 px lanes with a clear sight line and it charges off
 * `button@248,232`, `cover@112,128` resets, and the room shuts with the
 * player inside it.
 *
 * So the tape is audited tick by tick, and the audit rides `runTape`'s OWN
 * loop (`createTapeStepper`, which now yields `run.crusherScans` — the scan
 * taken with the run's own solid list and the run's own two player shapes).
 *
 * ⛓⛓ TWO NUMBERS, AND THEY ARE DIFFERENT CLAIMS. `movedTicks` is the
 * MEASUREMENT — the crusher's entity position never leaves `(256,240)`, and
 * that fact is what the cover, the block chain and the ceremony all stand
 * on. `hotTicks` is the MECHANISM — `scan.dir` is null on every one of those
 * ticks, so the route is not surviving on a margin, it is outside the
 * volume. A leg with only the first would be a leg that got away with it.
 *
 * ⚠ `nearestWestLanePx` is a CLEARANCE and the lane test is INCLUSIVE
 * (§29.5, `Entity.as:263`'s four `>=`/`<=` where every other overlap in the
 * package is strict), so zero would mean INSIDE.
 */
export const PARKED_SCAN_AUDIT = Object.freeze({
    tape: 'r5-l41-part3',
    crusher: 'crusher@240,64',
    park: Object.freeze({ x: 256, y: 240 }),
    fromTick: 955,
    ticks: 1307,
    movedTicks: 0,
    hotTicks: 0,
    /** Inside a lane but shielded — safe on geometry that MOVES, so counted apart. */
    inLaneShieldedTicks: 0,
    nearestWestLanePx: 36.96,
    nearestAt: Object.freeze({ t: 1790, x: 137.31, y: 184.04 }),
});

/**
 * ⛔⛔ The two predictions, as data, so a test asserts the CORRECTION
 * rather than the current string.
 */
export const L40_PREDICTIONS = Object.freeze([
    Object.freeze({
        id: 'buttonroom-latch-opens-the-wandlocks',
        from: '§20.6',
        verdict: 'MECHANISM CONFIRMED, NOT DRIVABLE FROM THIS ARRIVAL',
        why: 'the `room = -1` latch is real and modelled, and none of the three '
            + 'buttonrooms is in the arrival flood — opening groups 0 and 1 adds zero '
            + 'cells',
    }),
    Object.freeze({
        id: 'keytype-2-boss-key-is-not-collected',
        from: '§20.6',
        verdict: 'REFUTED AT SOURCE',
        why: '`BossLock.as:31` hard-wires the `Activators` group to -1 (`_t` is the key '
            + 'type, one argument to its left), so `buttonroom@272,208`\'s t = 0 publish '
            + 'cannot reach it. The model had it in group 0 — a wall it opened that the '
            + 'game keeps shut. See `levelWorld.FORCED_TSET`.',
        was: 'the walk should NOT collect `bosskey@656,528`',
    }),
]);

/**
 * ⛔⛔⛔ L40's CHAIN IS BROKEN AT LINK 4 — R5 slice 17 step 1.
 *
 * §28.9 named link 4 as the thing to price first and said what would follow
 * if it did not work out: *"if they cannot, the chain from the arrival is
 * not walkable and §24.5's ordering needs a FINDING rather than a route."*
 * Slice 16 measured that `button@480,384 {t 2}` cannot be opened by this
 * rung's means (`L40_LINK4`, three ways, all no). This is the other half:
 * what that costs.
 *
 * ⛓⛓ **THE STEP-17 BRIEF READ IT AS A SCHEDULING PROBLEM** — the plain
 * button's opening exists only while held, so the hold and its consumer
 * must share one window. That framing has an escape hatch: §24.5 numbers
 * the links by the order a WALK MEETS them, not by dependency, so link 4
 * might be a cul-de-sac and there might be no consumer to schedule. This
 * probe went looking for that hatch. Measured:
 *
 * ```
 *   links 1-3 open, link 4 SHUT     828 cells
 *     button@768,400 {t 5}   ⛔        button@816,400 {t 4}   ⛔
 *   links 1-3 + link 4             1036 cells   (+208)
 *     both buttons           ⛓
 *   EVERY activator open except link 4's two   1784 cells, both buttons ⛔
 * ```
 *
 * ⛔⛔ **SO THE ORDERING IS A DEPENDENCY AFTER ALL, AND LINK 4 IS THE
 * UNIQUE GATE.** `button@816,400 {t 4}` is what arms `pulser@592,576`; the
 * pulse is the only thing that moves `pushableblockfire@576,576` off the
 * boss-key chamber's approach (a fire press from the south drives it NORTH
 * into the plain block, and the cell east of it is the pulser itself). So
 * the whole tail hangs off it:
 *
 *     link 4 -> links 5, 6 -> link 7 -> link 8 -> link 9 (the key)
 *            -> link 10 (the bosslock) -> BOTH north teleporters
 *
 * ⇒ **`bosskey@656,528`, `bosslock@480,352`, `teleporter@944,96 -> L41` and
 * `teleporter@848,0 -> L42` are UNREACHABLE FROM THE L40 ARRIVAL BY THIS
 * RUNG'S MEANS.** And the break is at link 4 and NOWHERE else: granted
 * links 5-8 by fiat, everything after them closes (1,624 cells, key,
 * bosslock, both north doors, the NW cluster).
 *
 * ⚠ THIS DOES NOT MAKE PARTS 3 AND 4 UNPROVABLE. `r5-l40-part0` already
 * boots into a cluster its own arrival cannot reach and says so out loud
 * (§28.5), and `r5-l41-part3` / `r5-l42-part4` do the same. What it means
 * is that the window that collects them cannot BEGIN at `L40 (480,896)`,
 * and no amount of scheduling fixes that — which is a different sentence
 * from "the parts are not collected", and both are true.
 */
export const L40_ARRIVAL_BREAK = Object.freeze({
    level: 40,
    lattice: 8,
    policy: 'inventory sword+fire+conch+feather; burnabletree tag 0 cleared at build; '
        + 'chest@880,816 opened; avoidVolumes off',
    /** Links 1-3 open, link 4 shut. */
    withoutLink4: 828,
    /** …plus link 4's two `Lock`s by fiat. */
    withLink4: 1036,
    gain: 208,
    /** ⛔ The two the chain continues through, and both are inside the +208. */
    gatedButtons: Object.freeze([
        Object.freeze({ id: 'button@768,400', tset: 5, link: 5 }),
        Object.freeze({ id: 'button@816,400', tset: 4, link: 6, arms: 'pulser@592,576' }),
    ]),
    /** ⛓⛓ The NECESSITY arm — every OTHER activator open and still no. */
    everyOtherActivator: Object.freeze({ cells: 1784, gatedButtonsReached: false }),
    /** With links 5-8 granted by fiat, the tail closes and nothing else breaks. */
    pastLink4: Object.freeze({
        keyCells: 892, keyReached: true,
        afterBosslock: 1624, l41Door: true, l42Door: true, nwCluster: true,
    }),
    verdict: 'THE CHAIN FROM THE L40 ARRIVAL STOPS AT LINK 4. One plain button, whose '
        + 'opening exists only WHILE HELD, whose persistence write is inert because its '
        + 'group is 2, and which no block in the level can reach, gates every remaining '
        + 'link — so the boss key, the bosslock and both north teleporters are '
        + 'unreachable from (480,896) by this rung\'s means. The parts behind them are '
        + 'still collectable from their own boots; the ROUTE is not.',
});

/**
 * ⛓⛓⛓ R5 SLICE 19 — THE CORPSE-HOLD, PRICED FROM THE SOURCE LOOP, AND
 * NOTHING OF IT IS WIRED.
 *
 * `L40_ARRIVAL_BREAK` located the break at link 4: `button@480,384 {tset 2}`
 * has no block that can reach it and its `Lock.turnOff` write is inert for
 * a grouped lock, so the only Solid in the level that could hold it down is
 * the one the room makes — a dead `IceTurret`. `death()` intercepts the
 * first `destroy`, shrinks the hitbox to 16x16, plays "dead" and pushes
 * `Enemy`/`Player` into `solids`; `update()` then sets `type = "Solid"` on
 * the first tick the player is NOT standing in it.
 *
 * ⚠ THIS IS A MEASUREMENT, NOT A BUILD. `probe-seedling-r5-l40-corpse.mjs`
 * TRANSCRIBES `IceTurret.input()` and `Mobile.mobileUpdate()` as a loop and
 * steps them; no corpse exists in `levelRun`, `fire.bumps` does not exist,
 * and no route consults any of this. It is what a build has to reproduce.
 *
 * ⛓⛓⛓ THE REST POSITION IS A TWO-CYCLE, NOT A FIXED POINT. `input()`
 * derives `cTile` with `Math.round(x / Tile.w)` and snaps a stationary axis
 * with `Math.floor(x / Tile.w) * Tile.w + Tile.w/2`. At a tile centre those
 * disagree — `round(30.5)` is 31, `floor` is 30 — so a standing body
 * oscillates `(488,423.5) <-> (487.5,424)` forever.
 *
 * ⛔⛔⛔ AND `bump` READS THE SAME `round`, SO WHICH WAY A PRESS MOVES THE
 * BODY DEPENDS ON THE TICK. On one half of the cycle a `tTile - 1` target
 * is a whole tile away and a `tTile + 1` target is satisfied by the next
 * tick; half a pixel later it is the other way round. Measured, phase 0
 * moves NORTH and EAST and phase 1 moves SOUTH and WEST — 16 px in 32 ticks
 * of motion, observed on the 33rd. ⇒ **a fire press's tick PARITY is
 * load-bearing**, which no press verb in this driver has ever had to
 * express.
 *
 * ⛔⛔ AND §32.6's FIFTH CORRECTION IS WRONG. It read `super.update()`
 * sitting above `IceTurret.update()`'s `if (Game.freezeObjects) return;` and
 * concluded the corpse glides through a ceremony. `super.update()` is
 * `Enemy.update()`, whose own `super.update()` is `Mobile.mobileUpdate()` —
 * and THAT method wraps `friction(); input(); moveX(); moveY();` in
 * `if (!Game.freezeObjects)`. The gate is one level down, not absent, so a
 * glide PAUSES for a ceremony. What genuinely runs above every gate is
 * `Enemy.update()`'s terrain switch (water and lava set `destroy`) and its
 * pit descent — a claim about DYING, not about moving.
 */
export const L40_CORPSE = Object.freeze({
    level: 40,
    turret: Object.freeze({ id: 'iceturret@472,400', oel: Object.freeze({ x: 472, y: 400 }) }),
    /** `super(_x + Tile.w, _y + Tile.h)` — a WHOLE tile, and a tile CORNER. */
    spawn: Object.freeze({ x: 488, y: 416 }),
    /** ⛓ Where it actually STANDS: `input()` snaps a stationary axis to a centre. */
    restCycle: Object.freeze([
        Object.freeze({ x: 488, y: 423.5 }),
        Object.freeze({ x: 487.5, y: 424 }),
    ]),
    /** ⛔⛔⛔ Which pushes move it, per phase of that cycle. */
    pushesByPhase: Object.freeze([
        Object.freeze({ phase: 0, at: Object.freeze({ x: 488, y: 423.5 }), moves: Object.freeze(['E', 'N']) }),
        Object.freeze({ phase: 1, at: Object.freeze({ x: 487.5, y: 424 }), moves: Object.freeze(['S', 'W']) }),
    ]),
    /** 16 px at 0.5 px/tick; the loop OBSERVES the arrival on the tick after. */
    glideTicks: 32,
    arrivalObservedAt: 33,
    /** ⛓ A push that the phase refuses arrives in two ticks, having moved 0.5 px. */
    noOpTicks: 2,
    target: Object.freeze({ id: 'button@480,384', tset: 2, rect: Object.freeze({ x: 484, right: 492, y: 389, bottom: 395 }) }),
    /** ⛓ Two northward presses, on the phase that moves north. */
    presses: 2,
    corpseEndsAt: Object.freeze({ x: 488, y: 391.5 }),
    /**
     * ⛔ THE FREEZE GATE, CORRECTED. §32.6 item 5 said the corpse glides
     * through a ceremony; `Mobile.mobileUpdate` gates `input()` and both
     * moves, so it does not. What is ungated is `Enemy.update()`'s terrain
     * switch and pit descent.
     */
    freeze: Object.freeze({
        motionGated: true,
        gatedIn: 'Mobile.mobileUpdate — `if (!Game.freezeObjects) { friction(); input(); moveX(); moveY(); }`',
        ungatedAbove: 'Enemy.update() — the water/lava `getState()` switch (sets `destroy`) '
            + 'and the `fallInPit` descent (moves, spins and fades)',
        corrects: '§32.6 item 5',
    }),
    wired: false,
    next: 'a corpse in `levelRun` and a `fire.bumps` verb, both driven — and the verb has '
        + 'to be able to say WHICH TICK it fires on, because the push direction is a '
        + 'property of the parity and not only of the stance.',
});

/**
 * ⛓⛓⛓ L42 IS SOLVED, AND THE SOLUTION IS NORTHWARD — R5 slice 17 step 0.
 *
 * §30.8 read L42 as a PURSUIT and banked a six-bait ordering from a
 * component search (`L42_PART4.orderingSearched`). That ordering clears the
 * corridor and it is not a solution, because the room's cost is not the
 * reach — it is the ROUND TRIP:
 *
 *     arrival (15,20)  ->  totempart 4 @184,152  ->  teleporter@240,336
 *
 * and the teleporter is one tile below the arrival. Priced that way, the
 * banked ordering is a FAILED STATE: both crushers finish in the row-13/14
 * corridor (cols 9,10 and 11,12), which is the only way from the west
 * corridor back to the col-15 shaft, and the row-17 bypass rejoins it at
 * col 12 inside the same two bodies. The part is collected and the player
 * can never leave.
 *
 * ⛓⛓ **THE SOLUTION PARKS BOTH CRUSHERS IN THE TOP ROOM**, which is the
 * one part of the level nothing needs, and the search finds it blind:
 *
 * ```
 *   1-3  A  W -> (80,160)   S -> (80,224)   E -> (192,224)
 *   4-6  B  W -> (80,160)   N -> (80,96)    E -> (240,96)
 *   7-9  A  W -> (80,224)   N -> (80,96)    E -> (208,96)
 * ```
 *
 * — nine charges in THREE chains, each chain one `bait` verb whose every
 * escape lands in the lane of the next (§30.8's shape, three times over).
 * A's first three are the banked ordering's own moves; the last three take
 * it back out again, which is why the answer is nine and not six.
 *
 * ⛓⛓⛓ **AND THE WHOLE THING TURNS ON ONE DEAD-END TILE.** The top room
 * (rows 5,6, cols 4..15) is exactly two tiles tall, a crusher is exactly
 * 32 px tall, and row 7 is solid across every column — so a player inside
 * an eastward charge in that room has NO lateral escape anywhere except
 * `(6,4)`, a one-tile nook off row 4 that leads nowhere. Both of the E
 * charges that park the crushers out of the way end with the player
 * standing in it.
 *
 * ⚠ THE SEARCH IS A PROPOSER, NOT AN ORACLE. It abstracts the escape's
 * TIMING away (see `probe-seedling-r5-l42-solver.mjs`'s header for the one
 * optimism and the three pessimisms), so what it returns is a candidate
 * ordering; `plan-seedling-r5-l42-part4.mjs` driving it through `runBait`
 * against the real `stepCrusher` is the check.
 */
export const L42_SOLVE = Object.freeze({
    level: 42,
    lattice: 8,
    /** ⛓ The safe flood is the FREE flood minus every cell a crusher can see. */
    arrival: Object.freeze({ freeNodes: 304, safeNodes: 172 }),
    /** The ONE cell that makes an eastward charge in the top room survivable. */
    nook: Object.freeze({ tx: 6, ty: 4 }),
    /**
     * ⛓ The part chamber cell WEST of `totempart@184,152`. The pickup's rect
     * is `[184,200) x [152,168)` — it straddles the col-11/12 boundary — and
     * col 12 of that chamber is inside A's parked SOUTH lane, so the collect
     * is walked from the west and touches the volume at `box.right == 184`,
     * eight pixels short of the lane.
     */
    collectStance: Object.freeze({ tx: 10, ty: 9 }),
    /**
     * ⛓⛓⛓ THE PARKS' WITNESS, AND IT IS THE WALK. A crusher's position is
     * in no readout the game emits (§30.4), so a park is asserted by where
     * the player is ALLOWED TO STAND. Both constructor bodies sit across
     * rows 9,10 at cols 6..9 — the only corridor to the part — so the route
     * walks through 32x32 of crusher twice, and the control arm, whose
     * bodies never move, stops against each one like a wall.
     */
    dipsticks: Object.freeze([
        Object.freeze({ tx: 6, ty: 9, of: 'crusher@96,144' }),
        Object.freeze({ tx: 8, ty: 9, of: 'crusher@128,144' }),
    ]),
    /** The top room, rows 5,6 — cols 4..15 free, and row 4 solid but for the nook. */
    topRoom: Object.freeze({ tx0: 4, tx1: 15, ty0: 5, ty1: 6 }),
    ordering: Object.freeze([
        Object.freeze({ id: 'crusher@96,144', dir: 'W', travel: 32, park: Object.freeze({ x: 80, y: 160 }), chain: 1 }),
        Object.freeze({ id: 'crusher@96,144', dir: 'S', travel: 64, park: Object.freeze({ x: 80, y: 224 }), chain: 1 }),
        Object.freeze({ id: 'crusher@96,144', dir: 'E', travel: 112, park: Object.freeze({ x: 192, y: 224 }), chain: 1 }),
        Object.freeze({ id: 'crusher@128,144', dir: 'W', travel: 64, park: Object.freeze({ x: 80, y: 160 }), chain: 2 }),
        Object.freeze({ id: 'crusher@128,144', dir: 'N', travel: 64, park: Object.freeze({ x: 80, y: 96 }), chain: 2 }),
        Object.freeze({ id: 'crusher@128,144', dir: 'E', travel: 160, park: Object.freeze({ x: 240, y: 96 }), chain: 2 }),
        Object.freeze({ id: 'crusher@96,144', dir: 'W', travel: 112, park: Object.freeze({ x: 80, y: 224 }), chain: 3 }),
        Object.freeze({ id: 'crusher@96,144', dir: 'N', travel: 128, park: Object.freeze({ x: 80, y: 96 }), chain: 3 }),
        Object.freeze({ id: 'crusher@96,144', dir: 'E', travel: 128, park: Object.freeze({ x: 208, y: 96 }), chain: 3 }),
    ]),
    /** Where the two bodies finish — the top room, cols 12,13 and 14,15. */
    parks: Object.freeze({ 'crusher@96,144': Object.freeze({ x: 208, y: 96 }), 'crusher@128,144': Object.freeze({ x: 240, y: 96 }) }),
    /** The player's own component at the end, with BOTH the part and the exit in it. */
    solved: Object.freeze({ safeNodes: 296, partReachable: true, exitReachable: true }),
    /** ⛔ The slice-16 ordering, priced for the return. */
    bankedOrderingPriced: Object.freeze({ safeNodes: 212, partReachable: true, exitReachable: false }),
    /**
     * ⛔⛔⛔ CHAIN 1 IS DRIVEN, AND ITS THIRD CHARGE ENDS IN THE WRONG
     * REGION — R5 slice 17's own limit, measured rather than suspected.
     *
     * The spans below are a beam search over 8-tick blocks driven through
     * the real `stepCrusher`: 216 ticks, 18 spans, **zero contacts**, and A
     * walks (112,160) -> (80,160) -> (80,224) -> (192,224) exactly as the
     * ordering asks. It is the first three-charge chain on the arc driven
     * to a SEARCHED park rather than a hand-traced one.
     *
     * ⛔ And the player finishes at tile (15,13), on the far side of it.
     * A's east charge from `(80,224)` has exactly two escapes: SOUTH at col
     * 6 — the only southern exit from its 64 px east lane, worth `x - 98`
     * ticks of margin, so between 2 and 12 — or EAST, outrunning the body
     * along row 13. Every candidate the search found took the second, and
     * row 14 is wall at cols 13,14, so the parked body plugs the only way
     * back west and the part is on the other side.
     *
     * ⚠ NOT FOUND IS NOT IMPOSSIBLE, and the bound is stated rather than
     * implied: two beams — 48 wide over 8-tick blocks, which EXHAUSTED at
     * depth 27 (every candidate that parked A did so eastward), and 64 wide
     * over 4-tick blocks, stopped at depth 32 — with zero contacts and zero
     * throws in both, found no escape ending in the west region. The
     * southern escape is a ~10 px window in one 16 px tile, which is
     * exactly the size a block search steps over.
     */
    chain1: Object.freeze({
        crusher: 'crusher@96,144',
        boot: Object.freeze({ level: 42, x: 80, y: 176 }),
        spans: Object.freeze([
            Object.freeze({ key: 'up+left', ticks: 8 }), Object.freeze({ key: 'down+right', ticks: 8 }),
            Object.freeze({ key: 'down+left', ticks: 8 }), Object.freeze({ key: 'down+right', ticks: 40 }),
            Object.freeze({ key: 'up+right', ticks: 8 }), Object.freeze({ key: 'down+right', ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 8 }), Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }), Object.freeze({ key: 'down+right', ticks: 16 }),
            Object.freeze({ key: 'right', ticks: 8 }), Object.freeze({ key: 'down+right', ticks: 16 }),
            Object.freeze({ key: 'up', ticks: 24 }), Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: 'down+right', ticks: 8 }), Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: 'right', ticks: 16 }), Object.freeze({ key: null, ticks: 8 }),
        ]),
        ticks: 216,
        contacts: 0,
        park: Object.freeze({ x: 192, y: 224 }),
        /** ⛔ tile (15,13) — east of the parked body, and row 14 is wall at cols 13,14. */
        playerEndsAt: Object.freeze({ x: 253.91395298868215, y: 210.00101520273768 }),
        endsInWestRegion: false,
    }),
    /**
     * ⛓⛓⛓ R5 SLICE 18 — THE ESCAPE IS THERE, AND CHAIN 1 ENDS **WEST**.
     *
     * §31.6 drove the ordering's first three charges to a park the search
     * chose and finished the player at tile (15,13), on the far side of the
     * body, and bounded its own negative: *"not found is not impossible…
     * a ~10 px window in one 16 px tile is exactly the size a block search
     * steps over."* It was not impossible, and the block was not what
     * stepped over it.
     *
     * The same three parks, from `L42_PART4.chainA`'s own hand-traced
     * stance and approach, with the escape RE-SEARCHED under a score that
     * names the target cell: **223 ticks, ZERO contacts, and the player
     * ends at tile (6,15)** — in the col-6 shaft, west of the parked body,
     * on the part's side of the room.
     *
     * ⛓ AND THE SEAM IT TURNS ON IS ONE PIXEL BETWEEN TWO CONVENTIONS.
     * A parked at (80,224) has body `[64,96) x [208,240)` and an east lane
     * `[64,160] x [208,240]`. `laneHitsPlayer` is INCLUSIVE (§29.5) and the
     * sweep's own overlap is STRICT — so a player box with `y == 240` is
     * SEEN from a cell the charging body passes one pixel above. The col-6
     * shaft is the only break in that corridor's floor inside the lane.
     *
     * ⛓ AND THE STANCE BAND'S WEST EDGE IS LAST-MATCH-WINS, NOT THE ROOM.
     * `DIRECTIONS` is E,N,W,S with no `break`; A's south lane is
     * `[64,96] x [208,304]`, so a box with `box.x <= 96` is charged at from
     * the SOUTH instead. ⇒ the band is entity `x ∈ [99,110]` — TWELVE
     * pixels, worth `box.x - 96 = x - 98` ticks of margin, 1 to 12.
     * ⛔ §31.6 wrote the band as `[98,110]` / 2..12; `x = 98` puts `box.x`
     * at exactly 96 and the inclusive south lane takes it.
     *
     * ⛓ The final stance is 0.09 px outside A's new WEST lane, and that is
     * MEASURED rather than reasoned: after 300 idle ticks both crushers'
     * `scanCrusher` still returns null and the player has not moved.
     * ⛓ Inventory-independent: driven with and without the four grants,
     * byte-identical.
     */
    escape: Object.freeze({
        crusher: 'crusher@96,144',
        /** `L42_PART4.chainA`'s stance tile (4,11), as a game constructor cell. */
        boot: Object.freeze({ x: 64, y: 176 }),
        items: Object.freeze(['sword', 'fire', 'conch', 'feather']),
        approach: Object.freeze([Object.freeze({ key: 'up', ticks: 7 })]),
        spans: Object.freeze([
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: 'down+right', ticks: 16 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: 'down+right', ticks: 8 }),
            Object.freeze({ key: null, ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: null, ticks: 8 }),
            Object.freeze({ key: 'right', ticks: 8 }),
            Object.freeze({ key: null, ticks: 16 }),
            Object.freeze({ key: 'right', ticks: 16 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: null, ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: null, ticks: 72 }),
        ]),
        ticks: 223,
        contacts: 0,
        charges: Object.freeze(['W', 'S', 'E']),
        park: Object.freeze({ x: 192, y: 224 }),
        /** The third charge — the one §31.6 could only escape eastward. */
        chargeFrom: Object.freeze({ x: 80, y: 224 }),
        col: 6,
        band: Object.freeze({ x0: 99, x1: 110, margin0: 1, margin1: 12 }),
        stance: Object.freeze({ x: 105 }),
        playerEndsAt: Object.freeze({ x: 109.90917848745103, y: 240.10929777500078 }),
        endTile: Object.freeze({ tx: 6, ty: 15 }),
        endsInWestRegion: true,
        /** The parked body's own west face — the player's box.right is 111.91. */
        westOf: 176,
        idleTicks: 300,
        /** ⛓ Both `scanCrusher`s still null after the idle tail. */
        unseenAfterIdle: true,
    }),
    /**
     * ⛔⛔⛔ AND THE THREE ARMS SAY A POSITIVE IS A PROPERTY OF THE SEARCH,
     * NOT OF THE ROOM — INCLUDING THE ONE THE BRIEF ASKED FOR.
     *
     * §31.9 item 1 prescribed *"a 1-tick search of that charge alone"* on
     * the reading that a ~10 px window is what a block search steps over.
     * Same beam, same driver, same room, three settings — and the one that
     * finds the escape is the COARSEST, while the prescribed one dies:
     *
     *     8-tick, confined to col 6    FOUND at depth 26, 216 ticks
     *     4-tick, NOT confined         DIED  at depth 27,  108/108 RUN OVER
     *     1-tick, confined             DIED  at depth 243, 72/72 ALREADY SEEN
     *
     * ⛔ AND THE TWO DEATHS ARE DIFFERENT FAILURES, which is why the counts
     * are banked and not just the verdicts. The unconfined arm is refused
     * by the ROOM (every successor takes a contact — without the wall the
     * beam walks the player into the body). The 1-tick arm is refused by
     * ITSELF: 72 of 72 successors are states the frontier has already
     * expanded, zero run over, zero out of bounds — and re-run with an
     * EXACT signature in place of the rounded one it dies at the same depth
     * for the same reason. A beam over a MOVING world may not dedup across
     * depths on the world state alone: a crusher one tick from committing
     * and one that committed sixty ticks ago are the same `(x, y)`, so
     * *"wait one more tick"* is a move the search cannot express.
     *
     * ⇒ **a finer step is not a stronger search.** A block search's reach
     * is `block x depth`; shrinking the block shortens the horizon and
     * multiplies the ways two candidates look identical. What §31.6 was
     * missing was a score that knew where the escape was — a proposer's
     * problem, not a resolution one. ⇒ §31.9 item 3, one level up: a search
     * reports a property of the triple (score, granularity, constraint),
     * and naming only one of the three is how a negative gets the wrong
     * cause attached to it.
     */
    escapeArms: Object.freeze([
        Object.freeze({
            name: '8-tick blocks, confined to col 6', block: 8, confine: 112, width: 12,
            maxDepth: 40, exact: false, found: true,
            why: 'the answer, and the COARSEST arm run — 216 ticks after the approach, '
                + 'found at depth 26. The escape is a 12 px band and an 8 px block found '
                + 'it, which is the whole refutation of "the block stepped over it".',
        }),
        Object.freeze({
            name: '4-tick blocks, NOT confined', block: 4, confine: null, width: 12,
            maxDepth: 70, exact: false, found: false,
            why: '⛔ THE WALL IS DOING REAL WORK, and it is a claim about which escape is '
                + 'being ASKED FOR rather than about the room: unconfined, this score '
                + 'walks the player east into the body and every one of the 108 '
                + 'successors at the death takes a contact. ⛓ A separate, uncommitted '
                + 'run under a different score and a different prefix DID find the '
                + 'southern escape unconfined — which is the point: the wall, the block '
                + 'and the score are not separable, and only the triple has a verdict.',
        }),
        Object.freeze({
            name: '1-tick blocks, confined to col 6', block: 1, confine: 112, width: 8,
            maxDepth: 250, exact: false, found: false,
            why: '⛔⛔ THE ARM §31.9 ASKED FOR, AND IT IS THE ONE THAT DIES — at the tick '
                + 'the crusher parks, with 72 of 72 successors ALREADY SEEN and none '
                + 'refused by the room. Re-run with an EXACT signature it dies at the '
                + 'same depth for the same reason, so the rounding is not the cause: '
                + 'dedup across depths on a time-varying world is.',
        }),
    ]),
    /**
     * ⛓⛓⛓ R5 SLICE 18 — CHAIN 2, DRIVEN BEHIND THE PLANNER'S OWN WALK.
     *
     * §31.9 item 2: *"chain 2's search has to run behind the tape
     * `synthesizeLegs` actually emits, not behind a boot at the stance
     * tile."* It does — the prefix for this search is the 548-tick tape the
     * planner emits for `arrival -> chain 1 -> stance`, so the beam runs
     * from the state the real walk leaves rather than from a boot at the
     * same cell.
     *
     * B walks W -> (80,160), N -> (80,96), E -> (240,96) in **304 ticks,
     * ZERO contacts**, and the player finishes at tile (6,5) in the top
     * room. Two baits now drive end to end from the L42 arrival: 852 ticks,
     * both parks asserted, `runBait`'s three controls green on both.
     *
     * ⛓⛓ AND EVERY ESCAPE IN IT IS FORCED BY THE ROOM'S OWN WIDTH. The west
     * corridor is exactly two tiles wide and a `Crusher` is exactly 32 px,
     * so a charge along it has no lateral escape at all: the player must be
     * NORTH of the body before it commits, and the only cell that is both
     * inside B's lane and clear of its final rect is the top room east of
     * x = 96. The chain is the room telling the player where to stand.
     *
     * ⛔ The split into `{approach, spans}` is MEASURED, not authored: the
     * approach is every tick up to and including the one on which the body
     * first moves. Seven ticks, the same as chain 1's — both stances sit
     * one step outside the lane, which is §30.3's "the approach IS the
     * trigger" falling out of the search rather than being designed in.
     */
    chain2: Object.freeze({
        crusher: 'crusher@128,144',
        /** The planner's target — tile (4,11), one step below B's west lane. */
        stance: Object.freeze({ tx: 4, ty: 11 }),
        approach: Object.freeze([
            Object.freeze({ key: 'up', ticks: 7 }),
        ]),
        spans: Object.freeze([
            Object.freeze({ key: 'up', ticks: 33 }),
            Object.freeze({ key: null, ticks: 24 }),
            Object.freeze({ key: 'up+right', ticks: 24 }),
            Object.freeze({ key: 'right', ticks: 8 }),
            Object.freeze({ key: 'left', ticks: 8 }),
            Object.freeze({ key: 'right', ticks: 8 }),
            Object.freeze({ key: 'left', ticks: 8 }),
            Object.freeze({ key: 'right', ticks: 8 }),
            Object.freeze({ key: 'up+left', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: 'up+left', ticks: 8 }),
            Object.freeze({ key: 'down+right', ticks: 8 }),
            Object.freeze({ key: 'left', ticks: 8 }),
            Object.freeze({ key: null, ticks: 24 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 16 }),
            Object.freeze({ key: 'down', ticks: 8 }),
            Object.freeze({ key: null, ticks: 16 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 16 }),
        ]),
        ticks: 304,
        contacts: 0,
        charges: Object.freeze(['W', 'N', 'E']),
        park: Object.freeze({ x: 240, y: 96 }),
        playerEndsAt: Object.freeze({ x: 101.35506423269159, y: 83.18666882984384 }),
        endTile: Object.freeze({ tx: 6, ty: 5 }),
        /** ⛓ The two baits, driven from the arrival through `synthesizeLegs`. */
        pairTicks: 852,
        idleTicks: 200,
    }),
    /**
     * ⛓⛓⛓ R5 SLICE 19 — CHAIN 3 IS FOUND, AND THE WALL IS WHAT FOUND IT.
     *
     * §32.5 ran this search with the nook at tile (6,4) as a DISTANCE HINT
     * and the beam died at depth 43 with 90 of 90 successors run over: with
     * the alternatives merely scored away, the player outran the charge east
     * along the top room instead of ducking into the one cell that survives
     * it. Re-run with the SAME score and the SAME 8-tick blocks and ONE
     * added constraint — while the crusher is anywhere on row 96 the
     * player's box must lie inside `[96,112]`, the nook's own column — it
     * finds the chain at depth 47.
     *
     *     the nook as a HINT        DIED  at depth 43, 90/90 RUN OVER
     *     the nook as a WALL        FOUND at depth 47, 392 ticks
     *
     * ⇒ **A DISTANCE HINT IS NOT A CONSTRAINT**, and this is the same
     * confinement that made chain 1's escape findable in one run (§32.3).
     * Nothing else changed: same beam width, same block, same prefix, same
     * arc-length progress term. A search reports a property of the TRIPLE
     * (score, granularity, constraint), and here the constraint is the only
     * term that moved.
     *
     * ⛓⛓ AND THE ESCAPE IS A SEAM AGAIN, in the other axis. A parked at
     * (80,96) has body `[64,96) x [80,112)` and an east lane
     * `[64,160] x [80,112]`; `laneHitsPlayer` is inclusive and the sweep's
     * overlap is strict, so a player box with `bottom == 80` is INSIDE the
     * lane and OUTSIDE the body — it triggers the charge and the body
     * passes one pixel below it. The nook is the only cell in row 4 that is
     * free (row 4 is wall at every other column), so the whole return chain
     * hangs on one tile and one pixel.
     *
     * ⛔ The beam does not need the exact pixel: the stance it finds sits
     * `bottom = 80.3` — a tenth of a pixel INSIDE the swept volume — and
     * rises out of it inside the `box.x - 96` ticks the charge takes to
     * arrive. That margin is the same quantity chain 1's band is measured
     * in, one axis over.
     */
    chain3: Object.freeze({
        crusher: 'crusher@96,144',
        /** ⛓ Tile (5,13) — in the west corridor, one step outside A's west lane. */
        stance: Object.freeze({ tx: 5, ty: 13 }),
        approach: Object.freeze([
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: 'down+right', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 3 }),
        ]),
        spans: Object.freeze([
            Object.freeze({ key: 'up+right', ticks: 5 }),
            Object.freeze({ key: 'down+left', ticks: 8 }),
            Object.freeze({ key: 'up+left', ticks: 24 }),
            Object.freeze({ key: 'up', ticks: 24 }),
            Object.freeze({ key: 'up+left', ticks: 8 }),
            Object.freeze({ key: 'right', ticks: 8 }),
            Object.freeze({ key: null, ticks: 16 }),
            Object.freeze({ key: 'left', ticks: 8 }),
            Object.freeze({ key: 'right', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'up+right', ticks: 8 }),
            Object.freeze({ key: 'up', ticks: 16 }),
            Object.freeze({ key: null, ticks: 80 }),
            Object.freeze({ key: 'up', ticks: 8 }),
            Object.freeze({ key: 'down', ticks: 16 }),
            Object.freeze({ key: null, ticks: 104 }),
        ]),
        ticks: 392,
        contacts: 0,
        charges: Object.freeze(['W', 'N', 'E']),
        park: Object.freeze({ x: 208, y: 96 }),
        found: true,
        /** ⛓ The one free cell in row 4, and the whole chain hangs on it. */
        nook: Object.freeze({ tx: 6, ty: 4 }),
        playerEndsAt: Object.freeze({ x: 106.63068393962406, y: 76.92179364315787 }),
        endTile: Object.freeze({ tx: 6, ty: 4 }),
        /**
         * ⛔ NINETEEN TICKS, not seven. Chains 1 and 2 both trigger on the
         * seventh tick because both stances sit one step outside the lane;
         * this one starts in the west corridor with A parked twelve tiles
         * east, so the walk INTO the west lane is three spans long.
         */
        approachTicks: 19,
        /** ⛓ All three baits, driven from the L42 arrival through `synthesizeLegs`. */
        tripleTicks: 1366,
        /**
         * ⛔⛔ AND THE RECORD'S `dir` IS THE NET DISPLACEMENT, WHICH FOR A
         * CHAIN IS NOT ANY CHARGE. `runBait` derives it from
         * `after - before` on the reading that "a charge is committed at
         * rest and never re-aimed, so the net displacement IS the direction
         * it was charged in" — true of ONE charge. Chain 3 goes W 112, N
         * 128, E 128 from (192,224) to (208,96): net `(+16,-128)`, so the
         * record says **N** while the last charge is E. Chains 1 and 2 both
         * report E and both happen to end on an E charge, which is why
         * three drives were needed before the field disagreed with itself.
         */
        recordDir: 'N',
        lastCharge: 'E',
    }),
    /**
     * ⛔⛔ THE ARM THAT DIED, BANKED — because "the search returned nothing"
     * and "the room refuses it" print the same thing otherwise. Same beam,
     * same 8-tick blocks, same prefix, same arc-length score; the ONLY
     * difference is whether the nook is a wall or a preference.
     */
    chain3Arms: Object.freeze([
        Object.freeze({
            name: 'the nook as a distance HINT (slice 18)', confine: null,
            block: 8, found: false, depth: 43,
            diedWith: Object.freeze({ runOver: 90, alreadySeen: 0, kept: 0 }),
            why: '⛔ RUN OVER, not exhausted and not deduped: at the death every one of '
                + 'the 90 successors put the player inside the body. The top room is two '
                + 'tiles tall, a `Crusher` is 32 px and B\'s parked body closes the far '
                + 'end at x = 224, so running east ahead of the charge is a race with no '
                + 'finish line — and a score that only PREFERS the nook lets the beam '
                + 'run it.',
        }),
        Object.freeze({
            name: 'the nook as a WALL — box inside [96,112] while the crusher is on row 96',
            confine: Object.freeze({ x0: 96, x1: 112, whileCrusherOn: 'y = 96' }),
            block: 8, found: true, depth: 47,
            diedWith: null,
            why: '⛓⛓⛓ THE ANSWER. The wall is raised PER STAGE — the first two charges '
                + 'need the west corridor at cols 4,5 and the third needs col 6 — which '
                + 'is the whole reason a global confinement could not have been written: '
                + 'the player must be in A\'s WEST lane (box.right >= 112) to start the '
                + 'chain at all, and inside [96,112] to finish it.',
        }),
    ]),
    /**
     * ⛔⛔ R5 SLICE 19 — THE OBVIOUS CONTROL FOR THIS ROOM IS NOT A CONTROL,
     * AND IT IS §29.7's SHAPE ONE ROOM ALONG.
     *
     * L42 has no flag to withhold — no rock shields these crushers, no lock
     * gates the room, no item is needed — so the isolating variable has to
     * be the choreography. The obvious way to withhold it is to keep the
     * tape tick for tick and EMPTY the nine charges' held spans. Measured,
     * that arm drives the mechanism it exists to withhold: each following
     * walk was planned from the cell the choreography before it ended in,
     * so the player begins it somewhere else, the replayed spans carry it
     * into the lanes, and it is inside a body on **1,127 ticks**.
     *
     * ⇒ AND IN A PURSUIT ROOM THAT IS NOT AN ACCIDENT. Every cell of the
     * corridor is in somebody's lane (`arrival.safeNodes` is 172 of 304),
     * so an unplanned walk IS a trigger. The recorded control is therefore
     * the tape CUT at the first bait's stance — tile (4,11), one step
     * outside all eight lanes, which is exactly what makes it a stance —
     * and standing still there is a claim about 1,652 null scans.
     */
    naiveControlRefuted: Object.freeze({
        arm: 'the same tape with the nine charges\' held spans emptied, every walk kept',
        contacts: 1127,
        crushersEndAt: Object.freeze([
            Object.freeze({ id: 'crusher@96,144', x: 80, y: 224 }),
            Object.freeze({ id: 'crusher@128,144', x: 80, y: 192 }),
        ]),
        collected: 0,
        transitions: 0,
        why: 'both crushers charge — neither to a park — so the arm exercises the crusher '
            + 'instead of withholding it, and a differential against it would be '
            + 'measuring the mechanism the pair exists to isolate.',
    }),
    /** ⛔ The permissive reading's first escape, DRIVEN, and it is run over. */
    permissiveRefuted: Object.freeze({
        ordering: 'A W/N/E then B W/N/E — six charges, three cheaper than the answer',
        firstEscape: 'north out of rows 9,10 at cols 4,5, into rows 7,8',
        needsPx: 35,
        marginPx: 6,
        drivenTravelPx: 14,
        drivenContacts: 48,
        why: 'the player must be IN rows 9,10 to trigger the west charge and A parks in '
            + 'rows 9,10; the climb out is 35 px at 1.2 px/tick and A\'s left edge is 6 px '
            + 'away at 1 px/tick. `Crusher.solids` is `["Solid"]`, so it moves THROUGH '
            + 'the player and then BLOCKS the rest of the climb.',
    }),
    driven: false,
});
