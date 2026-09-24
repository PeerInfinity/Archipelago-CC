/**
 * apworldEditor/regionRegenerate — **THE LIBRARY ENTRY SOURCE: THE ROWS**
 * (APWORLD SUBSTRATE CHANGE R5a, plan §12). `regenerate-region-sidecar` with
 * `source: {kind: 'library', library_id, entry_id, entry}`, asked of the OP
 * through `applyRulesDocOp`, on the four-player fixture and
 * `procgen_topdown/AP_10`, with the three SERVED packs read from disk.
 *
 * ⛓⛓ Every count and bin is DERIVED from the documents, the packs or the
 * registry at run time; a row that asserts a guard has a driven mutant
 * recorded in the plan's §13.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { SERVED_LIBRARY_DIR, SERVED_LIBRARY_INDEX } from '../procgenPipeline/regionLibraryLoader.js';
import {
    REGENERATE_FROM_LIBRARY, REGENERATE_LIBRARY_NEEDS_HOOK, REGENERATE_LIBRARY_NO_SEED,
    REGENERATE_RULES_UNCHANGED, REGENERATE_SURPLUS_DROPPED, applyRulesDocOp, describeRegeneration,
} from './rulesDocOps.js';
import { sidecarIssues } from './sidecarIssues.js';
import {
    REGION_SOURCE_KINDS, buildDocumentRegionSpec, libraryEntryFacts, libraryExitSides, librarySourceSummary,
    offersLibrarySource, regenerateRegionEntry,
} from './regionRegenerate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PRESETS = join(ROOT, 'frontend', 'presets');
const SERVED = join(ROOT, 'frontend', SERVED_LIBRARY_DIR);
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const bytes = (o) => JSON.stringify(o);
const DOCS = {
    four: readJson(join(PRESETS, 'multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json')),
    ap10: readJson(join(PRESETS, 'procgen_topdown/AP_10/AP_10_rules.json')),
};
/** The served index and every pack it lists — read off disk, as the page would fetch them. */
const INDEX = readJson(join(SERVED, SERVED_LIBRARY_INDEX)).libraries;
const PACKS = INDEX.map((row) => readJson(join(SERVED, row.file)));
const ENTRIES = PACKS.flatMap((pack) => pack.entries.map((entry) => ({ pack, entry })));

const libSource = (pack, entry) => ({
    kind: REGION_SOURCE_KINDS.LIBRARY, library_id: pack.library_id, entry_id: entry.entry_id, entry,
});
const libOp = (p, region, pack, entry, extra = {}) => ({
    op: 'regenerate-region-sidecar', player: p, region, substrate: entry.substrate,
    source: libSource(pack, entry), ...extra,
});
const errorKeys = (doc, p) => new Set(sidecarIssues(doc, p)
    .filter((i) => i.severity === 'error').map((i) => `${i.kind}|${i.region}|${i.message ?? ''}`));
const docLocationNames = (doc, p, region) => (doc.regions[p][region].locations ?? []).map((l) => l.name);

/**
 * Every (document, slot, region, entry) pair whose region's substrate is the
 * entry's — derived. An entry whose substrate NO committed region of these
 * documents carries (measured: the runner pack) is paired with every region
 * instead: the op is then a substrate CHANGE onto that entry, the hub's flow.
 */
const REGIONS = [];
for (const [docName, doc] of Object.entries(DOCS)) {
    for (const [p, slot] of Object.entries(doc.preset_sidecars ?? {})) {
        for (const [region, sidecar] of Object.entries(slot)) {
            if (doc.regions?.[p]?.[region]) REGIONS.push({ docName, doc, p, region, substrate: sidecar.substrate });
        }
    }
}
const COMMITTED = new Set(REGIONS.map((r) => r.substrate));
const PAIRS = ENTRIES.flatMap(({ pack, entry }) => REGIONS
    .filter((r) => !COMMITTED.has(entry.substrate) || r.substrate === entry.substrate)
    .map((r) => ({ ...r, pack, entry, change: r.substrate !== entry.substrate })));

describe('which targets OFFER the library source (offersLibrarySource)', () => {
    it('⛓ is the sphere path\'s own test — the entry declares instantiateLibraryEntryForSpecs', () => {
        const all = substrateRegistry.getAll();
        const offering = all.filter((e) => offersLibrarySource(e)).map((e) => e.id).sort();
        const declared = all.filter((e) => typeof e.instantiateLibraryEntryForSpecs === 'function')
            .map((e) => e.id).sort();
        expect(offering).toEqual(declared);
        expect(offering.length).toBeGreaterThan(0);
        // ⛓ every served pack's substrates are among them (else the picker lists a pack nothing can use)
        for (const row of INDEX) for (const s of row.substrates) expect(offering).toContain(s);
    });
});

describe('every served entry × every committed region of its substrate', () => {
    it('⛓ the population covers BOTH documents and EVERY served entry (same-substrate or as a change)', () => {
        expect(new Set(PAIRS.map((x) => x.docName))).toEqual(new Set(Object.keys(DOCS)));
        for (const { entry } of ENTRIES) expect(PAIRS.some((x) => x.entry === entry)).toBe(true);
        // ⛓ a same-substrate pair exists wherever a committed region carries the substrate
        for (const { entry } of ENTRIES) {
            if (COMMITTED.has(entry.substrate)) expect(PAIRS.some((x) => x.entry === entry && !x.change)).toBe(true);
        }
    });

    it.each(PAIRS.map((x) => [`${x.docName} p${x.p} ${x.region} (${x.substrate}) ← ${x.entry.entry_id}`, x]))(
        '%s: clean (0 new errors, names kept, only the entry moved) or refused by the slot rule',
        (_, { doc, p, region, pack, entry }) => {
            const nLocs = docLocationNames(doc, p, region).length;
            const res = applyRulesDocOp(doc, libOp(p, region, pack, entry));
            if (!libraryEntryFacts(entry, nLocs).fits) {
                expect(res.ok).toBe(false);
                expect(res.error).toContain(`captured ${entry.location_slots} slot`);
                return;
            }
            expect(res.ok, res.error).toBe(true);
            expect(res.description).toContain(`${REGENERATE_FROM_LIBRARY} \`${entry.name}\` (\`${pack.library_id}\`)`);
            expect(res.description).toContain(REGENERATE_RULES_UNCHANGED);
            // 0 NEW sidecar errors in the slot
            const before = errorKeys(doc, p);
            expect([...errorKeys(res.doc, p)].filter((k) => !before.has(k))).toEqual([]);
            // names kept: the payload's AP names ⊇ the document's for the region
            const built = res.doc.preset_sidecars[p][region];
            const names = substrateRegistry.get(built.substrate).apLocationNamesOf(built.playable_payload);
            for (const n of docLocationNames(doc, p, region)) expect(names).toContain(n);
            // the deep diff is the entry's path only
            const other = structuredClone(res.doc);
            other.preset_sidecars[p][region] = doc.preset_sidecars[p][region];
            expect(bytes(other)).toBe(bytes(doc));
        },
    );

    it('⛓ the bins are DERIVED — both non-empty over the population', () => {
        const fits = PAIRS.filter((x) => libraryEntryFacts(x.entry, docLocationNames(x.doc, x.p, x.region).length).fits);
        expect(fits.length).toBeGreaterThan(0);
        expect(fits.length).toBeLessThan(PAIRS.length);
    });
});

describe('the k-th document location onto the k-th captured slot', () => {
    it('⛓ maze: the k-th slot in the hook\'s order (top-to-bottom, left-to-right) carries the k-th name', () => {
        const doc = DOCS.four;
        const p = '1';
        const region = 'region_1_0';
        const { pack, entry } = ENTRIES.find((x) => x.entry.substrate === 'maze'
            && libraryEntryFacts(x.entry, docLocationNames(doc, p, region).length).fits);
        const res = applyRulesDocOp(doc, libOp(p, region, pack, entry));
        expect(res.ok, res.error).toBe(true);
        const slots = [...entry.payload.items].sort((a, b) => (a.y - b.y) || (a.x - b.x));
        const byPos = new Map(res.doc.preset_sidecars[p][region].playable_payload.items
            .map((i) => [`${i.x},${i.y}`, i.locationName]));
        const names = docLocationNames(doc, p, region);
        names.forEach((n, k) => expect(byPos.get(`${slots[k].x},${slots[k].y}`)).toBe(n));
        // the surplus slots are DROPPED from the payload, and the description says how many
        const surplus = entry.location_slots - names.length;
        expect(byPos.size).toBe(names.length);
        if (surplus > 0) expect(res.description).toContain(`${surplus} captured slot`);
        if (surplus > 0) expect(res.description).toContain(REGENERATE_SURPLUS_DROPPED);
    });

    it('⛓ zone: the k-th captured objective\'s ap_locations entry names the k-th document location', () => {
        const doc = DOCS.four;
        const p = '3';
        const region = 'region_2_0';
        const { pack, entry } = ENTRIES.find((x) => x.entry.substrate === doc.preset_sidecars[p][region].substrate
            && libraryEntryFacts(x.entry, docLocationNames(doc, p, region).length).fits);
        // ⛓ a slot id that is NOT the document's name, so the row cannot pass by coincidence
        const renamed = structuredClone(doc);
        renamed.regions[p][region].locations.forEach((l, k) => { l.name = `${region}__doc_name_${k}`; });
        const res = applyRulesDocOp(renamed, libOp(p, region, pack, entry));
        expect(res.ok, res.error).toBe(true);
        const apl = res.doc.preset_sidecars[p][region].playable_payload.ap_locations;
        const names = docLocationNames(renamed, p, region);
        const slotIds = entry.carried_rules.locations.map((l) => l.id);
        names.forEach((n, k) => expect(apl[slotIds[k]]).toBe(n));
        expect(Object.keys(apl).length).toBe(names.length);
    });
});

describe('determinism — the record replays without the network', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it('⛓ the op applied twice is byte-identical with every fetch THROWING', () => {
        const fetchStub = vi.fn(() => { throw new Error('the served index is unreachable'); });
        vi.stubGlobal('fetch', fetchStub);
        const doc = DOCS.four;
        const { pack, entry } = ENTRIES.find((x) => x.entry.substrate === 'maze');
        const a = applyRulesDocOp(doc, libOp('1', 'region_1_0', pack, entry));
        const b = applyRulesDocOp(doc, libOp('1', 'region_1_0', pack, entry));
        expect(a.ok, a.error).toBe(true);
        expect(bytes(a.doc)).toBe(bytes(b.doc));
        expect(a.description).toBe(b.description);
        expect(fetchStub).not.toHaveBeenCalled();
    });
});

describe('the sides the hook is asked for (libraryExitSides)', () => {
    it('⛓ entrance FIRST; a full-descriptor target gets every document exit after the reserved slot', () => {
        const doc = DOCS.four;
        for (const [p, region] of [['1', 'region_1_0'], ['3', 'region_2_0']]) {
            const target = doc.preset_sidecars[p][region].substrate;
            const reg = substrateRegistry.get(target);
            const spec = buildDocumentRegionSpec(doc, p, region, { substrate: target });
            const { exitSides, sideOf, full } = libraryExitSides(spec, reg);
            expect(full).toBe(typeof reg.generateRegionCore === 'function');
            expect(sideOf.length).toBe(spec.exitSpecs.length);
            const entrance = spec.entrances[0]?.side ?? null;
            if (full) expect(exitSides).toEqual([entrance, ...sideOf]);
            else {
                expect(new Set(exitSides).size).toBe(exitSides.length);
                if (entrance && sideOf.includes(entrance)) expect(exitSides[0]).toBe(entrance);
            }
        }
    });
});

describe('refused by NAME before the hook runs', () => {
    const doc = DOCS.four;
    const { pack, entry } = ENTRIES.find((x) => x.entry.substrate === 'maze');
    const refused = (op) => {
        const res = applyRulesDocOp(doc, op);
        expect(res.ok).toBe(false);
        return res.error;
    };

    it('⛓ a target that declares no instantiateLibraryEntryForSpecs', () => {
        const without = substrateRegistry.getAll().find((e) => !offersLibrarySource(e)
            && typeof e.deserializeWorld === 'function' && typeof e.serializeWorld === 'function');
        expect(without).toBeTruthy();
        expect(refused(libOp('1', 'region_1_0', pack, entry, { substrate: without.id })))
            .toContain(REGENERATE_LIBRARY_NEEDS_HOOK);
    });

    it('⛓ an entry of another substrate than the target', () => {
        const other = ENTRIES.find((x) => x.entry.substrate !== entry.substrate).entry;
        expect(refused(libOp('1', 'region_1_0', pack, entry, { substrate: other.substrate })))
            .toContain(`is a \`${entry.substrate}\` room, and the target is \`${other.substrate}\``);
    });

    it('⛓ more document locations than the entry captured slots', () => {
        const small = { ...entry, location_slots: 0 };
        expect(refused(libOp('1', 'region_1_0', pack, small)))
            .toContain(`has ${docLocationNames(doc, '1', 'region_1_0').length} location`);
    });

    it('⛓ the entry missing, or not an object; the ids missing; an unknown kind; source not an object', () => {
        const base = libOp('1', 'region_1_0', pack, entry);
        expect(refused({ ...base, source: { ...base.source, entry: undefined } })).toContain('carries its ENTRY inline');
        expect(refused({ ...base, source: { ...base.source, entry: [entry] } })).toContain('carries its ENTRY inline');
        expect(refused({ ...base, source: { ...base.source, library_id: undefined } })).toContain('names its pack and entry');
        expect(refused({ ...base, source: { ...base.source, kind: 'atlas' } })).toContain('is not a source this op knows');
        expect(refused({ ...base, source: 'mz_cross' })).toContain('says where the region\'s data comes from');
    });

    it('⛓ a seed with a library source (the record would claim a randomness it never drew)', () => {
        expect(refused(libOp('1', 'region_1_0', pack, entry, { seed: 1 }))).toContain(REGENERATE_LIBRARY_NO_SEED);
        expect(applyRulesDocOp(doc, libOp('1', 'region_1_0', pack, entry, { seed: null })).ok).toBe(true);
    });

    it('⛓ Generate (no source) still REQUIRES its seed — the R0 law is untouched', () => {
        const res = applyRulesDocOp(doc, { op: 'regenerate-region-sidecar', player: '1', region: 'region_1_0' });
        expect(res.ok).toBe(false);
        expect(res.error).toContain('needs `seed` as a whole number');
    });
});

describe('what the record carries', () => {
    it('⛓ provenance\'s source is the id pair and the name — never the entry\'s payload', () => {
        const { pack, entry } = ENTRIES[0];
        const summary = librarySourceSummary(libSource(pack, entry));
        expect(summary).toEqual({
            kind: REGION_SOURCE_KINDS.LIBRARY, library_id: pack.library_id, entry_id: entry.entry_id, name: entry.name,
        });
        expect(bytes(summary)).not.toContain('payload');
    });

    it('⛓ the op\'s description IS describeRegeneration of the module\'s result (one sentence, two roads)', () => {
        const doc = DOCS.four;
        const { pack, entry } = ENTRIES.find((x) => x.entry.substrate === 'maze');
        const op = libOp('1', 'region_1_0', pack, entry);
        const res = regenerateRegionEntry({ doc, player: '1', region: 'region_1_0', substrate: 'maze', source: op.source });
        expect(res.ok).toBe(true);
        expect(applyRulesDocOp(doc, op).description)
            .toBe(describeRegeneration({ region: 'region_1_0', substrate: 'maze', seed: null, res }));
    });
});
