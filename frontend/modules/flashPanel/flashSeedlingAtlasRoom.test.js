/**
 * flash_seedling — **THE HUB'S ATLAS-ROOM SOURCE** (APWORLD SUBSTRATE CHANGE R5c,
 * plan §12's R5c row and §15). `flash_seedling` declares the zone read-back pair
 * the hub's `replace-region-content` rides (`apworldEditor/regionContent.js`):
 * `zoneConfigFromSlot({entries, locations, blocks, fetched})` → the atlas the
 * document's rooms were placed from (fetched through the served index when it is
 * not the bundled starter), and `zoneOfPayload(payload, cfg)` → a room's ordinal.
 *
 * ⛓⛓ The populations are DERIVED from `frontend/presets/`. The oracle's bins
 * (which documents reproduce and which are the atlas compiler's projection) are
 * pinned, so a document that starts or stops reproducing is a red row. Every
 * guard row has a driven mutant recorded in §15.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { applyRulesDocOp, canonicalPlacementIssues } from '../apworldEditor/rulesDocOps.js';
import { sidecarIssues } from '../apworldEditor/sidecarIssues.js';
import {
    REPLACE_REGION_CONTENT_OP, ZONE_FETCH_FAILED, ZONE_HELD, ZONE_NEEDS_FETCH, ZONE_NOT_RECORDED,
    ZONE_SOURCE_LABEL_DEFAULT, applyZoneContent, installedZoneConfigFrom, replaceRegionContentFromZone,
    resolveZoneFetches, zoneHeldBy, zoneJobAnswer, zoneOfRegion, zoneOptions, zoneSourceFacts,
} from '../apworldEditor/regionContent.js';
import { regionGenerationPlan, regionGenerationSourcesFor, zonePickerFor } from '../apworldEditor/regionGenerationFlow.js';
import { REGION_SOURCE_KINDS } from '../apworldEditor/regionRegenerate.js';
import {
    FLASH_SEEDLING_DOORLESS_REASON, FLASH_SEEDLING_SUBSTRATE_ID, FLASH_SEEDLING_ZONE_SOURCE_LABEL,
    SEEDLING_STARTER_ATLAS, buildSeedlingContentSource, substrateRegistryEntry as SEEDLING,
} from './flashSeedlingLibrary.js';
import { ATLAS_DIR, atlasIndexPath } from './mapDocumentPath.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const FRONTEND = join(ROOT, 'frontend');
const PRESETS = join(FRONTEND, 'presets');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const S = FLASH_SEEDLING_SUBSTRATE_ID;
const bytes = (o) => JSON.stringify(o);
const clone = (o) => JSON.parse(JSON.stringify(o));
/** ⛓ The served document at `path` (from `frontend/`), read off disk — the fetch's node twin. */
const diskFetch = async (path) => JSON.parse(readFileSync(join(FRONTEND, path), 'utf8'));
const errorsOf = (doc, p) => sidecarIssues(doc, p).filter((i) => i.severity === 'error');

/** ⛓ Every committed (document, slot) carrying a `flash_seedling` region — derived. */
const DOCS = [];
for (const game of readdirSync(PRESETS)) {
    let subs = [];
    try { subs = readdirSync(join(PRESETS, game)); } catch { continue; }
    for (const sd of subs) {
        const file = join(PRESETS, game, sd, `${sd}_rules.json`);
        if (!existsSync(file)) continue;
        const doc = JSON.parse(readFileSync(file, 'utf8'));
        for (const [p, slot] of Object.entries(doc.preset_sidecars ?? {})) {
            const regions = Object.entries(slot ?? {}).filter(([, e]) => e?.substrate === S).map(([r]) => r);
            if (regions.length) DOCS.push({ game, doc, p, regions });
        }
    }
}
const byGame = (g) => DOCS.find((d) => d.game === g);

/**
 * ⛓⛓ THE ORACLE'S MEASURED BINS (plan §15.1). The two content-source documents
 * (T2's spiral, T3's sphere leaf) reproduce every room byte-for-byte; the atlas
 * COMPILER's projections (`seedling_atlas`, `seedling_playthrough`) never went
 * through the content source — their exits are the level's own transitions — and
 * refuse by name.
 */
const REPRODUCES = ['seedling_spiral_room', 'seedling_sphere_room'];
const PROJECTION = ['seedling_atlas', 'seedling_playthrough'];

/** ⛓ The sphere room with a MAZE leaf relabelled to `flash_seedling` (D1's picker: the label only). */
function sphereWithRelabelledLeaf() {
    const d = byGame('seedling_sphere_room');
    const doc = clone(d.doc);
    const leaf = Object.entries(doc.preset_sidecars[d.p])
        .find(([, e]) => e.substrate === 'maze' && e.playable_payload.exits.length === 1)[0];
    doc.preset_sidecars[d.p][leaf].substrate = S;
    return { doc, p: d.p, leaf, room: d.regions[0] };
}

describe('the population (derived)', () => {
    it('every committed flash_seedling document is in exactly one bin, and every bin is present', () => {
        expect(DOCS.map((d) => d.game).sort()).toEqual([...REPRODUCES, ...PROJECTION].sort());
    });

    it('⛓ the law: every entry declaring `zoneConfigFromSlot` also declares `zoneOfPayload` (over the registry)', () => {
        const declarers = substrateRegistry.getAll().filter((e) => typeof e.zoneConfigFromSlot === 'function');
        expect(declarers.map((e) => e.id)).toContain(S);
        for (const e of declarers) expect(typeof e.zoneOfPayload, e.id).toBe('function');
    });

    it('flash_seedling offers AND recovers; its Source-row word is its own', () => {
        expect(zoneSourceFacts(SEEDLING)).toEqual({ offers: true, recovers: true, why: null });
        expect(SEEDLING.zoneSourceLabel).toBe(FLASH_SEEDLING_ZONE_SOURCE_LABEL);
    });
});

describe('the oracle — every committed room, as its OWN room', () => {
    it.each(DOCS.map((d) => [d.game, d]))('%s', async (_g, d) => {
        const f = await resolveZoneFetches(d.doc, d.p, S, diskFetch);
        expect(f.ok, f.why).toBe(true);
        const rec = installedZoneConfigFrom(d.doc, d.p, S, { fetched: f.fetched });
        const before = bytes(d.doc);
        if (PROJECTION.includes(d.game)) {
            expect(rec.ok).toBe(false);
            // ⛓ the sentence NAMES the first region and what makes it a projection
            expect(rec.why).toContain(ZONE_NOT_RECORDED);
            // (a doorless region has no exit to bind; the first region WITH exits is named)
            const named = d.regions.find((r) => d.doc.preset_sidecars[d.p][r].playable_payload.exits.length > 0);
            expect(rec.why).toContain(`region "${named}" is the region atlas COMPILER's projection`);
            // ⛓ refused BEFORE any fetch: the projection check needs no atlas
            expect(f.fetched).toEqual({});
            for (const region of d.regions) {
                const res = replaceRegionContentFromZone({ doc: d.doc, player: d.p, region, substrate: S, zoneIdx: 0 });
                expect(res.ok, region).toBe(false);
                expect(res.why).toBe(rec.why);
            }
            return;
        }
        expect(REPRODUCES).toContain(d.game);
        expect(rec.ok, rec.why).toBe(true);
        const cfg = { ...rec.cfg, ...rec.assumed };
        for (const region of d.regions) {
            const own = zoneOfRegion(d.doc, d.p, region, { cfg });
            expect(Number.isInteger(own), region).toBe(true);
            const res = replaceRegionContentFromZone({ doc: d.doc, player: d.p, region, substrate: S, zoneIdx: own });
            expect(res.ok, res.why).toBe(true);
            expect(res.verified).toEqual(d.regions);
            expect(bytes(res.doc), 'byte-identical document').toBe(before);
            expect(res.placementsDisplaced).toEqual([]);
            expect(res.placementsAdded).toEqual([]);
        }
        expect(bytes(d.doc), 'the input is never mutated').toBe(before);
    });

    it('what the document records: the starter atlas by id (no fetch), its rooms by name, the doorless ones with the reason', () => {
        const source = buildSeedlingContentSource(SEEDLING_STARTER_ATLAS);
        for (const g of REPRODUCES) {
            const d = byGame(g);
            expect(d.doc.region_atlas.atlas_id).toBe(SEEDLING_STARTER_ATLAS.atlas_id);
            const rec = installedZoneConfigFrom(d.doc, d.p, S);
            expect(rec.ok, rec.why).toBe(true);
            expect(rec.cfg.atlasDoc).toBe(SEEDLING_STARTER_ATLAS);
            expect(rec.assumed).toEqual({});
            expect(rec.zoneCount).toBe(source.zones.length);
            expect(rec.zoneNames).toEqual(source.zones.map((z) => z.apName));
            expect(rec.unplaceable).toEqual(source.doorless.map((name) => ({ name, why: FLASH_SEEDLING_DOORLESS_REASON })));
        }
    });

    it('zoneOfPayload: a placed room\'s ordinal is its index in the atlas, by room; null without the config or for another atlas', () => {
        const source = buildSeedlingContentSource(SEEDLING_STARTER_ATLAS);
        const cfg = { atlasDoc: SEEDLING_STARTER_ATLAS };
        for (const g of REPRODUCES) {
            const d = byGame(g);
            for (const region of d.regions) {
                const pl = d.doc.preset_sidecars[d.p][region].playable_payload;
                const z = SEEDLING.zoneOfPayload(pl, cfg);
                expect(source.zones[z].payload.atlas_region).toBe(pl.atlas_region);
                expect(source.zones[z].payload.atlas_sub_region ?? null).toBe(pl.atlas_sub_region ?? null);
                expect(SEEDLING.zoneOfPayload(pl)).toBeNull();
                expect(SEEDLING.zoneOfPayload({ ...pl, atlas_ref: 'seedling-00000000' }, cfg)).toBeNull();
            }
        }
    });
});

describe('the read-back refuses by name', () => {
    const d = byGame('seedling_spiral_room');
    const region = d.regions[0];

    it.each(Object.keys(SEEDLING.rulesJsonBlocks()).map((k) => [k]))('a document without its `%s` block', (key) => {
        const doc = clone(d.doc);
        delete doc[key];
        const rec = installedZoneConfigFrom(doc, d.p, S);
        expect(rec.ok).toBe(false);
        expect(rec.why).toContain(`carries no \`${key}\` block`);
    });

    it('a room of ANOTHER atlas than the document names', () => {
        const doc = clone(d.doc);
        doc.preset_sidecars[d.p][region].playable_payload.atlas_ref = 'seedling-ae833c1e';
        const rec = installedZoneConfigFrom(doc, d.p, S);
        expect(rec.ok).toBe(false);
        expect(rec.why).toContain(`region "${region}" plays a room of atlas \`seedling-ae833c1e\``);
        expect(rec.why).toContain(`names \`${SEEDLING_STARTER_ATLAS.atlas_id}\``);
    });

    it('a region whose room lacks the doors its sides need — the channel\'s own sentence, nothing written', () => {
        const cfg = { atlasDoc: SEEDLING_STARTER_ATLAS };
        const one = buildSeedlingContentSource(SEEDLING_STARTER_ATLAS).zones.findIndex((z) => z.payload.exits.length === 1);
        expect(d.doc.preset_sidecars[d.p][region].playable_payload.exits.length).toBeGreaterThan(1);
        expect(zoneHeldBy(d.doc, d.p, S, one, { except: region, cfg })).toBeNull();
        const res = replaceRegionContentFromZone({ doc: d.doc, player: d.p, region, substrate: S, zoneIdx: one });
        expect(res.ok).toBe(false);
        expect(res.why).toContain('A real room has the doors it has');
    });
});

/** ⛓ A document naming the PLAYTHROUGH atlas (a fetched one), whose only room region is a relabelled maze leaf. */
function fetchedAtlasDoc() {
    const s = sphereWithRelabelledLeaf();
    const pt = JSON.parse(readFileSync(join(FRONTEND, `${ATLAS_DIR}seedling-playthrough.json`), 'utf8'));
    s.doc.region_atlas = { ...s.doc.region_atlas, atlas_id: pt.atlas_id };
    // the starter room's region goes back to a label its atlas does not contradict
    s.doc.preset_sidecars[s.p][s.room].substrate = 'maze';
    return { ...s, atlasId: pt.atlas_id, atlasPath: `${ATLAS_DIR}seedling-playthrough.json` };
}

describe('the atlas intake — a FETCH, resolved through the served index', () => {
    it('asks for the index, then the atlas; picks the rooms of the FETCHED atlas', async () => {
        const f = fetchedAtlasDoc();
        const first = installedZoneConfigFrom(f.doc, f.p, S);
        expect(first).toMatchObject({ ok: false, needs: [atlasIndexPath()] });
        expect(first.why).toContain(ZONE_NEEDS_FETCH);
        const asked = [];
        const got = await resolveZoneFetches(f.doc, f.p, S, (path) => { asked.push(path); return diskFetch(path); });
        expect(got.ok, got.why).toBe(true);
        expect(asked).toEqual([atlasIndexPath(), f.atlasPath]);
        const opts = zoneOptions(f.doc, f.p, f.leaf, S, { fetched: got.fetched });
        const src = buildSeedlingContentSource(got.fetched[f.atlasPath]);
        expect(opts.zoneCount).toBe(src.zones.length);
        expect(opts.options.filter((o) => o.zoneIdx !== null).map((o) => o.name)).toEqual(src.zones.map((z) => z.apName));
        expect(opts.options.filter((o) => o.unplaceable).map((o) => o.name)).toEqual(src.doorless);
    });

    it('an id the index does not list — refused, naming the index', async () => {
        const f = fetchedAtlasDoc();
        f.doc.region_atlas.atlas_id = 'seedling-00000000';
        const got = await resolveZoneFetches(f.doc, f.p, S, diskFetch);
        expect(got.ok).toBe(true);
        const rec = installedZoneConfigFrom(f.doc, f.p, S, { fetched: got.fetched });
        expect(rec.ok).toBe(false);
        expect(rec.why).toContain(`the atlas index \`${atlasIndexPath()}\` lists no atlas \`seedling-00000000\``);
    });

    it('the worker job: success — the fetched atlas installed, ONE room extracted, the answer inlinable', async () => {
        const f = fetchedAtlasDoc();
        const got = await resolveZoneFetches(f.doc, f.p, S, diskFetch);
        const src = buildSeedlingContentSource(got.fetched[f.atlasPath]);
        // ⛓ a room with a location (a surplus door is pruned with a note — the leaf has one side)
        const z = src.zones.findIndex((room) => room.locations.length > 0);
        expect(z).toBeGreaterThanOrEqual(0);
        const ans = await zoneJobAnswer({ doc: f.doc, player: f.p, region: f.leaf, substrate: S, source: { kind: 'zone', zoneIdx: z } },
            { fetchJson: diskFetch });
        expect(ans.ok, ans.threw).toBe(true);
        expect(ans.entry.playable_payload.atlas_ref).toBe(f.atlasId);
        expect(ans.entry.playable_payload.atlas_region).toBe(src.zones[z].payload.atlas_region);
        expect(ans.next.locations.map((l) => l.name)).toEqual(src.zones[z].locations.map((l) => l.name));
        // ⛓ the inlined answer applies PURE: no fetch, no install (the config is unreadable without one)
        SEEDLING.applyPipelineConfig({});
        const op = { op: REPLACE_REGION_CONTENT_OP, player: f.p, region: f.leaf, source: { kind: 'zone', substrate: S, zoneIdx: z, zone: ans.zone } };
        const res = applyRulesDocOp(f.doc, op);
        expect(res.ok, res.error).toBe(true);
        expect(res.doc.preset_sidecars[f.p][f.leaf]).toEqual(ans.entry);
    });

    it('the worker job: a 404 — refused, naming the path, nothing extracted', async () => {
        const f = fetchedAtlasDoc();
        const ans = await zoneJobAnswer({ doc: f.doc, player: f.p, region: f.leaf, substrate: S, source: { kind: 'zone', zoneIdx: 0 } },
            { fetchJson: async (path) => { if (path === f.atlasPath) throw new Error('HTTP 404'); return diskFetch(path); } });
        expect(ans).toMatchObject({ ok: false, refused: true });
        expect(ans.threw).toContain(`\`${f.atlasPath}\`, which ${ZONE_FETCH_FAILED} (HTTP 404)`);
    });

    it('the worker job: the fetched atlas is ANOTHER id — refused (a stale index, a restamp)', async () => {
        const f = fetchedAtlasDoc();
        const ans = await zoneJobAnswer({ doc: f.doc, player: f.p, region: f.leaf, substrate: S, source: { kind: 'zone', zoneIdx: 0 } },
            { fetchJson: async (path) => (path === f.atlasPath ? clone(SEEDLING_STARTER_ATLAS) : diskFetch(path)) });
        expect(ans).toMatchObject({ ok: false, refused: true });
        expect(ans.threw).toContain(`the served atlas \`${f.atlasPath}\` is \`${SEEDLING_STARTER_ATLAS.atlas_id}\`, not the \`${f.atlasId}\``);
    });
});

describe('the cascade — a region taking another room (the starter atlas)', () => {
    const d = byGame('seedling_sphere_room');
    const region = d.regions[0];
    const cfg = { atlasDoc: SEEDLING_STARTER_ATLAS };
    const source = buildSeedlingContentSource(SEEDLING_STARTER_ATLAS);
    const own = zoneOfRegion(d.doc, d.p, region, { cfg });
    const other = source.zones.findIndex((z, i) => i !== own && z.payload.exits.length === 1 && z.locations.length > 0);

    it('ONE op: the room\'s locations and items land, the doors bind to the region\'s sides, 0 new errors; replay is pure', () => {
        expect(other).toBeGreaterThanOrEqual(0);
        const room = source.zones[other];
        const op = { op: REPLACE_REGION_CONTENT_OP, player: d.p, region, source: { kind: 'zone', substrate: S, zoneIdx: other } };
        const res = applyRulesDocOp(d.doc, op);
        expect(res.ok, res.error).toBe(true);
        const next = res.doc;
        const locs = next.regions[d.p][region].locations;
        expect(locs.map((l) => l.name)).toEqual(room.locations.map((l) => l.name));
        for (const l of room.locations) {
            expect(next.canonical_placements[d.p][l.name]).toBe(l.item.name);
            expect(next.items[d.p][l.item.name]).toBeTruthy();
            expect(next.itempool_counts[d.p][l.item.name]).toBe((d.doc.itempool_counts[d.p][l.item.name] ?? 0) + 1);
        }
        const payload = next.preset_sidecars[d.p][region].playable_payload;
        expect(payload.atlas_region).toBe(room.payload.atlas_region);
        const was = d.doc.preset_sidecars[d.p][region].playable_payload.exits;
        expect(payload.exits.map((x) => [x.side, x.exitName, x.targetRegion, x.target_substrate]))
            .toEqual(was.map((x) => [x.side, x.exitName, x.targetRegion, x.target_substrate]));
        expect(payload.exits.map((x) => x.exit_id)).toEqual(room.payload.exits.map((x) => x.exit_id));
        expect(next.regions[d.p][region].exits).toEqual(d.doc.regions[d.p][region].exits);
        expect(errorsOf(next, d.p).length).toBe(errorsOf(d.doc, d.p).length);
        expect(canonicalPlacementIssues(next, d.p)).toEqual([]);
        expect(res.description).toContain(`content replaced by zone ${other} of \`${S}\``);
        // ⛓ the RESOLVED op inlines the answer; a replay after installing ANOTHER atlas is byte-identical
        expect(res.op.source.zone).toBeTruthy();
        const pt = JSON.parse(readFileSync(join(FRONTEND, `${ATLAS_DIR}seedling-playthrough.json`), 'utf8'));
        SEEDLING.applyPipelineConfig({ atlasDoc: pt });
        try {
            expect(bytes(applyRulesDocOp(d.doc, res.op).doc)).toBe(bytes(next));
        } finally {
            SEEDLING.applyPipelineConfig({});
        }
    });

    it('a room HELD by another region is refused, naming the holder', () => {
        const s = sphereWithRelabelledLeaf();
        const res = replaceRegionContentFromZone({ doc: s.doc, player: s.p, region: s.leaf, substrate: S, zoneIdx: own });
        expect(res.ok).toBe(false);
        expect(res.why).toContain(`${ZONE_HELD} region "${s.room}"`);
    });

    it('a relabelled maze leaf takes a free room: its placements displaced and named', () => {
        const s = sphereWithRelabelledLeaf();
        const res = replaceRegionContentFromZone({ doc: s.doc, player: s.p, region: s.leaf, substrate: S, zoneIdx: other });
        expect(res.ok, res.why).toBe(true);
        const old = s.doc.regions[s.p][s.leaf].locations.map((l) => l.name);
        expect(res.placementsDisplaced.map((x) => x.location)).toEqual(old.filter((n) => n in s.doc.canonical_placements[s.p]));
        expect(res.placementsDisplaced.length).toBeGreaterThan(0);
        expect(res.doc.preset_sidecars[s.p][s.leaf].playable_payload.exits[0].target_substrate)
            .toBe(s.doc.preset_sidecars[s.p][s.doc.preset_sidecars[s.p][s.leaf].playable_payload.exits[0].targetRegion]?.substrate ?? null);
    });
});

describe('the form (R5c): the Source row\'s word, the picker by room', () => {
    const d = byGame('seedling_spiral_room');
    const region = d.regions[0];

    it('flash_seedling offers *Atlas room*; jta keeps *Zone N*; a maze target offers no room source', () => {
        const seedling = regionGenerationSourcesFor(regionGenerationPlan(d.doc, d.p, region, S));
        expect(seedling.find((x) => x.id === REGION_SOURCE_KINDS.ZONE)?.label).toBe(FLASH_SEEDLING_ZONE_SOURCE_LABEL);
        const jta = regionGenerationSourcesFor(regionGenerationPlan(d.doc, d.p, region, 'jta'));
        expect(jta.find((x) => x.id === REGION_SOURCE_KINDS.ZONE)?.label).toBe(ZONE_SOURCE_LABEL_DEFAULT);
        const maze = regionGenerationSourcesFor(regionGenerationPlan(d.doc, d.p, region, 'maze'));
        expect(maze.some((x) => x.id === REGION_SOURCE_KINDS.ZONE)).toBe(false);
    });

    it('the picker lists the placeable rooms by name (own marked), then the doorless ones disabled with the reason', () => {
        const source = buildSeedlingContentSource(SEEDLING_STARTER_ATLAS);
        const picker = zonePickerFor(d.doc, d.p, region, S);
        expect(picker.status).toBe('ready');
        const rooms = picker.options.filter((o) => o.zoneIdx !== null);
        expect(rooms.map((o) => o.name)).toEqual(source.zones.map((z) => z.apName));
        const own = zoneOfRegion(d.doc, d.p, region, { cfg: { atlasDoc: SEEDLING_STARTER_ATLAS } });
        expect(rooms[own].own).toBe(true);
        expect(rooms[own].label).toContain('(this region\'s own)');
        const doorless = picker.options.filter((o) => o.zoneIdx === null);
        expect(doorless.map((o) => o.name)).toEqual(source.doorless);
        for (const o of doorless) {
            expect(o.disabled).toBe(true);
            expect(o.label).toBe(`${o.name} — ${FLASH_SEEDLING_DOORLESS_REASON}`);
        }
        expect(picker.options.find((o) => o.zoneIdx === picker.selected)?.disabled).toBe(false);
    });

    it('a read-back that needs a fetch is the picker\'s `needs` state (the page fetches, then asks again)', () => {
        const f = fetchedAtlasDoc();
        expect(zonePickerFor(f.doc, f.p, f.leaf, S)).toMatchObject({ status: 'needs', needs: [atlasIndexPath()] });
    });
});

describe('jta is untouched by the contract change', () => {
    const JTA = [];
    for (const game of readdirSync(PRESETS).filter((g) => g.startsWith('jta_'))) {
        for (const sd of readdirSync(join(PRESETS, game))) {
            const file = join(PRESETS, game, sd, `${sd}_rules.json`);
            if (existsSync(file)) JTA.push([game, JSON.parse(readFileSync(file, 'utf8'))]);
        }
    }

    it.each(JTA)('%s — the read-back answers byte-identically with and without `blocks`/`fetched`; `zoneOfPayload` ignores the config', (_g, doc) => {
        const jta = substrateRegistry.get('jta');
        for (const [p, slot] of Object.entries(doc.preset_sidecars ?? {})) {
            const entries = Object.fromEntries(Object.entries(slot).filter(([, e]) => e?.substrate === 'jta'));
            if (!Object.keys(entries).length) continue;
            const locations = {};
            const bare = jta.zoneConfigFromSlot({ entries, locations });
            const full = jta.zoneConfigFromSlot({ entries, locations, blocks: { region_atlas: doc.region_atlas }, fetched: { x: 1 } });
            expect(bytes(full)).toBe(bytes(bare));
            for (const e of Object.values(entries)) {
                expect(jta.zoneOfPayload(e.playable_payload, { atlasDoc: SEEDLING_STARTER_ATLAS }))
                    .toBe(jta.zoneOfPayload(e.playable_payload));
            }
        }
    });
});
