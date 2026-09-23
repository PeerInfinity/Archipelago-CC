/**
 * ⛓⛓⛓ SEEDLING IN THE PIPELINE T1 — `flash_seedling` AS A ZONE CONTENT SOURCE.
 *
 * The entry's `zoneCount` / `extractZoneRules` / `applyPipelineConfig` /
 * `serializeWorld` (`flashSeedlingLibrary.js` § `buildSeedlingContentSource`).
 * Every expectation below is DERIVED from an independent `compileRegionAtlas`
 * of the same atlas or from the committed `seedling_atlas` preset — the content
 * source must be that compile, not a second reading of the atlas.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, afterEach } from 'vitest';

import {
    substrateRegistryEntry as entry,
    buildSeedlingContentSource,
    SEEDLING_STARTER_ATLAS,
    FLASH_SEEDLING_SUBSTRATE_ID,
} from './flashSeedlingLibrary.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { boundaryRule } from '../procgenPipeline/regionAtlasPool.js';
import { stampAtlasIdentity } from '../procgenPipeline/regionAtlasValidator.js';

const readJson = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const STARTER_FILE = readJson('./atlases/seedling.json');
const COMMITTED = readJson('../../presets/seedling_atlas/AP_1/AP_1_rules.json');

const compiled = compileRegionAtlas(SEEDLING_STARTER_ATLAS);
const compiledSidecars = Object.entries(compiled.rules.preset_sidecars['1'])
    .filter(([, s]) => s.substrate === FLASH_SEEDLING_SUBSTRATE_ID);
const placeable = compiledSidecars.filter(([, s]) => s.playable_payload.exits.length > 0);
const doorless = compiledSidecars.filter(([, s]) => s.playable_payload.exits.length === 0);
const firstWith = (n) => placeable.findIndex(([, s]) => s.playable_payload.exits.length >= n);

afterEach(() => { entry.applyPipelineConfig({}); });

describe('flash_seedling — the content source', () => {
    it('the default document IS the committed starter atlas file (the static JSON import)', () => {
        expect(SEEDLING_STARTER_ATLAS).toEqual(STARTER_FILE);
    });

    it('the population is not vacuous: the starter atlas has placeable rooms AND doorless ones', () => {
        expect(placeable.length).toBeGreaterThan(0);
        expect(doorless.length).toBeGreaterThan(0);
        expect(firstWith(2)).toBeGreaterThanOrEqual(0);
    });

    it('(a) zoneCount is the compile\'s AP regions that list ≥1 wired door, in the compile\'s order', () => {
        const source = buildSeedlingContentSource(SEEDLING_STARTER_ATLAS);
        expect(entry.zoneCount).toBe(placeable.length);
        expect(source.zones.map((z) => z.apName)).toEqual(placeable.map(([name]) => name));
        expect(source.doorless).toEqual(doorless.map(([name]) => name));
        // …and together they are every AP region the compile reports
        expect(source.zones.length + source.doorless.length).toBe(compiled.report.ap_regions);
    });

    it('⛓ the pool IS the committed seedling_atlas payload — one compile, byte-equal per room', () => {
        const committed = COMMITTED.preset_sidecars['1'];
        for (const zone of buildSeedlingContentSource(SEEDLING_STARTER_ATLAS).zones) {
            expect(JSON.stringify(zone.payload), zone.apName)
                .toBe(JSON.stringify(committed[zone.apName].playable_payload));
        }
    });

    it('(b) the k-th side asked for takes the k-th door in payload order, marked external, exit_id kept', () => {
        const k = firstWith(2);
        const [apName, sidecar] = placeable[k];
        const { exits: doors, ...rest } = sidecar.playable_payload;
        const got = entry.extractZoneRules(k, { region_id: 'probe', exitSides: ['N', 'E'] });

        const { bound_doors: bound, ...payload } = got.payload;
        expect(payload).toEqual(rest);
        expect(Object.keys(bound)).toEqual(['N', 'E']);
        expect(bound.N).toEqual({ ...doors[0], side: 'N', external: true });
        expect(bound.E).toEqual({ ...doors[1], side: 'E', external: true });
        expect(bound.N.exit_id).toBe(doors[0].exit_id);
        expect(got.notes ?? [], apName).toEqual(doors.slice(2).map((d) => expect.objectContaining({
            kind: 'pruned_exit', exit_id: d.exit_id,
        })));
    });

    it('(b′) each side\'s rule is the bound door\'s authored rule, read by the atlas pool\'s own reader', () => {
        const k = firstWith(2);
        const zone = buildSeedlingContentSource(SEEDLING_STARTER_ATLAS).zones[k];
        const got = entry.extractZoneRules(k, { region_id: 'probe', exitSides: ['S', 'W'] });
        const want = {};
        for (const [side, door] of Object.entries(got.payload.bound_doors)) {
            const rule = boundaryRule(zone.region, door.exit_id);
            if (rule) want[side] = rule;
        }
        expect(got.exitRules).toEqual(want);
    });

    it('a surplus door is dropped with a `pruned_exit` note that names it', () => {
        const k = firstWith(2);
        const doors = placeable[k][1].playable_payload.exits;
        const got = entry.extractZoneRules(k, { region_id: 'probe', exitSides: ['W'] });
        expect(Object.keys(got.payload.bound_doors)).toEqual(['W']);
        expect(got.notes.map((n) => n.exit_id)).toEqual(doors.slice(1).map((d) => d.exit_id));
        expect(got.notes[0]).toMatchObject({ kind: 'pruned_exit', region_id: 'probe' });
        expect(got.notes[0].message).toContain(doors[1].exit_id);
    });

    it('(c) more sides than the room has doors is REFUSED by a sentence that says what to lower', () => {
        const k = placeable.findIndex(([, s]) => s.playable_payload.exits.length === 1);
        expect(k).toBeGreaterThanOrEqual(0);
        const [apName, sidecar] = placeable[k];
        const call = () => entry.extractZoneRules(k, { region_id: 'region_2_1', exitSides: ['N', 'E'] });
        expect(call).toThrow(`region "region_2_1" places the real room "${apName}", which has 1 wired door(s) `
            + `[${sidecar.playable_payload.exits[0].exit_id}], but its grid cell needs 2 exit side(s) [N, E]`);
        expect(call).toThrow(/lower the quotas so the spiral leaves this cell at most 1 neighbour/);
    });

    it('an ordinal past the pool is refused, naming the doorless rooms and WHY they are not placeable', () => {
        const call = () => entry.extractZoneRules(placeable.length, { region_id: 'x', exitSides: [] });
        expect(call).toThrow(`zone ordinal ${placeable.length} is out of range`);
        expect(call).toThrow(doorless[0][0]);
        expect(call).toThrow(/a room with no door has no arrival spawn/);
    });

    it('a room\'s marked locations keep their atlas NAME and item', () => {
        const withLoc = placeable.findIndex(([name]) => compiled.rules.regions['1'][name].locations.length > 0);
        expect(withLoc).toBeGreaterThanOrEqual(0);
        const want = compiled.rules.regions['1'][placeable[withLoc][0]].locations;
        const got = entry.extractZoneRules(withLoc, { region_id: 'r', exitSides: [] }).locations;
        expect(got.map((l) => [l.id, l.global_name, l.item]))
            .toEqual(want.map((l) => [l.name, l.name, l.item.name]));
    });

    it('applyPipelineConfig installs cfg.atlasDoc and refuses one that does not validate, by name', () => {
        // Keep the FIRST connection and the two regions it joins: each end becomes a room with one door.
        const one = structuredClone(SEEDLING_STARTER_ATLAS);
        const [conn] = one.vanilla_layout.connections;
        one.vanilla_layout.connections = [conn];
        one.regions = one.regions.filter((r) => [conn.from[0], conn.to[0]].includes(r.region_id));
        stampAtlasIdentity(one);
        expect(entry.applyPipelineConfig({ atlasDoc: one })).toBe(one);
        expect(entry.zoneCount).toBe(2);
        expect(entry.extractZoneRules(1, { region_id: 'r', exitSides: ['N'] }).payload.bound_doors.N.exit_id)
            .toBe(conn.to[1]);
        expect(() => entry.applyPipelineConfig({ atlasDoc: { regions: 'no' } }))
            .toThrow(/flash_seedling: the atlas document handed to applyPipelineConfig \(\{atlasDoc\}\) does not validate/);
        entry.applyPipelineConfig({});
        expect(entry.zoneCount).toBe(placeable.length);
    });
});

describe('flash_seedling — serializeWorld joins the bound doors onto the stitched exits', () => {
    const k = firstWith(2);
    const extracted = entry.extractZoneRules(k, { region_id: 'r0', exitSides: ['S', 'E'] });
    const engineExits = new Map([
        ['exit_S', { exit_id: 'exit_S', side: 'S', exitName: 'exit_S', targetRegion: 'm1', targetExitId: null }],
        ['exit_E', { exit_id: 'exit_E', side: 'E', exitName: 'exit_E', targetRegion: 'm2', targetExitId: 'exit_1' }],
    ]);
    const context = { substrateOfRegion: (id) => ({ m1: 'maze', m2: 'bounce' })[id] ?? null };

    it('every exit is the bound door, external, target_level/target_spawn NULL, far side from the context', () => {
        const out = entry.serializeWorld({ ...extracted.payload, exits: engineExits }, null, null, null, context);
        expect(out.bound_doors).toBeUndefined();
        const doors = placeable[k][1].playable_payload.exits;
        expect(out.exits).toEqual([
            {
                ...doors[0], side: 'S', external: true, exitName: 'exit_S', targetRegion: 'm1', targetExitId: null,
                target_level: null, target_spawn: null, target_substrate: 'maze',
            },
            {
                ...doors[1], side: 'E', external: true, exitName: 'exit_E', targetRegion: 'm2', targetExitId: 'exit_1',
                target_level: null, target_spawn: null, target_substrate: 'bounce',
            },
        ]);
    });

    it('an exit with no bound door is refused by name — there is no door in the level for it', () => {
        const extra = new Map([...engineExits,
            ['exit_N', { exit_id: 'exit_N', side: 'N', exitName: 'exit_N', targetRegion: 'm3' }]]);
        expect(() => entry.serializeWorld({ ...extracted.payload, exits: extra }, null, null, null, context))
            .toThrow('the region\'s exit "exit_N" (side N) has no real door bound to it');
    });

    it('a compiled seedling_atlas payload (no bound_doors) takes the flash pass-through, unchanged', () => {
        for (const [name, sidecar] of Object.entries(COMMITTED.preset_sidecars['1'])) {
            const world = entry.deserializeWorld(structuredClone(sidecar.playable_payload));
            expect(entry.serializeWorld(world), name).toEqual(sidecar.playable_payload);
        }
    });
});
