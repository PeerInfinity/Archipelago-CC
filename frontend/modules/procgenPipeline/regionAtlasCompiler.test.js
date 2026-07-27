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
import { rulesJsonSchemaErrors } from '../runnerDemo/ruleSchemaCheck.js';
import { apRegionName, stampAtlasIdentity } from './regionAtlasValidator.js';
import {
    compileRegionAtlas,
    formatCompileReport,
    apRegionNamesFor,
    apRegionNameForBinding,
    MENU_REGION,
    GAME_START_EXIT,
    substrateIdFor,
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

    it('emits one AP region per atlas region (none has a subgraph yet), plus Menu', () => {
        expect(Object.keys(regionsOf(rules)))
            .toEqual(['overworld_start', 'starting_house', 'owls_nest_entrance', MENU_REGION]);
        expect(regionsOf(rules)[MENU_REGION].exits[0].connected_region).toBe('overworld_start');
    });

    it('OMITS the unwired boundary exits and names every one of them', () => {
        expect(report.unwired_exits).toEqual([
            { region_id: 'overworld_start', exit_id: 'west_crossing', kind: 'edge', side: 'W' },
            { region_id: 'overworld_start', exit_id: 'north_crossing', kind: 'edge', side: 'N' },
            { region_id: 'overworld_start', exit_id: 'east_crossing', kind: 'edge', side: 'E' },
            { region_id: 'overworld_start', exit_id: 'hut_door', kind: 'teleporter' },
            { region_id: 'overworld_start', exit_id: 'gundernourd_stairs', kind: 'teleporter' },
            { region_id: 'owls_nest_entrance', exit_id: 'descent', kind: 'teleporter' },
        ]);
        // 7 authored exits in overworld_start, 5 of them unwired -> 2 AP exits.
        expect(atlasRegion(STARTER, 'overworld_start').exits).toHaveLength(7);
        expect(exitsOf(rules, 'overworld_start')).toHaveLength(2);
        const summary = formatCompileReport(report).join('\n');
        expect(summary).toContain('6 boundary exit(s) unwired');
        expect(summary).toContain('owls_nest_entrance/descent (teleporter)');
    });

    it('emits both directions of each wired connection', () => {
        expect(exitTo(rules, 'overworld_start', 'starting_house')).toBeTruthy();
        expect(exitTo(rules, 'starting_house', 'overworld_start')).toBeTruthy();
        expect(exitTo(rules, 'overworld_start', 'owls_nest_entrance')).toBeTruthy();
        expect(exitTo(rules, 'owls_nest_entrance', 'overworld_start')).toBeTruthy();
        expect(report.exits).toBe(5); // 2 connections x 2 directions + GameStart
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
        expect(report.atlas_warnings).toHaveLength(6);
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
        expect(Object.keys(sidecars))
            .toEqual(['overworld_start', 'starting_house', 'owls_nest_entrance']);
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
        expect(payload('overworld_start').level).toBe(0);
        expect(payload('owls_nest_entrance').level).toBe(2);
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
        expect(exitOf('overworld_start', 'house_door').exitName)
            .toBe('overworld_start -> starting_house');
    });

    it('stamps the destination level and spawn pixels the crossing detector needs', () => {
        // entrance_tile [3,4] x tile_size 16 -> (48, 64), the spawn a player
        // arriving through starting_house/door lands on.
        expect(exitOf('overworld_start', 'house_door')).toMatchObject({
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
            targetRegion: 'overworld_start',
            targetExitId: 'house_door',
            target_level: 0,
            target_spawn: { x: 160, y: 272 },
            entrance_spawn: { x: 48, y: 64 },
        });
    });

    it('omits the unwired boundary exits — they have no destination to resolve', () => {
        expect(payload('overworld_start').exits.map((e) => e.exit_id))
            .toEqual(['house_door', 'owls_nest_stairs']);
        expect(payload('owls_nest_entrance').exits.map((e) => e.exit_id)).toEqual(['stairs_up']);
    });

    it('stamps the flashPanel wiring so a regeneration can no longer drop it', () => {
        expect(rules.flash_panel).toEqual({
            config: 'seedling.json', wasm: 'seedling_teleport_ap/game.html',
        });
        expect(formatCompileReport(report).join('\n'))
            .toContain('projection 3: 3 region(s) bound to substrate flash_seedling');
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
        expect(Object.keys(built)).toEqual(['overworld_start', 'owls_nest_entrance']);
        expect(mixedReport.regions_without_map_ref).toEqual(['starting_house']);
        const door = built.overworld_start.playable_payload.exits.find((e) => e.exit_id === 'house_door');
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

describe('schema conformance', () => {
    it('the fixture compiles to a schema-valid rules.json', () => {
        expect(rulesJsonSchemaErrors(compileFixture().rules)).toEqual([]);
    });

    it('the starter atlas compiles to a schema-valid rules.json', () => {
        expect(rulesJsonSchemaErrors(compileStarter().rules)).toEqual([]);
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
        collide.regions[0].region_id = MENU_REGION;
        expect(() => compileRegionAtlas(collide, { mapDoc: MAP_DOC, allowInvalid: true }))
            .toThrow(/reserves for the start region/);
    });
});
