/**
 * The ActionNodes runtime (slice AN-2) against the COMMITTED example preset: the start gate, one performance, the
 * ledger, boosts (A4) at once and on every loop, both resets, the check sent once, discovery on the first clear, and
 * outside-Loop-mode play charging the shared pool.
 *
 * Every number is read from the preset (its block and payloads), never typed here.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ActionNodesRuntime, runtimeModelOf, perItemManaTableOf, RUNTIME_REFUSALS } from './actionNodesRuntime.js';
import { ResourceLedger } from '../resourceChannels/resourceLedger.js';
import { GameState } from '../gameState/state.js';
import { ACT_ACTION } from './actionGraphCompiler.js';
import { ACT_ACTION as TABLE_ACT } from '../shared/procgen/loopCustomActions.js';
import { substrateRegistryEntry } from './actionNodesLibrary.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRESET = join(HERE, '../../presets/action_nodes_example/AP_1/AP_1_rules.json');
const RULES = JSON.parse(readFileSync(PRESET, 'utf8'));
const P = '1';
const BLOCK = RULES.action_nodes[P];
const PAYLOADS = Object.fromEntries(Object.entries(RULES.preset_sidecars[P]).map(([k, v]) => [k, v.playable_payload]));
const nodeByKind = (kind) => Object.values(PAYLOADS).find((p) => p.kind === kind);
/** A node whose results add a resource and whose limit is above 1 (the example's Do Chores). */
const REPEATABLE = Object.values(PAYLOADS).find((p) => p.limit > 1 && Object.keys(p.results.resources).length);
const firstAmount = (named) => Object.entries(named)[0];

function makeEnv() {
    const bus = { events: [], publish(name, data) { this.events.push({ name, data }); }, subscribe: () => () => {} };
    const gs = new GameState(bus);
    const ledger = new ResourceLedger();
    const dispatched = [];
    const revealed = [];
    const charged = [];
    let resets = 0;
    const env = {
        publish: (e, d) => bus.publish(e, d),
        dispatch: (e, d) => dispatched.push({ event: e, data: d }),
        revealExits: (regionName, exitNames) => revealed.push({ regionName, exitNames }),
        gameState: () => gs,
        ledger: () => ledger,
        chargeMana: ({ amount, regionId }) => {
            gs.deductMana(amount);
            charged.push({ amount, regionId });
            return { charged: true, depleted: gs.getCurrentMana() <= 0 };
        },
        gainMana: ({ amount }) => gs.gainMana(amount),
        xpAdjustedCost: (base) => base,
        fireReset: () => { resets += 1; gs.triggerLoopReset(); },
    };
    return { env, gs, ledger, dispatched, revealed, charged, bus, resets: () => resets };
}

describe('the ActionNodes runtime on the committed example', () => {
    let rt, e;
    beforeEach(() => {
        e = makeEnv();
        rt = new ActionNodesRuntime(e.env);
        expect(rt.loadWorld(RULES, P)).toBe(true);
        rt.onSnapshot({ inventory: {}, checkedLocations: [] });
    });

    it('the verb name is one constant across the compiler, the Loops table and the registry entry', () => {
        expect(ACT_ACTION).toBe(TABLE_ACT);
        expect(substrateRegistryEntry.loopSupport.queueActions).toContain(ACT_ACTION);
        expect(BLOCK.action).toBe(ACT_ACTION);
    });

    it('loads the world: every payload becomes a node, the ledger is configured with the block\'s ids at 0', () => {
        expect(rt.model.nodeIds.sort()).toEqual(Object.keys(PAYLOADS).sort());
        const snap = e.ledger.snapshot();
        expect(snap.owner).toBe('action_nodes');
        expect(Object.keys(snap.stats).sort()).toEqual(Object.keys(BLOCK.stats).sort());
        expect(Object.keys(snap.resources).sort()).toEqual(Object.keys(BLOCK.resources).sort());
        expect(Object.values(snap.stats).every((v) => v === 0)).toBe(true);
        expect(Object.values(snap.resources).every((v) => v === 0)).toBe(true);
    });

    it('a document without an action_nodes block unloads the runtime and clears the ledger and the mana table', () => {
        expect(e.gs.getPerItemManaTable()).not.toBeNull();
        expect(rt.loadWorld({ regions: {} }, P)).toBe(false);
        expect(rt.isLoaded()).toBe(false);
        expect(e.ledger.isConfigured()).toBe(false);
        expect(e.gs.getPerItemManaTable()).toBeNull();
    });

    it('the start gate: an act is refused until its node is reached, then allowed', () => {
        const gated = Object.values(PAYLOADS).find((p) => p.kind !== 'start' && !p.after.some((s) => s.includes(BLOCK.start)));
        const v = rt.gate({ type: 'customAction', actionName: 'act', sourceRegion: gated.node_id, params: { nodeId: gated.node_id } });
        expect(v.ok).toBe(false);
        expect(v.code).toBe('not-reached');
        const open = REPEATABLE;
        expect(rt.gate({ type: 'customAction', actionName: 'act', sourceRegion: open.node_id, params: {} }).ok).toBe(true);
    });

    it('the start gate: an act naming another node than its region is refused by name', () => {
        const v = rt.gate({ type: 'customAction', actionName: 'act', sourceRegion: BLOCK.start, params: { nodeId: REPEATABLE.node_id } });
        expect(v).toMatchObject({ ok: false, code: RUNTIME_REFUSALS.wrongRegion });
    });

    it('the start gate: a FORWARD move out of a node is refused until it is cleared (limit performances); the start is open', () => {
        const fwd = (from) => {
            const exit = PAYLOADS[from].exits.find((x) => !x.reverse);
            return rt.gate({ type: 'regionMove', sourceRegion: from, destinationRegion: exit.targetRegion, exitUsed: exit.exitName });
        };
        expect(fwd(BLOCK.start).ok).toBe(true);
        expect(fwd(REPEATABLE.node_id)).toMatchObject({ ok: false, code: RUNTIME_REFUSALS.notCleared });
        for (let k = 0; k < REPEATABLE.limit; k++) {
            expect(fwd(REPEATABLE.node_id).ok).toBe(false);
            expect(rt.perform(REPEATABLE.node_id).ok).toBe(true);
        }
        expect(fwd(REPEATABLE.node_id).ok).toBe(true);
        // a region of no ActionNodes node is not this runtime's to refuse (Menu)
        expect(rt.gate({ type: 'regionMove', sourceRegion: 'Menu', destinationRegion: BLOCK.start }).ok).toBe(true);
    });

    it('⛓ the start gate: a REVERSE move is open at once (its target was reached this loop), whatever the node\'s count', () => {
        const back = REPEATABLE.exits.find((x) => x.reverse);
        expect(back).toBeTruthy();
        expect(rt.counts[rt.nodeIndex(REPEATABLE.node_id)]).toBe(0);
        // by exit name, and by destination alone (a move that names no exit)
        expect(rt.gate({ type: 'regionMove', sourceRegion: REPEATABLE.node_id, destinationRegion: back.targetRegion, exitUsed: back.exitName }).ok).toBe(true);
        expect(rt.gate({ type: 'regionMove', sourceRegion: REPEATABLE.node_id, destinationRegion: back.targetRegion }).ok).toBe(true);
    });

    it('⛓ every reverse exit of every node reached this loop is open: a path between reached nodes is never refused', () => {
        // Clear every node the empty-handed loop can clear, in an order the after sets allow, then walk every reverse
        // exit of every reached node, and every forward exit of every cleared node.
        let progressed = true;
        while (progressed) {
            progressed = false;
            for (const p of Object.values(PAYLOADS)) {
                while (!rt.isCleared(p.node_id) && !rt.whyNotAct(p.node_id)) { rt.perform(p.node_id); progressed = true; }
            }
        }
        const reached = Object.keys(PAYLOADS).filter((id) => rt.isReached(id));
        expect(reached.length).toBeGreaterThan(2);
        for (const id of reached) {
            for (const x of PAYLOADS[id].exits) {
                const v = rt.gate({ type: 'regionMove', sourceRegion: id, destinationRegion: x.targetRegion, exitUsed: x.exitName });
                if (x.reverse) expect(v.ok, x.exitName).toBe(true);
                else expect(v.ok, x.exitName).toBe(rt.isCleared(id));
            }
        }
    });

    it('a reverse move to a node NOT reached this loop is refused by name (a multi-set node reached the other way)', () => {
        // A copy of the world with one reverse exit pointing at a node that is not reached: the rule is "target reached".
        const node = Object.values(PAYLOADS).find((p) => p.exits.some((x) => x.reverse) && p.after.length);
        const unreached = Object.values(PAYLOADS).find((p) => !p.after.some((s) => s.includes(BLOCK.start)) && p.kind !== 'start');
        const rules = structuredClone(RULES);
        rules.preset_sidecars[P][node.node_id].playable_payload.exits.push({ exit_id: unreached.node_id, exitName: 'odd', targetRegion: unreached.node_id, reverse: true });
        const rt2 = new ActionNodesRuntime(makeEnv().env);
        rt2.loadWorld(rules, P);
        expect(rt2.gate({ type: 'regionMove', sourceRegion: node.node_id, destinationRegion: unreached.node_id, exitUsed: 'odd' }))
            .toMatchObject({ ok: false, code: RUNTIME_REFUSALS.targetNotReached });
    });

    it('reachability resets with the loop: after a reset a cleared node\'s forward exit is refused again', () => {
        const exit = REPEATABLE.exits.find((x) => !x.reverse);
        const move = { type: 'regionMove', sourceRegion: REPEATABLE.node_id, destinationRegion: exit.targetRegion, exitUsed: exit.exitName };
        for (let k = 0; k < REPEATABLE.limit; k++) rt.perform(REPEATABLE.node_id);
        expect(rt.gate(move).ok).toBe(true);
        rt.onLoopReset('test');
        expect(rt.gate(move)).toMatchObject({ ok: false, code: RUNTIME_REFUSALS.notCleared });
    });

    it('⚖ D6: the start gate refuses an explore (any custom action but act) on a node, by name', () => {
        for (const node of [BLOCK.start, REPEATABLE.node_id]) {
            const v = rt.gate({ type: 'customAction', actionName: 'explore', sourceRegion: node, params: {} });
            expect(v).toMatchObject({ ok: false, code: 'action-not-offered' });
            expect(v.reason).toContain("no 'explore' action");
        }
    });

    it('a performance puts its results in the ledger; the limit refuses one more, by name', () => {
        const [res, amount] = firstAmount(REPEATABLE.results.resources);
        for (let k = 1; k <= REPEATABLE.limit; k++) {
            rt.perform(REPEATABLE.node_id);
            expect(e.ledger.getResource(res)).toBe(amount.amount * k);
        }
        const again = rt.perform(REPEATABLE.node_id);
        expect(again).toMatchObject({ ok: false, code: 'limit' });
    });

    it('a requirement not met is refused with its numbers', () => {
        const needy = Object.values(PAYLOADS).find((p) => Object.keys(p.requires.resources).length && p.after.some((s) => s.includes(REPEATABLE.node_id)));
        for (let k = 0; k < REPEATABLE.limit; k++) rt.perform(REPEATABLE.node_id);
        const [rid, need] = firstAmount(needy.requires.resources);
        e.ledger.resetRun({}); // spend it all: nothing held
        const v = rt.gate({ type: 'customAction', actionName: 'act', sourceRegion: needy.node_id, params: {} });
        expect(v.ok).toBe(false);
        expect(v.code).toBe('resource');
        expect(v.reason).toContain(`${need.name} ${need.amount}`);
        expect(rid in BLOCK.resources).toBe(true);
    });

    it('the first clear REVEALS the node\'s forward exits, once; a loop reset does not re-reveal; no explore is published (D6)', () => {
        for (let k = 0; k < REPEATABLE.limit; k++) {
            expect(e.revealed).toHaveLength(0); // not before the node is cleared
            rt.perform(REPEATABLE.node_id);
        }
        expect(e.revealed).toHaveLength(1);
        expect(e.revealed[0].regionName).toBe(REPEATABLE.node_id);
        expect(e.revealed[0].exitNames.sort()).toEqual(REPEATABLE.exits.filter((x) => !x.reverse).map((x) => x.exitName).sort());
        rt.onLoopReset('loopState:loopReset');
        for (let k = 0; k < REPEATABLE.limit; k++) rt.perform(REPEATABLE.node_id);
        expect(e.revealed).toHaveLength(1);
        expect(e.dispatched.some((d) => d.event === 'loop:exploreCompleted')).toBe(false);
    });

    it('a check is sent ONCE; the action repeats in the next loop without it (A15)', () => {
        const check = nodeByKind('check');
        // reach it: perform its predecessors along one after set, as many times as each limit
        const reach = (id, seen = new Set()) => {
            const p = PAYLOADS[id];
            if (p.kind === 'start' || seen.has(id)) return;
            seen.add(id);
            for (const pre of p.after[0]) reach(pre, seen);
            for (let k = 0; k < p.limit; k++) rt.perform(id);
        };
        // the requirement it has (if any) is met by a boost-free route in the example (AN-1 logic: True)
        const doCheck = () => {
            for (const pre of check.after[0]) reach(pre);
            return rt.perform(check.node_id, { fromLoop: true });
        };
        const r1 = doCheck();
        expect(r1.ok).toBe(true);
        expect(r1.checkSent).toBe(check.location);
        const sends = () => e.dispatched.filter((d) => d.event === 'user:locationCheck');
        expect(sends()).toHaveLength(1);
        expect(sends()[0].data).toEqual({ locationName: check.location, regionName: check.node_id, fromLoop: true });
        rt.onLoopReset('gameState:loopReset');
        const r2 = doCheck();
        expect(r2.ok).toBe(true);
        expect(r2.checkSent).toBeNull();
        expect(sends()).toHaveLength(1);
    });

    it('both reset events restore the ledger to its base plus every held boost', () => {
        const boost = Object.entries(BLOCK.boosts).find(([, b]) => Object.keys(b.resources).length);
        const [item, b] = boost;
        const [rid, n] = Object.entries(b.resources)[0];
        rt.onSnapshot({ inventory: { [item]: 1 }, checkedLocations: [] });
        expect(e.ledger.getResource(rid)).toBe(n); // at once (A4)
        for (let k = 0; k < REPEATABLE.limit; k++) rt.perform(REPEATABLE.node_id);
        for (const source of ['gameState:loopReset', 'loopState:loopReset']) {
            rt.onLoopReset(source);
            const snap = e.ledger.snapshot();
            for (const id of Object.keys(BLOCK.resources)) expect(snap.resources[id]).toBe(id === rid ? n : 0);
            for (const id of Object.keys(BLOCK.stats)) expect(snap.stats[id]).toBe(0);
            expect(rt.counts.filter((c, i) => i !== rt.model.startIndex).every((c) => c === 0)).toBe(true);
        }
    });

    it('a boost received mid-loop applies at once; its stat counts toward a requirement in the same loop', () => {
        const [item, b] = Object.entries(BLOCK.boosts).find(([, x]) => Object.keys(x.stats).length);
        const [sid, n] = Object.entries(b.stats)[0];
        expect(e.ledger.getStat(sid)).toBe(0);
        rt.onSnapshot({ inventory: { [item]: 1 }, checkedLocations: [] });
        expect(e.ledger.getStat(sid)).toBe(n);
        // the same count again changes nothing
        rt.onSnapshot({ inventory: { [item]: 1 }, checkedLocations: [] });
        expect(e.ledger.getStat(sid)).toBe(n);
    });

    it('the FIRST snapshot after a load is the baseline: held boosts are in the start, nothing is gained twice', () => {
        const [item, b] = Object.entries(BLOCK.boosts).find(([, x]) => Object.keys(x.resources).length);
        const [rid, n] = Object.entries(b.resources)[0];
        const f = makeEnv();
        const r = new ActionNodesRuntime(f.env);
        r.loadWorld(RULES, P);
        const mana = f.gs.getCurrentMana();
        r.onSnapshot({ inventory: { [item]: 2 }, checkedLocations: [] });
        expect(f.ledger.getResource(rid)).toBe(2 * n);
        expect(f.gs.getCurrentMana()).toBe(mana);
    });

    it('⛓ a baseline that arrives AFTER a performance keeps the loop and applies what is held at once (AN-3a)', () => {
        // Found in-app: no snapshot came between the load and a check, so the check's own snapshot was the baseline,
        // and restarting the loop there wiped the counts mid-loop and swallowed the item's boost.
        const [item, b] = Object.entries(BLOCK.boosts).find(([, x]) => Object.keys(x.resources).length);
        const [rid, n] = Object.entries(b.resources)[0];
        const f = makeEnv();
        const r = new ActionNodesRuntime(f.env);
        r.loadWorld(RULES, P);
        expect(r.perform(REPEATABLE.node_id).ok).toBe(true);
        const [res, got] = Object.entries(REPEATABLE.results.resources)[0];
        r.onSnapshot({ inventory: { [item]: 1 }, checkedLocations: [] });
        expect(r.counts[r.nodeIndex(REPEATABLE.node_id)]).toBe(1);
        const want = (rid === res ? got.amount : 0) + n;
        expect(f.ledger.getResource(rid)).toBe(want);
        // and the next snapshot with the same count changes nothing
        r.onSnapshot({ inventory: { [item]: 1 }, checkedLocations: [] });
        expect(f.ledger.getResource(rid)).toBe(want);
    });

    it('per-item starting mana: the block\'s boosts replace the flat term while the world is loaded', () => {
        const table = perItemManaTableOf(BLOCK);
        expect(Object.keys(table).sort()).toEqual(Object.keys(BLOCK.boosts).sort());
        const inv = Object.fromEntries(Object.keys(BLOCK.boosts).map((k) => [k, 1]));
        e.gs.recalculateMaxMana({ inventory: inv });
        const expected = e.gs.defaultMaxMana + Object.values(BLOCK.boosts).reduce((a, x) => a + x.mana, 0);
        expect(e.gs.getMaxMana()).toBe(expected);
    });

    it('a boost that gives mana gains it at once mid-loop (A4); with the default 10 per item', () => {
        const rules = structuredClone(RULES);
        const [item] = Object.keys(rules.action_nodes[P].boosts);
        delete rules.action_nodes[P].boosts[item].mana; // no row value: the block's default applies
        const f = makeEnv();
        const r = new ActionNodesRuntime(f.env);
        r.loadWorld(rules, P);
        r.onSnapshot({ inventory: {}, checkedLocations: [] });
        const before = f.gs.getCurrentMana();
        r.onSnapshot({ inventory: { [item]: 1 }, checkedLocations: [] });
        expect(f.gs.getCurrentMana()).toBe(before + rules.action_nodes[P].mana_per_item_default);
        f.gs.recalculateMaxMana({ inventory: { [item]: 1 } });
        expect(f.gs.getMaxMana()).toBe(f.gs.defaultMaxMana + rules.action_nodes[P].mana_per_item_default);
    });

    it('outside Loop mode, actNow charges the pool its price and performs', () => {
        const before = e.gs.getCurrentMana();
        const r = rt.actNow(REPEATABLE.node_id);
        expect(r.completed).toBe(true);
        expect(e.gs.getCurrentMana()).toBe(before - REPEATABLE.time);
        expect(e.charged).toEqual([{ amount: REPEATABLE.time, regionId: REPEATABLE.node_id }]);
    });

    it('outside Loop mode, short of mana: what is left is spent, the action does not complete, the loop resets (Q1)', () => {
        e.gs.currentMana = REPEATABLE.time / 2;
        const r = rt.actNow(REPEATABLE.node_id);
        expect(r).toMatchObject({ ok: false, completed: false, code: 'mana' });
        expect(e.resets()).toBe(1);
        expect(e.ledger.getResource(firstAmount(REPEATABLE.results.resources)[0])).toBe(0);
    });

    it('Loops\' loop:actionCompleted performs the node named by the entry', () => {
        const r = rt.onActionCompleted({ actionName: 'act', regionName: REPEATABLE.node_id, params: { nodeId: REPEATABLE.node_id } });
        expect(r.ok).toBe(true);
        expect(rt.counts[rt.nodeIndex(REPEATABLE.node_id)]).toBe(1);
        expect(rt.onActionCompleted({ actionName: 'explore', regionName: REPEATABLE.node_id })).toBeNull();
    });

    it('a cross-substrate grant of one of its resources lands in the ledger; other targets are ignored', () => {
        const rid = Object.keys(BLOCK.resources)[0];
        rt.onItemGranted({ to: 'action_nodes', itemType: rid, count: 2 });
        rt.onItemGranted({ to: 'maze', itemType: rid, count: 5 });
        expect(e.ledger.getResource(rid)).toBe(2);
    });

    it('runtimeModelOf refuses a block whose start has no payload', () => {
        expect(() => runtimeModelOf({ ...BLOCK, start: 'nowhere' }, PAYLOADS)).toThrow(/start node 'nowhere'/);
    });
});
