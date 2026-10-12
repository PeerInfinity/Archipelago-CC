/**
 * JtA zone locations from the Procgen Pipeline panel (⚖ user 2026-10-11,
 * JtA investigation option A): default ON, scenario items on filler tasks, and
 * the shuffle / free zones / starting perks as settings. In a shuffled spiral
 * the engine owns the world's one goal, `Victory` (⚖ 2026-10-11): a jta zone
 * dealt it puts it on its Travel task.
 */
import { afterEach, describe, expect, it } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import {
    substrateRegistryEntry as jta,
    JTA_FILLER_ITEM_NAME,
    JTA_VICTORY_ITEM_NAME,
} from './jtaSubstrateWrapperLibrary.js';
import { DEFAULT_JTA_PROCGEN_PARAMS } from './jtaProcgenParams.js';
import { JTA_VANILLA_DATASET } from './vanillaDataset.js';
import { arrangeShuffledSpiral } from '../procgenPipeline/procgenPipelineEngine.js';

const taskType = (id) => JTA_VANILLA_DATASET.zones.flatMap((z) => z.tasks).find((t) => t.id === id)?.type;
const itemOf = (region, id) => region.extracted_rules.locations.find((l) => l.id === id)?.item;

afterEach(() => { jta.applyPipelineConfig({}); });

describe('pipelineConfigFromParams — the panel knobs', () => {
    it('defaults to zone locations ON, the goal at the last jta zone, the Victory left to the engine', () => {
        const cfg = jta.pipelineConfigFromParams({ params: { ...DEFAULT_JTA_PROCGEN_PARAMS, seed: 7 }, quota: 3 });
        expect(cfg).toEqual({
            emitZoneLocations: true, goalZone: 2, goalVictory: false,
            freeZones: 1, startingPerks: 0, perkShuffleSeed: null,
        });
    });

    it('zone locations off answers null (the library defaults: no locations)', () => {
        expect(jta.pipelineConfigFromParams({ params: { jtaZoneLocations: false }, quota: 3 })).toBeNull();
    });

    it('carries free zones, starting perks, and a shuffle seeded by the world seed', () => {
        const cfg = jta.pipelineConfigFromParams({
            params: { jtaFreeZones: 2, jtaStartingPerks: 1, jtaShufflePerks: true, seed: 42 }, quota: 4,
        });
        expect(cfg).toMatchObject({ goalZone: 3, freeZones: 2, startingPerks: 1, perkShuffleSeed: 42 });
    });
});

describe('the zone channel', () => {
    it('puts the Victory on the goal zone\'s Travel task', () => {
        jta.applyPipelineConfig({ emitZoneLocations: true, goalZone: 1 });
        const { locations } = jta.extractZoneRules(1, { region_id: 'r' });
        const victory = locations.filter((l) => l.item === JTA_VICTORY_ITEM_NAME);
        expect(victory).toHaveLength(1);
        expect(taskType(victory[0].id)).toBe('Travel');
    });

    it('with the Victory off, the Travel task holds filler and takes no scenario item', () => {
        jta.applyPipelineConfig({ emitZoneLocations: true, goalZone: 1, goalVictory: false });
        const { locations, placedItems } = jta.extractZoneRules(1, {
            region_id: 'r', itemsToPlace: ['a', 'b', 'c'],
        });
        const travel = locations.find((l) => taskType(l.id) === 'Travel');
        expect(travel.item).toBe(JTA_FILLER_ITEM_NAME);
        expect(placedItems).toEqual(['a', 'b', 'c']);
    });

    it('scenario items go on Mandatory tasks first, never on a perk', () => {
        jta.applyPipelineConfig({ emitZoneLocations: true, goalZone: 2, goalVictory: false });
        const { locations, placedItems } = jta.extractZoneRules(0, {
            region_id: 'r', itemsToPlace: ['key_red', 'key_blue'],
        });
        expect(placedItems).toEqual(['key_red', 'key_blue']);
        for (const item of placedItems) {
            expect(taskType(locations.find((l) => l.item === item).id)).toBe('Mandatory');
        }
        expect(locations.some((l) => l.item === 'How to Read')).toBe(true);
    });

    it('the goal dealt to a zone goes on ITS Travel task, and the engine-owned goal silences the zone\'s own', () => {
        jta.applyPipelineConfig({ emitZoneLocations: true, goalZone: 0, goalVictory: true });
        const own = jta.extractZoneRules(0, { region_id: 'r', goalOwned: true }).locations;
        expect(own.some((l) => l.item === JTA_VICTORY_ITEM_NAME)).toBe(false);
        const { locations, placedItems } = jta.extractZoneRules(1, {
            region_id: 'r', goalOwned: true, itemsToPlace: ['key_red', JTA_VICTORY_ITEM_NAME],
        });
        expect(placedItems).toEqual([JTA_VICTORY_ITEM_NAME, 'key_red']);
        const victory = locations.filter((l) => l.item === JTA_VICTORY_ITEM_NAME);
        expect(victory).toHaveLength(1);
        expect(taskType(victory[0].id)).toBe('Travel');
        expect(taskType(locations.find((l) => l.item === 'key_red').id)).toBe('Mandatory');
    });

    it('a document\'s own item on a filler task is answered back (the hub\'s re-extraction)', () => {
        jta.applyPipelineConfig({ emitZoneLocations: true, goalZone: 2, goalVictory: false });
        const { locations } = jta.extractZoneRules(0, {
            region_id: 'r', locationSpecs: [{ name: 'r__11', item: 'key_red' }, { name: 'r__13', item: 'x' }],
        });
        expect(locations.find((l) => l.id === 11).item).toBe('key_red');
        expect(locations.find((l) => l.id === 13).item).toBe('How to Read'); // a perk slot never moves
    });
});

describe('the engine: scenario items and the one goal', () => {
    const run = (itemPool, quotas = { jta: 3 }) => {
        jta.applyPipelineConfig(jta.pipelineConfigFromParams({ params: {}, quota: quotas.jta }));
        const { grid } = arrangeShuffledSpiral({
            regionSize: { width: 8, height: 6 }, itemPool, obstaclePool: {}, seed: 1,
            growthParams: { substrateQuotas: quotas, startSubstrate: 'jta' },
        });
        const items = grid.allRegions().flatMap((r) => r.extracted_rules.locations.map((l) => l.item));
        return { grid, items };
    };

    it('a world with no scenario victory gets the goal on the last jta zone\'s Travel task (exactly one)', () => {
        const { grid, items } = run({});
        expect(items.filter((i) => i === JTA_VICTORY_ITEM_NAME)).toHaveLength(1);
        const holder = grid.allRegions().find((r) => r.extracted_rules.locations.some((l) => l.item === JTA_VICTORY_ITEM_NAME));
        expect(holder.playable_payload.jtaZone).toBe(2);
        expect(taskType(holder.extracted_rules.locations.find((l) => l.item === JTA_VICTORY_ITEM_NAME).id))
            .toBe('Travel');
    });

    it('a scenario victory becomes the one goal `Victory`, and every scenario item is placed', () => {
        const { items } = run({ key_red: 1, victory: 1 });
        expect(items).toContain('key_red');
        expect(items).not.toContain('victory');
        expect(items.filter((i) => i === JTA_VICTORY_ITEM_NAME)).toHaveLength(1);
    });
});

describe('in-run gates the zone rules leave out (jta-loop-mode, 2026-10-12)', () => {
    const zones = JTA_VANILLA_DATASET.zones;
    const last = zones.length - 1;
    const perkCount = (z) => {
        const { locations } = jta.extractZoneRules(z, { region_id: `r${z}` });
        const counts = new Set(locations.map((l) => l.access_rule?.args?.count ?? 0));
        expect(counts.size).toBe(1);
        return [...counts][0];
    };

    it('no SeeBeyondTheVeil-gated task is a location, zone 19\'s Gaze Beyond the Veil included', () => {
        jta.applyPipelineConfig({ emitZoneLocations: true, goalZone: last });
        const sbtv = JTA_VANILLA_DATASET.prestige.sbtv_unlock_task_ids;
        expect(sbtv).toContain(209);
        for (const id of sbtv) {
            const z = zones.findIndex((zone) => zone.tasks.some((t) => t.id === id));
            const { locations } = jta.extractZoneRules(z, { region_id: 'r' });
            expect(locations.map((l) => l.id)).not.toContain(id);
        }
    });

    it('a task that uses an item sits in or after a zone that makes it, and needs no fewer perks', () => {
        // The rule of a task that consumes an item (Cast the Ring into the Fire, zone 21, the Magic Ring from
        // zone 16's Boss) does not name the item: its zone's perk count orders it after the maker (items survive
        // energy resets; the Nth jta region is zone N, so the maker's zone exists whenever the user's does).
        // A dataset that breaks either half needs a real rule.
        jta.applyPipelineConfig({ emitZoneLocations: true, goalZone: last });
        const makers = new Map();
        zones.forEach((zone, z) => zone.tasks.forEach((t) => {
            if (t.item != null) makers.set(t.item, [...(makers.get(t.item) ?? []), z]);
        }));
        const users = zones.flatMap((zone, z) => zone.tasks.filter((t) => t.use_item != null).map((t) => ({ t, z })));
        expect(users.length).toBeGreaterThan(0);
        for (const { t, z } of users) {
            const first = Math.min(...(makers.get(t.use_item) ?? [Infinity]));
            expect(first, `task ${t.id} uses item ${t.use_item}`).toBeLessThanOrEqual(z);
            expect(perkCount(first)).toBeLessThanOrEqual(perkCount(z));
        }
    });
});
