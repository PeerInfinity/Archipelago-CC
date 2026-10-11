/**
 * JtA zone locations from the Procgen Pipeline panel (⚖ user 2026-10-11,
 * JtA investigation option A): default ON, the Victory on the final zone's
 * Travel task only when the world has no victory item, scenario items on
 * filler tasks, and the shuffle / free zones / starting perks as settings.
 */
import { afterEach, describe, expect, it } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import {
    substrateRegistryEntry as jta,
    JTA_FILLER_ITEM_NAME,
    JTA_VICTORY_ITEM_NAME,
    getJtaGoalVictory,
} from './jtaSubstrateWrapperLibrary.js';
import { DEFAULT_JTA_PROCGEN_PARAMS } from './jtaProcgenParams.js';
import { JTA_VANILLA_DATASET } from './vanillaDataset.js';
import { arrangeShuffledSpiral } from '../procgenPipeline/procgenPipelineEngine.js';

const taskType = (id) => JTA_VANILLA_DATASET.zones.flatMap((z) => z.tasks).find((t) => t.id === id)?.type;
const itemOf = (region, id) => region.extracted_rules.locations.find((l) => l.id === id)?.item;

afterEach(() => { jta.applyPipelineConfig({}); });

describe('pipelineConfigFromParams — the panel knobs', () => {
    it('defaults to zone locations ON, the goal at the last jta zone, the Victory left to the fallback', () => {
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

    it('a document\'s own item on a filler task is answered back (the hub\'s re-extraction)', () => {
        jta.applyPipelineConfig({ emitZoneLocations: true, goalZone: 2, goalVictory: false });
        const { locations } = jta.extractZoneRules(0, {
            region_id: 'r', locationSpecs: [{ name: 'r__11', item: 'key_red' }, { name: 'r__13', item: 'x' }],
        });
        expect(locations.find((l) => l.id === 11).item).toBe('key_red');
        expect(locations.find((l) => l.id === 13).item).toBe('How to Read'); // a perk slot never moves
    });
});

describe('the engine: scenario items and the victory fallback', () => {
    const run = (itemPool, quotas = { jta: 3 }) => {
        jta.applyPipelineConfig(jta.pipelineConfigFromParams({ params: {}, quota: quotas.jta }));
        const { grid, pool } = arrangeShuffledSpiral({
            regionSize: { width: 8, height: 6 }, itemPool, obstaclePool: {}, seed: 1,
            growthParams: { substrateQuotas: quotas, startSubstrate: 'jta' },
        });
        const items = grid.allRegions().flatMap((r) => r.extracted_rules.locations.map((l) => l.item));
        return { grid, pool, items };
    };

    it('a world with no victory gets the JtA Victory (exactly one)', () => {
        const { items } = run({});
        expect(items.filter((i) => i === JTA_VICTORY_ITEM_NAME)).toHaveLength(1);
        expect(getJtaGoalVictory()).toBe(true);
    });

    it('a scenario victory is placed in a JtA zone and JtA adds none of its own', () => {
        const { items, pool } = run({ key_red: 1, victory: 1 });
        expect(items).toContain('key_red');
        expect(items).toContain('victory');
        expect(items).not.toContain(JTA_VICTORY_ITEM_NAME);
        expect(pool.itemsRemaining()).toBe(0);
        expect(getJtaGoalVictory()).toBe(false);
    });
});
