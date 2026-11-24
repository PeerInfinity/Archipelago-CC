// actionNodes/actionPlanner — the bot's plan for a loop, its reasoning lines, and a headless play to the goal.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildActionModel, loopStartState } from './actionModel.js';
import {
    leastShortPlan, livePrices, manaShortfall, PLAN_KINDS, planLoop, playToGoal, relevantNodes,
} from './actionPlanner.js';
import { compileActionGraph, placementsFromRules } from './actionGraphCompiler.js';
import { itemCombinations } from './actionSearch.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = JSON.parse(readFileSync(join(HERE, 'graphs/example-village.json'), 'utf8'));
const model = buildActionModel(EXAMPLE);
const ix = (id) => model.nodeIx.get(id);

describe('planLoop (A17)', () => {
    it('with nothing held: the most checks, ties by mana left — the Locker, and why not the Boulder', () => {
        const p = planLoop(model);
        expect(p.kind).toBe(PLAN_KINDS.CHECKS);
        expect(p.earns).toEqual(['Guard\'s Locker']);
        expect(p.lines.join('\n')).toContain('Move the Boulder: short by 5 mana after Guard\'s Locker');
    });
    it('the goal as soon as it is reachable', () => {
        const p = planLoop(model, { items: { 'strength-boost': 1 } });
        expect(p.kind).toBe(PLAN_KINDS.GOAL);
        expect(p.plan.at(-1)).toBe('leave-the-village');
    });
    it('no check earnable: run the least-short plan and attempt the node it cannot afford', () => {
        const start = { ...loopStartState(model), mana: model.nodes[ix('train')].time + 1 };
        const p = planLoop(model, { checked: ['guards-locker'], start });
        expect(p.kind).toBe(PLAN_KINDS.XP);
        // ⛓ The run spends what it has on the way (the bread's mana included) and attempts the target itself:
        // a tie in shortfall is broken by how far the plan runs (a plan that ran out before Eat Bread was found).
        expect(p.attempt).toBe('move-the-boulder');
        expect(p.plan).toContain('eat-bread');
        expect(p.lines[0]).toContain('No check can be earned this loop');
    });
    it('waiting for an item: every target short of an item, not of mana', () => {
        const p = planLoop(model, { checked: ['guards-locker', 'move-the-boulder'] });
        expect(p.kind).toBe(PLAN_KINDS.WAIT);
        expect(p.lines[0]).toContain('Waiting for an item');
    });
    it('region XP lowers the live prices', () => {
        const base = livePrices(model);
        const trained = livePrices(model, { train: 10_000 });
        expect(trained[ix('train')]).toBeLessThan(base[ix('train')]);
        expect(trained[ix('do-chores')]).toBe(base[ix('do-chores')]);
    });
    it('manaShortfall walks the plan with mana allowed below 0', () => {
        const s = { ...loopStartState(model), mana: 10 };
        expect(manaShortfall(model, s, [ix('train')])).toBe(model.nodes[ix('train')].time - 10);
        expect(manaShortfall(model, s, [ix('do-chores')])).toBe(0);
    });
});

describe('⛓ playToGoal: the headless bot reaches the goal under every placement', () => {
    const { rules } = compileActionGraph(EXAMPLE);
    const placements = placementsFromRules(rules, model, '1');
    it('the committed preset\'s placement, at the graph\'s XP scale and at 0', () => {
        for (const xpGainScale of [EXAMPLE.settings.xpGainScale, 0]) {
            const run = playToGoal(model, { placements, xpGainScale });
            expect(run.reachedGoal, `scale ${xpGainScale}`).toBe(true);
            expect(run.loops.every((l) => l.lines.length > 0)).toBe(true);
            // A6: every loop before the last earns at least one check.
            for (const l of run.loops) expect(l.checks.length, `loop ${l.loop}`).toBeGreaterThan(0);
        }
    });
    it('every other placement of the boons onto the checks', () => {
        const checks = model.checkIndices.map((i) => model.nodes[i].id);
        const boons = model.boons.map((b) => b.id);
        const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r])));
        for (const order of perms(boons)) {
            const pl = Object.fromEntries(checks.map((c, k) => [c, order[k]]));
            expect(playToGoal(model, { placements: pl }).reachedGoal, JSON.stringify(pl)).toBe(true);
        }
        expect(itemCombinations(model).length).toBeGreaterThan(1);
    });
});

describe('⛓ the relevance cone (AN-OMSI-1): the ignore-mana search gives the whole graph\'s answer', () => {
    it('every target, every item combination, full and short pools: the same shortfall; above 0, the same answer', () => {
        let compared = 0;
        for (const items of itemCombinations(model)) {
            for (const mana of [undefined, 30, 5]) {
                const base = loopStartState(model, items);
                const start = mana === undefined ? base : { ...base, mana };
                for (const t of [...model.checkIndices, model.goalIndex]) {
                    const a = leastShortPlan(model, start, t);
                    const b = leastShortPlan(model, start, t, undefined, undefined, { cone: false });
                    const label = `${model.nodes[t].id} with ${items}, mana ${start.mana}`;
                    expect(a?.short, label).toBe(b?.short);
                    if (b && b.short > 0) { expect(a, label).toEqual(b); compared += 1; }
                }
            }
        }
        expect(compared).toBeGreaterThan(0);
    });
    it('the cone keeps the target, its ways in, and the producers of what it lacks; drops what cannot help', () => {
        const keep = relevantNodes(model, loopStartState(model), ix('leave-the-village'));
        const kept = model.nodes.filter((_, i) => keep[i]).map((n) => n.id);
        // Leave the Village: after Move the Boulder (after Train); Strength from Train, Knowledge from Read the Notice;
        // Eat Bread gives more mana than it costs. Guard's Locker and Bribe the Guard give it nothing.
        expect(kept).toEqual(expect.arrayContaining(['leave-the-village', 'move-the-boulder', 'train', 'read-the-notice', 'eat-bread']));
        expect(kept).not.toContain('guards-locker');
        expect(kept).not.toContain('bribe-the-guard');
    });
});
