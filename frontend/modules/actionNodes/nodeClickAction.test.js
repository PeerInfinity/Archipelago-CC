/**
 * AN-3b: the click action `actionNodes.act` (perform ONCE) and the button's effect (`performNode`), over the COMMITTED
 * example preset through a real runtime, with a fake gameState / Loops queue / dispatcher.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ActionNodesRuntime } from './actionNodesRuntime.js';
import {
    ACT_CLICK_ID, PLAN_SOURCE_PREFIX, actClickActionDescriptor, performNode, planSourceFor, syncClickAction,
} from './nodeClickAction.js';
import { getClickAction, listClickActions, runClickActions, resetClickActionsForTests, ORDER } from '../regionView/clickActions.js';
import { isLoopModePlanningSource } from '../loops/loopModeExemptions.js';
import { ResourceLedger } from '../resourceChannels/resourceLedger.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(HERE, '../../presets/action_nodes_example/AP_1/AP_1_rules.json'), 'utf8'));
const P = '1';
const BLOCK = RULES.action_nodes[P];
const PAYLOADS = Object.fromEntries(Object.entries(RULES.preset_sidecars[P]).map(([k, v]) => [k, v.playable_payload]));
const fromStart = (p) => p.after.some((s) => s.length === 1 && s[0] === BLOCK.start);
const needsNothing = (p) => !Object.keys(p.requires.resources).length && !Object.keys(p.requires.stats).length;
const REPEATABLE = Object.values(PAYLOADS).find((p) => fromStart(p) && p.limit > 1 && needsNothing(p));
const NEEDY = Object.values(PAYLOADS).find((p) => fromStart(p) && Object.keys(p.requires.resources).length);
const MENU = 'Menu';

/** A gameState with a path, a pool and Loop mode; addCustomAction appends like the real one. */
function fakeGameState({ loopMode }) {
    const g = {
        isLoopModeActive: loopMode, startRegions: [MENU], currentRegion: MENU, mana: BLOCK.loop.mana, path: [],
        getCurrentRegion: () => g.currentRegion, getPath: () => g.path, getCurrentMana: () => g.mana,
        setPerItemManaTable: () => {},
        addCustomAction: (actionName, params) => { g.path.push({ type: 'customAction', actionName, params, sourceRegion: params.regionName }); return true; },
    };
    return g;
}
/** A dispatcher whose user:regionMove does what gameState's handler does: the path (planning), the region. */
function fakeDispatcher(g) {
    const sent = [];
    return {
        sent,
        publish(event, data) {
            sent.push({ event, data });
            if (event !== 'user:regionMove') return;
            if (!g.isLoopModeActive || isLoopModePlanningSource(data.source)) {
                g.path.push({ type: 'regionMove', sourceRegion: data.sourceRegion, destinationRegion: data.targetRegion, exitUsed: data.exitName });
            }
            g.currentRegion = data.targetRegion;
        },
    };
}

let g, rt, dispatcher, deps, ledger;
function setUp(loopMode) {
    g = fakeGameState({ loopMode });
    ledger = new ResourceLedger();
    rt = new ActionNodesRuntime({
        ledger: () => ledger, publish: () => {}, dispatch: () => {}, gameState: () => g,
        chargeMana: ({ amount }) => { g.mana -= amount; return { depleted: g.mana <= 0 }; },
        gainMana: ({ amount }) => { g.mana += amount; },
        fireReset: () => {},
    });
    expect(rt.loadWorld(RULES, P)).toBe(true);
    rt.onSnapshot({ inventory: {}, checkedLocations: [] });
    dispatcher = fakeDispatcher(g);
    // The queue: the path's entries (completed: none, the queue is planned).
    deps = { runtime: rt, gameState: () => g, loopState: () => ({ getActionQueue: () => g.path }), dispatcher };
}
const acts = () => g.path.filter((e) => e.type === 'customAction');
const moves = () => g.path.filter((e) => e.type === 'regionMove').map((e) => [e.sourceRegion, e.destinationRegion]);

afterEach(() => resetClickActionsForTests());

describe('⛓ IN Loop mode it QUEUES: the free hops, then the act(s)', () => {
    beforeEach(() => setUp(true));

    it('perform once from the loop start: Menu → start → node, ONE act, under actionNodes-plan-<panel>', () => {
        const r = performNode(deps, REPEATABLE.node_id, { panelId: 'regionGraph' });
        expect(r.ok, r.text).toBe(true);
        expect(r.queued).toBe(1);
        expect(moves()).toEqual([[MENU, BLOCK.start], [BLOCK.start, REPEATABLE.node_id]]);
        expect(acts()).toHaveLength(1);
        expect(acts()[0].params).toMatchObject({ nodeId: REPEATABLE.node_id, label: REPEATABLE.name });
        for (const { data } of dispatcher.sent) expect(data.source).toBe(planSourceFor('regionGraph'));
        expect(rt.counts[rt.nodeIndex(REPEATABLE.node_id)]).toBe(0); // nothing performed: queued only
    });

    it('a second click: no hops (the queue ends there), one more act; a third: refused, done by name', () => {
        performNode(deps, REPEATABLE.node_id);
        const n = moves().length;
        for (let k = 1; k < REPEATABLE.limit; k++) expect(performNode(deps, REPEATABLE.node_id).ok).toBe(true);
        expect(moves()).toHaveLength(n);
        expect(acts()).toHaveLength(REPEATABLE.limit);
        const r = performNode(deps, REPEATABLE.node_id);
        expect(r.ok).toBe(false);
        expect(r.code).toBe('done');
        expect(acts()).toHaveLength(REPEATABLE.limit);
    });

    it('perform all remaining: the route, then limit − count acts', () => {
        const r = performNode(deps, REPEATABLE.node_id, { times: 'remaining', panelId: 'nodeCard' });
        expect(r.queued).toBe(REPEATABLE.limit);
        expect(acts()).toHaveLength(REPEATABLE.limit);
    });

    it('a blocked node: refused by name, nothing queued or sent', () => {
        const r = performNode(deps, NEEDY.node_id);
        expect(r.ok).toBe(false);
        expect(r.code).toBe('blocked');
        expect(r.text).toContain(NEEDY.name);
        expect(g.path).toEqual([]);
        expect(dispatcher.sent).toEqual([]);
    });
});

describe('⛓ OUTSIDE Loop mode it does what the queue would do, AT ONCE', () => {
    beforeEach(() => setUp(false));

    it('perform once: the moves, then one performance charged to the pool', () => {
        const mana0 = g.mana;
        const r = performNode(deps, REPEATABLE.node_id);
        expect(r.ok, r.text).toBe(true);
        expect(r.performed).toBe(1);
        expect(g.currentRegion).toBe(REPEATABLE.node_id);
        expect(rt.counts[rt.nodeIndex(REPEATABLE.node_id)]).toBe(1);
        expect(g.mana).toBe(mana0 - REPEATABLE.time);
        expect(acts()).toEqual([]); // no queue entries
    });

    it('perform all remaining, capped by mana: as many as the pool finishes, and says so', () => {
        g.mana = REPEATABLE.time * (REPEATABLE.limit - 1) + 1;
        const r = performNode(deps, REPEATABLE.node_id, { times: 'remaining' });
        expect(r.ok).toBe(true);
        expect(r.performed).toBe(REPEATABLE.limit - 1);
        expect(r.capped.by).toBe('mana');
        expect(rt.counts[rt.nodeIndex(REPEATABLE.node_id)]).toBe(REPEATABLE.limit - 1);
    });
});

describe('⛓ the click action: registered only while an ActionNodes world is loaded', () => {
    beforeEach(() => setUp(true));

    it('register on load, unregister on unload; idempotent', () => {
        expect(getClickAction(ACT_CLICK_ID)).toBe(null);
        expect(syncClickAction(deps)).toBe(true);
        expect(syncClickAction(deps)).toBe(true);
        const d = getClickAction(ACT_CLICK_ID);
        expect(d).toMatchObject({ owner: 'actionNodes', target: 'region', kind: 'toggle', order: ORDER.panel });
        expect(listClickActions('region').map((x) => x.id).at(-1)).toBe(ACT_CLICK_ID); // after path and checks
        rt.unload();
        expect(syncClickAction(deps)).toBe(false);
        expect(getClickAction(ACT_CLICK_ID)).toBe(null);
    });

    it('a click runs it with the panel\'s dispatcher, once; an unregistered enabled id is skipped and kept', () => {
        syncClickAction({ ...deps, dispatcher: null });
        const settings = { enabled: true, region: { [ACT_CLICK_ID]: true }, location: {} };
        const run = runClickActions('regionMap', 'region', { regionName: REPEATABLE.node_id }, settings, { dispatcher });
        expect(run.results.map((x) => x.id)).toEqual([ACT_CLICK_ID]);
        expect(run.results[0].result.ok).toBe(true);
        expect(acts()).toHaveLength(1);
        expect(dispatcher.sent.every(({ data }) => data.source === `${PLAN_SOURCE_PREFIX}-regionMap`)).toBe(true);
        rt.unload();
        syncClickAction(deps);
        const again = runClickActions('regionMap', 'region', { regionName: REPEATABLE.node_id }, settings, { dispatcher });
        expect(again.skipped).toEqual([{ id: ACT_CLICK_ID, reason: 'unregistered' }]);
        expect(settings.region[ACT_CLICK_ID]).toBe(true);
    });

    it('the descriptor is a toggle labelled for the strip', () => {
        const d = actClickActionDescriptor(deps);
        expect(d.summary).toBe('perform once');
        expect(d.kind).toBe('toggle');
    });
});
