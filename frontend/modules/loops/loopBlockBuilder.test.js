/**
 * Targeted tests for LoopBlockBuilder additions. Full integration of
 * buildHeader pulls in loopState + discoveryStateSingleton + DOM, so
 * these tests focus on the substrate-label lookup helper introduced
 * for the substrate-aware region-block work.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { LoopBlockBuilder } from './loopBlockBuilder.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

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
