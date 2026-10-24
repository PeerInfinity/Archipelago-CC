// frontend/modules/procgenCore/rulesGraph.test.js
//
// EDITOR v3 slice D0a, §15 D7 / gap 7. The rows that matter here are the ones
// about the TWO SHAPES of `start_regions` and about what `reachableRegions`
// answers when nobody injects a rule interpreter — those are the two places a
// caller can be wrong while every existing test stays green.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    DEFAULT_PLAYER_ID,
    reachableRegions,
    regionsOf,
    startRegionsOf,
    walkRuleTrees,
    walkRulesGraph,
} from './rulesGraph.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../..');

/** A three-region chain: Menu → A → B, with a location and a gated exit. */
const doc = () => ({
    regions: {
        1: {
            Menu: { name: 'Menu', exits: [{ name: 'GameStart', connected_region: 'A', access_rule: { rule: 'True_' } }], locations: [] },
            A: {
                name: 'A',
                exits: [{ name: 'A→B', connected_region: 'B', access_rule: { rule: 'Has', args: { item_name: 'Key' } } }],
                locations: [{ name: 'Chest', id: 1, access_rule: { rule: 'True_' }, item_rule: { rule: 'Has', args: { item_name: 'Bag' } } }],
            },
            B: { name: 'B', exits: [], locations: [] },
            Island: { name: 'Island', exits: [], locations: [] },
        },
    },
    start_regions: { 1: { default: ['Menu'], available: ['A'] } },
});

describe('rulesGraph — regionsOf', () => {
    it('returns the player map, and an EMPTY OBJECT for every absent shape', () => {
        expect(Object.keys(regionsOf(doc(), '1'))).toEqual(['Menu', 'A', 'B', 'Island']);
        const one = doc();
        expect(regionsOf(one)).toBe(regionsOf(one, DEFAULT_PLAYER_ID));  // '1' IS the default
        for (const bad of [null, undefined, {}, { regions: null }, { regions: { 2: {} } }]) {
            expect(regionsOf(bad, '1')).toEqual({});
        }
        // An ARRAY is not a region map; Object.entries would have yielded indices.
        expect(regionsOf({ regions: { 1: ['A'] } }, '1')).toEqual({});
    });
});

describe('⛓ rulesGraph — startRegionsOf reads BOTH shapes', () => {
    it('the OBJECT shape (what every COMMITTED rules.json uses) keeps `available`', () => {
        expect(startRegionsOf(doc(), '1')).toEqual({ default: ['Menu'], available: ['A'] });
    });

    it('⛓ the ARRAY shape (test fixtures only) means `default`, and is NOT "no start region"', () => {
        // This is the defect the adoption cures: rulesUtils.validateRules:171
        // read `start_regions[player].default` on an array doc, got undefined,
        // and warned "No start region set." about a doc that has one.
        const arrayDoc = { ...doc(), start_regions: { 1: ['Menu', 'A'] } };
        expect(startRegionsOf(arrayDoc, '1')).toEqual({ default: ['Menu', 'A'], available: [] });
    });

    it('NEVER puts a raw object into an array-named field', () => {
        // The shape of `stateManager/core/initialization.js:199`'s defect.
        const weird = { start_regions: { 1: { default: { Menu: true }, available: 'A' } } };
        expect(Array.isArray(startRegionsOf(weird, '1').default)).toBe(true);
        expect(startRegionsOf(weird, '1')).toEqual({ default: [], available: [] });
    });

    it('is FROZEN, so no caller can hand a mutated view to the next one', () => {
        const start = startRegionsOf(doc(), '1');
        expect(Object.isFrozen(start)).toBe(true);
        expect(Object.isFrozen(start.default)).toBe(true);
        expect(() => { 'use strict'; start.default.push('X'); }).toThrow();
    });

    it('absent / unknown player → both empty', () => {
        for (const bad of [null, {}, { start_regions: {} }, { start_regions: { 1: 'Menu' } }]) {
            expect(startRegionsOf(bad, '1')).toEqual({ default: [], available: [] });
        }
    });
});

describe('rulesGraph — walkRulesGraph visits the STRUCTURE', () => {
    it('regions, exits and locations in document order with their context', () => {
        const seen = [];
        walkRulesGraph(doc(), '1', {
            region: (r, ctx) => seen.push(`region ${ctx.regionName}=${r.name}`),
            exit: (e, ctx) => seen.push(`exit ${ctx.regionName}/${ctx.exitName}→${e.connected_region}`),
            location: (l, ctx) => seen.push(`loc ${ctx.regionName}/${ctx.locationName}#${l.id}`),
        });
        expect(seen).toEqual([
            'region Menu=Menu',
            'exit Menu/GameStart→A',
            'region A=A',
            'exit A/A→B→B',
            'loc A/Chest#1',
            'region B=B',
            'region Island=Island',
        ]);
    });

    it('every visitor is optional, and a region with neither array is not a crash', () => {
        const bare = { regions: { 1: { X: { name: 'X' } } } };
        expect(() => walkRulesGraph(bare, '1', {})).not.toThrow();
        const names = [];
        walkRulesGraph(bare, '1', { region: (_r, ctx) => names.push(ctx.regionName) });
        expect(names).toEqual(['X']);
    });
});

describe('rulesGraph — walkRuleTrees is rulesUtils.walkRules, LIFTED', () => {
    it('visits exit rules, location rules and item_rule with the SAME contexts', () => {
        const seen = [];
        walkRuleTrees(doc(), '1', (node, ctx) => seen.push([node.rule, JSON.stringify(ctx)]));
        expect(seen).toEqual([
            ['True_', '{"regionName":"Menu","exitName":"GameStart"}'],
            ['Has', '{"regionName":"A","exitName":"A→B"}'],
            ['True_', '{"regionName":"A","locationName":"Chest"}'],
            ['Has', '{"regionName":"A","locationName":"Chest","fieldName":"item_rule"}'],
        ]);
    });

    it('descends And/Or children and Compare left/right', () => {
        const nested = {
            regions: { 1: { A: { name: 'A', exits: [{
                name: 'e',
                connected_region: 'A',
                access_rule: { rule: 'And', children: [
                    { rule: 'Has', args: { item_name: 'X' } },
                    { rule: 'Compare', args: { left: { rule: 'CountItem' }, right: { rule: 'True_' } } },
                ] },
            }], locations: [] } } },
        };
        const rules = [];
        walkRuleTrees(nested, '1', (n) => rules.push(n.rule));
        expect(rules).toEqual(['And', 'Has', 'Compare', 'CountItem', 'True_']);
    });

    it('the callback may MUTATE in place — the rename cascades depend on it', () => {
        const d = doc();
        walkRuleTrees(d, '1', (n) => { if (n.rule === 'Has') n.args.item_name = 'Renamed'; });
        expect(d.regions['1'].A.exits[0].access_rule.args.item_name).toBe('Renamed');
        expect(d.regions['1'].A.locations[0].item_rule.args.item_name).toBe('Renamed');
    });
});

describe('⛓ rulesGraph — reachableRegions, and what it does NOT answer', () => {
    it('WITHOUT `evaluate` every edge is free — the STRUCTURAL answer', () => {
        expect([...reachableRegions(doc(), '1')].sort()).toEqual(['A', 'B', 'Menu']);
        // Island has no inbound edge at all: unreachable under EVERY rule set.
        expect(reachableRegions(doc(), '1').has('Island')).toBe(false);
    });

    it('WITH an interpreter injected, a gate that fails cuts the graph', () => {
        const noKey = (rule) => !(rule?.rule === 'Has' && rule.args?.item_name === 'Key');
        expect([...reachableRegions(doc(), '1', noKey)].sort()).toEqual(['A', 'Menu']);
        // ⛓ The two answers DIFFER on this doc — which is the proof that the
        // structural default is not silently standing in for the logic one.
        expect(reachableRegions(doc(), '1').size).not.toBe(reachableRegions(doc(), '1', noKey).size);
    });

    it('`evaluate` is told WHERE the edge is', () => {
        const seen = [];
        reachableRegions(doc(), '1', (rule, ctx) => { seen.push(`${ctx.regionName}/${ctx.exitName}`); return true; });
        expect(seen).toEqual(['Menu/GameStart', 'A/A→B']);
    });

    it('a start_regions entry naming a MISSING region is not reported reachable', () => {
        const dangling = { ...doc(), start_regions: { 1: { default: ['Nowhere'] } } };
        expect([...reachableRegions(dangling, '1')]).toEqual([]);
    });

    it('an exit pointing at a MISSING region is not followed', () => {
        const d = doc();
        d.regions['1'].B.exits = [{ name: 'B→?', connected_region: 'Ghost', access_rule: null }];
        expect(reachableRegions(d, '1').has('Ghost')).toBe(false);
    });

    it('a cycle terminates', () => {
        const d = doc();
        d.regions['1'].B.exits = [{ name: 'B→A', connected_region: 'A' }];
        expect([...reachableRegions(d, '1')].sort()).toEqual(['A', 'B', 'Menu']);
    });

    it('reads the ARRAY shape as its start too', () => {
        const arrayDoc = { ...doc(), start_regions: { 1: ['A'] } };
        expect([...reachableRegions(arrayDoc, '1')].sort()).toEqual(['A', 'B']);
    });
});

describe('⛓ rulesGraph against a COMMITTED rules.json — the real shape, not a toy', () => {
    const preset = JSON.parse(readFileSync(
        join(REPO, 'frontend/presets/seedling_atlas/AP_1/AP_1_rules.json'), 'utf8'));

    it('reads the committed OBJECT shape and reaches every region structurally', () => {
        const start = startRegionsOf(preset, '1');
        expect(start.default.length).toBeGreaterThan(0);
        const regionNames = Object.keys(regionsOf(preset, '1'));
        expect(regionNames.length).toBeGreaterThan(0);
        const reached = reachableRegions(preset, '1');
        // A compiled atlas is wired: the structural walk reaches ALL of it.
        // (If this ever fails it is naming a genuinely orphaned region.)
        expect([...regionNames].filter((n) => !reached.has(n))).toEqual([]);
    });

    it('walkRulesGraph counts the same exits an open-coded loop would', () => {
        let exits = 0;
        let locations = 0;
        walkRulesGraph(preset, '1', { exit: () => { exits += 1; }, location: () => { locations += 1; } });
        const byHand = Object.values(preset.regions['1'])
            .reduce((acc, r) => ({ e: acc.e + (r.exits?.length ?? 0), l: acc.l + (r.locations?.length ?? 0) }), { e: 0, l: 0 });
        expect({ exits, locations }).toEqual({ exits: byHand.e, locations: byHand.l });
        expect(exits).toBeGreaterThan(0);
    });
});
