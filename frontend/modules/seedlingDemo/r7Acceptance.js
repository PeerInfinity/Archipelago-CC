/**
 * seedlingDemo/r7Acceptance — R7's ledgers, DERIVED, as pure functions.
 * Brief: `NewDocs/plans/seedling-bot-r7-opus-kickoff.md` (§3.2 the seam,
 * §3.3 the goal ledger, §3.4 the batch, §7 the gates, §8 slice 0's
 * as-built).
 *
 * R6 counted BOSS KILLS. **R7 counts COLLECTIBLES AND SEAMS** — every
 * item in the game earned inside a driven segment, and every segment
 * boundary a measured equality rather than a staged grant.
 *
 * ── ⛔ TRAP 119 IS THIS MODULE'S CONSTRUCTION, NOT ITS COMMENT ────────
 *
 * R6 slice 7 found `hasShield` uncollected by READING THE TAPES, three
 * slices after the rung's own gate started reporting 6/6 and 8/8 GREEN.
 * The cause: `r6ExitCriteria()` returned `items: R6_ITEM_LEDGER` as a
 * PASSTHROUGH field, and `r6ExitFindings()` emitted a row for every kill
 * tag and none for `items`. An exit gate says nothing about a ledger it
 * merely carries.
 *
 * So here every findings function is a `.map()` OVER a ledger. There is
 * no hand-written findings row for any ledger entry anywhere in this
 * file, which is why a row added tomorrow cannot go unreported — and
 * `r7Acceptance.test.js` asserts exactly that by ADDING one.
 *
 * ── ⛔ AND NO COUNT IS STORED ─────────────────────────────────────────
 *
 * Carried from R6 (which carried it from R5's two rotted counts). Every
 * total is `ledger.length` or a filter over the roster at call time.
 */

import { fixtureNames } from './fixtures/index.js';
/**
 * ⚠⚠ EVERY BINDING BELOW IS READ INSIDE A FUNCTION AND NEVER AT MODULE
 * SCOPE, and that is not a style choice — it is what keeps the cycle this
 * module already sits in from becoming a TDZ crash.
 *
 * `tapeFormat` imports `SEAM_BOOT_SPEC` from HERE (trap 86: the v8 key list
 * must come from the signature's owner, never be retyped), and it defuses
 * that by reading it inside `parseSeam`. This import closes the loop the
 * other way. When `tapeFormat` is the entry point the order is
 * `tapeFormat -> r7Acceptance -> fixtures/index -> tapeFormat (partial)`,
 * so these five bindings are in their temporal dead zone while this
 * module's body evaluates. A module-scope `SAVE_SLOTS.keys` would throw —
 * which is why the array arities below come from `SEAM_SIGNATURE`'s own
 * `arity` fields instead, and why nothing here is destructured eagerly.
 */
// eslint-disable-next-line import/no-cycle
import {
    PIN_NAMES, inventorySlotsFor, seamFieldsFromBlock, seamToBlock,
} from './tapeFormat.js';

export class R7AcceptanceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'R7AcceptanceError';
    }
}

// ── THE SEAM SIGNATURE ────────────────────────────────────────────────

/**
 * ⛔ THE GAME'S OWN KEY LIST FOR `Main.SAVE_FILE.data`, transcribed from
 * `Main.startSave()` (`Main.as:229-338`) IN ITS OWN ORDER.
 *
 * `startSave` is the normalizer the game runs at boot: it reads every save
 * field and writes it back, so a null becomes a false. That makes it the
 * one place in the source that ENUMERATES the save shape, and it is
 * therefore the coverage list `SEAM_SIGNATURE` is checked against
 * (trap 86: a hand-written bag drops a family every time — assert it
 * against a list the owner exports).
 *
 * ⚠ `hasBadge` is in the list and is NOT a seam field: `Main.unlockMedal`
 * returns early on ARMORGAMES and writes through `QuickKong` on
 * KONGREGATE, so a badge is a distribution fact. It gets a row with
 * `comparable: 'excluded'` and its reason, never an omission.
 */
export const SAVE_FILE_KEYS = Object.freeze([
    'hasSword', 'hasGhostSword', 'hasShield', 'hasFire', 'hasWand', 'hasFireWand',
    'canSwim', 'hasSpear', 'hasDarkShield', 'hasDarkSuit', 'hasDarkSword',
    'hasFeather', 'hasTorch', 'beam', 'rockSet', 'hitsMax', 'firstUse', 'extended',
    'time', 'primary', 'secondary', 'grassCut',
    'hasBadge', 'hasKey', 'hasTotemPart', 'hasSealPart', 'levelPersistence',
    'playerPositionX', 'playerPositionY', 'level',
]);

/**
 * ⛔⛔⛔ COMPARABILITY IS PER FIELD AND SOMETIMES PER LEVEL — a seam
 * signature that asserts equality on every row is a signature that goes
 * RED for reasons that are not defects.
 *
 * Three rows carry that qualification and each earns it differently:
 *
 *  · `rng.gameplay` — `Rng.cos()` is a GAMEPLAY draw while `Rng.split` is
 *    off (the default), and four sites draw from `render()`
 *    (`r6Acceptance.RENDER_SIDE_DRAW_SITES`). A render count is the
 *    ±2-banded quantity the dead-frame work measured, so in a level with a
 *    render-side site the stream POSITION at an arrival is not
 *    update-determined and cannot be an equality field. R6's
 *    `rngPostureOf` deliberately tolerates a polluter with no consumer —
 *    correct for "is this WINDOW reproducible", wrong for "is this STATE
 *    equal". Use `seamRngPosture` below, which is the stricter question.
 *    ⛔ AND THE FIRST SEGMENT IS IN THE AT-RISK CLASS: L0 holds the game's
 *    only `moonrock`, whose `drawFlares` is 280 draws per render frame —
 *    gated on `!trigger && beam && canBeam`, and `beam` is set by
 *    `Shield.removed()` (`Shield.as:46`). So the overworld is render-clean
 *    until D2's shield and render-coupled forever after: the rung's own
 *    headline item is what arms the polluter.
 *
 *  · `time` — `Game.update` runs `time += timeRate` BELOW the `blackCover`
 *    gate but OUTSIDE it (`Game.as:832`), so it counts every
 *    `Game.update()` including DEAD frames. Dead frames are per-RENDER in
 *    vanilla and per-UPDATE under `Bot.pinDeadFrames`; the field is an
 *    equality only under the pin.
 *
 *  · `fp.seed` — FlashPunk's own Park-Miller LCG. It has NO gameplay
 *    consumer in this game (see the row), and its stream advances from
 *    `render()` in any level with a waterfall Emitter, so it is declared
 *    and asserted only under `split`-style conditions rather than carried
 *    as an equality.
 */
export const SEAM_SIGNATURE = Object.freeze([
    // ── 1. the boot arguments ─────────────────────────────────────────
    Object.freeze({
        field: 'level', group: 'boot', saveKey: 'level', comparable: 'equality',
        cite: 'Main.as:198-199',
        why: 'the level a segment ends in and the next boots into',
    }),
    Object.freeze({
        field: 'playerPositionX', group: 'boot', saveKey: 'playerPositionX',
        comparable: 'equality', cite: 'Main.as:194-197',
        why: '⚠ the CONSTRUCTOR argument, not the entity point — `spawnFromBoot` '
            + 'adds (Tile.w/2, Tile.h/2)',
    }),
    Object.freeze({
        field: 'playerPositionY', group: 'boot', saveKey: 'playerPositionY',
        comparable: 'equality', cite: 'Main.as:194-197', why: 'as above',
    }),

    // ── 2. the save arrays ────────────────────────────────────────────
    ...['hasSword', 'hasGhostSword', 'hasShield', 'hasFire', 'hasWand', 'hasFireWand',
        'canSwim', 'hasSpear', 'hasDarkShield', 'hasDarkSuit', 'hasDarkSword',
        'hasFeather', 'hasTorch'].map((k) => Object.freeze({
        field: `save.${k}`, group: 'save', saveKey: k, comparable: 'equality',
        cite: 'Main.as:140-190', why: 'an item flag, written eagerly, no flush anywhere',
    })),
    Object.freeze({
        field: 'save.beam', group: 'save', saveKey: 'beam', comparable: 'equality',
        cite: 'Pickups/Shield.as:46 -> Scenery/Moonrock.as:22-24 -> Main.as:180',
        why: '⛔ NOT an independent collectible and NOT unwritten — `Shield.removed()` '
            + 'sets `Moonrock.beam = true`, which is `Main.beam`. The kickoff §2.2 '
            + 'excluded it as having "no writer among pickups"; the writer is the one '
            + 'pickup this rung exists to earn. It is also the gate on L0\'s 280-draw '
            + 'render-side flare, so it DATES the overworld\'s RNG posture.',
    }),
    Object.freeze({
        field: 'save.rockSet', group: 'save', saveKey: 'rockSet', comparable: 'equality',
        cite: 'Scenery/Moonrock.as:118 -> Game.as:500-502 -> Main.as:181',
        why: '⛔ ALSO WRITTEN, and gameplay-visible: `Moonrock`\'s ctor reads '
            + '`Game.moonrockSet` and, when set, drops the rock to `fallTo` and makes '
            + 'it `type = "Solid"` — a 48x48 wall that is not there otherwise. A '
            + 'routing fact for rules v1, not a cosmetic flag.',
    }),
    Object.freeze({
        field: 'save.hitsMax', group: 'save', saveKey: 'hitsMax', comparable: 'equality',
        cite: 'Main.as:155, Pickups/HealthPickup.as:59',
        why: '3 -> 4 once, at L68; the getter returns `Player.hitsMaxDef` for 0',
    }),
    Object.freeze({
        field: 'save.firstUse', group: 'save', saveKey: 'firstUse', comparable: 'equality',
        cite: 'Main.as:156', why: 'inventory help state; gates a freeze, so it is not cosmetic',
    }),
    Object.freeze({
        field: 'save.extended', group: 'save', saveKey: 'extended', comparable: 'equality',
        cite: 'Main.as:157', why: 'as above',
    }),
    Object.freeze({
        field: 'save.time', group: 'save', saveKey: 'time', comparable: 'pinned-equality',
        pin: 'Bot.pinDeadFrames',
        cite: 'Game.as:832 (`time += timeRate`, below the blackCover gate, outside it)',
        why: 'counts every `Game.update()` INCLUDING dead frames. Vanilla dead-frame '
            + 'counts are per-RENDER and ±2-banded per load; under the pin they are '
            + 'update-determined and the field is exact.',
    }),
    Object.freeze({
        field: 'save.primary', group: 'save', saveKey: 'primary', comparable: 'equality',
        cite: 'Main.as:159', why: 'the equipped slot — §3.2 item 2\'s "equips"',
    }),
    Object.freeze({
        field: 'save.secondary', group: 'save', saveKey: 'secondary', comparable: 'equality',
        cite: 'Main.as:160', why: 'as above',
    }),
    Object.freeze({
        field: 'save.grassCut', group: 'save', saveKey: 'grassCut', comparable: 'equality',
        cite: 'Main.as:188', why: 'a counter with a badge threshold at 10000; declared '
            + 'and asserted equal even though nothing in a segment reads it',
    }),
    Object.freeze({
        field: 'save.hasKey', group: 'save', saveKey: 'hasKey', comparable: 'equality',
        arity: 5, cite: 'Player.as:258 (`totalKeys`), Main.as:191',
        why: 'five booleans, positional by keyType',
    }),
    Object.freeze({
        field: 'save.hasTotemPart', group: 'save', saveKey: 'hasTotemPart',
        comparable: 'equality', arity: 5, cite: 'Player.as:276, Main.as:192',
        why: 'five booleans; all five gate the Wand',
    }),
    Object.freeze({
        field: 'save.hasSealPart', group: 'save', saveKey: 'hasSealPart',
        comparable: 'equality', arity: 16, cite: 'SealController.SEALS, Main.as:193',
        why: '⛔ POSITIONAL INTS with a -1 sentinel, and they GATE A DRAW COUNT: '
            + '`Chest.open`\'s rejection sampler redraws until it finds an unused slot, '
            + 'so how many `Math.random()` draws a chest costs is a function of this '
            + 'array. A seam that drops it cannot price any window containing a chest.',
    }),
    Object.freeze({
        field: 'save.levelPersistence', group: 'save', saveKey: 'levelPersistence',
        comparable: 'equality', arity: 116 * 30,
        cite: 'Main.as:201-202, Game.tagsPerLevel = 30 (Game.as:525)',
        why: '⚠ carries the DarkSword\'s stray write: `Witch.as:51` constructs it with '
            + 'tag -1, so its `removed()` lands in `levelPersistence[level*30 - 1]` — '
            + 'the PREVIOUS level\'s tag 29. A modelled fact, not a blocker.',
    }),
    Object.freeze({
        field: 'save.hasBadge', group: 'save', saveKey: 'hasBadge', comparable: 'excluded',
        cite: 'Main.as:211-224 (`unlockMedal`)',
        why: 'a DISTRIBUTION fact, not a game fact — `unlockMedal` returns early under '
            + 'ARMORGAMES and writes through QuickKong under KONGREGATE. Declared so '
            + 'the coverage assertion sees it; never compared.',
    }),

    // ── 3. the statics that survive a world swap ──────────────────────
    Object.freeze({
        field: 'static.Game.cutscene', group: 'static', comparable: 'equality', arity: 4,
        cite: 'Game.as:615',
        why: 'GAMEPLAY — `cutscene[2]` is the Seed\'s mode change, and every later '
            + '`Game` then spawns the player inert (trap 91)',
    }),
    Object.freeze({
        field: 'static.Game.shake', group: 'static', comparable: 'invariant',
        invariant: '=== 0 at a calm arrival',
        cite: 'Game.as:538, :1877-1882',
        why: 'survives the swap and decays in `view()`, which `Game.update` calls on '
            + 'DEAD frames too — so a nonzero shake at a seam drains across a fade '
            + 'whose length is render-coupled, and costs 2 gameplay draws a frame '
            + 'while it does. Asserted zero rather than carried.',
    }),
    Object.freeze({
        field: 'static.Game.menu', group: 'static', comparable: 'invariant',
        invariant: '=== false', cite: 'Game.as:448',
        why: 'a menu is a REBOOT LOOP, not a screen (trap 69)',
    }),
    Object.freeze({
        field: 'static.Game.menuState', group: 'static', comparable: 'equality',
        readout: 'botStatus.menu_state', cite: 'Game.as:585 (private static)',
        why: '⚠ PRIVATE — reachable only through the existing `botStatus.menu_state` '
            + 'readout R6 shipped; there is no public field to poll.',
    }),
    Object.freeze({
        field: 'static.Game.freezeObjects', group: 'static', comparable: 'invariant',
        invariant: '=== false', cite: 'Game.as:511',
        why: 'a calm arrival has no freeze; `begin()`\'s `inventory.check()` is what '
            + 'clears it, which is why the single page-lifetime Inventory is load-bearing',
    }),
    Object.freeze({
        field: 'static.Game.talking', group: 'static', comparable: 'invariant',
        invariant: '=== false', cite: 'Game.as:513',
        why: 'a dialogue frame is a TICK, not a dead frame — a seam inside one is not calm',
    }),
    Object.freeze({
        field: 'static.Game.inventory', group: 'static', comparable: 'invariant',
        invariant: 'the same instance across the swap', cite: 'Game.as:459',
        why: 'ONE instance for the page lifetime; the ctor only creates it `if '
            + '(!inventory)`. It is what `begin()` calls `check()` on.',
    }),
    Object.freeze({
        field: 'static.Music.currentSet', group: 'static', comparable: 'equality',
        readout: 'NEEDED — no accessor exists', cite: 'Music.as:83 (private static)',
        why: '⛔ PRIVATE STATIC, and §3.2 item 5 requires it: `Music.playSound`\'s '
            + 'do-while redraws while `cplayIndex == currentIndex && currentSet == '
            + 'strInd`, so these two decide a DRAW COUNT. Carrying them needs a new '
            + 'readout in the fork — a batch item §3.4 does not name.',
    }),
    Object.freeze({
        field: 'static.Music.currentIndex', group: 'static', comparable: 'equality',
        readout: 'NEEDED — no accessor exists', cite: 'Music.as:84 (private static)',
        why: 'as above; same batch item',
    }),
    Object.freeze({
        field: 'static.Rng.split', group: 'static', comparable: 'equality',
        cite: 'Rng.as:63', readout: 'tape v7 boot block',
        why: 'decides whether `Rng.cos()` is a gameplay draw or a cosmetic one',
    }),
    Object.freeze({
        field: 'static.Bot.pins', group: 'static', comparable: 'equality',
        cite: 'Bot.pinDeadFrames / pinSoundClock / …',
        why: 'the R5 pins change which quantity is update-determined; two segments on '
            + 'different pins are not a chain',
    }),

    // ── 4. the three generators ───────────────────────────────────────
    Object.freeze({
        field: 'rng.gameplay', group: 'rng', comparable: 'level-qualified-equality',
        readout: 'botStatus.rng.state (R6 slice 6a)', cite: 'Rng.as:118-121',
        why: 'one uint32; write == reset. Equality holds only where the level has NO '
            + 'render-side draw site — see `seamRngPosture`.',
    }),
    Object.freeze({
        field: 'rng.cosmetic', group: 'rng', comparable: 'level-qualified-equality',
        readout: 'Rng.cosDraw / the cosmetic hooks', cite: 'Rng.as:98-116',
        why: 'the second generator; IS the gameplay stream while `split` is off',
    }),
    Object.freeze({
        field: 'fp.seed', group: 'rng', comparable: 'declared-not-compared',
        readout: '⛔ `FP.randomSeed` DOES NOT ANSWER THIS',
        cite: 'net/flashpunk/FP.as:391-395, :409-423, :715-716',
        why: '⛔⛔ THE OBVIOUS ACCESSOR READS THE WRONG VARIABLE. `FP.randomSeed`\'s '
            + 'getter returns `_getSeed`, which only the SETTER writes; `random` and '
            + '`rand` advance `_seed` and leave `_getSeed` alone. A hook built on the '
            + 'public property returns the seed as last SET, not the live state — a '
            + 'silent wrong answer in a field about which stream the run is on. '
            + '⛓ AND THE FIELD IS NOT NEEDED FOR BEHAVIOUR: every `FP.choose`/`FP.rand` '
            + 'consumer in this game is render-only — `Enemy.as:96` and `Player.as:754` '
            + 'add `fallSpinSpeed` to a graphic ANGLE, `HealthPickup.as:25-26` mirror a '
            + 'sprite whose hitbox is a fixed `setHitbox(4,4,2,2)`, and `RockFall`\'s '
            + 'FP draws set `angleRate`\'s sign and `scaleX` while the hitbox-bearing '
            + '`scale` comes from `Math.random()` (the GAMEPLAY stream, already hooked). '
            + 'FlashPunk\'s own uses are `Emitter` (waterfall spray, from `render()`) '
            + 'and `Spritemap.randFrame` (uncalled here). ⇒ kickoff §2.1\'s "gameplay-'
            + 'relevant (RockFall scale/spin)" conflates the two streams.',
    }),

    // ── 5. the calm-arrival invariants ────────────────────────────────
    Object.freeze({
        field: 'arrival.blackCover', group: 'invariant', comparable: 'invariant',
        invariant: '<= 0 (the fade is spent)', cite: 'Game.as:518, :821',
        why: 'end tapes at ARRIVAL, post-fade — never on the trigger tick, where the '
            + 'OLD world is still current with the NEW `Main.level` already written',
    }),
    Object.freeze({
        field: 'arrival.velocity', group: 'invariant', comparable: 'invariant',
        invariant: 'v === (0, 0), hits === 0, hitsTimer === 0',
        cite: 'Game.as:2080-2105',
        why: 'a transition CONSTRUCTS a fresh Player; an arrival is the constructor '
            + 'half-tile with zero velocity (R1\'s ENDS-MEET convention)',
    }),
]);

/**
 * ⛔⛔ EVERY SIGNATURE ROW NEEDS EXACTLY ONE CHANNEL — R7 slice 1.
 *
 * A seam is `boot(N+1) == latch(N)`. The LATCH side is one function
 * (`Bot.latchSeam`, keyed by these same field strings); the BOOT side is
 * spread over eight tape blocks, because six rungs of tape versions each
 * added the state their own slice needed. So the question "can a segment
 * declare this field" has an answer per row, and this is where it lives:
 *
 *   boot        v1 `boot` {level, x, y}
 *   persistence v3 `persistence` — the CLEAR SET is the whole array (the
 *               fresh array is all-true and `botStart` re-writes it)
 *   pins        v5 `pins`
 *   save        v6 `save` {totem_parts, keys, seal_parts}
 *   rng         v7 `rng` {seed, split} + R7's {cosmetic, fp}
 *   seam        v8 `seam` — ⇐ THE ROWS THAT HAD NO CHANNEL BEFORE R7
 *   derived     reproduced as a CONSEQUENCE of declared rows; compared,
 *               never declared (the inventory slot array is what
 *               `addItemsFromSave` builds from the item flags)
 *   invariant   asserted at a calm arrival rather than carried
 *   excluded    never compared (`hasBadge`, a distribution fact)
 *
 * ⛔ IT IS ASSERTED TOTAL, not written and trusted. A signature row added
 * tomorrow with no entry here THROWS — which is the only construction that
 * makes "the v8 block carries the whole signature" a fact rather than a
 * claim about the day it was written (trap 86, in the shape it takes when
 * the list is a wire format).
 */
export const SEAM_CHANNELS = Object.freeze({
    level: 'boot',
    playerPositionX: 'boot',
    playerPositionY: 'boot',
    'save.hasKey': 'save',
    'save.hasTotemPart': 'save',
    'save.hasSealPart': 'save',
    'save.levelPersistence': 'persistence',
    'save.hasBadge': 'excluded',
    'static.Bot.pins': 'pins',
    'static.Rng.split': 'rng',
    'rng.gameplay': 'rng',
    'rng.cosmetic': 'rng',
    'fp.seed': 'rng',
    'static.Game.inventory': 'derived',
    'static.Game.shake': 'invariant',
    'static.Game.menu': 'invariant',
    'static.Game.freezeObjects': 'invariant',
    'static.Game.talking': 'invariant',
    'arrival.blackCover': 'invariant',
    'arrival.velocity': 'invariant',
    // ── the v8 block ──────────────────────────────────────────────────
    'save.hasSword': 'seam',
    'save.hasGhostSword': 'seam',
    'save.hasShield': 'seam',
    'save.hasFire': 'seam',
    'save.hasWand': 'seam',
    'save.hasFireWand': 'seam',
    'save.canSwim': 'seam',
    'save.hasSpear': 'seam',
    'save.hasDarkShield': 'seam',
    'save.hasDarkSuit': 'seam',
    'save.hasDarkSword': 'seam',
    'save.hasFeather': 'seam',
    'save.hasTorch': 'seam',
    'save.beam': 'seam',
    'save.rockSet': 'seam',
    'save.hitsMax': 'seam',
    'save.firstUse': 'seam',
    'save.extended': 'seam',
    'save.time': 'seam',
    'save.primary': 'seam',
    'save.secondary': 'seam',
    'save.grassCut': 'seam',
    'static.Game.cutscene': 'seam',
    'static.Game.menuState': 'seam',
    'static.Music.currentSet': 'seam',
    'static.Music.currentIndex': 'seam',
});

/**
 * ⛔⛔⛔ THE v8 `seam` BLOCK'S SCHEMA — the ONE list both validators read.
 *
 * `tapeFormat.parseSeam` walks this; `Bot.botLoadTape` states the same
 * bounds in AS3, each beside the game line that makes it a bound rather
 * than a taste. **The bounds are not preferences and none of them is
 * round-numbered by choice:**
 *
 *  · `hits_max`, `time`, `primary`, `secondary` — `Main`'s own getters have
 *    a FALSY ARM (`Main.as:155-161`): a stored 0 returns `Player.hitsMaxDef`
 *    for `hitsMax` and `Game.dayLength / 2` for `time`. 0 is therefore
 *    UNREPRESENTABLE for those two and means "not declared" here.
 *  · `grass_cut` — `Main`'s SETTER calls `unlockMedal` at >= 10000
 *    (`Main.as:191`), and `unlockMedal` is the distribution path that makes
 *    `hasBadge` the one excluded signature row. A state declaration must
 *    not be able to reach outside the game.
 *  · `menu_state` — `Game`'s ctor honours a `_menuState` argument and then
 *    calls `end()`, which runs `menuState = 0` for every `!menu` world
 *    (`Game.as:638-639`, `:665-668`). A calm arrival is `!menu` by
 *    definition, so 0 is the only value that survives one. Declared and
 *    bounded rather than dropped, so the row has a channel and the
 *    impossibility is written where it is checked.
 *  · `fp` — `FP.randomSeed`'s setter is `_seed = clamp(value, 1,
 *    2147483646)` (`FP.as:392`), so 2147483647 would be applied as a
 *    DIFFERENT state than declared. A field whose declared and applied
 *    values disagree is worse than one that is absent.
 *
 * ⚠ `modelled: false` names the fields the JS engine carries and does NOT
 * simulate. They are transported, validated and compared at the seam; no
 * physics reads them. Saying which is which is the difference between a
 * declared field and a silently ignored one.
 */
export const SEAM_BOOT_SPEC = Object.freeze([
    ...['hasSword', 'hasGhostSword', 'hasShield', 'hasFire', 'hasWand', 'hasFireWand',
        'canSwim', 'hasSpear', 'hasDarkShield', 'hasDarkSuit', 'hasDarkSword',
        'hasFeather', 'hasTorch'].map((k) => Object.freeze({
        key: `items.${k}`, field: `save.${k}`, type: 'boolean', modelled: true,
        why: 'the boot item flags — applied BEFORE the first world builds, which a '
            + '`grants` row cannot be: a grant fires on the first observation tick in '
            + 'its level, by which time the pickup it should have despawned is standing',
    })),
    Object.freeze({
        key: 'beam', field: 'save.beam', type: 'boolean', modelled: false,
        why: 'gates L0\'s 280-draw moonrock flare; `Shield.removed()` sets it',
    }),
    Object.freeze({
        key: 'rock_set', field: 'save.rockSet', type: 'boolean', modelled: false,
        why: '⚠ GAMEPLAY: `Moonrock`\'s ctor drops the rock and makes it a 48x48 Solid',
    }),
    Object.freeze({
        key: 'hits_max', field: 'save.hitsMax', type: 'int', min: 1, max: 99,
        zeroMeansUndeclared: true, modelled: true,
        why: '3 -> 4 once, at L68; 0 is `Main.hitsMax`\'s falsy arm (Player.hitsMaxDef)',
    }),
    Object.freeze({
        key: 'first_use', field: 'save.firstUse', type: 'boolean', modelled: false,
        why: 'gates a tutorial FREEZE, so it is not cosmetic',
    }),
    Object.freeze({
        key: 'extended', field: 'save.extended', type: 'boolean', modelled: false,
        why: 'as above',
    }),
    Object.freeze({
        key: 'time', field: 'save.time', type: 'number', min: 0, max: 4294967295,
        exclusiveMin: true, zeroMeansUndeclared: true, modelled: false,
        why: 'day/night phase; 0 is `Main.time`\'s falsy arm (Game.dayLength / 2). '
            + 'Comparable only under `Bot.pinDeadFrames` — it counts DEAD frames too',
    }),
    Object.freeze({
        key: 'primary', field: 'save.primary', type: 'int', min: 0, max: 5,
        modelled: true,
        why: 'a SLOT INDEX into the array `Inventory.getItem` reads — six ids exist, so '
            + 'six slots is what `addItemsFromSave` plus its fusion splices can reach; '
            + 'an out-of-range write is a SILENT no-op (Inventory.itemCount\'s docblock)',
    }),
    Object.freeze({
        key: 'secondary', field: 'save.secondary', type: 'int', min: 0, max: 5,
        modelled: false, why: 'as above',
    }),
    Object.freeze({
        key: 'grass_cut', field: 'save.grassCut', type: 'int', min: 0, max: 9999,
        modelled: false,
        why: '⛔ the ceiling is a SIDE EFFECT, not a range — `Main`\'s setter calls '
            + '`unlockMedal` at >= 10000',
    }),
    Object.freeze({
        key: 'cutscene', field: 'static.Game.cutscene', type: 'boolean[]', arity: 4,
        modelled: true,
        why: 'GAMEPLAY — `cutscene[2]` is the Seed\'s mode change and every later '
            + '`Game` then spawns the player inert (trap 91)',
    }),
    Object.freeze({
        key: 'menu_state', field: 'static.Game.menuState', type: 'int', min: 0, max: 0,
        modelled: true,
        why: '⛔ 0 IS THE ONLY VALUE A CALM ARRIVAL CAN CARRY — `Game.end()` writes '
            + '`menuState = 0` for every `!menu` world (Game.as:665-668)',
    }),
    Object.freeze({
        key: 'music.set', field: 'static.Music.currentSet', type: 'string',
        modelled: false,
        why: 'the no-repeat REJECTION LOOP\'s state: `playSound` redraws while '
            + '`cplayIndex == currentIndex && currentSet == strInd`, so these two '
            + 'decide a DRAW COUNT',
    }),
    Object.freeze({
        key: 'music.index', field: 'static.Music.currentIndex', type: 'int', min: -1,
        modelled: false,
        why: 'as above; -1 is "nothing has played" and the fresh-page value',
    }),
]);

/**
 * ⛔ EVERY SIGNATURE ROW HAS A CHANNEL, AND EVERY v8 KEY HAS A ROW.
 *
 * Two-sided on purpose: a row with no channel is a field a segment cannot
 * declare and nobody said so; a spec entry naming a field the signature
 * does not have is a wire field nothing compares.
 */
export function assertSeamChannelsTotal() {
    const missing = SEAM_SIGNATURE.map((r) => r.field)
        .filter((f) => !Object.prototype.hasOwnProperty.call(SEAM_CHANNELS, f));
    if (missing.length) {
        throw new R7AcceptanceError(
            `SEAM_CHANNELS has no channel for ${missing.length} signature row(s): `
            + `${missing.join(', ')}. A row with no channel is a field a segment `
            + 'cannot declare, and a signature nobody can boot is not a seam.');
    }
    const fields = new Set(SEAM_SIGNATURE.map((r) => r.field));
    const stray = Object.keys(SEAM_CHANNELS).filter((f) => !fields.has(f));
    if (stray.length) {
        throw new R7AcceptanceError(
            `SEAM_CHANNELS names ${stray.join(', ')}, which SEAM_SIGNATURE does not.`);
    }
    const seamRows = SEAM_SIGNATURE.filter((r) => SEAM_CHANNELS[r.field] === 'seam')
        .map((r) => r.field);
    const spec = new Set(SEAM_BOOT_SPEC.map((s) => s.field));
    const unspecced = seamRows.filter((f) => !spec.has(f));
    if (unspecced.length) {
        throw new R7AcceptanceError(
            `${unspecced.join(', ')} route to the v8 \`seam\` block and SEAM_BOOT_SPEC `
            + 'has no entry for them — the block would silently not carry them.');
    }
    const orphan = [...spec].filter((f) => !seamRows.includes(f));
    if (orphan.length) {
        throw new R7AcceptanceError(
            `SEAM_BOOT_SPEC declares ${orphan.join(', ')}, which no signature row `
            + 'routes to the seam block.');
    }
    return {
        rows: SEAM_SIGNATURE.length,
        seamKeys: SEAM_BOOT_SPEC.length,
        byChannel: SEAM_SIGNATURE.reduce((acc, r) => {
            const c = SEAM_CHANNELS[r.field];
            acc[c] = (acc[c] ?? 0) + 1;
            return acc;
        }, {}),
    };
}

/**
 * ⛔ THE COVERAGE ASSERTION (trap 86). Every key the GAME normalizes has a
 * row; every row that claims a save key names a real one.
 *
 * An unlisted key is a SILENCE, not an error — which is why this throws
 * rather than logging, and why the list it checks against is transcribed
 * from `Main.startSave()` rather than written from the signature.
 */
export function assertSeamSignatureCovers(keys = SAVE_FILE_KEYS) {
    const claimed = new Set(SEAM_SIGNATURE.map((r) => r.saveKey).filter(Boolean));
    const missing = keys.filter((k) => !claimed.has(k));
    if (missing.length) {
        throw new R7AcceptanceError(
            `SEAM_SIGNATURE has no row for ${missing.length} save key(s) the game's own `
            + `normalizer writes: ${missing.join(', ')}. An unlisted key is a silence.`);
    }
    const known = new Set(keys);
    const stray = [...claimed].filter((k) => !known.has(k));
    if (stray.length) {
        throw new R7AcceptanceError(
            `SEAM_SIGNATURE claims save key(s) \`Main.startSave()\` does not write: `
            + `${stray.join(', ')}.`);
    }
    return { rows: SEAM_SIGNATURE.length, saveKeys: keys.length };
}

/**
 * ⛔ THE SEAM'S RNG POSTURE — a STRICTER question than
 * `r6Acceptance.rngPostureOf`, and the difference is the whole point.
 *
 * R6 asked "is a WINDOW in this room reproducible", and answered EXACT
 * unless a render-coupled polluter meets a gameplay consumer: a polluter
 * with nothing reading it is harmless, because nothing reads it.
 *
 * A SEAM asks "is the stream STATE equal on both sides", and a polluter
 * alone breaks that — the state differs by however many draws the render
 * count happened to take, and a render count is the ±2-banded quantity.
 * So `rng.gameplay` is an equality field only in a render-CLEAN level,
 * and elsewhere the behavioural claim has to rest on the consumer census
 * instead ("the state differs and nothing reads it").
 *
 * @param {string[]} renderSites the render-side draw sites present in this
 *                               level (`r6Acceptance.rngPostureOf(...).renderCoupled`)
 * @param {string[]} consumers   the gameplay draw consumers present
 */
export function seamRngPosture(renderSites = [], consumers = []) {
    const clean = renderSites.length === 0;
    return {
        renderSites: [...renderSites],
        consumers: [...consumers],
        comparable: clean,
        verdict: clean
            ? 'RENDER-CLEAN — the stream position is update-determined, so the state '
                + 'is an equality field at this seam'
            : consumers.length
                ? `AT RISK — ${renderSites.join('; ')} against consumer(s) `
                    + `${consumers.join(', ')}: the state is not comparable AND something `
                    + 'reads it. The seam must reseed and say so.'
                : `NOT COMPARABLE, NOT READ — ${renderSites.join('; ')}. The state is a `
                    + 'render count away from its neighbour and nothing consumes the '
                    + 'difference; carry the delta, do not assert equality.',
    };
}

/**
 * ⛔⛔⛔ THE BOOT SIDE — a WHOLE TAPE, all eight blocks, as a signature
 * field map. R7 slice 2.
 *
 * `seamLatchFindings` reads the EXIT side (one `botSeam()` envelope, keyed
 * by `SEAM_SIGNATURE[].field` because `Bot.latchSeam` emits those strings).
 * This is the other half, and until it existed `seamFindings` had nothing
 * to compare a latch AGAINST — a seam checker with one side is a checker
 * that cannot fail.
 *
 * ⛔ THE MAP IS DRIVEN BY `SEAM_CHANNELS`, NOT BY A SECOND LIST. Every row
 * routes to exactly one tape block and the routing table already exists and
 * is already asserted total (`assertSeamChannelsTotal`). So this function
 * is a switch over CHANNELS, and a signature row added tomorrow arrives
 * here with its channel already decided — the same construction trap 119
 * forces on the findings functions, applied to the wire format.
 *
 * The eight channels, and what each contributes:
 *
 *   boot        `tape.boot` {level, x, y}
 *   save        `tape.save` — INDEX LISTS on the wire, POSITIONAL ARRAYS in
 *               the latch, so this is where the two shapes meet
 *   persistence `tape.persistence` — the CLEAR SET, which is the whole
 *               state (`Main.startSave` fills the array all-true)
 *   pins        `tape.pins` — a NAME LIST on the wire, a boolean record in
 *               the latch
 *   rng         `tape.rng` — ⚠ 0 means UNDECLARED for three of its four
 *               fields, so a 0 must emit NOTHING here rather than a 0
 *   seam        `tape.seam` — the v8 block, via `seamFieldsFromBlock`
 *   derived     computed FROM declared rows, never declared itself
 *   invariant   NOT on the boot side at all — see `seamFindings`
 *   excluded    never compared
 *
 * @param {object} tape a PARSED tape (`parseTape`), any version 1..8
 * @returns {object} `SEAM_SIGNATURE[].field` -> the value this tape declares
 */
export function seamBootFields(tape) {
    if (!tape) return {};
    const arityOf = (field) => SEAM_SIGNATURE.find((r) => r.field === field)?.arity;
    const out = {};

    // ── boot ──────────────────────────────────────────────────────────
    out.level = tape.boot.level;
    out.playerPositionX = tape.boot.x;
    out.playerPositionY = tape.boot.y;

    // ── save: index LISTS become positional arrays ────────────────────
    // ⚠ The two shapes are not a formatting difference. `Player.hasKey(i)`
    // and `Player.hasTotemPart(i)` are BOOLEANS per index, which is what the
    // latch pushes; the tape carries the SET of indices it presents. And
    // `hasSealPart` is neither — it is an ordered INT LOG whose empty slot
    // is -1 (`SealController.getSealPart` fills the first -1 slot), so the
    // tape's list is a PREFIX and the rest of the array is sentinel.
    const asBooleans = (list, n) => Array.from({ length: n }, (_, i) => list.includes(i));
    out['save.hasKey'] = asBooleans(tape.save.keys, arityOf('save.hasKey'));
    out['save.hasTotemPart'] = asBooleans(tape.save.totem_parts,
        arityOf('save.hasTotemPart'));
    const seals = Array.from({ length: arityOf('save.hasSealPart') }, () => -1);
    tape.save.seal_parts.forEach((identity, slot) => { seals[slot] = identity; });
    out['save.hasSealPart'] = seals;

    // ── persistence: the CLEAR SET, note dropped ──────────────────────
    // `Bot.persistenceClearedAll()` emits `{level, tag}` in (level, tag)
    // order and the parser sorts the tape's clears the same way, so the two
    // lists are directly comparable. `note` is authoring documentation and
    // the game has no field for it.
    out['save.levelPersistence'] = tape.persistence
        .map((c) => ({ level: c.level, tag: c.tag }));

    // ── pins: a name LIST becomes the latch's boolean record ──────────
    out['static.Bot.pins'] = Object.fromEntries(
        PIN_NAMES.map((n) => [n, tape.pins.includes(n)]));

    // ── rng: ⛔ 0 IS "UNDECLARED", AND EMITTING IT WOULD BE A LIE ─────
    // `botStart` gates all three writes on a non-zero (`Bot.as:1689-1698`),
    // so a tape carrying `seed: 0` inherits whatever the page had. A boot
    // map that reported 0 would compare EQUAL to a latch that happened to
    // be 0 and UNEQUAL otherwise — in both cases answering a question the
    // tape never asked. Absent means UNCLAIMED, which is the truth.
    out['static.Rng.split'] = tape.rng.split;
    if (tape.rng.seed !== 0) out['rng.gameplay'] = tape.rng.seed;
    if (tape.rng.cosmetic !== 0) out['rng.cosmetic'] = tape.rng.cosmetic;
    if (tape.rng.fp !== 0) out['fp.seed'] = tape.rng.fp;

    // ── seam: the v8 block ────────────────────────────────────────────
    Object.assign(out, seamFieldsFromBlock(tape.seam));

    // ── derived: the inventory SLOT ARRAY ─────────────────────────────
    // ⛔ ALL SIX FLAGS OR NOTHING. `inventorySlotsFor` reads six item flags
    // and treats a missing one as "not held", so a partial declaration
    // would produce a SHORTER array that compares unequal for a reason that
    // is not a seam defect — a silent wrong answer in the one row whose
    // whole nature is "reproduced as a consequence of declared rows".
    const slotItems = ['hasSword', 'hasFire', 'hasWand', 'hasSpear',
        'hasGhostSword', 'hasFireWand'];
    if (slotItems.every((k) => out[`save.${k}`] !== undefined)) {
        out['static.Game.inventory'] = inventorySlotsFor(
            Object.fromEntries(slotItems.map((k) => [k, out[`save.${k}`]])));
    }
    return out;
}

/**
 * ⛔ STRUCTURAL EQUALITY, KEY ORDER IGNORED — and it is not a nicety.
 *
 * Four signature rows carry OBJECTS across the wire: `static.Bot.pins`
 * (`{sound, dead_frames}`), `arrival.velocity`, and `save.levelPersistence`
 * (an array of `{level, tag}`). The exit side of every one of them is
 * serialized by the AVM2 runtime and the boot side by node, and
 * `JSON.stringify` on two objects with the same contents in a different
 * insertion order returns two different strings. Comparing those strings
 * compares SERIALIZERS, not states
 * ([[feedback_stringify_equality_across_runtimes]]) — and the first version
 * of `seamFindings` did exactly that, on a path nothing had ever run.
 */
function seamValuesEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        return a.length === b.length && a.every((v, i) => seamValuesEqual(v, b[i]));
    }
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i])
        && ka.every((k) => seamValuesEqual(a[k], b[k]));
}

/**
 * Per-seam findings, DERIVED by mapping the signature over every seam.
 *
 * A seam is `{name, exit, boot}` where `exit` is a latch's field map
 * (`seamLatchFindings`' envelope `.seam`) and `boot` is the successor
 * tape's (`seamBootFields`). A field missing on EITHER side is UNCLAIMED —
 * never "pending", never skipped. A partial latch is exactly the case trap
 * 111 predicts and the case §5's first bullet forbids shipping.
 *
 * ⛔⛔ THE INVARIANT ROWS ARE NOT EQUALITY ROWS, AND SLICE 2 IS WHERE THAT
 * STOPPED BEING A COMMENT. Six rows route to the `invariant` channel
 * (`SEAM_CHANNELS`) precisely because a tape CANNOT declare them: `shake`,
 * `menu`, `freezeObjects`, `talking`, the spent fade and the arrival
 * velocity are properties of the state a boot PRODUCES, not of the
 * declaration that produces it. Demanding `exit == boot` on them would have
 * made every real seam carry six permanently unclaimed rows — a checker
 * that is red for a reason that is not a defect is a checker people learn
 * to ignore. So they are asserted against the GAME's own latched numbers,
 * with the same predicates `seamLatchFindings` uses, and the boot side is
 * reported as what it is: not declarable.
 *
 * @param {Array} seams
 */
export function seamFindings(seams = []) {
    const out = [];
    for (const seam of seams) {
        const exit = seam.exit ?? {};
        const boot = seam.boot ?? {};
        for (const row of SEAM_SIGNATURE) {
            const name = `${seam.name}: ${row.field}`;
            if (row.comparable === 'excluded') {
                out.push({ name, ok: true, detail: `EXCLUDED — ${row.why.split('.')[0]}` });
                continue;
            }
            const inExit = Object.prototype.hasOwnProperty.call(exit, row.field);
            if (SEAM_CHANNELS[row.field] === 'invariant') {
                const inv = INVARIANT_CHECKS[row.field];
                if (!inExit) {
                    out.push({
                        name,
                        ok: false,
                        detail: 'UNCLAIMED — the exit latch does not carry it, and an '
                            + 'invariant row has no boot side to fall back on '
                            + `(${row.invariant}; ${row.cite})`,
                    });
                    continue;
                }
                const verdict = inv(exit[row.field]);
                out.push({
                    name,
                    ok: verdict.ok,
                    detail: `${verdict.ok ? 'calm' : '⛔ NOT CALM'} — ${verdict.detail} `
                        + `(asserted at the exit; a boot cannot declare it)`,
                });
                continue;
            }
            const inBoot = Object.prototype.hasOwnProperty.call(boot, row.field);
            // ⛔⛔⛔ `declared-not-compared` IS A THIRD CLASS, AND `fp.seed`
            // EARNS IT ON A FACT ABOUT THE PAGE, NOT ABOUT THE SEAM.
            //
            // FlashPunk's LCG is seeded ONCE PER PAGE from a single
            // `Math.random()` (`Engine.as:50`, `FP.as:401-413`) and never
            // reset. The differential replays every segment in its OWN
            // page, so segment N's latched `fp.seed` and segment N+1's are
            // two different random walks from two different random starts —
            // an equality there would be red on every run of every chain,
            // forever, for a reason that is not a defect.
            //
            // It is still REQUIRED ON BOTH SIDES. Segment N+1 declaring it
            // is what makes segment N+1 itself reproducible (the write arm
            // works: `FP.randomSeed`'s setter is the half of that property
            // that does), and a row nobody declares is a row nobody can
            // reason about. So: both sides or UNCLAIMED, and no comparison.
            // ⛓ Which costs nothing behavioural — slice 0 §8.2 item 3 swept
            // every `FP.choose`/`FP.rand` consumer in this game and all of
            // them are render-only.
            if (row.comparable === 'declared-not-compared' && inExit && inBoot) {
                out.push({
                    name,
                    ok: true,
                    detail: `DECLARED, NOT COMPARED — exit ${JSON.stringify(exit[row.field])}`
                        + `, boot ${JSON.stringify(boot[row.field])}. FlashPunk's LCG is `
                        + 'seeded once per PAGE from `Math.random()` and each segment '
                        + 'replays in its own page, so the two are different random walks '
                        + 'and no consumer in this game reads either.',
                });
                continue;
            }
            if (!inExit || !inBoot) {
                out.push({
                    name,
                    ok: false,
                    detail: `UNCLAIMED — ${!inExit && !inBoot ? 'neither side carries it'
                        : !inExit ? 'the exit latch does not carry it'
                            : 'the boot block does not declare it'}`
                        + ` (${row.comparable}, channel ${SEAM_CHANNELS[row.field]}; `
                        + `${row.cite})`,
                });
                continue;
            }
            const same = seamValuesEqual(exit[row.field], boot[row.field]);
            out.push({
                name,
                ok: same,
                detail: same
                    ? `${row.comparable}: ${JSON.stringify(exit[row.field])}`
                    : `exit ${JSON.stringify(exit[row.field])} vs boot `
                        + `${JSON.stringify(boot[row.field])}`,
            });
        }
    }
    out.push({
        name: 'every seam is checked over the whole signature',
        ok: seams.length > 0,
        detail: seams.length === 0
            ? '⛔ ZERO SEAMS — a chain with no seam is not a chain that passed'
            : `${seams.length} seam(s) x ${SEAM_SIGNATURE.length} signature row(s) `
                + `= ${out.length} row(s)`,
    });
    return out;
}

/**
 * ⛔⛔⛔ THE INVERSE — a latch back into the tape blocks that reproduce it.
 * This is the segment-authoring primitive the whole playthrough runs on.
 *
 * `seamBootFields` answers "what does this tape declare"; this answers
 * "what tape declares this state". It is driven by `SEAM_BOOT_SPEC` and
 * `SEAM_CHANNELS`, so neither key space is retyped and a signature row
 * added tomorrow either gets carried or THROWS by name.
 *
 * ⛔ IT REFUSES RATHER THAN ROUNDS. Three of the game's own getters have a
 * falsy arm (`hitsMax`, `time`, and the two slots via `Inventory`), which
 * makes 0 unrepresentable for two of them; `grassCut` at 10000 reaches
 * `unlockMedal`, outside the game; `menuState` can only be 0. A latched
 * state that violates any of those is a state no tape can declare, and
 * saying so by name is the difference between a chain with a hole in it and
 * a chain that silently drops a field.
 *
 * @param {object} envelope a `botSeam()` envelope (`{latched, partial, seam}`)
 * @returns {object} `{boot, save, persistence, pins, rng, seam}` — tape blocks
 */
export function segmentBootFromLatch(envelope) {
    if (!envelope || !envelope.latched || !envelope.seam) {
        throw new R7AcceptanceError(
            'segmentBootFromLatch needs a WHOLE latch. A segment booted from a '
            + `partial one would inherit a state nobody measured (${envelope
                ? `latched=${envelope.latched} partial=${envelope.partial} `
                    + `why=${envelope.why ?? ''}` : 'no envelope at all'}).`);
    }
    if (envelope.partial) {
        throw new R7AcceptanceError(
            '⛔ THE LATCH IS PARTIAL — a failure disarm latched what it could '
            + `(${envelope.why || 'no reason given'}). A partial latch is an `
            + 'UNCLAIMED seam (trap 111), never a boot state.');
    }
    const s = envelope.seam;
    const need = (field) => {
        if (!Object.prototype.hasOwnProperty.call(s, field)) {
            throw new R7AcceptanceError(
                `the latch does not carry \`${field}\`, which channel `
                + `${SEAM_CHANNELS[field]} needs to author a boot block`);
        }
        return s[field];
    };
    const refuse = (why) => { throw new R7AcceptanceError(why); };

    const boot = {
        level: need('level'), x: need('playerPositionX'), y: need('playerPositionY'),
    };
    const indicesOf = (arr) => arr.flatMap((v, i) => (v ? [i] : []));
    // ⚠ The seal log is a PREFIX, and it is read as one: everything up to
    // the first -1. A filled slot after an empty one is a state
    // `SealController.getSealPart` cannot produce (it fills the first -1),
    // so it is a defect in the latch and not a tape to author.
    const sealsRaw = need('save.hasSealPart');
    const firstEmpty = sealsRaw.indexOf(-1);
    const sealPrefix = firstEmpty === -1 ? sealsRaw.slice() : sealsRaw.slice(0, firstEmpty);
    if (firstEmpty !== -1 && sealsRaw.slice(firstEmpty).some((v) => v !== -1)) {
        refuse(`⛔ save.hasSealPart is NOT COMPACT: ${JSON.stringify(sealsRaw)}. `
            + '`SealController.getSealPart` fills the FIRST -1 slot, so a filled slot '
            + 'after an empty one is a state the game cannot reach.');
    }
    const save = {
        totem_parts: indicesOf(need('save.hasTotemPart')),
        keys: indicesOf(need('save.hasKey')),
        seal_parts: sealPrefix,
    };
    const persistence = need('save.levelPersistence')
        .map((c) => ({ level: c.level, tag: c.tag }));
    const pinsRecord = need('static.Bot.pins');
    const pins = PIN_NAMES.filter((n) => pinsRecord[n] === true);
    const rng = {
        seed: need('rng.gameplay'),
        split: need('static.Rng.split'),
        cosmetic: need('rng.cosmetic'),
        fp: need('fp.seed'),
    };
    if (rng.seed === 0) {
        refuse('⛔ the latched `rng.gameplay` is 0, which is the tape format\'s '
            + '"inherit the page\'s stream" value — a segment declaring it would boot '
            + 'an UNDECLARED stream while claiming to be contiguous.');
    }

    // ── the v8 block, keyed by SEAM_BOOT_SPEC, refusing what it cannot say
    const flat = {};
    for (const spec of SEAM_BOOT_SPEC) {
        const v = need(spec.field);
        if (spec.zeroMeansUndeclared && v === 0) {
            refuse(`⛔ the latched \`${spec.field}\` is 0 and \`${spec.key}\` cannot `
                + `carry a 0 — ${spec.why}`);
        }
        if ((spec.type === 'int' || spec.type === 'number') && spec.min !== undefined
            && (v < spec.min || (spec.max !== undefined && v > spec.max))) {
            refuse(`⛔ the latched \`${spec.field}\` is ${v}, outside `
                + `\`${spec.key}\`'s ${spec.min}..${spec.max ?? '∞'} — ${spec.why}`);
        }
        flat[spec.key] = Array.isArray(v) ? [...v] : v;
    }
    // ⛔ THE ONE RELATION NO SINGLE SPEC ROW CAN HOLD, refused HERE as well
    // as in `parseSeam`, because the message a segment author needs names
    // the LATCH and not the tape: `Music.playSound`'s do-while reads both
    // `currentIndex` and `currentSet`, so an index without a set is half a
    // rejection loop's state.
    if (flat['music.index'] !== -1 && !flat['music.set']) {
        refuse(`⛔ the latch carries music index ${flat['music.index']} with set `
            + `${JSON.stringify(flat['music.set'])} — an index without its set is half `
            + 'a state, and `Music.playSound`\'s rejection loop reads both.');
    }
    return { boot, save, persistence, pins, rng, seam: seamToBlock(flat) };
}

/**
 * ⛔⛔⛔ THE LATCH CONSUMER — findings DERIVED by mapping the signature over
 * one `botSeam()` envelope.
 *
 * The envelope is `{latched, partial, why, seam}` and `seam` is keyed by
 * `SEAM_SIGNATURE[].field` verbatim, because `Bot.latchSeam` emits those
 * strings. So this maps the signature, exactly as `seamFindings` and
 * `r7GoalFindings` do — trap 119's construction, third instance in this
 * file. There is no hand-written row for any signature field anywhere here.
 *
 * Three ways a row is NOT green, and each is a different fact:
 *
 *   · NO LATCH        the run never reached a disarm, or the build has no
 *                     `botSeam`. Every row UNCLAIMED, and the summary says
 *                     which — an absent readout must never read as a pass.
 *   · PARTIAL         a FAILURE disarm (`pinFault`, the equip check) latched
 *                     what it could. The state is real and worth reporting;
 *                     the SEAM is unclaimed, because the tape did not reach
 *                     its declared end (trap 111 + §5's first bullet).
 *   · MISSING FIELD   the latch is whole and this row is not in it — a
 *                     signature row the fork does not emit. UNCLAIMED, never
 *                     skipped: skipping is how a field added on one side
 *                     goes unreported for a rung.
 *
 * ⚠ THE INVARIANT ROWS ARE CHECKED, NOT MERELY PRESENT. A calm arrival is
 * what makes a latch bootable at all (§5: "end at arrivals, calm"), so
 * `shake == 0`, no freeze, no dialogue, no menu and a spent fade are
 * asserted here — against the GAME's own numbers.
 *
 * @param {object} envelope `botSeam()` parsed, or null
 * @param {object} [opts]   `{requireCalm}` — a tape that ends mid-window (a
 *                          director leg) is not claiming an arrival, so its
 *                          invariants are reported and not required
 */
export function seamLatchFindings(envelope, opts = {}) {
    const { requireCalm = true } = opts;
    const latched = Boolean(envelope && envelope.latched);
    const partial = Boolean(envelope && envelope.partial);
    const seam = (envelope && envelope.seam) || {};
    const out = SEAM_SIGNATURE.map((row) => {
        if (row.comparable === 'excluded') {
            return {
                name: `latch: ${row.field}`,
                ok: true,
                detail: `EXCLUDED — ${row.why.split('.')[0]}`,
            };
        }
        const has = Object.prototype.hasOwnProperty.call(seam, row.field);
        if (!latched || !has) {
            return {
                name: `latch: ${row.field}`,
                ok: false,
                detail: !latched
                    ? `UNCLAIMED — ${envelope ? 'the run never latched a seam'
                        : 'no botSeam envelope (a build without the R7 batch?)'}`
                    : `UNCLAIMED — the latch does not carry it (${row.comparable}; `
                        + `${row.cite})`,
            };
        }
        const v = seam[row.field];
        const inv = INVARIANT_CHECKS[row.field];
        if (inv && requireCalm) {
            const verdict = inv(v);
            return {
                name: `latch: ${row.field}`,
                ok: verdict.ok,
                detail: `${verdict.ok ? 'calm' : '⛔ NOT CALM'} — ${verdict.detail} `
                    + `(${row.invariant ?? row.comparable})`,
            };
        }
        return {
            name: `latch: ${row.field}`,
            ok: true,
            detail: `${row.comparable}: ${JSON.stringify(v)}`,
        };
    });
    out.push({
        name: 'the latch is whole',
        ok: latched && !partial,
        detail: !latched
            ? `⛔ NOTHING LATCHED${envelope?.why ? ` — ${envelope.why}` : ''}`
            : partial
                ? `⛔ PARTIAL — ${envelope.why || '(no reason given)'}; a failure disarm `
                    + 'latched what it could, so the seam is UNCLAIMED'
                : `${Object.keys(seam).length} field(s) latched at tick `
                    + `${seam['latch.tick']}`,
    });
    return out;
}

/**
 * The calm-arrival invariants, one predicate each, read off the GAME's own
 * latched numbers.
 *
 * ⚠ `static.Game.inventory` is NOT here: the signature's row is "the same
 * instance across the swap", which is a within-page fact no wire format can
 * carry, and what the latch sends instead is the SLOT ARRAY — state, not an
 * identity. It is compared at a seam like any other value.
 */
const INVARIANT_CHECKS = Object.freeze({
    'static.Game.shake': (v) => ({
        ok: v === 0,
        detail: `shake=${v}${v === 0 ? '' : ' — it decays in `view()`, which runs on '
            + 'DEAD frames too, so a nonzero shake drains across a render-coupled fade '
            + 'and costs 2 gameplay draws a frame while it does'}`,
    }),
    'static.Game.menu': (v) => ({
        ok: v === false, detail: `menu=${v}${v ? ' — a menu is a REBOOT LOOP (trap 69)' : ''}`,
    }),
    'static.Game.freezeObjects': (v) => ({
        ok: v === false,
        detail: `freezeObjects=${v}${v ? ' — a ceremony is still holding the world' : ''}`,
    }),
    'static.Game.talking': (v) => ({
        ok: v === false,
        detail: `talking=${v}${v ? ' — a dialogue frame is a TICK, not a dead frame; a '
            + 'seam inside one is not calm' : ''}`,
    }),
    // ⛔ THE LOWER BOUND IS NOT DECORATION, AND THIS MODULE'S OWN MUTATION
    // TEST IS WHAT FOUND IT. The predicate was `v <= 0`, which is right for
    // the fade — `blackCover` starts at 1 and decays by 0.05 a step, so a
    // spent one lands in (-0.05, 0] — and it ALSO accepted **-1**, which is
    // `latchSeam`'s own sentinel for "no `Game` was current". A latch taken
    // with no world would have read as the calmest possible arrival. The
    // window is therefore two-sided: below -0.5 is not a fade, it is a
    // sentinel or a defect, and either way it is not an arrival.
    'arrival.blackCover': (v) => ({
        ok: typeof v === 'number' && v <= 0 && v > -0.5,
        detail: `blackCover=${v}${typeof v === 'number' && v <= 0 && v > -0.5 ? ''
            : v === -1 ? ' — NO WORLD WAS CURRENT at the latch (the sentinel, not a '
                + 'spent fade: `blackCover` decays by 0.05 a step and cannot reach it)'
                : ' — the fade is still running, so this is a trigger tick and not an '
                    + 'arrival'}`,
    }),
    'arrival.velocity': (v) => ({
        ok: Boolean(v) && v.vx === 0 && v.vy === 0 && v.hits === 0 && v.hits_timer === 0,
        detail: v ? `v=(${v.vx}, ${v.vy}) hits=${v.hits} hitsTimer=${v.hits_timer}`
            : 'NO PLAYER at the latch',
    }),
});

// ── THE GOAL LEDGER ───────────────────────────────────────────────────

/**
 * ⛔ EVERY COLLECTIBLE IN THE GAME, ONE ROW EACH.
 *
 * The census is the atlas extract's, verified at slice 0 against
 * `seedling-map.json` entity by entity: 13 equipment/pickup placements,
 * 5 boss keys, 5 totem parts, 16 seal chests, and the Seed — plus the two
 * ENCOUNTER grants (`fire` off BobBoss, the DarkSword off the Witch)
 * which are placed nowhere.
 *
 * ⚠ THE SIXTEEN CHESTS ARE KEYED BY LEVEL, NEVER BY SEAL IDENTITY. The
 * identity is a rejection-sampled draw taken at chest OPEN (`Chest.as:84-89`),
 * so "which seal" is an RNG fact about a run and "which chest" is a fact
 * about the map. A ledger keyed on identity would be unreproducible by
 * construction.
 *
 * ⛔ AND `beam` / `rockSet` ARE NOT ROWS, for a reason the kickoff got
 * wrong. §2.2 excluded them as having "no writer among pickups". Both have
 * writers (`Shield.as:46`, `Moonrock.as:118`); what makes them non-rows is
 * that neither is independently COLLECTIBLE — each is a side effect. They
 * are seam-signature fields instead, and `beam` is an assertable witness
 * that the shield was earned rather than granted.
 */
export const R7_GOAL_LEDGER = Object.freeze([
    ...[
        ['sword', 10, 'hasSword', 'Dungeon1/8.oel:59', 'D1 walk'],
        // ⛔⛔ THE SHIELD IS THE ONE ROW WITH A SECOND, DURABLE WITNESS, and
        // R7 slice 1 had to be told so by the game. Slice 0 (§8.2 item 1)
        // called `Main.beam` "an assertable witness that the shield was
        // EARNED". It is not a witness at all — it is a ONE-SHOT TRIGGER:
        // `Moonrock.update` runs `if (beam && canBeam)` for `beamTimeMax =
        // FPS * 5` frames, plays "Light", then writes `beam = false;
        // trigger = true` (`Moonrock.as:88-106`), and the fall sets
        // `rockSet`. Measured in BOTH arms of the v8 probe: a window that
        // boots `beam: true` in L0 ends with it FALSE.
        //
        // ⇒ `save.rockSet` is the durable witness, and it is the same field
        // that makes the moonrock a 48x48 Solid — one field doing the goal
        // ledger's job and rules v1's routing job at once (§9.6 item 5).
        ['shield', 20, 'hasShield', 'Dungeon2/7.oel:145', 'ShieldBoss -> bosslock key 0',
            {
                durableWitness: 'save.rockSet',
                durableCite: 'Pickups/Shield.as:46 -> Scenery/Moonrock.as:88-118',
                durableWhy: '`Shield.removed()` sets `Moonrock.beam`; the moonrock '
                    + 'consumes it and writes `rockSet`, which SURVIVES. `beam` does '
                    + 'not, so a chain that witnessed `beam` would witness a value '
                    + 'that is false again by the next seam.',
            }],
        ['wand', 43, 'hasWand', 'Dungeon4/Boss.oel:238', 'all 5 totem parts + BossTotem'],
        ['firewand', 109, 'hasFireWand', 'Dungeon8/11.oel:108', 'D8 depth (L99 kill-lock)'],
        ['conch', 49, 'canSwim', 'Dungeon5/4.oel:53', 'D5 walk'],
        ['feather', 89, 'hasFeather', 'OverWorld/region6.oel:461', 'overworld, ungated by entities'],
        ['ghostspear', 64, 'hasSpear', 'Dungeon6/5.oel:56', 'D6, L60 kill-lock (2 jellyfish)'],
        ['ghostsword', 106, 'hasGhostSword', 'Dungeon8/8.oel:158', 'D8 depth'],
        ['darkshield', 74, 'hasDarkShield', 'Dungeon7/3.oel:214', 'D7 (key 4 + wand approach)'],
        ['darksuit', 79, 'hasDarkSuit', 'Dungeon7/8.oel:159', 'D7 depth'],
        ['torchpickup', 30, 'hasTorch', 'Dungeon3/9.oel:491', 'D3, bosslock key 1'],
        ['health', 68, 'hitsMax 3->4', 'Dungeon6/9.oel:39', 'bosslock key 4 + magicallock, stacked'],
    ].map(([tag, level, flag, cite, gate, extra]) => Object.freeze({
        id: `${tag}@L${level}`, kind: 'pickup', tag, level, flag, cite, gate,
        ...(extra ?? {}),
    })),
    ...[[0, 19], [1, 29], [2, 40], [3, 55], [4, 67]].map(([kt, level]) => Object.freeze({
        id: `bosskey${kt}@L${level}`, kind: 'key', tag: 'bosskey', level,
        flag: `hasKey[${kt}]`, cite: 'the extract\'s keyType attr',
        gate: `keyType ${kt}`,
    })),
    ...[[39, 72, 40], [40, 64, 144], [40, 160, 640], [41, 240, 144], [42, 184, 152]]
        .map(([level, x, y]) => Object.freeze({
            id: `totempart@L${level}:${x},${y}`, kind: 'totempart', tag: 'totempart',
            level, flag: 'hasTotemPart[]', cite: 'seedling-map.json',
            gate: 'D4; four of five behind the L40 chain',
        })),
    ...[11, 12, 15, 17, 25, 36, 38, 40, 46, 48, 63, 71, 80, 86, 90, 98]
        .map((level) => Object.freeze({
            id: `chest@L${level}`, kind: 'chest', tag: 'chest', level,
            flag: 'hasSealPart[] gains a slot',
            cite: 'seedling-map.json; Chest.as:70-104',
            gate: '⛔ the identity commits at chest OPEN, not at piece pickup',
        })),
    Object.freeze({
        id: 'seed@L115', kind: 'ending', tag: 'seed', level: 115, flag: 'cutscene[2]',
        cite: 'End/4.oel:131', gate: 'FinalDoor: all 16 seals + {114,0}',
    }),
    Object.freeze({
        id: 'fire@L32', kind: 'encounter', tag: null, level: 32, flag: 'hasFire',
        cite: 'BobBoss.as:194, tag -1',
        gate: 'D3, boss key 1; non-persistent SPAWN, persistent FLAG',
    }),
    Object.freeze({
        id: 'darksword@L12', kind: 'encounter', tag: null, level: 12, flag: 'hasDarkSword',
        cite: 'Witch.as:32-52',
        gate: '`hasWand && !hasDarkSword`, dialogue to completion; ⚠ constructed tag -1, '
            + 'so its persistence write lands on the PREVIOUS level\'s tag 29',
    }),
]);

/**
 * The rows the kickoff's census EXCLUDED, each with the reason that
 * survives contact with the source.
 *
 * ⛔ A ledger's exclusions are part of the ledger. Trap 101: a refusal
 * whose exemplar disappears is a refusal nobody can witness — so the
 * excluded set is exported and asserted, not deleted.
 */
export const R7_LEDGER_EXCLUSIONS = Object.freeze({
    Stick: 'dead class, zero constructions',
    Coin: 'no flag and no counter — `pick_up()` is `removeSelf()`',
    beam: '⚠ THE KICKOFF\'S REASON WAS WRONG. Not "no writer": `Shield.removed()` sets '
        + 'it (`Shield.as:46`). It is excluded because it is a SIDE EFFECT of the '
        + 'shield, not an independent collectible — and it is a SEAM_SIGNATURE row.',
    rockSet: '⚠ ALSO WRITTEN (`Moonrock.as:118`), and gameplay-visible (it makes the '
        + 'moonrock a Solid). Excluded as a world-state flag, not a collectible.',
    hasDeathRay: '`public static var` on Player, initialised false and written nowhere '
        + '(`Player.as:207`; the only reader is `:882`)',
});

/**
 * ⛔ FINDINGS DERIVED BY MAPPING OVER EVERY ROW — trap 119's construction.
 *
 * `earnedBy` is `{ledgerId: {segment, witness}}`, built from the game's own
 * readouts (`botStatus.save`, `persistence_cleared`) inside a driven
 * window. A row with no entry reads UNCLAIMED and is `ok: false`. There is
 * no default-satisfied path: the only way a row goes green is for
 * something to have earned it.
 *
 * @param {object} earnedBy
 * @param {string[]} [roster]
 */
export function r7GoalFindings(earnedBy = {}, roster = fixtureNames()) {
    const out = R7_GOAL_LEDGER.map((row) => {
        const e = earnedBy[row.id];
        const inRoster = Boolean(e?.segment) && roster.includes(e.segment);
        return {
            name: `${row.id} (${row.kind}) is EARNED inside a driven segment`,
            ok: Boolean(e) && inRoster && Boolean(e.witness),
            detail: !e
                ? `UNCLAIMED — no segment earns it (gate: ${row.gate})`
                : !inRoster
                    ? `UNCLAIMED — segment ${e.segment} is not in the roster`
                    : !e.witness
                        ? `UNCLAIMED — segment ${e.segment} names no game-side witness`
                        : `${e.segment}: ${e.witness}`,
        };
    });
    // ⚠ COUNTED BEFORE THE SECOND FAMILY IS APPENDED. The completeness row
    // below asserts `claimed === R7_GOAL_LEDGER.length`, which is a claim
    // about the EARNED rows; folding the durable-witness rows into that
    // filter would make the total unreachable by construction — a count
    // that can never be met reads exactly like one that is never met.
    const claimed = out.filter((r) => r.ok).length;

    // ── ⛔ THE DURABLE-WITNESS ROWS, DERIVED THE SAME WAY ──────────────
    //
    // A second family, and it is a FILTER over the same ledger rather than
    // a hand-written row — trap 119's construction does not get an
    // exception for being a small family. A row that declares a
    // `durableWitness` is a row whose primary flag is not enough: the
    // shield's is `hasShield`, which a boot block can declare, while
    // `rockSet` is a consequence the GAME produces and a declaration
    // cannot fake inside the level the shield is in.
    //
    // ⚠ AND IT IS ITS OWN ROW, NOT A CONDITION ON THE FIRST ONE. `rockSet`
    // flips when L0's moonrock consumes the beam, which is a different
    // level from L20 and therefore very likely a different SEGMENT. Folding
    // it into the shield's `ok` would make an honest chain report the
    // shield unearned until some later segment revisited the overworld.
    out.push(...R7_GOAL_LEDGER.filter((row) => row.durableWitness).map((row) => {
        const e = earnedBy[row.id];
        const d = e?.durable;
        return {
            name: `${row.id}: the DURABLE witness ${row.durableWitness} is observed`,
            ok: Boolean(d?.segment) && roster.includes(d.segment) && Boolean(d.witness),
            detail: !d
                ? `UNCLAIMED — no segment observes ${row.durableWitness}. ${row.durableWhy}`
                : !roster.includes(d.segment)
                    ? `UNCLAIMED — segment ${d.segment} is not in the roster`
                    : !d.witness
                        ? `UNCLAIMED — segment ${d.segment} names no game-side witness`
                        : `${d.segment}: ${d.witness} (${row.durableCite})`,
        };
    }));

    out.push({
        name: 'the goal ledger is complete',
        ok: claimed === R7_GOAL_LEDGER.length,
        detail: `${claimed}/${R7_GOAL_LEDGER.length} collectibles earned `
            + `(over ${roster.length} tapes); unclaimed: `
            + `${R7_GOAL_LEDGER.filter((r) => !earnedBy[r.id]).map((r) => r.id).join(', ')
                || '(none)'}`,
    });
    return out;
}

/** The ledger's own totals, derived. Nothing here is stored. */
export function r7GoalCriteria(earnedBy = {}, roster = fixtureNames()) {
    const byKind = {};
    for (const row of R7_GOAL_LEDGER) {
        byKind[row.kind] = byKind[row.kind] ?? { total: 0, earned: 0 };
        byKind[row.kind].total += 1;
        if (earnedBy[row.id]) byKind[row.kind].earned += 1;
    }
    return {
        rosterSize: roster.length,
        total: R7_GOAL_LEDGER.length,
        earned: R7_GOAL_LEDGER.filter((r) => earnedBy[r.id]).length,
        byKind,
        exclusions: Object.keys(R7_LEDGER_EXCLUSIONS).length,
    };
}

// ── THE BATCH, AND ITS PREDICTED ATTRIBUTION ──────────────────────────

/**
 * ⛔⛔⛔ THE PREDICTION IS COMMITTED BEFORE THE BATCH RUNS, AND IT SAYS
 * **ZERO RE-RECORDS** — which overturns the premise the batch was
 * scheduled on.
 *
 * §3.4 (carrying R6 debt 1) says `saw_auto_advance`'s unification "is the
 * one wanted change that is NOT byte-inert, so it waits for a batch that
 * re-records ON PURPOSE", citing "~8 frozen R3 collection fixtures whose
 * committed expectations say `saw_auto_advance: 0`".
 *
 * Measured at slice 0: **no committed expectation carries the field at
 * all.** All 118 expectation files are exactly
 * `{ticks: [{t, x, y, level}], transitions: [{t, from_level, to_level}]}` —
 * 142,774 ticks, zero occurrences of `saw_auto_advance`. What asserts it
 * is the SWEEP, which re-derives `wantAutoAdvance` from the model per run
 * (`verify-seedling-bot-differential.mjs:798-800`).
 *
 * And the counter is the only thing version-scoped: `autoAdvance`'s
 * `dispatchKey` presses are UNCONDITIONAL on all three arms
 * (`Bot.as:2198-2212`). A press schedule that does not change cannot move
 * an observation, so the change is byte-inert on the corpus by
 * construction, not by luck.
 *
 * ⇒ the gate is the ordinary zero-re-record gate, and the attribution
 * data below is TWO-SIDED in a sharper way: (a) 118/118 fixtures
 * IDENTICAL, and (b) exactly three named tapes change their REPORTED
 * VALUE, with the sweep's own derivation obliged to move with them.
 *
 * ⚠ THE ONE STANDING CONSTRAINT FOR SLICE 1, stated as a refusal: unify
 * the COUNTER, never the PRESSER. Any change that moves an
 * `AUTO_ADVANCE_CADENCE` press shifts every frozen frame after it and this
 * whole prediction is void.
 */
export const R7_BATCH = Object.freeze({
    items: Object.freeze([
        Object.freeze({
            id: 'saw_auto_advance-unification',
            what: 'collapse the three version-scoped counting rules to v5\'s one rule '
                + '(count a FREEZE ARRIVAL, whatever raised it)',
            cite: 'Bot.as:2153-2212',
            streamEffect: 'IDENTICAL — the counter is scoped, `dispatchKey` is not',
            valueEffect: 'v<=3 tapes that raise a Help or dialogue go 0 -> 1',
            coChange: 'verify-seedling-bot-differential.mjs must drop the '
                + '`tape_version >= 4` scoping from `wantAutoAdvance`, or the three '
                + 'named tapes go red BY BEING CORRECT',
        }),
        Object.freeze({
            id: 'botStatus.save-consumer',
            what: 'the differential asserts `totem_parts`/`keys`/`seal_parts` against '
                + 'the model per tape (R6 debt 6)',
            cite: 'the readout already ships; nothing in the sweep reads it',
            streamEffect: 'IDENTICAL — a sweep-side consumer touches no game code',
            valueEffect: 'none',
        }),
        Object.freeze({
            id: 'seam-latch',
            what: 'latch the seam signature at the terminal disarm; tape v8 boot block',
            cite: 'Bot.as:2025-2045 (the `tick >= tickCount` arm)',
            streamEffect: 'IDENTICAL — it runs AFTER the final observation and all '
                + 'KEY_UPs, and before the disarm',
            constraint: '⛔ the latch must take NO draw and construct NOTHING that '
                + 'does; a `Math.random()` inside it would move the very state it '
                + 'exists to report',
            valueEffect: 'none',
        }),
        Object.freeze({
            id: 'music-readout',
            what: '⚠ NEW AT SLICE 0 — accessors for `Music.currentSet`/`currentIndex`',
            cite: 'Music.as:83-84 (both PRIVATE static)',
            streamEffect: 'IDENTICAL — a getter added beside them',
            valueEffect: 'none',
            why: '§3.2 item 5 requires these two in the signature and §3.4 does not '
                + 'name the change that makes them readable. They gate '
                + '`Music.playSound`\'s do-while draw count.',
        }),
        Object.freeze({
            id: 'fp-lcg-hooks',
            what: 'read/write hooks for FlashPunk\'s LCG',
            cite: 'FP.as:391-395, :715-716',
            streamEffect: 'IDENTICAL — the write arm fires only when a tape declares '
                + 'it, and no v1..v7 tape does',
            valueEffect: 'none',
            why: '⚠ DOWNGRADED FROM WALL TO WANTED at slice 0, and RESHAPED: the hook '
                + 'cannot be `FP.randomSeed` (its getter returns `_getSeed`, which the '
                + 'draws never touch), and no FP consumer in this game is '
                + 'gameplay-visible — see `SEAM_SIGNATURE`\'s `fp.seed` row.',
        }),
        Object.freeze({
            id: 'pressed-released-echo',
            what: 'echo `pressed`/`released` on `botStatus` (R6 debt 4)',
            cite: 'a readout, inert by construction for callers that do not ask',
            streamEffect: 'IDENTICAL',
            valueEffect: 'none',
        }),
        Object.freeze({
            id: 'bot-docblock-corrections',
            what: 'fix TWO stale docblocks, not one',
            cite: 'Bot.as:1152-1160 (the RNG reset rationale, inverted by trap 112) '
                + 'and Bot.as:2158-2162 (which claims committed expectations carry '
                + '`saw_auto_advance` — measured at slice 0: none does)',
            streamEffect: 'IDENTICAL — comments',
            valueEffect: 'none',
        }),
    ]),
    /**
     * The predicted per-fixture classification, committed BEFORE the batch.
     *
     * ⚠ THE VALUE-CHANGE SET IS DERIVED, NOT LISTED BY HAND — see
     * `predictedAttribution`. The three names below are what that
     * derivation produced at slice 0, recorded so a drift is visible.
     */
    predictedValueChanges: Object.freeze([
        'r3-collect-sword', 'r3-walk-1-sword', 'r3-walk-full',
    ]),
    predictedReRecords: 0,
});

/**
 * The two-sided gate, as data.
 *
 * @param {object[]} tapes `{name, tape_version, swordPickups}` — the model's
 *                         own collection count per tape, from `runTape`
 */
export function predictedAttribution(tapes) {
    return tapes.map((t) => {
        // Under the unification every version counts freeze ARRIVALS. Today
        // v<=3 counts phase-1 RELEASES only, and a Help ends its freeze on
        // phase 0 — so a v<=3 tape that collects a sword reports 0 now and
        // 1 after. v>=4 already counts the Help's arrival.
        const changes = (t.tape_version ?? 1) <= 3 && (t.swordPickups ?? 0) > 0;
        return {
            name: t.name,
            stream: 'IDENTICAL',
            streamWhy: 'the press schedule is unconditional (`Bot.as:2198-2212`)',
            value: changes
                ? `saw_auto_advance 0 -> ${t.swordPickups}`
                : 'unchanged',
        };
    });
}
