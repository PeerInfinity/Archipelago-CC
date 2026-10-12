/**
 * jta and noiz2sa in sphere growth (⚖ user 2026-10-11): each realises a region from its node's specs
 * (`generateZoneForSpecs`), so both take part in sphere growth and can hold the goal. A sphere jta zone exposes ONLY its
 * planned locations (perks stay native), and the tree's gates on these substrates are LOGIC ONLY.
 */

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { buildRunFromState, runPresetHeadless } from './presetRun.js';
import { GOAL_ITEM } from '../procgenCore/goalItem.js';
import { JTA_VANILLA_DATASET } from '../jtaSubstrateWrapper/vanillaDataset.js';
import { JTA_EXIT_LOCK_PREFIX } from '../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import { NOIZ2SA_ZONES } from '../noiz2saSubstrate/noiz2saSubstrateLibrary.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

beforeAll(async () => {
    for (const rel of REGISTRY_LIBRARIES) {
        // eslint-disable-next-line no-await-in-loop
        await import(join(ROOT, rel));
    }
});
afterEach(() => { substrateRegistry.get('jta').applyPipelineConfig({}); });

const taskType = (zone, id) => JTA_VANILLA_DATASET.zones[zone].tasks.find((t) => t.id === Number(id))?.type;
const KEY_GATE = [{ side: 'E', requirement: ['key_red'], counts: {} }, { side: 'W', requirement: [], counts: {} }];

function sphereState(quotas, items, startSubstrate = 'auto') {
    return {
        mode: 'sphereGrowth',
        params: { seed: 1, sphereCount: 3, startSubstrate },
        scenario: { items, obstacles: {} },
        substrateQuotas: quotas,
        substrateMix: {},
        substrateMode: 'quotas',
    };
}

describe('jta generateZoneForSpecs', () => {
    it('puts the goal on the zone\'s Travel task and the other specs on Mandatory tasks — nothing else is a location', () => {
        const jta = substrateRegistry.get('jta');
        const zone = 1;
        const out = jta.generateZoneForSpecs({
            region_id: 'r', exitSpecs: KEY_GATE,
            locationSpecs: [{ id: 'loc_0', item: 'key_blue' }, { id: 'loc_1', item: GOAL_ITEM }],
        }, { ordinal: zone });
        expect(out.locations).toEqual([
            { id: 'loc_0', item: 'key_blue', position: null }, { id: 'loc_1', item: GOAL_ITEM, position: null },
        ]);
        const byName = Object.fromEntries(Object.entries(out.payload.ap_locations).map(([task, name]) => [name, task]));
        expect(Object.keys(byName).sort()).toEqual(['r__loc_0', 'r__loc_1']);
        expect(taskType(zone, byName.r__loc_1)).toBe('Travel');
        expect(taskType(zone, byName.r__loc_0)).toBe('Mandatory');
        expect(out.payload.jtaZone).toBe(zone);
        // ⚖ perks native: no grant is suppressed.
        expect(out.payload.task_patches).toEqual([]);
        // ⚖ logic-only gates: the E exit's one path crosses a Has(key_red) lock; W is free.
        expect(out.exitPaths.E[0].obstacles).toEqual([`${JTA_EXIT_LOCK_PREFIX}key_red`]);
        expect(out.obstacleDefs[`${JTA_EXIT_LOCK_PREFIX}key_red`].clear_rule)
            .toEqual({ rule: 'Has', args: { item_name: 'key_red' } });
        expect(out.exitPaths.W[0].obstacles).toEqual([]);
    });

    it('refuses a zone the source does not have, naming the quota', () => {
        const jta = substrateRegistry.get('jta');
        expect(() => jta.generateZoneForSpecs({ region_id: 'r', locationSpecs: [] }, { ordinal: jta.zoneCount }))
            .toThrow(/needs zone \d+, but the vanilla fixture has \d+ zone\(s\) — lower the jta quota/);
    });
});

describe('noiz2sa generateZoneForSpecs', () => {
    it('has one location per spec with the default check span, the move span from the zone table (repeating)', () => {
        const noiz = substrateRegistry.get('noiz2sa');
        const specs = [{ id: 'loc_0', item: 'key_red' }, { id: 'loc_1', item: GOAL_ITEM }];
        const a = noiz.generateZoneForSpecs({ region_id: 'r', exitSpecs: KEY_GATE, locationSpecs: specs }, { ordinal: 1 });
        expect(a.locations.map((l) => l.item)).toEqual(['key_red', GOAL_ITEM]);
        expect(a.payload.locations.map((l) => l.id)).toEqual(['check1', 'check2']);
        expect(a.payload.ap_locations).toEqual({ check1: 'r__loc_0', check2: 'r__loc_1' });
        const wrapped = noiz.generateZoneForSpecs({ region_id: 'r', locationSpecs: specs },
            { ordinal: 1 + NOIZ2SA_ZONES.length });
        expect(wrapped.payload.move).toEqual(a.payload.move);
        expect(a.exitPaths.E[0].obstacles).toHaveLength(1);
    });
});

describe('sphere growth realises jta and noiz2sa end to end', () => {
    it('a maze + jta + noiz2sa world: oracle clean, ONE Victory, in the final sphere, completion on it', async () => {
        const { rulesJson, oracleErrors } = await runPresetHeadless(buildRunFromState(
            sphereState({ maze: 2, jta: 2, noiz2sa: 2 }, { key_red: 1, key_blue: 1, victory: 1 }, 'maze')));
        expect(oracleErrors).toEqual([]);
        expect(rulesJson.game_info['1'].completion_condition).toEqual({ type: 'item_check', item: GOAL_ITEM });
        const held = Object.values(rulesJson.regions['1'])
            .flatMap((r) => (r.locations ?? []).map((l) => l.item.name));
        expect(held.filter((it) => it === GOAL_ITEM)).toHaveLength(1);
        const plan = rulesJson.procgen_metadata['1'].sphere_plan;
        expect(plan.spheres[plan.spheres.length - 1].items).toEqual([GOAL_ITEM]);
        const subs = new Set(Object.values(rulesJson.preset_sidecars['1']).map((s) => s.substrate));
        expect([...subs]).toEqual(expect.arrayContaining(['jta', 'noiz2sa']));
    });

    it('a jta-only world takes zones 0, 1, 2 … in wave order, and gets the goal jta declares', async () => {
        const { rulesJson, oracleErrors } = await runPresetHeadless(buildRunFromState(
            sphereState({ jta: 4 }, { key_red: 1, key_blue: 1 }, 'jta')));
        expect(oracleErrors).toEqual([]);
        const zones = Object.values(rulesJson.preset_sidecars['1']).map((s) => s.playable_payload.jtaZone);
        expect([...zones].sort((a, b) => a - b)).toEqual(zones.map((_, i) => i));
        expect(rulesJson.game_info['1'].completion_condition.item).toBe(GOAL_ITEM);
    });
});
