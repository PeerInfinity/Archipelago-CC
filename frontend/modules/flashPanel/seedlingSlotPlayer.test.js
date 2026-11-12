/**
 * ⛓ THE LOADED SLOT — Seedling's real-room readers read the LOADED player's maps, not player '1'.
 *
 * A room's server-built rules are keyed under the ROOM slot (`overlayServerData` moves every per-player
 * map to it), so at slot 2 `preset_sidecars['1']` does not exist. Before this fix the readers below read
 * `'1'` by constant: the vanilla arm's playback map had no regions, so the Playback Bot's first leg
 * failed ("level_0__r7c6 has no tile for exit 'level_0__r7c6 -> level_2'", upstream 0.6.9, slot 2).
 *
 * The slot-2 documents here are the committed presets moved to slot 2 by the client's own overlay
 * (`overlayServerData`, with the preset's own placements as the scouts), and each reader is held equal
 * to its slot-1 answer. ⛔ Slot 1 (and no slot named) reads exactly what it read before.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { realRoomPlaybackMap } from './seedlingPlaybackController.js';
import { loadSeedlingRandomizer } from './seedlingRandomizerWiring.js';
import { seedlingMountKey } from './seedlingMountKey.js';
import { overlayServerData } from '../client/core/localRulesOverlay.js';
import {
    ATLAS_CHECK_PLAYER, atlasRoomRegions, buildAtlasCheckTable, itemOfEntityFrom, propertyLocationOfFrom,
    roomPlayerOf,
} from '../seedlingDemo/seedlingAtlasCheckTable.js';
import { generatedRoomCensus } from '../seedlingDemo/seedlingGenRoomPayload.js';
import { assembleGeneratedSeedlingSet } from '../seedlingDemo/seedlingGeneratedSet.js';
import { tagOf } from '../seedlingDemo/levelWorld.js';
import { ITEM_FOR_KEY, ITEM_FOR_TAG, VICTORY_ITEM } from '../seedlingDemo/seedlingAtlasDerivation.js';
import { placementKey } from '../seedlingDemo/apPlacementRewriter.js';
import { PlaybackBotUI } from '../playbackBot/playbackBotUI.js';

const abs = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const readJson = (rel) => JSON.parse(readFileSync(abs(rel), 'utf8'));
const BASE = pathToFileURL(abs('../../')).href;
const GAME_CONFIG = readJson('./games/seedling.json');
const MANIFEST = readJson('./wasm/builds.json');
const ATLASES = './atlases/';
const MAP_DOC = readJson(`${ATLASES}seedling-map.json`);
const ATLAS_INDEX = readJson(`${ATLASES}atlas_files.json`);
const fetchJson = async (u) => JSON.parse(readFileSync(fileURLToPath(u), 'utf8'));
const rulesOf = (preset) => readJson(`../../presets/${preset}/AP_1/AP_1_rules.json`);

/** The committed preset as a room would send it at `slot`: the client's own overlay, the preset's own placements. */
function atSlot(doc, slot) {
    const items = doc.items['1'];
    const scouts = Object.values(doc.regions['1']).flatMap((r) => r.locations ?? [])
        .filter((l) => l.id !== null && l.id !== undefined)
        .map((l) => ({ locationId: l.id, locationName: l.name, itemId: items[l.item.name]?.id ?? null,
            itemName: l.item.name, player: Number(l.item.player) === 1 ? slot : Number(l.item.player),
            progression: !!l.item.advancement }));
    return overlayServerData(doc, '1', { slot, names: { 1: 'Questy', [slot]: 'Sprout' },
        seedName: doc.seed_name, slotData: {}, scouts });
}

/** `locations` as the state manager answers it: name → record with `item`. */
const locationsOf = (rules) => {
    const out = new Map();
    for (const slot of Object.keys(rules.regions ?? {})) {
        for (const [region, r] of Object.entries(rules.regions[slot])) {
            for (const loc of r.locations ?? []) out.set(loc.name, { ...loc, region, parent_region_name: region });
        }
    }
    return out;
};
const load = (rules, playerId) => loadSeedlingRandomizer({
    flashPanel: rules.flash_panel[playerId], manifest: MANIFEST, rawRules: rules, locations: locationsOf(rules),
    playerId, gameConfig: GAME_CONFIG, baseUrl: BASE, fetchJson, importModule: (u) => import(/* @vite-ignore */ u),
});
/** A map's comparable shape: names and cells, never the slot. */
const shapeOf = (map) => ({
    arm: map.arm,
    regions: [...map.regions.entries()],
    links: map.links,
    entries: map.entries.map((e) => [e.location, e.level, e.tag ?? null, e.entityType ?? null]),
    events: map.events.map((e) => [e.location, e.level, e.tag]),
    refused: map.refused.map((r) => r.location).sort(),
});

const PT1 = rulesOf('seedling_playthrough');
const PT2 = atSlot(PT1, 2);

describe('the vanilla arm at SLOT 2 — seedling_playthrough as a room sends it', () => {
    it('the slot-2 document is keyed under 2 only (the case is not vacuous)', () => {
        expect(Object.keys(PT2.preset_sidecars)).toEqual(['2']);
        expect(Object.keys(PT2.regions)).toEqual(['2']);
        expect(atlasRoomRegions(PT2)).toEqual([]); // the old read: no rooms at '1'
        expect(atlasRoomRegions(PT2, '2')).toEqual(atlasRoomRegions(PT1));
        expect(atlasRoomRegions(PT1, '1')).toEqual(atlasRoomRegions(PT1));
    });

    it('the Playback Bot\'s map at slot 2 equals slot 1\'s — regions, links, entries, events', async () => {
        const [l1, l2] = await Promise.all([load(PT1, '1'), load(PT2, '2')]);
        expect(l1.verdict, l1.why).toBe('eligible');
        expect(l2.verdict, l2.why).toBe('eligible');
        const m1 = realRoomPlaybackMap(l1, PT1);
        const m2 = realRoomPlaybackMap(l2, PT2, { playerId: '2' });
        expect(m1.regions.size).toBeGreaterThan(0);
        expect(shapeOf(m2)).toEqual(shapeOf(m1));
        // The leg that failed on upstream 0.6.9: its exit is a door of the start room's payload.
        const start = m2.regions.get('level_0__r7c6');
        expect(start?.exits?.some((x) => x.exitName === 'level_0__r7c6 -> level_2')).toBe(true);
        // ⛔ And slot 1 with no slot named is the map it always was.
        expect(shapeOf(realRoomPlaybackMap(l1, PT1, { playerId: '1' }))).toEqual(shapeOf(m1));
    });

    it('the mount key reads the loaded slot\'s rooms', () => {
        const k1 = JSON.parse(seedlingMountKey({ rules: PT1, playerId: '1' }));
        const k2 = JSON.parse(seedlingMountKey({ rules: PT2, playerId: '2' }));
        expect(k1.rooms.length).toBeGreaterThan(0);
        expect(k2.rooms.map(([r]) => r)).toEqual(k1.rooms.map(([r]) => r));
        expect(k2.links).toEqual(k1.links);
        expect(k2.events).toEqual(k1.events);
        // ⛔ A preset with no slot named keys exactly as at slot 1.
        expect(seedlingMountKey({ rules: PT1 })).toBe(seedlingMountKey({ rules: PT1, playerId: null }));
        expect(JSON.parse(seedlingMountKey({ rules: PT1 })).rooms).toEqual(k1.rooms);
    });

    it('the Playback Bot resolves a room\'s substrate under the loaded slot', () => {
        const bot = (rules, playerId) => new PlaybackBotUI({ getSphereData: () => [], getRulesJson: () => rules,
            getPlayerId: () => playerId });
        expect(bot(PT1, '1')._resolveSubstrateId('level_0__r7c6')).toBe('flash_seedling');
        expect(bot(PT2, '2')._resolveSubstrateId('level_0__r7c6')).toBe('flash_seedling');
        expect(bot(PT2, '1')._resolveSubstrateId('level_0__r7c6')).toBe('maze'); // the old read, for contrast
    });
});

describe('the atlas table and the generated census at SLOT 2', () => {
    const deps = (rules, player) => {
        const byName = new Map(Object.values(rules.regions[player]).flatMap((r) => r.locations ?? [])
            .map((l) => [l.name, l.item]));
        return {
            atlasDoc: readJson(ATLASES + ATLAS_INDEX.atlases.find((a) => a.atlas_id === rules.region_atlas[player].atlas_id).file),
            mapDoc: MAP_DOC,
            locationItemOf: (name) => {
                const it = byName.get(name);
                return it && typeof it.name === 'string' ? { name: it.name, player: it.player } : null;
            },
            placementKey,
            tagOf,
            itemOfEntity: itemOfEntityFrom({ itemForTag: ITEM_FOR_TAG, itemForKey: ITEM_FOR_KEY, victoryItem: VICTORY_ITEM }),
            propertyLocationOf: propertyLocationOfFrom(GAME_CONFIG, ITEM_FOR_TAG),
        };
    };
    const rowsOf = (t) => t.entries.map((e) => [e.location, e.level, e.tag]);

    it('buildAtlasCheckTable binds the same locations at slot 2 as at slot 1 (seedling_atlas)', () => {
        const A1 = rulesOf('seedling_atlas');
        const A2 = atSlot(A1, 2);
        const t1 = buildAtlasCheckTable({ rules: A1, selfPlayer: 1, ...deps(A1, '1') });
        const t2 = buildAtlasCheckTable({ rules: A2, selfPlayer: 2, playerId: '2', ...deps(A2, '2') });
        expect(t1.entries.length).toBeGreaterThan(0);
        expect(rowsOf(t2)).toEqual(rowsOf(t1));
        expect(t2.census.locations).toBe(t1.census.locations);
        // ⛔ No slot named = slot 1, unchanged.
        expect(rowsOf(buildAtlasCheckTable({ rules: A1, selfPlayer: 1, playerId: '1', ...deps(A1, '1') }))).toEqual(rowsOf(t1));
    });

    it('generatedRoomCensus and the assembler read the loaded slot (seedling_generated_room)', () => {
        const G1 = rulesOf('seedling_generated_room');
        const G2 = atSlot(G1, 2);
        const c1 = generatedRoomCensus(G1);
        expect(c1.rooms.length).toBeGreaterThan(0);
        expect(generatedRoomCensus(G2).rooms).toEqual([]); // the old read
        expect(generatedRoomCensus(G2, '2')).toEqual(c1);
        expect(generatedRoomCensus(G1, '1')).toEqual(c1);
        const join = (rules, p) => {
            const byName = new Map(Object.values(rules.regions[p]).flatMap((r) => r.locations ?? []).map((l) => [l.name, l.item]));
            return (name) => { const it = byName.get(name); return it ? { name: it.name, player: it.player } : null; };
        };
        const s1 = assembleGeneratedSeedlingSet(G1, { locationItemOf: join(G1, '1'), selfPlayer: 1 });
        const s2 = assembleGeneratedSeedlingSet(G2, { locationItemOf: join(G2, '2'), selfPlayer: 2, playerId: '2' });
        expect(s2.set.rooms.map((r) => r.id)).toEqual(s1.set.rooms.map((r) => r.id));
        expect([...s2.levelOf]).toEqual([...s1.levelOf]);
        expect([...s2.table.keys()]).toEqual([...s1.table.keys()]);
    });

    it('roomPlayerOf: the loaded slot as a string, ATLAS_CHECK_PLAYER when none is named', () => {
        expect(roomPlayerOf(2)).toBe('2');
        expect(roomPlayerOf('3')).toBe('3');
        for (const none of [undefined, null, '']) expect(roomPlayerOf(none)).toBe(ATLAS_CHECK_PLAYER);
    });
});
