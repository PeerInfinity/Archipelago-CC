/**
 * Targeted tests for LoopBlockBuilder additions. Full integration of
 * buildHeader pulls in loopState + discoveryStateSingleton + DOM, so
 * these tests focus on the substrate-label lookup helper introduced
 * for the substrate-aware region-block work, and on the loopSupport
 * capability lookups that gate the per-region loop-mode affordances.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { LoopBlockBuilder } from './loopBlockBuilder.js';
import loopState from './loopStateSingleton.js';
import { formatAnnotations } from './blockAnnotations.js';
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

    it('getModeOffers gates Instant (M3) on the declared instant capability', () => {
        substrateRegistry.register({
            id: 'inst', label: 'Inst', panelComponentType: 'p', loadRegionEvent: 'x',
            loopSupport: { queueActions: ['regionMove'], manual: true, playback: true, instant: true },
        });
        substrateRegistry.register({
            id: 'noinst', label: 'NoInst', panelComponentType: 'p', loadRegionEvent: 'y',
            loopSupport: { queueActions: ['regionMove'], manual: true, playback: true },
        });
        stubRegionSubstrate('inst');
        expect(builder.getModeOffers('R').offersInstant).toBe(true);
        // Re-stub to the non-instant substrate.
        registeredGetRegionInfo = () => ({ substrate: 'noinst', label: 'noinst' });
        centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', registeredGetRegionInfo);
        expect(builder.getModeOffers('R').offersInstant).toBe(false);
    });

    it('getModeOffers offersInstant is false for AP-native regions', () => {
        stubRegionSubstrate(null);
        expect(builder.getModeOffers('Menu').offersInstant).toBe(false);
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
        // both). M4: jta additionally DECLARES record + playback + instant
        // (fine-grained via the fork recorder; executor replay + stepTick
        // pump). The remaining ones don't yet (runner/bounce = M5, omsi = arc
        // D). M3/M4: maze + textAdventure + jta DECLARE instant (per-block
        // Instant toggle); the others don't yet.
        expect(maze.loopSupport).toMatchObject({
            manual: true, customQueues: true, record: true, playback: true, instant: true,
        });
        expect([...maze.loopSupport.queueActions]).toEqual(['regionMove', 'locationCheck', 'explore']);

        expect(tasw.loopSupport).toMatchObject({
            manual: true, customQueues: false, record: true, playback: true, instant: true,
        });
        expect([...tasw.loopSupport.queueActions]).toContain('explore');

        // M4: jta declares record + playback + instant; customQueues stays
        // false (queue panel deferred). regionMove remains its only
        // queue-grade action — the fine script lives in the saved recording.
        // requiresLoopMode: jta's native reset-to-zone-0 economy is the
        // loop-mode reset teleport once zones are host regions — a general
        // contract flag (omsi/future loop-games adopt it), not a jta special
        // case; loops refuses a manual loop-mode disable while it is loaded.
        expect(jta.loopSupport).toMatchObject({
            manual: true, customQueues: false, record: true, playback: true,
            instant: true, requiresLoopMode: true,
        });
        expect([...jta.loopSupport.queueActions]).toEqual(['regionMove']);
        // The other substrates do NOT require loop mode (non-loop-game or
        // native-standalone economies).
        expect(maze.loopSupport.requiresLoopMode ?? false).toBe(false);
        expect(tasw.loopSupport.requiresLoopMode ?? false).toBe(false);
        expect(bounce.loopSupport.requiresLoopMode ?? false).toBe(false);
        expect(flash.loopSupport.requiresLoopMode ?? false).toBe(false);

        expect(bounce.loopSupport).toMatchObject({ manual: true, customQueues: false });
        expect(bounce.loopSupport.instant ?? false).toBe(false);
        expect([...bounce.loopSupport.queueActions]).toEqual(['regionMove', 'locationCheck']);
        expect([...bounce.loopSupport.queueActions]).not.toContain('explore');

        expect(flash.loopSupport).toMatchObject({ manual: true, customQueues: false });
        expect(flash.loopSupport.instant ?? false).toBe(false);
        expect([...flash.loopSupport.queueActions]).toEqual(['regionMove']);
    });
});

// ---------------------------------------------------------------------------
// M4 slice 5 — recording-exists indicator / Playback gating / badge rule
// ---------------------------------------------------------------------------

describe('LoopBlockBuilder.getBlockPlayableContent (M4)', () => {
    let builder;

    beforeEach(() => {
        builder = new LoopBlockBuilder({});
        substrateRegistry.clear();
    });

    afterEach(() => {
        const moduleFns = centralRegistry.publicFunctions.get('procgenPlayer');
        if (moduleFns) moduleFns.delete('getRegionInfo');
        substrateRegistry.clear();
    });

    function stub(substrateId, { recorder = false } = {}) {
        substrateRegistry.register({
            id: substrateId, label: substrateId, panelComponentType: 'p',
            loadRegionEvent: `${substrateId}:load`,
            ...(recorder ? { takeLastRecording: () => null } : {}),
            loopSupport: { queueActions: ['regionMove'], manual: true, record: true, playback: true },
        });
        centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo',
            () => ({ substrate: substrateId, label: substrateId }));
    }

    const move = { pathEntry: { type: 'regionMove' } };
    const check = { pathEntry: { type: 'locationCheck' } };

    it('FINE-GRAINED: content means a bound store recording, never the interior', () => {
        stub('fine', { recorder: true });
        // A fine-grained block's queued interior is NOT its recording — the
        // recording lives in savedQueueStore. With none bound, a block full
        // of queued actions still has nothing to play back.
        expect(builder.getBlockPlayableContent('R', 1, [move, check, move]))
            .toEqual({ fineGrained: true, hasContent: false });
    });

    it('COARSE-ONLY: content means a non-empty interior (boundary moves do not count)', () => {
        stub('coarse');
        expect(builder.getBlockPlayableContent('R', 1, [move, move]))
            .toEqual({ fineGrained: false, hasContent: false });
        expect(builder.getBlockPlayableContent('R', 1, [move, check, move]))
            .toEqual({ fineGrained: false, hasContent: true });
    });

    it('reads the fine/coarse split off the registry, not off the region name', () => {
        stub('coarse');
        expect(builder.getBlockPlayableContent('R', 1, []).fineGrained).toBe(false);
        expect(loopState.isFineGrainedRegion('R')).toBe(false);
        substrateRegistry.clear();
        stub('fine', { recorder: true });
        expect(builder.getBlockPlayableContent('R', 1, []).fineGrained).toBe(true);
        expect(loopState.isFineGrainedRegion('R')).toBe(true);
    });
});

describe('M4 annotation display rule', () => {
    it('shows NET deltas whenever nonzero and strips the owner namespace', () => {
        const { nets } = formatAnnotations({
            items: {
                'jta/Food': { net: 3, min: 0 },
                'maze/Gem': { net: -2, min: -2 },
                'jta/Rope': { net: 0, min: 0 },
            },
            xp: { net: 0 },
        });
        expect(nets).toEqual(['+3 Food', '-2 Gem']);
    });

    it('shows a minimum ONLY when it went below zero, as "needs ≥X at start"', () => {
        const { needs } = formatAnnotations({
            items: {
                'jta/Food': { net: 3, min: 0 },     // never dipped → no badge
                'jta/Potion': { net: 1, min: -4 },  // dipped → the useful hint
            },
            xp: { net: 0 },
        });
        expect(needs).toEqual(['needs ≥4 Potion at start']);
    });

    it('keeps XP out of the badges but in the detail view', () => {
        const { nets, needs, detail } = formatAnnotations({
            items: {}, xp: { net: 137.4 },
        });
        expect(nets).toEqual([]);
        expect(needs).toEqual([]);
        expect(detail).toBe('XP earned: 137');
    });

    it('renders nothing for an absent or empty annotation', () => {
        expect(formatAnnotations(null)).toEqual({ nets: [], needs: [], detail: '' });
        expect(formatAnnotations({ items: {}, xp: { net: 0 } }).nets).toEqual([]);
    });
});

