/**
 * actionNodes/actionPlanner — **THE BOT'S PLAN FOR ONE LOOP**, with its reasoning as lines (A13: "an option to log
 * its reasoning"). A pure module over the node data: the same one-loop enumeration as the logic
 * (`actionSearch.js`), but with the LIVE items and the live region-XP prices.
 *
 * The aim of a loop (⚖ A17):
 *   1. **The goal, as soon as it is reachable** — the plan with the fewest performances.
 *   2. **Otherwise the most new checks.** Ties: most mana left, then fewest performances.
 *   3. **Otherwise the most region XP, spent where it brings the next check closer.** The bot takes the unchecked
 *      check whose plan is short of mana by the least, runs that plan as far as it goes, and ends by ATTEMPTING the
 *      node it cannot afford (⚖ Q1: the attempt drains what is left as region XP and ends the loop). When every
 *      remaining check is short of an item rather than of mana, it spends the pool where the most can be spent and
 *      says it is waiting for an item.
 *
 * Each decision is a line naming what was chosen, what the alternatives scored, and why each unchosen check was not
 * taken ("Move the Boulder: short by 5 mana after Guard's Locker").
 *
 * The planner never sees where items are placed: it plans with what it holds. A caller that receives an item
 * mid-loop applies it (`actionModel.js` `applyBoost`) and plans again from that state (`opts.start`).
 *
 * Pure: no registry, no DOM, no I/O.
 */

import { applyRegionXpCostEffect, levelFromXP } from '../shared/procgen/xpFormulas.js';
import { resolvedSettingsOf } from './actionGraph.js';
import {
    applyBoost, describePlan, formatMana, loopStartState, perform, poolAmountOf, poolWordOf, priceOf, waitNote, waitOf, whyNot,
} from './actionModel.js';
import { DEFAULT_STATE_BUDGET, enumerateLoop, planTo } from './actionSearch.js';

/** The kinds of plan `planLoop` returns. */
export const PLAN_KINDS = Object.freeze({ GOAL: 'goal', CHECKS: 'checks', LEARN: 'learn', XP: 'xp', WAIT: 'wait', DONE: 'done' });

/** What one performance of node `i` takes from the pool at `s`: its price plus any wait for its window. */
const costAt = (model, s, i, costs) => priceOf(model, i, costs) + waitOf(model, s, i);

/**
 * The waits along `plan` from `state`, as a reasoning-line suffix ("; Watch the Ferry waits 2 (opens 12:00)"), or ''
 * when nothing waits — so a windowless graph's lines are exactly what they were.
 */
function waitsAlong(model, state, plan, costs) {
    if (!model.windowed) return '';
    const notes = [];
    let s = state;
    for (const i of plan) {
        const note = waitNote(model, s, i);
        if (note) notes.push(`${model.nodes[i].name} ${note}`);
        s = perform(model, s, i, { costs });
    }
    return notes.length ? `; ${notes.join('; ')}` : '';
}

/** Live prices: each node's time after its region-XP discount (`xpFormulas.js`, the formula every Loops cost uses). */
export function livePrices(model, xp = {}) {
    const { xpEffect } = resolvedSettingsOf(model.graph);
    return model.nodes.map((n) => applyRegionXpCostEffect(n.time, levelFromXP(xp[n.id] ?? 0), xpEffect));
}

/**
 * How far short of mana `plan` is when run from `state` (0 = affordable). Walked with mana allowed to go negative.
 */
export function manaShortfall(model, state, plan, costs) {
    let s = state;
    let worst = 0;
    for (const i of plan) {
        worst = Math.max(worst, costAt(model, s, i, costs) - s.mana);
        s = perform(model, s, i, { costs });
    }
    return worst;
}

/**
 * The same performances as `plan`, reordered so the mana goes furthest: at each step, among the next performances
 * that are legal (mana aside), take an affordable one with the best net mana (an Eat Bread before the Train it pays
 * for); only when none is affordable, the cheapest. The last step stays last. The enumeration keeps ONE path per
 * state (its count vector), so this is where the order that a short loop needs is chosen.
 */
export function orderForMana(model, state, plan, costs) {
    if (plan.length < 2) return plan;
    const last = plan[plan.length - 1];
    const left = plan.slice(0, -1);
    const out = [];
    let s = state;
    while (left.length) {
        const legal = left.map((i, k) => ({ i, k })).filter(({ i }) => !whyNot(model, s, i, { costs, ignoreMana: true }));
        if (!legal.length) return plan;
        const net = ({ i }) => model.nodes[i].addMana - costAt(model, s, i, costs);
        const affordable = legal.filter(({ i }) => s.mana > 1e-9 && s.mana + 1e-9 >= costAt(model, s, i, costs));
        const pick = (affordable.length ? affordable : legal).reduce((a, b) => (affordable.length
            ? (net(b) > net(a) ? b : a)
            : (costAt(model, s, b.i, costs) < costAt(model, s, a.i, costs) ? b : a)));
        out.push(pick.i);
        left.splice(pick.k, 1);
        s = perform(model, s, pick.i, { costs });
    }
    // ⛓ AN-TIME-1: the target is checked too. A reorder ends at the same counts, so without windows the target is
    // exactly as legal as in `plan`; with an `until` window a reorder can bring it too late — keep `plan` then.
    if (whyNot(model, s, last, { costs, ignoreMana: true })) return plan;
    return [...out, last];
}

/** How many steps of `plan` complete from `state` before one cannot be paid for. */
export function affordablePrefix(model, state, plan, costs) {
    let s = state;
    let n = 0;
    for (const i of plan) {
        if (s.mana <= 1e-9 || s.mana + 1e-9 < costAt(model, s, i, costs)) break;
        s = perform(model, s, i, { costs });
        n += 1;
    }
    return n;
}

/**
 * The nodes that can matter to performing `target` from `state` — the **relevance cone** the ignore-mana searches walk
 * instead of the whole graph (slice AN-OMSI-1: on a town-sized graph the whole-graph walk passed the state budget,
 * 911,712 states against 200,000, because every unrelated repeatable node multiplies the count vectors).
 *
 * A node is relevant when it is the target, or, for a relevant node N:
 *   - a member of any of N's `after` sets (a way in);
 *   - a producer of a stat N requires that `state` does not already meet (stats only go up, so a met stat minimum
 *     stays met and its producers cannot help);
 *   - a producer of a resource N requires or spends (resources go down, so no "already met" shortcut);
 * and, whatever the target, every node whose mana result is at least its price (it never raises a shortfall, and it
 * can lower one or lengthen how far a plan runs).
 *   - (AN-TIME-1) every node that teaches a knowledge flag N requires and `state` does not already know.
 *
 * Windows (AN-TIME-1). A dropped node only makes every later step start EARLIER; an `until` stays met, and a node
 * that is now early waits (⚖ Q2), which ends at the same `from` and costs the time the dropped node did. So the
 * argument below holds unchanged — measured: 0 of 14,744 cases differ (design §2 row 4).
 *
 * What does not change, and why. Drop every performance of an irrelevant node from a plan that performs the target:
 * what remains is still legal (no relevant node's way in, stat or resource came from a dropped node; a dropped node
 * that spent a resource only leaves more), and each dropped node cost more mana than it gave, so every later step is
 * short by no more. So:
 *   - **the least shortfall is the same** over the cone as over the whole graph, always;
 *   - **when it is above 0, the whole answer is the same** (plan, shortfall, how far it runs): a dropped node that
 *     costs mana raises the last step's shortfall, or runs after the first step that cannot be paid, so no plan with
 *     one beats the plan without it; and the cone's states come in the whole walk's breadth-first order, so a tie
 *     falls the same way;
 *   - **when it is 0** (the target is affordable outright), the whole-graph walk's "runs furthest" tie-break prefers
 *     plans padded with any affordable node; the cone returns the unpadded plan. No caller reads that plan: an
 *     affordable target is earned by the main search, and the reasoning lines read only the shortfall there.
 *
 * @returns {boolean[]} by node index
 */
export function relevantNodes(model, state, target, costs) {
    const n = model.nodes.length;
    const statProducers = model.statIds.map(() => []);
    const resProducers = model.resourceIds.map(() => []);
    model.nodes.forEach((node, i) => {
        for (const [s, k] of node.addStats) if (k > 0) statProducers[s].push(i);
        for (const [r, k] of node.addRes) if (k > 0) resProducers[r].push(i);
    });
    const keep = new Array(n).fill(false);
    const queue = [];
    const add = (i) => { if (!keep[i]) { keep[i] = true; queue.push(i); } };
    add(target);
    model.nodes.forEach((node, i) => { if (i !== model.startIndex && node.addMana >= priceOf(model, i, costs)) add(i); });
    while (queue.length) {
        const node = model.nodes[queue.shift()];
        for (const set of node.after) for (const m of set) add(m);
        for (const [s, k] of node.reqStats) if (state.stats[s] < k) statProducers[s].forEach(add);
        for (const [r] of node.reqRes) resProducers[r].forEach(add);
        for (const [r, k] of node.addRes) if (k < 0) resProducers[r].forEach(add);
        for (const k of node.reqKnow ?? []) if (!state.known?.[k]) model.knowledge[k].learners.forEach(add);
    }
    return keep;
}

/**
 * The plan to perform `target` from `state` that is short of mana by the least, ignoring mana. Null: never.
 * `cone: false` walks the whole graph instead of the relevance cone: the pre-AN-OMSI-1 search, kept only so a test can
 * hold the two to the same answer.
 * @returns {null | {plan: number[], short: number, runs: number}}
 */
export function leastShortPlan(model, state, target, costs, budget = DEFAULT_STATE_BUDGET, { cone = true } = {}) {
    const allowed = cone ? relevantNodes(model, state, target, costs) : undefined;
    const { entries } = enumerateLoop(model, { start: state, costs, ignoreMana: true, budget, allowed });
    // Least short first; then the plan that runs furthest before it runs out (so the mana is spent on the way to
    // the target, not stranded before an Eat Bread that would have covered it); then the shortest.
    let best = null;
    entries.forEach(({ via }, k) => {
        if (via !== target) return;
        const plan = orderForMana(model, state, planTo(entries, k), costs);
        const short = manaShortfall(model, state, plan, costs);
        const runs = affordablePrefix(model, state, plan, costs);
        const better = !best || short < best.short - 1e-9
            || (Math.abs(short - best.short) < 1e-9 && (runs > best.runs || (runs === best.runs && plan.length < best.plan.length)));
        if (better) best = { plan, short, runs };
    });
    return best;
}

/**
 * Plan one loop (or the rest of one, from `opts.start`).
 *
 * @param {object} model - `buildActionModel(graph)`
 * @param {object} [opts]
 * @param {object} [opts.items]        `{boonId: count}` held
 * @param {Iterable<string>} [opts.checked]  node ids whose location is already checked
 * @param {object} [opts.xp]           `{nodeId: xp}` region XP so far
 * @param {object} [opts.start]        the state to plan from (default: a fresh loop with `items`)
 * @param {number} [opts.budget]
 * @returns {{kind: string, plan: string[], attempt: string|null, earns: string[], manaLeft: number, lines: string[]}}
 *   `plan` is node ids to perform in order; `attempt` a node to start without the mana to finish (drained as XP).
 */
export function planLoop(model, { items = {}, checked = [], xp = {}, start, budget = DEFAULT_STATE_BUDGET } = {}) {
    const done = new Set(checked);
    const costs = livePrices(model, xp);
    const first = start ?? loopStartState(model, items);
    const { entries } = enumerateLoop(model, { start: first, costs, budget });
    const lines = [];
    const ids = (plan) => plan.map((i) => model.nodes[i].id);
    const name = (i) => model.nodes[i].name;
    const goal = model.goalIndex;
    const openChecks = model.checkIndices.filter((i) => !done.has(model.nodes[i].id));

    if (done.has(model.nodes[goal].id)) {
        return { kind: PLAN_KINDS.DONE, plan: [], attempt: null, earns: [], manaLeft: first.mana, lines: ['The goal is done.'] };
    }

    // 1. The goal, as soon as reachable.
    const goalAt = entries.findIndex((e) => e.via === goal);
    if (goalAt >= 0) {
        const plan = planTo(entries, goalAt);
        const left = entries[goalAt].state.mana;
        lines.push(`Goal reachable: ${name(goal)} via ${describePlan(model, plan)} (${plan.length} performance${plan.length === 1 ? '' : 's'}, ${poolAmountOf(model, left)} left)${waitsAlong(model, first, plan, costs)}.`);
        return { kind: PLAN_KINDS.GOAL, plan: ids(plan), attempt: null, earns: [name(goal)], manaLeft: left, lines };
    }

    // 2. The most new checks; ties: most mana left, then fewest performances (BFS order).
    let best = null;
    entries.forEach(({ state }, k) => {
        const earned = openChecks.filter((i) => state.counts[i] >= 1);
        if (!earned.length) return;
        if (!best || earned.length > best.earned.length
            || (earned.length === best.earned.length && state.mana > best.state.mana + 1e-9)) {
            best = { k, earned, state };
        }
    });
    const alone = new Map();
    for (const c of openChecks) {
        const k = entries.findIndex((e) => e.via === c);
        if (k >= 0) alone.set(c, { plan: planTo(entries, k), left: entries[k].state.mana });
    }
    if (best) {
        const plan = planTo(entries, best.k);
        const earnedNames = best.earned.map(name);
        lines.push(`Chose: ${describePlan(model, plan)}, earning ${earnedNames.join(', ')} (${poolAmountOf(model, best.state.mana)} left)${waitsAlong(model, first, plan, costs)}.`);
        for (const c of openChecks) {
            if (best.earned.includes(c)) continue;
            const a = alone.get(c);
            if (a) {
                const after = leastShortPlan(model, best.state, c, costs, budget);
                const why = after && after.short > 0 ? `short by ${poolAmountOf(model, after.short)} after ${earnedNames.join(', ')}`
                    : `not together with ${earnedNames.join(', ')}`;
                lines.push(`  ${name(c)}: ${why} (alone: ${describePlan(model, a.plan)}, ${poolAmountOf(model, a.left)} left).`);
            } else {
                lines.push(`  ${name(c)}: ${notThisLoop(model, first, c, costs, budget)}.`);
            }
        }
        return { kind: PLAN_KINDS.CHECKS, plan: ids(plan), attempt: null, earns: earnedNames, manaLeft: best.state.mana, lines };
    }

    // 2b. (AN-TIME-1) No check this loop, but knowledge some target needs can be learned: learn the most of it (ties:
    // most mana left, then fewest performances). It is kept across loops, so this loop is not wasted.
    const needed = neededKnowledge(model, first, done);
    if (needed.length) {
        let learn = null;
        entries.forEach(({ state }, k) => {
            const got = needed.filter((f) => state.known?.[f]);
            if (!got.length) return;
            if (!learn || got.length > learn.got.length
                || (got.length === learn.got.length && state.mana > learn.state.mana + 1e-9)) learn = { k, got, state };
        });
        if (learn) {
            const plan = planTo(entries, learn.k);
            const names = learn.got.map((f) => model.knowledge[f].name);
            lines.push(`No check can be earned this loop. Learning ${names.join(', ')}: ${describePlan(model, plan)} (${poolAmountOf(model, learn.state.mana)} left)${waitsAlong(model, first, plan, costs)}.`);
            for (const t of [...openChecks, goal]) lines.push(`  ${name(t)}: ${notThisLoop(model, first, t, costs, budget)}.`);
            return { kind: PLAN_KINDS.LEARN, plan: ids(plan), attempt: null, earns: [], learns: names, manaLeft: learn.state.mana, lines };
        }
    }

    // 3. No check this loop: the target short of mana by the least.
    const targets = [...openChecks, goal];
    let closest = null;
    for (const t of targets) {
        const s = leastShortPlan(model, first, t, costs, budget);
        if (s && (!closest || s.short < closest.short - 1e-9)) closest = { t, ...s };
    }
    if (closest) {
        // Run the plan as far as it goes, then attempt the node it cannot afford.
        let state = first;
        const plan = [];
        let attempt = null;
        for (const i of closest.plan) {
            const refusal = whyNot(model, state, i, { costs });
            if (!refusal) {
                plan.push(i);
                state = perform(model, state, i, { costs });
                continue;
            }
            if (refusal.code === 'mana' && state.mana > 0) attempt = i;
            break;
        }
        lines.push(`No check can be earned this loop. Closest: ${name(closest.t)}, short by ${poolAmountOf(model, closest.short)} `
            + `(${describePlan(model, closest.plan)}).`);
        lines.push(`Spending it for region XP: ${describePlan(model, plan)}${attempt !== null ? `, then attempting ${name(attempt)} with ${poolAmountOf(model, state.mana)}` : ''}.`);
        for (const t of targets) if (t !== closest.t) lines.push(`  ${name(t)}: ${notThisLoop(model, first, t, costs, budget)}.`);
        return {
            kind: PLAN_KINDS.XP, plan: ids(plan), attempt: attempt === null ? null : model.nodes[attempt].id,
            earns: [], manaLeft: attempt === null ? state.mana : 0, lines,
        };
    }

    // Every remaining target needs an item: spend where the most can be spent.
    let most = 0;
    entries.forEach(({ state }, k) => { if (state.spent > entries[most].state.spent + 1e-9) most = k; });
    const plan = planTo(entries, most);
    lines.push(`Waiting for an item: no remaining check can be earned with what is held, whatever the ${poolWordOf(model)}.`);
    lines.push(`Spending ${poolAmountOf(model, entries[most].state.spent)} for region XP: ${describePlan(model, plan)}.`);
    for (const t of targets) lines.push(`  ${name(t)}: ${notThisLoop(model, first, t, costs, budget)}.`);
    return { kind: PLAN_KINDS.WAIT, plan: ids(plan), attempt: null, earns: [], manaLeft: entries[most].state.mana, lines };
}

/**
 * The knowledge flags not known at `start` that some node still worth performing requires: the requirement of an
 * unchecked check or the goal, or of any node on a way to one (every node requiring a flag counts — a cheap,
 * conservative reading; a flag nothing open needs is never chosen).
 */
function neededKnowledge(model, start, done) {
    if (!model.knowledge?.length) return [];
    const out = new Set();
    model.nodes.forEach((node, i) => {
        if ((node.kind === 'check' || node.kind === 'goal') && done.has(node.id)) return;
        for (const k of node.reqKnow ?? []) if (!start.known?.[k]) out.add(k);
    });
    return [...out].sort((a, b) => a - b);
}

/** Why target `t` cannot be earned this loop: short of mana by how much, or what requirement no plan meets. */
function notThisLoop(model, start, t, costs, budget) {
    const s = leastShortPlan(model, start, t, costs, budget);
    if (s) return `short by ${poolAmountOf(model, s.short)} (${describePlan(model, s.plan)})`;
    // Not even with unlimited mana: name the first requirement the node itself fails at its best state.
    const allowed = relevantNodes(model, start, t, costs);
    const { entries } = enumerateLoop(model, { start, costs, ignoreMana: true, budget, allowed });
    const reached = entries.filter(({ state }) => whyNot(model, state, t, { costs, ignoreMana: true })?.code !== 'not-reached');
    if (!reached.length) return 'not reached this loop with what is held';
    const refusal = whyNot(model, reached[reached.length - 1].state, t, { costs, ignoreMana: true });
    if (refusal?.code === 'knowledge' || refusal?.code === 'too-late') return refusal.text;
    return refusal ? `${refusal.text}, needs an item` : 'needs an item';
}

/**
 * Play a compiled world to its goal with the planner: the headless bot (A13, "as early as possible"). Items come from
 * `placements` (check node id → boon id), the simulated fill; an item arrives the moment its check is performed and
 * takes effect at once (A4), so the bot plans the rest of the loop again from there. Region XP accrues at
 * `xpGainScale` per mana spent in a node, an attempt drains what is left into its node, and XP lowers later prices.
 *
 * @returns {{reachedGoal: boolean, loops: Array<{loop: number, kind: string, performed: string[], attempt: string|null,
 *   checks: string[], received: string[], lines: string[]}>, xp: object}}
 */
export function playToGoal(model, { placements = {}, xpGainScale, maxLoops = 100, budget } = {}) {
    const scale = xpGainScale ?? resolvedSettingsOf(model.graph).xpGainScale;
    // Boons by id, then knowledge flags by id (`itemVectorOf` reads both): a flag learned in a loop is held from the next.
    const items = Object.fromEntries([...model.boons.map((b) => [b.id, 0]), ...(model.knowledge ?? []).map((f) => [f.id, 0])]);
    const checked = new Set();
    const xp = {};
    const loops = [];
    const boonIx = new Map(model.boons.map((b, i) => [b.id, i]));
    for (let loop = 1; loop <= maxLoops; loop += 1) {
        const row = { loop, kind: null, performed: [], attempt: null, checks: [], received: [], lines: [] };
        loops.push(row);
        let state = loopStartState(model, items);
        for (let pass = 0; ; pass += 1) {
            const p = planLoop(model, { items, checked, xp, start: state, budget });
            row.kind ??= p.kind;
            row.lines.push(...(pass ? p.lines.map((l) => `(replan) ${l}`) : p.lines));
            if (p.kind === PLAN_KINDS.DONE) break;
            const costs = livePrices(model, xp);
            let gotItem = false;
            for (const id of p.plan) {
                const i = model.nodeIx.get(id);
                const refusal = whyNot(model, state, i, { costs });
                if (refusal) { row.lines.push(`  ✗ ${model.nodes[i].name}: ${refusal.text} (plan abandoned)`); break; }
                const price = priceOf(model, i, costs);
                state = perform(model, state, i, { costs });
                xp[id] = (xp[id] ?? 0) + price * scale;
                row.performed.push(id);
                const node = model.nodes[i];
                if ((node.kind === 'check' || node.kind === 'goal') && !checked.has(id)) {
                    checked.add(id);
                    row.checks.push(node.name);
                    const boonId = placements[id];
                    if (boonId !== undefined && boonIx.has(boonId)) {
                        items[boonId] += 1;
                        state = applyBoost(model, state, boonIx.get(boonId));
                        row.received.push(model.boons[boonIx.get(boonId)].name);
                        gotItem = true;
                        break;
                    }
                }
            }
            if (checked.has(model.nodes[model.goalIndex].id)) break;
            if (gotItem) continue;
            if (p.attempt) {
                xp[p.attempt] = (xp[p.attempt] ?? 0) + Math.max(0, state.mana) * scale;
                row.attempt = p.attempt;
            }
            break;
        }
        (model.knowledge ?? []).forEach((f, k) => { if (state.known?.[k]) items[f.id] = 1; });
        if (checked.has(model.nodes[model.goalIndex].id)) return { reachedGoal: true, loops, xp };
    }
    return { reachedGoal: false, loops, xp };
}
