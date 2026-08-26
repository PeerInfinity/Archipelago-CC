/**
 * seedlingDemo/seedlingSetOverlay — **THE AUTHORED HALF OF A SET, AS DATA, AND
 * THE BRIDGE FROM DATA TO THE DERIVATION'S CLOSURES** (EDITOR v3 slice D1;
 * plan §16.3, §19.10, ⚖ RULED by the user 2026-08-25).
 *
 * ── ⛓⛓⛓ WHY THIS IS ITS OWN FILE ─────────────────────────────────────────
 *
 * `deriveAtlas(rooms, overlay, deps)` takes an overlay whose `locationGuard` is
 * a **CLOSURE** (`(ledgerId) => rule|null`) — which is right for the vanilla
 * build, where the guards are hand rulings written in JS beside their citations.
 * It is exactly wrong for an EDITOR: a session's identity is `base + ops`, the
 * ops are JSON, and a function cannot be an op's payload, cannot be compared by
 * `canonicalJson`, cannot be undone and cannot be downloaded.
 *
 * ⇒ the set session's overlay is **JSON-SERIALISABLE DATA**, and this module is
 * the one place it is turned into the shape `deriveAtlas` wants. The closure is
 * BUILT here, on every derivation, from the rows; it is never STORED. A mutant
 * that stores it goes red on the `equal` row, because two records that differ
 * only in which closure instance they hold are the SAME set and
 * `canonicalJson` of a function is `undefined`.
 *
 * ── ⛓ THE KEY THAT NAMES A RULE TARGET, AND WHY IT IS PREFIXED ────────────
 *
 * `rooms[i].rules` is keyed by a target inside THAT ROOM's derived region. Two
 * namespaces meet there and neither owns the other:
 *
 *   ·  an EXIT, by the derivation's own id — `out_<type>_<x>_<y>`,
 *      `in_L<from>_<x>_<y>`, `out_pit_<ax>_<ay>`, `in_pit_L<from>_<ax>_<ay>`
 *      (`seedlingAtlasDerivation.outExitId`/`inExitId` and the two pit spellings);
 *   ·  a LOCATION, by its AUTHORED name — the `name` a `mark-location` op gave
 *      it, NOT the AP name (`Level 003 - Chest`), because the AP name is
 *      derived from the level id and a `reorder` moves it.
 *
 * ⛔ Both halves are FREE-FORM STRINGS, so a bare key could collide: nothing
 * stops a person naming a location `out_teleporter_32_48`. The key is therefore
 * `exit:<exit_id>` or `loc:<name>` — self-describing, collision-free by
 * construction, and a key with neither prefix is REFUSED BY NAME rather than
 * guessed at ([[feedback_fallback_reinstates_the_defect]]).
 *
 * ── ⛓ WHY `regions` LIVES HERE AND NOT IN THE MANIFEST ────────────────────
 *
 * `signForTransition(fromRegion, toRegion)` needs a room → region map, and
 * `levelSetExits.js`'s header proves it must be an INPUT (vanilla names the
 * region of 7 of its 116 rooms and says nothing about the other 109, so there
 * is no honest derivation). The brief called it "the manifest's regions" — but
 * `seedling-level-set.schema.json` is `additionalProperties: false` at the top
 * level and declares no such field, so a set that carried one would be REFUSED
 * by its own schema. MEASURED, and the overlay is where it goes: the overlay is
 * this editor's document and the set is the game's.
 */

import { SIGN_NONE, SIGN_TABLE_SIZE } from './levelSetValidator.js';
import {
    BASE_LOCATION_FIELDS, OVERLAY_SCHEMA_VERSION, ROOM_OVERLAY_FIELDS, RULE_TARGET_PREFIXES,
    createSetOverlay, exitRuleKey, locationRuleKey,
} from '../procgenCore/setOverlay.js';

export class SeedlingSetOverlayError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SeedlingSetOverlayError';
    }
}

/** ⛓ RE-EXPORTED so every caller reads the overlay vocabulary off THIS module —
 *  the same frozen values and the same functions, never a second spelling. */
export {
    BASE_LOCATION_FIELDS, OVERLAY_SCHEMA_VERSION, ROOM_OVERLAY_FIELDS, RULE_TARGET_PREFIXES,
    exitRuleKey, locationRuleKey,
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

/**
 * ⛓⛓⛓ **EDITOR v3 E2a — THE SHAPE IS THE TOOLKIT'S; THE ADDRESS AND THE TWO
 * EXTRA FIELDS ARE SEEDLING'S.**
 *
 * §22.3 measured this module by exported function: 8 of its 11 were already
 * substrate-free and 2 more became so once parameterised, so 10/11 = 90.9%
 * moved to `procgenCore/setOverlay.js` and this file BINDS them. Every sentence
 * below is the one that was here before — the lift is byte-inert on behaviour,
 * which `seedlingSetOverlay.test.js` pins by snapshotting the messages over its
 * existing fixtures.
 *
 * ⛔ What did NOT move, and why each is genuinely Seedling's:
 *
 *  ·  **`overlayToDeriveInput`** — it speaks the vanilla ledger's vocabulary
 *     (`{id, kind, tag, level}`) and BUILDS `deriveAtlas`'s `locationGuard`
 *     closure. It is the one export that is about Seedling's derivation rather
 *     than about the overlay's shape.
 *  ·  **the location row's ADDRESS** — `entity: {type, x, y}` in PIXELS, the
 *     room's own OEL element. The maze addresses a payload item by INDEX;
 *     neither address generalises the other.
 *  ·  **`neverEnter` and `regions`** — the trap-room ruling and the seven
 *     `Message.as` region titles. Both are facts about `Game.as` call sites.
 */

const SEEDLING_OVERLAY = createSetOverlay({
    moduleName: 'seedlingSetOverlay',
    ErrorClass: SeedlingSetOverlayError,
    schemaVersion: OVERLAY_SCHEMA_VERSION,

    /** ⛓ `entity` FIRST, because that is the field that makes the row an address. */
    locationFields: ['entity', ...BASE_LOCATION_FIELDS],

    /**
     * ⛓⛓ **EDITOR v3 E6a — PER ROOM, BECAUSE THIS DERIVATION PREFIXES.**
     * `seedlingAtlasDerivation` emits `Level NNN - <authored>` and `NNN` is the
     * room's level, which `seedlingSetAdapter.roomsOfSet` sets to the room's
     * ARRAY POSITION — unique per set by construction. Two rooms marking
     * `Chest` therefore derive two different AP names and the compiler
     * allocates two ids; only a room colliding with ITSELF collapses to one.
     * ⛔ The default is `'set'` and the maze keeps it, because
     * `mazeAtlasDerivation` emits the authored name verbatim.
     */
    locationNameScope: 'room',

    locationRowErrors: (row, rlabel) => (
        isPlainObject(row.entity) && isNonEmptyString(row.entity.type)
            && Number.isInteger(row.entity.x) && Number.isInteger(row.entity.y)
            ? []
            : [`${rlabel}.entity must be {type, x, y} with integer PIXEL coordinates `
                + '— the same (x, y) the room\'s OEL element carries, so the row '
                + 'addresses one entity and not a class of them']
    ),

    exitIdHint: 'The exit ids are the derivation\'s own (`out_<type>_<x>_<y>`, '
        + '`in_L<from>_<x>_<y>`, `out_pit_<x>_<y>`, `in_pit_L<from>_<x>_<y>`); a location is '
        + 'named by the `mark-location` op\'s `name`, not by its AP name.',

    extraFields: {
        /**
         * ⛔ THE TRAP ROOMS. A level the derivation must wire NO link into,
         * because its exit teleporter is created on death.
         */
        neverEnter: {
            errors: (value, { roomCount }) => {
                if (!Array.isArray(value) || !value.every(Number.isInteger)) {
                    return ['overlay.neverEnter must be an array of integer room indices'];
                }
                if (roomCount === null) return [];
                return value
                    .filter((i) => i < 0 || i >= roomCount)
                    .map((i) => `overlay.neverEnter names room ${i}, which does not exist`);
            },
            renumber: (value, mapping) => value
                .map((i) => mapping.get(i))
                .filter((i) => i !== null && i !== undefined)
                .sort((a, b) => a - b),
        },

        /**
         * ⛔⛔ `regions` LIVES IN THE OVERLAY AND NOT IN THE MANIFEST.
         * `signForTransition(fromRegion, toRegion)` needs a room → region map,
         * and `levelSetExits.js`'s header proves it must be an INPUT (vanilla
         * names the region of 7 of its 116 rooms and says nothing about the
         * other 109, so there is no honest derivation). But
         * `seedling-level-set.schema.json` is `additionalProperties: false` at
         * the top level and declares no such field, so a SET carrying one would
         * be REFUSED by its own schema. MEASURED — the overlay is this editor's
         * document and the set is the game's.
         */
        regions: {
            errors: (value) => {
                if (!Array.isArray(value) || !value.every(Number.isInteger)) {
                    return ['overlay.regions must be an array of integers, room index -> region'];
                }
                const errors = [];
                value.forEach((r, i) => {
                    if (r < SIGN_NONE || r > SIGN_TABLE_SIZE) {
                        errors.push(`overlay.regions[${i}] is ${r}, outside ${SIGN_NONE}..${SIGN_TABLE_SIZE} — `
                            + 'Message.as holds exactly seven titles and the table is CLOSED');
                    }
                });
                return errors;
            },
            renumber: (value, mapping) => {
                const regions = [];
                value.forEach((r, i) => {
                    const to = mapping.get(i);
                    if (to !== null && to !== undefined) regions[to] = r;
                });
                // ⛔ HOLES FILLED WITH `SIGN_NONE`, not left sparse. A sparse array
                // round-trips through JSON as `null`s, and `signForTransition` reads a
                // non-integer as "no region" anyway — writing it out means the document
                // says what it means instead of relying on a reader's coercion.
                return Array.from({ length: regions.length }, (_, i) => regions[i] ?? SIGN_NONE);
            },
        },
    },
});

/** ⛓ The fields a location row may carry — `entity` is what makes it an address. */
export const LOCATION_FIELDS = SEEDLING_OVERLAY.LOCATION_FIELDS;

export const {
    assertOverlay, emptyOverlay, exitRulesByRoom, overlayErrors, overlayLocationNames,
    overlayRoomIndices, parseRuleTarget, renumberOverlay,
} = SEEDLING_OVERLAY;

/**
 * ⛓⛓⛓ **THE BRIDGE: DATA → the three things `deriveAtlas` reads.**
 *
 * `deriveAtlas`'s overlay is `{locations, locationGuard, neverEnter}` where
 * `locationGuard` is a closure and the rows carry the vanilla ledger's own
 * vocabulary (`{id, kind, tag, level}`). This builds all three from the data,
 * every time, and STORES NONE OF THEM.
 *
 * ⛓ The rows come out as `kind: 'entity'` — the arm
 * `seedlingAtlasDerivation.locationsFor` grew for exactly this caller: an
 * ENTITY-ADDRESSED row, because an edited set has no ledger to name rows out of
 * and `{type, x, y}` is the one address a person clicking a room can produce.
 *
 * ⚠ `locationGuard` here answers only for rows that carry a `loc:` rule, and it
 * answers `{condition: <the rule tree itself>}` — so the paired
 * `resolveCondition` is the IDENTITY. That is not a shortcut: for the vanilla
 * build a guard names a CONDITION the script resolves against its own rule
 * vocabulary; for an editor the author has already typed the tree, and a second
 * indirection would be a name for a thing that is already in hand.
 */
export function overlayToDeriveInput(overlay) {
    const rooms = overlay?.rooms ?? {};
    const locations = [];
    const guards = new Map();
    for (const [rawIndex, entry] of Object.entries(rooms)) {
        const level = Number(rawIndex);
        for (const row of entry?.locations ?? []) {
            const id = `${level}:${row.name}`;
            locations.push({
                id,
                kind: 'entity',
                level,
                entity: row.entity,
                label: row.name,
                vanilla_item: row.vanilla_item,
            });
            const rule = entry?.rules?.[locationRuleKey(row.name)];
            if (rule !== undefined) {
                guards.set(id, { condition: rule, why: 'authored in the set overlay', cite: 'overlay' });
            }
        }
    }
    const out = { locations };
    // ⛔ THE CLOSURE IS BUILT, NEVER STORED — the file docblock's whole point.
    out.locationGuard = (id) => guards.get(id) ?? null;
    if (Array.isArray(overlay?.neverEnter) && overlay.neverEnter.length > 0) {
        out.neverEnter = {
            levels: [...overlay.neverEnter],
            cite: Object.fromEntries(overlay.neverEnter.map((i) => [i, 'authored in the set overlay'])),
        };
    }
    return out;
}
