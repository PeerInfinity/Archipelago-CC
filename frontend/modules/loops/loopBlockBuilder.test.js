/**
 * Targeted tests for LoopBlockBuilder additions. Full integration of
 * buildHeader pulls in loopState + discoveryStateSingleton + DOM, so
 * these tests focus on the substrate-label lookup helper introduced
 * for the substrate-aware region-block work, and on the loopSupport
 * capability lookups that gate the per-region loop-mode affordances.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { LoopBlockBuilder } from './loopBlockBuilder.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

describe('LoopBlockBuilder._getSubstrateLabel', () => {
    let builder;
    let registeredGetRegionInfo;

    beforeEach(() => {
        builder = new LoopBlockBuilder({});
        registeredGetRegionInfo = null;
    });

    afterEach(() => {
        // centralRegistry is a singleton — clean up any stub we installed.
        if (registeredGetRegionInfo) {
            const moduleFns = centralRegistry.publicFunctions.get('procgenPlayer');
            if (moduleFns) moduleFns.delete('getRegionInfo');
        }
    });

    function stubGetRegionInfo(fn) {
        registeredGetRegionInfo = fn;
        centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', fn);
    }

    it('returns the label from getRegionInfo when one is available', () => {
        stubGetRegionInfo(() => ({ substrate: 'maze', label: 'Maze', manaEnabled: true }));
        expect(builder._getSubstrateLabel('region_0_0')).toBe('Maze');
    });

    it('returns an empty string when the region has no substrate (AP-native)', () => {
        stubGetRegionInfo(() => null);
        expect(builder._getSubstrateLabel('Menu')).toBe('');
    });

    it('returns an empty string when getRegionInfo is not registered', () => {
        // Don't register — simulates non-procgen rules / bare test env.
        // centralRegistry returns null from getPublicFunction in that case.
        expect(builder._getSubstrateLabel('whatever')).toBe('');
    });

    it('returns an empty string when getRegionInfo returns info without a label', () => {
        stubGetRegionInfo(() => ({ substrate: 'custom', manaEnabled: false }));
        expect(builder._getSubstrateLabel('region_0_0')).toBe('');
    });

    it('forwards the region name to the looked-up function', () => {
        const calls = [];
        stubGetRegionInfo((name) => {
            calls.push(name);
            return { substrate: 'maze', label: 'Maze', manaEnabled: false };
        });
        builder._getSubstrateLabel('region_xyz');
        expect(calls).toEqual(['region_xyz']);
    });
});

describe('LoopBlockBuilder — loopSupport capability gating', () => {
    let builder;
    let registeredGetRegionInfo;

    beforeEach(() => {
        builder = new LoopBlockBuilder({});
        registeredGetRegionInfo = null;
        substrateRegistry.clear();
    });

    afterEach(() => {
        if (registeredGetRegionInfo) {
            const moduleFns = centralRegistry.publicFunctions.get('procgenPlayer');
            if (moduleFns) moduleFns.delete('getRegionInfo');
        }
        substrateRegistry.clear();
    });

    function stubRegionSubstrate(substrateId) {
        registeredGetRegionInfo = () => ({ substrate: substrateId, label: substrateId });
        centralRegistry.registerPublicFunction(
            'procgenPlayer', 'getRegionInfo', registeredGetRegionInfo);
    }

    it('returns null for AP-native regions (no substrate) — default affordances', () => {
        stubRegionSubstrate(null);
        expect(builder._getLoopSupport('Menu')).toBeNull();
        expect(builder._supportsQueueAction('Menu', 'regionMove')).toBe(true);
        expect(builder._supportsQueueAction('Menu', 'locationCheck')).toBe(true);
        expect(builder._supportsQueueAction('Menu', 'explore')).toBe(true);
    });

    it('returns null when getRegionInfo is not registered (non-procgen rules)', () => {
        expect(builder._getLoopSupport('whatever')).toBeNull();
        expect(builder._supportsQueueAction('whatever', 'explore')).toBe(true);
    });

    it('getModeOffers gates Record on declared record + playback', () => {
        substrateRegistry.register({
            id: 'rec', label: 'Rec', panelComponentType: 'p', loadRegionEvent: 'x',
            loopSupport: { queueActions: ['regionMove'], manual: true, record: true, playback: true },
        });
        stubRegionSubstrate('rec');
        const offers = builder.getModeOffers('R');
        expect(offers).toMatchObject({ offersManual: true, offersRecord: true, hasRow: true });
    });

    it('getModeOffers withholds Record when only manual/playback are declared', () => {
        substrateRegistry.register({
            id: 'norec', label: 'NoRec', panelComponentType: 'p', loadRegionEvent: 'x',
            loopSupport: { queueActions: ['regionMove'], manual: true },
        });
        stubRegionSubstrate('norec');
        const offers = builder.getModeOffers('R');
        expect(offers.offersManual).toBe(true);
        expect(offers.offersRecord).toBe(false);
    });

    it('reads loopSupport from the substrate registry entry', () => {
        substrateRegistry.register({
            id: 'maze',
            loopSupport: {
                queueActions: ['regionMove', 'locationCheck', 'explore'],
                manual: true,
                customQueues: true,
            },
        });
        stubRegionSubstrate('maze');
        const support = builder._getLoopSupport('region_0_0');
        expect(support.manual).toBe(true);
        expect(support.customQueues).toBe(true);
        expect(builder._supportsQueueAction('region_0_0', 'explore')).toBe(true);
    });

    it('excludes undeclared queue actions for substrate regions (bounce has no explore)', () => {
        substrateRegistry.register({
            id: 'bounce',
            loopSupport: {
                queueActions: ['regionMove', 'locationCheck'],
                manual: true,
                customQueues: false,
            },
        });
        stubRegionSubstrate('bounce');
        expect(builder._supportsQueueAction('region_1_0', 'regionMove')).toBe(true);
        expect(builder._supportsQueueAction('region_1_0', 'locationCheck')).toBe(true);
        expect(builder._supportsQueueAction('region_1_0', 'explore')).toBe(false);
        expect(builder._getLoopSupport('region_1_0').customQueues).toBe(false);
    });

    it('grants NO affordances for a substrate that declares no loopSupport', () => {
        substrateRegistry.register({ id: 'mystery' });
        stubRegionSubstrate('mystery');
        const support = builder._getLoopSupport('region_2_0');
        expect(support.manual).toBe(false);
        expect(support.customQueues).toBe(false);
        expect(builder._supportsQueueAction('region_2_0', 'regionMove')).toBe(false);
        expect(builder._supportsQueueAction('region_2_0', 'locationCheck')).toBe(false);
        expect(builder._supportsQueueAction('region_2_0', 'explore')).toBe(false);
    });

    it('real substrate entries declare the agreed capability matrix', async () => {
        substrateRegistry.clear();
        // Importing the libraries re-registers their entries as a side
        // effect (idempotent has() guard — registry was just cleared).
        const maze = (await import('../mazeRoom/mazeRoomLibrary.js')).substrateRegistryEntry;
        const tasw = (await import('../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js')).substrateRegistryEntry;
        const jta = (await import('../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js')).substrateRegistryEntry;
        const bounce = (await import('../bounceDemo/bounceDemoLibrary.js')).substrateRegistryEntry;
        const flash = (await import('../flashSubstrate/flashSubstrateLibrary.js')).substrateRegistryEntry;

        // M2: maze + textAdventure DECLARE record + playback (Record requires
        // both). The others don't yet (their recorders/replay land M4–M5).
        expect(maze.loopSupport).toMatchObject({
            manual: true, customQueues: true, record: true, playback: true,
        });
        expect([...maze.loopSupport.queueActions]).toEqual(['regionMove', 'locationCheck', 'explore']);

        expect(tasw.loopSupport).toMatchObject({
            manual: true, customQueues: false, record: true, playback: true,
        });
        expect([...tasw.loopSupport.queueActions]).toContain('explore');

        expect(jta.loopSupport).toMatchObject({ manual: true, customQueues: false });
        expect(jta.loopSupport.record ?? false).toBe(false);
        expect([...jta.loopSupport.queueActions]).toEqual(['regionMove']);

        expect(bounce.loopSupport).toMatchObject({ manual: true, customQueues: false });
        expect([...bounce.loopSupport.queueActions]).toEqual(['regionMove', 'locationCheck']);
        expect([...bounce.loopSupport.queueActions]).not.toContain('explore');

        expect(flash.loopSupport).toMatchObject({ manual: true, customQueues: false });
        expect([...flash.loopSupport.queueActions]).toEqual(['regionMove']);
    });
});
