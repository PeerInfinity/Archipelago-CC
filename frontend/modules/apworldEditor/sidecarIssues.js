/**
 * apworldEditor/sidecarIssues — **THE SIDECAR VALIDITY REPORT: what is wrong
 * with a slot's `preset_sidecars` entries, in sentences** (PRESET SIDECARS
 * slice V0; plan §7.5).
 *
 * ⚖ The user, 2026-09-10: *"If the user changes a substrate, or makes some
 * other breaking change, then it's their responsibility to find a way to make
 * the data valid again before they save the JSON data. If we don't already
 * have a way to report what data is invalid, then I want to add one."* — and at
 * the replan: the raw save keeps ACCEPTING a changed `substrate`; this report
 * names the mismatch.
 *
 * Three validators existed and none looked inside a sidecar: `validateRules`
 * (the bar), `_schemaErrorsAddedBy` (the save veto — the payload is OPAQUE to
 * the schema) and `canonicalPlacementIssues` (P1). So after a raw save that
 * changed `substrate` the document passed the schema and the bar stayed green,
 * and the failure surfaced at PLAY. This is the fourth validator, in P1's
 * shape: ONE pure function, three readers — the validation bar, the per-region
 * block (and its count badge on the Sidecars list), and the corpus gate
 * `scripts/procgen/check-sidecar-fields.mjs` (its second layer). None of them
 * re-derives a check; each asks this.
 *
 * ── ⛓⛓ WHAT IT REPORTS — `{severity, region, field?, kind, message}` ──
 *
 * `kind` is one of `SIDECAR_ISSUE_KINDS`; `SIDECAR_ISSUE_SEVERITY` and
 * `SIDECAR_ISSUE_LAYER` say, per kind, how bad and which layer. Severity follows
 * `validateRules`' own definition: an ERROR is a dangling reference or a value
 * the reader is declared not to accept (it will break); a WARNING is
 * suspicious-but-maybe-intentional state. ⛔ **ERRORS BLOCK NOTHING** — the raw
 * save is not vetoed by any of this (the ⚖ above: the reader owns the repair).
 *
 *   **Shape** (D0's declaration — `sidecarFieldsOf` / `sidecarPayloadErrors`):
 *   the entry's `substrate` is registered and has `deserializeWorld`; every
 *   payload key declared, every `required` key present, every value inside its
 *   descriptor. ⚠ `required` means *every producer of this substrate writes
 *   it* (D0 ⚖ 5), not *a reader needs it* — so a missing one is a WARNING and
 *   its sentence says exactly that. And the MISMATCH: when the payload fits
 *   ANOTHER declaring substrate strictly better than its own (`sidecarFit`, the
 *   one rule, exported), the report says whose keys it has — the substrate-
 *   change case — and folds the per-field shape sentences into that one, since
 *   *"`tiles` is not a `bounce` field"* eight times over is one fact.
 *
 *   **Document** (substrate-agnostic where the ENVELOPE makes them so): the
 *   payload DESERIALIZES through the entry's own `deserializeWorld`; every
 *   non-null `exits[].exitName` names an exit the document's region has
 *   (`apExitNameCandidates` spells the prefixed form); `grid_cell` is unique in
 *   the slot and inside `procgen_metadata.grid_dims` when present; a field
 *   whose descriptor `references` a sibling resolves to one.
 *
 *   **Declared per substrate, absent = NOT CHECKED, said aloud.** Two
 *   registry-entry slots, because what a payload CARRIES differs by producer:
 *     `apLocationNamesOf(payload) → string[] | null` — its AP location names
 *     `apExitNamesOf(payload)     → string[] | null` — its exits, as the
 *                                                     region's COMPLETE list
 *   compared with the document's region BOTH WAYS. A name the payload carries
 *   that the document lacks is an ERROR (dangling); a document endpoint the
 *   payload does not carry is a WARNING (a producer may drop one by name — the
 *   maze atlas projection's `exit_tile_collision`). An entry without a slot, or
 *   a payload whose reader answers `null`, is ONE warning per substrate per
 *   slot saying so (`UNCHECKED_SIDECAR_KINDS` — the gate counts those apart).
 *
 * ── ⛔ WHAT IT DOES NOT RUN ──────────────────────────────────────────────
 *
 * The H4b round-trip baseline (`inspectRegionRoom` — ~90 ms a region, async):
 * the bar must stay cheap, and the block already shows Edit ▸'s own verdict
 * for that question. No substrate module is imported here and no substrate is
 * named; everything per-substrate is read off the registry entry.
 *
 * ── ⛓ THE MEMO ─────────────────────────────────────────────────────────
 *
 * D0's shape check walks each payload's values through `jsonSchemaCheck` (the
 * tile grids dominate), so an ENTRY's issues are memoised on the entry OBJECT
 * — with its region object, name, slot and registry entry as the rest of the
 * key. The hub's record is copy-on-write (an op hands out new objects only
 * along the path it wrote, and an undo re-folds to the old ones), so identity
 * is exactly *"could the answer have changed"* — R1's and the S0 size memo's
 * rule. The slot-level checks (cells, references, the not-checked notices)
 * are cheap and run on every call.
 */

import {
    ENVELOPE_SIDECAR_FIELDS, SIDECAR_FIELD_ERRORS, sidecarFieldsOf, sidecarPayloadErrors,
} from '../procgenCore/sidecarFields.js';
import { apExitNameCandidates } from '../procgenCore/apLocationNaming.js';
import { regionsOf } from '../procgenCore/rulesGraph.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { DEFAULT_PLAYER_ID } from '../shared/playerIdUtils.js';

/** ⛓ Every issue, BY NAME. A row asserts the kind, never the wording. */
export const SIDECAR_ISSUE_KINDS = Object.freeze({
    NOT_AN_ENTRY: 'NOT_AN_ENTRY',
    NOT_PLAYABLE: 'NOT_PLAYABLE',
    BAD_DECLARATION: 'BAD_DECLARATION',
    NO_DECLARATION: SIDECAR_FIELD_ERRORS.NO_DECLARATION,
    MISSING_REQUIRED: SIDECAR_FIELD_ERRORS.MISSING_REQUIRED,
    UNDECLARED_FIELD: SIDECAR_FIELD_ERRORS.UNDECLARED_FIELD,
    INVALID_VALUE: SIDECAR_FIELD_ERRORS.INVALID_VALUE,
    SUBSTRATE_MISMATCH: 'SUBSTRATE_MISMATCH',
    DESERIALIZE_THROWS: 'DESERIALIZE_THROWS',
    NO_REGION: 'NO_REGION',
    EXIT_UNKNOWN: 'EXIT_UNKNOWN',
    EXIT_NOT_CARRIED: 'EXIT_NOT_CARRIED',
    EXITS_UNCHECKED: 'EXITS_UNCHECKED',
    LOCATION_UNKNOWN: 'LOCATION_UNKNOWN',
    LOCATION_NOT_CARRIED: 'LOCATION_NOT_CARRIED',
    LOCATIONS_UNCHECKED: 'LOCATIONS_UNCHECKED',
    GRID_CELL_DUPLICATE: 'GRID_CELL_DUPLICATE',
    GRID_CELL_OUTSIDE: 'GRID_CELL_OUTSIDE',
    REF_UNRESOLVED: 'REF_UNRESOLVED',
});

const K = SIDECAR_ISSUE_KINDS;
const ERROR = 'error';
const WARNING = 'warning';

/** ⛓ Per kind: `error` (dangling / refused by the reader) or `warning` (maybe intended). */
export const SIDECAR_ISSUE_SEVERITY = Object.freeze({
    [K.NOT_AN_ENTRY]: ERROR,
    [K.NOT_PLAYABLE]: ERROR,
    [K.BAD_DECLARATION]: ERROR,
    [K.NO_DECLARATION]: WARNING,
    [K.MISSING_REQUIRED]: WARNING,
    [K.UNDECLARED_FIELD]: WARNING,
    [K.INVALID_VALUE]: ERROR,
    [K.SUBSTRATE_MISMATCH]: ERROR,
    [K.DESERIALIZE_THROWS]: ERROR,
    [K.NO_REGION]: ERROR,
    [K.EXIT_UNKNOWN]: ERROR,
    [K.EXIT_NOT_CARRIED]: WARNING,
    [K.EXITS_UNCHECKED]: WARNING,
    [K.LOCATION_UNKNOWN]: ERROR,
    [K.LOCATION_NOT_CARRIED]: WARNING,
    [K.LOCATIONS_UNCHECKED]: WARNING,
    [K.GRID_CELL_DUPLICATE]: ERROR,
    [K.GRID_CELL_OUTSIDE]: ERROR,
    [K.REF_UNRESOLVED]: ERROR,
});

/** ⛓ Per kind: `shape` (the payload against its declaration) or `document` (against the rest). */
export const SIDECAR_ISSUE_LAYER = Object.freeze(Object.fromEntries(Object.values(K).map((k) => [k,
    [K.NOT_AN_ENTRY, K.NOT_PLAYABLE, K.BAD_DECLARATION, K.NO_DECLARATION, K.MISSING_REQUIRED,
        K.UNDECLARED_FIELD, K.INVALID_VALUE, K.SUBSTRATE_MISMATCH].includes(k) ? 'shape' : 'document'])));

/**
 * ⛓ The kinds that say "this was NOT CHECKED" rather than "this is wrong" —
 * absent means unchecked, said aloud. A corpus gate counts these apart from
 * the issues it holds the corpus to.
 */
export const UNCHECKED_SIDECAR_KINDS = Object.freeze([
    K.NO_DECLARATION, K.EXITS_UNCHECKED, K.LOCATIONS_UNCHECKED,
]);

/** ⛓ The two registry-entry slots this report reads, named once. */
export const AP_LOCATION_NAMES_SLOT = 'apLocationNamesOf';
export const AP_EXIT_NAMES_SLOT = 'apExitNamesOf';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const issue = (kind, region, message, field) => ({
    severity: SIDECAR_ISSUE_SEVERITY[kind],
    region,
    ...(field !== undefined ? { field } : {}),
    kind,
    message,
});

/* ── the fit rule ─────────────────────────────────────────────────────── */

/** The payload's SUBSTRATE-owned keys: every top-level key but the envelope's. */
const ownKeys = (payload) => Object.keys(isPlainObject(payload) ? payload : {})
    .filter((k) => !Object.prototype.hasOwnProperty.call(ENVELOPE_SIDECAR_FIELDS, k));

/**
 * ⛓⛓⛓ **THE FIT RULE — how well a payload's keys match a declaration.** The
 * Jaccard index of two key sets: the payload's SUBSTRATE-owned keys and the
 * declaration's substrate-owned fields (`owner: 'substrate'`). ⛔ The envelope
 * is left out on both sides: its four keys are the ENGINE's, carried alike
 * under every substrate, so they are no evidence of which one a payload
 * belongs to. 0 when either side is empty.
 *
 * Measured over the corpus's eight declarations, the rule separates every
 * family (a maze payload scores 0 against every non-tile-grid declaration; a
 * jta one ~0.1 against omsi), and ties exactly where two declarations ARE one
 * shape at the top level (maze ≡ text_adventure; bounce ≈ runner) — which
 * `bestFittingSubstrates` breaks by the shape check.
 *
 * @param {Record<string, object>|null} fields  `sidecarFieldsOf(entry)`
 * @param {object} payload
 * @returns {number} in [0, 1]
 */
export function sidecarFit(fields, payload) {
    if (!fields) return 0;
    const declared = new Set(Object.keys(fields).filter((k) => fields[k].owner === 'substrate'));
    const carried = new Set(ownKeys(payload));
    if (declared.size === 0 || carried.size === 0) return 0;
    let both = 0;
    for (const k of carried) if (declared.has(k)) both += 1;
    return both / (declared.size + carried.size - both);
}

/**
 * ⛓⛓ **WHICH DECLARATIONS FIT A PAYLOAD BEST** — the highest `sidecarFit`,
 * ties broken by the fewest distinct fields `sidecarPayloadErrors` names (so a
 * bounce payload fits `bounce` rather than `runner`, whose top-level keys it
 * shares), and still-tied ids ALL returned (maze and text_adventure carry one
 * declaration object: neither is the better answer).
 *
 * @param {object} payload
 * @param {Array<{id: string, fields: object}>} candidates
 * @returns {{ids: string[], score: number}} `ids` empty when nothing scores > 0
 */
export function bestFittingSubstrates(payload, candidates) {
    let best = [];
    let score = 0;
    for (const c of candidates) {
        const s = sidecarFit(c.fields, payload);
        if (s <= 0) continue;
        if (s > score) { score = s; best = [c]; } else if (s === score) best.push(c);
    }
    if (best.length > 1) {
        const misfit = (c) => new Set(sidecarPayloadErrors(c.fields, payload).map((e) => e.field)).size;
        const ranked = best.map((c) => ({ c, m: misfit(c) }));
        const least = Math.min(...ranked.map((r) => r.m));
        best = ranked.filter((r) => r.m === least).map((r) => r.c);
    }
    // ⛓ Sorted, so the sentence does not depend on the order modules registered in.
    return { ids: best.map((c) => c.id).sort(), score };
}

/* ── the declarations, asked once per registry entry ─────────────────── */

const declarationMemo = new WeakMap();
/** `{fields}` | `{error}` for one registry entry (null fields = declares none). */
function declarationOf(entry) {
    if (declarationMemo.has(entry)) return declarationMemo.get(entry);
    let out;
    try {
        out = { fields: sidecarFieldsOf(entry) };
    } catch (e) {
        out = { error: e.message };
    }
    declarationMemo.set(entry, out);
    return out;
}

/** Every registered entry that declares a well-formed payload — the mismatch candidates. */
function declaringCandidates() {
    const out = [];
    for (const entry of substrateRegistry.getAll()) {
        const d = declarationOf(entry);
        if (d.fields) out.push({ id: entry.id, fields: d.fields });
    }
    return out;
}

/* ── one entry ─────────────────────────────────────────────────────────── */

/** A declared carrier, asked: `{names}` | `{absent: true}` | `{notCarried: true}` | `{error}`. */
function askCarrier(reg, slot, payload) {
    const fn = reg[slot];
    if (fn === undefined) return { absent: true };
    if (typeof fn !== 'function') return { error: `its \`${slot}\` is a ${typeof fn}, not a function` };
    try {
        const names = fn(payload);
        if (names === null || names === undefined) return { notCarried: true };
        if (!Array.isArray(names)) return { error: `its \`${slot}\` returned a ${typeof names}, not a list` };
        return { names };
    } catch (e) {
        return { error: `its \`${slot}\` threw — ${e.message}` };
    }
}

/**
 * The region's location names against the ones the payload carries, both
 * ways: a carried name the document lacks is dangling; a document location
 * the payload lacks is one whose check cannot fire from this room.
 */
function locationCrossCheck(region, carried, docNames) {
    const out = [];
    const docSet = new Set(docNames);
    const carriedSet = new Set(carried);
    for (const name of carriedSet) {
        if (!docSet.has(name)) {
            out.push(issue(K.LOCATION_UNKNOWN, region,
                `location "${name}" names no location of "${region}" in the document`));
        }
    }
    for (const name of docNames) {
        if (!carriedSet.has(name)) {
            out.push(issue(K.LOCATION_NOT_CARRIED, region,
                `the document's location "${name}" is not in the payload — its check can never fire`));
        }
    }
    return out;
}

const entryMemo = new WeakMap();

/**
 * ⛓ The issues of ONE entry that depend only on the entry, its region, its
 * name, its slot and the registry — memoised on the entry object (see the
 * docblock). Returns `{issues, unchecked}`: `unchecked` names the per-entry
 * facts the slot folds into its not-checked notices.
 */
function entryIssues(player, region, entry, docRegion, registrySize) {
    const hit = isPlainObject(entry) ? entryMemo.get(entry) : null;
    if (hit && hit.player === player && hit.region === region && hit.docRegion === docRegion
        && hit.registrySize === registrySize
        && hit.reg === substrateRegistry.get(entry.substrate)) {
        return hit.result;
    }
    const result = computeEntryIssues(player, region, entry, docRegion);
    if (isPlainObject(entry)) {
        entryMemo.set(entry, {
            player, region, docRegion, registrySize,
            reg: substrateRegistry.get(entry.substrate), result,
        });
    }
    return result;
}

function computeEntryIssues(player, region, entry, docRegion) {
    const issues = [];
    const unchecked = { declaration: false, locations: null, exits: null };
    if (!isPlainObject(entry) || typeof entry.substrate !== 'string' || entry.substrate === '') {
        issues.push(issue(K.NOT_AN_ENTRY, region, 'the entry is not an object with a string `substrate`'));
        return { issues, unchecked };
    }
    const sub = entry.substrate;
    const payload = entry.playable_payload;
    const reg = substrateRegistry.get(sub);

    /* ── shape ── */
    if (!reg || typeof reg.deserializeWorld !== 'function') {
        issues.push(issue(K.NOT_PLAYABLE, region, `\`${sub}\` is not a substrate this app can play — `
            + (reg ? 'its registry entry has no `deserializeWorld`' : 'no module registers it'),
        'substrate'));
        const { ids } = bestFittingSubstrates(payload, declaringCandidates());
        if (ids.length) {
            issues.push(issue(K.SUBSTRATE_MISMATCH, region,
                `this payload has the keys of \`${ids.join('` or `')}\`, not \`${sub}\``, 'substrate'));
        }
        return { issues, unchecked };
    }
    const decl = declarationOf(reg);
    let mismatch = false;
    if (decl.error) {
        issues.push(issue(K.BAD_DECLARATION, region,
            `\`${sub}\`'s sidecarFields declaration is malformed — ${decl.error}`));
    } else if (!decl.fields) {
        unchecked.declaration = true;
    } else {
        const shape = [];
        for (const e of sidecarPayloadErrors(decl.fields, payload)) {
            if (e.code === SIDECAR_FIELD_ERRORS.MISSING_REQUIRED) {
                shape.push(issue(K.MISSING_REQUIRED, region,
                    `\`${e.field}\` is absent — every \`${sub}\` producer writes it`, e.field));
            } else if (e.code === SIDECAR_FIELD_ERRORS.UNDECLARED_FIELD) {
                shape.push(issue(K.UNDECLARED_FIELD, region,
                    `\`${e.field}\` is carried, but \`${sub}\` declares no such field`, e.field));
            } else {
                shape.push(issue(K.INVALID_VALUE, region, e.message, e.field ?? undefined));
            }
        }
        if (shape.length) {
            const own = sidecarFit(decl.fields, payload);
            const others = declaringCandidates().filter((c) => c.id !== sub);
            const { ids, score } = bestFittingSubstrates(payload, others);
            if (ids.length && score > own) {
                mismatch = true;
                const counts = [...new Set(shape.map((s) => s.kind))]
                    .map((k) => `${shape.filter((s) => s.kind === k).length} ${k}`).join(', ');
                issues.push(issue(K.SUBSTRATE_MISMATCH, region,
                    `this payload has the keys of \`${ids.join('` or `')}\`, not \`${sub}\` `
                    + `(under \`${sub}\`: ${counts})`, 'substrate'));
            } else {
                issues.push(...shape);
            }
        }
    }

    /* ── document ── */
    try {
        reg.deserializeWorld(payload);
    } catch (e) {
        issues.push(issue(K.DESERIALIZE_THROWS, region,
            `\`${sub}\` cannot read this payload — ${e?.message ?? e}`));
    }
    if (!docRegion) {
        issues.push(issue(K.NO_REGION, region,
            `slot ${player} has no region "${region}" — nothing in the document reaches this entry`));
        return { issues, unchecked };
    }
    const docExits = (Array.isArray(docRegion.exits) ? docRegion.exits : [])
        .map((e) => e?.name).filter((n) => typeof n === 'string');
    const docLocations = (Array.isArray(docRegion.locations) ? docRegion.locations : [])
        .map((l) => l?.name).filter((n) => typeof n === 'string');
    const exitSpellings = (name) => apExitNameCandidates(region, name);

    // ⛓ ENVELOPE, every substrate: a non-null exitName must name a document exit.
    const envelopeNames = (isPlainObject(payload) && Array.isArray(payload.exits) ? payload.exits : [])
        .map((e) => e?.exitName).filter((n) => typeof n === 'string' && n !== '');
    const docExitSet = new Set(docExits);
    for (const name of envelopeNames) {
        if (!exitSpellings(name).some((c) => docExitSet.has(c))) {
            issues.push(issue(K.EXIT_UNKNOWN, region,
                `exit "${name}" names no exit of "${region}" in the document`));
        }
    }
    // ⛔ Under a mismatch the claimed substrate's carriers read a foreign payload:
    //   their answers would be about the wrong shape, so they are not asked.
    if (mismatch) return { issues, unchecked };

    // ⛓ DECLARED: the complete exit list, the other way round.
    const exits = askCarrier(reg, AP_EXIT_NAMES_SLOT, payload);
    if (exits.error) issues.push(issue(K.BAD_DECLARATION, region, `\`${sub}\`: ${exits.error}`));
    else if (exits.absent) unchecked.exits = 'absent';
    else if (exits.notCarried) unchecked.exits = 'notCarried';
    else {
        const matched = new Set();
        for (const name of exits.names) {
            const hit = exitSpellings(name).find((c) => docExitSet.has(c));
            if (hit) matched.add(hit);
        }
        for (const name of docExits) {
            if (!matched.has(name)) {
                issues.push(issue(K.EXIT_NOT_CARRIED, region,
                    `the document's exit "${name}" is not in the payload — the room has no way to take it`));
            }
        }
    }

    // ⛓ DECLARED: the location names, both ways.
    const locations = askCarrier(reg, AP_LOCATION_NAMES_SLOT, payload);
    if (locations.error) issues.push(issue(K.BAD_DECLARATION, region, `\`${sub}\`: ${locations.error}`));
    else if (locations.absent) unchecked.locations = 'absent';
    else if (locations.notCarried) unchecked.locations = 'notCarried';
    else {
        issues.push(...locationCrossCheck(region, locations.names, docLocations));
    }
    return { issues, unchecked };
}

/* ── the slot ─────────────────────────────────────────────────────────── */

/**
 * ⛓⛓⛓ **EVERY SIDECAR ISSUE OF ONE SLOT** — entry by entry, then the checks
 * that need the whole slot (cells, sibling references, the not-checked
 * notices). In the slot's own entry order; a slot-level notice has `region:
 * null`.
 *
 * @param {object} doc
 * @param {string} [player]
 * @returns {Array<{severity: 'error'|'warning', region: string|null, field?: string,
 *   kind: string, message: string}>}
 */
export function sidecarIssues(doc, player = DEFAULT_PLAYER_ID) {
    const p = String(player ?? DEFAULT_PLAYER_ID);
    const block = doc?.preset_sidecars?.[p];
    if (!isPlainObject(block)) return [];
    const regions = regionsOf(doc, p);
    const registrySize = substrateRegistry.getAll().length;
    const out = [];
    const notices = new Map();         // `${kind}|${substrate}|${why}` → count
    const notice = (kind, sub, why) => {
        const key = `${kind}|${sub}|${why}`;
        notices.set(key, (notices.get(key) ?? 0) + 1);
    };
    const entries = Object.entries(block);

    for (const [region, entry] of entries) {
        const docRegion = Object.prototype.hasOwnProperty.call(regions, region) ? regions[region] : null;
        const { issues, unchecked } = entryIssues(p, region, entry, docRegion, registrySize);
        out.push(...issues);
        if (unchecked.declaration) notice(K.NO_DECLARATION, entry.substrate, 'absent');
        if (unchecked.exits) notice(K.EXITS_UNCHECKED, entry.substrate, unchecked.exits);
        if (unchecked.locations) notice(K.LOCATIONS_UNCHECKED, entry.substrate, unchecked.locations);
    }

    /* ── cells ── */
    const dims = doc?.procgen_metadata?.grid_dims;
    const hasDims = isPlainObject(dims) && Number.isInteger(dims.width) && Number.isInteger(dims.height);
    const taken = new Map();
    for (const [region, entry] of entries) {
        const cell = isPlainObject(entry) ? entry.grid_cell : null;
        if (!isPlainObject(cell) || !Number.isInteger(cell.gx) || !Number.isInteger(cell.gy)) continue;
        const at = `(${cell.gx}, ${cell.gy})`;
        const key = `${cell.gx},${cell.gy}`;
        if (taken.has(key)) {
            out.push(issue(K.GRID_CELL_DUPLICATE, region, `cell ${at} is also "${taken.get(key)}"'s`,
                'grid_cell'));
        } else taken.set(key, region);
        if (hasDims && (cell.gx < 0 || cell.gy < 0 || cell.gx >= dims.width || cell.gy >= dims.height)) {
            out.push(issue(K.GRID_CELL_OUTSIDE, region, `cell ${at} is outside the `
                + `${dims.width}×${dims.height} grid \`procgen_metadata.grid_dims\` declares`, 'grid_cell'));
        }
    }

    /* ── sibling references (a descriptor's `references`) ── */
    const carriedBy = new Map();       // `${field}|${key}` → Set of values some entry carries
    const carried = (field, key) => {
        const k = `${field}|${key}`;
        if (!carriedBy.has(k)) {
            const values = new Set();
            for (const [, e] of entries) {
                const v = isPlainObject(e?.playable_payload) ? e.playable_payload[field] : undefined;
                if (isPlainObject(v) && v[key] !== undefined) values.add(v[key]);
            }
            carriedBy.set(k, values);
        }
        return carriedBy.get(k);
    };
    for (const [region, entry] of entries) {
        const reg = isPlainObject(entry) ? substrateRegistry.get(entry.substrate) : null;
        const fields = reg ? declarationOf(reg).fields : null;
        const payload = isPlainObject(entry?.playable_payload) ? entry.playable_payload : null;
        if (!fields || !payload) continue;
        for (const [field, d] of Object.entries(fields)) {
            const ref = d.references;
            if (!ref || !isPlainObject(payload[field])) continue;
            const value = payload[field][ref.key];
            if (value === undefined || carried(ref.field, ref.key).has(value)) continue;
            out.push(issue(K.REF_UNRESOLVED, region, `\`${field}\` points at ${ref.key} `
                + `${JSON.stringify(value)}, which no slot-${p} entry's \`${ref.field}\` carries`, field));
        }
    }

    /* ── the not-checked notices, one per substrate and cause ── */
    for (const [key, n] of notices) {
        const [kind, sub, why] = key.split('|');
        const regionsN = plural(n, 'region');
        let message;
        if (kind === K.NO_DECLARATION) {
            message = `\`${sub}\` declares no sidecarFields — payload shape not checked (${regionsN})`;
        } else if (kind === K.EXITS_UNCHECKED) {
            message = why === 'absent'
                ? `\`${sub}\` declares no complete exit list (\`${AP_EXIT_NAMES_SLOT}\`) — the `
                    + `document's exits not checked against its payload (${regionsN})`
                : `${regionsN} of \`${sub}\` ${n === 1 ? 'carries' : 'carry'} no exit list — the `
                    + 'document\'s exits not checked there';
        } else {
            message = why === 'absent'
                ? `\`${sub}\` declares no location carrier (\`${AP_LOCATION_NAMES_SLOT}\`) — location `
                    + `names not checked (${regionsN})`
                : `${regionsN} of \`${sub}\` ${n === 1 ? 'carries' : 'carry'} no location names — `
                    + 'not checked there';
        }
        out.push(issue(kind, null, message));
    }
    return out;
}

/**
 * ⛓ ONE ISSUE AS A SENTENCE — the bar's row and the gate's line read this (P1's
 * `describePlacementIssue` precedent), so a person who has read the wording in
 * one place has read it in the other. The block, which sits under its region,
 * prints `message` alone.
 */
export function describeSidecarIssue(i) {
    return i.region === null || i.region === undefined ? i.message : `${i.region} — ${i.message}`;
}
