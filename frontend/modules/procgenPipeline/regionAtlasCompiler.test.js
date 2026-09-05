// Unit tests for the region-atlas → vanilla rules.json compiler
// (CC/docs/plans/region-atlas-plan.md, Phase 3, projection 1).
//
// Two anchors, both read off disk rather than rebuilt inline:
//   - the Phase-1 INVENTED fixture, which exercises what the real starter atlas
//     deliberately does not (sub-region subgraphs -> compound `__` AP names,
//     one-way vs bidirectional internal exits, a start_sub_region, access rules
//     on boundary exits and locations);
//   - the real Seedling STARTER atlas, which exercises what the fixture does not
//     (unwired boundary exits omitted + reported, a placed vanilla item, and
//     both-direction connection exits over teleporters).
//
// The output is checked against frontend/schema/rules.schema.json itself, not
// against a hand-listed set of keys.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { stringifyRulesJson } from '../shared/rulesJsonBuilder.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { seedlingMazeProjectionDeps } from '../flashPanel/seedlingAtlasAnalysis.js';
import { MAZE_SUBSTRATE } from './regionAtlasMazeProjection.js';
import { apRegionName, stampAtlasIdentity } from './regionAtlasValidator.js';
import {
    compileRegionAtlas,
    formatCompileReport,
    apRegionNamesFor,
    apRegionNameForBinding,
    MENU_REGION,
    GAME_START_EXIT,
    substrateIdFor,
    regionSubstrateOf,
    compileDefaultSubstrate,
    regionAtlasReference,
    REGION_ATLAS_LOCATION_ID_BASE,
    REGION_ATLAS_ITEM_ID_BASE,
} from './regionAtlasCompiler.js';

const read = (relative) => JSON.parse(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'));

const FIXTURE = read('../flashPanel/atlases/seedling-fixture.json');
const STARTER = read('../flashPanel/atlases/seedling.json');
const MAP_DOC = read('../flashPanel/atlases/seedling-map.json');
const PRESET_PATH = fileURLToPath(new URL('../../presets/seedling_atlas/AP_1/AP_1_rules.json', import.meta.url));

const clone = (v) => JSON.parse(JSON.stringify(v));

const compileFixture = (options = {}) => compileRegionAtlas(clone(FIXTURE), options);
const compileStarter = (options = {}) => compileRegionAtlas(clone(STARTER), { mapDoc: MAP_DOC, ...options });

const regionsOf = (rules) => rules.regions['1'];
const exitsOf = (rules, regionName) => regionsOf(rules)[regionName].exits;
const exitTo = (rules, from, to) => exitsOf(rules, from).find((e) => e.connected_region === to);
const atlasRegion = (atlas, id) => atlas.regions.find((r) => r.region_id === id);

const GAME_CONFIG = read('../flashPanel/games/seedling.json');
const mazeDeps = () => seedlingMazeProjectionDeps({ mapDoc: MAP_DOC, gameConfig: GAME_CONFIG });

describe('AP naming', () => {
    it('goes through apRegionName — a region with a subgraph splits, one without does not', () => {
        expect(apRegionNamesFor(atlasRegion(FIXTURE, 'owls_nest'))).toEqual(['owls_nest']);
        expect(apRegionNamesFor(atlasRegion(FIXTURE, 'overworld_south'))).toEqual([
            apRegionName('overworld_south', 'shore'),
            apRegionName('overworld_south', 'island'),
            apRegionName('overworld_south', 'pit'),
        ]);
        expect(apRegionNamesFor(atlasRegion(FIXTURE, 'overworld_south'))).toEqual([
            'overworld_south__shore', 'overworld_south__island', 'overworld_south__pit',
        ]);
    });

    it('binds an exit/location to its sub-region, or to the bare region id', () => {
        expect(apRegionNameForBinding(atlasRegion(FIXTURE, 'overworld_south'), 'pit'))
            .toBe(apRegionName('overworld_south', 'pit'));
        expect(apRegionNameForBinding(atlasRegion(FIXTURE, 'owls_nest'), undefined))
            .toBe('owls_nest');
    });
});

describe('compiling the Phase-1 fixture (subgraphs, internal exits, start sub-region)', () => {
    const { rules, report } = compileFixture();

    it('emits one AP region per sub-region, plus Menu', () => {
        expect(Object.keys(regionsOf(rules))).toEqual([
            'owls_nest',
            'overworld_south__shore', 'overworld_south__island', 'overworld_south__pit',
            'gundernourd__entry', 'gundernourd__water',
            MENU_REGION,
        ]);
        expect(report.ap_regions).toBe(6);
        expect(report.ap_regions_incl_menu).toBe(7);
    });

    it('wires Menu to the start SUB-region, in the shape findStartRegion walks', () => {
        expect(rules.start_regions).toEqual({ 1: { default: [MENU_REGION], available: [] } });
        expect(regionsOf(rules)[MENU_REGION].exits).toEqual([{
            name: GAME_START_EXIT,
            connected_region: 'overworld_south__shore',
            access_rule: { rule: 'True_' },
        }]);
        expect(report.start_region).toBe('overworld_south__shore');
    });

    it('turns a bidirectional internal exit into TWO one-way AP exits, both carrying the rule', () => {
        const swim = { rule: 'Has', args: { item_name: 'Progressive Swim' } };
        expect(exitTo(rules, 'overworld_south__shore', 'overworld_south__island').access_rule).toEqual(swim);
        expect(exitTo(rules, 'overworld_south__island', 'overworld_south__shore').access_rule).toEqual(swim);
    });

    it('turns a one-way internal exit into ONE AP exit, in the declared direction', () => {
        expect(exitTo(rules, 'overworld_south__shore', 'overworld_south__pit')).toBeTruthy();
        expect(exitTo(rules, 'overworld_south__pit', 'overworld_south__shore')).toBeUndefined();
    });

    it('passes an access_rule tree through VERBATIM (nested And/Or included)', () => {
        const authored = atlasRegion(FIXTURE, 'gundernourd').subgraph.internal_exits[0].access_rule;
        expect(exitTo(rules, 'gundernourd__entry', 'gundernourd__water').access_rule).toEqual(authored);
        expect(exitTo(rules, 'gundernourd__water', 'gundernourd__entry').access_rule).toEqual(authored);
    });

    it('emits a vanilla_layout connection in BOTH directions, each with its SOURCE exit rule', () => {
        // overworld_south/rock_gap (no rule) <-> gundernourd/west_mouth (Red Key).
        expect(exitTo(rules, 'overworld_south__pit', 'gundernourd__entry').access_rule)
            .toEqual({ rule: 'True_' });
        expect(exitTo(rules, 'gundernourd__entry', 'overworld_south__pit').access_rule)
            .toEqual({ rule: 'Has', args: { item_name: 'Red Key' } });
    });

    it('binds a teleporter connection exactly like an edge one (kind is map metadata)', () => {
        // owls_nest/nest_ladder (teleporter) <-> gundernourd/pit_mouth (teleporter)
        expect(exitTo(rules, 'owls_nest', 'gundernourd__water')).toBeTruthy();
        expect(exitTo(rules, 'gundernourd__water', 'owls_nest')).toBeTruthy();
    });

    it('places every location in ITS sub-region with its vanilla item', () => {
        const names = (r) => regionsOf(rules)[r].locations.map((l) => l.name);
        expect(names('overworld_south__shore')).toEqual(['Chest (Spawn House)']);
        expect(names('overworld_south__island')).toEqual(['Chest (South Rocks)']);
        expect(names('gundernourd__water')).toEqual(['Chest (Gundernourd Water)']);
        const sword = regionsOf(rules).owls_nest.locations.find((l) => l.name === 'Sword');
        expect(sword.item).toEqual({
            name: 'Progressive Sword', player: 1, advancement: true, type: 'progression',
        });
    });

    it('keeps a location access_rule and drops nothing', () => {
        const chest = regionsOf(rules).owls_nest.locations.find((l) => l.name === "Chest (Owl's Nest)");
        expect(chest.access_rule).toEqual(atlasRegion(FIXTURE, 'owls_nest').locations[1].access_rule);
        expect(report.locations).toBe(6);
        expect(report.placed_items).toBe(6);
        expect(report.locations_without_item).toBe(0);
    });

    it('gives locations and items deterministic ids from a stable base + sorted index', () => {
        const ids = Object.values(regionsOf(rules))
            .flatMap((r) => r.locations).map((l) => l.id).sort((a, b) => a - b);
        expect(ids).toEqual([0, 1, 2, 3, 4, 5].map((i) => REGION_ATLAS_LOCATION_ID_BASE + i));
        // Sorted by name: "Blue Key" first.
        expect(rules.items['1']['Blue Key'].id).toBe(REGION_ATLAS_ITEM_ID_BASE);
        expect(Object.keys(rules.items['1'])).toEqual([...Object.keys(rules.items['1'])].sort());
    });

    it('does not collide with the flashPanel per-game ap_id_offset namespace', () => {
        const gameConfig = read('../flashPanel/games/seedling.json');
        expect(gameConfig.ap_id_offset).toBe(20000000);
        const ids = Object.values(regionsOf(rules)).flatMap((r) => r.locations).map((l) => l.id);
        expect(Math.min(...ids)).toBeGreaterThan(gameConfig.ap_id_offset + 1000000);
    });

    it('builds the item pool from the placed items', () => {
        expect(rules.itempool_counts['1']).toEqual({
            'Progressive Sword': 1, 'Green Key': 1, Health: 1,
            'Blue Key': 1, 'Progressive Shield': 1, 'Red Key': 1,
        });
        expect(rules.items['1']['Red Key']).toEqual({
            name: 'Red Key', id: expect.any(Number), groups: [],
            classification: 'progression', type: null, max_count: 1,
        });
    });

    it('records the atlas it came from, hash and all', () => {
        expect(rules.region_atlas).toEqual({ atlas_id: FIXTURE.atlas_id, game: 'seedling' });
        expect(rules.game_name).toBe('seedling');
        expect(rules.world['1'].world_directory).toBe('seedling');
        expect(rules.world_classes['1']).toBe('SeedlingWorld');
    });

    it('emits NO preset_sidecars — Phase 3 is graph-only (ruled 2026-07-27)', () => {
        expect(rules.preset_sidecars).toBeUndefined();
        expect(rules.procgen_metadata).toBeUndefined();
    });

    it('reports the fixture has nothing unwired', () => {
        expect(report.unwired_exits).toEqual([]);
        expect(report.atlas_valid).toBe(true);
        expect(report.atlas_warnings).toEqual([]);
    });
});

describe('compiling the real Seedling starter atlas', () => {
    const { rules, report } = compileStarter();

    // Phase 5a: two of the four regions carry an analyzer-computed subgraph, so
    // they project to one AP region PER SUB-REGION; the two with no traversal
    // obstacle keep their bare region_id.
    it('emits one AP region per sub-region, and a bare one where there is no split, plus Menu', () => {
        expect(Object.keys(regionsOf(rules))).toEqual([
            'overworld_start__r1c6', 'overworld_start__r2c13', 'overworld_start__r4c16',
            'overworld_start__r8c0', 'overworld_start__r11c19', 'overworld_start__r14c0',
            'starting_house', 'owls_nest_entrance',
            'dungeon1_room1__r0c4', 'dungeon1_room1__r8c6', MENU_REGION,
        ]);
        // The start sub-region is the one the start region's exits bind to.
        expect(regionsOf(rules)[MENU_REGION].exits[0].connected_region).toBe('overworld_start__r8c0');
    });

    it('OMITS the unwired boundary exits and names every one of them', () => {
        expect(report.unwired_exits).toEqual([
            { region_id: 'overworld_start', exit_id: 'west_crossing', kind: 'edge', side: 'W' },
            { region_id: 'overworld_start', exit_id: 'north_crossing', kind: 'edge', side: 'N' },
            { region_id: 'overworld_start', exit_id: 'east_crossing', kind: 'edge', side: 'E' },
            { region_id: 'overworld_start', exit_id: 'hut_door', kind: 'teleporter' },
            { region_id: 'overworld_start', exit_id: 'gundernourd_stairs', kind: 'teleporter' },
            { region_id: 'dungeon1_room1', exit_id: 'east_door', kind: 'teleporter' },
            { region_id: 'dungeon1_room1', exit_id: 'descent', kind: 'teleporter' },
            { region_id: 'dungeon1_room1', exit_id: 'west_door', kind: 'teleporter' },
        ]);
        // 7 authored exits in overworld_start, 5 of them unwired, and the 2 that
        // survive both bind to the sub-region the analyzer put them in.
        expect(atlasRegion(STARTER, 'overworld_start').exits).toHaveLength(7);
        expect(exitsOf(rules, 'overworld_start__r8c0')
            .filter((e) => !e.connected_region.startsWith('overworld_start__'))).toHaveLength(2);
        const summary = formatCompileReport(report).join('\n');
        expect(summary).toContain('8 boundary exit(s) unwired');
        expect(summary).toContain('dungeon1_room1/west_door (teleporter)');
    });

    it('emits both directions of each wired connection', () => {
        expect(exitTo(rules, 'overworld_start__r8c0', 'starting_house')).toBeTruthy();
        expect(exitTo(rules, 'starting_house', 'overworld_start__r8c0')).toBeTruthy();
        expect(exitTo(rules, 'overworld_start__r8c0', 'owls_nest_entrance')).toBeTruthy();
        expect(exitTo(rules, 'owls_nest_entrance', 'overworld_start__r8c0')).toBeTruthy();
        expect(exitTo(rules, 'owls_nest_entrance', 'dungeon1_room1__r0c4')).toBeTruthy();
        expect(exitTo(rules, 'dungeon1_room1__r0c4', 'owls_nest_entrance')).toBeTruthy();
        // 3 connections x 2 directions + GameStart + 16 internal-exit edges
        // (9 rows, 7 of them bidirectional).
        expect(report.exits).toBe(23);
    });

    it('places the one vanilla item the starter atlas records', () => {
        const chest = regionsOf(rules).starting_house.locations[0];
        expect(chest.name).toBe('Starting House - Chest');
        expect(chest.item).toEqual({ name: 'Seal', player: 1, advancement: true, type: 'progression' });
        expect(rules.itempool_counts['1']).toEqual({ Seal: 1 });
    });

    it('carries the atlas identity, map document included', () => {
        expect(rules.region_atlas).toEqual({
            atlas_id: STARTER.atlas_id, game: 'seedling', map_document: 'seedling-map.json',
        });
    });

    it('reports the atlas valid with only the unwired-exit warnings', () => {
        expect(report.atlas_valid).toBe(true);
        expect(report.atlas_warnings).toHaveLength(8);
        expect(report.atlas_warnings.every((w) => /is not wired by vanilla_layout/.test(w))).toBe(true);
    });
});

describe('projection 3 — play-time sidecars (Phase 4)', () => {
    const { rules, report } = compileStarter();
    const sidecars = rules.preset_sidecars['1'];
    const payload = (name) => sidecars[name].playable_payload;
    const exitOf = (name, exitId) => payload(name).exits.find((e) => e.exit_id === exitId);

    it('binds every region that names a real level to the per-game flash substrate', () => {
        expect(substrateIdFor('seedling')).toBe('flash_seedling');
        // One sidecar per AP region — a split region emits one per sub-region,
        // all sharing the parent's level (Phase-4 ruling 1).
        expect(Object.keys(sidecars)).toEqual([
            'overworld_start__r1c6', 'overworld_start__r2c13', 'overworld_start__r4c16',
            'overworld_start__r8c0', 'overworld_start__r11c19', 'overworld_start__r14c0',
            'starting_house', 'owls_nest_entrance',
            'dungeon1_room1__r0c4', 'dungeon1_room1__r8c6',
        ]);
        expect(Object.values(sidecars).every((s) => s.substrate === 'flash_seedling')).toBe(true);
        expect(report.substrate).toBe('flash_seedling');
        expect(report.regions_without_map_ref).toEqual([]);
    });

    it('carries the atlas identity, the level and the tile size in each payload', () => {
        expect(payload('starting_house')).toMatchObject({
            gameId: 'seedling',
            atlas_ref: STARTER.atlas_id,
            atlas_region: 'starting_house',
            level: 86,
            tile_size: 16,
        });
        expect(payload('overworld_start__r8c0')).toMatchObject({ level: 0, atlas_sub_region: 'r8c0' });
        expect(payload('overworld_start__r1c6').level).toBe(0);
        expect(payload('owls_nest_entrance').level).toBe(2);
        expect(payload('dungeon1_room1__r8c6')).toMatchObject({ level: 3, atlas_sub_region: 'r8c6' });
    });

    it('keys each exit on the AP exit NAME — the registry deserializer requires it', () => {
        // flashSubstrateLibrary.deserializeWorld keys the exits Map on
        // `exitName ?? exit_id`, and procgenPlayer.handleRegionMove looks a
        // crossing up by the AP exit name. A mismatch silently breaks moves.
        for (const [apRegion, sidecar] of Object.entries(sidecars)) {
            const graphExitNames = exitsOf(rules, apRegion).map((e) => e.name);
            for (const e of sidecar.playable_payload.exits) {
                expect(graphExitNames).toContain(e.exitName);
            }
        }
        expect(exitOf('overworld_start__r8c0', 'house_door').exitName)
            .toBe('overworld_start__r8c0 -> starting_house');
    });

    it('stamps the destination level and spawn pixels the crossing detector needs', () => {
        // entrance_tile [3,4] x tile_size 16 -> (48, 64), the spawn a player
        // arriving through starting_house/door lands on.
        expect(exitOf('overworld_start__r8c0', 'house_door')).toMatchObject({
            kind: 'teleporter',
            targetRegion: 'starting_house',
            targetExitId: 'door',
            target_level: 86,
            target_spawn: { x: 48, y: 64 },
            entrance_tile: [10, 17],
            entrance_spawn: { x: 160, y: 272 },
        });
        // ...and the return trip is the mirror image.
        expect(exitOf('starting_house', 'door')).toMatchObject({
            targetRegion: 'overworld_start__r8c0',
            targetExitId: 'house_door',
            target_level: 0,
            target_spawn: { x: 160, y: 272 },
            entrance_spawn: { x: 48, y: 64 },
        });
    });

    it('omits the unwired boundary exits — they have no destination to resolve', () => {
        expect(payload('overworld_start__r8c0').exits.map((e) => e.exit_id))
            .toEqual(['house_door', 'owls_nest_stairs']);
        expect(payload('owls_nest_entrance').exits.map((e) => e.exit_id))
            .toEqual(['stairs_up', 'descent']);
        // dungeon1_room1's three other doors are unwired, so only the way back
        // up survives — and it belongs to the sub-region it is IN.
        expect(payload('dungeon1_room1__r0c4').exits.map((e) => e.exit_id)).toEqual(['stairs_up']);
        expect(payload('dungeon1_room1__r8c6').exits).toEqual([]);
    });

    it('stamps the flashPanel wiring so a regeneration can no longer drop it', () => {
        expect(rules.flash_panel).toEqual({
            config: 'seedling.json', wasm: 'seedling_bot_ap_p4d/game.html',
        });
        // The flavour is named now that there are two of them (Phase 5b).
        expect(formatCompileReport(report).join('\n'))
            .toContain('projection 3 (flash): 10 region(s) bound to substrate flash_seedling');
        expect(report.sidecar_flavor).toBe('flash');
        expect(report.maze_notes).toBeNull();
    });

    it('the fixture names no map_ref, so it stays GRAPH-ONLY', () => {
        const { rules: fixtureRules, report: fixtureReport } = compileFixture();
        expect(fixtureRules.preset_sidecars).toBeUndefined();
        expect(fixtureRules.flash_panel).toBeUndefined();
        expect(fixtureReport.sidecar_regions).toEqual([]);
        expect(fixtureReport.regions_without_map_ref)
            .toEqual(['owls_nest', 'overworld_south', 'gundernourd']);
        expect(formatCompileReport(fixtureReport).join('\n'))
            .toContain('no region names a map_ref — graph-only');
    });

    it('a subgraph region gets one sidecar per sub-region, exits partitioned by binding', () => {
        // The starter atlas has no subgraph yet; the fixture has three, so give
        // its regions levels and check the split. Level-granular v1 binds every
        // sub-region of a region to the SAME level — a sub-region boundary is
        // not physically triggered (ruling 1), it only carries rules.
        const levelled = clone(FIXTURE);
        levelled.regions.forEach((r, i) => { r.map_ref = 10 + i; });
        levelled.tile_space.map_document = 'seedling-map.json';
        stampAtlasIdentity(levelled, 'seedling-fixture');
        const built = compileRegionAtlas(levelled).rules.preset_sidecars['1'];
        expect(Object.keys(built)).toEqual([
            'owls_nest',
            'overworld_south__shore', 'overworld_south__island', 'overworld_south__pit',
            'gundernourd__entry', 'gundernourd__water',
        ]);
        for (const name of ['overworld_south__shore', 'overworld_south__island', 'overworld_south__pit']) {
            expect(built[name].playable_payload.level).toBe(11);
            expect(built[name].playable_payload.atlas_region).toBe('overworld_south');
        }
        expect(built.overworld_south__shore.playable_payload.atlas_sub_region).toBe('shore');
        // north_pass binds to `shore`, rock_gap to `pit`; `island` has neither.
        expect(built.overworld_south__shore.playable_payload.exits.map((e) => e.exit_id))
            .toEqual(['north_pass']);
        expect(built.overworld_south__pit.playable_payload.exits.map((e) => e.exit_id))
            .toEqual(['rock_gap']);
        expect(built.overworld_south__island.playable_payload.exits).toEqual([]);
        // A crossing INTO a sub-region names that sub-region, not the parent.
        expect(built.owls_nest.playable_payload.exits.find((e) => e.exit_id === 'south_stair'))
            .toMatchObject({ targetRegion: 'overworld_south__shore', targetExitId: 'north_pass' });
    });

    it('a region whose neighbour has no map_ref still wires, with a null target level', () => {
        const mixed = clone(STARTER);
        delete atlasRegion(mixed, 'starting_house').map_ref;
        stampAtlasIdentity(mixed, 'seedling');
        const { rules: mixedRules, report: mixedReport } = compileRegionAtlas(mixed, { mapDoc: MAP_DOC });
        const built = mixedRules.preset_sidecars['1'];
        expect(Object.keys(built)).not.toContain('starting_house');
        expect(mixedReport.regions_without_map_ref).toEqual(['starting_house']);
        const door = built.overworld_start__r8c0.playable_payload.exits.find((e) => e.exit_id === 'house_door');
        expect(door.target_level).toBeNull();
        expect(door.target_spawn).toBeNull();
    });

    it('the substrate id and flashPanel wiring are overridable per compile', () => {
        const { rules: over } = compileStarter({
            substrateId: 'flash_other', flashPanel: { config: 'other.json' },
        });
        expect(over.preset_sidecars['1'].starting_house.substrate).toBe('flash_other');
        expect(over.flash_panel).toEqual({ config: 'other.json' });
    });
});

// ─── EDITOR INTEGRATION W1: the sidecar builder dispatches PER REGION ────────
//
// The compiler used to pick ONE substrate per compile and forbid mixing by
// ruling. The law that survives is narrower — one sidecar per AP region — and
// the flavour is now only the DEFAULT (plan §2.2 #2). The rows below are the
// mixed compile in both directions plus the two refusals that keep the table
// honest about being this module's whole roster.
describe('per-region substrate dispatch (EDITOR INTEGRATION W1)', () => {
    // A two-region atlas: `starting_house` (no subgraph, one AP region) is set
    // to the maze; `owls_nest_entrance` (no subgraph either) is left alone and
    // therefore plays the compile default. Both name a real level, so both bind.
    const twoRegionAtlas = (substrateOfHouse) => {
        const atlas = clone(STARTER);
        atlas.regions = atlas.regions.filter(
            (r) => r.region_id === 'starting_house' || r.region_id === 'owls_nest_entrance',
        );
        // Drop the wiring that named the regions we removed, or the graph refuses.
        const kept = new Set(atlas.regions.map((r) => r.region_id));
        atlas.vanilla_layout.connections = atlas.vanilla_layout.connections
            .filter((c) => kept.has(c.from[0]) && kept.has(c.to[0]));
        atlas.vanilla_layout.start_region = 'starting_house';
        delete atlas.vanilla_layout.start_sub_region;
        if (substrateOfHouse !== undefined) atlasRegion(atlas, 'starting_house').substrate = substrateOfHouse;
        stampAtlasIdentity(atlas, 'seedling');
        return atlas;
    };

    it('resolves the region\'s own field first, this compile\'s default second', () => {
        const atlas = twoRegionAtlas(MAZE_SUBSTRATE);
        const house = atlasRegion(atlas, 'starting_house');
        const nest = atlasRegion(atlas, 'owls_nest_entrance');
        expect(regionSubstrateOf(house, atlas, {})).toBe(MAZE_SUBSTRATE);
        expect(regionSubstrateOf(nest, atlas, {})).toBe('flash_seedling');
        // ...and the default is what the old one-substrate-per-compile line said.
        expect(compileDefaultSubstrate(atlas, {})).toBe(substrateIdFor(atlas.game));
        expect(compileDefaultSubstrate(atlas, { sidecarFlavor: 'maze' })).toBe(MAZE_SUBSTRATE);
        expect(compileDefaultSubstrate(atlas, { substrateId: 'flash_other' })).toBe('flash_other');
        // An EMPTY string is not an override — the validator refuses it, and an
        // allowInvalid compile must not look up a row nobody can spell.
        expect(regionSubstrateOf({ region_id: 'x', substrate: '' }, atlas, {})).toBe('flash_seedling');
    });

    it('MIXES: one flash sidecar and one maze sidecar from ONE flash-default compile', () => {
        const { rules, report } = compileRegionAtlas(twoRegionAtlas(MAZE_SUBSTRATE), {
            mapDoc: MAP_DOC, mazeProjection: mazeDeps(),
        });
        const sidecars = rules.preset_sidecars['1'];
        expect(Object.keys(sidecars).sort()).toEqual(['owls_nest_entrance', 'starting_house']);
        expect(sidecars.starting_house.substrate).toBe(MAZE_SUBSTRATE);
        expect(sidecars.owls_nest_entrance.substrate).toBe('flash_seedling');

        // ⛓ The two payloads are the two BUILDERS' own shapes, not one shape
        // wearing two labels — which is what makes the mutant "the field ignored
        // by the compiler" (two identical sidecars) red rather than cosmetic.
        expect(sidecars.starting_house.playable_payload).toHaveProperty('tiles');
        expect(sidecars.starting_house.playable_payload).not.toHaveProperty('gameId');
        expect(sidecars.owls_nest_entrance.playable_payload).toHaveProperty('gameId', 'seedling');
        expect(sidecars.owls_nest_entrance.playable_payload).not.toHaveProperty('tiles');

        expect(report.substrates).toEqual({ [MAZE_SUBSTRATE]: 1, flash_seedling: 1 });
        // The DEFAULT is still reported, and it is still the flash id.
        expect(report.substrate).toBe('flash_seedling');
        expect(report.sidecar_flavor).toBe('flash');
    });

    it('the flash_panel wiring follows "did ANY region compile flash", not the flavour', () => {
        // A mixed preset's Seedling rooms are the REAL game and still need the
        // block that boots it; an all-maze one still must not have it.
        const mixed = compileRegionAtlas(twoRegionAtlas(MAZE_SUBSTRATE), {
            mapDoc: MAP_DOC, mazeProjection: mazeDeps(),
        });
        expect(mixed.rules.flash_panel).toEqual({ config: 'seedling.json', wasm: 'seedling_bot_ap_p4d/game.html' });

        const allMaze = compileRegionAtlas(twoRegionAtlas(undefined), {
            mapDoc: MAP_DOC, sidecarFlavor: 'maze', mazeProjection: mazeDeps(),
        });
        expect(allMaze.rules.flash_panel).toBeUndefined();

        // ⛓ THE ROW THAT DISCRIMINATES. The two cases above pass under the OLD
        // `if (!mazeFlavor)` condition too — they only mix in the flash-default
        // direction, where the flavour and "any flash region" agree. The mixed
        // compile that separates them is the REVERSE one: flavour `maze`, and a
        // region that declares flash anyway. `!mazeFlavor` drops the wiring and
        // ships a preset whose real Seedling room has nothing to boot it.
        const mazeDefaultMixed = clone(twoRegionAtlas(undefined));
        atlasRegion(mazeDefaultMixed, 'starting_house').substrate = 'flash_seedling';
        stampAtlasIdentity(mazeDefaultMixed, 'seedling');
        const reverse = compileRegionAtlas(mazeDefaultMixed, {
            mapDoc: MAP_DOC, sidecarFlavor: 'maze', mazeProjection: mazeDeps(),
        });
        expect(reverse.report.substrates).toEqual({ flash_seedling: 1, [MAZE_SUBSTRATE]: 1 });
        expect(reverse.rules.flash_panel).toEqual({ config: 'seedling.json', wasm: 'seedling_bot_ap_p4d/game.html' });
    });

    it('the SAME atlas compiled --maze yields two maze sidecars — the field agrees with the default', () => {
        const { rules, report } = compileRegionAtlas(twoRegionAtlas(MAZE_SUBSTRATE), {
            mapDoc: MAP_DOC, sidecarFlavor: 'maze', mazeProjection: mazeDeps(),
        });
        const sidecars = rules.preset_sidecars['1'];
        for (const sc of Object.values(sidecars)) expect(sc.substrate).toBe(MAZE_SUBSTRATE);
        expect(report.substrates).toEqual({ [MAZE_SUBSTRATE]: 2 });
        expect(rules.flash_panel).toBeUndefined();
    });

    it('counts SIDECAR ENTRIES, not regions and not options — a subgraph splits', () => {
        // `overworld_start` has a 6-sub-region subgraph, so it alone emits six
        // sidecars. A count read off the options or off the atlas regions would
        // say 4; the file says 10.
        const { rules, report } = compileStarter();
        expect(report.substrates).toEqual({ flash_seedling: Object.keys(rules.preset_sidecars['1']).length });
        expect(report.substrates.flash_seedling).toBe(10);
    });

    it('a region with no map_ref is in NEITHER count — nothing plays a graph-only region', () => {
        const atlas = twoRegionAtlas(MAZE_SUBSTRATE);
        delete atlasRegion(atlas, 'owls_nest_entrance').map_ref;
        stampAtlasIdentity(atlas, 'seedling');
        const { report } = compileRegionAtlas(atlas, { mapDoc: MAP_DOC, mazeProjection: mazeDeps() });
        expect(report.regions_without_map_ref).toEqual(['owls_nest_entrance']);
        expect(report.substrates).toEqual({ [MAZE_SUBSTRATE]: 1 });
    });

    it('REFUSES a region naming a substrate the table has no builder for, BY NAME', () => {
        const atlas = twoRegionAtlas('bounce');
        expect(() => compileRegionAtlas(atlas, { mapDoc: MAP_DOC, mazeProjection: mazeDeps() }))
            .toThrow(/atlas region "starting_house" names substrate "bounce", which this compile has no sidecar builder for/);
        // The refusal NAMES the roster, because the roster is this table and
        // there is no registry here to point at.
        expect(() => compileRegionAtlas(atlas, { mapDoc: MAP_DOC, mazeProjection: mazeDeps() }))
            .toThrow(/Buildable here: flash_seedling, maze/);
    });

    /* ══════════════════════════════════════════════════════════════
     * ⛓⛓⛓ `options.sidecarBuilders` — EDITOR INTEGRATION W2
     * ══════════════════════════════════════════════════════════════ */

    /**
     * ⛔ **AN INJECTED ROW IS A REAL ROW: IT BUILDS, AND THE REFUSAL LISTS IT.**
     * W1 §7.7 recommended this shape over a third literal row because the
     * precedent is already in the file — `options.mazeProjection` injects the
     * GAME's half of the maze row for exactly this reason. ⛔ mutant: build the
     * table and ignore `options.sidecarBuilders`; both halves of this row go red.
     */
    it('an INJECTED sidecar builder compiles its own regions, and the refusal lists it', () => {
        const atlas = twoRegionAtlas('bounce');
        const seen = [];
        const { rules, report } = compileRegionAtlas(atlas, {
            mapDoc: MAP_DOC,
            mazeProjection: mazeDeps(),
            sidecarBuilders: {
                bounce: (region, id) => {
                    seen.push([region.region_id, id]);
                    return {
                        sidecars: { [region.region_id]: { substrate: id, playable_payload: { bounceLevel: region.map_ref } } },
                        bound: true,
                    };
                },
            },
        });
        // it was CALLED with (region, substrateId) — the built-in rows' own shape
        expect(seen).toEqual([['starting_house', 'bounce']]);
        const sidecars = rules.preset_sidecars['1'];
        expect(sidecars.starting_house.substrate).toBe('bounce');
        expect(sidecars.starting_house.playable_payload)
            .toEqual({ bounceLevel: atlasRegion(atlas, 'starting_house').map_ref });
        // …and the OTHER region still went down the built-in flash row.
        expect(sidecars.owls_nest_entrance.substrate).toBe('flash_seedling');
        expect(report.substrates).toEqual({ bounce: 1, flash_seedling: 1 });
        // ⛓ the "Buildable here:" list is DERIVED from the MERGED table
        expect(() => compileRegionAtlas(twoRegionAtlas('runner'), {
            mapDoc: MAP_DOC, mazeProjection: mazeDeps(), sidecarBuilders: { bounce: () => ({}) },
        })).toThrow(/Buildable here: flash_seedling, maze, bounce/);
    });

    /**
     * ⚠ **AND IT MAY REPLACE A BUILT-IN ROW — SAID OUT LOUD IN THE TABLE'S OWN
     * COMMENT AND PINNED HERE.** The merge is OVER, so a colliding key wins;
     * that is what a second flash-family game would want, and pretending
     * otherwise would be a guard nobody could get past.
     */
    it('an injected row REPLACES the built-in one of the same id', () => {
        const { rules } = compileRegionAtlas(twoRegionAtlas(), {
            mapDoc: MAP_DOC,
            sidecarBuilders: {
                flash_seedling: (region, id) => ({
                    sidecars: { [region.region_id]: { substrate: id, playable_payload: { replaced: true } } },
                    bound: true,
                }),
            },
        });
        for (const entry of Object.values(rules.preset_sidecars['1'])) {
            expect(entry.playable_payload).toEqual({ replaced: true });
        }
    });

    it('REFUSES a `sidecarBuilders` value that is not a function, by id and by type', () => {
        expect(() => compileRegionAtlas(twoRegionAtlas(), {
            mapDoc: MAP_DOC, sidecarBuilders: { bounce: 'nope' },
        })).toThrow(/options\.sidecarBuilders\["bounce"\] is a string/);
        expect(() => compileRegionAtlas(twoRegionAtlas(), {
            mapDoc: MAP_DOC, sidecarBuilders: { bounce: 'nope' },
        })).toThrow(/\(region, substrateId\) => \{sidecars, bound, notes\?\}/);
    });

    /**
     * ⛔ **W1'S ROWS ARE UNMOVED WITH THE OPTION ABSENT.** The whole point of a
     * merge OVER the built-ins is that a compile that names none is the compile
     * it was yesterday — pinned here rather than assumed.
     */
    it('with no `sidecarBuilders` the table is exactly the built-in two', () => {
        expect(() => compileRegionAtlas(twoRegionAtlas('bounce'), {
            mapDoc: MAP_DOC, mazeProjection: mazeDeps(),
        })).toThrow(/Buildable here: flash_seedling, maze/);
        expect(() => compileRegionAtlas(twoRegionAtlas('bounce'), {
            mapDoc: MAP_DOC, mazeProjection: mazeDeps(), sidecarBuilders: {},
        })).toThrow(/Buildable here: flash_seedling, maze/);
    });

    it('REFUSES a maze region when the caller passed no mazeProjection, naming the region', () => {
        // The old refusal fired on the FLAVOUR, before any region was looked at.
        // A region can now ask for the maze on its own, so the refusal has to
        // name which one did — and keep saying which option is missing.
        expect(() => compileRegionAtlas(twoRegionAtlas(MAZE_SUBSTRATE), { mapDoc: MAP_DOC }))
            .toThrow(/atlas region "starting_house" compiles to substrate "maze"/);
        expect(() => compileRegionAtlas(twoRegionAtlas(MAZE_SUBSTRATE), { mapDoc: MAP_DOC }))
            .toThrow(/sidecarFlavor "maze" needs options\.mazeProjection\.\{gridFor,conditionKey,resolveCondition\}/);
    });

    it('`substrateId` RELABELS the flash builder — both spellings resolve to it', () => {
        // Its one caller is the marking tool's "export as another game", which
        // means it must not read as "a different substrate the table lacks".
        const atlas = twoRegionAtlas('flash_seedling');
        const { rules, report } = compileRegionAtlas(atlas, {
            mapDoc: MAP_DOC, substrateId: 'flash_other', flashPanel: { config: 'other.json' },
        });
        const sidecars = rules.preset_sidecars['1'];
        // The region that SPELLED flash_seedling keeps it; the one that named
        // nothing takes the relabel.
        expect(sidecars.starting_house.substrate).toBe('flash_seedling');
        expect(sidecars.owls_nest_entrance.substrate).toBe('flash_other');
        expect(report.substrates).toEqual({ flash_seedling: 1, flash_other: 1 });
        expect(rules.flash_panel).toEqual({ config: 'other.json' });
    });
});

/**
 * ⛓⛓⛓ **THE CROSS-SUBSTRATE DOOR** (EDITOR INTEGRATION W6, plan §11.1 A3 /
 * §11.3 / §11.6 item 1).
 *
 * ⛔ **THIS IS A CORRECTNESS FIX, NOT M1 PREPARATION.** Before it, a flash exit
 * whose target region is played by ANOTHER substrate copied that region's
 * `map_ref` into `target_level` — and a maze region's `map_ref` is its LIBRARY
 * ENTRY INDEX, an integer from a different numbering entirely. MEASURED on W2's
 * chain world: `seed.level_1` carried TWO exits claiming `target_level: 0`, and
 * `resolveCrossingExit`'s two-candidate tie-break sent a crossing back to
 * Seedling level 0 through the MAZE door whenever the reported spawn was nearer
 * the maze entrance. `worldChain.test.js` holds that row over the real world.
 *
 * The fixture here is the same starter atlas the rest of this file reads, cut to
 * the ONE pair the committed document actually wires across
 * (`overworld_start/house_door` -> `starting_house/door`) with the house moved
 * to the maze — so the crossing is derived from the committed connection list,
 * never authored for the row.
 */
describe('cross-substrate exits — `external` (EDITOR INTEGRATION W6, H1)', () => {
    /**
     * `overworld_start` (6 sub-regions, flash) wired to `starting_house`. With
     * `substrateOfHouse` set the door crosses a boundary; with it left undefined
     * the SAME atlas is single-substrate, which is this row's own control.
     */
    const crossingAtlas = (substrateOfHouse) => {
        const atlas = clone(STARTER);
        atlas.regions = atlas.regions.filter(
            (r) => r.region_id === 'overworld_start' || r.region_id === 'starting_house',
        );
        const kept = new Set(atlas.regions.map((r) => r.region_id));
        atlas.vanilla_layout.connections = atlas.vanilla_layout.connections
            .filter((c) => kept.has(c.from[0]) && kept.has(c.to[0]));
        if (substrateOfHouse !== undefined) atlasRegion(atlas, 'starting_house').substrate = substrateOfHouse;
        stampAtlasIdentity(atlas, 'seedling');
        return atlas;
    };
    const compileCrossing = (substrateOfHouse) => compileRegionAtlas(crossingAtlas(substrateOfHouse), {
        mapDoc: MAP_DOC, mazeProjection: mazeDeps(),
    });
    /** The one AP region of `overworld_start` the house door belongs to. */
    const HOUSE_SIDE = 'overworld_start__r8c0';
    const houseDoor = (rules) => rules.preset_sidecars['1'][HOUSE_SIDE]
        .playable_payload.exits.find((e) => e.exit_id === 'house_door');

    it('marks the door EXTERNAL, names the far substrate, and NULLS both level fields', () => {
        const { rules, report } = compileCrossing(MAZE_SUBSTRATE);
        const door = houseDoor(rules);
        expect(door.external).toBe(true);
        expect(door.target_substrate).toBe(MAZE_SUBSTRATE);
        // ⛔ THE LIE, GONE. `starting_house`'s map_ref is a Seedling level id
        // here, so the pre-fix value was a well-formed integer — which is
        // exactly why nothing caught it.
        expect(door.target_level).toBeNull();
        expect(door.target_spawn).toBeNull();
        // …and the graph half is untouched: the AP exit still crosses.
        expect(door.targetRegion).toBe('starting_house');
        expect(report.external_exits).toBe(1);
    });

    /**
     * ⛔⛔ **THE CONTROL, AND IT IS WHAT MAKES THE ROW ABOVE A DIFFERENCE.**
     * The same atlas with the house left on the compile default: the SAME door,
     * a real `target_level`, and NO `external` key at all.
     */
    it('the same door inside ONE substrate keeps its real target_level and gains NO field', () => {
        const { rules, report } = compileCrossing(undefined);
        const door = houseDoor(rules);
        expect(door.target_level).toBe(atlasRegion(STARTER, 'starting_house').map_ref);
        expect(Number.isInteger(door.target_level)).toBe(true);
        expect(door.target_spawn).toEqual(expect.objectContaining({ x: expect.any(Number) }));
        expect('external' in door).toBe(false);
        expect('target_substrate' in door).toBe(false);
        expect(report.external_exits).toBe(0);
    });

    /**
     * ⛔⛔ **PRESENT-OR-ABSENT IS THE BYTE PIN** (§11.3). A boolean written on
     * every exit would move every committed flash sidecar — the §7.4 md5s. This
     * row is that pin's shape, asserted over the WHOLE committed starter
     * compile rather than over one exit.
     */
    it('NO exit of the committed single-substrate compile carries the key AT ALL', () => {
        const { rules, report } = compileStarter();
        const all = Object.values(rules.preset_sidecars['1'])
            .flatMap((sc) => sc.playable_payload.exits ?? []);
        expect(all.length).toBeGreaterThan(0);
        expect(all.filter((e) => 'external' in e || 'target_substrate' in e)).toEqual([]);
        expect(report.external_exits).toBe(0);
    });

    /** ⛓ and the count is a REPORT line only when there is something to say. */
    it('formatCompileReport names the crossings, and says nothing when there are none', () => {
        const mixed = formatCompileReport(compileCrossing(MAZE_SUBSTRATE).report).join('\n');
        expect(mixed).toMatch(/1 exit\(s\) CROSS a substrate boundary/);
        expect(formatCompileReport(compileCrossing(undefined).report).join('\n'))
            .not.toMatch(/CROSS a substrate boundary/);
    });
});

describe('schema conformance', () => {
    it('the fixture compiles to a schema-valid rules.json', () => {
        expect(rulesJsonSchemaErrors(compileFixture().rules, loadRulesSchema())).toEqual([]);
    });

    it('the starter atlas compiles to a schema-valid rules.json', () => {
        expect(rulesJsonSchemaErrors(compileStarter().rules, loadRulesSchema())).toEqual([]);
    });

    it('every emitted exit and location carries the keys the schema requires', () => {
        const { rules } = compileFixture();
        for (const region of Object.values(regionsOf(rules))) {
            expect(Object.keys(region).sort()).toEqual(['exits', 'locations', 'name']);
            for (const exit of region.exits) {
                expect(Object.keys(exit).sort()).toEqual(['access_rule', 'connected_region', 'name']);
            }
            for (const loc of region.locations) {
                expect(loc).toHaveProperty('id');
                expect(loc).toHaveProperty('access_rule');
            }
        }
    });

    it('AP exit names are globally unique — they are the entrance identity downstream', () => {
        const { rules } = compileFixture();
        const names = Object.values(regionsOf(rules)).flatMap((r) => r.exits).map((e) => e.name);
        expect(new Set(names).size).toBe(names.length);
    });
});

describe('determinism', () => {
    it('compiling the same atlas twice is byte-identical', () => {
        expect(stringifyRulesJson(compileStarter().rules))
            .toBe(stringifyRulesJson(compileStarter().rules));
        expect(stringifyRulesJson(compileFixture().rules))
            .toBe(stringifyRulesJson(compileFixture().rules));
    });

    it('the COMMITTED seedling_atlas preset is exactly what the atlas compiles to', () => {
        // The gate scripts/procgen/region-atlas-compile.mjs --check enforces on
        // the command line, enforced here too: an atlas edit that is not
        // followed by a recompile fails the suite.
        expect(readFileSync(PRESET_PATH, 'utf8'))
            .toBe(`${stringifyRulesJson(compileStarter().rules)}\n`);
    });
});

describe('refusals', () => {
    it('refuses to compile an atlas that does not validate', () => {
        const broken = clone(STARTER);
        broken.vanilla_layout.start_region = 'nope';
        expect(() => compileRegionAtlas(broken, { mapDoc: MAP_DOC }))
            .toThrow(/does not validate/);
    });

    it('compiles anyway under allowInvalid, carrying the errors in the report', () => {
        const broken = clone(STARTER);
        broken.vanilla_layout.start_region = 'nope';
        const { rules, report } = compileRegionAtlas(broken, { mapDoc: MAP_DOC, allowInvalid: true });
        expect(report.atlas_valid).toBe(false);
        expect(report.atlas_errors.length).toBeGreaterThan(0);
        // No resolvable start: Menu exists but leads nowhere, rather than
        // silently pointing at whichever region happened to be first.
        expect(regionsOf(rules)[MENU_REGION].exits).toEqual([]);
        expect(report.start_region).toBeNull();
    });

    it('refuses an atlas region that would collide with the reserved Menu region', () => {
        const collide = clone(STARTER);
        // A region with NO subgraph, so it projects onto its bare region_id —
        // a split region would project onto `Menu__<sub>` and collide with
        // nothing.
        atlasRegion(collide, 'starting_house').region_id = MENU_REGION;
        expect(() => compileRegionAtlas(collide, { mapDoc: MAP_DOC, allowInvalid: true }))
            .toThrow(/reserves for the start region/);
    });
});

/**
 * ⛓⛓⛓ APWORLD EDITOR HUB slice H5 — **THE `region_atlas` BLOCK IS ONE
 * DERIVATION, AND THE COMPILER IS ITS ONLY AUTHOR.** The hub's Document-tab
 * door writes this block too (when the marking tool hands a saved atlas back),
 * so the rows below pin the two together: the function must reproduce what a
 * full compile emits, or the second door writes a reference the first one would
 * not recognise.
 */
describe('regionAtlasReference — the block the compiler writes, hoisted', () => {
    it('⛓⛓ is BYTE-EQUAL to what a full compile puts in rules.region_atlas', () => {
        for (const atlas of [FIXTURE, STARTER]) {
            const { rules } = compileRegionAtlas(atlas, { mapDoc: MAP_DOC, allowInvalid: true });
            expect(regionAtlasReference(atlas)).toEqual(rules.region_atlas);
        }
    });

    it('⛓ carries the atlas id, the game, and map_document only when the atlas '
        + 'declares a tile space', () => {
        // The starter declares one; the fixture does not (measured on disk).
        expect(regionAtlasReference(STARTER)).toEqual({
            atlas_id: STARTER.atlas_id,
            game: STARTER.game,
            map_document: STARTER.tile_space.map_document,
        });
        expect(FIXTURE.tile_space?.map_document).toBeUndefined();
        expect(regionAtlasReference(FIXTURE)).toEqual({
            atlas_id: FIXTURE.atlas_id, game: FIXTURE.game,
        });
        expect('map_document' in regionAtlasReference(FIXTURE)).toBe(false);
    });

    it('⛔ reads the STAMPED id, so a restamp moves the reference', () => {
        const edited = clone(STARTER);
        edited.regions = edited.regions.slice(0, 1);
        const restamped = stampAtlasIdentity(edited, 'seedling');
        expect(restamped.atlas_id).not.toBe(STARTER.atlas_id);
        expect(regionAtlasReference(restamped).atlas_id).toBe(restamped.atlas_id);
    });

    it('⛔ the COMMITTED carriers hold a REFERENCE and no atlas — the fact the '
        + "hub's door is built on", () => {
        // Three presets carry `region_atlas`; every one of them is exactly the
        // three-field reference, so nothing downstream can rebuild the atlas.
        for (const name of ['seedling_atlas', 'seedling_atlas_maze', 'seedling_playthrough']) {
            const doc = read(`../../presets/${name}/AP_1/AP_1_rules.json`);
            expect(Object.keys(doc.region_atlas).sort())
                .toEqual(['atlas_id', 'game', 'map_document']);
            expect(doc.region_atlas.regions).toBeUndefined();
        }
    });
});
