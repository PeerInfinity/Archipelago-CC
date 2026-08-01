/**
 * seedlingDemo/tapeFormat — the INPUT TAPE contract for the real-game
 * Seedling bot ladder (region-atlas plan Phase 8; brief:
 * `CC/docs/plans/seedling-bot-v1-opus-kickoff.md` §3.1).
 *
 * One schema, TWO consumers: this module (the JS iteration surface) and
 * `Bot.as` compiled into the recompiled Seedling wasm build (the oracle).
 * A differential harness replays the same tape through both and compares
 * observation streams, so anything ambiguous here becomes a divergence
 * there. Every rule below is therefore stated as a loud error, never a
 * silent default — a tape the two sides interpret differently is exactly
 * the bug this format exists to make impossible.
 *
 * ── Why hold-SPANS and not per-tick key states ────────────────────────
 * Seedling reads input three different ways and the tape has to express
 * all three (recon: `Player.as`, `NPCs/NPC.as:191`, `SealController.as:95`):
 *   - movement  → `Input.check`    (held)
 *   - item use  → `Input.pressed`  (down EDGE)
 *   - dialogue  → `Input.released` (full down-then-up)
 * A span `{from, to}` yields a press edge on tick `from` and a release
 * edge on tick `to`, so a length-1 span covers `pressed` AND `released`
 * while a long span covers `check`. `from` inclusive, `to` EXCLUSIVE.
 *
 * ── Tick indexing ─────────────────────────────────────────────────────
 * Tick 0 is the first tick the bot is ARMED (after `botStart`, once the
 * post-boot `blackCover` fade has finished). Ticks advance ONLY on ticks
 * where entities actually update — the AS3 side gates on
 * `blackCover <= 0 && !Game.freezeObjects`, both of which suppress all
 * movement, so a dead frame must not consume tape. NEVER index by
 * wall-clock: `FP.elapsed` appears in zero lines of Seedling game code,
 * so one update call is one fixed physics step and a tick-indexed tape is
 * deterministic for movement.
 *
 * ── Observation streams: RECORD-THEN-ACT ──────────────────────────────
 * The AS3 bot's only hook is the top of `Main.update()`, BEFORE
 * `super.update()` — i.e. before this tick's movement happens. So it
 * records first, then dispatches this tick's key events. That makes
 * observation `t` the state after exactly `t` completed movement ticks:
 * `ticks[0]` is the boot position under no input, and a tape of N ticks
 * yields N+1 observations (0..N). `runTape` here mirrors that exactly.
 * Getting this off by one is the easiest way to make every differential
 * red for a reason that has nothing to do with physics.
 *
 * ── Room transitions: the settled tick order ──────────────────────────
 * v2 slice 3. Documented here because the brief (§3.3) said the exact
 * alignment was the kind of off-by-one the oracle had to settle, and the
 * slice-0 recording settled it. Within one tick:
 *
 *   1. Teleporters update BEFORE the player — `World.addUpdate` PREPENDS
 *      (`World.as:937-947`) and `loadlevel` adds the player (`Game.as:2040`)
 *      before the teleporters (`:2169`) — so a trigger tests the position
 *      the PREVIOUS tick left, which is the position this tick starts from.
 *   2. If one fires, the old player still runs this tick's FULL movement in
 *      the old level: `FP.world = new Game(...)` only sets `_goto` and the
 *      swap is deferred to `Engine.checkWorld` at end-of-tick.
 *   3. The swap lands at end-of-tick: a whole new `Game`, whose `Player` is
 *      constructed at `(playerx + 8, playery + 8)` with zero velocity and a
 *      fresh terrain state, while the HELD KEYS carry over (FlashPunk's
 *      `Input` is static and no teleport path calls `Input.clear()`).
 *   4. The ~19 `blackCover` frames that follow are DEAD FRAMES, skipped by
 *      both consumers, so the old player's last doomed step is never
 *      observed and never feeds the new one. There is no intermediate
 *      observation: the last old-level observation is the first position
 *      overlapping the trigger, and the next one is already the arrival.
 *
 * Recorded (`transition-west-return`): tick 60 is the last level-0
 * observation at x = 17.70000000000001, tick 61 is the arrival (296, 168)
 * in level 94. Hence a `transitions` entry's `t` is "the first observation
 * tick whose `level` is the NEW level" (§1 ruling 2), and the record is the
 * minimal symmetric one, `{t, from_level, to_level}` — arrival position is
 * already `ticks[t]` and is not duplicated, and teleporter identity is
 * EXCLUDED because the AS3 bot cannot observe it without a patch and an
 * asymmetrically-known field cannot be differentially checked.
 *
 * ── Where each side's `transitions` come from ─────────────────────────
 * The JS engine derives its entries from its OWN world swap (`tapeRunner`),
 * which is what makes the comparison worth making. The GAME does not hand
 * the field over at all — `Bot.as`'s `botDrain` returns `transitions: []`
 * unconditionally and re-recording will never populate it — so the harness
 * derives the game's side from the tick stream with `deriveTransitions`
 * below, which the ruling's definition makes a pure function of it.
 *
 * That derivation is deliberately in ONE place, and it is applied at
 * RECORD time rather than at compare time: the committed expectation then
 * carries its transitions explicitly, so the fixture's central claim is
 * readable and diffable in git instead of being conjured on both sides of
 * every comparison. The cost is that adding the field to an existing
 * expectation needs a re-record; that was paid once, for the two v2
 * fixtures. `verify-seedling-bot-differential.mjs` applies it to the live
 * stream on BOTH paths (record and compare) and checks that the game's own
 * field is still empty, so an AS3 build that starts reporting transitions
 * is a named failure rather than something the derivation quietly masks.
 */

/**
 * ── Version 2: the subtractive ladder's relaxations ───────────────────
 * R0 of the SUBTRACTIVE ladder (`CC/docs/plans/seedling-bot-r0-opus-kickoff.md`)
 * adds three fields, all REQUIRED on a v2 tape because each one selects
 * which experiment BOTH consumers are running:
 *
 *   `noDamage`   `Bot.noDamage` — `Player.hit()` returns before
 *                sound/shake/knockback/die.
 *   `noHazards`  the SET of dangerous terrains whose EFFECTS are coerced
 *                away, by name. Not a boolean: R4 re-arms hazards one at a
 *                time, so a boolean could not express a single R4 rung and
 *                would have forced a second ~10-minute AS3 build to change
 *                its type (decided in the R0 kickoff §8.8, before the batch).
 *   `grants`     items handed to the player on first ENTERING a level,
 *                the crutch that lets an item walk gate R1 before the
 *                pickup ceremony is modelled.
 *
 * Version 1 tapes stay parseable and are UNCHANGED on disk — the eleven
 * committed fixtures are v1 and must stay byte-identical. A v1 tape that
 * declares any v2 field is a named error rather than a tape whose extra
 * fields one side honours and the other ignores; the parser then normalises
 * v1 to the v2 semantics that ARE version 1 (`noDamage: false`,
 * `noHazards: []`, `grants: []`) so no engine has to branch on version, and
 * `serializeTape` writes the fields back only for a v2 tape.
 */

/** Schema version written by `serializeTape` for new tapes. */
export const TAPE_VERSION = 3;

/** Every version this parser accepts. v1 tapes are frozen, not deprecated. */
export const SUPPORTED_TAPE_VERSIONS = Object.freeze([1, 2, 3]);

/**
 * ⚠ THE SPAWN IS BAKED INTO THE BUILD, so a tape's `boot` block is a CLAIM
 * about the build rather than an instruction to it.
 *
 * `Main.as:51` is `FP.world = new Game(0, 80, 128)`, and `Bot.as` assigns
 * `bootLevel = int(t.boot.level)` and then never reads it — `boot.x`/`boot.y`
 * it does not look at at all. So a tape declaring anything else is silently
 * HONOURED by the JS engine and silently IGNORED by the game, and the
 * differential blames the physics for a disagreement that is entirely
 * bookkeeping. That is exactly the asymmetric interpretation this format
 * exists to make impossible, so it is a named error like every other
 * ambiguity here (found in v2 slice 0; the check is slice 4's).
 *
 * When the build gains a parameterised boot — an AS3 edit, and therefore
 * something to batch — this constant is the ONE place that changes, and
 * `parseTape` becomes a check that the tape names a boot the build can
 * actually take rather than the single one it always takes.
 */
export const BUILD_SPAWN = Object.freeze({ level: 0, x: 80, y: 128 });

/**
 * The ONE canonical key-name → AS3 keycode table, asserted by both
 * consumers. Source of truth: `Player.as:59`
 *   keys = [RIGHT, UP, LEFT, DOWN, X, C, X, V, I]
 * with codes from `net/flashpunk/utils/Key.as`.
 *
 * `primary` and `talk` are BOTH Key.X in the game (keys[4] and keys[6]);
 * the tape exposes the single name `primary` because they are physically
 * the same key — a second name would let two tapes mean the same thing.
 */
export const KEY_CODES = Object.freeze({
    right: 39,       // Key.RIGHT  — keys[0]
    up: 38,          // Key.UP     — keys[1]
    left: 37,        // Key.LEFT   — keys[2]
    down: 40,        // Key.DOWN   — keys[3]
    primary: 88,     // Key.X      — keys[4] (and keys[6], "talk")
    secondary: 67,   // Key.C      — keys[5]
    inventory: 86,   // Key.V      — keys[7]
    inventory2: 73,  // Key.I      — keys[8]
});

/**
 * Keycodes that must NEVER appear in a tape, with the reason. These are
 * not merely "unused" — synthesizing them corrupts a run:
 *   M/R/Esc are read by `Game.update` BEFORE entities (`Game.as:793-801`)
 *   and several branches call `Input.clear()` or rebuild the world
 *   (`:796, 1274-1284`); W opens a URL (`Player.as:1533`).
 * They are absent from KEY_CODES, so this list exists to give the
 * validator a NAMED error instead of a generic "unknown key".
 */
export const FORBIDDEN_KEYS = Object.freeze({
    m: { code: 77, why: 'Game.update reads it before entities and may Input.clear() / rebuild the world' },
    r: { code: 82, why: 'Game.update restart branch rebuilds the world mid-tape' },
    esc: { code: 27, why: 'Game.update menu branch calls Input.clear()' },
    escape: { code: 27, why: 'Game.update menu branch calls Input.clear()' },
    w: { code: 87, why: 'Player.as:1533 opens an external URL' },
});

/** Every legal key name, for error messages and cross-consumer assertion. */
export const KEY_NAMES = Object.freeze(Object.keys(KEY_CODES));

/**
 * `noHazards` vocabulary: the five DANGEROUS terrain states, by name.
 *
 * These are exactly the tile types whose EFFECTS the R0 kickoff §3.2(e)
 * ruling coerces to Ground(0) — the ones where the physics stops being a
 * function of position. Stairs (10) and Ghost Step (30) are deliberately
 * absent: they are merely slower, they are already modelled, and flattening
 * them would erase real physics rather than a hazard.
 *
 * NAMES rather than raw ints so a tape says what it disables and a reader
 * of a committed fixture does not have to hold `Tile.types` in their head.
 * Transcribed here rather than imported so this module stays dependency-free
 * and browser-usable, exactly like `KEY_CODES`; `tapeFormat.test.js`
 * cross-asserts every entry against `flashPanel/seedlingSemantics.js`, which
 * is the same guard shape the key table has.
 */
export const HAZARD_STATES = Object.freeze({
    water: 1,
    pit: 6,
    lava: 17,
    ice: 22,
    waterfall: 25,
});

/** The state a coerced hazard becomes: Ground, `Player.as:297`'s own initial. */
export const COERCED_TERRAIN_STATE = 0;

export const HAZARD_NAMES = Object.freeze(Object.keys(HAZARD_STATES));

/**
 * `grants` vocabulary: the 14 items, by the `flash_name` the rest of the
 * repo already uses.
 *
 * Source of truth is `flashPanel/games/seedling.json`'s `items[]`, which is
 * what the AP integration writes through; `tapeFormat.test.js` asserts this
 * table against that file so the two cannot drift. The `property` is a
 * `Player` static that delegates to a `Main` one (`Player.as:102-108` and
 * its fourteen siblings), so `Bot.as` can write it directly and
 * `botStatus.items` can read it back — which is what makes the game, not
 * this mirror, the oracle for whether a grant landed.
 *
 * ⚠ Thirteen are booleans and **`health` is not**: it is `hitsMax`, an INT,
 * `op: "add"` over `base: 3`. An "all items true" assertion that forgets
 * that is asserting the wrong thing about one fourteenth of the set.
 */
export const ITEM_PROPERTIES = Object.freeze({
    sword: { property: 'hasSword', kind: 'boolean' },
    darksword: { property: 'hasDarkSword', kind: 'boolean' },
    ghostsword: { property: 'hasGhostSword', kind: 'boolean' },
    shield: { property: 'hasShield', kind: 'boolean' },
    darkshield: { property: 'hasDarkShield', kind: 'boolean' },
    fire: { property: 'hasFire', kind: 'boolean' },
    wand: { property: 'hasWand', kind: 'boolean' },
    firewand: { property: 'hasFireWand', kind: 'boolean' },
    conch: { property: 'canSwim', kind: 'boolean' },
    feather: { property: 'hasFeather', kind: 'boolean' },
    spear: { property: 'hasSpear', kind: 'boolean' },
    darksuit: { property: 'hasDarkSuit', kind: 'boolean' },
    torch: { property: 'hasTorch', kind: 'boolean' },
    health: { property: 'hitsMax', kind: 'add', base: 3, value: 1 },
});

export const ITEM_NAMES = Object.freeze(Object.keys(ITEM_PROPERTIES));

class TapeFormatError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TapeFormatError';
    }
}

function fail(message) {
    throw new TapeFormatError(message);
}

function requireInt(value, what) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        fail(`${what} must be an integer, got ${JSON.stringify(value)}`);
    }
    return value;
}

function requireFiniteNumber(value, what) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        fail(`${what} must be a finite number, got ${JSON.stringify(value)}`);
    }
    return value;
}

/**
 * `persistence` (version 3): the CLEARS a tape applies before its first
 * live tick, as `{level, tag, note}`.
 *
 * ── Clears only, and never wholesale ──────────────────────────────────
 * There is no way to set a flag TRUE from a tape. Persistence is a shared,
 * cross-level, endgame load-bearing namespace — `FinalDoor` reads level
 * 114's tag 0 as "talked to the Watcher", `Moonrock` writes level 2's from
 * level 0 — so a crutch that could write either way could forge an ending.
 *
 * `note` is an AUDIT field: it names the blocker class the entry despawns,
 * both consumers ignore it, and it is what makes a clear list reviewable
 * as a list rather than as forty pairs of numbers.
 *
 * ⚠ A NEGATIVE TAG IS NOT "no tag". Entities use -1 for untagged and every
 * persistence reader guards on `tag >= 0`, so a clear for -1 could never
 * despawn anything — it would be a line in the audit list that does
 * nothing, which is worse than an absent one.
 */
export const TAGS_PER_LEVEL = 30;   // Game.as:525
export const LEVEL_COUNT = 116;     // Game.levels.length

function parsePersistence(raw) {
    if (!Array.isArray(raw.persistence)) {
        fail('persistence must be an array of {level, tag, note} on a tape_version 3 '
            + `tape ([] when nothing is cleared), got ${JSON.stringify(raw.persistence)}`);
    }
    const seen = new Set();
    const clears = raw.persistence.map((c, i) => {
        const where = `persistence[${i}]`;
        if (c === null || typeof c !== 'object' || Array.isArray(c)) {
            fail(`${where} must be an object { level, tag, note }`);
        }
        requireInt(c.level, `${where}.level`);
        requireInt(c.tag, `${where}.tag`);
        if (c.level < 0 || c.level >= LEVEL_COUNT) {
            fail(`${where}.level ${c.level} is not a level (0..${LEVEL_COUNT - 1})`);
        }
        if (c.tag < 0 || c.tag >= TAGS_PER_LEVEL) {
            fail(`${where}.tag ${c.tag} is out of range 0..${TAGS_PER_LEVEL - 1}. A `
                + 'negative tag is not "untagged" here — every persistence reader '
                + 'guards on tag >= 0, so clearing -1 despawns nothing.');
        }
        if (c.note !== undefined && typeof c.note !== 'string') {
            fail(`${where}.note must be a string naming what it despawns, got `
                + `${JSON.stringify(c.note)}`);
        }
        const key = `${c.level}:${c.tag}`;
        if (seen.has(key)) {
            fail(`${where} duplicates level ${c.level} tag ${c.tag}. A clear is `
                + 'idempotent, so a duplicate is a bookkeeping error in the '
                + 'derivation rather than a harmless repeat.');
        }
        seen.add(key);
        return { level: c.level, tag: c.tag, note: c.note ?? '' };
    });
    // Sorted so a re-derived list that changed ORDER is not a diff.
    clears.sort((a, b) => a.level - b.level || a.tag - b.tag);
    return clears;
}

/**
 * The three version-2 relaxation fields. Every one is REQUIRED — a tape
 * that omitted `noHazards` and a game that defaulted it to "none" would be
 * running a different experiment from a JS engine that defaulted it to
 * "all", and the differential would report it as a physics divergence.
 */
function parseRelaxations(raw) {
    if (typeof raw.noDamage !== 'boolean') {
        fail('noDamage must be a boolean on a tape_version 2 tape (no default — it '
            + `selects whether Player.hit() runs), got ${JSON.stringify(raw.noDamage)}`);
    }

    if (!Array.isArray(raw.noHazards)) {
        fail('noHazards must be an ARRAY of hazard names on a tape_version 2 tape, not '
            + `a boolean — R4 re-arms hazards one at a time, so "all or nothing" cannot `
            + `express a rung. Legal names: ${HAZARD_NAMES.join(', ')}; [] means none `
            + `are disabled. Got ${JSON.stringify(raw.noHazards)}`);
    }
    const noHazards = raw.noHazards.map((name, i) => {
        if (typeof name !== 'string'
            || !Object.prototype.hasOwnProperty.call(HAZARD_STATES, name)) {
            fail(`noHazards[${i}] is ${JSON.stringify(name)}, which is not a hazard `
                + `name; legal names are ${HAZARD_NAMES.join(', ')}`);
        }
        return name;
    });
    for (let i = 1; i < noHazards.length; i++) {
        if (noHazards.indexOf(noHazards[i]) !== i) {
            fail(`noHazards names "${noHazards[i]}" more than once`);
        }
    }
    // Sorted by STATE so two tapes disabling the same hazards serialize
    // identically regardless of authoring order, exactly as spans are.
    noHazards.sort((a, b) => HAZARD_STATES[a] - HAZARD_STATES[b]);

    if (!Array.isArray(raw.grants)) {
        fail('grants must be an array of {level, items} on a tape_version 2 tape '
            + `([] when nothing is granted), got ${JSON.stringify(raw.grants)}`);
    }
    const grants = raw.grants.map((g, i) => {
        const where = `grants[${i}]`;
        if (g === null || typeof g !== 'object' || Array.isArray(g)) {
            fail(`${where} must be an object { level, items }`);
        }
        requireInt(g.level, `${where}.level`);
        if (g.level < 0) fail(`${where}.level must be >= 0, got ${g.level}`);
        if (!Array.isArray(g.items) || g.items.length === 0) {
            fail(`${where}.items must be a non-empty array of item names; an empty grant `
                + 'is a route claim nobody checks');
        }
        const items = g.items.map((name, j) => {
            if (typeof name !== 'string'
                || !Object.prototype.hasOwnProperty.call(ITEM_PROPERTIES, name)) {
                fail(`${where}.items[${j}] is ${JSON.stringify(name)}, which is not an `
                    + `item name; legal names are ${ITEM_NAMES.join(', ')} (the `
                    + 'flash_name vocabulary of games/seedling.json)');
            }
            return name;
        });
        for (let j = 1; j < items.length; j++) {
            if (items.indexOf(items[j]) !== j) {
                fail(`${where}.items names "${items[j]}" more than once`);
            }
        }
        items.sort();
        return { level: g.level, items };
    });
    grants.sort((a, b) => a.level - b.level);
    for (let i = 1; i < grants.length; i++) {
        if (grants[i].level === grants[i - 1].level) {
            fail(`grants declares level ${grants[i].level} twice. One entry per level: `
                + 'the grant fires on FIRST entry, so a second entry for the same level '
                + 'would either never fire or fire at a tick neither side agrees on.');
        }
    }

    return { noDamage: raw.noDamage, noHazards, grants };
}

/**
 * The terrain state the PHYSICS consumes, given the state the resolver
 * actually resolved.
 *
 * ⚠ The resolver's STORED state stays RAW on both sides. In `Player.as` the
 * `_state` member keeps the real tile type, the `_s != _state` change gate
 * and `lastState` are untouched, and only the effect sites read through the
 * coerced value; this function is that rule, and `playerPhysicsV2` applies
 * it at the same four places. Keeping storage raw is what lets the JS tests
 * keep asserting the RESOLVER's own answer — the brick-not-ground lesson —
 * instead of asserting a value the relaxation already flattened.
 *
 * `states` is the tape's `noHazards` names, not tile types, because that is
 * what the tape carries and one translation point is enough.
 */
export function coerceTerrainState(state, noHazardNames) {
    for (const name of noHazardNames) {
        if (HAZARD_STATES[name] === state) return COERCED_TERRAIN_STATE;
    }
    return state;
}

/**
 * Parse + validate + normalize a tape. Accepts a JSON string or a plain
 * object; returns a NEW frozen tape with spans sorted (by `from`, then
 * `key`) so two tapes that mean the same thing serialize the same way.
 *
 * Throws TapeFormatError on anything ambiguous. There are no defaults for
 * required fields on purpose: a tape missing `noclip` must not silently
 * become a collision run, because the JS side and the game would then be
 * running different experiments and the differential would blame physics.
 */
export function parseTape(input) {
    let raw = input;
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input);
        } catch (e) {
            fail(`tape is not valid JSON: ${e.message}`);
        }
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        fail(`tape must be an object, got ${Array.isArray(raw) ? 'array' : typeof raw}`);
    }

    const version = raw.tape_version;
    if (!SUPPORTED_TAPE_VERSIONS.includes(version)) {
        fail(`tape_version must be one of ${SUPPORTED_TAPE_VERSIONS.join(', ')}, `
            + `got ${JSON.stringify(version)}`);
    }
    if (raw.game !== 'seedling') {
        fail(`game must be "seedling", got ${JSON.stringify(raw.game)}`);
    }
    if (typeof raw.noclip !== 'boolean') {
        fail('noclip must be a boolean (no default — it selects which physics '
            + `both consumers run), got ${JSON.stringify(raw.noclip)}`);
    }

    // A v1 tape that RELAXES anything is the exact failure this format
    // exists to prevent, one version up: the field would be honoured by
    // whichever consumer happened to look at it and ignored by the other.
    //
    // It may still CARRY the fields at version 1's own values, because
    // `parseTape` is idempotent by design — every consumer re-validates,
    // and a parsed tape (which is normalised, below) has to survive being
    // parsed again. So the test is on the VALUE, not on presence.
    if (version === 1) {
        const v1Semantics = { noDamage: false, noHazards: [], grants: [], persistence: [] };
        for (const [field, expected] of Object.entries(v1Semantics)) {
            const got = raw[field];
            if (got === undefined) continue;
            const same = Array.isArray(expected)
                ? Array.isArray(got) && got.length === 0
                : got === expected;
            if (!same) {
                fail(`tape_version 1 declares ${field}: ${JSON.stringify(got)}, but `
                    + `version 1 means ${field}: ${JSON.stringify(expected)} BY `
                    + 'DEFINITION — the v1-era build had no such flag to read. Bump '
                    + 'tape_version to 2 to relax anything.');
            }
        }
    }
    const relax = version === 1
        ? { noDamage: false, noHazards: [], grants: [] }
        : parseRelaxations(raw);
    // The same VALUE-not-presence rule one version further on: a parsed v2
    // tape carries `persistence: []` because `parseTape` normalises, and a
    // presence check here would reject every committed fixture. That is not
    // hypothetical — it is what the first build of the R0 batch did with
    // `noDamage`, and it cost a whole pipeline run.
    if (version < 3 && raw.persistence !== undefined
        && !(Array.isArray(raw.persistence) && raw.persistence.length === 0)) {
        fail(`tape_version ${version} declares persistence: `
            + `${JSON.stringify(raw.persistence)}, but versions below 3 mean `
            + 'persistence: [] BY DEFINITION — the build had no such field to read. '
            + 'Bump tape_version to 3 to clear anything.');
    }
    const persistence = version === 3 ? parsePersistence(raw) : [];

    const boot = raw.boot;
    if (boot === null || typeof boot !== 'object' || Array.isArray(boot)) {
        fail('boot must be an object { level, x, y }');
    }
    requireInt(boot.level, 'boot.level');
    requireFiniteNumber(boot.x, 'boot.x');
    requireFiniteNumber(boot.y, 'boot.y');
    // ⚠ VERSION-SCOPED. A v1 tape was authored against a build that could not
    // be told where to start, so declaring anything but the baked-in spawn
    // means the JS engine honours a boot the game ignores and the
    // differential blames physics for bookkeeping. R0's AS3 batch gives the
    // build a parameterised boot, so a v2 tape may name any level — and
    // BUILD_SPAWN stays exported as the DEFAULT a tape gets when it does not
    // care, which is still every full-run tape.
    if (version === 1 && (boot.level !== BUILD_SPAWN.level || boot.x !== BUILD_SPAWN.x
        || boot.y !== BUILD_SPAWN.y)) {
        fail(`boot is {level: ${boot.level}, x: ${boot.x}, y: ${boot.y}}, but a `
            + `tape_version 1 tape must declare the build's baked-in spawn `
            + `{level: ${BUILD_SPAWN.level}, x: ${BUILD_SPAWN.x}, y: ${BUILD_SPAWN.y}} `
            + '(Main.as:51; the v1-era Bot.as read neither boot.x nor boot.y). The JS '
            + 'engine would honour this block and that build would ignore it. Bump to '
            + 'tape_version 2, which the R0 build honours.');
    }

    if (!Array.isArray(raw.inputs)) {
        fail(`inputs must be an array, got ${typeof raw.inputs}`);
    }

    const inputs = raw.inputs.map((span, i) => {
        const where = `inputs[${i}]`;
        if (span === null || typeof span !== 'object' || Array.isArray(span)) {
            fail(`${where} must be an object { key, from, to }`);
        }
        const { key } = span;
        if (typeof key !== 'string') {
            fail(`${where}.key must be a string, got ${JSON.stringify(key)}`);
        }
        if (!Object.prototype.hasOwnProperty.call(KEY_CODES, key)) {
            const forbidden = FORBIDDEN_KEYS[key.toLowerCase()];
            if (forbidden) {
                fail(`${where}.key "${key}" (keycode ${forbidden.code}) is FORBIDDEN and `
                    + `must never be synthesized: ${forbidden.why}`);
            }
            fail(`${where}.key "${key}" is not a known key name; legal names are `
                + `${KEY_NAMES.join(', ')}`);
        }
        requireInt(span.from, `${where}.from`);
        requireInt(span.to, `${where}.to`);
        if (span.from < 0) fail(`${where}.from must be >= 0, got ${span.from}`);
        if (span.to <= span.from) {
            fail(`${where}.to (${span.to}) must be > from (${span.from}) — `
                + 'spans are [from, to) and a zero-length span would produce '
                + 'neither a press nor a release edge');
        }
        return { key, from: span.from, to: span.to };
    });

    inputs.sort((a, b) => (a.from - b.from) || (a.to - b.to) || a.key.localeCompare(b.key));

    // Overlapping spans for the SAME key are rejected: FlashPunk's
    // `_key[code]` guard makes a second KEY_DOWN a no-op and the first
    // KEY_UP clears the whole hold, so two overlapping spans on one key
    // do NOT mean what an author would assume. Make them say it once.
    for (let i = 1; i < inputs.length; i++) {
        for (let j = 0; j < i; j++) {
            if (inputs[i].key !== inputs[j].key) continue;
            if (inputs[i].from < inputs[j].to) {
                fail(`inputs contain overlapping spans for key "${inputs[i].key}": `
                    + `[${inputs[j].from},${inputs[j].to}) and `
                    + `[${inputs[i].from},${inputs[i].to}). Merge them — overlapping `
                    + 'holds do not compose (the first release clears the key).');
            }
        }
    }

    const tickCount = requireInt(
        raw.tick_count ?? inputs.reduce((max, s) => Math.max(max, s.to), 0),
        'tick_count',
    );
    if (tickCount < 0) fail(`tick_count must be >= 0, got ${tickCount}`);
    for (const span of inputs) {
        if (span.to > tickCount) {
            fail(`inputs span [${span.from},${span.to}) for "${span.key}" runs past `
                + `tick_count (${tickCount}) — the bot would disarm mid-hold`);
        }
    }

    return Object.freeze({
        tape_version: version,
        game: 'seedling',
        boot: Object.freeze({ level: boot.level, x: boot.x, y: boot.y }),
        noclip: raw.noclip,
        // Normalised, never defaulted: for a v1 tape these ARE version 1's
        // semantics, stated once here so no engine carries a version branch.
        noDamage: relax.noDamage,
        noHazards: Object.freeze(relax.noHazards),
        grants: Object.freeze(relax.grants.map((g) => Object.freeze({
            level: g.level, items: Object.freeze(g.items),
        }))),
        persistence: Object.freeze(persistence.map((c) => Object.freeze({
            level: c.level, tag: c.tag, note: c.note,
        }))),
        tick_count: tickCount,
        inputs: Object.freeze(inputs.map((s) => Object.freeze(s))),
        ...(raw.name ? { name: String(raw.name) } : {}),
        ...(raw.description ? { description: String(raw.description) } : {}),
    });
}

/**
 * The set of key names held during tick `t`. Both consumers must agree
 * bit for bit; this is the single definition.
 */
export function heldKeysAt(tape, t) {
    const held = new Set();
    for (const span of tape.inputs) {
        if (t >= span.from && t < span.to) held.add(span.key);
    }
    return held;
}

/**
 * The keyboard EDGES the AS3 bot must dispatch at the top of tick `t`:
 * a DOWN for every span starting here, an UP for every span ending here.
 * Returned as keycodes because that is what `KeyboardEvent` carries.
 *
 * Kept here rather than in the AS3 so the two sides cannot drift: a JS
 * test can assert the exact edge schedule a tape implies, and `Bot.as`
 * is a transcription of this rule.
 */
export function keyEdgesAt(tape, t) {
    const down = [];
    const up = [];
    for (const span of tape.inputs) {
        if (span.from === t) down.push(KEY_CODES[span.key]);
        if (span.to === t) up.push(KEY_CODES[span.key]);
    }
    down.sort((a, b) => a - b);
    up.sort((a, b) => a - b);
    return { down, up };
}

/**
 * Serialize a tape to canonical JSON (stable key order, 2-space indent).
 *
 * ⚠ The v2 fields are written ONLY for a v2 tape. A v1 tape round-trips
 * byte-identically even though `parseTape` normalised the three fields onto
 * it, because writing version 1's own semantics back into a version 1 file
 * would rewrite all eleven committed fixtures for no change in meaning.
 */
export function serializeTape(tape) {
    const t = parseTape(tape);
    const ordered = {
        tape_version: t.tape_version,
        game: t.game,
        ...(t.name ? { name: t.name } : {}),
        ...(t.description ? { description: t.description } : {}),
        boot: { level: t.boot.level, x: t.boot.x, y: t.boot.y },
        noclip: t.noclip,
        ...(t.tape_version >= 2 ? {
            noDamage: t.noDamage,
            noHazards: [...t.noHazards],
            grants: t.grants.map((g) => ({ level: g.level, items: [...g.items] })),
        } : {}),
        // ⚠ Written ONLY for a v3 tape, so a v1 or v2 tape round-trips
        // byte-identically even though `parseTape` normalised the field in.
        // Getting this wrong would rewrite all 23 committed fixtures the
        // first time anything re-serialized them.
        ...(t.tape_version >= 3 ? {
            persistence: t.persistence.map((c) => ({
                level: c.level, tag: c.tag, ...(c.note ? { note: c.note } : {}),
            })),
        } : {}),
        tick_count: t.tick_count,
        inputs: t.inputs.map((s) => ({ key: s.key, from: s.from, to: s.to })),
    };
    return `${JSON.stringify(ordered, null, 2)}\n`;
}

/**
 * ── THE RUNTIME'S TAPE BUDGET, measured at R3 slice 0 ─────────────────
 *
 * The recompiled game cannot load an arbitrarily large tape: it dies with
 * `heap_alloc(...) failed - out of memory` BEFORE the first tick, so a tape
 * past the budget is a DEAD RUN and not a slow one. R2 found this by
 * running out of it — a denser plan of the same walk cost 30% more ticks
 * and 4.7x the spans, and the game then refused the headline outright.
 *
 * ⚠ THERE ARE TWO INDEPENDENT CEILINGS AND NEITHER SUBSUMES THE OTHER.
 * `scripts/procgen/probe-seedling-span-ceiling.mjs`, fresh page per load:
 *
 *   - SPAN COUNT: 2078 spans load, 2132 fail (at 36 bytes per synthetic
 *     span, so 76 KB vs 78 KB — bytes were nowhere near their own limit).
 *   - JSON BYTES: a 853-span tape padded with an inert field survives to
 *     95 KB and dies by 159 KB, far past the 78 KB the span sweep died at.
 *
 * A real span costs ~74 bytes against the probe's ~36, which is why the two
 * happen to bind at about the same tape — 2078 real spans would be ~154 KB.
 * Budget against BOTH.
 *
 * The limits below sit deliberately INSIDE the measured band, because the
 * measurement is of one build on one machine and the failure it guards
 * against costs a whole recording deadline. R2's committed headline is 853
 * spans / 63 KB, so this leaves it roughly twice the room it uses.
 *
 * ⚠ A THROW, NOT A WARNING, and at SYNTHESIS rather than at load: the
 * point is to fail while a planner is still running and cheap, not after
 * `--win` has spent forty minutes discovering it. Chunking `botLoadTape`
 * was the alternative and it is not one — concatenating chunks rebuilds
 * the same string, so it would not even address the allocation that fails.
 */
export const TAPE_BUDGET = Object.freeze({
    spans: 1800,
    bytes: 90 * 1024,
    measured: '2078/2132 spans, 95/159 KB — probe-seedling-span-ceiling.mjs, 2026-08-01',
});

/**
 * Throw unless `tape` is inside the budget the runtime actually has.
 *
 * @param {object} tape  a parsed or parseable tape
 * @param {string} what  what to name in the error (a fixture name, usually)
 */
export function assertTapeWithinRuntimeBudget(tape, what = 'tape') {
    const t = parseTape(tape);
    const spans = t.inputs.length;
    const bytes = serializeTape(t).length;
    if (spans > TAPE_BUDGET.spans || bytes > TAPE_BUDGET.bytes) {
        throw new Error(`${what} is past the recompiled runtime's tape budget: `
            + `${spans} spans (limit ${TAPE_BUDGET.spans}), `
            + `${Math.round(bytes / 1024)} KB (limit ${Math.round(TAPE_BUDGET.bytes / 1024)} KB). `
            + `The game refuses such a tape at LOAD with heap_alloc failure, before the `
            + `first tick — this is a dead run, not a slow one. Measured ceilings: `
            + `${TAPE_BUDGET.measured}. Split the walk into more segments, or make the `
            + 'plan less dense (R2: a smoother margin cost 4.7x the spans for 30% more '
            + 'ticks).');
    }
    return { spans, bytes };
}

/**
 * The GAME's side of the `transitions` record, derived from the tick
 * stream it already drains.
 *
 * `Bot.as` hardcodes `transitions: []` and no re-recording will change
 * that, but §1 ruling 2 defines an entry as "the first observation tick
 * whose `level` is the new level" — a pure function of the ticks. So this
 * is the whole of the game's side, and it lives here, in ONE place, used by
 * every consumer of a drained stream. The JS engine must NOT be routed
 * through it: `tapeRunner` derives its entries from its own world swap, and
 * if both sides derived from the level field the transitions diff would
 * degenerate into diffing the tick stream against itself.
 *
 * A same-level teleport is invisible to this definition, which is why
 * `playerPhysicsV2` refuses to model one rather than emitting an entry the
 * oracle could never produce.
 */
export function deriveTransitions(ticks) {
    const out = [];
    for (let i = 1; i < ticks.length; i++) {
        if (ticks[i].level !== ticks[i - 1].level) {
            out.push({
                t: ticks[i].t,
                from_level: ticks[i - 1].level,
                to_level: ticks[i].level,
            });
        }
    }
    return out;
}

/**
 * Validate an observation stream's SHAPE (not its values).
 *
 * `transitions` carries `{t, from_level, to_level}` per §1 ruling 2. The
 * checks below are all intrinsic to a record — integer fields, `t >= 1`
 * (the boot level is where observation 0 already is, so the earliest
 * possible swap lands at observation 1), strictly ascending `t` (one world
 * swap per tick at most), `t` within the stream, and a level change that
 * actually changes level.
 *
 * What is deliberately NOT checked here: that each `t` is a tick where the
 * `level` field changes, and that every such change has a record. That
 * would be true by construction on both sides — the game's entries are
 * DERIVED from the level field and the engine's swap writes both — so
 * asserting it would cost the transitions diff its independence and leave
 * it checking nothing the tick comparison had not already checked.
 */
export function parseObservationStream(input) {
    let raw = input;
    if (typeof input === 'string') {
        try {
            raw = JSON.parse(input);
        } catch (e) {
            fail(`observation stream is not valid JSON: ${e.message}`);
        }
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        fail('observation stream must be an object { ticks, transitions }');
    }
    if (!Array.isArray(raw.ticks)) fail('observation stream .ticks must be an array');
    if (!Array.isArray(raw.transitions)) {
        fail('observation stream .transitions must be an array');
    }
    raw.ticks.forEach((o, i) => {
        const where = `ticks[${i}]`;
        if (o === null || typeof o !== 'object') fail(`${where} must be an object`);
        requireInt(o.t, `${where}.t`);
        requireFiniteNumber(o.x, `${where}.x`);
        requireFiniteNumber(o.y, `${where}.y`);
        requireInt(o.level, `${where}.level`);
        if (o.t !== i) fail(`${where}.t must equal its index (${i}), got ${o.t} — `
            + 'observations are dense and in order on both sides');
    });
    raw.transitions.forEach((tr, i) => {
        const where = `transitions[${i}]`;
        if (tr === null || typeof tr !== 'object' || Array.isArray(tr)) {
            fail(`${where} must be an object { t, from_level, to_level }`);
        }
        requireInt(tr.t, `${where}.t`);
        requireInt(tr.from_level, `${where}.from_level`);
        requireInt(tr.to_level, `${where}.to_level`);
        if (tr.t < 1) {
            fail(`${where}.t must be >= 1, got ${tr.t} — t is the first observation `
                + 'in the NEW level, and observation 0 is the boot level by definition');
        }
        if (tr.t >= raw.ticks.length) {
            fail(`${where}.t (${tr.t}) is past the end of the stream `
                + `(${raw.ticks.length} observations)`);
        }
        if (i > 0 && tr.t <= raw.transitions[i - 1].t) {
            fail(`${where}.t (${tr.t}) must be strictly greater than `
                + `transitions[${i - 1}].t (${raw.transitions[i - 1].t}) — at most one `
                + 'world swap lands per tick, and records are in order');
        }
        if (tr.from_level === tr.to_level) {
            fail(`${where} goes from level ${tr.from_level} to itself. A same-level `
                + 'teleport produces no level change in the tick stream, so the game '
                + 'side could never report one — it is refused at the engine instead '
                + 'of modelled asymmetrically');
        }
    });
    return {
        ticks: raw.ticks.map((o) => ({ t: o.t, x: o.x, y: o.y, level: o.level })),
        transitions: raw.transitions.map((tr) => ({
            t: tr.t, from_level: tr.from_level, to_level: tr.to_level,
        })),
    };
}

/** Serialize an observation stream to canonical JSON. */
export function serializeObservationStream(stream) {
    const s = parseObservationStream(stream);
    return `${JSON.stringify(s, null, 2)}\n`;
}

/**
 * Compare two observation streams for EXACT equality and return a
 * human-readable diff (null when identical).
 *
 * Exactness is deliberate and load-bearing: AS3 `Number` is an IEEE-754
 * double, JS numbers are doubles, and the recompiled C runtime uses
 * doubles too, so a mismatch is a transcription DEFECT to investigate,
 * not a tolerance to configure. If a genuine representation mismatch is
 * ever proven, document the evidence in the brief before bounding it.
 */
export function diffObservationStreams(expected, actual) {
    const e = parseObservationStream(expected);
    const a = parseObservationStream(actual);
    if (e.ticks.length !== a.ticks.length) {
        return `tick count differs: expected ${e.ticks.length}, got ${a.ticks.length}`;
    }
    for (let i = 0; i < e.ticks.length; i++) {
        const et = e.ticks[i];
        const at = a.ticks[i];
        if (et.x !== at.x || et.y !== at.y || et.level !== at.level) {
            return `tick ${i} differs: expected `
                + `(x=${et.x}, y=${et.y}, level=${et.level}), got `
                + `(x=${at.x}, y=${at.y}, level=${at.level})`
                + ` [dx=${at.x - et.x}, dy=${at.y - et.y}]`;
        }
    }
    // The transitions leg is ELEMENT-WISE and exact. It is a weaker check
    // than it looks if you forget where each side's entries came from: the
    // game's are derived from its level field, the engine's from its own
    // world swap, so this compares two independent accounts of the same
    // crossing. A count-only comparison (what v1 shipped) passes a run that
    // crossed the right number of times in the wrong places.
    const renderT = (tr) => `{t:${tr.t}, ${tr.from_level}->${tr.to_level}}`;
    const n = Math.min(e.transitions.length, a.transitions.length);
    for (let i = 0; i < n; i++) {
        const et = e.transitions[i];
        const at = a.transitions[i];
        if (et.t !== at.t || et.from_level !== at.from_level
            || et.to_level !== at.to_level) {
            return `transition ${i} differs: expected ${renderT(et)}, got ${renderT(at)}`;
        }
    }
    if (e.transitions.length !== a.transitions.length) {
        return `transition count differs: expected ${e.transitions.length} `
            + `[${e.transitions.map(renderT).join(', ')}], got ${a.transitions.length} `
            + `[${a.transitions.map(renderT).join(', ')}]`;
    }
    return null;
}

export { TapeFormatError };
