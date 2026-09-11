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
import { sidecarFieldsOf, validateSidecarFields } from './sidecarFields.js';
import {
    DEFAULT_REGION_GEOMETRY, REGION_GEOMETRIES, REGION_GEOMETRY, geometryOf,
} from './regionGeometry.js';

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
    it('tile-grid: maze and text_adventure carry ONE object, and `longestShortestPath` is DERIVED '
        + '(and optional — the atlas projection omits it)', () => {
        expect(substrateRegistry.get('text_adventure').sidecarFields)
            .toBe(substrateRegistry.get('maze').sidecarFields);
        const f = fieldsOf('maze');
        expect(f.longestShortestPath).toMatchObject({ derived: true, required: false });
        expect(f.entrance.required).toBe(true);
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
     * ⛓ G1 — the sides entries are the ZONE games: the entries whose rules come
     * from `extractZoneRules` (a zone's own logic, never a BFS over a tile
     * grid), so an exit tile on one is fictional. The expected set is DERIVED
     * from that hook, never typed — and the law is not the field under test, so
     * a mutant that drops or adds a declaration cannot filter itself out.
     */
    it('the entries that declare sides are exactly the zone games (`extractZoneRules`); every '
        + 'other entry reads tiles', () => {
        const sides = ENTRIES.filter((e) => geometryOf(e) === REGION_GEOMETRY.SIDES).map((e) => e.id);
        const zoneGames = ENTRIES.filter((e) => typeof e.extractZoneRules === 'function').map((e) => e.id);
        expect(zoneGames.length).toBeGreaterThan(0);
        expect(sides.sort()).toEqual(zoneGames.sort());
        expect(geometryOf(substrateRegistry.get('maze'))).toBe(REGION_GEOMETRY.TILES);
    });
});
