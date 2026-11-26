/**
 * AN-TIME-2: time in the ActionNodes APP — the runtime's clock, windows and knowledge, the `wait` queue entry, the
 * clock and pool-name labels, and the minimal "completed before" history (⚖ Robert's Q6). Over the AN-TIME-1 fixtures
 * (`fixtures/harbour-morning.json`, `fixtures/visits-day.json`), compiled here; the harbour world is given a pool name
 * ("Time", unit "h") in a COPY, so AN-TIME-1's own text pins keep their fixture.
 *
 * The knowledge-gap pin runs the REAL state manager in node: a `Knows:` event location is not collected on reach
 * (`event_kind: 'substrate_state'`), the runtime collects it on perform, and a /sync full reset keeps it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ActionNodesRuntime, runtimeModelOf, RUNTIME_REFUSALS, historyKeyOf } from './actionNodesRuntime.js';
import { compileActionGraph, KNOWLEDGE_EVENT_KIND } from './actionGraphCompiler.js';
import { validateActionGraph, knowledgeItemNameOf, knowledgeLocationNameOf, ACTION_GRAPH_REFUSALS } from './actionGraph.js';
import { buildActionModel, loopStartState, whyNot, formatClock, applyWait } from './actionModel.js';
import { planPerform } from './nodePerformPlan.js';
import { performNode } from './nodeClickAction.js';
import { queueEndState } from './nodeStates.js';
import { planLiveLoop } from './actionLoopBot.js';
import { nodeCardModel, windowText, completedBeforeText } from './nodeCard.js';
import { createHistoryStore, HISTORY_STORAGE_PREFIX } from './historyStore.js';
import { substrateRegistryEntry } from './actionNodesLibrary.js';
import { ResourceLedger } from '../resourceChannels/resourceLedger.js';
import { GameState } from '../gameState/state.js';
import { resourcesPanelModel } from '../resourceChannels/resourcesPanel.js';
import { poolOfWorld, poolAmount } from '../resourceChannels/poolName.js';
import { WAIT_ACTION, ACT_ACTION } from '../shared/procgen/loopCustomActions.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(HERE, f), 'utf8'));
const HARBOUR = load('fixtures/harbour-morning.json');
const VISITS = load('fixtures/visits-day.json');
const POOL = Object.freeze({ name: 'Time', unit: 'h' });
const HARBOUR_TIMED = { ...HARBOUR, pool: { ...POOL } };
const P = '1';

const compiled = (graph) => compileActionGraph(graph).rules;
const HARBOUR_RULES = compiled(HARBOUR_TIMED);
const VISITS_RULES = compiled(VISITS);
const payloadsOf = (rules) => Object.fromEntries(Object.entries(rules.preset_sidecars[P]).map(([k, v]) => [k, v.playable_payload]));

function makeEnv({ storage = null } = {}) {
    const bus = { events: [], publish(name, data) { this.events.push({ name, data }); }, subscribe: () => () => {} };
    const gs = new GameState(bus);
    const ledger = new ResourceLedger();
    const collected = [];
    const charged = [];
    const env = {
        publish: (e, d) => bus.publish(e, d),
        dispatch: () => {},
        revealExits: () => {},
        gameState: () => gs,
        ledger: () => ledger,
        chargeMana: ({ amount }) => {
            gs.deductMana(amount);
            charged.push(amount);
            return { charged: true, depleted: gs.getCurrentMana() <= 0 };
        },
        gainMana: ({ amount }) => gs.gainMana(amount),
        xpAdjustedCost: (base) => base,
        fireReset: () => gs.triggerLoopReset(),
        collectEvent: (name) => collected.push(name),
        historyStore: storage ? createHistoryStore(storage) : undefined,
    };
    return { env, gs, ledger, collected, charged };
}

/** A runtime holding `rules`, the pool at `mana`. */
function runtimeOf(rules, { mana = rules.action_nodes[P].loop.mana, storage = null } = {}) {
    const e = makeEnv({ storage });
    const rt = new ActionNodesRuntime(e.env);
    expect(rt.loadWorld(rules, P)).toBe(true);
    rt.onSnapshot({ inventory: {}, checkedLocations: [] });
    e.gs.maxMana = mana;
    e.gs.currentMana = mana;
    return { rt, ...e };
}

/** An in-memory localStorage. */
function memoryStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), keys: () => [...m.keys()] };
}

/** Loops ran an `act` for `nodeId` (the pool already charged by the queue). */
const loopAct = (rt, nodeId) => rt.onActionCompleted({ actionName: ACT_ACTION, regionName: nodeId, params: { nodeId } });
const loopWait = (rt, nodeId, units) => rt.onActionCompleted({ actionName: WAIT_ACTION, regionName: nodeId, params: { nodeId, units } });
const actEntry = (nodeId) => ({ type: 'customAction', actionName: ACT_ACTION, sourceRegion: nodeId, params: { nodeId } });

describe('the runtime model reads windows, the clock, knowledge and the pool from the compiled world', () => {
    it('harbour: windows and the clock, from the payloads and the block', () => {
        const m = runtimeModelOf(HARBOUR_RULES.action_nodes[P], payloadsOf(HARBOUR_RULES));
        const quay = m.nodes[m.nodeIx.get('quay')];
        expect([quay.from, quay.until]).toEqual([HARBOUR.nodes.quay.window.from, HARBOUR.nodes.quay.window.until]);
        expect(m.nodes[m.nodeIx.get('walk')].from).toBe(-Infinity);
        expect(m.windowed).toBe(true);
        expect(m.clock).toEqual(HARBOUR.clock);
        expect(m.pool).toEqual(POOL);
    });

    it('visits: the knowledge table in the block\'s order, each node\'s required and learned flags', () => {
        const m = runtimeModelOf(VISITS_RULES.action_nodes[P], payloadsOf(VISITS_RULES));
        expect(m.knowledgeIds).toEqual(Object.keys(VISITS.knowledge));
        const d = m.nodes[m.nodeIx.get('visit-d')];
        expect(d.reqKnow.map((k) => m.knowledgeIds[k])).toEqual(VISITS.nodes['visit-d'].requires.knowledge);
        expect(d.learns.map((k) => m.knowledgeIds[k])).toEqual(VISITS.nodes['visit-d'].results.learns);
        expect(m.knowledge[0].item).toBe(knowledgeItemNameOf(VISITS.knowledge['read-a'].name));
        expect(m.pool).toBeNull();
    });

    it('the example preset\'s model: no windows, no knowledge, no pool — the old model', () => {
        const ex = JSON.parse(readFileSync(join(HERE, '../../presets/action_nodes_example/AP_1/AP_1_rules.json'), 'utf8'));
        const m = runtimeModelOf(ex.action_nodes[P], payloadsOf(ex));
        expect(m.windowed).toBe(false);
        expect(m.knowledge).toEqual([]);
        expect([m.clock, m.pool]).toEqual([null, null]);
    });
});

describe('the knowledge gap (AN-TIME-1 found it): the app holds a flag only once its node is PERFORMED', () => {
    const A = VISITS.knowledge['read-a'].name;
    const LOC_A = knowledgeLocationNameOf(VISITS.nodes['visit-a'].name, A);
    const ITEM_A = knowledgeItemNameOf(A);

    it('the compiler marks every knowledge event location — and only those — substrate_state', () => {
        const locs = Object.values(VISITS_RULES.regions[P]).flatMap((r) => r.locations);
        const kinds = locs.filter((l) => 'event_kind' in l);
        const learnCount = Object.values(VISITS.nodes).reduce((n, node) => n + (node.results?.learns?.length ?? 0), 0);
        expect(kinds.length).toBe(learnCount);
        expect(new Set(kinds.map((l) => l.event_kind))).toEqual(new Set([KNOWLEDGE_EVENT_KIND]));
        expect(kinds.every((l) => l.event === true && l.id === null)).toBe(true);
        expect(KNOWLEDGE_EVENT_KIND).toBe('substrate_state');
        // a world with no knowledge writes no event_kind at all
        expect(JSON.stringify(HARBOUR_RULES).includes('"event_kind"')).toBe(false);
    });

    const loadSM = async (rules) => {
        const { StateManager } = await import('../stateManager/stateManager.js');
        const { evaluateRule } = await import('../shared/ruleEngine.js');
        const { workerLoggerInstance } = await import('../../app/core/universalLogger.js');
        const sm = new StateManager(evaluateRule, workerLoggerInstance);
        sm.loadFromJSON(structuredClone(rules), P);
        sm.computeReachableRegions();
        return sm;
    };
    const sync = (sm) => sm.applyRuntimeState({
        resetInventory: true, startingItemsFromServer: true, rederiveIdlessLocations: true, receivedItemsForProcessing: [],
    });

    it('REAL state manager: before perform the app does NOT hold the flag; after it does; after a /sync it still does', async () => {
        const sm = await loadSM(VISITS_RULES);
        const loc = sm.locations.get(LOC_A);
        expect(sm.isLocationAccessible(loc)).toBe(true); // its rule holds: the old app collected it right here
        expect(sm.checkedLocations.has(LOC_A)).toBe(false);
        expect(sm.inventory[ITEM_A] ?? 0).toBe(0);

        const { rt, env } = runtimeOf(VISITS_RULES);
        env.collectEvent = (name) => sm.checkLocation(name, true, true); // index.js's collectEvent
        rt.onSnapshot({ inventory: { ...sm.inventory }, checkedLocations: [...sm.checkedLocations] });
        // the gate refuses by name before the teaching node
        const before = rt.gate(actEntry('visit-d'));
        expect(before).toMatchObject({ ok: false, code: 'knowledge' });
        expect(before.reason).toBe(`needs to know ${A}`);

        expect(loopAct(rt, 'visit-a').learned).toEqual(['read-a']);
        expect(sm.checkedLocations.has(LOC_A)).toBe(true);
        expect(sm.inventory[ITEM_A]).toBe(1);
        expect(rt.gate(actEntry('visit-d'))).toEqual({ ok: true });

        sync(sm); // ReceivedItems index 0: /sync
        sm.computeReachableRegions();
        expect(sm.inventory[ITEM_A]).toBe(1);
        // a reload: a fresh runtime learns the flag from the app's snapshot
        const again = runtimeOf(VISITS_RULES).rt;
        expect(again.knownIds()).toEqual([]);
        again.onSnapshot({ inventory: { ...sm.inventory }, checkedLocations: [...sm.checkedLocations] });
        expect(again.knownIds()).toEqual(['read-a']);
        expect(again.gate(actEntry('visit-d'))).toEqual({ ok: true });
    });

    it('its mutation: the same world with NO event_kind is collected on reach (the gap AN-TIME-1 found)', async () => {
        const r = structuredClone(VISITS_RULES);
        for (const reg of Object.values(r.regions[P])) for (const l of reg.locations) delete l.event_kind;
        const sm = await loadSM(r);
        expect(sm.inventory[ITEM_A]).toBe(1);
    });

    it('a flag is learned once: the event is collected once, and the flag is kept across loops', () => {
        const { rt, collected } = runtimeOf(VISITS_RULES);
        loopAct(rt, 'visit-a');
        rt.onLoopReset('loopState:loopReset');
        expect(rt.knownIds()).toEqual(['read-a']);
        expect(loopAct(rt, 'visit-a').learned).toEqual([]);
        expect(collected).toEqual([LOC_A]);
    });
});

describe('windows and the clock in the runtime (E2: an early arrival waits and pays the time)', () => {
    const m = buildActionModel(HARBOUR_TIMED);
    const at = (u) => formatClock(m, u);

    it('too late: the gate refuses an act whose window has closed, with the clock in the text', () => {
        const { rt } = runtimeOf(HARBOUR_RULES);
        loopAct(rt, 'walk');
        loopAct(rt, 'walk');
        expect(rt.clock).toBe(2 * HARBOUR.nodes.walk.time);
        const g = rt.gate(actEntry('landlady'));
        expect(g).toMatchObject({ ok: false, code: 'too-late' });
        expect(g.reason).toBe(`too late: after ${at(HARBOUR.nodes.landlady.window.until)} (it is ${at(rt.clock)})`);
        expect(g.reason).toBe('too late: after 10:00 (it is 11:00)');
    });

    it('early: the gate refuses a bare act (too-early); a `wait` entry moves the clock; then the act passes', () => {
        const { rt } = runtimeOf(HARBOUR_RULES);
        const from = HARBOUR.nodes.quay.window.from;
        const g = rt.gate(actEntry('quay'));
        expect(g).toMatchObject({ ok: false, code: RUNTIME_REFUSALS.tooEarly });
        expect(g.reason).toBe(`Watch the Ferry Come In opens at ${at(from)}: queue a wait first (${from} h)`);
        expect(rt.gate({ type: 'customAction', actionName: WAIT_ACTION, sourceRegion: 'quay', params: { nodeId: 'quay', units: from } }))
            .toEqual({ ok: true });
        loopWait(rt, 'quay', from);
        expect(rt.clock).toBe(from);
        expect(rt.gate(actEntry('quay'))).toEqual({ ok: true });
        loopAct(rt, 'quay');
        expect(rt.clock).toBe(from + HARBOUR.nodes.quay.time);
        expect(rt.snapshot().clockText).toBe('13:00');
    });

    it('outside Loop mode, actNow pays the wait with the price (no queue): the clock and the pool agree', () => {
        const { rt, gs, charged } = runtimeOf(HARBOUR_RULES);
        const from = HARBOUR.nodes.quay.window.from;
        const r = rt.actNow('quay');
        expect(r.completed).toBe(true);
        expect(charged).toEqual([from + HARBOUR.nodes.quay.time]);
        expect(rt.clock).toBe(from + HARBOUR.nodes.quay.time);
        expect(gs.getCurrentMana()).toBe(HARBOUR.loop.mana - rt.clock);
    });

    it('the app\'s pool is the graph\'s loop.mana (a substrate bonus over gameState\'s default); a 100 world adds none', () => {
        const e = makeEnv();
        const rt = new ActionNodesRuntime(e.env);
        rt.loadWorld(HARBOUR_RULES, P);
        expect(e.gs.getMaxMana()).toBe(HARBOUR.loop.mana);
        expect(e.gs.getCurrentMana()).toBe(HARBOUR.loop.mana);
        rt.unload();
        expect(e.gs.getSubstrateMaxManaBonus('action_nodes')).toBe(0);
        const ex = JSON.parse(readFileSync(join(HERE, '../../presets/action_nodes_example/AP_1/AP_1_rules.json'), 'utf8'));
        const f = makeEnv();
        const r2 = new ActionNodesRuntime(f.env);
        r2.loadWorld(ex, P);
        expect(f.gs.getSubstrateMaxManaBonus('action_nodes')).toBe(0);
        expect(f.gs.getMaxMana()).toBe(ex.action_nodes[P].loop.mana);
    });

    it('a loop reset starts the clock again at 0', () => {
        const { rt } = runtimeOf(HARBOUR_RULES);
        loopAct(rt, 'walk');
        rt.onLoopReset('gameState:loopReset');
        expect(rt.clock).toBe(0);
    });

    it('the Time line: now, what is left, when the day ends', () => {
        const { rt, gs } = runtimeOf(HARBOUR_RULES);
        loopAct(rt, 'walk');
        loopAct(rt, 'walk');
        gs.currentMana = HARBOUR.loop.mana - 2;
        expect(rt.clockLine()).toEqual({ now: '11:00', left: 6, leftText: '6 h', ends: '17:00' });
        expect(runtimeOf(VISITS_RULES).rt.clockLine(3)).toEqual({ now: '09:00', left: 3, leftText: '3', ends: '12:00' });
    });
});

describe('the click, the queue and the bot queue the wait', () => {
    const m = buildActionModel(HARBOUR_TIMED);
    const from = HARBOUR.nodes.quay.window.from;

    it('planPerform: an early node is ready, its plan waits, and the text says so', () => {
        const { rt } = runtimeOf(HARBOUR_RULES);
        const live = rt.liveViewState();
        const plan = planPerform(rt.model, { live, at: 'inn', unit: 'h' }, 'quay');
        expect(plan).toMatchObject({ ok: true, acts: 1, waits: [from], wait: from });
        expect(plan.text).toBe(`1 hop(s), then waits ${from} h (opens 12:00), then Watch the Ferry Come In ×1`);
        // a node inside its window waits nothing
        expect(planPerform(rt.model, { live, at: 'inn' }, 'walk').wait).toBe(0);
    });

    it('performNode in Loop mode queues the wait entry, then the act', () => {
        const { rt } = runtimeOf(HARBOUR_RULES);
        const added = [];
        const gs = {
            isLoopModeActive: true, startRegions: ['Menu'],
            getCurrentRegion: () => 'inn', getPath: () => [],
            addCustomAction: (name, params) => { added.push({ name, params }); return true; },
        };
        const r = performNode({ runtime: rt, gameState: () => gs, loopState: () => ({ getActionQueue: () => [] }), dispatcher: null }, 'quay');
        expect(r).toMatchObject({ ok: true, queued: 1, waited: from });
        expect(added).toEqual([
            { name: WAIT_ACTION, params: { nodeId: 'quay', units: from, regionName: 'quay', label: `Wait ${from} h (opens 12:00)` } },
            { name: ACT_ACTION, params: { nodeId: 'quay', label: 'Watch the Ferry Come In', regionName: 'quay' } },
        ]);
    });

    it('queueEndState: a wait entry moves the clock and pays the pool; an early act alone stops the walk (too-early)', () => {
        const start = loopStartState(m);
        const wait = { type: 'customAction', actionName: WAIT_ACTION, sourceRegion: 'quay', params: { nodeId: 'quay', units: from } };
        const end = queueEndState(m, start, [wait, actEntry('quay')]);
        expect(end.stoppedAt).toBeNull();
        expect(end.state.clock).toBe(from + HARBOUR.nodes.quay.time);
        expect(end.state.mana).toBe(HARBOUR.loop.mana - from - HARBOUR.nodes.quay.time);
        expect(queueEndState(m, start, [actEntry('quay')]).stoppedAt).toMatchObject({ nodeId: 'quay', code: 'too-early' });
        expect(applyWait(m, start, 2)).toMatchObject({ clock: 2, mana: HARBOUR.loop.mana - 2 });
    });

    it('the bot\'s route puts a wait of the exact length before each early act, and the start gate passes every entry', () => {
        const { rt } = runtimeOf(HARBOUR_RULES);
        const inventory = { 'Harbour Pass': 1 };
        rt.onSnapshot({ inventory, checkedLocations: [] });
        const loop = planLiveLoop({ model: rt.model, inventory, startRegion: 'Menu', known: rt.knownIds(), unit: rt.poolUnit() });
        const waits = loop.path.filter((e) => e.actionName === WAIT_ACTION);
        expect(waits.length).toBeGreaterThan(0);
        for (const entry of loop.path) {
            if (entry.type === 'regionMove' && entry.sourceRegion === 'Menu') continue;
            const g = rt.gate(entry);
            expect(g, `${entry.actionName ?? entry.type} ${entry.sourceRegion}`).toEqual({ ok: true });
            if (entry.actionName === WAIT_ACTION) loopWait(rt, entry.sourceRegion, entry.params.units);
            if (entry.actionName === ACT_ACTION) expect(loopAct(rt, entry.params.nodeId).ok).toBe(true);
        }
        expect(rt.snapshot().nodes.find((n) => n.kind === 'goal').count).toBe(1);
        // its mutation: the same route without the waits is refused at the first early act
        const fresh = runtimeOf(HARBOUR_RULES).rt;
        fresh.onSnapshot({ inventory, checkedLocations: [] });
        const refused = loop.path.filter((e) => e.actionName !== WAIT_ACTION).find((e) => {
            if (e.actionName !== ACT_ACTION) return false;
            const g = fresh.gate(e);
            if (!g.ok) return true;
            loopAct(fresh, e.params.nodeId);
            return false;
        });
        expect(fresh.gate(refused).code).toBe(RUNTIME_REFUSALS.tooEarly);
    });

    it('the visits bot plans with the knowledge the runtime has learned (from the app\'s snapshot)', () => {
        const { rt } = runtimeOf(VISITS_RULES);
        // knowing nothing, the answer needs A, B and C in one day (1 + 1 + 2 > 3): not this loop
        expect(planLiveLoop({ model: rt.model, startRegion: 'Menu', known: rt.knownIds() }).kind).not.toBe('goal');
        const inventory = Object.fromEntries(['read-a', 'read-b', 'read-c'].map((k) => [knowledgeItemNameOf(VISITS.knowledge[k].name), 1]));
        rt.onSnapshot({ inventory, checkedLocations: [] });
        expect(rt.knownIds()).toEqual(['read-a', 'read-b', 'read-c']);
        const knowing = planLiveLoop({ model: rt.model, startRegion: 'Menu', known: rt.knownIds() });
        expect(knowing.kind).toBe('goal');
    });
});

describe('the node card and the labels', () => {
    const m = runtimeOf(HARBOUR_RULES).rt.model;
    const payloads = payloadsOf(HARBOUR_RULES);

    it('the window line: both ends, one end, or "any time" (a windowed world only)', () => {
        expect(windowText(m, payloads.quay.window)).toBe('available 12:00–13:00');
        expect(windowText(m, payloads.landlady.window)).toBe('available until 10:00');
        expect(windowText(m, { from: 3 })).toBe('available from 12:00');
        expect(windowText(m, undefined)).toBe('any time');
    });

    it('an early card says what a click queues; a late card marks its window line; the price in the pool\'s unit', () => {
        const { rt } = runtimeOf(HARBOUR_RULES);
        const early = nodeCardModel({ payload: payloads.quay, state: rt.nodeStates().states.quay, model: rt.model });
        expect(early).toMatchObject({ window: 'available 12:00–13:00', mana: '1 h', click: 'click: waits 3 h (opens 12:00), then 1 h' });
        loopAct(rt, 'walk');
        loopAct(rt, 'walk');
        const late = nodeCardModel({ payload: payloads.landlady, state: rt.nodeStates().states.landlady, model: rt.model });
        expect(late.unmet).toEqual({ line: 'window', text: 'too late: after 10:00 (it is 11:00)' });
        expect(late.click).toBeUndefined();
        const walk = nodeCardModel({ payload: payloads.walk, state: rt.nodeStates().states.walk, model: rt.model });
        expect(walk.window).toBe('any time');
    });

    it('a world with no windows draws the card it always did', () => {
        const ex = JSON.parse(readFileSync(join(HERE, '../../presets/action_nodes_example/AP_1/AP_1_rules.json'), 'utf8'));
        const { rt } = runtimeOf(ex);
        const p = payloadsOf(ex);
        for (const id of Object.keys(p)) {
            const st = rt.nodeStates().states[id];
            expect(nodeCardModel({ payload: p[id], state: st, model: rt.model })).toEqual(nodeCardModel({ payload: p[id], state: st }));
        }
    });

    it('the pool name: whyNot and the amounts read it; with none they are the old "mana" texts', () => {
        const timed = buildActionModel(HARBOUR_TIMED);
        const plain = buildActionModel(HARBOUR);
        const over = { ...loopStartState(timed), mana: 0 };
        expect(whyNot(timed, over, timed.nodeIx.get('walk')).text).toBe('no time left: the loop is over');
        expect(whyNot(plain, over, plain.nodeIx.get('walk')).text).toBe('no mana left: the loop is over');
        const short = { ...loopStartState(timed), mana: 1 };
        expect(whyNot(timed, short, timed.nodeIx.get('quay')).text).toBe('short by 3 h (waits 3 h, opens 12:00)');
        expect(whyNot(plain, short, plain.nodeIx.get('quay')).text).toBe('short by 3 mana (waits 3, opens 12:00)');
    });

    it('the Resources panel: the Time line with a clock, the pool name without one, "Mana" with neither', () => {
        const registry = new Map([
            ['timed', { label: 'Timed', sharing: { mana: {} }, loopSupport: {
                pool: () => ({ ...POOL }), clockLine: () => ({ now: '11:00', left: 6, leftText: '6 h', ends: '17:00' }) } }],
            ['named', { label: 'Named', sharing: { mana: {} }, loopSupport: { pool: () => ({ name: 'Focus', unit: '' }) } }],
            ['plain', { label: 'Plain', sharing: { mana: {} } }],
        ]);
        const mana = { current: 6, max: 8 };
        expect(resourcesPanelModel({ ledger: null, mana, substrates: ['timed'], registry }).manaText)
            .toBe('Time: 11:00 · 6 h left · the day ends 17:00');
        expect(resourcesPanelModel({ ledger: null, mana, substrates: ['named'], registry }).manaText).toBe('Focus: 6 / 8 (starting)');
        expect(resourcesPanelModel({ ledger: null, mana, substrates: ['plain'], registry }).manaText).toBe('Mana: 6 / 8 (starting)');
        expect(poolOfWorld([], registry)).toEqual({ name: 'Mana', unit: '' });
        expect(poolAmount(3, { name: 'Time', unit: 'h' })).toBe('3 h');
        expect(poolAmount(3, { name: 'Mana', unit: '' })).toBe('3 mana');
    });

    it('the registry entry: the strict queue takes `wait`; pool() and clockLine() read the loaded runtime', () => {
        expect(substrateRegistryEntry.loopSupport.queueActions).toContain(WAIT_ACTION);
        expect(typeof substrateRegistryEntry.loopSupport.pool).toBe('function');
        expect(typeof substrateRegistryEntry.loopSupport.clockLine).toBe('function');
    });
});

describe('the `pool` graph field: one optional format addition', () => {
    it('is validated: {name, unit?}, nothing else', () => {
        expect(validateActionGraph(HARBOUR_TIMED).ok).toBe(true);
        expect(validateActionGraph({ ...HARBOUR, pool: { name: 'Time' } }).ok).toBe(true);
        for (const bad of [{ unit: 'h' }, { name: '' }, { name: 'Time', unit: '' }, { name: 'Time', colour: 'red' }, 'Time']) {
            const v = validateActionGraph({ ...HARBOUR, pool: bad });
            expect(v.ok, JSON.stringify(bad)).toBe(false);
            expect(v.errors.map((e) => e.code)).toContain(ACTION_GRAPH_REFUSALS.BAD_POOL);
        }
    });

    it('is compiled to the block only when present', () => {
        expect(HARBOUR_RULES.action_nodes[P].pool).toEqual(POOL);
        expect('pool' in compiled(HARBOUR).action_nodes[P]).toBe(false);
    });
});

describe('"completed before" (⚖ Robert\'s Q6, minimal form): each node with the loop it was first performed in', () => {
    it('a node performed in loop 1 is "completed before" in loop 2, tagged loop 1; not in loop 1 itself', () => {
        const { rt } = runtimeOf(HARBOUR_RULES);
        expect(rt.loopNumber).toBe(1);
        loopAct(rt, 'walk');
        expect(rt.completedBefore()).toEqual([]);
        expect(rt.completedBeforeLoopOf('walk')).toBeNull();
        rt.onLoopReset('loopState:loopReset');
        expect(rt.loopNumber).toBe(2);
        expect(rt.completedBefore()).toEqual([{ nodeId: 'walk', name: 'Walk the Harbour', loop: 1 }]);
        expect(rt.completedBeforeLoopOf('walk')).toBe(1);
        loopAct(rt, 'walk');
        loopAct(rt, 'landlady');
        rt.onLoopReset('loopState:loopReset');
        expect(rt.completedBefore().map((c) => [c.nodeId, c.loop])).toEqual([['walk', 1], ['landlady', 2]]);
        const card = nodeCardModel({ payload: payloadsOf(HARBOUR_RULES).walk, state: rt.nodeStates().states.walk,
            model: rt.model, completedBefore: rt.completedBeforeLoopOf('walk') });
        expect(card.completedBefore).toBe(completedBeforeText(1));
        expect(card.completedBefore).toBe('completed before · loop 1');
    });

    it('a reset with nothing done is not a new loop (the world load\'s own loopState:loopReset included)', () => {
        const { rt } = runtimeOf(HARBOUR_RULES);
        rt.onLoopReset('loopState:loopReset');
        rt.onLoopReset('gameState:loopReset');
        expect(rt.loopNumber).toBe(1);
        loopWait(rt, 'quay', 1);
        rt.onLoopReset('gameState:loopReset');
        expect(rt.loopNumber).toBe(2);
    });

    it('is saved per world under the declared prefix and read back on a reload; another world keeps its own', () => {
        const storage = memoryStorage();
        const a = runtimeOf(HARBOUR_RULES, { storage }).rt;
        loopAct(a, 'walk');
        a.onLoopReset('loopState:loopReset');
        loopAct(a, 'landlady');
        const key = historyKeyOf(HARBOUR_RULES, P, HARBOUR_RULES.action_nodes[P]);
        expect(storage.keys()).toEqual([HISTORY_STORAGE_PREFIX + key]);
        const b = runtimeOf(HARBOUR_RULES, { storage }).rt;
        expect(b.loopNumber).toBe(3); // loop 2 had progress, so the reload starts loop 3
        expect(b.completedBefore().map((c) => [c.nodeId, c.loop])).toEqual([['walk', 1], ['landlady', 2]]);
        const v = runtimeOf(VISITS_RULES, { storage }).rt;
        expect(v.loopNumber).toBe(1);
        expect(v.completedBefore()).toEqual([]);
    });

    it('a storage that throws keeps the history in memory', () => {
        const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
        const { rt } = runtimeOf(HARBOUR_RULES, { storage: broken });
        loopAct(rt, 'walk');
        rt.onLoopReset('loopState:loopReset');
        expect(rt.completedBeforeLoopOf('walk')).toBe(1);
    });
});
