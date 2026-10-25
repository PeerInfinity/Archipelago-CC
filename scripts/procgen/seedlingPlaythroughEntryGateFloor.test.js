/**
 * ⛓ RULES l55-waterfall — an ALL-WATER level is floored by its entry gate, so its waterfalls are priced.
 *
 * The analyzer's components are dry cells. L52 has none an exit or a location reaches, so it shipped as ONE
 * region and the bottom pool (L51/L56) reached the L55 door, and with it Boss Key 3, on Swim alone. In the game
 * a waterfall is one-way DOWN without the Feather (`Player.as:1557`), and the way in from below needs it
 * (probe-seedling-l55-waterfall: bottom-swim no key, bottom-feather key, top-swim key — 8/8 on CI).
 *
 * Each row BUILDS the atlas fresh, so a regression reds here and not only in a `--check`.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll } from 'vitest';

import {
    buildPlaythroughAtlas, playthroughEntryGate, playthroughEntryGateUncharged, PLAYTHROUGH_MAP,
} from './make-seedling-playthrough-rules.mjs';

let atlas;
beforeAll(() => { atlas = buildPlaythroughAtlas(); }, 120_000);

const SWIM = JSON.stringify({ flag: 'canSwim' });
const FEATHER = { rule: 'Has', args: { item_name: 'Progressive Swim', count: 2 } };
const levelOf = (n) => PLAYTHROUGH_MAP.levels.find((l) => l.level === n);
const regionOf = (id) => atlas.regions.find((r) => r.region_id === id);
const crossing = (from, to) => regionOf('level_52').subgraph.internal_exits.find((e) => e.from === from && e.to === to);
const subOf = (exitId) => regionOf('level_52').exits.find((e) => e.exit_id === exitId).sub_region;
// L52's three pools, by the door each holds.
const TOP = 'r0c7';
const MIDDLE = 'r2c2';
const BOTTOM = 'r5c10';

describe('which levels are floored', () => {
    it('exactly L50 and L52: no binding reaches a dry cell, and every binding stands on Swim water', () => {
        const floored = atlas.regions.filter((r) => playthroughEntryGate(levelOf(r.map_ref)) !== null)
            .map((r) => r.map_ref);
        expect(floored).toEqual([50, 52]);
        expect(playthroughEntryGate(levelOf(52))).toBe(SWIM);
    });

    it('L57 is excluded: all water too, but its bindings stand on mixed gates (the tentacle beast is manual)', () => {
        expect(playthroughEntryGate(levelOf(57))).toBeNull();
        expect(regionOf('level_57').subgraph).toBeUndefined();
    });

    it('control: a level whose bindings reach dry floor is not floored, its water still a crossing (L54)', () => {
        expect(playthroughEntryGate(levelOf(54))).toBeNull();
        expect(regionOf('level_54').subgraph.internal_exits.some((e) => e.access_rule)).toBe(true);
    });
});

describe('L52 splits into its three pools', () => {
    it('one sub-region per pool, each door in the pool that holds it', () => {
        expect(regionOf('level_52').subgraph.sub_regions).toEqual([TOP, MIDDLE, BOTTOM]);
        expect(subOf('out_teleporter_112_0')).toBe(TOP);       // to L54
        expect(subOf('in_L54_128_464')).toBe(TOP);
        expect(subOf('out_teleporter_0_48')).toBe(MIDDLE);     // to L55
        expect(subOf('in_L55_80_48')).toBe(MIDDLE);
        expect(subOf('out_teleporter_0_112')).toBe(BOTTOM);    // to L51
        expect(subOf('out_teleporter_224_112')).toBe(BOTTOM);  // to L56
    });

    it('bottom -> middle (the L55 door, Boss Key 3) climbs a waterfall: the Feather', () => {
        expect(crossing(BOTTOM, MIDDLE).access_rule).toEqual(FEATHER);
    });

    it('top -> middle is a fall: Feather-free, the game\'s own way in (top-swim)', () => {
        expect(crossing(TOP, MIDDLE).access_rule).toBeUndefined();
    });

    it('control: every DOWN-only waterfall stays free, every climb costs the Feather', () => {
        expect(crossing(MIDDLE, BOTTOM).access_rule).toBeUndefined();
        expect(crossing(TOP, BOTTOM).access_rule).toBeUndefined();
        expect(crossing(MIDDLE, TOP).access_rule).toEqual(FEATHER);
        expect(crossing(BOTTOM, TOP).access_rule).toEqual(FEATHER);
        expect(regionOf('level_52').subgraph.internal_exits).toHaveLength(6);
    });
});

describe('L50, the other floored level', () => {
    it('is one pool with no waterfall: still one region, no subgraph — floored, but nothing moves', () => {
        expect(playthroughEntryGate(levelOf(50))).toBe(SWIM);
        expect(regionOf('level_50').subgraph).toBeUndefined();
        expect(regionOf('level_50').exits.every((e) => e.sub_region === undefined)).toBe(true);
    });
});

describe('the floor\'s premise: every way INTO a floored level is charged its entry gate', () => {
    // The committed preset (the producer's --check holds it equal to a fresh build, and refuses on this list).
    const rules = JSON.parse(readFileSync(
        new URL('../../frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));
    const regions = rules.regions['1'] ?? rules.regions;
    const into = (n) => Object.entries(regions).filter(([from]) => !from.startsWith(`level_${n}`))
        .flatMap(([, r]) => (r.exits ?? []).filter((e) => e.connected_region.startsWith(`level_${n}`)).map((e) => e.name))
        .filter((name) => /^level_\d+/.test(name)).sort();
    const mutate = (exitName, rule) => {
        const copy = structuredClone(rules);
        const r = copy.regions['1'] ?? copy.regions;
        const exit = Object.values(r).flatMap((x) => x.exits ?? []).find((e) => e.name === exitName);
        if (rule === undefined) delete exit.access_rule; else exit.access_rule = rule;
        return copy;
    };
    const SWIM_RULE = { rule: 'Has', args: { item_name: 'Progressive Swim' } };

    it('none uncharged, over the ways in it actually inspected (not vacuous)', () => {
        expect(into(50)).toEqual(['level_49 -> level_50', 'level_51__r3c10 -> level_50']);
        expect(into(52)).toEqual(['level_51__r14c6 -> level_52__r5c10', 'level_54__r27c8 -> level_52__r0c7',
            'level_55 -> level_52__r2c2', 'level_56 -> level_52__r5c10']);
        expect(playthroughEntryGateUncharged(rules)).toEqual([]);
    });

    it('a door that lands dry (no rule) is named, with its level', () => {
        expect(playthroughEntryGateUncharged(mutate('level_56 -> level_52__r5c10')))
            .toEqual([{ level: 52, exit: 'level_56 -> level_52__r5c10' }]);
    });

    it('an Or with a Swim-free branch is NOT a charge; an And carrying Swim is', () => {
        expect(playthroughEntryGateUncharged(mutate('level_49 -> level_50',
            { rule: 'Or', children: [SWIM_RULE, { rule: 'True_' }] }))).toEqual([{ level: 50, exit: 'level_49 -> level_50' }]);
        expect(playthroughEntryGateUncharged(mutate('level_49 -> level_50',
            { rule: 'And', children: [{ rule: 'Has', args: { item_name: 'Seal', count: 16 } }, SWIM_RULE] }))).toEqual([]);
    });
});
