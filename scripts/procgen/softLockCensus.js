/**
 * ⛓ THE SOFT-LOCK CENSUS — the rule-aware strand check (rules re-closing locks, 2026-10-05).
 *
 * `strand.py`-style checks read the region graph WITHOUT its rules: a region whose only way back needs an item AP
 * hands out later still counts as returnable. A walking player holds only what the earlier spheres gave, so this
 * census asks, for each sphere's CUMULATIVE inventory (read off AP's own sphere log): which regions can be reached
 * from the start, but have no way back to it with those items?
 *
 * ⛓ RETURN TO MENU (`procgenCore/restartWarp.js`): where the slot declares `exporter[p].return_to_menu`, the
 * Restart always gets the player back, so such a region is RESTART-ONLY — listed as a diagnostic, never a
 * soft-lock. Where the flag is absent, the same regions are real SOFT-LOCKS.
 *
 * AP's own reachability needs no way back, which is why none of this moves a sphere: it is a statement about a
 * player who walks.
 */
import { makeRuleHolds } from './surveyRoute.js';
import { RESTART_WARP, returnToMenu } from '../../frontend/modules/procgenCore/restartWarp.js';

/** The sphere log's rows, each with the inventory held once that sphere is collected (cumulative counts). */
export function sphereInventories(sphereLogRows, playerId = '1') {
    const items = {};
    const out = [];
    for (const row of sphereLogRows) {
        if (row?.type !== 'state_update') continue;
        const got = row.player_data?.[playerId]?.new_inventory_details?.base_items ?? {};
        for (const [name, n] of Object.entries(got)) items[name] = (items[name] ?? 0) + n;
        out.push({ sphere: row.sphere_index, items: { ...items } });
    }
    return out;
}

/**
 * @param {object} rules a `_rules.json`
 * @param {Array<{sphere: string, items: Object<string, number>}>} spheres `sphereInventories`' rows
 * @returns {{returnToMenu: boolean, start: string, kind: 'restart-only'|'soft-lock',
 *            rows: Array<{sphere: string, reachable: number, stuck: string[]}>}}
 */
export function softLockCensus(rules, spheres, { playerId = '1' } = {}) {
    const regions = rules.regions[playerId];
    const menu = RESTART_WARP.target;
    const start = regions[menu]?.exits?.find((e) => e.name === 'GameStart')?.connected_region
        ?? regions[menu]?.exits?.[0]?.connected_region;
    if (!start) throw new Error(`softLockCensus: "${menu}" leads nowhere — there is no start to come back to`);
    const ruleHolds = makeRuleHolds(rules, playerId);
    const open = (e, items) => ruleHolds(e.access_rule ?? null, items);
    const rows = spheres.map(({ sphere, items }) => {
        const seen = new Set([menu]);
        const queue = [menu];
        const back = new Map();
        while (queue.length) {
            const u = queue.shift();
            for (const e of regions[u]?.exits ?? []) {
                if (!open(e, items)) continue;
                const v = e.connected_region;
                if (!back.has(v)) back.set(v, new Set());
                back.get(v).add(u);
                if (!seen.has(v)) { seen.add(v); queue.push(v); }
            }
        }
        const home = new Set([start]);
        const stack = [start];
        while (stack.length) {
            for (const u of back.get(stack.pop()) ?? []) if (!home.has(u)) { home.add(u); stack.push(u); }
        }
        const stuck = [...seen].filter((r) => r !== menu && !home.has(r)).sort();
        return { sphere, reachable: seen.size, stuck };
    });
    const r2m = returnToMenu(rules, playerId);
    return { returnToMenu: r2m, start, kind: r2m ? 'restart-only' : 'soft-lock', rows };
}
