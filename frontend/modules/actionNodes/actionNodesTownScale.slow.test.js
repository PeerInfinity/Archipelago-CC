// actionNodes at TOWN SIZE (slice AN-OMSI-1): the planner's relevance cone and the compiler's fill retry, pinned on
// the omsi first-town test fixture (`fixtures/omsi-first-town.json`: 20 nodes, 18 checks, 18 items). Slow tier: one
// logic derivation (~4 s) and two headless plays to the goal are synchronous, CPU-bound work.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildActionModel, loopStartState } from './actionModel.js';
import { ACTION_SEARCH_REFUSALS, DEFAULT_STATE_BUDGET, deriveActionLogic, enumerateLoop } from './actionSearch.js';
import { leastShortPlan, playToGoal, relevantNodes } from './actionPlanner.js';
import {
    ACTION_COMPILE_REFUSALS, DEFAULT_FILL_ATTEMPTS, assumedFill, compileActionGraph, fillAttemptSeeds, fillWithRetries,
    itemPoolOf, progressionOf,
} from './actionGraphCompiler.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOWN = JSON.parse(readFileSync(join(HERE, 'fixtures/omsi-first-town.json'), 'utf8'));
const town = buildActionModel(TOWN);
const ALL_ITEMS = Object.fromEntries(town.boons.map((b) => [b.id, b.count]));
const targetsOf = (model) => [...model.checkIndices, model.goalIndex];

// The logic is derived once for the file: every fill below reuses it.
const logic = deriveActionLogic(town);
const pool = itemPoolOf(town, TOWN);
const progression = progressionOf(logic);
const SEEDS = Array.from({ length: 20 }, (_, k) => k + 1);
const fillOrNull = (seed, attempts) => {
    try { return fillWithRetries(town, logic, pool, progression, seed, attempts); } catch (e) {
        if (e.code === ACTION_COMPILE_REFUSALS.FILL_FAILED) return null;
        throw e;
    }
};
/** check node id → boon id, the shape `playToGoal` reads. */
const placementsOf = (placement) => Object.fromEntries([...placement].map(([c, b]) => [town.nodes[c].id, town.boons[b].id]));

describe('⛓ the planner\'s ignore-mana search walks the relevance cone (AN-OMSI-1)', () => {
    it('⛔ why: the whole-graph walk passes the state budget on the town (911,712 states measured, all items held)', () => {
        const start = loopStartState(town, ALL_ITEMS);
        expect(() => enumerateLoop(town, { start, ignoreMana: true })).toThrow(ACTION_SEARCH_REFUSALS.STATE_BUDGET);
    });
    it('MUTATION: the old search order (cone off) is refused on the town', () => {
        const start = loopStartState(town, ALL_ITEMS);
        expect(() => leastShortPlan(town, start, town.goalIndex, undefined, DEFAULT_STATE_BUDGET, { cone: false }))
            .toThrow(ACTION_SEARCH_REFUSALS.STATE_BUDGET);
    });
    it('every target\'s cone walk stays under a quarter of the budget, held items or none (largest measured: 19,164)', () => {
        for (const items of [{}, ALL_ITEMS]) {
            const start = loopStartState(town, items);
            for (const t of targetsOf(town)) {
                const allowed = relevantNodes(town, start, t);
                const { entries } = enumerateLoop(town, { start, ignoreMana: true, allowed });
                expect(entries.length, town.nodes[t].id).toBeLessThan(DEFAULT_STATE_BUDGET / 4);
            }
        }
    });
    it('the cone answers as the whole graph does, where the whole graph fits under the budget', () => {
        // Item sets whose whole-graph walk fits (measured: 40, 10,672 and 170,944 states). The largest is the slow one
        // (seconds a walk), so it is held for the goal only, where the cone is widest.
        const ids = (...xs) => Object.fromEntries(xs.map((x) => [x, 1]));
        const cases = [
            [{}, targetsOf(town)],
            [ids('wander-progress', 'met-progress', 'secrets-progress'), targetsOf(town)],
            [ids('wander-progress', 'met-progress', 'secrets-progress', 'combat-training', 'magic-training'),
                [town.goalIndex]],
        ];
        for (const [items, targets] of cases) {
            const start = loopStartState(town, items);
            for (const t of targets) {
                const label = `${town.nodes[t].id} with ${JSON.stringify(items)}`;
                const a = leastShortPlan(town, start, t);
                const b = leastShortPlan(town, start, t, undefined, DEFAULT_STATE_BUDGET, { cone: false });
                expect(a?.short, label).toBe(b?.short);
                if (b && b.short > 0) expect(a, label).toEqual(b);
            }
        }
    });
    it('the bot plays the town to the goal at the DEFAULT budget: 7 loops at XP scale 1, 8 at 0 (seed 3\'s fill)', () => {
        const fill = fillWithRetries(town, logic, pool, progression, 3);
        expect(fill.attempt).toBe(1);
        const placements = placementsOf(fill.placement);
        const loops = [1, 0].map((xpGainScale) => {
            const run = playToGoal(town, { placements, xpGainScale });
            expect(run.reachedGoal, `xpGainScale ${xpGainScale}`).toBe(true);
            return run.loops.length;
        });
        expect(loops).toEqual([7, 8]);
    });
});

describe('⛓ the fill retry (AN-OMSI-1)', () => {
    it('attempt 1 IS the old fill: wherever attempt 1 fills, the placement is assumedFill(seed) exactly', () => {
        for (const seed of SEEDS) {
            const fill = fillOrNull(seed);
            if (fill?.attempt !== 1) continue;
            expect(fill.seed).toBe(seed);
            expect([...fill.placement]).toEqual([...assumedFill(town, logic, pool, progression, seed)]);
        }
    });
    it('seeds 1–20 on the town: every one fills with the default attempts; attempt 1 alone fills 6 (measured)', () => {
        const fills = SEEDS.map((s) => fillOrNull(s));
        expect(fills.filter(Boolean).length).toBe(SEEDS.length);
        expect(Math.max(...fills.map((f) => f.attempt))).toBeLessThanOrEqual(DEFAULT_FILL_ATTEMPTS);
        expect(fills.filter((f) => f.attempt === 1).length).toBe(6);
    });
    it('MUTATION: no retry (one attempt) fills only 6 of the 20 seeds — the floor above would fail', () => {
        expect(SEEDS.filter((s) => fillOrNull(s, 1)).length).toBe(6);
    });
    it('deterministic: the same seed gives the same attempt and the same placement', () => {
        for (const seed of [1, 14]) {
            const a = fillOrNull(seed);
            const b = fillOrNull(seed);
            expect([a.attempt, a.seed, [...a.placement]]).toEqual([b.attempt, b.seed, [...b.placement]]);
        }
    });
    it('a compiled world that needed a retry records which attempt and which seed filled it (the town, seed 1: attempt 2)', () => {
        const { report, rules } = compileActionGraph(TOWN, { seed: 1 });
        expect(report.fill).toEqual({ attempt: 2, seed: fillAttemptSeeds(1, 2)[1] });
        expect(rules.procgen_metadata['1'].action_logic.fill).toEqual(report.fill);
    });
    it('refused by name once the attempts are used up, saying how many were made', () => {
        // The town with four repeatable nodes cut to one performance: less mana per loop, every deep check needs more
        // items, and no fill exists from its narrow start (measured: 0 of 40 seeds in 1,000 attempts each).
        const tight = structuredClone(TOWN);
        for (const id of ['smash-pots', 'buy-mana', 'fight-monsters', 'heal-the-sick']) tight.nodes[id].limit = 1;
        const m = buildActionModel(tight);
        const l = deriveActionLogic(m);
        let error = null;
        try { fillWithRetries(m, l, itemPoolOf(m, tight), progressionOf(l), 1, 5); } catch (e) { error = e; }
        expect(error?.code).toBe(ACTION_COMPILE_REFUSALS.FILL_FAILED);
        expect(error.message).toContain('5 fill attempts failed');
    });
});
