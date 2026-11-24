// actionNodes/actionGraph — the format is refused BY NAME. Each row breaks one rule of a valid graph (the example)
// and asserts the refusal's code, never its wording.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    ACTION_GRAPH_REFUSALS as R, ActionGraphError, assertActionGraph, predecessorsOf, resolvedBoostOf, successorsOf,
    validateActionGraph,
} from './actionGraph.js';
import { DEFAULT_MANA_PER_ITEM } from '../shared/procgen/loopCostDefaults.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = JSON.parse(readFileSync(join(HERE, 'graphs/example-village.json'), 'utf8'));
const clone = () => structuredClone(EXAMPLE);
const codesOf = (graph) => validateActionGraph(graph).errors.map((e) => e.code);
const refusedAs = (mutate, code) => {
    const g = clone();
    mutate(g);
    expect(codesOf(g)).toContain(code);
};

describe('the example graph', () => {
    it('is valid', () => {
        expect(validateActionGraph(EXAMPLE)).toEqual({ ok: true, errors: [] });
    });
    it('opens each node from its `after` sets, and the exits are the inverse', () => {
        for (const id of Object.keys(EXAMPLE.nodes)) {
            for (const from of predecessorsOf(EXAMPLE, id)) expect(successorsOf(EXAMPLE, from)).toContain(id);
        }
        expect(predecessorsOf(EXAMPLE, EXAMPLE.start)).toEqual([]);
    });
});

describe('refusals by name', () => {
    it('not a graph, wrong kind, wrong version, unknown field', () => {
        expect(codesOf(null)).toEqual([R.NOT_A_GRAPH]);
        refusedAs((g) => { g.kind = 'atlas'; }, R.WRONG_KIND);
        refusedAs((g) => { g.schema_version = 2; }, R.UNSUPPORTED_VERSION);
        refusedAs((g) => { g.extra = 1; }, R.UNKNOWN_FIELD);
        refusedAs((g) => { g.nodes.train.colour = 'red'; }, R.UNKNOWN_FIELD);
        refusedAs((g) => { g.loop = { mana: 0 }; }, R.BAD_LOOP);
    });
    it('names that do not resolve', () => {
        refusedAs((g) => { g.nodes.train.results.stats = { agility: 1 }; }, R.UNKNOWN_STAT);
        refusedAs((g) => { g.nodes['buy-bread'].requires.resources = { silver: 1 }; }, R.UNKNOWN_RESOURCE);
        refusedAs((g) => { g.nodes.train.after = [['nowhere']]; }, R.UNKNOWN_NODE);
        refusedAs((g) => { g.filler = 'nothing'; }, R.BAD_FILLER);
        refusedAs((g) => { g.nodes.train.name = g.nodes['do-chores'].name; }, R.DUPLICATE_NAME);
    });
    it('⛓ monotonicity by shape: no negative boost, no negative stat result', () => {
        refusedAs((g) => { g.boons['pocket-money'].gives.resources.gold = -1; }, R.NEGATIVE_BOOST);
        refusedAs((g) => { g.boons['pocket-money'].gives.mana = -1; }, R.NEGATIVE_BOOST);
        refusedAs((g) => { g.nodes.train.results.stats.strength = -1; }, R.NEGATIVE_STAT_RESULT);
        refusedAs((g) => { g.nodes['buy-bread'].requires.max = { gold: 9 }; }, R.MAXIMUM_REQUIREMENT);
    });
    it('every node has a limit, a time and a kind', () => {
        refusedAs((g) => { delete g.nodes.train.limit; }, R.BAD_LIMIT);
        refusedAs((g) => { g.nodes.train.limit = { grows_with: 'strength' }; }, R.GROWING_LIMIT);
        refusedAs((g) => { g.nodes.train.time = -5; }, R.BAD_TIME);
        refusedAs((g) => { g.nodes.train.kind = 'boss'; }, R.BAD_KIND);
    });
    it('one start, one goal, every other node opened, every node reachable', () => {
        refusedAs((g) => { g.nodes.train.kind = 'start'; delete g.nodes.train.after; }, R.START_NOT_ONE);
        refusedAs((g) => { g.nodes.start.time = 5; }, R.START_HAS_PARTS);
        refusedAs((g) => { g.nodes['guards-locker'].kind = 'goal'; }, R.GOAL_NOT_ONE);
        refusedAs((g) => { delete g.nodes.train.after; }, R.NODE_WITHOUT_AFTER);
        refusedAs((g) => {
            g.nodes.loop1 = { name: 'L1', kind: 'action', time: 1, limit: 1, after: [['loop2']] };
            g.nodes.loop2 = { name: 'L2', kind: 'action', time: 1, limit: 1, after: [['loop1']] };
        }, R.NODE_UNREACHABLE);
    });
    it('the forms version 1 leaves out are refused by their own name', () => {
        refusedAs((g) => { g.nodes.train.requires = [{ stats: { strength: 1 } }]; }, R.ALTERNATIVE_REQUIREMENTS);
        refusedAs((g) => { g.nodes.train.results.when = 'last'; }, R.RESULT_TIMING);
        refusedAs((g) => { g.nodes.train.modifies = []; }, R.MODIFIES);
    });
    it('the item pool fits the checks', () => {
        refusedAs((g) => { g.boons['pocket-money'].count = 2; }, R.ITEM_POOL_OVERFLOW);
        refusedAs((g) => { delete g.boons['pocket-money']; }, R.ITEM_POOL_SHORT);
        const g = clone();
        delete g.boons['pocket-money'];
        g.filler = 'strength-boost';
        expect(codesOf(g)).toEqual([]);
    });
    it('provenance (Z.7): present, a listed default, every src listed, each type\'s fields', () => {
        refusedAs((g) => { delete g.provenance; }, R.NO_PROVENANCE);
        refusedAs((g) => { g.provenance.default = 'nobody'; }, R.UNLISTED_SOURCE);
        refusedAs((g) => { g.nodes.train.src = 'nobody'; }, R.UNLISTED_SOURCE);
        refusedAs((g) => { delete g.provenance.sources['actionnodes-design'].model; }, R.BAD_PROVENANCE);
        refusedAs((g) => { g.provenance.sources['actionnodes-design'].type = 'rumour'; }, R.BAD_PROVENANCE);
    });
    it('assertActionGraph throws ActionGraphError carrying every code', () => {
        const g = clone();
        g.kind = 'atlas';
        g.nodes.train.time = -1;
        let caught;
        try { assertActionGraph(g); } catch (e) { caught = e; }
        expect(caught).toBeInstanceOf(ActionGraphError);
        expect(caught.code).toBe(R.WRONG_KIND);
        expect(caught.errors.map((e) => e.code)).toEqual(expect.arrayContaining([R.WRONG_KIND, R.BAD_TIME]));
    });
});

describe('⛓ the per-item starting-mana boost (⚖ user 2026-11-15: configurable, default 10)', () => {
    it('a boon that states no mana gets the shared default, one stated value is kept', () => {
        expect(resolvedBoostOf({ gives: { stats: { strength: 1 } } }).mana).toBe(DEFAULT_MANA_PER_ITEM);
        expect(resolvedBoostOf({}).mana).toBe(DEFAULT_MANA_PER_ITEM);
        expect(resolvedBoostOf({ gives: { mana: 0 } }).mana).toBe(0);
        expect(resolvedBoostOf({ gives: { mana: 25 } }).mana).toBe(25);
    });
});
