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
     * It is entered here as the textless case BECAUSE the only reachable
     * placement is keyType 4. A rung that reaches L19 has to split this
     * entry by keyType rather than change it, and would find out by the
     * ceremony costing 150 ticks the recording does not have.
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

/** The tape key whose RELEASE advances a dialogue — `Player.keys[6]` is X. */
export const TALK_KEY = 'primary';
