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
import { applyBoost, describePlan, formatMana, loopStartState, perform, priceOf, whyNot } from './actionModel.js';
import { DEFAULT_STATE_BUDGET, enumerateLoop, planTo } from './actionSearch.js';

/** The kinds of plan `planLoop` returns. */
export const PLAN_KINDS = Object.freeze({ GOAL: 'goal', CHECKS: 'checks', XP: 'xp', WAIT: 'wait', DONE: 'done' });

/** Live prices: each node's time after its region-XP discount (`xpFormulas.js`, the formula every Loops cost uses). */
export function livePrices(model, xp = {}) {
    const { xpEffect } = resolvedSettingsOf(model.graph);
    return model.nodes.map((n) => applyRegionXpCostEffect(n.time, levelFromXP(xp[n.id] ?? 0), xpEffect));
}

/**
 * How far short of mana `plan` is when run from `state` (0 = affordable). Walked with mana allowed to go negative.
 */
export function manaShortfall(model, state, plan, costs) {
    let m = state.mana;
    let worst = 0;
    for (const i of plan) {
        const price = priceOf(model, i, costs);
        worst = Math.max(worst, price - m);
        m = m - price + model.nodes[i].addMana;
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
        const net = ({ i }) => model.nodes[i].addMana - priceOf(model, i, costs);
        const affordable = legal.filter(({ i }) => s.mana > 1e-9 && s.mana + 1e-9 >= priceOf(model, i, costs));
        const pick = (affordable.length ? affordable : legal).reduce((a, b) => (affordable.length
            ? (net(b) > net(a) ? b : a)
            : (priceOf(model, b.i, costs) < priceOf(model, a.i, costs) ? b : a)));
        out.push(pick.i);
        left.splice(pick.k, 1);
        s = perform(model, s, pick.i, { costs });
    }
    return [...out, last];
}

/** How many steps of `plan` complete from `state` before one cannot be paid for. */
export function affordablePrefix(model, state, plan, costs) {
    let m = state.mana;
    let n = 0;
    for (const i of plan) {
        const price = priceOf(model, i, costs);
        if (m <= 1e-9 || m + 1e-9 < price) break;
        m = m - price + model.nodes[i].addMana;
        n += 1;
    }
    return n;
}

/** The plan to perform `target` from `state` that is short of mana by the least, ignoring mana. Null: never. */
function leastShortPlan(model, state, target, costs, budget) {
    const { entries } = enumerateLoop(model, { start: state, costs, ignoreMana: true, budget });
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
        lines.push(`Goal reachable: ${name(goal)} via ${describePlan(model, plan)} (${plan.length} performance${plan.length === 1 ? '' : 's'}, ${formatMana(left)} mana left).`);
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
        lines.push(`Chose: ${describePlan(model, plan)}, earning ${earnedNames.join(', ')} (${formatMana(best.state.mana)} mana left).`);
        for (const c of openChecks) {
            if (best.earned.includes(c)) continue;
            const a = alone.get(c);
            if (a) {
                const after = leastShortPlan(model, best.state, c, costs, budget);
                const why = after && after.short > 0 ? `short by ${formatMana(after.short)} mana after ${earnedNames.join(', ')}`
                    : `not together with ${earnedNames.join(', ')}`;
                lines.push(`  ${name(c)}: ${why} (alone: ${describePlan(model, a.plan)}, ${formatMana(a.left)} mana left).`);
            } else {
                lines.push(`  ${name(c)}: ${notThisLoop(model, first, c, costs, budget)}.`);
            }
        }
        return { kind: PLAN_KINDS.CHECKS, plan: ids(plan), attempt: null, earns: earnedNames, manaLeft: best.state.mana, lines };
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
        lines.push(`No check can be earned this loop. Closest: ${name(closest.t)}, short by ${formatMana(closest.short)} mana `
            + `(${describePlan(model, closest.plan)}).`);
        lines.push(`Spending it for region XP: ${describePlan(model, plan)}${attempt !== null ? `, then attempting ${name(attempt)} with ${formatMana(state.mana)} mana` : ''}.`);
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
    lines.push(`Waiting for an item: no remaining check can be earned with what is held, whatever the mana.`);
    lines.push(`Spending ${formatMana(entries[most].state.spent)} mana for region XP: ${describePlan(model, plan)}.`);
    for (const t of targets) lines.push(`  ${name(t)}: ${notThisLoop(model, first, t, costs, budget)}.`);
    return { kind: PLAN_KINDS.WAIT, plan: ids(plan), attempt: null, earns: [], manaLeft: entries[most].state.mana, lines };
}

/** Why target `t` cannot be earned this loop: short of mana by how much, or what requirement no plan meets. */
function notThisLoop(model, start, t, costs, budget) {
    const s = leastShortPlan(model, start, t, costs, budget);
    if (s) return `short by ${formatMana(s.short)} mana (${describePlan(model, s.plan)})`;
    // Not even with unlimited mana: name the first requirement the node itself fails at its best state.
    const { entries } = enumerateLoop(model, { start, costs, ignoreMana: true, budget });
    const reached = entries.filter(({ state }) => whyNot(model, state, t, { costs, ignoreMana: true })?.code !== 'not-reached');
    if (!reached.length) return 'not reached this loop with what is held';
    const refusal = whyNot(model, reached[reached.length - 1].state, t, { costs, ignoreMana: true });
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
    const items = Object.fromEntries(model.boons.map((b) => [b.id, 0]));
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
        if (checked.has(model.nodes[model.goalIndex].id)) return { reachedGoal: true, loops, xp };
    }
    return { reachedGoal: false, loops, xp };
}
