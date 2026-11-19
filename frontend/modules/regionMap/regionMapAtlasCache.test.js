/**
 * region-map atlas-cache — a custom world's derived atlas reaches the Region Map through the host-side cache.
 * The WRITER is the real `PresetUI.prototype.loadDocumentFile` (a `.zip` bundle carrying the rules and the
 * `region-atlas` member); the READER is the real `RegionMapUI.prototype._hookCtx`; the model is the real
 * `buildRegionMapModel`. Counts are DERIVED from each world's rules, never pinned.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { canonicalModel, customSetRules } from '../../../scripts/dev/region-map-atlas-cache-dump.mjs';
import { loadJSZipNode } from '../../../scripts/procgen/loadJSZipNode.mjs';
import { writeBundle } from '../presets/documentBundle.js';
import { PresetUI } from '../presets/presetUI.js';
import { atlasCache } from '../procgenCore/atlasCache.js';
import { regionsOf } from '../procgenCore/rulesGraph.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import '../flashPanel/flashSeedlingLibrary.js';
import '../flashPanel/flashSeedlingGenLibrary.js';
import { buildRegionMapModel } from './regionMapModel.js';
import { RegionMapUI } from './regionMapUI.js';

const read = (p) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8'));
const PLAYTHROUGH = read('../../presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json');

const JSZip = loadJSZipNode();
/** The writer: a bundle through the real `loadDocumentFile`; returns the rules it displayed and the cache at that moment. */
async function loadBundle(members) {
    const bytes = await writeBundle(members, { jszip: JSZip });
    const seen = { rules: null, cachedAtDisplay: null, notes: [] };
    const host = {
        loadJSZip: async () => JSZip,
        eventBus: { publish: (_ev, p) => seen.notes.push(p?.message ?? '') },
        displayLoadedJsonFileDetails: (doc) => { seen.rules = doc; seen.cachedAtDisplay = atlasCache.ids(); },
    };
    await PresetUI.prototype.loadDocumentFile.call(host, { name: 'set.zip', arrayBuffer: async () => bytes });
    return seen;
}
/** The reader, for `playerId`. */
const readerCtx = (rules, playerId = '1') => RegionMapUI.prototype._hookCtx.call({}, { rules, playerId });
const model = (rules, hookCtx, player = '1') => buildRegionMapModel({ rules, player, registry: substrateRegistry, hookCtx });
const locationsOf = (rules, p) => Object.values(regionsOf(rules, p)).flatMap((r) => (r.locations ?? []).map((l) => l.name));

let CUSTOM;
beforeAll(async () => { CUSTOM = await customSetRules(); });
afterEach(() => atlasCache.clear());

describe('the bundle writer → the cache → _hookCtx → the Region Map model (a custom Seedling set)', () => {
    it('the bundle\'s region-atlas member is cached under its atlas_id BEFORE the rules are displayed', async () => {
        const id = CUSTOM.rules.region_atlas['1'].atlas_id;
        expect(CUSTOM.atlas.atlas_id).toBe(id);
        const seen = await loadBundle([{ kind: 'rules', doc: CUSTOM.rules }, { kind: 'region-atlas', doc: CUSTOM.atlas }]);
        expect(seen.cachedAtDisplay).toEqual([id]);
        expect(atlasCache.get(id)).toEqual(CUSTOM.atlas);
        expect(seen.notes.join(' ')).toMatch(/region-atlas \(`region-atlas\.json`\)/);
    });

    it('BEFORE ({}): no extents, squares on generic places, no warps — AFTER: real extents, N/N on their tiles, warps split', async () => {
        const before = model(CUSTOM.rules, {});
        expect([...before.cells.values()].every((c) => c.extent === null)).toBe(true);
        expect(before.layout.graph.links.some((l) => l.kind === 'warp')).toBe(false);

        const seen = await loadBundle([{ kind: 'rules', doc: CUSTOM.rules }, { kind: 'region-atlas', doc: CUSTOM.atlas }]);
        const ctx = readerCtx(seen.rules);
        expect(Object.keys(ctx.atlases ?? {})).toEqual([CUSTOM.atlas.atlas_id]);
        const after = model(seen.rules, ctx);
        const cells = [...after.cells.values()];
        expect(cells.length).toBeGreaterThan(0);
        for (const c of cells) {
            expect(c.extent).not.toBe(null);
            expect(c.tileSource).toBe('substrate');
        }
        const want = locationsOf(seen.rules, after.player);
        const placed = cells.flatMap((c) => c.tiles.map((t) => t.location));
        expect(want.length).toBeGreaterThan(0);
        expect(placed.sort()).toEqual([...want].sort());
        expect(after.unplaced).toEqual([]);
        // every square sits inside its cell's extent
        for (const c of cells) for (const t of c.tiles) {
            expect(t.x).toBeGreaterThanOrEqual(0); expect(t.x).toBeLessThan(c.extent.w);
            expect(t.y).toBeGreaterThanOrEqual(0); expect(t.y).toBeLessThan(c.extent.h);
        }
        const kinds = (m) => m.layout.graph.links.map((l) => l.kind ?? 'join');
        const warps = kinds(after).filter((k) => k === 'warp').length;
        expect(warps).toBeGreaterThan(0);
        // the warps come OUT of the joins: the link set is the same size, only classified
        expect(kinds(after).length).toBe(kinds(before).length);
        expect(kinds(before).filter((k) => k === 'join').length - kinds(after).filter((k) => k === 'join').length).toBe(warps);
    });

    it('⛓ STALENESS: a re-load under the SAME atlas_id replaces the cached atlas (never the old one)', async () => {
        const id = CUSTOM.atlas.atlas_id;
        const shrunk = { ...CUSTOM.atlas, regions: CUSTOM.atlas.regions.map((r) => ({ ...r, bounds: { ...r.bounds, w: 1, h: 1 } })) };
        await loadBundle([{ kind: 'rules', doc: CUSTOM.rules }, { kind: 'region-atlas', doc: shrunk }]);
        expect(readerCtx(CUSTOM.rules).atlases[id]).toBe(atlasCache.get(id));
        expect(atlasCache.get(id).regions[0].bounds.w).toBe(1);
        await loadBundle([{ kind: 'rules', doc: CUSTOM.rules }, { kind: 'region-atlas', doc: CUSTOM.atlas }]);
        expect(atlasCache.get(id)).toEqual(CUSTOM.atlas);
        expect(readerCtx(CUSTOM.rules).atlases[id].regions[0].bounds).toEqual(CUSTOM.atlas.regions[0].bounds);
    });
});

describe('_hookCtx is PER-PLAYER', () => {
    it('two players naming two different atlas_ids: each map gets its own', () => {
        const a1 = { ...CUSTOM.atlas, atlas_id: 'set-p1' };
        const a2 = { ...CUSTOM.atlas, atlas_id: 'set-p2' };
        atlasCache.put('set-p1', a1);
        atlasCache.put('set-p2', a2);
        const rules = { ...CUSTOM.rules, region_atlas: { 1: { atlas_id: 'set-p1' }, 2: { atlas_id: 'set-p2' } } };
        expect(readerCtx(rules, '1')).toEqual({ atlases: { 'set-p1': a1 } });
        expect(readerCtx(rules, '2')).toEqual({ atlases: { 'set-p2': a2 } });
        // ⛔ never the first player's, never a global one
        expect(readerCtx({ ...rules, region_atlas: { 1: { atlas_id: 'set-p1' } } }, '2')).toEqual({});
    });
    it('reads the player the panel resolved (`_rulesOf`) when called with no argument', () => {
        atlasCache.put(CUSTOM.atlas.atlas_id, CUSTOM.atlas);
        const ui = { _rulesOf: () => ({ rules: CUSTOM.rules, playerId: '1' }) };
        expect(Object.keys(RegionMapUI.prototype._hookCtx.call(ui).atlases)).toEqual([CUSTOM.atlas.atlas_id]);
        expect(RegionMapUI.prototype._hookCtx.call({ _rulesOf: () => null })).toEqual({});
    });
});

describe('seedling_playthrough is UNCHANGED', () => {
    it('its hook context is {} even with a custom atlas cached, and its model is byte-identical to the base\'s ({})', async () => {
        await loadBundle([{ kind: 'rules', doc: CUSTOM.rules }, { kind: 'region-atlas', doc: CUSTOM.atlas }]);
        expect(atlasCache.size).toBe(1);
        const ctx = readerCtx(PLAYTHROUGH);
        expect(ctx).toEqual({});
        expect(JSON.stringify(canonicalModel(model(PLAYTHROUGH, ctx))))
            .toBe(JSON.stringify(canonicalModel(model(PLAYTHROUGH, {}))));
    });
});
