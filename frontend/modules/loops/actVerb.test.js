/**
 * The `act` verb (ActionNodes design §3) in Loops: the named custom-action table at the cost and completion sites,
 * the START GATE, and the per-region XP gain scale (§8).
 *
 * The world here is a fake region → substrate map and a registry entry with an `actionGate`; nothing ActionNodes-
 * specific is imported, because Loops must not know which substrate answers.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { installRafShim, uninstallRafShim, makeWired, makeTicker } from './testHarness.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { DEFAULT_EXPLORE_MULTIPLIER } from '../shared/procgen/loopCostDefaults.js';

beforeAll(installRafShim);
afterAll(uninstallRafShim);

const GATED = 'act_verb_test_substrate';
const REGION = 'node-a';
const ACT_COST = 30;
const MOVE_COST = 6;

/** A loaded cost data manager over one region with an authored act price. */
function costData({ xpGainScale } = {}) {
    const region = { moveCost: MOVE_COST, xpEffect: 'none', actions: { act: ACT_COST } };
    if (xpGainScale !== undefined) region.xpGainScale = xpGainScale;
    const regions = { [REGION]: region };
    return {
        isLoaded: () => true,
        getRegionCost: (r) => regions[r]?.moveCost ?? 50,
        getLocationCost: () => 10,
        getRegionXpEffect: () => 'none',
        getRegionActionCost: (r, n) => regions[r]?.actions?.[n] ?? null,
        getRegionXpGainScale: (r) => regions[r]?.xpGainScale ?? 1,
    };
}

describe('the act verb in Loops', () => {
    let loopState, gs, bus, tick, gateVerdict, gateCalls;
    beforeEach(() => {
        ({ loopState, gs, bus } = makeWired({ startRegion: REGION }));
        tick = makeTicker();
        gateCalls = [];
        gateVerdict = { ok: true };
        substrateRegistry.entries.delete(GATED);
        substrateRegistry.register({
            id: GATED,
            loopSupport: {
                queueActions: ['regionMove', 'act'],
                actionGate: (action) => { gateCalls.push(action); return gateVerdict; },
            },
        });
        loopState._lookupSubstrateId = (r) => (r === REGION ? GATED : null);
        loopState.setCostDataManager(costData());
        gs.noManaDepletionReset = true;
        loopState.instantMode = true;
    });
    afterEach(() => { substrateRegistry.entries.delete(GATED); });

    it('prices act at the region\'s authored actions.act; explore keeps move × the multiplier', () => {
        const act = { type: 'customAction', actionName: 'act', sourceRegion: REGION, params: {} };
        const explore = { type: 'customAction', actionName: 'explore', sourceRegion: REGION };
        expect(loopState._calculateActionCost(act)).toBe(ACT_COST);
        expect(loopState._calculateActionCost(explore)).toBe(MOVE_COST * DEFAULT_EXPLORE_MULTIPLIER);
    });

    it('an act entry is in the action queue, and its completion publishes loop:actionCompleted with its params', () => {
        gs.addCustomAction('act', { nodeId: REGION, label: 'Node A' });
        expect(loopState.getActionQueue().map((a) => a.actionName)).toEqual(['act']);
        loopState.startProcessing();
        for (let i = 0; i < 5 && loopState.isProcessing; i++) tick(loopState);
        const done = bus.events.filter((e) => e.name === 'loop:actionCompleted');
        expect(done).toHaveLength(1);
        expect(done[0].data).toEqual({
            actionName: 'act', regionName: REGION, params: { nodeId: REGION, label: 'Node A' }, fromLoop: true,
        });
        // ⛔ an act is not an explore: discovery's event is not published for it
        expect(bus.events.some((e) => e.name === 'loop:exploreCompleted')).toBe(false);
        expect(gs.getCurrentMana()).toBe(gs.getMaxMana() - ACT_COST);
    });

    it('the start gate is asked once per entry, BEFORE the entry spends anything', () => {
        gs.addCustomAction('act', { nodeId: REGION });
        loopState.startProcessing();
        for (let i = 0; i < 5 && loopState.isProcessing; i++) tick(loopState);
        expect(gateCalls).toHaveLength(1);
        expect(gateCalls[0].actionName).toBe('act');
    });

    it('a refusal STOPS the queue at that entry, names the action and the reason, and spends nothing', () => {
        gateVerdict = { ok: false, reason: 'needs Gold 5 (has 0)', code: 'resource' };
        gs.addCustomAction('act', { nodeId: REGION, label: 'Bribe the Guard' });
        const mana = gs.getCurrentMana();
        loopState.startProcessing();
        for (let i = 0; i < 5; i++) tick(loopState);
        expect(loopState.isProcessing).toBe(false);
        expect(gs.getCurrentMana()).toBe(mana);
        expect(loopState.lastActionRefusal).toMatchObject({
            index: 0, actionName: 'act', region: REGION, label: 'Bribe the Guard',
            reason: 'needs Gold 5 (has 0)', code: 'resource', substrate: GATED,
        });
        const refused = bus.events.filter((e) => e.name === 'loops:actionRefused');
        expect(refused).toHaveLength(1);
        expect(refused[0].data.label).toBe('Bribe the Guard');
        // ⛔ never skipped: the entry is still the current one and was not completed
        expect(bus.events.some((e) => e.name === 'loop:actionCompleted')).toBe(false);
        expect(loopState.currentActionIndex).toBe(0);
    });

    it('a gate that throws refuses, naming the throw', () => {
        substrateRegistry.entries.delete(GATED);
        substrateRegistry.register({ id: GATED, loopSupport: { actionGate: () => { throw new Error('boom'); } } });
        gs.addCustomAction('act', {});
        loopState.startProcessing();
        tick(loopState);
        expect(loopState.lastActionRefusal?.reason).toMatch(/the gate threw: boom/);
        expect(loopState.isProcessing).toBe(false);
    });

    it('a region whose substrate declares no gate is never asked (every other substrate)', () => {
        substrateRegistry.entries.delete(GATED);
        substrateRegistry.register({ id: GATED, loopSupport: { queueActions: ['explore'] } });
        gs.addCustomAction('explore', {});
        loopState.startProcessing();
        for (let i = 0; i < 5 && loopState.isProcessing; i++) tick(loopState);
        expect(loopState.lastActionRefusal).toBeNull();
        expect(bus.events.some((e) => e.name === 'loop:exploreCompleted' || e.name === 'loopState:queueCompleted')).toBe(true);
    });

    it('a loop reset clears the refusal', () => {
        gateVerdict = { ok: false, reason: 'not reached this loop' };
        gs.addCustomAction('act', {});
        loopState.startProcessing();
        tick(loopState);
        expect(loopState.lastActionRefusal).not.toBeNull();
        loopState._resetLoop();
        expect(loopState.lastActionRefusal).toBeNull();
    });
});

describe('xpGainScale — region XP earned is scaled per region (design §8)', () => {
    let loopState, gs;
    beforeEach(() => {
        ({ loopState, gs } = makeWired({ startRegion: REGION }));
    });

    it('the default (no field) awards 1 XP per mana, unchanged', () => {
        loopState.setCostDataManager(costData());
        loopState.addRegionXP(REGION, 40);
        expect(gs.getRegionXP(REGION).xp).toBe(40);
    });

    it('a stated scale multiplies the award; 0 awards nothing', () => {
        loopState.setCostDataManager(costData({ xpGainScale: 0.25 }));
        loopState.addRegionXP(REGION, 40);
        expect(gs.getRegionXP(REGION).xp).toBe(10);
        loopState.setCostDataManager(costData({ xpGainScale: 0 }));
        loopState.addRegionXP(REGION, 40);
        expect(gs.getRegionXP(REGION).xp).toBe(10);
    });

    it('_spendMana (live play, summaries, bots) goes through the same scale', () => {
        loopState.setCostDataManager(costData({ xpGainScale: 0.5 }));
        loopState._spendMana(REGION, 20);
        expect(gs.getRegionXP(REGION).xp).toBe(10);
    });
});
