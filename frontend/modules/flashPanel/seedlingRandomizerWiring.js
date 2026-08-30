/**
 * flashPanel/seedlingRandomizerWiring — **THE LAZY HALF**: the heavy modules,
 * the two fetches, the location join, and the construction the verifier
 * mirrors (EDITOR INTEGRATION slice P1-b; plan §17.1.4, §17.2.5, §17.5).
 *
 * ── ⛔⛔ WHY EVERY IMPORT HERE IS A COMPUTED SPECIFIER ────────────────────
 *
 * `frontend/init-bundled.js` reaches 494 files and not one level-set module is
 * among them. MEASURED at `f5d7b43fc`, four builds of
 * `node scripts/build/bundle-frontend.js --no-minify`, which prints its own
 * input count:
 *
 *   baseline                                              494 files  8,584,629 B
 *   static  `import {X} from '…/apPlacementRewriter.js'`   574 (+80)  9,394,789 B
 *   dynamic `await import('…/apPlacementRewriter.js')`     581 (+87)  9,481,672 B
 *   dynamic with a NON-LITERAL specifier                   494 (+0)   8,584,894 B
 *
 * ⛔ **A DYNAMIC IMPORT WITH A LITERAL SPECIFIER COSTS MORE THAN A STATIC
 * ONE.** The bundler is esbuild with `bundle: true` and **`splitting: false`**
 * (`scripts/build/bundle-frontend.js:53-66`), so it resolves a literal
 * specifier at build time and INLINES the module — and it inlines seven files
 * MORE than the static form, because a namespace object defeats tree-shaking.
 * "Lazy" is not a property of the `await`; it is a property of whether the
 * bundler can see the string.
 *
 * ⇒ the only form that keeps the bundle unmoved is a specifier the bundler
 * cannot evaluate, and **+265 B IS the loader stub**. The base is
 * `document.baseURI`, never `import.meta.url`: in the bundled build this
 * module's own URL is `frontend/dist/bundle.js`, so a module-relative resolve
 * would look for `dist/modules/…`. The document is `frontend/index.html` in
 * BOTH builds, which is the same convention `flashPanelUI`'s
 * `GAMES_DIR = './modules/flashPanel/games/'` already fetches against.
 *
 * ⛓ AND THIS WHOLE FILE IS BEHIND THAT STUB. `flashPanelUI` reaches it the
 * same computed way, so its own static imports (`apPlacementRewriter` and
 * friends) never enter the bundler's graph at all.
 *
 * ── ⛓⛓ THE JOIN: A LEDGER ROW → THE LOADED PRESET'S PLACEMENT ───────────
 *
 * Two of the three seedling presets are not written in the goal ledger's
 * vocabulary, and finding that out is what this module is shaped by.
 *
 *   `seedling_playthrough`  41 locations, named `"Level 010 - Sword"` — the
 *                           ledger's own derived spelling. 41/41 DIRECT.
 *   `seedling` (stage 1)    40 locations from the upstream Seedling APWorld,
 *                           named `"Penguin's Feather"`, `"Chest (Waterfall)"`.
 *                           0 direct — and 40/41 through the AP ID.
 *   `seedling_atlas`        1 location. 0 either way ⇒ ineligible at (iii).
 *
 * ⛔ **THE SECOND PATH IS THE AP ID, WHICH IS EXACT — NOT A NAME MATCH.** The
 * stage-1 preset's location records carry `"id": 20000000…`, which is
 * literally `games/seedling.json`'s `ap_id_offset + ap_locations[k].id`. So
 * the chain is ledger row → `flash_name` → AP id → the loaded location with
 * that id. No tolerance, no nearest-match, no spelling family.
 *
 * ⛓ AND `ledger row → flash_name` IS DERIVED FOUR WAYS, EACH FROM DATA THAT
 * ALREADY EXISTS — see `flashNameForLedgerRow`. **The explicit remainder table
 * is EMPTY**, and a row asserts it never grows.
 *
 * ── ⛓ THE FILTERED LEDGER, AND WHY IT IS NOT A SILENT SKIP ──────────────
 *
 * `buildPlacementTable` REFUSES BY NAME when a rewritable row has no
 * placement — deliberately: *"a location AP will hand an item to and the
 * player can never find"*. The stage-1 preset has no location for
 * `seed@L115`, because in the upstream world the goal is an EVENT, not a
 * check. Refusing 38 good placements over one absent goal row is the wrong
 * trade, so the LEDGER — which is already an injected parameter of
 * `buildPlacementTable` — is filtered to the rows that resolve, and the
 * dropped ones are REPORTED by name. A dropped location keeps the adapter's
 * property path, because `hostOwnedLocations()` is built from the table and
 * cannot contain it. ⚠ For `seedling_playthrough` NOTHING is filtered, so the
 * table is byte-for-byte the one `verify-seedling-ap-placement.mjs` builds.
 */

import {
    AP_ITEM_CAPABILITY,
    seedlingRandomizerEligibility,
} from './seedlingRandomizerEligibility.js';
import { SeedlingCheckBinding } from './seedlingCheckBinding.js';
import { SeedlingLevelSetDelivery } from './seedlingLevelSetDelivery.js';

/**
 * The four modules the rewrite needs, as DOCUMENT-relative specifiers. ⛔ They
 * are data, not import statements: `loadApModules` hands each one to an
 * injected importer, and the default importer's specifier is a parameter —
 * which is the whole point (see the header's measurement).
 */
export const AP_MODULE_PATHS = Object.freeze({
    rewriter: 'modules/seedlingDemo/apPlacementRewriter.js',
    exporter: 'modules/seedlingDemo/levelSetExporter.js',
    validator: 'modules/seedlingDemo/levelSetValidator.js',
    ledger: 'modules/seedlingDemo/r7Acceptance.js',
    derivation: 'modules/seedlingDemo/seedlingAtlasDerivation.js',
});

/** The two documents the rewrite is built FROM, likewise document-relative. */
export const AP_ASSET_PATHS = Object.freeze({
    recordSet: 'modules/seedlingDemo/fixtures/seedling-vanilla-set.json',
    atlasDir: 'modules/flashPanel/atlases/',
    defaultMap: 'modules/flashPanel/atlases/seedling-map.json',
});

/**
 * ⛓⛓ **THE REMAINDER TABLE, AND IT IS EMPTY.** Every ledger row's
 * `flash_name` is derived; nothing is aliased by hand. It exists as a named
 * empty object rather than not existing, because the row below asserts it
 * NEVER GROWS — a future ledger row that cannot be derived must be an
 * explicit, reviewed entry rather than a silent `undefined` that reads as
 * "this location has no AP placement".
 */
export const LEDGER_FLASH_NAME_REMAINDER = Object.freeze({});

/**
 * A ledger row's `flash_name`, DERIVED. The four arms, and what each is
 * measured against:
 *
 *  - `key`       → `key<N>`, N parsed from the row's OWN id (`bosskey<N>@L…`),
 *                  the same regex `entityForLedgerRow` uses. Cross-checked
 *                  against the entity's `@keyType`: 0…4 agree.
 *  - `chest`     → `chest<level>`. MEASURED: the ledger's 16 chest levels are
 *                  EXACTLY the 16 `chestNN` suffixes in `ap_locations`, so NN
 *                  is the level and not an index.
 *  - `totempart` → `totem<N>`, N the entity's own `@totempart` attribute. ⛔
 *                  This is the one arm the ledger id cannot answer — it
 *                  addresses by pixel position — so it needs the room map,
 *                  which this module has fetched anyway.
 *  - everything else → the `tag`, unless the tag is not an `ap_locations`
 *                  name; then the `games/*.json` `locations[]` row whose
 *                  `ap_name` is `ITEM_FOR_TAG[tag]`. MEASURED: that second
 *                  hop is needed exactly once and derives `torchpickup` →
 *                  `Light` → `torch`, which is why no alias is typed here.
 *
 * @returns {string|null}
 */
export function flashNameForLedgerRow(row, deps) {
    const { apLocationNames, itemForTag, flashNameForApName, entityForLedgerRow, roomsByLevel } = deps;
    if (!row) return null;
    if (LEDGER_FLASH_NAME_REMAINDER[row.id]) return LEDGER_FLASH_NAME_REMAINDER[row.id];
    if (row.kind === 'key') {
        const m = /bosskey(\d)@/.exec(row.id);
        return m ? `key${m[1]}` : null;
    }
    if (row.kind === 'chest') return `chest${row.level}`;
    if (row.kind === 'totempart') {
        const room = roomsByLevel.get(row.level);
        const { entity } = room ? entityForLedgerRow(room, row) : { entity: null };
        const index = entity?.attrs?.totempart;
        return index === undefined || index === null ? null : `totem${index}`;
    }
    const tag = row.kind === 'encounter' ? String(row.id).split('@')[0] : row.tag;
    if (typeof tag !== 'string' || tag === '') return null;
    if (apLocationNames.has(tag)) return tag;
    // The one derived hop: the tag names an item, and the game config's own
    // property table names that item's flash_name.
    const viaItem = flashNameForApName.get(itemForTag[tag]);
    return viaItem ?? tag;
}

/** `stateManager`'s slot, as an integer. ⛔ `Number('') === 0` and
 *  `Number(null) === 0` (M1-b's trap): a blank slot would make every item read
 *  as foreign rather than as this player's. */
export function selfPlayerOf(playerId) {
    const s = typeof playerId === 'number' ? String(playerId) : playerId;
    return typeof s === 'string' && /^\d+$/.test(s.trim()) ? Number(s.trim()) : null;
}

const itemOfRecord = (rec) => (
    rec && typeof rec.item?.name === 'string' && Number.isInteger(rec.item?.player)
        ? { name: rec.item.name, player: rec.item.player }
        : null);

/**
 * The production `locationItemOf`, plus the census the eligibility predicate's
 * check (iii) is answered from.
 *
 * ⚠ `locations` IS `stateManager.getStaticData()?.locations`, a Map of name →
 * the full location record. The panel holds the PROXY
 * (`flashPanelUI.js:1` imports `stateManagerProxySingleton`) and the proxy has
 * NO `getLocationItem` — that method is on the worker-side class. Reading the
 * Map is also what makes the AP-id path possible at all, since
 * `getLocationItem` returns `{name, player}` and never the id.
 *
 * @returns {{locationItemOf: Function, ledgerUsed: object[], census: object}}
 */
export function buildLocationResolver({ ledger, gameConfig, locations, roomsByLevel, deps }) {
    const { entityForLedgerRow, itemForTag, labelFor, levelName } = deps;
    const apLocations = Array.isArray(gameConfig?.ap_locations) ? gameConfig.ap_locations : [];
    const offset = Number(gameConfig?.ap_id_offset) || 0;
    const apLocationNames = new Set(apLocations.map((l) => l.flash_name));
    const apIdOf = new Map(apLocations.map((l) => [l.flash_name, offset + Number(l.id)]));
    const flashNameForApName = new Map(
        (gameConfig?.locations ?? []).map((l) => [l.ap_name, l.flash_name]));

    const byName = locations instanceof Map ? locations : new Map(Object.entries(locations ?? {}));
    const byApId = new Map();
    for (const rec of byName.values()) {
        if (Number.isInteger(rec?.id)) byApId.set(rec.id, rec);
    }

    const resolved = new Map();   // ledger location name -> the loaded record
    const census = { direct: 0, viaApId: 0, unjoined: [], total: ledger.length };
    const ledgerUsed = [];
    for (const row of ledger) {
        const name = `${levelName(row.level)} - ${labelFor(row)}`;
        const direct = byName.get(name);
        if (itemOfRecord(direct)) {
            resolved.set(name, direct);
            census.direct += 1;
            ledgerUsed.push(row);
            continue;
        }
        const flashName = flashNameForLedgerRow(row, {
            apLocationNames, itemForTag, flashNameForApName, entityForLedgerRow, roomsByLevel,
        });
        const rec = flashName === null ? null : byApId.get(apIdOf.get(flashName));
        if (itemOfRecord(rec)) {
            resolved.set(name, rec);
            census.viaApId += 1;
            ledgerUsed.push(row);
            continue;
        }
        // ⛓ REPORTED, never silently skipped: the row names itself and the
        // flash_name it looked for, so "why is the Seed still vanilla?" has an
        // answer in the log rather than in a debugger.
        census.unjoined.push(`${row.id}${flashName ? ` (${flashName})` : ' (no flash_name)'}`);
    }
    return {
        locationItemOf: (name) => itemOfRecord(resolved.get(name)),
        ledgerUsed,
        census,
    };
}

/** The map document this preset declares, and where that answer came from. */
export function resolveMapPath(rawRules) {
    const named = rawRules?.region_atlas?.map_document;
    return typeof named === 'string' && named !== ''
        ? { path: AP_ASSET_PATHS.atlasDir + named, source: 'region_atlas.map_document' }
        : { path: AP_ASSET_PATHS.defaultMap, source: 'the atlases default' };
}

/**
 * ⛓⛓ **THE RESET TARGET, CHOSEN BY THE DATA** (⚖ user, 2026-08-29: *"when the
 * load finishes it RESETS THE PLAYER TO THE START OF THE NEWLY LOADED SET"*).
 *
 * The game has exactly two ways to put the player at a set's start, and which
 * one applies is a fact about the SET, not a preference:
 *
 *  - **explicit start** — `teleport({level, x, y})`, i.e. the `new_instance
 *    Game($level,$x,$y)` recipe in `games/seedling.json`, the same constructor
 *    `Teleporter.update()` uses and the one the glue's arrival warp already
 *    rides. Available only when the set's `start` carries a POSITION.
 *  - **the game's own new-game arm** — `level < 0` (`Game.as:832-840`), which
 *    is the only path that runs `LevelSet.applyStart` (`LevelSet.as:451-458`).
 *
 * ⛔ **AND THE VANILLA-DERIVED SET CARRIES NO POSITION.** MEASURED:
 * `vanillaRecordSet(...).set.start` is `{"level": 0}` — level only.
 * `levelSetExporter.js:225` says why in its own words: *"no
 * summary.startCell on entries[0], so the arrival position falls to the Game
 * constructor's own (80, 128)"*. So for every set this slice delivers, the
 * host does NOT know the spawn and the game does. Typing `80, 128` here would
 * hardcode a constant that belongs to `Main.as:51`, and `region_coords` has no
 * level-0 row to derive it from (measured: 9 entries, levels 1,2,19,30,56,…).
 *
 * ⇒ the mode is DERIVED: a start with a position gets the explicit teleport, a
 * start without one gets the arm that can answer. Both are implemented; P1-e
 * measures which reads as *"a new game started"* on the real page and the
 * answer is reported rather than silently chosen.
 */
export const RESET_MODES = Object.freeze({
    EXPLICIT_START: 'explicit-start',
    NEW_GAME_ARM: 'new-game-arm',
});

export function resetTargetFor(set, bootPosition = null) {
    const start = set?.start ?? null;
    if (!start || !Number.isInteger(start.level)) return null;
    if (Number.isInteger(start.x) && Number.isInteger(start.y)) {
        return {
            mode: RESET_MODES.EXPLICIT_START,
            level: start.level,
            x: start.x,
            y: start.y,
            expectLevel: start.level,
            why: `the set names its own start — level ${start.level} at (${start.x}, ${start.y})`,
        };
    }
    /**
     * ⛔⛔ **`applyStart` DOES NOT SUPPLY A POSITION THE SET DOES NOT CARRY, SO
     * THE CONSTRUCTOR'S ARGS STAND — AND ZEROS PARK THE PLAYER IN A SOLID.**
     * MEASURED, P1-e run 4: this returned `{level:-1, x:0, y:0}` on the
     * assumption that the game's new-game arm would place the player itself.
     * It does not. The player landed at pixel (0, 0) — reported as `(8, 8)`
     * in the roster, which is the entity centring — and **level 0 has
     * `tree@0,0`**, so the ruled *"reset to the start"* put them inside a tree
     * in the top-left corner. The reset rows all passed, because they assert
     * that a reset was ISSUED and OBSERVED, not that the destination is
     * somewhere a person can stand.
     *
     * ⇒ the fallback position is the GAME'S OWN, read live: the world as it
     * stood at bridge-ready, before anything was delivered. `Main.as:51` boots
     * `new Game(0, 80, 128)` and the roster then reports the player at
     * (88, 136) — the constructor's args plus half a tile — so the args are
     * recovered with the map document's OWN `tile_size`, never a typed 8.
     * ⛓ `level` stays −1: the new-game arm still runs (and `applyStart` still
     * wins whenever a set DOES carry a start), it simply is not asked to
     * invent a coordinate it does not have.
     */
    /**
     * ⛔⛔ **AND THE BORROWED POSITION IS ONLY VALID IN THE LEVEL IT WAS READ
     * IN.** `(80, 128)` is a standable tile *of level 0*; a set whose start
     * names some other level — a generated one that lost its `summary.
     * startCell`, say — would have that coordinate applied to a room whose
     * geometry nobody consulted. That is the same defect as the zeros, one
     * step less obvious: not "an invented coordinate" but "a real coordinate
     * from the wrong room". ⇒ REFUSED BY NAME. The rooms stay mounted, nothing
     * is bound, and the player is left where they are.
     *
     * ⚠ ARMED ONLY WHEN THE GAME REPORTS A LEVEL. MEASURED, run 4:
     * `botStatus.level` is **−1** before any bot run (its fields are the bot's,
     * unset until `botStart`), so `bootPosition.level` is null in production
     * today and this guard does not fire. It is pinned in node rather than
     * left to be discovered, and the honest statement is that the host needs a
     * real read of `Main.level` — a DECLARED bridge property it does not
     * currently parse — before this can protect anyone.
     */
    if (bootPosition && bootPosition.level != null && bootPosition.level !== start.level) {
        return {
            mode: RESET_MODES.NEW_GAME_ARM,
            level: -1,
            x: null,
            y: null,
            expectLevel: start.level,
            refused: true,
            why: `the set starts in level ${start.level} and carries no position, but the only `
                + `position the host has was read in level ${bootPosition.level} — a standable `
                + 'tile of THAT room says nothing about this one',
        };
    }
    return {
        mode: RESET_MODES.NEW_GAME_ARM,
        level: -1,
        x: bootPosition?.x ?? null,
        y: bootPosition?.y ?? null,
        expectLevel: start.level,
        why: `the set's start names level ${start.level} and NO position, so the game's own `
            + 'new-game arm (level < 0) runs, with the constructor args taken from the '
            + 'position the GAME itself booted at',
    };
}

/**
 * ⛔⛔ **WHAT THE HOST CAN AND CANNOT SEE OF A WORLD SWAP — trap 972.**
 * `FP.world = x` writes `FP._goto` only; the swap lands in
 * `Engine.checkWorld()` at the END of the next `Engine.update()`. `Game`'s
 * constructor has ALREADY written `Main.level` and `Main.playerPositionX/Y`
 * by then (they are setters onto statics), so a poll on either of those
 * declared bridge properties proves CONSTRUCTION, never the swap — which is
 * exactly the row M1b found could not fail.
 *
 * `botMobiles()` is different: it enumerates the roster of whatever `FP.world`
 * IS at the moment of the call. So the confirmation is *"the level is the one
 * we asked for AND a roster exists for it"* — read off the world rather than
 * off a static. ⚠ It is still not object identity, and P1-e measures what the
 * live page actually reports; a sleep is never the answer either way.
 */
export function readWorld(bot) {
    let status = null;
    let mobiles = null;
    try { status = JSON.parse(bot('botStatus')); } catch { status = null; }
    try { mobiles = JSON.parse(bot('botMobiles')); } catch { mobiles = null; }
    const roster = mobiles?.mobiles ?? null;
    const player = Array.isArray(roster)
        ? roster.find((m) => /(^|:)Player$/.test(String(m.cls ?? ''))) ?? null
        : null;
    /**
     * ⛓ `time` IS CARRIED because the game's own new-game arm
     * (`Game.as:832-840`, `level < 0`) sets `time = dayLength / 2` — the one
     * field that arm writes and an ordinary construction does not.
     * `verify-seedling-bot-differential.mjs:2094` establishes that `botStatus`
     * serves `Game.time` and that it ADVANCES while the page runs, so it can
     * only ever be read as a lower bound. ⚠ And it may not discriminate at
     * all: `procgenOracle.js:221` records that a stored `0` is APPLIED as
     * `dayLength / 2` too, so an ordinary boot off an empty save may already
     * be at that value. Carried and REPORTED for that reason — the measurement
     * decides whether it is a witness.
     */
    return { level: status?.level ?? null, rosterSize: roster?.length ?? null, player,
        time: status?.time ?? null, status };
}

const defaultWaitFrame = () => new Promise((r) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => r());
    else setTimeout(r, 0);
});

/**
 * ⛓⛓ **THE LOAD SEQUENCE, AS RULED** — overlay on, deliver, reset, overlay
 * off — with every dependency injected so the whole thing runs in node.
 *
 * ⚠ **PROGRESS IS BY PHASE, NOT BY CHUNK, AND THAT IS MEASURED RATHER THAN
 * CHOSEN.** `SeedlingLevelSetDelivery.deliver()` is SYNCHRONOUS: it sends all
 * nine chunks in one loop with no per-chunk hook. A browser cannot paint
 * inside a synchronous loop, so a *"rooms k/N"* readout would be a number
 * nobody ever sees — and adding an `onChunk` callback means editing a module
 * this slice may not touch. So each PHASE sets the overlay text and then
 * awaits a frame, which is the granularity the display can actually show.
 *
 * ⛔ A REFUSAL DOES NOT RESET AND DOES NOT BIND. The game stays vanilla, and a
 * vanilla room must keep the adapter's property path — so `setCheckBinding` is
 * never called, and `hostOwnedLocations()` therefore never stands the adapter
 * down.
 */
export async function runSeedlingRandomizerLoad({
    loaded,
    glue,
    teleport,
    bot,
    overlay,
    log = () => {},
    waitFrame = defaultWaitFrame,
    now = () => Date.now(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    swapTimeoutMs = 30000,
    swapPollMs = 100,
} = {}) {
    const steps = [];
    const step = (name, detail) => { steps.push({ name, detail }); };

    overlay.show();
    overlay.setText('preparing randomized rooms…');
    step('overlay-on');
    await waitFrame();

    const rooms = loaded.set?.rooms?.length ?? 0;
    glue.setDelivery(loaded.delivery);
    loaded.delivery.attachBot(bot);
    overlay.setText(`delivering ${rooms} randomized room(s)…`);
    step('deliver-begin', { rooms });
    await waitFrame();

    const result = loaded.delivery.deliver();
    step('deliver-end', { ok: result.ok, chunks: result.chunks, why: result.why });
    if (!result.ok) {
        overlay.setText(`the randomized rooms did NOT load — ${result.why}. The game is `
            + 'running the vanilla rooms.', 'error');
        log(`[ap placement] DELIVERY REFUSED — ${result.why}`, 'error');
        return { ok: false, why: result.why, reset: null, steps, delivered: result };
    }

    /**
     * ⛔⛔ **THE WORLD IS READ BEFORE THE RESET, AND IT DOES TWO JOBS.**
     *
     * (1) It is the only thing that makes the reset OBSERVABLE for this set:
     * the confirmation below waits for `level === expectLevel`, and for every
     * set this slice delivers `expectLevel` is **0, the level the game already
     * booted into** — true on its first iteration whether or not the reset
     * landed, vacuous in exactly the way the ordering fixture was (trap 981)
     * and the M1 door row was (trap 985). What CAN move is the world itself,
     * so the BEFORE/AFTER pair is recorded and REPORTED rather than reduced to
     * a boolean here; the gate owns the comparison.
     *
     * (2) It supplies the position the constructor is given when the SET does
     * not carry one — see `resetTargetFor`. This read must therefore happen
     * BEFORE the target is chosen, and before anything moves the player.
     */
    const before = readWorld(bot);
    /**
     * ⛓ THE HALF-TILE IS THE MAP DOCUMENT'S, NOT AN 8. `Entity` centres on its
     * cell, so a roster position is the constructor's argument plus
     * `tile_size / 2`; taking the divisor from the document the rooms came
     * from means a set on a different grid is followed rather than mis-placed.
     */
    const tileSize = Number(loaded.tileSize);
    const halfTile = Number.isFinite(tileSize) ? Math.floor(tileSize / 2) : 0;
    const bootPosition = before.player
        ? {
            x: before.player.x - halfTile,
            y: before.player.y - halfTile,
            // ⛓ The level the position BELONGS to, when the game reports one.
            // `botStatus.level` is −1 before a bot run, and a negative level is
            // the game's own "no game" sentinel, so it is carried as null
            // rather than compared as a room number.
            level: Number.isInteger(before.level) && before.level >= 0 ? before.level : null,
        }
        : null;

    const target = resetTargetFor(loaded.set, bootPosition);
    if (!target) {
        // ⛓ REFUSED RATHER THAN GUESSED. A set with no `start.level` has no
        // start to reset to, and picking level 0 would invent one.
        overlay.setText('the randomized rooms are loaded, but the set names no start — '
            + 'the player was NOT moved.', 'error');
        log('[ap placement] the delivered set has no `start.level`, so no reset was made', 'error');
        overlay.hide();
        return { ok: true, why: null, reset: null, steps, delivered: result };
    }

    overlay.setText(`starting the randomized game (${target.mode})…`);
    step('reset-begin', { mode: target.mode, level: target.level,
        expectLevel: target.expectLevel, args: { x: target.x, y: target.y }, halfTile,
        world: { level: before.level, rosterSize: before.rosterSize, time: before.time,
            player: before.player ? { x: before.player.x, y: before.player.y } : null } });
    await waitFrame();
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) {
        // ⛔ REFUSED RATHER THAN SENT AS ZEROS. Zeros are what put the player
        // inside `tree@0,0` in run 4; a reset with no position to send is a
        // reset that should not be made.
        const why = target.refused ? target.why
            : 'the game did not report a position to start from';
        overlay.setText(`the randomized rooms are loaded, but ${why} — the player was `
            + 'NOT moved.', 'error');
        log(`[ap placement] no position to reset to — ${why}; the rooms are mounted and the `
            + 'player was left where they were', 'error');
        step('reset-end', { landed: false, why: target.refused ? 'wrong room' : 'no position' });
        overlay.hide();
        return { ok: true, why: 'no position to reset to', reset: { ...target, landed: false },
            steps, delivered: result };
    }
    teleport({ level: target.level, x: target.x, y: target.y });

    // ⛔ POLLED, NEVER SLEPT (trap 972 / trap 970: a wall-clock settle in a
    // browser is a FRAME budget in disguise, and this page's frame rate is a
    // property of the GPU it drew on).
    const t0 = now();
    let world = null;
    let landed = false;
    for (;;) {
        world = readWorld(bot);
        if (world.level === target.expectLevel && world.player) { landed = true; break; }
        if (now() - t0 > swapTimeoutMs) break;
        await sleep(swapPollMs);
    }
    step('reset-end', { landed, waitedMs: now() - t0, level: world?.level ?? null,
        rosterSize: world?.rosterSize ?? null, time: world?.time ?? null,
        player: world?.player ? { x: world.player.x, y: world.player.y } : null,
        // ⛓ The honest witness: did ANYTHING about the world move? Reported,
        // never asserted here — the gate owns the comparison.
        moved: before.rosterSize !== world?.rosterSize
            || before.player?.x !== world?.player?.x
            || before.player?.y !== world?.player?.y
            || before.time !== world?.time });

    if (!landed) {
        overlay.setText(`the randomized rooms are loaded, but the reset to level `
            + `${target.expectLevel} was not observed within ${swapTimeoutMs} ms.`, 'error');
        log(`[ap placement] the reset was not observed — the world still reports level `
            + `${world?.level ?? 'nothing'}`, 'error');
        overlay.hide();
        return { ok: true, why: 'reset not observed', reset: { ...target, landed }, steps,
            delivered: result };
    }

    // ⛔ THE BINDING ATTACHES AFTER THE RESET LANDS, and with it the adapter's
    // stand-down: until the rewritten rooms are the ones being played, the
    // property path is still the right owner of every location.
    glue.setCheckBinding(loaded.checkBinding);
    step('bind');
    overlay.hide();
    step('overlay-off');
    log(`[ap placement] ${rooms} randomized room(s) mounted in ${result.chunks} chunk(s); `
        + `${loaded.replaced} location(s) replaced; started at level ${target.expectLevel} `
        + `(${target.mode})`);
    return { ok: true, why: null, reset: { ...target, landed: true, observed: world }, steps,
        delivered: result };
}

const defaultFetchJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
};

/**
 * ⛔ THE DEFAULT IMPORTER'S SPECIFIER IS A PARAMETER, and that is the whole
 * bundle measurement in one line. Written as a literal here it would inline
 * 87 files; written as `url` the bundler cannot evaluate it and emits the
 * runtime import instead.
 */
const defaultImportModule = (url) => import(/* @vite-ignore */ url);

/**
 * Everything the panel needs to hand the glue, or a refusal that says why.
 *
 * The construction MIRRORS `verify-seedling-ap-placement.mjs:96-137, 311-323,
 * 1077-1078` verbatim — `vanillaRecordSet` → `buildPlacementTable` →
 * `rewriteRecordSet` → `apMappingInvalidation` → `SeedlingLevelSetDelivery` →
 * `SeedlingCheckBinding` — because that gate is the only other constructor of
 * these two modules and a second recipe would be a second thing to be right.
 *
 * @returns {Promise<{verdict: string, why: string, eligibility: object,
 *   delivery: object|null, checkBinding: object|null, table: Map|null,
 *   replaced: number, set: object|null, invalidation: object|null,
 *   census: object|null, assets: object|null, selfPlayer: number|null}>}
 */
export async function loadSeedlingRandomizer({
    flashPanel,
    manifest,
    rawRules = null,
    locations,
    playerId,
    gameConfig,
    bot = null,
    baseUrl,
    fetchJson = defaultFetchJson,
    importModule = defaultImportModule,
    log = () => {},
} = {}) {
    const url = (rel) => new URL(rel, baseUrl).href;
    const refuse = (eligibility, extra = {}) => ({
        verdict: eligibility.verdict,
        why: eligibility.why,
        eligibility,
        delivery: null,
        checkBinding: null,
        table: null,
        replaced: 0,
        set: null,
        invalidation: null,
        census: null,
        assets: null,
        selfPlayer: null,
        ...extra,
    });

    // ── the cheap two, first: nothing heavy is fetched for a preset that
    //    cannot use it ────────────────────────────────────────────────────
    const cheap = seedlingRandomizerEligibility({ flashPanel, transport: 'wasm', manifest });
    if (cheap.verdict === 'ineligible') return refuse(cheap);

    // ── (iv) the two documents ──────────────────────────────────────────
    const mapPath = resolveMapPath(rawRules);
    const assets = {
        recordSet: { url: url(AP_ASSET_PATHS.recordSet), ok: false },
        map: { url: url(mapPath.path), ok: false, source: mapPath.source },
    };
    let embed = null;
    let mapDoc = null;
    try {
        embed = await fetchJson(assets.recordSet.url);
        assets.recordSet.ok = true;
    } catch (e) { assets.recordSet.why = e.message; }
    try {
        mapDoc = await fetchJson(assets.map.url);
        assets.map.ok = true;
    } catch (e) { assets.map.why = e.message; }

    if (!assets.recordSet.ok || !assets.map.ok) {
        return refuse(seedlingRandomizerEligibility(
            { flashPanel, transport: 'wasm', manifest, assets }), { assets });
    }

    // ── the heavy modules ───────────────────────────────────────────────
    const [rewriter, exporter, validator, ledgerMod, derivation] = await Promise.all(
        [AP_MODULE_PATHS.rewriter, AP_MODULE_PATHS.exporter, AP_MODULE_PATHS.validator,
            AP_MODULE_PATHS.ledger, AP_MODULE_PATHS.derivation].map((p) => importModule(url(p))));

    const roomsByLevel = new Map((mapDoc.levels ?? []).map((r) => [r.level, r]));
    const { locationItemOf, ledgerUsed, census } = buildLocationResolver({
        ledger: ledgerMod.R7_GOAL_LEDGER,
        gameConfig,
        locations,
        roomsByLevel,
        deps: {
            entityForLedgerRow: derivation.entityForLedgerRow,
            itemForTag: derivation.ITEM_FOR_TAG,
            labelFor: derivation.labelFor,
            levelName: derivation.levelName,
        },
    });

    // ── (iii) the placement, and the full verdict ───────────────────────
    const eligibility = seedlingRandomizerEligibility({
        flashPanel,
        transport: 'wasm',
        manifest,
        placement: { resolved: census.direct + census.viaApId, total: census.total,
            unresolved: census.unjoined },
        assets,
    });
    if (!eligibility.eligible) return refuse(eligibility, { census, assets });

    const selfPlayer = selfPlayerOf(playerId);
    if (selfPlayer === null) {
        return refuse({
            ...eligibility,
            eligible: false,
            verdict: 'ineligible',
            failed: 'placement',
            why: `placement: the loaded slot ${JSON.stringify(playerId)} is not an integer `
                + 'player id — every `look` decision is relative to it, and a blank one would '
                + 'make every item read as foreign',
        }, { census, assets });
    }

    if (census.unjoined.length > 0) {
        log(`[ap placement] ${census.unjoined.length} goal-ledger row(s) have no AP location in `
            + `these rules and stay VANILLA: ${census.unjoined.join(', ')}`);
    }

    const { set: vanilla } = exporter.vanillaRecordSet(embed, mapDoc);
    const { table, entries, encounters } = rewriter.buildPlacementTable({
        locationItemOf,
        ledger: ledgerUsed,
        rooms: mapDoc.levels,
        selfPlayer,
    });
    const { set, replaced } = rewriter.rewriteRecordSet(vanilla, table);
    const invalidation = exporter.apMappingInvalidation(set);

    const delivery = new SeedlingLevelSetDelivery({
        planChunks: validator.planLevelSetChunks,
        bot,
        log,
    }).arm(set, invalidation);
    const checkBinding = new SeedlingCheckBinding({
        table, placementKey: rewriter.placementKey, selfPlayer,
    });

    return {
        verdict: 'eligible',
        why: eligibility.why,
        eligibility,
        delivery,
        checkBinding,
        table,
        entries,
        encounters,
        replaced,
        set,
        invalidation,
        census,
        assets,
        selfPlayer,
        /** ⛓ The map document's OWN grid, carried so the reset can recover a
         *  constructor argument from a roster position without typing an 8. */
        tileSize: mapDoc.tile_size,
        capability: AP_ITEM_CAPABILITY,
    };
}
