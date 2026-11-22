/**
 * regionMapLinks.test — the Region Map's links (zoom-links): the links BETWEEN groups are byte-identical to the
 * base function (`baseGroupLinks` below, copied verbatim from `regionMapModel.js` at 9e8172bf58, the commit before
 * the neighbour lines), and the links between NEIGHBOURS are every in-group pair the world links, one per pair.
 *
 * ⛔ No preset-derived hard pins (js-19 e3): over the presets every number is DERIVED (the base function's own
 * answer, the layout's own groups and graph).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildRegionMapModel, exitTileOf, groupLinks, neighbourLinks } from './regionMapModel.js';
import { displayRegionReader } from '../procgenCore/regionLayoutResolve.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import '../flashPanel/flashSeedlingLibrary.js';
import '../flashPanel/flashSeedlingGenLibrary.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const read = (p) => JSON.parse(readFileSync(here(p), 'utf8'));
const PRESETS = {
    seedling_playthrough: '../../presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json',
    seedling_er: '../../presets/seedling_er/AP_1/AP_1_rules.json',
    seedling_atlas: '../../presets/seedling_atlas/AP_1/AP_1_rules.json',
    seedling_playthrough_maze: '../../presets/seedling_playthrough_maze/AP_1/AP_1_rules.json',
    alttp: '../../presets/alttp/AP_14089154938208861744/AP_14089154938208861744_rules.json',
    procgen_topdown: '../../presets/procgen_topdown/AP_1/AP_1_rules.json',
};

// ⛔ FROZEN: `groupLinks` at 9e8172bf58, verbatim (renamed). The cross-group output must never move.
function baseGroupLinks({ layout, sidecars, displayOf, groupOf }) {
    const kindOf = new Map();
    for (const l of layout.graph?.links ?? []) {
        const k = `${l.from}\u0000${l.to}`;
        if (!kindOf.has(k)) kindOf.set(k, l.kind ?? 'join');
    }
    const out = [];
    const seen = new Set();
    const push = (from, to, a, b) => {
        if (from === to || !layout.positions.has(from) || !layout.positions.has(to)) return;
        if (groupOf.get(from) === groupOf.get(to)) return;
        const pair = from < to ? `${from}\u0000${to}` : `${to}\u0000${from}`;
        if (seen.has(pair)) return;
        seen.add(pair);
        out.push({ from, to, kind: kindOf.get(`${from}\u0000${to}`) ?? 'join', a, b });
    };
    const names = Object.keys(sidecars ?? {});
    if (names.length) {
        for (const name of names) {
            for (const e of sidecars[name]?.playable_payload?.exits ?? []) {
                const to = e?.targetRegion;
                if (typeof to !== 'string' || !sidecars[to]) continue;
                const back = (sidecars[to]?.playable_payload?.exits ?? []).find((x) => x?.exit_id === e.targetExitId) ?? null;
                push(displayOf(name), displayOf(to), exitTileOf(e), back ? exitTileOf(back) : null);
            }
        }
    } else {
        for (const l of layout.graph?.links ?? []) push(l.from, l.to, null, null);
    }
    return out;
}

const pairKey = (l) => (l.from < l.to ? `${l.from}\u0000${l.to}` : `${l.to}\u0000${l.from}`);

describe('the links between groups are unchanged (byte-identical to the base function)', () => {
    for (const [name, path] of Object.entries(PRESETS)) {
        it(name, () => {
            const rules = read(path);
            const m = buildRegionMapModel({ rules, registry: substrateRegistry });
            const sidecars = rules.preset_sidecars?.[m.player] ?? {};
            const displayOf = displayRegionReader(sidecars, substrateRegistry);
            const base = baseGroupLinks({ layout: m.layout, sidecars, displayOf, groupOf: m.groupOf });
            expect(JSON.stringify(m.links)).toBe(JSON.stringify(base));
            for (const l of m.links) expect(l.neighbour).toBeUndefined();
        });
    }
});

describe('the links between neighbours', () => {
    for (const [name, path] of Object.entries(PRESETS)) {
        it(`${name}: every in-group pair the world links, once; none crosses a group; no pair in both lists`, () => {
            const rules = read(path);
            const m = buildRegionMapModel({ rules, registry: substrateRegistry });
            const pairs = m.neighbourLinks.map(pairKey);
            expect(new Set(pairs).size).toBe(pairs.length);
            for (const l of m.neighbourLinks) {
                expect(l.neighbour).toBe(true);
                expect(m.groupOf.get(l.from)).toBe(m.groupOf.get(l.to));
                expect(l.from).not.toBe(l.to);
            }
            const cross = new Set(m.links.map(pairKey));
            for (const p of pairs) expect(cross.has(p)).toBe(false);
            // Derived: the in-group pairs of the layout graph (display keys) are all drawn.
            const want = new Set();
            for (const l of m.layout.graph?.links ?? []) {
                if (l.from !== l.to && m.layout.positions.has(l.from) && m.layout.positions.has(l.to)
                    && m.groupOf.get(l.from) === m.groupOf.get(l.to)) want.add(pairKey(l));
            }
            const got = new Set(pairs);
            for (const p of want) expect(got.has(p), p.replace('\u0000', ' ↔ ')).toBe(true);
        });
    }
    it('seedling_playthrough: there are neighbour lines, from the real door tiles at both ends', () => {
        const m = buildRegionMapModel({ rules: read(PRESETS.seedling_playthrough), registry: substrateRegistry });
        expect(m.neighbourLinks.length).toBeGreaterThan(0);
        expect(m.neighbourLinks.filter((l) => l.kind === 'join').length).toBeGreaterThan(0);
        for (const l of m.neighbourLinks) {
            expect(Array.isArray(l.a)).toBe(true);
            expect(Array.isArray(l.b)).toBe(true);
        }
    });
});

describe('neighbourLinks on a hand-made layout', () => {
    // One group of three side by side (A | B | C); A↔B linked both ways, B and C side by side but NOT linked;
    // D is another group, linked from C (a cross-group link).
    const layout = {
        positions: new Map([['A', { gx: 0, gy: 0 }], ['B', { gx: 1, gy: 0 }], ['C', { gx: 2, gy: 0 }], ['D', { gx: 2, gy: 2 }]]),
        graph: { links: [
            { from: 'A', to: 'B', kind: 'join' }, { from: 'B', to: 'A', kind: 'join' }, { from: 'C', to: 'D', kind: 'down' },
        ] },
    };
    const groupOf = new Map([['A', 'g1'], ['B', 'g1'], ['C', 'g1'], ['D', 'g2']]);
    const sc = (exits) => ({ playable_payload: { exits } });
    const sidecars = {
        A: sc([{ exit_id: 'a-e', targetRegion: 'B', targetExitId: 'b-w', exit_tiles: [[9, 3]] }]),
        B: sc([{ exit_id: 'b-w', targetRegion: 'A', targetExitId: 'a-e', exit_tiles: [[0, 3]] }]),
        C: sc([{ exit_id: 'c-d', targetRegion: 'D', targetExitId: 'd-u', x: 4, y: 4 }]),
        D: sc([{ exit_id: 'd-u', targetRegion: 'C', targetExitId: 'c-d', x: 1, y: 1 }]),
    };
    const args = { layout, sidecars, displayOf: (n) => n, groupOf };

    it('the linked pair gets ONE line (A↔B both ways), door tile to door tile, join kind', () => {
        expect(neighbourLinks(args)).toEqual([{ from: 'A', to: 'B', kind: 'join', a: [9, 3], b: [0, 3], neighbour: true }]);
    });
    it('B and C sit side by side but are not linked: no line', () => {
        expect(neighbourLinks(args).some((l) => [l.from, l.to].includes('C'))).toBe(false);
    });
    it('the cross-group list is unchanged by the neighbours: only C→D', () => {
        expect(groupLinks(args)).toEqual([{ from: 'C', to: 'D', kind: 'down', a: [4, 4], b: [1, 1] }]);
    });
    it('with no sidecars, the layout graph\'s in-group links, cell centre to cell centre', () => {
        const bare = { ...args, sidecars: {} };
        expect(neighbourLinks(bare)).toEqual([{ from: 'A', to: 'B', kind: 'join', a: null, b: null, neighbour: true }]);
        expect(groupLinks(bare)).toEqual([{ from: 'C', to: 'D', kind: 'down', a: null, b: null }]);
    });
    it('exitTileOf is the endpoint reader both lists use', () => {
        expect(exitTileOf(sidecars.A.playable_payload.exits[0])).toEqual([9, 3]);
    });
});
