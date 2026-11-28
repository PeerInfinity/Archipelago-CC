// actionNodes — the mystery link (AN-MYST-1): a graph's `mystery` block, validated, and the `slot_data.mystery` the
// compiler writes from it for the mystery page's bridge (mysteryArchipelago).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ACTION_GRAPH_REFUSALS, validateActionGraph } from './actionGraph.js';
import { MYSTERY_QUESTION_LOCATIONS_PENDING, compileActionGraph, mysterySlotDataOf } from './actionGraphCompiler.js';
import { committedActionPresets } from '../../../scripts/procgen/action-nodes-compile.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../..');
const read = (rel) => JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
const SAME_MONDAY = read('frontend/modules/actionNodes/graphs/same-monday.json');
const withMystery = (patch) => ({ ...SAME_MONDAY, mystery: { ...SAME_MONDAY.mystery, ...patch } });
const codes = (graph) => validateActionGraph(graph).errors.map((e) => `${e.code} ${e.path}`);

describe('a graph\'s mystery link is validated', () => {
    it('The Same Monday\'s link is valid', () => {
        expect(validateActionGraph(SAME_MONDAY).errors).toEqual([]);
    });
    it('a graph without one is unaffected (the link is optional)', () => {
        const { mystery: _, ...bare } = SAME_MONDAY;
        expect(validateActionGraph(bare).errors).toEqual([]);
    });
    it('each bad form is refused by name', () => {
        const B = ACTION_GRAPH_REFUSALS.BAD_MYSTERY;
        expect(codes({ ...SAME_MONDAY, mystery: [] })).toEqual([`${B} mystery`]);
        expect(codes(withMystery({ version: '' }))).toEqual([`${B} mystery.version`]);
        expect(codes(withMystery({ extra: 1 }))).toEqual([`${ACTION_GRAPH_REFUSALS.UNKNOWN_FIELD} mystery.extra`]);
        expect(codes(withMystery({ goal: { node: 'office', question: 'q.who' } }))).toEqual([`${B} mystery.goal.node`]);
        expect(codes(withMystery({ goal: { node: 'question' } }))).toEqual([`${B} mystery.goal`]);
        expect(codes(withMystery({ papers: {} }))).toEqual([`${B} mystery.papers`]);
        expect(codes(withMystery({ papers: { 'paper-nope': 'x' } }))).toEqual([`${B} mystery.papers.paper-nope`]);
        expect(codes(withMystery({ papers: { 'paper-inn': 'inn', 'paper-office': 'inn' } })))
            .toEqual([`${B} mystery.papers.paper-office`]);
    });
});

describe('the compiler writes slot_data.mystery for a linked graph, and only for one', () => {
    const { rules } = compileActionGraph(SAME_MONDAY, { seed: 1 });
    it('the shape the page\'s bridge reads, built from the graph\'s ids (no story id in code)', () => {
        const m = SAME_MONDAY.mystery;
        const items = Object.fromEntries(Object.entries(m.papers).map(([boon, paper]) => [SAME_MONDAY.boons[boon].name, paper]));
        expect(rules.world['1'].slot_data).toEqual({
            mystery: { story: m.story, version: m.version, case: m.case, goal: m.goal.question, locations: {}, items },
        });
        // Each mapped item is a real item of the world.
        for (const name of Object.keys(items)) expect(rules.items['1'][name]).toBeDefined();
    });
    it('⚑ PENDING (superseded by Robert\'s 2026-11-26 ruling; the world-side goal is AN-MYST-2): no question names a location', () => {
        expect(MYSTERY_QUESTION_LOCATIONS_PENDING).toEqual({});
        expect(mysterySlotDataOf(SAME_MONDAY).locations).toEqual({});
        // The goal is still the goal node's location, holding Victory: nothing the page sends maps to it.
        const goal = Object.values(rules.regions['1']).flatMap((r) => r.locations)
            .find((l) => l.name === SAME_MONDAY.nodes[SAME_MONDAY.mystery.goal.node].name);
        expect(goal.locked).toBe(true);
        expect(Object.keys(rules.world['1'].slot_data.mystery.locations)).not.toContain(goal.name);
    });
    it.each(committedActionPresets().map((r) => [r.graph, r]))('%s: slot_data only when the graph declares a link', (_, r) => {
        const graph = read(r.graph);
        const world = read(r.out).world['1'];
        if (graph.mystery) expect(world.slot_data?.mystery).toEqual(mysterySlotDataOf(graph));
        else expect(world.slot_data).toBeUndefined();
    });
});
