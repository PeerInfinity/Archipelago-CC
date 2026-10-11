/**
 * The world's ONE goal item (⚖ the user, 2026-10-11: "should procgen move to one goal item, Victory, in both spiral
 * and sphere growth?" — "Yes, if possible").
 *
 * Before this, a procgen world had two different victory items: the scenario's `victory` (the maze library's id) and
 * the substrates' `Victory` (jta, noiz2sa, omsi, bounce, runner). They are different AP items, so a world that held
 * one while completion named the other could not be beaten. Now the shuffled spiral and sphere growth always place
 * `Victory`. The scenario's `victory` stays the switch that says "this world has a goal". Grid growth and top-down
 * are unchanged.
 *
 * Pure: no registry, no engine.
 */

/** The goal item's AP name in a spiral or sphere-growth world. */
export const GOAL_ITEM = 'Victory';

/**
 * The goal's item-library row, drawn as the maze library's victory star. A world whose library already has a
 * `Victory` row keeps it (bounce's and runner's are the same star), so this row only fills a gap.
 */
export const GOAL_ITEM_DEF = Object.freeze({
    name: GOAL_ITEM,
    id: GOAL_ITEM,
    classification: 'progression',
    color: '#f5d020',
    symbol: 'star',
    feature: 'victory',
    is_victory: true,
});

/** Is `id` a victory item: the goal itself, or any row its library flags `is_victory`? */
export function isVictoryItem(id, itemLib = {}) {
    return id === GOAL_ITEM || itemLib?.[id]?.is_victory === true;
}

/** `itemLib` with the goal's row (an existing `Victory` row is kept as it is). */
export function withGoalItemDef(itemLib = {}) {
    return Object.hasOwn(itemLib, GOAL_ITEM) ? itemLib : { ...itemLib, [GOAL_ITEM]: GOAL_ITEM_DEF };
}

/**
 * The item pool a goal-owning driver plans from: every victory item of `itemPool` taken out, and ONE `Victory` put
 * back when the world has a goal. Key order is kept for the regular items, and `Victory` goes where the first victory
 * item was (or last, for a goal no pool entry named), so a world keeps its iteration order.
 *
 * @param {object} itemPool - id → count
 * @param {object} itemLib - the world's item library (to recognise the scenario's `victory`)
 * @param {boolean} hasGoal - whether the world has a goal (the scenario asked for one, or an in-quota substrate declares one)
 * @returns {object} the new pool
 */
export function goalItemPool(itemPool = {}, itemLib = {}, hasGoal = false) {
    const out = {};
    let placed = false;
    for (const [id, count] of Object.entries(itemPool)) {
        if (isVictoryItem(id, itemLib)) {
            if (hasGoal && !placed && Number(count) > 0) { out[GOAL_ITEM] = 1; placed = true; }
            continue;
        }
        out[id] = count;
    }
    if (hasGoal && !placed) out[GOAL_ITEM] = 1;
    return out;
}

/**
 * The goal invariant: a world whose completion condition names an item must hold that item at a location (or start
 * with it). Returns null when it holds, else a sentence naming the item. Reads only the compiled rules.json.
 *
 * @param {object} rulesJson
 * @param {string|number} [playerId='1']
 */
export function unplacedGoalSentence(rulesJson, playerId = '1') {
    const p = String(playerId);
    const cond = rulesJson?.game_info?.[p]?.completion_condition;
    if (cond?.type !== 'item_check' || typeof cond.item !== 'string') return null;
    const item = cond.item;
    for (const region of Object.values(rulesJson?.regions?.[p] ?? {})) {
        for (const loc of region?.locations ?? []) {
            const held = typeof loc?.item === 'string' ? loc.item : loc?.item?.name;
            if (held === item) return null;
        }
    }
    const starting = rulesJson?.starting_items?.[p] ?? [];
    if (Array.isArray(starting) && starting.some((s) => (typeof s === 'string' ? s : s?.name) === item)) return null;
    return `the completion condition names '${item}', but no location of this world holds it — the world could `
        + 'never be beaten';
}
