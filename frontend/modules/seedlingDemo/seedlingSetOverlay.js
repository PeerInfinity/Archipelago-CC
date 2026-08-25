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

export class SeedlingSetOverlayError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SeedlingSetOverlayError';
    }
}

const fail = (message) => { throw new SeedlingSetOverlayError(message); };

/** The overlay format's own version. Bumped when a key's meaning changes. */
export const OVERLAY_SCHEMA_VERSION = 1;

/** The two prefixes a `rules` key may carry. The refusals read this. */
export const RULE_TARGET_PREFIXES = Object.freeze(['exit:', 'loc:']);

/** The fields a per-room overlay entry may carry. A seventh cannot arrive silently. */
export const ROOM_OVERLAY_FIELDS = Object.freeze(['name', 'locations', 'rules']);

/** The fields a location row may carry. */
export const LOCATION_FIELDS = Object.freeze(['entity', 'name', 'vanilla_item']);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

/** An EMPTY overlay — what `bases.set` resolves when no `overlay_id` is named. */
export const emptyOverlay = () => ({ schema_version: OVERLAY_SCHEMA_VERSION, rooms: {} });

/**
 * ⛓ **PARSE A RULE-TARGET KEY.** Returns `{kind: 'exit'|'loc', id}`, or refuses.
 *
 * ⛔ The refusal names BOTH prefixes and the key it got, because the mistake
 * this catches is a person writing the exit id bare — which would have silently
 * become a location named `out_teleporter_32_48` under a looser reader.
 */
export function parseRuleTarget(key) {
    if (!isNonEmptyString(key)) {
        fail(`seedlingSetOverlay: a rule target is a non-empty string, got ${JSON.stringify(key)}`);
    }
    for (const prefix of RULE_TARGET_PREFIXES) {
        if (key.startsWith(prefix)) {
            const id = key.slice(prefix.length);
            if (id === '') {
                fail(`seedlingSetOverlay: rule target ${JSON.stringify(key)} carries the `
                    + `"${prefix}" prefix and nothing after it`);
            }
            return { kind: prefix === 'exit:' ? 'exit' : 'loc', id };
        }
    }
    fail(`seedlingSetOverlay: rule target ${JSON.stringify(key)} carries neither `
        + `"exit:" nor "loc:". ⛔ REFUSED rather than guessed: an exit id and a location `
        + 'name are both free-form strings, so a bare key that happened to look like an '
        + 'exit id would silently author a rule on the wrong thing. The exit ids are the '
        + 'derivation\'s own (`out_<type>_<x>_<y>`, `in_L<from>_<x>_<y>`, `out_pit_<x>_<y>`, '
        + '`in_pit_L<from>_<x>_<y>`); a location is named by the `mark-location` op\'s '
        + '`name`, not by its AP name.');
}

/** Build a rule-target key. The ONE spelling, so a caller never types the prefix. */
export const exitRuleKey = (exitId) => `exit:${exitId}`;
export const locationRuleKey = (name) => `loc:${name}`;

/**
 * ⛓⛓ **THE OVERLAY'S SHAPE CHECK — small, and every refusal names the path.**
 *
 * ⛔ Not a JSON Schema. `procgenCore/jsonSchemaCheck.js` exists and is good, but
 * it takes an INJECTED schema document, and the overlay's schema would then be a
 * fourth file on disk for a shape with five keys. What matters is that the
 * refusal is BY NAME and that an unknown key is refused rather than carried:
 * an overlay that quietly held a typo'd field would derive an atlas missing the
 * thing the author thought they had authored.
 *
 * @returns {string[]} errors; empty means the shape is good
 */
export function overlayErrors(overlay, { roomCount = null } = {}) {
    const errors = [];
    const err = (m) => errors.push(m);
    if (!isPlainObject(overlay)) return [`overlay must be an object, got ${JSON.stringify(overlay)}`];
    if (overlay.schema_version !== OVERLAY_SCHEMA_VERSION) {
        err(`overlay.schema_version must be ${OVERLAY_SCHEMA_VERSION}, got ${JSON.stringify(overlay.schema_version)}`);
    }
    if (overlay.overlay_id !== undefined && !isNonEmptyString(overlay.overlay_id)) {
        err('overlay.overlay_id must be a non-empty string when present');
    }
    for (const key of Object.keys(overlay)) {
        if (!['schema_version', 'overlay_id', 'rooms', 'neverEnter', 'regions', 'provenance'].includes(key)) {
            err(`overlay.${key} is not a declared field — the overlay carries schema_version, `
                + 'overlay_id, rooms, neverEnter, regions and provenance');
        }
    }
    if (!isPlainObject(overlay.rooms)) {
        err('overlay.rooms must be an object keyed by ROOM INDEX');
        return errors;
    }
    const seenNames = new Map();
    for (const [rawIndex, entry] of Object.entries(overlay.rooms)) {
        const label = `overlay.rooms[${rawIndex}]`;
        // ⛔ THE KEY IS A ROOM INDEX AND JSON MAKES IT A STRING. `"3"` is room 3;
        // `"03"`, `"3.0"` and `"three"` are not, and a reader that coerced them
        // would key an overlay onto a room the author never named.
        if (!/^(0|[1-9][0-9]*)$/.test(rawIndex)) {
            err(`${label}: the key must be a decimal room index with no leading zeros`);
            continue;
        }
        const index = Number(rawIndex);
        if (roomCount !== null && index >= roomCount) {
            err(`${label}: room ${index} does not exist (the set has ${roomCount})`);
        }
        if (!isPlainObject(entry)) {
            err(`${label} must be an object`);
            continue;
        }
        for (const field of Object.keys(entry)) {
            if (!ROOM_OVERLAY_FIELDS.includes(field)) {
                err(`${label}.${field} is not a declared field — a room overlay carries `
                    + `${ROOM_OVERLAY_FIELDS.join(', ')}`);
            }
        }
        if (entry.name !== undefined && !isNonEmptyString(entry.name)) {
            err(`${label}.name must be a non-empty string when present`);
        }
        if (entry.locations !== undefined) {
            if (!Array.isArray(entry.locations)) {
                err(`${label}.locations must be an array`);
            } else {
                entry.locations.forEach((row, i) => {
                    const rlabel = `${label}.locations[${i}]`;
                    if (!isPlainObject(row)) { err(`${rlabel} must be an object`); return; }
                    for (const field of Object.keys(row)) {
                        if (!LOCATION_FIELDS.includes(field)) {
                            err(`${rlabel}.${field} is not a declared field — a location row carries `
                                + `${LOCATION_FIELDS.join(', ')}`);
                        }
                    }
                    if (!isNonEmptyString(row.name)) err(`${rlabel}.name must be a non-empty string`);
                    if (!isNonEmptyString(row.vanilla_item)) {
                        err(`${rlabel}.vanilla_item must be a non-empty string — an AP location `
                            + 'with no item behind it is a location the fill cannot use');
                    }
                    if (!isPlainObject(row.entity) || !isNonEmptyString(row.entity.type)
                        || !Number.isInteger(row.entity.x) || !Number.isInteger(row.entity.y)) {
                        err(`${rlabel}.entity must be {type, x, y} with integer PIXEL coordinates `
                            + '— the same (x, y) the room\'s OEL element carries, so the row '
                            + 'addresses one entity and not a class of them');
                    }
                    if (isNonEmptyString(row.name)) {
                        // ⛔ GLOBAL, not per room. The compiler allocates AP location ids
                        // from `loc.name` ALONE (regionAtlasCompiler.js:376), and the
                        // derivation prefixes the level — but two rooms that swap places
                        // under a `reorder` would then swap AP names, so uniqueness is
                        // asked of the AUTHORED name, which a reorder never touches.
                        if (seenNames.has(row.name)) {
                            err(`${rlabel}.name "${row.name}" duplicates `
                                + `overlay.rooms[${seenNames.get(row.name)}] — location names `
                                + 'are unique across the SET');
                        } else {
                            seenNames.set(row.name, index);
                        }
                    }
                });
            }
        }
        if (entry.rules !== undefined) {
            if (!isPlainObject(entry.rules)) {
                err(`${label}.rules must be an object keyed by "exit:<id>" or "loc:<name>"`);
            } else {
                for (const [key, rule] of Object.entries(entry.rules)) {
                    try {
                        parseRuleTarget(key);
                    } catch (e) {
                        err(`${label}.rules: ${e.message}`);
                        continue;
                    }
                    if (!isPlainObject(rule) || !isNonEmptyString(rule.rule)) {
                        err(`${label}.rules[${JSON.stringify(key)}] must be a Rule Builder node `
                            + '({rule: "<Kind>", …})');
                    }
                }
            }
        }
    }
    if (overlay.neverEnter !== undefined) {
        if (!Array.isArray(overlay.neverEnter) || !overlay.neverEnter.every(Number.isInteger)) {
            err('overlay.neverEnter must be an array of integer room indices');
        } else if (roomCount !== null) {
            for (const i of overlay.neverEnter) {
                if (i < 0 || i >= roomCount) err(`overlay.neverEnter names room ${i}, which does not exist`);
            }
        }
    }
    if (overlay.regions !== undefined) {
        if (!Array.isArray(overlay.regions) || !overlay.regions.every(Number.isInteger)) {
            err('overlay.regions must be an array of integers, room index -> region');
        } else {
            overlay.regions.forEach((r, i) => {
                if (r < SIGN_NONE || r > SIGN_TABLE_SIZE) {
                    err(`overlay.regions[${i}] is ${r}, outside ${SIGN_NONE}..${SIGN_TABLE_SIZE} — `
                        + 'Message.as holds exactly seven titles and the table is CLOSED');
                }
            });
        }
    }
    return errors;
}

/** Refuse a bad overlay BY NAME, quoting every error. */
export function assertOverlay(overlay, options = {}) {
    const errors = overlayErrors(overlay, options);
    if (errors.length > 0) {
        fail(`seedlingSetOverlay: this overlay is not well formed — ${errors.join(' · ')}`);
    }
    return overlay;
}

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

/**
 * The EXIT rules of an overlay, grouped by room index. Locations are NOT here —
 * they ride the derivation's own `locationGuard` path (above), because a
 * location's rule has to be attached while the location is being built.
 *
 * @returns {Map<number, Map<string, object>>} room index -> exit_id -> rule
 */
export function exitRulesByRoom(overlay) {
    const out = new Map();
    for (const [rawIndex, entry] of Object.entries(overlay?.rooms ?? {})) {
        const index = Number(rawIndex);
        for (const [key, rule] of Object.entries(entry?.rules ?? {})) {
            const target = parseRuleTarget(key);
            if (target.kind !== 'exit') continue;
            if (!out.has(index)) out.set(index, new Map());
            out.get(index).set(target.id, rule);
        }
    }
    return out;
}

/**
 * ⛓ **RE-KEY AN OVERLAY UNDER A ROOM RENUMBERING** — what `reorder`,
 * `add-room` and `remove-room` all need, in ONE place.
 *
 * `mapping` is `oldIndex -> newIndex | null` (null = the room is gone). A room
 * overlay whose room disappears is DROPPED, and the caller is told how many —
 * silently losing an authored location is the shape the derivation's own
 * lost-collectible throw exists to prevent, one layer up.
 *
 * @returns {{overlay: object, dropped: number[]}}
 */
export function renumberOverlay(overlay, mapping) {
    const rooms = {};
    const dropped = [];
    for (const [rawIndex, entry] of Object.entries(overlay?.rooms ?? {})) {
        const from = Number(rawIndex);
        const to = mapping.get(from);
        if (to === null || to === undefined) { dropped.push(from); continue; }
        rooms[String(to)] = entry;
    }
    const next = { ...overlay, rooms };
    if (Array.isArray(overlay?.neverEnter)) {
        next.neverEnter = overlay.neverEnter
            .map((i) => mapping.get(i))
            .filter((i) => i !== null && i !== undefined)
            .sort((a, b) => a - b);
    }
    if (Array.isArray(overlay?.regions)) {
        const regions = [];
        overlay.regions.forEach((r, i) => {
            const to = mapping.get(i);
            if (to !== null && to !== undefined) regions[to] = r;
        });
        // ⛔ HOLES FILLED WITH `SIGN_NONE`, not left sparse. A sparse array
        // round-trips through JSON as `null`s, and `signForTransition` reads a
        // non-integer as "no region" anyway — writing it out means the document
        // says what it means instead of relying on a reader's coercion.
        next.regions = Array.from({ length: regions.length }, (_, i) => regions[i] ?? SIGN_NONE);
    }
    return { overlay: next, dropped };
}

/** The room-index keys of an overlay, as numbers, ascending. */
export const overlayRoomIndices = (overlay) => Object.keys(overlay?.rooms ?? {})
    .map(Number).sort((a, b) => a - b);

/** Every authored location name in the set, with the room it sits in. */
export function overlayLocationNames(overlay) {
    const out = new Map();
    for (const [rawIndex, entry] of Object.entries(overlay?.rooms ?? {})) {
        for (const row of entry?.locations ?? []) out.set(row.name, Number(rawIndex));
    }
    return out;
}
