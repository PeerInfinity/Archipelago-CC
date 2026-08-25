/**
 * procgenCore/setOverlay — **THE AUTHORED HALF OF A SET, FOR ANY SUBSTRATE.**
 *
 * EDITOR v3 arc, slice E2a (`NewDocs/plans/seedling-editor-v3.md` §22.3, §26).
 * §16.3 ruled that a set session's document is `{set, overlay}` and that the
 * region atlas is DERIVED from the set plus an AUTHORED overlay. D1 built that
 * overlay inside `seedlingDemo/seedlingSetOverlay.js`; E2a measured how much of
 * it is about a LEVEL SET and how much is about the shape "rooms keyed by
 * index, each carrying a name, locations and rules".
 *
 * ── ⛓ THE MEASUREMENT THAT DECIDED THE LIFT (E2a, by exported function) ──
 *
 *   FULLY substrate-free (8): `emptyOverlay`, `parseRuleTarget`, `exitRuleKey`,
 *     `locationRuleKey`, `assertOverlay`, `exitRulesByRoom`,
 *     `overlayRoomIndices`, `overlayLocationNames`.
 *   Free once PARAMETERISED (2): `overlayErrors` (its location-row check and
 *     its `regions` range are Seedling's), `renumberOverlay` (its `regions`
 *     hole-filling is Seedling's).
 *   NOT free (1): `overlayToDeriveInput` — it speaks the vanilla ledger's
 *     vocabulary and builds `deriveAtlas`'s `locationGuard` closure.
 *
 * ⇒ **10 of 11 = 90.9%**, over the ≥ 80% the brief set, so the module is
 * LIFTED and each substrate BINDS it with `createSetOverlay(spec)`.
 *
 * ── ⛔⛔ WHAT A SUBSTRATE STILL OWNS, AND WHY EACH ONE IS NOT SHARED ──
 *
 *  1. **THE LOCATION ROW'S ADDRESS.** Seedling's is `{type, x, y}` PIXELS —
 *     the OEL element's own coordinates. The maze's is an INDEX into the
 *     payload's `items[]`. Neither is a generalisation of the other, so
 *     `locationRowErrors` is the substrate's and `locationFields` names what
 *     the row may carry.
 *  2. **THE EXTRA TOP-LEVEL FIELDS.** Seedling carries `neverEnter` and
 *     `regions` (`Message.as` holds exactly seven region titles); the maze
 *     carries `links` and `start`, because a region LIBRARY forbids wiring
 *     inside its entries by contract (`regionLibraryValidator.js:22-33`) and
 *     the links have to live SOMEWHERE. `extraFields` is that door, and each
 *     entry owns both its check and its behaviour under a renumbering.
 *  3. **THE ERROR CLASS AND THE MODULE NAME**, so a refusal names the module a
 *     reader would open.
 *
 * ── ⛓ WHY THE RULE-TARGET KEY IS PREFIXED (D1 §20.1, unchanged) ──────────
 *
 * `rooms[i].rules` is keyed by a target inside THAT ROOM's derived region, and
 * two namespaces meet there: an EXIT by the derivation's own id, and a LOCATION
 * by its AUTHORED name. ⛔ Both halves are FREE-FORM STRINGS, so a bare key
 * could collide. The key is therefore `exit:<exit_id>` or `loc:<name>` —
 * self-describing, collision-free by construction, and a key with neither
 * prefix is REFUSED BY NAME rather than guessed at
 * ([[feedback_fallback_reinstates_the_defect]]).
 */

/** The overlay format's own version. Bumped when a key's meaning changes. */
export const OVERLAY_SCHEMA_VERSION = 1;

/** The two prefixes a `rules` key may carry. The refusals read this. */
export const RULE_TARGET_PREFIXES = Object.freeze(['exit:', 'loc:']);

/** The fields a per-room overlay entry may carry. A fourth cannot arrive silently. */
export const ROOM_OVERLAY_FIELDS = Object.freeze(['name', 'locations', 'rules']);

/**
 * ⛓ The envelope every overlay carries, split so a substrate's own fields land
 * BETWEEN `rooms` and `provenance` — which is the order a reader expects (what
 * it is, what it holds, what is authored on it, where it came from) and the
 * order the "not a declared field" sentence prints.
 */
export const OVERLAY_ENVELOPE_HEAD = Object.freeze(['schema_version', 'overlay_id', 'rooms']);
export const OVERLAY_ENVELOPE_TAIL = Object.freeze(['provenance']);

/** The fields a location row ALWAYS carries, whatever addresses it. */
export const BASE_LOCATION_FIELDS = Object.freeze(['name', 'vanilla_item']);

/** ⛓ Build a rule-target key. The ONE spelling, so a caller never types a prefix. */
export const exitRuleKey = (exitId) => `${RULE_TARGET_PREFIXES[0]}${exitId}`;
export const locationRuleKey = (name) => `${RULE_TARGET_PREFIXES[1]}${name}`;

/** The default refusal class, for a substrate that wants no class of its own. */
export class SetOverlayError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SetOverlayError';
    }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

/** `a, b, c and d` — the list every "not a declared field" sentence prints. */
const andList = (names) => (names.length < 2 ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/**
 * ⛓⛓⛓ **BIND THE OVERLAY MODULE TO ONE SUBSTRATE.**
 *
 * @param {object} spec
 * @param {string} spec.moduleName    what a refusal calls itself
 * @param {Function} [spec.ErrorClass]
 * @param {number} [spec.schemaVersion]
 * @param {string[]} spec.locationFields  every field a location row may carry,
 *   IN THE ORDER the refusal prints them
 * @param {Function} [spec.locationRowErrors] `(row, label) => string[]` — the
 *   substrate's own per-row checks (its ADDRESS, above all)
 * @param {object} [spec.extraFields] `{name: {errors(value, ctx), renumber(value, mapping)}}`
 * @param {string} [spec.exitIdHint]  what an exit id looks like here, for the
 *   bare-key refusal — the mistake that refusal catches is a person typing one
 */
export function createSetOverlay({
    moduleName,
    ErrorClass = SetOverlayError,
    schemaVersion = OVERLAY_SCHEMA_VERSION,
    locationFields,
    locationRowErrors = null,
    extraFields = {},
    exitIdHint = '',
} = {}) {
    if (!isNonEmptyString(moduleName)) {
        throw new SetOverlayError('setOverlay: createSetOverlay needs a `moduleName` — every '
            + 'refusal names the module a reader would open, and an overlay bound by two '
            + 'substrates that both called themselves "setOverlay" would send a reader to '
            + 'the wrong file.');
    }
    if (!Array.isArray(locationFields) || locationFields.length === 0) {
        throw new SetOverlayError(`setOverlay: ${moduleName} must declare \`locationFields\` — a `
            + 'location row\'s ADDRESS is the one thing no two substrates share (Seedling '
            + 'addresses an OEL entity by pixel, the maze addresses a payload item by index), '
            + 'so there is no honest default.');
    }
    for (const field of BASE_LOCATION_FIELDS) {
        if (!locationFields.includes(field)) {
            throw new SetOverlayError(`setOverlay: ${moduleName}'s \`locationFields\` omits `
                + `"${field}", which every location row carries — the compiler allocates AP `
                + 'location ids from `name` alone and the fill needs an item behind each one.');
        }
    }
    const extraNames = Object.keys(extraFields);
    const declaredFields = [...OVERLAY_ENVELOPE_HEAD, ...extraNames, ...OVERLAY_ENVELOPE_TAIL];

    const fail = (message) => { throw new ErrorClass(message); };

    /**
     * ⛓ **PARSE A RULE-TARGET KEY.** Returns `{kind: 'exit'|'loc', id}`, or refuses.
     *
     * ⛔ The refusal names BOTH prefixes and the key it got, because the mistake
     * this catches is a person writing the exit id bare — which would silently
     * have become a location under a looser reader.
     */
    function parseRuleTarget(key) {
        if (!isNonEmptyString(key)) {
            fail(`${moduleName}: a rule target is a non-empty string, got ${JSON.stringify(key)}`);
        }
        for (const prefix of RULE_TARGET_PREFIXES) {
            if (key.startsWith(prefix)) {
                const id = key.slice(prefix.length);
                if (id === '') {
                    fail(`${moduleName}: rule target ${JSON.stringify(key)} carries the `
                        + `"${prefix}" prefix and nothing after it`);
                }
                return { kind: prefix === RULE_TARGET_PREFIXES[0] ? 'exit' : 'loc', id };
            }
        }
        fail(`${moduleName}: rule target ${JSON.stringify(key)} carries neither `
            + `"${RULE_TARGET_PREFIXES[0]}" nor "${RULE_TARGET_PREFIXES[1]}". ⛔ REFUSED rather `
            + 'than guessed: an exit id and a location name are both free-form strings, so a '
            + 'bare key that happened to look like an exit id would silently author a rule on '
            + `the wrong thing.${exitIdHint ? ` ${exitIdHint}` : ''}`);
        return null; // unreachable — `fail` throws
    }

    /** An EMPTY overlay — what a `set` base resolves when no `overlay_id` is named. */
    const emptyOverlay = () => ({ schema_version: schemaVersion, rooms: {} });

    /**
     * ⛓⛓ **THE OVERLAY'S SHAPE CHECK — small, and every refusal names the path.**
     *
     * ⛔ Not a JSON Schema. `procgenCore/jsonSchemaCheck.js` exists and is good,
     * but it takes an INJECTED schema document, and the overlay's schema would
     * then be another file on disk for a shape with a handful of keys. What
     * matters is that the refusal is BY NAME and that an unknown key is refused
     * rather than carried: an overlay that quietly held a typo'd field would
     * derive an atlas missing the thing the author thought they had authored.
     *
     * @returns {string[]} errors; empty means the shape is good
     */
    function overlayErrors(overlay, options = {}) {
        const { roomCount = null } = options;
        const errors = [];
        const err = (m) => errors.push(m);
        if (!isPlainObject(overlay)) return [`overlay must be an object, got ${JSON.stringify(overlay)}`];
        if (overlay.schema_version !== schemaVersion) {
            err(`overlay.schema_version must be ${schemaVersion}, got ${JSON.stringify(overlay.schema_version)}`);
        }
        if (overlay.overlay_id !== undefined && !isNonEmptyString(overlay.overlay_id)) {
            err('overlay.overlay_id must be a non-empty string when present');
        }
        for (const key of Object.keys(overlay)) {
            if (!declaredFields.includes(key)) {
                err(`overlay.${key} is not a declared field — the overlay carries `
                    + `${andList(declaredFields)}`);
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
                            if (!locationFields.includes(field)) {
                                err(`${rlabel}.${field} is not a declared field — a location row carries `
                                    + `${locationFields.join(', ')}`);
                            }
                        }
                        if (!isNonEmptyString(row.name)) err(`${rlabel}.name must be a non-empty string`);
                        if (!isNonEmptyString(row.vanilla_item)) {
                            err(`${rlabel}.vanilla_item must be a non-empty string — an AP location `
                                + 'with no item behind it is a location the fill cannot use');
                        }
                        // ⛓ THE ADDRESS IS THE SUBSTRATE'S, and so is its sentence.
                        for (const m of locationRowErrors?.(row, rlabel) ?? []) err(m);
                        if (isNonEmptyString(row.name)) {
                            // ⛔ GLOBAL, not per room. The compiler allocates AP location ids
                            // from `loc.name` ALONE (regionAtlasCompiler.js:376), and the
                            // derivation prefixes the room — but two rooms that swap places
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
                    err(`${label}.rules must be an object keyed by "${RULE_TARGET_PREFIXES[0]}<id>" `
                        + `or "${RULE_TARGET_PREFIXES[1]}<name>"`);
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
        for (const [name, field] of Object.entries(extraFields)) {
            if (overlay[name] === undefined || typeof field.errors !== 'function') continue;
            // ⛓ THE WHOLE OPTIONS BAG REACHES THE SUBSTRATE'S CHECK. A maze
            // `links` row names an `exit_id`, and only the LIBRARY knows whether
            // that entry has one — so the caller hands the entries in beside
            // `roomCount` and this passes them through rather than deciding
            // which of a substrate's inputs are worth carrying.
            for (const m of field.errors(overlay[name], { ...options, overlay, roomCount }) ?? []) err(m);
        }
        return errors;
    }

    /** Refuse a bad overlay BY NAME, quoting every error. */
    function assertOverlay(overlay, options = {}) {
        const errors = overlayErrors(overlay, options);
        if (errors.length > 0) {
            fail(`${moduleName}: this overlay is not well formed — ${errors.join(' · ')}`);
        }
        return overlay;
    }

    /**
     * The EXIT rules of an overlay, grouped by room index. Locations are NOT
     * here — they ride the derivation's own location path, because a location's
     * rule has to be attached while the location is being built.
     *
     * @returns {Map<number, Map<string, object>>} room index -> exit_id -> rule
     */
    function exitRulesByRoom(overlay) {
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
     * `mapping` is `oldIndex -> newIndex | null` (null = the room is gone). A
     * room overlay whose room disappears is DROPPED, and the caller is told how
     * many — silently losing an authored location is the shape the derivation's
     * own lost-collectible throw exists to prevent, one layer up.
     *
     * ⛓ Each of the substrate's own top-level fields is re-keyed by ITS OWN
     * `renumber`, because what a renumbering means to a list of room indices
     * (Seedling's `neverEnter`) and to a list of LINKS between them (the maze's)
     * are different questions with the same input.
     *
     * @returns {{overlay: object, dropped: number[]}}
     */
    function renumberOverlay(overlay, mapping) {
        const rooms = {};
        const dropped = [];
        for (const [rawIndex, entry] of Object.entries(overlay?.rooms ?? {})) {
            const from = Number(rawIndex);
            const to = mapping.get(from);
            if (to === null || to === undefined) { dropped.push(from); continue; }
            rooms[String(to)] = entry;
        }
        const next = { ...overlay, rooms };
        for (const [name, field] of Object.entries(extraFields)) {
            if (overlay?.[name] === undefined || typeof field.renumber !== 'function') continue;
            const value = field.renumber(overlay[name], mapping);
            if (value === undefined) delete next[name];
            else next[name] = value;
        }
        return { overlay: next, dropped };
    }

    /** The room-index keys of an overlay, as numbers, ascending. */
    const overlayRoomIndices = (overlay) => Object.keys(overlay?.rooms ?? {})
        .map(Number).sort((a, b) => a - b);

    /** Every authored location name in the set, with the room it sits in. */
    function overlayLocationNames(overlay) {
        const out = new Map();
        for (const [rawIndex, entry] of Object.entries(overlay?.rooms ?? {})) {
            for (const row of entry?.locations ?? []) out.set(row.name, Number(rawIndex));
        }
        return out;
    }

    return Object.freeze({
        OVERLAY_SCHEMA_VERSION: schemaVersion,
        LOCATION_FIELDS: Object.freeze([...locationFields]),
        DECLARED_FIELDS: Object.freeze([...declaredFields]),
        emptyOverlay,
        parseRuleTarget,
        overlayErrors,
        assertOverlay,
        exitRulesByRoom,
        renumberOverlay,
        overlayRoomIndices,
        overlayLocationNames,
    });
}
