/**
 * procgenCore/sidecarFieldsRegistry — **THE REAL DECLARATIONS, ASKED OF THE
 * REGISTRY** (PRESET SIDECARS slice D0).
 *
 * ⛓ The libraries are the ones the capability-matrix generator imports
 * (`REGISTRY_LIBRARIES` — derived, never a literal list here, trap 574), loaded
 * for their REGISTRATION side effect at MODULE scope: a top-level `await` is
 * module loading, which no hook timeout applies to (`regionRoundTrip.test.js`
 * measured the maze library graph outrunning vitest's 10 s hook budget).
 *
 * ⛔ THE POPULATION IS SELECTED BY THE LAW, NOT BY THE FIELD UNDER TEST: every
 * entry that declares `deserializeWorld` — i.e. every substrate the play-time
 * host can hand a `playable_payload` to — must declare `sidecarFields`. A row
 * that selected "entries with sidecarFields" would filter its own mutant out.
 *
 * ⛔ The family rows assert facts that are NOT a descriptor's defaults and would
 * not survive a copy from a neighbour (trap 1309) — `derived: true`, a claimed
 * envelope field, the level key the other zone game lacks.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { sidecarFieldsOf, sidecarPayloadErrors, validateSidecarFields } from './sidecarFields.js';
import {
    DEFAULT_REGION_GEOMETRY, REGION_GEOMETRIES, REGION_GEOMETRY, geometryOf,
} from './regionGeometry.js';
import { LIBRARY_V1_SUBSTRATES } from '../procgenPipeline/regionLibraryValidator.js';
import { EXIT_SIDES_SLOT, exitSidesOf } from './exitSides.js';
import { createRng } from '../shared/rng.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const ENTRIES = substrateRegistry.getAll();
const HOSTED = ENTRIES.filter((e) => typeof e.deserializeWorld === 'function');
const fieldsOf = (id) => sidecarFieldsOf(substrateRegistry.get(id));

describe('⛓⛓ every substrate the play-time host can load DECLARES its payload', () => {
    it('the population is the law\'s, and it is not vacuous', () => {
        expect(HOSTED.length).toBeGreaterThan(6);
        expect(HOSTED.length).toBe(ENTRIES.length);
    });

    it.each(HOSTED.map((e) => [e.id, e]))('%s declares sidecarFields, and the declaration is well '
        + 'formed', (_id, entry) => {
        expect(entry.sidecarFields, 'no sidecarFields slot').toBeDefined();
        expect(validateSidecarFields(entry.sidecarFields)).toEqual([]);
        expect(() => sidecarFieldsOf(entry)).not.toThrow();
    });
});

describe('the families — one NON-default fact each, that a neighbour\'s copy would not carry', () => {
    it('tile-grid: the maze\'s `longestShortestPath` is DERIVED (and optional — the atlas projection '
        + 'omits it), and it requires the envelope\'s `entrance`', () => {
        const f = fieldsOf('maze');
        expect(f.longestShortestPath).toMatchObject({ derived: true, required: false });
        expect(f.entrance.required).toBe(true);
    });

    /**
     * ⛓ G2a — until G2a the text adventure carried the maze's declaration OBJECT
     * (one payload shape). Now it is its own, and the tile keys are the proof:
     * every substrate-owned key of the maze's declaration is refused by name on a
     * text adventure payload — the key list READ OFF the maze's declaration,
     * never typed — and `entrance` is not required.
     */
    it('text_adventure: its declaration is its OWN object, and it refuses every tile key (read off the '
        + 'maze\'s declaration) by name; `exitGates` and `locations` are required and AUTHORED', () => {
        const ta = substrateRegistry.get('text_adventure');
        const maze = substrateRegistry.get('maze');
        expect(ta.sidecarFields).not.toBe(maze.sidecarFields);
        const f = fieldsOf('text_adventure');
        const tileKeys = Object.entries(fieldsOf('maze')).filter(([, d]) => d.owner === 'substrate').map(([k]) => k);
        expect(tileKeys).toEqual(expect.arrayContaining(['tiles', 'width', 'height']));
        const payload = { exits: [], fogEnabled: true, exitGates: {}, locations: [] };
        expect(sidecarPayloadErrors(f, payload)).toEqual([]);
        for (const k of tileKeys) {
            expect(f[k], k).toBeUndefined();
            expect(sidecarPayloadErrors(f, { ...payload, [k]: 0 }).map((e) => [e.field, e.code]), k)
                .toEqual([[k, 'UNDECLARED_FIELD']]);
        }
        expect(f.entrance.required).toBe(false);
        expect(f.exits.required).toBe(true);
        expect(f.manaEnabled.required).toBe(false);
        for (const k of ['exitGates', 'locations']) {
            expect(f[k], k).toMatchObject({ owner: 'substrate', required: true, derived: false });
        }
    });

    it('flash-zone: `ap_locations` is DERIVED, and each game requires its OWN level key', () => {
        const bounce = fieldsOf('bounce');
        const runner = fieldsOf('runner');
        expect(bounce.ap_locations.derived).toBe(true);
        expect(bounce.params.schema.required).toContain('bounceLevel');
        expect(bounce.params.schema.required).not.toContain('runnerLevel');
        expect(runner.params.schema.required).toEqual(expect.arrayContaining(['runnerLevel', 'physics']));
        expect(bounce.params.schema.required).not.toContain('physics');
        expect(bounce.gameId.enum).not.toEqual(runner.gameId.enum);
    });

    it('jta: `jtaZone` is the one required field, and it is DERIVED; `manaEnabled` stays the '
        + 'engine\'s and authored', () => {
        const f = fieldsOf('jta');
        expect(f.jtaZone).toMatchObject({ type: 'integer', required: true, derived: true });
        expect(Object.entries(f).filter(([, d]) => d.required).map(([k]) => k)).toEqual(['jtaZone']);
        expect(f.manaEnabled).toMatchObject({ owner: 'engine', derived: false, required: false });
    });

    it('omsi: CLAIMS the engine\'s `manaEnabled` (every omsi producer runs in loop mode), and '
        + '`awardSchedule` is its only authored field of its own', () => {
        const f = fieldsOf('omsi');
        expect(f.manaEnabled).toMatchObject({ owner: 'engine', required: true });
        expect(Object.entries(f).filter(([, d]) => d.owner === 'substrate' && !d.derived)
            .map(([k]) => k)).toEqual(['awardSchedule']);
    });

    it('flash_seedling: EVERY field is derived — its own and the envelope\'s `exits` — and '
        + '`atlas_ref` says it resolves to nothing', () => {
        const f = fieldsOf('flash_seedling');
        const carried = Object.entries(f).filter(([, d]) => d.owner === 'substrate' || d.required);
        expect(carried.map(([k]) => k).sort())
            .toEqual(['atlas_ref', 'atlas_region', 'atlas_sub_region', 'exits', 'gameId', 'level', 'tile_size']);
        for (const [k, d] of carried) expect(d.derived, k).toBe(true);
        expect(f.atlas_ref.description).toContain('NOTHING at runtime');
    });
});

/**
 * ⛓⛓ PRESET SIDECARS V0 — **THE TWO AP-NAME SLOTS**, over the same law's
 * population. An entry either assigns a FUNCTION to a slot or leaves it absent
 * (absent = the validity report says it did not check); nothing else is a
 * declaration. The facts asserted are the ones a neighbour's copy would not
 * carry: the Seedling entry — built by the flash factory, which assigns both —
 * REMOVES both, and jta's dataset ref names its sibling carrier.
 */
describe('⛓ V0 — `apLocationNamesOf` / `apExitNamesOf`, and the jta reference', () => {
    it.each(HOSTED.map((e) => [e.id, e]))('%s: each slot is a function or absent', (_id, entry) => {
        for (const slot of ['apLocationNamesOf', 'apExitNamesOf']) {
            expect(['function', 'undefined'], slot).toContain(typeof entry[slot]);
        }
    });

    it('the population is not vacuous: most hosted entries declare both', () => {
        const both = HOSTED.filter((e) => typeof e.apLocationNamesOf === 'function'
            && typeof e.apExitNamesOf === 'function');
        expect(both.length).toBeGreaterThan(HOSTED.length / 2);
    });

    it('flash_seedling removes BOTH of the factory\'s carriers (atlas-compiled: no ap_locations, '
        + 'teleporter doors only)', () => {
        const seedling = substrateRegistry.get('flash_seedling');
        const factory = substrateRegistry.get('flash');
        expect(typeof factory.apLocationNamesOf).toBe('function');
        expect(typeof factory.apExitNamesOf).toBe('function');
        expect(seedling.apLocationNamesOf).toBeUndefined();
        expect(seedling.apExitNamesOf).toBeUndefined();
    });

    it('jta: `jta_dataset_ref` REFERENCES the sibling carrier `jta_dataset` by `dataset_id` — the '
        + 'key `buildWarehouse` matches', () => {
        expect(fieldsOf('jta').jta_dataset_ref.references).toEqual({ field: 'jta_dataset', key: 'dataset_id' });
        const refs = HOSTED.filter((e) => Object.values(fieldsOf(e.id)).some((d) => d.references));
        expect(refs.map((e) => e.id)).toEqual(['jta']);
    });
});

/**
 * ⛓⛓ PRESET SIDECARS G0 — **`regionGeometry`: TILES OR SIDES, OR REFUSED BY
 * NAME.** Over EVERY registered entry (every one has a geometry; absent = the
 * default). The non-default fact is which entries declare `'sides'` — the two
 * zone games whose hosts label an exit by its side and read no tile.
 */
describe('⛓ G0 — the `regionGeometry` slot', () => {
    it.each(ENTRIES.map((e) => [e.id, e]))('%s: the slot is absent or one of the vocabulary', (_id, entry) => {
        expect(entry.regionGeometry === undefined || REGION_GEOMETRIES.includes(entry.regionGeometry))
            .toBe(true);
        expect(REGION_GEOMETRIES).toContain(geometryOf(entry));
    });

    it('an unknown value is REFUSED, naming the substrate and the value — never read as tiles', () => {
        expect(() => geometryOf({ id: 'fake', regionGeometry: 'hexes' }))
            .toThrow(/substrate 'fake' declares "hexes" — not one of 'tiles', 'sides'/);
        expect(() => geometryOf({ id: 'fake', regionGeometry: null })).toThrow(/'fake' declares null/);
        expect(() => geometryOf({ id: 'fake', regionGeometry: 'Sides' })).toThrow(/"Sides"/);
    });

    it('absent reads as the default — an unregistered id and an entry that does not speak alike', () => {
        expect(DEFAULT_REGION_GEOMETRY).toBe(REGION_GEOMETRY.TILES);
        expect(geometryOf(undefined)).toBe(DEFAULT_REGION_GEOMETRY);
        expect(geometryOf({ id: 'fake' })).toBe(DEFAULT_REGION_GEOMETRY);
    });

    /**
     * ⛓ G1 — the sides entries are the entries whose regions stand on NO tile:
     * the ZONE games (rules from `extractZoneRules` — a zone's own logic, never a
     * BFS over a tile grid, so an exit tile on one is fictional) and, ⛓ G2a, the
     * procedural cores that place their exits on no tile (the text adventure's
     * room: `exits_placed` carry no `tile_position`). Both sets are DERIVED —
     * the second by DRIVING every entry's own `generateRegionCore` once — never
     * typed; the law is not the field under test, so a mutant that drops or
     * adds a declaration cannot filter itself out.
     */
    it('the entries that declare sides are exactly the zone games (`extractZoneRules`) and the '
        + 'procedural cores that place no exit on a tile; every other entry reads tiles', () => {
        const sides = ENTRIES.filter((e) => geometryOf(e) === REGION_GEOMETRY.SIDES).map((e) => e.id);
        const zoneGames = ENTRIES.filter((e) => typeof e.extractZoneRules === 'function').map((e) => e.id);
        const tileFreeCores = ENTRIES.filter((e) => typeof e.generateRegionCore === 'function').filter((e) => {
            const core = e.generateRegionCore({
                region_id: 'probe', size: { width: 8, height: 6 }, entrances: [],
                exits: [{ exit_id: 'a', side: 'N', targetRegion: 'x' }, { exit_id: 'b', side: 'E', targetRegion: 'y' }],
                rng: createRng(1), params: {},
            });
            return core.exits_placed.length === 2 && core.exits_placed.every((p) => !p.tile_position);
        }).map((e) => e.id);
        expect(zoneGames.length).toBeGreaterThan(0);
        expect(tileFreeCores.length).toBeGreaterThan(0);
        expect(sides.sort()).toEqual([...zoneGames, ...tileFreeCores].sort());
        expect(geometryOf(substrateRegistry.get('maze'))).toBe(REGION_GEOMETRY.TILES);
    });
});

/**
 * ⛓⛓ PRESET SIDECARS G1 — **THE REGION-LIBRARY HAND LIST AGREES WITH THE
 * REGISTRY.** `regionLibraryValidator.LIBRARY_V1_SUBSTRATES` is NOT folded onto
 * the registry (⚖ planner, G1, option B): the validator runs where nothing is
 * registered — the maze lab's `?library=` door, the validate CLI (no runner),
 * its own tests — and a registry read there would refuse the bounce and runner
 * packs (measured). So the list stays, and THIS row makes the declarations its
 * authority: over EVERY registered entry, the list names exactly the entries
 * with the library hooks, its kind is `'procedural'` iff the entry has
 * `generateRegionCore`, and `'procedural'` (the kind that REQUIRES
 * `region_size`) iff the entry's geometry is tiles. Every population is
 * derived from the entries; the only literal is the validator's own list.
 */
describe('⛓ G1 — `LIBRARY_V1_SUBSTRATES` agrees with the registry', () => {
    const derivedKind = (entry) => {
        if (typeof entry.instantiateLibraryEntry !== 'function') return undefined;
        return typeof entry.generateRegionCore === 'function' ? 'procedural' : 'content';
    };
    const handKind = (id) => (Object.hasOwn(LIBRARY_V1_SUBSTRATES, id) ? LIBRARY_V1_SUBSTRATES[id] : undefined);

    it('the population holds a procedural member, a content member and a non-member — the rows '
        + 'below are not vacuous', () => {
        const kinds = ENTRIES.map(derivedKind);
        expect(kinds).toContain('procedural');
        expect(kinds).toContain('content');
        expect(kinds).toContain(undefined);
    });

    it('the list names exactly the entries that carry the library hooks — no more, no fewer', () => {
        const members = ENTRIES.filter((e) => derivedKind(e) !== undefined).map((e) => e.id);
        expect(Object.keys(LIBRARY_V1_SUBSTRATES).sort()).toEqual(members.sort());
    });

    it.each(ENTRIES.map((e) => [e.id, e]))('%s: the list\'s kind is the derived one, and `region_size` '
        + 'is required (procedural) iff the geometry is tiles', (id, entry) => {
        expect(handKind(id)).toBe(derivedKind(entry));
        if (derivedKind(entry) === undefined) return;
        expect(handKind(id) === 'procedural').toBe(geometryOf(entry) === REGION_GEOMETRY.TILES);
    });
});

/**
 * ⛓⛓ PRESET SIDECARS M3 — **THE `exitSides` SLOT.** ⛓ G2a re-derived its law: it
 * was "the declaring entries are exactly those whose payload DECLARATION carries
 * a side-keyed portal map (`params.sidePortals`)", which the text adventure —
 * declaring, with nothing keyed by a side — breaks. The law is now three
 * derived facts, none of them the slot under test (trap 1314): every entry whose
 * payload declares a portal map declares the slot; every declaring entry is SIDES
 * geometry; and a declaration names the portal map among its keys IFF its payload
 * declares one — each branch non-vacuous.
 */
describe('⛓ M3 — the `exitSides` slot', () => {
    const declaresPortalMap = (entry) => {
        const fields = sidecarFieldsOf(entry);
        return !!fields?.params?.schema?.properties?.sidePortals;
    };

    it.each(ENTRIES.map((e) => [e.id, e]))('%s: the slot is absent or well formed', (_id, entry) => {
        expect(exitSidesOf(entry).malformed).toBeUndefined();
    });

    it('every entry whose payload declares `params.sidePortals` declares `exitSides` — and there are some', () => {
        const portalMaps = ENTRIES.filter(declaresPortalMap);
        expect(portalMaps.length).toBeGreaterThan(0);
        for (const entry of portalMaps) expect(exitSidesOf(entry).decl, entry.id).toBeDefined();
    });

    it('every declaring entry is SIDES geometry, and names the portal map among its keys IFF its payload '
        + 'declares one — both branches populated', () => {
        const declaring = ENTRIES.filter((e) => exitSidesOf(e).decl);
        const withMap = declaring.filter(declaresPortalMap);
        const withoutMap = declaring.filter((e) => !declaresPortalMap(e));
        expect(withMap.length).toBeGreaterThan(0);
        expect(withoutMap.length).toBeGreaterThan(0);
        for (const entry of declaring) {
            expect(geometryOf(entry), entry.id).toBe(REGION_GEOMETRY.SIDES);
            expect(exitSidesOf(entry).decl.keys.includes('params.sidePortals'), entry.id).toBe(declaresPortalMap(entry));
        }
        // a declaration that keys nothing relabels nothing: its relabel is the identity, and a clone
        for (const entry of withoutMap) {
            const { decl } = exitSidesOf(entry);
            expect(decl.keys, entry.id).toEqual([]);
            const payload = { exits: [{ exit_id: 'a', side: 'N' }], nested: { side: 'N' } };
            const out = decl.relabel(payload, [{ exitId: 'a', from: 'N', to: 'S' }]);
            expect(out, entry.id).toEqual(payload);
            expect(out, entry.id).not.toBe(payload);
            expect(out.nested, entry.id).not.toBe(payload.nested);
        }
    });

    it('absent reads as ABSENT — never a default relabel', () => {
        expect(exitSidesOf(undefined)).toEqual({ absent: true });
        expect(exitSidesOf({ id: 'fake' })).toEqual({ absent: true });
        expect(exitSidesOf(substrateRegistry.get('maze'))).toEqual({ absent: true });
    });

    it('a malformed declaration is REFUSED BY NAME — the slot, the part, and what it was', () => {
        const ok = { keys: ['params.sidePortals'], relabel: (p) => p };
        expect(exitSidesOf({ [EXIT_SIDES_SLOT]: 'sidePortals' }).malformed)
            .toBe('its `exitSides` is "sidePortals", not an object');
        expect(exitSidesOf({ [EXIT_SIDES_SLOT]: null }).malformed).toMatch(/`exitSides` is null/);
        expect(exitSidesOf({ [EXIT_SIDES_SLOT]: [ok] }).malformed).toMatch(/not an object/);
        expect(exitSidesOf({ [EXIT_SIDES_SLOT]: { ...ok, relabel: 'rekey' } }).malformed)
            .toBe('its `exitSides.relabel` is string, not a function');
        expect(exitSidesOf({ [EXIT_SIDES_SLOT]: { ...ok, keys: 'params.sidePortals' } }).malformed)
            .toMatch(/^its `exitSides.keys` is "params.sidePortals", not a list/);
        // ⛓ G2a: an EMPTY list is a declaration ("nothing else is keyed by a side"), not a refusal
        const none = { keys: [], relabel: (p) => p };
        expect(exitSidesOf({ [EXIT_SIDES_SLOT]: none }).decl).toBe(none);
        expect(exitSidesOf({ [EXIT_SIDES_SLOT]: { ...ok, keys: [''] } }).malformed)
            .toMatch(/`exitSides.keys` is \[""\]/);
        expect(exitSidesOf({ [EXIT_SIDES_SLOT]: ok }).decl).toBe(ok);
    });
});
