/**
 * In-app rows for the ActionNodes runtime (slices AN-2, AN-1b), category "ActionNodes", in batch `fast`.
 *
 * Every row loads the committed example preset itself, sets its own queue, speed and flags, and puts them back. The
 * numbers it checks (prices, results, which item a check holds, the exits and what is discovered) are read from the
 * preset, never typed here.
 *
 * ⛓ AN-1b: the compiled example has TWO-WAY edges (a forward exit per `after` edge and an ungated reverse exit back),
 * so a route may move back to any node reached this loop for 0 (⚖ Robert 2026-11-16T17:41:55Z); there is no explore
 * in ActionNodes (D6); and discovery follows the world's `actionNodes` bundle (19:59:48Z).
 */

import { registerTest } from '../testRegistry.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import loopStateSingleton from '../../loops/loopStateSingleton.js';
import { getActionNodesRuntime } from '../../actionNodes/actionNodesRuntime.js';
import { getResourceLedger } from '../../resourceChannels/resourceChannelsLibrary.js';
import discoveryStateSingleton from '../../discovery/singleton.js';
import { getDiscoverySettings } from '../../discovery/index.js';
import { centralRegistry } from '../../../app/core/centralRegistry.js';
import { nodeCardView } from '../../actionNodes/nodeCardOverlay.js';
import { NODE_STATES } from '../../actionNodes/nodeStates.js';
import { CHECK_MARK, GOAL_MARK, PERFORM_ALL_SLOT, PLACEHOLDER_TEXT } from '../../actionNodes/nodeCard.js';
import { playLiveToGoal } from '../../actionNodes/actionLiveSim.js';
import { buildActionModel } from '../../actionNodes/actionModel.js';
import { playToGoal } from '../../actionNodes/actionPlanner.js';
import { placementsFromRules } from '../../actionNodes/actionGraphCompiler.js';
import { getActivePanel } from '../../playbackBot/index.js';
import { getSphereStateSingleton } from '../../sphereState/singleton.js';
import { startAppBotTestSpeed } from '../botTestSpeed.js';
import { buildContext } from '../../tutorials/tutorialContext.js';
import panelManager from '../../../app/core/panelManager.js';
import { getPanelInstances as getRegionMapPanels } from '../../regionMap/index.js';
import { REGION_MAP_CLICK_ACTIONS_KEY, regionOfCell } from '../../regionMap/regionMapClickActions.js';
import { ACT_CLICK_ID, PLAN_SOURCE_PREFIX, lastPerformResult } from '../../actionNodes/nodeClickAction.js';
import { PERFORM_ALL_LABEL, completedBeforeText } from '../../actionNodes/nodeCard.js';
import { compileActionGraph } from '../../actionNodes/actionGraphCompiler.js';
import { knowledgeItemNameOf } from '../../actionNodes/actionGraph.js';
import { formatClock } from '../../actionNodes/actionModel.js';
import { queueEndState } from '../../actionNodes/nodeStates.js';
import { actionNodesPanelModel } from '../../actionNodes/actionNodesPanel.js';
import { HISTORY_STORAGE_PREFIX } from '../../actionNodes/historyStore.js';
import { resourcesPanelModel } from '../../resourceChannels/resourcesPanel.js';
import { loadedWorldSubstrates } from '../../resourceChannels/poolName.js';

const PRESET_RULES = './presets/action_nodes_example/AP_1/AP_1_rules.json';
const CATEGORY = 'ActionNodes';
const P = '1';

const gs = () => getGameStateSingleton();
const runtime = () => getActionNodesRuntime();

/** The preset as committed: payloads, the block, and the item each check location holds. */
async function readPreset() {
    const rules = await (await fetch(PRESET_RULES, { cache: 'no-store' })).json();
    const payloads = Object.fromEntries(Object.entries(rules.preset_sidecars[P]).map(([k, v]) => [k, v.playable_payload]));
    const itemAt = {};
    for (const region of Object.values(rules.regions[P])) {
        for (const loc of region.locations ?? []) itemAt[loc.name] = typeof loc.item === 'string' ? loc.item : loc.item?.name;
    }
    return { rules, block: rules.action_nodes[P], payloads, itemAt };
}

/** Load the preset; wait for the runtime and loop mode (the preset carries loop_costs). */
async function loadExample(tc) {
    await tc.loadRulesFromFile(PRESET_RULES);
    await tc.stateManager.pingWorker('after-rules-load', 3000);
    const ok = await tc.pollForCondition(
        () => runtime().isLoaded() && gs()?.isLoopModeActive === true,
        'the ActionNodes runtime holds the world and loop mode is on', 8000, 100);
    tc.reportCondition('the ActionNodes runtime holds the world and loop mode is on', !!ok);
    return !!ok;
}

/** Stop the queue, empty it, start a fresh loop at full speed. Returns a restore function. */
function freshQueue() {
    const ls = loopStateSingleton;
    const saved = {
        instant: ls.instantMode, autoRestart: ls.autoRestartQueue, noReset: gs().noManaDepletionReset,
    };
    // clearQueue empties the path and teleports the player to the loop start.
    ls.clearQueue();
    ls.instantMode = true;
    ls.setAutoRestartQueue?.(false);
    gs().noManaDepletionReset = false;
    ls._resetLoop();
    return () => {
        ls.stopProcessing?.();
        ls.instantMode = saved.instant;
        ls.setAutoRestartQueue?.(saved.autoRestart);
        gs().noManaDepletionReset = saved.noReset;
        gs().clearPath();
        // Leave loop mode OFF: a leaked flag turns the strict gate loose on later rows' worlds.
        gs().setLoopModeActive(false);
    };
}

/**
 * Author a route as queue entries. `steps`: node ids to move to (one hop each, over the exit named `<from> -> <to>`,
 * forward or reverse), or `{act: nodeId, times}`.
 * The route starts at the declared start region (`Menu`), as every Loops path does: its first hop is what puts the
 * player back on the start node when a loop re-runs the queue (a Loops reset does not teleport).
 */
function author(payloads, steps) {
    const g = gs();
    let at = g.startRegions?.[0] ?? 'Menu';
    for (const step of steps) {
        if (typeof step === 'string') {
            g.updatePath(step, `${at} -> ${step}`, at);
            at = step;
        } else {
            for (let k = 0; k < (step.times ?? 1); k++) {
                g.addCustomAction('act', { nodeId: step.act, label: payloads[step.act].name, regionName: step.act });
            }
        }
    }
}

/** The node-to-node hops from `from` to `to` over the payloads' exits (forward and reverse), shortest first. */
function hopsBetween(payloads, from, to) {
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
        const at = queue.shift();
        if (at === to) break;
        for (const e of payloads[at].exits) {
            if (prev.has(e.targetRegion)) continue;
            prev.set(e.targetRegion, at);
            queue.push(e.targetRegion);
        }
    }
    const hops = [];
    for (let at = to; at !== from; at = prev.get(at)) hops.unshift(at);
    return hops;
}

/** A witness plan (`steps`, node ids in performance order) as route steps: hops between nodes, then the act. */
function routeOfPlan(block, payloads, steps) {
    const out = [];
    let at = block.start;
    for (const id of steps) {
        if (id !== at) out.push(...hopsBetween(payloads, at, id));
        at = id;
        const last = out[out.length - 1];
        if (last && typeof last === 'object' && last.act === id) last.times += 1;
        else out.push({ act: id, times: 1 });
    }
    return out;
}

/** Is the exit `<from> -> <to>` a reverse exit? */
const isReverse = (payloads, from, to) => !!payloads[from]?.exits.find((e) => e.targetRegion === to)?.reverse;

/** Every route begins with the hop from Menu to the start node. */
function routeFrom(block, steps) {
    return [block.start, ...steps];
}

async function runQueue(tc, label, timeoutMs = 15000) {
    loopStateSingleton.startProcessing();
    const done = await tc.pollForCondition(
        () => !loopStateSingleton.isProcessing,
        label, timeoutMs, 50);
    return !!done;
}

const amountOf = (named, id) => named?.[id]?.amount ?? 0;
const countOf = (nodeId) => runtime().counts[runtime().nodeIndex(nodeId)];
const ledger = () => getResourceLedger().snapshot();

// ─── 1. Load the preset and act once ───────────────────────────────────────

async function actOnce(tc) {
    const { block, payloads } = await readPreset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    const restore = freshQueue();
    try {
        const node = Object.values(payloads).find((p) => p.kind !== 'start' && p.after.some((s) => s.includes(block.start))
            && Object.keys(p.results.resources).length && !Object.keys(p.requires.resources).length);
        tc.log(`acting once at ${node.name} (${node.time} mana)`);
        const mana0 = gs().getCurrentMana();
        author(payloads, routeFrom(block, [node.node_id, { act: node.node_id }]));
        const queue = loopStateSingleton.getActionQueue();
        tc.assertEqual('the act entry is in the Loops queue, labelled by the node', true,
            queue.some((a) => a.actionName === 'act' && a.params?.label === node.name));
        tc.assertEqual('the queue ran to its end', true, await runQueue(tc, 'queue finished'));
        tc.assertEqual('no start-gate refusal', null, loopStateSingleton.lastActionRefusal);
        tc.assertEqual(`${node.name} performed once this loop`, 1, countOf(node.node_id));
        const [rid, r] = Object.entries(node.results.resources)[0];
        tc.assertEqual(`${r.name} in the ledger is the node's result`, r.amount, ledger().resources[rid]);
        tc.assertEqual('the pool paid the node\'s authored price', mana0 - node.time, gs().getCurrentMana());
        tc.assertEqual('the player stands on the node', node.node_id, gs().getCurrentRegion());
    } finally {
        restore();
    }
    return tc.getOverallResult();
}

// ─── 2. A refused action stops the queue, naming the action and why ────────

async function refusalStops(tc) {
    const { block, payloads } = await readPreset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    let restore = freshQueue();
    try {
        // (a) ⛓ AN-1b: a BACKWARD route reaches the goal in the browser. Loop 1 earns the item the goal's rule names
        // (at the check the fill put it in); loop 2 plays the goal's own witness (procgen_metadata's A6 report), whose
        // plan moves back to earlier nodes between performances. Nothing in it is refused; the goal is checked.
        const { rules } = await readPreset();
        const logic = rules.procgen_metadata[P].action_logic;
        const goal = Object.values(payloads).find((p) => p.kind === 'goal');
        const witness = logic.targets[goal.location].witnesses[0];
        const needed = Object.keys(witness.items);
        const holder = Object.entries(logic.placements).filter(([, item]) => needed.includes(item)).map(([loc]) => loc);
        tc.log(`the goal's witness needs ${JSON.stringify(witness.items)}; held at ${holder.join(', ')}`);
        for (const loc of holder) {
            const node = Object.values(payloads).find((p) => p.location === loc);
            const w = logic.targets[loc].witnesses.find((x) => !Object.keys(x.items).length);
            tc.assertEqual(`${loc} has an empty-handed witness`, true, !!w);
            author(payloads, routeFrom(block, routeOfPlan(block, payloads, w.steps)));
            tc.assertEqual(`loop 1 (${node.name}) ran to its end`, true, await runQueue(tc, `loop 1 to ${loc}`));
            tc.assertEqual('loop 1: no refusal', null, loopStateSingleton.lastActionRefusal);
            restore();
            restore = freshQueue();
        }
        const heldAll = await tc.pollForCondition(
            () => needed.every((it) => (tc.stateManager.getLatestStateSnapshot?.()?.inventory?.[it] ?? 0) >= witness.items[it]),
            'the goal\'s items are held', 8000, 100);
        tc.assertEqual('the goal\'s items are held', true, !!heldAll);
        await tc.pollForCondition(() => needed.every((it) => runtime().held.get(it) >= witness.items[it]), 'the runtime saw them', 5000, 50);
        restore();
        restore = freshQueue();
        const route = routeOfPlan(block, payloads, witness.steps);
        const hops = [block.start, ...route.filter((x) => typeof x === 'string')];
        const backHops = hops.slice(1).filter((to, k) => isReverse(payloads, hops[k], to));
        tc.log(`goal route: ${JSON.stringify(route)} (${backHops.length} moves back)`);
        tc.assertEqual('the goal\'s witness route moves back at least once', true, backHops.length > 0);
        author(payloads, routeFrom(block, route));
        tc.assertEqual('loop 2 (the goal route) ran to its end', true, await runQueue(tc, 'the goal route finished', 20000));
        tc.assertEqual('loop 2: no refusal', null, loopStateSingleton.lastActionRefusal);
        tc.assertEqual(`${goal.name} performed`, 1, countOf(goal.node_id));
        const reached = await tc.pollForCondition(
            () => (tc.stateManager.getLatestStateSnapshot?.()?.checkedLocations ?? []).includes(goal.location),
            `${goal.location} checked`, 8000, 100);
        tc.assertEqual(`the goal location ${goal.location} is checked`, true, !!reached);
        restore();

        // (b) an act whose requirement is unmet: a use node off the start with nothing to use
        restore = freshQueue();
        const use = Object.values(payloads).find((p) => p.after.some((s) => s.includes(block.start))
            && Object.keys(p.requires.resources).length);
        const [rid, need] = Object.entries(use.requires.resources)[0];
        author(payloads, routeFrom(block, [use.node_id, { act: use.node_id }]));
        const mana0 = gs().getCurrentMana();
        await runQueue(tc, 'the queue stopped (act refusal)');
        const r2 = loopStateSingleton.lastActionRefusal;
        tc.log(`refusal: ${JSON.stringify(r2)}`);
        tc.assertEqual('it names the node', use.name, r2?.label);
        tc.assertEqual('…and the unmet requirement', 'resource', r2?.code);
        tc.assertEqual('the reason states the numbers', true, String(r2?.reason).includes(`${need.name} ${need.amount}`));
        tc.assertEqual('the refused act spent nothing', mana0, gs().getCurrentMana());
        tc.assertEqual('nothing was performed', 0, countOf(use.node_id));
        tc.assertEqual(`${need.name} is still 0`, 0, ledger().resources[rid]);
    } finally {
        restore();
    }
    return tc.getOverallResult();
}

// ─── 3. Results reach the ledger ───────────────────────────────────────────

async function resultsReachLedger(tc) {
    const { block, payloads } = await readPreset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    const restore = freshQueue();
    try {
        // a repeatable node that earns a resource, then a node after it that spends it and makes another
        const earner = Object.values(payloads).find((p) => p.limit > 1 && Object.keys(p.results.resources).length);
        const buyer = Object.values(payloads).find((p) => p.after.some((s) => s.includes(earner.node_id))
            && Object.values(p.results.resources).some((v) => v.amount > 0));
        author(payloads, routeFrom(block, [earner.node_id, { act: earner.node_id, times: earner.limit }, buyer.node_id, { act: buyer.node_id }]));
        tc.assertEqual('the queue ran to its end', true, await runQueue(tc, 'queue finished'));
        tc.assertEqual('no refusal', null, loopStateSingleton.lastActionRefusal);
        const expect = {};
        for (const id of Object.keys(block.resources)) {
            expect[id] = earner.limit * amountOf(earner.results.resources, id) + amountOf(buyer.results.resources, id);
        }
        tc.log(`ledger ${JSON.stringify(ledger().resources)}, expected ${JSON.stringify(expect)}`);
        tc.assertEqual('every resource is the sum of the results', JSON.stringify(expect), JSON.stringify(ledger().resources));
        tc.assertEqual('the ledger names its owner', 'action_nodes', ledger().owner);
        const snapFn = tc.centralRegistry?.getPublicFunction?.('resourceChannels', 'getLedgerSnapshot');
        if (snapFn) tc.assertEqual('the public ledger snapshot agrees', JSON.stringify(expect), JSON.stringify(snapFn().resources));
    } finally {
        restore();
    }
    return tc.getOverallResult();
}

/** The Guard's-Locker-shaped route: a check node, its after-chain from the start, each node its limit times. */
function routeToCheck(block, payloads) {
    const check = Object.values(payloads).find((p) => p.kind === 'check' && !Object.keys(p.requires.stats).length);
    const chain = [];
    for (let id = check.node_id; id !== block.start; id = payloads[id].after[0][0]) chain.unshift(id);
    const steps = [];
    for (const id of chain) steps.push(id, { act: id, times: payloads[id].limit });
    return { check, steps };
}

// ─── 4. A loop reset restores base plus boosts ─────────────────────────────

async function resetRestoresBoosts(tc) {
    const { block, payloads, itemAt } = await readPreset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    const restore = freshQueue();
    try {
        const { check, steps } = routeToCheck(block, payloads);
        const item = itemAt[check.location];
        const boost = block.boosts[item];
        tc.log(`${check.name} holds ${item}; its boost: ${JSON.stringify(boost)}`);
        tc.assertEqual(`${item} is a boost of this world`, true, !!boost);
        author(payloads, routeFrom(block, steps));
        tc.assertEqual('the queue ran to its end', true, await runQueue(tc, 'queue finished'));
        const got = await tc.pollForCondition(() => (tc.stateManager.getLatestStateSnapshot?.()?.inventory?.[item] ?? 0) > 0,
            `${item} received`, 8000, 100);
        tc.assertEqual(`${item} received from ${check.name}`, true, !!got);
        await tc.pollForCondition(() => runtime().held.get(item) === 1, 'the runtime saw the boost', 5000, 50);
        const base = (kind) => Object.fromEntries(Object.keys(block[kind]).map((id) => [id, boost[kind]?.[id] ?? 0]));
        for (const [label, reset] of [
            ['loopState:loopReset (Loops\' own reset)', () => loopStateSingleton._resetLoop()],
            ['gameState:loopReset (the substrate reset)', () => gs().triggerLoopReset()],
        ]) {
            reset();
            const snap = ledger();
            tc.assertEqual(`${label}: resources are base + ${item}`, JSON.stringify(base('resources')), JSON.stringify(snap.resources));
            tc.assertEqual(`${label}: stats are base + ${item}`, JSON.stringify(base('stats')), JSON.stringify(snap.stats));
            tc.assertEqual(`${label}: ${check.name} not performed this loop`, 0, countOf(check.node_id));
            tc.assertEqual(`${label}: the pool is the starting mana`, gs().getMaxMana(), gs().getCurrentMana());
        }
        tc.assertEqual('the starting mana is base + the per-item boost mana (not the flat +10)',
            gs().defaultMaxMana + boost.mana, gs().getMaxMana());
    } finally {
        restore();
    }
    return tc.getOverallResult();
}

// ─── 5. A check is sent once, and the action repeats next loop ─────────────

async function checkOnceRepeat(tc) {
    const { block, payloads } = await readPreset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    const restore = freshQueue();
    const rt = runtime();
    const sends = [];
    const realDispatch = rt.env.dispatch;
    rt.env.dispatch = (event, data, opts) => {
        if (event === 'user:locationCheck') sends.push(data.locationName);
        return realDispatch?.(event, data, opts);
    };
    let completions = 0;
    const off = tc.eventBus.subscribe('loop:actionCompleted', () => { completions += 1; }, 'tests');
    try {
        const { check, steps } = routeToCheck(block, payloads);
        author(payloads, routeFrom(block, steps));
        const queueLen = loopStateSingleton.getActionQueue().length;
        tc.assertEqual('loop 1 ran to its end', true, await runQueue(tc, 'loop 1 finished'));
        const checked = await tc.pollForCondition(
            () => (tc.stateManager.getLatestStateSnapshot?.()?.checkedLocations ?? []).includes(check.location),
            `${check.location} checked`, 8000, 100);
        tc.assertEqual(`${check.location} is checked`, true, !!checked);
        tc.assertEqual('the check was sent once', JSON.stringify([check.location]), JSON.stringify(sends));
        const acts1 = completions;
        loopStateSingleton._resetLoop();
        tc.assertEqual('the act entries stay in the queue (A15)', queueLen, loopStateSingleton.getActionQueue().length);
        tc.assertEqual('loop 2 ran to its end', true, await runQueue(tc, 'loop 2 finished'));
        tc.assertEqual('no refusal in loop 2', null, loopStateSingleton.lastActionRefusal);
        tc.assertEqual(`${check.name} performed again in loop 2`, 1, countOf(check.node_id));
        tc.assertEqual('loop 2 performed every act again', acts1 * 2, completions);
        tc.assertEqual('…and sent no check again', 1, sends.length);
    } finally {
        rt.env.dispatch = realDispatch;
        try { off?.(); } catch { /* ignore */ }
        restore();
    }
    return tc.getOverallResult();
}

// ─── 6. No explore in ActionNodes (D6) ─────────────────────────────────────

async function exploreRefused(tc) {
    const { block, payloads } = await readPreset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    const restore = freshQueue();
    const g = gs();
    const guard = g.customActionGuard;
    try {
        const node = Object.values(payloads).find((p) => p.kind !== 'start' && p.after.some((s) => s.includes(block.start)));
        author(payloads, routeFrom(block, [node.node_id]));
        const len = loopStateSingleton.getActionQueue().length;
        // (1) at queue time, whatever control queued it
        tc.assertEqual('the queue guard is installed', true, typeof guard === 'function');
        tc.assertEqual('an explore is refused at queue time', false, g.addCustomAction('explore', { regionName: node.node_id }));
        tc.assertEqual('…nothing was appended', len, loopStateSingleton.getActionQueue().length);
        tc.assertEqual('…the refusal names the action', 'explore', g.lastQueueRefusal?.actionName);
        tc.assertEqual('…and the code', 'action-not-offered', g.lastQueueRefusal?.code);
        tc.assertEqual('an act is still queued', true, g.addCustomAction('act', { nodeId: node.node_id, label: node.name, regionName: node.node_id }) !== false);
        // (2) by the gate: an explore entry that got in some other way stops the queue, named
        g.setCustomActionGuard(null);
        g.addCustomAction('explore', { regionName: node.node_id });
        g.setCustomActionGuard(guard);
        const entry = loopStateSingleton.getActionQueue().find((a) => a.actionName === 'explore');
        tc.assertEqual('(a stray explore entry is in the queue)', true, !!entry);
        await runQueue(tc, 'the queue stopped (explore refusal)');
        const r = loopStateSingleton.lastActionRefusal;
        tc.log(`refusal: ${JSON.stringify(r)}`);
        tc.assertEqual('the gate refused the explore', 'action-not-offered', r?.code);
        tc.assertEqual('…naming it', loopStateSingleton._describeQueueEntry(entry), r?.label);
        tc.assertEqual('…and why', true, String(r?.reason).includes("no 'explore' action"));
        tc.assertEqual('the act before it ran', 1, countOf(node.node_id));
        // (3) no explore control for an ActionNodes region: expand its block in the Loops panel and look.
        tc.assertEqual('the node is an ActionNodes region (as Loops resolves it)', 'action_nodes',
            loopStateSingleton._lookupSubstrateId(node.node_id));
        const blockOf = () => document.querySelector(`.loop-region-block[data-region="${CSS.escape(node.node_id)}"]`);
        if (!blockOf()) {
            tc.log('the Loops panel draws no block for the node in this layout: the explore-control check is skipped');
        } else {
            if (!blockOf().querySelector('.loop-region-details')) blockOf().querySelector('.loop-region-header')?.click();
            const expanded = await tc.pollForCondition(() => !!blockOf()?.querySelector('.loop-region-details'),
                'the node\'s Loops block is expanded', 3000, 50);
            tc.assertEqual('the node\'s Loops block is expanded (its details drawn)', true, !!expanded);
            tc.assertEqual('no explore button in it', 0, blockOf()?.querySelectorAll('.explore-btn').length ?? -1);
        }
    } finally {
        g.setCustomActionGuard(guard);
        restore();
    }
    return tc.getOverallResult();
}

// ─── 7. Discovery under the 19:59 ruling (D1–D4, D6) ───────────────────────

/** What discovery holds now, as sorted lists. */
function discoverySets() {
    const d = discoveryStateSingleton;
    const st = d.getSerializableState();
    return {
        regions: [...st.regions].sort(),
        exits: st.exits.flatMap(([r, xs]) => xs.map((x) => `${r}|${x}`)).sort(),
        locations: [...st.locations].sort(),
    };
}

/**
 * What discovery should hold, from the preset alone, when `revealed` are the nodes whose exits are open to view (the
 * start, and every node cleared on some loop): the start regions and their exits; each revealed node's forward exits,
 * their targets with every location, and each target's exit straight back.
 */
function expectedSets(rules, payloads, revealed) {
    const regions = new Set(rules.start_regions[P].default);
    const exits = new Set();
    const locations = new Set();
    for (const s of rules.start_regions[P].default) {
        for (const e of rules.regions[P][s].exits) { exits.add(`${s}|${e.name}`); regions.add(e.connected_region); }
    }
    const locs = (id) => (rules.regions[P][id].locations ?? []).forEach((l) => locations.add(l.name));
    for (const id of revealed) {
        regions.add(id);
        locs(id);
        for (const e of payloads[id].exits.filter((x) => !x.reverse)) {
            exits.add(`${id}|${e.exitName}`);
            regions.add(e.targetRegion);
            locs(e.targetRegion);
            for (const b of payloads[e.targetRegion].exits) if (b.targetRegion === id) exits.add(`${e.targetRegion}|${b.exitName}`);
        }
    }
    return { regions: [...regions].sort(), exits: [...exits].sort(), locations: [...locations].sort() };
}

async function discoverySetsRow(tc) {
    const { rules, block, payloads } = await readPreset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    const restore = freshQueue();
    try {
        const same = (label, want) => {
            const got = discoverySets();
            for (const k of ['regions', 'exits', 'locations']) {
                tc.assertEqual(`${label}: discovered ${k}`, JSON.stringify(want[k]), JSON.stringify(got[k]));
            }
        };
        tc.assertEqual('the world names the actionNodes bundle', 'actionNodes',
            centralRegistry.getPublicFunction('discovery', 'getWorldDiscoveryMode')?.());
        // At load: D1 the start in full, D2 its neighbours with their contents, D3 their forward exits unnamed.
        const atLoad = expectedSets(rules, payloads, [block.start]);
        await tc.pollForCondition(() => JSON.stringify(discoverySets().exits) === JSON.stringify(atLoad.exits), 'the start revealed', 5000, 50);
        same('at load', atLoad);
        const neighbour = payloads[block.start].exits.find((e) => !e.reverse && payloads[e.targetRegion].limit === 1
            && payloads[e.targetRegion].exits.some((x) => !x.reverse)).targetRegion;
        tc.assertEqual(`D3: ${neighbour}'s forward exits are not named yet`, true,
            payloads[neighbour].exits.filter((x) => !x.reverse).every((x) => !discoveryStateSingleton.isExitDiscovered(neighbour, x.exitName)));
        // The first clear: its exits, their targets with contents, the moves back. Nothing random (D6).
        author(payloads, routeFrom(block, [neighbour, { act: neighbour }]));
        tc.assertEqual('the queue ran to its end', true, await runQueue(tc, 'queue finished'));
        const afterClear = expectedSets(rules, payloads, [block.start, neighbour]);
        same(`after ${payloads[neighbour].name}'s first clear`, afterClear);
        // D4: a loop reset keeps it all.
        loopStateSingleton._resetLoop();
        gs().triggerLoopReset();
        same('after a loop reset', afterClear);
        // Loop mode off: the same bundle (discovery on, locations with their region), the same sets.
        gs().setLoopModeActive(false);
        const off = await tc.pollForCondition(() => {
            const st = getDiscoverySettings();
            return gs().isLoopModeActive === false && st.enableDiscoveryMode === true && st.autoDiscoverLocations === true;
        }, 'Loop mode off, the bundle still forced', 5000, 50);
        tc.assertEqual('with Loop mode off the bundle is still forced', true, !!off);
        same('with Loop mode off', afterClear);
    } finally {
        restore();
    }
    return tc.getOverallResult();
}

// ─── 8. Two-way moves ──────────────────────────────────────────────────────

async function twoWayMove(tc) {
    const { block, payloads } = await readPreset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    const restore = freshQueue();
    try {
        // a node off the start whose limit is above 1, with a forward exit: act once (not cleared), move back to the
        // start, come back, then try its forward exit.
        const multi = Object.values(payloads).find((p) => p.limit > 1 && p.after.some((s) => s.includes(block.start))
            && p.exits.some((x) => !x.reverse));
        const next = multi.exits.find((x) => !x.reverse).targetRegion;
        author(payloads, routeFrom(block, [multi.node_id, { act: multi.node_id }, block.start, multi.node_id, next]));
        const queue = loopStateSingleton.getActionQueue();
        const back = queue.find((a) => a.type === 'regionMove' && a.sourceRegion === multi.node_id && a.destinationRegion === block.start);
        tc.assertEqual('the move back uses a reverse exit', true, isReverse(payloads, multi.node_id, block.start));
        tc.assertEqual('the move back costs 0', 0, loopStateSingleton._calculateActionCost(back));
        const mana0 = gs().getCurrentMana();
        await runQueue(tc, 'the queue stopped (forward refusal)');
        const r = loopStateSingleton.lastActionRefusal;
        tc.log(`refusal: ${JSON.stringify(r)}`);
        tc.assertEqual('the move back was not refused: the queue stopped later, at the forward move', `Move to ${next}`, r?.label);
        tc.assertEqual('…out of the node it leaves', multi.node_id, r?.region);
        tc.assertEqual('…refused by name: not cleared', 'not-cleared', r?.code);
        tc.assertEqual('the reason states the count', true, String(r?.reason).includes(`(1/${multi.limit})`));
        tc.assertEqual('the move did not happen', multi.node_id, gs().getCurrentRegion());
        tc.assertEqual('the refused entry was not skipped', r?.index, loopStateSingleton.currentActionIndex);
        tc.assertEqual('the moves back and forth cost nothing: the pool paid the one act only', mana0 - multi.time, gs().getCurrentMana());
        const banner = document.querySelector('#loop-state-banner');
        if (banner && banner.style.display !== 'none') {
            tc.assertEqual('the Loops panel banner names the action', true, banner.textContent.includes(`Move to ${next}`));
        }
    } finally {
        restore();
    }
    return tc.getOverallResult();
}


// ─── 9. The node states (AN-3a) ─────────────────────────────────────────────

/** The app's own card view (as `actionNodes/index.js` wires it): the queue's end while planned, live while it runs. */
function appCardView() {
    return nodeCardView({
        runtime: runtime(),
        loopState: () => loopStateSingleton,
        loopMode: () => gs()?.isLoopModeActive === true,
        discovery: () => ({
            enabled: getDiscoverySettings()?.enableDiscoveryMode === true,
            isRegionDiscovered: (id) => discoveryStateSingleton.isRegionDiscovered(id),
        }),
    });
}

/**
 * The state each node should have, derived from the preset: undiscovered when discovery has not discovered it; the
 * start done; `cleared` (node id → performed its limit) and `counts` decide reach and done; a requirement unmet by the
 * `held` resources/stats names it.
 */
function expectedStates(payloads, block, { counts = {}, held = {} } = {}) {
    const limit = (id) => payloads[id].limit;
    const isCleared = (id) => id === block.start || (counts[id] ?? 0) >= limit(id);
    const out = {};
    for (const p of Object.values(payloads)) {
        const id = p.node_id;
        if (!discoveryStateSingleton.isRegionDiscovered(id)) { out[id] = NODE_STATES.UNDISCOVERED; continue; }
        if (id === block.start) { out[id] = NODE_STATES.DONE; continue; }
        if (!p.after.some((set) => set.every(isCleared))) { out[id] = NODE_STATES.NOT_REACHED; continue; }
        if ((counts[id] ?? 0) >= limit(id)) { out[id] = NODE_STATES.DONE; continue; }
        const unmet = [...Object.entries(p.requires.stats), ...Object.entries(p.requires.resources)]
            .some(([k, v]) => (held[k] ?? 0) < v.amount);
        out[id] = unmet ? NODE_STATES.BLOCKED : NODE_STATES.READY;
    }
    return out;
}

async function nodeStatesRow(tc) {
    const { block, payloads } = await readPreset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    const restore = freshQueue();
    const states = () => Object.fromEntries(Object.entries(appCardView().states).map(([k, v]) => [k, v.state]));
    const same = (label, want) => {
        const got = states();
        tc.log(`${label}: ${JSON.stringify(got)}`);
        tc.assertEqual(`${label}: every node's state`, JSON.stringify(want), JSON.stringify(got));
    };
    try {
        same('at load', expectedStates(payloads, block));
        // A planned route: a repeatable node cleared, then a node after it that spends what it gave.
        const rep = Object.values(payloads).find((p) => p.limit > 1 && p.after.some((s) => s.includes(block.start))
            && Object.keys(p.results.resources).length);
        const spender = Object.values(payloads).find((p) => p.after.some((s) => s.includes(rep.node_id))
            && Object.values(p.results.resources).some((v) => v.amount < 0));
        const sibling = Object.values(payloads).find((p) => p !== spender && p.after.some((s) => s.includes(rep.node_id))
            && Object.keys(p.requires.resources).length);
        author(payloads, routeFrom(block, [rep.node_id, { act: rep.node_id, times: rep.limit }, spender.node_id, { act: spender.node_id }]));
        const held = {};
        for (const [k, v] of Object.entries(rep.results.resources)) held[k] = v.amount * rep.limit;
        for (const [k, v] of Object.entries(spender.results.resources)) held[k] = (held[k] ?? 0) + v.amount;
        const view = appCardView();
        tc.assertEqual('a planned (not running) queue: the states are for its END', 'queue-end', view.basis);
        tc.assertEqual('the live counts are untouched by planning', 0, countOf(rep.node_id));
        const atEnd = expectedStates(payloads, block, { counts: { [rep.node_id]: rep.limit, [spender.node_id]: 1 }, held });
        same('at the end of the planned queue', atEnd);
        tc.assertEqual(`at the queue's end ${rep.name} is done (planned, not performed)`, NODE_STATES.DONE,
            appCardView().states[rep.node_id].state);
        // Run it: the states now follow the live state (the queue's acts are done).
        tc.assertEqual('the queue ran to its end', true, await runQueue(tc, 'queue finished'));
        const live = appCardView();
        tc.assertEqual('a finished queue: the live state', 'live', live.basis);
        same('after the clear', expectedStates(payloads, block, { counts: { [rep.node_id]: rep.limit, [spender.node_id]: 1 }, held }));
        tc.assertEqual(`after the clear ${sibling.name} is discovered and blocked by what ${spender.name} spent`,
            NODE_STATES.BLOCKED, live.states[sibling.node_id].state);
        // A loop reset: counts and the ledger back to the start; discovery kept (D4).
        gs().clearPath();
        loopStateSingleton._resetLoop();
        gs().triggerLoopReset();
        await tc.pollForCondition(() => countOf(rep.node_id) === 0, 'the reset cleared the counts', 3000, 50);
        const afterReset = expectedStates(payloads, block);
        tc.assertEqual(`after the reset ${spender.name} is still discovered (D4) and not reached`, NODE_STATES.NOT_REACHED, afterReset[spender.node_id]);
        same('after a loop reset', afterReset);
    } finally {
        restore();
    }
    return tc.getOverallResult();
}

// ─── 10. The node card on the Region Graph (AN-3a) ─────────────────────────

const OTHER_PRESET = './presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const cyOf = () => document.querySelector('.region-graph-panel-container div[id^="cy-"]')?._cyreg?.cy ?? null;
const cards = () => [...document.querySelectorAll('.region-graph-overlay-container .an-node-card')];
const cardOf = (id) => cards().find((c) => c.dataset.nodeId === id) ?? null;
const textOf = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Every region node's size/shape and every edge's arrows: what an overlay provider may change. */
function graphLook(cy) {
    const nodes = {};
    cy.nodes('.region').forEach((n) => {
        nodes[n.id()] = { look: [n.style('width'), n.style('height'), n.style('shape'), n.hasClass('has-overlay')], classes: [...n.classes()].sort().join(' ') };
    });
    const edges = {};
    cy.edges().forEach((e) => {
        edges[e.id()] = ['target-arrow-shape', 'source-arrow-shape', 'mid-target-arrow-shape', 'mid-source-arrow-shape'].map((k) => e.style(k));
    });
    return { nodes, edges };
}

async function loadAndWaitForGraph(tc, path, label) {
    await tc.loadRulesFromFile(path);
    await tc.stateManager.pingWorker('after-rules-load', 3000);
    const rules = await (await fetch(path, { cache: 'no-store' })).json();
    const want = Object.keys(rules.regions?.[P] ?? {}).length;
    const ok = await tc.pollForCondition(() => {
        const cy = cyOf();
        return !!cy && cy.nodes('.region').length === want;
    }, `${label}: the Region Graph shows its ${want} regions`, 10000, 100);
    tc.reportCondition(`${label}: the Region Graph shows the world's regions`, !!ok);
    // let the layout and the overlay rebuild settle
    await new Promise((r) => setTimeout(r, 1500));
    return rules;
}

async function nodeCardRow(tc) {
    const { block, payloads } = await readPreset();
    tc.eventBus.publish('ui:activatePanel', { panelId: 'regionGraphPanel' });
    const panel = await tc.pollForValue(() => cyOf(), 'the Region Graph panel and its graph', 8000, 100);
    tc.reportCondition('the Region Graph panel is open', !!panel);
    if (!panel) return tc.getOverallResult();
    // The other world FIRST: its look without any card is the baseline.
    await loadAndWaitForGraph(tc, OTHER_PRESET, 'another world');
    const before = graphLook(cyOf());
    tc.assertEqual('another world: no card', 0, cards().length);
    if (!await loadExample(tc)) return tc.getOverallResult();
    tc.eventBus.publish('ui:activatePanel', { panelId: 'regionGraphPanel' });
    const ids = Object.keys(payloads);
    const allCards = await tc.pollForCondition(() => ids.every((id) => cardOf(id)), 'a card per node', 10000, 100);
    tc.reportCondition(`one card per node (${cards().length} of ${ids.length})`, !!allCards);
    const restore = freshQueue();
    try {
        // An undiscovered node: a forward target of a start neighbour not yet cleared — the placeholder, nothing else.
        const neighbour = payloads[block.start].exits.find((e) => !e.reverse && payloads[e.targetRegion].exits.some((x) => !x.reverse)).targetRegion;
        const hidden = payloads[neighbour].exits.find((x) => !x.reverse).targetRegion;
        await tc.pollForCondition(() => cardOf(hidden)?.dataset.state === NODE_STATES.UNDISCOVERED, 'the undiscovered card', 3000, 50);
        tc.assertEqual(`${hidden} (undiscovered): the placeholder`, PLACEHOLDER_TEXT, textOf(cardOf(hidden)));
        tc.assertEqual(`${hidden}: none of its contents`, false, textOf(cardOf(hidden)).includes(payloads[hidden].name));
        // A check node, played to its check: the route the goal's own witness starts with, up to the check node.
        const check = Object.values(payloads).find((p) => p.kind === 'check' && p.after.some((s) => s.every((m) => payloads[m].after.some((t) => t.includes(block.start))
            && !Object.keys(payloads[m].requires.resources).length && !Object.keys(payloads[m].requires.stats).length)));
        const pre = check.after.find((s) => s.length === 1)[0];
        author(payloads, routeFrom(block, [pre, { act: pre, times: payloads[pre].limit }, check.node_id, { act: check.node_id }]));
        tc.assertEqual('the queue ran to its end', true, await runQueue(tc, 'queue finished'));
        const diag = () => `counts ${JSON.stringify(runtime().snapshot().nodes.map((n) => [n.id, n.count]))} mana ${gs().getCurrentMana()} `
            + `resets ${gs().loopResetCount} processing ${loopStateSingleton.isProcessing} refusal ${JSON.stringify(loopStateSingleton.lastActionRefusal)} `
            + `basis ${appCardView().basis}`;
        tc.log(`DIAG after the run: ${diag()}`);
        const checkedOk = await tc.pollForCondition(() => textOf(cardOf(check.node_id)).includes(CHECK_MARK),
            `${check.name}: the check mark once its location is checked`, 5000, 100);
        tc.reportCondition(`${check.name}: the check mark once its location is checked`, !!checkedOk);
        tc.log(`DIAG after the check mark: ${diag()}`);
        const c = cardOf(check.node_id);
        tc.log(`check card: ${textOf(c)} [${c?.dataset.state}]`);
        tc.assertEqual(`${check.name}: its name`, true, textOf(c).includes(check.name));
        tc.assertEqual(`${check.name}: used/limit`, true, textOf(c).includes(`${check.limit}/${check.limit}`));
        tc.assertEqual(`${check.name}: its mana`, true, / mana/.test(textOf(c)));
        for (const v of Object.values(check.requires.stats)) {
            tc.assertEqual(`${check.name}: needs ${v.name}`, true, textOf(c).includes(`${v.name} ${v.amount}`));
        }
        tc.assertEqual(`${check.name}: state done`, NODE_STATES.DONE, c?.dataset.state);
        const slot = c?.querySelector(`[data-slot="${PERFORM_ALL_SLOT}"]`);
        tc.assertEqual('the reserved "perform all remaining" slot is there, empty', true, !!slot && slot.children.length === 0);
        tc.assertEqual('no button on a limit-1 card (AN-3b puts one on limit > 1 only)', 0, c?.querySelectorAll('button').length ?? -1);
        // The goal: revealed by the check node's clear, marked as the goal, its needs listed.
        const goal = payloads[block.goal];
        await tc.pollForCondition(() => textOf(cardOf(goal.node_id)).includes(goal.name), 'the goal card shows', 3000, 50);
        const g = cardOf(goal.node_id);
        tc.log(`goal card: ${textOf(g)} [${g?.dataset.state}]`);
        tc.assertEqual('the goal card: marked as the goal', true, textOf(g).includes(GOAL_MARK));
        for (const v of Object.values(goal.requires.stats)) {
            tc.assertEqual(`the goal card: needs ${v.name} ${v.amount}`, true, textOf(g).includes(`${v.name} ${v.amount}`));
        }
        tc.assertEqual('the goal card: blocked (a stat short), the unmet line marked', true,
            g?.dataset.state === NODE_STATES.BLOCKED && !!g.querySelector('.an-card__unmet'));
    } finally {
        restore();
    }
    // ⛓ Unload (planner ruling (a)): another world after an ActionNodes one has its original look and no stale card.
    await loadAndWaitForGraph(tc, OTHER_PRESET, 'another world again');
    tc.assertEqual('after unload: no card left', 0, cards().length);
    tc.assertEqual('after unload: the overlay container is empty', 0,
        document.querySelector('.region-graph-overlay-container')?.children.length ?? 0);
    const after = graphLook(cyOf());
    // A node's own state classes (the player's region is drawn larger) may differ between the two loads: compare the
    // nodes whose classes are the same, and hold every node free of the overlay's marks.
    const sameClass = Object.keys(before.nodes).filter((id) => after.nodes[id]?.classes === before.nodes[id].classes);
    tc.log(`after unload: ${sameClass.length} of ${Object.keys(before.nodes).length} nodes keep their classes; the rest: `
        + JSON.stringify(Object.keys(before.nodes).filter((id) => !sameClass.includes(id)).map((id) => [id, before.nodes[id], after.nodes[id]])));
    tc.assertEqual('after unload: most nodes compared', true, sameClass.length >= Object.keys(before.nodes).length - 2);
    tc.assertEqual('after unload: every node\'s size and shape as before',
        JSON.stringify(sameClass.map((id) => before.nodes[id].look)), JSON.stringify(sameClass.map((id) => after.nodes[id].look)));
    const marked = Object.entries(after.nodes).filter(([, n]) => n.look[3] || n.look[2] === 'rectangle' || n.classes.includes('has-overlay'));
    tc.assertEqual('after unload: no node keeps an overlay mark (has-overlay, the card\'s rectangle)', '[]', JSON.stringify(marked));
    tc.assertEqual('after unload: every edge\'s arrows as before', JSON.stringify(before.edges), JSON.stringify(after.edges));
    return tc.getOverallResult();
}

// ─── 11. The Playback Bot plays the example to the goal (AN-3a; category Playback Bot) ──

async function botPlaysToGoal(tc) {
    const { rules, block, payloads } = await readPreset();
    tc.eventBus.publish('ui:activatePanel', { panelId: 'playbackBotPanel' });
    const panel = await tc.pollForValue(() => getActivePanel(), 'playback bot panel instance', 5000, 100);
    const bot = panel?.getBot?.();
    tc.reportCondition('bot reachable', !!bot);
    if (!bot) return tc.getOverallResult();
    bot.reset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    await getSphereStateSingleton().loadSphereLog('embedded:actionNodesExample',
        (rules.sphere_log ?? []).map((e) => JSON.stringify(e)).join('\n'));
    bot.refresh();
    const restore = freshQueue();
    gs().setLoopModeActive(true);
    const reasoningBefore = bot.getLogReasoning();
    bot.setLogReasoning(true);
    const restoreSpeed = await startAppBotTestSpeed();
    const goalLocation = payloads[block.goal].location;
    try {
        await bot.play();
        const finished = await tc.pollForCondition(() => (bot.getStatus() || '').startsWith('finished'),
            'the bot finishes the world in Loop mode', 60000, 200);
        const loops = bot.getLoopRunner?.()?.getLoopCount?.() ?? 0;
        tc.reportCondition(`the bot finished (status: "${bot.getStatus()}", loops: ${loops})`, !!finished);
        const checked = new Set(tc.stateManager.getLatestStateSnapshot()?.checkedLocations ?? []);
        tc.assertEqual(`the goal (${goalLocation}) is checked`, true, checked.has(goalLocation));
        const log = bot.getLog();
        tc.log(`Bot loop log: ${JSON.stringify(log.slice(-40))}`);
        for (let k = 1; k <= loops; k += 1) {
            tc.assertEqual(`loop ${k}: its reason is in the log`, true,
                log.some((l) => l.startsWith(`loop ${k}: `) && /^(loop \d+: )(Chose:|Goal reachable:|No check|Waiting)/.test(l)));
        }
        const sim = playLiveToGoal(rules);
        tc.log(`headless live path: goal in ${sim.loops.length} loop(s); in-app: ${loops}`);
        // ⛓ AN-3b, limit (b): the runner replans mid-loop when an item arrives (headless: live 2 = pure 2, pinned
        // exactly in actionLoopBot.test.js). In-app the queue runs at Instant. Since LOOPS-I1 a Loops frame spends at
        // most the pool (loops/loopState.js _advanceActionProgress; pinned by loops/instantParity.test.js), so the
        // replan's ⚖ Q1 attempt drains the pool into region XP and ends the loop, as at normal speed. The in-app
        // count is therefore EXACTLY the pure planner's (⚖ planner ruling C's "≤" was the Instant-overshoot gap).
        const model = buildActionModel(await (await fetch(`./${rules.procgen_metadata[P].graph_path.replace(/^frontend\//, '')}`, { cache: 'no-store' })).json());
        const pure = playToGoal(model, { placements: placementsFromRules(rules, model, P) });
        tc.log(`pure planner: goal in ${pure.loops.length} loop(s); headless live: ${sim.loops.length}; in-app (Instant): ${loops}`);
        tc.assertEqual('the runner replanned mid-loop at least once', true, (bot.getLoopRunner?.()?.getReplanCount?.() ?? 0) >= 1);
        tc.assertEqual('a replan\'s reasoning is in the log', true, log.some((l) => /^loop \d+ \(replan\): /.test(l)));
        tc.assertEqual(`the goal in EXACTLY the pure planner's loop count (pure ${pure.loops.length})`, pure.loops.length, loops);
        tc.assertEqual(`… and the headless live path's (live ${sim.loops.length})`, sim.loops.length, loops);
        tc.assertEqual('the Q1 attempt is named in the log', true, log.some((l) => /attempting /.test(l)));
        tc.assertEqual('no queue refusal', null, loopStateSingleton.lastActionRefusal);
    } finally {
        bot.stop();
        bot.setLogReasoning(reasoningBefore);
        await restoreSpeed();
        restore();
    }
    return tc.getOverallResult();
}

// ─── 12. The click: actionNodes.act performs ONCE (AN-3b) ──────────────────

const GRAPH_CLICK_ACTIONS = 'moduleSettings.regionGraph.clickActions';
/** Only `actionNodes.act` on: the built-in route, the bulk check and the Regions panel off (this row's own state). */
const ACT_ONLY = Object.freeze({
    enabled: true,
    region: { 'path.route': false, 'path.checkAll': false, 'regions.open': false, [ACT_CLICK_ID]: true },
    location: { 'path.check': 'now' },
});
const graphStrip = () => document.querySelector('.region-graph-panel-container .click-actions-strip-summary')?.textContent ?? '';
const pathNow = () => gs().getPath?.() ?? [];
const actsIn = (path, nodeId) => path.filter((e) => e.type === 'customAction' && e.actionName === 'act' && e.params?.nodeId === nodeId).length;
const movesOf = (path) => path.filter((e) => e.type === 'regionMove').map((e) => `${e.sourceRegion}>${e.destinationRegion}`);

/** Open the Region Graph on the example and wait for a card per node. */
async function graphWithCards(tc, payloads) {
    tc.eventBus.publish('ui:activatePanel', { panelId: 'regionGraphPanel' }, 'tests');
    const ok = await tc.pollForCondition(() => !!cyOf() && Object.keys(payloads).every((id) => cardOf(id)),
        'the Region Graph shows a card per node', 10000, 100);
    tc.reportCondition('the Region Graph shows a card per node', !!ok);
    return !!ok;
}

/** Click a card's body (not its button): the overlay forwards it as the node's click (⚖ planner ruling 2026-11-20). */
function clickCard(id) {
    const before = lastPerformResult();
    const el = cardOf(id);
    el?.querySelector('.an-card__title')?.click();
    return lastPerformResult() !== before ? lastPerformResult() : null;
}

async function clickPerformsOnce(tc) {
    const { block, payloads } = await readPreset();
    const ctx = buildContext({ eventBus: tc.eventBus });
    if (!await loadExample(tc)) return tc.getOverallResult();
    const restore = freshQueue();
    let mapOpened = false;
    const fromStart = (p) => p.after.some((set) => set.length === 1 && set[0] === block.start);
    const needsNothing = (p) => !Object.keys(p.requires.resources).length && !Object.keys(p.requires.stats).length;
    const ready = Object.values(payloads).find((p) => fromStart(p) && p.limit > 1 && needsNothing(p));
    const blocked = Object.values(payloads).find((p) => fromStart(p) && Object.keys(p.requires.resources).length);
    const once = Object.values(payloads).find((p) => fromStart(p) && p.limit === 1 && needsNothing(p) && p.kind !== 'start');
    const selected = [];
    // CA-S5: regionGraph:nodeSelected is retired; the Graph's card click is heard on the generic event, filtered to the Graph
    // (this row's later Region Map clickAt publishes it too, with panelId 'regionMap').
    const off = tc.eventBus.subscribe('regionView:regionClicked', (d) => { if (d?.panelId === 'regionGraph') selected.push(d.regionName); }, 'tests');
    try {
        if (!await graphWithCards(tc, payloads)) return tc.getOverallResult();
        await ctx.setSetting(GRAPH_CLICK_ACTIONS, ACT_ONLY);
        const strip = await tc.pollForCondition(() => graphStrip().includes('perform once'), 'the strip shows "perform once"', 5000, 50);
        tc.reportCondition(`the Region Graph strip runs actionNodes.act ("${graphStrip()}")`, !!strip);

        // Loop mode, a ready node away from the queue's end: the route, then ONE act.
        tc.assertEqual('Loop mode is on', true, gs().isLoopModeActive === true);
        // The route starts where the queue ends: after clearQueue the player stands on the start (or on Menu).
        const at0 = gs().getCurrentRegion();
        const route0 = at0 === block.start ? [`${block.start}>${ready.node_id}`] : [`${at0}>${block.start}`, `${block.start}>${ready.node_id}`];
        const r1 = clickCard(ready.node_id);
        tc.log(`click ${ready.name}: ${JSON.stringify(r1)}`);
        tc.assertEqual(`click on ${ready.name}'s card: regionView:regionClicked once`, JSON.stringify([ready.node_id]), JSON.stringify(selected));
        tc.assertEqual(`${ready.name} (unreached by the queue): queued, ok`, true, r1?.ok === true && r1.loopMode === true);
        tc.assertEqual(`${ready.name}: the route from ${at0} to it, queued (the planning source appends in Loop mode)`, JSON.stringify(route0),
            JSON.stringify(movesOf(pathNow())));
        tc.assertEqual(`${ready.name}: ONE act`, 1, actsIn(pathNow(), ready.node_id));
        tc.assertEqual('nothing performed yet (queued only)', 0, countOf(ready.node_id));
        // Again: the queue ends there now — no hop, one more act.
        const r2 = clickCard(ready.node_id);
        tc.assertEqual(`${ready.name} again: no hop, one more act`, true, r2?.ok === true && r2.hops.length === 0 && actsIn(pathNow(), ready.node_id) === 2);
        // Blocked: refused by name, nothing queued.
        const before = JSON.stringify(pathNow());
        const r3 = clickCard(blocked.node_id);
        tc.log(`click ${blocked.name}: ${JSON.stringify(r3)}`);
        const [, need] = Object.entries(blocked.requires.resources)[0];
        tc.assertEqual(`${blocked.name}: refused by name with the unmet requirement`, true,
            r3?.ok === false && r3.code === 'blocked' && r3.text.includes(blocked.name) && r3.text.includes(need.name));
        tc.assertEqual(`${blocked.name}: the queue unchanged`, before, JSON.stringify(pathNow()));
        // Done (at the queue's end): refused by name.
        const r4 = clickCard(ready.node_id);
        tc.assertEqual(`${ready.name} at its limit at the queue's end: refused, done`, true, r4?.ok === false && r4.code === 'done');
        tc.assertEqual('the queue runs', true, await runQueue(tc, 'queue finished'));
        tc.assertEqual('no start-gate refusal', null, loopStateSingleton.lastActionRefusal);
        tc.assertEqual(`${ready.name} performed twice`, 2, countOf(ready.node_id));

        // The Region Map: the same action through the Map's strip (its own settings, CA-S3).
        loopStateSingleton.clearQueue();
        loopStateSingleton._resetLoop();
        if (getRegionMapPanels().length === 0) {
            await panelManager.createPanelForComponent('regionMapPanel', 'Region Map', 2);
            mapOpened = true;
        }
        tc.eventBus.publish('ui:activatePanel', { panelId: 'regionMapPanel' }, 'tests');
        const map = await tc.pollForValue(() => {
            const m = getRegionMapPanels()[0];
            return m?.getDebugState?.()?.hasModel && m.view?.get?.()?.displayGroups?.size ? m : null;
        }, 'the Region Map panel and its model', 10000, 100);
        tc.reportCondition('the Region Map panel opens', !!map);
        if (map) {
            await map.clickActionsReady;
            await ctx.setSetting(REGION_MAP_CLICK_ACTIONS_KEY, ACT_ONLY);
            await tc.pollForCondition(() => JSON.stringify(map.getDebugState().clickActions) === JSON.stringify(ACT_ONLY),
                'the Map holds the row\'s click actions', 5000, 50);
            const key = [...map.view.get().displayGroups].find(([k, g]) => regionOfCell(k, g.members) === once.node_id)?.[0];
            tc.assertEqual(`the Map has a cell for ${once.name}`, true, !!key);
            const click = key ? await map.clickAt({ key }) : null;
            const res = click?.result?.results?.find((x) => x.id === ACT_CLICK_ID)?.result;
            tc.log(`Map click ${once.name}: ${JSON.stringify(res)}`);
            tc.assertEqual(`Map click on ${once.name}: queued the route and ONE act`, true,
                res?.ok === true && res.panelId === 'regionMap' && actsIn(pathNow(), once.node_id) === 1);
        }

        // Outside Loop mode it does what the queue would do, at once.
        loopStateSingleton.clearQueue();
        loopStateSingleton._resetLoop();
        gs().setLoopModeActive(false);
        await tc.pollForCondition(() => gs().isLoopModeActive === false, 'Loop mode off', 3000, 50);
        tc.eventBus.publish('ui:activatePanel', { panelId: 'regionGraphPanel' }, 'tests');
        await tc.pollForCondition(() => !!cardOf(once.node_id), 'the cards are back', 5000, 50);
        const c0 = countOf(once.node_id);
        const mana0 = gs().getCurrentMana();
        const r5 = clickCard(once.node_id);
        tc.log(`click ${once.name} (Loop mode off): ${JSON.stringify(r5)}`);
        tc.assertEqual(`Loop mode off: ${once.name} performed at once`, true, r5?.ok === true && r5.performed === 1 && countOf(once.node_id) === c0 + 1);
        tc.assertEqual(`Loop mode off: the pool paid ${once.name}'s price`, mana0 - once.time, gs().getCurrentMana());
        tc.assertEqual(`Loop mode off: the player stands on ${once.name}`, once.node_id, gs().getCurrentRegion());
        tc.assertEqual('no source but the planning one on the queued hops', true, PLAN_SOURCE_PREFIX === 'actionNodes-plan');
    } finally {
        off?.();
        await ctx.restoreSettings();
        if (mapOpened) {
            try { await panelManager.destroyPanelByComponentType('regionMapPanel'); } catch (e) { tc.log(`close the Map: ${e.message}`); }
        }
        ctx.dispose();
        restore();
    }
    return tc.getOverallResult();
}

// ─── 13. The "perform all remaining" button (AN-3b) ────────────────────────

async function performAllButton(tc) {
    const { block, payloads } = await readPreset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    const restore = freshQueue();
    const fromStart = (p) => p.after.some((set) => set.length === 1 && set[0] === block.start);
    const needsNothing = (p) => !Object.keys(p.requires.resources).length && !Object.keys(p.requires.stats).length;
    const rep = Object.values(payloads).find((p) => fromStart(p) && p.limit > 1 && needsNothing(p));
    const selected = [];
    const off = tc.eventBus.subscribe('regionView:regionClicked', (d) => { if (d?.panelId === 'regionGraph') selected.push(d.regionName); }, 'tests');
    try {
        if (!await graphWithCards(tc, payloads)) return tc.getOverallResult();
        // The button exists exactly on the nodes whose limit is greater than 1 (and are shown, not a placeholder).
        for (const p of Object.values(payloads)) {
            const btn = cardOf(p.node_id)?.querySelector('[data-slot="perform-all-remaining"] button');
            const placeholder = cardOf(p.node_id)?.dataset.state === NODE_STATES.UNDISCOVERED;
            tc.assertEqual(`${p.node_id} (limit ${p.limit}${placeholder ? ', undiscovered' : ''}): a button ${p.limit > 1 && !placeholder ? 'is' : 'is not'} there`,
                p.limit > 1 && !placeholder, !!btn && btn.textContent === PERFORM_ALL_LABEL);
        }
        // Loop mode: the route, then every remaining performance; the button's click is not the node's click.
        const btn = () => cardOf(rep.node_id)?.querySelector('[data-slot="perform-all-remaining"] button');
        const at0 = gs().getCurrentRegion();
        btn()?.click();
        const r = lastPerformResult();
        tc.log(`perform all ${rep.name}: ${JSON.stringify(r)}`);
        tc.assertEqual('the button is not a node click (no regionView:regionClicked)', '[]', JSON.stringify(selected));
        tc.assertEqual(`${rep.name}: queued the route and ${rep.limit} acts`, true,
            r?.ok === true && r.times === 'remaining' && r.hops[0]?.from === at0 && r.hops.at(-1)?.to === rep.node_id
                && movesOf(pathNow()).at(-1) === `${r.hops.at(-1).from}>${rep.node_id}` && actsIn(pathNow(), rep.node_id) === rep.limit);
        const msg = await tc.pollForCondition(() => /×/.test(cardOf(rep.node_id)?.querySelector('.an-card__message')?.textContent ?? ''),
            'the card says what the button did', 3000, 50);
        tc.reportCondition(`the card says what it did ("${cardOf(rep.node_id)?.querySelector('.an-card__message')?.textContent}")`, !!msg);
        // Pressed again: nothing remains at the queue's end → refused by name.
        btn()?.click();
        const again = lastPerformResult();
        tc.assertEqual(`${rep.name} again: refused by name (done at the queue's end)`, true,
            again?.ok === false && again.code === 'done' && again.text.includes(rep.name));
        tc.assertEqual('the queue runs', true, await runQueue(tc, 'queue finished'));
        tc.assertEqual(`${rep.name} performed ${rep.limit} times`, rep.limit, countOf(rep.node_id));

        // Capped by mana (Loop mode): a pool that covers one performance less than the limit.
        loopStateSingleton.clearQueue();
        loopStateSingleton._resetLoop();
        const covers = rep.limit - 1;
        gs().deductMana(gs().getCurrentMana() - (rep.time * covers + 1));
        await tc.pollForCondition(() => Math.abs(gs().getCurrentMana() - (rep.time * covers + 1)) < 1e-9, 'the pool set', 3000, 50);
        btn()?.click();
        const capped = lastPerformResult();
        tc.log(`perform all, capped: ${JSON.stringify(capped)}`);
        tc.assertEqual(`capped by mana: ${covers} of the ${rep.limit} queued, the cap named`, true,
            capped?.ok === true && capped.acts === covers && capped.capped?.by === 'mana' && actsIn(pathNow(), rep.node_id) === covers);
    } finally {
        off?.();
        restore();
    }
    return tc.getOverallResult();
}

// ─── 14. The cards after the Region Graph panel is closed and reopened (AN-3b, limit (a)) ──

async function cardsAfterReopen(tc) {
    const { payloads } = await readPreset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    const ids = Object.keys(payloads);
    const allCards = () => ids.every((id) => cardOf(id));
    if (!await graphWithCards(tc, payloads)) return tc.getOverallResult();
    let reopened = false;
    try {
        await panelManager.destroyPanelByComponentType('regionGraphPanel');
        const gone = await tc.pollForCondition(() => !cyOf() && cards().length === 0, 'the Region Graph panel is closed', 5000, 50);
        tc.reportCondition('the Region Graph panel is closed (no graph, no card)', !!gone);
        await panelManager.createPanelForComponent('regionGraphPanel', 'Region Graph', 2);
        reopened = true;
        tc.eventBus.publish('ui:activatePanel', { panelId: 'regionGraphPanel' }, 'tests');
        // No world load in between: the cards come back from the panel's own mount (regionGraph:panelMounted).
        const back = await tc.pollForCondition(() => !!cyOf() && allCards(), 'the cards are back on the reopened panel', 15000, 100);
        tc.reportCondition(`the reopened panel shows a card per node without a world reload (${cards().length} of ${ids.length})`, !!back);
        tc.assertEqual('… still the same world (no reload)', true, runtime().isLoaded());
        tc.assertEqual('… one card per node, no duplicate', ids.length, cards().length);
    } finally {
        if (!reopened && !cyOf()) {
            try { await panelManager.createPanelForComponent('regionGraphPanel', 'Region Graph', 2); } catch (e) { tc.log(`reopen: ${e.message}`); }
        }
    }
    return tc.getOverallResult();
}

// ─── AN-TIME-2: time in the app (windows, the wait, knowledge, "completed before") ─────────────────

const FIXTURES = './modules/actionNodes/fixtures';
/** The harbour world as the rows play it: the AN-TIME-1 fixture with a pool name (the slice's one format addition). */
const TIME_POOL = Object.freeze({ name: 'Time', unit: 'h' });

/**
 * Compile an AN-TIME-1 fixture in the page (it is a fixture, not a preset: AN-TIME-4 makes the first timed preset) and
 * load it as a rules file. Its "completed before" history is removed first, so the row starts from loop 1.
 */
async function loadFixture(tc, file, extra = {}) {
    const graph = { ...(await (await fetch(`${FIXTURES}/${file}`, { cache: 'no-store' })).json()), ...extra };
    const { rules } = compileActionGraph(graph);
    clearHistoryOf(graph.graph_id);
    // The in-memory load (the editor's and the pipeline's path): Loops reads the embedded loop_costs from the event, so
    // the world comes up in Loop mode as a preset does.
    const loadedEvt = tc.waitForEvent('stateManager:rulesLoaded', 10000);
    tc.eventBus.publish('files:jsonLoaded', { jsonData: rules, selectedPlayerId: P, sourceName: `an-time-fixture-${graph.graph_id}` }, 'tests');
    await loadedEvt;
    await tc.stateManager.pingWorker('after-rules-load', 3000);
    const ok = await tc.pollForCondition(
        () => runtime().isLoaded() && runtime().model.block.graph_id === graph.graph_id && gs()?.isLoopModeActive === true,
        `the runtime holds ${graph.graph_id} and loop mode is on`, 8000, 100);
    if (!ok) {
        tc.log(`DIAG load: runtime loaded ${runtime().isLoaded()} graph ${runtime().model?.block?.graph_id ?? '-'} loopMode `
            + `${gs()?.isLoopModeActive} costs ${centralRegistry.getPublicFunction?.('loops', 'getLoopState')?.()?.costDataManager?.isLoaded?.()}`);
    }
    tc.reportCondition(`the runtime holds ${graph.graph_id} and loop mode is on`, !!ok);
    const payloads = Object.fromEntries(Object.entries(rules.preset_sidecars[P]).map(([k, v]) => [k, v.playable_payload]));
    return ok ? { graph, rules, payloads } : null;
}

/** Remove every saved history of `graphId` (any seed, any slot). */
function clearHistoryOf(graphId) {
    try {
        for (const k of Object.keys(localStorage)) if (k.startsWith(`${HISTORY_STORAGE_PREFIX}${graphId}:`)) localStorage.removeItem(k);
    } catch { /* storage unavailable: nothing saved either */ }
}

const appInventory = (tc) => tc.stateManager.getLatestStateSnapshot()?.inventory ?? {};
const timeLine = () => resourcesPanelModel({
    ledger: getResourceLedger().snapshot(),
    mana: { current: gs().getCurrentMana(), max: gs().getMaxMana() },
    substrates: loadedWorldSubstrates(),
}).manaText;

async function windowAndWait(tc) {
    const loaded = await loadFixture(tc, 'harbour-morning.json', { pool: { ...TIME_POOL } });
    if (!loaded) return tc.getOverallResult();
    const { graph, payloads } = loaded;
    const m = runtime().model;
    const at = (u) => formatClock(m, u);
    const ctx = buildContext({ eventBus: tc.eventBus });
    const restore = freshQueue();
    try {
        if (!await graphWithCards(tc, payloads)) return tc.getOverallResult();
        await ctx.setSetting(GRAPH_CLICK_ACTIONS, ACT_ONLY);
        await tc.pollForCondition(() => graphStrip().includes('perform once'), 'the strip shows "perform once"', 5000, 50);
        const quay = graph.nodes.quay;
        const land = graph.nodes.landlady;
        // The window line and the click text (picture node-cards-window.png), at the loop's start.
        const win = `available ${at(quay.window.from)}–${at(quay.window.until)}`;
        const ok = await tc.pollForCondition(() => textOf(cardOf('quay')).includes(win), 'the quay card shows its window', 5000, 50);
        tc.reportCondition(`${quay.name}: "${win}" (${textOf(cardOf('quay'))})`, !!ok);
        const click = `click: waits ${quay.window.from} ${TIME_POOL.unit} (opens ${at(quay.window.from)}), then ${quay.time} ${TIME_POOL.unit}`;
        tc.assertEqual(`${quay.name}: "${click}"`, true, textOf(cardOf('quay')).includes(click));
        tc.assertEqual(`${land.name}: "available until ${at(land.window.until)}"`, true, textOf(cardOf('landlady')).includes(`available until ${at(land.window.until)}`));
        tc.assertEqual(`${graph.nodes.walk.name}: "any time"`, true, textOf(cardOf('walk')).includes('any time'));
        // The Time line (picture 1), at the start of the loop.
        const day = graph.loop.mana;
        tc.assertEqual('the Resources panel\'s Time line at the loop\'s start',
            `${TIME_POOL.name}: ${at(0)} · ${day} ${TIME_POOL.unit} left · the day ends ${at(day)}`, timeLine());

        // Too late: two walks pass the landlady's window. The card says so, the click is refused, the gate too.
        clickCard('walk');
        clickCard('walk');
        const lateText = `too late: after ${at(land.window.until)} (it is ${at(2 * graph.nodes.walk.time)})`;
        const late = await tc.pollForCondition(() => textOf(cardOf('landlady')).includes(lateText), 'the landlady card: too late', 5000, 50);
        tc.reportCondition(`${land.name} after the queued walks: "${lateText}" (${textOf(cardOf('landlady'))})`, !!late);
        const r = clickCard('landlady');
        tc.assertEqual(`${land.name}: the click is refused by name, too late`, true, r?.ok === false && r.code === 'blocked' && r.text.includes(lateText));
        // A hand-queued act anyway (moves to the node, then the act): the start gate refuses it live (too-late), the walks
        // before it ran.
        let from = 'walk';
        for (const to of hopsBetween(payloads, from, 'landlady')) {
            gs().updatePath(to, `${from} -> ${to}`, from);
            from = to;
        }
        gs().addCustomAction('act', { nodeId: 'landlady', label: land.name, regionName: 'landlady' });
        await runQueue(tc, 'queue stopped');
        tc.assertEqual('the start gate refused the late act: too-late', 'too-late', loopStateSingleton.lastActionRefusal?.code ?? null);
        tc.assertEqual('the gate\'s reason names the clock', true, (loopStateSingleton.lastActionRefusal?.reason ?? '').includes(lateText));
        tc.assertEqual('the two walks ran first', 2, countOf('walk'));

        // One wait performed: a fresh loop; a click on the ferry queues the route, the wait, then the act.
        loopStateSingleton.clearQueue();
        loopStateSingleton._resetLoop();
        await tc.pollForCondition(() => runtime().clock === 0, 'a fresh loop: the clock at 0', 3000, 50);
        const q = clickCard('quay');
        tc.log(`click ${quay.name}: ${JSON.stringify(q)}`);
        const queue = loopStateSingleton.getActionQueue();
        const waitEntry = queue.find((e) => e.actionName === 'wait');
        tc.assertEqual(`${quay.name}: queued, with a wait of ${quay.window.from}`, true, q?.ok === true && q.waited === quay.window.from);
        tc.assertEqual('the wait entry is in the Loops queue, before the act, labelled with the opening',
            `Wait ${quay.window.from} ${TIME_POOL.unit} (opens ${at(quay.window.from)})`, waitEntry?.params?.label ?? null);
        tc.assertEqual('the wait comes before the act', true, queue.indexOf(waitEntry) < queue.findIndex((e) => e.actionName === 'act'));
        const pure = queueEndState(m, runtime().liveViewState(), queue, { costs: runtime().liveCosts() });
        const mana0 = gs().getCurrentMana();
        tc.assertEqual('the queue ran to its end', true, await runQueue(tc, 'queue finished'));
        tc.assertEqual('no start-gate refusal', null, loopStateSingleton.lastActionRefusal);
        tc.assertEqual(`${quay.name} performed once`, 1, countOf('quay'));
        const end = quay.window.from + quay.time;
        tc.assertEqual('the clock: the wait plus the act (live)', end, runtime().clock);
        tc.assertEqual('pure == live: the end of the planned queue\'s clock', pure.state.clock, runtime().clock);
        tc.assertEqual('the pool paid the wait (no region-XP discount) and the act', mana0 - end, gs().getCurrentMana());
        tc.assertEqual('the Time line after the wait and the act',
            `${TIME_POOL.name}: ${at(end)} · ${day - end} ${TIME_POOL.unit} left · the day ends ${at(day)}`, timeLine());
    } finally {
        await ctx.restoreSettings();
        ctx.dispose();
        restore();
        clearHistoryOf(graph.graph_id);
    }
    return tc.getOverallResult();
}

async function knowledgeGate(tc) {
    const loaded = await loadFixture(tc, 'visits-day.json');
    if (!loaded) return tc.getOverallResult();
    const { graph, payloads } = loaded;
    const ctx = buildContext({ eventBus: tc.eventBus });
    const restore = freshQueue();
    const A = graph.knowledge['read-a'].name;
    const D = graph.knowledge['read-d'].name;
    const actD = { type: 'customAction', actionName: 'act', sourceRegion: 'visit-d', params: { nodeId: 'visit-d' } };
    try {
        if (!await graphWithCards(tc, payloads)) return tc.getOverallResult();
        await ctx.setSetting(GRAPH_CLICK_ACTIONS, ACT_ONLY);
        await tc.pollForCondition(() => graphStrip().includes('perform once'), 'the strip shows "perform once"', 5000, 50);
        // Before: Visit A's rule holds (it is reachable from the start), yet the app does NOT hold the flag.
        await tc.stateManager.pingWorker('before the knowledge checks', 3000);
        tc.assertEqual(`the app does not hold "${knowledgeItemNameOf(A)}" before Visit A is performed`, 0, appInventory(tc)[knowledgeItemNameOf(A)] ?? 0);
        const g0 = runtime().gate(actD);
        tc.assertEqual(`the gate refuses ${graph.nodes['visit-d'].name}: "needs to know ${A}"`, true,
            g0.ok === false && g0.code === 'knowledge' && g0.reason === `needs to know ${A}`);
        tc.assertEqual(`${graph.nodes['visit-d'].name}'s card names what it needs to know`, true, textOf(cardOf('visit-d')).includes(`needs to know ${A}`));
        // The teaching node, then the gated one: both queued by a click (at the queue's end A is known).
        const ra = clickCard('visit-a');
        const rd = clickCard('visit-d');
        tc.log(`click A: ${JSON.stringify(ra)} / click D: ${JSON.stringify(rd)}`);
        tc.assertEqual('both clicks queue (D after A: known at the queue\'s end)', true, ra?.ok === true && rd?.ok === true);
        tc.assertEqual('the queue ran to its end', true, await runQueue(tc, 'queue finished'));
        tc.assertEqual('no start-gate refusal', null, loopStateSingleton.lastActionRefusal);
        tc.assertEqual('Visit A and Visit D performed', '1,1', `${countOf('visit-a')},${countOf('visit-d')}`);
        const held = await tc.pollForCondition(() => (appInventory(tc)[knowledgeItemNameOf(A)] ?? 0) === 1
            && (appInventory(tc)[knowledgeItemNameOf(D)] ?? 0) === 1, 'the app holds both flags', 5000, 100);
        tc.reportCondition(`after the performances the app holds "${knowledgeItemNameOf(A)}" and "${knowledgeItemNameOf(D)}"`, !!held);
        tc.assertEqual('the runtime knows them', JSON.stringify(['read-a', 'read-d']), JSON.stringify(runtime().knownIds()));
        // A new loop: the flag is kept, so the gate passes from the loop's start.
        loopStateSingleton.clearQueue();
        loopStateSingleton._resetLoop();
        tc.assertEqual('the next loop: the gate passes from its start (the flag is kept)', true, runtime().gate(actD).ok === true);
    } finally {
        await ctx.restoreSettings();
        ctx.dispose();
        restore();
        clearHistoryOf(graph.graph_id);
    }
    return tc.getOverallResult();
}

async function completedBeforeRow(tc) {
    const loaded = await loadFixture(tc, 'harbour-morning.json', { pool: { ...TIME_POOL } });
    if (!loaded) return tc.getOverallResult();
    const { graph, payloads } = loaded;
    const ctx = buildContext({ eventBus: tc.eventBus });
    const restore = freshQueue();
    try {
        if (!await graphWithCards(tc, payloads)) return tc.getOverallResult();
        await ctx.setSetting(GRAPH_CLICK_ACTIONS, ACT_ONLY);
        await tc.pollForCondition(() => graphStrip().includes('perform once'), 'the strip shows "perform once"', 5000, 50);
        tc.assertEqual('loop 1 at the start', 1, runtime().loopNumber);
        tc.assertEqual('loop 1: no "completed before" mark anywhere', 0, cards().filter((c) => c.querySelector('.an-card__completed-before')).length);
        clickCard('walk');
        tc.assertEqual('the queue ran to its end', true, await runQueue(tc, 'queue finished'));
        tc.assertEqual(`${graph.nodes.walk.name} performed in loop 1`, 1, countOf('walk'));
        tc.assertEqual('loop 1, the node just performed: still no mark (completed THIS loop)', null,
            cardOf('walk')?.querySelector('.an-card__completed-before') ?? null);
        loopStateSingleton.clearQueue();
        loopStateSingleton._resetLoop();
        tc.assertEqual('loop 2 after the reset', 2, runtime().loopNumber);
        const tag = completedBeforeText(1);
        const marked = await tc.pollForCondition(() => textOf(cardOf('walk')).includes(tag), 'the walk card: completed before', 5000, 50);
        tc.reportCondition(`loop 2: ${graph.nodes.walk.name}'s card shows "${tag}" (${textOf(cardOf('walk'))})`, !!marked);
        const others = cards().filter((c) => c.dataset.nodeId !== 'walk' && c.querySelector('.an-card__completed-before'));
        tc.assertEqual('loop 2: no other card is marked', 0, others.length);
        const panel = actionNodesPanelModel({ payload: payloads.walk, runtime: runtime(), loopMode: true });
        tc.assertEqual('the panel lists the set, each entry tagged with its loop',
            JSON.stringify([`${graph.nodes.walk.name} · loop 1`]), JSON.stringify(panel.completedBefore.map((c) => c.text)));
        tc.assertEqual('pure == live: the panel\'s list is the runtime\'s', JSON.stringify(runtime().completedBefore()),
            JSON.stringify(panel.completedBefore.map(({ text, ...c }) => c)));
        const saved = Object.keys(localStorage).filter((k) => k.startsWith(`${HISTORY_STORAGE_PREFIX}${graph.graph_id}:`));
        tc.assertEqual('saved per world under the declared prefix', 1, saved.length);
        tc.assertEqual('the saved set is the runtime\'s', 1, JSON.parse(localStorage.getItem(saved[0]) ?? '{}')?.completed?.walk ?? null);
    } finally {
        await ctx.restoreSettings();
        ctx.dispose();
        restore();
        clearHistoryOf(graph.graph_id);
    }
    return tc.getOverallResult();
}

/**
 * AN-TIME-4: the first timed PRESET (The Same Monday). Every number and name is read from the committed preset: the
 * day is `loop.mana` (not gameState's default 100: AN-TIME-2 § 6), the clock and the pool name from the block, the item
 * gate's stat name from the block's stats.
 */
const SAME_MONDAY_RULES = './presets/action_nodes_same_monday/AP_1/AP_1_rules.json';

async function sameMondayClock(tc) {
    const rules = await (await fetch(SAME_MONDAY_RULES, { cache: 'no-store' })).json();
    const block = rules.action_nodes[P];
    const payloads = Object.fromEntries(Object.entries(rules.preset_sidecars[P]).map(([k, v]) => [k, v.playable_payload]));
    clearHistoryOf(block.graph_id);
    await tc.loadRulesFromFile(SAME_MONDAY_RULES);
    await tc.stateManager.pingWorker('after-rules-load', 3000);
    const ok = await tc.pollForCondition(
        () => runtime().isLoaded() && runtime().model.block.graph_id === block.graph_id && gs()?.isLoopModeActive === true,
        `the runtime holds ${block.graph_id} and loop mode is on`, 8000, 100);
    tc.reportCondition(`the runtime holds ${block.graph_id} and loop mode is on`, !!ok);
    if (!ok) return tc.getOverallResult();
    const restore = freshQueue();
    try {
        const m = runtime().model;
        const at = (u) => formatClock(m, u);
        const { name: pool, unit } = block.pool;
        const day = block.loop.mana;
        const line = (spent) => `${pool}: ${at(spent)} · ${day - spent} ${unit} left · the day ends ${at(day)}`;
        tc.assertEqual('the pool is the graph\'s loop.mana (the day), not the default', day, gs().getMaxMana());
        tc.assertEqual('the pool is full at the loop\'s start', day, gs().getCurrentMana());
        tc.assertEqual('the Time line at the loop\'s start', line(0), timeLine());
        // The item gate: a visit whose paper is not held is refused by the start gate, naming the paper's stat. One hop
        // from the start, so no same-day `after` refuses it first.
        const [gatedId, gatedPayload] = Object.entries(payloads).find(([id, p]) => p.kind === 'check'
            && Object.keys(p.requires?.stats ?? {}).length && hopsBetween(payloads, block.start, id).length === 1);
        const statName = block.stats[Object.keys(gatedPayload.requires.stats)[0]].name;
        const g = runtime().gate({ type: 'customAction', actionName: 'act', sourceRegion: gatedId, params: { nodeId: gatedId } });
        tc.log(`gate ${gatedId}: ${JSON.stringify(g)}`);
        tc.assertEqual(`the gate refuses ${gatedPayload.name}, naming "${statName}"`, true,
            g.ok === false && (g.reason ?? '').includes(statName));
        // One visit from the start: the clock moves by its time and the pool pays it (no region-XP discount).
        const [visitId, visit] = Object.entries(payloads).find(([id, p]) => p.kind === 'check'
            && !Object.keys(p.requires?.stats ?? {}).length && hopsBetween(payloads, block.start, id).length === 1);
        gs().updatePath(visitId, `${block.start} -> ${visitId}`, block.start);
        gs().addCustomAction('act', { nodeId: visitId, label: visit.name, regionName: visitId });
        tc.assertEqual('the queue ran to its end', true, await runQueue(tc, 'queue finished'));
        tc.assertEqual('no start-gate refusal', null, loopStateSingleton.lastActionRefusal);
        tc.assertEqual(`${visit.name} performed once`, 1, countOf(visitId));
        tc.assertEqual('the clock advanced by the visit\'s time', visit.time, runtime().clock);
        tc.assertEqual('the pool paid exactly the visit\'s time', day - visit.time, gs().getCurrentMana());
        tc.assertEqual('the Time line after the visit', line(visit.time), timeLine());
    } finally {
        restore();
        clearHistoryOf(block.graph_id);
    }
    return tc.getOverallResult();
}

const ROWS = [
    ['an-load-and-act-once', 'ActionNodes: load the preset and act once',
        'Loads the example, queues a move and one act, runs the queue: the node is performed once, its result is in the ledger, the pool paid its authored price.', actOnce],
    ['an-refused-action-stops-queue', 'ActionNodes: a backward route reaches the goal; a refused action stops the queue and says which and why',
        '(a) Earns the goal\'s item, then plays the goal\'s witness as a route that moves back to earlier nodes: nothing is refused and the goal is checked. (b) An act with an unmet requirement stops the queue at that entry, names it and the reason, spends nothing.', refusalStops],
    ['an-results-reach-ledger', 'ActionNodes: results reach the ledger',
        'A repeatable node then a node that spends what it earned: every resource in the host ledger is the sum of the results.', resultsReachLedger],
    ['an-loop-reset-restores-boosts', 'ActionNodes: a loop reset restores base plus boosts',
        'Earns a check whose item is a boost, then resets by both flows: the ledger is base plus the boost, the counts are zero, the starting mana is the per-item boost.', resetRestoresBoosts],
    ['an-check-once-action-repeats', 'ActionNodes: a check is sent once, and the action repeats next loop',
        'Runs a route to a check node twice: the check is sent in loop 1 only, the act entries stay in the queue and every one is performed again in loop 2.', checkOnceRepeat],
    ['an-explore-refused', 'ActionNodes: no explore',
        'An explore on an ActionNodes node is refused at queue time and, if it got into the queue, by the start gate, by name; no explore control is drawn for the node.', exploreRefused],
    ['an-discovery-sets', 'ActionNodes: discovery under the actionNodes bundle',
        'The discovered regions, exits and locations at load (the start in full, its neighbours with their contents, their forward exits unnamed), after a first clear, after a loop reset and with Loop mode off.', discoverySetsRow],
    ['an-two-way-move', 'ActionNodes: a move back costs 0 and is not refused; a forward exit of an uncleared node is',
        'Acts once at a repeatable node, moves back to the start and in again (cost 0, not refused), then takes its forward exit: refused by name, not cleared.', twoWayMove],
    ['an-node-states', 'ActionNodes: the node states (ready, blocked, not reached, done, undiscovered)',
        'The state of every node, derived from the preset: at load, at the end of a planned queue (the live counts untouched), after the queue ran (live), and after a loop reset (discovery kept).', nodeStatesRow],
    ['an-node-card', 'ActionNodes: the node card on the Region Graph',
        'The card of an undiscovered node (placeholder only), of a check node played to its check (name, used/limit, mana, needs, the check mark, the reserved slot, no button) and of the goal (the goal mark, its unmet line); then another world loads with its original node sizes and arrows and no card left.', nodeCardRow],
    ['an-click-performs-once', 'ActionNodes: a click performs ONCE (actionNodes.act), on the Region Graph and the Region Map',
        'With only actionNodes.act on in the strip: a click on a ready node\'s card queues the route then ONE act (Loop mode); again, one more act and no hop; a blocked node and a done one are refused by name; the queue runs. On the Region Map the same. With Loop mode off the click performs at once.', clickPerformsOnce],
    ['an-perform-all-button', 'ActionNodes: the "perform all remaining" button',
        'The button exists only on nodes whose limit is greater than 1; it queues the route and every remaining performance, says so on the card, is refused by name when nothing remains, and is capped by mana.', performAllButton],
    ['an-cards-after-reopen', 'ActionNodes: the node cards come back when the Region Graph panel is closed and reopened',
        'Loads the example with the Region Graph open (a card per node), closes the panel, opens a new one: a card per node again, with no world reload (AN-3a\'s pending-slot limit).', cardsAfterReopen],
    ['an-time-window-and-wait', 'ActionNodes time: the window line, too late, and one wait performed',
        'AN-TIME-2 over the harbour fixture (compiled in the page, a pool named Time): each card\'s window line and the early card\'s click text; the Resources Time line; two walks make the landlady too late (the card, the click and the start gate say so); a click on the ferry queues the route, a wait and the act; it runs, the clock advances by the wait and the act (pure == live) and the pool pays both.', windowAndWait],
    ['an-time-knowledge-gate', 'ActionNodes time: the knowledge gate refuses, then passes after the teaching node',
        'AN-TIME-2 over the visits fixture: before Visit A is performed the app does NOT hold its Knows: flag and the gate refuses Visit D ("needs to know Paper A"); a click on A then D queues both; after they run the app holds both flags; the next loop the gate passes from its start.', knowledgeGate],
    ['an-time-completed-before', 'ActionNodes time: "completed before" in loop 2, tagged loop 1',
        'AN-TIME-2 (Robert\'s Q6, minimal form): a node performed in loop 1 shows no mark in loop 1 and "completed before · loop 1" in loop 2; no other card is marked; the panel lists the set tagged by loop; it is saved per world under the declared prefix.', completedBeforeRow],
    ['an-same-monday-clock', 'ActionNodes time: The Same Monday preset loads with its day as the pool and the clock line',
        'AN-TIME-4: loads the committed timed preset: the pool is the graph\'s loop.mana (3 h, not 100), the Resources Time line reads the clock at the start, the start gate refuses a visit whose paper is not held (naming it), and one visit moves the clock and the pool by its time.', sameMondayClock],
];

for (const [id, name, description, testFunction] of ROWS) {
    registerTest({ id, name, description, testFunction, category: CATEGORY, enabled: false });
}

registerTest({
    id: 'an-bot-plays-to-goal',
    name: 'Playback Bot: the ActionNodes example to the goal in Loop mode, with its reasoning',
    description: 'Loads the example and presses the bot\'s Play with "log reasoning" on: the runner asks the ActionNodes '
        + 'entry\'s loopBot.planLoop for each loop, writes it as the Loops queue (free hops + acts) and plays it until the '
        + 'goal is checked. Every loop\'s reason is in the log; the loop count is the headless live path\'s and (AN-3b: the '
        + 'runner replans mid-loop when an item arrives) the pure planner\'s.',
    testFunction: botPlaysToGoal,
    category: 'Playback Bot',
    enabled: false,
});
