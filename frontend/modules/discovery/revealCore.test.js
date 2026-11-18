/**
 * ⛓ AN-1b discovery on the compiled ActionNodes example (⚖ Robert 2026-11-16T19:59:48Z, D1–D4, D6): the real
 * DiscoveryState, the compiled world's regions, `revealCore`'s reveals. Every name is read from the compiled world.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DiscoveryState } from './state.js';
import { cascadeTargetsOf, revealExits, revealStartNeighbourhood } from './revealCore.js';
import { compileActionGraph } from '../actionNodes/actionGraphCompiler.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GRAPH = JSON.parse(readFileSync(join(HERE, '../actionNodes/graphs/example-village.json'), 'utf8'));
const P = '1';
const { rules } = compileActionGraph(GRAPH);
const REGIONS = new Map(Object.entries(rules.regions[P]));
const START_REGIONS = rules.start_regions[P].default;
const PAYLOADS = Object.fromEntries(Object.entries(rules.preset_sidecars[P]).map(([k, v]) => [k, v.playable_payload]));
const forwardOf = (id) => PAYLOADS[id].exits.filter((e) => !e.reverse);
const reverseOf = (id) => PAYLOADS[id].exits.filter((e) => e.reverse);

/** A DiscoveryState initialised as the module does at a rules load (start regions, their exits and locations). */
function freshState() {
    const st = new DiscoveryState();
    st.setDependencies({
        eventBus: { publish() {} },
        stateManager: { getStartRegions: () => START_REGIONS, getStaticData: () => ({ regions: REGIONS }) },
    });
    st.initialize();
    return st;
}

const visibleUnknownExits = (st, id) => PAYLOADS[id].exits.filter((e) => !st.isExitDiscovered(id, e.exitName));

describe('D1 + D2: at load, the start is fully discovered and its neighbours show their contents', () => {
    const st = freshState();
    revealStartNeighbourhood(st, REGIONS, START_REGIONS);
    const start = GRAPH.start;

    it('the start regions lead to the start node', () => {
        expect(cascadeTargetsOf(REGIONS, START_REGIONS)).toEqual([start]);
    });
    it('D1: the start node and every exit of it are discovered', () => {
        expect(st.isRegionDiscovered(start)).toBe(true);
        expect(visibleUnknownExits(st, start)).toEqual([]);
    });
    it('D2: every neighbour is discovered with all its locations', () => {
        for (const e of forwardOf(start)) {
            expect(st.isRegionDiscovered(e.targetRegion), e.targetRegion).toBe(true);
            for (const loc of REGIONS.get(e.targetRegion).locations) expect(st.isLocationDiscovered(loc.name), loc.name).toBe(true);
        }
    });
    it('D3: a neighbour (never completed) keeps its FORWARD exits unknown; its move back is known', () => {
        for (const e of forwardOf(start)) {
            const n = e.targetRegion;
            expect(visibleUnknownExits(st, n).map((x) => x.exitName)).toEqual(forwardOf(n).map((x) => x.exitName));
            for (const back of reverseOf(n)) expect(st.isExitDiscovered(n, back.exitName), back.exitName).toBe(true);
        }
    });
    it('nothing beyond the neighbours is discovered, and no exit of theirs reveals a name', () => {
        const visible = new Set([...START_REGIONS, start, ...forwardOf(start).map((e) => e.targetRegion)]);
        for (const id of REGIONS.keys()) expect(st.isRegionDiscovered(id), id).toBe(visible.has(id));
    });
});

describe('the extended D2: a node\'s first clear reveals its exits, their targets with contents, and the moves back', () => {
    const st = freshState();
    revealStartNeighbourhood(st, REGIONS, START_REGIONS);
    const cleared = forwardOf(GRAPH.start).map((e) => e.targetRegion).find((id) => forwardOf(id).length > 0);
    const before = new Set([...REGIONS.keys()].filter((id) => st.isRegionDiscovered(id)));
    const out = revealExits(st, REGIONS, cleared, forwardOf(cleared).map((e) => e.exitName));

    it('its forward exits are named now', () => {
        expect(visibleUnknownExits(st, cleared)).toEqual([]);
    });
    it('each target is discovered with its locations, and the target\'s move back is known (no new "???")', () => {
        for (const e of forwardOf(cleared)) {
            const t = e.targetRegion;
            expect(st.isRegionDiscovered(t)).toBe(true);
            for (const loc of REGIONS.get(t).locations) expect(st.isLocationDiscovered(loc.name)).toBe(true);
            expect(visibleUnknownExits(st, t).every((x) => !x.reverse)).toBe(true);
            expect(visibleUnknownExits(st, t)).toHaveLength(forwardOf(t).length);
        }
    });
    it('D6: no random pick — exactly the named exits, their targets and those targets\' locations, nothing else', () => {
        const targets = forwardOf(cleared).map((e) => e.targetRegion);
        expect(out.regions.sort()).toEqual(targets.filter((t) => !before.has(t)).sort());
        expect(out.locations.sort()).toEqual(targets.flatMap((t) => REGIONS.get(t).locations.map((l) => l.name)).sort());
        expect(out.exits.sort()).toEqual([
            ...forwardOf(cleared).map((e) => `${cleared}:${e.exitName}`),
            ...targets.flatMap((t) => reverseOf(t).filter((b) => b.targetRegion === cleared).map((b) => `${t}:${b.exitName}`)),
        ].sort());
        // repeatable: a second reveal discovers nothing
        expect(revealExits(st, REGIONS, cleared, forwardOf(cleared).map((e) => e.exitName))).toEqual({ exits: [], regions: [], locations: [] });
    });
});

describe('D4: nothing clears discovery on a loop reset', () => {
    it('⛔ PIN: no module publishes `loop:reset` (the one subscriber that would clear discovery)', () => {
        const root = join(HERE, '..');
        const out = [];
        const walk = (dir) => {
            for (const name of readdirSync(dir, { withFileTypes: true })) {
                const p = join(dir, name.name);
                if (name.isDirectory()) { if (name.name !== 'node_modules') walk(p); continue; }
                if (!/\.m?js$/.test(name.name) || /\.test\.m?js$/.test(name.name)) continue;
                const text = readFileSync(p, 'latin1');
                if (/publish\(\s*['"]loop:reset['"]/.test(text)) out.push(p);
            }
        };
        walk(root);
        expect(out).toEqual([]);
    });
});
