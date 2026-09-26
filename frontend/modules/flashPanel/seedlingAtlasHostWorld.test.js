/**
 * ⛓⛓⛓ SEEDLING GENERATED LEVELS G6 — **A REAL SEEDLING ROOM HOSTS A CHILD BEHIND
 * AN AP GATE**, headless, through `presetRun.js` with the panel's whole registry
 * (`REGISTRY_LIBRARIES`). The host enforces the gate at play — the rule read off
 * the state manager's static data (`seedlingDoorGate.js`); this file proves the
 * BUILD side: sphere growth composes a child gate on a real-atlas room's door,
 * the room's zone realiser expresses it as a LOCK on the door's path, and the
 * compiled exit rule in the rules.json IS the tree's gate — term for term. The
 * world is oracle-clean and deterministic, the gate's item is reachable before
 * the door, and the committed LEAF stays a leaf by its state's knob
 * (`seedlingAtlasHostChildren: false`), not by a re-record.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_ATLAS_HOST_STATE, SEEDLING_SPHERE_ROOM_STATE } from '../procgenPipeline/presetDefs.js';
import {
    FLASH_SEEDLING_SUBSTRATE_ID,
    SEEDLING_ATLAS_HOST_CHILDREN_KEY,
    substrateRegistryEntry as atlasEntry,
} from './flashSeedlingLibrary.js';
import { createDoorGate } from './seedlingDoorGate.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';
import { makeAndRule, makeHasRule } from '../shared/rulesJsonBuilder.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { reachableRegions, regionsOf } from '../procgenCore/rulesGraph.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const build = async (state) => runPresetHeadless(buildRunFromState(structuredClone(state)));
const atlasRoomsOf = (rulesJson) => Object.entries(rulesJson.preset_sidecars['1'])
    .filter(([, s]) => s.substrate === FLASH_SEEDLING_SUBSTRATE_ID);
const isGate = (rule) => !!rule && rule.rule !== 'True_';
const regionOfNode = (node) => `region_${node.cell.gx}_${node.cell.gy}`;
/** The tree's gate for a node, as a rule: its gate items ANDed, each at its count. */
const treeGateRule = (node) => makeAndRule(node.gate.map((item) => makeHasRule(item, node.gateCounts?.[item] ?? 1)));
/** Static data as the state manager proxy holds it: `regions` a Map, `game_info` carried. */
const staticOf = (rulesJson) => ({
    game_name: rulesJson.game_name,
    items: new Map(Object.entries(rulesJson.items['1'])),
    locations: new Map(),
    regions: new Map(Object.entries(rulesJson.regions['1'])),
    game_info: rulesJson.game_info,
});

describe('sphere growth — SEEDLING_ATLAS_HOST_STATE (a REAL start room hosting a maze child)', () => {
    it('builds twice byte-identically, oracle clean; schema-valid; every region reachable', async () => {
        const a = await build(SEEDLING_ATLAS_HOST_STATE);
        const b = await build(SEEDLING_ATLAS_HOST_STATE);
        console.log(`atlas host world: ${Object.keys(a.rulesJson.preset_sidecars['1']).length} regions, ${a.ms} / ${b.ms} ms`);
        expect(JSON.stringify(a.rulesJson)).toBe(JSON.stringify(b.rulesJson));
        expect(a.oracleErrors).toEqual([]);
        expect(rulesJsonSchemaErrors(a.rulesJson, loadRulesSchema())).toEqual([]);
        const all = Object.keys(regionsOf(a.rulesJson));
        expect([...reachableRegions(a.rulesJson)].sort()).toEqual([...all].sort());
    }, 60_000);

    it('the real room is the START and HOSTS a maze child behind a gate — the compiled exit rule IS the tree\'s gate', async () => {
        const { rulesJson } = await build(SEEDLING_ATLAS_HOST_STATE);
        const regions = regionsOf(rulesJson);
        const sidecars = rulesJson.preset_sidecars['1'];
        const rooms = atlasRoomsOf(rulesJson);
        expect(rooms).toHaveLength(1);
        const [[host, { playable_payload: p }]] = rooms;
        expect(regions.Menu.exits.map((e) => e.connected_region)).toEqual([host]);
        const nodes = rulesJson.procgen_metadata.sphere_tree.nodes;
        const hostNode = nodes.find((n) => regionOfNode(n) === host);
        expect(hostNode.substrate).toBe(FLASH_SEEDLING_SUBSTRATE_ID);
        const children = nodes.filter((n) => n.parent === hostNode.index);
        expect(children.length).toBeGreaterThanOrEqual(1);
        // ⛓ one bound door per child, and each door's compiled rule = that child's tree gate, EXACTLY
        expect(p.exits).toHaveLength(children.length);
        for (const child of children) {
            const target = regionOfNode(child);
            const exit = regions[host].exits.find((e) => e.connected_region === target);
            expect(sidecars[target].substrate, target).toBe('maze');
            expect(isGate(exit.access_rule), `${host} → ${target}`).toBe(true);
            expect(exit.access_rule).toEqual(treeGateRule(child));
            // the door is a REAL atlas door, bound to the exit by its AP name
            const door = p.exits.find((d) => d.exitName === exit.name);
            expect(door, exit.name).toMatchObject({ external: true, targetRegion: target });
            expect(typeof door.exit_id).toBe('string');
            // the child is really BEHIND it: its back door is gated on the same rule
            const back = regions[target].exits.find((e) => e.connected_region === host);
            expect(back.access_rule, `${target}'s back door`).toEqual(exit.access_rule);
        }
    }, 60_000);

    it('the gate\'s item stands in the real room\'s own chest (reachable before the door) — and the host refuses/passes the door off STATIC DATA', async () => {
        const { rulesJson } = await build(SEEDLING_ATLAS_HOST_STATE);
        const [[host, { playable_payload: p }]] = atlasRoomsOf(rulesJson);
        const world = atlasEntry.deserializeWorld(p);
        const [door] = [...(world.exits instanceof Map ? world.exits.values() : world.exits)];
        expect(door.access_rule).toBeUndefined(); // ⛔ a real room's payload carries NO rule — static data does
        const exit = regionsOf(rulesJson)[host].exits.find((e) => e.name === door.exitName);
        const item = exit.access_rule.args.item_name;
        const placed = rulesJson.canonical_placements['1'];
        const where = Object.entries(placed).filter(([, it]) => it === item).map(([loc]) => loc);
        expect(where).toEqual(regionsOf(rulesJson)[host].locations.map((l) => l.name));
        const gate = (inventory) => createDoorGate({ getSnapshot: () => ({ inventory, flags: [] }),
            getStaticData: () => staticOf(rulesJson), getSnapshotInterface: () => createSnapshotInterface })(
            door, { region: host });
        expect(gate({})).toMatchObject({ pass: false, gated: true, missing: [item], source: 'static' });
        expect(gate({ [item]: 1 })).toMatchObject({ pass: true, source: 'static' });
    }, 60_000);

    it('world completion is REACHABLE: the completion condition names the victory item, placed in the world', async () => {
        const { rulesJson } = await build(SEEDLING_ATLAS_HOST_STATE);
        const cc = rulesJson.game_info['1'].completion_condition;
        expect(cc).toEqual({ type: 'item_check', item: 'victory' });
        const where = Object.entries(rulesJson.canonical_placements['1']).filter(([, it]) => it === cc.item);
        expect(where).toHaveLength(1);
    }, 60_000);
});

describe('the committed real-room LEAF stays a leaf by its STATE\'s knob', () => {
    const committed = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_sphere_room/AP_1/AP_1_rules.json'), 'utf8'));

    it('SEEDLING_SPHERE_ROOM_STATE carries `seedlingAtlasHostChildren: false` and builds the committed world', async () => {
        expect(SEEDLING_SPHERE_ROOM_STATE.params[SEEDLING_ATLAS_HOST_CHILDREN_KEY]).toBe(false);
        const { rulesJson } = await build(SEEDLING_SPHERE_ROOM_STATE);
        expect(JSON.parse(JSON.stringify(rulesJson))).toEqual(committed);
    }, 60_000);

    it('WITHOUT the knob the same state MOVES — the room becomes a host (why the knob exists)', async () => {
        const params = Object.fromEntries(Object.entries(SEEDLING_SPHERE_ROOM_STATE.params)
            .filter(([k]) => k !== SEEDLING_ATLAS_HOST_CHILDREN_KEY));
        const { rulesJson } = await build({ ...SEEDLING_SPHERE_ROOM_STATE, params });
        expect(JSON.stringify(rulesJson.procgen_metadata.sphere_tree))
            .not.toBe(JSON.stringify(committed.procgen_metadata.sphere_tree));
    }, 60_000);
});
