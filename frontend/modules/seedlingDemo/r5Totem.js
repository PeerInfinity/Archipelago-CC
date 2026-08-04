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
 * The R2 rule is that a clear reaching a `FallRock` is REFUSED BY NAME —
 * an armed rock writes the player's `y` directly and is outside both
 * `noclip` and `noDamage`. Group 6 contains one, so the arm is only
 * admissible if the publication cannot arm it. It cannot, and the reason
 * is two independent gates rather than one:
 *
 * - `FallRock`'s constructor parks it at `y = -16` with `type = ""` unless
 *   `!Game.checkPersistence(tag)`, and its tag is **10**, which nothing on
 *   this route writes. The rope's write is tag **9**.
 * - `FallRock.update`'s position-writing arm is
 *   `if (activate && y >= fallTo)`, and a parked rock has `y = -16` against
 *   `fallTo = 624`. So even with `activate` published TRUE the arm is
 *   unreachable — and the whole falling branch below it is behind
 *   `if (!Game.checkPersistence(tag))`, which is the same flag again.
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
        member: 'fallrock@144,624', verdict: 'no-op', persistTag: 10,
        why: 'parked at y = -16 with `type = ""` because tag 10 is still TRUE, and the '
            + 'position-writing arm is `activate && y >= fallTo` — -16 against 624. The '
            + 'R2 refusal is not triggered: the publication is `activate`, not a clear, '
            + 'and the flag it would need is a different tag.',
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
