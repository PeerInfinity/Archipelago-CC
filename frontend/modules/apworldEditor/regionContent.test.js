/**
 * apworldEditor/regionContent — **THE ZONE SOURCE: THE ROWS** (APWORLD SUBSTRATE
 * CHANGE R5b, plan §12 + the ruling under it). `replace-region-content` with
 * `source: {kind: 'zone', substrate, zoneIdx, zone?}`, asked of the OP through
 * `applyRulesDocOp` and of the module, over EVERY committed document that carries a
 * zone-channel region (derived by scanning `frontend/presets/`).
 *
 * ⛓⛓ The populations are DERIVED at run time. The measured bins the plan's §14
 * quotes (which documents record their config and which do not) are pinned as
 * the oracle's expectation, so a document that starts or stops reproducing is a
 * red row, not a silent re-bin. A row that asserts a guard has a driven mutant
 * recorded in §14.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { RULES_OP_KINDS, applyRulesDocOp, canonicalPlacementIssues } from './rulesDocOps.js';
import { sidecarIssues } from './sidecarIssues.js';
import { validateRules } from './rulesUtils.js';
import { REGION_SOURCE_KINDS } from './regionRegenerate.js';
import {
    composeRegenerateArgs, defaultRegionGenerationSource, regenerateArgsRefusal, regenerationAnswer,
    regenerationProvenance, regionGenerationPlan, regionGenerationSourcesFor, zonePickerFor,
} from './regionGenerationFlow.js';
import {
    REPLACE_REGION_CONTENT_KEYS, REPLACE_REGION_CONTENT_OP, ZONE_CONFIG_HOOK, ZONE_DANGLING_REFS, ZONE_DISPLACED,
    ZONE_HELD, ZONE_HOST_CARRIED, ZONE_ITEM_GROUPS, ZONE_NEVER_CREATES, ZONE_NOT_RECORDED, ZONE_NO_CHANNEL,
    ZONE_NO_RECOVERY, ZONE_OUT_OF_RANGE, ZONE_UNPLACED_CLAUSE, applyZoneContent, describeZoneReplacement,
    installedZoneConfigFrom, replaceRegionContentFromZone, unplacedPoolItems, zoneContentFor, zoneHeldBy,
    zoneOfRegion, zoneOptions, zoneSourceFacts, zoneSourceRefusal,
} from './regionContent.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const PRESETS = join(ROOT, 'frontend', 'presets');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const bytes = (o) => JSON.stringify(o);
const clone = (o) => JSON.parse(JSON.stringify(o));
const isChannel = (id) => zoneSourceFacts(substrateRegistry.get(id)).offers;

/** ⛓ Every committed (document, slot) that carries a zone-channel region — derived. */
const DOCS = [];
for (const game of readdirSync(PRESETS)) {
    const dir = join(PRESETS, game);
    let subs = [];
    try { subs = readdirSync(dir); } catch { continue; }
    for (const sd of subs) {
        const file = join(dir, sd, `${sd}_rules.json`);
        if (!existsSync(file)) continue;
        const doc = JSON.parse(readFileSync(file, 'utf8'));
        for (const [p, slot] of Object.entries(doc.preset_sidecars ?? {})) {
            const regions = Object.entries(slot ?? {}).filter(([, e]) => e && isChannel(e.substrate))
                .map(([region, e]) => ({ region, substrate: e.substrate }));
            if (regions.length) DOCS.push({ name: `${game}/${sd}`, game, doc, p, regions });
        }
    }
}
const byGame = (g) => DOCS.find((d) => d.game === g);
const REGIONS = DOCS.flatMap((d) => d.regions.map((r) => ({ ...d, ...r, key: `${d.name} p${d.p} ${r.region}` })));

/**
 * ⛓⛓ THE ORACLE'S MEASURED BINS (plan §14.1). The pipeline-built jta documents
 * reproduce every region as its own zone byte-for-byte; `jta_randomized_test` was
 * built with a perk-shuffle seed the document does not record; `jta_substrate_test`
 * is a hand-authored fixture whose locations the zone channel never made; the
 * hand-authored `jta_mixed_test` reproduces its content and gains the
 * serialiser's envelope (`exits`, `fogEnabled`); omsi declares no read-back.
 */
const REPRODUCES = ['jta_dataset_test', 'jta_schedule_test', 'jta_locations_test', 'jta_prestige_test'];
const ENVELOPE_ONLY = ['jta_mixed_test'];
const NOT_RECORDED = ['jta_randomized_test', 'jta_substrate_test'];

/** ⛓ A document with `substrate`'s zone `z` FREED: the region holding it loses its sidecar entry. */
function freed(doc, p, substrate, z) {
    const next = clone(doc);
    const holder = zoneHeldBy(next, p, substrate, z);
    if (holder) delete next.preset_sidecars[p][holder];
    return next;
}

/** ⛓ The first zone of the slot no region holds, or null. */
function firstFreeZone(doc, p, substrate) {
    const opts = zoneOptions(doc, p, '', substrate);
    return opts.ok ? (opts.options.find((o) => !o.heldBy)?.zoneIdx ?? null) : null;
}

/** ⛓ The dotted paths two documents differ at, down to `depth` levels. */
function diffPaths(a, b, depth, path = []) {
    if (bytes(a) === bytes(b)) return [];
    const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    if (depth === 0 || !isObj(a) || !isObj(b)) return [path.join('.')];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => diffPaths(a[k], b[k], depth - 1, [...path, k]));
}

const errorsOf = (doc, p) => sidecarIssues(doc, p).filter((i) => i.severity === 'error');
const kindsOf = (doc, p) => new Set(sidecarIssues(doc, p).map((i) => i.kind));

describe('the population (derived)', () => {
    it('every committed zone-channel region is enrolled, and every bin is non-empty', () => {
        expect(REGIONS.length).toBeGreaterThan(0);
        const games = new Set(DOCS.map((d) => d.game));
        for (const g of [...REPRODUCES, ...ENVELOPE_ONLY, ...NOT_RECORDED]) expect(games.has(g), g).toBe(true);
        // ⛓ every enrolled game is in exactly one bin, or is a substrate with no read-back
        for (const d of DOCS) {
            const binned = [...REPRODUCES, ...ENVELOPE_ONLY, ...NOT_RECORDED].includes(d.game);
            const recovers = d.regions.every((r) => zoneSourceFacts(substrateRegistry.get(r.substrate)).recovers);
            expect(binned || !recovers, d.name).toBe(true);
        }
        expect(DOCS.some((d) => d.regions.some((r) => !zoneSourceFacts(substrateRegistry.get(r.substrate)).recovers)))
            .toBe(true);
    });

    it('the source is offered iff the entry declares the channel — over every registered entry', () => {
        for (const e of substrateRegistry.getAll()) {
            const facts = zoneSourceFacts(e);
            expect(facts.offers, e.id).toBe(typeof e.zoneCount === 'number' && typeof e.extractZoneRules === 'function');
            expect(facts.recovers, e.id).toBe(facts.offers && typeof e[ZONE_CONFIG_HOOK] === 'function');
            if (!facts.offers) expect(facts.why).toContain(ZONE_NO_CHANNEL);
            else if (!facts.recovers) expect(facts.why).toContain(ZONE_NO_RECOVERY);
        }
    });
});

const recovers = (r) => zoneSourceFacts(substrateRegistry.get(r.substrate)).recovers;

describe('the oracle — every committed region, as its OWN zone', () => {
    it('every region of a substrate WITHOUT a read-back is refused by name (derived: one row over all of them)', () => {
        const without = REGIONS.filter((r) => !recovers(r));
        expect(without.length).toBeGreaterThan(0);
        for (const r of without) {
            const res = replaceRegionContentFromZone({
                doc: r.doc, player: r.p, region: r.region, substrate: r.substrate, zoneIdx: 0,
            });
            expect(res.ok, r.key).toBe(false);
            expect(res.why, r.key).toContain(ZONE_NO_RECOVERY);
        }
    });

    it.each(REGIONS.filter(recovers).map((r) => [r.key, r]))('%s', (_k, r) => {
        const own = zoneOfRegion(r.doc, r.p, r.region) ?? 0;
        const before = bytes(r.doc);
        const res = replaceRegionContentFromZone({
            doc: r.doc, player: r.p, region: r.region, substrate: r.substrate, zoneIdx: own,
        });
        expect(bytes(r.doc), 'the input is never mutated').toBe(before);
        if (NOT_RECORDED.includes(r.game)) {
            expect(res.ok).toBe(false);
            expect(res.why).toContain(ZONE_NOT_RECORDED);
            // ⛓ the sentence NAMES what the document does not record
            expect(res.why).toContain('`perkShuffleSeed`');
            return;
        }
        expect(res.ok, res.why).toBe(true);
        expect(res.placementsDisplaced).toEqual([]);
        expect(res.placementsAdded).toEqual([]);
        expect(res.itemsRegistered).toEqual([]);
        if (REPRODUCES.includes(r.game)) {
            expect(bytes(res.doc), 'byte-identical document').toBe(before);
        } else {
            expect(ENVELOPE_ONLY).toContain(r.game);
            expect(diffPaths(r.doc, res.doc, 4)).toEqual([`preset_sidecars.${r.p}.${r.region}.playable_payload`]);
            const payload = res.doc.preset_sidecars[r.p][r.region].playable_payload;
            const was = r.doc.preset_sidecars[r.p][r.region].playable_payload;
            for (const [k, v] of Object.entries(was)) expect(payload[k], k).toEqual(v);
            expect(Object.keys(payload).filter((k) => !(k in was)).sort()).toEqual(['exits', 'fogEnabled']);
        }
    });

    it('the refusal names WHICH region fails and the first difference (jta_randomized_test)', () => {
        const d = byGame('jta_randomized_test');
        const res = zoneContentFor(d.doc, d.p, d.regions[0].region, 'jta', 0);
        expect(res.ok).toBe(false);
        expect(res.why).toMatch(/region "region_0_0" does not reproduce as its own zone 0 — location \d+ \("region_0_0__\d+"\): item/);
    });

    it('what the document records: the host\'s dataset, the zone locations flag, the goal zone (derived)', () => {
        for (const g of REPRODUCES) {
            const d = byGame(g);
            const rec = installedZoneConfigFrom(d.doc, d.p, 'jta');
            expect(rec.ok, g).toBe(true);
            const payloads = Object.values(d.doc.preset_sidecars[d.p]).map((e) => e.playable_payload);
            const host = payloads.find((pl) => pl.jta_dataset);
            expect(rec.cfg.datasetDoc ?? null, g).toEqual(host?.jta_dataset ?? null);
            expect(rec.cfg.emitZoneLocations, g).toBe(payloads.some((pl) => pl.ap_locations));
            const victoryAt = Object.entries(d.doc.canonical_placements[d.p]).find(([, i]) => i === 'Victory')[0];
            const region = Object.entries(d.doc.regions[d.p]).find(([, b]) => b.locations.some((l) => l.name === victoryAt))[0];
            expect(rec.cfg.goalZone, g).toBe(zoneOfRegion(d.doc, d.p, region));
            expect(rec.zoneCount, g).toBe((host?.jta_dataset ?? null) ? host.jta_dataset.zones.length
                : substrateRegistry.get('jta').zoneCount);
        }
    });
});

/** ⛓ The cascade cases: a region taking a DIFFERENT, free zone (derived per document). */
const CASES = [];
for (const g of REPRODUCES) {
    const d = byGame(g);
    const p = d.p;
    const regions = d.regions.map((r) => r.region);
    const free = firstFreeZone(d.doc, p, 'jta');
    if (free !== null) {
        for (const region of regions) CASES.push({ label: `${g} ${region} → free zone ${free}`, doc: d.doc, p, region, z: free });
    } else {
        // ⛓ every zone held (the 3-zone datasets): free the LAST region's zone on a copy
        const last = regions[regions.length - 1];
        const z = zoneOfRegion(d.doc, p, last);
        const doc = freed(d.doc, p, 'jta', z);
        for (const region of regions.slice(0, -1)) CASES.push({ label: `${g} ${region} → freed zone ${z}`, doc, p, region, z });
    }
}

describe('the cascade — a region taking another zone, every clause on the document AFTER', () => {
    it('the case list covers every reproducing document and both a vanilla and a dataset slot', () => {
        expect(new Set(CASES.map((c) => c.label.split(' ')[0]))).toEqual(new Set(REPRODUCES));
        expect(CASES.some((c) => c.doc.preset_sidecars[c.p][c.region].playable_payload.jta_dataset)).toBe(true);
    });

    it.each(CASES.map((c) => [c.label, c]))('%s', (_l, c) => {
        const { doc, p, region, z } = c;
        const before = bytes(doc);
        const res = replaceRegionContentFromZone({ doc, player: p, region, substrate: 'jta', zoneIdx: z });
        expect(res.ok, res.why).toBe(true);
        expect(bytes(doc)).toBe(before);
        const next = res.doc;
        const oldLocs = doc.regions[p][region].locations;
        const newLocs = next.regions[p][region].locations;
        const payload = next.preset_sidecars[p][region].playable_payload;
        // 1. the names are the payload's ap_locations; a new name has id null; rules are the zone's
        expect(newLocs.map((l) => l.name)).toEqual(Object.values(payload.ap_locations));
        const oldNames = new Set(oldLocs.map((l) => l.name));
        for (const l of newLocs) if (!oldNames.has(l.name)) expect(l.id).toBeNull();
        const zoneLocs = res.zone.locations;
        newLocs.forEach((l, i) => expect(l.access_rule).toEqual(zoneLocs[i].access_rule ?? { rule: 'True_' }));
        // 2. placements: every new location placed with the zone's item; items registered; pool +1 per new placement
        const cp = next.canonical_placements[p];
        newLocs.forEach((l, i) => {
            expect(cp[l.name]).toBe(zoneLocs[i].item);
            expect(l.item.name).toBe(zoneLocs[i].item);
        });
        for (const name of res.itemsRegistered) {
            expect(doc.items[p][name]).toBeUndefined();
            expect(next.items[p][name]).toEqual({
                name, id: null, classification: res.zone.itemClasses[name], groups: [...ZONE_ITEM_GROUPS],
            });
        }
        const added = {};
        for (const a of res.placementsAdded) added[a.item] = (added[a.item] ?? 0) + 1;
        const poolKeys = new Set([...Object.keys(doc.itempool_counts[p]), ...Object.keys(next.itempool_counts[p])]);
        for (const k of poolKeys) {
            expect(next.itempool_counts[p][k] ?? 0, k).toBe((doc.itempool_counts[p][k] ?? 0) + (added[k] ?? 0));
        }
        // 3. the OLD placements deleted and NAMED; their items stay in the pool, unplaced
        const oldPlaced = oldLocs.filter((l) => l.name in doc.canonical_placements[p] && !(l.name in cp))
            .map((l) => ({ location: l.name, item: doc.canonical_placements[p][l.name] }));
        expect(res.placementsDisplaced).toEqual(oldPlaced);
        expect(res.placementsDisplaced.length).toBeGreaterThan(0);
        const unplaced = {};
        for (const u of unplacedPoolItems(next, p)) unplaced[u.item] = u.unplaced;
        const displacedCount = {};
        for (const d of res.placementsDisplaced) displacedCount[d.item] = (displacedCount[d.item] ?? 0) + 1;
        expect(unplacedPoolItems(doc, p)).toEqual([]);
        expect(unplaced).toEqual(displacedCount);
        const desc = describeZoneReplacement({ region, substrate: 'jta', zoneIdx: z, res });
        for (const d of res.placementsDisplaced) expect(desc).toContain(`\`${d.item}\` at \`${d.location}\``);
        expect(desc).toContain(`${res.placementsDisplaced.length} placement`);
        expect(desc).toContain(ZONE_UNPLACED_CLAUSE);
        expect(desc).toContain(`locations ${oldLocs.length} → ${newLocs.length}`);
        // 4. exits unchanged; the entry is the zone's; grid_cell kept
        expect(payload.exits).toEqual(doc.preset_sidecars[p][region].playable_payload.exits);
        expect(next.regions[p][region].exits).toEqual(doc.regions[p][region].exits);
        expect(payload.jtaZone).toBe(z);
        expect(next.preset_sidecars[p][region].grid_cell).toEqual(doc.preset_sidecars[p][region].grid_cell);
        // 5. the validators: no NEW sidecar error, no dangling reference, 0 placement issues
        expect(errorsOf(next, p).length).toBe(errorsOf(doc, p).length);
        expect(kindsOf(next, p).has('REF_UNRESOLVED')).toBe(false);
        expect(canonicalPlacementIssues(next, p)).toEqual([]);
        expect(validateRules(next, p).filter((i) => i.severity === 'error').length)
            .toBe(validateRules(doc, p).filter((i) => i.severity === 'error').length);
        // ⛓ the deep diff = exactly the keys the op may touch, and only this slot / region
        const touched = diffPaths(doc, next, 3);
        const allowed = new Set([`regions.${p}.${region}`, `items.${p}`, `itempool_counts.${p}`,
            `canonical_placements.${p}`, `preset_sidecars.${p}.${region}`]);
        for (const t of touched) expect([...allowed].some((a) => t === a || t.startsWith(`${a}.`)), t).toBe(true);
        expect(new Set(touched.map((t) => t.split('.')[0])).size).toBeGreaterThanOrEqual(3);
        for (const t of touched) expect(REPLACE_REGION_CONTENT_KEYS).toContain(t.split('.')[0]);
    });
});

describe('the host, the held zone, the range — the refusals and the carry', () => {
    const d = byGame('jta_dataset_test');
    const hostRegion = Object.entries(d.doc.preset_sidecars[d.p]).find(([, e]) => e.playable_payload.jta_dataset)[0];

    it('the HOST region taking another zone keeps `jta_dataset`, and no sibling reference strands', () => {
        const last = d.regions[d.regions.length - 1].region;
        const z = zoneOfRegion(d.doc, d.p, last);
        const doc = freed(d.doc, d.p, 'jta', z);
        const res = replaceRegionContentFromZone({ doc, player: d.p, region: hostRegion, substrate: 'jta', zoneIdx: z });
        expect(res.ok, res.why).toBe(true);
        expect(res.hostCarried).toEqual(['jta_dataset']);
        expect(res.entry.playable_payload.jta_dataset).toEqual(doc.preset_sidecars[d.p][hostRegion].playable_payload.jta_dataset);
        expect(res.stranded).toEqual([]);
        expect(kindsOf(res.doc, d.p).has('REF_UNRESOLVED')).toBe(false);
        expect(describeZoneReplacement({ region: hostRegion, substrate: 'jta', zoneIdx: z, res }))
            .toContain(`\`jta_dataset\` ${ZONE_HOST_CARRIED}`);
        // ⛓ the control: WITHOUT the carried field the siblings strand (so the carry is load-bearing)
        const bare = clone(res.doc);
        delete bare.preset_sidecars[d.p][hostRegion].playable_payload.jta_dataset;
        expect(kindsOf(bare, d.p).has('REF_UNRESOLVED')).toBe(true);
    });

    it('a zone already held by another region is REFUSED, naming the region (and nothing is written)', () => {
        const [a, b] = d.regions.map((r) => r.region);
        const zb = zoneOfRegion(d.doc, d.p, b);
        const res = applyRulesDocOp(d.doc, {
            op: REPLACE_REGION_CONTENT_OP, player: d.p, region: a, source: { kind: 'zone', substrate: 'jta', zoneIdx: zb },
        });
        expect(res.ok).toBe(false);
        expect(res.error).toContain(`zone ${zb} of \`jta\` ${ZONE_HELD} region "${b}"`);
        expect(zoneSourceRefusal(d.doc, { player: d.p, region: a, substrate: 'jta', zoneIdx: zb })).toBe(res.error);
    });

    it('the hub\'s freeing path: the zone\'s holder RELABELLED (label only) frees it, and the read-back still holds', () => {
        const regions = d.regions.map((r) => r.region);
        const holder = regions[regions.length - 1];
        const z = zoneOfRegion(d.doc, d.p, holder);
        const doc = clone(d.doc);
        const other = substrateRegistry.getAll().find((e) => !zoneSourceFacts(e).offers).id;
        doc.preset_sidecars[d.p][holder].substrate = other;
        expect(zoneHeldBy(doc, d.p, 'jta', z)).toBeNull();
        // ⛓ the goal zone is read off the rules' perk universe, not the relabelled region's Victory
        expect(installedZoneConfigFrom(doc, d.p, 'jta').cfg.goalZone)
            .toBe(installedZoneConfigFrom(d.doc, d.p, 'jta').cfg.goalZone);
        for (const region of regions.slice(0, -1)) {
            const res = replaceRegionContentFromZone({ doc, player: d.p, region, substrate: 'jta', zoneIdx: z });
            expect(res.ok, res.why).toBe(true);
            expect(res.placementsDisplaced.length).toBeGreaterThan(0);
        }
    });

    it('a relabel that leaves the GOAL unrecorded is refused by name, never extracted with the goal dropped (trap 1415)', () => {
        const v = byGame('jta_locations_test');
        const victoryAt = Object.entries(v.doc.canonical_placements[v.p]).find(([, i]) => i === 'Victory')[0];
        const holder = v.regions.map((r) => r.region)
            .find((r) => v.doc.regions[v.p][r].locations.some((l) => l.name === victoryAt));
        const other = v.regions.map((r) => r.region).find((r) => r !== holder);
        const doc = clone(v.doc);
        doc.preset_sidecars[v.p][holder].substrate = substrateRegistry.getAll().find((e) => !zoneSourceFacts(e).offers).id;
        // ⛓ premise: the remaining region plays a free zone, so no rule names the universe
        expect(doc.regions[v.p][other].locations.some((l) => l.access_rule?.rule === 'HasFromListUnique')).toBe(false);
        const why = zoneSourceRefusal(doc, { player: v.p, region: other, substrate: 'jta', zoneIdx: 5 });
        expect(why).toContain(ZONE_NOT_RECORDED);
        expect(why).toContain('its goal zone is not recorded');
    });

    it('zoneIdx outside 0..zoneCount-1, a region without an entry, a target without the channel — each by name', () => {
        const rec = installedZoneConfigFrom(d.doc, d.p, 'jta');
        const at = (extra) => zoneSourceRefusal(d.doc, { player: d.p, region: hostRegion, substrate: 'jta', ...extra });
        expect(at({ zoneIdx: rec.zoneCount })).toContain(ZONE_OUT_OF_RANGE);
        expect(at({ zoneIdx: -1 })).toContain(ZONE_OUT_OF_RANGE);
        expect(at({ zoneIdx: 1.5 })).toContain(ZONE_OUT_OF_RANGE);
        expect(at({ zoneIdx: rec.zoneCount })).toContain(`0..${rec.zoneCount - 1}`);
        expect(zoneSourceRefusal(d.doc, { player: d.p, region: 'Nowhere', substrate: 'jta', zoneIdx: 0 }))
            .toContain(ZONE_NEVER_CREATES);
        const noChannel = substrateRegistry.getAll().find((e) => !zoneSourceFacts(e).offers).id;
        expect(at({ substrate: noChannel, zoneIdx: 0 })).toContain(ZONE_NO_CHANNEL);
    });

    it('a slot whose references name a dataset no entry carries is REFUSED (the config is not recorded)', () => {
        const doc = clone(d.doc);
        delete doc.preset_sidecars[d.p][hostRegion];
        const other = d.regions.map((r) => r.region).find((r) => r !== hostRegion);
        const why = zoneSourceRefusal(doc, { player: d.p, region: other, substrate: 'jta', zoneIdx: 0 });
        expect(why).toContain(ZONE_NOT_RECORDED);
        expect(why).toContain('no entry of the slot carries it');
    });
});

describe('the op — one record, pure on refold', () => {
    const d = byGame('jta_locations_test');
    const region = d.regions[d.regions.length - 1].region;
    const z = firstFreeZone(d.doc, d.p, 'jta');
    const op = { op: REPLACE_REGION_CONTENT_OP, player: d.p, region, source: { kind: 'zone', substrate: 'jta', zoneIdx: z } };

    it('is in the vocabulary; the RESOLVED op inlines the zone; its description is the module\'s', () => {
        expect(RULES_OP_KINDS).toContain(REPLACE_REGION_CONTENT_OP);
        const res = applyRulesDocOp(d.doc, op);
        expect(res.ok, res.error).toBe(true);
        expect(res.op.source.zone).toBeTruthy();
        const direct = replaceRegionContentFromZone({ doc: d.doc, player: d.p, region, substrate: 'jta', zoneIdx: z });
        expect(res.description).toBe(describeZoneReplacement({ region, substrate: 'jta', zoneIdx: z, res: direct }));
        expect(res.description).toContain(ZONE_DISPLACED);
    });

    it('determinism: applied twice → byte-identical; the inlined record replays pure after the install is RESET', () => {
        const a = applyRulesDocOp(d.doc, op);
        const b = applyRulesDocOp(d.doc, op);
        expect(bytes(a.doc)).toBe(bytes(b.doc));
        // ⛓ poison the module-global: a DIFFERENT config installed; the inlined record must not care
        const dsDoc = byGame('jta_dataset_test');
        const host = Object.values(dsDoc.doc.preset_sidecars[dsDoc.p]).find((e) => e.playable_payload.jta_dataset);
        substrateRegistry.get('jta').applyPipelineConfig({ datasetDoc: host.playable_payload.jta_dataset, goalZone: 0 });
        const c = applyRulesDocOp(d.doc, a.op);
        expect(bytes(c.doc)).toBe(bytes(a.doc));
        substrateRegistry.get('jta').applyPipelineConfig({});
    });

    it('the picker\'s options come from the RECORDED config and never install (zoneCount unchanged)', () => {
        const entry = substrateRegistry.get('jta');
        entry.applyPipelineConfig({});
        const count = entry.zoneCount;
        const dsDoc = byGame('jta_dataset_test');
        const r0 = dsDoc.regions[0].region;
        const opts = zoneOptions(dsDoc.doc, dsDoc.p, r0, 'jta');
        expect(entry.zoneCount).toBe(count);
        const host = Object.values(dsDoc.doc.preset_sidecars[dsDoc.p]).find((e) => e.playable_payload.jta_dataset);
        expect(opts.zoneCount).toBe(host.playable_payload.jta_dataset.zones.length);
        expect(opts.zoneCount).not.toBe(count);
        // held zones disabled and labelled with their holder (derived from the sidecars); the own zone is enabled
        for (const o of opts.options) {
            const holder = zoneHeldBy(dsDoc.doc, dsDoc.p, 'jta', o.zoneIdx, { except: r0 });
            expect(o.disabled).toBe(!!holder);
            if (holder) expect(o.label).toContain(`held by ${holder}`);
        }
        expect(opts.options.find((o) => o.own)?.zoneIdx).toBe(zoneOfRegion(dsDoc.doc, dsDoc.p, r0));
    });

    it('refuses a source that is not a zone, and the regenerate op points a zone source here', () => {
        const bad = applyRulesDocOp(d.doc, { ...op, source: { kind: 'library' } });
        expect(bad.ok).toBe(false);
        const regen = applyRulesDocOp(d.doc, {
            op: 'regenerate-region-sidecar', player: d.p, region, seed: 1, source: { kind: REGION_SOURCE_KINDS.ZONE },
        });
        expect(regen.ok).toBe(false);
        expect(regen.error).toContain(REPLACE_REGION_CONTENT_OP);
        const shape = applyRulesDocOp(d.doc, { ...op, source: { ...op.source, zone: { locations: 'x' } } });
        expect(shape.ok).toBe(false);
        expect(shape.error).toContain('source.zone');
    });

    it('a CanReachLocation elsewhere that names a removed location is NAMED (the corpus has none — a built one)', () => {
        const doc = clone(d.doc);
        const other = d.regions.find((r) => r.region !== region).region;
        const gone = doc.regions[d.p][region].locations[0].name;
        // ⛓ on an EXIT: a location rule is content the oracle verifies, so an edited one refuses the slot
        doc.regions[d.p][other].exits[0].access_rule = { rule: 'CanReachLocation', args: { location_name: gone } };
        const res = applyRulesDocOp(doc, op);
        expect(res.ok, res.error).toBe(true);
        expect(res.description).toContain(`1 \`CanReachLocation\` reference ${ZONE_DANGLING_REFS}: ${gone}`);
        // ⛓ stays as it is: the op does not repair it
        expect(res.doc.regions[d.p][other].exits[0].access_rule.args.location_name).toBe(gone);
    });

    it('unplacedPoolItems is pool minus placements, positive only', () => {
        const doc = { itempool_counts: { 1: { A: 2, B: 1, C: 0 } }, canonical_placements: { 1: { x: 'A', y: 'B' } } };
        expect(unplacedPoolItems(doc, '1')).toEqual([{ item: 'A', pool: 2, placed: 1, unplaced: 1 }]);
    });

    it('applyZoneContent with an inlined answer = the whole operation (the worker and the page agree)', () => {
        const got = zoneContentFor(d.doc, d.p, region, 'jta', z);
        const pure = applyZoneContent({ doc: d.doc, player: d.p, region, substrate: 'jta', zoneIdx: z, zone: got.zone });
        const whole = replaceRegionContentFromZone({ doc: d.doc, player: d.p, region, substrate: 'jta', zoneIdx: z });
        expect(bytes(pure.doc)).toBe(bytes(whole.doc));
    });
});

describe('the form — the Source row, the picker, what Generate sends (R5b)', () => {
    const d = byGame('jta_dataset_test');
    const [r0] = d.regions.map((r) => r.region);

    it('Zone N is offered exactly for the targets that can read their config back — over every registered entry', () => {
        for (const e of substrateRegistry.getAll()) {
            const plan = regionGenerationPlan(d.doc, d.p, r0, e.id);
            const ids = regionGenerationSourcesFor(plan).map((x) => x.id);
            expect(ids.includes(REGION_SOURCE_KINDS.ZONE), e.id).toBe(zoneSourceFacts(e).recovers);
        }
        // ⛓ the form OPENS on the zone for a target that has no realiser but offers it
        const jta = regionGenerationPlan(d.doc, d.p, r0, 'jta');
        expect(jta.refusal).toBeTruthy();
        expect(defaultRegionGenerationSource(jta)).toBe(REGION_SOURCE_KINDS.ZONE);
        const maze = regionGenerationPlan(d.doc, d.p, r0, 'maze');
        expect(defaultRegionGenerationSource(maze)).toBe(REGION_SOURCE_KINDS.GENERATE);
    });

    it('the picker: every zone held by ANOTHER region disabled; with all held but the own, the own is selected', () => {
        const picker = zonePickerFor(d.doc, d.p, r0, 'jta');
        expect(picker.status).toBe('ready');
        const held = picker.options.filter((o) => o.disabled).map((o) => o.zoneIdx);
        expect(held).toEqual(picker.options.filter((o) => zoneHeldBy(d.doc, d.p, 'jta', o.zoneIdx, { except: r0 }))
            .map((o) => o.zoneIdx));
        expect(picker.selected).toBe(zoneOfRegion(d.doc, d.p, r0));
        // ⛓ a vanilla slot with free zones selects the first free zone that is not its own
        const v = byGame('jta_locations_test');
        const vr = v.regions[0].region;
        const vp = zonePickerFor(v.doc, v.p, vr, 'jta');
        expect(vp.selected).toBe(vp.options.find((o) => !o.disabled && !o.own).zoneIdx);
        // ⛓ a target with no read-back: the picker is its refusal
        expect(zonePickerFor(d.doc, d.p, r0, 'omsi')).toMatchObject({ status: 'refused', options: [] });
    });

    it('Generate sends no seed, no size, no params; the refusal is the op\'s; the provenance names the zone', () => {
        const args = composeRegenerateArgs(d.doc, d.p, r0, 'jta', { seed: 7 }, { source: { kind: 'zone', zoneIdx: 1 } });
        expect(args.seed).toBeUndefined();
        expect(args.size).toBeUndefined();
        expect(args.regionParams).toBeUndefined();
        expect(args.source).toEqual({ kind: 'zone', zoneIdx: 1, substrate: 'jta' });
        const held = zoneHeldBy(d.doc, d.p, 'jta', 1, { except: r0 });
        expect(regenerateArgsRefusal(args)).toBe(zoneSourceRefusal(d.doc, { player: d.p, region: r0, substrate: 'jta', zoneIdx: 1 }));
        expect(regenerateArgsRefusal(args)).toContain(held);
        const prov = regenerationProvenance(args, { ms: 12.4, verified: ['a'] });
        expect(prov).toEqual({ op: REPLACE_REGION_CONTENT_OP, substrate: 'jta', zoneIdx: 1, verified: ['a'], ms: 12 });
        expect(regenerationAnswer(args, { ok: false, refused: true, threw: 'apworld: x' }, 60)).toEqual({ landed: false, text: 'apworld: x' });
        expect(regenerationAnswer(args, { ok: true }, 60).landed).toBe(true);
    });
});
