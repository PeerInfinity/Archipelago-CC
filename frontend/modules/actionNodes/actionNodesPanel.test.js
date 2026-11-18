import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { actionNodesPanelModel, queueAct } from './actionNodesPanel.js';
import { ActionNodesRuntime } from './actionNodesRuntime.js';
import { ResourceLedger } from '../resourceChannels/resourceLedger.js';
import { GameState } from '../gameState/state.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(HERE, '../../presets/action_nodes_example/AP_1/AP_1_rules.json'), 'utf8'));
const PAYLOADS = Object.fromEntries(Object.entries(RULES.preset_sidecars['1']).map(([k, v]) => [k, v.playable_payload]));
const START = RULES.action_nodes['1'].start;
const OPEN = Object.values(PAYLOADS).find((p) => p.kind !== 'start' && p.after.some((s) => s.includes(START)));
const CLOSED = Object.values(PAYLOADS).find((p) => p.kind !== 'start' && !p.after.some((s) => s.includes(START)));

describe('the ActionNodes panel model', () => {
    let rt, gs;
    beforeEach(() => {
        gs = new GameState({ publish() {}, subscribe: () => () => {} });
        const ledger = new ResourceLedger();
        rt = new ActionNodesRuntime({ gameState: () => gs, ledger: () => ledger });
        rt.loadWorld(RULES, '1');
    });

    it('a reachable node is ready; its button is Act outside Loop mode and Queue act in it', () => {
        const m = actionNodesPanelModel({ payload: OPEN, runtime: rt, loopMode: false });
        expect(m).toMatchObject({ name: OPEN.name, status: 'ready', canAct: true, actLabel: 'Act', count: 0, limit: OPEN.limit });
        expect(actionNodesPanelModel({ payload: OPEN, runtime: rt, loopMode: true }).actLabel).toBe('Queue act');
    });

    it('a node not reached is blocked and says why; its forward exits are closed until it is cleared, a move back is open when its target is reached', () => {
        const m = actionNodesPanelModel({ payload: CLOSED, runtime: rt, loopMode: false });
        expect(m.status).toBe('blocked');
        expect(m.canAct).toBe(false);
        expect(m.whyNot).toMatch(/not reached/);
        expect(m.exits.filter((e) => !e.reverse).every((e) => e.open === false)).toBe(true);
        for (const e of m.exits.filter((x) => x.reverse)) expect(e.open, e.name).toBe(rt.isReached(e.target));
    });

    it('the start has no action and its exits are open', () => {
        const m = actionNodesPanelModel({ payload: PAYLOADS[START], runtime: rt, loopMode: false });
        expect(m.status).toBe('start');
        expect(m.exits.length).toBeGreaterThan(0);
        expect(m.exits.every((e) => e.open)).toBe(true);
    });

    it('with no world it is empty', () => {
        expect(actionNodesPanelModel({ payload: OPEN, runtime: new ActionNodesRuntime({}), loopMode: false }).empty).toBe(true);
    });
});

describe('queueAct', () => {
    it('appends an act entry only when the queue ends at the node', () => {
        const gs = new GameState({ publish() {}, subscribe: () => () => {} });
        gs.setStartRegions(['Menu']);
        gs.setCurrentRegion('Menu');
        const refused = queueAct(gs, OPEN.node_id, OPEN.name);
        expect(refused).toMatchObject({ ok: false, code: 'queue-ends-elsewhere' });
        expect(gs.getPath()).toEqual([]);
        gs.setCurrentRegion(OPEN.node_id);
        expect(queueAct(gs, OPEN.node_id, OPEN.name)).toEqual({ ok: true });
        expect(gs.getPath()).toMatchObject([{
            type: 'customAction', actionName: 'act', sourceRegion: OPEN.node_id, params: { nodeId: OPEN.node_id, label: OPEN.name },
        }]);
    });
});
