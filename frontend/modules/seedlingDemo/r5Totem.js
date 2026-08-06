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
