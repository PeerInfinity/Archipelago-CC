/**
 * procgenLabPanel — **THE HOST HALF, HEADLESS.**
 *
 * CONSTRUCTIVE-MODE arc, slice 4. `vitest.config.js` is `environment: 'node'`
 * (no jsdom — slice 3 §10.2 measured that and it has not changed), so this
 * file brings a **minimal DOM stand-in**: enough `document`/`window` for the
 * panel to build its chrome, and nothing more.
 *
 * ⛔ THE STAND-IN IS DELIBERATELY DUMB. It models `createElement`, `append`,
 * `textContent`, `dataset`, `classList.toggle` and attributes — the exact
 * surface the panel uses — and NOTHING ELSE, so a panel that started reaching
 * for layout, focus or a real `URL` resolution would fail here loudly rather
 * than silently doing something a browser would not (`mazeRoomRender`'s
 * recording context, same stance one module over).
 *
 * ── WHAT THIS FILE GATES, AND WHAT ONLY THE BROWSER ROW CAN ───────────
 *
 * Gated here: the three registration surfaces the module declares, the panel's
 * addressing (two instances never share an iframeId, and each ignores the
 * other's mail), the payload VALIDATION at the publish, the status sentence's
 * three-way certified, "open standalone" being built from the LAST state, and
 * ⛓⛓ **THE RESEND** — a `load` pressed before the frame connects lands when
 * `iframe:appReady` names it. That last one is mutant (b)'s unit-level twin.
 *
 * NOT gated here: that an iframe actually loads a page, that the adapter
 * forwards anything, or that the page reconstructs a level.
 * `scripts/procgen/check-procgen-lab-hosting.mjs` is the instrument for those,
 * and nothing in this file may be read as covering them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ══════════════════════════════════════════════════════════════════════
 * THE DOM STAND-IN
 * ══════════════════════════════════════════════════════════════════════ */

function makeElement(tag) {
    const node = {
        tagName: String(tag).toUpperCase(),
        children: [],
        parentNode: null,
        dataset: {},
        style: {},
        attributes: {},
        className: '',
        textContent: '',
        value: '',
        onclick: null,
        classList: {
            toggle(name, on) {
                const set = new Set(String(node.className).split(' ').filter(Boolean));
                if (on) set.add(name); else set.delete(name);
                node.className = [...set].join(' ');
            },
        },
        appendChild(child) { child.parentNode = node; node.children.push(child); return child; },
        removeChild(child) {
            node.children = node.children.filter((c) => c !== child);
            child.parentNode = null;
        },
        setAttribute(name, value) { node.attributes[name] = String(value); },
        removeAttribute(name) { delete node.attributes[name]; },
        getAttribute(name) { return node.attributes[name] ?? null; },
    };
    return node;
}

/** Depth-first search of the stand-in tree by `data-role`. */
function byRole(root, role) {
    if (!root) return null;
    if (root.dataset?.role === role) return root;
    for (const child of root.children ?? []) {
        const hit = byRole(child, role);
        if (hit) return hit;
    }
    return null;
}

const HOST_HREF = 'http://localhost:8000/frontend/index.html';

let ProcgenLabPanelUI;
let LAB_PAGES;
let nextLabIframeId;
let standaloneUrlFrom;
let LAB_EVENTS;
let moduleIndex;
let eventBus;

beforeEach(async () => {
    globalThis.document = {
        head: makeElement('head'),
        createElement: (tag) => makeElement(tag),
    };
    globalThis.window = {
        location: { origin: 'http://localhost:8000', href: HOST_HREF },
        iframeAdapterCore: {
            expected: new Map(),
            unregistered: [],
            setExpectedOrigin(id, origin) { this.expected.set(id, origin); },
            unregisterIframe(id) { this.unregistered.push(id); },
        },
    };
    // ⚠ URL is a node global already; the panel resolves relative page paths
    // against `window.location.href`, which the stand-in provides.
    vi.resetModules();
    ({ default: eventBus } = await import('../../app/core/eventBus.js'));
    ({
        ProcgenLabPanelUI, LAB_PAGES, nextLabIframeId, standaloneUrlFrom,
    } = await import('./procgenLabPanelUI.js'));
    ({ LAB_EVENTS } = await import('../procgenCore/labProtocol.js'));
    moduleIndex = await import('./index.js');
});

afterEach(() => {
    delete globalThis.document;
    delete globalThis.window;
});

/** A registrationApi stand-in that records everything the module declares. */
function recordingApi() {
    const seen = { panels: [], publishers: [], subscriberIntents: [] };
    return {
        seen,
        registerPanelComponent(type, cls) { seen.panels.push([type, cls]); },
        registerEventBusPublisher(event) { seen.publishers.push(event); },
        registerEventBusSubscriberIntent(event) { seen.subscriberIntents.push(event); },
    };
}

/** A panel wired to the real eventBus, with the publisher registrations made. */
function mountPanel(substrate) {
    const api = recordingApi();
    moduleIndex.register(api);
    /**
     * ⛔ AND THEN REALLY REGISTER THEM. The recording api above measures WHAT
     * the module declares; the app's own `registrationApi` also forwards each
     * declaration to `eventBus.registerPublisher`, and without that the bus
     * SKIPS every one of the panel's publishes (`eventBus.js:126`, warn +
     * return). A test that omitted this would watch the panel's sends vanish
     * and blame the panel.
     */
    for (const event of api.seen.publishers) {
        eventBus.registerPublisher(event, 'procgenLabPanel');
    }
    return new ProcgenLabPanelUI({}, { substrate });
}

/**
 * ⛓ PUBLISH AS SOMEBODY. `eventBus.publish` SKIPS an unregistered publisher
 * with a warning and no throw (`eventBus.js:126`) — in the app the adapter
 * registers `iframe_<id>` dynamically at publish time
 * (`iframeAdapterCore.handlePublishEventBus`), so a test that did not do the
 * same would measure the bus refusing its own fixture and call it a routing
 * result. ⚠ Worth stating: this is exactly the silent-drop shape the panel's
 * resend exists for, met once on the way to testing it.
 */
function publishAs(event, data, who) {
    eventBus.registerPublisher(event, who);
    eventBus.publish(event, data, who);
}

/* ══════════════════════════════════════════════════════════════════════
 * REGISTRATION
 * ══════════════════════════════════════════════════════════════════════ */

describe('procgenLabPanel — what the module declares', () => {
    it('declares the panel component, allowMultipleInstances and the one requirement', () => {
        expect(moduleIndex.moduleInfo.componentType).toBe('procgenLabPanel');
        expect(moduleIndex.moduleInfo.allowMultipleInstances).toBe(true);
        expect(moduleIndex.moduleInfo.requires).toEqual(['iframeAdapter']);
    });

    it('⛓ publishes the THREE host→page events and subscribes to the FOUR page→host '
        + 'ones plus iframe:appReady', () => {
        const api = recordingApi();
        moduleIndex.register(api);
        expect(api.seen.panels.map(([t]) => t)).toEqual(['procgenLabPanel']);
        // ⛔ Stated literally rather than mapped off HOST_TO_PAGE: a test that
        // read the same table the code reads would pass whatever that table said.
        expect(api.seen.publishers.sort()).toEqual([
            'procgenLab:load', 'procgenLab:navigate', 'procgenLab:requestState',
        ]);
        expect(api.seen.subscriberIntents.sort()).toEqual([
            'iframe:appReady', 'procgenLab:levelChanged', 'procgenLab:ready',
            'procgenLab:selectTile', 'procgenLab:stateChanged',
        ]);
    });

    it('knows a page for every substrate the protocol names, and no others', async () => {
        const { SUBSTRATES } = await import('../procgenCore/labProtocol.js');
        expect(Object.keys(LAB_PAGES).sort()).toEqual([...SUBSTRATES].sort());
        expect(LAB_PAGES.maze.path).toBe('./modules/mazeRoom/lab.html');
        expect(LAB_PAGES.seedling.path).toBe('./modules/seedlingDemo/watch.html');
        // ⚠ The asymmetry is the two pages' own — watch.html refuses to infer
        // its GENERATE arm, lab.html defaults to it (slice 3 §10.4).
        expect(LAB_PAGES.seedling.query).toBe('source=generate');
        expect(LAB_PAGES.maze.query).toBe('');
        // ⛔ NEITHER boots with run=1.
        for (const page of Object.values(LAB_PAGES)) expect(page.query).not.toMatch(/run=1/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ADDRESSING
 * ══════════════════════════════════════════════════════════════════════ */

describe('procgenLabPanel — the address', () => {
    it('gives every instance its own iframeId', () => {
        const a = nextLabIframeId('maze');
        const b = nextLabIframeId('maze');
        expect(a).not.toBe(b);
        expect(a).toMatch(/^procgenLab-maze-\d+$/);
    });

    it('puts iframeId and hostOrigin on the iframe src, and tells the adapter the '
        + 'expected origin BEFORE the src is set', () => {
        const panel = mountPanel('maze');
        expect(panel.iframe.src).toContain(`iframeId=${panel.iframeId}`);
        expect(panel.iframe.src).toContain('hostOrigin=http%3A%2F%2Flocalhost%3A8000');
        expect(window.iframeAdapterCore.expected.get(panel.iframeId))
            .toBe('http://localhost:8000');
    });

    it('⛔ REFUSES an unknown substrate on the panel, and mounts no iframe', () => {
        const panel = new ProcgenLabPanelUI({}, { substrate: 'bounce' });
        expect(panel.iframe).toBeUndefined();
        expect(panel.getRootElement().children[0].textContent)
            .toMatch(/not one of \[maze, seedling\]/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ROUTING — two panels, one bus
 * ══════════════════════════════════════════════════════════════════════ */

describe('procgenLabPanel — two panels on one bus', () => {
    it('⛓⛓ each panel ignores the OTHER frame\'s stateChanged', () => {
        const maze = mountPanel('maze');
        const seedling = mountPanel('seedling');
        const mazeState = {
            substrate: 'maze', iframeId: maze.iframeId,
            url: 'http://localhost:8000/frontend/modules/mazeRoom/lab.html?seed=3',
            source: 'generate', seed: 3, step: 4, identity: 'seed 3 · maze-v1 · 11x11',
            certified: true, edits: 0, directives: [],
        };
        publishAs(LAB_EVENTS.stateChanged, mazeState, `iframe_${maze.iframeId}`);
        expect(maze.lastState).toEqual(mazeState);
        // ⛔ THE ROUTING CLAIM'S UNIT TWIN: the Seedling panel saw the same
        // publish and must not have taken it.
        expect(seedling.lastState).toBe(null);
    });

    it('⛔ a stateChanged with NO iframeId reaches neither panel', () => {
        const maze = mountPanel('maze');
        const stateless = {
            substrate: 'maze',
            url: 'x', source: 'generate', seed: 1, step: 0, identity: 'i',
            certified: null, edits: 0, directives: [],
        };
        publishAs(LAB_EVENTS.stateChanged, stateless, `iframe_${maze.iframeId}`);
        expect(maze.lastState).toBe(null);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE RESEND — mutant (b)'s unit twin
 * ══════════════════════════════════════════════════════════════════════ */

describe('procgenLabPanel — a send before the frame connects', () => {
    it('⛓⛓⛓ QUEUES the load and publishes it on iframe:appReady', () => {
        const panel = mountPanel('maze');
        const seen = [];
        eventBus.subscribe(LAB_EVENTS.load, (d) => seen.push(d), 'test-observer');

        expect(panel.connected).toBe(false);
        const sentNow = panel.load({ seed: 3 });
        expect(sentNow).toBe(false);
        // ⛔ NOTHING ON THE BUS YET — the frame is not subscribed, so a publish
        // here would reach nobody and leave no trace (eventBus returns early
        // when an event has no subscribers at all).
        expect(seen).toHaveLength(0);

        publishAs('iframe:appReady', { iframeId: panel.iframeId }, 'iframeAdapter');
        expect(seen).toHaveLength(1);
        expect(seen[0]).toEqual({
            substrate: 'maze', iframeId: panel.iframeId, payload: { seed: 3 },
        });
        // ⚠ AND ONCE ONLY. A second appReady (the frame reloaded) must not
        // replay a payload the reader has moved on from.
        publishAs('iframe:appReady', { iframeId: panel.iframeId }, 'iframeAdapter');
        expect(seen).toHaveLength(1);
    });

    it('does NOT flush on another frame\'s appReady', () => {
        const panel = mountPanel('maze');
        const seen = [];
        eventBus.subscribe(LAB_EVENTS.load, (d) => seen.push(d), 'test-observer');
        panel.load({ seed: 3 });
        publishAs('iframe:appReady', { iframeId: 'somebody-else' }, 'iframeAdapter');
        expect(seen).toHaveLength(0);
    });

    it('⛓ flushes on procgenLab:ready too — a reconnecting frame keeps its queue', () => {
        const panel = mountPanel('seedling');
        const seen = [];
        eventBus.subscribe(LAB_EVENTS.navigate, (d) => seen.push(d), 'test-observer');
        panel.navigate('source=generate&seed=3');
        publishAs(LAB_EVENTS.ready, {
            substrate: 'seedling', iframeId: panel.iframeId, url: HOST_HREF,
        }, `iframe_${panel.iframeId}`);
        expect(seen).toHaveLength(1);
        expect(seen[0].search).toBe('source=generate&seed=3');
    });

    it('⛔ the queue is ONE-DEEP and the LAST send wins', () => {
        const panel = mountPanel('maze');
        const seen = [];
        eventBus.subscribe(LAB_EVENTS.load, (d) => seen.push(d), 'test-observer');
        panel.load({ seed: 1 });
        panel.load({ seed: 2 });
        publishAs('iframe:appReady', { iframeId: panel.iframeId }, 'iframeAdapter');
        expect(seen).toHaveLength(1);
        expect(seen[0].payload).toEqual({ seed: 2 });
    });

    it('⛔ NAVIGATE flushes BEFORE LOAD — the other order throws the load away', () => {
        const panel = mountPanel('maze');
        const order = [];
        eventBus.subscribe(LAB_EVENTS.load, () => order.push('load'), 'test-observer');
        eventBus.subscribe(LAB_EVENTS.navigate, () => order.push('navigate'), 'test-observer');
        panel.load({ seed: 9 });
        panel.navigate('seed=9');
        publishAs('iframe:appReady', { iframeId: panel.iframeId }, 'iframeAdapter');
        expect(order).toEqual(['navigate', 'load']);
    });

    it('publishes straight through once connected', () => {
        const panel = mountPanel('maze');
        const seen = [];
        eventBus.subscribe(LAB_EVENTS.load, (d) => seen.push(d), 'test-observer');
        publishAs('iframe:appReady', { iframeId: panel.iframeId }, 'iframeAdapter');
        expect(panel.load({ seed: 4 })).toBe(true);
        expect(seen).toHaveLength(1);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * VALIDATION AT THE PUBLISH
 * ══════════════════════════════════════════════════════════════════════ */

describe('procgenLabPanel — the panel validates what it sends', () => {
    it('refuses a non-object payload BEFORE it queues or publishes it', () => {
        const panel = mountPanel('maze');
        expect(() => panel.load(null)).toThrow(/must be an object/);
        expect(panel.pendingLoad).toBe(null);
    });

    it('refuses a non-string search', () => {
        const panel = mountPanel('maze');
        expect(() => panel.navigate(42)).toThrow(/must be a string/);
    });

    it('SEND reports a JSON refusal verbatim and does NOT clear the box', () => {
        const panel = mountPanel('maze');
        const box = byRole(panel.getRootElement(), 'payload');
        box.value = '{not json';
        byRole(panel.getRootElement(), 'send').onclick();
        expect(box.value).toBe('{not json');
        expect(byRole(panel.getRootElement(), 'note').textContent)
            .toMatch(/that is not JSON/);
    });

    it('TAKE says so when the page has reported no level yet', () => {
        const panel = mountPanel('maze');
        byRole(panel.getRootElement(), 'take').onclick();
        expect(byRole(panel.getRootElement(), 'note').textContent)
            .toMatch(/nothing to take yet/);
    });

    it('TAKE puts the LAST reported level in the box', () => {
        const panel = mountPanel('maze');
        publishAs(LAB_EVENTS.levelChanged, {
            substrate: 'maze', iframeId: panel.iframeId, payload: { seed: 3, level: { w: 11 } },
        }, `iframe_${panel.iframeId}`);
        byRole(panel.getRootElement(), 'take').onclick();
        expect(JSON.parse(byRole(panel.getRootElement(), 'payload').value))
            .toEqual({ seed: 3, level: { w: 11 } });
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE READOUT
 * ══════════════════════════════════════════════════════════════════════ */

describe('procgenLabPanel — the status line', () => {
    const state = (over) => ({
        substrate: 'maze', iframeId: null,
        url: 'http://localhost:8000/frontend/modules/mazeRoom/lab.html?seed=3&iframeId=x',
        source: 'generate', seed: 3, step: 4, identity: 'seed 3 · maze-v1 · 11x11',
        certified: true, edits: 0, directives: [], ...over,
    });

    it('says connecting before anything arrives', () => {
        expect(mountPanel('maze').statusText()).toMatch(/connecting/);
    });

    it('⛓ prints THREE certification words — null is not false', () => {
        const panel = mountPanel('maze');
        for (const [certified, word] of [[true, 'CERTIFIED'], [false, 'UNCERTIFIED'],
            [null, 'CERTIFIED?']]) {
            publishAs(LAB_EVENTS.stateChanged,
                state({ iframeId: panel.iframeId, certified }), `iframe_${panel.iframeId}`);
            expect(panel.statusText()).toContain(`· ${word} ·`);
        }
    });

    it('mirrors the page\'s identity line and the edit count', () => {
        const panel = mountPanel('maze');
        publishAs(LAB_EVENTS.stateChanged,
            state({ iframeId: panel.iframeId, edits: 2, identity: 'seed 3, then 2 edit(s)' }),
            `iframe_${panel.iframeId}`);
        expect(panel.statusText()).toContain('seed 3, then 2 edit(s)');
        expect(panel.statusText()).toContain('2 edit(s)');
    });
});

describe('procgenLabPanel — open standalone', () => {
    it('⛓ strips iframeId AND hostOrigin, and keeps everything else', () => {
        const href = standaloneUrlFrom(
            'http://localhost:8000/frontend/modules/mazeRoom/lab.html'
            + '?seed=3&count=4&iframeId=procgenLab-maze-1&hostOrigin=http%3A%2F%2Fx&run=1');
        expect(href).not.toContain('iframeId');
        expect(href).not.toContain('hostOrigin');
        expect(href).toContain('seed=3');
        expect(href).toContain('count=4');
        expect(href).toContain('run=1');
    });

    it('⛔ is built from the LAST stateChanged, not from the initial src', () => {
        const panel = mountPanel('maze');
        expect(panel.initialSrc).toContain('iframeId=');
        const link = byRole(panel.getRootElement(), 'open-standalone');
        expect(link.getAttribute?.('aria-disabled')).toBe('true');
        publishAs(LAB_EVENTS.stateChanged, {
            substrate: 'maze', iframeId: panel.iframeId,
            url: 'http://localhost:8000/frontend/modules/mazeRoom/lab.html'
                + `?seed=7&count=2&iframeId=${panel.iframeId}`,
            source: 'generate', seed: 7, step: 2, identity: 'seed 7', certified: false,
            edits: 0, directives: [],
        }, `iframe_${panel.iframeId}`);
        expect(link.href).toContain('seed=7');
        expect(link.href).not.toContain('iframeId');
    });

    it('answers null for a url it cannot parse rather than guessing', () => {
        expect(standaloneUrlFrom('')).toBe(null);
        expect(standaloneUrlFrom(null)).toBe(null);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * TEARDOWN — trap 259's host-side twin
 * ══════════════════════════════════════════════════════════════════════ */

describe('procgenLabPanel — destroy', () => {
    it('⛔ unsubscribes EVERY subscription it made, so a destroyed panel is deaf', () => {
        const panel = mountPanel('maze');
        expect(panel._unsubs.length).toBe(5);
        panel.destroy();
        expect(panel._unsubs).toEqual([]);
        // The bus still carries the event; the panel must no longer take it.
        publishAs(LAB_EVENTS.stateChanged, {
            substrate: 'maze', iframeId: panel.iframeId, url: 'x', source: 'generate',
            seed: 1, step: 0, identity: 'i', certified: null, edits: 0, directives: [],
        }, 'iframe_x');
        expect(panel.lastState).toBe(null);
    });

    it('unregisters its iframe with the adapter and blanks the frame', () => {
        const panel = mountPanel('maze');
        panel.destroy();
        expect(window.iframeAdapterCore.unregistered).toContain(panel.iframeId);
    });
});
