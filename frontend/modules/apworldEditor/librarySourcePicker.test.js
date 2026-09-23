/**
 * apworldEditor/librarySourcePicker + the library half of regionGenerationFlow
 * — **THE SERVED-PACK PICKER AND WHAT GENERATE SENDS: THE ROWS** (APWORLD
 * SUBSTRATE CHANGE R5a, plan §12). The packs are served from DISK by a fetch
 * stub that resolves the page-relative URL exactly as the browser would.
 *
 * ⛓⛓ Every expected option list is DERIVED from the pack files.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { SERVED_LIBRARY_DIR, SERVED_LIBRARY_INDEX } from '../procgenPipeline/regionLibraryLoader.js';
import {
    LIBRARY_BASE_PATH, LIBRARY_FETCH_FAILED, createServedLibraryCatalog, libraryOptionLabel,
    libraryPickerOptions, librarySourceFor, loadLibraryOptions,
} from './librarySourcePicker.js';
import {
    REGION_GENERATION_SOURCES, composeRegenerateArgs, regenerationProvenance, regionGenerationPlan,
    regionGenerationSourcesFor,
} from './regionGenerationFlow.js';
import { REGION_SOURCE_KINDS, offersLibrarySource } from './regionRegenerate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const FRONTEND = join(ROOT, 'frontend');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const FOUR = readJson(join(FRONTEND, 'presets', 'multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json'));
const INDEX = readJson(join(FRONTEND, SERVED_LIBRARY_DIR, SERVED_LIBRARY_INDEX)).libraries;
const packsFor = (substrate) => INDEX.filter((r) => r.substrates.includes(substrate))
    .map((r) => readJson(join(FRONTEND, SERVED_LIBRARY_DIR, r.file)));

/** A fetch that serves `frontend/` from disk, counting what it was asked for. */
function diskFetch() {
    const asked = [];
    const fetchImpl = async (url) => {
        asked.push(url);
        expect(url.startsWith(LIBRARY_BASE_PATH)).toBe(true);
        const body = readFileSync(join(FRONTEND, url.slice(LIBRARY_BASE_PATH.length)), 'utf8');
        return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
    };
    return { fetchImpl, asked };
}
const nLocs = (p, region) => FOUR.regions[p][region].locations.length;

describe('the served catalog', () => {
    it('⛓ fetches the index ONCE and each pack ONCE per catalog (memoised)', async () => {
        const { fetchImpl, asked } = diskFetch();
        const catalog = createServedLibraryCatalog({ fetchImpl });
        await loadLibraryOptions(catalog, FOUR, '1', 'region_1_0', 'maze');
        await loadLibraryOptions(catalog, FOUR, '1', 'region_1_1', 'maze');
        const expected = 1 + INDEX.filter((r) => r.substrates.includes('maze')).length;
        expect(asked.length).toBe(expected);
        expect(asked[0]).toBe(`${LIBRARY_BASE_PATH}${SERVED_LIBRARY_DIR}/${SERVED_LIBRARY_INDEX}`);
    });

    it('⛓ fetches ONLY the packs whose `substrates` include the target', async () => {
        const { fetchImpl, asked } = diskFetch();
        await loadLibraryOptions(createServedLibraryCatalog({ fetchImpl }), FOUR, '3', 'region_2_0', 'bounce');
        const files = asked.slice(1).map((u) => u.split('/').pop());
        expect(files).toEqual(INDEX.filter((r) => r.substrates.includes('bounce')).map((r) => r.file));
    });

    it('⛓ a fetch failure is a SENTENCE, never a throw — and the next load retries', async () => {
        let fail = true;
        const { fetchImpl: disk } = diskFetch();
        const fetchImpl = async (url) => {
            if (fail) throw new Error('offline');
            return disk(url);
        };
        const catalog = createServedLibraryCatalog({ fetchImpl });
        const res = await loadLibraryOptions(catalog, FOUR, '1', 'region_1_0', 'maze');
        expect(res.ok).toBe(false);
        expect(res.error).toContain(LIBRARY_FETCH_FAILED);
        expect(res.error).toContain('offline');
        fail = false;
        const again = await loadLibraryOptions(catalog, FOUR, '1', 'region_1_0', 'maze');
        expect(again.ok).toBe(true);
    });

    it('⛓ a 404 index is the same sentence', async () => {
        const catalog = createServedLibraryCatalog({ fetchImpl: async () => ({ ok: false, status: 404 }) });
        const res = await loadLibraryOptions(catalog, FOUR, '1', 'region_1_0', 'maze');
        expect(res.ok).toBe(false);
        expect(res.error).toContain('404');
    });
});

describe('the options', () => {
    it.each([['1', 'region_1_0', 'maze'], ['3', 'region_2_0', 'bounce'], ['3', 'region_2_0', 'runner']])(
        'slot %s %s → %s: every entry of the target\'s substrate, disabled exactly when too few slots',
        async (p, region, target) => {
            const { fetchImpl } = diskFetch();
            const res = await loadLibraryOptions(createServedLibraryCatalog({ fetchImpl }), FOUR, p, region, target);
            expect(res.ok).toBe(true);
            const expected = packsFor(target).flatMap((pack) => pack.entries
                .filter((e) => e.substrate === target)
                .map((e) => ({ value: `${pack.library_id}|${e.entry_id}`, disabled: e.location_slots < nLocs(p, region) })));
            expect(res.options.map((o) => ({ value: o.value, disabled: o.disabled }))).toEqual(expected);
            expect(expected.length).toBeGreaterThan(0);
            for (const o of res.options) {
                expect(o.source.entry.substrate).toBe(target);
                if (o.disabled) expect(o.reason).toContain('captured');
                else expect(o.reason).toBeNull();
            }
        },
    );

    it('⛓ an entry of ANOTHER substrate is never offered, even from a pack that lists it', () => {
        const mixed = { library_id: 'mixed', name: 'Mixed', entries: [...packsFor('maze')[0].entries, ...packsFor('bounce')[0].entries] };
        const opts = libraryPickerOptions(FOUR, '1', 'region_1_0', 'maze', [mixed]);
        expect(opts.length).toBe(packsFor('maze')[0].entries.length);
        expect(opts.every((o) => o.source.entry.substrate === 'maze')).toBe(true);
    });

    it('⛓ the label says name · slots · exit sides', () => {
        const e = packsFor('maze')[0].entries[0];
        expect(libraryOptionLabel(e)).toBe(`${e.name} · ${e.location_slots} slot${e.location_slots === 1 ? '' : 's'} · exit sides ${e.exit_sides.join(',')}`);
    });
});

describe('the form\'s Source row and what Generate sends', () => {
    it('⛓ Library entry is offered exactly for the targets that declare the hook', () => {
        for (const entry of substrateRegistry.getAll()) {
            const plan = regionGenerationPlan(FOUR, '1', 'region_1_0', entry.id);
            const ids = regionGenerationSourcesFor(plan).map((s) => s.id);
            expect(ids[0]).toBe(REGION_SOURCE_KINDS.GENERATE);
            expect(ids.includes(REGION_SOURCE_KINDS.LIBRARY)).toBe(offersLibrarySource(entry));
        }
        expect(REGION_GENERATION_SOURCES.map((s) => s.id)).toEqual([REGION_SOURCE_KINDS.GENERATE, REGION_SOURCE_KINDS.LIBRARY]);
    });

    it('⛓ a library Generate sends no seed, no size, no free items — the target\'s LIBRARY knobs only', () => {
        const pack = packsFor('maze')[0];
        const source = librarySourceFor(pack, pack.entries[0]);
        const bag = { ...substrateRegistry.get('maze').defaultProcgenParams, seed: 7, regionWidth: 9, mazeRequireSameWall: true };
        const args = composeRegenerateArgs(FOUR, '1', 'region_1_0', 'maze', bag, { source });
        expect(args.seed).toBeUndefined();
        expect(args.size).toBeUndefined();
        expect(args.freeItems).toBeUndefined();
        expect(args.source).toBe(source);
        expect(args.regionParams).toEqual(substrateRegistry.get('maze').buildLibraryRegionParams({ params: bag, mode: 'sphere' }));
    });

    it('⛓ the provenance carries the id pair and name, seed null — never the payload', () => {
        const pack = packsFor('bounce')[0];
        const entry = pack.entries[0];
        const args = composeRegenerateArgs(FOUR, '3', 'region_2_0', 'bounce', {}, { source: librarySourceFor(pack, entry) });
        const prov = regenerationProvenance(args, { ms: 12.4 });
        expect(prov.source).toEqual({ kind: 'library', library_id: pack.library_id, entry_id: entry.entry_id, name: entry.name });
        expect(prov.seed).toBeNull();
        expect(prov.ms).toBe(12);
        expect(JSON.stringify(prov)).not.toContain('payload');
    });
});
