/**
 * regionGraphCentreAction — `centreGraphOn`'s DOM readout (region-map tutorial, G3): on a centring, the panel's root
 * carries `data-centred-on` (the region) and `data-centred-at` (a Date.now() stamp); a region the graph does not
 * draw centres nothing and writes nothing. A tutorial step's `done` reads the readout, never Cytoscape.
 */
import { describe, it, expect } from 'vitest';
import { centreGraphOn, makeRegionGraphCentreAction } from './regionGraphCentreAction.js';

function fakeUi(drawn) {
    const animated = [];
    const node = (id) => ({ id, empty: () => !drawn.includes(id) });
    return {
        animated,
        rootElement: { dataset: {} },
        cy: { getElementById: node, zoom: () => 0.5, animate: (opts) => animated.push(opts.center.eles.id) },
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
});
