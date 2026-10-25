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
import { describe, it, expect, beforeAll } from 'vitest';

import { buildPlaythroughAtlas, playthroughEntryGate, PLAYTHROUGH_MAP } from './make-seedling-playthrough-rules.mjs';

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
