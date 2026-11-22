/**
 * G4 (region-map tutorial), the Map side: `RegionMapUI.centreOnRegion` (what the Region Graph's "Centre the Region
 * Map on it" runs) on a HIDDEN panel. Measured before the fix: the viewport is 0×0 and the focused camera got zoom 0,
 * so the shown Map drew nothing. Now the name is kept and `_resize` centres on it once the viewport has a size; a
 * rebuild whose map no longer draws it drops it. The real prototype methods run on a minimal panel object.
 */
import { describe, it, expect } from 'vitest';
import { RegionMapUI } from './regionMapUI.js';

/** A panel with cells `a` (at 0,0) and `b` (at 1000,0), 100×50 each; viewport `vp`. */
function fakePanel(vp = { w: 0, h: 0 }) {
    const frame = (key, x) => ({ key, x, y: 0, w: 100, h: 50, cell: { x, y: 0, w: 100, h: 50 } });
    const p = Object.create(RegionMapUI.prototype);
    Object.assign(p, {
        model: { cells: new Map([['a', { members: ['a'] }], ['b', { members: ['b', 'b__sub'] }]]) },
        frames: new Map([['a', frame('a', 0)], ['b', frame('b', 1000)]]),
        view: { get: () => ({ displayGroups: new Map([['b', { members: ['b', 'b__sub'] }]]) }) },
        vp: { ...vp }, dpr: 1, camera: { x: 0, y: 0, zoom: 1 }, follow: true,
        controls: { follow: { checked: true } },
        canvas: { width: 0, height: 0 },
        wrap: { getBoundingClientRect: () => ({ width: p.__size.w, height: p.__size.h }) },
        __size: { w: 0, h: 0 },
        _disposed: false, _cameraPlaced: true, _anim: null, _pendingCentre: null,
        _requestPaint: () => {},
        _placeCamera: () => {},
    });
    return p;
}

describe('RegionMapUI.centreOnRegion on a hidden panel (G4)', () => {
    it('keeps the name (the last wins), sets no zoom-0 camera, and centres once the panel has a size', () => {
        const p = fakePanel();
        expect(p.centreOnRegion('a')).toBe(true);
        expect(p.centreOnRegion('b__sub')).toBe(true);
        expect(p._pendingCentre).toBe('b__sub');
        expect(p._anim).toBe(null);
        expect(p.follow).toBe(false); // as a manual pan does
        p.__size = { w: 600, h: 400 };
        p._resize();
        expect(p._pendingCentre).toBe(null);
        // The ease targets b's cell centre at half the viewport: zoom = min(600/100, 400/50) · 0.5 = 3.
        expect(p._anim.to).toEqual({ x: 1050, y: 25, zoom: 3 });
    });

    it('a visible panel eases at once, and clears an older pending name', () => {
        const p = fakePanel();
        p.centreOnRegion('a');
        p.vp = { w: 600, h: 400 };
        expect(p.centreOnRegion('b')).toBe(true);
        expect(p._pendingCentre).toBe(null);
        expect(p._anim.to.zoom).toBeGreaterThan(0);
    });

    it('a region no cell draws is refused, hidden or not; a rebuild that drops the pending region clears it', () => {
        const p = fakePanel();
        expect(p.centreOnRegion('nowhere')).toBe(false);
        expect(p._pendingCentre).toBe(null);
        p.centreOnRegion('a');
        p.frames.delete('a');
        p.model.cells.delete('a');
        // (the check `_rebuild` runs after its reframe)
        if (p._pendingCentre && !p._frameFor(p._pendingCentre)) p._pendingCentre = null;
        expect(p._pendingCentre).toBe(null);
    });
});
