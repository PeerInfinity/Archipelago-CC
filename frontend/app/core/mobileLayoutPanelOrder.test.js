/**
 * region-map-link-ends: the mobile layout's tab order. A panel the preset does not list goes to the middle column's
 * tail, unless its moduleInfo names `mobileAfter`: then it sits right after that panel (the Region Map after the Region
 * Graph). The presets themselves are read, never changed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import mobileLayoutManager from './mobileLayoutManager.js';

const presets = JSON.parse(readFileSync(new URL('../../layout-configs/layout_presets.json', import.meta.url), 'utf8'));
const regionMapInfo = { mobileAfter: 'regionGraphPanel' };

let saved;
beforeEach(() => {
    saved = { panels: mobileLayoutManager.panels, presets: mobileLayoutManager.layoutPresets, id: mobileLayoutManager.activeLayoutId };
});
afterEach(() => {
    mobileLayoutManager.panels = saved.panels;
    mobileLayoutManager.layoutPresets = saved.presets;
    mobileLayoutManager.activeLayoutId = saved.id;
});

function order(layoutPresets, layoutId, register) {
    const m = mobileLayoutManager;
    m.panels = new Map();
    for (const [type, info] of register) m.registerPanel(type, class {}, type, info);
    m.layoutPresets = layoutPresets;
    m.activeLayoutId = layoutId;
    m.determinePanelOrder();
    return { columns: m.columnPanels.map((c) => [...c]), order: [...m.panelOrder] };
}

const tiny = {
    default: { root: { content: [
        { content: [{ componentType: 'a' }] },
        { content: [{ componentType: 'b' }, { componentType: 'regionGraphPanel' }, { componentType: 'c' }] },
        { content: [{ componentType: 'd' }] },
    ] } },
    other: { root: { content: [{ content: [{ componentType: 'a' }] }, { content: [{ componentType: 'b' }] }] } },
};
const REG = [['a', {}], ['b', {}], ['c', {}], ['d', {}], ['regionGraphPanel', {}], ['x', {}], ['regionMapPanel', regionMapInfo]];

describe('mobile tab order: mobileAfter', () => {
    it('the Region Map lands right after the Region Graph, in its column; other unlisted panels keep the tail', () => {
        const r = order(tiny, 'default', REG);
        expect(r.columns[1]).toEqual(['b', 'regionGraphPanel', 'regionMapPanel', 'c', 'x']);
        expect(r.order.indexOf('regionMapPanel')).toBe(r.order.indexOf('regionGraphPanel') + 1);
        expect(r.columns.flat().filter((t) => t === 'regionMapPanel')).toHaveLength(1);
    });
    it('a preset that does not list the anchor: it follows the anchor where the tail put it (no error, no duplicate)', () => {
        const r = order(tiny, 'other', REG);
        expect(r.columns[1]).toEqual(['b', 'c', 'd', 'regionGraphPanel', 'regionMapPanel', 'x']);
        expect(r.order.filter((t) => t === 'regionMapPanel')).toHaveLength(1);
    });
    it('the registration order does not matter: an unlisted anchor registered AFTER its follower', () => {
        const r = order(tiny, 'other', [['a', {}], ['b', {}], ['regionMapPanel', regionMapInfo], ['x', {}], ['regionGraphPanel', {}]]);
        expect(r.columns[1]).toEqual(['b', 'x', 'regionGraphPanel', 'regionMapPanel']);
    });
    it('an anchor that is not registered at all: the middle column\'s tail, as before', () => {
        const r = order(tiny, 'other', [['a', {}], ['b', {}], ['regionMapPanel', regionMapInfo]]);
        expect(r.columns[1]).toEqual(['b', 'regionMapPanel']);
    });
    it('two panels after one anchor keep their registration order', () => {
        const r = order(tiny, 'default', [...REG, ['second', regionMapInfo]]);
        expect(r.columns[1].slice(1, 4)).toEqual(['regionGraphPanel', 'regionMapPanel', 'second']);
    });
    it('a listed panel is never moved by mobileAfter', () => {
        const r = order(tiny, 'default', [['a', {}], ['b', {}], ['c', { mobileAfter: 'a' }], ['regionGraphPanel', {}]]);
        expect(r.columns[1]).toEqual(['b', 'regionGraphPanel', 'c']);
    });
    it('on every committed preset that lists the Region Graph, the Region Map tab is next to it', () => {
        let anchored = 0;
        for (const id of Object.keys(presets)) {
            const listed = JSON.stringify(presets[id]).includes('"regionGraphPanel"');
            const r = order(presets, id, [['regionGraphPanel', {}], ['regionMapPanel', regionMapInfo]]);
            const col = r.columns.find((c) => c.includes('regionMapPanel'));
            expect(r.order.filter((t) => t === 'regionMapPanel')).toHaveLength(1);
            if (listed) {
                anchored += 1;
                expect(col[col.indexOf('regionGraphPanel') + 1]).toBe('regionMapPanel');
            }
        }
        expect(anchored).toBeGreaterThan(0);
    });
});
