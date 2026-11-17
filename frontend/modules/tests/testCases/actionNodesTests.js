/**
 * In-app rows for the ActionNodes runtime (slice AN-2), category "ActionNodes", in batch `fast`.
 *
 * Every row loads the committed example preset itself, sets its own queue, speed and flags, and puts them back. The
 * numbers it checks (prices, results, which item a check holds) are read from the preset, never typed here.
 *
 * ⚠ The compiled example has forward exits only (one per `after` edge), so every queue here is a forward route from
 * the start node.
 */

import { registerTest } from '../testRegistry.js';
import { getGameStateSingleton } from '../../gameState/singleton.js';
import loopStateSingleton from '../../loops/loopStateSingleton.js';
import { getActionNodesRuntime } from '../../actionNodes/actionNodesRuntime.js';
import { getResourceLedger } from '../../resourceChannels/resourceChannelsLibrary.js';
import { DEFAULT_EXPLORE_MULTIPLIER } from '../../shared/procgen/loopCostDefaults.js';

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
 * Author a forward route as queue entries. `steps`: node ids to move to, or `{act: nodeId, times}`.
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
        // (a) a move out of a node that is not cleared yet (its limit is above 1, performed once)
        const multi = Object.values(payloads).find((p) => p.limit > 1 && p.exits.length);
        const next = multi.exits[0].targetRegion;
        author(payloads, routeFrom(block, [multi.node_id, { act: multi.node_id }, next]));
        await runQueue(tc, 'the queue stopped (move refusal)');
        const r1 = loopStateSingleton.lastActionRefusal;
        tc.log(`refusal: ${JSON.stringify(r1)}`);
        tc.assertEqual('the queue stopped on a refusal', true, !!r1);
        tc.assertEqual('it names the move', `Move to ${next}`, r1?.label);
        tc.assertEqual('…in the region it leaves', multi.node_id, r1?.region);
        tc.assertEqual('…and why: not cleared', 'not-cleared', r1?.code);
        tc.assertEqual('the reason states the count', true, String(r1?.reason).includes(`(1/${multi.limit})`));
        tc.assertEqual('the move did not happen', multi.node_id, gs().getCurrentRegion());
        tc.assertEqual('the refused entry was not skipped', r1?.index, loopStateSingleton.currentActionIndex);
        tc.assertEqual('the loops public function reports it', r1?.label,
            tc.centralRegistry?.getPublicFunction?.('loops', 'getLastActionRefusal')?.()?.label ?? r1?.label);
        const banner = document.querySelector('#loop-state-banner');
        if (banner && banner.style.display !== 'none') {
            tc.assertEqual('the Loops panel banner names the action', true, banner.textContent.includes(`Move to ${next}`));
        }
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

// ─── 6. An explore behaves as before ───────────────────────────────────────

async function exploreUnchanged(tc) {
    const { block, payloads } = await readPreset();
    if (!await loadExample(tc)) return tc.getOverallResult();
    const restore = freshQueue();
    let acts = 0;
    const offAct = tc.eventBus.subscribe('loop:actionCompleted', () => { acts += 1; }, 'tests');
    const explores = [];
    const offDone = tc.eventBus.subscribe('loopState:actionCompleted', ({ action }) => {
        if (action?.type === 'customAction') explores.push(action.actionName);
    }, 'tests');
    try {
        const node = Object.values(payloads).find((p) => p.kind !== 'start' && p.after.some((s) => s.includes(block.start)));
        author(payloads, routeFrom(block, [node.node_id]));
        gs().addCustomAction('explore', { regionName: node.node_id });
        const entry = loopStateSingleton.getActionQueue().find((a) => a.actionName === 'explore');
        tc.assertEqual('the explore entry is in the queue', true, !!entry);
        const cdm = loopStateSingleton.costDataManager;
        tc.assertEqual('an explore still prices at the move cost × the explore multiplier',
            cdm.getRegionCost(node.node_id) * DEFAULT_EXPLORE_MULTIPLIER, loopStateSingleton._calculateActionCost(entry));
        tc.assertEqual('…labelled as an explore', `Explore ${node.node_id}`,
            loopStateSingleton._describeQueueEntry(entry));
        tc.assertEqual('the queue ran to its end', true, await runQueue(tc, 'queue finished'));
        tc.assertEqual('the start gate let the explore through', null, loopStateSingleton.lastActionRefusal);
        tc.assertEqual('the explore completed as an explore', JSON.stringify(['explore']), JSON.stringify(explores));
        tc.assertEqual('it published no act completion', 0, acts);
        tc.assertEqual('…and performed no node', 0, countOf(node.node_id));
    } finally {
        try { offAct?.(); } catch { /* ignore */ }
        try { offDone?.(); } catch { /* ignore */ }
        restore();
    }
    return tc.getOverallResult();
}

const ROWS = [
    ['an-load-and-act-once', 'ActionNodes: load the preset and act once',
        'Loads the example, queues a move and one act, runs the queue: the node is performed once, its result is in the ledger, the pool paid its authored price.', actOnce],
    ['an-refused-action-stops-queue', 'ActionNodes: a refused action stops the queue and says which and why',
        'A move out of a node not cleared yet, and an act with an unmet requirement: each stops the queue at that entry, names it and the reason, spends nothing.', refusalStops],
    ['an-results-reach-ledger', 'ActionNodes: results reach the ledger',
        'A repeatable node then a node that spends what it earned: every resource in the host ledger is the sum of the results.', resultsReachLedger],
    ['an-loop-reset-restores-boosts', 'ActionNodes: a loop reset restores base plus boosts',
        'Earns a check whose item is a boost, then resets by both flows: the ledger is base plus the boost, the counts are zero, the starting mana is the per-item boost.', resetRestoresBoosts],
    ['an-check-once-action-repeats', 'ActionNodes: a check is sent once, and the action repeats next loop',
        'Runs a route to a check node twice: the check is sent in loop 1 only, the act entries stay in the queue and every one is performed again in loop 2.', checkOnceRepeat],
    ['an-explore-unchanged', 'ActionNodes: an explore behaves as before',
        'An explore entry on an ActionNodes node prices at move × multiplier, passes the start gate, completes as an explore and performs no node.', exploreUnchanged],
];

for (const [id, name, description, testFunction] of ROWS) {
    registerTest({ id, name, description, testFunction, category: CATEGORY, enabled: false });
}
