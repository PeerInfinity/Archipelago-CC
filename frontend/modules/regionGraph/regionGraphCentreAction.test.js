/**
 * regionGraphCentreAction — `centreGraphOn`'s DOM readout (region-map tutorial, G3): on a centring, the panel's root
 * carries `data-centred-on` (the region) and `data-centred-at` (a Date.now() stamp); a region the graph does not
 * draw centres nothing and writes nothing. A tutorial step's `done` reads the readout, never Cytoscape.
 */
import { describe, it, expect } from 'vitest';
import {
    applyPendingCentre, centreGraphOn, dropStalePendingCentre, makeRegionGraphCentreAction,
} from './regionGraphCentreAction.js';

/** A panel whose graph draws `drawn`; `size.w` 0 = its tab is hidden (Cytoscape measures 0×0). */
function fakeUi(drawn, size = { w: 600 }) {
    const animated = [];
    const node = (id) => ({ id, empty: () => !drawn.includes(id) });
    return {
        animated,
        rootElement: { dataset: {} },
        cy: { getElementById: node, zoom: () => 0.5, width: () => size.w, animate: (opts) => animated.push(opts.center.eles.id) },
    };
}

describe('centreGraphOn', () => {
    it('writes data-centred-on / data-centred-at on a centring', () => {
        const ui = fakeUi(['level_4']);
        const before = Date.now();
        expect(centreGraphOn(ui, 'level_4')).toBe(true);
        expect(ui.animated).toEqual(['level_4']);
        expect(ui.rootElement.dataset.centredOn).toBe('level_4');
        expect(Number(ui.rootElement.dataset.centredAt)).toBeGreaterThanOrEqual(before);
    });

    it('writes nothing for a region the graph does not draw', () => {
        const ui = fakeUi([]);
        expect(centreGraphOn(ui, 'level_4')).toBe(false);
        expect(ui.animated).toEqual([]);
        expect(ui.rootElement.dataset).toEqual({});
    });

    it('a panel without a root element still centres (the readout is optional)', () => {
        const ui = { ...fakeUi(['x']), rootElement: undefined };
        expect(centreGraphOn(ui, 'x')).toBe(true);
    });

    it('the action reports how many panels it centred', () => {
        const a = fakeUi(['r']);
        const b = fakeUi([]);
        const action = makeRegionGraphCentreAction(() => [a, b]);
        expect(action.run({}, { regionName: 'r' })).toEqual({ ok: true, centred: 1 });
        expect(a.rootElement.dataset.centredOn).toBe('r');
        expect(b.rootElement.dataset).toEqual({});
    });

    it('G4: a hidden graph keeps the name (the last wins), moves nothing, writes no readout', () => {
        const size = { w: 0 };
        const ui = fakeUi(['a', 'b'], size);
        expect(centreGraphOn(ui, 'a')).toBe(true);
        expect(centreGraphOn(ui, 'b')).toBe(true);
        expect(ui.pendingCentreOn).toBe('b');
        expect(ui.animated).toEqual([]);
        expect(ui.rootElement.dataset).toEqual({});
        // Shown: the pending centre is applied (and the caller does not fit), then cleared.
        size.w = 600;
        expect(applyPendingCentre(ui)).toBe(true);
        expect(ui.animated).toEqual(['b']);
        expect(ui.rootElement.dataset.centredOn).toBe('b');
        expect(ui.pendingCentreOn).toBe(null);
        // A second show has nothing pending: the caller fits, as before.
        expect(applyPendingCentre(ui)).toBe(false);
    });

    it('G4: a pending name the rebuilt graph no longer draws is dropped; one it draws is kept', () => {
        const drawn = ['a'];
        const ui = fakeUi(drawn, { w: 0 });
        centreGraphOn(ui, 'a');
        dropStalePendingCentre(ui);
        expect(ui.pendingCentreOn).toBe('a');
        drawn.length = 0;
        dropStalePendingCentre(ui);
        expect(ui.pendingCentreOn).toBe(null);
        expect(applyPendingCentre(ui)).toBe(false);
    });

    it('G4: a visible centring clears an older pending name', () => {
        const size = { w: 0 };
        const ui = fakeUi(['a', 'b'], size);
        centreGraphOn(ui, 'a');
        size.w = 600;
        centreGraphOn(ui, 'b');
        expect(ui.pendingCentreOn).toBe(null);
        expect(ui.animated).toEqual(['b']);
    });
});
