/**
 * The shuffled spiral's item layer (⚖ user 2026-10-11): items planned up front
 * like sphere growth's, SPREAD EVENLY over the cells that can hold them, the one
 * goal item `Victory` on the LAST of those cells in spiral order, every region
 * built from the items it was dealt, and ④ refusing a world whose completion
 * names an item no location holds.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import '../noiz2saSubstrate/noiz2saSubstrateLibrary.js';
import '../omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    arrangeSpiralPlan, realiseSpiralRegions, spiralCellCapacity, spiralItemHolders,
    LIBRARY_SLOT_FILLER_ITEM,
} from './procgenPipelineEngine.js';
import { newSpiralEnvelope, runSpiralToStep } from './spiralSteps.js';
import { GOAL_ITEM } from '../procgenCore/goalItem.js';

const JTA_ON = { emitZoneLocations: true, goalVictory: false };

function config({ quotas, start = null, items = {}, seed = 1, maxItemsPerRegion = 2, jta = JTA_ON }) {
    return {
        regionSize: { width: 8, height: 6 },
        seed,
        itemPool: { ...items },
        obstaclePool: {},
        regionParams: {},
        growthParams: {
            substrateQuotas: quotas,
            maxItemsPerRegion,
            ...(start ? { startSubstrate: start } : {}),
            substrateConfig: { jta },
        },
    };
}

function install(cfg) {
    for (const [id, n] of Object.entries(cfg.growthParams.substrateQuotas)) {
        if (n > 0) substrateRegistry.get(id)?.applyPipelineConfig?.(cfg.growthParams.substrateConfig?.[id]);
    }
}

/** Every location's item, by region id, from a realised grid. */
function itemsByRegion(grid) {
    const out = {};
    for (const r of grid.allRegions()) out[r.region_id] = (r.extracted_rules?.locations ?? []).map((l) => l.item);
    return out;
}

describe('the spiral item layer', () => {
    beforeEach(() => {
        substrateRegistry.get('jta').applyPipelineConfig({});
        substrateRegistry.get('omsi').applyPipelineConfig({});
    });

    it('pins the goal to the LAST cell that can hold an item, and spreads the regular items evenly', () => {
        const cfg = config({
            quotas: { maze: 2, jta: 2, noiz2sa: 2, bounce: 1 }, start: 'maze', seed: 5,
            items: { key_red: 1, key_blue: 1, key_green: 1, victory: 1 },
        });
        install(cfg);
        const plan = arrangeSpiralPlan(cfg);
        const holders = plan.sequence.map((s, i) => (s === 'bounce' ? -1 : i)).filter((i) => i >= 0);
        const goalCells = plan.items.map((list, i) => (list.includes(GOAL_ITEM) ? i : -1)).filter((i) => i >= 0);
        expect(goalCells).toEqual([holders[holders.length - 1]]);
        // The scenario's `victory` became the one goal item.
        expect(plan.items.flat().filter((it) => it === 'victory')).toEqual([]);
        // 3 regular items over 6 holders: every other holder, one each.
        const regularCells = plan.items.map((list, i) => (list.some((it) => it !== GOAL_ITEM) ? i : -1))
            .filter((i) => i >= 0);
        expect(regularCells).toEqual([holders[1], holders[3], holders[5]]);
        expect(plan.items[plan.sequence.indexOf('bounce')]).toEqual([]);
    });

    it('never deals a cell more than maxItemsPerRegion', () => {
        const cfg = config({
            quotas: { maze: 3 }, items: { key_red: 2, key_blue: 2, key_green: 1, victory: 1 }, maxItemsPerRegion: 2,
        });
        const plan = arrangeSpiralPlan(cfg);
        expect(plan.items.map((l) => l.length)).toEqual([2, 2, 2]);
        expect(plan.items[2]).toContain(GOAL_ITEM);
    });

    it('refuses a pool the item-holding cells cannot hold, naming the shortfall and the regions that hold none', () => {
        const cfg = config({ quotas: { maze: 1, bounce: 2 }, items: { key_red: 2, victory: 1 } });
        expect(() => arrangeSpiralPlan(cfg)).toThrow(/holds 2 item\(s\) but the regions that can hold items have 1 slot\(s\) besides the goal.*bounce region\(s\) hold no pool items/);
    });

    it('a jta zone takes the goal on its Travel task and adds no Victory of its own', () => {
        const cfg = config({ quotas: { jta: 3 }, jta: { ...JTA_ON, goalZone: 0, goalVictory: true } });
        install(cfg);
        const plan = arrangeSpiralPlan(cfg);
        const { grid } = realiseSpiralRegions(plan, cfg);
        const goalCell = plan.items.findIndex((l) => l.includes(GOAL_ITEM));
        expect(goalCell).toBe(2);
        const victories = [];
        for (const r of grid.allRegions()) {
            for (const l of r.extracted_rules.locations) if (l.item === GOAL_ITEM) victories.push({ r, l });
        }
        // goalZone 0 + goalVictory on would place jta's own Victory in zone 0: the engine owns the goal instead.
        expect(victories).toHaveLength(1);
        expect(victories[0].r.playable_payload.jtaZone).toBe(2);
    });

    it('a noiz2sa zone grows a location for each item beyond its table, the goal on the last', () => {
        const cfg = config({ quotas: { noiz2sa: 2 }, items: { key_red: 1, victory: 1 }, maxItemsPerRegion: 3 });
        const plan = arrangeSpiralPlan(cfg);
        const { grid } = realiseSpiralRegions(plan, cfg);
        const byZone = Object.values(itemsByRegion(grid));
        // The noiz2sa table's own Victory (its last zone with locations) is filler: the engine owns the goal.
        expect(byZone.flat().filter((it) => it === GOAL_ITEM)).toHaveLength(1);
        const goalRegion = [...grid.allRegions()].find((r) => r.extracted_rules.locations.some((l) => l.item === GOAL_ITEM));
        const locs = goalRegion.extracted_rules.locations;
        expect(locs[locs.length - 1].item).toBe(GOAL_ITEM);
        expect(goalRegion.playable_payload.locations).toHaveLength(locs.length);
    });

    it('a known-gap substrate\'s own victory becomes filler when the engine placed the goal elsewhere (omsi)', () => {
        const cfg = config({ quotas: { maze: 1, omsi: 1 }, start: 'omsi' });
        const plan = arrangeSpiralPlan(cfg);
        const { grid, goalItem } = realiseSpiralRegions(plan, cfg);
        expect(goalItem).toBe(GOAL_ITEM);
        const omsi = [...grid.allRegions()].find((r) => r.substrate === 'omsi');
        expect(omsi.extracted_rules.locations.map((l) => l.item)).toEqual([LIBRARY_SLOT_FILLER_ITEM]);
        const maze = [...grid.allRegions()].find((r) => r.substrate === 'maze');
        expect(maze.extracted_rules.locations.map((l) => l.item)).toEqual([GOAL_ITEM]);
    });

    it('a world whose goal found no home keeps a known-gap substrate\'s own placement (omsi alone)', () => {
        const cfg = config({ quotas: { omsi: 1 } });
        const plan = arrangeSpiralPlan(cfg);
        expect(plan.items).toEqual([[]]);
        const { grid } = realiseSpiralRegions(plan, cfg);
        expect(Object.values(itemsByRegion(grid)).flat()).toEqual([GOAL_ITEM]);
    });

    it('④ refuses a world whose completion names an item no location holds', async () => {
        // jta zone locations off: no region can hold the goal jta declares, and nothing places it.
        const env = newSpiralEnvelope({
            config: config({ quotas: { jta: 2 }, jta: {} }),
            compileIn: { seed: 1 },
        });
        await expect(runSpiralToStep(env)).rejects.toThrow(/completion condition names 'Victory', but no location of this world holds it.*No region of it can hold the goal/);
    });

    it('a world with no goal compiles with the constant-true completion', async () => {
        const env = newSpiralEnvelope({ config: config({ quotas: { maze: 2 }, items: { key_red: 1 } }), compileIn: { seed: 1 } });
        await runSpiralToStep(env);
        expect(env.compile.rulesJson.game_info['1'].completion_condition).toEqual({ type: 'constant', value: true });
    });

    it('the capacity of a cell: procedural = maxItemsPerRegion, a zone substrate by its hook, a known gap none', () => {
        substrateRegistry.get('jta').applyPipelineConfig(JTA_ON);
        expect(spiralCellCapacity('maze', 0, 2)).toBe(2);
        expect(spiralCellCapacity('noiz2sa', 0, 3)).toBe(3);
        expect(spiralCellCapacity('jta', 0, 2)).toBe(2);
        expect(spiralCellCapacity('bounce', 0, 2)).toBe(0);
        expect(spiralCellCapacity('library:x', 0, 2)).toBe(0);
        substrateRegistry.get('jta').applyPipelineConfig({});
        expect(spiralCellCapacity('jta', 0, 2)).toBe(0);
    });

    it('spiralItemHolders splits the registered spiral substrates by whether they hold pool items', () => {
        const { holders, gaps } = spiralItemHolders();
        expect(holders).toEqual(expect.arrayContaining(['jta', 'maze', 'noiz2sa']));
        expect(gaps).toEqual(expect.arrayContaining(['bounce', 'omsi']));
    });
});
