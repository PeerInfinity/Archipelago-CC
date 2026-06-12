/**
 * Renderer selection for bounce regions: the registry entry's identity
 * fields (panelComponentType / loadRegionEvent / iframeId) are live
 * getters over the library's renderer state, so flipping the
 * moduleSettings.bounceDemo.renderer setting routes region loads to
 * either the JS canvas renderer or the real-DJ page — same substrate
 * id, no re-registration (procgenPlayer reads these fields on every
 * region move).
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
    substrateRegistryEntry,
    setBounceRenderer,
    getBounceRenderer,
    BOUNCE_PANEL_COMPONENT_TYPE,
    BOUNCE_LOAD_REGION_EVENT,
    BOUNCE_IFRAME_ID,
    BOUNCE_DJ_PANEL_COMPONENT_TYPE,
    BOUNCE_DJ_LOAD_REGION_EVENT,
    BOUNCE_DJ_IFRAME_ID,
} from './bounceDemoLibrary.js';

afterEach(() => setBounceRenderer('js'));

describe('bounce renderer switch', () => {
    it('defaults to the JS renderer identity (headless imports too)', () => {
        expect(getBounceRenderer()).toBe('js');
        expect(substrateRegistryEntry.panelComponentType)
            .toBe(BOUNCE_PANEL_COMPONENT_TYPE);
        expect(substrateRegistryEntry.loadRegionEvent)
            .toBe(BOUNCE_LOAD_REGION_EVENT);
        expect(substrateRegistryEntry.iframeId).toBe(BOUNCE_IFRAME_ID);
    });

    it('switches the entry identity to the real-DJ panel and back', () => {
        setBounceRenderer('dj');
        expect(substrateRegistryEntry.panelComponentType)
            .toBe(BOUNCE_DJ_PANEL_COMPONENT_TYPE);
        expect(substrateRegistryEntry.loadRegionEvent)
            .toBe(BOUNCE_DJ_LOAD_REGION_EVENT);
        expect(substrateRegistryEntry.iframeId).toBe(BOUNCE_DJ_IFRAME_ID);

        setBounceRenderer('js');
        expect(substrateRegistryEntry.panelComponentType)
            .toBe(BOUNCE_PANEL_COMPONENT_TYPE);
    });

    it('treats unknown values as js (defensive default)', () => {
        setBounceRenderer('dj');
        setBounceRenderer('something-else');
        expect(getBounceRenderer()).toBe('js');
    });

    it('keeps the frozen entry working (getters survive Object.freeze)', () => {
        expect(Object.isFrozen(substrateRegistryEntry)).toBe(true);
        setBounceRenderer('dj');
        expect(substrateRegistryEntry.panelComponentType)
            .toBe(BOUNCE_DJ_PANEL_COMPONENT_TYPE);
    });
});
