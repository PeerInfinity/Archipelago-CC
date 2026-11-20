/**
 * clickActionsUI — the shared "On click" strip (mode-toggle design §4.5, slice CA-S2), mounted on the repo's node-side
 * DOM (`procgenCore/fakeEditorDom.testkit.js`: vitest runs `environment: 'node'`). It renders the REGISTRY, generically:
 * a test-registered toggle and choice render with no special casing, an unknown id stays and is greyed, and a
 * register / unregister re-renders it.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { FakeElement } from '../procgenCore/fakeEditorDom.testkit.js';

const CA = await import('./clickActions.js');
const UI = await import('./clickActionsUI.js');
const { BUILT_IN_IDS: ID } = CA;
const { STRIP } = UI;

const doc = { createElement: (t) => new FakeElement(t) };

/** Every descendant (depth first). */
function all(node) {
    const out = [];
    const walk = (n) => { for (const c of n.children) { out.push(c); walk(c); } };
    walk(node);
    return out;
}
const byClass = (node, cls) => all(node).filter((n) => n.className.split(' ').includes(cls));
const one = (node, cls) => byClass(node, cls)[0];
const rowOf = (strip, id) => byClass(strip.element, STRIP.row).find((r) => r.dataset.actionId === id);
const inputsOf = (row, tag) => all(row).filter((n) => n.tagName === tag);
const textOf = (node) => [node.textContent, ...all(node).map((n) => n.textContent)].join('');

/** A strip over an in-memory settings object; `saved` records every save. */
function mount(settings = CA.defaultClickActions()) {
    const state = { settings, saved: [] };
    const container = new FakeElement('div');
    const strip = UI.mountClickActionsStrip({
        panelId: 'testPanel', container, doc,
        getSettings: () => state.settings,
        saveSettings: (next) => { state.saved.push(next); state.settings = next; },
    });
    return { strip, state, container };
}

const REGIONS_OPEN = { id: 'regions.open', owner: 'regions', label: 'Open in the Regions panel', summary: 'Regions',
    target: 'region', kind: 'toggle', run: () => ({ ok: true }) };

beforeEach(() => CA.resetClickActionsForTests());
afterAll(() => CA.resetClickActionsForTests());

describe('⛓ the collapsed strip', () => {
    it('mounts collapsed into its container, with a one-line summary and the ⏸ master switch', () => {
        CA.registerClickAction(REGIONS_OPEN);
        const { strip, container } = mount();
        expect(container.children).toEqual([strip.element]);
        expect(strip.element.dataset.panelId).toBe('testPanel');
        expect(strip.isExpanded()).toBe(false);
        expect(one(strip.element, STRIP.body).style.display).toBe('none');
        expect(one(strip.element, STRIP.summary).textContent).toBe('On click: extend path · Regions — location: check');
        expect(one(strip.element, STRIP.master).textContent).toBe('⏸');
        strip.destroy();
        expect(container.children).toEqual([]);
    });

    it('summarizeClickActions: the default, the route choices, a paused panel, nothing on', () => {
        CA.registerClickAction(REGIONS_OPEN);
        const S = UI.summarizeClickActions;
        expect(S(CA.defaultClickActions())).toBe('On click: extend path · Regions — location: check');
        const off = CA.migrateRegionGraphClickKeys({ movePlayerDirectly: false, showRegionInPanel: false, addToPath: false });
        expect(S(off)).toBe('On click: nothing — location: check');
        expect(S({ ...off, region: { ...off.region, [ID.route]: { from: 'start' }, [ID.checkAll]: true } }))
            .toBe('On click: restart path · check all — location: check');
        expect(S({ ...off, region: { [ID.route]: { from: 'player' } }, location: { [ID.check]: 'addToPath' } }))
            .toBe('On click: move player — location: add check to path');
        expect(S({ ...CA.defaultClickActions(), enabled: false })).toBe('On click: ⏸ paused');
        expect(S(null)).toBe('On click: (no settings)');
    });

    it('the master switch: off → saved enabled:false (nothing else touched), the summary says paused, runClickActions runs nothing', () => {
        const { strip, state } = mount();
        const before = JSON.stringify(state.settings);
        one(strip.element, STRIP.master).dispatch('click');
        expect(state.saved).toHaveLength(1);
        expect(state.settings).toEqual({ ...JSON.parse(before), enabled: false });
        expect(one(strip.element, STRIP.summary).textContent).toBe('On click: ⏸ paused');
        expect(one(strip.element, STRIP.master).textContent).toBe('▶');
        const calls = [];
        const h = { dispatcher: { publish: (...a) => calls.push(a) }, eventBus: { publish: (...a) => calls.push(a) } };
        expect(CA.runClickActions('testPanel', 'region', { regionName: 'X' }, state.settings, h))
            .toEqual({ ran: false, reason: 'disabled', results: [], skipped: [] });
        expect(CA.runClickActions('testPanel', 'location', { regionName: 'X', locationName: 'y' }, state.settings, h).ran).toBe(false);
        expect(calls).toEqual([]);
        one(strip.element, STRIP.master).dispatch('click');
        expect(state.settings.enabled).toBe(true);
        expect(JSON.stringify(state.settings)).toBe(before.replace('"enabled":true', '"enabled":true'));
    });
});

describe('⛓ the expanded strip: generic rows from the registry', () => {
    it('a Region list and a Location list; the built-in choice renders as a select over its choices with their labels', () => {
        const { strip } = mount();
        strip.setExpanded(true);
        expect(one(strip.element, STRIP.body).style.display).toBe('block');
        expect(byClass(strip.element, STRIP.list).map((l) => l.dataset.target)).toEqual(['region', 'location']);
        const route = rowOf(strip, ID.route);
        const [sel] = inputsOf(route, 'select');
        expect(sel.dataset.field).toBe('from');
        expect(sel.options.map((o) => [o.value, o.textContent])).toEqual([['', 'off'],
            ['pathEnd', 'Extend the path from its end'], ['start', 'Restart the path from the start'], ['player', 'Move the player there']]);
        expect(sel.value).toBe('pathEnd');
        const [box] = inputsOf(rowOf(strip, ID.checkAll), 'input');
        expect([box.type, box.checked]).toEqual(['checkbox', false]);
        const [check] = inputsOf(rowOf(strip, ID.check), 'select');
        expect(check.value).toBe('now');
        expect(check.dataset.field).toBe(undefined);
    });

    it('editing: a select writes the value (an object field for `{ field: [...] }` choices), "off" writes false, a box writes a boolean', () => {
        const { strip, state } = mount();
        strip.setExpanded(true);
        const pick = (id, value) => { const [s] = inputsOf(rowOf(strip, id), 'select'); s.value = value; s.dispatch('change'); };
        pick(ID.route, 'start');
        expect(state.settings.region[ID.route]).toEqual({ from: 'start' });
        pick(ID.route, '');
        expect(state.settings.region[ID.route]).toBe(false);
        pick(ID.check, 'addToPath');
        expect(state.settings.location[ID.check]).toBe('addToPath');
        const [box] = inputsOf(rowOf(strip, ID.checkAll), 'input');
        box.checked = true;
        box.dispatch('change');
        expect(state.settings.region[ID.checkAll]).toBe(true);
        expect(state.saved).toHaveLength(4);
        // Every save is a new object; nothing outside the edited key moved.
        expect(new Set(state.saved).size).toBe(4);
        expect(state.settings.region['regions.open']).toBe(true);
        expect(one(strip.element, STRIP.summary).textContent).toBe('On click: check all · regions.open (not loaded) — location: add check to path');
    });

    it('a test-registered toggle and choice render with NO special casing (labels from the descriptor)', () => {
        CA.registerClickAction({ id: 'demo.ping', owner: 'demo', label: 'Ping it', target: 'location', kind: 'toggle',
            summary: 'ping', run: () => ({ ok: true }) });
        CA.registerClickAction({ id: 'demo.mode', owner: 'demo', label: 'Mode', target: 'region', kind: 'choice',
            choices: ['a', 'b'], choiceLabels: { a: 'Alpha' }, summary: (v) => `mode ${v}`, run: () => ({ ok: true }) });
        const settings = CA.defaultClickActions();
        settings.region['demo.mode'] = 'b';
        settings.location['demo.ping'] = true;
        const { strip, state } = mount(settings);
        strip.setExpanded(true);
        const [sel] = inputsOf(rowOf(strip, 'demo.mode'), 'select');
        expect(sel.options.map((o) => [o.value, o.textContent])).toEqual([['', 'off'], ['a', 'Alpha'], ['b', 'b']]);
        expect(sel.value).toBe('b');
        const [box] = inputsOf(rowOf(strip, 'demo.ping'), 'input');
        expect(box.checked).toBe(true);
        expect(textOf(rowOf(strip, 'demo.ping'))).toContain('Ping it');
        expect(one(strip.element, STRIP.summary).textContent)
            .toBe('On click: extend path · mode b · regions.open (not loaded) — location: check · ping');
        sel.value = 'a';
        sel.dispatch('change');
        expect(state.settings.region['demo.mode']).toBe('a');
    });

    it('an enabled id with no registered action stays in the settings and is shown greyed out, "(not loaded)"', () => {
        const settings = CA.defaultClickActions();
        settings.region['flash.teleport'] = true;
        settings.region['apcalc.focus'] = false; // off and unknown: kept, not shown
        const { strip, state } = mount(settings);
        strip.setExpanded(true);
        const greyed = byClass(strip.element, STRIP.unloaded);
        expect(greyed.map((r) => r.dataset.actionId)).toEqual(['regions.open', 'flash.teleport']);
        expect(greyed[1].textContent).toBe('flash.teleport: true (not loaded)');
        expect(greyed[1].style.opacity).toBe('0.5');
        // An edit elsewhere keeps every unknown key, on or off.
        const [box] = inputsOf(rowOf(strip, ID.checkAll), 'input');
        box.checked = true;
        box.dispatch('change');
        expect(state.settings.region['flash.teleport']).toBe(true);
        expect(state.settings.region['apcalc.focus']).toBe(false);
        expect(state.settings.region['regions.open']).toBe(true);
    });

    it('re-renders when an action is registered or unregistered (no host call)', () => {
        const { strip } = mount();
        strip.setExpanded(true);
        expect(byClass(strip.element, STRIP.unloaded).map((r) => r.dataset.actionId)).toEqual(['regions.open']);
        CA.registerClickAction(REGIONS_OPEN);
        expect(byClass(strip.element, STRIP.unloaded)).toEqual([]);
        const [box] = inputsOf(rowOf(strip, 'regions.open'), 'input');
        expect(box.checked).toBe(true);
        expect(one(strip.element, STRIP.summary).textContent).toBe('On click: extend path · Regions — location: check');
        CA.unregisterClickAction('regions.open');
        expect(byClass(strip.element, STRIP.unloaded).map((r) => r.dataset.actionId)).toEqual(['regions.open']);
        expect(one(strip.element, STRIP.summary).textContent).toBe('On click: extend path · regions.open (not loaded) — location: check');
        // Destroyed: a later registration does not touch it.
        strip.destroy();
        const before = one(strip.element, STRIP.summary).textContent;
        CA.registerClickAction(REGIONS_OPEN);
        expect(one(strip.element, STRIP.summary).textContent).toBe(before);
    });

    it('a pre-ruling route with a `distance` shows its `from` and is rewritten without it on the next edit of that row', () => {
        const settings = CA.defaultClickActions();
        settings.region[ID.route] = { from: 'player', distance: 'one' };
        const { strip, state } = mount(settings);
        strip.setExpanded(true);
        const [sel] = inputsOf(rowOf(strip, ID.route), 'select');
        expect(sel.value).toBe('player');
        sel.value = 'pathEnd';
        sel.dispatch('change');
        expect(state.settings.region[ID.route]).toEqual({ from: 'pathEnd' });
    });

    it('the toggle button and the summary fold and unfold it', () => {
        const { strip } = mount();
        expect(strip.element.dataset.expanded).toBe('false');
        one(strip.element, STRIP.toggle).dispatch('click');
        expect(strip.isExpanded()).toBe(true);
        expect(strip.element.dataset.expanded).toBe('true');
        expect(one(strip.element, STRIP.toggle).textContent).toBe('▾');
        one(strip.element, STRIP.summary).dispatch('click');
        expect(strip.isExpanded()).toBe(false);
    });

    it('refuses a mount without its handles', () => {
        expect(() => UI.mountClickActionsStrip({ getSettings: () => ({}), saveSettings: () => {}, doc })).toThrow('panelId');
        expect(() => UI.mountClickActionsStrip({ panelId: 'p', doc })).toThrow('getSettings');
    });
});
