/**
 * ⛓⛓⛓ SEEDLING GENERATED LEVELS G4 — **A GENERATED ROOM HOSTS A CHILD BEHIND AN
 * AP GATE**, headless, through `presetRun.js` with the panel's whole registry
 * (`REGISTRY_LIBRARIES`). The host enforces the gate at play
 * (`seedlingDoorGate.js`); this file proves the BUILD side of that bargain:
 * sphere growth composes a child gate on a generated room's exit, the gate is
 * in the rules.json AND in the payload's `exitGates` (so the play-side world
 * carries it), the gate's item is reachable before the door, the world is
 * oracle-clean and deterministic — and the committed LEAF stays a leaf by its
 * state's knob (`seedlingGenHostChildren: false`), not by a re-record.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_HOST_STATE, SEEDLING_GENERATED_LEAF_STATE } from '../procgenPipeline/presetDefs.js';
import {
    FLASH_SEEDLING_GEN_SUBSTRATE_ID,
    SEEDLING_GEN_HOST_CHILDREN_KEY,
    buildSeedlingGenRegionParams,
    substrateRegistryEntry as genEntry,
} from './flashSeedlingGenLibrary.js';
import { createDoorGate } from './seedlingDoorGate.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { reachableRegions, regionsOf } from '../procgenCore/rulesGraph.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const build = async (state) => runPresetHeadless(buildRunFromState(structuredClone(state)));
const generatedOf = (rulesJson) => Object.entries(rulesJson.preset_sidecars['1'])
    .filter(([, s]) => s.substrate === FLASH_SEEDLING_GEN_SUBSTRATE_ID);
const isGate = (rule) => !!rule && rule.rule !== 'True_';
const LEAF_WITHOUT_KNOB = Object.freeze({
    ...SEEDLING_GENERATED_LEAF_STATE,
    params: Object.fromEntries(Object.entries(SEEDLING_GENERATED_LEAF_STATE.params)
        .filter(([k]) => k !== SEEDLING_GEN_HOST_CHILDREN_KEY)),
});

describe('the hooks — a HOST by default, a leaf by the state\'s knob', () => {
    const leaf = { seedlingGen: { hostChildren: false } };
    it('hosts any child gate and gates its back door by default', () => {
        const gate = [{ item: 'key_blue', count: 1 }];
        expect(genEntry.canHostExitGates([], gate)).toBe(true);
        expect(genEntry.exitGateVeto({})([], gate)).toBe(true);
        expect(genEntry.exitGateVeto(buildSeedlingGenRegionParams({ params: {} }))([[{ item: 'key_red', count: 1 }]], gate))
            .toBe(true);
        expect(genEntry.backPortalGated({})).toBe(true);
        expect(genEntry.backPortalGated(buildSeedlingGenRegionParams({ params: {} }))).toBe(true);
    });

    it('`seedlingGenHostChildren: false` keeps G1–G3\'s leaf: no child, no gate slot for the back door', () => {
        expect(genEntry.exitGateVeto(leaf)([], [{ item: 'key_blue', count: 1 }])).toBe(false);
        expect(genEntry.backPortalGated(leaf)).toBe(false);
        expect(buildSeedlingGenRegionParams({ params: { [SEEDLING_GEN_HOST_CHILDREN_KEY]: false } }).seedlingGen.hostChildren)
            .toBe(false);
        expect(SEEDLING_GENERATED_LEAF_STATE.params[SEEDLING_GEN_HOST_CHILDREN_KEY]).toBe(false);
    });
});

describe('sphere growth — SEEDLING_GENERATED_HOST_STATE (a generated START room hosting a maze child)', () => {
    it('builds twice byte-identically, oracle clean; schema-valid; every region reachable', async () => {
        const a = await build(SEEDLING_GENERATED_HOST_STATE);
        const b = await build(SEEDLING_GENERATED_HOST_STATE);
        console.log(`generated host world: ${Object.keys(a.rulesJson.preset_sidecars['1']).length} regions, ${a.ms} / ${b.ms} ms`);
        expect(JSON.stringify(a.rulesJson)).toBe(JSON.stringify(b.rulesJson));
        expect(a.oracleErrors).toEqual([]);
        expect(rulesJsonSchemaErrors(a.rulesJson, loadRulesSchema())).toEqual([]);
        const all = Object.keys(regionsOf(a.rulesJson));
        expect([...reachableRegions(a.rulesJson)].sort()).toEqual([...all].sort());
    }, 60_000);

    it('the generated room hosts ≥1 child behind a gate — in the rules.json AND the payload\'s exitGates, and on the play-side world', async () => {
        const { rulesJson } = await build(SEEDLING_GENERATED_HOST_STATE);
        const regions = regionsOf(rulesJson);
        const sidecars = rulesJson.preset_sidecars['1'];
        const generated = generatedOf(rulesJson);
        expect(generated).toHaveLength(1);
        const [[host, { playable_payload: p }]] = generated;
        // ⛓ the room is the START: the Menu's one exit (`GameStart`) leads into it
        expect(regions.Menu.exits.map((e) => e.connected_region)).toEqual([host]);
        const gated = regions[host].exits.filter((e) => isGate(e.access_rule));
        expect(gated.length).toBeGreaterThanOrEqual(1);
        const world = genEntry.deserializeWorld(p);
        for (const exit of gated) {
            expect(sidecars[exit.connected_region].substrate, exit.name).toBe('maze');
            expect(p.exitGates[exit.name], exit.name).toEqual(exit.access_rule);
            expect(world.exits.get(exit.name).access_rule, exit.name).toEqual(exit.access_rule);
            // ⛓ the child is really BEHIND the gate: its back door is gated on the same rule
            const back = regions[exit.connected_region].exits.find((e) => e.connected_region === host);
            expect(back.access_rule, `${exit.connected_region}'s back door`).toEqual(exit.access_rule);
        }
    }, 60_000);

    it('the gate\'s item stands in the host room itself (reachable before the door) — and the host evaluates the door off it', async () => {
        const { rulesJson } = await build(SEEDLING_GENERATED_HOST_STATE);
        const [[host, { playable_payload: p }]] = generatedOf(rulesJson);
        const world = genEntry.deserializeWorld(p);
        const [exit] = [...world.exits.values()].filter((e) => isGate(e.access_rule));
        const item = exit.access_rule.args.item_name;
        const placed = rulesJson.canonical_placements['1'];
        const where = Object.entries(placed).filter(([, it]) => it === item).map(([loc]) => loc);
        expect(where).toEqual([p.locations[0].name]);          // on the room's goal cell (location 0)
        expect(p.locations[0].cell).toEqual(p.goal_cell);
        expect(regionsOf(rulesJson)[host].locations.map((l) => l.name)).toContain(where[0]);
        const staticData = { game_name: rulesJson.game_name, items: new Map(Object.entries(rulesJson.items['1'])),
            locations: new Map(), regions: new Map() };
        const gate = (inventory) => createDoorGate({ getSnapshot: () => ({ inventory, flags: [] }),
            getStaticData: () => staticData, getSnapshotInterface: () => createSnapshotInterface })(exit);
        expect(gate({})).toMatchObject({ pass: false, missing: [item] });
        expect(gate({ [item]: 1 })).toMatchObject({ pass: true, missing: [] });
    }, 60_000);
});

describe('the committed LEAF stays a leaf by its STATE, not by a re-record', () => {
    it('without the knob the leaf world moves — ONLY its tree record (the back door takes a gate slot)', async () => {
        const committed = JSON.parse(readFileSync(
            join(ROOT, 'frontend/presets/seedling_generated_leaf/AP_1/AP_1_rules.json'), 'utf8'));
        const { rulesJson } = await build(LEAF_WITHOUT_KNOB);
        expect(rulesJson).not.toEqual(committed);
        const { procgen_metadata: m1, ...rest1 } = rulesJson;
        const { procgen_metadata: m0, ...rest0 } = committed;
        expect(rest1).toEqual(rest0);
        const nodes = (m) => m.sphere_tree.nodes;
        const moved = nodes(m1).map((n, i) => [i, n]).filter(([i, n]) => JSON.stringify(n) !== JSON.stringify(nodes(m0)[i]));
        expect(moved.map(([i, n]) => [n.substrate, n.childGates])).toEqual([
            [FLASH_SEEDLING_GEN_SUBSTRATE_ID, [[{ item: 'key_red', count: 1 }]]],
        ]);
        expect({ ...m1, sphere_tree: null }).toEqual({ ...m0, sphere_tree: null });
    }, 60_000);
});
