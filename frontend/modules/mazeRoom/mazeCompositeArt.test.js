/**
 * CONTENT SETS TIDY-1 — **THE COMPOSITE MAP'S MAZE CELL DRAWS THE THEME'S ART** (gates and items, R5; things, S2;
 * tiles, R2b), through the same lookups as the one-region view, with the same fallback. In node, on the recorded
 * draw-op log (`drawOpRecorder.js`):
 *
 *   1. ⛔ THE PLAIN PIN. Every maze region of three committed worlds — a plain one (`procgen_maze` seed 1) and the two
 *      trial worlds drawn with NO art — draws exactly the ops it drew before this slice. ⛓ The hashes are a CAPTURE
 *      at `75e45c964d` (the tree before the art seam), pasted, never recomputed. `meta_trial` is the one with things,
 *      which the cell did not draw before: its pin is taken with its things removed, and the things pass is (3).
 *   2. ⛔ EVERY committed maze world whose stack is only the substrate's default pack (no theme) resolves NO art: its
 *      cell is drawn by exactly the no-art ops, whatever the load brings back. Derived from the presets on disk.
 *   3. THE THEME. `meta_trial`'s cells, once the `meta` stack has loaded: the swim item, the two things (the Narrator,
 *      the Placeholder) and the tiles draw from `"meta#<key>"`; the water gate (unpresented, ⚖) keeps its skin.
 *   4. THE LOAD: one load per stack, shared by every cell; a miss draws the fallback and calls the host's
 *      `requestRedraw` once the art lands, only if the load brought art; a failed load draws the fallback for good.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { hashOf, recordingContext } from './drawOpRecorder.js';
import { TILE_PX } from '../procgenCore/compositeMapRenderer.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import {
    drawMazeCompositeRegion, mazeCompositeArtSettled, mazeCompositeArtStatus, mazeCompositeStackOf,
    resetMazeCompositeArtForTests, setMazeCompositeArtIoForTests,
} from './mazeCompositeMap.js';
import { effectiveContentStack } from '../procgenPipeline/worldContent.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PRESETS = join(ROOT, 'frontend/presets');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
/** A stub rasteriser: the image names its shape, so a blit's log line says which shape it drew. */
const rasterise = async (shape) => ({ shape: JSON.stringify(shape.draw) });
const decode = async () => { throw new Error('no image sheets in this test'); };
const FS_IO = { base: PACKS, readJson: fsJson, decode, rasterise };

const readRules = (rel) => JSON.parse(readFileSync(join(PRESETS, rel), 'utf8'));

/** Every maze region of a document's slot, as the composite map holds it (a deserialized payload). */
function mazeRegions(rules) {
    const out = [];
    for (const [slot, sidecars] of Object.entries(rules.preset_sidecars ?? {})) {
        for (const [name, sc] of Object.entries(sidecars ?? {})) {
            if ((sc?.render_hint ?? sc?.substrate) !== 'maze' || !sc.playable_payload) continue;
            out.push({
                slot, name,
                region: {
                    region_id: name, substrate: sc.substrate, render_hint: sc.render_hint,
                    // the composite map's own path: the registry entry's deserializer (it also reads `things`, S2)
                    playable_payload: substrateRegistryEntry.deserializeWorld(sc.playable_payload),
                },
            });
        }
    }
    return out;
}

/** A cell away from the origin, so the offsets are in the log too. */
const GEOM = Object.freeze({ offX: 3 * TILE_PX, offY: 2 * TILE_PX });
function cellLog(region, geom = {}) {
    const ctx = recordingContext();
    drawMazeCompositeRegion(ctx, region, { ...GEOM, ...geom });
    return ctx.__log;
}

/** ⛓ CAPTURED at `75e45c964d` (before the art seam), with no source (no art) — ⛔ pasted, never recomputed. */
const BEFORE = Object.freeze({
    'procgen_maze/AP_1/AP_1_rules.json': 'cd828ef4c9e08bf265c7ee37f16ed619',
    'meta_trial/AP_1/AP_1_rules.json': '13619177bfa45bdd31bd11df7e6be49d',
    'concept_trial/AP_1/AP_1_rules.json': '13619177bfa45bdd31bd11df7e6be49d',
});

/** One hash per document: every maze region's log, in sidecar order, each headed by its name. */
function documentHash(rel, { geomOf = () => ({}), withoutThings = false } = {}) {
    const lines = [];
    for (const { slot, name, region } of mazeRegions(rules(rel))) {
        const r = withoutThings ? { ...region, playable_payload: Object.assign(Object.create(Object.getPrototypeOf(region.playable_payload)), region.playable_payload, { things: [] }) } : region;
        lines.push(`# ${slot}/${name}`, ...cellLog(r, geomOf(slot)));
    }
    return hashOf(lines);
}
const rulesCache = new Map();
function rules(rel) {
    if (!rulesCache.has(rel)) rulesCache.set(rel, readRules(rel));
    return rulesCache.get(rel);
}

describe('⛔ the plain pin: no art, the ops drawn before this slice', () => {
    beforeEach(() => resetMazeCompositeArtForTests());
    for (const [rel, hash] of Object.entries(BEFORE)) {
        it(rel, () => {
            expect(mazeRegions(rules(rel)).length).toBeGreaterThan(0);
            expect(documentHash(rel, { withoutThings: true })).toBe(hash);
        });
    }
});

// ── (2) every committed world with no theme ─────────────────────────────────────────────────────────────────────
/** Every committed rules document holding a maze sidecar (a cheap text test before the parse). */
function committedMazeDocuments() {
    const out = [];
    for (const game of readdirSync(PRESETS, { withFileTypes: true })) {
        if (!game.isDirectory()) continue;
        for (const seed of readdirSync(join(PRESETS, game.name), { withFileTypes: true })) {
            if (!seed.isDirectory()) continue;
            const rel = `${game.name}/${seed.name}/${seed.name}_rules.json`;
            if (!existsSync(join(PRESETS, rel))) continue;
            const text = readFileSync(join(PRESETS, rel), 'utf8');
            if (!text.includes('"preset_sidecars"') || !text.includes('"maze"')) continue;
            if (mazeRegions(rules(rel)).length) out.push(rel);
        }
    }
    return out;
}

const DEFAULT_STACK = effectiveContentStack({ substrateIds: [substrateRegistryEntry.id] });

describe('⛔ a world with no theme draws exactly its no-art ops, after the load as before it', () => {
    beforeEach(() => setMazeCompositeArtIoForTests(FS_IO));
    afterEach(() => setMazeCompositeArtIoForTests(null));

    it('every committed maze world whose stack is the default pack alone', async () => {
        const docs = committedMazeDocuments();
        expect(docs.length).toBeGreaterThan(0);
        let plain = 0;
        for (const rel of docs) {
            for (const { slot, region } of mazeRegions(rules(rel))) {
                const source = { rules: rules(rel), playerId: slot };
                const stack = mazeCompositeStackOf(region, source);
                if (stack.join(',') !== DEFAULT_STACK.join(',')) continue;
                plain++;
                const redraws = [];
                const before = hashOf(cellLog(region));
                expect(hashOf(cellLog(region, { source, requestRedraw: () => redraws.push(rel) })), rel).toBe(before);
                const status = await mazeCompositeArtSettled(stack);
                expect(status.status, rel).toBe('ready');
                expect(hashOf(cellLog(region, { source })), rel).toBe(before);
                expect(redraws, `${rel}: a load that brought no art asks for no redraw`).toEqual([]);
            }
        }
        expect(plain).toBeGreaterThan(0);
    });
});

// ── (3) the theme ───────────────────────────────────────────────────────────────────────────────────────────────
const META = 'meta_trial/AP_1/AP_1_rules.json';
const META_SHAPES = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/meta/art/manifest.json'), 'utf8')).shapes;
/** The log line of a blit of `key`'s shape (the stub image names its shape). */
const blitsOf = (log, key) => log.filter((l) => l.startsWith('drawImage(')
    && l.includes(JSON.stringify(JSON.stringify(META_SHAPES[key].draw)).slice(1, -1)));

describe('the theme: meta_trial\'s cells draw from the meta stack once it has loaded', () => {
    beforeEach(() => setMazeCompositeArtIoForTests(FS_IO));
    afterEach(() => setMazeCompositeArtIoForTests(null));

    const regions = () => mazeRegions(rules(META));
    const sourceOf = (slot) => ({ rules: rules(META), playerId: slot });

    it('a miss draws the no-art cell and asks the host to redraw ONCE, when the art lands', async () => {
        const redraws = [];
        const host = () => redraws.push(1);
        for (const { slot, region } of regions()) {
            expect(cellLog(region, { source: sourceOf(slot), requestRedraw: host })).toEqual(cellLog(region));
        }
        const [{ slot, region }] = regions();
        const status = await mazeCompositeArtSettled(mazeCompositeStackOf(region, sourceOf(slot)));
        expect(status.status).toBe('ready');
        expect(status.stack).toContain('meta');
        expect(redraws).toHaveLength(1);
    });

    it('the swim item, the things and the tiles draw from the meta pack; the water gate keeps its skin', async () => {
        const [{ slot, region: first }] = regions();
        cellLog(first, { source: sourceOf(slot) });
        const status = await mazeCompositeArtSettled(mazeCompositeStackOf(first, sourceOf(slot)));
        // the same lookups as the one-region view: concept art by role and mechanic, thing art by pack concept
        const itemMechanics = new Set(regions().flatMap(({ region }) => [...region.playable_payload.items.values()]
            .map((id) => region.playable_payload.itemLib?.[id]?.concept).filter(Boolean)));
        const gateMechanics = new Set(regions().flatMap(({ region }) => [...region.playable_payload.obstacles.values()]
            .map((id) => region.playable_payload.obstacleLib?.[id]?.concept).filter(Boolean)));
        const things = regions().flatMap(({ region }) => region.playable_payload.things ?? []);
        expect(things.length).toBeGreaterThan(0);

        const drawnItems = [...itemMechanics].filter((m) => status.conceptArt.item?.[m]);
        expect(drawnItems.length, 'meta presents an item mechanic with art').toBeGreaterThan(0);
        for (const m of drawnItems) expect(status.conceptArt.item[m].pack).toBe('meta');
        // ⚖ water stays unpresented: the gate role resolves no art for it
        for (const m of gateMechanics) expect(status.conceptArt.gate?.[m]).toBeUndefined();

        const logs = regions().map(({ slot: s, region }) => ({ region, log: cellLog(region, { source: sourceOf(s) }) }));
        const all = logs.flatMap((l) => l.log);
        for (const m of drawnItems) expect(blitsOf(all, status.conceptArt.item[m].key).length).toBeGreaterThan(0);
        for (const t of things) {
            const key = status.thingArt[t.concept]?.key ?? (t.kind === 'info' ? 'maze:object/sign' : null);
            expect(key, `${t.id}: its pack concept names art`).toBeTruthy();
            // drawn at its own cell, offset by the composite cell's origin
            const at = `${GEOM.offX + t.x * TILE_PX},${GEOM.offY + t.y * TILE_PX},${TILE_PX},${TILE_PX})`;
            expect(blitsOf(all, key).some((l) => l.endsWith(at)), `${t.id} at ${at}`).toBe(true);
        }
        for (const tile of ['maze:tile/floor', 'maze:tile/wall']) expect(blitsOf(all, tile).length).toBeGreaterThan(0);
        // the water gate: its skin's ops are the no-art ones (`paintConceptGate`), so its symbol is still written
        for (const { region, log } of logs) {
            for (const id of region.playable_payload.obstacles.values()) {
                const def = region.playable_payload.obstacleLib?.[id];
                if (def?.concept && def.symbol) expect(log.some((l) => l.startsWith(`fillText(${JSON.stringify(def.symbol)},`))).toBe(true);
            }
        }
    });
});

// ── (4) the load ────────────────────────────────────────────────────────────────────────────────────────────────
describe('the load', () => {
    afterEach(() => setMazeCompositeArtIoForTests(null));

    it('one load per stack, shared by every cell', async () => {
        let reads = 0;
        setMazeCompositeArtIoForTests({ ...FS_IO, readJson: async (url) => { reads++; return fsJson(url); } });
        const rs = mazeRegions(rules(META));
        const src = { rules: rules(META), playerId: rs[0].slot };
        for (const { region } of rs) cellLog(region, { source: src });
        await mazeCompositeArtSettled(mazeCompositeStackOf(rs[0].region, src));
        const once = reads;
        for (const { region } of rs) cellLog(region, { source: src });
        expect(once).toBeGreaterThan(0);
        expect(reads).toBe(once);
    });

    it('a failed load draws the no-art cell for good and asks for no redraw', async () => {
        setMazeCompositeArtIoForTests({ ...FS_IO, readJson: async () => { throw new Error('offline'); } });
        const [{ slot, region }] = mazeRegions(rules(META));
        const src = { rules: rules(META), playerId: slot };
        const redraws = [];
        cellLog(region, { source: src, requestRedraw: () => redraws.push(1) });
        const status = await mazeCompositeArtSettled(mazeCompositeStackOf(region, src));
        expect(status.status).toBe('failed');
        expect(cellLog(region, { source: src })).toEqual(cellLog(region));
        expect(redraws).toEqual([]);
    });

    it('a host that cannot load (node, no io) draws the no-art cell and does not throw', () => {
        setMazeCompositeArtIoForTests(null);
        const [{ slot, region }] = mazeRegions(rules(META));
        const src = { rules: rules(META), playerId: slot };
        expect(cellLog(region, { source: src })).toEqual(cellLog(region));
        expect(mazeCompositeArtStatus(mazeCompositeStackOf(region, src)).status).toBe('unavailable');
    });

    it('a source naming no slot reads the document\'s ONE slot', () => {
        const [{ slot, region }] = mazeRegions(rules(META));
        expect(mazeCompositeStackOf(region, { rules: rules(META), playerId: null }))
            .toEqual(mazeCompositeStackOf(region, { rules: rules(META), playerId: slot }));
        expect(mazeCompositeStackOf(region, null)).toEqual(DEFAULT_STACK);
    });
});
