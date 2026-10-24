/**
 * seedlingDemo/fidelityCrossRoom — **THE CROSS-ROOM `ButtonRoom` PRESSES, AS GAME WITNESS ARMS**
 * (Seedling fidelity CROSSROOM D4).
 *
 * L38 holds two of the game's four cross-room buttons (`ButtonRoom.as:93`, `setPersistence(t, persist, room)`):
 *   · `L37-4-from-L38` — `buttonroom@144,288` {room 37, tset 4, flip 1}: the button the L37 → L38 arrival lands
 *     ON, so the game presses it on the boot's first update and writes `{37,4}` (and its own `{38,5}`). On the
 *     delivered set no entity of L37 reads tag 4 (`levelRun`'s `unreadRoomWrites`); the write is the game's either way.
 *   · `L39-8-from-L38` — `buttonroom@32,48` {room 39, tset 8, flip 1}: L39's plug `wandlock@144,592` is removed
 *     at L39's build by `{39,8}` (the rules arc's `flag:L39:8`). Reached from the same arrival through L38's own
 *     chain (`buttonroom@144,128`'s cover, the link-2 pulser, the chest) — the solver's `clear-tag` with a
 *     `presser`, `solverBot.execClearTag`'s cross-room arm.
 *
 * Each is a `clear-tag` goal whose flag is in ANOTHER level and whose `presser` stands in L38, solved by the
 * solver from the arrival and played on the game by `probe-seedling-cleartag.mjs --set=crossroom` with the same
 * arms as every clear-tag witness (`fidelityClearTag.clearTagArms`): the whole solve (0 px, the flag held) and
 * the two cuts around the model's write tick. L38 is the same room on the vanilla map and the delivered set (the
 * patches touch L0 and L37), and the solves never enter L37, so the vanilla game page witnesses them.
 */

/** The route's items by sphere 5 (the survey's step-76 grant: sword, shield, fire, torch, swim). */
const ITEMS = Object.freeze(['hasSword', 'hasShield', 'hasFire', 'hasTorch', 'canSwim']);
const ARRIVAL = Object.freeze({ level: 38, x: 144, y: 288 });

export const CROSSROOM_WITNESSES = Object.freeze([
    Object.freeze({ key: 'L37-4-from-L38', boot: ARRIVAL, items: ITEMS,
        goal: Object.freeze({ kind: 'clear-tag', tag: { level: 37, tag: 4 }, at: { x: 288, y: 32 },
            obstacle: 'fallrock@288,32', presser: { level: 38, class: 'buttonroom', x: 144, y: 288 } }),
        verb: 'cross-room-press', onRoute: 'survey step 59 / sweep leg 366 (the arrival presses it)' }),
    Object.freeze({ key: 'L39-8-from-L38', boot: ARRIVAL, items: ITEMS,
        goal: Object.freeze({ kind: 'clear-tag', tag: { level: 39, tag: 8 }, at: { x: 144, y: 592 },
            obstacle: 'wandlock@144,592', presser: { level: 38, class: 'buttonroom', x: 32, y: 48 } }),
        verb: 'cross-room-press', onRoute: 'survey step 76 / sweep leg 368 (flag:L39:8)' }),
]);
