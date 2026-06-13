/**
 * Renderer selection for bounce regions. The two renderers (the JS canvas
 * page and the real-DJ page) are now ONE panel: the registry entry's
 * identity fields (panelComponentType / loadRegionEvent / iframeId) are
 * CONSTANT across renderers, and the single bounceDemoPanel swaps its own
 * iframe src on the moduleSettings.bounceDemo.renderer setting (both pages
 * load under the same iframeId + loadRegionEvent and speak the same
 * __swfBridge contract). So flipping the setting changes getBounceRenderer
 * / isDjRenderer (which the host module reads to pick the iframe src) but
 * never the routing identity procgenPlayer reads.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
    substrateRegistryEntry,
    setBounceRenderer,
    getBounceRenderer,
    isDjRenderer,
    BOUNCE_PANEL_COMPONENT_TYPE,
    BOUNCE_LOAD_REGION_EVENT,
    BOUNCE_IFRAME_ID,
} from './bounceDemoLibrary.js';

afterEach(() => setBounceRenderer('js'));

describe('bounce renderer switch', () => {
    it('defaults to the JS renderer (headless imports too)', () => {
        expect(getBounceRenderer()).toBe('js');
        expect(isDjRenderer()).toBe(false);
        expect(substrateRegistryEntry.panelComponentType)
            .toBe(BOUNCE_PANEL_COMPONENT_TYPE);
        expect(substrateRegistryEntry.loadRegionEvent)
            .toBe(BOUNCE_LOAD_REGION_EVENT);
        expect(substrateRegistryEntry.iframeId).toBe(BOUNCE_IFRAME_ID);
    });

    it('keeps ONE constant routing identity across renderers', () => {
        for (const renderer of ['js', 'dj', 'ruffle', 'swfrecomp', 'flash']) {
            setBounceRenderer(renderer);
            expect(getBounceRenderer()).toBe(renderer);
            expect(isDjRenderer()).toBe(renderer !== 'js');
            // The panel/iframe identity does NOT change — only the panel's
            // own iframe src does (host module, getIframeSrc).
            expect(substrateRegistryEntry.panelComponentType)
                .toBe(BOUNCE_PANEL_COMPONENT_TYPE);
            expect(substrateRegistryEntry.loadRegionEvent)
                .toBe(BOUNCE_LOAD_REGION_EVENT);
            expect(substrateRegistryEntry.iframeId).toBe(BOUNCE_IFRAME_ID);
        }
    });

    it('treats unknown values as js (defensive default)', () => {
        setBounceRenderer('dj');
        setBounceRenderer('something-else');
        expect(getBounceRenderer()).toBe('js');
        expect(isDjRenderer()).toBe(false);
    });

    it('keeps the frozen entry working', () => {
        expect(Object.isFrozen(substrateRegistryEntry)).toBe(true);
        setBounceRenderer('dj');
        expect(substrateRegistryEntry.panelComponentType)
            .toBe(BOUNCE_PANEL_COMPONENT_TYPE);
    });
});
