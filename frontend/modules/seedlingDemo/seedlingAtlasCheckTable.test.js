/**
 * ⛓⛓ SEEDLING GENERATED LEVELS G7 — **A REAL ROOM'S OWN LOCATION, AS A CHECK
 * ADDRESS** (`seedlingAtlasCheckTable.js`). Every committed real-room preset is
 * read through the chain (rules location → atlas tile → the map entity that
 * grants the location's vanilla item → the engine's `tagOf` →
 * `placementKey`), with the REAL injected facts: `levelWorld.tagOf`, the
 * derivation's item tables, the rewriter's `placementKey` and the adapter's
 * property table (`games/seedling.json`). Every location is bound or REFUSED BY
 * NAME — none is dropped — and the refusals are the law: untagged, reported by
 * the property path too, or no single granting entity.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    ATLAS_CHECK_REFUSALS,
    atlasRoomRegions,
    buildAtlasCheckTable,
    itemOfEntityFrom,
    propertyLocationOfFrom,
} from './seedlingAtlasCheckTable.js';
import { tagOf } from './levelWorld.js';
import { ITEM_FOR_KEY, ITEM_FOR_TAG, VICTORY_ITEM } from './seedlingAtlasDerivation.js';
import { placementKey } from './apPlacementRewriter.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const ATLASES = 'frontend/modules/flashPanel/atlases/';
const MAP = readJson(`${ATLASES}seedling-map.json`);
const INDEX = readJson(`${ATLASES}atlas_files.json`);
const GAME = readJson('frontend/modules/flashPanel/games/seedling.json');
const atlasOf = (rules) => readJson(ATLASES
    + INDEX.atlases.find((a) => a.atlas_id === rules.region_atlas.atlas_id).file);
const rulesOf = (id) => readJson(`frontend/presets/${id}/AP_1/AP_1_rules.json`);

/** The rules' own placement, as the state manager's `locations` Map answers it. */
const locationItemOfRules = (rules) => {
    const byName = new Map();
    for (const r of Object.values(rules.regions['1'])) {
        for (const l of r.locations ?? []) byName.set(l.name, l.item);
    }
    return (name) => {
        const it = byName.get(name);
        return it && typeof it.name === 'string' ? { name: it.name, player: it.player } : null;
    };
};

const DEPS = Object.freeze({
    placementKey,
    tagOf,
    itemOfEntity: itemOfEntityFrom({ itemForTag: ITEM_FOR_TAG, itemForKey: ITEM_FOR_KEY, victoryItem: VICTORY_ITEM }),
    propertyLocationOf: propertyLocationOfFrom(GAME, ITEM_FOR_TAG),
});
const tableOf = (rules, extra = {}) => buildAtlasCheckTable({
    rules, atlasDoc: atlasOf(rules), mapDoc: MAP, locationItemOf: locationItemOfRules(rules),
    selfPlayer: 1, ...DEPS, ...extra,
});

/** The pipeline's real-room presets: the atlas compiler names their locations. */
const PIPELINE_REAL_ROOM_PRESETS = Object.freeze(['seedling_atlas', 'seedling_spiral_room', 'seedling_sphere_room',
    'seedling_atlas_host', 'seedling_atlas_location']);

describe('seedlingAtlasCheckTable — every committed real-room preset, bound or refused by name', () => {
    it.each([...PIPELINE_REAL_ROOM_PRESETS, 'seedling_playthrough'])('%s: no location is dropped', (id) => {
        const rules = rulesOf(id);
        const { table, entries, refused, census } = tableOf(rules);
        expect(census.regions).toBe(atlasRoomRegions(rules).length);
        expect(census.bound + census.refused).toBe(census.locations);
        expect(table.size).toBe(entries.length);
        for (const e of entries) {
            expect(e.key).toBe(placementKey(e.level, e.tag));
            expect(table.get(e.key).location).toBe(e.location);
        }
        for (const r of refused) expect(r.why).toMatch(/\w+ \w+/);
    });

    it('seedling_atlas: Starting House - Chest is bound at 86|0 — the address the box measured (§12.4)', () => {
        const { table, entries, refused } = tableOf(rulesOf('seedling_atlas'));
        expect(refused).toEqual([]);
        expect(entries).toHaveLength(1);
        expect(table.get('86|0')).toMatchObject({
            location: 'Starting House - Chest', level: 86, tag: 0, item: 'Seal', player: 1, forSelf: true,
            region: 'starting_house', entityType: 'chest', vanillaItem: 'Seal',
        });
    });

    it('seedling_atlas_location (G7\'s witness): the same chest, holding key_blue, in the pipeline region region_2_2', () => {
        const { table, refused } = tableOf(rulesOf('seedling_atlas_location'));
        expect(refused).toEqual([]);
        expect([...table.keys()]).toEqual(['86|0']);
        expect(table.get('86|0')).toMatchObject({ location: 'Starting House - Chest', item: 'key_blue', player: 1,
            forSelf: true, region: 'region_2_2', entityType: 'chest', ledgerId: 'starting_house:chest@48,16' });
    });

    it.each(['seedling_spiral_room', 'seedling_sphere_room', 'seedling_atlas_host'])(
        '%s: its real room holds no location, so the table is empty and nothing is refused', (id) => {
            const { table, refused, census } = tableOf(rulesOf(id));
            expect(census.locations).toBe(0);
            expect(table.size).toBe(0);
            expect(refused).toEqual([]);
        });

    it('the playthrough atlas (a measurement — its world is the VANILLA arm\'s): the tag law, per entity class', () => {
        const { entries, refused, census } = tableOf(rulesOf('seedling_playthrough'));
        const bound = Object.fromEntries(Object.entries(census.byEntity)
            .filter(([, c]) => c.bound > 0).map(([t, c]) => [t, c.bound]));
        expect(bound).toEqual({ chest: 16, health: 1, ghostsword: 1, firewand: 1 });
        const untagged = Object.fromEntries(Object.entries(census.byEntity)
            .filter(([, c]) => c.untagged > 0).map(([t, c]) => [t, c.untagged]));
        expect(untagged).toEqual({ bosskey: 5, totempart: 5, seed: 1 });
        const prop = Object.entries(census.byEntity).filter(([, c]) => c.propertyPath > 0).map(([t]) => t).sort();
        expect(prop).toEqual(['conch', 'darkshield', 'darksuit', 'feather', 'ghostspear', 'shield',
            'sword', 'torchpickup', 'wand']);
        expect(entries).toHaveLength(19);
        const encounters = refused.filter((r) => /no entity on tile/.test(r.why)).map((r) => r.location).sort();
        expect(encounters).toEqual(['Level 012 - Witch', 'Level 032 - Bob Boss']);
        expect(refused.find((r) => r.location === 'Level 010 - Sword').why)
            .toBe(ATLAS_CHECK_REFUSALS.propertyPath('sword', 'Sword'));
        expect(refused.find((r) => r.location === 'Level 030 - Torchpickup').why)
            .toBe(ATLAS_CHECK_REFUSALS.propertyPath('torchpickup', 'Light'));
        expect(refused.find((r) => r.location === 'Level 019 - Boss Key 0').why)
            .toBe(ATLAS_CHECK_REFUSALS.untagged('bosskey', 19));
        // A tile with two entities picks the one that GRANTS the item.
        expect(entries.find((e) => e.location === 'Level 038 - Chest')).toMatchObject({ entityType: 'chest', tag: 1 });
        expect(entries.find((e) => e.location === 'Level 040 - Chest')).toMatchObject({ entityType: 'chest', tag: 13 });
    });

    it('is deterministic: two builds are deep-equal', () => {
        for (const id of [...PIPELINE_REAL_ROOM_PRESETS, 'seedling_playthrough']) {
            const a = tableOf(rulesOf(id));
            const b = tableOf(rulesOf(id));
            expect(b.entries).toEqual(a.entries);
            expect(b.refused).toEqual(a.refused);
        }
    });
});

describe('seedlingAtlasCheckTable — the law, on edited documents', () => {
    const base = () => structuredClone(rulesOf('seedling_atlas'));
    const map86 = (edit) => {
        const map = structuredClone(MAP);
        edit(map.levels.find((l) => l.level === 86));
        return map;
    };
    const chestOf = (room) => room.entities.find((e) => e.type === 'chest');

    it('an untagged entity is refused by name (no rewrite → no tag to allocate into)', () => {
        const mapDoc = map86((room) => { delete chestOf(room).attrs.tag; });
        const { table, refused } = tableOf(base(), { mapDoc });
        expect(table.size).toBe(0);
        expect(refused).toEqual([{ location: 'Starting House - Chest', region: 'starting_house',
            why: ATLAS_CHECK_REFUSALS.untagged('chest', 86) }]);
    });

    it('two granting entities on the tile are refused, a non-granting neighbour is not', () => {
        const two = map86((room) => { room.entities.push({ ...chestOf(room), attrs: { tag: '5' } }); });
        expect(tableOf(base(), { mapDoc: two }).refused[0].why)
            .toBe(ATLAS_CHECK_REFUSALS.ambiguous(86, [3, 1], 'Seal', 2));
        const neighbour = map86((room) => { room.entities.push({ type: 'cover', x: 50, y: 18, attrs: {} }); });
        expect(tableOf(base(), { mapDoc: neighbour }).table.get('86|0').location).toBe('Starting House - Chest');
    });

    it('a moved entity is refused, naming what the tile holds', () => {
        const moved = map86((room) => { chestOf(room).x += 16; });
        expect(tableOf(base(), { mapDoc: moved }).refused[0].why)
            .toBe(ATLAS_CHECK_REFUSALS.noEntity(86, [3, 1], 'Seal', []));
    });

    it('a location with no placement is refused; a foreign item is bound and not for self', () => {
        expect(tableOf(base(), { locationItemOf: () => null }).refused[0].why)
            .toBe(ATLAS_CHECK_REFUSALS.noPlacement(null));
        const foreign = tableOf(base(), { locationItemOf: () => ({ name: 'Hookshot', player: 2 }) });
        expect(foreign.table.get('86|0')).toMatchObject({ item: 'Hookshot', player: 2, forSelf: false });
    });

    it('a location the atlas region does not carry is refused; so is a sidecar naming an unknown region', () => {
        const renamed = base();
        renamed.regions['1'].starting_house.locations[0].name = 'Starting House - Elsewhere';
        expect(tableOf(renamed, { locationItemOf: () => ({ name: 'Seal', player: 1 }) }).refused[0].why)
            .toBe(ATLAS_CHECK_REFUSALS.notInAtlas('starting_house'));
        const unknown = base();
        unknown.preset_sidecars['1'].starting_house.playable_payload.atlas_region = 'nowhere';
        expect(tableOf(unknown).refused[0].why).toBe(ATLAS_CHECK_REFUSALS.noAtlasRegion('starting_house', 'nowhere'));
    });

    it('two rules regions on one address: the second is refused, the first keeps it', () => {
        const twice = base();
        twice.preset_sidecars['1'].starting_house_again = structuredClone(twice.preset_sidecars['1'].starting_house);
        twice.regions['1'].starting_house_again = structuredClone(twice.regions['1'].starting_house);
        const { table, refused } = tableOf(twice);
        expect(table.get('86|0').region).toBe('starting_house');
        expect(refused).toEqual([{ location: 'Starting House - Chest', region: 'starting_house_again',
            why: ATLAS_CHECK_REFUSALS.sameAddress('86|0', 'Starting House - Chest') }]);
    });

    it('an injected fact that is missing throws, naming it', () => {
        expect(() => tableOf(base(), { tagOf: undefined })).toThrow(/`tagOf` is required/);
        expect(() => tableOf(base(), { placementKey: undefined })).toThrow(/`placementKey` is required/);
    });

    it('the property table: the eleven flags the adapter watches, and the chest is not one', () => {
        const p = propertyLocationOfFrom(GAME, ITEM_FOR_TAG);
        expect(p({ type: 'chest' })).toBeNull();
        expect(p({ type: 'health' })).toBeNull();
        expect(p({ type: 'wand' })).toBe('Wand');
        expect(p({ type: 'torchpickup' })).toBe('Light');
        expect(GAME.locations.map((l) => l.property)).not.toContain('chest');
    });
});
