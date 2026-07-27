// The glue that turns SeedlingRegionBinding's effects into real adapter calls
// and dispatcher events (region-atlas Phase 4). The state machine's own rules
// are pinned in seedlingRegionBinding.test.js; these cover the wiring — that a
// teleport reaches the adapter's invocation queue, that a crossing is published
// in the dispatcher dialect the substrate bridges use, and that the two feed
// each other WITHOUT looping.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SeedlingRegionGlue } from './seedlingRegionGlue.js';
import {
    substrateRegistryEntry as seedlingEntry,
    FLASH_SEEDLING_LOAD_REGION_EVENT,
} from './flashSeedlingLibrary.js';

const PRESET = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../presets/seedling_atlas/AP_1/AP_1_rules.json', import.meta.url)), 'utf8'));
const worldFor = (id) => seedlingEntry.deserializeWorld(PRESET.preset_sidecars['1'][id].playable_payload);

/** Minimal stand-ins for the two hosts the glue talks to. */
function makeHarness() {
    const subs = new Map();
    const eventBus = {
        subscribe: (name, fn) => {
            subs.set(name, fn);
            return () => subs.delete(name);
        },
        unsubscribe: (name) => subs.delete(name),
    };
    const published = [];
    const dispatcher = { publish: (name, data, opts) => published.push({ name, data, opts }) };
    // A stand-in for FlashBridgeAdapter's teleport surface: the real one pushes
    // onto invokeQueue, which the push loop drains into the game.
    const adapter = { teleport: vi.fn(() => true), onStateReport: null };
    const panelLines = [];
    const glue = new SeedlingRegionGlue({
        eventBus,
        getDispatcher: () => dispatcher,
        loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
        getPanel: () => ({ _panelLog: (m, cls) => panelLines.push({ m, cls }) }),
    });
    glue.start();
    return {
        glue,
        adapter,
        published,
        panelLines,
        emitLoad: (payload) => subs.get(FLASH_SEEDLING_LOAD_REGION_EVENT)(payload),
        subscribed: () => subs.has(FLASH_SEEDLING_LOAD_REGION_EVENT),
    };
}

let h;
beforeEach(() => {
    h = makeHarness();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const loadRegion = (id, arrivedFrom = null) =>
    h.emitLoad({ region_id: id, world: worldFor(id), arrivedFrom });

describe('wiring', () => {
    it('subscribes the substrate load event on start and drops it on stop', () => {
        expect(h.subscribed()).toBe(true);
        h.glue.stop();
        expect(h.subscribed()).toBe(false);
    });

    it('installs its report hook on the adapter and removes it on detach', () => {
        h.glue.attachAdapter(h.adapter);
        expect(typeof h.adapter.onStateReport).toBe('function');
        h.glue.detachAdapter();
        expect(h.adapter.onStateReport).toBeNull();
    });
});

describe('arrival', () => {
    it('teleports through the adapter once the game starts reporting', () => {
        h.glue.attachAdapter(h.adapter);
        loadRegion('starting_house', { exit_id: 'door' });
        expect(h.adapter.teleport).not.toHaveBeenCalled(); // no baseline yet
        h.adapter.onStateReport('level', 0);               // the game boots
        expect(h.adapter.teleport).toHaveBeenCalledWith({ level: 86, x: 48, y: 64 });
        expect(h.glue.stats.teleports).toBe(1);
    });

    it('warns loudly instead of throwing when no adapter is attached', () => {
        // Force a teleport effect with no adapter: the binding is past baseline
        // only via a report, so drive the effect directly.
        h.glue.apply([{ type: 'teleport', level: 1, x: 2, y: 3, region: 'r' }]);
        expect(h.glue.stats.teleports).toBe(0);
        expect(h.glue.stats.warnings).toBe(1);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no flash adapter'));
        expect(h.panelLines.at(-1).cls).toBe('error');
    });
});

describe('crossing', () => {
    const boot = () => {
        h.glue.attachAdapter(h.adapter);
        loadRegion('overworld_start', null);
        h.adapter.onStateReport('level', 0);   // baseline
        h.adapter.onStateReport('level', 0);   // the arrival teleport, same level
        h.adapter.teleport.mockClear();
    };

    it('publishes user:regionMove with initialTarget bottom', () => {
        boot();
        h.adapter.onStateReport('level', 2);
        expect(h.published).toEqual([{
            name: 'user:regionMove',
            data: {
                sourceRegion: 'overworld_start',
                targetRegion: 'owls_nest_entrance',
                exitName: 'overworld_start -> owls_nest_entrance',
                source: 'seedlingRegionGlue',
            },
            opts: { initialTarget: 'bottom' },
        }]);
        expect(h.glue.stats.regionMoves).toBe(1);
    });

    it('does NOT publish a second move for its own arrival teleport (the echo)', () => {
        boot();
        h.adapter.onStateReport('level', 2);          // the player walks
        expect(h.glue.stats.regionMoves).toBe(1);     // positive count FIRST
        // procgen answers by loading the target region; the glue teleports...
        loadRegion('owls_nest_entrance', { exit_id: 'stairs_up' });
        expect(h.adapter.teleport).toHaveBeenCalledWith({ level: 2, x: 48, y: 16 });
        // ...and the level report that teleport causes must be swallowed.
        h.adapter.onStateReport('level', 2);
        expect(h.glue.stats.regionMoves).toBe(1);
        expect(h.published).toHaveLength(1);
    });

    it('warns and publishes nothing for a level the atlas does not cover', () => {
        boot();
        h.adapter.onStateReport('level', 42);
        expect(h.published).toEqual([]);
        expect(h.glue.stats.warnings).toBe(1);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no marked exit to'));
    });
});
