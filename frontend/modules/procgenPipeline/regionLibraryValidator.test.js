// Unit tests for the region-library validator + content-hash identity
// (region-library-plan.md F1, gate §5.4).
import { describe, it, expect } from 'vitest';
import {
    validateRegionLibrary,
    stampLibraryIdentity,
    computeLibraryContentHash,
    REGION_LIBRARY_SCHEMA_VERSION,
} from './regionLibraryValidator.js';

// A minimal valid two-entry library (one procedural maze, one content bounce),
// stamped so identity checks pass. Deep-cloned per test so mutation is isolated.
function makeLibrary() {
    const lib = {
        schema_version: REGION_LIBRARY_SCHEMA_VERSION,
        library_id: 'demo',
        name: 'Demo Pack',
        description: 'test fixture',
        entries: [
            {
                entry_id: 'mz_cross_01',
                name: 'Crossroads',
                substrate: 'maze',
                region_size: { width: 9, height: 9 },
                exit_sides: ['N', 'E', 'S', 'W'],
                payload: { grid: [] },
                carried_rules: null,
                location_slots: 3,
            },
            {
                entry_id: 'bn_gate_01',
                substrate: 'bounce',
                exit_sides: ['E', 'W'],
                payload: { level: {}, params: { sidePortals: {} } },
                carried_rules: { exits: [], locations: [] },
                location_slots: 2,
            },
        ],
    };
    stampLibraryIdentity(lib);
    return JSON.parse(JSON.stringify(lib));
}

describe('validateRegionLibrary', () => {
    it('accepts a well-formed stamped library', () => {
        const r = validateRegionLibrary(makeLibrary());
        expect(r.errors).toEqual([]);
        expect(r.ok).toBe(true);
        expect(r.stats.entries).toBe(2);
        expect(r.stats.substrates).toEqual({ maze: 1, bounce: 1 });
    });

    it('rejects a stale library_id after an edit (no restamp)', () => {
        const lib = makeLibrary();
        lib.entries[0].location_slots = 99; // content change, id not restamped
        const r = validateRegionLibrary(lib);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /content_hash .* does not match/.test(e))).toBe(true);
    });

    it('rejects a duplicate entry_id', () => {
        const lib = makeLibrary();
        lib.entries[1].entry_id = 'mz_cross_01';
        stampLibraryIdentity(lib); // keep identity honest so only the dup fires
        const r = validateRegionLibrary(lib);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /duplicate entry_id "mz_cross_01"/.test(e))).toBe(true);
    });

    it('rejects an unknown substrate', () => {
        const lib = makeLibrary();
        lib.entries[0].substrate = 'nintendo64';
        stampLibraryIdentity(lib);
        const r = validateRegionLibrary(lib);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /substrate "nintendo64" is not a library substrate/.test(e))).toBe(true);
    });

    it('enforces the procedural capture contract (carried_rules must be null)', () => {
        const lib = makeLibrary();
        lib.entries[0].carried_rules = { exits: [] }; // maze may not carry rules
        stampLibraryIdentity(lib);
        const r = validateRegionLibrary(lib);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /carried_rules must be null for a procedural substrate/.test(e))).toBe(true);
    });

    it('enforces the content capture contract (carried_rules must be present)', () => {
        const lib = makeLibrary();
        lib.entries[1].carried_rules = null; // bounce must carry rules
        stampLibraryIdentity(lib);
        const r = validateRegionLibrary(lib);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /carried_rules must be a non-null object for a content substrate/.test(e))).toBe(true);
    });

    it('requires region_size for procedural substrates', () => {
        const lib = makeLibrary();
        delete lib.entries[0].region_size;
        stampLibraryIdentity(lib);
        const r = validateRegionLibrary(lib);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /region_size is required/.test(e))).toBe(true);
    });

    it('rejects invalid / duplicate exit sides', () => {
        const lib = makeLibrary();
        lib.entries[0].exit_sides = ['N', 'N', 'Z'];
        stampLibraryIdentity(lib);
        const r = validateRegionLibrary(lib);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /exit_sides/.test(e))).toBe(true);
    });

    it('rejects an empty entries array', () => {
        const lib = makeLibrary();
        lib.entries = [];
        stampLibraryIdentity(lib);
        const r = validateRegionLibrary(lib);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /entries must be a non-empty array/.test(e))).toBe(true);
    });

    it('invokes an injected entryCapabilityCheck and surfaces its errors', () => {
        const lib = makeLibrary();
        const r = validateRegionLibrary(lib, {
            entryCapabilityCheck: (entry) => (entry.substrate === 'bounce'
                ? { errors: ['exit_sides not present in payload sidePortals'] }
                : {}),
        });
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /exit_sides not present in payload sidePortals/.test(e))).toBe(true);
    });
});

describe('content-hash identity', () => {
    it('stamping is idempotent and produces a matching suffix', () => {
        const lib = makeLibrary();
        const id1 = lib.library_id;
        stampLibraryIdentity(lib);
        expect(lib.library_id).toBe(id1);
        expect(lib.library_id.endsWith(`-${lib.provenance.content_hash}`)).toBe(true);
        expect(computeLibraryContentHash(lib)).toBe(lib.provenance.content_hash);
    });

    it('a content edit changes the hash but a restamp keeps the base id', () => {
        const lib = makeLibrary();
        const base = lib.library_id.replace(/-[0-9a-f]{8}$/, '');
        lib.entries[0].location_slots = 7;
        stampLibraryIdentity(lib);
        expect(lib.library_id.startsWith(`${base}-`)).toBe(true);
        expect(validateRegionLibrary(lib).ok).toBe(true);
    });
});
