// Region-library validator — structural invariants + content-hash identity for
// the JSON region-library format (CC/docs/plans/region-library-plan.md §2a).
// This module is the single enforcement point; the JSON Schema file
// (frontend/schema/region-library.schema.json) documents the same shape for
// editors, but the cross-reference checks here (unique entry_id, per-substrate
// capture contract, capability-vs-payload) are authoritative.
//
// A region library is the first content source that is DATA, not code: one file
// = one library of pre-built region descriptors, each addressable as
// (library_id, entry_id) and instantiable by the spiral driver as a content
// source (`library:<library_id>`). See the plan's §0a "content source"
// reframing and docs/json/developer/procgen/substrate-registry.md.
//
// Headless-safe: importable by the loader (F3), the capture path (F5), and the
// Node CLI (scripts/procgen/region-library-validate.mjs). No top-level await, no
// literal node: imports — this module is in the bundled browser graph.

export const REGION_LIBRARY_SCHEMA_VERSION = 1;

// The substrates a v1 library may carry, and each one's CAPTURE CONTRACT
// (plan §2a "two capture contracts"):
//   - 'procedural' (maze): geometry is re-derivable from the serialized world,
//     so an entry stores `payload` only and `carried_rules` MUST be null —
//     instantiation re-extracts rules (deserializeWorld + extractPathsAndObstacles),
//     which can never go stale against the geometry.
//   - 'content' (bounce): geometry cannot be re-derived, so an entry MUST carry
//     its emitted rules verbatim in `carried_rules`.
export const LIBRARY_V1_SUBSTRATES = Object.freeze({
    maze: 'procedural',
    bounce: 'content',
});

const VALID_SIDES = new Set(['N', 'E', 'S', 'W']);

// --- content-hash identity (mirrors datasetValidator.js) ---------------------
//
// library_id used to risk being a stable function of authored content, so an
// EDITED document could keep its id and silently poison the id-keyed selection
// state / caches. The identity includes a content hash:
// provenance.content_hash = FNV-1a over the canonical document (sorted-key JSON)
// minus `provenance` and minus `library_id` itself, and library_id ends with the
// 8-hex short hash. validateRegionLibrary errors on a mismatch; `--restamp`
// (the CLI) rewrites both after a deliberate hand edit. entry_id is author-chosen
// and STABLE across restamps (it is hashed content, but the author keeps it), so
// selections and provenance survive edits even as library_id churns.

export function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

export function computeLibraryContentHash(library) {
    const content = { ...library };
    delete content.provenance;
    delete content.library_id;
    return fnv1a32(stableStringify(content));
}

// Stamp (or re-stamp) the identity in place: sets provenance.content_hash and
// appends the short hash to `baseId` (defaults to the current library_id with a
// previously stamped hash suffix stripped — idempotent). Returns the library.
export function stampLibraryIdentity(library, baseId = null) {
    const hash = computeLibraryContentHash(library);
    let base = baseId ?? library.library_id ?? 'library';
    if (baseId == null) {
        const prior = library.provenance?.content_hash;
        if (typeof prior === 'string' && base.endsWith(`-${prior}`)) {
            base = base.slice(0, -(prior.length + 1));
        }
    }
    library.library_id = `${base}-${hash}`;
    if (library.provenance == null || typeof library.provenance !== 'object') {
        library.provenance = {};
    }
    library.provenance.content_hash = hash;
    return library;
}

// --- structural validation ---------------------------------------------------
//
// opts.knownSubstrates: override the substrate → kind map (default the v1 set).
// opts.entryCapabilityCheck(entry): optional substrate-aware hook (F2 wires the
//   registry's instantiate/capture adapters here) returning { errors: string[] }
//   for capability-metadata-vs-payload mismatches the pure validator can't see.
export function validateRegionLibrary(library, opts = {}) {
    const errors = [];
    const warnings = [];
    const err = (m) => errors.push(m);
    const warn = (m) => warnings.push(m);
    const kinds = opts.knownSubstrates ?? LIBRARY_V1_SUBSTRATES;
    const capCheck = typeof opts.entryCapabilityCheck === 'function' ? opts.entryCapabilityCheck : null;

    if (library == null || typeof library !== 'object' || Array.isArray(library)) {
        return { ok: false, errors: ['library is not an object'], warnings, stats: null };
    }

    // --- envelope ---
    if (library.schema_version !== REGION_LIBRARY_SCHEMA_VERSION) {
        err(`schema_version must be ${REGION_LIBRARY_SCHEMA_VERSION}, got ${JSON.stringify(library.schema_version)}`);
    }
    if (typeof library.library_id !== 'string' || library.library_id.length === 0) {
        err('library_id must be a non-empty string');
    }
    if (typeof library.name !== 'string' || library.name.length === 0) {
        err('name must be a non-empty string');
    }
    if (library.description !== undefined && typeof library.description !== 'string') {
        err('description must be a string when present');
    }
    const prov = library.provenance;
    if (prov === undefined) {
        warn('provenance missing (legacy/hand-authored) — stamp with region-library-validate.mjs --restamp');
    } else if (prov == null || typeof prov !== 'object' || Array.isArray(prov)) {
        err('provenance must be an object when present');
    } else if (prov.content_hash === undefined) {
        warn('provenance.content_hash missing — stamp with --restamp');
    } else if (typeof prov.content_hash !== 'string') {
        err('provenance.content_hash must be a string');
    } else {
        const actual = computeLibraryContentHash(library);
        if (prov.content_hash !== actual) {
            err(`provenance.content_hash ${prov.content_hash} does not match the document content (${actual}) — edited without --restamp?`);
        } else if (typeof library.library_id === 'string' && !library.library_id.endsWith(`-${actual}`)) {
            err(`library_id must end with the content-hash suffix -${actual} (got "${library.library_id}") — restamp with --restamp`);
        }
    }

    // --- entries ---
    const entries = Array.isArray(library.entries) ? library.entries : [];
    if (!Array.isArray(library.entries) || entries.length === 0) {
        err('entries must be a non-empty array');
    }
    const entryIds = new Set();
    const substrateCounts = {};
    entries.forEach((entry, i) => {
        const where = `entries[${i}]`;
        if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
            err(`${where} must be an object`);
            return;
        }
        // entry_id — unique within the file (addressing + selection key).
        if (typeof entry.entry_id !== 'string' || entry.entry_id.length === 0) {
            err(`${where}.entry_id must be a non-empty string`);
        } else if (entryIds.has(entry.entry_id)) {
            err(`duplicate entry_id "${entry.entry_id}" (${where})`);
        } else {
            entryIds.add(entry.entry_id);
        }
        if (entry.name !== undefined && typeof entry.name !== 'string') {
            err(`${where}.name must be a string when present`);
        }
        // substrate — must be a known v1 library substrate.
        const kind = kinds[entry.substrate];
        if (typeof entry.substrate !== 'string' || entry.substrate.length === 0) {
            err(`${where}.substrate must be a non-empty string`);
        } else if (kind === undefined) {
            err(`${where}.substrate "${entry.substrate}" is not a library substrate (known: ${Object.keys(kinds).join(', ')})`);
        } else {
            substrateCounts[entry.substrate] = (substrateCounts[entry.substrate] ?? 0) + 1;
        }
        // exit_sides — non-empty, valid, no duplicates.
        const sides = entry.exit_sides;
        if (!Array.isArray(sides) || sides.length === 0) {
            err(`${where}.exit_sides must be a non-empty array`);
        } else {
            const seen = new Set();
            sides.forEach((s, k) => {
                if (!VALID_SIDES.has(s)) err(`${where}.exit_sides[${k}] must be one of N/E/S/W, got ${JSON.stringify(s)}`);
                else if (seen.has(s)) err(`${where}.exit_sides has duplicate side "${s}"`);
                seen.add(s);
            });
        }
        // region_size — required for tile (procedural) substrates; validated when present.
        const size = entry.region_size;
        const sizeOk = size != null && typeof size === 'object'
            && Number.isInteger(size.width) && size.width > 0
            && Number.isInteger(size.height) && size.height > 0;
        if (size !== undefined && size !== null && !sizeOk) {
            err(`${where}.region_size must be { width>0, height>0 } integers`);
        } else if (kind === 'procedural' && !sizeOk) {
            err(`${where}.region_size is required (positive-int width/height) for the '${entry.substrate}' substrate`);
        }
        // payload — required, non-null object.
        if (entry.payload == null || typeof entry.payload !== 'object' || Array.isArray(entry.payload)) {
            err(`${where}.payload must be a non-null object (adapter.serializeWorld output)`);
        }
        // carried_rules — the two capture contracts (plan §2a).
        if (kind === 'procedural') {
            if (entry.carried_rules != null) {
                err(`${where}.carried_rules must be null for a procedural substrate ('${entry.substrate}') — rules are re-derived on instantiate`);
            }
        } else if (kind === 'content') {
            if (entry.carried_rules == null || typeof entry.carried_rules !== 'object' || Array.isArray(entry.carried_rules)) {
                err(`${where}.carried_rules must be a non-null object for a content substrate ('${entry.substrate}') — its geometry cannot be re-derived`);
            }
        }
        // location_slots — non-negative integer.
        if (!Number.isInteger(entry.location_slots) || entry.location_slots < 0) {
            err(`${where}.location_slots must be a non-negative integer`);
        }
        // Substrate-aware capability-vs-payload check (F2 wires the adapters).
        if (capCheck) {
            const res = capCheck(entry) ?? {};
            (res.errors ?? []).forEach((m) => err(`${where}: ${m}`));
            (res.warnings ?? []).forEach((m) => warn(`${where}: ${m}`));
        }
    });

    const stats = { entries: entries.length, substrates: substrateCounts };
    return { ok: errors.length === 0, errors, warnings, stats };
}
