import { describe, it, expect, beforeEach } from 'vitest';

import { TextAdventureSubstrateUI } from './textAdventureSubstrateUI.js';
import { _testOnly_resetModuleState } from './index.js';

// Vitest runs under the 'node' environment (no DOM). The panel's
// constructor guards document access for exactly this reason — these
// tests verify the non-rendering behaviour. DOM rendering checks are
// deferred to step 6's browser smoke test.

describe('TextAdventureSubstrateUI — skeleton', () => {
    beforeEach(() => {
        _testOnly_resetModuleState();
    });

    it('constructs without DOM and starts with no region loaded', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        expect(panel.world).toBeNull();
        expect(panel.currentRegionId).toBeNull();
        expect(panel.arrivedFromExitId).toBeNull();
    });

    it('stashes the region payload via applyLoadedRegion', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        const world = { exits: new Map(), items: new Map() };
        panel.applyLoadedRegion({
            region_id: 'Overworld',
            world,
            arrivedFrom: { exit_id: 'east_to_kitchen' },
        });
        expect(panel.world).toBe(world);
        expect(panel.currentRegionId).toBe('Overworld');
        expect(panel.arrivedFromExitId).toBe('east_to_kitchen');
    });

    it('handles a payload with no arrivedFrom', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.applyLoadedRegion({
            region_id: 'Overworld',
            world: { exits: new Map(), items: new Map() },
            arrivedFrom: null,
        });
        expect(panel.arrivedFromExitId).toBeNull();
    });

    it('applies multiple region transitions in order', () => {
        const panel = new TextAdventureSubstrateUI(null, {});
        panel.applyLoadedRegion({ region_id: 'A', world: {}, arrivedFrom: null });
        expect(panel.currentRegionId).toBe('A');
        panel.applyLoadedRegion({ region_id: 'B', world: {}, arrivedFrom: { exit_id: 'A_back' } });
        expect(panel.currentRegionId).toBe('B');
        expect(panel.arrivedFromExitId).toBe('A_back');
    });
});
