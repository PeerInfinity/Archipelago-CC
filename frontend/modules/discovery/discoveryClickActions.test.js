/**
 * ⛓ CA-S4: `discovery.discover` is registered by Discovery's `initialize` (and unregistered by its cleanup), REPLACES
 * its `regionGraph:nodeSelected` listener, and is STILL GATED BY THE SETTINGS BUNDLE: a click discovers only when the
 * panel enables the action AND the bundle has `enableDiscoveryMode` and `clickDiscoversRegion` (loop mode's bundle,
 * `LOOP_MODE_OVERRIDES`, sets `clickDiscoversRegion: false`: it must hold).
 */
import { describe, it, expect, vi, afterAll } from 'vitest';

const stored = vi.hoisted(() => ({ values: {} }));
vi.mock('../../app/core/settingsManager.js', () => ({ default: {
    getSetting: async (k, d) => (k in stored.values ? stored.values[k] : d),
    updateSetting: async () => true,
    hasStoredSetting: async () => false,
} }));

const CA = await import('../regionView/clickActions.js');
const disc = await import('./index.js');
const state = (await import('./singleton.js')).default;
const { LOOP_MODE_OVERRIDES } = await import('./worldDiscoveryMode.js');

const subs = new Map();
const api = {
    getEventBus: () => ({ subscribe: (n, fn) => { subs.set(n, fn); return () => subs.delete(n); }, publish: () => {} }),
    getDispatcher: () => ({ publish: () => {}, publishToNextModule: () => {} }),
    getModuleFunction: () => null,
};
const cleanup = await disc.initialize('discovery', 0, api);
afterAll(() => { if (typeof cleanup === 'function') cleanup(); CA.resetClickActionsForTests(); });

async function bundle(values) {
    stored.values = Object.fromEntries(Object.entries(values).map(([k, v]) => [`moduleSettings.discovery.${k}`, v]));
    await subs.get('settings:changed')({ key: '*' });
}
const click = (panelId, settings = { enabled: true, region: {}, location: {} }) =>
    CA.runClickActions(panelId, 'region', { regionName: 'Cave' }, settings, {}).results.find((r) => r.id === 'discovery.discover')?.result;

describe('discovery.discover', () => {
    it('is registered by initialize; the old listener is gone; ui:regionHeaderClicked (the Regions panel) stays', () => {
        expect(CA.getClickAction('discovery.discover')?.owner).toBe('discovery');
        expect(subs.has('regionGraph:nodeSelected')).toBe(false);
        expect(subs.has('ui:regionHeaderClicked')).toBe(true);
    });

    it('the bundle gates it: off → nothing; loop mode (clickDiscoversRegion: false) → nothing; on → it discovers', async () => {
        const discover = vi.spyOn(state, 'discoverRegion').mockReturnValue(false);
        vi.spyOn(state, 'isRegionDiscovered').mockReturnValue(false);
        await bundle({ enableDiscoveryMode: false, clickDiscoversRegion: true });
        expect(click('regionGraph')).toEqual({ ok: false, reason: 'not-enabled' });
        expect(LOOP_MODE_OVERRIDES.clickDiscoversRegion).toBe(false);
        await bundle(LOOP_MODE_OVERRIDES);
        expect(click('regionGraph')).toEqual({ ok: false, reason: 'not-enabled' });
        expect(discover).not.toHaveBeenCalled();
        await bundle({ enableDiscoveryMode: true, clickDiscoversRegion: true });
        expect(click('regionGraph')).toEqual({ ok: true, discovered: false });
        expect(discover).toHaveBeenCalledWith('Cave');
        // the panel's own switch: the Map starts OFF (no discovery), and a Graph that turned it off does not discover
        discover.mockClear();
        expect(click('regionMap')).toBeUndefined();
        expect(click('regionGraph', { enabled: true, region: { 'discovery.discover': false } })).toBeUndefined();
        expect(discover).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });

    it('the cleanup unregisters it', () => {
        cleanup();
        expect(CA.getClickAction('discovery.discover')).toBeNull();
    });
});
