/**
 * seedlingDemo/apPlacementRewriter — **AP'S PLACEMENT, WRITTEN INTO THE ROOM**
 * (EDITOR INTEGRATION slice H7; plan §17.0.4 (c), §17.1.1, §17.1.4).
 *
 * ── ⛓⛓⛓ WHAT THIS IS, IN ONE PARAGRAPH ───────────────────────────────────
 *
 * Every randomized Seedling location becomes an **`apitem`** entity in the
 * level set the host delivers. The game builds it from its own OEL element
 * name the way it builds all 21 pickups (`Game.as:2211-2279`), and the host's
 * OEL emitter writes arbitrary entity types straight through
 * (`procgenLevelOel.recordToOel`), so the placement costs **zero
 * ActionScript**. The `apitem` grants nothing: the host owns every grant, and
 * the table this module builds is what answers *"found X for Player Y"* the
 * instant a check fires.
 *
 * ⛔ **THE `apitem` CLASS DOES NOT EXIST ON p4c.** `Game.as`'s XML loop
 * enumerates KNOWN element names, so an unknown `<apitem>` is ignored and a
 * rewritten room shows no pickup at all at an AP location. That is exactly the
 * discriminator `verify-seedling-ap-placement.mjs` measures, and the class
 * lands in M1's p4d build (plan §17.1.3).
 *
 * ── ⛓ THE ADDRESS: `(level, tag)`, AND WHY 11 OF 39 HAVE NO VANILLA TAG ───
 *
 * M1's check report is `Game.pendingCheck = "<seq>|<level>|<tag>"`, written
 * inside `Game.setPersistence` — so a location's address is its level plus its
 * persistence tag, which is the `@tag` attribute the OEL element carries.
 *
 * ⚠ MEASURED over the vanilla 116 and the 41-row goal ledger: **28 of the 39
 * rewritable rows carry a vanilla `@tag` and 11 do NOT.** `bosskey` is built
 * `new BossKey(o.@x, o.@y, o.@keyType)`, `totempart` is
 * `new BossTotemPart(o.@x, o.@y, o.@totempart)` and `seed` is
 * `new Seed(o.@x, o.@y, false, o.@text, cutscene[2])` — none of the three
 * takes a tag, and none of the 11 placements has one. (It is the same fact
 * §17.0.4 records from the other end: `BossKey.removed()` writes
 * `Player.hasKeySet` and never touches persistence.) ⇒ an `apitem` at one of
 * those tiles needs a tag **allocated**, and this module allocates it with
 * `procgenSeedling.placementTagId` — the repo's one writer of that rule, which
 * reads the used set through the engine's own `tagOf` and REFUSES rather than
 * overflow `Game.tagsPerLevel = 30` into the next level's row.
 *
 * ⛓ Level 40 needs THREE of them (`bosskey2` and two totem parts) and already
 * uses 23 distinct tags, so the allocations must compose: each is passed the
 * ones already handed out in that level as `reserved`.
 *
 * ── ⛓⛓ THE `look` VOCABULARY — ⚖ RULED, AND DERIVED FROM THREE TABLES ────
 *
 * ⚖ USER, 2026-08-28: the sprite is the Seedling object's own graphic when the
 * placed item is a Seedling item **for the current player's world**, else the
 * Archipelago logo. ⚖ ORCHESTRATOR, same day, on the tie-break: (1) if the
 * item's own graphic set contains the DESTINATION's vanilla graphic, use that;
 * (2) otherwise the first in `ITEM_FOR_TAG`'s own key order.
 *
 * ⛔ **`ITEM_FOR_TAG` IS NOT INJECTIVE, SO "THE INVERSE" IS NOT A FUNCTION** —
 * 14 tags carry 12 distinct item names: `Progressive Shield` is both `shield`
 * and `darkshield`, `Progressive Swim` is both `conch` and `feather`. That is
 * what the tie-break is for, and it is why nothing here hand-types an inverse
 * table: the book is BUILT from the ledger's own rows, so a 15th entry in
 * `ITEM_FOR_TAG` (or a 6th key, or a moved ledger row) is followed
 * automatically.
 *
 * ⛔ **A `look` MUST DETERMINE ONE SPRITE ON ITS OWN**, which is why the five
 * keys are `bosskey0`…`bosskey4` rather than a bare `bosskey`:
 * `BossKey` picks its graphic with `Game.bossKeys[_t]` and `BossTotemPart`
 * with `sprBossTotemPart.frame = _t`, so a bare type would leave M1's `APItem`
 * guessing which key it is. The index is `ITEM_FOR_KEY.indexOf(item)` —
 * derived, and CROSS-CHECKED against the vanilla element's own `@keyType`.
 * `Totem Shard` is one fungible AP item with five vanilla frames, so it has
 * one canonical look (`totempart`) and M1's class draws frame 0.
 *
 * ⚠ **`Fire` HAS NO LOOK, AND THAT IS THE HONEST ANSWER.** It is granted by a
 * BobBoss drop, an `encounter` row with no pickup entity, so no table in this
 * repository names a graphic for it — it renders as `ap`. Adding one would
 * mean editing `ITEM_FOR_TAG`, which moves the committed atlas.
 *
 * ── ⛔ WHAT IS **NOT** REWRITTEN ──────────────────────────────────────────
 *
 * The two `encounter` rows (`fire@L32`, `darksword@L12`). Their entities are a
 * `fallrocklarge` and a `witch` — not pickups, and not replaceable without
 * deleting the fight and the dialogue that grant them. ⚖ RULED: they are
 * REPORTED in the table's `encounters` list, by name, for M1's H6 to serve
 * through the existing property path. They are never silently dropped.
 */

import { placementTagId } from './procgenSeedling.js';
import {
    ITEM_FOR_KEY, ITEM_FOR_TAG, entityForLedgerRow, labelFor, levelName,
} from './seedlingAtlasDerivation.js';
import { stampLevelSetIdentity } from './levelSetValidator.js';

export class ApPlacementError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ApPlacementError';
    }
}

const fail = (message) => { throw new ApPlacementError(message); };

/** The OEL element name M1's `Pickups/APItem.as` is constructed from. */
export const AP_ITEM_TYPE = 'apitem';

/** The look that means "the Archipelago logo" — the placeholder for everything
 *  this world has no graphic for. */
export const AP_LOOK = 'ap';

/** The set id base a rewritten set carries. ⛔ NOT the vanilla base: a rewrite
 *  is a different document and `levelSetDisagreement` compares `set_id`, so
 *  sharing the base would make "the rewrite mounted" and "the vanilla mounted"
 *  distinguishable only by a hash suffix. */
export const AP_RECORD_SET_ID_BASE = 'seedling-ap-record';

/** The address M1's `pendingCheck` carries, and this table's key. */
export const placementKey = (level, tag) => `${level}|${tag}`;

/**
 * The full `look` vocabulary, DERIVED — 14 pickup graphics + 5 keys + the seed
 * + the placeholder. Exported because M1's `APItem.as` is written against it
 * and `apPlacementRewriter.test.js` asserts its cardinality rather than
 * spelling the members.
 */
export const LOOK_VOCABULARY = Object.freeze([
    ...Object.keys(ITEM_FOR_TAG),
    ...ITEM_FOR_KEY.map((_item, i) => `bosskey${i}`),
    'seed',
    AP_LOOK,
]);

/** Where a look sorts for the tie-break: `ITEM_FOR_TAG`'s own key order, and
 *  after everything it does not name. */
const TAG_ORDER = Object.keys(ITEM_FOR_TAG);
const tagRank = (look) => {
    const i = TAG_ORDER.indexOf(look);
    return i < 0 ? TAG_ORDER.length : i;
};

/**
 * One ledger row's own graphic name.
 *
 * ⛔ THE KEY ROW IS THE ONLY ONE THAT IS NOT THE ENTITY'S TYPE, and its index
 * is taken from `ITEM_FOR_KEY` rather than from the element, then CHECKED
 * against the element's `@keyType`. Reading the attribute alone would make the
 * look a fact about the level data; reading the item alone would make it a
 * fact about the item table. They agree in vanilla, and a disagreement is a
 * defect in whichever moved — so it refuses by name instead of picking one.
 */
function lookOfRow(row, entity, item) {
    if (row.kind !== 'key') return entity.type;
    const index = ITEM_FOR_KEY.indexOf(item);
    if (index < 0) {
        fail(`apPlacementRewriter: ledger row ${row.id} is a key granting ${JSON.stringify(item)}, `
            + `which is not one of ITEM_FOR_KEY's ${ITEM_FOR_KEY.length} names — the look index `
            + 'would have to be guessed');
    }
    const declared = Number(entity.attrs?.keyType);
    if (declared !== index) {
        fail(`apPlacementRewriter: ledger row ${row.id} grants ${JSON.stringify(item)} `
            + `(ITEM_FOR_KEY index ${index}) but its vanilla element carries @keyType=`
            + `${JSON.stringify(entity.attrs?.keyType)}. The item table and the level data `
            + 'disagree about which key this is, and the sprite would follow whichever one '
            + 'this function happened to read');
    }
    return `bosskey${index}`;
}

/**
 * `look` for one placement — ⚖ the ruled two-step, and the player check
 * ABOVE both of them.
 *
 * ⛔ THE PLAYER CHECK IS FIRST AND IS NOT AN OPTIMISATION. A foreign world may
 * hold an item whose NAME collides with a Seedling one; deciding the sprite
 * from the name alone would show the Seedling graphic for another player's
 * item, which is precisely the thing the placeholder ruling exists to prevent.
 */
function lookFor({ name: item, player }, destLook, lookBook, selfPlayer) {
    if (player !== selfPlayer) return AP_LOOK;
    const sources = lookBook.get(item);
    if (!sources || sources.length === 0) return AP_LOOK;
    // (1) the destination's OWN vanilla graphic, when the item wears it too.
    if (sources.includes(destLook)) return destLook;
    // (2) the canonical representative: `ITEM_FOR_TAG` key order, then ledger order.
    return [...sources].sort((a, b) => tagRank(a) - tagRank(b))[0];
}

/** Index the rooms by their level, refusing an ambiguous corpus. */
function recordsByLevel(rooms) {
    const byLevel = new Map();
    (rooms ?? []).forEach((record, i) => {
        const level = record?.level;
        if (!Number.isInteger(level)) {
            fail(`apPlacementRewriter: rooms[${i}] has no integer \`level\` `
                + `(got ${JSON.stringify(level)}); the ledger addresses rooms by level and `
                + 'an array position would silently address the neighbour');
        }
        if (byLevel.has(level)) {
            fail(`apPlacementRewriter: rooms[${i}] and rooms[${byLevel.get(level).i}] both `
                + `claim level ${level}; the ledger's address would be ambiguous`);
        }
        byLevel.set(level, { record, i });
    });
    return byLevel;
}

/**
 * AP's placement, resolved to level-set addresses.
 *
 * @param {object} deps
 * @param {(locationName: string) => ({name: string, player: number}|null)}
 *   deps.locationItemOf  ⛔ **INJECTED, NEVER IMPORTED** — it is
 *   `stateManager.getLocationItem` (`stateManager.js:346-361`), and
 *   `seedlingDemo/` does not import the host's state manager. The panel passes
 *   it in; a test passes a Map's `get`.
 * @param {Array<object>} deps.ledger    the goal ledger (`R7_GOAL_LEDGER`, 41 rows)
 * @param {Array<object>} deps.rooms     level RECORDS (`{level, entities, …}`)
 * @param {number} deps.selfPlayer       the slot this panel plays
 * @returns {{table: Map<string, object>, entries: object[], encounters: object[],
 *            lookBook: Map<string, string[]>}}
 */
export function buildPlacementTable({ locationItemOf, ledger, rooms, selfPlayer } = {}) {
    if (typeof locationItemOf !== 'function') {
        fail('apPlacementRewriter: buildPlacementTable needs `locationItemOf` — the AP placement '
            + 'is the host\'s and this module is inside the seedlingDemo fence, so it is passed '
            + 'in rather than imported');
    }
    if (!Number.isInteger(selfPlayer)) {
        fail(`apPlacementRewriter: buildPlacementTable needs an integer \`selfPlayer\` (got ${
            JSON.stringify(selfPlayer)}) — every look decision is relative to it, and a missing `
            + 'slot would make every item read as foreign');
    }
    const byLevel = recordsByLevel(rooms);
    const rows = Array.isArray(ledger) ? ledger : [];
    if (rows.length === 0) fail('apPlacementRewriter: buildPlacementTable needs a non-empty ledger');

    // --- pass 1: resolve every row's entity, and build the look book ---------
    const resolved = [];
    const encounters = [];
    const lookBook = new Map();
    for (const row of rows) {
        const found = byLevel.get(row.level);
        if (!found) {
            fail(`apPlacementRewriter: ledger row ${row.id} names level ${row.level}, which is `
                + `not among the ${byLevel.size} rooms handed in`);
        }
        const { entity, item } = entityForLedgerRow(found.record, row);
        // ⛔ REFUSED BY NAME, never skipped. A location whose entity moved is a
        // location AP will hand an item to and the player can never find; a
        // silent skip would ship that as a completable seed.
        if (!entity) {
            fail(`apPlacementRewriter: ledger row ${row.id} (kind ${row.kind}) has NO entity in `
                + `level ${row.level} — the room's ${found.record.entities?.length ?? 0} entities `
                + 'do not contain the one the ledger addresses, so this location cannot be '
                + 'rewritten and AP would place an item nobody can reach');
        }
        if (!item) fail(`apPlacementRewriter: ledger row ${row.id} names no vanilla AP item`);
        const location = `${levelName(row.level)} - ${labelFor(row)}`;
        if (row.kind === 'encounter') {
            // ⚖ NOT REWRITTEN, and REPORTED. Its entity is the thing that
            // grants the item (a falling rock, a witch), not a pickup.
            encounters.push({ ledgerId: row.id, level: row.level, location,
                entityType: entity.type, vanillaItem: item });
            continue;
        }
        const look = lookOfRow(row, entity, item);
        if (!lookBook.has(item)) lookBook.set(item, []);
        if (!lookBook.get(item).includes(look)) lookBook.get(item).push(look);
        resolved.push({ row, record: found.record, entity, vanillaItem: item, location, look });
    }

    // --- pass 2: the placement, the look and the address ---------------------
    const table = new Map();
    const entries = [];
    const allocated = new Map();  // level -> tags handed out in it
    for (const r of resolved) {
        const placed = locationItemOf(r.location);
        if (!placed || typeof placed.name !== 'string' || !Number.isInteger(placed.player)) {
            fail(`apPlacementRewriter: no AP placement for location ${JSON.stringify(r.location)} `
                + `(ledger row ${r.row.id}) — got ${JSON.stringify(placed)}. Every randomized `
                + 'location must have one; rewriting the room without it would put a placeholder '
                + 'on a tile whose contents nobody decided');
        }
        const vanillaTag = r.entity.attrs?.tag;
        let tag;
        let tagSource;
        if (vanillaTag === undefined) {
            const reserved = allocated.get(r.record.level) ?? [];
            tag = placementTagId(r.record, reserved);
            allocated.set(r.record.level, [...reserved, tag]);
            tagSource = 'allocated';
        } else {
            tag = Number(vanillaTag);
            if (!Number.isInteger(tag) || tag < 0) {
                fail(`apPlacementRewriter: ledger row ${r.row.id}'s entity carries @tag=`
                    + `${JSON.stringify(vanillaTag)}, which is not a persistence slot — the check `
                    + 'report addresses a location by (level, tag) and a negative one is the '
                    + '"no persistence" sentinel');
            }
            tagSource = 'vanilla';
        }
        const key = placementKey(r.record.level, tag);
        if (table.has(key)) {
            fail(`apPlacementRewriter: two locations resolve to the same address ${key} — `
                + `${table.get(key).ledgerId} and ${r.row.id}. The check report cannot tell them `
                + 'apart, so one of their checks would be credited to the other');
        }
        const entry = {
            ledgerId: r.row.id,
            kind: r.row.kind,
            level: r.record.level,
            tag,
            tagSource,
            location: r.location,
            vanillaItem: r.vanillaItem,
            vanillaLook: r.look,
            item: placed.name,
            player: placed.player,
            look: lookFor(placed, r.look, lookBook, selfPlayer),
            entity: { type: r.entity.type, x: r.entity.x, y: r.entity.y },
        };
        table.set(key, entry);
        entries.push(entry);
    }
    return { table, entries, encounters, lookBook };
}

/**
 * ⛓ A KEY-ORDER-PRESERVING DEEP CLONE. `recordToOel` emits an entity's
 * attributes in `Object.entries` order, so key order IS content here (trap
 * 951) and a clone that reordered would move every room's bytes while every
 * structural comparison stayed green. `JSON` preserves string-key insertion
 * order, which is exactly the property wanted.
 *
 * ⛔ AND IT IS A FULL CLONE RATHER THAN STRUCTURAL SHARING. The caller stamps
 * identity, and `stampLevelSetIdentity` writes IN PLACE — a shared room or a
 * shared manifest would let the rewrite reach back into the vanilla set the
 * next caller reads (trap 950's family).
 */
const cloneKeepingKeyOrder = (value) => JSON.parse(JSON.stringify(value));

/**
 * The rewritten set: EXACTLY the table's entities replaced, every other byte
 * of every room identical.
 *
 * ── ⛔ THE JOIN IS THE ROOM'S `id`, AND THAT IS NOT A SHORTCUT ────────────
 *
 * MEASURED: `buildLevelSet` writes a room from a CLOSED set of record fields
 * and the record that survives into a set is `{width, height, layers,
 * entities}` — **`level` is not in it.** A set's rooms are addressed by `id`,
 * which is the array position, and `Main.level` is the index into exactly that
 * mounted table. ⇒ the room id IS the level the ledger and M1's check report
 * mean, and joining on it is joining on the game's own address rather than on
 * a coincidence.
 *
 * ⛔ WHAT MAKES THAT SAFE IS THE ENTITY CHECK BELOW: the table carries each
 * location's exact `{type, x, y}`, so a set whose numbering is NOT vanilla's
 * refuses by name at the first substitution instead of silently rewriting the
 * neighbour's room.
 *
 * @param {object} vanillaSet  a `record`-sourced set (`levelSetExporter.vanillaRecordSet`)
 * @param {Map<string, object>} table  `buildPlacementTable`'s
 * @returns {{set: object, replaced: number, byLevel: Map<number, object[]>}}
 */
export function rewriteRecordSet(vanillaSet, table) {
    if (!Array.isArray(vanillaSet?.rooms)) {
        fail('apPlacementRewriter: rewriteRecordSet needs a level set with `rooms`');
    }
    if (!(table instanceof Map) || table.size === 0) {
        fail('apPlacementRewriter: rewriteRecordSet needs a non-empty placement table');
    }
    const wanted = new Map();  // level -> entries
    for (const entry of table.values()) {
        if (!wanted.has(entry.level)) wanted.set(entry.level, []);
        wanted.get(entry.level).push(entry);
    }

    const set = cloneKeepingKeyOrder(vanillaSet);
    let replaced = 0;
    const seen = new Set();
    for (const room of set.rooms) {
        const record = room?.source?.record;
        if (!record) continue;
        const level = room.id;
        const entries = wanted.get(level);
        if (!entries) continue;
        if (seen.has(level)) {
            fail(`apPlacementRewriter: two rooms of the set carry id ${level}; the `
                + 'placement table addresses one of them and there is no rule for which');
        }
        seen.add(level);
        for (const entry of entries) {
            const at = (record.entities ?? []).findIndex((e) => e.type === entry.entity.type
                && e.x === entry.entity.x && e.y === entry.entity.y);
            if (at < 0) {
                fail(`apPlacementRewriter: ${entry.ledgerId}'s entity `
                    + `${entry.entity.type}@(${entry.entity.x},${entry.entity.y}) is not in room `
                    + `${level} of the set being rewritten. The table was built against a `
                    + 'different corpus, and substituting the nearest entity would move the '
                    + 'location to a tile nobody chose');
            }
            const old = record.entities[at];
            if (Array.isArray(old.nodes) && old.nodes.length > 0) {
                fail(`apPlacementRewriter: ${entry.ledgerId}'s entity carries ${old.nodes.length} `
                    + 'node(s), which an `apitem` has no way to express — refusing rather than '
                    + 'dropping geometry the room depends on');
            }
            // ⛔ THE ATTRIBUTE ORDER IS PINNED: `tag` then `look`, because the
            // emitted OEL text is what crosses and its bytes are compared.
            record.entities[at] = {
                type: AP_ITEM_TYPE,
                x: old.x,
                y: old.y,
                attrs: { tag: String(entry.tag), look: entry.look },
            };
            replaced += 1;
        }
    }
    if (replaced !== table.size) {
        fail(`apPlacementRewriter: the table names ${table.size} placements but only ${replaced} `
            + 'were substituted — a level the table addresses is missing from the set');
    }
    /**
     * ⛓ THE PROVENANCE SAYS WHAT THIS DOCUMENT IS, and `derived_from` names the
     * vanilla it rewrote. ⛔ `stampLevelSetIdentity` LAST: `set_id` is the
     * content hash of everything else, so a field written after the stamp
     * would ship a document whose id does not describe it.
     */
    set.provenance = {
        ...(set.provenance ?? {}),
        generator: 'seedlingDemo/apPlacementRewriter.rewriteRecordSet',
        derived_from: {
            set_id: vanillaSet.set_id ?? null,
            content_hash: vanillaSet.provenance?.content_hash ?? null,
        },
        ap_placement: { locations: replaced },
    };
    stampLevelSetIdentity(set, AP_RECORD_SET_ID_BASE);
    return { set, replaced, byLevel: wanted };
}

/**
 * ⛓⛓ **WHAT A REWRITE DOES TO THE 24 VANILLA AP REFERENCES**
 * (`levelSetExporter.VANILLA_AP_REFERENCES`, plan §6.1) — MEASURED, and the
 * answer is not "none".
 *
 * A rewrite substitutes ENTITIES. It adds no room, removes none and reorders
 * none, and it touches no tile layer — so every level id and every coordinate
 * in all 24 references still resolves to the same room at the same tile.
 * ⇒ **`moved` is EMPTY.**
 *
 * ⛔ **BUT 11 OF THE 24 ARE FALSIFIED, AND THAT IS THE POINT OF ASKING.**
 * `games/seedling.json`'s `location_coords` is an item jump-list: each of its
 * 11 entries says *"the Sword is at level 10, (48, 64)"*. After a rewrite that
 * tile holds an `apitem` and the Sword is wherever AP put it. The coordinate
 * did not move; the SENTENCE became false. ⇒ H8 still ships
 * `apMappingInvalidation`'s companion — it is honoured by CARRYING it, and
 * this function is what lets a row assert `moved` is empty rather than assume
 * it.
 *
 * @returns {{moved: string[], falsified: object[], checked: number}}
 */
export function referenceImpactOf(table, { regionCoords = {}, locationCoords = {} } = {}) {
    const tiles = new Set();
    for (const entry of table.values()) {
        tiles.add(`${entry.level}|${entry.entity.x}|${entry.entity.y}`);
    }
    const falsified = [];
    for (const [name, ref] of Object.entries(locationCoords)) {
        // ⚠ `location_coords` is the item entity's own position with y offset by
        // ONE TILE (+16 for ten of the eleven, -16 for Conch alone) —
        // `VANILLA_AP_REFERENCES`' own derivation note. So both offsets are
        // asked, and the reference is falsified if either lands on a rewritten
        // entity.
        const hit = [16, -16].some((dy) => tiles.has(`${ref.level}|${ref.x}|${ref.y + dy}`));
        if (hit) falsified.push({ table: 'location_coords', name, ...ref });
    }
    return {
        moved: [],
        falsified,
        checked: Object.keys(regionCoords).length + Object.keys(locationCoords).length,
    };
}
