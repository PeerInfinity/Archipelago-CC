/**
 * ⛓⛓⛓ SEEDLING IN THE PIPELINE T3 — **A SPHERE-GROWTH WORLD WITH ONE REAL
 * SEEDLING ROOM AS A LEAF, BUILT HEADLESS** through `presetRun.js` — the same
 * assembly the Procgen Pipeline panel's Generate calls (`buildRunFromState` →
 * `runPresetHeadless`, which runs the sphere config hooks and the oracle), with
 * the panel's whole registry loaded (`REGISTRY_LIBRARIES`).
 *
 * The room is a LEAF: its one exit is the real door back to its maze parent,
 * ungated, paired with the parent's forward exit by `targetExitId` on both
 * sides; the node's ENTRY gate rides the parent's exit, where the maze enforces
 * it. This file is the oracle the committed `seedling_sphere_room` preset is
 * checked against.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_SPHERE_ROOM_STATE } from '../procgenPipeline/presetDefs.js';
import { FLASH_SEEDLING_SUBSTRATE_ID, SEEDLING_STARTER_ATLAS } from './flashSeedlingLibrary.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { regionsOf } from '../procgenCore/rulesGraph.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

/** Spelled ONCE, in presetDefs.js (a vitest file cannot be imported by a node script); re-exported here. */
export { SEEDLING_SPHERE_ROOM_STATE };
const build = async (state) => runPresetHeadless(buildRunFromState(structuredClone(state)));

/** The world, and the one placed room in it with its maze parent — read off the world, never typed. */
function roomAndParent(rulesJson) {
    const sidecars = rulesJson.preset_sidecars['1'];
    const rooms = Object.entries(sidecars).filter(([, s]) => s.substrate === FLASH_SEEDLING_SUBSTRATE_ID);
    const [[roomId, room]] = rooms;
    const [door] = room.playable_payload.exits;
    const regions = regionsOf(rulesJson);
    const parentId = door.targetRegion;
    return {
        rooms, roomId, room, door, parentId,
        parentSidecar: sidecars[parentId],
        parentRegion: regions[parentId],
        roomRegion: regions[roomId],
        start: regions.Menu.exits[0].connected_region,
    };
}

describe('the sphere-growth world with a real Seedling room as a LEAF (T3)', () => {
    it('the state spells the Seedling quota with the library\'s own substrate id', () => {
        expect(SEEDLING_SPHERE_ROOM_STATE.mode).toBe('sphereGrowth');
        expect(SEEDLING_SPHERE_ROOM_STATE.substrateQuotas[FLASH_SEEDLING_SUBSTRATE_ID]).toBe(1);
    });

    it('ONE room, not the start region; its ONE exit is the real door back to its maze parent', async () => {
        const { rulesJson, ms } = await build(SEEDLING_SPHERE_ROOM_STATE);
        const w = roomAndParent(rulesJson);
        console.log(`sphere leaf world: ${Object.keys(rulesJson.preset_sidecars['1']).length} regions, `
            + `room ${w.roomId} (${w.room.playable_payload.atlas_region}/${w.room.playable_payload.atlas_sub_region}), `
            + `parent ${w.parentId}, start ${w.start}, ${ms} ms`);
        expect(w.rooms).toHaveLength(1);
        expect(w.start).not.toBe(w.roomId);
        expect(w.room.playable_payload.exits).toHaveLength(1);
        const atlasRegion = SEEDLING_STARTER_ATLAS.regions.find((r) => r.region_id === w.room.playable_payload.atlas_region);
        expect(w.room.playable_payload.level).toBe(atlasRegion.map_ref);
        expect(atlasRegion.exits.map((e) => e.exit_id)).toContain(w.door.exit_id);
        expect(w.door).toMatchObject({
            external: true, target_substrate: 'maze', target_level: null, target_spawn: null,
        });
        expect(w.parentSidecar.substrate).toBe('maze');
        // the AP exit of the room IS the door: one exit, named by the door's exitName, to the parent
        expect(w.roomRegion.exits.map((e) => [e.name, e.connected_region])).toEqual([[w.door.exitName, w.parentId]]);
    });

    it('the door and the parent\'s exit into the room are PAIRED by targetExitId, on both sides', async () => {
        const { rulesJson } = await build(SEEDLING_SPHERE_ROOM_STATE);
        const w = roomAndParent(rulesJson);
        const forward = [...w.parentSidecar.playable_payload.exits].filter((e) => e.targetRegion === w.roomId);
        expect(forward).toHaveLength(1);
        expect(w.door.targetExitId).toBe(forward[0].exit_id);
        expect(forward[0].targetExitId).toBe(w.door.exitName);
    });

    it('the node\'s ENTRY gate rides the PARENT\'s exit into the room (the maze enforces it)', async () => {
        const { rulesJson } = await build(SEEDLING_SPHERE_ROOM_STATE);
        const w = roomAndParent(rulesJson);
        const into = w.parentRegion.exits.filter((e) => e.connected_region === w.roomId);
        expect(into).toHaveLength(1);
        const rule = into[0].access_rule;
        expect(rule?.rule, JSON.stringify(rule)).toBe('Has');
        expect(Object.keys(SEEDLING_SPHERE_ROOM_STATE.scenario.items)).toContain(rule.args.item_name);
        // the gate item is placed OUTSIDE the room, in the parent's own reach
        const holder = Object.entries(regionsOf(rulesJson))
            .find(([, r]) => (r.locations ?? []).some((l) => l.item?.name === rule.args.item_name));
        expect(holder?.[0]).toBeTruthy();
        expect(holder[0]).not.toBe(w.roomId);
        // the room is a filler leaf: no location of its own
        expect(w.roomRegion.locations ?? []).toEqual([]);
    });

    it('the sphere oracle passes, the rules.json is schema-valid, and two builds are byte-identical', async () => {
        const a = await build(SEEDLING_SPHERE_ROOM_STATE);
        const b = await build(SEEDLING_SPHERE_ROOM_STATE);
        expect(a.oracleErrors).toEqual([]);
        expect(rulesJsonSchemaErrors(a.rulesJson, loadRulesSchema())).toEqual([]);
        expect(JSON.stringify(b.rulesJson)).toBe(JSON.stringify(a.rulesJson));
    });

    it('each GENERATION starts with every room unplaced (prepareSphereGrowth, through the config hooks)', async () => {
        // A second world whose filler room lands on a DIFFERENT region id: without
        // the per-generation reset, the first world's region would still hold the
        // tightest room and this one would be handed the next.
        const other = { ...SEEDLING_SPHERE_ROOM_STATE, params: { ...SEEDLING_SPHERE_ROOM_STATE.params, seed: 3 } };
        const a = roomAndParent((await build(SEEDLING_SPHERE_ROOM_STATE)).rulesJson);
        const b = roomAndParent((await build(other)).rulesJson);
        expect(b.roomId, 'precondition: the rooms sit on different region ids').not.toBe(a.roomId);
        expect(b.roomRegion.locations ?? [], 'precondition: both are 0-item leaves').toEqual([]);
        expect(b.room.playable_payload.atlas_region).toBe(a.room.playable_payload.atlas_region);
        expect(b.room.playable_payload.atlas_sub_region).toBe(a.room.playable_payload.atlas_sub_region);
    });

    it('a 1-ITEM leaf (no filler) takes the one room with a location, under the COMPILER\'s location name', async () => {
        const state = { ...SEEDLING_SPHERE_ROOM_STATE, params: { ...SEEDLING_SPHERE_ROOM_STATE.params, fillerCount: 0 } };
        const { rulesJson, oracleErrors } = await build(state);
        expect(oracleErrors).toEqual([]);
        const w = roomAndParent(rulesJson);
        const compiled = compileRegionAtlas(SEEDLING_STARTER_ATLAS).rules;
        const withLocation = Object.entries(compiled.regions['1'])
            .filter(([name]) => compiled.preset_sidecars['1'][name]?.substrate === FLASH_SEEDLING_SUBSTRATE_ID
                && (compiled.regions['1'][name].locations ?? []).length > 0);
        expect(withLocation).toHaveLength(1);
        const [[apName, region]] = withLocation;
        expect(compiled.preset_sidecars['1'][apName].playable_payload.atlas_region)
            .toBe(w.room.playable_payload.atlas_region);
        const locs = w.roomRegion.locations ?? [];
        expect(locs.map((l) => l.name)).toEqual([region.locations[0].name]);
        expect(Object.keys(state.scenario.items)).toContain(locs[0].item?.name);
    });

});
