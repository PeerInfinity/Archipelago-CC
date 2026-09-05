/**
 * seedlingDemo/dialogue — the pickup CEREMONY, transcribed.
 *
 * Region-atlas Phase 8, subtractive ladder rung R3, slice 2. Brief:
 * `CC/docs/plans/seedling-bot-r3-opus-kickoff.md` §8.7.
 *
 * ── What a ceremony is, and why it is the rung ────────────────────────
 *
 * R0's `grants` handed the player an item as a property write on room
 * entry. R3 retires that crutch: the bot walks ONTO the pickup and the game
 * does the rest. "The rest" is a five-part sequence, and every part of it
 * is frame-counted, so all of it is deterministic and none of it is
 * guessable:
 *
 *   1. `Pickup.update` collides with the player and calls `pick_up()`,
 *      which sets `Game.freezeObjects` and counts `specialTimer` down from
 *      150. Nothing moves and — measured — the bot's tick counter does not
 *      advance either: `Pickup` is the only writer of the freeze flag on
 *      those frames, so the dead-frame gate sees it and holds. **PHASE A IS
 *      INVISIBLE TO THE OBSERVATION STREAM.**
 *   2. At zero it spawns a temporary `NPC` carrying the item's text, and
 *      `setTemp` sets `talking`, so `Game.talking` becomes true.
 *   3. ⚠ **THE TICK COUNTER NOW RUNS AGAIN** while the player still cannot
 *      move. `Game.freezeObjects` is a sticky static with several writers
 *      and no per-frame reset; on these frames it is TRUE when
 *      `Mobile.mobileUpdate` reads it and FALSE by the time the next
 *      frame's dead-frame gate does. So PHASE B consumes one tape tick per
 *      frame and every observation in it repeats the contact position.
 *      This was measured, not deduced — see the kickoff's §8.7 probe.
 *   4. Because the tick counter runs, the TAPE supplies the X releases.
 *      `NPC.talk()` reads `Input.released(p.keys[6])` from the NPC's own
 *      update, which is not inside the frozen block. Phase B ends when the
 *      pages are exhausted.
 *   5. `removeSelf()` -> `removed()`: the item property, `setPersistence`,
 *      and (for the SWORD only) a `Help(3)` that no tape can ever dismiss —
 *      that one is `Bot.autoAdvance`'s job and it produces only dead
 *      frames, so it is invisible here too.
 *
 * ── Why the text machinery has to be transcribed at all ───────────────
 *
 * Phase B's LENGTH is what the observation stream measures, and it depends
 * on how many X releases the pages need — which depends on how far the text
 * has typed when each one lands. So "press X a few times" cannot be
 * modelled as a constant; the model has to know the same thing the game
 * knows.
 *
 * ⚠ AND THE TYPING RUNS ON *RENDER* FRAMES. `Game.talk()` is called from
 * `Game.render()` (`Game.as:1001`), not from `update()` — it draws the text
 * box — so `currentCharacter` advances on a cadence the update-side gates
 * do not touch. Within one frame the order is therefore:
 *
 *      Bot.update (record, dispatch)  ->  world update (NPC.talk reads the
 *      release)  ->  world render (Game.talk types one more character)
 *
 * so a release lands against the character count the PREVIOUS frame's
 * render left. Getting that order backwards shifts every ceremony by one
 * frame, which is exactly the class of off-by-one the oracle exists to
 * settle.
 *
 * ── Everything here is verbatim, including the parts that look wrong ──
 *
 * `endlineText` rebuilds the string with a `while` that walks BACKWARDS
 * over a line looking for a break character, and it replaces a space but
 * INSERTS before anything else — so a wrapped page's `.length` differs from
 * the source text's, and `.length` is precisely what the page-advance test
 * compares against. Transcribe it; do not "fix" it.
 */

/** `Pickup.specialTimer` starts here and counts to zero. `Pickup.as:22`. */
export const SPECIAL_TIMER_MAX = 150;

/** `Pickup.DEF_TEXT_SPEED` — frames per character for a pickup's NPC. */
export const PICKUP_TEXT_SPEED = 6;

/** `Pickup.as:101` passes 32 as the NPC's `_lineLength`. */
export const PICKUP_LINE_LENGTH = 32;

/** `Game.framesThisCharacter` starts at 0 on a fresh `Game`. `Game.as:603`. */
export const INITIAL_FRAMES_THIS_CHARACTER = 0;

/**
 * `NPC.validChar` — the characters a line break may NOT land on.
 * `NPCs/NPC.as:180-183`.
 */
export function validChar(pchar) {
    return pchar !== ' ' && pchar !== '-' && pchar !== '/';
}

/**
 * `NPC.endlineText` — wrap one page to `lineL` columns, verbatim.
 *
 * `NPCs/NPC.as:152-179`. AS3 `String.substr(pos, 1)` past the end yields
 * "" and `substring` clamps, which JS matches for these arguments; the
 * `pos % lineL <= 0` guard and the `int(pchar == " ")` space-eating are
 * both load-bearing for `.length`, which is what the page-advance test
 * reads.
 */
export function endlineText(s0, lineL) {
    let s = s0.substr(0, s0.length);
    let pos = lineL - 1;
    while (pos < s.length) {
        let pchar = s.substr(pos, 1);
        while (validChar(pchar)) {
            pos--;
            if (pos % lineL <= 0) {
                pos += lineL;
                break;
            }
            pchar = s.substr(pos, 1);
        }
        if (pos < s.length) {
            const start = s.substring(0, pos);
            const end = s.substring(pos + (pchar === ' ' ? 1 : 0), s.length);
            s = `${start}\n${end}`;
        }
        pos += lineL;
    }
    return s;
}

/**
 * `NPC.addText` + `NPC.lineWrap` — a `~`-separated string to wrapped pages.
 * `NPCs/NPC.as:104-117` and `:145-151`.
 */
export function pagesOf(text, lineLength = PICKUP_LINE_LENGTH) {
    const raw = [];
    const split = (t) => {
        const end = t.indexOf('~', 0);
        if (end === -1) { raw.push(t.substring(0, t.length)); return; }
        raw.push(t.substring(0, end));
        split(t.substring(end + 1, t.length));
    };
    split(text);
    return raw.map((p) => endlineText(p, lineLength));
}

/**
 * Begin a ceremony's PHASE B, at the frame the NPC is added.
 *
 * `Game.talkingText`'s setter resets `currentCharacter` to 0 when the text
 * changes (`Game.as:1704-1711`), and `framesPerCharacter` becomes the NPC's
 * own `talkingSpeed` (`NPC.talking`'s setter, `NPCs/NPC.as:269`).
 *
 * ⚠ `framesThisCharacter` is NOT reset by either setter — it is a `Game`
 * field that carries across dialogues within one level and is fresh only
 * on a world swap. The caller owns it for that reason.
 */
export function beginDialogue(text, {
    framesThisCharacter = INITIAL_FRAMES_THIS_CHARACTER,
    framesPerCharacter = PICKUP_TEXT_SPEED,
    lineLength = PICKUP_LINE_LENGTH,
} = {}) {
    const pages = pagesOf(text, lineLength);
    if (pages.length === 0) {
        throw new Error('beginDialogue: a ceremony with no pages cannot end');
    }
    return {
        pages,
        page: 0,
        currentCharacter: 0,
        framesThisCharacter,
        framesPerCharacter,
        done: false,
        /** Frames spent in phase B, i.e. tape ticks this ceremony costs. */
        frames: 0,
    };
}

/**
 * One frame of phase B: the world update, then the render.
 *
 * @param {object}  d          a `beginDialogue` state, MUTATED
 * @param {boolean} released   did the tape release the talk key this frame?
 * @returns {object} the same state
 *
 * ⚠ RELEASE FIRST, THEN TYPE, because `World.update` runs before
 * `World.render` and `Game.talk()` lives in the latter. A frame that typed
 * first would let a release see a character count the game had not reached.
 */
export function stepDialogue(d, released) {
    if (d.done) return d;

    // ── the world update: `NPC.talk()`, `NPCs/NPC.as:191-217` ──────────
    if (released) {
        const page = d.pages[d.page];
        if (d.currentCharacter >= page.length) {
            d.page++;
            if (d.page >= d.pages.length) {
                // `talking = false` -> the setter clears the freeze and the
                // temporary NPC removes itself. Phase B is over; the frame
                // still counts, because the bot recorded an observation at
                // the top of it.
                d.done = true;
                d.frames++;
                return d;
            }
            // `Game.talkingText = myText[myCurrentText]` — the setter resets
            // the character counter only because the string CHANGED. Two
            // identical consecutive pages would not reset it, which is a
            // faithful transcription and not a case any committed text hits.
            if (d.pages[d.page] !== page) d.currentCharacter = 0;
        } else {
            // ⚠ NOT `length`, and not "skip to the end". The game sets it to
            // `length - 1`, so the very next release still finds
            // `currentCharacter < length` unless a render has ticked it over
            // in between — which is why a ceremony needs MORE releases than
            // it has pages, and why they must be spaced.
            d.currentCharacter = page.length - 1;
        }
    }

    // ── the render: `Game.talk()`, `Game.as:1617-1626` ─────────────────
    if (d.framesThisCharacter > 0) {
        d.framesThisCharacter--;
    } else {
        d.framesThisCharacter = d.framesPerCharacter;
        d.currentCharacter++;
    }

    d.frames++;
    return d;
}

/**
 * Every placed pickup, by its EXTRACT TAG: the item it grants and the text
 * its ceremony shows.
 *
 * The texts are verbatim from each `Pickups/*.as` constructor and the item
 * names are `tapeFormat.ITEM_PROPERTIES` keys, so a typo in either is a
 * loud lookup failure rather than a ceremony that runs the wrong length.
 *
 * ⚠ `text: ''` IS A REAL CASE, not a gap. `Pickup.pick_up()` spawns the NPC
 * only `if (specialTimer <= 0 && text != "")`, so a pickup with no text
 * runs PHASE A and then removes itself on the next frame — 150 invisible
 * frames and no dialogue at all. `BossTotemPart` has none, and `BossKey`
 * has one only for `keyType == 0`. Modelling those as a dialogue would
 * charge the tape ticks the game never spends.
 *
 * ⚠ `item: null` means "the game tracks this, the tape's inventory mirror
 * does not" — a boss key or a totem part is not one of the fourteen
 * properties `botStatus` reports, so there is nothing to apply here even
 * though the ceremony is real.
 */
export const PICKUP_CEREMONY = Object.freeze({
    sword: Object.freeze({
        item: 'sword',
        text: 'You got the sword!~Double tap to dash and swing.',
    }),
    shield: Object.freeze({
        item: 'shield',
        text: 'You got the shield!~It protects you when moving.',
    }),
    conch: Object.freeze({
        item: 'conch',
        text: 'You got the Conch!~Now you can swim in water!',
    }),
    feather: Object.freeze({
        item: 'feather',
        text: "You got the Penguin's Feather!~You can now swim up waterfalls.",
    }),
    torchpickup: Object.freeze({
        item: 'torch',
        text: 'You got the light!~It lights your path with color.',
    }),
    ghostspear: Object.freeze({
        item: 'spear',
        text: 'You got the Ghost Spear!~It hits harder and through walls.',
    }),
    darkshield: Object.freeze({
        item: 'darkshield',
        text: 'You got the Dark Shield!~It hurts what it touches.',
    }),
    darksuit: Object.freeze({
        item: 'darksuit',
        text: 'You got the Dark Suit!~It hurts what it hits, and it lets you swim in lava.',
    }),
    health: Object.freeze({
        item: 'health',
        text: 'You got health!',
    }),
    wand: Object.freeze({
        item: 'wand',
        text: 'You got the Wand!~It shoots weakly, but far.',
    }),
    ghostsword: Object.freeze({
        item: 'ghostsword',
        text: 'You got the Ghost Sword!~It hits through walls.',
    }),
    firewand: Object.freeze({
        item: 'firewand',
        text: 'You got the Fire Wand!~It shoots fire, weakly, but far.',
    }),
    // No text: phase A only. See the warning above.
    totempart: Object.freeze({ item: null, text: '' }),
    /**
     * ⚠ R4: the SECOND textless ceremony, and it is textless CONDITIONALLY.
     *
     * `BossKey`'s ctor sets `text` only under `if (keyType == 0)`
     * (`Pickups/BossKey.as:24-27`), so the keyType-0 key in L19 shows "You
     * got a key!~Keys open locks of their color." and every other one — L29's
     * keyType 1, L40's 2, L55's 3 and **L67's 4, the only one on any route**
     * — inherits `Pickup.text = ""` and self-resolves after 150 frozen
     * frames.
     *
     * ⛓⛓⛓ AND R6 SLICE 5 IS THE RUNG THAT REACHED L19, EXACTLY AS THIS
     * DOCBLOCK PREDICTED. Its own words were *"a rung that reaches L19 has
     * to split this entry by keyType rather than change it, and would find
     * out by the ceremony costing 150 ticks the recording does not have"* —
     * and the split is `PICKUP_CEREMONY_BY_KEYTYPE` below, resolved by
     * `levelRun.ceremonyFor` from the pickup's own `keyType`. A prediction
     * with a mechanism behind it, kept as a comment, is what turned this
     * from a silent 150-frame divergence into a two-line change.
     *
     * ⚠ THE ENTRY HERE REMAINS THE TEXTLESS ONE, deliberately: it is the
     * DEFAULT for every keyType the split does not name, so a sixth key
     * placed by some future map inherits the conservative case rather than
     * L19's dialogue.
     *
     * `item: null` for the usual reason and one more: `BossKey.removed()`
     * does not call `super.removed()` at all, so unlike every other pickup
     * it writes NO persistence — its whole effect is
     * `Player.hasKeySet(keyType, true)`, which `levelRun` banks as the run's
     * key set. That absence is load-bearing for the R4 ledger: seven pickups
     * are taken and only six flags go off.
     */
    bosskey: Object.freeze({ item: null, text: '' }),
});

/**
 * ⛓⛓⛓ R6 SLICE 5: the ceremonies whose text depends on a pickup ATTRIBUTE
 * rather than on its tag.
 *
 * One family so far, and the shape is deliberately a nested table rather
 * than a predicate: `BossKey`'s ctor is `if (keyType == 0) text = "…"`, an
 * enumeration of one, and a predicate (`keyType < 1`, "the first key") is
 * exactly the coincidental shape [[feedback_coincidental_predicate_rots]]
 * warns about. A keyType absent from the inner table falls back to
 * `PICKUP_CEREMONY`'s own row.
 */
export const PICKUP_CEREMONY_BY_KEYTYPE = Object.freeze({
    bosskey: Object.freeze({
        0: Object.freeze({
            item: null,
            text: 'You got a key!~Keys open locks of their color.',
        }),
    }),
});

/**
 * ⛓⛓⛓ R6 SLICE 6d: the ceremonies whose text is an **`.oel` ATTRIBUTE**.
 *
 * The THIRD place a pickup's text can come from, and the first that is not
 * in the source tree at all. `Game.as:2185` is
 * `add(new Seed(o.@x, o.@y, false, o.@text, cutscene[2]))` — the text is
 * DATA, so two `seed` objects in two levels run dialogues of different
 * lengths from one class, and a table here could only ever hold one of
 * them. (The fourth place is a constructor literal in another class:
 * `Watcher.as:97` spawns its bloody `Seed` with the string written in the
 * call. `endingChain.BLOODY_SEED_TEXT`.)
 *
 * ⚠ `item: null` for the usual reason and one more: `Seed` overrides
 * `removeSelf` and never reaches `removed()`, so it grants nothing and
 * writes no persistence whatever its text says.
 */
export const PICKUP_TEXT_FROM_ATTRIBUTE = Object.freeze({
    seed: Object.freeze({
        item: null,
        attribute: 'text',
        src: 'Game.as:2185 — `new Seed(o.@x, o.@y, false, o.@text, cutscene[2])`',
    }),
});

/**
 * ⛓ R9 slice 12e‴ — the keys a `Help` is DISMISSED by, and it is a PRESS not
 * a release. `NPCs/Help.as:23` is
 * `keys = [[V,V], [ANY,M], [RIGHT,UP,LEFT,DOWN], [X,C]]` and the sword's is
 * `Help(3)` — "press X or C". `Help.update:92` reads `Input.pressed`, so a
 * key already held registers nothing (FlashPunk's `onKeyDown` records a press
 * only `if (!_key[code])`).
 */
export const HELP_DISMISS_KEYS = Object.freeze(['primary', 'secondary']);

/**
 * ⛓⛓⛓ R9 SLICE 12e⁗ — **HOW MANY FREEZE ARRIVALS `Bot.autoAdvance` CAN
 * COUNT, DERIVED FROM THE HELP MODEL RATHER THAN FROM A PICKUP COUNT.**
 *
 * `check-seedling-bot-differential.mjs` used to derive its expectation as
 * `wantAutoAdvance = swordPickups` — *"each raising `Sword.removed()`'s
 * unguarded `Help(3)`"*. That premise is the one 12e‴ made false, and the
 * third re-record run is where it came due: the re-recorded 78-tick
 * `r8-solve-10` collects its sword, the game raises the Help, and the game's
 * `saw_auto_advance` is **0** against the check's 1 (R9 §37.7).
 *
 * ⛓ **THE INTRA-FRAME ORDER, WHICH §37.7 LEFT OPEN, IS EXPLICIT IN THE
 * SOURCE AND NEEDS NO ENTITY-LIST ARGUMENT.** `Main.as:67` calls
 * `Bot.update()` **above** `super.update()`, with the fork's own comment
 * saying why ("drive the tape before entities update"), and `super.update()`
 * is `net/flashpunk/Engine.as:69-77` — `FP._world.update()` (every entity,
 * `Help.update()` among them) and only then `updateLists()`. So `Bot.update()`
 * runs BEFORE every entity update on the frame, unconditionally; `Bot` is not
 * an Entity at all (`Bot.as` `public static function update()`), so where a
 * `Help` sits in the list cannot matter.
 *
 * ⇒ the mechanism, end to end:
 *   - `Game.freezeObjects = true` is set INSIDE `Help.update()`
 *     (`NPCs/Help.as:100`), never at construction, so the freeze a `Help`
 *     raises on frame T is first visible to `Bot` on frame T+1;
 *   - `Help.as:92-103` sets `remove` on an `Input.pressed` EDGE of
 *     {@link HELP_DISMISS_KEYS} and `:107-110` lowers the freeze IN THE SAME
 *     UPDATE for `frame != 1`;
 *   - `autoAdvance()` is reached ONLY from the dead-frame branch
 *     (`Bot.as:2877-2882` — `blackCover > 0 || Game.freezeObjects`), and the
 *     arrival is counted there (`Bot.as:3151`).
 * ⇒ **a `Help` the tape dismisses at its own first update never produces a
 * frame on which `autoAdvance()` runs, and its arrival is never counted.**
 *
 * The model already computes exactly that predicate — `levelRun.js`'s
 * `drainPickupHelp` spends `pressed ? frames - 1 : frames` on the same
 * `Input.pressed` edge, and `gameClock.spend` drops a zero-frame span — so
 * this function is a READ of the ledger and not a second spelling of the
 * rule. [[feedback_two_gates_one_opener]]
 *
 * ⛓ CALIBRATED AGAINST THE GAME AT BOTH POINTS OF THE ONE DISCRIMINATING
 * PAIR (`fixtures/r8-solve-10-help-frame-oracle.json`, 12e‴'s two read-only
 * drives): the 90-tick walk holds `right,up` at the Help's tick → 1 span →
 * game `saw_auto_advance` **1**; the 78-tick walk holds `primary,up` → 0
 * spans → game **0**.
 *
 * ⛔ NOT A CENSUS OF EVERY FREEZE. `Bot`'s predicate is
 * `Game.talking || helpUp`, so the seal ceremony and `FallRock` make dead
 * frames and are correctly NOT counted; the dead-frame budget is the
 * instrument that sees those.
 *
 * @param {Array<{kind: string, frames: number}>} deadFrameSpans
 *   `runTape(...).deadFrameSpans` — the game clock's ledger for the tape.
 * @returns {number} the freeze arrivals `Bot.autoAdvance` can see.
 */
export function autoAdvanceArrivals(deadFrameSpans) {
    return (deadFrameSpans ?? [])
        .filter((s) => s.kind === 'help' && s.frames > 0).length;
}

/** The tape key whose RELEASE advances a dialogue — `Player.keys[6]` is X. */
export const TALK_KEY = 'primary';

/**
 * `NPCs/NPC.as:46` — a placed NPC's default `_lineLength`, the column count
 * `lineWrap()` folds its pages to. Only `Statue` passes anything else.
 */
export const NPC_LINE_LENGTH_DEFAULT = 28;

/**
 * ⛓⛓⛓ R9 SLICE 12e‴ — **THE PLACED NPCs THAT TALK, AND THE KEY THAT OPENS
 * THEM.**
 *
 * ── The defect this table exists to close ─────────────────────────────
 *
 * `NPC.talk()` reads its key as `Input.released(p.keys[6])` (`NPCs/NPC.as:
 * 191`) and `Player.as:59` is
 *
 * ```as3
 *   keys = new Array(Key.RIGHT, Key.UP, Key.LEFT, Key.DOWN,
 *                    Key.X, Key.C, Key.X, Key.V, Key.I);
 * //                 [0]        [1]     [2]      [3]
 * //                 [4]  [5]   [6]  [7]  [8]
 * ```
 *
 * — so **`keys[6]` is `Key.X`, the SWORD key**, which `tapeFormat` spells
 * `primary` and which every walk presses constantly. `levelWorld`'s NPC
 * comment used to say a placed NPC "needs `Input.released(V)`"; V is
 * `keys[7]`, which no tape has ever pressed. That one index is why no sign
 * has ever spoken in the model, and it cost 28 ticks of `r8-d2-19`
 * (kickoff §36): the walk swings the sword next to L19's sign, the GAME
 * opens the dialogue and freezes the player for the 28 ticks between the
 * opening release and the release that finally exhausts the page, and the
 * model walked straight on.
 *
 * ⛔ **28 IS NOT A CONSTANT AND THERE IS NONE TO FIND.** It is
 * `t_close − t_open` for one tape against one page: the release at t=15
 * opens it (the first inside the circle — the releases at t=1, 3 and 9 are
 * 26–35 px away), the releases at t=23 and t=25 do NOT close it because
 * `NPC.as:205` sets `currentCharacter = length - 1` and never `length`, and
 * the release at t=43 finds the typewriter past the end and exhausts the
 * last page. Any other press schedule gives another number.
 *
 * ── What a row carries, and why the table is a table ──────────────────
 *
 * `keyNeeded` is assigned in exactly ONE place in the whole AS3 —
 * `NPCs/Watcher.as:46` — so every OTHER placed NPC keeps `NPC.as:41`'s
 * `true` and opens only on an X release inside `talkRange`. The Watcher
 * therefore keeps its own arm (`levelRun.stepWatchersNow`) and is absent
 * here BY NAME rather than by omission.
 *
 * The rest of a row is the two things `Game.loadlevel`'s spawn line and the
 * class's own `super()` decide and that a walk cannot see:
 *
 *   · `lineLength` — `NPC.as:46`'s `_lineLength:int = 28` default, EXCEPT
 *     `Statue`, whose ctor passes **34** (`NPCs/Statue.as:20`). The wrapped
 *     page's `.length` is what the page-advance test compares against, so a
 *     wrong column count retimes every boundary.
 *   · `doneTalking` — whether finishing (or LEAVING, which runs the same
 *     setter) has an effect on the world. `⛔ REFUSED` rows are the ones
 *     whose effect is real and is not transcribed; opening one throws BY
 *     NAME rather than running a dialogue that silently omits a spawned
 *     item or a persistence write. [[feedback_fallback_reinstates_the_defect]]
 *
 * ⚠ `talkingSpeed` is NOT here: it is the `frames` ATTRIBUTE
 * (`Game.as:2265-2282` pass `o.@frames` as `_talkingSpeed` for every one of
 * these classes), so it is DATA and `levelWorld` reads it off the entity.
 * ⚠ And it defaults to **0**, not to the AS3 signature's 10: `o.@frames` on
 * a missing attribute is an empty XMLList and `int("")` is 0 in AS3, so the
 * parameter default is unreachable from a level file. 0 is a real speed —
 * one character per frame. Same reading as the watcher roster's.
 */
export const PLACED_NPC_TALK = Object.freeze({
    // ── the plain ones: `doneTalking()` is NOT overridden at all, so the
    // base's empty body runs and finishing writes nothing. Their only
    // overrides are `render()`/`layering()`, which no model reads.
    sign: Object.freeze({ as3: 'Sign', spawn: 'Game.as:2276',
        ctor: 'NPCs/Sign.as:13-17', lineLength: NPC_LINE_LENGTH_DEFAULT, doneTalking: null }),
    totem: Object.freeze({ as3: 'Totem', spawn: 'Game.as:2277',
        ctor: 'NPCs/Totem.as:14-17', lineLength: NPC_LINE_LENGTH_DEFAULT, doneTalking: null,
        why: 'NPCs/Totem.as overrides NOTHING — it is a bare NPC with a two-tile offset' }),
    hermit: Object.freeze({ as3: 'Hermit', spawn: 'Game.as:2273',
        ctor: 'NPCs/Hermit.as:19-21', lineLength: NPC_LINE_LENGTH_DEFAULT, doneTalking: null }),
    sensei: Object.freeze({ as3: 'Sensei', spawn: 'Game.as:2275',
        ctor: 'NPCs/Sensei.as:19-21', lineLength: NPC_LINE_LENGTH_DEFAULT, doneTalking: null }),
    rekcahdam: Object.freeze({ as3: 'Rekcahdam', spawn: 'Game.as:2266',
        ctor: 'NPCs/Rekcahdam.as:17-19', lineLength: NPC_LINE_LENGTH_DEFAULT, doneTalking: null }),
    adnanchar: Object.freeze({ as3: 'AdnanCharacter', spawn: 'Game.as:2269',
        ctor: 'NPCs/AdnanCharacter.as:17-19', lineLength: NPC_LINE_LENGTH_DEFAULT, doneTalking: null }),
    forestchar: Object.freeze({ as3: 'ForestCharacter', spawn: 'Game.as:2267',
        ctor: 'NPCs/ForestCharacter.as:17-19', lineLength: NPC_LINE_LENGTH_DEFAULT, doneTalking: null }),
    introchar: Object.freeze({ as3: 'IntroCharacter', spawn: 'Game.as:2265',
        ctor: 'NPCs/IntroCharacter.as:17-19', lineLength: NPC_LINE_LENGTH_DEFAULT, doneTalking: null }),
    /**
     * ⚠ `Statue` is the one class that passes its own `_lineLength`, and it
     * is also the one whose ctor stacks an offset on top of `NPC`'s — both
     * on the SAME line, `NPCs/Statue.as:20`. `statue1` and `statue2` are one
     * class with different `_t`, which is why the atlas has two type names
     * and this table has two rows.
     */
    statue1: Object.freeze({ as3: 'Statue', spawn: 'Game.as:2281',
        ctor: 'NPCs/Statue.as:18-20', lineLength: 34, doneTalking: null }),
    statue2: Object.freeze({ as3: 'Statue', spawn: 'Game.as:2282',
        ctor: 'NPCs/Statue.as:18-20', lineLength: 34, doneTalking: null }),
    /**
     * ⚠ MODELLED, and the reason is that its effect is not the WORLD's.
     * `Karlore.doneTalking()` is `super.doneTalking(); Main.unlockMedal(
     * Main.badges[1])` (`NPCs/Karlore.as:35-39`) — a Newgrounds badge. It
     * writes no persistence, no item and no entity, and `botStatus` reports
     * no medal, so there is nothing for a run to carry. Named rather than
     * silently lumped with the empty ones.
     */
    karlore: Object.freeze({ as3: 'Karlore', spawn: 'Game.as:2268',
        ctor: 'NPCs/Karlore.as:17-19', lineLength: NPC_LINE_LENGTH_DEFAULT, doneTalking: 'medal',
        why: 'Main.unlockMedal(Main.badges[1]) — no world state' }),

    // ── ⛔ REFUSED BY NAME. Their `doneTalking()` DOES something, and
    // `NPC.talk()`'s out-of-range arm runs the same setter — so walking away
    // mid-page pays it too ([[feedback_leaving_the_radius_still_pays]]).
    // A dialogue modelled without its effect is worse than no dialogue.
    oracle: Object.freeze({ as3: 'Oracle', spawn: 'Game.as:2271',
        ctor: 'NPCs/Oracle.as:24-26', lineLength: NPC_LINE_LENGTH_DEFAULT,
        doneTalking: 'REFUSED',
        why: 'NPCs/Oracle.as:95-109 — under `Game.cutscene[1]` it either `exitToMenu()` '
            + 'or plays the player\'s DEATH animation, and `Oracle.as` is also the only '
            + 'class with a `talking_extras()` override' }),
    witch: Object.freeze({ as3: 'Witch', spawn: 'Game.as:2272',
        ctor: 'NPCs/Witch.as:23-25', lineLength: NPC_LINE_LENGTH_DEFAULT,
        doneTalking: 'REFUSED',
        why: 'NPCs/Witch.as:46-53 — `if (Main.hasWand && !Main.hasDarkSword)` it ADDS a '
            + '`DarkSword` pickup at the player\'s feet, which is a new entity and a new '
            + 'ceremony this model would not know about' }),
    yeti: Object.freeze({ as3: 'Yeti', spawn: 'Game.as:2274',
        ctor: 'NPCs/Yeti.as:19-21', lineLength: NPC_LINE_LENGTH_DEFAULT,
        doneTalking: 'REFUSED',
        why: 'NPCs/Yeti.as:40-50 — it clears its OWN tag and tag 1 (the portal in '
            + 'DeadBoss.oel), two persistence writes the run\'s ledger would miss' }),
});

/**
 * `watcher` is deliberately ABSENT from `PLACED_NPC_TALK`, and this names it.
 *
 * `NPCs/Watcher.as:46` `keyNeeded = !Game.checkPersistence(tag)` is the only
 * assignment of that field anywhere, and a fresh boot's persistence is all
 * `true`, so a Watcher AUTO-TALKS on proximity with no key at all. It has its
 * own roster, its own `doneTalking` (the `{114,0}` clear), a live `Seed` that
 * a stance can soft-lock on, and a sword half — all of it in
 * `levelRun.stepWatchersNow`. Two implementations of the FREEZE would be the
 * defect; two implementations of the WATCHER would be a rewrite. So the
 * generic arm skips this type by name and asserts the reason.
 */
export const TALK_OWNED_ELSEWHERE = Object.freeze({
    watcher: 'levelRun.stepWatchersNow — `keyNeeded` false (NPCs/Watcher.as:46), so it '
        + 'opens on PROXIMITY, and its doneTalking/seed/sword halves are R6 slice 6c-d',
});
