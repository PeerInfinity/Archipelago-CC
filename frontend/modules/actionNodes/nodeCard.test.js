/**
 * The node card (design §4, AN-3a) over the COMMITTED example preset: its fields for a check node, the goal and an
 * undiscovered node; the reserved "perform all remaining" slot; and the overlay's register / unregister by world.
 * Every node and number is read from the preset.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ActionNodesRuntime } from './actionNodesRuntime.js';
import { NODE_STATES } from './nodeStates.js';
import {
    CHECK_MARK, GOAL_MARK, PERFORM_ALL_LABEL, PERFORM_ALL_SLOT, PLACEHOLDER_TEXT, cardVisibility, createNodeCardProvider, nodeCardModel,
    renderNodeCard,
} from './nodeCard.js';
import { nodeCardView, wireNodeCardOverlay } from './nodeCardOverlay.js';
import { getActionNodesRuntime } from './actionNodesRuntime.js';
import { ResourceLedger } from '../resourceChannels/resourceLedger.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(HERE, '../../presets/action_nodes_example/AP_1/AP_1_rules.json'), 'utf8'));
const P = '1';
const BLOCK = RULES.action_nodes[P];
const PAYLOADS = Object.fromEntries(Object.entries(RULES.preset_sidecars[P]).map(([k, v]) => [k, v.playable_payload]));
const CHECK = Object.values(PAYLOADS).find((p) => p.kind === 'check');
const GOAL = Object.values(PAYLOADS).find((p) => p.kind === 'goal');
const REPEATABLE = Object.values(PAYLOADS).find((p) => p.limit > 1);

/** A minimal document: enough of the DOM for the renderer. */
function fakeDocument() {
    const doc = {
        createElement(tag) {
            const el = {
                tagName: tag.toUpperCase(), ownerDocument: doc, children: [], attributes: {}, dataset: {}, style: {},
                className: '', textContent: '', title: '',
                classList: { add(c) { el.className = `${el.className} ${c}`.trim(); } },
                setAttribute(k, v) { el.attributes[k] = String(v); },
                getAttribute(k) { return el.attributes[k] ?? null; },
                appendChild(c) { el.children.push(c); return c; },
                replaceChildren() { el.children = []; },
                listeners: {},
                addEventListener(type, fn) { (el.listeners[type] ??= []).push(fn); },
                fire(type) {
                    const e = { stopped: false, stopPropagation() { this.stopped = true; }, preventDefault() {} };
                    for (const fn of el.listeners[type] ?? []) fn(e);
                    return e;
                },
            };
            el.style.cssText = '';
            return el;
        },
    };
    return doc;
}
const walk = (el) => [el, ...el.children.flatMap(walk)];
const textOf = (el) => walk(el).map((e) => e.textContent).join(' | ');

function runtimeWith(mana = BLOCK.loop.mana) {
    const ledger = new ResourceLedger();
    const rt = new ActionNodesRuntime({
        ledger: () => ledger, publish: () => {}, dispatch: () => {},
        gameState: () => ({ getCurrentMana: () => mana, setPerItemManaTable: () => {} }),
    });
    rt.loadWorld(RULES, P);
    rt.onSnapshot({ inventory: {}, checkedLocations: [] });
    return rt;
}

describe('the card model', () => {
    let rt, states;
    beforeEach(() => { rt = runtimeWith(); ({ states } = rt.nodeStates()); });

    it('a check node: name, used/limit, mana, needs, gives; the check mark only once its location is checked', () => {
        const card = nodeCardModel({ payload: CHECK, state: states[CHECK.node_id], visibility: 'shown', checked: false });
        expect(card).toMatchObject({
            title: CHECK.name, used: `0/${CHECK.limit}`, mana: `${CHECK.time} mana`, checked: false, goal: false,
            location: CHECK.location, state: states[CHECK.node_id].state,
        });
        expect(nodeCardModel({ payload: CHECK, state: states[CHECK.node_id], checked: true }).checked).toBe(true);
    });

    it('the goal: marked as the goal, its needs listed', () => {
        const card = nodeCardModel({ payload: GOAL, state: states[GOAL.node_id] });
        expect(card.goal).toBe(true);
        for (const v of Object.values(GOAL.requires.stats)) expect(card.needs).toContain(`${v.name} ${v.amount}`);
    });

    it('gives lists every result, mana included', () => {
        const withMana = Object.values(PAYLOADS).find((p) => p.results.mana > 0);
        const card = nodeCardModel({ payload: withMana, state: states[withMana.node_id] });
        expect(card.gives).toContain(`Mana +${withMana.results.mana}`);
        for (const v of Object.values(withMana.results.resources)) expect(card.gives).toContain(v.name);
    });

    it('blocked marks the unmet line; short only of mana marks the mana line, "not enough mana"', () => {
        const needy = Object.values(PAYLOADS).find((p) => Object.keys(p.requires.resources).length
            && p.after.some((s) => s.length === 1 && s[0] === BLOCK.start));
        const c1 = nodeCardModel({ payload: needy, state: states[needy.node_id] });
        expect(c1.state).toBe(NODE_STATES.BLOCKED);
        expect(c1.unmet.line).toBe('needs');
        const poor = runtimeWith(REPEATABLE.time - 1);
        const c2 = nodeCardModel({ payload: REPEATABLE, state: poor.nodeStates().states[REPEATABLE.node_id] });
        expect(c2.unmet).toEqual({ line: 'mana', text: 'not enough mana' });
    });

    it('⛓ an undiscovered node shows the placeholder and nothing of its contents; one with no way in is not drawn', () => {
        const ph = nodeCardModel({ payload: CHECK, state: states[CHECK.node_id], visibility: 'placeholder' });
        expect(ph).toEqual({ nodeId: CHECK.node_id, placeholder: true, state: NODE_STATES.UNDISCOVERED, title: PLACEHOLDER_TEXT });
        expect(nodeCardModel({ payload: CHECK, state: states[CHECK.node_id], visibility: 'hidden' })).toBeNull();
    });

    it('cardVisibility follows the view model rule over the node exits', () => {
        const only = new Set([BLOCK.start]);
        const isD = (id) => only.has(id);
        const neighbour = PAYLOADS[BLOCK.start].exits.find((e) => !e.reverse).targetRegion;
        expect(cardVisibility(rt.model, BLOCK.start, isD)).toBe('shown');
        expect(cardVisibility(rt.model, neighbour, isD)).toBe('placeholder');
        expect(cardVisibility(rt.model, GOAL.node_id, isD)).toBe('hidden');
        expect(cardVisibility(rt.model, BLOCK.start, () => false)).toBe('placeholder');
    });
});

describe('the rendered card', () => {
    const doc = fakeDocument();
    const rt = runtimeWith();
    const { states } = rt.nodeStates();

    it('its state on data-state and the border; the marks in the head', () => {
        const el = renderNodeCard(nodeCardModel({ payload: GOAL, state: states[GOAL.node_id] }), doc);
        expect(el.dataset.state).toBe(states[GOAL.node_id].state);
        expect(el.dataset.nodeCard).toBe(GOAL.node_id);
        expect(el.style.borderColor).toBeTruthy();
        expect(textOf(el)).toContain(GOAL_MARK);
        const checked = renderNodeCard(nodeCardModel({ payload: CHECK, state: states[CHECK.node_id], checked: true }), doc);
        expect(textOf(checked)).toContain(CHECK_MARK);
        expect(textOf(checked)).toContain(`0/${CHECK.limit}`);
    });

    it('⛓ AN-3b: the slot holds ONE "perform all remaining" button on a repeatable node (limit > 1), and nothing else', () => {
        const el = renderNodeCard(nodeCardModel({ payload: REPEATABLE, state: states[REPEATABLE.node_id] }), doc);
        const slots = walk(el).filter((e) => e.attributes['data-slot'] === PERFORM_ALL_SLOT);
        expect(slots).toHaveLength(1);
        expect(slots[0].style.display).not.toBe('none');
        const buttons = walk(el).filter((e) => e.tagName === 'BUTTON');
        expect(buttons).toHaveLength(1);
        expect(slots[0].children).toEqual(buttons);
        expect(buttons[0].textContent).toBe(PERFORM_ALL_LABEL);
        expect(buttons[0].dataset.nodeId).toBe(REPEATABLE.node_id);
    });

    it('⛓ AN-3b: a node with limit 1 (and the start) has an empty, hidden slot and no button', () => {
        for (const p of Object.values(PAYLOADS).filter((x) => x.limit <= 1)) {
            const el = renderNodeCard(nodeCardModel({ payload: p, state: states[p.node_id] }), doc);
            const slot = walk(el).find((e) => e.attributes['data-slot'] === PERFORM_ALL_SLOT);
            expect(slot.children, p.node_id).toHaveLength(0);
            expect(slot.style.display, p.node_id).toBe('none');
            expect(walk(el).some((e) => e.tagName === 'BUTTON'), p.node_id).toBe(false);
        }
    });

    it('⛓ AN-3b: the button calls onPerformAll(nodeId) and stops its click and mousedown from reaching the card', () => {
        const calls = [];
        const el = renderNodeCard(nodeCardModel({ payload: REPEATABLE, state: states[REPEATABLE.node_id] }), doc,
            { onPerformAll: (id) => calls.push(id) });
        const btn = walk(el).find((e) => e.tagName === 'BUTTON');
        expect(btn.fire('mousedown').stopped).toBe(true);
        expect(btn.fire('click').stopped).toBe(true);
        expect(calls).toEqual([REPEATABLE.node_id]);
    });

    it('a placeholder card says ??? and nothing else', () => {
        const el = renderNodeCard(nodeCardModel({ payload: CHECK, state: states[CHECK.node_id], visibility: 'placeholder' }), doc);
        expect(textOf(el).replace(/[ |]/g, '')).toBe(PLACEHOLDER_TEXT);
        expect(textOf(el)).not.toContain(CHECK.name);
    });
});

describe('the provider and the overlay wiring', () => {
    it('create: a card for every node of the loaded world, none for Menu or for another world', () => {
        const rt = runtimeWith();
        const provider = createNodeCardProvider({
            getView: () => nodeCardView({ runtime: rt }), getStamp: () => rt.model, document: fakeDocument(),
        });
        for (const id of Object.keys(PAYLOADS)) expect(provider.create(id, {}), id).toBeTruthy();
        expect(provider.create('Menu', {})).toBeNull();
        rt.unload();
        expect(provider.create(CHECK.node_id, {})).toBeNull();
    });

    it('⛓ AN-3b: the provider\'s button answer shows on that node\'s card, and a world switch clears it', () => {
        const rt = runtimeWith();
        const provider = createNodeCardProvider({
            getView: () => nodeCardView({ runtime: rt }), getStamp: () => rt.model, document: fakeDocument(),
            onPerformAll: (id) => ({ text: `answer for ${id}` }),
        });
        const el = provider.create(REPEATABLE.node_id, {});
        expect(textOf(el)).not.toContain('answer for');
        provider.performAll(REPEATABLE.node_id);
        provider.update(REPEATABLE.node_id, {}, el);
        expect(walk(el).find((e) => e.className === 'an-card__message')?.textContent).toBe(`answer for ${REPEATABLE.node_id}`);
        rt.loadWorld(RULES, P);
        provider.update(REPEATABLE.node_id, {}, el);
        expect(textOf(el)).not.toContain('answer for');
    });

    it('⛓ registered while an ActionNodes world is loaded, unregistered (once) when another world loads', () => {
        const calls = [];
        const fns = {
            registerNodeOverlayProvider: () => calls.push('register'),
            unregisterNodeOverlayProvider: () => calls.push('unregister'),
            refreshNodeOverlays: () => calls.push('refresh'),
        };
        const rt = getActionNodesRuntime();
        rt.setEnv({ ledger: () => new ResourceLedger(), publish: () => {}, dispatch: () => {} });
        const wire = wireNodeCardOverlay({ getModuleFunction: (m, f) => (m === 'regionGraph' ? fns[f] : undefined), eventBus: null });
        rt.unload();
        wire.sync();
        expect(calls).toEqual([]);
        rt.loadWorld(RULES, P);
        wire.sync();
        wire.sync();
        expect(calls).toEqual(['register', 'refresh']);
        rt.loadWorld({ regions: {} }, P);
        wire.sync();
        wire.sync();
        expect(calls).toEqual(['register', 'refresh', 'unregister']);
        expect(wire.isRegistered()).toBe(false);
    });

    it('the view reads the queue only in Loop mode, and the live state while the queue runs', () => {
        const rt = runtimeWith();
        const act = { type: 'customAction', actionName: 'act', sourceRegion: REPEATABLE.node_id, params: { nodeId: REPEATABLE.node_id } };
        const queue = Array.from({ length: REPEATABLE.limit }, () => ({ ...act }));
        const ls = { isProcessing: false, isPaused: false, getActionQueue: () => queue };
        const planned = nodeCardView({ runtime: rt, loopState: () => ls, loopMode: () => true });
        expect(planned.basis).toBe('queue-end');
        expect(planned.states[REPEATABLE.node_id].state).toBe(NODE_STATES.DONE);
        expect(nodeCardView({ runtime: rt, loopState: () => ls, loopMode: () => false }).basis).toBe('live');
        ls.isProcessing = true;
        expect(nodeCardView({ runtime: rt, loopState: () => ls, loopMode: () => true }).states[REPEATABLE.node_id].state).toBe(NODE_STATES.READY);
    });
});
