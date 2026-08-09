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
 * Per-seam findings, DERIVED by mapping the signature over every seam.
 *
 * A seam is `{name, exit, boot}` where `exit` and `boot` are field maps
 * (`SEAM_SIGNATURE[].field` -> value). A field missing on EITHER side is
 * UNCLAIMED — never "pending", never skipped. A partial latch is exactly
 * the case trap 111 predicts and the case §5's first bullet forbids
 * shipping.
 *
 * @param {Array} seams
 */
export function seamFindings(seams = []) {
    const out = [];
    for (const seam of seams) {
        for (const row of SEAM_SIGNATURE) {
            if (row.comparable === 'excluded') continue;
            const have = Object.prototype.hasOwnProperty.bind(seam.exit ?? {});
            const haveB = Object.prototype.hasOwnProperty.bind(seam.boot ?? {});
            const inExit = have(row.field);
            const inBoot = haveB(row.field);
            if (!inExit || !inBoot) {
                out.push({
                    name: `${seam.name}: ${row.field}`,
                    ok: false,
                    detail: `UNCLAIMED — ${!inExit && !inBoot ? 'neither side carries it'
                        : !inExit ? 'the exit latch does not carry it'
                            : 'the boot block does not declare it'}`
                        + ` (${row.comparable}; ${row.cite})`,
                });
                continue;
            }
            const a = JSON.stringify(seam.exit[row.field]);
            const b = JSON.stringify(seam.boot[row.field]);
            out.push({
                name: `${seam.name}: ${row.field}`,
                ok: a === b,
                detail: a === b ? `${row.comparable}: ${a}` : `exit ${a} vs boot ${b}`,
            });
        }
    }
    out.push({
        name: 'every seam is checked over the whole signature',
        ok: seams.length > 0,
        detail: `${seams.length} seam(s) x `
            + `${SEAM_SIGNATURE.filter((r) => r.comparable !== 'excluded').length} `
            + `comparable field(s) = ${out.length - 0} row(s)`,
    });
    return out;
}

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
        ['shield', 20, 'hasShield', 'Dungeon2/7.oel:145', 'ShieldBoss -> bosslock key 0'],
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
    ].map(([tag, level, flag, cite, gate]) => Object.freeze({
        id: `${tag}@L${level}`, kind: 'pickup', tag, level, flag, cite, gate,
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
    const claimed = out.filter((r) => r.ok).length;
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
