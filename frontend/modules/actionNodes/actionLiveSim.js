/**
 * actionNodes/actionLiveSim — **THE LIVE BOT'S PATH, PLAYED HEADLESS** (design §7, A13; slice AN-3a).
 *
 * What the in-app bot does, without the app: each loop it asks the registry entry's planner (`actionLoopBot.js`
 * `planLiveLoop`, the same call `loopBot.planLoop` makes) for the loop's Loops path, then plays that path entry by entry
 * through the REAL runtime (`ActionNodesRuntime`): every move and every act goes through the start gate (`gate`)
 * exactly as Loops asks it, an act is charged its live, XP-discounted price from the shared pool and earns region XP,
 * the check's item (the document's own placement) arrives as a snapshot the moment the check is sent (A4: at once),
 * an act the pool cannot finish drains it (⚖ Q1) and ends the loop. Then the loop resets and the next is planned.
 * ⛓ AN-3b: when a plan's path runs out with mana left and an item arrived during the loop (the state diverged from the
 * plan), the rest of the loop is planned again from the live state (`continueFrom`) and played — the runner's
 * continuation (`playbackBot/loopModeRunner.js`).
 *
 * A refusal by the gate is a DEFECT of the planner's route (hops are never refused): it is recorded on the loop and
 * the run stops.
 *
 * Pure apart from the runtime it builds: no registry, no DOM, no I/O.
 */

import { ActionNodesRuntime } from './actionNodesRuntime.js';
import { planLiveLoop } from './actionLoopBot.js';
import { ACT_ACTION } from './actionGraphCompiler.js';
import { applyRegionXpCostEffect, levelFromXP } from '../shared/procgen/xpFormulas.js';
import { ResourceLedger } from '../resourceChannels/resourceLedger.js';

const EPSILON = 1e-9;

/** The item each check location holds in the document: location name → item name. */
export function itemsAtLocations(rules, playerId = '1') {
    const out = {};
    for (const region of Object.values(rules.regions?.[String(playerId)] ?? {})) {
        for (const loc of region.locations ?? []) out[loc.name] = typeof loc.item === 'string' ? loc.item : loc.item?.name;
    }
    return out;
}

/**
 * Play a compiled ActionNodes world to its goal along the live bot's paths.
 * @param {object} rules - the compiled rules.json
 * @param {object} [opts]
 * @param {string} [opts.playerId='1']
 * @param {number} [opts.maxLoops=100]
 * @returns {{reachedGoal: boolean, refused: object|null, loops: Array<{loop: number, kind: string, reason: string,
 *   lines: string[], entries: number, acts: string[], checks: string[], received: string[], attempt: string|null,
 *   manaLeft: number}>}}
 */
export function playLiveToGoal(rules, { playerId = '1', maxLoops = 100 } = {}) {
    const p = String(playerId);
    const block = rules.action_nodes?.[p];
    if (!block) throw new Error('playLiveToGoal: not an ActionNodes world');
    const settings = block.settings ?? {};
    const scale = settings.xpGainScale ?? 1;
    const itemAt = itemsAtLocations(rules, p);
    const goalItem = rules.game_info?.[p]?.completion_condition?.item ?? null;
    const startRegion = (Array.isArray(rules.start_regions?.[p]) ? rules.start_regions[p] : rules.start_regions?.[p]?.default)?.[0] ?? 'Menu';

    const xp = {};
    const inventory = {};
    const checked = new Set();
    let mana = 0;
    const ledger = new ResourceLedger();
    const price = (time, nodeId) => applyRegionXpCostEffect(time, levelFromXP(xp[nodeId] ?? 0), settings.xpEffect);
    const runtime = new ActionNodesRuntime({
        ledger: () => ledger,
        publish: () => {},
        dispatch: (event, data) => {
            if (event !== 'user:locationCheck') return;
            checked.add(data.locationName);
            const item = itemAt[data.locationName];
            if (item) inventory[item] = (inventory[item] ?? 0) + 1;
            runtime.onSnapshot({ inventory: { ...inventory }, checkedLocations: [...checked] });
        },
        gameState: () => ({ getCurrentMana: () => mana, setPerItemManaTable: () => {} }),
        gainMana: ({ amount }) => { mana += amount; },
        xpAdjustedCost: price,
    });
    runtime.loadWorld(rules, p);
    runtime.onSnapshot({ inventory: {}, checkedLocations: [] });
    const goalLocation = runtime.model.nodes[runtime.model.goalIndex]?.location;
    const won = () => checked.has(goalLocation) || (goalItem && inventory[goalItem] > 0);

    const loops = [];
    for (let loop = 1; loop <= maxLoops && !won(); loop += 1) {
        runtime.onLoopReset('sim');
        const maxMana = (block.loop?.mana ?? 0) + runtime.model.boons.reduce((m, b) => m + b.mana * (inventory[b.name] ?? 0), 0);
        mana = maxMana;
        const context = () => ({
            model: runtime.model, inventory: { ...inventory }, checkedLocations: [...checked],
            regionXp: (id) => xp[id] ?? 0, maxMana, startRegion,
        });
        let plan = planLiveLoop(context());
        const row = {
            loop, kind: plan.kind, reason: plan.reason, lines: [...plan.lines], entries: plan.path.length,
            acts: [], checks: [], received: [], attempt: null, manaLeft: 0, replans: 0,
        };
        loops.push(row);
        if (plan.kind === 'done') break;
        const before = { ...inventory };
        let at = null;
        // ⛓ AN-3b: the runner's continuation. When a plan's path has run out with mana left and an item arrived during
        // it (the state diverged from the plan), plan the rest of the loop from the live state and play that too.
        for (;;) {
            const planned = JSON.stringify(inventory);
            let stopped = false;
            for (const entry of plan.path) {
                const verdict = runtime.gate(entry);
                if (!verdict.ok) {
                    row.refused = { entry, ...verdict };
                    return { reachedGoal: false, refused: row.refused, loops };
                }
                if (entry.type === 'regionMove') { at = entry.destinationRegion; continue; }
                if (entry.type !== 'customAction' || entry.actionName !== ACT_ACTION) continue;
                const nodeId = entry.params?.nodeId ?? entry.sourceRegion;
                at = nodeId;
                const node = runtime.node(nodeId);
                const cost = price(node.time, nodeId);
                if (mana <= EPSILON || mana + EPSILON < cost) {
                    // ⚖ Q1: started short, it drains what is left as region XP and the loop ends.
                    xp[nodeId] = (xp[nodeId] ?? 0) + Math.max(0, mana) * scale;
                    row.attempt = nodeId;
                    mana = 0;
                    stopped = true;
                    break;
                }
                mana -= cost;
                xp[nodeId] = (xp[nodeId] ?? 0) + cost * scale;
                const r = runtime.perform(nodeId, { fromLoop: true });
                if (!r.ok) {
                    row.refused = { entry, code: r.code, reason: r.text };
                    return { reachedGoal: false, refused: row.refused, loops };
                }
                row.acts.push(node.name);
                if (r.checkSent) row.checks.push(r.checkSent);
                if (won()) { stopped = true; break; }
            }
            if (stopped || mana <= EPSILON || JSON.stringify(inventory) === planned) break;
            const next = planLiveLoop({ ...context(), continueFrom: { region: at, mana, state: runtime.liveState() } });
            if (next.kind === 'done' || next.kind === 'unreachable' || !next.path.length) break;
            row.replans += 1;
            row.lines.push(...next.lines.map((l) => `(replan) ${l}`));
            row.entries += next.path.length;
            plan = next;
        }
        for (const [item, n] of Object.entries(inventory)) {
            for (let k = before[item] ?? 0; k < n; k += 1) row.received.push(item);
        }
        row.manaLeft = mana;
    }
    return { reachedGoal: !!won(), refused: null, loops };
}
